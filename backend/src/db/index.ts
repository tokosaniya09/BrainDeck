import { Pool } from 'pg';
import { StudySet, Flashcard, QuizQuestion } from '../services/ai';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const initDB = async () => {
  if (!process.env.DATABASE_URL) {
    console.log("⚠️  DATABASE_URL missing. Skipping DB initialization.");
    return;
  }

  let retries = 5;
  
  while (retries > 0) {
    try {
      const client = await pool.connect();
      try {
        console.log("📦 Initializing Database Tables...");
        
        // Create Study Sets Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS study_sets (
            id SERIAL PRIMARY KEY,
            topic TEXT NOT NULL,
            summary TEXT,
            estimated_study_time_minutes INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Create Flashcards Table
        await client.query(`
          CREATE TABLE IF NOT EXISTS flashcards (
            id SERIAL PRIMARY KEY,
            set_id INTEGER REFERENCES study_sets(id) ON DELETE CASCADE,
            front TEXT NOT NULL,
            back TEXT NOT NULL,
            difficulty TEXT,
            tags TEXT[]
          );
        `);
        
        console.log("✅ Database tables ready.");
        return; // Success, exit function
      } finally {
        client.release();
      }
    } catch (error) {
      console.log(`⚠️ Database not ready yet. Retrying in 2s... (${retries} attempts left)`);
      retries--;
      await new Promise(res => setTimeout(res, 2000));
    }
  }

  throw new Error("❌ Could not connect to database after multiple attempts. Please ensure Docker container is running.");
};

export const saveStudySet = async (data: StudySet) => {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not set. Skipping DB save.");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Study Set
    const setRes = await client.query(
      `INSERT INTO study_sets (topic, summary, estimated_study_time_minutes) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      [data.topic, data.summary, data.estimated_study_time_minutes]
    );
    const setId = setRes.rows[0].id;

    // 2. Insert Flashcards
    for (const card of data.flashcards) {
      await client.query(
        `INSERT INTO flashcards (set_id, front, back, difficulty, tags) 
         VALUES ($1, $2, $3, $4, $5)`,
        [setId, card.front, card.back, card.difficulty, card.tags]
      );
    }

    await client.query('COMMIT');
    console.log(`Saved study set ${setId} to database.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

export const getRecentStudySets = async (limit = 5) => {
  if (!process.env.DATABASE_URL) return [];
  
  try {
    const res = await pool.query(
      `SELECT id, topic, summary, estimated_study_time_minutes, created_at 
       FROM study_sets 
       ORDER BY id DESC 
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  } catch (error) {
    console.error("Failed to fetch history:", error);
    // Return empty array instead of crashing if table doesn't exist yet
    return [];
  }
};

export const getStudySetById = async (id: number): Promise<StudySet | null> => {
  if (!process.env.DATABASE_URL) return null;

  const client = await pool.connect();
  try {
    // 1. Get Set Info
    const setRes = await client.query('SELECT * FROM study_sets WHERE id = $1', [id]);
    if (setRes.rows.length === 0) return null;
    const set = setRes.rows[0];

    // 2. Get Flashcards
    const cardsRes = await client.query('SELECT * FROM flashcards WHERE set_id = $1', [id]);
    
    // Map DB rows back to TypeScript interfaces
    const flashcards: Flashcard[] = cardsRes.rows.map(row => ({
      id: row.id.toString(),
      front: row.front,
      back: row.back,
      difficulty: row.difficulty,
      tags: row.tags || []
    }));

    // Placeholder for quizzes since they aren't in DB yet
    const example_quiz_questions: QuizQuestion[] = [];

    return {
      topic: set.topic,
      summary: set.summary,
      estimated_study_time_minutes: set.estimated_study_time_minutes,
      flashcards,
      example_quiz_questions
    };
  } finally {
    client.release();
  }
};

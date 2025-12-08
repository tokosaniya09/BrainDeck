import { Pool } from 'pg';
import { StudySet } from '../services/ai';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Allow connection even if env var is missing during dev/test to avoid crash on import
  // But operations will fail naturally
});

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

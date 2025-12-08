"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSimilarStudySet = exports.getStudySetById = exports.getRecentStudySets = exports.saveStudySet = exports.initDB = void 0;
const pg_1 = require("pg");
// pg automatically converts Postgres arrays to JS arrays.
// However, pgvector inputs are usually handled as string strings '[1,2,3]' in parameterized queries
// or we rely on the extension logic. Passing JS arrays usually works with the 'pg' driver.
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
const initDB = async () => {
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
                // 1. Enable Vector Extension (Requires pgvector image)
                try {
                    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
                }
                catch (e) {
                    console.warn("⚠️  Could not create 'vector' extension. Ensure you are using a Postgres image with pgvector installed (e.g., pgvector/pgvector:pg16). Semantic search will fail without it.");
                }
                // 2. Create Study Sets Table with Vector Column
                // text-embedding-004 uses 768 dimensions
                await client.query(`
          CREATE TABLE IF NOT EXISTS study_sets (
            id SERIAL PRIMARY KEY,
            topic TEXT NOT NULL,
            summary TEXT,
            estimated_study_time_minutes INTEGER,
            embedding vector(768), 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
                // Add index for faster vector search (HNSW) if it doesn't exist
                // We use a try/catch here because checking for index existence is verbose in SQL
                try {
                    await client.query(`
                CREATE INDEX IF NOT EXISTS study_sets_embedding_idx 
                ON study_sets USING hnsw (embedding vector_cosine_ops);
            `);
                }
                catch (e) {
                    console.log("Note: Could not create HNSW index (might not have enough data or permissions), skipping.");
                }
                // 3. Create Flashcards Table
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
            }
            finally {
                client.release();
            }
        }
        catch (error) {
            console.log(`⚠️ Database not ready yet. Retrying in 2s... (${retries} attempts left). Error: ${error.message}`);
            retries--;
            await new Promise(res => setTimeout(res, 2000));
        }
    }
    throw new Error("❌ Could not connect to database after multiple attempts. Please ensure Docker container is running.");
};
exports.initDB = initDB;
const saveStudySet = async (data, embedding) => {
    if (!process.env.DATABASE_URL) {
        console.warn("DATABASE_URL not set. Skipping DB save.");
        return;
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // 1. Insert Study Set with Embedding (if provided)
        // We cast the array to a string representation for pgvector if needed, but pg usually handles number[] -> vector
        const setRes = await client.query(`INSERT INTO study_sets (topic, summary, estimated_study_time_minutes, embedding) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id`, [
            data.topic,
            data.summary,
            data.estimated_study_time_minutes,
            embedding ? JSON.stringify(embedding) : null // pgvector accepts '[1,2,3]' string format
        ]);
        const setId = setRes.rows[0].id;
        // 2. Insert Flashcards
        for (const card of data.flashcards) {
            await client.query(`INSERT INTO flashcards (set_id, front, back, difficulty, tags) 
         VALUES ($1, $2, $3, $4, $5)`, [setId, card.front, card.back, card.difficulty, card.tags]);
        }
        await client.query('COMMIT');
        console.log(`Saved study set ${setId} to database.`);
    }
    catch (e) {
        await client.query('ROLLBACK');
        throw e;
    }
    finally {
        client.release();
    }
};
exports.saveStudySet = saveStudySet;
const getRecentStudySets = async (limit = 5) => {
    if (!process.env.DATABASE_URL)
        return [];
    try {
        const res = await pool.query(`SELECT id, topic, summary, estimated_study_time_minutes, created_at 
       FROM study_sets 
       ORDER BY id DESC 
       LIMIT $1`, [limit]);
        return res.rows;
    }
    catch (error) {
        console.error("Failed to fetch history:", error);
        return [];
    }
};
exports.getRecentStudySets = getRecentStudySets;
const getStudySetById = async (id) => {
    if (!process.env.DATABASE_URL)
        return null;
    const client = await pool.connect();
    try {
        // 1. Get Set Info
        const setRes = await client.query('SELECT * FROM study_sets WHERE id = $1', [id]);
        if (setRes.rows.length === 0)
            return null;
        const set = setRes.rows[0];
        // 2. Get Flashcards
        const cardsRes = await client.query('SELECT * FROM flashcards WHERE set_id = $1', [id]);
        // Map DB rows back to TypeScript interfaces
        const flashcards = cardsRes.rows.map(row => ({
            id: row.id.toString(),
            front: row.front,
            back: row.back,
            difficulty: row.difficulty,
            tags: row.tags || []
        }));
        // Placeholder for quizzes since they aren't in DB yet
        const example_quiz_questions = [];
        return {
            topic: set.topic,
            summary: set.summary,
            estimated_study_time_minutes: set.estimated_study_time_minutes,
            flashcards,
            example_quiz_questions
        };
    }
    finally {
        client.release();
    }
};
exports.getStudySetById = getStudySetById;
// NEW: Check if we have this topic cached using VECTOR SEARCH
const findSimilarStudySet = async (embedding) => {
    if (!process.env.DATABASE_URL)
        return null;
    try {
        // Use the cosine distance operator <=>
        // We set a threshold (e.g., 0.25). 
        // 0 = Exact match. 1 = Orthogonal.
        // 0.25 is usually a good starting point for "closely related".
        const formattedEmbedding = JSON.stringify(embedding);
        const res = await pool.query(`SELECT id, topic, (embedding <=> $1) as distance 
       FROM study_sets 
       ORDER BY distance ASC 
       LIMIT 1`, [formattedEmbedding]);
        if (res.rows.length > 0) {
            const bestMatch = res.rows[0];
            // Check threshold
            if (bestMatch.distance < 0.25) {
                console.log(`⚡ Semantic Cache Hit! Found: "${bestMatch.topic}" (Distance: ${bestMatch.distance.toFixed(4)})`);
                return (0, exports.getStudySetById)(bestMatch.id);
            }
            else {
                console.log(`Cache Miss. Nearest topic was "${bestMatch.topic}" but distance ${bestMatch.distance.toFixed(4)} > 0.25`);
            }
        }
        return null;
    }
    catch (error) {
        console.error("Error checking vector cache:", error);
        return null;
    }
};
exports.findSimilarStudySet = findSimilarStudySet;

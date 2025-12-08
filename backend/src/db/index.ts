import { Pool } from 'pg';
import { PostgresStudySetRepository } from '../repositories/StudySetRepository';

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing in environment variables.");
}

// 1. Singleton Pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 2. Singleton Repository
export const studySetRepository = new PostgresStudySetRepository(pool);

// 3. Simple Connection Check (Migrations should be run via 'npm run migrate')
export const initDB = async () => {
  let retries = 5;
  while (retries > 0) {
    try {
      const client = await pool.connect();
      console.log("✅ Database connected successfully.");
      client.release();
      return;
    } catch (error: any) {
      console.log(`⚠️ Database unreachable. Retrying in 2s... (${retries} attempts). Error: ${error.message}`);
      retries--;
      await new Promise(res => setTimeout(res, 2000));
    }
  }
  throw new Error("❌ Could not connect to database. Ensure Docker is running and 'npm run migrate' has been executed.");
};
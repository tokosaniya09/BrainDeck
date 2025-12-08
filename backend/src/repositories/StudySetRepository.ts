import { Pool } from 'pg';
import { StudySet, Flashcard, QuizQuestion } from '../services/ai';

export interface IStudySetRepository {
  createStudySet(data: StudySet, embedding?: number[]): Promise<number>;
  recordActivity(userId: number, studySetId: number): Promise<void>;
  getById(id: number): Promise<StudySet | null>;
  getUserHistory(userId: number, limit: number): Promise<any[]>;
  findBySemantics(embedding: number[], threshold: number): Promise<StudySet | null>;
}

export class PostgresStudySetRepository implements IStudySetRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async createStudySet(data: StudySet, embedding?: number[]): Promise<number> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const vectorString = embedding ? JSON.stringify(embedding) : null;
      
      const setRes = await client.query(
        `INSERT INTO study_sets (topic, summary, estimated_study_time_minutes, embedding) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id`,
        [data.topic, data.summary, data.estimated_study_time_minutes, vectorString]
      );
      const setId = setRes.rows[0].id;

      for (const card of data.flashcards) {
        await client.query(
          `INSERT INTO flashcards (set_id, front, back, difficulty, tags) 
           VALUES ($1, $2, $3, $4, $5)`,
          [setId, card.front, card.back, card.difficulty, card.tags]
        );
      }

      if (data.example_quiz_questions && data.example_quiz_questions.length > 0) {
        for (const q of data.example_quiz_questions) {
          await client.query(
            `INSERT INTO quiz_questions (set_id, question, choices, answer_index) 
             VALUES ($1, $2, $3, $4)`,
            [setId, q.question, q.choices, q.answer_index]
          );
        }
      }

      await client.query('COMMIT');
      return setId;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Repository: Transaction failed", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Changed userId to number
  async recordActivity(userId: number, studySetId: number): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO user_activity (user_id, study_set_id, accessed_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, study_set_id) 
         DO UPDATE SET accessed_at = NOW()`,
        [userId, studySetId]
      );
    } catch (error) {
      console.error("Repository: Failed to record user activity", error);
    }
  }

  async getById(id: number): Promise<StudySet | null> {
    const client = await this.pool.connect();
    try {
      const setRes = await client.query('SELECT * FROM study_sets WHERE id = $1', [id]);
      if (setRes.rows.length === 0) return null;
      const set = setRes.rows[0];

      const cardsRes = await client.query('SELECT * FROM flashcards WHERE set_id = $1', [id]);
      const flashcards: Flashcard[] = cardsRes.rows.map(row => ({
        id: row.id.toString(),
        front: row.front,
        back: row.back,
        difficulty: row.difficulty,
        tags: row.tags || []
      }));

      const quizRes = await client.query('SELECT * FROM quiz_questions WHERE set_id = $1', [id]);
      const example_quiz_questions: QuizQuestion[] = quizRes.rows.map(row => ({
        question: row.question,
        choices: row.choices || [],
        answer_index: row.answer_index
      }));

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
  }

  // Changed userId to number
  async getUserHistory(userId: number, limit: number = 10): Promise<any[]> {
    try {
      const res = await this.pool.query(
        `SELECT s.id, s.topic, s.summary, s.estimated_study_time_minutes, ua.accessed_at as created_at
         FROM user_activity ua
         JOIN study_sets s ON ua.study_set_id = s.id
         WHERE ua.user_id = $1
         ORDER BY ua.accessed_at DESC 
         LIMIT $2`,
        [userId, limit]
      );
      return res.rows;
    } catch (error) {
      console.error("Repository: Failed to fetch user history", error);
      return [];
    }
  }

  async findBySemantics(embedding: number[], threshold: number = 0.25): Promise<StudySet | null> {
    try {
      const formattedEmbedding = JSON.stringify(embedding);

      const res = await this.pool.query(
        `SELECT id, topic, (embedding <=> $1) as distance 
         FROM study_sets 
         ORDER BY distance ASC 
         LIMIT 1`,
        [formattedEmbedding]
      );
      
      if (res.rows.length > 0) {
        const bestMatch = res.rows[0];
        if (bestMatch.distance < threshold) {
           console.log(`⚡ Repository: Cache Hit! "${bestMatch.topic}" (Dist: ${bestMatch.distance.toFixed(4)})`);
           const fullSet = await this.getById(bestMatch.id);
           if (fullSet) {
             return { ...fullSet, id: bestMatch.id } as any; 
           }
        }
      }
      return null;
    } catch (error) {
      console.error("Repository: Semantic search error", error);
      return null;
    }
  }
}
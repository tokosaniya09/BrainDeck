import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { generateFlashcards } from './ai';
import { studySetRepository } from '../db';

// 1. Setup Redis Connection
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, 
});

const QUEUE_NAME = 'flashcard-generation';

export const flashcardQueue = new Queue(QUEUE_NAME, { connection });

// 3. Define the Worker (Consumer)
const worker = new Worker(QUEUE_NAME, async (job: Job) => {
  console.log(`[Job ${job.id}] 🔄 Processing topic: ${job.data.topic}`);
  
  try {
    // A. Generate Content via AI
    const studySet = await generateFlashcards(job.data.topic);
    
    // B. Save to Database using Repository Pattern
    const embedding = job.data.embedding;
    const userId = job.data.userId; // This is now a number (or undefined)
    
    // Create the study set
    const newSetId = await studySetRepository.createStudySet(studySet, embedding);

    // Link this new set to the user's history ONLY if userId exists
    if (userId) {
      await studySetRepository.recordActivity(userId, newSetId);
    }

    console.log(`[Job ${job.id}] ✅ Completed. Saved as Set ID: ${newSetId} for User: ${userId || 'Guest'}`);
    
    return studySet;

  } catch (error) {
    console.error(`[Job ${job.id}] ❌ Failed:`, error);
    throw error;
  }
}, { 
  connection,
  concurrency: 5
});

const queueEvents = new QueueEvents(QUEUE_NAME, { connection });
queueEvents.on('completed', ({ jobId }) => {
  console.log(`Queue Event: Job ${jobId} completed`);
});

// --- Public API ---

// userId can be number or undefined (for guests)
export const addJob = async (topic: string, userId: number | undefined, embedding?: number[]): Promise<string> => {
  const job = await flashcardQueue.add('generate-studyset', { topic, userId, embedding }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 24 * 3600 }
  });
  
  if (!job.id) throw new Error("Failed to create job ID");
  return job.id;
};

export const getJobStatus = async (id: string) => {
  const job = await flashcardQueue.getJob(id);
  if (!job) return null;

  const state = await job.getState();
  const result = job.returnvalue;
  const error = job.failedReason;

  let status = 'pending';
  if (state === 'active') status = 'processing';
  if (state === 'completed') status = 'completed';
  if (state === 'failed') status = 'failed';

  return {
    id: job.id,
    topic: job.data.topic,
    status,
    result,
    error,
    createdAt: job.timestamp,
    finishedAt: job.finishedOn
  };
};
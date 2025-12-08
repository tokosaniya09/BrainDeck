import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { generateFlashcards, StudySet } from './ai';
import { saveStudySet } from '../db';

// 1. Setup Redis Connection
// BullMQ requires a specific configuration for maxRetriesPerRequest
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, 
});

const QUEUE_NAME = 'flashcard-generation';

// 2. Define the Queue (Producer)
// This is used to add jobs to Redis
export const flashcardQueue = new Queue(QUEUE_NAME, { connection });

// 3. Define the Worker (Consumer)
// This processes jobs from Redis. In a microservices architecture, 
// this code often lives in a separate "worker" application.
const worker = new Worker(QUEUE_NAME, async (job: Job) => {
  console.log(`[Job ${job.id}] 🔄 Processing topic: ${job.data.topic}`);
  
  try {
    // A. Generate Content via AI
    const studySet = await generateFlashcards(job.data.topic);
    
    // B. Save to Database
    // We use the embedding passed from the controller (if available)
    // so we don't have to call the Embedding API again.
    const embedding = job.data.embedding;
    await saveStudySet(studySet, embedding);

    console.log(`[Job ${job.id}] ✅ Completed`);
    
    // The return value is stored in Redis as the "result" of the job
    return studySet;

  } catch (error) {
    console.error(`[Job ${job.id}] ❌ Failed:`, error);
    throw error; // Throwing triggers BullMQ's retry logic (if configured)
  }
}, { 
  connection,
  concurrency: 5 // Process 5 jobs in parallel
});

// Optional: Global Event Listeners for logging
const queueEvents = new QueueEvents(QUEUE_NAME, { connection });
queueEvents.on('completed', ({ jobId }) => {
  console.log(`Queue Event: Job ${jobId} completed`);
});

// --- Public API for Controller ---

export const addJob = async (topic: string, embedding?: number[]): Promise<string> => {
  // Add job with retry configuration
  // We include the embedding in the payload to save it to DB later without re-generating
  const job = await flashcardQueue.add('generate-studyset', { topic, embedding }, {
    attempts: 3, // Retry 3 times if it fails (e.g., API timeout)
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100 // Keep max 100 jobs
    },
    removeOnFail: {
        age: 24 * 3600 // Keep failed jobs for 24 hours
    }
  });
  
  if (!job.id) throw new Error("Failed to create job ID");
  return job.id;
};

export const getJobStatus = async (id: string) => {
  const job = await flashcardQueue.getJob(id);
  
  if (!job) {
    return null;
  }

  const state = await job.getState(); // 'completed' | 'failed' | 'delayed' | 'active' | 'waiting'
  const result = job.returnvalue;
  const error = job.failedReason;

  // Map BullMQ states to our simplified API states
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
import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { IAIService } from '../interfaces/IAIService';
import { IStudySetRepository } from '../repositories/StudySetRepository';
import { logger } from '../utils/logger';

const QUEUE_NAME = 'flashcard-generation';

export class FlashcardQueueService {
  public queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;

  constructor(
    private aiService: IAIService,
    private studySetRepository: IStudySetRepository,
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379'
  ) {
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue(QUEUE_NAME, { connection });
    
    this.worker = new Worker(QUEUE_NAME, async (job: Job) => {
      const { topic, userId, embedding, correlationId } = job.data;
      logger.info(`[Job ${job.id}] 🔄 Processing`, { topic, userId, correlationId });
      
      try {
        // A. Generate Content via AI Service
        const studySet = await this.aiService.generateFlashcards(topic, correlationId);
        
        // B. Save to Database using Repository
        const newSetId = await this.studySetRepository.createStudySet(studySet, embedding);

        // Link this new set to the user's history ONLY if userId exists
        if (userId) {
          await this.studySetRepository.recordActivity(userId, newSetId);
        }

        logger.info(`[Job ${job.id}] ✅ Completed`, { newSetId, userId, correlationId });
        
        return studySet;

      } catch (error) {
        logger.error(`[Job ${job.id}] ❌ Failed`, { error, correlationId });
        throw error;
      }
    }, { 
      connection,
      concurrency: 5 
    });

    this.queueEvents = new QueueEvents(QUEUE_NAME, { connection });
    
    this.queueEvents.on('completed', ({ jobId }) => {
      logger.debug(`Queue Event: Job ${jobId} completed`);
    });
  }

  async addJob(topic: string, userId: number | undefined, embedding?: number[], correlationId?: string): Promise<string> {
    const job = await this.queue.add('generate-studyset', { topic, userId, embedding, correlationId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 3600, count: 100 },
      removeOnFail: { age: 24 * 3600 }
    });
    
    if (!job.id) throw new Error("Failed to create job ID");
    return job.id;
  }

  async getJobStatus(id: string) {
    const job = await this.queue.getJob(id);
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
  }

  async getQueueCounts() {
    return this.queue.getJobCounts('active', 'completed', 'failed', 'waiting');
  }
}
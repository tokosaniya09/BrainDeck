import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { IAIService } from '../interfaces/IAIService';
import { IStudySetRepository } from '../repositories/StudySetRepository';
import { logger } from '../utils/logger';
import { IOCRService, ocrService as defaultOcrService, OCROutput } from './ocr';

const QUEUE_NAME = 'flashcard-generation';

interface JobData {
  topic: string;
  userId?: number;
  embedding?: number[];
  correlationId?: string;
  content?: string; // Raw text from file uploads
  instructions?: string; // Optional user instructions
  image?: { // For image uploads
    data: string; // base64
    mimeType: string;
  };
}

export class FlashcardQueueService {
  public queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;

  constructor(
    private aiService: IAIService,
    private studySetRepository: IStudySetRepository,
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379',
    private ocrService: IOCRService = defaultOcrService
  ) {
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.queue = new Queue(QUEUE_NAME, { connection });
    
    this.worker = new Worker(QUEUE_NAME, async (job: Job<JobData>) => {
      const { topic, userId, embedding, correlationId, content, instructions, image } = job.data;
      logger.info(`[Job ${job.id}] 🔄 Processing`, { topic, userId, correlationId, hasContent: !!content, hasImage: !!image });
      
      try {
        let studySet;
        let ocrMetrics: (OCROutput & { applied: boolean; fallbackToVision?: boolean }) | null = null;
        let effectiveContent = content;
        
        // A. If image upload: Run Tesseract OCR first to extract, clean, and vectorize text
        if (image) {
          try {
            logger.info(`[Job ${job.id}] 🔍 Invoking Tesseract OCR on uploaded image...`, { mimeType: image.mimeType, correlationId });
            const imageBuffer = Buffer.from(image.data, 'base64');
            const ocrResult = await this.ocrService.extractText(imageBuffer, image.mimeType);

            logger.info(`[Job ${job.id}] 📑 Tesseract OCR completed`, {
              confidence: ocrResult.confidence,
              wordCount: ocrResult.wordCount,
              durationMs: ocrResult.durationMs,
              correlationId,
            });

            // Threshold: Confidence >= 35% and at least 30 characters
            if (ocrResult.confidence >= 35 && ocrResult.text.length >= 30) {
              ocrMetrics = { ...ocrResult, applied: true };
              effectiveContent = ocrResult.text;

              // Step 1: Check Semantic Cache using pgvector for the extracted OCR text
              let ocrEmbedding = embedding;
              if (!ocrEmbedding) {
                try {
                  const textSnippet = effectiveContent.slice(0, 300);
                  ocrEmbedding = await this.aiService.generateEmbedding(textSnippet);
                  const semanticMatch: any = await this.studySetRepository.findBySemantics(ocrEmbedding, 0.22);
                  if (semanticMatch) {
                    logger.info(`[Job ${job.id}] 🎯 OCR Semantic Cache Hit! Reusing study set`, {
                      cachedId: semanticMatch.id,
                      correlationId,
                    });
                    if (userId && semanticMatch.id) {
                      await this.studySetRepository.recordActivity(userId, semanticMatch.id);
                    }
                    return { ...semanticMatch, ocr: ocrMetrics, cacheHit: true };
                  }
                } catch (cacheErr: any) {
                  logger.warn(`[Job ${job.id}] OCR Semantic cache lookup warning: ${cacheErr?.message}`);
                }
              }

              // Step 2: Generate study set from token-efficient extracted text (saving ~75% tokens vs image tokens)
              logger.info(`[Job ${job.id}] 🤖 Generating study set from OCR extracted text...`, { correlationId });
              studySet = await this.aiService.generateFlashcardsFromContent(effectiveContent, instructions, correlationId);
            } else {
              // Low confidence fallback (e.g. abstract diagram, handwriting ambiguity)
              logger.warn(`[Job ${job.id}] OCR confidence below threshold (${ocrResult.confidence}%), activating Gemini Multimodal Vision fallback`, { correlationId });
              ocrMetrics = { ...ocrResult, applied: false, fallbackToVision: true };
              studySet = await this.aiService.generateFlashcardsFromContent(undefined, instructions, correlationId, image);
            }
          } catch (ocrError: any) {
            logger.warn(`[Job ${job.id}] OCR extraction error, falling back to Multimodal Vision`, {
              error: ocrError?.message,
              correlationId,
            });
            studySet = await this.aiService.generateFlashcardsFromContent(undefined, instructions, correlationId, image);
          }
        } else if (effectiveContent) {
          studySet = await this.aiService.generateFlashcardsFromContent(effectiveContent, instructions, correlationId);
        } else {
          studySet = await this.aiService.generateFlashcards(topic, correlationId);
        }
        
        // B. Generate embedding for the AI-determined topic if we don't have one 
        let finalEmbedding = embedding;
        if (!finalEmbedding) {
          try {
             // Generate embedding based on the result topic for future searches
             finalEmbedding = await this.aiService.generateEmbedding(studySet.topic);
          } catch (e) {
             logger.warn("Failed to generate embedding for result", { correlationId });
          }
        }

        // C. Save to Database using Repository
        const newSetId = await this.studySetRepository.createStudySet(studySet, finalEmbedding);

        // Link this new set to the user's history ONLY if userId exists
        if (userId) {
          await this.studySetRepository.recordActivity(userId, newSetId);
        }

        logger.info(`[Job ${job.id}] ✅ Completed`, { newSetId, userId, correlationId });
        
        // Return the study set WITH the new database ID and OCR metadata attached
        return { ...studySet, id: newSetId, ocr: ocrMetrics };

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

  async addJob(
    topic: string, 
    userId: number | undefined, 
    embedding?: number[], 
    correlationId?: string, 
    content?: string, 
    instructions?: string,
    image?: { data: string, mimeType: string }
  ): Promise<string> {
    const job = await this.queue.add('generate-studyset', { topic, userId, embedding, correlationId, content, instructions, image }, {
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
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import { z } from 'zod'; 
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import pdf from 'pdf-parse';

import { studySetRepository, initDB } from './db';
import authRoutes from './routes/auth';
import { requireAuth, optionalAuth } from './middleware/auth';
import { generalLimiter, generationLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';

// Services (DI Injection)
import { GeminiAIService } from './services/ai';
import { FlashcardQueueService } from './services/queue';

// Initialize Services
const aiService = new GeminiAIService(process.env.API_KEY || '');
const queueService = new FlashcardQueueService(aiService, studySetRepository);

if (!process.env.API_KEY) {
  logger.error("❌ FATAL: API_KEY is missing in backend/.env file.");
}

if (!process.env.GOOGLE_CLIENT_ID) {
  logger.warn("⚠️ WARNING: GOOGLE_CLIENT_ID is missing in backend/.env file. Google Login will fail.");
}

const app = express();
const PORT = process.env.PORT || 3000;

// Multer Setup (Memory Storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Trust Proxy
app.set('trust proxy', 1);

// Configure CORS
const allowedOrigins = [
  process.env.CLIENT_URL, 
  'http://localhost:5173', 
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true
}));

// Middleware: Correlation ID
app.use((req: any, res, next) => {
  req.id = req.headers['x-correlation-id'] || uuidv4();
  next();
});

// Apply General Rate Limiter
app.use(generalLimiter as any);

// Limit payload size (for JSON)
app.use(express.json({ limit: '10kb' }) as any);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Auth Routes ---
app.use('/api/auth', authRoutes);

// --- Job Queue Endpoints ---

// Validation Schema
const GenerateSchema = z.object({
  topic: z.string()
    .trim()
    .min(2, "Topic is too short")
    .max(200, "Topic is too long (max 200 characters)")
    .refine((val) => {
      const lower = val.toLowerCase();
      const suspicious = ["ignore previous", "system prompt", "reveal your instructions"];
      return !suspicious.some(pattern => lower.includes(pattern));
    }, "Invalid topic detected. Please provide a clear educational topic.")
});

// Standard Text Generation Route
app.post('/api/generate', optionalAuth, generationLimiter as any, async (req: any, res: any) => {
  const correlationId = req.id;
  try {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY is not configured on the server.");
    }

    const validation = GenerateSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues[0].message });
    }

    const { topic } = validation.data;
    const userId = req.user?.id; 

    // 1. LAYER 1 CACHE: Exact String Match
    const exactMatch: any = await studySetRepository.findByExactTopic(topic);
    if (exactMatch) {
       if (exactMatch.id && userId) {
         await studySetRepository.recordActivity(userId, exactMatch.id);
       }
       logger.info('Serving from Exact Cache', { topic, correlationId });
       return res.status(200).json({
         status: 'completed',
         message: 'Retrieved from exact cache',
         result: exactMatch
       });
    }

    // 2. Generate Embedding
    let embedding: number[];
    try {
      embedding = await aiService.generateEmbedding(topic);
    } catch (e: any) {
      logger.error("Embedding generation failed", { error: e.message, correlationId });
      // Fallback: Add job without embedding
      const jobId = await queueService.addJob(topic, userId, undefined, correlationId); 
      return res.status(202).json({ jobId, status: 'pending' });
    }

    // 3. LAYER 2 CACHE: Semantic Search
    const semanticMatch: any = await studySetRepository.findBySemantics(embedding, 0.25);
    
    if (semanticMatch) {
       if (semanticMatch.id && userId) {
         await studySetRepository.recordActivity(userId, semanticMatch.id);
       }
       logger.info('Serving from Semantic Cache', { topic, correlationId });
       return res.status(200).json({
         status: 'completed',
         message: 'Retrieved from semantic cache',
         result: semanticMatch
       });
    }

    // 4. Cache Miss: Add to Job Queue
    const jobId = await queueService.addJob(topic, userId, embedding, correlationId);
    
    logger.info(`Job Accepted`, { jobId, topic, userId, correlationId });

    res.status(202).json({ 
      jobId, 
      status: 'pending',
      message: 'Request accepted. Poll /api/jobs/:id for results.' 
    });

  } catch (error: any) {
    logger.error('Submission error', { error: error.message, correlationId });
    res.status(500).json({ 
      error: 'Failed to submit job',
      details: error.message 
    });
  }
});

// File Upload Generation Route
app.post('/api/generate/file', optionalAuth, generationLimiter as any, upload.single('file') as any, async (req: any, res: any) => {
  const correlationId = req.id;
  try {
    if (!process.env.API_KEY) throw new Error("API_KEY not configured.");
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });

    const userId = req.user?.id;
    const originalName = req.file.originalname;
    
    let extractedText = '';

    // Extract Text based on Mimetype
    if (req.file.mimetype === 'application/pdf') {
       try {
         const pdfData = await (pdf as any)(req.file.buffer);
         extractedText = pdfData.text;
       } catch (e) {
         logger.error("PDF Parse Failed", { correlationId });
         return res.status(400).json({ error: "Failed to parse PDF file." });
       }
    } else if (req.file.mimetype === 'text/plain') {
       extractedText = req.file.buffer.toString('utf-8');
    } else {
       return res.status(400).json({ error: "Unsupported file type. Use PDF or TXT." });
    }

    if (extractedText.trim().length < 50) {
      return res.status(400).json({ error: "File content is too short to generate a study set." });
    }

    // Clean up text slightly to save tokens/bandwidth
    extractedText = extractedText.replace(/\s+/g, ' ').trim();

    // Use filename as the initial "Topic" identifier for the job
    const topicLabel = `File: ${originalName}`;

    // Add to Queue with the content
    const jobId = await queueService.addJob(topicLabel, userId, undefined, correlationId, extractedText);
    
    logger.info(`File Job Accepted`, { jobId, filename: originalName, userId, correlationId });

    res.status(202).json({ 
      jobId, 
      status: 'pending', 
      message: 'File accepted. processing.' 
    });

  } catch (error: any) {
    logger.error('File submission error', { error: error.message, correlationId });
    res.status(500).json({ error: 'Failed to process file upload', details: error.message });
  }
});

app.get('/api/jobs/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const job = await queueService.getJobStatus(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error: any) {
    logger.error('Polling error', { error: error.message, correlationId: req.id });
    res.status(500).json({ error: 'Internal server error during polling' });
  }
});

app.get('/api/queue-status', async (req: any, res: any) => {
  try {
    const counts = await queueService.getQueueCounts();
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch queue status' });
  }
});

app.get('/api/history', requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user!.id;
    const sets = await studySetRepository.getUserHistory(userId, 10);
    res.json(sets);
  } catch (error) {
    logger.error("History fetch error", { error, correlationId: req.id });
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/sets/:id', optionalAuth, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.id;

    const set = await studySetRepository.getById(id);
    if (!set) return res.status(404).json({ error: "Study set not found" });

    if (userId) {
      await studySetRepository.recordActivity(userId, id);
    }

    res.json(set);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch study set' });
  }
});

initDB()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`Backend server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    logger.error("❌ Failed to start server", { error: err });
    (process as any).exit(1);
  });
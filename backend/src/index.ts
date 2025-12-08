import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import { addJob, getJobStatus, flashcardQueue } from './services/queue';
import { studySetRepository, initDB } from './db';
import { generateEmbedding } from './services/ai';
import authRoutes from './routes/auth';
import { requireAuth, optionalAuth } from './middleware/auth';

if (!process.env.API_KEY) {
  console.error("❌ FATAL: API_KEY is missing in backend/.env file.");
}

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn("⚠️ WARNING: GOOGLE_CLIENT_ID is missing in backend/.env file. Google Login will fail.");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json() as any);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Auth Routes ---
app.use('/api/auth', authRoutes);

// --- Job Queue Endpoints ---

// Apply optionalAuth: If user is logged in, req.user is set. If not, req.user is undefined.
app.post('/api/generate', optionalAuth, async (req: any, res: any) => {
  try {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY is not configured on the server.");
    }

    const { topic } = req.body;
    
    // Check if user is logged in (req.user comes from middleware)
    const userId = req.user?.id; 

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Topic is required and must be a string' });
    }

    // 1. Generate Embedding
    let embedding: number[];
    try {
      embedding = await generateEmbedding(topic);
    } catch (e) {
      console.error("Embedding generation failed, falling back to non-vector flow:", e);
      // Pass userId (number or undefined)
      const jobId = await addJob(topic, userId, undefined); 
      return res.status(202).json({ jobId, status: 'pending' });
    }

    // 2. SEMANTIC CACHE CHECK via Repository
    const existingSet: any = await studySetRepository.findBySemantics(embedding, 0.25);
    
    if (existingSet) {
       // IMPORTANT: Cache Hit!
       // ONLY record activity if user is logged in
       if (existingSet.id && userId) {
         await studySetRepository.recordActivity(userId, existingSet.id);
       }

       return res.status(200).json({
         status: 'completed',
         message: 'Retrieved from semantic cache',
         result: existingSet
       });
    }

    // 3. Cache Miss: Add to Queue
    // We pass userId (number or undefined) to the job
    const jobId = await addJob(topic, userId, embedding);
    
    console.log(`Job accepted: ${jobId} for topic: ${topic} (User: ${userId || 'Guest'})`);

    res.status(202).json({ 
      jobId, 
      status: 'pending',
      message: 'Request accepted. Poll /api/jobs/:id for results.' 
    });

  } catch (error: any) {
    console.error('Submission error:', error);
    res.status(500).json({ 
      error: 'Failed to submit job',
      details: error.message 
    });
  }
});

app.get('/api/jobs/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const job = await getJobStatus(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error: any) {
    console.error('Polling error:', error);
    res.status(500).json({ error: 'Internal server error during polling' });
  }
});

app.get('/api/queue-status', async (req: any, res: any) => {
  try {
    const counts = await flashcardQueue.getJobCounts('active', 'completed', 'failed', 'waiting');
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch queue status' });
  }
});

// --- Persistent Data Endpoints ---

// Require Auth: Only logged in users have history
app.get('/api/history', requireAuth, async (req: any, res: any) => {
  try {
    const userId = req.user!.id; // Guaranteed by requireAuth
    const sets = await studySetRepository.getUserHistory(userId, 10);
    res.json(sets);
  } catch (error) {
    console.error("History fetch error:", error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.get('/api/sets/:id', optionalAuth, async (req: any, res: any) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.id;

    const set = await studySetRepository.getById(id);
    if (!set) return res.status(404).json({ error: "Study set not found" });

    // Only update accessed_at if user is logged in
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
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  });
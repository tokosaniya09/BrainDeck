"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const queue_1 = require("./services/queue");
const db_1 = require("./db");
const ai_1 = require("./services/ai");
const auth_1 = __importDefault(require("./routes/auth"));
const auth_2 = require("./middleware/auth");
if (!process.env.API_KEY) {
    console.error("❌ FATAL: API_KEY is missing in backend/.env file.");
}
if (!process.env.GOOGLE_CLIENT_ID) {
    console.warn("⚠️ WARNING: GOOGLE_CLIENT_ID is missing in backend/.env file. Google Login will fail.");
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Configure CORS
const allowedOrigins = [
    process.env.CLIENT_URL, // e.g., https://your-app.vercel.app
    'http://localhost:5173', // Local development
    'http://localhost:3000'
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        // In production, you might want to be strict. For now, we allow all to ensure connection success.
        // To be strict, uncomment the check below and remove `return callback(null, true);`
        // if (allowedOrigins.indexOf(origin) === -1) {
        //   var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        //   return callback(new Error(msg), false);
        // }
        return callback(null, true);
    },
    credentials: true
}));
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// --- Auth Routes ---
app.use('/api/auth', auth_1.default);
// --- Job Queue Endpoints ---
// Apply optionalAuth: If user is logged in, req.user is set. If not, req.user is undefined.
app.post('/api/generate', auth_2.optionalAuth, async (req, res) => {
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
        let embedding;
        try {
            embedding = await (0, ai_1.generateEmbedding)(topic);
        }
        catch (e) {
            console.error("Embedding generation failed, falling back to non-vector flow:", e);
            // Pass userId (number or undefined)
            const jobId = await (0, queue_1.addJob)(topic, userId, undefined);
            return res.status(202).json({ jobId, status: 'pending' });
        }
        // 2. SEMANTIC CACHE CHECK via Repository
        const existingSet = await db_1.studySetRepository.findBySemantics(embedding, 0.25);
        if (existingSet) {
            // IMPORTANT: Cache Hit!
            // ONLY record activity if user is logged in
            if (existingSet.id && userId) {
                await db_1.studySetRepository.recordActivity(userId, existingSet.id);
            }
            return res.status(200).json({
                status: 'completed',
                message: 'Retrieved from semantic cache',
                result: existingSet
            });
        }
        // 3. Cache Miss: Add to Queue
        // We pass userId (number or undefined) to the job
        const jobId = await (0, queue_1.addJob)(topic, userId, embedding);
        console.log(`Job accepted: ${jobId} for topic: ${topic} (User: ${userId || 'Guest'})`);
        res.status(202).json({
            jobId,
            status: 'pending',
            message: 'Request accepted. Poll /api/jobs/:id for results.'
        });
    }
    catch (error) {
        console.error('Submission error:', error);
        res.status(500).json({
            error: 'Failed to submit job',
            details: error.message
        });
    }
});
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const job = await (0, queue_1.getJobStatus)(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json(job);
    }
    catch (error) {
        console.error('Polling error:', error);
        res.status(500).json({ error: 'Internal server error during polling' });
    }
});
app.get('/api/queue-status', async (req, res) => {
    try {
        const counts = await queue_1.flashcardQueue.getJobCounts('active', 'completed', 'failed', 'waiting');
        res.json(counts);
    }
    catch (error) {
        res.status(500).json({ error: 'Could not fetch queue status' });
    }
});
// --- Persistent Data Endpoints ---
// Require Auth: Only logged in users have history
app.get('/api/history', auth_2.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id; // Guaranteed by requireAuth
        const sets = await db_1.studySetRepository.getUserHistory(userId, 10);
        res.json(sets);
    }
    catch (error) {
        console.error("History fetch error:", error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});
app.get('/api/sets/:id', auth_2.optionalAuth, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.user?.id;
        const set = await db_1.studySetRepository.getById(id);
        if (!set)
            return res.status(404).json({ error: "Study set not found" });
        // Only update accessed_at if user is logged in
        if (userId) {
            await db_1.studySetRepository.recordActivity(userId, id);
        }
        res.json(set);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch study set' });
    }
});
(0, db_1.initDB)()
    .then(() => {
    app.listen(PORT, () => {
        console.log(`Backend server running on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
});

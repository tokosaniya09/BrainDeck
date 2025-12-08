"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const queue_1 = require("./services/queue");
const db_1 = require("./db");
const ai_1 = require("./services/ai");
// Validation: Check if API_KEY is set
if (!process.env.API_KEY) {
    console.error("❌ FATAL: API_KEY is missing in backend/.env file.");
    console.error("Please create a .env file in the backend folder with API_KEY=your_gemini_key");
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// --- Job Queue Endpoints ---
app.post('/api/generate', async (req, res) => {
    try {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY is not configured on the server.");
        }
        const { topic } = req.body;
        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Topic is required and must be a string' });
        }
        // 1. Generate Embedding for the query (Cost: negligible)
        // We do this BEFORE the queue so we can check the semantic cache
        let embedding;
        try {
            embedding = await (0, ai_1.generateEmbedding)(topic);
        }
        catch (e) {
            console.error("Embedding generation failed, falling back to non-vector flow:", e);
            // Fallback: If embedding fails, just push to queue without caching check (or use simple text match if we kept it)
            const jobId = await (0, queue_1.addJob)(topic, undefined);
            return res.status(202).json({ jobId, status: 'pending' });
        }
        // 2. SEMANTIC CACHE CHECK
        const existingSet = await (0, db_1.findSimilarStudySet)(embedding);
        if (existingSet) {
            return res.status(200).json({
                status: 'completed',
                message: 'Retrieved from semantic cache',
                result: existingSet
            });
        }
        // 3. Cache Miss: Add to Queue
        // We pass the embedding to the job so the worker doesn't need to regenerate it for the DB
        const jobId = await (0, queue_1.addJob)(topic, embedding);
        console.log(`Job accepted: ${jobId} for topic: ${topic}`);
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
app.get('/api/history', async (req, res) => {
    try {
        const sets = await (0, db_1.getRecentStudySets)(10);
        res.json(sets);
    }
    catch (error) {
        console.error("History fetch error:", error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});
app.get('/api/sets/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const set = await (0, db_1.getStudySetById)(id);
        if (!set)
            return res.status(404).json({ error: "Study set not found" });
        res.json(set);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch study set' });
    }
});
// Initialize DB and start server
// We await initDB so we don't start the server if the DB is broken
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

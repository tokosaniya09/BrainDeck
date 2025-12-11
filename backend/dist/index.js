"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const multer_1 = __importDefault(require("multer"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const db_1 = require("./db");
const auth_1 = __importDefault(require("./routes/auth"));
const auth_2 = require("./middleware/auth");
const rateLimiter_1 = require("./middleware/rateLimiter");
const logger_1 = require("./utils/logger");
// Services (DI Injection)
const ai_1 = require("./services/ai");
const queue_1 = require("./services/queue");
// Initialize Services
const aiService = new ai_1.GeminiAIService(process.env.API_KEY || '');
const queueService = new queue_1.FlashcardQueueService(aiService, db_1.studySetRepository);
if (!process.env.API_KEY) {
    logger_1.logger.error("❌ FATAL: API_KEY is missing in backend/.env file.");
}
if (!process.env.GOOGLE_CLIENT_ID) {
    logger_1.logger.warn("⚠️ WARNING: GOOGLE_CLIENT_ID is missing in backend/.env file. Google Login will fail.");
}
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Multer Setup (Memory Storage)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
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
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // 1. Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        // 2. Check if the incoming origin is in our allowed list
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true); // Allowed!
        }
        else {
            callback(new Error('Not allowed by CORS')); // Blocked!
        }
    },
    credentials: true
}));
// Middleware: Correlation ID
app.use((req, res, next) => {
    req.id = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    next();
});
// Apply General Rate Limiter
app.use(rateLimiter_1.generalLimiter);
// Limit payload size (for JSON)
app.use(express_1.default.json({ limit: '10kb' }));
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// --- Auth Routes ---
app.use('/api/auth', auth_1.default);
// --- Job Queue Endpoints ---
// Validation Schema
const GenerateSchema = zod_1.z.object({
    topic: zod_1.z.string()
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
app.post('/api/generate', auth_2.optionalAuth, rateLimiter_1.generationLimiter, async (req, res) => {
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
        const exactMatch = await db_1.studySetRepository.findByExactTopic(topic);
        if (exactMatch) {
            if (exactMatch.id && userId) {
                await db_1.studySetRepository.recordActivity(userId, exactMatch.id);
            }
            logger_1.logger.info('Serving from Exact Cache', { topic, correlationId });
            return res.status(200).json({
                status: 'completed',
                message: 'Retrieved from exact cache',
                result: exactMatch
            });
        }
        // 2. Generate Embedding
        let embedding;
        try {
            embedding = await aiService.generateEmbedding(topic);
        }
        catch (e) {
            logger_1.logger.error("Embedding generation failed", { error: e.message, correlationId });
            // Fallback: Add job without embedding
            const jobId = await queueService.addJob(topic, userId, undefined, correlationId);
            return res.status(202).json({ jobId, status: 'pending' });
        }
        // 3. LAYER 2 CACHE: Semantic Search
        const semanticMatch = await db_1.studySetRepository.findBySemantics(embedding, 0.25);
        if (semanticMatch) {
            if (semanticMatch.id && userId) {
                await db_1.studySetRepository.recordActivity(userId, semanticMatch.id);
            }
            logger_1.logger.info('Serving from Semantic Cache', { topic, correlationId });
            return res.status(200).json({
                status: 'completed',
                message: 'Retrieved from semantic cache',
                result: semanticMatch
            });
        }
        // 4. Cache Miss: Add to Job Queue
        const jobId = await queueService.addJob(topic, userId, embedding, correlationId);
        logger_1.logger.info(`Job Accepted`, { jobId, topic, userId, correlationId });
        res.status(202).json({
            jobId,
            status: 'pending',
            message: 'Request accepted. Poll /api/jobs/:id for results.'
        });
    }
    catch (error) {
        logger_1.logger.error('Submission error', { error: error.message, correlationId });
        res.status(500).json({
            error: 'Failed to submit job',
            details: error.message
        });
    }
});
// File Upload Generation Route
app.post('/api/generate/file', auth_2.optionalAuth, rateLimiter_1.generationLimiter, upload.single('file'), async (req, res) => {
    const correlationId = req.id;
    try {
        if (!process.env.API_KEY)
            throw new Error("API_KEY not configured.");
        if (!req.file)
            return res.status(400).json({ error: "No file uploaded." });
        const userId = req.user?.id;
        const originalName = req.file.originalname;
        const mimeType = req.file.mimetype;
        // Extract optional instructions from body (parsed by multer)
        const instructions = req.body.instructions || undefined;
        let extractedText = '';
        let imageData;
        // Logic Tree: Image vs Text/PDF
        if (mimeType.startsWith('image/')) {
            // Convert buffer to base64 for Gemini Multimodal
            const base64Data = req.file.buffer.toString('base64');
            imageData = {
                data: base64Data,
                mimeType: mimeType
            };
        }
        else if (mimeType === 'application/pdf') {
            try {
                const pdfData = await pdf_parse_1.default(req.file.buffer);
                extractedText = pdfData.text;
            }
            catch (e) {
                logger_1.logger.error("PDF Parse Failed", { correlationId });
                return res.status(400).json({ error: "Failed to parse PDF file." });
            }
        }
        else if (mimeType === 'text/plain') {
            extractedText = req.file.buffer.toString('utf-8');
        }
        else {
            return res.status(400).json({ error: "Unsupported file type. Use PDF, TXT, PNG, or JPG." });
        }
        logger_1.logger.info("File content:", extractedText.slice(0, 100), { correlationId });
        // Only check text length if it's NOT an image job
        if (!imageData && extractedText.trim().length < 50) {
            return res.status(400).json({ error: "File content is too short to generate a study set." });
        }
        if (extractedText) {
            extractedText = extractedText.replace(/\s+/g, ' ').trim();
        }
        // Use filename as the initial "Topic" identifier for the job
        const topicLabel = `File: ${originalName}`;
        // Add to Queue with either content (text) OR image data
        const jobId = await queueService.addJob(topicLabel, userId, undefined, correlationId, extractedText || undefined, instructions, imageData // Pass image object if exists
        );
        logger_1.logger.info(`File Job Accepted`, { jobId, filename: originalName, userId, correlationId, isImage: !!imageData });
        res.status(202).json({
            jobId,
            status: 'pending',
            message: 'File accepted. processing.'
        });
    }
    catch (error) {
        logger_1.logger.error('File submission error', { error: error.message, correlationId });
        res.status(500).json({ error: 'Failed to process file upload', details: error.message });
    }
});
app.get('/api/jobs/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const job = await queueService.getJobStatus(id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json(job);
    }
    catch (error) {
        logger_1.logger.error('Polling error', { error: error.message, correlationId: req.id });
        res.status(500).json({ error: 'Internal server error during polling' });
    }
});
app.get('/api/queue-status', async (req, res) => {
    try {
        const counts = await queueService.getQueueCounts();
        res.json(counts);
    }
    catch (error) {
        res.status(500).json({ error: 'Could not fetch queue status' });
    }
});
app.get('/api/history', auth_2.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const sets = await db_1.studySetRepository.getUserHistory(userId, 10);
        res.json(sets);
    }
    catch (error) {
        logger_1.logger.error("History fetch error", { error, correlationId: req.id });
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
        logger_1.logger.info(`Backend server running on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    logger_1.logger.error("❌ Failed to start server", { error: err });
    process.exit(1);
});

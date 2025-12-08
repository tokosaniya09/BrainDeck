"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ai_1 = require("./services/ai");
const db_1 = require("./db");
console.log("from index.ts", process.env.API_KEY);
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
// Fix: Cast express.json() to any to resolve type mismatch between express and body-parser types
app.use(express_1.default.json());
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});
// Generate Endpoint
app.post('/api/generate', async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Topic is required and must be a string' });
        }
        console.log(`Generating study set for topic: ${topic}`);
        // 1. Call LLM
        const studySet = await (0, ai_1.generateFlashcards)(topic);
        // 2. Save to DB (Fire and forget or await depending on requirement)
        // We await to ensure data integrity for this example
        try {
            await (0, db_1.saveStudySet)(studySet);
        }
        catch (dbError) {
            console.error("Database save failed, but returning result to user:", dbError);
        }
        // 3. Return response
        res.json(studySet);
    }
    catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({
            error: 'Failed to generate study set',
            details: error.message
        });
    }
});
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { generateFlashcards } from './services/ai';
import { saveStudySet } from './db';

console.log("from index.ts",process.env.API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Fix: Cast express.json() to any to resolve type mismatch between express and body-parser types
app.use(express.json() as any);

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
    const studySet = await generateFlashcards(topic);

    // 2. Save to DB (Fire and forget or await depending on requirement)
    // We await to ensure data integrity for this example
    try {
        await saveStudySet(studySet);
    } catch (dbError) {
        console.error("Database save failed, but returning result to user:", dbError);
    }

    // 3. Return response
    res.json(studySet);

  } catch (error: any) {
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
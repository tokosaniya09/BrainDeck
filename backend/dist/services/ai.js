"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFlashcards = exports.generateEmbedding = void 0;
const genai_1 = require("@google/genai");
const zod_1 = require("zod");
const prompts_1 = require("../config/prompts");
const circuitBreaker_1 = require("../utils/circuitBreaker");
// Fix: Use Gemini API initialized with process.env.API_KEY
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.API_KEY });
// --- Zod Schemas for Runtime Validation ---
const FlashcardSchema = zod_1.z.object({
    id: zod_1.z.string().default(() => Math.random().toString(36).substring(7)),
    front: zod_1.z.string(),
    back: zod_1.z.string(),
    difficulty: zod_1.z.enum(['easy', 'medium', 'hard']).default('medium'),
    tags: zod_1.z.array(zod_1.z.string()).default([])
});
const QuizQuestionSchema = zod_1.z.object({
    question: zod_1.z.string(),
    choices: zod_1.z.array(zod_1.z.string()),
    answer_index: zod_1.z.number()
});
const StudySetSchema = zod_1.z.object({
    topic: zod_1.z.string(),
    summary: zod_1.z.string(),
    estimated_study_time_minutes: zod_1.z.number(),
    flashcards: zod_1.z.array(FlashcardSchema),
    example_quiz_questions: zod_1.z.array(QuizQuestionSchema)
});
// --- Gemini Generation Schema ---
const geminiStudySetSchema = {
    type: genai_1.Type.OBJECT,
    properties: {
        topic: { type: genai_1.Type.STRING, description: "The topic of the study set" },
        summary: { type: genai_1.Type.STRING, description: "A brief summary of the topic (2-4 sentences)" },
        estimated_study_time_minutes: { type: genai_1.Type.INTEGER, description: "Estimated time in minutes to study this set" },
        flashcards: {
            type: genai_1.Type.ARRAY,
            description: "List of flashcards",
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    id: { type: genai_1.Type.STRING, description: "Unique identifier for the card" },
                    front: { type: genai_1.Type.STRING, description: "The question or concept on the front of the card" },
                    back: { type: genai_1.Type.STRING, description: "The answer or definition on the back of the card" },
                    difficulty: { type: genai_1.Type.STRING, enum: ["easy", "medium", "hard"] },
                    tags: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } }
                },
                required: ["id", "front", "back", "difficulty", "tags"]
            }
        },
        example_quiz_questions: {
            type: genai_1.Type.ARRAY,
            description: "Multiple choice quiz questions",
            items: {
                type: genai_1.Type.OBJECT,
                properties: {
                    question: { type: genai_1.Type.STRING },
                    choices: { type: genai_1.Type.ARRAY, items: { type: genai_1.Type.STRING } },
                    answer_index: { type: genai_1.Type.INTEGER, description: "Index of the correct answer in the choices array" }
                },
                required: ["question", "choices", "answer_index"]
            }
        }
    },
    required: ["topic", "summary", "estimated_study_time_minutes", "flashcards", "example_quiz_questions"]
};
// --- Helper Functions ---
const cleanJson = (text) => {
    // Removes markdown code blocks (```json ... ```) if present
    return text.replace(/```json\n?|```/g, '').trim();
};
const generateEmbedding = async (text) => {
    return circuitBreaker_1.aiCircuitBreaker.execute(async () => {
        const response = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: { parts: [{ text }] }
        });
        if (!response.embeddings?.[0]?.values) {
            throw new Error("Failed to generate embedding");
        }
        return response.embeddings[0].values;
    });
};
exports.generateEmbedding = generateEmbedding;
const generateFlashcards = async (topic) => {
    // Wrap the entire operation in a Circuit Breaker
    return circuitBreaker_1.aiCircuitBreaker.execute(async () => {
        let currentPrompt = prompts_1.PROMPTS.generateStudySet(topic);
        let attempts = 0;
        const MAX_RETRIES = 2;
        while (attempts <= MAX_RETRIES) {
            try {
                console.log(`🤖 AI Generation Attempt ${attempts + 1}/${MAX_RETRIES + 1} for "${topic}"`);
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: currentPrompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: geminiStudySetSchema,
                        temperature: 0.2 + (attempts * 0.1), // Slightly increase temp on retries
                    }
                });
                const text = response.text;
                if (!text) {
                    throw new Error("Empty response from Gemini");
                }
                // 1. Parse JSON (Basic Syntax Check)
                let rawData;
                try {
                    rawData = JSON.parse(cleanJson(text));
                }
                catch (e) {
                    throw new Error("Invalid JSON syntax received from model");
                }
                // 2. Validate Structure (Zod Schema Check)
                const validationResult = StudySetSchema.safeParse(rawData);
                if (!validationResult.success) {
                    // Use .issues instead of .errors to satisfy Zod typing
                    const errorMsg = validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                    throw new Error(`Schema Validation Failed: ${errorMsg}`);
                }
                // 3. Success! Return data
                return validationResult.data;
            }
            catch (error) {
                attempts++;
                console.warn(`⚠️ Attempt ${attempts} failed: ${error.message}`);
                if (attempts > MAX_RETRIES) {
                    throw error; // Let the queue worker handle the final failure
                }
                // Auto-healing: Feed the error back to the model
                currentPrompt = `${prompts_1.PROMPTS.generateStudySet(topic)}
        
        IMPORTANT: Your previous attempt failed. 
        Error details: ${error.message}
        
        Please correct the JSON output. Ensure strict adherence to the schema.`;
            }
        }
        throw new Error("Unexpected end of retry loop");
    });
};
exports.generateFlashcards = generateFlashcards;

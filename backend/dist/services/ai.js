"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiAIService = void 0;
const genai_1 = require("@google/genai");
const zod_1 = require("zod");
const prompts_1 = require("../config/prompts");
const circuitBreaker_1 = require("../utils/circuitBreaker");
const logger_1 = require("../utils/logger");
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
// --- Service Implementation ---
class GeminiAIService {
    constructor(apiKey) {
        this.ai = new genai_1.GoogleGenAI({ apiKey });
    }
    cleanJson(text) {
        return text.replace(/```json\n?|```/g, '').trim();
    }
    async generateEmbedding(text) {
        return circuitBreaker_1.aiCircuitBreaker.execute(async () => {
            const response = await this.ai.models.embedContent({
                model: "text-embedding-004",
                contents: { parts: [{ text }] }
            });
            if (!response.embeddings?.[0]?.values) {
                throw new Error("Failed to generate embedding");
            }
            return response.embeddings[0].values;
        });
    }
    // Shared helper to handle the common generation logic
    // 'contents' matches the parameter structure for generateContent (string | Part | Part[])
    async executeGeneration(contents, correlationId) {
        let attempts = 0;
        const MAX_RETRIES = 2;
        let currentContents = contents;
        while (attempts <= MAX_RETRIES) {
            try {
                logger_1.logger.info(`🤖 AI Generation Attempt ${attempts + 1}/${MAX_RETRIES + 1}`, { correlationId });
                const response = await this.ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: currentContents,
                    config: {
                        systemInstruction: "You are a concise, accurate educational assistant.",
                        responseMimeType: "application/json",
                        responseSchema: geminiStudySetSchema,
                        temperature: 0.2 + (attempts * 0.1),
                    }
                });
                const text = response.text;
                if (!text) {
                    throw new Error("Empty response from Gemini");
                }
                let rawData;
                try {
                    rawData = JSON.parse(this.cleanJson(text));
                }
                catch (e) {
                    throw new Error("Invalid JSON syntax received from model");
                }
                const validationResult = StudySetSchema.safeParse(rawData);
                if (!validationResult.success) {
                    const errorMsg = validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                    throw new Error(`Schema Validation Failed: ${errorMsg}`);
                }
                return validationResult.data;
            }
            catch (error) {
                attempts++;
                logger_1.logger.warn(`⚠️ Attempt ${attempts} failed`, { error: error.message, correlationId });
                if (attempts > MAX_RETRIES) {
                    throw error;
                }
                // For retry logic with simple text prompts, we can append context. 
                // For complex Part[] objects (images), modifying the retry prompt is harder, 
                // so we mostly rely on temperature adjustment in the loop.
                if (typeof currentContents === 'string') {
                    currentContents = `${currentContents}
              
              IMPORTANT: Your previous attempt failed. 
              Error details: ${error.message}
              
              Please correct the JSON output. Ensure strict adherence to the schema.`;
                }
            }
        }
        throw new Error("Unexpected end of retry loop");
    }
    async generateFlashcards(topic, correlationId) {
        return circuitBreaker_1.aiCircuitBreaker.execute(async () => {
            const prompt = prompts_1.PROMPTS.generateStudySet(topic);
            return this.executeGeneration(prompt, correlationId);
        });
    }
    async generateFlashcardsFromContent(content, instructions, correlationId, image) {
        return circuitBreaker_1.aiCircuitBreaker.execute(async () => {
            let promptParts = [];
            if (image) {
                // Multimodal Input: Text Instructions + Image Data
                const textPrompt = prompts_1.PROMPTS.generateStudySetFromImage(instructions);
                promptParts = [
                    { text: textPrompt },
                    {
                        inlineData: {
                            mimeType: image.mimeType,
                            data: image.data
                        }
                    }
                ];
                return this.executeGeneration(promptParts, correlationId);
            }
            else if (content) {
                // Text-only Input
                const textPrompt = prompts_1.PROMPTS.generateStudySetFromContent(content, instructions);
                return this.executeGeneration(textPrompt, correlationId);
            }
            else {
                throw new Error("No content provided for generation");
            }
        });
    }
}
exports.GeminiAIService = GeminiAIService;

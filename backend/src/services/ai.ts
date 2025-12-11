import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { PROMPTS } from "../config/prompts";
import { aiCircuitBreaker } from "../utils/circuitBreaker";
import { IAIService } from "../interfaces/IAIService";
import { StudySet } from "../types";
import { logger } from "../utils/logger";

// --- Zod Schemas for Runtime Validation ---

const FlashcardSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(7)),
  front: z.string(),
  back: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  tags: z.array(z.string()).default([])
});

const QuizQuestionSchema = z.object({
  question: z.string(),
  choices: z.array(z.string()),
  answer_index: z.number()
});

const StudySetSchema = z.object({
  topic: z.string(),
  summary: z.string(),
  estimated_study_time_minutes: z.number(),
  flashcards: z.array(FlashcardSchema),
  example_quiz_questions: z.array(QuizQuestionSchema)
});

// --- Gemini Generation Schema ---

const geminiStudySetSchema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING, description: "The topic of the study set" },
    summary: { type: Type.STRING, description: "A brief summary of the topic (2-4 sentences)" },
    estimated_study_time_minutes: { type: Type.INTEGER, description: "Estimated time in minutes to study this set" },
    flashcards: {
      type: Type.ARRAY,
      description: "List of flashcards",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique identifier for the card" },
          front: { type: Type.STRING, description: "The question or concept on the front of the card" },
          back: { type: Type.STRING, description: "The answer or definition on the back of the card" },
          difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["id", "front", "back", "difficulty", "tags"]
      }
    },
    example_quiz_questions: {
      type: Type.ARRAY,
      description: "Multiple choice quiz questions",
      items: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          choices: { type: Type.ARRAY, items: { type: Type.STRING } },
          answer_index: { type: Type.INTEGER, description: "Index of the correct answer in the choices array" }
        },
        required: ["question", "choices", "answer_index"]
      }
    }
  },
  required: ["topic", "summary", "estimated_study_time_minutes", "flashcards", "example_quiz_questions"]
};

// --- Service Implementation ---

export class GeminiAIService implements IAIService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private cleanJson(text: string): string {
    return text.replace(/```json\n?|```/g, '').trim();
  }

  async generateEmbedding(text: string): Promise<number[]> {
    return aiCircuitBreaker.execute(async () => {
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
  private async executeGeneration(prompt: string, correlationId?: string): Promise<StudySet> {
      let attempts = 0;
      const MAX_RETRIES = 2;
      let currentPrompt = prompt;

      while (attempts <= MAX_RETRIES) {
        try {
          logger.info(`🤖 AI Generation Attempt ${attempts + 1}/${MAX_RETRIES + 1}`, { correlationId });

          const response = await this.ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: currentPrompt,
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
          } catch (e) {
            throw new Error("Invalid JSON syntax received from model");
          }

          const validationResult = StudySetSchema.safeParse(rawData);

          if (!validationResult.success) {
            const errorMsg = validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
            throw new Error(`Schema Validation Failed: ${errorMsg}`);
          }

          return validationResult.data as StudySet;

        } catch (error: any) {
          attempts++;
          logger.warn(`⚠️ Attempt ${attempts} failed`, { error: error.message, correlationId });
          
          if (attempts > MAX_RETRIES) {
             throw error; 
          }

          currentPrompt = `${prompt}
          
          IMPORTANT: Your previous attempt failed. 
          Error details: ${error.message}
          
          Please correct the JSON output. Ensure strict adherence to the schema.`;
        }
      }

      throw new Error("Unexpected end of retry loop");
  }

  async generateFlashcards(topic: string, correlationId?: string): Promise<StudySet> {
    return aiCircuitBreaker.execute(async () => {
      const prompt = PROMPTS.generateStudySet(topic);
      return this.executeGeneration(prompt, correlationId);
    });
  }

  async generateFlashcardsFromContent(content: string, correlationId?: string): Promise<StudySet> {
    return aiCircuitBreaker.execute(async () => {
      const prompt = PROMPTS.generateStudySetFromContent(content);
      return this.executeGeneration(prompt, correlationId);
    });
  }
}
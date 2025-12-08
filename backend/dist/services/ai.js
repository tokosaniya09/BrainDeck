"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFlashcards = void 0;
const genai_1 = require("@google/genai");
// Fix: Use Gemini API initialized with process.env.API_KEY
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.API_KEY });
console.log("from ai.ts", process.env.API_KEY);
const studySetSchema = {
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
const generateFlashcards = async (topic) => {
    const prompt = `Generate a study set for the topic: "${topic}".

Format constraints:
- Flashcards: 4-12 items.
- Front: Question (1 sentence).
- Back: Answer (max 60 words).
- Summary: 2-4 sentences.
- Quiz: 3 multiple choice questions.
`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: studySetSchema,
                temperature: 0.2, // Low temperature for factual consistency
            }
        });
        const text = response.text;
        if (!text) {
            throw new Error("Empty response from Gemini");
        }
        const data = JSON.parse(text);
        return data;
    }
    catch (error) {
        console.error("Gemini Generation Error:", error);
        throw error;
    }
};
exports.generateFlashcards = generateFlashcards;

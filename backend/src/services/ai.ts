import { GoogleGenAI, Type } from "@google/genai";

// Fix: Use Gemini API initialized with process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

export interface QuizQuestion {
  question: string;
  choices: string[];
  answer_index: number;
}

export interface StudySet {
  topic: string;
  summary: string;
  estimated_study_time_minutes: number;
  flashcards: Flashcard[];
  example_quiz_questions: QuizQuestion[];
}

const studySetSchema = {
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

export const generateFlashcards = async (topic: string): Promise<StudySet> => {
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

    const data = JSON.parse(text) as StudySet;
    return data;

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};
import { StudySet } from "../types";

export interface IAIService {
    generateEmbedding(text: string): Promise<number[]>;
    generateFlashcards(topic: string, correlationId?: string): Promise<StudySet>;
    generateFlashcardsFromContent(content: string, correlationId?: string): Promise<StudySet>;
}
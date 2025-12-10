import { StudySet } from "../types";

export interface IAIService {
    generateEmbedding(text: string): Promise<number[]>;
    generateFlashcards(topic: string, correlationId?: string): Promise<StudySet>;
}
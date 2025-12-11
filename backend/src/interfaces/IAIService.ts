import { StudySet } from "../types";

export interface IAIService {
    generateEmbedding(text: string): Promise<number[]>;
    generateFlashcards(topic: string, correlationId?: string): Promise<StudySet>;
    generateFlashcardsFromContent(content?: string, instructions?: string, correlationId?: string, image?: { data: string, mimeType: string }): Promise<StudySet>;
}
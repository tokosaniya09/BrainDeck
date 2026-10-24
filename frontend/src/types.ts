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

export interface OCROutput {
  text: string;
  confidence: number;
  wordCount: number;
  lineCount: number;
  durationMs: number;
  applied?: boolean;
  fallbackToVision?: boolean;
}

export interface StudySet {
  id?: number;
  topic: string;
  summary: string;
  estimated_study_time_minutes: number;
  flashcards: Flashcard[];
  example_quiz_questions: QuizQuestion[];
  ocr?: OCROutput;
  cacheHit?: boolean;
}
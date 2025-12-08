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

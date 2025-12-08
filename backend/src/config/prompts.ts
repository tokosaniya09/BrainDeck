export const PROMPTS = {
  generateStudySet: (topic: string) => `Generate a study set for the topic: "${topic}".

Format constraints:
- Flashcards: 4-12 items.
- Front: Question (1 sentence).
- Back: Answer (max 60 words).
- Summary: 2-4 sentences.
- Quiz: 15 multiple choice questions.
- Output: Strict JSON only.

Ensure the "id" field for flashcards is a unique string.
`
};
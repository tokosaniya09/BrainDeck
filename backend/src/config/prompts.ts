export const PROMPTS = {
  generateStudySet: (topic: string) => `Generate a study set for the topic: "${topic}".

Format constraints:
- Flashcards: 4-12 items.
- Front: Question (1 sentence).
- Back: Answer (max 60 words).
- Summary: 2-4 sentences.
- Quiz: 3 multiple choice questions.
- Output: Strict JSON only.

Ensure the "id" field for flashcards is a unique string.
`,

  generateStudySetFromContent: (text: string) => `Analyze the following text content and generate a comprehensive study set. 

Content:
"""
${text.slice(0, 30000)} 
"""
(Note: Content truncated if too long)

Task:
1. Identify the main topic of the text.
2. Create a summary.
3. Generate flashcards based ONLY on the provided text.
4. Generate quiz questions based ONLY on the provided text.

Format constraints:
- Flashcards: 5-15 items (focus on key concepts found in the text).
- Front: Question/Concept.
- Back: Answer/Definition.
- Summary: 2-4 sentences.
- Quiz: 3-5 multiple choice questions.
- Output: Strict JSON only matching the schema.

Ensure the "id" field for flashcards is a unique string.
`
};
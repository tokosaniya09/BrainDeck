export const PROMPTS = {
  generateStudySet: (topic: string) => `You are an elite educational architect.
  
  INPUT: "${topic}"
  
  CRITICAL INSTRUCTION:
  Analyze the input. 
  - If it is a BROAD TOPIC (e.g., "Biology"), cover key pillars.
  - If it is a SPECIFIC QUESTION (e.g., "How does photosynthesis work?"), DO NOT just define terms. Instead, break the *answer* into logical steps.
  
  STRICT RULES:
  1. NO "Dictionary Cards": Do not create cards that just define a word from the title (e.g., Front: "Photosynthesis", Back: "Process by which plants...").
  2. Focus on MECHANISMS: Ask "How", "Why", "What if", and "Compare/Contrast".
  3. Contextualize: If the topic is "Java Streams", don't ask "What is Java?". Ask "When should you use parallelStream()?"
  
  GENERATION TASK:
  1. "learning_goal": First, write a sentence explaining what specific concept this set teaches.
  2. Flashcards (5-12):
     - Front: A probing question or scenario.
     - Back: The insight, step, or connection.
  3. Quiz: 8-10 application-based questions.
  4. Output: Strict JSON only.

  Ensure the "id" field for flashcards is a unique string.
  `,

  generateStudySetFromContent: (text: string, instructions?: string) => `You are an expert educational content creator. Your goal is to turn the provided text into a study set that strictly follows the user's intent.

Content:
"""
${text.slice(0, 30000)} 
"""
(Note: Content truncated if too long)

${instructions ? `CRITICAL USER INSTRUCTIONS: "${instructions}"\n` : ''}

Analysis Strategy:
1. ${instructions ? 'Read the content specifically looking for information related to the USER INSTRUCTIONS.' : 'Identify the core learning objectives of the text.'}
2. Ignore irrelevant details. Focus on what is necessary to master the material ${instructions ? 'according to the instructions' : ''}.

Generation Task:
1. "learning_goal": Write a sentence analyzing the content and instructions.
2. Create a Summary (2-4 sentences) capturing the main point.
3. Generate Flashcards (5-15 items):
   - If user asked for specific focus (e.g., "dates", "formulas"), ONLY generate cards about that.
   - If no instructions, focus on "Why" and "How" relationships, not just "What".
   - Front: Should be a question or prompt that requires thinking (e.g., "What is the impact of X on Y?" instead of just "Define X").
   - Back: clear, contextual explanation.
4. Generate Quiz (8-10 questions): Challenging multiple choice.

Format constraints:
- Output: Strict JSON only matching the schema.
- Ensure the "id" field for flashcards is a unique string.
`,

  generateStudySetFromImage: (instructions?: string) => `You are an expert educational assistant with advanced vision capabilities. 
  
Task:
1. Analyze the provided image(s). They may contain handwritten notes, textbook pages, or diagrams.
2. Transcribe and understand the key concepts visible in the image.
3. Generate a study set based on this visual content.

${instructions ? `CRITICAL USER INSTRUCTIONS: "${instructions}"\n` : ''}

Analysis Strategy:
- If handwriting is messy, use your best judgement to decipher it based on context.
- If diagrams are present, convert the visual relationship into a conceptual flashcard.
- ${instructions ? 'Prioritize content mentioned in the instructions.' : 'Identify the most important educational takeaways.'}

Generation Task:
1. "learning_goal": Briefly describe the visual content and educational goal.
2. Summary (2-4 sentences).
3. Flashcards (5-15 items):
   - Front: Question/Concept.
   - Back: Answer/Explanation.
4. Quiz (8-10 questions).

Format constraints:
- Output: Strict JSON only matching the schema.
- Ensure the "id" field for flashcards is a unique string.
`
};
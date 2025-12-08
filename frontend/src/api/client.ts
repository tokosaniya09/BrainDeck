import { StudySet } from "../types";

export const generateStudySet = async (topic: string): Promise<StudySet> => {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ topic }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to generate study set');
  }

  return response.json();
};

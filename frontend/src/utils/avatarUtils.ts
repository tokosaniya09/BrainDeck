/**
 * Selects one of 10 avatar images based on a string identifier (e.g., email or username).
 * This ensures the user gets a "random" avatar that persists across reloads.
 */
export const getAvatarUrl = (identifier: string): string => {
  if (!identifier) return '/avatars/1.svg';
  
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Modulo 10 to pick a number between 0-9, then add 1 to get 1-10
  const index = (Math.abs(hash) % 10) + 1;
  return `/avatars/${index}.svg`;
};
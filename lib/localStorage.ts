import { SavedLesson } from '@/types/lesson';

const STORAGE_KEY = 'steam_saved_lessons';

export function getSavedLessons(): SavedLesson[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('[v0] Error reading from localStorage:', error);
    return [];
  }
}

export function saveLessonToStorage(lesson: SavedLesson): void {
  if (typeof window === 'undefined') return;
  
  try {
    const lessons = getSavedLessons();
    const existingIndex = lessons.findIndex((l) => l.id === lesson.id);
    
    if (existingIndex >= 0) {
      lessons[existingIndex] = lesson;
    } else {
      lessons.push(lesson);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
  } catch (error) {
    console.error('[v0] Error saving to localStorage:', error);
  }
}

export function deleteLessonFromStorage(id: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const lessons = getSavedLessons();
    const filtered = lessons.filter((l) => l.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('[v0] Error deleting from localStorage:', error);
  }
}

export function getLessonById(id: string): SavedLesson | null {
  const lessons = getSavedLessons();
  return lessons.find((l) => l.id === id) || null;
}

import { Lang } from './lesson';

export type Theme = 'light' | 'dark' | 'system';
export type PdfTemplate = 'standard' | 'detailed' | 'minimal';
export type WordTemplate = 'standard' | 'detailed';

export interface UserSettings {
  // AI Settings
  aiOutputLanguage: Lang;
  
  
  // Export Preferences
  exportPdfTemplate: PdfTemplate;
  exportWordTemplate: WordTemplate;
  includeImages: boolean;
  
  // Display Preferences
  theme: Theme;
}

export const DEFAULT_SETTINGS: UserSettings = {
  aiOutputLanguage: 'en',
  exportPdfTemplate: 'standard',
  exportWordTemplate: 'standard',
  includeImages: true,
  theme: 'system',
};

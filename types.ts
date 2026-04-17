
export interface Attachment {
  name: string;
  type: string;
  content: string; // Base64 or Text
}

export interface Suggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  explanation: string;
  index: number;
  isGrammar?: boolean; // True if it's a technical correction
}

export enum WritingMode {
  GENERAL = 'general',
  ACADEMIC = 'academic',
  POEM = 'poem',
  LYRICS = 'lyrics'
}

// Added missing Theme type required by Editor components
export type Theme = 'light' | 'dark';

export interface EditorState {
  content: string;
  attachments: Attachment[];
  suggestions: Suggestion[];
  isGenerating: boolean;
  mode: WritingMode;
}

export enum WritingAction {
  IMPROVE = 'improve',
  SHORTEN = 'shorten',
  EXPAND = 'expand',
  TONE_PROFESSIONAL = 'tone_professional',
  TONE_CREATIVE = 'tone_creative',
}

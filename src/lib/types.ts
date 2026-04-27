// Shared types for the manuscript and analysis payload stored encrypted in IndexedDB.

export interface Paragraph {
  id: string;
  text: string;
  chapterId: string;
}

export interface Chapter {
  id: string;
  index: number;
  title: string;
  paragraphs: Paragraph[];
  text: string;
  wordCount: number;
}

export interface Manuscript {
  title: string;
  importedAt: number;
  chapters: Chapter[];
}

export interface AnalysisResults {
  // Chapter-level
  embeddings: number[][];                // chapter embedding vectors (mean-pooled paragraph embeddings)
  similarityMatrix: number[][];          // cosine similarity between chapters
  escalation: { chapterId: string; sentiment: number; intensity: number }[]; // -1..1 sentiment, 0..1 intensity
  abstraction: { chapterId: string; ratio: number; concrete: number; abstract: number }[];
  // Cross-chapter
  repetitions: RepetitionEntry[];
  // Paragraph-level
  suggestions: SuggestionEntry[];
  // Meta
  computedAt: number;
  modelInfo: { embedModel: string; sentimentModel: string };
}

export interface RepetitionEntry {
  phrase: string;
  count: number;
  chapters: { chapterId: string; count: number }[];
}

export interface SuggestionEntry {
  paragraphId: string;
  chapterId: string;
  reason: 'redundant' | 'low-tension' | 'abstract-heavy' | 'echo';
  reasonLabel: string;
  detail: string;
  score: number; // higher = stronger suggestion
  alternatives: string[];
}

export interface ProjectPayload {
  manuscript: Manuscript;
  chapters: Chapter[]; // duplicated for fast meta — same as manuscript.chapters
  analysis?: AnalysisResults;
}

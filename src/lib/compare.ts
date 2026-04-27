// Build a comparison view between two project payloads (e.g. v1 vs v2 of a manuscript).
// Aligns chapters by best embedding-similarity match (Hungarian-ish greedy) and produces
// per-chapter deltas plus aggregate metrics.

import type { ProjectPayload, RepetitionEntry } from './types';
import { cosine } from './nlp';

export interface ChapterAlignment {
  leftIndex: number | null;   // index in left manuscript, null if right-only
  rightIndex: number | null;  // index in right manuscript, null if left-only
  similarity: number | null;  // null when one side is missing
  // Convenience for display
  leftTitle?: string;
  rightTitle?: string;
  leftWordCount?: number;
  rightWordCount?: number;
  // Deltas
  wordDelta?: number;          // right - left
  sentimentDelta?: number;
  abstractionDelta?: number;   // right - left, in [-1, 1]
}

export interface ManuscriptDiff {
  totalsLeft: { chapters: number; words: number; suggestions: number; repetitions: number };
  totalsRight: { chapters: number; words: number; suggestions: number; repetitions: number };
  meanSentimentLeft: number;
  meanSentimentRight: number;
  meanAbstractionLeft: number;
  meanAbstractionRight: number;
  globalSimilarity: number; // mean diagonal of cross matrix after alignment
  alignments: ChapterAlignment[];
  sharedRepetitions: { phrase: string; left: number; right: number; delta: number }[];
  newRepetitions: { phrase: string; count: number }[];   // only in right
  removedRepetitions: { phrase: string; count: number }[]; // only in left
}

function meanPoolNum(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Greedy chapter alignment by cosine similarity of chapter embeddings.
 *  Each left chapter is matched to its best-similarity right chapter that hasn't been claimed
 *  yet (above a minimum threshold). Unmatched chapters appear as left-only or right-only rows. */
function alignChapters(
  leftEmb: number[][],
  rightEmb: number[][],
  threshold: number
): ChapterAlignment[] {
  const L = leftEmb.length, R = rightEmb.length;
  const sim: number[][] = Array.from({ length: L }, (_, i) =>
    Array.from({ length: R }, (_, j) => cosine(leftEmb[i], rightEmb[j]))
  );

  // Build all candidate pairs above threshold, sorted by similarity descending
  const pairs: { l: number; r: number; v: number }[] = [];
  for (let i = 0; i < L; i++) {
    for (let j = 0; j < R; j++) {
      if (sim[i][j] >= threshold) pairs.push({ l: i, r: j, v: sim[i][j] });
    }
  }
  pairs.sort((a, b) => b.v - a.v);

  const usedL = new Set<number>();
  const usedR = new Set<number>();
  const matches: { l: number; r: number; v: number }[] = [];
  for (const p of pairs) {
    if (usedL.has(p.l) || usedR.has(p.r)) continue;
    usedL.add(p.l); usedR.add(p.r);
    matches.push(p);
  }

  // Sort matches by left index for stable display order
  matches.sort((a, b) => a.l - b.l);

  const alignments: ChapterAlignment[] = matches.map((m) => ({
    leftIndex: m.l, rightIndex: m.r, similarity: m.v,
  }));

  // Append unmatched left chapters (in order)
  for (let i = 0; i < L; i++) {
    if (!usedL.has(i)) alignments.push({ leftIndex: i, rightIndex: null, similarity: null });
  }
  // Append unmatched right chapters
  for (let j = 0; j < R; j++) {
    if (!usedR.has(j)) alignments.push({ leftIndex: null, rightIndex: j, similarity: null });
  }

  return alignments;
}

export function computeDiff(left: ProjectPayload, right: ProjectPayload): ManuscriptDiff {
  const la = left.analysis!;
  const ra = right.analysis!;

  const alignments = alignChapters(la.embeddings, ra.embeddings, 0.4);

  // Decorate each alignment row with titles, word counts, deltas
  for (const a of alignments) {
    if (a.leftIndex !== null) {
      const ch = left.manuscript.chapters[a.leftIndex];
      a.leftTitle = ch.title || `Chapter ${a.leftIndex + 1}`;
      a.leftWordCount = ch.wordCount;
    }
    if (a.rightIndex !== null) {
      const ch = right.manuscript.chapters[a.rightIndex];
      a.rightTitle = ch.title || `Chapter ${a.rightIndex + 1}`;
      a.rightWordCount = ch.wordCount;
    }
    if (a.leftWordCount !== undefined && a.rightWordCount !== undefined) {
      a.wordDelta = a.rightWordCount - a.leftWordCount;
    }
    if (a.leftIndex !== null && a.rightIndex !== null) {
      const lEsc = la.escalation[a.leftIndex];
      const rEsc = ra.escalation[a.rightIndex];
      if (lEsc && rEsc) a.sentimentDelta = rEsc.sentiment - lEsc.sentiment;
      const lAbs = la.abstraction[a.leftIndex];
      const rAbs = ra.abstraction[a.rightIndex];
      if (lAbs && rAbs) a.abstractionDelta = rAbs.ratio - lAbs.ratio;
    }
  }

  // Aggregate similarity (mean of matched pairs only)
  const matchedSims = alignments.map((a) => a.similarity).filter((x): x is number => x !== null);
  const globalSimilarity = matchedSims.length > 0
    ? matchedSims.reduce((a, b) => a + b, 0) / matchedSims.length
    : 0;

  // Repetition diff
  const lMap = new Map<string, RepetitionEntry>();
  la.repetitions.forEach((r) => lMap.set(r.phrase, r));
  const rMap = new Map<string, RepetitionEntry>();
  ra.repetitions.forEach((r) => rMap.set(r.phrase, r));

  const shared: { phrase: string; left: number; right: number; delta: number }[] = [];
  const removed: { phrase: string; count: number }[] = [];
  const added: { phrase: string; count: number }[] = [];

  for (const [phrase, lr] of lMap) {
    const rr = rMap.get(phrase);
    if (rr) shared.push({ phrase, left: lr.count, right: rr.count, delta: rr.count - lr.count });
    else removed.push({ phrase, count: lr.count });
  }
  for (const [phrase, rr] of rMap) {
    if (!lMap.has(phrase)) added.push({ phrase, count: rr.count });
  }
  shared.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  removed.sort((a, b) => b.count - a.count);
  added.sort((a, b) => b.count - a.count);

  const totalsLeft = {
    chapters: left.manuscript.chapters.length,
    words: left.manuscript.chapters.reduce((s, c) => s + c.wordCount, 0),
    suggestions: la.suggestions.length,
    repetitions: la.repetitions.length,
  };
  const totalsRight = {
    chapters: right.manuscript.chapters.length,
    words: right.manuscript.chapters.reduce((s, c) => s + c.wordCount, 0),
    suggestions: ra.suggestions.length,
    repetitions: ra.repetitions.length,
  };

  return {
    totalsLeft,
    totalsRight,
    meanSentimentLeft: meanPoolNum(la.escalation.map((e) => e.sentiment)),
    meanSentimentRight: meanPoolNum(ra.escalation.map((e) => e.sentiment)),
    meanAbstractionLeft: meanPoolNum(la.abstraction.map((a) => a.ratio)),
    meanAbstractionRight: meanPoolNum(ra.abstraction.map((a) => a.ratio)),
    globalSimilarity,
    alignments,
    sharedRepetitions: shared,
    newRepetitions: added,
    removedRepetitions: removed,
  };
}

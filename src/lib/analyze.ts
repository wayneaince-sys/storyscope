// Manuscript analysis pipeline.
// Combines embeddings, sentiment, repetition n-grams, and abstraction ratios
// into the AnalysisResults stored on each project.

import type {
  AnalysisResults,
  Manuscript,
  RepetitionEntry,
  SuggestionEntry,
} from './types';
import {
  cosine,
  embedMany,
  meanPool,
  sentimentScore,
  MODEL_INFO,
  type ProgressFn,
} from './nlp';
import { ABSTRACT_WORDS, CONCRETE_WORDS, STOPWORDS } from './lexicon';

const MIN_NGRAM_LEN = 3;
const MAX_NGRAM_LEN = 5;
const MIN_REP_COUNT = 3;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/\b[\w'-]+\b/g) || []);
}

function contentTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !STOPWORDS.has(t) && t.length > 2);
}

function countAbstraction(text: string) {
  const tokens = tokenize(text);
  let abstract = 0;
  let concrete = 0;
  for (const t of tokens) {
    if (ABSTRACT_WORDS.has(t)) abstract++;
    if (CONCRETE_WORDS.has(t)) concrete++;
  }
  const total = abstract + concrete;
  const ratio = total === 0 ? 0.5 : abstract / total; // 0 = all concrete, 1 = all abstract
  return { ratio, abstract, concrete };
}

function findRepetitions(manuscript: Manuscript): RepetitionEntry[] {
  const phraseCounts = new Map<string, Map<string, number>>(); // phrase -> chapterId -> count
  const totalCounts = new Map<string, number>();

  for (const ch of manuscript.chapters) {
    const tokens = tokenize(ch.text);
    for (let n = MIN_NGRAM_LEN; n <= MAX_NGRAM_LEN; n++) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const slice = tokens.slice(i, i + n);
        // Skip n-grams that are mostly stopwords (filler phrases)
        const content = slice.filter((t) => !STOPWORDS.has(t));
        if (content.length < Math.ceil(n / 2)) continue;
        // Skip if first/last is a stopword (cleaner phrases)
        if (STOPWORDS.has(slice[0]) || STOPWORDS.has(slice[slice.length - 1])) continue;
        const phrase = slice.join(' ');
        if (!phraseCounts.has(phrase)) phraseCounts.set(phrase, new Map());
        const m = phraseCounts.get(phrase)!;
        m.set(ch.id, (m.get(ch.id) || 0) + 1);
        totalCounts.set(phrase, (totalCounts.get(phrase) || 0) + 1);
      }
    }
  }

  const entries: RepetitionEntry[] = [];
  for (const [phrase, total] of totalCounts.entries()) {
    if (total < MIN_REP_COUNT) continue;
    const m = phraseCounts.get(phrase)!;
    entries.push({
      phrase,
      count: total,
      chapters: Array.from(m.entries()).map(([chapterId, count]) => ({ chapterId, count })),
    });
  }

  // Drop n-grams strictly contained in a higher-count longer n-gram (keeps the longest match)
  entries.sort((a, b) => b.phrase.split(' ').length - a.phrase.split(' ').length);
  const kept: RepetitionEntry[] = [];
  for (const e of entries) {
    const subsumed = kept.some(
      (k) => k.phrase.includes(e.phrase) && k.count >= e.count - 1
    );
    if (!subsumed) kept.push(e);
  }

  kept.sort((a, b) => b.count - a.count);
  return kept.slice(0, 60);
}

function buildSuggestions(
  manuscript: Manuscript,
  paragraphEmbeddings: Map<string, number[]>,
  paragraphSentiment: Map<string, number>
): SuggestionEntry[] {
  const out: SuggestionEntry[] = [];

  for (const ch of manuscript.chapters) {
    // 1) Echoes — pairs of paragraphs in the same chapter with very high cosine similarity
    const ids = ch.paragraphs.map((p) => p.id);
    const embs = ids.map((id) => paragraphEmbeddings.get(id)).filter(Boolean) as number[][];
    for (let i = 0; i < embs.length; i++) {
      for (let j = i + 2; j < embs.length; j++) {
        const sim = cosine(embs[i], embs[j]);
        if (sim > 0.86) {
          const p = ch.paragraphs[i];
          out.push({
            paragraphId: p.id,
            chapterId: ch.id,
            reason: 'echo',
            reasonLabel: 'Echo with later paragraph',
            detail: `Reads very close to a later paragraph in this chapter (similarity ${sim.toFixed(2)}). Consider trimming or differentiating.`,
            score: sim,
            alternatives: alternativesFor(p.text, 'echo'),
          });
          break;
        }
      }
    }

    // 2) Abstract-heavy paragraphs (high ratio of abstract vs concrete tokens)
    for (const p of ch.paragraphs) {
      const { ratio, abstract, concrete } = countAbstraction(p.text);
      if (abstract + concrete >= 5 && ratio > 0.78) {
        out.push({
          paragraphId: p.id,
          chapterId: ch.id,
          reason: 'abstract-heavy',
          reasonLabel: 'Abstraction-heavy',
          detail: `${abstract} abstract vs ${concrete} concrete signals. Reader may be told rather than shown.`,
          score: ratio,
          alternatives: alternativesFor(p.text, 'abstract-heavy'),
        });
      }
    }

    // 3) Low-tension paragraphs (flat sentiment + high abstraction in tension scenes)
    for (const p of ch.paragraphs) {
      const s = paragraphSentiment.get(p.id);
      if (s === undefined) continue;
      const wordCount = (p.text.match(/\b\w+\b/g) || []).length;
      if (wordCount < 30) continue;
      if (Math.abs(s) < 0.15) {
        out.push({
          paragraphId: p.id,
          chapterId: ch.id,
          reason: 'low-tension',
          reasonLabel: 'Low emotional charge',
          detail: `Sentiment intensity is near zero (${s.toFixed(2)}). Could benefit from a sharper emotional beat.`,
          score: 0.6 - Math.abs(s),
          alternatives: alternativesFor(p.text, 'low-tension'),
        });
      }
    }
  }

  // Limit and sort
  out.sort((a, b) => b.score - a.score);
  // Cap per chapter to keep the list digestible
  const perChapterCap = 4;
  const counts: Record<string, number> = {};
  return out.filter((s) => {
    counts[s.chapterId] = (counts[s.chapterId] || 0) + 1;
    return counts[s.chapterId] <= perChapterCap;
  }).slice(0, 50);
}

function firstSentence(text: string): string {
  const m = text.match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : text).trim();
}

function alternativesFor(text: string, reason: SuggestionEntry['reason']): string[] {
  // Heuristic alternative-rewrite suggestions. Deterministic and useful as a starting point —
  // they prompt the writer rather than auto-generate finished prose.
  const opener = firstSentence(text).slice(0, 140);
  switch (reason) {
    case 'echo':
      return [
        `Cut this paragraph and let the later passage carry the beat alone.`,
        `Reframe in a different sense: replace the repeated image with sound, smell, or touch.`,
        `Tighten to a single line: "${opener}" → keep one image, drop the rest.`,
      ];
    case 'abstract-heavy':
      return [
        `Replace one feeling word with a physical action: clenched jaw, held breath, stilled hand.`,
        `Anchor the moment in a concrete object the POV character can see, hold, or hear.`,
        `Rewrite in past-tense action: "She felt fear" → "Her hand froze on the door."`,
      ];
    case 'low-tension':
      return [
        `Add stakes: name what the POV character stands to lose in the next sentence.`,
        `Insert an interruption — a sound, an arrival, an unexpected line of dialogue.`,
        `End the paragraph mid-thought, on a sharper image, to push the reader forward.`,
      ];
    case 'redundant':
      return [
        `Merge with the prior paragraph and cut the duplicated imagery.`,
        `Save the strongest sentence; delete the rest.`,
      ];
  }
}

export async function runAnalysis(manuscript: Manuscript, progress?: ProgressFn): Promise<AnalysisResults> {
  // 1) Embed every paragraph (sequentially, with progress)
  const allParas = manuscript.chapters.flatMap((c) => c.paragraphs);
  const texts = allParas.map((p) => p.text);
  progress?.({ stage: 'Embedding paragraphs', progress: 0, detail: `${texts.length} paragraphs` });
  const paraEmbeds = await embedMany(texts, (info) => {
    progress?.({ ...info, stage: 'Embedding paragraphs' });
  });

  const paragraphEmbeddings = new Map<string, number[]>();
  allParas.forEach((p, i) => paragraphEmbeddings.set(p.id, paraEmbeds[i]));

  // 2) Chapter embeddings (mean-pooled paragraph embeddings)
  progress?.({ stage: 'Pooling chapter vectors', progress: 0 });
  const chapterEmbeddings: number[][] = manuscript.chapters.map((ch) => {
    const ev = ch.paragraphs.map((p) => paragraphEmbeddings.get(p.id)!).filter(Boolean);
    return meanPool(ev);
  });

  // 3) Similarity matrix
  const n = manuscript.chapters.length;
  const sim: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sim[i][j] = i === j ? 1 : cosine(chapterEmbeddings[i], chapterEmbeddings[j]);
    }
  }

  // 4) Escalation: paragraph-level sentiment, aggregated per chapter
  const paragraphSentiment = new Map<string, number>();
  const escalation: AnalysisResults['escalation'] = [];
  for (let ci = 0; ci < manuscript.chapters.length; ci++) {
    const ch = manuscript.chapters[ci];
    let sum = 0, intensitySum = 0, count = 0;
    for (const p of ch.paragraphs) {
      // Skip very short paragraphs to avoid noise
      if (p.text.length < 25) {
        paragraphSentiment.set(p.id, 0);
        continue;
      }
      const { signed, score } = await sentimentScore(p.text);
      paragraphSentiment.set(p.id, signed);
      sum += signed;
      intensitySum += score;
      count++;
    }
    const avg = count > 0 ? sum / count : 0;
    const intensity = count > 0 ? intensitySum / count : 0;
    escalation.push({ chapterId: ch.id, sentiment: avg, intensity });
    progress?.({
      stage: 'Sentiment / escalation',
      progress: (ci + 1) / manuscript.chapters.length,
      detail: ch.title,
    });
  }

  // 5) Abstraction ratios
  const abstraction = manuscript.chapters.map((ch) => {
    const a = countAbstraction(ch.text);
    return { chapterId: ch.id, ratio: a.ratio, abstract: a.abstract, concrete: a.concrete };
  });

  // 6) Repetitions
  progress?.({ stage: 'Repetition map', progress: 0.5 });
  const repetitions = findRepetitions(manuscript);

  // 7) Suggestions
  progress?.({ stage: 'Building suggestions', progress: 0.8 });
  const suggestions = buildSuggestions(manuscript, paragraphEmbeddings, paragraphSentiment);

  progress?.({ stage: 'Done', progress: 1 });

  return {
    embeddings: chapterEmbeddings,
    similarityMatrix: sim,
    escalation,
    abstraction,
    repetitions,
    suggestions,
    computedAt: Date.now(),
    modelInfo: { ...MODEL_INFO },
  };
}

// Re-export for components that need a stopword check / token util
export { tokenize, contentTokens };

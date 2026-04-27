// NLP pipelines using Transformers.js (in-browser via WASM/WebGPU).
// Models are downloaded from the HuggingFace CDN on first use and cached by the browser.
// All inference runs locally — no manuscript text is ever sent to a server.

import { pipeline, env, type FeatureExtractionPipeline, type TextClassificationPipeline } from '@huggingface/transformers';

// Allow remote model downloads from HF Hub.
env.allowLocalModels = false;
env.allowRemoteModels = true;

export const MODEL_INFO = {
  embedModel: 'Xenova/all-MiniLM-L6-v2',
  sentimentModel: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
};

export type ProgressFn = (info: { stage: string; progress: number; detail?: string }) => void;

let _embedder: FeatureExtractionPipeline | null = null;
let _sentiment: TextClassificationPipeline | null = null;

export async function getEmbedder(progress?: ProgressFn): Promise<FeatureExtractionPipeline> {
  if (_embedder) return _embedder;
  _embedder = await pipeline('feature-extraction', MODEL_INFO.embedModel, {
    progress_callback: (e: any) => {
      if (progress) {
        progress({
          stage: 'Loading embedding model',
          progress: typeof e.progress === 'number' ? e.progress / 100 : 0,
          detail: e.file ? `${e.file} ${Math.round(e.progress || 0)}%` : undefined,
        });
      }
    },
  }) as FeatureExtractionPipeline;
  return _embedder;
}

export async function getSentiment(progress?: ProgressFn): Promise<TextClassificationPipeline> {
  if (_sentiment) return _sentiment;
  _sentiment = await pipeline('sentiment-analysis', MODEL_INFO.sentimentModel, {
    progress_callback: (e: any) => {
      if (progress) {
        progress({
          stage: 'Loading sentiment model',
          progress: typeof e.progress === 'number' ? e.progress / 100 : 0,
          detail: e.file ? `${e.file} ${Math.round(e.progress || 0)}%` : undefined,
        });
      }
    },
  }) as TextClassificationPipeline;
  return _sentiment;
}

/** Mean-pooled normalized embedding for a piece of text. */
export async function embed(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const out = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data as Float32Array);
}

/** Embed many strings sequentially with progress. */
export async function embedMany(texts: string[], progress?: ProgressFn): Promise<number[][]> {
  const embedder = await getEmbedder();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    const result = await embedder(t || ' ', { pooling: 'mean', normalize: true });
    out.push(Array.from(result.data as Float32Array));
    if (progress) {
      progress({
        stage: 'Computing embeddings',
        progress: (i + 1) / texts.length,
        detail: `${i + 1} / ${texts.length}`,
      });
    }
  }
  return out;
}

export async function sentimentScore(text: string): Promise<{ label: string; score: number; signed: number }> {
  const cls = await getSentiment();
  // distilbert SST-2 returns POSITIVE / NEGATIVE
  const truncated = text.slice(0, 2000); // keep within model context
  const out = await cls(truncated);
  const r = Array.isArray(out) ? out[0] : out;
  const label = (r as any).label as string;
  const score = (r as any).score as number;
  // Map to a signed -1..+1 value
  const signed = label === 'POSITIVE' ? score : -score;
  return { label, score, signed };
}

/** Cosine similarity between two normalized vectors. */
export function cosine(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/** Mean-pool a set of normalized vectors and re-normalize. */
export function meanPool(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const acc = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) acc[i] += v[i];
  for (let i = 0; i < dim; i++) acc[i] /= vectors.length;
  // Normalize
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += acc[i] * acc[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) acc[i] /= norm;
  return acc;
}

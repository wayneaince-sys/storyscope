import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, Area, AreaChart,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
} from 'recharts';
import {
  BookOpenText, Activity, Repeat, Layers, Lightbulb, Network, Download, Lock, ChevronRight, FileText,
} from 'lucide-react';
import type { ProjectPayload, AnalysisResults, Manuscript, Chapter } from '../lib/types';
import Heatmap from './Heatmap';
import { exportSuggestionsPDF } from '../lib/pdf';

interface Props {
  payload: ProjectPayload;
  analysis: AnalysisResults;
  projectName: string;
  onExport?: () => void;
  onLock?: () => void;
}

type Tab = 'overview' | 'embeddings' | 'escalation' | 'repetition' | 'abstraction' | 'suggestions';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'overview', label: 'Overview', icon: BookOpenText },
  { id: 'embeddings', label: 'Embeddings', icon: Network },
  { id: 'escalation', label: 'Escalation', icon: Activity },
  { id: 'repetition', label: 'Repetition', icon: Repeat },
  { id: 'abstraction', label: 'Abstraction', icon: Layers },
  { id: 'suggestions', label: 'Suggestions', icon: Lightbulb },
];

function chapterLabel(ch: Chapter): string {
  return ch.title || `Chapter ${ch.index + 1}`;
}

export default function Dashboard({ payload, analysis, projectName, onExport, onLock }: Props) {
  const { manuscript } = payload;
  const [tab, setTab] = useState<Tab>('overview');

  const chapterMap = useMemo(() => {
    const m = new Map<string, Chapter>();
    manuscript.chapters.forEach((c) => m.set(c.id, c));
    return m;
  }, [manuscript]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink-100 bg-white/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-ink-400">Manuscript</div>
            <div className="serif text-lg text-ink-900">{manuscript.title}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500 mono mr-2 hidden md:inline">
              {manuscript.chapters.length} chapters · {manuscript.chapters.reduce((s, c) => s + c.wordCount, 0).toLocaleString()} words
            </span>
            {onExport && (
              <button onClick={onExport} className="text-xs flex items-center gap-1 text-ink-600 hover:text-accent border border-ink-200 rounded-lg px-3 py-1.5">
                <Download size={12} /> Export JSON
              </button>
            )}
            {onLock && (
              <button onClick={onLock} className="text-xs flex items-center gap-1 text-ink-600 hover:text-accent border border-ink-200 rounded-lg px-3 py-1.5">
                <Lock size={12} /> Lock
              </button>
            )}
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
                  active
                    ? 'border-accent text-ink-900'
                    : 'border-transparent text-ink-500 hover:text-ink-900'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {tab === 'overview' && <OverviewTab manuscript={manuscript} analysis={analysis} />}
        {tab === 'embeddings' && <EmbeddingsTab manuscript={manuscript} analysis={analysis} />}
        {tab === 'escalation' && <EscalationTab manuscript={manuscript} analysis={analysis} />}
        {tab === 'repetition' && <RepetitionTab manuscript={manuscript} analysis={analysis} chapterMap={chapterMap} />}
        {tab === 'abstraction' && <AbstractionTab manuscript={manuscript} analysis={analysis} />}
        {tab === 'suggestions' && <SuggestionsTab payload={payload} analysis={analysis} projectName={projectName} />}
      </main>
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────
function OverviewTab({ manuscript, analysis }: { manuscript: Manuscript; analysis: AnalysisResults }) {
  const totalWords = manuscript.chapters.reduce((s, c) => s + c.wordCount, 0);
  const avgWords = Math.round(totalWords / Math.max(1, manuscript.chapters.length));
  const meanAbstraction = analysis.abstraction.reduce((s, a) => s + a.ratio, 0) / Math.max(1, analysis.abstraction.length);
  const sentimentRange = (() => {
    const xs = analysis.escalation.map((e) => e.sentiment);
    if (xs.length === 0) return 0;
    return Math.max(...xs) - Math.min(...xs);
  })();

  // Top off-diagonal similarity pairs
  const pairs: { a: number; b: number; v: number }[] = [];
  for (let i = 0; i < analysis.similarityMatrix.length; i++) {
    for (let j = i + 1; j < analysis.similarityMatrix.length; j++) {
      pairs.push({ a: i, b: j, v: analysis.similarityMatrix[i][j] });
    }
  }
  pairs.sort((x, y) => y.v - x.v);
  const topSimilar = pairs.slice(0, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Stat label="Chapters" value={manuscript.chapters.length.toLocaleString()} sub={`${avgWords.toLocaleString()} avg words`} />
      <Stat label="Total words" value={totalWords.toLocaleString()} sub={`across ${manuscript.chapters.reduce((s, c) => s + c.paragraphs.length, 0)} paragraphs`} />
      <Stat
        label="Suggestions"
        value={analysis.suggestions.length.toLocaleString()}
        sub={`${analysis.repetitions.length} repeated phrases`}
      />

      <div className="lg:col-span-2 paper rounded-2xl border border-ink-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="serif text-lg text-ink-900">Sentiment by chapter</h3>
          <span className="text-xs text-ink-500">range {sentimentRange.toFixed(2)}</span>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart
              data={analysis.escalation.map((e, i) => ({
                name: `Ch ${i + 1}`,
                sentiment: Number(e.sentiment.toFixed(3)),
              }))}
            >
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c2410c" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#c2410c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(63,55,42,0.08)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} domain={[-1, 1]} />
              <ReferenceLine y={0} stroke="rgba(63,55,42,0.25)" />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ebe7dc', fontSize: 12 }} />
              <Area type="monotone" dataKey="sentiment" stroke="#c2410c" strokeWidth={2} fill="url(#sentGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="paper rounded-2xl border border-ink-100 p-5">
        <h3 className="serif text-lg text-ink-900 mb-3">Most similar chapter pairs</h3>
        <div className="space-y-3">
          {topSimilar.map((p, i) => (
            <div key={i} className="text-sm">
              <div className="flex justify-between items-baseline">
                <span className="text-ink-700 truncate pr-2">
                  {chapterLabel(manuscript.chapters[p.a])}
                </span>
                <span className="mono text-xs text-ink-500">{p.v.toFixed(3)}</span>
              </div>
              <div className="text-ink-500 truncate text-xs">↔ {chapterLabel(manuscript.chapters[p.b])}</div>
              <div className="mt-1 h-1 bg-ink-100 rounded-full overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${Math.max(0, p.v * 100)}%` }} />
              </div>
            </div>
          ))}
          {topSimilar.length === 0 && <div className="text-sm text-ink-500">Need at least 2 chapters.</div>}
        </div>
      </div>

      <div className="lg:col-span-3 paper rounded-2xl border border-ink-100 p-5">
        <h3 className="serif text-lg text-ink-900 mb-1">Show vs. tell</h3>
        <p className="text-sm text-ink-500 mb-4">
          Average abstraction ratio is <span className="mono text-ink-900">{meanAbstraction.toFixed(2)}</span>.
          Lower numbers mean more concrete, sensory writing; higher numbers mean more interior, summarized prose.
        </p>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={analysis.abstraction.map((a, i) => ({
              name: `Ch ${i + 1}`,
              ratio: Number(a.ratio.toFixed(3)),
              concrete: a.concrete,
              abstract: a.abstract,
            }))}>
              <CartesianGrid stroke="rgba(63,55,42,0.08)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} domain={[0, 1]} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ebe7dc', fontSize: 12 }} />
              <ReferenceLine y={0.5} stroke="rgba(63,55,42,0.25)" strokeDasharray="3 3" />
              <Bar dataKey="ratio" radius={[4, 4, 0, 0]}>
                {analysis.abstraction.map((a, i) => (
                  <Cell key={i} fill={a.ratio > 0.6 ? '#c2410c' : a.ratio < 0.35 ? '#7d6f4f' : '#998a68'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="paper rounded-2xl border border-ink-100 p-5">
      <div className="text-xs uppercase tracking-widest text-ink-400">{label}</div>
      <div className="mt-2 serif text-3xl text-ink-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}

// ─── Embeddings tab ──────────────────────────────────────────────────────────
function EmbeddingsTab({ manuscript, analysis }: { manuscript: Manuscript; analysis: AnalysisResults }) {
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const labels = manuscript.chapters.map(chapterLabel);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 paper rounded-2xl border border-ink-100 p-5">
        <h3 className="serif text-lg text-ink-900 mb-1">Chapter similarity heatmap</h3>
        <p className="text-sm text-ink-500 mb-4">
          Cosine similarity between chapter embeddings (mean-pooled paragraph vectors from{' '}
          <span className="mono">{analysis.modelInfo.embedModel}</span>). Bright off-diagonal cells flag chapters whose
          semantic territory overlaps — possible redundancy or strong thematic echo.
        </p>
        <Heatmap
          matrix={analysis.similarityMatrix}
          labels={labels}
          onCellClick={(i, j) => setHover({ i, j })}
        />
      </div>
      <div className="paper rounded-2xl border border-ink-100 p-5">
        <h3 className="serif text-lg text-ink-900 mb-3">Detail</h3>
        {hover ? (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-400">Similarity</div>
              <div className="mono text-2xl text-ink-900">
                {analysis.similarityMatrix[hover.i][hover.j].toFixed(3)}
              </div>
            </div>
            <div className="border-t border-ink-100 pt-3">
              <div className="text-xs text-ink-500">Row</div>
              <div className="serif">{labels[hover.i]}</div>
              <div className="text-xs text-ink-400 mt-1">{manuscript.chapters[hover.i].wordCount} words</div>
            </div>
            <div className="border-t border-ink-100 pt-3">
              <div className="text-xs text-ink-500">Column</div>
              <div className="serif">{labels[hover.j]}</div>
              <div className="text-xs text-ink-400 mt-1">{manuscript.chapters[hover.j].wordCount} words</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-500">Click any cell to inspect the chapter pair.</p>
        )}
      </div>
    </div>
  );
}

// ─── Escalation tab ──────────────────────────────────────────────────────────
function EscalationTab({ manuscript, analysis }: { manuscript: Manuscript; analysis: AnalysisResults }) {
  const data = analysis.escalation.map((e, i) => ({
    name: `Ch ${i + 1}`,
    label: chapterLabel(manuscript.chapters[i]),
    sentiment: Number(e.sentiment.toFixed(3)),
    intensity: Number(e.intensity.toFixed(3)),
  }));

  return (
    <div className="grid gap-6">
      <div className="paper rounded-2xl border border-ink-100 p-5">
        <h3 className="serif text-lg text-ink-900 mb-1">Escalation curve</h3>
        <p className="text-sm text-ink-500 mb-4">
          Per-chapter sentiment polarity (signed) and confidence intensity from{' '}
          <span className="mono">{analysis.modelInfo.sentimentModel}</span>. A strong narrative typically descends
          before it ascends — flat or noisy curves can flag pacing problems.
        </p>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke="rgba(63,55,42,0.08)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} domain={[-1, 1]} />
              <ReferenceLine y={0} stroke="rgba(63,55,42,0.25)" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #ebe7dc', fontSize: 12 }}
                labelFormatter={(_v, p) => p?.[0]?.payload?.label}
              />
              <Line type="monotone" dataKey="sentiment" stroke="#c2410c" strokeWidth={2.2} dot={{ r: 3 }} name="Sentiment" />
              <Line type="monotone" dataKey="intensity" stroke="#5e533c" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Confidence" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="paper rounded-2xl border border-ink-100 p-5">
        <h3 className="serif text-lg text-ink-900 mb-3">Per-chapter readout</h3>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-400 border-b border-ink-100">
            <tr>
              <th className="text-left py-2 font-normal">Chapter</th>
              <th className="text-right font-normal">Sentiment</th>
              <th className="text-right font-normal">Intensity</th>
              <th className="text-right font-normal">Words</th>
            </tr>
          </thead>
          <tbody>
            {analysis.escalation.map((e, i) => {
              const ch = manuscript.chapters[i];
              const sBg = e.sentiment > 0
                ? `rgba(120, 130, 50, ${0.1 + Math.min(0.3, Math.abs(e.sentiment) * 0.4)})`
                : `rgba(194, 65, 12, ${0.1 + Math.min(0.3, Math.abs(e.sentiment) * 0.4)})`;
              return (
                <tr key={ch.id} className="border-b border-ink-100/60">
                  <td className="py-2 pr-2">
                    <span className="serif text-ink-900">{chapterLabel(ch)}</span>
                  </td>
                  <td className="py-2 text-right mono">
                    <span className="inline-block px-2 py-0.5 rounded" style={{ backgroundColor: sBg }}>
                      {e.sentiment >= 0 ? '+' : ''}{e.sentiment.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-2 text-right mono text-ink-500">{e.intensity.toFixed(3)}</td>
                  <td className="py-2 text-right mono text-ink-500">{ch.wordCount.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Repetition tab ──────────────────────────────────────────────────────────
function RepetitionTab({ manuscript, analysis, chapterMap }: { manuscript: Manuscript; analysis: AnalysisResults; chapterMap: Map<string, Chapter> }) {
  const [picked, setPicked] = useState<string | null>(analysis.repetitions[0]?.phrase ?? null);

  const pickedEntry = analysis.repetitions.find((r) => r.phrase === picked);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="paper rounded-2xl border border-ink-100 p-5 lg:col-span-1">
        <h3 className="serif text-lg text-ink-900 mb-3">Repeated phrases</h3>
        <p className="text-xs text-ink-500 mb-3">
          {analysis.repetitions.length} content phrases (3–5 words) used {3}+ times.
        </p>
        <div className="max-h-[520px] overflow-y-auto -mx-2">
          {analysis.repetitions.length === 0 && (
            <div className="text-sm text-ink-500 px-2">No repeated phrases above the threshold.</div>
          )}
          {analysis.repetitions.map((r) => (
            <button
              key={r.phrase}
              onClick={() => setPicked(r.phrase)}
              className={`w-full text-left px-2 py-2 rounded flex items-center justify-between gap-2 transition-colors ${
                picked === r.phrase ? 'bg-accent/10' : 'hover:bg-ink-100/60'
              }`}
            >
              <span className="text-sm serif text-ink-900 truncate">{r.phrase}</span>
              <span className="mono text-xs text-ink-500">{r.count}×</span>
            </button>
          ))}
        </div>
      </div>

      <div className="paper rounded-2xl border border-ink-100 p-5 lg:col-span-2">
        {pickedEntry ? (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="serif text-lg text-ink-900">"{pickedEntry.phrase}"</h3>
              <span className="text-xs mono text-ink-500">{pickedEntry.count} occurrences</span>
            </div>
            <div className="h-44 mb-5">
              <ResponsiveContainer>
                <BarChart
                  data={manuscript.chapters.map((c, i) => {
                    const found = pickedEntry.chapters.find((x) => x.chapterId === c.id);
                    return { name: `Ch ${i + 1}`, count: found?.count ?? 0 };
                  })}
                >
                  <CartesianGrid stroke="rgba(63,55,42,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ebe7dc', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#c2410c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <h4 className="text-xs uppercase tracking-widest text-ink-400 mb-2">In context</h4>
            <RepetitionContext
              phrase={pickedEntry.phrase}
              manuscript={manuscript}
              chapterMap={chapterMap}
            />
          </>
        ) : (
          <p className="text-sm text-ink-500">Select a phrase to see where it appears.</p>
        )}
      </div>
    </div>
  );
}

function RepetitionContext({
  phrase, manuscript,
}: {
  phrase: string;
  manuscript: Manuscript;
  chapterMap: Map<string, Chapter>;
}) {
  const tokens = phrase.split(' ');
  const matches: { chapter: Chapter; before: string; hit: string; after: string; leftEllipsis: boolean; rightEllipsis: boolean }[] = [];
  for (const ch of manuscript.chapters) {
    const text = ch.text;
    const re = new RegExp(`(\\b${tokens.map(escapeRe).join('\\W+')}\\b)`, 'ig');
    let m;
    let count = 0;
    while ((m = re.exec(text)) && count < 3) {
      const start = Math.max(0, m.index - 60);
      const end = Math.min(text.length, m.index + m[0].length + 60);
      matches.push({
        chapter: ch,
        before: text.slice(start, m.index),
        hit: m[0],
        after: text.slice(m.index + m[0].length, end),
        leftEllipsis: start > 0,
        rightEllipsis: end < text.length,
      });
      count++;
    }
  }
  if (matches.length === 0) return <div className="text-sm text-ink-500">No exact matches found.</div>;
  return (
    <div className="space-y-3 max-h-[260px] overflow-y-auto pr-2">
      {matches.slice(0, 12).map((m, i) => (
        <div key={i} className="text-sm">
          <div className="text-[11px] uppercase tracking-wide text-ink-400">{chapterLabel(m.chapter)}</div>
          <p className="prose-manuscript text-[14px]">
            {m.leftEllipsis && '…'}
            {m.before}
            <mark>{m.hit}</mark>
            {m.after}
            {m.rightEllipsis && '…'}
          </p>
        </div>
      ))}
    </div>
  );
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Abstraction tab ─────────────────────────────────────────────────────────
function AbstractionTab({ manuscript, analysis }: { manuscript: Manuscript; analysis: AnalysisResults }) {
  const data = analysis.abstraction.map((a, i) => ({
    name: `Ch ${i + 1}`,
    label: chapterLabel(manuscript.chapters[i]),
    ratio: Number((a.ratio * 100).toFixed(1)),
    concrete: a.concrete,
    abstract: a.abstract,
  }));

  // Top 6 chapters most/least abstract for the radar
  const radar = [...data].slice(0, Math.min(8, data.length));

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="paper rounded-2xl border border-ink-100 p-5">
        <h3 className="serif text-lg text-ink-900 mb-1">Abstract vs. concrete</h3>
        <p className="text-sm text-ink-500 mb-4">
          Per-chapter ratio of abstract / cognitive vocabulary against concrete sensory vocabulary. Sustained ratios
          above 60% often correlate with "telling" rather than "showing".
        </p>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke="rgba(63,55,42,0.08)" vertical={false} />
              <XAxis dataKey="name" stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #ebe7dc', fontSize: 12 }}
                labelFormatter={(_v, p) => p?.[0]?.payload?.label}
                formatter={(value, name) => [value, name === 'ratio' ? 'Abstraction %' : name]}
              />
              <ReferenceLine y={50} stroke="rgba(63,55,42,0.25)" strokeDasharray="3 3" />
              <Bar dataKey="ratio" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={d.ratio > 60 ? '#c2410c' : d.ratio < 35 ? '#5e533c' : '#998a68'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="paper rounded-2xl border border-ink-100 p-5">
        <h3 className="serif text-lg text-ink-900 mb-1">Tone fingerprint</h3>
        <p className="text-sm text-ink-500 mb-4">
          A polar view across the first chapters — useful for spotting a section that suddenly turns inward.
        </p>
        <div className="h-72">
          <ResponsiveContainer>
            <RadarChart data={radar}>
              <PolarGrid stroke="rgba(63,55,42,0.15)" />
              <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: 'rgba(63,55,42,0.7)' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar dataKey="ratio" stroke="#c2410c" fill="#c2410c" fillOpacity={0.18} strokeWidth={1.6} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ebe7dc', fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="lg:col-span-2 paper rounded-2xl border border-ink-100 p-5">
        <h3 className="serif text-lg text-ink-900 mb-3">Detail</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {analysis.abstraction.map((a, i) => {
            const ch = manuscript.chapters[i];
            return (
              <div key={ch.id} className="rounded-lg border border-ink-100 p-3">
                <div className="text-[11px] uppercase tracking-widest text-ink-400">Ch {i + 1}</div>
                <div className="serif text-sm text-ink-900 truncate">{ch.title}</div>
                <div className="mt-2 text-xs text-ink-500 flex justify-between">
                  <span>Concrete</span>
                  <span className="mono">{a.concrete}</span>
                </div>
                <div className="text-xs text-ink-500 flex justify-between">
                  <span>Abstract</span>
                  <span className="mono">{a.abstract}</span>
                </div>
                <div className="mt-2 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${Math.round(a.ratio * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Suggestions tab ─────────────────────────────────────────────────────────
function SuggestionsTab({ payload, analysis, projectName }: { payload: ProjectPayload; analysis: AnalysisResults; projectName: string }) {
  const [filter, setFilter] = useState<'all' | 'echo' | 'abstract-heavy' | 'low-tension'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const blob = await exportSuggestionsPDF(payload, projectName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/[^\w-]+/g, '_')}_revision_report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const filtered = analysis.suggestions.filter((s) => filter === 'all' || s.reason === filter);

  const paragraphMap = useMemo(() => {
    const m = new Map<string, { text: string; chapterTitle: string; chapterIndex: number }>();
    payload.manuscript.chapters.forEach((c) => {
      c.paragraphs.forEach((p) => m.set(p.id, { text: p.text, chapterTitle: c.title, chapterIndex: c.index }));
    });
    return m;
  }, [payload]);

  const counts = {
    all: analysis.suggestions.length,
    echo: analysis.suggestions.filter((s) => s.reason === 'echo').length,
    'abstract-heavy': analysis.suggestions.filter((s) => s.reason === 'abstract-heavy').length,
    'low-tension': analysis.suggestions.filter((s) => s.reason === 'low-tension').length,
  };

  return (
    <div className="grid gap-6">
      <div className="paper rounded-2xl border border-ink-100 p-5">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <div>
            <h3 className="serif text-lg text-ink-900">Paragraph-level alternatives</h3>
            <p className="text-sm text-ink-500">
              {filtered.length} suggestions · ranked by signal strength.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 text-xs">
              {(['all', 'echo', 'abstract-heavy', 'low-tension'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full border ${
                    filter === f
                      ? 'bg-ink-900 text-ink-50 border-ink-900'
                      : 'border-ink-200 text-ink-600 hover:bg-ink-100'
                  }`}
                >
                  {labelFor(f)} <span className="opacity-60 ml-1">{counts[f]}</span>
                </button>
              ))}
            </div>
            <button
              onClick={handleExportPDF}
              disabled={exporting || analysis.suggestions.length === 0}
              className="flex items-center gap-1.5 text-xs rounded-lg bg-ink-900 text-ink-50 px-3 py-1.5 hover:bg-accent disabled:opacity-50"
              title="Export all suggestions as a PDF revision report"
            >
              <FileText size={12} />
              {exporting ? 'Building PDF…' : 'Export PDF'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-sm text-ink-500">No suggestions for this filter — your prose is holding up.</div>
          )}
          {filtered.map((s) => {
            const para = paragraphMap.get(s.paragraphId);
            const isOpen = open === s.paragraphId + s.reason;
            return (
              <div key={s.paragraphId + s.reason} className="rounded-xl border border-ink-100 bg-white/40">
                <button
                  onClick={() => setOpen(isOpen ? null : s.paragraphId + s.reason)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-ink-100/40"
                >
                  <ChevronRight
                    size={16}
                    className={`mt-1 text-ink-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] uppercase tracking-widest text-accent">{s.reasonLabel}</span>
                      <span className="text-xs text-ink-500">
                        Ch {(para?.chapterIndex ?? 0) + 1} · {para?.chapterTitle}
                      </span>
                      <span className="ml-auto mono text-xs text-ink-400">{s.score.toFixed(2)}</span>
                    </div>
                    <p className="prose-manuscript text-[14px] mt-1 line-clamp-2">{para?.text}</p>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-ink-100 px-4 py-4 grid md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-[11px] uppercase tracking-widest text-ink-400 mb-2">Original paragraph</h5>
                      <p className="prose-manuscript">{para?.text}</p>
                    </div>
                    <div>
                      <h5 className="text-[11px] uppercase tracking-widest text-ink-400 mb-2">Why flagged</h5>
                      <p className="text-sm text-ink-700 mb-3">{s.detail}</p>
                      <h5 className="text-[11px] uppercase tracking-widest text-ink-400 mb-2">Try one of these</h5>
                      <ul className="space-y-2">
                        {s.alternatives.map((a, i) => (
                          <li key={i} className="text-sm text-ink-800 border-l-2 border-accent/40 pl-3">
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function labelFor(f: 'all' | 'echo' | 'abstract-heavy' | 'low-tension'): string {
  switch (f) {
    case 'all': return 'All';
    case 'echo': return 'Echoes';
    case 'abstract-heavy': return 'Abstraction';
    case 'low-tension': return 'Tension';
  }
}

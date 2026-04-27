import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, BarChart, Bar, Legend,
} from 'recharts';
import { ArrowLeft, ArrowRight, Plus, Minus, GitCompare, BookOpenText } from 'lucide-react';
import type { ProjectPayload } from '../lib/types';
import { computeDiff, type ChapterAlignment } from '../lib/compare';

interface Props {
  left: { name: string; payload: ProjectPayload };
  right: { name: string; payload: ProjectPayload };
  onBack: () => void;
}

function fmtSigned(n: number, digits = 2): string {
  return (n >= 0 ? '+' : '') + n.toFixed(digits);
}

function deltaClass(n: number, invert = false): string {
  const positive = invert ? n < 0 : n > 0;
  if (Math.abs(n) < 0.005) return 'text-ink-500';
  return positive ? 'text-emerald-700' : 'text-accent-deep';
}

export default function Compare({ left, right, onBack }: Props) {
  const diff = useMemo(() => computeDiff(left.payload, right.payload), [left, right]);

  // Chart data: matched chapters in left-order, with sentiment + abstraction trajectories
  const trajectories = useMemo(() => {
    const matched = diff.alignments.filter((a) => a.leftIndex !== null && a.rightIndex !== null);
    return matched.map((a, i) => {
      const li = a.leftIndex!;
      const ri = a.rightIndex!;
      return {
        name: `Pair ${i + 1}`,
        leftLabel: left.payload.manuscript.chapters[li].title || `Ch ${li + 1}`,
        rightLabel: right.payload.manuscript.chapters[ri].title || `Ch ${ri + 1}`,
        leftSentiment: Number(left.payload.analysis!.escalation[li].sentiment.toFixed(3)),
        rightSentiment: Number(right.payload.analysis!.escalation[ri].sentiment.toFixed(3)),
        leftAbstraction: Number((left.payload.analysis!.abstraction[li].ratio * 100).toFixed(1)),
        rightAbstraction: Number((right.payload.analysis!.abstraction[ri].ratio * 100).toFixed(1)),
        similarity: a.similarity ?? 0,
      };
    });
  }, [diff, left, right]);

  const wordDelta = diff.totalsRight.words - diff.totalsLeft.words;
  const wordPct = diff.totalsLeft.words > 0
    ? ((wordDelta / diff.totalsLeft.words) * 100)
    : 0;
  const sentDelta = diff.meanSentimentRight - diff.meanSentimentLeft;
  const absDelta = diff.meanAbstractionRight - diff.meanAbstractionLeft;
  const sugDelta = diff.totalsRight.suggestions - diff.totalsLeft.suggestions;
  const repDelta = diff.totalsRight.repetitions - diff.totalsLeft.repetitions;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-ink-100 bg-white/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md hover:bg-ink-100 text-ink-500 hover:text-ink-900"
            title="Back to projects"
          >
            <ArrowLeft size={16} />
          </button>
          <GitCompare size={18} className="text-accent" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-widest text-ink-400">Comparison</div>
            <div className="serif text-base text-ink-900 truncate">
              {left.name} <span className="text-ink-400">vs</span> {right.name}
            </div>
          </div>
          <div className="hidden md:block text-xs text-ink-500 mono">
            global similarity {diff.globalSimilarity.toFixed(3)}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full grid gap-6">
        {/* Side-by-side stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <DeltaStat label="Words" left={diff.totalsLeft.words.toLocaleString()} right={diff.totalsRight.words.toLocaleString()}
            delta={wordDelta} formatDelta={(n) => `${fmtSigned(n, 0)} (${fmtSigned(wordPct, 1)}%)`} />
          <DeltaStat label="Chapters" left={diff.totalsLeft.chapters.toString()} right={diff.totalsRight.chapters.toString()}
            delta={diff.totalsRight.chapters - diff.totalsLeft.chapters} formatDelta={(n) => fmtSigned(n, 0)} />
          <DeltaStat label="Suggestions" left={diff.totalsLeft.suggestions.toString()} right={diff.totalsRight.suggestions.toString()}
            delta={sugDelta} invert formatDelta={(n) => fmtSigned(n, 0)} />
          <DeltaStat label="Repeated phrases" left={diff.totalsLeft.repetitions.toString()} right={diff.totalsRight.repetitions.toString()}
            delta={repDelta} invert formatDelta={(n) => fmtSigned(n, 0)} />
          <DeltaStat label="Mean sentiment" left={fmtSigned(diff.meanSentimentLeft)} right={fmtSigned(diff.meanSentimentRight)}
            delta={sentDelta} formatDelta={(n) => fmtSigned(n)} />
        </div>

        {/* Trajectory charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="paper rounded-2xl border border-ink-100 p-5">
            <h3 className="serif text-lg text-ink-900 mb-1">Sentiment trajectory</h3>
            <p className="text-xs text-ink-500 mb-4">
              Aligned chapter pairs only ({trajectories.length} of max{' '}
              {Math.min(diff.totalsLeft.chapters, diff.totalsRight.chapters)})
            </p>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={trajectories}>
                  <CartesianGrid stroke="rgba(63,55,42,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} domain={[-1, 1]} />
                  <ReferenceLine y={0} stroke="rgba(63,55,42,0.25)" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ebe7dc', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="leftSentiment" stroke="#5e533c" strokeWidth={1.6} strokeDasharray="4 3" dot={{ r: 2 }} name={left.name} />
                  <Line type="monotone" dataKey="rightSentiment" stroke="#c2410c" strokeWidth={2.2} dot={{ r: 3 }} name={right.name} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="paper rounded-2xl border border-ink-100 p-5">
            <h3 className="serif text-lg text-ink-900 mb-1">Abstraction trajectory</h3>
            <p className="text-xs text-ink-500 mb-4">
              Lower is more concrete. Mean: {(diff.meanAbstractionLeft * 100).toFixed(1)}% →{' '}
              <span className={deltaClass(absDelta, true)}>{(diff.meanAbstractionRight * 100).toFixed(1)}%</span>
            </p>
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={trajectories}>
                  <CartesianGrid stroke="rgba(63,55,42,0.08)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <ReferenceLine y={50} stroke="rgba(63,55,42,0.25)" strokeDasharray="3 3" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ebe7dc', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="leftAbstraction" stroke="#5e533c" strokeWidth={1.6} strokeDasharray="4 3" dot={{ r: 2 }} name={left.name} />
                  <Line type="monotone" dataKey="rightAbstraction" stroke="#c2410c" strokeWidth={2.2} dot={{ r: 3 }} name={right.name} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Word count delta per pair */}
        <div className="paper rounded-2xl border border-ink-100 p-5">
          <h3 className="serif text-lg text-ink-900 mb-1">Word count change per matched chapter</h3>
          <p className="text-xs text-ink-500 mb-4">Positive = right version is longer than left.</p>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart
                data={diff.alignments
                  .filter((a) => a.wordDelta !== undefined)
                  .map((a, i) => ({
                    name: `Pair ${i + 1}`,
                    delta: a.wordDelta!,
                  }))
                }
              >
                <CartesianGrid stroke="rgba(63,55,42,0.08)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} />
                <YAxis stroke="rgba(63,55,42,0.5)" tick={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="rgba(63,55,42,0.4)" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #ebe7dc', fontSize: 12 }} />
                <Bar dataKey="delta" radius={[3, 3, 3, 3]} fill="#c2410c" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alignment table */}
        <div className="paper rounded-2xl border border-ink-100 p-5">
          <h3 className="serif text-lg text-ink-900 mb-1">Chapter alignment</h3>
          <p className="text-xs text-ink-500 mb-4">
            Matched by best embedding similarity. Unmatched chapters show only one side.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-ink-400 border-b border-ink-100">
                <tr>
                  <th className="text-left py-2 font-normal">{left.name}</th>
                  <th className="text-center font-normal w-10"></th>
                  <th className="text-left py-2 font-normal">{right.name}</th>
                  <th className="text-right font-normal">Similarity</th>
                  <th className="text-right font-normal">ΔWords</th>
                  <th className="text-right font-normal">ΔSent</th>
                  <th className="text-right font-normal">ΔAbs</th>
                </tr>
              </thead>
              <tbody>
                {diff.alignments.map((a, i) => (
                  <AlignmentRow key={i} a={a} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Repetition changes */}
        <div className="grid lg:grid-cols-3 gap-6">
          <RepetitionList
            title="Removed repetitions"
            subtitle={`Phrases gone from ${right.name}`}
            items={diff.removedRepetitions.slice(0, 12).map((r) => ({ phrase: r.phrase, primary: r.count, accent: 'good' }))}
            icon={<Minus size={14} className="text-emerald-700" />}
          />
          <RepetitionList
            title="New repetitions"
            subtitle={`Phrases that appeared in ${right.name}`}
            items={diff.newRepetitions.slice(0, 12).map((r) => ({ phrase: r.phrase, primary: r.count, accent: 'bad' }))}
            icon={<Plus size={14} className="text-accent-deep" />}
          />
          <div className="paper rounded-2xl border border-ink-100 p-5">
            <div className="flex items-center gap-2 mb-1">
              <BookOpenText size={14} className="text-ink-500" />
              <h3 className="serif text-lg text-ink-900">Shared repetitions</h3>
            </div>
            <p className="text-xs text-ink-500 mb-3">Phrases present in both, ranked by largest count change.</p>
            <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {diff.sharedRepetitions.slice(0, 12).map((r) => (
                <li key={r.phrase} className="text-sm flex items-baseline justify-between gap-2 border-b border-ink-100/60 pb-1.5">
                  <span className="serif text-ink-900 truncate flex-1">{r.phrase}</span>
                  <span className="mono text-xs text-ink-500 whitespace-nowrap">
                    {r.left} → {r.right}{' '}
                    <span className={deltaClass(r.delta, true)}>({fmtSigned(r.delta, 0)})</span>
                  </span>
                </li>
              ))}
              {diff.sharedRepetitions.length === 0 && (
                <li className="text-sm text-ink-500">No shared repeated phrases.</li>
              )}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

function DeltaStat({
  label, left, right, delta, formatDelta, invert,
}: {
  label: string; left: string; right: string; delta: number; formatDelta: (n: number) => string; invert?: boolean;
}) {
  return (
    <div className="paper rounded-2xl border border-ink-100 p-4">
      <div className="text-[11px] uppercase tracking-widest text-ink-400">{label}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 items-baseline">
        <div>
          <div className="serif text-lg text-ink-900 truncate">{left}</div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400">left</div>
        </div>
        <div className="text-right">
          <div className="serif text-lg text-ink-900 truncate">{right}</div>
          <div className="text-[10px] uppercase tracking-wider text-ink-400">right</div>
        </div>
      </div>
      <div className={`mt-2 mono text-xs ${deltaClass(delta, invert)}`}>{formatDelta(delta)}</div>
    </div>
  );
}

function AlignmentRow({ a }: { a: ChapterAlignment }) {
  const arrow = a.leftIndex === null
    ? <ArrowRight size={14} className="text-emerald-700" />
    : a.rightIndex === null
      ? <ArrowLeft size={14} className="text-accent-deep" />
      : <span className="text-ink-300">↔</span>;
  return (
    <tr className="border-b border-ink-100/50">
      <td className="py-2 pr-2">
        {a.leftIndex !== null
          ? <span className="serif text-ink-900">{a.leftIndex + 1}. {a.leftTitle}</span>
          : <span className="text-ink-300 italic">— added —</span>}
      </td>
      <td className="text-center">{arrow}</td>
      <td className="py-2 pr-2">
        {a.rightIndex !== null
          ? <span className="serif text-ink-900">{a.rightIndex + 1}. {a.rightTitle}</span>
          : <span className="text-ink-300 italic">— removed —</span>}
      </td>
      <td className="py-2 text-right mono text-xs text-ink-500">
        {a.similarity !== null ? a.similarity.toFixed(3) : '—'}
      </td>
      <td className="py-2 text-right mono text-xs">
        {a.wordDelta !== undefined
          ? <span className={deltaClass(a.wordDelta)}>{fmtSigned(a.wordDelta, 0)}</span>
          : '—'}
      </td>
      <td className="py-2 text-right mono text-xs">
        {a.sentimentDelta !== undefined
          ? <span className={deltaClass(a.sentimentDelta)}>{fmtSigned(a.sentimentDelta)}</span>
          : '—'}
      </td>
      <td className="py-2 text-right mono text-xs">
        {a.abstractionDelta !== undefined
          ? <span className={deltaClass(a.abstractionDelta, true)}>{fmtSigned(a.abstractionDelta)}</span>
          : '—'}
      </td>
    </tr>
  );
}

function RepetitionList({
  title, subtitle, items, icon,
}: {
  title: string; subtitle: string;
  items: { phrase: string; primary: number; accent: 'good' | 'bad' }[];
  icon: React.ReactNode;
}) {
  return (
    <div className="paper rounded-2xl border border-ink-100 p-5">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="serif text-lg text-ink-900">{title}</h3>
      </div>
      <p className="text-xs text-ink-500 mb-3">{subtitle}</p>
      {items.length === 0
        ? <div className="text-sm text-ink-500">None.</div>
        : (
          <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {items.map((r) => (
              <li key={r.phrase} className="text-sm flex items-baseline justify-between gap-2 border-b border-ink-100/60 pb-1.5">
                <span className="serif text-ink-900 truncate flex-1">{r.phrase}</span>
                <span className="mono text-xs text-ink-500 whitespace-nowrap">{r.primary}×</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

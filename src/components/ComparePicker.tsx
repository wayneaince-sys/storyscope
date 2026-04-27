import { useState } from 'react';
import { Lock, ArrowLeft, GitCompare } from 'lucide-react';
import type { ProjectRecord } from '../lib/db';
import { unlockProject } from '../lib/db';
import type { ProjectPayload } from '../lib/types';

interface Props {
  projects: ProjectRecord[];
  onCancel: () => void;
  onReady: (
    left: { project: ProjectRecord; payload: ProjectPayload },
    right: { project: ProjectRecord; payload: ProjectPayload }
  ) => void;
}

export default function ComparePicker({ projects, onCancel, onReady }: Props) {
  const [leftId, setLeftId] = useState<string>('');
  const [rightId, setRightId] = useState<string>('');
  const [leftPass, setLeftPass] = useState('');
  const [rightPass, setRightPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const eligible = projects.filter((p) => p.meta.chapterCount > 0);

  const submit = async () => {
    setErr(null);
    if (!leftId || !rightId) return setErr('Pick a project for each side.');
    if (leftId === rightId) return setErr('Pick two different projects.');
    setBusy(true);
    try {
      const leftRecord = projects.find((p) => p.id === leftId)!;
      const rightRecord = projects.find((p) => p.id === rightId)!;
      const [leftPayload, rightPayload] = await Promise.all([
        unlockProject(leftId, leftPass),
        unlockProject(rightId, rightPass),
      ]);
      if (!leftPayload.analysis || !rightPayload.analysis) {
        throw new Error('One of the projects is missing analysis. Open it first to (re-)analyze.');
      }
      onReady(
        { project: leftRecord, payload: leftPayload },
        { project: rightRecord, payload: rightPayload }
      );
    } catch (e: any) {
      setErr(e?.message || 'Could not open both projects.');
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={onCancel}
        className="text-sm text-ink-500 hover:text-ink-900 mb-4 flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Back to projects
      </button>

      <div className="paper rounded-2xl border border-ink-100 shadow-paper p-8">
        <div className="flex items-center gap-2 mb-1">
          <GitCompare className="text-accent" size={18} />
          <h2 className="serif text-2xl text-ink-900">Compare two manuscripts</h2>
        </div>
        <p className="text-ink-500 text-sm mb-6">
          Pick two encrypted projects. StoryScope will align their chapters by embedding similarity and surface
          per-chapter changes in word count, sentiment, abstraction, and repeated phrases.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <SidePicker
            label="Left (earlier draft)"
            projects={eligible}
            value={leftId}
            onChange={setLeftId}
            pass={leftPass}
            onPass={setLeftPass}
            otherId={rightId}
          />
          <SidePicker
            label="Right (later draft)"
            projects={eligible}
            value={rightId}
            onChange={setRightId}
            pass={rightPass}
            onPass={setRightPass}
            otherId={leftId}
          />
        </div>

        {err && (
          <div className="mt-4 text-sm rounded-lg border border-accent/30 bg-accent/5 text-accent-deep px-3 py-2">
            {err}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-ink-500 max-w-sm">
            Each project is unlocked with its own passphrase. Comparison runs entirely in this browser.
          </p>
          <button
            disabled={busy || !leftId || !rightId || !leftPass || !rightPass}
            onClick={submit}
            className="rounded-lg bg-ink-900 text-ink-50 px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {busy ? 'Unlocking…' : 'Compare'}
          </button>
        </div>

        {eligible.length < 2 && (
          <div className="mt-6 text-sm rounded-lg border border-ink-200 bg-ink-50 text-ink-700 px-3 py-3">
            You need at least two analyzed projects to use compare. Upload another manuscript first.
          </div>
        )}
      </div>
    </div>
  );
}

function SidePicker({
  label, projects, value, onChange, pass, onPass, otherId,
}: {
  label: string;
  projects: ProjectRecord[];
  value: string;
  onChange: (v: string) => void;
  pass: string;
  onPass: (v: string) => void;
  otherId: string;
}) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-ink-500 mb-2 block">{label}</span>
      <div className="rounded-lg border border-ink-200 bg-white/70 divide-y divide-ink-100 max-h-56 overflow-y-auto">
        {projects.length === 0 && (
          <div className="px-3 py-4 text-sm text-ink-500">No projects yet.</div>
        )}
        {projects.map((p) => {
          const active = p.id === value;
          const disabled = p.id === otherId && otherId !== '';
          return (
            <button
              key={p.id}
              disabled={disabled}
              onClick={() => onChange(p.id)}
              className={`w-full text-left px-3 py-2.5 transition-colors ${
                active ? 'bg-accent/10' : 'hover:bg-ink-100/40'
              } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <div className="serif text-sm text-ink-900 truncate">{p.name}</div>
              <div className="text-[11px] text-ink-500">
                {p.meta.chapterCount} chapters · {(p.meta.wordCount / 1000).toFixed(1)}k words
              </div>
            </button>
          );
        })}
      </div>
      <label className="block mt-3">
        <span className="text-[11px] uppercase tracking-wide text-ink-500 flex items-center gap-1">
          <Lock size={10} /> Passphrase
        </span>
        <input
          type="password"
          autoComplete="new-password"
          value={pass}
          onChange={(e) => onPass(e.target.value)}
          disabled={!value}
          className="mt-1 w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 mono text-sm focus:border-accent disabled:opacity-50"
          placeholder="Passphrase for selected project"
        />
      </label>
    </div>
  );
}

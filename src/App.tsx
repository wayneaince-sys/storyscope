import { useEffect, useMemo, useState } from 'react';
import { Lock, ShieldCheck, Trash2, FilePlus2, Cpu, GitCompare } from 'lucide-react';
import Logo from './components/Logo';
import Upload from './components/Upload';
import PassphrasePrompt from './components/PassphrasePrompt';
import Dashboard from './components/Dashboard';
import ComparePicker from './components/ComparePicker';
import Compare from './components/Compare';
import {
  createProject,
  deleteProject,
  listProjects,
  unlockProject,
  updateProjectPayload,
  type ProjectRecord,
} from './lib/db';
import type { ProjectPayload } from './lib/types';
import { parseDocx } from './lib/docx';
import { runAnalysis } from './lib/analyze';

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'unlock'; project: ProjectRecord }
  | { kind: 'open'; project: ProjectRecord; payload: ProjectPayload; passphrase: string }
  | { kind: 'compare-pick' }
  | { kind: 'compare';
      left: { project: ProjectRecord; payload: ProjectPayload };
      right: { project: ProjectRecord; payload: ProjectPayload };
    };

interface ProgressState {
  stage: string;
  progress: number;
  detail?: string;
}

export default function App() {
  const [view, setView] = useState<View>({ kind: 'list' });
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoadingList(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // ─── Create project flow ───
  const handleCreate = async (file: File, passphrase: string, name: string) => {
    setError(null);
    setBusy(true);
    setProgress({ stage: 'Parsing manuscript', progress: 0 });
    try {
      const manuscript = await parseDocx(file);
      if (manuscript.chapters.length === 0) {
        throw new Error('No content found in this document.');
      }
      setProgress({ stage: 'Analyzing — this stays in your browser', progress: 0.05 });
      const analysis = await runAnalysis(manuscript, (p) => setProgress(p));
      const payload: ProjectPayload = {
        manuscript,
        chapters: manuscript.chapters,
        analysis,
      };
      const record = await createProject(name, payload, passphrase);
      await refresh();
      setView({ kind: 'open', project: record, payload, passphrase });
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Something went wrong while analyzing.');
      setView({ kind: 'create' });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleUnlock = async (project: ProjectRecord, passphrase: string) => {
    const payload = await unlockProject(project.id, passphrase);
    if (!payload.analysis) {
      // Re-run analysis if missing (older project)
      setView({ kind: 'list' });
      setBusy(true);
      setProgress({ stage: 'Re-analyzing', progress: 0 });
      try {
        payload.analysis = await runAnalysis(payload.manuscript, (p) => setProgress(p));
        const updated = await updateProjectPayload(project.id, payload, passphrase);
        await refresh();
        setView({ kind: 'open', project: updated, payload, passphrase });
      } finally {
        setBusy(false);
        setProgress(null);
      }
      return;
    }
    setView({ kind: 'open', project, payload, passphrase });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    await deleteProject(id);
    await refresh();
  };

  const handleExport = () => {
    if (view.kind !== 'open') return;
    const json = JSON.stringify(
      { project: view.project.name, ...view.payload },
      null, 2
    );
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${view.project.name.replace(/[^\w-]+/g, '_')}.storyscope.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ───
  if (view.kind === 'open') {
    return (
      <Dashboard
        payload={view.payload}
        analysis={view.payload.analysis!}
        projectName={view.project.name}
        onExport={handleExport}
        onLock={() => setView({ kind: 'list' })}
      />
    );
  }

  if (view.kind === 'compare') {
    return (
      <Compare
        left={{ name: view.left.project.name, payload: view.left.payload }}
        right={{ name: view.right.project.name, payload: view.right.payload }}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 w-full">
        {view.kind === 'list' && (
          <ProjectList
            projects={projects}
            loading={loadingList}
            onNew={() => { setError(null); setView({ kind: 'create' }); }}
            onOpen={(p) => setView({ kind: 'unlock', project: p })}
            onDelete={handleDelete}
            onCompare={() => { setError(null); setView({ kind: 'compare-pick' }); }}
          />
        )}

        {view.kind === 'compare-pick' && (
          <ComparePicker
            projects={projects}
            onCancel={() => setView({ kind: 'list' })}
            onReady={(left, right) => setView({ kind: 'compare', left, right })}
          />
        )}

        {view.kind === 'create' && (
          <div>
            <button
              onClick={() => setView({ kind: 'list' })}
              className="text-sm text-ink-500 hover:text-ink-900 mb-4"
            >
              ← Back to projects
            </button>
            <Upload onFile={handleCreate} busy={busy} />
            {error && (
              <div className="max-w-2xl mx-auto mt-4 text-sm rounded-lg border border-accent/30 bg-accent/5 text-accent-deep px-3 py-2">
                {error}
              </div>
            )}
          </div>
        )}
      </main>

      {view.kind === 'unlock' && (
        <PassphrasePrompt
          projectName={view.project.name}
          onSubmit={(p) => handleUnlock(view.project, p)}
          onCancel={() => setView({ kind: 'list' })}
        />
      )}

      {busy && progress && (
        <ProgressOverlay progress={progress} />
      )}

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-ink-100 bg-white/60 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
        <Logo size={26} className="text-accent" />
        <div className="flex-1">
          <div className="serif text-xl text-ink-900 leading-none">StoryScope</div>
          <div className="text-[11px] uppercase tracking-widest text-ink-400 mt-0.5">
            Manuscript instrumentation
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-ink-500">
          <ShieldCheck size={14} />
          Encrypted on this device
        </div>
      </div>
    </header>
  );
}

function ProjectList({
  projects, loading, onNew, onOpen, onDelete, onCompare,
}: {
  projects: ProjectRecord[];
  loading: boolean;
  onNew: () => void;
  onOpen: (p: ProjectRecord) => void;
  onDelete: (id: string) => void;
  onCompare: () => void;
}) {
  const canCompare = projects.length >= 2;
  return (
    <div>
      <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
        <div>
          <h1 className="serif text-4xl text-ink-900 leading-tight">Your manuscripts</h1>
          <p className="text-ink-500 mt-2 max-w-xl">
            Drop a Word document. Each project is encrypted with its own passphrase and analyzed
            entirely in your browser — embeddings, sentiment, repetition, and abstraction all run locally.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCompare}
            disabled={!canCompare}
            title={canCompare ? 'Compare two manuscripts' : 'Need at least two projects'}
            className="rounded-xl border border-ink-200 text-ink-700 px-4 py-3 text-sm font-medium hover:bg-ink-100 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            <GitCompare size={16} /> Compare
          </button>
          <button
            onClick={onNew}
            className="rounded-xl bg-ink-900 text-ink-50 px-5 py-3 text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2"
          >
            <FilePlus2 size={16} /> New project
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-ink-100 paper p-5 h-40">
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded mt-3" />
              <div className="skeleton h-3 w-1/3 rounded mt-2" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState onNew={onNew} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p)} onDelete={() => onDelete(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project, onOpen, onDelete,
}: { project: ProjectRecord; onOpen: () => void; onDelete: () => void }) {
  const updated = useMemo(() => new Date(project.updatedAt).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  }), [project.updatedAt]);

  return (
    <div className="paper rounded-2xl border border-ink-100 p-5 hover:border-ink-300 transition-colors group relative">
      <button
        onClick={onOpen}
        className="text-left w-full"
      >
        <div className="flex items-center gap-2 text-xs text-ink-400 mb-2">
          <Lock size={11} /> Encrypted
        </div>
        <div className="serif text-xl text-ink-900 leading-snug pr-8 truncate">{project.name}</div>
        <div className="text-xs text-ink-500 mt-1">Updated {updated}</div>
        <div className="flex items-baseline gap-4 mt-4">
          <div>
            <div className="serif text-2xl text-ink-900">{project.meta.chapterCount}</div>
            <div className="text-[11px] uppercase tracking-widest text-ink-400">chapters</div>
          </div>
          <div>
            <div className="serif text-2xl text-ink-900">{(project.meta.wordCount / 1000).toFixed(1)}k</div>
            <div className="text-[11px] uppercase tracking-widest text-ink-400">words</div>
          </div>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete project"
        className="absolute top-3 right-3 p-1.5 rounded-md text-ink-300 hover:bg-accent/10 hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 paper p-12 text-center">
      <Cpu size={28} className="mx-auto text-ink-300 mb-3" />
      <h3 className="serif text-2xl text-ink-900 mb-2">No projects yet</h3>
      <p className="text-ink-500 max-w-md mx-auto mb-6">
        Upload a .docx manuscript to compute chapter embeddings, an escalation curve, repetition map, and abstraction
        ratios — entirely on your device.
      </p>
      <button
        onClick={onNew}
        className="rounded-xl bg-ink-900 text-ink-50 px-5 py-3 text-sm font-medium hover:bg-accent transition-colors"
      >
        Create your first project
      </button>
    </div>
  );
}

function ProgressOverlay({ progress }: { progress: ProgressState }) {
  const pct = Math.round((progress.progress || 0) * 100);
  return (
    <div className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="paper rounded-2xl border border-ink-100 shadow-paper max-w-md w-full p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </div>
          <h3 className="serif text-lg text-ink-900">{progress.stage}</h3>
        </div>
        <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between text-xs text-ink-500">
          <span>{progress.detail || 'Processing locally'}</span>
          <span className="mono">{pct}%</span>
        </div>
        <p className="mt-4 text-[12px] text-ink-500 leading-relaxed">
          The first time you run an analysis, the embedding and sentiment models are downloaded from
          Hugging Face (about 80&nbsp;MB total) and cached for future use.
        </p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-100 mt-12 py-6 text-center text-xs text-ink-400">
      Built locally · Mammoth.js · Transformers.js · Web Crypto · IndexedDB
    </footer>
  );
}

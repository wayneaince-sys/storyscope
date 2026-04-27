import { useCallback, useRef, useState } from 'react';
import { FileUp, Lock } from 'lucide-react';

interface Props {
  onFile: (file: File, passphrase: string, projectName: string) => void;
  busy?: boolean;
}

export default function Upload({ onFile, busy }: Props) {
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!f.name.toLowerCase().endsWith('.docx')) {
      setErr('Please upload a .docx file. Only Word documents are supported.');
      return;
    }
    setErr(null);
    setFile(f);
    if (!name) setName(f.name.replace(/\.docx$/i, ''));
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    handleFiles(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  const submit = () => {
    setErr(null);
    if (!file) return setErr('Choose a manuscript file first.');
    if (!name.trim()) return setErr('Give the project a name.');
    if (pass.length < 8) return setErr('Use a passphrase of at least 8 characters.');
    if (pass !== pass2) return setErr('Passphrases do not match.');
    onFile(file, pass, name.trim());
  };

  return (
    <div className="paper rounded-2xl border border-ink-100 shadow-paper p-8 max-w-2xl mx-auto">
      <h2 className="serif text-2xl text-ink-900 mb-1">New project</h2>
      <p className="text-ink-500 text-sm mb-6">
        Drop a .docx file, choose a passphrase, and StoryScope will analyze your manuscript entirely in this browser.
      </p>

      <div
        className={`dropzone rounded-xl px-6 py-10 text-center cursor-pointer ${drag ? 'is-dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp className="mx-auto mb-3 text-ink-400" size={28} />
        {file ? (
          <div>
            <div className="serif text-lg text-ink-900">{file.name}</div>
            <div className="text-xs text-ink-500 mt-1">{(file.size / 1024).toFixed(1)} KB · click to replace</div>
          </div>
        ) : (
          <div>
            <div className="text-ink-700 text-sm">Drop a .docx manuscript here, or click to choose</div>
            <div className="text-xs text-ink-400 mt-1">Mammoth.js will parse chapters from headings</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div className="mt-6 grid gap-4">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-ink-500">Project name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-ink-900 focus:border-accent"
            placeholder="The Lighthouse — second pass"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-500 flex items-center gap-1.5">
              <Lock size={11} /> Passphrase
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-ink-900 focus:border-accent mono"
              placeholder="At least 8 characters"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-ink-500">Confirm</span>
            <input
              type="password"
              autoComplete="new-password"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-ink-900 focus:border-accent mono"
              placeholder="Repeat passphrase"
            />
          </label>
        </div>
      </div>

      {err && (
        <div className="mt-4 text-sm rounded-lg border border-accent/30 bg-accent/5 text-accent-deep px-3 py-2">
          {err}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-ink-500 max-w-sm">
          Your passphrase is never stored. It encrypts your manuscript at rest in this browser. We can't recover it for you.
        </p>
        <button
          disabled={busy}
          onClick={submit}
          className="rounded-lg bg-ink-900 text-ink-50 px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {busy ? 'Working…' : 'Create project'}
        </button>
      </div>
    </div>
  );
}

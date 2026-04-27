import { useState } from 'react';
import { Lock } from 'lucide-react';

interface Props {
  projectName: string;
  onSubmit: (passphrase: string) => Promise<void>;
  onCancel: () => void;
}

export default function PassphrasePrompt({ projectName, onSubmit, onCancel }: Props) {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      await onSubmit(pass);
    } catch (e: any) {
      setErr(e?.message || 'Could not unlock project.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 backdrop-blur-sm p-4">
      <div className="paper w-full max-w-md rounded-2xl border border-ink-100 shadow-paper p-6">
        <div className="flex items-center gap-2 text-ink-900 mb-2">
          <Lock size={16} />
          <h3 className="serif text-xl">Unlock project</h3>
        </div>
        <p className="text-sm text-ink-500 mb-4">
          Enter the passphrase for <span className="text-ink-900 serif">{projectName}</span>.
        </p>
        <input
          autoFocus
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 mono"
          placeholder="Passphrase"
        />
        {err && <div className="mt-3 text-sm text-accent-deep">{err}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-ink-600 hover:bg-ink-100"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || pass.length === 0}
            className="rounded-lg bg-ink-900 text-ink-50 px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}

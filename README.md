# StoryScope

A privacy-first manuscript analysis tool that runs entirely in your browser. Upload a `.docx`, encrypt it locally with a passphrase, and get chapter-level metrics: embedding similarity, repetition maps, sentiment escalation curves, abstraction ratios, and paragraph-level rewrite suggestions. Export a typeset PDF revision report or compare two versions of the same manuscript side-by-side.

## How it works

- **Parsing** — `mammoth` converts `.docx` to structured chapters via H1/H2/H3 + "Chapter N" detection.
- **Embeddings** — `Xenova/all-MiniLM-L6-v2` runs in the browser via [`@huggingface/transformers`](https://github.com/huggingface/transformers.js) for chapter and paragraph vectors.
- **Sentiment** — `Xenova/distilbert-base-uncased-finetuned-sst-2-english` for per-paragraph signed sentiment + intensity, aggregated into chapter escalation curves.
- **Repetition** — 3–5gram counter with substring-subsumption to surface meaningful echoes, not boilerplate.
- **Abstraction** — concrete/abstract lexicon ratio per paragraph.
- **Suggestions** — paragraph-level rewrite prompts triggered by echo, abstraction-heavy, or low-tension signals.
- **Storage** — AES-GCM encrypted blobs in IndexedDB, key derived via PBKDF2 (250k iterations) from your passphrase. The passphrase never leaves the device.

## Local development

```bash
npm install
npm run dev   # http://localhost:5173
npm run build # outputs to dist/
```

## Deployment

The repo is configured for **two** deployment targets out of the box:

- **GitHub Pages** — push to `main`; the workflow at `.github/workflows/deploy.yml` builds with `VITE_BASE=/<repo>/` and publishes `dist/` automatically. Enable Pages once in **Settings → Pages → Source: GitHub Actions**.
- **Any static host** — `npm run build` produces a self-contained `dist/` directory. Drop it on Cloudflare Pages, Netlify, S3, or any static server. Default base is `/`.

The `vite.config.ts` reads `VITE_BASE` from the environment, so the same build works on both targets without code changes.

## First-run note

The first analysis after a fresh deploy downloads ~80 MB of model weights from the Hugging Face CDN. They're cached in the browser after that.

## Privacy

- All processing happens in-browser. No manuscript text, embeddings, or analysis ever leaves your device.
- Models are fetched from the public Hugging Face CDN; that request contains no manuscript content.
- IndexedDB blobs are encrypted client-side; losing the passphrase means losing the project.

## Tech

React 18 · Vite · TypeScript · Tailwind v3 · Recharts · jsPDF · `@huggingface/transformers` · Web Crypto + IndexedDB

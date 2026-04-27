// DOCX parsing using Mammoth.js.
// Detects chapters via H1/H2/H3 styles and "Chapter N" patterns.

import mammoth from 'mammoth';
import type { Chapter, Manuscript, Paragraph } from './types';

const CHAPTER_RE = /^\s*(chapter|prologue|epilogue|part)\b[:\s\-—]*([ivxlcdm0-9]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)?[\s:.\-—]*(.*)$/i;

interface RawBlock {
  kind: 'heading' | 'paragraph';
  level?: number;
  text: string;
}

function htmlToBlocks(html: string): RawBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: RawBlock[] = [];
  doc.body.querySelectorAll('h1,h2,h3,h4,p').forEach((el) => {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (el.tagName.startsWith('H')) {
      blocks.push({ kind: 'heading', level: parseInt(el.tagName.slice(1)), text });
    } else {
      blocks.push({ kind: 'paragraph', text });
    }
  });
  return blocks;
}

function looksLikeChapterHeading(text: string): boolean {
  if (text.length > 120) return false;
  if (CHAPTER_RE.test(text)) return true;
  // ALL CAPS short line, often a chapter title
  if (text.length < 80 && text === text.toUpperCase() && /[A-Z]/.test(text)) return true;
  return false;
}

function countWords(s: string): number {
  return (s.match(/\b[\w'-]+\b/g) || []).length;
}

export async function parseDocx(file: File): Promise<Manuscript> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
  const blocks = htmlToBlocks(html);

  const chapters: Chapter[] = [];
  let current: Chapter | null = null;
  let pIdx = 0;

  const pushPara = (text: string) => {
    if (!current) {
      current = {
        id: crypto.randomUUID(),
        index: 0,
        title: 'Opening',
        paragraphs: [],
        text: '',
        wordCount: 0,
      };
      chapters.push(current);
    }
    const p: Paragraph = {
      id: `p_${pIdx++}`,
      text,
      chapterId: current.id,
    };
    current.paragraphs.push(p);
  };

  for (const block of blocks) {
    if (
      block.kind === 'heading' && (block.level ?? 99) <= 3 ||
      (block.kind === 'paragraph' && looksLikeChapterHeading(block.text) && block.text.length < 80)
    ) {
      // start a new chapter
      current = {
        id: crypto.randomUUID(),
        index: chapters.length,
        title: block.text,
        paragraphs: [],
        text: '',
        wordCount: 0,
      };
      chapters.push(current);
    } else if (block.kind === 'paragraph') {
      pushPara(block.text);
    }
  }

  // Finalize each chapter
  for (const ch of chapters) {
    ch.text = ch.paragraphs.map((p) => p.text).join('\n\n');
    ch.wordCount = countWords(ch.text);
  }

  // Drop empty chapters (e.g. headings followed by no body)
  const filtered = chapters.filter((c) => c.paragraphs.length > 0);
  filtered.forEach((c, i) => (c.index = i));

  // If still nothing, create one chapter from the whole doc
  if (filtered.length === 0 && blocks.length > 0) {
    const text = blocks.map((b) => b.text).join('\n\n');
    const ch: Chapter = {
      id: crypto.randomUUID(),
      index: 0,
      title: 'Manuscript',
      paragraphs: blocks.map((b, i) => ({
        id: `p_${i}`,
        text: b.text,
        chapterId: '',
      })),
      text,
      wordCount: countWords(text),
    };
    ch.paragraphs.forEach((p) => (p.chapterId = ch.id));
    filtered.push(ch);
  }

  return {
    title: file.name.replace(/\.docx$/i, ''),
    importedAt: Date.now(),
    chapters: filtered,
  };
}

// Generate a typeset PDF revision report from a project's suggestions.
// Layout-focused: cover page + per-chapter sections + paragraph cards with rewrite prompts.

import jsPDF from 'jspdf';
import type { ProjectPayload, AnalysisResults, SuggestionEntry } from './types';

interface PageCtx {
  doc: jsPDF;
  pageW: number;
  pageH: number;
  margin: { top: number; right: number; bottom: number; left: number };
  y: number;
  pageNum: number;
  projectName: string;
}

// jsPDF's default helvetica/times fonts are WinAnsi-encoded and don't contain
// glyphs for typographic punctuation (curly quotes, em/en dash, ellipsis,
// non-breaking space). Passing those characters falls through to a UTF-16
// rendering path that produces letter-spaced gibberish in the output. Map them
// to their ASCII equivalents before drawing.
function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2022\u00b7]/g, '\u00b7') // bullet -> middle dot (in WinAnsi)
    .replace(/[\u2192\u2794\u27a4]/g, '->')
    // Strip remaining characters outside the basic Latin-1 / WinAnsi range to
    // avoid the UTF-16 fallback path. Anything in 0x20..0xff is fine; replace
    // the rest with '?'.
    .replace(/[^\u0009\u000a\u000d\u0020-\u00ff]/g, '?');
}

const COLORS = {
  ink: '#15120e',
  ink600: '#5e533c',
  ink400: '#998a68',
  ink200: '#d6cfbd',
  ink100: '#ebe7dc',
  paper: '#fdfbf6',
  accent: '#c2410c',
  accentSoft: '#fb923c',
};

function newPage(ctx: PageCtx, isCover = false) {
  if (ctx.pageNum > 0) ctx.doc.addPage();
  ctx.pageNum += 1;
  ctx.y = ctx.margin.top;
  if (!isCover) drawRunningHeader(ctx);
  drawFooter(ctx);
}

function drawRunningHeader(ctx: PageCtx) {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(COLORS.ink400);
  ctx.doc.text('STORYSCOPE · REVISION REPORT', ctx.margin.left, ctx.margin.top - 14);
  const right = `${ctx.projectName}`;
  const tw = ctx.doc.getTextWidth(right);
  ctx.doc.text(right, ctx.pageW - ctx.margin.right - tw, ctx.margin.top - 14);
  ctx.doc.setDrawColor(COLORS.ink100);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin.left, ctx.margin.top - 8, ctx.pageW - ctx.margin.right, ctx.margin.top - 8);
}

function drawFooter(ctx: PageCtx) {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(COLORS.ink400);
  const text = `Page ${ctx.pageNum}`;
  const tw = ctx.doc.getTextWidth(text);
  ctx.doc.text(text, ctx.pageW - ctx.margin.right - tw, ctx.pageH - ctx.margin.bottom + 18);
}

function ensureSpace(ctx: PageCtx, needed: number) {
  if (ctx.y + needed > ctx.pageH - ctx.margin.bottom) {
    newPage(ctx);
  }
}

function setBody(ctx: PageCtx) {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(10.5);
  ctx.doc.setTextColor(COLORS.ink);
}

function drawWrappedText(
  ctx: PageCtx,
  text: string,
  opts: { font?: 'normal' | 'bold' | 'italic'; size?: number; color?: string; lineHeight?: number; indent?: number } = {}
) {
  const { font = 'normal', size = 10.5, color = COLORS.ink, lineHeight = 1.45, indent = 0 } = opts;
  ctx.doc.setFont('helvetica', font);
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(color);
  const maxW = ctx.pageW - ctx.margin.left - ctx.margin.right - indent;
  const lines = ctx.doc.splitTextToSize(text, maxW) as string[];
  for (const line of lines) {
    ensureSpace(ctx, size * lineHeight);
    ctx.doc.text(line, ctx.margin.left + indent, ctx.y + size);
    ctx.y += size * lineHeight;
  }
}

function hLine(ctx: PageCtx, color = COLORS.ink100) {
  ctx.doc.setDrawColor(color);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin.left, ctx.y, ctx.pageW - ctx.margin.right, ctx.y);
}

function drawCover(ctx: PageCtx, payload: ProjectPayload, analysis: AnalysisResults) {
  newPage(ctx, true);

  // Mark
  ctx.doc.setDrawColor(COLORS.accent);
  ctx.doc.setLineWidth(1.2);
  ctx.doc.circle(ctx.margin.left + 16, ctx.margin.top + 16, 14, 'S');
  ctx.doc.line(ctx.margin.left + 28, ctx.margin.top + 28, ctx.margin.left + 44, ctx.margin.top + 44);

  // Eyebrow
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(COLORS.ink400);
  ctx.doc.text('STORYSCOPE · REVISION REPORT', ctx.margin.left, ctx.margin.top + 80);

  // Title
  ctx.doc.setFont('times', 'normal');
  ctx.doc.setFontSize(36);
  ctx.doc.setTextColor(COLORS.ink);
  ctx.y = ctx.margin.top + 110;
  const titleLines = ctx.doc.splitTextToSize(sanitize(ctx.projectName || payload.manuscript.title), ctx.pageW - ctx.margin.left - ctx.margin.right) as string[];
  for (const line of titleLines.slice(0, 3)) {
    ctx.doc.text(line, ctx.margin.left, ctx.y + 28);
    ctx.y += 38;
  }

  // Subtitle
  ctx.doc.setFont('times', 'italic');
  ctx.doc.setFontSize(14);
  ctx.doc.setTextColor(COLORS.ink600);
  ctx.doc.text('A focused list of revision opportunities', ctx.margin.left, ctx.y + 14);
  ctx.y += 40;

  // Stat cards
  const totalWords = payload.manuscript.chapters.reduce((s, c) => s + c.wordCount, 0);
  const sCounts = {
    echo: analysis.suggestions.filter((s) => s.reason === 'echo').length,
    abs: analysis.suggestions.filter((s) => s.reason === 'abstract-heavy').length,
    low: analysis.suggestions.filter((s) => s.reason === 'low-tension').length,
  };
  const stats = [
    { k: 'Chapters', v: payload.manuscript.chapters.length.toLocaleString() },
    { k: 'Words', v: totalWords.toLocaleString() },
    { k: 'Suggestions', v: analysis.suggestions.length.toLocaleString() },
    { k: 'Repeated phrases', v: analysis.repetitions.length.toLocaleString() },
  ];
  const cardW = (ctx.pageW - ctx.margin.left - ctx.margin.right - 24) / 2;
  const cardH = 56;
  let cx = ctx.margin.left;
  let cy = ctx.y + 30;
  stats.forEach((s, i) => {
    if (i === 2) { cx = ctx.margin.left; cy += cardH + 12; }
    ctx.doc.setDrawColor(COLORS.ink100);
    ctx.doc.setFillColor(253, 251, 246);
    ctx.doc.roundedRect(cx, cy, cardW, cardH, 6, 6, 'FD');
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(COLORS.ink400);
    ctx.doc.text(s.k.toUpperCase(), cx + 14, cy + 18);
    ctx.doc.setFont('times', 'normal');
    ctx.doc.setFontSize(22);
    ctx.doc.setTextColor(COLORS.ink);
    ctx.doc.text(s.v, cx + 14, cy + 42);
    cx += cardW + 24;
  });
  ctx.y = cy + cardH + 20;

  // Breakdown
  ctx.y += 20;
  drawWrappedText(ctx, 'Suggestion mix', { font: 'bold', size: 11, color: COLORS.ink });
  ctx.y += 4;
  drawWrappedText(ctx, `Echoes: ${sCounts.echo}    ·    Abstraction-heavy: ${sCounts.abs}    ·    Low tension: ${sCounts.low}`,
    { color: COLORS.ink600, size: 10 });

  // Generated
  ctx.y = ctx.pageH - ctx.margin.bottom - 56;
  ctx.doc.setDrawColor(COLORS.ink100);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin.left, ctx.y, ctx.pageW - ctx.margin.right, ctx.y);
  ctx.y += 14;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(COLORS.ink400);
  ctx.doc.text(
    `Generated ${new Date(analysis.computedAt).toLocaleString()} · Models: ${analysis.modelInfo.embedModel} + ${analysis.modelInfo.sentimentModel}`,
    ctx.margin.left, ctx.y + 10
  );
}

function reasonAccent(reason: SuggestionEntry['reason']): string {
  switch (reason) {
    case 'echo': return '#7c2d12';
    case 'abstract-heavy': return '#c2410c';
    case 'low-tension': return '#5e533c';
    case 'redundant': return '#7d6f4f';
  }
}

function drawSuggestionCard(
  ctx: PageCtx,
  s: SuggestionEntry,
  paragraphText: string,
  index: number
) {
  // Estimate height needed and page-break before drawing
  ctx.doc.setFontSize(10.5);
  const cardW = ctx.pageW - ctx.margin.left - ctx.margin.right;
  const innerW = cardW - 24;
  const paraLines = ctx.doc.splitTextToSize(paragraphText, innerW) as string[];
  const detailLines = ctx.doc.splitTextToSize(s.detail, innerW) as string[];
  const altLines = s.alternatives.flatMap((a) =>
    ctx.doc.splitTextToSize('• ' + a, innerW - 12) as string[]
  );
  const estH =
    32 + // header
    paraLines.length * 13 + 18 +
    detailLines.length * 13 + 16 +
    altLines.length * 13 + 24;

  ensureSpace(ctx, estH);

  const top = ctx.y;
  const accent = reasonAccent(s.reason);

  // Card frame
  ctx.doc.setDrawColor(COLORS.ink100);
  ctx.doc.setFillColor(253, 251, 246);
  ctx.doc.roundedRect(ctx.margin.left, top, cardW, estH, 6, 6, 'FD');

  // Accent bar
  ctx.doc.setFillColor(accent);
  ctx.doc.rect(ctx.margin.left, top, 3, estH, 'F');

  // Index + label
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(accent);
  ctx.doc.text(`#${index}  ·  ${s.reasonLabel.toUpperCase()}`, ctx.margin.left + 12, top + 16);
  // Score on right
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setTextColor(COLORS.ink400);
  const scoreText = `score ${s.score.toFixed(2)}`;
  const sw = ctx.doc.getTextWidth(scoreText);
  ctx.doc.text(scoreText, ctx.margin.left + cardW - 12 - sw, top + 16);

  // Original paragraph (serif italic)
  ctx.y = top + 28;
  ctx.doc.setFont('times', 'italic');
  ctx.doc.setFontSize(10.5);
  ctx.doc.setTextColor(COLORS.ink);
  for (const line of paraLines) {
    ctx.doc.text(line, ctx.margin.left + 12, ctx.y + 10);
    ctx.y += 13;
  }
  ctx.y += 6;

  // Why
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(COLORS.ink400);
  ctx.doc.text('WHY FLAGGED', ctx.margin.left + 12, ctx.y + 8);
  ctx.y += 14;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(COLORS.ink600);
  for (const line of detailLines) {
    ctx.doc.text(line, ctx.margin.left + 12, ctx.y + 8);
    ctx.y += 13;
  }
  ctx.y += 6;

  // Try
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(COLORS.ink400);
  ctx.doc.text('TRY ONE OF THESE', ctx.margin.left + 12, ctx.y + 8);
  ctx.y += 14;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(COLORS.ink);
  for (const line of altLines) {
    ctx.doc.text(line, ctx.margin.left + 18, ctx.y + 8);
    ctx.y += 13;
  }

  // Reset y to bottom of card (with a small gap)
  ctx.y = top + estH + 12;
}

export async function exportSuggestionsPDF(payload: ProjectPayload, projectName: string): Promise<Blob> {
  const analysis = payload.analysis!;
  const doc = new jsPDF({ unit: 'pt', format: 'letter', compress: true });

  // Sanitize all text drawn through doc.text() / doc.splitTextToSize().
  // jsPDF's default fonts are WinAnsi-encoded; non-Latin1 chars trigger a
  // broken UTF-16 fallback. We sanitize once here so every helper benefits.
  const origText = (doc.text as any).bind(doc);
  // jsPDF.text accepts many overloads; we only need to sanitize string args.
  (doc as any).text = (text: any, ...rest: any[]) => {
    if (typeof text === 'string') return origText(sanitize(text), ...rest);
    if (Array.isArray(text)) return origText(text.map((t: any) => (typeof t === 'string' ? sanitize(t) : t)), ...rest);
    return origText(text, ...rest);
  };
  const origSplit = (doc.splitTextToSize as any).bind(doc);
  (doc as any).splitTextToSize = (text: any, ...rest: any[]) => {
    if (typeof text === 'string') return origSplit(sanitize(text), ...rest);
    return origSplit(text, ...rest);
  };
  const origGetTextWidth = (doc.getTextWidth as any).bind(doc);
  (doc as any).getTextWidth = (text: any) => {
    return origGetTextWidth(typeof text === 'string' ? sanitize(text) : text);
  };
  const ctx: PageCtx = {
    doc,
    pageW: doc.internal.pageSize.getWidth(),
    pageH: doc.internal.pageSize.getHeight(),
    margin: { top: 64, right: 56, bottom: 56, left: 56 },
    y: 0,
    pageNum: 0,
    projectName,
  };

  // Cover
  drawCover(ctx, payload, analysis);

  // Build paragraph map
  const paraMap = new Map<string, { text: string; chapterId: string; chapterIndex: number; chapterTitle: string }>();
  payload.manuscript.chapters.forEach((c) => {
    c.paragraphs.forEach((p) => paraMap.set(p.id, {
      text: p.text, chapterId: c.id, chapterIndex: c.index, chapterTitle: c.title,
    }));
  });

  // Group suggestions by chapter
  const byChapter = new Map<string, SuggestionEntry[]>();
  for (const s of analysis.suggestions) {
    if (!byChapter.has(s.chapterId)) byChapter.set(s.chapterId, []);
    byChapter.get(s.chapterId)!.push(s);
  }

  // Sort chapters by index, then run through them
  const chaptersOrdered = [...payload.manuscript.chapters].sort((a, b) => a.index - b.index);

  if (analysis.suggestions.length === 0) {
    newPage(ctx);
    drawWrappedText(ctx, 'No suggestions', { font: 'bold', size: 18 });
    ctx.y += 8;
    drawWrappedText(ctx, 'StoryScope did not flag any paragraphs above the suggestion thresholds. Your prose is holding up.',
      { color: COLORS.ink600, size: 11 });
  } else {
    let counter = 0;
    for (const ch of chaptersOrdered) {
      const items = byChapter.get(ch.id);
      if (!items || items.length === 0) continue;

      // Chapter heading
      newPage(ctx);
      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(8);
      ctx.doc.setTextColor(COLORS.ink400);
      ctx.doc.text(`CHAPTER ${ch.index + 1}`, ctx.margin.left, ctx.y + 10);
      ctx.y += 18;
      ctx.doc.setFont('times', 'normal');
      ctx.doc.setFontSize(22);
      ctx.doc.setTextColor(COLORS.ink);
      const titleLines = ctx.doc.splitTextToSize(ch.title || `Chapter ${ch.index + 1}`, ctx.pageW - ctx.margin.left - ctx.margin.right) as string[];
      for (const line of titleLines.slice(0, 2)) {
        ctx.doc.text(line, ctx.margin.left, ctx.y + 22);
        ctx.y += 28;
      }
      // Chapter meta line
      ctx.doc.setFont('helvetica', 'normal');
      ctx.doc.setFontSize(9);
      ctx.doc.setTextColor(COLORS.ink600);
      const esc = analysis.escalation.find((e) => e.chapterId === ch.id);
      const abs = analysis.abstraction.find((a) => a.chapterId === ch.id);
      const meta = [
        `${ch.wordCount.toLocaleString()} words`,
        esc ? `sentiment ${esc.sentiment >= 0 ? '+' : ''}${esc.sentiment.toFixed(2)}` : '',
        abs ? `abstraction ${(abs.ratio * 100).toFixed(0)}%` : '',
        `${items.length} suggestion${items.length === 1 ? '' : 's'}`,
      ].filter(Boolean).join('  ·  ');
      ctx.doc.text(meta, ctx.margin.left, ctx.y + 10);
      ctx.y += 22;
      hLine(ctx, COLORS.ink200);
      ctx.y += 16;

      // Sort suggestions by score desc
      const sorted = [...items].sort((a, b) => b.score - a.score);
      for (const s of sorted) {
        counter += 1;
        const para = paraMap.get(s.paragraphId);
        drawSuggestionCard(ctx, s, para?.text || '', counter);
      }
    }
  }

  // Repetitions appendix
  if (analysis.repetitions.length > 0) {
    newPage(ctx);
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(8);
    ctx.doc.setTextColor(COLORS.ink400);
    ctx.doc.text('APPENDIX', ctx.margin.left, ctx.y + 10);
    ctx.y += 18;
    ctx.doc.setFont('times', 'normal');
    ctx.doc.setFontSize(22);
    ctx.doc.setTextColor(COLORS.ink);
    ctx.doc.text('Repeated phrases', ctx.margin.left, ctx.y + 22);
    ctx.y += 32;
    setBody(ctx);
    drawWrappedText(ctx, `Phrases of 3 to 5 content words used 3 or more times across the manuscript.`,
      { color: COLORS.ink600, size: 10 });
    ctx.y += 8;
    hLine(ctx, COLORS.ink200);
    ctx.y += 14;

    for (const r of analysis.repetitions.slice(0, 40)) {
      ensureSpace(ctx, 22);
      ctx.doc.setFont('times', 'italic');
      ctx.doc.setFontSize(11);
      ctx.doc.setTextColor(COLORS.ink);
      const phraseW = ctx.pageW - ctx.margin.left - ctx.margin.right - 60;
      const lines = ctx.doc.splitTextToSize(`"${r.phrase}"`, phraseW) as string[];
      for (let i = 0; i < lines.length; i++) {
        ctx.doc.text(lines[i], ctx.margin.left, ctx.y + 12);
        if (i === 0) {
          ctx.doc.setFont('helvetica', 'normal');
          ctx.doc.setFontSize(10);
          ctx.doc.setTextColor(COLORS.ink400);
          const cnt = `${r.count}\u00d7`;
          const cw = ctx.doc.getTextWidth(cnt);
          ctx.doc.text(cnt, ctx.pageW - ctx.margin.right - cw, ctx.y + 12);
        }
        ctx.y += 14;
      }
      ctx.y += 4;
    }
  }

  return doc.output('blob');
}

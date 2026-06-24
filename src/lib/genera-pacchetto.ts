/**
 * Genera, lato client, un PDF unico per il referente:
 *   contrattino (se presente) → pagina "Allegati" → schede soci → regolamento → statuto
 * e ne avvia il download. pdf-lib è importato dinamicamente (solo al click).
 *
 * La logica pura di mappatura dei campi socio sta in ./socio-pdf (testata in unità).
 */
import type { PDFDocument, PDFFont, PDFPage, RGB } from 'pdf-lib';
import { buildSocioFields, buildSocioTitle, type SocioRecord } from './socio-pdf';

const CONTRATTINO_URL = '/contrattino.pdf';
const REGOLAMENTO_URL = '/regolamento.pdf';
const STATUTO_URL = '/statuto.pdf';

// A4 in punti
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

const CARD_HEIGHT = 150;
const CARD_GAP = 18;

/**
 * Rende il testo sicuro per il font standard Helvetica (codifica WinAnsi/CP1252):
 * mantiene ASCII, accenti latini e la punteggiatura CP1252; sostituisce il resto con "?".
 */
function safe(text: string): string {
  return text.replace(
    /[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF€‘’“”–—…•]/g,
    '?'
  );
}

/** Tronca un testo perché stia entro maxWidth alla dimensione data. */
function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

/** Scarica un PDF (esistente) da `url` e ne copia tutte le pagine nel documento. */
async function appendExternalPdf(pdf: PDFDocument, url: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return false;
  }
  if (!res.ok) return false;
  const bytes = await res.arrayBuffer();
  const { PDFDocument: PDFDoc } = await import('pdf-lib');
  const src = await PDFDoc.load(bytes);
  const pages = await pdf.copyPages(src, src.getPageIndices());
  pages.forEach((p) => pdf.addPage(p));
  return true;
}

function addSeparatorPage(
  pdf: PDFDocument,
  font: PDFFont,
  fontBold: PDFFont,
  gray: RGB,
  title: string,
  lines: string[]
): void {
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 200;
  page.drawText(safe(title), { x: MARGIN, y, size: 24, font: fontBold });
  y -= 40;
  for (const line of lines) {
    page.drawText(safe(line), { x: MARGIN, y, size: 12, font });
    y -= 20;
  }
  page.drawText(
    safe('Documento riservato — contiene dati personali, da trattare ai sensi del GDPR.'),
    { x: MARGIN, y: MARGIN, size: 8, font, color: gray }
  );
}

function drawCard(
  page: PDFPage,
  socio: SocioRecord,
  yTop: number,
  font: PDFFont,
  fontBold: PDFFont,
  gray: RGB
): void {
  page.drawText(truncate(buildSocioTitle(socio), fontBold, 11, CONTENT_W), {
    x: MARGIN,
    y: yTop,
    size: 11,
    font: fontBold,
  });
  let y = yTop - 14;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + CONTENT_W, y },
    thickness: 0.5,
    color: gray,
  });
  y -= 14;

  const fields = buildSocioFields(socio);
  const colW = CONTENT_W / 2;
  const rowH = 22;
  fields.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const fx = MARGIN + col * colW;
    const fy = y - row * rowH;
    page.drawText(safe(f.label.toUpperCase()), { x: fx, y: fy, size: 6.5, font: fontBold, color: gray });
    page.drawText(truncate(f.value, font, 9, colW - 12), { x: fx, y: fy - 10, size: 9, font });
  });
}

function drawSociPages(
  pdf: PDFDocument,
  soci: SocioRecord[],
  font: PDFFont,
  fontBold: PDFFont,
  gray: RGB
): void {
  const topStart = PAGE_H - MARGIN;
  const perPage = Math.max(1, Math.floor((PAGE_H - MARGIN * 2 + CARD_GAP) / (CARD_HEIGHT + CARD_GAP)));

  if (soci.length === 0) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    page.drawText('Nessun socio iscritto.', { x: MARGIN, y: topStart - 20, size: 12, font });
    return;
  }

  let page: PDFPage | null = null;
  let indexInPage = 0;
  soci.forEach((socio, i) => {
    if (i % perPage === 0) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      indexInPage = 0;
    }
    const yTop = topStart - indexInPage * (CARD_HEIGHT + CARD_GAP);
    drawCard(page as PDFPage, socio, yTop, font, fontBold, gray);
    indexInPage++;
  });
}

/** Recupera i soci del referente, costruisce il PDF unico e ne avvia il download. */
export async function generaPacchettoDocumenti(): Promise<void> {
  const res = await fetch('/api/account/data');
  if (!res.ok) throw new Error('Impossibile recuperare i dati dei soci');
  const data = await res.json();
  const soci: SocioRecord[] = ((data.soci ?? []) as SocioRecord[])
    .slice()
    .sort((a, b) => (a.numero_socio ?? 0) - (b.numero_socio ?? 0));

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gray = rgb(0.45, 0.45, 0.45);

  // (a) Contrattino in testa (saltato se non ancora caricato)
  await appendExternalPdf(pdf, CONTRATTINO_URL);

  // (b) Pagina separatrice "Allegati"
  addSeparatorPage(pdf, font, fontBold, gray, 'Allegati', [
    'A. Schede dei soci iscritti',
    'B. Regolamento del rifugio',
    'C. Statuto dell’associazione',
  ]);

  // (c) Schede soci
  drawSociPages(pdf, soci, font, fontBold, gray);

  // (d) Regolamento e (e) Statuto
  await appendExternalPdf(pdf, REGOLAMENTO_URL);
  await appendExternalPdf(pdf, STATUTO_URL);

  const bytes = await pdf.save();
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rifugio-rosmini-documenti.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

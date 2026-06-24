/**
 * Genera, lato client, un PDF con le sole schede anagrafiche dei soci e ne avvia il download.
 * Nessun merge con documenti esterni. pdf-lib è importato dinamicamente (solo al click).
 *
 * Separa i dati dalla resa: la funzione riceve già l'elenco soci, così è riusata sia dal
 * referente (i propri soci) sia dall'admin (i soci di un dato referente).
 * La logica pura di mappatura dei campi sta in ./socio-pdf (testata in unità).
 */
import type { PDFDocument, PDFFont, PDFPage, RGB } from 'pdf-lib';
import { buildSocioFields, buildSocioTitle, type SocioRecord } from './socio-pdf';

// A4 in punti
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

const HEADER_H = 56;
const CARD_HEIGHT = 150;
const CARD_GAP = 18;

const GDPR_NOTE = 'Documento riservato — contiene dati personali, da trattare ai sensi del GDPR.';

export interface GeneraSociPdfOptions {
  titolo?: string;
  sottotitolo?: string;
  filename: string;
}

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

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  gray: RGB,
  titolo: string,
  sottotitolo: string | undefined,
  dateStr: string
): void {
  const topY = PAGE_H - MARGIN;
  page.drawText(truncate(titolo, fontBold, 16, CONTENT_W - 140), { x: MARGIN, y: topY - 4, size: 16, font: fontBold });

  const dateLabel = `Generato il ${dateStr}`;
  const dw = font.widthOfTextAtSize(safe(dateLabel), 8);
  page.drawText(safe(dateLabel), { x: PAGE_W - MARGIN - dw, y: topY - 4, size: 8, font, color: gray });

  if (sottotitolo) {
    page.drawText(truncate(sottotitolo, font, 10, CONTENT_W), { x: MARGIN, y: topY - 22, size: 10, font, color: gray });
  }

  const lineY = PAGE_H - MARGIN - HEADER_H + 12;
  page.drawLine({
    start: { x: MARGIN, y: lineY },
    end: { x: MARGIN + CONTENT_W, y: lineY },
    thickness: 0.5,
    color: gray,
  });
}

function drawFooter(page: PDFPage, font: PDFFont, gray: RGB): void {
  page.drawText(safe(GDPR_NOTE), { x: MARGIN, y: 30, size: 8, font, color: gray });
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

/** Costruisce il PDF delle schede soci (solo soci) e ne avvia il download. */
export async function generaSociPdf(soci: SocioRecord[], options: GeneraSociPdfOptions): Promise<void> {
  const list = soci
    .slice()
    .sort((a, b) => (a.numero_socio ?? 0) - (b.numero_socio ?? 0));

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const gray = rgb(0.45, 0.45, 0.45);

  const titolo = options.titolo ?? 'Elenco soci';
  const dateStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });

  const cardsTop = PAGE_H - MARGIN - HEADER_H;
  const cardsBottom = MARGIN + 16;
  const perPage = Math.max(1, Math.floor((cardsTop - cardsBottom + CARD_GAP) / (CARD_HEIGHT + CARD_GAP)));

  const newPage = (): PDFPage => {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    drawHeader(page, font, fontBold, gray, titolo, options.sottotitolo, dateStr);
    drawFooter(page, font, gray);
    return page;
  };

  if (list.length === 0) {
    const page = newPage();
    page.drawText('Nessun socio iscritto.', { x: MARGIN, y: cardsTop - 20, size: 12, font });
  } else {
    let page: PDFPage | null = null;
    let indexInPage = 0;
    list.forEach((socio, i) => {
      if (i % perPage === 0) {
        page = newPage();
        indexInPage = 0;
      }
      const yTop = cardsTop - indexInPage * (CARD_HEIGHT + CARD_GAP);
      drawCard(page as PDFPage, socio, yTop, font, fontBold, gray);
      indexInPage++;
    });
  }

  const bytes = await pdf.save();
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = options.filename;
  a.click();
  URL.revokeObjectURL(url);
}

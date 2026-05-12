import { useState } from 'react';
import { FileDown, Loader2, QrCode } from 'lucide-react';
import { useGetStationsQuery, useGetOperatorsQuery } from '../store';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

const A4_W = 210;
const A4_H = 297;
const MARGIN = 10;
const GUTTER = 6;
const COLS = 2;
const ROWS = 4;
const PER_PAGE = COLS * ROWS;
const CELL_W = (A4_W - 2 * MARGIN - (COLS - 1) * GUTTER) / COLS;
const CELL_H = (A4_H - 2 * MARGIN - (ROWS - 1) * GUTTER) / ROWS;
const QR_SIZE = 40;
const CROP_LEN = 5;
const CROP_GAP = 2;

interface FocusItem {
  kind: 'station' | 'operator';
  id: string;
  label: string;
}

function drawCropMarks(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.1);
  const g = CROP_GAP;
  const l = CROP_LEN;

  doc.line(x - g - l, y, x - g, y);
  doc.line(x, y - g - l, x, y - g);

  doc.line(x + w + g, y, x + w + g + l, y);
  doc.line(x + w, y - g - l, x + w, y - g);

  doc.line(x - g - l, y + h, x - g, y + h);
  doc.line(x, y + h + g, x, y + h + g + l);

  doc.line(x + w + g, y + h, x + w + g + l, y + h);
  doc.line(x + w, y + h + g, x + w, y + h + g + l);
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

async function generatePdf(items: FocusItem[]) {
  const origin = window.location.origin;

  const qrDataUrls = await Promise.all(
    items.map((item) =>
      QRCode.toDataURL(`${origin}/focus/${item.kind}/${item.id}`, {
        width: 512,
        margin: 1,
        errorCorrectionLevel: 'M',
      }),
    ),
  );

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const totalPages = Math.ceil(items.length / PER_PAGE);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();

    const start = page * PER_PAGE;
    const pageItems = items.slice(start, start + PER_PAGE);

    for (let idx = 0; idx < pageItems.length; idx++) {
      const item = pageItems[idx];
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = MARGIN + col * (CELL_W + GUTTER);
      const y = MARGIN + row * (CELL_H + GUTTER);

      drawCropMarks(doc, x, y, CELL_W, CELL_H);

      doc.setDrawColor(0);
      doc.setLineWidth(0.4);
      doc.rect(x, y, CELL_W, CELL_H);

      const qrX = x + (CELL_W - QR_SIZE) / 2;
      const qrY = y + 4;
      doc.addImage(qrDataUrls[start + idx], 'PNG', qrX, qrY, QR_SIZE, QR_SIZE);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(140);
      doc.text(
        item.kind === 'station' ? 'STATION' : 'OPERATEUR',
        x + CELL_W / 2,
        y + QR_SIZE + 9,
        { align: 'center' },
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0);
      const label = truncateText(doc, item.label, CELL_W - 8);
      doc.text(label, x + CELL_W / 2, y + QR_SIZE + 15, { align: 'center' });
    }

    if (totalPages > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(160);
      doc.text(`${page + 1} / ${totalPages}`, A4_W / 2, A4_H - 4, {
        align: 'center',
      });
    }
  }

  doc.save('qr-codes-plannings-focus.pdf');
}

export function QrCodesFocusPage() {
  const { data: stations, isLoading: stationsLoading } = useGetStationsQuery();
  const { data: operators, isLoading: operatorsLoading } = useGetOperatorsQuery();
  const [generating, setGenerating] = useState(false);

  const isLoading = stationsLoading || operatorsLoading;

  const items: FocusItem[] = [
    ...(stations ?? [])
      .slice()
      .sort(
        (a, b) =>
          a.displayOrder - b.displayOrder || a.name.localeCompare(b.name),
      )
      .map((s) => ({ kind: 'station' as const, id: s.id, label: s.name })),
    ...(operators ?? [])
      .slice()
      .sort(
        (a, b) =>
          a.lastName.localeCompare(b.lastName) ||
          a.firstName.localeCompare(b.firstName),
      )
      .map((o) => ({
        kind: 'operator' as const,
        id: o.id,
        label: `${o.firstName} ${o.lastName}`,
      })),
  ];

  const handleGenerate = async () => {
    if (items.length === 0) return;
    setGenerating(true);
    try {
      await generatePdf(items);
    } finally {
      setGenerating(false);
    }
  };

  const pageCount = Math.ceil(items.length / PER_PAGE);

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <QrCode className="w-6 h-6 text-flux-text-secondary" />
        <h1 className="text-xl font-semibold text-white">
          QR codes plannings focus
        </h1>
      </div>

      <p className="text-sm text-flux-text-secondary mb-6 leading-relaxed">
        Planche PDF de QR codes pointant vers les plannings focus de chaque
        station et operateur. Format A4, 8 poses par page, avec traits de
        coupe.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-flux-text-secondary text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement...
        </div>
      ) : (
        <>
          <button
            onClick={handleGenerate}
            disabled={generating || items.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            {generating ? 'Generation...' : 'Generer le PDF'}
          </button>

          <p className="mt-4 text-xs text-flux-text-tertiary">
            {stations?.length ?? 0} station
            {(stations?.length ?? 0) > 1 ? 's' : ''}
            {' · '}
            {operators?.length ?? 0} operateur
            {(operators?.length ?? 0) > 1 ? 's' : ''}
            {' · '}
            {pageCount} page{pageCount > 1 ? 's' : ''} A4
          </p>
        </>
      )}
    </div>
  );
}

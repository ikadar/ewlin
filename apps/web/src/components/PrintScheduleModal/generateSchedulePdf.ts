import jsPDF from 'jspdf';
import type { ScheduleSnapshot, TaskAssignment } from '@flux/types';

export interface PrintOptions {
  snapshot: ScheduleSnapshot;
  from: Date;
  to: Date;
  includeStations: boolean;
  includeOperators: boolean;
}

// A4 landscape
const PAGE_W = 297;
const PAGE_H = 210;
const MARGIN = 12;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const ROW_H = 7.5;
const FOOTER_ZONE = 10;
const COLOR_STRIP_W = 2.5;

// Column widths — order: début, fin, durée, référence, description, extra, début réel, fin réelle
const COL_START = 15;
const COL_END = 15;
const COL_DURATION = 14;
const COL_REF = 26;
const COL_EXTRA = 30;
const COL_REAL_START = 24;
const COL_REAL_END = 24;
const COL_DESC = CONTENT_W - COLOR_STRIP_W - COL_START - COL_END - COL_DURATION - COL_REF - COL_EXTRA - COL_REAL_START - COL_REAL_END;

interface PageDef {
  title: string;
  kind: 'station' | 'operator';
  subtitle?: string;
  assignments: TaskAssignment[];
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return [150, 150, 150];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function pastelify(rgb: [number, number, number], strength = 0.35): [number, number, number] {
  return rgb.map(c => Math.round(c + (255 - c) * (1 - strength))) as [number, number, number];
}

function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function fmtDay(d: Date): string {
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtDateTime(d: Date): string {
  return `${fmtDateShort(d)} ${fmtTime(d)}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

function drawDottedLine(doc: jsPDF, x1: number, y: number, x2: number) {
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([1.2, 1.5], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

function drawFooter(doc: jsPDF, from: Date, to: Date, pageNum: number, totalPages: number) {
  const y = PAGE_H - MARGIN + 1;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([], 0);
  doc.line(MARGIN, y - 3, PAGE_W - MARGIN, y - 3);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 160, 160);
  const now = new Date();
  doc.text(
    `Flux — ${fmtDateTime(from)} → ${fmtDateTime(to)} — Imprimé le ${fmtDateShort(now)} à ${fmtTime(now)}`,
    MARGIN,
    y,
  );
  doc.text(`${pageNum} / ${totalPages}`, PAGE_W - MARGIN, y, { align: 'right' });
}

export function generateSchedulePdf(options: PrintOptions): ArrayBuffer {
  const { snapshot, from, to, includeStations, includeOperators } = options;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const jobMap = new Map(snapshot.jobs.map(j => [j.id, j]));
  const elementMap = new Map(snapshot.elements.map(e => [e.id, e]));
  const taskMap = new Map(snapshot.tasks.map(t => [t.id, t]));
  const stationMap = new Map(snapshot.stations.map(s => [s.id, s]));
  const operatorMap = new Map(snapshot.operators.map(o => [o.id, o]));

  const rangeAssignments = snapshot.assignments.filter(a => {
    const s = new Date(a.scheduledStart);
    const e = new Date(a.scheduledEnd);
    return s < to && e > from && !a.isOutsourced;
  });

  const pages: PageDef[] = [];

  if (includeStations) {
    const byStation = new Map<string, TaskAssignment[]>();
    for (const a of rangeAssignments) {
      const list = byStation.get(a.targetId) ?? [];
      list.push(a);
      byStation.set(a.targetId, list);
    }
    for (const station of snapshot.stations) {
      const list = byStation.get(station.id);
      if (!list || list.length === 0) continue;
      list.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
      pages.push({ title: station.name, kind: 'station', assignments: list });
    }
  }

  if (includeOperators) {
    const byOp = new Map<string, TaskAssignment[]>();
    for (const a of rangeAssignments) {
      if (!a.operators || a.operators.length === 0) continue;
      for (const ref of a.operators) {
        const list = byOp.get(ref.operatorId) ?? [];
        list.push(a);
        byOp.set(ref.operatorId, list);
      }
    }
    const sortedOps = [...snapshot.operators].sort((a, b) =>
      (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName),
    );
    for (const op of sortedOps) {
      const raw = byOp.get(op.id);
      if (!raw || raw.length === 0) continue;
      const unique = [...new Map(raw.map(a => [a.id, a])).values()];
      unique.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime());
      const sub = op.role ? op.role : undefined;
      pages.push({ title: `${op.firstName} ${op.lastName}`, kind: 'operator', subtitle: sub, assignments: unique });
    }
  }

  if (pages.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(120, 120, 120);
    doc.text('Aucune tâche dans la plage sélectionnée.', PAGE_W / 2, PAGE_H / 2, { align: 'center' });
    drawFooter(doc, from, to, 1, 1);
    return doc.output('arraybuffer');
  }

  const totalPages = pages.length;

  for (let pi = 0; pi < pages.length; pi++) {
    if (pi > 0) doc.addPage('a4', 'landscape');
    const pg = pages[pi];
    const extraHeader = pg.kind === 'station' ? 'OPÉRATEURS' : 'STATION';
    let y = MARGIN;
    let pdfPage = pi + 1;

    const drawPageHeader = (continuation: boolean) => {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(140, 140, 140);
      doc.text(pg.kind === 'station' ? 'STATION' : 'OPÉRATEUR', MARGIN, y + 3);
      y += 5;

      doc.setFontSize(continuation ? 12 : 14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(35, 35, 35);
      const label = continuation ? `${pg.title} (suite)` : pg.title;
      doc.text(label, MARGIN, y + 4.5);

      if (pg.subtitle && !continuation) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110, 110, 110);
        doc.text(pg.subtitle, MARGIN, y + 9);
        y += 3;
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 110, 110);
      doc.text(`${fmtDateTime(from)} → ${fmtDateTime(to)}`, PAGE_W - MARGIN, y + 4.5, { align: 'right' });

      y += 8;
      doc.setDrawColor(190, 190, 190);
      doc.setLineWidth(0.25);
      doc.setLineDashPattern([], 0);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 3;
    };

    const drawTableHeader = () => {
      doc.setFillColor(245, 245, 245);
      doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.15);
      doc.setLineDashPattern([], 0);
      doc.line(MARGIN, y + ROW_H, PAGE_W - MARGIN, y + ROW_H);

      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      let x = MARGIN + COLOR_STRIP_W + 2;
      doc.text('DÉBUT', x, y + 4.5);
      x += COL_START;
      doc.text('FIN', x, y + 4.5);
      x += COL_END;
      doc.text('DURÉE', x, y + 4.5);
      x += COL_DURATION;
      doc.text('RÉFÉRENCE', x, y + 4.5);
      x += COL_REF;
      doc.text('DESCRIPTION', x, y + 4.5);
      x += COL_DESC;
      doc.text(extraHeader, x, y + 4.5);
      x += COL_EXTRA;
      doc.text('DÉBUT RÉEL', x, y + 4.5);
      x += COL_REAL_START;
      doc.text('FIN RÉELLE', x, y + 4.5);
      y += ROW_H;
    };

    drawPageHeader(false);
    drawTableHeader();

    let currentDay = '';
    let rowCount = 0;

    const ensureSpace = (needed: number): boolean => {
      if (y + needed <= PAGE_H - MARGIN - FOOTER_ZONE) return false;
      drawFooter(doc, from, to, pdfPage, totalPages);
      doc.addPage('a4', 'landscape');
      pdfPage++;
      y = MARGIN;
      drawPageHeader(true);
      drawTableHeader();
      currentDay = '';
      rowCount = 0;
      return true;
    };

    for (const a of pg.assignments) {
      const start = new Date(a.scheduledStart);
      const end = new Date(a.scheduledEnd);
      const task = taskMap.get(a.taskId);
      const elementId = task && 'elementId' in task ? (task as { elementId: string }).elementId : undefined;
      const element = elementId ? elementMap.get(elementId) : undefined;
      const job = element ? jobMap.get(element.jobId) : undefined;

      const dayStr = fmtDay(start);
      if (dayStr !== currentDay) {
        ensureSpace(ROW_H * 2);
        currentDay = dayStr;
        doc.setFillColor(235, 241, 252);
        doc.rect(MARGIN, y, CONTENT_W, ROW_H, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(55, 75, 120);
        doc.text(dayStr, MARGIN + COLOR_STRIP_W + 2, y + 4.5);
        y += ROW_H;
        rowCount = 0;
      }

      ensureSpace(ROW_H);

      if (rowCount % 2 === 1) {
        doc.setFillColor(252, 252, 252);
        doc.rect(MARGIN + COLOR_STRIP_W, y, CONTENT_W - COLOR_STRIP_W, ROW_H, 'F');
      }

      // Color strip
      const rgb = job?.color ? hexToRgb(job.color) : [150, 150, 150] as [number, number, number];
      const pastel = pastelify(rgb, 0.45);
      doc.setFillColor(...pastel);
      doc.rect(MARGIN, y, COLOR_STRIP_W, ROW_H, 'F');

      const textColor: [number, number, number] = a.isCompleted ? [160, 160, 160] : [45, 45, 45];
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textColor);

      let x = MARGIN + COLOR_STRIP_W + 2;

      // Début
      doc.text(fmtTime(start), x, y + 4.5);
      x += COL_START;

      // Fin
      doc.text(fmtTime(end), x, y + 4.5);
      x += COL_END;

      // Durée
      const dur = end.getTime() - start.getTime();
      doc.text(fmtDuration(dur), x, y + 4.5);
      x += COL_DURATION;

      // Référence
      doc.setFont('helvetica', 'bold');
      doc.text(truncate(job?.reference ?? '—', 14), x, y + 4.5);
      x += COL_REF;

      // Description
      doc.setFont('helvetica', 'normal');
      doc.text(truncate(job?.description ?? '', 65), x, y + 4.5);
      x += COL_DESC;

      // Extra: opérateurs ou station
      doc.setFontSize(7);
      if (pg.kind === 'station') {
        const opNames = (a.operators ?? [])
          .map(ref => {
            const op = operatorMap.get(ref.operatorId);
            return op ? `${op.firstName.charAt(0)}.${op.lastName}` : '';
          })
          .filter(Boolean)
          .join(', ');
        doc.text(truncate(opNames || '—', 20), x, y + 4.5);
      } else {
        const station = stationMap.get(a.targetId);
        doc.text(truncate(station?.name ?? '—', 20), x, y + 4.5);
      }
      x += COL_EXTRA;

      // Writable fields: dotted underlines for handwritten times
      const lineY = y + ROW_H - 1.8;
      drawDottedLine(doc, x + 1, lineY, x + COL_REAL_START - 3);
      x += COL_REAL_START;
      drawDottedLine(doc, x + 1, lineY, x + COL_REAL_END - 3);

      y += ROW_H;
      rowCount++;
    }

    drawFooter(doc, from, to, pdfPage, totalPages);
  }

  return doc.output('arraybuffer');
}

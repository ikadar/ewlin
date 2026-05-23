import type { ElementSpec } from '@flux/types';
import type { PrerequisiteStatus } from '../components/FluxTable/fluxTypes';
import { parsePapierDSL } from './papierDSL';

export interface KanbanColumnDef {
  id: string;
  label: string;
  dotColor: string;
  apiStatus: PrerequisiteStatus;
}

export interface PaperGroupElement {
  elementId: string;
  paperStatus: PrerequisiteStatus;
  paperKey: string;
  paperLabel: string;
  sheetQty: number;
}

export interface PaperGroup {
  paperKey: string;
  paperLabel: string;
  elements: PaperGroupElement[];
  totalSheets: number;
  column: string;
}

function extractSheetFormat(imposition: string): string | null {
  const m = imposition.match(/^(\d+)\s*[x×]\s*(\d+)/);
  return m ? `${m[1]}×${m[2]}` : null;
}

export function derivePaperKey(
  spec: ElementSpec | undefined,
  jobPaperType?: string,
  jobPaperFormat?: string,
  jobPaperWeight?: number,
): { key: string; label: string } {
  let type = '';
  let grammage = '';
  let sheetFormat = '';

  if (spec?.papier) {
    const parsed = parsePapierDSL(spec.papier);
    type = parsed.type;
    grammage = parsed.grammage;
  } else if (jobPaperType) {
    type = jobPaperType;
    if (jobPaperWeight) grammage = `${jobPaperWeight}g`;
  }

  if (spec?.imposition) {
    sheetFormat = extractSheetFormat(spec.imposition) ?? '';
  }
  if (!sheetFormat && jobPaperFormat) {
    sheetFormat = jobPaperFormat;
  }

  if (!type) {
    return { key: '__unspecified__', label: 'Non spécifié' };
  }

  const parts = [type, grammage, sheetFormat].filter(Boolean);
  const label = parts.join(' ');
  const key = parts.join('|');
  return { key, label };
}

export function deriveColumnFromStatus(
  status: PrerequisiteStatus,
  columns: KanbanColumnDef[],
): string {
  const match = columns.find((c) => c.apiStatus === status);
  return match ? match.id : columns[columns.length - 1].id;
}

export function groupElementsByPaper(elements: PaperGroupElement[], columns: KanbanColumnDef[]): PaperGroup[] {
  const map = new Map<string, PaperGroupElement[]>();
  for (const el of elements) {
    const arr = map.get(el.paperKey);
    if (arr) arr.push(el);
    else map.set(el.paperKey, [el]);
  }

  const groups: PaperGroup[] = [];
  for (const [paperKey, els] of map) {
    groups.push({
      paperKey,
      paperLabel: els[0].paperLabel,
      elements: els,
      totalSheets: els.reduce((sum, e) => sum + e.sheetQty, 0),
      column: deriveColumnFromStatus(els[0].paperStatus, columns),
    });
  }
  return groups;
}

export function leftmostColumn(groups: PaperGroup[], columns: KanbanColumnDef[]): string {
  for (const col of columns) {
    if (groups.some((g) => g.column === col.id)) return col.id;
  }
  return columns[columns.length - 1].id;
}

export function columnToApiStatus(columnId: string, columns: KanbanColumnDef[]): PrerequisiteStatus {
  const col = columns.find((c) => c.id === columnId);
  return col ? col.apiStatus : columns[columns.length - 1].apiStatus;
}

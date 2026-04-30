import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type {
  Element,
  BatStatus,
  PaperStatus,
  PlateStatus,
  FormeStatus,
} from '@flux/types';

export interface ElementSectionProps {
  /** The element to display */
  element: Element;
  /** All elements in the job (for resolving upstream precedence names) */
  allElements: Element[];
  /** Whether this is a single-element job (used for the empty-name fallback) */
  isSingleElement?: boolean;
  /**
   * Job-level BAT deadline (ISO string), shown in the BAT pill tooltip
   * when the element has a non-trivial BAT status. Null when the job
   * has none set.
   */
  batDeadline?: string | null;
  /**
   * Paper lead-time in working hours (shop-wide setting). Shown in the
   * Papier pill tooltip ONLY for the `to_order` state where there's no
   * event date yet to anchor the floor. Defaults to 48 to match the
   * server default and keep tests free of Redux setup.
   */
  paperLeadTimeHours?: number;
  /** Children (task tiles) */
  children: React.ReactNode;
}

// Hover delay before the tooltip appears. Long enough that incidental
// mouse-overs while scanning the JDP don't flicker tooltips at the user;
// short enough that an intentional dwell still feels responsive.
const TOOLTIP_DELAY_MS = 500;

// ────────────────────────────────────────────────────────────────────────────
// Tones — mirror PREREQUISITE_STATUS_COLOR in FluxTable/fluxTypes.ts so the
// JDP and Flux dashboard share the same green/amber/red/gray semantics.
// ────────────────────────────────────────────────────────────────────────────
type PillTone = 'green' | 'amber' | 'red' | 'gray';

const TONE_PILL_CLASS: Record<PillTone, string> = {
  green: 'bg-green-500/15 border-green-500/40 text-green-300',
  amber: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
  red: 'bg-red-500/15 border-red-500/40 text-red-300',
  gray: 'bg-zinc-500/15 border-zinc-500/40 text-zinc-400',
};

const TONE_TITLE_CLASS: Record<PillTone, string> = {
  green: 'text-green-300',
  amber: 'text-amber-300',
  red: 'text-red-300',
  gray: 'text-zinc-300',
};

// ────────────────────────────────────────────────────────────────────────────
// Long French labels per status — same vocabulary as COLUMN_OPTIONS in
// FluxTable/fluxTypes.ts so the operator's mental model stays coherent
// across the JDP and the Flux dashboard.
// ────────────────────────────────────────────────────────────────────────────
const BAT_LABEL: Record<BatStatus, string> = {
  none: 'Pas de BAT',
  waiting_files: 'Attente fichiers',
  files_received: 'Fichiers reçus',
  bat_sent: 'BAT envoyé',
  bat_approved: 'BAT OK',
};

const PAPER_LABEL: Record<PaperStatus, string> = {
  none: 'Pas de papier',
  in_stock: 'En stock',
  to_order: 'À commander',
  ordered: 'Commandé',
  delivered: 'Livré',
};

const FORME_LABEL: Record<FormeStatus, string> = {
  none: 'Pas de forme',
  in_stock: 'Sur stock',
  to_order: 'À commander',
  ordered: 'Commandée',
  delivered: 'Livrée',
};

const PLATE_LABEL: Record<PlateStatus, string> = {
  none: 'Pas de plaques',
  to_make: 'À faire',
  ready: 'Prêtes',
};

function batTone(s: BatStatus): PillTone {
  switch (s) {
    case 'waiting_files': return 'red';
    case 'files_received':
    case 'bat_sent': return 'amber';
    case 'bat_approved': return 'green';
    case 'none': return 'gray';
  }
}
function paperOrFormeTone(s: PaperStatus | FormeStatus): PillTone {
  switch (s) {
    case 'in_stock':
    case 'delivered': return 'green';
    case 'to_order': return 'red';
    case 'ordered': return 'amber';
    case 'none': return 'gray';
  }
}
function plateTone(s: PlateStatus): PillTone {
  switch (s) {
    case 'to_make': return 'red';
    case 'ready': return 'green';
    case 'none': return 'gray';
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Format helpers
// ────────────────────────────────────────────────────────────────────────────
function formatShortDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}`;
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function batMeta(element: Element, batDeadline: string | null | undefined): string | null {
  const parts: string[] = [];
  if (element.batStatus === 'files_received' && element.filesReceivedAt) {
    parts.push(`Reçus le ${formatShortDate(element.filesReceivedAt)}`);
  } else if (element.batStatus === 'bat_sent' && element.batSentAt) {
    parts.push(`Envoyé le ${formatShortDate(element.batSentAt)}`);
  } else if (element.batStatus === 'bat_approved' && element.batApprovedAt) {
    parts.push(`Approuvé le ${formatShortDate(element.batApprovedAt)}`);
  }
  if (batDeadline && element.batStatus !== 'bat_approved') {
    parts.push(`D.L. ${formatShortDate(batDeadline)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

function paperMeta(element: Element, paperLeadTimeHours: number): string | null {
  if (element.paperStatus === 'ordered' && element.paperOrderedAt) {
    return `Commandé le ${formatShortDate(element.paperOrderedAt)}`;
  }
  if (element.paperStatus === 'delivered' && element.paperDeliveredAt) {
    return `Livré le ${formatShortDate(element.paperDeliveredAt)}`;
  }
  if (element.paperStatus === 'to_order') {
    return `Délai estimé : ${paperLeadTimeHours}h ouvrées`;
  }
  return null;
}

function formeMeta(element: Element): string | null {
  if (element.formeStatus === 'ordered' && element.formeOrderedAt) {
    return `Commandée le ${formatShortDate(element.formeOrderedAt)}`;
  }
  if (element.formeStatus === 'delivered' && element.formeDeliveredAt) {
    return `Livrée le ${formatShortDate(element.formeDeliveredAt)}`;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// GatePill — portaled tooltip with hover-driven positioning + delay.
// ────────────────────────────────────────────────────────────────────────────
interface GatePillProps {
  label: 'BAT' | 'PAP' | 'FOR' | 'PLQ';
  tone: PillTone;
  /**
   * Bold first line of the tooltip. Includes the prereq kind prefix
   * (e.g. "BAT · Attente fichiers") so the user can read what kind of
   * gate they're hovering without decoding the 3-letter code on the
   * pill.
   */
  tipTitle: string;
  /** Smaller second line of the tooltip — date(s) or estimated delay. Null skips it. */
  tipMeta: string | null;
}

function GatePill({ label, tone, tipTitle, tipMeta }: GatePillProps) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  // Hold the pending-show timer across renders so we can cancel it
  // when the user leaves the pill before TOOLTIP_DELAY_MS elapses.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        left: rect.left + rect.width / 2,
        top: rect.bottom + 6,
      });
      timerRef.current = null;
    }, TOOLTIP_DELAY_MS);
  }, []);

  const handleLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPos(null);
  }, []);

  // Defensive: if the pill unmounts while the timer is pending (e.g. the
  // user closes the JDP mid-hover), drop the timer so the callback
  // doesn't fire on a dead ref.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={`inline-flex items-center px-1 py-px rounded-[3px] border text-[9px] font-bold tracking-wider leading-none cursor-default ${TONE_PILL_CLASS[tone]}`}
      >
        {label}
      </span>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[9999] pointer-events-none flex flex-col bg-zinc-900 border border-white/10 shadow-lg rounded px-2 py-1 min-w-[140px] max-w-[240px] whitespace-nowrap"
            style={{
              left: pos.left,
              top: pos.top,
              transform: 'translateX(-50%)',
            }}
          >
            <span className={`text-[10.5px] font-semibold ${TONE_TITLE_CLASS[tone]}`}>
              {tipTitle}
            </span>
            {tipMeta && (
              <span className="text-[10.5px] text-zinc-400 mt-0.5">{tipMeta}</span>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ElementSection
// ────────────────────────────────────────────────────────────────────────────
interface BadgeSpec {
  key: string;
  label: 'BAT' | 'PAP' | 'FOR' | 'PLQ';
  tone: PillTone;
  tipTitle: string;
  tipMeta: string | null;
}

function buildBadges(
  element: Element,
  batDeadline: string | null | undefined,
  paperLeadTimeHours: number,
): BadgeSpec[] {
  const badges: BadgeSpec[] = [];
  // 'none' status means "not applicable to this element" (e.g., no BAT
  // required for an assembly element, no plates for a non-offset
  // element). We skip those — showing them would just be visual noise.
  if (element.batStatus !== 'none') {
    badges.push({
      key: 'bat',
      label: 'BAT',
      tone: batTone(element.batStatus),
      tipTitle: `BAT · ${BAT_LABEL[element.batStatus]}`,
      tipMeta: batMeta(element, batDeadline),
    });
  }
  if (element.paperStatus !== 'none') {
    badges.push({
      key: 'pap',
      label: 'PAP',
      tone: paperOrFormeTone(element.paperStatus),
      tipTitle: `Papier · ${PAPER_LABEL[element.paperStatus]}`,
      tipMeta: paperMeta(element, paperLeadTimeHours),
    });
  }
  if (element.formeStatus !== 'none') {
    badges.push({
      key: 'for',
      label: 'FOR',
      tone: paperOrFormeTone(element.formeStatus),
      tipTitle: `Forme · ${FORME_LABEL[element.formeStatus]}`,
      tipMeta: formeMeta(element),
    });
  }
  if (element.plateStatus !== 'none') {
    badges.push({
      key: 'plq',
      label: 'PLQ',
      tone: plateTone(element.plateStatus),
      tipTitle: `Plaques · ${PLATE_LABEL[element.plateStatus]}`,
      tipMeta: null,
    });
  }
  return badges;
}

/**
 * Section for an element in the JobDetailsPanel.
 *
 * Layout per element:
 *   ┌───────────────────────────────────────────────┐
 *   │ ELEMENT_NAME            [BAT][PAP][FOR][PLQ]  │  ← row 1: name (left) + badges (right)
 *   │                                après E1, E2   │  ← row 2: precedences (only when any)
 *   │ [task tile 1]                                 │
 *   │ [task tile 2]                                 │
 *   └───────────────────────────────────────────────┘
 *
 * Badges show all four prerequisite kinds (BAT, Papier, Forme, Plaques),
 * including ready/green states — mirroring the at-a-glance reading of
 * the Flux dashboard. `'none'` statuses (i.e. not applicable to this
 * element) are skipped to avoid noise.
 */
export function ElementSection({
  element,
  allElements,
  isSingleElement = false,
  batDeadline,
  paperLeadTimeHours = 48,
  children,
}: ElementSectionProps) {
  const badges = buildBadges(element, batDeadline, paperLeadTimeHours);

  const precedenceElements = element.prerequisiteElementIds
    .map((id) => allElements.find((e) => e.id === id))
    .filter((e): e is Element => e !== undefined);
  const hasPrecedence = precedenceElements.length > 0;

  // Single-element jobs sometimes carry no element name (the job itself
  // is the descriptor); fall back to a generic label so the card still
  // has a meaningful title and feels symmetric with multi-element jobs.
  const displayName =
    isSingleElement && !element.name ? 'Élément unique' : element.name;

  return (
    <div className="bg-white/[0.015] border border-white/5 p-2.5 mb-2.5 rounded-none">
      {/* Row 1: element name (left) + badges (top-right) */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10.5px] font-bold tracking-[0.08em] uppercase text-zinc-200 truncate min-w-0">
          {displayName}
        </span>
        {badges.length > 0 && (
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {badges.map((b) => (
              <GatePill
                key={b.key}
                label={b.label}
                tone={b.tone}
                tipTitle={b.tipTitle}
                tipMeta={b.tipMeta}
              />
            ))}
          </div>
        )}
      </div>
      {/* Row 2: precedences (only when present) */}
      {hasPrecedence && (
        <div className="flex items-center gap-[3px] mb-2 justify-end">
          <span className="italic text-[9.5px] text-zinc-600 tracking-[0.03em] mr-px">après</span>
          {precedenceElements.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center px-1.5 py-px rounded-[3px] text-[9.5px] font-medium bg-white/[0.04] border border-white/5 text-zinc-400"
            >
              {e.name}
            </span>
          ))}
        </div>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

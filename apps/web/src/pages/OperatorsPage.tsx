/**
 * OperatorsPage - CRUD page for operators
 *
 * Accessible at /settings/operators.
 * Follows the same pattern as StationsPage (modal CRUD, styling, RTK Query hooks).
 * Layout based on the validated playground-operator-form.html.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, FolderOpen, Archive, RotateCcw } from 'lucide-react';
import {
  useGetOperatorsQuery,
  useCreateOperatorMutation,
  useUpdateOperatorMutation,
  useDeleteOperatorMutation,
  useRestoreOperatorMutation,
  useReplaceSkillsMutation,
  useReplaceConcurrentGroupsMutation,
} from '../store/api/operatorApi';
import type { OperatorResponse, OperatorSkillResponse, ConcurrentGroupPayload, AbsencePayload, OvertimePayload } from '../store/api/operatorApi';
import { useGetStationsQuery } from '../store/api/stationApi';
import type { StationResponse } from '../store/api/stationApi';
import { useGetStationCategoriesQuery } from '../store/api/stationCategoryApi';
import type { StationCategoryResponse } from '../store/api/stationCategoryApi';
import {
  RotatingScheduleEditor,
  FluxSelect,
} from '../components/ScheduleEditor';
import type { OperatingSchedule } from '../components/ScheduleEditor';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SCHEDULE: OperatingSchedule = {
  monday:    { isOperating: true,  slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  tuesday:   { isOperating: true,  slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  wednesday: { isOperating: true,  slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  thursday:  { isOperating: true,  slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  friday:    { isOperating: true,  slots: [{ start: '06:00', end: '12:00' }, { start: '13:00', end: '17:00' }] },
  saturday:  { isOperating: false, slots: [] },
  sunday:    { isOperating: false, slots: [] },
};

const INPUT_CLASS = 'w-full px-3 py-[7px] text-sm leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary';

// ============================================================================
// Helpers
// ============================================================================

function snap(v: number): number {
  return Math.round(v * 20) / 20;
}

/** Format a Date as HTML `datetime-local` value: "YYYY-MM-DDTHH:MM". */
function formatForDatetimeLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/** Default range for a fresh absence row: today 00:00 → today 23:59 (full day). */
function todayFullDayRange(): { startAt: string; endAt: string } {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { startAt: `${date}T00:00`, endAt: `${date}T23:59` };
}

/** Per-station proficiency split between calage (setup) and roule (run) phases. */
export interface SkillValues {
  setup: number;
  run: number;
}

/**
 * Build a map of stationId -> {setup, run} from the skills array.
 *
 * Tolerant to backends that emit only the legacy `proficiency` field —
 * in that case both setup and run mirror it.
 */
function buildSkillMap(skills: OperatorSkillResponse[]): Map<string, SkillValues> {
  const map = new Map<string, SkillValues>();
  for (const s of skills) {
    const setup = s.setupProficiency ?? s.proficiency ?? 0;
    const run = s.runProficiency ?? s.proficiency ?? 0;
    map.set(s.stationId, { setup, run });
  }
  return map;
}

/** Group stations by category, sorted alphabetically within each group */
function groupStationsByCategory(
  stations: StationResponse[],
  categories: StationCategoryResponse[],
): { categoryName: string; stations: StationResponse[] }[] {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const groups = new Map<string, StationResponse[]>();

  for (const station of stations) {
    const catName = catMap.get(station.categoryId) ?? 'Sans catégorie';
    if (!groups.has(catName)) groups.set(catName, []);
    groups.get(catName)!.push(station);
  }

  // Sort categories alphabetically, stations alphabetically within each group
  return Array.from(groups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([categoryName, stns]) => ({
      categoryName,
      stations: [...stns].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

// ============================================================================
// Slider CSS (injected once via <style>)
// ============================================================================

const SLIDER_STYLE = `
.op-slider-wrap {
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
}
.op-slider-track {
  position: absolute;
  left: 0; right: 0;
  height: 3px;
  border-radius: 2px;
  background: var(--color-flux-border-light);
  pointer-events: none;
}
.op-slider-fill {
  position: absolute;
  left: 0;
  height: 3px;
  border-radius: 2px;
  background: var(--color-flux-text-secondary);
  pointer-events: none;
}
.op-prof-slider {
  position: relative;
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 24px;
  background: transparent;
  cursor: pointer;
  margin: 0;
  padding: 0;
  z-index: 2;
}
.op-prof-slider:focus { outline: none; }
.op-prof-slider::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 2px;
  background: transparent;
}
.op-prof-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-flux-text-primary);
  border: 2px solid var(--color-flux-surface);
  margin-top: -5.5px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  cursor: grab;
}
.op-prof-slider::-webkit-slider-thumb:active {
  cursor: grabbing;
}
.op-prof-slider::-moz-range-track {
  height: 3px;
  border-radius: 2px;
  background: transparent;
  border: none;
}
.op-prof-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-flux-text-primary);
  border: 2px solid var(--color-flux-surface);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  cursor: grab;
}
`;

// ============================================================================
// SkillRow — station proficiency row, split per-phase (Calage / Roule)
// ============================================================================

type SkillPhase = 'setup' | 'run';

interface SkillRowProps {
  station: StationResponse;
  initialSetup: number;
  initialRun: number;
  onCommit: (stationId: string, phase: SkillPhase, value: number) => void;
}

interface PhaseSliderProps {
  initialValue: number;
  onCommit: (value: number) => void;
}

/**
 * Single-phase proficiency slider with inline value editing.
 *
 * Imperative DOM updates while dragging keep the row out of the React
 * render path — there are typically dozens of these per modal and sliding
 * the thumb fires `onInput` at ~60Hz.
 */
function PhaseSlider({ initialValue, onCommit }: PhaseSliderProps) {
  const sliderRef = useRef<HTMLInputElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const currentValueRef = useRef(initialValue);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const updateDomElements = (val: number) => {
    const pct = (val / 1.5 * 100);
    if (sliderRef.current) sliderRef.current.value = String(val);
    if (fillRef.current) fillRef.current.style.width = pct + '%';
    if (valueRef.current && !isEditing) valueRef.current.textContent = val.toFixed(2);
  };

  useEffect(() => {
    currentValueRef.current = initialValue;
    updateDomElements(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const handleSliderInput = (e: React.FormEvent<HTMLInputElement>) => {
    const raw = parseFloat((e.target as HTMLInputElement).value);
    const snapped = snap(raw);
    currentValueRef.current = snapped;
    updateDomElements(snapped);
  };

  const handleSliderChange = () => {
    onCommit(currentValueRef.current);
  };

  const handleValueClick = () => {
    setEditValue(currentValueRef.current.toFixed(2));
    setIsEditing(true);
  };

  const commitEditValue = () => {
    let parsed = parseFloat(editValue);
    if (isNaN(parsed)) parsed = 0;
    parsed = Math.max(0, Math.min(1.5, parsed));
    parsed = snap(parsed);
    currentValueRef.current = parsed;
    setIsEditing(false);
    onCommit(parsed);
  };

  return (
    <>
      <div className="op-slider-wrap">
        <div className="op-slider-track" />
        <div ref={fillRef} className="op-slider-fill" style={{ width: `${initialValue / 1.5 * 100}%` }} />
        <input
          ref={sliderRef}
          type="range"
          className="op-prof-slider"
          min="0"
          max="1.5"
          step="0.05"
          defaultValue={String(initialValue)}
          onInput={handleSliderInput}
          onChange={handleSliderChange}
        />
      </div>
      {isEditing ? (
        <input
          type="text"
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEditValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEditValue();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          className="w-[44px] px-1 py-0.5 text-xs font-mono bg-flux-base border border-blue-500 rounded text-flux-text-primary text-right outline-none"
        />
      ) : (
        <span
          ref={valueRef}
          onClick={handleValueClick}
          className="text-xs font-mono min-w-[36px] text-right px-1 py-0.5 rounded cursor-pointer border border-transparent hover:bg-flux-elevated text-flux-text-secondary"
        >
          {initialValue.toFixed(2)}
        </span>
      )}
    </>
  );
}

/**
 * One row per station with two side-by-side phase sliders.
 *
 * Checkbox toggles BOTH phases on/off together (set both to 1.0 on enable,
 * 0 on disable) — the common case is "qualified or not" rather than
 * fine-grained mismatch. Users who need to express asymmetry adjust the
 * individual sliders afterwards.
 */
function SkillRow({ station, initialSetup, initialRun, onCommit }: SkillRowProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const isActive = initialSetup > 0 || initialRun > 0;

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.checked = isActive;
    if (nameRef.current) {
      if (isActive) {
        nameRef.current.classList.add('font-semibold', 'text-flux-text-primary');
        nameRef.current.classList.remove('text-flux-text-muted');
      } else {
        nameRef.current.classList.remove('font-semibold', 'text-flux-text-primary');
        nameRef.current.classList.add('text-flux-text-muted');
      }
    }
  }, [isActive]);

  const handleCheckboxChange = () => {
    const newVal = checkboxRef.current?.checked ? 1.0 : 0;
    onCommit(station.id, 'setup', newVal);
    onCommit(station.id, 'run', newVal);
  };

  return (
    <div
      className="grid items-center gap-2 py-1"
      style={{ gridTemplateColumns: '20px 100px 1fr 50px 1fr 50px', minHeight: '32px' }}
    >
      <input
        ref={checkboxRef}
        type="checkbox"
        defaultChecked={isActive}
        onChange={handleCheckboxChange}
        className="w-4 h-4 rounded border border-flux-border-light bg-flux-base accent-blue-500 cursor-pointer"
      />
      <span
        ref={nameRef}
        className={`text-[13px] whitespace-nowrap overflow-hidden text-ellipsis transition-colors ${isActive ? 'font-semibold text-flux-text-primary' : 'text-flux-text-muted'}`}
        title={station.name}
      >
        {station.name}
      </span>
      <PhaseSlider
        initialValue={initialSetup}
        onCommit={(v) => onCommit(station.id, 'setup', v)}
      />
      <PhaseSlider
        initialValue={initialRun}
        onCommit={(v) => onCommit(station.id, 'run', v)}
      />
    </div>
  );
}

// ============================================================================
// Concurrent Groups Section
// ============================================================================

/**
 * Local representation of a concurrent group while editing in the modal.
 *
 * Existing groups carry their server-side id; new groups (created in this
 * session) use a synthetic key starting with `new:` so React can track them.
 * The id is dropped before sending to the bulk-replace endpoint.
 */
interface DraftGroup {
  key: string;
  stationIds: [string, string];
  productivity: [number, number];  // aligned with stationIds
}

/** Canonical key for a station pair (sorted), used for duplicate detection. */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

interface ConcurrentGroupsSectionProps {
  /** Stations the operator currently has a skill on (groups can only pair these). */
  skilledStations: StationResponse[];
  groups: DraftGroup[];
  onChange: (groups: DraftGroup[]) => void;
}

function ConcurrentGroupsSection({ skilledStations, groups, onChange }: ConcurrentGroupsSectionProps) {
  const stationName = useCallback(
    (id: string) => skilledStations.find((s) => s.id === id)?.name ?? id,
    [skilledStations],
  );

  const addGroup = () => {
    onChange([
      ...groups,
      {
        key: `new:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        stationIds: ['', ''],
        productivity: [0.9, 0.9],
      },
    ]);
  };

  const updateGroup = (idx: number, patch: Partial<DraftGroup>) => {
    const next = [...groups];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeGroup = (idx: number) => {
    onChange(groups.filter((_, i) => i !== idx));
  };

  const isPairComplete = (g: DraftGroup) => g.stationIds[0] !== '' && g.stationIds[1] !== '' && g.stationIds[0] !== g.stationIds[1];

  const isDuplicate = (g: DraftGroup, idx: number) => {
    if (!isPairComplete(g)) return false;
    const key = pairKey(g.stationIds[0], g.stationIds[1]);
    return groups.some((other, i) => i !== idx && isPairComplete(other) && pairKey(other.stationIds[0], other.stationIds[1]) === key);
  };

  if (skilledStations.length < 2) {
    return (
      <div className="pt-2 border-t border-flux-border">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted mb-3">
          Groupes concurrents
        </p>
        <p className="text-xs text-flux-text-muted italic">
          L'opérateur doit avoir au moins 2 compétences pour configurer un groupe concurrent.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-flux-border">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted">
          Groupes concurrents
        </p>
        <span className="text-[10px] text-flux-text-muted">
          Paires de machines que l'opérateur peut conduire simultanément
        </span>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {groups.map((group, idx) => {
            const duplicate = isDuplicate(group, idx);
            return (
              <div
                key={group.key}
                className={`p-3 bg-flux-base rounded border ${duplicate ? 'border-red-500' : 'border-flux-border'}`}
              >
                <div className="grid grid-cols-[1fr_60px_1fr_60px_24px] items-center gap-2">
                  {[0, 1].map((slot) => {
                    const stationId = group.stationIds[slot];
                    return (
                      <div key={slot} className="contents">
                        <FluxSelect
                          value={stationId}
                          onChange={(val) => {
                            const nextIds = [...group.stationIds] as [string, string];
                            nextIds[slot] = val;
                            updateGroup(idx, { stationIds: nextIds });
                          }}
                          options={[
                            { value: '', label: '— choisir —' },
                            ...skilledStations
                              .filter((s) => s.id !== group.stationIds[1 - slot])
                              .map((s) => ({ value: s.id, label: s.name })),
                          ]}
                        />
                        <input
                          type="number"
                          step="0.05"
                          min="0"
                          max="1.5"
                          value={group.productivity[slot]}
                          disabled={!stationId}
                          aria-label={`Productivité de la station ${slot + 1} dans le groupe ${idx + 1}`}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (Number.isFinite(v)) {
                              const nextProd = [...group.productivity] as [number, number];
                              nextProd[slot] = Math.max(0, Math.min(1.5, v));
                              updateGroup(idx, { productivity: nextProd });
                            }
                          }}
                          className="px-1 py-[7px] text-sm font-mono leading-[1.5] bg-flux-base border border-flux-border-light rounded text-flux-text-primary text-center focus:outline-none focus:border-flux-text-secondary disabled:opacity-50"
                          title="Productivité effective sur cette machine quand l'opérateur est sur cette paire"
                        />
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => removeGroup(idx)}
                    className="text-flux-text-muted hover:text-red-400 transition-colors text-lg leading-none"
                    aria-label={`Supprimer le groupe concurrent ${idx + 1}`}
                    title="Supprimer ce groupe"
                  >
                    ×
                  </button>
                </div>
                {duplicate && (
                  <p className="mt-1.5 text-[10px] text-red-400">
                    Cette paire existe déjà dans un autre groupe.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={addGroup}
        className="w-full py-2 text-xs text-flux-text-muted border border-dashed border-flux-border-light rounded hover:border-blue-500 hover:text-blue-500 transition-colors"
      >
        + Ajouter un groupe concurrent
      </button>
      {/* Surface validation hint at the section level too */}
      {groups.some((g, i) => isDuplicate(g, i)) && (
        <p className="mt-2 text-[11px] text-red-400">
          Corrigez les paires en doublon avant d'enregistrer.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Operator Form Modal
// ============================================================================

export interface OperatorFormModalProps {
  initial?: OperatorResponse | null;
  stations: StationResponse[];
  categories: StationCategoryResponse[];
  onSave: (data: {
    firstName: string;
    lastName: string;
    role: string;
    totalAttention: number;
    operatingSchedules: OperatingSchedule[];
    scheduleRotationReferenceWeek: number | null;
    scheduleNames: string[];
    absences: AbsencePayload[];
    overtimes: OvertimePayload[];
    skills: OperatorSkillResponse[];
    concurrentGroups: ConcurrentGroupPayload[];
  }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export function OperatorFormModal({ initial, stations, categories, onSave, onCancel, isSaving }: OperatorFormModalProps) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [role, setRole] = useState(initial?.role ?? '');

  // Skills: stationId -> {setup, run} (split per phase; legacy callers reading
  // a single value get the run proficiency until the rest of the codebase migrates).
  const initialSkillMap = useMemo(() => buildSkillMap(initial?.skills ?? []), [initial]);
  const [skillMap, setSkillMap] = useState<Map<string, SkillValues>>(() => new Map(initialSkillMap));

  // Concurrent groups: per-operator pairs of stations he can supervise simultaneously.
  const [concurrentGroups, setConcurrentGroups] = useState<DraftGroup[]>(() => {
    const initialGroups = initial?.concurrentGroups ?? [];
    return initialGroups.map((g) => ({
      key: g.id,
      stationIds: [g.stationIds[0] ?? '', g.stationIds[1] ?? ''] as [string, string],
      productivity: [
        g.effectiveProductivity[g.stationIds[0]] ?? 0.9,
        g.effectiveProductivity[g.stationIds[1]] ?? 0.9,
      ] as [number, number],
    }));
  });

  // Rotating schedules
  const [schedules, setSchedules] = useState<OperatingSchedule[]>(() => {
    if (initial?.operatingSchedules && initial.operatingSchedules.length > 0) {
      return initial.operatingSchedules as unknown as OperatingSchedule[];
    }
    return [JSON.parse(JSON.stringify(DEFAULT_SCHEDULE))];
  });
  const [scheduleRotationReferenceWeek, setScheduleRotationReferenceWeek] = useState<number | null>(
    initial?.scheduleRotationReferenceWeek ?? null
  );
  const [scheduleNames, setScheduleNames] = useState<string[]>(
    initial?.scheduleNames ?? []
  );
  const [activeScheduleIndex, setActiveScheduleIndex] = useState(0);

  // Form rows use HTML `datetime-local` format ("YYYY-MM-DDTHH:MM") — the
  // input trims off seconds, so we strip them on load from the API payload
  // (which is canonical "YYYY-MM-DDTHH:MM:SS"). Seconds are re-added by PHP.
  const [absences, setAbsences] = useState<{ id: string; startAt: string; endAt: string; reason: string }[]>(() => {
    if (initial?.absences) {
      return initial.absences.map((ab, i) => ({
        id: String(i),
        startAt: ab.startAt.slice(0, 16),
        endAt: ab.endAt.slice(0, 16),
        reason: ab.reason ?? '',
      }));
    }
    return [];
  });

  const [overtimes, setOvertimes] = useState<{ id: string; startAt: string; endAt: string; reason: string }[]>(() => {
    if (initial?.overtimes) {
      return initial.overtimes.map((ot, i) => ({
        id: `ot-${i}`,
        startAt: ot.startAt.slice(0, 16),
        endAt: ot.endAt.slice(0, 16),
        reason: ot.reason ?? '',
      }));
    }
    return [];
  });

  // Schedule view toggle
  const [scheduleView, setScheduleView] = useState<'visual' | 'json'>('visual');

  // Grouped stations for skills section
  const groupedStations = useMemo(
    () => groupStationsByCategory(stations, categories),
    [stations, categories],
  );

  // Stations the operator currently has a skill on — only these can be paired.
  // A station qualifies if either phase has a positive proficiency: the
  // operator can contribute to the run, the setup, or both.
  const skilledStations = useMemo(
    () => stations.filter((s) => {
      const v = skillMap.get(s.id);
      return v !== undefined && (v.setup > 0 || v.run > 0);
    }).sort((a, b) => a.name.localeCompare(b.name)),
    [stations, skillMap],
  );

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  // Concurrent groups must be either empty rows (in-progress) or fully valid:
  // both stations selected, distinct, no duplicate pair, both productivities in range.
  const concurrentGroupsValid = useMemo(() => {
    const seen = new Set<string>();
    for (const g of concurrentGroups) {
      const [a, b] = g.stationIds;
      if (a === '' || b === '') return false;  // incomplete row blocks save
      if (a === b) return false;
      const key = [a, b].sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      if (g.productivity[0] < 0 || g.productivity[0] > 1.5) return false;
      if (g.productivity[1] < 0 || g.productivity[1] > 1.5) return false;
    }
    return true;
  }, [concurrentGroups]);

  // Absences are valid only if every filled row has startAt <= endAt.
  // Empty rows (both fields blank) are tolerated and filtered out on submit.
  const absencesValid = useMemo(() => {
    for (const a of absences) {
      if (!a.startAt && !a.endAt) continue;
      if (!a.startAt || !a.endAt) return false;
      if (a.startAt > a.endAt) return false;
    }
    return true;
  }, [absences]);

  const overtimesValid = useMemo(() => {
    for (const o of overtimes) {
      if (!o.startAt && !o.endAt) continue;
      if (!o.startAt || !o.endAt) return false;
      if (o.startAt > o.endAt) return false;
    }
    return true;
  }, [overtimes]);

  // Cross-section invariant: no overtime range may intersect any absence range.
  // Ranges are inclusive on both endpoints (matches PHP/Rust covers() semantics),
  // so touching endpoints (abs 14-17, ot 17-19) count as overlapping.
  // Returns null when disjoint, or the index of the first offending overtime row.
  const firstOverlappingOvertimeIdx = useMemo(() => {
    for (let i = 0; i < overtimes.length; i++) {
      const o = overtimes[i];
      if (!o.startAt || !o.endAt || o.startAt > o.endAt) continue;
      for (const a of absences) {
        if (!a.startAt || !a.endAt || a.startAt > a.endAt) continue;
        // Intervals overlap iff !(o.end < a.start || o.start > a.end).
        // String compare is safe because both use the same ISO format.
        if (o.startAt <= a.endAt && o.endAt >= a.startAt) {
          return { index: i, absence: a };
        }
      }
    }
    return null;
  }, [absences, overtimes]);

  const canSave =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    concurrentGroupsValid &&
    absencesValid &&
    overtimesValid &&
    firstOverlappingOvertimeIdx === null;

  const handleSkillCommit = useCallback((stationId: string, phase: SkillPhase, value: number) => {
    setSkillMap((prev) => {
      const next = new Map(prev);
      const current = next.get(stationId) ?? { setup: 0, run: 0 };
      const updated = phase === 'setup'
        ? { setup: value, run: current.run }
        : { setup: current.setup, run: value };
      const stationLeftSkilled = updated.setup > 0 || updated.run > 0;
      if (!stationLeftSkilled) {
        next.delete(stationId);
        // Drop any concurrent group that referenced this station, now that
        // both phases are zero. Done inside the same updater to avoid the
        // stale-state race that an outer-scope `skillMap.get(stationId)`
        // would have introduced (the just-set value isn't observable
        // outside the updater until React reconciles).
        setConcurrentGroups((prevGroups) =>
          prevGroups.filter(
            (g) => g.stationIds[0] !== stationId && g.stationIds[1] !== stationId,
          ),
        );
      } else {
        next.set(stationId, updated);
      }
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const skills: OperatorSkillResponse[] = [];
    skillMap.forEach((values, stationId) => {
      if (values.setup > 0 || values.run > 0) {
        skills.push({
          stationId,
          // Legacy mirror — backend ignores it when split fields are present.
          proficiency: values.run,
          setupProficiency: values.setup,
          runProficiency: values.run,
        });
      }
    });

    // Defensive cascade: drop any group whose station IDs are no longer
    // in skilledStations (covers station deletions, not just skill
    // removals which handleSkillCommit already handles).
    const skilledIds = new Set(skilledStations.map((s) => s.id));
    const concurrentGroupsPayload: ConcurrentGroupPayload[] = concurrentGroups
      .filter((g) => skilledIds.has(g.stationIds[0]) && skilledIds.has(g.stationIds[1]))
      .map((g) => ({
        stationIds: [g.stationIds[0], g.stationIds[1]],
        effectiveProductivity: {
          [g.stationIds[0]]: g.productivity[0],
          [g.stationIds[1]]: g.productivity[1],
        },
      }));

    await onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: role.trim(),
      totalAttention: 1,
      operatingSchedules: schedules,
      scheduleRotationReferenceWeek: schedules.length > 1 ? scheduleRotationReferenceWeek : null,
      scheduleNames: schedules.length > 1 ? scheduleNames : [],
      absences: absences
        .filter(a => a.startAt && a.endAt && a.startAt <= a.endAt)
        .map(a => ({
          startAt: a.startAt,
          endAt: a.endAt,
          reason: a.reason.trim() || null,
        })),
      overtimes: overtimes
        .filter(o => o.startAt && o.endAt && o.startAt <= o.endAt)
        .map(o => ({
          startAt: o.startAt,
          endAt: o.endAt,
          reason: o.reason.trim() || null,
        })),
      skills,
      concurrentGroups: concurrentGroupsPayload,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] flex flex-col">
        <h2 className="text-flux-text-primary font-medium px-6 pt-6 pb-4">
          {initial ? "Modifier l'opérateur" : 'Nouvel opérateur'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 pb-4 flex flex-col gap-6">
          {/* Section 1: Identity */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-flux-text-secondary mb-1">
                Prénom <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={50}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={INPUT_CLASS}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-flux-text-secondary mb-1">
                Nom <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={50}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm text-flux-text-secondary mb-1">Poste</label>
              <input
                type="text"
                maxLength={100}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Ex : Conducteur offset"
              />
            </div>
          </div>


          {/* Section 2: Skills (calage / roule split) */}
          <div className="pt-2 border-t border-flux-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted mb-3">
              Compétences machines
            </p>
            <div
              className="grid items-center gap-2 pb-1 border-b border-flux-border-light text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted"
              style={{ gridTemplateColumns: '20px 100px 1fr 50px 1fr 50px' }}
            >
              <span />
              <span />
              <span className="text-center">Calage</span>
              <span />
              <span className="text-center">Roule</span>
              <span />
            </div>
            <div>
              {groupedStations.map((group) => (
                <div key={group.categoryName}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted py-2 first:pt-0">
                    {group.categoryName}
                  </div>
                  {group.stations.map((station) => {
                    const values = skillMap.get(station.id);
                    return (
                      <SkillRow
                        key={station.id}
                        station={station}
                        initialSetup={values?.setup ?? 0}
                        initialRun={values?.run ?? 0}
                        onCommit={handleSkillCommit}
                      />
                    );
                  })}
                </div>
              ))}
              {stations.length === 0 && (
                <p className="text-sm text-flux-text-muted italic py-2">Aucune station configurée</p>
              )}
            </div>
          </div>

          {/* Section 2.5: Concurrent groups */}
          <ConcurrentGroupsSection
            skilledStations={skilledStations}
            groups={concurrentGroups}
            onChange={setConcurrentGroups}
          />

          {/* Section 3: Schedule */}
          <div className="pt-2 border-t border-flux-border">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted">
                Horaires de travail
              </p>
              <div className="flex rounded overflow-hidden border border-flux-border-light">
                <button
                  type="button"
                  onClick={() => setScheduleView('visual')}
                  className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    scheduleView === 'visual'
                      ? 'bg-flux-hover text-flux-text-primary'
                      : 'bg-flux-base text-flux-text-muted hover:text-flux-text-secondary'
                  }`}
                >
                  Visuel
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleView('json')}
                  className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    scheduleView === 'json'
                      ? 'bg-flux-hover text-flux-text-primary'
                      : 'bg-flux-base text-flux-text-muted hover:text-flux-text-secondary'
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>

            {scheduleView === 'visual' ? (
              <RotatingScheduleEditor
                schedules={schedules}
                activeIndex={activeScheduleIndex}
                onActiveIndexChange={setActiveScheduleIndex}
                onSchedulesChange={setSchedules}
                scheduleNames={scheduleNames}
                onScheduleNamesChange={setScheduleNames}
                referenceWeek={scheduleRotationReferenceWeek}
                onReferenceWeekChange={setScheduleRotationReferenceWeek}
              />
            ) : (
              <textarea
                value={JSON.stringify({ schedules, scheduleRotationReferenceWeek, scheduleNames }, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (Array.isArray(parsed.schedules)) {
                      setSchedules(parsed.schedules);
                      setScheduleRotationReferenceWeek(parsed.scheduleRotationReferenceWeek ?? null);
                      setScheduleNames(parsed.scheduleNames ?? []);
                    }
                  } catch {
                    // ignore invalid JSON while typing
                  }
                }}
                className="w-full h-48 px-3 py-2 text-xs font-mono bg-flux-base border border-flux-border-light rounded text-flux-text-primary focus:outline-none focus:border-flux-text-secondary resize-y"
              />
            )}
          </div>

          {/* Section 4: Absences */}
          <div className="pt-2 border-t border-flux-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted mb-3">
              Absences
            </p>
            {absences.length > 0 && (
              <div className="flex flex-col gap-3 mb-3">
                {absences.map((absence, idx) => {
                  const isInvalid = !!absence.startAt && !!absence.endAt && absence.startAt > absence.endAt;
                  return (
                    <div key={absence.id} className="flex flex-col gap-1.5 p-3 bg-flux-base rounded border border-flux-border">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-flux-text-muted w-8">Du</label>
                        <input
                          type="datetime-local"
                          value={absence.startAt}
                          onChange={(e) => {
                            const next = [...absences];
                            next[idx] = { ...next[idx], startAt: e.target.value };
                            setAbsences(next);
                          }}
                          className="flex-1 px-3 py-[5px] text-sm bg-flux-elevated border border-flux-border-light rounded text-flux-text-primary focus:outline-none focus:border-flux-text-secondary"
                        />
                        <label className="text-xs text-flux-text-muted w-8 text-center">au</label>
                        <input
                          type="datetime-local"
                          value={absence.endAt}
                          onChange={(e) => {
                            const next = [...absences];
                            next[idx] = { ...next[idx], endAt: e.target.value };
                            setAbsences(next);
                          }}
                          className="flex-1 px-3 py-[5px] text-sm bg-flux-elevated border border-flux-border-light rounded text-flux-text-primary focus:outline-none focus:border-flux-text-secondary"
                        />
                        <button
                          type="button"
                          onClick={() => setAbsences(absences.filter((_, i) => i !== idx))}
                          className="text-flux-text-muted hover:text-red-400 transition-colors text-lg leading-none px-1"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-flux-text-muted w-8">Motif</label>
                        <input
                          type="text"
                          value={absence.reason}
                          onChange={(e) => {
                            const next = [...absences];
                            next[idx] = { ...next[idx], reason: e.target.value };
                            setAbsences(next);
                          }}
                          placeholder="Optionnel"
                          className="flex-1 px-3 py-[5px] text-sm bg-flux-elevated border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                        />
                      </div>
                      {isInvalid && (
                        <p className="text-[11px] text-red-400 pl-10">La date de début doit être antérieure ou égale à la date de fin.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                const range = todayFullDayRange();
                setAbsences([...absences, { id: String(Date.now()), startAt: range.startAt, endAt: range.endAt, reason: '' }]);
              }}
              className="w-full py-2 text-xs text-flux-text-muted border border-dashed border-flux-border-light rounded hover:border-blue-500 hover:text-blue-500 transition-colors"
            >
              + Ajouter une absence
            </button>
          </div>

          {/* Section 5: Overtime (heures supplémentaires) */}
          <div className="pt-2 border-t border-flux-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted mb-3">
              Heures supplémentaires
            </p>
            {overtimes.length > 0 && (
              <div className="flex flex-col gap-3 mb-3">
                {overtimes.map((overtime, idx) => {
                  const isInvalid = !!overtime.startAt && !!overtime.endAt && overtime.startAt > overtime.endAt;
                  const overlap =
                    firstOverlappingOvertimeIdx !== null && firstOverlappingOvertimeIdx.index === idx
                      ? firstOverlappingOvertimeIdx.absence
                      : null;
                  return (
                    <div key={overtime.id} className="flex flex-col gap-1.5 p-3 bg-flux-base rounded border border-flux-border">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-flux-text-muted w-8">Du</label>
                        <input
                          type="datetime-local"
                          value={overtime.startAt}
                          onChange={(e) => {
                            const next = [...overtimes];
                            next[idx] = { ...next[idx], startAt: e.target.value };
                            setOvertimes(next);
                          }}
                          className="flex-1 px-3 py-[5px] text-sm bg-flux-elevated border border-flux-border-light rounded text-flux-text-primary focus:outline-none focus:border-flux-text-secondary"
                        />
                        <label className="text-xs text-flux-text-muted w-8 text-center">au</label>
                        <input
                          type="datetime-local"
                          value={overtime.endAt}
                          onChange={(e) => {
                            const next = [...overtimes];
                            next[idx] = { ...next[idx], endAt: e.target.value };
                            setOvertimes(next);
                          }}
                          className="flex-1 px-3 py-[5px] text-sm bg-flux-elevated border border-flux-border-light rounded text-flux-text-primary focus:outline-none focus:border-flux-text-secondary"
                        />
                        <button
                          type="button"
                          onClick={() => setOvertimes(overtimes.filter((_, i) => i !== idx))}
                          className="text-flux-text-muted hover:text-red-400 transition-colors text-lg leading-none px-1"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-flux-text-muted w-8">Motif</label>
                        <input
                          type="text"
                          value={overtime.reason}
                          onChange={(e) => {
                            const next = [...overtimes];
                            next[idx] = { ...next[idx], reason: e.target.value };
                            setOvertimes(next);
                          }}
                          placeholder="Optionnel"
                          className="flex-1 px-3 py-[5px] text-sm bg-flux-elevated border border-flux-border-light rounded text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-text-secondary"
                        />
                      </div>
                      {isInvalid && (
                        <p className="text-[11px] text-red-400 pl-10">La date de début doit être antérieure ou égale à la date de fin.</p>
                      )}
                      {overlap && (
                        <p className="text-[11px] text-red-400 pl-10">
                          Chevauche l'absence du {overlap.startAt.replace('T', ' ')} au {overlap.endAt.replace('T', ' ')} — modifiez l'absence ou ajustez les horaires.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                const range = todayFullDayRange();
                setOvertimes([...overtimes, { id: `ot-${Date.now()}`, startAt: range.startAt, endAt: range.endAt, reason: '' }]);
              }}
              className="w-full py-2 text-xs text-flux-text-muted border border-dashed border-flux-border-light rounded hover:border-blue-500 hover:text-blue-500 transition-colors"
            >
              + Ajouter des heures supplémentaires
            </button>
          </div>

          </div>{/* end scrollable body */}

          {/* Footer — fixed at bottom */}
          <div className="flex gap-3 justify-end px-6 py-4 border-t border-flux-border">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="px-3 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover disabled:opacity-50 rounded transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSaving || !canSave}
              className="px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// OperatorsPage
// ============================================================================

export default function OperatorsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [editingOperator, setEditingOperator] = useState<OperatorResponse | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingOperator, setDeletingOperator] = useState<OperatorResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: operators = [], isLoading, error } = useGetOperatorsQuery(
    showArchived ? { includeArchived: true } : undefined,
  );
  const [createOperator, { isLoading: isCreatingLoading }] = useCreateOperatorMutation();
  const [updateOperator, { isLoading: isUpdatingLoading }] = useUpdateOperatorMutation();
  const [deleteOperator] = useDeleteOperatorMutation();
  const [restoreOperator] = useRestoreOperatorMutation();
  const [replaceSkills] = useReplaceSkillsMutation();
  const [replaceConcurrentGroups] = useReplaceConcurrentGroupsMutation();

  const { data: stations = [] } = useGetStationsQuery();
  const { data: categories = [] } = useGetStationCategoriesQuery();

  // Build station name lookup
  const stationById = useMemo(
    () => new Map(stations.map((s) => [s.id, s.name])),
    [stations],
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (editingOperator || isCreating || deletingOperator) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.target === searchInputRef.current) {
          e.preventDefault();
          searchInputRef.current?.blur();
        } else if (!(e.target instanceof HTMLInputElement)) {
          e.preventDefault();
          navigate('/');
        }
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate, editingOperator, isCreating, deletingOperator]);

  // Client-side filtering
  const filteredOperators = useMemo(() => {
    if (!searchQuery.trim()) return operators;
    const query = searchQuery.toLowerCase();
    return operators.filter((op) => {
      if (`${op.firstName} ${op.lastName}`.toLowerCase().includes(query)) return true;
      if (op.role && op.role.toLowerCase().includes(query)) return true;
      // Search in skill station names
      for (const skill of op.skills) {
        const stationName = stationById.get(skill.stationId);
        if (stationName && stationName.toLowerCase().includes(query)) return true;
      }
      return false;
    });
  }, [operators, searchQuery, stationById]);

  // Handlers
  const handleSaveCreate = async (data: {
    firstName: string;
    lastName: string;
    role: string;
    totalAttention: number;
    operatingSchedules: OperatingSchedule[];
    scheduleRotationReferenceWeek: number | null;
    scheduleNames: string[];
    absences: AbsencePayload[];
    overtimes: OvertimePayload[];
    skills: OperatorSkillResponse[];
    concurrentGroups: ConcurrentGroupPayload[];
  }) => {
    const created = await createOperator({
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || null,
      operatingSchedules: data.operatingSchedules as unknown as Array<Record<string, unknown>>,
      scheduleRotationReferenceWeek: data.scheduleRotationReferenceWeek,
      scheduleNames: data.scheduleNames.length > 0 ? data.scheduleNames : null,
      absences: data.absences,
      overtimes: data.overtimes,
      skills: data.skills,
    }).unwrap();
    if (data.concurrentGroups.length > 0) {
      await replaceConcurrentGroups({ id: created.id, groups: data.concurrentGroups }).unwrap();
    }
    setIsCreating(false);
  };

  const handleSaveEdit = async (data: {
    firstName: string;
    lastName: string;
    role: string;
    totalAttention: number;
    operatingSchedules: OperatingSchedule[];
    scheduleRotationReferenceWeek: number | null;
    scheduleNames: string[];
    absences: AbsencePayload[];
    overtimes: OvertimePayload[];
    skills: OperatorSkillResponse[];
    concurrentGroups: ConcurrentGroupPayload[];
  }) => {
    if (!editingOperator) return;
    await updateOperator({
      id: editingOperator.id,
      body: {
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || null,
        operatingSchedules: data.operatingSchedules as unknown as Array<Record<string, unknown>>,
        scheduleRotationReferenceWeek: data.scheduleRotationReferenceWeek,
        scheduleNames: data.scheduleNames.length > 0 ? data.scheduleNames : null,
        absences: data.absences,
        overtimes: data.overtimes,
      },
    }).unwrap();
    // Skills must be saved BEFORE concurrent groups: the backend cascade
    // drops groups whose stations are no longer in skills, so we need the
    // skill set to be updated first. Then groups are bulk-replaced from
    // the modal's local state, which is the new source of truth.
    await replaceSkills({ id: editingOperator.id, skills: data.skills }).unwrap();
    await replaceConcurrentGroups({ id: editingOperator.id, groups: data.concurrentGroups }).unwrap();
    setEditingOperator(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingOperator) return;
    setDeleteError(null);
    try {
      await deleteOperator(deletingOperator.id).unwrap();
      setDeletingOperator(null);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        "Erreur lors de l'archivage";
      setDeleteError(msg);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreOperator(id).unwrap();
    } catch {
      // noop — RTK Query will refetch
    }
  };

  return (
    <div className="min-h-screen bg-flux-base flex flex-col">
      {/* Slider CSS */}
      <style dangerouslySetInnerHTML={{ __html: SLIDER_STYLE }} />

      {/* Header */}
      <header className="border-b border-flux-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-flux-text-secondary hover:text-flux-text-primary transition-colors"
            title="Retour (Esc)"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          <h1 className="text-xl font-semibold text-flux-text-primary">Opérateurs</h1>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-flux-text-primary bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          <Plus size={16} />
          Nouveau
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {isLoading && (
          <div className="text-center text-flux-text-tertiary mt-20">Chargement...</div>
        )}

        {error && (
          <div className="text-center text-red-400 mt-20">
            Erreur de chargement des opérateurs
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Search bar */}
            <div className="mb-4 flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-flux-text-tertiary"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Rechercher... (/)"
                  aria-label="Rechercher un opérateur"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-flux-hover border border-flux-border-light rounded-lg text-flux-text-primary placeholder:text-flux-text-muted focus:outline-none focus:border-flux-border-light"
                />
              </div>
              <span className="text-flux-text-tertiary text-sm">
                {filteredOperators.length} opérateur
                {filteredOperators.length !== 1 ? 's' : ''}
                {searchQuery && ` / ${operators.length}`}
              </span>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors border ${
                  showArchived
                    ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                    : 'text-flux-text-tertiary border-flux-border hover:text-flux-text-secondary'
                }`}
              >
                <Archive size={14} />
                Archivés
              </button>
            </div>

            {/* Table */}
            <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-flux-hover">
                  <tr className="bg-flux-hover border-b border-flux-border text-flux-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Prénom</th>
                    <th className="text-left px-4 py-3 font-medium">Nom</th>
                    <th className="text-left px-4 py-3 font-medium">Fonction</th>
                    <th className="text-left px-4 py-3 font-medium">Calage</th>
                    <th className="text-left px-4 py-3 font-medium">Roule</th>
                    <th className="px-4 py-0" />
                  </tr>
                </thead>
                <tbody>
                  {filteredOperators.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-flux-text-muted py-12">
                        Aucun opérateur trouvé
                      </td>
                    </tr>
                  )}
                  {filteredOperators.map((operator) => {
                    return (
                    <tr
                      key={operator.id}
                      className={`border-b border-flux-border group hover:bg-flux-hover transition-colors cursor-pointer h-9${operator.archivedAt ? ' opacity-40' : ''}`}
                    >
                      <td className="px-4 py-0 text-flux-text-primary font-medium">{operator.firstName}</td>
                      <td className="px-4 py-3 text-flux-text-primary">{operator.lastName}</td>
                      <td className="px-4 py-0 text-flux-text-secondary">{operator.role || <span className="text-flux-text-muted italic">—</span>}</td>
                      <td className="px-4 py-0 text-flux-text-secondary">
                        {(() => {
                          const setupStations = operator.skills
                            .filter((s) => (s.setupProficiency ?? 0) > 0)
                            .map((s) => stationById.get(s.stationId) ?? s.stationId);
                          return setupStations.length > 0
                            ? setupStations.join(', ')
                            : <span className="text-flux-text-muted italic">—</span>;
                        })()}
                      </td>
                      <td className="px-4 py-0 text-flux-text-secondary">
                        {(() => {
                          const runStations = operator.skills
                            .filter((s) => (s.runProficiency ?? s.proficiency ?? 0) > 0)
                            .map((s) => stationById.get(s.stationId) ?? s.stationId);
                          return runStations.length > 0
                            ? runStations.join(', ')
                            : <span className="text-flux-text-muted italic">—</span>;
                        })()}
                      </td>
                      <td className="px-4 py-0">
                        <div className="flex items-center gap-2 justify-end">
                          {operator.archivedAt ? (
                            <button
                              onClick={() => handleRestore(operator.id)}
                              className="text-amber-400 hover:text-amber-300 transition-colors"
                              title="Restaurer"
                            >
                              <RotateCcw className="w-4 h-4" strokeWidth={2} />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeletingOperator(operator);
                                }}
                                className="text-amber-400 hover:text-amber-300 transition-colors"
                                title="Archiver"
                              >
                                <Archive className="w-4 h-4" strokeWidth={2} />
                              </button>
                              <button
                                onClick={() => setEditingOperator(operator)}
                                className="text-blue-400 hover:text-blue-300 transition-colors"
                                title="Modifier"
                              >
                                <FolderOpen className="w-4 h-4" strokeWidth={2} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {/* Create modal */}
      {isCreating && (
        <OperatorFormModal
          initial={null}
          stations={stations}
          categories={categories}
          onSave={handleSaveCreate}
          onCancel={() => setIsCreating(false)}
          isSaving={isCreatingLoading}
        />
      )}

      {/* Edit modal */}
      {editingOperator && (
        <OperatorFormModal
          initial={editingOperator}
          stations={stations}
          categories={categories}
          onSave={handleSaveEdit}
          onCancel={() => setEditingOperator(null)}
          isSaving={isUpdatingLoading}
        />
      )}

      {/* Archive confirmation */}
      {deletingOperator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-flux-text-primary font-medium mb-2">Archiver l'opérateur</h2>
            <p className="text-sm text-flux-text-secondary mb-4">
              Archiver{' '}
              <span className="font-medium text-flux-text-primary">{deletingOperator.firstName} {deletingOperator.lastName}</span> ?
              L'opérateur n'apparaitra plus dans le planning. Vous pourrez le restaurer.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeletingOperator(null);
                  setDeleteError(null);
                }}
                className="px-3 py-1.5 text-sm text-flux-text-secondary hover:text-flux-text-primary bg-flux-active hover:bg-flux-hover rounded transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-sm font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-colors"
              >
                Archiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * OperatorsPage - CRUD page for operators
 *
 * Accessible at /settings/operators.
 * Follows the same pattern as StationsPage (modal CRUD, styling, RTK Query hooks).
 * Layout based on the validated playground-operator-form.html.
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useGetOperatorsQuery,
  useCreateOperatorMutation,
  useUpdateOperatorMutation,
  useDeleteOperatorMutation,
  useReplaceSkillsMutation,
} from '../store/api/operatorApi';
import type { OperatorResponse, OperatorSkillResponse } from '../store/api/operatorApi';
import { useGetStationsQuery } from '../store/api/stationApi';
import type { StationResponse } from '../store/api/stationApi';
import { useGetStationCategoriesQuery } from '../store/api/stationCategoryApi';
import type { StationCategoryResponse } from '../store/api/stationCategoryApi';
import {
  OperatingScheduleEditor,
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

/** Build a map of stationId -> proficiency from the skills array */
function buildSkillMap(skills: OperatorSkillResponse[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of skills) {
    map.set(s.stationId, s.proficiency);
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
  background: rgb(58 58 58);
  pointer-events: none;
}
.op-slider-fill {
  position: absolute;
  left: 0;
  height: 3px;
  border-radius: 2px;
  background: rgb(209 209 209);
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
  background: white;
  border: 2px solid rgb(26 26 26);
  margin-top: -5.5px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
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
  background: white;
  border: 2px solid rgb(26 26 26);
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  cursor: grab;
}
`;

// ============================================================================
// SkillRow — individual station proficiency row with direct DOM updates
// ============================================================================

interface SkillRowProps {
  station: StationResponse;
  initialProficiency: number;
  onProficiencyCommit: (stationId: string, value: number) => void;
}

function SkillRow({ station, initialProficiency, onProficiencyCommit }: SkillRowProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const currentValueRef = useRef(initialProficiency);

  useEffect(() => {
    currentValueRef.current = initialProficiency;
    updateDomElements(initialProficiency);
  }, [initialProficiency]);

  const updateDomElements = (val: number) => {
    const pct = (val / 1.5 * 100);
    if (sliderRef.current) {
      sliderRef.current.value = String(val);
    }
    if (fillRef.current) {
      fillRef.current.style.width = pct + '%';
    }
    if (checkboxRef.current) {
      checkboxRef.current.checked = val > 0;
    }
    if (nameRef.current) {
      if (val > 0) {
        nameRef.current.classList.add('font-semibold', 'text-flux-text-primary');
        nameRef.current.classList.remove('text-flux-text-muted');
      } else {
        nameRef.current.classList.remove('font-semibold', 'text-flux-text-primary');
        nameRef.current.classList.add('text-flux-text-muted');
      }
    }
    if (valueRef.current && !isEditing) {
      valueRef.current.textContent = val.toFixed(2);
    }
  };

  const handleSliderInput = (e: React.FormEvent<HTMLInputElement>) => {
    const raw = parseFloat((e.target as HTMLInputElement).value);
    const snapped = snap(raw);
    currentValueRef.current = snapped;
    // Direct DOM update — no React re-render
    updateDomElements(snapped);
  };

  const handleSliderChange = () => {
    // Commit value on mouse release
    onProficiencyCommit(station.id, currentValueRef.current);
  };

  const handleCheckboxChange = () => {
    const newVal = checkboxRef.current?.checked ? 1.0 : 0;
    currentValueRef.current = newVal;
    onProficiencyCommit(station.id, newVal);
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
    onProficiencyCommit(station.id, parsed);
  };

  const isActive = initialProficiency > 0;

  return (
    <div className="grid items-center gap-2 py-1" style={{ gridTemplateColumns: '20px 100px 1fr 50px', minHeight: '32px' }}>
      {/* Checkbox */}
      <input
        ref={checkboxRef}
        type="checkbox"
        defaultChecked={isActive}
        onChange={handleCheckboxChange}
        className="w-4 h-4 rounded border border-flux-border-light bg-flux-base accent-blue-500 cursor-pointer"
      />

      {/* Station name */}
      <span
        ref={nameRef}
        className={`text-[13px] whitespace-nowrap overflow-hidden text-ellipsis transition-colors ${isActive ? 'font-semibold text-flux-text-primary' : 'text-flux-text-muted'}`}
        title={station.name}
      >
        {station.name}
      </span>

      {/* Slider */}
      <div className="op-slider-wrap">
        <div className="op-slider-track" />
        <div ref={fillRef} className="op-slider-fill" style={{ width: `${initialProficiency / 1.5 * 100}%` }} />
        <input
          ref={sliderRef}
          type="range"
          className="op-prof-slider"
          min="0"
          max="1.5"
          step="0.05"
          defaultValue={String(initialProficiency)}
          onInput={handleSliderInput}
          onChange={handleSliderChange}
        />
      </div>

      {/* Value display / edit */}
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
          {initialProficiency.toFixed(2)}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Operator Form Modal
// ============================================================================

interface OperatorFormModalProps {
  initial?: OperatorResponse | null;
  stations: StationResponse[];
  categories: StationCategoryResponse[];
  onSave: (data: {
    firstName: string;
    lastName: string;
    role: string;
    totalAttention: number;
    operatingSchedule: OperatingSchedule;
    scheduleExceptions: ScheduleExceptionInput[];
    skills: OperatorSkillResponse[];
  }) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function OperatorFormModal({ initial, stations, categories, onSave, onCancel, isSaving }: OperatorFormModalProps) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [role, setRole] = useState(initial?.role ?? '');

  // Skills: stationId -> proficiency (only tracked in a ref + state for re-renders on checkbox/commit)
  const initialSkillMap = useMemo(() => buildSkillMap(initial?.skills ?? []), [initial]);
  const [skillMap, setSkillMap] = useState<Map<string, number>>(() => new Map(initialSkillMap));

  // Schedule
  const [schedule, setSchedule] = useState<OperatingSchedule>(() => {
    if (initial?.operatingSchedule) {
      return initial.operatingSchedule as unknown as OperatingSchedule;
    }
    return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
  });

  const [absences, setAbsences] = useState<{ id: string; start: string; end: string; reason: string }[]>(() => {
    if (initial?.scheduleExceptions) {
      return initial.scheduleExceptions.map((ex, i) => ({
        id: String(i),
        start: (ex as { date: string }).date ? (ex as { date: string }).date + 'T08:00' : '',
        end: (ex as { date: string }).date ? (ex as { date: string }).date + 'T17:00' : '',
        reason: (ex as { reason?: string | null }).reason ?? '',
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

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onCancel]);

  const canSave = firstName.trim() !== '' && lastName.trim() !== '';

  const handleProficiencyCommit = useCallback((stationId: string, value: number) => {
    setSkillMap((prev) => {
      const next = new Map(prev);
      if (value > 0) {
        next.set(stationId, value);
      } else {
        next.delete(stationId);
      }
      return next;
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    const skills: OperatorSkillResponse[] = [];
    skillMap.forEach((proficiency, stationId) => {
      if (proficiency > 0) {
        skills.push({ stationId, proficiency });
      }
    });

    await onSave({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: role.trim(),
      totalAttention: 1,
      operatingSchedule: schedule,
      scheduleExceptions: absences.filter(a => a.start && a.end).map(a => ({
        start: a.start,
        end: a.end,
        type: 'ABSENCE',
        reason: a.reason || null,
      })),
      skills,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 w-full max-w-2xl mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-flux-text-primary font-medium mb-4">
          {initial ? "Modifier l'opérateur" : 'Nouvel opérateur'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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


          {/* Section 2: Skills */}
          <div className="pt-2 border-t border-flux-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted mb-3">
              Compétences machines
            </p>
            <div className="overflow-y-auto max-h-[280px]">
              {groupedStations.map((group) => (
                <div key={group.categoryName}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-flux-text-muted py-2 first:pt-0">
                    {group.categoryName}
                  </div>
                  {group.stations.map((station) => (
                    <SkillRow
                      key={station.id}
                      station={station}
                      initialProficiency={skillMap.get(station.id) ?? 0}
                      onProficiencyCommit={handleProficiencyCommit}
                    />
                  ))}
                </div>
              ))}
              {stations.length === 0 && (
                <p className="text-sm text-flux-text-muted italic py-2">Aucune station configurée</p>
              )}
            </div>
          </div>

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
              <OperatingScheduleEditor value={schedule} onChange={setSchedule} />
            ) : (
              <textarea
                value={JSON.stringify(schedule, null, 2)}
                onChange={(e) => {
                  try {
                    setSchedule(JSON.parse(e.target.value));
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
                {absences.map((absence, idx) => (
                  <div key={absence.id} className="flex flex-col gap-1.5 p-3 bg-flux-base rounded border border-flux-border">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-flux-text-muted w-8">Du</label>
                      <input
                        type="datetime-local"
                        value={absence.start}
                        onChange={(e) => {
                          const next = [...absences];
                          next[idx] = { ...next[idx], start: e.target.value };
                          setAbsences(next);
                        }}
                        className="flex-1 px-3 py-[5px] text-sm bg-flux-elevated border border-flux-border-light rounded text-flux-text-primary focus:outline-none focus:border-flux-text-secondary"
                      />
                      <label className="text-xs text-flux-text-muted w-8 text-center">au</label>
                      <input
                        type="datetime-local"
                        value={absence.end}
                        onChange={(e) => {
                          const next = [...absences];
                          next[idx] = { ...next[idx], end: e.target.value };
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
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setAbsences([...absences, { id: String(Date.now()), start: '', end: '', reason: '' }])}
              className="w-full py-2 text-xs text-flux-text-muted border border-dashed border-flux-border-light rounded hover:border-blue-500 hover:text-blue-500 transition-colors"
            >
              + Ajouter une absence
            </button>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-2">
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

  const { data: operators = [], isLoading, error } = useGetOperatorsQuery();
  const [createOperator, { isLoading: isCreatingLoading }] = useCreateOperatorMutation();
  const [updateOperator, { isLoading: isUpdatingLoading }] = useUpdateOperatorMutation();
  const [deleteOperator] = useDeleteOperatorMutation();
  const [replaceSkills] = useReplaceSkillsMutation();

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
    operatingSchedule: OperatingSchedule;
    scheduleExceptions: unknown[];
    skills: OperatorSkillResponse[];
  }) => {
    await createOperator({
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || null,
      operatingSchedule: data.operatingSchedule as unknown as Record<string, unknown>,
      scheduleExceptions: data.scheduleExceptions,
      skills: data.skills,
    }).unwrap();
    setIsCreating(false);
  };

  const handleSaveEdit = async (data: {
    firstName: string;
    lastName: string;
    role: string;
    totalAttention: number;
    operatingSchedule: OperatingSchedule;
    scheduleExceptions: unknown[];
    skills: OperatorSkillResponse[];
  }) => {
    if (!editingOperator) return;
    await updateOperator({
      id: editingOperator.id,
      body: {
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || null,
        operatingSchedule: data.operatingSchedule as unknown as Record<string, unknown>,
        scheduleExceptions: data.scheduleExceptions,
      },
    }).unwrap();
    await replaceSkills({ id: editingOperator.id, skills: data.skills }).unwrap();
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
        "Erreur lors de la suppression";
      setDeleteError(msg);
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
            </div>

            {/* Table */}
            <div className="bg-flux-elevated rounded-lg border border-flux-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-flux-hover">
                  <tr className="bg-flux-hover border-b border-flux-border text-flux-text-secondary">
                    <th className="text-left px-4 py-3 font-medium">Prénom</th>
                    <th className="text-left px-4 py-3 font-medium">Nom</th>
                    <th className="text-left px-4 py-3 font-medium">Fonction</th>
                    <th className="text-left px-4 py-3 font-medium">Compétences</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredOperators.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-flux-text-muted py-12">
                        Aucun opérateur trouvé
                      </td>
                    </tr>
                  )}
                  {filteredOperators.map((operator) => (
                    <tr
                      key={operator.id}
                      className="border-b border-flux-border group hover:bg-flux-hover transition-colors min-h-[36px] h-9"
                    >
                      <td className="px-4 py-3 text-flux-text-primary font-medium">{operator.firstName}</td>
                      <td className="px-4 py-3 text-flux-text-primary">{operator.lastName}</td>
                      <td className="px-4 py-3 text-flux-text-secondary">{operator.role || <span className="text-flux-text-muted italic">—</span>}</td>
                      <td className="px-4 py-3 text-flux-text-secondary">
                        {operator.skills.length > 0
                          ? operator.skills
                              .map((s) => stationById.get(s.stationId) ?? s.stationId)
                              .join(', ')
                          : <span className="text-flux-text-muted italic">Aucune</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setEditingOperator(operator)}
                            className="p-1.5 text-flux-text-tertiary hover:text-flux-text-primary transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingOperator(operator);
                            }}
                            className="p-1.5 text-flux-text-tertiary hover:text-red-400 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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

      {/* Delete confirmation */}
      {deletingOperator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-flux-elevated border border-flux-border-light rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h2 className="text-flux-text-primary font-medium mb-2">Supprimer l'opérateur</h2>
            <p className="text-sm text-flux-text-secondary mb-4">
              Supprimer{' '}
              <span className="font-medium text-flux-text-primary">{deletingOperator.firstName} {deletingOperator.lastName}</span> ?
              Cette action est irréversible.
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
                className="px-3 py-1.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

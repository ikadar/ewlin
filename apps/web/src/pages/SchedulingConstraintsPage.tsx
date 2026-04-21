/**
 * SchedulingConstraintsPage — admin CRUD for engine-level scheduling constraints.
 *
 * Lists existing constraints, lets admin add (typed form) or remove.
 * Mutations trigger auto-recompute automatically via the RTK middleware.
 *
 * Accessible at /settings/scheduling-constraints.
 */

import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import {
  useGetSchedulingConstraintsQuery,
  useCreateSchedulingConstraintMutation,
  useDeleteSchedulingConstraintMutation,
} from '../store/api/constraintApi';
import type {
  SchedulingConstraint,
  SchedulingConstraintType,
  CreateSchedulingConstraintRequest,
} from '@flux/types';
import { getErrorMessage } from '../store/api/errorNormalization';

const CONSTRAINT_TYPE_LABELS: Record<SchedulingConstraintType, string> = {
  MachineUnavailable: 'Machine indisponible',
  OperatorAbsent: 'Opérateur absent',
  DurationOverride: 'Durée forcée',
  PinnedStart: 'Démarrage fixé',
};

const CONSTRAINT_TYPE_HELPERS: Record<SchedulingConstraintType, string> = {
  MachineUnavailable: 'Target = ID station. Plage (timeStart/timeEnd) obligatoire.',
  OperatorAbsent: 'Target = ID opérateur. Plage obligatoire.',
  DurationOverride: 'Target = ID task. overrideValue en minutes. Plage ignorée.',
  PinnedStart: 'Target = ID task. timeStart obligatoire (début forcé).',
};

function formatIsoShort(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

interface FormState {
  constraintType: SchedulingConstraintType;
  targetId: string;
  timeStart: string;
  timeEnd: string;
  overrideValue: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  constraintType: 'MachineUnavailable',
  targetId: '',
  timeStart: '',
  timeEnd: '',
  overrideValue: '',
  description: '',
};

function CreateConstraintModal({
  onCancel,
  onSave,
  isSaving,
}: {
  onCancel: () => void;
  onSave: (body: CreateSchedulingConstraintRequest) => Promise<void>;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isSaving, onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const body: CreateSchedulingConstraintRequest = {
      constraintType: form.constraintType,
      targetId: form.targetId.trim(),
      timeStart: form.timeStart ? new Date(form.timeStart).toISOString() : null,
      timeEnd: form.timeEnd ? new Date(form.timeEnd).toISOString() : null,
      overrideValue: form.overrideValue ? parseFloat(form.overrideValue) : null,
      description: form.description.trim(),
    };
    try {
      await onSave(body);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <form
        onSubmit={handleSubmit}
        className="bg-flux-surface border border-flux-border rounded-lg w-[520px] p-6 shadow-2xl"
      >
        <h2 className="text-sm font-semibold text-flux-text-primary mb-4">
          Nouvelle contrainte de scheduling
        </h2>

        <label className="block text-xs text-flux-text-tertiary mb-1">Type</label>
        <select
          value={form.constraintType}
          onChange={(e) => setForm({ ...form, constraintType: e.target.value as SchedulingConstraintType })}
          className="w-full mb-1 px-3 py-1.5 text-sm bg-flux-elevated border border-flux-border rounded-md text-flux-text-primary"
          disabled={isSaving}
        >
          {(Object.keys(CONSTRAINT_TYPE_LABELS) as SchedulingConstraintType[]).map((t) => (
            <option key={t} value={t}>
              {CONSTRAINT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-flux-text-muted mb-4 leading-snug">
          {CONSTRAINT_TYPE_HELPERS[form.constraintType]}
        </p>

        <label className="block text-xs text-flux-text-tertiary mb-1">Target ID (UUID)</label>
        <input
          type="text"
          required
          value={form.targetId}
          onChange={(e) => setForm({ ...form, targetId: e.target.value })}
          placeholder="00000000-0000-0000-0000-000000000000"
          className="w-full mb-3 px-3 py-1.5 text-sm font-mono bg-flux-elevated border border-flux-border rounded-md text-flux-text-primary"
          disabled={isSaving}
        />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-flux-text-tertiary mb-1">Début</label>
            <input
              type="datetime-local"
              value={form.timeStart}
              onChange={(e) => setForm({ ...form, timeStart: e.target.value })}
              className="w-full px-3 py-1.5 text-sm bg-flux-elevated border border-flux-border rounded-md text-flux-text-primary"
              disabled={isSaving}
            />
          </div>
          <div>
            <label className="block text-xs text-flux-text-tertiary mb-1">Fin</label>
            <input
              type="datetime-local"
              value={form.timeEnd}
              onChange={(e) => setForm({ ...form, timeEnd: e.target.value })}
              className="w-full px-3 py-1.5 text-sm bg-flux-elevated border border-flux-border rounded-md text-flux-text-primary"
              disabled={isSaving}
            />
          </div>
        </div>

        {form.constraintType === 'DurationOverride' && (
          <>
            <label className="block text-xs text-flux-text-tertiary mb-1">Override duration (min)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={form.overrideValue}
              onChange={(e) => setForm({ ...form, overrideValue: e.target.value })}
              className="w-full mb-3 px-3 py-1.5 text-sm bg-flux-elevated border border-flux-border rounded-md text-flux-text-primary"
              disabled={isSaving}
            />
          </>
        )}

        <label className="block text-xs text-flux-text-tertiary mb-1">Description</label>
        <textarea
          required
          maxLength={255}
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Ex: Maintenance HP-01 vendredi 14h-18h"
          className="w-full mb-4 px-3 py-1.5 text-sm bg-flux-elevated border border-flux-border rounded-md text-flux-text-primary resize-none"
          disabled={isSaving}
        />

        {error && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-flux-elevated border border-flux-border text-flux-text-secondary hover:text-flux-text-primary"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white"
          >
            {isSaving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function SchedulingConstraintsPage() {
  const { data: constraints, isLoading } = useGetSchedulingConstraintsQuery();
  const [createConstraint, { isLoading: isCreating }] = useCreateSchedulingConstraintMutation();
  const [deleteConstraint] = useDeleteSchedulingConstraintMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sorted = useMemo<SchedulingConstraint[]>(
    () => [...(constraints ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt) * -1),
    [constraints],
  );

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette contrainte ?')) return;
    try {
      await deleteConstraint(id).unwrap();
    } catch (err) {
      console.error('Failed to delete constraint', err);
    }
  };

  const handleCreate = async (body: CreateSchedulingConstraintRequest) => {
    await createConstraint(body).unwrap();
    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 overflow-auto bg-flux-base">
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-flux-text-primary">
              Contraintes de scheduling
            </h1>
            <p className="text-sm text-flux-text-tertiary mt-1">
              Directives ponctuelles passées au moteur : indisponibilités machine, absences opérateur,
              durées forcées, démarrages épinglés.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nouvelle contrainte
          </button>
        </div>

        {isLoading ? (
          <div className="text-sm text-flux-text-muted">Chargement…</div>
        ) : sorted.length === 0 ? (
          <div className="bg-flux-surface border border-flux-border rounded-lg p-8 text-center text-flux-text-tertiary text-sm">
            Aucune contrainte. Cliquez « Nouvelle contrainte » pour en ajouter une.
          </div>
        ) : (
          <table className="w-full bg-flux-surface border border-flux-border rounded-lg overflow-hidden text-sm">
            <thead className="bg-flux-elevated text-[11px] uppercase text-flux-text-tertiary tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Target</th>
                <th className="text-left px-3 py-2">Plage</th>
                <th className="text-left px-3 py-2">Override</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-t border-flux-border text-flux-text-secondary">
                  <td className="px-3 py-2">
                    <span className="text-xs font-medium text-flux-text-primary">
                      {CONSTRAINT_TYPE_LABELS[c.constraintType]}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-flux-text-tertiary truncate max-w-[180px]">
                    {c.targetId}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {formatIsoShort(c.timeStart)} → {formatIsoShort(c.timeEnd)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.overrideValue !== null ? `${c.overrideValue} min` : '—'}
                  </td>
                  <td className="px-3 py-2 text-xs">{c.description}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      aria-label="Supprimer"
                      className="text-flux-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <CreateConstraintModal
          onCancel={() => setIsModalOpen(false)}
          onSave={handleCreate}
          isSaving={isCreating}
        />
      )}
    </div>
  );
}

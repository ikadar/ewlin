import { useState, useCallback } from 'react';
import type {
  PaperType,
  FeuilleFormat,
  ImpressionPreset,
  SurfacagePreset,
  ProductFormat,
  PostePreset,
} from '@flux/types';

/**
 * Session learning state — 6 learnable data types per §7.1.
 * All arrays start empty and accumulate user-entered values
 * during the current JCF modal session.
 */
export interface SessionLearningState {
  papiers: PaperType[];
  feuilleFormats: FeuilleFormat[];
  impressions: ImpressionPreset[];
  surfacages: SurfacagePreset[];
  productFormats: ProductFormat[];
  postes: PostePreset[];
}

export interface SessionLearningActions {
  /** Replace-merge: find by type (case-insensitive), replace entry or add new */
  learnPapier: (papier: PaperType) => void;
  /** Poses-merge: find by format (case-insensitive), merge new poses or add new */
  learnFeuilleFormat: (format: FeuilleFormat) => void;
  /** Dedup: skip if value already exists (case-insensitive) */
  learnImpression: (preset: ImpressionPreset) => void;
  /** Dedup: skip if value already exists (case-insensitive) */
  learnSurfacage: (preset: SurfacagePreset) => void;
  /** Dedup: skip if name already exists (case-insensitive) */
  learnProductFormat: (format: ProductFormat) => void;
  /** Dedup: skip if name already exists (case-insensitive) */
  learnPoste: (poste: PostePreset) => void;
}

/**
 * Session learning hook for JCF autocomplete fields.
 *
 * Manages 6 learnable data types with type-specific merge strategies
 * (§7, Session Learning). State is React-only — cleared on page reload.
 *
 * Called in JcfElementsTable. Individual autocomplete fields receive
 * session state + learn callbacks as props.
 */
export function useSessionLearning(): SessionLearningState &
  SessionLearningActions {
  const [papiers, setPapiers] = useState<PaperType[]>([]);
  const [feuilleFormats, setFeuilleFormats] = useState<FeuilleFormat[]>([]);
  const [impressions, setImpressions] = useState<ImpressionPreset[]>([]);
  const [surfacages, setSurfacages] = useState<SurfacagePreset[]>([]);
  const [productFormats, setProductFormats] = useState<ProductFormat[]>([]);
  const [postes, setPostes] = useState<PostePreset[]>([]);

  // ── Compound merge: PaperType ──────────────────────────────────────────
  // Caller provides the full PaperType (with already-merged grammages).
  // If the type exists (case-insensitive), replace the entry; else add new.
  const learnPapier = useCallback((papier: PaperType) => {
    setPapiers((prev) => {
      const idx = prev.findIndex(
        (p) => p.type.toLowerCase() === papier.type.toLowerCase(),
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = papier;
        return updated;
      }
      return [...prev, papier];
    });
  }, []);

  // ── Compound merge: FeuilleFormat ──────────────────────────────────────
  // Merges new poses into existing format entry (dedup poses).
  // If format doesn't exist, adds new entry.
  const learnFeuilleFormat = useCallback((format: FeuilleFormat) => {
    setFeuilleFormats((prev) => {
      const idx = prev.findIndex(
        (f) => f.format.toLowerCase() === format.format.toLowerCase(),
      );
      if (idx >= 0) {
        const existing = prev[idx];
        const newPoses = format.poses.filter(
          (p) => !existing.poses.includes(p),
        );
        if (newPoses.length === 0) return prev;
        const updated = [...prev];
        updated[idx] = {
          ...existing,
          poses: [...existing.poses, ...newPoses],
        };
        return updated;
      }
      return [...prev, format];
    });
  }, []);

  // ── Simple dedup: ImpressionPreset ─────────────────────────────────────
  const learnImpression = useCallback((preset: ImpressionPreset) => {
    setImpressions((prev) => {
      if (prev.some((p) => p.value.toLowerCase() === preset.value.toLowerCase())) {
        return prev;
      }
      return [...prev, preset];
    });
  }, []);

  // ── Simple dedup: SurfacagePreset ──────────────────────────────────────
  const learnSurfacage = useCallback((preset: SurfacagePreset) => {
    setSurfacages((prev) => {
      if (prev.some((p) => p.value.toLowerCase() === preset.value.toLowerCase())) {
        return prev;
      }
      return [...prev, preset];
    });
  }, []);

  // ── Simple dedup: ProductFormat ────────────────────────────────────────
  const learnProductFormat = useCallback((format: ProductFormat) => {
    setProductFormats((prev) => {
      if (prev.some((f) => f.name.toLowerCase() === format.name.toLowerCase())) {
        return prev;
      }
      return [...prev, format];
    });
  }, []);

  // ── Simple dedup: PostePreset ──────────────────────────────────────────
  const learnPoste = useCallback((poste: PostePreset) => {
    setPostes((prev) => {
      if (prev.some((p) => p.name.toLowerCase() === poste.name.toLowerCase())) {
        return prev;
      }
      return [...prev, poste];
    });
  }, []);

  return {
    papiers,
    feuilleFormats,
    impressions,
    surfacages,
    productFormats,
    postes,
    learnPapier,
    learnFeuilleFormat,
    learnImpression,
    learnSurfacage,
    learnProductFormat,
    learnPoste,
  };
}

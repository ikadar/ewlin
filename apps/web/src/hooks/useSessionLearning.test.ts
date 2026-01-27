import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionLearning } from './useSessionLearning';
import type {
  PaperType,
  FeuilleFormat,
  ImpressionPreset,
  SurfacagePreset,
  ProductFormat,
  PostePreset,
} from '@flux/types';

describe('useSessionLearning', () => {
  it('initially all arrays are empty', () => {
    const { result } = renderHook(() => useSessionLearning());

    expect(result.current.papiers).toEqual([]);
    expect(result.current.feuilleFormats).toEqual([]);
    expect(result.current.impressions).toEqual([]);
    expect(result.current.surfacages).toEqual([]);
    expect(result.current.productFormats).toEqual([]);
    expect(result.current.postes).toEqual([]);
  });

  describe('learnPapier (replace-merge)', () => {
    it('adds new paper type', () => {
      const { result } = renderHook(() => useSessionLearning());
      const papier: PaperType = {
        id: 'p1',
        type: 'Couché mat',
        grammages: [135, 170],
      };

      act(() => result.current.learnPapier(papier));

      expect(result.current.papiers).toEqual([papier]);
    });

    it('replaces existing type (case-insensitive match)', () => {
      const { result } = renderHook(() => useSessionLearning());
      const first: PaperType = {
        id: 'p1',
        type: 'Couché mat',
        grammages: [135],
      };
      const updated: PaperType = {
        id: 'p1',
        type: 'couché mat',
        grammages: [135, 170, 250],
      };

      act(() => result.current.learnPapier(first));
      act(() => result.current.learnPapier(updated));

      expect(result.current.papiers).toHaveLength(1);
      expect(result.current.papiers[0].grammages).toEqual([135, 170, 250]);
    });

    it('adds multiple distinct paper types', () => {
      const { result } = renderHook(() => useSessionLearning());
      const mat: PaperType = { id: 'p1', type: 'Couché mat', grammages: [135] };
      const offset: PaperType = { id: 'p2', type: 'Offset', grammages: [80] };

      act(() => result.current.learnPapier(mat));
      act(() => result.current.learnPapier(offset));

      expect(result.current.papiers).toHaveLength(2);
    });
  });

  describe('learnFeuilleFormat (poses-merge)', () => {
    it('adds new format', () => {
      const { result } = renderHook(() => useSessionLearning());
      const format: FeuilleFormat = { format: '50x70', poses: [8, 16] };

      act(() => result.current.learnFeuilleFormat(format));

      expect(result.current.feuilleFormats).toEqual([format]);
    });

    it('merges poses for existing format (case-insensitive)', () => {
      const { result } = renderHook(() => useSessionLearning());
      const first: FeuilleFormat = { format: '50x70', poses: [8] };
      const second: FeuilleFormat = { format: '50X70', poses: [16, 32] };

      act(() => result.current.learnFeuilleFormat(first));
      act(() => result.current.learnFeuilleFormat(second));

      expect(result.current.feuilleFormats).toHaveLength(1);
      expect(result.current.feuilleFormats[0].poses).toEqual([8, 16, 32]);
    });

    it('does not duplicate existing poses', () => {
      const { result } = renderHook(() => useSessionLearning());
      const first: FeuilleFormat = { format: '50x70', poses: [8, 16] };
      const second: FeuilleFormat = { format: '50x70', poses: [8, 32] };

      act(() => result.current.learnFeuilleFormat(first));
      act(() => result.current.learnFeuilleFormat(second));

      expect(result.current.feuilleFormats[0].poses).toEqual([8, 16, 32]);
    });

    it('returns same state when no new poses to add', () => {
      const { result } = renderHook(() => useSessionLearning());
      const format: FeuilleFormat = { format: '50x70', poses: [8] };

      act(() => result.current.learnFeuilleFormat(format));
      const before = result.current.feuilleFormats;
      act(() => result.current.learnFeuilleFormat({ format: '50x70', poses: [8] }));

      expect(result.current.feuilleFormats).toBe(before);
    });
  });

  describe('learnImpression (simple dedup)', () => {
    it('adds new preset', () => {
      const { result } = renderHook(() => useSessionLearning());
      const preset: ImpressionPreset = {
        id: 'i1',
        value: 'Q/Q',
        description: 'Quadri R/V',
      };

      act(() => result.current.learnImpression(preset));

      expect(result.current.impressions).toEqual([preset]);
    });

    it('skips duplicate (case-insensitive value match)', () => {
      const { result } = renderHook(() => useSessionLearning());
      const first: ImpressionPreset = {
        id: 'i1',
        value: 'Q/Q',
        description: 'Quadri R/V',
      };
      const duplicate: ImpressionPreset = {
        id: 'i2',
        value: 'q/q',
        description: 'Different desc',
      };

      act(() => result.current.learnImpression(first));
      act(() => result.current.learnImpression(duplicate));

      expect(result.current.impressions).toHaveLength(1);
      expect(result.current.impressions[0]).toBe(first);
    });
  });

  describe('learnSurfacage (simple dedup)', () => {
    it('adds new preset', () => {
      const { result } = renderHook(() => useSessionLearning());
      const preset: SurfacagePreset = {
        id: 's1',
        value: 'mat/mat',
        description: 'Pelli mat R/V',
      };

      act(() => result.current.learnSurfacage(preset));

      expect(result.current.surfacages).toEqual([preset]);
    });

    it('skips duplicate (case-insensitive value match)', () => {
      const { result } = renderHook(() => useSessionLearning());
      const first: SurfacagePreset = {
        id: 's1',
        value: 'mat/mat',
        description: 'Pelli mat R/V',
      };

      act(() => result.current.learnSurfacage(first));
      act(() =>
        result.current.learnSurfacage({
          id: 's2',
          value: 'MAT/MAT',
          description: 'other',
        }),
      );

      expect(result.current.surfacages).toHaveLength(1);
    });
  });

  describe('learnProductFormat (simple dedup)', () => {
    it('adds new format', () => {
      const { result } = renderHook(() => useSessionLearning());
      const format: ProductFormat = {
        id: 'f1',
        name: 'A4',
        width: 210,
        height: 297,
      };

      act(() => result.current.learnProductFormat(format));

      expect(result.current.productFormats).toEqual([format]);
    });

    it('skips duplicate (case-insensitive name match)', () => {
      const { result } = renderHook(() => useSessionLearning());
      const first: ProductFormat = {
        id: 'f1',
        name: 'A4',
        width: 210,
        height: 297,
      };

      act(() => result.current.learnProductFormat(first));
      act(() =>
        result.current.learnProductFormat({
          id: 'f2',
          name: 'a4',
          width: 210,
          height: 297,
        }),
      );

      expect(result.current.productFormats).toHaveLength(1);
    });
  });

  describe('learnPoste (simple dedup)', () => {
    it('adds new poste', () => {
      const { result } = renderHook(() => useSessionLearning());
      const poste: PostePreset = {
        name: 'G37',
        category: 'Presse offset',
      };

      act(() => result.current.learnPoste(poste));

      expect(result.current.postes).toEqual([poste]);
    });

    it('skips duplicate (case-insensitive name match)', () => {
      const { result } = renderHook(() => useSessionLearning());
      const first: PostePreset = {
        name: 'G37',
        category: 'Presse offset',
      };

      act(() => result.current.learnPoste(first));
      act(() =>
        result.current.learnPoste({
          name: 'g37',
          category: 'Presse offset',
        }),
      );

      expect(result.current.postes).toHaveLength(1);
    });
  });
});

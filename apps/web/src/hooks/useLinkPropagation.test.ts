import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLinkPropagation, LINKABLE_FIELDS, isLinkableField, isFieldLinked } from './useLinkPropagation';
import type { JcfElement } from '../components/JcfElementsTable/types';

const createMockElement = (overrides: Partial<JcfElement> = {}): JcfElement => ({
  name: 'ELT',
  precedences: '',
  quantite: '1',
  format: '',
  pagination: '',
  papier: '',
  imposition: '',
  impression: '',
  surfacage: '',
  autres: '',
  qteFeuilles: '',
  commentaires: '',
  sequence: '',
  ...overrides,
});

describe('useLinkPropagation', () => {
  describe('helper functions', () => {
    it('LINKABLE_FIELDS contains correct fields', () => {
      expect(LINKABLE_FIELDS).toEqual(['format', 'papier', 'imposition', 'impression', 'surfacage']);
    });

    it('isLinkableField returns true for linkable fields', () => {
      expect(isLinkableField('format')).toBe(true);
      expect(isLinkableField('papier')).toBe(true);
      expect(isLinkableField('imposition')).toBe(true);
      expect(isLinkableField('impression')).toBe(true);
      expect(isLinkableField('surfacage')).toBe(true);
    });

    it('isLinkableField returns false for non-linkable fields', () => {
      expect(isLinkableField('name')).toBe(false);
      expect(isLinkableField('quantite')).toBe(false);
      expect(isLinkableField('sequence')).toBe(false);
    });

    it('isFieldLinked returns true when field is linked', () => {
      const element = createMockElement({ links: { format: true } });
      expect(isFieldLinked(element, 'format')).toBe(true);
    });

    it('isFieldLinked returns false when field is not linked', () => {
      const element = createMockElement({ links: { format: false } });
      expect(isFieldLinked(element, 'format')).toBe(false);
    });

    it('isFieldLinked returns false when links is undefined', () => {
      const element = createMockElement();
      expect(isFieldLinked(element, 'format')).toBe(false);
    });
  });

  describe('canLink', () => {
    it('returns false for first element (index 0)', () => {
      const elements = [createMockElement(), createMockElement()];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      expect(result.current.canLink(0)).toBe(false);
    });

    it('returns true for subsequent elements', () => {
      const elements = [createMockElement(), createMockElement(), createMockElement()];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      expect(result.current.canLink(1)).toBe(true);
      expect(result.current.canLink(2)).toBe(true);
    });

    it('returns false for out of bounds index', () => {
      const elements = [createMockElement()];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      expect(result.current.canLink(5)).toBe(false);
    });
  });

  describe('isLinked', () => {
    it('returns false for first element', () => {
      const elements = [
        createMockElement({ links: { format: true } }), // Even if set, first element can't link
      ];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      expect(result.current.isLinked(0, 'format')).toBe(false);
    });

    it('returns true for linked field on subsequent element', () => {
      const elements = [
        createMockElement(),
        createMockElement({ links: { format: true } }),
      ];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      expect(result.current.isLinked(1, 'format')).toBe(true);
    });

    it('returns false for unlinked field', () => {
      const elements = [
        createMockElement(),
        createMockElement({ links: { format: false } }),
      ];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      expect(result.current.isLinked(1, 'format')).toBe(false);
    });
  });

  describe('toggleLink', () => {
    it('does nothing for first element', () => {
      const elements = [createMockElement()];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      act(() => {
        result.current.toggleLink(0, 'format');
      });

      expect(onElementsChange).not.toHaveBeenCalled();
    });

    it('links field and copies value from previous element', () => {
      const elements = [
        createMockElement({ format: 'A4' }),
        createMockElement({ format: '' }),
      ];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      act(() => {
        result.current.toggleLink(1, 'format');
      });

      expect(onElementsChange).toHaveBeenCalledWith([
        elements[0],
        expect.objectContaining({
          format: 'A4', // Copied from previous
          links: { format: true },
        }),
      ]);
    });

    it('unlinks field and preserves current value', () => {
      const elements = [
        createMockElement({ format: 'A4' }),
        createMockElement({ format: 'A4', links: { format: true } }),
      ];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      act(() => {
        result.current.toggleLink(1, 'format');
      });

      expect(onElementsChange).toHaveBeenCalledWith([
        elements[0],
        expect.objectContaining({
          format: 'A4', // Preserved
          links: { format: false },
        }),
      ]);
    });
  });

  describe('updateFieldWithPropagation', () => {
    it('updates source element', () => {
      const elements = [
        createMockElement({ format: '' }),
        createMockElement({ format: '' }),
      ];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      act(() => {
        result.current.updateFieldWithPropagation(0, 'format', 'A4');
      });

      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ format: 'A4' }),
        expect.objectContaining({ format: '' }), // Not linked, no propagation
      ]);
    });

    it('propagates to linked downstream elements', () => {
      const elements = [
        createMockElement({ format: '' }),
        createMockElement({ format: '', links: { format: true } }),
        createMockElement({ format: '', links: { format: true } }),
      ];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      act(() => {
        result.current.updateFieldWithPropagation(0, 'format', 'A4');
      });

      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ format: 'A4' }),
        expect.objectContaining({ format: 'A4' }), // Propagated
        expect.objectContaining({ format: 'A4' }), // Propagated through chain
      ]);
    });

    it('stops propagation at unlinked element', () => {
      const elements = [
        createMockElement({ format: '' }),
        createMockElement({ format: '', links: { format: true } }),
        createMockElement({ format: 'A3', links: { format: false } }), // Not linked
        createMockElement({ format: '', links: { format: true } }), // Linked to previous
      ];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      act(() => {
        result.current.updateFieldWithPropagation(0, 'format', 'A4');
      });

      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ format: 'A4' }),
        expect.objectContaining({ format: 'A4' }), // Propagated
        expect.objectContaining({ format: 'A3' }), // Not propagated (not linked)
        expect.objectContaining({ format: 'A3' }), // Gets value from previous (element 2)
      ]);
    });

    it('only propagates the specific field that was updated', () => {
      const elements = [
        createMockElement({ format: '', papier: 'Couché mat 135g' }),
        createMockElement({ format: '', papier: '', links: { format: true, papier: true } }),
      ];
      const onElementsChange = vi.fn();

      const { result } = renderHook(() =>
        useLinkPropagation({ elements, onElementsChange })
      );

      act(() => {
        result.current.updateFieldWithPropagation(0, 'format', 'A4');
      });

      // Only format should be propagated (the field we updated)
      // papier remains '' in element 1 because we only updated format
      expect(onElementsChange).toHaveBeenCalledWith([
        expect.objectContaining({ format: 'A4', papier: 'Couché mat 135g' }),
        expect.objectContaining({ format: 'A4', papier: '' }), // papier not propagated yet
      ]);
    });
  });
});

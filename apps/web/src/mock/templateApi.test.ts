import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  searchTemplates,
  getTemplateCategories,
  resetTemplates,
  clearTemplates,
} from './templateApi';
import type { JcfTemplateCreateInput } from '@flux/types';

describe('templateApi', () => {
  beforeEach(() => {
    // Reset to seed data before each test
    resetTemplates();
  });

  describe('getTemplates', () => {
    it('returns seed templates on first load', () => {
      const templates = getTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('elements');
    });

    it('includes expected seed template names', () => {
      const templates = getTemplates();
      const names = templates.map((t) => t.name);
      expect(names).toContain('Brochure A4 piquée');
      expect(names).toContain('Dépliant 3 volets');
    });
  });

  describe('getTemplate', () => {
    it('returns template by ID', () => {
      const templates = getTemplates();
      const first = templates[0];
      const result = getTemplate(first.id);
      expect(result).toEqual(first);
    });

    it('returns null for non-existent ID', () => {
      const result = getTemplate('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('createTemplate', () => {
    it('creates a new template with generated ID', async () => {
      const input: JcfTemplateCreateInput = {
        name: 'Test Template',
        description: 'A test template',
        category: 'Test',
        elements: [
          {
            name: 'ELT1',
            precedences: '',
            quantite: '1',
            format: 'A4',
            pagination: '4',
            papier: 'Offset 80g',
            imposition: '',
            impression: 'Q/Q',
            surfacage: '',
            autres: '',
            qteFeuilles: '',
            commentaires: '',
            sequence: '',
          },
        ],
      };

      const created = await createTemplate(input);

      expect(created.id).toBeTruthy();
      expect(created.id).toMatch(/^tpl-/);
      expect(created.name).toBe('Test Template');
      expect(created.description).toBe('A test template');
      expect(created.category).toBe('Test');
      expect(created.elements).toHaveLength(1);
      expect(created.createdAt).toBeTruthy();
      expect(created.updatedAt).toBeTruthy();
    });

    it('persists the new template', async () => {
      const input: JcfTemplateCreateInput = {
        name: 'Persisted Template',
        elements: [],
      };

      const created = await createTemplate(input);
      const retrieved = getTemplate(created.id);

      expect(retrieved).toEqual(created);
    });

    it('allows templates without optional fields', async () => {
      const input: JcfTemplateCreateInput = {
        name: 'Minimal Template',
        elements: [],
      };

      const created = await createTemplate(input);

      expect(created.name).toBe('Minimal Template');
      expect(created.description).toBeUndefined();
      expect(created.category).toBeUndefined();
      expect(created.clientName).toBeUndefined();
    });
  });

  describe('updateTemplate', () => {
    it('updates template name', async () => {
      const templates = getTemplates();
      const first = templates[0];

      const updated = await updateTemplate(first.id, { name: 'Updated Name' });

      expect(updated.name).toBe('Updated Name');
      expect(updated.id).toBe(first.id);
      expect(updated.createdAt).toBe(first.createdAt);
    });

    it('updates template elements', async () => {
      const templates = getTemplates();
      const first = templates[0];
      const newElements = [
        {
          name: 'NEW',
          precedences: '',
          quantite: '1',
          format: 'A5',
          pagination: '2',
          papier: '',
          imposition: '',
          impression: '',
          surfacage: '',
          autres: '',
          qteFeuilles: '',
          commentaires: '',
          sequence: '',
        },
      ];

      const updated = await updateTemplate(first.id, { elements: newElements });

      expect(updated.elements).toHaveLength(1);
      expect(updated.elements[0].name).toBe('NEW');
    });

    it('updates updatedAt timestamp', async () => {
      const templates = getTemplates();
      const first = templates[0];
      const originalUpdatedAt = first.updatedAt;

      // Small delay to ensure different timestamp
      const updated = await updateTemplate(first.id, { name: 'New Name' });

      expect(updated.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('throws for non-existent ID', async () => {
      await expect(updateTemplate('non-existent', { name: 'Test' })).rejects.toThrow(
        'Template not found'
      );
    });

    it('preserves ID and createdAt on update', async () => {
      const templates = getTemplates();
      const first = templates[0];

      const updated = await updateTemplate(first.id, {
        name: 'New Name',
        // @ts-expect-error - Testing that these are ignored
        id: 'hacked-id',
        createdAt: '1999-01-01T00:00:00.000Z',
      });

      expect(updated.id).toBe(first.id);
      expect(updated.createdAt).toBe(first.createdAt);
    });
  });

  describe('deleteTemplate', () => {
    it('removes template from storage', () => {
      const templates = getTemplates();
      const first = templates[0];
      const initialCount = templates.length;

      deleteTemplate(first.id);

      const remaining = getTemplates();
      expect(remaining.length).toBe(initialCount - 1);
      expect(getTemplate(first.id)).toBeNull();
    });

    it('throws for non-existent ID', () => {
      expect(() => deleteTemplate('non-existent')).toThrow('Template not found');
    });
  });

  describe('searchTemplates', () => {
    it('returns all templates for empty query', () => {
      const all = getTemplates();
      const result = searchTemplates('');
      expect(result).toEqual(all);
    });

    it('searches by name', () => {
      const result = searchTemplates('piquée');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((t) => t.name.toLowerCase().includes('piquée'))).toBe(true);
    });

    it('searches by category', () => {
      const result = searchTemplates('Feuillet');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((t) => t.category?.toLowerCase().includes('feuillet'))).toBe(
        true
      );
    });

    it('searches by client name', () => {
      const result = searchTemplates('SNCF');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((t) => t.clientName?.toLowerCase().includes('sncf'))).toBe(
        true
      );
    });

    it('is case-insensitive', () => {
      const lower = searchTemplates('brochure');
      const upper = searchTemplates('BROCHURE');
      const mixed = searchTemplates('BrOcHuRe');
      expect(lower).toEqual(upper);
      expect(upper).toEqual(mixed);
    });

    it('returns empty array for no matches', () => {
      const result = searchTemplates('zzzznonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('getTemplateCategories', () => {
    it('returns unique sorted categories', () => {
      const categories = getTemplateCategories();
      expect(categories).toContain('Brochure');
      expect(categories).toContain('Feuillet');
      // Verify sorted
      const sorted = [...categories].sort((a, b) => a.localeCompare(b, 'fr'));
      expect(categories).toEqual(sorted);
    });

    it('excludes empty categories', () => {
      const categories = getTemplateCategories();
      expect(categories.every((c) => c.length > 0)).toBe(true);
    });
  });

  describe('resetTemplates', () => {
    it('restores seed data', () => {
      // Modify data
      const templates = getTemplates();
      deleteTemplate(templates[0].id);
      createTemplate({ name: 'New', elements: [] });

      // Reset
      resetTemplates();

      const restored = getTemplates();
      expect(restored.find((t) => t.name === 'Brochure A4 piquée')).toBeTruthy();
      expect(restored.find((t) => t.name === 'New')).toBeFalsy();
    });
  });

  describe('clearTemplates', () => {
    it('removes all templates from storage', () => {
      clearTemplates();
      // Next getTemplates will re-seed, so we check localStorage directly
      expect(localStorage.getItem('flux-jcf-templates')).toBeNull();
    });
  });
});

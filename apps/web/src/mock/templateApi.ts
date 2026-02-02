/**
 * Template Mock API
 * LocalStorage-based template CRUD operations.
 *
 * @see v0.4.34 - JCF: Template CRUD & Apply
 */

import type {
  JcfTemplate,
  JcfTemplateCreateInput,
  JcfTemplateUpdateInput,
} from '@flux/types';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'flux-jcf-templates';

// ============================================================================
// Seed Data
// ============================================================================

/**
 * Default templates seeded on first load.
 */
const SEED_TEMPLATES: JcfTemplate[] = [
  {
    id: 'tpl-seed-001',
    name: 'Brochure A4 piquée',
    description: 'Brochure format A4 avec couverture et intérieur, reliure agrafes',
    category: 'Brochure',
    elements: [
      {
        name: 'COUV',
        precedences: '',
        quantite: '1',
        format: 'A4f',
        pagination: '4',
        papier: 'Couché mat 250g',
        imposition: '50x70(8)',
        impression: 'Q/Q',
        surfacage: 'mat/',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'G37(20)\nStahl(30)',
        sequenceWorkflow: ['Presse offset', 'Plieuse'],
      },
      {
        name: 'INT',
        precedences: '',
        quantite: '1',
        format: 'A4f',
        pagination: '16',
        papier: 'Couché mat 135g',
        imposition: '50x70(16)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'G37(40)\nStahl(30)',
        sequenceWorkflow: ['Presse offset', 'Plieuse'],
      },
      {
        name: 'FINITION',
        precedences: 'COUV, INT',
        quantite: '1',
        format: '',
        pagination: '',
        papier: '',
        imposition: '',
        impression: '',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Reliure piquée 2 agrafes',
        sequence: 'H(60)\nCarton(30)',
        sequenceWorkflow: ['Encarteuse-piqueuse', 'Conditionnement'],
      },
    ],
    createdAt: '2025-01-15T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
  },
  {
    id: 'tpl-seed-002',
    name: 'Catalogue 32 pages',
    description: 'Catalogue format A4 avec couverture rigide et intérieur, dos carré collé',
    category: 'Brochure',
    elements: [
      {
        name: 'COUV',
        precedences: '',
        quantite: '1',
        format: 'A4f',
        pagination: '4',
        papier: 'Couché brillant 300g',
        imposition: '50x70(8)',
        impression: 'Q/Q',
        surfacage: 'brillant/brillant',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'G37(30)\nSBG(20)',
        sequenceWorkflow: ['Presse offset', 'Typo'],
      },
      {
        name: 'INT',
        precedences: '',
        quantite: '1',
        format: 'A4f',
        pagination: '32',
        papier: 'Couché satin 115g',
        imposition: '70x100(32)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: '754(60)\nMBO(40)',
        sequenceWorkflow: ['Presse offset', 'Plieuse'],
      },
      {
        name: 'FINITION',
        precedences: 'COUV, INT',
        quantite: '1',
        format: '',
        pagination: '',
        papier: '',
        imposition: '',
        impression: '',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Dos carré collé',
        sequence: 'ST:MCA(3j):dos carré collé\nCarton(30)',
        sequenceWorkflow: ['Conditionnement'],
      },
    ],
    createdAt: '2025-01-10T14:30:00.000Z',
    updatedAt: '2025-01-20T09:15:00.000Z',
  },
  {
    id: 'tpl-seed-003',
    name: 'Dépliant 3 volets',
    description: 'Dépliant A4 ouvert, 3 volets pliés en accordéon',
    category: 'Feuillet',
    elements: [
      {
        name: 'DEP',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '6',
        papier: 'Couché mat 170g',
        imposition: '50x70(4)',
        impression: 'Q/Q',
        surfacage: 'mat/mat',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Pli accordéon',
        sequence: 'G37(30)\nP137(15)\nStahl(20)\nCarton(30)',
        sequenceWorkflow: ['Presse offset', 'Massicot', 'Plieuse', 'Conditionnement'],
      },
    ],
    createdAt: '2025-01-05T08:00:00.000Z',
    updatedAt: '2025-01-05T08:00:00.000Z',
  },
  {
    id: 'tpl-seed-004',
    name: 'Carte de visite',
    clientName: 'Publicis France',
    description: 'Carte de visite 85x55mm, pelliculage mat R/V',
    category: 'Feuillet',
    elements: [
      {
        name: 'CDV',
        precedences: '',
        quantite: '1',
        format: '85x55',
        pagination: '2',
        papier: 'Couché mat 350g',
        imposition: '32x45(32)',
        impression: 'Q/Q',
        surfacage: 'mat/mat',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'C9500(20)\nP137(10)\nFilm(15)',
        sequenceWorkflow: ['Presse numérique', 'Massicot', 'Conditionnement'],
      },
    ],
    createdAt: '2025-01-12T11:00:00.000Z',
    updatedAt: '2025-01-12T11:00:00.000Z',
  },
  {
    id: 'tpl-seed-005',
    name: 'Affiche A2',
    clientName: 'SNCF Communication',
    description: 'Affiche grand format A2, impression numérique',
    category: 'Feuillet',
    elements: [
      {
        name: 'AFF',
        precedences: '',
        quantite: '1',
        format: 'A2',
        pagination: '1',
        papier: 'Couché brillant 170g',
        imposition: '50x70(2)',
        impression: 'Q/',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'C9500(30)\nP137(15)\nCarton(20)',
        sequenceWorkflow: ['Presse numérique', 'Massicot', 'Conditionnement'],
      },
    ],
    createdAt: '2025-01-08T16:00:00.000Z',
    updatedAt: '2025-01-22T10:30:00.000Z',
  },
  {
    id: 'tpl-seed-006',
    name: 'Flyer A5',
    clientName: 'La Poste',
    description: 'Flyer A5 pour mailings, recto-verso',
    category: 'Feuillet',
    elements: [
      {
        name: 'FLYER',
        precedences: '',
        quantite: '1',
        format: 'A5',
        pagination: '2',
        papier: 'Offset 90g',
        imposition: '50x70(16)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'G37(25)\nP137(10)\nCarton(20)',
        sequenceWorkflow: ['Presse offset', 'Massicot', 'Conditionnement'],
      },
    ],
    createdAt: '2025-01-18T09:00:00.000Z',
    updatedAt: '2025-01-18T09:00:00.000Z',
  },
  {
    id: 'tpl-seed-007',
    name: 'Brochure A4',
    description: 'Brochure A4 simple avec workflow standard',
    category: 'Brochure',
    elements: [
      {
        name: 'CORP',
        precedences: '',
        quantite: '1',
        format: 'A4f',
        pagination: '8',
        papier: 'Couché mat 170g',
        imposition: '50x70(8)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: '',
        sequenceWorkflow: ['Presse offset', 'Massicot', 'Plieuse', 'Conditionnement'],
      },
    ],
    createdAt: '2025-01-20T14:00:00.000Z',
    updatedAt: '2025-01-20T14:00:00.000Z',
  },
];

// ============================================================================
// Storage Utilities
// ============================================================================

/**
 * Load templates from localStorage, seeding if empty.
 */
function loadTemplates(): JcfTemplate[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // First load: seed with default templates
      saveTemplates(SEED_TEMPLATES);
      return [...SEED_TEMPLATES];
    }
    return JSON.parse(stored) as JcfTemplate[];
  } catch (error) {
    console.error('Failed to load templates from localStorage:', error);
    return [...SEED_TEMPLATES];
  }
}

/**
 * Save templates to localStorage.
 */
function saveTemplates(templates: JcfTemplate[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save templates to localStorage:', error);
  }
}

/**
 * Generate a unique template ID.
 */
function generateId(): string {
  return `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get current ISO timestamp.
 */
function now(): string {
  return new Date().toISOString();
}

// ============================================================================
// Mock API Functions
// ============================================================================

/**
 * Get all templates.
 */
export function getTemplates(): JcfTemplate[] {
  return loadTemplates();
}

/**
 * Get a single template by ID.
 */
export function getTemplate(id: string): JcfTemplate | null {
  const templates = loadTemplates();
  return templates.find((t) => t.id === id) ?? null;
}

/**
 * Create a new template.
 */
export function createTemplate(data: JcfTemplateCreateInput): JcfTemplate {
  const templates = loadTemplates();
  const timestamp = now();

  const newTemplate: JcfTemplate = {
    id: generateId(),
    name: data.name,
    description: data.description,
    category: data.category,
    clientName: data.clientName,
    elements: data.elements,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  templates.push(newTemplate);
  saveTemplates(templates);

  return newTemplate;
}

/**
 * Update an existing template.
 */
export function updateTemplate(id: string, data: JcfTemplateUpdateInput): JcfTemplate {
  const templates = loadTemplates();
  const index = templates.findIndex((t) => t.id === id);

  if (index === -1) {
    throw new Error(`Template not found: ${id}`);
  }

  const existing = templates[index];
  const updated: JcfTemplate = {
    ...existing,
    ...data,
    id: existing.id, // Prevent ID override
    createdAt: existing.createdAt, // Preserve creation timestamp
    updatedAt: now(),
  };

  templates[index] = updated;
  saveTemplates(templates);

  return updated;
}

/**
 * Delete a template by ID.
 */
export function deleteTemplate(id: string): void {
  const templates = loadTemplates();
  const filtered = templates.filter((t) => t.id !== id);

  if (filtered.length === templates.length) {
    throw new Error(`Template not found: ${id}`);
  }

  saveTemplates(filtered);
}

/**
 * Search templates by name, category, or client.
 */
export function searchTemplates(query: string): JcfTemplate[] {
  const templates = loadTemplates();
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return templates;
  }

  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.category?.toLowerCase().includes(lowerQuery) ||
      t.clientName?.toLowerCase().includes(lowerQuery) ||
      t.description?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get all unique categories from templates.
 */
export function getTemplateCategories(): string[] {
  const templates = loadTemplates();
  const categories = new Set<string>();

  templates.forEach((t) => {
    if (t.category) {
      categories.add(t.category);
    }
  });

  return Array.from(categories).sort((a, b) => a.localeCompare(b, 'fr'));
}

/**
 * Reset templates to seed data (for testing).
 */
export function resetTemplates(): void {
  saveTemplates([...SEED_TEMPLATES]);
}

/**
 * Clear all templates (for testing).
 */
export function clearTemplates(): void {
  localStorage.removeItem(STORAGE_KEY);
}

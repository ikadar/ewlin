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
  // --- Route 1: Flyer (Offset → Massicot → Conditionnement) ---
  {
    id: 'tpl-louis-001',
    name: 'Flyer A5 promo',
    description: 'Flyer A5 recto-verso, offset quadri sur couché mat, massicotage et conditionnement',
    category: 'Feuillet',
    elements: [
      {
        name: 'FLYER',
        precedences: '',
        quantite: '1',
        format: 'A5',
        pagination: '2',
        papier: 'Couché mat:135',
        imposition: '50x70(8)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'Presses Offset\nMassicots\nConditionnement',
        sequenceWorkflow: ['Presses Offset', 'Massicots', 'Conditionnement'],
      },
    ],
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'tpl-louis-002',
    name: 'Flyer A4 événementiel',
    clientName: 'LVMH',
    description: 'Flyer A4 R/V sur couché brillant 170g pour événementiel, tirage 5000 ex.',
    category: 'Feuillet',
    elements: [
      {
        name: 'FLYER',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '2',
        papier: 'Couché brillant:170',
        imposition: '50x70(4)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Tirage 5000 ex.',
        sequence: 'Presses Offset\nMassicots\nConditionnement',
        sequenceWorkflow: ['Presses Offset', 'Massicots', 'Conditionnement'],
      },
    ],
    createdAt: '2026-01-10T14:30:00.000Z',
    updatedAt: '2026-02-05T09:15:00.000Z',
  },
  // --- Route 2: Dépliant (Offset → Massicot → Plieuse → Conditionnement) ---
  {
    id: 'tpl-louis-003',
    name: 'Dépliant 3 volets',
    description: 'Dépliant A4 ouvert, 3 volets pli accordéon, couché mat 170g pelliculé R/V',
    category: 'Feuillet',
    elements: [
      {
        name: 'DEP',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '6',
        papier: 'Couché mat:170',
        imposition: '50x70(4)',
        impression: 'Q/Q',
        surfacage: 'mat/mat',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Pli accordéon 3 volets',
        sequence: 'Presses Offset\nMassicots\nPlieuses\nConditionnement',
        sequenceWorkflow: ['Presses Offset', 'Massicots', 'Plieuses', 'Conditionnement'],
      },
    ],
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-01-05T08:00:00.000Z',
  },
  {
    id: 'tpl-louis-004',
    name: 'Dépliant 2 volets A4 produit',
    clientName: "L'Oréal",
    description: 'Dépliant A3 ouvert plié en 2, couché brillant 200g, pour brochure produit',
    category: 'Feuillet',
    elements: [
      {
        name: 'DEP',
        precedences: '',
        quantite: '1',
        format: 'A3',
        pagination: '4',
        papier: 'Couché brillant:200',
        imposition: '50x70(4)',
        impression: 'Q/Q',
        surfacage: 'brillant/',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Pli central',
        sequence: 'Presses Offset\nMassicots\nPlieuses\nConditionnement',
        sequenceWorkflow: ['Presses Offset', 'Massicots', 'Plieuses', 'Conditionnement'],
      },
    ],
    createdAt: '2026-01-20T11:00:00.000Z',
    updatedAt: '2026-01-20T11:00:00.000Z',
  },
  // --- Route 3: Brochure piquée (Couv→Offset+Massicot, Cah→Offset+Plieuse, Fin→Encarteuse+Cond) ---
  {
    id: 'tpl-louis-005',
    name: 'Brochure piquée A4 16p',
    description: 'Brochure 16 pages format A4, couverture 250g + intérieur 115g, reliure 2 agrafes',
    category: 'Brochure',
    elements: [
      {
        name: 'COUV',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '4',
        papier: 'Couché mat:250',
        imposition: '65x90(16)',
        impression: 'Q/Q',
        surfacage: 'mat/',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
      },
      {
        name: 'CAH1',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '8',
        papier: 'Couché mat:115',
        imposition: '65x90(16)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'Presses Offset\nPlieuses',
        sequenceWorkflow: ['Presses Offset', 'Plieuses'],
      },
      {
        name: 'CAH2',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '8',
        papier: 'Couché mat:115',
        imposition: '65x90(16)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'Presses Offset\nPlieuses',
        sequenceWorkflow: ['Presses Offset', 'Plieuses'],
        links: { format: true, papier: true, imposition: true, impression: true },
      },
      {
        name: 'FINITION',
        precedences: 'COUV, CAH1, CAH2',
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
        sequence: 'Encarteuses-Piqueuses\nConditionnement',
        sequenceWorkflow: ['Encarteuses-Piqueuses', 'Conditionnement'],
      },
    ],
    createdAt: '2026-01-08T16:00:00.000Z',
    updatedAt: '2026-02-10T10:30:00.000Z',
  },
  {
    id: 'tpl-louis-006',
    name: 'Brochure piquée A5 24p corporate',
    clientName: 'BNP Paribas',
    description: 'Brochure 24 pages format A5 pour communication corporate, couché satin',
    category: 'Brochure',
    elements: [
      {
        name: 'COUV',
        precedences: '',
        quantite: '1',
        format: 'A5',
        pagination: '4',
        papier: 'Couché satin:250',
        imposition: '50x70(16)',
        impression: 'Q/Q',
        surfacage: 'mat/',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
      },
      {
        name: 'CAH1',
        precedences: '',
        quantite: '1',
        format: 'A5',
        pagination: '12',
        papier: 'Couché satin:115',
        imposition: '50x70(16)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'Presses Offset\nPlieuses',
        sequenceWorkflow: ['Presses Offset', 'Plieuses'],
      },
      {
        name: 'CAH2',
        precedences: '',
        quantite: '1',
        format: 'A5',
        pagination: '12',
        papier: 'Couché satin:115',
        imposition: '50x70(16)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'Presses Offset\nPlieuses',
        sequenceWorkflow: ['Presses Offset', 'Plieuses'],
        links: { format: true, papier: true, imposition: true, impression: true },
      },
      {
        name: 'FINITION',
        precedences: 'COUV, CAH1, CAH2',
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
        sequence: 'Encarteuses-Piqueuses\nConditionnement',
        sequenceWorkflow: ['Encarteuses-Piqueuses', 'Conditionnement'],
      },
    ],
    createdAt: '2026-01-18T09:00:00.000Z',
    updatedAt: '2026-01-18T09:00:00.000Z',
  },
  // --- Route 4: Brochure piquée + pelliculage ---
  {
    id: 'tpl-louis-007',
    name: 'Brochure piquée pelliculée A4',
    description: 'Brochure 16p A4 avec couverture pelliculée mat, finition premium',
    category: 'Brochure',
    elements: [
      {
        name: 'COUV',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '4',
        papier: 'Couché mat:250',
        imposition: '65x90(16)',
        impression: 'Q/Q',
        surfacage: 'mat/',
        autres: 'Pelliculage mat recto',
        qteFeuilles: '',
        commentaires: 'Couverture pelliculée mat recto',
        sequence: 'Presses Offset\nMassicots\nPelliculeuses',
        sequenceWorkflow: ['Presses Offset', 'Massicots', 'Pelliculeuses'],
      },
      {
        name: 'CAH1',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '8',
        papier: 'Couché mat:115',
        imposition: '65x90(16)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'Presses Offset\nPlieuses',
        sequenceWorkflow: ['Presses Offset', 'Plieuses'],
      },
      {
        name: 'CAH2',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '8',
        papier: 'Couché mat:115',
        imposition: '65x90(16)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'Presses Offset\nPlieuses',
        sequenceWorkflow: ['Presses Offset', 'Plieuses'],
        links: { format: true, papier: true, imposition: true, impression: true },
      },
      {
        name: 'FINITION',
        precedences: 'COUV, CAH1, CAH2',
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
        sequence: 'Encarteuses-Piqueuses\nConditionnement',
        sequenceWorkflow: ['Encarteuses-Piqueuses', 'Conditionnement'],
      },
    ],
    createdAt: '2026-01-22T14:00:00.000Z',
    updatedAt: '2026-02-12T14:00:00.000Z',
  },
  // --- Route 7: Brochure assemblée piquée (Int→Offset+Massicot, Couv→Offset+Massicot, Ass→Ass.piqueuse+Cond) ---
  {
    id: 'tpl-louis-008',
    name: 'Catalogue assemblé piqué 48p',
    description: 'Catalogue 48 pages A4, intérieur couché mat 115g, couverture 250g, assemblé et piqué',
    category: 'Catalogue',
    elements: [
      {
        name: 'INT',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '48',
        papier: 'Couché mat:115',
        imposition: '65x90(16)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '3 cahiers de 16 pages',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
      },
      {
        name: 'COUV',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '4',
        papier: 'Couché mat:250',
        imposition: '65x90(16)',
        impression: 'Q/Q',
        surfacage: 'mat/',
        autres: '',
        qteFeuilles: '',
        commentaires: '',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
      },
      {
        name: 'ASSEMBLAGE',
        precedences: 'INT, COUV',
        quantite: '1',
        format: '',
        pagination: '',
        papier: '',
        imposition: '',
        impression: '',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Assemblage + piqûre 2 agrafes',
        sequence: 'Assembleuses-Piqueuses\nConditionnement',
        sequenceWorkflow: ['Assembleuses-Piqueuses', 'Conditionnement'],
      },
    ],
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-01-12T08:00:00.000Z',
  },
  {
    id: 'tpl-louis-009',
    name: 'Rapport annuel A4 64p',
    clientName: 'Danone',
    description: 'Rapport annuel 64 pages A4, couverture pelliculée brillant, intérieur couché satin',
    category: 'Catalogue',
    elements: [
      {
        name: 'INT',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '64',
        papier: 'Couché satin:135',
        imposition: '65x90(16)',
        impression: 'Q/Q',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: '4 cahiers de 16 pages',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
      },
      {
        name: 'COUV',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '4',
        papier: 'Couché brillant:300',
        imposition: '65x90(16)',
        impression: 'Q/Q',
        surfacage: 'brillant/',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Pelliculage brillant recto',
        sequence: 'Presses Offset\nMassicots\nPelliculeuses',
        sequenceWorkflow: ['Presses Offset', 'Massicots', 'Pelliculeuses'],
      },
      {
        name: 'ASSEMBLAGE',
        precedences: 'INT, COUV',
        quantite: '1',
        format: '',
        pagination: '',
        papier: '',
        imposition: '',
        impression: '',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Assemblage + piqûre',
        sequence: 'Assembleuses-Piqueuses\nConditionnement',
        sequenceWorkflow: ['Assembleuses-Piqueuses', 'Conditionnement'],
      },
    ],
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-14T16:30:00.000Z',
  },
  // --- Route 5: Pochette à rabat (Offset → Massicot → Pelliculeuse → Typo → Cond) ---
  {
    id: 'tpl-louis-010',
    name: 'Pochette à rabat A4',
    description: 'Pochette A4 à rabats, couché mat 350g, pelliculage mat + découpe/rainurage typo',
    category: 'Pochette',
    elements: [
      {
        name: 'POCH',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '2',
        papier: 'Couché mat:350',
        imposition: '50x70(2)',
        impression: 'Q/Q',
        surfacage: 'mat/mat',
        autres: 'Découpe + rainurage',
        qteFeuilles: '',
        commentaires: 'Pochette avec 2 rabats intérieurs',
        sequence: 'Presses Offset\nMassicots\nPelliculeuses\nTypographie\nConditionnement',
        sequenceWorkflow: ['Presses Offset', 'Massicots', 'Pelliculeuses', 'Typographie', 'Conditionnement'],
      },
    ],
    createdAt: '2026-01-25T09:00:00.000Z',
    updatedAt: '2026-01-25T09:00:00.000Z',
  },
  {
    id: 'tpl-louis-011',
    name: 'Pochette à rabat séminaire',
    clientName: 'Hermès',
    description: 'Pochette A4 prestige pour séminaires, pelliculage soft-touch, dorure à chaud',
    category: 'Pochette',
    elements: [
      {
        name: 'POCH',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '2',
        papier: 'Couché mat:400',
        imposition: '50x70(2)',
        impression: 'Q/Q + Pantone 871',
        surfacage: 'soft-touch/',
        autres: 'Découpe + rainurage + dorure à chaud',
        qteFeuilles: '',
        commentaires: 'Finition haut de gamme, 500 ex.',
        sequence: 'Presses Offset\nMassicots\nPelliculeuses\nTypographie\nConditionnement',
        sequenceWorkflow: ['Presses Offset', 'Massicots', 'Pelliculeuses', 'Typographie', 'Conditionnement'],
      },
    ],
    createdAt: '2026-02-08T11:00:00.000Z',
    updatedAt: '2026-02-08T11:00:00.000Z',
  },
  // --- Route 6: Liasse (Feuillets→Offset+Massicot, Assemblage→Assembleuse+Cond) ---
  {
    id: 'tpl-louis-012',
    name: 'Liasse 3 feuillets NCR',
    description: 'Liasse autocopiante 3 feuillets A4 (blanc/rose/jaune), impression Q/, assemblage numéroté',
    category: 'Liasse',
    elements: [
      {
        name: 'FEUIL1',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '2',
        papier: 'Autocopiant CB blanc:60',
        imposition: '50x70(4)',
        impression: 'Q/',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Feuillet supérieur blanc',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
      },
      {
        name: 'FEUIL2',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '2',
        papier: 'Autocopiant CFB rose:60',
        imposition: '50x70(4)',
        impression: 'Q/',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Feuillet intermédiaire rose',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
        links: { format: true, imposition: true, impression: true },
      },
      {
        name: 'FEUIL3',
        precedences: '',
        quantite: '1',
        format: 'A4',
        pagination: '2',
        papier: 'Autocopiant CF jaune:60',
        imposition: '50x70(4)',
        impression: 'Q/',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Feuillet inférieur jaune',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
        links: { format: true, imposition: true, impression: true },
      },
      {
        name: 'ASSEMBLAGE',
        precedences: 'FEUIL1, FEUIL2, FEUIL3',
        quantite: '1',
        format: '',
        pagination: '',
        papier: '',
        imposition: '',
        impression: '',
        surfacage: '',
        autres: 'Numérotation + collage en tête',
        qteFeuilles: '',
        commentaires: 'Assemblage 3 feuillets, collage en tête, numérotation',
        sequence: 'Assembleuses\nConditionnement',
        sequenceWorkflow: ['Assembleuses', 'Conditionnement'],
      },
    ],
    createdAt: '2026-01-28T14:00:00.000Z',
    updatedAt: '2026-01-28T14:00:00.000Z',
  },
  {
    id: 'tpl-louis-013',
    name: 'Liasse bon de commande',
    clientName: 'Schneider Electric',
    description: 'Liasse 3 feuillets NCR A5 pour bons de commande, numérotation séquentielle',
    category: 'Liasse',
    elements: [
      {
        name: 'FEUIL1',
        precedences: '',
        quantite: '1',
        format: 'A5',
        pagination: '2',
        papier: 'Autocopiant CB blanc:60',
        imposition: '50x70(8)',
        impression: 'Q/ + numérotation',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Original blanc',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
      },
      {
        name: 'FEUIL2',
        precedences: '',
        quantite: '1',
        format: 'A5',
        pagination: '2',
        papier: 'Autocopiant CFB rose:60',
        imposition: '50x70(8)',
        impression: 'Q/',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Duplicata rose',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
        links: { format: true, imposition: true },
      },
      {
        name: 'FEUIL3',
        precedences: '',
        quantite: '1',
        format: 'A5',
        pagination: '2',
        papier: 'Autocopiant CF jaune:60',
        imposition: '50x70(8)',
        impression: 'Q/',
        surfacage: '',
        autres: '',
        qteFeuilles: '',
        commentaires: 'Triplicata jaune',
        sequence: 'Presses Offset\nMassicots',
        sequenceWorkflow: ['Presses Offset', 'Massicots'],
        links: { format: true, imposition: true },
      },
      {
        name: 'ASSEMBLAGE',
        precedences: 'FEUIL1, FEUIL2, FEUIL3',
        quantite: '1',
        format: '',
        pagination: '',
        papier: '',
        imposition: '',
        impression: '',
        surfacage: '',
        autres: 'Numérotation séquentielle + collage',
        qteFeuilles: '',
        commentaires: 'Assemblage, collage en tête, blocs de 50',
        sequence: 'Assembleuses\nConditionnement',
        sequenceWorkflow: ['Assembleuses', 'Conditionnement'],
      },
    ],
    createdAt: '2026-02-03T09:00:00.000Z',
    updatedAt: '2026-02-03T09:00:00.000Z',
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
 * Returns a Promise for API compatibility.
 */
export async function createTemplate(data: JcfTemplateCreateInput): Promise<JcfTemplate> {
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
 * Returns a Promise for API compatibility.
 */
export async function updateTemplate(id: string, data: JcfTemplateUpdateInput): Promise<JcfTemplate> {
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

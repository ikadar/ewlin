/**
 * Mock Reference Data
 * Static reference data for JCF autocomplete fields.
 *
 * @see implicit-logic-specification.md §9 (Reference Data)
 */

import type {
  PaperType,
  FeuilleFormat,
  ProductFormat,
  ImpressionPreset,
  SurfacagePreset,
  PosteCategory,
  PostePreset,
  SoustraitantPreset,
  TemplateCategory,
} from '@flux/types';

// ============================================================================
// Paper Types (§9.5)
// ============================================================================

const GRAMMAGES: number[] = [70, 80, 90, 100, 115, 130, 135, 150, 170, 200, 250, 300, 320, 400];

export const PAPER_TYPES: PaperType[] = [
  { id: 'couche-mat', type: 'Couché mat', grammages: GRAMMAGES },
  { id: 'couche-satin', type: 'Couché satin', grammages: GRAMMAGES },
  { id: 'couche-brillant', type: 'Couché brillant', grammages: GRAMMAGES },
  { id: 'offset', type: 'Offset', grammages: GRAMMAGES },
  { id: 'laser', type: 'Laser', grammages: GRAMMAGES },
];

// ============================================================================
// Product Formats
// ============================================================================

export const PRODUCT_FORMATS: ProductFormat[] = [
  // A-series
  { id: 'a1', name: 'A1', width: 594, height: 841 },
  { id: 'a2', name: 'A2', width: 420, height: 594 },
  { id: 'a3', name: 'A3', width: 297, height: 420 },
  { id: 'a4', name: 'A4', width: 210, height: 297 },
  { id: 'a4f', name: 'A4f', width: 210, height: 297 },
  { id: 'a4fi', name: 'A4fi', width: 297, height: 210 },
  { id: 'a5', name: 'A5', width: 148, height: 210 },
  { id: 'a5f', name: 'A5f', width: 148, height: 210 },
  { id: 'a5fi', name: 'A5fi', width: 210, height: 148 },
  { id: 'a6', name: 'A6', width: 105, height: 148 },
  { id: 'a6f', name: 'A6f', width: 105, height: 148 },
  { id: 'a6fi', name: 'A6fi', width: 148, height: 105 },
  { id: 'a7', name: 'A7', width: 74, height: 105 },
  { id: 'a8', name: 'A8', width: 52, height: 74 },
  { id: 'a9', name: 'A9', width: 37, height: 52 },
  { id: 'a10', name: 'A10', width: 26, height: 37 },
  // B-series
  { id: 'b1', name: 'B1', width: 707, height: 1000 },
  { id: 'b2', name: 'B2', width: 500, height: 707 },
  { id: 'b3', name: 'B3', width: 353, height: 500 },
  { id: 'b4', name: 'B4', width: 250, height: 353 },
  { id: 'b4f', name: 'B4f', width: 250, height: 353 },
  { id: 'b4fi', name: 'B4fi', width: 353, height: 250 },
  { id: 'b5', name: 'B5', width: 176, height: 250 },
  { id: 'b5f', name: 'B5f', width: 176, height: 250 },
  { id: 'b5fi', name: 'B5fi', width: 250, height: 176 },
  { id: 'b6', name: 'B6', width: 125, height: 176 },
  { id: 'b6f', name: 'B6f', width: 125, height: 176 },
  { id: 'b6fi', name: 'B6fi', width: 176, height: 125 },
  { id: 'b7', name: 'B7', width: 88, height: 125 },
  { id: 'b8', name: 'B8', width: 62, height: 88 },
  { id: 'b9', name: 'B9', width: 44, height: 62 },
  { id: 'b10', name: 'B10', width: 31, height: 44 },
  // SRA-series
  { id: 'sra1', name: 'SRA1', width: 640, height: 900 },
  { id: 'sra2', name: 'SRA2', width: 450, height: 640 },
  { id: 'sra3', name: 'SRA3', width: 320, height: 450 },
  { id: 'sra4', name: 'SRA4', width: 225, height: 320 },
];

// ============================================================================
// Feuille Formats / Imposition (§9.6, §9.7)
// ============================================================================

const POSES: number[] = [1, 2, 4, 8, 16, 32, 64, 128];

export const FEUILLE_FORMATS: FeuilleFormat[] = [
  { format: '32x45', poses: POSES },
  { format: '45x64', poses: POSES },
  { format: '50x70', poses: POSES },
  { format: '52x72', poses: POSES },
  { format: '54x74', poses: POSES },
  { format: '63x88', poses: POSES },
  { format: '64x90', poses: POSES },
  { format: '65x90', poses: POSES },
  { format: '65x92', poses: POSES },
  { format: '70x100', poses: POSES },
];

// ============================================================================
// Impression Presets
// ============================================================================

export const IMPRESSION_PRESETS: ImpressionPreset[] = [
  { id: 'q-q', value: 'Q/Q', description: 'Quadri R/V' },
  { id: 'q', value: 'Q/', description: 'Quadri recto seul' },
  { id: 'qv-qv', value: 'Q+V/Q+V', description: 'Quadri+Vernis R/V' },
  { id: 'qv-q', value: 'Q+V/Q', description: 'Quadri+Vernis R, Quadri V' },
  { id: 'qv', value: 'Q+V/', description: 'Quadri+Vernis recto seul' },
  { id: 'n-n', value: 'N/N', description: 'Noir R/V' },
  { id: 'n', value: 'N/', description: 'Noir recto seul' },
  { id: 'q-n', value: 'Q/N', description: 'Quadri R, Noir V' },
  { id: 'n-q', value: 'N/Q', description: 'Noir R, Quadri V' },
];

// ============================================================================
// Surfacage Presets
// ============================================================================

export const SURFACAGE_PRESETS: SurfacagePreset[] = [
  { id: 'mat-mat', value: 'mat/mat', description: 'Pelli mat R/V' },
  { id: 'satin-satin', value: 'satin/satin', description: 'Pelli satin R/V' },
  { id: 'brillant-brillant', value: 'brillant/brillant', description: 'Pelli brillant R/V' },
  { id: 'uv-uv', value: 'UV/UV', description: 'Vernis UV R/V' },
  { id: 'dorure-dorure', value: 'dorure/dorure', description: 'Dorure R/V' },
  { id: 'mat', value: 'mat/', description: 'Pelli mat recto' },
  { id: 'satin', value: 'satin/', description: 'Pelli satin recto' },
  { id: 'brillant', value: 'brillant/', description: 'Pelli brillant recto' },
  { id: 'uv', value: 'UV/', description: 'Vernis UV recto' },
  { id: 'dorure', value: 'dorure/', description: 'Dorure recto' },
];

// ============================================================================
// Poste Presets (§9.1, §9.2)
// ============================================================================

export const POSTE_PRESETS: PostePreset[] = [
  // Presse offset
  { name: 'G37', category: 'Presse offset' },
  { name: '754', category: 'Presse offset' },
  { name: 'GTO', category: 'Presse offset' },
  // Presse numérique
  { name: 'C9500', category: 'Presse numérique' },
  // Massicot
  { name: 'P137', category: 'Massicot' },
  { name: 'VM', category: 'Massicot' },
  // Typo
  { name: 'SBG', category: 'Typo' },
  { name: 'SBB', category: 'Typo' },
  // Plieuse
  { name: 'Stahl', category: 'Plieuse' },
  { name: 'MBO', category: 'Plieuse' },
  { name: 'Horizon', category: 'Plieuse' },
  // Encarteuse-piqueuse
  { name: 'H', category: 'Encarteuse-piqueuse' },
  // Assembleuse-piqueuse
  { name: 'Duplo10', category: 'Assembleuse-piqueuse' },
  { name: 'Duplo20', category: 'Assembleuse-piqueuse' },
  // Conditionnement
  { name: 'Carton', category: 'Conditionnement' },
  { name: 'Film', category: 'Conditionnement' },
];

/**
 * All poste categories for validation/iteration.
 */
export const POSTE_CATEGORIES: PosteCategory[] = [
  'Presse offset',
  'Presse numérique',
  'Massicot',
  'Typo',
  'Plieuse',
  'Encarteuse-piqueuse',
  'Assembleuse-piqueuse',
  'Conditionnement',
];

// ============================================================================
// Soustraitant Presets (§9.3)
// ============================================================================

export const SOUSTRAITANT_PRESETS: SoustraitantPreset[] = [
  { name: 'MCA' },
  { name: 'F37' },
  { name: 'LGI' },
  { name: 'AVN' },
  { name: 'JF' },
];

// ============================================================================
// Template Categories
// ============================================================================

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'brochure', name: 'Brochure' },
  { id: 'feuillet', name: 'Feuillet' },
];

// ============================================================================
// Mock Clients (v0.4.8)
// ============================================================================

export interface MockClient {
  id: string;
  name: string;
}

export const MOCK_CLIENTS: MockClient[] = [
  { id: 'client-1', name: 'Imprimerie Léon' },
  { id: 'client-2', name: 'Éditions Gallimard' },
  { id: 'client-3', name: 'Hachette Livre' },
  { id: 'client-4', name: 'Publicis France' },
  { id: 'client-5', name: 'La Poste' },
  { id: 'client-6', name: 'SNCF Communication' },
  { id: 'client-7', name: 'Air France Corporate' },
  { id: 'client-8', name: 'Carrefour Marketing' },
];

// ============================================================================
// Mock Templates (v0.4.8)
// ============================================================================

export interface MockTemplate {
  id: string;
  name: string;
  clientName?: string;
}

export const MOCK_TEMPLATES: MockTemplate[] = [
  { id: 'tpl-1', name: 'Brochure A4' },
  { id: 'tpl-2', name: 'Catalogue 32 pages' },
  { id: 'tpl-3', name: 'Dépliant 3 volets' },
  { id: 'tpl-4', name: 'Carte de visite', clientName: 'Publicis France' },
  { id: 'tpl-5', name: 'Affiche A2', clientName: 'SNCF Communication' },
  { id: 'tpl-6', name: 'Flyer A5', clientName: 'La Poste' },
];

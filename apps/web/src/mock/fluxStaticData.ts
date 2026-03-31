/**
 * Static mock data for the Production Flow Dashboard (v0.5.15).
 * Based on spec section 5.1 and 5.3 reference data.
 * Spec: docs/production-flow-dashboard-spec/tableau-de-flux.md
 *
 * v0.5.23: outsourcing[] added per ST column spec §3.3 reference data.
 */

import type { FluxJob } from '../components/FluxTable/fluxTypes';

/**
 * The 5 reference jobs from the spec (sections 5.1 and 5.3).
 * Progress percentages for ring+dot indicators:
 *   - in-progress: 40%
 *   - late: 60%
 * (actual % values are deferred per qa.md K3.1)
 */
export const FLUX_STATIC_JOBS: FluxJob[] = [
  // ── 00042: Ducros — 1 element, tout OK, shipped ───────────────────────────
  {
    id: '00042',
    client: 'Ducros',
    designation: 'Brochure A4 16p Couché Satin',
    sortie: '28/02',
    elements: [
      {
        id: '00042-e1',
        label: 'Main',
        bat: 'bat_approved',
        papier: 'in_stock',
        formes: 'none',
        plaques: 'ready',
        stations: {
          'cat-offset':       { state: 'done' },
          'cat-cutting':      { state: 'done' },
          'cat-pelliculeuse': { state: 'done' },
          // cat-typo: empty
          'cat-folding':      { state: 'done' },
          'cat-booklet':      { state: 'done' },
          // cat-saddle-stitch: empty
          // cat-assembly: empty
          'cat-packaging':    { state: 'done' },
        },
        outsourcing: [
          { taskId: '00042-t1', actionType: 'Vernis UV sélectif', providerName: 'Faco 37', status: 'done' },
        ],
      },
    ],
    transporteur: 'Chronopost',
    batDeadline: null,
    parti: { shipped: true, date: '25/02' },
  },

  // ── 00078: Müller AG — 3 elements, all blocking, not shipped ─────────────
  {
    id: '00078',
    client: 'Müller AG',
    designation: 'Étiquettes adhésives 500ex',
    sortie: '05/03',
    elements: [
      {
        id: '00078-e1',
        label: 'Étiquette Ronde',
        bat: 'bat_approved',
        papier: 'in_stock',
        formes: 'in_stock',
        plaques: 'ready',
        stations: {
          'cat-offset':  { state: 'late', progress: 60 },
          'cat-cutting': { state: 'planned' },
          'cat-typo':    { state: 'planned' },
          'cat-packaging':{ state: 'planned' },
        },
        outsourcing: [
          { taskId: '00078-t1', actionType: 'Découpe mi-chair', providerName: 'Clement', status: 'pending' },
        ],
      },
      {
        id: '00078-e2',
        label: 'Étiquette Carrée',
        bat: 'bat_sent',
        papier: 'ordered',
        formes: 'none',
        plaques: 'to_make',
        stations: {
          'cat-offset':   { state: 'in-progress', progress: 40 },
          'cat-cutting':  { state: 'planned' },
          'cat-packaging':{ state: 'planned' },
        },
        outsourcing: [
          { taskId: '00078-t2', actionType: 'Gaufrage logo', providerName: 'JF', status: 'progress' },
        ],
      },
      {
        id: '00078-e3',
        label: 'Étiquette Ovale',
        bat: 'waiting_files',
        papier: 'to_order',
        formes: 'to_order',
        plaques: 'to_make',
        stations: {
          'cat-offset':   { state: 'planned' },
          'cat-typo':     { state: 'planned' },
          'cat-packaging':{ state: 'planned' },
        },
        outsourcing: [],
      },
    ],
    transporteur: null,
    batDeadline: null,
    parti: { shipped: false, date: null },
  },

  // ── 00091: Lefevre & Fils — 2 elements, DHL, not shipped ─────────────────
  {
    id: '00091',
    client: 'Lefevre & Fils',
    designation: 'Boîtes carton 350g recto-verso',
    sortie: '03/03',
    elements: [
      {
        id: '00091-e1',
        label: 'Couverture',
        bat: 'bat_sent',
        papier: 'files_received',
        formes: 'none',
        plaques: 'none',
        stations: {
          'cat-offset':   { state: 'in-progress', progress: 40 },
          'cat-cutting':  { state: 'planned' },
          'cat-packaging':{ state: 'planned' },
        },
        outsourcing: [
          { taskId: '00091-t1', actionType: 'Pelliculage mat', providerName: 'SIPAP', status: 'done' },
        ],
      },
      {
        id: '00091-e2',
        label: 'Intérieur',
        bat: 'waiting_files',
        papier: 'to_order',
        formes: 'ordered',
        plaques: 'to_make',
        stations: {
          'cat-offset':  { state: 'planned' },
          'cat-folding': { state: 'planned' },
          'cat-packaging':{ state: 'planned' },
        },
        outsourcing: [
          { taskId: '00091-t2', actionType: 'Vernis UV', providerName: 'Faco 37', status: 'progress' },
        ],
      },
    ],
    transporteur: 'DHL',
    batDeadline: null,
    parti: { shipped: false, date: null },
  },

  // ── 00103: Pharma Plus — 1 element, in progress ───────────────────────────
  {
    id: '00103',
    client: 'Pharma Plus',
    designation: 'Notice pliée 6 volets 90g',
    sortie: '01/03',
    elements: [
      {
        id: '00103-e1',
        label: 'Main',
        bat: 'bat_sent',
        papier: 'delivered',
        formes: 'delivered',
        plaques: 'ready',
        stations: {
          'cat-offset':   { state: 'done' },
          'cat-cutting':  { state: 'in-progress', progress: 40 },
          // cat-pelliculeuse: empty
          // cat-typo: empty
          'cat-folding':  { state: 'planned' },
          // cat-booklet: empty
          // cat-saddle-stitch: empty
          // cat-assembly: empty
          'cat-packaging':{ state: 'planned' },
        },
        outsourcing: [
          { taskId: '00103-t1', actionType: 'Vernis UV', providerName: 'SIPAP', status: 'done' },
          { taskId: '00103-t2', actionType: 'Reliure Singer', providerName: 'Clement', status: 'pending' },
        ],
      },
    ],
    transporteur: 'TNT',
    batDeadline: null,
    parti: { shipped: false, date: null },
  },

  // ── 00117: Editions Vega — 1 element, late offset, shipped ───────────────
  {
    id: '00117',
    client: 'Editions Vega',
    designation: 'Réimpression catalogue 2025',
    sortie: '27/02',
    elements: [
      {
        id: '00117-e1',
        label: 'Main',
        bat: 'none',
        papier: 'in_stock',
        formes: 'in_stock',
        plaques: 'none',
        stations: {
          'cat-offset':       { state: 'late', progress: 60 },
          'cat-cutting':      { state: 'done' },
          'cat-pelliculeuse': { state: 'done' },
          // cat-typo: empty
          // cat-folding: empty
          'cat-booklet':      { state: 'planned' },
          // cat-saddle-stitch: empty
          // cat-assembly: empty
          'cat-packaging':    { state: 'planned' },
        },
        outsourcing: [],
      },
    ],
    transporteur: 'GLS',
    batDeadline: null,
    parti: { shipped: true, date: '26/02' },
  },
];

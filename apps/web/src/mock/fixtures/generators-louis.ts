import type { Job, Element, Task, InternalTask } from '@flux/types';
import { today, isoDate } from './shared-louis';


// ============================================================================
// Louis Phase 1 — 200 Job Generator (7 production routes)
// ============================================================================

// --- Seeded PRNG (isolation from Math.random) --------------------------------

function createRng(seed: number) {
  let s = seed;
  return function next(min: number, max: number): number {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return min + (s % (max - min + 1));
  };
}

const rng = createRng(42);

// --- Constants ---------------------------------------------------------------

const CAC40_CLIENTS = [
  'LVMH', 'TotalEnergies', 'Hermès', 'L\'Oréal', 'Sanofi',
  'Airbus', 'Schneider Electric', 'Air Liquide', 'BNP Paribas', 'EssilorLuxottica',
  'Safran', 'AXA', 'Dassault Systèmes', 'Vinci', 'Danone',
  'Kering', 'Saint-Gobain', 'Pernod Ricard', 'Michelin', 'Engie',
  'Capgemini', 'Thales', 'Publicis', 'Orange', 'Bouygues',
  'Crédit Agricole', 'Société Générale', 'Renault', 'Stellantis', 'Legrand',
];

const QUALIFIERS: Record<string, string[]> = {
  flyer:                   ['A5 promo', 'A4 événementiel', 'DL lancement produit', 'A5 soldes', 'A4 institutionnel'],
  depliant:                ['3 volets corporate', '2 volets salon', '4 volets produit', '3 volets RH', '2 volets technique'],
  brochurePiquee:          ['16p catalogue', '24p rapport annuel', '12p produit', '20p corporate', '32p institutionnel'],
  brochurePiqueePelli:     ['16p luxe mat', '24p prestige brillant', '12p premium soft-touch', '20p haut de gamme'],
  pochetteRabat:           ['A4 conférence', 'A4 séminaire', 'A5 événementiel', 'A4 commercial'],
  liasse:                  ['3 feuillets NCR', '3 feuillets bon de commande', '3 feuillets contrat', '3 feuillets livraison'],
  brochureAssembleePiquee: ['48p guide technique', '64p catalogue', '36p manuel', '56p référentiel', '80p rapport'],
};

const JOB_COLORS = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#ef4444', '#f59e0b',
  '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f97316',
];

const ROUTE_PROPORTIONS: [string, number][] = [
  ['brochurePiquee',           30],
  ['depliant',                 23],
  ['brochureAssembleePiquee',  20],
  ['brochurePiqueePelli',      10],
  ['flyer',                    10],
  ['liasse',                    5],
  ['pochetteRabat',             2],
];

// Station IDs by type (round-robin targets)
const OFFSET_STATIONS    = ['station-komori-g40', 'station-ryobi-524', 'station-sm52'];
const MASSICOT_STATIONS  = ['station-polar-137'];
const PLIEUSE_STATIONS   = ['station-b26', 'station-mbo-s', 'station-mbo-m80'];
const COND_STATIONS      = ['station-filmeuse', 'station-carton'];

// Round-robin counters
const rrCounters: Record<string, number> = {};

function roundRobin(pool: string[], key: string): string {
  if (!(key in rrCounters)) rrCounters[key] = 0;
  const idx = rrCounters[key] % pool.length;
  rrCounters[key]++;
  return pool[idx];
}

// --- ID formatting -----------------------------------------------------------

function padJobId(n: number): string {
  return `job-${String(n).padStart(5, '0')}`;
}

// --- Duration calculator -----------------------------------------------------

interface Duration {
  setupMinutes: number;
  runMinutes: number;
}

function roundTo15(n: number): number {
  return Math.max(15, Math.round(n / 15) * 15);
}

function offsetDuration(): Duration {
  const base = rng(30, 120);
  const setup = 15;
  const run = roundTo15(base - setup);
  return { setupMinutes: setup, runMinutes: run };
}

function massicotDuration(): Duration {
  return { setupMinutes: roundTo15(rng(5, 10)), runMinutes: roundTo15(rng(10, 20)) };
}

function ratioDuration(offsetDur: Duration, ratio: number, minTotal: number = 0): Duration {
  const total = Math.max(Math.round((offsetDur.setupMinutes + offsetDur.runMinutes) * ratio), minTotal);
  const setup = roundTo15(total * 0.25);
  const run = roundTo15(total - setup);
  return { setupMinutes: setup, runMinutes: run };
}

function plieuseDuration(offsetDur: Duration): Duration {
  return ratioDuration(offsetDur, 2);
}

function encarteusepiqueuseDuration(offsetDur: Duration): Duration {
  return ratioDuration(offsetDur, 3);
}

function pelliculeuseDuration(offsetDur: Duration): Duration {
  const ratio = 0.5 + rng(0, 50) / 100; // 0.5–1.0
  return ratioDuration(offsetDur, ratio, 30);
}

function typoDuration(offsetDur: Duration): Duration {
  return ratioDuration(offsetDur, 4);
}

function assembleusepiqueuseDuration(offsetDur: Duration): Duration {
  return ratioDuration(offsetDur, 2, 30);
}

function assembleuseDuration(offsetDur: Duration): Duration {
  return ratioDuration(offsetDur, 2, 30);
}

function condDuration(): Duration {
  return { setupMinutes: roundTo15(rng(5, 10)), runMinutes: roundTo15(rng(10, 35)) };
}

// --- Task builder ------------------------------------------------------------

interface TaskBuildContext {
  jobId: string;
  elementId: string;
  taskCounter: number;
}

function makeTask(
  ctx: TaskBuildContext,
  stationId: string,
  duration: Duration,
  sequenceOrder: number,
): InternalTask {
  const id = `task-${ctx.jobId}-${ctx.taskCounter}`;
  ctx.taskCounter++;
  return {
    id,
    elementId: ctx.elementId,
    sequenceOrder,
    status: 'Ready',
    type: 'Internal',
    stationId,
    duration,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };
}

// --- Element builder ---------------------------------------------------------

interface PrintElement {
  id: string;
  name: string;
  isPrint: boolean; // true = impression element, false = assembly/finition
}

function makeElement(
  elem: PrintElement,
  jobId: string,
  taskIds: string[],
  prerequisiteElementIds: string[],
): Element {
  return {
    id: elem.id,
    jobId,
    name: elem.name,
    prerequisiteElementIds,
    taskIds,
    paperStatus:  elem.isPrint ? 'in_stock'      : 'none',
    batStatus:    elem.isPrint ? 'bat_approved'   : 'none',
    plateStatus:  elem.isPrint ? 'ready'          : 'none',
    formeStatus:  'none',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };
}

// --- Client & description helpers --------------------------------------------

function pickClient(jobNum: number): string {
  return CAC40_CLIENTS[jobNum % CAC40_CLIENTS.length];
}

function pickDescription(routeKey: string, baseLabel: string, jobNum: number): string {
  const quals = QUALIFIERS[routeKey];
  return `${baseLabel} ${quals[jobNum % quals.length]}`;
}

// --- Route generators --------------------------------------------------------

interface RouteResult {
  job: Job;
  elements: Element[];
  tasks: Task[];
}

// Helper: mono-element route
function monoRoute(
  jobNum: number,
  routeKey: string,
  baseLabel: string,
  taskFactory: (ctx: TaskBuildContext, offsetDur: Duration) => InternalTask[],
): RouteResult {
  const jobId = padJobId(jobNum);
  const elemId = `elem-${jobId}`;
  const ctx: TaskBuildContext = { jobId, elementId: elemId, taskCounter: 0 };
  const offsetDur = offsetDuration();
  const tasks = taskFactory(ctx, offsetDur);

  const elem = makeElement(
    { id: elemId, name: 'ELT', isPrint: true },
    jobId,
    tasks.map(t => t.id),
    [],
  );

  const job: Job = {
    id: jobId,
    reference: `L-${String(jobNum).padStart(5, '0')}`,
    client: pickClient(jobNum),
    description: pickDescription(routeKey, baseLabel, jobNum),
    status: 'Planned',
    workshopExitDate: isoDate(0, 0, rng(5, 30)),
    fullyScheduled: false,
    color: JOB_COLORS[jobNum % JOB_COLORS.length],
    comments: [],
    elementIds: [elemId],
    taskIds: tasks.map(t => t.id),
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };

  return { job, elements: [elem], tasks };
}

// 1. Flyer: Offset → Massicot → Conditionnement
function generateFlyer(jobNum: number): RouteResult {
  return monoRoute(jobNum, 'flyer', 'Flyer', (ctx, offsetDur) => [
    makeTask(ctx, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctx, roundRobin(MASSICOT_STATIONS, 'massicot'), massicotDuration(), 1),
    makeTask(ctx, roundRobin(COND_STATIONS, 'cond'), condDuration(), 2),
  ]);
}

// 2. Dépliant: Offset → Massicot → Plieuse → Conditionnement
function generateDepliant(jobNum: number): RouteResult {
  return monoRoute(jobNum, 'depliant', 'Dépliant', (ctx, offsetDur) => [
    makeTask(ctx, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctx, roundRobin(MASSICOT_STATIONS, 'massicot'), massicotDuration(), 1),
    makeTask(ctx, roundRobin(PLIEUSE_STATIONS, 'plieuse'), plieuseDuration(offsetDur), 2),
    makeTask(ctx, roundRobin(COND_STATIONS, 'cond'), condDuration(), 3),
  ]);
}

// 3. Brochure piquée: couv (Offset→Massicot), cah1 (Offset→Plieuse), cah2 (Offset→Plieuse), fin (Encarteuse→Cond)
function generateBrochurePiquee(jobNum: number): RouteResult {
  const jobId = padJobId(jobNum);
  const couvId  = `elem-${jobId}-couv`;
  const cah1Id  = `elem-${jobId}-cah1`;
  const cah2Id  = `elem-${jobId}-cah2`;
  const finId   = `elem-${jobId}-fin`;

  const offsetDur = offsetDuration();
  const ctxCouv: TaskBuildContext = { jobId, elementId: couvId, taskCounter: 0 };
  const couvTasks = [
    makeTask(ctxCouv, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxCouv, roundRobin(MASSICOT_STATIONS, 'massicot'), massicotDuration(), 1),
  ];

  const ctxCah1: TaskBuildContext = { jobId, elementId: cah1Id, taskCounter: ctxCouv.taskCounter };
  const cah1Tasks = [
    makeTask(ctxCah1, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxCah1, roundRobin(PLIEUSE_STATIONS, 'plieuse'), plieuseDuration(offsetDur), 1),
  ];

  const ctxCah2: TaskBuildContext = { jobId, elementId: cah2Id, taskCounter: ctxCah1.taskCounter };
  const cah2Tasks = [
    makeTask(ctxCah2, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxCah2, roundRobin(PLIEUSE_STATIONS, 'plieuse'), plieuseDuration(offsetDur), 1),
  ];

  const ctxFin: TaskBuildContext = { jobId, elementId: finId, taskCounter: ctxCah2.taskCounter };
  const finTasks = [
    makeTask(ctxFin, 'station-hohner', encarteusepiqueuseDuration(offsetDur), 0),
    makeTask(ctxFin, roundRobin(COND_STATIONS, 'cond'), condDuration(), 1),
  ];

  const allTasks: Task[] = [...couvTasks, ...cah1Tasks, ...cah2Tasks, ...finTasks];

  const elements: Element[] = [
    makeElement({ id: couvId, name: 'Couverture', isPrint: true }, jobId, couvTasks.map(t => t.id), []),
    makeElement({ id: cah1Id, name: 'Cahier 1',   isPrint: true }, jobId, cah1Tasks.map(t => t.id), []),
    makeElement({ id: cah2Id, name: 'Cahier 2',   isPrint: true }, jobId, cah2Tasks.map(t => t.id), []),
    makeElement({ id: finId,  name: 'Finition',    isPrint: false }, jobId, finTasks.map(t => t.id), [couvId, cah1Id, cah2Id]),
  ];

  const job: Job = {
    id: jobId,
    reference: `L-${String(jobNum).padStart(5, '0')}`,
    client: pickClient(jobNum),
    description: pickDescription('brochurePiquee', 'Brochure piquée', jobNum),
    status: 'Planned',
    workshopExitDate: isoDate(0, 0, rng(5, 30)),
    fullyScheduled: false,
    color: JOB_COLORS[jobNum % JOB_COLORS.length],
    comments: [],
    elementIds: [couvId, cah1Id, cah2Id, finId],
    taskIds: allTasks.map(t => t.id),
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };

  return { job, elements, tasks: allTasks };
}

// 4. Brochure piquée + pelliculage: couv (Offset→Massicot→Pelli), cah1/cah2 (Offset→Plieuse), fin (Encarteuse→Cond)
function generateBrochurePiqueePelli(jobNum: number): RouteResult {
  const jobId = padJobId(jobNum);
  const couvId  = `elem-${jobId}-couv`;
  const cah1Id  = `elem-${jobId}-cah1`;
  const cah2Id  = `elem-${jobId}-cah2`;
  const finId   = `elem-${jobId}-fin`;

  const offsetDur = offsetDuration();
  const ctxCouv: TaskBuildContext = { jobId, elementId: couvId, taskCounter: 0 };
  const couvTasks = [
    makeTask(ctxCouv, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxCouv, roundRobin(MASSICOT_STATIONS, 'massicot'), massicotDuration(), 1),
    makeTask(ctxCouv, 'station-semipack', pelliculeuseDuration(offsetDur), 2),
  ];

  const ctxCah1: TaskBuildContext = { jobId, elementId: cah1Id, taskCounter: ctxCouv.taskCounter };
  const cah1Tasks = [
    makeTask(ctxCah1, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxCah1, roundRobin(PLIEUSE_STATIONS, 'plieuse'), plieuseDuration(offsetDur), 1),
  ];

  const ctxCah2: TaskBuildContext = { jobId, elementId: cah2Id, taskCounter: ctxCah1.taskCounter };
  const cah2Tasks = [
    makeTask(ctxCah2, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxCah2, roundRobin(PLIEUSE_STATIONS, 'plieuse'), plieuseDuration(offsetDur), 1),
  ];

  const ctxFin: TaskBuildContext = { jobId, elementId: finId, taskCounter: ctxCah2.taskCounter };
  const finTasks = [
    makeTask(ctxFin, 'station-hohner', encarteusepiqueuseDuration(offsetDur), 0),
    makeTask(ctxFin, roundRobin(COND_STATIONS, 'cond'), condDuration(), 1),
  ];

  const allTasks: Task[] = [...couvTasks, ...cah1Tasks, ...cah2Tasks, ...finTasks];

  const elements: Element[] = [
    makeElement({ id: couvId, name: 'Couverture', isPrint: true }, jobId, couvTasks.map(t => t.id), []),
    makeElement({ id: cah1Id, name: 'Cahier 1',   isPrint: true }, jobId, cah1Tasks.map(t => t.id), []),
    makeElement({ id: cah2Id, name: 'Cahier 2',   isPrint: true }, jobId, cah2Tasks.map(t => t.id), []),
    makeElement({ id: finId,  name: 'Finition',    isPrint: false }, jobId, finTasks.map(t => t.id), [couvId, cah1Id, cah2Id]),
  ];

  const job: Job = {
    id: jobId,
    reference: `L-${String(jobNum).padStart(5, '0')}`,
    client: pickClient(jobNum),
    description: pickDescription('brochurePiqueePelli', 'Brochure piquée pelliculée', jobNum),
    status: 'Planned',
    workshopExitDate: isoDate(0, 0, rng(5, 30)),
    fullyScheduled: false,
    color: JOB_COLORS[jobNum % JOB_COLORS.length],
    comments: [],
    elementIds: [couvId, cah1Id, cah2Id, finId],
    taskIds: allTasks.map(t => t.id),
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };

  return { job, elements, tasks: allTasks };
}

// 5. Pochette à rabat: Offset → Massicot → Pelliculeuse → Typo → Conditionnement
function generatePochetteRabat(jobNum: number): RouteResult {
  return monoRoute(jobNum, 'pochetteRabat', 'Pochette à rabat', (ctx, offsetDur) => [
    makeTask(ctx, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctx, roundRobin(MASSICOT_STATIONS, 'massicot'), massicotDuration(), 1),
    makeTask(ctx, 'station-semipack', pelliculeuseDuration(offsetDur), 2),
    makeTask(ctx, 'station-sbg', typoDuration(offsetDur), 3),
    makeTask(ctx, roundRobin(COND_STATIONS, 'cond'), condDuration(), 4),
  ]);
}

// 6. Liasse: feuil1/feuil2/feuil3 (Offset→Massicot), ass (Assembleuse→Cond)
function generateLiasse(jobNum: number): RouteResult {
  const jobId = padJobId(jobNum);
  const f1Id  = `elem-${jobId}-feuil1`;
  const f2Id  = `elem-${jobId}-feuil2`;
  const f3Id  = `elem-${jobId}-feuil3`;
  const assId = `elem-${jobId}-ass`;

  const offsetDur = offsetDuration();

  const ctxF1: TaskBuildContext = { jobId, elementId: f1Id, taskCounter: 0 };
  const f1Tasks = [
    makeTask(ctxF1, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxF1, roundRobin(MASSICOT_STATIONS, 'massicot'), massicotDuration(), 1),
  ];

  const ctxF2: TaskBuildContext = { jobId, elementId: f2Id, taskCounter: ctxF1.taskCounter };
  const f2Tasks = [
    makeTask(ctxF2, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxF2, roundRobin(MASSICOT_STATIONS, 'massicot'), massicotDuration(), 1),
  ];

  const ctxF3: TaskBuildContext = { jobId, elementId: f3Id, taskCounter: ctxF2.taskCounter };
  const f3Tasks = [
    makeTask(ctxF3, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxF3, roundRobin(MASSICOT_STATIONS, 'massicot'), massicotDuration(), 1),
  ];

  const ctxAss: TaskBuildContext = { jobId, elementId: assId, taskCounter: ctxF3.taskCounter };
  const assTasks = [
    makeTask(ctxAss, 'station-horizon-60h', assembleuseDuration(offsetDur), 0),
    makeTask(ctxAss, roundRobin(COND_STATIONS, 'cond'), condDuration(), 1),
  ];

  const allTasks: Task[] = [...f1Tasks, ...f2Tasks, ...f3Tasks, ...assTasks];

  const elements: Element[] = [
    makeElement({ id: f1Id,  name: 'Feuillet 1',  isPrint: true },  jobId, f1Tasks.map(t => t.id), []),
    makeElement({ id: f2Id,  name: 'Feuillet 2',  isPrint: true },  jobId, f2Tasks.map(t => t.id), []),
    makeElement({ id: f3Id,  name: 'Feuillet 3',  isPrint: true },  jobId, f3Tasks.map(t => t.id), []),
    makeElement({ id: assId, name: 'Assemblage',   isPrint: false }, jobId, assTasks.map(t => t.id), [f1Id, f2Id, f3Id]),
  ];

  const job: Job = {
    id: jobId,
    reference: `L-${String(jobNum).padStart(5, '0')}`,
    client: pickClient(jobNum),
    description: pickDescription('liasse', 'Liasse', jobNum),
    status: 'Planned',
    workshopExitDate: isoDate(0, 0, rng(5, 30)),
    fullyScheduled: false,
    color: JOB_COLORS[jobNum % JOB_COLORS.length],
    comments: [],
    elementIds: [f1Id, f2Id, f3Id, assId],
    taskIds: allTasks.map(t => t.id),
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };

  return { job, elements, tasks: allTasks };
}

// 7. Brochure assemblée piquée: int (Offset→Massicot), couv (Offset→Massicot), assemblage (Ass.piqueuse→Cond)
function generateBrochureAssembleePiquee(jobNum: number): RouteResult {
  const jobId = padJobId(jobNum);
  const intId  = `elem-${jobId}-int`;
  const couvId = `elem-${jobId}-couv`;
  const assId  = `elem-${jobId}-assemblage`;

  const offsetDur = offsetDuration();

  const ctxInt: TaskBuildContext = { jobId, elementId: intId, taskCounter: 0 };
  const intTasks = [
    makeTask(ctxInt, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxInt, roundRobin(MASSICOT_STATIONS, 'massicot'), massicotDuration(), 1),
  ];

  const ctxCouv: TaskBuildContext = { jobId, elementId: couvId, taskCounter: ctxInt.taskCounter };
  const couvTasks = [
    makeTask(ctxCouv, roundRobin(OFFSET_STATIONS, 'offset'), offsetDur, 0),
    makeTask(ctxCouv, roundRobin(MASSICOT_STATIONS, 'massicot'), massicotDuration(), 1),
  ];

  const ctxAss: TaskBuildContext = { jobId, elementId: assId, taskCounter: ctxCouv.taskCounter };
  const assTasks = [
    makeTask(ctxAss, 'station-horizon-ass', assembleusepiqueuseDuration(offsetDur), 0),
    makeTask(ctxAss, roundRobin(COND_STATIONS, 'cond'), condDuration(), 1),
  ];

  const allTasks: Task[] = [...intTasks, ...couvTasks, ...assTasks];

  const elements: Element[] = [
    makeElement({ id: intId,  name: 'Intérieur',   isPrint: true },  jobId, intTasks.map(t => t.id), []),
    makeElement({ id: couvId, name: 'Couverture',   isPrint: true },  jobId, couvTasks.map(t => t.id), []),
    makeElement({ id: assId,  name: 'Assemblage',   isPrint: false }, jobId, assTasks.map(t => t.id), [intId, couvId]),
  ];

  const job: Job = {
    id: jobId,
    reference: `L-${String(jobNum).padStart(5, '0')}`,
    client: pickClient(jobNum),
    description: pickDescription('brochureAssembleePiquee', 'Brochure assemblée piquée', jobNum),
    status: 'Planned',
    workshopExitDate: isoDate(0, 0, rng(5, 30)),
    fullyScheduled: false,
    color: JOB_COLORS[jobNum % JOB_COLORS.length],
    comments: [],
    elementIds: [intId, couvId, assId],
    taskIds: allTasks.map(t => t.id),
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };

  return { job, elements, tasks: allTasks };
}

// --- Route dispatch ----------------------------------------------------------

type RouteGenerator = (jobNum: number) => RouteResult;

const ROUTE_MAP: Record<string, RouteGenerator> = {
  brochurePiquee:          generateBrochurePiquee,
  depliant:                generateDepliant,
  brochureAssembleePiquee: generateBrochureAssembleePiquee,
  brochurePiqueePelli:     generateBrochurePiqueePelli,
  flyer:                   generateFlyer,
  liasse:                  generateLiasse,
  pochetteRabat:           generatePochetteRabat,
};

// --- Main entry point --------------------------------------------------------

export function generateLouisJobs(count: number = 200): {
  jobs: Job[];
  elements: Element[];
  tasks: Task[];
} {
  // Calculate quotas (integer) per route
  const quotas: [string, number][] = [];
  let remaining = count;

  for (let i = 0; i < ROUTE_PROPORTIONS.length; i++) {
    const [route, pct] = ROUTE_PROPORTIONS[i];
    if (i === ROUTE_PROPORTIONS.length - 1) {
      quotas.push([route, remaining]);
    } else {
      const q = Math.round(count * pct / 100);
      quotas.push([route, q]);
      remaining -= q;
    }
  }

  // Build job list (interleaved by route for diversity)
  const routeQueues: { route: string; remaining: number }[] = quotas.map(([route, q]) => ({ route, remaining: q }));
  const jobs: Job[] = [];
  const elements: Element[] = [];
  const tasks: Task[] = [];

  let jobNum = 1;
  let generated = 0;

  while (generated < count) {
    for (const rq of routeQueues) {
      if (rq.remaining <= 0 || generated >= count) continue;
      const gen = ROUTE_MAP[rq.route];
      const result = gen(jobNum);
      jobs.push(result.job);
      elements.push(...result.elements);
      tasks.push(...result.tasks);
      rq.remaining--;
      jobNum++;
      generated++;
    }
  }

  return { jobs, elements, tasks };
}

import { faker } from '@faker-js/faker';
import { addDays } from 'date-fns';
import type { Job, Task, JobStatus, TaskStatus, PaperPurchaseStatus, PlatesStatus, JobComment } from '../../types';
import { generateStations, generateProviders } from './stations';

// Print shop specific data
const CLIENTS = [
  'Fibois Grand Est',
  'Crédit Mutuel',
  'Région Grand Est',
  'EDF',
  'SNCF',
  'Mulhouse Alsace Agglomération',
  'Université de Strasbourg',
  'CCI Alsace',
  'Conseil Départemental 67',
  'Eurométropole',
];

const PAPER_TYPES = ['CB300', 'Couché Mat 135g', 'Couché Brillant 170g', 'Offset 80g', 'Recyclé 90g', 'Création 250g'];
const PAPER_FORMATS = ['45x64', '52x72', '63x88', '70x100', '64x90'];

const JOB_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

const PRODUCT_TYPES = [
  'Cartes de visite',
  'Brochures',
  'Flyers',
  'Affiches',
  'Catalogues',
  'Dépliants',
  'Enveloppes',
  'Papier à en-tête',
  'Cartes de voeux',
  'Calendriers',
  'Chemises à rabats',
  'Livrets',
];

export interface GeneratedJobData {
  job: Job;
}

// Get stations and providers for task generation
const stations = generateStations();
const providers = generateProviders();

// Station name to ID mapping
const stationMap = new Map(stations.map(s => [s.name.toLowerCase().replace(/\s+/g, '_'), s]));
const providerMap = new Map(providers.map(p => [p.name.toLowerCase().replace(/\s+/g, '_'), p]));

function generateTasksForJob(jobId: string, jobStatus: JobStatus): Task[] {
  const tasks: Task[] = [];

  // Generate 2-5 tasks per job
  const patterns = [
    // Pattern 1: Print + Cut
    ['Komori G37:20+60', 'Massicot Polar:15'],
    // Pattern 2: Print + Finishing + Cut + Pack
    ['Komori XL 106:30+90', 'Vernisseuse UV:20+30', 'Massicot Polar:20', 'Conditionnement:30'],
    // Pattern 3: Print + Outsource + Cut
    ['Heidelberg SM 52:25+45', 'ST Clément Pelliculage 2JO', 'Massicot Polar:15'],
    // Pattern 4: Digital + Fold + Pack
    ['Xerox Iridesse:10+30', 'Plieuse MBO:15+20', 'Conditionnement:20'],
    // Pattern 5: Print + Multiple finishing
    ['Komori G37:20+120', 'Vernisseuse UV:15+25', 'Plieuse MBO:20+30', 'Massicot Polar:25', 'Conditionnement:45'],
  ];

  const pattern = faker.helpers.arrayElement(patterns);

  pattern.forEach((taskDef, index) => {
    const taskId = faker.string.uuid();

    if (taskDef.startsWith('ST ')) {
      // Outsourced task: ST [Provider] ActionType NJO
      const match = taskDef.match(/ST (\w+) (\w+) (\d+)JO/);
      if (match) {
        const providerName = match[1];
        const actionType = match[2];
        const days = parseInt(match[3], 10);
        const provider = providerMap.get(providerName.toLowerCase());

        tasks.push({
          id: taskId,
          jobId,
          sequenceOrder: index + 1,
          type: 'outsourced',
          stationId: null,
          stationName: null,
          setupMinutes: 0,
          runMinutes: 0,
          totalMinutes: 0,
          providerId: provider?.id || `prov-${providerName.toLowerCase()}`,
          providerName: provider?.name || providerName,
          actionType,
          durationOpenDays: days,
          comment: null,
          status: getTaskStatus(jobStatus, index, pattern.length),
          rawInput: taskDef,
        });
      }
    } else {
      // Internal task: Station:setup+run or Station:run
      const parts = taskDef.split(':');
      const stationName = parts[0];
      const timeParts = parts[1].split('+');
      const setupMinutes = timeParts.length > 1 ? parseInt(timeParts[0], 10) : 0;
      const runMinutes = timeParts.length > 1 ? parseInt(timeParts[1], 10) : parseInt(timeParts[0], 10);

      const station = Array.from(stationMap.values()).find(s =>
        s.name.toLowerCase() === stationName.toLowerCase()
      );

      tasks.push({
        id: taskId,
        jobId,
        sequenceOrder: index + 1,
        type: 'internal',
        stationId: station?.id || `station-${stationName.toLowerCase().replace(/\s+/g, '-')}`,
        stationName: station?.name || stationName,
        setupMinutes,
        runMinutes,
        totalMinutes: setupMinutes + runMinutes,
        providerId: null,
        providerName: null,
        actionType: null,
        durationOpenDays: null,
        comment: faker.datatype.boolean(0.2) ? faker.helpers.arrayElement(['vernis', 'recto-verso', 'pantone', 'au mieux']) : null,
        status: getTaskStatus(jobStatus, index, pattern.length),
        rawInput: `[${stationName.replace(/\s+/g, '_')}] ${setupMinutes > 0 ? `${setupMinutes}+${runMinutes}` : runMinutes}`,
      });
    }
  });

  return tasks;
}

function getTaskStatus(jobStatus: JobStatus, taskIndex: number, totalTasks: number): TaskStatus {
  if (jobStatus === 'Draft') {
    return 'Defined';
  }
  if (jobStatus === 'Completed') {
    return 'Completed';
  }
  if (jobStatus === 'Cancelled') {
    return faker.helpers.arrayElement(['Completed', 'Cancelled']);
  }

  // For InProgress/Planned jobs, earlier tasks are more likely to be done
  const progressRatio = taskIndex / totalTasks;

  if (jobStatus === 'Planned') {
    return faker.helpers.weightedArrayElement([
      { weight: 20, value: 'Defined' as const },
      { weight: 50, value: 'Ready' as const },
      { weight: 30, value: 'Assigned' as const },
    ]);
  }

  // InProgress or Delayed
  if (progressRatio < 0.3) {
    return faker.helpers.weightedArrayElement([
      { weight: 60, value: 'Completed' as const },
      { weight: 30, value: 'Assigned' as const },
      { weight: 10, value: 'Ready' as const },
    ]);
  } else if (progressRatio < 0.7) {
    return faker.helpers.weightedArrayElement([
      { weight: 20, value: 'Completed' as const },
      { weight: 40, value: 'Assigned' as const },
      { weight: 30, value: 'Ready' as const },
      { weight: 10, value: 'Defined' as const },
    ]);
  } else {
    return faker.helpers.weightedArrayElement([
      { weight: 10, value: 'Assigned' as const },
      { weight: 40, value: 'Ready' as const },
      { weight: 50, value: 'Defined' as const },
    ]);
  }
}

function generateComments(jobId: string, count: number): JobComment[] {
  const comments: JobComment[] = [];
  const authors = ['scheduler@flux.local', 'manager@flux.local', 'production@flux.local'];

  for (let i = 0; i < count; i++) {
    comments.push({
      author: faker.helpers.arrayElement(authors),
      timestamp: faker.date.recent({ days: 7 }).toISOString(),
      content: faker.helpers.arrayElement([
        'Client confirmed color specs',
        'Rush order - prioritize',
        'Waiting for paper delivery',
        'Proof approved by client',
        'Changed paper type per client request',
        'Quantity updated',
        'Delivery date confirmed',
      ]),
    });
  }

  return comments.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function generateJobs(
  count: number = 10,
  startDate: Date = new Date()
): GeneratedJobData[] {
  const results: GeneratedJobData[] = [];

  for (let i = 0; i < count; i++) {
    const jobId = faker.string.uuid();
    const jobNumber = faker.number.int({ min: 45000, max: 45999 });
    const suffix = faker.helpers.arrayElement(['', ' A', ' B', ' C', '']);

    const status: JobStatus = faker.helpers.weightedArrayElement([
      { weight: 10, value: 'Draft' as const },
      { weight: 35, value: 'Planned' as const },
      { weight: 35, value: 'InProgress' as const },
      { weight: 10, value: 'Delayed' as const },
      { weight: 8, value: 'Completed' as const },
      { weight: 2, value: 'Cancelled' as const },
    ]);

    const deadlineDays = faker.number.int({ min: 3, max: 21 });
    const productType = faker.helpers.arrayElement(PRODUCT_TYPES);
    const quantity = faker.helpers.arrayElement([100, 250, 500, 1000, 2500, 5000, 10000]);
    const format = faker.helpers.arrayElement(['A4', 'A5', 'A6', '10x21', '21x29.7', '9.9x21']);

    const paperPurchaseStatus: PaperPurchaseStatus = faker.helpers.weightedArrayElement([
      { weight: 50, value: 'InStock' as const },
      { weight: 15, value: 'ToOrder' as const },
      { weight: 20, value: 'Ordered' as const },
      { weight: 15, value: 'Received' as const },
    ]);

    const platesStatus: PlatesStatus = status === 'Draft' ? 'Todo' : faker.helpers.weightedArrayElement([
      { weight: 30, value: 'Todo' as const },
      { weight: 70, value: 'Done' as const },
    ]);

    // Proof status logic
    let proofSentAt: string | null = null;
    let proofApprovedAt: string | null = null;

    if (status !== 'Draft') {
      const proofChoice = faker.helpers.weightedArrayElement([
        { weight: 20, value: 'awaiting' },
        { weight: 50, value: 'sent' },
        { weight: 20, value: 'approved' },
        { weight: 10, value: 'noProof' },
      ]);

      if (proofChoice === 'awaiting') {
        proofSentAt = 'AwaitingFile';
      } else if (proofChoice === 'sent') {
        proofSentAt = faker.date.recent({ days: 5 }).toISOString();
      } else if (proofChoice === 'approved') {
        proofSentAt = faker.date.recent({ days: 7 }).toISOString();
        proofApprovedAt = faker.date.recent({ days: 3 }).toISOString();
      } else {
        proofSentAt = 'NoProofRequired';
      }
    }

    const tasks = generateTasksForJob(jobId, status);
    const fullyScheduled = tasks.every(t => t.status === 'Assigned' || t.status === 'Completed');

    const job: Job = {
      id: jobId,
      reference: `${jobNumber}${suffix}`,
      client: faker.helpers.arrayElement(CLIENTS),
      description: `${productType} - ${format} - ${faker.helpers.arrayElement(PAPER_TYPES).split(' ')[0]} - ${quantity} ex`,
      workshopExitDate: addDays(startDate, deadlineDays).toISOString(),
      status,
      fullyScheduled,
      color: JOB_COLORS[i % JOB_COLORS.length],
      paperType: faker.helpers.arrayElement(PAPER_TYPES),
      paperFormat: faker.helpers.arrayElement(PAPER_FORMATS),
      paperPurchaseStatus,
      paperOrderedAt: paperPurchaseStatus === 'Ordered' || paperPurchaseStatus === 'Received'
        ? faker.date.recent({ days: 10 }).toISOString()
        : null,
      proofSentAt,
      proofApprovedAt,
      platesStatus,
      notes: faker.datatype.boolean(0.3) ? faker.lorem.sentence() : '',
      comments: faker.datatype.boolean(0.4) ? generateComments(jobId, faker.number.int({ min: 1, max: 3 })) : [],
      dependencies: [], // Could add job dependencies here
      tasks,
    };

    results.push({ job });
  }

  return results;
}

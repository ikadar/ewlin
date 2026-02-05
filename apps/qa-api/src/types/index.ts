// Priorities
export type Priority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

// Status types
export type ResultStatus = 'untested' | 'ok' | 'ko';
export type TestStatus = 'untested' | 'ok' | 'ko' | 'partial';

// Progress tracking
export interface PriorityProgress {
  total: number;
  ok: number;
  ko: number;
  partial: number;
  untested: number;
}

export interface Progress {
  total: number;
  ok: number;
  ko: number;
  partial: number;
  untested: number;
  percentage: number;
  byPriority?: Record<Priority, PriorityProgress>;
}

// Folder/File structures
export interface QAFolder {
  name: string;
  path: string;
  fileCount: number;
  progress: Progress;
}

export interface QAFile {
  name: string;
  path: string;
  title: string;
  testCount: number;
  progress: Progress;
}

// Parsed test content
export interface Fixture {
  name: string;
  url: string;
  description: string;
}

export interface ExpectedResult {
  index: number;
  text: string;
}

export interface TestScenario {
  id: string; // SCHED-041, JCF-001, VAL-003
  title: string;
  scenario?: string; // Scenario subtitle
  feature?: string;
  fixture?: string;
  priority: Priority;
  preconditions: string[];
  steps: string[];
  expectedResults: ExpectedResult[];
}

export interface ParsedQAFile {
  title: string;
  fixtures: Fixture[];
  tests: TestScenario[];
}

// Status tracking
export interface TestStatusEntry {
  status: TestStatus;
  lastTestedAt: string;
  results: Record<number, ResultStatus>;
}

export interface StatusData {
  version: number;
  updatedAt: string;
  tests: Record<string, TestStatusEntry>;
}

// KO Log
export interface KOLogEntry {
  id: string;
  testId: string;
  resultIndex?: number;
  resultText?: string;
  description: string;
  severity: 'blocker' | 'major' | 'minor';
  createdAt: string;
  resolvedAt: string | null;
}

export interface KOLogsData {
  version: number;
  entries: KOLogEntry[];
}

// Fixture Request
export interface FixtureRequest {
  id: string;
  testId: string;
  fixture: string;
  currentNotes: string;
  requestedChange: string;
  status: 'pending' | 'implemented' | 'rejected';
  createdAt: string;
}

export interface FixtureRequestsData {
  version: number;
  requests: FixtureRequest[];
}

// API Request/Response types
export interface UpdateStatusRequest {
  testId: string;
  resultIndex: number;
  status: ResultStatus;
}

export interface CreateKOLogRequest {
  testId: string;
  resultIndex?: number;
  resultText?: string;
  description: string;
  severity: 'blocker' | 'major' | 'minor';
}

export interface CreateFixtureRequestRequest {
  testId: string;
  fixture: string;
  currentNotes: string;
  requestedChange: string;
}

// Status derivation
export function deriveTestStatus(
  results: Record<number, ResultStatus>
): TestStatus {
  const values = Object.values(results);
  if (values.length === 0) return 'untested';

  const counts = { ok: 0, ko: 0, untested: 0 };
  for (const v of values) counts[v]++;

  if (counts.ko > 0)
    return counts.ok > 0 || counts.untested > 0 ? 'partial' : 'ko';
  if (counts.ok > 0 && counts.untested > 0) return 'partial';
  if (counts.ok > 0) return 'ok';
  return 'untested';
}

// Progress calculation
export function calculateProgress(statuses: TestStatus[]): Progress {
  const total = statuses.length;
  if (total === 0) {
    return { total: 0, ok: 0, ko: 0, partial: 0, untested: 0, percentage: 0 };
  }

  const counts = { ok: 0, ko: 0, partial: 0, untested: 0 };
  for (const s of statuses) counts[s]++;

  const percentage =
    total > 0 ? Math.round(((counts.ok + counts.partial) / total) * 100) : 0;

  return { total, ...counts, percentage };
}

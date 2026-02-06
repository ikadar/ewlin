// Re-export API types for frontend use

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
  id: string;
  title: string;
  scenario?: string;
  feature?: string;
  fixture?: string;
  priority: Priority;
  preconditions: string[];
  steps: string[];
  expectedResults: ExpectedResult[];
}

// Extended test with status
export interface TestStatusEntry {
  status: TestStatus;
  lastTestedAt: string | null;
  results: Record<number, ResultStatus>;
}

export interface TestScenarioWithStatus extends TestScenario {
  fullId: string;
  statusEntry: TestStatusEntry;
}

export interface ParsedQAFile {
  title: string;
  fixtures: Fixture[];
  tests: TestScenario[];
}

export interface ParsedQAFileWithStatus {
  title: string;
  fixtures: Fixture[];
  tests: TestScenarioWithStatus[];
  filePath: string;
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

// Selection state for persistence
export interface SelectionState {
  selectedFolder: string | null;
  selectedFile: string | null;
  selectedTestId: string | null;
}

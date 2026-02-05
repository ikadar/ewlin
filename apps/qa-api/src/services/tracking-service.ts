import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  StatusData,
  TestStatusEntry,
  KOLogsData,
  KOLogEntry,
  FixtureRequestsData,
  FixtureRequest,
  ResultStatus,
  CreateKOLogRequest,
  CreateFixtureRequestRequest,
} from '../types/index.js';
import { deriveTestStatus } from '../types/index.js';

// Tracking directory
const QA_BASE_PATH = path.resolve(process.cwd(), '../../docs/qa');
const TRACKING_DIR = path.join(QA_BASE_PATH, '.tracking');

const STATUS_FILE = path.join(TRACKING_DIR, 'status.json');
const KO_LOGS_FILE = path.join(TRACKING_DIR, 'ko-logs.json');
const FIXTURE_REQUESTS_FILE = path.join(TRACKING_DIR, 'fixture-requests.json');

// Ensure tracking directory exists
function ensureTrackingDir(): void {
  if (!fs.existsSync(TRACKING_DIR)) {
    fs.mkdirSync(TRACKING_DIR, { recursive: true });
  }
}

// Status tracking
function loadStatusData(): StatusData {
  ensureTrackingDir();
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const content = fs.readFileSync(STATUS_FILE, 'utf-8');
      return JSON.parse(content) as StatusData;
    }
  } catch (e) {
    console.error('Failed to load status data:', e);
  }
  return { version: 1, updatedAt: new Date().toISOString(), tests: {} };
}

function saveStatusData(data: StatusData): void {
  ensureTrackingDir();
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
}

export function getTestStatus(testId: string): TestStatusEntry | null {
  const data = loadStatusData();
  return data.tests[testId] || null;
}

export function getAllTestStatuses(): Record<string, TestStatusEntry> {
  const data = loadStatusData();
  return data.tests;
}

export function updateResultStatus(
  testId: string,
  resultIndex: number,
  status: ResultStatus
): TestStatusEntry {
  const data = loadStatusData();

  if (!data.tests[testId]) {
    data.tests[testId] = {
      status: 'untested',
      lastTestedAt: new Date().toISOString(),
      results: {},
    };
  }

  const entry = data.tests[testId];
  entry.results[resultIndex] = status;
  entry.lastTestedAt = new Date().toISOString();
  entry.status = deriveTestStatus(entry.results);

  saveStatusData(data);
  return entry;
}

// KO Logs
function loadKOLogsData(): KOLogsData {
  ensureTrackingDir();
  try {
    if (fs.existsSync(KO_LOGS_FILE)) {
      const content = fs.readFileSync(KO_LOGS_FILE, 'utf-8');
      return JSON.parse(content) as KOLogsData;
    }
  } catch (e) {
    console.error('Failed to load KO logs:', e);
  }
  return { version: 1, entries: [] };
}

function saveKOLogsData(data: KOLogsData): void {
  ensureTrackingDir();
  fs.writeFileSync(KO_LOGS_FILE, JSON.stringify(data, null, 2));
}

export function getAllKOLogs(): KOLogEntry[] {
  const data = loadKOLogsData();
  return data.entries;
}

export function getKOLogsForTest(testId: string): KOLogEntry[] {
  const data = loadKOLogsData();
  return data.entries.filter((e) => e.testId === testId);
}

export function createKOLog(request: CreateKOLogRequest): KOLogEntry {
  const data = loadKOLogsData();

  const entry: KOLogEntry = {
    id: uuidv4(),
    testId: request.testId,
    resultIndex: request.resultIndex,
    resultText: request.resultText,
    description: request.description,
    severity: request.severity,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  // Remove undefined fields for cleaner JSON
  if (entry.resultIndex === undefined) delete entry.resultIndex;
  if (entry.resultText === undefined) delete entry.resultText;

  data.entries.push(entry);
  saveKOLogsData(data);
  return entry;
}

export function resolveKOLog(logId: string): KOLogEntry | null {
  const data = loadKOLogsData();
  const entry = data.entries.find((e) => e.id === logId);

  if (entry) {
    entry.resolvedAt = new Date().toISOString();
    saveKOLogsData(data);
  }

  return entry || null;
}

// Fixture Requests
function loadFixtureRequestsData(): FixtureRequestsData {
  ensureTrackingDir();
  try {
    if (fs.existsSync(FIXTURE_REQUESTS_FILE)) {
      const content = fs.readFileSync(FIXTURE_REQUESTS_FILE, 'utf-8');
      return JSON.parse(content) as FixtureRequestsData;
    }
  } catch (e) {
    console.error('Failed to load fixture requests:', e);
  }
  return { version: 1, requests: [] };
}

function saveFixtureRequestsData(data: FixtureRequestsData): void {
  ensureTrackingDir();
  fs.writeFileSync(FIXTURE_REQUESTS_FILE, JSON.stringify(data, null, 2));
}

export function getAllFixtureRequests(): FixtureRequest[] {
  const data = loadFixtureRequestsData();
  return data.requests;
}

export function getFixtureRequestsForTest(testId: string): FixtureRequest[] {
  const data = loadFixtureRequestsData();
  return data.requests.filter((r) => r.testId === testId);
}

export function createFixtureRequest(
  request: CreateFixtureRequestRequest
): FixtureRequest {
  const data = loadFixtureRequestsData();

  const entry: FixtureRequest = {
    id: uuidv4(),
    testId: request.testId,
    fixture: request.fixture,
    currentNotes: request.currentNotes,
    requestedChange: request.requestedChange,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  data.requests.push(entry);
  saveFixtureRequestsData(data);
  return entry;
}

export function updateFixtureRequestStatus(
  requestId: string,
  status: 'pending' | 'implemented' | 'rejected'
): FixtureRequest | null {
  const data = loadFixtureRequestsData();
  const request = data.requests.find((r) => r.id === requestId);

  if (request) {
    request.status = status;
    saveFixtureRequestsData(data);
  }

  return request || null;
}

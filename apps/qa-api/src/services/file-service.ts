import fs from 'fs';
import path from 'path';
import type {
  QAFolder,
  QAFile,
  ParsedQAFile,
  Progress,
  Priority,
  PriorityProgress,
  TestStatus,
} from '../types/index.js';
import { calculateProgress } from '../types/index.js';
import { parseMarkdown, getTestFullId } from '../parsers/markdown-parser.js';
import { getTestStatus } from './tracking-service.js';

// Base path for QA documents
const QA_BASE_PATH = path.resolve(process.cwd(), '../../docs/qa');

export function getQABasePath(): string {
  return QA_BASE_PATH;
}

export function listFolders(): string[] {
  try {
    const entries = fs.readdirSync(QA_BASE_PATH, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();
  } catch {
    console.error(`Failed to read QA base path: ${QA_BASE_PATH}`);
    return [];
  }
}

export function listFiles(folder: string): string[] {
  const folderPath = path.join(QA_BASE_PATH, folder);
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
      .sort();
  } catch {
    console.error(`Failed to read folder: ${folderPath}`);
    return [];
  }
}

export function readFile(folder: string, file: string): string | null {
  const filePath = path.join(QA_BASE_PATH, folder, file);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    console.error(`Failed to read file: ${filePath}`);
    return null;
  }
}

export function parseFile(folder: string, file: string): ParsedQAFile | null {
  const content = readFile(folder, file);
  if (!content) return null;
  return parseMarkdown(content, `${folder}/${file}`);
}

function calculateProgressWithPriority(
  testStatuses: { status: TestStatus; priority: Priority }[]
): Progress {
  const statuses = testStatuses.map((t) => t.status);
  const progress = calculateProgress(statuses);

  // Calculate by priority
  const byPriority: Record<Priority, PriorityProgress> = {
    P1: { total: 0, ok: 0, ko: 0, partial: 0, untested: 0 },
    P2: { total: 0, ok: 0, ko: 0, partial: 0, untested: 0 },
    P3: { total: 0, ok: 0, ko: 0, partial: 0, untested: 0 },
    P4: { total: 0, ok: 0, ko: 0, partial: 0, untested: 0 },
    P5: { total: 0, ok: 0, ko: 0, partial: 0, untested: 0 },
  };

  for (const t of testStatuses) {
    byPriority[t.priority].total++;
    byPriority[t.priority][t.status]++;
  }

  return { ...progress, byPriority };
}

export function getFoldersWithProgress(): QAFolder[] {
  const folders = listFolders();

  return folders.map((folderName) => {
    const files = listFiles(folderName);
    const testStatuses: { status: TestStatus; priority: Priority }[] = [];

    for (const fileName of files) {
      const parsed = parseFile(folderName, fileName);
      if (parsed) {
        for (const test of parsed.tests) {
          const fullId = getTestFullId(folderName, fileName, test.id);
          const statusEntry = getTestStatus(fullId);
          testStatuses.push({
            status: statusEntry?.status || 'untested',
            priority: test.priority,
          });
        }
      }
    }

    return {
      name: folderName,
      path: folderName,
      fileCount: files.length,
      progress: calculateProgressWithPriority(testStatuses),
    };
  });
}

export function getFilesWithProgress(folder: string): QAFile[] {
  const files = listFiles(folder);

  return files.map((fileName) => {
    const parsed = parseFile(folder, fileName);
    const testStatuses: { status: TestStatus; priority: Priority }[] = [];
    let title = fileName;

    if (parsed) {
      title = parsed.title;
      for (const test of parsed.tests) {
        const fullId = getTestFullId(folder, fileName, test.id);
        const statusEntry = getTestStatus(fullId);
        testStatuses.push({
          status: statusEntry?.status || 'untested',
          priority: test.priority,
        });
      }
    }

    return {
      name: fileName,
      path: `${folder}/${fileName}`,
      title,
      testCount: testStatuses.length,
      progress: calculateProgressWithPriority(testStatuses),
    };
  });
}

export function getFileContent(
  folder: string,
  file: string
): ParsedQAFile | null {
  return parseFile(folder, file);
}

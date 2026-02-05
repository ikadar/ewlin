import type {
  ParsedQAFile,
  Fixture,
  TestScenario,
  ExpectedResult,
  Priority,
} from '../types/index.js';

// Test ID patterns (both formats)
const TEST_ID_PATTERNS = [
  // SCHED-041 - Title (scheduler format)
  /^###\s+(SCHED-\d+)\s*[-–]\s*(.+)$/,
  // JCF-001: Title, VAL-001: Title, API-001: Title, etc.
  /^###\s+([A-Z]+-\d+):\s*(.+)$/,
  // Fallback: ### SCHED-041/045 - Title (combined IDs)
  /^###\s+(SCHED-\d+(?:\/\d+)*)\s*[-–]\s*(.+)$/,
];

// Metadata patterns
const SCENARIO_PATTERN = /^####\s+Scenario:\s*(.+)$/m;
const FEATURE_PATTERN = /^\*\*Feature:\*\*\s*(.+)$/m;
const FIXTURE_PATTERN = /^\*\*Fixture:\*\*\s*`?([^`\n]+)`?$/m;
const PRIORITY_PATTERN = /^\*\*Priority:\*\*\s*(P[1-5])$/m;

// Section patterns
const PRECONDITIONS_PATTERN =
  /\*\*Preconditions:\*\*\n([\s\S]*?)(?=\n\*\*|\n###|$)/;
const STEPS_PATTERN = /\*\*Steps:\*\*\n([\s\S]*?)(?=\n\*\*|\n###|$)/;
const EXPECTED_PATTERN =
  /\*\*Expected Results?:\*\*\n([\s\S]*?)(?=\n###|\n---|\n\*\*[A-Z]|$)/;

// List item patterns
const CHECKBOX_ITEM = /^-\s+\[[ x]\]\s+(.+)$/;
const BULLET_ITEM = /^-\s+(.+)$/;
const NUMBERED_ITEM = /^\d+\.\s+(.+)$/;

// Fixture table pattern
const FIXTURE_TABLE_PATTERN =
  /\|\s*`?([^|`]+)`?\s*\|\s*`?([^|`]+)`?\s*\|\s*([^|]+)\s*\|/g;

function parseFixtureTable(content: string): Fixture[] {
  const fixtures: Fixture[] = [];
  const lines = content.split('\n');

  let inFixtureSection = false;
  for (const line of lines) {
    if (line.includes('Test Fixtures') || line.includes('| Fixture |')) {
      inFixtureSection = true;
      continue;
    }
    if (inFixtureSection && line.startsWith('---')) {
      break; // End of fixture section
    }
    if (inFixtureSection && line.startsWith('|') && !line.includes('---')) {
      const match = line.match(
        /\|\s*`?([^|`]+)`?\s*\|\s*`?([^|`]+)`?\s*\|\s*([^|]+)\s*\|/
      );
      if (match && match[1] !== 'Fixture' && !match[1].includes('---')) {
        const name = match[1].trim();
        const url = match[2].trim();
        const description = match[3].trim();
        if (name && url) {
          fixtures.push({ name, url, description });
        }
      }
    }
  }

  return fixtures;
}

function parseListItems(
  content: string
): { type: 'checkbox' | 'bullet' | 'numbered'; text: string }[] {
  const items: { type: 'checkbox' | 'bullet' | 'numbered'; text: string }[] =
    [];

  const lines = content.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const checkboxMatch = line.match(CHECKBOX_ITEM);
    if (checkboxMatch) {
      items.push({ type: 'checkbox', text: checkboxMatch[1].trim() });
      continue;
    }

    const numberedMatch = line.match(NUMBERED_ITEM);
    if (numberedMatch) {
      items.push({ type: 'numbered', text: numberedMatch[1].trim() });
      continue;
    }

    const bulletMatch = line.match(BULLET_ITEM);
    if (bulletMatch) {
      items.push({ type: 'bullet', text: bulletMatch[1].trim() });
    }
  }

  return items;
}

function inferPriority(testId: string, feature?: string): Priority {
  // ID-based inference
  if (testId.startsWith('VAL-')) return 'P1'; // Validation = high priority
  if (testId.startsWith('API-')) return 'P2'; // API tests
  if (testId.startsWith('PREREQ-')) return 'P1'; // Prerequisites = critical
  if (testId.startsWith('TMPL-')) return 'P2'; // Template tests

  // Feature-based inference
  if (feature) {
    if (feature.includes('blocking') || feature.includes('required'))
      return 'P1';
  }

  // Default
  return 'P3';
}

function parseTestBlock(block: string, testId: string, title: string): TestScenario {
  // Extract scenario subtitle
  const scenarioMatch = block.match(SCENARIO_PATTERN);
  const scenario = scenarioMatch ? scenarioMatch[1].trim() : undefined;

  // Extract feature
  const featureMatch = block.match(FEATURE_PATTERN);
  const feature = featureMatch ? featureMatch[1].trim() : undefined;

  // Extract fixture - first try explicit **Fixture:** field
  const fixtureMatch = block.match(FIXTURE_PATTERN);
  let fixture = fixtureMatch ? fixtureMatch[1].trim() : undefined;

  // Extract priority
  const priorityMatch = block.match(PRIORITY_PATTERN);
  const priority: Priority = priorityMatch
    ? (priorityMatch[1] as Priority)
    : inferPriority(testId, feature);

  // Extract preconditions
  const preconditionsMatch = block.match(PRECONDITIONS_PATTERN);
  const preconditions: string[] = [];
  if (preconditionsMatch) {
    const items = parseListItems(preconditionsMatch[1]);
    preconditions.push(...items.map((i) => i.text));
  }

  // Extract steps
  const stepsMatch = block.match(STEPS_PATTERN);
  const steps: string[] = [];
  if (stepsMatch) {
    const items = parseListItems(stepsMatch[1]);
    steps.push(...items.map((i) => i.text));
  }

  // Extract expected results
  const expectedMatch = block.match(EXPECTED_PATTERN);
  const expectedResults: ExpectedResult[] = [];
  if (expectedMatch) {
    const items = parseListItems(expectedMatch[1]);
    items.forEach((item, index) => {
      expectedResults.push({ index, text: item.text });
    });
  }

  return {
    id: testId,
    title: title.trim(),
    scenario,
    feature,
    fixture,
    priority,
    preconditions,
    steps,
    expectedResults,
  };
}

export function parseMarkdown(content: string, filePath: string): ParsedQAFile {
  // Extract title from first H1 or H2
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : filePath;

  // Parse fixture table
  const fixtures = parseFixtureTable(content);

  // Split into test blocks
  const tests: TestScenario[] = [];

  // Find all test headers
  const lines = content.split('\n');
  let currentTestStart = -1;
  let currentTestId = '';
  let currentTestTitle = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for test ID pattern
    for (const pattern of TEST_ID_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        // If we have a previous test, parse it
        if (currentTestStart >= 0) {
          const block = lines.slice(currentTestStart, i).join('\n');
          const test = parseTestBlock(block, currentTestId, currentTestTitle);
          if (test.expectedResults.length > 0) {
            tests.push(test);
          }
        }

        // Start new test
        currentTestStart = i;
        currentTestId = match[1];
        currentTestTitle = match[2];
        break;
      }
    }
  }

  // Parse last test
  if (currentTestStart >= 0) {
    const block = lines.slice(currentTestStart).join('\n');
    const test = parseTestBlock(block, currentTestId, currentTestTitle);
    if (test.expectedResults.length > 0) {
      tests.push(test);
    }
  }

  return { title, fixtures, tests };
}

export function getTestFullId(folderName: string, fileName: string, testId: string): string {
  return `${folderName}/${fileName}::${testId}`;
}

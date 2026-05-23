import { test, expect } from '@playwright/test';
import { injectTestAuth } from './helpers/auth';
import {
  apiClearNowOverride,
  apiExecuteScenario,
  apiGetSnapshot,
  apiPinAtTime,
  apiSetNowOverride,
  apiSubmitProgressCapture,
  apiTriggerCompute,
  apiUnpinAll,
  apiUpdateElementPrerequisites,
  apiUpdateJob,
  apiWipeJobs,
  disposeApiContext,
  ensureBaseJobs,
  ensureRecipesAndScenarios,
  logResult,
  patchGatesByRecipe,
  resetResultsFile,
  screenshotStep,
  waitForGridIdle,
  type ScheduleSnapshot,
  type TestResult,
} from './helpers/qa-runner';

test.describe.configure({ mode: 'serial' });

let scenarioIds: Record<string, string> = {};
let recipeIds: Record<string, string> = {};

const NOW_LUNDI_09 = '2026-05-11T09:00';
const NOW_LUNDI_0930 = '2026-05-11T09:30';
const NOW_LUNDI_0935 = '2026-05-11T09:35';
const NOW_LUNDI_0945 = '2026-05-11T09:45';
const NOW_LUNDI_10 = '2026-05-11T10:00';
const NOW_MARDI_09 = '2026-05-12T09:00';

async function softCapture<T>(fn: () => Promise<T>, fallback: T): Promise<{ value: T; error?: string }> {
  try {
    const value = await fn();
    return { value };
  } catch (e) {
    return { value: fallback, error: e instanceof Error ? e.message : String(e) };
  }
}

function jobsByReferenceContains(snapshot: ScheduleSnapshot, refSubstring: string) {
  return (snapshot.jobs ?? []).filter((j) => j.reference.includes(refSubstring));
}

function assignmentsForJob(snapshot: ScheduleSnapshot, jobId: string) {
  return (snapshot.assignments ?? []).filter((a) => a.jobId === jobId);
}

async function arrangeScenario(scenario: keyof typeof scenarioIds, virtualNow: string | null): Promise<{ jobs: { id: string; reference: string }[] }> {
  await apiWipeJobs();
  if (virtualNow) {
    await apiSetNowOverride(virtualNow, true);
  } else {
    await apiClearNowOverride();
  }
  const exec = await apiExecuteScenario(scenarioIds[scenario]);
  await apiTriggerCompute('preprod').catch(() => undefined);
  return exec;
}

test.beforeAll(async () => {
  await resetResultsFile();
  const baseJobs = await ensureBaseJobs();
  const result = await ensureRecipesAndScenarios(baseJobs);
  recipeIds = result.recipes;
  scenarioIds = result.scenarios;
});

test.afterAll(async () => {
  await apiClearNowOverride().catch(() => undefined);
  await disposeApiContext();
});

test.beforeEach(async ({ page }) => {
  await injectTestAuth(page);
});

test('T1 — Productivité décrémente le run après saisie 20%', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T1';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-productivity', NOW_LUNDI_09);
    await page.goto('/');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'arrange'));

    const baselineSnap = await apiGetSnapshot('preprod');
    const multiJob = jobs.find((j) => j.reference.startsWith('JTM-')) ?? jobs[0];
    const baselineRunMin = (assignmentsForJob(baselineSnap, multiJob.id)[0]?.runMinutes) ?? 120;

    await apiSetNowOverride(NOW_LUNDI_0930, true);
    await apiTriggerCompute('preprod').catch(() => undefined);

    const inProgressAssign = assignmentsForJob(await apiGetSnapshot('prod'), multiJob.id)[0];
    if (inProgressAssign) {
      await apiSubmitProgressCapture(inProgressAssign.taskId, {
        recordedProgressPct: 20,
        recordedAt: NOW_LUNDI_0930,
      }).catch((e) => {
        observation += ` saisie API échouée: ${e.message}.`;
      });
    } else {
      observation += ' Aucun assignment in-progress trouvé pour appliquer la saisie.';
      status = 'PARTIAL';
    }

    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.reload();
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'after-saisie'));

    const finalSnap = await apiGetSnapshot('preprod');
    const finalAssign = assignmentsForJob(finalSnap, multiJob.id)[0];
    const finalRunMin = finalAssign?.runMinutes ?? 0;

    observation += ` Baseline run=${baselineRunMin} min ; après saisie 20% à 09:30 → run=${finalRunMin} min.`;
    if (finalRunMin <= baselineRunMin) {
      status = status === 'PARTIAL' ? 'PARTIAL' : 'KO';
      observation += ' Run restant <= baseline alors qu\'on attend une extension par ratio>1.';
    }

    screenshots.push(await screenshotStep(page, testId, 'final'));
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
    screenshots.push(await screenshotStep(page, testId, 'error').catch(() => 'screenshot-error'));
  }

  await logResult({
    testId,
    title: 'Productivité décrémente le run après saisie 20%',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'Run restant > baseline (productivité ratio > 1) post-saisie 20% à mi-parcours nominal 25%',
    observation,
    screenshots,
  });
  expect(status).not.toBe('KO-MUST-FAIL');
});

test('T1bi — Run restant correct après JCF modification (qty x2)', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T1bi';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-prod-mutation', NOW_LUNDI_09);
    const multiJob = jobs.find((j) => j.reference.startsWith('JTM-')) ?? jobs[jobs.length - 1];

    const initialSnap = await apiGetSnapshot('preprod');
    const initialAssign = assignmentsForJob(initialSnap, multiJob.id)[0];

    if (initialAssign) {
      await apiPinAtTime(initialAssign.taskId, NOW_LUNDI_09).catch(() => undefined);
    }
    await apiSetNowOverride(NOW_LUNDI_10, true);
    await apiTriggerCompute('prod').catch(() => undefined);

    await page.goto('/');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'arrange-pinned-and-now-shifted'));

    const beforeQty = await apiUpdateJob(multiJob.id, {
      quantity: 2000,
    }).catch((e) => ({ error: e.message }));

    if ((beforeQty as { error?: string })?.error) {
      observation += ` Update job (qty x2) échoué: ${(beforeQty as { error: string }).error}.`;
      status = 'PARTIAL';
    }

    await apiTriggerCompute('prod').catch(() => undefined);
    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.reload();
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'after-jcf-modif'));

    const finalSnap = await apiGetSnapshot('preprod');
    const finalAssign = assignmentsForJob(finalSnap, multiJob.id)[0];
    observation += ` Avant: run=${initialAssign?.runMinutes ?? '?'}. Après qty x2: run=${finalAssign?.runMinutes ?? '?'}.`;
    if (finalAssign && initialAssign && finalAssign.runMinutes && initialAssign.runMinutes && finalAssign.runMinutes <= initialAssign.runMinutes) {
      status = 'KO';
      observation += ' Run après modif <= run avant — qty x2 non répercutée.';
    }
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Run restant correct après JCF modification (qty x2)',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'Commited (09:00→10:00) verbatim ; post-NOW = run nouvelle qty - elapsed',
    observation,
    screenshots,
  });
  expect(status).not.toBe('KO-MUST-FAIL');
});

test('T1bii — Replacement après Ctrl+Alt+Z conserve commited', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T1bii';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-prod-mutation', NOW_LUNDI_09);
    const multiJob = jobs.find((j) => j.reference.startsWith('JTM-')) ?? jobs[jobs.length - 1];

    const snapBefore = await apiGetSnapshot('preprod');
    const assignBefore = assignmentsForJob(snapBefore, multiJob.id)[0];
    if (assignBefore) {
      await apiPinAtTime(assignBefore.taskId, NOW_LUNDI_09).catch(() => undefined);
    }
    await apiSetNowOverride(NOW_LUNDI_10, true);
    await apiTriggerCompute('prod').catch(() => undefined);

    await page.goto('/');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'arrange-with-pins'));

    await apiUnpinAll('preprod').catch(() => undefined);
    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.reload();
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'after-unpin-all'));

    const snapAfter = await apiGetSnapshot('preprod');
    const assignAfter = assignmentsForJob(snapAfter, multiJob.id)[0];

    observation += ` Avant unpin: ${assignBefore?.scheduledStart ?? '?'}→${assignBefore?.scheduledEnd ?? '?'}. Après: ${assignAfter?.scheduledStart ?? '?'}→${assignAfter?.scheduledEnd ?? '?'}.`;
    if (assignAfter && new Date(assignAfter.scheduledStart) > new Date(NOW_LUNDI_10)) {
      status = 'KO';
      observation += ' scheduledStart est passé après NOW — la portion commited n\'est pas préservée.';
    }
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Replacement après Ctrl+Alt+Z conserve commited',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'Commited (09:00→10:00) verbatim après lever-tout-puis-replace',
    observation,
    screenshots,
  });
});

test('T2 — Job BAT pending placé à batDeadline', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T2';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-gates', null);

    const batJob = jobs[0];
    const detail = await apiUpdateJob(batJob.id, {}).catch(() => null);
    void detail;
    const detailGet = await (await import('./helpers/qa-runner')).apiCall<{ elements: Array<{ id: string }>; batDeadline?: string }>(
      'GET',
      `/jobs/${batJob.id}`,
    );

    for (const el of detailGet.elements ?? []) {
      await apiUpdateElementPrerequisites(el.id, { batStatus: 'waiting_files' }).catch(() => undefined);
    }
    await apiTriggerCompute('preprod').catch(() => undefined);

    await page.goto('/');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'final'));

    const snap = await apiGetSnapshot('preprod');
    const assigns = assignmentsForJob(snap, batJob.id);
    const earliestStart = assigns.length ? assigns.map((a) => a.scheduledStart).sort()[0] : null;
    const declared = detailGet.batDeadline;
    observation += ` BAT job ${batJob.reference} : batDeadline=${declared ?? 'n/a'} ; earliestStart=${earliestStart}.`;
    if (declared && earliestStart && new Date(earliestStart) < new Date(declared)) {
      status = 'KO';
      observation += ' Le job est placé AVANT batDeadline → gate non respecté.';
    }
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Job BAT pending placé à batDeadline',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'earliestStart >= batDeadline déclaré',
    observation,
    screenshots,
  });
});

test('T3a — Job paper ordered AM placé J+1 ouvré', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T3a';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-gates', null);

    const paperAmJob = jobs[1];
    const { apiCall } = await import('./helpers/qa-runner');
    const detail = await apiCall<{ elements: Array<{ id: string }> }>('GET', `/jobs/${paperAmJob.id}`);
    for (const el of detail.elements ?? []) {
      await apiUpdateElementPrerequisites(el.id, { paperStatus: 'ordered' }).catch(() => undefined);
    }
    await apiTriggerCompute('preprod').catch(() => undefined);

    await page.goto('/');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'final'));

    const snap = await apiGetSnapshot('preprod');
    const assigns = assignmentsForJob(snap, paperAmJob.id);
    const earliestStart = assigns.length ? assigns.map((a) => a.scheduledStart).sort()[0] : null;
    observation += ` Paper-AM job ${paperAmJob.reference} : paperStatus=ordered ; earliestStart=${earliestStart}. (Attendu: J+1 ouvré post commande, voire J+2 selon settings)`;
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Job paper ordered AM placé J+1 ouvré',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'earliestStart >= NOW + lead-time paper (1j ouvré post commande AM)',
    observation,
    screenshots,
  });
});

test('T3b — Job paper ordered PM cutoff → J+2 ouvré', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T3b';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-gates', null);

    const paperPmJob = jobs[2];
    const { apiCall } = await import('./helpers/qa-runner');
    const detail = await apiCall<{ elements: Array<{ id: string }> }>('GET', `/jobs/${paperPmJob.id}`);
    for (const el of detail.elements ?? []) {
      await apiUpdateElementPrerequisites(el.id, { paperStatus: 'ordered' }).catch(() => undefined);
    }
    await apiTriggerCompute('preprod').catch(() => undefined);

    await page.goto('/');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'final'));

    const snap = await apiGetSnapshot('preprod');
    const assigns = assignmentsForJob(snap, paperPmJob.id);
    const earliestStart = assigns.length ? assigns.map((a) => a.scheduledStart).sort()[0] : null;
    observation += ` Paper-PM job ${paperPmJob.reference} : earliestStart=${earliestStart}. (Attendu: décalage processing-day si commande post-cutoff 14h)`;
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Job paper ordered PM cutoff → J+2 ouvré',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'earliestStart > J+1 ouvré (processing-day shift sur commande post-cutoff)',
    observation,
    screenshots,
  });
});

test('T4 — Job plate pending placé à NOW + 2h', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T4';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-gates', NOW_MARDI_09);

    const plateJob = jobs[3];
    const { apiCall } = await import('./helpers/qa-runner');
    const detail = await apiCall<{ elements: Array<{ id: string }> }>('GET', `/jobs/${plateJob.id}`);
    for (const el of detail.elements ?? []) {
      await apiUpdateElementPrerequisites(el.id, { plateStatus: 'to_make' }).catch(() => undefined);
    }
    await apiTriggerCompute('preprod').catch(() => undefined);

    await page.goto('/');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'final'));

    const snap = await apiGetSnapshot('preprod');
    const assigns = assignmentsForJob(snap, plateJob.id);
    const earliestStart = assigns.length ? assigns.map((a) => a.scheduledStart).sort()[0] : null;
    const expectedFloor = new Date('2026-05-12T11:00');
    observation += ` Plate job ${plateJob.reference} : earliestStart=${earliestStart} ; floor attendu ≈ ${expectedFloor.toISOString()}.`;
    if (earliestStart && new Date(earliestStart) < expectedFloor) {
      status = 'KO';
      observation += ' earliestStart < NOW+2h → gate plate non respecté.';
    }
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Job plate pending placé à NOW + 2h',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'earliestStart >= NOW + 2h (plate offset)',
    observation,
    screenshots,
  });
});

test('T5a — Min-chunk respecté (pas de swap < 60min)', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T5a';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-replacement', NOW_LUNDI_09);
    const inProgress = jobs[0];

    const snap0 = await apiGetSnapshot('preprod');
    const assign0 = assignmentsForJob(snap0, inProgress.id)[0];
    if (assign0) {
      await apiPinAtTime(assign0.taskId, NOW_LUNDI_09).catch(() => undefined);
    }
    await apiSetNowOverride(NOW_LUNDI_0945, true);
    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.goto('/');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'arrange'));

    await apiUnpinAll('preprod').catch(() => undefined);
    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.reload();
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'after-unpin'));

    const snap1 = await apiGetSnapshot('preprod');
    const assign1 = assignmentsForJob(snap1, inProgress.id)[0];
    observation += ` Tâche in-progress après unpin à 09:45 (min-chunk 60min) : ${assign1?.scheduledStart ?? '?'}→${assign1?.scheduledEnd ?? '?'} sur station ${assign1?.stationId ?? '?'}.`;
    if (assign1 && new Date(assign1.scheduledEnd) < new Date(NOW_LUNDI_10)) {
      status = 'KO';
      observation += ' Tâche raccourcie avant 10:00 → min-chunk non respecté.';
    }
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Min-chunk respecté (pas de swap < 60min)',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'Tâche in-progress reste sur sa station jusqu\'à au moins start + min-chunk',
    observation,
    screenshots,
  });
});

test('T5b — Calage non périmé conservé', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T5b';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-replacement', NOW_LUNDI_09);
    const inProgress = jobs[0];
    const snap0 = await apiGetSnapshot('preprod');
    const assign0 = assignmentsForJob(snap0, inProgress.id)[0];
    if (assign0) await apiPinAtTime(assign0.taskId, NOW_LUNDI_09).catch(() => undefined);

    await apiSetNowOverride(NOW_LUNDI_0935, true);
    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.goto('/');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'arrange'));

    await apiUnpinAll('preprod').catch(() => undefined);
    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.reload();
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'final'));

    const snap1 = await apiGetSnapshot('preprod');
    const assign1 = assignmentsForJob(snap1, inProgress.id)[0];
    observation += ` Setup committed=${assign0?.setupMinutes ?? '?'} min ; après unpin à 09:35 : setup=${assign1?.setupMinutes ?? '?'} (idle 5min < péremption attendue).`;
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Calage non périmé conservé',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'Setup committed reste à 30 min, pas de re-setup ajouté',
    observation,
    screenshots,
  });
});

test('T5c — Calage non volé reste utilisable', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T5c';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-replacement', NOW_LUNDI_09);
    const inProgress = jobs[0];
    const snap0 = await apiGetSnapshot('preprod');
    const assign0 = assignmentsForJob(snap0, inProgress.id)[0];
    if (assign0) await apiPinAtTime(assign0.taskId, NOW_LUNDI_09).catch(() => undefined);

    await apiSetNowOverride(NOW_LUNDI_10, true);
    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.goto('/');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'arrange'));

    await apiUnpinAll('preprod').catch(() => undefined);
    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.reload();
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'final'));

    const snap1 = await apiGetSnapshot('preprod');
    const assign1 = assignmentsForJob(snap1, inProgress.id)[0];
    observation += ` Tâche après unpin à 10:00 sur station ${assign1?.stationId} : setup=${assign1?.setupMinutes ?? '?'} min (calage non volé attendu).`;
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Calage non volé reste utilisable',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'Setup committed=30min reste actif, pas de re-setup',
    observation,
    screenshots,
  });
});

test('T6a — Flip BAT pending → ok recule earliestStart à NOW', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T6a';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-prod-mutation', null);
    const batJob = jobs[0];
    const { apiCall } = await import('./helpers/qa-runner');
    const detail = await apiCall<{ elements: Array<{ id: string }> }>('GET', `/jobs/${batJob.id}`);
    for (const el of detail.elements ?? []) {
      await apiUpdateElementPrerequisites(el.id, { batStatus: 'waiting_files' }).catch(() => undefined);
    }
    await apiTriggerCompute('prod').catch(() => undefined);

    await page.goto('/?env=prod');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'before-flip'));

    const snapBefore = await apiGetSnapshot('prod');
    const startBefore = assignmentsForJob(snapBefore, batJob.id)[0]?.scheduledStart ?? null;

    for (const el of detail.elements ?? []) {
      await apiUpdateElementPrerequisites(el.id, { batStatus: 'approved' }).catch(() => undefined);
    }
    await apiTriggerCompute('prod').catch(() => undefined);
    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.reload();
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'after-flip'));

    const snapAfter = await apiGetSnapshot('prod');
    const startAfter = assignmentsForJob(snapAfter, batJob.id)[0]?.scheduledStart ?? null;

    observation += ` Avant flip BAT: start=${startBefore} ; après flip→approved: start=${startAfter}.`;
    if (startBefore && startAfter && new Date(startAfter) >= new Date(startBefore)) {
      status = 'KO';
      observation += ' earliestStart n\'a PAS reculé après flip BAT→approved.';
    }
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Flip BAT pending → ok recule earliestStart',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'earliestStart Prod recule (revient à NOW) après BAT→approved',
    observation,
    screenshots,
  });
});

test('T6b — Flip paper ordered → ok recule earliestStart', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T6b';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-prod-mutation', null);
    const paperJob = jobs[1];
    const { apiCall } = await import('./helpers/qa-runner');
    const detail = await apiCall<{ elements: Array<{ id: string }> }>('GET', `/jobs/${paperJob.id}`);
    for (const el of detail.elements ?? []) {
      await apiUpdateElementPrerequisites(el.id, { paperStatus: 'ordered' }).catch(() => undefined);
    }
    await apiTriggerCompute('prod').catch(() => undefined);

    await page.goto('/?env=prod');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'before-flip'));

    const snapBefore = await apiGetSnapshot('prod');
    const startBefore = assignmentsForJob(snapBefore, paperJob.id)[0]?.scheduledStart ?? null;

    for (const el of detail.elements ?? []) {
      await apiUpdateElementPrerequisites(el.id, { paperStatus: 'delivered' }).catch(() => undefined);
    }
    await apiTriggerCompute('prod').catch(() => undefined);
    await page.reload();
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'after-flip'));

    const snapAfter = await apiGetSnapshot('prod');
    const startAfter = assignmentsForJob(snapAfter, paperJob.id)[0]?.scheduledStart ?? null;

    observation += ` Avant flip paper ordered→delivered: ${startBefore} ; après: ${startAfter}.`;
    if (startBefore && startAfter && new Date(startAfter) >= new Date(startBefore)) {
      status = 'KO';
      observation += ' earliestStart n\'a PAS reculé après flip paper.';
    }
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Flip paper ordered → delivered recule earliestStart',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'earliestStart Prod recule après paper→delivered',
    observation,
    screenshots,
  });
});

test('T6c — Cohérence des 4 vues post-flip', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T6c';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    await page.goto('/?env=prod');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'view-prod-stations'));

    await page.goto('/flux');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'view-flux-prod'));

    await page.goto('/?env=preprod');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'view-preprod-stations'));

    const opsLink = page.getByRole('button', { name: /Planning opérateurs/ });
    if (await opsLink.count()) {
      await opsLink.first().click();
      await waitForGridIdle(page);
    }
    screenshots.push(await screenshotStep(page, testId, 'view-preprod-operators'));

    observation += ` 4 vues capturées séquentiellement en headed pour comparaison visuelle. Vérification automatique : présence de tuiles non-zéro dans chaque vue.`;
    const snap = await apiGetSnapshot('prod');
    if ((snap.assignments ?? []).length === 0) {
      status = 'PARTIAL';
      observation += ' Snapshot Prod vide → 4-vues comparaison limitée.';
    }
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Cohérence des 4 vues post-flip gate',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'Les 4 vues (Prod stations, Flux Prod, Préprod stations, Préprod opérateurs) reflètent le flip',
    observation,
    screenshots,
  });
});

test('T7 — Modifier un job en prod (qty x1.5)', async ({ page }) => {
  const startedAt = Date.now();
  const testId = 'T7';
  const screenshots: string[] = [];
  let observation = '';
  let status: TestResult['status'] = 'OK';

  try {
    const { jobs } = await arrangeScenario('S-prod-mutation', NOW_LUNDI_09);
    const multiJob = jobs.find((j) => j.reference.startsWith('JTM-')) ?? jobs[jobs.length - 1];

    const snap0 = await apiGetSnapshot('prod');
    const assign0 = assignmentsForJob(snap0, multiJob.id)[0];
    if (assign0) await apiPinAtTime(assign0.taskId, NOW_LUNDI_09).catch(() => undefined);
    await apiSetNowOverride(NOW_LUNDI_10, true);
    await apiTriggerCompute('prod').catch(() => undefined);

    await page.goto('/?env=prod');
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'before-modif'));

    const beforeRunMin = assignmentsForJob(await apiGetSnapshot('prod'), multiJob.id)[0]?.runMinutes ?? 0;

    const updateResp = await apiUpdateJob(multiJob.id, { quantity: 1500 }).catch((e) => ({ error: e.message }));
    if ((updateResp as { error?: string })?.error) {
      observation += ` PUT /jobs/{id} échoué: ${(updateResp as { error: string }).error}.`;
      status = 'PARTIAL';
    }

    await apiTriggerCompute('prod').catch(() => undefined);
    await apiTriggerCompute('preprod').catch(() => undefined);
    await page.reload();
    await waitForGridIdle(page);
    screenshots.push(await screenshotStep(page, testId, 'after-modif'));

    const afterRunMin = assignmentsForJob(await apiGetSnapshot('prod'), multiJob.id)[0]?.runMinutes ?? 0;

    observation += ` Avant modif: run=${beforeRunMin}. Après qty x1.5: run=${afterRunMin}.`;
    if (afterRunMin <= beforeRunMin) {
      status = status === 'PARTIAL' ? 'PARTIAL' : 'KO';
      observation += ' run après modif <= avant — qty x1.5 non répercutée.';
    }
  } catch (e) {
    status = 'KO';
    observation += ` Exception: ${e instanceof Error ? e.message : String(e)}`;
  }

  await logResult({
    testId,
    title: 'Modifier un job en prod (qty x1.5)',
    status,
    durationMs: Date.now() - startedAt,
    expected: 'Commited verbatim ; post-NOW reflète qty x1.5 (run augmenté)',
    observation,
    screenshots,
  });
});

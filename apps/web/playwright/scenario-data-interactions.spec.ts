/**
 * Audit E2E des interactions data dans une simulation (fork).
 *
 * Modèle : chaque entité a une copie par fork (id distinct, origin_id
 * pointant vers la préprod). Comme l'API n'expose pas origin_id, on
 * utilise des champs stables cross-scope (`reference` pour Job,
 * `lastName + firstName` pour Operator) pour identifier la "même"
 * entité dans préprod et fork.
 *
 * Ne FAIL JAMAIS via expect — tout passe par check() qui logge
 * PASS/BUG. afterAll imprime le récap.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:8080/api/v1';

interface Op { id: string; firstName: string; lastName: string; absences?: any[] | null; overtimes?: any[] | null }
interface Job { id: string; reference: string; client: string; description: string; workshopExitDate: string; quantity: number; deadlinePriority: number }

let apiCtx: APIRequestContext;
let token: string;
let forkId: string;
const report: string[] = [];
let pass = 0;
let bug = 0;

function log(msg: string) { console.log('[AUDIT]', msg); report.push(msg); }
function check(label: string, ok: boolean, detail?: string) {
  if (ok) { pass++; log(`✅ ${label}${detail ? ` — ${detail}` : ''}`); }
  else { bug++; log(`❌ ${label}${detail ? ` — ${detail}` : ''}`); }
}

async function api(method: 'GET'|'POST'|'PUT'|'DELETE', path: string, body?: unknown, scenario?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (scenario) headers['X-Flux-Scenario'] = scenario;
  return apiCtx.fetch(`${API}${path}`, { method, headers, data: body as any });
}

function asArray<T>(body: any): T[] {
  if (Array.isArray(body)) return body as T[];
  return (body?.items ?? body?.data ?? []) as T[];
}

async function jobsIn(scenario?: string): Promise<Job[]> {
  // /jobs is paginated (limit=100 hard cap). Fetch all pages.
  const out: Job[] = [];
  for (let page = 1; page <= 20; page++) {
    const resp = await api('GET', `/jobs?page=${page}&limit=100`, undefined, scenario);
    const body = await resp.json();
    const items = asArray<Job>(body);
    out.push(...items);
    const total = body?.total ?? items.length;
    if (out.length >= total || items.length === 0) break;
  }
  return out;
}
async function opsIn(scenario?: string): Promise<Op[]> {
  return asArray<Op>(await (await api('GET', '/operators', undefined, scenario)).json());
}

test.describe.configure({ mode: 'serial' });

test.describe('Fork data interactions audit', () => {
  test.beforeAll(async ({ }, testInfo) => {
    testInfo.setTimeout(180_000);
    apiCtx = await pwRequest.newContext();
    const loginResp = await apiCtx.post(`${API}/auth/login`, {
      data: { email: 'claude-test@flux.local', password: 'ClaudeAuditPwd!' },
    });
    expect(loginResp.ok(), `login failed: ${loginResp.status()}`).toBeTruthy();
    const { token: t } = await loginResp.json();
    token = t;
    const forkResp = await api('POST', '/scenarios/simulations', {
      name: `audit-${Date.now()}`,
      description: 'E2E audit fork (auto-created)',
    });
    expect(forkResp.ok(), `fork create failed: ${forkResp.status()} ${await forkResp.text()}`).toBeTruthy();
    forkId = (await forkResp.json()).id;
    log(`Fork créé : ${forkId}`);
  });

  test.afterAll(async () => {
    log('==========================================');
    log(`RAPPORT FINAL — ${pass} OK / ${bug} BUG`);
    log('==========================================');
    if (apiCtx) await apiCtx.dispose();
  });

  // ---------------------------------------------------------------
  // 1. Suppression d'un job dans le fork — la préprod doit conserver
  //    sa propre copie (matchée par `reference`, pas par UUID).
  // ---------------------------------------------------------------
  test('1. Suppression d\'un job dans le fork', async () => {
    const forkJobs = await jobsIn(forkId);
    if (forkJobs.length === 0) { check('#1 préreq', false, 'aucun job en fork'); return; }
    const target = forkJobs[0];
    const ref = target.reference;
    log(`#1 cible: ${ref} fork.id=${target.id}`);

    const preprodBeforeJob = (await jobsIn()).find(j => j.reference === ref);
    if (!preprodBeforeJob) { check('#1 préreq', false, `ref ${ref} absente de préprod (avant)`); return; }
    log(`#1 préprod.id correspondant=${preprodBeforeJob.id}`);

    const del = await api('DELETE', `/jobs/${target.id}`, undefined, forkId);
    check('#1a DELETE en fork accepté', [200, 204].includes(del.status()), `status=${del.status()}`);

    const inFork = (await jobsIn(forkId)).find(j => j.reference === ref);
    check('#1b job supprimé du fork', !inFork, `inFork=${inFork ? inFork.id : 'absent'}`);

    const inPreprod = (await jobsIn()).find(j => j.reference === ref);
    check('#1c préprod CONSERVE le job (matchée par reference)', !!inPreprod && inPreprod.id === preprodBeforeJob.id,
      `inPreprod=${inPreprod ? inPreprod.id : 'absent'} (attendu ${preprodBeforeJob.id})`);
  });

  // ---------------------------------------------------------------
  // 2. Modification de deadline en fork — la préprod doit conserver
  //    l'ancienne deadline.
  // ---------------------------------------------------------------
  test('2. Modification deadline d\'un job dans le fork', async () => {
    const forkJobs = await jobsIn(forkId);
    if (forkJobs.length === 0) { check('#2 préreq', false, 'aucun job en fork'); return; }
    const target = forkJobs[0];
    const ref = target.reference;
    const original = target.workshopExitDate;
    log(`#2 cible: ${ref} fork.id=${target.id} deadline=${original}`);

    const preprodBefore = (await jobsIn()).find(j => j.reference === ref);
    if (!preprodBefore) { check('#2 préreq', false, `ref ${ref} absente de préprod`); return; }
    const preprodOriginalDeadline = preprodBefore.workshopExitDate;
    log(`#2 préprod avant: id=${preprodBefore.id} deadline=${preprodOriginalDeadline}`);

    const newDeadline = '2026-12-31';
    const put = await api('PUT', `/jobs/${target.id}`, { workshopExitDate: newDeadline }, forkId);
    check('#2a PUT deadline en fork accepté', put.ok(), `status=${put.status()} body=${(await put.text()).slice(0, 200)}`);

    const inFork = (await jobsIn(forkId)).find(j => j.reference === ref);
    check('#2b deadline modifiée dans fork', String(inFork?.workshopExitDate ?? '').startsWith(newDeadline),
      `fork=${inFork?.workshopExitDate}`);

    const inPreprod = (await jobsIn()).find(j => j.reference === ref);
    check('#2c préprod CONSERVE l\'ancienne deadline', String(inPreprod?.workshopExitDate ?? '') === preprodOriginalDeadline,
      `préprod=${inPreprod?.workshopExitDate} (attendu ${preprodOriginalDeadline})`);
  });

  // ---------------------------------------------------------------
  // 3. Ajout d'un job en fork.
  // ---------------------------------------------------------------
  test('3. Ajout d\'un job dans le fork', async () => {
    const newRef = `AUDIT-${Date.now()}`;
    const newJob = {
      reference: newRef,
      client: 'AUDIT_CLIENT',
      description: 'Job de test E2E (fork)',
      workshopExitDate: '2026-06-15',
      quantity: 1000,
      deadlinePriority: 2,
    };
    const post = await api('POST', '/jobs', newJob, forkId);
    check('#3a POST /jobs en fork', post.ok(), `status=${post.status()} body=${(await post.text()).slice(0, 300)}`);
    if (!post.ok()) return;

    const inFork = (await jobsIn(forkId)).find(j => j.reference === newRef);
    check('#3b nouveau job visible en fork', !!inFork, `inFork=${inFork ? inFork.id : 'absent'}`);

    const inPreprod = (await jobsIn()).find(j => j.reference === newRef);
    check('#3c nouveau job ABSENT en préprod', !inPreprod, `inPreprod=${inPreprod ? inPreprod.id : 'absent'}`);
  });

  // ---------------------------------------------------------------
  // 4. Duplication d'un opérateur en fork.
  // ---------------------------------------------------------------
  test('4. Duplication d\'un opérateur dans le fork', async () => {
    const ops = await opsIn(forkId);
    if (ops.length === 0) { check('#4 préreq', false, 'aucun opérateur'); return; }
    const source = ops[0];
    const dupName = `${source.firstName} (audit-${Date.now()})`;
    log(`#4 dupliqué depuis ${source.firstName} ${source.lastName}`);

    const post = await api('POST', '/operators', {
      firstName: dupName,
      lastName: source.lastName,
      role: 'Audit',
    }, forkId);
    check('#4a POST /operators en fork', post.ok(), `status=${post.status()} body=${(await post.text()).slice(0, 200)}`);
    if (!post.ok()) return;

    const inFork = (await opsIn(forkId)).find(o => o.firstName === dupName);
    check('#4b dupliqué visible en fork', !!inFork);

    const inPreprod = (await opsIn()).find(o => o.firstName === dupName);
    check('#4c dupliqué ABSENT en préprod', !inPreprod);
  });

  // ---------------------------------------------------------------
  // 5. Mise en absence d'un opérateur en fork.
  // ---------------------------------------------------------------
  test('5. Mise en absence d\'un opérateur dans le fork', async () => {
    const ops = await opsIn(forkId);
    if (ops.length === 0) { check('#5 préreq', false, 'aucun opérateur'); return; }
    const target = ops[0];
    // Identité cross-scope : firstName + lastName.
    const sameInPreprod = (await opsIn()).find(o => o.firstName === target.firstName && o.lastName === target.lastName);
    if (!sameInPreprod) { check('#5 préreq', false, `${target.firstName} ${target.lastName} absent de préprod`); return; }

    const beforeFork = (target.absences ?? []).length;
    const beforePreprod = (sameInPreprod.absences ?? []).length;
    log(`#5 ${target.firstName} ${target.lastName}: avant fork=${beforeFork} préprod=${beforePreprod}`);

    const newAbsence = { startAt: '2026-07-01T00:00:00', endAt: '2026-07-05T23:59:00', reason: `AUDIT-${Date.now()}` };
    const put = await api('PUT', `/operators/${target.id}`, {
      absences: [...(target.absences ?? []), newAbsence],
    }, forkId);
    check('#5a PUT absences en fork', put.ok(), `status=${put.status()} body=${(await put.text()).slice(0, 200)}`);

    const afterFork = ((await opsIn(forkId)).find(o => o.id === target.id)?.absences ?? []).length;
    const afterPreprod = ((await opsIn()).find(o => o.id === sameInPreprod.id)?.absences ?? []).length;
    log(`#5 après: fork=${afterFork} préprod=${afterPreprod}`);
    check('#5b absence ajoutée en fork', afterFork === beforeFork + 1, `fork ${beforeFork}→${afterFork}`);
    check('#5c préprod inchangée', afterPreprod === beforePreprod, `préprod ${beforePreprod}→${afterPreprod}`);
  });

  // ---------------------------------------------------------------
  // 6. Heures supplémentaires sur un opérateur en fork.
  // ---------------------------------------------------------------
  test('6. Heures supplémentaires en fork', async () => {
    const ops = await opsIn(forkId);
    if (ops.length === 0) { check('#6 préreq', false, 'aucun opérateur'); return; }
    const target = ops[0];
    const sameInPreprod = (await opsIn()).find(o => o.firstName === target.firstName && o.lastName === target.lastName);
    if (!sameInPreprod) { check('#6 préreq', false, 'ops cross-scope match KO'); return; }

    const beforeFork = (target.overtimes ?? []).length;
    const beforePreprod = (sameInPreprod.overtimes ?? []).length;
    log(`#6 ${target.firstName}: avant overtimes fork=${beforeFork} préprod=${beforePreprod}`);

    const fresh = (await opsIn(forkId)).find(o => o.id === target.id)!;
    const newOt = { startAt: '2026-07-08T18:00:00', endAt: '2026-07-08T21:00:00', reason: `AUDIT-OT-${Date.now()}` };
    const put = await api('PUT', `/operators/${target.id}`, {
      absences: fresh.absences ?? [],
      overtimes: [...(fresh.overtimes ?? []), newOt],
    }, forkId);
    check('#6a PUT overtimes en fork', put.ok(), `status=${put.status()} body=${(await put.text()).slice(0, 200)}`);

    const afterFork = ((await opsIn(forkId)).find(o => o.id === target.id)?.overtimes ?? []).length;
    const afterPreprod = ((await opsIn()).find(o => o.id === sameInPreprod.id)?.overtimes ?? []).length;
    log(`#6 après: fork=${afterFork} préprod=${afterPreprod}`);
    check('#6b overtime ajouté en fork', afterFork === beforeFork + 1);
    check('#6c préprod inchangée', afterPreprod === beforePreprod, `préprod ${beforePreprod}→${afterPreprod}`);
  });

  // ---------------------------------------------------------------
  // 7. Promotion (merge) du fork en préprod : la préprod doit
  //    refléter l'ensemble des changements faits en fork.
  // ---------------------------------------------------------------
  test('7. Promotion (merge) du fork en préprod', async () => {
    const refDeadlineUpdated = (await jobsIn(forkId))[0]?.reference;
    const refDeleted: string | undefined = undefined; // Captured below from log if applicable
    const dupOpName = (await opsIn(forkId)).find(o => o.firstName.includes('audit'))?.firstName;

    const opsBefore = await opsIn();
    const jobsBefore = await jobsIn();
    log(`#7 préprod avant merge: ${opsBefore.length} ops, ${jobsBefore.length} jobs`);

    const merge = await api('POST', `/scenarios/simulations/${forkId}/merge`);
    const mergeBody = await merge.text();
    check('#7a POST /merge accepté', merge.ok(), `status=${merge.status()} body=${mergeBody.slice(0, 300)}`);
    if (!merge.ok()) return;
    log(`#7 merge body: ${mergeBody.slice(0, 300)}`);

    const opsAfter = await opsIn();
    const jobsAfter = await jobsIn();
    log(`#7 préprod après merge: ${opsAfter.length} ops (Δ=${opsAfter.length - opsBefore.length}), ${jobsAfter.length} jobs (Δ=${jobsAfter.length - jobsBefore.length})`);

    // Test #1 a deleted a fork-side job; test #3 added a job; net jobs Δ ≈ 0.
    // Test #4 added an operator; net ops Δ = +1 (assuming dup created OK).
    check('#7b préprod ops Δ = +1 (le dupliqué propagé)', opsAfter.length === opsBefore.length + 1, `Δ=${opsAfter.length - opsBefore.length}`);
    check('#7c préprod jobs Δ = 0', jobsAfter.length === jobsBefore.length, `Δ=${jobsAfter.length - jobsBefore.length}`);

    // Verify dup operator now visible in préprod
    if (dupOpName) {
      const dupInPreprod = opsAfter.find(o => o.firstName === dupOpName);
      check('#7d opérateur dupliqué visible en préprod après merge', !!dupInPreprod, `dupOpName=${dupOpName}`);
    }
    // Verify deadline change reflected: pick the job we modified
    if (refDeadlineUpdated) {
      const jobInPreprod = jobsAfter.find(j => j.reference === refDeadlineUpdated);
      check('#7e deadline modifiée reflétée en préprod après merge',
        !!jobInPreprod && String(jobInPreprod.workshopExitDate ?? '').startsWith('2026-12-31'),
        `préprod ${refDeadlineUpdated} deadline=${jobInPreprod?.workshopExitDate}`);
    }
  });
});

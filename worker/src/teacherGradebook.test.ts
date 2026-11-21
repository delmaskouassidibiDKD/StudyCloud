import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { handleTeacherGradebookRoutes, ensureTeacherGradebookTables } from './teacherGradebook';

// 1x1 PNG valide (magic bytes 89 50 4E 47 0D 0A 1A 0A)
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const VALID_PNG_DATA_URL = `data:image/png;base64,${VALID_PNG_BASE64}`;
const VALID_PNG_BYTES = Uint8Array.from(Buffer.from(VALID_PNG_BASE64, 'base64'));

// Adaptateur Cloudflare D1 réel au-dessus de node:sqlite (avec PRAGMA foreign_keys = ON)
function createMockD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      is_blocked INTEGER DEFAULT 0
    );
    INSERT INTO users (id, email) VALUES ('user-alice', 'alice@school.test');
    INSERT INTO users (id, email) VALUES ('user-bob', 'bob@school.test');
  `);

  const wrapPrepared = (sql: string, boundParams: any[] = []) => ({
    sql,
    params: boundParams,
    bind(...values: any[]) {
      return wrapPrepared(sql, values.map((v) => (v === undefined ? null : v)));
    },
    async first<T = any>() {
      const stmt = sqlite.prepare(sql);
      const row = stmt.get(...boundParams);
      return (row ?? null) as T | null;
    },
    async all<T = any>() {
      const stmt = sqlite.prepare(sql);
      const results = stmt.all(...boundParams) as T[];
      return { success: true, meta: {}, results };
    },
    async run() {
      const stmt = sqlite.prepare(sql);
      const info = stmt.run(...boundParams);
      return { success: true, meta: info };
    },
  });

  return {
    sqlite,
    prepare(sql: string) {
      return wrapPrepared(sql);
    },
    async batch(stmts: any[]) {
      const out: any[] = [];
      sqlite.exec('BEGIN');
      try {
        for (const s of stmts) {
          out.push(await s.run());
        }
        sqlite.exec('COMMIT');
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
      return out;
    },
  };
}

// Adaptateur Cloudflare R2 en mémoire
function createMockR2() {
  const store = new Map<string, { bytes: Uint8Array; httpMetadata?: any; customMetadata?: any }>();
  return {
    store,
    async put(key: string, value: Uint8Array | ArrayBuffer, options?: any) {
      const bytes = value instanceof Uint8Array ? new Uint8Array(value) : new Uint8Array(value);
      store.set(key, {
        bytes,
        httpMetadata: options?.httpMetadata,
        customMetadata: options?.customMetadata,
      });
    },
    async get(key: string) {
      const item = store.get(key);
      if (!item) return null;
      return {
        body: item.bytes,
        httpMetadata: item.httpMetadata,
        customMetadata: item.customMetadata,
        async arrayBuffer() {
          return item.bytes.buffer.slice(item.bytes.byteOffset, item.bytes.byteOffset + item.bytes.byteLength);
        },
      };
    },
    async delete(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) store.delete(k);
    },
  };
}

function createHarness() {
  const db = createMockD1();
  const r2Images = createMockR2();
  const jwtSecret = 'test-super-secret-jwt-key-12345';

  const tokenToUser: Record<string, { userId: string; email: string }> = {
    'token-alice': { userId: 'user-alice', email: 'alice@school.test' },
    'token-bob': { userId: 'user-bob', email: 'bob@school.test' },
  };

  const callApi = async (
    path: string,
    opts: { method?: string; token?: string; body?: any; headers?: Record<string, string> } = {}
  ) => {
    const url = new URL(`https://api-worker.dkd-technologies.com${path}`);
    const headers: Record<string, string> = { ...(opts.headers || {}) };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    let reqBody: any;
    if (opts.body instanceof FormData) {
      reqBody = opts.body;
    } else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      reqBody = JSON.stringify(opts.body);
    }
    const req = new Request(url.toString(), {
      method: opts.method || 'GET',
      headers,
      body: reqBody,
    });

    const res = await handleTeacherGradebookRoutes(req, url, url.pathname, req.method, {
      db,
      rawEnv: { BUCKET_IMAGES: r2Images },
      origin: 'https://studycloud.dkd-technologies.com',
      jwtSecret,
      getAuthUser: async (r: Request) => {
        const h = r.headers.get('Authorization') || '';
        const t = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
        return tokenToUser[t] || null;
      },
      corsHeaders: (o = '*') => ({ 'Access-Control-Allow-Origin': o }),
      jsonResponse: (data: any, status = 200) =>
        new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
      errorResponse: (message: string, status = 400) =>
        new Response(JSON.stringify({ success: false, error: message }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    assert.ok(res, `Expected response for ${path}`);
    return res;
  };

  return { db, r2Images, callApi };
}

test('Sécurité JWT stricte : refuse toute requête non authentifiée ou usurpée via x-user-id', async () => {
  const { callApi } = createHarness();

  const res1 = await callApi('/api/teacher/bootstrap');
  assert.equal(res1.status, 401);

  // Tentative d'usurpation via header x-user-id sans JWT valide -> 401
  const res2 = await callApi('/api/teacher/bootstrap', {
    headers: { 'x-user-id': 'user-alice' },
  });
  assert.equal(res2.status, 401);
});

test('Chaîne relationnelle complète + isolation multi-comptes (Anti-IDOR) + photos R2 signées + suppression en cascade', async () => {
  const { db, r2Images, callApi } = createHarness();
  await ensureTeacherGradebookTables(db);

  // 1. Alice crée toute sa hiérarchie : Année -> École (avec logo PNG R2) -> Niveau -> Classe (+3 trimestres) -> Matière
  const yRes = await callApi('/api/teacher/years', {
    method: 'POST',
    token: 'token-alice',
    body: { label: '2026 - 2027', color: '#00313d', textColor: '#ffffff' },
  });
  assert.equal(yRes.status, 201);
  const { year } = await yRes.json();

  const sRes = await callApi('/api/teacher/schools', {
    method: 'POST',
    token: 'token-alice',
    body: {
      yearId: year.id,
      name: 'Lycée Moderne Alice',
      logoDataUrl: VALID_PNG_DATA_URL,
      color: '#ffffff',
      textColor: '#0f172a',
      borderColor: '#e2e8f0',
      borderDarkColor: '#cbd5e1',
    },
  });
  assert.equal(sRes.status, 201);
  const { school } = await sRes.json();
  assert.ok(school.logoR2Key.startsWith('teacher-school-logos/user-alice/'));
  assert.ok(school.logoUrl.includes('/api/teacher/media?key='));
  assert.equal(r2Images.store.size, 1);

  const lRes = await callApi('/api/teacher/levels', {
    method: 'POST',
    token: 'token-alice',
    body: { schoolId: school.id, name: 'Terminale' },
  });
  assert.equal(lRes.status, 201);
  const { level } = await lRes.json();

  const cRes = await callApi('/api/teacher/classes', {
    method: 'POST',
    token: 'token-alice',
    body: {
      levelId: level.id,
      name: 'Tle D1',
      teacherName: 'Mme Alice',
      color: '#ffffff',
      textColor: '#0f172a',
      borderColor: '#e2e8f0',
      borderDarkColor: '#cbd5e1',
      iconGradient: 'from-amber-500 to-orange-600',
    },
  });
  assert.equal(cRes.status, 201);
  const { classItem, terms } = await cRes.json();
  assert.equal(terms.length, 3);
  const term1 = terms[0];
  const term2 = terms[1];

  const subjRes = await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: {
      classId: classItem.id,
      termId: term1.id,
      name: 'Mathématiques',
      coefficient: 4,
      color: '#ffffff',
      textColor: '#0f172a',
      borderColor: '#e2e8f0',
      borderDarkColor: '#cbd5e1',
    },
  });
  assert.equal(subjRes.status, 201);
  const { subject } = await subjRes.json();

  // 2. Upload photo de profil élève dans R2 + rejet d'un faux fichier HTML/XSS
  const badPhotoRes = await callApi('/api/teacher/photos/student', {
    method: 'POST',
    token: 'token-alice',
    body: {
      subjectId: subject.id,
      termId: term1.id,
      studentId: 'std-1',
      dataUrl: `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`,
    },
  });
  assert.equal(badPhotoRes.status, 400);

  const form = new FormData();
  form.append('subjectId', subject.id);
  form.append('termId', term1.id);
  form.append('studentId', 'std-1');
  form.append('file', new Blob([VALID_PNG_BYTES], { type: 'image/png' }), 'eleve.png');

  const photoRes = await callApi('/api/teacher/photos/student', {
    method: 'POST',
    token: 'token-alice',
    body: form,
  });
  assert.equal(photoRes.status, 200);
  const photoData = await photoRes.json();
  assert.ok(photoData.photoR2Key.startsWith(`teacher-student-photos/user-alice/${school.id}/${classItem.id}/`));
  assert.equal(r2Images.store.size, 2); // 1 logo école + 1 photo élève

  // 3. Sauvegarde fluide du tableur de notes dans D1
  const saveGbRes = await callApi(`/api/teacher/gradebook/${subject.id}/${term1.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      noteColumnCount: 7,
      columnMetas: { 0: { title: 'Devoir 1', maxScore: 20, coeffEval: 1 }, 1: { title: 'Compo', maxScore: 40, coeffEval: 2 } },
      layout: { noteColWidth: 110 },
      styles: { rowColors: { 'std-1': '#fef08a' } },
      students: [
        {
          id: 'std-1',
          name: 'Kouassi Jean',
          photoR2Key: photoData.photoR2Key,
          notes: ['16/20', '32/40', '', '', '', '', ''],
        },
      ],
    },
  });
  assert.equal(saveGbRes.status, 200);

  // Relecture du tableur D1 : notes + moyenne + photo signée R2 présentes
  const getGbRes = await callApi(`/api/teacher/gradebook/${subject.id}/${term1.id}`, { token: 'token-alice' });
  assert.equal(getGbRes.status, 200);
  const gbData = await getGbRes.json();
  assert.equal(gbData.exists, true);
  assert.equal(gbData.students.length, 1);
  assert.equal(gbData.students[0].name, 'Kouassi Jean');
  assert.equal(gbData.students[0].photoR2Key, photoData.photoR2Key);
  assert.ok(gbData.students[0].photoUrl.includes('/api/teacher/media?key='));

  // 4. Lecture de la photo via son URL signée -> 200 PNG valide
  const signedPath = new URL(gbData.students[0].photoUrl).pathname + new URL(gbData.students[0].photoUrl).search;
  const mediaOk = await callApi(signedPath);
  assert.equal(mediaOk.status, 200);
  assert.equal(mediaOk.headers.get('Content-Type'), 'image/png');

  // Signature trafiquée -> 403
  const tamperedPath = signedPath.replace(/sig=[a-f0-9]+/i, 'sig=' + '0'.repeat(64));
  const mediaBadSig = await callApi(tamperedPath);
  assert.equal(mediaBadSig.status, 403);

  // Path traversal -> 400
  const traversal = await callApi('/api/teacher/media?key=teacher-student-photos/user-alice/../user-bob/a.png', {
    token: 'token-alice',
  });
  assert.equal(traversal.status, 400);

  // 5. TESTS ANTI-IDOR : Bob NE DOIT RIEN VOIR ni RIEN MODIFIER chez Alice !
  const bobBoot = await (await callApi('/api/teacher/bootstrap', { token: 'token-bob' })).json();
  assert.equal(bobBoot.isEmpty, true);
  assert.equal(bobBoot.schools.length, 0);

  // Bob tente d'accéder à la photo d'élève d'Alice avec son propre JWT -> 403
  const bobPhotoSteal = await callApi(`/api/teacher/media?key=${encodeURIComponent(photoData.photoR2Key)}`, {
    token: 'token-bob',
  });
  assert.equal(bobPhotoSteal.status, 403);

  // Bob tente d'ajouter un niveau dans l'école d'Alice -> 404
  const bobInjectLevel = await callApi('/api/teacher/levels', {
    method: 'POST',
    token: 'token-bob',
    body: { schoolId: school.id, name: 'Pirate' },
  });
  assert.equal(bobInjectLevel.status, 404);

  // Bob tente de lire ou écraser le tableur d'Alice -> 404
  const bobReadGb = await callApi(`/api/teacher/gradebook/${subject.id}/${term1.id}`, { token: 'token-bob' });
  assert.equal(bobReadGb.status, 404);

  // Bob tente de supprimer l'école d'Alice -> 404
  const bobDeleteSchool = await callApi(`/api/teacher/schools/${school.id}`, {
    method: 'DELETE',
    token: 'token-bob',
  });
  assert.equal(bobDeleteSchool.status, 404);

  // 6. Transfert serveur vers Trimestre 2 : copie le tableur + copie la photo élève dans R2 !
  const targetSubjId = 'subject-t2-math';
  const transferRes = await callApi('/api/teacher/transfer', {
    method: 'POST',
    token: 'token-alice',
    body: {
      createdLevels: [],
      createdClasses: [],
      createdTerms: [],
      createdSubjects: [
        {
          id: targetSubjId,
          classId: classItem.id,
          termId: term2.id,
          schoolId: school.id,
          yearId: year.id,
          name: 'Mathématiques',
          coefficient: 4,
          color: '#ffffff',
          textColor: '#0f172a',
          borderColor: '#e2e8f0',
          borderDarkColor: '#cbd5e1',
          createdAt: Date.now(),
        },
      ],
      updatedSubjects: [],
      gradebookCopies: [
        {
          sourceSubjectId: subject.id,
          sourceTermId: term1.id,
          targetSubjectId: targetSubjId,
          targetTermId: term2.id,
          conflictStrategy: 'replace',
          options: {
            contentMode: 'students_only',
            includePhotos: true,
            includeMetas: true,
            includeFormatting: false,
          },
        },
      ],
    },
  });
  assert.equal(transferRes.status, 200);
  const transferData = await transferRes.json();
  assert.equal(transferData.serverSummary.gradebooksCopied, 1);
  assert.equal(transferData.serverSummary.studentsCopied, 1);
  assert.equal(transferData.serverSummary.notesCopied, 0); // students_only -> sans notes !
  assert.equal(transferData.serverSummary.photosCopied, 1);
  assert.equal(r2Images.store.size, 3); // logo école + photo T1 + photo copiée T2

  // 7. Suppression en cascade de l'école d'Alice -> 0 ligne orpheline D1 ET 0 photo orpheline R2 !
  const delSchoolRes = await callApi(`/api/teacher/schools/${school.id}`, {
    method: 'DELETE',
    token: 'token-alice',
  });
  assert.equal(delSchoolRes.status, 200);
  assert.equal(r2Images.store.size, 0, 'Tous les logos et photos R2 doivent être supprimés en cascade');

  const aliceAfterDel = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  assert.equal(aliceAfterDel.schools.length, 0);
  assert.equal(aliceAfterDel.studyLevels.length, 0);
  assert.equal(aliceAfterDel.classes.length, 0);
  assert.equal(aliceAfterDel.subjects.length, 0);
});

test('Migration locale (import-local) isole les IDs même si deux comptes migrent le même year-default', async () => {
  const { callApi, r2Images } = createHarness();

  const legacyPayload = {
    schoolYears: [{ id: 'year-default', label: '2026 - 2027', color: '#00313d', textColor: '#ffffff', createdAt: 1 }],
    schools: [
      {
        id: 'school-1',
        yearId: 'year-default',
        name: 'Collège Test',
        logoUrl: VALID_PNG_DATA_URL,
        color: '#ffffff',
        textColor: '#0f172a',
        borderColor: '#e2e8f0',
        borderDarkColor: '#cbd5e1',
        createdAt: 2,
      },
    ],
    studyLevels: [{ id: 'lvl-1', schoolId: 'school-1', yearId: 'year-default', name: '6ème', createdAt: 3 }],
    classes: [
      {
        id: 'cls-1',
        levelId: 'lvl-1',
        schoolId: 'school-1',
        yearId: 'year-default',
        level: '6ème',
        name: '6ème A',
        teacherName: 'Prof',
        color: '#ffffff',
        textColor: '#0f172a',
        borderColor: '#e2e8f0',
        borderDarkColor: '#cbd5e1',
        iconGradient: 'from-amber-500 to-orange-600',
        createdAt: 4,
      },
    ],
    terms: [{ id: 'term-1', classId: 'cls-1', schoolId: 'school-1', yearId: 'year-default', number: 1, name: 'Trimestre 1', createdAt: 5 }],
    subjects: [
      {
        id: 'subj-1',
        classId: 'cls-1',
        termId: 'term-1',
        schoolId: 'school-1',
        yearId: 'year-default',
        name: 'Français',
        color: '#ffffff',
        textColor: '#0f172a',
        borderColor: '#e2e8f0',
        borderDarkColor: '#cbd5e1',
        createdAt: 6,
      },
    ],
    gradebooks: [
      {
        subjectId: 'subj-1',
        termId: 'term-1',
        classId: 'cls-1',
        schoolId: 'school-1',
        yearId: 'year-default',
        noteColumnCount: 7,
        columnMetas: {},
        layout: {},
        styles: {},
        students: [{ id: 'st-1', name: 'Traoré Awa', photoUrl: VALID_PNG_DATA_URL, notes: ['15/20'] }],
      },
    ],
  };

  // Alice ET Bob migrent tous les deux un payload ayant les mêmes anciens IDs ("year-default", "school-1", etc.)
  const resAlice = await callApi('/api/teacher/import-local', {
    method: 'POST',
    token: 'token-alice',
    body: legacyPayload,
  });
  assert.equal(resAlice.status, 200);
  const dataAlice = await resAlice.json();
  assert.equal(dataAlice.schools.length, 1);
  assert.ok(dataAlice.schools[0].logoR2Key.startsWith('teacher-school-logos/user-alice/'));

  const resBob = await callApi('/api/teacher/import-local', {
    method: 'POST',
    token: 'token-bob',
    body: legacyPayload,
  });
  assert.equal(resBob.status, 200);
  const dataBob = await resBob.json();
  assert.equal(dataBob.schools.length, 1);
  assert.ok(dataBob.schools[0].logoR2Key.startsWith('teacher-school-logos/user-bob/'));
  assert.notEqual(dataAlice.schools[0].id, dataBob.schools[0].id);
  // 2 logos écoles + 2 photos élèves dans R2, strictement séparés par dossier user_id !
  assert.equal(r2Images.store.size, 4);
});

test('Modification (PUT), synchronisation manuelle (POST /sync) et suppression en cascade complète d’une année scolaire', async () => {
  const { r2Images, callApi } = createHarness();

  // 1. Alice crée une année -> école -> niveau -> classe -> matière
  const yRes = await callApi('/api/teacher/years', {
    method: 'POST',
    token: 'token-alice',
    body: { label: '2026 - 2027', color: '#00313d', textColor: '#ffffff' },
  });
  const { year } = await yRes.json();

  // 2. Alice modifie le libellé et la couleur de l'année (PUT /api/teacher/years/:id)
  const updRes = await callApi(`/api/teacher/years/${year.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: { label: '2027 - 2028', color: '#0284c7', textColor: '#ffffff' },
  });
  assert.equal(updRes.status, 200);
  const { year: updatedYear } = await updRes.json();
  assert.equal(updatedYear.label, '2027 - 2028');
  assert.equal(updatedYear.color, '#0284c7');

  // Bob ne peut PAS modifier l'année d'Alice -> 404
  const bobUpd = await callApi(`/api/teacher/years/${year.id}`, {
    method: 'PUT',
    token: 'token-bob',
    body: { label: 'Pirate', color: '#000000' },
  });
  assert.equal(bobUpd.status, 404);

  // 3. Synchronisation manuelle (POST /api/teacher/sync) avec une école créée hors-ligne + logo PNG
  const syncRes = await callApi('/api/teacher/sync', {
    method: 'POST',
    token: 'token-alice',
    body: {
      schoolYears: [updatedYear],
      schools: [
        {
          id: 'school-offline-1',
          yearId: year.id,
          name: 'Lycée Sync',
          logoUrl: VALID_PNG_DATA_URL,
          color: '#ffffff',
          textColor: '#0f172a',
          borderColor: '#e2e8f0',
          borderDarkColor: '#cbd5e1',
          createdAt: Date.now(),
        },
      ],
      studyLevels: [{ id: 'lvl-sync-1', schoolId: 'school-offline-1', yearId: year.id, name: '2nde', createdAt: Date.now() }],
      classes: [
        {
          id: 'cls-sync-1',
          levelId: 'lvl-sync-1',
          schoolId: 'school-offline-1',
          yearId: year.id,
          level: '2nde',
          name: '2nde C',
          teacherName: 'Alice',
          color: '#ffffff',
          textColor: '#0f172a',
          borderColor: '#e2e8f0',
          borderDarkColor: '#cbd5e1',
          iconGradient: 'from-amber-500 to-orange-600',
          createdAt: Date.now(),
        },
      ],
      terms: [{ id: 'term-sync-1', classId: 'cls-sync-1', schoolId: 'school-offline-1', yearId: year.id, number: 1, name: 'Trimestre 1', createdAt: Date.now() }],
      subjects: [
        {
          id: 'subj-sync-1',
          classId: 'cls-sync-1',
          termId: 'term-sync-1',
          schoolId: 'school-offline-1',
          yearId: year.id,
          name: 'Physique',
          color: '#ffffff',
          textColor: '#0f172a',
          borderColor: '#e2e8f0',
          borderDarkColor: '#cbd5e1',
          createdAt: Date.now(),
        },
      ],
    },
  });
  assert.equal(syncRes.status, 200);
  const syncData = await syncRes.json();
  assert.equal(syncData.schools.length, 1);
  assert.equal(syncData.subjects.length, 1);
  assert.equal(r2Images.store.size, 1);

  // 4. Suppression en cascade de l'année -> supprime école, niveau, classe, trimestre, matière ET logo R2 !
  const delYearRes = await callApi(`/api/teacher/years/${year.id}`, {
    method: 'DELETE',
    token: 'token-alice',
  });
  assert.equal(delYearRes.status, 200);
  assert.equal(r2Images.store.size, 0);

  const afterDel = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  assert.equal(afterDel.schoolYears.length, 0);
  assert.equal(afterDel.schools.length, 0);
  assert.equal(afterDel.studyLevels.length, 0);
  assert.equal(afterDel.classes.length, 0);
  assert.equal(afterDel.terms.length, 0);
  assert.equal(afterDel.subjects.length, 0);
});

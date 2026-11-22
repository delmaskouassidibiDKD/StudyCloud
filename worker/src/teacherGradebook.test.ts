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

test('Persistance du zoom, dimensions et remappage des couleurs/styles par élève lors d’un transfert D1', async () => {
  const { callApi } = createHarness();

  const { year } = await (await callApi('/api/teacher/years', {
    method: 'POST',
    token: 'token-alice',
    body: { label: '2026 - 2027', color: '#0284c7', textColor: '#ffffff' },
  })).json();

  const { school } = await (await callApi('/api/teacher/schools', {
    method: 'POST',
    token: 'token-alice',
    body: { yearId: year.id, name: 'Lycée Style', color: '#0f172a', textColor: '#ffffff' },
  })).json();

  const { level } = await (await callApi('/api/teacher/levels', {
    method: 'POST',
    token: 'token-alice',
    body: { schoolId: school.id, name: 'Terminale', color: '#7c3aed', textColor: '#ffffff' },
  })).json();

  const { classItem, terms } = await (await callApi('/api/teacher/classes', {
    method: 'POST',
    token: 'token-alice',
    body: { levelId: level.id, name: 'Tle D', teacherName: 'Prof Alice', color: '#059669', textColor: '#ffffff' },
  })).json();

  const term1 = terms[0];
  const term2 = terms[1];

  const { subject: subjT1 } = await (await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: term1.id, name: 'Maths', coefficient: 4, color: '#dc2626', textColor: '#ffffff' },
  })).json();

  const { subject: subjT2 } = await (await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: term2.id, name: 'Maths', coefficient: 4, color: '#dc2626', textColor: '#ffffff' },
  })).json();

  // Enregistrer le tableur T1 avec zoom=115, largeurs/hauteurs personnalisées et couleurs par élève
  const saveRes = await callApi(`/api/teacher/gradebook/${subjT1.id}/${term1.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      noteColumnCount: 3,
      columnMetas: { 0: { title: 'DEVOIR', maxScore: 20, coeffEval: 2, headerBgColor: '#bae6fd', columnBgColor: '#e0f2fe' } },
      layout: {
        noteColWidth: 120,
        colWidthRank: 72,
        colWidthPhoto: 88,
        colWidthName: 310,
        colWidthAverage: 112,
        colWidthMention: 125,
        customNoteWidths: { 0: 145 },
        customRowHeights: { 0: 64 },
        zoomPercent: 115,
      },
      styles: {
        rowColors: { 'std-orig-1': '#fef08a' },
        cellColors: { 'std-orig-1_0': '#bbf7d0', 'std-orig-1_-1': '#e9d5ff' },
        cellCustomStyles: { 'std-orig-1_name': { bold: true, color: '#1e3a8a', fontFamily: 'Georgia', fontSize: 14 } },
      },
      students: [
        { id: 'std-orig-1', name: 'Kouassi Yao', notes: ['17/20', '15/20', ''] },
      ],
    },
  });
  assert.equal(saveRes.status, 200);

  // Recharger (comme sur un autre appareil) et vérifier 100 % des dimensions, zoom et couleurs
  const reloadedT1 = await (await callApi(`/api/teacher/gradebook/${subjT1.id}/${term1.id}`, { token: 'token-alice' })).json();
  assert.equal(reloadedT1.layout.zoomPercent, 115);
  assert.equal(reloadedT1.layout.customNoteWidths['0'], 145);
  assert.equal(reloadedT1.layout.customRowHeights['0'], 64);
  assert.equal(reloadedT1.styles.rowColors['std-orig-1'], '#fef08a');
  assert.equal(reloadedT1.styles.cellColors['std-orig-1_0'], '#bbf7d0');
  assert.equal(reloadedT1.styles.cellCustomStyles['std-orig-1_name'].fontFamily, 'Georgia');

  // Transférer T1 -> T2 avec mise en forme et vérifier que les styles suivent le NOUVEL ID d'élève !
  const transferRes = await callApi('/api/teacher/transfer', {
    method: 'POST',
    token: 'token-alice',
    body: {
      createdLevels: [],
      createdClasses: [],
      createdTerms: [],
      createdSubjects: [],
      updatedSubjects: [],
      gradebookCopies: [
        {
          sourceSubjectId: subjT1.id,
          sourceTermId: term1.id,
          targetSubjectId: subjT2.id,
          targetTermId: term2.id,
          conflictStrategy: 'replace',
          options: {
            contentMode: 'students_only',
            includePhotos: false,
            includeMetas: true,
            includeFormatting: true,
          },
        },
      ],
    },
  });
  assert.equal(transferRes.status, 200);

  const loadedT2 = await (await callApi(`/api/teacher/gradebook/${subjT2.id}/${term2.id}`, { token: 'token-alice' })).json();
  const transferredStudent = loadedT2.students.find((s: any) => s.name === 'Kouassi Yao');
  assert.ok(transferredStudent, 'Élève transféré introuvable dans T2');
  assert.notEqual(transferredStudent.id, 'std-orig-1');

  // Zoom, dimensions ET couleurs/styles remappés sur le nouvel ID d'élève !
  assert.equal(loadedT2.layout.zoomPercent, 115);
  assert.equal(loadedT2.layout.customNoteWidths['0'], 145);
  assert.equal(loadedT2.layout.customRowHeights['0'], 64);
  assert.equal(loadedT2.styles.rowColors[transferredStudent.id], '#fef08a');
  assert.equal(loadedT2.styles.cellColors[`${transferredStudent.id}_0`], '#bbf7d0');
  assert.equal(loadedT2.styles.cellColors[`${transferredStudent.id}_-1`], '#e9d5ff');
  assert.equal(loadedT2.styles.cellCustomStyles[`${transferredStudent.id}_name`].bold, true);
  assert.equal(loadedT2.styles.cellCustomStyles[`${transferredStudent.id}_name`].fontFamily, 'Georgia');
  // L'ancien ID ne pollue pas le tableur cible
  assert.equal(loadedT2.styles.rowColors['std-orig-1'], undefined);
});

test('Trimestres : création avec coefficient facultatif, modification (PUT), Anti-IDOR et suppression en cascade', async () => {
  const { callApi } = createHarness();

  const { year } = await (await callApi('/api/teacher/years', {
    method: 'POST',
    token: 'token-alice',
    body: { label: '2026 - 2027' },
  })).json();
  const { school } = await (await callApi('/api/teacher/schools', {
    method: 'POST',
    token: 'token-alice',
    body: { yearId: year.id, name: 'CME' },
  })).json();
  const { level } = await (await callApi('/api/teacher/levels', {
    method: 'POST',
    token: 'token-alice',
    body: { schoolId: school.id, name: 'BTS 2' },
  })).json();
  const { classItem } = await (await callApi('/api/teacher/classes', {
    method: 'POST',
    token: 'token-alice',
    body: { levelId: level.id, name: 'Groupe 2', teacherName: 'DKD' },
  })).json();

  // 1. Créer Trimestre 4 avec coefficient = 2
  const t4Res = await callApi('/api/teacher/terms', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, number: 4, name: 'Trimestre 4', coefficient: 2 },
  });
  assert.equal(t4Res.status, 201);
  const { term: t4 } = await t4Res.json();
  assert.equal(t4.coefficient, 2);

  // 2. Modifier le coefficient du trimestre (2 -> 1.5), puis vérifier dans bootstrap
  const updRes = await callApi(`/api/teacher/terms/${t4.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: { coefficient: 1.5 },
  });
  assert.equal(updRes.status, 200);
  const { term: t4Updated } = await updRes.json();
  assert.equal(t4Updated.coefficient, 1.5);

  const boot = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  const bootT4 = boot.terms.find((t: any) => t.id === t4.id);
  assert.equal(bootT4?.coefficient, 1.5);

  // 3. Anti-IDOR : Bob ne peut pas modifier ni supprimer le trimestre d'Alice
  const bobPut = await callApi(`/api/teacher/terms/${t4.id}`, {
    method: 'PUT',
    token: 'token-bob',
    body: { coefficient: 99 },
  });
  assert.equal(bobPut.status, 404);

  // 4. Retirer le coefficient (null)
  const clearRes = await callApi(`/api/teacher/terms/${t4.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: { coefficient: null },
  });
  assert.equal(clearRes.status, 200);
  const { term: t4Cleared } = await clearRes.json();
  assert.equal(t4Cleared.coefficient, undefined);

  // 5. Ajouter une matière dans T4 puis supprimer T4 -> cascade vérifiée
  await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: t4.id, name: 'Électrotechnique' },
  });
  const delRes = await callApi(`/api/teacher/terms/${t4.id}`, {
    method: 'DELETE',
    token: 'token-alice',
  });
  assert.equal(delRes.status, 200);
  const afterDel = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  assert.equal(afterDel.terms.some((t: any) => t.id === t4.id), false);
  assert.equal(afterDel.subjects.some((s: any) => s.termId === t4.id), false);
});

test('Matières : création avec coefficient facultatif, modification (PUT), retrait (null) et isolation par compte', async () => {
  const { callApi } = createHarness();

  const { year } = await (await callApi('/api/teacher/years', {
    method: 'POST',
    token: 'token-alice',
    body: { label: '2026 - 2027' },
  })).json();
  const { school } = await (await callApi('/api/teacher/schools', {
    method: 'POST',
    token: 'token-alice',
    body: { yearId: year.id, name: 'CME' },
  })).json();
  const { level } = await (await callApi('/api/teacher/levels', {
    method: 'POST',
    token: 'token-alice',
    body: { schoolId: school.id, name: 'BTS 2' },
  })).json();
  const { classItem, terms } = await (await callApi('/api/teacher/classes', {
    method: 'POST',
    token: 'token-alice',
    body: { levelId: level.id, name: 'Groupe 2', teacherName: 'DKD' },
  })).json();

  const t1 = terms[0];

  // 1. Créer une matière AVEC coefficient = 4
  const s1Res = await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: t1.id, name: 'Mathématiques', coefficient: 4 },
  });
  assert.equal(s1Res.status, 201);
  const { subject: s1 } = await s1Res.json();
  assert.equal(s1.coefficient, 4);

  // 2. Créer une matière SANS coefficient (facultatif)
  const s2Res = await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: t1.id, name: 'Anglais', coefficient: null },
  });
  assert.equal(s2Res.status, 201);
  const { subject: s2 } = await s2Res.json();
  assert.equal(s2.coefficient, undefined);

  // 3. Modifier le coefficient (4 -> 2.5) et vérifier dans bootstrap
  const updRes = await callApi(`/api/teacher/subjects/${s1.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: { name: 'Mathématiques', coefficient: 2.5 },
  });
  assert.equal(updRes.status, 200);
  const { subject: s1Upd } = await updRes.json();
  assert.equal(s1Upd.coefficient, 2.5);

  const bootAlice = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  assert.equal(bootAlice.subjects.find((s: any) => s.id === s1.id)?.coefficient, 2.5);
  assert.equal(bootAlice.subjects.find((s: any) => s.id === s2.id)?.coefficient, undefined);

  // 4. Anti-IDOR : Bob ne peut pas voir ni modifier la matière d'Alice
  const bootBob = await (await callApi('/api/teacher/bootstrap', { token: 'token-bob' })).json();
  assert.equal(bootBob.subjects.length, 0);
  const bobPut = await callApi(`/api/teacher/subjects/${s1.id}`, {
    method: 'PUT',
    token: 'token-bob',
    body: { name: 'Hack', coefficient: 99 },
  });
  assert.equal(bobPut.status, 404);

  // 5. Retirer le coefficient (null)
  const clearRes = await callApi(`/api/teacher/subjects/${s1.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: { name: 'Mathématiques', coefficient: null },
  });
  assert.equal(clearRes.status, 200);
  const { subject: s1Cleared } = await clearRes.json();
  assert.equal(s1Cleared.coefficient, undefined);
});

test('Moyenne générale par classe : auto-création (annuelle + trimestres), ajout dynamique, suppression liée au trimestre et persistance annuelle', async () => {
  const { callApi } = createHarness();

  const { year } = await (await callApi('/api/teacher/years', {
    method: 'POST',
    token: 'token-alice',
    body: { label: '2026 - 2027' },
  })).json();
  const { school } = await (await callApi('/api/teacher/schools', {
    method: 'POST',
    token: 'token-alice',
    body: { yearId: year.id, name: 'CME' },
  })).json();
  const { level } = await (await callApi('/api/teacher/levels', {
    method: 'POST',
    token: 'token-alice',
    body: { schoolId: school.id, name: 'BTS 2' },
  })).json();

  // 1. Création de classe -> crée automatiquement 1 carte annuelle + 3 cartes trimestrielles blanches
  const clsRes = await callApi('/api/teacher/classes', {
    method: 'POST',
    token: 'token-alice',
    body: { levelId: level.id, name: 'Groupe 2', teacherName: 'DKD' },
  });
  assert.equal(clsRes.status, 201);
  const { classItem, terms, classAverages: createdAvgs } = await clsRes.json();
  assert.equal(createdAvgs.length, 4);
  assert.equal(createdAvgs[0].kind, 'annual');
  assert.equal(createdAvgs[0].title, "Moyenne générale de l'année");
  assert.equal(createdAvgs[0].color, '#ffffff');
  assert.equal(createdAvgs[1].kind, 'term');
  assert.equal(createdAvgs[1].termId, terms[0].id);

  // 2. Ajout de Trimestre 4 -> une nouvelle carte Moyenne générale s'ajoute automatiquement
  const t4Res = await callApi('/api/teacher/terms', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, number: 4, name: 'Trimestre 4', coefficient: 2 },
  });
  assert.equal(t4Res.status, 201);
  const { term: t4, classAverage: t4Avg } = await t4Res.json();
  assert.equal(t4Avg.kind, 'term');
  assert.equal(t4Avg.termId, t4.id);

  const bootWith4 = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  assert.equal(bootWith4.classAverages.length, 5);
  assert.equal(bootWith4.classAverages[0].kind, 'annual');

  // Isolation multi-comptes : Bob ne voit aucune carte moyenne d'Alice
  const bootBob = await (await callApi('/api/teacher/bootstrap', { token: 'token-bob' })).json();
  assert.equal(bootBob.classAverages.length, 0);

  // 3. Suppression de Trimestre 2 -> sa carte moyenne est supprimée, mais l'annuelle et les autres restent
  await callApi(`/api/teacher/terms/${terms[1].id}`, { method: 'DELETE', token: 'token-alice' });
  const bootAfterT2 = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  assert.equal(bootAfterT2.classAverages.length, 4);
  assert.equal(bootAfterT2.classAverages.some((ca: any) => ca.termId === terms[1].id), false);
  assert.equal(bootAfterT2.classAverages.some((ca: any) => ca.kind === 'annual'), true);

  // 4. Suppression de TOUS les trimestres restants -> la carte annuelle reste toujours présente !
  await callApi(`/api/teacher/terms/${terms[0].id}`, { method: 'DELETE', token: 'token-alice' });
  await callApi(`/api/teacher/terms/${terms[2].id}`, { method: 'DELETE', token: 'token-alice' });
  await callApi(`/api/teacher/terms/${t4.id}`, { method: 'DELETE', token: 'token-alice' });
  const bootOnlyAnnual = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  assert.equal(bootOnlyAnnual.classAverages.length, 1);
  assert.equal(bootOnlyAnnual.classAverages[0].kind, 'annual');

  // 5. Suppression de la classe -> la carte annuelle est supprimée en cascade
  await callApi(`/api/teacher/classes/${classItem.id}`, { method: 'DELETE', token: 'token-alice' });
  const bootAfterClassDel = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  assert.equal(bootAfterClassDel.classAverages.length, 0);
});

test('Feuille Moyenne générale de trimestre (GET & PUT /api/teacher/class-average-sheet/:id) : agrégation live, persistance et Anti-IDOR', async () => {
  const { callApi } = createHarness();

  const { year } = await (await callApi('/api/teacher/years', {
    method: 'POST',
    token: 'token-alice',
    body: { label: '2026 - 2027' },
  })).json();
  const { school } = await (await callApi('/api/teacher/schools', {
    method: 'POST',
    token: 'token-alice',
    body: { yearId: year.id, name: 'CME' },
  })).json();
  const { level } = await (await callApi('/api/teacher/levels', {
    method: 'POST',
    token: 'token-alice',
    body: { schoolId: school.id, name: 'BTS 2' },
  })).json();
  const { classItem, terms, classAverages } = await (await callApi('/api/teacher/classes', {
    method: 'POST',
    token: 'token-alice',
    body: { levelId: level.id, name: 'Électrotechnique', teacherName: 'DKD' },
  })).json();

  const t1 = terms[0];
  const t1AvgCard = classAverages.find((c: any) => c.kind === 'term' && c.termId === t1.id);
  assert.ok(t1AvgCard);

  // Créer 2 matières dans Trimestre 1 avec coefficients
  const { subject: sMath } = await (await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: t1.id, name: 'Mathématiques', coefficient: 4 },
  })).json();
  const { subject: sElec } = await (await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: t1.id, name: 'Électrotechnique', coefficient: 5 },
  })).json();

  // Remplir les notes dans les deux matières
  await callApi(`/api/teacher/gradebook/${sMath.id}/${t1.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      noteColumnCount: 2,
      columnMetas: { 0: { maxScore: 20, coeffEval: 1 }, 1: { maxScore: 20, coeffEval: 1 } },
      layout: {},
      styles: {},
      students: [
        { id: 'm-1', studentUid: 'stu-jean', name: 'KOUASSI Jean', notes: ['15/20', '16/20'] },
      ],
    },
  });
  await callApi(`/api/teacher/gradebook/${sElec.id}/${t1.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      noteColumnCount: 2,
      columnMetas: { 0: { maxScore: 20, coeffEval: 1 }, 1: { maxScore: 40, coeffEval: 1 } },
      layout: {},
      styles: {},
      students: [
        { id: 'e-1', studentUid: 'stu-jean', name: 'KOUASSI Jean', notes: ['16/20', '32/40'] },
      ],
    },
  });

  // 1. GET agrège les 2 matières + leurs moyennes exactes
  const sheetRes = await callApi(`/api/teacher/class-average-sheet/${t1AvgCard.id}`, {
    token: 'token-alice',
  });
  assert.equal(sheetRes.status, 200);
  const sheet = await sheetRes.json();
  assert.equal(sheet.subjects.length, 2);
  assert.equal(sheet.subjects[0].effectiveCoeff, 4);
  assert.equal(sheet.subjects[1].effectiveCoeff, 5);
  assert.equal(sheet.subjectGradebooks[sMath.id][0].average20, 15.5);
  assert.equal(sheet.subjectGradebooks[sElec.id][0].average20, 16);

  // 2. PUT persiste layout (zoom, largeurs), styles, overrides manuels et sortMode
  const saveRes = await callApi(`/api/teacher/class-average-sheet/${t1AvgCard.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      layout: { zoomPercent: 90, colWidthName: 250 },
      styles: { rowColors: { 'name:kouassi jean': '#eff6ff' } },
      overrides: {
        manualStudents: [{ key: 'man-awa', name: 'TRAORÉ Awa' }],
        subjectOverrides: { 'man-awa': { [sMath.id]: 14, [sElec.id]: 25 } }, // 25 invalide -> ignoré
      },
      sortMode: 'alpha',
    },
  });
  assert.equal(saveRes.status, 200);

  const reloaded = await (await callApi(`/api/teacher/class-average-sheet/${t1AvgCard.id}`, {
    token: 'token-alice',
  })).json();
  assert.equal(reloaded.card.layout.zoomPercent, 90);
  assert.equal(reloaded.card.layout.colWidthName, 250);
  assert.equal(reloaded.card.styles.rowColors['name:kouassi jean'], '#eff6ff');
  assert.equal(reloaded.card.sortMode, 'alpha');
  assert.equal(reloaded.card.overrides.manualStudents.length, 1);
  assert.equal(reloaded.card.overrides.subjectOverrides['man-awa'][sMath.id], 14);
  assert.equal(reloaded.card.overrides.subjectOverrides['man-awa'][sElec.id], undefined);

  // 3. Anti-IDOR : Bob ne peut ni lire ni modifier la feuille de moyenne d'Alice
  const bobGet = await callApi(`/api/teacher/class-average-sheet/${t1AvgCard.id}`, {
    token: 'token-bob',
  });
  assert.equal(bobGet.status, 404);
  const bobPut = await callApi(`/api/teacher/class-average-sheet/${t1AvgCard.id}`, {
    method: 'PUT',
    token: 'token-bob',
    body: { sortMode: 'alpha' },
  });
  assert.equal(bobPut.status, 404);
});

test('Répertoire classe (GET /api/teacher/class-roster/:id), persistance mergedLinks/distinctPairs et protection photo R2 partagée', async () => {
  const { callApi, r2Images } = createHarness();

  const { year } = await (await callApi('/api/teacher/years', {
    method: 'POST',
    token: 'token-alice',
    body: { label: '2026 - 2027' },
  })).json();
  const { school } = await (await callApi('/api/teacher/schools', {
    method: 'POST',
    token: 'token-alice',
    body: { yearId: year.id, name: 'CME' },
  })).json();
  const { level } = await (await callApi('/api/teacher/levels', {
    method: 'POST',
    token: 'token-alice',
    body: { schoolId: school.id, name: 'BTS 2' },
  })).json();
  const { classItem, terms, classAverages } = await (await callApi('/api/teacher/classes', {
    method: 'POST',
    token: 'token-alice',
    body: { levelId: level.id, name: 'Groupe 2', teacherName: 'DKD' },
  })).json();
  const t1 = terms[0];
  const t1Avg = classAverages.find((c: any) => c.kind === 'term' && c.termId === t1.id);

  const { subject: sMath } = await (await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: t1.id, name: 'Mathématiques', coefficient: 4 },
  })).json();
  const { subject: sAng } = await (await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: t1.id, name: 'Anglais', coefficient: 2 },
  })).json();

  // Upload d'une photo élève dans Mathématiques
  const tinyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const photoRes = await callApi('/api/teacher/photos/student', {
    method: 'POST',
    token: 'token-alice',
    body: {
      subjectId: sMath.id,
      termId: t1.id,
      studentId: 'm-1',
      dataUrl: `data:image/png;base64,${tinyPngBase64}`,
    },
  });
  assert.equal(photoRes.status, 200);
  const { photoR2Key } = await photoRes.json();
  assert.ok(r2Images.store.has(photoR2Key));

  // Enregistrer KOUASSI Jean (avec photo) + 2 homonymes KONÉ Mamadou dans Mathématiques
  await callApi(`/api/teacher/gradebook/${sMath.id}/${t1.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      noteColumnCount: 1,
      columnMetas: { 0: { maxScore: 20 } },
      layout: {},
      styles: {},
      students: [
        { id: 'm-1', studentUid: 'uid-jean', name: 'KOUASSI Jean', photoR2Key, notes: ['15/20'] },
        { id: 'm-2', studentUid: 'uid-kone-1', name: 'KONÉ Mamadou', notes: ['16/20'] },
        { id: 'm-3', studentUid: 'uid-kone-2', name: 'KONÉ Mamadou', notes: ['10/20'] },
      ],
    },
  });

  // Auto-complétion en Anglais : même studentUid et même photoR2Key partagée pour KOUASSI Jean
  await callApi(`/api/teacher/gradebook/${sAng.id}/${t1.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      noteColumnCount: 1,
      columnMetas: { 0: { maxScore: 20 } },
      layout: {},
      styles: {},
      students: [
        { id: 'a-1', studentUid: 'uid-jean', name: 'KOUASSI Jean', photoR2Key, notes: ['17/20'] },
      ],
    },
  });

  // 1. GET /api/teacher/class-roster/:classId déduplique par studentUid et préserve les 2 homonymes
  const rosterRes = await callApi(`/api/teacher/class-roster/${classItem.id}`, {
    token: 'token-alice',
  });
  assert.equal(rosterRes.status, 200);
  const roster = await rosterRes.json();
  assert.equal(roster.students.length, 3);
  const jeanRoster = roster.students.find((s: any) => s.studentUid === 'uid-jean');
  assert.ok(jeanRoster);
  assert.equal(jeanRoster.subjectNames.length, 2);
  assert.ok(jeanRoster.photoUrl);

  // Anti-IDOR : Bob ne peut pas lire le répertoire de classe d'Alice
  const bobRoster = await callApi(`/api/teacher/class-roster/${classItem.id}`, {
    token: 'token-bob',
  });
  assert.equal(bobRoster.status, 404);

  // 2. Persistance de mergedLinks et distinctPairs dans teacher_class_averages
  const saveLinks = await callApi(`/api/teacher/class-average-sheet/${t1Avg.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      layout: {},
      styles: {},
      overrides: {
        manualStudents: [],
        subjectOverrides: {},
        mergedLinks: [{ primaryKey: 'name:kouassi jean', mergedKeys: ['name:kouasi jean'] }],
        distinctPairs: [['uid:uid-kone-1', 'uid:uid-kone-2']],
      },
      sortMode: 'merit',
    },
  });
  assert.equal(saveLinks.status, 200);
  const loadedSheet = await (await callApi(`/api/teacher/class-average-sheet/${t1Avg.id}`, {
    token: 'token-alice',
  })).json();
  assert.deepEqual(loadedSheet.card.overrides.mergedLinks, [
    { primaryKey: 'name:kouassi jean', mergedKeys: ['name:kouasi jean'] },
  ]);
  assert.deepEqual(loadedSheet.card.overrides.distinctPairs, [
    ['uid:uid-kone-1', 'uid:uid-kone-2'],
  ]);

  // 3. Protection photo R2 partagée : supprimer Anglais NE doit PAS supprimer la photo encore utilisée en Maths !
  await callApi(`/api/teacher/subjects/${sAng.id}`, {
    method: 'DELETE',
    token: 'token-alice',
  });
  assert.equal(r2Images.store.has(photoR2Key), true, 'La photo partagée doit rester intacte tant que Maths la référence');

  // Puis supprimer Mathématiques (dernière référence) -> la photo R2 est bien nettoyée
  await callApi(`/api/teacher/subjects/${sMath.id}`, {
    method: 'DELETE',
    token: 'token-alice',
  });
  assert.equal(r2Images.store.has(photoR2Key), false, 'La photo R2 orpheline doit être nettoyée une fois la dernière référence supprimée');
});

test('Style de couleur (accent vs full) persisté sur les 5 entités + mise à jour rapide du coefficient matière', async () => {
  const { callApi } = createHarness();

  // 1. Créer les 5 entités avec des styles explicites (accent / full)
  const { year } = await (await callApi('/api/teacher/years', {
    method: 'POST',
    token: 'token-alice',
    body: { label: '2026 - 2027', color: '#2563eb', textColor: '#ffffff', colorStyle: 'accent' },
  })).json();
  assert.equal(year.colorStyle, 'accent');

  const { school } = await (await callApi('/api/teacher/schools', {
    method: 'POST',
    token: 'token-alice',
    body: { yearId: year.id, name: 'CME', color: '#059669', textColor: '#ffffff', colorStyle: 'accent' },
  })).json();
  assert.equal(school.colorStyle, 'accent');

  const { level } = await (await callApi('/api/teacher/levels', {
    method: 'POST',
    token: 'token-alice',
    body: { schoolId: school.id, name: 'BTS 2', color: '#7c3aed', textColor: '#ffffff', colorStyle: 'full' },
  })).json();
  assert.equal(level.colorStyle, 'full');

  const { classItem, terms, classAverages } = await (await callApi('/api/teacher/classes', {
    method: 'POST',
    token: 'token-alice',
    body: {
      levelId: level.id,
      name: 'Groupe 2 ELT',
      teacherName: 'DKD',
      color: '#ea580c',
      textColor: '#ffffff',
      colorStyle: 'full',
    },
  })).json();
  assert.equal(classItem.colorStyle, 'full');

  const t1 = terms[0];
  const t1Avg = classAverages.find((c: any) => c.kind === 'term' && c.termId === t1.id);
  assert.ok(t1Avg);

  // Créer une matière SANS coefficient avec style 'full'
  const { subject } = await (await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: {
      classId: classItem.id,
      termId: t1.id,
      name: 'Mathématiques',
      coefficient: null,
      color: '#dc2626',
      textColor: '#ffffff',
      colorStyle: 'full',
    },
  })).json();
  assert.equal(subject.colorStyle, 'full');
  assert.equal(subject.coefficient, undefined);

  // 2. Mise à jour rapide uniquement du coefficient (comme le bouton "Appliquer" du tableau de moyenne générale)
  const quickCoeffRes = await callApi(`/api/teacher/subjects/${subject.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: { coefficient: 3.5 },
  });
  assert.equal(quickCoeffRes.status, 200);
  const { subject: updatedSubject } = await quickCoeffRes.json();
  assert.equal(updatedSubject.coefficient, 3.5);
  assert.equal(updatedSubject.name, 'Mathématiques');
  assert.equal(updatedSubject.color, '#dc2626');
  assert.equal(updatedSubject.colorStyle, 'full');

  // 3. Basculer le style de l'école vers 'full' et vérifier que bootstrap retourne tous les colorStyle exacts
  const updSchoolRes = await callApi(`/api/teacher/schools/${school.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: { colorStyle: 'full' },
  });
  assert.equal(updSchoolRes.status, 200);
  assert.equal((await updSchoolRes.json()).school.colorStyle, 'full');

  const boot = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  assert.equal(boot.schoolYears.find((y: any) => y.id === year.id)?.colorStyle, 'accent');
  assert.equal(boot.schools.find((s: any) => s.id === school.id)?.colorStyle, 'full');
  assert.equal(boot.studyLevels.find((l: any) => l.id === level.id)?.colorStyle, 'full');
  assert.equal(boot.classes.find((c: any) => c.id === classItem.id)?.colorStyle, 'full');
  assert.equal(boot.subjects.find((s: any) => s.id === subject.id)?.colorStyle, 'full');
  assert.equal(boot.subjects.find((s: any) => s.id === subject.id)?.coefficient, 3.5);

  // 4. Vérifier que le tableau de moyenne générale reflète immédiatement le nouveau coefficient enregistré
  const avgSheet = await (await callApi(`/api/teacher/class-average-sheet/${t1Avg.id}`, {
    token: 'token-alice',
  })).json();
  const sheetSubj = avgSheet.subjects.find((s: any) => s.id === subject.id);
  assert.equal(sheetSubj?.coefficient, 3.5);
  assert.equal(sheetSubj?.effectiveCoeff, 3.5);
});

test('Création en lot atomique (POST /api/teacher/batch-create) : rentrées, écoles, niveaux, classes, trimestres, matières + Anti-IDOR', async () => {
  const { callApi } = createHarness();

  // 1. Créer 2 rentrées d'un coup (+ doublon ignoré proprement)
  const yearsRes = await callApi('/api/teacher/batch-create', {
    method: 'POST',
    token: 'token-alice',
    body: {
      entity: 'years',
      items: [
        { label: '2026 - 2027', color: '#2563eb', textColor: '#ffffff', colorStyle: 'full' },
        { label: '2027 - 2028', color: '#2563eb', textColor: '#ffffff', colorStyle: 'accent' },
        { label: '2026 - 2027', color: '#dc2626', textColor: '#ffffff', colorStyle: 'full' },
      ],
    },
  });
  assert.equal(yearsRes.status, 201);
  const yearsJson = await yearsRes.json();
  assert.equal(yearsJson.years.length, 2);
  assert.deepEqual(yearsJson.skippedLabels, ['2026 - 2027']);
  const y1 = yearsJson.years[0];

  // 2. Créer 2 écoles d'un coup (dont une avec logo PNG valide)
  const tinyPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const schoolsRes = await callApi('/api/teacher/batch-create', {
    method: 'POST',
    token: 'token-alice',
    body: {
      entity: 'schools',
      yearId: y1.id,
      items: [
        { name: 'Lycée Moderne', logoDataUrl: tinyPngDataUrl, color: '#059669', textColor: '#ffffff', colorStyle: 'full' },
        { name: 'Collège Saint-Paul', color: '#059669', textColor: '#ffffff', colorStyle: 'accent' },
      ],
    },
  });
  assert.equal(schoolsRes.status, 201);
  const schoolsJson = await schoolsRes.json();
  assert.equal(schoolsJson.schools.length, 2);
  assert.ok(schoolsJson.schools[0].logoUrl, 'Le logo de la 1ère école doit être signé');
  assert.equal(schoolsJson.schools[1].colorStyle, 'accent');
  const sch1 = schoolsJson.schools[0];

  // 3. Créer 3 niveaux d'un coup
  const levelsRes = await callApi('/api/teacher/batch-create', {
    method: 'POST',
    token: 'token-alice',
    body: {
      entity: 'levels',
      schoolId: sch1.id,
      items: [
        { name: '2nde', color: '#7c3aed', textColor: '#ffffff', colorStyle: 'full' },
        { name: '1ère', color: '#7c3aed', textColor: '#ffffff', colorStyle: 'full' },
        { name: 'Terminale', color: '#7c3aed', textColor: '#ffffff', colorStyle: 'full' },
      ],
    },
  });
  assert.equal(levelsRes.status, 201);
  const levelsJson = await levelsRes.json();
  assert.equal(levelsJson.levels.length, 3);
  const lvl1 = levelsJson.levels[0];

  // 4. Créer 2 classes d'un coup -> vérifie 6 trimestres (3 chacun) et 8 cartes moyenne générale (4 chacune) !
  const classesRes = await callApi('/api/teacher/batch-create', {
    method: 'POST',
    token: 'token-alice',
    body: {
      entity: 'classes',
      levelId: lvl1.id,
      items: [
        { name: '2nde A', teacherName: 'M. Kouassi', color: '#ea580c', textColor: '#ffffff', colorStyle: 'full' },
        { name: '2nde B', teacherName: 'M. Kouassi', slogan: 'Série C', color: '#ea580c', textColor: '#ffffff', colorStyle: 'accent' },
      ],
    },
  });
  assert.equal(classesRes.status, 201);
  const classesJson = await classesRes.json();
  assert.equal(classesJson.classes.length, 2);
  assert.equal(classesJson.terms.length, 6);
  assert.equal(classesJson.classAverages.length, 8);
  const cls1 = classesJson.classes[0];
  const cls1T1 = classesJson.terms.find((t: any) => t.classId === cls1.id && t.number === 1);
  assert.ok(cls1T1);

  // 5. Créer 2 trimestres supplémentaires d'un coup (T4, T5) -> 2 cartes moyenne générale créées
  const termsRes = await callApi('/api/teacher/batch-create', {
    method: 'POST',
    token: 'token-alice',
    body: {
      entity: 'terms',
      classId: cls1.id,
      items: [
        { number: 4, name: 'Trimestre 4', coefficient: 2 },
        { number: 5, name: 'Trimestre 5', coefficient: null },
      ],
    },
  });
  assert.equal(termsRes.status, 201);
  const termsJson = await termsRes.json();
  assert.equal(termsJson.terms.length, 2);
  assert.equal(termsJson.classAverages.length, 2);
  assert.equal(termsJson.terms[0].coefficient, 2);
  assert.equal(termsJson.terms[1].coefficient, undefined);

  // 6. Créer 4 matières d'un coup avec coefficients mixtes (dont un facultatif null)
  const subjectsRes = await callApi('/api/teacher/batch-create', {
    method: 'POST',
    token: 'token-alice',
    body: {
      entity: 'subjects',
      classId: cls1.id,
      termId: cls1T1.id,
      items: [
        { name: 'Mathématiques', coefficient: 4, color: '#dc2626', textColor: '#ffffff', colorStyle: 'full' },
        { name: 'Français', coefficient: 3, color: '#dc2626', textColor: '#ffffff', colorStyle: 'full' },
        { name: 'Anglais', coefficient: 2, color: '#dc2626', textColor: '#ffffff', colorStyle: 'full' },
        { name: 'EPS', coefficient: null, color: '#dc2626', textColor: '#ffffff', colorStyle: 'accent' },
      ],
    },
  });
  assert.equal(subjectsRes.status, 201);
  const subjectsJson = await subjectsRes.json();
  assert.equal(subjectsJson.subjects.length, 4);
  assert.equal(subjectsJson.subjects[0].coefficient, 4);
  assert.equal(subjectsJson.subjects[3].coefficient, undefined);

  // 7. Vérifier la persistance complète via /api/teacher/bootstrap
  const boot = await (await callApi('/api/teacher/bootstrap', { token: 'token-alice' })).json();
  assert.equal(boot.schoolYears.length, 2);
  assert.equal(boot.schools.length, 2);
  assert.equal(boot.studyLevels.length, 3);
  assert.equal(boot.classes.length, 2);
  assert.equal(boot.terms.length, 8);
  assert.equal(boot.subjects.length, 4);
  assert.equal(boot.classAverages.length, 10);

  // 8. Anti-IDOR : Bob ne peut créer en lot sous aucun parent appartenant à Alice
  const bobSchools = await callApi('/api/teacher/batch-create', {
    method: 'POST',
    token: 'token-bob',
    body: { entity: 'schools', yearId: y1.id, items: [{ name: 'Hack' }] },
  });
  assert.equal(bobSchools.status, 404);

  const bobSubjects = await callApi('/api/teacher/batch-create', {
    method: 'POST',
    token: 'token-bob',
    body: { entity: 'subjects', classId: cls1.id, termId: cls1T1.id, items: [{ name: 'Hack' }] },
  });
  assert.equal(bobSubjects.status, 404);
});

test('Feuille Moyenne générale annuelle (GET & PUT /api/teacher/class-average-sheet/:annualId) : agrégation multi-trimestres, coefficients, overrides trimestriels et Anti-IDOR', async () => {
  const { callApi, r2Images } = createHarness();

  const { year } = await (await callApi('/api/teacher/years', {
    method: 'POST',
    token: 'token-alice',
    body: { label: '2026 - 2027' },
  })).json();
  const { school } = await (await callApi('/api/teacher/schools', {
    method: 'POST',
    token: 'token-alice',
    body: { yearId: year.id, name: 'Lycée Technique' },
  })).json();
  const { level } = await (await callApi('/api/teacher/levels', {
    method: 'POST',
    token: 'token-alice',
    body: { schoolId: school.id, name: 'Terminale' },
  })).json();
  const { classItem, terms, classAverages } = await (await callApi('/api/teacher/classes', {
    method: 'POST',
    token: 'token-alice',
    body: { levelId: level.id, name: 'Terminale C', teacherName: 'Prof. Koné' },
  })).json();

  const [t1, t2, t3] = terms;
  const annualCard = classAverages.find((c: any) => c.kind === 'annual');
  const t1AvgCard = classAverages.find((c: any) => c.kind === 'term' && c.termId === t1.id);
  assert.ok(annualCard, 'Carte annuelle créée automatiquement');
  assert.ok(t1AvgCard, 'Carte Trimestre 1 créée automatiquement');

  // Définir les coefficients de T1 (=1) et T2 (=2), laisser T3 non défini (null)
  assert.equal(
    (await callApi(`/api/teacher/terms/${t1.id}`, {
      method: 'PUT',
      token: 'token-alice',
      body: { name: t1.name, coefficient: 1 },
    })).status,
    200
  );
  assert.equal(
    (await callApi(`/api/teacher/terms/${t2.id}`, {
      method: 'PUT',
      token: 'token-alice',
      body: { name: t2.name, coefficient: 2 },
    })).status,
    200
  );

  // Créer des matières dans T1 (Maths coeff 4, Français coeff 2) et T2 (Maths coeff 4)
  const { subject: sMathT1 } = await (await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: t1.id, name: 'Mathématiques', coefficient: 4 },
  })).json();
  const { subject: sFrT1 } = await (await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: t1.id, name: 'Français', coefficient: 2 },
  })).json();
  const { subject: sMathT2 } = await (await callApi('/api/teacher/subjects', {
    method: 'POST',
    token: 'token-alice',
    body: { classId: classItem.id, termId: t2.id, name: 'Mathématiques', coefficient: 4 },
  })).json();

  // Upload réel d'une photo R2 partagée pour Jean
  const tinyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const photoRes = await callApi('/api/teacher/photos/student', {
    method: 'POST',
    token: 'token-alice',
    body: {
      subjectId: sMathT1.id,
      termId: t1.id,
      studentId: 't1-m-1',
      dataUrl: `data:image/png;base64,${tinyPngBase64}`,
    },
  });
  assert.equal(photoRes.status, 200);
  const { photoR2Key: photoKey } = await photoRes.json();
  assert.ok(r2Images.store.has(photoKey));

  // Saisir les notes de T1 et T2
  await callApi(`/api/teacher/gradebook/${sMathT1.id}/${t1.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      noteColumnCount: 2,
      columnMetas: { 0: { maxScore: 20, coeffEval: 1 }, 1: { maxScore: 20, coeffEval: 1 } },
      layout: {},
      styles: {},
      students: [
        { id: 't1-m-1', studentUid: 'stu-jean', name: 'KOUASSI Jean', photoR2Key: photoKey, notes: ['12/20', '14/20'] },
      ],
    },
  });
  await callApi(`/api/teacher/gradebook/${sFrT1.id}/${t1.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      noteColumnCount: 1,
      columnMetas: { 0: { maxScore: 20, coeffEval: 1 } },
      layout: {},
      styles: {},
      students: [
        { id: 't1-f-1', studentUid: 'stu-jean', name: 'KOUASSI Jean', photoR2Key: photoKey, notes: ['10/20'] },
      ],
    },
  });
  await callApi(`/api/teacher/gradebook/${sMathT2.id}/${t2.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      noteColumnCount: 1,
      columnMetas: { 0: { maxScore: 20, coeffEval: 1 } },
      layout: {},
      styles: {},
      students: [
        { id: 't2-m-1', studentUid: 'stu-jean', name: 'KOUASSI Jean', photoR2Key: photoKey, notes: ['16/20'] },
      ],
    },
  });

  // Sauvegarder une fusion confirmée sur le Trimestre 1 pour vérifier sa propagation dans le bilan annuel
  assert.equal(
    (await callApi(`/api/teacher/class-average-sheet/${t1AvgCard.id}`, {
      method: 'PUT',
      token: 'token-alice',
      body: {
        layout: {},
        styles: {},
        overrides: {
          mergedLinks: [{ primaryKey: 'uid:stu-jean', mergedKeys: ['name:kouasi jean'] }],
        },
        sortMode: 'merit',
      },
    })).status,
    200
  );

  // 1. GET annuel agrège tous les trimestres, coefficients, matières, notes, overrides trimestriels et photo signée
  const annualRes = await callApi(`/api/teacher/class-average-sheet/${annualCard.id}`, {
    token: 'token-alice',
  });
  assert.equal(annualRes.status, 200);
  const annualJson = await annualRes.json();
  assert.equal(annualJson.card.kind, 'annual');
  assert.ok(annualJson.annualData, 'annualData présent');
  assert.equal(annualJson.annualData.terms.length, 3);

  const [retT1, retT2, retT3] = annualJson.annualData.terms;
  assert.equal(retT1.id, t1.id);
  assert.equal(retT1.averageCardId, t1AvgCard.id);
  assert.equal(retT1.coefficient, 1);
  assert.equal(retT1.effectiveCoeff, 1);
  assert.equal(retT1.subjects.length, 2);
  assert.equal(retT1.subjectGradebooks[sMathT1.id][0].average20, 13);
  assert.equal(retT1.subjectGradebooks[sFrT1.id][0].average20, 10);
  assert.ok(
    typeof retT1.subjectGradebooks[sMathT1.id][0].photoUrl === 'string' &&
      retT1.subjectGradebooks[sMathT1.id][0].photoUrl.includes('/api/teacher/media?key='),
    'Photo R2 signée présente dans annualData'
  );
  assert.deepEqual(retT1.overrides.mergedLinks, [
    { primaryKey: 'uid:stu-jean', mergedKeys: ['name:kouasi jean'] },
  ]);

  assert.equal(retT2.id, t2.id);
  assert.equal(retT2.coefficient, 2);
  assert.equal(retT2.effectiveCoeff, 2);
  assert.equal(retT2.subjects.length, 1);
  assert.equal(retT2.subjectGradebooks[sMathT2.id][0].average20, 16);

  assert.equal(retT3.id, t3.id);
  assert.equal(retT3.coefficient, null);
  assert.equal(retT3.effectiveCoeff, 1);
  assert.equal(retT3.subjects.length, 0);

  // 2. PUT annuel persiste layout, styles, rapprochements annuels (mergedLinks/distinctPairs) et sortMode
  const saveAnnualRes = await callApi(`/api/teacher/class-average-sheet/${annualCard.id}`, {
    method: 'PUT',
    token: 'token-alice',
    body: {
      layout: { zoomPercent: 85, colWidthName: 240 },
      styles: { rowColors: { 'uid:stu-jean': '#ecfdf5' } },
      overrides: {
        mergedLinks: [{ primaryKey: 'uid:stu-jean', mergedKeys: ['name:kouassi j'] }],
        distinctPairs: [['uid:stu-a', 'uid:stu-b']],
        subjectOverrides: { 'uid:stu-jean': { [t3.id]: 15.5 } },
      },
      sortMode: 'alpha',
    },
  });
  assert.equal(saveAnnualRes.status, 200);

  const reloadedAnnual = await (await callApi(`/api/teacher/class-average-sheet/${annualCard.id}`, {
    token: 'token-alice',
  })).json();
  assert.equal(reloadedAnnual.card.layout.zoomPercent, 85);
  assert.equal(reloadedAnnual.card.layout.colWidthName, 240);
  assert.equal(reloadedAnnual.card.styles.rowColors['uid:stu-jean'], '#ecfdf5');
  assert.equal(reloadedAnnual.card.sortMode, 'alpha');
  assert.deepEqual(reloadedAnnual.card.overrides.mergedLinks, [
    { primaryKey: 'uid:stu-jean', mergedKeys: ['name:kouassi j'] },
  ]);
  assert.deepEqual(reloadedAnnual.card.overrides.distinctPairs, [['uid:stu-a', 'uid:stu-b']]);
  assert.equal(reloadedAnnual.card.overrides.subjectOverrides['uid:stu-jean'][t3.id], 15.5);

  // 3. Anti-IDOR : Bob ne peut ni lire ni modifier le bilan annuel d'Alice
  assert.equal(
    (await callApi(`/api/teacher/class-average-sheet/${annualCard.id}`, { token: 'token-bob' })).status,
    404
  );
  assert.equal(
    (await callApi(`/api/teacher/class-average-sheet/${annualCard.id}`, {
      method: 'PUT',
      token: 'token-bob',
      body: { sortMode: 'alpha' },
    })).status,
    404
  );
});

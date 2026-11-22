/**
 * StudyCloud - Module Enseignant (Calcul de Moyenne & Gestion Scolaire)
 * Backend Cloudflare Worker : D1 (8 tables relationnelles isolées par user_id) + R2 (Photos élèves & Logos écoles)
 *
 * Sécurité :
 *  - Identité utilisateur EXCLUSIVEMENT issue du JWT vérifié + auth_sessions (getAuthUser)
 *  - Isolation multi-tenant stricte : chaque requête SQL filtre par user_id = ? et vérifie la chaîne parentale (Anti-IDOR)
 *  - Photos R2 privées servies par signature HMAC-SHA256 à durée limitée ou JWT, avec contrôle de préfixe user_id
 *  - Validation magic-bytes des images (JPEG/PNG/WebP uniquement, plafond 600 Ko)
 *  - Nettoyage automatique des objets R2 lors des remplacements et suppressions en cascade
 */

export interface TeacherWorkerDeps {
  db: any;
  rawEnv: any;
  origin: string;
  jwtSecret: string;
  getAuthUser: (req: Request) => Promise<any | null>;
  corsHeaders: (origin?: string) => Record<string, string>;
  jsonResponse: (data: any, status?: number, origin?: string) => Response;
  errorResponse: (message: string, status?: number, origin?: string) => Response;
}

const MAX_IMAGE_BYTES = 600 * 1024; // 600 Ko max par photo de profil élève ou logo d'école
const SIGNED_MEDIA_TTL_SECONDS = 12 * 3600; // 12 heures (rafraîchi à chaque bootstrap/chargement)

const initializedTeacherDbs = new WeakSet<object>();

// ============================================================================
// 1. AUTO-INITIALISATION DES TABLES D1 (IDEMPOTENTE PAR INSTANCE DB)
// ============================================================================

export async function ensureTeacherGradebookTables(db: any): Promise<void> {
  if (!db || initializedTeacherDbs.has(db)) return;

  const statements = [
    `CREATE TABLE IF NOT EXISTS teacher_school_years (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#00313d',
      text_color TEXT DEFAULT '#ffffff',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_years_user ON teacher_school_years(user_id, created_at)`,

    `CREATE TABLE IF NOT EXISTS teacher_schools (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      name TEXT NOT NULL,
      logo_r2_key TEXT DEFAULT NULL,
      color TEXT NOT NULL DEFAULT '#ffffff',
      text_color TEXT NOT NULL DEFAULT '#0f172a',
      border_color TEXT NOT NULL DEFAULT '#e2e8f0',
      border_dark_color TEXT NOT NULL DEFAULT '#cbd5e1',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (year_id) REFERENCES teacher_school_years(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_schools_user_year ON teacher_schools(user_id, year_id, created_at)`,

    `CREATE TABLE IF NOT EXISTS teacher_study_levels (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#ffffff',
      text_color TEXT DEFAULT '#0f172a',
      border_color TEXT DEFAULT '#cbd5e1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (school_id) REFERENCES teacher_schools(id) ON DELETE CASCADE,
      FOREIGN KEY (year_id) REFERENCES teacher_school_years(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_levels_user_school ON teacher_study_levels(user_id, school_id, sort_order, created_at)`,

    `CREATE TABLE IF NOT EXISTS teacher_classes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      level_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      level_name TEXT NOT NULL,
      name TEXT DEFAULT '',
      slogan TEXT DEFAULT NULL,
      teacher_name TEXT NOT NULL DEFAULT '',
      subject_label TEXT DEFAULT NULL,
      color TEXT NOT NULL DEFAULT '#ffffff',
      text_color TEXT NOT NULL DEFAULT '#0f172a',
      border_color TEXT NOT NULL DEFAULT '#e2e8f0',
      border_dark_color TEXT NOT NULL DEFAULT '#cbd5e1',
      icon_gradient TEXT NOT NULL DEFAULT 'from-amber-500 to-orange-600',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (level_id) REFERENCES teacher_study_levels(id) ON DELETE CASCADE,
      FOREIGN KEY (school_id) REFERENCES teacher_schools(id) ON DELETE CASCADE,
      FOREIGN KEY (year_id) REFERENCES teacher_school_years(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_classes_user_level ON teacher_classes(user_id, school_id, level_id, created_at)`,

    `CREATE TABLE IF NOT EXISTS teacher_terms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      number INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE,
      FOREIGN KEY (school_id) REFERENCES teacher_schools(id) ON DELETE CASCADE,
      FOREIGN KEY (year_id) REFERENCES teacher_school_years(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_terms_user_class ON teacher_terms(user_id, class_id, number)`,

    `CREATE TABLE IF NOT EXISTS teacher_subjects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      term_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      name TEXT NOT NULL,
      coefficient REAL DEFAULT NULL,
      color TEXT NOT NULL DEFAULT '#ffffff',
      text_color TEXT NOT NULL DEFAULT '#0f172a',
      border_color TEXT NOT NULL DEFAULT '#e2e8f0',
      border_dark_color TEXT NOT NULL DEFAULT '#cbd5e1',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE,
      FOREIGN KEY (term_id) REFERENCES teacher_terms(id) ON DELETE CASCADE,
      FOREIGN KEY (school_id) REFERENCES teacher_schools(id) ON DELETE CASCADE,
      FOREIGN KEY (year_id) REFERENCES teacher_school_years(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_subjects_user_class_term ON teacher_subjects(user_id, class_id, term_id, created_at)`,

    `CREATE TABLE IF NOT EXISTS teacher_gradebooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      term_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      note_col_count INTEGER NOT NULL DEFAULT 7,
      col_metas_json TEXT NOT NULL DEFAULT '{}',
      layout_json TEXT NOT NULL DEFAULT '{}',
      styles_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (user_id, subject_id, term_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES teacher_subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (term_id) REFERENCES teacher_terms(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_gb_user_subject_term ON teacher_gradebooks(user_id, subject_id, term_id)`,

    `CREATE TABLE IF NOT EXISTS teacher_gradebook_students (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      gradebook_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      term_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      student_uid TEXT NOT NULL,
      row_order INTEGER NOT NULL DEFAULT 0,
      full_name TEXT NOT NULL DEFAULT '',
      photo_r2_key TEXT DEFAULT NULL,
      notes_json TEXT NOT NULL DEFAULT '[]',
      average_20 REAL DEFAULT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (gradebook_id) REFERENCES teacher_gradebooks(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_gb_students_gb ON teacher_gradebook_students(user_id, gradebook_id, row_order)`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_gb_students_class_term ON teacher_gradebook_students(user_id, class_id, term_id, student_uid)`,
  ];

  await db.batch(statements.map((sql) => db.prepare(sql)));
  initializedTeacherDbs.add(db);
}

// ============================================================================
// 2. HELPERS SÉCURITÉ, R2, SIGNATURES HMAC & CALCULS
// ============================================================================

function getTeacherPhotosBucket(rawEnv: any): any {
  if (!rawEnv) return null;
  return (
    rawEnv.BUCKET_TEACHER_PHOTOS ||
    rawEnv.MON_R2_TEACHER_PHOTOS ||
    rawEnv.BUCKET_IMAGES ||
    rawEnv.MON_R2_IMAGES ||
    rawEnv['MON_R2-IMAGES'] ||
    rawEnv.BUCKET ||
    rawEnv.MON_R2_STUDYCLOUD ||
    rawEnv['MON_R2-STUDYCLOUD'] ||
    null
  );
}

function getFallbackMainBucket(rawEnv: any): any {
  if (!rawEnv) return null;
  return rawEnv.BUCKET || rawEnv.MON_R2_STUDYCLOUD || rawEnv['MON_R2-STUDYCLOUD'] || null;
}

export function sanitizeSegment(raw: string, fallback = 'item'): string {
  const clean = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);
  return clean || fallback;
}

function makeId(prefix: string): string {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}-${Date.now()}-${rand}`;
}

async function runBatchChunked(db: any, stmts: any[], chunkSize = 80): Promise<void> {
  if (!stmts || stmts.length === 0) return;
  for (let i = 0; i < stmts.length; i += chunkSize) {
    await db.batch(stmts.slice(i, i + chunkSize));
  }
}

async function resolveSafeNewId(db: any, table: string, candidate: any, prefix: string): Promise<string> {
  const raw = typeof candidate === 'string' ? candidate.trim() : '';
  if (!raw || raw.length > 80 || raw === 'year-default' || !/^[a-zA-Z0-9_-]+$/.test(raw)) {
    return makeId(prefix);
  }
  const existing = await db.prepare(`SELECT id FROM ${table} WHERE id = ? LIMIT 1`).bind(raw).first();
  return existing ? makeId(prefix) : raw;
}

function isOwnedR2Key(key: string | null | undefined, userId: string): boolean {
  if (!key || typeof key !== 'string') return false;
  if (key.includes('..') || key.includes('\\') || key.includes('\0')) return false;
  const safeUser = sanitizeSegment(userId);
  return (
    key.startsWith(`teacher-student-photos/${safeUser}/`) ||
    key.startsWith(`teacher-school-logos/${safeUser}/`)
  );
}

function extractOwnerSegmentFromR2Key(key: string): string | null {
  if (!key || typeof key !== 'string') return null;
  if (key.includes('..') || key.includes('\\') || key.includes('\0')) return null;
  const match = key.match(/^(?:teacher-student-photos|teacher-school-logos)\/([a-zA-Z0-9_-]+)\/[a-zA-Z0-9_./-]+$/);
  return match ? match[1] : null;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function signTeacherMediaUrl(origin: string, key: string | null | undefined, jwtSecret: string): Promise<string | undefined> {
  if (!key) return undefined;
  const exp = Math.floor(Date.now() / 1000) + SIGNED_MEDIA_TTL_SECONDS;
  const sig = await hmacHex(jwtSecret, `teacher-media:${key}:${exp}`);
  return `${origin}/api/teacher/media?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
}

async function verifyTeacherMediaSignature(key: string, expStr: string, sig: string, jwtSecret: string): Promise<boolean> {
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  if (!sig || !/^[a-f0-9]{64}$/i.test(sig)) return false;
  const expected = await hmacHex(jwtSecret, `teacher-media:${key}:${exp}`);
  return timingSafeEqualStr(sig.toLowerCase(), expected.toLowerCase());
}

function detectValidatedImageFormat(bytes: Uint8Array): { contentType: string; ext: string } | null {
  if (!bytes || bytes.length < 12 || bytes.length > MAX_IMAGE_BYTES) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', ext: 'jpg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: 'image/png', ext: 'png' };
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: 'image/webp', ext: 'webp' };
  }
  return null;
}

function decodeBase64DataUrl(dataUrl: string): Uint8Array | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const cleanB64 = match[1].replace(/\s+/g, '');
  if (cleanB64.length > MAX_IMAGE_BYTES * 1.45) return null;
  try {
    const bin = atob(cleanB64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function uploadImageBytesToR2(
  rawEnv: any,
  key: string,
  bytes: Uint8Array,
  contentType: string,
  customMetadata: Record<string, string>
): Promise<boolean> {
  const bucket = getTeacherPhotosBucket(rawEnv);
  if (!bucket) return false;
  await bucket.put(key, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: 'private, max-age=31536000',
    },
    customMetadata,
  });
  return true;
}

async function deleteOwnedR2Keys(rawEnv: any, userId: string, keys: Array<string | null | undefined>): Promise<void> {
  const safeKeys = Array.from(new Set(keys.filter((k): k is string => isOwnedR2Key(k, userId))));
  if (safeKeys.length === 0) return;
  const bucket = getTeacherPhotosBucket(rawEnv);
  const fallback = getFallbackMainBucket(rawEnv);
  const buckets = [bucket, fallback].filter((b, idx, arr) => b && arr.indexOf(b) === idx);
  for (const b of buckets) {
    for (let i = 0; i < safeKeys.length; i += 100) {
      const chunk = safeKeys.slice(i, i + 100);
      try {
        await b.delete(chunk);
      } catch {
        // Ignorer silencieusement si la clé n'était pas dans ce bucket
      }
    }
  }
}

async function copyOwnedR2Photo(
  rawEnv: any,
  userId: string,
  sourceKey: string,
  targetSchoolId: string,
  targetClassId: string,
  targetStudentId: string
): Promise<string | null> {
  if (!isOwnedR2Key(sourceKey, userId)) return null;
  const bucket = getTeacherPhotosBucket(rawEnv);
  if (!bucket) return null;

  let obj = await bucket.get(sourceKey);
  if (!obj) {
    const fallback = getFallbackMainBucket(rawEnv);
    if (fallback && fallback !== bucket) {
      obj = await fallback.get(sourceKey);
    }
  }
  if (!obj) return null;

  const buf = await obj.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const fmt = detectValidatedImageFormat(bytes);
  if (!fmt) return null;

  const safeUser = sanitizeSegment(userId);
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const destKey = `teacher-student-photos/${safeUser}/${sanitizeSegment(targetSchoolId)}/${sanitizeSegment(targetClassId)}/${sanitizeSegment(targetStudentId)}_${Date.now()}_${rand}.${fmt.ext}`;

  await bucket.put(destKey, bytes, {
    httpMetadata: {
      contentType: fmt.contentType,
      cacheControl: 'private, max-age=31536000',
    },
    customMetadata: {
      userId: safeUser,
      kind: 'student_photo',
      schoolId: sanitizeSegment(targetSchoolId),
      classId: sanitizeSegment(targetClassId),
      studentId: sanitizeSegment(targetStudentId),
    },
  });
  return destKey;
}

function safeParseJson<T>(raw: any, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function normalizeNameForMatch(val?: string): string {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Remappe les styles indexés par identifiant d'élève (`rowColors`, `cellColors`, `cellCustomStyles`)
 * lors d'un transfert de tableur afin que les couleurs de lignes, couleurs de cases et polices
 * suivent exactement chaque élève vers ses nouveaux IDs côté destination.
 */
function remapGradebookStylesForTransfer(
  srcStyles: any,
  studentIdMap: Map<string, string>,
  dstStyles: any,
  mode: 'replace' | 'merge'
): {
  rowColors: Record<string, string>;
  cellColors: Record<string, string>;
  cellCustomStyles: Record<string, any>;
} {
  const safeSrc = srcStyles && typeof srcStyles === 'object' ? srcStyles : {};
  const safeDst = dstStyles && typeof dstStyles === 'object' ? dstStyles : {};

  const outRowColors: Record<string, string> =
    mode === 'merge' && safeDst.rowColors && typeof safeDst.rowColors === 'object'
      ? { ...safeDst.rowColors }
      : {};
  const outCellColors: Record<string, string> =
    mode === 'merge' && safeDst.cellColors && typeof safeDst.cellColors === 'object'
      ? { ...safeDst.cellColors }
      : {};
  const outCellCustomStyles: Record<string, any> =
    mode === 'merge' && safeDst.cellCustomStyles && typeof safeDst.cellCustomStyles === 'object'
      ? { ...safeDst.cellCustomStyles }
      : {};

  if (studentIdMap.size === 0) {
    return {
      rowColors: outRowColors,
      cellColors: outCellColors,
      cellCustomStyles: outCellCustomStyles,
    };
  }

  // 1. Couleurs de lignes complètes (clé = studentId)
  if (safeSrc.rowColors && typeof safeSrc.rowColors === 'object') {
    for (const [oldId, color] of Object.entries(safeSrc.rowColors)) {
      const mappedId = studentIdMap.get(oldId);
      if (mappedId && typeof color === 'string' && color) {
        if (mode !== 'merge' || !outRowColors[mappedId]) {
          outRowColors[mappedId] = color;
        }
      }
    }
  }

  // Helper pour remapper les clés préfixées `${oldStudentId}_${suffix}`
  const remapPrefixedKey = (rawKey: string): string | null => {
    for (const [oldId, newId] of studentIdMap.entries()) {
      const prefix = `${oldId}_`;
      if (rawKey.startsWith(prefix)) {
        return `${newId}_${rawKey.slice(prefix.length)}`;
      }
    }
    return null;
  };

  // 2. Couleurs de cases individuelles (clé = `${studentId}_${colIndex}`)
  if (safeSrc.cellColors && typeof safeSrc.cellColors === 'object') {
    for (const [rawKey, color] of Object.entries(safeSrc.cellColors)) {
      const mappedKey = remapPrefixedKey(rawKey);
      if (mappedKey && typeof color === 'string' && color) {
        if (mode !== 'merge' || !outCellColors[mappedKey]) {
          outCellColors[mappedKey] = color;
        }
      }
    }
  }

  // 3. Styles détaillés du ruban (police, taille, gras, couleur texte, fond...) (clé = `${studentId}_${suffix}`)
  if (safeSrc.cellCustomStyles && typeof safeSrc.cellCustomStyles === 'object') {
    for (const [rawKey, styleObj] of Object.entries(safeSrc.cellCustomStyles)) {
      const mappedKey = remapPrefixedKey(rawKey);
      if (mappedKey && styleObj && typeof styleObj === 'object') {
        if (mode !== 'merge' || !outCellCustomStyles[mappedKey]) {
          outCellCustomStyles[mappedKey] = styleObj;
        }
      }
    }
  }

  return {
    rowColors: outRowColors,
    cellColors: outCellColors,
    cellCustomStyles: outCellCustomStyles,
  };
}

function computeAverage20(notes: string[], colMetas: Record<string, any>): number | null {
  if (!Array.isArray(notes) || notes.length === 0) return null;
  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < notes.length; i++) {
    const raw = String(notes[i] || '').trim();
    if (!raw) continue;
    const meta = colMetas?.[i] || colMetas?.[String(i)] || {};
    const defaultMax = Number(meta.maxScore) > 0 ? Number(meta.maxScore) : 20;
    const coeffEval = Number(meta.coeffEval) > 0 ? Number(meta.coeffEval) : 1;

    let score: number;
    let maxScore = defaultMax;
    if (raw.includes('/')) {
      const [sPart, mPart] = raw.split('/');
      score = parseFloat(sPart.replace(',', '.'));
      const parsedM = parseFloat((mPart || '').replace(',', '.'));
      if (Number.isFinite(parsedM) && parsedM > 0) maxScore = parsedM;
    } else {
      score = parseFloat(raw.replace(',', '.'));
    }

    if (!Number.isFinite(score) || score < 0 || maxScore <= 0 || score > maxScore) continue;
    const scoreOn20 = (score / maxScore) * 20;
    weightedSum += scoreOn20 * coeffEval;
    totalWeight += coeffEval;
  }
  if (totalWeight <= 0) return null;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

async function computeGradebookStatsMap(db: any, userId: string): Promise<Record<string, any>> {
  const [gbRes, stRes] = await Promise.all([
    db
      .prepare(
        `SELECT id, subject_id, term_id, note_col_count, col_metas_json, styles_json
         FROM teacher_gradebooks
         WHERE user_id = ?`
      )
      .bind(userId)
      .all(),
    db
      .prepare(
        `SELECT gradebook_id, full_name, photo_r2_key, notes_json
         FROM teacher_gradebook_students
         WHERE user_id = ?`
      )
      .bind(userId)
      .all(),
  ]);

  const studentsByGb = new Map<string, any[]>();
  for (const row of stRes.results || []) {
    const list = studentsByGb.get(row.gradebook_id) || [];
    list.push(row);
    studentsByGb.set(row.gradebook_id, list);
  }

  const stats: Record<string, any> = {};
  for (const gb of gbRes.results || []) {
    const key = `${gb.subject_id}__${gb.term_id || 't1'}`;
    const rows = studentsByGb.get(gb.id) || [];
    let namedStudentsCount = 0;
    let photosCount = 0;
    let notesCount = 0;

    for (const st of rows) {
      if (String(st.full_name || '').trim().length > 0) namedStudentsCount++;
      if (st.photo_r2_key) photosCount++;
      const notes = safeParseJson<string[]>(st.notes_json, []);
      if (Array.isArray(notes)) {
        for (const n of notes) {
          if (typeof n === 'string' && n.trim().length > 0) notesCount++;
        }
      }
    }

    const colMetas = safeParseJson<Record<string, any>>(gb.col_metas_json, {});
    const hasCustomMetas = Object.values(colMetas).some(
      (m: any) =>
        m &&
        ((m.title && String(m.title).trim().length > 0) ||
          (typeof m.maxScore === 'number' && m.maxScore !== 20) ||
          (typeof m.coeffEval === 'number' && m.coeffEval !== 1))
    );

    const styles = safeParseJson<any>(gb.styles_json, {});
    const hasFormatting =
      Object.keys(styles?.cellColors || {}).length > 0 ||
      Object.keys(styles?.rowColors || {}).length > 0 ||
      Object.keys(styles?.cellCustomStyles || {}).length > 0 ||
      Object.values(colMetas).some((m: any) => Boolean(m?.headerBgColor || m?.columnBgColor));

    stats[key] = {
      hasStorage: true,
      totalRows: rows.length,
      namedStudentsCount,
      photosCount,
      notesCount,
      noteColumnCount: Math.max(1, Number(gb.note_col_count) || 7),
      hasCustomMetas,
      hasFormatting,
    };
  }
  return stats;
}

async function buildBootstrapPayload(db: any, userId: string, origin: string, jwtSecret: string) {
  const [yearsRes, schoolsRes, levelsRes, classesRes, termsRes, subjectsRes, gradebookStats] = await Promise.all([
    db.prepare('SELECT * FROM teacher_school_years WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all(),
    db.prepare('SELECT * FROM teacher_schools WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all(),
    db.prepare('SELECT * FROM teacher_study_levels WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC').bind(userId).all(),
    db.prepare('SELECT * FROM teacher_classes WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all(),
    db.prepare('SELECT * FROM teacher_terms WHERE user_id = ? ORDER BY number ASC, created_at ASC').bind(userId).all(),
    db.prepare('SELECT * FROM teacher_subjects WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all(),
    computeGradebookStatsMap(db, userId),
  ]);

  const schoolYears = (yearsRes.results || []).map((r: any) => ({
    id: r.id,
    label: r.label,
    color: r.color || '#00313d',
    textColor: r.text_color || '#ffffff',
    createdAt: Number(r.created_at) || Date.now(),
  }));

  const schools = await Promise.all(
    (schoolsRes.results || []).map(async (r: any) => ({
      id: r.id,
      yearId: r.year_id,
      name: r.name,
      logoR2Key: r.logo_r2_key || undefined,
      logoUrl: r.logo_r2_key ? await signTeacherMediaUrl(origin, r.logo_r2_key, jwtSecret) : undefined,
      color: r.color || '#ffffff',
      textColor: r.text_color || '#0f172a',
      borderColor: r.border_color || '#e2e8f0',
      borderDarkColor: r.border_dark_color || '#cbd5e1',
      createdAt: Number(r.created_at) || Date.now(),
    }))
  );

  const studyLevels = (levelsRes.results || []).map((r: any) => ({
    id: r.id,
    schoolId: r.school_id,
    yearId: r.year_id,
    name: r.name,
    color: r.color || '#ffffff',
    textColor: r.text_color || '#0f172a',
    borderColor: r.border_color || '#cbd5e1',
    createdAt: Number(r.created_at) || Date.now(),
  }));

  const classes = (classesRes.results || []).map((r: any) => ({
    id: r.id,
    levelId: r.level_id,
    schoolId: r.school_id,
    yearId: r.year_id,
    level: r.level_name,
    name: r.name || undefined,
    slogan: r.slogan || undefined,
    teacherName: r.teacher_name || '',
    subject: r.subject_label || undefined,
    color: r.color || '#ffffff',
    textColor: r.text_color || '#0f172a',
    borderColor: r.border_color || '#e2e8f0',
    borderDarkColor: r.border_dark_color || '#cbd5e1',
    iconGradient: r.icon_gradient || 'from-amber-500 to-orange-600',
    createdAt: Number(r.created_at) || Date.now(),
  }));

  const terms = (termsRes.results || []).map((r: any) => ({
    id: r.id,
    classId: r.class_id,
    schoolId: r.school_id,
    yearId: r.year_id,
    number: Number(r.number) || 1,
    name: r.name,
    createdAt: Number(r.created_at) || Date.now(),
  }));

  const subjects = (subjectsRes.results || []).map((r: any) => ({
    id: r.id,
    classId: r.class_id,
    termId: r.term_id,
    schoolId: r.school_id,
    yearId: r.year_id,
    name: r.name,
    coefficient: r.coefficient !== null && r.coefficient !== undefined ? Number(r.coefficient) : undefined,
    color: r.color || '#ffffff',
    textColor: r.text_color || '#0f172a',
    borderColor: r.border_color || '#e2e8f0',
    borderDarkColor: r.border_dark_color || '#cbd5e1',
    createdAt: Number(r.created_at) || Date.now(),
  }));

  return {
    success: true,
    userId,
    isEmpty: schoolYears.length === 0 && schools.length === 0,
    schoolYears,
    schools,
    studyLevels,
    classes,
    terms,
    subjects,
    gradebookStats,
  };
}

// ============================================================================
// 3. ROUTEUR PRINCIPAL /api/teacher/*
// ============================================================================

export async function handleTeacherGradebookRoutes(
  request: Request,
  url: URL,
  path: string,
  method: string,
  deps: TeacherWorkerDeps
): Promise<Response | null> {
  if (!path.startsWith('/api/teacher/')) return null;

  const { db, rawEnv, origin, jwtSecret, getAuthUser, corsHeaders, jsonResponse, errorResponse } = deps;

  if (!db) {
    return errorResponse('Base de données D1 non disponible.', 503, origin);
  }

  // --------------------------------------------------------------------------
  // ROUTE PRIVÉE DE LECTURE DES MÉDIAS R2 (Photos profil élèves & Logos écoles)
  // GET /api/teacher/media?key=...&exp=...&sig=... (ou Authorization: Bearer)
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/media' && method === 'GET') {
    const key = url.searchParams.get('key') || '';
    const ownerSegment = extractOwnerSegmentFromR2Key(key);
    if (!ownerSegment) {
      return errorResponse('Clé média invalide.', 400, origin);
    }

    let authorized = false;
    const sig = url.searchParams.get('sig') || '';
    const exp = url.searchParams.get('exp') || '';
    if (sig && exp) {
      authorized = await verifyTeacherMediaSignature(key, exp, sig, jwtSecret);
    }
    if (!authorized) {
      const authUser = await getAuthUser(request);
      if (authUser?.userId && sanitizeSegment(String(authUser.userId)) === ownerSegment) {
        authorized = true;
      }
    }
    if (!authorized) {
      return errorResponse('Accès non autorisé à cette photo.', 403, origin);
    }

    const bucket = getTeacherPhotosBucket(rawEnv);
    const fallback = getFallbackMainBucket(rawEnv);
    let obj = bucket ? await bucket.get(key) : null;
    if (!obj && fallback && fallback !== bucket) {
      obj = await fallback.get(key);
    }
    if (!obj) {
      return errorResponse('Image introuvable.', 404, origin);
    }

    const contentType = obj.httpMetadata?.contentType || 'image/webp';
    return new Response(obj.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        ...corsHeaders(origin),
      },
    });
  }

  // --------------------------------------------------------------------------
  // AUTHENTIFICATION JWT STRICTE OBLIGATOIRE POUR TOUTES LES AUTRES ROUTES
  // --------------------------------------------------------------------------
  const authUser = await getAuthUser(request);
  if (!authUser || !authUser.userId) {
    return errorResponse('Authentification requise. Veuillez vous reconnecter.', 401, origin);
  }
  const userId = String(authUser.userId);
  const apiOrigin = url.origin;

  await ensureTeacherGradebookTables(db);

  // --------------------------------------------------------------------------
  // 1. BOOTSTRAP COMPLET DU COMPTE
  // GET /api/teacher/bootstrap
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/bootstrap' && method === 'GET') {
    const payload = await buildBootstrapPayload(db, userId, apiOrigin, jwtSecret);
    return jsonResponse(payload, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 2. ANNÉES SCOLAIRES (POST /api/teacher/years, DELETE /api/teacher/years/:id)
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/years' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const label = String(body.label || '').trim().slice(0, 30);
    if (!label) return errorResponse('Libellé d’année scolaire requis.', 400, origin);

    const existing = await db
      .prepare('SELECT * FROM teacher_school_years WHERE user_id = ? AND LOWER(label) = LOWER(?) LIMIT 1')
      .bind(userId, label)
      .first();
    if (existing) {
      return jsonResponse({
        success: true,
        year: {
          id: existing.id,
          label: existing.label,
          color: existing.color,
          textColor: existing.text_color,
          createdAt: Number(existing.created_at),
        },
      }, 200, origin);
    }

    const now = Date.now();
    const id = await resolveSafeNewId(db, 'teacher_school_years', body.id, 'year');
    const color = String(body.color || '#00313d').slice(0, 32);
    const textColor = String(body.textColor || '#ffffff').slice(0, 32);

    await db
      .prepare(
        `INSERT INTO teacher_school_years (id, user_id, label, color, text_color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, label, color, textColor, now, now)
      .run();

    return jsonResponse({
      success: true,
      year: { id, label, color, textColor, createdAt: now },
    }, 201, origin);
  }

  const yearItemMatch = path.match(/^\/api\/teacher\/years\/([^/]+)$/);
  if (yearItemMatch && method === 'PUT') {
    const yearId = decodeURIComponent(yearItemMatch[1]);
    const existing: any = await db
      .prepare('SELECT * FROM teacher_school_years WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(yearId, userId)
      .first();
    if (!existing) return errorResponse('Année scolaire introuvable.', 404, origin);

    const body: any = await request.json().catch(() => ({}));
    const label = String(body.label ?? existing.label ?? '').trim().slice(0, 30);
    if (!label) return errorResponse('Libellé d’année scolaire requis.', 400, origin);

    const duplicate: any = await db
      .prepare('SELECT id FROM teacher_school_years WHERE user_id = ? AND id != ? AND LOWER(label) = LOWER(?) LIMIT 1')
      .bind(userId, yearId, label)
      .first();
    if (duplicate) {
      return errorResponse('Une rentrée scolaire portant ce nom existe déjà.', 409, origin);
    }

    const color = String(body.color || existing.color || '#00313d').slice(0, 32);
    const textColor = String(body.textColor || existing.text_color || '#ffffff').slice(0, 32);
    const now = Date.now();

    await db
      .prepare(
        `UPDATE teacher_school_years
         SET label = ?, color = ?, text_color = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(label, color, textColor, now, yearId, userId)
      .run();

    return jsonResponse({
      success: true,
      year: {
        id: yearId,
        label,
        color,
        textColor,
        createdAt: Number(existing.created_at),
      },
    }, 200, origin);
  }

  if (yearItemMatch && method === 'DELETE') {
    const yearId = decodeURIComponent(yearItemMatch[1]);
    const own = await db
      .prepare('SELECT id FROM teacher_school_years WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(yearId, userId)
      .first();
    if (!own) return errorResponse('Année scolaire introuvable.', 404, origin);

    // Collecter toutes les clés R2 liées (logos écoles + photos élèves) avant suppression
    const [schoolLogos, studentPhotos] = await Promise.all([
      db.prepare('SELECT logo_r2_key FROM teacher_schools WHERE year_id = ? AND user_id = ? AND logo_r2_key IS NOT NULL').bind(yearId, userId).all(),
      db.prepare(
        `SELECT s.photo_r2_key
         FROM teacher_gradebook_students s
         JOIN teacher_gradebooks g ON g.id = s.gradebook_id
         WHERE g.year_id = ? AND s.user_id = ? AND s.photo_r2_key IS NOT NULL`
      ).bind(yearId, userId).all(),
    ]);

    const r2Keys = [
      ...(schoolLogos.results || []).map((r: any) => r.logo_r2_key),
      ...(studentPhotos.results || []).map((r: any) => r.photo_r2_key),
    ];

    await db.batch([
      db.prepare(`DELETE FROM teacher_gradebook_students WHERE user_id = ? AND gradebook_id IN (SELECT id FROM teacher_gradebooks WHERE year_id = ? AND user_id = ?)`).bind(userId, yearId, userId),
      db.prepare('DELETE FROM teacher_gradebooks WHERE year_id = ? AND user_id = ?').bind(yearId, userId),
      db.prepare('DELETE FROM teacher_subjects WHERE year_id = ? AND user_id = ?').bind(yearId, userId),
      db.prepare('DELETE FROM teacher_terms WHERE year_id = ? AND user_id = ?').bind(yearId, userId),
      db.prepare('DELETE FROM teacher_classes WHERE year_id = ? AND user_id = ?').bind(yearId, userId),
      db.prepare('DELETE FROM teacher_study_levels WHERE year_id = ? AND user_id = ?').bind(yearId, userId),
      db.prepare('DELETE FROM teacher_schools WHERE year_id = ? AND user_id = ?').bind(yearId, userId),
      db.prepare('DELETE FROM teacher_school_years WHERE id = ? AND user_id = ?').bind(yearId, userId),
    ]);

    await deleteOwnedR2Keys(rawEnv, userId, r2Keys);
    return jsonResponse({ success: true, deletedId: yearId }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 3. ÉTABLISSEMENTS SCOLAIRES (POST, PUT, DELETE + logo R2)
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/schools' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim().slice(0, 120);
    const yearId = String(body.yearId || '').trim();
    if (!name || !yearId) return errorResponse('Nom de l’école et année scolaire requis.', 400, origin);

    const ownYear = await db
      .prepare('SELECT id FROM teacher_school_years WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(yearId, userId)
      .first();
    if (!ownYear) return errorResponse('Année scolaire non autorisée ou introuvable.', 404, origin);

    const now = Date.now();
    const id = await resolveSafeNewId(db, 'teacher_schools', body.id, 'school');
    let logoR2Key: string | null = null;

    if (typeof body.logoDataUrl === 'string' && body.logoDataUrl.startsWith('data:image/')) {
      const bytes = decodeBase64DataUrl(body.logoDataUrl);
      const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
      if (!bytes || !fmt) return errorResponse('Format de logo invalide (PNG/JPEG/WebP, max 600 Ko).', 400, origin);
      const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      logoR2Key = `teacher-school-logos/${sanitizeSegment(userId)}/${sanitizeSegment(id)}_${now}_${rand}.${fmt.ext}`;
      await uploadImageBytesToR2(rawEnv, logoR2Key, bytes, fmt.contentType, {
        userId: sanitizeSegment(userId),
        kind: 'school_logo',
        schoolId: sanitizeSegment(id),
      });
    }

    const color = String(body.color || '#ffffff').slice(0, 32);
    const textColor = String(body.textColor || '#0f172a').slice(0, 32);
    const borderColor = String(body.borderColor || '#e2e8f0').slice(0, 32);
    const borderDarkColor = String(body.borderDarkColor || '#cbd5e1').slice(0, 32);

    await db
      .prepare(
        `INSERT INTO teacher_schools
          (id, user_id, year_id, name, logo_r2_key, color, text_color, border_color, border_dark_color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, yearId, name, logoR2Key, color, textColor, borderColor, borderDarkColor, now, now)
      .run();

    const logoUrl = logoR2Key ? await signTeacherMediaUrl(apiOrigin, logoR2Key, jwtSecret) : undefined;
    return jsonResponse({
      success: true,
      school: {
        id,
        yearId,
        name,
        logoR2Key: logoR2Key || undefined,
        logoUrl,
        color,
        textColor,
        borderColor,
        borderDarkColor,
        createdAt: now,
      },
    }, 201, origin);
  }

  const schoolItemMatch = path.match(/^\/api\/teacher\/schools\/([^/]+)$/);
  if (schoolItemMatch && method === 'PUT') {
    const schoolId = decodeURIComponent(schoolItemMatch[1]);
    const existing: any = await db
      .prepare('SELECT * FROM teacher_schools WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(schoolId, userId)
      .first();
    if (!existing) return errorResponse('Établissement introuvable.', 404, origin);

    const body: any = await request.json().catch(() => ({}));
    const name = String(body.name || existing.name).trim().slice(0, 120);
    if (!name) return errorResponse('Le nom de l’école ne peut pas être vide.', 400, origin);

    const now = Date.now();
    let logoR2Key: string | null = existing.logo_r2_key || null;
    let oldKeyToDelete: string | null = null;

    if (body.removeLogo === true) {
      oldKeyToDelete = logoR2Key;
      logoR2Key = null;
    } else if (typeof body.logoDataUrl === 'string' && body.logoDataUrl.startsWith('data:image/')) {
      const bytes = decodeBase64DataUrl(body.logoDataUrl);
      const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
      if (!bytes || !fmt) return errorResponse('Format de logo invalide (PNG/JPEG/WebP, max 600 Ko).', 400, origin);
      const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      const newKey = `teacher-school-logos/${sanitizeSegment(userId)}/${sanitizeSegment(schoolId)}_${now}_${rand}.${fmt.ext}`;
      await uploadImageBytesToR2(rawEnv, newKey, bytes, fmt.contentType, {
        userId: sanitizeSegment(userId),
        kind: 'school_logo',
        schoolId: sanitizeSegment(schoolId),
      });
      oldKeyToDelete = logoR2Key;
      logoR2Key = newKey;
    }

    const color = String(body.color || existing.color).slice(0, 32);
    const textColor = String(body.textColor || existing.text_color).slice(0, 32);
    const borderColor = String(body.borderColor || existing.border_color).slice(0, 32);
    const borderDarkColor = String(body.borderDarkColor || existing.border_dark_color).slice(0, 32);

    await db
      .prepare(
        `UPDATE teacher_schools
         SET name = ?, logo_r2_key = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(name, logoR2Key, color, textColor, borderColor, borderDarkColor, now, schoolId, userId)
      .run();

    if (oldKeyToDelete && oldKeyToDelete !== logoR2Key) {
      await deleteOwnedR2Keys(rawEnv, userId, [oldKeyToDelete]);
    }

    const logoUrl = logoR2Key ? await signTeacherMediaUrl(apiOrigin, logoR2Key, jwtSecret) : undefined;
    return jsonResponse({
      success: true,
      school: {
        id: schoolId,
        yearId: existing.year_id,
        name,
        logoR2Key: logoR2Key || undefined,
        logoUrl,
        color,
        textColor,
        borderColor,
        borderDarkColor,
        createdAt: Number(existing.created_at),
      },
    }, 200, origin);
  }

  if (schoolItemMatch && method === 'DELETE') {
    const schoolId = decodeURIComponent(schoolItemMatch[1]);
    const existing: any = await db
      .prepare('SELECT id, logo_r2_key FROM teacher_schools WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(schoolId, userId)
      .first();
    if (!existing) return errorResponse('Établissement introuvable.', 404, origin);

    const studentPhotos = await db
      .prepare(
        `SELECT s.photo_r2_key
         FROM teacher_gradebook_students s
         JOIN teacher_gradebooks g ON g.id = s.gradebook_id
         WHERE g.school_id = ? AND s.user_id = ? AND s.photo_r2_key IS NOT NULL`
      )
      .bind(schoolId, userId)
      .all();

    const r2Keys = [
      existing.logo_r2_key,
      ...(studentPhotos.results || []).map((r: any) => r.photo_r2_key),
    ];

    await db.batch([
      db.prepare(`DELETE FROM teacher_gradebook_students WHERE user_id = ? AND gradebook_id IN (SELECT id FROM teacher_gradebooks WHERE school_id = ? AND user_id = ?)`).bind(userId, schoolId, userId),
      db.prepare('DELETE FROM teacher_gradebooks WHERE school_id = ? AND user_id = ?').bind(schoolId, userId),
      db.prepare('DELETE FROM teacher_subjects WHERE school_id = ? AND user_id = ?').bind(schoolId, userId),
      db.prepare('DELETE FROM teacher_terms WHERE school_id = ? AND user_id = ?').bind(schoolId, userId),
      db.prepare('DELETE FROM teacher_classes WHERE school_id = ? AND user_id = ?').bind(schoolId, userId),
      db.prepare('DELETE FROM teacher_study_levels WHERE school_id = ? AND user_id = ?').bind(schoolId, userId),
      db.prepare('DELETE FROM teacher_schools WHERE id = ? AND user_id = ?').bind(schoolId, userId),
    ]);

    await deleteOwnedR2Keys(rawEnv, userId, r2Keys);
    return jsonResponse({ success: true, deletedId: schoolId }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 4. NIVEAUX D'ÉTUDE (POST, PUT, DELETE)
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/levels' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const schoolId = String(body.schoolId || '').trim();
    const name = String(body.name || '').trim().slice(0, 80);
    if (!schoolId || !name) return errorResponse('École et nom du niveau requis.', 400, origin);

    const ownSchool: any = await db
      .prepare('SELECT id, year_id FROM teacher_schools WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(schoolId, userId)
      .first();
    if (!ownSchool) return errorResponse('Établissement introuvable ou non autorisé.', 404, origin);

    const now = Date.now();
    const id = await resolveSafeNewId(db, 'teacher_study_levels', body.id, 'level');
    const color = String(body.color || '#ffffff').slice(0, 32);
    const textColor = String(body.textColor || '#0f172a').slice(0, 32);
    const borderColor = String(body.borderColor || '#cbd5e1').slice(0, 32);

    await db
      .prepare(
        `INSERT INTO teacher_study_levels (id, user_id, school_id, year_id, name, color, text_color, border_color, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, schoolId, ownSchool.year_id, name, color, textColor, borderColor, Number(body.sortOrder) || 0, now, now)
      .run();

    return jsonResponse({
      success: true,
      level: {
        id,
        schoolId,
        yearId: ownSchool.year_id,
        name,
        color,
        textColor,
        borderColor,
        createdAt: now,
      },
    }, 201, origin);
  }

  const levelItemMatch = path.match(/^\/api\/teacher\/levels\/([^/]+)$/);
  if (levelItemMatch && method === 'PUT') {
    const levelId = decodeURIComponent(levelItemMatch[1]);
    const existing: any = await db
      .prepare('SELECT * FROM teacher_study_levels WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(levelId, userId)
      .first();
    if (!existing) return errorResponse('Niveau d’étude introuvable.', 404, origin);

    const body: any = await request.json().catch(() => ({}));
    const name = String(body.name || existing.name).trim().slice(0, 80);
    if (!name) return errorResponse('Nom du niveau requis.', 400, origin);

    const now = Date.now();
    const color = String(body.color || existing.color || '#ffffff').slice(0, 32);
    const textColor = String(body.textColor || existing.text_color || '#0f172a').slice(0, 32);
    const borderColor = String(body.borderColor || existing.border_color || '#cbd5e1').slice(0, 32);

    await db.batch([
      db
        .prepare(
          `UPDATE teacher_study_levels
           SET name = ?, color = ?, text_color = ?, border_color = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .bind(name, color, textColor, borderColor, now, levelId, userId),
      db
        .prepare(
          `UPDATE teacher_classes
           SET level_name = ?, updated_at = ?
           WHERE level_id = ? AND user_id = ?`
        )
        .bind(name, now, levelId, userId),
    ]);

    return jsonResponse({
      success: true,
      level: {
        id: levelId,
        schoolId: existing.school_id,
        yearId: existing.year_id,
        name,
        color,
        textColor,
        borderColor,
        createdAt: Number(existing.created_at),
      },
    }, 200, origin);
  }

  if (levelItemMatch && method === 'DELETE') {
    const levelId = decodeURIComponent(levelItemMatch[1]);
    const existing: any = await db
      .prepare('SELECT id FROM teacher_study_levels WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(levelId, userId)
      .first();
    if (!existing) return errorResponse('Niveau d’étude introuvable.', 404, origin);

    const studentPhotos = await db
      .prepare(
        `SELECT s.photo_r2_key
         FROM teacher_gradebook_students s
         JOIN teacher_classes c ON c.id = s.class_id
         WHERE c.level_id = ? AND s.user_id = ? AND s.photo_r2_key IS NOT NULL`
      )
      .bind(levelId, userId)
      .all();

    const r2Keys = (studentPhotos.results || []).map((r: any) => r.photo_r2_key);

    await db.batch([
      db.prepare(`DELETE FROM teacher_gradebook_students WHERE user_id = ? AND class_id IN (SELECT id FROM teacher_classes WHERE level_id = ? AND user_id = ?)`).bind(userId, levelId, userId),
      db.prepare(`DELETE FROM teacher_gradebooks WHERE user_id = ? AND class_id IN (SELECT id FROM teacher_classes WHERE level_id = ? AND user_id = ?)`).bind(userId, levelId, userId),
      db.prepare(`DELETE FROM teacher_subjects WHERE user_id = ? AND class_id IN (SELECT id FROM teacher_classes WHERE level_id = ? AND user_id = ?)`).bind(userId, levelId, userId),
      db.prepare(`DELETE FROM teacher_terms WHERE user_id = ? AND class_id IN (SELECT id FROM teacher_classes WHERE level_id = ? AND user_id = ?)`).bind(userId, levelId, userId),
      db.prepare('DELETE FROM teacher_classes WHERE level_id = ? AND user_id = ?').bind(levelId, userId),
      db.prepare('DELETE FROM teacher_study_levels WHERE id = ? AND user_id = ?').bind(levelId, userId),
    ]);

    await deleteOwnedR2Keys(rawEnv, userId, r2Keys);
    return jsonResponse({ success: true, deletedId: levelId }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 5. CLASSES (POST crée aussi les 3 trimestres par défaut, PUT, DELETE)
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/classes' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const levelId = String(body.levelId || '').trim();
    const name = String(body.name || '').trim().slice(0, 80);
    const teacherName = String(body.teacherName || '').trim().slice(0, 100);
    if (!levelId || !name || !teacherName) {
      return errorResponse('Niveau d’étude, nom de classe et professeur requis.', 400, origin);
    }

    const ownLevel: any = await db
      .prepare('SELECT id, school_id, year_id, name FROM teacher_study_levels WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(levelId, userId)
      .first();
    if (!ownLevel) return errorResponse('Niveau d’étude introuvable ou non autorisé.', 404, origin);

    const now = Date.now();
    const classId = await resolveSafeNewId(db, 'teacher_classes', body.id, 'class');
    const slogan = body.slogan ? String(body.slogan).trim().slice(0, 140) : null;
    const color = String(body.color || '#ffffff').slice(0, 32);
    const textColor = String(body.textColor || '#0f172a').slice(0, 32);
    const borderColor = String(body.borderColor || '#e2e8f0').slice(0, 32);
    const borderDarkColor = String(body.borderDarkColor || '#cbd5e1').slice(0, 32);
    const iconGradient = String(body.iconGradient || 'from-amber-500 to-orange-600').slice(0, 80);

    const defaultTerms = Array.isArray(body.defaultTerms) && body.defaultTerms.length > 0
      ? body.defaultTerms.slice(0, 12).map((t: any, idx: number) => ({
          id: t.id && typeof t.id === 'string' && t.id.length <= 80 ? t.id : `term-${classId}-${idx + 1}`,
          number: Number(t.number) || idx + 1,
          name: String(t.name || `Trimestre ${idx + 1}`).trim().slice(0, 40),
          createdAt: now + idx,
        }))
      : [
          { id: `term-${classId}-1`, number: 1, name: 'Trimestre 1', createdAt: now },
          { id: `term-${classId}-2`, number: 2, name: 'Trimestre 2', createdAt: now + 1 },
          { id: `term-${classId}-3`, number: 3, name: 'Trimestre 3', createdAt: now + 2 },
        ];

    const stmts = [
      db
        .prepare(
          `INSERT INTO teacher_classes
            (id, user_id, level_id, school_id, year_id, level_name, name, slogan, teacher_name, subject_label, color, text_color, border_color, border_dark_color, icon_gradient, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          classId, userId, levelId, ownLevel.school_id, ownLevel.year_id,
          ownLevel.name, name, slogan, teacherName,
          color, textColor, borderColor, borderDarkColor, iconGradient,
          now, now
        ),
      ...defaultTerms.map((t: any) =>
        db
          .prepare(
            `INSERT INTO teacher_terms (id, user_id, class_id, school_id, year_id, number, name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(t.id, userId, classId, ownLevel.school_id, ownLevel.year_id, t.number, t.name, t.createdAt, now)
      ),
    ];

    await db.batch(stmts);

    return jsonResponse({
      success: true,
      classItem: {
        id: classId,
        levelId,
        schoolId: ownLevel.school_id,
        yearId: ownLevel.year_id,
        level: ownLevel.name,
        name,
        slogan: slogan || undefined,
        teacherName,
        color,
        textColor,
        borderColor,
        borderDarkColor,
        iconGradient,
        createdAt: now,
      },
      terms: defaultTerms.map((t: any) => ({
        id: t.id,
        classId,
        schoolId: ownLevel.school_id,
        yearId: ownLevel.year_id,
        number: t.number,
        name: t.name,
        createdAt: t.createdAt,
      })),
    }, 201, origin);
  }

  const classItemMatch = path.match(/^\/api\/teacher\/classes\/([^/]+)$/);
  if (classItemMatch && method === 'PUT') {
    const classId = decodeURIComponent(classItemMatch[1]);
    const existing: any = await db
      .prepare('SELECT * FROM teacher_classes WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(classId, userId)
      .first();
    if (!existing) return errorResponse('Classe introuvable.', 404, origin);

    const body: any = await request.json().catch(() => ({}));
    const name = String(body.name ?? existing.name ?? '').trim().slice(0, 80);
    const teacherName = String(body.teacherName ?? existing.teacher_name ?? '').trim().slice(0, 100);
    const slogan = body.slogan !== undefined ? (String(body.slogan).trim().slice(0, 140) || null) : existing.slogan;
    const color = String(body.color || existing.color).slice(0, 32);
    const textColor = String(body.textColor || existing.text_color).slice(0, 32);
    const borderColor = String(body.borderColor || existing.border_color).slice(0, 32);
    const borderDarkColor = String(body.borderDarkColor || existing.border_dark_color).slice(0, 32);
    const iconGradient = String(body.iconGradient || existing.icon_gradient).slice(0, 80);
    const now = Date.now();

    await db
      .prepare(
        `UPDATE teacher_classes
         SET name = ?, slogan = ?, teacher_name = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, icon_gradient = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(name, slogan, teacherName, color, textColor, borderColor, borderDarkColor, iconGradient, now, classId, userId)
      .run();

    return jsonResponse({
      success: true,
      classItem: {
        id: classId,
        levelId: existing.level_id,
        schoolId: existing.school_id,
        yearId: existing.year_id,
        level: existing.level_name,
        name: name || undefined,
        slogan: slogan || undefined,
        teacherName,
        color,
        textColor,
        borderColor,
        borderDarkColor,
        iconGradient,
        createdAt: Number(existing.created_at),
      },
    }, 200, origin);
  }

  if (classItemMatch && method === 'DELETE') {
    const classId = decodeURIComponent(classItemMatch[1]);
    const existing: any = await db
      .prepare('SELECT id FROM teacher_classes WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(classId, userId)
      .first();
    if (!existing) return errorResponse('Classe introuvable.', 404, origin);

    const studentPhotos = await db
      .prepare('SELECT photo_r2_key FROM teacher_gradebook_students WHERE class_id = ? AND user_id = ? AND photo_r2_key IS NOT NULL')
      .bind(classId, userId)
      .all();
    const r2Keys = (studentPhotos.results || []).map((r: any) => r.photo_r2_key);

    await db.batch([
      db.prepare('DELETE FROM teacher_gradebook_students WHERE class_id = ? AND user_id = ?').bind(classId, userId),
      db.prepare('DELETE FROM teacher_gradebooks WHERE class_id = ? AND user_id = ?').bind(classId, userId),
      db.prepare('DELETE FROM teacher_subjects WHERE class_id = ? AND user_id = ?').bind(classId, userId),
      db.prepare('DELETE FROM teacher_terms WHERE class_id = ? AND user_id = ?').bind(classId, userId),
      db.prepare('DELETE FROM teacher_classes WHERE id = ? AND user_id = ?').bind(classId, userId),
    ]);

    await deleteOwnedR2Keys(rawEnv, userId, r2Keys);
    return jsonResponse({ success: true, deletedId: classId }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 6. TRIMESTRES (POST, DELETE)
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/terms' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const classId = String(body.classId || '').trim();
    const name = String(body.name || '').trim().slice(0, 50);
    const number = Math.max(1, parseInt(String(body.number || 1), 10) || 1);
    if (!classId || !name) return errorResponse('Classe et nom du trimestre requis.', 400, origin);

    const ownClass: any = await db
      .prepare('SELECT id, school_id, year_id FROM teacher_classes WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(classId, userId)
      .first();
    if (!ownClass) return errorResponse('Classe introuvable ou non autorisée.', 404, origin);

    const now = Date.now();
    const id = await resolveSafeNewId(db, 'teacher_terms', body.id, 'term');

    await db
      .prepare(
        `INSERT INTO teacher_terms (id, user_id, class_id, school_id, year_id, number, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, classId, ownClass.school_id, ownClass.year_id, number, name, now, now)
      .run();

    return jsonResponse({
      success: true,
      term: {
        id,
        classId,
        schoolId: ownClass.school_id,
        yearId: ownClass.year_id,
        number,
        name,
        createdAt: now,
      },
    }, 201, origin);
  }

  const termDeleteMatch = path.match(/^\/api\/teacher\/terms\/([^/]+)$/);
  if (termDeleteMatch && method === 'DELETE') {
    const termId = decodeURIComponent(termDeleteMatch[1]);
    const ownTerm: any = await db
      .prepare('SELECT id FROM teacher_terms WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(termId, userId)
      .first();
    if (!ownTerm) return errorResponse('Trimestre introuvable.', 404, origin);

    const studentPhotos = await db
      .prepare('SELECT photo_r2_key FROM teacher_gradebook_students WHERE term_id = ? AND user_id = ? AND photo_r2_key IS NOT NULL')
      .bind(termId, userId)
      .all();
    const r2Keys = (studentPhotos.results || []).map((r: any) => r.photo_r2_key);

    await db.batch([
      db.prepare('DELETE FROM teacher_gradebook_students WHERE term_id = ? AND user_id = ?').bind(termId, userId),
      db.prepare('DELETE FROM teacher_gradebooks WHERE term_id = ? AND user_id = ?').bind(termId, userId),
      db.prepare('DELETE FROM teacher_subjects WHERE term_id = ? AND user_id = ?').bind(termId, userId),
      db.prepare('DELETE FROM teacher_terms WHERE id = ? AND user_id = ?').bind(termId, userId),
    ]);

    await deleteOwnedR2Keys(rawEnv, userId, r2Keys);
    return jsonResponse({ success: true, deletedId: termId }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 7. MATIÈRES (POST, PUT, DELETE)
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/subjects' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const classId = String(body.classId || '').trim();
    const termId = String(body.termId || '').trim();
    const name = String(body.name || '').trim().slice(0, 100);
    if (!classId || !termId || !name) return errorResponse('Classe, trimestre et nom de matière requis.', 400, origin);

    const [ownClass, ownTerm] = await Promise.all([
      db.prepare('SELECT id, school_id, year_id FROM teacher_classes WHERE id = ? AND user_id = ? LIMIT 1').bind(classId, userId).first(),
      db.prepare('SELECT id, class_id FROM teacher_terms WHERE id = ? AND user_id = ? LIMIT 1').bind(termId, userId).first(),
    ]);
    if (!ownClass || !ownTerm || ownTerm.class_id !== ownClass.id) {
      return errorResponse('Classe ou trimestre introuvable ou non cohérent.', 404, origin);
    }

    const now = Date.now();
    const id = await resolveSafeNewId(db, 'teacher_subjects', body.id, 'subject');
    const coeffRaw = body.coefficient !== undefined && body.coefficient !== null && body.coefficient !== '' ? Number(body.coefficient) : null;
    const coefficient = coeffRaw !== null && Number.isFinite(coeffRaw) ? coeffRaw : null;
    const color = String(body.color || '#ffffff').slice(0, 32);
    const textColor = String(body.textColor || '#0f172a').slice(0, 32);
    const borderColor = String(body.borderColor || '#e2e8f0').slice(0, 32);
    const borderDarkColor = String(body.borderDarkColor || '#cbd5e1').slice(0, 32);

    await db
      .prepare(
        `INSERT INTO teacher_subjects
          (id, user_id, class_id, term_id, school_id, year_id, name, coefficient, color, text_color, border_color, border_dark_color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, classId, termId, ownClass.school_id, ownClass.year_id, name, coefficient, color, textColor, borderColor, borderDarkColor, now, now)
      .run();

    return jsonResponse({
      success: true,
      subject: {
        id,
        classId,
        termId,
        schoolId: ownClass.school_id,
        yearId: ownClass.year_id,
        name,
        coefficient: coefficient ?? undefined,
        color,
        textColor,
        borderColor,
        borderDarkColor,
        createdAt: now,
      },
    }, 201, origin);
  }

  const subjectItemMatch = path.match(/^\/api\/teacher\/subjects\/([^/]+)$/);
  if (subjectItemMatch && method === 'PUT') {
    const subjectId = decodeURIComponent(subjectItemMatch[1]);
    const existing: any = await db
      .prepare('SELECT * FROM teacher_subjects WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(subjectId, userId)
      .first();
    if (!existing) return errorResponse('Matière introuvable.', 404, origin);

    const body: any = await request.json().catch(() => ({}));
    const name = String(body.name ?? existing.name).trim().slice(0, 100);
    if (!name) return errorResponse('Nom de matière requis.', 400, origin);

    let coefficient: number | null = existing.coefficient;
    if (body.coefficient !== undefined) {
      if (body.coefficient === null || body.coefficient === '') coefficient = null;
      else {
        const parsed = Number(body.coefficient);
        coefficient = Number.isFinite(parsed) ? parsed : existing.coefficient;
      }
    }

    const color = String(body.color || existing.color).slice(0, 32);
    const textColor = String(body.textColor || existing.text_color).slice(0, 32);
    const borderColor = String(body.borderColor || existing.border_color).slice(0, 32);
    const borderDarkColor = String(body.borderDarkColor || existing.border_dark_color).slice(0, 32);
    const now = Date.now();

    await db
      .prepare(
        `UPDATE teacher_subjects
         SET name = ?, coefficient = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(name, coefficient, color, textColor, borderColor, borderDarkColor, now, subjectId, userId)
      .run();

    return jsonResponse({
      success: true,
      subject: {
        id: subjectId,
        classId: existing.class_id,
        termId: existing.term_id,
        schoolId: existing.school_id,
        yearId: existing.year_id,
        name,
        coefficient: coefficient ?? undefined,
        color,
        textColor,
        borderColor,
        borderDarkColor,
        createdAt: Number(existing.created_at),
      },
    }, 200, origin);
  }

  if (subjectItemMatch && method === 'DELETE') {
    const subjectId = decodeURIComponent(subjectItemMatch[1]);
    const existing: any = await db
      .prepare('SELECT id FROM teacher_subjects WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(subjectId, userId)
      .first();
    if (!existing) return errorResponse('Matière introuvable.', 404, origin);

    const studentPhotos = await db
      .prepare('SELECT photo_r2_key FROM teacher_gradebook_students WHERE subject_id = ? AND user_id = ? AND photo_r2_key IS NOT NULL')
      .bind(subjectId, userId)
      .all();
    const r2Keys = (studentPhotos.results || []).map((r: any) => r.photo_r2_key);

    await db.batch([
      db.prepare('DELETE FROM teacher_gradebook_students WHERE subject_id = ? AND user_id = ?').bind(subjectId, userId),
      db.prepare('DELETE FROM teacher_gradebooks WHERE subject_id = ? AND user_id = ?').bind(subjectId, userId),
      db.prepare('DELETE FROM teacher_subjects WHERE id = ? AND user_id = ?').bind(subjectId, userId),
    ]);

    await deleteOwnedR2Keys(rawEnv, userId, r2Keys);
    return jsonResponse({ success: true, deletedId: subjectId }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 8. TABLEUR DE NOTES (GET & PUT /api/teacher/gradebook/:subjectId/:termId)
  // --------------------------------------------------------------------------
  const gradebookMatch = path.match(/^\/api\/teacher\/gradebook\/([^/]+)\/([^/]+)$/);
  if (gradebookMatch && method === 'GET') {
    const subjectId = decodeURIComponent(gradebookMatch[1]);
    const termId = decodeURIComponent(gradebookMatch[2]);

    const ownSubject: any = await db
      .prepare('SELECT id, class_id, school_id, year_id FROM teacher_subjects WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(subjectId, userId)
      .first();
    if (!ownSubject) return errorResponse('Matière introuvable ou non autorisée.', 404, origin);

    const gb: any = await db
      .prepare('SELECT * FROM teacher_gradebooks WHERE user_id = ? AND subject_id = ? AND term_id = ? LIMIT 1')
      .bind(userId, subjectId, termId)
      .first();

    if (!gb) {
      return jsonResponse({
        success: true,
        exists: false,
        version: 0,
        noteColumnCount: 7,
        columnMetas: {},
        layout: {},
        styles: {},
        students: [],
      }, 200, origin);
    }

    const stRes = await db
      .prepare(
        `SELECT * FROM teacher_gradebook_students
         WHERE user_id = ? AND gradebook_id = ?
         ORDER BY row_order ASC, created_at ASC`
      )
      .bind(userId, gb.id)
      .all();

    const students = await Promise.all(
      (stRes.results || []).map(async (row: any) => ({
        id: row.id,
        studentUid: row.student_uid || row.id,
        name: row.full_name || '',
        photoR2Key: row.photo_r2_key || undefined,
        photoUrl: row.photo_r2_key ? await signTeacherMediaUrl(apiOrigin, row.photo_r2_key, jwtSecret) : undefined,
        notes: safeParseJson<string[]>(row.notes_json, []),
      }))
    );

    return jsonResponse({
      success: true,
      exists: true,
      gradebookId: gb.id,
      version: Number(gb.version) || 1,
      updatedAt: Number(gb.updated_at) || Date.now(),
      noteColumnCount: Math.max(1, Number(gb.note_col_count) || 7),
      columnMetas: safeParseJson(gb.col_metas_json, {}),
      layout: safeParseJson(gb.layout_json, {}),
      styles: safeParseJson(gb.styles_json, {}),
      students,
    }, 200, origin);
  }

  if (gradebookMatch && method === 'PUT') {
    const subjectId = decodeURIComponent(gradebookMatch[1]);
    const termId = decodeURIComponent(gradebookMatch[2]);

    const [ownSubject, ownTerm] = await Promise.all([
      db.prepare('SELECT id, class_id, school_id, year_id FROM teacher_subjects WHERE id = ? AND user_id = ? LIMIT 1').bind(subjectId, userId).first(),
      db.prepare('SELECT id, class_id FROM teacher_terms WHERE id = ? AND user_id = ? LIMIT 1').bind(termId, userId).first(),
    ]);
    if (!ownSubject) return errorResponse('Matière introuvable ou non autorisée.', 404, origin);
    if (!ownTerm || ownTerm.class_id !== ownSubject.class_id) {
      return errorResponse('Trimestre invalide pour cette matière.', 400, origin);
    }

    const body: any = await request.json().catch(() => ({}));
    const noteColumnCount = Math.min(200, Math.max(1, parseInt(String(body.noteColumnCount ?? 7), 10) || 7));
    const columnMetas = typeof body.columnMetas === 'object' && body.columnMetas !== null ? body.columnMetas : {};
    const layout = typeof body.layout === 'object' && body.layout !== null ? body.layout : {};
    const styles = typeof body.styles === 'object' && body.styles !== null ? body.styles : {};
    const incomingStudents: any[] = Array.isArray(body.students) ? body.students.slice(0, 600) : [];

    const now = Date.now();
    const existingGb: any = await db
      .prepare('SELECT id, version FROM teacher_gradebooks WHERE user_id = ? AND subject_id = ? AND term_id = ? LIMIT 1')
      .bind(userId, subjectId, termId)
      .first();

    const gradebookId = existingGb ? existingGb.id : makeId('gb');
    const nextVersion = existingGb ? (Number(existingGb.version) || 1) + 1 : 1;

    // Charger les photo_r2_key existantes pour nettoyer les photos des élèves supprimés sans jamais perdre une photo active
    const prevPhotosRes = existingGb
      ? await db
          .prepare('SELECT id, photo_r2_key FROM teacher_gradebook_students WHERE user_id = ? AND gradebook_id = ?')
          .bind(userId, gradebookId)
          .all()
      : { results: [] };

    const prevKeyByStudentId = new Map<string, string>();
    for (const r of prevPhotosRes.results || []) {
      if (r.photo_r2_key) prevKeyByStudentId.set(r.id, r.photo_r2_key);
    }

    const keptR2Keys = new Set<string>();
    const preparedRows: Array<{
      id: string;
      studentUid: string;
      rowOrder: number;
      fullName: string;
      photoR2Key: string | null;
      notesJson: string;
      average20: number | null;
    }> = [];

    for (let idx = 0; idx < incomingStudents.length; idx++) {
      const s = incomingStudents[idx] || {};
      const rowId = s.id && typeof s.id === 'string' && s.id.length <= 80 ? s.id : makeId('std');
      const studentUid = s.studentUid && typeof s.studentUid === 'string' && s.studentUid.length <= 80 ? s.studentUid : rowId;
      const fullName = String(s.name || '').slice(0, 160);
      const notes = Array.isArray(s.notes)
        ? s.notes.slice(0, 200).map((n: any) => String(n ?? '').slice(0, 32))
        : [];

      let photoR2Key: string | null = null;
      if (s.photoR2Key && isOwnedR2Key(String(s.photoR2Key), userId)) {
        photoR2Key = String(s.photoR2Key);
      } else if (s.photoUrl && typeof s.photoUrl === 'string' && s.photoUrl.startsWith('data:image/')) {
        // Filet de sécurité : si une image base64 arrive (ex: hors-ligne ou collage), la pousser dans R2 !
        const bytes = decodeBase64DataUrl(s.photoUrl);
        const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
        if (bytes && fmt) {
          const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
          const uploadedKey = `teacher-student-photos/${sanitizeSegment(userId)}/${sanitizeSegment(ownSubject.school_id)}/${sanitizeSegment(ownSubject.class_id)}/${sanitizeSegment(rowId)}_${now}_${rand}.${fmt.ext}`;
          await uploadImageBytesToR2(rawEnv, uploadedKey, bytes, fmt.contentType, {
            userId: sanitizeSegment(userId),
            kind: 'student_photo',
            schoolId: sanitizeSegment(ownSubject.school_id),
            classId: sanitizeSegment(ownSubject.class_id),
            studentId: sanitizeSegment(rowId),
          });
          photoR2Key = uploadedKey;
        }
      } else if (s.photoUrl && prevKeyByStudentId.has(rowId)) {
        // Le front n'a pas changé la photo existante (URL signée inchangée)
        photoR2Key = prevKeyByStudentId.get(rowId) || null;
      }

      if (photoR2Key) keptR2Keys.add(photoR2Key);

      const average20 = computeAverage20(notes, columnMetas);
      preparedRows.push({
        id: rowId,
        studentUid,
        rowOrder: idx,
        fullName,
        photoR2Key,
        notesJson: JSON.stringify(notes),
        average20,
      });
    }

    const stmts: any[] = [];
    if (existingGb) {
      stmts.push(
        db
          .prepare(
            `UPDATE teacher_gradebooks
             SET note_col_count = ?, col_metas_json = ?, layout_json = ?, styles_json = ?, version = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`
          )
          .bind(
            noteColumnCount,
            JSON.stringify(columnMetas),
            JSON.stringify(layout),
            JSON.stringify(styles),
            nextVersion,
            now,
            gradebookId,
            userId
          )
      );
    } else {
      stmts.push(
        db
          .prepare(
            `INSERT INTO teacher_gradebooks
              (id, user_id, subject_id, term_id, class_id, school_id, year_id, note_col_count, col_metas_json, layout_json, styles_json, version, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
          )
          .bind(
            gradebookId,
            userId,
            subjectId,
            termId,
            ownSubject.class_id,
            ownSubject.school_id,
            ownSubject.year_id,
            noteColumnCount,
            JSON.stringify(columnMetas),
            JSON.stringify(layout),
            JSON.stringify(styles),
            now,
            now
          )
      );
    }

    stmts.push(
      db
        .prepare('DELETE FROM teacher_gradebook_students WHERE user_id = ? AND gradebook_id = ?')
        .bind(userId, gradebookId)
    );

    for (const row of preparedRows) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO teacher_gradebook_students
              (id, user_id, gradebook_id, subject_id, term_id, class_id, student_uid, row_order, full_name, photo_r2_key, notes_json, average_20, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            row.id,
            userId,
            gradebookId,
            subjectId,
            termId,
            ownSubject.class_id,
            row.studentUid,
            row.rowOrder,
            row.fullName,
            row.photoR2Key,
            row.notesJson,
            row.average20,
            now,
            now
          )
      );
    }

    // D1 batch exécuté par blocs sécurisés (compatible grandes classes de 200+ étudiants)
    await runBatchChunked(db, stmts, 80);

    // Supprimer de R2 uniquement les photos qui n'appartiennent plus à aucune ligne (ni à aucun autre tableur)
    const orphanKeys: string[] = [];
    for (const prevKey of prevKeyByStudentId.values()) {
      if (!keptR2Keys.has(prevKey)) orphanKeys.push(prevKey);
    }
    if (orphanKeys.length > 0) {
      await deleteOwnedR2Keys(rawEnv, userId, orphanKeys);
    }

    return jsonResponse({
      success: true,
      gradebookId,
      version: nextVersion,
      updatedAt: now,
      savedStudentsCount: preparedRows.length,
    }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 9. PHOTOS DE PROFIL ÉLÈVES DANS R2 (POST & DELETE /api/teacher/photos/student)
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/photos/student' && method === 'POST') {
    const contentTypeHeader = request.headers.get('content-type') || '';
    let subjectId = '';
    let termId = '';
    let studentId = '';
    let bytes: Uint8Array | null = null;

    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await request.formData();
      subjectId = String(formData.get('subjectId') || '').trim();
      termId = String(formData.get('termId') || '').trim();
      studentId = String(formData.get('studentId') || '').trim();
      const file = formData.get('file') as any;
      if (file && typeof file.arrayBuffer === 'function') {
        const ab = await file.arrayBuffer();
        bytes = new Uint8Array(ab);
      }
    } else {
      const body: any = await request.json().catch(() => ({}));
      subjectId = String(body.subjectId || '').trim();
      termId = String(body.termId || '').trim();
      studentId = String(body.studentId || '').trim();
      if (typeof body.dataUrl === 'string') {
        bytes = decodeBase64DataUrl(body.dataUrl);
      }
    }

    if (!subjectId || !studentId || !bytes) {
      return errorResponse('Paramètres photo incomplets (subjectId, studentId, image requis).', 400, origin);
    }

    const fmt = detectValidatedImageFormat(bytes);
    if (!fmt) {
      return errorResponse('Image invalide ou trop lourde (formats acceptés : JPEG, PNG, WebP, max 600 Ko).', 400, origin);
    }

    const ownSubject: any = await db
      .prepare('SELECT id, class_id, school_id FROM teacher_subjects WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(subjectId, userId)
      .first();
    if (!ownSubject) return errorResponse('Matière introuvable ou non autorisée.', 404, origin);

    const now = Date.now();
    const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const photoR2Key = `teacher-student-photos/${sanitizeSegment(userId)}/${sanitizeSegment(ownSubject.school_id)}/${sanitizeSegment(ownSubject.class_id)}/${sanitizeSegment(studentId)}_${now}_${rand}.${fmt.ext}`;

    const uploaded = await uploadImageBytesToR2(rawEnv, photoR2Key, bytes, fmt.contentType, {
      userId: sanitizeSegment(userId),
      kind: 'student_photo',
      schoolId: sanitizeSegment(ownSubject.school_id),
      classId: sanitizeSegment(ownSubject.class_id),
      studentId: sanitizeSegment(studentId),
    });
    if (!uploaded) {
      return errorResponse('Stockage R2 indisponible pour enregistrer la photo.', 503, origin);
    }

    // Si la ligne élève existe déjà en D1, mettre à jour photo_r2_key immédiatement et nettoyer l'ancienne photo R2
    if (termId) {
      const existingRow: any = await db
        .prepare(
          `SELECT id, photo_r2_key FROM teacher_gradebook_students
           WHERE id = ? AND user_id = ? AND subject_id = ? AND term_id = ? LIMIT 1`
        )
        .bind(studentId, userId, subjectId, termId)
        .first();
      if (existingRow) {
        await db
          .prepare('UPDATE teacher_gradebook_students SET photo_r2_key = ?, updated_at = ? WHERE id = ? AND user_id = ?')
          .bind(photoR2Key, now, studentId, userId)
          .run();
        if (existingRow.photo_r2_key && existingRow.photo_r2_key !== photoR2Key) {
          await deleteOwnedR2Keys(rawEnv, userId, [existingRow.photo_r2_key]);
        }
      }
    }

    const photoUrl = await signTeacherMediaUrl(apiOrigin, photoR2Key, jwtSecret);
    return jsonResponse({
      success: true,
      photoR2Key,
      photoUrl,
    }, 200, origin);
  }

  if (path === '/api/teacher/photos/student' && method === 'DELETE') {
    const body: any = await request.json().catch(() => ({}));
    const photoR2Key = String(body.photoR2Key || '').trim();
    const studentId = String(body.studentId || '').trim();
    const subjectId = String(body.subjectId || '').trim();
    const termId = String(body.termId || '').trim();

    if (photoR2Key && !isOwnedR2Key(photoR2Key, userId)) {
      return errorResponse('Accès refusé sur cette clé photo.', 403, origin);
    }

    let keyToDelete: string | null = photoR2Key || null;
    if (studentId && subjectId && termId) {
      const existingRow: any = await db
        .prepare(
          `SELECT photo_r2_key FROM teacher_gradebook_students
           WHERE id = ? AND user_id = ? AND subject_id = ? AND term_id = ? LIMIT 1`
        )
        .bind(studentId, userId, subjectId, termId)
        .first();
      if (existingRow?.photo_r2_key && !keyToDelete) {
        keyToDelete = existingRow.photo_r2_key;
      }
      await db
        .prepare(
          `UPDATE teacher_gradebook_students
           SET photo_r2_key = NULL, updated_at = ?
           WHERE id = ? AND user_id = ? AND subject_id = ? AND term_id = ?`
        )
        .bind(Date.now(), studentId, userId, subjectId, termId)
        .run();
    }

    if (keyToDelete) {
      await deleteOwnedR2Keys(rawEnv, userId, [keyToDelete]);
    }
    return jsonResponse({ success: true }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 10. TRANSFERT ATOMIQUE CÔTÉ SERVEUR (D1 + COPIE PHOTOS R2)
  // POST /api/teacher/transfer
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/transfer' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const createdLevels: any[] = Array.isArray(body.createdLevels) ? body.createdLevels : [];
    const createdClasses: any[] = Array.isArray(body.createdClasses) ? body.createdClasses : [];
    const createdTerms: any[] = Array.isArray(body.createdTerms) ? body.createdTerms : [];
    const createdSubjects: any[] = Array.isArray(body.createdSubjects) ? body.createdSubjects : [];
    const updatedSubjects: any[] = Array.isArray(body.updatedSubjects) ? body.updatedSubjects : [];
    const gradebookCopies: any[] = Array.isArray(body.gradebookCopies) ? body.gradebookCopies : [];

    // Vérifier que toutes les entités parentes (écoles, niveaux, classes, trimestres) appartiennent bien à l'utilisateur (Anti-IDOR)
    const [userSchoolsRes, userLevelsRes, userClassesRes, userTermsRes] = await Promise.all([
      db.prepare('SELECT id, year_id FROM teacher_schools WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_study_levels WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_classes WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_terms WHERE user_id = ?').bind(userId).all(),
    ]);
    const ownedSchoolYearMap = new Map<string, string>();
    for (const s of userSchoolsRes.results || []) ownedSchoolYearMap.set(s.id, s.year_id);
    const ownedLevelIds = new Set<string>((userLevelsRes.results || []).map((r: any) => r.id));
    const ownedClassIds = new Set<string>((userClassesRes.results || []).map((r: any) => r.id));
    const ownedTermIds = new Set<string>((userTermsRes.results || []).map((r: any) => r.id));

    const now = Date.now();
    const structStmts: any[] = [];

    for (const lv of createdLevels) {
      if (!lv?.id || !lv?.schoolId || !ownedSchoolYearMap.has(lv.schoolId)) continue;
      const lvId = String(lv.id).slice(0, 80);
      ownedLevelIds.add(lvId);
      structStmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_study_levels
              (id, user_id, school_id, year_id, name, color, text_color, border_color, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
          )
          .bind(
            lvId,
            userId,
            lv.schoolId,
            ownedSchoolYearMap.get(lv.schoolId),
            String(lv.name || 'Niveau').trim().slice(0, 80),
            String(lv.color || '#ffffff').slice(0, 32),
            String(lv.textColor || '#0f172a').slice(0, 32),
            String(lv.borderColor || '#cbd5e1').slice(0, 32),
            Number(lv.createdAt) || now,
            now
          )
      );
    }

    for (const cls of createdClasses) {
      if (!cls?.id || !cls?.schoolId || !cls?.levelId || !ownedSchoolYearMap.has(cls.schoolId)) continue;
      const clsLevelId = String(cls.levelId).slice(0, 80);
      if (!ownedLevelIds.has(clsLevelId)) continue;
      const clsId = String(cls.id).slice(0, 80);
      ownedClassIds.add(clsId);
      structStmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_classes
              (id, user_id, level_id, school_id, year_id, level_name, name, slogan, teacher_name, subject_label, color, text_color, border_color, border_dark_color, icon_gradient, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            clsId,
            userId,
            clsLevelId,
            cls.schoolId,
            ownedSchoolYearMap.get(cls.schoolId),
            String(cls.level || 'Niveau').trim().slice(0, 80),
            String(cls.name || '').trim().slice(0, 80),
            cls.slogan ? String(cls.slogan).trim().slice(0, 140) : null,
            String(cls.teacherName || '').trim().slice(0, 100),
            String(cls.color || '#ffffff').slice(0, 32),
            String(cls.textColor || '#0f172a').slice(0, 32),
            String(cls.borderColor || '#e2e8f0').slice(0, 32),
            String(cls.borderDarkColor || '#cbd5e1').slice(0, 32),
            String(cls.iconGradient || 'from-amber-500 to-orange-600').slice(0, 80),
            Number(cls.createdAt) || now,
            now
          )
      );
    }

    for (const term of createdTerms) {
      if (!term?.id || !term?.classId || !term?.schoolId || !ownedSchoolYearMap.has(term.schoolId)) continue;
      const tClassId = String(term.classId).slice(0, 80);
      if (!ownedClassIds.has(tClassId)) continue;
      const termId = String(term.id).slice(0, 80);
      ownedTermIds.add(termId);
      structStmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_terms
              (id, user_id, class_id, school_id, year_id, number, name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            termId,
            userId,
            tClassId,
            term.schoolId,
            ownedSchoolYearMap.get(term.schoolId),
            Math.max(1, Number(term.number) || 1),
            String(term.name || 'Trimestre 1').trim().slice(0, 50),
            Number(term.createdAt) || now,
            now
          )
      );
    }

    for (const subj of createdSubjects) {
      if (!subj?.id || !subj?.classId || !subj?.termId || !subj?.schoolId || !ownedSchoolYearMap.has(subj.schoolId)) continue;
      const sClassId = String(subj.classId).slice(0, 80);
      const sTermId = String(subj.termId).slice(0, 80);
      if (!ownedClassIds.has(sClassId) || !ownedTermIds.has(sTermId)) continue;
      const coeff = subj.coefficient !== undefined && subj.coefficient !== null && Number.isFinite(Number(subj.coefficient))
        ? Number(subj.coefficient)
        : null;
      structStmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_subjects
              (id, user_id, class_id, term_id, school_id, year_id, name, coefficient, color, text_color, border_color, border_dark_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            String(subj.id).slice(0, 80),
            userId,
            sClassId,
            sTermId,
            subj.schoolId,
            ownedSchoolYearMap.get(subj.schoolId),
            String(subj.name || 'Matière').trim().slice(0, 100),
            coeff,
            String(subj.color || '#ffffff').slice(0, 32),
            String(subj.textColor || '#0f172a').slice(0, 32),
            String(subj.borderColor || '#e2e8f0').slice(0, 32),
            String(subj.borderDarkColor || '#cbd5e1').slice(0, 32),
            Number(subj.createdAt) || now,
            now
          )
      );
    }

    for (const subj of updatedSubjects) {
      if (!subj?.id) continue;
      const coeff = subj.coefficient !== undefined && subj.coefficient !== null && Number.isFinite(Number(subj.coefficient))
        ? Number(subj.coefficient)
        : null;
      structStmts.push(
        db
          .prepare(
            `UPDATE teacher_subjects
             SET coefficient = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`
          )
          .bind(
            coeff,
            String(subj.color || '#ffffff').slice(0, 32),
            String(subj.textColor || '#0f172a').slice(0, 32),
            String(subj.borderColor || '#e2e8f0').slice(0, 32),
            String(subj.borderDarkColor || '#cbd5e1').slice(0, 32),
            now,
            String(subj.id),
            userId
          )
      );
    }

    if (structStmts.length > 0) {
      await runBatchChunked(db, structStmts, 80);
    }

    // Copie serveur des tableurs D1 + photos R2
    let gradebooksCopied = 0;
    let studentsCopied = 0;
    let notesCopied = 0;
    let photosCopied = 0;

    for (const op of gradebookCopies) {
      if (!op?.sourceSubjectId || !op?.targetSubjectId || !op?.options) continue;
      const opts = op.options;
      if (opts.contentMode === 'none') continue;

      const srcSubjectId = String(op.sourceSubjectId);
      const srcTermId = String(op.sourceTermId || '');
      const dstSubjectId = String(op.targetSubjectId);
      const dstTermId = String(op.targetTermId || '');
      const mode: 'replace' | 'merge' = op.conflictStrategy === 'merge' ? 'merge' : 'replace';

      const [srcGb, dstSubj] = await Promise.all([
        db
          .prepare('SELECT * FROM teacher_gradebooks WHERE user_id = ? AND subject_id = ? AND term_id = ? LIMIT 1')
          .bind(userId, srcSubjectId, srcTermId)
          .first(),
        db
          .prepare('SELECT id, class_id, school_id, year_id FROM teacher_subjects WHERE id = ? AND user_id = ? LIMIT 1')
          .bind(dstSubjectId, userId)
          .first(),
      ]);

      if (!srcGb || !dstSubj) continue;

      const srcStudentsRes = await db
        .prepare('SELECT * FROM teacher_gradebook_students WHERE user_id = ? AND gradebook_id = ? ORDER BY row_order ASC')
        .bind(userId, srcGb.id)
        .all();
      const srcStudents: any[] = srcStudentsRes.results || [];

      const existingDstGb: any = await db
        .prepare('SELECT * FROM teacher_gradebooks WHERE user_id = ? AND subject_id = ? AND term_id = ? LIMIT 1')
        .bind(userId, dstSubjectId, dstTermId)
        .first();

      const existingDstStudentsRes = existingDstGb
        ? await db
            .prepare('SELECT * FROM teacher_gradebook_students WHERE user_id = ? AND gradebook_id = ? ORDER BY row_order ASC')
            .bind(userId, existingDstGb.id)
            .all()
        : { results: [] };
      const existingDstStudents: any[] = existingDstStudentsRes.results || [];

      const srcColCount = Math.max(1, Number(srcGb.note_col_count) || 7);
      const dstColCount = existingDstGb ? Math.max(1, Number(existingDstGb.note_col_count) || 7) : 7;
      const finalColCount = mode === 'merge' ? Math.max(srcColCount, dstColCount) : srcColCount;

      const srcColMetas = safeParseJson<Record<string, any>>(srcGb.col_metas_json, {});
      const dstColMetas = existingDstGb ? safeParseJson<Record<string, any>>(existingDstGb.col_metas_json, {}) : {};
      let finalColMetas: Record<string, any> = mode === 'merge' ? { ...dstColMetas } : {};
      if (opts.includeMetas) {
        for (const [k, m] of Object.entries(srcColMetas)) {
          if (mode === 'merge' && finalColMetas[k]) continue;
          finalColMetas[k] = {
            title: (m as any)?.title,
            maxScore: typeof (m as any)?.maxScore === 'number' ? (m as any).maxScore : 20,
            coeffEval: typeof (m as any)?.coeffEval === 'number' ? (m as any).coeffEval : 1,
            ...(opts.includeFormatting
              ? {
                  headerBgColor: (m as any)?.headerBgColor,
                  columnBgColor: (m as any)?.columnBgColor,
                }
              : {}),
          };
        }
      }

      const finalLayout = opts.includeFormatting
        ? safeParseJson(srcGb.layout_json, {})
        : existingDstGb
        ? safeParseJson(existingDstGb.layout_json, {})
        : {};
      const srcStylesParsed = safeParseJson(srcGb.styles_json, {});
      const dstStylesParsed = existingDstGb ? safeParseJson(existingDstGb.styles_json, {}) : {};
      const studentIdMap = new Map<string, string>();

      const dstGradebookId = existingDstGb ? existingDstGb.id : makeId('gb');
      const nextVer = existingDstGb ? (Number(existingDstGb.version) || 1) + 1 : 1;

      const finalRows: Array<{
        id: string;
        studentUid: string;
        fullName: string;
        photoR2Key: string | null;
        notes: string[];
      }> = [];

      if (opts.contentMode === 'structure') {
        if (mode === 'merge' && existingDstStudents.length > 0) {
          for (const st of existingDstStudents) {
            const notes = safeParseJson<string[]>(st.notes_json, []);
            while (notes.length < finalColCount) notes.push('');
            finalRows.push({
              id: st.id,
              studentUid: st.student_uid || st.id,
              fullName: st.full_name || '',
              photoR2Key: st.photo_r2_key || null,
              notes,
            });
          }
        } else {
          for (let i = 0; i < 8; i++) {
            const rid = makeId('std');
            finalRows.push({
              id: rid,
              studentUid: rid,
              fullName: '',
              photoR2Key: null,
              notes: Array(finalColCount).fill(''),
            });
          }
        }
      } else {
        // students_only ou students_and_notes
        const existingByName = new Map<string, number>();
        if (mode === 'merge') {
          for (const st of existingDstStudents) {
            const notes = safeParseJson<string[]>(st.notes_json, []);
            while (notes.length < finalColCount) notes.push('');
            const norm = normalizeNameForMatch(st.full_name);
            if (norm) existingByName.set(norm, finalRows.length);
            finalRows.push({
              id: st.id,
              studentUid: st.student_uid || st.id,
              fullName: st.full_name || '',
              photoR2Key: st.photo_r2_key || null,
              notes,
            });
          }
        }

        const namedSrc = srcStudents.filter((s) => String(s.full_name || '').trim().length > 0);
        for (const srcSt of namedSrc) {
          const norm = normalizeNameForMatch(srcSt.full_name);
          const srcNotes = safeParseJson<string[]>(srcSt.notes_json, []);
          const copiedNotes = Array.from({ length: finalColCount }, (_, idx) => {
            if (opts.contentMode === 'students_and_notes') {
              const v = String(srcNotes[idx] || '');
              if (v.trim()) notesCopied++;
              return v;
            }
            return '';
          });

          if (mode === 'merge' && norm && existingByName.has(norm)) {
            const targetIdx = existingByName.get(norm)!;
            const targetRow = finalRows[targetIdx];
            studentIdMap.set(srcSt.id, targetRow.id);
            if (opts.contentMode === 'students_and_notes') {
              targetRow.notes = targetRow.notes.map((existingVal, idx) =>
                existingVal.trim() ? existingVal : copiedNotes[idx] || ''
              );
            }
            if (opts.includePhotos && !targetRow.photoR2Key && srcSt.photo_r2_key) {
              const copiedKey = await copyOwnedR2Photo(rawEnv, userId, srcSt.photo_r2_key, dstSubj.school_id, dstSubj.class_id, targetRow.id);
              if (copiedKey) {
                targetRow.photoR2Key = copiedKey;
                photosCopied++;
              }
            }
            continue;
          }

          const newRowId = makeId('std');
          studentIdMap.set(srcSt.id, newRowId);
          let newPhotoKey: string | null = null;
          if (opts.includePhotos && srcSt.photo_r2_key) {
            newPhotoKey = await copyOwnedR2Photo(rawEnv, userId, srcSt.photo_r2_key, dstSubj.school_id, dstSubj.class_id, newRowId);
            if (newPhotoKey) photosCopied++;
          }

          finalRows.push({
            id: newRowId,
            studentUid: srcSt.student_uid || newRowId,
            fullName: String(srcSt.full_name || '').trim(),
            photoR2Key: newPhotoKey,
            notes: copiedNotes,
          });
          studentsCopied++;
        }

        // Compléter à 8 lignes minimum pour garder le confort visuel du tableur
        while (finalRows.length < 8) {
          const rid = makeId('std');
          finalRows.push({
            id: rid,
            studentUid: rid,
            fullName: '',
            photoR2Key: null,
            notes: Array(finalColCount).fill(''),
          });
        }
      }

      // Remapper proprement les couleurs de lignes/cases et styles de police vers les nouveaux IDs d'élèves
      const finalStyles = opts.includeFormatting
        ? remapGradebookStylesForTransfer(
            srcStylesParsed,
            studentIdMap,
            dstStylesParsed,
            mode === 'merge' ? 'merge' : 'replace'
          )
        : dstStylesParsed;

      // Enregistrer le tableur cible dans D1
      const gbStmts: any[] = [];
      if (existingDstGb) {
        gbStmts.push(
          db
            .prepare(
              `UPDATE teacher_gradebooks
               SET note_col_count = ?, col_metas_json = ?, layout_json = ?, styles_json = ?, version = ?, updated_at = ?
               WHERE id = ? AND user_id = ?`
            )
            .bind(
              finalColCount,
              JSON.stringify(finalColMetas),
              JSON.stringify(finalLayout),
              JSON.stringify(finalStyles),
              nextVer,
              now,
              dstGradebookId,
              userId
            )
        );
      } else {
        gbStmts.push(
          db
            .prepare(
              `INSERT INTO teacher_gradebooks
                (id, user_id, subject_id, term_id, class_id, school_id, year_id, note_col_count, col_metas_json, layout_json, styles_json, version, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
            )
            .bind(
              dstGradebookId,
              userId,
              dstSubjectId,
              dstTermId,
              dstSubj.class_id,
              dstSubj.school_id,
              dstSubj.year_id,
              finalColCount,
              JSON.stringify(finalColMetas),
              JSON.stringify(finalLayout),
              JSON.stringify(finalStyles),
              now,
              now
            )
        );
      }

      gbStmts.push(
        db
          .prepare('DELETE FROM teacher_gradebook_students WHERE user_id = ? AND gradebook_id = ?')
          .bind(userId, dstGradebookId)
      );

      for (let i = 0; i < finalRows.length; i++) {
        const r = finalRows[i];
        gbStmts.push(
          db
            .prepare(
              `INSERT INTO teacher_gradebook_students
                (id, user_id, gradebook_id, subject_id, term_id, class_id, student_uid, row_order, full_name, photo_r2_key, notes_json, average_20, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              r.id,
              userId,
              dstGradebookId,
              dstSubjectId,
              dstTermId,
              dstSubj.class_id,
              r.studentUid,
              i,
              r.fullName,
              r.photoR2Key,
              JSON.stringify(r.notes),
              computeAverage20(r.notes, finalColMetas),
              now,
              now
            )
        );
      }

      await runBatchChunked(db, gbStmts, 80);

      // Si remplacement, nettoyer les anciennes photos R2 écrasées de la cible
      if (mode === 'replace' && existingDstStudents.length > 0) {
        const keptSet = new Set(finalRows.map((r) => r.photoR2Key).filter(Boolean));
        const toClean = existingDstStudents
          .map((s) => s.photo_r2_key)
          .filter((k) => k && !keptSet.has(k));
        if (toClean.length > 0) {
          await deleteOwnedR2Keys(rawEnv, userId, toClean);
        }
      }

      gradebooksCopied++;
    }

    const gradebookStats = await computeGradebookStatsMap(db, userId);
    return jsonResponse({
      success: true,
      serverSummary: {
        gradebooksCopied,
        studentsCopied,
        notesCopied,
        photosCopied,
      },
      gradebookStats,
    }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 11. MIGRATION UNIQUE DES DONNÉES LOCALES (localStorage -> D1 + R2)
  // POST /api/teacher/import-local
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/import-local' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const now = Date.now();
    const years: any[] = Array.isArray(body.schoolYears) ? body.schoolYears.slice(0, 50) : [];
    const schools: any[] = Array.isArray(body.schools) ? body.schools.slice(0, 100) : [];
    const levels: any[] = Array.isArray(body.studyLevels) ? body.studyLevels.slice(0, 300) : [];
    const classes: any[] = Array.isArray(body.classes) ? body.classes.slice(0, 500) : [];
    const terms: any[] = Array.isArray(body.terms) ? body.terms.slice(0, 1500) : [];
    const subjects: any[] = Array.isArray(body.subjects) ? body.subjects.slice(0, 2000) : [];
    const gradebooks: any[] = Array.isArray(body.gradebooks) ? body.gradebooks.slice(0, 500) : [];

    // Garantir des IDs uniques par compte pour éviter toute collision de clé primaire entre 2 comptes ayant migré "year-default"
    const idPrefix = sanitizeSegment(userId).slice(0, 8);
    const mapId = (rawId: string, kind: string): string => {
      const clean = String(rawId || makeId(kind)).slice(0, 64);
      if (clean.startsWith(`${idPrefix}_`)) return clean;
      return `${idPrefix}_${clean}`.slice(0, 80);
    };

    const yearIdMap = new Map<string, string>();
    const schoolIdMap = new Map<string, string>();
    const levelIdMap = new Map<string, string>();
    const classIdMap = new Map<string, string>();
    const termIdMap = new Map<string, string>();
    const subjectIdMap = new Map<string, string>();

    const stmts: any[] = [];

    for (const y of years) {
      if (!y?.id || !y?.label) continue;
      const newId = mapId(y.id, 'year');
      yearIdMap.set(y.id, newId);
      stmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_school_years (id, user_id, label, color, text_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId,
            userId,
            String(y.label).trim().slice(0, 30),
            String(y.color || '#00313d').slice(0, 32),
            String(y.textColor || '#ffffff').slice(0, 32),
            Number(y.createdAt) || now,
            now
          )
      );
    }

    for (const s of schools) {
      if (!s?.id || !s?.name) continue;
      const mappedYearId = yearIdMap.get(s.yearId);
      if (!mappedYearId) continue;
      const newId = mapId(s.id, 'school');
      schoolIdMap.set(s.id, newId);

      let logoR2Key: string | null = null;
      if (typeof s.logoUrl === 'string' && s.logoUrl.startsWith('data:image/')) {
        const bytes = decodeBase64DataUrl(s.logoUrl);
        const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
        if (bytes && fmt) {
          const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
          logoR2Key = `teacher-school-logos/${sanitizeSegment(userId)}/${sanitizeSegment(newId)}_${now}_${rand}.${fmt.ext}`;
          await uploadImageBytesToR2(rawEnv, logoR2Key, bytes, fmt.contentType, {
            userId: sanitizeSegment(userId),
            kind: 'school_logo',
            schoolId: sanitizeSegment(newId),
          });
        }
      }

      stmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_schools
              (id, user_id, year_id, name, logo_r2_key, color, text_color, border_color, border_dark_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId,
            userId,
            mappedYearId,
            String(s.name).trim().slice(0, 120),
            logoR2Key,
            String(s.color || '#ffffff').slice(0, 32),
            String(s.textColor || '#0f172a').slice(0, 32),
            String(s.borderColor || '#e2e8f0').slice(0, 32),
            String(s.borderDarkColor || '#cbd5e1').slice(0, 32),
            Number(s.createdAt) || now,
            now
          )
      );
    }

    for (const l of levels) {
      if (!l?.id || !l?.name) continue;
      const mappedSchoolId = schoolIdMap.get(l.schoolId);
      const mappedYearId = yearIdMap.get(l.yearId);
      if (!mappedSchoolId || !mappedYearId) continue;
      const newId = mapId(l.id, 'level');
      levelIdMap.set(l.id, newId);

      stmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_study_levels
              (id, user_id, school_id, year_id, name, color, text_color, border_color, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
          )
          .bind(
            newId,
            userId,
            mappedSchoolId,
            mappedYearId,
            String(l.name).trim().slice(0, 80),
            String(l.color || '#ffffff').slice(0, 32),
            String(l.textColor || '#0f172a').slice(0, 32),
            String(l.borderColor || '#cbd5e1').slice(0, 32),
            Number(l.createdAt) || now,
            now
          )
      );
    }

    for (const c of classes) {
      if (!c?.id) continue;
      const mappedSchoolId = schoolIdMap.get(c.schoolId);
      const mappedYearId = yearIdMap.get(c.yearId);
      let mappedLevelId = c.levelId ? levelIdMap.get(c.levelId) : undefined;
      if (!mappedSchoolId || !mappedYearId) continue;
      if (!mappedLevelId) {
        // Créer automatiquement le niveau manquant pour les anciennes classes
        const fallbackLevelId = mapId(`lvl-${c.schoolId}-${sanitizeSegment(c.level || 'general')}`, 'level');
        mappedLevelId = fallbackLevelId;
        stmts.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO teacher_study_levels
                (id, user_id, school_id, year_id, name, color, text_color, border_color, sort_order, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, '#ffffff', '#0f172a', '#cbd5e1', 0, ?, ?)`
            )
            .bind(fallbackLevelId, userId, mappedSchoolId, mappedYearId, String(c.level || 'Général').trim().slice(0, 80), now, now)
        );
      }

      const newId = mapId(c.id, 'class');
      classIdMap.set(c.id, newId);

      stmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_classes
              (id, user_id, level_id, school_id, year_id, level_name, name, slogan, teacher_name, subject_label, color, text_color, border_color, border_dark_color, icon_gradient, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId,
            userId,
            mappedLevelId,
            mappedSchoolId,
            mappedYearId,
            String(c.level || 'Général').trim().slice(0, 80),
            String(c.name || '').trim().slice(0, 80),
            c.slogan ? String(c.slogan).trim().slice(0, 140) : null,
            String(c.teacherName || '').trim().slice(0, 100),
            String(c.color || '#ffffff').slice(0, 32),
            String(c.textColor || '#0f172a').slice(0, 32),
            String(c.borderColor || '#e2e8f0').slice(0, 32),
            String(c.borderDarkColor || '#cbd5e1').slice(0, 32),
            String(c.iconGradient || 'from-amber-500 to-orange-600').slice(0, 80),
            Number(c.createdAt) || now,
            now
          )
      );
    }

    for (const t of terms) {
      if (!t?.id) continue;
      const mappedClassId = classIdMap.get(t.classId);
      const mappedSchoolId = schoolIdMap.get(t.schoolId);
      const mappedYearId = yearIdMap.get(t.yearId);
      if (!mappedClassId || !mappedSchoolId || !mappedYearId) continue;
      const newId = mapId(t.id, 'term');
      termIdMap.set(t.id, newId);

      stmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_terms
              (id, user_id, class_id, school_id, year_id, number, name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId,
            userId,
            mappedClassId,
            mappedSchoolId,
            mappedYearId,
            Math.max(1, Number(t.number) || 1),
            String(t.name || 'Trimestre 1').trim().slice(0, 50),
            Number(t.createdAt) || now,
            now
          )
      );
    }

    for (const s of subjects) {
      if (!s?.id || !s?.name) continue;
      const mappedClassId = classIdMap.get(s.classId);
      const mappedTermId = s.termId ? termIdMap.get(s.termId) : undefined;
      const mappedSchoolId = schoolIdMap.get(s.schoolId);
      const mappedYearId = yearIdMap.get(s.yearId);
      if (!mappedClassId || !mappedTermId || !mappedSchoolId || !mappedYearId) continue;
      const newId = mapId(s.id, 'subject');
      subjectIdMap.set(s.id, newId);
      const coeff = s.coefficient !== undefined && s.coefficient !== null && Number.isFinite(Number(s.coefficient))
        ? Number(s.coefficient)
        : null;

      stmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_subjects
              (id, user_id, class_id, term_id, school_id, year_id, name, coefficient, color, text_color, border_color, border_dark_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId,
            userId,
            mappedClassId,
            mappedTermId,
            mappedSchoolId,
            mappedYearId,
            String(s.name).trim().slice(0, 100),
            coeff,
            String(s.color || '#ffffff').slice(0, 32),
            String(s.textColor || '#0f172a').slice(0, 32),
            String(s.borderColor || '#e2e8f0').slice(0, 32),
            String(s.borderDarkColor || '#cbd5e1').slice(0, 32),
            Number(s.createdAt) || now,
            now
          )
      );
    }

    if (stmts.length > 0) {
      await runBatchChunked(db, stmts, 80);
    }

    // Importer les tableurs + uploader les photos élèves Base64 vers R2
    for (const gb of gradebooks) {
      const mappedSubjectId = subjectIdMap.get(gb.subjectId);
      const mappedTermId = termIdMap.get(gb.termId);
      const mappedClassId = classIdMap.get(gb.classId);
      const mappedSchoolId = schoolIdMap.get(gb.schoolId);
      const mappedYearId = yearIdMap.get(gb.yearId);
      if (!mappedSubjectId || !mappedTermId || !mappedClassId || !mappedSchoolId || !mappedYearId) continue;

      const gbId = makeId('gb');
      const noteColCount = Math.min(200, Math.max(1, Number(gb.noteColumnCount) || 7));
      const colMetas = typeof gb.columnMetas === 'object' && gb.columnMetas !== null ? gb.columnMetas : {};
      const layout = typeof gb.layout === 'object' && gb.layout !== null ? gb.layout : {};
      const styles = typeof gb.styles === 'object' && gb.styles !== null ? gb.styles : {};
      const studentsList: any[] = Array.isArray(gb.students) ? gb.students.slice(0, 600) : [];

      const gbStmts: any[] = [
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_gradebooks
              (id, user_id, subject_id, term_id, class_id, school_id, year_id, note_col_count, col_metas_json, layout_json, styles_json, version, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
          )
          .bind(
            gbId,
            userId,
            mappedSubjectId,
            mappedTermId,
            mappedClassId,
            mappedSchoolId,
            mappedYearId,
            noteColCount,
            JSON.stringify(colMetas),
            JSON.stringify(layout),
            JSON.stringify(styles),
            now,
            now
          ),
      ];

      for (let i = 0; i < studentsList.length; i++) {
        const st = studentsList[i] || {};
        const stId = makeId('std');
        let photoR2Key: string | null = null;
        if (typeof st.photoUrl === 'string' && st.photoUrl.startsWith('data:image/')) {
          const bytes = decodeBase64DataUrl(st.photoUrl);
          const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
          if (bytes && fmt) {
            const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
            photoR2Key = `teacher-student-photos/${sanitizeSegment(userId)}/${sanitizeSegment(mappedSchoolId)}/${sanitizeSegment(mappedClassId)}/${sanitizeSegment(stId)}_${now}_${rand}.${fmt.ext}`;
            await uploadImageBytesToR2(rawEnv, photoR2Key, bytes, fmt.contentType, {
              userId: sanitizeSegment(userId),
              kind: 'student_photo',
              schoolId: sanitizeSegment(mappedSchoolId),
              classId: sanitizeSegment(mappedClassId),
              studentId: sanitizeSegment(stId),
            });
          }
        }
        const notes = Array.isArray(st.notes) ? st.notes.slice(0, 200).map((n: any) => String(n ?? '').slice(0, 32)) : [];
        gbStmts.push(
          db
            .prepare(
              `INSERT INTO teacher_gradebook_students
                (id, user_id, gradebook_id, subject_id, term_id, class_id, student_uid, row_order, full_name, photo_r2_key, notes_json, average_20, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              stId,
              userId,
              gbId,
              mappedSubjectId,
              mappedTermId,
              mappedClassId,
              stId,
              i,
              String(st.name || '').slice(0, 160),
              photoR2Key,
              JSON.stringify(notes),
              computeAverage20(notes, colMetas),
              now,
              now
            )
        );
      }

      await runBatchChunked(db, gbStmts, 80);
    }

    const payload = await buildBootstrapPayload(db, userId, apiOrigin, jwtSecret);
    return jsonResponse({ ...payload, migrated: true }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 12. SYNCHRONISATION MANUELLE COMPLÈTE (Bouton "Enregistrer" + reprise hors-ligne)
  // POST /api/teacher/sync
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/sync' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const now = Date.now();

    const years: any[] = Array.isArray(body.schoolYears) ? body.schoolYears.slice(0, 60) : [];
    const schools: any[] = Array.isArray(body.schools) ? body.schools.slice(0, 150) : [];
    const levels: any[] = Array.isArray(body.studyLevels) ? body.studyLevels.slice(0, 400) : [];
    const classes: any[] = Array.isArray(body.classes) ? body.classes.slice(0, 600) : [];
    const terms: any[] = Array.isArray(body.terms) ? body.terms.slice(0, 2000) : [];
    const subjects: any[] = Array.isArray(body.subjects) ? body.subjects.slice(0, 3000) : [];

    // Charger les IDs déjà possédés par cet utilisateur pour distinguer UPDATE sûr vs INSERT OR IGNORE (Anti-IDOR)
    const [curYears, curSchools, curLevels, curClasses, curTerms, curSubjects] = await Promise.all([
      db.prepare('SELECT id FROM teacher_school_years WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id, logo_r2_key FROM teacher_schools WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_study_levels WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_classes WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_terms WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_subjects WHERE user_id = ?').bind(userId).all(),
    ]);

    const ownedYears = new Set<string>((curYears.results || []).map((r: any) => r.id));
    const ownedSchoolsMap = new Map<string, string | null>();
    for (const r of curSchools.results || []) ownedSchoolsMap.set(r.id, r.logo_r2_key || null);
    const ownedLevels = new Set<string>((curLevels.results || []).map((r: any) => r.id));
    const ownedClasses = new Set<string>((curClasses.results || []).map((r: any) => r.id));
    const ownedTerms = new Set<string>((curTerms.results || []).map((r: any) => r.id));
    const ownedSubjects = new Set<string>((curSubjects.results || []).map((r: any) => r.id));

    const stmts: any[] = [];

    for (const y of years) {
      if (!y?.id || !y?.label) continue;
      const yId = String(y.id).slice(0, 80);
      const label = String(y.label).trim().slice(0, 30);
      if (!label) continue;
      if (ownedYears.has(yId)) {
        stmts.push(
          db.prepare('UPDATE teacher_school_years SET label = ?, color = ?, text_color = ?, updated_at = ? WHERE id = ? AND user_id = ?')
            .bind(label, String(y.color || '#00313d').slice(0, 32), String(y.textColor || '#ffffff').slice(0, 32), now, yId, userId)
        );
      } else {
        stmts.push(
          db.prepare('INSERT OR IGNORE INTO teacher_school_years (id, user_id, label, color, text_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(yId, userId, label, String(y.color || '#00313d').slice(0, 32), String(y.textColor || '#ffffff').slice(0, 32), Number(y.createdAt) || now, now)
        );
        ownedYears.add(yId);
      }
    }

    for (const s of schools) {
      if (!s?.id || !s?.name || !s?.yearId || !ownedYears.has(String(s.yearId))) continue;
      const sId = String(s.id).slice(0, 80);
      const name = String(s.name).trim().slice(0, 120);
      if (!name) continue;

      let logoR2Key: string | null = ownedSchoolsMap.get(sId) ?? (s.logoR2Key && isOwnedR2Key(s.logoR2Key, userId) ? s.logoR2Key : null);
      if (typeof s.logoUrl === 'string' && s.logoUrl.startsWith('data:image/')) {
        const bytes = decodeBase64DataUrl(s.logoUrl);
        const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
        if (bytes && fmt) {
          const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
          logoR2Key = `teacher-school-logos/${sanitizeSegment(userId)}/${sanitizeSegment(sId)}_${now}_${rand}.${fmt.ext}`;
          await uploadImageBytesToR2(rawEnv, logoR2Key, bytes, fmt.contentType, {
            userId: sanitizeSegment(userId),
            kind: 'school_logo',
            schoolId: sanitizeSegment(sId),
          });
        }
      }

      if (ownedSchoolsMap.has(sId)) {
        stmts.push(
          db.prepare(
            `UPDATE teacher_schools
             SET name = ?, logo_r2_key = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`
          ).bind(
            name, logoR2Key,
            String(s.color || '#ffffff').slice(0, 32),
            String(s.textColor || '#0f172a').slice(0, 32),
            String(s.borderColor || '#e2e8f0').slice(0, 32),
            String(s.borderDarkColor || '#cbd5e1').slice(0, 32),
            now, sId, userId
          )
        );
      } else {
        stmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO teacher_schools
              (id, user_id, year_id, name, logo_r2_key, color, text_color, border_color, border_dark_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            sId, userId, String(s.yearId).slice(0, 80), name, logoR2Key,
            String(s.color || '#ffffff').slice(0, 32),
            String(s.textColor || '#0f172a').slice(0, 32),
            String(s.borderColor || '#e2e8f0').slice(0, 32),
            String(s.borderDarkColor || '#cbd5e1').slice(0, 32),
            Number(s.createdAt) || now, now
          )
        );
        ownedSchoolsMap.set(sId, logoR2Key);
      }
    }

    for (const l of levels) {
      if (!l?.id || !l?.name || !l?.schoolId || !l?.yearId || !ownedSchoolsMap.has(String(l.schoolId))) continue;
      const lId = String(l.id).slice(0, 80);
      const name = String(l.name).trim().slice(0, 80);
      if (!name) continue;
      if (ownedLevels.has(lId)) {
        stmts.push(
          db.prepare('UPDATE teacher_study_levels SET name = ?, color = ?, text_color = ?, border_color = ?, updated_at = ? WHERE id = ? AND user_id = ?')
            .bind(name, String(l.color || '#ffffff').slice(0, 32), String(l.textColor || '#0f172a').slice(0, 32), String(l.borderColor || '#cbd5e1').slice(0, 32), now, lId, userId)
        );
      } else {
        stmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO teacher_study_levels
              (id, user_id, school_id, year_id, name, color, text_color, border_color, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
          ).bind(lId, userId, String(l.schoolId).slice(0, 80), String(l.yearId).slice(0, 80), name, String(l.color || '#ffffff').slice(0, 32), String(l.textColor || '#0f172a').slice(0, 32), String(l.borderColor || '#cbd5e1').slice(0, 32), Number(l.createdAt) || now, now)
        );
        ownedLevels.add(lId);
      }
    }

    for (const c of classes) {
      if (!c?.id || !c?.levelId || !c?.schoolId || !c?.yearId || !ownedLevels.has(String(c.levelId))) continue;
      const cId = String(c.id).slice(0, 80);
      if (ownedClasses.has(cId)) {
        stmts.push(
          db.prepare(
            `UPDATE teacher_classes
             SET level_name = ?, name = ?, slogan = ?, teacher_name = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, icon_gradient = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`
          ).bind(
            String(c.level || '').trim().slice(0, 80),
            String(c.name || '').trim().slice(0, 80),
            c.slogan ? String(c.slogan).trim().slice(0, 140) : null,
            String(c.teacherName || '').trim().slice(0, 100),
            String(c.color || '#ffffff').slice(0, 32),
            String(c.textColor || '#0f172a').slice(0, 32),
            String(c.borderColor || '#e2e8f0').slice(0, 32),
            String(c.borderDarkColor || '#cbd5e1').slice(0, 32),
            String(c.iconGradient || 'from-amber-500 to-orange-600').slice(0, 80),
            now, cId, userId
          )
        );
      } else {
        stmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO teacher_classes
              (id, user_id, level_id, school_id, year_id, level_name, name, slogan, teacher_name, subject_label, color, text_color, border_color, border_dark_color, icon_gradient, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            cId, userId, String(c.levelId).slice(0, 80), String(c.schoolId).slice(0, 80), String(c.yearId).slice(0, 80),
            String(c.level || '').trim().slice(0, 80),
            String(c.name || '').trim().slice(0, 80),
            c.slogan ? String(c.slogan).trim().slice(0, 140) : null,
            String(c.teacherName || '').trim().slice(0, 100),
            String(c.color || '#ffffff').slice(0, 32),
            String(c.textColor || '#0f172a').slice(0, 32),
            String(c.borderColor || '#e2e8f0').slice(0, 32),
            String(c.borderDarkColor || '#cbd5e1').slice(0, 32),
            String(c.iconGradient || 'from-amber-500 to-orange-600').slice(0, 80),
            Number(c.createdAt) || now, now
          )
        );
        ownedClasses.add(cId);
      }
    }

    for (const t of terms) {
      if (!t?.id || !t?.classId || !t?.schoolId || !t?.yearId || !ownedClasses.has(String(t.classId))) continue;
      const tId = String(t.id).slice(0, 80);
      if (ownedTerms.has(tId)) {
        stmts.push(
          db.prepare('UPDATE teacher_terms SET number = ?, name = ?, updated_at = ? WHERE id = ? AND user_id = ?')
            .bind(Math.max(1, Number(t.number) || 1), String(t.name || 'Trimestre 1').trim().slice(0, 50), now, tId, userId)
        );
      } else {
        stmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO teacher_terms
              (id, user_id, class_id, school_id, year_id, number, name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(tId, userId, String(t.classId).slice(0, 80), String(t.schoolId).slice(0, 80), String(t.yearId).slice(0, 80), Math.max(1, Number(t.number) || 1), String(t.name || 'Trimestre 1').trim().slice(0, 50), Number(t.createdAt) || now, now)
        );
        ownedTerms.add(tId);
      }
    }

    for (const s of subjects) {
      if (!s?.id || !s?.name || !s?.classId || !s?.termId || !s?.schoolId || !s?.yearId) continue;
      if (!ownedClasses.has(String(s.classId)) || !ownedTerms.has(String(s.termId))) continue;
      const sId = String(s.id).slice(0, 80);
      const coeff = s.coefficient !== undefined && s.coefficient !== null && Number.isFinite(Number(s.coefficient)) ? Number(s.coefficient) : null;
      if (ownedSubjects.has(sId)) {
        stmts.push(
          db.prepare(
            `UPDATE teacher_subjects
             SET name = ?, coefficient = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`
          ).bind(
            String(s.name).trim().slice(0, 100), coeff,
            String(s.color || '#ffffff').slice(0, 32),
            String(s.textColor || '#0f172a').slice(0, 32),
            String(s.borderColor || '#e2e8f0').slice(0, 32),
            String(s.borderDarkColor || '#cbd5e1').slice(0, 32),
            now, sId, userId
          )
        );
      } else {
        stmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO teacher_subjects
              (id, user_id, class_id, term_id, school_id, year_id, name, coefficient, color, text_color, border_color, border_dark_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            sId, userId, String(s.classId).slice(0, 80), String(s.termId).slice(0, 80), String(s.schoolId).slice(0, 80), String(s.yearId).slice(0, 80),
            String(s.name).trim().slice(0, 100), coeff,
            String(s.color || '#ffffff').slice(0, 32),
            String(s.textColor || '#0f172a').slice(0, 32),
            String(s.borderColor || '#e2e8f0').slice(0, 32),
            String(s.borderDarkColor || '#cbd5e1').slice(0, 32),
            Number(s.createdAt) || now, now
          )
        );
        ownedSubjects.add(sId);
      }
    }

    if (stmts.length > 0) {
      await runBatchChunked(db, stmts, 80);
    }

    const payload = await buildBootstrapPayload(db, userId, apiOrigin, jwtSecret);
    return jsonResponse({ ...payload, syncedAt: now }, 200, origin);
  }

  return errorResponse(`Route enseignant non trouvée : ${method} ${path}`, 404, origin);
}

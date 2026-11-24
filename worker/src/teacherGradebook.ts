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

export interface StorageQuotaCheckResult {
  allowed: boolean;
  totalAllowedBytes: number;
  totalUsedBytes: number;
  remainingBytes: number;
  totalAllowedMb: number;
  totalUsedMb: number;
  welcomeMb?: number;
  paidMb?: number;
  bonusMb?: number;
  error?: string;
}

export interface TeacherGradebookStorageUsage {
  r2FilesCount: number;
  r2Bytes: number;
  r2CompressedBytes: number;
  schoolLogosCount: number;
  schoolLogosBytes: number;
  schoolLogosCompressedBytes: number;
  studentPhotosCount: number;
  studentPhotosBytes: number;
  studentPhotosCompressedBytes: number;
  delmasFilesCount: number;
  delmasFilesBytes: number;
  delmasFilesCompressedBytes: number;
  delmasConversationsCount: number;
  delmasMessagesCount: number;
  delmasFilesMetaCount: number;
  delmasD1RowsCount: number;
  delmasD1TextBytes: number;
  delmasD1EstimatedBytes: number;
  d1RowsCount: number;
  d1TextBytes: number;
  d1EstimatedBytes: number;
  totalBytes: number;
  entities: {
    years: number;
    schools: number;
    levels: number;
    classes: number;
    terms: number;
    subjects: number;
    gradebooks: number;
    students: number;
    classAverages: number;
    delmasConversations: number;
    delmasMessages: number;
    delmasFiles: number;
  };
}

export interface TeacherWorkerDeps {
  db: any;
  rawEnv: any;
  origin: string;
  jwtSecret: string;
  getAuthUser: (req: Request) => Promise<any | null>;
  corsHeaders: (origin?: string) => Record<string, string>;
  jsonResponse: (data: any, status?: number, origin?: string) => Response;
  errorResponse: (message: string, status?: number, origin?: string) => Response;
  checkStorageQuota?: (userId: string, incomingBytes?: number) => Promise<StorageQuotaCheckResult>;
  recalculateUserStorage?: (userId: string) => Promise<any>;
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
      color_style TEXT NOT NULL DEFAULT 'full',
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
      logo_size_bytes INTEGER NOT NULL DEFAULT 0,
      logo_compressed_size_bytes INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#ffffff',
      text_color TEXT NOT NULL DEFAULT '#0f172a',
      border_color TEXT NOT NULL DEFAULT '#e2e8f0',
      border_dark_color TEXT NOT NULL DEFAULT '#cbd5e1',
      color_style TEXT NOT NULL DEFAULT 'full',
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
      color_style TEXT NOT NULL DEFAULT 'accent',
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
      color_style TEXT NOT NULL DEFAULT 'accent',
      icon_gradient TEXT NOT NULL DEFAULT 'from-amber-500 to-orange-600',
      mention_rules_json TEXT DEFAULT NULL,
      show_matricule INTEGER NOT NULL DEFAULT 0,
      average_scale REAL NOT NULL DEFAULT 20,
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
      coefficient REAL DEFAULT NULL,
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
      color_style TEXT NOT NULL DEFAULT 'accent',
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
      matricule TEXT NOT NULL DEFAULT '',
      photo_r2_key TEXT DEFAULT NULL,
      photo_size_bytes INTEGER NOT NULL DEFAULT 0,
      photo_compressed_size_bytes INTEGER NOT NULL DEFAULT 0,
      notes_json TEXT NOT NULL DEFAULT '[]',
      average_20 REAL DEFAULT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (gradebook_id) REFERENCES teacher_gradebooks(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_gb_students_gb ON teacher_gradebook_students(user_id, gradebook_id, row_order)`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_gb_students_class_term ON teacher_gradebook_students(user_id, class_id, term_id, student_uid)`,

    `CREATE TABLE IF NOT EXISTS teacher_class_averages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      term_id TEXT DEFAULT NULL,
      school_id TEXT NOT NULL,
      year_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'term',
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#ffffff',
      text_color TEXT NOT NULL DEFAULT '#0f172a',
      border_color TEXT NOT NULL DEFAULT '#e2e8f0',
      border_dark_color TEXT NOT NULL DEFAULT '#cbd5e1',
      layout_json TEXT NOT NULL DEFAULT '{}',
      styles_json TEXT NOT NULL DEFAULT '{}',
      overrides_json TEXT NOT NULL DEFAULT '{}',
      sort_mode TEXT NOT NULL DEFAULT 'merit',
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES teacher_classes(id) ON DELETE CASCADE,
      FOREIGN KEY (term_id) REFERENCES teacher_terms(id) ON DELETE CASCADE,
      FOREIGN KEY (school_id) REFERENCES teacher_schools(id) ON DELETE CASCADE,
      FOREIGN KEY (year_id) REFERENCES teacher_school_years(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_class_avgs_user_class ON teacher_class_averages(user_id, class_id, sort_order, created_at)`,

    `CREATE TABLE IF NOT EXISTS teacher_delmas_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Nouvelle discussion',
      language TEXT NOT NULL DEFAULT 'fr',
      context_year_id TEXT DEFAULT NULL,
      context_school_id TEXT DEFAULT NULL,
      context_class_id TEXT DEFAULT NULL,
      context_term_id TEXT DEFAULT NULL,
      context_subject_id TEXT DEFAULT NULL,
      context_sheet_kind TEXT NOT NULL DEFAULT 'subject',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      pinned_at INTEGER DEFAULT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_delmas_conv_user ON teacher_delmas_conversations(user_id, is_pinned DESC, updated_at DESC)`,

    `CREATE TABLE IF NOT EXISTS teacher_delmas_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      sender TEXT NOT NULL DEFAULT 'user',
      content TEXT NOT NULL DEFAULT '',
      actions_json TEXT NOT NULL DEFAULT '[]',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      reaction TEXT DEFAULT NULL,
      tokens INTEGER NOT NULL DEFAULT 0,
      credits REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES teacher_delmas_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_delmas_msg_conv ON teacher_delmas_messages(user_id, conversation_id, created_at ASC)`,

    `CREATE TABLE IF NOT EXISTS teacher_delmas_files (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_type TEXT NOT NULL DEFAULT 'document',
      r2_key TEXT DEFAULT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      compressed_size_bytes INTEGER NOT NULL DEFAULT 0,
      extracted_text TEXT NOT NULL DEFAULT '',
      preview_data_url TEXT DEFAULT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES teacher_delmas_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_teacher_delmas_files_conv ON teacher_delmas_files(user_id, conversation_id, created_at ASC)`,
  ];

  await db.batch(statements.map((sql) => db.prepare(sql)));

  // Migration idempotente : s'assurer que teacher_terms possède la colonne coefficient
  try {
    const info = await db.prepare('PRAGMA table_info(teacher_terms)').all();
    const hasCoeff = (info.results || []).some((c: any) => String(c.name) === 'coefficient');
    if (!hasCoeff) {
      await db.prepare('ALTER TABLE teacher_terms ADD COLUMN coefficient REAL DEFAULT NULL').run();
    }
  } catch {
    // Ignorer si déjà migré par une requête concurrente
  }

  // Migration idempotente : s'assurer que teacher_class_averages possède les colonnes du tableur (layout, styles, overrides, tri, version)
  try {
    const avgInfo = await db.prepare('PRAGMA table_info(teacher_class_averages)').all();
    const avgCols = new Set((avgInfo.results || []).map((c: any) => String(c.name)));
    const pendingAlters: string[] = [];
    if (!avgCols.has('layout_json')) pendingAlters.push("ALTER TABLE teacher_class_averages ADD COLUMN layout_json TEXT NOT NULL DEFAULT '{}'");
    if (!avgCols.has('styles_json')) pendingAlters.push("ALTER TABLE teacher_class_averages ADD COLUMN styles_json TEXT NOT NULL DEFAULT '{}'");
    if (!avgCols.has('overrides_json')) pendingAlters.push("ALTER TABLE teacher_class_averages ADD COLUMN overrides_json TEXT NOT NULL DEFAULT '{}'");
    if (!avgCols.has('sort_mode')) pendingAlters.push("ALTER TABLE teacher_class_averages ADD COLUMN sort_mode TEXT NOT NULL DEFAULT 'merit'");
    if (!avgCols.has('version')) pendingAlters.push('ALTER TABLE teacher_class_averages ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
    for (const sql of pendingAlters) {
      await db.prepare(sql).run();
    }
  } catch {
    // Ignorer si déjà migré par une requête concurrente
  }

  // Migration idempotente : s'assurer que les tables d'entités possèdent la colonne color_style ('accent' | 'full')
  const colorStyleTargets: Array<[string, 'accent' | 'full']> = [
    ['teacher_school_years', 'full'],
    ['teacher_schools', 'full'],
    ['teacher_study_levels', 'accent'],
    ['teacher_classes', 'accent'],
    ['teacher_subjects', 'accent'],
  ];
  for (const [tbl, defVal] of colorStyleTargets) {
    try {
      const tInfo = await db.prepare(`PRAGMA table_info(${tbl})`).all();
      const hasCol = (tInfo.results || []).some((c: any) => String(c.name) === 'color_style');
      if (!hasCol) {
        await db.prepare(`ALTER TABLE ${tbl} ADD COLUMN color_style TEXT NOT NULL DEFAULT '${defVal}'`).run();
      }
    } catch {
      // Ignorer si déjà migré
    }
  }

  // Migration idempotente : s'assurer que teacher_classes possède mention_rules_json, show_matricule et average_scale
  try {
    const clsInfo = await db.prepare('PRAGMA table_info(teacher_classes)').all();
    const clsCols = new Set((clsInfo.results || []).map((c: any) => String(c.name)));
    if (!clsCols.has('mention_rules_json')) {
      await db.prepare('ALTER TABLE teacher_classes ADD COLUMN mention_rules_json TEXT DEFAULT NULL').run();
    }
    if (!clsCols.has('show_matricule')) {
      await db.prepare('ALTER TABLE teacher_classes ADD COLUMN show_matricule INTEGER NOT NULL DEFAULT 0').run();
    }
    if (!clsCols.has('average_scale')) {
      await db.prepare('ALTER TABLE teacher_classes ADD COLUMN average_scale REAL NOT NULL DEFAULT 20').run();
    }
  } catch {
    // Ignorer si déjà migré
  }

  // Migration idempotente : s'assurer que teacher_schools possède logo_size_bytes (Mo original) et logo_compressed_size_bytes (R2 compressé)
  try {
    const schInfo = await db.prepare('PRAGMA table_info(teacher_schools)').all();
    const schCols = new Set((schInfo.results || []).map((c: any) => String(c.name)));
    if (!schCols.has('logo_size_bytes')) {
      await db.prepare('ALTER TABLE teacher_schools ADD COLUMN logo_size_bytes INTEGER NOT NULL DEFAULT 0').run();
    }
    if (!schCols.has('logo_compressed_size_bytes')) {
      await db.prepare('ALTER TABLE teacher_schools ADD COLUMN logo_compressed_size_bytes INTEGER NOT NULL DEFAULT 0').run();
    }
  } catch {
    // Ignorer si déjà migré
  }

  // Migration idempotente : s'assurer que teacher_gradebook_students possède matricule, photo_size_bytes (Mo original) et photo_compressed_size_bytes (R2 compressé)
  try {
    const stInfo = await db.prepare('PRAGMA table_info(teacher_gradebook_students)').all();
    const stCols = new Set((stInfo.results || []).map((c: any) => String(c.name)));
    if (!stCols.has('matricule')) {
      await db.prepare("ALTER TABLE teacher_gradebook_students ADD COLUMN matricule TEXT NOT NULL DEFAULT ''").run();
    }
    if (!stCols.has('photo_size_bytes')) {
      await db.prepare('ALTER TABLE teacher_gradebook_students ADD COLUMN photo_size_bytes INTEGER NOT NULL DEFAULT 0').run();
    }
    if (!stCols.has('photo_compressed_size_bytes')) {
      await db.prepare('ALTER TABLE teacher_gradebook_students ADD COLUMN photo_compressed_size_bytes INTEGER NOT NULL DEFAULT 0').run();
    }
  } catch {
    // Ignorer si déjà migré
  }

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
    key.startsWith(`teacher-school-logos/${safeUser}/`) ||
    key.startsWith(`teacher-delmas-files/${safeUser}/`)
  );
}

function extractOwnerSegmentFromR2Key(key: string): string | null {
  if (!key || typeof key !== 'string') return null;
  if (key.includes('..') || key.includes('\\') || key.includes('\0')) return null;
  const match = key.match(/^(?:teacher-student-photos|teacher-school-logos|teacher-delmas-files)\/([a-zA-Z0-9_-]+)\/[a-zA-Z0-9_./-]+$/);
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

const SAFE_INLINE_MEDIA_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
]);

const DANGEROUS_UPLOAD_MIMES = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'text/xml',
  'application/xml',
]);

const DANGEROUS_UPLOAD_EXTS = new Set([
  'html',
  'htm',
  'xhtml',
  'svg',
  'svgz',
  'js',
  'mjs',
  'cjs',
  'xml',
]);

function sanitizeUploadedMimeAndExt(rawMime: string, rawFileName: string): {
  mimeType: string;
  ext: string;
} {
  const lowerMime = String(rawMime || 'application/octet-stream')
    .split(';')[0]
    .trim()
    .toLowerCase()
    .slice(0, 100);
  const extMatch = String(rawFileName || '').match(/\.([a-zA-Z0-9]{1,8})$/);
  const rawExt = extMatch ? extMatch[1].toLowerCase() : 'bin';

  if (DANGEROUS_UPLOAD_MIMES.has(lowerMime) || DANGEROUS_UPLOAD_EXTS.has(rawExt)) {
    return { mimeType: 'application/octet-stream', ext: 'bin' };
  }
  return {
    mimeType: lowerMime || 'application/octet-stream',
    ext: rawExt,
  };
}

function isSafeRasterPreviewDataUrl(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  return /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-zA-Z0-9+/=\s]+$/i.test(val);
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

/**
 * Supprime dans R2 uniquement les clés photo élèves qui ne sont plus référencées
 * par AUCUN autre tableur de l'utilisateur en base de données (protège les photos
 * partagées entre matières via l'auto-complétion de classe).
 */
async function deleteUnreferencedStudentR2Keys(
  db: any,
  rawEnv: any,
  userId: string,
  keys: Array<string | null | undefined>
): Promise<void> {
  const uniqueKeys = Array.from(new Set(keys.filter((k): k is string => isOwnedR2Key(k, userId))));
  if (uniqueKeys.length === 0) return;

  const stillUsed = new Set<string>();
  for (let i = 0; i < uniqueKeys.length; i += 40) {
    const chunk = uniqueKeys.slice(i, i + 40);
    const placeholders = chunk.map(() => '?').join(', ');
    try {
      const res = await db
        .prepare(
          `SELECT DISTINCT photo_r2_key
           FROM teacher_gradebook_students
           WHERE user_id = ? AND photo_r2_key IN (${placeholders})`
        )
        .bind(userId, ...chunk)
        .all();
      for (const r of res.results || []) {
        if (r.photo_r2_key) stillUsed.add(String(r.photo_r2_key));
      }
    } catch {
      // En cas de doute, ne pas supprimer prématurément une photo potentiellement utilisée
      for (const k of chunk) stillUsed.add(k);
    }
  }

  const trulyOrphan = uniqueKeys.filter((k) => !stillUsed.has(k));
  if (trulyOrphan.length > 0) {
    await deleteOwnedR2Keys(rawEnv, userId, trulyOrphan);
  }
}

const _utf8Encoder = new TextEncoder();

function utf8ByteLength(value: any): number {
  if (value === null || value === undefined) return 0;
  const s = typeof value === 'string' ? value : String(value);
  if (!s) return 0;
  return _utf8Encoder.encode(s).byteLength;
}

function formatTeacherBytes(bytes: number): string {
  const b = Math.max(0, Number(bytes) || 0);
  if (b < 1024) return `${Math.round(b)} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} Mo`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function storageLimitExceededResponse(
  quotaCheck: StorageQuotaCheckResult,
  origin: string,
  corsHeaders: (origin?: string) => Record<string, string>
): Response {
  const allowedFormatted =
    quotaCheck.totalAllowedMb >= 1024
      ? `${(quotaCheck.totalAllowedMb / 1024).toFixed(2)} Go`
      : `${quotaCheck.totalAllowedMb} Mo`;
  const usedFormatted = formatTeacherBytes(
    Math.min(quotaCheck.totalUsedBytes, quotaCheck.totalAllowedBytes)
  );
  return new Response(
    JSON.stringify({
      success: false,
      error: 'STORAGE_LIMIT_EXCEEDED',
      isStorageLimitExceeded: true,
      message:
        quotaCheck.error ||
        `Votre espace de stockage est plein (${allowedFormatted} atteints). Aucune nouvelle donnée ne peut être enregistrée. Veuillez libérer de l'espace ou augmenter votre stockage.`,
      quota: {
        totalAllowedBytes: quotaCheck.totalAllowedBytes,
        totalUsedBytes: quotaCheck.totalUsedBytes,
        remainingBytes: quotaCheck.remainingBytes,
        totalAllowedMb: quotaCheck.totalAllowedMb,
        totalUsedMb: quotaCheck.totalUsedMb,
        usedFormatted,
        allowedFormatted,
      },
    }),
    {
      status: 413,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    }
  );
}

async function getOwnedR2ObjectSize(rawEnv: any, key: string | null | undefined): Promise<number> {
  if (!rawEnv || !key) return 0;
  const bucket = getTeacherPhotosBucket(rawEnv);
  const fallback = getFallbackMainBucket(rawEnv);
  const buckets = [bucket, fallback].filter((b, idx, arr) => b && arr.indexOf(b) === idx);
  for (const b of buckets) {
    try {
      if (typeof b.head === 'function') {
        const meta = await b.head(key);
        if (meta) {
          const origMeta = Number(meta.customMetadata?.originalSizeBytes || 0);
          const rawSize = Number(meta.size || 0);
          const best = Math.max(origMeta, rawSize);
          if (best > 0) return best;
        }
      }
      if (typeof b.get === 'function') {
        const obj = await b.get(key);
        if (obj) {
          const origMeta = Number(obj.customMetadata?.originalSizeBytes || 0);
          const rawSize = Number(obj.size || 0);
          if (Math.max(origMeta, rawSize) > 0) return Math.max(origMeta, rawSize);
          if (typeof obj.arrayBuffer === 'function') {
            const ab = await obj.arrayBuffer();
            if (ab && ab.byteLength > 0) return Math.max(origMeta, ab.byteLength);
          }
        }
      }
    } catch {
      // Essayer le bucket suivant
    }
  }
  return 0;
}

async function copyOwnedR2Photo(
  rawEnv: any,
  userId: string,
  sourceKey: string,
  targetSchoolId: string,
  targetClassId: string,
  targetStudentId: string
): Promise<{ key: string; sizeBytes: number } | null> {
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

  const billedSizeBytes = Math.max(
    bytes.byteLength,
    Number(obj.customMetadata?.originalSizeBytes || 0)
  );
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
      originalSizeBytes: String(billedSizeBytes),
    },
  });
  return { key: destKey, sizeBytes: billedSizeBytes };
}

function extractTimestampFromR2Key(key: string | null | undefined): number {
  if (!key || typeof key !== 'string') return 0;
  const m = key.match(/_(\d{13})_[a-f0-9]+\.(?:webp|jpg|jpeg|png)$/i);
  return m ? Number(m[1]) || 0 : 0;
}

const ensuredTeacherSizeColsDbs = new WeakSet<object>();

/**
 * Calcule l'occupation réelle (R2 + D1) de l'ensemble du module Enseignant / Calcul de moyenne
 * pour un utilisateur donné :
 *  - R2 : logos d'établissements + photos élèves (dédupliqués par clé R2 unique, facturés sur le Mo original + suivi taille compressée R2)
 *  - D1 : somme exacte en octets UTF-8 de toutes les colonnes des 9 tables teacher_* + 160 octets/ligne (overhead SQLite)
 * Effectue aussi le rattrapage paresseux (backfill via R2 head) pour les images déjà enregistrées avant cette mise à jour.
 */
export async function computeTeacherGradebookStorageUsage(
  db: any,
  userId: string,
  rawEnv?: any
): Promise<TeacherGradebookStorageUsage> {
  const empty: TeacherGradebookStorageUsage = {
    r2FilesCount: 0,
    r2Bytes: 0,
    r2CompressedBytes: 0,
    schoolLogosCount: 0,
    schoolLogosBytes: 0,
    schoolLogosCompressedBytes: 0,
    studentPhotosCount: 0,
    studentPhotosBytes: 0,
    studentPhotosCompressedBytes: 0,
    delmasFilesCount: 0,
    delmasFilesBytes: 0,
    delmasFilesCompressedBytes: 0,
    delmasConversationsCount: 0,
    delmasMessagesCount: 0,
    delmasFilesMetaCount: 0,
    delmasD1RowsCount: 0,
    delmasD1TextBytes: 0,
    delmasD1EstimatedBytes: 0,
    d1RowsCount: 0,
    d1TextBytes: 0,
    d1EstimatedBytes: 0,
    totalBytes: 0,
    entities: {
      years: 0,
      schools: 0,
      levels: 0,
      classes: 0,
      terms: 0,
      subjects: 0,
      gradebooks: 0,
      students: 0,
      classAverages: 0,
      delmasConversations: 0,
      delmasMessages: 0,
      delmasFiles: 0,
    },
  };

  if (!db || !userId) return empty;

  try {
    // S'assurer que les colonnes de taille R2 existent si les tables teacher_* ont déjà été créées
    if (!ensuredTeacherSizeColsDbs.has(db)) {
      try {
        const schInfo = await db.prepare('PRAGMA table_info(teacher_schools)').all();
        const schCols = (schInfo.results || []).map((c: any) => String(c.name));
        if (schCols.length > 0 && !schCols.includes('logo_size_bytes')) {
          await db.prepare('ALTER TABLE teacher_schools ADD COLUMN logo_size_bytes INTEGER NOT NULL DEFAULT 0').run().catch(() => {});
        }
        if (schCols.length > 0 && !schCols.includes('logo_compressed_size_bytes')) {
          await db.prepare('ALTER TABLE teacher_schools ADD COLUMN logo_compressed_size_bytes INTEGER NOT NULL DEFAULT 0').run().catch(() => {});
        }
        const stInfo = await db.prepare('PRAGMA table_info(teacher_gradebook_students)').all();
        const stCols = (stInfo.results || []).map((c: any) => String(c.name));
        if (stCols.length > 0 && !stCols.includes('photo_size_bytes')) {
          await db.prepare('ALTER TABLE teacher_gradebook_students ADD COLUMN photo_size_bytes INTEGER NOT NULL DEFAULT 0').run().catch(() => {});
        }
        if (stCols.length > 0 && !stCols.includes('photo_compressed_size_bytes')) {
          await db.prepare('ALTER TABLE teacher_gradebook_students ADD COLUMN photo_compressed_size_bytes INTEGER NOT NULL DEFAULT 0').run().catch(() => {});
        }
        if (schCols.length > 0 && stCols.length > 0) {
          ensuredTeacherSizeColsDbs.add(db);
        }
      } catch {
        // Les tables teacher_* n'existent peut-être pas encore pour cette base
      }
    }

    // Rattrapage automatique (backfill) des logos, photos & fichiers Assistant Delmas déjà dans R2 dont la taille n'avait pas encore été enregistrée en D1
    if (rawEnv) {
      try {
        const [missingLogos, missingPhotos, missingDelmasFiles] = await Promise.all([
          db
            .prepare(
              `SELECT DISTINCT logo_r2_key FROM teacher_schools
               WHERE user_id = ? AND logo_r2_key IS NOT NULL AND logo_r2_key != '' AND COALESCE(logo_size_bytes, 0) <= 0
               LIMIT 30`
            )
            .bind(userId)
            .all()
            .catch(() => ({ results: [] })),
          db
            .prepare(
              `SELECT DISTINCT photo_r2_key FROM teacher_gradebook_students
               WHERE user_id = ? AND photo_r2_key IS NOT NULL AND photo_r2_key != '' AND COALESCE(photo_size_bytes, 0) <= 0
               LIMIT 30`
            )
            .bind(userId)
            .all()
            .catch(() => ({ results: [] })),
          db
            .prepare(
              `SELECT DISTINCT r2_key FROM teacher_delmas_files
               WHERE user_id = ? AND r2_key IS NOT NULL AND r2_key != '' AND COALESCE(size_bytes, 0) <= 0
               LIMIT 30`
            )
            .bind(userId)
            .all()
            .catch(() => ({ results: [] })),
        ]);

        const logoRows: any[] = missingLogos?.results || [];
        if (logoRows.length > 0) {
          await Promise.all(
            logoRows.map(async (r) => {
              const key = String(r.logo_r2_key || '');
              if (!key) return;
              const size = await getOwnedR2ObjectSize(rawEnv, key);
              if (size > 0) {
                await db
                  .prepare('UPDATE teacher_schools SET logo_size_bytes = ? WHERE user_id = ? AND logo_r2_key = ?')
                  .bind(size, userId, key)
                  .run()
                  .catch(() => {});
              }
            })
          );
        }

        const photoRows: any[] = missingPhotos?.results || [];
        if (photoRows.length > 0) {
          await Promise.all(
            photoRows.map(async (r) => {
              const key = String(r.photo_r2_key || '');
              if (!key) return;
              const size = await getOwnedR2ObjectSize(rawEnv, key);
              if (size > 0) {
                await db
                  .prepare('UPDATE teacher_gradebook_students SET photo_size_bytes = ? WHERE user_id = ? AND photo_r2_key = ?')
                  .bind(size, userId, key)
                  .run()
                  .catch(() => {});
              }
            })
          );
        }

        const delmasFileRows: any[] = missingDelmasFiles?.results || [];
        if (delmasFileRows.length > 0) {
          await Promise.all(
            delmasFileRows.map(async (r) => {
              const key = String(r.r2_key || '');
              if (!key) return;
              const size = await getOwnedR2ObjectSize(rawEnv, key);
              if (size > 0) {
                await db
                  .prepare(
                    `UPDATE teacher_delmas_files
                     SET size_bytes = CASE WHEN COALESCE(size_bytes, 0) <= 0 THEN ? ELSE size_bytes END,
                         compressed_size_bytes = CASE WHEN COALESCE(compressed_size_bytes, 0) <= 0 THEN ? ELSE compressed_size_bytes END
                     WHERE user_id = ? AND r2_key = ?`
                  )
                  .bind(size, size, userId, key)
                  .run()
                  .catch(() => {});
              }
            })
          );
        }
      } catch {
        // Backfill non bloquant
      }
    }

    const zeroD1 = { cnt: 0, textBytes: 0 };
    const zeroR2 = { cnt: 0, r2Bytes: 0, compBytes: 0 };

    const [
      yearsStat,
      schoolsStat,
      levelsStat,
      classesStat,
      termsStat,
      subjectsStat,
      gradebooksStat,
      studentsStat,
      classAveragesStat,
      schoolLogosR2,
      studentPhotosR2,
      delmasConvsStat,
      delmasMsgsStat,
      delmasFilesStat,
      delmasFilesR2,
    ] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(COALESCE(label, '') AS BLOB)) + LENGTH(CAST(COALESCE(color, '') AS BLOB)) + LENGTH(CAST(COALESCE(text_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(color_style, '') AS BLOB))), 0) as textBytes
           FROM teacher_school_years WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(year_id AS BLOB)) + LENGTH(CAST(COALESCE(name, '') AS BLOB)) + LENGTH(CAST(COALESCE(logo_r2_key, '') AS BLOB)) + LENGTH(CAST(COALESCE(color, '') AS BLOB)) + LENGTH(CAST(COALESCE(text_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(border_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(border_dark_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(color_style, '') AS BLOB))), 0) as textBytes
           FROM teacher_schools WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(school_id AS BLOB)) + LENGTH(CAST(year_id AS BLOB)) + LENGTH(CAST(COALESCE(name, '') AS BLOB)) + LENGTH(CAST(COALESCE(color, '') AS BLOB)) + LENGTH(CAST(COALESCE(text_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(border_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(color_style, '') AS BLOB))), 0) as textBytes
           FROM teacher_study_levels WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(level_id AS BLOB)) + LENGTH(CAST(school_id AS BLOB)) + LENGTH(CAST(year_id AS BLOB)) + LENGTH(CAST(COALESCE(level_name, '') AS BLOB)) + LENGTH(CAST(COALESCE(name, '') AS BLOB)) + LENGTH(CAST(COALESCE(slogan, '') AS BLOB)) + LENGTH(CAST(COALESCE(teacher_name, '') AS BLOB)) + LENGTH(CAST(COALESCE(subject_label, '') AS BLOB)) + LENGTH(CAST(COALESCE(color, '') AS BLOB)) + LENGTH(CAST(COALESCE(text_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(border_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(border_dark_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(color_style, '') AS BLOB)) + LENGTH(CAST(COALESCE(icon_gradient, '') AS BLOB)) + LENGTH(CAST(COALESCE(mention_rules_json, '') AS BLOB))), 0) as textBytes
           FROM teacher_classes WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(class_id AS BLOB)) + LENGTH(CAST(school_id AS BLOB)) + LENGTH(CAST(year_id AS BLOB)) + LENGTH(CAST(COALESCE(name, '') AS BLOB))), 0) as textBytes
           FROM teacher_terms WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(class_id AS BLOB)) + LENGTH(CAST(term_id AS BLOB)) + LENGTH(CAST(school_id AS BLOB)) + LENGTH(CAST(year_id AS BLOB)) + LENGTH(CAST(COALESCE(name, '') AS BLOB)) + LENGTH(CAST(COALESCE(color, '') AS BLOB)) + LENGTH(CAST(COALESCE(text_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(border_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(border_dark_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(color_style, '') AS BLOB))), 0) as textBytes
           FROM teacher_subjects WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(subject_id AS BLOB)) + LENGTH(CAST(term_id AS BLOB)) + LENGTH(CAST(class_id AS BLOB)) + LENGTH(CAST(school_id AS BLOB)) + LENGTH(CAST(year_id AS BLOB)) + LENGTH(CAST(COALESCE(col_metas_json, '{}') AS BLOB)) + LENGTH(CAST(COALESCE(layout_json, '{}') AS BLOB)) + LENGTH(CAST(COALESCE(styles_json, '{}') AS BLOB))), 0) as textBytes
           FROM teacher_gradebooks WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(gradebook_id AS BLOB)) + LENGTH(CAST(subject_id AS BLOB)) + LENGTH(CAST(term_id AS BLOB)) + LENGTH(CAST(class_id AS BLOB)) + LENGTH(CAST(COALESCE(student_uid, '') AS BLOB)) + LENGTH(CAST(COALESCE(full_name, '') AS BLOB)) + LENGTH(CAST(COALESCE(matricule, '') AS BLOB)) + LENGTH(CAST(COALESCE(photo_r2_key, '') AS BLOB)) + LENGTH(CAST(COALESCE(notes_json, '[]') AS BLOB))), 0) as textBytes
           FROM teacher_gradebook_students WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(class_id AS BLOB)) + LENGTH(CAST(COALESCE(term_id, '') AS BLOB)) + LENGTH(CAST(school_id AS BLOB)) + LENGTH(CAST(year_id AS BLOB)) + LENGTH(CAST(COALESCE(kind, '') AS BLOB)) + LENGTH(CAST(COALESCE(title, '') AS BLOB)) + LENGTH(CAST(COALESCE(color, '') AS BLOB)) + LENGTH(CAST(COALESCE(text_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(border_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(border_dark_color, '') AS BLOB)) + LENGTH(CAST(COALESCE(layout_json, '{}') AS BLOB)) + LENGTH(CAST(COALESCE(styles_json, '{}') AS BLOB)) + LENGTH(CAST(COALESCE(overrides_json, '{}') AS BLOB)) + LENGTH(CAST(COALESCE(sort_mode, '') AS BLOB))), 0) as textBytes
           FROM teacher_class_averages WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(size_bytes), 0) as r2Bytes,
                  COALESCE(SUM(CASE WHEN comp_bytes > 0 THEN comp_bytes ELSE size_bytes END), 0) as compBytes
           FROM (
             SELECT logo_r2_key,
                    MAX(COALESCE(logo_size_bytes, 0)) as size_bytes,
                    MAX(COALESCE(logo_compressed_size_bytes, 0)) as comp_bytes
             FROM teacher_schools
             WHERE user_id = ? AND logo_r2_key IS NOT NULL AND logo_r2_key != ''
             GROUP BY logo_r2_key
           )`
        )
        .bind(userId)
        .first()
        .catch(() => zeroR2),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(size_bytes), 0) as r2Bytes,
                  COALESCE(SUM(CASE WHEN comp_bytes > 0 THEN comp_bytes ELSE size_bytes END), 0) as compBytes
           FROM (
             SELECT photo_r2_key,
                    MAX(COALESCE(photo_size_bytes, 0)) as size_bytes,
                    MAX(COALESCE(photo_compressed_size_bytes, 0)) as comp_bytes
             FROM teacher_gradebook_students
             WHERE user_id = ? AND photo_r2_key IS NOT NULL AND photo_r2_key != ''
             GROUP BY photo_r2_key
           )`
        )
        .bind(userId)
        .first()
        .catch(() => zeroR2),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(COALESCE(title, '') AS BLOB)) + LENGTH(CAST(COALESCE(language, '') AS BLOB)) + LENGTH(CAST(COALESCE(context_year_id, '') AS BLOB)) + LENGTH(CAST(COALESCE(context_school_id, '') AS BLOB)) + LENGTH(CAST(COALESCE(context_class_id, '') AS BLOB)) + LENGTH(CAST(COALESCE(context_term_id, '') AS BLOB)) + LENGTH(CAST(COALESCE(context_subject_id, '') AS BLOB)) + LENGTH(CAST(COALESCE(context_sheet_kind, '') AS BLOB))), 0) as textBytes
           FROM teacher_delmas_conversations WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(conversation_id AS BLOB)) + LENGTH(CAST(COALESCE(sender, '') AS BLOB)) + LENGTH(CAST(COALESCE(content, '') AS BLOB)) + LENGTH(CAST(COALESCE(actions_json, '[]') AS BLOB)) + LENGTH(CAST(COALESCE(attachments_json, '[]') AS BLOB))), 0) as textBytes
           FROM teacher_delmas_messages WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(LENGTH(CAST(id AS BLOB)) + LENGTH(CAST(conversation_id AS BLOB)) + LENGTH(CAST(COALESCE(file_name, '') AS BLOB)) + LENGTH(CAST(COALESCE(mime_type, '') AS BLOB)) + LENGTH(CAST(COALESCE(file_type, '') AS BLOB)) + LENGTH(CAST(COALESCE(r2_key, '') AS BLOB)) + LENGTH(CAST(COALESCE(extracted_text, '') AS BLOB)) + LENGTH(CAST(COALESCE(preview_data_url, '') AS BLOB))), 0) as textBytes
           FROM teacher_delmas_files WHERE user_id = ?`
        )
        .bind(userId)
        .first()
        .catch(() => zeroD1),

      db
        .prepare(
          `SELECT COUNT(*) as cnt,
                  COALESCE(SUM(size_bytes), 0) as r2Bytes,
                  COALESCE(SUM(CASE WHEN comp_bytes > 0 THEN comp_bytes ELSE size_bytes END), 0) as compBytes
           FROM (
             SELECT r2_key,
                    MAX(COALESCE(size_bytes, 0)) as size_bytes,
                    MAX(COALESCE(compressed_size_bytes, 0)) as comp_bytes
             FROM teacher_delmas_files
             WHERE user_id = ? AND r2_key IS NOT NULL AND r2_key != ''
             GROUP BY r2_key
           )`
        )
        .bind(userId)
        .first()
        .catch(() => zeroR2),
    ]);

    const delmasConversationsCount = Number(delmasConvsStat?.cnt || 0);
    const delmasMessagesCount = Number(delmasMsgsStat?.cnt || 0);
    const delmasFilesMetaCount = Number(delmasFilesStat?.cnt || 0);

    const entities = {
      years: Number(yearsStat?.cnt || 0),
      schools: Number(schoolsStat?.cnt || 0),
      levels: Number(levelsStat?.cnt || 0),
      classes: Number(classesStat?.cnt || 0),
      terms: Number(termsStat?.cnt || 0),
      subjects: Number(subjectsStat?.cnt || 0),
      gradebooks: Number(gradebooksStat?.cnt || 0),
      students: Number(studentsStat?.cnt || 0),
      classAverages: Number(classAveragesStat?.cnt || 0),
      delmasConversations: delmasConversationsCount,
      delmasMessages: delmasMessagesCount,
      delmasFiles: delmasFilesMetaCount,
    };

    const delmasD1RowsCount =
      delmasConversationsCount + delmasMessagesCount + delmasFilesMetaCount;
    const delmasD1TextBytes =
      Number(delmasConvsStat?.textBytes || 0) +
      Number(delmasMsgsStat?.textBytes || 0) +
      Number(delmasFilesStat?.textBytes || 0);
    const delmasD1EstimatedBytes =
      delmasD1RowsCount > 0 ? delmasD1TextBytes + delmasD1RowsCount * 160 : 0;

    const d1RowsCount =
      entities.years +
      entities.schools +
      entities.levels +
      entities.classes +
      entities.terms +
      entities.subjects +
      entities.gradebooks +
      entities.students +
      entities.classAverages +
      delmasD1RowsCount;

    const d1TextBytes =
      Number(yearsStat?.textBytes || 0) +
      Number(schoolsStat?.textBytes || 0) +
      Number(levelsStat?.textBytes || 0) +
      Number(classesStat?.textBytes || 0) +
      Number(termsStat?.textBytes || 0) +
      Number(subjectsStat?.textBytes || 0) +
      Number(gradebooksStat?.textBytes || 0) +
      Number(studentsStat?.textBytes || 0) +
      Number(classAveragesStat?.textBytes || 0) +
      delmasD1TextBytes;

    const d1EstimatedBytes = d1RowsCount > 0 ? d1TextBytes + d1RowsCount * 160 : 0;

    const schoolLogosCount = Number(schoolLogosR2?.cnt || 0);
    const schoolLogosBytes = Number(schoolLogosR2?.r2Bytes || 0);
    const schoolLogosCompressedBytes = Number(schoolLogosR2?.compBytes || schoolLogosBytes);
    const studentPhotosCount = Number(studentPhotosR2?.cnt || 0);
    const studentPhotosBytes = Number(studentPhotosR2?.r2Bytes || 0);
    const studentPhotosCompressedBytes = Number(studentPhotosR2?.compBytes || studentPhotosBytes);
    const delmasFilesCount = Number(delmasFilesR2?.cnt || 0);
    const delmasFilesBytes = Number(delmasFilesR2?.r2Bytes || 0);
    const delmasFilesCompressedBytes = Number(delmasFilesR2?.compBytes || delmasFilesBytes);
    const r2FilesCount = schoolLogosCount + studentPhotosCount + delmasFilesCount;
    const r2Bytes = schoolLogosBytes + studentPhotosBytes + delmasFilesBytes;
    const r2CompressedBytes = schoolLogosCompressedBytes + studentPhotosCompressedBytes + delmasFilesCompressedBytes;

    return {
      r2FilesCount,
      r2Bytes,
      r2CompressedBytes,
      schoolLogosCount,
      schoolLogosBytes,
      schoolLogosCompressedBytes,
      studentPhotosCount,
      studentPhotosBytes,
      studentPhotosCompressedBytes,
      delmasFilesCount,
      delmasFilesBytes,
      delmasFilesCompressedBytes,
      delmasConversationsCount,
      delmasMessagesCount,
      delmasFilesMetaCount,
      delmasD1RowsCount,
      delmasD1TextBytes,
      delmasD1EstimatedBytes,
      d1RowsCount,
      d1TextBytes,
      d1EstimatedBytes,
      totalBytes: r2Bytes + d1EstimatedBytes,
      entities,
    };
  } catch {
    return empty;
  }
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

interface WorkerMentionRule {
  min: number;
  label: string;
  scale?: number;
}

function sanitizeAverageScaleWorker(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const num =
    typeof raw === 'string' ? Number(raw.trim().replace(',', '.')) : Number(raw);
  if (!Number.isFinite(num) || num < 1 || num > 1000) return null;
  return Math.round(num * 100) / 100;
}

function sanitizeMentionRulesWorker(raw: any): WorkerMentionRule[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const cleaned: WorkerMentionRule[] = [];
  const seenMins = new Set<number>();
  for (const item of raw.slice(0, 15)) {
    if (!item || typeof item !== 'object') continue;
    const min = Number(item.min);
    const label = String(item.label ?? '').trim().slice(0, 48);
    const parsedScale = sanitizeAverageScaleWorker(item.scale);
    const cap = parsedScale !== null ? parsedScale : 20;
    if (!Number.isFinite(min) || min < 0 || min > cap || !label) continue;
    const roundedMin = Math.round(min * 100) / 100;
    if (seenMins.has(roundedMin)) continue;
    seenMins.add(roundedMin);
    cleaned.push(
      parsedScale !== null
        ? { min: roundedMin, label, scale: parsedScale }
        : { min: roundedMin, label }
    );
  }
  if (cleaned.length === 0) return null;
  cleaned.sort((a, b) => b.min - a.min);
  return cleaned;
}

function extractClassSheetSettings(classRow: any): {
  mentionRules: WorkerMentionRule[] | null;
  showMatricule: boolean;
  averageScale: number;
} {
  if (!classRow) {
    return { mentionRules: null, showMatricule: false, averageScale: 20 };
  }
  const parsedRules = classRow.mention_rules_json
    ? sanitizeMentionRulesWorker(safeParseJson<any>(classRow.mention_rules_json, null))
    : null;
  return {
    mentionRules: parsedRules,
    showMatricule: Number(classRow.show_matricule) === 1,
    averageScale: sanitizeAverageScaleWorker(classRow.average_scale) ?? 20,
  };
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

function computeAverage20Exact(
  notes: string[],
  colMetas: Record<string, any>
): { average: number | null; validNotesCount: number } {
  if (!Array.isArray(notes) || notes.length === 0) {
    return { average: null, validNotesCount: 0 };
  }
  let weightedSum = 0;
  let totalWeight = 0;
  let validNotesCount = 0;
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
    validNotesCount += 1;
  }
  if (totalWeight <= 0) return { average: null, validNotesCount: 0 };
  return { average: weightedSum / totalWeight, validNotesCount };
}

function computeAverage20(notes: string[], colMetas: Record<string, any>): number | null {
  const { average } = computeAverage20Exact(notes, colMetas);
  if (average === null) return null;
  return Math.round(average * 100) / 100;
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

/**
 * Garantit que chaque classe de l'utilisateur possède sa carte "Moyenne générale de l'année"
 * (toujours en 1ère position, sort_order = 0) + 1 carte par trimestre existant de cette classe,
 * et nettoie toute éventuelle carte trimestre orpheline.
 */
async function syncClassAveragesForUser(db: any, userId: string, classesRows: any[], termsRows: any[]): Promise<any[]> {
  const existingRes = await db
    .prepare('SELECT * FROM teacher_class_averages WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC')
    .bind(userId)
    .all();
  const existing: any[] = existingRes.results || [];

  const validClassIds = new Set(classesRows.map((c: any) => String(c.id)));
  const validTermIds = new Set(termsRows.map((t: any) => String(t.id)));
  const hasAnnualByClass = new Set<string>();
  const hasTermCard = new Set<string>();
  const orphanIds: string[] = [];

  for (const row of existing) {
    if (!validClassIds.has(String(row.class_id))) {
      orphanIds.push(String(row.id));
      continue;
    }
    if (row.kind === 'annual' && !row.term_id) {
      hasAnnualByClass.add(String(row.class_id));
    } else if (row.term_id) {
      if (!validTermIds.has(String(row.term_id))) {
        orphanIds.push(String(row.id));
      } else {
        hasTermCard.add(`${row.class_id}:${row.term_id}`);
      }
    }
  }

  const now = Date.now();
  const stmts: any[] = [];

  for (const oid of orphanIds) {
    stmts.push(db.prepare('DELETE FROM teacher_class_averages WHERE id = ? AND user_id = ?').bind(oid, userId));
  }

  for (const cls of classesRows) {
    if (!hasAnnualByClass.has(String(cls.id))) {
      const id = makeId('cavg');
      stmts.push(
        db
          .prepare(
            `INSERT INTO teacher_class_averages
              (id, user_id, class_id, term_id, school_id, year_id, kind, title, sort_order, color, text_color, border_color, border_dark_color, created_at, updated_at)
             VALUES (?, ?, ?, NULL, ?, ?, 'annual', ?, 0, '#ffffff', '#0f172a', '#e2e8f0', '#cbd5e1', ?, ?)`
          )
          .bind(id, userId, cls.id, cls.school_id, cls.year_id, "Moyenne générale de l'année", now, now)
      );
    }
  }

  for (const t of termsRows) {
    const key = `${t.class_id}:${t.id}`;
    if (!hasTermCard.has(key)) {
      const id = makeId('cavg');
      const num = Math.max(1, Number(t.number) || 1);
      stmts.push(
        db
          .prepare(
            `INSERT INTO teacher_class_averages
              (id, user_id, class_id, term_id, school_id, year_id, kind, title, sort_order, color, text_color, border_color, border_dark_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'term', ?, ?, '#ffffff', '#0f172a', '#e2e8f0', '#cbd5e1', ?, ?)`
          )
          .bind(id, userId, t.class_id, t.id, t.school_id, t.year_id, `Moyenne générale · ${t.name}`, num, now + num, now)
      );
    }
  }

  if (stmts.length === 0) {
    return existing;
  }

  await runBatchChunked(db, stmts, 80);
  const refreshed = await db
    .prepare('SELECT * FROM teacher_class_averages WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC')
    .bind(userId)
    .all();
  return refreshed.results || [];
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

  const classAveragesRows = await syncClassAveragesForUser(
    db,
    userId,
    classesRes.results || [],
    termsRes.results || []
  );

  const schoolYears = (yearsRes.results || []).map((r: any) => ({
    id: r.id,
    label: r.label,
    color: r.color || '#00313d',
    textColor: r.text_color || '#ffffff',
    colorStyle: (r.color_style === 'accent' ? 'accent' : 'full') as 'accent' | 'full',
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
      colorStyle: (r.color_style === 'accent' ? 'accent' : 'full') as 'accent' | 'full',
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
    colorStyle: (r.color_style === 'full' ? 'full' : 'accent') as 'accent' | 'full',
    createdAt: Number(r.created_at) || Date.now(),
  }));

  const classes = (classesRes.results || []).map((r: any) => {
    const sheetSettings = extractClassSheetSettings(r);
    return {
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
      colorStyle: (r.color_style === 'full' ? 'full' : 'accent') as 'accent' | 'full',
      iconGradient: r.icon_gradient || 'from-amber-500 to-orange-600',
      mentionRules: sheetSettings.mentionRules,
      showMatricule: sheetSettings.showMatricule,
      averageScale: sheetSettings.averageScale,
      createdAt: Number(r.created_at) || Date.now(),
    };
  });

  const terms = (termsRes.results || []).map((r: any) => ({
    id: r.id,
    classId: r.class_id,
    schoolId: r.school_id,
    yearId: r.year_id,
    number: Number(r.number) || 1,
    name: r.name,
    coefficient: r.coefficient !== null && r.coefficient !== undefined ? Number(r.coefficient) : undefined,
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
    colorStyle: (r.color_style === 'full' ? 'full' : 'accent') as 'accent' | 'full',
    createdAt: Number(r.created_at) || Date.now(),
  }));

  const classAverages = classAveragesRows.map((r: any) => ({
    id: r.id,
    classId: r.class_id,
    termId: r.term_id || undefined,
    schoolId: r.school_id,
    yearId: r.year_id,
    kind: (r.kind === 'annual' ? 'annual' : 'term') as 'annual' | 'term',
    title: r.title,
    sortOrder: Number(r.sort_order) || 0,
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
    classAverages,
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
    return errorResponse('Service de stockage temporairement indisponible.', 503, origin);
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

    const rawContentType = String(obj.httpMetadata?.contentType || 'application/octet-stream')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const isSafeInline = SAFE_INLINE_MEDIA_MIMES.has(rawContentType);
    const servedContentType = isSafeInline ? rawContentType : 'application/octet-stream';
    const mediaHeaders: Record<string, string> = {
      'Content-Type': servedContentType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=3600',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      ...corsHeaders(origin),
    };
    if (!isSafeInline) {
      mediaHeaders['Content-Disposition'] = 'attachment';
    }
    return new Response(obj.body, {
      status: 200,
      headers: mediaHeaders,
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

  const response = await dispatchTeacherGradebookRoutes(
    request,
    url,
    path,
    method,
    userId,
    apiOrigin,
    deps
  );

  // Recalcul immédiat de user_storage_usage (R2 + D1) après toute écriture, upload, mise à jour ou suppression réussie
  if (
    deps.recalculateUserStorage &&
    (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
    response.status >= 200 &&
    response.status < 300
  ) {
    await deps.recalculateUserStorage(userId).catch(() => {});
  }

  return response;
}

async function dispatchTeacherGradebookRoutes(
  request: Request,
  url: URL,
  path: string,
  method: string,
  userId: string,
  apiOrigin: string,
  deps: TeacherWorkerDeps
): Promise<Response> {
  const { db, rawEnv, origin, jwtSecret, corsHeaders, jsonResponse, errorResponse, checkStorageQuota } = deps;

  const enforceStorageQuota = async (incomingBytes: number): Promise<Response | null> => {
    if (!checkStorageQuota) return null;
    const quotaCheck = await checkStorageQuota(userId, Math.max(0, Math.ceil(incomingBytes)));
    if (!quotaCheck.allowed) {
      return storageLimitExceededResponse(quotaCheck, origin, corsHeaders);
    }
    return null;
  };

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
    const colorStyle = body.colorStyle === 'accent' ? 'accent' : 'full';

    const quotaBlocked = await enforceStorageQuota(
      utf8ByteLength(id) + utf8ByteLength(label) + utf8ByteLength(color) + utf8ByteLength(textColor) + utf8ByteLength(colorStyle) + 160
    );
    if (quotaBlocked) return quotaBlocked;

    await db
      .prepare(
        `INSERT INTO teacher_school_years (id, user_id, label, color, text_color, color_style, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, label, color, textColor, colorStyle, now, now)
      .run();

    return jsonResponse({
      success: true,
      year: { id, label, color, textColor, colorStyle, createdAt: now },
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
    const colorStyle =
      body.colorStyle === 'accent' || body.colorStyle === 'full'
        ? body.colorStyle
        : existing.color_style === 'accent'
        ? 'accent'
        : 'full';
    const now = Date.now();

    const deltaBytes = Math.max(1, utf8ByteLength(label) - utf8ByteLength(existing.label));
    const quotaBlocked = await enforceStorageQuota(deltaBytes);
    if (quotaBlocked) return quotaBlocked;

    await db
      .prepare(
        `UPDATE teacher_school_years
         SET label = ?, color = ?, text_color = ?, color_style = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(label, color, textColor, colorStyle, now, yearId, userId)
      .run();

    return jsonResponse({
      success: true,
      year: {
        id: yearId,
        label,
        color,
        textColor,
        colorStyle,
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
      db.prepare('DELETE FROM teacher_class_averages WHERE year_id = ? AND user_id = ?').bind(yearId, userId),
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
    let logoSizeBytes = 0;
    let pendingLogoUpload: { key: string; bytes: Uint8Array; contentType: string } | null = null;

    if (typeof body.logoDataUrl === 'string' && body.logoDataUrl.startsWith('data:image/')) {
      const bytes = decodeBase64DataUrl(body.logoDataUrl);
      const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
      if (!bytes || !fmt) return errorResponse('Format de logo invalide (PNG/JPEG/WebP, max 600 Ko).', 400, origin);
      const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      logoR2Key = `teacher-school-logos/${sanitizeSegment(userId)}/${sanitizeSegment(id)}_${now}_${rand}.${fmt.ext}`;
      const rawOrig = Math.floor(Number(body.logoOriginalSizeBytes) || 0);
      logoSizeBytes = Math.max(bytes.byteLength, Math.min(100 * 1024 * 1024, rawOrig));
      pendingLogoUpload = { key: logoR2Key, bytes, contentType: fmt.contentType };
    }

    const color = String(body.color || '#ffffff').slice(0, 32);
    const textColor = String(body.textColor || '#0f172a').slice(0, 32);
    const borderColor = String(body.borderColor || '#e2e8f0').slice(0, 32);
    const borderDarkColor = String(body.borderDarkColor || '#cbd5e1').slice(0, 32);
    const colorStyle = body.colorStyle === 'accent' ? 'accent' : 'full';

    const incomingSchoolBytes =
      logoSizeBytes +
      utf8ByteLength(id) +
      utf8ByteLength(yearId) +
      utf8ByteLength(name) +
      utf8ByteLength(logoR2Key || '') +
      utf8ByteLength(color) +
      utf8ByteLength(textColor) +
      utf8ByteLength(borderColor) +
      utf8ByteLength(borderDarkColor) +
      utf8ByteLength(colorStyle) +
      160;
    const quotaBlocked = await enforceStorageQuota(incomingSchoolBytes);
    if (quotaBlocked) return quotaBlocked;

    if (pendingLogoUpload) {
      await uploadImageBytesToR2(rawEnv, pendingLogoUpload.key, pendingLogoUpload.bytes, pendingLogoUpload.contentType, {
        userId: sanitizeSegment(userId),
        kind: 'school_logo',
        schoolId: sanitizeSegment(id),
        originalSizeBytes: String(logoSizeBytes),
      });
    }

    await db
      .prepare(
        `INSERT INTO teacher_schools
          (id, user_id, year_id, name, logo_r2_key, logo_size_bytes, color, text_color, border_color, border_dark_color, color_style, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, yearId, name, logoR2Key, logoSizeBytes, color, textColor, borderColor, borderDarkColor, colorStyle, now, now)
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
        colorStyle,
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
    let logoSizeBytes: number = Number(existing.logo_size_bytes || 0);
    let oldKeyToDelete: string | null = null;
    let pendingLogoUpload: { key: string; bytes: Uint8Array; contentType: string } | null = null;

    if (body.removeLogo === true) {
      oldKeyToDelete = logoR2Key;
      logoR2Key = null;
      logoSizeBytes = 0;
    } else if (typeof body.logoDataUrl === 'string' && body.logoDataUrl.startsWith('data:image/')) {
      const bytes = decodeBase64DataUrl(body.logoDataUrl);
      const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
      if (!bytes || !fmt) return errorResponse('Format de logo invalide (PNG/JPEG/WebP, max 600 Ko).', 400, origin);
      const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      const newKey = `teacher-school-logos/${sanitizeSegment(userId)}/${sanitizeSegment(schoolId)}_${now}_${rand}.${fmt.ext}`;
      const rawOrig = Math.floor(Number(body.logoOriginalSizeBytes) || 0);
      oldKeyToDelete = logoR2Key;
      logoR2Key = newKey;
      logoSizeBytes = Math.max(bytes.byteLength, Math.min(100 * 1024 * 1024, rawOrig));
      pendingLogoUpload = { key: newKey, bytes, contentType: fmt.contentType };
    }

    const isPureLogoRemoval = body.removeLogo === true && !pendingLogoUpload && name === String(existing.name || '');
    if (!isPureLogoRemoval) {
      const incomingDelta =
        (pendingLogoUpload ? Math.max(logoSizeBytes, 1) : 0) +
        Math.max(1, utf8ByteLength(name) - utf8ByteLength(existing.name));
      const quotaBlocked = await enforceStorageQuota(incomingDelta);
      if (quotaBlocked) return quotaBlocked;
    }

    if (pendingLogoUpload) {
      await uploadImageBytesToR2(rawEnv, pendingLogoUpload.key, pendingLogoUpload.bytes, pendingLogoUpload.contentType, {
        userId: sanitizeSegment(userId),
        kind: 'school_logo',
        schoolId: sanitizeSegment(schoolId),
        originalSizeBytes: String(logoSizeBytes),
      });
    }

    const color = String(body.color || existing.color).slice(0, 32);
    const textColor = String(body.textColor || existing.text_color).slice(0, 32);
    const borderColor = String(body.borderColor || existing.border_color).slice(0, 32);
    const borderDarkColor = String(body.borderDarkColor || existing.border_dark_color).slice(0, 32);
    const colorStyle =
      body.colorStyle === 'accent' || body.colorStyle === 'full'
        ? body.colorStyle
        : existing.color_style === 'accent'
        ? 'accent'
        : 'full';

    await db
      .prepare(
        `UPDATE teacher_schools
         SET name = ?, logo_r2_key = ?, logo_size_bytes = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, color_style = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(name, logoR2Key, logoSizeBytes, color, textColor, borderColor, borderDarkColor, colorStyle, now, schoolId, userId)
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
        colorStyle,
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
      db.prepare('DELETE FROM teacher_class_averages WHERE school_id = ? AND user_id = ?').bind(schoolId, userId),
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
    const colorStyle = body.colorStyle === 'full' ? 'full' : 'accent';

    const quotaBlocked = await enforceStorageQuota(
      utf8ByteLength(id) + utf8ByteLength(schoolId) + utf8ByteLength(ownSchool.year_id) + utf8ByteLength(name) + utf8ByteLength(color) + utf8ByteLength(textColor) + utf8ByteLength(borderColor) + utf8ByteLength(colorStyle) + 160
    );
    if (quotaBlocked) return quotaBlocked;

    await db
      .prepare(
        `INSERT INTO teacher_study_levels (id, user_id, school_id, year_id, name, color, text_color, border_color, color_style, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, schoolId, ownSchool.year_id, name, color, textColor, borderColor, colorStyle, Number(body.sortOrder) || 0, now, now)
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
        colorStyle,
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
    const colorStyle =
      body.colorStyle === 'accent' || body.colorStyle === 'full'
        ? body.colorStyle
        : existing.color_style === 'full'
        ? 'full'
        : 'accent';

    const quotaBlocked = await enforceStorageQuota(Math.max(1, utf8ByteLength(name) - utf8ByteLength(existing.name)));
    if (quotaBlocked) return quotaBlocked;

    await db.batch([
      db
        .prepare(
          `UPDATE teacher_study_levels
           SET name = ?, color = ?, text_color = ?, border_color = ?, color_style = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .bind(name, color, textColor, borderColor, colorStyle, now, levelId, userId),
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
        colorStyle,
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
      db.prepare(`DELETE FROM teacher_class_averages WHERE user_id = ? AND class_id IN (SELECT id FROM teacher_classes WHERE level_id = ? AND user_id = ?)`).bind(userId, levelId, userId),
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
    const colorStyle = body.colorStyle === 'full' ? 'full' : 'accent';
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

    const annualAvgCard = {
      id: makeId('cavg'),
      classId,
      termId: undefined as string | undefined,
      schoolId: ownLevel.school_id,
      yearId: ownLevel.year_id,
      kind: 'annual' as const,
      title: "Moyenne générale de l'année",
      sortOrder: 0,
      color: '#ffffff',
      textColor: '#0f172a',
      borderColor: '#e2e8f0',
      borderDarkColor: '#cbd5e1',
      createdAt: now,
    };

    const termAvgCards = defaultTerms.map((t: any) => ({
      id: makeId('cavg'),
      classId,
      termId: t.id as string,
      schoolId: ownLevel.school_id,
      yearId: ownLevel.year_id,
      kind: 'term' as const,
      title: `Moyenne générale · ${t.name}`,
      sortOrder: t.number,
      color: '#ffffff',
      textColor: '#0f172a',
      borderColor: '#e2e8f0',
      borderDarkColor: '#cbd5e1',
      createdAt: t.createdAt,
    }));

    const allClassAverages = [annualAvgCard, ...termAvgCards];

    const incomingClassBytes =
      utf8ByteLength(classId) +
      utf8ByteLength(name) +
      utf8ByteLength(slogan || '') +
      utf8ByteLength(teacherName) +
      utf8ByteLength(ownLevel.name) +
      defaultTerms.reduce((acc: number, t: any) => acc + utf8ByteLength(t.id) + utf8ByteLength(t.name) + 160, 0) +
      allClassAverages.reduce((acc, ca) => acc + utf8ByteLength(ca.id) + utf8ByteLength(ca.title) + 160, 0) +
      240;
    const quotaBlocked = await enforceStorageQuota(incomingClassBytes);
    if (quotaBlocked) return quotaBlocked;

    const stmts = [
      db
        .prepare(
          `INSERT INTO teacher_classes
            (id, user_id, level_id, school_id, year_id, level_name, name, slogan, teacher_name, subject_label, color, text_color, border_color, border_dark_color, color_style, icon_gradient, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          classId, userId, levelId, ownLevel.school_id, ownLevel.year_id,
          ownLevel.name, name, slogan, teacherName,
          color, textColor, borderColor, borderDarkColor, colorStyle, iconGradient,
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
      ...allClassAverages.map((ca) =>
        db
          .prepare(
            `INSERT INTO teacher_class_averages
              (id, user_id, class_id, term_id, school_id, year_id, kind, title, sort_order, color, text_color, border_color, border_dark_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            ca.id, userId, ca.classId, ca.termId ?? null, ca.schoolId, ca.yearId,
            ca.kind, ca.title, ca.sortOrder, ca.color, ca.textColor, ca.borderColor, ca.borderDarkColor,
            ca.createdAt, now
          )
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
        colorStyle,
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
      classAverages: allClassAverages,
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
    const colorStyle =
      body.colorStyle === 'accent' || body.colorStyle === 'full'
        ? body.colorStyle
        : existing.color_style === 'full'
        ? 'full'
        : 'accent';
    const iconGradient = String(body.iconGradient || existing.icon_gradient).slice(0, 80);
    const now = Date.now();

    const incomingDelta = Math.max(
      1,
      utf8ByteLength(name) + utf8ByteLength(slogan || '') + utf8ByteLength(teacherName) -
        (utf8ByteLength(existing.name) + utf8ByteLength(existing.slogan || '') + utf8ByteLength(existing.teacher_name))
    );
    const quotaBlocked = await enforceStorageQuota(incomingDelta);
    if (quotaBlocked) return quotaBlocked;

    await db
      .prepare(
        `UPDATE teacher_classes
         SET name = ?, slogan = ?, teacher_name = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, color_style = ?, icon_gradient = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(name, slogan, teacherName, color, textColor, borderColor, borderDarkColor, colorStyle, iconGradient, now, classId, userId)
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
        colorStyle,
        iconGradient,
        ...extractClassSheetSettings(existing),
        createdAt: Number(existing.created_at),
      },
    }, 200, origin);
  }

  // Paramètres de tableaux appliqués à toute une classe (mentions personnalisées + colonne Matricule + moyenne max)
  const classSheetSettingsMatch = path.match(/^\/api\/teacher\/classes\/([^/]+)\/sheet-settings$/);
  if (classSheetSettingsMatch && method === 'PUT') {
    const classId = decodeURIComponent(classSheetSettingsMatch[1]);
    const existing: any = await db
      .prepare('SELECT id, mention_rules_json, show_matricule, average_scale FROM teacher_classes WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(classId, userId)
      .first();
    if (!existing) return errorResponse('Classe introuvable ou non autorisée.', 404, origin);

    const body: any = await request.json().catch(() => ({}));
    const hasMentionUpdate = Object.prototype.hasOwnProperty.call(body, 'mentionRules');
    const hasMatriculeUpdate = Object.prototype.hasOwnProperty.call(body, 'showMatricule');
    const hasScaleUpdate = Object.prototype.hasOwnProperty.call(body, 'averageScale');
    const now = Date.now();

    let nextMentionRulesJson: string | null = existing.mention_rules_json ?? null;
    if (hasMentionUpdate) {
      if (body.mentionRules === null) {
        nextMentionRulesJson = null;
      } else {
        const sanitized = sanitizeMentionRulesWorker(body.mentionRules);
        if (!sanitized) {
          return errorResponse('Les intervalles de mention sont invalides.', 400, origin);
        }
        nextMentionRulesJson = JSON.stringify(sanitized);
      }
    }

    let nextShowMatricule: number = Number(existing.show_matricule) === 1 ? 1 : 0;
    if (hasMatriculeUpdate) {
      nextShowMatricule = body.showMatricule ? 1 : 0;
    }

    let nextAverageScale: number = sanitizeAverageScaleWorker(existing.average_scale) ?? 20;
    if (hasScaleUpdate) {
      const parsedScale = sanitizeAverageScaleWorker(body.averageScale);
      if (parsedScale === null) {
        return errorResponse('La moyenne maximale doit être comprise entre 1 et 1000.', 400, origin);
      }
      nextAverageScale = parsedScale;
    }

    const incomingSettingsDelta = Math.max(
      1,
      utf8ByteLength(nextMentionRulesJson || '') - utf8ByteLength(existing.mention_rules_json || '')
    );
    const quotaBlocked = await enforceStorageQuota(incomingSettingsDelta);
    if (quotaBlocked) return quotaBlocked;

    const stmts: any[] = [
      db
        .prepare(
          `UPDATE teacher_classes
           SET mention_rules_json = ?, show_matricule = ?, average_scale = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .bind(nextMentionRulesJson, nextShowMatricule, nextAverageScale, now, classId, userId),
    ];

    // Nettoyer les surcharges locales obsolètes sur tous les tableaux existants de la classe
    // afin que le choix "Appliquer à toute la classe" prenne immédiatement effet partout.
    if (hasMentionUpdate || hasMatriculeUpdate || hasScaleUpdate) {
      const [gbsRes, avgsRes] = await Promise.all([
        db
          .prepare('SELECT id, layout_json FROM teacher_gradebooks WHERE user_id = ? AND class_id = ?')
          .bind(userId, classId)
          .all(),
        db
          .prepare('SELECT id, layout_json FROM teacher_class_averages WHERE user_id = ? AND class_id = ?')
          .bind(userId, classId)
          .all(),
      ]);

      for (const gb of gbsRes.results || []) {
        const parsed = safeParseJson<Record<string, any>>(gb.layout_json, {});
        let changed = false;
        if (hasMentionUpdate && Object.prototype.hasOwnProperty.call(parsed, 'mentionRules')) {
          delete parsed.mentionRules;
          changed = true;
        }
        if (hasMatriculeUpdate && Object.prototype.hasOwnProperty.call(parsed, 'showMatricule')) {
          delete parsed.showMatricule;
          changed = true;
        }
        if (hasScaleUpdate && Object.prototype.hasOwnProperty.call(parsed, 'averageScale')) {
          delete parsed.averageScale;
          changed = true;
        }
        if (changed) {
          stmts.push(
            db
              .prepare('UPDATE teacher_gradebooks SET layout_json = ?, updated_at = ? WHERE id = ? AND user_id = ?')
              .bind(JSON.stringify(parsed), now, gb.id, userId)
          );
        }
      }

      for (const avg of avgsRes.results || []) {
        const parsed = safeParseJson<Record<string, any>>(avg.layout_json, {});
        let changed = false;
        if (hasMentionUpdate && Object.prototype.hasOwnProperty.call(parsed, 'mentionRules')) {
          delete parsed.mentionRules;
          changed = true;
        }
        if (hasMatriculeUpdate && Object.prototype.hasOwnProperty.call(parsed, 'showMatricule')) {
          delete parsed.showMatricule;
          changed = true;
        }
        if (hasScaleUpdate && Object.prototype.hasOwnProperty.call(parsed, 'averageScale')) {
          delete parsed.averageScale;
          changed = true;
        }
        if (changed) {
          stmts.push(
            db
              .prepare('UPDATE teacher_class_averages SET layout_json = ?, updated_at = ? WHERE id = ? AND user_id = ?')
              .bind(JSON.stringify(parsed), now, avg.id, userId)
          );
        }
      }
    }

    await runBatchChunked(db, stmts, 60);

    const updatedSettings = extractClassSheetSettings({
      mention_rules_json: nextMentionRulesJson,
      show_matricule: nextShowMatricule,
      average_scale: nextAverageScale,
    });

    return jsonResponse(
      {
        success: true,
        classId,
        classSettings: updatedSettings,
      },
      200,
      origin
    );
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
      db.prepare('DELETE FROM teacher_class_averages WHERE class_id = ? AND user_id = ?').bind(classId, userId),
      db.prepare('DELETE FROM teacher_subjects WHERE class_id = ? AND user_id = ?').bind(classId, userId),
      db.prepare('DELETE FROM teacher_terms WHERE class_id = ? AND user_id = ?').bind(classId, userId),
      db.prepare('DELETE FROM teacher_classes WHERE id = ? AND user_id = ?').bind(classId, userId),
    ]);

    await deleteOwnedR2Keys(rawEnv, userId, r2Keys);
    return jsonResponse({ success: true, deletedId: classId }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 6. TRIMESTRES (POST, PUT, DELETE)
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

    const coeffRaw = body.coefficient !== undefined && body.coefficient !== null && body.coefficient !== '' ? Number(body.coefficient) : null;
    const coefficient = coeffRaw !== null && Number.isFinite(coeffRaw) && coeffRaw > 0 ? coeffRaw : null;

    const now = Date.now();
    const id = await resolveSafeNewId(db, 'teacher_terms', body.id, 'term');
    const classAverage = {
      id: makeId('cavg'),
      classId,
      termId: id,
      schoolId: ownClass.school_id,
      yearId: ownClass.year_id,
      kind: 'term' as const,
      title: `Moyenne générale · ${name}`,
      sortOrder: number,
      color: '#ffffff',
      textColor: '#0f172a',
      borderColor: '#e2e8f0',
      borderDarkColor: '#cbd5e1',
      createdAt: now,
    };

    const quotaBlocked = await enforceStorageQuota(
      utf8ByteLength(id) + utf8ByteLength(name) + utf8ByteLength(classAverage.id) + utf8ByteLength(classAverage.title) + 320
    );
    if (quotaBlocked) return quotaBlocked;

    await db.batch([
      db
        .prepare(
          `INSERT INTO teacher_terms (id, user_id, class_id, school_id, year_id, number, name, coefficient, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, userId, classId, ownClass.school_id, ownClass.year_id, number, name, coefficient, now, now),
      db
        .prepare(
          `INSERT INTO teacher_class_averages
            (id, user_id, class_id, term_id, school_id, year_id, kind, title, sort_order, color, text_color, border_color, border_dark_color, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'term', ?, ?, '#ffffff', '#0f172a', '#e2e8f0', '#cbd5e1', ?, ?)`
        )
        .bind(classAverage.id, userId, classId, id, ownClass.school_id, ownClass.year_id, classAverage.title, number, now, now),
    ]);

    return jsonResponse({
      success: true,
      term: {
        id,
        classId,
        schoolId: ownClass.school_id,
        yearId: ownClass.year_id,
        number,
        name,
        coefficient: coefficient ?? undefined,
        createdAt: now,
      },
      classAverage,
    }, 201, origin);
  }

  const termItemMatch = path.match(/^\/api\/teacher\/terms\/([^/]+)$/);
  if (termItemMatch && method === 'PUT') {
    const termId = decodeURIComponent(termItemMatch[1]);
    const existing: any = await db
      .prepare('SELECT * FROM teacher_terms WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(termId, userId)
      .first();
    if (!existing) return errorResponse('Trimestre introuvable.', 404, origin);

    const body: any = await request.json().catch(() => ({}));
    const name = body.name !== undefined ? String(body.name || '').trim().slice(0, 50) : String(existing.name);
    if (!name) return errorResponse('Nom du trimestre requis.', 400, origin);

    let coefficient: number | null =
      existing.coefficient !== null && existing.coefficient !== undefined ? Number(existing.coefficient) : null;
    if (body.coefficient !== undefined) {
      if (body.coefficient === null || body.coefficient === '') {
        coefficient = null;
      } else {
        const parsed = Number(body.coefficient);
        coefficient = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      }
    }

    const now = Date.now();
    const quotaBlocked = await enforceStorageQuota(Math.max(1, utf8ByteLength(name) - utf8ByteLength(existing.name)));
    if (quotaBlocked) return quotaBlocked;

    await db.batch([
      db
        .prepare(
          `UPDATE teacher_terms
           SET name = ?, coefficient = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .bind(name, coefficient, now, termId, userId),
      db
        .prepare(
          `UPDATE teacher_class_averages
           SET title = ?, updated_at = ?
           WHERE term_id = ? AND user_id = ? AND kind = 'term'`
        )
        .bind(`Moyenne générale · ${name}`, now, termId, userId),
    ]);

    return jsonResponse({
      success: true,
      term: {
        id: termId,
        classId: existing.class_id,
        schoolId: existing.school_id,
        yearId: existing.year_id,
        number: Number(existing.number) || 1,
        name,
        coefficient: coefficient ?? undefined,
        createdAt: Number(existing.created_at),
      },
    }, 200, origin);
  }

  if (termItemMatch && method === 'DELETE') {
    const termId = decodeURIComponent(termItemMatch[1]);
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
      db.prepare('DELETE FROM teacher_class_averages WHERE term_id = ? AND user_id = ?').bind(termId, userId),
      db.prepare('DELETE FROM teacher_subjects WHERE term_id = ? AND user_id = ?').bind(termId, userId),
      db.prepare('DELETE FROM teacher_terms WHERE id = ? AND user_id = ?').bind(termId, userId),
    ]);

    await deleteUnreferencedStudentR2Keys(db, rawEnv, userId, r2Keys);
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
    const coefficient = coeffRaw !== null && Number.isFinite(coeffRaw) && coeffRaw > 0 ? coeffRaw : null;
    const color = String(body.color || '#ffffff').slice(0, 32);
    const textColor = String(body.textColor || '#0f172a').slice(0, 32);
    const borderColor = String(body.borderColor || '#e2e8f0').slice(0, 32);
    const borderDarkColor = String(body.borderDarkColor || '#cbd5e1').slice(0, 32);
    const colorStyle = body.colorStyle === 'full' ? 'full' : 'accent';

    const quotaBlocked = await enforceStorageQuota(
      utf8ByteLength(id) + utf8ByteLength(name) + utf8ByteLength(color) + utf8ByteLength(textColor) + utf8ByteLength(borderColor) + utf8ByteLength(borderDarkColor) + 200
    );
    if (quotaBlocked) return quotaBlocked;

    await db
      .prepare(
        `INSERT INTO teacher_subjects
          (id, user_id, class_id, term_id, school_id, year_id, name, coefficient, color, text_color, border_color, border_dark_color, color_style, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, userId, classId, termId, ownClass.school_id, ownClass.year_id, name, coefficient, color, textColor, borderColor, borderDarkColor, colorStyle, now, now)
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
        colorStyle,
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

    let coefficient: number | null =
      existing.coefficient !== null && existing.coefficient !== undefined ? Number(existing.coefficient) : null;
    if (body.coefficient !== undefined) {
      if (body.coefficient === null || body.coefficient === '') coefficient = null;
      else {
        const parsed = Number(body.coefficient);
        coefficient = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      }
    }

    const color = String(body.color || existing.color).slice(0, 32);
    const textColor = String(body.textColor || existing.text_color).slice(0, 32);
    const borderColor = String(body.borderColor || existing.border_color).slice(0, 32);
    const borderDarkColor = String(body.borderDarkColor || existing.border_dark_color).slice(0, 32);
    const colorStyle =
      body.colorStyle === 'accent' || body.colorStyle === 'full'
        ? body.colorStyle
        : existing.color_style === 'full'
        ? 'full'
        : 'accent';
    const now = Date.now();
    const quotaBlocked = await enforceStorageQuota(Math.max(1, utf8ByteLength(name) - utf8ByteLength(existing.name)));
    if (quotaBlocked) return quotaBlocked;

    await db
      .prepare(
        `UPDATE teacher_subjects
         SET name = ?, coefficient = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, color_style = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(name, coefficient, color, textColor, borderColor, borderDarkColor, colorStyle, now, subjectId, userId)
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
        colorStyle,
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

    await deleteUnreferencedStudentR2Keys(db, rawEnv, userId, r2Keys);
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

    const [gb, classRow]: any[] = await Promise.all([
      db
        .prepare('SELECT * FROM teacher_gradebooks WHERE user_id = ? AND subject_id = ? AND term_id = ? LIMIT 1')
        .bind(userId, subjectId, termId)
        .first(),
      db
        .prepare('SELECT mention_rules_json, show_matricule, average_scale FROM teacher_classes WHERE id = ? AND user_id = ? LIMIT 1')
        .bind(ownSubject.class_id, userId)
        .first(),
    ]);
    const classSettings = extractClassSheetSettings(classRow);

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
        classSettings,
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

    const hasR2Bucket = Boolean(getTeacherPhotosBucket(rawEnv));
    const missingR2StudentIds: string[] = [];

    const students = await Promise.all(
      (stRes.results || []).map(async (row: any) => {
        let validPhotoKey: string | undefined = row.photo_r2_key || undefined;
        let photoSizeBytes = Number(row.photo_size_bytes || 0);
        if (validPhotoKey && hasR2Bucket) {
          const r2Size = await getOwnedR2ObjectSize(rawEnv, validPhotoKey);
          if (r2Size <= 0) {
            // Auto-réparation : si la clé R2 en D1 pointe vers un objet supprimé, la nettoyer pour ne jamais afficher une icône d'image cassée
            validPhotoKey = undefined;
            photoSizeBytes = 0;
            missingR2StudentIds.push(String(row.id));
          } else if (photoSizeBytes <= 0) {
            photoSizeBytes = r2Size;
          }
        }
        return {
          id: row.id,
          studentUid: row.student_uid || row.id,
          name: row.full_name || '',
          matricule: row.matricule || '',
          photoR2Key: validPhotoKey,
          photoSizeBytes: validPhotoKey ? photoSizeBytes : undefined,
          photoUrl: validPhotoKey ? await signTeacherMediaUrl(apiOrigin, validPhotoKey, jwtSecret) : undefined,
          notes: safeParseJson<string[]>(row.notes_json, []),
        };
      })
    );

    if (missingR2StudentIds.length > 0) {
      for (const sid of missingR2StudentIds) {
        await db
          .prepare('UPDATE teacher_gradebook_students SET photo_r2_key = NULL, photo_size_bytes = 0, photo_compressed_size_bytes = 0 WHERE id = ? AND user_id = ?')
          .bind(sid, userId)
          .run()
          .catch(() => {});
      }
      if (deps.recalculateUserStorage) {
        await deps.recalculateUserStorage(userId).catch(() => {});
      }
    }

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
      classSettings,
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
      .prepare('SELECT id, version, col_metas_json, layout_json, styles_json FROM teacher_gradebooks WHERE user_id = ? AND subject_id = ? AND term_id = ? LIMIT 1')
      .bind(userId, subjectId, termId)
      .first();

    const gradebookId = existingGb ? existingGb.id : makeId('gb');
    const nextVersion = existingGb ? (Number(existingGb.version) || 1) + 1 : 1;

    // Charger les photo_r2_key + tailles existantes pour nettoyer les photos supprimées et calculer le delta exact
    const [prevPhotosRes, knownPhotoSizesRes] = await Promise.all([
      existingGb
        ? db
            .prepare('SELECT id, full_name, matricule, photo_r2_key, photo_size_bytes, notes_json FROM teacher_gradebook_students WHERE user_id = ? AND gradebook_id = ?')
            .bind(userId, gradebookId)
            .all()
        : Promise.resolve({ results: [] }),
      db
        .prepare('SELECT photo_r2_key, MAX(COALESCE(photo_size_bytes, 0)) as sz FROM teacher_gradebook_students WHERE user_id = ? AND photo_r2_key IS NOT NULL GROUP BY photo_r2_key')
        .bind(userId)
        .all()
        .catch(() => ({ results: [] })),
    ]);

    const prevKeyByStudentId = new Map<string, string>();
    const knownPhotoSizeByKey = new Map<string, number>();
    let existingD1Bytes = 0;
    if (existingGb) {
      existingD1Bytes +=
        utf8ByteLength(existingGb.col_metas_json) +
        utf8ByteLength(existingGb.layout_json) +
        utf8ByteLength(existingGb.styles_json) +
        160;
    }
    for (const r of prevPhotosRes.results || []) {
      if (r.photo_r2_key) {
        prevKeyByStudentId.set(r.id, r.photo_r2_key);
        if (Number(r.photo_size_bytes) > 0) {
          knownPhotoSizeByKey.set(r.photo_r2_key, Number(r.photo_size_bytes));
        }
      }
      existingD1Bytes +=
        utf8ByteLength(r.id) +
        utf8ByteLength(r.full_name) +
        utf8ByteLength(r.matricule) +
        utf8ByteLength(r.photo_r2_key) +
        utf8ByteLength(r.notes_json) +
        160;
    }
    for (const r of knownPhotoSizesRes.results || []) {
      if (r.photo_r2_key && Number(r.sz) > 0) {
        knownPhotoSizeByKey.set(String(r.photo_r2_key), Number(r.sz));
      }
    }

    const colMetasStr = JSON.stringify(columnMetas);
    const layoutStr = JSON.stringify(layout);

    // Protection structurelle anti-collision de clé primaire `teacher_gradebook_students.id` :
    // Si une ligne copiée depuis une autre matière (ou un autre tableur / compte) réutilise un `id`
    // déjà présent dans un AUTRE `gradebook_id` (ou dupliqué dans ce même payload), on lui attribue
    // automatiquement un nouvel `id` unique tout en conservant intact son `student_uid` (liaison inter-matières).
    const candidateRowIds = Array.from(
      new Set(
        incomingStudents
          .map((s: any) =>
            s && typeof s.id === 'string' && s.id.trim().length > 0 && s.id.length <= 80
              ? s.id.trim()
              : ''
          )
          .filter(Boolean)
      )
    );
    const collidingRowIds = new Set<string>();
    for (let i = 0; i < candidateRowIds.length; i += 60) {
      const chunk = candidateRowIds.slice(i, i + 60);
      const placeholders = chunk.map(() => '?').join(', ');
      const found = await db
        .prepare(
          `SELECT id FROM teacher_gradebook_students
           WHERE id IN (${placeholders}) AND (gradebook_id != ? OR user_id != ?)`
        )
        .bind(...chunk, gradebookId, userId)
        .all()
        .catch(() => ({ results: [] }));
      for (const r of found.results || []) {
        if (r?.id) collidingRowIds.add(String(r.id));
      }
    }

    const assignedRowIds = new Set<string>();
    const remappedRowIdMap = new Map<string, string>();
    const keptR2Keys = new Set<string>();
    const pendingPhotoUploads: Array<{
      key: string;
      bytes: Uint8Array;
      contentType: string;
      studentId: string;
    }> = [];
    const preparedRows: Array<{
      id: string;
      studentUid: string;
      rowOrder: number;
      fullName: string;
      matricule: string;
      photoR2Key: string | null;
      photoSizeBytes: number;
      notesJson: string;
      average20: number | null;
    }> = [];

    let newD1Bytes = utf8ByteLength(colMetasStr) + utf8ByteLength(layoutStr) + 160;
    let newPhotoBytes = 0;

    for (let idx = 0; idx < incomingStudents.length; idx++) {
      const s = incomingStudents[idx] || {};
      const rawCandidateId =
        s.id && typeof s.id === 'string' && s.id.trim().length > 0 && s.id.length <= 80
          ? s.id.trim()
          : '';
      const needsFreshRowId =
        !rawCandidateId ||
        collidingRowIds.has(rawCandidateId) ||
        assignedRowIds.has(rawCandidateId);
      const rowId = needsFreshRowId ? makeId('std') : rawCandidateId;
      assignedRowIds.add(rowId);
      if (rawCandidateId && rowId !== rawCandidateId && !remappedRowIdMap.has(rawCandidateId)) {
        remappedRowIdMap.set(rawCandidateId, rowId);
      }
      const studentUid =
        s.studentUid &&
        typeof s.studentUid === 'string' &&
        s.studentUid.trim().length > 0 &&
        s.studentUid.length <= 80
          ? s.studentUid.trim()
          : rawCandidateId || rowId;
      const fullName = String(s.name || '').slice(0, 160);
      const matricule = String(s.matricule ?? '').trim().slice(0, 48);
      const notes = Array.isArray(s.notes)
        ? s.notes.slice(0, 200).map((n: any) => String(n ?? '').slice(0, 32))
        : [];
      const notesJson = JSON.stringify(notes);

      let photoR2Key: string | null = null;
      let photoSizeBytes = 0;
      const clientPhotoSizeBytes = Math.min(100 * 1024 * 1024, Math.max(0, Math.floor(Number(s.photoSizeBytes) || 0)));
      const prevRowKey = prevKeyByStudentId.get(rowId) || null;
      const prevRowKeyAgeMs = prevRowKey ? now - extractTimestampFromR2Key(prevRowKey) : Number.POSITIVE_INFINITY;
      const isFreshConcurrentUpload = Boolean(prevRowKey && prevRowKeyAgeMs >= 0 && prevRowKeyAgeMs < 45000);

      if (s.photoR2Key && isOwnedR2Key(String(s.photoR2Key), userId)) {
        photoR2Key = String(s.photoR2Key);
        photoSizeBytes = Math.max(knownPhotoSizeByKey.get(photoR2Key) || 0, clientPhotoSizeBytes);
      } else if (isFreshConcurrentUpload && s.photoRemoved !== true && prevRowKey) {
        // Protection anti-course : POST /api/teacher/photos/student vient tout juste d'enregistrer prevRowKey en D1/R2
        // pendant qu'un auto-save du tableur était en vol avec l'aperçu base64 ou sans la nouvelle clé.
        photoR2Key = prevRowKey;
        photoSizeBytes = Math.max(knownPhotoSizeByKey.get(prevRowKey) || 0, clientPhotoSizeBytes);
      } else if (s.photoUrl && typeof s.photoUrl === 'string' && s.photoUrl.startsWith('data:image/')) {
        // Filet de sécurité : si une image base64 arrive (ex: hors-ligne ou collage), pré-décoder avant contrôle quota puis pousser dans R2 !
        const bytes = decodeBase64DataUrl(s.photoUrl);
        const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
        if (bytes && fmt) {
          const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
          const uploadedKey = `teacher-student-photos/${sanitizeSegment(userId)}/${sanitizeSegment(ownSubject.school_id)}/${sanitizeSegment(ownSubject.class_id)}/${sanitizeSegment(rowId)}_${now}_${rand}.${fmt.ext}`;
          photoR2Key = uploadedKey;
          photoSizeBytes = Math.max(bytes.byteLength, clientPhotoSizeBytes);
          newPhotoBytes += photoSizeBytes;
          pendingPhotoUploads.push({
            key: uploadedKey,
            bytes,
            contentType: fmt.contentType,
            studentId: rowId,
          });
        }
      } else if (s.photoUrl && prevRowKey) {
        // Le front n'a pas changé la photo existante (URL signée inchangée)
        photoR2Key = prevRowKey;
        photoSizeBytes = Math.max(knownPhotoSizeByKey.get(prevRowKey) || 0, clientPhotoSizeBytes);
      }

      if (photoR2Key) keptR2Keys.add(photoR2Key);

      newD1Bytes +=
        utf8ByteLength(rowId) +
        utf8ByteLength(fullName) +
        utf8ByteLength(matricule) +
        utf8ByteLength(photoR2Key || '') +
        utf8ByteLength(notesJson) +
        160;

      const average20 = computeAverage20(notes, columnMetas);
      preparedRows.push({
        id: rowId,
        studentUid,
        rowOrder: idx,
        fullName,
        matricule,
        photoR2Key,
        photoSizeBytes,
        notesJson,
        average20,
      });
    }

    // Si certains `id` d'élèves ont été réalloués pour éviter une collision inter-matières,
    // remapper proprement les clés de styles (`cellCustomStyles`, `cellColors`, `rowColors`) associées.
    let effectiveStyles = styles;
    if (remappedRowIdMap.size > 0 && styles && typeof styles === 'object') {
      const remapKeyedRecord = (rec: any, exactOnly = false): any => {
        if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return rec;
        const next: Record<string, any> = {};
        for (const [k, v] of Object.entries(rec)) {
          let nextKey = k;
          if (exactOnly) {
            const mapped = remappedRowIdMap.get(k);
            if (mapped) nextKey = mapped;
          } else {
            for (const [oldId, newId] of remappedRowIdMap.entries()) {
              if (k === oldId) {
                nextKey = newId;
                break;
              }
              if (k.startsWith(`${oldId}_`)) {
                nextKey = `${newId}${k.slice(oldId.length)}`;
                break;
              }
            }
          }
          next[nextKey] = v;
        }
        return next;
      };
      effectiveStyles = {
        ...styles,
        ...(styles.cellCustomStyles ? { cellCustomStyles: remapKeyedRecord(styles.cellCustomStyles) } : {}),
        ...(styles.cellColors ? { cellColors: remapKeyedRecord(styles.cellColors) } : {}),
        ...(styles.rowColors ? { rowColors: remapKeyedRecord(styles.rowColors, true) } : {}),
      };
    }
    const stylesStr = JSON.stringify(effectiveStyles);
    newD1Bytes += utf8ByteLength(stylesStr);

    // Contrôle STRICT du quota AVANT toute écriture dans R2 ou D1
    const incomingGbBytes = newPhotoBytes + Math.max(1, newD1Bytes - existingD1Bytes);
    const quotaBlocked = await enforceStorageQuota(incomingGbBytes);
    if (quotaBlocked) return quotaBlocked;

    // Compléter la taille R2 des photos référencées fraîchement uploadées via POST /api/teacher/photos/student
    const resolvedUnknownKeys = new Map<string, number>();
    for (const row of preparedRows) {
      if (row.photoR2Key && row.photoSizeBytes <= 0) {
        if (!resolvedUnknownKeys.has(row.photoR2Key)) {
          const sz = await getOwnedR2ObjectSize(rawEnv, row.photoR2Key);
          resolvedUnknownKeys.set(row.photoR2Key, sz);
        }
        row.photoSizeBytes = resolvedUnknownKeys.get(row.photoR2Key) || 0;
      }
    }

    // Pousser les éventuelles photos base64 vers R2 maintenant que le quota est validé
    for (const up of pendingPhotoUploads) {
      await uploadImageBytesToR2(rawEnv, up.key, up.bytes, up.contentType, {
        userId: sanitizeSegment(userId),
        kind: 'student_photo',
        schoolId: sanitizeSegment(ownSubject.school_id),
        classId: sanitizeSegment(ownSubject.class_id),
        studentId: sanitizeSegment(up.studentId),
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
            colMetasStr,
            layoutStr,
            stylesStr,
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
            colMetasStr,
            layoutStr,
            stylesStr,
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
              (id, user_id, gradebook_id, subject_id, term_id, class_id, student_uid, row_order, full_name, matricule, photo_r2_key, photo_size_bytes, notes_json, average_20, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            row.matricule,
            row.photoR2Key,
            row.photoSizeBytes,
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
      await deleteUnreferencedStudentR2Keys(db, rawEnv, userId, orphanKeys);
    }

    return jsonResponse({
      success: true,
      gradebookId,
      version: nextVersion,
      updatedAt: now,
      savedStudentsCount: preparedRows.length,
      ...(remappedRowIdMap.size > 0
        ? { remappedStudentIds: Object.fromEntries(remappedRowIdMap) }
        : {}),
    }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 8B. TABLEAU DE MOYENNE GÉNÉRALE PAR CLASSE (GET & PUT /api/teacher/class-average-sheet/:averageId)
  // --------------------------------------------------------------------------
  const avgSheetMatch = path.match(/^\/api\/teacher\/class-average-sheet\/([^/]+)$/);
  if (avgSheetMatch && method === 'GET') {
    const averageId = decodeURIComponent(avgSheetMatch[1]);
    const cardRow: any = await db
      .prepare('SELECT * FROM teacher_class_averages WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(averageId, userId)
      .first();
    if (!cardRow) {
      return errorResponse('Carte de moyenne générale introuvable ou non autorisée.', 404, origin);
    }

    const sortModeRaw = String(cardRow.sort_mode || 'merit');
    const sortMode =
      sortModeRaw === 'alpha' || sortModeRaw === 'order' ? sortModeRaw : 'merit';

    const card = {
      id: cardRow.id,
      classId: cardRow.class_id,
      termId: cardRow.term_id || undefined,
      schoolId: cardRow.school_id,
      yearId: cardRow.year_id,
      kind: cardRow.kind === 'annual' ? 'annual' : 'term',
      title: cardRow.title,
      sortOrder: Number(cardRow.sort_order) || 0,
      color: cardRow.color || '#ffffff',
      textColor: cardRow.text_color || '#0f172a',
      borderColor: cardRow.border_color || '#e2e8f0',
      borderDarkColor: cardRow.border_dark_color || '#cbd5e1',
      layout: safeParseJson(cardRow.layout_json, {}),
      styles: safeParseJson(cardRow.styles_json, {}),
      overrides: safeParseJson(cardRow.overrides_json, {}),
      sortMode,
      version: Number(cardRow.version) || 1,
      createdAt: Number(cardRow.created_at) || Date.now(),
      updatedAt: Number(cardRow.updated_at) || Date.now(),
    };

    const cardClassRow: any = await db
      .prepare('SELECT mention_rules_json, show_matricule, average_scale FROM teacher_classes WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(cardRow.class_id, userId)
      .first();
    const classSettings = extractClassSheetSettings(cardClassRow);

    if (card.kind === 'annual') {
      const [termsRes, termAvgCardsRes, subjectsRes, gradebooksRes, studentsRes] = await Promise.all([
        db
          .prepare(
            `SELECT * FROM teacher_terms
             WHERE user_id = ? AND class_id = ?
             ORDER BY number ASC, created_at ASC`
          )
          .bind(userId, cardRow.class_id)
          .all(),
        db
          .prepare(
            `SELECT id, term_id, overrides_json
             FROM teacher_class_averages
             WHERE user_id = ? AND class_id = ? AND kind = 'term'`
          )
          .bind(userId, cardRow.class_id)
          .all(),
        db
          .prepare(
            `SELECT * FROM teacher_subjects
             WHERE user_id = ? AND class_id = ?
             ORDER BY created_at ASC`
          )
          .bind(userId, cardRow.class_id)
          .all(),
        db
          .prepare(
            `SELECT id, subject_id, term_id, col_metas_json
             FROM teacher_gradebooks
             WHERE user_id = ? AND class_id = ?`
          )
          .bind(userId, cardRow.class_id)
          .all(),
        db
          .prepare(
            `SELECT id, gradebook_id, subject_id, term_id, student_uid, row_order, full_name, matricule, photo_r2_key, notes_json, average_20
             FROM teacher_gradebook_students
             WHERE user_id = ? AND class_id = ?
             ORDER BY row_order ASC, created_at ASC`
          )
          .bind(userId, cardRow.class_id)
          .all(),
      ]);

      const colMetasByGbId = new Map<string, Record<string, any>>();
      for (const gb of gradebooksRes.results || []) {
        colMetasByGbId.set(gb.id, safeParseJson<Record<string, any>>(gb.col_metas_json, {}));
      }

      const termAvgCardByTermId = new Map<string, { id: string; overrides: any }>();
      for (const row of termAvgCardsRes.results || []) {
        if (row.term_id) {
          termAvgCardByTermId.set(String(row.term_id), {
            id: String(row.id),
            overrides: safeParseJson(row.overrides_json, {}),
          });
        }
      }

      // Signer une seule fois chaque photo R2 unique pour éviter des signatures redondantes sur plusieurs trimestres
      const uniquePhotoKeys = Array.from(
        new Set(
          (studentsRes.results || [])
            .map((r: any) => (typeof r.photo_r2_key === 'string' && r.photo_r2_key ? r.photo_r2_key : ''))
            .filter(Boolean)
        )
      );
      const signedPhotoMap = new Map<string, string>();
      await Promise.all(
        uniquePhotoKeys.map(async (key) => {
          const signedUrl = await signTeacherMediaUrl(apiOrigin, key, jwtSecret);
          if (signedUrl) signedPhotoMap.set(key, signedUrl);
        })
      );

      const allTermsRows = termsRes.results || [];
      const firstTermId = allTermsRows[0]?.id ? String(allTermsRows[0].id) : '';

      const subjectsByTermId = new Map<string, any[]>();
      const gradebooksByTermId = new Map<string, Record<string, any[]>>();
      const subjectTermMap = new Map<string, string>();
      for (const t of allTermsRows) {
        subjectsByTermId.set(String(t.id), []);
        gradebooksByTermId.set(String(t.id), {});
      }

      for (const s of subjectsRes.results || []) {
        const effTermId = s.term_id ? String(s.term_id) : firstTermId;
        if (!effTermId || !subjectsByTermId.has(effTermId)) continue;
        subjectTermMap.set(String(s.id), effTermId);
        const coeff =
          s.coefficient !== null && s.coefficient !== undefined && Number(s.coefficient) > 0
            ? Number(s.coefficient)
            : null;
        subjectsByTermId.get(effTermId)!.push({
          id: s.id,
          classId: s.class_id,
          termId: effTermId,
          schoolId: s.school_id,
          yearId: s.year_id,
          name: s.name,
          coefficient: coeff,
          effectiveCoeff: coeff ?? 1,
          color: s.color || '#ffffff',
          textColor: s.text_color || '#0f172a',
          borderColor: s.border_color || '#e2e8f0',
          borderDarkColor: s.border_dark_color || '#cbd5e1',
          createdAt: Number(s.created_at) || Date.now(),
        });
        const gbMap = gradebooksByTermId.get(effTermId)!;
        if (!gbMap[s.id]) gbMap[s.id] = [];
      }

      for (const row of studentsRes.results || []) {
        const effTermId =
          subjectTermMap.get(String(row.subject_id)) ||
          (row.term_id ? String(row.term_id) : firstTermId);
        const gbMap = effTermId ? gradebooksByTermId.get(effTermId) : undefined;
        if (!gbMap) continue;
        const notes = safeParseJson<string[]>(row.notes_json, []);
        const colMetas = colMetasByGbId.get(row.gradebook_id) || {};
        const computed = computeAverage20Exact(notes, colMetas);
        const fallbackAvg =
          row.average_20 !== null &&
          row.average_20 !== undefined &&
          Number.isFinite(Number(row.average_20))
            ? Number(row.average_20)
            : null;
        const photoUrl = row.photo_r2_key ? signedPhotoMap.get(row.photo_r2_key) : undefined;
        if (!gbMap[row.subject_id]) gbMap[row.subject_id] = [];
        gbMap[row.subject_id].push({
          id: row.id,
          studentUid: row.student_uid || row.id,
          name: row.full_name || '',
          matricule: row.matricule || '',
          photoR2Key: row.photo_r2_key || undefined,
          photoUrl,
          average20: computed.average !== null ? computed.average : fallbackAvg,
          notesCount: computed.validNotesCount,
        });
      }

      const annualTerms = allTermsRows.map((t: any) => {
        const tid = String(t.id);
        const coeff =
          t.coefficient !== null && t.coefficient !== undefined && Number(t.coefficient) > 0
            ? Number(t.coefficient)
            : null;
        const linkedAvgCard = termAvgCardByTermId.get(tid);
        return {
          id: tid,
          averageCardId: linkedAvgCard?.id,
          number: Number(t.number) || 1,
          name: String(t.name || `Trimestre ${Number(t.number) || 1}`),
          coefficient: coeff,
          effectiveCoeff: coeff ?? 1,
          overrides: linkedAvgCard?.overrides || {},
          subjects: subjectsByTermId.get(tid) || [],
          subjectGradebooks: gradebooksByTermId.get(tid) || {},
        };
      });

      return jsonResponse({
        success: true,
        card,
        term: null,
        subjects: [],
        subjectGradebooks: {},
        classSettings,
        annualData: {
          terms: annualTerms,
        },
      }, 200, origin);
    }

    if (card.kind !== 'term' || !cardRow.term_id) {
      return jsonResponse({
        success: true,
        card,
        term: null,
        subjects: [],
        subjectGradebooks: {},
        classSettings,
      }, 200, origin);
    }

    const [termRow, subjectsRes, gradebooksRes, studentsRes] = await Promise.all([
      db
        .prepare('SELECT * FROM teacher_terms WHERE id = ? AND user_id = ? LIMIT 1')
        .bind(cardRow.term_id, userId)
        .first(),
      db
        .prepare(
          `SELECT * FROM teacher_subjects
           WHERE user_id = ? AND class_id = ? AND term_id = ?
           ORDER BY created_at ASC`
        )
        .bind(userId, cardRow.class_id, cardRow.term_id)
        .all(),
      db
        .prepare(
          `SELECT id, subject_id, col_metas_json
           FROM teacher_gradebooks
           WHERE user_id = ? AND class_id = ? AND term_id = ?`
        )
        .bind(userId, cardRow.class_id, cardRow.term_id)
        .all(),
      db
        .prepare(
          `SELECT id, gradebook_id, subject_id, student_uid, row_order, full_name, matricule, photo_r2_key, notes_json, average_20
           FROM teacher_gradebook_students
           WHERE user_id = ? AND class_id = ? AND term_id = ?
           ORDER BY row_order ASC, created_at ASC`
        )
        .bind(userId, cardRow.class_id, cardRow.term_id)
        .all(),
    ]);

    const colMetasByGbId = new Map<string, Record<string, any>>();
    for (const gb of gradebooksRes.results || []) {
      colMetasByGbId.set(gb.id, safeParseJson<Record<string, any>>(gb.col_metas_json, {}));
    }

    const subjects = (subjectsRes.results || []).map((s: any) => {
      const coeff =
        s.coefficient !== null && s.coefficient !== undefined && Number(s.coefficient) > 0
          ? Number(s.coefficient)
          : null;
      return {
        id: s.id,
        classId: s.class_id,
        termId: s.term_id,
        schoolId: s.school_id,
        yearId: s.year_id,
        name: s.name,
        coefficient: coeff,
        effectiveCoeff: coeff ?? 1,
        color: s.color || '#ffffff',
        textColor: s.text_color || '#0f172a',
        borderColor: s.border_color || '#e2e8f0',
        borderDarkColor: s.border_dark_color || '#cbd5e1',
        createdAt: Number(s.created_at) || Date.now(),
      };
    });

    const subjectGradebooks: Record<string, any[]> = {};
    for (const s of subjects) {
      subjectGradebooks[s.id] = [];
    }

    const studentRows = studentsRes.results || [];
    const signedRows = await Promise.all(
      studentRows.map(async (row: any) => {
        const notes = safeParseJson<string[]>(row.notes_json, []);
        const colMetas = colMetasByGbId.get(row.gradebook_id) || {};
        const computed = computeAverage20Exact(notes, colMetas);
        const fallbackAvg =
          row.average_20 !== null &&
          row.average_20 !== undefined &&
          Number.isFinite(Number(row.average_20))
            ? Number(row.average_20)
            : null;
        const photoUrl = row.photo_r2_key
          ? await signTeacherMediaUrl(apiOrigin, row.photo_r2_key, jwtSecret)
          : undefined;

        return {
          subjectId: row.subject_id,
          snapshot: {
            id: row.id,
            studentUid: row.student_uid || row.id,
            name: row.full_name || '',
            matricule: row.matricule || '',
            photoR2Key: row.photo_r2_key || undefined,
            photoUrl,
            average20: computed.average !== null ? computed.average : fallbackAvg,
            notesCount: computed.validNotesCount,
          },
        };
      })
    );

    for (const item of signedRows) {
      if (!subjectGradebooks[item.subjectId]) {
        subjectGradebooks[item.subjectId] = [];
      }
      subjectGradebooks[item.subjectId].push(item.snapshot);
    }

    const term = termRow
      ? {
          id: termRow.id,
          classId: termRow.class_id,
          schoolId: termRow.school_id,
          yearId: termRow.year_id,
          number: Number(termRow.number) || 1,
          name: termRow.name,
          coefficient:
            termRow.coefficient !== null && termRow.coefficient !== undefined
              ? Number(termRow.coefficient)
              : undefined,
          createdAt: Number(termRow.created_at) || Date.now(),
        }
      : null;

    return jsonResponse({
      success: true,
      card,
      term,
      subjects,
      subjectGradebooks,
      classSettings,
    }, 200, origin);
  }

  if (avgSheetMatch && method === 'PUT') {
    const averageId = decodeURIComponent(avgSheetMatch[1]);
    const existingCard: any = await db
      .prepare('SELECT id, version, layout_json, styles_json, overrides_json FROM teacher_class_averages WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(averageId, userId)
      .first();
    if (!existingCard) {
      return errorResponse('Carte de moyenne générale introuvable ou non autorisée.', 404, origin);
    }

    const body: any = await request.json().catch(() => ({}));
    const layout = typeof body.layout === 'object' && body.layout !== null ? body.layout : {};
    const styles = typeof body.styles === 'object' && body.styles !== null ? body.styles : {};
    const rawOverrides = typeof body.overrides === 'object' && body.overrides !== null ? body.overrides : {};

    // Assainir overrides (élèves manuels + moyennes manuelles strictement entre 0 et 20)
    const cleanManualStudents = Array.isArray(rawOverrides.manualStudents)
      ? rawOverrides.manualStudents
          .slice(0, 600)
          .filter((ms: any) => ms && typeof ms.key === 'string' && ms.key.trim().length > 0)
          .map((ms: any) => ({
            key: String(ms.key).trim().slice(0, 120),
            name: String(ms.name || '').slice(0, 160),
            createdAt: Number(ms.createdAt) || Date.now(),
          }))
      : [];

    const cleanSubjectOverrides: Record<string, Record<string, number>> = {};
    if (rawOverrides.subjectOverrides && typeof rawOverrides.subjectOverrides === 'object') {
      for (const [stKey, subjMap] of Object.entries(rawOverrides.subjectOverrides)) {
        if (!stKey || !subjMap || typeof subjMap !== 'object') continue;
        const safeMap: Record<string, number> = {};
        for (const [subId, val] of Object.entries(subjMap as Record<string, any>)) {
          if (val === null || val === undefined || val === '') continue;
          const num = Number(val);
          if (Number.isFinite(num) && num >= 0 && num <= 20) {
            safeMap[String(subId).slice(0, 120)] = num;
          }
        }
        if (Object.keys(safeMap).length > 0) {
          cleanSubjectOverrides[String(stKey).slice(0, 160)] = safeMap;
        }
      }
    }

    const cleanMergedLinks = Array.isArray(rawOverrides.mergedLinks)
      ? rawOverrides.mergedLinks
          .slice(0, 300)
          .filter(
            (ml: any) =>
              ml &&
              typeof ml.primaryKey === 'string' &&
              ml.primaryKey.trim().length > 0 &&
              Array.isArray(ml.mergedKeys)
          )
          .map((ml: any) => ({
            primaryKey: String(ml.primaryKey).trim().slice(0, 160),
            mergedKeys: Array.from(
              new Set(
                ml.mergedKeys
                  .filter((k: any) => typeof k === 'string' && k.trim().length > 0)
                  .map((k: string) => k.trim().slice(0, 160))
                  .filter((k: string) => k !== String(ml.primaryKey).trim().slice(0, 160))
              )
            ).slice(0, 50),
          }))
          .filter((ml: any) => ml.mergedKeys.length > 0)
      : [];

    const cleanDistinctPairs: Array<[string, string]> = Array.isArray(rawOverrides.distinctPairs)
      ? rawOverrides.distinctPairs
          .slice(0, 500)
          .filter(
            (p: any) =>
              Array.isArray(p) &&
              p.length === 2 &&
              typeof p[0] === 'string' &&
              typeof p[1] === 'string' &&
              p[0].trim().length > 0 &&
              p[1].trim().length > 0 &&
              p[0].trim() !== p[1].trim()
          )
          .map((p: any) => [p[0].trim().slice(0, 160), p[1].trim().slice(0, 160)] as [string, string])
      : [];

    const cleanMatriculeOverrides: Record<string, string> = {};
    if (rawOverrides.matriculeOverrides && typeof rawOverrides.matriculeOverrides === 'object') {
      let count = 0;
      for (const [stKey, rawMat] of Object.entries(rawOverrides.matriculeOverrides)) {
        if (count >= 600) break;
        if (!stKey || typeof rawMat !== 'string') continue;
        const cleanMat = rawMat.trim().slice(0, 48);
        if (cleanMat) {
          cleanMatriculeOverrides[String(stKey).slice(0, 160)] = cleanMat;
          count++;
        }
      }
    }

    const cleanOverrides = {
      manualStudents: cleanManualStudents,
      subjectOverrides: cleanSubjectOverrides,
      matriculeOverrides: cleanMatriculeOverrides,
      mergedLinks: cleanMergedLinks,
      distinctPairs: cleanDistinctPairs,
    };

    const rawSort = String(body.sortMode || 'merit');
    const sortMode = rawSort === 'alpha' || rawSort === 'order' ? rawSort : 'merit';
    const nextVersion = (Number(existingCard.version) || 1) + 1;
    const now = Date.now();

    const layoutStr = JSON.stringify(layout);
    const stylesStr = JSON.stringify(styles);
    const overridesStr = JSON.stringify(cleanOverrides);
    const prevBytes =
      utf8ByteLength(existingCard.layout_json) +
      utf8ByteLength(existingCard.styles_json) +
      utf8ByteLength(existingCard.overrides_json);
    const nextBytes = utf8ByteLength(layoutStr) + utf8ByteLength(stylesStr) + utf8ByteLength(overridesStr);
    const quotaBlocked = await enforceStorageQuota(Math.max(1, nextBytes - prevBytes));
    if (quotaBlocked) return quotaBlocked;

    await db
      .prepare(
        `UPDATE teacher_class_averages
         SET layout_json = ?, styles_json = ?, overrides_json = ?, sort_mode = ?, version = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(
        layoutStr,
        stylesStr,
        overridesStr,
        sortMode,
        nextVersion,
        now,
        averageId,
        userId
      )
      .run();

    return jsonResponse({
      success: true,
      averageId,
      version: nextVersion,
      updatedAt: now,
    }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 8C. RÉPERTOIRE PARTAGÉ DES ÉLÈVES D'UNE CLASSE (GET /api/teacher/class-roster/:classId)
  // Utilisé pour l'auto-complétion intelligente dans les autres matières (liaison par studentUid)
  // --------------------------------------------------------------------------
  const classRosterMatch = path.match(/^\/api\/teacher\/class-roster\/([^/]+)$/);
  if (classRosterMatch && method === 'GET') {
    const classId = decodeURIComponent(classRosterMatch[1]);
    const ownClass: any = await db
      .prepare('SELECT id FROM teacher_classes WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(classId, userId)
      .first();
    if (!ownClass) {
      return errorResponse('Classe introuvable ou non autorisée.', 404, origin);
    }

    const rosterRes = await db
      .prepare(
        `SELECT s.student_uid, s.id, s.full_name, s.matricule, s.photo_r2_key, s.subject_id, subj.name AS subject_name
         FROM teacher_gradebook_students s
         LEFT JOIN teacher_subjects subj ON subj.id = s.subject_id AND subj.user_id = s.user_id
         WHERE s.user_id = ? AND s.class_id = ? AND TRIM(COALESCE(s.full_name, '')) != ''
         ORDER BY s.created_at ASC, s.row_order ASC`
      )
      .bind(userId, classId)
      .all();

    const byUid = new Map<
      string,
      {
        studentUid: string;
        name: string;
        matricule?: string;
        photoR2Key?: string;
        subjectIds: string[];
        subjectNames: string[];
      }
    >();

    for (const r of rosterRes.results || []) {
      const name = String(r.full_name || '').trim();
      if (!name) continue;
      const uid = String(r.student_uid || r.id || '').trim();
      if (!uid) continue;
      const mat = String(r.matricule || '').trim();

      let entry = byUid.get(uid);
      if (!entry) {
        entry = {
          studentUid: uid,
          name,
          matricule: mat || undefined,
          photoR2Key: r.photo_r2_key || undefined,
          subjectIds: [],
          subjectNames: [],
        };
        byUid.set(uid, entry);
      } else {
        if (!entry.photoR2Key && r.photo_r2_key) {
          entry.photoR2Key = r.photo_r2_key;
        }
        if (!entry.matricule && mat) {
          entry.matricule = mat;
        }
      }

      if (r.subject_id && !entry.subjectIds.includes(r.subject_id)) {
        entry.subjectIds.push(r.subject_id);
      }
      if (r.subject_name && !entry.subjectNames.includes(r.subject_name)) {
        entry.subjectNames.push(r.subject_name);
      }
    }

    const students = await Promise.all(
      Array.from(byUid.values()).map(async (item) => ({
        studentUid: item.studentUid,
        name: item.name,
        matricule: item.matricule || '',
        photoR2Key: item.photoR2Key,
        photoUrl: item.photoR2Key
          ? await signTeacherMediaUrl(apiOrigin, item.photoR2Key, jwtSecret)
          : undefined,
        subjectIds: item.subjectIds,
        subjectNames: item.subjectNames,
      }))
    );

    return jsonResponse({ success: true, classId, students }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 9. PHOTOS DE PROFIL ÉLÈVES DANS R2 (POST & DELETE /api/teacher/photos/student)
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/photos/student' && method === 'POST') {
    const contentTypeHeader = request.headers.get('content-type') || '';
    let subjectId = '';
    let termId = '';
    let studentId = '';
    let rawOriginalSizeBytes = 0;
    let bytes: Uint8Array | null = null;

    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await request.formData();
      subjectId = String(formData.get('subjectId') || '').trim();
      termId = String(formData.get('termId') || '').trim();
      studentId = String(formData.get('studentId') || '').trim();
      rawOriginalSizeBytes = Number(formData.get('originalSizeBytes') || 0);
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
      rawOriginalSizeBytes = Number(body.originalSizeBytes || 0);
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
      .prepare('SELECT id, class_id, term_id, school_id, year_id FROM teacher_subjects WHERE id = ? AND user_id = ? LIMIT 1')
      .bind(subjectId, userId)
      .first();
    if (!ownSubject) return errorResponse('Matière introuvable ou non autorisée.', 404, origin);

    // Facturation sur la vraie taille brute d'origine du fichier image importé par l'utilisateur (ex: 2,23 Mo)
    const billedPhotoBytes = Math.max(
      bytes.byteLength,
      Math.min(100 * 1024 * 1024, Math.floor(rawOriginalSizeBytes || 0))
    );

    // Contrôle STRICT du quota AVANT tout envoi dans R2
    const quotaBlocked = await enforceStorageQuota(billedPhotoBytes + 160);
    if (quotaBlocked) return quotaBlocked;

    const now = Date.now();
    const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const photoR2Key = `teacher-student-photos/${sanitizeSegment(userId)}/${sanitizeSegment(ownSubject.school_id)}/${sanitizeSegment(ownSubject.class_id)}/${sanitizeSegment(studentId)}_${now}_${rand}.${fmt.ext}`;

    const uploaded = await uploadImageBytesToR2(rawEnv, photoR2Key, bytes, fmt.contentType, {
      userId: sanitizeSegment(userId),
      kind: 'student_photo',
      schoolId: sanitizeSegment(ownSubject.school_id),
      classId: sanitizeSegment(ownSubject.class_id),
      studentId: sanitizeSegment(studentId),
      originalSizeBytes: String(billedPhotoBytes),
    });
    if (!uploaded) {
      return errorResponse('Stockage des photos temporairement indisponible.', 503, origin);
    }

    // Persister immédiatement photo_r2_key et photo_size_bytes en D1 (même si le tableur ou la ligne élève n'avait pas encore été sauvegardé)
    const effectiveTermId = termId || String(ownSubject.term_id || '');
    if (effectiveTermId) {
      const existingRow: any = await db
        .prepare(
          `SELECT id, photo_r2_key FROM teacher_gradebook_students
           WHERE id = ? AND user_id = ? AND subject_id = ? AND term_id = ? LIMIT 1`
        )
        .bind(studentId, userId, subjectId, effectiveTermId)
        .first();
      if (existingRow) {
        await db
          .prepare('UPDATE teacher_gradebook_students SET photo_r2_key = ?, photo_size_bytes = ?, photo_compressed_size_bytes = ?, updated_at = ? WHERE id = ? AND user_id = ?')
          .bind(photoR2Key, billedPhotoBytes, bytes.byteLength, now, studentId, userId)
          .run();
        if (existingRow.photo_r2_key && existingRow.photo_r2_key !== photoR2Key) {
          await deleteUnreferencedStudentR2Keys(db, rawEnv, userId, [existingRow.photo_r2_key]);
        }
      } else {
        let existingGb: any = await db
          .prepare('SELECT id FROM teacher_gradebooks WHERE user_id = ? AND subject_id = ? AND term_id = ? LIMIT 1')
          .bind(userId, subjectId, effectiveTermId)
          .first();
        const gradebookId = existingGb ? String(existingGb.id) : makeId('gb');
        if (!existingGb) {
          await db
            .prepare(
              `INSERT OR IGNORE INTO teacher_gradebooks
                (id, user_id, subject_id, term_id, class_id, school_id, year_id, note_col_count, col_metas_json, layout_json, styles_json, version, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 7, '{}', '{}', '{}', 1, ?, ?)`
            )
            .bind(
              gradebookId,
              userId,
              subjectId,
              effectiveTermId,
              ownSubject.class_id,
              ownSubject.school_id,
              ownSubject.year_id,
              now,
              now
            )
            .run();
        }
        await db
          .prepare(
            `INSERT OR REPLACE INTO teacher_gradebook_students
              (id, user_id, gradebook_id, subject_id, term_id, class_id, student_uid, row_order, full_name, matricule, photo_r2_key, photo_size_bytes, photo_compressed_size_bytes, notes_json, average_20, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, '', '', ?, ?, ?, '[]', NULL, ?, ?)`
          )
          .bind(
            studentId,
            userId,
            gradebookId,
            subjectId,
            effectiveTermId,
            ownSubject.class_id,
            studentId,
            photoR2Key,
            billedPhotoBytes,
            bytes.byteLength,
            now,
            now
          )
          .run();
      }
    }

    const photoUrl = await signTeacherMediaUrl(apiOrigin, photoR2Key, jwtSecret);
    return jsonResponse({
      success: true,
      photoR2Key,
      photoUrl,
      photoSizeBytes: billedPhotoBytes,
      photoCompressedSizeBytes: bytes.byteLength,
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
           SET photo_r2_key = NULL, photo_size_bytes = 0, photo_compressed_size_bytes = 0, updated_at = ?
           WHERE id = ? AND user_id = ? AND subject_id = ? AND term_id = ?`
        )
        .bind(Date.now(), studentId, userId, subjectId, termId)
        .run();
    }

    if (keyToDelete) {
      await deleteUnreferencedStudentR2Keys(db, rawEnv, userId, [keyToDelete]);
    }
    return jsonResponse({ success: true }, 200, origin);
  }

  // --------------------------------------------------------------------------
  // 9B. CRÉATION EN LOT ATOMIQUE (PLUSIEURS ENTITÉS D'UN COUP EN BASE D1)
  // POST /api/teacher/batch-create
  // --------------------------------------------------------------------------
  if (path === '/api/teacher/batch-create' && method === 'POST') {
    const body: any = await request.json().catch(() => ({}));
    const entity = String(body.entity || '').trim();
    const rawItems: any[] = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    if (rawItems.length === 0) {
      return errorResponse('Aucun élément à créer.', 400, origin);
    }

    const baseNow = Date.now();

    if (entity === 'years') {
      const existingYearsRes = await db
        .prepare('SELECT label FROM teacher_school_years WHERE user_id = ?')
        .bind(userId)
        .all();
      const existingLabels = new Set(
        (existingYearsRes.results || []).map((r: any) => String(r.label || '').trim().toLowerCase())
      );

      const stmts: any[] = [];
      const createdYears: any[] = [];
      const skippedLabels: string[] = [];

      for (let i = 0; i < rawItems.length; i++) {
        const it = rawItems[i] || {};
        const label = String(it.label || '').trim().slice(0, 30);
        if (!label) continue;
        const low = label.toLowerCase();
        if (existingLabels.has(low)) {
          skippedLabels.push(label);
          continue;
        }
        existingLabels.add(low);
        const now = baseNow + i;
        const id = await resolveSafeNewId(db, 'teacher_school_years', it.id, 'year');
        const color = String(it.color || '#ffffff').slice(0, 32);
        const textColor = String(it.textColor || '#0f172a').slice(0, 32);
        const colorStyle = it.colorStyle === 'accent' ? 'accent' : 'full';
        stmts.push(
          db
            .prepare(
              `INSERT INTO teacher_school_years (id, user_id, label, color, text_color, color_style, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(id, userId, label, color, textColor, colorStyle, now, now)
        );
        createdYears.push({ id, label, color, textColor, colorStyle, createdAt: now });
      }

      if (stmts.length > 0) {
        const incomingBatchBytes = createdYears.reduce(
          (acc, y) => acc + utf8ByteLength(y.id) + utf8ByteLength(y.label) + 192,
          0
        );
        const quotaBlocked = await enforceStorageQuota(incomingBatchBytes);
        if (quotaBlocked) return quotaBlocked;
        await runBatchChunked(db, stmts, 80);
      }
      return jsonResponse({ success: true, years: createdYears, skippedLabels }, 201, origin);
    }

    if (entity === 'schools') {
      const yearId = String(body.yearId || '').trim();
      if (!yearId) return errorResponse('Année scolaire requise.', 400, origin);
      const ownYear = await db
        .prepare('SELECT id FROM teacher_school_years WHERE id = ? AND user_id = ? LIMIT 1')
        .bind(yearId, userId)
        .first();
      if (!ownYear) return errorResponse('Année scolaire introuvable ou non autorisée.', 404, origin);

      const stmts: any[] = [];
      const createdSchools: any[] = [];
      const pendingLogoUploads: Array<{ key: string; bytes: Uint8Array; contentType: string; schoolId: string }> = [];
      let totalIncomingSchoolBytes = 0;

      for (let i = 0; i < rawItems.length; i++) {
        const it = rawItems[i] || {};
        const name = String(it.name || '').trim().slice(0, 120);
        if (!name) continue;
        const now = baseNow + i;
        const id = await resolveSafeNewId(db, 'teacher_schools', it.id, 'school');
        let logoR2Key: string | null = null;
        let logoSizeBytes = 0;

        if (typeof it.logoDataUrl === 'string' && it.logoDataUrl.startsWith('data:image/')) {
          const bytes = decodeBase64DataUrl(it.logoDataUrl);
          const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
          if (!bytes || !fmt) {
            return errorResponse(`Format de logo invalide pour "${name}" (PNG/JPEG/WebP, max 600 Ko).`, 400, origin);
          }
          const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
          logoR2Key = `teacher-school-logos/${sanitizeSegment(userId)}/${sanitizeSegment(id)}_${now}_${rand}.${fmt.ext}`;
          const rawOrig = Math.floor(Number(it.logoOriginalSizeBytes) || 0);
          logoSizeBytes = Math.max(bytes.byteLength, Math.min(100 * 1024 * 1024, rawOrig));
          pendingLogoUploads.push({ key: logoR2Key, bytes, contentType: fmt.contentType, schoolId: id });
        }

        const color = String(it.color || '#ffffff').slice(0, 32);
        const textColor = String(it.textColor || '#0f172a').slice(0, 32);
        const borderColor = String(it.borderColor || '#e2e8f0').slice(0, 32);
        const borderDarkColor = String(it.borderDarkColor || '#cbd5e1').slice(0, 32);
        const colorStyle = it.colorStyle === 'accent' ? 'accent' : 'full';

        totalIncomingSchoolBytes += logoSizeBytes + utf8ByteLength(id) + utf8ByteLength(name) + utf8ByteLength(logoR2Key || '') + 240;

        stmts.push(
          db
            .prepare(
              `INSERT INTO teacher_schools
                (id, user_id, year_id, name, logo_r2_key, logo_size_bytes, color, text_color, border_color, border_dark_color, color_style, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(id, userId, yearId, name, logoR2Key, logoSizeBytes, color, textColor, borderColor, borderDarkColor, colorStyle, now, now)
        );
        const logoUrl = logoR2Key ? await signTeacherMediaUrl(apiOrigin, logoR2Key, jwtSecret) : undefined;
        createdSchools.push({
          id,
          yearId,
          name,
          logoR2Key: logoR2Key || undefined,
          logoUrl,
          color,
          textColor,
          borderColor,
          borderDarkColor,
          colorStyle,
          createdAt: now,
        });
      }

      if (stmts.length === 0) return errorResponse('Aucun nom d’école valide.', 400, origin);
      const quotaBlocked = await enforceStorageQuota(totalIncomingSchoolBytes);
      if (quotaBlocked) return quotaBlocked;

      for (const up of pendingLogoUploads) {
        await uploadImageBytesToR2(rawEnv, up.key, up.bytes, up.contentType, {
          userId: sanitizeSegment(userId),
          kind: 'school_logo',
          schoolId: sanitizeSegment(up.schoolId),
        });
      }
      await runBatchChunked(db, stmts, 80);
      return jsonResponse({ success: true, schools: createdSchools }, 201, origin);
    }

    if (entity === 'levels') {
      const schoolId = String(body.schoolId || '').trim();
      if (!schoolId) return errorResponse('Établissement requis.', 400, origin);
      const ownSchool: any = await db
        .prepare('SELECT id, year_id FROM teacher_schools WHERE id = ? AND user_id = ? LIMIT 1')
        .bind(schoolId, userId)
        .first();
      if (!ownSchool) return errorResponse('Établissement introuvable ou non autorisé.', 404, origin);

      const stmts: any[] = [];
      const createdLevels: any[] = [];

      for (let i = 0; i < rawItems.length; i++) {
        const it = rawItems[i] || {};
        const name = String(it.name || '').trim().slice(0, 80);
        if (!name) continue;
        const now = baseNow + i;
        const id = await resolveSafeNewId(db, 'teacher_study_levels', it.id, 'level');
        const color = String(it.color || '#ffffff').slice(0, 32);
        const textColor = String(it.textColor || '#0f172a').slice(0, 32);
        const borderColor = String(it.borderColor || '#cbd5e1').slice(0, 32);
        const colorStyle = it.colorStyle === 'full' ? 'full' : 'accent';

        stmts.push(
          db
            .prepare(
              `INSERT INTO teacher_study_levels
                (id, user_id, school_id, year_id, name, color, text_color, border_color, color_style, sort_order, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(id, userId, schoolId, ownSchool.year_id, name, color, textColor, borderColor, colorStyle, i, now, now)
        );
        createdLevels.push({
          id,
          schoolId,
          yearId: ownSchool.year_id,
          name,
          color,
          textColor,
          borderColor,
          colorStyle,
          createdAt: now,
        });
      }

      if (stmts.length === 0) return errorResponse('Aucun nom de niveau valide.', 400, origin);
      const quotaBlocked = await enforceStorageQuota(
        createdLevels.reduce((acc, lv) => acc + utf8ByteLength(lv.id) + utf8ByteLength(lv.name) + 200, 0)
      );
      if (quotaBlocked) return quotaBlocked;
      await runBatchChunked(db, stmts, 80);
      return jsonResponse({ success: true, levels: createdLevels }, 201, origin);
    }

    if (entity === 'classes') {
      const levelId = String(body.levelId || '').trim();
      if (!levelId) return errorResponse('Niveau d’étude requis.', 400, origin);
      const ownLevel: any = await db
        .prepare('SELECT id, school_id, year_id, name FROM teacher_study_levels WHERE id = ? AND user_id = ? LIMIT 1')
        .bind(levelId, userId)
        .first();
      if (!ownLevel) return errorResponse('Niveau d’étude introuvable ou non autorisé.', 404, origin);

      const stmts: any[] = [];
      const createdClasses: any[] = [];
      const createdTerms: any[] = [];
      const createdAverages: any[] = [];

      for (let i = 0; i < rawItems.length; i++) {
        const it = rawItems[i] || {};
        const name = String(it.name || '').trim().slice(0, 80);
        const teacherName = String(it.teacherName || '').trim().slice(0, 100);
        if (!name || !teacherName) continue;

        const now = baseNow + i * 10;
        const classId = await resolveSafeNewId(db, 'teacher_classes', it.id, 'class');
        const slogan = it.slogan ? String(it.slogan).trim().slice(0, 140) : null;
        const color = String(it.color || '#ffffff').slice(0, 32);
        const textColor = String(it.textColor || '#0f172a').slice(0, 32);
        const borderColor = String(it.borderColor || '#e2e8f0').slice(0, 32);
        const borderDarkColor = String(it.borderDarkColor || '#cbd5e1').slice(0, 32);
        const colorStyle = it.colorStyle === 'full' ? 'full' : 'accent';
        const iconGradient = String(it.iconGradient || 'from-amber-500 to-orange-600').slice(0, 80);

        const defaultTerms = [
          { id: makeId('term'), number: 1, name: 'Trimestre 1', createdAt: now },
          { id: makeId('term'), number: 2, name: 'Trimestre 2', createdAt: now + 1 },
          { id: makeId('term'), number: 3, name: 'Trimestre 3', createdAt: now + 2 },
        ];

        const annualAvg = {
          id: makeId('cavg'),
          classId,
          termId: undefined as string | undefined,
          schoolId: ownLevel.school_id,
          yearId: ownLevel.year_id,
          kind: 'annual' as const,
          title: "Moyenne générale de l'année",
          sortOrder: 0,
          color: '#ffffff',
          textColor: '#0f172a',
          borderColor: '#e2e8f0',
          borderDarkColor: '#cbd5e1',
          createdAt: now,
        };
        const termAvgs = defaultTerms.map((t) => ({
          id: makeId('cavg'),
          classId,
          termId: t.id,
          schoolId: ownLevel.school_id,
          yearId: ownLevel.year_id,
          kind: 'term' as const,
          title: `Moyenne générale · ${t.name}`,
          sortOrder: t.number,
          color: '#ffffff',
          textColor: '#0f172a',
          borderColor: '#e2e8f0',
          borderDarkColor: '#cbd5e1',
          createdAt: t.createdAt,
        }));

        stmts.push(
          db
            .prepare(
              `INSERT INTO teacher_classes
                (id, user_id, level_id, school_id, year_id, level_name, name, slogan, teacher_name, subject_label, color, text_color, border_color, border_dark_color, color_style, icon_gradient, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              classId, userId, levelId, ownLevel.school_id, ownLevel.year_id,
              ownLevel.name, name, slogan, teacherName,
              color, textColor, borderColor, borderDarkColor, colorStyle, iconGradient,
              now, now
            )
        );
        for (const t of defaultTerms) {
          stmts.push(
            db
              .prepare(
                `INSERT INTO teacher_terms (id, user_id, class_id, school_id, year_id, number, name, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(t.id, userId, classId, ownLevel.school_id, ownLevel.year_id, t.number, t.name, t.createdAt, now)
          );
          createdTerms.push({
            id: t.id,
            classId,
            schoolId: ownLevel.school_id,
            yearId: ownLevel.year_id,
            number: t.number,
            name: t.name,
            createdAt: t.createdAt,
          });
        }
        for (const ca of [annualAvg, ...termAvgs]) {
          stmts.push(
            db
              .prepare(
                `INSERT INTO teacher_class_averages
                  (id, user_id, class_id, term_id, school_id, year_id, kind, title, sort_order, color, text_color, border_color, border_dark_color, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                ca.id, userId, ca.classId, ca.termId ?? null, ca.schoolId, ca.yearId,
                ca.kind, ca.title, ca.sortOrder, ca.color, ca.textColor, ca.borderColor, ca.borderDarkColor,
                ca.createdAt, now
              )
          );
          createdAverages.push(ca);
        }

        createdClasses.push({
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
          colorStyle,
          iconGradient,
          createdAt: now,
        });
      }

      if (createdClasses.length === 0) {
        return errorResponse('Aucune classe valide à créer (nom et professeur requis).', 400, origin);
      }
      const incomingBatchClassBytes =
        createdClasses.reduce((acc, c) => acc + utf8ByteLength(c.id) + utf8ByteLength(c.name) + utf8ByteLength(c.teacherName) + utf8ByteLength(c.slogan || '') + 240, 0) +
        createdTerms.reduce((acc, t) => acc + utf8ByteLength(t.id) + utf8ByteLength(t.name) + 180, 0) +
        createdAverages.reduce((acc, ca) => acc + utf8ByteLength(ca.id) + utf8ByteLength(ca.title) + 200, 0);
      const quotaBlocked = await enforceStorageQuota(incomingBatchClassBytes);
      if (quotaBlocked) return quotaBlocked;
      await runBatchChunked(db, stmts, 80);
      return jsonResponse({
        success: true,
        classes: createdClasses,
        terms: createdTerms,
        classAverages: createdAverages,
      }, 201, origin);
    }

    if (entity === 'terms') {
      const classId = String(body.classId || '').trim();
      if (!classId) return errorResponse('Classe requise.', 400, origin);
      const ownClass: any = await db
        .prepare('SELECT id, school_id, year_id FROM teacher_classes WHERE id = ? AND user_id = ? LIMIT 1')
        .bind(classId, userId)
        .first();
      if (!ownClass) return errorResponse('Classe introuvable ou non autorisée.', 404, origin);

      const stmts: any[] = [];
      const createdTerms: any[] = [];
      const createdAverages: any[] = [];

      for (let i = 0; i < rawItems.length; i++) {
        const it = rawItems[i] || {};
        const number = Math.max(1, parseInt(String(it.number || i + 1), 10) || i + 1);
        const name = String(it.name || `Trimestre ${number}`).trim().slice(0, 50);
        if (!name) continue;
        const coeffRaw = it.coefficient !== undefined && it.coefficient !== null && it.coefficient !== '' ? Number(it.coefficient) : null;
        const coefficient = coeffRaw !== null && Number.isFinite(coeffRaw) && coeffRaw > 0 ? coeffRaw : null;

        const now = baseNow + i;
        const id = await resolveSafeNewId(db, 'teacher_terms', it.id, 'term');
        const ca = {
          id: makeId('cavg'),
          classId,
          termId: id,
          schoolId: ownClass.school_id,
          yearId: ownClass.year_id,
          kind: 'term' as const,
          title: `Moyenne générale · ${name}`,
          sortOrder: number,
          color: '#ffffff',
          textColor: '#0f172a',
          borderColor: '#e2e8f0',
          borderDarkColor: '#cbd5e1',
          createdAt: now,
        };

        stmts.push(
          db
            .prepare(
              `INSERT INTO teacher_terms (id, user_id, class_id, school_id, year_id, number, name, coefficient, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(id, userId, classId, ownClass.school_id, ownClass.year_id, number, name, coefficient, now, now),
          db
            .prepare(
              `INSERT INTO teacher_class_averages
                (id, user_id, class_id, term_id, school_id, year_id, kind, title, sort_order, color, text_color, border_color, border_dark_color, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'term', ?, ?, '#ffffff', '#0f172a', '#e2e8f0', '#cbd5e1', ?, ?)`
            )
            .bind(ca.id, userId, classId, id, ownClass.school_id, ownClass.year_id, ca.title, number, now, now)
        );
        createdTerms.push({
          id,
          classId,
          schoolId: ownClass.school_id,
          yearId: ownClass.year_id,
          number,
          name,
          coefficient: coefficient ?? undefined,
          createdAt: now,
        });
        createdAverages.push(ca);
      }

      if (createdTerms.length === 0) return errorResponse('Aucun trimestre valide.', 400, origin);
      const incomingBatchTermsBytes =
        createdTerms.reduce((acc, t) => acc + utf8ByteLength(t.id) + utf8ByteLength(t.name) + 180, 0) +
        createdAverages.reduce((acc, ca) => acc + utf8ByteLength(ca.id) + utf8ByteLength(ca.title) + 200, 0);
      const quotaBlocked = await enforceStorageQuota(incomingBatchTermsBytes);
      if (quotaBlocked) return quotaBlocked;
      await runBatchChunked(db, stmts, 80);
      return jsonResponse({ success: true, terms: createdTerms, classAverages: createdAverages }, 201, origin);
    }

    if (entity === 'subjects') {
      const classId = String(body.classId || '').trim();
      const termId = String(body.termId || '').trim();
      if (!classId || !termId) return errorResponse('Classe et trimestre requis.', 400, origin);
      const ownTerm: any = await db
        .prepare('SELECT id, school_id, year_id FROM teacher_terms WHERE id = ? AND class_id = ? AND user_id = ? LIMIT 1')
        .bind(termId, classId, userId)
        .first();
      if (!ownTerm) return errorResponse('Trimestre ou classe introuvable.', 404, origin);

      const stmts: any[] = [];
      const createdSubjects: any[] = [];

      for (let i = 0; i < rawItems.length; i++) {
        const it = rawItems[i] || {};
        const name = String(it.name || '').trim().slice(0, 100);
        if (!name) continue;
        const coeffRaw = it.coefficient !== undefined && it.coefficient !== null && it.coefficient !== '' ? Number(it.coefficient) : null;
        const coefficient = coeffRaw !== null && Number.isFinite(coeffRaw) && coeffRaw > 0 ? coeffRaw : null;

        const now = baseNow + i;
        const id = await resolveSafeNewId(db, 'teacher_subjects', it.id, 'subject');
        const color = String(it.color || '#ffffff').slice(0, 32);
        const textColor = String(it.textColor || '#0f172a').slice(0, 32);
        const borderColor = String(it.borderColor || '#e2e8f0').slice(0, 32);
        const borderDarkColor = String(it.borderDarkColor || '#cbd5e1').slice(0, 32);
        const colorStyle = it.colorStyle === 'full' ? 'full' : 'accent';

        stmts.push(
          db
            .prepare(
              `INSERT INTO teacher_subjects
                (id, user_id, class_id, term_id, school_id, year_id, name, coefficient, color, text_color, border_color, border_dark_color, color_style, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(id, userId, classId, termId, ownTerm.school_id, ownTerm.year_id, name, coefficient, color, textColor, borderColor, borderDarkColor, colorStyle, now, now)
        );
        createdSubjects.push({
          id,
          classId,
          termId,
          schoolId: ownTerm.school_id,
          yearId: ownTerm.year_id,
          name,
          coefficient: coefficient ?? undefined,
          color,
          textColor,
          borderColor,
          borderDarkColor,
          colorStyle,
          createdAt: now,
        });
      }

      if (createdSubjects.length === 0) return errorResponse('Aucune matière valide.', 400, origin);
      const incomingBatchSubjectsBytes = createdSubjects.reduce(
        (acc, s) => acc + utf8ByteLength(s.id) + utf8ByteLength(s.name) + 220,
        0
      );
      const quotaBlocked = await enforceStorageQuota(incomingBatchSubjectsBytes);
      if (quotaBlocked) return quotaBlocked;
      await runBatchChunked(db, stmts, 80);
      return jsonResponse({ success: true, subjects: createdSubjects }, 201, origin);
    }

    return errorResponse(`Type d'entité non pris en charge : ${entity}`, 400, origin);
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

    // Contrôle STRICT du quota AVANT toute création D1 ou copie de photo R2
    if (checkStorageQuota) {
      let estimatedTransferBytes =
        createdLevels.length * 220 +
        createdClasses.length * 320 +
        createdTerms.length * 200 +
        createdSubjects.length * 240 +
        gradebookCopies.length * 512;

      for (const op of gradebookCopies) {
        if (!op?.sourceSubjectId || !op?.sourceTermId) continue;
        const srcRowStats: any = await db
          .prepare(
            `SELECT COUNT(*) as cnt,
                    COALESCE(SUM(LENGTH(CAST(COALESCE(full_name, '') AS BLOB)) + LENGTH(CAST(COALESCE(matricule, '') AS BLOB)) + LENGTH(CAST(COALESCE(notes_json, '[]') AS BLOB))), 0) as d1Bytes,
                    COALESCE(SUM(CASE WHEN photo_r2_key IS NOT NULL THEN CASE WHEN photo_size_bytes > 0 THEN photo_size_bytes ELSE 32768 END ELSE 0 END), 0) as photoBytes
             FROM teacher_gradebook_students
             WHERE user_id = ? AND subject_id = ? AND term_id = ?`
          )
          .bind(userId, String(op.sourceSubjectId), String(op.sourceTermId))
          .first()
          .catch(() => null);
        if (srcRowStats) {
          estimatedTransferBytes += Number(srcRowStats.d1Bytes || 0) + Number(srcRowStats.cnt || 0) * 160;
          if (op.options?.includePhotos) {
            estimatedTransferBytes += Number(srcRowStats.photoBytes || 0);
          }
        }
      }

      const quotaBlocked = await enforceStorageQuota(Math.max(1, estimatedTransferBytes));
      if (quotaBlocked) return quotaBlocked;
    }

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
              (id, user_id, school_id, year_id, name, color, text_color, border_color, color_style, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
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
            lv.colorStyle === 'full' ? 'full' : 'accent',
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
              (id, user_id, level_id, school_id, year_id, level_name, name, slogan, teacher_name, subject_label, color, text_color, border_color, border_dark_color, color_style, icon_gradient, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            cls.colorStyle === 'full' ? 'full' : 'accent',
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
      const termCoeff = term.coefficient !== undefined && term.coefficient !== null && Number.isFinite(Number(term.coefficient)) && Number(term.coefficient) > 0
        ? Number(term.coefficient)
        : null;
      structStmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_terms
              (id, user_id, class_id, school_id, year_id, number, name, coefficient, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            termId,
            userId,
            tClassId,
            term.schoolId,
            ownedSchoolYearMap.get(term.schoolId),
            Math.max(1, Number(term.number) || 1),
            String(term.name || 'Trimestre 1').trim().slice(0, 50),
            termCoeff,
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
              (id, user_id, class_id, term_id, school_id, year_id, name, coefficient, color, text_color, border_color, border_dark_color, color_style, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            subj.colorStyle === 'full' ? 'full' : 'accent',
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
             SET coefficient = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, color_style = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`
          )
          .bind(
            coeff,
            String(subj.color || '#ffffff').slice(0, 32),
            String(subj.textColor || '#0f172a').slice(0, 32),
            String(subj.borderColor || '#e2e8f0').slice(0, 32),
            String(subj.borderDarkColor || '#cbd5e1').slice(0, 32),
            subj.colorStyle === 'full' ? 'full' : 'accent',
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
        matricule: string;
        photoR2Key: string | null;
        photoSizeBytes: number;
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
              matricule: st.matricule || '',
              photoR2Key: st.photo_r2_key || null,
              photoSizeBytes: Number(st.photo_size_bytes || 0),
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
              matricule: '',
              photoR2Key: null,
              photoSizeBytes: 0,
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
              matricule: st.matricule || '',
              photoR2Key: st.photo_r2_key || null,
              photoSizeBytes: Number(st.photo_size_bytes || 0),
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
            if (!targetRow.matricule && srcSt.matricule) {
              targetRow.matricule = String(srcSt.matricule).trim();
            }
            if (opts.contentMode === 'students_and_notes') {
              targetRow.notes = targetRow.notes.map((existingVal, idx) =>
                existingVal.trim() ? existingVal : copiedNotes[idx] || ''
              );
            }
            if (opts.includePhotos && !targetRow.photoR2Key && srcSt.photo_r2_key) {
              const copied = await copyOwnedR2Photo(rawEnv, userId, srcSt.photo_r2_key, dstSubj.school_id, dstSubj.class_id, targetRow.id);
              if (copied) {
                targetRow.photoR2Key = copied.key;
                targetRow.photoSizeBytes = copied.sizeBytes;
                photosCopied++;
              }
            }
            continue;
          }

          const newRowId = makeId('std');
          studentIdMap.set(srcSt.id, newRowId);
          let newPhotoKey: string | null = null;
          let newPhotoSizeBytes = 0;
          if (opts.includePhotos && srcSt.photo_r2_key) {
            const copied = await copyOwnedR2Photo(rawEnv, userId, srcSt.photo_r2_key, dstSubj.school_id, dstSubj.class_id, newRowId);
            if (copied) {
              newPhotoKey = copied.key;
              newPhotoSizeBytes = copied.sizeBytes;
              photosCopied++;
            }
          }

          finalRows.push({
            id: newRowId,
            studentUid: srcSt.student_uid || newRowId,
            fullName: String(srcSt.full_name || '').trim(),
            matricule: String(srcSt.matricule || '').trim(),
            photoR2Key: newPhotoKey,
            photoSizeBytes: newPhotoSizeBytes,
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
            matricule: '',
            photoR2Key: null,
            photoSizeBytes: 0,
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
                (id, user_id, gradebook_id, subject_id, term_id, class_id, student_uid, row_order, full_name, matricule, photo_r2_key, photo_size_bytes, notes_json, average_20, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
              r.matricule,
              r.photoR2Key,
              r.photoSizeBytes,
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

    const [classesAfterTransfer, termsAfterTransfer, gradebookStats] = await Promise.all([
      db.prepare('SELECT * FROM teacher_classes WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all(),
      db.prepare('SELECT * FROM teacher_terms WHERE user_id = ? ORDER BY number ASC, created_at ASC').bind(userId).all(),
      computeGradebookStatsMap(db, userId),
    ]);
    const syncedAveragesRows = await syncClassAveragesForUser(
      db,
      userId,
      classesAfterTransfer.results || [],
      termsAfterTransfer.results || []
    );
    const classAverages = syncedAveragesRows.map((r: any) => ({
      id: r.id,
      classId: r.class_id,
      termId: r.term_id || undefined,
      schoolId: r.school_id,
      yearId: r.year_id,
      kind: (r.kind === 'annual' ? 'annual' : 'term') as 'annual' | 'term',
      title: r.title,
      sortOrder: Number(r.sort_order) || 0,
      color: r.color || '#ffffff',
      textColor: r.text_color || '#0f172a',
      borderColor: r.border_color || '#e2e8f0',
      borderDarkColor: r.border_dark_color || '#cbd5e1',
      createdAt: Number(r.created_at) || Date.now(),
    }));

    return jsonResponse({
      success: true,
      serverSummary: {
        gradebooksCopied,
        studentsCopied,
        notesCopied,
        photosCopied,
      },
      classAverages,
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

    // Contrôle STRICT du quota AVANT toute écriture R2 ou D1 lors de l'import local
    if (checkStorageQuota) {
      let estimatedImportBytes =
        (years.length + schools.length + levels.length + classes.length + terms.length + subjects.length + gradebooks.length) * 200 +
        utf8ByteLength(JSON.stringify({ years, levels, classes, terms, subjects }));
      for (const s of schools) {
        if (typeof s?.logoUrl === 'string' && s.logoUrl.startsWith('data:image/')) {
          const decoded = decodeBase64DataUrl(s.logoUrl);
          if (decoded) estimatedImportBytes += decoded.byteLength;
        }
      }
      for (const gb of gradebooks) {
        const studentsList: any[] = Array.isArray(gb?.students) ? gb.students.slice(0, 600) : [];
        estimatedImportBytes += studentsList.length * 220;
        for (const st of studentsList) {
          if (typeof st?.photoUrl === 'string' && st.photoUrl.startsWith('data:image/')) {
            const decoded = decodeBase64DataUrl(st.photoUrl);
            if (decoded) estimatedImportBytes += decoded.byteLength;
          }
        }
      }
      const quotaBlocked = await enforceStorageQuota(Math.max(1, estimatedImportBytes));
      if (quotaBlocked) return quotaBlocked;
    }

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
      let logoSizeBytes = 0;
      if (typeof s.logoUrl === 'string' && s.logoUrl.startsWith('data:image/')) {
        const bytes = decodeBase64DataUrl(s.logoUrl);
        const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
        if (bytes && fmt) {
          const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
          logoR2Key = `teacher-school-logos/${sanitizeSegment(userId)}/${sanitizeSegment(newId)}_${now}_${rand}.${fmt.ext}`;
          logoSizeBytes = bytes.byteLength;
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
              (id, user_id, year_id, name, logo_r2_key, logo_size_bytes, color, text_color, border_color, border_dark_color, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId,
            userId,
            mappedYearId,
            String(s.name).trim().slice(0, 120),
            logoR2Key,
            logoSizeBytes,
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

      const tCoeff = t.coefficient !== undefined && t.coefficient !== null && Number.isFinite(Number(t.coefficient)) && Number(t.coefficient) > 0
        ? Number(t.coefficient)
        : null;
      stmts.push(
        db
          .prepare(
            `INSERT OR IGNORE INTO teacher_terms
              (id, user_id, class_id, school_id, year_id, number, name, coefficient, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            newId,
            userId,
            mappedClassId,
            mappedSchoolId,
            mappedYearId,
            Math.max(1, Number(t.number) || 1),
            String(t.name || 'Trimestre 1').trim().slice(0, 50),
            tCoeff,
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
        let photoSizeBytes = 0;
        if (typeof st.photoUrl === 'string' && st.photoUrl.startsWith('data:image/')) {
          const bytes = decodeBase64DataUrl(st.photoUrl);
          const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
          if (bytes && fmt) {
            const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
            photoR2Key = `teacher-student-photos/${sanitizeSegment(userId)}/${sanitizeSegment(mappedSchoolId)}/${sanitizeSegment(mappedClassId)}/${sanitizeSegment(stId)}_${now}_${rand}.${fmt.ext}`;
            photoSizeBytes = bytes.byteLength;
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
                (id, user_id, gradebook_id, subject_id, term_id, class_id, student_uid, row_order, full_name, photo_r2_key, photo_size_bytes, notes_json, average_20, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
              photoSizeBytes,
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
      db.prepare('SELECT id, logo_r2_key, logo_size_bytes FROM teacher_schools WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_study_levels WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_classes WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_terms WHERE user_id = ?').bind(userId).all(),
      db.prepare('SELECT id FROM teacher_subjects WHERE user_id = ?').bind(userId).all(),
    ]);

    const ownedYears = new Set<string>((curYears.results || []).map((r: any) => r.id));
    const ownedSchoolsMap = new Map<string, { logoR2Key: string | null; logoSizeBytes: number }>();
    for (const r of curSchools.results || []) {
      ownedSchoolsMap.set(r.id, {
        logoR2Key: r.logo_r2_key || null,
        logoSizeBytes: Number(r.logo_size_bytes || 0),
      });
    }
    const ownedLevels = new Set<string>((curLevels.results || []).map((r: any) => r.id));
    const ownedClasses = new Set<string>((curClasses.results || []).map((r: any) => r.id));
    const ownedTerms = new Set<string>((curTerms.results || []).map((r: any) => r.id));
    const ownedSubjects = new Set<string>((curSubjects.results || []).map((r: any) => r.id));

    // Contrôle STRICT du quota AVANT toute écriture R2 ou D1 lors du sync manuel
    if (checkStorageQuota) {
      let estimatedSyncBytes = 1;
      for (const y of years) if (y?.id && !ownedYears.has(String(y.id))) estimatedSyncBytes += 220;
      for (const s of schools) {
        if (s?.id && !ownedSchoolsMap.has(String(s.id))) estimatedSyncBytes += 260;
        if (typeof s?.logoUrl === 'string' && s.logoUrl.startsWith('data:image/')) {
          const decoded = decodeBase64DataUrl(s.logoUrl);
          if (decoded) estimatedSyncBytes += decoded.byteLength;
        }
      }
      for (const l of levels) if (l?.id && !ownedLevels.has(String(l.id))) estimatedSyncBytes += 220;
      for (const c of classes) if (c?.id && !ownedClasses.has(String(c.id))) estimatedSyncBytes += 280;
      for (const t of terms) if (t?.id && !ownedTerms.has(String(t.id))) estimatedSyncBytes += 200;
      for (const s of subjects) if (s?.id && !ownedSubjects.has(String(s.id))) estimatedSyncBytes += 240;

      const quotaBlocked = await enforceStorageQuota(estimatedSyncBytes);
      if (quotaBlocked) return quotaBlocked;
    }

    const stmts: any[] = [];

    for (const y of years) {
      if (!y?.id || !y?.label) continue;
      const yId = String(y.id).slice(0, 80);
      const label = String(y.label).trim().slice(0, 30);
      if (!label) continue;
      const yStyle = y.colorStyle === 'accent' ? 'accent' : 'full';
      if (ownedYears.has(yId)) {
        stmts.push(
          db.prepare('UPDATE teacher_school_years SET label = ?, color = ?, text_color = ?, color_style = ?, updated_at = ? WHERE id = ? AND user_id = ?')
            .bind(label, String(y.color || '#00313d').slice(0, 32), String(y.textColor || '#ffffff').slice(0, 32), yStyle, now, yId, userId)
        );
      } else {
        stmts.push(
          db.prepare('INSERT OR IGNORE INTO teacher_school_years (id, user_id, label, color, text_color, color_style, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(yId, userId, label, String(y.color || '#00313d').slice(0, 32), String(y.textColor || '#ffffff').slice(0, 32), yStyle, Number(y.createdAt) || now, now)
        );
        ownedYears.add(yId);
      }
    }

    for (const s of schools) {
      if (!s?.id || !s?.name || !s?.yearId || !ownedYears.has(String(s.yearId))) continue;
      const sId = String(s.id).slice(0, 80);
      const name = String(s.name).trim().slice(0, 120);
      if (!name) continue;
      const sStyle = s.colorStyle === 'accent' ? 'accent' : 'full';

      const prevSchoolMeta = ownedSchoolsMap.get(sId);
      let logoR2Key: string | null = prevSchoolMeta?.logoR2Key ?? (s.logoR2Key && isOwnedR2Key(s.logoR2Key, userId) ? s.logoR2Key : null);
      let logoSizeBytes: number = prevSchoolMeta?.logoSizeBytes ?? 0;
      if (typeof s.logoUrl === 'string' && s.logoUrl.startsWith('data:image/')) {
        const bytes = decodeBase64DataUrl(s.logoUrl);
        const fmt = bytes ? detectValidatedImageFormat(bytes) : null;
        if (bytes && fmt) {
          const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
          logoR2Key = `teacher-school-logos/${sanitizeSegment(userId)}/${sanitizeSegment(sId)}_${now}_${rand}.${fmt.ext}`;
          logoSizeBytes = bytes.byteLength;
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
             SET name = ?, logo_r2_key = ?, logo_size_bytes = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, color_style = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`
          ).bind(
            name, logoR2Key, logoSizeBytes,
            String(s.color || '#ffffff').slice(0, 32),
            String(s.textColor || '#0f172a').slice(0, 32),
            String(s.borderColor || '#e2e8f0').slice(0, 32),
            String(s.borderDarkColor || '#cbd5e1').slice(0, 32),
            sStyle,
            now, sId, userId
          )
        );
      } else {
        stmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO teacher_schools
              (id, user_id, year_id, name, logo_r2_key, logo_size_bytes, color, text_color, border_color, border_dark_color, color_style, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            sId, userId, String(s.yearId).slice(0, 80), name, logoR2Key, logoSizeBytes,
            String(s.color || '#ffffff').slice(0, 32),
            String(s.textColor || '#0f172a').slice(0, 32),
            String(s.borderColor || '#e2e8f0').slice(0, 32),
            String(s.borderDarkColor || '#cbd5e1').slice(0, 32),
            sStyle,
            Number(s.createdAt) || now, now
          )
        );
        ownedSchoolsMap.set(sId, { logoR2Key, logoSizeBytes });
      }
    }

    for (const l of levels) {
      if (!l?.id || !l?.name || !l?.schoolId || !l?.yearId || !ownedSchoolsMap.has(String(l.schoolId))) continue;
      const lId = String(l.id).slice(0, 80);
      const name = String(l.name).trim().slice(0, 80);
      if (!name) continue;
      const lStyle = l.colorStyle === 'full' ? 'full' : 'accent';
      if (ownedLevels.has(lId)) {
        stmts.push(
          db.prepare('UPDATE teacher_study_levels SET name = ?, color = ?, text_color = ?, border_color = ?, color_style = ?, updated_at = ? WHERE id = ? AND user_id = ?')
            .bind(name, String(l.color || '#ffffff').slice(0, 32), String(l.textColor || '#0f172a').slice(0, 32), String(l.borderColor || '#cbd5e1').slice(0, 32), lStyle, now, lId, userId)
        );
      } else {
        stmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO teacher_study_levels
              (id, user_id, school_id, year_id, name, color, text_color, border_color, color_style, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
          ).bind(lId, userId, String(l.schoolId).slice(0, 80), String(l.yearId).slice(0, 80), name, String(l.color || '#ffffff').slice(0, 32), String(l.textColor || '#0f172a').slice(0, 32), String(l.borderColor || '#cbd5e1').slice(0, 32), lStyle, Number(l.createdAt) || now, now)
        );
        ownedLevels.add(lId);
      }
    }

    for (const c of classes) {
      if (!c?.id || !c?.levelId || !c?.schoolId || !c?.yearId || !ownedLevels.has(String(c.levelId))) continue;
      const cId = String(c.id).slice(0, 80);
      const cStyle = c.colorStyle === 'full' ? 'full' : 'accent';
      if (ownedClasses.has(cId)) {
        stmts.push(
          db.prepare(
            `UPDATE teacher_classes
             SET level_name = ?, name = ?, slogan = ?, teacher_name = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, color_style = ?, icon_gradient = ?, updated_at = ?
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
            cStyle,
            String(c.iconGradient || 'from-amber-500 to-orange-600').slice(0, 80),
            now, cId, userId
          )
        );
      } else {
        stmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO teacher_classes
              (id, user_id, level_id, school_id, year_id, level_name, name, slogan, teacher_name, subject_label, color, text_color, border_color, border_dark_color, color_style, icon_gradient, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
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
            cStyle,
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
      const tCoeff = t.coefficient !== undefined && t.coefficient !== null && Number.isFinite(Number(t.coefficient)) && Number(t.coefficient) > 0
        ? Number(t.coefficient)
        : null;
      if (ownedTerms.has(tId)) {
        stmts.push(
          db.prepare('UPDATE teacher_terms SET number = ?, name = ?, coefficient = ?, updated_at = ? WHERE id = ? AND user_id = ?')
            .bind(Math.max(1, Number(t.number) || 1), String(t.name || 'Trimestre 1').trim().slice(0, 50), tCoeff, now, tId, userId)
        );
      } else {
        stmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO teacher_terms
              (id, user_id, class_id, school_id, year_id, number, name, coefficient, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(tId, userId, String(t.classId).slice(0, 80), String(t.schoolId).slice(0, 80), String(t.yearId).slice(0, 80), Math.max(1, Number(t.number) || 1), String(t.name || 'Trimestre 1').trim().slice(0, 50), tCoeff, Number(t.createdAt) || now, now)
        );
        ownedTerms.add(tId);
      }
    }

    for (const s of subjects) {
      if (!s?.id || !s?.name || !s?.classId || !s?.termId || !s?.schoolId || !s?.yearId) continue;
      if (!ownedClasses.has(String(s.classId)) || !ownedTerms.has(String(s.termId))) continue;
      const sId = String(s.id).slice(0, 80);
      const coeff = s.coefficient !== undefined && s.coefficient !== null && Number.isFinite(Number(s.coefficient)) ? Number(s.coefficient) : null;
      const sStyle = s.colorStyle === 'full' ? 'full' : 'accent';
      if (ownedSubjects.has(sId)) {
        stmts.push(
          db.prepare(
            `UPDATE teacher_subjects
             SET name = ?, coefficient = ?, color = ?, text_color = ?, border_color = ?, border_dark_color = ?, color_style = ?, updated_at = ?
             WHERE id = ? AND user_id = ?`
          ).bind(
            String(s.name).trim().slice(0, 100), coeff,
            String(s.color || '#ffffff').slice(0, 32),
            String(s.textColor || '#0f172a').slice(0, 32),
            String(s.borderColor || '#e2e8f0').slice(0, 32),
            String(s.borderDarkColor || '#cbd5e1').slice(0, 32),
            sStyle,
            now, sId, userId
          )
        );
      } else {
        stmts.push(
          db.prepare(
            `INSERT OR IGNORE INTO teacher_subjects
              (id, user_id, class_id, term_id, school_id, year_id, name, coefficient, color, text_color, border_color, border_dark_color, color_style, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            sId, userId, String(s.classId).slice(0, 80), String(s.termId).slice(0, 80), String(s.schoolId).slice(0, 80), String(s.yearId).slice(0, 80),
            String(s.name).trim().slice(0, 100), coeff,
            String(s.color || '#ffffff').slice(0, 32),
            String(s.textColor || '#0f172a').slice(0, 32),
            String(s.borderColor || '#e2e8f0').slice(0, 32),
            String(s.borderDarkColor || '#cbd5e1').slice(0, 32),
            sStyle,
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

  // ==========================================================================
  // 12. ASSISTANT DELMAS (CONVERSATIONS, MESSAGES, DOSSIER FICHIERS R2 & CONTEXTE D1)
  // ==========================================================================
  const now = Date.now();

  // GET /api/teacher/delmas/conversations — Liste des conversations de l'utilisateur
  if (path === '/api/teacher/delmas/conversations' && method === 'GET') {
    const [convsRes, filesCountRes] = await Promise.all([
      db
        .prepare(
          `SELECT id, title, language, context_year_id, context_school_id, context_class_id,
                  context_term_id, context_subject_id, context_sheet_kind, is_pinned, pinned_at,
                  created_at, updated_at
           FROM teacher_delmas_conversations
           WHERE user_id = ?
           ORDER BY is_pinned DESC, COALESCE(pinned_at, 0) DESC, updated_at DESC
           LIMIT 200`
        )
        .bind(userId)
        .all()
        .catch(() => ({ results: [] })),
      db
        .prepare(
          `SELECT conversation_id, COUNT(*) as file_count
           FROM teacher_delmas_files
           WHERE user_id = ?
           GROUP BY conversation_id`
        )
        .bind(userId)
        .all()
        .catch(() => ({ results: [] })),
    ]);

    const fileCountMap = new Map<string, number>();
    for (const r of filesCountRes.results || []) {
      fileCountMap.set(String(r.conversation_id), Number(r.file_count) || 0);
    }

    const conversations = (convsRes.results || []).map((r: any) => ({
      id: String(r.id),
      title: String(r.title || 'Nouvelle discussion'),
      language: String(r.language || 'fr'),
      contextYearId: r.context_year_id || undefined,
      contextSchoolId: r.context_school_id || undefined,
      contextClassId: r.context_class_id || undefined,
      contextTermId: r.context_term_id || undefined,
      contextSubjectId: r.context_subject_id || undefined,
      contextSheetKind: r.context_sheet_kind || 'subject',
      isPinned: Boolean(r.is_pinned),
      pinnedAt: r.pinned_at ? Number(r.pinned_at) : null,
      filesCount: fileCountMap.get(String(r.id)) || 0,
      createdAt: Number(r.created_at) || now,
      updatedAt: Number(r.updated_at) || now,
    }));

    return jsonResponse({ success: true, conversations }, 200, origin);
  }

  // POST /api/teacher/delmas/conversations — Créer ou mettre à jour une conversation
  if (path === '/api/teacher/delmas/conversations' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const convId = await resolveSafeNewId(db, 'teacher_delmas_conversations', body?.id, 'tdconv');
    const title = String(body?.title || 'Nouvelle discussion').trim().slice(0, 140) || 'Nouvelle discussion';
    const language = String(body?.language || 'fr').trim().slice(0, 12) || 'fr';
    const contextYearId = body?.contextYearId ? String(body.contextYearId).slice(0, 80) : null;
    const contextSchoolId = body?.contextSchoolId ? String(body.contextSchoolId).slice(0, 80) : null;
    const contextClassId = body?.contextClassId ? String(body.contextClassId).slice(0, 80) : null;
    const contextTermId = body?.contextTermId ? String(body.contextTermId).slice(0, 80) : null;
    const contextSubjectId = body?.contextSubjectId ? String(body.contextSubjectId).slice(0, 80) : null;
    const contextSheetKind = String(body?.contextSheetKind || 'subject').slice(0, 32);

    const existing = await db
      .prepare('SELECT id, user_id, created_at, is_pinned, pinned_at FROM teacher_delmas_conversations WHERE id = ?')
      .bind(convId)
      .first();

    if (existing && String(existing.user_id) === userId) {
      await db
        .prepare(
          `UPDATE teacher_delmas_conversations
           SET title = ?, language = ?, context_year_id = COALESCE(?, context_year_id),
               context_school_id = COALESCE(?, context_school_id),
               context_class_id = COALESCE(?, context_class_id),
               context_term_id = COALESCE(?, context_term_id),
               context_subject_id = COALESCE(?, context_subject_id),
               context_sheet_kind = COALESCE(?, context_sheet_kind),
               updated_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .bind(
          title,
          language,
          contextYearId,
          contextSchoolId,
          contextClassId,
          contextTermId,
          contextSubjectId,
          contextSheetKind,
          now,
          convId,
          userId
        )
        .run();
    } else {
      const quotaBlocked = await enforceStorageQuota(320);
      if (quotaBlocked) return quotaBlocked;

      await db
        .prepare(
          `INSERT INTO teacher_delmas_conversations
            (id, user_id, title, language, context_year_id, context_school_id, context_class_id,
             context_term_id, context_subject_id, context_sheet_kind, is_pinned, pinned_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`
        )
        .bind(
          convId,
          userId,
          title,
          language,
          contextYearId,
          contextSchoolId,
          contextClassId,
          contextTermId,
          contextSubjectId,
          contextSheetKind,
          now,
          now
        )
        .run();
    }

    return jsonResponse(
      {
        success: true,
        conversation: {
          id: convId,
          title,
          language,
          contextYearId: contextYearId || undefined,
          contextSchoolId: contextSchoolId || undefined,
          contextClassId: contextClassId || undefined,
          contextTermId: contextTermId || undefined,
          contextSubjectId: contextSubjectId || undefined,
          contextSheetKind,
          isPinned: Boolean(existing?.is_pinned),
          pinnedAt: existing?.pinned_at ? Number(existing.pinned_at) : null,
          filesCount: 0,
          createdAt: Number(existing?.created_at) || now,
          updatedAt: now,
        },
      },
      200,
      origin
    );
  }

  // GET / PUT / DELETE /api/teacher/delmas/conversations/:id
  const delmasConvMatch = path.match(/^\/api\/teacher\/delmas\/conversations\/([a-zA-Z0-9_-]+)$/);
  if (delmasConvMatch) {
    const convId = delmasConvMatch[1];
    const convRow = await db
      .prepare('SELECT * FROM teacher_delmas_conversations WHERE id = ? AND user_id = ?')
      .bind(convId, userId)
      .first();

    if (!convRow) {
      return errorResponse('Discussion introuvable.', 404, origin);
    }

    if (method === 'GET') {
      const [msgsRes, filesRes] = await Promise.all([
        db
          .prepare(
            `SELECT id, conversation_id, sender, content, actions_json, attachments_json,
                    reaction, tokens, credits, created_at
             FROM teacher_delmas_messages
             WHERE user_id = ? AND conversation_id = ?
             ORDER BY created_at ASC`
          )
          .bind(userId, convId)
          .all()
          .catch(() => ({ results: [] })),
        db
          .prepare(
            `SELECT id, conversation_id, file_name, mime_type, file_type, r2_key,
                    size_bytes, compressed_size_bytes, extracted_text, preview_data_url, created_at
             FROM teacher_delmas_files
             WHERE user_id = ? AND conversation_id = ?
             ORDER BY created_at ASC`
          )
          .bind(userId, convId)
          .all()
          .catch(() => ({ results: [] })),
      ]);

      const files = await Promise.all(
        (filesRes.results || []).map(async (f: any) => ({
          id: String(f.id),
          conversationId: String(f.conversation_id),
          fileName: String(f.file_name),
          mimeType: String(f.mime_type || 'application/octet-stream'),
          fileType: String(f.file_type || 'document'),
          r2Key: f.r2_key || undefined,
          url: f.r2_key
            ? await signTeacherMediaUrl(apiOrigin, String(f.r2_key), jwtSecret)
            : f.preview_data_url || undefined,
          previewDataUrl: f.preview_data_url || undefined,
          sizeBytes: Number(f.size_bytes) || 0,
          compressedSizeBytes: Number(f.compressed_size_bytes) || 0,
          extractedText: String(f.extracted_text || ''),
          createdAt: Number(f.created_at) || now,
        }))
      );

      const messages = (msgsRes.results || []).map((m: any) => ({
        id: String(m.id),
        conversationId: String(m.conversation_id),
        sender: m.sender === 'ai' ? 'ai' : 'user',
        content: String(m.content || ''),
        actions: safeParseJson<any[]>(m.actions_json, []),
        attachments: safeParseJson<any[]>(m.attachments_json, []),
        reaction: m.reaction || null,
        tokens: Number(m.tokens) || 0,
        credits: Number(m.credits) || 0,
        createdAt: Number(m.created_at) || now,
      }));

      return jsonResponse(
        {
          success: true,
          conversation: {
            id: String(convRow.id),
            title: String(convRow.title || 'Nouvelle discussion'),
            language: String(convRow.language || 'fr'),
            contextYearId: convRow.context_year_id || undefined,
            contextSchoolId: convRow.context_school_id || undefined,
            contextClassId: convRow.context_class_id || undefined,
            contextTermId: convRow.context_term_id || undefined,
            contextSubjectId: convRow.context_subject_id || undefined,
            contextSheetKind: convRow.context_sheet_kind || 'subject',
            isPinned: Boolean(convRow.is_pinned),
            pinnedAt: convRow.pinned_at ? Number(convRow.pinned_at) : null,
            filesCount: files.length,
            createdAt: Number(convRow.created_at) || now,
            updatedAt: Number(convRow.updated_at) || now,
          },
          messages,
          files,
        },
        200,
        origin
      );
    }

    if (method === 'PUT') {
      const body = await request.json().catch(() => ({}));
      const nextTitle =
        typeof body?.title === 'string' && body.title.trim()
          ? body.title.trim().slice(0, 140)
          : String(convRow.title || 'Nouvelle discussion');
      const nextLang =
        typeof body?.language === 'string' && body.language.trim()
          ? body.language.trim().slice(0, 12)
          : String(convRow.language || 'fr');
      const nextPinned =
        typeof body?.isPinned === 'boolean' ? (body.isPinned ? 1 : 0) : Number(convRow.is_pinned) || 0;
      const nextPinnedAt =
        typeof body?.isPinned === 'boolean'
          ? body.isPinned
            ? now
            : null
          : convRow.pinned_at;

      await db
        .prepare(
          `UPDATE teacher_delmas_conversations
           SET title = ?, language = ?, is_pinned = ?, pinned_at = ?, updated_at = ?
           WHERE id = ? AND user_id = ?`
        )
        .bind(nextTitle, nextLang, nextPinned, nextPinnedAt, now, convId, userId)
        .run();

      return jsonResponse(
        {
          success: true,
          conversation: {
            id: convId,
            title: nextTitle,
            language: nextLang,
            isPinned: Boolean(nextPinned),
            pinnedAt: nextPinnedAt ? Number(nextPinnedAt) : null,
            updatedAt: now,
          },
        },
        200,
        origin
      );
    }

    if (method === 'DELETE') {
      const filesRes = await db
        .prepare('SELECT r2_key FROM teacher_delmas_files WHERE user_id = ? AND conversation_id = ?')
        .bind(userId, convId)
        .all()
        .catch(() => ({ results: [] }));

      const r2Keys = (filesRes.results || [])
        .map((r: any) => (r.r2_key ? String(r.r2_key) : null))
        .filter(Boolean);

      await db
        .batch([
          db.prepare('DELETE FROM teacher_delmas_files WHERE user_id = ? AND conversation_id = ?').bind(userId, convId),
          db.prepare('DELETE FROM teacher_delmas_messages WHERE user_id = ? AND conversation_id = ?').bind(userId, convId),
          db.prepare('DELETE FROM teacher_delmas_conversations WHERE id = ? AND user_id = ?').bind(convId, userId),
        ]);

      if (r2Keys.length > 0) {
        await deleteOwnedR2Keys(rawEnv, userId, r2Keys);
      }

      return jsonResponse({ success: true, deletedId: convId }, 200, origin);
    }
  }

  // POST /api/teacher/delmas/conversations/:id/messages — Enregistrer un message (ou couple user + ai) dans la conversation
  const delmasMsgMatch = path.match(/^\/api\/teacher\/delmas\/conversations\/([a-zA-Z0-9_-]+)\/messages$/);
  if (delmasMsgMatch && method === 'POST') {
    const convId = delmasMsgMatch[1];
    const body = await request.json().catch(() => ({}));

    // Vérification Anti-IDOR stricte : interdit toute écriture sur une conversation appartenant à un autre compte
    const existingAnyOwner = await db
      .prepare('SELECT id, user_id, title, language FROM teacher_delmas_conversations WHERE id = ?')
      .bind(convId)
      .first();

    if (existingAnyOwner && String(existingAnyOwner.user_id) !== userId) {
      return errorResponse('Accès refusé à cette discussion.', 403, origin);
    }

    let convRow = existingAnyOwner;

    const rawMessages: any[] = (Array.isArray(body?.messages)
      ? body.messages
      : body?.message
      ? [body.message]
      : []
    ).slice(0, 50);

    let incomingBytes = 0;
    for (const m of rawMessages) {
      incomingBytes +=
        160 +
        utf8ByteLength(m?.content || '') +
        utf8ByteLength(JSON.stringify(m?.actions || [])) +
        utf8ByteLength(JSON.stringify(m?.attachments || []));
    }

    const quotaBlocked = await enforceStorageQuota(Math.max(200, incomingBytes));
    if (quotaBlocked) return quotaBlocked;

    if (!convRow) {
      const initialTitle =
        String(body?.title || rawMessages[0]?.content || 'Nouvelle discussion')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 80) || 'Nouvelle discussion';
      const lang = String(body?.language || 'fr').trim().slice(0, 12) || 'fr';
      await db
        .prepare(
          `INSERT INTO teacher_delmas_conversations
            (id, user_id, title, language, context_year_id, context_school_id, context_class_id,
             context_term_id, context_subject_id, context_sheet_kind, is_pinned, pinned_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`
        )
        .bind(
          convId,
          userId,
          initialTitle,
          lang,
          body?.contextYearId ? String(body.contextYearId).slice(0, 80) : null,
          body?.contextSchoolId ? String(body.contextSchoolId).slice(0, 80) : null,
          body?.contextClassId ? String(body.contextClassId).slice(0, 80) : null,
          body?.contextTermId ? String(body.contextTermId).slice(0, 80) : null,
          body?.contextSubjectId ? String(body.contextSubjectId).slice(0, 80) : null,
          String(body?.contextSheetKind || 'subject').slice(0, 32),
          now,
          now
        )
        .run();
      convRow = { id: convId, title: initialTitle, language: lang };
    }

    const stmts: any[] = [];
    const savedMessages: any[] = [];

    for (let i = 0; i < rawMessages.length; i++) {
      const m = rawMessages[i];
      if (!m || typeof m !== 'object') continue;
      const msgId = await resolveSafeNewId(db, 'teacher_delmas_messages', m.id, 'tdmsg');
      const sender = m.sender === 'ai' ? 'ai' : 'user';
      const content = String(m.content ?? '').slice(0, 120000);
      const actionsArr = Array.isArray(m.actions) ? m.actions.slice(0, 30) : [];
      const attachmentsArr = (Array.isArray(m.attachments) ? m.attachments.slice(0, 20) : [])
        .filter((a: any) => a && typeof a === 'object')
        .map((a: any) => {
          const safeUrl =
            typeof a.url === 'string' &&
            (/^https?:\/\//i.test(a.url) || isSafeRasterPreviewDataUrl(a.url))
              ? a.url.slice(0, 120000)
              : undefined;
          const safePreview = isSafeRasterPreviewDataUrl(a.previewDataUrl)
            ? a.previewDataUrl.slice(0, 120000)
            : undefined;
          return {
            id: String(a.id || '').slice(0, 80),
            fileName: String(a.fileName || 'fichier').slice(0, 180),
            fileType: String(a.fileType || 'document').slice(0, 40),
            mimeType: sanitizeUploadedMimeAndExt(a.mimeType || '', a.fileName || '').mimeType,
            sizeBytes: Math.max(0, Number(a.sizeBytes) || 0),
            url: safeUrl,
            previewDataUrl: safePreview,
          };
        });
      const tokens = Math.max(0, Math.round(Number(m.tokens) || 0));
      const credits = Math.max(0, Number(m.credits) || 0);
      const createdAt = Number(m.createdAt) || now + i;

      stmts.push(
        db
          .prepare(
            `INSERT OR REPLACE INTO teacher_delmas_messages
              (id, conversation_id, user_id, sender, content, actions_json, attachments_json, reaction, tokens, credits, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            msgId,
            convId,
            userId,
            sender,
            content,
            JSON.stringify(actionsArr),
            JSON.stringify(attachmentsArr),
            m.reaction || null,
            tokens,
            credits,
            createdAt
          )
      );

      savedMessages.push({
        id: msgId,
        conversationId: convId,
        sender,
        content,
        actions: actionsArr,
        attachments: attachmentsArr,
        reaction: m.reaction || null,
        tokens,
        credits,
        createdAt,
      });
    }

    const nextTitle =
      typeof body?.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 140)
        : String(convRow.title || '') === 'Nouvelle discussion' && rawMessages[0]?.content
        ? String(rawMessages[0].content).trim().replace(/\s+/g, ' ').slice(0, 75)
        : String(convRow.title || 'Nouvelle discussion');

    stmts.push(
      db
        .prepare('UPDATE teacher_delmas_conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?')
        .bind(nextTitle, now, convId, userId)
    );

    if (stmts.length > 0) {
      await runBatchChunked(db, stmts, 50);
    }

    return jsonResponse(
      {
        success: true,
        conversationId: convId,
        title: nextTitle,
        messages: savedMessages,
      },
      200,
      origin
    );
  }

  // POST /api/teacher/delmas/conversations/:id/files — Importer un fichier/image dans le dossier dédié de la conversation
  const delmasFilesMatch = path.match(/^\/api\/teacher\/delmas\/conversations\/([a-zA-Z0-9_-]+)\/files$/);
  if (delmasFilesMatch && method === 'POST') {
    const convId = delmasFilesMatch[1];

    // Vérification Anti-IDOR stricte AVANT tout décodage ou upload R2
    const existingAnyOwnerConv = await db
      .prepare('SELECT id, user_id FROM teacher_delmas_conversations WHERE id = ?')
      .bind(convId)
      .first();
    if (existingAnyOwnerConv && String(existingAnyOwnerConv.user_id) !== userId) {
      return errorResponse('Accès refusé à cette discussion.', 403, origin);
    }

    const contentTypeHeader = String(request.headers.get('Content-Type') || '').toLowerCase();
    let body: Record<string, any> = {};
    let fileBytes: Uint8Array | null = null;

    if (contentTypeHeader.includes('multipart/form-data')) {
      const form = await request.formData().catch(() => null);
      if (form) {
        const uploadedFile = form.get('file');
        if (uploadedFile && typeof uploadedFile !== 'string' && typeof (uploadedFile as any).arrayBuffer === 'function') {
          const buf = await (uploadedFile as any).arrayBuffer();
          if (buf && buf.byteLength > 0 && buf.byteLength <= 25 * 1024 * 1024) {
            fileBytes = new Uint8Array(buf);
          }
          body.fileName = String(form.get('fileName') || (uploadedFile as any).name || 'fichier');
          body.mimeType = String(form.get('mimeType') || (uploadedFile as any).type || '');
        } else {
          body.fileName = String(form.get('fileName') || 'fichier');
          body.mimeType = String(form.get('mimeType') || '');
        }
        if (form.get('id')) body.id = String(form.get('id'));
        if (form.get('fileType')) body.fileType = String(form.get('fileType'));
        if (form.get('extractedText') !== null) body.extractedText = String(form.get('extractedText') || '');
        if (form.get('previewDataUrl')) body.previewDataUrl = String(form.get('previewDataUrl'));
        if (form.get('originalSizeBytes')) body.originalSizeBytes = Number(form.get('originalSizeBytes'));
        if (form.get('sizeBytes')) body.sizeBytes = Number(form.get('sizeBytes'));
        if (form.get('conversationTitle')) body.conversationTitle = String(form.get('conversationTitle'));
        if (form.get('language')) body.language = String(form.get('language'));
      }
    } else {
      body = (await request.json().catch(() => ({}))) || {};
    }

    const fileName = String(body?.fileName || 'fichier').trim().slice(0, 180) || 'fichier';
    const sanitizedUpload = sanitizeUploadedMimeAndExt(body?.mimeType || '', fileName);
    const mimeType = sanitizedUpload.mimeType;
    const fileType = String(body?.fileType || 'document').trim().slice(0, 40);
    const extractedText = String(body?.extractedText || '').slice(0, 180000);
    const previewDataUrl = isSafeRasterPreviewDataUrl(body?.previewDataUrl)
      ? body.previewDataUrl.slice(0, 120000)
      : null;
    const rawDataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';

    // Décodage binaire si dataUrl JSON fourni (compatibilité descendante)
    if (!fileBytes && rawDataUrl) {
      const b64Idx = rawDataUrl.indexOf(';base64,');
      const cleanB64 = (b64Idx >= 0 ? rawDataUrl.slice(b64Idx + 8) : rawDataUrl).replace(/\s+/g, '');
      if (cleanB64.length > 0 && cleanB64.length <= 12 * 1024 * 1024 * 1.4) {
        try {
          const bin = atob(cleanB64);
          fileBytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) {
            fileBytes[i] = bin.charCodeAt(i);
          }
        } catch {
          fileBytes = null;
        }
      }
    }

    const compressedBytesLen = fileBytes ? fileBytes.byteLength : utf8ByteLength(extractedText);
    const requestedOriginalSize = Number(body?.originalSizeBytes);
    const billedSizeBytes =
      Number.isFinite(requestedOriginalSize) && requestedOriginalSize > compressedBytesLen
        ? Math.min(Math.round(requestedOriginalSize), 50 * 1024 * 1024)
        : Math.max(compressedBytesLen, Number(body?.sizeBytes) || 0);

    const incomingD1AndR2Bytes =
      billedSizeBytes +
      160 +
      utf8ByteLength(fileName) +
      utf8ByteLength(extractedText) +
      utf8ByteLength(previewDataUrl || '');

    const quotaBlocked = await enforceStorageQuota(Math.max(256, incomingD1AndR2Bytes));
    if (quotaBlocked) return quotaBlocked;

    // S'assurer que la conversation existe pour cet utilisateur
    if (!existingAnyOwnerConv) {
      await db
        .prepare(
          `INSERT INTO teacher_delmas_conversations
            (id, user_id, title, language, context_sheet_kind, is_pinned, pinned_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'subject', 0, NULL, ?, ?)`
        )
        .bind(
          convId,
          userId,
          String(body?.conversationTitle || `Fichier : ${fileName}`).slice(0, 120),
          String(body?.language || 'fr').slice(0, 12),
          now,
          now
        )
        .run();
    }

    const fileId = await resolveSafeNewId(db, 'teacher_delmas_files', body?.id, 'tdfile');
    const safeUser = sanitizeSegment(userId);
    const safeConv = sanitizeSegment(convId);
    const safeExt = sanitizedUpload.ext;
    let r2Key: string | null = null;

    if (fileBytes && fileBytes.byteLength > 0) {
      const candidateKey = `teacher-delmas-files/${safeUser}/${safeConv}/${sanitizeSegment(fileId)}_${now}.${safeExt}`;
      const bucket = getTeacherPhotosBucket(rawEnv) || getFallbackMainBucket(rawEnv);
      if (bucket) {
        try {
          await bucket.put(candidateKey, fileBytes, {
            httpMetadata: {
              contentType: mimeType || 'application/octet-stream',
              cacheControl: 'private, max-age=31536000',
            },
            customMetadata: {
              userId: safeUser,
              conversationId: safeConv,
              fileId: sanitizeSegment(fileId),
              fileName: fileName.slice(0, 120),
              originalSizeBytes: String(billedSizeBytes),
            },
          });
          r2Key = candidateKey;
        } catch {
          r2Key = null;
        }
      }
    }

    await db
      .prepare(
        `INSERT INTO teacher_delmas_files
          (id, conversation_id, user_id, file_name, mime_type, file_type, r2_key,
           size_bytes, compressed_size_bytes, extracted_text, preview_data_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        fileId,
        convId,
        userId,
        fileName,
        mimeType,
        fileType,
        r2Key,
        billedSizeBytes,
        compressedBytesLen,
        extractedText,
        previewDataUrl,
        now
      )
      .run();

    await db
      .prepare('UPDATE teacher_delmas_conversations SET updated_at = ? WHERE id = ? AND user_id = ?')
      .bind(now, convId, userId)
      .run();

    const signedUrl = r2Key
      ? await signTeacherMediaUrl(apiOrigin, r2Key, jwtSecret)
      : previewDataUrl || undefined;

    return jsonResponse(
      {
        success: true,
        file: {
          id: fileId,
          conversationId: convId,
          fileName,
          mimeType,
          fileType,
          r2Key: r2Key || undefined,
          url: signedUrl,
          previewDataUrl: previewDataUrl || undefined,
          sizeBytes: billedSizeBytes,
          compressedSizeBytes: compressedBytesLen,
          extractedText,
          createdAt: now,
        },
      },
      200,
      origin
    );
  }

  // PUT / DELETE /api/teacher/delmas/files/:fileId — Mettre à jour la mémoire extraite (OCR/Whisper) ou supprimer un fichier du dossier de la conversation
  const delmasFileByIdMatch = path.match(/^\/api\/teacher\/delmas\/files\/([a-zA-Z0-9_-]+)$/);
  if (delmasFileByIdMatch && (method === 'PUT' || method === 'PATCH')) {
    const fileId = delmasFileByIdMatch[1];
    const row = await db
      .prepare('SELECT id, conversation_id, extracted_text FROM teacher_delmas_files WHERE id = ? AND user_id = ?')
      .bind(fileId, userId)
      .first();

    if (!row) {
      return errorResponse('Fichier introuvable.', 404, origin);
    }

    const body = await request.json().catch(() => ({}));
    const nextExtractedText = String(body?.extractedText ?? '').slice(0, 180000);
    const prevBytes = utf8ByteLength(String(row.extracted_text || ''));
    const nextBytes = utf8ByteLength(nextExtractedText);
    const deltaBytes = Math.max(0, nextBytes - prevBytes);

    if (deltaBytes > 0) {
      const quotaBlocked = await enforceStorageQuota(deltaBytes);
      if (quotaBlocked) return quotaBlocked;
    }

    await db
      .prepare('UPDATE teacher_delmas_files SET extracted_text = ? WHERE id = ? AND user_id = ?')
      .bind(nextExtractedText, fileId, userId)
      .run();

    return jsonResponse(
      {
        success: true,
        fileId,
        conversationId: String(row.conversation_id),
        extractedText: nextExtractedText,
      },
      200,
      origin
    );
  }

  if (delmasFileByIdMatch && method === 'DELETE') {
    const fileId = delmasFileByIdMatch[1];
    const row = await db
      .prepare('SELECT id, r2_key FROM teacher_delmas_files WHERE id = ? AND user_id = ?')
      .bind(fileId, userId)
      .first();

    if (!row) {
      return errorResponse('Fichier introuvable.', 404, origin);
    }

    await db
      .prepare('DELETE FROM teacher_delmas_files WHERE id = ? AND user_id = ?')
      .bind(fileId, userId)
      .run();

    if (row.r2_key) {
      await deleteOwnedR2Keys(rawEnv, userId, [String(row.r2_key)]);
    }

    return jsonResponse({ success: true, deletedId: fileId }, 200, origin);
  }

  // GET /api/teacher/delmas/workspace-context — Lecture complète de la base de données Moyennes de l'utilisateur
  if (path === '/api/teacher/delmas/workspace-context' && method === 'GET') {
    const [yearsRes, schoolsRes, levelsRes, classesRes, termsRes, subjectsRes, gbsRes, studentsRes] =
      await Promise.all([
        db.prepare('SELECT id, label FROM teacher_school_years WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all(),
        db.prepare('SELECT id, year_id, name FROM teacher_schools WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all(),
        db.prepare('SELECT id, school_id, year_id, name FROM teacher_study_levels WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC').bind(userId).all(),
        db.prepare('SELECT id, level_id, school_id, year_id, level_name, name, teacher_name, show_matricule, average_scale FROM teacher_classes WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all(),
        db.prepare('SELECT id, class_id, school_id, year_id, number, name, coefficient FROM teacher_terms WHERE user_id = ? ORDER BY number ASC').bind(userId).all(),
        db.prepare('SELECT id, class_id, term_id, school_id, year_id, name, coefficient FROM teacher_subjects WHERE user_id = ? ORDER BY created_at ASC').bind(userId).all(),
        db.prepare('SELECT id, subject_id, term_id, class_id, note_col_count, col_metas_json, layout_json FROM teacher_gradebooks WHERE user_id = ?').bind(userId).all(),
        db.prepare('SELECT id, gradebook_id, subject_id, term_id, class_id, student_uid, row_order, full_name, matricule, notes_json, average_20 FROM teacher_gradebook_students WHERE user_id = ? ORDER BY row_order ASC').bind(userId).all(),
      ]);

    const studentsByGb = new Map<string, any[]>();
    for (const s of studentsRes.results || []) {
      const gbId = String(s.gradebook_id);
      const list = studentsByGb.get(gbId) || [];
      list.push({
        id: String(s.student_uid || s.id),
        name: String(s.full_name || ''),
        matricule: String(s.matricule || ''),
        notes: safeParseJson<string[]>(s.notes_json, []),
        average20: s.average_20 !== null && s.average_20 !== undefined ? Number(s.average_20) : null,
      });
      studentsByGb.set(gbId, list);
    }

    const gradebooks = (gbsRes.results || []).map((g: any) => ({
      id: String(g.id),
      subjectId: String(g.subject_id),
      termId: String(g.term_id),
      classId: String(g.class_id),
      noteColCount: Number(g.note_col_count) || 7,
      colMetas: safeParseJson<Record<string, any>>(g.col_metas_json, {}),
      students: (studentsByGb.get(String(g.id)) || []).filter(
        (st) => st.name.trim().length > 0 || st.matricule.trim().length > 0 || st.notes.some((n: string) => String(n).trim().length > 0)
      ),
    }));

    return jsonResponse(
      {
        success: true,
        workspace: {
          years: (yearsRes.results || []).map((y: any) => ({ id: String(y.id), label: String(y.label) })),
          schools: (schoolsRes.results || []).map((s: any) => ({ id: String(s.id), yearId: String(s.year_id), name: String(s.name) })),
          levels: (levelsRes.results || []).map((l: any) => ({ id: String(l.id), schoolId: String(l.school_id), yearId: String(l.year_id), name: String(l.name) })),
          classes: (classesRes.results || []).map((c: any) => ({
            id: String(c.id),
            levelId: String(c.level_id),
            schoolId: String(c.school_id),
            yearId: String(c.year_id),
            level: String(c.level_name),
            name: String(c.name || ''),
            teacherName: String(c.teacher_name || ''),
            showMatricule: Boolean(c.show_matricule),
            averageScale: Number(c.average_scale) || 20,
          })),
          terms: (termsRes.results || []).map((t: any) => ({
            id: String(t.id),
            classId: String(t.class_id),
            number: Number(t.number) || 1,
            name: String(t.name),
            coefficient: t.coefficient !== null && t.coefficient !== undefined ? Number(t.coefficient) : null,
          })),
          subjects: (subjectsRes.results || []).map((s: any) => ({
            id: String(s.id),
            classId: String(s.class_id),
            termId: String(s.term_id),
            name: String(s.name),
            coefficient: s.coefficient !== null && s.coefficient !== undefined ? Number(s.coefficient) : null,
          })),
          gradebooks,
        },
      },
      200,
      origin
    );
  }

  return errorResponse(`Route enseignant non trouvée : ${method} ${path}`, 404, origin);
}

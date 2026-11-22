-- ============================================================================
-- STUDYCLOUD - MIGRATION MODULE ENSEIGNANT (CALCUL DE MOYENNE & GESTION SCOLAIRE)
-- ============================================================================
-- Tables dédiées Cloudflare D1 strictement isolées par compte utilisateur (user_id)
-- avec intégrité référentielle complète en cascade (ON DELETE CASCADE).
--
-- Hiérarchie relationnelle :
--   users(id)
--    └── teacher_school_years (id, user_id)
--         └── teacher_schools (id, user_id, year_id, logo_r2_key)
--              └── teacher_study_levels (id, user_id, school_id, year_id)
--                   └── teacher_classes (id, user_id, level_id, school_id, year_id)
--                        ├── teacher_terms (id, user_id, class_id, school_id, year_id)
--                        └── teacher_subjects (id, user_id, class_id, term_id, school_id, year_id)
--                             └── teacher_gradebooks (id, user_id, subject_id, term_id)
--                                  └── teacher_gradebook_students (id, user_id, gradebook_id, student_uid, photo_r2_key)
--
-- Stockage R2 dédié (dans BUCKET_IMAGES / BUCKET_TEACHER_PHOTOS) :
--   - Photos profil élèves : teacher-student-photos/{user_id}/{school_id}/{class_id}/{student_id}_{ts}.{ext}
--   - Logos établissements : teacher-school-logos/{user_id}/{school_id}_{ts}.{ext}
--
-- Exécution manuelle optionnelle via Wrangler :
--   wrangler d1 execute d1-studycloud --remote --file=tables/migration_teacher_gradebook.sql
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Rentrées / Années scolaires
CREATE TABLE IF NOT EXISTS teacher_school_years (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#00313d',
    text_color TEXT DEFAULT '#ffffff',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_teacher_years_user ON teacher_school_years(user_id, created_at);

-- 2. Établissements scolaires (rattachés à une rentrée scolaire + utilisateur)
CREATE TABLE IF NOT EXISTS teacher_schools (
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
);
CREATE INDEX IF NOT EXISTS idx_teacher_schools_user_year ON teacher_schools(user_id, year_id, created_at);

-- 3. Niveaux d'étude (CP1, 6ème, 2nde, Terminale, Licence 1...) rattachés à une école
CREATE TABLE IF NOT EXISTS teacher_study_levels (
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
);
CREATE INDEX IF NOT EXISTS idx_teacher_levels_user_school ON teacher_study_levels(user_id, school_id, sort_order, created_at);

-- 4. Classes (rattachées à un niveau d'étude + école + année + utilisateur)
CREATE TABLE IF NOT EXISTS teacher_classes (
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
);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_user_level ON teacher_classes(user_id, school_id, level_id, created_at);

-- 5. Trimestres (rattachés à une classe + école + année + utilisateur)
CREATE TABLE IF NOT EXISTS teacher_terms (
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
);
CREATE INDEX IF NOT EXISTS idx_teacher_terms_user_class ON teacher_terms(user_id, class_id, number);

-- 6. Matières (rattachées à une classe + trimestre + école + année + utilisateur)
CREATE TABLE IF NOT EXISTS teacher_subjects (
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
);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_user_class_term ON teacher_subjects(user_id, class_id, term_id, created_at);

-- 7. Feuilles / Tableurs de notes par (matière, trimestre)
CREATE TABLE IF NOT EXISTS teacher_gradebooks (
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
);
CREATE INDEX IF NOT EXISTS idx_teacher_gb_user_subject_term ON teacher_gradebooks(user_id, subject_id, term_id);

-- 8. Lignes élèves & notes dans un tableur (avec clé photo R2 + student_uid stable multi-matières)
CREATE TABLE IF NOT EXISTS teacher_gradebook_students (
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
);
CREATE INDEX IF NOT EXISTS idx_teacher_gb_students_gb ON teacher_gradebook_students(user_id, gradebook_id, row_order);
CREATE INDEX IF NOT EXISTS idx_teacher_gb_students_class_term ON teacher_gradebook_students(user_id, class_id, term_id, student_uid);

-- 9. Cartes de calcul de moyenne générale par classe (annuelle + 1 par trimestre, liée au compte et à la classe)
CREATE TABLE IF NOT EXISTS teacher_class_averages (
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
);
CREATE INDEX IF NOT EXISTS idx_teacher_class_avgs_user_class ON teacher_class_averages(user_id, class_id, sort_order, created_at);

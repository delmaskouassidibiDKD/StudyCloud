-- ============================================================================
-- StudyCloud - Schéma de Base de Données Cloudflare D1 (SQLite)
-- Version : 1.0.0
-- Ce script crée toutes les tables et index pour l'ensemble des modules.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- 1. UTILISATEURS & PROFIL
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,                          -- NULL si connexion Google
    provider TEXT DEFAULT 'email',               -- 'email' | 'google'
    google_id TEXT UNIQUE,                       -- ID Google OAuth
    email_verified INTEGER DEFAULT 0,            -- 1 = email vérifié
    school TEXT DEFAULT '',
    filiere TEXT DEFAULT '',
    country TEXT DEFAULT 'Côte d''Ivoire',
    level TEXT DEFAULT '',                       -- Niveau d'études (BTS 1, Licence 2...)
    bio TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    avatar_url TEXT,
    is_onboarded INTEGER DEFAULT 0,              -- 1 = a complété l'onboarding
    last_active_at TEXT DEFAULT CURRENT_TIMESTAMP, -- Dernière activité (expiration après 1 mois)
    security_question_1 TEXT DEFAULT 'Quelle est votre ville de naissance ?',
    security_answer_1_hash TEXT DEFAULT '',      -- Hash SHA-256 réponse secrète 1
    security_question_2 TEXT DEFAULT 'Quel est le prénom de votre mère ?',
    security_answer_2_hash TEXT DEFAULT '',      -- Hash SHA-256 réponse secrète 2
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Vérifications d'email & Limitation de renvoi (anti-spam 30s & blocage 3h après 4 tentatives)
CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    resend_count INTEGER DEFAULT 1,
    last_sent_at TEXT NOT NULL,
    blocked_until TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verif_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verif_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email);

-- Réclamations de mot de passe & Quota (max 4 par jour, blocage 24h)
CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_email TEXT NOT NULL,
    reset_code TEXT NOT NULL,
    attempts_today INTEGER DEFAULT 1,
    last_requested_at TEXT NOT NULL,
    blocked_until TEXT,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pw_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_pw_resets_code ON password_resets(reset_code);
CREATE INDEX IF NOT EXISTS idx_pw_resets_email ON password_resets(target_email);

-- Sessions d'authentification (JWT invalidation list)
CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,             -- Hash SHA-256 du token JWT
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON auth_sessions(token_hash);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    view_mode TEXT DEFAULT 'grid', -- 'grid' | 'list'
    is_dark_mode INTEGER DEFAULT 0, -- 0 = false, 1 = true
    current_tab TEXT DEFAULT 'folders',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 2. MATIÈRES & DOSSIERS D'ÉTUDES
-- ============================================================================
CREATE TABLE IF NOT EXISTS matieres (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    coefficient REAL DEFAULT 1.0,
    color TEXT DEFAULT '#EA580C',
    category TEXT DEFAULT 'Général',
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_matieres_user ON matieres(user_id);

-- ============================================================================
-- 3. FICHIERS & DOCUMENTS (Cloudflare R2 pour le stockage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    matiere_id TEXT, -- NULL si fichier à la racine (Mes fichiers)
    name TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    extension TEXT,
    r2_key TEXT, -- Clé unique dans Cloudflare R2 (NULL si stockage local/temporaire)
    file_url TEXT,
    is_favorite INTEGER DEFAULT 0,
    is_imported INTEGER DEFAULT 0,
    is_study_session INTEGER DEFAULT 0, -- 1 si importé pendant la session d'étude Delmas
    last_imported INTEGER DEFAULT 0, -- Timestamp de dernier import pour affichage en tête
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (matiere_id) REFERENCES matieres(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_matiere ON files(matiere_id);
CREATE INDEX IF NOT EXISTS idx_files_study ON files(user_id, is_study_session);

-- ============================================================================
-- 4. PARTAGES & LIENS PUBLICS / SÉCURISÉS (PIN / Mot de passe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shared_folders (
    id TEXT PRIMARY KEY, -- 'folder-xyz' ou UUID
    user_id TEXT NOT NULL,
    share_code TEXT UNIQUE, -- Code unique de partage rattaché au compte utilisateur (ex: 'DKD-7A9B')
    share_url TEXT, -- URL complète de consultation / téléchargement
    qr_code_data TEXT, -- Données ou SVG du code QR pour scan mobile
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'Cours',
    author_name TEXT,
    school TEXT,
    country TEXT DEFAULT 'Côte d''Ivoire',
    is_public INTEGER DEFAULT 1, -- 1 = Public à tous, 0 = Privé
    is_password_protected INTEGER DEFAULT 0, -- 1 = Verrouillé par PIN
    password_hash TEXT,
    allow_download INTEGER DEFAULT 1, -- 1 = Téléchargement autorisé pour tous
    total_size INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    expires_at TEXT, -- NULL si permanent, ou date ISO
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_shared_user ON shared_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_code ON shared_folders(share_code);
CREATE INDEX IF NOT EXISTS idx_shared_public ON shared_folders(is_public);
CREATE INDEX IF NOT EXISTS idx_shared_country ON shared_folders(country);

CREATE TABLE IF NOT EXISTS shared_folder_files (
    id TEXT PRIMARY KEY,
    shared_folder_id TEXT NOT NULL,
    file_id TEXT,
    name TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    type TEXT,
    r2_key TEXT,
    file_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shared_folder_id) REFERENCES shared_folders(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sff_folder ON shared_folder_files(shared_folder_id);

-- ============================================================================
-- 5. EMPLOI DU TEMPS & PLANNING HORAIRE
-- ============================================================================
CREATE TABLE IF NOT EXISTS schedule_config (
    user_id TEXT PRIMARY KEY,
    days_json TEXT DEFAULT '["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"]',
    hours_json TEXT DEFAULT '["08:00 - 10:00","10:00 - 12:00","14:00 - 16:00","16:00 - 18:00"]',
    zoom_level INTEGER DEFAULT 100,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_slots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    hour_slot TEXT NOT NULL,
    subject TEXT NOT NULL,
    room TEXT,
    note_or_teacher TEXT,
    color TEXT DEFAULT '#EA580C',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_user ON schedule_slots(user_id);

-- ============================================================================
-- 6. CARNET DE NOTES, BULLETINS & MOYENNES
-- ============================================================================
CREATE TABLE IF NOT EXISTS grade_settings (
    user_id TEXT PRIMARY KEY,
    standard_scale REAL DEFAULT 20.0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS grades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    trimester INTEGER NOT NULL DEFAULT 1, -- 1, 2 ou 3
    subject_name TEXT NOT NULL,
    coefficient REAL DEFAULT 1.0,
    sub_grades_json TEXT DEFAULT '[]', -- Liste JSON des notes [{id, name, score, maxScore, coeff, type}]
    average REAL DEFAULT 0.0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_grades_user_trimester ON grades(user_id, trimester);

-- ============================================================================
-- 7. BLOC-NOTES RAPIDE (Keep Notes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    color TEXT DEFAULT '#FFFFFF',
    is_pinned INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);

-- ============================================================================
-- 8. CALENDRIER DES ÉVÉNEMENTS & RÉVISIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    all_day INTEGER DEFAULT 1,
    color TEXT DEFAULT '#EA580C',
    description TEXT,
    location TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id);

-- ============================================================================
-- 9. HORLOGE, ALARMES & MINUTEUR D'ÉTUDE
-- ============================================================================
CREATE TABLE IF NOT EXISTS alarms (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    time TEXT NOT NULL, -- ex: "06:30"
    label TEXT DEFAULT 'Réveil étude',
    is_active INTEGER DEFAULT 1,
    days_json TEXT DEFAULT '["Tous les jours"]',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alarms_user ON alarms(user_id);

CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    matiere_name TEXT,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_study_user ON study_sessions(user_id);

-- ============================================================================
-- 10. BOUTIQUE ÉTUDIANTE, SERVICES & VENTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS shop_profiles (
    user_id TEXT PRIMARY KEY,
    shop_name TEXT NOT NULL DEFAULT 'DKD Technologies',
    shop_phone TEXT DEFAULT '+225 07 00 00 00 00',
    shop_whatsapp TEXT DEFAULT '+225 07 00 00 00 00',
    shop_avatar_url TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price TEXT NOT NULL,
    category TEXT DEFAULT 'Électronique',
    image_urls_json TEXT DEFAULT '[]',
    views_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    is_boosted INTEGER DEFAULT 0,
    boost_status TEXT DEFAULT 'completed', -- 'active' | 'completed'
    boost_formula TEXT, -- 'basique' | 'pro'
    boost_views_target INTEGER DEFAULT 0,
    boost_views_current INTEGER DEFAULT 0,
    boost_end_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_boost ON products(is_boosted);

CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);

-- ============================================================================
-- 11. PUBLICATION UNIVERSITAIRE (Bibliothèque Publique)
-- ============================================================================
CREATE TABLE IF NOT EXISTS published_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    school TEXT,
    filiere TEXT,
    matiere_name TEXT, -- Matière associée (ex: 'Électrotechnique', 'Mathématiques')
    level TEXT, -- Niveau / Classe (ex: 'BTS 1', 'Licence 2', 'Master 1')
    category TEXT DEFAULT 'Cours', -- 'Cours' | 'TD' | 'TP' | 'Examen' | 'Résumé'
    author_name TEXT, -- Auteur ou nom de l'étudiant
    country TEXT DEFAULT 'Côte d''Ivoire', -- Pays de l'établissement
    info_mode TEXT DEFAULT 'all', -- 'all' | 'individual' | 'none'
    file_name TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    file_type TEXT,
    r2_key TEXT, -- Clé unique dans Cloudflare R2
    file_url TEXT, -- URL de téléchargement / consultation
    is_public INTEGER DEFAULT 1, -- 1 = Public pour tous les étudiants
    tags_json TEXT DEFAULT '[]', -- Mots-clés pour le moteur de recherche
    downloads_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_published_school ON published_documents(school, filiere);
CREATE INDEX IF NOT EXISTS idx_published_country ON published_documents(country);
CREATE INDEX IF NOT EXISTS idx_published_matiere ON published_documents(matiere_name);
CREATE INDEX IF NOT EXISTS idx_published_public ON published_documents(is_public);

-- ============================================================================
-- 12. NOTIFICATIONS & ALERTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    item_ref TEXT,
    is_unread INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- ============================================================================
-- 13. ASSISTANT IA DELMAS & HISTORIQUE DE CHAT
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    sender TEXT NOT NULL, -- 'user' | 'ai'
    message_text TEXT NOT NULL,
    attached_resource_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_user_session ON chat_messages(user_id, session_id);

-- ============================================================================
-- 14. ABONNEMENTS, FORMULES & PAIEMENTS BOOST
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_name TEXT NOT NULL DEFAULT 'free', -- 'free' | 'pro' | 'premium'
    billing_cycle TEXT DEFAULT 'monthly', -- 'monthly' | 'annual'
    status TEXT DEFAULT 'active', -- 'active' | 'expired' | 'cancelled'
    start_date TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subs_user ON user_subscriptions(user_id);

-- ============================================================================
-- 15. CONTENUS GÉNÉRÉS PAR L'IA (Résumés, Cartes Mentales, Cartes Mémoire, Quiz)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ai_generated_contents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    file_id TEXT, -- NULL si généré hors document ou document global
    tool_type TEXT NOT NULL, -- 'summary' | 'mindmap' | 'flashcards' | 'quiz' | 'infographic'
    title TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}', -- Données structurées générées
    source_file_name TEXT,
    is_pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_contents_user ON ai_generated_contents(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_contents_tool ON ai_generated_contents(user_id, tool_type);
CREATE INDEX IF NOT EXISTS idx_ai_contents_file ON ai_generated_contents(file_id);

-- ============================================================================
-- 16. DEMANDES D'AUGMENTATION DE STOCKAGE & SOUSCRIPTIONS ÉTUDIANTES
-- ============================================================================
CREATE TABLE IF NOT EXISTS storage_upgrade_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT DEFAULT '',
    user_phone TEXT DEFAULT '',
    user_email TEXT DEFAULT '',
    pack_id TEXT DEFAULT 'custom',
    pack_name TEXT DEFAULT 'Pack Stockage',
    additional_mb REAL DEFAULT 0,
    additional_words INTEGER DEFAULT 0,
    price_paid REAL DEFAULT 0,
    currency TEXT DEFAULT 'FCFA',
    payment_method TEXT DEFAULT 'Mobile Money (Wave / Orange / MTN / Moov)',
    payment_reference TEXT DEFAULT '',
    receipt_image_url TEXT DEFAULT '',
    receipt_r2_key TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    user_whatsapp TEXT DEFAULT '',
    storage_display TEXT DEFAULT '',
    price_display TEXT DEFAULT '',
    billing_cycle TEXT DEFAULT 'annual',
    notes TEXT DEFAULT '',
    admin_notes TEXT DEFAULT '',
    status TEXT DEFAULT 'pending', -- 'pending' | 'active' | 'rejected' | 'cancelled'
    confirmed_start_date TEXT DEFAULT '',
    confirmed_end_date TEXT DEFAULT '',
    grace_period_days INTEGER DEFAULT 5,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_upgrade_user ON storage_upgrade_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_status ON storage_upgrade_requests(status);

-- ============================================================================
-- 17. PROFIL D'ENTREPRISE & INFORMATIONS PROFESSIONNELLES (DKD Technologies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS company_profile (
    id TEXT PRIMARY KEY DEFAULT 'main',
    company_name TEXT DEFAULT 'DKD Technologies',
    activity TEXT DEFAULT 'Technologies & Éducation Numérique',
    location TEXT DEFAULT 'Abidjan, Côte d''Ivoire',
    address TEXT DEFAULT 'Abidjan, Côte d''Ivoire',
    phone_contact TEXT DEFAULT '+225 0101007978',
    phone_contact_secondary TEXT DEFAULT '',
    phone_whatsapp TEXT DEFAULT '+225 0101007978',
    email TEXT DEFAULT 'contact@dkd-technologies.com',
    website TEXT DEFAULT 'https://studycloud.dkd-technologies.com',
    wave_number TEXT DEFAULT '+225 07 00 00 00 00',
    wave_name TEXT DEFAULT 'StudyCloud CI',
    orange_number TEXT DEFAULT '+225 07 00 00 00 00',
    orange_name TEXT DEFAULT 'Orange Money Côte d''Ivoire',
    mtn_number TEXT DEFAULT '+225 05 00 00 00 00',
    mtn_name TEXT DEFAULT 'Paiement Mobile National',
    moov_number TEXT DEFAULT '',
    moov_name TEXT DEFAULT '',
    payment_instructions TEXT DEFAULT 'Transférez le montant exact sur l''un de nos numéros officiels ci-dessous, puis importez une capture claire de votre reçu avec la date et le numéro de transaction.',
    about_text TEXT DEFAULT 'Plateforme d''apprentissage et de gestion documentaire intelligente pour étudiants et professionnels.',
    notes TEXT DEFAULT '',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 18. GESTION DES QUOTAS DE STOCKAGE UTILISATEURS
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_storage_quotas (
    user_id TEXT PRIMARY KEY,
    welcome_total_mb REAL DEFAULT 30.0,
    welcome_r2_mb REAL DEFAULT 10.0,
    welcome_d1_mb REAL DEFAULT 20.0,
    paid_total_mb REAL DEFAULT 0.0,
    paid_r2_mb REAL DEFAULT 0.0,
    paid_d1_mb REAL DEFAULT 0.0,
    bonus_total_mb REAL DEFAULT 0.0,
    bonus_r2_mb REAL DEFAULT 0.0,
    bonus_d1_mb REAL DEFAULT 0.0,
    plan_name TEXT DEFAULT 'gratuit',
    is_unlimited INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS storage_global_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    default_welcome_total_mb REAL DEFAULT 30.0,
    default_welcome_r2_mb REAL DEFAULT 10.0,
    default_welcome_d1_mb REAL DEFAULT 20.0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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
    wave_enabled INTEGER DEFAULT 1,
    wave_show_number INTEGER DEFAULT 1,
    wave_show_image INTEGER DEFAULT 1,
    wave_image_url TEXT DEFAULT '',
    orange_number TEXT DEFAULT '+225 07 00 00 00 00',
    orange_name TEXT DEFAULT 'Orange Money Côte d''Ivoire',
    orange_enabled INTEGER DEFAULT 1,
    orange_show_number INTEGER DEFAULT 1,
    orange_show_image INTEGER DEFAULT 1,
    orange_image_url TEXT DEFAULT '',
    mtn_number TEXT DEFAULT '+225 05 00 00 00 00',
    mtn_name TEXT DEFAULT 'MTN Mobile Money CI',
    mtn_enabled INTEGER DEFAULT 1,
    mtn_show_number INTEGER DEFAULT 1,
    mtn_show_image INTEGER DEFAULT 1,
    mtn_image_url TEXT DEFAULT '',
    moov_number TEXT DEFAULT '+225 01 00 00 00 00',
    moov_name TEXT DEFAULT 'Moov Money Côte d''Ivoire',
    moov_enabled INTEGER DEFAULT 1,
    moov_show_number INTEGER DEFAULT 1,
    moov_show_image INTEGER DEFAULT 1,
    moov_image_url TEXT DEFAULT '',
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

-- ============================================================================
-- 19. CLASSEUR - DOSSIERS 3D PÉDAGOGIQUES (Positions, Tailles, Modèles 3D)
-- ============================================================================
CREATE TABLE IF NOT EXISTS classeur_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    model_id TEXT DEFAULT '1',
    primary_color TEXT DEFAULT '#EA580C',
    accent_color TEXT DEFAULT '#F97316',
    icon_name TEXT DEFAULT 'Folder',
    text_dark INTEGER DEFAULT 0,
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    zoom_level REAL DEFAULT 10,
    is_pinned INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES classeur_folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_classeur_folders_user ON classeur_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_classeur_folders_parent ON classeur_folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_classeur_folders_order ON classeur_folders(user_id, display_order);

-- ============================================================================
-- 20. CLASSEUR - FICHIERS & BLOC-NOTES INTÉGRÉS (Positions, Tailles réelles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS classeur_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size TEXT DEFAULT '0 o',
    size_bytes INTEGER DEFAULT 0,
    category TEXT DEFAULT 'documents',
    extension TEXT DEFAULT 'txt',
    source TEXT DEFAULT '',
    date_formatted TEXT DEFAULT '',
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    is_notepad INTEGER DEFAULT 0,
    notepad_title TEXT DEFAULT '',
    notepad_content TEXT DEFAULT '',
    preview_url TEXT DEFAULT '',
    r2_key TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    is_pinned INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (folder_id) REFERENCES classeur_folders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_classeur_files_user ON classeur_files(user_id);
CREATE INDEX IF NOT EXISTS idx_classeur_files_folder ON classeur_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_classeur_files_pos ON classeur_files(folder_id, position_x, position_y);

-- ============================================================================
-- 21. AUDIO / MUSIQUE (Métadonnées & Pistes Audio D1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audio_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT DEFAULT '',
    artist TEXT DEFAULT 'Artiste inconnu',
    album TEXT DEFAULT '',
    duration_sec REAL DEFAULT 0,
    size TEXT DEFAULT '0 o',
    size_bytes INTEGER DEFAULT 0,
    date_formatted TEXT DEFAULT '',
    lyrics_snippet TEXT DEFAULT '',
    full_lyrics_json TEXT DEFAULT '[]',
    cover_url TEXT DEFAULT '',
    r2_key TEXT DEFAULT '',
    audio_url TEXT DEFAULT '',
    is_favorite INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_files_user ON audio_files(user_id);

-- ============================================================================
-- 22. IMAGES / PHOTOS (Dimensions, Métadonnées D1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS image_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size TEXT DEFAULT '0 o',
    size_bytes INTEGER DEFAULT 0,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    extension TEXT DEFAULT 'jpg',
    date_formatted TEXT DEFAULT '',
    r2_key TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    thumbnail_url TEXT DEFAULT '',
    is_favorite INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_image_files_user ON image_files(user_id);

-- ============================================================================
-- 23. VIDÉOS (Durées, Résolutions, Métadonnées D1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS video_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size TEXT DEFAULT '0 o',
    size_bytes INTEGER DEFAULT 0,
    duration_sec REAL DEFAULT 0,
    resolution TEXT DEFAULT '1080p',
    extension TEXT DEFAULT 'mp4',
    date_formatted TEXT DEFAULT '',
    r2_key TEXT DEFAULT '',
    video_url TEXT DEFAULT '',
    thumbnail_url TEXT DEFAULT '',
    is_favorite INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_video_files_user ON video_files(user_id);

-- ============================================================================
-- 24. DOCUMENTS DE COURS & FASCICULES (PDF, Word, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size TEXT DEFAULT '0 o',
    size_bytes INTEGER DEFAULT 0,
    extension TEXT DEFAULT 'pdf',
    document_category TEXT DEFAULT 'COURS',
    page_count INTEGER DEFAULT 1,
    date_formatted TEXT DEFAULT '',
    source TEXT DEFAULT 'StudyCloud',
    r2_key TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    preview_url TEXT DEFAULT '',
    is_favorite INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_files_user ON document_files(user_id);

-- ============================================================================
-- 25. TÉLÉCHARGEMENTS (Historique & Fichiers D1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS download_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size TEXT DEFAULT '0 o',
    size_bytes INTEGER DEFAULT 0,
    type TEXT DEFAULT 'document',
    extension TEXT DEFAULT '',
    source_url TEXT DEFAULT '',
    source TEXT DEFAULT 'Web',
    r2_key TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_download_files_user ON download_files(user_id);

-- ============================================================================
-- 26. DOSSIER SÉCURISÉ (PIN Chiffré & Fichiers Protégés)
-- ============================================================================
CREATE TABLE IF NOT EXISTS secure_folder_config (
    user_id TEXT PRIMARY KEY,
    pin_hash TEXT NOT NULL,
    is_locked INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS secure_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size TEXT DEFAULT '0 o',
    size_bytes INTEGER DEFAULT 0,
    category TEXT DEFAULT 'documents',
    extension TEXT DEFAULT '',
    original_category TEXT DEFAULT 'documents',
    original_folder_id TEXT DEFAULT '',
    date_formatted TEXT DEFAULT '',
    metadata_json TEXT DEFAULT '{}',
    r2_key TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_secure_files_user ON secure_files(user_id);

-- ============================================================================
-- 27. CORBEILLE & FAVORIS (Restauration exacte & Marquage D1)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trash_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    size TEXT DEFAULT '0 o',
    size_bytes INTEGER DEFAULT 0,
    category TEXT DEFAULT 'documents',
    extension TEXT DEFAULT '',
    source_category TEXT DEFAULT 'documents',
    original_folder_id TEXT DEFAULT '',
    metadata_json TEXT DEFAULT '{}',
    date_formatted TEXT DEFAULT '',
    r2_key TEXT DEFAULT '',
    file_url TEXT DEFAULT '',
    deleted_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trash_files_user ON trash_files(user_id);

CREATE TABLE IF NOT EXISTS user_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_fav_unique ON user_favorites(user_id, item_id, category);

-- ============================================================================
-- 28. MONÉTISATION, CRÉDITS IA, TOKENS & RÉACTIONS (Delmas IA / StudyCloud Agent)
-- ============================================================================

-- Portefeuille individuel de crédits et compteur de tokens de chaque utilisateur
CREATE TABLE IF NOT EXISTS user_ai_credits (
    user_id TEXT PRIMARY KEY,
    credits_balance REAL DEFAULT 50.0,              -- Crédits disponibles (ex: 50 offerts à l'inscription)
    total_tokens_consumed INTEGER DEFAULT 0,         -- Cumul des tokens réels Llama consommés
    total_credits_purchased REAL DEFAULT 0.0,       -- Cumul des crédits payés
    total_credits_consumed REAL DEFAULT 0.0,        -- Cumul des crédits dépensés
    plan_tier TEXT DEFAULT 'gratuit',               -- 'gratuit' | 'etudiant' | 'pro' | 'master'
    is_blocked INTEGER DEFAULT 0,                   -- 1 = bloqué par l'admin
    last_usage_at TEXT,                             -- Dernière utilisation de l'IA
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_credits_tier ON user_ai_credits(plan_tier);

-- Demandes d'achat / recharges de crédits (Wave, Orange, MTN...) validées par l'admin
CREATE TABLE IF NOT EXISTS ai_credit_purchases (
    id TEXT PRIMARY KEY,                            -- 'aicp-xyz' ou UUID
    user_id TEXT NOT NULL,
    user_name TEXT DEFAULT '',
    user_email TEXT DEFAULT '',
    user_phone TEXT DEFAULT '',
    user_whatsapp TEXT DEFAULT '',
    pack_id TEXT NOT NULL,                          -- 'pack_100_credits', 'pack_500_credits', etc.
    pack_name TEXT NOT NULL,                        -- 'Pack Découverte 100 Crédits'
    credits_amount REAL NOT NULL,                   -- Ex: 100 crédits
    price_paid REAL NOT NULL,                       -- Ex: 1000 FCFA
    currency TEXT DEFAULT 'FCFA',
    payment_method TEXT DEFAULT 'Wave / Orange Money / MTN',
    payment_reference TEXT DEFAULT '',
    receipt_image_url TEXT DEFAULT '',              -- Capture d'écran du reçu Mobile Money
    receipt_r2_key TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',                  -- 'pending' | 'completed' | 'rejected'
    admin_notes TEXT DEFAULT '',
    approved_by TEXT DEFAULT '',
    approved_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aicp_user ON ai_credit_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_aicp_status ON ai_credit_purchases(status);
CREATE INDEX IF NOT EXISTS idx_aicp_date ON ai_credit_purchases(created_at);

-- Journal d'audit et de consommation détaillée des tokens (facturation exacte par action)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action_type TEXT NOT NULL,                      -- 'questionnaire' | 'vrai-ou-faux' | 'resume' | 'carte-mentale' | 'chat' | 'doc_analysis'
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    credits_deducted REAL DEFAULT 1.0,              -- Crédits prélevés sur le solde
    doc_name TEXT DEFAULT '',                       -- Nom du document joint analysé
    model_used TEXT DEFAULT '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_action ON ai_usage_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_logs(created_at);

-- Réactions des utilisateurs (Pouce J'aime 👍 / J'aime pas 👎) avec retour qualité
CREATE TABLE IF NOT EXISTS ai_reactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,                       -- ID du contenu (généré ou message)
    content_type TEXT DEFAULT 'creation',           -- 'creation' | 'chat_message'
    reaction TEXT NOT NULL,                         -- 'thumbs_up' | 'thumbs_down'
    comment TEXT DEFAULT '',                        -- Remarque éventuelle de l'étudiant
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_react_user ON ai_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_react_content ON ai_reactions(content_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_react_unique ON ai_reactions(user_id, content_id);



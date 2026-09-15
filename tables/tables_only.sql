CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    provider TEXT DEFAULT 'email',
    google_id TEXT UNIQUE,
    email_verified INTEGER DEFAULT 0,
    school TEXT DEFAULT '',
    filiere TEXT DEFAULT '',
    country TEXT DEFAULT 'Côte d''Ivoire',
    level TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    avatar_url TEXT,
    is_onboarded INTEGER DEFAULT 0,
    last_active_at TEXT DEFAULT CURRENT_TIMESTAMP,
    security_question_1 TEXT DEFAULT 'Quelle est votre ville de naissance ?',
    security_answer_1_hash TEXT DEFAULT '',
    security_question_2 TEXT DEFAULT 'Quel est le prénom de votre mère ?',
    security_answer_2_hash TEXT DEFAULT '',
    referral_code TEXT UNIQUE,
    referred_by TEXT DEFAULT '',
    referrals_count INTEGER DEFAULT 0,
    ad_free_days_earned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    resend_count INTEGER DEFAULT 1,
    last_sent_at TEXT NOT NULL,
    blocked_until TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    view_mode TEXT DEFAULT 'grid',
    is_dark_mode INTEGER DEFAULT 0,
    current_tab TEXT DEFAULT 'folders',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matieres (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    coefficient REAL DEFAULT 1.0,
    color TEXT DEFAULT '#EA580C',
    category TEXT DEFAULT 'Général',
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    matiere_id TEXT,
    name TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    type TEXT NOT NULL,
    extension TEXT,
    r2_key TEXT,
    file_url TEXT,
    is_favorite INTEGER DEFAULT 0,
    is_imported INTEGER DEFAULT 0,
    is_study_session INTEGER DEFAULT 0,
    last_imported INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    share_code TEXT UNIQUE,
    share_url TEXT,
    qr_code_data TEXT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'Cours',
    author_name TEXT,
    school TEXT,
    country TEXT DEFAULT 'Côte d''Ivoire',
    is_public INTEGER DEFAULT 1,
    is_password_protected INTEGER DEFAULT 0,
    password_hash TEXT,
    allow_download INTEGER DEFAULT 1,
    total_size INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_folder_files (
    id TEXT PRIMARY KEY,
    shared_folder_id TEXT NOT NULL,
    file_id TEXT,
    name TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    type TEXT,
    r2_key TEXT,
    file_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule_config (
    user_id TEXT PRIMARY KEY,
    days_json TEXT DEFAULT '["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"]',
    hours_json TEXT DEFAULT '["08:00 - 10:00","10:00 - 12:00","14:00 - 16:00","16:00 - 18:00"]',
    zoom_level INTEGER DEFAULT 100,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grade_settings (
    user_id TEXT PRIMARY KEY,
    standard_scale REAL DEFAULT 20.0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS grades (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    trimester INTEGER NOT NULL DEFAULT 1,
    subject_name TEXT NOT NULL,
    coefficient REAL DEFAULT 1.0,
    sub_grades_json TEXT DEFAULT '[]',
    average REAL DEFAULT 0.0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    color TEXT DEFAULT '#FFFFFF',
    is_pinned INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alarms (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    time TEXT NOT NULL,
    label TEXT DEFAULT 'Réveil étude',
    is_active INTEGER DEFAULT 1,
    days_json TEXT DEFAULT '["Tous les jours"]',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    matiere_name TEXT,
    completed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_profiles (
    user_id TEXT PRIMARY KEY,
    shop_name TEXT NOT NULL DEFAULT 'DKD Technologies',
    shop_phone TEXT DEFAULT '+225 07 00 00 00 00',
    shop_whatsapp TEXT DEFAULT '+225 07 00 00 00 00',
    shop_avatar_url TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
    boost_status TEXT DEFAULT 'completed',
    boost_formula TEXT,
    boost_views_target INTEGER DEFAULT 0,
    boost_views_current INTEGER DEFAULT 0,
    boost_end_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS published_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    school TEXT,
    filiere TEXT,
    matiere_name TEXT,
    level TEXT,
    category TEXT DEFAULT 'Cours',
    author_name TEXT,
    country TEXT DEFAULT 'Côte d''Ivoire',
    info_mode TEXT DEFAULT 'all',
    file_name TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    file_type TEXT,
    r2_key TEXT,
    file_url TEXT,
    is_public INTEGER DEFAULT 1,
    tags_json TEXT DEFAULT '[]',
    downloads_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_document_interactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    interaction_type TEXT DEFAULT 'view',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    item_ref TEXT,
    is_unread INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    message_text TEXT NOT NULL,
    attached_resource_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_name TEXT NOT NULL DEFAULT 'free',
    billing_cycle TEXT DEFAULT 'monthly',
    status TEXT DEFAULT 'active',
    start_date TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_generated_contents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    file_id TEXT,
    tool_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}',
    source_file_name TEXT,
    is_pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL,
    referred_user_id TEXT NOT NULL UNIQUE,
    referred_user_name TEXT,
    referred_user_email TEXT,
    reward_days INTEGER DEFAULT 5,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);

CREATE TABLE IF NOT EXISTS referral_rewards_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    days_per_referral INTEGER DEFAULT 5,
    milestones_json TEXT,
    rules_text_json TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

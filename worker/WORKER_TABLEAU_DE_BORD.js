// ============================================================================
// STUDYCLOUD - WORKER TABLEAU DE BORD (DASHBOARD ANALYTICS & STOCKAGE R2 / D1)
// ============================================================================
// Version 3.0 :
// - Élimination de l'espace vide sous le header (menus gauche et droite fixes, conteneurs pleine hauteur).
// - Tables D1 créées automatiquement (user_storage_quotas, storage_global_config).
// - Stockage de Bienvenue (R2: 10 Mo + D1: 20 Mo = 30 Mo) et Stockage Payant (0 Mo si non payé).
// - Paramètres globaux en haut pour configurer le stockage de bienvenue de tous les futurs utilisateurs.
// - Affichage du numéro de téléphone, de la fonction (étudiant/autre), école et filière.
// - Formulaire interactif pour modifier le stockage de bienvenue et payant de chaque utilisateur avec sauvegarde D1 en temps réel.
// ============================================================================

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 Octets';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

function getStorageBindings(env = {}) {
  if (!env) return { db: null, bucket: null };
  const db = env.MON_D1_STUDYCLOUD || env['MON_D1-STUDYCLOUD'] || env.DB || env.d1 || env.DATABASE || env.DATABASE_D1 || null;
  const bucket = env.MON_R2_STUDYCLOUD || env['MON_R2-STUDYCLOUD'] || env.BUCKET || env.r2 || env.STORAGE || env.STORAGE_R2 || null;
  return { db, bucket };
}

async function safeQuery(db, sql, params = [], defaultValue = null) {
  if (!db) return defaultValue;
  try {
    const stmt = db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    return await bound.all();
  } catch (err) {
    return defaultValue;
  }
}

async function safeFirst(db, sql, params = [], defaultValue = null) {
  if (!db) return defaultValue;
  try {
    const stmt = db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const res = await bound.first();
    return (res !== null && res !== undefined) ? res : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}

async function safeRun(db, sql, params = []) {
  if (!db) return null;
  try {
    const stmt = db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    return await bound.run();
  } catch (err) {
    return null;
  }
}

/**
 * Initialise automatiquement les tables nécessaires aux quotas et paramètres globaux
 */
let _tablesEnsured = false;
async function ensureStorageTables(db) {
  if (!db || _tablesEnsured) return;
  _tablesEnsured = true;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS storage_global_config (
        id TEXT PRIMARY KEY DEFAULT 'default',
        default_welcome_total_mb REAL DEFAULT 30.0,
        default_welcome_r2_mb REAL DEFAULT 10.0,
        default_welcome_d1_mb REAL DEFAULT 20.0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    try { await db.prepare("ALTER TABLE storage_global_config ADD COLUMN default_welcome_total_mb REAL DEFAULT 30.0").run(); } catch (e) {}

    await db.prepare(`
      INSERT OR IGNORE INTO storage_global_config (id, default_welcome_total_mb, default_welcome_r2_mb, default_welcome_d1_mb)
      VALUES ('default', 30.0, 10.0, 20.0)
    `).run();

    await db.prepare(`
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
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    try { await db.prepare("ALTER TABLE user_storage_quotas ADD COLUMN welcome_total_mb REAL DEFAULT 30.0").run(); } catch (e) {}
    try { await db.prepare("ALTER TABLE user_storage_quotas ADD COLUMN paid_total_mb REAL DEFAULT 0.0").run(); } catch (e) {}
    try { await db.prepare("ALTER TABLE user_storage_quotas ADD COLUMN bonus_total_mb REAL DEFAULT 0.0").run(); } catch (e) {}

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_word_counts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        word_count INTEGER DEFAULT 0,
        token_count INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_ai_credits (
        user_id TEXT PRIMARY KEY,
        total_credits REAL DEFAULT 0,
        remaining_credits REAL DEFAULT 0,
        used_credits REAL DEFAULT 0,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 1. Colonnes indispensables sur 'users' (garantit qu'aucun SELECT ne plantera)
    const userAlterCols = [
      "ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''",
      "ALTER TABLE users ADD COLUMN level TEXT DEFAULT 'Étudiant'",
      "ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''",
      "ALTER TABLE users ADD COLUMN school TEXT DEFAULT ''",
      "ALTER TABLE users ADD COLUMN filiere TEXT DEFAULT ''",
      "ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'Côte d''Ivoire'",
      "ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT ''",
      "ALTER TABLE users ADD COLUMN last_active_at TEXT DEFAULT CURRENT_TIMESTAMP"
    ];
    for (const sql of userAlterCols) {
      try { await db.prepare(sql).run(); } catch (e) {}
    }

    // 2. Table 'shop_profiles' pour les boutiques et services
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS shop_profiles (
        user_id TEXT PRIMARY KEY,
        shop_name TEXT NOT NULL,
        shop_phone TEXT DEFAULT '',
        shop_whatsapp TEXT DEFAULT '',
        shop_avatar_url TEXT DEFAULT '',
        shop_category TEXT DEFAULT 'Vente digital (PDF)',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    try { await db.prepare("ALTER TABLE shop_profiles ADD COLUMN shop_category TEXT DEFAULT 'Vente digital (PDF)'").run(); } catch (e) {}
    try { await db.prepare("ALTER TABLE shop_profiles ADD COLUMN shop_phone TEXT DEFAULT ''").run(); } catch (e) {}
    try { await db.prepare("ALTER TABLE shop_profiles ADD COLUMN shop_whatsapp TEXT DEFAULT ''").run(); } catch (e) {}

    // 3. Table 'auth_sessions' pour la présence en ligne
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 4. Table 'storage_upgrade_requests' pour les demandes d'augmentation de stockage
    await db.prepare(`
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
        payment_method TEXT DEFAULT 'Wave / Orange / Moov / MTN',
        payment_reference TEXT DEFAULT '',
        receipt_image_url TEXT DEFAULT '',
        receipt_r2_key TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        admin_notes TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const upgradeReqCols = [
      "ALTER TABLE storage_upgrade_requests ADD COLUMN user_name TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN user_phone TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN user_email TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN price_paid REAL DEFAULT 0",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN currency TEXT DEFAULT 'FCFA'",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN payment_method TEXT DEFAULT 'Wave / Orange / Moov / MTN'",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN payment_reference TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN receipt_image_url TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN receipt_r2_key TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN status TEXT DEFAULT 'pending'",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN admin_notes TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN confirmed_start_date TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN confirmed_end_date TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN grace_period_days INTEGER DEFAULT 5",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN contact_phone TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN user_whatsapp TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN storage_display TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN price_display TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN billing_cycle TEXT DEFAULT 'annual'",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN user_deleted_at TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN purge_scheduled_at TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN request_type TEXT DEFAULT 'upgrade'",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN credits_amount REAL DEFAULT 0",
      "ALTER TABLE user_purchases_history ADD COLUMN credits_amount REAL DEFAULT 0",
      "ALTER TABLE user_purchases_history ADD COLUMN additional_words INTEGER DEFAULT 0"
    ];
    for (const sql of upgradeReqCols) {
      try { await db.prepare(sql).run(); } catch (e) {}
    }

    // 4 bis. Table 'company_profile' pour les informations professionnelles & comptes marchands
    await db.prepare(`
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
      )
    `).run();

    await db.prepare(`
      INSERT OR IGNORE INTO company_profile (id, company_name, activity, location, address, phone_contact, phone_whatsapp, email, website, wave_number, wave_name, orange_number, orange_name, mtn_number, mtn_name, moov_number, moov_name, payment_instructions, about_text)
      VALUES ('main', 'DKD Technologies', 'Technologies & Éducation Numérique', 'Abidjan, Côte d''Ivoire', 'Abidjan, Côte d''Ivoire', '+225 0101007978', '+225 0101007978', 'contact@dkd-technologies.com', 'https://studycloud.dkd-technologies.com', '+225 07 00 00 00 00', 'StudyCloud CI', '+225 07 00 00 00 00', 'Orange Money Côte d''Ivoire', '+225 05 00 00 00 00', 'MTN Mobile Money CI', '+225 01 00 00 00 00', 'Moov Money Côte d''Ivoire', 'Transférez le montant exact sur l''un de nos numéros officiels ci-dessous, puis importez une capture claire de votre reçu avec la date et le numéro de transaction.', 'Plateforme d''apprentissage et de gestion documentaire intelligente pour étudiants et professionnels.')
    `).run();

    const companyProfileCols = [
      "ALTER TABLE company_profile ADD COLUMN company_name TEXT DEFAULT 'DKD Technologies'",
      "ALTER TABLE company_profile ADD COLUMN activity TEXT DEFAULT 'Technologies & Éducation Numérique'",
      "ALTER TABLE company_profile ADD COLUMN location TEXT DEFAULT 'Abidjan, Côte d''Ivoire'",
      "ALTER TABLE company_profile ADD COLUMN address TEXT DEFAULT 'Abidjan, Côte d''Ivoire'",
      "ALTER TABLE company_profile ADD COLUMN phone_contact TEXT DEFAULT '+225 0101007978'",
      "ALTER TABLE company_profile ADD COLUMN phone_contact_secondary TEXT DEFAULT ''",
      "ALTER TABLE company_profile ADD COLUMN phone_whatsapp TEXT DEFAULT '+225 0101007978'",
      "ALTER TABLE company_profile ADD COLUMN email TEXT DEFAULT 'contact@dkd-technologies.com'",
      "ALTER TABLE company_profile ADD COLUMN website TEXT DEFAULT 'https://studycloud.dkd-technologies.com'",
      "ALTER TABLE company_profile ADD COLUMN wave_number TEXT DEFAULT '+225 07 00 00 00 00'",
      "ALTER TABLE company_profile ADD COLUMN wave_name TEXT DEFAULT 'StudyCloud CI'",
      "ALTER TABLE company_profile ADD COLUMN wave_enabled INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN wave_show_number INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN wave_show_image INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN wave_image_url TEXT DEFAULT ''",
      "ALTER TABLE company_profile ADD COLUMN orange_number TEXT DEFAULT '+225 07 00 00 00 00'",
      "ALTER TABLE company_profile ADD COLUMN orange_name TEXT DEFAULT 'Orange Money Côte d''Ivoire'",
      "ALTER TABLE company_profile ADD COLUMN orange_enabled INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN orange_show_number INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN orange_show_image INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN orange_image_url TEXT DEFAULT ''",
      "ALTER TABLE company_profile ADD COLUMN mtn_number TEXT DEFAULT '+225 05 00 00 00 00'",
      "ALTER TABLE company_profile ADD COLUMN mtn_name TEXT DEFAULT 'MTN Mobile Money CI'",
      "ALTER TABLE company_profile ADD COLUMN mtn_enabled INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN mtn_show_number INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN mtn_show_image INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN mtn_image_url TEXT DEFAULT ''",
      "ALTER TABLE company_profile ADD COLUMN moov_number TEXT DEFAULT '+225 01 00 00 00 00'",
      "ALTER TABLE company_profile ADD COLUMN moov_name TEXT DEFAULT 'Moov Money Côte d''Ivoire'",
      "ALTER TABLE company_profile ADD COLUMN moov_enabled INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN moov_show_number INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN moov_show_image INTEGER DEFAULT 1",
      "ALTER TABLE company_profile ADD COLUMN moov_image_url TEXT DEFAULT ''",
      "ALTER TABLE company_profile ADD COLUMN payment_instructions TEXT DEFAULT ''",
      "ALTER TABLE company_profile ADD COLUMN about_text TEXT DEFAULT ''",
      "ALTER TABLE company_profile ADD COLUMN notes TEXT DEFAULT ''",
      "ALTER TABLE company_profile ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"
    ];
    for (const sql of companyProfileCols) {
      try { await db.prepare(sql).run(); } catch (e) {}
    }

    try {
      await db.prepare(`
        UPDATE company_profile 
        SET mtn_name = 'MTN Mobile Money CI' 
        WHERE id = 'main' AND (mtn_name = 'Paiement Mobile National' OR mtn_name LIKE '%Moov%' OR mtn_name IS NULL OR mtn_name = '')
      `).run();
      await db.prepare(`
        UPDATE company_profile 
        SET moov_number = '+225 01 00 00 00 00' 
        WHERE id = 'main' AND (moov_number IS NULL OR moov_number = '')
      `).run();
      await db.prepare(`
        UPDATE company_profile 
        SET moov_name = 'Moov Money Côte d''Ivoire' 
        WHERE id = 'main' AND (moov_name IS NULL OR moov_name = '')
      `).run();
    } catch (e) {}

    // 5. Table 'user_subscriptions' pour les abonnements actifs, résiliés et annulés
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT DEFAULT '',
        user_phone TEXT DEFAULT '',
        user_email TEXT DEFAULT '',
        plan_name TEXT DEFAULT 'Standard',
        total_storage_mb REAL DEFAULT 1024,
        monthly_price REAL DEFAULT 0,
        currency TEXT DEFAULT 'FCFA',
        status TEXT DEFAULT 'active',
        start_date TEXT DEFAULT CURRENT_TIMESTAMP,
        end_date TEXT DEFAULT '',
        cancelled_at TEXT DEFAULT '',
        previous_storage_mb REAL DEFAULT 0,
        cancel_reason TEXT DEFAULT '',
        request_id TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const subCols = [
      "ALTER TABLE user_subscriptions ADD COLUMN user_name TEXT DEFAULT ''",
      "ALTER TABLE user_subscriptions ADD COLUMN user_phone TEXT DEFAULT ''",
      "ALTER TABLE user_subscriptions ADD COLUMN user_email TEXT DEFAULT ''",
      "ALTER TABLE user_subscriptions ADD COLUMN plan_name TEXT DEFAULT 'Standard'",
      "ALTER TABLE user_subscriptions ADD COLUMN total_storage_mb REAL DEFAULT 1024",
      "ALTER TABLE user_subscriptions ADD COLUMN monthly_price REAL DEFAULT 0",
      "ALTER TABLE user_subscriptions ADD COLUMN currency TEXT DEFAULT 'FCFA'",
      "ALTER TABLE user_subscriptions ADD COLUMN status TEXT DEFAULT 'active'",
      "ALTER TABLE user_subscriptions ADD COLUMN start_date TEXT DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE user_subscriptions ADD COLUMN end_date TEXT DEFAULT ''",
      "ALTER TABLE user_subscriptions ADD COLUMN cancelled_at TEXT DEFAULT ''",
      "ALTER TABLE user_subscriptions ADD COLUMN previous_storage_mb REAL DEFAULT 0",
      "ALTER TABLE user_subscriptions ADD COLUMN cancel_reason TEXT DEFAULT ''",
      "ALTER TABLE user_subscriptions ADD COLUMN request_id TEXT DEFAULT ''",
      "ALTER TABLE user_subscriptions ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE user_subscriptions ADD COLUMN grace_period_days INTEGER DEFAULT 5",
      "ALTER TABLE user_subscriptions ADD COLUMN payment_due_date TEXT DEFAULT ''",
      "ALTER TABLE user_subscriptions ADD COLUMN is_blocked INTEGER DEFAULT 0"
    ];
    for (const sql of subCols) {
      try { await db.prepare(sql).run(); } catch (e) {}
    }

    // 6. Table 'user_purchases_history' pour l'historique complet des achats et paiements des utilisateurs
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_purchases_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT DEFAULT '',
        user_email TEXT DEFAULT '',
        user_phone TEXT DEFAULT '',
        pack_name TEXT NOT NULL,
        storage_bought_mb REAL DEFAULT 0,
        total_storage_mb REAL DEFAULT 30,
        price_paid REAL DEFAULT 0,
        currency TEXT DEFAULT 'FCFA',
        payment_method TEXT DEFAULT 'Mobile Money',
        payment_reference TEXT DEFAULT '',
        billing_cycle TEXT DEFAULT 'monthly',
        renewal_date TEXT DEFAULT '',
        status TEXT DEFAULT 'confirmed',
        purchased_at TEXT DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        user_deleted_at TEXT DEFAULT '',
        purge_scheduled_at TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 7. Table 'storage_subscription_plans' pour les cartes de paiement / forfaits de stockage
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS storage_subscription_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        badge TEXT DEFAULT '',
        description TEXT DEFAULT '',
        storage_amount TEXT NOT NULL,
        storage_mb REAL DEFAULT 0,
        price REAL NOT NULL,
        primary_currency TEXT DEFAULT 'USD',
        currencies_enabled TEXT DEFAULT '["USD","XOF","EUR"]',
        currency_conversions TEXT DEFAULT '{}',
        yearly_price REAL DEFAULT 0,
        yearly_discount_pct REAL DEFAULT 10,
        features TEXT DEFAULT '[]',
        is_auto_billing INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 8. Table 'ai_subscription_plans' pour les cartes d'abonnement de l'assistante StudyCloud
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS ai_subscription_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        badge TEXT DEFAULT '',
        description TEXT DEFAULT '',
        credits_or_words TEXT NOT NULL,
        credits_count REAL DEFAULT 0,
        price REAL NOT NULL,
        primary_currency TEXT DEFAULT 'USD',
        currencies_enabled TEXT DEFAULT '["USD","XOF","EUR"]',
        currency_conversions TEXT DEFAULT '{}',
        yearly_price REAL DEFAULT 0,
        yearly_discount_pct REAL DEFAULT 10,
        features TEXT DEFAULT '[]',
        is_auto_billing INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        pricing_model TEXT DEFAULT 'subscription',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Migration pour pricing_model si table existante
    try {
      await db.prepare("ALTER TABLE ai_subscription_plans ADD COLUMN pricing_model TEXT DEFAULT 'subscription'").run();
    } catch (e) {}

    // Nettoyer uniquement les anciens faux plans de démonstration codés en dur
    try {
      await db.prepare("DELETE FROM storage_subscription_plans WHERE id IN ('storage_plan_basique', 'storage_plan_pro', 'storage_plan_entreprise')").run();
      await db.prepare("DELETE FROM ai_subscription_plans WHERE id IN ('ai_plan_basique', 'ai_plan_pro', 'ai_plan_master')").run();
    } catch (e) {}
  } catch (e) {
    console.warn('[Storage Tables Init]', e);
  }
}

/**
 * Dictionnaire de TOUTES les tables Cloudflare D1 avec leur rôle, connexion UI et exemple
 */
const TABLES_METADATA = [
  {
    table: 'files',
    label: 'Fichiers personnels & Sessions IA',
    uiConnection: "Écran d'accueil > Mes fichiers, Menu latéral gauche > Mes fichiers & Matières, Espace d'étude IA",
    role: "Stocke les métadonnées de chaque document déposé par l'étudiant (PDF, Word, photos d'exercices, polycopiés). Fait le lien direct avec le fichier physique hébergé dans Cloudflare R2.",
    usage: "Écriture lors du téléversement d'un document. Lecture à l'ouverture de 'Mes fichiers', d'une matière ou lors du démarrage d'une session IA.",
    example: "{ id: 'file_1728...', user_id: 'user_abc', matiere_id: 'Mathématiques', name: 'Cours_Matrices.pdf', size: 2458120, type: 'application/pdf', r2_key: 'user-files/user_abc/...' }"
  },
  {
    table: 'notes',
    label: 'Bloc-notes & Mémos rapides',
    uiConnection: "Écran d'accueil > Bloc-notes",
    role: "Enregistre toutes les fiches de révision, pense-bêtes et notes personnelles créées par l'étudiant, avec leurs couleurs personnalisées et images éventuelles.",
    usage: "Sauvegarde automatique à chaque frappe dans le bloc-notes, synchronisation continue vers le Cloud.",
    example: "{ id: 'note_123', user_id: 'user_abc', title: 'Formules Trigonométrie', content: 'cos²(x) + sin²(x) = 1...', color: '#1E293B', is_pinned: 1 }"
  },
  {
    table: 'matieres',
    label: 'Matières & Disciplines de cours',
    uiConnection: "Menu latéral gauche > Liste des matières, Écran d'accueil > Mes fichiers (dossiers de matières)",
    role: "Définit les matières créées par l'étudiant (Maths, Physique, Électronique...), leurs coefficients pour le calcul de moyenne et leur couleur distinctive.",
    usage: "Lue au chargement de l'application pour afficher les dossiers de matières dans le menu gauche et sur l'accueil. Modifiée lors de l'ajout/suppression d'une matière.",
    example: "{ id: 'mat_45', user_id: 'user_abc', name: 'Électronique de puissance', coefficient: 3, color: '#EA580C' }"
  },
  {
    table: 'ai_generated_contents',
    label: 'Contenus d\'étude générés par l\'IA',
    uiConnection: "Menu latéral droit > Onglet Créations IA (Questionnaires, QCM, Résumés, Cartes mentales, Devoirs)",
    role: "Stocke au format JSON tous les exercices et modules d'apprentissage créés par l'intelligence artificielle Gemini à partir des polycopiés de cours.",
    usage: "Écriture quand l'élève clique sur 'Générer un QCM' ou 'Créer une fiche de révision'. Lecture lors de l'ouverture du questionnaire ou de la carte mentale.",
    example: "{ id: 'ai_987', tool_type: 'questionnaire', title: 'QCM Amplificateur Opérationnel', content_json: '{\"questions\": [...]}' }"
  },
  {
    table: 'user_ai_workspace',
    label: 'Espace de travail et brouillons IA',
    uiConnection: "Espace d'étude IA > Panneau d'interaction Delmas Robot",
    role: "Conserve l'historique complet des prompts, des réponses pédagogiques, des notes de l'élève et des documents joints en session d'étude.",
    usage: "Mis à jour à chaque question posée au robot tuteur pendant l'étude d'un document.",
    example: "{ id: 'ws_01', session_id: 'sess_99', role: 'assistant', message_text: 'Le théorème de Thévenin permet de simplifier...', attached_file_name: 'TP1.pdf' }"
  },
  {
    table: 'conversations',
    label: 'Fils de discussion avec l\'assistant IA',
    uiConnection: "Bouton DELMAS IA (en haut à droite) > Chat Assistant",
    role: "Enregistre chaque fil de discussion thématique ouvert par l'utilisateur avec l'assistant virtuel StudyCloud.",
    usage: "Créé au lancement d'un nouveau chat, lu pour afficher l'historique des conversations passées.",
    example: "{ id: 'conv_77', user_id: 'user_abc', title: 'Explication montage inverseur' }"
  },
  {
    table: 'messages',
    label: 'Messages échangés dans le chat IA',
    uiConnection: "Bouton DELMAS IA > Fenêtre de messagerie",
    role: "Contient chaque message individuel (utilisateur ou IA) avec ses formules LaTeX et ses métadonnées.",
    usage: "Enregistré en temps réel à chaque échange dans le chat d'assistance.",
    example: "{ id: 'msg_10', conversation_id: 'conv_77', role: 'user', content: 'Comment calculer la fréquence de coupure ?' }",
    isExempted: true,
    exemptReason: "Messages reçus & chat d'assistance : table générale (non décomptée du quota personnel)"
  },
  {
    table: 'ai_creations',
    label: 'Modules interactifs de cours IA',
    uiConnection: "Menu Créations IA > Modules d'auto-évaluation et fiches mémoires",
    role: "Enregistre les devoirs types, examens chronométrés et cartes mémoires générés par l'IA.",
    usage: "Consulté lors de la réalisation d'un devoir d'entraînement en ligne.",
    example: "{ id: 'crea_55', type: 'devoir-complet', title: 'Examen partiel Automatique', content: '{...}' }"
  },
  {
    table: 'ai_tasks',
    label: 'Tâches d\'arrière-plan IA',
    uiConnection: "Notifications & Indicateurs de chargement IA",
    role: "Suit l'état d'avancement des générations IA complexes (en cours, terminé, erreur).",
    usage: "Écrit lors du lancement d'une analyse de long document, mis à jour à la fin.",
    example: "{ id: 'task_02', task_type: 'synthese-cours', status: 'completed' }"
  },
  {
    table: 'user_certificates',
    label: 'Certificats & Diplômes de réussite',
    uiConnection: "Profil étudiant > Mes certifications d'évaluation",
    role: "Génère et authentifie les certificats de réussite aux examens et questionnaires passés sur StudyCloud avec un code unique de validation.",
    usage: "Créé quand un étudiant obtient une note supérieure au seuil (ex: >= 16/20) lors d'un test.",
    example: "{ id: 'cert_1', certificate_code: 'SC-2026-9812', topic: 'Électronique Linéaire', score: 18.5, max_score: 20 }"
  },
  {
    table: 'schedule_slots',
    label: 'Créneaux de l\'emploi du temps',
    uiConnection: "Écran d'accueil > Mon emploi du temps",
    role: "Définit les cours, salles, professeurs et couleurs par jour de la semaine et tranche horaire.",
    usage: "Modifié quand l'élève édite son planning hebdomadaire. Synchronisé en continu.",
    example: "{ id: 'slot_1', day: 'Lundi', hour_slot: '08h00', subject: 'Mathématiques', room: 'Amphi B', color: '#10B981' }"
  },
  {
    table: 'schedule_config',
    label: 'Configuration de l\'emploi du temps',
    uiConnection: "Écran d'accueil > Mon emploi du temps (Boutons zoom & colonnes)",
    role: "Enregistre les jours actifs (Lundi-Samedi), la liste des heures et le niveau de zoom du tableau.",
    usage: "Lue à l'ouverture du planning pour restituer l'agencement exact choisi par l'utilisateur.",
    example: "{ user_id: 'user_abc', zoom_level: 100, days_json: '[\"Lundi\",\"Mardi\"...]' }"
  },
  {
    table: 'grades',
    label: 'Notes d\'évaluation & Moyennes',
    uiConnection: "Écran d'accueil > Mes notes d'évaluation",
    role: "Enregistre les notes obtenues par matière, les coefficients, les devoirs/examens et calcule la moyenne générale.",
    usage: "Mis à jour à l'ajout d'une note de devoir ou d'interrogation écrite.",
    example: "{ id: 'grd_8', trimester: 1, subject_name: 'Physique', coefficient: 2, average: 15.2, sub_grades_json: '[{\"note\":14,\"coef\":1}]' }"
  },
  {
    table: 'grade_settings',
    label: 'Barème et paramètres des notes',
    uiConnection: "Écran d'accueil > Mes notes d'évaluation > Paramètres",
    role: "Définit l'échelle de notation (sur 20, sur 100 ou GPA).",
    usage: "Lue pour adapter les calculs de moyenne au système éducatif de l'étudiant.",
    example: "{ user_id: 'user_abc', standard_scale: 20.0 }"
  },
  {
    table: 'calendar_events',
    label: 'Événements du calendrier & Agenda',
    uiConnection: "Écran d'accueil > Calendrier",
    role: "Enregistre les dates d'examens, rendus de devoirs, révisions et événements scolaires.",
    usage: "Affiché dans la vue calendrier mensuelle et journalière.",
    example: "{ id: 'ev_12', title: 'Partiel d\'Électronique', start_date: '2026-10-15', color: '#EF4444' }"
  },
  {
    table: 'alarms',
    label: 'Alarmes & Réveils d\'étude',
    uiConnection: "Écran d'accueil > Horloge",
    role: "Planifie des réveils et rappels d'étude programmés pour rythmer les sessions de travail.",
    usage: "Déclenche les alertes sonores et visuelles de l'application.",
    example: "{ id: 'al_3', time: '06:30', label: 'Réveil révision Maths', is_active: 1 }"
  },
  {
    table: 'study_sessions',
    label: 'Sessions d\'étude chronométrées',
    uiConnection: "Espace d'étude > Chronomètre & Mode focus",
    role: "Comptabilise le temps total passé à réviser par matière pour alimenter les graphiques de progression (Évolution & Stats).",
    usage: "Incrémenté à la fin d'une session de travail concentré.",
    example: "{ id: 'ss_44', duration_seconds: 3600, matiere_name: 'Informatique' }"
  },
  {
    table: 'published_documents',
    label: 'Documents publiés dans la bibliothèque (Menu Ressources)',
    uiConnection: "Bibliothèque partagée StudyCloud (Menu Ressources)",
    role: "Gère les cours et résumés rendus publics par les étudiants pour toute la communauté.",
    usage: "Alimente le moteur de recherche de la bibliothèque publique.",
    example: "{ id: 'pub_90', title: 'Fiche Synthèse AOP', file_size: 1450000, downloads_count: 142, views_count: 850 }",
    isExempted: true,
    exemptReason: "Fichiers publiés comme ressource pour tout le monde : bibliothèque publique (non compté ni pénalisé)"
  },
  {
    table: 'user_document_interactions',
    label: 'Interactions et nombre de vues des fichiers',
    uiConnection: "Bibliothèque partagée > Vues et consultations",
    role: "Enregistre l'historique et les compteurs de vues sur les documents.",
    usage: "Écrit à chaque consultation d'un cours public.",
    example: "{ id: 'int_1', user_id: 'user_abc', document_id: 'pub_90', interaction_type: 'view' }",
    isExempted: true,
    exemptReason: "Nombre de vues des fichiers : consultation publique (non décompté du quota personnel)"
  },
  {
    table: 'published_document_downloads',
    label: 'Nombre de téléchargements (Fichiers & Liens)',
    uiConnection: "Bibliothèque partagée & Liens partagés > Téléchargements",
    role: "Traçabilité des téléchargements effectués sur les cours publiés et liens de partage.",
    usage: "Incrémenté à chaque téléchargement de fichier.",
    example: "{ id: 'dl_2', user_id: 'user_abc', document_id: 'pub_90' }",
    isExempted: true,
    exemptReason: "Nombre de téléchargements (fichiers et liens) : traçabilité (non décompté du quota personnel)"
  },
  {
    table: 'user_word_counts',
    label: "Compteurs de mots de chaque utilisateur",
    uiConnection: "Espace d'étude IA > Suivi de consommation de mots",
    role: "Table technique qui enregistre le nombre total de mots et de jetons rédigés ou générés par chaque utilisateur.",
    usage: "Mis à jour à chaque génération de synthèse ou échange IA.",
    example: "{ id: 'wc_1', user_id: 'user_abc', word_count: 12450, token_count: 15800 }",
    isExempted: true,
    exemptReason: "Table pour stocker les nombres de mots : compteur technique (non décompté du quota personnel)"
  },
  {
    table: 'shared_folders',
    label: 'Dossiers de partage par lien & QR code',
    uiConnection: "Bouton Partager > Créer un lien de partage sécurisé",
    role: "Permet aux étudiants de générer un lien public ou protégé par mot de passe pour envoyer des cours à leurs camarades.",
    usage: "Consulté lors de l'accès au lien public `studycloud.../share/...`",
    example: "{ id: 'sf_5', share_code: 'sc_a8f9...', title: 'Dossier Révisions Semestre 1', total_size: 15400000 }"
  },
  {
    table: 'shared_folder_files',
    label: 'Fichiers des dossiers de partage',
    uiConnection: "Portail de téléchargement des liens partagés",
    role: "Associe chaque fichier d'un lien partagé à sa clé de stockage Cloudflare R2 dédiée (`shared-links/files/`).",
    usage: "Lue pour afficher la liste des fichiers téléchargeables sur la page de partage.",
    example: "{ id: 'sff_1', shared_folder_id: 'sf_5', name: 'TD1_Corrige.pdf', size: 3200000 }"
  },
  {
    table: 'shop_profiles',
    label: 'Profils des boutiques DKD',
    uiConnection: "Boutique StudyCloud > Profil Vendeur",
    role: "Enregistre le nom commercial, le contact WhatsApp et les coordonnées des vendeurs certifiés sur la plateforme.",
    usage: "Affiché sur la page d'accueil de la boutique et les fiches produits.",
    example: "{ user_id: 'user_abc', shop_name: 'DKD Technologies', shop_whatsapp: '+225 07...' }"
  },
  {
    table: 'products',
    label: 'Produits et articles de la boutique',
    uiConnection: "Boutique StudyCloud > Catalogue des produits",
    role: "Catalogue des calculatrices, livres, composants électroniques et fournitures scolaires mis en vente.",
    usage: "Affiché dans le carrousel boutique, modifié lors de l'ajout d'un nouvel article.",
    example: "{ id: 'prd_10', title: 'Calculatrice Casio Graph 35+', price: '25 000 FCFA', image_urls_json: '[...]' }"
  },
  {
    table: 'cart_items',
    label: 'Paniers d\'achat des étudiants',
    uiConnection: "Boutique StudyCloud > Panier de commande",
    role: "Garde en mémoire les articles sélectionnés par l'utilisateur avant la validation de sa commande.",
    usage: "Mis à jour à chaque ajout ou retrait d'article du panier.",
    example: "{ id: 'cart_1', user_id: 'user_abc', product_id: 'prd_10', quantity: 1 }"
  },
  {
    table: 'seller_follows',
    label: 'Abonnements aux boutiques',
    uiConnection: "Boutique StudyCloud > Bouton S'abonner au vendeur",
    role: "Gère les abonnements des étudiants à leurs vendeurs préférés pour recevoir des notifications de nouveaux articles.",
    usage: "Incrémenté quand un client s'abonne à une boutique.",
    example: "{ user_id: 'user_abc', seller_id: 'seller_xyz' }"
  },
  {
    table: 'notifications',
    label: 'Notifications & Alertes de l\'application',
    uiConnection: "En-tête de l'application > Icône cloche de notifications",
    role: "Diffuse les alertes de cours, les rappels de révision, les messages système et les confirmations d'inscription.",
    usage: "Lue au démarrage de l'app pour afficher le badge de notifications non lues.",
    example: "{ id: 'notif_9', title: 'Nouveau cours disponible', description: 'Un corrigé a été ajouté...', is_unread: 1 }"
  },
  {
    table: 'users',
    label: 'Comptes et profils des utilisateurs',
    uiConnection: "Page de connexion / Inscription, En-tête profil utilisateur",
    role: "Table centrale de l'identité de chaque étudiant (nom, email, téléphone, école, filière, niveau, avatar).",
    usage: "Consultée à chaque connexion et pour afficher le profil.",
    example: "{ id: 'user_123', name: 'Kouassi Delmas', email: 'delmas@...', phone: '+225 07...', school: 'INP-HB', filiere: 'Génie Électrique' }"
  },
  {
    table: 'user_preferences',
    label: 'Préférences d\'affichage utilisateur',
    uiConnection: "En-tête > Bouton Mode Sombre / Clair, Vue grille/liste",
    role: "Conserve le thème choisi (sombre ou clair) et les options visuelles de l'interface.",
    usage: "Lue dès le chargement initial pour appliquer instantanément le bon thème.",
    example: "{ user_id: 'user_123', is_dark_mode: 1, view_mode: 'grid' }"
  },
  {
    table: 'user_subscriptions',
    label: 'Formules d\'abonnement au stockage',
    uiConnection: "Écran d'accueil > Mon stockage > Formules & Tarifs",
    role: "Définit le quota attribué (Gratuit 1 Go, Étudiant 5 Go, Pro 20 Go) et la date d'expiration.",
    usage: "Vérifié à chaque téléversement de fichier pour autoriser ou bloquer l'upload si le quota est atteint.",
    example: "{ user_id: 'user_123', plan_name: 'free', status: 'active' }"
  },
  {
    table: 'user_storage_quotas',
    label: 'Quotas de stockage personnalisés (Bienvenue & Payant)',
    uiConnection: "Tableau de bord admin > Demandes de stockage, Écran d'accueil > Mon stockage",
    role: "Gère pour CHAQUE utilisateur son stockage de bienvenue (R2: 10 Mo, D1: 20 Mo) et son stockage payant additionnel sans jamais être confondu.",
    usage: "Consulté à chaque upload pour valider l'espace restant de l'élève. Modifiable directement depuis le tableau de bord.",
    example: "{ user_id: 'user_123', welcome_r2_mb: 10, welcome_d1_mb: 20, paid_r2_mb: 0, paid_d1_mb: 0 }"
  },
  {
    table: 'storage_global_config',
    label: 'Configuration globale du stockage de bienvenue',
    uiConnection: "Tableau de bord admin > Paramètres de bienvenue par défaut",
    role: "Définit les Mo accordés automatiquement en cadeau de bienvenue à chaque nouvel étudiant lors de son inscription.",
    usage: "Lue lors de l'enregistrement d'un nouvel utilisateur pour lui attribuer son quota.",
    example: "{ id: 'default', default_welcome_r2_mb: 10, default_welcome_d1_mb: 20 }"
  },
  {
    table: 'referrals',
    label: 'Parrainages & Codes d\'invitation',
    uiConnection: "Menu latéral > Parrainer un ami",
    role: "Traite les invitations entre camarades et attribue des jours sans publicité ou du stockage bonus.",
    usage: "Vérifié à l'inscription lors de la saisie d'un code de parrainage.",
    example: "{ referrer_id: 'user_123', referred_user_id: 'user_456', reward_days: 5 }"
  },
  {
    table: 'referral_rewards_config',
    label: 'Barème des récompenses de parrainage',
    uiConnection: "Administration > Configuration des récompenses",
    role: "Configure les règles de bonus par parrainage (nombre de jours accordés).",
    usage: "Lue lors du calcul des gains de parrainage.",
    example: "{ id: 'default', days_per_referral: 5 }"
  },
  {
    table: 'auth_sessions',
    label: 'Sessions actives d\'authentification',
    uiConnection: "Système de sécurité & Maintien de connexion",
    role: "Stocke les jetons de session chiffrés pour maintenir l'utilisateur connecté en toute sécurité.",
    usage: "Vérifié à chaque requête vers les API sécurisées.",
    example: "{ id: 'sess_1', user_id: 'user_123', token_hash: 'sha256...', expires_at: '2026-12-31' }"
  },
  {
    table: 'email_verifications',
    label: 'Codes de vérification d\'email',
    uiConnection: "Écran d'inscription > Validation par code OTP à 6 chiffres",
    role: "Sécurise l'inscription en vérifiant que l'adresse email appartient bien à l'étudiant.",
    usage: "Écriture à l'inscription, vérifié lors de la saisie du code par l'élève.",
    example: "{ id: 'ev_99', email: 'etudiant@...', token: '482910', expires_at: '...' }"
  },
  {
    table: 'password_resets',
    label: 'Réinitialisation de mot de passe',
    uiConnection: "Écran de connexion > Mot de passe oublié",
    role: "Gère les codes temporaires de récupération de mot de passe par email.",
    usage: "Créé à la demande de réinitialisation, consommé lors du changement de mot de passe.",
    example: "{ id: 'pr_5', reset_code: '719302', used: 0 }"
  },
  {
    table: 'app_external_links',
    label: 'Liens externes de support & Tutoriels',
    uiConnection: "Menu latéral > Liens utiles (YouTube, WhatsApp, Telegram)",
    role: "Permet de mettre à jour dynamiquement les canaux de support officiel sans recompiler l'application.",
    usage: "Lue à l'ouverture du menu pour afficher les bons liens d'aide.",
    example: "{ id: 'youtube', name: 'Tutoriels Vidéo', url: 'https://youtube.com/...' }"
  },
  {
    table: 'storage_upgrade_requests',
    label: 'Demandes d\'augmentation de stockage & Preuves de paiement',
    uiConnection: "Menu d\'Administration > Demande de stockage",
    role: "Enregistre chaque demande d'upgrade soumise par un étudiant : volume additionnel demandé (+Go/Mo), prix payé, image ou reçu du paiement Wave/Orange Money, et statut d'approbation.",
    usage: "Écriture lors de la soumission de la demande d'upgrade, lecture et validation dans le panneau d'administration.",
    example: "{ id: 'req_89', user_id: 'user_123', pack_name: 'Pack Pro 50 Go', additional_mb: 51200, price_paid: 2500, status: 'pending', receipt_r2_key: 'storage-receipts/user_123/recu.jpg' }"
  },
  {
    table: 'user_subscriptions',
    label: 'Abonnements de stockage en cours & Historique des résiliations',
    uiConnection: "Menu d\'Administration > Demande de stockage (Abonnements en cours & Annulés)",
    role: "Trace tous les abonnements payants attribués : volume total, date et heure de début/fin, prix mensuel, ainsi que les motifs et l'ancien quota pour les abonnements annulés.",
    usage: "Créé à l'approbation d'une demande, mis à jour lors de l'annulation ou de l'expiration de l'abonnement.",
    example: "{ id: 'sub_44', user_id: 'user_123', plan_name: 'Pack Pro 50 Go', total_storage_mb: 51200, monthly_price: 2500, status: 'active', previous_storage_mb: 30 }"
  }
];

/**
 * Dictionnaire de TOUS les dossiers Cloudflare R2
 */
const R2_FOLDERS_METADATA = [
  {
    folder: 'user-files/',
    name: 'Fichiers personnels de cours (« Mes fichiers » et Matières)',
    uiConnection: "Écran d'accueil > Mes fichiers, Menu latéral gauche > Dossiers de matières",
    role: "Stocke physiquement tous les documents personnels de l'étudiant : polycopiés de cours, fiches de TD, devoirs, examens passés, photos d'exercices.",
    usage: "Téléversement par l'étudiant lors de l'ajout d'un document. Téléchargement et prévisualisation directe (PDF, images, Word). Le fichier réside une seule fois dans R2 et D1 gère ses liaisons.",
    examples: "Cours_Electronique.pdf, TP_Physique_Ondes.docx, Photo_Exercice_Calcul.jpg",
  },
  {
    folder: 'ai-studies/',
    name: 'Fichiers des sessions d\'étude assistées par l\'IA',
    uiConnection: "Espace d'étude IA > Importer un document pour analyse Gemini",
    role: "Héberge les documents complets que l'étudiant confie au robot Delmas pour qu'il en fasse la synthèse, génère des QCM ou réponde à des questions ciblées.",
    usage: "Téléversé au démarrage d'une session IA. L'IA lit son contenu pour générer les questionnaires et explications étape par étape.",
    examples: "Livre_Automatique_Lineaire.pdf, Support_Chimie_Organique.pdf",
  },
  {
    folder: 'published/files/',
    name: 'Documents publiés dans la bibliothèque (Menu Ressources)',
    uiConnection: "Bibliothèque partagée StudyCloud > Menu Ressources",
    role: "Héberge les fichiers que les étudiants publient comme ressource dans le menu Ressources pour tout le monde. Totalement exonéré de quota.",
    usage: "Accessible en téléchargement direct par tous les membres. Ne compte pas dans l'espace personnel de l'élève.",
    examples: "Annales_Bac_Scientifique.pdf, Resumes_Prepa_Maths.pdf",
    isExempted: true,
    exemptReason: "Ressource publique partagée pour tout le monde dans le menu Ressources (non comptée ni pénalisée)"
  },
  {
    folder: 'shared-links/files/',
    name: 'Fichiers des liens de partage créés',
    uiConnection: "Bouton Partager > Lien de partage externe & QR code",
    role: "Stocke les fichiers attachés à un lien de téléchargement partagé à des camarades par WhatsApp, email ou QR code.",
    usage: "Téléchargé par les personnes qui ouvrent le lien public sans nécessairement avoir créé de compte StudyCloud.",
    examples: "Devoir_Maison_Groupe_3.pdf, Compte_Rendu_TP.pdf",
  },
  {
    folder: 'products/images/',
    name: 'Photos des articles de la boutique DKD',
    uiConnection: "Boutique StudyCloud > Fiches articles & Carrousel photos",
    role: "Contient les photographies réelles des calculatrices, livres, outils et composants électroniques proposés dans la boutique DKD.",
    usage: "Affiché en haute définition dans la vitrine de la boutique pour les acheteurs.",
    examples: "casio_graph35_front.jpg, arduino_uno_kit.png",
  },
  {
    folder: 'avatars/',
    name: 'Photos de profil et avatars des étudiants',
    uiConnection: "En-tête profil, Menu latéral, Fiche utilisateur",
    role: "Stocke la photo personnalisée de profil choisie par l'étudiant ou le vendeur pour personnaliser son compte.",
    usage: "Affiché dans le coin supérieur de l'application et sur les créations partagées.",
    examples: "avatar_user_123.jpg, profile_delmas.png",
  },
  {
    folder: 'storage-receipts/',
    name: 'Reçus de paiement des demandes de stockage (Wave / OM / Moov / MTN)',
    uiConnection: "Tableau de bord admin > Demande de stockage > Espace reçu de paiement",
    role: "Stocke physiquement dans Cloudflare R2 les captures d'écran, photos et reçus de transfert téléversés par les étudiants pour justifier le paiement de leur abonnement de stockage. Classé strictement par identifiant utilisateur pour ne rien mélanger.",
    usage: "Téléversé lors de la demande d'upgrade de stockage, prévisualisé et agrandi par l'administrateur avant validation.",
    examples: "storage-receipts/user_123/recu_wave_2500fcfa.jpg, storage-receipts/user_456/recu_om.png",
    isExempted: true,
    exemptReason: "Reçus comptables et administratifs de paiement (non décomptés du quota personnel de l'élève)"
  }
];

/**
 * Analyse détaillée et complète de TOUTES les tables D1 pour un utilisateur spécifique
 */
async function inspectUserStorageDetail(db, bucket, user, globalConfig) {
  const userId = user.id;

  // 1. Quota personnalisé de l'utilisateur (ou initialisation par défaut)
  let quotaRow = await safeFirst(db, `SELECT * FROM user_storage_quotas WHERE user_id = ?`, [userId]);
  if (!quotaRow) {
    const wTotal = globalConfig.default_welcome_total_mb || ((globalConfig.default_welcome_r2_mb || 10.0) + (globalConfig.default_welcome_d1_mb || 20.0));
    const wR2 = globalConfig.default_welcome_r2_mb || 10.0;
    const wD1 = globalConfig.default_welcome_d1_mb || 20.0;
    await safeRun(db, `
      INSERT OR IGNORE INTO user_storage_quotas (user_id, welcome_total_mb, welcome_r2_mb, welcome_d1_mb, paid_total_mb, paid_r2_mb, paid_d1_mb, plan_name)
      VALUES (?, ?, ?, ?, 0.0, 0.0, 0.0, 'gratuit')
    `, [userId, wTotal, wR2, wD1]);
    quotaRow = {
      welcome_total_mb: wTotal,
      welcome_r2_mb: wR2,
      welcome_d1_mb: wD1,
      paid_total_mb: 0.0,
      paid_r2_mb: 0.0,
      paid_d1_mb: 0.0,
      bonus_total_mb: 0.0,
      bonus_r2_mb: 0.0,
      bonus_d1_mb: 0.0,
      plan_name: 'gratuit',
      notes: ''
    };
  }

  const welcomeTotalMb = Number(quotaRow.welcome_total_mb ?? (Number(quotaRow.welcome_r2_mb || 10.0) + Number(quotaRow.welcome_d1_mb || 20.0)));
  const welcomeR2Mb = Number(quotaRow.welcome_r2_mb ?? 10.0);
  const welcomeD1Mb = Number(quotaRow.welcome_d1_mb ?? 20.0);

  const paidTotalMb = Number(quotaRow.paid_total_mb ?? (Number(quotaRow.paid_r2_mb || 0.0) + Number(quotaRow.paid_d1_mb || 0.0)));
  const paidR2Mb = Number(quotaRow.paid_r2_mb ?? 0.0);
  const paidD1Mb = Number(quotaRow.paid_d1_mb ?? 0.0);

  const bonusR2Mb = Number(quotaRow.bonus_r2_mb ?? 0.0);
  const bonusD1Mb = Number(quotaRow.bonus_d1_mb ?? 0.0);
  const bonusTotalMb = Number(quotaRow.bonus_total_mb ?? (bonusR2Mb + bonusD1Mb));

  const totalAllowedMb = welcomeTotalMb + paidTotalMb + bonusTotalMb;
  const totalAllowedBytes = totalAllowedMb * 1024 * 1024;

  // 2. FICHIERS PERSONNELS & MATIERES (R2 via Table files)
  const filesStats = await safeFirst(db, `
    SELECT 
      COUNT(*) AS total_count,
      COALESCE(SUM(size), 0) AS total_bytes,
      COALESCE(SUM(CASE WHEN is_study_session = 1 THEN 1 ELSE 0 END), 0) AS ai_files_count,
      COALESCE(SUM(CASE WHEN is_study_session = 1 THEN size ELSE 0 END), 0) AS ai_files_bytes,
      COALESCE(SUM(CASE WHEN is_study_session = 0 THEN 1 ELSE 0 END), 0) AS personal_files_count,
      COALESCE(SUM(CASE WHEN is_study_session = 0 THEN size ELSE 0 END), 0) AS personal_files_bytes
    FROM files 
    WHERE user_id = ?
  `, [userId], { total_count: 0, total_bytes: 0, ai_files_count: 0, ai_files_bytes: 0, personal_files_count: 0, personal_files_bytes: 0 });

  // 3. FICHIERS PUBLIES DANS LA BIBLIOTHEQUE PUBLIQUE (Exemptés du quota personnel)
  const pubStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(file_size), 0) AS total_bytes, COALESCE(SUM(views_count), 0) AS total_views, COALESCE(SUM(downloads_count), 0) AS total_downloads
    FROM published_documents WHERE user_id = ?
  `, [userId], { count: 0, total_bytes: 0, total_views: 0, total_downloads: 0 });

  // 3b. INTERACTIONS DE VUES SUR LES DOCUMENTS (Exemptées du quota personnel)
  const viewsInteractionsStats = await safeFirst(db, `
    SELECT COUNT(*) AS count FROM user_document_interactions WHERE user_id = ?
  `, [userId], { count: 0 });

  // 3c. TELECHARGEMENTS SUR LES DOCUMENTS (Exemptés du quota personnel)
  const pubDownloadsStats = await safeFirst(db, `
    SELECT COUNT(*) AS count FROM published_document_downloads WHERE user_id = ?
  `, [userId], { count: 0 });

  // 3d. COMPTEURS DU NOMBRE DE MOTS (Exemptés du quota personnel)
  const wordCountStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(word_count), 0) AS total_words, COALESCE(SUM(token_count), 0) AS total_tokens
    FROM user_word_counts WHERE user_id = ?
  `, [userId], { count: 0, total_words: 0, total_tokens: 0 });

  // 4. FICHIERS DE LIENS DE PARTAGE
  const shareStats = await safeFirst(db, `
    SELECT COUNT(DISTINCT sf.id) AS folders_count, COUNT(sff.id) AS files_count, COALESCE(SUM(sff.size), 0) AS total_bytes
    FROM shared_folders sf LEFT JOIN shared_folder_files sff ON sff.shared_folder_id = sf.id
    WHERE sf.user_id = ?
  `, [userId], { folders_count: 0, files_count: 0, total_bytes: 0 });

  // 5. BOUTIQUE : PRODUITS PUBLIES POUR LES COMMANDES (Images & données écrites)
  const shopStats = await safeFirst(db, `
    SELECT COUNT(*) AS products_count, 
           COALESCE(SUM(LENGTH(title) + LENGTH(COALESCE(description, '')) + LENGTH(COALESCE(price, '')) + LENGTH(COALESCE(image_urls_json, ''))), 0) AS d1_text_bytes
    FROM products WHERE seller_id = ?
  `, [userId], { products_count: 0, d1_text_bytes: 0 });
  const shopImagesBytes = (shopStats.products_count || 0) * 120000;

  // 6. CONTENUS GENERES PAR L'IA (Fiches mémoires, résumés, quiz...)
  const aiContentsStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(title) + LENGTH(COALESCE(content_json, ''))), 0) AS d1_text_bytes
    FROM ai_generated_contents WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 7. ESPACE DE TRAVAIL IA / WORKSPACE (Brouillons, notes, fichiers attachés)
  const aiWorkspaceStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(message_text) + LENGTH(COALESCE(attached_file_content, '')) + LENGTH(COALESCE(user_notes, ''))), 0) AS d1_text_bytes
    FROM user_ai_workspace WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 8. DISCUSSIONS & CHAT IA ENREGISTREES (Conversations et messages IA)
  const chatStats = await safeFirst(db, `
    SELECT COUNT(DISTINCT c.id) AS conversations_count, COUNT(m.id) AS messages_count, COALESCE(SUM(LENGTH(m.content) + LENGTH(COALESCE(m.metadata, ''))), 0) AS d1_text_bytes
    FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.user_id = ?
  `, [userId], { conversations_count: 0, messages_count: 0, d1_text_bytes: 0 });

  // 9. NOTES DE BLOC-NOTES
  const notesStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(title) + LENGTH(COALESCE(content, ''))), 0) AS d1_text_bytes
    FROM notes WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 10. MATIERES
  const matieresStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(name)), 0) AS d1_text_bytes
    FROM matieres WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 11. EMPLOI DU TEMPS
  const scheduleStats = await safeFirst(db, `
    SELECT COUNT(*) AS slots_count, COALESCE(SUM(LENGTH(subject) + LENGTH(COALESCE(room, '')) + LENGTH(COALESCE(note_or_teacher, ''))), 0) AS d1_text_bytes
    FROM schedule_slots WHERE user_id = ?
  `, [userId], { slots_count: 0, d1_text_bytes: 0 });

  // 12. NOTES D'EVALUATION
  const gradesStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(subject_name) + LENGTH(COALESCE(sub_grades_json, ''))), 0) AS d1_text_bytes
    FROM grades WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 13. CALENDRIER & SESSIONS D'ETUDE (HORLOGE)
  const calendarStats = await safeFirst(db, `SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(title)), 0) AS d1_text_bytes FROM calendar_events WHERE user_id = ?`, [userId], { count: 0, d1_text_bytes: 0 });
  const studySessionsStats = await safeFirst(db, `SELECT COUNT(*) AS count, COALESCE(SUM(duration_seconds), 0) AS total_study_seconds FROM study_sessions WHERE user_id = ?`, [userId], { count: 0, total_study_seconds: 0 });

  // 14. AVATAR / ICONE PERSONNALISEE
  const hasCustomAvatar = user.avatar_url && (user.avatar_url.includes('avatars/') || user.avatar_url.startsWith('http') || user.avatar_url.startsWith('data:image'));
  const avatarEstimatedBytes = hasCustomAvatar ? 85000 : 0;

  // 15. BOUTIQUE DE SERVICES & STATUT
  const shopProfile = await safeFirst(db, `SELECT * FROM shop_profiles WHERE user_id = ?`, [userId]);
  const hasShop = (shopStats.products_count > 0) || Boolean(shopProfile);
  const shopProductsCount = shopStats.products_count || 0;
  let shopName = shopProfile?.shop_name || '';
  let shopPhone = shopProfile?.shop_phone || '';
  let shopWhatsapp = shopProfile?.shop_whatsapp || '';
  let shopCategory = shopProfile?.shop_category || '';
  let shopAvatarUrl = shopProfile?.shop_avatar_url || '';
  let shopUpdatedAt = shopProfile?.updated_at || '';

  // Si pas de shop_profiles mais des articles en vente dans la boutique
  if (!shopProfile && shopStats.products_count > 0) {
    const firstProd = await safeFirst(db, `SELECT seller_name, seller_phone, seller_whatsapp, seller_avatar_url, category, updated_at FROM products WHERE seller_id = ? LIMIT 1`, [userId]);
    if (firstProd) {
      shopName = firstProd.seller_name || '';
      shopPhone = firstProd.seller_phone || '';
      shopWhatsapp = firstProd.seller_whatsapp || '';
      shopCategory = firstProd.category || '';
      shopAvatarUrl = firstProd.seller_avatar_url || '';
      shopUpdatedAt = firstProd.updated_at || '';
    }
  }

  if (hasShop) {
    if (!shopName) shopName = 'Boutique de ' + (user.name || 'l\'étudiant');
    if (!shopPhone) shopPhone = user.phone || '';
    if (!shopCategory) shopCategory = 'Vente digital (PDF)';
  }

  // 16. STATUT DE CONNEXION / EN LIGNE
  const activeSession = await safeFirst(db, `
    SELECT * FROM auth_sessions 
    WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP 
    ORDER BY created_at DESC LIMIT 1
  `, [userId]);

  let isOnline = false;
  let lastSeenText = "Non connecté récemment";
  if (user.last_active_at) {
    let dateStr = String(user.last_active_at).trim();
    if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
      dateStr = dateStr.replace(' ', 'T') + 'Z';
    }
    const lastActiveTime = new Date(dateStr).getTime();
    const now = Date.now();
    const diffMinutes = Math.floor((now - lastActiveTime) / 60000);
    if (!isNaN(diffMinutes) && diffMinutes >= 0) {
      if (diffMinutes <= 20) {
        isOnline = true;
        lastSeenText = "En ligne maintenant";
      } else if (diffMinutes < 60) {
        lastSeenText = `Vu il y a ${diffMinutes} min`;
      } else if (diffMinutes < 1440) {
        const h = Math.floor(diffMinutes / 60);
        lastSeenText = `Vu il y a ${h}h`;
      } else {
        const d = Math.floor(diffMinutes / 1440);
        lastSeenText = `Vu il y a ${d} j`;
      }
    }
  }

  if (!isOnline && activeSession && activeSession.created_at) {
    let sDate = String(activeSession.created_at).trim();
    if (!sDate.endsWith('Z') && !sDate.includes('+')) sDate = sDate.replace(' ', 'T') + 'Z';
    const sTime = new Date(sDate).getTime();
    const sDiff = Math.floor((Date.now() - sTime) / 60000);
    if (!isNaN(sDiff) && sDiff >= 0 && sDiff <= 20) {
      isOnline = true;
      lastSeenText = "En ligne (session active)";
    }
  }

  // Profil
  const userProfileBytes = (user.name?.length || 0) + (user.email?.length || 0) + (user.school?.length || 0) + (user.filiere?.length || 0) + (user.phone?.length || 0) + 120;

  // CALCULS R2 DIRECTS :
  // Net R2 (Facturé) : fichiers personnels + liens partagés + avatar + images boutique
  // Fichiers de ressources publiques (published_documents) STRICTEMENT EXCLUS du net facturé
  const netR2Bytes = (filesStats.total_bytes || 0) + (shareStats.total_bytes || 0) + avatarEstimatedBytes + shopImagesBytes;
  const exemptR2Bytes = (pubStats.total_bytes || 0);
  const grossR2Bytes = netR2Bytes + exemptR2Bytes;

  // CALCULS D1 DIRECTS :
  // Net D1 (Facturé) : textes personnels + créations IA + discussions + bloc-notes + boutique + horloge + profil + SQLite row overhead
  const netD1TextBytes = (shopStats.d1_text_bytes || 0) + (aiContentsStats.d1_text_bytes || 0) + (aiWorkspaceStats.d1_text_bytes || 0) +
                         (chatStats.d1_text_bytes || 0) + (notesStats.d1_text_bytes || 0) + (matieresStats.d1_text_bytes || 0) + 
                         (scheduleStats.d1_text_bytes || 0) + (gradesStats.d1_text_bytes || 0) + (calendarStats.d1_text_bytes || 0) + userProfileBytes;

  const netD1Rows = (filesStats.total_count || 0) + (shareStats.folders_count || 0) + (shareStats.files_count || 0) +
                    (shopStats.products_count || 0) + (aiContentsStats.count || 0) + (aiWorkspaceStats.count || 0) +
                    (chatStats.conversations_count || 0) + (chatStats.messages_count || 0) + (notesStats.count || 0) + 
                    (matieresStats.count || 0) + (scheduleStats.slots_count || 0) + (gradesStats.count || 0) + (calendarStats.count || 0) + (studySessionsStats.count || 0) + 1;

  const netD1Bytes = netD1TextBytes + (netD1Rows * 128);

  // Éléments D1 exemptés (strictement non comptés ni pénalisés dans le net) :
  // 1. Fichiers publiés comme ressource dans le menu ressources
  const pubDocsD1Bytes = (pubStats.count * 128) + (pubStats.count * 350);
  // 2. Nombre de vues des fichiers
  const viewsD1Bytes = ((viewsInteractionsStats.count || pubStats.total_views) * 64);
  // 3. Nombre de téléchargements (fichiers & liens)
  const downloadsD1Bytes = ((pubDownloadsStats.count || pubStats.total_downloads) * 64);
  // 4. Table pour stocker les nombres de mots de chaque utilisateur
  const wordCountD1Bytes = (wordCountStats.count * 128) + 140;

  const exemptD1Bytes = pubDocsD1Bytes + viewsD1Bytes + downloadsD1Bytes + wordCountD1Bytes;
  const exemptD1Rows = (pubStats.count || 0) + (viewsInteractionsStats.count || 0) + (pubDownloadsStats.count || 0) + (wordCountStats.count || 0);

  const grossD1Bytes = netD1Bytes + exemptD1Bytes;
  const userD1Rows = netD1Rows + exemptD1Rows;

  // Totaux Brut & Net
  const netTotalBytes = netR2Bytes + netD1Bytes;
  const grossTotalBytes = grossR2Bytes + grossD1Bytes;
  const totalExemptBytes = exemptR2Bytes + exemptD1Bytes;

  const grossUsagePercentage = totalAllowedBytes > 0 
    ? Math.min(100, parseFloat(((grossTotalBytes / totalAllowedBytes) * 100).toFixed(1)))
    : 0;

  const netUsagePercentage = totalAllowedBytes > 0 
    ? Math.min(100, parseFloat(((netTotalBytes / totalAllowedBytes) * 100).toFixed(1)))
    : 0;

  // Dictionnaire individuel table par table pour cet utilisateur
  const userTablesStats = {
    files: { count: filesStats.total_count, bytes: filesStats.total_bytes, formatted: formatBytes(filesStats.total_bytes), isExempted: false },
    notes: { count: notesStats.count, bytes: notesStats.d1_text_bytes, formatted: formatBytes(notesStats.d1_text_bytes), isExempted: false },
    matieres: { count: matieresStats.count, bytes: matieresStats.d1_text_bytes, formatted: formatBytes(matieresStats.d1_text_bytes), isExempted: false },
    ai_generated_contents: { count: aiContentsStats.count, bytes: aiContentsStats.d1_text_bytes, formatted: formatBytes(aiContentsStats.d1_text_bytes), isExempted: false },
    user_ai_workspace: { count: aiWorkspaceStats.count, bytes: aiWorkspaceStats.d1_text_bytes, formatted: formatBytes(aiWorkspaceStats.d1_text_bytes), isExempted: false },
    conversations: { count: chatStats.conversations_count, bytes: chatStats.conversations_count * 150, formatted: formatBytes(chatStats.conversations_count * 150), isExempted: false },
    messages: { count: chatStats.messages_count, bytes: (chatStats.messages_count * 128) + (chatStats.d1_text_bytes || 0), formatted: formatBytes((chatStats.messages_count * 128) + (chatStats.d1_text_bytes || 0)), isExempted: false },
    ai_creations: { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false },
    ai_tasks: { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false },
    user_certificates: { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false },
    schedule_slots: { count: scheduleStats.slots_count, bytes: scheduleStats.d1_text_bytes, formatted: formatBytes(scheduleStats.d1_text_bytes), isExempted: false },
    schedule_config: { count: 1, bytes: 180, formatted: formatBytes(180), isExempted: false },
    grades: { count: gradesStats.count, bytes: gradesStats.d1_text_bytes, formatted: formatBytes(gradesStats.d1_text_bytes), isExempted: false },
    grade_settings: { count: 1, bytes: 80, formatted: formatBytes(80), isExempted: false },
    calendar_events: { count: calendarStats.count, bytes: calendarStats.d1_text_bytes, formatted: formatBytes(calendarStats.d1_text_bytes), isExempted: false },
    alarms: { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false },
    study_sessions: { count: studySessionsStats.count, bytes: studySessionsStats.count * 90, formatted: formatBytes(studySessionsStats.count * 90), isExempted: false },
    published_documents: { count: pubStats.count, bytes: pubDocsD1Bytes, formatted: formatBytes(pubDocsD1Bytes), isExempted: true, exemptReason: "Ressource publique de la bibliothèque pour tout le monde" },
    user_document_interactions: { count: viewsInteractionsStats.count || pubStats.total_views, bytes: viewsD1Bytes, formatted: formatBytes(viewsD1Bytes), isExempted: true, exemptReason: "Nombre de vues des fichiers" },
    published_document_downloads: { count: pubDownloadsStats.count || pubStats.total_downloads, bytes: downloadsD1Bytes, formatted: formatBytes(downloadsD1Bytes), isExempted: true, exemptReason: "Nombre de téléchargements (fichiers et liens)" },
    user_word_counts: { count: wordCountStats.count || 1, bytes: wordCountD1Bytes, formatted: formatBytes(wordCountD1Bytes), isExempted: true, exemptReason: "Table pour stocker les nombres de mots" },
    shared_folders: { count: shareStats.folders_count, bytes: shareStats.folders_count * 250, formatted: formatBytes(shareStats.folders_count * 250), isExempted: false },
    shared_folder_files: { count: shareStats.files_count, bytes: shareStats.total_bytes, formatted: formatBytes(shareStats.total_bytes), isExempted: false },
    shop_profiles: { count: hasShop ? 1 : 0, bytes: 180, formatted: formatBytes(180), isExempted: false },
    products: { count: shopStats.products_count, bytes: shopStats.d1_text_bytes, formatted: formatBytes(shopStats.d1_text_bytes), isExempted: false },
    cart_items: { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false },
    seller_follows: { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false },
    notifications: { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false },
    users: { count: 1, bytes: userProfileBytes, formatted: formatBytes(userProfileBytes), isExempted: false },
    user_preferences: { count: 1, bytes: 90, formatted: formatBytes(90), isExempted: false },
    user_subscriptions: { count: 1, bytes: 110, formatted: formatBytes(110), isExempted: false },
    user_storage_quotas: { count: 1, bytes: 140, formatted: formatBytes(140), isExempted: false },
    storage_global_config: { count: 1, bytes: 80, formatted: formatBytes(80), isExempted: false },
    referrals: { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false },
    referral_rewards_config: { count: 1, bytes: 120, formatted: formatBytes(120), isExempted: false },
    auth_sessions: { count: activeSession ? 1 : 0, bytes: 128, formatted: formatBytes(128), isExempted: false },
    email_verifications: { count: 1, bytes: 120, formatted: formatBytes(120), isExempted: false },
    password_resets: { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false },
    app_external_links: { count: 3, bytes: 380, formatted: formatBytes(380), isExempted: false }
  };

  // Dictionnaire individuel R2 pour cet utilisateur
  const userR2FoldersStats = {
    'user-files/': { count: filesStats.personal_files_count, bytes: filesStats.personal_files_bytes, formatted: formatBytes(filesStats.personal_files_bytes), isExempted: false },
    'ai-studies/': { count: filesStats.ai_files_count, bytes: filesStats.ai_files_bytes, formatted: formatBytes(filesStats.ai_files_bytes), isExempted: false },
    'published/files/': { count: pubStats.count, bytes: pubStats.total_bytes, formatted: formatBytes(pubStats.total_bytes), isExempted: true, exemptReason: "Ressource publique du menu Ressources pour toute la communauté" },
    'shared-links/files/': { count: shareStats.files_count, bytes: shareStats.total_bytes, formatted: formatBytes(shareStats.total_bytes), isExempted: false },
    'products/images/': { count: shopStats.products_count, bytes: shopStats.products_count * 120000, formatted: formatBytes(shopStats.products_count * 120000), isExempted: false },
    'avatars/': { count: hasCustomAvatar ? 1 : 0, bytes: avatarEstimatedBytes, formatted: formatBytes(avatarEstimatedBytes), isExempted: false }
  };

  return {
    user: {
      id: user.id,
      name: user.name || 'Étudiant StudyCloud',
      email: user.email || '',
      phone: user.phone || 'Non renseigné',
      school: user.school || '',
      filiere: user.filiere || '',
      level: user.level || 'Étudiant',
      country: user.country || 'Côte d\'Ivoire',
      avatar_url: user.avatar_url || '',
      created_at: user.created_at || '',
      last_active_at: user.last_active_at || '',
      isOnline,
      lastSeenText,
      hasActiveSession: Boolean(activeSession),
      hasShop,
      shopProductsCount,
      shopName,
      shopPhone,
      shopWhatsapp,
      shopCategory,
      shopAvatarUrl,
      shopUpdatedAt
    },
    quotaConfig: {
      welcomeR2Mb,
      welcomeD1Mb,
      welcomeTotalMb,
      paidR2Mb,
      paidD1Mb,
      paidTotalMb,
      bonusR2Mb,
      bonusD1Mb,
      totalAllowedMb,
      totalAllowedBytes,
      totalAllowedFormatted: totalAllowedMb >= 1024 ? (totalAllowedMb / 1024).toFixed(2) + ' Go' : totalAllowedMb.toFixed(0) + ' Mo',
      planName: quotaRow.plan_name || 'gratuit',
      notes: quotaRow.notes || ''
    },
    storage: {
      totalBytes: netTotalBytes,
      totalFormatted: formatBytes(netTotalBytes),
      usagePercentage: netUsagePercentage,
      net: {
        totalBytes: netTotalBytes,
        totalFormatted: formatBytes(netTotalBytes),
        usagePercentage: netUsagePercentage,
        r2Bytes: netR2Bytes,
        r2Formatted: formatBytes(netR2Bytes),
        d1Bytes: netD1Bytes,
        d1Formatted: formatBytes(netD1Bytes),
        d1Rows: netD1Rows
      },
      gross: {
        totalBytes: grossTotalBytes,
        totalFormatted: formatBytes(grossTotalBytes),
        usagePercentage: grossUsagePercentage,
        r2Bytes: grossR2Bytes,
        r2Formatted: formatBytes(grossR2Bytes),
        d1Bytes: grossD1Bytes,
        d1Formatted: formatBytes(grossD1Bytes),
        d1Rows: userD1Rows
      },
      exempted: {
        totalBytes: totalExemptBytes,
        totalFormatted: formatBytes(totalExemptBytes),
        r2Bytes: exemptR2Bytes,
        r2Formatted: formatBytes(exemptR2Bytes),
        d1Bytes: exemptD1Bytes,
        d1Formatted: formatBytes(exemptD1Bytes),
        exemptD1Rows,
        items: [
          { name: "Ressources publiques dans le menu Ressources (R2 + D1)", bytes: exemptR2Bytes + pubDocsD1Bytes, formatted: formatBytes(exemptR2Bytes + pubDocsD1Bytes), icon: "📚" },
          { name: "Nombre de vues des fichiers", bytes: viewsD1Bytes, formatted: formatBytes(viewsD1Bytes), icon: "👁️" },
          { name: "Nombre de téléchargements (Fichiers & Liens partagés)", bytes: downloadsD1Bytes, formatted: formatBytes(downloadsD1Bytes), icon: "⬇️" },
          { name: "Table de stockage des nombres de mots de l'utilisateur", bytes: wordCountD1Bytes, formatted: formatBytes(wordCountD1Bytes), icon: "📝" }
        ]
      },
      r2: {
        totalBytes: netR2Bytes,
        grossBytes: grossR2Bytes,
        netBytes: netR2Bytes,
        totalFormatted: formatBytes(netR2Bytes),
        folders: userR2FoldersStats
      },
      d1: {
        totalBytes: netD1Bytes,
        grossBytes: grossD1Bytes,
        netBytes: netD1Bytes,
        totalFormatted: formatBytes(netD1Bytes),
        totalRows: netD1Rows,
        grossRows: userD1Rows,
        tables: userTablesStats
      }
    }
  };
}

async function inspectAllD1TablesGlobal(db) {
  let dbTables = [];
  try {
    const res = await safeQuery(db, `
      SELECT name 
      FROM sqlite_schema 
      WHERE type = 'table' 
        AND name NOT LIKE 'sqlite_%' 
        AND name NOT LIKE '_cf_%'
        AND name NOT LIKE 'd1_%'
      ORDER BY name ASC
    `, [], null);
    if (res && res.results && res.results.length > 0) {
      dbTables = res.results.map(r => r.name);
    }
  } catch (e) {
    try {
      const res = await safeQuery(db, `
        SELECT name 
        FROM sqlite_master 
        WHERE type = 'table' 
          AND name NOT LIKE 'sqlite_%' 
          AND name NOT LIKE '_cf_%'
          AND name NOT LIKE 'd1_%'
        ORDER BY name ASC
      `, [], null);
      if (res && res.results && res.results.length > 0) {
        dbTables = res.results.map(r => r.name);
      }
    } catch (e2) {}
  }

  // Fusionner avec la liste des tables connues pour s'assurer d'un inventaire complet
  const knownTableNames = TABLES_METADATA.map(t => t.table);
  const allTableNamesSet = new Set([...dbTables, ...knownTableNames]);
  const allTableNames = Array.from(allTableNamesSet).sort();

  const metadataMap = new Map();
  for (const item of TABLES_METADATA) {
    metadataMap.set(item.table, item);
  }

  const dynamicTablesMeta = [];
  const results = {};
  let totalD1Bytes = 0;
  let totalD1Rows = 0;

  for (const tableName of allTableNames) {
    let meta = metadataMap.get(tableName);
    if (!meta) {
      const cleanLabel = tableName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      meta = {
        table: tableName,
        label: cleanLabel,
        uiConnection: "Base de données Cloudflare D1 (Table applicative)",
        role: "Table de stockage de données dynamiques pour StudyCloud",
        usage: "Lecture/Écriture en temps réel selon les fonctionnalités actives",
        example: `{ table: "${tableName}", status: "active" }`
      };
    }
    dynamicTablesMeta.push(meta);

    let count = 0;
    let tableBytes = 0;
    try {
      const row = await safeFirst(db, `SELECT COUNT(*) as count FROM "${tableName}"`, [], { count: 0 });
      count = row ? (row.count || 0) : 0;

      if (count > 0) {
        let computed = false;
        try {
          const colInfo = await safeQuery(db, `PRAGMA table_info("${tableName}")`, [], null);
          if (colInfo && colInfo.results && colInfo.results.length > 0) {
            const sumCols = colInfo.results.map(c => `COALESCE(LENGTH("${c.name}"), 0)`).join(' + ');
            const bRow = await safeFirst(db, `SELECT SUM(${sumCols}) as total_data_bytes FROM "${tableName}"`, [], null);
            if (bRow && bRow.total_data_bytes !== null && !isNaN(bRow.total_data_bytes)) {
              tableBytes = Math.max(0, Number(bRow.total_data_bytes) + (count * 32));
              computed = true;
            }
          }
        } catch (ePragma) {}

        if (!computed) {
          let avgBytesPerRow = 200;
          if (tableName.includes('ai') || tableName.includes('workspace') || tableName.includes('contents')) avgBytesPerRow = 3200;
          else if (tableName.includes('files') || tableName.includes('documents')) avgBytesPerRow = 500;
          else if (tableName.includes('notes')) avgBytesPerRow = 800;
          else if (tableName.includes('sessions') || tableName.includes('profile')) avgBytesPerRow = 400;
          tableBytes = count * avgBytesPerRow;
        }
      }

      totalD1Bytes += tableBytes;
      totalD1Rows += count;

      results[tableName] = {
        count,
        bytes: tableBytes,
        formatted: formatBytes(tableBytes)
      };
    } catch (e) {
      results[tableName] = { count: 0, bytes: 0, formatted: '0 Octets' };
    }
  }

  // Vérification de la taille physique globale du fichier SQLite D1
  try {
    const pCountRow = await safeFirst(db, `PRAGMA page_count`, [], null);
    const pSizeRow = await safeFirst(db, `PRAGMA page_size`, [], null);
    const pCount = pCountRow ? Number(pCountRow.page_count || Object.values(pCountRow)[0] || 0) : 0;
    const pSize = pSizeRow ? Number(pSizeRow.page_size || Object.values(pSizeRow)[0] || 0) : 0;
    if (pCount > 0 && pSize > 0) {
      const physicalFileBytes = pCount * pSize;
      if (physicalFileBytes > totalD1Bytes) {
        totalD1Bytes = physicalFileBytes;
      }
    }
  } catch (eDbStat) {}

  return {
    tablesMeta: dynamicTablesMeta,
    d1TablesGlobal: results,
    totalD1Bytes,
    totalD1Rows
  };
}

async function inspectRealR2Global(bucket, db, detailedUsers) {
  let totalR2Bytes = 0;
  let totalR2Files = 0;
  const folders = {
    'user-files/': { count: 0, bytes: 0, formatted: '0 Octets' },
    'ai-studies/': { count: 0, bytes: 0, formatted: '0 Octets' },
    'published/files/': { count: 0, bytes: 0, formatted: '0 Octets' },
    'shared-links/files/': { count: 0, bytes: 0, formatted: '0 Octets' },
    'products/images/': { count: 0, bytes: 0, formatted: '0 Octets' },
    'avatars/': { count: 0, bytes: 0, formatted: '0 Octets' },
    'storage-receipts/': { count: 0, bytes: 0, formatted: '0 Octets' }
  };

  let bucketScanned = false;

  // 1. Scan réel direct du Bucket Cloudflare R2
  if (bucket && typeof bucket.list === 'function') {
    try {
      let truncated = true;
      let cursor = undefined;
      let iterations = 0;

      while (truncated && iterations < 30) {
        iterations++;
        const listResult = await bucket.list({ cursor, limit: 1000 });
        if (listResult && listResult.objects) {
          bucketScanned = true;
          for (const obj of listResult.objects) {
            const sz = Number(obj.size || 0);
            totalR2Bytes += sz;
            totalR2Files++;

            const key = obj.key || '';
            let matchedFolder = false;
            for (const fPrefix of Object.keys(folders)) {
              if (key.startsWith(fPrefix)) {
                folders[fPrefix].count++;
                folders[fPrefix].bytes += sz;
                matchedFolder = true;
                break;
              }
            }
            if (!matchedFolder) {
              const slashIdx = key.indexOf('/');
              const rootFolder = slashIdx !== -1 ? key.substring(0, slashIdx + 1) : 'racine/';
              if (!folders[rootFolder]) {
                folders[rootFolder] = { count: 0, bytes: 0, formatted: '0 Octets' };
              }
              folders[rootFolder].count++;
              folders[rootFolder].bytes += sz;
            }
          }
        }
        truncated = Boolean(listResult && listResult.truncated);
        cursor = listResult ? listResult.cursor : undefined;
      }
    } catch (errBucket) {
      console.error('Inspection R2 bucket.list:', errBucket);
    }
  }

  // 2. Vérification croisée avec les tables D1 (files, published_documents, storage_upgrade_requests)
  let dbFilesBytes = 0;
  let dbFilesCount = 0;
  try {
    const filesDb = await safeFirst(db, `
      SELECT 
        COUNT(*) AS total_count,
        COALESCE(SUM(size), 0) AS total_bytes,
        COALESCE(SUM(CASE WHEN is_study_session = 1 THEN size ELSE 0 END), 0) AS ai_bytes,
        COALESCE(SUM(CASE WHEN is_study_session = 1 THEN 1 ELSE 0 END), 0) AS ai_count,
        COALESCE(SUM(CASE WHEN is_study_session = 0 THEN size ELSE 0 END), 0) AS personal_bytes,
        COALESCE(SUM(CASE WHEN is_study_session = 0 THEN 1 ELSE 0 END), 0) AS personal_count
      FROM files
    `, [], null);

    const pubDb = await safeFirst(db, `
      SELECT COUNT(*) AS total_count, COALESCE(SUM(file_size), 0) AS total_bytes 
      FROM published_documents
    `, [], null);

    if (filesDb) {
      dbFilesBytes += Number(filesDb.total_bytes || 0);
      dbFilesCount += Number(filesDb.total_count || 0);

      if (!bucketScanned) {
        folders['user-files/'].bytes = Number(filesDb.personal_bytes || 0);
        folders['user-files/'].count = Number(filesDb.personal_count || 0);
        folders['ai-studies/'].bytes = Number(filesDb.ai_bytes || 0);
        folders['ai-studies/'].count = Number(filesDb.ai_count || 0);
      }
    }

    if (pubDb) {
      dbFilesBytes += Number(pubDb.total_bytes || 0);
      dbFilesCount += Number(pubDb.total_count || 0);

      if (!bucketScanned) {
        folders['published/files/'].bytes = Number(pubDb.total_bytes || 0);
        folders['published/files/'].count = Number(pubDb.total_count || 0);
      }
    }
  } catch (eDbFiles) {}

  // 3. Intégration des fichiers détectés dans les profils utilisateurs
  if (Array.isArray(detailedUsers)) {
    let usersR2Bytes = 0;
    let usersR2Count = 0;
    for (const u of detailedUsers) {
      const r2f = u?.storage?.r2?.folders;
      if (r2f) {
        for (const [k, v] of Object.entries(r2f)) {
          usersR2Bytes += Number(v?.bytes || 0);
          usersR2Count += Number(v?.count || 0);
          if (!bucketScanned && folders[k]) {
            folders[k].bytes = Math.max(folders[k].bytes, Number(v?.bytes || 0));
            folders[k].count = Math.max(folders[k].count, Number(v?.count || 0));
          }
        }
      }
    }
    dbFilesBytes = Math.max(dbFilesBytes, usersR2Bytes);
    dbFilesCount = Math.max(dbFilesCount, usersR2Count);
  }

  if (dbFilesBytes > totalR2Bytes) {
    totalR2Bytes = dbFilesBytes;
    totalR2Files = Math.max(totalR2Files, dbFilesCount);
  }

  for (const f of Object.keys(folders)) {
    folders[f].formatted = formatBytes(folders[f].bytes);
  }

  return {
    totalR2Bytes,
    totalR2Files,
    r2FoldersGlobal: folders,
    r2Meta: R2_FOLDERS_METADATA
  };
}

/**
 * Génère l'application HTML complète du Tableau de Bord (Version 3.0 fluide & optimisée)
 */
function renderDashboardHtml(data) {
  const usersJson = JSON.stringify(data.users).replace(/</g, '\\u003c');
  const summaryJson = JSON.stringify(data.summary).replace(/</g, '\\u003c');
  const globalConfigJson = JSON.stringify(data.globalConfig).replace(/</g, '\\u003c');
  const d1TablesGlobalJson = JSON.stringify(data.d1TablesGlobal).replace(/</g, '\\u003c');
  const r2FoldersGlobalJson = JSON.stringify(data.r2FoldersGlobal).replace(/</g, '\\u003c');
  const tablesMetaJson = JSON.stringify(data.tablesMeta || TABLES_METADATA).replace(/</g, '\\u003c');
  const r2MetaJson = JSON.stringify(data.r2Meta || R2_FOLDERS_METADATA).replace(/</g, '\\u003c');
  const upgradeRequestsJson = JSON.stringify(data.upgradeRequests || []).replace(/</g, '\\u003c');
  const userSubscriptionsJson = JSON.stringify(data.userSubscriptions || []).replace(/</g, '\\u003c');
  const companyProfileJson = JSON.stringify(data.companyProfile || {}).replace(/</g, '\\u003c');
  const storagePlansJson = JSON.stringify(data.storagePlans || []).replace(/</g, '\\u003c');
  const aiPlansJson = JSON.stringify(data.aiPlans || []).replace(/</g, '\\u003c');
  const cp = data.companyProfile || {};
  const safeAttr = (val, fallback = '') => {
    const s = (val !== null && val !== undefined && String(val).trim() !== '') ? String(val) : fallback;
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  const safeHtml = (val, fallback = '') => {
    const s = (val !== null && val !== undefined && String(val).trim() !== '') ? String(val) : fallback;
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  return `<!DOCTYPE html>
<html lang="fr" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StudyCloud - Tableau de Bord Stockage R2 & D1</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          },
          colors: {
            brand: {
              50: '#fff7ed',
              500: '#f97316',
              600: '#ea580c',
              700: '#c2410c',
            }
          }
        }
      }
    }
  </script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    .neo-card {
      background: #111827;
      border: 2px solid #1f2937;
      border-radius: 1rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: #0b0f19; }
    ::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
    .accordion-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .accordion-content.open {
      max-height: 500px;
    }
    .sidebar-drawer {
      transform: translateX(-100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .sidebar-drawer.open {
      transform: translateX(0) !important;
    }
    /* Scrollbars confortables et visibles */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #070b14; }
    ::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #f97316; }
    * { scrollbar-width: thin; scrollbar-color: #374151 #070b14; }
    html, body {
      height: 100vh;
      max-height: 100vh;
      overflow: hidden !important;
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body class="bg-[#070b14] text-slate-100 h-screen max-h-screen overflow-hidden antialiased flex flex-col selection:bg-orange-500 selection:text-white">

  <!-- ==================================================================== -->
  <!-- BARRE SUPÉRIEURE DE NAVIGATION (STICKY ET TOUJOURS ACCESSIBLE) -->
  <!-- ==================================================================== -->
  <header class="sticky top-0 h-[60px] bg-[#0c1220]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
    <div class="flex items-center gap-3">
      <!-- Bouton 3 traits (Menu Hamburger) -->
      <button 
        type="button"
        id="btn-hamburger"
        onclick="toggleSidebar()"
        class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95 z-30"
        title="Ouvrir le menu latéral"
      >
        <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>

      <!-- Logo & Titre -->
      <div class="flex items-center gap-2.5 cursor-pointer" onclick="switchView('global')">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-black text-white text-base shadow-md shadow-orange-500/20">
          ☁️
        </div>
        <div>
          <h1 class="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-2">
            StudyCloud <span class="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30" id="current-view-badge">Stockage R2 & D1</span>
          </h1>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button onclick="manualRefreshLiveStats()" id="btn-manual-refresh" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer">
        <span id="refresh-spinner">🔄</span> <span class="hidden sm:inline">Actualiser</span>
      </button>
      <a href="/api/overview" target="_blank" class="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white transition-all shadow-md shadow-orange-600/30 flex items-center gap-1.5">
        <span>📡</span> <span class="hidden sm:inline">API JSON</span>
      </a>
    </div>
  </header>

  <!-- ==================================================================== -->
  <!-- MENU LATÉRAL GAUCHE FLUIDE (DRAWER) -->
  <!-- ==================================================================== -->
  <div id="sidebar-backdrop" onclick="toggleSidebar(false)" class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm hidden transition-opacity"></div>
  
  <aside id="sidebar-drawer" class="sidebar-drawer fixed top-0 left-0 bottom-0 z-50 w-72 sm:w-80 bg-[#0f172a] border-r border-slate-800 flex flex-col shadow-2xl">
    <div class="p-4 border-b border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-black text-sm">
          SC
        </div>
        <span class="font-extrabold text-white text-sm">Menu d'Administration</span>
      </div>
      <button type="button" onclick="toggleSidebar(false)" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer">
        ✕
      </button>
    </div>

    <nav class="p-3 space-y-1.5 flex-1 overflow-y-auto text-xs font-bold">
      <button 
        onclick="switchView('global')" 
        id="nav-btn-global"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-orange-600 text-white font-bold transition-all text-left shadow-md shadow-orange-600/20 cursor-pointer"
      >
        <span class="text-base">📊</span>
        <span>Vue d'ensemble Globale</span>
      </button>

      <button 
        onclick="switchView('users')" 
        id="nav-btn-users"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
      >
        <span class="text-base">👥</span>
        <span>Tout les Utilisateurs</span>
      </button>

      <button 
        onclick="switchView('demandes')" 
        id="nav-btn-demandes"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
      >
        <span class="text-base">📥</span>
        <span>Demande de stockage</span>
      </button>

      <button 
        onclick="switchView('demandes-ia')" 
        id="nav-btn-demandes-ia"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
      >
        <span class="text-base">🤖</span>
        <span>Demandes de crédits IA</span>
      </button>

      <button 
        onclick="switchView('distribution')" 
        id="nav-btn-distribution"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
      >
        <span class="text-base">🎁</span>
        <span>Distribution de stockage</span>
      </button>

      <button 
        onclick="switchView('messages')" 
        id="nav-btn-messages"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
      >
        <span class="text-base">💬</span>
        <span>Messages des utilisateurs</span>
      </button>

      <button 
        onclick="switchView('signalements')" 
        id="nav-btn-signalements"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
      >
        <span class="text-base">🚩</span>
        <span>Signalements & Retours</span>
      </button>

      <button 
        onclick="switchView('abonnements')" 
        id="nav-btn-abonnements"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
      >
        <span class="text-base">💳</span>
        <span>Abonnements & Forfaits</span>
      </button>

      <button 
        onclick="switchView('statistiques')" 
        id="nav-btn-statistiques"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
      >
        <span class="text-base">📊</span>
        <span>Statistiques & Métriques</span>
      </button>

      <button 
        onclick="switchView('profil-pro')" 
        id="nav-btn-profil-pro"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
      >
        <span class="text-base">💼</span>
        <span>Informations professionnelles</span>
      </button>
    </nav>

    <div class="p-3.5 border-t border-slate-800 text-[11px] text-slate-500">
      StudyCloud • DKD Technologies
    </div>
  </aside>

  <!-- ==================================================================== -->
  <!-- ZONE PRINCIPALE DE CONTENU SANS ESPACE VIDE ET PARFAITEMENT SCROLLABLE -->
  <!-- ==================================================================== -->
  <main class="h-[calc(100vh-60px)] max-h-[calc(100vh-60px)] w-full max-w-[1700px] mx-auto p-2 sm:p-3 flex flex-col min-h-0 overflow-hidden">

    <!-- ================================================================== -->
    <!-- VUE 1 : ACCUEIL / VUE D'ENSEMBLE GLOBALE (DÉFILEMENT NATUREL) -->
    <!-- ================================================================== -->
    <div id="view-global" class="w-full h-full overflow-y-auto space-y-5 pb-12 pr-1 overscroll-contain" style="display: block;">

      <!-- 4 CARRÉS EN HAUT : STATISTIQUES GLOBALES -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        
        <div class="neo-card p-3.5 sm:p-4 flex flex-col justify-between border-l-4 border-l-blue-500">
          <div class="flex items-center justify-between text-slate-400 text-[11px] font-bold mb-1">
            <span>UTILISATEURS</span>
            <span class="text-sm">👥</span>
          </div>
          <div>
            <div id="stat-total-users" class="text-xl sm:text-2xl font-black text-white">${data.summary.totalUsers}</div>
            <div class="text-[10px] text-blue-400 mt-0.5 font-medium">Comptes enregistrés dans D1</div>
          </div>
        </div>

        <div class="neo-card p-3.5 sm:p-4 flex flex-col justify-between border-l-4 border-l-orange-500">
          <div class="flex items-center justify-between text-slate-400 text-[11px] font-bold mb-1">
            <span>VOLUME R2 (FICHIERS)</span>
            <span class="text-sm">📦</span>
          </div>
          <div>
            <div id="stat-volume-r2" class="text-xl sm:text-2xl font-black text-orange-400">${data.summary.totalR2Formatted}</div>
            <div class="text-[10px] text-slate-400 mt-0.5 font-medium">
              Limite Cloudflare : <span class="text-white font-bold">10 Go gratuits</span>
            </div>
          </div>
        </div>

        <div class="neo-card p-3.5 sm:p-4 flex flex-col justify-between border-l-4 border-l-emerald-500">
          <div class="flex items-center justify-between text-slate-400 text-[11px] font-bold mb-1">
            <span>VOLUME D1 (BASE SQL)</span>
            <span class="text-sm">🗄️</span>
          </div>
          <div>
            <div id="stat-volume-d1" class="text-xl sm:text-2xl font-black text-emerald-400">${data.summary.totalD1Formatted}</div>
            <div class="text-[10px] text-slate-400 mt-0.5 font-medium">
              Limite Cloudflare : <span class="text-white font-bold">5 Go gratuits</span>
            </div>
          </div>
        </div>

        <div class="neo-card p-3.5 sm:p-4 flex flex-col justify-between border-l-4 border-l-purple-500">
          <div class="flex items-center justify-between text-slate-400 text-[11px] font-bold mb-1">
            <span>COÛT CLOUDFLARE ESTIMÉ</span>
            <span class="text-sm">💰</span>
          </div>
          <div>
            <div class="text-xl sm:text-2xl font-black text-purple-400">0,00 $ / mois</div>
            <div class="text-[10px] text-purple-300 mt-0.5 font-medium">Inclus dans les quotas gratuits</div>
          </div>
        </div>

      </div>

      <!-- TROIS LIGNES DE PROGRESSION DE LA CONSOMMATION GLOBALE -->
      <div class="neo-card p-4 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1 border-b border-slate-800/60">
          <h3 class="text-xs font-bold text-white flex items-center gap-1.5">
            <span>📈</span> Progression de la Consommation Réelle de l'Application
          </h3>
          <span id="live-indicator-badge" class="text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Écoute en direct Cloudflare D1 & R2
          </span>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">1. Consommation Globale (R2 + D1 combiné)</span>
            <span id="bar-global-label" class="font-mono text-orange-400 font-bold">${data.summary.totalStorageFormatted} / 15 Go (${((data.summary.totalStorageBytes / (15 * 1024 * 1024 * 1024)) * 100).toFixed(3)}%)</span>
          </div>
          <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div id="bar-global-fill" class="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500" style="width: ${Math.max(1, Math.min(100, (data.summary.totalStorageBytes / (15 * 1024 * 1024 * 1024)) * 100))}%;"></div>
          </div>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">2. Consommation Cloudflare R2 (Fichiers & Documents)</span>
            <span id="bar-r2-label" class="font-mono text-blue-400 font-bold">${data.summary.totalR2Formatted} / 10 Go gratuits (${((data.summary.totalR2Bytes / (10 * 1024 * 1024 * 1024)) * 100).toFixed(3)}%)</span>
          </div>
          <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div id="bar-r2-fill" class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500" style="width: ${Math.max(1, Math.min(100, (data.summary.totalR2Bytes / (10 * 1024 * 1024 * 1024)) * 100))}%;"></div>
          </div>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">3. Consommation Cloudflare D1 (Base SQLite & Données Texte)</span>
            <span id="bar-d1-label" class="font-mono text-emerald-400 font-bold">${data.summary.totalD1Formatted} / 5 Go gratuits (${((data.summary.totalD1Bytes / (5 * 1024 * 1024 * 1024)) * 100).toFixed(3)}%)</span>
          </div>
          <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div id="bar-d1-fill" class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" style="width: ${Math.max(1, Math.min(100, (data.summary.totalD1Bytes / (5 * 1024 * 1024 * 1024)) * 100))}%;"></div>
          </div>
        </div>
      </div>

      <!-- BARRE DE RECHERCHE -->
      <div class="relative w-full">
        <input 
          type="text" 
          id="global-search-input" 
          placeholder="Rechercher une table D1 ou un dossier R2 (nom, rôle, connexion UI...)" 
          oninput="filterGlobalTables()"
          class="w-full bg-[#111827] text-slate-200 placeholder-slate-500 text-xs sm:text-sm rounded-xl px-4 py-2.5 pl-10 border border-slate-700 focus:outline-none focus:border-orange-500 transition-colors shadow-sm"
        >
        <span class="absolute left-3.5 top-3 text-slate-500 text-xs">🔍</span>
      </div>

      <!-- SECTION TABLES CLOUDFLARE D1 (ACCORDÉONS) -->
      <div class="neo-card overflow-hidden">
        <div class="px-4 py-3 bg-[#0d1424] border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-xs sm:text-sm font-bold text-emerald-400 flex items-center gap-2">
            <span>🗄️</span> Tables Base de Données Cloudflare D1
            <span id="d1-tables-count-badge" class="text-xs font-normal text-slate-400">(${(data.tablesMeta || TABLES_METADATA).length} tables répertoriées)</span>
          </h3>
          <span class="text-[11px] text-slate-400 hidden sm:inline">Cliquez sur une table pour dérouler ses détails</span>
        </div>
        <div id="d1-tables-accordion-list" class="divide-y divide-slate-800/80"></div>
      </div>

      <!-- SECTION DOSSIERS CLOUDFLARE R2 (ACCORDÉONS) -->
      <div class="neo-card overflow-hidden">
        <div class="px-4 py-3 bg-[#0d1424] border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-xs sm:text-sm font-bold text-orange-400 flex items-center gap-2">
            <span>📦</span> Dossiers Stockage Objets Cloudflare R2
            <span id="r2-folders-count-badge" class="text-xs font-normal text-slate-400">(${(data.r2Meta || R2_FOLDERS_METADATA).length} dossiers structurés)</span>
          </h3>
          <span class="text-[11px] text-slate-400 hidden sm:inline">Cliquez sur un dossier pour dérouler ses détails</span>
        </div>
        <div id="r2-folders-accordion-list" class="divide-y divide-slate-800/80"></div>
      </div>

    </div>

    <!-- ================================================================== -->
    <!-- VUE 2 : TOUT LES UTILISATEURS (DIVISÉE EN 2, COLONNES SCROLLABLES INDÉPENDANTES, PAGE FIXE) -->
    <!-- ================================================================== -->
    <div id="view-users" class="hidden w-full h-full flex flex-col min-h-0 overflow-hidden">
      <!-- DEUX COLONNES SCROLLABLES INDÉPENDANTES (LA PAGE EXTÉRIEURE NE BOUGE PAS) -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3 h-full min-h-0 overflow-hidden">
        
        <!-- COLONNE GAUCHE (4/12) : LISTE DES NOMS SCROLLABLE INDÉPENDANTE -->
        <div class="md:col-span-4 neo-card h-full flex flex-col min-h-0 overflow-hidden">
          <div class="p-2.5 border-b border-slate-800 shrink-0">
            <input 
              type="text" 
              id="users-search-left" 
              placeholder="Filtrer nom, numéro, école..." 
              oninput="filterUsersLeft()"
              class="w-full bg-slate-900 text-slate-200 placeholder-slate-500 text-xs rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-orange-500"
            >
          </div>
          <!-- ÉLÉMENTS SCROLLABLES GAUCHE (UNIQUEMENT LA LISTE QUI DÉFILE) -->
          <div id="users-left-list" class="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/60 text-xs font-medium overscroll-contain"></div>
        </div>

        <!-- COLONNE DROITE (8/12) : DÉTAILS COMPLETS ET DONNÉES SCROLLABLES INDÉPENDANTS -->
        <!-- ÉLÉMENTS SCROLLABLES DROITE (UNIQUEMENT LE CONTENU QUI DÉFILE) -->
        <div class="md:col-span-8 neo-card p-4 space-y-4 h-full min-h-0 overflow-y-auto overscroll-contain" id="user-details-right-panel"></div>

      </div>
    </div>

    <!-- ================================================================== -->
    <!-- VUE 3 : DEMANDES DE STOCKAGE (NOUVEAU MENU : VALIDATION, REÇUS R2, HISTORIQUE & ABONNEMENTS) -->
    <!-- ================================================================== -->
    <div id="view-demandes" class="hidden w-full h-full flex flex-col min-h-0 overflow-hidden">
      <!-- DEUX COLONNES SCROLLABLES INDÉPENDANTES (LA PAGE EXTÉRIEURE NE BOUGE PAS) -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3 h-full min-h-0 overflow-hidden">
        
        <!-- COLONNE GAUCHE (4/12) : FILTRES, RECHERCHE ET LISTE DÉFILANTE -->
        <div class="md:col-span-4 neo-card h-full flex flex-col min-h-0 overflow-hidden">
          
          <!-- Filtres onglets en haut -->
          <div class="p-2.5 border-b border-slate-800 space-y-2 shrink-0">
            <div class="grid grid-cols-2 gap-1 text-[11px] font-bold">
              <button 
                onclick="setDemandesTab('pending')" 
                id="demande-tab-pending"
                class="px-2 py-1.5 rounded-lg bg-orange-600 text-white flex items-center justify-between transition-all cursor-pointer shadow-sm"
              >
                <span>🟡 En attente</span>
                <span id="tab-count-pending" class="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">0</span>
              </button>
              <button 
                onclick="setDemandesTab('active')" 
                id="demande-tab-active"
                class="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700/80 flex items-center justify-between transition-all cursor-pointer"
              >
                <span>🟢 Abonnés</span>
                <span id="tab-count-active" class="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">0</span>
              </button>
              <button 
                onclick="setDemandesTab('cancelled')" 
                id="demande-tab-cancelled"
                class="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700/80 flex items-center justify-between transition-all cursor-pointer"
              >
                <span>🔴 Annulés</span>
                <span id="tab-count-cancelled" class="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">0</span>
              </button>
              <button 
                onclick="setDemandesTab('all')" 
                id="demande-tab-all"
                class="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700/80 flex items-center justify-between transition-all cursor-pointer"
              >
                <span>👥 Tous</span>
                <span id="tab-count-all" class="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">0</span>
              </button>
            </div>

            <!-- Barre de recherche -->
            <div class="relative">
              <input 
                type="text" 
                id="demandes-search-input" 
                placeholder="Rechercher nom, numéro, offre..." 
                oninput="filterDemandesLeft()"
                class="w-full bg-slate-900 text-slate-200 placeholder-slate-500 text-xs rounded-lg px-3 py-2 pl-8 border border-slate-700 focus:outline-none focus:border-orange-500"
              >
              <span class="absolute left-2.5 top-2.5 text-slate-500 text-xs">🔍</span>
            </div>

            <div class="flex items-center justify-between text-[10px] text-slate-400">
              <span id="demandes-filter-label" class="font-medium text-amber-400">Demandes en attente de validation</span>
            </div>
          </div>

          <!-- LISTE SCROLLABLE GAUCHE (PAGE FIXE, SEULE LA LISTE DÉFILE) -->
          <div id="demandes-left-items-list" class="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/60 text-xs font-medium overscroll-contain"></div>
        </div>

        <!-- COLONNE DROITE (8/12) : DÉTAILS DEMANDE, REÇU R2, OPTIONS 3 TRAITS, ACTIONS ADMIN -->
        <div class="md:col-span-8 neo-card p-4 space-y-4 h-full min-h-0 overflow-y-auto overscroll-contain" id="demandes-right-detail-panel">
          <div class="h-full flex flex-col items-center justify-center text-center text-slate-500 py-20">
            <div class="w-16 h-16 rounded-2xl bg-slate-800/60 text-3xl flex items-center justify-center mb-3">📥</div>
            <h3 class="text-sm font-bold text-slate-300">Aucune demande ou abonnement sélectionné</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-sm">Choisissez un élément dans la colonne de gauche pour afficher les informations de l'étudiant, l'offre souscrite, le reçu de paiement et allouer le stockage.</p>
          </div>
        </div>

      </div>
    </div>

    <!-- ================================================================== -->
    <!-- VUE : DEMANDES DE CRÉDITS IA (VALIDATION, REÇUS R2, ATTRIBUTION DE MOTS IA) -->
    <!-- ================================================================== -->
    <div id="view-demandes-ia" class="hidden w-full h-full flex flex-col min-h-0 overflow-hidden">
      <!-- DEUX COLONNES SCROLLABLES INDÉPENDANTES (PAGE FIXE) -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3 h-full min-h-0 overflow-hidden">
        
        <!-- COLONNE GAUCHE (4/12) : FILTRES ONGLETS, RECHERCHE ET LISTE DÉFILANTE -->
        <div class="md:col-span-4 neo-card h-full flex flex-col min-h-0 overflow-hidden">
          
          <!-- Filtres onglets en haut -->
          <div class="p-2.5 border-b border-slate-800 space-y-2 shrink-0">
            <div class="grid grid-cols-2 gap-1 text-[11px] font-bold">
              <button 
                onclick="setDemandesIaTab('pending')" 
                id="demande-ia-tab-pending"
                class="px-2 py-1.5 rounded-lg bg-orange-600 text-white flex items-center justify-between transition-all cursor-pointer shadow-sm"
              >
                <span>🟡 En attente</span>
                <span id="tab-ia-count-pending" class="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">0</span>
              </button>
              <button 
                onclick="setDemandesIaTab('active')" 
                id="demande-ia-tab-active"
                class="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700/80 flex items-center justify-between transition-all cursor-pointer"
              >
                <span>🟢 Validés</span>
                <span id="tab-ia-count-active" class="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">0</span>
              </button>
              <button 
                onclick="setDemandesIaTab('cancelled')" 
                id="demande-ia-tab-cancelled"
                class="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700/80 flex items-center justify-between transition-all cursor-pointer"
              >
                <span>🔴 Refusés</span>
                <span id="tab-ia-count-cancelled" class="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">0</span>
              </button>
              <button 
                onclick="setDemandesIaTab('all')" 
                id="demande-ia-tab-all"
                class="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700/80 flex items-center justify-between transition-all cursor-pointer"
              >
                <span>👥 Tous</span>
                <span id="tab-ia-count-all" class="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono">0</span>
              </button>
            </div>

            <!-- Barre de recherche -->
            <div class="relative">
              <input 
                type="text" 
                id="demandes-ia-search-input" 
                placeholder="Rechercher nom, numéro, pack IA..." 
                oninput="filterDemandesIaLeft()"
                class="w-full bg-slate-900 text-slate-200 placeholder-slate-500 text-xs rounded-lg px-3 py-2 pl-8 border border-slate-700 focus:outline-none focus:border-orange-500"
              >
              <span class="absolute left-2.5 top-2.5 text-slate-500 text-xs">🔍</span>
            </div>

            <div class="flex items-center justify-between text-[10px] text-slate-400">
              <span id="demandes-ia-filter-label" class="font-medium text-amber-400">Demandes de crédits IA en attente de validation</span>
            </div>
          </div>

          <!-- LISTE SCROLLABLE GAUCHE (PAGE FIXE, SEULE LA LISTE DÉFILE) -->
          <div id="demandes-ia-left-items-list" class="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/60 text-xs font-medium overscroll-contain"></div>
        </div>

        <!-- COLONNE DROITE (8/12) : DÉTAILS DEMANDE IA, REÇU R2, VALIDATION & ALLOCATION -->
        <div class="md:col-span-8 neo-card p-4 space-y-4 h-full min-h-0 overflow-y-auto overscroll-contain" id="demandes-ia-right-detail-panel">
          <div class="h-full flex flex-col items-center justify-center text-center text-slate-500 py-20">
            <div class="w-16 h-16 rounded-2xl bg-slate-800/60 text-3xl flex items-center justify-center mb-3">🤖</div>
            <h3 class="text-sm font-bold text-slate-300">Aucune demande de crédits IA sélectionnée</h3>
            <p class="text-xs text-slate-500 mt-1 max-w-sm">Choisissez un élément dans la colonne de gauche pour afficher les informations de l'étudiant, le pack IA souscrit, le reçu de paiement et allouer les crédits IA.</p>
          </div>
        </div>

      </div>
    </div>

    <!-- ================================================================== -->
    <!-- VUE 4 : DISTRIBUTION DE STOCKAGE (ANCIEN : BIENVENUE 30 MO & AJUSTEMENT QUOTAS) -->
    <!-- ================================================================== -->
    <div id="view-distribution" class="hidden w-full h-full flex flex-col space-y-2 min-h-0 overflow-hidden">
      
      <!-- BANNIÈRE EN HAUT : PARAMÈTRES DU STOCKAGE DE BIENVENUE POUR TOUS -->
      <div class="neo-card p-2.5 sm:p-3 bg-gradient-to-r from-slate-900 via-[#131b2e] to-slate-900 border-l-4 border-l-orange-500 shrink-0">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 class="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>🎁</span> Paramètres Globaux : Stockage de Bienvenue Automatique à l'Inscription
            </h4>
            <p class="text-[10px] text-slate-400 mt-0.5">Quota global attribué automatiquement à tout nouvel utilisateur (partagé librement entre fichiers et base de données, sans limiteur individuel). S'applique à tous les utilisateurs actuels et futurs.</p>
          </div>

          <div class="flex items-center gap-2 flex-wrap shrink-0">
            <div class="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              <span class="text-[10px] text-slate-400 font-bold">Nouveau quota :</span>
              <input type="number" id="global-cfg-total" class="w-20 bg-slate-900 text-orange-400 font-bold font-mono text-xs px-2 py-0.5 rounded border border-slate-600 text-center" value="${data.globalConfig?.default_welcome_total_mb ?? ((data.globalConfig?.default_welcome_r2_mb ?? 10) + (data.globalConfig?.default_welcome_d1_mb ?? 20))}" oninput="document.getElementById('users-welcome-input').value=this.value">
              <input type="hidden" id="users-welcome-input" value="${data.globalConfig?.default_welcome_total_mb ?? 30}">
              <span class="text-[10px] text-slate-400 font-bold">Mo</span>
            </div>

            <button 
              onclick="saveGlobalWelcomeConfig()" 
              class="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-orange-600/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>💾</span> Enregistrer
            </button>

            <button 
              onclick="applyWelcomeStorageToAllUsers()" 
              class="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-emerald-700/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
              title="Enregistre ET applique immédiatement à TOUS les utilisateurs existants et futurs"
            >
              <span>⚡</span> Appliquer à tous
            </button>
          </div>
        </div>
      </div>

      <!-- ÉCRAN DIVISÉ EN 2 POUR LA GESTION DES QUOTAS UTILISATEURS -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
        <!-- COLONNE GAUCHE (4/12) : LISTE DES UTILISATEURS SCROLLABLE -->
        <div class="md:col-span-4 neo-card h-full flex flex-col min-h-0 overflow-hidden">
          <div class="p-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-400 shrink-0">
            <span>Utilisateurs & Quotas</span>
            <span class="text-[10px] font-mono text-orange-400">(${data.users.length})</span>
          </div>
          <!-- ÉLÉMENTS SCROLLABLES GAUCHE (UNIQUEMENT LA LISTE QUI DÉFILE) -->
          <div id="distribution-users-left-list" class="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/60 text-xs overscroll-contain"></div>
        </div>

        <!-- COLONNE DROITE (8/12) : FORMULAIRE COMPLET D'AJUSTEMENT DU STOCKAGE SCROLLABLE -->
        <!-- ÉLÉMENTS SCROLLABLES DROITE (UNIQUEMENT LE CONTENU QUI DÉFILE) -->
        <div class="md:col-span-8 neo-card p-4 space-y-4 h-full min-h-0 overflow-y-auto overscroll-contain" id="distribution-right-panel">
          <div class="py-20 text-center text-slate-500 text-xs">
            Sélectionnez un utilisateur sur la gauche pour afficher et ajuster son stockage de bienvenue ou son stockage payant.
          </div>
        </div>
      </div>

    </div>

    <!-- ================================================================== -->
    <!-- VUE 4 : MESSAGES DES UTILISATEURS (DIVISÉE EN 2) -->
    <!-- ================================================================== -->
    <div id="view-messages" class="hidden w-full h-full flex flex-col min-h-0 overflow-hidden">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-3 h-full min-h-0 overflow-hidden">
        <!-- COLONNE GAUCHE (4/12) : LISTE DES UTILISATEURS SCROLLABLE -->
        <div class="md:col-span-4 neo-card h-full flex flex-col min-h-0 overflow-hidden">
          <div class="p-2.5 border-b border-slate-800 text-xs font-bold text-slate-400 shrink-0">
            Utilisateurs inscrits
          </div>
          <!-- ÉLÉMENTS SCROLLABLES GAUCHE (UNIQUEMENT LA LISTE QUI DÉFILE) -->
          <div id="messages-users-left-list" class="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/60 text-xs overscroll-contain"></div>
        </div>

        <!-- COLONNE DROITE (8/12) : MESSAGES SCROLLABLE -->
        <div class="md:col-span-8 neo-card p-8 h-full min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center justify-center text-center text-slate-500">
          <div class="w-16 h-16 rounded-2xl bg-slate-800/60 text-3xl flex items-center justify-center mb-3">💬</div>
          <h3 class="text-sm font-bold text-slate-300">Messagerie et Demandes de Support</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-sm">Cet espace affichera en direct les retours, demandes d'aide et messages envoyés par les étudiants depuis leur application.</p>
        </div>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- VUE 5 : SIGNALEMENTS & RETOURS -->
    <!-- ================================================================== -->
    <div id="view-signalements" class="hidden w-full h-full flex flex-col min-h-0 overflow-hidden">
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div class="neo-card p-6 flex flex-col items-center justify-center text-center text-slate-500 min-h-[300px]">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 text-4xl flex items-center justify-center mb-4">🚩</div>
          <h3 class="text-base font-bold text-slate-200 mb-1">Signalements & Retours</h3>
          <p class="text-xs text-slate-500 max-w-sm mt-1">Ici s'afficheront les signalements de contenu, les retours négatifs et les rapports d'abus envoyés par les étudiants. Fonctionnalité en cours de développement.</p>
          <div class="mt-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">🚧 En développement</div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="neo-card p-4 border-l-4 border-l-red-500">
            <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Signalements</div>
            <div class="text-2xl font-black text-red-400">0</div>
            <div class="text-[10px] text-slate-500 mt-1">Aucun signalement reçu</div>
          </div>
          <div class="neo-card p-4 border-l-4 border-l-amber-500">
            <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">En Attente</div>
            <div class="text-2xl font-black text-amber-400">0</div>
            <div class="text-[10px] text-slate-500 mt-1">Aucun en attente de traitement</div>
          </div>
          <div class="neo-card p-4 border-l-4 border-l-emerald-500">
            <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">Résolus</div>
            <div class="text-2xl font-black text-emerald-400">0</div>
            <div class="text-[10px] text-slate-500 mt-1">Aucun résolu</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- VUE 6 : ABONNEMENTS & FORFAITS -->
    <!-- ================================================================== -->
    <div id="view-abonnements" class="hidden w-full h-full flex flex-col min-h-0 overflow-hidden">
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div class="neo-card p-6 flex flex-col items-center justify-center text-center text-slate-500 min-h-[300px]">
          <div class="w-20 h-20 rounded-2xl bg-purple-500/10 text-4xl flex items-center justify-center mb-4">💳</div>
          <h3 class="text-base font-bold text-slate-200 mb-1">Abonnements & Forfaits</h3>
          <p class="text-xs text-slate-500 max-w-sm mt-1">Gérez ici les forfaits payants, les abonnements actifs et les transactions des étudiants. Fonctionnalité en cours de développement.</p>
          <div class="mt-4 px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold">🚧 En développement</div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="neo-card p-4 border-l-4 border-l-purple-500">
            <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">Abonnés Actifs</div>
            <div class="text-2xl font-black text-purple-400">0</div>
            <div class="text-[10px] text-slate-500 mt-1">Aucun abonnement payant actif</div>
          </div>
          <div class="neo-card p-4 border-l-4 border-l-emerald-500">
            <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">Revenus (Mois)</div>
            <div class="text-2xl font-black text-emerald-400">0 FCFA</div>
            <div class="text-[10px] text-slate-500 mt-1">Aucune transaction ce mois</div>
          </div>
          <div class="neo-card p-4 border-l-4 border-l-orange-500">
            <div class="text-[10px] uppercase font-bold text-slate-400 mb-1">Utilisateurs Gratuits</div>
            <div class="text-2xl font-black text-orange-400">${data.users.length}</div>
            <div class="text-[10px] text-slate-500 mt-1">Sur le plan gratuit</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- VUE 7 : STATISTIQUES & MÉTRIQUES -->
    <!-- ================================================================== -->
    <div id="view-statistiques" class="hidden w-full h-full flex flex-col min-h-0 overflow-hidden">
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="neo-card p-4 border-l-4 border-l-blue-500">
            <div class="text-[10px] uppercase font-bold text-slate-400">Utilisateurs</div>
            <div class="text-2xl font-black text-white mt-1">${data.summary.totalUsers}</div>
            <div class="text-[10px] text-blue-400 mt-0.5">Comptes enregistrés</div>
          </div>
          <div class="neo-card p-4 border-l-4 border-l-orange-500">
            <div class="text-[10px] uppercase font-bold text-slate-400">Stockage R2</div>
            <div class="text-2xl font-black text-orange-400 mt-1">${data.summary.totalR2Formatted}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Fichiers hébergés</div>
          </div>
          <div class="neo-card p-4 border-l-4 border-l-emerald-500">
            <div class="text-[10px] uppercase font-bold text-slate-400">Stockage D1</div>
            <div class="text-2xl font-black text-emerald-400 mt-1">${data.summary.totalD1Formatted}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">${data.summary.totalD1Rows} lignes SQL</div>
          </div>
          <div class="neo-card p-4 border-l-4 border-l-purple-500">
            <div class="text-[10px] uppercase font-bold text-slate-400">Boutiques</div>
            <div class="text-2xl font-black text-purple-400 mt-1">${data.users.filter(u => u.user.hasShop).length}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Boutiques actives</div>
          </div>
        </div>

        <div class="neo-card p-4 space-y-3">
          <h3 class="text-xs font-bold text-white flex items-center gap-2"><span>📊</span> Répartition du Stockage par Utilisateur</h3>
          <div class="divide-y divide-slate-800/60 text-xs">
            ${data.users.slice(0, 20).map(item => '<div class="py-2 flex items-center gap-3"><div class="w-24 truncate font-bold text-white text-[11px]">' + item.user.name + '</div><div class="flex-1"><div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full" style="width: ' + Math.max(1, Math.min(100, item.storage.net ? item.storage.net.usagePercentage : item.storage.usagePercentage)) + '%"></div></div></div><div class="text-[10px] font-mono text-orange-400 shrink-0 w-16 text-right">' + (item.storage.net ? item.storage.net.totalFormatted : item.storage.totalFormatted) + '</div><div class="text-[10px] text-slate-500 shrink-0 w-10 text-right">' + (item.storage.net ? item.storage.net.usagePercentage : item.storage.usagePercentage) + '%</div></div>').join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- VUE 8 : INFORMATIONS PROFESSIONNELLES (GESTION PRO, CONTACTS & COMPTES MARCHANDS) -->
    <!-- ================================================================== -->
    <div id="view-profil-pro" class="hidden w-full h-full overflow-y-auto space-y-5 pb-24 pr-1 overscroll-contain" style="display: none;">
      
      <!-- En-tête / Bannière Informations Professionnelles -->
      <div class="neo-card p-4 bg-gradient-to-r from-slate-900 via-[#131b2e] to-slate-900 border-l-4 border-l-orange-500 shrink-0">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <span>💼</span>
              <span>Informations Professionnelles & Comptes de Réception</span>
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">
              Ces coordonnées sont stockées dans Cloudflare D1. Les numéros Wave, Orange Money, MTN Money et Moov Money configurés ici s'affichent automatiquement aux utilisateurs lors du paiement de leur abonnement.
            </p>
          </div>
          <div class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold shrink-0">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>⚡ Cliquez sur un champ pour le modifier en direct</span>
          </div>
        </div>
      </div>

      <!-- Conteneur structuré en 3 blocs principaux avec édition individuelle par modale -->
      <div id="company-profile-container" class="space-y-5">
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          <!-- BLOC 1 : IDENTITÉ DE L'ENTREPRISE & LOCALISATION -->
          <div class="neo-card p-4 sm:p-5 space-y-4">
            <div class="border-b border-slate-800 pb-3 flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
              <span class="text-base">🏢</span>
              <span>Identité de l'Entreprise & Localisation</span>
            </div>

            <!-- Nom de la société -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-slate-300 block">Nom de la société / Entreprise *</label>
                <span class="text-[10px] text-orange-400/80 hover:text-orange-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-company-name', 'Nom de la société / Entreprise', 'company_name', 'text')">
                  <span>✏️</span> <span>Modifier</span>
                </span>
              </div>
              <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-company-name', 'Nom de la société / Entreprise', 'company_name', 'text')">
                <input 
                  type="text" 
                  id="pro-company-name" 
                  value="${safeAttr(cp.company_name, "DKD Technologies")}"
                  placeholder="Ex: DKD Technologies" 
                  readonly
                  class="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 pr-20 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none"
                >
                <div id="spinner-pro-company-name" class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs pointer-events-none">
                  <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                </div>
              </div>
            </div>

            <!-- Où on est situé (Localisation) -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-slate-300 block">Où on est situé (Ville / Pays) *</label>
                <span class="text-[10px] text-orange-400/80 hover:text-orange-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-location', 'Où on est situé (Ville / Pays)', 'location', 'text')">
                  <span>✏️</span> <span>Modifier</span>
                </span>
              </div>
              <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-location', 'Où on est situé (Ville / Pays)', 'location', 'text')">
                <input 
                  type="text" 
                  id="pro-location" 
                  value="${safeAttr(cp.location, "Abidjan, Côte d'Ivoire")}"
                  placeholder="Ex: Abidjan, Côte d'Ivoire" 
                  readonly
                  class="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 pr-20 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none"
                >
                <div id="spinner-pro-location" class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs pointer-events-none">
                  <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                </div>
              </div>
            </div>

            <!-- Notre activité -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-slate-300 block">Notre activité / Domaine d'expertise *</label>
                <span class="text-[10px] text-orange-400/80 hover:text-orange-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-activity', 'Notre activité / Domaine d\'expertise', 'activity', 'text')">
                  <span>✏️</span> <span>Modifier</span>
                </span>
              </div>
              <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-activity', 'Notre activité / Domaine d\'expertise', 'activity', 'text')">
                <input 
                  type="text" 
                  id="pro-activity" 
                  value="${safeAttr(cp.activity, "Technologies & Éducation Numérique")}"
                  placeholder="Ex: Technologies, Logiciels & Éducation Numérique" 
                  readonly
                  class="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 pr-20 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none"
                >
                <div id="spinner-pro-activity" class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs pointer-events-none">
                  <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                </div>
              </div>
            </div>

            <!-- Adresse physique / Siège -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-slate-300 block">Adresse physique / Quartier / Siège</label>
                <span class="text-[10px] text-orange-400/80 hover:text-orange-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-address', 'Adresse physique / Quartier / Siège', 'address', 'text')">
                  <span>✏️</span> <span>Modifier</span>
                </span>
              </div>
              <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-address', 'Adresse physique / Quartier / Siège', 'address', 'text')">
                <input 
                  type="text" 
                  id="pro-address" 
                  value="${safeAttr(cp.address, "Abidjan, Côte d'Ivoire")}"
                  placeholder="Ex: Cocody Angré, Abidjan" 
                  readonly
                  class="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 pr-20 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none"
                >
                <div id="spinner-pro-address" class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs pointer-events-none">
                  <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                </div>
              </div>
            </div>

            <!-- Site web & Email officiel -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="space-y-1">
                <div class="flex items-center justify-between">
                  <label class="text-[11px] font-bold text-slate-300 block">Site web officiel</label>
                  <span class="text-[10px] text-orange-400/80 hover:text-orange-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-website', 'Site web officiel', 'website', 'url')">
                    <span>✏️</span>
                  </span>
                </div>
                <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-website', 'Site web officiel', 'website', 'url')">
                  <input 
                    type="text" 
                    id="pro-website" 
                    value="${safeAttr(cp.website, "https://studycloud.dkd-technologies.com")}"
                    placeholder="https://..." 
                    readonly
                    class="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 pr-14 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none"
                  >
                  <div id="spinner-pro-website" class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs pointer-events-none">
                    <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                  </div>
                </div>
              </div>
              <div class="space-y-1">
                <div class="flex items-center justify-between">
                  <label class="text-[11px] font-bold text-slate-300 block">Email professionnel</label>
                  <span class="text-[10px] text-orange-400/80 hover:text-orange-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-email', 'Email professionnel', 'email', 'email')">
                    <span>✏️</span>
                  </span>
                </div>
                <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-email', 'Email professionnel', 'email', 'email')">
                  <input 
                    type="email" 
                    id="pro-email" 
                    value="${safeAttr(cp.email, "contact@dkd-technologies.com")}"
                    placeholder="contact@..." 
                    readonly
                    class="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 pr-14 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none"
                  >
                  <div id="spinner-pro-email" class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs pointer-events-none">
                    <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- BLOC 2 : VOS DIFFÉRENTS NUMÉROS DE CONTACT DIRECT -->
          <div class="neo-card p-4 sm:p-5 space-y-4">
            <div class="border-b border-slate-800 pb-3 flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
              <span class="text-base">📞</span>
              <span>Vos Différents Numéros de Contact Direct</span>
            </div>

            <!-- Numéro d'appel / SMS principal -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-slate-300 block">Numéro d'appel officiel (Appels / SMS) *</label>
                <span class="text-[10px] text-orange-400/80 hover:text-orange-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-phone-contact', 'Numéro d\'appel officiel', 'phone_contact', 'text')">
                  <span>✏️</span> <span>Modifier</span>
                </span>
              </div>
              <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-phone-contact', 'Numéro d\'appel officiel', 'phone_contact', 'text')">
                <input 
                  type="text" 
                  id="pro-phone-contact" 
                  value="${safeAttr(cp.phone_contact, "+225 0101007978")}"
                  placeholder="Ex: +225 0101007978" 
                  readonly
                  class="w-full bg-slate-900 text-white font-mono text-xs rounded-xl px-3.5 py-2.5 pr-20 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none"
                >
                <div id="spinner-pro-phone-contact" class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs pointer-events-none">
                  <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                </div>
              </div>
              <span class="text-[10px] text-slate-500">Numéro principal de service client.</span>
            </div>

            <!-- Numéro WhatsApp professionnel -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-emerald-400 block flex items-center gap-1">
                  <span>💬</span> <span>Numéro WhatsApp officiel *</span>
                </label>
                <span class="text-[10px] text-emerald-400 hover:text-emerald-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-phone-whatsapp', 'Numéro WhatsApp officiel', 'phone_whatsapp', 'text')">
                  <span>✏️</span> <span>Modifier</span>
                </span>
              </div>
              <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-phone-whatsapp', 'Numéro WhatsApp officiel', 'phone_whatsapp', 'text')">
                <input 
                  type="text" 
                  id="pro-phone-whatsapp" 
                  value="${safeAttr(cp.phone_whatsapp, "+225 0101007978")}"
                  placeholder="Ex: +225 0101007978" 
                  readonly
                  class="w-full bg-slate-900 text-white font-mono text-xs rounded-xl px-3.5 py-2.5 pr-20 border border-slate-700 hover:border-emerald-500/60 transition cursor-pointer select-none"
                >
                <div id="spinner-pro-phone-whatsapp" class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs pointer-events-none">
                  <span class="text-slate-500 group-hover:text-emerald-400 transition text-xs">✏️</span>
                </div>
              </div>
              <span class="text-[10px] text-slate-500">Permet aux étudiants de vous contacter directement sur WhatsApp.</span>
            </div>

            <!-- Numéro secondaire optionnel -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-slate-300 block">Numéro de secours / Ligne secondaire (Facultatif)</label>
                <span class="text-[10px] text-orange-400/80 hover:text-orange-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-phone-secondary', 'Numéro secondaire', 'phone_contact_secondary', 'text')">
                  <span>✏️</span> <span>Modifier</span>
                </span>
              </div>
              <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-phone-secondary', 'Numéro secondaire', 'phone_contact_secondary', 'text')">
                <input 
                  type="text" 
                  id="pro-phone-secondary" 
                  value="${safeAttr(cp.phone_contact_secondary, "")}"
                  placeholder="Ex: +225 0500000000 (optionnel)" 
                  readonly
                  class="w-full bg-slate-900 text-white font-mono text-xs rounded-xl px-3.5 py-2.5 pr-20 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none"
                >
                <div id="spinner-pro-phone-secondary" class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs pointer-events-none">
                  <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                </div>
              </div>
            </div>

            <!-- Description / À propos de l'entreprise -->
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-slate-300 block">Présentation courte / Informations écrites</label>
                <span class="text-[10px] text-orange-400/80 hover:text-orange-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-about-text', 'Présentation courte / Informations', 'about_text', 'textarea')">
                  <span>✏️</span> <span>Modifier</span>
                </span>
              </div>
              <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-about-text', 'Présentation courte / Informations', 'about_text', 'textarea')">
                <textarea 
                  id="pro-about-text" 
                  rows="3"
                  readonly
                  placeholder="Décrivez votre service, mission ou entreprise..." 
                  class="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 pr-20 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none resize-none"
                >${safeHtml(cp.about_text, "Plateforme d'apprentissage et de gestion documentaire intelligente pour étudiants et professionnels.")}</textarea>
                <div id="spinner-pro-about-text" class="absolute right-3 top-3 flex items-center gap-1 text-xs pointer-events-none">
                  <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- BLOC 3 : COMPTES ET NUMÉROS DE PAIEMENT MOBILE (WAVE, ORANGE, MTN, MOOV DISTINCTS) -->
        <div class="neo-card p-4 sm:p-5 space-y-4">
          <div class="border-b border-slate-800 pb-3 flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2 text-white font-bold text-xs sm:text-sm">
              <span class="text-base">💳</span>
              <span>Numéros Officiels pour Recevoir les Paiements Mobiles</span>
            </div>
            <span class="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold">
              Affichés individuellement aux étudiants lors du réabonnement
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <!-- 1. WAVE -->
            <div class="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 border-t-4 border-t-blue-500 flex flex-col justify-between">
              <div>
                <!-- En-tête Réseau + Switch Activation Réseau -->
                <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span class="text-xs font-black uppercase text-blue-400 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-blue-500"></span> Wave
                  </span>
                  <div class="flex items-center gap-1.5">
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        id="pro-wave-enabled" 
                        ${cp.wave_enabled !== 0 ? 'checked' : ''} 
                        onchange="togglePaymentSetting('wave_enabled', this.checked, 'pro-wave-enabled')" 
                        class="sr-only peer"
                      >
                      <div class="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span class="ml-1.5 text-[10px] font-bold ${cp.wave_enabled !== 0 ? 'text-blue-400' : 'text-slate-500'}" id="status-label-pro-wave-enabled">
                        ${cp.wave_enabled !== 0 ? 'Actif' : 'Inactif'}
                      </span>
                    </label>
                    <div id="spinner-pro-wave-enabled" class="text-xs"></div>
                  </div>
                </div>

                <!-- Options d'affichage : Numéro et/ou Image -->
                <div class="bg-slate-900/90 rounded-xl p-2 border border-slate-800 my-2 space-y-1">
                  <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                    Affichage aux étudiants :
                  </span>
                  <div class="flex flex-col gap-1">
                    <label class="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 p-1 rounded-lg transition">
                      <span class="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                        <span>📞</span> Afficher le numéro
                      </span>
                      <div class="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          id="pro-wave-show-number" 
                          ${cp.wave_show_number !== 0 ? 'checked' : ''} 
                          onchange="togglePaymentSetting('wave_show_number', this.checked, 'pro-wave-show-number')" 
                          class="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        >
                        <div id="spinner-pro-wave-show-number" class="text-[10px]"></div>
                      </div>
                    </label>
                    <label class="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 p-1 rounded-lg transition">
                      <span class="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                        <span>🖼️</span> Afficher la carte / QR
                      </span>
                      <div class="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          id="pro-wave-show-image" 
                          ${cp.wave_show_image !== 0 ? 'checked' : ''} 
                          onchange="togglePaymentSetting('wave_show_image', this.checked, 'pro-wave-show-image')" 
                          class="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        >
                        <div id="spinner-pro-wave-show-image" class="text-[10px]"></div>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Champs Numéro & Titulaire -->
                <div class="space-y-1">
                  <label class="text-[10px] text-slate-400 block font-bold">Numéro Wave :</label>
                  <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-wave-number', 'Numéro Wave de réception', 'wave_number', 'text')">
                    <input 
                      type="text" 
                      id="pro-wave-number" 
                      value="${safeAttr(cp.wave_number, "+225 07 00 00 00 00")}"
                      placeholder="+225 07 00 00 00 00" 
                      readonly
                      class="w-full bg-slate-900 text-white font-mono text-xs rounded-xl px-3 py-2 pr-14 border border-slate-700 hover:border-blue-500/60 transition cursor-pointer select-none font-bold"
                    >
                    <div id="spinner-pro-wave-number" class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-xs pointer-events-none">
                      <span class="text-slate-500 group-hover:text-blue-400 transition text-xs">✏️</span>
                    </div>
                  </div>
                </div>

                <div class="space-y-1 mt-2">
                  <label class="text-[10px] text-slate-400 block font-bold">Titulaire affiché :</label>
                  <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-wave-name', 'Nom du Titulaire Wave', 'wave_name', 'text')">
                    <input 
                      type="text" 
                      id="pro-wave-name" 
                      value="${safeAttr(cp.wave_name, "StudyCloud CI")}"
                      placeholder="Ex: StudyCloud CI" 
                      readonly
                      class="w-full bg-slate-900 text-slate-300 text-xs rounded-xl px-3 py-2 pr-14 border border-slate-700 hover:border-blue-500/60 transition cursor-pointer select-none"
                    >
                    <div id="spinner-pro-wave-name" class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-xs pointer-events-none">
                      <span class="text-slate-500 group-hover:text-blue-400 transition text-xs">✏️</span>
                    </div>
                  </div>
                </div>

                <!-- ZONE IMAGE CARTE COMMERÇANT / QR CODE (R2) -->
                <div class="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5">
                  <div class="flex items-center justify-between">
                    <label class="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                      <span>🏷️</span>
                      <span>Carte Commerçant / QR :</span>
                    </label>
                    <div id="spinner-pro-wave-image" class="text-[10px]"></div>
                  </div>

                  <input type="file" id="file-pro-wave" accept="image/*" class="hidden" onchange="uploadPaymentImage('wave', event)">

                  <div id="container-img-wave">
                    ${cp.wave_image_url ? `
                      <div class="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                        <img src="${safeAttr(cp.wave_image_url)}" alt="Carte Wave" class="w-full h-24 object-contain bg-slate-950 p-1 cursor-pointer" onclick="openImageZoomModal('${safeAttr(cp.wave_image_url)}', 'Carte Commerçant / QR Wave')" />
                        <div class="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button type="button" onclick="document.getElementById('file-pro-wave').click()" class="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold shadow cursor-pointer">
                            Changer
                          </button>
                          <button type="button" onclick="deletePaymentImage('wave')" class="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold shadow cursor-pointer">
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ` : `
                      <button type="button" onclick="document.getElementById('file-pro-wave').click()" class="w-full py-2.5 px-2 border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-blue-300 flex flex-col items-center justify-center gap-1 transition cursor-pointer text-center">
                        <span class="text-base">📸</span>
                        <span class="text-[10px] font-bold">+ Ajouter Carte / QR</span>
                        <span class="text-[8px] text-slate-500">PNG, JPG, WEBP (R2)</span>
                      </button>
                    `}
                  </div>
                </div>

              </div>
            </div>

            <!-- 2. ORANGE MONEY -->
            <div class="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 border-t-4 border-t-orange-500 flex flex-col justify-between">
              <div>
                <!-- En-tête Réseau + Switch Activation Réseau -->
                <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span class="text-xs font-black uppercase text-orange-400 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-orange-500"></span> Orange Money
                  </span>
                  <div class="flex items-center gap-1.5">
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        id="pro-orange-enabled" 
                        ${cp.orange_enabled !== 0 ? 'checked' : ''} 
                        onchange="togglePaymentSetting('orange_enabled', this.checked, 'pro-orange-enabled')" 
                        class="sr-only peer"
                      >
                      <div class="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-orange-600"></div>
                      <span class="ml-1.5 text-[10px] font-bold ${cp.orange_enabled !== 0 ? 'text-orange-400' : 'text-slate-500'}" id="status-label-pro-orange-enabled">
                        ${cp.orange_enabled !== 0 ? 'Actif' : 'Inactif'}
                      </span>
                    </label>
                    <div id="spinner-pro-orange-enabled" class="text-xs"></div>
                  </div>
                </div>

                <!-- Options d'affichage : Numéro et/ou Image -->
                <div class="bg-slate-900/90 rounded-xl p-2 border border-slate-800 my-2 space-y-1">
                  <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                    Affichage aux étudiants :
                  </span>
                  <div class="flex flex-col gap-1">
                    <label class="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 p-1 rounded-lg transition">
                      <span class="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                        <span>📞</span> Afficher le numéro
                      </span>
                      <div class="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          id="pro-orange-show-number" 
                          ${cp.orange_show_number !== 0 ? 'checked' : ''} 
                          onchange="togglePaymentSetting('orange_show_number', this.checked, 'pro-orange-show-number')" 
                          class="rounded border-slate-700 text-orange-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        >
                        <div id="spinner-pro-orange-show-number" class="text-[10px]"></div>
                      </div>
                    </label>
                    <label class="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 p-1 rounded-lg transition">
                      <span class="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                        <span>🖼️</span> Afficher la carte / QR
                      </span>
                      <div class="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          id="pro-orange-show-image" 
                          ${cp.orange_show_image !== 0 ? 'checked' : ''} 
                          onchange="togglePaymentSetting('orange_show_image', this.checked, 'pro-orange-show-image')" 
                          class="rounded border-slate-700 text-orange-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        >
                        <div id="spinner-pro-orange-show-image" class="text-[10px]"></div>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Champs Numéro & Titulaire -->
                <div class="space-y-1">
                  <label class="text-[10px] text-slate-400 block font-bold">Numéro Orange :</label>
                  <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-orange-number', 'Numéro Orange de réception', 'orange_number', 'text')">
                    <input 
                      type="text" 
                      id="pro-orange-number" 
                      value="${safeAttr(cp.orange_number, "+225 07 00 00 00 00")}"
                      placeholder="+225 07 00 00 00 00" 
                      readonly
                      class="w-full bg-slate-900 text-white font-mono text-xs rounded-xl px-3 py-2 pr-14 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none font-bold"
                    >
                    <div id="spinner-pro-orange-number" class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-xs pointer-events-none">
                      <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                    </div>
                  </div>
                </div>

                <div class="space-y-1 mt-2">
                  <label class="text-[10px] text-slate-400 block font-bold">Titulaire affiché :</label>
                  <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-orange-name', 'Nom du Titulaire Orange', 'orange_name', 'text')">
                    <input 
                      type="text" 
                      id="pro-orange-name" 
                      value="${safeAttr(cp.orange_name, "Orange Money Côte d'Ivoire")}"
                      placeholder="Ex: Orange Money CI" 
                      readonly
                      class="w-full bg-slate-900 text-slate-300 text-xs rounded-xl px-3 py-2 pr-14 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none"
                    >
                    <div id="spinner-pro-orange-name" class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-xs pointer-events-none">
                      <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
                    </div>
                  </div>
                </div>

                <!-- ZONE IMAGE CARTE COMMERÇANT / QR CODE (R2) -->
                <div class="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5">
                  <div class="flex items-center justify-between">
                    <label class="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                      <span>🏷️</span>
                      <span>Carte Commerçant / QR :</span>
                    </label>
                    <div id="spinner-pro-orange-image" class="text-[10px]"></div>
                  </div>

                  <input type="file" id="file-pro-orange" accept="image/*" class="hidden" onchange="uploadPaymentImage('orange', event)">

                  <div id="container-img-orange">
                    ${cp.orange_image_url ? `
                      <div class="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                        <img src="${safeAttr(cp.orange_image_url)}" alt="Carte Orange" class="w-full h-24 object-contain bg-slate-950 p-1 cursor-pointer" onclick="openImageZoomModal('${safeAttr(cp.orange_image_url)}', 'Carte Commerçant / QR Orange Money')" />
                        <div class="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button type="button" onclick="document.getElementById('file-pro-orange').click()" class="px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded text-[10px] font-bold shadow cursor-pointer">
                            Changer
                          </button>
                          <button type="button" onclick="deletePaymentImage('orange')" class="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold shadow cursor-pointer">
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ` : `
                      <button type="button" onclick="document.getElementById('file-pro-orange').click()" class="w-full py-2.5 px-2 border-2 border-dashed border-slate-700 hover:border-orange-500/60 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-orange-300 flex flex-col items-center justify-center gap-1 transition cursor-pointer text-center">
                        <span class="text-base">📸</span>
                        <span class="text-[10px] font-bold">+ Ajouter Carte / QR</span>
                        <span class="text-[8px] text-slate-500">PNG, JPG, WEBP (R2)</span>
                      </button>
                    `}
                  </div>
                </div>

              </div>
            </div>

            <!-- 3. MTN MONEY -->
            <div class="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 border-t-4 border-t-yellow-500 flex flex-col justify-between">
              <div>
                <!-- En-tête Réseau + Switch Activation Réseau -->
                <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span class="text-xs font-black uppercase text-yellow-400 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-yellow-500"></span> MTN Money
                  </span>
                  <div class="flex items-center gap-1.5">
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        id="pro-mtn-enabled" 
                        ${cp.mtn_enabled !== 0 ? 'checked' : ''} 
                        onchange="togglePaymentSetting('mtn_enabled', this.checked, 'pro-mtn-enabled')" 
                        class="sr-only peer"
                      >
                      <div class="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-yellow-600"></div>
                      <span class="ml-1.5 text-[10px] font-bold ${cp.mtn_enabled !== 0 ? 'text-yellow-400' : 'text-slate-500'}" id="status-label-pro-mtn-enabled">
                        ${cp.mtn_enabled !== 0 ? 'Actif' : 'Inactif'}
                      </span>
                    </label>
                    <div id="spinner-pro-mtn-enabled" class="text-xs"></div>
                  </div>
                </div>

                <!-- Options d'affichage : Numéro et/ou Image -->
                <div class="bg-slate-900/90 rounded-xl p-2 border border-slate-800 my-2 space-y-1">
                  <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                    Affichage aux étudiants :
                  </span>
                  <div class="flex flex-col gap-1">
                    <label class="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 p-1 rounded-lg transition">
                      <span class="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                        <span>📞</span> Afficher le numéro
                      </span>
                      <div class="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          id="pro-mtn-show-number" 
                          ${cp.mtn_show_number !== 0 ? 'checked' : ''} 
                          onchange="togglePaymentSetting('mtn_show_number', this.checked, 'pro-mtn-show-number')" 
                          class="rounded border-slate-700 text-yellow-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        >
                        <div id="spinner-pro-mtn-show-number" class="text-[10px]"></div>
                      </div>
                    </label>
                    <label class="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 p-1 rounded-lg transition">
                      <span class="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                        <span>🖼️</span> Afficher la carte / QR
                      </span>
                      <div class="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          id="pro-mtn-show-image" 
                          ${cp.mtn_show_image !== 0 ? 'checked' : ''} 
                          onchange="togglePaymentSetting('mtn_show_image', this.checked, 'pro-mtn-show-image')" 
                          class="rounded border-slate-700 text-yellow-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        >
                        <div id="spinner-pro-mtn-show-image" class="text-[10px]"></div>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Champs Numéro & Titulaire -->
                <div class="space-y-1">
                  <label class="text-[10px] text-slate-400 block font-bold">Numéro MTN :</label>
                  <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-mtn-number', 'Numéro MTN de réception', 'mtn_number', 'text')">
                    <input 
                      type="text" 
                      id="pro-mtn-number" 
                      value="${safeAttr(cp.mtn_number, "+225 05 00 00 00 00")}"
                      placeholder="+225 05 00 00 00 00" 
                      readonly
                      class="w-full bg-slate-900 text-white font-mono text-xs rounded-xl px-3 py-2 pr-14 border border-slate-700 hover:border-yellow-500/60 transition cursor-pointer select-none font-bold"
                    >
                    <div id="spinner-pro-mtn-number" class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-xs pointer-events-none">
                      <span class="text-slate-500 group-hover:text-yellow-400 transition text-xs">✏️</span>
                    </div>
                  </div>
                </div>

                <div class="space-y-1 mt-2">
                  <label class="text-[10px] text-slate-400 block font-bold">Titulaire affiché :</label>
                  <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-mtn-name', 'Nom du Titulaire MTN Money', 'mtn_name', 'text')">
                    <input 
                      type="text" 
                      id="pro-mtn-name" 
                      value="${safeAttr(cp.mtn_name, "MTN Mobile Money CI")}"
                      placeholder="Ex: MTN Money CI" 
                      readonly
                      class="w-full bg-slate-900 text-slate-300 text-xs rounded-xl px-3 py-2 pr-14 border border-slate-700 hover:border-yellow-500/60 transition cursor-pointer select-none"
                    >
                    <div id="spinner-pro-mtn-name" class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-xs pointer-events-none">
                      <span class="text-slate-500 group-hover:text-yellow-400 transition text-xs">✏️</span>
                    </div>
                  </div>
                </div>

                <!-- ZONE IMAGE CARTE COMMERÇANT / QR CODE (R2) -->
                <div class="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5">
                  <div class="flex items-center justify-between">
                    <label class="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                      <span>🏷️</span>
                      <span>Carte Commerçant / QR :</span>
                    </label>
                    <div id="spinner-pro-mtn-image" class="text-[10px]"></div>
                  </div>

                  <input type="file" id="file-pro-mtn" accept="image/*" class="hidden" onchange="uploadPaymentImage('mtn', event)">

                  <div id="container-img-mtn">
                    ${cp.mtn_image_url ? `
                      <div class="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                        <img src="${safeAttr(cp.mtn_image_url)}" alt="Carte MTN" class="w-full h-24 object-contain bg-slate-950 p-1 cursor-pointer" onclick="openImageZoomModal('${safeAttr(cp.mtn_image_url)}', 'Carte Commerçant / QR MTN Money')" />
                        <div class="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button type="button" onclick="document.getElementById('file-pro-mtn').click()" class="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 text-white rounded text-[10px] font-bold shadow cursor-pointer">
                            Changer
                          </button>
                          <button type="button" onclick="deletePaymentImage('mtn')" class="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold shadow cursor-pointer">
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ` : `
                      <button type="button" onclick="document.getElementById('file-pro-mtn').click()" class="w-full py-2.5 px-2 border-2 border-dashed border-slate-700 hover:border-yellow-500/60 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-yellow-300 flex flex-col items-center justify-center gap-1 transition cursor-pointer text-center">
                        <span class="text-base">📸</span>
                        <span class="text-[10px] font-bold">+ Ajouter Carte / QR</span>
                        <span class="text-[8px] text-slate-500">PNG, JPG, WEBP (R2)</span>
                      </button>
                    `}
                  </div>
                </div>

              </div>
            </div>

            <!-- 4. MOOV MONEY -->
            <div class="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 border-t-4 border-t-emerald-500 flex flex-col justify-between">
              <div>
                <!-- En-tête Réseau + Switch Activation Réseau -->
                <div class="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span class="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Moov Money
                  </span>
                  <div class="flex items-center gap-1.5">
                    <label class="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        id="pro-moov-enabled" 
                        ${cp.moov_enabled !== 0 ? 'checked' : ''} 
                        onchange="togglePaymentSetting('moov_enabled', this.checked, 'pro-moov-enabled')" 
                        class="sr-only peer"
                      >
                      <div class="w-8 h-4 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
                      <span class="ml-1.5 text-[10px] font-bold ${cp.moov_enabled !== 0 ? 'text-emerald-400' : 'text-slate-500'}" id="status-label-pro-moov-enabled">
                        ${cp.moov_enabled !== 0 ? 'Actif' : 'Inactif'}
                      </span>
                    </label>
                    <div id="spinner-pro-moov-enabled" class="text-xs"></div>
                  </div>
                </div>

                <!-- Options d'affichage : Numéro et/ou Image -->
                <div class="bg-slate-900/90 rounded-xl p-2 border border-slate-800 my-2 space-y-1">
                  <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                    Affichage aux étudiants :
                  </span>
                  <div class="flex flex-col gap-1">
                    <label class="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 p-1 rounded-lg transition">
                      <span class="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                        <span>📞</span> Afficher le numéro
                      </span>
                      <div class="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          id="pro-moov-show-number" 
                          ${cp.moov_show_number !== 0 ? 'checked' : ''} 
                          onchange="togglePaymentSetting('moov_show_number', this.checked, 'pro-moov-show-number')" 
                          class="rounded border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        >
                        <div id="spinner-pro-moov-show-number" class="text-[10px]"></div>
                      </div>
                    </label>
                    <label class="flex items-center justify-between cursor-pointer hover:bg-slate-800/40 p-1 rounded-lg transition">
                      <span class="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                        <span>🖼️</span> Afficher la carte / QR
                      </span>
                      <div class="flex items-center gap-1">
                        <input 
                          type="checkbox" 
                          id="pro-moov-show-image" 
                          ${cp.moov_show_image !== 0 ? 'checked' : ''} 
                          onchange="togglePaymentSetting('moov_show_image', this.checked, 'pro-moov-show-image')" 
                          class="rounded border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                        >
                        <div id="spinner-pro-moov-show-image" class="text-[10px]"></div>
                      </div>
                    </label>
                  </div>
                </div>

                <!-- Champs Numéro & Titulaire -->
                <div class="space-y-1">
                  <label class="text-[10px] text-slate-400 block font-bold">Numéro Moov :</label>
                  <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-moov-number', 'Numéro Moov de réception', 'moov_number', 'text')">
                    <input 
                      type="text" 
                      id="pro-moov-number" 
                      value="${safeAttr(cp.moov_number, "+225 01 00 00 00 00")}"
                      placeholder="+225 01 00 00 00 00" 
                      readonly
                      class="w-full bg-slate-900 text-white font-mono text-xs rounded-xl px-3 py-2 pr-14 border border-slate-700 hover:border-emerald-500/60 transition cursor-pointer select-none font-bold"
                    >
                    <div id="spinner-pro-moov-number" class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-xs pointer-events-none">
                      <span class="text-slate-500 group-hover:text-emerald-400 transition text-xs">✏️</span>
                    </div>
                  </div>
                </div>

                <div class="space-y-1 mt-2">
                  <label class="text-[10px] text-slate-400 block font-bold">Titulaire affiché :</label>
                  <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-moov-name', 'Nom du Titulaire Moov Money', 'moov_name', 'text')">
                    <input 
                      type="text" 
                      id="pro-moov-name" 
                      value="${safeAttr(cp.moov_name, "Moov Money Côte d'Ivoire")}"
                      placeholder="Ex: Moov Money CI" 
                      readonly
                      class="w-full bg-slate-900 text-slate-300 text-xs rounded-xl px-3 py-2 pr-14 border border-slate-700 hover:border-emerald-500/60 transition cursor-pointer select-none"
                    >
                    <div id="spinner-pro-moov-name" class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center text-xs pointer-events-none">
                      <span class="text-slate-500 group-hover:text-emerald-400 transition text-xs">✏️</span>
                    </div>
                  </div>
                </div>

                <!-- ZONE IMAGE CARTE COMMERÇANT / QR CODE (R2) -->
                <div class="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5">
                  <div class="flex items-center justify-between">
                    <label class="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                      <span>🏷️</span>
                      <span>Carte Commerçant / QR :</span>
                    </label>
                    <div id="spinner-pro-moov-image" class="text-[10px]"></div>
                  </div>

                  <input type="file" id="file-pro-moov" accept="image/*" class="hidden" onchange="uploadPaymentImage('moov', event)">

                  <div id="container-img-moov">
                    ${cp.moov_image_url ? `
                      <div class="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                        <img src="${safeAttr(cp.moov_image_url)}" alt="Carte Moov" class="w-full h-24 object-contain bg-slate-950 p-1 cursor-pointer" onclick="openImageZoomModal('${safeAttr(cp.moov_image_url)}', 'Carte Commerçant / QR Moov Money')" />
                        <div class="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button type="button" onclick="document.getElementById('file-pro-moov').click()" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold shadow cursor-pointer">
                            Changer
                          </button>
                          <button type="button" onclick="deletePaymentImage('moov')" class="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold shadow cursor-pointer">
                            Supprimer
                          </button>
                        </div>
                      </div>
                    ` : `
                      <button type="button" onclick="document.getElementById('file-pro-moov').click()" class="w-full py-2.5 px-2 border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-emerald-300 flex flex-col items-center justify-center gap-1 transition cursor-pointer text-center">
                        <span class="text-base">📸</span>
                        <span class="text-[10px] font-bold">+ Ajouter Carte / QR</span>
                        <span class="text-[8px] text-slate-500">PNG, JPG, WEBP (R2)</span>
                      </button>
                    `}
                  </div>
                </div>

              </div>
            </div>

          </div>

          <!-- Instructions de paiement affichées aux étudiants -->
          <div class="space-y-1 pt-2">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-slate-300 block flex items-center gap-1">
                <span>📝</span>
                <span>Consignes et Instructions de Paiement (affichées aux utilisateurs à l'Étape 1)</span>
              </label>
              <span class="text-[10px] text-orange-400/80 hover:text-orange-300 cursor-pointer font-semibold flex items-center gap-1" onclick="openFieldEditModal('pro-payment-instructions', 'Consignes et Instructions de Paiement', 'payment_instructions', 'textarea')">
                <span>✏️</span> <span>Modifier</span>
              </span>
            </div>
            <div class="relative group cursor-pointer" onclick="openFieldEditModal('pro-payment-instructions', 'Consignes et Instructions de Paiement', 'payment_instructions', 'textarea')">
              <textarea 
                id="pro-payment-instructions" 
                rows="2"
                readonly
                placeholder="Ex: Transférez le montant exact sur l'un de nos numéros ci-dessous, puis prenez une capture..." 
                class="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 pr-20 border border-slate-700 hover:border-orange-500/60 transition cursor-pointer select-none resize-none"
              >${safeHtml(cp.payment_instructions, "Transférez le montant exact sur l'un de nos numéros officiels ci-dessous, puis importez une capture claire de votre reçu affichant la date et le numéro de transaction.")}</textarea>
              <div id="spinner-pro-payment-instructions" class="absolute right-3 top-3 flex items-center gap-1 text-xs pointer-events-none">
                <span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>
              </div>
            </div>
          </div>

          <!-- ==================================================================== -->
          <!-- ESPACE FORMULAIRES & CARTES DE PAIEMENT (STOCKAGE ET ASSISTANTE IA) -->
          <!-- ==================================================================== -->
          <div class="mt-6 pt-5 border-t border-slate-800 space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 class="text-sm font-black text-white flex items-center gap-2">
                  <span>💳</span>
                  <span>Formules et Cartes d'Abonnement (Interface Utilisateur)</span>
                </h4>
                <p class="text-[11px] text-slate-400">
                  Créez et configurez les cartes de forfaits visibles par les étudiants dans l'application StudyCloud.
                </p>
              </div>

              <!-- Bouton + Créer une carte d'abonnement -->
              <button 
                type="button" 
                onclick="openSubscriptionPlanModal(currentSubPlanTab)"
                class="px-3.5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-orange-950/40 flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0"
              >
                <span>➕</span>
                <span>Créer une carte d'abonnement</span>
              </button>
            </div>

            <!-- Deux Boutons d'Onglets Principaux : Paiement Stockage vs Assistante StudyCloud -->
            <div class="flex items-center gap-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800 w-fit">
              <button 
                type="button" 
                id="btn-subtab-storage"
                onclick="switchSubscriptionTab('storage')"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer bg-orange-600 text-white shadow"
              >
                <span>💾</span>
                <span>Paiement de Stockage</span>
                <span id="badge-count-storage-plans" class="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 text-white">0</span>
              </button>

              <button 
                type="button" 
                id="btn-subtab-ai"
                onclick="switchSubscriptionTab('ai')"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white"
              >
                <span>🤖</span>
                <span>Paiement Assistante StudyCloud</span>
                <span id="badge-count-ai-plans" class="px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 text-white">0</span>
              </button>
            </div>

            <!-- Grille des cartes d'abonnements générées dynamiquement -->
            <div id="sub-plans-cards-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              <!-- Injecté en JS par renderSubscriptionPlansCards() -->
            </div>
          </div>

        </div>

      </div>
    </div>

  </main>

  <!-- MODALE D'ÉDITION DE CHAMP INDIVIDUEL (INFORMATIONS PROFESSIONNELLES) -->
  <div id="field-edit-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex flex-col items-center justify-center p-4" onclick="closeFieldEditModal(event)">
    <div class="relative max-w-lg w-full bg-[#0f172a] border border-slate-700 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150" onclick="event.stopPropagation()">
      <div class="px-5 py-4 bg-[#0d1424] border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-sm">
            ✏️
          </div>
          <div>
            <h3 class="text-sm font-black text-white" id="field-edit-modal-title">Modifier le champ</h3>
            <p class="text-[10px] text-slate-400" id="field-edit-modal-subtitle">Enregistrement individuel dans la base de données D1</p>
          </div>
        </div>
        <button type="button" onclick="closeFieldEditModal()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold flex items-center justify-center cursor-pointer transition">✕</button>
      </div>
      <form onsubmit="event.preventDefault(); saveFieldEditModal();" class="p-5 space-y-4">
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-slate-200 block" id="field-edit-modal-label">Nouvelle valeur :</label>
          <div id="field-edit-modal-input-container">
            <!-- Champ injecté dynamiquement (input ou textarea) -->
          </div>
          <p class="text-[11px] text-slate-400" id="field-edit-modal-hint"></p>
        </div>
        <div id="field-edit-modal-error" class="text-xs text-rose-400 font-semibold hidden"></div>
        <div class="pt-2 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button 
            type="button" 
            onclick="closeFieldEditModal()" 
            class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition cursor-pointer"
          >
            Annuler
          </button>
          <button 
            type="submit" 
            id="field-edit-modal-save-btn" 
            class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-orange-600/30 transition cursor-pointer active:scale-95"
          >
            <span>💾</span>
            <span>Enregistrer</span>
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODALE DE ZOOM PLEIN ÉCRAN DU REÇU DE PAIEMENT -->
  <div id="receipt-zoom-modal" class="fixed inset-0 z-50 bg-black/85 backdrop-blur-md hidden flex flex-col items-center justify-center p-4" onclick="closeReceiptZoomModal(event)">
    <div class="relative max-w-3xl w-full max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl" onclick="event.stopPropagation()">
      <div class="px-4 py-3 bg-[#0d1424] border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-base">🧾</span>
          <span class="text-xs sm:text-sm font-bold text-white">Reçu de Paiement • Visualisation Haute Définition</span>
        </div>
        <button onclick="closeReceiptZoomModal()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer">✕</button>
      </div>
      <div class="p-3 overflow-auto flex-1 flex items-center justify-center bg-slate-950/80">
        <img id="receipt-zoom-img" src="" class="max-h-[75vh] max-w-full rounded-lg object-contain shadow-lg border border-slate-800" alt="Reçu agrandi" />
      </div>
      <div class="px-4 py-2.5 bg-[#0d1424] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <span id="receipt-zoom-caption">Fichier hébergé dans Cloudflare R2</span>
        <a id="receipt-zoom-download" href="" target="_blank" download class="px-3 py-1 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-lg transition">Ouvrir l'original</a>
      </div>
    </div>
  </div>

  <!-- MODALE HISTORIQUE DES DEMANDES ET ABONNEMENTS (BOUTON 3 TRAITS ☰) -->
  <div id="user-history-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex flex-col items-center justify-center p-4" onclick="closeUserHistoryModal(event)">
    <div class="relative max-w-2xl w-full max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl" onclick="event.stopPropagation()">
      <div class="px-4 py-3 bg-[#0d1424] border-b border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-base">📜</span>
          <h3 class="text-xs sm:text-sm font-bold text-white" id="user-history-modal-title">Historique de l'Utilisateur</h3>
        </div>
        <button onclick="closeUserHistoryModal()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer">✕</button>
      </div>
      <!-- Onglets internes modale -->
      <div class="p-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center gap-1.5 text-xs font-bold">
        <button onclick="switchUserHistoryTab('requests')" id="hist-tab-requests" class="px-3 py-1.5 rounded-lg bg-orange-600 text-white transition">Historique des demandes</button>
        <button onclick="switchUserHistoryTab('active')" id="hist-tab-active" class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition">Abonnements en cours</button>
        <button onclick="switchUserHistoryTab('cancelled')" id="hist-tab-cancelled" class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition">Abonnements annulés</button>
      </div>
      <!-- Contenu liste -->
      <div id="user-history-modal-content" class="p-4 overflow-y-auto max-h-[60vh] space-y-3 text-xs overscroll-contain"></div>
    </div>
  </div>

  <!-- MODALE DE CRÉATION ET MODIFICATION D'UNE CARTE D'ABONNEMENT -->
  <div id="subscription-plan-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex flex-col items-center justify-center p-3 sm:p-4" onclick="closeSubscriptionPlanModal(event)">
    <div class="relative max-w-2xl w-full max-h-[92vh] bg-[#0f172a] border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150" onclick="event.stopPropagation()">
      
      <!-- En-tête -->
      <div class="px-5 py-3.5 bg-[#0d1424] border-b border-slate-800 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-base" id="sub-modal-icon">
            💾
          </div>
          <div>
            <h3 class="text-sm font-black text-white" id="sub-modal-title">Créer une carte d'abonnement</h3>
            <p class="text-[10px] text-slate-400" id="sub-modal-subtitle">Configuration tarifaire et avantages pour les utilisateurs</p>
          </div>
        </div>
        <button type="button" onclick="closeSubscriptionPlanModal()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold flex items-center justify-center cursor-pointer transition">✕</button>
      </div>

      <!-- Corps du formulaire avec défilement -->
      <form id="form-sub-plan" onsubmit="event.preventDefault(); saveSubscriptionPlanModal();" class="p-5 overflow-y-auto space-y-4 text-xs">
        <input type="hidden" id="sub-plan-id" value="" />
        <input type="hidden" id="sub-plan-category" value="storage" />
        <input type="hidden" id="sub-plan-pricing-model" value="subscription" />

        <!-- SÉLECTEUR DE TYPE : ABONNEMENT RÉCURRENT VS VENTE UNIQUE / PACK DE CRÉDITS (POUR L'IA) -->
        <div id="sub-pricing-model-container" class="p-3 bg-slate-900/90 rounded-xl border border-slate-700/80 space-y-2">
          <label class="text-[11px] font-bold text-slate-200 block flex items-center gap-1.5">
            <span>⚙️</span>
            <span>Type d'offre IA :</span>
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button 
              type="button" 
              id="sub-model-btn-subscription"
              onclick="setSubscriptionPricingModel('subscription')"
              class="p-2.5 rounded-xl border-2 border-orange-500 bg-orange-950/40 text-orange-200 text-left transition-all cursor-pointer flex flex-col justify-between shadow-md"
            >
              <div class="flex items-center gap-1.5 font-extrabold text-xs">
                <span>🔄</span> <span>Abonnement Récurrent</span>
              </div>
              <span class="text-[10px] text-slate-400 mt-1">Facturé par mois / an avec réduction</span>
            </button>

            <button 
              type="button" 
              id="sub-model-btn-onetime"
              onclick="setSubscriptionPricingModel('one_time')"
              class="p-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-slate-400 text-left transition-all cursor-pointer flex flex-col justify-between hover:border-slate-600"
            >
              <div class="flex items-center gap-1.5 font-extrabold text-xs">
                <span>⚡</span> <span>Vente unique / Pack de crédits</span>
              </div>
              <span class="text-[10px] text-slate-400 mt-1">Paiement direct, l'étudiant consomme et rachète</span>
            </button>
          </div>
        </div>

        <!-- 1. Catégorie et Nom du forfait -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] font-bold text-slate-300 block mb-1">Nom du forfait / abonnement *</label>
            <input type="text" id="sub-plan-name" required placeholder="Ex: Pro, Basique, Master..." class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:border-orange-500 outline-none" />
          </div>
          <div>
            <label class="text-[11px] font-bold text-slate-300 block mb-1">Badge optionnel (sur la carte)</label>
            <input type="text" id="sub-plan-badge" placeholder="Ex: Populaire, Recommandé..." class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-orange-500 outline-none" />
          </div>
        </div>

        <div>
          <label class="text-[11px] font-bold text-slate-300 block mb-1">Description courte</label>
          <input type="text" id="sub-plan-desc" placeholder="Ex: Pour les professionnels et étudiants avancés." class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-orange-500 outline-none" />
        </div>

        <!-- 2. Prix et Choix des devises -->
        <div class="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="text-[11px] font-bold text-slate-300 block mb-1" id="sub-plan-price-label">Prix de base mensuel *</label>
              <input type="number" step="any" min="0" id="sub-plan-price" required value="10" oninput="updateSubscriptionPricingCalculations()" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-base focus:border-orange-500 outline-none" />
            </div>
            <div>
              <label class="text-[11px] font-bold text-slate-300 block mb-1">Devise principale (affichée en grand) *</label>
              <select id="sub-plan-primary-curr" onchange="updateSubscriptionPricingCalculations()" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:border-orange-500 outline-none">
                <option value="USD">Dollars US ($ USD)</option>
                <option value="XOF">Francs CFA (FCFA / XOF)</option>
                <option value="EUR">Euros (€ EUR)</option>
              </select>
            </div>
          </div>

          <!-- Devises secondaires à convertir et afficher en petit -->
          <div>
            <label class="text-[11px] font-bold text-slate-300 block mb-1.5">Devises secondaires à afficher en dessous sur la carte :</label>
            <div class="flex flex-wrap items-center gap-4 text-slate-300">
              <label class="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" id="sub-curr-xof" checked onchange="updateSubscriptionPricingCalculations()" class="w-4 h-4 rounded text-orange-500 bg-slate-900 border-slate-700" />
                <span class="font-bold">FCFA (XOF)</span>
              </label>
              <label class="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" id="sub-curr-usd" checked onchange="updateSubscriptionPricingCalculations()" class="w-4 h-4 rounded text-orange-500 bg-slate-900 border-slate-700" />
                <span class="font-bold">Dollars ($ USD)</span>
              </label>
              <label class="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" id="sub-curr-eur" checked onchange="updateSubscriptionPricingCalculations()" class="w-4 h-4 rounded text-orange-500 bg-slate-900 border-slate-700" />
                <span class="font-bold">Euros (€ EUR)</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 3. Encadré Récapitulatif : Prix par Mois & Prix par An avec Réduction -->
        <div id="sub-pricing-recap-box" class="p-3.5 bg-gradient-to-r from-slate-900 to-slate-950 rounded-xl border border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <!-- Côté Gauche : Prix Mois -->
          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1" id="sub-preview-left-title">Tarif par Mois</span>
            <div class="text-xl font-extrabold text-white" id="sub-preview-monthly-primary">$ 10 / mois</div>
            <div class="text-[11px] text-amber-400 font-medium mt-0.5" id="sub-preview-monthly-conversions">≈ 6 500 FCFA • ≈ 9.20 €</div>
          </div>

          <!-- Côté Droit : Prix An & Réduction -->
          <div id="sub-preview-yearly-container" class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarif par An (12 mois)</span>
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-emerald-400 font-bold">Réduction :</span>
                <input type="number" min="0" max="90" id="sub-plan-discount" value="10" oninput="updateSubscriptionPricingCalculations()" class="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs text-emerald-400 font-bold outline-none" />
                <span class="text-xs text-emerald-400 font-bold">%</span>
              </div>
            </div>
            <div class="text-xl font-extrabold text-emerald-400" id="sub-preview-yearly-primary">$ 90 / an</div>
            <div class="text-[11px] text-slate-400 mt-0.5" id="sub-preview-yearly-conversions">≈ 58 500 FCFA • ≈ 82.80 €</div>
          </div>
        </div>

        <!-- 4. Avantages (Perks) avec Première Ligne Verrouillée (Stockage ou IA) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold text-slate-200 block flex items-center gap-1.5">
              <span>✨</span>
              <span>Avantages inclus dans ce forfait :</span>
            </label>
            <button type="button" onclick="addSubscriptionFeatureLine()" class="text-[11px] text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 cursor-pointer">
              <span>➕</span> <span>Ajouter une ligne</span>
            </button>
          </div>

          <!-- Première ligne FIXE et NON DÉCOCHABLE -->
          <div class="p-2.5 bg-orange-950/20 border border-orange-500/40 rounded-xl space-y-1">
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded bg-orange-500/30 border border-orange-500 flex items-center justify-center text-orange-300 font-bold text-xs select-none">
                🔒
              </div>
              <span class="text-[10px] font-bold text-orange-300 uppercase" id="sub-main-feature-label">
                Volume de stockage inclus (Obligatoire, non décochable)
              </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <input type="text" id="sub-plan-main-feature-text" required placeholder="Ex: 50 Go supplémentaires (+ 51 200 Mo)" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-semibold text-xs focus:border-orange-500 outline-none" />
              <input type="number" id="sub-plan-main-feature-val" required placeholder="Nombre de crédits ou Mo" class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:border-orange-500 outline-none" />
            </div>
          </div>

          <!-- Lignes d'avantages supplémentaires cochables/décochables -->
          <div id="sub-plan-features-list" class="space-y-2 max-h-48 overflow-y-auto pr-1">
            <!-- Injecté dynamiquement par addSubscriptionFeatureLine() -->
          </div>
        </div>

        <!-- 5. Mode de facturation (Manuel vs Automatique) -->
        <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
          <label class="text-[11px] font-bold text-slate-300 block">Mode de déclenchement dans l'application :</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label class="flex items-start gap-2.5 p-2 rounded-lg border border-slate-700 bg-slate-900/60 cursor-pointer hover:border-slate-600">
              <input type="radio" name="sub-plan-billing-mode" value="manual" id="sub-billing-manual" checked class="mt-0.5 text-orange-500" />
              <div>
                <span class="font-bold text-white block">Paiement Manuel (Bouton "Commencer")</span>
                <span class="text-[10px] text-slate-400 block">L'étudiant effectue un transfert Wave / Orange / MTN / Moov et joint son reçu.</span>
              </div>
            </label>

            <label class="flex items-start gap-2.5 p-2 rounded-lg border border-slate-700 bg-slate-900/60 cursor-pointer hover:border-slate-600">
              <input type="radio" name="sub-plan-billing-mode" value="auto" id="sub-billing-auto" class="mt-0.5 text-orange-500" />
              <div>
                <span class="font-bold text-white block">Abonnement Automatique (Bouton "S'abonner")</span>
                <span class="text-[10px] text-slate-400 block">Demande au Worker d'afficher les options cartes de crédit / prélèvement automatique.</span>
              </div>
            </label>
          </div>
        </div>

        <div id="sub-plan-modal-error" class="text-xs text-rose-400 font-semibold hidden"></div>

        <!-- Boutons d'action -->
        <div class="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
          <button type="button" onclick="closeSubscriptionPlanModal()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition cursor-pointer">
            Annuler
          </button>
          <button type="submit" id="btn-save-sub-plan" class="px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl font-extrabold shadow-lg shadow-orange-950/40 transition cursor-pointer active:scale-95">
            Enregistrer la carte
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODALE DE CONFIRMATION DE SUPPRESSION D'UNE CARTE D'ABONNEMENT -->
  <div id="confirm-delete-sub-plan-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-md hidden flex flex-col items-center justify-center p-3 sm:p-4" onclick="closeDeleteConfirmModal(event)">
    <div class="relative max-w-md w-full bg-[#0f172a] border border-rose-500/40 rounded-2xl overflow-hidden shadow-2xl p-6 text-center animate-in fade-in zoom-in-95 duration-150" onclick="event.stopPropagation()">
      <div class="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 mx-auto flex items-center justify-center text-2xl mb-4 select-none">
        🗑️
      </div>
      <h3 class="text-base font-black text-white mb-2">Confirmer la suppression</h3>
      <p class="text-xs text-slate-300 leading-relaxed mb-6" id="confirm-delete-sub-plan-text">
        Êtes-vous sûr de vouloir supprimer définitivement cette carte d'abonnement ? Cette action est irréversible et la carte sera immédiatement retirée de l'application.
      </p>
      <div class="flex items-center justify-center gap-3">
        <button type="button" onclick="closeDeleteConfirmModal()" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer">
          Annuler
        </button>
        <button type="button" id="btn-confirm-delete-sub-plan" onclick="confirmDeleteSubscriptionPlan()" class="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-rose-900/40">
          Confirmer la suppression
        </button>
      </div>
    </div>
  </div>

  <!-- TOAST DE NOTIFICATION FLOTTANT -->
  <div id="toast" class="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400/40 hidden transition-opacity animate-bounce">
    Notification
  </div>

  <script>
    let allUsers = ${usersJson};
    let globalSummary = ${summaryJson};
    let globalConfig = ${globalConfigJson};
    let d1TablesGlobal = ${d1TablesGlobalJson};
    let r2FoldersGlobal = ${r2FoldersGlobalJson};
    let tablesMeta = ${tablesMetaJson};
    let r2Meta = ${r2MetaJson};
    let companyProfileGlobal = ${companyProfileJson};
    let allStoragePlans = ${storagePlansJson};
    let allAiPlans = ${aiPlansJson};
    let currentSubPlanTab = 'storage';

    let selectedUserId = allUsers.length > 0 ? allUsers[0].user.id : null;
    let selectedDistributionUserId = allUsers.length > 0 ? allUsers[0].user.id : null;
    let selectedDemandeUserId = allUsers.length > 0 ? allUsers[0].user.id : null; // compat
    let currentView = 'global';
    let userStorageViewMode = 'net'; // 'net' = Vrai Stockage Réel (Déduit & Non Pénalisé), 'gross' = Stockage Brut Total (Tout Inclus)

    let allRequests = ${upgradeRequestsJson};
    let allSubscriptions = ${userSubscriptionsJson};
    let currentDemandeTab = 'pending'; // 'pending' | 'active' | 'cancelled' | 'all'
    let selectedDemandeId = null;
    let selectedDemandeType = 'request'; // 'request' | 'subscription'
    let currentDemandeIaTab = 'pending'; // 'pending' | 'active' | 'cancelled' | 'all'
    let selectedDemandeIaId = null;
    let selectedDemandeIaType = 'request'; // 'request' | 'subscription'
    let activeHistoryUserId = null;
    let activeHistoryTab = 'requests';

    function formatBytes(bytes, decimals = 1) {
      if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 Octets';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Octets', 'Ko', 'Mo', 'Go', 'To'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      if (i < 0) return '0 Octets';
      const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
      return val + ' ' + sizes[i];
    }

    function setUserStorageViewMode(mode) {
      userStorageViewMode = mode;
      if (selectedUserId) {
        renderUserRightDetails(selectedUserId);
      }
      if (selectedDemandeUserId) {
        renderDemandeRightDetails(selectedDemandeUserId);
      }
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      setTimeout(() => t.classList.add('hidden'), 3500);
    }

    function toggleSidebar(forceState) {
      const drawer = document.getElementById('sidebar-drawer');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (!drawer || !backdrop) return;
      const isOpen = drawer.classList.contains('open');
      const willOpen = (typeof forceState === 'boolean') ? forceState : !isOpen;

      if (willOpen) {
        drawer.classList.add('open');
        drawer.style.setProperty('transform', 'translateX(0)', 'important');
        backdrop.classList.remove('hidden');
        backdrop.style.display = 'block';
      } else {
        drawer.classList.remove('open');
        drawer.style.setProperty('transform', 'translateX(-100%)', 'important');
        backdrop.classList.add('hidden');
        backdrop.style.display = 'none';
      }
    }
    window.toggleSidebar = toggleSidebar;

    function switchView(viewName) {
      currentView = viewName;
      const flexViews = ['users', 'demandes', 'demandes-ia', 'distribution', 'messages', 'signalements', 'abonnements', 'statistiques'];
      ['global', 'users', 'demandes', 'demandes-ia', 'distribution', 'messages', 'signalements', 'abonnements', 'statistiques', 'profil-pro'].forEach(v => {
        const el = document.getElementById('view-' + v);
        const navBtn = document.getElementById('nav-btn-' + v);
        if (!el) return;
        if (v === viewName) {
          el.classList.remove('hidden');
          el.style.display = flexViews.includes(v) ? 'flex' : 'block';
          if (navBtn) {
            navBtn.className = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-orange-600 text-white font-bold transition-all text-left shadow-md shadow-orange-600/20 cursor-pointer";
          }
        } else {
          el.classList.add('hidden');
          el.style.display = 'none';
          if (navBtn) {
            navBtn.className = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer";
          }
        }
      });

      const badge = document.getElementById('current-view-badge');
      if (badge) {
        const titles = {
          global: 'Vue Globale',
          users: 'Tous les Utilisateurs',
          demandes: 'Demandes de Stockage',
          'demandes-ia': 'Demandes de Crédits IA',
          distribution: 'Distribution de Stockage',
          messages: 'Messages',
          signalements: 'Signalements & Retours',
          abonnements: 'Abonnements & Forfaits',
          statistiques: 'Statistiques & Métriques',
          'profil-pro': 'Informations professionnelles'
        };
        badge.textContent = titles[viewName] || viewName;
      }

      // Ferme systématiquement le tiroir mobile et masque le backdrop
      toggleSidebar(false);

      try {
        if (window.location.hash !== '#' + viewName) {
          window.location.hash = viewName;
        }
      } catch(e) {}

      if (viewName === 'users') {
        renderUsersLeftList();
        renderUserRightDetails(selectedUserId);
      } else if (viewName === 'demandes') {
        updateDemandesTabCounts();
        renderDemandesLeftList();
        if (selectedDemandeId) {
          renderDemandeDetail(selectedDemandeId, selectedDemandeType);
        } else {
          autoSelectFirstDemande();
        }
      } else if (viewName === 'demandes-ia') {
        updateDemandesIaTabCounts();
        renderDemandesIaLeftList();
        if (selectedDemandeIaId) {
          renderDemandeIaDetail(selectedDemandeIaId, selectedDemandeIaType);
        } else {
          autoSelectFirstDemandeIa();
        }
      } else if (viewName === 'distribution') {
        renderDistributionUsersList();
        renderDistributionRightDetails(selectedDistributionUserId || (allUsers[0] ? allUsers[0].user.id : null));
      } else if (viewName === 'messages') {
        renderSimpleMessagesUsersList();
      } else if (viewName === 'profil-pro') {
        try {
          loadCompanyProfileClient();
        } catch(e) {
          console.warn('Erreur chargement profil pro:', e);
        }
      }
    }

    function toggleAccordion(id) {
      const content = document.getElementById(id);
      const icon = document.getElementById(id + '-icon');
      if (!content) return;
      const isOpen = content.classList.contains('open');
      if (isOpen) {
        content.classList.remove('open');
        if (icon) icon.style.transform = 'rotate(0deg)';
      } else {
        content.classList.add('open');
        if (icon) icon.style.transform = 'rotate(180deg)';
      }
    }

    // ========================================================================
    // VUE GLOBALE : RENDU DES TABLES D1 ET DOSSIERS R2
    // ========================================================================
    function renderGlobalD1Tables(filterText = '') {
      const container = document.getElementById('d1-tables-accordion-list');
      const q = (filterText || '').toLowerCase().trim();

      const filtered = tablesMeta.filter(t => {
        if (!q) return true;
        return t.table.toLowerCase().includes(q) || t.label.toLowerCase().includes(q) || t.role.toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-500 text-xs">Aucune table trouvée.</div>';
        return;
      }

      container.innerHTML = filtered.map((t, i) => {
        const stats = d1TablesGlobal[t.table] || { count: 0, bytes: 0, formatted: '0 Octets' };
        const accId = 'acc-d1-global-' + i;

        return \`
          <div class="hover:bg-slate-800/30 transition-colors">
            <div onclick="toggleAccordion('\${accId}')" class="px-4 py-2.5 flex items-center justify-between cursor-pointer select-none">
              <div class="flex items-center gap-2.5">
                <span class="font-mono font-bold text-xs text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">\${t.table}</span>
                <span class="text-xs font-semibold text-slate-300 hidden sm:inline">\${t.label}</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right font-mono">
                  <span class="text-xs font-bold text-emerald-400">\${stats.formatted}</span>
                  <span class="text-[11px] text-slate-400 ml-1.5">(\${stats.count.toLocaleString()} lignes)</span>
                </div>
                <svg id="\${accId}-icon" class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
            <div id="\${accId}" class="accordion-content bg-[#090e1a] border-t border-slate-800/60 px-4 text-xs text-slate-300">
              <div class="py-3 space-y-2 text-[11px] leading-relaxed">
                <div><span class="font-bold text-emerald-400 uppercase tracking-wider text-[10px] block mb-0.5">📍 Connexion UI :</span> \${t.uiConnection}</div>
                <div><span class="font-bold text-blue-400 uppercase tracking-wider text-[10px] block mb-0.5">🎯 Rôle :</span> \${t.role}</div>
                <div><span class="font-bold text-amber-400 uppercase tracking-wider text-[10px] block mb-0.5">⚙️ Utilisation :</span> \${t.usage}</div>
                <div><span class="font-bold text-purple-400 uppercase tracking-wider text-[10px] block mb-0.5">📝 Exemple :</span>
                  <pre class="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto">\${t.example}</pre>
                </div>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderGlobalR2Folders(filterText = '') {
      const container = document.getElementById('r2-folders-accordion-list');
      const q = (filterText || '').toLowerCase().trim();

      const filtered = r2Meta.filter(r => {
        if (!q) return true;
        return r.folder.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-500 text-xs">Aucun dossier trouvé.</div>';
        return;
      }

      container.innerHTML = filtered.map((r, i) => {
        const stats = r2FoldersGlobal[r.folder] || { count: 0, bytes: 0, formatted: '0 Octets' };
        const accId = 'acc-r2-global-' + i;

        return \`
          <div class="hover:bg-slate-800/30 transition-colors">
            <div onclick="toggleAccordion('\${accId}')" class="px-4 py-2.5 flex items-center justify-between cursor-pointer select-none">
              <div class="flex items-center gap-2.5">
                <span class="font-mono font-bold text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">\${r.folder}</span>
                <span class="text-xs font-semibold text-slate-300 hidden sm:inline">\${r.name}</span>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right font-mono">
                  <span class="text-xs font-bold text-orange-400">\${stats.formatted}</span>
                  <span class="text-[11px] text-slate-400 ml-1.5">(\${stats.count} fichier(s))</span>
                </div>
                <svg id="\${accId}-icon" class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
            <div id="\${accId}" class="accordion-content bg-[#090e1a] border-t border-slate-800/60 px-4 text-xs text-slate-300">
              <div class="py-3 space-y-2 text-[11px] leading-relaxed">
                <div><span class="font-bold text-orange-400 uppercase tracking-wider text-[10px] block mb-0.5">📍 Connexion UI :</span> \${r.uiConnection}</div>
                <div><span class="font-bold text-blue-400 uppercase tracking-wider text-[10px] block mb-0.5">🎯 Rôle :</span> \${r.role}</div>
                <div><span class="font-bold text-purple-400 uppercase tracking-wider text-[10px] block mb-0.5">📝 Exemples :</span> \${r.examples}</div>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function filterGlobalTables() {
      const q = document.getElementById('global-search-input').value;
      renderGlobalD1Tables(q);
      renderGlobalR2Folders(q);
    }

    // ========================================================================
    // VUE 2 : TOUT LES UTILISATEURS (DIVISÉE EN 2)
    // ========================================================================
    function renderUsersLeftList(filterText = '') {
      const container = document.getElementById('users-left-list');
      const q = (filterText || '').toLowerCase().trim();

      const filtered = allUsers.filter(item => {
        if (!q) return true;
        const u = item.user;
        return (u.name && u.name.toLowerCase().includes(q)) ||
               (u.email && u.email.toLowerCase().includes(q)) ||
               (u.phone && u.phone.toLowerCase().includes(q)) ||
               (u.school && u.school.toLowerCase().includes(q)) ||
               (u.level && u.level.toLowerCase().includes(q));
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-500">Aucun utilisateur.</div>';
        return;
      }

      container.innerHTML = filtered.map(item => {
        const u = item.user;
        const s = item.storage;
        const q = item.quotaConfig;
        const isSelected = u.id === selectedUserId;

        return \`
          <div 
            onclick="selectUser('\${u.id}')"
            class="p-2.5 cursor-pointer transition-all flex items-center justify-between \${isSelected ? 'bg-orange-600/15 border-l-4 border-l-orange-500' : 'hover:bg-slate-800/40'}"
          >
            <div class="flex items-center gap-2 overflow-hidden">
              <div class="relative w-8 h-8 rounded-lg bg-slate-800 text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-700">
                \${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full rounded-lg object-cover" onerror="this.remove()">' : u.name.charAt(0).toUpperCase()}
                <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 \${u.isOnline ? 'bg-emerald-500' : 'bg-slate-600'}" title="\${u.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
              </div>
              <div class="truncate">
                <div class="font-bold text-white truncate text-xs flex items-center gap-1">
                  <span>\${u.name}</span>
                  \${u.hasShop ? '<span class="text-[9px] px-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30" title="Boutique active">🏪</span>' : ''}
                </div>
                <div class="text-[10px] text-slate-400 truncate">📞 \${u.phone || 'Sans numéro'} • \${u.level}</div>
              </div>
            </div>
            <div class="text-right shrink-0 font-mono text-[11px]">
              <span class="font-bold text-orange-400">\${s.net ? s.net.totalFormatted : s.totalFormatted}</span>
              <div class="text-[9px] text-slate-500">Quota: \${q.totalAllowedFormatted}</div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function filterUsersLeft() {
      renderUsersLeftList(document.getElementById('users-search-left').value);
    }

    function selectUser(userId) {
      selectedUserId = userId;
      renderUsersLeftList(document.getElementById('users-search-left').value);
      renderUserRightDetails(userId);
    }

    function renderUserRightDetails(userId) {
      const panel = document.getElementById('user-details-right-panel');
      const item = allUsers.find(x => x.user.id === userId);
      if (!item) return;

      const u = item.user;
      const s = item.storage;
      const q = item.quotaConfig;
      const r2 = s.r2;
      const d1 = s.d1;

      const isNet = userStorageViewMode === 'net';
      const displayR2Formatted = isNet ? (s.net ? s.net.r2Formatted : r2.totalFormatted) : (s.gross ? s.gross.r2Formatted : r2.totalFormatted);
      const displayR2Bytes = isNet ? (s.net ? s.net.r2Bytes : r2.totalBytes) : (s.gross ? s.gross.r2Bytes : r2.totalBytes);
      const displayD1Formatted = isNet ? (s.net ? s.net.d1Formatted : d1.totalFormatted) : (s.gross ? s.gross.d1Formatted : d1.totalFormatted);
      const displayD1Bytes = isNet ? (s.net ? s.net.d1Bytes : d1.totalBytes) : (s.gross ? s.gross.d1Bytes : d1.totalBytes);
      const displayD1Rows = isNet ? (s.net ? s.net.d1Rows : d1.totalRows) : (s.gross ? s.gross.d1Rows : d1.totalRows);
      const displayTotalFormatted = isNet ? (s.net ? s.net.totalFormatted : s.totalFormatted) : (s.gross ? s.gross.totalFormatted : s.totalFormatted);
      const displayUsagePercentage = isNet ? (s.net ? s.net.usagePercentage : s.usagePercentage) : (s.gross ? s.gross.usagePercentage : s.usagePercentage);
      const exempted = s.exempted || { totalFormatted: '0 Octets', totalBytes: 0, r2Formatted: '0 Octets', d1Formatted: '0 Octets', exemptD1Rows: 0 };

      panel.innerHTML = \`
        <!-- En-tête profil complet listé verticalement ligne par ligne -->
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div class="flex items-start gap-3.5">
            <div class="relative w-12 h-12 rounded-xl bg-orange-500/20 text-orange-400 font-black flex items-center justify-center border border-orange-500/30 text-lg shrink-0 mt-0.5">
              \${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full rounded-xl object-cover" onerror="this.remove()">' : u.name.charAt(0).toUpperCase()}
              <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 \${u.isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}" title="\${u.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
            </div>
            <div class="space-y-1.5 text-xs">
              <!-- Ligne 1 : Nom et ID -->
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-base font-extrabold text-white">\${u.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">ID: \${u.id}</span>
              </div>
              
              <!-- Ligne 2 : Statut de connexion / En ligne & Bouton d'action -->
              <div class="flex items-center gap-2.5 flex-wrap">
                <span class="text-slate-400 font-medium">Statut :</span>
                \${u.isOnline ? \`
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> En ligne (\${u.lastSeenText})
                  </span>
                \` : \`
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                    <span class="w-2 h-2 rounded-full bg-slate-500"></span> Hors ligne (\${u.lastSeenText})
                  </span>
                \`}
                <button 
                  onclick="toggleUserOnlineStatus('\${u.id}', \${u.isOnline})" 
                  class="px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer transition flex items-center gap-1 shadow-sm \${u.isOnline ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'}"
                  title="Changer manuellement le statut de présence"
                >
                  <span>\${u.isOnline ? '🔴' : '🟢'}</span>
                  <span>Basculer en \${u.isOnline ? 'Hors ligne' : 'En ligne'}</span>
                </button>
              </div>

              <!-- Ligne 3 : Numéro de téléphone -->

              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">📞 Téléphone :</span>
                <span class="text-white font-semibold font-mono">\${u.phone || 'Non renseigné'}</span>
              </div>

              <!-- Ligne 4 : E-mail -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">✉️ E-mail :</span>
                <span class="text-slate-200 font-mono">\${u.email || 'Non renseigné'}</span>
              </div>

              <!-- Ligne 5 : Niveau d'études -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">🎓 Niveau :</span>
                <span class="text-orange-400 font-bold">\${u.level || 'Non spécifié'}</span>
              </div>

              <!-- Ligne 6 : École / Filière -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">🏛️ Filière / École :</span>
                <span class="text-slate-200">\${u.school || 'Non renseigné'} \${u.filiere ? '(' + u.filiere + ')' : (u.country ? '(' + u.country + ')' : '')}</span>
              </div>

              <!-- Ligne 7 : Boutique de services & Détails complets -->
              <div class="space-y-2 pt-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-slate-400 font-medium">🛍️ Boutique de services :</span>
                  \${u.hasShop ? \`
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      <span>🏪</span> Active — \${u.shopName || 'Boutique'} (\${u.shopProductsCount} article\${u.shopProductsCount > 1 ? 's' : ''})
                    </span>
                  \` : \`
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                      <span>⚪</span> Non • Aucune boutique créée
                    </span>
                  \`}
                </div>

                \${u.hasShop ? \`
                  <!-- Carte complète détails boutique -->
                  <div class="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                    <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span class="text-[10px] text-amber-300/70 uppercase font-bold block mb-0.5">Nom de la boutique</span>
                      <span class="text-white font-bold text-xs truncate block">\${u.shopName || 'Boutique active'}</span>
                    </div>
                    <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span class="text-[10px] text-amber-300/70 uppercase font-bold block mb-0.5">📞 Téléphone Boutique</span>
                      <span class="text-slate-200 font-mono font-semibold text-xs block">\${u.shopPhone || u.phone || 'Non renseigné'}</span>
                    </div>
                    <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span class="text-[10px] text-amber-300/70 uppercase font-bold block mb-0.5">💬 WhatsApp Boutique</span>
                      <span class="text-emerald-400 font-mono font-semibold text-xs block">\${u.shopWhatsapp || 'Non renseigné'}</span>
                    </div>
                    <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span class="text-[10px] text-amber-300/70 uppercase font-bold block mb-0.5">🏷️ Catégorie</span>
                      <span class="text-orange-300 font-medium text-xs block truncate">\${u.shopCategory || 'Vente digital (PDF)'}</span>
                    </div>
                    \${u.shopUpdatedAt ? \`
                      <div class="sm:col-span-2 md:col-span-4 text-[10px] text-amber-300/80 border-t border-amber-500/20 pt-1.5 flex items-center gap-1.5 font-mono">
                        <span>🕐 Dernière mise à jour boutique :</span> <strong>\${u.shopUpdatedAt}</strong>
                      </div>
                    \` : ''}
                  </div>
                \` : ''}
              </div>
            </div>
          </div>

          <!-- Encadré Quota Utilisateur (Haut Droit) -->

          <div class="text-right self-start bg-slate-900/90 px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-md shrink-0">
            <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Stockage Consommé</span>
            <div class="text-sm font-mono font-bold text-orange-400">\${displayTotalFormatted} / \${q.totalAllowedFormatted}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Consommation : <strong class="text-white">\${displayUsagePercentage}%</strong></div>
          </div>
        </div>

        <!-- 4 CARRÉS PERSONNELS POUR CET UTILISATEUR -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 border-l-4 border-l-blue-500">
            <span class="text-[10px] uppercase font-bold text-slate-400">Fichiers Personnels</span>
            <div class="text-base font-black text-white mt-0.5">\${(r2.folders['user-files/']?.count || 0) + (r2.folders['ai-studies/']?.count || 0)}</div>
            <div class="text-[10px] text-blue-400 font-medium truncate">\${(r2.folders['user-files/']?.count || 0)} cours, \${(r2.folders['ai-studies/']?.count || 0)} IA</div>
          </div>

          <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 border-l-4 border-l-orange-500">
            <span class="text-[10px] uppercase font-bold text-slate-400">Documents & Fichiers</span>
            <div class="text-base font-black text-orange-400 mt-0.5">\${displayR2Formatted}</div>
            <div class="text-[10px] text-slate-400 font-medium truncate">Stockage Cloudflare</div>
          </div>

          <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 border-l-4 border-l-emerald-500">
            <span class="text-[10px] uppercase font-bold text-slate-400">Données & Base</span>
            <div class="text-base font-black text-emerald-400 mt-0.5">\${displayD1Formatted}</div>
            <div class="text-[10px] text-slate-400 font-medium truncate">\${displayD1Rows} lignes enregistrées</div>
          </div>

          <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 border-l-4 border-l-purple-500">
            <span class="text-[10px] uppercase font-bold text-slate-400">Quota Utilisé</span>
            <div class="text-base font-black text-purple-400 mt-0.5">\${displayUsagePercentage}%</div>
            <div class="text-[10px] text-purple-300 font-medium truncate">Alloué : \${q.totalAllowedFormatted}</div>
          </div>
        </div>

        <!-- BARRE DE PROGRESSION UNIQUE SUR LE QUOTA TOTAL (SANS LIMITEUR SÉPARÉ D1/R2) -->
        <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3 text-xs">
          <div class="space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-slate-300 font-bold">Stockage Global Utilisé (Fichiers + Données)</span>
              <span class="font-mono text-orange-400 font-bold">\${displayTotalFormatted} / \${q.totalAllowedFormatted} (\${displayUsagePercentage}%)</span>
            </div>
            <div class="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div class="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500 rounded-full transition-all duration-500" style="width: \${Math.max(1, Math.min(100, displayUsagePercentage))}%"></div>
            </div>
            <div class="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
              <span>0 Mo</span>
              <span class="text-emerald-400 font-medium">Partage libre • Documents et base puisent dans le même quota sans plafond individuel</span>
              <span>\${q.totalAllowedFormatted}</span>
            </div>
          </div>

          <!-- Détails de consommation réelle par stockage -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <div class="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-400 uppercase font-bold block">Documents & Fichiers</span>
                <span class="font-mono font-bold text-blue-400 text-xs">\${displayR2Formatted}</span>
              </div>
              <span class="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Sur quota global
              </span>
            </div>

            <div class="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-400 uppercase font-bold block">Données & Base</span>
                <span class="font-mono font-bold text-emerald-400 text-xs">\${displayD1Formatted} (\${displayD1Rows} lignes)</span>
              </div>
              <span class="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                Sur quota global
              </span>
            </div>
          </div>
        </div>

        <!-- ACCORDÉONS TABLES D1 DE L'UTILISATEUR -->
        <div class="space-y-1.5">
          <h4 class="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>🗄️</span> Tables D1 de \${u.name}
          </h4>
          <div class="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800/80">
            \${tablesMeta.map((t, idx) => {
              const stats = d1.tables[t.table] || { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false };
              const isExempt = t.isExempted || stats.isExempted;
              const accId = 'acc-user-d1-' + idx;
              return \`
                <div>
                  <div onclick="toggleAccordion('\${accId}')" class="px-2.5 py-1.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 select-none gap-2">
                    <div class="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                      <span class="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-[10px] shrink-0">\${t.table}</span>
                      <span class="text-slate-400 text-[10px] truncate max-w-[130px] sm:max-w-[200px] md:max-w-[280px]">\${t.label}</span>
                      \${isExempt ? \`
                        <span class="px-1.5 py-0.5 rounded text-[8px] font-medium bg-slate-800 text-slate-400 border border-slate-700 shrink-0">🌐 Public</span>
                      \` : \`
                        <span class="hidden md:inline-flex px-1.5 py-0.5 rounded text-[8px] font-medium bg-slate-800 text-slate-400 border border-slate-700 shrink-0">📌 Perso</span>
                      \`}
                    </div>
                    <div class="flex items-center gap-1.5 font-mono text-[10px] shrink-0 whitespace-nowrap">
                      <span class="font-bold text-emerald-400 text-[10px]">\${stats.formatted}</span>
                      <span class="text-slate-500 text-[9px]">(\${stats.count} lig.)</span>
                      <svg id="\${accId}-icon" class="w-3 h-3 text-slate-400 transition-transform duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                  <div id="\${accId}" class="accordion-content bg-[#070b14] border-t border-slate-800/60 px-3 text-[10px] text-slate-300">
                    <div class="py-2 space-y-1">
                      \${isExempt ? \`
                        <div class="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-medium flex items-center gap-1.5">
                          <span>🌐</span> <span>Table partagée/publique. Non décomptée du quota personnel.</span>
                        </div>
                      \` : ''}
                      <div><strong class="text-emerald-400">📍 Connexion UI :</strong> \${t.uiConnection}</div>
                      <div><strong class="text-blue-400">🎯 Rôle :</strong> \${t.role}</div>
                    </div>
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        </div>

        <!-- ACCORDÉONS DOSSIERS R2 DE L'UTILISATEUR -->
        <div class="space-y-1.5">
          <h4 class="text-[11px] font-extrabold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>📦</span> Fichiers R2 de \${u.name}
          </h4>
          <div class="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800/80">
            \${r2Meta.map((r, idx) => {
              const stats = r2.folders[r.folder] || { count: 0, bytes: 0, formatted: '0 Octets', isExempted: false };
              const isExempt = r.isExempted || stats.isExempted;
              const accId = 'acc-user-r2-' + idx;
              return \`
                <div>
                  <div onclick="toggleAccordion('\${accId}')" class="px-2.5 py-1.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 select-none gap-2">
                    <div class="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                      <span class="font-mono font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 text-[10px] shrink-0">\${r.folder}</span>
                      <span class="text-slate-400 text-[10px] truncate max-w-[130px] sm:max-w-[200px] md:max-w-[280px]">\${r.name}</span>
                      \${isExempt ? \`
                        <span class="px-1.5 py-0.5 rounded text-[8px] font-medium bg-slate-800 text-slate-400 border border-slate-700 shrink-0">🌐 Public</span>
                      \` : \`
                        <span class="hidden md:inline-flex px-1.5 py-0.5 rounded text-[8px] font-medium bg-slate-800 text-slate-400 border border-slate-700 shrink-0">📌 Perso</span>
                      \`}
                    </div>
                    <div class="flex items-center gap-1.5 font-mono text-[10px] shrink-0 whitespace-nowrap">
                      <span class="font-bold text-orange-400 text-[10px]">\${stats.formatted}</span>
                      <span class="text-slate-500 text-[9px]">(\${stats.count} fich.)</span>
                      <svg id="\${accId}-icon" class="w-3 h-3 text-slate-400 transition-transform duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                  <div id="\${accId}" class="accordion-content bg-[#070b14] border-t border-slate-800/60 px-3 text-[10px] text-slate-300">
                    <div class="py-2 space-y-1">
                      \${isExempt ? \`
                        <div class="p-1.5 rounded bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-medium flex items-center gap-1.5">
                          <span>🌐</span> <span>Fichiers publiés dans Ressources. Non décomptés du quota personnel.</span>
                        </div>
                      \` : ''}
                      <div><strong class="text-emerald-400">📍 Connexion UI :</strong> \${r.uiConnection}</div>
                      <div><strong class="text-blue-400">🎯 Rôle :</strong> \${r.role}</div>
                    </div>
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        </div>
      \`;
    }

    // ========================================================================
    // VUE 3 : DEMANDES DE STOCKAGE & AJUSTEMENT DES QUOTAS INDIVIDUELS
    // ========================================================================
    function renderDistributionUsersList() {
      const container = document.getElementById('distribution-users-left-list');
      container.innerHTML = allUsers.map(item => {
        const u = item.user;
        const q = item.quotaConfig;
        const s = item.storage;
        const isSelected = u.id === selectedDistributionUserId;

        return \`
          <div 
            onclick="selectDemandeUser('\${u.id}')"
            class="p-2.5 cursor-pointer transition-all flex items-center justify-between \${isSelected ? 'bg-orange-600/15 border-l-4 border-l-orange-500' : 'hover:bg-slate-800/40'}"
          >
            <div class="flex items-center gap-2 overflow-hidden">
              <div class="relative w-8 h-8 rounded-lg bg-slate-800 text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-700">
                \${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full rounded-lg object-cover" onerror="this.remove()">' : u.name.charAt(0).toUpperCase()}
                <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 \${u.isOnline ? 'bg-emerald-500' : 'bg-slate-600'}" title="\${u.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
              </div>
              <div class="truncate">
                <div class="font-bold text-white truncate text-xs flex items-center gap-1">
                  <span>\${u.name}</span>
                  \${u.hasShop ? '<span class="text-[9px] px-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30" title="Boutique active">🏪</span>' : ''}
                </div>
                <div class="text-[10px] text-slate-400 truncate">📞 \${u.phone || 'Sans numéro'} • \${u.level}</div>
              </div>
            </div>
            <div class="text-right shrink-0 font-mono text-[11px]">
              <span class="font-bold text-emerald-400">\${q.totalAllowedFormatted}</span>
              <div class="text-[9px] text-orange-400">Net : \${s.net ? s.net.totalFormatted : s.totalFormatted}</div>
            </div>
          </div>
        \`;
      }).join('');
    }

    function selectDistributionUser(userId) {
      selectedDistributionUserId = userId;
      renderDistributionUsersList();
      renderDistributionRightDetails(userId);
    }
    const selectDemandeUser = selectDistributionUser;
    const renderDemandesUsersList = renderDistributionUsersList;

    function renderDistributionRightDetails(userId) {
      const panel = document.getElementById('distribution-right-panel');
      const item = allUsers.find(x => x.user.id === userId);
      if (!item) return;

      const u = item.user;
      const q = item.quotaConfig;
      const s = item.storage;

      panel.innerHTML = \`
        <!-- En-tête profil complet listé verticalement ligne par ligne -->
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div class="flex items-start gap-3.5">
            <div class="relative w-12 h-12 rounded-xl bg-orange-500/20 text-orange-400 font-black flex items-center justify-center border border-orange-500/30 text-lg shrink-0 mt-0.5">
              \${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full rounded-xl object-cover" onerror="this.remove()">' : u.name.charAt(0).toUpperCase()}
              <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 \${u.isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}" title="\${u.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
            </div>
            <div class="space-y-1.5 text-xs">
              <!-- Ligne 1 : Nom et ID -->
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-base font-extrabold text-white">\${u.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">ID: \${u.id}</span>
              </div>
              
              <!-- Ligne 2 : Statut de connexion / En ligne & Bouton d'action -->
              <div class="flex items-center gap-2.5 flex-wrap">
                <span class="text-slate-400 font-medium">Statut :</span>
                \${u.isOnline ? \`
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> En ligne (\${u.lastSeenText})
                  </span>
                \` : \`
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                    <span class="w-2 h-2 rounded-full bg-slate-500"></span> Hors ligne (\${u.lastSeenText})
                  </span>
                \`}
                <button 
                  onclick="toggleUserOnlineStatus('\${u.id}', \${u.isOnline})" 
                  class="px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer transition flex items-center gap-1 shadow-sm \${u.isOnline ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40'}"
                  title="Changer manuellement le statut de présence"
                >
                  <span>\${u.isOnline ? '🔴' : '🟢'}</span>
                  <span>Basculer en \${u.isOnline ? 'Hors ligne' : 'En ligne'}</span>
                </button>
              </div>

              <!-- Ligne 3 : Numéro de téléphone -->

              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">📞 Téléphone :</span>
                <span class="text-white font-semibold font-mono">\${u.phone || 'Non renseigné'}</span>
              </div>

              <!-- Ligne 4 : E-mail -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">✉️ E-mail :</span>
                <span class="text-slate-200 font-mono">\${u.email || 'Non renseigné'}</span>
              </div>

              <!-- Ligne 5 : Niveau d'études -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">🎓 Niveau :</span>
                <span class="text-orange-400 font-bold">\${u.level || 'Non spécifié'}</span>
              </div>

              <!-- Ligne 6 : École / Filière -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">🏛️ Filière / École :</span>
                <span class="text-slate-200">\${u.school || 'Non renseigné'} \${u.filiere ? '(' + u.filiere + ')' : (u.country ? '(' + u.country + ')' : '')}</span>
              </div>

              <!-- Ligne 7 : Boutique de services & Détails complets -->
              <div class="space-y-2 pt-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-slate-400 font-medium">🛍️ Boutique de services :</span>
                  \${u.hasShop ? \`
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      <span>🏪</span> Active — \${u.shopName || 'Boutique'} (\${u.shopProductsCount} article\${u.shopProductsCount > 1 ? 's' : ''})
                    </span>
                  \` : \`
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                      <span>⚪</span> Non • Aucune boutique créée
                    </span>
                  \`}
                </div>

                \${u.hasShop ? \`
                  <!-- Carte complète détails boutique -->
                  <div class="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                    <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span class="text-[10px] text-amber-300/70 uppercase font-bold block mb-0.5">Nom de la boutique</span>
                      <span class="text-white font-bold text-xs truncate block">\${u.shopName || 'Boutique active'}</span>
                    </div>
                    <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span class="text-[10px] text-amber-300/70 uppercase font-bold block mb-0.5">📞 Téléphone Boutique</span>
                      <span class="text-slate-200 font-mono font-semibold text-xs block">\${u.shopPhone || u.phone || 'Non renseigné'}</span>
                    </div>
                    <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span class="text-[10px] text-amber-300/70 uppercase font-bold block mb-0.5">💬 WhatsApp Boutique</span>
                      <span class="text-emerald-400 font-mono font-semibold text-xs block">\${u.shopWhatsapp || 'Non renseigné'}</span>
                    </div>
                    <div class="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span class="text-[10px] text-amber-300/70 uppercase font-bold block mb-0.5">🏷️ Catégorie</span>
                      <span class="text-orange-300 font-medium text-xs block truncate">\${u.shopCategory || 'Vente digital (PDF)'}</span>
                    </div>
                    \${u.shopUpdatedAt ? \`
                      <div class="sm:col-span-2 md:col-span-4 text-[10px] text-amber-300/80 border-t border-amber-500/20 pt-1.5 flex items-center gap-1.5 font-mono">
                        <span>🕐 Dernière mise à jour boutique :</span> <strong>\${u.shopUpdatedAt}</strong>
                      </div>
                    \` : ''}
                  </div>
                \` : ''}
              </div>
            </div>
          </div>

          <!-- Encadré Quota Utilisateur (Haut Droit) -->

          <div class="text-right self-start bg-slate-900/90 px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-md shrink-0">
            <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Stockage Consommé</span>
            <div class="text-sm font-mono font-bold text-orange-400">\${s.net ? s.net.totalFormatted : s.totalFormatted} / \${q.totalAllowedFormatted}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">Consommation : <strong class="text-white">\${s.net ? s.net.usagePercentage : s.usagePercentage}%</strong></div>
          </div>
        </div>

        <!-- 3 CARTES DÉTAILLÉES : BIENVENUE, PAYANT, TOTAL -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 border-l-4 border-l-blue-500">
            <div class="flex items-center justify-between">
              <span class="text-[10px] uppercase font-bold text-slate-400">🎁 Bienvenue</span>
              <span class="text-xs font-mono font-bold text-blue-400">\${q.welcomeTotalMb} Mo</span>
            </div>
            <div class="text-[11px] text-slate-300 mt-2 space-y-0.5 font-mono">
              <div class="text-blue-300 font-sans text-[11px]">Quota gratuit à l'inscription</div>
              <div class="text-[10px] text-slate-400">Partage libre fichiers & données</div>
            </div>
          </div>

          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 border-l-4 border-l-emerald-500">
            <div class="flex items-center justify-between">
              <span class="text-[10px] uppercase font-bold text-slate-400">💳 Payant / Acheté</span>
              <span class="text-xs font-mono font-bold text-emerald-400">\${q.paidTotalMb} Mo</span>
            </div>
            <div class="text-[11px] text-slate-300 mt-2 space-y-0.5 font-mono">
              <div class="text-emerald-300 font-sans text-[11px]">Stockage additionnel payé</div>
              <div class="text-[10px] text-slate-400">Partage libre fichiers & données</div>
            </div>
          </div>

          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 border-l-4 border-l-orange-500">
            <div class="flex items-center justify-between">
              <span class="text-[10px] uppercase font-bold text-slate-400">📈 Quota Total</span>
              <span class="text-xs font-mono font-bold text-orange-400">\${q.totalAllowedFormatted}</span>
            </div>
            <div class="text-[11px] text-slate-300 mt-2 space-y-0.5 font-mono">
              <div>Bienvenue + Payant</div>
              <div class="text-orange-300">Plan : <strong>\${q.planName.toUpperCase()}</strong></div>
            </div>
          </div>
        </div>

        <!-- DÉTAILS DU STOCKAGE ACTUEL -->
        <div class="p-3 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2">
            <span class="text-base">⚡</span>
            <div>
              <div class="font-bold text-white flex items-center gap-2">
                <span>Stockage Réel Consommé :</span>
                <span class="text-orange-400 font-black font-mono">\${s.net ? s.net.totalFormatted : s.totalFormatted}</span>
                <span class="text-slate-400 text-[11px]">(\${s.net ? s.net.usagePercentage : s.usagePercentage}% du quota)</span>
              </div>
              <div class="text-[11px] text-slate-400 mt-0.5">
                Ressources publiques communautaires et statistiques d'accès non décomptées du quota de l'étudiant.
              </div>
            </div>
          </div>
          <div class="text-right shrink-0 font-mono text-[11px] bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-slate-400">
            Quota total : <strong class="text-emerald-400">\${q.totalAllowedFormatted}</strong>
          </div>
        </div>

        <!-- FORMULAIRE DE MODIFICATION DES QUOTAS DE L'UTILISATEUR -->
        <div class="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-4">
          <h4 class="text-xs font-bold text-white flex items-center gap-2">
            <span>⚙️</span> Modifier le Stockage de cet Utilisateur (Sauvegarde dans D1)
          </h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <!-- Modification Stockage Bienvenue -->
            <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
              <span class="text-blue-400 font-bold block text-xs">1. Stockage de Bienvenue Global (Mo) :</span>
              <div class="flex items-center justify-between gap-2">
                <label class="text-slate-400">Quota Bienvenue :</label>
                <input type="number" id="user-edit-w-total" class="w-28 bg-slate-900 text-white font-mono text-xs px-2.5 py-1 rounded border border-slate-700 text-center" value="\${q.welcomeTotalMb}">
              </div>
              <p class="text-[10px] text-slate-500">Partage libre entre documents (R2) et base (D1)</p>
            </div>

            <!-- Modification Stockage Payant -->
            <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
              <span class="text-emerald-400 font-bold block text-xs">2. Stockage Payant Additionnel (Mo) :</span>
              <div class="flex items-center justify-between gap-2">
                <label class="text-slate-400">Quota Acheté :</label>
                <input type="number" id="user-edit-p-total" class="w-28 bg-slate-900 text-white font-mono text-xs px-2.5 py-1 rounded border border-slate-700 text-center" value="\${q.paidTotalMb}">
              </div>
              <p class="text-[10px] text-slate-500">Ajouté au stockage total de l'utilisateur</p>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div class="text-[11px] text-slate-400">
              * D1 et R2 ne sont pas limités séparément : seul le <strong>total des deux</strong> est décompté du quota.
            </div>

            <button 
              onclick="saveUserQuota('\${u.id}')"
              class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <span>💾</span> Enregistrer le Stockage de cet Utilisateur
            </button>
          </div>
        </div>
      \`;
    }

    // ========================================================================
    // FORMATAGE DATE & HEURE EN FRANÇAIS COMPLET (HEURE, MINUTE, JOUR, MOIS, ANNÉE)
    // ========================================================================
    function formatFullDateFrench(dateStr) {
      if (!dateStr) return 'Date non renseignée';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const dayName = days[d.getDay()];
        const day = String(d.getDate()).padStart(2, '0');
        const monthName = months[d.getMonth()];
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        return dayName + ' ' + day + ' ' + monthName + ' ' + year + ' à ' + hours + 'h' + minutes + ':' + seconds;
      } catch (e) {
        return dateStr;
      }
    }

    function formatShortDateFrench(dateStr) {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes;
      } catch (e) {
        return dateStr;
      }
    }

    // ========================================================================
    // HELPER : DÉTECTION DEMANDES & ABONNEMENTS IA VS STOCKAGE
    // ========================================================================
    function isAiRequest(r) {
      if (!r) return false;
      const reqType = String(r.request_type || '').toLowerCase();
      if (reqType === 'ai' || reqType === 'credits' || reqType === 'ia' || reqType === 'ai_subscription') return true;
      const packId = String(r.pack_id || '').toLowerCase();
      if (packId.includes('ai') || packId.includes('ia') || packId.includes('credit')) return true;
      const packName = String(r.pack_name || '').toLowerCase();
      if (packName.includes('ia') || packName.includes('delmas') || packName.includes('mots') || packName.includes('assistante') || packName.includes('credit')) return true;
      const storageDisplay = String(r.storage_display || '').toLowerCase();
      if (storageDisplay.includes('mots') || storageDisplay.includes('ia') || storageDisplay.includes('credit') || storageDisplay.includes('token')) return true;
      if (Number(r.additional_words || 0) > 0 && Number(r.additional_mb || 0) <= 0) return true;
      return false;
    }

    function isAiSubscription(s) {
      if (!s) return false;
      const planName = String(s.plan_name || '').toLowerCase();
      if (planName.includes('ia') || planName.includes('delmas') || planName.includes('mots') || planName.includes('credit') || planName.includes('assistante')) return true;
      const id = String(s.id || '').toLowerCase();
      if (id.includes('ai') || id.includes('ia')) return true;
      return false;
    }

    // ========================================================================
    // NOUVELLE VUE : GESTION DES DEMANDES DE STOCKAGE & ABONNEMENTS (V2)
    // ========================================================================
    function setDemandesTab(tab) {
      currentDemandeTab = tab;
      ['pending', 'active', 'cancelled', 'all'].forEach(t => {
        const btn = document.getElementById('demande-tab-' + t);
        if (!btn) return;
        if (t === tab) {
          btn.className = "px-2 py-1.5 rounded-lg bg-orange-600 text-white flex items-center justify-between transition-all cursor-pointer shadow-sm";
        } else {
          btn.className = "px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700/80 flex items-center justify-between transition-all cursor-pointer";
        }
      });

      const label = document.getElementById('demandes-filter-label');
      if (label) {
        const labels = {
          pending: "Demandes d'augmentation en attente de validation",
          active: "Abonnements de stockage en cours",
          cancelled: "Abonnements résiliés / annulés",
          all: "Tous les utilisateurs inscrits & Bilans abonnements"
        };
        label.textContent = labels[tab] || '';
      }

      updateDemandesTabCounts();
      renderDemandesLeftList();
      autoSelectFirstDemande();
    }

    function updateDemandesTabCounts() {
      const pendingCount = allRequests.filter(r => r.status === 'pending' && !isAiRequest(r)).length;
      const activeCount = allSubscriptions.filter(s => s.status === 'active' && !isAiSubscription(s)).length;
      const cancelledCount = allSubscriptions.filter(s => s.status === 'cancelled' && !isAiSubscription(s)).length;
      const allUsersCount = allUsers.length;

      const pEl = document.getElementById('tab-count-pending');
      const aEl = document.getElementById('tab-count-active');
      const cEl = document.getElementById('tab-count-cancelled');
      const allEl = document.getElementById('tab-count-all');

      if (pEl) pEl.textContent = pendingCount;
      if (aEl) aEl.textContent = activeCount;
      if (cEl) cEl.textContent = cancelledCount;
      if (allEl) allEl.textContent = allUsersCount;
    }

    function filterDemandesLeft() {
      renderDemandesLeftList();
    }

    function autoSelectFirstDemande() {
      const q = (document.getElementById('demandes-search-input')?.value || '').toLowerCase().trim();
      let list = getFilteredDemandesList(q);
      if (list.length > 0) {
        const first = list[0];
        selectedDemandeId = first.id;
        selectedDemandeType = first.itemType;
        renderDemandeDetail(first.id, first.itemType);
        renderDemandesLeftList();
      } else {
        selectedDemandeId = null;
        const panel = document.getElementById('demandes-right-detail-panel');
        if (panel) {
          panel.innerHTML = '<div class="h-full flex flex-col items-center justify-center text-center text-slate-500 py-20">' +
            '<div class="w-16 h-16 rounded-2xl bg-slate-800/60 text-3xl flex items-center justify-center mb-3">📥</div>' +
            '<h3 class="text-sm font-bold text-slate-300">Aucun élément dans cette section</h3>' +
            '<p class="text-xs text-slate-500 mt-1 max-w-sm">Aucune demande ou utilisateur ne correspond au filtre sélectionné.</p>' +
          '</div>';
        }
      }
    }

    function getFilteredDemandesList(q = '') {
      let combined = [];

      // 1. ONGLET 'pending' : UNIQUEMENT les demandes d'augmentation en attente réelles (hors IA)
      if (currentDemandeTab === 'pending') {
        allRequests.filter(r => r.status === 'pending' && !isAiRequest(r)).forEach(req => {
          const user = allUsers.find(u => u.user.id === req.user_id);
          const isRenewal = req.request_type === 'renewal' ||
            (req.pack_name && req.pack_name.toLowerCase().includes('renouvellement')) ||
            (req.notes && req.notes.toLowerCase().includes('renouvellement'));
          combined.push({
            id: req.id,
            itemType: 'request',
            raw: req,
            isRenewal: Boolean(isRenewal),
            requestType: isRenewal ? 'renewal' : (req.request_type || 'upgrade'),
            userId: req.user_id,
            userName: req.user_name || (user ? user.user.name : 'Utilisateur'),
            userPhone: req.contact_phone || req.user_phone || (user ? user.user.phone : ''),
            contactPhone: req.contact_phone || req.user_phone || (user ? user.user.phone : ''),
            userWhatsapp: req.user_whatsapp || '',
            storageDisplay: req.storage_display || '',
            priceDisplay: req.price_display || '',
            billingCycle: req.billing_cycle || 'annual',
            notes: req.notes || '',
            userAvatar: user ? user.user.avatar_url : '',
            isOnline: user ? user.user.isOnline : false,
            packName: req.pack_name || 'Pack Stockage',
            amountMb: req.additional_mb || 0,
            pricePaid: req.price_paid || 0,
            currency: req.currency || 'FCFA',
            status: 'pending',
            date: req.created_at,
            receiptUrl: req.receipt_image_url || '',
            receiptR2Key: req.receipt_r2_key || ''
          });
        });
      }

      // 2. ONGLET 'active' : Abonnements actifs (hors IA)
      else if (currentDemandeTab === 'active') {
        allSubscriptions.filter(s => s.status === 'active' && !isAiSubscription(s)).forEach(sub => {
          const user = allUsers.find(u => u.user.id === sub.user_id);
          combined.push({
            id: sub.id,
            itemType: 'subscription',
            raw: sub,
            userId: sub.user_id,
            userName: sub.user_name || (user ? user.user.name : 'Abonné'),
            userPhone: sub.user_phone || (user ? user.user.phone : ''),
            userAvatar: user ? user.user.avatar_url : '',
            isOnline: user ? user.user.isOnline : false,
            packName: sub.plan_name || 'Abonnement Stockage',
            amountMb: sub.total_storage_mb || 0,
            pricePaid: sub.monthly_price || 0,
            currency: sub.currency || 'FCFA',
            status: 'active',
            date: sub.start_date || sub.created_at,
            endDate: sub.end_date || '',
            gracePeriodDays: sub.grace_period_days || 5,
            receiptUrl: '',
            receiptR2Key: ''
          });
        });
      }

      // 3. ONGLET 'cancelled' : Abonnements annulés / résiliés (hors IA)
      else if (currentDemandeTab === 'cancelled') {
        allSubscriptions.filter(s => s.status === 'cancelled' && !isAiSubscription(s)).forEach(sub => {
          const user = allUsers.find(u => u.user.id === sub.user_id);
          combined.push({
            id: sub.id,
            itemType: 'subscription',
            raw: sub,
            userId: sub.user_id,
            userName: sub.user_name || (user ? user.user.name : 'Abonné'),
            userPhone: sub.user_phone || (user ? user.user.phone : ''),
            userAvatar: user ? user.user.avatar_url : '',
            isOnline: user ? user.user.isOnline : false,
            packName: sub.plan_name || 'Abonnement Stockage',
            amountMb: sub.total_storage_mb || 0,
            pricePaid: sub.monthly_price || 0,
            currency: sub.currency || 'FCFA',
            status: 'cancelled',
            date: sub.created_at || sub.start_date,
            cancelledAt: sub.cancelled_at || '',
            previousStorageMb: sub.previous_storage_mb || 0,
            cancelReason: sub.cancel_reason || '',
            receiptUrl: '',
            receiptR2Key: ''
          });
        });
      }

      // 4. ONGLET 'all' : TOUS LES UTILISATEURS INSCRITS (DONNÉES RÉELLES DE LA BASE)
      else if (currentDemandeTab === 'all') {
        allUsers.forEach(u => {
          const activeSub = allSubscriptions.find(s => s.user_id === u.user.id && s.status === 'active' && !isAiSubscription(s));
          const cancelledSubs = allSubscriptions.filter(s => s.user_id === u.user.id && s.status === 'cancelled' && !isAiSubscription(s));
          const totalSubsCount = allSubscriptions.filter(s => s.user_id === u.user.id && !isAiSubscription(s)).length;
          const pendingReqsCount = allRequests.filter(r => r.user_id === u.user.id && r.status === 'pending' && !isAiRequest(r)).length;

          const totalAllowedBytes = u.quotaConfig.totalAllowedBytes || (30 * 1024 * 1024);
          const usedBytes = u.storage.net ? (u.storage.net.totalBytes || 0) : (u.storage.totalBytes || 0);
          const remainingBytes = Math.max(0, totalAllowedBytes - usedBytes);
          const remainingFormatted = formatBytes(remainingBytes);

          combined.push({
            id: 'user_' + u.user.id,
            itemType: 'user',
            raw: u,
            userId: u.user.id,
            userName: u.user.name,
            userPhone: u.user.phone,
            userAvatar: u.user.avatar_url,
            isOnline: u.user.isOnline,
            registeredAt: u.user.created_at,
            activeSub: activeSub || null,
            cancelledSubsCount: cancelledSubs.length,
            cancelledSubs: cancelledSubs,
            totalSubsCount: totalSubsCount,
            pendingReqsCount: pendingReqsCount,
            remainingFormatted: remainingFormatted,
            remainingBytes: remainingBytes,
            totalAllowedFormatted: u.quotaConfig.totalAllowedFormatted,
            isPaid: Boolean(activeSub || (u.quotaConfig.paidTotalMb > 0)),
            date: u.user.created_at
          });
        });
      }

      // Tri antéchronologique
      combined.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      if (!q) return combined;

      return combined.filter(item => {
        const text = (item.userName + ' ' + (item.userPhone || '') + ' ' + (item.packName || '') + ' ' + (item.status || '') + ' ' + item.userId).toLowerCase();
        return text.includes(q);
      });
    }

    function renderDemandesLeftList() {
      const container = document.getElementById('demandes-left-items-list');
      if (!container) return;

      const q = (document.getElementById('demandes-search-input')?.value || '').toLowerCase().trim();
      const list = getFilteredDemandesList(q);

      if (list.length === 0) {
        let emptyMsg = "Aucun élément trouvé.";
        if (currentDemandeTab === 'pending') emptyMsg = "Aucune demande d'augmentation en attente.";
        else if (currentDemandeTab === 'active') emptyMsg = "Aucun abonnement en cours.";
        else if (currentDemandeTab === 'cancelled') emptyMsg = "Aucun abonnement annulé.";
        else if (currentDemandeTab === 'all') emptyMsg = "Aucun utilisateur trouvé.";

        container.innerHTML = \`
          <div class="p-6 text-center text-slate-500 text-xs">
            \${emptyMsg}
          </div>
        \`;
        return;
      }

      container.innerHTML = list.map(item => {
        const isSelected = item.id === selectedDemandeId;

        // CAS A : ÉLÉMENT UTILISATEUR (ONGLET TOUS)
        if (item.itemType === 'user') {
          let userBadge = '';
          if (item.activeSub) {
            userBadge = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Abonné</span>';
          } else if (item.cancelledSubsCount > 0) {
            userBadge = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">🔴 Ex-abonné</span>';
          } else {
            userBadge = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">Mode Gratuit</span>';
          }

          return \`
            <div 
              onclick="selectDemandeItem('\${item.id}', 'user')"
              class="p-2.5 cursor-pointer transition-all flex items-center justify-between \${isSelected ? 'bg-orange-600/15 border-l-4 border-l-orange-500' : 'hover:bg-slate-800/40'}"
            >
              <div class="flex items-center gap-2.5 overflow-hidden">
                <div class="relative w-9 h-9 rounded-xl bg-slate-800 text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-700">
                  \${item.userAvatar ? '<img src="' + item.userAvatar + '" class="w-full h-full rounded-xl object-cover" onerror="this.remove()">' : item.userName.charAt(0).toUpperCase()}
                  <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 \${item.isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}" title="\${item.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
                </div>
                <div class="truncate">
                  <div class="font-bold text-white truncate text-xs flex items-center gap-1.5">
                    <span class="truncate">\${item.userName}</span>
                  </div>
                  <div class="text-[10px] text-slate-400 truncate">
                    📞 \${item.userPhone || 'Sans numéro'}
                  </div>
                  <div class="text-[9px] text-slate-500 font-mono mt-0.5">
                    Inscrit le \${formatShortDateFrench(item.registeredAt)}
                  </div>
                </div>
              </div>

              <div class="text-right shrink-0 space-y-1">
                \${userBadge}
                <div class="text-[11px] font-mono font-bold text-emerald-400">Reste : \${item.remainingFormatted}</div>
                <div class="text-[9px] text-slate-500 font-mono">Quota : \${item.totalAllowedFormatted}</div>
              </div>
            </div>
          \`;
        }

        // CAS B : DEMANDE OU ABONNEMENT (ONGLETS EN ATTENTE, ABONNÉS, ANNULÉS)
        const formattedAmount = item.amountMb >= 1024 
          ? (item.amountMb / 1024).toFixed(item.amountMb % 1024 === 0 ? 0 : 1) + ' Go' 
          : item.amountMb + ' Mo';

        let badgeHtml = '';
        if (item.status === 'pending') {
          badgeHtml = item.isRenewal
            ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">🔄 Renouvellement</span>'
            : '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 En attente</span>';
        } else if (item.status === 'active' || item.status === 'approved') {
          badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Abonné</span>';
        } else if (item.status === 'cancelled') {
          badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">🔴 Annulé</span>';
        } else {
          badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">⚪ Rejeté</span>';
        }

        return \`
          <div 
            onclick="selectDemandeItem('\${item.id}', '\${item.itemType}')"
            class="p-2.5 cursor-pointer transition-all flex items-center justify-between \${isSelected ? 'bg-orange-600/15 border-l-4 border-l-orange-500' : 'hover:bg-slate-800/40'}"
          >
            <div class="flex items-center gap-2.5 overflow-hidden">
              <div class="relative w-9 h-9 rounded-xl bg-slate-800 text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-700">
                \${item.userAvatar ? '<img src="' + item.userAvatar + '" class="w-full h-full rounded-xl object-cover" onerror="this.remove()">' : item.userName.charAt(0).toUpperCase()}
                <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 \${item.isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}" title="\${item.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
              </div>
              <div class="truncate">
                <div class="font-bold text-white truncate text-xs flex items-center gap-1.5">
                  <span class="truncate">\${item.userName}</span>
                </div>
                <div class="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <span>📞 \${item.userPhone || 'Sans numéro'}</span>
                  <span>•</span>
                  <span class="text-orange-400 font-medium truncate">\${item.isRenewal ? '🔄 Renouvellement : ' + item.packName.replace(/^Renouvellement des abonnements\\s*[-–:]\\s*/i, '') : item.packName}</span>
                </div>
                <div class="text-[9px] text-slate-500 font-mono mt-0.5">
                  \${formatShortDateFrench(item.date)}
                </div>
              </div>
            </div>

            <div class="text-right shrink-0 space-y-1">
              \${badgeHtml}
              <div class="text-xs font-mono font-bold text-white">+\${formattedAmount}</div>
              \${item.pricePaid > 0 ? \`<div class="text-[10px] font-mono text-emerald-400 font-semibold">\${Number(item.pricePaid).toLocaleString('fr-FR')} \${item.currency}</div>\` : ''}
            </div>
          </div>
        \`;
      }).join('');
    }

    function selectDemandeItem(id, itemType) {
      selectedDemandeId = id;
      selectedDemandeType = itemType;
      renderDemandesLeftList();
      renderDemandeDetail(id, itemType);
    }

    // ========================================================================
    // HELPER : CALCUL DES JOURS RESTANTS AVANT EXPIRATION D'ABONNEMENT
    // ========================================================================
    function calculateDaysRemaining(dateStr) {
      if (!dateStr) return null;
      try {
        const target = new Date(dateStr);
        if (isNaN(target.getTime())) return null;
        const now = new Date();
        const diffMs = target.getTime() - now.getTime();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      } catch (e) {
        return null;
      }
    }

    // ========================================================================
    // HELPER : ZOOM SÉCURISÉ DU REÇU DE PAIEMENT SÉLECTIONNÉ SANS RISQUE D'INJECTION
    // ========================================================================
    function openCurrentReceiptZoom() {
      if (window.currentViewedReceiptUrl) {
        openReceiptZoomModal(window.currentViewedReceiptUrl, window.currentViewedReceiptCaption || "Reçu de paiement");
      } else {
        alert("Aucun fichier reçu n'est disponible pour cette demande.");
      }
    }

    // ========================================================================
    // PANNEAU DROIT : DÉTAILS DEMANDE, BILAN UTILISATEUR OU ABONNEMENT
    // ========================================================================
    function renderDemandeDetail(id, itemType) {
      const panel = document.getElementById('demandes-right-detail-panel');
      if (!panel) return;

      try {
        const q = (document.getElementById('demandes-search-input')?.value || '').toLowerCase().trim();
        const list = getFilteredDemandesList(q);
        const item = list.find(x => String(x.id) === String(id)) || list.find(x => x.id == id) || list[0];

        if (!item) {
          panel.innerHTML = '<div class="p-8 text-center text-slate-500 text-xs">Élément introuvable.</div>';
          return;
        }

        // Récupérer l'utilisateur correspondant dans allUsers
        const userDetail = allUsers.find(u => u.user.id === item.userId);
        const u = userDetail ? userDetail.user : {
          id: item.userId,
          name: item.userName || 'Étudiant',
          phone: item.userPhone || '',
          email: 'Non renseigné',
          level: 'Étudiant',
          school: 'Non renseignée',
          filiere: '',
          isOnline: item.isOnline || false,
          created_at: item.date || new Date().toISOString()
        };
        const quota = userDetail ? userDetail.quotaConfig : {
          totalAllowedFormatted: '30 Mo',
          totalAllowedBytes: 30 * 1024 * 1024,
          welcomeTotalMb: 30,
          paidTotalMb: 0
        };
        const storage = userDetail ? userDetail.storage : {
          totalFormatted: '0 Octets',
          totalBytes: 0,
          usagePercentage: 0
        };

        const usedBytes = storage.net ? (storage.net.totalBytes || 0) : (storage.totalBytes || 0);
        const totalBytes = quota.totalAllowedBytes || (30 * 1024 * 1024);
        const remainingBytes = Math.max(0, totalBytes - usedBytes);
        const remainingFormatted = formatBytes(remainingBytes);
        const usedFormatted = storage.net ? storage.net.totalFormatted : storage.totalFormatted;
        const usagePct = Math.max(0, Math.min(100, storage.net ? storage.net.usagePercentage : (storage.usagePercentage || 0)));

        // Statistiques et souscriptions pour cet utilisateur
        const userActiveSub = allSubscriptions.find(s => s.user_id === u.id && s.status === 'active');
        const userCancelledSubs = allSubscriptions.filter(s => s.user_id === u.id && s.status === 'cancelled');
        const userTotalSubsCount = allSubscriptions.filter(s => s.user_id === u.id).length;
        const userPendingReqs = allRequests.filter(r => r.user_id === u.id && r.status === 'pending');

        // ----------------------------------------------------------------------
        // CAS 1 : CONSULTATION D'UN UTILISATEUR DEPUIS L'ONGLET 'TOUS'
        // ----------------------------------------------------------------------
        if (item.itemType === 'user') {
          const isSubscribed = Boolean(userActiveSub);
          const daysLeft = isSubscribed ? calculateDaysRemaining(userActiveSub.end_date) : null;

          let expirationBadgeHtml = '';
          if (daysLeft !== null) {
            if (daysLeft > 1) {
              expirationBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">⏳ Expire dans ' + daysLeft + ' jours</span>';
            } else if (daysLeft === 1) {
              expirationBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">⚠️ Expire demain</span>';
            } else if (daysLeft === 0) {
              expirationBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">⚠️ Expire aujourd\\'hui</span>';
            } else {
              expirationBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40">🔴 Expiré depuis ' + Math.abs(daysLeft) + ' jour(s)</span>';
            }
          }

          panel.innerHTML = \`
            <!-- EN-TÊTE PROFIL ÉTUDIANT & BOUTON 3 TRAITS OPTIONS -->
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div class="flex items-start gap-3.5">
                <div class="relative w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 font-black flex items-center justify-center border border-orange-500/30 text-lg shrink-0 mt-0.5">
                  \${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full rounded-2xl object-cover" onerror="this.remove()">' : u.name.charAt(0).toUpperCase()}
                  <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 \${u.isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}" title="\${u.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
                </div>
                <div class="space-y-1 text-xs">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-base font-extrabold text-white">\${u.name}</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">ID: \${u.id}</span>
                    \${u.isOnline ? \`
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> En ligne
                      </span>
                    \` : \`
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Hors ligne
                      </span>
                    \`}
                  </div>
                  <div class="flex items-center gap-3 text-slate-300 flex-wrap">
                    <span class="font-mono">📞 <strong>\${u.phone || 'Non renseigné'}</strong></span>
                    \${u.phone ? \`
                      <span>•</span>
                      <a href="https://wa.me/\${u.phone.replace(/[^0-9]/g, '')}" target="_blank" class="inline-flex items-center gap-1 font-mono text-emerald-400 hover:text-emerald-300 underline font-bold bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                        <span>💬 WhatsApp</span>
                      </a>
                    \` : ''}
                    <span>•</span>
                    <span class="font-mono text-slate-400">✉️ \${u.email || 'Non renseigné'}</span>
                  </div>
                  <div class="text-slate-400">
                    🏛️ <strong>\${u.school || 'École non renseignée'}</strong> \${u.filiere ? '(' + u.filiere + ')' : ''} • 🎓 \${u.level || 'Étudiant'}
                  </div>
                </div>
              </div>

              <!-- BOUTON 3 TRAITS OPTIONS -->
              <div class="relative inline-block text-left shrink-0">
                <button 
                  onclick="toggleDemandeOptionsMenu()" 
                  id="demande-options-btn"
                  class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  <span>☰</span>
                  <span>Options du compte</span>
                </button>

                <div id="demande-options-dropdown" class="hidden absolute right-0 mt-2 w-64 rounded-2xl bg-[#0f172a] border border-slate-700 shadow-2xl z-50 p-2 space-y-1 backdrop-blur-xl">
                  <div class="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Dossier étudiant
                  </div>
                  <button onclick="openUserHistoryModal('\${u.id}', 'requests')" class="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-slate-200 flex items-center gap-2.5 transition font-medium cursor-pointer">
                    <span>📜</span>
                    <div>
                      <div class="font-bold">Historique des demandes (\${userPendingReqs.length + allRequests.filter(r => r.user_id === u.id && r.status !== 'pending').length})</div>
                      <div class="text-[10px] text-slate-400">Voir toutes les demandes passées</div>
                    </div>
                  </button>
                  <button onclick="openUserHistoryModal('\${u.id}', 'active')" class="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-emerald-300 flex items-center gap-2.5 transition font-medium cursor-pointer">
                    <span>💳</span>
                    <div>
                      <div class="font-bold">Abonnements en cours (\${userActiveSub ? '1' : '0'})</div>
                      <div class="text-[10px] text-slate-400">Souscription actuelle</div>
                    </div>
                  </button>
                  <button onclick="openUserHistoryModal('\${u.id}', 'cancelled')" class="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-red-300 flex items-center gap-2.5 transition font-medium cursor-pointer">
                    <span>🚫</span>
                    <div>
                      <div class="font-bold">Abonnements annulés (\${userCancelledSubs.length})</div>
                      <div class="text-[10px] text-slate-400">Motifs et historique de résiliation</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <!-- BANNIÈRE DU STATUT : ABONNÉ VS MODE GRATUIT -->
            \${isSubscribed ? \`
              <div class="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-900 p-3.5 rounded-2xl border border-emerald-500/40 flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0 border border-emerald-500/40">
                    🟢
                  </div>
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">Abonné Actif</span>
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">\${userActiveSub.plan_name}</span>
                      \${expirationBadgeHtml}
                    </div>
                    <div class="text-[11px] text-slate-300 mt-0.5">
                      📅 Abonné depuis le : <strong class="text-white font-mono">\${formatFullDateFrench(userActiveSub.start_date || userActiveSub.created_at)}</strong>
                    </div>
                  </div>
                </div>
                <div class="text-right text-[11px] text-slate-400 font-mono">
                  Inscrit le : \${formatShortDateFrench(u.created_at)}
                </div>
              </div>
            \` : \`
              <div class="bg-gradient-to-r from-slate-900 via-[#131b2e] to-slate-900 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center text-xl shrink-0 border border-slate-700">
                    ⚪
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs uppercase font-extrabold text-slate-300 tracking-wider">Mode Gratuit (Non Abonné)</span>
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">Bienvenue \${quota.totalAllowedFormatted}</span>
                    </div>
                    <div class="text-[11px] text-slate-300 mt-0.5">
                      📅 <strong>En mode gratuit depuis le :</strong> <strong class="text-white font-mono">\${formatFullDateFrench(u.created_at)}</strong>
                    </div>
                  </div>
                </div>
                <div class="text-right text-[11px] text-slate-400">
                  Compte gratuit de base
                </div>
              </div>
            \`}

            <!-- SECTION PRINCIPALE : LES INFORMATIONS ESSENTIELLES DEMANDÉES -->
            \${isSubscribed ? \`
              <!-- 4 GRANDES CARTES D'ABONNEMENT POUR LES UTILISATEURS ABONNÉS -->
              <div class="space-y-2">
                <h4 class="text-xs font-extrabold text-white flex items-center gap-2">
                  <span>💳</span> Détails de l'Abonnement en Cours
                </h4>

                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <!-- 1. QUEL JOUR ÇA VA FINIR (DATE EXPIRATION) -->
                  <div class="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-950/15 to-slate-950">
                    <span class="text-[10px] uppercase font-bold text-amber-400 block mb-0.5">⏳ Quel jour ça va finir</span>
                    <div class="text-xs font-bold text-white font-mono mt-1">
                      \${userActiveSub.end_date ? formatShortDateFrench(userActiveSub.end_date) : 'Non définie'}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-1">
                      Heure : \${userActiveSub.end_date ? new Date(userActiveSub.end_date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}) : '--:--'}
                    </div>
                    <div class="text-[9px] text-amber-300/80 font-mono mt-1.5 pt-1 border-t border-slate-800">
                      Tolérance : \${userActiveSub.grace_period_days || 5} j avant suspension
                    </div>
                  </div>

                  <!-- 2. COMBIEN IL PAYE -->
                  <div class="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-950/15 to-slate-950">
                    <span class="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">💰 Combien il paye</span>
                    <div class="text-base sm:text-lg font-black text-emerald-400 font-mono mt-0.5">
                      \${Number(userActiveSub.monthly_price || 0).toLocaleString('fr-FR')} \${userActiveSub.currency || 'FCFA'}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-1">Par mois d'abonnement</div>
                    <div class="text-[9px] text-slate-500 font-mono mt-1.5 pt-1 border-t border-slate-800 truncate">
                      Formule : \${userActiveSub.plan_name}
                    </div>
                  </div>

                  <!-- 3. COMBIEN DE MO OU GO IL A -->
                  <div class="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-950/15 to-slate-950">
                    <span class="text-[10px] uppercase font-bold text-blue-400 block mb-0.5">📦 Combien de Mo/Go il a</span>
                    <div class="text-base sm:text-lg font-black text-blue-400 font-mono mt-0.5">
                      \${quota.totalAllowedFormatted}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-1">Stockage Total Alloué</div>
                    <div class="text-[9px] text-slate-500 font-mono mt-1.5 pt-1 border-t border-slate-800">
                      Bienvenue (\${quota.welcomeTotalMb} Mo) + Payant (\${quota.paidTotalMb} Mo)
                    </div>
                  </div>

                  <!-- 4. COMBIEN LUI RESTE -->
                  <div class="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 border-l-4 border-l-emerald-400 bg-gradient-to-br from-emerald-950/25 to-slate-950">
                    <span class="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">⚡ Combien lui reste</span>
                    <div class="text-base sm:text-lg font-black text-emerald-400 font-mono mt-0.5">
                      \${remainingFormatted}
                    </div>
                    <div class="text-[10px] text-emerald-300/80 mt-1">Espace libre disponible</div>
                    <div class="text-[9px] text-slate-400 font-mono mt-1.5 pt-1 border-t border-slate-800">
                      Consommé : \${usedFormatted} (\${usagePct}%)
                    </div>
                  </div>
                </div>
              </div>
            \` : \`
              <!-- 3 GRANDES CARTES DÉDIÉES AU MODE GRATUIT -->
              <div class="space-y-2">
                <h4 class="text-xs font-extrabold text-white flex items-center gap-2">
                  <span>⚡</span> Bilan du Compte en Mode Gratuit
                </h4>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <!-- 1. DEPUIS QUAND IL EST EN MODE GRATUIT -->
                  <div class="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 border-l-4 border-l-slate-400">
                    <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">📅 En mode gratuit depuis le</span>
                    <div class="text-xs sm:text-sm font-extrabold text-white font-mono mt-1">
                      \${formatShortDateFrench(u.created_at)}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-1">
                      Heure : \${new Date(u.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div class="text-[9px] text-slate-500 font-mono mt-1.5 pt-1 border-t border-slate-800">
                      Formule gratuite de base
                    </div>
                  </div>

                  <!-- 2. COMBIEN DE MO OU GO IL A -->
                  <div class="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 border-l-4 border-l-blue-500">
                    <span class="text-[10px] uppercase font-bold text-blue-400 block mb-0.5">📦 Combien de Mo/Go il a</span>
                    <div class="text-lg font-black text-blue-400 font-mono mt-0.5">
                      \${quota.totalAllowedFormatted}
                    </div>
                    <div class="text-[10px] text-slate-400 mt-1">Stockage de bienvenue offert</div>
                    <div class="text-[9px] text-slate-500 font-mono mt-1.5 pt-1 border-t border-slate-800">
                      Partage libre documents & données
                    </div>
                  </div>

                  <!-- 3. COMBIEN LUI RESTE -->
                  <div class="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-950/20 to-slate-950">
                    <span class="text-[10px] uppercase font-bold text-emerald-400 block mb-0.5">⚡ Combien lui reste</span>
                    <div class="text-lg font-black text-emerald-400 font-mono mt-0.5">
                      \${remainingFormatted}
                    </div>
                    <div class="text-[10px] text-emerald-300/80 mt-1">Espace restant disponible</div>
                    <div class="text-[9px] text-slate-400 font-mono mt-1.5 pt-1 border-t border-slate-800">
                      Consommé : \${usedFormatted} (\${usagePct}%)
                    </div>
                  </div>
                </div>
              </div>
            \`}

            <!-- BARRE VISUELLE DE PROGRESSION DE L'ESPACE DE STOCKAGE -->
            <div class="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
              <div class="flex justify-between text-[11px] font-mono">
                <span class="text-slate-300">Consommation du quota de stockage</span>
                <span class="text-orange-400 font-bold">\${usedFormatted} / \${quota.totalAllowedFormatted} (\${usagePct}%)</span>
              </div>
              <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                <div class="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500 rounded-full transition-all duration-500" style="width: \${Math.max(1, Math.min(100, usagePct))}%;"></div>
              </div>
              <div class="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 font-mono">
                <span>Reste disponible : <strong class="text-emerald-400 font-bold">\${remainingFormatted}</strong></span>
                <span>Utilisé : <strong class="text-orange-400 font-bold">\${usedFormatted}</strong></span>
              </div>
            </div>

            <!-- ENCADRÉ D'ACTION SI DEMANDE EN ATTENTE -->
            \${userPendingReqs.length > 0 ? \`
              <div class="bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3 shadow-lg shadow-amber-950/20">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl shrink-0 border border-amber-500/40 animate-pulse">
                    🟡
                  </div>
                  <div>
                    <h5 class="text-xs font-extrabold text-amber-300">
                      Cet utilisateur a \${userPendingReqs.length} demande(s) d'abonnement en attente !
                    </h5>
                    <p class="text-[11px] text-slate-300 mt-0.5">
                      Pack demandé : <strong>\${userPendingReqs[0].pack_name || 'Stockage'}</strong> (+\${userPendingReqs[0].additional_mb || 0} Mo) • Prix : <strong>\${userPendingReqs[0].price_paid || 0} \${userPendingReqs[0].currency || 'FCFA'}</strong>
                    </p>
                  </div>
                </div>
                <button 
                  onclick="setDemandesTab('pending'); selectDemandeItem('\${userPendingReqs[0].id}', 'request');" 
                  class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0"
                >
                  <span>🔍</span> Examiner & Valider sa demande →
                </button>
              </div>
            \` : ''}

            <!-- SYNTHÈSE DES ABONNEMENTS ET HISTORIQUE -->
            <div class="bg-gradient-to-br from-slate-900 via-[#11192e] to-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h4 class="text-xs font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <span>📜</span> Synthèse & Historique des Abonnements
              </h4>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <!-- 1. Total souscriptions -->
                <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Nombre total de souscriptions :</span>
                  <div class="text-base font-extrabold text-white font-mono">
                    \${userTotalSubsCount > 0 ? userTotalSubsCount + ' souscription(s)' : '0 fois (Aucun abonnement payant)'}
                  </div>
                  <p class="text-[10px] text-slate-500 mt-1">Comptabilise tous les forfaits passés et actuels.</p>
                </div>

                <!-- 2. A-t-il déjà annulé un abonnement ? -->
                <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 \${userCancelledSubs.length > 0 ? 'border-red-500/40 bg-red-950/10' : ''}">
                  <span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Annulations d'abonnement :</span>
                  \${userCancelledSubs.length > 0 ? \`
                    <div class="text-xs font-bold text-red-300">
                      🔴 Oui • \${userCancelledSubs.length} abonnement(s) annulé(s)
                    </div>
                    <div class="text-[10px] text-slate-300 mt-1">
                      Dernier motif : "\${userCancelledSubs[0].cancel_reason || 'Résiliation'}"
                    </div>
                  \` : \`
                    <div class="text-xs font-bold text-emerald-400">
                      ✓ Jamais d'annulation
                    </div>
                    <div class="text-[10px] text-slate-500 mt-1">Aucune interruption enregistrée.</div>
                  \`}
                </div>

                <!-- 3. Demandes passées -->
                <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <span class="text-[10px] text-slate-400 uppercase font-bold block mb-1">Dossier des demandes :</span>
                  <div class="text-xs font-bold text-slate-200 font-mono">
                    \${allRequests.filter(r => r.user_id === u.id).length} demande(s) en tout
                  </div>
                  <div class="text-[10px] text-slate-400 mt-1">
                    \${userPendingReqs.length > 0 ? ('🟡 ' + userPendingReqs.length + ' en attente') : '✓ Toutes traitées'}
                  </div>
                </div>
              </div>

              <!-- ACCÈS RAPIDE VERS DISTRIBUTION DE STOCKAGE -->
              <div class="pt-2 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span class="text-slate-400 text-[11px]">Besoin de modifier manuellement son stockage de bienvenue ou son quota payant ?</span>
                <button 
                  onclick="switchView('distribution'); selectDistributionUser('\${u.id}');" 
                  class="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>🎁</span> Ouvrir dans Distribution de stockage
                </button>
              </div>
            </div>
          \`;
          return;
        }

        // ----------------------------------------------------------------------
        // CAS 2 : DEMANDE D'AUGMENTATION EN ATTENTE (AVEC REÇU & VALIDATION ADMIN)
        // ----------------------------------------------------------------------
        if (item.itemType === 'request') {
          const req = item.raw || {};
          const formattedAmount = item.amountMb >= 1024 
            ? (item.amountMb / 1024).toFixed(item.amountMb % 1024 === 0 ? 0 : 1) + ' Go (' + item.amountMb + ' Mo)'
            : item.amountMb + ' Mo';

          const receiptUrl = item.receiptUrl || req.receipt_image_url || '';
          const receiptR2Key = item.receiptR2Key || req.receipt_r2_key || ('storage-receipts/' + u.id + '/recu_demande_' + item.id + '.jpg');
          const paymentMethod = req.payment_method || item.paymentMethod || 'Wave / Mobile Money';
          const paymentRef = (req && req.payment_reference) ? req.payment_reference : ('TXN_' + String(item.id || '').slice(0, 8).toUpperCase());

          // Stocker pour le zoom sécurisé
          window.currentViewedReceiptUrl = receiptUrl;
          window.currentViewedReceiptCaption = 'Reçu de paiement - ' + (u.name || 'Étudiant');

          // Calcul dates par défaut pour les champs éditables
          const now = new Date();
          const defaultStartISO = formatDatetimeLocal(now);
          const defaultEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const defaultEndISO = formatDatetimeLocal(defaultEnd);
          const currentTotalMb = quota.totalAllowedMb || (quota.welcomeTotalMb + quota.paidTotalMb);
          const futureTotalMb = currentTotalMb + item.amountMb;
          const futureTotalFormatted = futureTotalMb >= 1024 
            ? (futureTotalMb / 1024).toFixed(1) + ' Go' 
            : futureTotalMb + ' Mo';
          const subDaysLeft = (userActiveSub && userActiveSub.end_date) ? calculateDaysRemaining(userActiveSub.end_date) : null;

          panel.innerHTML = \`
            <!-- EN-TÊTE PROFIL ÉTUDIANT & BOUTON 3 TRAITS OPTIONS -->
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div class="flex items-start gap-3.5">
                <div class="relative w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 font-black flex items-center justify-center border border-orange-500/30 text-lg shrink-0 mt-0.5">
                  \${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full rounded-2xl object-cover" onerror="this.remove()">' : u.name.charAt(0).toUpperCase()}
                  <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 \${u.isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}" title="\${u.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
                </div>
                <div class="space-y-1 text-xs">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-base font-extrabold text-white">\${u.name}</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">ID: \${u.id}</span>
                    \${u.isOnline ? \`
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> En ligne
                      </span>
                    \` : \`
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Hors ligne
                      </span>
                    \`}
                  </div>
                  <div class="flex items-center gap-3 text-slate-300 flex-wrap">
                    <span class="font-mono">📞 Appel/SMS : <strong>\${item.contactPhone || req.contact_phone || u.phone || 'Non renseigné'}</strong></span>
                    \${(item.userWhatsapp || req.user_whatsapp) ? \`
                      <span>•</span>
                      <a href="https://wa.me/\${(item.userWhatsapp || req.user_whatsapp).replace(/[^0-9]/g, '')}" target="_blank" class="inline-flex items-center gap-1 font-mono text-emerald-400 hover:text-emerald-300 underline font-bold bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                        <span>💬 WhatsApp : \${item.userWhatsapp || req.user_whatsapp}</span>
                      </a>
                    \` : ''}
                    <span>•</span>
                    <span class="font-mono text-slate-400">✉️ \${u.email || 'Non renseigné'}</span>
                  </div>
                  <div class="text-slate-400">
                    🏛️ <strong>\${u.school || 'École non renseignée'}</strong> \${u.filiere ? '(' + u.filiere + ')' : ''}
                  </div>
                </div>
              </div>

              <!-- BOUTON 3 TRAITS OPTIONS -->
              <div class="relative inline-block text-left shrink-0">
                <button 
                  onclick="toggleDemandeOptionsMenu()" 
                  id="demande-options-btn"
                  class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  <span>☰</span>
                  <span>Historique</span>
                </button>

                <div id="demande-options-dropdown" class="hidden absolute right-0 mt-2 w-64 rounded-2xl bg-[#0f172a] border border-slate-700 shadow-2xl z-50 p-2 space-y-1 backdrop-blur-xl">
                  <button onclick="openUserHistoryModal('\${u.id}', 'requests')" class="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-slate-200 flex items-center gap-2.5 transition font-medium cursor-pointer">
                    <span>📜</span> Historique de ses demandes
                  </button>
                  <button onclick="openUserHistoryModal('\${u.id}', 'active')" class="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-emerald-300 flex items-center gap-2.5 transition font-medium cursor-pointer">
                    <span>💳</span> Abonnements en cours
                  </button>
                  <button onclick="openUserHistoryModal('\${u.id}', 'cancelled')" class="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-red-300 flex items-center gap-2.5 transition font-medium cursor-pointer">
                    <span>🚫</span> Abonnements annulés
                  </button>
                </div>
              </div>
            </div>

            <!-- DÉTAILS DE LA DEMANDE SOUMISE -->
            <div class="bg-gradient-to-br from-slate-900 via-[#11192e] to-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div class="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
                <h4 class="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                  <span class="\${item.isRenewal ? 'text-orange-400 text-base' : ''}">\${item.isRenewal ? '🔄' : '📦'}</span>
                  <span>\${item.isRenewal ? 'Renouvellement des abonnements' : 'Formule Sélectionnée'} : <span class="text-orange-400">\${item.packName.replace(/^Renouvellement des abonnements\\s*[-–:]\\s*/i, '')}</span></span>
                </h4>
                <div class="flex items-center gap-2">
                  \${item.isRenewal ? \`
                    <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40 flex items-center gap-1.5">
                      <span>🔄</span> Renouvellement des abonnements
                    </span>
                  \` : \`
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      \${(req.billing_cycle === 'monthly' ? 'Facturation mensuelle' : 'Facturation annuelle (-10%)')}
                    </span>
                  \`}
                  <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> En attente de validation
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <!-- Carte 1 : Espace / Capacité choisie -->
                <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 border-l-4 border-l-blue-500">
                  <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Capacité / Stockage</span>
                  <div class="text-sm sm:text-base font-black text-blue-400 font-mono">
                    \${item.storageDisplay || req.storage_display || ('+' + formattedAmount)}
                  </div>
                  <div class="text-[10px] text-slate-400 mt-1">+\${item.amountMb} Mo à allouer</div>
                </div>

                <!-- Carte 2 : Somme à payer selon la formule -->
                <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 border-l-4 border-l-emerald-500">
                  <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Somme à payer (Transmise)</span>
                  <div class="text-sm sm:text-base font-black text-emerald-400 font-mono">
                    \${item.priceDisplay || req.price_display || (Number(item.pricePaid).toLocaleString('fr-FR') + ' ' + item.currency)}
                  </div>
                  <div class="text-[10px] text-slate-400 mt-1">Montant forfaitaire</div>
                </div>

                <!-- Carte 3 : Moyen de transfert & Référence -->
                <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 border-l-4 border-l-purple-500">
                  <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Moyen & Référence</span>
                  <div class="text-xs font-bold text-purple-300 truncate mt-0.5">\${paymentMethod}</div>
                  <div class="text-[10px] font-mono text-slate-400 mt-1 truncate">Réf: \${paymentRef}</div>
                </div>

                <!-- Carte 4 : Contact Appel & WhatsApp -->
                <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 border-l-4 border-l-orange-500">
                  <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Numéro Client Confirmé</span>
                  <div class="text-xs font-bold font-mono text-white truncate mt-0.5">
                    📞 \${item.contactPhone || req.contact_phone || u.phone || 'Non renseigné'}
                  </div>
                  <div class="text-[10px] font-mono text-emerald-400 mt-1 truncate">
                    💬 WA: \${item.userWhatsapp || req.user_whatsapp || 'Non renseigné'}
                  </div>
                </div>
              </div>

              \${(req.notes || item.notes) ? \`
                <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
                  <span class="text-sm">📝</span>
                  <div>
                    <span class="text-[10px] font-bold text-slate-400 uppercase block">Précisions du formulaire client :</span>
                    <span>\${req.notes || item.notes}</span>
                  </div>
                </div>
              \` : ''}

              <!-- ESPACE REÇU DE PAIEMENT SÉCURISÉ -->
              <div class="bg-slate-950/90 rounded-2xl border-2 border-slate-800 p-4 space-y-3">
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center gap-2">
                    <span class="text-base">🧾</span>
                    <span class="text-xs font-extrabold text-white">Espace Preuve de Paiement • Capture d'Écran ou Reçu</span>
                  </div>
                  \${receiptUrl ? \`
                    <button 
                      onclick="openCurrentReceiptZoom()" 
                      class="px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                    >
                      <span>🔍</span> Agrandir le reçu
                    </button>
                  \` : ''}
                </div>

                \${receiptUrl ? \`
                  <div 
                    onclick="openCurrentReceiptZoom()"
                    class="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-900/80 p-2 cursor-pointer flex items-center justify-center max-h-[300px]"
                  >
                    <img src="\${receiptUrl}" class="max-h-[280px] w-auto max-w-full rounded-lg object-contain transition duration-300 group-hover:scale-[1.02] shadow-xl" alt="Reçu de paiement" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'100\\'><text x=\\'20\\' y=\\'50\\' fill=\\'%2394a3b8\\'>Image du reçu non disponible</text></svg>'" />
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl backdrop-blur-xs">
                      <div class="px-3 py-2 rounded-xl bg-orange-600 text-white font-bold text-xs flex items-center gap-2 shadow-xl">
                        <span>🔍</span> Cliquez pour agrandir le reçu
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 flex-wrap gap-1">
                    <span class="truncate">📁 Emplacement : <strong class="text-slate-300">\${receiptR2Key}</strong></span>
                    <span class="text-emerald-400 shrink-0 font-sans">✓ Preuve liée au dossier \${u.name}</span>
                  </div>
                \` : \`
                  <div class="p-6 text-center rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/40 text-slate-400 text-xs">
                    Aucun fichier reçu joint lors de la demande. Vous pouvez contacter l'étudiant directement par WhatsApp ou téléphone.
                  </div>
                \`}
              </div>

              <!-- DATE ET HEURE DE LA DEMANDE -->
              <div class="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center gap-2 text-xs">
                <span class="text-base">🕒</span>
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase font-bold">Date & Heure de Soumission de la Demande :</span>
                  <strong class="text-white font-mono text-xs">\${formatFullDateFrench(item.date)}</strong>
                </div>
              </div>

              <!-- FORMULAIRE ADMINISTRATEUR DE CONFIRMATION ET PLANIFICATION -->
              <div class="bg-slate-950 p-4 sm:p-5 rounded-2xl border-2 border-emerald-500/40 space-y-4 shadow-2xl">
                <div class="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                  <div class="flex items-center gap-2">
                    <span class="text-base sm:text-lg">⚙️</span>
                    <h4 class="text-xs sm:text-sm font-extrabold text-emerald-400">
                      Paramétrage et Confirmation de l'Abonnement
                    </h4>
                  </div>
                  <span class="text-[11px] text-slate-400 font-medium">Ajustez les dates, vérifiez l'état du compte puis validez</span>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <!-- COLONNE GAUCHE (PARAMÈTRES D'ACTIVATION & STOCKAGE) -->
                  <div class="lg:col-span-7 space-y-3.5">
                    
                    <!-- 1. DATE & HEURE DE DÉBUT -->
                    <div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div class="flex items-center justify-between">
                        <label class="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                          <span>1.</span> Date & Heure de début :
                        </label>
                        <span class="text-[10px] text-emerald-400 font-mono">Activation immédiate</span>
                      </div>
                      
                      <div class="relative flex items-center">
                        <input 
                          type="datetime-local" 
                          id="admin-confirm-start-date" 
                          value="\${defaultStartISO}"
                          class="w-full bg-slate-950 text-white font-mono text-xs px-3 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 focus:outline-none pr-10 shadow-inner"
                        >
                        <button 
                          type="button" 
                          onclick="openAdminDatePicker('admin-confirm-start-date')" 
                          title="Ouvrir le calendrier pour choisir"
                          class="absolute right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs rounded-lg border border-slate-600 cursor-pointer transition shadow-sm"
                        >
                          📅
                        </button>
                      </div>

                      <!-- BOUTONS DE MODIFICATION DATE DE DÉBUT -->
                      <div class="flex items-center flex-wrap gap-1.5 pt-0.5">
                        <span class="text-[10px] text-slate-400 font-medium">Ajuster :</span>
                        <button 
                          type="button" 
                          onclick="setAdminStartDateNow()" 
                          class="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span>⚡</span> Maintenant
                        </button>
                        <button 
                          type="button" 
                          onclick="openAdminDatePicker('admin-confirm-start-date')" 
                          class="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <span>📅</span> Choisir
                        </button>
                        <button 
                          type="button" 
                          onclick="adjustAdminStartDateDays(1)" 
                          class="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition cursor-pointer active:scale-95"
                          title="Décaler de +1 jour"
                        >
                          +1j
                        </button>
                        <button 
                          type="button" 
                          onclick="adjustAdminStartDateDays(-1)" 
                          class="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition cursor-pointer active:scale-95"
                          title="Décaler de -1 jour"
                        >
                          -1j
                        </button>
                      </div>
                    </div>

                    <!-- 2. DATE DE FIN D'ABONNEMENT -->
                    <div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div class="flex items-center justify-between">
                        <label class="text-slate-200 font-bold text-xs flex items-center gap-1.5">
                          <span>2.</span> Date de fin d'abonnement :
                        </label>
                        <span class="text-[10px] text-amber-400 font-mono">Date d'échéance</span>
                      </div>

                      <div class="relative flex items-center">
                        <input 
                          type="datetime-local" 
                          id="admin-confirm-end-date" 
                          value="\${defaultEndISO}"
                          class="w-full bg-slate-950 text-white font-mono text-xs px-3 py-2.5 rounded-xl border border-slate-700 focus:border-emerald-500 focus:outline-none pr-10 shadow-inner"
                        >
                        <button 
                          type="button" 
                          onclick="openAdminDatePicker('admin-confirm-end-date')" 
                          title="Ouvrir le calendrier pour choisir"
                          class="absolute right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs rounded-lg border border-slate-600 cursor-pointer transition shadow-sm"
                        >
                          📅
                        </button>
                      </div>

                      <!-- BOUTONS DE MODIFICATION DATE DE FIN -->
                      <div class="space-y-1.5 pt-0.5">
                        <div class="flex items-center flex-wrap gap-1.5">
                          <span class="text-[10px] text-slate-400 font-medium">Durée :</span>
                          <button 
                            type="button" 
                            onclick="openAdminDatePicker('admin-confirm-end-date')" 
                            class="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition cursor-pointer active:scale-95"
                          >
                            📅 Choisir
                          </button>
                          <button 
                            type="button" 
                            onclick="setAdminEndDateDays(15)" 
                            class="text-[10px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition cursor-pointer active:scale-95"
                          >
                            +15j
                          </button>
                          <button 
                            type="button" 
                            onclick="setAdminEndDateDays(30)" 
                            class="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-mono font-bold transition cursor-pointer active:scale-95"
                          >
                            +1 Mois (30j)
                          </button>
                          <button 
                            type="button" 
                            onclick="setAdminEndDateDays(90)" 
                            class="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition cursor-pointer active:scale-95"
                          >
                            +3 Mois
                          </button>
                          <button 
                            type="button" 
                            onclick="setAdminEndDateDays(180)" 
                            class="text-[10px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition cursor-pointer active:scale-95"
                          >
                            +6 Mois
                          </button>
                          <button 
                            type="button" 
                            onclick="setAdminEndDateDays(365)" 
                            class="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-mono font-bold transition cursor-pointer active:scale-95"
                          >
                            +1 An
                          </button>
                        </div>

                        \${(userActiveSub && userActiveSub.end_date) ? ('<div class="pt-1"><button type="button" onclick="extendAdminEndDateFromCurrentSub(\\'' + userActiveSub.end_date + '\\', 30)" class="w-full text-[11px] px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/30 via-teal-600/20 to-emerald-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 text-emerald-300 border border-emerald-500/40 font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-95"><span>🔄</span><span>Prolonger après la fin actuelle (+30j après le ' + formatShortDateFrench(userActiveSub.end_date) + ')</span></button></div>') : ''}
                      </div>
                    </div>

                    <!-- 3. DÉLAI DE GRÂCE AVANT BLOCAGE -->
                    <div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div>
                        <label class="text-slate-200 font-bold text-xs block">3. Délai de grâce avant blocage :</label>
                        <span class="text-[10px] text-slate-400">Tolérance après échéance avant suspension</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="flex items-center gap-1.5">
                          <input 
                            type="number" 
                            id="admin-confirm-grace-days" 
                            value="5" 
                            min="0" 
                            max="60"
                            class="w-16 bg-slate-950 text-emerald-400 font-bold font-mono text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 text-center focus:border-emerald-500 focus:outline-none"
                          >
                          <span class="text-slate-300 font-bold text-xs">Jours</span>
                        </div>
                        <div class="flex items-center gap-1">
                          <button type="button" onclick="setAdminGraceDays(3)" class="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono cursor-pointer">3j</button>
                          <button type="button" onclick="setAdminGraceDays(5)" class="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 font-mono font-bold cursor-pointer">5j</button>
                          <button type="button" onclick="setAdminGraceDays(10)" class="text-[10px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono cursor-pointer">10j</button>
                        </div>
                      </div>
                    </div>

                    <!-- 4. STOCKAGE À ALLOUER & PRIX -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                      <!-- Stockage à allouer -->
                      <div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <div class="flex items-center justify-between">
                          <span class="text-slate-300 font-bold text-xs">Stockage à allouer :</span>
                          <span class="text-[10px] text-blue-400 font-mono">\${item.isRenewal ? 'Renouvellement (quota conservé)' : ('+' + item.amountMb + ' Mo demandé')}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <input 
                            type="number" 
                            id="admin-confirm-allocated-mb" 
                            value="\${(item.isRenewal && currentTotalMb > 30) ? 0 : item.amountMb}" 
                            oninput="updateAdminLiveStoragePreview(\${currentTotalMb})"
                            class="w-full bg-slate-950 text-blue-400 font-black font-mono text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-center focus:border-blue-500 focus:outline-none"
                          >
                          <span class="font-bold text-blue-400 font-mono text-xs">Mo</span>
                        </div>
                        <div class="flex items-center justify-between gap-1 pt-0.5">
                          <button 
                            type="button" 
                            onclick="setAdminAllocatedMb(\${item.amountMb}, \${currentTotalMb})" 
                            class="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-mono cursor-pointer"
                            title="Remettre la valeur du forfait demandé"
                          >
                            +\${item.amountMb} Mo (Pack)
                          </button>
                          <button 
                            type="button" 
                            onclick="setAdminAllocatedMb(0, \${currentTotalMb})" 
                            class="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono cursor-pointer"
                            title="Ne pas ajouter de stockage en plus (renouvellement de durée simple)"
                          >
                            0 Mo (Renouvellement pur)
                          </button>
                        </div>
                      </div>

                      <!-- Prix mensuel confirmé -->
                      <div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <div class="flex items-center justify-between">
                          <span class="text-slate-300 font-bold text-xs">Prix mensuel confirmé :</span>
                          <span class="text-[10px] text-emerald-400 font-mono">Mensuel</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <input 
                            type="number" 
                            id="admin-confirm-price" 
                            value="\${item.pricePaid}" 
                            class="w-full bg-slate-950 text-emerald-400 font-black font-mono text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-center focus:border-emerald-500 focus:outline-none"
                          >
                          <span class="font-bold text-emerald-400 font-mono text-xs">\${item.currency}</span>
                        </div>
                        <div class="text-[10px] text-slate-500 text-right">
                          Montant encaissé pour la période
                        </div>
                      </div>
                    </div>

                  </div>

                  <!-- COLONNE DROITE (ÉTAT DU COMPTE & PRÉVISUALISATION DU TOTAL FINAL) -->
                  <div class="lg:col-span-5 bg-gradient-to-b from-slate-900/90 to-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between shadow-xl">
                    <div class="space-y-3">
                      <!-- En-tête panneau récapitulatif -->
                      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span class="text-xs font-black text-white flex items-center gap-1.5">
                          <span>📊</span> Situation & Impact Client
                        </span>
                        <span class="text-[10px] text-slate-400 font-mono">ID: \${u.id}</span>
                      </div>

                      <!-- 1. NOMBRE DE STOCKAGE QU'IL A DÉJÀ -->
                      <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                        <span class="text-[10px] uppercase font-bold text-slate-400 block">
                          📦 Stockage qu'il a déjà :
                        </span>
                        <div class="flex items-baseline justify-between">
                          <span class="text-lg font-black text-blue-400 font-mono">
                            \${quota.totalAllowedFormatted}
                          </span>
                          <span class="text-xs text-slate-400 font-mono font-bold">
                            \${currentTotalMb} Mo
                          </span>
                        </div>
                        <div class="text-[10px] text-slate-500 pt-1 border-t border-slate-800/80 flex items-center justify-between font-mono">
                          <span>Bienvenue : \${quota.welcomeTotalMb} Mo</span>
                          <span>•</span>
                          <span>Payant : \${quota.paidTotalMb} Mo</span>
                        </div>
                      </div>

                      <!-- 2. A-T-IL DÉJÀ UN ABONNEMENT EN COURS ? (DÉBUT, FIN, ÉTAT) -->
                      <div class="bg-slate-950/80 p-3 rounded-xl border \${userActiveSub ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 to-slate-950' : 'border-slate-800'} space-y-1.5">
                        <span class="text-[10px] uppercase font-bold \${userActiveSub ? 'text-emerald-400' : 'text-slate-400'} block">
                          💳 Abonnement en cours :
                        </span>
                        \${userActiveSub ? ('<div class="space-y-1.5"><div class="flex items-center justify-between flex-wrap gap-1"><span class="text-xs font-extrabold text-white">' + (userActiveSub.plan_name || 'Formule active') + '</span><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">🟢 Actif ' + (subDaysLeft !== null ? ('(' + (subDaysLeft > 0 ? subDaysLeft + 'j restants' : 'Expire auj.') + ')') : '') + '</span></div><div class="text-[11px] text-slate-300 font-mono flex items-start gap-1"><span class="text-slate-500 shrink-0">▶ Début :</span><strong class="text-white">' + formatFullDateFrench(userActiveSub.start_date || userActiveSub.created_at) + '</strong></div><div class="text-[11px] text-emerald-300 font-mono flex items-start gap-1"><span class="text-emerald-500 shrink-0">⏹ Fin :</span><strong class="text-emerald-400">' + formatFullDateFrench(userActiveSub.end_date) + '</strong></div></div>') : ('<div class="space-y-1"><div class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-slate-500"></span><span class="text-xs font-bold text-slate-300">Mode Gratuit</span></div><p class="text-[10px] text-slate-400">Aucun abonnement payant actif actuellement.</p><div class="text-[10px] text-slate-500 font-mono pt-1">En mode gratuit depuis le : ' + formatShortDateFrench(u.created_at) + '</div></div>')}
                      </div>

                      <!-- 3. SI J'AJOUTE CETTE NOUVELLE DEMANDE : COMBIEN IL AURA EN TOUT -->
                      <div class="bg-gradient-to-br from-emerald-950/40 via-slate-950 to-blue-950/40 p-3.5 rounded-xl border-2 border-emerald-500/60 shadow-lg space-y-2.5">
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] uppercase font-black text-emerald-400 tracking-wider">
                            🔮 Calcul & Total Final
                          </span>
                          <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                            Après Validation
                          </span>
                        </div>

                        <div class="grid grid-cols-3 gap-2 text-center py-1 font-mono">
                          <div class="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                            <div class="text-[9px] text-slate-400 uppercase font-bold">Actuel</div>
                            <div class="text-xs font-bold text-slate-200 mt-0.5">\${currentTotalMb} Mo</div>
                          </div>
                          <div class="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                            <div class="text-[9px] text-blue-400 uppercase font-bold">+ Ajouté</div>
                            <div id="admin-preview-added-mb" class="text-xs font-black text-blue-400 mt-0.5">+\${item.amountMb} Mo</div>
                          </div>
                          <div class="bg-emerald-950/70 p-2 rounded-lg border border-emerald-500/50">
                            <div class="text-[9px] text-emerald-400 uppercase font-bold">= Total</div>
                            <div id="admin-preview-total-mb" class="text-xs font-black text-emerald-300 mt-0.5">\${futureTotalMb} Mo</div>
                          </div>
                        </div>

                        <div class="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                          <span class="text-xs font-bold text-white">Stockage Total Futur :</span>
                          <span id="admin-preview-future-formatted" class="text-base font-black text-emerald-400 font-mono">
                            \${futureTotalFormatted}
                          </span>
                        </div>
                        <p class="text-[10px] text-slate-400 leading-tight">
                          Ce quota sera alloué sans délai dès votre confirmation.
                        </p>
                      </div>
                    </div>

                    <div class="pt-2 text-[10px] text-slate-500 text-center font-mono">
                      ✓ Validation administrative sécurisée
                    </div>
                  </div>
                </div>

                <!-- BOUTONS D'ACTION FINALE (LE BOUTON SUPPRIMER EST ENLEVÉ) -->
                <div class="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
                  <button 
                    type="button"
                    onclick="rejectStorageRequest('\${item.id}')" 
                    class="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <span>❌</span> Rejeter la demande
                  </button>

                  <button 
                    type="button"
                    onclick="confirmAndApproveStorageRequest('\${item.id}')" 
                    class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xl shadow-emerald-600/30 transition cursor-pointer flex items-center gap-2 active:scale-95"
                  >
                    <span>✅</span> <span id="admin-confirm-submit-btn-text">Confirmer & Valider comme Abonné (+ \${formattedAmount})</span>
                  </button>
                </div>

              </div>

            </div>
          \`;
          return;
        }

        // ----------------------------------------------------------------------
        // CAS 3 : SOUSCRIPTION OU ABONNEMENT EN COURS OU ANNULÉ
        // ----------------------------------------------------------------------
        const sub = item.raw || {};
        const formattedAmount = item.amountMb >= 1024 
          ? (item.amountMb / 1024).toFixed(item.amountMb % 1024 === 0 ? 0 : 1) + ' Go' 
          : item.amountMb + ' Mo';
        const subDaysLeft = sub.end_date ? calculateDaysRemaining(sub.end_date) : null;

        panel.innerHTML = \`
          <!-- EN-TÊTE PROFIL ÉTUDIANT & BOUTON 3 TRAITS OPTIONS -->
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div class="flex items-start gap-3.5">
              <div class="relative w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 font-black flex items-center justify-center border border-orange-500/30 text-lg shrink-0 mt-0.5">
                \${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full rounded-2xl object-cover" onerror="this.remove()">' : u.name.charAt(0).toUpperCase()}
                <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 \${u.isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}" title="\${u.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
              </div>
              <div class="space-y-1 text-xs">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-base font-extrabold text-white">\${u.name}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">ID: \${u.id}</span>
                  \${u.isOnline ? \`
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> En ligne
                    </span>
                  \` : \`
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60">
                      <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Hors ligne
                    </span>
                  \`}
                </div>
                <div class="flex items-center gap-3 text-slate-300 flex-wrap">
                  <span class="font-mono">📞 <strong>\${u.phone || 'Non renseigné'}</strong></span>
                  <span>•</span>
                  <span class="font-mono text-slate-400">✉️ \${u.email || 'Non renseigné'}</span>
                </div>
                <div class="text-slate-400">
                  🏛️ <strong>\${u.school || 'École non renseignée'}</strong> \${u.filiere ? '(' + u.filiere + ')' : ''}
                </div>
              </div>
            </div>

            <div class="relative inline-block text-left shrink-0">
              <button 
                onclick="toggleDemandeOptionsMenu()" 
                id="demande-options-btn"
                class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                <span>☰</span>
                <span>Historique</span>
              </button>
              <div id="demande-options-dropdown" class="hidden absolute right-0 mt-2 w-64 rounded-2xl bg-[#0f172a] border border-slate-700 shadow-2xl z-50 p-2 space-y-1 backdrop-blur-xl">
                <button onclick="openUserHistoryModal('\${u.id}', 'requests')" class="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-slate-200 flex items-center gap-2.5 transition font-medium cursor-pointer">
                  <span>📜</span> Historique de ses demandes
                </button>
                <button onclick="openUserHistoryModal('\${u.id}', 'active')" class="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-emerald-300 flex items-center gap-2.5 transition font-medium cursor-pointer">
                  <span>💳</span> Abonnements en cours
                </button>
                <button onclick="openUserHistoryModal('\${u.id}', 'cancelled')" class="w-full text-left px-3 py-2 text-xs rounded-xl hover:bg-slate-800 text-red-300 flex items-center gap-2.5 transition font-medium cursor-pointer">
                  <span>🚫</span> Abonnements annulés
                </button>
              </div>
            </div>
          </div>

          <!-- CARTE DÉTAIL ABONNEMENT -->
          <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
              <h4 class="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                <span>💳</span>
                <span>Formule : <span class="text-orange-400">\${sub.plan_name || 'Standard'}</span></span>
              </h4>
              \${sub.status === 'active' ? \`
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    🟢 Abonnement Actif
                  </span>
                  \${subDaysLeft !== null ? (subDaysLeft > 0 ? '<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400">Expire dans ' + subDaysLeft + ' jours</span>' : '<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-300">Échéance dépassée</span>') : ''}
                </div>
              \` : \`
                <span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                  🔴 Abonnement Annulé
                </span>
              \`}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 border-l-4 border-l-blue-500">
                <span class="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Combien de Mo/Go il a</span>
                <div class="text-lg font-black text-blue-400 font-mono">\${formattedAmount}</div>
              </div>

              <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 border-l-4 border-l-emerald-500">
                <span class="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Combien il paye</span>
                <div class="text-lg font-black text-emerald-400 font-mono">\${Number(sub.monthly_price || 0).toLocaleString('fr-FR')} \${sub.currency || 'FCFA'}</div>
              </div>

              <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 border-l-4 border-l-emerald-400">
                <span class="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Combien lui reste</span>
                <div class="text-lg font-black text-emerald-400 font-mono">\${remainingFormatted}</div>
              </div>

              <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 border-l-4 border-l-purple-500">
                <span class="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Délai avant blocage</span>
                <div class="text-lg font-black text-purple-400 font-mono">\${sub.grace_period_days || 5} jours</div>
              </div>
            </div>

            <!-- DATES DÉBUT ET EXPIRATION (QUEL JOUR ÇA VA FINIR) -->
            <div class="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div class="flex items-center justify-between text-slate-300">
                <span>📅 Date d'activation :</span>
                <strong class="font-mono text-white">\${formatFullDateFrench(sub.start_date || sub.created_at)}</strong>
              </div>
              <div class="flex items-center justify-between text-slate-300 border-t border-slate-800/80 pt-2">
                <span>⏳ <strong>Quel jour ça va finir (Date d'expiration) :</strong></span>
                <strong class="font-mono text-emerald-400 text-xs sm:text-sm">\${sub.end_date ? formatFullDateFrench(sub.end_date) : 'Non définie (30 jours)'}</strong>
              </div>
            </div>

            \${sub.status === 'cancelled' ? \`
              <div class="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-1 text-xs text-red-300">
                <div class="font-bold flex items-center gap-1.5">
                  <span>🚫</span> Informations d'annulation
                </div>
                <div>Stockage dont il disposait avant annulation : <strong>\${sub.previous_storage_mb || 0} Mo</strong></div>
                <div>Date d'annulation : <strong>\${formatFullDateFrench(sub.cancelled_at)}</strong></div>
                <div>Motif renseigné : "<em>\${sub.cancel_reason || 'Résiliation'}</em>"</div>
              </div>
            \` : \`
              <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span class="text-slate-400 text-xs">Résiliation manuelle :</span>
                <button 
                  onclick="cancelSubscription('\${sub.id}', '\${u.id}')" 
                  class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  🚫 Annuler l'abonnement
                </button>
              </div>
            \`}
          </div>
        \`;
      } catch (err) {
        console.error("Erreur lors de l'affichage des détails:", err);
        panel.innerHTML = '<div class="p-8 text-center text-red-400 text-xs font-mono">Erreur lors de l\\'affichage des détails : ' + (err.message || err) + '</div>';
      }
    }

    function formatDatetimeLocal(d) {
      if (!d || !(d instanceof Date) || isNaN(d.getTime())) d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const year = d.getFullYear();
      const month = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const hours = pad(d.getHours());
      const mins = pad(d.getMinutes());
      return year + '-' + month + '-' + day + 'T' + hours + ':' + mins;
    }

    function openAdminDatePicker(inputId) {
      const el = document.getElementById(inputId);
      if (!el) return;
      try {
        if (el.showPicker) {
          el.showPicker();
        } else {
          el.focus();
        }
      } catch (e) {
        el.focus();
      }
    }

    function setAdminStartDateNow() {
      const startInput = document.getElementById('admin-confirm-start-date');
      if (!startInput) return;
      startInput.value = formatDatetimeLocal(new Date());
    }

    function adjustAdminStartDateDays(days) {
      const startInput = document.getElementById('admin-confirm-start-date');
      if (!startInput) return;
      const current = startInput.value ? new Date(startInput.value) : new Date();
      const adjusted = new Date(current.getTime() + days * 24 * 60 * 60 * 1000);
      startInput.value = formatDatetimeLocal(adjusted);
    }

    function setAdminEndDateDays(days) {
      const startInput = document.getElementById('admin-confirm-start-date');
      const endInput = document.getElementById('admin-confirm-end-date');
      if (!endInput) return;
      const start = startInput && startInput.value ? new Date(startInput.value) : new Date();
      const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
      endInput.value = formatDatetimeLocal(end);
    }

    function extendAdminEndDateFromCurrentSub(existingEndDateStr, daysToAdd = 30) {
      const endInput = document.getElementById('admin-confirm-end-date');
      if (!endInput || !existingEndDateStr) return;
      const existingDate = new Date(existingEndDateStr);
      const base = isNaN(existingDate.getTime()) ? new Date() : existingDate;
      const startTime = base.getTime() < Date.now() ? Date.now() : base.getTime();
      const newEnd = new Date(startTime + daysToAdd * 24 * 60 * 60 * 1000);
      endInput.value = formatDatetimeLocal(newEnd);
      showToast("Date de fin prolongée jusqu'au " + newEnd.toLocaleDateString('fr-FR') + " (+" + daysToAdd + " jours) !");
    }

    function setAdminGraceDays(days) {
      const el = document.getElementById('admin-confirm-grace-days');
      if (el) el.value = days;
    }

    function updateAdminLiveStoragePreview(currentTotalMb) {
      const input = document.getElementById('admin-confirm-allocated-mb');
      if (!input) return;
      const addedMb = parseFloat(input.value) || 0;
      const finalMb = currentTotalMb + addedMb;
      const addedFormatted = addedMb >= 1024 ? (addedMb / 1024).toFixed(1) + ' Go' : addedMb + ' Mo';
      const finalFormatted = finalMb >= 1024 ? (finalMb / 1024).toFixed(1) + ' Go' : finalMb + ' Mo';

      const addedEl = document.getElementById('admin-preview-added-mb');
      if (addedEl) addedEl.textContent = (addedMb >= 0 ? '+' : '') + addedMb + ' Mo';

      const totalEl = document.getElementById('admin-preview-total-mb');
      if (totalEl) totalEl.textContent = finalMb + ' Mo';

      const finalFormattedEl = document.getElementById('admin-preview-future-formatted');
      if (finalFormattedEl) finalFormattedEl.textContent = finalFormatted;

      const btnText = document.getElementById('admin-confirm-submit-btn-text');
      if (btnText) btnText.textContent = 'Confirmer & Valider comme Abonné (+ ' + addedFormatted + ')';
    }

    function setAdminAllocatedMb(mb, currentTotalMb) {
      const input = document.getElementById('admin-confirm-allocated-mb');
      if (!input) return;
      input.value = mb;
      updateAdminLiveStoragePreview(currentTotalMb);
    }

    function toggleDemandeOptionsMenu() {
      const drop = document.getElementById('demande-options-dropdown');
      if (!drop) return;
      drop.classList.toggle('hidden');
    }

    document.addEventListener('click', (e) => {
      const drop = document.getElementById('demande-options-dropdown');
      const btn = document.getElementById('demande-options-btn');
      if (drop && !drop.classList.contains('hidden')) {
        if (btn && !btn.contains(e.target) && !drop.contains(e.target)) {
          drop.classList.add('hidden');
        }
      }
    });

    // ========================================================================
    // MODALE HISTORIQUE UTILISATEUR
    // ========================================================================
    function openUserHistoryModal(userId, tab = 'requests') {
      activeHistoryUserId = userId;
      activeHistoryTab = tab;
      const modal = document.getElementById('user-history-modal');
      const user = allUsers.find(u => u.user.id === userId);
      const title = document.getElementById('user-history-modal-title');
      if (title) {
        title.textContent = "Dossier & Historique de " + (user ? user.user.name : "l'Utilisateur");
      }
      switchUserHistoryTab(tab);
      if (modal) modal.classList.remove('hidden');
      const drop = document.getElementById('demande-options-dropdown');
      if (drop) drop.classList.add('hidden');
    }

    function closeUserHistoryModal(e) {
      if (e && e.target && e.target.id !== 'user-history-modal' && e.type === 'click' && !e.target.closest('button')) return;
      const modal = document.getElementById('user-history-modal');
      if (modal) modal.classList.add('hidden');
    }

    function switchUserHistoryTab(tab) {
      activeHistoryTab = tab;
      ['requests', 'active', 'cancelled'].forEach(t => {
        const btn = document.getElementById('hist-tab-' + t);
        if (!btn) return;
        if (t === tab) {
          btn.className = "px-3 py-1.5 rounded-lg bg-orange-600 text-white transition";
        } else {
          btn.className = "px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition";
        }
      });

      const container = document.getElementById('user-history-modal-content');
      if (!container || !activeHistoryUserId) return;

      if (tab === 'requests') {
        const reqs = allRequests.filter(r => r.user_id === activeHistoryUserId);
        if (reqs.length === 0) {
          container.innerHTML = '<div class="p-6 text-center text-slate-500 text-xs">Aucune demande de stockage enregistrée pour cet utilisateur.</div>';
          return;
        }
        container.innerHTML = reqs.map(r => \`
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div class="space-y-1">
              <div class="font-bold text-white flex items-center gap-2">
                <span>\${r.pack_name || 'Pack Stockage'}</span>
                <span class="text-blue-400 font-mono">+\${r.additional_mb >= 1024 ? (r.additional_mb/1024).toFixed(1) + ' Go' : r.additional_mb + ' Mo'}</span>
              </div>
              <div class="text-[10px] text-slate-400 font-mono">
                📅 \${formatFullDateFrench(r.created_at)}
              </div>
              <div class="text-[10px] text-emerald-400">
                Prix : \${Number(r.price_paid || 0).toLocaleString('fr-FR')} \${r.currency || 'FCFA'}
              </div>
            </div>
            <div class="text-right">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold \${r.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}">
                \${(r.status || 'pending').toUpperCase()}
              </span>
              \${r.receipt_image_url ? \`
                <button onclick="openReceiptZoomModal(this.getAttribute('data-img'), 'Reçu de paiement')" data-img="\${r.receipt_image_url}" class="block mt-2 text-[10px] text-orange-400 underline cursor-pointer">
                  Voir le reçu
                </button>
              \` : ''}
            </div>
          </div>
        \`).join('');
      } else if (tab === 'active') {
        const subs = allSubscriptions.filter(s => s.user_id === activeHistoryUserId && s.status === 'active');
        if (subs.length === 0) {
          container.innerHTML = '<div class="p-6 text-center text-slate-500 text-xs">Aucun abonnement en cours pour cet utilisateur.</div>';
          return;
        }
        container.innerHTML = subs.map(s => \`
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 border-l-4 border-l-emerald-500">
            <div class="space-y-1">
              <div class="font-bold text-white flex items-center gap-2">
                <span>\${s.plan_name || 'Abonnement'}</span>
                <span class="text-emerald-400 font-mono">\${s.total_storage_mb >= 1024 ? (s.total_storage_mb/1024).toFixed(1) + ' Go' : s.total_storage_mb + ' Mo'} Total</span>
              </div>
              <div class="text-[10px] text-slate-400 font-mono">
                Début : \${formatFullDateFrench(s.start_date || s.created_at)}
              </div>
              <div class="text-[10px] text-emerald-300">
                Prix mensuel : \${Number(s.monthly_price || 0).toLocaleString('fr-FR')} \${s.currency || 'FCFA'}
              </div>
            </div>
            <div class="text-right">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">ACTIF</span>
              <button onclick="cancelSubscription('\${s.id}', '\${s.user_id}')" class="block mt-2 px-2.5 py-1 bg-red-500/20 text-red-300 rounded text-[10px] font-bold hover:bg-red-500/30 transition cursor-pointer">
                Annuler
              </button>
            </div>
          </div>
        \`).join('');
      } else if (tab === 'cancelled') {
        const subs = allSubscriptions.filter(s => s.user_id === activeHistoryUserId && s.status === 'cancelled');
        if (subs.length === 0) {
          container.innerHTML = '<div class="p-6 text-center text-slate-500 text-xs">Aucun abonnement annulé pour cet utilisateur.</div>';
          return;
        }
        container.innerHTML = subs.map(s => \`
          <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 border-l-4 border-l-red-500">
            <div class="space-y-1">
              <div class="font-bold text-white flex items-center gap-2">
                <span>\${s.plan_name || 'Abonnement'}</span>
                <span class="text-slate-400 font-mono">Était à : \${s.previous_storage_mb || s.total_storage_mb || 0} Mo</span>
              </div>
              <div class="text-[10px] text-red-300">
                Motif d'annulation : \${s.cancel_reason || 'Résiliation client ou admin'}
              </div>
              <div class="text-[10px] text-slate-400 font-mono">
                Annulé le : \${formatFullDateFrench(s.cancelled_at || s.updated_at)}
              </div>
            </div>
            <div class="text-right">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400">ANNULÉ</span>
            </div>
          </div>
        \`).join('');
      }
    }

    // ========================================================================
    // MODALE ZOOM REÇU DE PAIEMENT
    // ========================================================================
    function openReceiptZoomModal(imageUrl, caption = '') {
      if (!imageUrl) return;
      const modal = document.getElementById('receipt-zoom-modal');
      const img = document.getElementById('receipt-zoom-img');
      const cap = document.getElementById('receipt-zoom-caption');
      const dl = document.getElementById('receipt-zoom-download');
      if (img) img.src = imageUrl;
      if (cap) cap.textContent = caption || "Reçu de paiement hébergé dans Cloudflare R2";
      if (dl) dl.href = imageUrl;
      if (modal) modal.classList.remove('hidden');
    }

    function closeReceiptZoomModal(e) {
      if (e && e.target && e.target.id !== 'receipt-zoom-modal' && e.type === 'click' && !e.target.closest('button')) return;
      const modal = document.getElementById('receipt-zoom-modal');
      if (modal) modal.classList.add('hidden');
    }

    // ========================================================================
    // ACTIONS ADMIN : CONFIRMATION COMPLÈTE, REJET ET ANNULATION D'ABONNEMENT
    // ========================================================================
    async function confirmAndApproveStorageRequest(requestId) {
      const startDateInput = document.getElementById('admin-confirm-start-date');
      const endDateInput = document.getElementById('admin-confirm-end-date');
      const graceDaysInput = document.getElementById('admin-confirm-grace-days');
      const allocatedMbInput = document.getElementById('admin-confirm-allocated-mb');
      const priceInput = document.getElementById('admin-confirm-price');

      const startDate = startDateInput ? startDateInput.value : new Date().toISOString();
      const endDate = endDateInput ? endDateInput.value : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const gracePeriodDays = graceDaysInput ? parseInt(graceDaysInput.value) || 5 : 5;
      const allocatedMb = (allocatedMbInput && !isNaN(parseFloat(allocatedMbInput.value))) ? parseFloat(allocatedMbInput.value) : 1024;
      const pricePaid = priceInput ? parseFloat(priceInput.value) || 0 : 0;

      const confirmMsg = allocatedMb > 0 
        ? ("Voulez-vous valider cet abonnement et allouer immédiatement +" + allocatedMb + " Mo à cet utilisateur ?")
        : "Voulez-vous valider le renouvellement de cette période d'abonnement pour cet utilisateur ?";
      if (!confirm(confirmMsg)) return;

      try {
        const resp = await fetch('/api/storage-requests/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            startDate,
            endDate,
            gracePeriodDays,
            allocatedMb,
            pricePaid
          })
        });

        const res = await resp.json();
        if (res.success) {
          // Mettre à jour la demande locale
          const req = allRequests.find(r => String(r.id) === String(requestId));
          if (req) {
            req.status = 'approved';
            req.confirmed_start_date = startDate;
            req.confirmed_end_date = endDate;
            req.grace_period_days = gracePeriodDays;
          }

          // Passer les anciens abonnements actifs de cet utilisateur à 'renewed'
          allSubscriptions.forEach(s => {
            if (s.user_id === res.userId && s.status === 'active') {
              s.status = 'renewed';
            }
          });

          // Ajouter ou activer la souscription locale
          if (res.subscription) {
            allSubscriptions.unshift(res.subscription);
          }

          // Mettre à jour le quota de l'utilisateur dans allUsers
          const userItem = allUsers.find(u => u.user.id === res.userId);
          if (userItem) {
            userItem.quotaConfig.paidTotalMb = res.newPaidTotalMb;
            const newTotal = userItem.quotaConfig.welcomeTotalMb + userItem.quotaConfig.paidTotalMb;
            userItem.quotaConfig.totalAllowedMb = newTotal;
            userItem.quotaConfig.totalAllowedFormatted = newTotal >= 1024 ? (newTotal/1024).toFixed(1) + ' Go' : newTotal + ' Mo';
            userItem.quotaConfig.totalAllowedBytes = newTotal * 1024 * 1024;
            userItem.quotaConfig.planName = 'payant';
          }

          showToast(allocatedMb > 0 ? ("Abonnement confirmé avec succès ! +" + allocatedMb + " Mo alloués.") : "Abonnement et période renouvelés avec succès !");
          updateDemandesTabCounts();
          renderDemandesLeftList();
          
          // Basculer sur l'onglet 'active' ou réafficher l'élément
          if (res.subscription) {
            setDemandesTab('active');
            selectDemandeItem(res.subscription.id, 'subscription');
          } else {
            renderDemandeDetail(requestId, 'request');
          }
        } else {
          alert("Erreur: " + (res.error || "Impossible de confirmer l'abonnement"));
        }
      } catch (err) {
        alert("Erreur réseau lors de la confirmation");
      }
    }

    async function rejectStorageRequest(requestId) {
      const reason = prompt("Motif du rejet (ex: Reçu illisible, montant erroné ou virement non reçu) :", "Paiement non confirmé");
      if (reason === null) return;

      try {
        const resp = await fetch('/api/storage-requests/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, reason })
        });
        const res = await resp.json();
        if (res.success) {
          const req = allRequests.find(r => String(r.id) === String(requestId));
          if (req) {
            req.status = 'rejected';
            req.admin_notes = reason;
          }
          showToast("Demande rejetée.");
          updateDemandesTabCounts();
          renderDemandesLeftList();
          autoSelectFirstDemande();
        } else {
          alert("Erreur: " + (res.error || "Échec"));
        }
      } catch (err) {
        alert("Erreur réseau lors du rejet");
      }
    }

    async function cancelSubscription(subscriptionId, userId) {
      const reason = prompt("Motif de l'annulation de l'abonnement :", "Demande de résiliation par l'étudiant");
      if (reason === null) return;

      try {
        const resp = await fetch('/api/storage-requests/cancel-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscriptionId, userId, reason })
        });
        const res = await resp.json();
        if (res.success) {
          const sub = allSubscriptions.find(s => String(s.id) === String(subscriptionId));
          if (sub) {
            sub.status = 'cancelled';
            sub.cancelled_at = new Date().toISOString();
            sub.cancel_reason = reason;
            sub.previous_storage_mb = res.previousStorageMb;
          }
          const userItem = allUsers.find(u => u.user.id === userId);
          if (userItem) {
            userItem.quotaConfig.paidTotalMb = res.newPaidTotalMb;
            const newTotal = userItem.quotaConfig.welcomeTotalMb + userItem.quotaConfig.paidTotalMb;
            userItem.quotaConfig.totalAllowedMb = newTotal;
            userItem.quotaConfig.totalAllowedFormatted = newTotal >= 1024 ? (newTotal/1024).toFixed(1) + ' Go' : newTotal + ' Mo';
            userItem.quotaConfig.totalAllowedBytes = newTotal * 1024 * 1024;
          }

          showToast("Abonnement annulé avec succès.");
          updateDemandesTabCounts();
          renderDemandesLeftList();
          renderDemandeDetail(subscriptionId, 'subscription');
        } else {
          alert("Erreur: " + (res.error || "Échec d'annulation"));
        }
      } catch (err) {
        alert("Erreur réseau lors de l'annulation");
      }
    }

    async function deleteStorageRequest(requestId) {
      if (!confirm("Voulez-vous supprimer définitivement cette demande de la base de données ?")) return;
      try {
        const resp = await fetch('/api/storage-requests/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId })
        });
        const res = await resp.json();
        if (res.success) {
          allRequests = allRequests.filter(r => String(r.id) !== String(requestId));
          showToast("Demande supprimée définitivement.");
          updateDemandesTabCounts();
          renderDemandesLeftList();
          autoSelectFirstDemande();
        } else {
          alert("Erreur: " + (res.error || "Impossible de supprimer la demande"));
        }
      } catch (err) {
        alert("Erreur réseau lors de la suppression");
      }
    }

    // ========================================================================
    // NOUVELLE VUE : GESTION DES DEMANDES DE CRÉDITS IA (V1)
    // ========================================================================
    function formatAiWords(words) {
      const n = Number(words || 0);
      if (n <= 0) return '0 mot';
      return n.toLocaleString('fr-FR') + ' mots IA';
    }

    function setDemandesIaTab(tab) {
      currentDemandeIaTab = tab;
      ['pending', 'active', 'cancelled', 'all'].forEach(t => {
        const btn = document.getElementById('demande-ia-tab-' + t);
        if (!btn) return;
        if (t === tab) {
          btn.className = "px-2 py-1.5 rounded-lg bg-orange-600 text-white flex items-center justify-between transition-all cursor-pointer shadow-sm";
        } else {
          btn.className = "px-2 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700/80 flex items-center justify-between transition-all cursor-pointer";
        }
      });

      const label = document.getElementById('demandes-ia-filter-label');
      if (label) {
        const labels = {
          pending: "Demandes de crédits IA en attente de validation",
          active: "Abonnements et packs IA validés / actifs",
          cancelled: "Demandes IA refusées ou abonnements résiliés",
          all: "Tous les utilisateurs inscrits & Bilans crédits IA"
        };
        label.textContent = labels[tab] || '';
      }

      updateDemandesIaTabCounts();
      renderDemandesIaLeftList();
      autoSelectFirstDemandeIa();
    }

    function updateDemandesIaTabCounts() {
      const pendingCount = allRequests.filter(r => r.status === 'pending' && isAiRequest(r)).length;
      const activeCount = allSubscriptions.filter(s => s.status === 'active' && isAiSubscription(s)).length + allRequests.filter(r => (r.status === 'approved' || r.status === 'active') && isAiRequest(r)).length;
      const cancelledCount = allSubscriptions.filter(s => s.status === 'cancelled' && isAiSubscription(s)).length + allRequests.filter(r => r.status === 'rejected' && isAiRequest(r)).length;
      const allUsersCount = allUsers.length;

      const pEl = document.getElementById('tab-ia-count-pending');
      const aEl = document.getElementById('tab-ia-count-active');
      const cEl = document.getElementById('tab-ia-count-cancelled');
      const allEl = document.getElementById('tab-ia-count-all');

      if (pEl) pEl.textContent = pendingCount;
      if (aEl) aEl.textContent = activeCount;
      if (cEl) cEl.textContent = cancelledCount;
      if (allEl) allEl.textContent = allUsersCount;
    }

    function filterDemandesIaLeft() {
      renderDemandesIaLeftList();
    }

    function autoSelectFirstDemandeIa() {
      const q = (document.getElementById('demandes-ia-search-input')?.value || '').toLowerCase().trim();
      let list = getFilteredDemandesIaList(q);
      if (list.length > 0) {
        const first = list[0];
        selectedDemandeIaId = first.id;
        selectedDemandeIaType = first.itemType;
        renderDemandeIaDetail(first.id, first.itemType);
        renderDemandesIaLeftList();
      } else {
        selectedDemandeIaId = null;
        const panel = document.getElementById('demandes-ia-right-detail-panel');
        if (panel) {
          panel.innerHTML = '<div class="h-full flex flex-col items-center justify-center text-center text-slate-500 py-20">' +
            '<div class="w-16 h-16 rounded-2xl bg-slate-800/60 text-3xl flex items-center justify-center mb-3">🤖</div>' +
            '<h3 class="text-sm font-bold text-slate-300">Aucun élément dans cette section</h3>' +
            '<p class="text-xs text-slate-500 mt-1 max-w-sm">Aucune demande de crédits IA ne correspond au filtre sélectionné.</p>' +
          '</div>';
        }
      }
    }

    function getFilteredDemandesIaList(q = '') {
      let combined = [];

      // 1. ONGLET 'pending' : Demandes IA en attente
      if (currentDemandeIaTab === 'pending') {
        allRequests.filter(r => r.status === 'pending' && isAiRequest(r)).forEach(req => {
          const user = allUsers.find(u => u.user.id === req.user_id);
          const isRenewal = req.request_type === 'renewal' ||
            (req.pack_name && req.pack_name.toLowerCase().includes('renouvellement')) ||
            (req.notes && req.notes.toLowerCase().includes('renouvellement'));
          combined.push({
            id: req.id,
            itemType: 'request',
            raw: req,
            isRenewal: Boolean(isRenewal),
            requestType: isRenewal ? 'renewal' : (req.request_type || 'upgrade'),
            userId: req.user_id,
            userName: req.user_name || (user ? user.user.name : 'Utilisateur'),
            userPhone: req.contact_phone || req.user_phone || (user ? user.user.phone : ''),
            contactPhone: req.contact_phone || req.user_phone || (user ? user.user.phone : ''),
            userWhatsapp: req.user_whatsapp || '',
            storageDisplay: req.storage_display || '',
            priceDisplay: req.price_display || '',
            billingCycle: req.billing_cycle || 'annual',
            notes: req.notes || '',
            userAvatar: user ? user.user.avatar_url : '',
            isOnline: user ? user.user.isOnline : false,
            packName: req.pack_name || 'Pack IA',
            amountWords: req.additional_words || (req.additional_mb ? req.additional_mb * 1000 : 100000),
            pricePaid: req.price_paid || 0,
            currency: req.currency || 'FCFA',
            status: 'pending',
            date: req.created_at,
            receiptUrl: req.receipt_image_url || '',
            receiptR2Key: req.receipt_r2_key || '',
            paymentMethod: req.payment_method || 'Mobile Money',
            paymentReference: req.payment_reference || ''
          });
        });
      }

      // 2. ONGLET 'active' : Abonnements et demandes validées IA
      else if (currentDemandeIaTab === 'active') {
        const addedIds = new Set();
        allSubscriptions.filter(s => s.status === 'active' && isAiSubscription(s)).forEach(sub => {
          const user = allUsers.find(u => u.user.id === sub.user_id);
          addedIds.add(sub.request_id || sub.id);
          combined.push({
            id: sub.id,
            itemType: 'subscription',
            raw: sub,
            userId: sub.user_id,
            userName: sub.user_name || (user ? user.user.name : 'Abonné IA'),
            userPhone: sub.user_phone || (user ? user.user.phone : ''),
            contactPhone: sub.user_phone || (user ? user.user.phone : ''),
            userWhatsapp: '',
            userAvatar: user ? user.user.avatar_url : '',
            isOnline: user ? user.user.isOnline : false,
            packName: sub.plan_name || 'Abonnement IA',
            amountWords: sub.additional_words || 100000,
            storageDisplay: sub.additional_words ? (Number(sub.additional_words).toLocaleString('fr-FR') + ' crédits IA') : '100 000 crédits IA',
            pricePaid: sub.monthly_price || 0,
            currency: sub.currency || 'FCFA',
            status: 'active',
            date: sub.start_date || sub.created_at,
            endDate: sub.end_date || '',
            gracePeriodDays: sub.grace_period_days || 5,
            receiptUrl: '',
            receiptR2Key: '',
            paymentMethod: 'Mobile Money',
            paymentReference: ''
          });
        });

        allRequests.filter(r => (r.status === 'approved' || r.status === 'active') && isAiRequest(r)).forEach(req => {
          if (!addedIds.has(req.id)) {
            const user = allUsers.find(u => u.user.id === req.user_id);
            combined.push({
              id: req.id,
              itemType: 'request',
              raw: req,
              userId: req.user_id,
              userName: req.user_name || (user ? user.user.name : 'Utilisateur'),
              userPhone: req.contact_phone || req.user_phone || (user ? user.user.phone : ''),
              contactPhone: req.contact_phone || req.user_phone || (user ? user.user.phone : ''),
              userWhatsapp: req.user_whatsapp || '',
              storageDisplay: req.storage_display || '',
              priceDisplay: req.price_display || '',
              userAvatar: user ? user.user.avatar_url : '',
              isOnline: user ? user.user.isOnline : false,
              packName: req.pack_name || 'Pack IA',
              amountWords: req.additional_words || 100000,
              pricePaid: req.price_paid || 0,
              currency: req.currency || 'FCFA',
              status: 'approved',
              date: req.updated_at || req.created_at,
              endDate: req.confirmed_end_date || '',
              receiptUrl: req.receipt_image_url || '',
              receiptR2Key: req.receipt_r2_key || '',
              paymentMethod: req.payment_method || 'Mobile Money',
              paymentReference: req.payment_reference || ''
            });
          }
        });
      }

      // 3. ONGLET 'cancelled' : Demandes IA rejetées ou abonnements annulés
      else if (currentDemandeIaTab === 'cancelled') {
        allSubscriptions.filter(s => s.status === 'cancelled' && isAiSubscription(s)).forEach(sub => {
          const user = allUsers.find(u => u.user.id === sub.user_id);
          combined.push({
            id: sub.id,
            itemType: 'subscription',
            raw: sub,
            userId: sub.user_id,
            userName: sub.user_name || (user ? user.user.name : 'Abonné IA'),
            userPhone: sub.user_phone || (user ? user.user.phone : ''),
            contactPhone: sub.user_phone || (user ? user.user.phone : ''),
            userWhatsapp: '',
            userAvatar: user ? user.user.avatar_url : '',
            isOnline: user ? user.user.isOnline : false,
            packName: sub.plan_name || 'Abonnement IA',
            amountWords: sub.additional_words || 0,
            storageDisplay: '',
            pricePaid: sub.monthly_price || 0,
            currency: sub.currency || 'FCFA',
            status: 'cancelled',
            date: sub.created_at || sub.start_date,
            cancelledAt: sub.cancelled_at || '',
            cancelReason: sub.cancel_reason || '',
            receiptUrl: '',
            receiptR2Key: '',
            paymentMethod: 'Mobile Money',
            paymentReference: ''
          });
        });

        allRequests.filter(r => r.status === 'rejected' && isAiRequest(r)).forEach(req => {
          const user = allUsers.find(u => u.user.id === req.user_id);
          combined.push({
            id: req.id,
            itemType: 'request',
            raw: req,
            userId: req.user_id,
            userName: req.user_name || (user ? user.user.name : 'Utilisateur'),
            userPhone: req.contact_phone || req.user_phone || (user ? user.user.phone : ''),
            contactPhone: req.contact_phone || req.user_phone || (user ? user.user.phone : ''),
            userWhatsapp: req.user_whatsapp || '',
            storageDisplay: req.storage_display || '',
            priceDisplay: req.price_display || '',
            userAvatar: user ? user.user.avatar_url : '',
            isOnline: user ? user.user.isOnline : false,
            packName: req.pack_name || 'Pack IA',
            amountWords: req.additional_words || 0,
            pricePaid: req.price_paid || 0,
            currency: req.currency || 'FCFA',
            status: 'rejected',
            date: req.updated_at || req.created_at,
            receiptUrl: req.receipt_image_url || '',
            receiptR2Key: req.receipt_r2_key || '',
            paymentMethod: req.payment_method || 'Mobile Money',
            paymentReference: req.payment_reference || '',
            adminNotes: req.admin_notes || ''
          });
        });
      }

      // 4. ONGLET 'all' : TOUS LES UTILISATEURS (Vue Crédits IA)
      else if (currentDemandeIaTab === 'all') {
        allUsers.forEach(u => {
          const activeSub = allSubscriptions.find(s => s.user_id === u.user.id && s.status === 'active' && isAiSubscription(s));
          const pendingReqsCount = allRequests.filter(r => r.user_id === u.user.id && r.status === 'pending' && isAiRequest(r)).length;
          const totalAiReqsCount = allRequests.filter(r => r.user_id === u.user.id && isAiRequest(r)).length;

          combined.push({
            id: 'user_ia_' + u.user.id,
            itemType: 'user_ia',
            raw: u,
            userId: u.user.id,
            userName: u.user.name,
            userPhone: u.user.phone,
            userAvatar: u.user.avatar_url,
            isOnline: u.user.isOnline,
            registeredAt: u.user.created_at,
            activeSub: activeSub || null,
            pendingReqsCount: pendingReqsCount,
            totalAiReqsCount: totalAiReqsCount,
            date: u.user.created_at
          });
        });
      }

      // Tri antéchronologique
      combined.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      if (!q) return combined;

      return combined.filter(item => {
        const text = (item.userName + ' ' + (item.userPhone || '') + ' ' + (item.packName || '') + ' ' + (item.status || '') + ' ' + item.userId).toLowerCase();
        return text.includes(q);
      });
    }

    function renderDemandesIaLeftList() {
      const container = document.getElementById('demandes-ia-left-items-list');
      if (!container) return;

      const q = (document.getElementById('demandes-ia-search-input')?.value || '').toLowerCase().trim();
      const list = getFilteredDemandesIaList(q);

      if (list.length === 0) {
        let emptyMsg = "Aucune demande de crédits IA trouvée.";
        if (currentDemandeIaTab === 'pending') emptyMsg = "Aucune demande de crédits IA en attente.";
        else if (currentDemandeIaTab === 'active') emptyMsg = "Aucun pack ou abonnement IA validé.";
        else if (currentDemandeIaTab === 'cancelled') emptyMsg = "Aucune demande IA refusée.";
        else if (currentDemandeIaTab === 'all') emptyMsg = "Aucun utilisateur trouvé.";

        container.innerHTML = \`
          <div class="p-6 text-center text-slate-500 text-xs">
            \${emptyMsg}
          </div>
        \`;
        return;
      }

      container.innerHTML = list.map(item => {
        const isSelected = item.id === selectedDemandeIaId;

        // CAS A : UTILISATEUR DANS ONGLET TOUS
        if (item.itemType === 'user_ia') {
          let userBadge = item.activeSub 
            ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Abonné IA</span>'
            : (item.totalAiReqsCount > 0 
                ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">🤖 Client IA</span>'
                : '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">Mode Gratuit</span>');

          return \`
            <div 
              onclick="selectDemandeIaItem('\${item.id}', 'user_ia')"
              class="p-2.5 cursor-pointer transition-all flex items-center justify-between \${isSelected ? 'bg-orange-600/15 border-l-4 border-l-orange-500' : 'hover:bg-slate-800/40'}"
            >
              <div class="flex items-center gap-2.5 overflow-hidden">
                <div class="relative w-9 h-9 rounded-xl bg-slate-800 text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-700">
                  \${item.userAvatar ? '<img src="' + item.userAvatar + '" class="w-full h-full rounded-xl object-cover" onerror="this.remove()">' : item.userName.charAt(0).toUpperCase()}
                  <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 \${item.isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}" title="\${item.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
                </div>
                <div class="truncate">
                  <div class="font-bold text-white truncate text-xs flex items-center gap-1.5">
                    <span class="truncate">\${item.userName}</span>
                  </div>
                  <div class="text-[10px] text-slate-400 truncate">
                    📞 \${item.userPhone || 'Sans numéro'}
                  </div>
                  <div class="text-[9px] text-slate-500 font-mono mt-0.5">
                    Inscrit le \${formatShortDateFrench(item.registeredAt)}
                  </div>
                </div>
              </div>

              <div class="text-right shrink-0 space-y-1">
                \${userBadge}
                \${item.pendingReqsCount > 0 ? \`<div class="text-[9px] font-mono font-bold text-amber-400">\${item.pendingReqsCount} en attente</div>\` : ''}
              </div>
            </div>
          \`;
        }

        // CAS B : DEMANDE OU ABONNEMENT IA
        let badgeHtml = '';
        if (item.status === 'pending') {
          badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 En attente</span>';
        } else if (item.status === 'active' || item.status === 'approved') {
          badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Validé</span>';
        } else if (item.status === 'rejected') {
          badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">🔴 Refusé</span>';
        } else {
          badgeHtml = '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">⚪ Annulé</span>';
        }

        const wordsLabel = item.storageDisplay || formatAiWords(item.amountWords);

        return \`
          <div 
            onclick="selectDemandeIaItem('\${item.id}', '\${item.itemType}')"
            class="p-2.5 cursor-pointer transition-all flex items-center justify-between \${isSelected ? 'bg-orange-600/15 border-l-4 border-l-orange-500' : 'hover:bg-slate-800/40'}"
          >
            <div class="flex items-center gap-2.5 overflow-hidden">
              <div class="relative w-9 h-9 rounded-xl bg-slate-800 text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-700">
                \${item.userAvatar ? '<img src="' + item.userAvatar + '" class="w-full h-full rounded-xl object-cover" onerror="this.remove()">' : item.userName.charAt(0).toUpperCase()}
                <span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 \${item.isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}" title="\${item.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
              </div>
              <div class="truncate">
                <div class="font-bold text-white truncate text-xs flex items-center gap-1.5">
                  <span class="truncate">\${item.userName}</span>
                </div>
                <div class="text-[10px] text-slate-400 truncate flex items-center gap-1">
                  <span>📞 \${item.userPhone || 'Sans numéro'}</span>
                  <span>•</span>
                  <span class="text-orange-400 font-medium truncate">\${item.packName}</span>
                </div>
                <div class="text-[9px] text-slate-500 font-mono mt-0.5">
                  \${formatShortDateFrench(item.date)}
                </div>
              </div>
            </div>

            <div class="text-right shrink-0 space-y-1">
              \${badgeHtml}
              <div class="text-xs font-mono font-bold text-white">\${wordsLabel}</div>
              \${item.pricePaid > 0 ? \`<div class="text-[10px] font-mono text-emerald-400 font-semibold">\${Number(item.pricePaid).toLocaleString('fr-FR')} \${item.currency}</div>\` : ''}
            </div>
          </div>
        \`;
      }).join('');
    }

    function selectDemandeIaItem(id, itemType) {
      selectedDemandeIaId = id;
      selectedDemandeIaType = itemType;
      renderDemandesIaLeftList();
      renderDemandeIaDetail(id, itemType);
    }

    function updateAdminLiveIaPreview(currentTotalWords) {
      const input = document.getElementById('admin-confirm-allocated-ia-words');
      if (!input) return;
      const addedWords = parseInt(input.value, 10) || 0;
      const finalWords = currentTotalWords + addedWords;

      const addedEl = document.getElementById('admin-preview-ia-added-words');
      if (addedEl) addedEl.textContent = (addedWords >= 0 ? '+' : '') + addedWords.toLocaleString('fr-FR') + ' crédits';

      const totalEl = document.getElementById('admin-preview-ia-total-words');
      if (totalEl) totalEl.textContent = finalWords.toLocaleString('fr-FR') + ' crédits';

      const futureFormattedEl = document.getElementById('admin-preview-ia-future-formatted');
      if (futureFormattedEl) futureFormattedEl.textContent = finalWords.toLocaleString('fr-FR') + ' crédits IA';

      const btnText = document.getElementById('admin-confirm-ia-submit-btn-text');
      if (btnText) btnText.textContent = 'Confirmer & Valider la demande IA (+ ' + addedWords.toLocaleString('fr-FR') + ' crédits)';
    }

    function setAdminIaWords(words, currentTotalWords) {
      const input = document.getElementById('admin-confirm-allocated-ia-words');
      if (!input) return;
      input.value = words;
      updateAdminLiveIaPreview(currentTotalWords);
    }

    function renderDemandeIaDetail(id, itemType) {
      const panel = document.getElementById('demandes-ia-right-detail-panel');
      if (!panel) return;

      try {
        const q = (document.getElementById('demandes-ia-search-input')?.value || '').toLowerCase().trim();
        const list = getFilteredDemandesIaList(q);
        const item = list.find(x => String(x.id) === String(id)) || list.find(x => x.id == id) || list[0];

        if (!item) {
          panel.innerHTML = '<div class="p-8 text-center text-slate-500 text-xs">Élément introuvable.</div>';
          return;
        }

        const userDetail = allUsers.find(u => u.user.id === item.userId);
        const u = userDetail ? userDetail.user : {
          id: item.userId,
          name: item.userName || 'Étudiant',
          phone: item.userPhone || '',
          email: '',
          school: '',
          filiere: '',
          avatar_url: item.userAvatar || '',
          isOnline: item.isOnline || false,
          created_at: item.date || ''
        };

        const req = item.raw || {};
        const receiptUrl = item.receiptUrl || req.receipt_image_url || '';
        const paymentMethod = req.payment_method || item.paymentMethod || 'Wave / Mobile Money';
        const paymentRef = (req && req.payment_reference) ? req.payment_reference : ('TXN_' + String(item.id || '').slice(0, 8).toUpperCase());

        window.currentViewedReceiptUrl = receiptUrl;
        window.currentViewedReceiptCaption = 'Reçu de paiement IA - ' + (u.name || 'Étudiant');

        const now = new Date();
        const defaultStartISO = formatDatetimeLocal(now);
        const defaultEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const defaultEndISO = formatDatetimeLocal(defaultEnd);

        const currentTotalWords = Number(req.additional_words || 0);
        const futureTotalWords = currentTotalWords + (item.amountWords || 100000);

        panel.innerHTML = \`
          <!-- EN-TÊTE PROFIL ÉTUDIANT & HISTORIQUE -->
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
            <div class="flex items-start gap-3.5">
              <div class="relative w-12 h-12 rounded-2xl bg-orange-500/20 text-orange-400 font-black flex items-center justify-center border border-orange-500/30 text-lg shrink-0 mt-0.5">
                \${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full rounded-2xl object-cover" onerror="this.remove()">' : u.name.charAt(0).toUpperCase()}
                <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-950 \${u.isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-600'}" title="\${u.isOnline ? 'En ligne' : 'Hors ligne'}"></span>
              </div>
              <div class="space-y-1 text-xs">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-base font-extrabold text-white">\${u.name}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">ID: \${u.id}</span>
                  \${u.isOnline ? \`
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> En ligne
                    </span>
                  \` : \`
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60">
                      <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Hors ligne
                    </span>
                  \`}
                </div>
                <div class="flex items-center gap-3 text-slate-300 flex-wrap">
                  <span class="font-mono">📞 Appel/SMS : <strong>\${item.contactPhone || req.contact_phone || u.phone || 'Non renseigné'}</strong></span>
                  \${(item.userWhatsapp || req.user_whatsapp) ? \`
                    <span>•</span>
                    <a href="https://wa.me/\${(item.userWhatsapp || req.user_whatsapp).replace(/[^0-9]/g, '')}" target="_blank" class="inline-flex items-center gap-1 font-mono text-emerald-400 hover:text-emerald-300 underline font-bold bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                      <span>💬 WhatsApp : \${item.userWhatsapp || req.user_whatsapp}</span>
                    </a>
                  \` : ''}
                  <span>•</span>
                  <span class="font-mono text-slate-400">✉️ \${u.email || 'Non renseigné'}</span>
                </div>
                <div class="text-slate-400">
                  🏛️ <strong>\${u.school || 'École non renseignée'}</strong> \${u.filiere ? '(' + u.filiere + ')' : ''}
                </div>
              </div>
            </div>

            <!-- BOUTON HISTORIQUE -->
            <div class="relative inline-block text-left shrink-0">
              <button 
                onclick="openUserHistoryModal('\${u.id}', 'requests')"
                class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                <span>📜</span>
                <span>Historique</span>
              </button>
            </div>
          </div>

          <!-- DÉTAILS DU PACK IA SOUMIS -->
          <div class="bg-gradient-to-br from-slate-900 via-[#11192e] to-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
              <h4 class="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                <span>🤖</span>
                <span>Pack IA Souscrit : <span class="text-orange-400">\${item.packName}</span></span>
              </h4>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  \${(req.billing_cycle === 'monthly' ? 'Facturation mensuelle' : 'Facturation annuelle')}
                </span>
                <span class="px-2.5 py-1 rounded-lg text-xs font-bold \${item.status === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : (item.status === 'approved' || item.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40')} flex items-center gap-1.5">
                  <span>\${item.status === 'pending' ? '🟡 En attente de validation' : (item.status === 'approved' || item.status === 'active' ? '🟢 Validé / Actif' : '🔴 Refusé')}</span>
                </span>
              </div>
            </div>

            <!-- GRILLE RÉCAPITULATIF PACK IA -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Crédits IA Inclus</span>
                <div class="text-base font-black text-orange-400 font-mono">\${item.storageDisplay || formatAiWords(item.amountWords)}</div>
              </div>
              <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Montant Payé</span>
                <div class="text-base font-black text-emerald-400 font-mono">\${Number(item.pricePaid || 0).toLocaleString('fr-FR')} \${item.currency || 'FCFA'}</div>
              </div>
              <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Mode de paiement</span>
                <div class="text-xs font-bold text-slate-200 truncate">\${paymentMethod}</div>
              </div>
              <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <span class="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Référence / Date</span>
                <div class="text-[11px] font-mono text-slate-300 truncate">\${paymentRef}</div>
                <div class="text-[9px] text-slate-500 font-mono">\${formatShortDateFrench(item.date)}</div>
              </div>
            </div>

            <!-- REÇU DE PAIEMENT JOINT (PREVIEW AVEC ZOOM IDENTIQUE AU MENU STOCKAGE) -->
            <div class="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>🧾</span> Reçu de paiement joint par l'étudiant
                </span>
                \${receiptUrl ? \`
                  <button 
                    onclick="openCurrentReceiptZoom()" 
                    class="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 cursor-pointer bg-orange-500/10 px-2.5 py-1 rounded-lg border border-orange-500/30 transition"
                  >
                    <span>🔍</span> Agrandir / Zoomer le reçu
                  </button>
                \` : ''}
              </div>

              \${receiptUrl ? \`
                <div class="flex flex-col sm:flex-row items-center gap-4">
                  <div class="relative group cursor-pointer w-44 h-44 rounded-xl overflow-hidden border-2 border-slate-700 bg-black/60 shrink-0" onclick="openCurrentReceiptZoom()">
                    <img src="\${receiptUrl}" class="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" alt="Reçu de paiement" />
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5">
                      <span>🔍 Cliquer pour zoomer</span>
                    </div>
                  </div>
                  <div class="space-y-2 text-xs text-slate-300">
                    <div class="text-emerald-400 font-bold flex items-center gap-1">
                      <span>✓</span> Fichier reçu accessible et vérifiable
                    </div>
                    <div class="text-slate-400 text-[11px]">
                      Vérifiez soigneusement la conformité du montant (\${Number(item.pricePaid || 0).toLocaleString('fr-FR')} \${item.currency || 'FCFA'}), la date de transaction et le numéro de compte avant toute attribution.
                    </div>
                    <div>
                      <button 
                        type="button"
                        onclick="openCurrentReceiptZoom()"
                        class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>👁️</span> Ouvrir en plein écran
                      </button>
                    </div>
                  </div>
                </div>
              \` : \`
                <div class="p-4 bg-slate-900/60 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                  <span>⚠️ Aucun fichier de reçu téléversé pour cette demande.</span>
                </div>
              \`}
            </div>

            \${item.status === 'pending' ? \`
              <!-- FORMULAIRE DE VALIDATION ADMINISTRATIVE & ATTRIBUTION DES MOTS IA -->
              <div class="space-y-4 pt-2">
                <div class="border-b border-slate-800 pb-2">
                  <h4 class="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚡</span> Validation Administrative & Attribution des Crédits IA
                  </h4>
                  <p class="text-[11px] text-slate-400 mt-0.5">Définissez la durée d'activation et le quota de crédits IA à allouer au compte de l'étudiant.</p>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <!-- COLONNE GAUCHE (7/12) : DATES & ALLOCATION -->
                  <div class="lg:col-span-7 space-y-3">
                    
                    <!-- 1. DATE D'ACTIVATION -->
                    <div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div class="flex items-center justify-between">
                        <label class="text-slate-200 font-bold text-xs">1. Date d'activation :</label>
                        <span class="text-[10px] text-emerald-400 font-mono">Date de départ</span>
                      </div>
                      <input 
                        type="datetime-local" 
                        id="admin-confirm-ia-start-date" 
                        value="\${defaultStartISO}"
                        class="w-full bg-slate-950 text-white font-mono text-xs px-3 py-2 rounded-xl border border-slate-700 focus:border-emerald-500 focus:outline-none"
                      >
                    </div>

                    <!-- 2. DATE DE FIN / VALIDITÉ -->
                    <div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-2">
                      <div class="flex items-center justify-between">
                        <label class="text-slate-200 font-bold text-xs">2. Date d'échéance :</label>
                        <span class="text-[10px] text-amber-400 font-mono">Expiration</span>
                      </div>
                      <input 
                        type="datetime-local" 
                        id="admin-confirm-ia-end-date" 
                        value="\${defaultEndISO}"
                        class="w-full bg-slate-950 text-white font-mono text-xs px-3 py-2 rounded-xl border border-slate-700 focus:border-emerald-500 focus:outline-none"
                      >
                      <div class="flex items-center gap-1.5 flex-wrap pt-1 text-[10px]">
                        <button type="button" onclick="setAdminEndDateDaysCustom('admin-confirm-ia-start-date', 'admin-confirm-ia-end-date', 30)" class="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono rounded cursor-pointer">+1 Mois (30j)</button>
                        <button type="button" onclick="setAdminEndDateDaysCustom('admin-confirm-ia-start-date', 'admin-confirm-ia-end-date', 90)" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono rounded cursor-pointer">+3 Mois</button>
                        <button type="button" onclick="setAdminEndDateDaysCustom('admin-confirm-ia-start-date', 'admin-confirm-ia-end-date', 365)" class="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono rounded cursor-pointer">+1 An</button>
                      </div>
                    </div>

                    <!-- 3. MOTS IA À ALLOUER & PRIX -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <div class="flex items-center justify-between">
                          <span class="text-slate-300 font-bold text-xs">Crédits IA à allouer :</span>
                          <span class="text-[10px] text-orange-400 font-mono">Crédits</span>
                        </div>
                        <input 
                          type="number" 
                          id="admin-confirm-allocated-ia-words" 
                          value="\${item.amountWords || 100000}" 
                          oninput="updateAdminLiveIaPreview(0)"
                          class="w-full bg-slate-950 text-orange-400 font-black font-mono text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-center focus:border-orange-500 focus:outline-none"
                        >
                        <div class="flex items-center justify-between gap-1 pt-1 flex-wrap text-[10px]">
                          <button type="button" onclick="setAdminIaWords(50000, 0)" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono cursor-pointer">50k</button>
                          <button type="button" onclick="setAdminIaWords(100000, 0)" class="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono font-bold cursor-pointer">100k</button>
                          <button type="button" onclick="setAdminIaWords(250000, 0)" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono cursor-pointer">250k</button>
                          <button type="button" onclick="setAdminIaWords(500000, 0)" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono cursor-pointer">500k</button>
                        </div>
                      </div>

                      <div class="bg-slate-900/70 p-3 rounded-xl border border-slate-800 space-y-1.5">
                        <div class="flex items-center justify-between">
                          <span class="text-slate-300 font-bold text-xs">Prix confirmé :</span>
                          <span class="text-[10px] text-emerald-400 font-mono">Encaissé</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <input 
                            type="number" 
                            id="admin-confirm-ia-price" 
                            value="\${item.pricePaid || 0}" 
                            class="w-full bg-slate-950 text-emerald-400 font-black font-mono text-sm px-3 py-1.5 rounded-lg border border-slate-700 text-center focus:border-emerald-500 focus:outline-none"
                          >
                          <span class="font-bold text-emerald-400 font-mono text-xs">\${item.currency || 'FCFA'}</span>
                        </div>
                        <div class="text-[10px] text-slate-500 text-right">
                          Montant encaissé
                        </div>
                      </div>
                    </div>

                  </div>

                  <!-- COLONNE DROITE (5/12) : SITUATION & TOTAL FINAL -->
                  <div class="lg:col-span-5 bg-gradient-to-b from-slate-900/90 to-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between shadow-xl">
                    <div class="space-y-3">
                      <div class="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span class="text-xs font-black text-white flex items-center gap-1.5">
                          <span>📊</span> Situation & Impact Client
                        </span>
                        <span class="text-[10px] text-slate-400 font-mono">ID: \${u.id}</span>
                      </div>

                      <div class="bg-gradient-to-br from-orange-950/30 via-slate-950 to-emerald-950/30 p-3.5 rounded-xl border-2 border-orange-500/50 shadow-lg space-y-2">
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] uppercase font-black text-orange-400 tracking-wider">
                            🤖 Crédits IA Alloués
                          </span>
                          <span class="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 font-mono font-bold border border-orange-500/30">
                            Après Validation
                          </span>
                        </div>

                        <div class="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                          <span class="text-xs font-bold text-white">Total Crédits IA Alloués :</span>
                          <span id="admin-preview-ia-future-formatted" class="text-base font-black text-orange-400 font-mono">
                            \${formatAiWords(item.amountWords || 100000)}
                          </span>
                        </div>

                        <p class="text-[10px] text-slate-400 leading-tight">
                          Les crédits IA seront immédiatement débloqués pour l'étudiant dans l'application StudyCloud.
                        </p>
                      </div>
                    </div>

                    <div class="pt-2 text-[10px] text-slate-500 text-center font-mono">
                      ✓ Attribution sécurisée D1
                    </div>
                  </div>
                </div>

                <!-- BOUTONS D'ACTION FINALE -->
                <div class="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
                  <button 
                    type="button"
                    onclick="rejectAiRequest('\${item.id}')" 
                    class="px-4 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                  >
                    <span>❌</span> Rejeter la demande
                  </button>

                  <button 
                    type="button"
                    onclick="confirmAndApproveAiRequest('\${item.id}')" 
                    class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xl shadow-emerald-600/30 transition cursor-pointer flex items-center gap-2 active:scale-95"
                  >
                    <span>✅</span> <span id="admin-confirm-ia-submit-btn-text">Confirmer & Valider la demande IA (+ \${formatAiWords(item.amountWords || 100000)})</span>
                  </button>
                </div>

              </div>
            \` : \`
              <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Statut de la demande : <strong class="text-white">\${item.status === 'approved' || item.status === 'active' ? 'Validé' : 'Non modifiable'}</strong></span>
                <span class="text-[11px] font-mono text-slate-500">\${formatFullDateFrench(item.date)}</span>
              </div>
            \`}

          </div>
        \`;
      } catch (err) {
        console.error("Erreur lors de l'affichage des détails IA:", err);
        panel.innerHTML = '<div class="p-8 text-center text-red-400 text-xs font-mono">Erreur lors de l\\\'affichage des détails IA : ' + (err.message || err) + '</div>';
      }
    }

    function setAdminEndDateDaysCustom(startInputId, endInputId, days) {
      const startInput = document.getElementById(startInputId);
      const endInput = document.getElementById(endInputId);
      if (!endInput) return;
      const start = startInput && startInput.value ? new Date(startInput.value) : new Date();
      const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
      endInput.value = formatDatetimeLocal(end);
    }

    async function confirmAndApproveAiRequest(requestId) {
      const startInput = document.getElementById('admin-confirm-ia-start-date');
      const endInput = document.getElementById('admin-confirm-ia-end-date');
      const wordsInput = document.getElementById('admin-confirm-allocated-ia-words');
      const priceInput = document.getElementById('admin-confirm-ia-price');

      const startDate = startInput ? startInput.value : new Date().toISOString();
      const endDate = endInput ? endInput.value : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const allocatedWords = wordsInput ? (parseInt(wordsInput.value, 10) || 100000) : 100000;
      const pricePaid = priceInput ? (parseFloat(priceInput.value) || 0) : 0;

      if (!confirm("Confirmer la validation de cette demande de crédits IA (" + allocatedWords.toLocaleString('fr-FR') + " crédits alloués) ?")) return;

      try {
        const resp = await fetch('/api/ai-requests/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            startDate,
            endDate,
            gracePeriodDays: 5,
            allocatedWords,
            pricePaid
          })
        });

        const res = await resp.json();
        if (res.success) {
          const req = allRequests.find(r => String(r.id) === String(requestId));
          if (req) {
            req.status = 'approved';
            req.additional_words = allocatedWords;
            req.price_paid = pricePaid;
            req.confirmed_start_date = startDate;
            req.confirmed_end_date = endDate;
          }

          if (res.subscription) {
            allSubscriptions.unshift(res.subscription);
          }

          showToast("Demande IA validée avec succès ! +" + allocatedWords.toLocaleString('fr-FR') + " crédits IA alloués.");
          updateDemandesIaTabCounts();
          renderDemandesIaLeftList();

          if (res.subscription) {
            setDemandesIaTab('active');
            selectDemandeIaItem(res.subscription.id, 'subscription');
          } else {
            renderDemandeIaDetail(requestId, 'request');
          }
        } else {
          alert("Erreur: " + (res.error || "Impossible de valider la demande IA"));
        }
      } catch (err) {
        alert("Erreur réseau lors de la confirmation IA");
      }
    }

    async function rejectAiRequest(requestId) {
      const reason = prompt("Motif du refus de la demande de crédits IA :", "Paiement non confirmé ou reçu non valide");
      if (reason === null) return;

      try {
        const resp = await fetch('/api/ai-requests/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, reason })
        });
        const res = await resp.json();
        if (res.success) {
          const req = allRequests.find(r => String(r.id) === String(requestId));
          if (req) {
            req.status = 'rejected';
            req.admin_notes = reason;
          }
          showToast("Demande IA rejetée.");
          updateDemandesIaTabCounts();
          renderDemandesIaLeftList();
          autoSelectFirstDemandeIa();
        } else {
          alert("Erreur: " + (res.error || "Échec"));
        }
      } catch (err) {
        alert("Erreur réseau lors du rejet IA");
      }
    }

    async function saveUserQuota(userId) {
      const wTotal = parseFloat(document.getElementById('user-edit-w-total').value) || 0;
      const pTotal = parseFloat(document.getElementById('user-edit-p-total').value) || 0;

      try {
        const resp = await fetch('/api/storage/update-user-quota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            welcomeTotalMb: wTotal,
            welcomeR2Mb: Math.round(wTotal / 3),
            welcomeD1Mb: Math.round((wTotal * 2) / 3),
            paidTotalMb: pTotal,
            paidR2Mb: Math.round(pTotal / 2),
            paidD1Mb: Math.round(pTotal / 2),
            planName: pTotal > 0 ? 'payant' : 'gratuit'
          })
        });

        const data = await resp.json();
        if (data.success) {
          const item = allUsers.find(x => x.user.id === userId);
          if (item) {
            item.quotaConfig.welcomeTotalMb = wTotal;
            item.quotaConfig.welcomeR2Mb = Math.round(wTotal / 3);
            item.quotaConfig.welcomeD1Mb = Math.round((wTotal * 2) / 3);
            item.quotaConfig.paidTotalMb = pTotal;
            item.quotaConfig.paidR2Mb = Math.round(pTotal / 2);
            item.quotaConfig.paidD1Mb = Math.round(pTotal / 2);
            const totalMb = wTotal + pTotal;
            item.quotaConfig.totalAllowedMb = totalMb;
            item.quotaConfig.totalAllowedFormatted = totalMb >= 1024 ? (totalMb / 1024).toFixed(2) + ' Go' : totalMb.toFixed(0) + ' Mo';
            item.quotaConfig.totalAllowedBytes = totalMb * 1024 * 1024;
            item.quotaConfig.planName = pTotal > 0 ? 'payant' : 'gratuit';
            item.storage.usagePercentage = item.quotaConfig.totalAllowedBytes > 0 
              ? Math.min(100, parseFloat(((item.storage.totalBytes / item.quotaConfig.totalAllowedBytes) * 100).toFixed(2)))
              : 0;
            if (item.storage.net) item.storage.net.usagePercentage = item.storage.usagePercentage;
          }
          showToast("Stockage mis à jour (" + (wTotal + pTotal) + " Mo total) !");
          renderDemandesUsersList();
          renderDemandeRightDetails(userId);
          if (currentView === 'users') {
            renderUsersLeftList();
            renderUserRightDetails(userId);
          }
        } else {
          alert('Erreur: ' + (data.error || 'Échec de sauvegarde'));
        }
      } catch (err) {
        alert('Erreur réseau lors de la mise à jour');
      }
    }

    async function saveGlobalWelcomeConfig() {
      const defTotal = parseFloat(document.getElementById('global-cfg-total').value) || 30;

      try {
        const resp = await fetch('/api/storage/update-global-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            defaultWelcomeTotalMb: defTotal,
            defaultWelcomeR2Mb: Math.round(defTotal / 3),
            defaultWelcomeD1Mb: Math.round((defTotal * 2) / 3)
          })
        });

        const data = await resp.json();
        if (data.success) {
          globalConfig.default_welcome_total_mb = defTotal;
          globalConfig.default_welcome_r2_mb = Math.round(defTotal / 3);
          globalConfig.default_welcome_d1_mb = Math.round((defTotal * 2) / 3);
          showToast("Stockage global de bienvenue enregistré (" + defTotal + " Mo total partagé) !");
        } else {
          alert('Erreur: ' + (data.error || 'Échec'));
        }
      } catch (e) {
        alert('Erreur réseau');
      }
    }

    async function applyWelcomeStorageToAllUsers() {
      const input = document.getElementById('users-welcome-input');
      const val = parseFloat(input ? input.value : '30');
      if (isNaN(val) || val < 0) {
        alert("Veuillez saisir un quota valide en Mo.");
        return;
      }

      if (!confirm("Voulez-vous vraiment définir le stockage de bienvenue à " + val + " Mo et l'appliquer IMMÉDIATEMENT à TOUS les utilisateurs existants et futurs dans la base de données ?")) {
        return;
      }

      try {
        const resp = await fetch('/api/storage/update-welcome-and-apply-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ welcomeTotalMb: val })
        });

        const data = await resp.json();
        if (data.success) {
          globalConfig.default_welcome_total_mb = val;
          globalConfig.default_welcome_r2_mb = Math.round(val / 3);
          globalConfig.default_welcome_d1_mb = Math.round((val * 2) / 3);

          const badge = document.getElementById('current-welcome-badge');
          if (badge) badge.textContent = val + ' Mo';

          const cfgTotalInput = document.getElementById('global-cfg-total');
          if (cfgTotalInput) cfgTotalInput.value = val;

          // Mise à jour de tous les utilisateurs dans la mémoire
          allUsers.forEach(item => {
            item.quotaConfig.welcomeTotalMb = val;
            item.quotaConfig.welcomeR2Mb = Math.round(val / 3);
            item.quotaConfig.welcomeD1Mb = Math.round((val * 2) / 3);
            const totalMb = val + item.quotaConfig.paidTotalMb;
            item.quotaConfig.totalAllowedMb = totalMb;
            item.quotaConfig.totalAllowedFormatted = totalMb >= 1024 
              ? (totalMb / 1024).toFixed(2) + ' Go' 
              : totalMb.toFixed(0) + ' Mo';
            item.quotaConfig.totalAllowedBytes = totalMb * 1024 * 1024;
            if (item.quotaConfig.totalAllowedBytes > 0) {
              item.storage.usagePercentage = parseFloat(((item.storage.totalBytes / item.quotaConfig.totalAllowedBytes) * 100).toFixed(2));
              if (item.storage.net) item.storage.net.usagePercentage = item.storage.usagePercentage;
            }
          });

          showToast("🎉 Stockage de bienvenue mis à jour (" + val + " Mo) et appliqué à TOUS les utilisateurs !");
          renderUsersLeftList(document.getElementById('users-search-left')?.value || '');
          if (selectedUserId) renderUserRightDetails(selectedUserId);
          if (typeof renderDemandesUsersList === 'function') renderDemandesUsersList();
        } else {
          alert('Erreur: ' + (data.error || 'Échec de la mise à jour'));
        }
      } catch (err) {
        alert('Erreur réseau lors de la mise à jour globale');
      }
    }

    function renderSimpleMessagesUsersList() {
      const container = document.getElementById('messages-users-left-list');
      container.innerHTML = allUsers.map(item => {
        const u = item.user;
        return \`
          <div class="p-2.5 hover:bg-slate-800/40 flex items-center justify-between">
            <div class="truncate">
              <div class="font-bold text-white text-xs truncate">\${u.name}</div>
              <div class="text-[10px] text-slate-400 truncate">📞 \${u.phone} • \${u.level}</div>
            </div>
            <span class="text-[10px] font-mono \${u.isOnline ? 'text-emerald-400' : 'text-slate-500'}">\${u.isOnline ? '🟢 En ligne' : '⚫ Hors ligne'}</span>
          </div>
        \`;
      }).join('');
    }

    async function toggleUserOnlineStatus(userId, currentIsOnline) {
      const setOnline = !currentIsOnline;
      try {
        const resp = await fetch('/api/users/toggle-online', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, isOnline: setOnline })
        });
        const data = await resp.json();
        if (data.success) {
          const item = allUsers.find(x => x.user.id === userId);
          if (item) {
            item.user.isOnline = setOnline;
            item.user.lastSeenText = setOnline ? 'En ligne maintenant' : 'Hors ligne (mis à jour)';
          }
          showToast(setOnline ? '✅ Utilisateur marqué En ligne' : '⚫ Utilisateur marqué Hors ligne');
          renderUsersLeftList(document.getElementById('users-search-left')?.value || '');
          if (selectedUserId === userId) renderUserRightDetails(userId);
          if (typeof selectedDemandeUserId !== 'undefined' && selectedDemandeUserId === userId) renderDemandeRightDetails(userId);
          if (typeof renderDemandesUsersList === 'function') renderDemandesUsersList();
          if (typeof renderSimpleMessagesUsersList === 'function') renderSimpleMessagesUsersList();
        } else {
          alert('Erreur: ' + (data.error || 'Échec'));
        }
      } catch(e) {
        alert('Erreur réseau lors du changement de statut');
      }
    }

    let currentEditFieldId = null;
    let currentEditCol = null;
    let currentEditLabel = null;
    let currentEditType = 'text';

    function openFieldEditModal(fieldId, fieldLabel, colName, inputType, hint) {
      currentEditFieldId = fieldId;
      currentEditCol = colName;
      currentEditLabel = fieldLabel;
      currentEditType = inputType || 'text';

      const modal = document.getElementById('field-edit-modal');
      const titleEl = document.getElementById('field-edit-modal-title');
      const labelEl = document.getElementById('field-edit-modal-label');
      const hintEl = document.getElementById('field-edit-modal-hint');
      const container = document.getElementById('field-edit-modal-input-container');
      const errorEl = document.getElementById('field-edit-modal-error');

      if (!modal || !container) return;

      if (errorEl) {
        errorEl.classList.add('hidden');
        errorEl.textContent = '';
      }

      if (titleEl) titleEl.textContent = fieldLabel;
      if (labelEl) labelEl.textContent = fieldLabel + ' :';
      if (hintEl) hintEl.textContent = hint || 'La modification sera immédiatement enregistrée de manière individuelle.';

      const targetField = document.getElementById(fieldId);
      const currentVal = targetField ? targetField.value : '';

      if (inputType === 'textarea') {
        const safeVal = currentVal.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        container.innerHTML = '<textarea id="field-edit-modal-input" rows="4" class="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-700 focus:outline-none focus:border-orange-500 transition resize-y font-sans leading-relaxed" placeholder="Entrez ' + fieldLabel + '...">' + safeVal + '</textarea>';
      } else {
        const safeVal = currentVal.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const isMono = inputType === 'tel' || colName.includes('number') || colName.includes('phone');
        const fontCls = isMono ? 'font-mono font-bold text-sm' : 'font-sans';
        container.innerHTML = '<input type="' + (inputType || 'text') + '" id="field-edit-modal-input" value="' + safeVal + '" class="w-full bg-slate-900 text-white text-xs rounded-xl px-3.5 py-2.5 border border-slate-700 focus:outline-none focus:border-orange-500 transition ' + fontCls + '" placeholder="Entrez ' + fieldLabel + '..." />';
      }

      modal.classList.remove('hidden');
      modal.style.display = 'flex';

      setTimeout(() => {
        const inputEl = document.getElementById('field-edit-modal-input');
        if (inputEl) {
          inputEl.focus();
          if (inputEl.select) inputEl.select();
        }
      }, 50);
    }
    window.openFieldEditModal = openFieldEditModal;

    function closeFieldEditModal(event) {
      if (event && event.target && event.target.id !== 'field-edit-modal') return;
      const modal = document.getElementById('field-edit-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
    }
    window.closeFieldEditModal = closeFieldEditModal;

    async function saveFieldEditModal() {
      const inputEl = document.getElementById('field-edit-modal-input');
      if (!inputEl) return;
      const newVal = inputEl.value;
      const fieldId = currentEditFieldId;
      const colName = currentEditCol;
      const fieldLabel = currentEditLabel;

      // 1. Fermer le menu/modale IMMÉDIATEMENT à l'appui sur Enregistrer
      closeFieldEditModal();

      // 2. Mettre à jour visuellement le champ dans la page
      const targetField = document.getElementById(fieldId);
      const prevVal = targetField ? targetField.value : '';
      if (targetField) {
        targetField.value = newVal;
      }

      // 3. Un rond apparaît au bord du champ et tourne pendant l'enregistrement en BDD
      const spinnerContainer = document.getElementById('spinner-' + fieldId);
      if (spinnerContainer) {
        spinnerContainer.innerHTML = '<div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400">' +
          '<svg class="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
          '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
          '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>' +
          '</svg>' +
          '<span class="text-[9px] font-bold">Enregistrement...</span>' +
          '</div>';
      }

      // 4. Envoi individuel à Cloudflare D1
      try {
        const resp = await fetch('/api/company-profile/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: colName, value: newVal })
        });
        const res = await resp.json();
        if (res && res.success) {
          if (typeof companyProfileGlobal === 'object' && companyProfileGlobal) {
            companyProfileGlobal[colName] = newVal;
          }
          if (spinnerContainer) {
            spinnerContainer.innerHTML = '<div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">' +
              '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>' +
              '</svg>' +
              '<span class="text-[9px] font-bold">Enregistré</span>' +
              '</div>';
            setTimeout(() => {
              spinnerContainer.innerHTML = '<span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>';
            }, 2500);
          }
          showToast("✓ " + (fieldLabel || 'Champ') + " enregistré avec succès dans la base de données !");
        } else {
          throw new Error(res?.error || 'Échec de la sauvegarde');
        }
      } catch (err) {
        console.error('Erreur sauvegarde champ:', err);
        if (targetField) {
          targetField.value = prevVal;
        }
        if (spinnerContainer) {
          spinnerContainer.innerHTML = '<div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400">' +
            '<span class="text-xs">⚠️</span>' +
            '<span class="text-[9px] font-bold">Erreur</span>' +
            '</div>';
          setTimeout(() => {
            spinnerContainer.innerHTML = '<span class="text-slate-500 group-hover:text-orange-400 transition text-xs">✏️</span>';
          }, 4000);
        }
        showToast("⚠️ Erreur lors de l'enregistrement : " + err.message);
      }
    }
    window.saveFieldEditModal = saveFieldEditModal;

    async function togglePaymentSetting(field, isChecked, elementId) {
      const val = isChecked ? 1 : 0;
      const spinner = document.getElementById('spinner-' + elementId);
      const label = document.getElementById('status-label-' + elementId);
      if (spinner) {
        spinner.innerHTML = '<span class="inline-block animate-spin text-orange-400 text-xs">⏳</span>';
      }
      try {
        const resp = await fetch('/api/company-profile/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field, value: val })
        });
        const res = await resp.json();
        if (res && res.success) {
          if (typeof companyProfileGlobal === 'object' && companyProfileGlobal) {
            companyProfileGlobal[field] = val;
          }
          if (label) {
            label.textContent = isChecked ? 'Actif' : 'Inactif';
            const colorCls = elementId.includes('wave') ? 'text-blue-400' : elementId.includes('orange') ? 'text-orange-400' : elementId.includes('mtn') ? 'text-yellow-400' : 'text-emerald-400';
            label.className = 'ml-1.5 text-[10px] font-bold ' + (isChecked ? colorCls : 'text-slate-500');
          }
          if (spinner) {
            spinner.innerHTML = '<span class="text-emerald-400 font-bold text-xs">✓</span>';
            setTimeout(() => { if (spinner) spinner.innerHTML = ''; }, 2000);
          }
          showToast('✓ Paramètre mis à jour dans la base de données !');
        } else {
          throw new Error(res?.error || 'Échec de la mise à jour');
        }
      } catch (err) {
        console.error('Erreur toggle:', err);
        const input = document.getElementById(elementId);
        if (input) input.checked = !isChecked;
        if (spinner) {
          spinner.innerHTML = '<span class="text-rose-400 font-bold text-xs">⚠️</span>';
          setTimeout(() => { if (spinner) spinner.innerHTML = ''; }, 3000);
        }
        showToast('⚠️ Erreur: ' + err.message);
      }
    }
    window.togglePaymentSetting = togglePaymentSetting;

    async function uploadPaymentImage(network, event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      
      const spinner = document.getElementById('spinner-pro-' + network + '-image');
      if (spinner) {
        spinner.innerHTML = '<span class="inline-block animate-spin text-orange-400 text-xs">⏳ Envoi R2...</span>';
      }

      const reader = new FileReader();
      reader.onload = async function(e) {
        const dataUrl = e.target.result;
        const ext = file.name.split('.').pop() || 'png';
        try {
          const resp = await fetch('/api/company-profile/upload-payment-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ network, image: dataUrl, ext })
          });
          const res = await resp.json();
          if (res && res.success) {
            if (typeof companyProfileGlobal === 'object' && companyProfileGlobal) {
              companyProfileGlobal[network + '_image_url'] = res.url;
            }
            renderPaymentImageContainer(network, res.url);
            if (spinner) {
              spinner.innerHTML = '<span class="text-emerald-400 font-bold text-xs">✓ Enregistré R2</span>';
              setTimeout(() => { if (spinner) spinner.innerHTML = ''; }, 2500);
            }
            showToast('✓ Carte / QR ' + network.toUpperCase() + ' sauvegardé avec succès dans Cloudflare R2 !');
          } else {
            throw new Error(res?.error || "Échec de l'upload");
          }
        } catch (err) {
          console.error('Erreur upload:', err);
          if (spinner) {
            spinner.innerHTML = '<span class="text-rose-400 font-bold text-xs">⚠️ Erreur</span>';
            setTimeout(() => { if (spinner) spinner.innerHTML = ''; }, 3500);
          }
          showToast('⚠️ Erreur upload : ' + err.message);
        }
      };
      reader.readAsDataURL(file);
    }
    window.uploadPaymentImage = uploadPaymentImage;

    async function deletePaymentImage(network) {
      if (!confirm("Voulez-vous supprimer cette carte commerçant / QR code pour " + network.toUpperCase() + " ?")) return;

      const spinner = document.getElementById('spinner-pro-' + network + '-image');
      if (spinner) {
        spinner.innerHTML = '<span class="inline-block animate-spin text-rose-400 text-xs">⏳ Suppression...</span>';
      }

      try {
        const resp = await fetch('/api/company-profile/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: network + '_image_url', value: '' })
        });
        const res = await resp.json();
        if (res && res.success) {
          if (typeof companyProfileGlobal === 'object' && companyProfileGlobal) {
            companyProfileGlobal[network + '_image_url'] = '';
          }
          renderPaymentImageContainer(network, '');
          if (spinner) {
            spinner.innerHTML = '<span class="text-emerald-400 font-bold text-xs">✓ Supprimé</span>';
            setTimeout(() => { if (spinner) spinner.innerHTML = ''; }, 2000);
          }
          showToast('✓ Carte supprimée avec succès.');
        } else {
          throw new Error(res?.error || 'Échec suppression');
        }
      } catch (err) {
        console.error('Erreur suppression:', err);
        if (spinner) {
          spinner.innerHTML = '<span class="text-rose-400 font-bold text-xs">⚠️ Erreur</span>';
          setTimeout(() => { if (spinner) spinner.innerHTML = ''; }, 3000);
        }
        showToast('⚠️ Erreur: ' + err.message);
      }
    }
    window.deletePaymentImage = deletePaymentImage;

    function renderPaymentImageContainer(network, imageUrl) {
      const container = document.getElementById("container-img-" + network);
      if (!container) return;
      const netColor = network === "wave" ? "blue" : network === "orange" ? "orange" : network === "mtn" ? "yellow" : "emerald";
      container.innerHTML = "";
      if (imageUrl) {
        const wrap = document.createElement("div");
        wrap.className = "relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900";
        
        const img = document.createElement("img");
        img.src = imageUrl;
        img.alt = "Carte " + network;
        img.className = "w-full h-24 object-contain bg-slate-950 p-1 cursor-pointer";
        img.onclick = function() { openImageZoomModal(imageUrl, "Carte Commerçant / QR " + network.toUpperCase()); };
        
        const overlay = document.createElement("div");
        overlay.className = "absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2";
        
        const btnChange = document.createElement("button");
        btnChange.type = "button";
        btnChange.className = "px-2 py-1 bg-" + netColor + "-600 hover:bg-" + netColor + "-500 text-white rounded text-[10px] font-bold shadow cursor-pointer";
        btnChange.textContent = "Changer";
        btnChange.onclick = function() {
          const fi = document.getElementById("file-pro-" + network);
          if (fi) fi.click();
        };
        
        const btnDelete = document.createElement("button");
        btnDelete.type = "button";
        btnDelete.className = "px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold shadow cursor-pointer";
        btnDelete.textContent = "Supprimer";
        btnDelete.onclick = function() { deletePaymentImage(network); };
        
        overlay.appendChild(btnChange);
        overlay.appendChild(btnDelete);
        wrap.appendChild(img);
        wrap.appendChild(overlay);
        container.appendChild(wrap);
      } else {
        const btnAdd = document.createElement("button");
        btnAdd.type = "button";
        btnAdd.className = "w-full py-2.5 px-2 border-2 border-dashed border-slate-700 hover:border-" + netColor + "-500/60 rounded-xl bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-" + netColor + "-300 flex flex-col items-center justify-center gap-1 transition cursor-pointer text-center";
        btnAdd.innerHTML = '<span class="text-base">📷</span><span class="text-[10px] font-bold">+ Ajouter Carte / QR</span><span class="text-[8px] text-slate-500">PNG, JPG, WEBP (R2)</span>';
        btnAdd.onclick = function() {
          const fi = document.getElementById("file-pro-" + network);
          if (fi) fi.click();
        };
        container.appendChild(btnAdd);
      }
    }
    window.renderPaymentImageContainer = renderPaymentImageContainer;

    function openImageZoomModal(url, caption) {
      const modal = document.getElementById('receipt-zoom-modal');
      const img = document.getElementById('receipt-zoom-img');
      const cap = document.getElementById('receipt-zoom-caption');
      const dl = document.getElementById('receipt-zoom-download');
      if (img) img.src = url;
      if (cap) cap.textContent = caption || 'Carte Commerçant / QR Code (R2)';
      if (dl) dl.href = url;
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
    }
    window.openImageZoomModal = openImageZoomModal;

    async function loadCompanyProfileClient() {
      const setField = (id, val, fallback) => {
        const el = document.getElementById(id);
        if (el) {
          const v = (val !== null && val !== undefined && String(val).trim() !== '') ? val : (fallback || '');
          el.value = v;
        }
      };
      const setCheck = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.checked = (val !== 0 && val !== false);
      };
      const setLabel = (id, val, activeColor) => {
        const el = document.getElementById(id);
        if (el) {
          const isAct = (val !== 0 && val !== false);
          el.textContent = isAct ? 'Actif' : 'Inactif';
          el.className = 'ml-1.5 text-[10px] font-bold ' + (isAct ? (activeColor || 'text-blue-400') : 'text-slate-500');
        }
      };

      const syncProfileData = (p) => {
        setField("pro-company-name", p.company_name, "DKD Technologies");
        setField("pro-location", p.location, "Abidjan, Côte d'Ivoire");
        setField("pro-activity", p.activity, "Technologies & Éducation Numérique");
        setField("pro-address", p.address, "Abidjan, Côte d'Ivoire");
        setField('pro-website', p.website, 'https://studycloud.dkd-technologies.com');
        setField('pro-email', p.email, 'contact@dkd-technologies.com');
        setField('pro-phone-contact', p.phone_contact, '+225 0101007978');
        setField('pro-phone-whatsapp', p.phone_whatsapp, '+225 0101007978');
        setField('pro-phone-secondary', p.phone_contact_secondary, '');
        setField("pro-about-text", p.about_text, "Plateforme d'apprentissage et de gestion documentaire intelligente pour étudiants et professionnels.");
        
        setField('pro-wave-number', p.wave_number, '+225 07 00 00 00 00');
        setField('pro-wave-name', p.wave_name, 'StudyCloud CI');
        setCheck('pro-wave-enabled', p.wave_enabled);
        setLabel('status-label-pro-wave-enabled', p.wave_enabled, 'text-blue-400');
        setCheck('pro-wave-show-number', p.wave_show_number);
        setCheck('pro-wave-show-image', p.wave_show_image);
        renderPaymentImageContainer('wave', p.wave_image_url);

        setField('pro-orange-number', p.orange_number, '+225 07 00 00 00 00');
        setField("pro-orange-name", p.orange_name, "Orange Money Côte d'Ivoire");
        setCheck('pro-orange-enabled', p.orange_enabled);
        setLabel('status-label-pro-orange-enabled', p.orange_enabled, 'text-orange-400');
        setCheck('pro-orange-show-number', p.orange_show_number);
        setCheck('pro-orange-show-image', p.orange_show_image);
        renderPaymentImageContainer('orange', p.orange_image_url);

        setField('pro-mtn-number', p.mtn_number, '+225 05 00 00 00 00');
        setField('pro-mtn-name', p.mtn_name, 'MTN Mobile Money CI');
        setCheck('pro-mtn-enabled', p.mtn_enabled);
        setLabel('status-label-pro-mtn-enabled', p.mtn_enabled, 'text-yellow-400');
        setCheck('pro-mtn-show-number', p.mtn_show_number);
        setCheck('pro-mtn-show-image', p.mtn_show_image);
        renderPaymentImageContainer('mtn', p.mtn_image_url);

        setField('pro-moov-number', p.moov_number, '+225 01 00 00 00 00');
        setField('pro-moov-name', p.moov_name, "Moov Money Côte d'Ivoire");
        setCheck('pro-moov-enabled', p.moov_enabled);
        setLabel('status-label-pro-moov-enabled', p.moov_enabled, 'text-emerald-400');
        setCheck('pro-moov-show-number', p.moov_show_number);
        setCheck('pro-moov-show-image', p.moov_show_image);
        renderPaymentImageContainer('moov', p.moov_image_url);

        setField("pro-payment-instructions", p.payment_instructions, "Transférez le montant exact sur l'un de nos numéros officiels ci-dessous, puis importez une capture claire de votre reçu affichant la date et le numéro de transaction.");
      };

      if (typeof companyProfileGlobal === 'object' && companyProfileGlobal) {
        syncProfileData(companyProfileGlobal);
      }

      try {
        const resp = await fetch('/api/company-profile');
        if (!resp.ok) return;
        const res = await resp.json();
        if (res && res.profile) {
          companyProfileGlobal = res.profile;
          syncProfileData(res.profile);
        }
      } catch (err) {
        console.warn('Erreur chargement profil pro client:', err);
      }
    }

    function switchSubscriptionTab(tab) {
      currentSubPlanTab = tab === 'ai' ? 'ai' : 'storage';
      const btnStorage = document.getElementById('btn-subtab-storage');
      const btnAi = document.getElementById('btn-subtab-ai');
      if (btnStorage && btnAi) {
        if (currentSubPlanTab === 'storage') {
          btnStorage.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer bg-orange-600 text-white shadow';
          btnAi.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white';
        } else {
          btnAi.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer bg-orange-600 text-white shadow';
          btnStorage.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white';
        }
      }
      renderSubscriptionPlansCards(currentSubPlanTab);
    }
    window.switchSubscriptionTab = switchSubscriptionTab;

    function getCurrencySymbol(curr) {
      if (curr === 'USD') return '$';
      if (curr === 'EUR') return '€';
      if (curr === 'XOF') return 'FCFA';
      return curr;
    }

    function calculateConversions(price, primaryCurr) {
      const p = Number(price) || 0;
      let usd = 0;
      let xof = 0;
      let eur = 0;
      if (primaryCurr === 'USD') {
        usd = p;
        xof = Math.round(p * 650);
        eur = Math.round(p * 0.92 * 100) / 100;
      } else if (primaryCurr === 'XOF') {
        xof = p;
        usd = Math.round((p / 650) * 100) / 100;
        eur = Math.round((p / 655.957) * 100) / 100;
      } else if (primaryCurr === 'EUR') {
        eur = p;
        usd = Math.round((p / 0.92) * 100) / 100;
        xof = Math.round(p * 655.957);
      }
      return { USD: usd, XOF: xof, EUR: eur };
    }

    function setSubscriptionPricingModel(model) {
      const hiddenInput = document.getElementById('sub-plan-pricing-model');
      if (hiddenInput) hiddenInput.value = model;

      const btnSub = document.getElementById('sub-model-btn-subscription');
      const btnOne = document.getElementById('sub-model-btn-onetime');
      const priceLabel = document.getElementById('sub-plan-price-label');
      const leftTitle = document.getElementById('sub-preview-left-title');
      const yearlyContainer = document.getElementById('sub-preview-yearly-container');
      const recapBox = document.getElementById('sub-pricing-recap-box');

      const isOneTime = model === 'one_time' || model === 'pack';

      if (btnSub && btnOne) {
        if (isOneTime) {
          btnOne.className = "p-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-950/50 text-cyan-200 text-left transition-all cursor-pointer flex flex-col justify-between shadow-md shadow-cyan-950/40";
          btnSub.className = "p-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-slate-400 text-left transition-all cursor-pointer flex flex-col justify-between hover:border-slate-600";
        } else {
          btnSub.className = "p-2.5 rounded-xl border-2 border-orange-500 bg-orange-950/50 text-orange-200 text-left transition-all cursor-pointer flex flex-col justify-between shadow-md shadow-orange-950/40";
          btnOne.className = "p-2.5 rounded-xl border border-slate-700 bg-slate-900/60 text-slate-400 text-left transition-all cursor-pointer flex flex-col justify-between hover:border-slate-600";
        }
      }

      if (priceLabel) {
        priceLabel.textContent = isOneTime ? "Prix du pack de crédits (Vente unique) *" : "Prix de base mensuel *";
      }
      if (leftTitle) {
        leftTitle.textContent = isOneTime ? "Prix d'achat direct" : "Tarif par Mois";
      }
      if (yearlyContainer) {
        if (isOneTime) {
          yearlyContainer.classList.add('hidden');
          if (recapBox) recapBox.className = "p-3.5 bg-gradient-to-r from-slate-900 to-slate-950 rounded-xl border border-slate-700/80";
        } else {
          yearlyContainer.classList.remove('hidden');
          if (recapBox) recapBox.className = "p-3.5 bg-gradient-to-r from-slate-900 to-slate-950 rounded-xl border border-slate-700/80 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center";
        }
      }

      updateSubscriptionPricingCalculations();
    }
    window.setSubscriptionPricingModel = setSubscriptionPricingModel;

    async function toggleSubscriptionPlanPricingModel(planId, newModel) {
      const plan = (allAiPlans || []).find(p => p.id === planId);
      if (!plan) return;
      plan.pricing_model = newModel;
      try {
        await safeSubPlansApi('/api/subscription-plans/save', { category: 'ai', plan });
        renderSubscriptionPlansCards('ai');
        showToast("✓ Modèle mis à jour : " + (newModel === 'one_time' ? "Vente unique / Pack" : "Abonnement récurrent"));
      } catch (e) {
        showToast("⚠️ Erreur lors du changement de modèle");
      }
    }
    window.toggleSubscriptionPlanPricingModel = toggleSubscriptionPlanPricingModel;

    function updateSubscriptionPricingCalculations() {
      const priceInput = document.getElementById('sub-plan-price');
      const currSelect = document.getElementById('sub-plan-primary-curr');
      const discountInput = document.getElementById('sub-plan-discount');
      const currXof = document.getElementById('sub-curr-xof');
      const currUsd = document.getElementById('sub-curr-usd');
      const currEur = document.getElementById('sub-curr-eur');

      const price = Number(priceInput ? priceInput.value : 10) || 0;
      const primaryCurr = currSelect ? currSelect.value : 'USD';
      const discountPct = Number(discountInput ? discountInput.value : 10) || 0;

      const conv = calculateConversions(price, primaryCurr);

      // Aperçu tarif direct ou mensuel
      const isOneTime = document.getElementById('sub-plan-pricing-model')?.value === 'one_time';
      const monthlyPrimaryEl = document.getElementById('sub-preview-monthly-primary');
      const monthlyConvEl = document.getElementById('sub-preview-monthly-conversions');
      if (monthlyPrimaryEl) {
        monthlyPrimaryEl.textContent = getCurrencySymbol(primaryCurr) + ' ' + (primaryCurr === 'XOF' ? conv.XOF.toLocaleString() : conv[primaryCurr]) + (isOneTime ? '' : ' / mois');
      }
      if (monthlyConvEl) {
        const parts = [];
        if (currXof && currXof.checked && primaryCurr !== 'XOF') parts.push('≈ ' + conv.XOF.toLocaleString() + ' FCFA');
        if (currUsd && currUsd.checked && primaryCurr !== 'USD') parts.push('≈ ' + conv.USD + ' $');
        if (currEur && currEur.checked && primaryCurr !== 'EUR') parts.push('≈ ' + conv.EUR + ' €');
        monthlyConvEl.textContent = parts.length > 0 ? parts.join(' • ') : 'Aucune conversion secondaire cochée';
      }

      // Aperçu annuel (12 mois avec réduction)
      const yearlyPrice = Math.round(price * 12 * (1 - (discountPct / 100)) * 100) / 100;
      const yearlyConv = calculateConversions(yearlyPrice, primaryCurr);

      const yearlyPrimaryEl = document.getElementById('sub-preview-yearly-primary');
      const yearlyConvEl = document.getElementById('sub-preview-yearly-conversions');
      if (yearlyPrimaryEl) {
        yearlyPrimaryEl.textContent = getCurrencySymbol(primaryCurr) + ' ' + (primaryCurr === 'XOF' ? yearlyConv.XOF.toLocaleString() : yearlyConv[primaryCurr]) + ' / an';
      }
      if (yearlyConvEl) {
        const yearlyParts = [];
        if (currXof && currXof.checked && primaryCurr !== 'XOF') yearlyParts.push('≈ ' + yearlyConv.XOF.toLocaleString() + ' FCFA');
        if (currUsd && currUsd.checked && primaryCurr !== 'USD') yearlyParts.push('≈ ' + yearlyConv.USD + ' $');
        if (currEur && currEur.checked && primaryCurr !== 'EUR') yearlyParts.push('≈ ' + yearlyConv.EUR + ' €');
        yearlyConvEl.textContent = yearlyParts.length > 0 ? yearlyParts.join(' • ') : 'Aucune conversion secondaire';
      }
    }
    window.updateSubscriptionPricingCalculations = updateSubscriptionPricingCalculations;

    function renderSubscriptionPlansCards(category) {
      const targetCat = category === 'ai' ? 'ai' : 'storage';
      const plans = targetCat === 'ai' ? (allAiPlans || []) : (allStoragePlans || []);

      // Mettre à jour les compteurs sur les onglets
      const bStorage = document.getElementById('badge-count-storage-plans');
      const bAi = document.getElementById('badge-count-ai-plans');
      if (bStorage) bStorage.textContent = (allStoragePlans || []).length;
      if (bAi) bAi.textContent = (allAiPlans || []).length;

      const container = document.getElementById('sub-plans-cards-grid');
      if (!container) return;
      container.innerHTML = '';

      if (plans.length === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.className = "col-span-full py-8 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800";
        emptyDiv.innerHTML = '<div class="text-3xl mb-2">📦</div>' +
          '<p class="font-bold text-sm text-slate-300">Aucune carte d&apos;abonnement créée pour le moment</p>' +
          '<p class="text-xs text-slate-500 mt-1">Cliquez sur « + Créer une carte d&apos;abonnement » ci-dessus pour configurer un forfait.</p>';
        container.appendChild(emptyDiv);
        return;
      }

      plans.forEach(function(plan) {
        const card = document.createElement('div');
        const isActive = plan.is_active !== 0;
        const isAuto = plan.is_auto_billing === 1;
        const hasBadge = !!(plan.badge && plan.badge.trim());
        const isOneTime = targetCat === 'ai' && (plan.pricing_model === 'one_time' || plan.pricing_model === 'pack');

        card.className = 'relative flex flex-col justify-between rounded-2xl p-5 border transition-all duration-200 ' + 
          (isActive 
            ? (hasBadge ? 'border-amber-500/60 bg-[#111927] shadow-amber-950/20' : 'border-slate-800 bg-[#0d1424]') 
            : 'border-slate-800/60 bg-slate-950/70 opacity-65') + 
          ' shadow-xl';

        // En-tête de la carte
        const headerDiv = document.createElement('div');
        headerDiv.className = 'space-y-3';

        // =========================================================================
        // DEUX CASES À COCHER : VISIBILITÉ DANS L'APP & BADGE PERSONNALISÉ
        // =========================================================================
        const controlsBox = document.createElement('div');
        controlsBox.className = 'p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-2.5 mb-2 shadow-inner';

        // --- CASE 1 : Visibilité dans l'application ---
        const cb1Wrap = document.createElement('div');
        cb1Wrap.className = 'flex items-center justify-between gap-2';

        const cb1Label = document.createElement('label');
        cb1Label.className = 'flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none';

        const cb1Input = document.createElement('input');
        cb1Input.type = 'checkbox';
        cb1Input.checked = isActive;
        cb1Input.className = 'w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 focus:ring-emerald-500 cursor-pointer';
        cb1Input.onchange = function() {
          toggleSubscriptionPlanActive(targetCat, plan.id, cb1Input.checked);
        };

        const cb1Text = document.createElement('span');
        cb1Text.textContent = "Visible dans l'application";
        cb1Label.appendChild(cb1Input);
        cb1Label.appendChild(cb1Text);

        const cb1Badge = document.createElement('span');
        cb1Badge.className = 'px-2 py-0.5 rounded-md text-[10px] font-black uppercase ' + 
          (isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700');
        cb1Badge.textContent = isActive ? "✓ Actif" : "Masqué";

        cb1Wrap.appendChild(cb1Label);
        cb1Wrap.appendChild(cb1Badge);
        controlsBox.appendChild(cb1Wrap);

        // --- CASE 2 : Badge personnalisé (Populaire / Recommandé) ---
        const cb2Wrap = document.createElement('div');
        cb2Wrap.className = 'pt-2 border-t border-slate-800 space-y-2';

        const cb2Header = document.createElement('div');
        cb2Header.className = 'flex items-center justify-between gap-2';

        const cb2Label = document.createElement('label');
        cb2Label.className = 'flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none';

        const cb2Input = document.createElement('input');
        cb2Input.type = 'checkbox';
        cb2Input.checked = hasBadge;
        cb2Input.className = 'w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700 focus:ring-amber-500 cursor-pointer';

        const cb2Text = document.createElement('span');
        cb2Text.textContent = "Badge mis en avant";
        cb2Label.appendChild(cb2Input);
        cb2Label.appendChild(cb2Text);

        const cb2Badge = document.createElement('span');
        cb2Badge.className = 'px-2 py-0.5 rounded-md text-[10px] font-black uppercase ' + 
          (hasBadge ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400 border border-slate-700');
        cb2Badge.textContent = hasBadge ? (plan.badge || 'POPULAIRE') : "Aucun";

        cb2Header.appendChild(cb2Label);
        cb2Header.appendChild(cb2Badge);
        cb2Wrap.appendChild(cb2Header);

        // Champ texte qui apparaît à côté/dessous quand la case 2 est cochée
        const badgeInputRow = document.createElement('div');
        badgeInputRow.className = (hasBadge ? 'flex' : 'hidden') + ' items-center gap-1.5 pt-1';

        const badgeTextInput = document.createElement('input');
        badgeTextInput.type = 'text';
        badgeTextInput.value = plan.badge || 'POPULAIRE';
        badgeTextInput.placeholder = 'Ex: POPULAIRE, RECOMMANDÉ...';
        badgeTextInput.className = 'flex-1 bg-slate-950 border border-amber-500/60 rounded-lg px-2.5 py-1 text-white font-extrabold text-xs uppercase focus:border-amber-400 outline-none';

        const badgeSaveBtn = document.createElement('button');
        badgeSaveBtn.type = 'button';
        badgeSaveBtn.className = 'px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs transition cursor-pointer shadow-md shrink-0';
        badgeSaveBtn.textContent = 'Enregistrer';

        badgeSaveBtn.onclick = function() {
          const val = badgeTextInput.value.trim() || 'POPULAIRE';
          saveSubscriptionPlanBadge(targetCat, plan.id, val);
        };
        badgeTextInput.onkeydown = function(e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            badgeSaveBtn.click();
          }
        };

        cb2Input.onchange = function() {
          if (cb2Input.checked) {
            badgeInputRow.classList.remove('hidden');
            badgeInputRow.classList.add('flex');
            const initialVal = badgeTextInput.value.trim() || 'POPULAIRE';
            badgeTextInput.value = initialVal;
            saveSubscriptionPlanBadge(targetCat, plan.id, initialVal);
            badgeTextInput.focus();
          } else {
            badgeInputRow.classList.add('hidden');
            badgeInputRow.classList.remove('flex');
            saveSubscriptionPlanBadge(targetCat, plan.id, '');
          }
        };

        badgeInputRow.appendChild(badgeTextInput);
        badgeInputRow.appendChild(badgeSaveBtn);
        cb2Wrap.appendChild(badgeInputRow);
        controlsBox.appendChild(cb2Wrap);

        headerDiv.appendChild(controlsBox);

        // Ligne Titre & Badge
        const topRow = document.createElement('div');
        topRow.className = 'flex items-center justify-between gap-2';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'flex items-center gap-2 flex-wrap';

        const titleSpan = document.createElement('h5');
        titleSpan.className = 'text-lg font-black text-white';
        titleSpan.textContent = plan.name || 'Forfait';
        titleDiv.appendChild(titleSpan);

        if (hasBadge) {
          const badgeSpan = document.createElement('span');
          badgeSpan.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30';
          badgeSpan.textContent = plan.badge;
          titleDiv.appendChild(badgeSpan);
        }
        topRow.appendChild(titleDiv);
        headerDiv.appendChild(topRow);

        if (plan.description) {
          const descP = document.createElement('p');
          descP.className = 'text-xs text-slate-400 leading-relaxed';
          descP.textContent = plan.description;
          headerDiv.appendChild(descP);
        }

        // =========================================================================
        // PRIX, DEVISES SECONDAIRES & VRAI PRIX ANNUEL BARRÉ
        // =========================================================================
        const priceBox = document.createElement('div');
        priceBox.className = 'p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1';

        const priceRow = document.createElement('div');
        priceRow.className = 'flex items-baseline gap-1.5';

        const mainPrice = document.createElement('span');
        mainPrice.className = 'text-2xl font-black text-white font-mono';
        const primaryCurr = plan.primary_currency || 'USD';
        mainPrice.textContent = getCurrencySymbol(primaryCurr) + ' ' + (primaryCurr === 'XOF' ? Number(plan.price).toLocaleString() : plan.price);
        priceRow.appendChild(mainPrice);

        if (!isOneTime) {
          const perMonth = document.createElement('span');
          perMonth.className = 'text-xs text-slate-400 font-bold';
          perMonth.textContent = '/ mois';
          priceRow.appendChild(perMonth);
        } else {
          const oneTimeBadge = document.createElement('span');
          oneTimeBadge.className = 'text-[11px] text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60';
          oneTimeBadge.textContent = 'Paiement unique (Pack)';
          priceRow.appendChild(oneTimeBadge);
        }
        priceBox.appendChild(priceRow);

        // Devises secondaires mensuelles
        let convObj = {};
        try {
          convObj = typeof plan.currency_conversions === 'string' ? JSON.parse(plan.currency_conversions) : (plan.currency_conversions || {});
        } catch (e) {
          convObj = calculateConversions(plan.price, primaryCurr);
        }

        let currEnabled = ['USD', 'XOF', 'EUR'];
        try {
          if (typeof plan.currencies_enabled === 'string') currEnabled = JSON.parse(plan.currencies_enabled);
          else if (Array.isArray(plan.currencies_enabled)) currEnabled = plan.currencies_enabled;
        } catch (e) {}

        const convParts = [];
        if (currEnabled.includes('XOF') && primaryCurr !== 'XOF' && convObj.XOF) convParts.push('≈ ' + Number(convObj.XOF).toLocaleString() + ' FCFA');
        if (currEnabled.includes('USD') && primaryCurr !== 'USD' && convObj.USD) convParts.push('≈ ' + convObj.USD + ' $');
        if (currEnabled.includes('EUR') && primaryCurr !== 'EUR' && convObj.EUR) convParts.push('≈ ' + convObj.EUR + ' €');

        if (convParts.length > 0) {
          const secDiv = document.createElement('div');
          secDiv.className = 'text-[11px] font-semibold text-amber-400/90';
          secDiv.textContent = convParts.join(' • ');
          priceBox.appendChild(secDiv);
        }

        // VRAI PRIX ANNUEL BARRÉ & RÉDUCTION ANNUELLE
        const monthlyP = Number(plan.price) || 0;
        const yearlyP = Number(plan.yearly_price) || 0;
        const discPct = Number(plan.yearly_discount_pct) || 0;
        const fullYearly = monthlyP * 12;

        if (!isOneTime && (yearlyP > 0 || discPct > 0)) {
          const activeYearly = yearlyP > 0 ? yearlyP : Math.round(fullYearly * (1 - (discPct / 100)) * 100) / 100;
          const yrRow = document.createElement('div');
          yrRow.className = 'pt-2 mt-2 border-t border-slate-800 space-y-1';
          
          const yrTop = document.createElement('div');
          yrTop.className = 'flex items-center justify-between text-xs';
          yrTop.innerHTML = '<span class="text-slate-400 font-bold">Annuel (12 mois) :</span>' +
            '<div class="flex items-center gap-1.5">' +
              (fullYearly > activeYearly ? '<span class="line-through text-slate-500 font-mono text-xs">' + getCurrencySymbol(primaryCurr) + ' ' + (primaryCurr === 'XOF' ? fullYearly.toLocaleString() : fullYearly) + '</span>' : '') +
              '<span class="font-black text-emerald-400 font-mono text-sm">' + getCurrencySymbol(primaryCurr) + ' ' + (primaryCurr === 'XOF' ? activeYearly.toLocaleString() : activeYearly) + ' / an</span>' +
              (discPct > 0 ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-500/30">-' + discPct + '%</span>' : '') +
            '</div>';
          yrRow.appendChild(yrTop);

          // Conversions secondaires annuelles avec vrai prix barré
          const yrSecParts = [];
          const annualRatio = monthlyP > 0 ? (activeYearly / monthlyP) : (12 * (1 - (discPct / 100)));
          if (currEnabled.includes('XOF') && primaryCurr !== 'XOF' && convObj.XOF) {
            const fullSec = Math.round(convObj.XOF * 12);
            const discSec = Math.round(convObj.XOF * annualRatio);
            yrSecParts.push('≈ ' + (fullSec > discSec ? '<span class="line-through text-slate-500">' + fullSec.toLocaleString() + '</span> ' : '') + '<span class="text-amber-400 font-bold">' + discSec.toLocaleString() + ' FCFA</span>');
          }
          if (currEnabled.includes('USD') && primaryCurr !== 'USD' && convObj.USD) {
            const fullSec = Math.round(convObj.USD * 12 * 100) / 100;
            const discSec = Math.round(convObj.USD * annualRatio * 100) / 100;
            yrSecParts.push('≈ ' + (fullSec > discSec ? '<span class="line-through text-slate-500">' + fullSec + '</span> ' : '') + '<span class="text-amber-400 font-bold">' + discSec + ' $</span>');
          }
          if (currEnabled.includes('EUR') && primaryCurr !== 'EUR' && convObj.EUR) {
            const fullSec = Math.round(convObj.EUR * 12 * 100) / 100;
            const discSec = Math.round(convObj.EUR * annualRatio * 100) / 100;
            yrSecParts.push('≈ ' + (fullSec > discSec ? '<span class="line-through text-slate-500">' + fullSec + '</span> ' : '') + '<span class="text-amber-400 font-bold">' + discSec + ' €</span>');
          }
          if (yrSecParts.length > 0) {
            const yrSecDiv = document.createElement('div');
            yrSecDiv.className = 'text-[11px] text-slate-400 text-right';
            yrSecDiv.innerHTML = yrSecParts.join(' • ');
            yrRow.appendChild(yrSecDiv);
          }
          priceBox.appendChild(yrRow);
        }
        headerDiv.appendChild(priceBox);

        // Liste des avantages
        const featBox = document.createElement('div');
        featBox.className = 'space-y-1.5 pt-1';

        // 1ère ligne verrouillée (stockage ou IA)
        const mainAmount = targetCat === 'ai' ? (plan.credits_or_words || (plan.credits_count ? plan.credits_count.toLocaleString('fr-FR') + ' crédits IA' : 'Crédits IA')) : (plan.storage_amount || 'Stockage cloud');
        const mainFeat = document.createElement('div');
        mainFeat.className = 'flex items-center gap-2 p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-200 text-xs font-bold';
        mainFeat.innerHTML = '<span>🔒</span><span>' + mainAmount + '</span>';
        featBox.appendChild(mainFeat);

        // Autres avantages
        let feats = [];
        try {
          feats = typeof plan.features === 'string' ? JSON.parse(plan.features) : (plan.features || []);
        } catch (e) {}

        if (Array.isArray(feats) && feats.length > 0) {
          feats.forEach(function(f) {
            const fText = typeof f === 'string' ? f : f.text;
            const fEnabled = typeof f === 'object' ? (f.enabled !== false) : true;
            if (!fText) return;
            const item = document.createElement('div');
            item.className = 'flex items-start gap-2 text-xs ' + (fEnabled ? 'text-slate-300' : 'text-slate-500 line-through');
            item.innerHTML = '<span class="mt-0.5 ' + (fEnabled ? 'text-emerald-400' : 'text-slate-600') + '">' + (fEnabled ? '✓' : '✗') + '</span><span>' + fText + '</span>';
            featBox.appendChild(item);
          });
        }
        headerDiv.appendChild(featBox);
        card.appendChild(headerDiv);

        // =========================================================================
        // BOUTON DE MODE (AUTOMATIQUE VS MANUEL) & ACTIONS ADMIN (MODIFIER / SUPPRIMER)
        // =========================================================================
        const footerDiv = document.createElement('div');
        footerDiv.className = 'pt-4 mt-3 border-t border-slate-800 space-y-2.5';

        // VRAI BOUTON ERGONOMIQUE DE BASCULE AUTOMATIQUE / MANUEL
        const autoBillingBtn = document.createElement('button');
        autoBillingBtn.type = 'button';
        autoBillingBtn.className = 'w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-between transition-all duration-200 cursor-pointer shadow-md ' +
          (isAuto 
            ? 'bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-200 border-2 border-cyan-500/50 hover:border-cyan-400' 
            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-2 border-slate-700 hover:border-slate-500');
        autoBillingBtn.innerHTML = 
          '<div class="flex items-center gap-2.5 text-left">' +
            '<span class="text-base select-none">' + (isAuto ? '⚡' : '🔄') + '</span>' +
            '<div>' +
              '<div class="text-[10px] text-slate-400 uppercase font-black tracking-wider">Mode bouton étudiant :</div>' +
              '<div class="text-xs font-black ' + (isAuto ? 'text-cyan-300' : 'text-amber-300') + '">' +
                (isAuto ? '« S’abonner » (Paiement Auto)' : '« Commencer » (Paiement Manuel)') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<span class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all shadow-sm shrink-0 ' +
            (isAuto ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400' : 'bg-amber-500 text-slate-950 hover:bg-amber-400') + '">' +
            (isAuto ? 'Passer en Manuel ➔' : 'Passer en Auto ➔') +
          '</span>';
        
        autoBillingBtn.onclick = function() {
          toggleSubscriptionPlanAutoBilling(targetCat, plan.id);
        };
        footerDiv.appendChild(autoBillingBtn);

        // Boutons d'action : Modifier et Supprimer
        const actionRow = document.createElement('div');
        actionRow.className = 'flex items-center gap-2 pt-1';

        const btnEdit = document.createElement('button');
        btnEdit.type = 'button';
        btnEdit.className = 'flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow';
        btnEdit.innerHTML = '<span>✏️</span><span>Modifier la carte</span>';
        btnEdit.onclick = function() { openSubscriptionPlanModal(targetCat, plan.id); };

        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.className = 'px-3 py-2 bg-rose-950/40 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow';
        btnDel.title = 'Supprimer définitivement';
        btnDel.innerHTML = '<span>🗑️</span><span>Supprimer</span>';
        btnDel.onclick = function() { openDeleteConfirmModal(targetCat, plan.id, plan.name); };

        if (targetCat === 'ai') {
          const btnToggleModel = document.createElement('button');
          btnToggleModel.type = 'button';
          btnToggleModel.className = 'text-[11px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ' + 
            (isOneTime ? 'border-orange-500/40 bg-orange-950/40 text-orange-300 hover:bg-orange-900/50' : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50');
          btnToggleModel.textContent = isOneTime ? '🔄 Passer en Abonnement' : '⚡ Passer en Vente Unique';
          btnToggleModel.onclick = function() {
            toggleSubscriptionPlanPricingModel(plan.id, isOneTime ? 'subscription' : 'one_time');
          };
          actionRow.appendChild(btnToggleModel);
        }

        actionRow.appendChild(btnEdit);
        actionRow.appendChild(btnDel);
        footerDiv.appendChild(actionRow);

        card.appendChild(footerDiv);
        container.appendChild(card);
      });
    }
    window.renderSubscriptionPlansCards = renderSubscriptionPlansCards;

    function openSubscriptionPlanModal(category, planId) {
      const targetCat = category === 'ai' ? 'ai' : 'storage';
      const modal = document.getElementById('subscription-plan-modal');
      const errBox = document.getElementById('sub-plan-modal-error');
      if (errBox) errBox.classList.add('hidden');

      document.getElementById('sub-plan-category').value = targetCat;
      document.getElementById('sub-modal-icon').textContent = targetCat === 'ai' ? '🤖' : '💾';
      
      const modelContainer = document.getElementById('sub-pricing-model-container');
      if (modelContainer) {
        modelContainer.style.display = targetCat === 'ai' ? 'block' : 'none';
      }

      document.getElementById('sub-main-feature-label').textContent = targetCat === 'ai' ? 
        'Nombre de crédits IA inclus (Obligatoire, non décochable)' : 
        'Volume de stockage inclus (Obligatoire, non décochable)';

      const featInput = document.getElementById('sub-plan-main-feature-text');
      if (featInput) {
        featInput.placeholder = targetCat === 'ai' ? 'Ex: 100 000 crédits IA' : 'Ex: 50 Go supplémentaires (+ 51 200 Mo)';
      }

      const listContainer = document.getElementById('sub-plan-features-list');
      if (listContainer) listContainer.innerHTML = '';

      const plans = targetCat === 'ai' ? (allAiPlans || []) : (allStoragePlans || []);
      const existing = planId ? plans.find(p => p.id === planId) : null;

      if (existing) {
        document.getElementById('sub-modal-title').textContent = "Modifier la carte d'abonnement";
        document.getElementById('sub-plan-id').value = existing.id;
        document.getElementById('sub-plan-name').value = existing.name || '';
        document.getElementById('sub-plan-badge').value = existing.badge || '';
        document.getElementById('sub-plan-desc').value = existing.description || '';
        document.getElementById('sub-plan-price').value = existing.price || 10;
        document.getElementById('sub-plan-primary-curr').value = existing.primary_currency || 'USD';
        document.getElementById('sub-plan-discount').value = existing.yearly_discount_pct !== undefined ? existing.yearly_discount_pct : 10;
        setSubscriptionPricingModel(existing.pricing_model || 'subscription');

        document.getElementById('sub-plan-main-feature-text').value = existing.storage_amount || existing.credits_or_words || '';
        document.getElementById('sub-plan-main-feature-val').value = existing.storage_mb || existing.credits_count || 0;

        let currEnabled = ['USD', 'XOF', 'EUR'];
        try {
          if (typeof existing.currencies_enabled === 'string') currEnabled = JSON.parse(existing.currencies_enabled);
          else if (Array.isArray(existing.currencies_enabled)) currEnabled = existing.currencies_enabled;
        } catch (e) {}

        const cXof = document.getElementById('sub-curr-xof');
        const cUsd = document.getElementById('sub-curr-usd');
        const cEur = document.getElementById('sub-curr-eur');
        if (cXof) cXof.checked = currEnabled.includes('XOF');
        if (cUsd) cUsd.checked = currEnabled.includes('USD');
        if (cEur) cEur.checked = currEnabled.includes('EUR');

        let feats = [];
        try {
          feats = typeof existing.features === 'string' ? JSON.parse(existing.features) : (existing.features || []);
        } catch (e) {}

        if (Array.isArray(feats) && feats.length > 0) {
          feats.forEach(function(f) {
            const fText = typeof f === 'string' ? f : f.text;
            const fEn = typeof f === 'object' ? (f.enabled !== false) : true;
            addSubscriptionFeatureLine(fText, fEn);
          });
        }

        const isAuto = existing.is_auto_billing === 1;
        const bAuto = document.getElementById('sub-billing-auto');
        const bManual = document.getElementById('sub-billing-manual');
        if (bAuto && bManual) {
          bAuto.checked = isAuto;
          bManual.checked = !isAuto;
        }
      } else {
        document.getElementById('sub-modal-title').textContent = targetCat === 'ai' ? "Créer une offre / carte IA" : "Créer une carte d'abonnement Stockage";
        document.getElementById('sub-plan-id').value = '';
        document.getElementById('sub-plan-name').value = '';
        document.getElementById('sub-plan-badge').value = '';
        document.getElementById('sub-plan-desc').value = '';
        document.getElementById('sub-plan-price').value = '10';
        document.getElementById('sub-plan-primary-curr').value = 'USD';
        document.getElementById('sub-plan-discount').value = '10';
        setSubscriptionPricingModel('subscription');

        document.getElementById('sub-plan-main-feature-text').value = targetCat === 'ai' ? '100 000 crédits IA' : '10 Go supplémentaires';
        document.getElementById('sub-plan-main-feature-val').value = targetCat === 'ai' ? '100000' : '10240';

        const cXof = document.getElementById('sub-curr-xof');
        const cUsd = document.getElementById('sub-curr-usd');
        const cEur = document.getElementById('sub-curr-eur');
        if (cXof) cXof.checked = true;
        if (cUsd) cUsd.checked = true;
        if (cEur) cEur.checked = true;

        // Avantages suggérés
        if (targetCat === 'ai') {
          addSubscriptionFeatureLine('Résumés automatiques de cours et PDF', true);
          addSubscriptionFeatureLine('Création instantanée de Flashcards', true);
          addSubscriptionFeatureLine('Aide aux devoirs et explications pas à pas', true);
          addSubscriptionFeatureLine('Support par e-mail', true);
        } else {
          addSubscriptionFeatureLine("Messagerie d'équipe et partage de fichiers", true);
          addSubscriptionFeatureLine("Fil d'activité et aperçu des projets", true);
          addSubscriptionFeatureLine("Accès mobile et bureau", true);
          addSubscriptionFeatureLine("Support par e-mail", true);
        }

        const bManual = document.getElementById('sub-billing-manual');
        if (bManual) bManual.checked = true;
      }

      updateSubscriptionPricingCalculations();
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
    }
    window.openSubscriptionPlanModal = openSubscriptionPlanModal;

    function closeSubscriptionPlanModal(event) {
      if (event && event.target && event.target.closest && event.target.closest('#form-sub-plan')) return;
      const modal = document.getElementById('subscription-plan-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
    }
    window.closeSubscriptionPlanModal = closeSubscriptionPlanModal;

    function addSubscriptionFeatureLine(text = '', enabled = true) {
      const listContainer = document.getElementById('sub-plan-features-list');
      if (!listContainer) return;
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-lg border border-slate-800';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = enabled;
      cb.className = 'w-4 h-4 rounded text-orange-500 bg-slate-950 border-slate-700 cursor-pointer';

      const txt = document.createElement('input');
      txt.type = 'text';
      txt.value = text;
      txt.placeholder = 'Ex: Support prioritaire 24/7, Analyses avancées...';
      txt.className = 'flex-1 bg-transparent text-white text-xs outline-none';

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'w-6 h-6 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 flex items-center justify-center text-xs font-bold transition cursor-pointer';
      delBtn.textContent = '✕';
      delBtn.onclick = function() { row.remove(); };

      row.appendChild(cb);
      row.appendChild(txt);
      row.appendChild(delBtn);
      listContainer.appendChild(row);
    }
    window.addSubscriptionFeatureLine = addSubscriptionFeatureLine;

    async function saveSubscriptionPlanModal() {
      const category = document.getElementById('sub-plan-category').value || 'storage';
      const planId = document.getElementById('sub-plan-id').value;
      const name = document.getElementById('sub-plan-name').value.trim();
      const badge = document.getElementById('sub-plan-badge').value.trim();
      const desc = document.getElementById('sub-plan-desc').value.trim();
      const price = Number(document.getElementById('sub-plan-price').value) || 0;
      const primaryCurr = document.getElementById('sub-plan-primary-curr').value || 'USD';
      const discountPct = Number(document.getElementById('sub-plan-discount').value) || 0;

      const mainText = document.getElementById('sub-plan-main-feature-text').value.trim();
      const mainVal = Number(document.getElementById('sub-plan-main-feature-val').value) || 0;

      const currEnabled = [];
      if (document.getElementById('sub-curr-xof')?.checked) currEnabled.push('XOF');
      if (document.getElementById('sub-curr-usd')?.checked) currEnabled.push('USD');
      if (document.getElementById('sub-curr-eur')?.checked) currEnabled.push('EUR');
      if (!currEnabled.includes(primaryCurr)) currEnabled.unshift(primaryCurr);

      const conv = calculateConversions(price, primaryCurr);
      const yearlyPrice = Math.round(price * 12 * (1 - (discountPct / 100)) * 100) / 100;

      const bAuto = document.getElementById('sub-billing-auto');
      const isAuto = bAuto && bAuto.checked ? 1 : 0;

      // Rassembler les avantages
      const features = [];
      const listContainer = document.getElementById('sub-plan-features-list');
      if (listContainer) {
        const rows = listContainer.children;
        for (let i = 0; i < rows.length; i++) {
          const cb = rows[i].querySelector('input[type="checkbox"]');
          const txt = rows[i].querySelector('input[type="text"]');
          if (txt && txt.value.trim()) {
            features.push({
              text: txt.value.trim(),
              enabled: cb ? cb.checked : true
            });
          }
        }
      }

      const pricingModel = category === 'ai' 
        ? (document.getElementById('sub-plan-pricing-model')?.value || 'subscription')
        : 'subscription';
      const isOneTime = pricingModel === 'one_time' || pricingModel === 'pack';

      const planData = {
        id: planId || ((category === 'ai' ? 'ai_card_' : 'storage_card_') + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
        name,
        badge,
        description: desc,
        price,
        primary_currency: primaryCurr,
        currencies_enabled: currEnabled,
        currency_conversions: conv,
        yearly_price: isOneTime ? 0 : yearlyPrice,
        yearly_discount_pct: isOneTime ? 0 : discountPct,
        features,
        is_auto_billing: isAuto,
        is_active: 1,
        pricing_model: pricingModel
      };

      if (category === 'ai') {
        planData.credits_or_words = mainText;
        planData.credits_count = mainVal;
      } else {
        planData.storage_amount = mainText;
        planData.storage_mb = mainVal;
      }

      const saveBtn = document.getElementById('btn-save-sub-plan');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Enregistrement D1...';
      }

      try {
        const res = await safeSubPlansApi('/api/subscription-plans/save', { category, plan: planData });
        if (res && res.success && res.plan) {
          if (category === 'ai') {
            const idx = (allAiPlans || []).findIndex(p => p.id === res.plan.id);
            if (idx >= 0) allAiPlans[idx] = res.plan;
            else allAiPlans.push(res.plan);
          } else {
            const idx = (allStoragePlans || []).findIndex(p => p.id === res.plan.id);
            if (idx >= 0) allStoragePlans[idx] = res.plan;
            else allStoragePlans.push(res.plan);
          }
          renderSubscriptionPlansCards(currentSubPlanTab);
          closeSubscriptionPlanModal();
          showToast("✓ Carte d'abonnement enregistrée dans la base de données !");
        } else {
          throw new Error(res?.error || "Échec de la sauvegarde");
        }
      } catch (err) {
        console.error('Erreur sauvegarde forfait:', err);
        const errBox = document.getElementById('sub-plan-modal-error');
        if (errBox) {
          errBox.textContent = 'Erreur : ' + err.message;
          errBox.classList.remove('hidden');
        }
        showToast('⚠️ Erreur: ' + err.message);
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Enregistrer la carte';
        }
      }
    }
    window.saveSubscriptionPlanModal = saveSubscriptionPlanModal;

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
    window.escapeHtml = escapeHtml;

    async function safeSubPlansApi(endpoint, body) {
      let text = '';
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        text = await resp.text();
        if (text && !text.trim().startsWith('<')) {
          const data = JSON.parse(text);
          if (data && data.success) return data;
          if (data && data.error) throw new Error(data.error);
        }
      } catch (err) {
        console.warn('[SubPlans API] Local endpoint échoué, essai du fallback:', err);
      }

      // Fallback vers le worker principal API en cas d'erreur ou de page HTML accidentelle
      try {
        const fallbackUrl = 'https://api-worker.dkd-technologies.com' + endpoint;
        const resp2 = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const text2 = await resp2.text();
        if (text2 && !text2.trim().startsWith('<')) {
          const data2 = JSON.parse(text2);
          if (data2 && data2.success) return data2;
          if (data2 && data2.error) throw new Error(data2.error);
        }
      } catch (err2) {
        console.error('[SubPlans API] Fallback endpoint échoué:', err2);
      }

      if (text && text.trim().startsWith('<')) {
        throw new Error("Réponse HTML inattendue du serveur. La route API n'a pas répondu en JSON.");
      }
      throw new Error("Impossible de communiquer avec le serveur ou la base de données");
    }
    window.safeSubPlansApi = safeSubPlansApi;

    let pendingDeleteCategory = null;
    let pendingDeletePlanId = null;

    function openDeleteConfirmModal(category, id, planName) {
      pendingDeleteCategory = category;
      pendingDeletePlanId = id;
      const modal = document.getElementById('confirm-delete-sub-plan-modal');
      const textEl = document.getElementById('confirm-delete-sub-plan-text');
      if (textEl) {
        textEl.innerHTML = "Êtes-vous sûr de vouloir supprimer définitivement la carte d&apos;abonnement <strong>« " + escapeHtml(planName || "Forfait") + " »</strong> ? Cette action est irréversible et la carte sera immédiatement retirée de l&apos;application.";
      }
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      }
    }
    window.openDeleteConfirmModal = openDeleteConfirmModal;

    function closeDeleteConfirmModal(event) {
      if (event && event.target && event.target.closest && event.target.closest('#confirm-delete-sub-plan-modal > div')) return;
      const modal = document.getElementById('confirm-delete-sub-plan-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
      pendingDeleteCategory = null;
      pendingDeletePlanId = null;
    }
    window.closeDeleteConfirmModal = closeDeleteConfirmModal;

    async function confirmDeleteSubscriptionPlan() {
      if (!pendingDeleteCategory || !pendingDeletePlanId) return;
      const cat = pendingDeleteCategory;
      const id = pendingDeletePlanId;
      const btn = document.getElementById('btn-confirm-delete-sub-plan');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Suppression en cours...';
      }
      try {
        const res = await safeSubPlansApi('/api/subscription-plans/delete', { category: cat, id });
        if (res && res.success) {
          if (cat === 'ai') {
            allAiPlans = (allAiPlans || []).filter(p => p.id !== id);
          } else {
            allStoragePlans = (allStoragePlans || []).filter(p => p.id !== id);
          }
          renderSubscriptionPlansCards(currentSubPlanTab);
          closeDeleteConfirmModal();
          showToast("✓ Carte d'abonnement supprimée définitivement avec succès !");
        } else {
          throw new Error(res?.error || "Échec de la suppression");
        }
      } catch (err) {
        console.error('Erreur suppression forfait:', err);
        showToast('⚠️ Erreur: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Confirmer la suppression';
        }
      }
    }
    window.confirmDeleteSubscriptionPlan = confirmDeleteSubscriptionPlan;

    async function toggleSubscriptionPlanActive(category, id, explicitState) {
      try {
        const isChecked = explicitState !== undefined ? !!explicitState : undefined;
        const res = await safeSubPlansApi('/api/subscription-plans/toggle-active', {
          category,
          id,
          is_active: isChecked !== undefined ? (isChecked ? 1 : 0) : undefined
        });
        if (res && res.success) {
          const list = category === 'ai' ? allAiPlans : allStoragePlans;
          const p = (list || []).find(item => item.id === id);
          if (p) p.is_active = res.is_active;
          renderSubscriptionPlansCards(currentSubPlanTab);
          showToast(res.is_active === 1 ? "✓ Carte désormais visible pour les étudiants dans l'application" : "✓ Carte masquée de l'application");
        }
      } catch (err) {
        console.error('Erreur toggle actif:', err);
        showToast('⚠️ Erreur: ' + err.message);
      }
    }
    window.toggleSubscriptionPlanActive = toggleSubscriptionPlanActive;

    async function saveSubscriptionPlanBadge(category, id, explicitBadge) {
      try {
        const badge = String(explicitBadge || '').trim();
        const res = await safeSubPlansApi('/api/subscription-plans/update-badge', {
          category,
          id,
          badge
        });
        if (res && res.success) {
          const list = category === 'ai' ? allAiPlans : allStoragePlans;
          const p = (list || []).find(item => item.id === id);
          if (p) p.badge = res.badge;
          renderSubscriptionPlansCards(currentSubPlanTab);
          showToast(res.badge ? '✓ Badge « ' + res.badge + ' » activé et enregistré !' : "✓ Badge retiré de la carte");
        }
      } catch (err) {
        console.error('Erreur mise à jour badge:', err);
        showToast('⚠️ Erreur: ' + err.message);
      }
    }
    window.saveSubscriptionPlanBadge = saveSubscriptionPlanBadge;

    async function toggleSubscriptionPlanAutoBilling(category, id) {
      try {
        const res = await safeSubPlansApi('/api/subscription-plans/toggle-auto-billing', { category, id });
        if (res && res.success) {
          const list = category === 'ai' ? allAiPlans : allStoragePlans;
          const p = (list || []).find(item => item.id === id);
          if (p) p.is_auto_billing = res.is_auto_billing;
          renderSubscriptionPlansCards(currentSubPlanTab);
          showToast(res.is_auto_billing === 1 ? "⚡ Mode Abonnement Automatique activé (Bouton S'abonner)" : '🔄 Mode Paiement Manuel activé (Bouton Commencer)');
        }
      } catch (err) {
        console.error('Erreur toggle auto billing:', err);
        showToast('⚠️ Erreur: ' + err.message);
      }
    }
    window.toggleSubscriptionPlanAutoBilling = toggleSubscriptionPlanAutoBilling;

    async function pollLiveStorageStats(isManual = false) {
      const spinner = document.getElementById('refresh-spinner');
      if (spinner) spinner.classList.add('animate-spin');

      try {
        const resp = await fetch('/api/overview');
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data || !data.summary) return;

        // Mise à jour des cartes métriques
        const r2El = document.getElementById('stat-volume-r2');
        if (r2El) r2El.textContent = data.summary.totalR2Formatted;

        const d1El = document.getElementById('stat-volume-d1');
        if (d1El) d1El.textContent = data.summary.totalD1Formatted;

        const usersEl = document.getElementById('stat-total-users');
        if (usersEl) usersEl.textContent = data.summary.totalUsers;

        // Mise à jour des barres de progression
        const totalStorageBytes = data.summary.totalStorageBytes || 0;
        const totalR2Bytes = data.summary.totalR2Bytes || 0;
        const totalD1Bytes = data.summary.totalD1Bytes || 0;

        const barGlobLabel = document.getElementById('bar-global-label');
        if (barGlobLabel) barGlobLabel.textContent = data.summary.totalStorageFormatted + " / 15 Go (" + ((totalStorageBytes / (15 * 1024 * 1024 * 1024)) * 100).toFixed(3) + "%)";

        const barGlobFill = document.getElementById('bar-global-fill');
        if (barGlobFill) barGlobFill.style.width = Math.max(1, Math.min(100, (totalStorageBytes / (15 * 1024 * 1024 * 1024)) * 100)) + '%';

        const barR2Label = document.getElementById('bar-r2-label');
        if (barR2Label) barR2Label.textContent = data.summary.totalR2Formatted + " / 10 Go gratuits (" + ((totalR2Bytes / (10 * 1024 * 1024 * 1024)) * 100).toFixed(3) + "%)";

        const barR2Fill = document.getElementById('bar-r2-fill');
        if (barR2Fill) barR2Fill.style.width = Math.max(1, Math.min(100, (totalR2Bytes / (10 * 1024 * 1024 * 1024)) * 100)) + '%';

        const barD1Label = document.getElementById('bar-d1-label');
        if (barD1Label) barD1Label.textContent = data.summary.totalD1Formatted + " / 5 Go gratuits (" + ((totalD1Bytes / (5 * 1024 * 1024 * 1024)) * 100).toFixed(3) + "%)";

        const barD1Fill = document.getElementById('bar-d1-fill');
        if (barD1Fill) barD1Fill.style.width = Math.max(1, Math.min(100, (totalD1Bytes / (5 * 1024 * 1024 * 1024)) * 100)) + '%';

        // Mise à jour des tables et dossiers
        if (data.d1Tables) {
          d1TablesGlobal = data.d1Tables;
          if (data.tablesMeta && Array.isArray(data.tablesMeta)) {
            tablesMeta = data.tablesMeta;
            const countBadge = document.getElementById('d1-tables-count-badge');
            if (countBadge) countBadge.textContent = "(" + tablesMeta.length + " tables répertoriées)";
          }
          const searchInput = document.getElementById('global-search-input');
          renderGlobalD1Tables(searchInput ? searchInput.value : '');
        }

        if (data.r2Folders) {
          r2FoldersGlobal = data.r2Folders;
          const searchInput = document.getElementById('global-search-input');
          renderGlobalR2Folders(searchInput ? searchInput.value : '');
        }

        const badge = document.getElementById('live-indicator-badge');
        if (badge) {
          badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Écoute en direct Cloudflare D1 & R2 (' + new Date().toLocaleTimeString('fr-FR') + ')';
        }

        if (isManual) {
          showToast('✓ Données Cloudflare actualisées en direct');
        }
      } catch (err) {
        console.warn('Erreur actualisation en direct:', err);
      } finally {
        if (spinner) spinner.classList.remove('animate-spin');
      }
    }

    function manualRefreshLiveStats() {
      pollLiveStorageStats(true);
    }

    // Initialisation
    renderGlobalD1Tables();
    renderGlobalR2Folders();
    loadCompanyProfileClient();
    renderSubscriptionPlansCards(currentSubPlanTab);

    // Prise en charge du lien direct ou du rechargement de page via le hash URL (#profil-pro, etc.)
    const initialHash = (window.location.hash || '').replace('#', '').trim();
    if (initialHash && ['global', 'users', 'demandes', 'distribution', 'messages', 'signalements', 'abonnements', 'statistiques', 'profil-pro'].includes(initialHash)) {
      switchView(initialHash);
    }

    window.addEventListener('hashchange', () => {
      const hv = (window.location.hash || '').replace('#', '').trim();
      if (hv && ['global', 'users', 'demandes', 'distribution', 'messages', 'signalements', 'abonnements', 'statistiques', 'profil-pro'].includes(hv) && hv !== currentView) {
        switchView(hv);
      }
    });

    const burgerBtn = document.getElementById('btn-hamburger');
    if (burgerBtn) {
      burgerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSidebar(true);
      });
    }

    // AUCUNE boucle infinie ni polling continu en arrière-plan :
    // L'écoute est 100% intelligente et événementielle (très économique pour vos quotas Cloudflare) :
    // 1. Quand vous cliquez sur "Actualiser"
    // 2. Quand vous revenez sur l'onglet du tableau de bord (focus / visibilité)
    // 3. Après chaque action d'administration (approbation de demande, modification de quota, etc.)
    let lastRefreshTime = Date.now();
    function smartAutoRefresh() {
      // Anti-rafale : au maximum une actualisation toutes les 10 secondes lors du retour sur l'onglet
      if (Date.now() - lastRefreshTime > 10000) {
        lastRefreshTime = Date.now();
        pollLiveStorageStats(false);
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        smartAutoRefresh();
      }
    });

    window.addEventListener('focus', () => {
      smartAutoRefresh();
    });
  </script>
</body>
</html>`;
}

// ============================================================================
// GESTIONNAIRE PRINCIPAL DU WORKER TABLEAU DE BORD
// ============================================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const rawPath = url.pathname || '/';
    const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, '') : rawPath;
    const origin = request.headers.get('Origin') || '*';

    // Gestion du Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const { db, bucket } = getStorageBindings(env);

    // Si c'est un appel API et que D1 n'est pas lié, renvoyer une réponse explicite
    if (!db && path.startsWith('/api/')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Liaison D1 introuvable. Assurez-vous d'avoir lié MON_D1_STUDYCLOUD ou DB dans les paramètres Cloudflare."
        }, null, 2),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        }
      );
    }

    // Initialisation automatique des tables de quotas si absentes et DB connectée
    if (db) {
      await ensureStorageTables(db);
    }

    try {
      // ----------------------------------------------------------------------
      // ROUTE GET : /api/storage/file/* (Téléchargement / Affichage Fichiers & Reçus R2)
      // ----------------------------------------------------------------------
      if (request.method === 'GET' && path.startsWith('/api/storage/file/')) {
        const key = decodeURIComponent(path.replace('/api/storage/file/', ''));
        if (bucket) {
          try {
            const object = await bucket.get(key);
            if (object) {
              const headers = new Headers();
              object.writeHttpMetadata(headers);
              headers.set('etag', object.httpEtag);
              headers.set('Cache-Control', 'public, max-age=31536000, immutable');
              headers.set('Access-Control-Allow-Origin', origin);
              return new Response(object.body, { headers });
            }
          } catch (r2Err) {
            console.warn('Erreur lecture R2:', r2Err);
          }
        }
        return new Response(JSON.stringify({ success: false, error: 'Fichier introuvable dans R2' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/user/storage/upgrade-request
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/user/storage/upgrade-request') {
        let userId = url.searchParams.get('userId') || request.headers.get('x-user-id');
        const body = await request.json().catch(() => ({}));
        userId = userId || body.userId;
        if (!userId) {
          return new Response(JSON.stringify({ success: false, error: 'Identifiant utilisateur requis' }), { status: 400, headers: corsHeaders(origin) });
        }

        const requestId = 'REQ_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        const packId = body.packId || 'custom';
        const packName = body.packName || 'Pack Personnalisé';
        const additionalMb = Number(body.additionalMb || 1024);
        const additionalWords = Number(body.additionalWords || 100000);
        const contactPhone = body.contactPhone || body.userPhone || '';
        const userWhatsapp = body.whatsappNumber || body.userWhatsapp || '';
        const rawNotes = body.notes || '';
        const notes = [rawNotes, userWhatsapp ? `WhatsApp: ${userWhatsapp}` : ''].filter(Boolean).join(' | ');
        const userName = body.userName || '';
        const userEmail = body.userEmail || '';
        const pricePaid = Number(body.pricePaid || body.price || 0);
        const currency = body.currency || 'FCFA';
        const paymentMethod = body.paymentMethod || 'Wave / Orange / Moov / MTN';
        const paymentReference = body.paymentReference || '';
        const receiptImageUrl = body.receiptImageUrl || body.receiptUrl || '';
        const receiptR2Key = body.receiptR2Key || (receiptImageUrl ? `storage-receipts/${userId}/recu_${requestId}.jpg` : '');

        const storageDisplay = body.storageDisplay || (additionalMb >= 1024 ? `${(additionalMb / 1024).toFixed(additionalMb % 1024 === 0 ? 0 : 1)} Go (${additionalMb} Mo)` : `${additionalMb} Mo`);
        const priceDisplay = body.priceDisplay || `${pricePaid} ${currency}`;
        const billingCycle = body.billingCycle || 'annual';
        const requestType = body.requestType || (body.isRenewal || (packName && packName.toLowerCase().includes('renouvellement')) ? 'renewal' : 'upgrade');

        let finalReceiptUrl = receiptImageUrl;
        if (receiptImageUrl && receiptImageUrl.startsWith('data:') && bucket) {
          try {
            const mimeMatch = receiptImageUrl.match(/^data:([^;]+);base64,/);
            const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const base64Content = receiptImageUrl.replace(/^data:[^;]+;base64,/, '');
            const binStr = atob(base64Content);
            const bytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) {
              bytes[i] = binStr.charCodeAt(i);
            }
            await bucket.put(receiptR2Key, bytes.buffer, { httpMetadata: { contentType } });
            finalReceiptUrl = `${url.origin}/api/storage/file/${encodeURIComponent(receiptR2Key)}`;
          } catch (imgErr) {
            console.warn('Erreur R2 reçu:', imgErr);
          }
        }

        await safeRun(db, `
          INSERT INTO storage_upgrade_requests (
            id, user_id, user_name, user_phone, user_email, pack_id, pack_name,
            additional_mb, additional_words, price_paid, currency, payment_method, payment_reference,
            receipt_image_url, receipt_r2_key, contact_phone, user_whatsapp,
            storage_display, price_display, billing_cycle, notes, request_type, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          requestId, userId, userName, contactPhone, userEmail, packId, packName,
          additionalMb, additionalWords, pricePaid, currency, paymentMethod, paymentReference,
          finalReceiptUrl, receiptR2Key, contactPhone, userWhatsapp,
          storageDisplay, priceDisplay, billingCycle, notes, requestType
        ]);

        return new Response(JSON.stringify({
          success: true,
          message: 'Demande enregistrée avec succès',
          requestId
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE GET : /api/user/storage/upgrade-requests
      // ----------------------------------------------------------------------
      if (request.method === 'GET' && path === '/api/user/storage/upgrade-requests') {
        const userId = url.searchParams.get('userId') || request.headers.get('x-user-id');
        if (!userId) {
          return new Response(JSON.stringify({ success: false, error: 'userId requis' }), { status: 400, headers: corsHeaders(origin) });
        }
        await ensureStorageTables(db);
        const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
        const query = `SELECT * FROM storage_upgrade_requests WHERE user_id = ? ORDER BY created_at DESC`;
        const reqs = await safeQuery(db, query, [userId], { results: [] });
        const list = (reqs && reqs.results) ? reqs.results : [];
        const filtered = includeDeleted ? list : list.filter(r => !r.user_deleted_at);
        return new Response(JSON.stringify({
          success: true,
          requests: filtered
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE GET : /api/user/purchases-history (HISTORIQUE OFFICIEL DES ACHATS UTILISATEUR)
      // ----------------------------------------------------------------------
      if (request.method === 'GET' && path === '/api/user/purchases-history') {
        const userId = url.searchParams.get('userId') || request.headers.get('x-user-id');
        if (!userId) {
          return new Response(JSON.stringify({ success: false, error: 'userId requis' }), { status: 400, headers: corsHeaders(origin) });
        }

        await ensureStorageTables(db);

        // 1. Récupération des achats enregistrés dans la table user_purchases_history
        let purchasesRes = await safeQuery(db, `
          SELECT * FROM user_purchases_history 
          WHERE user_id = ? AND (user_deleted_at IS NULL OR user_deleted_at = '') 
          ORDER BY purchased_at DESC, created_at DESC
        `, [userId], { results: [] });
        let purchases = (purchasesRes && purchasesRes.results) ? purchasesRes.results : [];

        // 2. Synchronisation automatique si user_purchases_history est vide mais que l'utilisateur a des souscriptions ou des demandes approuvées
        if (purchases.length === 0) {
          // A) Récupérer les souscriptions de l'utilisateur
          const subsRes = await safeQuery(db, `
            SELECT * FROM user_subscriptions 
            WHERE user_id = ? 
            ORDER BY created_at DESC
          `, [userId], { results: [] });
          const userSubs = (subsRes && subsRes.results) ? subsRes.results : [];

          // B) Récupérer les demandes de stockage approuvées
          const reqsRes = await safeQuery(db, `
            SELECT * FROM storage_upgrade_requests 
            WHERE user_id = ? AND status = 'approved' AND (user_deleted_at IS NULL OR user_deleted_at = '')
            ORDER BY created_at DESC
          `, [userId], { results: [] });
          const approvedReqs = (reqsRes && reqsRes.results) ? reqsRes.results : [];

          // C) Enregistrer les demandes approuvées dans user_purchases_history
          for (const req of approvedReqs) {
            const purId = 'PUR_' + (req.id ? req.id.replace(/[^a-zA-Z0-9]/g, '') : Math.random().toString(36).substring(2, 10));
            const addMb = Number(req.additional_mb || 1024);
            const price = Number(req.price_paid || 1000);
            const dateVal = req.confirmed_start_date || req.confirmed_at || req.updated_at || req.created_at || new Date().toISOString();
            const renDate = req.confirmed_end_date || '';
            try {
              await safeRun(db, `
                INSERT OR IGNORE INTO user_purchases_history (
                  id, user_id, user_name, user_phone, user_email, pack_name,
                  storage_bought_mb, total_storage_mb, price_paid, currency,
                  payment_method, payment_reference, billing_cycle, renewal_date,
                  status, purchased_at, confirmed_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
              `, [
                purId, userId, req.user_name || '', req.user_phone || req.contact_phone || '', req.user_email || '',
                req.pack_name || 'Pack Stockage StudyCloud', addMb, addMb + 30, price, req.currency || 'FCFA',
                req.payment_method || 'Mobile Money', req.payment_reference || req.id || '',
                req.billing_cycle || 'monthly', renDate, dateVal, dateVal, dateVal
              ]);
            } catch (e) {}
          }

          // D) Enregistrer les abonnements dans user_purchases_history
          for (const sub of userSubs) {
            const purId = 'PUR_' + (sub.id ? sub.id.replace(/[^a-zA-Z0-9]/g, '') : Math.random().toString(36).substring(2, 10));
            const totMb = Number(sub.total_storage_mb || 1024);
            const boughtMb = sub.storage_added_mb ? Number(sub.storage_added_mb) : Math.max(0, totMb - 30);
            const price = Number(sub.monthly_price || 1000);
            const dateVal = sub.start_date || sub.created_at || new Date().toISOString();
            const renDate = sub.end_date || '';
            try {
              await safeRun(db, `
                INSERT OR IGNORE INTO user_purchases_history (
                  id, user_id, user_name, user_phone, user_email, pack_name,
                  storage_bought_mb, total_storage_mb, price_paid, currency,
                  payment_method, payment_reference, billing_cycle, renewal_date,
                  status, purchased_at, confirmed_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
              `, [
                purId, userId, sub.user_name || '', sub.user_phone || '', sub.user_email || '',
                sub.plan_name || 'Abonnement StudyCloud', boughtMb, totMb, price, sub.currency || 'FCFA',
                'Mobile Money', sub.request_id || sub.id, 'monthly', renDate, dateVal, dateVal, dateVal
              ]);
            } catch (e) {}
          }

          // Re-sélectionner après synchronisation
          purchasesRes = await safeQuery(db, `
            SELECT * FROM user_purchases_history 
            WHERE user_id = ? AND (user_deleted_at IS NULL OR user_deleted_at = '') 
            ORDER BY purchased_at DESC, created_at DESC
          `, [userId], { results: [] });
          purchases = (purchasesRes && purchasesRes.results) ? purchasesRes.results : [];
        }

        return new Response(JSON.stringify({
          success: true,
          purchases
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/user/storage/delete-history-item (PURGE DIFFÉRÉE À 1 MOIS)
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/user/storage/delete-history-item') {
        const body = await request.json().catch(() => ({}));
        const requestId = body.requestId;
        const userId = body.userId || url.searchParams.get('userId') || request.headers.get('x-user-id');
        if (!requestId || !userId) {
          return new Response(JSON.stringify({ success: false, error: 'requestId et userId requis' }), { status: 400, headers: corsHeaders(origin) });
        }

        const nowISO = new Date().toISOString();
        const purgeDateISO = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const purgeId = 'purge_' + Math.random().toString(36).substring(2, 10);

        try {
          await safeRun(db, `
            CREATE TABLE IF NOT EXISTS user_requests_history_purge (
              id TEXT PRIMARY KEY,
              request_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              requested_at TEXT NOT NULL,
              purge_effective_at TEXT NOT NULL,
              status TEXT DEFAULT 'pending_purge',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `);
        } catch (e) {}

        try {
          await safeRun(db, `
            INSERT INTO user_requests_history_purge (id, request_id, user_id, requested_at, purge_effective_at, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending_purge', ?)
          `, [purgeId, requestId, userId, nowISO, purgeDateISO, nowISO]);
        } catch (e) {}

        try {
          await safeRun(db, `ALTER TABLE storage_upgrade_requests ADD COLUMN user_deleted_at TEXT DEFAULT ''`);
        } catch (e) {}
        try {
          await safeRun(db, `ALTER TABLE storage_upgrade_requests ADD COLUMN purge_scheduled_at TEXT DEFAULT ''`);
        } catch (e) {}

        try {
          await safeRun(db, `
            UPDATE storage_upgrade_requests 
            SET user_deleted_at = ?, purge_scheduled_at = ? 
            WHERE id = ? AND user_id = ?
          `, [nowISO, purgeDateISO, requestId, userId]);
        } catch (e) {}

        try {
          await safeRun(db, `
            UPDATE user_purchases_history 
            SET user_deleted_at = ?, purge_scheduled_at = ? 
            WHERE (id = ? OR id = ? OR id = ?) AND user_id = ?
          `, [nowISO, purgeDateISO, requestId, 'PUR_' + requestId, requestId.replace('PUR_', ''), userId]);
        } catch (e) {}

        return new Response(JSON.stringify({
          success: true,
          message: "Votre demande de suppression a été enregistrée. Conformément à la réglementation de traçabilité comptable, la suppression définitive de cet historique sera effective après 1 mois (30 jours)."
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE GET : /api/user/subscriptions
      // ----------------------------------------------------------------------
      if (request.method === 'GET' && path === '/api/user/subscriptions') {
        const userId = url.searchParams.get('userId') || request.headers.get('x-user-id');
        if (!userId) {
          return new Response(JSON.stringify({ success: false, error: 'userId requis' }), { status: 400, headers: corsHeaders(origin) });
        }
        const subs = await safeQuery(db, `SELECT * FROM user_subscriptions WHERE user_id = ? ORDER BY created_at DESC`, [userId], { results: [] });
        const quota = await safeFirst(db, `SELECT * FROM user_storage_quotas WHERE user_id = ?`, [userId]);
        return new Response(JSON.stringify({
          success: true,
          subscriptions: (subs && subs.results) ? subs.results : [],
          quota: quota || null
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/storage/update-welcome-and-apply-all (IMAGE 2)
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/storage/update-welcome-and-apply-all') {
        const body = await request.json();
        const defTotal = Number(body.welcomeTotalMb ?? 30.0);
        if (isNaN(defTotal) || defTotal < 0) {
          return new Response(JSON.stringify({ success: false, error: 'Montant invalide' }), { status: 400, headers: corsHeaders(origin) });
        }

        const defR2 = Math.round(defTotal / 3);
        const defD1 = Math.round((defTotal * 2) / 3);

        // 1. Mise à jour de la configuration globale
        await safeRun(db, `
          INSERT INTO storage_global_config (id, default_welcome_total_mb, default_welcome_r2_mb, default_welcome_d1_mb, updated_at)
          VALUES ('default', ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            default_welcome_total_mb = excluded.default_welcome_total_mb,
            default_welcome_r2_mb = excluded.default_welcome_r2_mb,
            default_welcome_d1_mb = excluded.default_welcome_d1_mb,
            updated_at = CURRENT_TIMESTAMP
        `, [defTotal, defR2, defD1]);

        await safeRun(db, `
          INSERT INTO storage_global_config (id, default_welcome_total_mb, default_welcome_r2_mb, default_welcome_d1_mb, updated_at)
          VALUES ('global', ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            default_welcome_total_mb = excluded.default_welcome_total_mb,
            default_welcome_r2_mb = excluded.default_welcome_r2_mb,
            default_welcome_d1_mb = excluded.default_welcome_d1_mb,
            updated_at = CURRENT_TIMESTAMP
        `, [defTotal, defR2, defD1]);

        // 2. Application immédiate à TOUS les utilisateurs existants dans la table de quotas
        await safeRun(db, `
          UPDATE user_storage_quotas
          SET welcome_total_mb = ?,
              welcome_r2_mb = ?,
              welcome_d1_mb = ?,
              updated_at = CURRENT_TIMESTAMP
        `, [defTotal, defR2, defD1]);

        // 3. S'assurer que tout utilisateur présent dans 'users' a une ligne
        try {
          await db.prepare(`
            INSERT OR IGNORE INTO user_storage_quotas (user_id, welcome_total_mb, welcome_r2_mb, welcome_d1_mb, paid_total_mb, paid_r2_mb, paid_d1_mb, plan_name)
            SELECT id, ?, ?, ?, 0.0, 0.0, 0.0, 'gratuit' FROM users
          `).bind(defTotal, defR2, defD1).run();
        } catch (e) {}

        return new Response(JSON.stringify({ 
          success: true, 
          welcomeTotalMb: defTotal,
          welcomeR2Mb: defR2,
          welcomeD1Mb: defD1,
          message: "Stockage de bienvenue appliqué à tous les utilisateurs"
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/storage/update-global-config
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/storage/update-global-config') {
        const body = await request.json();
        const defTotal = Number(body.defaultWelcomeTotalMb ?? 30.0);
        const defR2 = Number(body.defaultWelcomeR2Mb ?? Math.round(defTotal / 3));
        const defD1 = Number(body.defaultWelcomeD1Mb ?? Math.round((defTotal * 2) / 3));

        await safeRun(db, `
          INSERT INTO storage_global_config (id, default_welcome_total_mb, default_welcome_r2_mb, default_welcome_d1_mb, updated_at)
          VALUES ('default', ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            default_welcome_total_mb = excluded.default_welcome_total_mb,
            default_welcome_r2_mb = excluded.default_welcome_r2_mb,
            default_welcome_d1_mb = excluded.default_welcome_d1_mb,
            updated_at = CURRENT_TIMESTAMP
        `, [defTotal, defR2, defD1]);

        return new Response(JSON.stringify({ success: true, defaultWelcomeTotalMb: defTotal, defaultWelcomeR2Mb: defR2, defaultWelcomeD1Mb: defD1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/storage/update-user-quota
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/storage/update-user-quota') {
        const body = await request.json();
        const userId = body.userId;
        if (!userId) {
          return new Response(JSON.stringify({ success: false, error: 'userId requis' }), { status: 400, headers: corsHeaders(origin) });
        }

        const wTotal = Number(body.welcomeTotalMb ?? ((Number(body.welcomeR2Mb || 10)) + (Number(body.welcomeD1Mb || 20))));
        const wR2 = Number(body.welcomeR2Mb ?? Math.round(wTotal / 3));
        const wD1 = Number(body.welcomeD1Mb ?? Math.round((wTotal * 2) / 3));
        const pTotal = Number(body.paidTotalMb ?? ((Number(body.paidR2Mb || 0)) + (Number(body.paidD1Mb || 0))));
        const pR2 = Number(body.paidR2Mb ?? Math.round(pTotal / 2));
        const pD1 = Number(body.paidD1Mb ?? Math.round(pTotal / 2));
        const planName = body.planName || (pTotal > 0 ? 'payant' : 'gratuit');

        await safeRun(db, `
          INSERT INTO user_storage_quotas (user_id, welcome_total_mb, welcome_r2_mb, welcome_d1_mb, paid_total_mb, paid_r2_mb, paid_d1_mb, plan_name, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET
            welcome_total_mb = excluded.welcome_total_mb,
            welcome_r2_mb = excluded.welcome_r2_mb,
            welcome_d1_mb = excluded.welcome_d1_mb,
            paid_total_mb = excluded.paid_total_mb,
            paid_r2_mb = excluded.paid_r2_mb,
            paid_d1_mb = excluded.paid_d1_mb,
            plan_name = excluded.plan_name,
            updated_at = CURRENT_TIMESTAMP
        `, [userId, wTotal, wR2, wD1, pTotal, pR2, pD1, planName]);

        return new Response(JSON.stringify({ 
          success: true, 
          userId, 
          welcomeTotalMb: wTotal,
          paidTotalMb: pTotal,
          totalMb: wTotal + pTotal 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/storage-requests/approve (CONFIRMATION AVEC DATES ET DÉLAI DE BLOCAGE)
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/storage-requests/approve') {
        const body = await request.json().catch(() => ({}));
        const requestId = body.requestId;
        if (!requestId) {
          return new Response(JSON.stringify({ success: false, error: 'requestId requis' }), { status: 400, headers: corsHeaders(origin) });
        }

        const reqRow = await safeFirst(db, `SELECT * FROM storage_upgrade_requests WHERE id = ?`, [requestId]);
        if (!reqRow) {
          return new Response(JSON.stringify({ success: false, error: 'Demande introuvable' }), { status: 404, headers: corsHeaders(origin) });
        }

        const userId = reqRow.user_id;
        const addMb = Number(body.allocatedMb !== undefined ? body.allocatedMb : (reqRow.additional_mb || 1024));
        const pricePaid = Number(body.pricePaid !== undefined ? body.pricePaid : (reqRow.price_paid || 0));
        const startDate = body.startDate || new Date().toISOString();
        const endDate = body.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const gracePeriodDays = Number(body.gracePeriodDays || 5);

        // 1. Marquer la demande approuvée avec dates et délai configurés
        await safeRun(db, `
          UPDATE storage_upgrade_requests 
          SET status = 'approved', 
              confirmed_start_date = ?, 
              confirmed_end_date = ?, 
              grace_period_days = ?, 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `, [startDate, endDate, gracePeriodDays, requestId]);

        // 2. Allouer le stockage à l'utilisateur dans user_storage_quotas
        const currentQuota = await safeFirst(db, `SELECT * FROM user_storage_quotas WHERE user_id = ?`, [userId]);
        const currentPaid = currentQuota ? Number(currentQuota.paid_total_mb || 0) : 0;
        const isRenewalReq = (reqRow.request_type === 'renewal') || (reqRow.pack_name && reqRow.pack_name.toLowerCase().includes('renouvellement'));
        let newPaid = currentPaid + addMb;
        if (isRenewalReq && (body.allocatedMb === undefined || body.allocatedMb === 0)) {
          newPaid = currentPaid > 0 ? currentPaid : addMb;
        }
        const wTotal = currentQuota ? Number(currentQuota.welcome_total_mb || 30) : 30;

        await safeRun(db, `
          INSERT INTO user_storage_quotas (user_id, welcome_total_mb, welcome_r2_mb, welcome_d1_mb, paid_total_mb, paid_r2_mb, paid_d1_mb, plan_name, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'payant', CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET
            paid_total_mb = excluded.paid_total_mb,
            paid_r2_mb = excluded.paid_r2_mb,
            paid_d1_mb = excluded.paid_d1_mb,
            plan_name = 'payant',
            updated_at = CURRENT_TIMESTAMP
        `, [userId, wTotal, Math.round(wTotal/3), Math.round(wTotal*2/3), newPaid, Math.round(newPaid/2), Math.round(newPaid/2)]);

        // 3. Créer ou activer la souscription dans user_subscriptions
        const subId = 'sub_' + Math.random().toString(36).substring(2, 10);
        const subData = {
          id: subId,
          user_id: userId,
          user_name: reqRow.user_name || '',
          user_phone: reqRow.user_phone || '',
          user_email: reqRow.user_email || '',
          plan_name: reqRow.pack_name || 'Pack Stockage',
          total_storage_mb: wTotal + newPaid,
          monthly_price: pricePaid,
          currency: reqRow.currency || 'FCFA',
          status: 'active',
          start_date: startDate,
          end_date: endDate,
          grace_period_days: gracePeriodDays,
          request_id: requestId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // 3. Marquer les anciens abonnements actifs comme 'renewed'
        await safeRun(db, `
          UPDATE user_subscriptions 
          SET status = 'renewed', updated_at = CURRENT_TIMESTAMP 
          WHERE user_id = ? AND status = 'active'
        `, [userId]);

        await safeRun(db, `
          INSERT INTO user_subscriptions (id, user_id, user_name, user_phone, user_email, plan_name, total_storage_mb, monthly_price, currency, status, start_date, end_date, grace_period_days, request_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          subData.id, subData.user_id, subData.user_name, subData.user_phone, subData.user_email,
          subData.plan_name, subData.total_storage_mb, subData.monthly_price, subData.currency,
          subData.status, subData.start_date, subData.end_date, subData.grace_period_days,
          subData.request_id, subData.created_at, subData.updated_at
        ]);

        // 4. Enregistrer immédiatement l'achat dans user_purchases_history
        const purchaseId = 'PUR_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        try {
          await safeRun(db, `
            INSERT INTO user_purchases_history (
              id, user_id, user_name, user_phone, user_email, pack_name,
              storage_bought_mb, total_storage_mb, price_paid, currency,
              payment_method, payment_reference, billing_cycle, renewal_date,
              status, purchased_at, confirmed_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, CURRENT_TIMESTAMP)
          `, [
            purchaseId, userId, reqRow.user_name || '', reqRow.user_phone || '', reqRow.user_email || '',
            reqRow.pack_name || 'Pack Stockage', addMb, wTotal + newPaid, pricePaid, reqRow.currency || 'FCFA',
            reqRow.payment_method || 'Mobile Money', reqRow.payment_reference || reqRow.id || '',
            reqRow.billing_cycle || 'monthly', endDate, startDate, startDate
          ]);
        } catch (e) {}

        return new Response(JSON.stringify({
          success: true,
          requestId,
          userId,
          newPaidTotalMb: newPaid,
          subscription: subData,
          message: 'Abonnement confirmé et stockage alloué avec succès'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/storage-requests/reject
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/storage-requests/reject') {
        const body = await request.json().catch(() => ({}));
        const requestId = body.requestId;
        const reason = body.reason || 'Paiement non confirmé';
        if (!requestId) {
          return new Response(JSON.stringify({ success: false, error: 'requestId requis' }), { status: 400, headers: corsHeaders(origin) });
        }

        await safeRun(db, `UPDATE storage_upgrade_requests SET status = 'rejected', admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [reason, requestId]);

        return new Response(JSON.stringify({ success: true, requestId, message: 'Demande rejetée' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/ai-requests/approve (Validation & Attribution de Crédits IA)
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/ai-requests/approve') {
        const body = await request.json().catch(() => ({}));
        const requestId = body.requestId;
        const startDate = body.startDate || new Date().toISOString();
        const endDate = body.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const gracePeriodDays = Number(body.gracePeriodDays || 5);
        const allocatedWords = Number(body.allocatedWords || 100000);
        const pricePaid = Number(body.pricePaid || 0);

        if (!requestId) {
          return new Response(JSON.stringify({ success: false, error: 'requestId requis' }), { status: 400, headers: corsHeaders(origin) });
        }

        const reqRow = await safeFirst(db, `SELECT * FROM storage_upgrade_requests WHERE id = ?`, [requestId]);
        if (!reqRow) {
          return new Response(JSON.stringify({ success: false, error: 'Demande introuvable' }), { status: 404, headers: corsHeaders(origin) });
        }

        const userId = reqRow.user_id;

        // 1. Mettre à jour la demande dans storage_upgrade_requests
        await safeRun(db, `
          UPDATE storage_upgrade_requests 
          SET status = 'approved', 
              additional_words = ?,
              price_paid = ?,
              confirmed_start_date = ?, 
              confirmed_end_date = ?, 
              grace_period_days = ?, 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `, [allocatedWords, pricePaid, startDate, endDate, gracePeriodDays, requestId]);

        // 2. Allouer les crédits dans user_ai_credits
        await safeRun(db, `
          CREATE TABLE IF NOT EXISTS user_ai_credits (
            user_id TEXT PRIMARY KEY,
            total_credits REAL DEFAULT 0,
            remaining_credits REAL DEFAULT 0,
            used_credits REAL DEFAULT 0,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await safeRun(db, `
          INSERT INTO user_ai_credits (user_id, total_credits, remaining_credits, used_credits, updated_at)
          VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET
            total_credits = total_credits + excluded.total_credits,
            remaining_credits = remaining_credits + excluded.remaining_credits,
            updated_at = CURRENT_TIMESTAMP
        `, [userId, allocatedWords, allocatedWords]);

        // 3. Mettre à jour user_word_counts
        await safeRun(db, `
          INSERT INTO user_word_counts (id, user_id, word_count, token_count, updated_at)
          VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            word_count = word_count + excluded.word_count,
            updated_at = CURRENT_TIMESTAMP
        `, ['words_' + userId, userId, allocatedWords]);

        // 4. Créer ou activer la souscription dans user_subscriptions
        const subId = 'sub_ia_' + Math.random().toString(36).substring(2, 10);
        const subData = {
          id: subId,
          user_id: userId,
          user_name: reqRow.user_name || '',
          user_phone: reqRow.user_phone || reqRow.contact_phone || '',
          user_email: reqRow.user_email || '',
          plan_name: reqRow.pack_name || 'Pack IA',
          total_storage_mb: 0,
          monthly_price: pricePaid,
          currency: reqRow.currency || 'FCFA',
          status: 'active',
          start_date: startDate,
          end_date: endDate,
          grace_period_days: gracePeriodDays,
          request_id: requestId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Marquer les anciens abonnements IA actifs comme 'renewed'
        await safeRun(db, `
          UPDATE user_subscriptions 
          SET status = 'renewed', updated_at = CURRENT_TIMESTAMP 
          WHERE user_id = ? AND status = 'active' AND (plan_name LIKE '%ia%' OR plan_name LIKE '%mots%' OR plan_name LIKE '%credit%')
        `, [userId]);

        await safeRun(db, `
          INSERT INTO user_subscriptions (id, user_id, user_name, user_phone, user_email, plan_name, total_storage_mb, monthly_price, currency, status, start_date, end_date, grace_period_days, request_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          subData.id, subData.user_id, subData.user_name, subData.user_phone, subData.user_email,
          subData.plan_name, subData.total_storage_mb, subData.monthly_price, subData.currency,
          subData.status, subData.start_date, subData.end_date, subData.grace_period_days,
          subData.request_id, subData.created_at, subData.updated_at
        ]);

        // 5. Enregistrer l'achat dans user_purchases_history
        const purchaseId = 'PUR_IA_' + Math.random().toString(36).substring(2, 10).toUpperCase();
        try {
          await safeRun(db, `
            INSERT INTO user_purchases_history (
              id, user_id, user_name, user_phone, user_email, pack_name,
              additional_words, storage_bought_mb, total_storage_mb, price_paid, currency,
              payment_method, payment_reference, billing_cycle, renewal_date,
              status, purchased_at, confirmed_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, CURRENT_TIMESTAMP)
          `, [
            purchaseId, userId, reqRow.user_name || '', reqRow.user_phone || reqRow.contact_phone || '', reqRow.user_email || '',
            reqRow.pack_name || 'Pack IA', allocatedWords, pricePaid, reqRow.currency || 'FCFA',
            reqRow.payment_method || 'Mobile Money', reqRow.payment_reference || reqRow.id || '',
            reqRow.billing_cycle || 'monthly', endDate, startDate, startDate
          ]);
        } catch (e) {}

        return new Response(JSON.stringify({
          success: true,
          requestId,
          userId,
          allocatedWords,
          subscription: subData,
          message: 'Demande de crédits IA confirmée et allouée avec succès'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/ai-requests/reject (Rejet d'une demande de crédits IA)
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/ai-requests/reject') {
        const body = await request.json().catch(() => ({}));
        const requestId = body.requestId;
        const reason = body.reason || 'Paiement non confirmé';
        if (!requestId) {
          return new Response(JSON.stringify({ success: false, error: 'requestId requis' }), { status: 400, headers: corsHeaders(origin) });
        }

        await safeRun(db, `UPDATE storage_upgrade_requests SET status = 'rejected', admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [reason, requestId]);

        return new Response(JSON.stringify({ success: true, requestId, message: 'Demande IA rejetée' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/storage-requests/cancel-subscription
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/storage-requests/cancel-subscription') {
        const body = await request.json().catch(() => ({}));
        const subscriptionId = body.subscriptionId;
        const userId = body.userId;
        const reason = body.reason || 'Résiliation';

        if (!subscriptionId) {
          return new Response(JSON.stringify({ success: false, error: 'subscriptionId requis' }), { status: 400, headers: corsHeaders(origin) });
        }

        const subRow = await safeFirst(db, `SELECT * FROM user_subscriptions WHERE id = ?`, [subscriptionId]);
        const targetUserId = userId || (subRow ? subRow.user_id : null);

        const prevStorage = subRow ? Number(subRow.total_storage_mb || 0) : 0;

        await safeRun(db, `
          UPDATE user_subscriptions 
          SET status = 'cancelled', 
              cancelled_at = CURRENT_TIMESTAMP, 
              cancel_reason = ?, 
              previous_storage_mb = ?,
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `, [reason, prevStorage, subscriptionId]);

        // Retirer le quota payant si l'utilisateur est trouvé
        let newPaid = 0;
        if (targetUserId) {
          const quota = await safeFirst(db, `SELECT * FROM user_storage_quotas WHERE user_id = ?`, [targetUserId]);
          if (quota) {
            newPaid = Math.max(0, Number(quota.paid_total_mb || 0) - (subRow ? Number(subRow.total_storage_mb || 0) : 0));
            await safeRun(db, `UPDATE user_storage_quotas SET paid_total_mb = ?, plan_name = 'gratuit', updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [newPaid, targetUserId]);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          subscriptionId,
          previousStorageMb: prevStorage,
          newPaidTotalMb: newPaid,
          message: 'Abonnement résilié avec succès'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/storage-requests/delete (SUPPRESSION DÉFINITIVE D'UNE DEMANDE)
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/storage-requests/delete') {
        const body = await request.json().catch(() => ({}));
        const requestId = body.requestId;
        if (!requestId) {
          return new Response(JSON.stringify({ success: false, error: 'requestId requis' }), { status: 400, headers: corsHeaders(origin) });
        }

        await safeRun(db, `DELETE FROM storage_upgrade_requests WHERE id = ?`, [requestId]);
        return new Response(JSON.stringify({ success: true, message: 'Demande supprimée définitivement' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/users/toggle-online
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/users/toggle-online') {
        const body = await request.json().catch(() => ({}));
        const userId = body.userId;
        const setOnline = Boolean(body.isOnline);
        if (!userId) {
          return new Response(JSON.stringify({ success: false, error: 'userId requis' }), { status: 400, headers: corsHeaders(origin) });
        }
        if (setOnline) {
          await safeRun(db, `UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?`, [userId]);
          try {
            await safeRun(db, `INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, 'dashboard_admin', datetime('now', '+30 days'))`, ['sess_' + userId.slice(0, 8), userId]);
          } catch(e) {}
        } else {
          await safeRun(db, `UPDATE users SET last_active_at = datetime('now', '-2 hours') WHERE id = ?`, [userId]);
          try {
            await safeRun(db, `DELETE FROM auth_sessions WHERE user_id = ?`, [userId]);
          } catch(e) {}
        }
        return new Response(JSON.stringify({ success: true, userId, isOnline: setOnline, last_active_at: new Date().toISOString() }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // Configuration globale (compatible avec 'default' et 'global')
      let globalConfigRow = await safeFirst(db, `SELECT * FROM storage_global_config WHERE id = 'default' OR id = 'global' LIMIT 1`, [], null);
      if (!globalConfigRow) {
        globalConfigRow = {
          id: 'default',
          default_welcome_r2_mb: 10.0,
          default_welcome_d1_mb: 20.0,
          cost_per_gb_eur: 0.015,
          notes: ''
        };
      }

      // Récupération de tous les utilisateurs (sélection résiliente)
      let usersQuery = await safeQuery(db, `
        SELECT * 
        FROM users 
        ORDER BY created_at DESC
      `, [], null);

      if (!usersQuery || !usersQuery.results) {
        usersQuery = await safeQuery(db, `SELECT id, name, email FROM users`, [], { results: [] });
      }

      const rawUsers = usersQuery && usersQuery.results ? usersQuery.results : [];

      // Inspection pour chaque utilisateur
      const detailedUsers = [];
      for (const u of rawUsers) {
        const detail = await inspectUserStorageDetail(db, bucket, u, globalConfigRow);
        detailedUsers.push(detail);
      }

      // Inspection GLOBALE et DYNAMIQUE de TOUTES les tables D1 (actuelles et futures)
      const d1GlobalData = await inspectAllD1TablesGlobal(db);
      const tablesMeta = d1GlobalData.tablesMeta;
      const d1TablesGlobal = d1GlobalData.d1TablesGlobal;
      const globalD1Bytes = d1GlobalData.totalD1Bytes;
      const globalD1Rows = d1GlobalData.totalD1Rows;

      // Inspection GLOBALE et RÉELLE de TOUT le stockage R2 (fichiers de toute l'application)
      const r2GlobalData = await inspectRealR2Global(bucket, db, detailedUsers);
      const globalR2Bytes = r2GlobalData.totalR2Bytes;
      const globalR2Files = r2GlobalData.totalR2Files;
      const r2FoldersGlobal = r2GlobalData.r2FoldersGlobal;
      const r2Meta = r2GlobalData.r2Meta;

      // Synthèse globale RÉELLE de l'application entière
      const globalSummary = {
        totalUsers: rawUsers.length,
        totalStorageBytes: globalR2Bytes + globalD1Bytes,
        totalStorageFormatted: formatBytes(globalR2Bytes + globalD1Bytes),
        totalR2Bytes: globalR2Bytes,
        totalR2Formatted: formatBytes(globalR2Bytes),
        totalR2Files: globalR2Files,
        totalD1Bytes: globalD1Bytes,
        totalD1Formatted: formatBytes(globalD1Bytes),
        totalD1Rows: globalD1Rows,
        cloudflareR2FreeQuota: '10 Go (10737418240 Octets)',
        cloudflareD1FreeQuota: '5 Go (5368709120 Octets)',
        estimatedCostUsd: '0.00 $ (Inclus dans les quotas gratuits)'
      };

      // ----------------------------------------------------------------------
      // ROUTE API : /api/overview
      // ----------------------------------------------------------------------
      if (path === '/api/overview') {
        return new Response(JSON.stringify({ 
          success: true, 
          summary: globalSummary,
          globalConfig: globalConfigRow,
          d1Tables: d1TablesGlobal,
          r2Folders: r2FoldersGlobal,
          tablesMeta,
          r2Meta,
          timestamp: new Date().toISOString()
        }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE API : /api/users
      // ----------------------------------------------------------------------
      if (path === '/api/users' || path === '/api/storage/users') {
        return new Response(JSON.stringify({ 
          success: true, 
          summary: globalSummary, 
          globalConfig: globalConfigRow,
          users: detailedUsers 
        }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/company-profile/update
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/company-profile/update') {
        const body = await request.json().catch(() => ({}));
        const allowedCols = [
          'company_name', 'activity', 'location', 'address', 'website', 'email',
          'phone_contact', 'phone_whatsapp', 'phone_contact_secondary', 'about_text',
          'wave_number', 'wave_name', 'wave_enabled', 'wave_show_number', 'wave_show_image', 'wave_image_url',
          'orange_number', 'orange_name', 'orange_enabled', 'orange_show_number', 'orange_show_image', 'orange_image_url',
          'mtn_number', 'mtn_name', 'mtn_enabled', 'mtn_show_number', 'mtn_show_image', 'mtn_image_url',
          'moov_number', 'moov_name', 'moov_enabled', 'moov_show_number', 'moov_show_image', 'moov_image_url',
          'payment_instructions', 'notes'
        ];

        // S'assurer que les tables et colonnes existent
        await ensureStorageTables(db);

        // S'assurer que la ligne 'main' existe
        await safeRun(db, `
          INSERT OR IGNORE INTO company_profile (id) VALUES ('main')
        `);

        if (body.field && allowedCols.includes(body.field)) {
          // Mise à jour individuelle ciblée sans toucher aux autres champs
          const colName = body.field;
          const colValue = (typeof body.value === 'number') ? body.value : String(body.value ?? '');
          await safeRun(db, `
            UPDATE company_profile 
            SET ${colName} = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = 'main'
          `, [colValue]);
        } else {
          // Mise à jour multiple (uniquement pour les champs explicitement passés)
          const updates = [];
          const values = [];
          for (const col of allowedCols) {
            if (body[col] !== undefined) {
              updates.push(`${col} = ?`);
              const v = (typeof body[col] === 'number') ? body[col] : String(body[col] ?? '');
              values.push(v);
            }
          }
          if (updates.length > 0) {
            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            await safeRun(db, `
              UPDATE company_profile SET ${updates.join(', ')} WHERE id = 'main'
            `, values);
          }
        }

        const updatedProfile = await safeFirst(db, `SELECT * FROM company_profile WHERE id = 'main'`);

        return new Response(JSON.stringify({
          success: true,
          message: 'Informations professionnelles enregistrées avec succès',
          profile: updatedProfile
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/company-profile/upload-payment-image (Stockage R2)
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/company-profile/upload-payment-image') {
        if (!db) {
          return new Response(JSON.stringify({ success: false, message: 'Base de données D1 indisponible' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
                const body = await request.json().catch(() => ({}));
        const network = (body.network || '').toLowerCase().trim();
        if (!['wave', 'orange', 'mtn', 'moov'].includes(network)) {
          return new Response(JSON.stringify({ success: false, message: 'Réseau de paiement invalide (wave, orange, mtn, moov)' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }

        const rawData = body.image || '';
        if (!rawData) {
          return new Response(JSON.stringify({ success: false, message: 'Image manquante' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }

        let imageUrl = rawData;
        const ext = (body.ext || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
        const r2Key = `payment-methods/${network}_merchant_${Date.now()}.${ext}`;

        // Si le bucket Cloudflare R2 est disponible, stocker le binaire physiquement dans R2
        if (bucket && rawData.startsWith('data:')) {
          try {
            const parts = rawData.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
            const base64Data = parts[1];
            const binaryString = atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            await bucket.put(r2Key, bytes, {
              httpMetadata: { contentType: mimeType }
            });

            const workerOrigin = (url && url.origin) ? url.origin : 'https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev';
            imageUrl = `${workerOrigin}/api/payment-methods/image/${encodeURIComponent(r2Key)}`;
          } catch (r2Err) {
            console.warn('[R2 Upload Error Fallback base64]:', r2Err);
            imageUrl = rawData;
          }
        }

        // Sauvegarder l'URL ou dataUrl dans D1
        const fieldName = `${network}_image_url`;
        await safeRun(db, `UPDATE company_profile SET ${fieldName} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'main'`, [imageUrl]);

        return new Response(JSON.stringify({ 
          success: true, 
          url: imageUrl, 
          key: r2Key,
          message: 'Carte commerçant / QR enregistré avec succès dans R2' 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE GET : /api/payment-methods/image/:key (Stream depuis R2)
      // ----------------------------------------------------------------------
      if (request.method === 'GET' && path.startsWith('/api/payment-methods/image/')) {
        const key = decodeURIComponent(path.replace('/api/payment-methods/image/', ''));
        if (bucket && key) {
          try {
            const object = await bucket.get(key);
            if (object) {
              const headers = new Headers();
              object.writeHttpMetadata(headers);
              headers.set('etag', object.httpEtag);
              headers.set('Cache-Control', 'public, max-age=31536000, immutable');
              headers.set('Access-Control-Allow-Origin', origin);
              return new Response(object.body, { headers });
            }
          } catch (e) {}
        }
        return new Response(JSON.stringify({ error: 'Image de paiement introuvable dans R2' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE GET : /api/company-profile
      // ----------------------------------------------------------------------
      if (path === '/api/company-profile') {
        await ensureStorageTables(db);
        let profile = await safeFirst(db, `SELECT * FROM company_profile WHERE id = 'main'`);
        if (!profile) {
          profile = {
            id: 'main',
            company_name: 'DKD Technologies',
            activity: 'Technologies & Éducation Numérique',
            location: 'Abidjan, Côte d\'Ivoire',
            address: 'Abidjan, Côte d\'Ivoire',
            phone_contact: '+225 0101007978',
            phone_contact_secondary: '',
            phone_whatsapp: '+225 0101007978',
            email: 'contact@dkd-technologies.com',
            website: 'https://studycloud.dkd-technologies.com',
            wave_number: '+225 07 00 00 00 00',
            wave_name: 'StudyCloud CI',
            wave_enabled: 1,
            wave_show_number: 1,
            wave_show_image: 1,
            wave_image_url: '',
            orange_number: '+225 07 00 00 00 00',
            orange_name: 'Orange Money Côte d\'Ivoire',
            orange_enabled: 1,
            orange_show_number: 1,
            orange_show_image: 1,
            orange_image_url: '',
            mtn_number: '+225 05 00 00 00 00',
            mtn_name: 'MTN Mobile Money CI',
            mtn_enabled: 1,
            mtn_show_number: 1,
            mtn_show_image: 1,
            mtn_image_url: '',
            moov_number: '+225 01 00 00 00 00',
            moov_name: 'Moov Money Côte d\'Ivoire',
            moov_enabled: 1,
            moov_show_number: 1,
            moov_show_image: 1,
            moov_image_url: '',
            payment_instructions: 'Transférez le montant exact sur l\'un de nos numéros officiels ci-dessous, puis importez une capture claire de votre reçu affichant la date et le numéro de transaction.',
            about_text: 'Plateforme d\'apprentissage et de gestion documentaire intelligente pour étudiants et professionnels.',
            notes: ''
          };
        } else {
          if (!profile.mtn_name || profile.mtn_name === 'Paiement Mobile National' || profile.mtn_name.includes('Moov')) {
            profile.mtn_name = 'MTN Mobile Money CI';
          }
          if (!profile.moov_number) {
            profile.moov_number = '+225 01 00 00 00 00';
          }
          if (!profile.moov_name) {
            profile.moov_name = "Moov Money Côte d'Ivoire";
          }
          if (profile.wave_enabled === undefined || profile.wave_enabled === null) profile.wave_enabled = 1;
          if (profile.wave_show_number === undefined || profile.wave_show_number === null) profile.wave_show_number = 1;
          if (profile.wave_show_image === undefined || profile.wave_show_image === null) profile.wave_show_image = 1;
          if (profile.orange_enabled === undefined || profile.orange_enabled === null) profile.orange_enabled = 1;
          if (profile.orange_show_number === undefined || profile.orange_show_number === null) profile.orange_show_number = 1;
          if (profile.orange_show_image === undefined || profile.orange_show_image === null) profile.orange_show_image = 1;
          if (profile.mtn_enabled === undefined || profile.mtn_enabled === null) profile.mtn_enabled = 1;
          if (profile.mtn_show_number === undefined || profile.mtn_show_number === null) profile.mtn_show_number = 1;
          if (profile.mtn_show_image === undefined || profile.mtn_show_image === null) profile.mtn_show_image = 1;
          if (profile.moov_enabled === undefined || profile.moov_enabled === null) profile.moov_enabled = 1;
          if (profile.moov_show_number === undefined || profile.moov_show_number === null) profile.moov_show_number = 1;
          if (profile.moov_show_image === undefined || profile.moov_show_image === null) profile.moov_show_image = 1;
        }
        return new Response(JSON.stringify({ success: true, profile }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE GET : /api/subscription-plans (Plans de stockage et IA)
      // ----------------------------------------------------------------------
      if (request.method === 'GET' && path === '/api/subscription-plans') {
                const onlyActive = url.searchParams.get('active_only') === '1';
        const storageQuery = onlyActive 
          ? "SELECT * FROM storage_subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC"
          : "SELECT * FROM storage_subscription_plans ORDER BY sort_order ASC, created_at ASC";
        const aiQuery = onlyActive
          ? "SELECT * FROM ai_subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC"
          : "SELECT * FROM ai_subscription_plans ORDER BY sort_order ASC, created_at ASC";

        const storageRes = await safeQuery(db, storageQuery, [], { results: [] });
        let aiRes = await safeQuery(db, aiQuery, [], { results: [] });
        // Initialiser avec la carte créée par l'administrateur si la table est vide
        if (!aiRes || !aiRes.results || aiRes.results.length === 0) {
          try {
            await db.prepare(`
              INSERT OR IGNORE INTO ai_subscription_plans (
                id, name, badge, description, credits_or_words, credits_count, price, primary_currency,
                currencies_enabled, currency_conversions, yearly_price, yearly_discount_pct, features,
                is_auto_billing, is_active, sort_order, pricing_model
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              'ai_card_basique', 'BASIQUE', '', 'Pour les particuliers et petites équipes qui débutent.',
              '100 000 crédits IA', 100000, 1000, 'XOF',
              '["USD","XOF","EUR"]', '{"XOF":1000,"USD":1.54,"EUR":1.52}', 1000, 0,
              '[{"text":"100 000 crédits IA","enabled":true},{"text":"Résumés automatiques de cours et PDF","enabled":true},{"text":"Explications interactives avec l\'\'assistante IA","enabled":true},{"text":"Génération de quiz et flashcards personnalisés","enabled":true},{"text":"Support prioritaire et réponses instantanées","enabled":true}]',
              0, 1, 1, 'one_time'
            ).run();
            const recheckAi = await safeQuery(db, "SELECT * FROM ai_subscription_plans ORDER BY sort_order ASC, created_at ASC", [], { results: [] });
            if (recheckAi && recheckAi.results && recheckAi.results.length > 0) {
              aiRes = recheckAi;
            }
          } catch (e) {}
        }


        return new Response(JSON.stringify({
          success: true,
          storagePlans: (storageRes && storageRes.results) ? storageRes.results : [],
          aiPlans: (aiRes && aiRes.results) ? aiRes.results : []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/subscription-plans/save
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/subscription-plans/save') {
        if (!db) {
          return new Response(JSON.stringify({ success: false, error: 'Base de données D1 indisponible' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
                const body = await request.json().catch(() => ({}));
        const category = body.category === 'ai' ? 'ai' : 'storage';
        const plan = body.plan || {};

        const planId = String(plan.id || ((category === 'ai' ? 'ai_card_' : 'storage_card_') + Date.now() + '_' + Math.random().toString(36).substring(2, 6))).trim();
        const name = String(plan.name || 'Nouveau Forfait').trim();
        const badge = String(plan.badge || '').trim();
        const description = String(plan.description || '').trim();
        const price = Number(plan.price) || 0;
        const primaryCurrency = String(plan.primary_currency || 'USD').trim();
        const currenciesEnabled = typeof plan.currencies_enabled === 'string' ? plan.currencies_enabled : JSON.stringify(plan.currencies_enabled || ['USD', 'XOF', 'EUR']);
        const currencyConversions = typeof plan.currency_conversions === 'string' ? plan.currency_conversions : JSON.stringify(plan.currency_conversions || {});
        const yearlyPrice = Number(plan.yearly_price) || 0;
        const yearlyDiscountPct = Number(plan.yearly_discount_pct) || 10;
        const features = typeof plan.features === 'string' ? plan.features : JSON.stringify(plan.features || []);
        const isAutoBilling = plan.is_auto_billing ? 1 : 0;
        const isActive = plan.is_active !== undefined ? (plan.is_active ? 1 : 0) : 1;
        const sortOrder = Number(plan.sort_order) || 1;

        if (category === 'ai') {
          const creditsOrWords = String(plan.credits_or_words || '100 000 crédits IA').trim();
          const creditsCount = Number(plan.credits_count) || 100000;
          const pricingModel = String(plan.pricing_model || 'subscription').trim();
          await db.prepare(`
            INSERT INTO ai_subscription_plans (
              id, name, badge, description, credits_or_words, credits_count, price, primary_currency,
              currencies_enabled, currency_conversions, yearly_price, yearly_discount_pct, features,
              is_auto_billing, is_active, sort_order, pricing_model, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              badge = excluded.badge,
              description = excluded.description,
              credits_or_words = excluded.credits_or_words,
              credits_count = excluded.credits_count,
              price = excluded.price,
              primary_currency = excluded.primary_currency,
              currencies_enabled = excluded.currencies_enabled,
              currency_conversions = excluded.currency_conversions,
              yearly_price = excluded.yearly_price,
              yearly_discount_pct = excluded.yearly_discount_pct,
              features = excluded.features,
              is_auto_billing = excluded.is_auto_billing,
              is_active = excluded.is_active,
              sort_order = excluded.sort_order,
              pricing_model = excluded.pricing_model,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            planId, name, badge, description, creditsOrWords, creditsCount, price, primaryCurrency,
            currenciesEnabled, currencyConversions, yearlyPrice, yearlyDiscountPct, features,
            isAutoBilling, isActive, sortOrder, pricingModel
          ).run();

          const updatedPlan = await db.prepare("SELECT * FROM ai_subscription_plans WHERE id = ?").bind(planId).first();
          return new Response(JSON.stringify({ success: true, plan: updatedPlan }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        } else {
          const storageAmount = String(plan.storage_amount || '10 Go').trim();
          const storageMb = Number(plan.storage_mb) || 10240;
          await db.prepare(`
            INSERT INTO storage_subscription_plans (
              id, name, badge, description, storage_amount, storage_mb, price, primary_currency,
              currencies_enabled, currency_conversions, yearly_price, yearly_discount_pct, features,
              is_auto_billing, is_active, sort_order, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              badge = excluded.badge,
              description = excluded.description,
              storage_amount = excluded.storage_amount,
              storage_mb = excluded.storage_mb,
              price = excluded.price,
              primary_currency = excluded.primary_currency,
              currencies_enabled = excluded.currencies_enabled,
              currency_conversions = excluded.currency_conversions,
              yearly_price = excluded.yearly_price,
              yearly_discount_pct = excluded.yearly_discount_pct,
              features = excluded.features,
              is_auto_billing = excluded.is_auto_billing,
              is_active = excluded.is_active,
              sort_order = excluded.sort_order,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            planId, name, badge, description, storageAmount, storageMb, price, primaryCurrency,
            currenciesEnabled, currencyConversions, yearlyPrice, yearlyDiscountPct, features,
            isAutoBilling, isActive, sortOrder
          ).run();

          const updatedPlan = await db.prepare("SELECT * FROM storage_subscription_plans WHERE id = ?").bind(planId).first();
          return new Response(JSON.stringify({ success: true, plan: updatedPlan }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/subscription-plans/delete
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/subscription-plans/delete') {
        if (!db) {
          return new Response(JSON.stringify({ success: false, error: 'Base de données D1 indisponible' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
                const body = await request.json().catch(() => ({}));
        const category = body.category === 'ai' ? 'ai' : 'storage';
        const planId = String(body.id || '').trim();
        const tableName = category === 'ai' ? 'ai_subscription_plans' : 'storage_subscription_plans';

        await db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).bind(planId).run();
        return new Response(JSON.stringify({ success: true, id: planId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/subscription-plans/toggle-active
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/subscription-plans/toggle-active') {
        if (!db) {
          return new Response(JSON.stringify({ success: false, error: 'Base de données D1 indisponible' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
                const body = await request.json().catch(() => ({}));
        const category = body.category === 'ai' ? 'ai' : 'storage';
        const planId = String(body.id || '').trim();
        const tableName = category === 'ai' ? 'ai_subscription_plans' : 'storage_subscription_plans';

        if (body.is_active !== undefined) {
          const newVal = body.is_active ? 1 : 0;
          await db.prepare(`UPDATE ${tableName} SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(newVal, planId).run();
        } else {
          await db.prepare(`UPDATE ${tableName} SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(planId).run();
        }
        const row = await db.prepare(`SELECT is_active FROM ${tableName} WHERE id = ?`).bind(planId).first();
        return new Response(JSON.stringify({ success: true, is_active: row ? row.is_active : 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/subscription-plans/toggle-auto-billing
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/subscription-plans/toggle-auto-billing') {
        if (!db) {
          return new Response(JSON.stringify({ success: false, error: 'Base de données D1 indisponible' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
                const body = await request.json().catch(() => ({}));
        const category = body.category === 'ai' ? 'ai' : 'storage';
        const planId = String(body.id || '').trim();
        const tableName = category === 'ai' ? 'ai_subscription_plans' : 'storage_subscription_plans';

        if (body.is_auto_billing !== undefined) {
          const newVal = body.is_auto_billing ? 1 : 0;
          await db.prepare(`UPDATE ${tableName} SET is_auto_billing = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(newVal, planId).run();
        } else {
          await db.prepare(`UPDATE ${tableName} SET is_auto_billing = CASE WHEN is_auto_billing = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(planId).run();
        }
        const row = await db.prepare(`SELECT is_auto_billing FROM ${tableName} WHERE id = ?`).bind(planId).first();
        return new Response(JSON.stringify({ success: true, is_auto_billing: row ? row.is_auto_billing : 0 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/subscription-plans/update-badge
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && path === '/api/subscription-plans/update-badge') {
        if (!db) {
          return new Response(JSON.stringify({ success: false, error: 'Base de données D1 indisponible' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
                const body = await request.json().catch(() => ({}));
        const category = body.category === 'ai' ? 'ai' : 'storage';
        const planId = String(body.id || '').trim();
        const badge = String(body.badge || '').trim();
        const tableName = category === 'ai' ? 'ai_subscription_plans' : 'storage_subscription_plans';

        await db.prepare(`UPDATE ${tableName} SET badge = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(badge, planId).run();
        return new Response(JSON.stringify({ success: true, id: planId, badge }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // REQUÊTES D1 : DEMANDES DE STOCKAGE & ABONNEMENTS
      // ----------------------------------------------------------------------
      let upgradeRequestsRes = await safeQuery(db, `SELECT * FROM storage_upgrade_requests ORDER BY created_at DESC`, [], { results: [] });
      let userSubsRes = await safeQuery(db, `SELECT * FROM user_subscriptions ORDER BY created_at DESC`, [], { results: [] });
      let companyProfileRow = await safeFirst(db, `SELECT * FROM company_profile WHERE id = 'main'`);
      if (!companyProfileRow) {
        companyProfileRow = {
          id: 'main',
          company_name: 'DKD Technologies',
          activity: 'Technologies & Éducation Numérique',
          location: 'Abidjan, Côte d\'Ivoire',
          address: 'Abidjan, Côte d\'Ivoire',
          phone_contact: '+225 0101007978',
          phone_contact_secondary: '',
          phone_whatsapp: '+225 0101007978',
          email: 'contact@dkd-technologies.com',
          website: 'https://studycloud.dkd-technologies.com',
          wave_number: '+225 07 00 00 00 00',
          wave_name: 'StudyCloud CI',
          wave_enabled: 1,
          wave_show_number: 1,
          wave_show_image: 1,
          wave_image_url: '',
          orange_number: '+225 07 00 00 00 00',
          orange_name: 'Orange Money Côte d\'Ivoire',
          orange_enabled: 1,
          orange_show_number: 1,
          orange_show_image: 1,
          orange_image_url: '',
          mtn_number: '+225 05 00 00 00 00',
          mtn_name: 'MTN Mobile Money CI',
          mtn_enabled: 1,
          mtn_show_number: 1,
          mtn_show_image: 1,
          mtn_image_url: '',
          moov_number: '+225 01 00 00 00 00',
          moov_name: 'Moov Money Côte d\'Ivoire',
          moov_enabled: 1,
          moov_show_number: 1,
          moov_show_image: 1,
          moov_image_url: '',
          payment_instructions: 'Transférez le montant exact sur l\'un de nos numéros officiels ci-dessous, puis importez une capture claire de votre reçu avec la date et le numéro de transaction.',
          about_text: 'Plateforme d\'apprentissage et de gestion documentaire intelligente pour étudiants et professionnels.',
          notes: ''
        };
      } else {
        if (!companyProfileRow.mtn_name || companyProfileRow.mtn_name === 'Paiement Mobile National' || companyProfileRow.mtn_name.includes('Moov')) {
          companyProfileRow.mtn_name = 'MTN Mobile Money CI';
        }
        if (!companyProfileRow.moov_number) {
          companyProfileRow.moov_number = '+225 01 00 00 00 00';
        }
        if (!companyProfileRow.moov_name) {
          companyProfileRow.moov_name = "Moov Money Côte d'Ivoire";
        }
        if (companyProfileRow.wave_enabled === undefined || companyProfileRow.wave_enabled === null) companyProfileRow.wave_enabled = 1;
        if (companyProfileRow.wave_show_number === undefined || companyProfileRow.wave_show_number === null) companyProfileRow.wave_show_number = 1;
        if (companyProfileRow.wave_show_image === undefined || companyProfileRow.wave_show_image === null) companyProfileRow.wave_show_image = 1;
        if (companyProfileRow.orange_enabled === undefined || companyProfileRow.orange_enabled === null) companyProfileRow.orange_enabled = 1;
        if (companyProfileRow.orange_show_number === undefined || companyProfileRow.orange_show_number === null) companyProfileRow.orange_show_number = 1;
        if (companyProfileRow.orange_show_image === undefined || companyProfileRow.orange_show_image === null) companyProfileRow.orange_show_image = 1;
        if (companyProfileRow.mtn_enabled === undefined || companyProfileRow.mtn_enabled === null) companyProfileRow.mtn_enabled = 1;
        if (companyProfileRow.mtn_show_number === undefined || companyProfileRow.mtn_show_number === null) companyProfileRow.mtn_show_number = 1;
        if (companyProfileRow.mtn_show_image === undefined || companyProfileRow.mtn_show_image === null) companyProfileRow.mtn_show_image = 1;
        if (companyProfileRow.moov_enabled === undefined || companyProfileRow.moov_enabled === null) companyProfileRow.moov_enabled = 1;
        if (companyProfileRow.moov_show_number === undefined || companyProfileRow.moov_show_number === null) companyProfileRow.moov_show_number = 1;
        if (companyProfileRow.moov_show_image === undefined || companyProfileRow.moov_show_image === null) companyProfileRow.moov_show_image = 1;
      }

      const rawUpgradeRequests = (upgradeRequestsRes && upgradeRequestsRes.results) ? upgradeRequestsRes.results : [];
      const rawUserSubs = (userSubsRes && userSubsRes.results) ? userSubsRes.results : [];

      let storagePlansRes = { results: [] };
      let aiPlansRes = { results: [] };
      try {
        storagePlansRes = await db.prepare("SELECT * FROM storage_subscription_plans ORDER BY sort_order ASC, created_at ASC").all();
      } catch (e) {}
      try {
        aiPlansRes = await db.prepare("SELECT * FROM ai_subscription_plans ORDER BY sort_order ASC, created_at ASC").all();
      } catch (e) {}

      if (!aiPlansRes || !aiPlansRes.results || aiPlansRes.results.length === 0) {
        try {
          const recheck = await db.prepare("SELECT * FROM ai_subscription_plans ORDER BY sort_order ASC, created_at ASC").all();
          if (recheck && recheck.results && recheck.results.length > 0) {
            aiPlansRes = recheck;
          }
        } catch (e) {}
      }


      // ----------------------------------------------------------------------
      // GARDE 404 JSON : TOUTE REQUÊTE /api/* NON RECONNUE DOIT RENVOYER DU JSON ET JAMAIS DU HTML
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/')) {
        return new Response(JSON.stringify({ success: false, error: `Route API introuvable: ${request.method} ${path}` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE PAR DÉFAUT : Page Web Tableau de Bord (HTML)
      // ----------------------------------------------------------------------
      const htmlContent = renderDashboardHtml({
        summary: globalSummary,
        globalConfig: globalConfigRow,
        users: detailedUsers,
        d1TablesGlobal,
        r2FoldersGlobal,
        tablesMeta,
        r2Meta,
        upgradeRequests: rawUpgradeRequests,
        userSubscriptions: rawUserSubs,
        companyProfile: companyProfileRow,
        storagePlans: (storagePlansRes && storagePlansRes.results) ? storagePlansRes.results : [],
        aiPlans: (aiPlansRes && aiPlansRes.results) ? aiPlansRes.results : []
      });

      return new Response(htmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });

    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Erreur interne du Worker Tableau de Bord',
          stack: error.stack
        }, null, 2),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        }
      );
    }
  }
};

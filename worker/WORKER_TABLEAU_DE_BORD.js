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

function getStorageBindings(env) {
  const db = env.MON_D1_STUDYCLOUD || env['MON_D1-STUDYCLOUD'] || env.DB || env.d1;
  const bucket = env.MON_R2_STUDYCLOUD || env['MON_R2-STUDYCLOUD'] || env.BUCKET || env.r2;
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
async function ensureStorageTables(db) {
  if (!db) return;
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
  const shopName = shopProfile?.shop_name || (hasShop ? 'Boutique active' : '');

  // 16. STATUT DE CONNEXION / EN LIGNE
  const activeSession = await safeFirst(db, `
    SELECT * FROM auth_sessions 
    WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP 
    ORDER BY created_at DESC LIMIT 1
  `, [userId]);

  let isOnline = false;
  let lastSeenText = "Non connecté récemment";
  if (user.last_active_at) {
    const lastActiveTime = new Date(user.last_active_at).getTime();
    const now = Date.now();
    const diffMinutes = Math.floor((now - lastActiveTime) / 60000);
    if (!isNaN(diffMinutes) && diffMinutes >= 0) {
      if (diffMinutes <= 15) {
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
      shopName
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
  const results = {};
  for (const item of TABLES_METADATA) {
    const tableName = item.table;
    try {
      const row = await safeFirst(db, `SELECT COUNT(*) as count FROM ${tableName}`, [], { count: 0 });
      const count = row ? (row.count || 0) : 0;
      
      let avgBytesPerRow = 150;
      if (tableName === 'ai_generated_contents' || tableName === 'user_ai_workspace') avgBytesPerRow = 2800;
      else if (tableName === 'published_documents' || tableName === 'files') avgBytesPerRow = 350;
      else if (tableName === 'notes') avgBytesPerRow = 600;

      const totalBytes = count * avgBytesPerRow;
      results[tableName] = {
        count,
        bytes: totalBytes,
        formatted: formatBytes(totalBytes)
      };
    } catch (e) {
      results[tableName] = { count: 0, bytes: 0, formatted: '0 Octets' };
    }
  }
  return results;
}

async function inspectAllR2FoldersGlobal(db, detailedUsers) {
  let userFilesBytes = 0; let userFilesCount = 0;
  let aiStudiesBytes = 0; let aiStudiesCount = 0;
  let pubFilesBytes = 0; let pubFilesCount = 0;
  let shareFilesBytes = 0; let shareFilesCount = 0;
  let avatarsBytes = 0; let avatarsCount = 0;
  let productImagesBytes = 0; let productImagesCount = 0;

  for (const u of detailedUsers) {
    const r2f = u.storage.r2.folders;
    userFilesBytes += r2f['user-files/'].bytes || 0;
    userFilesCount += r2f['user-files/'].count || 0;

    aiStudiesBytes += r2f['ai-studies/'].bytes || 0;
    aiStudiesCount += r2f['ai-studies/'].count || 0;

    pubFilesBytes += r2f['published/files/'].bytes || 0;
    pubFilesCount += r2f['published/files/'].count || 0;

    shareFilesBytes += r2f['shared-links/files/'].bytes || 0;
    shareFilesCount += r2f['shared-links/files/'].count || 0;

    avatarsBytes += r2f['avatars/'].bytes || 0;
    avatarsCount += r2f['avatars/'].count || 0;

    productImagesBytes += r2f['products/images/'].bytes || 0;
    productImagesCount += r2f['products/images/'].count || 0;
  }

  return {
    'user-files/': { count: userFilesCount, bytes: userFilesBytes, formatted: formatBytes(userFilesBytes) },
    'ai-studies/': { count: aiStudiesCount, bytes: aiStudiesBytes, formatted: formatBytes(aiStudiesBytes) },
    'published/files/': { count: pubFilesCount, bytes: pubFilesBytes, formatted: formatBytes(pubFilesBytes) },
    'shared-links/files/': { count: shareFilesCount, bytes: shareFilesBytes, formatted: formatBytes(shareFilesBytes) },
    'products/images/': { count: productImagesCount, bytes: productImagesBytes, formatted: formatBytes(productImagesBytes) },
    'avatars/': { count: avatarsCount, bytes: avatarsBytes, formatted: formatBytes(avatarsBytes) }
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
  const tablesMetaJson = JSON.stringify(TABLES_METADATA).replace(/</g, '\\u003c');
  const r2MetaJson = JSON.stringify(R2_FOLDERS_METADATA).replace(/</g, '\\u003c');

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
      transform: translateX(0);
    }
    /* Scrollbars confortables et visibles */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #070b14; }
    ::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #f97316; }
    * { scrollbar-width: thin; scrollbar-color: #374151 #070b14; }
    html { scroll-behavior: smooth; }
  </style>
</head>
<body class="bg-[#070b14] text-slate-100 min-h-screen antialiased flex flex-col selection:bg-orange-500 selection:text-white">

  <!-- ==================================================================== -->
  <!-- BARRE SUPÉRIEURE DE NAVIGATION (STICKY ET TOUJOURS ACCESSIBLE) -->
  <!-- ==================================================================== -->
  <header class="sticky top-0 h-[60px] bg-[#0c1220]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
    <div class="flex items-center gap-3">
      <!-- Bouton 3 traits (Menu Hamburger) -->
      <button 
        onclick="toggleSidebar()"
        class="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
        title="Ouvrir le menu latéral"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <button onclick="window.location.reload()" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer">
        <span>🔄</span> <span class="hidden sm:inline">Actualiser</span>
      </button>
      <a href="/api/overview" target="_blank" class="px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white transition-all shadow-md shadow-orange-600/30 flex items-center gap-1.5">
        <span>📡</span> <span class="hidden sm:inline">API JSON</span>
      </a>
    </div>
  </header>

  <!-- ==================================================================== -->
  <!-- MENU LATÉRAL GAUCHE FLUIDE (DRAWER) -->
  <!-- ==================================================================== -->
  <div id="sidebar-backdrop" onclick="toggleSidebar()" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm hidden transition-opacity"></div>
  
  <aside id="sidebar-drawer" class="sidebar-drawer fixed top-0 left-0 bottom-0 z-50 w-72 sm:w-80 bg-[#0f172a] border-r border-slate-800 flex flex-col shadow-2xl">
    <div class="p-4 border-b border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-black text-sm">
          SC
        </div>
        <span class="font-extrabold text-white text-sm">Menu d'Administration</span>
      </div>
      <button onclick="toggleSidebar()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center cursor-pointer">
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
        <span class="text-base">💾</span>
        <span>Demande de stockage</span>
      </button>

      <button 
        onclick="switchView('messages')" 
        id="nav-btn-messages"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left cursor-pointer"
      >
        <span class="text-base">💬</span>
        <span>Messages des utilisateurs</span>
      </button>
    </nav>

    <div class="p-3.5 border-t border-slate-800 text-[11px] text-slate-500">
      StudyCloud • DKD Technologies
    </div>
  </aside>

  <!-- ==================================================================== -->
  <!-- ZONE PRINCIPALE DE CONTENU SANS ESPACE VIDE ET PARFAITEMENT SCROLLABLE -->
  <!-- ==================================================================== -->
  <main class="flex-1 w-full max-w-[1700px] mx-auto p-3 sm:p-5 flex flex-col min-h-0">

    <!-- ================================================================== -->
    <!-- VUE 1 : ACCUEIL / VUE D'ENSEMBLE GLOBALE (DÉFILEMENT NATUREL) -->
    <!-- ================================================================== -->
    <div id="view-global" class="w-full space-y-5 pb-12">

      <!-- 4 CARRÉS EN HAUT : STATISTIQUES GLOBALES -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        
        <div class="neo-card p-3.5 sm:p-4 flex flex-col justify-between border-l-4 border-l-blue-500">
          <div class="flex items-center justify-between text-slate-400 text-[11px] font-bold mb-1">
            <span>UTILISATEURS</span>
            <span class="text-sm">👥</span>
          </div>
          <div>
            <div class="text-xl sm:text-2xl font-black text-white">${data.summary.totalUsers}</div>
            <div class="text-[10px] text-blue-400 mt-0.5 font-medium">Comptes enregistrés dans D1</div>
          </div>
        </div>

        <div class="neo-card p-3.5 sm:p-4 flex flex-col justify-between border-l-4 border-l-orange-500">
          <div class="flex items-center justify-between text-slate-400 text-[11px] font-bold mb-1">
            <span>VOLUME R2 (FICHIERS)</span>
            <span class="text-sm">📦</span>
          </div>
          <div>
            <div class="text-xl sm:text-2xl font-black text-orange-400">${data.summary.totalR2Formatted}</div>
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
            <div class="text-xl sm:text-2xl font-black text-emerald-400">${data.summary.totalD1Formatted}</div>
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
        <h3 class="text-xs font-bold text-white flex items-center gap-1.5">
          <span>📈</span> Progression de la Consommation Réelle de l'Application
        </h3>

        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">1. Consommation Globale (R2 + D1 combiné)</span>
            <span class="font-mono text-orange-400 font-bold">${data.summary.totalStorageFormatted} / 15 Go (${((data.summary.totalStorageBytes / (15 * 1024 * 1024 * 1024)) * 100).toFixed(3)}%)</span>
          </div>
          <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div class="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500" style="width: ${Math.max(1, Math.min(100, (data.summary.totalStorageBytes / (15 * 1024 * 1024 * 1024)) * 100))}%;"></div>
          </div>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">2. Consommation Cloudflare R2 (Fichiers & Documents)</span>
            <span class="font-mono text-blue-400 font-bold">${data.summary.totalR2Formatted} / 10 Go gratuits (${((data.summary.totalR2Bytes / (10 * 1024 * 1024 * 1024)) * 100).toFixed(3)}%)</span>
          </div>
          <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500" style="width: ${Math.max(1, Math.min(100, (data.summary.totalR2Bytes / (10 * 1024 * 1024 * 1024)) * 100))}%;"></div>
          </div>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">3. Consommation Cloudflare D1 (Base SQLite & Données Texte)</span>
            <span class="font-mono text-emerald-400 font-bold">${data.summary.totalD1Formatted} / 5 Go gratuits (${((data.summary.totalD1Bytes / (5 * 1024 * 1024 * 1024)) * 100).toFixed(3)}%)</span>
          </div>
          <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div class="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" style="width: ${Math.max(1, Math.min(100, (data.summary.totalD1Bytes / (5 * 1024 * 1024 * 1024)) * 100))}%;"></div>
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
            <span class="text-xs font-normal text-slate-400">(${TABLES_METADATA.length} tables répertoriées)</span>
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
            <span class="text-xs font-normal text-slate-400">(${R2_FOLDERS_METADATA.length} dossiers structurés)</span>
          </h3>
          <span class="text-[11px] text-slate-400 hidden sm:inline">Cliquez sur un dossier pour dérouler ses détails</span>
        </div>
        <div id="r2-folders-accordion-list" class="divide-y divide-slate-800/80"></div>
      </div>

    </div>

    <!-- ================================================================== -->
    <!-- VUE 2 : TOUT LES UTILISATEURS (DIVISÉE EN 2, COLONNES SCROLLABLES INDÉPENDANTES, PAGE FIXE) -->
    <!-- ================================================================== -->
    <div id="view-users" class="hidden w-full flex-1 flex flex-col space-y-2.5 overflow-hidden h-[calc(100vh-80px)]">
      
      <!-- BANNIÈRE EN HAUT : STOCKAGE INITIAL À L'INSCRIPTION APPLIQUÉ À TOUS (IMAGE 2) -->
      <div class="neo-card p-2.5 sm:p-3 bg-gradient-to-r from-slate-900 via-[#131b2e] to-slate-900 border-l-4 border-l-orange-500 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div class="flex items-center gap-2.5">
          <span class="text-xl shrink-0">🎁</span>
          <div>
            <div class="text-xs font-extrabold text-white flex items-center gap-1.5 flex-wrap">
              <span>Stockage Initial à l'Inscription :</span>
              <span id="current-welcome-badge" class="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 font-mono font-black border border-orange-500/40 text-xs">
                ${data.globalConfig?.default_welcome_total_mb ?? 30} Mo
              </span>
            </div>
            <p class="text-[10px] text-slate-400 mt-0.5">Quota global attribué automatiquement. Vous pouvez le modifier ici pour l'appliquer à <strong>TOUS</strong> les utilisateurs (actuels et futurs).</p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <div class="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-700">
            <span class="text-[10px] text-slate-400 font-bold">Nouveau :</span>
            <input 
              type="number" 
              id="users-welcome-input" 
              class="w-16 bg-slate-900 text-orange-400 font-bold font-mono text-xs px-1.5 py-0.5 rounded border border-slate-600 text-center" 
              value="${data.globalConfig?.default_welcome_total_mb ?? 30}"
            >
            <span class="text-[10px] text-slate-400 font-bold">Mo</span>
          </div>

          <button 
            onclick="applyWelcomeStorageToAllUsers()" 
            class="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-orange-600/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
            title="Met à jour la base de données et applique immédiatement ce stockage à TOUS les utilisateurs existants et futurs"
          >
            <span>⚡</span>
            <span>Appliquer à tous les utilisateurs</span>
          </button>
        </div>
      </div>

      <!-- DEUX COLONNES SCROLLABLES INDÉPENDANTES (LA PAGE EXTÉRIEURE NE BOUGE PAS) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
        
        <!-- COLONNE GAUCHE (4/12) : LISTE DES NOMS SCROLLABLE INDÉPENDANTE -->
        <div class="lg:col-span-4 neo-card h-[280px] lg:h-full flex flex-col overflow-hidden shrink-0">
          <div class="p-2 border-b border-slate-800 shrink-0">
            <input 
              type="text" 
              id="users-search-left" 
              placeholder="Filtrer nom, numéro, école..." 
              oninput="filterUsersLeft()"
              class="w-full bg-slate-900 text-slate-200 placeholder-slate-500 text-xs rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-orange-500"
            >
          </div>
          <div id="users-left-list" class="flex-1 overflow-y-auto divide-y divide-slate-800/60 text-xs font-medium"></div>
        </div>

        <!-- COLONNE DROITE (8/12) : DÉTAILS COMPLETS ET DONNÉES SCROLLABLES INDÉPENDANTS -->
        <div class="lg:col-span-8 neo-card p-4 space-y-4 overflow-y-auto h-[480px] lg:h-full" id="user-details-right-panel"></div>

      </div>
    </div>

    <!-- ================================================================== -->
    <!-- VUE 3 : DEMANDE DE STOCKAGE & PARAMÈTRES GLOBAUX (COLONNES SCROLLABLES INDÉPENDANTES, PAGE FIXE) -->
    <!-- ================================================================== -->
    <div id="view-demandes" class="hidden w-full flex-1 flex flex-col space-y-2.5 overflow-hidden h-[calc(100vh-80px)]">
      
      <!-- BANNIÈRE EN HAUT : PARAMÈTRES DU STOCKAGE DE BIENVENUE POUR TOUS -->
      <div class="neo-card p-2.5 sm:p-3 bg-gradient-to-r from-slate-900 via-[#131b2e] to-slate-900 border-l-4 border-l-orange-500 shrink-0">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h4 class="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>🎁</span> Paramètres Globaux : Stockage de Bienvenue Automatique à l'Inscription
            </h4>
            <p class="text-[10px] text-slate-400 mt-0.5">Quota global attribué automatiquement à tout nouvel utilisateur (partagé librement entre fichiers et base de données, sans limiteur individuel).</p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              <span class="text-[10px] text-slate-400 font-bold">Quota Global Bienvenue :</span>
              <input type="number" id="global-cfg-total" class="w-20 bg-slate-900 text-orange-400 font-bold font-mono text-xs px-2 py-0.5 rounded border border-slate-600 text-center" value="${data.globalConfig?.default_welcome_total_mb ?? ((data.globalConfig?.default_welcome_r2_mb ?? 10) + (data.globalConfig?.default_welcome_d1_mb ?? 20))}">
              <span class="text-[10px] text-slate-400 font-bold">Mo</span>
            </div>

            <button 
              onclick="saveGlobalWelcomeConfig()" 
              class="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-orange-600/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>💾</span> Enregistrer pour tous
            </button>
          </div>
        </div>
      </div>

      <!-- ÉCRAN DIVISÉ EN 2 POUR LA GESTION DES QUOTAS UTILISATEURS -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
        <!-- COLONNE GAUCHE (4/12) : LISTE DES UTILISATEURS SCROLLABLE -->
        <div class="lg:col-span-4 neo-card h-[280px] lg:h-full flex flex-col overflow-hidden shrink-0">
          <div class="p-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-400 shrink-0">
            <span>Utilisateurs & Quotas</span>
            <span class="text-[10px] font-mono text-orange-400">(${data.users.length})</span>
          </div>
          <div id="demandes-users-left-list" class="flex-1 overflow-y-auto divide-y divide-slate-800/60 text-xs"></div>
        </div>

        <!-- COLONNE DROITE (8/12) : FORMULAIRE COMPLET D'AJUSTEMENT DU STOCKAGE SCROLLABLE -->
        <div class="lg:col-span-8 neo-card p-4 space-y-4 overflow-y-auto h-[480px] lg:h-full" id="demandes-right-panel">
          <div class="py-20 text-center text-slate-500 text-xs">
            Sélectionnez un utilisateur sur la gauche pour afficher et ajuster son stockage de bienvenue ou son stockage payant.
          </div>
        </div>
      </div>

    </div>

    <!-- ================================================================== -->
    <!-- VUE 4 : MESSAGES DES UTILISATEURS (DIVISÉE EN 2) -->
    <!-- ================================================================== -->
    <div id="view-messages" class="hidden w-full flex-1 flex flex-col space-y-3 pb-8">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:h-[calc(100vh-130px)] min-h-[450px]">
        <div class="lg:col-span-4 neo-card h-[380px] lg:h-full flex flex-col overflow-hidden shrink-0">
          <div class="p-2.5 border-b border-slate-800 text-xs font-bold text-slate-400 shrink-0">
            Utilisateurs inscrits
          </div>
          <div id="messages-users-left-list" class="flex-1 overflow-y-auto divide-y divide-slate-800/60 text-xs"></div>
        </div>

        <div class="lg:col-span-8 neo-card p-8 flex flex-col items-center justify-center min-h-[350px] lg:h-full text-center text-slate-500">
          <div class="w-16 h-16 rounded-2xl bg-slate-800/60 text-3xl flex items-center justify-center mb-3">💬</div>
          <h3 class="text-sm font-bold text-slate-300">Messagerie et Demandes de Support</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-sm">Cet espace affichera en direct les retours, demandes d'aide et messages envoyés par les étudiants depuis leur application.</p>
        </div>
      </div>
    </div>

  </main>

  <!-- TOAST DE NOTIFICATION FLOTTANT -->
  <div id="toast" class="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl border border-emerald-400/40 hidden transition-opacity animate-bounce">
    Notification
  </div>

  <script>
    const allUsers = ${usersJson};
    const globalSummary = ${summaryJson};
    let globalConfig = ${globalConfigJson};
    const d1TablesGlobal = ${d1TablesGlobalJson};
    const r2FoldersGlobal = ${r2FoldersGlobalJson};
    const tablesMeta = ${tablesMetaJson};
    const r2Meta = ${r2MetaJson};

    let selectedUserId = allUsers.length > 0 ? allUsers[0].user.id : null;
    let selectedDemandeUserId = allUsers.length > 0 ? allUsers[0].user.id : null;
    let currentView = 'global';
    let userStorageViewMode = 'net'; // 'net' = Vrai Stockage Réel (Déduit & Non Pénalisé), 'gross' = Stockage Brut Total (Tout Inclus)

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

    function toggleSidebar() {
      const drawer = document.getElementById('sidebar-drawer');
      const backdrop = document.getElementById('sidebar-backdrop');
      const isOpen = drawer.classList.contains('open');
      if (isOpen) {
        drawer.classList.remove('open');
        backdrop.classList.add('hidden');
      } else {
        drawer.classList.add('open');
        backdrop.classList.remove('hidden');
      }
    }

    function switchView(viewName) {
      currentView = viewName;
      ['global', 'users', 'demandes', 'messages'].forEach(v => {
        const el = document.getElementById('view-' + v);
        const navBtn = document.getElementById('nav-btn-' + v);
        if (v === viewName) {
          el.classList.remove('hidden');
          navBtn.className = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-orange-600 text-white font-bold transition-all text-left shadow-md shadow-orange-600/20";
        } else {
          el.classList.add('hidden');
          navBtn.className = "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left";
        }
      });

      const badge = document.getElementById('current-view-badge');
      if (viewName === 'global') badge.textContent = 'Vue Globale';
      else if (viewName === 'users') badge.textContent = 'Tous les Utilisateurs';
      else if (viewName === 'demandes') badge.textContent = 'Demandes de Stockage';
      else if (viewName === 'messages') badge.textContent = 'Messages';

      const drawer = document.getElementById('sidebar-drawer');
      if (drawer.classList.contains('open')) toggleSidebar();

      if (viewName === 'users') {
        renderUsersLeftList();
        renderUserRightDetails(selectedUserId);
      } else if (viewName === 'demandes') {
        renderDemandesUsersList();
        renderDemandeRightDetails(selectedDemandeUserId);
      } else if (viewName === 'messages') {
        renderSimpleMessagesUsersList();
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
              
              <!-- Ligne 2 : Statut de connexion / En ligne -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">Statut :</span>
                \${u.isOnline ? \`
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Connecté / En ligne (\${u.lastSeenText})
                  </span>
                \` : \`
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                    <span class="w-2 h-2 rounded-full bg-slate-500"></span> Déconnecté / Hors ligne (\${u.lastSeenText})
                  </span>
                \`}
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

              <!-- Ligne 7 : Boutique de services -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">🛍️ Boutique de services :</span>
                \${u.hasShop ? \`
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <span>🏪</span> Oui • Active — \${u.shopName || 'Boutique'} (\${u.shopProductsCount} article\${u.shopProductsCount > 1 ? 's' : ''})
                  </span>
                \` : \`
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                    <span>⚪</span> Non • Aucune boutique créée
                  </span>
                \`}
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
    function renderDemandesUsersList() {
      const container = document.getElementById('demandes-users-left-list');
      container.innerHTML = allUsers.map(item => {
        const u = item.user;
        const q = item.quotaConfig;
        const s = item.storage;
        const isSelected = u.id === selectedDemandeUserId;

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

    function selectDemandeUser(userId) {
      selectedDemandeUserId = userId;
      renderDemandesUsersList();
      renderDemandeRightDetails(userId);
    }

    function renderDemandeRightDetails(userId) {
      const panel = document.getElementById('demandes-right-panel');
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
              
              <!-- Ligne 2 : Statut de connexion / En ligne -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">Statut :</span>
                \${u.isOnline ? \`
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Connecté / En ligne (\${u.lastSeenText})
                  </span>
                \` : \`
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                    <span class="w-2 h-2 rounded-full bg-slate-500"></span> Déconnecté / Hors ligne (\${u.lastSeenText})
                  </span>
                \`}
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

              <!-- Ligne 7 : Boutique de services -->
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-medium">🛍️ Boutique de services :</span>
                \${u.hasShop ? \`
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <span>🏪</span> Oui • Active — \${u.shopName || 'Boutique'} (\${u.shopProductsCount} article\${u.shopProductsCount > 1 ? 's' : ''})
                  </span>
                \` : \`
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
                    <span>⚪</span> Non • Aucune boutique créée
                  </span>
                \`}
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
            <span class="text-[10px] font-mono text-slate-500">Actif</span>
          </div>
        \`;
      }).join('');
    }

    // Initialisation
    renderGlobalD1Tables();
    renderGlobalR2Folders();
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
    const path = url.pathname;
    const origin = request.headers.get('Origin') || '*';

    // Gestion du Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const { db, bucket } = getStorageBindings(env);

    if (!db) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Liaison D1 introuvable. Assurez-vous d'avoir lié MON_D1_STUDYCLOUD ou DB dans vos paramètres Cloudflare."
        }, null, 2),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        }
      );
    }

    // Initialisation automatique des tables de quotas si absentes
    await ensureStorageTables(db);

    try {
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

      // Récupération de tous les utilisateurs (avec numéro de téléphone et niveau)
      const usersQuery = await safeQuery(db, `
        SELECT id, name, email, phone, school, filiere, country, level, bio, avatar_url, created_at, last_active_at 
        FROM users 
        ORDER BY created_at DESC
      `, [], { results: [] });

      const rawUsers = usersQuery && usersQuery.results ? usersQuery.results : [];

      // Inspection pour chaque utilisateur
      const detailedUsers = [];
      let globalR2Bytes = 0;
      let globalD1Bytes = 0;
      let globalD1Rows = 0;

      for (const u of rawUsers) {
        const detail = await inspectUserStorageDetail(db, bucket, u, globalConfigRow);
        detailedUsers.push(detail);

        globalR2Bytes += detail.storage.r2.totalBytes || 0;
        globalD1Bytes += detail.storage.d1.totalBytes || 0;
        globalD1Rows += detail.storage.d1.totalRows || 0;
      }

      // Inspection globale des tables D1 et des dossiers R2
      const d1TablesGlobal = await inspectAllD1TablesGlobal(db);
      const r2FoldersGlobal = await inspectAllR2FoldersGlobal(db, detailedUsers);

      // Synthèse globale
      const globalSummary = {
        totalUsers: detailedUsers.length,
        totalStorageBytes: globalR2Bytes + globalD1Bytes,
        totalStorageFormatted: formatBytes(globalR2Bytes + globalD1Bytes),
        totalR2Bytes: globalR2Bytes,
        totalR2Formatted: formatBytes(globalR2Bytes),
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
          r2Folders: r2FoldersGlobal
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
      // ROUTE PAR DÉFAUT : Page Web Tableau de Bord (HTML)
      // ----------------------------------------------------------------------
      const htmlContent = renderDashboardHtml({
        summary: globalSummary,
        globalConfig: globalConfigRow,
        users: detailedUsers,
        d1TablesGlobal,
        r2FoldersGlobal
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

// ============================================================================
// STUDYCLOUD - WORKER TABLEAU DE BORD (DASHBOARD ANALYTICS & STOCKAGE R2 / D1)
// ============================================================================
// Version Complète avec Navigation Latérale, Vue Globale et Vue Détaillée par Utilisateur.
//
// CONFIGURATION DANS CLOUDFLARE WORKERS :
// - Liaison D1 : "MON_D1_STUDYCLOUD" (ou "DB")
// - Liaison R2 : "MON_R2_STUDYCLOUD" (ou "BUCKET")
// ============================================================================

/**
 * Formatage lisible des tailles en octets (Octets, Ko, Mo, Go)
 */
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 Octets';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Octets', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * En-têtes CORS pour les requêtes API
 */
function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Récupère les instances D1 et R2 depuis l'environnement Cloudflare
 */
function getStorageBindings(env) {
  const db = env.MON_D1_STUDYCLOUD || env['MON_D1-STUDYCLOUD'] || env.DB || env.d1;
  const bucket = env.MON_R2_STUDYCLOUD || env['MON_R2-STUDYCLOUD'] || env.BUCKET || env.r2;
  return { db, bucket };
}

/**
 * Exécute une requête SQL de manière sécurisée sans bloquer le Worker si la table n'existe pas
 */
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
    return await bound.first();
  } catch (err) {
    return defaultValue;
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
    example: "{ id: 'msg_10', conversation_id: 'conv_77', role: 'user', content: 'Comment calculer la fréquence de coupure ?' }"
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
    label: 'Documents publiés dans la bibliothèque',
    uiConnection: "Bibliothèque partagée StudyCloud (Partager / Télécharger)",
    role: "Gère les cours et résumés rendus publics par les étudiants pour la communauté, avec compteurs de téléchargements.",
    usage: "Alimente le moteur de recherche de la bibliothèque publique.",
    example: "{ id: 'pub_90', title: 'Fiche Synthèse AOP', file_size: 1450000, downloads_count: 142, views_count: 850 }"
  },
  {
    table: 'user_document_interactions',
    label: 'Interactions sur les documents publics',
    uiConnection: "Bibliothèque partagée > Vues et téléchargements",
    role: "Enregistre l'historique des consultations et téléchargements de cours pour éviter les doublons de statistiques.",
    usage: "Écrit à chaque consultation ou clic sur un document public.",
    example: "{ id: 'int_1', user_id: 'user_abc', document_id: 'pub_90', interaction_type: 'view' }"
  },
  {
    table: 'published_document_downloads',
    label: 'Historique des téléchargements publics',
    uiConnection: "Bibliothèque partagée > Statistiques de diffusion",
    role: "Traçabilité des téléchargements effectués sur les cours publiés.",
    usage: "Incrémenté à chaque téléchargement de fichier.",
    example: "{ id: 'dl_2', user_id: 'user_abc', document_id: 'pub_90' }"
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
    role: "Table centrale de l'identité de chaque étudiant (nom, email, mot de passe hashé, école, filière, avatar).",
    usage: "Consultée à chaque connexion et pour afficher le profil.",
    example: "{ id: 'user_123', name: 'Kouassi Delmas', email: 'delmas@...', school: 'INP-HB', filiere: 'Génie Électrique' }"
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
    role: "Configure les règles de bonus par parrainage (nombre de jours offerts).",
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
    name: 'Documents publiés dans la bibliothèque communautaire',
    uiConnection: "Bibliothèque partagée StudyCloud > Catalogue des cours publics",
    role: "Héberge les fichiers que les étudiants ou enseignants choisissent de partager publiquement avec toute la communauté d'étudiants de leur pays ou école.",
    usage: "Accessible en téléchargement direct et illimité par tous les membres de StudyCloud sans frais de bande passante (0$ egress R2).",
    examples: "Annales_Bac_Scientifique.pdf, Resumes_Prepa_Maths.pdf",
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
async function inspectUserStorageDetail(db, bucket, user) {
  const userId = user.id;

  // 1. FICHIERS PERSONNELS & MATIERES (R2 via Table files)
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

  // 2. FICHIERS PUBLIES DANS LA BIBLIOTHEQUE PUBLIQUE (R2 via published_documents)
  const pubStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(file_size), 0) AS total_bytes, COALESCE(SUM(views_count), 0) AS total_views, COALESCE(SUM(downloads_count), 0) AS total_downloads
    FROM published_documents WHERE user_id = ?
  `, [userId], { count: 0, total_bytes: 0, total_views: 0, total_downloads: 0 });

  // 3. FICHIERS DE LIENS DE PARTAGE (R2 via shared_folders et shared_folder_files)
  const shareStats = await safeFirst(db, `
    SELECT COUNT(DISTINCT sf.id) AS folders_count, COUNT(sff.id) AS files_count, COALESCE(SUM(sff.size), 0) AS total_bytes
    FROM shared_folders sf LEFT JOIN shared_folder_files sff ON sff.shared_folder_id = sf.id
    WHERE sf.user_id = ?
  `, [userId], { folders_count: 0, files_count: 0, total_bytes: 0 });

  // 4. BOUTIQUE : PRODUITS ET IMAGES (R2 & D1 via products)
  const shopStats = await safeFirst(db, `
    SELECT COUNT(*) AS products_count, COALESCE(SUM(LENGTH(description) + LENGTH(COALESCE(image_urls_json, ''))), 0) AS d1_text_bytes
    FROM products WHERE seller_id = ?
  `, [userId], { products_count: 0, d1_text_bytes: 0 });

  // 5. CONTENUS GENERES PAR L'IA (D1 via ai_generated_contents)
  const aiContentsStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(title) + LENGTH(COALESCE(content_json, ''))), 0) AS d1_text_bytes
    FROM ai_generated_contents WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 6. ESPACE DE TRAVAIL IA / WORKSPACE (D1 via user_ai_workspace)
  const aiWorkspaceStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(message_text) + LENGTH(COALESCE(attached_file_content, '')) + LENGTH(COALESCE(user_notes, ''))), 0) AS d1_text_bytes
    FROM user_ai_workspace WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 7. DISCUSSIONS & CHAT IA (D1 via conversations & messages)
  const chatStats = await safeFirst(db, `
    SELECT COUNT(DISTINCT c.id) AS conversations_count, COUNT(m.id) AS messages_count, COALESCE(SUM(LENGTH(m.content) + LENGTH(COALESCE(m.metadata, ''))), 0) AS d1_text_bytes
    FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.user_id = ?
  `, [userId], { conversations_count: 0, messages_count: 0, d1_text_bytes: 0 });

  // 8. CREATIONS IA & TÂCHES (D1 via ai_creations et ai_tasks)
  const aiCreationsStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(COALESCE(title, '')) + LENGTH(COALESCE(content, ''))), 0) AS d1_text_bytes
    FROM ai_creations WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ?)
  `, [userId], { count: 0, d1_text_bytes: 0 });

  const aiTasksStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(COALESCE(prompt, '')) + LENGTH(COALESCE(result_json, ''))), 0) AS d1_text_bytes
    FROM ai_tasks WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 9. NOTES DE BLOC-NOTES (D1 via notes)
  const notesStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(title) + LENGTH(COALESCE(content, ''))), 0) AS d1_text_bytes
    FROM notes WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 10. MATIERES (D1 via matieres)
  const matieresStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(name)), 0) AS d1_text_bytes
    FROM matieres WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 11. EMPLOI DU TEMPS (D1 via schedule_slots)
  const scheduleStats = await safeFirst(db, `
    SELECT COUNT(*) AS slots_count, COALESCE(SUM(LENGTH(subject) + LENGTH(COALESCE(room, '')) + LENGTH(COALESCE(note_or_teacher, ''))), 0) AS d1_text_bytes
    FROM schedule_slots WHERE user_id = ?
  `, [userId], { slots_count: 0, d1_text_bytes: 0 });

  // 12. NOTES D'EVALUATION & MOYENNES (D1 via grades)
  const gradesStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(subject_name) + LENGTH(COALESCE(sub_grades_json, ''))), 0) AS d1_text_bytes
    FROM grades WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  // 13. CALENDRIER, ALARMES ET SESSIONS D'ETUDE
  const calendarStats = await safeFirst(db, `
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(title) + LENGTH(COALESCE(description, ''))), 0) AS d1_text_bytes
    FROM calendar_events WHERE user_id = ?
  `, [userId], { count: 0, d1_text_bytes: 0 });

  const alarmsStats = await safeFirst(db, `SELECT COUNT(*) AS count FROM alarms WHERE user_id = ?`, [userId], { count: 0 });
  const studySessionsStats = await safeFirst(db, `SELECT COUNT(*) AS count, COALESCE(SUM(duration_seconds), 0) AS total_study_seconds FROM study_sessions WHERE user_id = ?`, [userId], { count: 0, total_study_seconds: 0 });

  // 14. CERTIFICATS, NOTIFICATIONS, PARRAINAGES, PANIER
  const certifsStats = await safeFirst(db, `SELECT COUNT(*) AS count FROM user_certificates WHERE user_id = ?`, [userId], { count: 0 });
  const notifStats = await safeFirst(db, `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?`, [userId], { count: 0 });
  const referralStats = await safeFirst(db, `SELECT COUNT(*) AS count FROM referrals WHERE referrer_id = ?`, [userId], { count: 0 });
  const cartStats = await safeFirst(db, `SELECT COUNT(*) AS count FROM cart_items WHERE user_id = ?`, [userId], { count: 0 });

  // 15. AVATAR
  const hasCustomAvatar = user.avatar_url && (user.avatar_url.includes('avatars/') || user.avatar_url.startsWith('http') || user.avatar_url.startsWith('data:image'));
  const avatarEstimatedBytes = hasCustomAvatar ? 85000 : 0;

  // Calcul totaux
  const userR2Bytes = (filesStats.total_bytes || 0) + (pubStats.total_bytes || 0) + (shareStats.total_bytes || 0) + avatarEstimatedBytes;
  
  const userProfileBytes = (user.name?.length || 0) + (user.email?.length || 0) + (user.school?.length || 0) + (user.filiere?.length || 0) + 120;
  
  const userD1TextBytes = (shopStats.d1_text_bytes || 0) + (aiContentsStats.d1_text_bytes || 0) + (aiWorkspaceStats.d1_text_bytes || 0) +
                          (chatStats.d1_text_bytes || 0) + (aiCreationsStats.d1_text_bytes || 0) + (aiTasksStats.d1_text_bytes || 0) +
                          (notesStats.d1_text_bytes || 0) + (matieresStats.d1_text_bytes || 0) + (scheduleStats.d1_text_bytes || 0) +
                          (gradesStats.d1_text_bytes || 0) + (calendarStats.d1_text_bytes || 0) + userProfileBytes;

  const userD1Rows = (filesStats.total_count || 0) + (pubStats.count || 0) + (shareStats.folders_count || 0) + (shareStats.files_count || 0) +
                     (shopStats.products_count || 0) + (aiContentsStats.count || 0) + (aiWorkspaceStats.count || 0) +
                     (chatStats.conversations_count || 0) + (chatStats.messages_count || 0) + (aiCreationsStats.count || 0) +
                     (aiTasksStats.count || 0) + (notesStats.count || 0) + (matieresStats.count || 0) + (scheduleStats.slots_count || 0) +
                     (gradesStats.count || 0) + (calendarStats.count || 0) + (alarmsStats.count || 0) + (studySessionsStats.count || 0) +
                     (certifsStats.count || 0) + (notifStats.count || 0) + (referralStats.count || 0) + (cartStats.count || 0) + 1;

  const userD1Bytes = userD1TextBytes + (userD1Rows * 128);
  const userTotalBytes = userR2Bytes + userD1Bytes;

  // Dictionnaire individuel table par table pour cet utilisateur
  const userTablesStats = {
    files: { count: filesStats.total_count, bytes: filesStats.total_bytes, formatted: formatBytes(filesStats.total_bytes) },
    notes: { count: notesStats.count, bytes: notesStats.d1_text_bytes, formatted: formatBytes(notesStats.d1_text_bytes) },
    matieres: { count: matieresStats.count, bytes: matieresStats.d1_text_bytes, formatted: formatBytes(matieresStats.d1_text_bytes) },
    ai_generated_contents: { count: aiContentsStats.count, bytes: aiContentsStats.d1_text_bytes, formatted: formatBytes(aiContentsStats.d1_text_bytes) },
    user_ai_workspace: { count: aiWorkspaceStats.count, bytes: aiWorkspaceStats.d1_text_bytes, formatted: formatBytes(aiWorkspaceStats.d1_text_bytes) },
    conversations: { count: chatStats.conversations_count, bytes: chatStats.conversations_count * 150, formatted: formatBytes(chatStats.conversations_count * 150) },
    messages: { count: chatStats.messages_count, bytes: chatStats.d1_text_bytes, formatted: formatBytes(chatStats.d1_text_bytes) },
    ai_creations: { count: aiCreationsStats.count, bytes: aiCreationsStats.d1_text_bytes, formatted: formatBytes(aiCreationsStats.d1_text_bytes) },
    ai_tasks: { count: aiTasksStats.count, bytes: aiTasksStats.d1_text_bytes, formatted: formatBytes(aiTasksStats.d1_text_bytes) },
    user_certificates: { count: certifsStats.count, bytes: certifsStats.count * 220, formatted: formatBytes(certifsStats.count * 220) },
    schedule_slots: { count: scheduleStats.slots_count, bytes: scheduleStats.d1_text_bytes, formatted: formatBytes(scheduleStats.d1_text_bytes) },
    schedule_config: { count: 1, bytes: 180, formatted: formatBytes(180) },
    grades: { count: gradesStats.count, bytes: gradesStats.d1_text_bytes, formatted: formatBytes(gradesStats.d1_text_bytes) },
    grade_settings: { count: 1, bytes: 80, formatted: formatBytes(80) },
    calendar_events: { count: calendarStats.count, bytes: calendarStats.d1_text_bytes, formatted: formatBytes(calendarStats.d1_text_bytes) },
    alarms: { count: alarmsStats.count, bytes: alarmsStats.count * 100, formatted: formatBytes(alarmsStats.count * 100) },
    study_sessions: { count: studySessionsStats.count, bytes: studySessionsStats.count * 90, formatted: formatBytes(studySessionsStats.count * 90) },
    published_documents: { count: pubStats.count, bytes: pubStats.total_bytes, formatted: formatBytes(pubStats.total_bytes) },
    user_document_interactions: { count: 0, bytes: 0, formatted: '0 Octets' },
    published_document_downloads: { count: 0, bytes: 0, formatted: '0 Octets' },
    shared_folders: { count: shareStats.folders_count, bytes: shareStats.folders_count * 250, formatted: formatBytes(shareStats.folders_count * 250) },
    shared_folder_files: { count: shareStats.files_count, bytes: shareStats.total_bytes, formatted: formatBytes(shareStats.total_bytes) },
    shop_profiles: { count: 1, bytes: 180, formatted: formatBytes(180) },
    products: { count: shopStats.products_count, bytes: shopStats.d1_text_bytes, formatted: formatBytes(shopStats.d1_text_bytes) },
    cart_items: { count: cartStats.count, bytes: cartStats.count * 80, formatted: formatBytes(cartStats.count * 80) },
    seller_follows: { count: 0, bytes: 0, formatted: '0 Octets' },
    notifications: { count: notifStats.count, bytes: notifStats.count * 160, formatted: formatBytes(notifStats.count * 160) },
    users: { count: 1, bytes: userProfileBytes, formatted: formatBytes(userProfileBytes) },
    user_preferences: { count: 1, bytes: 90, formatted: formatBytes(90) },
    user_subscriptions: { count: 1, bytes: 110, formatted: formatBytes(110) },
    referrals: { count: referralStats.count, bytes: referralStats.count * 140, formatted: formatBytes(referralStats.count * 140) },
    referral_rewards_config: { count: 1, bytes: 120, formatted: formatBytes(120) },
    auth_sessions: { count: 1, bytes: 128, formatted: formatBytes(128) },
    email_verifications: { count: 1, bytes: 120, formatted: formatBytes(120) },
    password_resets: { count: 0, bytes: 0, formatted: '0 Octets' },
    app_external_links: { count: 3, bytes: 380, formatted: formatBytes(380) }
  };

  // Dictionnaire individuel R2 pour cet utilisateur
  const userR2FoldersStats = {
    'user-files/': { count: filesStats.personal_files_count, bytes: filesStats.personal_files_bytes, formatted: formatBytes(filesStats.personal_files_bytes) },
    'ai-studies/': { count: filesStats.ai_files_count, bytes: filesStats.ai_files_bytes, formatted: formatBytes(filesStats.ai_files_bytes) },
    'published/files/': { count: pubStats.count, bytes: pubStats.total_bytes, formatted: formatBytes(pubStats.total_bytes) },
    'shared-links/files/': { count: shareStats.files_count, bytes: shareStats.total_bytes, formatted: formatBytes(shareStats.total_bytes) },
    'products/images/': { count: shopStats.products_count, bytes: shopStats.products_count * 120000, formatted: formatBytes(shopStats.products_count * 120000) },
    'avatars/': { count: hasCustomAvatar ? 1 : 0, bytes: avatarEstimatedBytes, formatted: formatBytes(avatarEstimatedBytes) }
  };

  return {
    user: {
      id: user.id,
      name: user.name || 'Étudiant StudyCloud',
      email: user.email || '',
      school: user.school || '',
      filiere: user.filiere || '',
      country: user.country || 'Côte d\'Ivoire',
      avatar_url: user.avatar_url || '',
      created_at: user.created_at || '',
      last_active_at: user.last_active_at || ''
    },
    storage: {
      totalBytes: userTotalBytes,
      totalFormatted: formatBytes(userTotalBytes),
      quotaBytes: 1024 * 1024 * 1024, // 1 Go
      quotaFormatted: '1 Go',
      usagePercentage: Math.min(100, parseFloat(((userTotalBytes / (1024 * 1024 * 1024)) * 100).toFixed(2))),
      r2: {
        totalBytes: userR2Bytes,
        totalFormatted: formatBytes(userR2Bytes),
        folders: userR2FoldersStats
      },
      d1: {
        totalBytes: userD1Bytes,
        totalFormatted: formatBytes(userD1Bytes),
        totalRows: userD1Rows,
        tables: userTablesStats
      }
    }
  };
}

/**
 * Calcule les statistiques globales de CHAQUE table D1
 */
async function inspectAllD1TablesGlobal(db) {
  const results = {};
  for (const item of TABLES_METADATA) {
    const tableName = item.table;
    try {
      const row = await safeFirst(db, `SELECT COUNT(*) as count FROM ${tableName}`, [], { count: 0 });
      const count = row ? (row.count || 0) : 0;
      
      // Estimation de taille moyenne par table
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

/**
 * Calcule les statistiques globales de CHAQUE dossier R2
 */
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
 * Génère l'application HTML complète du Tableau de Bord
 */
function renderDashboardHtml(data) {
  const usersJson = JSON.stringify(data.users).replace(/</g, '\\u003c');
  const summaryJson = JSON.stringify(data.summary).replace(/</g, '\\u003c');
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
    ::-webkit-scrollbar { width: 6px; height: 6px; }
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
  </style>
</head>
<body class="bg-[#070b14] text-slate-100 min-h-screen antialiased flex flex-col selection:bg-orange-500 selection:text-white">

  <!-- ==================================================================== -->
  <!-- BARRE SUPÉRIEURE DE NAVIGATION -->
  <!-- ==================================================================== -->
  <header class="sticky top-0 z-40 bg-[#0c1220]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3 flex items-center justify-between">
    
    <div class="flex items-center gap-3">
      <!-- Bouton 3 traits (Menu Hamburger) -->
      <button 
        onclick="toggleSidebar()"
        class="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
        title="Ouvrir le menu latéral"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 6h16M4 12h16M4 18h16"></path>
        </svg>
      </button>

      <!-- Logo StudyCloud -->
      <div class="flex items-center gap-2.5 cursor-pointer" onclick="switchView('global')">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-orange-500/20">
          ☁️
        </div>
        <div>
          <h1 class="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
            StudyCloud <span class="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-bold border border-orange-500/30" id="current-view-badge">Stockage R2 & D1</span>
          </h1>
          <p class="text-xs text-slate-400">Audit & Gestion des Quotas Utilisateurs</p>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-2 sm:gap-3">
      <button onclick="window.location.reload()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5">
        <span>🔄</span> <span class="hidden sm:inline">Actualiser</span>
      </button>
      <a href="/api/overview" target="_blank" class="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-xs font-bold text-white transition-all shadow-md shadow-orange-600/30 flex items-center gap-1.5">
        <span>📡</span> <span class="hidden sm:inline">API JSON</span>
      </a>
    </div>
  </header>

  <!-- ==================================================================== -->
  <!-- MENU LATÉRAL GAUCHE FLUIDE (DRAWER) -->
  <!-- ==================================================================== -->
  <div id="sidebar-backdrop" onclick="toggleSidebar()" class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm hidden transition-opacity"></div>
  
  <aside id="sidebar-drawer" class="sidebar-drawer fixed top-0 left-0 bottom-0 z-50 w-72 sm:w-80 bg-[#0f172a] border-r border-slate-800 flex flex-col shadow-2xl">
    <!-- En-tête du menu latéral -->
    <div class="p-5 border-b border-slate-800 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white font-black text-sm">
          SC
        </div>
        <span class="font-extrabold text-white text-sm">Menu d'Administration</span>
      </div>
      <button onclick="toggleSidebar()" class="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center justify-center">
        ✕
      </button>
    </div>

    <!-- Liens du menu latéral -->
    <nav class="p-4 space-y-2 flex-1 overflow-y-auto text-xs font-bold">
      <button 
        onclick="switchView('global')" 
        id="nav-btn-global"
        class="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-orange-600 text-white font-bold transition-all text-left shadow-md shadow-orange-600/20"
      >
        <span class="text-base">📊</span>
        <span>Vue d'ensemble Globale</span>
      </button>

      <button 
        onclick="switchView('users')" 
        id="nav-btn-users"
        class="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left"
      >
        <span class="text-base">👥</span>
        <span>Tout les Utilisateurs</span>
      </button>

      <button 
        onclick="switchView('demandes')" 
        id="nav-btn-demandes"
        class="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left"
      >
        <span class="text-base">💾</span>
        <span>Demande de stockage</span>
      </button>

      <button 
        onclick="switchView('messages')" 
        id="nav-btn-messages"
        class="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left"
      >
        <span class="text-base">💬</span>
        <span>Messages des utilisateurs</span>
      </button>
    </nav>

    <!-- Pied du menu latéral -->
    <div class="p-4 border-t border-slate-800 text-[11px] text-slate-500 flex flex-col gap-1">
      <div>StudyCloud • DKD Technologies</div>
      <div class="text-slate-600">Cloudflare D1 & R2 Centralisé</div>
    </div>
  </aside>

  <!-- ==================================================================== -->
  <!-- ZONE DE CONTENU PRINCIPALE (CHANGÉE SELON LE MENU SÉLECTIONNÉ) -->
  <!-- ==================================================================== -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

    <!-- ================================================================== -->
    <!-- SECTION 1 : VUE D'ENSEMBLE GLOBALE (ACCUEIL) -->
    <!-- ================================================================== -->
    <div id="view-global" class="space-y-6">

      <!-- 4 CARRÉS EN HAUT : STATISTIQUES GLOBALES -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <!-- Carré 1: Nombre d'utilisateurs -->
        <div class="neo-card p-4 sm:p-5 flex flex-col justify-between border-l-4 border-l-blue-500">
          <div class="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
            <span>UTILISATEURS</span>
            <span class="text-base">👥</span>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-black text-white">${data.summary.totalUsers}</div>
            <div class="text-[11px] text-blue-400 mt-1 font-medium">Comptes enregistrés dans D1</div>
          </div>
        </div>

        <!-- Carré 2: Volume de fichier R2 (avec limite Cloudflare) -->
        <div class="neo-card p-4 sm:p-5 flex flex-col justify-between border-l-4 border-l-orange-500">
          <div class="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
            <span>VOLUME R2 (FICHIERS)</span>
            <span class="text-base">📦</span>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-black text-orange-400">${data.summary.totalR2Formatted}</div>
            <div class="text-[11px] text-slate-400 mt-1 font-medium">
              Limite Cloudflare : <span class="text-white font-bold">10 Go gratuits</span>
            </div>
          </div>
        </div>

        <!-- Carré 3: Volume de fichiers D1 (avec limite Cloudflare) -->
        <div class="neo-card p-4 sm:p-5 flex flex-col justify-between border-l-4 border-l-emerald-500">
          <div class="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
            <span>VOLUME D1 (BASE SQL)</span>
            <span class="text-base">🗄️</span>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-black text-emerald-400">${data.summary.totalD1Formatted}</div>
            <div class="text-[11px] text-slate-400 mt-1 font-medium">
              Limite Cloudflare : <span class="text-white font-bold">5 Go gratuits</span>
            </div>
          </div>
        </div>

        <!-- Carré 4: Coût Cloudflare estimé -->
        <div class="neo-card p-4 sm:p-5 flex flex-col justify-between border-l-4 border-l-purple-500">
          <div class="flex items-center justify-between text-slate-400 text-xs font-bold mb-2">
            <span>COÛT CLOUDFLARE ESTIMÉ</span>
            <span class="text-base">💰</span>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-black text-purple-400">0,00 $ / mois</div>
            <div class="text-[11px] text-purple-300 mt-1 font-medium">Inclus dans les quotas gratuits</div>
          </div>
        </div>

      </div>

      <!-- TROIS LIGNES DE PROGRESSION DE LA CONSOMMATION GLOBALE -->
      <div class="neo-card p-5 space-y-4">
        <h3 class="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
          <span>📈</span> Progression de la Consommation Réelle de l'Application
        </h3>

        <!-- Ligne 1: Consommation Globale (R2 + D1 combiné) -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">1. Consommation Globale (R2 + D1 combiné)</span>
            <span class="font-mono text-orange-400 font-bold">${data.summary.totalStorageFormatted} / 15 Go (${((data.summary.totalStorageBytes / (15 * 1024 * 1024 * 1024)) * 100).toFixed(3)}%)</span>
          </div>
          <div class="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div class="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500" style="width: ${Math.max(1, Math.min(100, (data.summary.totalStorageBytes / (15 * 1024 * 1024 * 1024)) * 100))}%;"></div>
          </div>
        </div>

        <!-- Ligne 2: Consommation Cloudflare R2 -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">2. Consommation Cloudflare R2 (Fichiers & Documents)</span>
            <span class="font-mono text-blue-400 font-bold">${data.summary.totalR2Formatted} / 10 Go gratuits (${((data.summary.totalR2Bytes / (10 * 1024 * 1024 * 1024)) * 100).toFixed(3)}%)</span>
          </div>
          <div class="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
            <div class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-500" style="width: ${Math.max(1, Math.min(100, (data.summary.totalR2Bytes / (10 * 1024 * 1024 * 1024)) * 100))}%;"></div>
          </div>
        </div>

        <!-- Ligne 3: Consommation Cloudflare D1 -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-200">3. Consommation Cloudflare D1 (Base SQLite & Données Texte)</span>
            <span class="font-mono text-emerald-400 font-bold">${data.summary.totalD1Formatted} / 5 Go gratuits (${((data.summary.totalD1Bytes / (5 * 1024 * 1024 * 1024)) * 100).toFixed(3)}%)</span>
          </div>
          <div class="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
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
          class="w-full bg-[#111827] text-slate-200 placeholder-slate-500 text-xs sm:text-sm rounded-xl px-4 py-3 pl-10 border border-slate-700 focus:outline-none focus:border-orange-500 transition-colors shadow-sm"
        >
        <span class="absolute left-3.5 top-3.5 text-slate-500 text-sm">🔍</span>
      </div>

      <!-- SECTION 1 : TOUTES LES TABLES CLOUDFLARE D1 (AVEC ACCORDÉON) -->
      <div class="neo-card overflow-hidden">
        <div class="px-5 py-3.5 bg-[#0d1424] border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <span>🗄️</span> Tables Base de Données Cloudflare D1
            <span class="text-xs font-normal text-slate-400">(${TABLES_METADATA.length} tables répertoriées)</span>
          </h3>
          <span class="text-[11px] text-slate-400">Cliquez sur une table pour dérouler ses détails</span>
        </div>

        <div id="d1-tables-accordion-list" class="divide-y divide-slate-800/80">
          <!-- Injecté dynamiquement par JS -->
        </div>
      </div>

      <!-- SECTION 2 : TOUS LES DOSSIERS CLOUDFLARE R2 (AVEC ACCORDÉON) -->
      <div class="neo-card overflow-hidden">
        <div class="px-5 py-3.5 bg-[#0d1424] border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-sm font-bold text-orange-400 flex items-center gap-2">
            <span>📦</span> Dossiers Stockage Objets Cloudflare R2
            <span class="text-xs font-normal text-slate-400">(${R2_FOLDERS_METADATA.length} dossiers structurés)</span>
          </h3>
          <span class="text-[11px] text-slate-400">Cliquez sur un dossier pour dérouler ses détails</span>
        </div>

        <div id="r2-folders-accordion-list" class="divide-y divide-slate-800/80">
          <!-- Injecté dynamiquement par JS -->
        </div>
      </div>

    </div>

    <!-- ================================================================== -->
    <!-- SECTION 2 : TOUS LES UTILISATEURS (ÉCRAN DIVISÉ EN 2) -->
    <!-- ================================================================== -->
    <div id="view-users" class="hidden space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-extrabold text-white flex items-center gap-2">
          <span>👥</span> Tout les Utilisateurs & Stockage Dédié
        </h2>
        <div class="text-xs text-slate-400">Cliquez sur un utilisateur à gauche pour inspecter son stockage à droite</div>
      </div>

      <!-- DIVISÉ EN 2 : GAUCHE (LISTE) / DROITE (DÉTAILS UTILISATEUR COMPLETS) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        <!-- COLONNE GAUCHE (4/12) : LISTE DES UTILISATEURS -->
        <div class="lg:col-span-4 neo-card overflow-hidden flex flex-col max-h-[82vh]">
          <div class="p-3 border-b border-slate-800">
            <input 
              type="text" 
              id="users-search-left" 
              placeholder="Filtrer un utilisateur..." 
              oninput="filterUsersLeft()"
              class="w-full bg-slate-900 text-slate-200 placeholder-slate-500 text-xs rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-orange-500"
            >
          </div>
          <div id="users-left-list" class="flex-1 overflow-y-auto divide-y divide-slate-800/60 text-xs font-medium">
            <!-- Injecté par JS -->
          </div>
        </div>

        <!-- COLONNE DROITE (8/12) : DÉTAILS COMPLETS DE L'UTILISATEUR SÉLECTIONNÉ -->
        <div class="lg:col-span-8 neo-card p-5 space-y-5 overflow-y-auto max-h-[82vh]" id="user-details-right-panel">
          <!-- Injecté dynamiquement par JS quand on clique sur un utilisateur -->
          <div class="py-20 text-center text-slate-500">
            Sélectionnez un utilisateur sur la gauche pour afficher son stockage complet.
          </div>
        </div>

      </div>
    </div>

    <!-- ================================================================== -->
    <!-- SECTION 3 : DEMANDES DE STOCKAGE (ÉCRAN DIVISÉ EN 2) -->
    <!-- ================================================================== -->
    <div id="view-demandes" class="hidden space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-extrabold text-white flex items-center gap-2">
          <span>💾</span> Demandes d'Extension de Stockage
        </h2>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div class="lg:col-span-4 neo-card overflow-hidden flex flex-col max-h-[82vh]">
          <div class="p-3 border-b border-slate-800 text-xs font-bold text-slate-400">
            Liste des Utilisateurs
          </div>
          <div id="demandes-users-left-list" class="flex-1 overflow-y-auto divide-y divide-slate-800/60 text-xs">
            <!-- Liste utilisateurs -->
          </div>
        </div>

        <div class="lg:col-span-8 neo-card p-8 flex flex-col items-center justify-center min-h-[50vh] text-center text-slate-500">
          <div class="w-16 h-16 rounded-2xl bg-slate-800/60 text-3xl flex items-center justify-center mb-3">💾</div>
          <h3 class="text-sm font-bold text-slate-300">Module Demandes de Stockage</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-sm">Cet espace est réservé pour la gestion des demandes d'augmentation de quota, factures et validations de paiement.</p>
        </div>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- SECTION 4 : MESSAGES DES UTILISATEURS (ÉCRAN DIVISÉ EN 2) -->
    <!-- ================================================================== -->
    <div id="view-messages" class="hidden space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-extrabold text-white flex items-center gap-2">
          <span>💬</span> Messages & Retours des Utilisateurs
        </h2>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div class="lg:col-span-4 neo-card overflow-hidden flex flex-col max-h-[82vh]">
          <div class="p-3 border-b border-slate-800 text-xs font-bold text-slate-400">
            Liste des Utilisateurs
          </div>
          <div id="messages-users-left-list" class="flex-1 overflow-y-auto divide-y divide-slate-800/60 text-xs">
            <!-- Liste utilisateurs -->
          </div>
        </div>

        <div class="lg:col-span-8 neo-card p-8 flex flex-col items-center justify-center min-h-[50vh] text-center text-slate-500">
          <div class="w-16 h-16 rounded-2xl bg-slate-800/60 text-3xl flex items-center justify-center mb-3">💬</div>
          <h3 class="text-sm font-bold text-slate-300">Module Messagerie Utilisateurs</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-sm">Cet espace accueillera les messages de support, retours d'expérience et signalements des étudiants.</p>
        </div>
      </div>
    </div>

  </main>

  <!-- JAVASCRIPT PRINCIPAL D'INTERACTION -->
  <script>
    const allUsers = ${usersJson};
    const globalSummary = ${summaryJson};
    const d1TablesGlobal = ${d1TablesGlobalJson};
    const r2FoldersGlobal = ${r2FoldersGlobalJson};
    const tablesMeta = ${tablesMetaJson};
    const r2Meta = ${r2MetaJson};

    let selectedUserId = allUsers.length > 0 ? allUsers[0].user.id : null;
    let currentView = 'global';

    // Toggle Sidebar
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

    // Basculer de vue
    function switchView(viewName) {
      currentView = viewName;
      ['global', 'users', 'demandes', 'messages'].forEach(v => {
        const el = document.getElementById('view-' + v);
        const navBtn = document.getElementById('nav-btn-' + v);
        if (v === viewName) {
          el.classList.remove('hidden');
          navBtn.className = "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-orange-600 text-white font-bold transition-all text-left shadow-md shadow-orange-600/20";
        } else {
          el.classList.add('hidden');
          navBtn.className = "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-slate-300 hover:bg-slate-800/80 transition-all text-left";
        }
      });

      const badge = document.getElementById('current-view-badge');
      if (viewName === 'global') badge.textContent = 'Vue Globale';
      else if (viewName === 'users') badge.textContent = 'Tous les Utilisateurs';
      else if (viewName === 'demandes') badge.textContent = 'Demandes de Stockage';
      else if (viewName === 'messages') badge.textContent = 'Messages';

      // Fermer le drawer mobile si ouvert
      const drawer = document.getElementById('sidebar-drawer');
      if (drawer.classList.contains('open')) toggleSidebar();

      if (viewName === 'users') {
        renderUsersLeftList();
        renderUserRightDetails(selectedUserId);
      } else if (viewName === 'demandes') {
        renderSimpleUsersList('demandes-users-left-list');
      } else if (viewName === 'messages') {
        renderSimpleUsersList('messages-users-left-list');
      }
    }

    // Basculer l'accordéon
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

    // Rendu des tables D1 globales (avec accordéon)
    function renderGlobalD1Tables(filterText = '') {
      const container = document.getElementById('d1-tables-accordion-list');
      const q = (filterText || '').toLowerCase().trim();

      const filtered = tablesMeta.filter(t => {
        if (!q) return true;
        return t.table.toLowerCase().includes(q) ||
               t.label.toLowerCase().includes(q) ||
               t.uiConnection.toLowerCase().includes(q) ||
               t.role.toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-slate-500 text-xs">Aucune table ne correspond à votre recherche.</div>';
        return;
      }

      container.innerHTML = filtered.map((t, i) => {
        const stats = d1TablesGlobal[t.table] || { count: 0, bytes: 0, formatted: '0 Octets' };
        const accId = 'acc-d1-global-' + i;

        return \`
          <div class="hover:bg-slate-800/30 transition-colors">
            <!-- Ligne cliquable de la table -->
            <div 
              onclick="toggleAccordion('\${accId}')"
              class="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none"
            >
              <div class="flex items-center gap-3">
                <span class="font-mono font-bold text-xs text-white bg-slate-800 px-2 py-1 rounded border border-slate-700">\${t.table}</span>
                <span class="text-xs font-semibold text-slate-300 hidden sm:inline">\${t.label}</span>
              </div>

              <div class="flex items-center gap-4">
                <div class="text-right">
                  <span class="text-xs font-mono font-bold text-emerald-400">\${stats.formatted}</span>
                  <span class="text-[11px] font-mono text-slate-400 ml-2">(\${stats.count.toLocaleString()} lignes)</span>
                </div>
                <svg id="\${accId}-icon" class="w-4 h-4 text-slate-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>

            <!-- Contenu déroulant de la table -->
            <div id="\${accId}" class="accordion-content bg-[#090e1a] border-t border-slate-800/60 px-5 text-xs text-slate-300">
              <div class="py-4 space-y-3 font-normal leading-relaxed">
                <div>
                  <span class="font-bold text-emerald-400 uppercase tracking-wider text-[10px] block mb-0.5">📍 Où est connectée cette table sur l'interface utilisateur :</span>
                  <p class="text-slate-200">\${t.uiConnection}</p>
                </div>
                <div>
                  <span class="font-bold text-blue-400 uppercase tracking-wider text-[10px] block mb-0.5">🎯 Rôle dans l'application StudyCloud :</span>
                  <p class="text-slate-200">\${t.role}</p>
                </div>
                <div>
                  <span class="font-bold text-amber-400 uppercase tracking-wider text-[10px] block mb-0.5">⚙️ Utilisation & Déclenchement :</span>
                  <p class="text-slate-300">\${t.usage}</p>
                </div>
                <div>
                  <span class="font-bold text-purple-400 uppercase tracking-wider text-[10px] block mb-0.5">📝 Exemple concret de données stockées :</span>
                  <pre class="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">\${t.example}</pre>
                </div>
              </div>
            </div>
          </div>
        \`;
      }).join('');
    }

    // Rendu des dossiers R2 globaux (avec accordéon)
    function renderGlobalR2Folders(filterText = '') {
      const container = document.getElementById('r2-folders-accordion-list');
      const q = (filterText || '').toLowerCase().trim();

      const filtered = r2Meta.filter(r => {
        if (!q) return true;
        return r.folder.toLowerCase().includes(q) ||
               r.name.toLowerCase().includes(q) ||
               r.uiConnection.toLowerCase().includes(q) ||
               r.role.toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="p-6 text-center text-slate-500 text-xs">Aucun dossier ne correspond à votre recherche.</div>';
        return;
      }

      container.innerHTML = filtered.map((r, i) => {
        const stats = r2FoldersGlobal[r.folder] || { count: 0, bytes: 0, formatted: '0 Octets' };
        const accId = 'acc-r2-global-' + i;

        return \`
          <div class="hover:bg-slate-800/30 transition-colors">
            <!-- Ligne cliquable du dossier R2 -->
            <div 
              onclick="toggleAccordion('\${accId}')"
              class="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none"
            >
              <div class="flex items-center gap-3">
                <span class="font-mono font-bold text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">\${r.folder}</span>
                <span class="text-xs font-semibold text-slate-300 hidden sm:inline">\${r.name}</span>
              </div>

              <div class="flex items-center gap-4">
                <div class="text-right">
                  <span class="text-xs font-mono font-bold text-orange-400">\${stats.formatted}</span>
                  <span class="text-[11px] font-mono text-slate-400 ml-2">(\${stats.count} fichier(s))</span>
                </div>
                <svg id="\${accId}-icon" class="w-4 h-4 text-slate-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>

            <!-- Contenu déroulant du dossier R2 -->
            <div id="\${accId}" class="accordion-content bg-[#090e1a] border-t border-slate-800/60 px-5 text-xs text-slate-300">
              <div class="py-4 space-y-3 font-normal leading-relaxed">
                <div>
                  <span class="font-bold text-orange-400 uppercase tracking-wider text-[10px] block mb-0.5">📍 Où est connecté ce dossier sur l'interface utilisateur :</span>
                  <p class="text-slate-200">\${r.uiConnection}</p>
                </div>
                <div>
                  <span class="font-bold text-blue-400 uppercase tracking-wider text-[10px] block mb-0.5">🎯 Rôle dans le stockage StudyCloud :</span>
                  <p class="text-slate-200">\${r.role}</p>
                </div>
                <div>
                  <span class="font-bold text-emerald-400 uppercase tracking-wider text-[10px] block mb-0.5">⚙️ Utilisation & Cycle de vie :</span>
                  <p class="text-slate-300">\${r.usage}</p>
                </div>
                <div>
                  <span class="font-bold text-purple-400 uppercase tracking-wider text-[10px] block mb-0.5">📝 Exemples concrets de fichiers hébergés :</span>
                  <p class="font-mono text-slate-300 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">\${r.examples}</p>
                </div>
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
    // LOGIQUE DE LA VUE DIVISÉE "TOUT LES UTILISATEURS"
    // ========================================================================
    function renderUsersLeftList(filterText = '') {
      const container = document.getElementById('users-left-list');
      const q = (filterText || '').toLowerCase().trim();

      const filtered = allUsers.filter(item => {
        if (!q) return true;
        const u = item.user;
        return (u.name && u.name.toLowerCase().includes(q)) ||
               (u.email && u.email.toLowerCase().includes(q)) ||
               (u.school && u.school.toLowerCase().includes(q));
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-slate-500">Aucun utilisateur trouvé.</div>';
        return;
      }

      container.innerHTML = filtered.map(item => {
        const u = item.user;
        const s = item.storage;
        const isSelected = u.id === selectedUserId;

        return \`
          <div 
            onclick="selectUser('\${u.id}')"
            class="p-3 cursor-pointer transition-all flex items-center justify-between \${isSelected ? 'bg-orange-600/15 border-l-4 border-l-orange-500' : 'hover:bg-slate-800/40'}"
          >
            <div class="flex items-center gap-2.5 overflow-hidden">
              <div class="w-8 h-8 rounded-lg bg-slate-800 text-orange-400 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-700">
                \${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full rounded-lg object-cover" onerror="this.remove()">' : u.name.charAt(0).toUpperCase()}
              </div>
              <div class="truncate">
                <div class="font-bold text-white truncate">\${u.name}</div>
                <div class="text-[11px] text-slate-400 truncate">\${u.email || u.school || 'Sans email'}</div>
              </div>
            </div>

            <div class="text-right shrink-0 font-mono font-bold text-[11px] text-orange-400">
              \${s.totalFormatted}
            </div>
          </div>
        \`;
      }).join('');
    }

    function filterUsersLeft() {
      const q = document.getElementById('users-search-left').value;
      renderUsersLeftList(q);
    }

    function selectUser(userId) {
      selectedUserId = userId;
      renderUsersLeftList(document.getElementById('users-search-left').value);
      renderUserRightDetails(userId);
    }

    // Rendu complet du stockage d'un utilisateur sur la colonne de droite
    function renderUserRightDetails(userId) {
      const panel = document.getElementById('user-details-right-panel');
      const item = allUsers.find(x => x.user.id === userId);
      if (!item) {
        panel.innerHTML = '<div class="py-20 text-center text-slate-500">Utilisateur non trouvé.</div>';
        return;
      }

      const u = item.user;
      const s = item.storage;
      const r2 = s.r2;
      const d1 = s.d1;

      panel.innerHTML = \`
        <!-- En-tête profil de l'utilisateur -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-orange-500/20 text-orange-400 font-black flex items-center justify-center border border-orange-500/30 text-xl shrink-0">
              \${u.avatar_url ? '<img src="' + u.avatar_url + '" class="w-full h-full rounded-xl object-cover" onerror="this.remove()">' : u.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 class="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                \${u.name}
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-normal">ID: \${u.id}</span>
              </h3>
              <p class="text-xs text-slate-400">\${u.email} • \${u.school || 'École non renseignée'} (\${u.filiere || u.country})</p>
            </div>
          </div>

          <div class="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-3 py-1.5 rounded-lg border border-orange-500/20 self-start sm:self-auto">
            Total : \${s.totalFormatted} / \${s.quotaFormatted} (\${s.usagePercentage}%)
          </div>
        </div>

        <!-- 4 CARRÉS PERSONNELS POUR CET UTILISATEUR -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 border-l-4 border-l-blue-500">
            <span class="text-[10px] uppercase font-bold text-slate-400">Fichiers Perso</span>
            <div class="text-lg font-black text-white mt-1">\${(r2.folders['user-files/']?.count || 0) + (r2.folders['ai-studies/']?.count || 0)}</div>
            <div class="text-[10px] text-blue-400 mt-0.5 font-medium">\${r2.folders['user-files/']?.count || 0} cours, \${r2.folders['ai-studies/']?.count || 0} IA</div>
          </div>

          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 border-l-4 border-l-orange-500">
            <span class="text-[10px] uppercase font-bold text-slate-400">Volume R2 Perso</span>
            <div class="text-lg font-black text-orange-400 mt-1">\${r2.totalFormatted}</div>
            <div class="text-[10px] text-slate-400 mt-0.5 font-medium">Limite : 10 Go Cloudflare</div>
          </div>

          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 border-l-4 border-l-emerald-500">
            <span class="text-[10px] uppercase font-bold text-slate-400">Volume D1 Perso</span>
            <div class="text-lg font-black text-emerald-400 mt-1">\${d1.totalFormatted}</div>
            <div class="text-[10px] text-slate-400 mt-0.5 font-medium">\${d1.totalRows} lignes SQL</div>
          </div>

          <div class="bg-slate-900/90 p-3 rounded-xl border border-slate-800 border-l-4 border-l-purple-500">
            <span class="text-[10px] uppercase font-bold text-slate-400">Quota Utilisé</span>
            <div class="text-lg font-black text-purple-400 mt-1">\${s.usagePercentage}%</div>
            <div class="text-[10px] text-purple-300 mt-0.5 font-medium">Formule : Standard (1 Go)</div>
          </div>
        </div>

        <!-- 3 BARRES DE PROGRESSION PERSONNELLES POUR CET UTILISATEUR -->
        <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
          <span class="text-xs font-bold text-white block">📊 Consommation Personnelle de cet Utilisateur</span>
          
          <div class="space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-slate-300 font-semibold">Stockage Total Utilisateur (R2 + D1)</span>
              <span class="font-mono text-orange-400 font-bold">\${s.totalFormatted} / \${s.quotaFormatted} (\${s.usagePercentage}%)</span>
            </div>
            <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-orange-500 rounded-full" style="width: \${Math.max(1, s.usagePercentage)}%"></div>
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-slate-300 font-semibold">Stockage R2 (Fichiers physiques personnels)</span>
              <span class="font-mono text-blue-400 font-bold">\${r2.totalFormatted}</span>
            </div>
            <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 rounded-full" style="width: \${Math.max(1, Math.min(100, (r2.totalBytes / (1024 * 1024 * 1024)) * 100))}%"></div>
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex justify-between text-[11px]">
              <span class="text-slate-300 font-semibold">Base D1 (Lignes & Données SQL de l'utilisateur)</span>
              <span class="font-mono text-emerald-400 font-bold">\${d1.totalFormatted} (\${d1.totalRows} lignes)</span>
            </div>
            <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-emerald-500 rounded-full" style="width: \${Math.max(1, Math.min(100, (d1.totalBytes / (50 * 1024 * 1024)) * 100))}%"></div>
            </div>
          </div>
        </div>

        <!-- SECTION : TOUTES LES TABLES D1 DE CET UTILISATEUR (AVEC ACCORDÉON) -->
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <span>🗄️</span> Lignes et Poids de cet Utilisateur dans Chaque Table D1
          </h4>
          <div class="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800/80">
            \${tablesMeta.map((t, idx) => {
              const stats = d1.tables[t.table] || { count: 0, bytes: 0, formatted: '0 Octets' };
              const accId = 'acc-user-d1-' + idx;
              return \`
                <div>
                  <div 
                    onclick="toggleAccordion('\${accId}')"
                    class="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 select-none text-xs"
                  >
                    <div class="flex items-center gap-2.5">
                      <span class="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-[11px]">\${t.table}</span>
                      <span class="text-slate-300 text-[11px] truncate max-w-[200px] sm:max-w-none">\${t.label}</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="font-mono font-bold text-emerald-400">\${stats.formatted}</span>
                      <span class="font-mono text-slate-400 text-[11px]">(\${stats.count} lignes)</span>
                      <svg id="\${accId}-icon" class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>

                  <div id="\${accId}" class="accordion-content bg-[#070b14] border-t border-slate-800/60 px-4 text-xs text-slate-300">
                    <div class="py-3 space-y-2 text-[11px]">
                      <div><strong class="text-emerald-400">📍 Connexion UI :</strong> \${t.uiConnection}</div>
                      <div><strong class="text-blue-400">🎯 Rôle :</strong> \${t.role}</div>
                      <div><strong class="text-amber-400">⚙️ Utilisation :</strong> \${t.usage}</div>
                    </div>
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        </div>

        <!-- SECTION : TOUS LES DOSSIERS R2 DE CET UTILISATEUR (AVEC ACCORDÉON) -->
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
            <span>📦</span> Fichiers Réels de cet Utilisateur dans Cloudflare R2
          </h4>
          <div class="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800/80">
            \${r2Meta.map((r, idx) => {
              const stats = r2.folders[r.folder] || { count: 0, bytes: 0, formatted: '0 Octets' };
              const accId = 'acc-user-r2-' + idx;
              return \`
                <div>
                  <div 
                    onclick="toggleAccordion('\${accId}')"
                    class="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 select-none text-xs"
                  >
                    <div class="flex items-center gap-2.5">
                      <span class="font-mono font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 text-[11px]">\${r.folder}</span>
                      <span class="text-slate-300 text-[11px] truncate max-w-[200px] sm:max-w-none">\${r.name}</span>
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="font-mono font-bold text-orange-400">\${stats.formatted}</span>
                      <span class="font-mono text-slate-400 text-[11px]">(\${stats.count} fichier(s))</span>
                      <svg id="\${accId}-icon" class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>

                  <div id="\${accId}" class="accordion-content bg-[#070b14] border-t border-slate-800/60 px-4 text-xs text-slate-300">
                    <div class="py-3 space-y-2 text-[11px]">
                      <div><strong class="text-orange-400">📍 Connexion UI :</strong> \${r.uiConnection}</div>
                      <div><strong class="text-blue-400">🎯 Rôle :</strong> \${r.role}</div>
                      <div><strong class="text-purple-400">📝 Exemples :</strong> \${r.examples}</div>
                    </div>
                  </div>
                </div>
              \`;
            }).join('')}
          </div>
        </div>
      \`;
    }

    function renderSimpleUsersList(containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = allUsers.map(item => {
        const u = item.user;
        const s = item.storage;
        return \`
          <div class="p-3 hover:bg-slate-800/40 flex items-center justify-between">
            <div class="truncate">
              <div class="font-bold text-white truncate">\${u.name}</div>
              <div class="text-[11px] text-slate-400 truncate">\${u.email || 'Sans email'}</div>
            </div>
            <span class="text-[11px] font-mono font-bold text-orange-400 shrink-0">\${s.totalFormatted}</span>
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

    try {
      // 1. Récupération de tous les utilisateurs
      const usersQuery = await safeQuery(db, `
        SELECT id, name, email, school, filiere, country, level, bio, avatar_url, created_at, last_active_at 
        FROM users 
        ORDER BY created_at DESC
      `, [], { results: [] });

      const rawUsers = usersQuery && usersQuery.results ? usersQuery.results : [];

      // 2. Inspection du stockage pour chaque utilisateur
      const detailedUsers = [];
      let globalR2Bytes = 0;
      let globalD1Bytes = 0;
      let globalD1Rows = 0;

      for (const u of rawUsers) {
        const detail = await inspectUserStorageDetail(db, bucket, u);
        detailedUsers.push(detail);

        globalR2Bytes += detail.storage.r2.totalBytes || 0;
        globalD1Bytes += detail.storage.d1.totalBytes || 0;
        globalD1Rows += detail.storage.d1.totalRows || 0;
      }

      // 3. Inspection globale des tables D1 et des dossiers R2
      const d1TablesGlobal = await inspectAllD1TablesGlobal(db);
      const r2FoldersGlobal = await inspectAllR2FoldersGlobal(db, detailedUsers);

      // 4. Synthèse globale de l'application
      const globalSummary = {
        totalUsers: detailedUsers.length,
        totalStorageBytes: globalR2Bytes + globalD1Bytes,
        totalStorageFormatted: formatBytes(globalR2Bytes + globalD1Bytes),
        totalR2Bytes: globalR2Bytes,
        totalR2Formatted: formatBytes(globalR2Bytes),
        totalD1Bytes: globalD1Bytes,
        totalD1Formatted: formatBytes(globalD1Bytes),
        totalD1Rows: globalD1Rows,
        averageBytesPerUser: detailedUsers.length > 0 ? Math.round((globalR2Bytes + globalD1Bytes) / detailedUsers.length) : 0,
        averageFormatted: detailedUsers.length > 0 ? formatBytes(Math.round((globalR2Bytes + globalD1Bytes) / detailedUsers.length)) : '0 Octets',
        cloudflareR2FreeQuota: '10 Go (10737418240 Octets)',
        cloudflareD1FreeQuota: '5 Go (5368709120 Octets)',
        estimatedCostUsd: '0.00 $ (Inclus dans les quotas gratuits)'
      };

      // ----------------------------------------------------------------------
      // ROUTE API : /api/overview (Synthèse globale JSON)
      // ----------------------------------------------------------------------
      if (path === '/api/overview') {
        return new Response(JSON.stringify({ 
          success: true, 
          summary: globalSummary,
          d1Tables: d1TablesGlobal,
          r2Folders: r2FoldersGlobal
        }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE API : /api/users ou /api/storage/users (Tous les utilisateurs en JSON)
      // ----------------------------------------------------------------------
      if (path === '/api/users' || path === '/api/storage/users') {
        return new Response(JSON.stringify({ success: true, summary: globalSummary, users: detailedUsers }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE API : /api/users/:id (Détail complet d'un utilisateur spécifique)
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/users/')) {
        const targetId = decodeURIComponent(path.replace('/api/users/', ''));
        const found = detailedUsers.find(x => x.user.id === targetId);
        if (!found) {
          return new Response(JSON.stringify({ success: false, error: 'Utilisateur non trouvé' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
          });
        }
        return new Response(JSON.stringify({ success: true, data: found }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
        });
      }

      // ----------------------------------------------------------------------
      // ROUTE PAR DÉFAUT : Page Web Tableau de Bord (HTML)
      // ----------------------------------------------------------------------
      const htmlContent = renderDashboardHtml({
        summary: globalSummary,
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

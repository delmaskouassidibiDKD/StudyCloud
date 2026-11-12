/**
 * Worker Cloudflare dédié : Portail Juridique & Conditions d'Utilisation — DKD Technologies
 * Héberge de manière autonome les Conditions d'Utilisation (CGU), Politiques de Confidentialité
 * et Mentions Légales pour StudyCloud et les futures applications de DKD Technologies.
 *
 * Avantages :
 * - Complètement indépendant du cycle de déploiement de StudyCloud
 * - Extensible multi-applications (ex: ?app=studycloud ou /studycloud/...)
 * - Page blanche éditoriale plein écran style Cloudflare
 */

export interface Env {}

type LegalTab = 'cgu' | 'privacy' | 'mentions';

interface SectionDef {
  id: string;
  label: string;
}

interface AppLegalConfig {
  id: string;
  namePart1: string;
  namePart2: string;
  company: string;
  founder: string;
  version: string;
  effectiveDate: string;
  defaultReturnUrl: string;
  supportEmails: string[];
  sections: Record<LegalTab, SectionDef[]>;
  titles: Record<LegalTab, { pageTitle: string; sidebarTitle: string; heading: string; dateNote: string; intro: string }>;
}

const STUDYCLOUD_CONFIG: AppLegalConfig = {
  id: 'studycloud',
  namePart1: 'Study',
  namePart2: 'Cloud',
  company: 'DKD Technologies',
  founder: 'Dibi Kouassi Delmas',
  version: 'Version 4.3 — Novembre 2026',
  effectiveDate: 'Les présentes conditions entrent en vigueur en novembre 2026.',
  defaultReturnUrl: 'https://studycloud.dkd-technologies.com',
  supportEmails: ['contact@dkd-technologies.com', 'support@studycloud.app'],
  sections: {
    cgu: [
      { id: 'overview', label: 'Aperçu & Mission' },
      { id: 'marketplace', label: 'Boutiques & Vente de documents' },
      { id: 'scam', label: 'Transactions & Exonération' },
      { id: 'resources', label: 'Menu Ressources & Signalement' },
      { id: 'storage', label: 'Stockage Cloud & Impayés' },
      { id: 'ai', label: 'Fonctionnalités IA & Crédits' },
      { id: 'security', label: 'Sécurité, Attaques & Maintenances' },
    ],
    privacy: [
      { id: 'privacy-overview', label: 'Aperçu de la politique' },
      { id: 'data-collected', label: 'Données recueillies' },
      { id: 'non-sale', label: 'Engagements de non-revente' },
      { id: 'cookies-pwa', label: 'Cookies, Stockage local & PWA' },
      { id: 'account-deletion', label: "Droit à l'effacement & Suppression" },
    ],
    mentions: [
      { id: 'publisher', label: 'Éditeur & Fondateur' },
      { id: 'ip', label: 'Propriété intellectuelle' },
      { id: 'law', label: 'Droit applicable & Contact' },
    ],
  },
  titles: {
    cgu: {
      pageTitle: "Conditions d'utilisation — StudyCloud | DKD Technologies",
      sidebarTitle: "conditions d'utilisation",
      heading: "Conditions générales d'utilisation de StudyCloud",
      dateNote: 'Les présentes conditions entrent en vigueur en novembre 2026.',
      intro: 'Édité par la société DKD Technologies — Plateforme créée et conçue par Dibi Kouassi Delmas, étudiant ivoirien en électrotechnique.',
    },
    privacy: {
      pageTitle: 'Politique de confidentialité — StudyCloud | DKD Technologies',
      sidebarTitle: 'politique de confidentialité',
      heading: 'Politique de confidentialité de StudyCloud',
      dateNote: 'La présente politique de confidentialité entre en vigueur en novembre 2026.',
      intro: 'La présente politique de confidentialité de StudyCloud (« Politique ») décrit les informations personnelles que DKD Technologies (« nous », « notre » ou « nos ») recueille, la manière dont nous utilisons ces informations et les droits dont vous disposez pour y accéder, les corriger ou les supprimer définitivement.',
    },
    mentions: {
      pageTitle: 'Mentions légales — StudyCloud | DKD Technologies',
      sidebarTitle: 'mentions légales',
      heading: 'Mentions légales de StudyCloud',
      dateNote: "Informations officielles d'identification de l'éditeur.",
      intro: "Transparence légale et identification officielle de l'éditeur de la plateforme StudyCloud.",
    },
  },
};

// Registre multi-applications extensible (ajoutez vos futures applications DKD Technologies ici)
const APPS_REGISTRY: Record<string, AppLegalConfig> = {
  studycloud: STUDYCLOUD_CONFIG,
};

function sanitizeReturnUrl(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return fallback;
    const host = parsed.hostname.toLowerCase();
    const isAllowed =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.dkd-technologies.com') ||
      host === 'dkd-technologies.com' ||
      host.endsWith('.studycloud.app') ||
      host === 'studycloud.app';
    return isAllowed ? parsed.toString() : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLegalHtml(app: AppLegalConfig, initialTab: LegalTab, returnUrl: string): string {
  const safeReturnUrl = escapeHtml(returnUrl);
  const currentTitle = app.titles[initialTab].pageTitle;

  const sectionsDataJson = JSON.stringify(app.sections).replace(/</g, '\\u003c');
  const titlesDataJson = JSON.stringify(app.titles).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(currentTitle)}</title>
  <meta name="description" content="Conditions générales d'utilisation, politique de confidentialité et mentions légales officielles de ${escapeHtml(app.namePart1 + app.namePart2)} — ${escapeHtml(app.company)}." />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; color-scheme: light; }
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #1d1d1f;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      line-height: 1.6;
    }

    /* En-tête blanc fixe style Cloudflare */
    .sc-header {
      position: sticky;
      top: 0;
      z-index: 40;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      height: 72px;
      padding: 0 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .sc-header-left {
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .sc-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
    }
    .sc-logo-box {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 1px 2px rgba(0,0,0,0.08);
    }
    .sc-brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1;
    }
    .sc-brand-name {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: -0.02em;
    }
    .sc-brand-name .part1 { color: #ea580c; }
    .sc-brand-name .part2 { color: #2563eb; }
    .sc-brand-sub {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #6b7280;
      text-transform: uppercase;
      margin-top: 3px;
    }

    /* Navigation desktop top */
    .sc-nav {
      display: flex;
      align-items: center;
      gap: 4px;
      border-left: 1px solid #e5e7eb;
      padding-left: 24px;
    }
    .sc-nav-btn {
      background: transparent;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #4b5563;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
      font-family: inherit;
    }
    .sc-nav-btn:hover {
      background: #f9fafb;
      color: #111827;
    }
    .sc-nav-btn.active {
      background: #fff7ed;
      color: #ea580c;
    }

    .sc-header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sc-return-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid #d1d5db;
      background: #ffffff;
      color: #1f2937;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: background-color 0.15s;
      white-space: nowrap;
    }
    .sc-return-btn:hover { background: #f9fafb; }

    .sc-burger-btn {
      display: none;
      padding: 8px;
      border-radius: 8px;
      border: 1px solid #d1d5db;
      background: #ffffff;
      color: #374151;
      cursor: pointer;
    }

    /* Sous-barre mobile des onglets */
    .sc-mobile-tabs {
      display: none;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      padding: 8px 16px;
      gap: 8px;
      overflow-x: auto;
    }
    .sc-mobile-tab-btn {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      border: 1px solid #e5e7eb;
      background: #ffffff;
      color: #4b5563;
      cursor: pointer;
      font-family: inherit;
    }
    .sc-mobile-tab-btn.active {
      background: #111827;
      color: #ffffff;
      border-color: #111827;
    }

    /* Menu Sommaire mobile déroulant */
    .sc-mobile-drawer {
      display: none;
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      padding: 16px 24px;
    }
    .sc-mobile-drawer.open { display: block; }
    .sc-mobile-drawer-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9ca3af;
      margin: 0 0 10px 0;
    }
    .sc-mobile-sec-link {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      border-left: 2px solid transparent;
      padding: 6px 0 6px 12px;
      font-size: 14px;
      color: #4b5563;
      cursor: pointer;
      font-family: inherit;
    }
    .sc-mobile-sec-link.active {
      border-left-color: #ea580c;
      color: #111827;
      font-weight: 600;
    }

    /* Grille éditoriale principale */
    .sc-container {
      max-width: 1152px;
      margin: 0 auto;
      padding: 48px 32px 80px 32px;
      display: flex;
      gap: 64px;
      align-items: flex-start;
    }

    /* Sidebar gauche sticky */
    .sc-sidebar {
      width: 270px;
      flex-shrink: 0;
      position: sticky;
      top: 104px;
    }
    .sc-sidebar-heading {
      font-size: 18px;
      font-weight: 500;
      color: #111827;
      letter-spacing: -0.01em;
      margin: 0 0 18px 0;
    }
    .sc-sidebar-links {
      border-right: 1px solid #e5e7eb;
      padding-right: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sc-sidebar-link {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      padding: 0;
      font-size: 15px;
      line-height: 1.4;
      color: #4b5563;
      text-decoration: underline;
      text-decoration-color: #d1d5db;
      text-underline-offset: 4px;
      cursor: pointer;
      font-family: inherit;
      transition: color 0.15s;
    }
    .sc-sidebar-link:hover {
      color: #111827;
    }
    .sc-sidebar-link.active {
      color: #111827;
      font-weight: 600;
      text-decoration-color: #111827;
    }
    .sc-sidebar-meta {
      margin-top: 24px;
      padding-top: 16px;
      padding-right: 16px;
      border-top: 1px solid #f3f4f6;
      font-size: 12px;
      color: #9ca3af;
    }
    .sc-sidebar-meta p { margin: 4px 0; }

    /* Corps éditorial blanc */
    .sc-main {
      flex: 1;
      max-width: 760px;
      min-width: 0;
    }
    .sc-doc-header {
      padding-bottom: 32px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 36px;
    }
    .sc-doc-title {
      font-size: 40px;
      font-weight: 400;
      letter-spacing: -0.02em;
      color: #111827;
      line-height: 1.15;
      margin: 0 0 16px 0;
    }
    .sc-doc-date {
      font-size: 16px;
      color: #4b5563;
      margin: 0 0 12px 0;
    }
    .sc-doc-intro {
      font-size: 15px;
      font-style: italic;
      color: #4b5563;
      line-height: 1.65;
      margin: 0;
    }

    .sc-section {
      scroll-margin-top: 96px;
      margin-bottom: 36px;
    }
    .sc-section + .sc-section {
      padding-top: 24px;
      border-top: 1px solid #f3f4f6;
    }
    .sc-section h2 {
      font-size: 24px;
      font-weight: 400;
      letter-spacing: -0.01em;
      color: #111827;
      margin: 0 0 16px 0;
    }
    .sc-section p {
      font-size: 16px;
      line-height: 1.7;
      color: #374151;
      margin: 0 0 14px 0;
    }
    .sc-section ul {
      padding-left: 24px;
      margin: 0 0 16px 0;
    }
    .sc-section ul.sc-no-bullets {
      list-style: none;
      padding-left: 0;
    }
    .sc-section li {
      font-size: 16px;
      line-height: 1.7;
      color: #374151;
      margin-bottom: 8px;
    }

    .sc-tab-panel { display: none; }
    .sc-tab-panel.active { display: block; }

    /* Responsive Mobile & Tablette */
    @media (max-width: 768px) {
      .sc-header {
        height: 64px;
        padding: 0 16px;
      }
      .sc-nav { display: none; }
      .sc-burger-btn { display: inline-flex; align-items: center; justify-content: center; }
      .sc-return-btn span { display: none; }
      .sc-mobile-tabs { display: flex; }
      .sc-container {
        padding: 28px 20px 64px 20px;
        gap: 0;
      }
      .sc-sidebar { display: none; }
      .sc-doc-title { font-size: 28px; }
      .sc-section h2 { font-size: 20px; }
      .sc-section p, .sc-section li { font-size: 15px; }
    }
  </style>
</head>
<body>

  <!-- BARRE SUPÉRIEURE BLANCHE -->
  <header class="sc-header">
    <div class="sc-header-left">
      <a href="${safeReturnUrl}" class="sc-brand">
        <div class="sc-logo-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3C8 3 8 10 12 12C16 14 16 21 16 21" stroke="#F38020" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M16 3C16 3 16 10 12 12C8 14 8 21 8 21" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="10" y1="6" x2="14" y2="6" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
            <line x1="11" y1="12" x2="13" y2="12" stroke="#F38020" stroke-width="3" stroke-linecap="round"/>
            <line x1="10" y1="18" x2="14" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
          </svg>
        </div>
        <div class="sc-brand-text">
          <div class="sc-brand-name"><span class="part1">${escapeHtml(app.namePart1)}</span><span class="part2">${escapeHtml(app.namePart2)}</span></div>
          <div class="sc-brand-sub">${escapeHtml(app.company)}</div>
        </div>
      </a>

      <nav class="sc-nav" aria-label="Documents légaux">
        <button type="button" class="sc-nav-btn${initialTab === 'cgu' ? ' active' : ''}" data-tab="cgu">Conditions d'utilisation</button>
        <button type="button" class="sc-nav-btn${initialTab === 'privacy' ? ' active' : ''}" data-tab="privacy">Politique de confidentialité</button>
        <button type="button" class="sc-nav-btn${initialTab === 'mentions' ? ' active' : ''}" data-tab="mentions">Mentions légales</button>
      </nav>
    </div>

    <div class="sc-header-right">
      <a href="${safeReturnUrl}" class="sc-return-btn" id="sc-return-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        <span>Retourner sur ${escapeHtml(app.namePart1 + app.namePart2)}</span>
      </a>
      <button type="button" class="sc-burger-btn" id="sc-burger-btn" aria-label="Sommaire">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
      </button>
    </div>
  </header>

  <!-- SOUS-BARRE MOBILE -->
  <div class="sc-mobile-tabs">
    <button type="button" class="sc-mobile-tab-btn${initialTab === 'cgu' ? ' active' : ''}" data-tab="cgu">Conditions d'utilisation</button>
    <button type="button" class="sc-mobile-tab-btn${initialTab === 'privacy' ? ' active' : ''}" data-tab="privacy">Politique de confidentialité</button>
    <button type="button" class="sc-mobile-tab-btn${initialTab === 'mentions' ? ' active' : ''}" data-tab="mentions">Mentions légales</button>
  </div>

  <!-- TIROIR SOMMAIRE MOBILE -->
  <div class="sc-mobile-drawer" id="sc-mobile-drawer">
    <p class="sc-mobile-drawer-title">Sommaire du document</p>
    <div id="sc-mobile-sections"></div>
  </div>

  <!-- CONTENU PRINCIPAL PLEIN ÉCRAN -->
  <div class="sc-container">
    <!-- SIDEBAR GAUCHE STICKY -->
    <aside class="sc-sidebar">
      <p class="sc-sidebar-heading" id="sc-sidebar-heading">${escapeHtml(app.titles[initialTab].sidebarTitle)}</p>
      <div class="sc-sidebar-links" id="sc-sidebar-links"></div>
      <div class="sc-sidebar-meta">
        <p>${escapeHtml(app.version)}</p>
        <p>Éditeur : ${escapeHtml(app.company)}</p>
        <p>Fondateur : ${escapeHtml(app.founder)}</p>
      </div>
    </aside>

    <!-- CORPS ÉDITORIAL -->
    <main class="sc-main">

      <!-- ============== ONGLET 1 : CONDITIONS D'UTILISATION ============== -->
      <div id="panel-cgu" class="sc-tab-panel${initialTab === 'cgu' ? ' active' : ''}">
        <header class="sc-doc-header">
          <h1 class="sc-doc-title">${escapeHtml(app.titles.cgu.heading)}</h1>
          <p class="sc-doc-date">${escapeHtml(app.titles.cgu.dateNote)}</p>
          <p class="sc-doc-intro">${escapeHtml(app.titles.cgu.intro)}</p>
        </header>

        <section id="sec-overview" class="sc-section">
          <h2>1. Aperçu et mission de la plateforme</h2>
          <p>
            Les présentes Conditions Générales d'Utilisation (« Conditions ») régissent l'accès et l'utilisation du site web et des services de <strong>StudyCloud</strong> (« nous », « notre » ou « DKD Technologies »).
          </p>
          <div style="margin-top: 1.25rem; margin-bottom: 0.75rem;">
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem;">2.1 Présentation de StudyCloud</h3>
            <p>StudyCloud est un écosystème numérique tout-en-un offrant :</p>
          </div>
          <ul>
            <li><strong>Un explorateur et un hub de ressources &amp; pépites du web :</strong> Sélection et partage d'outils incontournables d'Internet, de liens pratiques, de logiciels et d'astuces pour optimiser le travail et l'apprentissage.</li>
            <li><strong>Une place de marché &amp; Création de boutique :</strong> Possibilité pour les utilisateurs de créer leur propre boutique pour vendre des documents numériques, fiches ou contenus originaux.</li>
            <li><strong>Un espace d'organisation et d'étude :</strong> Classeur 3D, gestion par matières, calendrier, emplois du temps, bloc-notes, visionneuses de documents et lecteurs multimédias.</li>
            <li><strong>Un stockage Cloud sécurisé :</strong> Espace en ligne personnel pour sauvegarder ses documents, photos, audios et vidéos accessibles partout.</li>
            <li><strong>Des fonctionnalités d'Intelligence Artificielle intégrées :</strong> Outils de génération de synthèses, devoirs guidés, questionnaires d'entraînement et aide à la rédaction.</li>
            <li><strong>Un portail de partage direct (StudyCloud Share) :</strong> Création instantanée de liens de partage pour distribuer des dossiers en un clic.</li>
          </ul>
        </section>

        <section id="sec-marketplace" class="sc-section">
          <h2>2. Création de boutique et vente de documents</h2>
          <p>
            StudyCloud met à disposition des outils techniques permettant à tout utilisateur d'ouvrir sa propre boutique et de commercialiser des documents numériques (fiches, résumés, guides pratiques, cours personnels).
          </p>
          <p>
            <strong>Interdiction formelle des contenus protégés et illicites :</strong> Il est strictement interdit de vendre, sans autorisation écrite préalable des ayants droit, des documents soumis au droit d'auteur (livres scannés, manuels scolaires ou universitaires protégés, œuvres tierces). Il est également formellement interdit de vendre ou diffuser tout contenu pornographique, érotique, violent, haineux ou frauduleux.
          </p>
          <p>
            Le créateur de la boutique garantit qu'il détient l'entière propriété intellectuelle des fichiers proposés à la vente. En cas d'infraction constatée, la boutique sera fermée immédiatement, le compte utilisateur définitivement banni et les faits signalés si nécessaire.
          </p>
        </section>

        <section id="sec-scam" class="sc-section">
          <h2>3. Transactions entre utilisateurs &amp; exonération en cas d'arnaque ou de vol</h2>
          <p>
            StudyCloud agit exclusivement en qualité d'intermédiaire technique mettant à disposition l'infrastructure logicielle de vitrine et de partage.
          </p>
          <p>
            <strong>DKD Technologies et son fondateur Dibi Kouassi Delmas ne sauraient en aucun cas être tenus responsables en cas d'arnaque, d'escroquerie, de vol, de fraude, de défaut de livraison ou de non-conformité commis par un utilisateur au détriment d'un autre.</strong>
          </p>
          <p>
            Tout utilisateur effectuant un achat auprès d'une boutique tierce ou concluant un accord privé avec un autre membre en assume seul et intégralement les risques. StudyCloud ne procède à aucun dédommagement ni remboursement au titre de litiges privés survenus entre utilisateurs. Tout auteur d'escroquerie identifié est immédiatement exclu de la plateforme.
          </p>
        </section>

        <section id="sec-resources" class="sc-section">
          <h2>4. Publication dans le menu Ressources &amp; Bouton de signalement</h2>
          <p>
            L'utilisateur qui publie un document, un lien ou une ressource dans la section publique « Ressources » ou via un lien StudyCloud Share en demeure le seul responsable civil et pénal. Il lui est strictement interdit de publier des œuvres protégées par le droit d'auteur sans autorisation, des contenus pornographiques ou des fichiers malveillants.
          </p>
          <p>
            <strong>Système de signalement :</strong> Des boutons « Signaler » sont mis à disposition pour permettre à tout utilisateur de signaler instantanément un contenu abusif, illégal ou qui ne respecte pas les présentes conditions. Dès réception d'un signalement vérifié, nous procédons au retrait immédiat du contenu concerné.
          </p>
        </section>

        <section id="sec-storage" class="sc-section">
          <h2>5. Stockage Cloud : achat définitif, évolution et impayés</h2>
          <p>
            Chaque compte bénéficie d'un quota gratuit de bienvenue. Des formules payantes permettent d'étendre cet espace selon les besoins.
          </p>
          <ul>
            <li><strong>Achat non remboursable :</strong> Tout achat ou renouvellement d'espace de stockage est ferme et définitif. Aucun remboursement n'est accordé après activation.</li>
            <li><strong>Augmentation uniquement (diminution impossible) :</strong> Une fois une formule d'espace achetée, il n'est plus possible de la diminuer ni de rétrograder vers une capacité inférieure pendant la période en cours ; seule une augmentation vers une offre supérieure est possible.</li>
            <li><strong>Gestion des impayés :</strong> Si l'utilisateur ne règle pas le renouvellement de l'espace qu'il occupe au-delà du délai de tolérance après notification, l'accès à son espace étendu est suspendu. S'il persiste à ne pas régulariser sa situation, <strong>ses données et fichiers excédentaires seront définitivement effacés des serveurs pour libérer de l'espace</strong>, sans aucune possibilité d'indemnisation.</li>
          </ul>
        </section>

        <section id="sec-ai" class="sc-section">
          <h2>6. Fonctionnalités d'Intelligence Artificielle et consommation des crédits</h2>
          <p>
            Les fonctionnalités d'Intelligence Artificielle intégrées à StudyCloud sont des outils d'aide à la productivité et à l'étude dont les réponses ont un caractère purement indicatif.
          </p>
          <p>
            <strong>Consommation ferme des crédits :</strong> Chaque requête ou tentative de création lancée par l'utilisateur consomme des ressources serveurs. <strong>Si l'IA consomme des crédits en tentant d'effectuer une tâche ou de créer un contenu et que le résultat obtenu est imparfait, incomplet ou insatisfaisant pour l'utilisateur, les crédits débités restent définitivement acquis et ne donnent lieu à aucun remboursement ni recrédit.</strong> DKD Technologies et Dibi Kouassi Delmas ne sont pas responsables de la précision des contenus produits par l'IA.
          </p>
        </section>

        <section id="sec-security" class="sc-section">
          <h2>7. Sécurité, interdiction des attaques et continuité de service</h2>
          <p>
            Toute tentative de piratage, de scan de vulnérabilité, d'extraction automatisée non autorisée ou d'attaque par déni de service (DDoS) est formellement interdite et passible de poursuites. DKD Technologies se réserve le droit souverain de suspendre ou supprimer sans préavis tout compte présentant un comportement nuisible.
          </p>
          <p>
            Des interruptions ponctuelles pour maintenance technique ou incidents réseau indépendants de notre volonté peuvent survenir sans ouvrir droit à une quelconque indemnisation.
          </p>
        </section>
      </div>

      <!-- ============== ONGLET 2 : POLITIQUE DE CONFIDENTIALITÉ ============== -->
      <div id="panel-privacy" class="sc-tab-panel${initialTab === 'privacy' ? ' active' : ''}">
        <header class="sc-doc-header">
          <h1 class="sc-doc-title">${escapeHtml(app.titles.privacy.heading)}</h1>
          <p class="sc-doc-date">${escapeHtml(app.titles.privacy.dateNote)}</p>
          <p class="sc-doc-intro">${escapeHtml(app.titles.privacy.intro)}</p>
        </header>

        <section id="sec-privacy-overview" class="sc-section">
          <h2>1. Aperçu</h2>
          <p>
            La protection de votre vie privée et la confidentialité de vos documents sont au cœur de la conception de StudyCloud. Nous collectons uniquement les données strictement nécessaires pour assurer le fonctionnement de votre espace Cloud, vos classeurs et vos créations.
          </p>
        </section>

        <section id="sec-data-collected" class="sc-section">
          <h2>2. Informations que nous recueillons</h2>
          <ul>
            <li><strong>Données d'inscription et de compte :</strong> nom, prénom, adresse email, photo de profil facultative et mot de passe protégé par hachage cryptographique fort.</li>
            <li><strong>Contenus et fichiers personnels :</strong> documents, médias, notes, emplois du temps et boutiques que vous enregistrez volontairement dans StudyCloud.</li>
            <li><strong>Données techniques de sécurité :</strong> adresse IP et jetons d'authentification temporaires utilisés exclusivement pour bloquer les tentatives d'intrusion.</li>
          </ul>
        </section>

        <section id="sec-non-sale" class="sc-section">
          <h2>3. Engagements de non-revente et respect des données</h2>
          <p>
            <strong>Zéro revente commerciale :</strong> DKD Technologies ne vend, ne loue et ne cède jamais vos données personnelles, vos adresses emails ou vos fichiers à des tiers, annonceurs ou régies publicitaires.
          </p>
          <p>
            Les documents déposés dans votre Dossier Sécurisé protégé par code PIN sont isolés et restent strictement privés. Les requêtes adressées aux fonctionnalités IA intégrées sont traitées de manière isolée et ne sont pas revendues pour entraîner des modèles commerciaux externes.
          </p>
        </section>

        <section id="sec-cookies-pwa" class="sc-section">
          <h2>4. Cookies, stockage local et mode hors-ligne (PWA)</h2>
          <p>
            StudyCloud utilise le stockage local de votre navigateur et les technologies PWA uniquement à des fins techniques : maintenir votre session active, mémoriser votre thème ou langue préférée et autoriser la consultation hors-ligne de vos fichiers mis en cache. Aucun traceur publicitaire tiers n'est déployé.
          </p>
        </section>

        <section id="sec-account-deletion" class="sc-section">
          <h2>5. Conservation et droit à l'effacement total (« Supprimer mon compte »)</h2>
          <p>
            Vos fichiers restent conservés tant que votre compte est actif et que votre espace est maintenu conformément aux formules souscrites. Vous disposez à tout moment dans vos paramètres d'un bouton <strong>« Supprimer mon compte »</strong> vous permettant d'effacer immédiatement et irréversiblement l'intégralité de vos fichiers et informations personnelles.
          </p>
        </section>
      </div>

      <!-- ============== ONGLET 3 : MENTIONS LÉGALES ============== -->
      <div id="panel-mentions" class="sc-tab-panel${initialTab === 'mentions' ? ' active' : ''}">
        <header class="sc-doc-header">
          <h1 class="sc-doc-title">${escapeHtml(app.titles.mentions.heading)}</h1>
          <p class="sc-doc-date">${escapeHtml(app.titles.mentions.dateNote)}</p>
        </header>

        <section id="sec-publisher" class="sc-section">
          <h2>1. Éditeur de la plateforme &amp; fondateur</h2>
          <ul class="sc-no-bullets">
            <li><strong>Société propriétaire et éditrice :</strong> ${escapeHtml(app.company)}</li>
            <li><strong>Créateur, concepteur et fondateur :</strong> ${escapeHtml(app.founder)} (étudiant ivoirien en filière électrotechnique et développeur-concepteur de la plateforme StudyCloud)</li>
            <li><strong>Service édité :</strong> StudyCloud (Site web et application web progressive)</li>
            <li><strong>Support officiel et signalements :</strong> ${app.supportEmails.map(escapeHtml).join(' / ')}</li>
          </ul>
        </section>

        <section id="sec-ip" class="sc-section">
          <h2>2. Propriété intellectuelle</h2>
          <p>
            L'ensemble de la structure du site StudyCloud, ses textes, interfaces, modèles visuels 3D, logos et logiciels sont la propriété exclusive de DKD Technologies et de son concepteur Dibi Kouassi Delmas. Toute reproduction, copie ou exploitation non autorisée est strictement interdite.
          </p>
        </section>

        <section id="sec-law" class="sc-section">
          <h2>3. Droit applicable et règlement des différends</h2>
          <p>
            Les présentes dispositions sont régies par le droit en vigueur. En cas de différend, l'utilisateur est invité à contacter en priorité le service support officiel à l'adresse <strong>${escapeHtml(app.supportEmails[0])}</strong> en vue d'une résolution amiable.
          </p>
        </section>
      </div>

    </main>
  </div>

  <script>
    (function () {
      var SECTIONS = ${sectionsDataJson};
      var TITLES = ${titlesDataJson};
      var currentTab = ${JSON.stringify(initialTab)};
      var currentSectionId = (SECTIONS[currentTab] && SECTIONS[currentTab][0]) ? SECTIONS[currentTab][0].id : 'overview';

      var sidebarHeading = document.getElementById('sc-sidebar-heading');
      var sidebarLinksEl = document.getElementById('sc-sidebar-links');
      var mobileSectionsEl = document.getElementById('sc-mobile-sections');
      var mobileDrawer = document.getElementById('sc-mobile-drawer');
      var burgerBtn = document.getElementById('sc-burger-btn');

      function renderSidebar(tab) {
        var list = SECTIONS[tab] || [];
        if (sidebarHeading && TITLES[tab]) {
          sidebarHeading.textContent = TITLES[tab].sidebarTitle;
        }
        if (sidebarLinksEl) {
          sidebarLinksEl.innerHTML = '';
          list.forEach(function (sec) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sc-sidebar-link' + (sec.id === currentSectionId ? ' active' : '');
            btn.textContent = sec.label;
            btn.setAttribute('data-sec', sec.id);
            btn.addEventListener('click', function () {
              scrollToSection(sec.id);
            });
            sidebarLinksEl.appendChild(btn);
          });
        }
        if (mobileSectionsEl) {
          mobileSectionsEl.innerHTML = '';
          list.forEach(function (sec) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sc-mobile-sec-link' + (sec.id === currentSectionId ? ' active' : '');
            btn.textContent = sec.label;
            btn.setAttribute('data-sec', sec.id);
            btn.addEventListener('click', function () {
              if (mobileDrawer) mobileDrawer.classList.remove('open');
              scrollToSection(sec.id);
            });
            mobileSectionsEl.appendChild(btn);
          });
        }
      }

      function highlightSection(secId) {
        currentSectionId = secId;
        var all = document.querySelectorAll('[data-sec]');
        all.forEach(function (el) {
          if (el.getAttribute('data-sec') === secId) {
            el.classList.add('active');
          } else {
            el.classList.remove('active');
          }
        });
      }

      function scrollToSection(secId) {
        highlightSection(secId);
        var target = document.getElementById('sec-' + secId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      function switchTab(tab) {
        if (!SECTIONS[tab]) return;
        currentTab = tab;
        currentSectionId = SECTIONS[tab][0].id;

        document.querySelectorAll('.sc-tab-panel').forEach(function (panel) {
          panel.classList.toggle('active', panel.id === 'panel-' + tab);
        });
        document.querySelectorAll('[data-tab]').forEach(function (btn) {
          btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });

        if (TITLES[tab]) {
          document.title = TITLES[tab].pageTitle;
        }
        renderSidebar(tab);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (mobileDrawer) mobileDrawer.classList.remove('open');

        try {
          var url = new URL(window.location.href);
          url.searchParams.set('tab', tab);
          window.history.replaceState({}, '', url.toString());
        } catch (e) {}
      }

      document.querySelectorAll('[data-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          switchTab(btn.getAttribute('data-tab'));
        });
      });

      if (burgerBtn && mobileDrawer) {
        burgerBtn.addEventListener('click', function () {
          mobileDrawer.classList.toggle('open');
        });
      }

      renderSidebar(currentTab);
    })();
  </script>
</body>
</html>`;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.toLowerCase();

    // Support de l'identification d'application (?app=studycloud ou préfixe /studycloud/...)
    const appParam = (url.searchParams.get('app') || '').toLowerCase().trim();
    const appConfig = APPS_REGISTRY[appParam] || APPS_REGISTRY.studycloud;

    // Détection automatique de l'onglet via le chemin ou ?tab=
    const tabParam = (url.searchParams.get('tab') || '').toLowerCase().trim();
    let activeTab: LegalTab = 'cgu';

    if (
      tabParam === 'privacy' ||
      tabParam === 'confidentialite' ||
      pathname.endsWith('/privacy') ||
      pathname.endsWith('/confidentialite')
    ) {
      activeTab = 'privacy';
    } else if (
      tabParam === 'mentions' ||
      tabParam === 'legal' ||
      pathname.endsWith('/mentions') ||
      pathname.endsWith('/mentions-legales') ||
      pathname.endsWith('/legal')
    ) {
      activeTab = 'mentions';
    } else if (
      tabParam === 'cgu' ||
      tabParam === 'terms' ||
      pathname.endsWith('/terms') ||
      pathname.endsWith('/cgu')
    ) {
      activeTab = 'cgu';
    }

    // Endpoint de santé JSON léger
    if (pathname === '/health' || pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          success: true,
          service: 'dkd-legal',
          apps: Object.keys(APPS_REGISTRY),
          version: appConfig.version,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const returnUrl = sanitizeReturnUrl(url.searchParams.get('return_to'), appConfig.defaultReturnUrl);
    const html = renderLegalHtml(appConfig, activeTab, returnUrl);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=300',
      },
    });
  },
};


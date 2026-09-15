/**
 * StudyCloud - Cloudflare Worker Backend API
 * Gère la communication complète entre StudyCloud, Cloudflare D1 (SQL) et Cloudflare R2 (Storage).
 */
export interface Env {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  'MON_D1-STUDYCLOUD'?: D1Database;
  'MON_R2-STUDYCLOUD'?: R2Bucket;
  MON_D1_STUDYCLOUD?: D1Database;
  MON_R2_STUDYCLOUD?: R2Bucket;
  // Liaisons Workers AI (nom officiel: MON-STUDYCLOUD-ia)
  'MON-STUDYCLOUD-ia'?: any;
  MON_STUDYCLOUD_IA?: any;
  'MON-STUDYCLOUD-IA'?: any;
  'STUDYCLOUD-IA'?: any;
  STUDYCLOUD_IA?: any;
  'STUDYCLOUD-AI'?: any;
  STUDYCLOUD_AI?: any;
  AI?: any;
  ai?: any;
  // Secrets (wrangler secret put)
  JWT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  [key: string]: any;
}

// ============================================================================
// Brand Assets (DNA Logo SVG & PNG pour emails et web)
// ============================================================================
const DNA_LOGO_PNG_B64 = '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';

const DNA_LOGO_SVG = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scDnaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="50%" stop-color="#F38020"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>
  </defs>
  <g>
    <path d="M8 3C8 3 8 10 12 12C16 14 16 21 16 21" stroke="url(#scDnaGrad)" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M16 3C16 3 16 10 12 12C8 14 8 21 8 21" stroke="url(#scDnaGrad)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="10" y1="6" x2="14" y2="6" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
    <line x1="10.5" y1="9" x2="13.5" y2="9" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" opacity="0.9"/>
    <line x1="11" y1="12" x2="13" y2="12" stroke="#F38020" stroke-width="3" stroke-linecap="round"/>
    <line x1="10.5" y1="15" x2="13.5" y2="15" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" opacity="0.9"/>
    <line x1="10" y1="18" x2="14" y2="18" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
  </g>
</svg>`;

// ============================================================================
// Utilitaires HTTP & CORS
// ============================================================================
function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
  };
}

function jsonResponse(data: any, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

function errorResponse(error: string, status = 400, origin = '*') {
  return jsonResponse({ success: false, error }, status, origin);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateCleanShareCode(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    return Array.from(buffer, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'sc_' + Math.random().toString(36).substring(2, 14) + Date.now().toString(36);
}

function getFileIconMeta(filename: string): { color: string; label: string } {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.pdf')) {
    return { color: '#E53E3E', label: 'PDF' };
  } else if (/\.(doc|docx|rtf|odt)$/i.test(lower)) {
    return { color: '#2563EB', label: 'WORD' };
  } else if (/\.(cpp|c|h|hpp|cc)$/i.test(lower)) {
    return { color: '#4B5563', label: 'CPP' };
  } else if (/\.(py|python)$/i.test(lower)) {
    return { color: '#0284C7', label: 'PY' };
  } else if (/\.(js|jsx|ts|tsx)$/i.test(lower)) {
    return { color: '#D97706', label: 'JS' };
  } else if (/\.(xls|xlsx|csv)$/i.test(lower)) {
    return { color: '#059669', label: 'EXCEL' };
  } else if (/\.(ppt|pptx)$/i.test(lower)) {
    return { color: '#EA580C', label: 'PPT' };
  } else if (/\.(zip|rar|7z|tar|gz)$/i.test(lower)) {
    return { color: '#8B5CF6', label: 'ZIP' };
  } else if (/\.(png|jpg|jpeg|webp|gif|svg|bmp|ico|heic|tiff)$/i.test(lower)) {
    return { color: '#10B981', label: 'IMG' };
  } else if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(lower)) {
    return { color: '#06B6D4', label: 'AUDIO' };
  } else if (/\.(mp4|mkv|mov|avi)$/i.test(lower)) {
    return { color: '#6366F1', label: 'VIDEO' };
  }
  const ext = lower.split('.').pop();
  return { color: '#64748B', label: (ext && ext.length <= 4) ? ext.toUpperCase() : 'DOC' };
}

function renderFileDocIconSvg(color: string, label: string): string {
  return `<svg class="doc-icon-svg" viewBox="0 0 68 84" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 0H46L68 22V78C68 81.3137 65.3137 84 62 84H6C2.68629 84 0 81.3137 0 78V6C0 2.68629 2.68629 0 6 0Z" fill="${color}" />
    <path d="M46 0L68 22H52C48.6863 22 46 19.3137 46 16V0Z" fill="white" fill-opacity="0.35" />
    <text x="34" y="53" fill="white" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="15" font-weight="900" text-anchor="middle" letter-spacing="0.5">${label}</text>
  </svg>`;
}

function renderShareNotFoundHtml(code: string, originUrl: string): string {
  const siteUrl = 'https://studycloud.dkd-technologies.com';
  return `<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StudyCloud • Stockage & Partage Sécurisé</title>
  <meta name="description" content="Téléchargez votre fichier en cliquant sur ce lien. StudyCloud : Plateforme cloud de stockage sécurisé pour élèves, étudiants, entreprises et professionnels.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="StudyCloud">
  <meta property="og:title" content="StudyCloud • Stockage & Partage Sécurisé">
  <meta property="og:description" content="Téléchargez votre fichier en cliquant sur ce lien. StudyCloud : Plateforme cloud de stockage sécurisé pour élèves, étudiants, entreprises et professionnels.">
  <meta property="og:image" content="https://studycloud.dkd-technologies.com/assets/dna-logo.png">
  <meta property="og:image:secure_url" content="https://studycloud.dkd-technologies.com/assets/dna-logo.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="300">
  <meta property="og:image:height" content="300">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="StudyCloud • Stockage & Partage Sécurisé">
  <meta name="twitter:description" content="Téléchargez votre fichier en cliquant sur ce lien. StudyCloud : Plateforme cloud de stockage sécurisé pour élèves, étudiants, entreprises et professionnels.">
  <meta name="twitter:image" content="https://studycloud.dkd-technologies.com/assets/studycloud-brand-logo.png">
  <link rel="icon" type="image/png" href="https://studycloud.dkd-technologies.com/assets/dna-logo.png">
  <link rel="apple-touch-icon" href="https://studycloud.dkd-technologies.com/assets/dna-logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #ffffff;
      color: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .code-badge {
      display: inline-block;
      background: #fff7ed;
      color: #ea580c;
      padding: 6px 16px;
      border-radius: 9999px;
      font-family: ui-monospace, monospace;
      font-weight: 800;
      font-size: 14px;
      margin-bottom: 24px;
    }
    h1 { font-size: 26px; font-weight: 900; margin-bottom: 12px; color: #0f172a; letter-spacing: -0.02em; }
    p { color: #64748b; font-size: 15px; line-height: 1.6; margin-bottom: 28px; max-width: 460px; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #ea580c, #f38020);
      color: white;
      text-decoration: none;
      font-weight: 800;
      font-size: 14.5px;
      padding: 13px 28px;
      border-radius: 14px;
      box-shadow: 0 4px 14px rgba(234, 88, 12, 0.25);
      transition: all 0.2s;
    }
    .btn:hover { transform: translateY(-1px); filter: brightness(1.05); }
  </style>
</head>
<body>
  <!-- Logo ADN StudyCloud -->
  <div style="margin-bottom: 20px;">
    <img src="https://studycloud.dkd-technologies.com/assets/dna-logo.png" width="48" height="48" alt="Logo StudyCloud" style="display:inline-block;border:0;width:48px;height:48px;object-fit:contain;margin:0;" onerror="this.onerror=null;this.src='data:image/png;base64,${DNA_LOGO_PNG_B64}'" />
  </div>
  <div class="code-badge">🔒 Accès sécurisé & chiffré</div>
  <h1>Ce document partagé est introuvable</h1>
  <p>Le lien d'accès sécurisé a peut-être expiré ou a été supprimé par son propriétaire.</p>
  <a href="${siteUrl}" class="btn">Accéder à l'application StudyCloud &rarr;</a>
</body>
</html>`;
}

function renderReferralLandingHtml(code: string, referrerName: string, originUrl: string): string {
  const safeCode = escapeHtml(code || 'STUDYCLOUD');
  const safeName = escapeHtml(referrerName || 'Un membre de la communauté');
  const siteUrl = 'https://studycloud.dkd-technologies.com';
  const logoUrl = 'https://studycloud.dkd-technologies.com/assets/studycloud-brand-logo.png';
  const faviconUrl = 'https://studycloud.dkd-technologies.com/assets/dna-logo.png';
  const registerUrl = `${siteUrl}/?ref=${encodeURIComponent(code)}#register`;
  const loginUrl = `${siteUrl}/?ref=${encodeURIComponent(code)}#login`;
  const invitePageUrl = `${originUrl}/invite/${encodeURIComponent(code)}`;
  const ogTitle = escapeHtml(`${safeName} vous invite à rejoindre StudyCloud !`);
  const ogDesc = escapeHtml(`Rejoignez la plateforme étudiante tout-en-un StudyCloud. Vos cours, fiches de révisions, sujets d'examens et assistant IA officiel.`);

  return `<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${ogTitle}</title>

  <!-- Métadonnées & Aperçu WhatsApp / Réseaux Sociaux -->
  <meta name="description" content="${ogDesc}">
  <meta name="author" content="DKD Technologies">
  <meta name="application-name" content="StudyCloud">
  <meta name="robots" content="index, follow">

  <!-- Open Graph / WhatsApp / Facebook / LinkedIn / Telegram -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="StudyCloud">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${ogDesc}">
  <meta property="og:url" content="${invitePageUrl}">
  <meta property="og:image" content="${logoUrl}">
  <meta property="og:image:secure_url" content="${logoUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="300">
  <meta property="og:image:height" content="300">
  <meta property="og:image:alt" content="Logo StudyCloud - Invitation">

  <!-- Twitter Cards -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDesc}">
  <meta name="twitter:image" content="${logoUrl}">

  <!-- Favicon / Icônes -->
  <link rel="icon" type="image/png" href="${faviconUrl}">
  <link rel="apple-touch-icon" href="${faviconUrl}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --primary-orange: #ea580c;
      --primary-blue: #2563eb;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* HEADER */
    header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: #ffffff;
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    .header-container {
      max-width: 760px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
    }
    .brand-logo-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-titles {
      display: flex;
      flex-direction: column;
    }
    .brand-title-row {
      display: flex;
      align-items: center;
      font-size: 19px;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .brand-study { color: #ea580c; }
    .brand-cloud { color: #2563eb; }
    .brand-tagline {
      font-size: 10.5px;
      color: #64748b;
      font-weight: 600;
      margin-top: 1px;
    }

    .btn-top-site {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: #f1f5f9;
      color: #334155;
      font-size: 12.5px;
      font-weight: 700;
      border-radius: 10px;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .btn-top-site:hover {
      background: #e2e8f0;
      color: #0f172a;
    }

    /* MAIN CONTAINER */
    main {
      flex: 1;
      max-width: 620px;
      width: 100%;
      margin: 0 auto;
      padding: 28px 16px 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .invite-card {
      width: 100%;
      background: #ffffff;
      border: 2px solid #1c1917;
      border-radius: 24px;
      padding: 32px 24px;
      box-shadow: 6px 6px 0px 0px #1c1917;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .logo-hero {
      width: 64px;
      height: 64px;
      border-radius: 18px;
      border: 2px solid #1c1917;
      background: #fff7ed;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      box-shadow: 3px 3px 0px 0px #1c1917;
    }
    .logo-hero img {
      width: 44px;
      height: 44px;
      object-fit: contain;
    }

    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #fff7ed;
      color: #ea580c;
      font-size: 12px;
      font-weight: 800;
      padding: 5px 12px;
      border-radius: 9999px;
      border: 1.5px solid #fed7aa;
      margin-bottom: 14px;
      letter-spacing: 0.02em;
    }

    h1.title {
      font-size: 26px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
      line-height: 1.25;
    }

    p.subtitle {
      font-size: 14.5px;
      color: #475569;
      line-height: 1.55;
      margin-bottom: 22px;
    }

    .inviter-name {
      color: #ea580c;
      font-weight: 800;
    }

    /* CODE BOX */
    .code-box {
      width: 100%;
      background: #f8fafc;
      border: 2px dashed #cbd5e1;
      border-radius: 16px;
      padding: 14px;
      margin-bottom: 24px;
    }
    .code-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .code-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 24px;
      font-weight: 900;
      color: #ea580c;
      letter-spacing: 0.1em;
    }

    /* FEATURES GRID */
    .features-list {
      width: 100%;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 28px;
    }
    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
    }
    .feature-icon {
      font-size: 20px;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .feature-text {
      font-size: 13px;
      color: #334155;
      line-height: 1.45;
    }
    .feature-text strong {
      color: #0f172a;
      display: block;
      font-size: 13.5px;
      margin-bottom: 1px;
    }

    /* CTA BUTTONS */
    .btn-register {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: #ea580c;
      color: #ffffff;
      font-size: 16px;
      font-weight: 800;
      padding: 15px 24px;
      border-radius: 16px;
      border: 2px solid #1c1917;
      box-shadow: 4px 4px 0px 0px #1c1917;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .btn-register:hover {
      background: #c2410c;
      transform: translate(-1px, -1px);
      box-shadow: 5px 5px 0px 0px #1c1917;
    }
    .btn-register:active {
      transform: translate(2px, 2px);
      box-shadow: 1px 1px 0px 0px #1c1917;
    }

    .login-link {
      margin-top: 14px;
      font-size: 13.5px;
      color: #64748b;
      text-decoration: none;
      font-weight: 600;
      display: inline-block;
    }
    .login-link strong {
      color: #2563eb;
      text-decoration: underline;
    }
    .login-link:hover strong {
      color: #1d4ed8;
    }

    /* FOOTER */
    footer {
      padding: 20px 16px;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <header>
    <div class="header-container">
      <a href="${siteUrl}" class="header-left">
        <div class="brand-logo-wrap">
          <img src="${faviconUrl}" width="34" height="34" alt="Logo StudyCloud" style="display:block;border:0;width:34px;height:34px;object-fit:contain;margin:0;" onerror="this.onerror=null;this.src='data:image/png;base64,${DNA_LOGO_PNG_B64}'" />
        </div>
        <div class="brand-titles">
          <div class="brand-title-row">
            <span class="brand-study">Study</span><span class="brand-cloud">Cloud</span>
          </div>
          <span class="brand-tagline">Plateforme académique & cloud</span>
        </div>
      </a>
      <a href="${loginUrl}" class="btn-top-site">Se connecter &rarr;</a>
    </div>
  </header>

  <!-- MAIN -->
  <main>
    <div class="invite-card">
      <div class="logo-hero">
        <img src="${faviconUrl}" alt="StudyCloud Logo" onerror="this.onerror=null;this.src='data:image/png;base64,${DNA_LOGO_PNG_B64}'" />
      </div>

      <div class="badge-pill">
        <span>🎓</span>
        <span>Invitation Officielle</span>
      </div>

      <h1 class="title">Rejoignez StudyCloud</h1>
      <p class="subtitle">
        L'étudiant <span class="inviter-name">${safeName}</span> vous invite à créer votre compte gratuit sur la plateforme étudiante n°1.
      </p>

      <div class="code-box">
        <div class="code-label">Code d'invitation personnel</div>
        <div class="code-value">${safeCode}</div>
      </div>

      <div class="features-list">
        <div class="feature-item">
          <div class="feature-icon">📚</div>
          <div class="feature-text">
            <strong>Bibliothèque Universitaire Partagée</strong>
            Accédez à des milliers de cours, résumés, TD et sujets d'examens classés par matière et filière.
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">🤖</div>
          <div class="feature-text">
            <strong>Assistant IA Académique Officiel</strong>
            Posez toutes vos questions sur vos cours, devoirs et exercices pour comprendre rapidement 24h/24.
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">⚡</div>
          <div class="feature-text">
            <strong>Stockage Cloud & Partage Rapide</strong>
            Sauvegardez vos documents et partagez des liens de téléchargement instantanés avec vos camarades.
          </div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">🎁</div>
          <div class="feature-text">
            <strong>Avantages Débloqués</strong>
            En vous inscrivant avec cette invitation, vous et votre parrain débloquez des avantages exclusifs sur la plateforme.
          </div>
        </div>
      </div>

      <a href="${registerUrl}" class="btn-register">
        <span>Créer mon compte gratuitement</span>
        <span>&rarr;</span>
      </a>

      <a href="${loginUrl}" class="login-link">
        Vous avez déjà un compte ? <strong>Se connecter</strong>
      </a>
    </div>
  </main>

  <footer>
    StudyCloud • Développé par DKD Technologies • Tous droits réservés.
  </footer>

</body>
</html>`;
}

function renderShareLandingHtml(folder: any, files: any[], originUrl: string): string {
  const shareCode = escapeHtml(folder.share_code || 'DKD-SHARE');
  const title = escapeHtml(folder.title || 'Document Partagé');
  const description = escapeHtml(folder.description || '');
  const authorName = escapeHtml(folder.author_name || 'DKD');
  const category = escapeHtml(folder.category || 'Cours');
  const totalFiles = files ? files.length : 0;
  const totalSize = files ? files.reduce((acc, f) => acc + (f.size || 0), 0) : (folder.total_size || 0);
  const formattedSize = formatBytes(totalSize);
  const siteUrl = 'https://studycloud.dkd-technologies.com';
  const logoUrl = 'https://studycloud.dkd-technologies.com/assets/studycloud-brand-logo.png';
  const faviconUrl = 'https://studycloud.dkd-technologies.com/assets/dna-logo.png';
  const shareUrl = `${originUrl}/s/${encodeURIComponent(folder.share_code || folder.id)}`;
  const ogTitle = escapeHtml(`${title} • StudyCloud`);
  const appDesc = escapeHtml('Téléchargez votre fichier en cliquant sur ce lien. StudyCloud : Plateforme cloud de stockage sécurisé pour élèves, étudiants, entreprises et professionnels.');

  const filesJson = JSON.stringify((files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    size: f.size || 0,
    type: f.type || 'application/octet-stream',
    url: f.file_url || f.url || ''
  })));

  const filesGridHtml = (files && files.length > 0)
    ? files.map((f: any) => {
        const meta = getFileIconMeta(f.name);
        const iconSvg = renderFileDocIconSvg(meta.color, meta.label);
        return `
        <div class="file-grid-item selected" data-id="${f.id}" onclick="toggleFileSelection('${f.id}')">
          <div class="file-select-badge">
            <svg class="check-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div class="file-icon-wrapper">
            ${iconSvg}
          </div>
          <div class="file-meta">
            <span class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
            <span class="file-size">${formatBytes(f.size || 0)}</span>
          </div>
        </div>`;
      }).join('')
    : '<div style="padding: 32px; text-align: center; color: #94a3b8; font-size: 14px; grid-column: 1 / -1;">Aucun fichier disponible dans ce partage.</div>';

  return `<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${ogTitle}</title>

  <!-- Métadonnées de l'application & Aperçu WhatsApp / Réseaux Sociaux -->
  <meta name="description" content="${appDesc}">
  <meta name="author" content="DKD Technologies">
  <meta name="application-name" content="StudyCloud">
  <meta name="robots" content="index, follow">

  <!-- Open Graph / WhatsApp / Facebook / LinkedIn / Telegram -->
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="StudyCloud">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${appDesc}">
  <meta property="og:url" content="${shareUrl}">
  <meta property="og:image" content="${logoUrl}">
  <meta property="og:image:secure_url" content="${logoUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="300">
  <meta property="og:image:height" content="300">
  <meta property="og:image:alt" content="Logo StudyCloud - Stockage et Partage Sécurisé">

  <!-- Twitter Cards -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${appDesc}">
  <meta name="twitter:image" content="${logoUrl}">

  <!-- Favicon / Icônes -->
  <link rel="icon" type="image/png" href="${logoUrl}">
  <link rel="apple-touch-icon" href="${logoUrl}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <style>
    :root {
      --bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --primary-orange: #ea580c;
      --primary-blue: #2563eb;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* HEADER */
    header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: #ffffff;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    .header-container {
      max-width: 760px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
    }
    .brand-logo-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand-titles {
      display: flex;
      flex-direction: column;
    }
    .brand-title-row {
      display: flex;
      align-items: center;
      font-size: 19px;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .brand-study { color: #ea580c; }
    .brand-cloud { color: #2563eb; }
    .brand-tagline {
      font-size: 10.5px;
      color: #64748b;
      font-weight: 600;
      margin-top: 1px;
    }

    /* Bouton Accéder à l'application */
    .btn-top-site {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #0f172a;
      color: #ffffff;
      text-decoration: none;
      font-size: 12.5px;
      font-weight: 700;
      padding: 9px 14px;
      border-radius: 12px;
      transition: all 0.2s;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .btn-top-site:hover {
      background: #1e293b;
    }

    /* MAIN CONTAINER */
    main {
      flex: 1;
      max-width: 760px;
      width: 100%;
      margin: 0 auto;
      padding: 16px 16px 110px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* INFORMATIONS SUR LE DOSSIER */
    .info-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .meta-stats {
      font-size: 13.5px;
      font-weight: 600;
      color: #64748b;
    }
    .folder-title {
      font-size: 28px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin-top: 2px;
    }
    .folder-desc {
      font-size: 14px;
      color: #64748b;
      line-height: 1.5;
      font-weight: 500;
      margin-top: 2px;
    }

    /* SECTION DES FICHIERS */
    .files-section {
      margin-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .files-section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .files-section-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
    }
    .btn-toggle-all {
      background: none;
      border: none;
      font-size: 13px;
      font-weight: 700;
      color: #ea580c;
      cursor: pointer;
      padding: 4px 6px;
    }

    /* GRILLE DE FICHIERS (3 PAR LIGNE SUR MOBILE) */
    .files-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      width: 100%;
    }

    /* CARTE DE FICHIER (CADRE ORANGE RAPPROCHÉ DU FICHIER, FOND BLANC, COCHÉ EN HAUT À DROITE) */
    .file-grid-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 7px 6px 7px;
      border-radius: 13px;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease-in-out;
      border: 1.8px solid #ea580c;
      background: #ffffff;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
    }
    .file-grid-item:active {
      transform: scale(0.97);
    }
    .file-grid-item:not(.selected) {
      border-color: #e2e8f0;
      background: #fafafa;
      opacity: 0.65;
    }
    .file-select-badge {
      position: absolute;
      top: 5px;
      right: 5px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ea580c;
      transition: all 0.2s;
    }
    .file-grid-item:not(.selected) .file-select-badge {
      background: #cbd5e1;
    }
    .file-grid-item:not(.selected) .check-icon {
      display: none;
    }

    /* ICÔNE DE FICHIER DIMINUÉE */
    .file-icon-wrapper {
      width: 36px;
      height: 46px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 3px auto 6px;
    }
    .doc-icon-svg {
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08));
    }
    .file-meta {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5px;
    }
    .file-name {
      font-size: 11px;
      font-weight: 750;
      color: #0f172a;
      line-height: 1.25;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-word;
      max-width: 100%;
    }
    .file-size {
      font-size: 10px;
      font-weight: 600;
      color: #94a3b8;
    }

    /* SUR ORDINATEUR : 5 FICHIERS PAR LIGNE, TAILLE RÉDUITE & CADRE ORANGE RAPPROCHÉ */
    @media (min-width: 768px) {
      main {
        max-width: 1080px;
      }
      .files-grid {
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
      }
      .file-grid-item {
        padding: 6px 6px 6px;
        border-radius: 12px;
      }
      .file-select-badge {
        top: 4px;
        right: 4px;
        width: 16px;
        height: 16px;
      }
      .file-select-badge .check-icon {
        width: 9px;
        height: 9px;
      }
      .file-icon-wrapper {
        width: 32px;
        height: 40px;
        margin: 2px auto 5px;
      }
      .file-name {
        font-size: 10.5px;
        line-height: 1.2;
      }
      .file-size {
        font-size: 9.5px;
      }
    }

    /* BARRE FIXE EN BAS - 100% RESPONSIVE ET JAMAIS COUPÉE SUR AUCUN APPAREIL */
    .bottom-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #ffffff;
      border-top: 1px solid #f1f5f9;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
      padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 10px));
      z-index: 100;
    }
    .bottom-bar-inner {
      max-width: 600px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      box-sizing: border-box;
    }
    .btn-bottom {
      flex: 1 1 0;
      min-width: 0;
      height: 48px;
      border-radius: 14px;
      font-weight: 800;
      font-size: clamp(11px, 2.7vw, 13.5px);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 0 8px;
      cursor: pointer;
      user-select: none;
      box-sizing: border-box;
      transition: all 0.15s ease;
      white-space: nowrap;
      text-decoration: none;
    }
    .btn-bottom:active {
      transform: scale(0.97);
    }
    .btn-bottom svg {
      flex-shrink: 0;
      width: 17px;
      height: 17px;
    }
    .btn-bottom span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .btn-bottom-zip {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      color: #0f172a;
    }
    .btn-bottom-zip:hover {
      background: #f1f5f9;
    }
    .btn-bottom-action {
      background: #ea580c;
      border: none;
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(234, 88, 12, 0.3);
    }
    .btn-bottom-action:hover {
      background: #c2410c;
    }
    .btn-bottom-action:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }

    @media (max-width: 440px) {
      .files-grid {
        gap: 6px;
      }
      .file-grid-item {
        padding: 6px 4px 6px;
        border-radius: 11px;
      }
      .file-select-badge {
        top: 4px;
        right: 4px;
        width: 15px;
        height: 15px;
      }
      .file-select-badge .check-icon {
        width: 8px;
        height: 8px;
      }
      .file-icon-wrapper {
        width: 30px;
        height: 38px;
        margin: 2px auto 4px;
      }
      .file-name {
        font-size: 10px;
      }
      .file-size {
        font-size: 9px;
      }
      .bottom-bar-inner {
        gap: 8px;
      }
      .btn-bottom {
        height: 46px;
        padding: 0 4px;
        font-size: 11.5px;
      }
      .btn-zip-full { display: none; }
      .btn-zip-short { display: inline; }
    }
    @media (min-width: 441px) {
      .btn-zip-short { display: none; }
      .btn-zip-full { display: inline; }
    }

    /* TOAST */
    .toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-100px);
      background: #0f172a;
      color: #ffffff;
      padding: 12px 22px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      z-index: 200;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 90%;
      text-align: center;
    }
    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <header>
    <div class="header-container">
      <a href="${siteUrl}" target="_blank" class="header-left">
        <!-- Logo ADN Officiel StudyCloud (identique aux emails envoyés aux utilisateurs et à l'application) -->
        <div class="brand-logo-wrap">
          <img src="https://studycloud.dkd-technologies.com/assets/dna-logo.png" width="34" height="34" alt="Logo StudyCloud" style="display:block;border:0;width:34px;height:34px;object-fit:contain;margin:0;" onerror="this.onerror=null;this.src='data:image/png;base64,${DNA_LOGO_PNG_B64}'" />
        </div>
        <div class="brand-titles notranslate">
          <div class="brand-title-row">
            <span class="brand-study">Study</span><span class="brand-cloud">Cloud</span>
          </div>
          <span class="brand-tagline">Portail de téléchargement direct</span>
        </div>
      </a>

      <!-- Bouton Accéder à l'application -->
      <a href="${siteUrl}" target="_blank" class="btn-top-site">
        <span>Accéder à l'application</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </a>
    </div>
  </header>

  <!-- MAIN -->
  <main>
    <!-- INFORMATIONS SUR LE DOSSIER -->
    <div class="info-section">
      <span class="meta-stats">${formattedSize} • ${totalFiles} fichier(s)</span>
      <h1 class="folder-title">${title}</h1>
      <p class="folder-desc">${description || ('Dossier partagé contenant ' + totalFiles + ' élément(s).')}</p>
    </div>

    <!-- FICHIERS DISPONIBLES -->
    <div class="files-section">
      <div class="files-section-header">
        <span class="files-section-title">FICHIERS DISPONIBLES (${totalFiles})</span>
        <button type="button" class="btn-toggle-all" onclick="toggleSelectAll()">Tout cocher / décocher</button>
      </div>

      <div class="files-grid">
        ${filesGridHtml}
      </div>
    </div>
  </main>

  <!-- BARRE EN BAS : PARFAITEMENT VISIBLE SUR TOUS LES APPAREILS SANS AUCUNE COUPURE -->
  <div class="bottom-bar">
    <div class="bottom-bar-inner">
      <button type="button" id="btnDownloadZip" onclick="handleDownloadZip()" class="btn-bottom btn-bottom-zip" title="Tout télécharger en fichier zip">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span class="btn-zip-full">Tout télécharger en fichier zip</span>
        <span class="btn-zip-short">Télécharger en ZIP</span>
      </button>

      <button type="button" id="btnDownloadAction" onclick="handleDownloadAction()" class="btn-bottom btn-bottom-action">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span id="btnDownloadActionText">Tout télécharger</span>
      </button>
    </div>
  </div>

  <!-- TOAST -->
  <div id="toast" class="toast">
    <span id="toastMsg">Notification</span>
  </div>

  <script>
    // URL réelle de téléchargement direct préservée dans la barre d'adresse

    window.__SHARE_ID__ = ${JSON.stringify(folder.id)};
    window.__SHARE_TITLE__ = ${JSON.stringify(folder.title || 'StudyCloud_Partage')};
    window.__FILES__ = ${filesJson};
    // TOUT EST COCHÉ PAR DÉFAUT
    window.__SELECTED_FILES__ = new Set(window.__FILES__.map(f => String(f.id)));

    function showToast(msg, duration) {
      const dur = duration || 3000;
      const t = document.getElementById('toast');
      const tm = document.getElementById('toastMsg');
      if (!t || !tm) return;
      tm.textContent = msg;
      t.classList.add('show');
      clearTimeout(window.__toastTimeout);
      window.__toastTimeout = setTimeout(() => t.classList.remove('show'), dur);
    }

    function updateActionButtons() {
      const total = window.__FILES__.length;
      const selectedCount = window.__SELECTED_FILES__.size;
      const btnAction = document.getElementById('btnDownloadAction');
      const btnText = document.getElementById('btnDownloadActionText');

      if (selectedCount === 0) {
        btnText.textContent = 'Sélectionner';
        btnAction.disabled = true;
      } else if (selectedCount === total) {
        // TOUT EST COCHÉ -> Tout télécharger
        btnText.textContent = 'Tout télécharger';
        btnAction.disabled = false;
      } else if (selectedCount < 2) {
        // INFÉRIEUR À 2 (1 fichier coché) -> Télécharger
        btnText.textContent = 'Télécharger';
        btnAction.disabled = false;
      } else {
        // Plusieurs fichiers cochés
        btnText.textContent = 'Télécharger (' + selectedCount + ')';
        btnAction.disabled = false;
      }
    }

    function toggleFileSelection(fileId) {
      const fid = String(fileId);
      const el = document.querySelector('.file-grid-item[data-id="' + fid + '"]');
      if (window.__SELECTED_FILES__.has(fid)) {
        window.__SELECTED_FILES__.delete(fid);
        if (el) el.classList.remove('selected');
      } else {
        window.__SELECTED_FILES__.add(fid);
        if (el) el.classList.add('selected');
      }
      updateActionButtons();
    }

    function toggleSelectAll() {
      const total = window.__FILES__.length;
      const allSelected = window.__SELECTED_FILES__.size === total;
      const items = document.querySelectorAll('.file-grid-item');

      if (allSelected) {
        window.__SELECTED_FILES__.clear();
        items.forEach(el => el.classList.remove('selected'));
      } else {
        window.__SELECTED_FILES__ = new Set(window.__FILES__.map(f => String(f.id)));
        items.forEach(el => el.classList.add('selected'));
      }
      updateActionButtons();
    }

    function downloadDirectFile(url, name) {
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = name || 'document';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // BOUTON 1: Tout télécharger en fichier ZIP
    async function handleDownloadZip() {
      const selected = window.__FILES__.filter(f => window.__SELECTED_FILES__.has(String(f.id)));
      if (selected.length === 0) {
        showToast('Veuillez cocher au moins un fichier.');
        return;
      }

      showToast('Préparation de votre fichier ZIP...');
      fetch('/api/shares/' + encodeURIComponent(window.__SHARE_ID__) + '/track-download', { method: 'POST' }).catch(() => {});

      if (window.JSZip) {
        try {
          const zip = new JSZip();
          for (const file of selected) {
            if (!file.url) continue;
            const resp = await fetch(file.url);
            const blob = await resp.blob();
            zip.file(file.name, blob);
          }
          const content = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = (window.__SHARE_TITLE__ || 'StudyCloud_Dossier') + '.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast('Téléchargement du ZIP lancé !');
          return;
        } catch (err) {
          console.warn('Erreur création ZIP:', err);
        }
      }

      // Fallback si JSZip indisponible
      triggerFilesDownload(selected);
    }

    // BOUTON 2: Tout télécharger / Télécharger
    function handleDownloadAction() {
      const selected = window.__FILES__.filter(f => window.__SELECTED_FILES__.has(String(f.id)));
      if (selected.length === 0) {
        showToast('Veuillez cocher au moins un fichier.');
        return;
      }
      showToast('Téléchargement de ' + selected.length + ' fichier(s)...');
      fetch('/api/shares/' + encodeURIComponent(window.__SHARE_ID__) + '/track-download', { method: 'POST' }).catch(() => {});
      triggerFilesDownload(selected);
    }

    function triggerFilesDownload(files) {
      files.forEach((file, idx) => {
        if (!file.url) return;
        setTimeout(() => {
          downloadDirectFile(file.url, file.name);
        }, idx * 350);
      });
    }

    // Initialisation immédiate de l'état des boutons
    updateActionButtons();
  </script>
</body>
</html>`;
}

// Schéma D1 déjà initialisé définitivement en base de données
let isSchemaInitialized = true;
let isEmailVerifTableInitialized = true;
let isReferralsTableInitialized = false;

function generateReferralCode(): string {
  // Code d'invitation à 9 chiffres (ex: 171765542)
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

async function ensureReferralsTables(db: any) {
  if (isReferralsTableInitialized || !db) return;
  try {
    // 1. Ajout sécurisé des colonnes de parrainage sur la table users
    try { await db.prepare("ALTER TABLE users ADD COLUMN referral_code TEXT").run(); } catch (e) {}
    try { await db.prepare("ALTER TABLE users ADD COLUMN referred_by TEXT").run(); } catch (e) {}
    try { await db.prepare("ALTER TABLE users ADD COLUMN referrals_count INTEGER DEFAULT 0").run(); } catch (e) {}
    try { await db.prepare("ALTER TABLE users ADD COLUMN ad_free_days_earned INTEGER DEFAULT 0").run(); } catch (e) {}

    // 2. Table des parrainages (un utilisateur ne peut être parrainé qu'une seule fois)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS referrals (
        id TEXT PRIMARY KEY,
        referrer_id TEXT NOT NULL,
        referred_user_id TEXT NOT NULL UNIQUE,
        referred_user_name TEXT,
        referred_user_email TEXT,
        reward_days INTEGER DEFAULT 5,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)
    `).run();

    // 3. Table de configuration des récompenses de parrainage (modifiable par les admins)
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS referral_rewards_config (
        id TEXT PRIMARY KEY DEFAULT 'default',
        days_per_referral INTEGER DEFAULT 5,
        milestones_json TEXT,
        rules_text_json TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const defaultMilestones = JSON.stringify([
      { count: 3, extra_days: 5, label: "3 personnes promues : +5 jours bonus" },
      { count: 5, extra_days: 10, label: "5 personnes promues : +10 jours bonus" },
      { count: 7, extra_days: 15, label: "7 personnes promues : +15 jours bonus" },
      { count: 10, extra_days: 3650, label: "10 personnes promues : +3650 jours bonus" },
    ]);

    const defaultRules = JSON.stringify([
      "Chaque fois que vous promouvez avec succès une personne qui s'inscrit, vous bénéficierez de 5 jours de publicité gratuite, qui peuvent être accumulés de manière illimitée~",
      "Un total de 3 personnes inscrites par vous, et 5 jours supplémentaires de publicité gratuite offerts~",
      "Un total de 5 personnes inscrites par vous, et 10 jours supplémentaires de publicité gratuite offerts~",
      "Un total de 7 personnes inscrites par vous, et 15 jours supplémentaires de publicité gratuite offerts~",
      "Un total de 10 personnes inscrites par vous, et 3650 jours supplémentaires de publicité gratuite offerts~"
    ]);

    await db.prepare(`
      INSERT OR IGNORE INTO referral_rewards_config (id, days_per_referral, milestones_json, rules_text_json, updated_at)
      VALUES ('default', 5, ?, ?, CURRENT_TIMESTAMP)
    `).bind(defaultMilestones, defaultRules).run();

    isReferralsTableInitialized = true;
  } catch (e) {
    console.error('[StudyCloud Referrals Init Error]', e);
  }
}

async function processReferralAttribution(
  db: any,
  referralCode: string,
  newUserId: string,
  newUserName: string,
  newUserEmail: string
) {
  if (!db || !referralCode || !newUserId) return;
  try {
    await ensureReferralsTables(db);
    const cleanCode = String(referralCode).trim();
    if (!cleanCode) return;

    // 1. Rechercher le parrain
    const referrer: any = await db.prepare(
      'SELECT id, name, referral_code, referrals_count, ad_free_days_earned FROM users WHERE referral_code = ?'
    ).bind(cleanCode).first();

    if (!referrer || referrer.id === newUserId) {
      return;
    }

    // 2. Vérifier si ce compte est déjà inscrit ou parrainé ("si un utilisateur a déjà un compte ou est inscrit déjà sa compte pas")
    const alreadyReferred: any = await db.prepare(
      'SELECT id FROM referrals WHERE referred_user_id = ?'
    ).bind(newUserId).first();

    if (alreadyReferred) {
      return;
    }

    // 3. Charger la configuration des récompenses depuis la base de données
    const configRow: any = await db.prepare(
      "SELECT days_per_referral, milestones_json FROM referral_rewards_config WHERE id = 'default'"
    ).first();

    const baseDays = Number(configRow?.days_per_referral) || 5;
    let extraMilestoneDays = 0;
    const currentCount = Number(referrer.referrals_count || 0) + 1;

    if (configRow?.milestones_json) {
      try {
        const milestones = JSON.parse(configRow.milestones_json);
        if (Array.isArray(milestones)) {
          const match = milestones.find((m: any) => Number(m.count) === currentCount);
          if (match && Number(match.extra_days)) {
            extraMilestoneDays = Number(match.extra_days);
          }
        }
      } catch (e) {}
    }

    const totalRewardDays = baseDays + extraMilestoneDays;

    // 4. Enregistrer le parrainage dans la table referrals
    const referralId = generateId();
    await db.prepare(`
      INSERT INTO referrals (id, referrer_id, referred_user_id, referred_user_name, referred_user_email, reward_days, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(referralId, referrer.id, newUserId, newUserName, newUserEmail, totalRewardDays).run();

    // 5. Mettre à jour le compteur et les jours de visibilité/pub gratuite du parrain
    await db.prepare(`
      UPDATE users SET
        referrals_count = COALESCE(referrals_count, 0) + 1,
        ad_free_days_earned = COALESCE(ad_free_days_earned, 0) + ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(totalRewardDays, referrer.id).run();

    // 6. Enregistrer le parrain sur le compte du nouvel utilisateur
    await db.prepare(`
      UPDATE users SET
        referred_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(referrer.referral_code, newUserId).run();

    console.log(`[Parrainage Réussi] Utilisateur ${newUserId} parrainé par ${referrer.name} (${cleanCode}) : +${totalRewardDays} jours.`);
  } catch (err) {
    console.error('[Erreur Attribution Parrainage]', err);
  }
}

// ============================================================================
// Gestionnaire Principal du Worker
// ============================================================================
export default {
  async fetch(request: Request, rawEnv: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin') || '*';

    // Normalisation des liaisons D1 & R2 (Le Worker Principal gère l'Auth, les Données et le Stockage R2)
    const dbInstance = rawEnv['MON_D1-STUDYCLOUD'] || rawEnv.MON_D1_STUDYCLOUD || rawEnv.DB;
    const bucketInstance = rawEnv['MON_R2-STUDYCLOUD'] || rawEnv.MON_R2_STUDYCLOUD || rawEnv.BUCKET;

    const env: { DB: D1Database; BUCKET: R2Bucket } = {
      ...rawEnv,
      DB: dbInstance as D1Database,
      BUCKET: bucketInstance as R2Bucket,
    };

    // Gestion du Preflight CORS
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    try {
      // ----------------------------------------------------------------------
      // Assets publics (Logo ADN pour emails et applications)
      // ----------------------------------------------------------------------
      if (path === '/api/assets/dna-logo.png' || path === '/assets/dna-logo.png') {
        const pngBytes = Uint8Array.from(atob(DNA_LOGO_PNG_B64), (c) => c.charCodeAt(0));
        return new Response(pngBytes, {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (path === '/api/assets/dna-logo.svg' || path === '/assets/dna-logo.svg') {
        return new Response(DNA_LOGO_SVG, {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // ----------------------------------------------------------------------
      // Health Check & Diagnostic des liaisons Cloudflare
      // ----------------------------------------------------------------------
      if (path === '/' || path === '/api/health') {
        return jsonResponse({
          success: true,
          service: 'StudyCloud Cloudflare Worker API (Auth, Files & Database)',
          status: 'online',
          database: dbInstance ? 'Connecté (D1: d1-studycloud)' : 'Non lié',
          storage: bucketInstance ? 'Connecté (R2: r2-studycloud)' : 'Non lié',
          ai: 'Géré exclusivement par le Worker IA dédié (studycloud-ai.delmaskouassidibi.workers.dev)',
          bindings: {
            d1: !!dbInstance,
            r2: !!bucketInstance,
          },
          timestamp: new Date().toISOString(),
        }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // Redirection directe vers la page d'inscription de l'application
      // ----------------------------------------------------------------------
      if ((path.startsWith('/invite/') || path.startsWith('/join/') || path.startsWith('/p/')) && method === 'GET') {
        const refCode = path.split('/')[2];
        const cleanRef = refCode ? decodeURIComponent(refCode).trim() : '';
        const targetUrl = `https://studycloud.dkd-technologies.com/?ref=${encodeURIComponent(cleanRef)}#register`;
        return Response.redirect(targetUrl, 302);
      }

      // ----------------------------------------------------------------------
      // Page autonome de téléchargement et consultation de partage
      // (Servie directement en HTML par le Worker - Pas de redirection SPA)
      // ----------------------------------------------------------------------
      if ((path.startsWith('/s/') || path.startsWith('/share/') || path.startsWith('/d/')) && method === 'GET') {
        const code = path.split('/')[2];
        if (code && env.DB) {
          if (!isSchemaInitialized) await ensureDatabaseSchema(env.DB);
          const cleanCode = decodeURIComponent(code).trim();
          const folder: any = await env.DB.prepare(
            'SELECT * FROM shared_folders WHERE share_code = ? OR id = ? LIMIT 1'
          ).bind(cleanCode, cleanCode).first();

          if (folder) {
            await env.DB.prepare('UPDATE shared_folders SET views_count = views_count + 1 WHERE id = ?').bind(folder.id).run();
            const { results: files } = await env.DB.prepare(
              'SELECT * FROM shared_folder_files WHERE shared_folder_id = ?'
            ).bind(folder.id).all();

            const html = renderShareLandingHtml(folder, files || [], url.origin);
            return new Response(html, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Set-Cookie': `sc_share_last=${encodeURIComponent(cleanCode)}; Path=/; SameSite=Lax; HttpOnly; Max-Age=86400`,
                ...corsHeaders(origin),
              },
            });
          } else {
            const notFoundHtml = renderShareNotFoundHtml(cleanCode, url.origin);
            return new Response(notFoundHtml, {
              status: 404,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                ...corsHeaders(origin),
              },
            });
          }
        }
      }

      // ----------------------------------------------------------------------
      // Gestion de la page /share masquée (après masquage d'URL par replaceState)
      // Si l'utilisateur actualise (F5), le cookie sécurisé recharge le document.
      // Sans lien valide préalable, redirection immédiate vers l'application principale.
      // ----------------------------------------------------------------------
      if ((path === '/share' || path === '/s' || path === '/share/' || path === '/s/') && method === 'GET') {
        const cookieHeader = request.headers.get('Cookie') || '';
        const cookieMatch = cookieHeader.match(/(?:^|;\s*)sc_share_last=([^;]+)/);
        if (cookieMatch && cookieMatch[1] && env.DB) {
          if (!isSchemaInitialized) await ensureDatabaseSchema(env.DB);
          const savedCode = decodeURIComponent(cookieMatch[1]).trim();
          const folder: any = await env.DB.prepare(
            'SELECT * FROM shared_folders WHERE share_code = ? OR id = ? LIMIT 1'
          ).bind(savedCode, savedCode).first();

          if (folder) {
            const { results: files } = await env.DB.prepare(
              'SELECT * FROM shared_folder_files WHERE shared_folder_id = ?'
            ).bind(folder.id).all();

            const html = renderShareLandingHtml(folder, files || [], url.origin);
            return new Response(html, {
              status: 200,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache',
                ...corsHeaders(origin),
              },
            });
          }
        }
        return Response.redirect('https://studycloud.dkd-technologies.com', 302);
      }

      // ----------------------------------------------------------------------
      // Vérification de sécurité des liaisons D1 & R2
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/') && !path.startsWith('/api/storage/') && !env.DB) {
        return errorResponse(
          "Base de données D1 non accessible. Veuillez lier votre base 'd1-studycloud' avec le nom de variable 'MON_D1_STUDYCLOUD' (ou 'MON_D1-STUDYCLOUD') dans Cloudflare Workers > Settings > Variables and Bindings > D1 Database Bindings.",
          503,
          origin
        );
      }

      if (path.startsWith('/api/storage/') && !env.BUCKET) {
        return errorResponse(
          "Stockage R2 non accessible. Veuillez lier votre bucket 'r2-studycloud' avec le nom de variable 'MON_R2_STUDYCLOUD' (ou 'MON_R2-STUDYCLOUD') dans Cloudflare Workers > Settings > Variables and Bindings > R2 Bucket Bindings.",
          503,
          origin
        );
      }

      // ----------------------------------------------------------------------
      // AUTH HELPERS — JWT & Crypto (Web Crypto API, native Workers)
      // ----------------------------------------------------------------------

      const JWT_SECRET = rawEnv.JWT_SECRET || 'studycloud-jwt-secret-key';
      const GOOGLE_CLIENT_ID = rawEnv.GOOGLE_CLIENT_ID || '';
      const GOOGLE_CLIENT_SECRET = rawEnv.GOOGLE_CLIENT_SECRET || '';
      const RESEND_API_KEY = rawEnv.RESEND_API_KEY || '';

      async function hashPassword(password: string): Promise<string> {
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iterations = 10000;
        const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
        const hashArray = Array.from(new Uint8Array(bits));
        const saltArray = Array.from(salt);
        return btoa(JSON.stringify({ salt: saltArray, hash: hashArray, iter: iterations }));
      }

      async function verifyPassword(password: string, stored: string): Promise<boolean> {
        try {
          const encoder = new TextEncoder();
          const parsed = JSON.parse(atob(stored));
          const { salt: saltArray, hash: hashArray } = parsed;
          const iterations = parsed.iter || 100000;
          const salt = new Uint8Array(saltArray);
          const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
          const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
          const newHash = Array.from(new Uint8Array(bits));
          return JSON.stringify(newHash) === JSON.stringify(hashArray);
        } catch { return false; }
      }

      async function createJWT(payload: object, expiresInHours = 720): Promise<string> {
        const encoder = new TextEncoder();
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const exp = Math.floor(Date.now() / 1000) + expiresInHours * 3600;
        const body = btoa(JSON.stringify({ ...payload, exp, iat: Math.floor(Date.now() / 1000) }));
        const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
        const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        return `${header}.${body}.${sig}`;
      }

      async function verifyJWT(token: string): Promise<any | null> {
        try {
          const encoder = new TextEncoder();
          const [header, body, sig] = token.split('.');
          const key = await crypto.subtle.importKey('raw', encoder.encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
          const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
          const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${header}.${body}`));
          if (!valid) return null;
          const payload = JSON.parse(atob(body));
          if (payload.exp < Math.floor(Date.now() / 1000)) return null;
          return payload;
        } catch { return null; }
      }

      async function hashToken(token: string): Promise<string> {
        const encoder = new TextEncoder();
        const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
        return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      function sanitizeUser(user: any) {
        if (!user) return null;
        const { password_hash: _ph, security_answer_1_hash: _s1, security_answer_2_hash: _s2, ...rest } = user;
        return {
          ...rest,
          has_password: Boolean(user.password_hash && typeof user.password_hash === 'string' && user.password_hash.trim().length > 0),
          has_security_questions: Boolean(
            user.security_answer_1_hash &&
            typeof user.security_answer_1_hash === 'string' &&
            user.security_answer_1_hash.trim().length > 0 &&
            user.security_answer_2_hash &&
            typeof user.security_answer_2_hash === 'string' &&
            user.security_answer_2_hash.trim().length > 0
          ),
        };
      }

      async function getAuthUser(req: Request): Promise<any | null> {
        const authHeader = req.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return null;
        const payload = await verifyJWT(token);
        if (!payload?.userId) return null;
        return payload;
      }

      function generateId(): string {
        return crypto.randomUUID();
      }

      function isValidEmail(email: string): boolean {
        if (!email || typeof email !== 'string') return false;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email.trim());
      }

      function validatePasswordFormat(pwd: string): { valid: boolean; error?: string } {
        if (!pwd || typeof pwd !== 'string') return { valid: false, error: 'Mot de passe requis' };
        if (pwd.length < 6) return { valid: false, error: 'Le mot de passe doit comporter au moins 6 caractères' };
        if (!/[a-zA-Z]/.test(pwd)) return { valid: false, error: 'Le mot de passe doit contenir des lettres' };
        if (!/[0-9]/.test(pwd)) return { valid: false, error: 'Le mot de passe doit contenir des chiffres' };
        if (!/[^a-zA-Z0-9]/.test(pwd)) return { valid: false, error: 'Le mot de passe doit contenir au moins un caractère spécial (ex: @, #, $, !, etc.)' };
        return { valid: true };
      }

      function generateEmailAvatar(email: string, name?: string): string {
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanName = (name || '').trim();
        let initials = 'SC';
        if (cleanName) {
          const parts = cleanName.split(/\s+/).filter(Boolean);
          initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : cleanName.slice(0, 2).toUpperCase();
        } else if (cleanEmail) {
          const local = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
          initials = local.slice(0, 2).toUpperCase() || 'SC';
        }
        const colors = ['#EA580C', '#0284C7', '#059669', '#7C3AED', '#D97706', '#0D9488', '#DC2626', '#4F46E5'];
        let hash = 0;
        const seed = cleanEmail || cleanName || 'studycloud';
        for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        const color = colors[Math.abs(hash) % colors.length];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><rect width="128" height="128" rx="28" fill="${color}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${initials.length > 1 ? '48' : '58'}" font-weight="700">${initials}</text></svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      }
      
      function htmlResponse(title: string, message: string, success: boolean, userId?: string, token?: string): Response {
        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - DKD</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 1rem;
            box-sizing: border-box;
        }
        .card {
            background: #1e293b;
            padding: 2.2rem 1.8rem;
            border-radius: 1.25rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
            text-align: center;
            max-width: 420px;
            width: 100%;
            border: 1px solid #334155;
            box-sizing: border-box;
        }
        .icon {
            font-size: 3.2rem;
            margin-bottom: 1rem;
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: ${success ? '#4ade80' : '#f87171'}; font-weight: 800; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
        .btn {
            display: inline-block;
            width: 100%;
            box-sizing: border-box;
            background: ${success ? '#EA580C' : '#475569'};
            color: white;
            padding: 0.8rem 1.5rem;
            border-radius: 0.75rem;
            text-decoration: none;
            font-weight: 700;
            font-size: 0.95rem;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn:hover { background: ${success ? '#c2410c' : '#334155'}; }
        .hint { margin-top: 1rem; font-size: 0.8rem; color: #64748b; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">${success ? '✅' : '❌'}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <button type="button" id="returnApp" class="btn">${success ? 'Retourner à l\'application' : 'Fermer cette fenêtre'}</button>
        <p class="hint" id="hintText">${success ? 'Votre appareil a validé votre confirmation. Vous pouvez fermer cet onglet.' : 'Vous pouvez fermer cet onglet et demander un nouveau lien.'}</p>
    </div>

    <script>
        const isSuccess = ${success};
        const userId = "${userId || ''}";
        const authToken = "${token || ''}";

        // 1. Stockage local standardisé pour synchroniser l'application sur le même appareil
        try {
            localStorage.setItem('dkd_verification_status', JSON.stringify({
                status: isSuccess ? 'confirmed' : 'expired',
                userId: userId,
                token: authToken,
                timestamp: Date.now()
            }));
        } catch(e) {}

        try {
            const bc = new BroadcastChannel('studycloud_email_verification');
            bc.postMessage({ success: isSuccess, userId: userId, token: authToken });
        } catch(e) {}

        try {
            localStorage.setItem('sc_email_verified_signal', JSON.stringify({
                success: isSuccess,
                userId: userId,
                token: authToken,
                time: Date.now()
            }));
        } catch(e) {}

        // 2. Tentative de déclenchement d'un deep link si l'app mobile est installée et fermeture
        document.getElementById('returnApp')?.addEventListener('click', (e) => {
            e.preventDefault();
            try {
                window.location.href = "dkdapp://verified?userId=" + userId;
            } catch (err) {}

            try {
                window.open('', '_self', '');
                window.close();
            } catch (err) {}

            setTimeout(() => {
                const hint = document.getElementById('hintText');
                if (hint) {
                    hint.innerText = "Vous pouvez fermer cet onglet et retourner dans votre application StudyCloud.";
                    hint.style.color = '#38bdf8';
                }
            }, 500);
        });
    </script>
</body>
</html>`;

        return new Response(html, {
          headers: { "Content-Type": "text/html;charset=UTF-8", ...corsHeaders('*') },
          status: success ? 200 : 400
        });
      }

      // Tables déjà créées en base de données D1 - Aucune requête DDL exécutée
      async function ensureEmailVerificationsTable(_db?: any, _force = false) {
        return;
      }

      async function sendConfirmationEmail(toEmail: string, name: string, token: string, appOrigin = 'https://studycloud.dkd-technologies.com', isLogin = false): Promise<void> {
        try {
          // L'URL de confirmation pointe DIRECTEMENT sur le Worker Cloudflare /verify pour afficher la page intermédiaire
          // et ne jamais rediriger sur le domaine d'accueil de l'application
          const workerBaseUrl = 'https://api-worker.dkd-technologies.com';
          const confirmUrl = `${workerBaseUrl}/verify?token=${encodeURIComponent(token)}`;
          const publicAssetOrigin = 'https://studycloud.dkd-technologies.com';

          const subject = isLogin
            ? '🔐 Confirmez votre connexion - StudyCloud'
            : '🎓 Confirmez votre adresse email - StudyCloud';
          const title = isLogin
            ? 'Autorisation de connexion'
            : 'Bienvenue sur StudyCloud !';
          const description = isLogin
            ? 'Une tentative de connexion a été initiée pour votre compte. Cliquez sur le bouton ci-dessous pour autoriser cette connexion en toute sécurité :'
            : 'Votre inscription est presque terminée ! Veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :';
          const buttonText = isLogin
            ? 'Autoriser la connexion'
            : 'Confirmer mon adresse email';
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'StudyCloud <noreply@dkd-technologies.com>',
              to: [toEmail],
              reply_to: 'StudyClouddkd@gmail.com',
              subject,
              html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%);padding:36px;text-align:center;">
              <img src="${publicAssetOrigin}/assets/dna-logo.png" alt="StudyCloud" width="56" height="56" style="display:inline-block;margin-bottom:12px;border-radius:12px;" />
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                <span style="color:#EA580C;">Study</span><span style="color:#3B82F6;">Cloud</span>
              </h1>
              <p style="margin:4px 0 0 0;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                DKD TECHNOLOGIES
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 36px;">
              <h2 style="margin:0 0 16px 0;color:#0f172a;font-size:20px;font-weight:700;">
                ${title}
              </h2>

              <p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;">
                Bonjour <strong>${name}</strong>,
              </p>

              <p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">
                ${description}
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:30px 0;">
                <tr>
                  <td align="center">
                    <a href="${confirmUrl}" target="_blank" style="display:inline-block;padding:16px 32px;background:linear-gradient(135deg, #EA580C 0%, #F97316 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:12px;box-shadow:0 4px 14px rgba(234,88,12,0.35);">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                StudyCloud par <strong>DKD Technologies</strong> · Abidjan, Côte d'Ivoire
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
            }),
          });
        } catch (e) {
          console.error('Failed to send confirmation email via Resend:', e);
        }
      }

      async function sendWelcomeEmail(
        toEmail: string,
        name: string,
        isStudent = true,
        school = '',
        filiere = '',
        appOrigin = 'https://studycloud.dkd-technologies.com'
      ): Promise<void> {
        try {
          const cleanOrigin = (appOrigin || 'https://studycloud.dkd-technologies.com').replace(/\/+$/, '');
          const subject = isStudent
            ? '🎉 Bienvenue sur StudyCloud - Votre espace est prêt !'
            : 'Bienvenue sur StudyCloud - Votre espace professionnel est prêt';
          const title = isStudent
            ? '🎉 Bienvenue sur StudyCloud !'
            : 'Bienvenue sur StudyCloud';

          const heading = isStudent
            ? `Bienvenue sur StudyCloud, ${name} ! 🎓`
            : `Bienvenue sur StudyCloud, ${name}`;

          const introText = isStudent
            ? `Toute l'équipe de <strong>StudyCloud</strong> a le plaisir de vous accueillir ! Votre profil a été configuré avec succès et votre espace de travail numérique personnel est immédiatement opérationnel.`
            : `Toute l'équipe de <strong>StudyCloud</strong> et de <strong>DKD Technologies</strong> a le plaisir de vous accueillir. Votre profil professionnel est configuré avec succès et votre environnement de travail numérique sécurisé est prêt à l'emploi.`;

          const featuresHeader = isStudent
            ? '🚀 Ce que vous pouvez faire dès maintenant :'
            : 'Vos fonctionnalités professionnelles dès aujourd\'hui :';

          const featuresList = isStudent
            ? `
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  📚 <strong>Gestion & Stockage de cours :</strong> Centralisez vos documents, fiches et polycopiés en lieu sûr.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  🤖 <strong>Assistant IA Delmas :</strong> Posez des questions sur vos cours, générez des résumés et préparez vos examens plus vite.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  👥 <strong>Partage & Collaboration :</strong> Échangez des dossiers de révision avec d'autres étudiants ou collègues.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  🔒 <strong>Sécurité DKD :</strong> Vos fichiers et données sont protégés et sauvegardés de manière isolée.
                </p>
            `
            : `
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Gestion documentaire & archivage sécurisé :</strong> Classez, organisez et retrouvez instantanément l'ensemble de vos dossiers, contrats, fiches de travail et présentations professionnelles.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Assistant d'Analyse IA Delmas :</strong> Analysez des rapports volumineux, synthétisez vos documents de travail, préparez vos réunions et rédigez des synthèses précises en un instant.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Partage & collaboration maîtrisée :</strong> Transmettez facilement des dossiers et documents à vos collaborateurs, partenaires et clients avec des accès fiables et protégés.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Productivité continue & mode hors-ligne :</strong> Consultez vos fichiers essentiels même en déplacement sans accès Internet, avec synchronisation automatique dès votre reconnexion.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Organisation & suivi d'activités :</strong> Structurez vos projets, planifiez vos sessions de travail et gérez vos priorités au quotidien grâce aux outils intégrés.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Confidentialité & sécurité DKD Technologies :</strong> Vos actifs professionnels et données sensibles sont strictement isolés, chiffrés et sauvegardés selon les standards de sécurité DKD.
                </p>
            `;

          const ctaText = isStudent
            ? 'Accéder à mon tableau de bord StudyCloud &rarr;'
            : 'Accéder à mon espace professionnel StudyCloud &rarr;';

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'StudyCloud <noreply@dkd-technologies.com>',
              to: [toEmail],
              reply_to: 'StudyClouddkd@gmail.com',
              subject,
              html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0c29;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f0c29;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.35);">
          <tr>
            <td height="6" style="background:linear-gradient(90deg, #EA580C, #F97316, #2563EB);"></td>
          </tr>
          <tr>
            <td style="padding:40px 36px 32px 36px;">
              <!-- Header with Official StudyCloud Brand -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
                <tr>
                  <td>
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:12px;width:38px;">
                          <img src="https://studycloud.dkd-technologies.com/assets/dna-logo.png" width="38" height="38" alt="Logo StudyCloud" style="display:block;border:0;width:38px;height:38px;margin:0;" />
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="line-height:1;">
                            <span style="font-size:26px;font-weight:900;color:#EA580C;letter-spacing:-0.5px;">Study</span><span style="font-size:26px;font-weight:900;color:#2563EB;letter-spacing:-0.5px;">Cloud</span>
                          </div>
                          <div style="font-size:9.5px;font-weight:800;color:#D97706;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">
                            DKD TECHNOLOGIES
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background:#f1f5f9;margin-bottom:26px;"></div>

              <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;font-weight:800;line-height:1.3;">
                ${heading}
              </h1>

              <p style="margin:0 0 20px 0;color:#334155;font-size:15px;line-height:1.6;">
                ${introText}
              </p>

              <!-- Contenu fluide directement sur le fond de la page (sans bloc ni cadre) -->
              <div style="margin:26px 0 28px 0;">
                <p style="margin:0 0 16px 0;font-size:14px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
                  ${featuresHeader}
                </p>

                ${featuresList}
              </div>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:32px 0 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${cleanOrigin}" target="_blank" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg, #EA580C 0%, #F97316 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;border-radius:14px;box-shadow:0 8px 24px rgba(234,88,12,0.35);">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0 0;color:#64748b;font-size:13px;line-height:1.5;text-align:center;">
                Besoin d'aide ou d'assistance ? Notre support est à votre disposition à <a href="mailto:StudyClouddkd@gmail.com" style="color:#2563EB;text-decoration:none;font-weight:600;">StudyClouddkd@gmail.com</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                StudyCloud conçu et propulsé par <strong>DKD Technologies</strong> · Abidjan, Côte d'Ivoire<br>
                Vous recevez cet email suite à la validation de votre profil sur StudyCloud.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
            }),
          });
        } catch (e) {
          console.error('Failed to send welcome email via Resend:', e);
        }
      }

      async function sendPasswordResetEmail(toEmail: string, name: string, code: string, appOrigin = 'https://studycloud.dkd-technologies.com'): Promise<void> {
        try {
          const cleanOrigin = (appOrigin || 'https://studycloud.dkd-technologies.com').replace(/\/+$/, '');
          const publicAssetOrigin = (!cleanOrigin || cleanOrigin.includes('localhost') || !cleanOrigin.startsWith('https://'))
            ? 'https://studycloud.dkd-technologies.com'
            : cleanOrigin;
          const subject = '🔑 Récupération de votre mot de passe - StudyCloud';
          const title = 'Code de réinitialisation 🔑';
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'StudyCloud <noreply@dkd-technologies.com>',
              to: [toEmail],
              reply_to: 'StudyClouddkd@gmail.com',
              subject,
              html: `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0c29;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f0c29;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.35);">
          <tr>
            <td height="6" style="background:linear-gradient(90deg, #EA580C, #F97316, #2563EB);"></td>
          </tr>
          <tr>
            <td style="padding:40px 36px 32px 36px;">
              <!-- Header with Official StudyCloud DKD Technologies Brand -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:28px;">
                <tr>
                  <td>
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:12px;width:38px;">
                          <img src="https://studycloud.dkd-technologies.com/assets/dna-logo.png" width="38" height="38" alt="Logo StudyCloud" style="display:block;border:0;width:38px;height:38px;margin:0;" />
                        </td>
                        <td style="vertical-align:middle;">
                          <div style="line-height:1;">
                            <span style="font-size:24px;font-weight:900;color:#EA580C;letter-spacing:-0.5px;">Study</span><span style="font-size:24px;font-weight:900;color:#2563EB;letter-spacing:-0.5px;">Cloud</span>
                          </div>
                          <div style="font-size:9px;font-weight:800;color:#D97706;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">
                            DKD TECHNOLOGIES
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="height:1px;background:#f1f5f9;margin-bottom:28px;"></div>

              <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:22px;font-weight:800;line-height:1.3;">
                ${title}
              </h1>

              <p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;">
                Bonjour <strong>${name || 'Étudiant'}</strong>,
              </p>

              <p style="margin:0 0 24px 0;color:#475569;font-size:14px;line-height:1.6;">
                Vous avez demandé la réinitialisation de votre mot de passe StudyCloud après avoir validé vos questions de sécurité. Utilisez le code secret ci-dessous pour définir votre nouveau mot de passe :
              </p>

              <div style="text-align:center;margin:32px 0;">
                <div style="display:inline-block;padding:18px 36px;background:#fff7ed;border:2px dashed #EA580C;border-radius:18px;">
                  <span style="font-family:monospace;font-size:34px;font-weight:900;color:#EA580C;letter-spacing:8px;">${code}</span>
                </div>
              </div>

              <div style="border-left:3px solid #f97316;padding-left:12px;margin:24px 0;">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
                  ⏳ <strong>Validité :</strong> Ce code expire dans 1 heure.<br>
                  🔒 <strong>Sécurité :</strong> Ne communiquez jamais ce code à un tiers. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                StudyCloud par <strong>DKD Technologies</strong> · Abidjan, Côte d'Ivoire
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
            }),
          });
        } catch (e) {
          console.error('Failed to send password reset email via Resend:', e);
        }
      }

      // Initialisation désactivée : Toutes les tables sont déjà créées et opérationnelles dans Cloudflare D1
      // Aucune requête CREATE TABLE, ALTER TABLE ou CREATE INDEX n'est exécutée pour garantir des performances optimales et éliminer tout coût D1 superflu.
      async function ensureDatabaseSchema(_db?: any, _force = false) {
        return;
      }

      // Alias de compatibilité
      const ensurePasswordResetsTable = ensureDatabaseSchema;

      async function ensureUsersTableUniqueIndex(_db?: any) {
        return;
      }

      // Suppression complète et sécurisée d'un utilisateur et de toutes ses tables associées
      async function deleteUserCompletely(db: any, userId: string) {
        if (!db || !userId) return;
        const tables = [
          'email_verifications',
          'auth_sessions',
          'user_preferences',
          'password_resets',
          'matieres',
          'files',
          'shared_folders',
          'shared_links',
          'schedule_config',
          'schedules',
          'notes',
          'shop_profiles',
          'shop_items',
          'support_tickets',
        ];
        for (const table of tables) {
          try {
            await db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId).run();
          } catch (e) {}
        }
        try {
          await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
          console.log(`[StudyCloud Expiration] Compte et données supprimés pour l'utilisateur : ${userId}`);
        } catch (e) {
          console.error(`[StudyCloud Expiration] Erreur suppression users ${userId}:`, e);
        }
      }

      // Nettoyage automatique désactivé pour préserver les comptes
      async function cleanupExpiredUnfinishedAccounts(db: any) {
        return;
      }


      // ----------------------------------------------------------------------
      // 0. AUTH — /api/auth/*
      // ----------------------------------------------------------------------

      // Initialisation paresseuse du schéma si ce n'est pas encore fait (exclut expressément le polling fréquent de vérification)
      if (path.startsWith('/api/auth/') && path !== '/api/auth/check-verification-status' && !isSchemaInitialized) {
        await ensureDatabaseSchema(env.DB);
        await ensureEmailVerificationsTable(env.DB);
      }

      // POST /api/auth/register — Inscription email/password avec confirmation obligatoire & questions de sécurité
      if (path === '/api/auth/register' && method === 'POST') {
        if (!isEmailVerifTableInitialized) await ensureEmailVerificationsTable(env.DB);
        if (!isSchemaInitialized) await ensureDatabaseSchema(env.DB);

        const body: any = await request.json();
        const {
          name,
          email,
          password,
          referralCode,
          securityQuestion1,
          securityAnswer1,
          securityQuestion2,
          securityAnswer2,
        } = body;
        if (!name || !email || !password) return errorResponse('Nom, email et mot de passe requis', 400, origin);
        if (!isValidEmail(email)) return errorResponse('Format d\'adresse email invalide (ex: exemple@gmail.com)', 400, origin);
        const pwdCheck = validatePasswordFormat(password);
        if (!pwdCheck.valid) return errorResponse(pwdCheck.error || 'Mot de passe non conforme', 400, origin);

        const cleanEmail = email.toLowerCase().trim();
        const existing: any = await env.DB.prepare('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?').bind(cleanEmail).first();

        const q1 = securityQuestion1 || 'Quelle est votre ville de naissance ?';
        const q2 = securityQuestion2 || 'Quel est le prénom de votre mère ?';
        const answer1Hash = securityAnswer1 ? await hashToken(securityAnswer1.slice(0, 30).toLowerCase().trim()) : '';
        const answer2Hash = securityAnswer2 ? await hashToken(securityAnswer2.slice(0, 30).toLowerCase().trim()) : '';

        if (existing) {
          // Si le compte est déjà actif, vérifié ou avec mot de passe : avertir immédiatement
          if (existing.is_onboarded === 1 || existing.email_verified === 1 || existing.password_hash) {
            return jsonResponse({
              success: false,
              alreadyRegistered: true,
              code: 'ACCOUNT_ALREADY_EXISTS',
              error: 'Cet e-mail est déjà associé à un compte. Veuillez vous connecter ou utiliser une autre adresse',
            }, 409, origin);
          }

          // Nettoyage si ancien compte fantôme non vérifié
          try {
            await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(existing.id).run();
          } catch (e) {}
        }

        const userId = generateId();
        const passwordHash = await hashPassword(password);
        const registrationPayload = JSON.stringify({
          userId,
          name: name.trim(),
          email: cleanEmail,
          passwordHash,
          referralCode: referralCode ? String(referralCode).trim() : '',
          securityQuestion1: q1,
          securityAnswer1Hash: answer1Hash,
          securityQuestion2: q2,
          securityAnswer2Hash: answer2Hash,
        });

        // Création du token de confirmation (valable 70 secondes, calé exactement sur le décompteur)
        const verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 70 * 1000).toISOString();

        // Nettoyer les anciennes demandes pour cet email
        await env.DB.prepare('DELETE FROM email_verifications WHERE LOWER(TRIM(email)) = ?').bind(cleanEmail).run();

        // Stocker TOUTES les données temporairement dans email_verifications.payload
        // AUCUNE insertion dans la table users tant que l'email n'est pas confirmé !
        try {
          await env.DB.prepare(`
            INSERT INTO email_verifications (id, user_id, email, token, payload, resend_count, block_stage, last_sent_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, ?)
          `).bind(generateId(), userId, cleanEmail, verificationToken, registrationPayload, expiresAt).run();
        } catch (insertErr: any) {
          if (String(insertErr).includes('FOREIGN KEY') || String(insertErr).includes('SQLITE_CONSTRAINT')) {
            // L'ancienne table D1 avait encore la contrainte FOREIGN KEY : suppression et recréation immédiate
            try {
              await env.DB.prepare("DROP TABLE IF EXISTS email_verifications").run();
            } catch (e) {}
            await ensureEmailVerificationsTable(env.DB);
            await env.DB.prepare(`
              INSERT INTO email_verifications (id, user_id, email, token, payload, resend_count, block_stage, last_sent_at, expires_at)
              VALUES (?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, ?)
            `).bind(generateId(), userId, cleanEmail, verificationToken, registrationPayload, expiresAt).run();
          } else {
            throw insertErr;
          }
        }

        const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
        await sendConfirmationEmail(cleanEmail, name.trim(), verificationToken, clientOrigin, false);

        return jsonResponse({
          success: true,
          requiresVerification: true,
          email: cleanEmail,
          resendCount: 0,
          maxCount: 5,
          nextAllowedAt: new Date(Date.now() + 70 * 1000).toISOString(),
          message: 'Un email de confirmation vous a été envoyé.',
        }, 201, origin);
      }

      // POST /api/auth/resend-verification — Renvoi avec rate-limit 70s & blocage progressif (1h -> 3h -> 24h) après 5 tentatives
      if (path === '/api/auth/resend-verification' && method === 'POST') {
        const body: any = await request.json();
        const { email } = body;
        if (!email) return errorResponse('Email requis', 400, origin);
        if (!isValidEmail(email)) return errorResponse('Format d\'adresse email invalide (ex: exemple@gmail.com)', 400, origin);

        const cleanEmail = email.toLowerCase().trim();
        const user: any = await env.DB.prepare('SELECT id, name, email_verified FROM users WHERE LOWER(TRIM(email)) = ?').bind(cleanEmail).first();
        const verif: any = await env.DB.prepare('SELECT * FROM email_verifications WHERE LOWER(TRIM(email)) = ? ORDER BY created_at DESC LIMIT 1').bind(cleanEmail).first();

        if (!user && !verif) return errorResponse('Aucune demande en attente pour cet email', 404, origin);

        let userName = user?.name || 'Étudiant';
        const isLoginFlow = user ? user.email_verified === 1 : false;

        if (verif?.payload) {
          try {
            const p = JSON.parse(verif.payload);
            if (p.name) userName = p.name;
          } catch (e) {}
        }

        const now = Date.now();
        const RESEND_COOLDOWN_MS = 70 * 1000;
        const TOKEN_EXPIRY_MS = 70 * 1000;

        if (verif) {
          // 1. Vérification si l'utilisateur est actuellement bloqué (progressif: 1h -> 3h -> 24h)
          if (verif.blocked_until) {
            const blockedTime = new Date(verif.blocked_until).getTime();
            if (blockedTime > now) {
              const remainingMs = blockedTime - now;
              const remainingMin = Math.ceil(remainingMs / 60000);
              const stage = verif.block_stage || 1;
              const stageHours = stage === 1 ? 1 : stage === 2 ? 3 : 24;
              return jsonResponse({
                success: false,
                error: `Quota de 5 renvois atteint. Votre compte est suspendu (${stageHours}h). Veuillez patienter ${remainingMin} minute(s).`,
                isBlocked: true,
                blockedUntil: verif.blocked_until,
                blockStage: stage,
                resendCount: verif.resend_count || 5,
                maxCount: 5,
                remainingMs,
              }, 429, origin);
            }
          }

          // 2. Vérification du décompte de 70 secondes entre deux renvois
          if (verif.last_sent_at) {
            const lastSentTime = new Date(verif.last_sent_at).getTime();
            const elapsed = now - lastSentTime;
            if (elapsed < RESEND_COOLDOWN_MS) {
              const remainingSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
              return jsonResponse({
                success: false,
                error: `Veuillez patienter ${remainingSec} seconde(s) avant de renvoyer l'email.`,
                isCooldown: true,
                nextAllowedAt: new Date(lastSentTime + RESEND_COOLDOWN_MS).toISOString(),
                remainingMs: RESEND_COOLDOWN_MS - elapsed,
                resendCount: verif.resend_count ?? 0,
                maxCount: 5,
              }, 429, origin);
            }
          }

          // 3. Calcul du nouveau compteur & paliers de blocage progressif (1h -> 3h -> 24h)
          let currentCount = verif.resend_count ?? 0;
          let currentStage = verif.block_stage || 0;

          // Si un blocage précédent vient d'expirer, on réinitialise le compteur de renvois pour le nouveau cycle
          if (verif.blocked_until && new Date(verif.blocked_until).getTime() <= now) {
            currentCount = 0;
          }

          const newCount = currentCount + 1;
          let blockedUntil: string | null = null;
          let isNowBlocked = false;
          let nextStage = currentStage;

          if (newCount >= 5) {
            // Palier suivant : 1 (1h) -> 2 (3h) -> 3 (24h) -> puis répétition du cycle (1h -> 3h -> 24h...)
            isNowBlocked = true;
            nextStage = (currentStage % 3) + 1;
            let blockDurationMs = 1 * 3600 * 1000; // 1 heure (Palier 1)
            if (nextStage === 2) {
              blockDurationMs = 3 * 3600 * 1000; // 3 heures (Palier 2)
            } else if (nextStage === 3) {
              blockDurationMs = 24 * 3600 * 1000; // 24 heures (Palier 3)
            }
            blockedUntil = new Date(now + blockDurationMs).toISOString();
          }

          const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
          const newExpiresAt = new Date(now + TOKEN_EXPIRY_MS).toISOString();
          const nextAllowedAt = new Date(now + RESEND_COOLDOWN_MS).toISOString();

          await env.DB.prepare(`
            UPDATE email_verifications SET
              token = ?,
              resend_count = ?,
              block_stage = ?,
              last_sent_at = CURRENT_TIMESTAMP,
              blocked_until = ?,
              expires_at = ?
            WHERE id = ?
          `).bind(newToken, newCount, nextStage, blockedUntil, newExpiresAt, verif.id).run();

          const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
          await sendConfirmationEmail(cleanEmail, userName, newToken, clientOrigin, isLoginFlow);

          const stageHours = nextStage === 1 ? 1 : nextStage === 2 ? 3 : 24;
          return jsonResponse({
            success: true,
            message: isNowBlocked
              ? `Email envoyé. Quota de 5 renvois atteint. Prochain renvoi bloqué pendant ${stageHours} heure${stageHours > 1 ? 's' : ''}.`
              : 'Email de confirmation renvoyé !',
            resendCount: newCount,
            maxCount: 5,
            isBlocked: isNowBlocked,
            blockedUntil,
            blockStage: nextStage,
            nextAllowedAt,
          }, 200, origin);
        } else {
          const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
          const newExpiresAt = new Date(now + TOKEN_EXPIRY_MS).toISOString();
          await env.DB.prepare(`
            INSERT INTO email_verifications (id, user_id, email, token, resend_count, block_stage, last_sent_at, expires_at)
            VALUES (?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP, ?)
          `).bind(generateId(), user?.id || generateId(), cleanEmail, newToken, newExpiresAt).run();

          const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
          await sendConfirmationEmail(cleanEmail, userName, newToken, clientOrigin, isLoginFlow);

          return jsonResponse({
            success: true,
            message: 'Email de confirmation renvoyé !',
            resendCount: 1,
            maxCount: 5,
            isBlocked: false,
            blockedUntil: null,
            blockStage: 0,
            nextAllowedAt: new Date(now + RESEND_COOLDOWN_MS).toISOString(),
          }, 200, origin);
        }
      }

      // GET /api/auth/check-verification-status — Polling cross-device pour détecter la confirmation en direct (smartphone -> ordinateur)
      // GET /api/auth/check-verification-status?email=... — Polling automatique de confirmation
      if (path === '/api/auth/check-verification-status' && method === 'GET') {
        const emailParam = url.searchParams.get('email');
        const userIdParam = url.searchParams.get('userId');
        if (!emailParam && !userIdParam) return errorResponse('Email ou userId requis', 400, origin);
        const cleanEmail = (emailParam || '').toLowerCase().trim();

        // 1. Récupérer TOUJOURS la demande de vérification la plus RÉCENTE pour cet email
        // IMPORTANT : Ne JAMAIS filtrer sur confirmed=1, afin d'inspecter la tentative en cours !
        let latestVerif: any = null;
        try {
          latestVerif = await env.DB.prepare(`
            SELECT * FROM email_verifications
            WHERE LOWER(TRIM(email)) = ? OR user_id = ?
            ORDER BY created_at DESC, rowid DESC LIMIT 1
          `).bind(cleanEmail, userIdParam || '').first();
        } catch (e) {
          try {
            latestVerif = await env.DB.prepare(`
              SELECT * FROM email_verifications
              WHERE LOWER(TRIM(email)) = ?
              ORDER BY rowid DESC LIMIT 1
            `).bind(cleanEmail).first();
          } catch (e2) {}
        }

        // 2. Si aucune demande trouvée, aucune vérification en attente
        if (!latestVerif) {
          return jsonResponse({
            success: true,
            confirmed: false,
            clicked: false,
            resendCount: 0,
            maxCount: 5,
            isBlocked: false,
            blockedUntil: null,
            blockStage: 0,
          }, 200, origin);
        }

        // 3. Vérifier si CETTE tentative précise a été validée par clic sur le lien de l'email
        const isConfirmed = Number(latestVerif.confirmed) === 1 || Number(latestVerif.used) === 1 || Number(latestVerif.clicked) === 1;

        if (isConfirmed) {
          // L'utilisateur a bien cliqué sur le lien de confirmation envoyé pour cette tentative
          const user = await env.DB.prepare('SELECT * FROM users WHERE id = ? OR LOWER(TRIM(email)) = ?').bind(latestVerif.user_id, cleanEmail).first();
          if (user) {
            let jwtToken = latestVerif?.confirmed_jwt;
            if (!jwtToken) {
              jwtToken = await createJWT({ userId: user.id, email: user.email, name: user.name });
              const tokenHash = await hashToken(jwtToken);
              const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
              await env.DB.prepare('INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(generateId(), user.id, tokenHash, expiresAt).run();
              try {
                await env.DB.prepare('UPDATE email_verifications SET confirmed_jwt = ? WHERE id = ?').bind(jwtToken, latestVerif.id).run();
              } catch (e3) {}
            }
            return jsonResponse({
              success: true,
              confirmed: true,
              clicked: true,
              token: jwtToken,
              user: sanitizeUser(user),
            }, 200, origin);
          }
        }

        // 4. Si NON CONFIRMÉ pour cette tentative : JAMAIS de bypass automatique, même si users.email_verified == 1 !
        // L'utilisateur DOIT impérativement cliquer sur l'email envoyé avant de passer.
        const now = Date.now();
        let isBlocked = false;
        let blockedUntil = latestVerif?.blocked_until || null;
        let resendCount = typeof latestVerif?.resend_count === 'number' ? latestVerif.resend_count : 0;
        let blockStage = latestVerif?.block_stage ?? 0;

        if (blockedUntil) {
          if (new Date(blockedUntil).getTime() > now) {
            isBlocked = true;
          } else {
            blockedUntil = null;
            resendCount = 0;
          }
        }

        return jsonResponse({
          success: true,
          confirmed: false,
          clicked: false,
          resendCount,
          maxCount: 5,
          isBlocked,
          blockedUntil,
          blockStage,
        }, 200, origin);
      }

      // GET /verify (et alias /api/auth/verify-email) — Page intermédiaire autonome
      if ((path === '/verify' || path === '/api/auth/verify-email') && method === 'GET') {
        const token = url.searchParams.get('token');

        if (!token) {
          return htmlResponse("Lien invalide", "Le lien de confirmation est incomplet.", false);
        }

        try {
          // 1. Rechercher le token dans la base D1
          const record: any = await env.DB.prepare(
            "SELECT * FROM email_verifications WHERE token = ?"
          ).bind(token).first();

          if (!record) {
            return htmlResponse("Lien expiré ou déjà utilisé", "Ce lien ne peut plus être utilisé ou n'est plus valide. Veuillez vous connecter.", false);
          }

          // Si déjà validé
          if (Number(record.used) === 1 || Number(record.confirmed) === 1) {
            let jwtToken = record.confirmed_jwt;
            if (!jwtToken) {
              const user: any = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(record.user_id).first();
              if (user) {
                jwtToken = await createJWT({ userId: user.id, email: user.email, name: user.name });
              }
            }
            return htmlResponse(
              "Confirmation déjà effectuée !",
              "Ce lien ne peut plus être réutilisé car la confirmation a déjà été validée. Cet e-mail est déjà associé à un compte. Vous pouvez retourner dans l'application pour vous connecter.",
              true,
              record.user_id,
              jwtToken
            );
          }

          // 2. Vérifier l'expiration (avec 15s de marge de tolérance pour latence réseau / horloge)
          const now = Date.now();
          const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : 0;
          const GRACE_PERIOD_MS = 15 * 1000;

          if (expiresAt > 0 && now > (expiresAt + GRACE_PERIOD_MS)) {
            return htmlResponse("Lien expiré", "Ce lien ne peut plus être utilisé car son délai de validité (70 secondes) a expiré. Veuillez réclamer un nouveau lien depuis l'application.", false);
          }

          let user: any = null;
          let isNewUser = false;

          // Si payload présent : CRÉATION DE L'UTILISATEUR DANS LA VRAIE TABLE USERS UNIQUEMENT MAINTENANT
          if (record.payload) {
            try {
              const userData = JSON.parse(record.payload);
              const userId = userData.userId || record.user_id || generateId();

              await env.DB.prepare(`
                INSERT INTO users (
                  id, name, email, password_hash, provider, email_verified, is_onboarded,
                  security_question_1, security_answer_1_hash, security_question_2, security_answer_2_hash,
                  last_active_at, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, 'email', 1, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                  email_verified = 1,
                  last_active_at = CURRENT_TIMESTAMP,
                  updated_at = CURRENT_TIMESTAMP
              `).bind(
                userId,
                userData.name || 'Étudiant',
                userData.email,
                userData.passwordHash || '',
                userData.securityQuestion1 || 'Quelle est votre ville de naissance ?',
                userData.securityAnswer1Hash || '',
                userData.securityQuestion2 || 'Quel est le prénom de votre mère ?',
                userData.securityAnswer2Hash || ''
              ).run();

              await env.DB.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').bind(userId).run();

              user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
              isNewUser = true;

              // Génération immédiate d'un code unique de parrainage pour le nouvel utilisateur
              let newRefCode = generateReferralCode();
              try {
                let codeExists = await env.DB.prepare("SELECT id FROM users WHERE referral_code = ?").bind(newRefCode).first();
                while (codeExists) {
                  newRefCode = generateReferralCode();
                  codeExists = await env.DB.prepare("SELECT id FROM users WHERE referral_code = ?").bind(newRefCode).first();
                }
                await env.DB.prepare("UPDATE users SET referral_code = COALESCE(referral_code, ?) WHERE id = ?").bind(newRefCode, userId).run();
              } catch (e) {}

              // Traitement du parrainage si le compte a été invité
              if (userData.referralCode) {
                await processReferralAttribution(env.DB, userData.referralCode, userId, userData.name || 'Étudiant', userData.email);
              }
            } catch (e) {
              console.error("Erreur création utilisateur depuis payload:", e);
            }
          }

          if (!user && record.user_id) {
            user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(record.user_id).first();
          }

          if (!user) {
            return htmlResponse("Compte introuvable", "Le compte associé à ce lien de confirmation est introuvable.", false);
          }

          // Marquer l'utilisateur comme vérifié
          await env.DB.prepare(`
            UPDATE users SET
              email_verified = 1,
              status = 'verified',
              last_active_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(user.id).run();

          // 3. Marquer le token comme utilisé et créer la session
          const jwtToken = await createJWT({ userId: user.id, email: user.email, name: user.name });
          const tokenHash = await hashToken(jwtToken);
          const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
          await env.DB.prepare('INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(generateId(), user.id, tokenHash, sessionExpiresAt).run();

          try {
            await env.DB.prepare(`
              UPDATE email_verifications SET
                used = 1,
                confirmed = 1,
                clicked = 1,
                confirmed_jwt = ?,
                confirmed_at = CURRENT_TIMESTAMP
              WHERE token = ?
            `).bind(jwtToken, token).run();
          } catch (e) {
            try {
              await env.DB.prepare(`
                UPDATE email_verifications SET
                  confirmed = 1,
                  confirmed_jwt = ?,
                  confirmed_at = CURRENT_TIMESTAMP
                WHERE token = ?
              `).bind(jwtToken, token).run();
            } catch (e2) {}
          }

          if (isNewUser) {
            const isUserStudent = user.is_student === 1 || (user.is_student === null && user.school && user.school !== 'Particulier / Professionnel' && user.school !== 'Professionnel / Particulier');
            sendWelcomeEmail(
              user.email,
              user.name || (isUserStudent ? 'Étudiant' : 'Membre'),
              Boolean(isUserStudent),
              user.school || '',
              user.filiere || '',
              origin !== '*' ? origin : 'https://studycloud.dkd-technologies.com'
            );
          }

          const accept = request.headers.get('Accept') || '';
          if (accept.includes('application/json') && !accept.includes('text/html')) {
            const safeUser = sanitizeUser(user);
            return jsonResponse({
              success: true,
              message: 'Adresse email confirmée avec succès !',
              token: jwtToken,
              user: safeUser,
            }, 200, origin);
          }

          // 4. Renvoyer la page HTML de succès
          return htmlResponse(
            "Confirmation réussie !",
            "Votre compte a été confirmé avec succès. Vous pouvez maintenant retourner dans l'application pour continuer.",
            true,
            user.id,
            jwtToken
          );
        } catch (err) {
          console.error('Erreur verify:', err);
          return htmlResponse("Erreur serveur", "Une erreur technique est survenue lors de la validation.", false);
        }
      }

      // POST /api/auth/login — Connexion email/password
      if (path === '/api/auth/login' && method === 'POST') {
        await ensureUsersTableUniqueIndex(env.DB);
        await cleanupExpiredUnfinishedAccounts(env.DB);

        const body: any = await request.json();
        const { email, password } = body;
        if (!email || !password) return errorResponse('Email et mot de passe requis', 400, origin);
        if (!isValidEmail(email)) return errorResponse('Format d\'adresse email invalide (ex: exemple@gmail.com)', 400, origin);

        const cleanEmail = email.toLowerCase().trim();
        const existingUser: any = await env.DB.prepare('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?').bind(cleanEmail).first();
        if (!existingUser) {
          return jsonResponse({
            success: false,
            userNotFound: true,
            code: 'USER_NOT_FOUND',
            error: 'Aucun compte associé à cette adresse email n\'a été trouvé. Veuillez créer votre compte pour continuer.',
          }, 404, origin);
        }

        if (existingUser.provider === 'google' && !existingUser.password_hash) {
          return jsonResponse({
            success: false,
            isGoogleAccount: true,
            code: 'GOOGLE_ACCOUNT_DETECTED',
            error: 'Ce compte utilise la connexion Google. Veuillez cliquer sur "Continuer avec Google" pour vous connecter instantanément.',
          }, 400, origin);
        }

        if (!existingUser.password_hash) {
          return errorResponse('Compte incomplet ou sans mot de passe défini.', 401, origin);
        }

        const valid = await verifyPassword(password, existingUser.password_hash);
        if (!valid) {
          return errorResponse('Mot de passe incorrect. Veuillez vérifier votre saisie ou réinitialiser votre mot de passe.', 401, origin);
        }

        const user = existingUser;

        // Générer le token de confirmation de connexion (valable 70 secondes, identique au décompteur)
        const verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 70 * 1000).toISOString();

        await env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ? OR LOWER(TRIM(email)) = ?').bind(user.id, cleanEmail).run();
        await env.DB.prepare(`
          INSERT INTO email_verifications (id, user_id, email, token, resend_count, block_stage, last_sent_at, expires_at)
          VALUES (?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, ?)
        `).bind(generateId(), user.id, cleanEmail, verificationToken, expiresAt).run();

        const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
        await sendConfirmationEmail(cleanEmail, user.name, verificationToken, clientOrigin, true);

        return jsonResponse({
          success: true,
          requiresVerification: true,
          isLogin: true,
          email: cleanEmail,
          resendCount: 0,
          maxCount: 5,
          nextAllowedAt: new Date(Date.now() + 70 * 1000).toISOString(),
          message: 'Un email de confirmation de connexion vous a été envoyé.',
        }, 200, origin);
      }

      // POST /api/auth/forgot-password/init — Demande de questions de sécurité avec quota 4/jour
      if (path === '/api/auth/forgot-password/init' && method === 'POST') {
        await ensurePasswordResetsTable(env.DB);
        const body: any = await request.json();
        const { email } = body;
        if (!email) return errorResponse('Email requis', 400, origin);
        if (!isValidEmail(email)) return errorResponse('Format d\'adresse email invalide (ex: exemple@gmail.com)', 400, origin);

        const cleanEmail = email.toLowerCase().trim();
        const user: any = await env.DB.prepare('SELECT id, name, email, security_question_1, security_question_2, security_answer_1_hash FROM users WHERE email = ?').bind(cleanEmail).first();
        if (!user) return errorResponse('Aucun compte trouvé avec cet email', 404, origin);

        // Vérification de quota : max 4 réclamations par 24h
        const now = Date.now();
        const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1000;
        const sinceDate = new Date(now - TWENTY_FOUR_HOURS_MS).toISOString();

        const recentAttempts: any = await env.DB.prepare(`
          SELECT * FROM password_resets 
          WHERE user_id = ? AND created_at > ?
          ORDER BY created_at ASC
        `).bind(user.id, sinceDate).all();

        const count = recentAttempts.results ? recentAttempts.results.length : 0;
        if (count >= 4) {
          const oldest = new Date(recentAttempts.results[0].created_at).getTime();
          const unblockTime = oldest + TWENTY_FOUR_HOURS_MS;
          const remainingMs = Math.max(0, unblockTime - now);
          const remainingHours = Math.ceil(remainingMs / (3600 * 1000));
          return jsonResponse({
            success: false,
            error: `Quota journalier atteint (4 réclamations max). Veuillez patienter ${remainingHours} heure(s) avant de recommencer.`,
            isBlocked: true,
            blockedUntil: new Date(unblockTime).toISOString(),
            remainingMs,
            remainingHours,
          }, 429, origin);
        }

        const q1 = user.security_question_1 || 'Quelle est votre ville de naissance ?';
        const q2 = user.security_question_2 || 'Quel est le prénom de votre mère ?';

        return jsonResponse({
          success: true,
          email: user.email,
          name: user.name,
          question1: q1,
          question2: q2,
          hasCustomQuestions: !!user.security_answer_1_hash,
          attemptsToday: count,
          maxAttempts: 4,
        }, 200, origin);
      }

      // POST /api/auth/forgot-password/verify-answers — Validation des questions de sécurité
      if (path === '/api/auth/forgot-password/verify-answers' && method === 'POST') {
        await ensurePasswordResetsTable(env.DB);
        const body: any = await request.json();
        const { email, answer1, answer2 } = body;
        if (!email || !answer1) return errorResponse('Email et réponse(s) de sécurité requis', 400, origin);

        const cleanEmail = email.toLowerCase().trim();
        const user: any = await env.DB.prepare('SELECT id, name, email, security_answer_1_hash, security_answer_2_hash FROM users WHERE email = ?').bind(cleanEmail).first();
        if (!user) return errorResponse('Utilisateur introuvable', 404, origin);

        if (user.security_answer_1_hash) {
          const hash1 = await hashToken(answer1.slice(0, 30).toLowerCase().trim());
          const match1 = hash1 === user.security_answer_1_hash;
          let match2 = true;
          if (user.security_answer_2_hash && answer2) {
            const hash2 = await hashToken(answer2.slice(0, 30).toLowerCase().trim());
            match2 = hash2 === user.security_answer_2_hash;
          }
          if (!match1 || !match2) {
            return errorResponse('Réponse(s) de sécurité incorrecte(s). Veuillez vérifier vos informations.', 400, origin);
          }
        }

        const resetSessionToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        return jsonResponse({
          success: true,
          verified: true,
          resetSessionToken,
          email: user.email,
          message: 'Informations personnelles vérifiées avec succès !',
        }, 200, origin);
      }

      // POST /api/auth/forgot-password/send-code — Envoi du code à l'adresse email choisie
      if (path === '/api/auth/forgot-password/send-code' && method === 'POST') {
        await ensurePasswordResetsTable(env.DB);
        const body: any = await request.json();
        const { email, resetSessionToken } = body;
        if (!email || !resetSessionToken) {
          return errorResponse('Email et token requis', 400, origin);
        }
        if (!isValidEmail(email)) return errorResponse('Format d\'adresse email du compte invalide (ex: exemple@gmail.com)', 400, origin);

        const cleanAccountEmail = email.toLowerCase().trim();
        // Sécurité stricte : le code est TOUJOURS envoyé à l'email qui a servi à créer le compte
        const cleanTargetEmail = cleanAccountEmail;
        const user: any = await env.DB.prepare('SELECT id, name, email FROM users WHERE LOWER(TRIM(email)) = ?').bind(cleanAccountEmail).first();
        if (!user) return errorResponse('Utilisateur introuvable', 404, origin);

        // Vérification du quota de 4 par tranche de 24h
        const now = Date.now();
        const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1000;
        const sinceDate = new Date(now - TWENTY_FOUR_HOURS_MS).toISOString();
        const recentAttempts: any = await env.DB.prepare(`
          SELECT * FROM password_resets 
          WHERE user_id = ? AND created_at > ?
          ORDER BY created_at ASC
        `).bind(user.id, sinceDate).all();

        const count = recentAttempts.results ? recentAttempts.results.length : 0;
        if (count >= 4) {
          const oldest = new Date(recentAttempts.results[0].created_at).getTime();
          const unblockTime = oldest + TWENTY_FOUR_HOURS_MS;
          const remainingMs = Math.max(0, unblockTime - now);
          const remainingHours = Math.ceil(remainingMs / (3600 * 1000));
          return jsonResponse({
            success: false,
            error: `Quota journalier atteint (4 réclamations par jour). Veuillez patienter ${remainingHours} heure(s).`,
            isBlocked: true,
            blockedUntil: new Date(unblockTime).toISOString(),
            remainingMs,
            remainingHours,
          }, 429, origin);
        }

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(now + 3600 * 1000).toISOString();

        await env.DB.prepare(`
          INSERT INTO password_resets (id, user_id, target_email, reset_code, attempts_today, last_requested_at, expires_at, used)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 0)
        `).bind(generateId(), user.id, cleanTargetEmail, resetCode, count + 1, expiresAt).run();

        const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
        await sendPasswordResetEmail(cleanTargetEmail, user.name, resetCode, clientOrigin);

        return jsonResponse({
          success: true,
          message: 'Le code de réinitialisation a été envoyé à votre adresse email !',
          targetEmail: cleanTargetEmail,
          attemptsToday: count + 1,
          maxAttempts: 4,
        }, 200, origin);
      }

      // POST /api/auth/reset-password — Réinitialisation effective avec le code à 6 chiffres
      if (path === '/api/auth/reset-password' && method === 'POST') {
        const body: any = await request.json();
        const { email, code, newPassword } = body;
        if (!email || !code || !newPassword) {
          return errorResponse('Email, code et nouveau mot de passe requis', 400, origin);
        }
        const pwdCheck = validatePasswordFormat(newPassword);
        if (!pwdCheck.valid) return errorResponse(pwdCheck.error || 'Nouveau mot de passe non conforme', 400, origin);

        const cleanEmail = email.toLowerCase().trim();
        const user: any = await env.DB.prepare('SELECT id, name FROM users WHERE email = ?').bind(cleanEmail).first();
        if (!user) return errorResponse('Utilisateur introuvable', 404, origin);

        const resetRecord: any = await env.DB.prepare(`
          SELECT * FROM password_resets
          WHERE user_id = ? AND reset_code = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP
          ORDER BY created_at DESC LIMIT 1
        `).bind(user.id, code.trim()).first();

        if (!resetRecord) {
          return errorResponse('Code de réinitialisation invalide ou expiré', 400, origin);
        }

        const newHash = await hashPassword(newPassword);
        await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(newHash, user.id).run();
        await env.DB.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').bind(resetRecord.id).run();
        await env.DB.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(user.id).run();

        return jsonResponse({
          success: true,
          message: 'Votre mot de passe a été modifié avec succès ! Vous pouvez maintenant vous connecter.',
        }, 200, origin);
      }

      // POST /api/auth/google — Échange du code Google OAuth
      if (path === '/api/auth/google' && method === 'POST') {
        const body: any = await request.json();
        const { code, redirectUri, action } = body;
        if (!code) return errorResponse('Code Google OAuth requis', 400, origin);

        // Échanger le code contre un access token Google
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri || `${new URL(request.url).origin}/auth/google/callback`,
            grant_type: 'authorization_code',
          }),
        });
        const tokenData: any = await tokenRes.json();
        if (!tokenData.access_token) return errorResponse('Échange Google OAuth échoué : ' + (tokenData.error_description || tokenData.error || 'inconnu'), 400, origin);

        // Récupérer le profil Google
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profile: any = await profileRes.json();
        if (!profile.id || !profile.email) return errorResponse('Impossible de récupérer le profil Google', 400, origin);

        // Trouver ou créer l'utilisateur
        const cleanGoogleEmail = profile.email.toLowerCase().trim();
        await ensureUsersTableUniqueIndex(env.DB);
        await cleanupExpiredUnfinishedAccounts(env.DB);

        let user: any = await env.DB.prepare('SELECT * FROM users WHERE google_id = ? OR LOWER(TRIM(email)) = ?').bind(profile.id, cleanGoogleEmail).first();
        if (!user) {
          // Création du compte Google si inexistant (valable en login et en register)
          const userId = generateId();
          let newRefCode = generateReferralCode();
          try {
            let codeExists = await env.DB.prepare("SELECT id FROM users WHERE referral_code = ?").bind(newRefCode).first();
            while (codeExists) {
              newRefCode = generateReferralCode();
              codeExists = await env.DB.prepare("SELECT id FROM users WHERE referral_code = ?").bind(newRefCode).first();
            }
          } catch (e) {}

          await env.DB.prepare(`
            INSERT INTO users (id, name, email, provider, google_id, email_verified, avatar_url, is_onboarded, referral_code, last_active_at, created_at, updated_at)
            VALUES (?, ?, ?, 'google', ?, 1, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(userId, profile.name || cleanGoogleEmail, cleanGoogleEmail, profile.id, profile.picture || null, newRefCode).run();
          await env.DB.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').bind(userId).run();
          user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

          if (body.referralCode) {
            await processReferralAttribution(env.DB, body.referralCode, userId, profile.name || cleanGoogleEmail, cleanGoogleEmail);
          }
        } else {
          // Si l'utilisateur existait déjà avec cet email, on associe google_id et on active la vérification email
          await env.DB.prepare(`
            UPDATE users SET
              google_id = COALESCE(google_id, ?),
              avatar_url = COALESCE(avatar_url, ?),
              email_verified = 1,
              last_active_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(profile.id, profile.picture || null, user.id).run();
          user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
        }

        const token = await createJWT({ userId: user.id, email: user.email, name: user.name });
        const tokenHash = await hashToken(token);
        const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
        await env.DB.prepare('INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(generateId(), user.id, tokenHash, expiresAt).run();

        const safeUser = sanitizeUser(user);
        return jsonResponse({
          success: true,
          token,
          user: safeUser,
          requiresOnboarding: user.is_onboarded === 0,
        }, 200, origin);
      }

      // POST /api/auth/logout — Invalidation du token
      if (path === '/api/auth/logout' && method === 'POST') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (token) {
          const tokenHash = await hashToken(token);
          await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(tokenHash).run();
        }
        return jsonResponse({ success: true, message: 'Déconnecté' }, 200, origin);
      }

      // GET /api/auth/me — Profil de l'utilisateur connecté (Persistance 30 jours)
      if (path === '/api/auth/me' && method === 'GET') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return errorResponse('Token requis', 401, origin);

        const payload = await verifyJWT(token);
        if (!payload?.userId) return errorResponse('Token invalide ou expiré', 401, origin);

        const user: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.userId).first();
        if (!user) return errorResponse('Utilisateur introuvable', 404, origin);

        // Règle d'inactivité de 30 jours (1 mois) pour les comptes confirmés
        if (user.last_active_at) {
          const inactiveMs = Date.now() - new Date(user.last_active_at).getTime();
          const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;
          if (inactiveMs > THIRTY_DAYS_MS) {
            try {
              await env.DB.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(user.id).run();
            } catch (e) {}
            return jsonResponse({
              success: false,
              error: 'Session expirée après 1 mois d\'inactivité. Veuillez vous reconnecter.',
              code: 'SESSION_EXPIRED_INACTIVE',
            }, 401, origin);
          }
        }
        await env.DB.prepare('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();

        // Renouveler de façon transparente la session dans auth_sessions (30 jours)
        try {
          const tokenHash = await hashToken(token);
          const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
          await env.DB.prepare('INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(generateId(), user.id, tokenHash, sessionExpiresAt).run();
        } catch (e) {}

        const safeUser = sanitizeUser(user);
        return jsonResponse({ success: true, data: safeUser }, 200, origin);
      }

      // PUT ou POST /api/auth/setup-security — Configuration obligatoire (Nom, Mot de passe, Questions de sécurité) après connexion Google
      if ((path === '/api/auth/setup-security' || path === '/api/auth/google/complete-security') && (method === 'PUT' || method === 'POST')) {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return errorResponse('Token requis', 401, origin);

        const payload = await verifyJWT(token);
        if (!payload?.userId) return errorResponse('Token invalide ou expiré', 401, origin);

        const body: any = await request.json();
        const { name, password, securityQuestion1, securityAnswer1, securityQuestion2, securityAnswer2 } = body;

        const pwdCheck = validatePasswordFormat(password);
        if (!pwdCheck.valid) return errorResponse(pwdCheck.error || 'Mot de passe non conforme', 400, origin);
        if (!securityAnswer1 || !securityAnswer1.trim() || !securityAnswer2 || !securityAnswer2.trim()) {
          return errorResponse('Veuillez renseigner les réponses à vos deux questions de sécurité', 400, origin);
        }

        const passwordHash = await hashPassword(password);
        const ans1Hash = await hashToken(securityAnswer1.slice(0, 30).toLowerCase().trim());
        const ans2Hash = await hashToken(securityAnswer2.slice(0, 30).toLowerCase().trim());
        const q1 = securityQuestion1 || 'Quelle est votre ville de naissance ?';
        const q2 = securityQuestion2 || 'Quel est le prénom de votre mère ?';
        const finalName = (name && typeof name === 'string' && name.trim()) ? name.trim() : null;

        await env.DB.prepare(`
          UPDATE users SET
            name = COALESCE(?, name),
            password_hash = ?,
            security_question_1 = ?,
            security_answer_1_hash = ?,
            security_question_2 = ?,
            security_answer_2_hash = ?,
            last_active_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(finalName, passwordHash, q1, ans1Hash, q2, ans2Hash, payload.userId).run();

        const updatedUser: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.userId).first();
        const safeUser = sanitizeUser(updatedUser);

        return jsonResponse({
          success: true,
          message: 'Sécurité de votre compte configurée avec succès !',
          user: safeUser,
        }, 200, origin);
      }

      // PUT /api/auth/onboarding — Complétion du profil (obligatoire après 1ère connexion)
      if (path === '/api/auth/onboarding' && method === 'PUT') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return errorResponse('Token requis', 401, origin);

        const payload = await verifyJWT(token);
        if (!payload?.userId) return errorResponse('Token invalide', 401, origin);

        const existingUser: any = await env.DB.prepare('SELECT id, email, is_onboarded FROM users WHERE id = ?').bind(payload.userId).first();
        if (!existingUser) {
          return errorResponse("Session introuvable ou expirée. Veuillez vous reconnecter.", 401, origin);
        }

        const body: any = await request.json();
        const { name, school, filiere, level, country, phone, bio, avatarUrl } = body;
        const isStudent = body.is_student === 0 || body.isStudent === false ? false : true;
        const profession = body.profession ? String(body.profession).trim() : '';
        const finalSchool = !isStudent ? 'Professionnel / Particulier' : school;
        const finalFiliere = !isStudent ? (profession || filiere || 'Général') : filiere;
        const finalLevel = !isStudent ? 'Professionnel' : (level || '');

        if (!country) return errorResponse('Le pays est obligatoire', 400, origin);
        if (!phone || !String(phone).trim()) return errorResponse('Le numéro de téléphone est obligatoire', 400, origin);

        // Validation du format téléphonique selon le pays
        const COUNTRY_PHONE_CONFIG: Record<string, { dial: string; lengths: number[]; hint: string }> = {
          "Côte d'Ivoire": { dial: '225', lengths: [10], hint: '10 chiffres' },
          'Sénégal': { dial: '221', lengths: [9], hint: '9 chiffres' },
          'Mali': { dial: '223', lengths: [8], hint: '8 chiffres' },
          'Burkina Faso': { dial: '226', lengths: [8], hint: '8 chiffres' },
          'Guinée': { dial: '224', lengths: [9], hint: '9 chiffres' },
          'Cameroun': { dial: '237', lengths: [9], hint: '9 chiffres' },
          'Gabon': { dial: '241', lengths: [7, 8], hint: '7 ou 8 chiffres' },
          'Congo': { dial: '242', lengths: [9], hint: '9 chiffres' },
          "République démocratique du Congo": { dial: '243', lengths: [9, 10], hint: '9 ou 10 chiffres' },
          'Madagascar': { dial: '261', lengths: [9, 10], hint: '9 ou 10 chiffres' },
          'Bénin': { dial: '229', lengths: [8, 10], hint: '8 ou 10 chiffres' },
          'Togo': { dial: '228', lengths: [8], hint: '8 chiffres' },
          'Niger': { dial: '227', lengths: [8], hint: '8 chiffres' },
          'Tchad': { dial: '235', lengths: [8], hint: '8 chiffres' },
          'Mauritanie': { dial: '222', lengths: [8], hint: '8 chiffres' },
          'Maroc': { dial: '212', lengths: [9, 10], hint: '9 ou 10 chiffres' },
          'Algérie': { dial: '213', lengths: [9, 10], hint: '9 ou 10 chiffres' },
          'Tunisie': { dial: '216', lengths: [8], hint: '8 chiffres' },
          'France': { dial: '33', lengths: [9, 10], hint: '9 ou 10 chiffres' },
          'Belgique': { dial: '32', lengths: [9, 10], hint: '9 ou 10 chiffres' },
          'Canada': { dial: '1', lengths: [10], hint: '10 chiffres' },
        };

        const countryCfg = COUNTRY_PHONE_CONFIG[country];
        if (countryCfg) {
          let pDigits = String(phone).replace(/\D/g, '');
          if (countryCfg.dial && pDigits.startsWith(countryCfg.dial) && !countryCfg.lengths.includes(pDigits.length)) {
            const withoutDial = pDigits.slice(countryCfg.dial.length);
            if (countryCfg.lengths.includes(withoutDial.length)) {
              pDigits = withoutDial;
            }
          }
          if (!countryCfg.lengths.includes(pDigits.length)) {
            return errorResponse(
              `Le numéro de téléphone pour ${country} doit comporter ${countryCfg.hint} (${pDigits.length} saisi${pDigits.length > 1 ? 's' : ''})`,
              400,
              origin
            );
          }
        }
        if (!isStudent && !profession) return errorResponse("La profession ou domaine d'activité est obligatoire", 400, origin);
        if (isStudent && (!finalSchool || !finalFiliere)) {
          return errorResponse("L'école et la filière sont obligatoires pour les étudiants", 400, origin);
        }

        const finalAvatar = avatarUrl
          ? String(avatarUrl).trim()
          : (existingUser.avatar_url || generateEmailAvatar(existingUser.email, name || ''));

        await env.DB.prepare(`
          UPDATE users SET
            name = COALESCE(?, name),
            school = ?,
            filiere = ?,
            level = ?,
            country = ?,
            phone = COALESCE(?, phone),
            bio = COALESCE(?, bio),
            avatar_url = COALESCE(?, avatar_url),
            profession = ?,
            is_student = ?,
            is_onboarded = 1,
            last_active_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(
          name || null,
          finalSchool,
          finalFiliere,
          finalLevel,
          country,
          phone || null,
          bio || null,
          finalAvatar,
          profession || null,
          isStudent ? 1 : 0,
          payload.userId
        ).run();

        const user: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.userId).first();
        
        // Envoi automatique de l'email de bienvenue professionnel StudyCloud / DKD Technologies
        if (user && user.email) {
          const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
          sendWelcomeEmail(
            user.email,
            user.name || name || (isStudent ? 'Étudiant' : 'Membre'),
            Boolean(isStudent),
            finalSchool,
            finalFiliere,
            clientOrigin
          );
        }

        const safeUser = sanitizeUser(user);
        return jsonResponse({ success: true, data: safeUser }, 200, origin);
      }

      // PUT /api/auth/onboarding/draft — Sauvegarde temporaire du questionnaire d'onboarding en cours
      if (path === '/api/auth/onboarding/draft' && method === 'PUT') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return errorResponse('Token requis', 401, origin);
        const payload = await verifyJWT(token);
        if (!payload?.userId) return errorResponse('Token invalide', 401, origin);

        const body: any = await request.json().catch(() => ({}));
        const { name, school, filiere, level, country, phone, bio, avatarUrl } = body;

        await env.DB.prepare(`
          UPDATE users SET
            name = COALESCE(?, name),
            school = COALESCE(?, school),
            filiere = COALESCE(?, filiere),
            level = COALESCE(?, level),
            country = COALESCE(?, country),
            phone = COALESCE(?, phone),
            bio = COALESCE(?, bio),
            avatar_url = COALESCE(?, avatar_url),
            last_active_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND is_onboarded = 0
        `).bind(
          name || null,
          school || null,
          filiere || null,
          level || null,
          country || null,
          phone || null,
          bio || null,
          avatarUrl || null,
          payload.userId
        ).run();

        return jsonResponse({ success: true, message: 'Brouillon sauvegardé.' }, 200, origin);
      }

      // POST /api/auth/cancel-unfinalized-account — Annulation et suppression immédiate des comptes non finalisés
      if (path === '/api/auth/cancel-unfinalized-account' && method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        let targetUserId = body.userId;
        let targetEmail = body.email ? String(body.email).toLowerCase().trim() : null;

        if (token) {
          try {
            const payload = await verifyJWT(token);
            if (payload?.userId) targetUserId = payload.userId;
            if (payload?.email && !targetEmail) targetEmail = String(payload.email).toLowerCase().trim();
          } catch (e) {}
        }

        let user: any = null;
        if (targetUserId) {
          user = await env.DB.prepare('SELECT id, email, is_onboarded FROM users WHERE id = ?').bind(targetUserId).first();
        }
        if (!user && targetEmail) {
          user = await env.DB.prepare('SELECT id, email, is_onboarded FROM users WHERE LOWER(TRIM(email)) = ?').bind(targetEmail).first();
        }

        if (user) {
          // Ne JAMAIS supprimer un compte dont l'email est déjà vérifié !
          const isEmailVerified = Number(user.email_verified) === 1;
          const isOnboarded = Number(user.is_onboarded) === 1;
          if (isEmailVerified || isOnboarded) {
            return jsonResponse({
              success: true,
              message: 'Compte actif et vérifié conservé.',
            }, 200, origin);
          }

          await deleteUserCompletely(env.DB, user.id);
          console.log(`[StudyCloud Expiration] Compte non vérifié annulé : ${user.email} (${user.id})`);

          return jsonResponse({
            success: true,
            message: 'Compte non finalisé annulé et données supprimées avec succès.',
          }, 200, origin);
        }

        return jsonResponse({ success: true, message: 'Aucun compte non finalisé à supprimer.' }, 200, origin);
      }

      // POST /api/auth/welcome-email — Envoi de l'email de bienvenue professionnel à la demande
      if (path === '/api/auth/welcome-email' && method === 'POST') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return errorResponse('Token requis', 401, origin);

        const payload = await verifyJWT(token);
        if (!payload?.userId) return errorResponse('Token invalide', 401, origin);

        const user: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.userId).first();
        if (!user || !user.email) return errorResponse('Utilisateur ou email introuvable', 404, origin);

        const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
        const isUserStudent = user.is_student === 1 || (user.is_student === null && user.school && user.school !== 'Particulier / Professionnel' && user.school !== 'Professionnel / Particulier');
        await sendWelcomeEmail(
          user.email,
          user.name || (isUserStudent ? 'Étudiant' : 'Membre'),
          Boolean(isUserStudent),
          user.school || '',
          user.filiere || '',
          clientOrigin
        );

        return jsonResponse({ success: true, message: 'Email de bienvenue envoyé' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 1. UTILISATEURS & PROFIL
      // ----------------------------------------------------------------------
      if (path === '/api/users/sync' && method === 'POST') {
        const body: any = await request.json();
        const { id, name, email, school, filiere, country, avatarUrl } = body;
        if (!id || !email) return errorResponse('ID et email requis', 400, origin);

        const cleanEmail = email.toLowerCase().trim();
        const hasAvatar = avatarUrl !== undefined;
        const avatarVal = avatarUrl ? String(avatarUrl) : null;

        // Rechercher si l'utilisateur existe déjà par id ou par email pour éviter les doublons
        const existing: any = await env.DB.prepare(
          'SELECT id FROM users WHERE id = ? OR LOWER(TRIM(email)) = ?'
        ).bind(id, cleanEmail).first();

        if (existing) {
          await env.DB.prepare(`
            UPDATE users SET
              name = COALESCE(?, name),
              email = ?,
              school = COALESCE(?, school),
              filiere = COALESCE(?, filiere),
              country = COALESCE(?, country),
              avatar_url = CASE WHEN ? = 1 THEN ? ELSE users.avatar_url END,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(
            name || null,
            cleanEmail,
            school || null,
            filiere || null,
            country || null,
            hasAvatar ? 1 : 0,
            avatarVal,
            existing.id
          ).run();
        } else {
          await env.DB.prepare(`
            INSERT INTO users (id, name, email, school, filiere, country, avatar_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            id,
            name || 'Étudiant',
            cleanEmail,
            school || 'CME',
            filiere || 'Général',
            country || "Côte d'Ivoire",
            avatarVal
          ).run();
        }

        // Initialiser les préférences utilisateur si inexistantes
        await env.DB.prepare(`
          INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)
        `).bind(existing ? existing.id : id).run();

        return jsonResponse({ success: true, message: 'Utilisateur synchronisé' }, 200, origin);
      }

      if (path.startsWith('/api/users/') && !path.includes('/preferences') && method === 'GET') {
        const userId = path.split('/')[3];
        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        if (!user) return errorResponse('Utilisateur introuvable', 404, origin);
        return jsonResponse({ success: true, data: user }, 200, origin);
      }

      if (path.startsWith('/api/users/') && path.endsWith('/preferences')) {
        const userId = path.split('/')[3];
        if (method === 'GET') {
          const prefs = await env.DB.prepare('SELECT * FROM user_preferences WHERE user_id = ?').bind(userId).first();
          return jsonResponse({ success: true, data: prefs || { view_mode: 'grid', is_dark_mode: 0, current_tab: 'folders' } }, 200, origin);
        }
        if (method === 'PUT') {
          const body: any = await request.json();
          await env.DB.prepare(`
            INSERT INTO user_preferences (user_id, view_mode, is_dark_mode, current_tab, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              view_mode = COALESCE(excluded.view_mode, user_preferences.view_mode),
              is_dark_mode = COALESCE(excluded.is_dark_mode, user_preferences.is_dark_mode),
              current_tab = COALESCE(excluded.current_tab, user_preferences.current_tab),
              updated_at = CURRENT_TIMESTAMP
          `).bind(userId, body.view_mode || 'grid', body.is_dark_mode ?? 0, body.current_tab || 'folders').run();
          return jsonResponse({ success: true, message: 'Préférences enregistrées' }, 200, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 2. MATIÈRES & DOSSIERS
      // ----------------------------------------------------------------------
      if (path === '/api/matieres') {
        if (!isSchemaInitialized && env.DB) await ensureDatabaseSchema(env.DB);
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare(`
            SELECT m.*, 
              (SELECT COUNT(*) FROM files f WHERE f.matiere_id = m.id OR f.matiere_id = m.name) AS files_count,
              (SELECT COALESCE(SUM(f.size), 0) FROM files f WHERE f.matiere_id = m.id OR f.matiere_id = m.name) AS total_size
            FROM matieres m
            WHERE m.user_id = ?
            ORDER BY m.display_order ASC, m.name ASC
          `).bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }

        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, name, coefficient, color, category, displayOrder } = body;
          if (!id || !userId || !name) return errorResponse('id, userId et name requis', 400, origin);

          await env.DB.prepare(`
            INSERT INTO matieres (id, user_id, name, coefficient, color, category, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              coefficient = excluded.coefficient,
              color = excluded.color,
              category = excluded.category,
              display_order = excluded.display_order
          `).bind(id, userId, name, coefficient ?? 1.0, color || '#EA580C', category || 'Général', displayOrder ?? 0).run();

          return jsonResponse({ success: true, data: { id, name } }, 201, origin);
        }
      }

      if (path.startsWith('/api/matieres/') && method === 'DELETE') {
        if (!isSchemaInitialized && env.DB) await ensureDatabaseSchema(env.DB);
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM matieres WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Matière supprimée' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 3. FICHIERS (Métadonnées & Fichiers de cours)
      // ----------------------------------------------------------------------
      if (path === '/api/files') {
        if (!isSchemaInitialized && env.DB) await ensureDatabaseSchema(env.DB);
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          const matiereId = url.searchParams.get('matiereId');
          const isStudySession = url.searchParams.get('isStudySession');
          const isFavorite = url.searchParams.get('isFavorite');
          if (!userId) return errorResponse('userId requis', 400, origin);

          let query = 'SELECT * FROM files WHERE user_id = ?';
          const params: any[] = [userId];

          if (matiereId === 'root' || matiereId === 'none') {
            query += ' AND (matiere_id IS NULL OR matiere_id = "" OR matiere_id = "Mes fichiers")';
          } else if (matiereId && matiereId !== 'all') {
            query += ' AND (matiere_id = ? OR matiere_id IN (SELECT id FROM matieres WHERE name = ? AND user_id = ?))';
            params.push(matiereId, matiereId, userId);
          }

          if (isFavorite === 'true' || isFavorite === '1') {
            query += ' AND is_favorite = 1';
          }

          if (isStudySession === 'true' || isStudySession === '1') {
            query += ' AND is_study_session = 1';
          } else if (isStudySession === 'false' || isStudySession === '0') {
            query += ' AND (is_study_session IS NULL OR is_study_session = 0)';
          }

          query += ' ORDER BY last_imported DESC, updated_at DESC, created_at DESC';

          const { results } = await env.DB.prepare(query).bind(...params).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }

        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, matiereId, name, size, type, extension, r2Key, fileUrl, isFavorite, isImported, isStudySession, lastImported } = body;
          if (!id || !userId || !name) return errorResponse('id, userId et name requis', 400, origin);

          await env.DB.prepare(`
            INSERT INTO files (id, user_id, matiere_id, name, size, type, extension, r2_key, file_url, is_favorite, is_imported, is_study_session, last_imported, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              matiere_id = excluded.matiere_id,
              size = excluded.size,
              type = excluded.type,
              r2_key = COALESCE(excluded.r2_key, files.r2_key),
              file_url = COALESCE(excluded.file_url, files.file_url),
              is_favorite = excluded.is_favorite,
              is_imported = excluded.is_imported,
              is_study_session = excluded.is_study_session,
              last_imported = excluded.last_imported,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            id,
            userId,
            matiereId || null,
            name,
            size || 0,
            type || 'application/octet-stream',
            extension || '',
            r2Key || null,
            fileUrl || '',
            isFavorite ? 1 : 0,
            isImported ? 1 : 0,
            isStudySession ? 1 : 0,
            lastImported || Date.now()
          ).run();

          return jsonResponse({ success: true, data: { id, name } }, 201, origin);
        }
      }

      if (path.startsWith('/api/files/') && path.endsWith('/favorite') && (method === 'PATCH' || method === 'PUT')) {
        if (!isSchemaInitialized && env.DB) await ensureDatabaseSchema(env.DB);
        const id = path.split('/')[3];
        const body: any = await request.json().catch(() => ({}));
        const isFavoriteVal = body.isFavorite === true || body.isFavorite === 1 ? 1 : 0;
        await env.DB.prepare('UPDATE files SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(isFavoriteVal, id).run();
        return jsonResponse({ success: true, message: 'Favori mis à jour', isFavorite: isFavoriteVal }, 200, origin);
      }

      if (path.startsWith('/api/files/') && method === 'DELETE') {
        if (!isSchemaInitialized && env.DB) await ensureDatabaseSchema(env.DB);
        const id = path.split('/')[3];
        const file = await env.DB.prepare('SELECT r2_key FROM files WHERE id = ?').bind(id).first<any>();
        if (file && file.r2_key && env.BUCKET) {
          try { await env.BUCKET.delete(file.r2_key); } catch (e) {}
        }
        await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Fichier supprimé' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 4. STOCKAGE CLOUDFLARE R2 (Upload & Téléchargement direct)
      // ----------------------------------------------------------------------
      if (path === '/api/storage/upload' && method === 'PUT') {
        const key = url.searchParams.get('key');
        if (!key) return errorResponse('Clé de stockage manquante', 400, origin);
        const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

        const fileData = request.body || (await request.arrayBuffer());
        await env.BUCKET.put(key, fileData as any, {
          httpMetadata: { contentType },
        });

        const fileUrl = `${url.origin}/api/storage/file/${encodeURIComponent(key)}`;
        return jsonResponse({ success: true, key, url: fileUrl }, 200, origin);
      }

      if (path.startsWith('/api/storage/file/') && method === 'GET') {
        const key = decodeURIComponent(path.replace('/api/storage/file/', ''));
        const object = await env.BUCKET.get(key);
        if (!object) return errorResponse('Fichier introuvable dans R2', 404, origin);

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Access-Control-Allow-Origin', origin);

        return new Response(object.body, { headers });
      }

      // ----------------------------------------------------------------------
      // 5. PARTAGES & LIENS PUBLICS (Stock de liens & Code QR)
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/shares') && env.DB && !isSchemaInitialized) {
        await ensureDatabaseSchema(env.DB);
      }

      if (path === '/api/shares') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          const isPublicOnly = url.searchParams.get('publicOnly') === 'true' || url.searchParams.get('isPublic') === '1';

          let query = 'SELECT * FROM shared_folders WHERE 1=1';
          const params: any[] = [];

          if (userId) {
            query += ' AND user_id = ?';
            params.push(userId);
          }
          if (isPublicOnly) {
            query += ' AND is_public = 1';
          }

          query += ' ORDER BY created_at DESC';
          const { results } = await env.DB.prepare(query).bind(...params).all<any>();
          const foldersWithFiles = await Promise.all(
            (results || []).map(async (folder: any) => {
              const { results: files } = await env.DB.prepare(
                'SELECT * FROM shared_folder_files WHERE shared_folder_id = ?'
              ).bind(folder.id).all();
              return { ...folder, files: files || [] };
            })
          );
          return jsonResponse({ success: true, data: foldersWithFiles }, 200, origin);
        }

        if (method === 'POST') {
          const body: any = await request.json();
          const {
            id,
            userId,
            title,
            description,
            category,
            authorName,
            school,
            country,
            isPublic,
            isPasswordProtected,
            passwordHash,
            allowDownload,
            shareCode,
            shareUrl,
            qrCodeData,
            totalSize,
            files
          } = body;
          if (!id || !userId || !title) return errorResponse('id, userId et title requis', 400, origin);

          const finalShareCode = shareCode || generateCleanShareCode();
          const finalShareUrl = shareUrl || `${url.origin}/s/${finalShareCode}`;
          const finalQrCodeData = qrCodeData || finalShareUrl;
          const finalCountry = country || "Côte d'Ivoire";
          const finalIsPublic = isPublic ? 1 : 0;
          const finalAllowDownload = allowDownload !== undefined ? (allowDownload ? 1 : 0) : 1;

          await env.DB.prepare(`
            INSERT INTO shared_folders (
              id, user_id, share_code, share_url, qr_code_data, title, description, category,
              author_name, school, country, is_public, is_password_protected, password_hash,
              allow_download, total_size, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              share_code = COALESCE(excluded.share_code, shared_folders.share_code),
              share_url = COALESCE(excluded.share_url, shared_folders.share_url),
              qr_code_data = COALESCE(excluded.qr_code_data, shared_folders.qr_code_data),
              title = excluded.title,
              description = excluded.description,
              category = excluded.category,
              author_name = excluded.author_name,
              school = excluded.school,
              country = excluded.country,
              is_public = excluded.is_public,
              is_password_protected = excluded.is_password_protected,
              password_hash = excluded.password_hash,
              allow_download = excluded.allow_download,
              total_size = excluded.total_size,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            id,
            userId,
            finalShareCode,
            finalShareUrl,
            finalQrCodeData,
            title,
            description || '',
            category || 'Cours',
            authorName || 'Étudiant',
            school || '',
            finalCountry,
            finalIsPublic,
            isPasswordProtected ? 1 : 0,
            passwordHash || null,
            finalAllowDownload,
            totalSize || 0
          ).run();

          if (Array.isArray(files)) {
            await env.DB.prepare('DELETE FROM shared_folder_files WHERE shared_folder_id = ?').bind(id).run();
            for (const f of files) {
              await env.DB.prepare(`
                INSERT INTO shared_folder_files (id, shared_folder_id, file_id, name, size, type, r2_key, file_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(f.id || crypto.randomUUID(), id, f.fileId || null, f.name, f.size || 0, f.type || 'file', f.r2Key || null, f.url || '').run();
            }
          }

          return jsonResponse({
            success: true,
            id,
            shareCode: finalShareCode,
            shareUrl: finalShareUrl,
            qrCodeData: finalQrCodeData,
            country: finalCountry,
            isPublic: finalIsPublic === 1,
            allowDownload: finalAllowDownload === 1
          }, 201, origin);
        }
      }

      // Recherche de partage par Code Unique (pour scan QR code ou lien direct)
      if (path.startsWith('/api/shares/code/') && method === 'GET') {
        const code = decodeURIComponent(path.split('/')[4]);
        const folder = await env.DB.prepare('SELECT * FROM shared_folders WHERE share_code = ?').bind(code).first<any>();
        if (!folder) return errorResponse('Code de partage introuvable', 404, origin);

        await env.DB.prepare('UPDATE shared_folders SET views_count = views_count + 1 WHERE id = ?').bind(folder.id).run();
        const { results: files } = await env.DB.prepare('SELECT * FROM shared_folder_files WHERE shared_folder_id = ?').bind(folder.id).all();

        return jsonResponse({
          success: true,
          data: {
            ...folder,
            files: folder.is_password_protected ? [] : files,
            requiresPassword: !!folder.is_password_protected,
          },
        }, 200, origin);
      }

      // Basculer la visibilité publique d'un partage
      if (path.startsWith('/api/shares/') && path.endsWith('/public') && method === 'PUT') {
        const shareId = path.split('/')[3];
        const body: any = await request.json();
        const isPublic = body.isPublic ? 1 : 0;
        const allowDownload = body.allowDownload !== undefined ? (body.allowDownload ? 1 : 0) : 1;
        const description = body.description !== undefined ? body.description : null;

        if (description !== null) {
          await env.DB.prepare(`
            UPDATE shared_folders 
            SET is_public = ?, allow_download = ?, description = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).bind(isPublic, allowDownload, description, shareId).run();
        } else {
          await env.DB.prepare(`
            UPDATE shared_folders 
            SET is_public = ?, allow_download = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).bind(isPublic, allowDownload, shareId).run();
        }

        return jsonResponse({
          success: true,
          message: 'Visibilité mise à jour',
          isPublic: isPublic === 1,
          allowDownload: allowDownload === 1
        }, 200, origin);
      }

      if (path.startsWith('/api/shares/') && method === 'DELETE') {
        const shareId = path.split('/')[3];
        try {
          const { results: filesToDelete } = await env.DB.prepare('SELECT r2_key FROM shared_folder_files WHERE shared_folder_id = ?').bind(shareId).all<any>();
          if (env.BUCKET && filesToDelete && filesToDelete.length > 0) {
            for (const f of filesToDelete) {
              if (f.r2_key) {
                await env.BUCKET.delete(f.r2_key).catch(() => {});
              }
            }
          }
        } catch (e) {}

        await env.DB.prepare('DELETE FROM shared_folder_files WHERE shared_folder_id = ?').bind(shareId).run();
        await env.DB.prepare('DELETE FROM shared_folders WHERE id = ?').bind(shareId).run();
        try {
          await env.DB.prepare('DELETE FROM shared_folder_downloads WHERE shared_folder_id = ?').bind(shareId).run();
        } catch (e) {}
        return jsonResponse({ success: true, message: 'Dossier partagé et fichiers supprimés' }, 200, origin);
      }

      if (path.startsWith('/api/shares/') && method === 'GET') {
        const shareId = path.split('/')[3];
        const folder = await env.DB.prepare('SELECT * FROM shared_folders WHERE id = ?').bind(shareId).first<any>();
        if (!folder) return errorResponse('Partage introuvable', 404, origin);

        // Incrémenter le compteur de vues
        await env.DB.prepare('UPDATE shared_folders SET views_count = views_count + 1 WHERE id = ?').bind(shareId).run();

        // Récupérer les fichiers liés
        const { results: files } = await env.DB.prepare('SELECT * FROM shared_folder_files WHERE shared_folder_id = ?').bind(shareId).all();

        return jsonResponse({
          success: true,
          data: {
            ...folder,
            files: folder.is_password_protected ? [] : files, // Masquer les fichiers si mot de passe requis
            requiresPassword: !!folder.is_password_protected,
          },
        }, 200, origin);
      }

      if (path.includes('/verify-pin') && method === 'POST') {
        const shareId = path.split('/')[3];
        const { pin } = (await request.json()) as any;
        const folder = await env.DB.prepare('SELECT * FROM shared_folders WHERE id = ?').bind(shareId).first<any>();
        if (!folder) return errorResponse('Dossier partagé introuvable', 404, origin);

        if (folder.password_hash !== pin) {
          return errorResponse('Code PIN incorrect', 401, origin);
        }

        const { results: files } = await env.DB.prepare('SELECT * FROM shared_folder_files WHERE shared_folder_id = ?').bind(shareId).all();
        return jsonResponse({ success: true, data: { ...folder, files } }, 200, origin);
      }

      // Vérifier si un utilisateur a déjà un compte pour le téléchargement / enregistrement
      if (path === '/api/shares/check-user' && method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const { userId } = body;
        if (!userId || !env.DB) return jsonResponse({ success: true, exists: false }, 200, origin);
        const user: any = await env.DB.prepare('SELECT id, name, email FROM users WHERE id = ?').bind(userId).first();
        return jsonResponse({
          success: true,
          exists: !!user,
          user: user ? { id: user.id, name: user.name, email: user.email } : null
        }, 200, origin);
      }

      // Connexion / Inscription rapide depuis la page autonome de partage
      if (path === '/api/shares/quick-auth' && method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const { mode, email, password, name, school, country } = body;
        if (!email || !password) return errorResponse('Email et mot de passe requis', 400, origin);

        const cleanEmail = email.toLowerCase().trim();

        if (mode === 'login') {
          const user: any = await env.DB.prepare('SELECT * FROM users WHERE LOWER(TRIM(email)) = ?').bind(cleanEmail).first();
          if (!user) return errorResponse('Aucun compte associé à cet email', 404, origin);
          const valid = user.password_hash ? await verifyPassword(password, user.password_hash) : false;
          if (!valid) return errorResponse('Mot de passe incorrect', 401, origin);
          return jsonResponse({
            success: true,
            message: 'Connexion réussie',
            userId: user.id,
            name: user.name,
            email: user.email
          }, 200, origin);
        } else {
          const existing: any = await env.DB.prepare('SELECT id FROM users WHERE LOWER(TRIM(email)) = ?').bind(cleanEmail).first();
          if (existing) return errorResponse('Un compte existe déjà avec cet email. Veuillez vous connecter.', 409, origin);

          const newUserId = generateId();
          const pwdHash = await hashPassword(password);
          const cleanName = (name || cleanEmail.split('@')[0] || 'Étudiant').trim();
          const cleanCountry = country || "Côte d'Ivoire";
          const cleanSchool = school || 'CME';

          await env.DB.prepare(`
            INSERT INTO users (id, name, email, password_hash, school, country, email_verified, is_onboarded, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
          `).bind(newUserId, cleanName, cleanEmail, pwdHash, cleanSchool, cleanCountry).run();

          await env.DB.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').bind(newUserId).run();

          return jsonResponse({
            success: true,
            message: 'Compte créé avec succès',
            userId: newUserId,
            name: cleanName,
            email: cleanEmail
          }, 201, origin);
        }
      }

      // Enregistrer directement les fichiers d'un partage dans l'espace StudyCloud de l'utilisateur
      if (path.startsWith('/api/shares/') && path.endsWith('/save-to-cloud') && method === 'POST') {
        const shareId = path.split('/')[3];
        const body: any = await request.json().catch(() => ({}));
        const { userId } = body;
        if (!userId) return errorResponse('userId requis', 400, origin);

        const folder: any = await env.DB.prepare('SELECT * FROM shared_folders WHERE id = ?').bind(shareId).first();
        if (!folder) return errorResponse('Dossier partagé introuvable', 404, origin);

        const { results: sharedFiles } = await env.DB.prepare('SELECT * FROM shared_folder_files WHERE shared_folder_id = ?').bind(shareId).all<any>();
        if (!sharedFiles || sharedFiles.length === 0) {
          return errorResponse('Aucun fichier associé à ce partage', 400, origin);
        }

        const folderTitle = folder.title || 'Partages reçus';
        let matiere: any = await env.DB.prepare('SELECT id FROM matieres WHERE user_id = ? AND name = ?').bind(userId, folderTitle).first();
        if (!matiere) {
          const matiereId = 'mat-' + generateId().substring(0, 8);
          await env.DB.prepare(`
            INSERT INTO matieres (id, user_id, name, color, icon, updated_at)
            VALUES (?, ?, ?, '#2563eb', 'Folder', CURRENT_TIMESTAMP)
          `).bind(matiereId, userId, folderTitle).run();
          matiere = { id: matiereId };
        }

        let copiedCount = 0;
        for (const sf of sharedFiles) {
          const newFileId = 'file-' + generateId();
          const ext = sf.name && sf.name.includes('.') ? sf.name.split('.').pop() || '' : '';
          await env.DB.prepare(`
            INSERT INTO files (id, user_id, matiere_id, name, size, type, extension, r2_key, file_url, is_favorite, is_imported, is_study_session, last_imported, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 0, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
          `).bind(
            newFileId,
            userId,
            matiere.id,
            sf.name,
            sf.size || 0,
            sf.type || 'application/octet-stream',
            ext,
            sf.r2_key || null,
            sf.file_url || '',
            Date.now()
          ).run();
          copiedCount++;
        }

        await env.DB.prepare('UPDATE shared_folders SET downloads_count = downloads_count + 1 WHERE id = ?').bind(shareId).run();

        return jsonResponse({
          success: true,
          message: `${copiedCount} fichier(s) enregistrés dans votre StudyCloud sous "${folderTitle}"`,
          copiedCount,
          matiereName: folderTitle,
          matiereId: matiere.id
        }, 200, origin);
      }

      // Comptabiliser un téléchargement d'appareil
      if (path.startsWith('/api/shares/') && path.endsWith('/track-download') && method === 'POST') {
        const shareId = path.split('/')[3];
        await env.DB.prepare('UPDATE shared_folders SET downloads_count = downloads_count + 1 WHERE id = ? OR share_code = ?').bind(shareId, shareId).run();

        try {
          const dlId = 'dl-' + generateId();
          const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
          await env.DB.prepare(`
            INSERT INTO shared_folder_downloads (id, shared_folder_id, ip_address, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(dlId, shareId, clientIp).run();
        } catch (e) {}

        const updatedFolder: any = await env.DB.prepare('SELECT downloads_count FROM shared_folders WHERE id = ? OR share_code = ?').bind(shareId, shareId).first();

        return jsonResponse({
          success: true,
          message: 'Téléchargement comptabilisé',
          downloadsCount: updatedFolder?.downloads_count || 1
        }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 6. EMPLOI DU TEMPS
      // ----------------------------------------------------------------------
      if (path === '/api/schedule/config') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const config = await env.DB.prepare('SELECT * FROM schedule_config WHERE user_id = ?').bind(userId).first();
          return jsonResponse({ success: true, data: config }, 200, origin);
        }
        if (method === 'PUT') {
          const body: any = await request.json();
          await env.DB.prepare(`
            INSERT INTO schedule_config (user_id, days_json, hours_json, zoom_level, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              days_json = COALESCE(excluded.days_json, schedule_config.days_json),
              hours_json = COALESCE(excluded.hours_json, schedule_config.hours_json),
              zoom_level = COALESCE(excluded.zoom_level, schedule_config.zoom_level),
              updated_at = CURRENT_TIMESTAMP
          `).bind(body.userId, body.daysJson, body.hoursJson, body.zoomLevel ?? 100).run();
          return jsonResponse({ success: true, message: 'Configuration mise à jour' }, 200, origin);
        }
      }

      if (path === '/api/schedule/slots') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM schedule_slots WHERE user_id = ?').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, day, hourSlot, subject, room, noteOrTeacher, color } = body;
          const slotId = id || `${userId}-${day}-${hourSlot}`;
          await env.DB.prepare(`
            INSERT INTO schedule_slots (id, user_id, day, hour_slot, subject, room, note_or_teacher, color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              subject = excluded.subject,
              room = excluded.room,
              note_or_teacher = excluded.note_or_teacher,
              color = excluded.color
          `).bind(slotId, userId, day, hourSlot, subject, room || '', noteOrTeacher || '', color || '#EA580C').run();
          return jsonResponse({ success: true, id: slotId }, 201, origin);
        }
        if (method === 'DELETE') {
          const id = url.searchParams.get('id');
          const userId = url.searchParams.get('userId');
          const day = url.searchParams.get('day');
          const hourSlot = url.searchParams.get('hourSlot');
          if (id) {
            await env.DB.prepare('DELETE FROM schedule_slots WHERE id = ?').bind(id).run();
          } else if (userId && day && hourSlot) {
            await env.DB.prepare('DELETE FROM schedule_slots WHERE user_id = ? AND day = ? AND hour_slot = ?').bind(userId, day, hourSlot).run();
          }
          return jsonResponse({ success: true, message: 'Créneau supprimé' }, 200, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 7. CARNET DE NOTES & BULLETINS
      // ----------------------------------------------------------------------
      if (path === '/api/grades') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM grades WHERE user_id = ?').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, trimester, subjectName, coefficient, subGradesJson, average } = body;
          await env.DB.prepare(`
            INSERT INTO grades (id, user_id, trimester, subject_name, coefficient, sub_grades_json, average, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              subject_name = excluded.subject_name,
              coefficient = excluded.coefficient,
              sub_grades_json = excluded.sub_grades_json,
              average = excluded.average,
              updated_at = CURRENT_TIMESTAMP
          `).bind(id || crypto.randomUUID(), userId, trimester || 1, subjectName, coefficient || 1.0, subGradesJson || '[]', average || 0.0).run();
          return jsonResponse({ success: true }, 200, origin);
        }
        if (method === 'DELETE') {
          const id = url.searchParams.get('id');
          if (id) await env.DB.prepare('DELETE FROM grades WHERE id = ?').bind(id).run();
          return jsonResponse({ success: true, message: 'Note supprimée' }, 200, origin);
        }
      }

      if (path.startsWith('/api/grades/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM grades WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Note supprimée' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 8. BLOC-NOTES (Keep Notes)
      // ----------------------------------------------------------------------
      if (path === '/api/notes') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, title, content, color, isPinned, imageUrl } = body;
          await env.DB.prepare(`
            INSERT INTO notes (id, user_id, title, content, color, is_pinned, image_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              content = excluded.content,
              color = excluded.color,
              is_pinned = excluded.is_pinned,
              image_url = excluded.image_url,
              updated_at = CURRENT_TIMESTAMP
          `).bind(id || crypto.randomUUID(), userId, title, content || '', color || '#FFFFFF', isPinned ? 1 : 0, imageUrl || null).run();
          return jsonResponse({ success: true }, 200, origin);
        }
      }

      if (path.startsWith('/api/notes/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Note supprimée' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 9. CALENDRIER DES ÉVÉNEMENTS
      // ----------------------------------------------------------------------
      if (path === '/api/calendar') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM calendar_events WHERE user_id = ? ORDER BY start_date ASC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, title, startDate, endDate, allDay, color, description, location } = body;
          const eventId = id || crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO calendar_events (id, user_id, title, start_date, end_date, all_day, color, description, location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              start_date = excluded.start_date,
              end_date = excluded.end_date,
              all_day = excluded.all_day,
              color = excluded.color,
              description = excluded.description,
              location = excluded.location
          `).bind(eventId, userId, title, startDate, endDate || null, allDay ? 1 : 0, color || '#EA580C', description || '', location || '').run();
          return jsonResponse({ success: true, id: eventId }, 201, origin);
        }
        if (method === 'DELETE') {
          const id = url.searchParams.get('id');
          if (id) await env.DB.prepare('DELETE FROM calendar_events WHERE id = ?').bind(id).run();
          return jsonResponse({ success: true, message: 'Événement supprimé' }, 200, origin);
        }
      }

      if (path.startsWith('/api/calendar/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM calendar_events WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Événement supprimé' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 10. ALARMES & SESSIONS D'ÉTUDE
      // ----------------------------------------------------------------------
      if (path === '/api/alarms') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM alarms WHERE user_id = ? ORDER BY time ASC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, time, label, isActive, daysJson } = body;
          await env.DB.prepare(`
            INSERT INTO alarms (id, user_id, time, label, is_active, days_json)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              time = excluded.time,
              label = excluded.label,
              is_active = excluded.is_active,
              days_json = excluded.days_json
          `).bind(id || crypto.randomUUID(), userId, time, label || 'Réveil étude', isActive ? 1 : 0, daysJson || '["Tous les jours"]').run();
          return jsonResponse({ success: true }, 201, origin);
        }
        if (method === 'DELETE') {
          const id = url.searchParams.get('id');
          if (id) await env.DB.prepare('DELETE FROM alarms WHERE id = ?').bind(id).run();
          return jsonResponse({ success: true, message: 'Alarme supprimée' }, 200, origin);
        }
      }

      if (path.startsWith('/api/alarms/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM alarms WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Alarme supprimée' }, 200, origin);
      }

      if (path === '/api/study-sessions') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM study_sessions WHERE user_id = ? ORDER BY completed_at DESC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, durationSeconds, matiereName } = body;
          await env.DB.prepare(`
            INSERT INTO study_sessions (id, user_id, duration_seconds, matiere_name)
            VALUES (?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, durationSeconds, matiereName || '').run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 11. BOUTIQUE ÉTUDIANTE, PRODUITS & PANIER
      // ----------------------------------------------------------------------
      if (path === '/api/shop/profile') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const profile = await env.DB.prepare('SELECT * FROM shop_profiles WHERE user_id = ?').bind(userId).first();
          return jsonResponse({ success: true, data: profile || { shop_name: 'DKD Technologies', shop_phone: '+225 07 00 00 00 00', shop_whatsapp: '+225 07 00 00 00 00' } }, 200, origin);
        }
        if (method === 'PUT') {
          const body: any = await request.json();
          await env.DB.prepare(`
            INSERT INTO shop_profiles (user_id, shop_name, shop_phone, shop_whatsapp, shop_avatar_url, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              shop_name = excluded.shop_name,
              shop_phone = excluded.shop_phone,
              shop_whatsapp = excluded.shop_whatsapp,
              shop_avatar_url = excluded.shop_avatar_url,
              updated_at = CURRENT_TIMESTAMP
          `).bind(body.userId, body.shopName, body.shopPhone, body.shopWhatsapp, body.shopAvatarUrl || null).run();
          return jsonResponse({ success: true, message: 'Profil boutique mis à jour' }, 200, origin);
        }
      }

      if (path === '/api/products') {
        if (method === 'GET') {
          const category = url.searchParams.get('category');
          let query = 'SELECT * FROM products';
          const params: any[] = [];
          if (category && category !== 'Tous') {
            query += ' WHERE category = ?';
            params.push(category);
          }
          query += ' ORDER BY is_boosted DESC, created_at DESC';
          const { results } = await env.DB.prepare(query).bind(...params).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, sellerId, title, description, price, category, imageUrlsJson, isBoosted, boostFormula, boostViewsTarget, boostEndDate } = body;
          await env.DB.prepare(`
            INSERT INTO products (id, seller_id, title, description, price, category, image_urls_json, is_boosted, boost_formula, boost_views_target, boost_end_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              description = excluded.description,
              price = excluded.price,
              category = excluded.category,
              image_urls_json = excluded.image_urls_json,
              is_boosted = excluded.is_boosted,
              boost_formula = excluded.boost_formula,
              boost_views_target = excluded.boost_views_target,
              boost_end_date = excluded.boost_end_date
          `).bind(id || crypto.randomUUID(), sellerId, title, description || '', price, category || 'Électronique', imageUrlsJson || '[]', isBoosted ? 1 : 0, boostFormula || null, boostViewsTarget || 0, boostEndDate || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      if (path.startsWith('/api/products/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Produit supprimé' }, 200, origin);
      }

      if (path === '/api/cart') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare(`
            SELECT c.id as cart_item_id, c.quantity, p.*
            FROM cart_items c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ?
            ORDER BY c.added_at DESC
          `).bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { userId, productId, quantity } = body;
          await env.DB.prepare(`
            INSERT INTO cart_items (id, user_id, product_id, quantity)
            VALUES (?, ?, ?, ?)
          `).bind(crypto.randomUUID(), userId, productId, quantity || 1).run();
          return jsonResponse({ success: true }, 201, origin);
        }
        if (method === 'DELETE') {
          const productId = url.searchParams.get('productId');
          const cartItemId = url.searchParams.get('id');
          if (userId && productId) {
            await env.DB.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').bind(userId, productId).run();
          } else if (cartItemId) {
            await env.DB.prepare('DELETE FROM cart_items WHERE id = ?').bind(cartItemId).run();
          }
          return jsonResponse({ success: true, message: 'Article retiré du panier' }, 200, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 12. PUBLICATION UNIVERSITAIRE (Bibliothèque Publique & Ressources)
      // ----------------------------------------------------------------------
      if (path === '/api/published-documents') {
        if (method === 'GET') {
          const school = url.searchParams.get('school');
          const filiere = url.searchParams.get('filiere');
          const country = url.searchParams.get('country');
          const category = url.searchParams.get('category');
          const matiereName = url.searchParams.get('matiereName') || url.searchParams.get('matiere_name');
          const level = url.searchParams.get('level');
          const search = url.searchParams.get('search');
          const isPublicParam = url.searchParams.get('isPublic');
          const userId = url.searchParams.get('userId');
          const pageParam = url.searchParams.get('page');
          const limitParam = url.searchParams.get('limit');
          const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : null;
          const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 30;

          // Assurer l'existence de la table d'interactions
          try {
            await env.DB.prepare(`
              CREATE TABLE IF NOT EXISTS user_document_interactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                interaction_type TEXT DEFAULT 'view',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `).run();
          } catch (e) {}

          let query = 'SELECT * FROM published_documents WHERE 1=1';
          const params: any[] = [];

          if (school) { query += ' AND school = ?'; params.push(school); }
          if (filiere) { query += ' AND filiere = ?'; params.push(filiere); }
          if (country) { query += ' AND country = ?'; params.push(country); }
          if (category && category !== 'Tous') { query += ' AND category = ?'; params.push(category); }
          if (matiereName) { query += ' AND matiere_name = ?'; params.push(matiereName); }
          if (level) { query += ' AND level = ?'; params.push(level); }

          if (isPublicParam !== null && isPublicParam !== undefined) {
            query += ' AND is_public = ?';
            params.push(isPublicParam === 'true' || isPublicParam === '1' ? 1 : 0);
          } else {
            query += ' AND is_public = 1';
          }

          if (search) {
            query += ' AND (title LIKE ? OR description LIKE ? OR matiere_name LIKE ? OR author_name LIKE ? OR tags_json LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s, s, s);
          }

          query += ' ORDER BY created_at DESC';
          const { results } = await env.DB.prepare(query).bind(...params).all();
          let docsList: any[] = results || [];

          // ALGORITHME DE RECOMMANDATION INTELLIGENT PERSONNALISÉ
          if (userId && docsList.length > 0) {
            try {
              // Récupérer le profil étudiant, ses matières créées, ses fichiers et son historique de clics
              const [userRes, matieresRes, filesRes, interactionsRes] = await Promise.all([
                env.DB.prepare('SELECT school, filiere, country FROM users WHERE id = ?').bind(userId).first<any>(),
                env.DB.prepare('SELECT name FROM matieres WHERE user_id = ?').bind(userId).all(),
                env.DB.prepare('SELECT name, matiere_id FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT 60').bind(userId).all(),
                env.DB.prepare('SELECT document_id, interaction_type FROM user_document_interactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(userId).all()
              ]);

              const userSchool = (userRes?.school || '').toLowerCase().trim();
              const userFiliere = (userRes?.filiere || '').toLowerCase().trim();
              const userCountry = (userRes?.country || '').toLowerCase().trim();

              const userMatiereNames: string[] = (matieresRes?.results || [])
                .map((m: any) => (m.name || '').toLowerCase().trim())
                .filter(Boolean);

              const userKeywords: string[] = [];
              (filesRes?.results || []).forEach((f: any) => {
                const combined = `${f.name || ''} ${f.matiere_id || ''}`.toLowerCase();
                const words = combined.replace(/[^a-z0-9à-ÿ]/gi, ' ').split(/\s+/).filter((w: string) => w.length >= 3);
                userKeywords.push(...words);
              });
              const uniqueUserKeywords = Array.from(new Set(userKeywords)).slice(0, 40);

              const interactedDocIds = new Set((interactionsRes?.results || []).map((i: any) => i.document_id));

              // Calcul du score de pertinence décroissant pour chaque document
              const scoredDocs = docsList.map((doc: any) => {
                let score = 0;
                const dSchool = (doc.school || '').toLowerCase().trim();
                const dFiliere = (doc.filiere || '').toLowerCase().trim();
                const dCountry = (doc.country || '').toLowerCase().trim();
                const dMatiere = (doc.matiere_name || '').toLowerCase().trim();
                const dTitle = (doc.title || '').toLowerCase().trim();
                const dDesc = (doc.description || '').toLowerCase().trim();
                const dTags = (doc.tags_json || '').toLowerCase().trim();

                // 1. Même filière (+50)
                if (userFiliere && dFiliere && (dFiliere.includes(userFiliere) || userFiliere.includes(dFiliere))) {
                  score += 50;
                }

                // 2. Même école (+40)
                if (userSchool && dSchool && (dSchool.includes(userSchool) || userSchool.includes(dSchool))) {
                  score += 40;
                }

                // 3. Correspondance avec les matières créées par l'étudiant (+35)
                if (userMatiereNames.some(m => m && (dMatiere.includes(m) || dTitle.includes(m) || m.includes(dMatiere)))) {
                  score += 35;
                }

                // 4. Documents déjà consultés ou cliqués par l'étudiant (+20)
                if (interactedDocIds.has(doc.id)) {
                  score += 20;
                }

                // 5. Mots-clés en commun avec les fichiers présents dans ses dossiers (+10 par mot-clé, max +30)
                let matchedKws = 0;
                for (const kw of uniqueUserKeywords) {
                  if (dTitle.includes(kw) || dDesc.includes(kw) || dTags.includes(kw) || dMatiere.includes(kw)) {
                    matchedKws++;
                    if (matchedKws >= 3) break;
                  }
                }
                score += matchedKws * 10;

                // 6. Même pays (+15)
                if (userCountry && dCountry && (dCountry.includes(userCountry) || userCountry.includes(dCountry))) {
                  score += 15;
                }

                // 7. Popularité et récence (bonus jusqu'à +15)
                const popBonus = Math.min(10, (doc.downloads_count || 0) * 1.5 + (doc.views_count || 0) * 0.3);
                const ageDays = (Date.now() - new Date(doc.created_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24);
                const recencyBonus = ageDays < 7 ? 5 : (ageDays < 30 ? 2 : 0);
                score += popBonus + recencyBonus;

                return { ...doc, _relevance_score: Math.round(score) };
              });

              // Tri décroissant : les ressources les plus pertinentes en premier,
              // puis au fur et à mesure celles qui n'ont rien à voir
              scoredDocs.sort((a, b) => {
                if (b._relevance_score !== a._relevance_score) {
                  return b._relevance_score - a._relevance_score;
                }
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });

              docsList = scoredDocs;
            } catch (algoErr) {
              console.warn('[Recommendation Algorithm Error]', algoErr);
            }
          }

          // Support de la pagination / défilement infini
          if (page !== null) {
            const startIndex = (page - 1) * limit;
            const paginatedData = docsList.slice(startIndex, startIndex + limit);
            return jsonResponse({
              success: true,
              data: paginatedData,
              pagination: {
                page,
                limit,
                total: docsList.length,
                hasMore: startIndex + limit < docsList.length
              }
            }, 200, origin);
          }

          return jsonResponse({ success: true, data: docsList }, 200, origin);
        }

        if (method === 'POST') {
          const body: any = await request.json();
          const {
            id,
            userId,
            title,
            description,
            school,
            filiere,
            matiereName,
            level,
            category,
            authorName,
            country,
            infoMode,
            fileName,
            fileSize,
            fileType,
            r2Key,
            fileUrl,
            isPublic,
            tagsJson
          } = body;

          if (!userId || !title || !fileName) {
            return errorResponse('userId, title et fileName sont obligatoires', 400, origin);
          }

          const docId = id || crypto.randomUUID();
          const finalCountry = country || "Côte d'Ivoire";
          const finalIsPublic = isPublic !== undefined ? (isPublic ? 1 : 0) : 1;

          await env.DB.prepare(`
            INSERT INTO published_documents (
              id, user_id, title, description, school, filiere, matiere_name, level, category,
              author_name, country, info_mode, file_name, file_size, file_type, r2_key, file_url,
              is_public, tags_json, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              description = excluded.description,
              school = excluded.school,
              filiere = excluded.filiere,
              matiere_name = excluded.matiere_name,
              level = excluded.level,
              category = excluded.category,
              author_name = excluded.author_name,
              country = excluded.country,
              info_mode = excluded.info_mode,
              file_name = excluded.file_name,
              file_size = excluded.file_size,
              file_type = excluded.file_type,
              r2_key = COALESCE(excluded.r2_key, published_documents.r2_key),
              file_url = COALESCE(excluded.file_url, published_documents.file_url),
              is_public = excluded.is_public,
              tags_json = excluded.tags_json,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            docId,
            userId,
            title,
            description || '',
            school || '',
            filiere || '',
            matiereName || '',
            level || '',
            category || 'Cours',
            authorName || 'Étudiant',
            finalCountry,
            infoMode || 'all',
            fileName,
            fileSize || 0,
            fileType || '',
            r2Key || null,
            fileUrl || '',
            finalIsPublic,
            tagsJson || '[]'
          ).run();

          return jsonResponse({
            success: true,
            id: docId,
            title,
            country: finalCountry,
            isPublic: finalIsPublic === 1
          }, 201, origin);
        }
      }

      if (path.startsWith('/api/published-documents/') && path.endsWith('/interact') && method === 'POST') {
        const id = path.split('/')[3];
        const body: any = await request.json().catch(() => ({}));
        const { userId, type } = body;
        const interactionType = type || 'view';

        if (userId && id) {
          try {
            await env.DB.prepare(`
              CREATE TABLE IF NOT EXISTS user_document_interactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                interaction_type TEXT DEFAULT 'view',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `).run();

            await env.DB.prepare(`
              INSERT INTO user_document_interactions (id, user_id, document_id, interaction_type, created_at)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).bind(crypto.randomUUID(), userId, id, interactionType).run();

            // PURGE AUTOMATIQUE : suppression de toutes les interactions de plus de 30 jours (1 mois)
            // Empêche l'accumulation infinie dans la base D1
            await env.DB.prepare(`
              DELETE FROM user_document_interactions 
              WHERE created_at < datetime('now', '-30 days')
            `).run();
          } catch (e) {}
        }

        if (interactionType === 'download') {
          await env.DB.prepare('UPDATE published_documents SET downloads_count = downloads_count + 1 WHERE id = ?').bind(id).run();
        } else {
          await env.DB.prepare('UPDATE published_documents SET views_count = views_count + 1 WHERE id = ?').bind(id).run();
        }

        return jsonResponse({ success: true, message: 'Interaction enregistrée (historique nettoyé après 30 jours)' }, 200, origin);
      }

      // Endpoint de réinitialisation manuelle de l'historique d'interactions (remise à zéro)
      if (path === '/api/published-documents/interactions/reset' && method === 'DELETE') {
        const targetUserId = url.searchParams.get('userId');
        try {
          if (targetUserId) {
            await env.DB.prepare('DELETE FROM user_document_interactions WHERE user_id = ?').bind(targetUserId).run();
          } else {
            await env.DB.prepare('DELETE FROM user_document_interactions').run();
          }
          return jsonResponse({ success: true, message: 'Historique des interactions réinitialisé à zéro avec succès' }, 200, origin);
        } catch (err: any) {
          return errorResponse('Erreur lors de la réinitialisation: ' + err.message, 500, origin);
        }
      }

      if (path.startsWith('/api/published-documents/') && path.endsWith('/view') && method === 'POST') {
        const id = path.split('/')[3];
        await env.DB.prepare('UPDATE published_documents SET views_count = views_count + 1 WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true }, 200, origin);
      }

      if (path.startsWith('/api/published-documents/') && path.endsWith('/download') && method === 'POST') {
        const id = path.split('/')[3];
        await env.DB.prepare('UPDATE published_documents SET downloads_count = downloads_count + 1 WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true }, 200, origin);
      }

      if (path.startsWith('/api/published-documents/') && method === 'DELETE') {
        const id = path.split('/')[3];
        const doc = await env.DB.prepare('SELECT r2_key FROM published_documents WHERE id = ?').bind(id).first<any>();
        if (doc && doc.r2_key && env.BUCKET) {
          try { await env.BUCKET.delete(doc.r2_key); } catch (e) {}
        }
        await env.DB.prepare('DELETE FROM published_documents WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Document supprimé' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 13. NOTIFICATIONS
      // ----------------------------------------------------------------------
      if (path === '/api/notifications') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, title, description, itemRef } = body;
          await env.DB.prepare(`
            INSERT INTO notifications (id, user_id, title, description, item_ref)
            VALUES (?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, title, description, itemRef || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 14. ASSISTANT DELMAS (Chat Messages)
      // ----------------------------------------------------------------------
      if (path === '/api/chat') {
        const userId = url.searchParams.get('userId');
        const sessionId = url.searchParams.get('sessionId');
        if (method === 'GET') {
          if (!userId || !sessionId) return errorResponse('userId et sessionId requis', 400, origin);
          const { results } = await env.DB.prepare('SELECT * FROM chat_messages WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC').bind(userId, sessionId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, sessionId, sender, messageText, attachedResourceId } = body;
          await env.DB.prepare(`
            INSERT INTO chat_messages (id, user_id, session_id, sender, message_text, attached_resource_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, sessionId, sender, messageText, attachedResourceId || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 15. ABONNEMENTS & FORMULES
      // ----------------------------------------------------------------------
      if (path === '/api/subscriptions') {
        const userId = url.searchParams.get('userId');
        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          const sub = await env.DB.prepare('SELECT * FROM user_subscriptions WHERE user_id = ? AND status = "active"').bind(userId).first();
          return jsonResponse({ success: true, data: sub || { plan_name: 'free', status: 'active' } }, 200, origin);
        }
        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, planName, billingCycle, expiresAt } = body;
          await env.DB.prepare(`
            INSERT INTO user_subscriptions (id, user_id, plan_name, billing_cycle, status, expires_at)
            VALUES (?, ?, ?, ?, 'active', ?)
          `).bind(id || crypto.randomUUID(), userId, planName, billingCycle || 'monthly', expiresAt || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }

      // ----------------------------------------------------------------------
      // 16. DÉLÉGATION TOTALE DE L'IA VERS LE WORKER IA DÉDIÉ
      // ----------------------------------------------------------------------
      if (path.startsWith('/api/ai') || path.startsWith('/api/ai-contents')) {
        return errorResponse(
          "Toutes les fonctionnalités de l'IA StudyCloud sont désormais gérées exclusivement par le Worker IA dédié (https://studycloud-ai.delmaskouassidibi.workers.dev).",
          404,
          origin
        );
      }

      // ----------------------------------------------------------------------
      // 17. SYNCHRONISATION GLOBALE & SAUVEGARDE CLOUD (Backup / Restore)
      // ----------------------------------------------------------------------
      if (path === '/api/sync/backup' && method === 'POST') {
        const body: any = await request.json();
        const { userId, userProfile, matieres, notes, scheduleSlots, scheduleConfig, alarms, shopProfile } = body;
        if (!userId) return errorResponse('userId requis', 400, origin);

        // 1. Profil
        if (userProfile) {
          const cleanEmail = (userProfile.email || `${userId}@studycloud.app`).toLowerCase().trim();
          const existing: any = await env.DB.prepare(
            'SELECT id FROM users WHERE id = ? OR LOWER(TRIM(email)) = ?'
          ).bind(userId, cleanEmail).first();

          if (existing) {
            await env.DB.prepare(`
              UPDATE users SET
                name = COALESCE(?, name),
                email = ?,
                school = COALESCE(?, school),
                filiere = COALESCE(?, filiere),
                country = COALESCE(?, country),
                avatar_url = COALESCE(?, avatar_url),
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).bind(
              userProfile.name || null,
              cleanEmail,
              userProfile.school || null,
              userProfile.filiere || null,
              userProfile.country || null,
              userProfile.avatarUrl || null,
              existing.id
            ).run();
          } else {
            await env.DB.prepare(`
              INSERT INTO users (id, name, email, school, filiere, country, avatar_url, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).bind(
              userId,
              userProfile.name || 'Étudiant',
              cleanEmail,
              userProfile.school || 'CME',
              userProfile.filiere || 'Général',
              userProfile.country || "Côte d'Ivoire",
              userProfile.avatarUrl || null
            ).run();
          }
        }

        // 2. Matières
        if (Array.isArray(matieres)) {
          for (const m of matieres) {
            await env.DB.prepare(`
              INSERT INTO matieres (id, user_id, name, coefficient, color, category, display_order)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                coefficient = excluded.coefficient,
                color = excluded.color,
                category = excluded.category,
                display_order = excluded.display_order
            `).bind(m.id || crypto.randomUUID(), userId, m.name || m.title, m.coefficient || 1.0, m.color || '#EA580C', m.category || 'Général', m.order || 0).run();
          }
        }

        // 3. Notes Keep
        if (Array.isArray(notes)) {
          for (const n of notes) {
            await env.DB.prepare(`
              INSERT INTO notes (id, user_id, title, content, color, is_pinned, image_url, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                color = excluded.color,
                is_pinned = excluded.is_pinned,
                image_url = excluded.image_url,
                updated_at = CURRENT_TIMESTAMP
            `).bind(n.id || crypto.randomUUID(), userId, n.title || 'Note', n.content || '', n.color || '#FFFFFF', n.isPinned ? 1 : 0, n.imageUrl || null).run();
          }
        }

        // 4. Emploi du temps
        if (scheduleConfig) {
          await env.DB.prepare(`
            INSERT INTO schedule_config (user_id, days_json, hours_json, zoom_level, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              days_json = excluded.days_json,
              hours_json = excluded.hours_json,
              zoom_level = excluded.zoom_level,
              updated_at = CURRENT_TIMESTAMP
          `).bind(userId, JSON.stringify(scheduleConfig.days || []), JSON.stringify(scheduleConfig.hours || []), scheduleConfig.zoomLevel || 100).run();
        }

        if (Array.isArray(scheduleSlots)) {
          for (const s of scheduleSlots) {
            await env.DB.prepare(`
              INSERT INTO schedule_slots (id, user_id, day, hour_slot, subject, room, note_or_teacher, color)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                day = excluded.day,
                hour_slot = excluded.hour_slot,
                subject = excluded.subject,
                room = excluded.room,
                note_or_teacher = excluded.note_or_teacher,
                color = excluded.color
            `).bind(s.id || crypto.randomUUID(), userId, s.day, s.hourSlot, s.subject, s.room || '', s.noteOrTeacher || '', s.color || '#EA580C').run();
          }
        }

        // 5. Alarmes
        if (Array.isArray(alarms)) {
          for (const a of alarms) {
            await env.DB.prepare(`
              INSERT INTO alarms (id, user_id, time, label, is_active, days_json)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                time = excluded.time,
                label = excluded.label,
                is_active = excluded.is_active,
                days_json = excluded.days_json
            `).bind(a.id || crypto.randomUUID(), userId, a.time, a.label || 'Réveil étude', a.isActive ? 1 : 0, JSON.stringify(a.days || ['Tous les jours'])).run();
          }
        }

        return jsonResponse({
          success: true,
          message: 'Sauvegarde Cloud effectuée avec succès',
          timestamp: new Date().toISOString()
        }, 200, origin);
      }

      if (path === '/api/sync/restore' && method === 'GET') {
        const userId = url.searchParams.get('userId');
        if (!userId) return errorResponse('userId requis', 400, origin);

        const [
          user,
          { results: matieres },
          { results: files },
          { results: notes },
          scheduleConfig,
          { results: scheduleSlots },
          { results: grades },
          { results: alarms },
          { results: aiContents }
        ] = await Promise.all([
          env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first(),
          env.DB.prepare('SELECT * FROM matieres WHERE user_id = ? ORDER BY display_order ASC').bind(userId).all(),
          env.DB.prepare('SELECT * FROM files WHERE user_id = ? ORDER BY last_imported DESC, created_at DESC').bind(userId).all(),
          env.DB.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC').bind(userId).all(),
          env.DB.prepare('SELECT * FROM schedule_config WHERE user_id = ?').bind(userId).first(),
          env.DB.prepare('SELECT * FROM schedule_slots WHERE user_id = ?').bind(userId).all(),
          env.DB.prepare('SELECT * FROM grades WHERE user_id = ?').bind(userId).all(),
          env.DB.prepare('SELECT * FROM alarms WHERE user_id = ?').bind(userId).all(),
          env.DB.prepare('SELECT * FROM ai_generated_contents WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC').bind(userId).all()
        ]);

        return jsonResponse({
          success: true,
          data: {
            user,
            matieres,
            files,
            notes,
            scheduleConfig,
            scheduleSlots,
            grades,
            alarms,
            aiContents
          }
        }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 12. PARRAINAGE & PROMOTION (Routes /api/referrals/*)
      // ----------------------------------------------------------------------
      if ((path === '/api/referrals/my-status' || path === '/api/referrals/status') && method === 'GET') {
        if (!env.DB) return errorResponse('Base de données D1 indisponible', 500, origin);
        await ensureReferralsTables(env.DB);

        let userId: string | null = null;
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (token) {
          const payload = await verifyJWT(token);
          if (payload?.userId) userId = payload.userId;
        }
        if (!userId) {
          userId = url.searchParams.get('userId');
        }

        if (!userId) return errorResponse('Identifiant utilisateur requis', 401, origin);

        let user: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        if (!user) return errorResponse('Compte utilisateur introuvable', 404, origin);

        // Assurer que l'utilisateur possède un code unique de parrainage à 9 chiffres
        let referralCode = user.referral_code;
        if (!referralCode) {
          let isUnique = false;
          while (!isUnique) {
            referralCode = generateReferralCode();
            const existing = await env.DB.prepare('SELECT id FROM users WHERE referral_code = ?').bind(referralCode).first();
            if (!existing) isUnique = true;
          }
          await env.DB.prepare('UPDATE users SET referral_code = ? WHERE id = ?').bind(referralCode, user.id).run();
          user.referral_code = referralCode;
        }

        // Compter en direct le nombre réel de personnes parrainées et les jours acquis
        const stats: any = await env.DB.prepare(`
          SELECT COUNT(*) as count, COALESCE(SUM(reward_days), 0) as total_days
          FROM referrals
          WHERE referrer_id = ?
        `).bind(user.id).first();

        const referralsCount = Number(stats?.count || 0);
        const adFreeDaysEarned = Number(stats?.total_days || 0);

        // Synchroniser le profil
        if (user.referrals_count !== referralsCount || user.ad_free_days_earned !== adFreeDaysEarned) {
          await env.DB.prepare('UPDATE users SET referrals_count = ?, ad_free_days_earned = ? WHERE id = ?').bind(referralsCount, adFreeDaysEarned, user.id).run();
        }

        // Charger la configuration des règles et avantages depuis la base de données D1
        const configRow: any = await env.DB.prepare("SELECT * FROM referral_rewards_config WHERE id = 'default'").first();
        let milestones = [
          { count: 3, extra_days: 5, label: "3 personnes promues : +5 jours bonus" },
          { count: 5, extra_days: 10, label: "5 personnes promues : +10 jours bonus" },
          { count: 7, extra_days: 15, label: "7 personnes promues : +15 jours bonus" },
          { count: 10, extra_days: 3650, label: "10 personnes promues : +3650 jours bonus" }
        ];
        let rules = [
          "Chaque fois que vous promouvez avec succès une personne qui s'inscrit, vous bénéficierez de 5 jours de publicité gratuite, qui peuvent être accumulés de manière illimitée~",
          "Un total de 3 personnes inscrites par vous, et 5 jours supplémentaires de publicité gratuite offerts~",
          "Un total de 5 personnes inscrites par vous, et 10 jours supplémentaires de publicité gratuite offerts~",
          "Un total de 7 personnes inscrites par vous, et 15 jours supplémentaires de publicité gratuite offerts~",
          "Un total de 10 personnes inscrites par vous, et 3650 jours supplémentaires de publicité gratuite offerts~"
        ];
        if (configRow?.milestones_json) {
          try { milestones = JSON.parse(configRow.milestones_json); } catch (e) {}
        }
        if (configRow?.rules_text_json) {
          try { rules = JSON.parse(configRow.rules_text_json); } catch (e) {}
        }

        // Liste des personnes invitées
        const { results: referralsList } = await env.DB.prepare(`
          SELECT id, referred_user_name, reward_days, created_at
          FROM referrals
          WHERE referrer_id = ?
          ORDER BY created_at DESC
          LIMIT 50
        `).bind(user.id).all();

        return jsonResponse({
          success: true,
          referralCode,
          referralsCount,
          adFreeDaysEarned,
          inviteUrl: `${url.origin}/invite/${referralCode}`,
          appInviteUrl: `https://studycloud.dkd-technologies.com/?ref=${referralCode}#register`,
          rules,
          milestones,
          referrals: referralsList || [],
          config: {
            daysPerReferral: Number(configRow?.days_per_referral) || 5,
            rules,
            milestones
          }
        }, 200, origin);
      }

      if (path === '/api/referrals/config' && (method === 'PUT' || method === 'POST')) {
        if (!env.DB) return errorResponse('Base de données D1 indisponible', 500, origin);
        await ensureReferralsTables(env.DB);
        const body: any = await request.json().catch(() => ({}));
        const { daysPerReferral, milestones, rules } = body;

        const currentConfig: any = await env.DB.prepare("SELECT * FROM referral_rewards_config WHERE id = 'default'").first();
        const newDays = daysPerReferral !== undefined ? Number(daysPerReferral) : (currentConfig?.days_per_referral || 5);
        const newMilestonesJson = milestones ? JSON.stringify(milestones) : currentConfig?.milestones_json;
        const newRulesJson = rules ? JSON.stringify(rules) : currentConfig?.rules_text_json;

        await env.DB.prepare(`
          INSERT INTO referral_rewards_config (id, days_per_referral, milestones_json, rules_text_json, updated_at)
          VALUES ('default', ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            days_per_referral = excluded.days_per_referral,
            milestones_json = excluded.milestones_json,
            rules_text_json = excluded.rules_text_json,
            updated_at = CURRENT_TIMESTAMP
        `).bind(newDays, newMilestonesJson, newRulesJson).run();

        return jsonResponse({
          success: true,
          message: 'Configuration des avantages de parrainage mise à jour avec succès',
          config: {
            daysPerReferral: newDays,
            milestones: milestones || JSON.parse(newMilestonesJson || '[]'),
            rules: rules || JSON.parse(newRulesJson || '[]')
          }
        }, 200, origin);
      }

      // Route 404 par défaut
      return errorResponse(`Route non trouvée : ${method} ${path}`, 404, origin);

    } catch (err: any) {
      console.error('Worker API Error:', err);
      return errorResponse(err.message || 'Erreur interne du serveur', 500, origin);
    }
  },

  // Handler CRON Cloudflare : exécution périodique automatique pour nettoyer les interactions de plus de 30 jours
  async scheduled(event: any, env: any, ctx: any) {
    if (env && env.DB) {
      try {
        await env.DB.prepare(`
          DELETE FROM user_document_interactions 
          WHERE created_at < datetime('now', '-30 days')
        `).run();
        console.log('[StudyCloud Cron] Purge des interactions utilisateur de plus de 30 jours effectuée avec succès.');
      } catch (e) {
        console.error('[StudyCloud Cron Error]', e);
      }
    }
  },
};



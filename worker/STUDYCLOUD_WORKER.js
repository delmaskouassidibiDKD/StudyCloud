// ============================================================================
// STUDYCLOUD - CLOUDFLARE WORKER BACKEND (FICHIER UNIQUE OFFICIEL)
// ============================================================================
// Ce fichier est le SEUL et UNIQUE fichier de Worker du projet.
// Tous les anciens fichiers ont été supprimés définitivement.
//
// POUR DÉPLOYER DANS CLOUDFLARE :
// 1. Ouvrez ce fichier (worker/STUDYCLOUD_WORKER.js).
// 2. Faites Ctrl+A puis Ctrl+C pour tout copier.
// 3. Allez sur votre Cloudflare Dashboard > Workers & Pages > Votre Worker > Quick Edit.
// 4. Effacez tout l'ancien code (Ctrl+A puis Suppr) et collez le nouveau code (Ctrl+V).
// 5. Cliquez sur "Save and Deploy" (Enregistrer et déployer).
// ============================================================================
// @ts-nocheck
/* eslint-disable */
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var DNA_LOGO_PNG_B64 = "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";
var DNA_LOGO_SVG = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, Cache-Control, Pragma, *"
  };
}
__name(corsHeaders, "corsHeaders");
function jsonResponse(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      ...corsHeaders(origin)
    }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(error, status = 400, origin = "*") {
  return jsonResponse({ success: false, error }, status, origin);
}
__name(errorResponse, "errorResponse");
function formatBytes(bytes) {
  if (!bytes || bytes === 0)
    return "0 o";
  const k = 1024;
  const sizes = ["o", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
__name(formatBytes, "formatBytes");
function escapeHtml(str) {
  if (str === null || str === void 0)
    return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
__name(escapeHtml, "escapeHtml");
function generateCleanShareCode() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "sc_" + Math.random().toString(36).substring(2, 14) + Date.now().toString(36);
}
__name(generateCleanShareCode, "generateCleanShareCode");
function getFileIconMeta(filename) {
  const lower = (filename || "").toLowerCase();
  if (lower.endsWith(".pdf")) {
    return { color: "#E53E3E", label: "PDF" };
  } else if (/\.(doc|docx|rtf|odt)$/i.test(lower)) {
    return { color: "#2563EB", label: "WORD" };
  } else if (/\.(cpp|c|h|hpp|cc)$/i.test(lower)) {
    return { color: "#4B5563", label: "CPP" };
  } else if (/\.(py|python)$/i.test(lower)) {
    return { color: "#0284C7", label: "PY" };
  } else if (/\.(js|jsx|ts|tsx)$/i.test(lower)) {
    return { color: "#D97706", label: "JS" };
  } else if (/\.(xls|xlsx|csv)$/i.test(lower)) {
    return { color: "#059669", label: "EXCEL" };
  } else if (/\.(ppt|pptx)$/i.test(lower)) {
    return { color: "#EA580C", label: "PPT" };
  } else if (/\.(zip|rar|7z|tar|gz)$/i.test(lower)) {
    return { color: "#8B5CF6", label: "ZIP" };
  } else if (/\.(png|jpg|jpeg|webp|gif|svg|bmp|ico|heic|tiff)$/i.test(lower)) {
    return { color: "#10B981", label: "IMG" };
  } else if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(lower)) {
    return { color: "#06B6D4", label: "AUDIO" };
  } else if (/\.(mp4|mkv|mov|avi)$/i.test(lower)) {
    return { color: "#6366F1", label: "VIDEO" };
  }
  const ext = lower.split(".").pop();
  return { color: "#64748B", label: ext && ext.length <= 4 ? ext.toUpperCase() : "DOC" };
}
__name(getFileIconMeta, "getFileIconMeta");
function renderFileDocIconSvg(color, label) {
  return `<svg class="doc-icon-svg" viewBox="0 0 68 84" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 0H46L68 22V78C68 81.3137 65.3137 84 62 84H6C2.68629 84 0 81.3137 0 78V6C0 2.68629 2.68629 0 6 0Z" fill="${color}" />
    <path d="M46 0L68 22H52C48.6863 22 46 19.3137 46 16V0Z" fill="white" fill-opacity="0.35" />
    <text x="34" y="53" fill="white" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="15" font-weight="900" text-anchor="middle" letter-spacing="0.5">${label}</text>
  </svg>`;
}
__name(renderFileDocIconSvg, "renderFileDocIconSvg");
function renderShareNotFoundHtml(code, originUrl) {
  const siteUrl = "https://studycloud.dkd-technologies.com";
  return `<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StudyCloud \u2022 Stockage & Partage S\xE9curis\xE9</title>
  <meta name="description" content="T\xE9l\xE9chargez votre fichier en cliquant sur ce lien. StudyCloud : Plateforme cloud de stockage s\xE9curis\xE9 pour \xE9l\xE8ves, \xE9tudiants, entreprises et professionnels.">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="StudyCloud">
  <meta property="og:title" content="StudyCloud \u2022 Stockage & Partage S\xE9curis\xE9">
  <meta property="og:description" content="T\xE9l\xE9chargez votre fichier en cliquant sur ce lien. StudyCloud : Plateforme cloud de stockage s\xE9curis\xE9 pour \xE9l\xE8ves, \xE9tudiants, entreprises et professionnels.">
  <meta property="og:image" content="https://studycloud.dkd-technologies.com/assets/dna-logo.png">
  <meta property="og:image:secure_url" content="https://studycloud.dkd-technologies.com/assets/dna-logo.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="300">
  <meta property="og:image:height" content="300">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="StudyCloud \u2022 Stockage & Partage S\xE9curis\xE9">
  <meta name="twitter:description" content="T\xE9l\xE9chargez votre fichier en cliquant sur ce lien. StudyCloud : Plateforme cloud de stockage s\xE9curis\xE9 pour \xE9l\xE8ves, \xE9tudiants, entreprises et professionnels.">
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
  <div class="code-badge">\u{1F512} Acc\xE8s s\xE9curis\xE9 & chiffr\xE9</div>
  <h1>Ce document partag\xE9 est introuvable</h1>
  <p>Le lien d'acc\xE8s s\xE9curis\xE9 a peut-\xEAtre expir\xE9 ou a \xE9t\xE9 supprim\xE9 par son propri\xE9taire.</p>
  <a href="${siteUrl}" class="btn">Acc\xE9der \xE0 l'application StudyCloud &rarr;</a>
</body>
</html>`;
}
__name(renderShareNotFoundHtml, "renderShareNotFoundHtml");
function renderShareLandingHtml(folder, files, originUrl) {
  const shareCode = escapeHtml(folder.share_code || "DKD-SHARE");
  const title = escapeHtml(folder.title || "Document Partag\xE9");
  const description = escapeHtml(folder.description || "");
  const authorName = escapeHtml(folder.author_name || "DKD");
  const category = escapeHtml(folder.category || "Cours");
  const totalFiles = files ? files.length : 0;
  const totalSize = files ? files.reduce((acc, f) => acc + (f.size || 0), 0) : folder.total_size || 0;
  const formattedSize = formatBytes(totalSize);
  const siteUrl = "https://studycloud.dkd-technologies.com";
  const logoUrl = "https://studycloud.dkd-technologies.com/assets/studycloud-brand-logo.png";
  const faviconUrl = "https://studycloud.dkd-technologies.com/assets/dna-logo.png";
  const shareUrl = `${originUrl}/s/${encodeURIComponent(folder.share_code || folder.id)}`;
  const ogTitle = escapeHtml(`${title} \u2022 StudyCloud`);
  const appDesc = escapeHtml("T\xE9l\xE9chargez votre fichier en cliquant sur ce lien. StudyCloud : Plateforme cloud de stockage s\xE9curis\xE9 pour \xE9l\xE8ves, \xE9tudiants, entreprises et professionnels.");
  const filesJson = JSON.stringify((files || []).map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size || 0,
    type: f.type || "application/octet-stream",
    url: f.file_url || f.url || ""
  })));
  const filesGridHtml = files && files.length > 0 ? files.map((f) => {
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
  }).join("") : '<div style="padding: 32px; text-align: center; color: #94a3b8; font-size: 14px; grid-column: 1 / -1;">Aucun fichier disponible dans ce partage.</div>';
  return `<!DOCTYPE html>
<html lang="fr" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${ogTitle}</title>

  <!-- M\xE9tadonn\xE9es de l'application & Aper\xE7u WhatsApp / R\xE9seaux Sociaux -->
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
  <meta property="og:image:alt" content="Logo StudyCloud - Stockage et Partage S\xE9curis\xE9">

  <!-- Twitter Cards -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${appDesc}">
  <meta name="twitter:image" content="${logoUrl}">

  <!-- Favicon / Ic\xF4nes -->
  <link rel="icon" type="image/png" href="${logoUrl}">
  <link rel="apple-touch-icon" href="${logoUrl}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"><\/script>
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

    /* Bouton Acc\xE9der \xE0 l'application */
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

    /* CARTE DE FICHIER (CADRE ORANGE RAPPROCH\xC9 DU FICHIER, FOND BLANC, COCH\xC9 EN HAUT \xC0 DROITE) */
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

    /* IC\xD4NE DE FICHIER DIMINU\xC9E */
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

    /* SUR ORDINATEUR : 5 FICHIERS PAR LIGNE, TAILLE R\xC9DUITE & CADRE ORANGE RAPPROCH\xC9 */
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

    /* BARRE FIXE EN BAS - 100% RESPONSIVE ET JAMAIS COUP\xC9E SUR AUCUN APPAREIL */
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
        <!-- Logo ADN Officiel StudyCloud (identique aux emails envoy\xE9s aux utilisateurs et \xE0 l'application) -->
        <div class="brand-logo-wrap">
          <img src="https://studycloud.dkd-technologies.com/assets/dna-logo.png" width="34" height="34" alt="Logo StudyCloud" style="display:block;border:0;width:34px;height:34px;object-fit:contain;margin:0;" onerror="this.onerror=null;this.src='data:image/png;base64,${DNA_LOGO_PNG_B64}'" />
        </div>
        <div class="brand-titles notranslate">
          <div class="brand-title-row">
            <span class="brand-study">Study</span><span class="brand-cloud">Cloud</span>
          </div>
          <span class="brand-tagline">Portail de t\xE9l\xE9chargement direct</span>
        </div>
      </a>

      <!-- Bouton Acc\xE9der \xE0 l'application -->
      <a href="${siteUrl}" target="_blank" class="btn-top-site">
        <span>Acc\xE9der \xE0 l'application</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </a>
    </div>
  </header>

  <!-- MAIN -->
  <main>
    <!-- INFORMATIONS SUR LE DOSSIER -->
    <div class="info-section">
      <span class="meta-stats">${formattedSize} \u2022 ${totalFiles} fichier(s)</span>
      <h1 class="folder-title">${title}</h1>
      <p class="folder-desc">${description || "Dossier partag\xE9 contenant " + totalFiles + " \xE9l\xE9ment(s)."}</p>
    </div>

    <!-- FICHIERS DISPONIBLES -->
    <div class="files-section">
      <div class="files-section-header">
        <span class="files-section-title">FICHIERS DISPONIBLES (${totalFiles})</span>
        <button type="button" class="btn-toggle-all" onclick="toggleSelectAll()">Tout cocher / d\xE9cocher</button>
      </div>

      <div class="files-grid">
        ${filesGridHtml}
      </div>
    </div>
  </main>

  <!-- BARRE EN BAS : PARFAITEMENT VISIBLE SUR TOUS LES APPAREILS SANS AUCUNE COUPURE -->
  <div class="bottom-bar">
    <div class="bottom-bar-inner">
      <button type="button" id="btnDownloadZip" onclick="handleDownloadZip()" class="btn-bottom btn-bottom-zip" title="Tout t\xE9l\xE9charger en fichier zip">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span class="btn-zip-full">Tout t\xE9l\xE9charger en fichier zip</span>
        <span class="btn-zip-short">T\xE9l\xE9charger en ZIP</span>
      </button>

      <button type="button" id="btnDownloadAction" onclick="handleDownloadAction()" class="btn-bottom btn-bottom-action">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        <span id="btnDownloadActionText">Tout t\xE9l\xE9charger</span>
      </button>
    </div>
  </div>

  <!-- TOAST -->
  <div id="toast" class="toast">
    <span id="toastMsg">Notification</span>
  </div>

  <script>
    // URL r\xE9elle de t\xE9l\xE9chargement direct pr\xE9serv\xE9e dans la barre d'adresse

    window.__SHARE_ID__ = ${JSON.stringify(folder.id)};
    window.__SHARE_TITLE__ = ${JSON.stringify(folder.title || "StudyCloud_Partage")};
    window.__FILES__ = ${filesJson};
    // TOUT EST COCH\xC9 PAR D\xC9FAUT
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
        btnText.textContent = 'S\xE9lectionner';
        btnAction.disabled = true;
      } else if (selectedCount === total) {
        // TOUT EST COCH\xC9 -> Tout t\xE9l\xE9charger
        btnText.textContent = 'Tout t\xE9l\xE9charger';
        btnAction.disabled = false;
      } else if (selectedCount < 2) {
        // INF\xC9RIEUR \xC0 2 (1 fichier coch\xE9) -> T\xE9l\xE9charger
        btnText.textContent = 'T\xE9l\xE9charger';
        btnAction.disabled = false;
      } else {
        // Plusieurs fichiers coch\xE9s
        btnText.textContent = 'T\xE9l\xE9charger (' + selectedCount + ')';
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

    // BOUTON 1: Tout t\xE9l\xE9charger en fichier ZIP
    async function handleDownloadZip() {
      const selected = window.__FILES__.filter(f => window.__SELECTED_FILES__.has(String(f.id)));
      if (selected.length === 0) {
        showToast('Veuillez cocher au moins un fichier.');
        return;
      }

      showToast('Pr\xE9paration de votre fichier ZIP...');
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
          showToast('T\xE9l\xE9chargement du ZIP lanc\xE9 !');
          return;
        } catch (err) {
          console.warn('Erreur cr\xE9ation ZIP:', err);
        }
      }

      // Fallback si JSZip indisponible
      triggerFilesDownload(selected);
    }

    // BOUTON 2: Tout t\xE9l\xE9charger / T\xE9l\xE9charger
    function handleDownloadAction() {
      const selected = window.__FILES__.filter(f => window.__SELECTED_FILES__.has(String(f.id)));
      if (selected.length === 0) {
        showToast('Veuillez cocher au moins un fichier.');
        return;
      }
      showToast('T\xE9l\xE9chargement de ' + selected.length + ' fichier(s)...');
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

    // Initialisation imm\xE9diate de l'\xE9tat des boutons
    updateActionButtons();
  <\/script>
</body>
</html>`;
}
__name(renderShareLandingHtml, "renderShareLandingHtml");
function renderProductSharePageHtml(product, sellerShop, sellerUser, relatedProducts, appOrigin) {
  const title = escapeHtml(product.title || "Produit StudyCloud");
  const price = escapeHtml(product.price || "0 FCFA");
  const description = product.description || "";
  const cleanDesc = description ? description.replace(/<[^>]*>?/gm, "").trim() : `Commandez ${product.title} sur la boutique de ${product.seller_name || "DKD"} sur StudyCloud.`;
  const productShareUrl = `${appOrigin}/share/product/${encodeURIComponent(product.id)}`;
  const productImageUrl = `${appOrigin}/api/products/${encodeURIComponent(product.id)}/image`;
  let rawImages = [];
  try {
    rawImages = JSON.parse(product.image_urls_json || "[]");
  } catch (e) {
  }
  if (!Array.isArray(rawImages) || rawImages.length === 0) {
    if (product.image_url)
      rawImages = [product.image_url];
  }
  const imageSlides = Array.from({ length: 3 }).map((_, i) => rawImages[i] || (rawImages[0] ? rawImages[0] : null));
  const sellerName = escapeHtml(product.seller_name || sellerShop?.shop_name || sellerUser?.name || "DKD");
  const rawPhone = product.seller_whatsapp || sellerShop?.shop_whatsapp || product.seller_phone || sellerShop?.shop_phone || sellerUser?.phone || "";
  let cleanPhone = String(rawPhone || "").replace(/\D/g, "");
  if (cleanPhone.length === 10 && cleanPhone.startsWith("0")) {
    cleanPhone = "225" + cleanPhone;
  } else if (cleanPhone.length === 8 && !cleanPhone.startsWith("225")) {
    cleanPhone = "225" + cleanPhone;
  }
  const sellerAvatar = product.seller_avatar_url || sellerShop?.shop_avatar_url || "";
  const sellerInitials = sellerName.substring(0, 2).toUpperCase();
  let sellerSubtitle = "";
  if (product.seller_school && product.seller_filiere) {
    sellerSubtitle = `${product.seller_school} - ${product.seller_filiere}`;
  } else if (product.seller_school) {
    sellerSubtitle = product.seller_school;
  } else if (product.seller_filiere) {
    sellerSubtitle = product.seller_filiere;
  } else {
    sellerSubtitle = "Boutique Officielle StudyCloud";
  }
  sellerSubtitle = escapeHtml(sellerSubtitle);
  const autoMessage = `Bonjour ! Je suis int\xE9ress\xE9(e) par votre produit : *${product.title}* (${product.price}).

Lien vers le produit : ${productShareUrl}`;
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(autoMessage)}` : `https://wa.me/?text=${encodeURIComponent(autoMessage)}`;
  const hasLongDesc = description && description.length > 80;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title} - ${price} | StudyCloud</title>
  
  <!-- Open Graph / WhatsApp Preview Tags -->
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="StudyCloud - Librairie & Produits">
  <meta property="og:title" content="${title} (${price})">
  <meta property="og:description" content="${escapeHtml(cleanDesc)}">
  <meta property="og:image" content="${productImageUrl}">
  <meta property="og:image:secure_url" content="${productImageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="600">
  <meta property="og:url" content="${productShareUrl}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title} (${price})">
  <meta name="twitter:description" content="${escapeHtml(cleanDesc)}">
  <meta name="twitter:image" content="${productImageUrl}">

  <link rel="icon" type="image/png" href="${appOrigin}/assets/dna-logo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    body {
      background-color: #FAF8F5;
      color: #1c1917;
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Top Sticky Header */
    .top-header {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(231, 229, 228, 0.85);
      padding: 10px 16px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .header-inner {
      max-width: 1280px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .btn-goto-app {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 14px;
      background: #f5f5f4;
      border: 1px solid #e7e5e4;
      border-radius: 12px;
      color: #1c1917;
      font-size: 12.5px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-goto-app:hover {
      background: #e7e5e4;
      transform: translateY(-1px);
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }
    .header-brand img {
      width: 26px;
      height: 26px;
      object-fit: contain;
    }
    .brand-title {
      font-weight: 900;
      font-size: 17px;
      letter-spacing: -0.5px;
    }
    .brand-study { color: #f97316; }
    .brand-cloud { color: #1e293b; }

    /* Container */
    .main-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px 16px 60px;
      display: flex;
      flex-direction: row;
      gap: 36px;
      align-items: flex-start;
    }
    @media (max-width: 860px) {
      .main-container {
        flex-direction: column;
        gap: 20px;
        padding: 12px 12px 60px;
      }
    }

    /* Colonne Gauche */
    .left-column {
      flex: 1.15;
      width: 100%;
      min-width: 0;
    }

    /* Carte Slider Image */
    .carousel-card {
      background: #ffffff;
      border-radius: 24px;
      border: 1px solid #e7e5e4;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .carousel-viewport {
      position: relative;
      width: 100%;
      height: 340px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    @media (min-width: 640px) {
      .carousel-viewport {
        height: 380px;
      }
    }

    /* Badge Logo StudyCloud incrust\xE9 */
    .sc-badge {
      position: absolute;
      top: 16px;
      left: 18px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: rgba(28, 25, 23, 0.92);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: 9999px;
      border: 1px solid rgba(249, 115, 22, 0.5);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 20;
    }
    .sc-badge-img {
      width: 15px;
      height: 15px;
      border-radius: 50%;
      object-fit: contain;
    }
    .sc-badge-text {
      font-size: 10px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 1px;
    }

    /* Compteur de slide */
    .slide-counter {
      position: absolute;
      bottom: 12px;
      right: 16px;
      background: rgba(28, 25, 23, 0.82);
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 6px;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 20;
    }

    .slide-img-box {
      width: 100%;
      height: 100%;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .slide-img-box.active {
      display: flex;
    }
    .slide-img-box img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 12px;
    }
    .slide-placeholder {
      width: 100%;
      height: 100%;
      background: #fafaf9;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #a8a29e;
      border: 2px dashed #e7e5e4;
      border-radius: 16px;
    }

    /* Points indicateurs */
    .carousel-dots {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 0 14px;
      background: #f5f5f4;
      border-top: 1px solid #e7e5e4;
    }
    .dot {
      height: 7px;
      border-radius: 9999px;
      background: #d6d3d1;
      transition: all 0.25s ease;
      cursor: pointer;
      width: 8px;
    }
    .dot.active {
      width: 22px;
      background: #1c1917;
    }

    /* D\xE9tails du produit */
    .product-details-card {
      background: #ffffff;
      border-radius: 24px;
      border: 1px solid #e7e5e4;
      padding: 22px;
      margin-top: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .product-title {
      font-size: 21px;
      font-weight: 900;
      color: #1c1917;
      text-transform: uppercase;
      line-height: 1.35;
      letter-spacing: -0.3px;
    }
    .product-price {
      font-size: 25px;
      font-weight: 900;
      color: #ea580c;
      margin-top: 6px;
    }

    /* Description */
    .desc-section {
      border-top: 1px solid #e7e5e4;
      margin-top: 18px;
      padding-top: 16px;
    }
    .desc-header {
      font-size: 11px;
      font-weight: 800;
      color: #78716c;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 8px;
    }
    .desc-text {
      font-size: 12.5px;
      color: #44403c;
      line-height: 1.65;
      white-space: pre-line;
      font-weight: 500;
    }
    .desc-clamped {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .desc-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: none;
      border: none;
      color: #1c1917;
      font-size: 12px;
      font-weight: 800;
      text-decoration: underline;
      text-underline-offset: 3px;
      cursor: pointer;
      margin-top: 8px;
      padding: 0;
    }
    .desc-toggle-btn svg {
      transition: transform 0.2s ease;
    }
    .desc-toggle-btn.expanded svg {
      transform: rotate(180deg);
    }

    /* Actions */
    .actions-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 20px;
    }
    .btn-cart {
      padding: 13px 18px;
      border-radius: 14px;
      border: 1px solid #d6d3d1;
      background: #f5f5f4;
      color: #1c1917;
      font-size: 13px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .btn-cart:hover {
      background: #e7e5e4;
    }
    .btn-cart.added {
      background: #fef3c7;
      color: #78350f;
      border-color: #fcd34d;
    }
    .btn-commander {
      flex: 1;
      padding: 14px 20px;
      background: #ea580c;
      color: #ffffff;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 800;
      text-align: center;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);
      transition: all 0.2s;
    }
    .btn-commander:hover {
      background: #c2410c;
      transform: translateY(-1px);
    }

    /* Colonne Droite */
    .right-column {
      flex: 0.95;
      width: 100%;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Fiche Vendeur */
    .seller-card {
      background: #ffffff;
      border-radius: 24px;
      border: 1px solid #e7e5e4;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .seller-header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
    }
    .seller-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #fef3c7;
      border: 2px solid #1c1917;
      box-shadow: 2px 2px 0px #1c1917;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
      color: #78350f;
      overflow: hidden;
      flex-shrink: 0;
    }
    .seller-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .seller-details {
      overflow: hidden;
    }
    .seller-name {
      font-size: 16px;
      font-weight: 900;
      color: #1c1917;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .seller-phone {
      font-size: 12.5px;
      font-weight: 600;
      color: #57534e;
      margin-top: 2px;
    }
    .seller-subtitle {
      font-size: 11px;
      font-weight: 700;
      color: #78716c;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .seller-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-seller {
      flex: 1;
      padding: 9px 16px;
      border-radius: 9999px;
      border: 1.5px solid #1c1917;
      background: transparent;
      color: #1c1917;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-seller:hover {
      background: #f5f5f4;
    }
    .btn-seller.active {
      background: #1c1917;
      color: #ffffff;
    }

    /* Autres Produits */
    .other-products-card {
      background: #ffffff;
      border-radius: 24px;
      border: 1px solid #e7e5e4;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .other-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
    }
    .other-title {
      font-size: 14px;
      font-weight: 800;
      color: #1c1917;
    }
    .librairie-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 700;
      color: #78716c;
      text-decoration: none;
      transition: color 0.2s;
    }
    .librairie-link:hover {
      color: #ea580c;
    }
    .other-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .other-item {
      display: block;
      border: 1px solid #e7e5e4;
      border-radius: 16px;
      padding: 10px;
      text-decoration: none;
      color: inherit;
      background: #fafaf9;
      transition: all 0.2s ease;
    }
    .other-item:hover {
      background: #ffffff;
      border-color: #d6d3d1;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .other-img-wrap {
      position: relative;
      width: 100%;
      height: 110px;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    .other-img-wrap img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .other-item-title {
      font-size: 12px;
      font-weight: 800;
      color: #1c1917;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .other-item-price {
      font-size: 13px;
      font-weight: 900;
      color: #ea580c;
      margin-top: 3px;
    }

    /* Toast Flottant */
    .toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(-80px);
      background: #059669;
      color: #ffffff;
      padding: 11px 22px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 800;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      z-index: 99999;
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 90vw;
      text-align: center;
    }
    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  </style>
</head>
<body>

  <!-- Header Flottant -->
  <header class="top-header">
    <div class="header-inner">
      <a href="${appOrigin}/?product=${encodeURIComponent(product.id)}#librairie" class="btn-goto-app">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span>Aller \xE0 l'application</span>
      </a>

      <a href="${appOrigin}" class="header-brand">
        <img src="${appOrigin}/assets/dna-logo.png" onerror="this.onerror=null;this.src='data:image/png;base64,${DNA_LOGO_PNG_B64}'" alt="StudyCloud" />
        <span class="brand-title"><span class="brand-study">Study</span><span class="brand-cloud">Cloud</span></span>
      </a>
    </div>
  </header>

  <!-- Notification Toast -->
  <div id="toastEl" class="toast"></div>

  <!-- Contenu Principal -->
  <main class="main-container">

    <!-- Colonne Gauche : Image et D\xE9tails -->
    <div class="left-column">
      
      <!-- Galerie Image -->
      <div class="carousel-card">
        <div class="carousel-viewport" id="carouselViewport">
          <!-- Badge Logo StudyCloud en haut de l'image -->
          <div class="sc-badge">
            <img src="${appOrigin}/assets/dna-logo.png" onerror="this.onerror=null;this.src='data:image/png;base64,${DNA_LOGO_PNG_B64}'" class="sc-badge-img" alt="StudyCloud" />
            <span class="sc-badge-text">STUDYCLOUD</span>
          </div>

          <!-- Compteur 1 / 3 -->
          <div id="slideCounter" class="slide-counter">1 / ${imageSlides.length}</div>

          <!-- Slides -->
          ${imageSlides.map((imgUrl, idx) => `
            <div class="slide-img-box ${idx === 0 ? "active" : ""}" data-index="${idx}">
              ${imgUrl ? `
                <img src="${escapeHtml(imgUrl)}" alt="${title} - Image ${idx + 1}" />
              ` : `
                <div class="slide-placeholder">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  <span style="font-size: 11px; font-weight: 700;">Image ${idx + 1} / 3</span>
                </div>
              `}
            </div>
          `).join("")}
        </div>

        <!-- Points indicateurs du slider -->
        <div class="carousel-dots" id="dotsContainer">
          ${imageSlides.map((_, idx) => `
            <div class="dot ${idx === 0 ? "active" : ""}" onclick="goToSlide(${idx})"></div>
          `).join("")}
        </div>
      </div>

      <!-- D\xE9tails Produit -->
      <div class="product-details-card">
        <h1 class="product-title">${title}</h1>
        <div class="product-price">${price}</div>

        <!-- Description -->
        <div class="desc-section">
          <div class="desc-header">Description</div>
          <div id="descText" class="desc-text ${hasLongDesc ? "desc-clamped" : ""}">
            ${escapeHtml(description || "Aucune description fournie pour ce produit.")}
          </div>
          ${hasLongDesc ? `
            <button type="button" id="descBtn" onclick="toggleDescription()" class="desc-toggle-btn">
              <span id="descBtnText">D\xE9rouler la description</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
          ` : ""}
        </div>

        <!-- Boutons d'Action -->
        <div class="actions-row">
          <button type="button" id="cartBtn" onclick="handleCartToggle()" class="btn-cart">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span id="cartBtnText">Ajouter au panier</span>
          </button>

          <a href="${whatsappUrl}" target="_blank" class="btn-commander">
            Commander
          </a>
        </div>
      </div>

    </div>

    <!-- Colonne Droite : Vendeur & Autres Produits -->
    <div class="right-column">
      
      <!-- Fiche Vendeur -->
      <div class="seller-card">
        <div class="seller-header">
          <div class="seller-avatar">
            ${sellerAvatar ? `<img src="${escapeHtml(sellerAvatar)}" alt="${sellerName}">` : sellerInitials}
          </div>
          <div class="seller-details">
            <div class="seller-name">${sellerName}</div>
            <div class="seller-phone">${escapeHtml(rawPhone || "+225 00 00 00 00")}</div>
            <div class="seller-subtitle">${sellerSubtitle}</div>
          </div>
        </div>

        <div class="seller-actions">
          <button type="button" id="followBtn" onclick="handleFollowToggle()" class="btn-seller">
            <span id="followBtnText">S'abonner</span>
          </button>

          <button type="button" onclick="handleShare()" class="btn-seller">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            <span>Partager</span>
          </button>
        </div>
      </div>

      <!-- Autres Produits de la boutique -->
      ${relatedProducts && relatedProducts.length > 0 ? `
        <div class="other-products-card">
          <div class="other-header">
            <span class="other-title">Autres produits</span>
            <a href="${appOrigin}/?product=${encodeURIComponent(product.id)}#librairie" class="librairie-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              <span>Librairie</span>
            </a>
          </div>

          <div class="other-grid">
            ${relatedProducts.map((p) => {
    let rImg = "";
    try {
      const pImgs = JSON.parse(p.image_urls_json || "[]");
      if (pImgs && pImgs[0])
        rImg = pImgs[0];
    } catch (e) {
    }
    return `
                <a href="${appOrigin}/share/product/${encodeURIComponent(p.id)}" class="other-item">
                  <div class="other-img-wrap">
                    ${rImg ? `
                      <img src="${escapeHtml(rImg)}" alt="${escapeHtml(p.title)}" />
                    ` : `
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a8a29e" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    `}
                  </div>
                  <div class="other-item-title">${escapeHtml(p.title)}</div>
                  <div class="other-item-price">${escapeHtml(p.price)}</div>
                </a>
              `;
  }).join("")}
          </div>
        </div>
      ` : ""}

    </div>

  </main>

  <script>
    const PRODUCT_ID = ${JSON.stringify(String(product.id))};
    const PRODUCT_TITLE = ${JSON.stringify(String(product.title))};
    const SELLER_ID = ${JSON.stringify(String(product.seller_id || "default-seller"))};
    const SELLER_NAME = ${JSON.stringify(String(product.seller_name || "Vendeur"))};
    const TOTAL_SLIDES = ${imageSlides.length};

    // TOAST
    let toastTimer = null;
    function showToast(msg) {
      const toast = document.getElementById('toastEl');
      if (!toast) return;
      toast.innerHTML = '<span>\u{1F6D2}</span> <span>' + msg + '</span>';
      toast.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }

    // CAROUSEL SLIDER
    let currentSlide = 0;
    function goToSlide(idx) {
      currentSlide = idx;
      const slides = document.querySelectorAll('.slide-img-box');
      const dots = document.querySelectorAll('.dot');
      slides.forEach((s, i) => {
        s.classList.toggle('active', i === idx);
      });
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === idx);
      });
      const counter = document.getElementById('slideCounter');
      if (counter) counter.innerText = (idx + 1) + ' / ' + TOTAL_SLIDES;
    }

    // DESCRIPTION TOGGLE
    let isExpanded = false;
    function toggleDescription() {
      isExpanded = !isExpanded;
      const text = document.getElementById('descText');
      const btn = document.getElementById('descBtn');
      const btnText = document.getElementById('descBtnText');
      if (text && btn && btnText) {
        if (isExpanded) {
          text.classList.remove('desc-clamped');
          btn.classList.add('expanded');
          btnText.innerText = 'R\xE9duire la description';
        } else {
          text.classList.add('desc-clamped');
          btn.classList.remove('expanded');
          btnText.innerText = 'D\xE9rouler la description';
        }
      }
    }

    // PANIER (LOCALSTORAGE SYNCHRONIS\xC9 AVEC L'APP)
    function getCart() {
      try {
        const raw = localStorage.getItem('unifolder_cart');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }
    function updateCartUI() {
      const cart = getCart();
      const inCart = cart.includes(PRODUCT_ID);
      const btn = document.getElementById('cartBtn');
      const btnText = document.getElementById('cartBtnText');
      if (btn && btnText) {
        if (inCart) {
          btn.classList.add('added');
          btnText.innerText = 'Ajout\xE9 \u2713';
        } else {
          btn.classList.remove('added');
          btnText.innerText = 'Ajouter au panier';
        }
      }
    }
    function handleCartToggle() {
      let cart = getCart();
      if (cart.includes(PRODUCT_ID)) {
        cart = cart.filter(id => id !== PRODUCT_ID);
        showToast('"' + PRODUCT_TITLE + '" retir\xE9 du panier');
      } else {
        cart.push(PRODUCT_ID);
        showToast('"' + PRODUCT_TITLE + '" ajout\xE9 au panier !');
      }
      try {
        localStorage.setItem('unifolder_cart', JSON.stringify(cart));
      } catch (e) {}
      updateCartUI();
    }

    // ABONNEMENT VENDEUR
    function getFollowedSellers() {
      try {
        const raw = localStorage.getItem('unifolder_followed_sellers');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }
    function updateFollowUI() {
      const list = getFollowedSellers();
      const isSub = list.includes(SELLER_ID);
      const btn = document.getElementById('followBtn');
      const text = document.getElementById('followBtnText');
      if (btn && text) {
        if (isSub) {
          btn.classList.add('active');
          text.innerText = 'Abonn\xE9 \u2713';
        } else {
          btn.classList.remove('active');
          text.innerText = "S'abonner";
        }
      }
    }
    function handleFollowToggle() {
      let list = getFollowedSellers();
      if (list.includes(SELLER_ID)) {
        list = list.filter(id => id !== SELLER_ID);
        showToast('D\xE9sabonn\xE9 de ' + SELLER_NAME);
      } else {
        list.push(SELLER_ID);
        showToast('Vous \xEAtes maintenant abonn\xE9 \xE0 ' + SELLER_NAME + ' !');
      }
      try {
        localStorage.setItem('unifolder_followed_sellers', JSON.stringify(list));
      } catch (e) {}
      updateFollowUI();
    }

    // PARTAGE LIEN
    function handleShare() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(window.location.href).then(() => {
          showToast('Lien du produit copi\xE9 dans le presse-papier !');
        }).catch(() => {
          fallbackShare();
        });
      } else {
        fallbackShare();
      }
    }
    function fallbackShare() {
      showToast('Lien : ' + window.location.href);
    }

    // Initialisation
    updateCartUI();
    updateFollowUI();
  <\/script>
</body>
</html>`;
}
__name(renderProductSharePageHtml, "renderProductSharePageHtml");
var isSchemaInitialized = true;
var isEmailVerifTableInitialized = true;
var isReferralsTableInitialized = false;
var isNotificationsTableInitialized = false;
var isAppLinksTableInitialized = false;
function generateReferralCode() {
  return Math.floor(1e8 + Math.random() * 9e8).toString();
}
__name(generateReferralCode, "generateReferralCode");
async function ensureAppLinksTable(db) {
  if (isAppLinksTableInitialized || !db)
    return;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS app_external_links (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    await db.prepare(`
      INSERT OR IGNORE INTO app_external_links (id, name, url, description)
      VALUES 
        ('youtube', 'Tutoriels YouTube', 'https://www.youtube.com', 'Comprendre StudyCloud'),
        ('telegram', 'Service client officiel', 'https://t.me/+QtRhdlTsMHxjODk0', 'Support Telegram officiel'),
        ('whatsapp', 'Groupe WhatsApp', 'https://chat.whatsapp.com/IPOnCB9rJhn7JECrNY20Ea', 'Groupe WhatsApp / Aide')
    `).run();
    isAppLinksTableInitialized = true;
  } catch (err) {
    console.error("[StudyCloud App Links Table Init Error]", err);
  }
}
__name(ensureAppLinksTable, "ensureAppLinksTable");
async function ensureNotificationsTable(db) {
  if (isNotificationsTableInitialized || !db)
    return;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        item_ref TEXT,
        type TEXT DEFAULT 'general',
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    try {
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)").run();
    } catch (e) {
    }
    try {
      await db.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at)").run();
    } catch (e) {
    }
    try {
      await db.prepare("DELETE FROM notifications WHERE created_at < datetime('now', '-21 days')").run();
    } catch (e) {
    }
    isNotificationsTableInitialized = true;
  } catch (err) {
    console.error("[StudyCloud Notifications Table Init Error]", err);
  }
}
__name(ensureNotificationsTable, "ensureNotificationsTable");
async function createNotification(db, userId, title, description, itemRef, type = "general") {
  if (!db || !userId)
    return;
  try {
    await ensureNotificationsTable(db);
    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO notifications (id, user_id, title, description, item_ref, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).bind(id, userId, title, description, itemRef || null, type).run();
  } catch (err) {
    console.error("[Create Notification Error]", err);
  }
}
__name(createNotification, "createNotification");
async function ensureReferralsTables(db) {
  if (isReferralsTableInitialized || !db)
    return;
  try {
    try {
      await db.prepare("ALTER TABLE users ADD COLUMN referral_code TEXT").run();
    } catch (e) {
    }
    try {
      await db.prepare("ALTER TABLE users ADD COLUMN referred_by TEXT").run();
    } catch (e) {
    }
    try {
      await db.prepare("ALTER TABLE users ADD COLUMN referrals_count INTEGER DEFAULT 0").run();
    } catch (e) {
    }
    try {
      await db.prepare("ALTER TABLE users ADD COLUMN ad_free_days_earned INTEGER DEFAULT 0").run();
    } catch (e) {
    }
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
      { count: 10, extra_days: 3650, label: "10 personnes promues : +3650 jours bonus" }
    ]);
    const defaultRules = JSON.stringify([
      "Chaque fois que vous promouvez avec succ\xE8s une personne qui s'inscrit, vous b\xE9n\xE9ficierez de 5 jours de publicit\xE9 gratuite, qui peuvent \xEAtre accumul\xE9s de mani\xE8re illimit\xE9e~",
      "Un total de 3 personnes inscrites par vous, et 5 jours suppl\xE9mentaires de publicit\xE9 gratuite offerts~",
      "Un total de 5 personnes inscrites par vous, et 10 jours suppl\xE9mentaires de publicit\xE9 gratuite offerts~",
      "Un total de 7 personnes inscrites par vous, et 15 jours suppl\xE9mentaires de publicit\xE9 gratuite offerts~",
      "Un total de 10 personnes inscrites par vous, et 3650 jours suppl\xE9mentaires de publicit\xE9 gratuite offerts~"
    ]);
    await db.prepare(`
      INSERT OR IGNORE INTO referral_rewards_config (id, days_per_referral, milestones_json, rules_text_json, updated_at)
      VALUES ('default', 5, ?, ?, CURRENT_TIMESTAMP)
    `).bind(defaultMilestones, defaultRules).run();
    isReferralsTableInitialized = true;
  } catch (e) {
    console.error("[StudyCloud Referrals Init Error]", e);
  }
}
__name(ensureReferralsTables, "ensureReferralsTables");
async function processReferralAttribution(db, referralCode, newUserId, newUserName, newUserEmail) {
  if (!db || !referralCode || !newUserId)
    return;
  try {
    await ensureReferralsTables(db);
    const cleanCode = String(referralCode).trim();
    if (!cleanCode)
      return;
    const referrer = await db.prepare(
      "SELECT id, name, referral_code, referrals_count, ad_free_days_earned FROM users WHERE referral_code = ?"
    ).bind(cleanCode).first();
    if (!referrer || referrer.id === newUserId) {
      return;
    }
    const alreadyReferred = await db.prepare(
      "SELECT id FROM referrals WHERE referred_user_id = ?"
    ).bind(newUserId).first();
    if (alreadyReferred) {
      return;
    }
    const configRow = await db.prepare(
      "SELECT days_per_referral, milestones_json FROM referral_rewards_config WHERE id = 'default'"
    ).first();
    const baseDays = Number(configRow?.days_per_referral) || 5;
    let extraMilestoneDays = 0;
    const currentCount = Number(referrer.referrals_count || 0) + 1;
    if (configRow?.milestones_json) {
      try {
        const milestones = JSON.parse(configRow.milestones_json);
        if (Array.isArray(milestones)) {
          const match = milestones.find((m) => Number(m.count) === currentCount);
          if (match && Number(match.extra_days)) {
            extraMilestoneDays = Number(match.extra_days);
          }
        }
      } catch (e) {
      }
    }
    const totalRewardDays = baseDays + extraMilestoneDays;
    const referralId = generateId();
    await db.prepare(`
      INSERT INTO referrals (id, referrer_id, referred_user_id, referred_user_name, referred_user_email, reward_days, created_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(referralId, referrer.id, newUserId, newUserName, newUserEmail, totalRewardDays).run();
    await db.prepare(`
      UPDATE users SET
        referrals_count = COALESCE(referrals_count, 0) + 1,
        ad_free_days_earned = COALESCE(ad_free_days_earned, 0) + ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(totalRewardDays, referrer.id).run();
    await db.prepare(`
      UPDATE users SET
        referred_by = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(referrer.referral_code, newUserId).run();
    await createNotification(
      db,
      referrer.id,
      "Nouveau parrainage valid\xE9 !",
      `F\xE9licitations ! ${newUserName || "Un nouvel \xE9tudiant"} s'est inscrit avec succ\xE8s gr\xE2ce \xE0 votre lien d'invitation. Vous avez remport\xE9 +${totalRewardDays} jours de visibilit\xE9 gratuite !`,
      `Invitation r\xE9ussie \u2022 Code ${cleanCode}`,
      "referral"
    );
    console.log(`[Parrainage R\xE9ussi] Utilisateur ${newUserId} parrain\xE9 par ${referrer.name} (${cleanCode}) : +${totalRewardDays} jours.`);
  } catch (err) {
    console.error("[Erreur Attribution Parrainage]", err);
  }
}
__name(processReferralAttribution, "processReferralAttribution");

async function ensureStorageTables(db) {
  if (!db) return;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS storage_global_config (
        id TEXT PRIMARY KEY,
        default_welcome_total_mb REAL DEFAULT 30.0,
        default_welcome_r2_mb REAL DEFAULT 10.0,
        default_welcome_d1_mb REAL DEFAULT 20.0,
        cost_per_gb_eur REAL DEFAULT 0.015,
        notes TEXT DEFAULT '',
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    try { await db.prepare("ALTER TABLE storage_global_config ADD COLUMN default_welcome_total_mb REAL DEFAULT 30.0").run(); } catch (e) {}

    await db.prepare(`
      INSERT OR IGNORE INTO storage_global_config (id, default_welcome_total_mb, default_welcome_r2_mb, default_welcome_d1_mb, cost_per_gb_eur)
      VALUES ('global', 30.0, 10.0, 20.0, 0.015)
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
        contact_phone TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        admin_notes TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const upgradeCols = [
      "ALTER TABLE storage_upgrade_requests ADD COLUMN user_name TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN user_phone TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN user_email TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN price_paid REAL DEFAULT 0",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN currency TEXT DEFAULT 'FCFA'",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN payment_method TEXT DEFAULT 'Wave / Orange / Moov / MTN'",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN payment_reference TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN receipt_image_url TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN receipt_r2_key TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN admin_notes TEXT DEFAULT ''",
      "ALTER TABLE storage_upgrade_requests ADD COLUMN notes TEXT DEFAULT ''",
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
      "ALTER TABLE storage_upgrade_requests ADD COLUMN request_type TEXT DEFAULT 'upgrade'"
    ];
    for (const sql of upgradeCols) {
      try { await db.prepare(sql).run(); } catch (e) {}
    }

    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS user_requests_history_purge (
          id TEXT PRIMARY KEY,
          request_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          requested_at TEXT NOT NULL,
          purge_effective_at TEXT NOT NULL,
          status TEXT DEFAULT 'pending_purge',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch (e) {}

    try {
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
          orange_number TEXT DEFAULT '+225 07 00 00 00 00',
          orange_name TEXT DEFAULT 'Orange Money Côte d''Ivoire',
          mtn_number TEXT DEFAULT '+225 05 00 00 00 00',
          mtn_name TEXT DEFAULT 'MTN Mobile Money CI',
          moov_number TEXT DEFAULT '+225 01 00 00 00 00',
          moov_name TEXT DEFAULT 'Moov Money Côte d''Ivoire',
          payment_instructions TEXT DEFAULT 'Transférez le montant exact sur l''un de nos numéros officiels ci-dessous, puis importez une capture claire de votre reçu avec la date et le numéro de transaction.',
          about_text TEXT DEFAULT 'Plateforme d''apprentissage et de gestion documentaire intelligente pour étudiants et professionnels.',
          notes TEXT DEFAULT '',
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch (e) {}

    const companyCols = [
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
    for (const sql of companyCols) {
      try { await db.prepare(sql).run(); } catch (e) {}
    }

    try {
      await db.prepare(`
        INSERT OR IGNORE INTO company_profile (id, company_name, activity, location, address, phone_contact, phone_whatsapp, email, website, wave_number, wave_name, orange_number, orange_name, mtn_number, mtn_name, moov_number, moov_name, payment_instructions, about_text)
        VALUES ('main', 'DKD Technologies', 'Technologies & Éducation Numérique', 'Abidjan, Côte d''Ivoire', 'Abidjan, Côte d''Ivoire', '+225 0101007978', '+225 0101007978', 'contact@dkd-technologies.com', 'https://studycloud.dkd-technologies.com', '+225 07 00 00 00 00', 'StudyCloud CI', '+225 07 00 00 00 00', 'Orange Money Côte d''Ivoire', '+225 05 00 00 00 00', 'MTN Mobile Money CI', '+225 01 00 00 00 00', 'Moov Money Côte d''Ivoire', 'Transférez le montant exact sur l''un de nos numéros officiels ci-dessous, puis importez une capture claire de votre reçu avec la date et le numéro de transaction.', 'Plateforme d''apprentissage et de gestion documentaire intelligente pour étudiants et professionnels.')
      `).run();

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
        grace_period_days INTEGER DEFAULT 5,
        payment_due_date TEXT DEFAULT '',
        is_blocked INTEGER DEFAULT 0,
        cancelled_at TEXT DEFAULT '',
        previous_storage_mb REAL DEFAULT 0,
        cancel_reason TEXT DEFAULT '',
        request_id TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const subCols = [
      "ALTER TABLE user_subscriptions ADD COLUMN grace_period_days INTEGER DEFAULT 5",
      "ALTER TABLE user_subscriptions ADD COLUMN payment_due_date TEXT DEFAULT ''",
      "ALTER TABLE user_subscriptions ADD COLUMN is_blocked INTEGER DEFAULT 0",
      "ALTER TABLE user_subscriptions ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"
    ];
    for (const sql of subCols) {
      try { await db.prepare(sql).run(); } catch (e) {}
    }

    // 6. Table 'user_purchases_history' pour l'historique complet des achats et paiements
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Insérer les plans de stockage par défaut si vides
    try {
      const countStorage = await db.prepare("SELECT COUNT(*) as c FROM storage_subscription_plans").first();
      if (!countStorage || countStorage.c === 0) {
        await db.prepare(`
          INSERT INTO storage_subscription_plans (id, name, badge, description, storage_amount, storage_mb, price, primary_currency, currencies_enabled, currency_conversions, yearly_price, yearly_discount_pct, features, is_auto_billing, is_active, sort_order)
          VALUES 
          ('storage_plan_basique', 'Basique', '', 'Pour les particuliers et petites équipes qui débutent.', '10 Go', 10240, 10, 'USD', '["USD","XOF","EUR"]', '{"USD":10,"XOF":6500,"EUR":9.2}', 90, 10, '[{"text":"10 Go de stockage cloud haute vitesse","enabled":true},{"text":"Messagerie d''équipe et partage de fichiers","enabled":true},{"text":"Fil d''activité et aperçu des projets","enabled":true},{"text":"Accès mobile et bureau","enabled":true},{"text":"Support par e-mail","enabled":true}]', 0, 1, 1),
          ('storage_plan_pro', 'Pro', 'Populaire', 'Pour les professionnels et étudiants avancés.', '50 Go', 51200, 32, 'USD', '["USD","XOF","EUR"]', '{"USD":32,"XOF":20000,"EUR":29.5}', 290, 10, '[{"text":"50 Go de stockage cloud haute vitesse","enabled":true},{"text":"Support prioritaire 24/7","enabled":true},{"text":"Analyses avancées et rapports","enabled":true},{"text":"Collaboration en temps réel illimitée","enabled":true},{"text":"Domaine personnalisé","enabled":true}]', 0, 1, 2),
          ('storage_plan_entreprise', 'Entreprise', '', 'Pour les universités, laboratoires et grandes équipes.', '200 Go', 204800, 89, 'USD', '["USD","XOF","EUR"]', '{"USD":89,"XOF":55000,"EUR":82}', 790, 10, '[{"text":"200 Go de stockage cloud haute vitesse","enabled":true},{"text":"Sécurité renforcée et SSO","enabled":true},{"text":"Gestionnaire de compte dédié","enabled":true},{"text":"SLA garanti 99.9%","enabled":true},{"text":"Formations personnalisées","enabled":true},{"text":"Facturation centralisée","enabled":true}]', 0, 1, 3)
        `).run();
      }
    } catch (e) {}

    // Insérer les plans IA par défaut si vides
    try {
      const countAi = await db.prepare("SELECT COUNT(*) as c FROM ai_subscription_plans").first();
      if (!countAi || countAi.c === 0) {
        await db.prepare(`
          INSERT INTO ai_subscription_plans (id, name, badge, description, credits_or_words, credits_count, price, primary_currency, currencies_enabled, currency_conversions, yearly_price, yearly_discount_pct, features, is_auto_billing, is_active, sort_order)
          VALUES 
          ('ai_plan_basique', 'IA Basique', '', 'Pour réviser, poser des questions et comprendre rapidement vos cours au quotidien.', '100 000 mots IA', 100000, 10, 'USD', '["USD","XOF","EUR"]', '{"USD":10,"XOF":6500,"EUR":9.2}', 90, 10, '[{"text":"100 000 mots IA générés par mois","enabled":true},{"text":"Résumés automatiques de cours et PDF","enabled":true},{"text":"Création instantanée de cartes mémoires (Flashcards)","enabled":true},{"text":"Aide aux devoirs et explications pas à pas","enabled":true},{"text":"Support par e-mail","enabled":true}]', 0, 1, 1),
          ('ai_plan_pro', 'IA Pro Étudiant', 'Populaire', 'L''assistant d''apprentissage complet pour exceller et réussir tous vos examens.', '1 000 000 mots IA', 1000000, 32, 'USD', '["USD","XOF","EUR"]', '{"USD":32,"XOF":20000,"EUR":29.5}', 290, 10, '[{"text":"1 000 000 mots IA avec priorité maximale","enabled":true},{"text":"Génération de Quiz interactifs & examens blancs","enabled":true},{"text":"Synthèse vocale & lecture audio de vos fiches","enabled":true},{"text":"Analyse intelligente de documents scannés et photos","enabled":true},{"text":"Support prioritaire 24/7","enabled":true}]', 0, 1, 2),
          ('ai_plan_master', 'IA Recherche & Master', '', 'Pour les doctorants, thèses, mémoires volumineux et laboratoires universitaires.', 'Mots IA illimités', 10000000, 89, 'USD', '["USD","XOF","EUR"]', '{"USD":89,"XOF":55000,"EUR":82}', 790, 10, '[{"text":"Mots IA illimités avec accès modèles avancés","enabled":true},{"text":"Traitement prioritaire ultra-rapide","enabled":true},{"text":"Export complet des synthèses & fiches en PDF/Word","enabled":true},{"text":"Analyse illimitée de livres et thèses entières","enabled":true},{"text":"Accès API assistante pour vos projets de recherche","enabled":true}]', 0, 1, 3)
        `).run();
      }
    } catch (e) {}
  } catch (err) {
    console.warn("[ensureStorageTables Warn]", err);
  }
}
__name(ensureStorageTables, "ensureStorageTables");

async function getUserStorageDetails(db, userId) {
  if (!db || !userId) return null;
  await ensureStorageTables(db);

  // 1. Quota de l'utilisateur
  let quotaRow = null;
  try {
    quotaRow = await db.prepare("SELECT * FROM user_storage_quotas WHERE user_id = ?").bind(userId).first();
  } catch (e) {}

  let globalConfig = null;
  try {
    globalConfig = await db.prepare("SELECT * FROM storage_global_config WHERE id = 'global'").first();
  } catch (e) {}

  const defaultWelcomeTotal = Number(globalConfig?.default_welcome_total_mb ?? ((globalConfig?.default_welcome_r2_mb ?? 10) + (globalConfig?.default_welcome_d1_mb ?? 20)));

  if (!quotaRow) {
    try {
      await db.prepare(`
        INSERT OR IGNORE INTO user_storage_quotas (user_id, welcome_total_mb, welcome_r2_mb, welcome_d1_mb, paid_total_mb, paid_r2_mb, paid_d1_mb, plan_name)
        VALUES (?, ?, 10.0, 20.0, 0.0, 0.0, 0.0, 'gratuit')
      `).bind(userId, defaultWelcomeTotal).run();
    } catch (e) {}
    quotaRow = {
      welcome_total_mb: defaultWelcomeTotal,
      welcome_r2_mb: 10.0,
      welcome_d1_mb: 20.0,
      paid_total_mb: 0.0,
      paid_r2_mb: 0.0,
      paid_d1_mb: 0.0,
      bonus_total_mb: 0.0,
      bonus_r2_mb: 0.0,
      bonus_d1_mb: 0.0,
      plan_name: 'gratuit'
    };
  }

  // Quotas calculés sous forme d'un réservoir unique partagé (pas de limiteur séparé R2/D1)
  const welcomeTotalMb = parseFloat(Number(quotaRow?.welcome_total_mb ?? ((quotaRow?.welcome_r2_mb ?? 10) + (quotaRow?.welcome_d1_mb ?? 20))).toFixed(2));
  const paidTotalMb = parseFloat(Number(quotaRow?.paid_total_mb ?? ((quotaRow?.paid_r2_mb ?? 0) + (quotaRow?.paid_d1_mb ?? 0))).toFixed(2));
  const bonusTotalMb = parseFloat(Number(quotaRow?.bonus_total_mb ?? ((quotaRow?.bonus_r2_mb ?? 0) + (quotaRow?.bonus_d1_mb ?? 0))).toFixed(2));

  const totalAllowedMb = parseFloat((welcomeTotalMb + paidTotalMb + bonusTotalMb).toFixed(2));
  const totalAllowedBytes = totalAllowedMb * 1024 * 1024;

  // 2. Fichiers personnels de cours et documents
  let personalFilesBytes = 0;
  let personalFilesCount = 0;
  try {
    const fRes = await db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(size), 0) AS s FROM files WHERE user_id = ?").bind(userId).first();
    personalFilesCount = Number(fRes?.c || 0);
    personalFilesBytes = Number(fRes?.s || 0);
  } catch (e) {}

  // Fichiers des liens et dossiers partagés personnels
  let shareFilesBytes = 0;
  let shareFilesCount = 0;
  try {
    const sfRes = await db.prepare(`
      SELECT COUNT(sff.id) AS c, COALESCE(SUM(sff.size), 0) AS s 
      FROM shared_folders sf 
      JOIN shared_folder_files sff ON sff.shared_folder_id = sf.id 
      WHERE sf.user_id = ?
    `).bind(userId).first();
    shareFilesCount = Number(sfRes?.c || 0);
    shareFilesBytes = Number(sfRes?.s || 0);
  } catch (e) {}

  // Profil et icône/avatar personnalisé
  let avatarBytes = 0;
  let userProfileRow = null;
  try {
    userProfileRow = await db.prepare("SELECT avatar_url, name, email, phone, school, filiere FROM users WHERE id = ?").bind(userId).first();
    if (userProfileRow?.avatar_url && (userProfileRow.avatar_url.includes('avatars/') || userProfileRow.avatar_url.startsWith('http') || userProfileRow.avatar_url.startsWith('data:image'))) {
      avatarBytes = 85000;
    }
  } catch (e) {}

  // Boutique : Produits publiés pour les commandes (images R2 & données écrites D1)
  let shopProductsCount = 0;
  let shopTextBytes = 0;
  let shopImagesBytes = 0;
  try {
    const pRes = await db.prepare(`
      SELECT COUNT(*) AS c, 
             COALESCE(SUM(LENGTH(title) + LENGTH(COALESCE(description, '')) + LENGTH(COALESCE(price, '')) + LENGTH(COALESCE(image_urls_json, ''))), 0) AS tb 
      FROM products WHERE seller_id = ?
    `).bind(userId).first();
    shopProductsCount = Number(pRes?.c || 0);
    shopTextBytes = Number(pRes?.tb || 0);
    shopImagesBytes = shopProductsCount * 120000;
  } catch (e) {}

  // Total Stockage Documents & Fichiers (R2 Net Facturé)
  // STRICTEMENT EXCLUS : published_documents (ressources publiques de la bibliothèque)
  const filesUsedBytes = personalFilesBytes + shareFilesBytes + avatarBytes + shopImagesBytes;
  const filesUsedCount = personalFilesCount + shareFilesCount + (avatarBytes > 0 ? 1 : 0) + shopProductsCount;

  // 3. Données & fiches d'étude (D1 Net Facturé)
  // Strictement sans compter les éléments exemptés (ressources partagées publiques, vues, téléchargements, compteurs mots)
  let notesBytes = 0, notesCount = 0;
  try {
    const nRes = await db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(title) + LENGTH(COALESCE(content, ''))), 0) AS s FROM notes WHERE user_id = ?").bind(userId).first();
    notesCount = Number(nRes?.c || 0);
    notesBytes = Number(nRes?.s || 0);
  } catch (e) {}

  let matieresBytes = 0, matieresCount = 0;
  try {
    const mRes = await db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(name)), 0) AS s FROM matieres WHERE user_id = ?").bind(userId).first();
    matieresCount = Number(mRes?.c || 0);
    matieresBytes = Number(mRes?.s || 0);
  } catch (e) {}

  let scheduleBytes = 0, scheduleCount = 0;
  try {
    const sRes = await db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(subject) + LENGTH(COALESCE(room, '')) + LENGTH(COALESCE(note_or_teacher, ''))), 0) AS s FROM schedule_slots WHERE user_id = ?").bind(userId).first();
    scheduleCount = Number(sRes?.c || 0);
    scheduleBytes = Number(sRes?.s || 0);
  } catch (e) {}

  let gradesBytes = 0, gradesCount = 0;
  try {
    const gRes = await db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(subject_name) + LENGTH(COALESCE(sub_grades_json, ''))), 0) AS s FROM grades WHERE user_id = ?").bind(userId).first();
    gradesCount = Number(gRes?.c || 0);
    gradesBytes = Number(gRes?.s || 0);
  } catch (e) {}

  let aiContentsBytes = 0, aiContentsCount = 0;
  try {
    const aiRes = await db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(title) + LENGTH(COALESCE(content_json, ''))), 0) AS s FROM ai_generated_contents WHERE user_id = ?").bind(userId).first();
    aiContentsCount = Number(aiRes?.c || 0);
    aiContentsBytes = Number(aiRes?.s || 0);
  } catch (e) {}

  let aiWorkspaceBytes = 0, aiWorkspaceCount = 0;
  try {
    const wsRes = await db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(message_text) + LENGTH(COALESCE(attached_file_content, '')) + LENGTH(COALESCE(user_notes, ''))), 0) AS s FROM user_ai_workspace WHERE user_id = ?").bind(userId).first();
    aiWorkspaceCount = Number(wsRes?.c || 0);
    aiWorkspaceBytes = Number(wsRes?.s || 0);
  } catch (e) {}

  let calendarBytes = 0, calendarCount = 0;
  try {
    const calRes = await db.prepare("SELECT COUNT(*) AS c, COALESCE(SUM(LENGTH(title)), 0) AS s FROM calendar_events WHERE user_id = ?").bind(userId).first();
    calendarCount = Number(calRes?.c || 0);
    calendarBytes = Number(calRes?.s || 0);
  } catch (e) {}

  // Horloge & sessions d'étude
  let studySessionsCount = 0;
  try {
    const ssRes = await db.prepare("SELECT COUNT(*) AS c FROM study_sessions WHERE user_id = ?").bind(userId).first();
    studySessionsCount = Number(ssRes?.c || 0);
  } catch (e) {}

  // Discussions & messages IA (inclus dans le stockage payant de données de l'utilisateur)
  let chatBytes = 0, chatMessagesCount = 0;
  try {
    const chatRes = await db.prepare(`
      SELECT COUNT(m.id) AS mc, COALESCE(SUM(LENGTH(m.content) + LENGTH(COALESCE(m.metadata, ''))), 0) AS mb
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.user_id = ?
    `).bind(userId).first();
    chatMessagesCount = Number(chatRes?.mc || 0);
    chatBytes = Number(chatRes?.mb || 0);
  } catch (e) {}

  // Profil
  const profileBytes = (userProfileRow?.name?.length || 0) + (userProfileRow?.email?.length || 0) + (userProfileRow?.school?.length || 0) + (userProfileRow?.filiere?.length || 0) + (userProfileRow?.phone?.length || 0) + 120;

  const personalDataTextBytes = notesBytes + matieresBytes + scheduleBytes + gradesBytes + aiContentsBytes + aiWorkspaceBytes + calendarBytes + chatBytes + shopTextBytes + profileBytes;
  const personalDataRows = notesCount + matieresCount + scheduleCount + gradesCount + aiContentsCount + aiWorkspaceCount + calendarCount + chatMessagesCount + shopProductsCount + studySessionsCount + 1;
  const dataUsedBytes = personalDataTextBytes + (personalDataRows * 128);

  // 4. Nombre de mots de l'utilisateur (exempté du quota de stockage)
  let wordsUsed = 0;
  try {
    const wRes = await db.prepare("SELECT COALESCE(SUM(word_count), 0) AS total_words FROM user_word_counts WHERE user_id = ?").bind(userId).first();
    wordsUsed = Number(wRes?.total_words || 0);
  } catch (e) {}

  const wordsMax = 50000 + (paidTotalMb > 0 ? Math.round(paidTotalMb * 5000) : 0);
  const wordsRemaining = Math.max(0, wordsMax - wordsUsed);
  const wordsPercentage = wordsMax > 0 ? Math.min(100, parseFloat(((wordsUsed / wordsMax) * 100).toFixed(1))) : 0;

  // Calculs totaux
  const totalUsedBytes = filesUsedBytes + dataUsedBytes;

  const totalUsedMb = parseFloat((totalUsedBytes / (1024 * 1024)).toFixed(3));
  const filesUsedMb = parseFloat((filesUsedBytes / (1024 * 1024)).toFixed(3));
  const dataUsedMb = parseFloat((dataUsedBytes / (1024 * 1024)).toFixed(3));

  const totalPercentage = totalAllowedMb > 0 ? Math.min(100, parseFloat(((totalUsedMb / totalAllowedMb) * 100).toFixed(1))) : 0;

  return {
    userId,
    planName: quotaRow?.plan_name || 'gratuit',
    welcomeStorage: {
      totalMb: welcomeTotalMb,
      filesMb: Math.round(welcomeTotalMb / 3),
      dataMb: Math.round((welcomeTotalMb * 2) / 3),
      formatted: `${welcomeTotalMb} Mo`
    },
    paidStorage: {
      totalMb: paidTotalMb,
      filesMb: Math.round(paidTotalMb / 2),
      dataMb: Math.round(paidTotalMb / 2),
      formatted: `${paidTotalMb} Mo`
    },
    bonusStorage: {
      totalMb: bonusTotalMb,
      formatted: `${bonusTotalMb} Mo`
    },
    totalAllowedMb,
    totalAllowedFormatted: totalAllowedMb >= 1024 ? `${(totalAllowedMb / 1024).toFixed(1)} Go` : `${totalAllowedMb} Mo`,
    totalUsedBytes,
    totalUsedMb,
    totalUsedFormatted: formatBytes(totalUsedBytes),
    totalPercentage,
    filesStorage: {
      name: "Stockage Documents & Fichiers",
      subtitle: "Cours personnels, polycopiés, documents PDF et supports d'étude déposés",
      count: filesUsedCount,
      usedBytes: filesUsedBytes,
      usedMb: filesUsedMb,
      usedFormatted: formatBytes(filesUsedBytes),
      allowedMb: totalAllowedMb,
      allowedFormatted: totalAllowedMb >= 1024 ? `${(totalAllowedMb / 1024).toFixed(1)} Go` : `${totalAllowedMb} Mo`,
      percentage: totalPercentage,
      freeNote: "Ressources publiques de la bibliothèque offertes sans décompte"
    },
    dataStorage: {
      name: "Espace Données & Fiches d'Étude",
      subtitle: "Fiches mémoires, notes de révision, devoirs, emploi du temps et contenus d'apprentissage",
      count: personalDataRows,
      usedBytes: dataUsedBytes,
      usedMb: dataUsedMb,
      usedFormatted: formatBytes(dataUsedBytes),
      allowedMb: totalAllowedMb,
      allowedFormatted: totalAllowedMb >= 1024 ? `${(totalAllowedMb / 1024).toFixed(1)} Go` : `${totalAllowedMb} Mo`,
      percentage: totalPercentage,
      freeNote: "Messages IA décomptés du quota global partagé"
    },
    wordsUsage: {
      name: "Mots d'étude & Génération IA",
      subtitle: "Résumés de cours, quiz interactifs, cartes mémoires et explications",
      usedWords: wordsUsed,
      maxWords: wordsMax,
      remainingWords: wordsRemaining,
      percentage: wordsPercentage,
      formatted: `${wordsUsed.toLocaleString('fr-FR')} / ${wordsMax.toLocaleString('fr-FR')} mots`
    }
  };
}
__name(getUserStorageDetails, "getUserStorageDetails");

var src_default = {
  async fetch(request, rawEnv) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get("Origin") || "*";
    const dbInstance = rawEnv["MON_D1-STUDYCLOUD"] || rawEnv.MON_D1_STUDYCLOUD || rawEnv.DB;
    const bucketInstance = rawEnv["MON_R2-STUDYCLOUD"] || rawEnv.MON_R2_STUDYCLOUD || rawEnv.BUCKET;
    const env = {
      ...rawEnv,
      DB: dbInstance,
      BUCKET: bucketInstance
    };
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }
    try {
      let sanitizeUser2 = function(user) {
        if (!user)
          return null;
        const { password_hash: _ph, security_answer_1_hash: _s1, security_answer_2_hash: _s2, ...rest } = user;
        return {
          ...rest,
          has_password: Boolean(user.password_hash && typeof user.password_hash === "string" && user.password_hash.trim().length > 0),
          has_security_questions: Boolean(
            user.security_answer_1_hash && typeof user.security_answer_1_hash === "string" && user.security_answer_1_hash.trim().length > 0 && user.security_answer_2_hash && typeof user.security_answer_2_hash === "string" && user.security_answer_2_hash.trim().length > 0
          )
        };
      }, generateId3 = function() {
        return crypto.randomUUID();
      }, isValidEmail2 = function(email) {
        if (!email || typeof email !== "string")
          return false;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email.trim());
      }, validatePasswordFormat2 = function(pwd) {
        if (!pwd || typeof pwd !== "string")
          return { valid: false, error: "Mot de passe requis" };
        if (pwd.length < 6)
          return { valid: false, error: "Le mot de passe doit comporter au moins 6 caract\xE8res" };
        if (!/[a-zA-Z]/.test(pwd))
          return { valid: false, error: "Le mot de passe doit contenir des lettres" };
        if (!/[0-9]/.test(pwd))
          return { valid: false, error: "Le mot de passe doit contenir des chiffres" };
        if (!/[^a-zA-Z0-9]/.test(pwd))
          return { valid: false, error: "Le mot de passe doit contenir au moins un caract\xE8re sp\xE9cial (ex: @, #, $, !, etc.)" };
        return { valid: true };
      }, generateEmailAvatar2 = function(email, name) {
        const cleanEmail = (email || "").trim().toLowerCase();
        const cleanName = (name || "").trim();
        let initials = "SC";
        if (cleanName) {
          const parts = cleanName.split(/\s+/).filter(Boolean);
          initials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : cleanName.slice(0, 2).toUpperCase();
        } else if (cleanEmail) {
          const local = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
          initials = local.slice(0, 2).toUpperCase() || "SC";
        }
        const colors = ["#EA580C", "#0284C7", "#059669", "#7C3AED", "#D97706", "#0D9488", "#DC2626", "#4F46E5"];
        let hash = 0;
        const seed = cleanEmail || cleanName || "studycloud";
        for (let i = 0; i < seed.length; i++)
          hash = seed.charCodeAt(i) + ((hash << 5) - hash);
        const color = colors[Math.abs(hash) % colors.length];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><rect width="128" height="128" rx="28" fill="${color}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${initials.length > 1 ? "48" : "58"}" font-weight="700">${initials}</text></svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      }, htmlResponse2 = function(title, message, success, userId, token) {
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
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: ${success ? "#4ade80" : "#f87171"}; font-weight: 800; }
        p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.5rem; }
        .btn {
            display: inline-block;
            width: 100%;
            box-sizing: border-box;
            background: ${success ? "#EA580C" : "#475569"};
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
        .btn:hover { background: ${success ? "#c2410c" : "#334155"}; }
        .hint { margin-top: 1rem; font-size: 0.8rem; color: #64748b; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">${success ? "\u2705" : "\u274C"}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        <button type="button" id="returnApp" class="btn">${success ? "Retourner \xE0 l'application" : "Fermer cette fen\xEAtre"}</button>
        <p class="hint" id="hintText">${success ? "Votre appareil a valid\xE9 votre confirmation. Vous pouvez fermer cet onglet." : "Vous pouvez fermer cet onglet et demander un nouveau lien."}</p>
    </div>

    <script>
        const isSuccess = ${success};
        const userId = "${userId || ""}";
        const authToken = "${token || ""}";

        // 1. Stockage local standardis\xE9 pour synchroniser l'application sur le m\xEAme appareil
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

        // 2. Tentative de d\xE9clenchement d'un deep link si l'app mobile est install\xE9e et fermeture
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
    <\/script>
</body>
</html>`;
        return new Response(html, {
          headers: { "Content-Type": "text/html;charset=UTF-8", ...corsHeaders("*") },
          status: success ? 200 : 400
        });
      };
      var sanitizeUser = sanitizeUser2, generateId2 = generateId3, isValidEmail = isValidEmail2, validatePasswordFormat = validatePasswordFormat2, generateEmailAvatar = generateEmailAvatar2, htmlResponse = htmlResponse2;
      __name(sanitizeUser2, "sanitizeUser");
      __name(generateId3, "generateId");
      __name(isValidEmail2, "isValidEmail");
      __name(validatePasswordFormat2, "validatePasswordFormat");
      __name(generateEmailAvatar2, "generateEmailAvatar");
      __name(htmlResponse2, "htmlResponse");
      if (path === "/api/assets/dna-logo.png" || path === "/assets/dna-logo.png") {
        const pngBytes = Uint8Array.from(atob(DNA_LOGO_PNG_B64), (c) => c.charCodeAt(0));
        return new Response(pngBytes, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      if (path === "/api/assets/dna-logo.svg" || path === "/assets/dna-logo.svg") {
        return new Response(DNA_LOGO_SVG, {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      if (path === "/" || path === "/api/health") {
        return jsonResponse({
          success: true,
          service: "StudyCloud Cloudflare Worker API (Auth, Files & Database)",
          status: "online",
          database: dbInstance ? "Connect\xE9 (D1: d1-studycloud)" : "Non li\xE9",
          storage: bucketInstance ? "Connect\xE9 (R2: r2-studycloud)" : "Non li\xE9",
          ai: "G\xE9r\xE9 exclusivement par le Worker IA d\xE9di\xE9 (studycloud-ai.delmaskouassidibi.workers.dev)",
          bindings: {
            d1: !!dbInstance,
            r2: !!bucketInstance
          },
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }, 200, origin);
      }
      if ((path.startsWith("/invite/") || path.startsWith("/join/") || path.startsWith("/p/")) && method === "GET") {
        const refCode = path.split("/")[2];
        const cleanRef = refCode ? decodeURIComponent(refCode).trim() : "";
        const targetUrl = `https://studycloud.dkd-technologies.com/?ref=${encodeURIComponent(cleanRef)}#register`;
        return Response.redirect(targetUrl, 302);
      }
      if ((path.startsWith("/s/") || path.startsWith("/share/") && !path.startsWith("/share/product/") || path.startsWith("/d/")) && method === "GET") {
        const code = path.split("/")[2];
        if (code && env.DB) {
          if (!isSchemaInitialized)
            await ensureDatabaseSchema(env.DB);
          const cleanCode = decodeURIComponent(code).trim();
          const folder = await env.DB.prepare(
            "SELECT * FROM shared_folders WHERE share_code = ? OR id = ? LIMIT 1"
          ).bind(cleanCode, cleanCode).first();
          if (folder) {
            await env.DB.prepare("UPDATE shared_folders SET views_count = views_count + 1 WHERE id = ?").bind(folder.id).run();
            const { results: files } = await env.DB.prepare(
              "SELECT * FROM shared_folder_files WHERE shared_folder_id = ?"
            ).bind(folder.id).all();
            const html = renderShareLandingHtml(folder, files || [], url.origin);
            return new Response(html, {
              status: 200,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-cache",
                "Set-Cookie": `sc_share_last=${encodeURIComponent(cleanCode)}; Path=/; SameSite=Lax; HttpOnly; Max-Age=86400`,
                ...corsHeaders(origin)
              }
            });
          } else {
            const notFoundHtml = renderShareNotFoundHtml(cleanCode, url.origin);
            return new Response(notFoundHtml, {
              status: 404,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                ...corsHeaders(origin)
              }
            });
          }
        }
      }
      if ((path === "/share" || path === "/s" || path === "/share/" || path === "/s/") && method === "GET") {
        const cookieHeader = request.headers.get("Cookie") || "";
        const cookieMatch = cookieHeader.match(/(?:^|;\s*)sc_share_last=([^;]+)/);
        if (cookieMatch && cookieMatch[1] && env.DB) {
          if (!isSchemaInitialized)
            await ensureDatabaseSchema(env.DB);
          const savedCode = decodeURIComponent(cookieMatch[1]).trim();
          const folder = await env.DB.prepare(
            "SELECT * FROM shared_folders WHERE share_code = ? OR id = ? LIMIT 1"
          ).bind(savedCode, savedCode).first();
          if (folder) {
            const { results: files } = await env.DB.prepare(
              "SELECT * FROM shared_folder_files WHERE shared_folder_id = ?"
            ).bind(folder.id).all();
            const html = renderShareLandingHtml(folder, files || [], url.origin);
            return new Response(html, {
              status: 200,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-cache",
                ...corsHeaders(origin)
              }
            });
          }
        }
        return Response.redirect("https://studycloud.dkd-technologies.com", 302);
      }
      if (path.startsWith("/api/") && !path.startsWith("/api/storage/") && !env.DB) {
        return errorResponse(
          "Base de donn\xE9es D1 non accessible. Veuillez lier votre base 'd1-studycloud' avec le nom de variable 'MON_D1_STUDYCLOUD' (ou 'MON_D1-STUDYCLOUD') dans Cloudflare Workers > Settings > Variables and Bindings > D1 Database Bindings.",
          503,
          origin
        );
      }
      if (path.startsWith("/api/storage/") && !env.BUCKET) {
        return errorResponse(
          "Stockage R2 non accessible. Veuillez lier votre bucket 'r2-studycloud' avec le nom de variable 'MON_R2_STUDYCLOUD' (ou 'MON_R2-STUDYCLOUD') dans Cloudflare Workers > Settings > Variables and Bindings > R2 Bucket Bindings.",
          503,
          origin
        );
      }
      const JWT_SECRET = rawEnv.JWT_SECRET || "studycloud-jwt-secret-key";
      const GOOGLE_CLIENT_ID = rawEnv.GOOGLE_CLIENT_ID || "";
      const GOOGLE_CLIENT_SECRET = rawEnv.GOOGLE_CLIENT_SECRET || "";
      const RESEND_API_KEY = rawEnv.RESEND_API_KEY || "";
      async function hashPassword(password) {
        const encoder = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iterations = 1e4;
        const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
        const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
        const hashArray = Array.from(new Uint8Array(bits));
        const saltArray = Array.from(salt);
        return btoa(JSON.stringify({ salt: saltArray, hash: hashArray, iter: iterations }));
      }
      __name(hashPassword, "hashPassword");
      async function verifyPassword(password, stored) {
        try {
          const encoder = new TextEncoder();
          const parsed = JSON.parse(atob(stored));
          const { salt: saltArray, hash: hashArray } = parsed;
          const iterations = parsed.iter || 1e5;
          const salt = new Uint8Array(saltArray);
          const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
          const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
          const newHash = Array.from(new Uint8Array(bits));
          return JSON.stringify(newHash) === JSON.stringify(hashArray);
        } catch {
          return false;
        }
      }
      __name(verifyPassword, "verifyPassword");
      async function createJWT(payload, expiresInHours = 720) {
        const encoder = new TextEncoder();
        const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const exp = Math.floor(Date.now() / 1e3) + expiresInHours * 3600;
        const body = btoa(JSON.stringify({ ...payload, exp, iat: Math.floor(Date.now() / 1e3) }));
        const key = await crypto.subtle.importKey("raw", encoder.encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
        const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
        return `${header}.${body}.${sig}`;
      }
      __name(createJWT, "createJWT");
      async function verifyJWT(token) {
        try {
          const encoder = new TextEncoder();
          const [header, body, sig] = token.split(".");
          const key = await crypto.subtle.importKey("raw", encoder.encode(JWT_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
          const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
          const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(`${header}.${body}`));
          if (!valid)
            return null;
          const payload = JSON.parse(atob(body));
          if (payload.exp < Math.floor(Date.now() / 1e3))
            return null;
          return payload;
        } catch {
          return null;
        }
      }
      __name(verifyJWT, "verifyJWT");
      async function hashToken(token) {
        const encoder = new TextEncoder();
        const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
        return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
      __name(hashToken, "hashToken");
      async function getAuthUser(req) {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token)
          return null;
        const payload = await verifyJWT(token);
        if (!payload?.userId)
          return null;
        return payload;
      }
      __name(getAuthUser, "getAuthUser");
      async function ensureEmailVerificationsTable(_db, _force = false) {
        return;
      }
      __name(ensureEmailVerificationsTable, "ensureEmailVerificationsTable");
      async function sendConfirmationEmail(toEmail, name, token, appOrigin = "https://studycloud.dkd-technologies.com", isLogin = false) {
        try {
          const workerBaseUrl = "https://api-worker.dkd-technologies.com";
          const confirmUrl = `${workerBaseUrl}/verify?token=${encodeURIComponent(token)}`;
          const publicAssetOrigin = "https://studycloud.dkd-technologies.com";
          const subject = isLogin ? "\u{1F510} Confirmez votre connexion - StudyCloud" : "\u{1F393} Confirmez votre adresse email - StudyCloud";
          const title = isLogin ? "Autorisation de connexion" : "Bienvenue sur StudyCloud !";
          const description = isLogin ? "Une tentative de connexion a \xE9t\xE9 initi\xE9e pour votre compte. Cliquez sur le bouton ci-dessous pour autoriser cette connexion en toute s\xE9curit\xE9 :" : "Votre inscription est presque termin\xE9e ! Veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :";
          const buttonText = isLogin ? "Autoriser la connexion" : "Confirmer mon adresse email";
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "StudyCloud <noreply@dkd-technologies.com>",
              to: [toEmail],
              reply_to: "StudyClouddkd@gmail.com",
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
                StudyCloud par <strong>DKD Technologies</strong> \xB7 Abidjan, C\xF4te d'Ivoire
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
            })
          });
        } catch (e) {
          console.error("Failed to send confirmation email via Resend:", e);
        }
      }
      __name(sendConfirmationEmail, "sendConfirmationEmail");
      async function sendWelcomeEmail(toEmail, name, isStudent = true, school = "", filiere = "", appOrigin = "https://studycloud.dkd-technologies.com") {
        try {
          const cleanOrigin = (appOrigin || "https://studycloud.dkd-technologies.com").replace(/\/+$/, "");
          const subject = isStudent ? "\u{1F389} Bienvenue sur StudyCloud - Votre espace est pr\xEAt !" : "Bienvenue sur StudyCloud - Votre espace professionnel est pr\xEAt";
          const title = isStudent ? "\u{1F389} Bienvenue sur StudyCloud !" : "Bienvenue sur StudyCloud";
          const heading = isStudent ? `Bienvenue sur StudyCloud, ${name} ! \u{1F393}` : `Bienvenue sur StudyCloud, ${name}`;
          const introText = isStudent ? `Toute l'\xE9quipe de <strong>StudyCloud</strong> a le plaisir de vous accueillir ! Votre profil a \xE9t\xE9 configur\xE9 avec succ\xE8s et votre espace de travail num\xE9rique personnel est imm\xE9diatement op\xE9rationnel.` : `Toute l'\xE9quipe de <strong>StudyCloud</strong> et de <strong>DKD Technologies</strong> a le plaisir de vous accueillir. Votre profil professionnel est configur\xE9 avec succ\xE8s et votre environnement de travail num\xE9rique s\xE9curis\xE9 est pr\xEAt \xE0 l'emploi.`;
          const featuresHeader = isStudent ? "\u{1F680} Ce que vous pouvez faire d\xE8s maintenant :" : "Vos fonctionnalit\xE9s professionnelles d\xE8s aujourd'hui :";
          const featuresList = isStudent ? `
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  \u{1F4DA} <strong>Gestion & Stockage de cours :</strong> Centralisez vos documents, fiches et polycopi\xE9s en lieu s\xFBr.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  \u{1F916} <strong>Assistant IA Delmas :</strong> Posez des questions sur vos cours, g\xE9n\xE9rez des r\xE9sum\xE9s et pr\xE9parez vos examens plus vite.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  \u{1F465} <strong>Partage & Collaboration :</strong> \xC9changez des dossiers de r\xE9vision avec d'autres \xE9tudiants ou coll\xE8gues.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  \u{1F512} <strong>S\xE9curit\xE9 DKD :</strong> Vos fichiers et donn\xE9es sont prot\xE9g\xE9s et sauvegard\xE9s de mani\xE8re isol\xE9e.
                </p>
            ` : `
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Gestion documentaire & archivage s\xE9curis\xE9 :</strong> Classez, organisez et retrouvez instantan\xE9ment l'ensemble de vos dossiers, contrats, fiches de travail et pr\xE9sentations professionnelles.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Assistant d'Analyse IA Delmas :</strong> Analysez des rapports volumineux, synth\xE9tisez vos documents de travail, pr\xE9parez vos r\xE9unions et r\xE9digez des synth\xE8ses pr\xE9cises en un instant.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Partage & collaboration ma\xEEtris\xE9e :</strong> Transmettez facilement des dossiers et documents \xE0 vos collaborateurs, partenaires et clients avec des acc\xE8s fiables et prot\xE9g\xE9s.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Productivit\xE9 continue & mode hors-ligne :</strong> Consultez vos fichiers essentiels m\xEAme en d\xE9placement sans acc\xE8s Internet, avec synchronisation automatique d\xE8s votre reconnexion.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Organisation & suivi d'activit\xE9s :</strong> Structurez vos projets, planifiez vos sessions de travail et g\xE9rez vos priorit\xE9s au quotidien gr\xE2ce aux outils int\xE9gr\xE9s.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;color:#334155;line-height:1.6;">
                  <strong style="color:#0f172a;">Confidentialit\xE9 & s\xE9curit\xE9 DKD Technologies :</strong> Vos actifs professionnels et donn\xE9es sensibles sont strictement isol\xE9s, chiffr\xE9s et sauvegard\xE9s selon les standards de s\xE9curit\xE9 DKD.
                </p>
            `;
          const ctaText = isStudent ? "Acc\xE9der \xE0 mon tableau de bord StudyCloud &rarr;" : "Acc\xE9der \xE0 mon espace professionnel StudyCloud &rarr;";
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "StudyCloud <noreply@dkd-technologies.com>",
              to: [toEmail],
              reply_to: "StudyClouddkd@gmail.com",
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
                Besoin d'aide ou d'assistance ? Notre support est \xE0 votre disposition \xE0 <a href="mailto:StudyClouddkd@gmail.com" style="color:#2563EB;text-decoration:none;font-weight:600;">StudyClouddkd@gmail.com</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                StudyCloud con\xE7u et propuls\xE9 par <strong>DKD Technologies</strong> \xB7 Abidjan, C\xF4te d'Ivoire<br>
                Vous recevez cet email suite \xE0 la validation de votre profil sur StudyCloud.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
            })
          });
        } catch (e) {
          console.error("Failed to send welcome email via Resend:", e);
        }
      }
      __name(sendWelcomeEmail, "sendWelcomeEmail");
      async function sendPasswordResetEmail(toEmail, name, code, appOrigin = "https://studycloud.dkd-technologies.com") {
        try {
          const cleanOrigin = (appOrigin || "https://studycloud.dkd-technologies.com").replace(/\/+$/, "");
          const publicAssetOrigin = !cleanOrigin || cleanOrigin.includes("localhost") || !cleanOrigin.startsWith("https://") ? "https://studycloud.dkd-technologies.com" : cleanOrigin;
          const subject = "\u{1F511} R\xE9cup\xE9ration de votre mot de passe - StudyCloud";
          const title = "Code de r\xE9initialisation \u{1F511}";
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "StudyCloud <noreply@dkd-technologies.com>",
              to: [toEmail],
              reply_to: "StudyClouddkd@gmail.com",
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
                Bonjour <strong>${name || "\xC9tudiant"}</strong>,
              </p>

              <p style="margin:0 0 24px 0;color:#475569;font-size:14px;line-height:1.6;">
                Vous avez demand\xE9 la r\xE9initialisation de votre mot de passe StudyCloud apr\xE8s avoir valid\xE9 vos questions de s\xE9curit\xE9. Utilisez le code secret ci-dessous pour d\xE9finir votre nouveau mot de passe :
              </p>

              <div style="text-align:center;margin:32px 0;">
                <div style="display:inline-block;padding:18px 36px;background:#fff7ed;border:2px dashed #EA580C;border-radius:18px;">
                  <span style="font-family:monospace;font-size:34px;font-weight:900;color:#EA580C;letter-spacing:8px;">${code}</span>
                </div>
              </div>

              <div style="border-left:3px solid #f97316;padding-left:12px;margin:24px 0;">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
                  \u23F3 <strong>Validit\xE9 :</strong> Ce code expire dans 1 heure.<br>
                  \u{1F512} <strong>S\xE9curit\xE9 :</strong> Ne communiquez jamais ce code \xE0 un tiers. Si vous n'\xEAtes pas \xE0 l'origine de cette demande, vous pouvez ignorer cet email en toute s\xE9curit\xE9.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                StudyCloud par <strong>DKD Technologies</strong> \xB7 Abidjan, C\xF4te d'Ivoire
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
            })
          });
        } catch (e) {
          console.error("Failed to send password reset email via Resend:", e);
        }
      }
      __name(sendPasswordResetEmail, "sendPasswordResetEmail");
      async function ensureDatabaseSchema(_db, _force = false) {
        return;
      }
      __name(ensureDatabaseSchema, "ensureDatabaseSchema");
      const ensurePasswordResetsTable = ensureDatabaseSchema;
      async function ensureUsersTableUniqueIndex(_db) {
        return;
      }
      __name(ensureUsersTableUniqueIndex, "ensureUsersTableUniqueIndex");
      async function deleteUserCompletely(db, userId, email, bucket) {
        if (!db || !userId)
          return;
        if (bucket) {
          try {
            const filesRes = await db.prepare("SELECT r2_key FROM files WHERE user_id = ? AND r2_key IS NOT NULL").bind(userId).all();
            if (filesRes?.results) {
              for (const f of filesRes.results) {
                if (f.r2_key)
                  await bucket.delete(f.r2_key).catch(() => {
                  });
              }
            }
          } catch (e) {
          }
          try {
            const pubDocs = await db.prepare("SELECT r2_key FROM published_documents WHERE user_id = ? AND r2_key IS NOT NULL").bind(userId).all();
            if (pubDocs?.results) {
              for (const d of pubDocs.results) {
                if (d.r2_key)
                  await bucket.delete(d.r2_key).catch(() => {
                  });
              }
            }
          } catch (e) {
          }
          try {
            const sfFiles = await db.prepare("SELECT r2_key FROM shared_folder_files WHERE shared_folder_id IN (SELECT id FROM shared_folders WHERE user_id = ?) AND r2_key IS NOT NULL").bind(userId).all();
            if (sfFiles?.results) {
              for (const sf of sfFiles.results) {
                if (sf.r2_key)
                  await bucket.delete(sf.r2_key).catch(() => {
                  });
              }
            }
          } catch (e) {
          }
        }
        const tablesWithUserId = [
          "email_verifications",
          "auth_sessions",
          "user_preferences",
          "password_resets",
          "matieres",
          "files",
          "shared_folders",
          "shared_links",
          "schedule_config",
          "schedules",
          "schedule_slots",
          "grades",
          "notes",
          "calendar_events",
          "alarms",
          "products",
          "cart_items",
          "shop_profiles",
          "shop_items",
          "seller_follows",
          "user_product_interactions",
          "support_tickets",
          "notifications",
          "chat_messages",
          "user_document_interactions",
          "published_documents",
          "referral_rewards",
          "push_subscriptions"
        ];
        for (const table of tablesWithUserId) {
          try {
            await db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(userId).run();
          } catch (e) {
          }
        }
        try {
          await db.prepare("DELETE FROM seller_follows WHERE seller_id = ?").bind(userId).run();
        } catch (e) {
        }
        try {
          await db.prepare("DELETE FROM shared_folder_files WHERE shared_folder_id IN (SELECT id FROM shared_folders WHERE user_id = ?)").bind(userId).run();
        } catch (e) {
        }
        try {
          await db.prepare("DELETE FROM shared_folder_downloads WHERE shared_folder_id IN (SELECT id FROM shared_folders WHERE user_id = ?)").bind(userId).run();
        } catch (e) {
        }
        try {
          await db.prepare("DELETE FROM referrals WHERE referrer_id = ? OR referee_id = ?").bind(userId, userId).run();
        } catch (e) {
        }
        if (email) {
          const cleanEmail = email.toLowerCase().trim();
          try {
            await db.prepare("DELETE FROM email_verifications WHERE LOWER(TRIM(email)) = ?").bind(cleanEmail).run();
          } catch (e) {
          }
          try {
            await db.prepare("DELETE FROM password_resets WHERE LOWER(TRIM(email)) = ?").bind(cleanEmail).run();
          } catch (e) {
          }
        }
        try {
          await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
          if (email) {
            await db.prepare("DELETE FROM users WHERE LOWER(TRIM(email)) = ?").bind(email.toLowerCase().trim()).run();
          }
          console.log(`[StudyCloud Delete Account] Compte et toutes les donn\xE9es supprim\xE9s pour l'utilisateur : ${userId} (${email || ""})`);
        } catch (e) {
          console.error(`[StudyCloud Delete Account] Erreur suppression users ${userId}:`, e);
        }
      }
      __name(deleteUserCompletely, "deleteUserCompletely");
      async function cleanupExpiredUnfinishedAccounts(db) {
        return;
      }
      __name(cleanupExpiredUnfinishedAccounts, "cleanupExpiredUnfinishedAccounts");
      if (path.startsWith("/api/auth/") && path !== "/api/auth/check-verification-status" && !isSchemaInitialized) {
        await ensureDatabaseSchema(env.DB);
        await ensureEmailVerificationsTable(env.DB);
      }
      if (path === "/api/auth/register" && method === "POST") {
        if (!isEmailVerifTableInitialized)
          await ensureEmailVerificationsTable(env.DB);
        if (!isSchemaInitialized)
          await ensureDatabaseSchema(env.DB);
        const body = await request.json();
        const {
          name,
          email,
          password,
          referralCode,
          securityQuestion1,
          securityAnswer1,
          securityQuestion2,
          securityAnswer2
        } = body;
        if (!name || !email || !password)
          return errorResponse("Nom, email et mot de passe requis", 400, origin);
        if (!isValidEmail2(email))
          return errorResponse("Format d'adresse email invalide (ex: exemple@gmail.com)", 400, origin);
        const pwdCheck = validatePasswordFormat2(password);
        if (!pwdCheck.valid)
          return errorResponse(pwdCheck.error || "Mot de passe non conforme", 400, origin);
        const cleanEmail = email.toLowerCase().trim();
        const existing = await env.DB.prepare("SELECT * FROM users WHERE LOWER(TRIM(email)) = ?").bind(cleanEmail).first();
        const q1 = securityQuestion1 || "Quelle est votre ville de naissance ?";
        const q2 = securityQuestion2 || "Quel est le pr\xE9nom de votre m\xE8re ?";
        const answer1Hash = securityAnswer1 ? await hashToken(securityAnswer1.slice(0, 30).toLowerCase().trim()) : "";
        const answer2Hash = securityAnswer2 ? await hashToken(securityAnswer2.slice(0, 30).toLowerCase().trim()) : "";
        if (existing) {
          if (existing.is_onboarded === 1 || existing.email_verified === 1 || existing.password_hash) {
            return jsonResponse({
              success: false,
              alreadyRegistered: true,
              code: "ACCOUNT_ALREADY_EXISTS",
              error: "Cet e-mail est d\xE9j\xE0 associ\xE9 \xE0 un compte. Veuillez vous connecter ou utiliser une autre adresse"
            }, 409, origin);
          }
          try {
            await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(existing.id).run();
          } catch (e) {
          }
        }
        const userId = generateId3();
        const passwordHash = await hashPassword(password);
        const registrationPayload = JSON.stringify({
          userId,
          name: name.trim(),
          email: cleanEmail,
          passwordHash,
          referralCode: referralCode ? String(referralCode).trim() : "",
          securityQuestion1: q1,
          securityAnswer1Hash: answer1Hash,
          securityQuestion2: q2,
          securityAnswer2Hash: answer2Hash
        });
        const verificationToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        const expiresAt = new Date(Date.now() + 70 * 1e3).toISOString();
        await env.DB.prepare("DELETE FROM email_verifications WHERE LOWER(TRIM(email)) = ?").bind(cleanEmail).run();
        try {
          await env.DB.prepare(`
            INSERT INTO email_verifications (id, user_id, email, token, payload, resend_count, block_stage, last_sent_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, ?)
          `).bind(generateId3(), userId, cleanEmail, verificationToken, registrationPayload, expiresAt).run();
        } catch (insertErr) {
          if (String(insertErr).includes("FOREIGN KEY") || String(insertErr).includes("SQLITE_CONSTRAINT")) {
            try {
              await env.DB.prepare("DROP TABLE IF EXISTS email_verifications").run();
            } catch (e) {
            }
            await ensureEmailVerificationsTable(env.DB);
            await env.DB.prepare(`
              INSERT INTO email_verifications (id, user_id, email, token, payload, resend_count, block_stage, last_sent_at, expires_at)
              VALUES (?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, ?)
            `).bind(generateId3(), userId, cleanEmail, verificationToken, registrationPayload, expiresAt).run();
          } else {
            throw insertErr;
          }
        }
        const clientOrigin = request.headers.get("Origin") || "https://studycloud.dkd-technologies.com";
        await sendConfirmationEmail(cleanEmail, name.trim(), verificationToken, clientOrigin, false);
        return jsonResponse({
          success: true,
          requiresVerification: true,
          email: cleanEmail,
          resendCount: 0,
          maxCount: 5,
          nextAllowedAt: new Date(Date.now() + 70 * 1e3).toISOString(),
          message: "Un email de confirmation vous a \xE9t\xE9 envoy\xE9."
        }, 201, origin);
      }
      if (path === "/api/auth/resend-verification" && method === "POST") {
        const body = await request.json();
        const { email } = body;
        if (!email)
          return errorResponse("Email requis", 400, origin);
        if (!isValidEmail2(email))
          return errorResponse("Format d'adresse email invalide (ex: exemple@gmail.com)", 400, origin);
        const cleanEmail = email.toLowerCase().trim();
        const user = await env.DB.prepare("SELECT id, name, email_verified FROM users WHERE LOWER(TRIM(email)) = ?").bind(cleanEmail).first();
        const verif = await env.DB.prepare("SELECT * FROM email_verifications WHERE LOWER(TRIM(email)) = ? ORDER BY created_at DESC LIMIT 1").bind(cleanEmail).first();
        if (!user && !verif)
          return errorResponse("Aucune demande en attente pour cet email", 404, origin);
        let userName = user?.name || "\xC9tudiant";
        const isLoginFlow = user ? user.email_verified === 1 : false;
        if (verif?.payload) {
          try {
            const p = JSON.parse(verif.payload);
            if (p.name)
              userName = p.name;
          } catch (e) {
          }
        }
        const now = Date.now();
        const RESEND_COOLDOWN_MS = 70 * 1e3;
        const TOKEN_EXPIRY_MS = 70 * 1e3;
        if (verif) {
          if (verif.blocked_until) {
            const blockedTime = new Date(verif.blocked_until).getTime();
            if (blockedTime > now) {
              const remainingMs = blockedTime - now;
              const remainingMin = Math.ceil(remainingMs / 6e4);
              const stage = verif.block_stage || 1;
              const stageHours2 = stage === 1 ? 1 : stage === 2 ? 3 : 24;
              return jsonResponse({
                success: false,
                error: `Quota de 5 renvois atteint. Votre compte est suspendu (${stageHours2}h). Veuillez patienter ${remainingMin} minute(s).`,
                isBlocked: true,
                blockedUntil: verif.blocked_until,
                blockStage: stage,
                resendCount: verif.resend_count || 5,
                maxCount: 5,
                remainingMs
              }, 429, origin);
            }
          }
          if (verif.last_sent_at) {
            const lastSentTime = new Date(verif.last_sent_at).getTime();
            const elapsed = now - lastSentTime;
            if (elapsed < RESEND_COOLDOWN_MS) {
              const remainingSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1e3);
              return jsonResponse({
                success: false,
                error: `Veuillez patienter ${remainingSec} seconde(s) avant de renvoyer l'email.`,
                isCooldown: true,
                nextAllowedAt: new Date(lastSentTime + RESEND_COOLDOWN_MS).toISOString(),
                remainingMs: RESEND_COOLDOWN_MS - elapsed,
                resendCount: verif.resend_count ?? 0,
                maxCount: 5
              }, 429, origin);
            }
          }
          let currentCount = verif.resend_count ?? 0;
          let currentStage = verif.block_stage || 0;
          if (verif.blocked_until && new Date(verif.blocked_until).getTime() <= now) {
            currentCount = 0;
          }
          const newCount = currentCount + 1;
          let blockedUntil = null;
          let isNowBlocked = false;
          let nextStage = currentStage;
          if (newCount >= 5) {
            isNowBlocked = true;
            nextStage = currentStage % 3 + 1;
            let blockDurationMs = 1 * 3600 * 1e3;
            if (nextStage === 2) {
              blockDurationMs = 3 * 3600 * 1e3;
            } else if (nextStage === 3) {
              blockDurationMs = 24 * 3600 * 1e3;
            }
            blockedUntil = new Date(now + blockDurationMs).toISOString();
          }
          const newToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
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
          const clientOrigin = request.headers.get("Origin") || "https://studycloud.dkd-technologies.com";
          await sendConfirmationEmail(cleanEmail, userName, newToken, clientOrigin, isLoginFlow);
          const stageHours = nextStage === 1 ? 1 : nextStage === 2 ? 3 : 24;
          return jsonResponse({
            success: true,
            message: isNowBlocked ? `Email envoy\xE9. Quota de 5 renvois atteint. Prochain renvoi bloqu\xE9 pendant ${stageHours} heure${stageHours > 1 ? "s" : ""}.` : "Email de confirmation renvoy\xE9 !",
            resendCount: newCount,
            maxCount: 5,
            isBlocked: isNowBlocked,
            blockedUntil,
            blockStage: nextStage,
            nextAllowedAt
          }, 200, origin);
        } else {
          const newToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
          const newExpiresAt = new Date(now + TOKEN_EXPIRY_MS).toISOString();
          await env.DB.prepare(`
            INSERT INTO email_verifications (id, user_id, email, token, resend_count, block_stage, last_sent_at, expires_at)
            VALUES (?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP, ?)
          `).bind(generateId3(), user?.id || generateId3(), cleanEmail, newToken, newExpiresAt).run();
          const clientOrigin = request.headers.get("Origin") || "https://studycloud.dkd-technologies.com";
          await sendConfirmationEmail(cleanEmail, userName, newToken, clientOrigin, isLoginFlow);
          return jsonResponse({
            success: true,
            message: "Email de confirmation renvoy\xE9 !",
            resendCount: 1,
            maxCount: 5,
            isBlocked: false,
            blockedUntil: null,
            blockStage: 0,
            nextAllowedAt: new Date(now + RESEND_COOLDOWN_MS).toISOString()
          }, 200, origin);
        }
      }
      if (path === "/api/auth/check-verification-status" && method === "GET") {
        const emailParam = url.searchParams.get("email");
        const userIdParam = url.searchParams.get("userId");
        if (!emailParam && !userIdParam)
          return errorResponse("Email ou userId requis", 400, origin);
        const cleanEmail = (emailParam || "").toLowerCase().trim();
        let latestVerif = null;
        try {
          latestVerif = await env.DB.prepare(`
            SELECT * FROM email_verifications
            WHERE LOWER(TRIM(email)) = ? OR user_id = ?
            ORDER BY created_at DESC, rowid DESC LIMIT 1
          `).bind(cleanEmail, userIdParam || "").first();
        } catch (e) {
          try {
            latestVerif = await env.DB.prepare(`
              SELECT * FROM email_verifications
              WHERE LOWER(TRIM(email)) = ?
              ORDER BY rowid DESC LIMIT 1
            `).bind(cleanEmail).first();
          } catch (e2) {
          }
        }
        if (!latestVerif) {
          return jsonResponse({
            success: true,
            confirmed: false,
            clicked: false,
            resendCount: 0,
            maxCount: 5,
            isBlocked: false,
            blockedUntil: null,
            blockStage: 0
          }, 200, origin);
        }
        const isConfirmed = Number(latestVerif.confirmed) === 1 || Number(latestVerif.used) === 1 || Number(latestVerif.clicked) === 1;
        if (isConfirmed) {
          const user = await env.DB.prepare("SELECT * FROM users WHERE id = ? OR LOWER(TRIM(email)) = ?").bind(latestVerif.user_id, cleanEmail).first();
          if (user) {
            let jwtToken = latestVerif?.confirmed_jwt;
            if (!jwtToken) {
              jwtToken = await createJWT({ userId: user.id, email: user.email, name: user.name });
              const tokenHash = await hashToken(jwtToken);
              const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1e3).toISOString();
              await env.DB.prepare("INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").bind(generateId3(), user.id, tokenHash, expiresAt).run();
              try {
                await env.DB.prepare("UPDATE email_verifications SET confirmed_jwt = ? WHERE id = ?").bind(jwtToken, latestVerif.id).run();
              } catch (e3) {
              }
            }
            return jsonResponse({
              success: true,
              confirmed: true,
              clicked: true,
              token: jwtToken,
              user: sanitizeUser2(user)
            }, 200, origin);
          }
        }
        const now = Date.now();
        let isBlocked = false;
        let blockedUntil = latestVerif?.blocked_until || null;
        let resendCount = typeof latestVerif?.resend_count === "number" ? latestVerif.resend_count : 0;
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
          blockStage
        }, 200, origin);
      }
      if ((path === "/verify" || path === "/api/auth/verify-email") && method === "GET") {
        const token = url.searchParams.get("token");
        if (!token) {
          return htmlResponse2("Lien invalide", "Le lien de confirmation est incomplet.", false);
        }
        try {
          const record = await env.DB.prepare(
            "SELECT * FROM email_verifications WHERE token = ?"
          ).bind(token).first();
          if (!record) {
            return htmlResponse2("Lien expir\xE9 ou d\xE9j\xE0 utilis\xE9", "Ce lien ne peut plus \xEAtre utilis\xE9 ou n'est plus valide. Veuillez vous connecter.", false);
          }
          if (Number(record.used) === 1 || Number(record.confirmed) === 1) {
            let jwtToken2 = record.confirmed_jwt;
            if (!jwtToken2) {
              const user2 = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(record.user_id).first();
              if (user2) {
                jwtToken2 = await createJWT({ userId: user2.id, email: user2.email, name: user2.name });
              }
            }
            return htmlResponse2(
              "Confirmation d\xE9j\xE0 effectu\xE9e !",
              "Ce lien ne peut plus \xEAtre r\xE9utilis\xE9 car la confirmation a d\xE9j\xE0 \xE9t\xE9 valid\xE9e. Cet e-mail est d\xE9j\xE0 associ\xE9 \xE0 un compte. Vous pouvez retourner dans l'application pour vous connecter.",
              true,
              record.user_id,
              jwtToken2
            );
          }
          const now = Date.now();
          const expiresAt = record.expires_at ? new Date(record.expires_at).getTime() : 0;
          const GRACE_PERIOD_MS = 15 * 1e3;
          if (expiresAt > 0 && now > expiresAt + GRACE_PERIOD_MS) {
            return htmlResponse2("Lien expir\xE9", "Ce lien ne peut plus \xEAtre utilis\xE9 car son d\xE9lai de validit\xE9 (70 secondes) a expir\xE9. Veuillez r\xE9clamer un nouveau lien depuis l'application.", false);
          }
          let user = null;
          let isNewUser = false;
          if (record.payload) {
            try {
              const userData = JSON.parse(record.payload);
              const userId = userData.userId || record.user_id || generateId3();
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
                userData.name || "\xC9tudiant",
                userData.email,
                userData.passwordHash || "",
                userData.securityQuestion1 || "Quelle est votre ville de naissance ?",
                userData.securityAnswer1Hash || "",
                userData.securityQuestion2 || "Quel est le pr\xE9nom de votre m\xE8re ?",
                userData.securityAnswer2Hash || ""
              ).run();
              await env.DB.prepare("INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)").bind(userId).run();
              user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
              isNewUser = true;
              let newRefCode = generateReferralCode();
              try {
                let codeExists = await env.DB.prepare("SELECT id FROM users WHERE referral_code = ?").bind(newRefCode).first();
                while (codeExists) {
                  newRefCode = generateReferralCode();
                  codeExists = await env.DB.prepare("SELECT id FROM users WHERE referral_code = ?").bind(newRefCode).first();
                }
                await env.DB.prepare("UPDATE users SET referral_code = COALESCE(referral_code, ?) WHERE id = ?").bind(newRefCode, userId).run();
              } catch (e) {
              }
              if (userData.referralCode) {
                await processReferralAttribution(env.DB, userData.referralCode, userId, userData.name || "\xC9tudiant", userData.email);
              }
            } catch (e) {
              console.error("Erreur cr\xE9ation utilisateur depuis payload:", e);
            }
          }
          if (!user && record.user_id) {
            user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(record.user_id).first();
          }
          if (!user) {
            return htmlResponse2("Compte introuvable", "Le compte associ\xE9 \xE0 ce lien de confirmation est introuvable.", false);
          }
          await env.DB.prepare(`
            UPDATE users SET
              email_verified = 1,
              status = 'verified',
              last_active_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(user.id).run();
          await createNotification(
            env.DB,
            user.id,
            "Bienvenue sur StudyCloud !",
            "F\xE9licitations ! Votre compte StudyCloud a \xE9t\xE9 activ\xE9 avec succ\xE8s. Vous pouvez d\xE9sormais stocker, classer et prot\xE9ger vos cours, devoirs et documents universitaires en toute s\xE9r\xE9nit\xE9.",
            "Guide de d\xE9marrage StudyCloud",
            "welcome"
          );
          const jwtToken = await createJWT({ userId: user.id, email: user.email, name: user.name });
          const tokenHash = await hashToken(jwtToken);
          const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1e3).toISOString();
          await env.DB.prepare("INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").bind(generateId3(), user.id, tokenHash, sessionExpiresAt).run();
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
            } catch (e2) {
            }
          }
          if (isNewUser) {
            const isUserStudent = user.is_student === 1 || user.is_student === null && user.school && user.school !== "Particulier / Professionnel" && user.school !== "Professionnel / Particulier";
            sendWelcomeEmail(
              user.email,
              user.name || (isUserStudent ? "\xC9tudiant" : "Membre"),
              Boolean(isUserStudent),
              user.school || "",
              user.filiere || "",
              origin !== "*" ? origin : "https://studycloud.dkd-technologies.com"
            );
          }
          const accept = request.headers.get("Accept") || "";
          if (accept.includes("application/json") && !accept.includes("text/html")) {
            const safeUser = sanitizeUser2(user);
            return jsonResponse({
              success: true,
              message: "Adresse email confirm\xE9e avec succ\xE8s !",
              token: jwtToken,
              user: safeUser
            }, 200, origin);
          }
          return htmlResponse2(
            "Confirmation r\xE9ussie !",
            "Votre compte a \xE9t\xE9 confirm\xE9 avec succ\xE8s. Vous pouvez maintenant retourner dans l'application pour continuer.",
            true,
            user.id,
            jwtToken
          );
        } catch (err) {
          console.error("Erreur verify:", err);
          return htmlResponse2("Erreur serveur", "Une erreur technique est survenue lors de la validation.", false);
        }
      }
      if (path === "/api/auth/login" && method === "POST") {
        await ensureUsersTableUniqueIndex(env.DB);
        await cleanupExpiredUnfinishedAccounts(env.DB);
        const body = await request.json();
        const { email, password } = body;
        if (!email || !password)
          return errorResponse("Email et mot de passe requis", 400, origin);
        if (!isValidEmail2(email))
          return errorResponse("Format d'adresse email invalide (ex: exemple@gmail.com)", 400, origin);
        const cleanEmail = email.toLowerCase().trim();
        const existingUser = await env.DB.prepare("SELECT * FROM users WHERE LOWER(TRIM(email)) = ?").bind(cleanEmail).first();
        if (!existingUser) {
          return jsonResponse({
            success: false,
            userNotFound: true,
            code: "USER_NOT_FOUND",
            error: "Aucun compte associ\xE9 \xE0 cette adresse email n'a \xE9t\xE9 trouv\xE9. Veuillez cr\xE9er votre compte pour continuer."
          }, 404, origin);
        }
        if (existingUser.provider === "google" && !existingUser.password_hash) {
          return jsonResponse({
            success: false,
            isGoogleAccount: true,
            code: "GOOGLE_ACCOUNT_DETECTED",
            error: 'Ce compte utilise la connexion Google. Veuillez cliquer sur "Continuer avec Google" pour vous connecter instantan\xE9ment.'
          }, 400, origin);
        }
        if (!existingUser.password_hash) {
          return errorResponse("Compte incomplet ou sans mot de passe d\xE9fini.", 401, origin);
        }
        const valid = await verifyPassword(password, existingUser.password_hash);
        if (!valid) {
          return errorResponse("Mot de passe incorrect. Veuillez v\xE9rifier votre saisie ou r\xE9initialiser votre mot de passe.", 401, origin);
        }
        const user = existingUser;
        const verificationToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        const expiresAt = new Date(Date.now() + 70 * 1e3).toISOString();
        await env.DB.prepare("DELETE FROM email_verifications WHERE user_id = ? OR LOWER(TRIM(email)) = ?").bind(user.id, cleanEmail).run();
        await env.DB.prepare(`
          INSERT INTO email_verifications (id, user_id, email, token, resend_count, block_stage, last_sent_at, expires_at)
          VALUES (?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, ?)
        `).bind(generateId3(), user.id, cleanEmail, verificationToken, expiresAt).run();
        const clientOrigin = request.headers.get("Origin") || "https://studycloud.dkd-technologies.com";
        await sendConfirmationEmail(cleanEmail, user.name, verificationToken, clientOrigin, true);
        return jsonResponse({
          success: true,
          requiresVerification: true,
          isLogin: true,
          email: cleanEmail,
          resendCount: 0,
          maxCount: 5,
          nextAllowedAt: new Date(Date.now() + 70 * 1e3).toISOString(),
          message: "Un email de confirmation de connexion vous a \xE9t\xE9 envoy\xE9."
        }, 200, origin);
      }
      if (path === "/api/auth/forgot-password/init" && method === "POST") {
        await ensurePasswordResetsTable(env.DB);
        const body = await request.json();
        const { email } = body;
        if (!email)
          return errorResponse("Email requis", 400, origin);
        if (!isValidEmail2(email))
          return errorResponse("Format d'adresse email invalide (ex: exemple@gmail.com)", 400, origin);
        const cleanEmail = email.toLowerCase().trim();
        const user = await env.DB.prepare("SELECT id, name, email, security_question_1, security_question_2, security_answer_1_hash FROM users WHERE email = ?").bind(cleanEmail).first();
        if (!user)
          return errorResponse("Aucun compte trouv\xE9 avec cet email", 404, origin);
        const now = Date.now();
        const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1e3;
        const sinceDate = new Date(now - TWENTY_FOUR_HOURS_MS).toISOString();
        const recentAttempts = await env.DB.prepare(`
          SELECT * FROM password_resets 
          WHERE user_id = ? AND created_at > ?
          ORDER BY created_at ASC
        `).bind(user.id, sinceDate).all();
        const count = recentAttempts.results ? recentAttempts.results.length : 0;
        if (count >= 4) {
          const oldest = new Date(recentAttempts.results[0].created_at).getTime();
          const unblockTime = oldest + TWENTY_FOUR_HOURS_MS;
          const remainingMs = Math.max(0, unblockTime - now);
          const remainingHours = Math.ceil(remainingMs / (3600 * 1e3));
          return jsonResponse({
            success: false,
            error: `Quota journalier atteint (4 r\xE9clamations max). Veuillez patienter ${remainingHours} heure(s) avant de recommencer.`,
            isBlocked: true,
            blockedUntil: new Date(unblockTime).toISOString(),
            remainingMs,
            remainingHours
          }, 429, origin);
        }
        const q1 = user.security_question_1 || "Quelle est votre ville de naissance ?";
        const q2 = user.security_question_2 || "Quel est le pr\xE9nom de votre m\xE8re ?";
        return jsonResponse({
          success: true,
          email: user.email,
          name: user.name,
          question1: q1,
          question2: q2,
          hasCustomQuestions: !!user.security_answer_1_hash,
          attemptsToday: count,
          maxAttempts: 4
        }, 200, origin);
      }
      if (path === "/api/auth/forgot-password/verify-answers" && method === "POST") {
        await ensurePasswordResetsTable(env.DB);
        const body = await request.json();
        const { email, answer1, answer2 } = body;
        if (!email || !answer1)
          return errorResponse("Email et r\xE9ponse(s) de s\xE9curit\xE9 requis", 400, origin);
        const cleanEmail = email.toLowerCase().trim();
        const user = await env.DB.prepare("SELECT id, name, email, security_answer_1_hash, security_answer_2_hash FROM users WHERE email = ?").bind(cleanEmail).first();
        if (!user)
          return errorResponse("Utilisateur introuvable", 404, origin);
        if (user.security_answer_1_hash) {
          const hash1 = await hashToken(answer1.slice(0, 30).toLowerCase().trim());
          const match1 = hash1 === user.security_answer_1_hash;
          let match2 = true;
          if (user.security_answer_2_hash && answer2) {
            const hash2 = await hashToken(answer2.slice(0, 30).toLowerCase().trim());
            match2 = hash2 === user.security_answer_2_hash;
          }
          if (!match1 || !match2) {
            return errorResponse("R\xE9ponse(s) de s\xE9curit\xE9 incorrecte(s). Veuillez v\xE9rifier vos informations.", 400, origin);
          }
        }
        const resetSessionToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        return jsonResponse({
          success: true,
          verified: true,
          resetSessionToken,
          email: user.email,
          message: "Informations personnelles v\xE9rifi\xE9es avec succ\xE8s !"
        }, 200, origin);
      }
      if (path === "/api/auth/forgot-password/send-code" && method === "POST") {
        await ensurePasswordResetsTable(env.DB);
        const body = await request.json();
        const { email, resetSessionToken } = body;
        if (!email || !resetSessionToken) {
          return errorResponse("Email et token requis", 400, origin);
        }
        if (!isValidEmail2(email))
          return errorResponse("Format d'adresse email du compte invalide (ex: exemple@gmail.com)", 400, origin);
        const cleanAccountEmail = email.toLowerCase().trim();
        const cleanTargetEmail = cleanAccountEmail;
        const user = await env.DB.prepare("SELECT id, name, email FROM users WHERE LOWER(TRIM(email)) = ?").bind(cleanAccountEmail).first();
        if (!user)
          return errorResponse("Utilisateur introuvable", 404, origin);
        const now = Date.now();
        const TWENTY_FOUR_HOURS_MS = 24 * 3600 * 1e3;
        const sinceDate = new Date(now - TWENTY_FOUR_HOURS_MS).toISOString();
        const recentAttempts = await env.DB.prepare(`
          SELECT * FROM password_resets 
          WHERE user_id = ? AND created_at > ?
          ORDER BY created_at ASC
        `).bind(user.id, sinceDate).all();
        const count = recentAttempts.results ? recentAttempts.results.length : 0;
        if (count >= 4) {
          const oldest = new Date(recentAttempts.results[0].created_at).getTime();
          const unblockTime = oldest + TWENTY_FOUR_HOURS_MS;
          const remainingMs = Math.max(0, unblockTime - now);
          const remainingHours = Math.ceil(remainingMs / (3600 * 1e3));
          return jsonResponse({
            success: false,
            error: `Quota journalier atteint (4 r\xE9clamations par jour). Veuillez patienter ${remainingHours} heure(s).`,
            isBlocked: true,
            blockedUntil: new Date(unblockTime).toISOString(),
            remainingMs,
            remainingHours
          }, 429, origin);
        }
        const resetCode = Math.floor(1e5 + Math.random() * 9e5).toString();
        const expiresAt = new Date(now + 3600 * 1e3).toISOString();
        await env.DB.prepare(`
          INSERT INTO password_resets (id, user_id, target_email, reset_code, attempts_today, last_requested_at, expires_at, used)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, 0)
        `).bind(generateId3(), user.id, cleanTargetEmail, resetCode, count + 1, expiresAt).run();
        const clientOrigin = request.headers.get("Origin") || "https://studycloud.dkd-technologies.com";
        await sendPasswordResetEmail(cleanTargetEmail, user.name, resetCode, clientOrigin);
        return jsonResponse({
          success: true,
          message: "Le code de r\xE9initialisation a \xE9t\xE9 envoy\xE9 \xE0 votre adresse email !",
          targetEmail: cleanTargetEmail,
          attemptsToday: count + 1,
          maxAttempts: 4
        }, 200, origin);
      }
      if (path === "/api/auth/reset-password" && method === "POST") {
        const body = await request.json();
        const { email, code, newPassword } = body;
        if (!email || !code || !newPassword) {
          return errorResponse("Email, code et nouveau mot de passe requis", 400, origin);
        }
        const pwdCheck = validatePasswordFormat2(newPassword);
        if (!pwdCheck.valid)
          return errorResponse(pwdCheck.error || "Nouveau mot de passe non conforme", 400, origin);
        const cleanEmail = email.toLowerCase().trim();
        const user = await env.DB.prepare("SELECT id, name FROM users WHERE email = ?").bind(cleanEmail).first();
        if (!user)
          return errorResponse("Utilisateur introuvable", 404, origin);
        const resetRecord = await env.DB.prepare(`
          SELECT * FROM password_resets
          WHERE user_id = ? AND reset_code = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP
          ORDER BY created_at DESC LIMIT 1
        `).bind(user.id, code.trim()).first();
        if (!resetRecord) {
          return errorResponse("Code de r\xE9initialisation invalide ou expir\xE9", 400, origin);
        }
        const newHash = await hashPassword(newPassword);
        await env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(newHash, user.id).run();
        await env.DB.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").bind(resetRecord.id).run();
        await env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(user.id).run();
        return jsonResponse({
          success: true,
          message: "Votre mot de passe a \xE9t\xE9 modifi\xE9 avec succ\xE8s ! Vous pouvez maintenant vous connecter."
        }, 200, origin);
      }
      if (path === "/api/auth/google" && method === "POST") {
        const body = await request.json();
        const { code, redirectUri, action } = body;
        if (!code)
          return errorResponse("Code Google OAuth requis", 400, origin);
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri || `${new URL(request.url).origin}/auth/google/callback`,
            grant_type: "authorization_code"
          })
        });
        const tokenData = await tokenRes.json();
        if (!tokenData.access_token)
          return errorResponse("\xC9change Google OAuth \xE9chou\xE9 : " + (tokenData.error_description || tokenData.error || "inconnu"), 400, origin);
        const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        const profile = await profileRes.json();
        if (!profile.id || !profile.email)
          return errorResponse("Impossible de r\xE9cup\xE9rer le profil Google", 400, origin);
        const cleanGoogleEmail = profile.email.toLowerCase().trim();
        await ensureUsersTableUniqueIndex(env.DB);
        await cleanupExpiredUnfinishedAccounts(env.DB);
        let user = await env.DB.prepare("SELECT * FROM users WHERE google_id = ? OR LOWER(TRIM(email)) = ?").bind(profile.id, cleanGoogleEmail).first();
        if (!user) {
          const userId = generateId3();
          let newRefCode = generateReferralCode();
          try {
            let codeExists = await env.DB.prepare("SELECT id FROM users WHERE referral_code = ?").bind(newRefCode).first();
            while (codeExists) {
              newRefCode = generateReferralCode();
              codeExists = await env.DB.prepare("SELECT id FROM users WHERE referral_code = ?").bind(newRefCode).first();
            }
          } catch (e) {
          }
          await env.DB.prepare(`
            INSERT INTO users (id, name, email, provider, google_id, email_verified, avatar_url, is_onboarded, referral_code, last_active_at, created_at, updated_at)
            VALUES (?, ?, ?, 'google', ?, 1, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(userId, profile.name || cleanGoogleEmail, cleanGoogleEmail, profile.id, profile.picture || null, newRefCode).run();
          await env.DB.prepare("INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)").bind(userId).run();
          user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
          if (body.referralCode) {
            await processReferralAttribution(env.DB, body.referralCode, userId, profile.name || cleanGoogleEmail, cleanGoogleEmail);
          }
          await createNotification(
            env.DB,
            userId,
            "Bienvenue sur StudyCloud !",
            "F\xE9licitations ! Votre compte StudyCloud a \xE9t\xE9 activ\xE9 avec succ\xE8s via Google. Vous pouvez d\xE9sormais stocker, classer et prot\xE9ger vos cours, devoirs et documents universitaires en toute s\xE9r\xE9nit\xE9.",
            "Guide de d\xE9marrage StudyCloud",
            "welcome"
          );
        } else {
          await env.DB.prepare(`
            UPDATE users SET
              google_id = COALESCE(google_id, ?),
              avatar_url = COALESCE(avatar_url, ?),
              email_verified = 1,
              last_active_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(profile.id, profile.picture || null, user.id).run();
          user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first();
        }
        const token = await createJWT({ userId: user.id, email: user.email, name: user.name });
        const tokenHash = await hashToken(token);
        const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1e3).toISOString();
        await env.DB.prepare("INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").bind(generateId3(), user.id, tokenHash, expiresAt).run();
        const safeUser = sanitizeUser2(user);
        return jsonResponse({
          success: true,
          token,
          user: safeUser,
          requiresOnboarding: user.is_onboarded === 0
        }, 200, origin);
      }
      if (path === "/api/auth/logout" && method === "POST") {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (token) {
          const tokenHash = await hashToken(token);
          await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).run();
        }
        return jsonResponse({ success: true, message: "D\xE9connect\xE9" }, 200, origin);
      }
      if (path === "/api/auth/me" && method === "GET") {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token)
          return errorResponse("Token requis", 401, origin);
        const payload = await verifyJWT(token);
        if (!payload?.userId)
          return errorResponse("Token invalide ou expir\xE9", 401, origin);
        const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(payload.userId).first();
        if (!user)
          return errorResponse("Utilisateur introuvable", 404, origin);
        if (user.last_active_at) {
          const inactiveMs = Date.now() - new Date(user.last_active_at).getTime();
          const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1e3;
          if (inactiveMs > THIRTY_DAYS_MS) {
            try {
              await env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(user.id).run();
            } catch (e) {
            }
            return jsonResponse({
              success: false,
              error: "Session expir\xE9e apr\xE8s 1 mois d'inactivit\xE9. Veuillez vous reconnecter.",
              code: "SESSION_EXPIRED_INACTIVE"
            }, 401, origin);
          }
        }
        await env.DB.prepare("UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();
        try {
          const tokenHash = await hashToken(token);
          const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1e3).toISOString();
          await env.DB.prepare("INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").bind(generateId3(), user.id, tokenHash, sessionExpiresAt).run();
        } catch (e) {
        }
        const safeUser = sanitizeUser2(user);
        return jsonResponse({ success: true, data: safeUser }, 200, origin);
      }
      if ((path === "/api/auth/heartbeat" || path === "/api/users/heartbeat") && (method === "POST" || method === "GET")) {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token)
          return errorResponse("Token requis", 401, origin);
        const payload = await verifyJWT(token);
        if (!payload?.userId)
          return errorResponse("Token invalide ou expiré", 401, origin);
        await env.DB.prepare("UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payload.userId).run();
        try {
          const tokenHash = await hashToken(token);
          const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1e3).toISOString();
          await env.DB.prepare("INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").bind(generateId3(), payload.userId, tokenHash, sessionExpiresAt).run();
        } catch (e) {
        }
        return jsonResponse({ success: true, isOnline: true, last_active_at: new Date().toISOString() }, 200, origin);
      }
      if ((path === "/api/auth/setup-security" || path === "/api/auth/google/complete-security") && (method === "PUT" || method === "POST")) {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token)
          return errorResponse("Token requis", 401, origin);
        const payload = await verifyJWT(token);
        if (!payload?.userId)
          return errorResponse("Token invalide ou expir\xE9", 401, origin);
        const body = await request.json();
        const { name, password, securityQuestion1, securityAnswer1, securityQuestion2, securityAnswer2 } = body;
        const pwdCheck = validatePasswordFormat2(password);
        if (!pwdCheck.valid)
          return errorResponse(pwdCheck.error || "Mot de passe non conforme", 400, origin);
        if (!securityAnswer1 || !securityAnswer1.trim() || !securityAnswer2 || !securityAnswer2.trim()) {
          return errorResponse("Veuillez renseigner les r\xE9ponses \xE0 vos deux questions de s\xE9curit\xE9", 400, origin);
        }
        const passwordHash = await hashPassword(password);
        const ans1Hash = await hashToken(securityAnswer1.slice(0, 30).toLowerCase().trim());
        const ans2Hash = await hashToken(securityAnswer2.slice(0, 30).toLowerCase().trim());
        const q1 = securityQuestion1 || "Quelle est votre ville de naissance ?";
        const q2 = securityQuestion2 || "Quel est le pr\xE9nom de votre m\xE8re ?";
        const finalName = name && typeof name === "string" && name.trim() ? name.trim() : null;
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
        const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(payload.userId).first();
        const safeUser = sanitizeUser2(updatedUser);
        return jsonResponse({
          success: true,
          message: "S\xE9curit\xE9 de votre compte configur\xE9e avec succ\xE8s !",
          user: safeUser
        }, 200, origin);
      }
      if (path === "/api/auth/onboarding" && method === "PUT") {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token)
          return errorResponse("Token requis", 401, origin);
        const payload = await verifyJWT(token);
        if (!payload?.userId)
          return errorResponse("Token invalide", 401, origin);
        const existingUser = await env.DB.prepare("SELECT id, email, is_onboarded FROM users WHERE id = ?").bind(payload.userId).first();
        if (!existingUser) {
          return errorResponse("Session introuvable ou expir\xE9e. Veuillez vous reconnecter.", 401, origin);
        }
        const body = await request.json();
        const { name, school, filiere, level, country, phone, bio, avatarUrl } = body;
        const isStudent = body.is_student === 0 || body.isStudent === false ? false : true;
        const profession = body.profession ? String(body.profession).trim() : "";
        const finalSchool = !isStudent ? "Professionnel / Particulier" : school;
        const finalFiliere = !isStudent ? profession || filiere || "G\xE9n\xE9ral" : filiere;
        const finalLevel = !isStudent ? "Professionnel" : level || "";
        if (!country)
          return errorResponse("Le pays est obligatoire", 400, origin);
        if (!phone || !String(phone).trim())
          return errorResponse("Le num\xE9ro de t\xE9l\xE9phone est obligatoire", 400, origin);
        const COUNTRY_PHONE_CONFIG = {
          "C\xF4te d'Ivoire": { dial: "225", lengths: [10], hint: "10 chiffres" },
          "S\xE9n\xE9gal": { dial: "221", lengths: [9], hint: "9 chiffres" },
          "Mali": { dial: "223", lengths: [8], hint: "8 chiffres" },
          "Burkina Faso": { dial: "226", lengths: [8], hint: "8 chiffres" },
          "Guin\xE9e": { dial: "224", lengths: [9], hint: "9 chiffres" },
          "Cameroun": { dial: "237", lengths: [9], hint: "9 chiffres" },
          "Gabon": { dial: "241", lengths: [7, 8], hint: "7 ou 8 chiffres" },
          "Congo": { dial: "242", lengths: [9], hint: "9 chiffres" },
          "R\xE9publique d\xE9mocratique du Congo": { dial: "243", lengths: [9, 10], hint: "9 ou 10 chiffres" },
          "Madagascar": { dial: "261", lengths: [9, 10], hint: "9 ou 10 chiffres" },
          "B\xE9nin": { dial: "229", lengths: [8, 10], hint: "8 ou 10 chiffres" },
          "Togo": { dial: "228", lengths: [8], hint: "8 chiffres" },
          "Niger": { dial: "227", lengths: [8], hint: "8 chiffres" },
          "Tchad": { dial: "235", lengths: [8], hint: "8 chiffres" },
          "Mauritanie": { dial: "222", lengths: [8], hint: "8 chiffres" },
          "Maroc": { dial: "212", lengths: [9, 10], hint: "9 ou 10 chiffres" },
          "Alg\xE9rie": { dial: "213", lengths: [9, 10], hint: "9 ou 10 chiffres" },
          "Tunisie": { dial: "216", lengths: [8], hint: "8 chiffres" },
          "France": { dial: "33", lengths: [9, 10], hint: "9 ou 10 chiffres" },
          "Belgique": { dial: "32", lengths: [9, 10], hint: "9 ou 10 chiffres" },
          "Canada": { dial: "1", lengths: [10], hint: "10 chiffres" }
        };
        const countryCfg = COUNTRY_PHONE_CONFIG[country];
        if (countryCfg) {
          let pDigits = String(phone).replace(/\D/g, "");
          if (countryCfg.dial && pDigits.startsWith(countryCfg.dial) && !countryCfg.lengths.includes(pDigits.length)) {
            const withoutDial = pDigits.slice(countryCfg.dial.length);
            if (countryCfg.lengths.includes(withoutDial.length)) {
              pDigits = withoutDial;
            }
          }
          if (!countryCfg.lengths.includes(pDigits.length)) {
            return errorResponse(
              `Le num\xE9ro de t\xE9l\xE9phone pour ${country} doit comporter ${countryCfg.hint} (${pDigits.length} saisi${pDigits.length > 1 ? "s" : ""})`,
              400,
              origin
            );
          }
        }
        if (!isStudent && !profession)
          return errorResponse("La profession ou domaine d'activit\xE9 est obligatoire", 400, origin);
        if (isStudent && (!finalSchool || !finalFiliere)) {
          return errorResponse("L'\xE9cole et la fili\xE8re sont obligatoires pour les \xE9tudiants", 400, origin);
        }
        const finalAvatar = avatarUrl ? String(avatarUrl).trim() : existingUser.avatar_url || generateEmailAvatar2(existingUser.email, name || "");
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
        const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(payload.userId).first();
        if (user && user.email) {
          const clientOrigin = request.headers.get("Origin") || "https://studycloud.dkd-technologies.com";
          sendWelcomeEmail(
            user.email,
            user.name || name || (isStudent ? "\xC9tudiant" : "Membre"),
            Boolean(isStudent),
            finalSchool,
            finalFiliere,
            clientOrigin
          );
        }
        const safeUser = sanitizeUser2(user);
        return jsonResponse({ success: true, data: safeUser }, 200, origin);
      }
      if (path === "/api/auth/onboarding/draft" && method === "PUT") {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token)
          return errorResponse("Token requis", 401, origin);
        const payload = await verifyJWT(token);
        if (!payload?.userId)
          return errorResponse("Token invalide", 401, origin);
        const body = await request.json().catch(() => ({}));
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
        return jsonResponse({ success: true, message: "Brouillon sauvegard\xE9." }, 200, origin);
      }
      if (path === "/api/auth/cancel-unfinalized-account" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        let targetUserId = body.userId;
        let targetEmail = body.email ? String(body.email).toLowerCase().trim() : null;
        if (token) {
          try {
            const payload = await verifyJWT(token);
            if (payload?.userId)
              targetUserId = payload.userId;
            if (payload?.email && !targetEmail)
              targetEmail = String(payload.email).toLowerCase().trim();
          } catch (e) {
          }
        }
        let user = null;
        if (targetUserId) {
          user = await env.DB.prepare("SELECT id, email, is_onboarded FROM users WHERE id = ?").bind(targetUserId).first();
        }
        if (!user && targetEmail) {
          user = await env.DB.prepare("SELECT id, email, is_onboarded FROM users WHERE LOWER(TRIM(email)) = ?").bind(targetEmail).first();
        }
        if (user) {
          const isEmailVerified = Number(user.email_verified) === 1;
          const isOnboarded = Number(user.is_onboarded) === 1;
          if (isEmailVerified || isOnboarded) {
            return jsonResponse({
              success: true,
              message: "Compte actif et v\xE9rifi\xE9 conserv\xE9."
            }, 200, origin);
          }
          await deleteUserCompletely(env.DB, user.id);
          console.log(`[StudyCloud Expiration] Compte non v\xE9rifi\xE9 annul\xE9 : ${user.email} (${user.id})`);
          return jsonResponse({
            success: true,
            message: "Compte non finalis\xE9 annul\xE9 et donn\xE9es supprim\xE9es avec succ\xE8s."
          }, 200, origin);
        }
        return jsonResponse({ success: true, message: "Aucun compte non finalis\xE9 \xE0 supprimer." }, 200, origin);
      }
      if (path === "/api/auth/welcome-email" && method === "POST") {
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (!token)
          return errorResponse("Token requis", 401, origin);
        const payload = await verifyJWT(token);
        if (!payload?.userId)
          return errorResponse("Token invalide", 401, origin);
        const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(payload.userId).first();
        if (!user || !user.email)
          return errorResponse("Utilisateur ou email introuvable", 404, origin);
        const clientOrigin = request.headers.get("Origin") || "https://studycloud.dkd-technologies.com";
        const isUserStudent = user.is_student === 1 || user.is_student === null && user.school && user.school !== "Particulier / Professionnel" && user.school !== "Professionnel / Particulier";
        await sendWelcomeEmail(
          user.email,
          user.name || (isUserStudent ? "\xC9tudiant" : "Membre"),
          Boolean(isUserStudent),
          user.school || "",
          user.filiere || "",
          clientOrigin
        );
        return jsonResponse({ success: true, message: "Email de bienvenue envoy\xE9" }, 200, origin);
      }
      if (path === "/api/users/delete-account" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        let targetUserId = body.userId;
        let targetEmail = body.email ? String(body.email).toLowerCase().trim() : null;
        if (token) {
          try {
            const payload = await verifyJWT(token);
            if (payload?.userId)
              targetUserId = payload.userId;
            if (payload?.email && !targetEmail)
              targetEmail = String(payload.email).toLowerCase().trim();
          } catch (e) {
          }
        }
        if (!targetUserId && !targetEmail) {
          return errorResponse("userId ou email requis pour supprimer le compte", 400, origin);
        }
        if (env.DB) {
          let existingUser = null;
          if (targetUserId) {
            existingUser = await env.DB.prepare("SELECT id, email FROM users WHERE id = ?").bind(targetUserId).first();
          }
          if (!existingUser && targetEmail) {
            existingUser = await env.DB.prepare("SELECT id, email FROM users WHERE LOWER(TRIM(email)) = ?").bind(targetEmail).first();
          }
          const resolvedUserId = existingUser?.id || targetUserId;
          const resolvedEmail = existingUser?.email || targetEmail;
          await deleteUserCompletely(env.DB, resolvedUserId, resolvedEmail, env.BUCKET);
        }
        return jsonResponse({
          success: true,
          message: "Votre compte et toutes vos donn\xE9es ont \xE9t\xE9 d\xE9finitivement supprim\xE9s de StudyCloud."
        }, 200, origin);
      }
      if (path === "/api/users/sync" && method === "POST") {
        const body = await request.json();
        const { id, name, email, school, filiere, country, avatarUrl } = body;
        if (!id || !email)
          return errorResponse("ID et email requis", 400, origin);
        const cleanEmail = email.toLowerCase().trim();
        const hasAvatar = avatarUrl !== void 0;
        const avatarVal = avatarUrl ? String(avatarUrl) : null;
        const existing = await env.DB.prepare(
          "SELECT id FROM users WHERE id = ? OR LOWER(TRIM(email)) = ?"
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
            name || "\xC9tudiant",
            cleanEmail,
            school || "CME",
            filiere || "G\xE9n\xE9ral",
            country || "C\xF4te d'Ivoire",
            avatarVal
          ).run();
        }
        await env.DB.prepare(`
          INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)
        `).bind(existing ? existing.id : id).run();
        return jsonResponse({ success: true, message: "Utilisateur synchronis\xE9" }, 200, origin);
      }
      if (path.startsWith("/api/users/") && !path.includes("/preferences") && method === "GET") {
        const userId = path.split("/")[3];
        const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
        if (!user)
          return errorResponse("Utilisateur introuvable", 404, origin);
        return jsonResponse({ success: true, data: user }, 200, origin);
      }
      if (path.startsWith("/api/users/") && path.endsWith("/preferences")) {
        const userId = path.split("/")[3];
        if (method === "GET") {
          const prefs = await env.DB.prepare("SELECT * FROM user_preferences WHERE user_id = ?").bind(userId).first();
          return jsonResponse({ success: true, data: prefs || { view_mode: "grid", is_dark_mode: 0, current_tab: "folders" } }, 200, origin);
        }
        if (method === "PUT") {
          const body = await request.json();
          await env.DB.prepare(`
            INSERT INTO user_preferences (user_id, view_mode, is_dark_mode, current_tab, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              view_mode = COALESCE(excluded.view_mode, user_preferences.view_mode),
              is_dark_mode = COALESCE(excluded.is_dark_mode, user_preferences.is_dark_mode),
              current_tab = COALESCE(excluded.current_tab, user_preferences.current_tab),
              updated_at = CURRENT_TIMESTAMP
          `).bind(userId, body.view_mode || "grid", body.is_dark_mode ?? 0, body.current_tab || "folders").run();
          return jsonResponse({ success: true, message: "Pr\xE9f\xE9rences enregistr\xE9es" }, 200, origin);
        }
      }
      if (path === "/api/matieres") {
        if (!isSchemaInitialized && env.DB)
          await ensureDatabaseSchema(env.DB);
        if (method === "GET") {
          const userId = url.searchParams.get("userId");
          if (!userId)
            return errorResponse("userId requis", 400, origin);
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
        if (method === "POST") {
          const body = await request.json();
          const { id, userId, name, coefficient, color, category, displayOrder } = body;
          if (!id || !userId || !name)
            return errorResponse("id, userId et name requis", 400, origin);
          await env.DB.prepare(`
            INSERT INTO matieres (id, user_id, name, coefficient, color, category, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              coefficient = excluded.coefficient,
              color = excluded.color,
              category = excluded.category,
              display_order = excluded.display_order
          `).bind(id, userId, name, coefficient ?? 1, color || "#EA580C", category || "G\xE9n\xE9ral", displayOrder ?? 0).run();
          return jsonResponse({ success: true, data: { id, name } }, 201, origin);
        }
      }
      if (path.startsWith("/api/matieres/") && method === "DELETE") {
        if (!isSchemaInitialized && env.DB)
          await ensureDatabaseSchema(env.DB);
        const id = path.split("/")[3];
        await env.DB.prepare("DELETE FROM matieres WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, message: "Mati\xE8re supprim\xE9e" }, 200, origin);
      }
      if (path === "/api/files") {
        if (!isSchemaInitialized && env.DB)
          await ensureDatabaseSchema(env.DB);
        if (method === "GET") {
          const userId = url.searchParams.get("userId");
          const matiereId = url.searchParams.get("matiereId");
          const isStudySession = url.searchParams.get("isStudySession");
          const isFavorite = url.searchParams.get("isFavorite");
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          let query = "SELECT * FROM files WHERE user_id = ?";
          const params = [userId];
          if (matiereId === "root" || matiereId === "none") {
            query += ' AND (matiere_id IS NULL OR matiere_id = "" OR matiere_id = "Mes fichiers")';
          } else if (matiereId && matiereId !== "all") {
            query += " AND (matiere_id = ? OR matiere_id IN (SELECT id FROM matieres WHERE name = ? AND user_id = ?))";
            params.push(matiereId, matiereId, userId);
          }
          if (isFavorite === "true" || isFavorite === "1") {
            query += " AND is_favorite = 1";
          }
          if (isStudySession === "true" || isStudySession === "1") {
            query += " AND is_study_session = 1";
          } else if (isStudySession === "false" || isStudySession === "0") {
            query += " AND (is_study_session IS NULL OR is_study_session = 0)";
          }
          query += " ORDER BY last_imported DESC, updated_at DESC, created_at DESC";
          const { results } = await env.DB.prepare(query).bind(...params).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, userId, matiereId, name, size, type, extension, r2Key, fileUrl, isFavorite, isImported, isStudySession, lastImported } = body;
          if (!id || !userId || !name)
            return errorResponse("id, userId et name requis", 400, origin);
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
            type || "application/octet-stream",
            extension || "",
            r2Key || null,
            fileUrl || "",
            isFavorite ? 1 : 0,
            isImported ? 1 : 0,
            isStudySession ? 1 : 0,
            lastImported || Date.now()
          ).run();
          return jsonResponse({ success: true, data: { id, name } }, 201, origin);
        }
      }
      if (path.startsWith("/api/files/") && path.endsWith("/favorite") && (method === "PATCH" || method === "PUT")) {
        if (!isSchemaInitialized && env.DB)
          await ensureDatabaseSchema(env.DB);
        const id = path.split("/")[3];
        const body = await request.json().catch(() => ({}));
        const isFavoriteVal = body.isFavorite === true || body.isFavorite === 1 ? 1 : 0;
        await env.DB.prepare("UPDATE files SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(isFavoriteVal, id).run();
        return jsonResponse({ success: true, message: "Favori mis \xE0 jour", isFavorite: isFavoriteVal }, 200, origin);
      }
      if (path.startsWith("/api/files/") && method === "DELETE") {
        if (!isSchemaInitialized && env.DB)
          await ensureDatabaseSchema(env.DB);
        const id = path.split("/")[3];
        const file = await env.DB.prepare("SELECT r2_key FROM files WHERE id = ?").bind(id).first();
        if (file && file.r2_key && env.BUCKET) {
          try {
            await env.BUCKET.delete(file.r2_key);
          } catch (e) {
          }
        }
        await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, message: "Fichier supprim\xE9" }, 200, origin);
      }
      if (path === "/api/storage/upload" && method === "PUT") {
        const key = url.searchParams.get("key");
        if (!key)
          return errorResponse("Cl\xE9 de stockage manquante", 400, origin);
        const contentType = request.headers.get("Content-Type") || "application/octet-stream";
        const fileData = request.body || await request.arrayBuffer();
        await env.BUCKET.put(key, fileData, {
          httpMetadata: { contentType }
        });
        const fileUrl = `${url.origin}/api/storage/file/${encodeURIComponent(key)}`;
        return jsonResponse({ success: true, key, url: fileUrl }, 200, origin);
      }
      if (path.startsWith("/api/storage/file/") && method === "GET") {
        const key = decodeURIComponent(path.replace("/api/storage/file/", ""));
        const object = await env.BUCKET.get(key);
        if (!object)
          return errorResponse("Fichier introuvable dans R2", 404, origin);
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        headers.set("Access-Control-Allow-Origin", origin);
        return new Response(object.body, { headers });
      }
      if (path.startsWith("/api/shares") && env.DB && !isSchemaInitialized) {
        await ensureDatabaseSchema(env.DB);
      }
      if (path === "/api/shares") {
        if (method === "GET") {
          const userId = url.searchParams.get("userId");
          const isPublicOnly = url.searchParams.get("publicOnly") === "true" || url.searchParams.get("isPublic") === "1";
          let query = "SELECT * FROM shared_folders WHERE 1=1";
          const params = [];
          if (userId) {
            query += " AND user_id = ?";
            params.push(userId);
          }
          if (isPublicOnly) {
            query += " AND is_public = 1";
          }
          query += " ORDER BY created_at DESC";
          const { results } = await env.DB.prepare(query).bind(...params).all();
          const foldersWithFiles = await Promise.all(
            (results || []).map(async (folder) => {
              const { results: files } = await env.DB.prepare(
                "SELECT * FROM shared_folder_files WHERE shared_folder_id = ?"
              ).bind(folder.id).all();
              return { ...folder, files: files || [] };
            })
          );
          return jsonResponse({ success: true, data: foldersWithFiles }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
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
          if (!id || !userId || !title)
            return errorResponse("id, userId et title requis", 400, origin);
          const finalShareCode = shareCode || generateCleanShareCode();
          const finalShareUrl = shareUrl || `${url.origin}/s/${finalShareCode}`;
          const finalQrCodeData = qrCodeData || finalShareUrl;
          const finalCountry = country || "C\xF4te d'Ivoire";
          const finalIsPublic = isPublic ? 1 : 0;
          const finalAllowDownload = allowDownload !== void 0 ? allowDownload ? 1 : 0 : 1;
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
            description || "",
            category || "Cours",
            authorName || "\xC9tudiant",
            school || "",
            finalCountry,
            finalIsPublic,
            isPasswordProtected ? 1 : 0,
            passwordHash || null,
            finalAllowDownload,
            totalSize || 0
          ).run();
          if (Array.isArray(files)) {
            await env.DB.prepare("DELETE FROM shared_folder_files WHERE shared_folder_id = ?").bind(id).run();
            for (const f of files) {
              await env.DB.prepare(`
                INSERT INTO shared_folder_files (id, shared_folder_id, file_id, name, size, type, r2_key, file_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(f.id || crypto.randomUUID(), id, f.fileId || null, f.name, f.size || 0, f.type || "file", f.r2Key || null, f.url || "").run();
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
      if (path.startsWith("/api/shares/code/") && method === "GET") {
        const code = decodeURIComponent(path.split("/")[4]);
        const folder = await env.DB.prepare("SELECT * FROM shared_folders WHERE share_code = ?").bind(code).first();
        if (!folder)
          return errorResponse("Code de partage introuvable", 404, origin);
        await env.DB.prepare("UPDATE shared_folders SET views_count = views_count + 1 WHERE id = ?").bind(folder.id).run();
        const { results: files } = await env.DB.prepare("SELECT * FROM shared_folder_files WHERE shared_folder_id = ?").bind(folder.id).all();
        return jsonResponse({
          success: true,
          data: {
            ...folder,
            files: folder.is_password_protected ? [] : files,
            requiresPassword: !!folder.is_password_protected
          }
        }, 200, origin);
      }
      if (path.startsWith("/api/shares/") && path.endsWith("/public") && method === "PUT") {
        const shareId = path.split("/")[3];
        const body = await request.json();
        const isPublic = body.isPublic ? 1 : 0;
        const allowDownload = body.allowDownload !== void 0 ? body.allowDownload ? 1 : 0 : 1;
        const description = body.description !== void 0 ? body.description : null;
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
          message: "Visibilit\xE9 mise \xE0 jour",
          isPublic: isPublic === 1,
          allowDownload: allowDownload === 1
        }, 200, origin);
      }
      if (path.startsWith("/api/shares/") && method === "DELETE") {
        const shareId = path.split("/")[3];
        try {
          const { results: filesToDelete } = await env.DB.prepare("SELECT r2_key FROM shared_folder_files WHERE shared_folder_id = ?").bind(shareId).all();
          if (env.BUCKET && filesToDelete && filesToDelete.length > 0) {
            for (const f of filesToDelete) {
              if (f.r2_key) {
                await env.BUCKET.delete(f.r2_key).catch(() => {
                });
              }
            }
          }
          if (env.BUCKET && shareId) {
            const prefixes = [`shared-links/files/${shareId}`, `shares/${shareId}`];
            for (const pfx of prefixes) {
              try {
                const listed = await env.BUCKET.list({ prefix: pfx });
                if (listed && listed.objects) {
                  for (const obj of listed.objects) {
                    await env.BUCKET.delete(obj.key).catch(() => {
                    });
                  }
                }
              } catch (listErr) {
              }
            }
          }
        } catch (e) {
        }
        await env.DB.prepare("DELETE FROM shared_folder_files WHERE shared_folder_id = ?").bind(shareId).run();
        await env.DB.prepare("DELETE FROM shared_folders WHERE id = ?").bind(shareId).run();
        try {
          await env.DB.prepare("DELETE FROM shared_folder_downloads WHERE shared_folder_id = ?").bind(shareId).run();
        } catch (e) {
        }
        return jsonResponse({ success: true, message: "Dossier partag\xE9 et fichiers supprim\xE9s" }, 200, origin);
      }
      if (path.startsWith("/api/shares/") && method === "GET") {
        const shareId = path.split("/")[3];
        const folder = await env.DB.prepare("SELECT * FROM shared_folders WHERE id = ?").bind(shareId).first();
        if (!folder)
          return errorResponse("Partage introuvable", 404, origin);
        await env.DB.prepare("UPDATE shared_folders SET views_count = views_count + 1 WHERE id = ?").bind(shareId).run();
        const { results: files } = await env.DB.prepare("SELECT * FROM shared_folder_files WHERE shared_folder_id = ?").bind(shareId).all();
        return jsonResponse({
          success: true,
          data: {
            ...folder,
            files: folder.is_password_protected ? [] : files,
            // Masquer les fichiers si mot de passe requis
            requiresPassword: !!folder.is_password_protected
          }
        }, 200, origin);
      }
      if (path.includes("/verify-pin") && method === "POST") {
        const shareId = path.split("/")[3];
        const { pin } = await request.json();
        const folder = await env.DB.prepare("SELECT * FROM shared_folders WHERE id = ?").bind(shareId).first();
        if (!folder)
          return errorResponse("Dossier partag\xE9 introuvable", 404, origin);
        if (folder.password_hash !== pin) {
          return errorResponse("Code PIN incorrect", 401, origin);
        }
        const { results: files } = await env.DB.prepare("SELECT * FROM shared_folder_files WHERE shared_folder_id = ?").bind(shareId).all();
        return jsonResponse({ success: true, data: { ...folder, files } }, 200, origin);
      }
      if (path === "/api/shares/check-user" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const { userId } = body;
        if (!userId || !env.DB)
          return jsonResponse({ success: true, exists: false }, 200, origin);
        const user = await env.DB.prepare("SELECT id, name, email FROM users WHERE id = ?").bind(userId).first();
        return jsonResponse({
          success: true,
          exists: !!user,
          user: user ? { id: user.id, name: user.name, email: user.email } : null
        }, 200, origin);
      }
      if (path === "/api/shares/quick-auth" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const { mode, email, password, name, school, country } = body;
        if (!email || !password)
          return errorResponse("Email et mot de passe requis", 400, origin);
        const cleanEmail = email.toLowerCase().trim();
        if (mode === "login") {
          const user = await env.DB.prepare("SELECT * FROM users WHERE LOWER(TRIM(email)) = ?").bind(cleanEmail).first();
          if (!user)
            return errorResponse("Aucun compte associ\xE9 \xE0 cet email", 404, origin);
          const valid = user.password_hash ? await verifyPassword(password, user.password_hash) : false;
          if (!valid)
            return errorResponse("Mot de passe incorrect", 401, origin);
          return jsonResponse({
            success: true,
            message: "Connexion r\xE9ussie",
            userId: user.id,
            name: user.name,
            email: user.email
          }, 200, origin);
        } else {
          const existing = await env.DB.prepare("SELECT id FROM users WHERE LOWER(TRIM(email)) = ?").bind(cleanEmail).first();
          if (existing)
            return errorResponse("Un compte existe d\xE9j\xE0 avec cet email. Veuillez vous connecter.", 409, origin);
          const newUserId = generateId3();
          const pwdHash = await hashPassword(password);
          const cleanName = (name || cleanEmail.split("@")[0] || "\xC9tudiant").trim();
          const cleanCountry = country || "C\xF4te d'Ivoire";
          const cleanSchool = school || "CME";
          await env.DB.prepare(`
            INSERT INTO users (id, name, email, password_hash, school, country, email_verified, is_onboarded, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
          `).bind(newUserId, cleanName, cleanEmail, pwdHash, cleanSchool, cleanCountry).run();
          await env.DB.prepare("INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)").bind(newUserId).run();
          return jsonResponse({
            success: true,
            message: "Compte cr\xE9\xE9 avec succ\xE8s",
            userId: newUserId,
            name: cleanName,
            email: cleanEmail
          }, 201, origin);
        }
      }
      if (path.startsWith("/api/shares/") && path.endsWith("/save-to-cloud") && method === "POST") {
        const shareId = path.split("/")[3];
        const body = await request.json().catch(() => ({}));
        const { userId } = body;
        if (!userId)
          return errorResponse("userId requis", 400, origin);
        const folder = await env.DB.prepare("SELECT * FROM shared_folders WHERE id = ?").bind(shareId).first();
        if (!folder)
          return errorResponse("Dossier partag\xE9 introuvable", 404, origin);
        const { results: sharedFiles } = await env.DB.prepare("SELECT * FROM shared_folder_files WHERE shared_folder_id = ?").bind(shareId).all();
        if (!sharedFiles || sharedFiles.length === 0) {
          return errorResponse("Aucun fichier associ\xE9 \xE0 ce partage", 400, origin);
        }
        const folderTitle = folder.title || "Partages re\xE7us";
        let matiere = await env.DB.prepare("SELECT id FROM matieres WHERE user_id = ? AND name = ?").bind(userId, folderTitle).first();
        if (!matiere) {
          const matiereId = "mat-" + generateId3().substring(0, 8);
          await env.DB.prepare(`
            INSERT INTO matieres (id, user_id, name, color, icon, updated_at)
            VALUES (?, ?, ?, '#2563eb', 'Folder', CURRENT_TIMESTAMP)
          `).bind(matiereId, userId, folderTitle).run();
          matiere = { id: matiereId };
        }
        let copiedCount = 0;
        for (const sf of sharedFiles) {
          const newFileId = "file-" + generateId3();
          const ext = sf.name && sf.name.includes(".") ? sf.name.split(".").pop() || "" : "";
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
            sf.type || "application/octet-stream",
            ext,
            sf.r2_key || null,
            sf.file_url || "",
            Date.now()
          ).run();
          copiedCount++;
        }
        await env.DB.prepare("UPDATE shared_folders SET downloads_count = downloads_count + 1 WHERE id = ?").bind(shareId).run();
        return jsonResponse({
          success: true,
          message: `${copiedCount} fichier(s) enregistr\xE9s dans votre StudyCloud sous "${folderTitle}"`,
          copiedCount,
          matiereName: folderTitle,
          matiereId: matiere.id
        }, 200, origin);
      }
      if (path.startsWith("/api/shares/") && path.endsWith("/track-download") && method === "POST") {
        const shareId = path.split("/")[3];
        await env.DB.prepare("UPDATE shared_folders SET downloads_count = downloads_count + 1 WHERE id = ? OR share_code = ?").bind(shareId, shareId).run();
        try {
          const dlId = "dl-" + generateId3();
          const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
          await env.DB.prepare(`
            INSERT INTO shared_folder_downloads (id, shared_folder_id, ip_address, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(dlId, shareId, clientIp).run();
        } catch (e) {
        }
        const updatedFolder = await env.DB.prepare("SELECT downloads_count FROM shared_folders WHERE id = ? OR share_code = ?").bind(shareId, shareId).first();
        return jsonResponse({
          success: true,
          message: "T\xE9l\xE9chargement comptabilis\xE9",
          downloadsCount: updatedFolder?.downloads_count || 1
        }, 200, origin);
      }
      if (path === "/api/schedule/config") {
        const userId = url.searchParams.get("userId");
        if (method === "GET") {
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const config = await env.DB.prepare("SELECT * FROM schedule_config WHERE user_id = ?").bind(userId).first();
          return jsonResponse({ success: true, data: config }, 200, origin);
        }
        if (method === "PUT") {
          const body = await request.json();
          await env.DB.prepare(`
            INSERT INTO schedule_config (user_id, days_json, hours_json, zoom_level, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              days_json = COALESCE(excluded.days_json, schedule_config.days_json),
              hours_json = COALESCE(excluded.hours_json, schedule_config.hours_json),
              zoom_level = COALESCE(excluded.zoom_level, schedule_config.zoom_level),
              updated_at = CURRENT_TIMESTAMP
          `).bind(body.userId, body.daysJson, body.hoursJson, body.zoomLevel ?? 100).run();
          return jsonResponse({ success: true, message: "Configuration mise \xE0 jour" }, 200, origin);
        }
      }
      if (path === "/api/schedule/slots") {
        if (method === "GET") {
          const userId = url.searchParams.get("userId");
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const { results } = await env.DB.prepare("SELECT * FROM schedule_slots WHERE user_id = ?").bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
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
          `).bind(slotId, userId, day, hourSlot, subject, room || "", noteOrTeacher || "", color || "#EA580C").run();
          return jsonResponse({ success: true, id: slotId }, 201, origin);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          const userId = url.searchParams.get("userId");
          const day = url.searchParams.get("day");
          const hourSlot = url.searchParams.get("hourSlot");
          if (id) {
            await env.DB.prepare("DELETE FROM schedule_slots WHERE id = ?").bind(id).run();
          } else if (userId && day && hourSlot) {
            await env.DB.prepare("DELETE FROM schedule_slots WHERE user_id = ? AND day = ? AND hour_slot = ?").bind(userId, day, hourSlot).run();
          }
          return jsonResponse({ success: true, message: "Cr\xE9neau supprim\xE9" }, 200, origin);
        }
      }
      if (path === "/api/grades") {
        if (method === "GET") {
          const userId = url.searchParams.get("userId");
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const { results } = await env.DB.prepare("SELECT * FROM grades WHERE user_id = ?").bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
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
          `).bind(id || crypto.randomUUID(), userId, trimester || 1, subjectName, coefficient || 1, subGradesJson || "[]", average || 0).run();
          return jsonResponse({ success: true }, 200, origin);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id)
            await env.DB.prepare("DELETE FROM grades WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true, message: "Note supprim\xE9e" }, 200, origin);
        }
      }
      if (path.startsWith("/api/grades/") && method === "DELETE") {
        const id = path.split("/")[3];
        await env.DB.prepare("DELETE FROM grades WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, message: "Note supprim\xE9e" }, 200, origin);
      }
      if (path === "/api/notes") {
        if (method === "GET") {
          const userId = url.searchParams.get("userId");
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const { results } = await env.DB.prepare("SELECT * FROM notes WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC").bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
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
          `).bind(id || crypto.randomUUID(), userId, title, content || "", color || "#FFFFFF", isPinned ? 1 : 0, imageUrl || null).run();
          return jsonResponse({ success: true }, 200, origin);
        }
      }
      if (path.startsWith("/api/notes/") && method === "DELETE") {
        const id = path.split("/")[3];
        await env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, message: "Note supprim\xE9e" }, 200, origin);
      }
      if (path === "/api/calendar") {
        if (method === "GET") {
          const userId = url.searchParams.get("userId");
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const { results } = await env.DB.prepare("SELECT * FROM calendar_events WHERE user_id = ? ORDER BY start_date ASC").bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
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
          `).bind(eventId, userId, title, startDate, endDate || null, allDay ? 1 : 0, color || "#EA580C", description || "", location || "").run();
          return jsonResponse({ success: true, id: eventId }, 201, origin);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id)
            await env.DB.prepare("DELETE FROM calendar_events WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true, message: "\xC9v\xE9nement supprim\xE9" }, 200, origin);
        }
      }
      if (path.startsWith("/api/calendar/") && method === "DELETE") {
        const id = path.split("/")[3];
        await env.DB.prepare("DELETE FROM calendar_events WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, message: "\xC9v\xE9nement supprim\xE9" }, 200, origin);
      }
      if (path === "/api/alarms") {
        const userId = url.searchParams.get("userId");
        if (method === "GET") {
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const { results } = await env.DB.prepare("SELECT * FROM alarms WHERE user_id = ? ORDER BY time ASC").bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, userId: userId2, time, label, isActive, daysJson } = body;
          await env.DB.prepare(`
            INSERT INTO alarms (id, user_id, time, label, is_active, days_json)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              time = excluded.time,
              label = excluded.label,
              is_active = excluded.is_active,
              days_json = excluded.days_json
          `).bind(id || crypto.randomUUID(), userId2, time, label || "R\xE9veil \xE9tude", isActive ? 1 : 0, daysJson || '["Tous les jours"]').run();
          return jsonResponse({ success: true }, 201, origin);
        }
        if (method === "DELETE") {
          const id = url.searchParams.get("id");
          if (id)
            await env.DB.prepare("DELETE FROM alarms WHERE id = ?").bind(id).run();
          return jsonResponse({ success: true, message: "Alarme supprim\xE9e" }, 200, origin);
        }
      }
      if (path.startsWith("/api/alarms/") && method === "DELETE") {
        const id = path.split("/")[3];
        await env.DB.prepare("DELETE FROM alarms WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, message: "Alarme supprim\xE9e" }, 200, origin);
      }
      if (path === "/api/study-sessions") {
        const userId = url.searchParams.get("userId");
        if (method === "GET") {
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const { results } = await env.DB.prepare("SELECT * FROM study_sessions WHERE user_id = ? ORDER BY completed_at DESC").bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, userId: userId2, durationSeconds, matiereName } = body;
          await env.DB.prepare(`
            INSERT INTO study_sessions (id, user_id, duration_seconds, matiere_name)
            VALUES (?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId2, durationSeconds, matiereName || "").run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }
      if (path === "/api/shop/profile") {
        await ensureShopAndProductTables(env.DB);
        const userId = url.searchParams.get("userId");
        if (method === "GET") {
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const profile = await env.DB.prepare("SELECT * FROM shop_profiles WHERE user_id = ?").bind(userId).first();
          let subscriberCount = 0;
          try {
            const subRes = await env.DB.prepare("SELECT COUNT(*) as count FROM seller_follows WHERE seller_id = ?").bind(userId).first();
            subscriberCount = subRes?.count || 0;
          } catch (e) {
          }
          return jsonResponse({
            success: true,
            data: profile ? { ...profile, subscriber_count: subscriberCount } : null
          }, 200, origin);
        }
        if (method === "PUT" || method === "POST") {
          const body = await request.json();
          await env.DB.prepare(`
            INSERT INTO shop_profiles (user_id, shop_name, shop_phone, shop_whatsapp, shop_avatar_url, shop_category, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
              shop_name = excluded.shop_name,
              shop_phone = excluded.shop_phone,
              shop_whatsapp = excluded.shop_whatsapp,
              shop_avatar_url = excluded.shop_avatar_url,
              shop_category = excluded.shop_category,
              updated_at = CURRENT_TIMESTAMP
          `).bind(body.userId, body.shopName, body.shopPhone, body.shopWhatsapp, body.shopAvatarUrl || null, body.shopCategory || "Vente digital (PDF)").run();
          return jsonResponse({ success: true, message: "Profil boutique mis \xE0 jour" }, 200, origin);
        }
      }
      if ((path === "/api/shop/delete" || path === "/api/shop/profile" && method === "DELETE") && (method === "POST" || method === "DELETE")) {
        await ensureShopAndProductTables(env.DB);
        const body = await request.json().catch(() => ({}));
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        let userId = null;
        if (token) {
          try {
            const payload = await verifyJWT(token);
            userId = payload?.userId;
          } catch (e) {
          }
        }
        if (!userId) {
          userId = body.userId || url.searchParams.get("userId");
        }
        const shopName = (body.shopName || "").trim();
        let shop = null;
        if (userId) {
          shop = await env.DB.prepare("SELECT * FROM shop_profiles WHERE user_id = ?").bind(userId).first();
        }
        if (!shop && shopName) {
          shop = await env.DB.prepare("SELECT * FROM shop_profiles WHERE LOWER(shop_name) = LOWER(?)").bind(shopName).first();
          if (shop && !userId)
            userId = shop.user_id;
        }
        if (userId) {
          await env.DB.prepare(`
            DELETE FROM user_product_interactions WHERE product_id IN (SELECT id FROM products WHERE seller_id = ?)
          `).bind(userId).run().catch(() => {
          });
          await env.DB.prepare(`
            DELETE FROM cart_items WHERE product_id IN (SELECT id FROM products WHERE seller_id = ?)
          `).bind(userId).run().catch(() => {
          });
          await env.DB.prepare("DELETE FROM products WHERE seller_id = ?").bind(userId).run().catch(() => {
          });
          await env.DB.prepare("DELETE FROM seller_follows WHERE seller_id = ? OR user_id = ?").bind(userId, userId).run().catch(() => {
          });
          await env.DB.prepare("DELETE FROM shop_profiles WHERE user_id = ?").bind(userId).run().catch(() => {
          });
        } else if (shopName) {
          await env.DB.prepare("DELETE FROM shop_profiles WHERE LOWER(shop_name) = LOWER(?)").bind(shopName).run().catch(() => {
          });
        }
        return jsonResponse({
          success: true,
          message: "La boutique et toutes ses donn\xE9es associ\xE9es ont \xE9t\xE9 supprim\xE9es d\xE9finitivement."
        }, 200, origin);
      }
      if (path === "/api/shop/analytics" && method === "GET") {
        await ensureShopAndProductTables(env.DB);
        const userId = url.searchParams.get("userId");
        if (!userId)
          return errorResponse("userId requis", 400, origin);
        const totalsRes = await env.DB.prepare(
          "SELECT COALESCE(SUM(views), 0) as total_views, COALESCE(SUM(sales), 0) as total_sales FROM products WHERE seller_id = ?"
        ).bind(userId).first().catch(() => ({ total_views: 0, total_sales: 0 }));
        let subscriberCount = 0;
        try {
          const subRes = await env.DB.prepare(
            "SELECT COUNT(*) as count FROM seller_follows WHERE seller_id = ?"
          ).bind(userId).first();
          subscriberCount = subRes?.count || 0;
        } catch (e) {
        }
        const prodsRes = await env.DB.prepare(
          `SELECT id, title, price, views, sales, image_urls_json, is_boosted, category
           FROM products WHERE seller_id = ?
           ORDER BY (views + sales * 3) DESC, sales DESC, views DESC LIMIT 100`
        ).bind(userId).all().catch(() => ({ results: [] }));
        const products = (prodsRes?.results || []).map((p) => {
          let firstImage = null;
          try {
            if (p.image_urls_json) {
              const parsed = JSON.parse(p.image_urls_json);
              firstImage = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null;
            }
          } catch (e) {
          }
          return {
            id: p.id,
            title: p.title,
            price: p.price,
            views: p.views || 0,
            sales: p.sales || 0,
            category: p.category,
            imageUrl: firstImage,
            isBoosted: Boolean(p.is_boosted),
            performanceScore: (p.views || 0) + (p.sales || 0) * 3
          };
        });
        return jsonResponse({
          success: true,
          data: {
            total_views: totalsRes?.total_views || 0,
            total_sales: totalsRes?.total_sales || 0,
            subscriber_count: subscriberCount,
            products
          }
        }, 200, origin);
      }
      async function ensureShopAndProductTables(db) {
        try {
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS shop_profiles (
              user_id TEXT PRIMARY KEY,
              shop_name TEXT NOT NULL,
              shop_phone TEXT,
              shop_whatsapp TEXT,
              shop_avatar_url TEXT,
              shop_category TEXT DEFAULT 'Vente digital (PDF)',
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
          try {
            await db.prepare("ALTER TABLE shop_profiles ADD COLUMN shop_category TEXT DEFAULT 'Vente digital (PDF)'").run();
          } catch (e) {
          }
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS products (
              id TEXT PRIMARY KEY,
              seller_id TEXT NOT NULL,
              seller_name TEXT DEFAULT '\xC9tudiant',
              seller_school TEXT DEFAULT '',
              seller_filiere TEXT DEFAULT '',
              seller_country TEXT DEFAULT "C\xF4te d'Ivoire",
              seller_phone TEXT DEFAULT '',
              seller_whatsapp TEXT DEFAULT '',
              seller_avatar_url TEXT,
              title TEXT NOT NULL,
              description TEXT DEFAULT '',
              price TEXT NOT NULL,
              currency TEXT DEFAULT 'FCFA',
              category TEXT DEFAULT 'Vente digital (PDF)',
              image_urls_json TEXT DEFAULT '[]',
              views INTEGER DEFAULT 0,
              sales INTEGER DEFAULT 0,
              is_boosted INTEGER DEFAULT 0,
              boost_formula TEXT,
              boost_views_target INTEGER DEFAULT 0,
              boost_end_date TEXT,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
          const addCols = [
            "ALTER TABLE products ADD COLUMN seller_name TEXT DEFAULT '\xC9tudiant'",
            "ALTER TABLE products ADD COLUMN seller_school TEXT DEFAULT ''",
            "ALTER TABLE products ADD COLUMN seller_filiere TEXT DEFAULT ''",
            `ALTER TABLE products ADD COLUMN seller_country TEXT DEFAULT "C\xF4te d'Ivoire"`,
            "ALTER TABLE products ADD COLUMN seller_phone TEXT DEFAULT ''",
            "ALTER TABLE products ADD COLUMN seller_whatsapp TEXT DEFAULT ''",
            "ALTER TABLE products ADD COLUMN seller_avatar_url TEXT",
            "ALTER TABLE products ADD COLUMN currency TEXT DEFAULT 'FCFA'",
            "ALTER TABLE products ADD COLUMN views INTEGER DEFAULT 0",
            "ALTER TABLE products ADD COLUMN sales INTEGER DEFAULT 0",
            "ALTER TABLE products ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP"
          ];
          for (const stmt of addCols) {
            try {
              await db.prepare(stmt).run();
            } catch (e) {
            }
          }
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS seller_follows (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              seller_id TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(user_id, seller_id)
            )
          `).run();
          await db.prepare(`
            CREATE TABLE IF NOT EXISTS user_product_interactions (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              product_id TEXT NOT NULL,
              interaction_type TEXT DEFAULT 'view',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
        } catch (e) {
          console.warn("[ensureShopAndProductTables warning]", e);
        }
      }
      __name(ensureShopAndProductTables, "ensureShopAndProductTables");
      if (path === "/api/products") {
        if (method === "GET") {
          await ensureShopAndProductTables(env.DB);
          const category = url.searchParams.get("category");
          const search = url.searchParams.get("search");
          const userId = url.searchParams.get("userId");
          const sellerId = url.searchParams.get("sellerId");
          const pageParam = url.searchParams.get("page");
          const limitParam = url.searchParams.get("limit");
          const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : null;
          const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 24;
          let query = "SELECT * FROM products WHERE 1=1";
          const params = [];
          if (category && category !== "Tous") {
            query += " AND category = ?";
            params.push(category);
          }
          if (sellerId) {
            query += " AND seller_id = ?";
            params.push(sellerId);
          }
          if (search) {
            query += " AND (title LIKE ? OR description LIKE ? OR category LIKE ? OR seller_name LIKE ? OR seller_school LIKE ? OR seller_filiere LIKE ?)";
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s);
          }
          query += " ORDER BY created_at DESC";
          const { results } = await env.DB.prepare(query).bind(...params).all();
          let productsList = results || [];
          if (userId && productsList.length > 0) {
            try {
              const [userRes, matieresRes, filesRes, docInteractionsRes, prodInteractionsRes, followsRes] = await Promise.all([
                env.DB.prepare("SELECT school, filiere, country FROM users WHERE id = ?").bind(userId).first(),
                env.DB.prepare("SELECT name FROM matieres WHERE user_id = ?").bind(userId).all(),
                env.DB.prepare("SELECT name, matiere_id FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT 60").bind(userId).all(),
                env.DB.prepare("SELECT document_id FROM user_document_interactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId).all().catch(() => ({ results: [] })),
                env.DB.prepare("SELECT product_id FROM user_product_interactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId).all().catch(() => ({ results: [] })),
                env.DB.prepare("SELECT seller_id FROM seller_follows WHERE user_id = ?").bind(userId).all().catch(() => ({ results: [] }))
              ]);
              const userSchool = (userRes?.school || "").toLowerCase().trim();
              const userFiliere = (userRes?.filiere || "").toLowerCase().trim();
              const userCountry = (userRes?.country || "").toLowerCase().trim();
              const userMatiereNames = (matieresRes?.results || []).map((m) => (m.name || "").toLowerCase().trim()).filter(Boolean);
              const userKeywords = [];
              (filesRes?.results || []).forEach((f) => {
                const combined = `${f.name || ""} ${f.matiere_id || ""}`.toLowerCase();
                const words = combined.replace(/[^a-z0-9à-ÿ]/gi, " ").split(/\s+/).filter((w) => w.length >= 3);
                userKeywords.push(...words);
              });
              const uniqueUserKeywords = Array.from(new Set(userKeywords)).slice(0, 40);
              const followedSellerIds = new Set((followsRes?.results || []).map((f) => f.seller_id));
              const interactedProductIds = new Set((prodInteractionsRes?.results || []).map((p) => p.product_id));
              const scoredProducts = productsList.map((prod) => {
                let score = 0;
                const pSchool = (prod.seller_school || "").toLowerCase().trim();
                const pFiliere = (prod.seller_filiere || "").toLowerCase().trim();
                const pCountry = (prod.seller_country || "").toLowerCase().trim();
                const pCategory = (prod.category || "").toLowerCase().trim();
                const pTitle = (prod.title || "").toLowerCase().trim();
                const pDesc = (prod.description || "").toLowerCase().trim();
                if (followedSellerIds.has(prod.seller_id)) {
                  score += 100;
                }
                if (prod.is_boosted) {
                  score += 60;
                }
                if (userFiliere && (pFiliere.includes(userFiliere) || userFiliere.includes(pFiliere) || pTitle.includes(userFiliere) || pDesc.includes(userFiliere) || pCategory.includes(userFiliere))) {
                  score += 50;
                }
                if (userSchool && (pSchool.includes(userSchool) || userSchool.includes(pSchool) || pTitle.includes(userSchool) || pDesc.includes(userSchool))) {
                  score += 40;
                }
                if (userMatiereNames.some((m) => m && (pTitle.includes(m) || pDesc.includes(m) || pCategory.includes(m) || m.includes(pCategory)))) {
                  score += 35;
                }
                if (userCountry && pCountry && (pCountry.includes(userCountry) || userCountry.includes(pCountry))) {
                  score += 25;
                }
                if (interactedProductIds.has(prod.id)) {
                  score += 20;
                }
                let matchedKws = 0;
                for (const kw of uniqueUserKeywords) {
                  if (pTitle.includes(kw) || pDesc.includes(kw) || pCategory.includes(kw)) {
                    matchedKws++;
                    if (matchedKws >= 3)
                      break;
                  }
                }
                score += matchedKws * 10;
                const ageDays = (Date.now() - new Date(prod.created_at || Date.now()).getTime()) / (1e3 * 60 * 60 * 24);
                const recencyBonus = ageDays < 1 ? 20 : ageDays < 7 ? 10 : ageDays < 30 ? 5 : 0;
                score += recencyBonus;
                const popBonus = Math.min(15, (prod.sales || 0) * 3 + (prod.views || 0) * 0.2);
                score += popBonus;
                return { ...prod, _relevance_score: Math.round(score) };
              });
              scoredProducts.sort((a, b) => {
                if (b._relevance_score !== a._relevance_score) {
                  return b._relevance_score - a._relevance_score;
                }
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
              productsList = scoredProducts;
            } catch (algoErr) {
              console.warn("[Products Recommendation Algorithm Error]", algoErr);
            }
          }
          if (page !== null) {
            const total = productsList.length;
            const offset = (page - 1) * limit;
            const paginatedData = productsList.slice(offset, offset + limit);
            const hasMore = offset + limit < total;
            return jsonResponse({
              success: true,
              data: paginatedData,
              pagination: {
                page,
                limit,
                total,
                hasMore
              }
            }, 200, origin);
          }
          return jsonResponse({ success: true, data: productsList }, 200, origin);
        }
        if (method === "POST") {
          await ensureShopAndProductTables(env.DB);
          const body = await request.json();
          const {
            id,
            sellerId,
            sellerName,
            sellerSchool,
            sellerFiliere,
            sellerCountry,
            sellerPhone,
            sellerWhatsapp,
            sellerAvatarUrl,
            title,
            description,
            price,
            currency,
            category,
            imageUrlsJson,
            isBoosted,
            boostFormula,
            boostViewsTarget,
            boostEndDate
          } = body;
          if (!sellerId || !title || !price) {
            return errorResponse("sellerId, title et price sont obligatoires", 400, origin);
          }
          let finalSellerName = sellerName;
          let finalSellerSchool = sellerSchool;
          let finalSellerFiliere = sellerFiliere;
          let finalSellerCountry = sellerCountry;
          let finalSellerPhone = sellerPhone;
          let finalSellerWhatsapp = sellerWhatsapp;
          let finalSellerAvatar = sellerAvatarUrl;
          if (!finalSellerName || !finalSellerSchool || !finalSellerFiliere) {
            try {
              const [userRow, shopRow] = await Promise.all([
                env.DB.prepare("SELECT name, school, filiere, country, phone, avatar_url FROM users WHERE id = ?").bind(sellerId).first(),
                env.DB.prepare("SELECT shop_name, shop_phone, shop_whatsapp, shop_avatar_url FROM shop_profiles WHERE user_id = ?").bind(sellerId).first()
              ]);
              finalSellerName = finalSellerName || shopRow?.shop_name || userRow?.name || "\xC9tudiant";
              finalSellerSchool = finalSellerSchool || userRow?.school || "";
              finalSellerFiliere = finalSellerFiliere || userRow?.filiere || "";
              finalSellerCountry = finalSellerCountry || userRow?.country || "C\xF4te d'Ivoire";
              finalSellerPhone = finalSellerPhone || shopRow?.shop_phone || userRow?.phone || "";
              finalSellerWhatsapp = finalSellerWhatsapp || shopRow?.shop_whatsapp || userRow?.phone || "";
              finalSellerAvatar = finalSellerAvatar || shopRow?.shop_avatar_url || userRow?.avatar_url || null;
            } catch (e) {
            }
          }
          const productId = id || crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO products (
              id, seller_id, seller_name, seller_school, seller_filiere, seller_country,
              seller_phone, seller_whatsapp, seller_avatar_url, title, description,
              price, currency, category, image_urls_json, is_boosted, boost_formula,
              boost_views_target, boost_end_date, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              seller_name = excluded.seller_name,
              seller_school = excluded.seller_school,
              seller_filiere = excluded.seller_filiere,
              seller_country = excluded.seller_country,
              seller_phone = excluded.seller_phone,
              seller_whatsapp = excluded.seller_whatsapp,
              seller_avatar_url = excluded.seller_avatar_url,
              title = excluded.title,
              description = excluded.description,
              price = excluded.price,
              currency = excluded.currency,
              category = excluded.category,
              image_urls_json = excluded.image_urls_json,
              is_boosted = excluded.is_boosted,
              boost_formula = excluded.boost_formula,
              boost_views_target = excluded.boost_views_target,
              boost_end_date = excluded.boost_end_date,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            productId,
            sellerId,
            finalSellerName || "\xC9tudiant",
            finalSellerSchool || "",
            finalSellerFiliere || "",
            finalSellerCountry || "C\xF4te d'Ivoire",
            finalSellerPhone || "",
            finalSellerWhatsapp || "",
            finalSellerAvatar || null,
            title,
            description || "",
            price,
            currency || "FCFA",
            category || "Vente digital (PDF)",
            imageUrlsJson || "[]",
            isBoosted ? 1 : 0,
            boostFormula || null,
            boostViewsTarget || 0,
            boostEndDate || null
          ).run();
          return jsonResponse({ success: true, id: productId, message: "Produit publi\xE9 avec succ\xE8s" }, 201, origin);
        }
      }
      if (path.startsWith("/api/products/") && method === "DELETE") {
        const id = path.split("/")[3];
        await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, message: "Produit supprim\xE9" }, 200, origin);
      }
      if (path.match(/^\/api\/products\/[^/]+\/image$/) && method === "GET") {
        await ensureShopAndProductTables(env.DB);
        const id = path.split("/")[3];
        const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
        if (!product) {
          return new Response("Image introuvable", { status: 404, headers: corsHeaders(origin) });
        }
        let firstImg = "";
        try {
          const imgs = JSON.parse(product.image_urls_json || "[]");
          if (Array.isArray(imgs) && imgs.length > 0 && imgs[0]) {
            firstImg = imgs[0];
          }
        } catch (e) {
        }
        const appOrigin = url.origin.includes("localhost") ? url.origin : "https://studycloud.dkd-technologies.com";
        if (!firstImg) {
          const pngBytes2 = Uint8Array.from(atob(DNA_LOGO_PNG_B64), (c) => c.charCodeAt(0));
          return new Response(pngBytes2.buffer, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=86400, s-maxage=86400",
              ...corsHeaders(origin)
            }
          });
        }
        if (firstImg.startsWith("data:")) {
          const match = firstImg.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1] || "image/jpeg";
            const b64Data = match[2];
            const binaryString = atob(b64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return new Response(bytes.buffer, {
              status: 200,
              headers: {
                "Content-Type": mimeType,
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
                ...corsHeaders(origin)
              }
            });
          }
        } else if (env.BUCKET && (firstImg.includes("/api/storage/file/") || firstImg.startsWith("products/images/"))) {
          try {
            let r2Key = firstImg;
            if (r2Key.includes("/api/storage/file/")) {
              r2Key = decodeURIComponent(r2Key.split("/api/storage/file/")[1].split("?")[0]);
            }
            const r2Object = await env.BUCKET.get(r2Key);
            if (r2Object) {
              const headers = new Headers();
              r2Object.writeHttpMetadata(headers);
              headers.set("Content-Type", r2Object.httpMetadata?.contentType || "image/jpeg");
              headers.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
              headers.set("Access-Control-Allow-Origin", origin);
              return new Response(r2Object.body, { status: 200, headers });
            }
          } catch (r2Err) {
            console.warn("[R2 Product Image Fetch Error]", r2Err);
          }
        } else if (firstImg.startsWith("http://") || firstImg.startsWith("https://")) {
          return Response.redirect(firstImg, 302);
        }
        const pngBytes = Uint8Array.from(atob(DNA_LOGO_PNG_B64), (c) => c.charCodeAt(0));
        return new Response(pngBytes.buffer, {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
            ...corsHeaders(origin)
          }
        });
      }
      if (path.match(/^\/api\/products\/[^/]+\/banner$/) && method === "GET") {
        await ensureShopAndProductTables(env.DB);
        const id = path.split("/")[3];
        const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
        if (!product)
          return new Response("Produit introuvable", { status: 404 });
        let imgUrl = "";
        try {
          const imgs = JSON.parse(product.image_urls_json || "[]");
          if (imgs && imgs.length > 0)
            imgUrl = imgs[0];
        } catch (e) {
        }
        const title = escapeHtml(product.title || "Produit StudyCloud");
        const price = escapeHtml(product.price || "Prix sur demande");
        const category = escapeHtml(product.category || "Documents & Services");
        const seller = escapeHtml(product.seller_name || "Vendeur \xC9tudiant");
        const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0f19" />
      <stop offset="50%" stop-color="#111827" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ea580c" />
      <stop offset="100%" stop-color="#f97316" />
    </linearGradient>
    <clipPath id="prodClip">
      <rect x="60" y="80" width="460" height="470" rx="28" ry="28" />
    </clipPath>
  </defs>

  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <circle cx="1060" cy="110" r="180" fill="#f97316" opacity="0.1" />
  <circle cx="150" cy="520" r="180" fill="#6366f1" opacity="0.1" />

  <!-- Product Image Box -->
  <rect x="56" y="76" width="468" height="478" rx="32" ry="32" fill="#1e293b" stroke="#334155" stroke-width="4" />
  ${imgUrl ? `<image href="${escapeHtml(imgUrl)}" x="60" y="80" width="460" height="470" preserveAspectRatio="xMidYMid slice" clip-path="url(#prodClip)" />` : `
    <g transform="translate(230, 270)">
      <circle cx="60" cy="40" r="50" fill="#334155" />
      <text x="60" y="48" font-family="system-ui, sans-serif" font-size="32" font-weight="bold" fill="#f97316" text-anchor="middle">DOC</text>
    </g>
  `}

  <!-- Badge Logo StudyCloud en haut de l'image -->
  <g transform="translate(80, 100)">
    <rect width="200" height="44" rx="22" fill="#000000" fill-opacity="0.85" stroke="#f97316" stroke-width="2" />
    <g transform="translate(14, 8) scale(0.55)">
      ${DNA_LOGO_SVG}
    </g>
    <text x="52" y="28" font-family="system-ui, sans-serif" font-size="15" font-weight="900" fill="#ffffff" letter-spacing="1">STUDYCLOUD</text>
  </g>

  <!-- Right Section: Details -->
  <g transform="translate(560, 95)">
    <rect width="210" height="38" rx="12" fill="#f97316" fill-opacity="0.2" stroke="#f97316" stroke-width="1.5" />
    <text x="16" y="24" font-family="system-ui, sans-serif" font-size="14" font-weight="900" fill="#f97316" letter-spacing="1">PRODUIT LIBRAIRIE</text>
  </g>

  <text x="560" y="175" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#94a3b8">${category}</text>

  <text x="560" y="235" font-family="system-ui, sans-serif" font-size="36" font-weight="900" fill="#ffffff">
    ${title.length > 32 ? title.substring(0, 30) + "..." : title}
  </text>

  <!-- Price Badge -->
  <g transform="translate(560, 280)">
    <rect width="320" height="70" rx="20" fill="url(#accentGrad)" />
    <text x="24" y="48" font-family="system-ui, sans-serif" font-size="36" font-weight="900" fill="#ffffff">${price}</text>
  </g>

  <!-- Seller Badge -->
  <g transform="translate(560, 395)">
    <circle cx="24" cy="24" r="24" fill="#334155" stroke="#f97316" stroke-width="1.5" />
    <text x="24" y="32" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">\u{1F6D2}</text>
    <text x="64" y="20" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#94a3b8">Boutique du vendeur</text>
    <text x="64" y="42" font-family="system-ui, sans-serif" font-size="20" font-weight="800" fill="#ffffff">${seller}</text>
  </g>

  <!-- CTA -->
  <g transform="translate(560, 485)">
    <rect width="380" height="55" rx="16" fill="#16a34a" />
    <text x="35" y="35" font-family="system-ui, sans-serif" font-size="18" font-weight="900" fill="#ffffff">\u{1F4AC} Commander sur WhatsApp</text>
  </g>
</svg>`;
        return new Response(svg, {
          status: 200,
          headers: {
            "Content-Type": "image/svg+xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
            ...corsHeaders(origin)
          }
        });
      }
      if (path.match(/^\/api\/products\/[^/]+\/order$/) && method === "GET") {
        await ensureShopAndProductTables(env.DB);
        const id = path.split("/")[3];
        const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
        if (!product)
          return errorResponse("Produit introuvable", 404, origin);
        const [sellerUser, sellerShop] = await Promise.all([
          env.DB.prepare("SELECT id, name, phone, country FROM users WHERE id = ?").bind(product.seller_id).first(),
          env.DB.prepare("SELECT shop_name, shop_phone, shop_whatsapp FROM shop_profiles WHERE user_id = ?").bind(product.seller_id).first()
        ]);
        const rawPhone = product.seller_whatsapp || sellerShop?.shop_whatsapp || product.seller_phone || sellerShop?.shop_phone || sellerUser?.phone || "";
        let cleanPhone = String(rawPhone || "").replace(/\D/g, "");
        if (cleanPhone.length === 10 && cleanPhone.startsWith("0")) {
          cleanPhone = "225" + cleanPhone;
        } else if (cleanPhone.length === 8 && !cleanPhone.startsWith("225")) {
          cleanPhone = "225" + cleanPhone;
        }
        const appOrigin = url.origin.includes("localhost") ? url.origin : "https://studycloud.dkd-technologies.com";
        const productShareUrl = `${appOrigin}/share/product/${encodeURIComponent(product.id)}`;
        const bannerImageUrl = `${appOrigin}/api/products/${encodeURIComponent(product.id)}/image`;
        const autoMessage = `Bonjour ! Je suis int\xE9ress\xE9(e) par votre produit : *${product.title}* (${product.price}).

Lien vers le produit : ${productShareUrl}`;
        const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(autoMessage)}` : "";
        try {
          await env.DB.prepare("UPDATE products SET sales = sales + 1 WHERE id = ?").bind(product.id).run();
        } catch (e) {
        }
        if (url.searchParams.get("redirect") === "true" && whatsappUrl) {
          return Response.redirect(whatsappUrl, 302);
        }
        return jsonResponse({
          success: true,
          whatsappUrl,
          cleanPhone,
          message: autoMessage,
          productShareUrl,
          bannerImageUrl,
          product: {
            id: product.id,
            title: product.title,
            price: product.price,
            sellerName: product.seller_name || sellerShop?.shop_name || "Vendeur StudyCloud"
          }
        }, 200, origin);
      }
      if (path.match(/^\/share\/product\/[^/]+$/) && method === "GET") {
        await ensureShopAndProductTables(env.DB);
        const id = path.split("/")[3];
        const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
        const appOrigin = url.origin.includes("localhost") ? url.origin : "https://studycloud.dkd-technologies.com";
        if (!product) {
          return Response.redirect(`${appOrigin}/?view=products#librairie`, 302);
        }
        try {
          await env.DB.prepare("UPDATE products SET views = views + 1 WHERE id = ?").bind(id).run();
        } catch (e) {
        }
        const [sellerUser, sellerShop, relatedRes] = await Promise.all([
          env.DB.prepare("SELECT id, name, phone, school, filiere, country FROM users WHERE id = ?").bind(product.seller_id).first().catch(() => null),
          env.DB.prepare("SELECT shop_name, shop_phone, shop_whatsapp, shop_avatar_url, shop_category FROM shop_profiles WHERE user_id = ?").bind(product.seller_id).first().catch(() => null),
          env.DB.prepare("SELECT id, title, price, currency, image_urls_json FROM products WHERE seller_id = ? AND id != ? ORDER BY created_at DESC LIMIT 6").bind(product.seller_id, id).all().catch(() => ({ results: [] }))
        ]);
        const html = renderProductSharePageHtml(product, sellerShop, sellerUser, relatedRes?.results || [], appOrigin);
        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=180",
            ...corsHeaders(origin)
          }
        });
      }
      if (path === "/api/seller-follows") {
        await ensureShopAndProductTables(env.DB);
        if (method === "GET") {
          const userId = url.searchParams.get("userId");
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const { results } = await env.DB.prepare("SELECT seller_id FROM seller_follows WHERE user_id = ?").bind(userId).all();
          const followedSellerIds = (results || []).map((r) => r.seller_id);
          return jsonResponse({ success: true, followedSellerIds }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
          const { userId, sellerId, action } = body;
          if (!userId || !sellerId)
            return errorResponse("userId et sellerId requis", 400, origin);
          const existing = await env.DB.prepare("SELECT id FROM seller_follows WHERE user_id = ? AND seller_id = ?").bind(userId, sellerId).first();
          let isFollowing = false;
          if (action === "unfollow" || action !== "follow" && existing) {
            await env.DB.prepare("DELETE FROM seller_follows WHERE user_id = ? AND seller_id = ?").bind(userId, sellerId).run();
            isFollowing = false;
          } else {
            await env.DB.prepare("INSERT OR IGNORE INTO seller_follows (id, user_id, seller_id, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), userId, sellerId).run();
            isFollowing = true;
          }
          return jsonResponse({ success: true, isFollowing }, 200, origin);
        }
      }
      if (path.startsWith("/api/products/") && path.endsWith("/interact") && method === "POST") {
        await ensureShopAndProductTables(env.DB);
        const id = path.split("/")[3];
        const body = await request.json().catch(() => ({}));
        const { userId, type } = body;
        const interactionType = type || "view";
        if (userId && id) {
          try {
            await env.DB.prepare(`
              INSERT INTO user_product_interactions (id, user_id, product_id, interaction_type, created_at)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).bind(crypto.randomUUID(), userId, id, interactionType).run();
            await env.DB.prepare(`
              DELETE FROM user_product_interactions 
              WHERE created_at < datetime('now', '-30 days')
            `).run();
          } catch (e) {
          }
        }
        try {
          if (interactionType === "order" || interactionType === "click_order" || interactionType === "sale") {
            await env.DB.prepare("UPDATE products SET sales = sales + 1 WHERE id = ?").bind(id).run();
          } else {
            await env.DB.prepare("UPDATE products SET views = views + 1 WHERE id = ?").bind(id).run();
          }
        } catch (e) {
        }
        return jsonResponse({ success: true, message: "Interaction produit enregistr\xE9e" }, 200, origin);
      }
      if (path === "/api/cart") {
        const userId = url.searchParams.get("userId");
        if (method === "GET") {
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const { results } = await env.DB.prepare(`
            SELECT c.id as cart_item_id, c.quantity, p.*
            FROM cart_items c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ?
            ORDER BY c.added_at DESC
          `).bind(userId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
          const { userId: userId2, productId, quantity } = body;
          await env.DB.prepare(`
            INSERT INTO cart_items (id, user_id, product_id, quantity)
            VALUES (?, ?, ?, ?)
          `).bind(crypto.randomUUID(), userId2, productId, quantity || 1).run();
          return jsonResponse({ success: true }, 201, origin);
        }
        if (method === "DELETE") {
          const productId = url.searchParams.get("productId");
          const cartItemId = url.searchParams.get("id");
          if (userId && productId) {
            await env.DB.prepare("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?").bind(userId, productId).run();
          } else if (cartItemId) {
            await env.DB.prepare("DELETE FROM cart_items WHERE id = ?").bind(cartItemId).run();
          }
          return jsonResponse({ success: true, message: "Article retir\xE9 du panier" }, 200, origin);
        }
      }
      if (path === "/api/published-documents/check-duplicates" && method === "POST") {
        const body = await request.json().catch(() => ({}));
        const { userId, files } = body;
        if (!userId || !Array.isArray(files)) {
          return errorResponse("userId et liste files requis", 400, origin);
        }
        try {
          await env.DB.prepare(`
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
              country TEXT,
              info_mode TEXT DEFAULT 'all',
              file_name TEXT,
              file_size INTEGER DEFAULT 0,
              file_type TEXT,
              r2_key TEXT,
              file_url TEXT,
              is_public INTEGER DEFAULT 1,
              downloads_count INTEGER DEFAULT 0,
              views_count INTEGER DEFAULT 0,
              tags_json TEXT DEFAULT '[]',
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
        } catch (e) {
        }
        const duplicates = [];
        const seenInRequest = /* @__PURE__ */ new Set();
        for (const file of files) {
          const fileName = file.name || file.fileName || "";
          const fileSize = file.size || file.fileSize || 0;
          if (!fileName)
            continue;
          const normName = fileName.trim().toLowerCase();
          const reqKey = `${normName}_${fileSize}`;
          if (seenInRequest.has(normName) || fileSize > 0 && seenInRequest.has(reqKey)) {
            duplicates.push({
              fileId: file.id || file.fileId,
              fileName,
              isDuplicate: true,
              message: "Un fichier a \xE9t\xE9 recal\xE9 car son deuxi\xE8me a \xE9t\xE9 enregistr\xE9"
            });
            continue;
          }
          seenInRequest.add(normName);
          if (fileSize > 0)
            seenInRequest.add(reqKey);
          const existing = await env.DB.prepare(`
            SELECT id, title, file_name, file_size 
            FROM published_documents 
            WHERE (user_id = ? AND LOWER(file_name) = LOWER(?))
               OR (user_id = ? AND file_size > 0 AND file_size = ? AND LOWER(file_name) = LOWER(?))
            LIMIT 1
          `).bind(userId, fileName, userId, fileSize, fileName).first();
          if (existing) {
            duplicates.push({
              fileId: file.id || file.fileId,
              fileName,
              isDuplicate: true,
              existingTitle: existing.title,
              message: "Un fichier a \xE9t\xE9 recal\xE9 car son deuxi\xE8me a \xE9t\xE9 enregistr\xE9"
            });
          }
        }
        return jsonResponse({ success: true, duplicates }, 200, origin);
      }
      if (path === "/api/published-documents/filters" && method === "GET") {
        try {
          const [userSchoolsRes, pubSchoolsRes] = await Promise.all([
            env.DB.prepare(`SELECT DISTINCT school FROM users WHERE school IS NOT NULL AND TRIM(school) != ''`).all().catch(() => ({ results: [] })),
            env.DB.prepare(`SELECT DISTINCT school FROM published_documents WHERE school IS NOT NULL AND TRIM(school) != ''`).all().catch(() => ({ results: [] }))
          ]);
          const schoolsSet = /* @__PURE__ */ new Set();
          (userSchoolsRes?.results || []).forEach((r) => {
            const s = (r.school || "").trim();
            if (s && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined")
              schoolsSet.add(s);
          });
          (pubSchoolsRes?.results || []).forEach((r) => {
            const s = (r.school || "").trim();
            if (s && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined")
              schoolsSet.add(s);
          });
          const schools = Array.from(schoolsSet).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
          const pubMatieresRes = await env.DB.prepare(
            `SELECT DISTINCT matiere_name FROM published_documents WHERE matiere_name IS NOT NULL AND TRIM(matiere_name) != ''`
          ).all().catch(() => ({ results: [] }));
          const matieresSet = /* @__PURE__ */ new Set();
          (pubMatieresRes?.results || []).forEach((r) => {
            const m = (r.matiere_name || "").trim();
            if (m && m.toLowerCase() !== "null" && m.toLowerCase() !== "undefined")
              matieresSet.add(m);
          });
          const matieres = Array.from(matieresSet).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
          const pubCatsRes = await env.DB.prepare(
            `SELECT DISTINCT category FROM published_documents WHERE category IS NOT NULL AND TRIM(category) != ''`
          ).all().catch(() => ({ results: [] }));
          const nameCategoryMap = [
            { patterns: ["cours", "lecture", "support de cours", "course"], label: "Cours" },
            { patterns: ["td", "tp", "travaux dirig\xE9s", "travaux pratiques", "exercice"], label: "TD/TP" },
            { patterns: ["exam", "examen", "devoir", "concours", "epreuve", "\xE9preuve", "ds", "controle", "contr\xF4le"], label: "Examens" },
            { patterns: ["projet", "project", "rapport", "memoire", "m\xE9moire", "pfe", "tfe", "these", "th\xE8se"], label: "Projets" },
            { patterns: ["note", "notes", "fiche", "resume", "r\xE9sum\xE9", "synthese", "synth\xE8se", "recap", "r\xE9cap"], label: "Notes" }
          ];
          const undetectedRes = await env.DB.prepare(
            `SELECT file_name FROM published_documents WHERE (category IS NULL OR TRIM(category) = '') AND file_name IS NOT NULL`
          ).all().catch(() => ({ results: [] }));
          const categoriesSet = /* @__PURE__ */ new Set();
          (pubCatsRes?.results || []).forEach((r) => {
            const c = (r.category || "").trim();
            if (c && c.toLowerCase() !== "null" && c.toLowerCase() !== "undefined")
              categoriesSet.add(c);
          });
          (undetectedRes?.results || []).forEach((r) => {
            const fname = (r.file_name || "").toLowerCase().replace(/[_\-.]/g, " ");
            for (const { patterns, label } of nameCategoryMap) {
              if (patterns.some((p) => fname.includes(p))) {
                categoriesSet.add(label);
                break;
              }
            }
          });
          const canonicalOrder = ["Cours", "TD/TP", "Examens", "Projets", "Notes"];
          const categories = [
            ...canonicalOrder.filter((c) => categoriesSet.has(c)),
            ...[...categoriesSet].filter((c) => !canonicalOrder.includes(c)).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }))
          ];
          return jsonResponse({ success: true, schools, matieres, categories }, 200, origin);
        } catch (filterErr) {
          return jsonResponse({ success: false, error: filterErr.message, schools: [], matieres: [], categories: [] }, 500, origin);
        }
      }
      if (path === "/api/published-documents/count" && method === "GET") {
        try {
          const userId = url.searchParams.get("userId") || request.headers.get("x-user-id");
          if (!userId) {
            return jsonResponse({ success: true, count: 0 }, 200, origin);
          }
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS published_documents (
              id TEXT PRIMARY KEY,
              user_id TEXT NOT NULL,
              title TEXT NOT NULL,
              description TEXT,
              school TEXT,
              filiere TEXT,
              matiere_name TEXT,
              level TEXT,
              category TEXT DEFAULT 'Pas d''informations',
              author_name TEXT,
              country TEXT,
              info_mode TEXT DEFAULT 'all',
              file_name TEXT,
              file_size INTEGER DEFAULT 0,
              file_type TEXT,
              r2_key TEXT,
              file_url TEXT,
              is_public INTEGER DEFAULT 1,
              downloads_count INTEGER DEFAULT 0,
              views_count INTEGER DEFAULT 0,
              tags_json TEXT DEFAULT '[]',
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `).run().catch(() => {
          });
          const row = await env.DB.prepare(
            `SELECT COUNT(*) as count FROM published_documents WHERE user_id = ?`
          ).bind(userId).first();
          const count = row && typeof row.count === "number" ? row.count : 0;
          return jsonResponse({ success: true, count }, 200, origin);
        } catch (countErr) {
          console.warn("[Published Documents Count Error]", countErr);
          return jsonResponse({ success: true, count: 0 }, 200, origin);
        }
      }
      if (path === "/api/published-documents") {
        if (method === "GET") {
          const school = url.searchParams.get("school");
          const filiere = url.searchParams.get("filiere");
          const country = url.searchParams.get("country");
          const category = url.searchParams.get("category");
          const matiereName = url.searchParams.get("matiereName") || url.searchParams.get("matiere_name");
          const level = url.searchParams.get("level");
          const search = url.searchParams.get("search");
          const isPublicParam = url.searchParams.get("isPublic");
          const userId = url.searchParams.get("userId");
          const sort = url.searchParams.get("sort");
          const pageParam = url.searchParams.get("page");
          const limitParam = url.searchParams.get("limit");
          const seed = url.searchParams.get("seed") || url.searchParams.get("_t") || "";
          const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : null;
          const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 30;
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
          } catch (e) {
          }
          let query = "SELECT * FROM published_documents WHERE 1=1";
          const params = [];
          if (school) {
            query += " AND school = ?";
            params.push(school);
          }
          if (filiere) {
            query += " AND filiere = ?";
            params.push(filiere);
          }
          if (country) {
            query += " AND country = ?";
            params.push(country);
          }
          if (category && category !== "Tous") {
            query += " AND category = ?";
            params.push(category);
          }
          if (matiereName) {
            query += " AND matiere_name = ?";
            params.push(matiereName);
          }
          if (level) {
            query += " AND level = ?";
            params.push(level);
          }
          if (isPublicParam !== null && isPublicParam !== void 0) {
            query += " AND is_public = ?";
            params.push(isPublicParam === "true" || isPublicParam === "1" ? 1 : 0);
          } else {
            query += " AND is_public = 1";
          }
          if (search) {
            query += " AND (title LIKE ? OR description LIKE ? OR matiere_name LIKE ? OR author_name LIKE ? OR tags_json LIKE ? OR country LIKE ? OR file_name LIKE ? OR category LIKE ?)";
            const s = `%${search}%`;
            params.push(s, s, s, s, s, s, s, s);
          }
          query += " ORDER BY created_at DESC";
          const { results } = await env.DB.prepare(query).bind(...params).all();
          let docsList = results || [];
          if (sort !== "recent" && docsList.length > 0) {
            try {
              let userSchool = "";
              let userFiliere = "";
              let userCountry = "";
              let userMatiereNames = [];
              let uniqueUserKeywords = [];
              const interactedDocIds = /* @__PURE__ */ new Set();
              if (userId) {
                const [userRes, matieresRes, filesRes, interactionsRes] = await Promise.all([
                  env.DB.prepare("SELECT school, filiere, country FROM users WHERE id = ?").bind(userId).first(),
                  env.DB.prepare("SELECT name FROM matieres WHERE user_id = ?").bind(userId).all(),
                  env.DB.prepare("SELECT name, matiere_id FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT 60").bind(userId).all(),
                  env.DB.prepare("SELECT document_id, interaction_type FROM user_document_interactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(userId).all()
                ]);
                userSchool = (userRes?.school || "").toLowerCase().trim();
                userFiliere = (userRes?.filiere || "").toLowerCase().trim();
                userCountry = (userRes?.country || "").toLowerCase().trim();
                userMatiereNames = (matieresRes?.results || []).map((m) => (m.name || "").toLowerCase().trim()).filter(Boolean);
                const userKeywords = [];
                (filesRes?.results || []).forEach((f) => {
                  const combined = `${f.name || ""} ${f.matiere_id || ""}`.toLowerCase();
                  const words = combined.replace(/[^a-z0-9à-ÿ]/gi, " ").split(/\s+/).filter((w) => w.length >= 3);
                  userKeywords.push(...words);
                });
                uniqueUserKeywords = Array.from(new Set(userKeywords)).slice(0, 40);
                (interactionsRes?.results || []).forEach((i) => {
                  if (i.document_id)
                    interactedDocIds.add(i.document_id);
                });
              }
              const scoredDocs = docsList.map((doc) => {
                let score = 0;
                const dSchool = (doc.school || "").toLowerCase().trim();
                const dFiliere = (doc.filiere || "").toLowerCase().trim();
                const dCountry = (doc.country || "").toLowerCase().trim();
                const dMatiere = (doc.matiere_name || "").toLowerCase().trim();
                const dTitle = (doc.title || "").toLowerCase().trim();
                const dDesc = (doc.description || "").toLowerCase().trim();
                const dTags = (doc.tags_json || "").toLowerCase().trim();
                if (userFiliere && dFiliere && (dFiliere.includes(userFiliere) || userFiliere.includes(dFiliere))) {
                  score += 50;
                }
                if (userSchool && dSchool && (dSchool.includes(userSchool) || userSchool.includes(dSchool))) {
                  score += 40;
                }
                if (userMatiereNames.some((m) => m && (dMatiere.includes(m) || dTitle.includes(m) || m.includes(dMatiere)))) {
                  score += 35;
                }
                if (interactedDocIds.has(doc.id)) {
                  score += 10;
                }
                let matchedKws = 0;
                for (const kw of uniqueUserKeywords) {
                  if (dTitle.includes(kw) || dDesc.includes(kw) || dTags.includes(kw) || dMatiere.includes(kw)) {
                    matchedKws++;
                    if (matchedKws >= 3)
                      break;
                  }
                }
                score += matchedKws * 10;
                if (userCountry && dCountry && (dCountry.includes(userCountry) || userCountry.includes(dCountry))) {
                  score += 15;
                }
                const popBonus = Math.min(10, (doc.downloads_count || 0) * 1.5 + (doc.views_count || 0) * 0.3);
                const ageDays = (Date.now() - new Date(doc.created_at || Date.now()).getTime()) / (1e3 * 60 * 60 * 24);
                const recencyBonus = ageDays < 7 ? 5 : ageDays < 30 ? 2 : 0;
                score += popBonus + recencyBonus;
                if (seed) {
                  let hash = 0;
                  const str = `${doc.id}_${seed}`;
                  for (let i = 0; i < str.length; i++) {
                    hash = (hash << 5) - hash + str.charCodeAt(i);
                    hash |= 0;
                  }
                  const rotateBonus = Math.abs(hash) % 36;
                  score += rotateBonus;
                }
                return { ...doc, _relevance_score: Math.round(score) };
              });
              scoredDocs.sort((a, b) => {
                if (b._relevance_score !== a._relevance_score) {
                  return b._relevance_score - a._relevance_score;
                }
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
              docsList = scoredDocs;
            } catch (algoErr) {
              console.warn("[Recommendation Algorithm Error]", algoErr);
            }
          }
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
        if (method === "POST") {
          const body = await request.json();
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
            return errorResponse("userId, title et fileName sont obligatoires", 400, origin);
          }
          const fNameLower = (fileName || "").toLowerCase();
          const fTypeLower = (fileType || "").toLowerCase();
          const isVideo = fTypeLower.startsWith("video/") || /\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v|3gp|3g2|ts|mts|m2ts|vob|ogv)$/i.test(fNameLower);
          const isAudio = fTypeLower.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|wma|opus|aiff|mid|midi|amr)$/i.test(fNameLower);
          const isArchiveOrFolder = fTypeLower.includes("zip") || fTypeLower.includes("tar") || fTypeLower.includes("rar") || fTypeLower.includes("7z") || fTypeLower.includes("compressed") || /\.(zip|rar|7z|tar|gz|bz2|xz|tgz|iso)$/i.test(fNameLower);
          const isImage = fTypeLower.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|svg|bmp|tiff|heic)$/i.test(fNameLower);
          const isDoc = fTypeLower === "application/pdf" || fTypeLower.includes("word") || fTypeLower.includes("officedocument") || fTypeLower.includes("excel") || fTypeLower.includes("spreadsheet") || fTypeLower.includes("presentation") || fTypeLower.includes("powerpoint") || fTypeLower.startsWith("text/") || /\.(pdf|docx?|xlsx?|pptx?|txt|csv|md|rtf|odt|ods|odp)$/i.test(fNameLower);
          if (isVideo || isAudio || isArchiveOrFolder || !isImage && !isDoc) {
            let detail = "Ce genre de fichier n'est pas autoris\xE9.";
            if (isVideo) {
              detail = "Les vid\xE9os ne sont pas autoris\xE9es.";
            } else if (isAudio) {
              detail = "Les fichiers audio et sons ne sont pas autoris\xE9s.";
            } else if (isArchiveOrFolder) {
              detail = "Les dossiers et archives contenant plusieurs fichiers ne sont pas autoris\xE9s.";
            }
            return jsonResponse({
              success: false,
              forbiddenType: true,
              message: `Publication refus\xE9e : ${detail} Seuls les documents (PDF, Word, Excel...) et les images sont autoris\xE9s.`,
              fileName
            }, 200, origin);
          }
          const existingDoc = await env.DB.prepare(`
            SELECT id, title, file_name, file_size 
            FROM published_documents 
            WHERE (user_id = ? AND LOWER(file_name) = LOWER(?))
               OR (user_id = ? AND file_size > 0 AND file_size = ? AND LOWER(file_name) = LOWER(?))
            LIMIT 1
          `).bind(userId, fileName, userId, fileSize || 0, fileName).first();
          if (existingDoc) {
            return jsonResponse({
              success: false,
              duplicate: true,
              message: `Un fichier a \xE9t\xE9 recal\xE9 car son deuxi\xE8me a \xE9t\xE9 enregistr\xE9`,
              existingTitle: existingDoc.title,
              fileName
            }, 200, origin);
          }
          const docId = id || crypto.randomUUID();
          const finalCountry = country || "C\xF4te d'Ivoire";
          const finalIsPublic = isPublic !== void 0 ? isPublic ? 1 : 0 : 1;
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
            description || "",
            school || "",
            filiere || "",
            matiereName || "",
            level || "",
            category || "Pas d'informations",
            authorName || "\xC9tudiant",
            finalCountry,
            infoMode || "all",
            fileName,
            fileSize || 0,
            fileType || "",
            r2Key || null,
            fileUrl || "",
            finalIsPublic,
            tagsJson || "[]"
          ).run();
          await createNotification(
            env.DB,
            userId,
            "Confirmation de d\xE9p\xF4t de document",
            `Votre document "${title}" a \xE9t\xE9 partag\xE9 avec succ\xE8s dans la communaut\xE9 StudyCloud. Il est d\xE9sormais index\xE9 et disponible pour vos camarades.`,
            `${matiereName || category || "Ressource"} \u2022 ${title}`,
            "document"
          );
          return jsonResponse({
            success: true,
            id: docId,
            title,
            country: finalCountry,
            isPublic: finalIsPublic === 1
          }, 201, origin);
        }
      }
      if (path.startsWith("/api/published-documents/") && path.endsWith("/interact") && method === "POST") {
        const id = path.split("/")[3];
        const body = await request.json().catch(() => ({}));
        const { userId, type } = body;
        const interactionType = type || "view";
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
            await env.DB.prepare(`
              DELETE FROM user_document_interactions 
              WHERE created_at < datetime('now', '-30 days')
            `).run();
          } catch (e) {
          }
        }
        if (interactionType === "download") {
          try {
            await env.DB.prepare(`
              CREATE TABLE IF NOT EXISTS published_document_downloads (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                user_id TEXT,
                downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP
              )
            `).run();
            await env.DB.prepare(`
              INSERT INTO published_document_downloads (id, document_id, user_id, downloaded_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `).bind(crypto.randomUUID(), id, userId || "anonymous").run();
          } catch (e) {
          }
          await env.DB.prepare("UPDATE published_documents SET downloads_count = downloads_count + 1 WHERE id = ?").bind(id).run();
        } else {
          await env.DB.prepare("UPDATE published_documents SET views_count = views_count + 1 WHERE id = ?").bind(id).run();
        }
        return jsonResponse({ success: true, message: "Interaction enregistr\xE9e (historique nettoy\xE9 apr\xE8s 30 jours)" }, 200, origin);
      }
      if (path === "/api/published-documents/interactions/reset" && method === "DELETE") {
        const targetUserId = url.searchParams.get("userId");
        try {
          if (targetUserId) {
            await env.DB.prepare("DELETE FROM user_document_interactions WHERE user_id = ?").bind(targetUserId).run();
          } else {
            await env.DB.prepare("DELETE FROM user_document_interactions").run();
          }
          return jsonResponse({ success: true, message: "Historique des interactions r\xE9initialis\xE9 \xE0 z\xE9ro avec succ\xE8s" }, 200, origin);
        } catch (err) {
          return errorResponse("Erreur lors de la r\xE9initialisation: " + err.message, 500, origin);
        }
      }
      if (path.startsWith("/api/published-documents/") && path.endsWith("/view") && method === "POST") {
        const id = path.split("/")[3];
        await env.DB.prepare("UPDATE published_documents SET views_count = views_count + 1 WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true }, 200, origin);
      }
      if (path.startsWith("/api/published-documents/") && path.endsWith("/download") && method === "POST") {
        const id = path.split("/")[3];
        const body = await request.json().catch(() => ({}));
        const dlUserId = body?.userId || url.searchParams.get("userId") || "anonymous";
        try {
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS published_document_downloads (
              id TEXT PRIMARY KEY,
              document_id TEXT NOT NULL,
              user_id TEXT,
              downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
          await env.DB.prepare(`
            INSERT INTO published_document_downloads (id, document_id, user_id, downloaded_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `).bind(crypto.randomUUID(), id, dlUserId).run();
        } catch (e) {
        }
        await env.DB.prepare("UPDATE published_documents SET downloads_count = downloads_count + 1 WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true }, 200, origin);
      }
      if (path.startsWith("/api/published-documents/") && method === "DELETE") {
        const id = path.split("/")[3];
        const doc = await env.DB.prepare("SELECT r2_key FROM published_documents WHERE id = ?").bind(id).first();
        if (doc && doc.r2_key && env.BUCKET) {
          try {
            await env.BUCKET.delete(doc.r2_key);
          } catch (e) {
          }
        }
        await env.DB.prepare("DELETE FROM published_documents WHERE id = ?").bind(id).run();
        return jsonResponse({ success: true, message: "Document supprim\xE9" }, 200, origin);
      }
      if (path === "/api/notifications") {
        const userId = url.searchParams.get("userId");
        if (method === "GET") {
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          if (env.DB) {
            await ensureNotificationsTable(env.DB);
            try {
              await env.DB.prepare("DELETE FROM notifications WHERE created_at < datetime('now', '-21 days')").run();
            } catch (e) {
            }
            const sortParam = url.searchParams.get("sort");
            const sortOrder = sortParam === "oldest" ? "ASC" : "DESC";
            const { results } = await env.DB.prepare(`
              SELECT * FROM notifications 
              WHERE user_id = ? 
              ORDER BY created_at ${sortOrder}
            `).bind(userId).all();
            const unreadRow = await env.DB.prepare(`
              SELECT COUNT(*) as count FROM notifications 
              WHERE user_id = ? AND is_read = 0
            `).bind(userId).first();
            return jsonResponse({
              success: true,
              data: results || [],
              unreadCount: Number(unreadRow?.count || 0)
            }, 200, origin);
          }
          return jsonResponse({ success: true, data: [], unreadCount: 0 }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, userId: targetUserId, title, description, itemRef, type } = body;
          if (!targetUserId || !title)
            return errorResponse("userId et title requis", 400, origin);
          if (env.DB) {
            await ensureNotificationsTable(env.DB);
            await env.DB.prepare(`
              INSERT INTO notifications (id, user_id, title, description, item_ref, type, is_read, created_at)
              VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
            `).bind(id || crypto.randomUUID(), targetUserId, title, description || "", itemRef || null, type || "general").run();
          }
          return jsonResponse({ success: true }, 201, origin);
        }
        if (method === "DELETE") {
          const notifId = url.searchParams.get("id");
          const all = url.searchParams.get("all") === "true";
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          if (env.DB) {
            await ensureNotificationsTable(env.DB);
            if (all) {
              await env.DB.prepare("DELETE FROM notifications WHERE user_id = ?").bind(userId).run();
            } else if (notifId) {
              await env.DB.prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?").bind(notifId, userId).run();
            }
          }
          return jsonResponse({ success: true }, 200, origin);
        }
      }
      if (path === "/api/notifications/read" && (method === "POST" || method === "PATCH")) {
        const body = await request.json().catch(() => ({}));
        const { userId, notificationId, all } = body;
        if (!userId)
          return errorResponse("userId requis", 400, origin);
        if (env.DB) {
          await ensureNotificationsTable(env.DB);
          if (all) {
            await env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").bind(userId).run();
          } else if (notificationId) {
            await env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").bind(notificationId, userId).run();
          }
        }
        return jsonResponse({ success: true }, 200, origin);
      }
      if (path === "/api/app-links") {
        if (env.DB) {
          await ensureAppLinksTable(env.DB);
        }
        if (method === "GET") {
          let rows = [];
          if (env.DB) {
            const res = await env.DB.prepare("SELECT * FROM app_external_links ORDER BY id ASC").all();
            rows = res?.results || [];
          }
          const linksDict = {
            youtube: "",
            telegram: "",
            whatsapp: ""
          };
          for (const row of rows) {
            if (row.id) {
              linksDict[row.id] = (row.url || "").trim();
            }
          }
          return jsonResponse({ success: true, data: linksDict, links: rows }, 200, origin);
        }
        if (method === "POST" || method === "PUT") {
          const body = await request.json().catch(() => ({}));
          const { id, url: linkUrl, name, description } = body;
          if (!id)
            return errorResponse("id requis", 400, origin);
          const safeUrl = (linkUrl || "").trim();
          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO app_external_links (id, name, url, description, updated_at)
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                url = excluded.url,
                name = COALESCE(excluded.name, app_external_links.name),
                description = COALESCE(excluded.description, app_external_links.description),
                updated_at = CURRENT_TIMESTAMP
            `).bind(id, name || id, safeUrl, description || null).run();
          }
          return jsonResponse({ success: true, message: "Lien mis \xE0 jour avec succ\xE8s" }, 200, origin);
        }
      }
      if (path.startsWith("/link/")) {
        const linkId = path.replace("/link/", "").trim().toLowerCase();
        let targetUrl = "";
        if (env.DB) {
          await ensureAppLinksTable(env.DB);
          const link = await env.DB.prepare("SELECT url FROM app_external_links WHERE id = ?").bind(linkId).first();
          if (link?.url && link.url.trim())
            targetUrl = link.url.trim();
        }
        if (targetUrl) {
          return Response.redirect(targetUrl, 302);
        }
        return errorResponse("Lien non disponible", 404, origin);
      }
      if (path === "/api/chat") {
        const userId = url.searchParams.get("userId");
        const sessionId = url.searchParams.get("sessionId");
        if (method === "GET") {
          if (!userId || !sessionId)
            return errorResponse("userId et sessionId requis", 400, origin);
          const { results } = await env.DB.prepare("SELECT * FROM chat_messages WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC").bind(userId, sessionId).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, userId: userId2, sessionId: sessionId2, sender, messageText, attachedResourceId } = body;
          await env.DB.prepare(`
            INSERT INTO chat_messages (id, user_id, session_id, sender, message_text, attached_resource_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId2, sessionId2, sender, messageText, attachedResourceId || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }
      if (path === "/api/subscriptions") {
        const userId = url.searchParams.get("userId");
        if (method === "GET") {
          if (!userId)
            return errorResponse("userId requis", 400, origin);
          const sub = await env.DB.prepare('SELECT * FROM user_subscriptions WHERE user_id = ? AND status = "active"').bind(userId).first();
          return jsonResponse({ success: true, data: sub || { plan_name: "free", status: "active" } }, 200, origin);
        }
        if (method === "POST") {
          const body = await request.json();
          const { id, userId: userId2, planName, billingCycle, expiresAt } = body;
          await env.DB.prepare(`
            INSERT INTO user_subscriptions (id, user_id, plan_name, billing_cycle, status, expires_at)
            VALUES (?, ?, ?, ?, 'active', ?)
          `).bind(id || crypto.randomUUID(), userId2, planName, billingCycle || "monthly", expiresAt || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
      }
      if (path.startsWith("/api/ai") || path.startsWith("/api/ai-contents")) {
        return errorResponse(
          "Toutes les fonctionnalit\xE9s de l'IA StudyCloud sont d\xE9sormais g\xE9r\xE9es exclusivement par le Worker IA d\xE9di\xE9 (https://studycloud-ai.delmaskouassidibi.workers.dev).",
          404,
          origin
        );
      }
      if (path === "/api/sync/backup" && method === "POST") {
        const body = await request.json();
        const { userId, userProfile, matieres, notes, scheduleSlots, scheduleConfig, alarms, shopProfile } = body;
        if (!userId)
          return errorResponse("userId requis", 400, origin);
        if (userProfile) {
          const cleanEmail = (userProfile.email || `${userId}@studycloud.app`).toLowerCase().trim();
          const existing = await env.DB.prepare(
            "SELECT id FROM users WHERE id = ? OR LOWER(TRIM(email)) = ?"
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
              userProfile.name || "\xC9tudiant",
              cleanEmail,
              userProfile.school || "CME",
              userProfile.filiere || "G\xE9n\xE9ral",
              userProfile.country || "C\xF4te d'Ivoire",
              userProfile.avatarUrl || null
            ).run();
          }
        }
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
            `).bind(m.id || crypto.randomUUID(), userId, m.name || m.title, m.coefficient || 1, m.color || "#EA580C", m.category || "G\xE9n\xE9ral", m.order || 0).run();
          }
        }
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
            `).bind(n.id || crypto.randomUUID(), userId, n.title || "Note", n.content || "", n.color || "#FFFFFF", n.isPinned ? 1 : 0, n.imageUrl || null).run();
          }
        }
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
            `).bind(s.id || crypto.randomUUID(), userId, s.day, s.hourSlot, s.subject, s.room || "", s.noteOrTeacher || "", s.color || "#EA580C").run();
          }
        }
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
            `).bind(a.id || crypto.randomUUID(), userId, a.time, a.label || "R\xE9veil \xE9tude", a.isActive ? 1 : 0, JSON.stringify(a.days || ["Tous les jours"])).run();
          }
        }
        return jsonResponse({
          success: true,
          message: "Sauvegarde Cloud effectu\xE9e avec succ\xE8s",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }, 200, origin);
      }
      if (path === "/api/sync/restore" && method === "GET") {
        const userId = url.searchParams.get("userId");
        if (!userId)
          return errorResponse("userId requis", 400, origin);
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
          env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first(),
          env.DB.prepare("SELECT * FROM matieres WHERE user_id = ? ORDER BY display_order ASC").bind(userId).all(),
          env.DB.prepare("SELECT * FROM files WHERE user_id = ? ORDER BY last_imported DESC, created_at DESC").bind(userId).all(),
          env.DB.prepare("SELECT * FROM notes WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC").bind(userId).all(),
          env.DB.prepare("SELECT * FROM schedule_config WHERE user_id = ?").bind(userId).first(),
          env.DB.prepare("SELECT * FROM schedule_slots WHERE user_id = ?").bind(userId).all(),
          env.DB.prepare("SELECT * FROM grades WHERE user_id = ?").bind(userId).all(),
          env.DB.prepare("SELECT * FROM alarms WHERE user_id = ?").bind(userId).all(),
          env.DB.prepare("SELECT * FROM ai_generated_contents WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC").bind(userId).all()
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
      if ((path === "/api/referrals/my-status" || path === "/api/referrals/status") && method === "GET") {
        if (!env.DB)
          return errorResponse("Base de donn\xE9es D1 indisponible", 500, origin);
        await ensureReferralsTables(env.DB);
        let userId = null;
        const authHeader = request.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
        if (token) {
          const payload = await verifyJWT(token);
          if (payload?.userId)
            userId = payload.userId;
        }
        if (!userId) {
          userId = url.searchParams.get("userId");
        }
        if (!userId)
          return errorResponse("Identifiant utilisateur requis", 401, origin);
        let user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
        if (!user)
          return errorResponse("Compte utilisateur introuvable", 404, origin);
        let referralCode = user.referral_code;
        if (!referralCode) {
          let isUnique = false;
          while (!isUnique) {
            referralCode = generateReferralCode();
            const existing = await env.DB.prepare("SELECT id FROM users WHERE referral_code = ?").bind(referralCode).first();
            if (!existing)
              isUnique = true;
          }
          await env.DB.prepare("UPDATE users SET referral_code = ? WHERE id = ?").bind(referralCode, user.id).run();
          user.referral_code = referralCode;
        }
        const stats = await env.DB.prepare(`
          SELECT COUNT(*) as count, COALESCE(SUM(reward_days), 0) as total_days
          FROM referrals
          WHERE referrer_id = ?
        `).bind(user.id).first();
        const referralsCount = Number(stats?.count || 0);
        const adFreeDaysEarned = Number(stats?.total_days || 0);
        if (user.referrals_count !== referralsCount || user.ad_free_days_earned !== adFreeDaysEarned) {
          await env.DB.prepare("UPDATE users SET referrals_count = ?, ad_free_days_earned = ? WHERE id = ?").bind(referralsCount, adFreeDaysEarned, user.id).run();
        }
        const configRow = await env.DB.prepare("SELECT * FROM referral_rewards_config WHERE id = 'default'").first();
        let milestones = [
          { count: 3, extra_days: 5, label: "3 personnes promues : +5 jours bonus" },
          { count: 5, extra_days: 10, label: "5 personnes promues : +10 jours bonus" },
          { count: 7, extra_days: 15, label: "7 personnes promues : +15 jours bonus" },
          { count: 10, extra_days: 3650, label: "10 personnes promues : +3650 jours bonus" }
        ];
        let rules = [
          "Chaque fois que vous promouvez avec succ\xE8s une personne qui s'inscrit, vous b\xE9n\xE9ficierez de 5 jours de publicit\xE9 gratuite, qui peuvent \xEAtre accumul\xE9s de mani\xE8re illimit\xE9e~",
          "Un total de 3 personnes inscrites par vous, et 5 jours suppl\xE9mentaires de publicit\xE9 gratuite offerts~",
          "Un total de 5 personnes inscrites par vous, et 10 jours suppl\xE9mentaires de publicit\xE9 gratuite offerts~",
          "Un total de 7 personnes inscrites par vous, et 15 jours suppl\xE9mentaires de publicit\xE9 gratuite offerts~",
          "Un total de 10 personnes inscrites par vous, et 3650 jours suppl\xE9mentaires de publicit\xE9 gratuite offerts~"
        ];
        if (configRow?.milestones_json) {
          try {
            milestones = JSON.parse(configRow.milestones_json);
          } catch (e) {
          }
        }
        if (configRow?.rules_text_json) {
          try {
            rules = JSON.parse(configRow.rules_text_json);
          } catch (e) {
          }
        }
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
      if (path === "/api/referrals/config" && (method === "PUT" || method === "POST")) {
        if (!env.DB)
          return errorResponse("Base de donn\xE9es D1 indisponible", 500, origin);
        await ensureReferralsTables(env.DB);
        const body = await request.json().catch(() => ({}));
        const { daysPerReferral, milestones, rules } = body;
        const currentConfig = await env.DB.prepare("SELECT * FROM referral_rewards_config WHERE id = 'default'").first();
        const newDays = daysPerReferral !== void 0 ? Number(daysPerReferral) : currentConfig?.days_per_referral || 5;
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
          message: "Configuration des avantages de parrainage mise \xE0 jour avec succ\xE8s",
          config: {
            daysPerReferral: newDays,
            milestones: milestones || JSON.parse(newMilestonesJson || "[]"),
            rules: rules || JSON.parse(newRulesJson || "[]")
          }
        }, 200, origin);
      }
      if (path === "/api/user/storage" && method === "GET") {
        if (!env.DB) {
          return errorResponse("Base de donn\xE9es indisponible", 500, origin);
        }
        let userId = url.searchParams.get("userId") || request.headers.get("x-user-id");
        if (!userId) {
          const authHeader = request.headers.get("Authorization");
          if (authHeader && authHeader.startsWith("Bearer ")) {
            try {
              const token = authHeader.substring(7);
              const payload = JSON.parse(atob(token.split(".")[1]));
              userId = payload.sub || payload.userId || payload.id;
            } catch (e) {}
          }
        }
        if (!userId) {
          return errorResponse("Identifiant utilisateur (userId) manquant", 400, origin);
        }

        const storageData = await getUserStorageDetails(env.DB, userId);
        return jsonResponse({
          success: true,
          data: storageData
        }, 200, origin);
      }
      if (path === "/api/user/storage/upgrade-request" && method === "POST") {
        if (!env.DB) {
          return errorResponse("Base de donn\xE9es indisponible", 500, origin);
        }
        let userId = url.searchParams.get("userId") || request.headers.get("x-user-id");
        const body = await request.json().catch(() => ({}));
        userId = userId || body.userId;
        if (!userId) {
          return errorResponse("Identifiant utilisateur requis", 400, origin);
        }

        await ensureStorageTables(env.DB);
        const requestId = generateCleanShareCode();
        const packId = body.packId || "custom";
        const packName = body.packName || "Pack Personnalisé";
        const additionalMb = Number(body.additionalMb || 1024);
        const additionalWords = Number(body.additionalWords || 100000);
        const contactPhone = body.contactPhone || body.userPhone || "";
        const userWhatsapp = body.whatsappNumber || body.userWhatsapp || "";
        const rawNotes = body.notes || "";
        const notes = [rawNotes, userWhatsapp ? `WhatsApp: ${userWhatsapp}` : ""].filter(Boolean).join(" | ");
        const userName = body.userName || "";
        const userEmail = body.userEmail || "";
        const pricePaid = Number(body.pricePaid || body.price || 0);
        const currency = body.currency || "FCFA";
        const paymentMethod = body.paymentMethod || "Wave / Orange / Moov / MTN";
        const paymentReference = body.paymentReference || "";
        const receiptImageUrl = body.receiptImageUrl || body.receiptUrl || "";
        const receiptR2Key = body.receiptR2Key || (receiptImageUrl ? `storage-receipts/${userId}/recu_${requestId}.jpg` : "");

        const storageDisplay = body.storageDisplay || (additionalMb >= 1024 ? `${(additionalMb / 1024).toFixed(additionalMb % 1024 === 0 ? 0 : 1)} Go (${additionalMb} Mo)` : `${additionalMb} Mo`);
        const priceDisplay = body.priceDisplay || `${pricePaid} ${currency}`;
        const billingCycle = body.billingCycle || "annual";
        const requestType = body.requestType || (body.isRenewal || (packName && packName.toLowerCase().includes('renouvellement')) ? 'renewal' : 'upgrade');

        let finalReceiptUrl = receiptImageUrl;
        // Si l'image est un Data URI Base64, l'extraire et l'enregistrer dans R2 si possible
        if (receiptImageUrl && receiptImageUrl.startsWith("data:")) {
          try {
            const mimeMatch = receiptImageUrl.match(/^data:([^;]+);base64,/);
            const contentType = mimeMatch ? mimeMatch[1] : "image/jpeg";
            const base64Content = receiptImageUrl.replace(/^data:[^;]+;base64,/, "");

            if (env.BUCKET) {
              const binStr = atob(base64Content);
              const len = binStr.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binStr.charCodeAt(i);
              }
              await env.BUCKET.put(receiptR2Key, bytes.buffer, {
                httpMetadata: { contentType }
              });
              finalReceiptUrl = `${url.origin}/api/storage/file/${encodeURIComponent(receiptR2Key)}`;
            } else if (receiptImageUrl.length > 500000) {
              finalReceiptUrl = receiptImageUrl.slice(0, 500000);
            }
          } catch (imgErr) {
            console.warn("Erreur traitement image reçu R2:", imgErr);
            if (receiptImageUrl.length > 500000) {
              finalReceiptUrl = receiptImageUrl.slice(0, 500000);
            }
          }
        }

        try {
          await env.DB.prepare(`
            INSERT INTO storage_upgrade_requests (
              id, user_id, user_name, user_phone, user_email, pack_id, pack_name,
              additional_mb, additional_words, price_paid, currency, payment_method, payment_reference,
              receipt_image_url, receipt_r2_key, contact_phone, user_whatsapp,
              storage_display, price_display, billing_cycle,
              notes, request_type, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(
            requestId, userId, userName, contactPhone, userEmail, packId, packName,
            additionalMb, additionalWords, pricePaid, currency, paymentMethod, paymentReference,
            finalReceiptUrl, receiptR2Key, contactPhone, userWhatsapp,
            storageDisplay, priceDisplay, billingCycle,
            notes, requestType
          ).run();
        } catch (insertErr) {
          console.error("Erreur insertion storage_upgrade_requests:", insertErr);
          try {
            await ensureStorageTables(env.DB);
            await env.DB.prepare(`
              INSERT OR REPLACE INTO storage_upgrade_requests (
                id, user_id, user_name, pack_id, pack_name, additional_mb, price_paid,
                currency, contact_phone, user_whatsapp, receipt_image_url, receipt_r2_key,
                storage_display, price_display, billing_cycle, notes, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `).bind(
              requestId, userId, userName, packId, packName, additionalMb, pricePaid,
              currency, contactPhone, userWhatsapp, finalReceiptUrl, receiptR2Key,
              storageDisplay, priceDisplay, billingCycle, notes
            ).run();
          } catch (retryErr) {
            console.error("Erreur critique de secours insertion commande:", retryErr);
            return errorResponse("Impossible d'enregistrer la commande dans la base: " + (retryErr.message || insertErr.message), 500, origin);
          }
        }

        return jsonResponse({
          success: true,
          message: "Demande d'augmentation de stockage enregistrée avec succès",
          requestId
        }, 200, origin);
      }

      // Route utilisateur : Récupération des demandes de stockage et de renouvellement
      if (path === "/api/user/storage/upgrade-requests" && method === "GET") {
        if (!env.DB) return errorResponse("Base de données indisponible", 500, origin);
        const userId = url.searchParams.get("userId") || request.headers.get("x-user-id");
        if (!userId) return errorResponse("userId requis", 400, origin);
        await ensureStorageTables(env.DB);
        const includeDeleted = url.searchParams.get("includeDeleted") === "true";
        const query = "SELECT * FROM storage_upgrade_requests WHERE user_id = ? ORDER BY created_at DESC";
        const reqs = await env.DB.prepare(query).bind(userId).all();
        const list = (reqs && reqs.results) ? reqs.results : [];
        const filtered = includeDeleted ? list : list.filter(r => !r.user_deleted_at);
        return jsonResponse({
          success: true,
          requests: filtered
        }, 200, origin);
      }

      // Route utilisateur : Demande de suppression de l'historique (Purge définitive différée à 1 mois / 30 jours)
      if (path === "/api/user/storage/delete-history-item" && method === "POST") {
        if (!env.DB) return errorResponse("Base de données indisponible", 500, origin);
        const body = await request.json().catch(() => ({}));
        const requestId = body.requestId;
        const userId = body.userId || url.searchParams.get("userId") || request.headers.get("x-user-id");
        if (!requestId || !userId) return errorResponse("requestId et userId requis", 400, origin);

        await ensureStorageTables(env.DB);
        const nowISO = new Date().toISOString();
        const purgeDateISO = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const purgeId = "purge_" + Math.random().toString(36).substring(2, 10);

        try {
          await env.DB.prepare(`
            INSERT INTO user_requests_history_purge (id, request_id, user_id, requested_at, purge_effective_at, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending_purge', ?)
          `).bind(purgeId, requestId, userId, nowISO, purgeDateISO, nowISO).run();
        } catch (e) {}

        try {
          await env.DB.prepare(`
            UPDATE storage_upgrade_requests 
            SET user_deleted_at = ?, purge_scheduled_at = ? 
            WHERE id = ? AND user_id = ?
          `).bind(nowISO, purgeDateISO, requestId, userId).run();
        } catch (e) {}

        try {
          await env.DB.prepare(`
            UPDATE user_purchases_history 
            SET user_deleted_at = ?, purge_scheduled_at = ? 
            WHERE (id = ? OR id = ? OR id = ?) AND user_id = ?
          `).bind(nowISO, purgeDateISO, requestId, "PUR_" + requestId, requestId.replace("PUR_", ""), userId).run();
        } catch (e) {}

        return jsonResponse({
          success: true,
          message: "Votre demande de suppression a été enregistrée. Conformément à la réglementation de traçabilité comptable, la suppression définitive de cet historique sera effective après 1 mois (30 jours)."
        }, 200, origin);
      }

      // Route utilisateur : Récupération de l'historique complet des achats et paiements
      if (path === "/api/user/purchases-history" && method === "GET") {
        if (!env.DB) return errorResponse("Base de données indisponible", 500, origin);
        const userId = url.searchParams.get("userId") || request.headers.get("x-user-id");
        if (!userId) return errorResponse("userId requis", 400, origin);

        await ensureStorageTables(env.DB);

        // 1. Récupérer dans la table officielle user_purchases_history
        let purchasesRes = await env.DB.prepare(`
          SELECT * FROM user_purchases_history 
          WHERE user_id = ? AND (user_deleted_at IS NULL OR user_deleted_at = '') 
          ORDER BY purchased_at DESC, created_at DESC
        `).bind(userId).all();
        let purchases = (purchasesRes && purchasesRes.results) ? purchasesRes.results : [];

        // 2. Synchronisation automatique de secours si la table est encore vide
        if (purchases.length === 0) {
          const subsRes = await env.DB.prepare(`SELECT * FROM user_subscriptions WHERE user_id = ? ORDER BY created_at DESC`).bind(userId).all();
          const userSubs = (subsRes && subsRes.results) ? subsRes.results : [];

          const reqsRes = await env.DB.prepare(`SELECT * FROM storage_upgrade_requests WHERE user_id = ? AND status = 'approved' AND (user_deleted_at IS NULL OR user_deleted_at = '') ORDER BY created_at DESC`).bind(userId).all();
          const approvedReqs = (reqsRes && reqsRes.results) ? reqsRes.results : [];

          for (const req of approvedReqs) {
            const purId = "PUR_" + (req.id ? req.id.replace(/[^a-zA-Z0-9]/g, "") : Math.random().toString(36).substring(2, 10));
            const addMb = Number(req.additional_mb || 1024);
            const price = Number(req.price_paid || 1000);
            const dateVal = req.confirmed_start_date || req.confirmed_at || req.updated_at || req.created_at || new Date().toISOString();
            const renDate = req.confirmed_end_date || "";
            try {
              await env.DB.prepare(`
                INSERT OR IGNORE INTO user_purchases_history (
                  id, user_id, user_name, user_phone, user_email, pack_name,
                  storage_bought_mb, total_storage_mb, price_paid, currency,
                  payment_method, payment_reference, billing_cycle, renewal_date,
                  status, purchased_at, confirmed_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
              `).bind(
                purId, userId, req.user_name || "", req.user_phone || req.contact_phone || "", req.user_email || "",
                req.pack_name || "Pack Stockage StudyCloud", addMb, addMb + 30, price, req.currency || "FCFA",
                req.payment_method || "Mobile Money", req.payment_reference || req.id || "",
                req.billing_cycle || "monthly", renDate, dateVal, dateVal, dateVal
              ).run();
            } catch (e) {}
          }

          for (const sub of userSubs) {
            const purId = "PUR_" + (sub.id ? sub.id.replace(/[^a-zA-Z0-9]/g, "") : Math.random().toString(36).substring(2, 10));
            const totMb = Number(sub.total_storage_mb || 1024);
            const boughtMb = sub.storage_added_mb ? Number(sub.storage_added_mb) : Math.max(0, totMb - 30);
            const price = Number(sub.monthly_price || 1000);
            const dateVal = sub.start_date || sub.created_at || new Date().toISOString();
            const renDate = sub.end_date || "";
            try {
              await env.DB.prepare(`
                INSERT OR IGNORE INTO user_purchases_history (
                  id, user_id, user_name, user_phone, user_email, pack_name,
                  storage_bought_mb, total_storage_mb, price_paid, currency,
                  payment_method, payment_reference, billing_cycle, renewal_date,
                  status, purchased_at, confirmed_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
              `).bind(
                purId, userId, sub.user_name || "", sub.user_phone || "", sub.user_email || "",
                sub.plan_name || "Abonnement StudyCloud", boughtMb, totMb, price, sub.currency || "FCFA",
                "Mobile Money", sub.request_id || sub.id, "monthly", renDate, dateVal, dateVal, dateVal
              ).run();
            } catch (e) {}
          }

          purchasesRes = await env.DB.prepare(`
            SELECT * FROM user_purchases_history 
            WHERE user_id = ? AND (user_deleted_at IS NULL OR user_deleted_at = '') 
            ORDER BY purchased_at DESC, created_at DESC
          `).bind(userId).all();
          purchases = (purchasesRes && purchasesRes.results) ? purchasesRes.results : [];
        }

        return jsonResponse({
          success: true,
          purchases
        }, 200, origin);
      }

      // Route administrateur : Confirmation et activation d'une demande de stockage dans la BDD
      if (path === "/api/storage-requests/approve" && method === "POST") {
        if (!env.DB) return errorResponse("Base de données indisponible", 500, origin);
        const body = await request.json().catch(() => ({}));
        const requestId = body.requestId;
        if (!requestId) return errorResponse("requestId requis", 400, origin);

        await ensureStorageTables(env.DB);
        const reqRow = await env.DB.prepare("SELECT * FROM storage_upgrade_requests WHERE id = ?").bind(requestId).first();
        if (!reqRow) return errorResponse("Demande introuvable", 404, origin);

        const userId = reqRow.user_id;
        const addMb = Number(body.allocatedMb !== undefined ? body.allocatedMb : (reqRow.additional_mb || 1024));
        const pricePaid = Number(body.pricePaid !== undefined ? body.pricePaid : (reqRow.price_paid || 0));
        const startDate = body.startDate || new Date().toISOString();
        const endDate = body.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const gracePeriodDays = Number(body.gracePeriodDays || 5);

        // 1. Marquer la demande approuvée
        await env.DB.prepare(`
          UPDATE storage_upgrade_requests 
          SET status = 'approved', 
              confirmed_start_date = ?, 
              confirmed_end_date = ?, 
              grace_period_days = ?, 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(startDate, endDate, gracePeriodDays, requestId).run();

        // 2. Allouer le stockage dans user_storage_quotas
        const currentQuota = await env.DB.prepare("SELECT * FROM user_storage_quotas WHERE user_id = ?").bind(userId).first();
        const currentPaid = currentQuota ? Number(currentQuota.paid_total_mb || 0) : 0;
        const isRenewalReq = (reqRow.request_type === 'renewal') || (reqRow.pack_name && reqRow.pack_name.toLowerCase().includes('renouvellement'));
        let newPaid = currentPaid + addMb;
        if (isRenewalReq && (body.allocatedMb === undefined || body.allocatedMb === 0)) {
          newPaid = currentPaid > 0 ? currentPaid : addMb;
        }
        const wTotal = currentQuota ? Number(currentQuota.welcome_total_mb || 30) : 30;

        await env.DB.prepare(`
          INSERT INTO user_storage_quotas (user_id, welcome_total_mb, welcome_r2_mb, welcome_d1_mb, paid_total_mb, paid_r2_mb, paid_d1_mb, plan_name, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'payant', CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET
            paid_total_mb = excluded.paid_total_mb,
            paid_r2_mb = excluded.paid_r2_mb,
            paid_d1_mb = excluded.paid_d1_mb,
            plan_name = 'payant',
            updated_at = CURRENT_TIMESTAMP
        `).bind(userId, wTotal, Math.round(wTotal/3), Math.round(wTotal*2/3), newPaid, Math.round(newPaid/2), Math.round(newPaid/2)).run();

        // 3. Insérer ou activer l'abonnement dans user_subscriptions
        const subId = "sub_" + Math.random().toString(36).substring(2, 10);
        await env.DB.prepare(`
          UPDATE user_subscriptions 
          SET status = 'renewed', updated_at = CURRENT_TIMESTAMP 
          WHERE user_id = ? AND status = 'active'
        `).bind(userId).run();

        await env.DB.prepare(`
          INSERT INTO user_subscriptions (id, user_id, user_name, user_phone, user_email, plan_name, total_storage_mb, monthly_price, currency, status, start_date, end_date, grace_period_days, request_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(
          subId, userId, reqRow.user_name || "", reqRow.user_phone || "", reqRow.user_email || "",
          reqRow.pack_name || "Pack Stockage", wTotal + newPaid, pricePaid, reqRow.currency || "FCFA",
          startDate, endDate, gracePeriodDays, requestId
        ).run();

        // 4. Enregistrer immédiatement l'achat dans user_purchases_history
        const purchaseId = "PUR_" + Math.random().toString(36).substring(2, 10).toUpperCase();
        try {
          await env.DB.prepare(`
            INSERT INTO user_purchases_history (
              id, user_id, user_name, user_phone, user_email, pack_name,
              storage_bought_mb, total_storage_mb, price_paid, currency,
              payment_method, payment_reference, billing_cycle, renewal_date,
              status, purchased_at, confirmed_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, CURRENT_TIMESTAMP)
          `).bind(
            purchaseId, userId, reqRow.user_name || "", reqRow.user_phone || "", reqRow.user_email || "",
            reqRow.pack_name || "Pack Stockage", addMb, wTotal + newPaid, pricePaid, reqRow.currency || "FCFA",
            reqRow.payment_method || "Mobile Money", reqRow.payment_reference || reqRow.id || "",
            reqRow.billing_cycle || "monthly", endDate, startDate, startDate
          ).run();
        } catch (e) {}

        return jsonResponse({
          success: true,
          requestId,
          userId,
          newPaidTotalMb: newPaid,
          message: "Abonnement confirmé et stockage alloué avec succès dans la base de données"
        }, 200, origin);
      }

      // Route administrateur : Rejet d'une demande de stockage
      if (path === "/api/storage-requests/reject" && method === "POST") {
        if (!env.DB) return errorResponse("Base de données indisponible", 500, origin);
        const body = await request.json().catch(() => ({}));
        const requestId = body.requestId;
        const reason = body.reason || "Paiement non confirmé";
        if (!requestId) return errorResponse("requestId requis", 400, origin);

        await env.DB.prepare(`UPDATE storage_upgrade_requests SET status = 'rejected', admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(reason, requestId).run();
        return jsonResponse({ success: true, requestId, message: "Demande rejetée" }, 200, origin);
      }

      // Route utilisateur : Récupération des abonnements actifs et passés
      if (path === "/api/user/subscriptions" && method === "GET") {
        if (!env.DB) return errorResponse("Base de données indisponible", 500, origin);
        const userId = url.searchParams.get("userId") || request.headers.get("x-user-id");
        if (!userId) return errorResponse("userId requis", 400, origin);
        await ensureStorageTables(env.DB);
        const subs = await env.DB.prepare(
          "SELECT * FROM user_subscriptions WHERE user_id = ? ORDER BY created_at DESC"
        ).bind(userId).all();
        const quota = await env.DB.prepare(
          "SELECT * FROM user_storage_quotas WHERE user_id = ?"
        ).bind(userId).first();
        return jsonResponse({
          success: true,
          subscriptions: (subs && subs.results) ? subs.results : [],
          quota: quota || null
        }, 200, origin);
      }

      // Route publique : Informations professionnelles de l'entreprise et comptes marchands
      if (path === "/api/company-profile" && method === "GET") {
        const defaultProfile = {
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

        if (!env.DB) {
          return jsonResponse({ success: true, profile: defaultProfile }, 200, origin);
        }

        try {
          await ensureStorageTables(env.DB);
          const row = await env.DB.prepare(`SELECT * FROM company_profile WHERE id = 'main'`).first();
          if (row) {
            if (!row.mtn_name || row.mtn_name === 'Paiement Mobile National' || row.mtn_name.includes('Moov')) {
              row.mtn_name = 'MTN Mobile Money CI';
            }
            if (!row.moov_number) {
              row.moov_number = '+225 01 00 00 00 00';
            }
            if (!row.moov_name) {
              row.moov_name = "Moov Money Côte d'Ivoire";
            }
            if (row.wave_enabled === undefined || row.wave_enabled === null) row.wave_enabled = 1;
            if (row.wave_show_number === undefined || row.wave_show_number === null) row.wave_show_number = 1;
            if (row.wave_show_image === undefined || row.wave_show_image === null) row.wave_show_image = 1;
            if (row.orange_enabled === undefined || row.orange_enabled === null) row.orange_enabled = 1;
            if (row.orange_show_number === undefined || row.orange_show_number === null) row.orange_show_number = 1;
            if (row.orange_show_image === undefined || row.orange_show_image === null) row.orange_show_image = 1;
            if (row.mtn_enabled === undefined || row.mtn_enabled === null) row.mtn_enabled = 1;
            if (row.mtn_show_number === undefined || row.mtn_show_number === null) row.mtn_show_number = 1;
            if (row.mtn_show_image === undefined || row.mtn_show_image === null) row.mtn_show_image = 1;
            if (row.moov_enabled === undefined || row.moov_enabled === null) row.moov_enabled = 1;
            if (row.moov_show_number === undefined || row.moov_show_number === null) row.moov_show_number = 1;
            if (row.moov_show_image === undefined || row.moov_show_image === null) row.moov_show_image = 1;
          }
          return jsonResponse({ success: true, profile: row || defaultProfile }, 200, origin);
        } catch (e) {
          return jsonResponse({ success: true, profile: defaultProfile }, 200, origin);
        }
      }

      // Route de mise à jour des informations professionnelles (individuelle ou globale)
      if (path === "/api/company-profile/update" && method === "POST") {
        if (!env.DB) {
          return errorResponse("Base de données D1 indisponible", 500, origin);
        }
        await ensureStorageTables(env.DB);
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

        // S'assurer que la ligne 'main' existe
        await env.DB.prepare(`INSERT OR IGNORE INTO company_profile (id) VALUES ('main')`).run();

        if (body.field && allowedCols.includes(body.field)) {
          const colName = body.field;
          const colValue = typeof body.value === 'number' ? body.value : String(body.value ?? '');
          await env.DB.prepare(`
            UPDATE company_profile SET ${colName} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'main'
          `).bind(colValue).run();
        } else {
          const updates = [];
          const values = [];
          for (const col of allowedCols) {
            if (body[col] !== undefined) {
              updates.push(`${col} = ?`);
              values.push(typeof body[col] === 'number' ? body[col] : String(body[col] ?? ''));
            }
          }
          if (updates.length > 0) {
            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            await env.DB.prepare(`
              UPDATE company_profile SET ${updates.join(', ')} WHERE id = 'main'
            `).bind(...values).run();
          }
        }

        const updatedProfile = await env.DB.prepare(`SELECT * FROM company_profile WHERE id = 'main'`).first();
        return jsonResponse({
          success: true,
          message: "Informations professionnelles enregistrées avec succès",
          profile: updatedProfile
        }, 200, origin);
      }

      // Route d'upload direct d'image de paiement (Carte commerçant / QR) vers Cloudflare R2
      if (path === "/api/company-profile/upload-payment-image" && method === "POST") {
        if (!env.DB) {
          return errorResponse("Base de données D1 indisponible", 500, origin);
        }
        await ensureStorageTables(env.DB);
        const body = await request.json().catch(() => ({}));
        const network = (body.network || '').toLowerCase().trim();
        const validNetworks = ['wave', 'orange', 'mtn', 'moov'];
        if (!validNetworks.includes(network)) {
          return errorResponse("Réseau de paiement invalide (wave, orange, mtn, moov)", 400, origin);
        }

        const rawData = body.image || '';
        if (!rawData) {
          return errorResponse("Image manquante", 400, origin);
        }

        let imageUrl = rawData;
        const ext = (body.ext || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
        const r2Key = `payment-methods/${network}_merchant_${Date.now()}.${ext}`;
        const bucket = env.BUCKET || env.MON_R2_STUDYCLOUD;

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

            const workerOrigin = (url && url.origin) ? url.origin : 'https://studycloud-worker.delmaskouassidibi.workers.dev';
            imageUrl = `${workerOrigin}/api/payment-methods/image/${encodeURIComponent(r2Key)}`;
          } catch (r2Err) {
            console.warn('[STUDYCLOUD R2 Upload Error Fallback base64]:', r2Err);
            imageUrl = rawData;
          }
        }

        const fieldName = `${network}_image_url`;
        await env.DB.prepare(`INSERT OR IGNORE INTO company_profile (id) VALUES ('main')`).run();
        await env.DB.prepare(`UPDATE company_profile SET ${fieldName} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'main'`).bind(imageUrl).run();

        return jsonResponse({
          success: true,
          url: imageUrl,
          key: r2Key,
          message: "Carte commerçant / QR enregistré avec succès dans R2"
        }, 200, origin);
      }

      // Route de streaming image de paiement depuis R2
      if (path.startsWith("/api/payment-methods/image/") && method === "GET") {
        const key = decodeURIComponent(path.replace('/api/payment-methods/image/', ''));
        const bucket = env.BUCKET || env.MON_R2_STUDYCLOUD;
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
        return errorResponse("Image de paiement introuvable dans R2", 404, origin);
      }

      // ----------------------------------------------------------------------
      // ROUTE GET : /api/subscription-plans (Plans de stockage et IA)
      // ----------------------------------------------------------------------
      if (path === "/api/subscription-plans" && method === "GET") {
        if (!env.DB) {
          return errorResponse("Base de données D1 indisponible", 500, origin);
        }
        await ensureStorageTables(env.DB);
        const onlyActive = url.searchParams.get("active_only") === "1";
        const storageQuery = onlyActive
          ? "SELECT * FROM storage_subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC"
          : "SELECT * FROM storage_subscription_plans ORDER BY sort_order ASC, created_at ASC";
        const aiQuery = onlyActive
          ? "SELECT * FROM ai_subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC"
          : "SELECT * FROM ai_subscription_plans ORDER BY sort_order ASC, created_at ASC";

        const storageRes = await env.DB.prepare(storageQuery).all();
        const aiRes = await env.DB.prepare(aiQuery).all();

        return jsonResponse({
          success: true,
          storagePlans: (storageRes && storageRes.results) ? storageRes.results : [],
          aiPlans: (aiRes && aiRes.results) ? aiRes.results : []
        }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/subscription-plans/save
      // ----------------------------------------------------------------------
      if (path === "/api/subscription-plans/save" && method === "POST") {
        if (!env.DB) {
          return errorResponse("Base de données D1 indisponible", 500, origin);
        }
        await ensureStorageTables(env.DB);
        const body = await request.json().catch(() => ({}));
        const category = body.category === "ai" ? "ai" : "storage";
        const plan = body.plan || {};

        const planId = String(plan.id || (category + "_plan_" + Date.now())).trim();
        const name = String(plan.name || "Nouveau Forfait").trim();
        const badge = String(plan.badge || "").trim();
        const description = String(plan.description || "").trim();
        const price = Number(plan.price) || 0;
        const primaryCurrency = String(plan.primary_currency || "USD").trim();
        const currenciesEnabled = typeof plan.currencies_enabled === "string" ? plan.currencies_enabled : JSON.stringify(plan.currencies_enabled || ["USD", "XOF", "EUR"]);
        const currencyConversions = typeof plan.currency_conversions === "string" ? plan.currency_conversions : JSON.stringify(plan.currency_conversions || {});
        const yearlyPrice = Number(plan.yearly_price) || 0;
        const yearlyDiscountPct = Number(plan.yearly_discount_pct) || 10;
        const features = typeof plan.features === "string" ? plan.features : JSON.stringify(plan.features || []);
        const isAutoBilling = plan.is_auto_billing ? 1 : 0;
        const isActive = plan.is_active !== undefined ? (plan.is_active ? 1 : 0) : 1;
        const sortOrder = Number(plan.sort_order) || 1;

        if (category === "ai") {
          const creditsOrWords = String(plan.credits_or_words || "100 000 mots IA").trim();
          const creditsCount = Number(plan.credits_count) || 100000;
          await env.DB.prepare(`
            INSERT INTO ai_subscription_plans (
              id, name, badge, description, credits_or_words, credits_count, price, primary_currency,
              currencies_enabled, currency_conversions, yearly_price, yearly_discount_pct, features,
              is_auto_billing, is_active, sort_order, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            planId, name, badge, description, creditsOrWords, creditsCount, price, primaryCurrency,
            currenciesEnabled, currencyConversions, yearlyPrice, yearlyDiscountPct, features,
            isAutoBilling, isActive, sortOrder
          ).run();

          const updatedPlan = await env.DB.prepare("SELECT * FROM ai_subscription_plans WHERE id = ?").bind(planId).first();
          return jsonResponse({ success: true, plan: updatedPlan }, 200, origin);
        } else {
          const storageAmount = String(plan.storage_amount || "10 Go").trim();
          const storageMb = Number(plan.storage_mb) || 10240;
          await env.DB.prepare(`
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

          const updatedPlan = await env.DB.prepare("SELECT * FROM storage_subscription_plans WHERE id = ?").bind(planId).first();
          return jsonResponse({ success: true, plan: updatedPlan }, 200, origin);
        }
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/subscription-plans/delete
      // ----------------------------------------------------------------------
      if (path === "/api/subscription-plans/delete" && method === "POST") {
        if (!env.DB) {
          return errorResponse("Base de données D1 indisponible", 500, origin);
        }
        await ensureStorageTables(env.DB);
        const body = await request.json().catch(() => ({}));
        const category = body.category === "ai" ? "ai" : "storage";
        const planId = String(body.id || "").trim();
        const tableName = category === "ai" ? "ai_subscription_plans" : "storage_subscription_plans";

        await env.DB.prepare(`DELETE FROM ${tableName} WHERE id = ?`).bind(planId).run();
        return jsonResponse({ success: true, id: planId }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/subscription-plans/toggle-active
      // ----------------------------------------------------------------------
      if (path === "/api/subscription-plans/toggle-active" && method === "POST") {
        if (!env.DB) {
          return errorResponse("Base de données D1 indisponible", 500, origin);
        }
        await ensureStorageTables(env.DB);
        const body = await request.json().catch(() => ({}));
        const category = body.category === "ai" ? "ai" : "storage";
        const planId = String(body.id || "").trim();
        const tableName = category === "ai" ? "ai_subscription_plans" : "storage_subscription_plans";

        if (body.is_active !== undefined) {
          const newVal = body.is_active ? 1 : 0;
          await env.DB.prepare(`UPDATE ${tableName} SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(newVal, planId).run();
        } else {
          await env.DB.prepare(`UPDATE ${tableName} SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(planId).run();
        }
        const row = await env.DB.prepare(`SELECT is_active FROM ${tableName} WHERE id = ?`).bind(planId).first();
        return jsonResponse({ success: true, is_active: row ? row.is_active : 1 }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/subscription-plans/toggle-auto-billing
      // ----------------------------------------------------------------------
      if (path === "/api/subscription-plans/toggle-auto-billing" && method === "POST") {
        if (!env.DB) {
          return errorResponse("Base de données D1 indisponible", 500, origin);
        }
        await ensureStorageTables(env.DB);
        const body = await request.json().catch(() => ({}));
        const category = body.category === "ai" ? "ai" : "storage";
        const planId = String(body.id || "").trim();
        const tableName = category === "ai" ? "ai_subscription_plans" : "storage_subscription_plans";

        if (body.is_auto_billing !== undefined) {
          const newVal = body.is_auto_billing ? 1 : 0;
          await env.DB.prepare(`UPDATE ${tableName} SET is_auto_billing = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(newVal, planId).run();
        } else {
          await env.DB.prepare(`UPDATE ${tableName} SET is_auto_billing = CASE WHEN is_auto_billing = 1 THEN 0 ELSE 1 END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(planId).run();
        }
        const row = await env.DB.prepare(`SELECT is_auto_billing FROM ${tableName} WHERE id = ?`).bind(planId).first();
        return jsonResponse({ success: true, is_auto_billing: row ? row.is_auto_billing : 0 }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // ROUTE POST : /api/subscription-plans/update-badge
      // ----------------------------------------------------------------------
      if (path === "/api/subscription-plans/update-badge" && method === "POST") {
        if (!env.DB) {
          return errorResponse("Base de données D1 indisponible", 500, origin);
        }
        await ensureStorageTables(env.DB);
        const body = await request.json().catch(() => ({}));
        const category = body.category === "ai" ? "ai" : "storage";
        const planId = String(body.id || "").trim();
        const badge = String(body.badge || "").trim();
        const tableName = category === "ai" ? "ai_subscription_plans" : "storage_subscription_plans";

        await env.DB.prepare(`UPDATE ${tableName} SET badge = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(badge, planId).run();
        return jsonResponse({ success: true, id: planId, badge }, 200, origin);
      }

      return errorResponse(`Route non trouv\xE9e : ${method} ${path}`, 404, origin);
    } catch (err) {
      console.error("Worker API Error:", err);
      return errorResponse(err.message || "Erreur interne du serveur", 500, origin);
    }
  },
  // Handler CRON Cloudflare : exécution périodique automatique pour nettoyer les interactions de plus de 30 jours
  async scheduled(event, env, ctx) {
    if (env && env.DB) {
      try {
        await env.DB.prepare(`
          DELETE FROM user_document_interactions 
          WHERE created_at < datetime('now', '-30 days')
        `).run();
        console.log("[StudyCloud Cron] Purge des interactions utilisateur de plus de 30 jours effectu\xE9e avec succ\xE8s.");
        await env.DB.prepare(`
          DELETE FROM notifications 
          WHERE created_at < datetime('now', '-21 days')
        `).run();
        console.log("[StudyCloud Cron] Purge des notifications de plus de 3 semaines (21 jours) effectu\xE9e avec succ\xE8s.");
      } catch (e) {
        console.error("[StudyCloud Cron Error]", e);
      }
    }
  }
};
export {
  src_default as default,
  generateCleanShareCode
};

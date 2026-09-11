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
      <stop offset="0%" stop-color="#EA580C"/>
      <stop offset="50%" stop-color="#F38020"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
  </defs>
  <g>
    <path d="M8 3C8 3 8 10 12 12C16 14 16 21 16 21" stroke="url(#scDnaGrad)" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M16 3C16 3 16 10 12 12C8 14 8 21 8 21" stroke="url(#scDnaGrad)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="10" y1="6" x2="14" y2="6" stroke="#2563EB" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
    <line x1="10.5" y1="9" x2="13.5" y2="9" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round" opacity="0.9"/>
    <line x1="11" y1="12" x2="13" y2="12" stroke="#F38020" stroke-width="2.8" stroke-linecap="round"/>
    <line x1="10.5" y1="15" x2="13.5" y2="15" stroke="#EA580C" stroke-width="1.5" stroke-linecap="round" opacity="0.9"/>
    <line x1="10" y1="18" x2="14" y2="18" stroke="#2563EB" stroke-width="1.5" stroke-linecap="round" opacity="0.85"/>
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

// ============================================================================
// Gestionnaire Principal du Worker
// ============================================================================
export default {
  async fetch(request: Request, rawEnv: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const origin = request.headers.get('Origin') || '*';

    // Normalisation des liaisons D1 & R2 (prend en compte MON_D1-STUDYCLOUD, MON_D1_STUDYCLOUD ou DB)
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
          service: 'StudyCloud Cloudflare Worker API',
          status: 'online',
          database: dbInstance ? 'Connecté (D1: d1-studycloud)' : 'Non lié',
          storage: bucketInstance ? 'Connecté (R2: r2-studycloud)' : 'Non lié',
          bindings: {
            d1: !!dbInstance,
            r2: !!bucketInstance,
          },
          timestamp: new Date().toISOString(),
        }, 200, origin);
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
        const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
        const hashArray = Array.from(new Uint8Array(bits));
        const saltArray = Array.from(salt);
        return btoa(JSON.stringify({ salt: saltArray, hash: hashArray }));
      }

      async function verifyPassword(password: string, stored: string): Promise<boolean> {
        try {
          const encoder = new TextEncoder();
          const { salt: saltArray, hash: hashArray } = JSON.parse(atob(stored));
          const salt = new Uint8Array(saltArray);
          const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
          const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
          const newHash = Array.from(new Uint8Array(bits));
          return JSON.stringify(newHash) === JSON.stringify(hashArray);
        } catch { return false; }
      }

      async function createJWT(payload: object, expiresInHours = 168): Promise<string> {
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
        // Check session still valid in DB
        const tokenHash = await hashToken(token);
        const session = await env.DB.prepare('SELECT id FROM auth_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP').bind(tokenHash).first();
        if (!session) return null;
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

      async function sendConfirmationEmail(toEmail: string, name: string, token: string, appOrigin = 'https://studycloud.dkd-technologies.com', isLogin = false): Promise<void> {
        try {
          const cleanOrigin = (appOrigin || 'https://studycloud.dkd-technologies.com').replace(/\/+$/, '');
          const publicAssetOrigin = (!cleanOrigin || cleanOrigin.includes('localhost') || !cleanOrigin.startsWith('https://'))
            ? 'https://studycloud.dkd-technologies.com'
            : cleanOrigin;
          const confirmUrl = `${cleanOrigin}/?verify_token=${encodeURIComponent(token)}`;
          const subject = isLogin
            ? '🔐 Confirmez votre connexion - StudyCloud'
            : '✉️ Confirmez votre adresse email - StudyCloud';
          const title = isLogin
            ? 'Confirmez votre connexion 🔐'
            : 'Confirmez votre adresse email 🎓';
          const description = isLogin
            ? 'Une tentative de connexion à votre compte StudyCloud a été effectuée. Pour confirmer qu\'il s\'agit bien de vous et accéder directement à votre espace d\'études, veuillez cliquer sur le bouton ci-dessous :'
            : 'Bienvenue sur <strong>StudyCloud</strong> ! Pour sécuriser votre compte, isoler vos documents et commencer vos révisions avec l\'assistant IA Delmas, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous :';
          const buttonText = isLogin
            ? 'Confirmer ma connexion &rarr;'
            : 'Confirmer mon adresse email &rarr;';
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'StudyCloud <noreply@dkd-technologies.com>',
              to: [toEmail],
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
                          <img src="${publicAssetOrigin}/api/assets/dna-logo.png" width="38" height="38" alt="Logo StudyCloud" style="display:block;border:0;width:38px;height:38px;margin:0;" />
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
                Bonjour <strong>${name}</strong>,
              </p>

              <p style="margin:0 0 24px 0;color:#475569;font-size:14px;line-height:1.6;">
                ${description}
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:30px 0;">
                <tr>
                  <td align="center">
                    <a href="${confirmUrl}" target="_blank" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg, #EA580C 0%, #F97316 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;border-radius:14px;box-shadow:0 8px 24px rgba(234,88,12,0.35);">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background:#f8fafc;border-radius:12px;padding:16px;border:1px solid #e2e8f0;margin-bottom:24px;">
                <p style="margin:0 0 8px 0;color:#64748b;font-size:12px;font-weight:600;">
                  Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
                </p>
                <a href="${confirmUrl}" style="color:#2563EB;font-size:12px;word-break:break-all;text-decoration:underline;">
                  ${confirmUrl}
                </a>
              </div>

              <div style="border-left:3px solid #f97316;padding-left:12px;margin:20px 0;">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">
                  ⏳ <strong>Validité :</strong> Ce lien est actif pendant 24 heures.<br>
                  🔒 Si vous n'avez pas demandé cette action, vous pouvez ignorer cet email en toute sécurité.
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
          const publicAssetOrigin = (!cleanOrigin || cleanOrigin.includes('localhost') || !cleanOrigin.startsWith('https://'))
            ? 'https://studycloud.dkd-technologies.com'
            : cleanOrigin;
          const title = '🎉 Bienvenue sur StudyCloud !';

          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'StudyCloud <noreply@dkd-technologies.com>',
              to: [toEmail],
              subject: '🎉 Bienvenue sur StudyCloud - Votre espace est prêt !',
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
                          <img src="${publicAssetOrigin}/api/assets/dna-logo.png" width="38" height="38" alt="Logo StudyCloud" style="display:block;border:0;width:38px;height:38px;margin:0;" />
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
                Bienvenue sur StudyCloud, ${name} ! 🎓
              </h1>

              <p style="margin:0 0 20px 0;color:#334155;font-size:15px;line-height:1.6;">
                Toute l'équipe de <strong>StudyCloud</strong> a le plaisir de vous accueillir ! Votre profil a été configuré avec succès et votre espace de travail numérique personnel est immédiatement opérationnel.
              </p>

              <!-- Contenu fluide directement sur le fond de la page (comme un livre, sans bloc ni cadre) -->
              <div style="margin:26px 0 28px 0;">
                <p style="margin:0 0 16px 0;font-size:14px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
                  🚀 Ce que vous pouvez faire dès maintenant :
                </p>

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
              </div>

              <!-- CTA Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:32px 0 24px 0;">
                <tr>
                  <td align="center">
                    <a href="${cleanOrigin}" target="_blank" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg, #EA580C 0%, #F97316 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;border-radius:14px;box-shadow:0 8px 24px rgba(234,88,12,0.35);">
                      Accéder à mon tableau de bord StudyCloud &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0 0;color:#64748b;font-size:13px;line-height:1.5;text-align:center;">
                Besoin d'aide ou d'assistance ? Notre support est à votre disposition à <a href="mailto:support@dkd-technologies.com" style="color:#2563EB;text-decoration:none;font-weight:600;">support@dkd-technologies.com</a>.
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
                          <img src="${publicAssetOrigin}/api/assets/dna-logo.png" width="38" height="38" alt="Logo StudyCloud" style="display:block;border:0;width:38px;height:38px;margin:0;" />
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

      async function ensurePasswordResetsTable(db: any) {
        try {
          await db.prepare(`
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
            )
          `).run();
        } catch (e) {}
        try {
          await db.prepare(`ALTER TABLE users ADD COLUMN security_question_1 TEXT DEFAULT 'Quelle est votre ville de naissance ?'`).run();
        } catch (e) {}
        try {
          await db.prepare(`ALTER TABLE users ADD COLUMN security_answer_1_hash TEXT DEFAULT ''`).run();
        } catch (e) {}
        try {
          await db.prepare(`ALTER TABLE users ADD COLUMN security_question_2 TEXT DEFAULT 'Quel est le prénom de votre mère ?'`).run();
        } catch (e) {}
        try {
          await db.prepare(`ALTER TABLE users ADD COLUMN security_answer_2_hash TEXT DEFAULT ''`).run();
        } catch (e) {}
      }

      // ----------------------------------------------------------------------
      // 0. AUTH — /api/auth/*
      // ----------------------------------------------------------------------

      // POST /api/auth/register — Inscription email/password avec confirmation obligatoire & questions de sécurité
      if (path === '/api/auth/register' && method === 'POST') {
        await ensurePasswordResetsTable(env.DB);
        const body: any = await request.json();
        const {
          name,
          email,
          password,
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
        const existing: any = await env.DB.prepare('SELECT id, email_verified FROM users WHERE email = ?').bind(cleanEmail).first();

        const q1 = securityQuestion1 || 'Quelle est votre ville de naissance ?';
        const q2 = securityQuestion2 || 'Quel est le prénom de votre mère ?';
        const answer1Hash = securityAnswer1 ? await hashToken(securityAnswer1.toLowerCase().trim()) : '';
        const answer2Hash = securityAnswer2 ? await hashToken(securityAnswer2.toLowerCase().trim()) : '';

        if (existing) {
          if (existing.email_verified === 1) {
            return errorResponse('Un compte vérifié existe déjà avec cet email', 409, origin);
          }
          // Si le compte existe mais n'a pas encore été confirmé, on met à jour les identifiants et les questions
          const passwordHash = await hashPassword(password);
          await env.DB.prepare(`
            UPDATE users SET
              name = ?,
              password_hash = ?,
              security_question_1 = ?,
              security_answer_1_hash = ?,
              security_question_2 = ?,
              security_answer_2_hash = ?,
              last_active_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(name.trim(), passwordHash, q1, answer1Hash, q2, answer2Hash, existing.id).run();

          const verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
          const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

          await env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(existing.id).run();
          await env.DB.prepare(`
            INSERT INTO email_verifications (id, user_id, email, token, resend_count, last_sent_at, expires_at)
            VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?)
          `).bind(generateId(), existing.id, cleanEmail, verificationToken, expiresAt).run();

          const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
          await sendConfirmationEmail(cleanEmail, name.trim(), verificationToken, clientOrigin);

          return jsonResponse({
            success: true,
            requiresVerification: true,
            email: cleanEmail,
            resendCount: 1,
            maxCount: 4,
            nextAllowedAt: new Date(Date.now() + 30000).toISOString(),
            message: 'Un email de confirmation vous a été envoyé.',
          }, 200, origin);
        }

        const userId = generateId();
        const passwordHash = await hashPassword(password);
        await env.DB.prepare(`
          INSERT INTO users (
            id, name, email, password_hash, provider, email_verified, is_onboarded,
            security_question_1, security_answer_1_hash, security_question_2, security_answer_2_hash,
            last_active_at, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, 'email', 0, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(userId, name.trim(), cleanEmail, passwordHash, q1, answer1Hash, q2, answer2Hash).run();

        await env.DB.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').bind(userId).run();

        // Création du token de confirmation
        const verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        await env.DB.prepare(`
          INSERT INTO email_verifications (id, user_id, email, token, resend_count, last_sent_at, expires_at)
          VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?)
        `).bind(generateId(), userId, cleanEmail, verificationToken, expiresAt).run();

        const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
        await sendConfirmationEmail(cleanEmail, name.trim(), verificationToken, clientOrigin);

        return jsonResponse({
          success: true,
          requiresVerification: true,
          email: cleanEmail,
          resendCount: 1,
          maxCount: 4,
          nextAllowedAt: new Date(Date.now() + 30000).toISOString(),
          message: 'Un email de confirmation vous a été envoyé.',
        }, 201, origin);
      }

      // POST /api/auth/resend-verification — Renvoi avec rate-limit 30s & blocage 3h après 4 tentatives
      if (path === '/api/auth/resend-verification' && method === 'POST') {
        const body: any = await request.json();
        const { email } = body;
        if (!email) return errorResponse('Email requis', 400, origin);
        if (!isValidEmail(email)) return errorResponse('Format d\'adresse email invalide (ex: exemple@gmail.com)', 400, origin);

        const cleanEmail = email.toLowerCase().trim();
        const user: any = await env.DB.prepare('SELECT id, name, email_verified FROM users WHERE email = ?').bind(cleanEmail).first();
        if (!user) return errorResponse('Aucun compte trouvé avec cet email', 404, origin);
        const isLoginFlow = user.email_verified === 1;

        const verif: any = await env.DB.prepare('SELECT * FROM email_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first();

        const now = Date.now();
        const THREE_HOURS_MS = 3 * 3600 * 1000;
        const THIRTY_SECONDS_MS = 30 * 1000;

        if (verif) {
          // 1. Vérification si l'utilisateur est actuellement bloqué (blocage de 3 heures)
          if (verif.blocked_until) {
            const blockedTime = new Date(verif.blocked_until).getTime();
            if (blockedTime > now) {
              const remainingMs = blockedTime - now;
              const remainingMin = Math.ceil(remainingMs / 60000);
              return jsonResponse({
                success: false,
                error: `Quota atteint (4 tentatives). Veuillez patienter ${remainingMin} minute(s) avant de recommencer.`,
                isBlocked: true,
                blockedUntil: verif.blocked_until,
                remainingMs,
              }, 429, origin);
            }
          }

          // 2. Vérification du décompte de 30 secondes
          if (verif.last_sent_at) {
            const lastSentTime = new Date(verif.last_sent_at).getTime();
            const elapsed = now - lastSentTime;
            if (elapsed < THIRTY_SECONDS_MS) {
              const remainingSec = Math.ceil((THIRTY_SECONDS_MS - elapsed) / 1000);
              return jsonResponse({
                success: false,
                error: `Veuillez patienter ${remainingSec} seconde(s) avant de renvoyer l'email.`,
                isCooldown: true,
                nextAllowedAt: new Date(lastSentTime + THIRTY_SECONDS_MS).toISOString(),
                remainingMs: THIRTY_SECONDS_MS - elapsed,
              }, 429, origin);
            }
          }

          // 3. Calcul du nouveau compteur
          let currentCount = verif.resend_count || 1;
          if (verif.blocked_until && new Date(verif.blocked_until).getTime() <= now) {
            currentCount = 0;
          }

          const newCount = currentCount + 1;
          let blockedUntil: string | null = null;
          if (newCount >= 4) {
            // 4 tentatives sans confirmation -> bloqué pendant 3 heures
            blockedUntil = new Date(now + THREE_HOURS_MS).toISOString();
          }

          const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
          const newExpiresAt = new Date(now + 24 * 3600 * 1000).toISOString();
          const nextAllowedAt = new Date(now + THIRTY_SECONDS_MS).toISOString();

          await env.DB.prepare(`
            UPDATE email_verifications SET
              token = ?,
              resend_count = ?,
              last_sent_at = CURRENT_TIMESTAMP,
              blocked_until = ?,
              expires_at = ?
            WHERE id = ?
          `).bind(newToken, newCount, blockedUntil, newExpiresAt, verif.id).run();

          const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
          await sendConfirmationEmail(cleanEmail, user.name, newToken, clientOrigin, isLoginFlow);

          return jsonResponse({
            success: true,
            message: 'Email de confirmation renvoyé !',
            resendCount: newCount,
            maxCount: 4,
            isBlocked: newCount >= 4,
            blockedUntil,
            nextAllowedAt,
          }, 200, origin);
        } else {
          const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
          const newExpiresAt = new Date(now + 24 * 3600 * 1000).toISOString();
          await env.DB.prepare(`
            INSERT INTO email_verifications (id, user_id, email, token, resend_count, last_sent_at, expires_at)
            VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?)
          `).bind(generateId(), user.id, cleanEmail, newToken, newExpiresAt).run();

          const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
          await sendConfirmationEmail(cleanEmail, user.name, newToken, clientOrigin, isLoginFlow);

          return jsonResponse({
            success: true,
            message: 'Email de confirmation renvoyé !',
            resendCount: 1,
            maxCount: 4,
            nextAllowedAt: new Date(now + THIRTY_SECONDS_MS).toISOString(),
          }, 200, origin);
        }
      }

      // GET /api/auth/verify-email — Validation du token de confirmation
      if (path === '/api/auth/verify-email' && method === 'GET') {
        const tokenParam = url.searchParams.get('token');
        if (!tokenParam) return errorResponse('Token de confirmation requis', 400, origin);

        const verif: any = await env.DB.prepare(
          'SELECT * FROM email_verifications WHERE token = ? AND expires_at > CURRENT_TIMESTAMP'
        ).bind(tokenParam).first();

        if (!verif) {
          return errorResponse('Lien de confirmation invalide ou expiré. Veuillez demander un nouvel email.', 400, origin);
        }

        const userBefore: any = await env.DB.prepare('SELECT email_verified FROM users WHERE id = ?').bind(verif.user_id).first();
        const isFirstVerification = userBefore?.email_verified === 0;

        // Marquer l'email vérifié
        await env.DB.prepare(`
          UPDATE users SET
            email_verified = 1,
            last_active_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(verif.user_id).run();

        // Supprimer la demande de vérification
        await env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(verif.user_id).run();

        const user: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(verif.user_id).first();
        if (!user) return errorResponse('Utilisateur introuvable', 404, origin);

        // Créer la session JWT
        const jwtToken = await createJWT({ userId: user.id, email: user.email, name: user.name });
        const tokenHash = await hashToken(jwtToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
        await env.DB.prepare('INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(generateId(), user.id, tokenHash, expiresAt).run();

        if (isFirstVerification) {
          sendWelcomeEmail(user.email, user.name);
        }

        const accept = request.headers.get('Accept') || '';
        if (accept.includes('text/html')) {
          const appUrl = (origin !== '*' ? origin : 'https://studycloud.dkd-technologies.com').replace(/\/+$/, '');
          return Response.redirect(`${appUrl}/?verified=1&token=${encodeURIComponent(jwtToken)}`, 302);
        }

        const safeUser = sanitizeUser(user);
        return jsonResponse({
          success: true,
          message: 'Adresse email confirmée avec succès !',
          token: jwtToken,
          user: safeUser,
        }, 200, origin);
      }

      // POST /api/auth/login — Connexion email/password
      if (path === '/api/auth/login' && method === 'POST') {
        const body: any = await request.json();
        const { email, password } = body;
        if (!email || !password) return errorResponse('Email et mot de passe requis', 400, origin);
        if (!isValidEmail(email)) return errorResponse('Format d\'adresse email invalide (ex: exemple@gmail.com)', 400, origin);

        const cleanEmail = email.toLowerCase().trim();
        const existingUser: any = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(cleanEmail).first();
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

        // Générer le token de confirmation de connexion (2FA / validation par email)
        const verificationToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

        await env.DB.prepare('DELETE FROM email_verifications WHERE user_id = ?').bind(user.id).run();
        await env.DB.prepare(`
          INSERT INTO email_verifications (id, user_id, email, token, resend_count, last_sent_at, expires_at)
          VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?)
        `).bind(generateId(), user.id, cleanEmail, verificationToken, expiresAt).run();

        const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
        await sendConfirmationEmail(cleanEmail, user.name, verificationToken, clientOrigin, true);

        return jsonResponse({
          success: true,
          requiresVerification: true,
          isLogin: true,
          email: cleanEmail,
          resendCount: 1,
          maxCount: 4,
          nextAllowedAt: new Date(Date.now() + 30000).toISOString(),
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
          const hash1 = await hashToken(answer1.toLowerCase().trim());
          const match1 = hash1 === user.security_answer_1_hash;
          let match2 = true;
          if (user.security_answer_2_hash && answer2) {
            const hash2 = await hashToken(answer2.toLowerCase().trim());
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
        const { email, targetEmail, resetSessionToken } = body;
        if (!email || !targetEmail || !resetSessionToken) {
          return errorResponse('Email, email de destination et token requis', 400, origin);
        }
        if (!isValidEmail(email)) return errorResponse('Format d\'adresse email du compte invalide (ex: exemple@gmail.com)', 400, origin);
        if (!isValidEmail(targetEmail)) return errorResponse('Format d\'adresse email de réception invalide (ex: exemple@gmail.com)', 400, origin);

        const cleanAccountEmail = email.toLowerCase().trim();
        const cleanTargetEmail = targetEmail.toLowerCase().trim();
        const user: any = await env.DB.prepare('SELECT id, name, email FROM users WHERE email = ?').bind(cleanAccountEmail).first();
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
        let user: any = await env.DB.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').bind(profile.id, cleanGoogleEmail).first();
        if (!user) {
          // Si l'utilisateur souhaitait se connecter à un compte existant mais qu'aucun compte n'existe
          if (action === 'login') {
            return jsonResponse({
              success: false,
              userNotFound: true,
              code: 'USER_NOT_FOUND',
              googleEmail: cleanGoogleEmail,
              googleName: profile.name || '',
              googleAvatar: profile.picture || null,
              error: `Aucun compte StudyCloud n'est actuellement associé à l'adresse Google (${cleanGoogleEmail}). Nous vous avons orienté vers la création de compte : complétez vos informations ci-dessous pour créer votre compte en quelques secondes !`,
            }, 404, origin);
          }

          // En mode inscription (ou premier accès) : création du compte
          const userId = generateId();
          await env.DB.prepare(`
            INSERT INTO users (id, name, email, provider, google_id, email_verified, avatar_url, is_onboarded, created_at, updated_at)
            VALUES (?, ?, ?, 'google', ?, 1, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(userId, profile.name || cleanGoogleEmail, cleanGoogleEmail, profile.id, profile.picture || null).run();
          await env.DB.prepare('INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)').bind(userId).run();
          user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
        } else if (!user.google_id) {
          // Lier le compte Google à un compte email existant et connecter immédiatement
          await env.DB.prepare('UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), email_verified = 1 WHERE id = ?').bind(profile.id, profile.picture || null, user.id).run();
          user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
        }

        const token = await createJWT({ userId: user.id, email: user.email, name: user.name });
        const tokenHash = await hashToken(token);
        const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
        await env.DB.prepare('INSERT OR REPLACE INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(generateId(), user.id, tokenHash, expiresAt).run();

        const safeUser = sanitizeUser(user);
        return jsonResponse({ success: true, token, user: safeUser }, 200, origin);
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

      // GET /api/auth/me — Profil de l'utilisateur connecté
      if (path === '/api/auth/me' && method === 'GET') {
        const authHeader = request.headers.get('Authorization') || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return errorResponse('Token requis', 401, origin);

        const payload = await verifyJWT(token);
        if (!payload?.userId) return errorResponse('Token invalide ou expiré', 401, origin);

        const tokenHash = await hashToken(token);
        const session = await env.DB.prepare('SELECT id FROM auth_sessions WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP').bind(tokenHash).first();
        if (!session) return errorResponse('Session expirée, veuillez vous reconnecter', 401, origin);

        const user: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.userId).first();
        if (!user) return errorResponse('Utilisateur introuvable', 404, origin);

        // Règle d'inactivité de 30 jours (1 mois)
        if (user.last_active_at) {
          const inactiveMs = Date.now() - new Date(user.last_active_at).getTime();
          const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000;
          if (inactiveMs > THIRTY_DAYS_MS) {
            await env.DB.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(user.id).run();
            return jsonResponse({
              success: false,
              error: 'Session expirée après 1 mois d\'inactivité. Veuillez vous reconnecter.',
              code: 'SESSION_EXPIRED_INACTIVE',
            }, 401, origin);
          }
        }
        await env.DB.prepare('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();

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
        const ans1Hash = await hashToken(securityAnswer1.toLowerCase().trim());
        const ans2Hash = await hashToken(securityAnswer2.toLowerCase().trim());
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

        const body: any = await request.json();
        const { name, school, filiere, level, country, phone, bio, avatarUrl } = body;
        const isStudent = body.is_student === 0 || body.isStudent === false ? false : true;
        const finalSchool = !isStudent ? (school || body.profession || 'Particulier / Professionnel') : school;
        const finalFiliere = !isStudent ? (filiere || body.profession || 'Général') : filiere;
        const finalLevel = !isStudent ? (level || 'Professionnel') : (level || '');

        if (!country) return errorResponse('Le pays est obligatoire', 400, origin);
        if (isStudent && (!finalSchool || !finalFiliere)) {
          return errorResponse("L'école et la filière sont obligatoires pour les étudiants", 400, origin);
        }

        const hasAvatarInBody = avatarUrl !== undefined;
        const avatarVal = avatarUrl ? String(avatarUrl) : null;

        await env.DB.prepare(`
          UPDATE users SET
            name = COALESCE(?, name),
            school = ?,
            filiere = ?,
            level = ?,
            country = ?,
            phone = COALESCE(?, phone),
            bio = COALESCE(?, bio),
            avatar_url = CASE WHEN ? = 1 THEN ? ELSE avatar_url END,
            is_onboarded = 1,
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
          hasAvatarInBody ? 1 : 0,
          avatarVal,
          payload.userId
        ).run();

        const user: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(payload.userId).first();
        
        // Envoi automatique de l'email de bienvenue professionnel StudyCloud / DKD Technologies
        if (user && user.email) {
          const clientOrigin = request.headers.get('Origin') || 'https://studycloud.dkd-technologies.com';
          sendWelcomeEmail(
            user.email,
            user.name || name || 'Étudiant',
            isStudent,
            finalSchool,
            finalFiliere,
            clientOrigin
          );
        }

        const safeUser = sanitizeUser(user);
        return jsonResponse({ success: true, data: safeUser }, 200, origin);
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
        await sendWelcomeEmail(
          user.email,
          user.name || 'Étudiant',
          user.school && user.school !== 'Particulier / Professionnel',
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

        const hasAvatar = avatarUrl !== undefined;
        const avatarVal = avatarUrl ? String(avatarUrl) : null;

        await env.DB.prepare(`
          INSERT INTO users (id, name, email, school, filiere, country, avatar_url, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            school = excluded.school,
            filiere = excluded.filiere,
            country = excluded.country,
            avatar_url = CASE WHEN ? = 1 THEN ? ELSE users.avatar_url END,
            updated_at = CURRENT_TIMESTAMP
        `).bind(
          id,
          name || 'Étudiant',
          email,
          school || 'CME',
          filiere || 'Général',
          country || "Côte d'Ivoire",
          avatarVal,
          hasAvatar ? 1 : 0,
          avatarVal
        ).run();

        // Initialiser les préférences utilisateur si inexistantes
        await env.DB.prepare(`
          INSERT OR IGNORE INTO user_preferences (user_id) VALUES (?)
        `).bind(id).run();

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
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          if (!userId) return errorResponse('userId requis', 400, origin);
          const { results } = await env.DB.prepare(`
            SELECT m.*, 
              (SELECT COUNT(*) FROM files f WHERE f.matiere_id = m.id) AS files_count,
              (SELECT COALESCE(SUM(f.size), 0) FROM files f WHERE f.matiere_id = m.id) AS total_size
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
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM matieres WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Matière supprimée' }, 200, origin);
      }

      // ----------------------------------------------------------------------
      // 3. FICHIERS (Métadonnées & Fichiers de cours)
      // ----------------------------------------------------------------------
      if (path === '/api/files') {
        if (method === 'GET') {
          const userId = url.searchParams.get('userId');
          const matiereId = url.searchParams.get('matiereId');
          const isStudySession = url.searchParams.get('isStudySession');
          if (!userId) return errorResponse('userId requis', 400, origin);

          let query = 'SELECT * FROM files WHERE user_id = ?';
          const params: any[] = [userId];

          if (matiereId === 'root' || matiereId === 'none') {
            query += ' AND (matiere_id IS NULL OR matiere_id = "" OR matiere_id = "Mes fichiers")';
          } else if (matiereId && matiereId !== 'all') {
            query += ' AND matiere_id = ?';
            params.push(matiereId);
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

      if (path.startsWith('/api/files/') && method === 'DELETE') {
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

        const fileBlob = await request.arrayBuffer();
        await env.BUCKET.put(key, fileBlob, {
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
          const { results } = await env.DB.prepare(query).bind(...params).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
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

          const finalShareCode = shareCode || `DKD-${crypto.randomUUID().substring(0, 6).toUpperCase()}`;
          const finalShareUrl = shareUrl || `${url.origin}/share/${finalShareCode}`;
          const finalQrCodeData = qrCodeData || finalShareUrl;
          const finalCountry = country || "Côte d'Ivoire";
          const finalIsPublic = isPublic !== undefined ? (isPublic ? 1 : 0) : 1;
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
        const isPublic = body.isPublic !== undefined ? (body.isPublic ? 1 : 0) : 1;
        const allowDownload = body.allowDownload !== undefined ? (body.allowDownload ? 1 : 0) : 1;

        await env.DB.prepare(`
          UPDATE shared_folders 
          SET is_public = ?, allow_download = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(isPublic, allowDownload, shareId).run();

        return jsonResponse({
          success: true,
          message: 'Visibilité mise à jour',
          isPublic: isPublic === 1,
          allowDownload: allowDownload === 1
        }, 200, origin);
      }

      if (path.startsWith('/api/shares/') && method === 'DELETE') {
        const shareId = path.split('/')[3];
        await env.DB.prepare('DELETE FROM shared_folder_files WHERE shared_folder_id = ?').bind(shareId).run();
        await env.DB.prepare('DELETE FROM shared_folders WHERE id = ?').bind(shareId).run();
        return jsonResponse({ success: true, message: 'Dossier partagé supprimé' }, 200, origin);
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
          await env.DB.prepare(`
            INSERT INTO schedule_slots (id, user_id, day, hour_slot, subject, room, note_or_teacher, color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, day, hourSlot, subject, room || '', noteOrTeacher || '', color || '#EA580C').run();
          return jsonResponse({ success: true }, 201, origin);
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
              sub_grades_json = excluded.sub_grades_json,
              average = excluded.average,
              updated_at = CURRENT_TIMESTAMP
          `).bind(id || crypto.randomUUID(), userId, trimester || 1, subjectName, coefficient || 1.0, subGradesJson || '[]', average || 0.0).run();
          return jsonResponse({ success: true }, 200, origin);
        }
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
          await env.DB.prepare(`
            INSERT INTO calendar_events (id, user_id, title, start_date, end_date, all_day, color, description, location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(id || crypto.randomUUID(), userId, title, startDate, endDate || null, allDay ? 1 : 0, color || '#EA580C', description || '', location || '').run();
          return jsonResponse({ success: true }, 201, origin);
        }
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
          `).bind(id || crypto.randomUUID(), userId, time, label || 'Réveil étude', isActive ? 1 : 0, daysJson || '["Tous les jours"]').run();
          return jsonResponse({ success: true }, 201, origin);
        }
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
          `).bind(id || crypto.randomUUID(), sellerId, title, description || '', price, category || 'Électronique', imageUrlsJson || '[]', isBoosted ? 1 : 0, boostFormula || null, boostViewsTarget || 0, boostEndDate || null).run();
          return jsonResponse({ success: true }, 201, origin);
        }
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
          return jsonResponse({ success: true, data: results }, 200, origin);
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
      // 16. CONTENUS GÉNÉRÉS PAR L'IA (Résumés, Cartes, Quiz, etc.)
      // ----------------------------------------------------------------------
      if (path === '/api/ai-contents') {
        const userId = url.searchParams.get('userId');
        const toolType = url.searchParams.get('toolType');
        const fileId = url.searchParams.get('fileId');

        if (method === 'GET') {
          if (!userId) return errorResponse('userId requis', 400, origin);
          let query = 'SELECT * FROM ai_generated_contents WHERE user_id = ?';
          const params: any[] = [userId];

          if (toolType && toolType !== 'all') {
            query += ' AND tool_type = ?';
            params.push(toolType);
          }
          if (fileId) {
            query += ' AND file_id = ?';
            params.push(fileId);
          }

          query += ' ORDER BY is_pinned DESC, updated_at DESC, created_at DESC';
          const { results } = await env.DB.prepare(query).bind(...params).all();
          return jsonResponse({ success: true, data: results }, 200, origin);
        }

        if (method === 'POST') {
          const body: any = await request.json();
          const { id, userId, fileId, toolType, title, contentJson, sourceFileName, isPinned } = body;
          if (!userId || !toolType || !title) return errorResponse('userId, toolType et title requis', 400, origin);

          const contentId = id || crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO ai_generated_contents (id, user_id, file_id, tool_type, title, content_json, source_file_name, is_pinned, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              content_json = excluded.content_json,
              source_file_name = excluded.source_file_name,
              is_pinned = excluded.is_pinned,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            contentId,
            userId,
            fileId || null,
            toolType,
            title,
            typeof contentJson === 'string' ? contentJson : JSON.stringify(contentJson || {}),
            sourceFileName || '',
            isPinned ? 1 : 0
          ).run();

          return jsonResponse({ success: true, data: { id: contentId } }, 201, origin);
        }
      }

      if (path.startsWith('/api/ai-contents/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await env.DB.prepare('DELETE FROM ai_generated_contents WHERE id = ?').bind(id).run();
        return jsonResponse({ success: true, message: 'Élément IA supprimé' }, 200, origin);
      }

      if (path.startsWith('/api/ai-contents/') && path.endsWith('/pin') && method === 'PUT') {
        const id = path.split('/')[3];
        const body: any = await request.json().catch(() => ({}));
        await env.DB.prepare('UPDATE ai_generated_contents SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .bind(body.isPinned ? 1 : 0, id).run();
        return jsonResponse({ success: true }, 200, origin);
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
          await env.DB.prepare(`
            INSERT INTO users (id, name, email, school, filiere, country, avatar_url, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              email = excluded.email,
              school = excluded.school,
              filiere = excluded.filiere,
              country = excluded.country,
              avatar_url = excluded.avatar_url,
              updated_at = CURRENT_TIMESTAMP
          `).bind(
            userId,
            userProfile.name || 'Étudiant',
            userProfile.email || `${userId}@studycloud.app`,
            userProfile.school || 'CME',
            userProfile.filiere || 'Général',
            userProfile.country || "Côte d'Ivoire",
            userProfile.avatarUrl || null
          ).run();
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

      // Route 404 par défaut
      return errorResponse(`Route non trouvée : ${method} ${path}`, 404, origin);

    } catch (err: any) {
      console.error('Worker API Error:', err);
      return errorResponse(err.message || 'Erreur interne du serveur', 500, origin);
    }
  },
};

// Classe MyWorkflow pour satisfaire la liaison Cloudflare Workflows si configurée dans le Dashboard Cloudflare
export class MyWorkflow {
  async run(event: any, step: any) {
    return;
  }
}


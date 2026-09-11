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
        const answer1Hash = securityAnswer1 ? await hashToken(securityAnswer1.slice(0, 30).toLowerCase().trim()) : '';
        const answer2Hash = securityAnswer2 ? await hashToken(securityAnswer2.slice(0, 30).toLowerCase().trim()) : '';

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


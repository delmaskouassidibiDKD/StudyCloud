import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StudyCloudAPI } from '../services/api';
import { restoreUserDataFromCloud, clearUserDataOnLogout } from '../services/userSync';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  provider: 'email' | 'google';
  school: string;
  filiere: string;
  country: string;
  level: string;
  bio: string;
  phone: string;
  avatar_url: string | null;
  is_onboarded: number;
  is_student?: number;
  email_verified: number;
  created_at: string;
  google_id?: string | null;
  has_password?: boolean;
  has_security_questions?: boolean;
  security_question_1?: string;
  security_question_2?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsOnboarding: boolean;
  needsSecuritySetup: boolean;
  /** Appelé après login/register réussi — stocke le token et charge le profil */
  loginWithToken: (token: string, user: AuthUser) => void;
  /** Met à jour les données du profil après onboarding ou configuration de sécurité */
  updateProfile: (data: Partial<AuthUser>) => void;
  /** Déconnecte l'utilisateur */
  logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true = vérification du token en cours

  // Au montage : vérifier si un token valide existe dans localStorage et tester l'inactivité de 1 mois (30 jours)
  useEffect(() => {
    const storedToken = localStorage.getItem('sc_auth_token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const lastActiveStr = localStorage.getItem('sc_last_active_at');
    if (lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (Date.now() - lastActive > ONE_MONTH_MS) {
        // Plus d'un mois d'inactivité : session expirée, reconnexion obligatoire !
        localStorage.removeItem('sc_auth_token');
        localStorage.removeItem('sc_last_active_at');
        setIsLoading(false);
        return;
      }
    }

    // Rafraîchir l'activité
    localStorage.setItem('sc_last_active_at', Date.now().toString());

    // Valider le token auprès du Worker
    StudyCloudAPI.getMe(storedToken)
      .then((res: any) => {
        if (res.success && res.data) {
          // Si l'utilisateur n'a pas encore finalisé son onboarding, vérifier la limite de 20 min ou 15 min d'inactivité
          if (Number(res.data.is_onboarded) !== 1) {
            const TWENTY_MIN_MS = 20 * 60 * 1000;
            const FIFTEEN_MIN_MS = 15 * 60 * 1000;
            const parseUtc = (d: any) => {
              if (!d) return 0;
              const s = String(d).trim();
              const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
              const ms = new Date(iso).getTime();
              return isNaN(ms) ? 0 : ms;
            };
            const createdAtTime = parseUtc(res.data.created_at);
            const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : createdAtTime;
            const isTimeout = createdAtTime > 0 && (Date.now() - createdAtTime > TWENTY_MIN_MS);
            const isInactive = lastActive > 0 && (Date.now() - lastActive > FIFTEEN_MIN_MS);

            if (isTimeout || isInactive) {
              // Compte non finalisé expiré : suppression et retour à l'accueil
              StudyCloudAPI.cancelUnfinalizedAccount({ userId: res.data.id, email: res.data.email }, storedToken).catch(() => {});
              localStorage.setItem('sc_onboarding_expired_notice', "Votre session d'inscription a expiré (délai de 20 minutes ou 15 minutes d'inactivité dépassé). Vos données temporaires ont été effacées. Veuillez recommencer.");
              clearUserDataOnLogout();
              setIsLoading(false);
              return;
            }
          }

          setUser(res.data);
          setToken(storedToken);
          localStorage.setItem('sc_last_active_at', Date.now().toString());
          // Sync user info in localStorage for the rest of the app
          localStorage.setItem('unifolder_user_id', res.data.id);
          localStorage.setItem('unifolder_user_name', res.data.name);
          localStorage.setItem('unifolder_user_school', res.data.school || '');
          localStorage.setItem('unifolder_user_country', res.data.country || "Côte d'Ivoire");
          if (res.data.filiere) localStorage.setItem('unifolder_user_filiere', res.data.filiere);
          if (res.data.email) localStorage.setItem('unifolder_user_email', res.data.email);
          if (res.data.phone) localStorage.setItem('unifolder_user_phone', res.data.phone);
          if (res.data.avatar_url) {
            localStorage.setItem('unifolder_user_avatar', res.data.avatar_url);
          }
          // Hydrater automatiquement les données Cloudflare D1 de l'utilisateur
          restoreUserDataFromCloud(res.data.id).catch(() => {});
        } else {
          // Token invalide ou expiré
          if (res?.code === 'SESSION_EXPIRED_UNFINALIZED' || (res?.error && typeof res.error === 'string' && res.error.includes('expiré'))) {
            localStorage.setItem('sc_onboarding_expired_notice', res.error || "Votre session d'inscription a expiré (délai de 20 minutes ou 15 minutes d'inactivité dépassé). Vos données temporaires ont été effacées. Veuillez recommencer.");
          }
          clearUserDataOnLogout();
        }
      })
      .catch((err: any) => {
        // Si le serveur nous dit que la session d'inscription a expiré (HTTP 410) ou token invalide (HTTP 401/403)
        if (err?.status === 410 || err?.data?.code === 'SESSION_EXPIRED_UNFINALIZED' || (err?.message && err.message.includes('expiré'))) {
          localStorage.setItem('sc_onboarding_expired_notice', err?.data?.error || err?.message || "Votre session d'inscription a expiré (délai de 20 minutes ou 15 minutes d'inactivité dépassé). Vos données temporaires ont été effacées. Veuillez recommencer.");
          clearUserDataOnLogout();
          return;
        }

        if (err?.status === 401 || err?.status === 403) {
          clearUserDataOnLogout();
          return;
        }

        // Erreur réseau pure — on garde la session locale si le token existe
        // (mode offline-first : pas de déconnexion forcée pour les comptes actifs)
        try {
          const payload = parseJwtPayload(storedToken);
          if (payload && payload.exp * 1000 > Date.now()) {
            // Ne pas restaurer en offline un compte non finalisé dont le délai est passé
            if (payload.user && Number(payload.user.is_onboarded) !== 1) {
              clearUserDataOnLogout();
              return;
            }
            setUser(payload.user as AuthUser);
            setToken(storedToken);
            localStorage.setItem('unifolder_user_id', payload.user.id);
            localStorage.setItem('unifolder_user_name', payload.user.name || 'Étudiant');
            if (payload.user.avatar_url) {
              localStorage.setItem('unifolder_user_avatar', payload.user.avatar_url);
            }
          } else {
            clearUserDataOnLogout();
          }
        } catch {
          clearUserDataOnLogout();
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const loginWithToken = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem('sc_auth_token', newToken);
    localStorage.setItem('sc_last_active_at', Date.now().toString());
    localStorage.setItem('unifolder_user_id', newUser.id);
    localStorage.setItem('unifolder_user_name', newUser.name);
    localStorage.setItem('unifolder_user_school', newUser.school || '');
    localStorage.setItem('unifolder_user_country', newUser.country || "Côte d'Ivoire");
    if (newUser.filiere) localStorage.setItem('unifolder_user_filiere', newUser.filiere);
    if (newUser.email) localStorage.setItem('unifolder_user_email', newUser.email);
    if (newUser.phone) localStorage.setItem('unifolder_user_phone', newUser.phone);
    if (newUser.avatar_url) {
      localStorage.setItem('unifolder_user_avatar', newUser.avatar_url);
    }
    setToken(newToken);
    setUser(newUser);
    // Restaurer immédiatement toutes les matières, fichiers, notes et plannings du compte connecté
    restoreUserDataFromCloud(newUser.id).catch(() => {});
  }, []);

  const updateProfile = useCallback((data: Partial<AuthUser>) => {
    setUser((prev) => (prev ? { ...prev, ...data } : prev));
    if (data.avatar_url !== undefined) {
      if (data.avatar_url) {
        localStorage.setItem('unifolder_user_avatar', data.avatar_url);
      } else {
        localStorage.removeItem('unifolder_user_avatar');
      }
    }
    if (data.name) localStorage.setItem('unifolder_user_name', data.name);
    if (data.school) localStorage.setItem('unifolder_user_school', data.school);
    if (data.filiere) localStorage.setItem('unifolder_user_filiere', data.filiere);
    if (data.country) localStorage.setItem('unifolder_user_country', data.country);
    if (data.email) localStorage.setItem('unifolder_user_email', data.email);
    if (data.phone) localStorage.setItem('unifolder_user_phone', data.phone);
  }, []);

  const logout = useCallback(() => {
    // Appeler le Worker pour invalider la session (best-effort)
    if (token) {
      StudyCloudAPI.logout(token).catch(() => {});
    }
    // Nettoyage strict et complet de la session locale pour isoler les utilisateurs
    clearUserDataOnLogout();
    setToken(null);
    setUser(null);
  }, [token]);

  const isAuthenticated = !!user && !!token;
  // 1. D'abord la configuration de sécurité (mot de passe pour reconnexion + questions secrètes de récupération pour compte Google)
  const needsSecuritySetup = Boolean(
    isAuthenticated &&
    user &&
    (user.has_password === false || user.has_security_questions === false)
  );
  // 2. Ensuite les questions personnelles d'onboarding (nom, école, filière, niveau, pays, téléphone, photo/logo)
  const needsOnboarding = Boolean(
    isAuthenticated &&
    !needsSecuritySetup &&
    user &&
    Number(user.is_onboarded) !== 1
  );

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated,
      isLoading,
      needsOnboarding,
      needsSecuritySetup,
      loginWithToken,
      updateProfile,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

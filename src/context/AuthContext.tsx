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
  profession?: string;
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
          localStorage.removeItem('sc_onboarding_expired_notice');
          localStorage.removeItem('sc_verification_expired_notice');
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
          clearUserDataOnLogout();
        }
      })
      .catch((err: any) => {
        if (err?.status === 401 || err?.status === 403 || err?.status === 410) {
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
    localStorage.removeItem('sc_onboarding_expired_notice');
    localStorage.removeItem('sc_verification_expired_notice');
    localStorage.removeItem(`sc_onb_start_${newUser.id}`);
    localStorage.removeItem('sc_onb_start_default');
    localStorage.removeItem(`sc_onb_last_active_${newUser.id}`);
    localStorage.removeItem('sc_onb_last_active_default');
    localStorage.removeItem('dkd_verification_status');
    localStorage.removeItem('sc_email_verified_signal');
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

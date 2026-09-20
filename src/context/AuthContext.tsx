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

// ─── Helpers & Initial State ─────────────────────────────────────────────────

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours (1 mois)

function parseJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/**
 * Récupère immédiatement et de façon synchrone la session locale enregistrée
 * pour éviter tout flash ou redirection vers la page de connexion au rechargement.
 */
function getStoredAuth(): { user: AuthUser | null; token: string | null } {
  try {
    const storedToken = localStorage.getItem('sc_auth_token');
    if (!storedToken) return { user: null, token: null };

    // Vérifier la règle d'inactivité stricte de 1 mois (30 jours)
    const lastActiveStr = localStorage.getItem('sc_last_active_at');
    if (lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (Date.now() - lastActive > ONE_MONTH_MS) {
        // Plus de 30 jours sans utiliser l'application : session expirée, reconnexion requise
        clearUserDataOnLogout();
        return { user: null, token: null };
      }
    }

    // 1. Tenter de charger l'objet utilisateur complet en cache
    const rawCachedUser = localStorage.getItem('sc_auth_user');
    if (rawCachedUser) {
      try {
        const parsed = JSON.parse(rawCachedUser);
        if (parsed && parsed.id) {
          return { user: parsed, token: storedToken };
        }
      } catch {}
    }

    // 2. Sinon, reconstituer immédiatement l'utilisateur à partir des champs du profil enregistrés
    const userId = localStorage.getItem('unifolder_user_id');
    const userName = localStorage.getItem('unifolder_user_name');
    if (userId && userName) {
      const reconstructed: AuthUser = {
        id: userId,
        name: userName,
        email: localStorage.getItem('unifolder_user_email') || '',
        provider: 'email',
        school: localStorage.getItem('unifolder_user_school') || '',
        filiere: localStorage.getItem('unifolder_user_filiere') || '',
        country: localStorage.getItem('unifolder_user_country') || "Côte d'Ivoire",
        level: '',
        bio: '',
        phone: localStorage.getItem('unifolder_user_phone') || '',
        avatar_url: localStorage.getItem('unifolder_user_avatar') || null,
        profession: localStorage.getItem('unifolder_user_profession') || undefined,
        is_onboarded: 1,
        is_student: localStorage.getItem('unifolder_is_student') === 'false' ? 0 : 1,
        email_verified: 1,
        created_at: new Date().toISOString(),
        has_password: true,
        has_security_questions: true,
      };
      return { user: reconstructed, token: storedToken };
    }

    // 3. Fallback JWT
    const payload = parseJwtPayload(storedToken);
    if (payload && (payload.userId || payload.user?.id)) {
      const fallbackUser: AuthUser = {
        id: payload.userId || payload.user?.id,
        name: payload.name || payload.user?.name || 'Étudiant',
        email: payload.email || payload.user?.email || '',
        provider: 'email',
        school: '',
        filiere: '',
        country: "Côte d'Ivoire",
        level: '',
        bio: '',
        phone: '',
        avatar_url: null,
        is_onboarded: 1,
        email_verified: 1,
        created_at: new Date().toISOString(),
        has_password: true,
        has_security_questions: true,
      };
      return { user: fallbackUser, token: storedToken };
    }

    return { user: null, token: storedToken };
  } catch {
    return { user: null, token: null };
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialisation synchrone : l'utilisateur est reconnu dès le 1er rendu si connecté
  const [initialSession] = useState(() => getStoredAuth());
  const [user, setUser] = useState<AuthUser | null>(() => initialSession.user);
  const [token, setToken] = useState<string | null>(() => initialSession.token);
  // Si on a déjà un utilisateur connecté en cache, aucun chargement bloquant n'est nécessaire
  const [isLoading, setIsLoading] = useState<boolean>(() => !initialSession.user && Boolean(initialSession.token));

  // Au montage : rafraîchir l'activité et synchroniser les données avec le Worker
  useEffect(() => {
    const storedToken = localStorage.getItem('sc_auth_token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Vérifier l'inactivité de 30 jours (1 mois)
    const lastActiveStr = localStorage.getItem('sc_last_active_at');
    if (lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (Date.now() - lastActive > ONE_MONTH_MS) {
        // Plus d'un mois d'inactivité : session expirée
        clearUserDataOnLogout();
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }
    }

    // Rafraîchir le timestamp d'activité
    localStorage.setItem('sc_last_active_at', Date.now().toString());

    // Valider et mettre à jour le profil en arrière-plan auprès du Worker
    StudyCloudAPI.getMe(storedToken)
      .then((res: any) => {
        if (res.success && res.data) {
          localStorage.removeItem('sc_onboarding_expired_notice');
          localStorage.removeItem('sc_verification_expired_notice');
          setUser(res.data);
          setToken(storedToken);
          localStorage.setItem('sc_auth_user', JSON.stringify(res.data));
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
        }
      })
      .catch((err: any) => {
        // SEULEMENT si le serveur signale explicitement que le compte a été supprimé (404)
        // ou que la session a dépassé 1 mois d'inactivité côté serveur
        if (
          err?.status === 404 ||
          err?.data?.code === 'SESSION_EXPIRED_INACTIVE' ||
          err?.message?.includes("1 mois d'inactivité")
        ) {
          clearUserDataOnLogout();
          setUser(null);
          setToken(null);
        }
        // En cas d'erreur réseau, de coupure temporaire ou de rechargement de page :
        // ON NE DÉCONNECTE JAMAIS l'utilisateur ! Il reste dans sa session.
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Heartbeat automatique : signale la présence en ligne auprès du serveur toutes les 45s
  useEffect(() => {
    if (!token) return;
    
    StudyCloudAPI.sendHeartbeat(token).catch(() => {});

    const interval = setInterval(() => {
      StudyCloudAPI.sendHeartbeat(token).catch(() => {});
    }, 45000);

    const onFocusOrVisible = () => {
      if (!document.hidden) {
        StudyCloudAPI.sendHeartbeat(token).catch(() => {});
      }
    };

    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    };
  }, [token]);

  const loginWithToken = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.removeItem('sc_onboarding_expired_notice');
    localStorage.removeItem('sc_verification_expired_notice');
    localStorage.removeItem(`sc_onb_start_${newUser.id}`);
    localStorage.removeItem('sc_onb_start_default');
    localStorage.removeItem(`sc_onb_last_active_${newUser.id}`);
    localStorage.removeItem('sc_onb_last_active_default');
    localStorage.removeItem('dkd_verification_status');
    localStorage.removeItem('sc_email_verified_signal');
    
    // Mémoriser le token, l'utilisateur complet et l'activité
    localStorage.setItem('sc_auth_token', newToken);
    localStorage.setItem('sc_auth_user', JSON.stringify(newUser));
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
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      try {
        localStorage.setItem('sc_auth_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });
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

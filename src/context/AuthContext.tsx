import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StudyCloudAPI } from '../services/api';
import { restoreUserDataFromCloud, clearUserDataOnLogout } from '../services/userSync';
import { CloudDataStore } from '../services/cloudDataStore';
import { queryClient } from '../services/queryClient';
import { isWallpaperAvatarPollution } from '../utils/wallpaperHelper';

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

    // 1. Tenter de charger l'objet utilisateur complet en cache (en purgeant tout fond d'écran polluant l'avatar)
    const rawCachedUser = localStorage.getItem('sc_auth_user');
    if (rawCachedUser) {
      try {
        const parsed = JSON.parse(rawCachedUser);
        if (parsed && parsed.id) {
          if (isWallpaperAvatarPollution(parsed.avatar_url)) {
            parsed.avatar_url = null;
            try { localStorage.setItem('sc_auth_user', JSON.stringify(parsed)); } catch {}
          }
          const lsAv = localStorage.getItem('unifolder_user_avatar');
          if (isWallpaperAvatarPollution(lsAv)) {
            try { localStorage.removeItem('unifolder_user_avatar'); } catch {}
          }
          return { user: parsed, token: storedToken };
        }
      } catch {}
    }

    // 2. Sinon, reconstituer immédiatement l'utilisateur à partir des champs du profil enregistrés
    const userId = localStorage.getItem('unifolder_user_id');
    const userName = localStorage.getItem('unifolder_user_name');
    if (userId && userName) {
      const lsAv = localStorage.getItem('unifolder_user_avatar');
      const safeAvatar = (lsAv && !isWallpaperAvatarPollution(lsAv)) ? lsAv : null;
      if (lsAv && !safeAvatar) {
        try { localStorage.removeItem('unifolder_user_avatar'); } catch {}
      }
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
        avatar_url: safeAvatar,
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
          const cleanAvatar = (res.data.avatar_url && !isWallpaperAvatarPollution(res.data.avatar_url)) ? res.data.avatar_url : null;
          const sanitizedUser = { ...res.data, avatar_url: cleanAvatar };
          setUser(sanitizedUser);
          setToken(storedToken);
          localStorage.setItem('sc_auth_user', JSON.stringify(sanitizedUser));
          localStorage.setItem('sc_last_active_at', Date.now().toString());
          // Sync user info in localStorage for the rest of the app
          localStorage.setItem('unifolder_user_id', sanitizedUser.id);
          localStorage.setItem('unifolder_user_name', sanitizedUser.name);
          localStorage.setItem('unifolder_user_school', sanitizedUser.school || '');
          localStorage.setItem('unifolder_user_country', sanitizedUser.country || "Côte d'Ivoire");
          if (sanitizedUser.filiere) localStorage.setItem('unifolder_user_filiere', sanitizedUser.filiere);
          if (sanitizedUser.email) localStorage.setItem('unifolder_user_email', sanitizedUser.email);
          if (sanitizedUser.phone) localStorage.setItem('unifolder_user_phone', sanitizedUser.phone);
          if (cleanAvatar) {
            localStorage.setItem('unifolder_user_avatar', cleanAvatar);
          } else {
            localStorage.removeItem('unifolder_user_avatar');
          }
          // Hydrater automatiquement les données Cloudflare D1 de l'utilisateur
          restoreUserDataFromCloud(sanitizedUser.id).catch(() => {});
          CloudDataStore.sync(true).catch(() => {});
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
          CloudDataStore.clearCache().catch(() => {});
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
    // Si l'utilisateur connecté change ou si une session précédente existait, nettoyer pour une isolation parfaite
    const prevUserId = localStorage.getItem('unifolder_user_id');
    if (prevUserId !== newUser.id) {
      clearUserDataOnLogout();
      CloudDataStore.clearCache().catch(() => {});
      queryClient.clear();
    }

    localStorage.removeItem('sc_onboarding_expired_notice');
    localStorage.removeItem('sc_verification_expired_notice');
    localStorage.removeItem(`sc_onb_start_${newUser.id}`);
    localStorage.removeItem('sc_onb_start_default');
    localStorage.removeItem(`sc_onb_last_active_${newUser.id}`);
    localStorage.removeItem('sc_onb_last_active_default');
    localStorage.removeItem('dkd_verification_status');
    localStorage.removeItem('sc_email_verified_signal');
    
    // Mémoriser le token, l'utilisateur complet et l'activité
    const cleanNewAvatar = (newUser.avatar_url && !isWallpaperAvatarPollution(newUser.avatar_url)) ? newUser.avatar_url : null;
    const sanitizedNewUser = { ...newUser, avatar_url: cleanNewAvatar };
    localStorage.setItem('sc_auth_token', newToken);
    localStorage.setItem('sc_auth_user', JSON.stringify(sanitizedNewUser));
    localStorage.setItem('sc_last_active_at', Date.now().toString());
    localStorage.setItem('unifolder_user_id', sanitizedNewUser.id);
    localStorage.setItem('unifolder_user_name', sanitizedNewUser.name);
    localStorage.setItem('unifolder_user_school', sanitizedNewUser.school || '');
    localStorage.setItem('unifolder_user_country', sanitizedNewUser.country || "Côte d'Ivoire");
    if (sanitizedNewUser.filiere) localStorage.setItem('unifolder_user_filiere', sanitizedNewUser.filiere);
    if (sanitizedNewUser.email) localStorage.setItem('unifolder_user_email', sanitizedNewUser.email);
    if (sanitizedNewUser.phone) localStorage.setItem('unifolder_user_phone', sanitizedNewUser.phone);
    if (cleanNewAvatar) {
      localStorage.setItem('unifolder_user_avatar', cleanNewAvatar);
    } else {
      localStorage.removeItem('unifolder_user_avatar');
    }
    setToken(newToken);
    setUser(sanitizedNewUser);
    // Restaurer immédiatement toutes les matières, fichiers, notes et plannings du compte connecté
    restoreUserDataFromCloud(sanitizedNewUser.id).catch(() => {});
    CloudDataStore.resetAndSyncForUser(sanitizedNewUser.id).catch(() => {});
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
    CloudDataStore.clearCache().catch(() => {});
    queryClient.clear();
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

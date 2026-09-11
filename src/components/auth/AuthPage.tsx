import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, AlertCircle, CheckCircle2, User, ShieldCheck, KeyRound, UserPlus, X, Sparkles } from 'lucide-react';
import { StudyCloudAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DnaLogo } from '../DnaLogo';
import { EmailPendingVerification } from './EmailPendingVerification';
import { PhonePushNotification } from './PhonePushNotification';
import { ForgotPasswordFlow } from './ForgotPasswordFlow';

interface AuthPageProps {
  onBack?: () => void;
}

type AuthMode = 'choose' | 'login' | 'register';

const GOOGLE_CLIENT_ID =
  import.meta.env?.VITE_GOOGLE_CLIENT_ID ||
  '447906836160-cetqimg26feeu41saj58tmmnnnj8ebfa.apps.googleusercontent.com';

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

export function validatePasswordRules(pwd: string): {
  isValid: boolean;
  hasMinLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  message?: string;
} {
  const hasMinLength = pwd.length >= 6;
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecialChar = /[^a-zA-Z0-9]/.test(pwd);

  const isValid = hasMinLength && hasLetter && hasNumber && hasSpecialChar;

  let message = '';
  if (!hasMinLength) {
    message = 'Le mot de passe doit comporter au moins 6 caractères.';
  } else if (!hasLetter) {
    message = 'Le mot de passe doit contenir des lettres.';
  } else if (!hasNumber) {
    message = 'Le mot de passe doit contenir des chiffres.';
  } else if (!hasSpecialChar) {
    message = 'Le mot de passe doit contenir des caractères spéciaux (ex: @, #, $, !, etc.).';
  }

  return {
    isValid,
    hasMinLength,
    hasLetter,
    hasNumber,
    hasSpecialChar,
    message,
  };
}

export function AuthPage({ onBack }: AuthPageProps) {
  const { loginWithToken } = useAuth();

  // Mode direct : 'login' par défaut pour afficher la connexion immédiatement, ou 'register' si redirection
  const [mode, setMode] = useState<AuthMode>(() => {
    const saved = localStorage.getItem('sc_auth_redirect_mode');
    if (saved === 'register' || saved === 'login') return saved;
    return 'login';
  });
  const [email, setEmail] = useState(() => {
    return localStorage.getItem('sc_auth_prefill_email') || '';
  });
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [name, setName] = useState(() => {
    return localStorage.getItem('sc_auth_prefill_name') || '';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Message informatif professionnel si compte non trouvé lors d'une tentative de connexion (Email ou Google)
  const [accountNotFoundNotice, setAccountNotFoundNotice] = useState<string | null>(() => {
    return localStorage.getItem('sc_auth_redirect_notice') || null;
  });

  // Écouter les redirections automatiques d'authentification (ex: tentative de connexion Google sans compte existant)
  React.useEffect(() => {
    const handleRedirectEvent = () => {
      const savedMode = localStorage.getItem('sc_auth_redirect_mode');
      const savedNotice = localStorage.getItem('sc_auth_redirect_notice');
      const savedEmail = localStorage.getItem('sc_auth_prefill_email');
      const savedName = localStorage.getItem('sc_auth_prefill_name');
      if (savedMode === 'register' || savedMode === 'login') {
        setMode(savedMode);
      }
      if (savedNotice) {
        setAccountNotFoundNotice(savedNotice);
      }
      if (savedEmail) {
        setEmail(savedEmail);
      }
      if (savedName) {
        setName(savedName);
      }
      localStorage.removeItem('sc_auth_redirect_mode');
      localStorage.removeItem('sc_auth_redirect_notice');
      localStorage.removeItem('sc_auth_prefill_email');
      localStorage.removeItem('sc_auth_prefill_name');
    };

    handleRedirectEvent();
    window.addEventListener('studycloud_auth_redirect', handleRedirectEvent);
    return () => {
      window.removeEventListener('studycloud_auth_redirect', handleRedirectEvent);
    };
  }, []);

  // Questions de sécurité personnelles pour récupération de mot de passe
  const [securityQuestion1, setSecurityQuestion1] = useState('Quelle est votre ville de naissance ?');
  const [securityAnswer1, setSecurityAnswer1] = useState('');
  const [securityQuestion2, setSecurityQuestion2] = useState('Quel est le prénom de votre mère ?');
  const [securityAnswer2, setSecurityAnswer2] = useState('');

  // Flux de mot de passe oublié
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Notification WhatsApp / Téléphone en haut de l'écran
  const [pushNotification, setPushNotification] = useState<{
    isVisible: boolean;
    message: string;
    targetEmail?: string;
  } | null>(null);

  // État d'attente de confirmation email (persistant même après rafraîchissement)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(() => {
    return localStorage.getItem('sc_pending_verification_email') || null;
  });
  const [isLoginVerification, setIsLoginVerification] = useState<boolean>(() => {
    return localStorage.getItem('sc_pending_verification_is_login') === '1';
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setEmail('');
    setEmailTouched(false);
    setPassword('');
    setName('');
    setSecurityAnswer1('');
    setSecurityAnswer2('');
    setError(null);
    setAccountNotFoundNotice(null);
    setSuccess(null);
    localStorage.removeItem('sc_auth_redirect_mode');
    localStorage.removeItem('sc_auth_redirect_notice');
    localStorage.removeItem('sc_auth_prefill_email');
    localStorage.removeItem('sc_auth_prefill_name');
  };

  // ─── Email Auth ─────────────────────────────────────────────────────────────

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password.trim()) {
      setError('Email et mot de passe sont requis.');
      return;
    }
    if (!isValidEmail(email)) {
      setError("Le format de l'adresse email est invalide. Veuillez respecter le format attendu (ex: exemple@gmail.com).");
      return;
    }
    if (mode === 'register') {
      const pwdRules = validatePasswordRules(password);
      if (!pwdRules.isValid) {
        setError(pwdRules.message || 'Le mot de passe doit comporter au moins 6 caractères et contenir des lettres, des chiffres et des caractères spéciaux (ex: @, #, $, !, etc.).');
        return;
      }
      if (!name.trim()) {
        setError('Le nom complet est requis.');
        return;
      }
      if (!securityAnswer1.trim() || !securityAnswer2.trim()) {
        setError('Veuillez renseigner les réponses à vos deux questions de sécurité pour protéger votre compte.');
        return;
      }
    } else {
      if (password.length < 1) {
        setError('Le mot de passe est requis.');
        return;
      }
    }

    setIsLoading(true);
    try {
      let res: any;
      if (mode === 'register') {
        res = await StudyCloudAPI.register({
          name: name.trim(),
          email: email.trim(),
          password,
          securityQuestion1,
          securityAnswer1: securityAnswer1.trim(),
          securityQuestion2,
          securityAnswer2: securityAnswer2.trim(),
        });
      } else {
        res = await StudyCloudAPI.login({ email: email.trim(), password });
      }

      // Si aucun compte trouvé : Redirection automatique vers l'inscription avec message professionnel
      if (res.userNotFound || (res as any).code === 'USER_NOT_FOUND') {
        setMode('register');
        setPassword('');
        setError(null);
        setAccountNotFoundNotice(
          "Aucun compte associé à cette adresse email n'a été trouvé. Nous vous avons orienté vers l'inscription : complétez simplement vos informations ci-dessous pour créer votre compte StudyCloud gratuitement !"
        );
        return;
      }

      // Si compte créé avec Google
      if (res.isGoogleAccount) {
        setError("Ce compte est associé à Google. Veuillez cliquer sur le bouton « Continuer avec Google » ci-dessous pour vous connecter.");
        return;
      }

      // Si confirmation email requise (inscription OU connexion 2FA)
      if (res.requiresVerification) {
        const targetEmail = email.trim().toLowerCase();
        const isLogin = mode === 'login' || !!res.isLogin;
        localStorage.setItem('sc_pending_verification_email', targetEmail);
        localStorage.setItem('sc_pending_verification_is_login', isLogin ? '1' : '0');
        setPendingVerificationEmail(targetEmail);
        setIsLoginVerification(isLogin);
        return;
      }

      if (res.success && res.token && res.user) {
        setSuccess(mode === 'register' ? 'Compte créé ! Bienvenue 🎉' : 'Connexion réussie !');
        setTimeout(() => {
          loginWithToken(res.token, res.user);
        }, 800);
      } else {
        setError(res.error || 'Une erreur est survenue.');
      }
    } catch (err: any) {
      if (err.userNotFound || err.status === 404 || err.message?.includes('Aucun compte') || err.message?.includes('non trouvé')) {
        setMode('register');
        setPassword('');
        setError(null);
        setAccountNotFoundNotice(
          "Aucun compte associé à cette adresse email n'a été trouvé. Nous vous avons orienté vers l'inscription : complétez simplement vos informations ci-dessous pour créer votre compte StudyCloud gratuitement !"
        );
      } else if (err.isGoogleAccount) {
        setError("Ce compte est associé à Google. Veuillez cliquer sur le bouton « Continuer avec Google » ci-dessous pour vous connecter.");
      } else {
        setError(err.message || 'Impossible de joindre le serveur. Réessayez.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Google Auth ─────────────────────────────────────────────────────────────

  const handleGoogleSignIn = (targetAction?: 'login' | 'register') => {
    if (!GOOGLE_CLIENT_ID) {
      setError(
        'Google OAuth n\'est pas encore configuré. Veuillez ajouter votre Client ID Google dans la variable VITE_GOOGLE_CLIENT_ID, ou utilisez Email/Mot de passe.'
      );
      return;
    }

    const action = targetAction || (mode === 'register' ? 'register' : 'login');
    localStorage.setItem('sc_google_auth_mode', action);

    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const scope = 'openid email profile';
    const responseType = 'code';
    const state = action;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}&prompt=select_account`;

    window.location.href = authUrl;
  };

  // ─── Si mot de passe oublié est ouvert ────────────────────────────────────────

  if (showForgotPassword) {
    return (
      <ForgotPasswordFlow
        initialEmail={email}
        onCancel={() => {
          setShowForgotPassword(false);
          setError(null);
        }}
        onCodeSent={(target) => {
          setShowForgotPassword(false);
          setMode('login');
          setPushNotification({
            isVisible: true,
            message: 'Le code de réinitialisation a été envoyé à votre adresse email !',
            targetEmail: target,
          });
        }}
        onPasswordResetSuccess={() => {
          setShowForgotPassword(false);
          setMode('login');
          setSuccess('Mot de passe mis à jour avec succès ! Vous pouvez maintenant vous connecter.');
        }}
      />
    );
  }

  // ─── Si un email est en attente de confirmation ──────────────────────────────

  if (pendingVerificationEmail) {
    return (
      <EmailPendingVerification
        email={pendingVerificationEmail}
        isLogin={isLoginVerification}
        onBackToLogin={() => {
          localStorage.removeItem('sc_pending_verification_email');
          localStorage.removeItem('sc_pending_verification_is_login');
          setPendingVerificationEmail(null);
          setMode('login');
        }}
      />
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[99998] overflow-y-auto overflow-x-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 40%, #24243e 70%, #0f2027 100%)',
      }}
    >
      {/* WhatsApp / Phone Push Notification Banner */}
      {pushNotification && pushNotification.isVisible && (
        <PhonePushNotification
          message={pushNotification.message}
          targetEmail={pushNotification.targetEmail}
          onClose={() => setPushNotification(null)}
        />
      )}

      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-15 blur-[90px] animate-pulse"
          style={{ background: 'radial-gradient(circle, #EA580C 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full opacity-15 blur-[90px] animate-pulse"
          style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)', animationDelay: '2s' }} />
      </div>

      <div className="min-h-full w-full flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8 py-8 sm:py-12">
        {/* Main Responsive Layout Wrapper (Wide Desktop Hero + Form Split Layout) */}
        <div className="relative z-10 w-full max-w-6xl xl:max-w-7xl my-auto">
        <div
          className="grid grid-cols-1 md:grid-cols-12 overflow-hidden rounded-3xl"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 32px 100px rgba(0, 0, 0, 0.65), 0 0 1px 1px rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Left Column (Desktop Hero & Brand Showcase - Visible on md: and up) */}
          <div className="hidden md:flex md:col-span-5 flex-col justify-between p-8 lg:p-10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] border-r border-white/10 relative overflow-hidden">
            {/* Inner background glow */}
            <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-orange-500/20 blur-[60px] pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-blue-500/20 blur-[60px] pointer-events-none" />

            <div>
              {/* Brand Top */}
              <div className="flex items-center gap-3 mb-8 notranslate select-none">
                <DnaLogo className="w-11 h-11 drop-shadow-[0_0_8px_rgba(234,88,12,0.6)] shrink-0" glow={true} />
                <div className="flex flex-col leading-tight">
                  <h1 className="font-black tracking-tight text-2xl leading-none">
                    <span className="text-orange-500">Study</span>
                    <span className="text-blue-500">Cloud</span>
                  </h1>
                  <p className="text-[9px] text-amber-400 font-bold uppercase tracking-widest mt-1">
                    DKD TECHNOLOGIES
                  </p>
                </div>
              </div>

              {/* Catchphrase */}
              <h2 className="text-2xl xl:text-3xl font-black text-white leading-tight mb-3">
                Votre espace Cloud sécurisé pour stocker, classer et protéger toutes vos données.
              </h2>
              <p className="text-xs xl:text-sm text-white/60 leading-relaxed mb-8">
                Étudiants, élèves, professionnels et entreprises : conservez vos cours, fiches, dossiers et données importantes en lieu sûr pour ne jamais les perdre. Accédez-y partout, avec l'intelligence artificielle intégrée.
              </p>

              {/* Information list written directly on background (no icons in front, no enclosing box borders) */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    Stockage Cloud & Classement Intelligent
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Organisez vos cours scolaires et universitaires, documents personnels et archives d'entreprise en toute sécurité avec accès instantané partout.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    Assistant IA Delmas Intégré
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Révisez plus vite, posez des questions sur vos cours ou documents, et générez des résumés précis grâce à l'intelligence artificielle.
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    Sécurité Maximale & Données Protégées
                  </h4>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Chiffrement avancé, double authentification (2FA) et isolation étanche pour protéger vos cours, vos fiches et vos projets professionnels.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom info */}
            <div className="pt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40">
              <span>DKD TECHNOLOGIES Cloud</span>
              <span className="font-semibold text-orange-400">Étudiants, Élèves & Entreprises</span>
            </div>
          </div>

          {/* Right Column (Auth Form) - 7 cols on md: and up, full width on mobile */}
          <div className="md:col-span-7 p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center">
            {/* Header (visible on mobile/tablet or when back button needed) */}
            <div className="flex items-center gap-3 mb-6">
              {mode !== 'login' ? (
                <button
                  type="button"
                  onClick={() => { setMode('login'); resetForm(); }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                  title="Retour à la connexion"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              ) : null}

              {/* Mobile brand header (shown on small screens) */}
              <div className="flex md:hidden items-center gap-2.5 notranslate select-none">
                <DnaLogo className="w-8 h-8 drop-shadow-[0_0_2px_rgba(0,0,0,1)]" glow={true} />
                <div className="flex flex-col leading-tight">
                  <h1 className="font-extrabold tracking-tight text-xl leading-none">
                    <span className="text-orange-500">Study</span>
                    <span className="text-blue-500">Cloud</span>
                  </h1>
                  <p className="text-[8px] text-amber-400 font-bold uppercase tracking-widest mt-0.5">
                    DKD TECHNOLOGIES
                  </p>
                </div>
              </div>
            </div>

        {/* ── CHOOSE MODE ── */}
        {mode === 'choose' && (
          <>
            <h2 className="text-xl font-black text-white mb-1">Connexion</h2>
            <p className="text-sm text-white/50 font-medium mb-7">Choisissez votre méthode de connexion</p>

            {/* Google button (Blue with official Google logo) */}
            <button
              id="auth-google-btn"
              type="button"
              onClick={() => handleGoogleSignIn('login')}
              className="w-full py-3.5 px-5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-3 mb-4 transition-all hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-blue-600/30 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              {/* Google Official Multi-color Logo on white circle */}
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              </div>
              <span>Continuer avec Google</span>
            </button>

            {/* Separator */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
              <span className="text-xs text-white/35 font-semibold">OU</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
            </div>

            {/* Email buttons */}
            <div className="space-y-2.5">
              <button
                id="auth-email-login-btn"
                type="button"
                onClick={() => { setMode('login'); resetForm(); }}
                className="w-full py-3 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #EA580C, #F97316)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(234,88,12,0.35)',
                }}
              >
                <Mail className="w-4 h-4" />
                Se connecter avec Email
              </button>

              <button
                id="auth-email-register-btn"
                type="button"
                onClick={() => { setMode('register'); resetForm(); }}
                className="w-full py-3 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <User className="w-4 h-4" />
                Créer un compte
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 rounded-xl flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300 font-medium leading-relaxed">{error}</p>
              </div>
            )}
          </>
        )}

        {/* ── EMAIL FORM ── */}
        {(mode === 'login' || mode === 'register') && (
          <>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-1.5 tracking-tight">
              {mode === 'register' ? 'Créer un compte' : 'Connexion à votre espace'}
            </h2>
            <p className="text-xs sm:text-sm text-white/50 font-medium mb-6">
              {mode === 'register'
                ? 'Créez votre espace Cloud sécurisé pour vos études, cours et dossiers professionnels'
                : 'Accédez à vos cours, documents et dossiers sauvegardés en toute sécurité'}
            </p>

            {/* Bannière professionnelle d'information quand aucun compte n'est trouvé */}
            {accountNotFoundNotice && mode === 'register' && (
              <div
                className="mb-6 p-4 sm:p-5 rounded-2xl flex items-start gap-3.5 border transition-all animate-fadeIn"
                style={{
                  background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.16) 0%, rgba(37, 99, 235, 0.12) 100%)',
                  borderColor: 'rgba(249, 115, 22, 0.35)',
                  boxShadow: '0 8px 30px rgba(234, 88, 12, 0.15)',
                }}
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500/25 to-amber-500/20 border border-orange-500/40 flex items-center justify-center shrink-0 mt-0.5 text-orange-400 shadow-sm">
                  <UserPlus className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-orange-300 uppercase tracking-wider">
                        Compte non trouvé
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-200 border border-orange-500/30">
                        <Sparkles className="w-2.5 h-2.5" /> Inscription
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAccountNotFoundNotice(null)}
                      className="text-white/40 hover:text-white/90 text-xs p-1 transition-colors rounded-lg hover:bg-white/10 cursor-pointer"
                      title="Fermer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-white/90 leading-relaxed font-normal">
                    {accountNotFoundNotice}
                  </p>
                  <p className="text-[11px] text-orange-200/70 font-semibold mt-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Votre adresse email a été conservée ci-dessous pour vous faire gagner du temps.</span>
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {/* Nom (register only) */}
              {mode === 'register' && (
                <div>
                  <label className="text-xs sm:text-sm font-bold text-white/70 mb-1.5 block">Nom complet *</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="auth-name-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex : Konan Alexandre"
                      required
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              {/* Email & Password Grid (2 columns on sm/md/lg for register) */}
              {mode === 'register' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Email */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs sm:text-sm font-bold text-white/70">Adresse email / Gmail *</label>
                      {email.trim().length > 0 && isValidEmail(email) && (
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Format valide
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                        email.trim().length > 0 && !isValidEmail(email) && (email.includes('@') || emailTouched)
                          ? 'text-red-400'
                          : email.trim().length > 0 && isValidEmail(email)
                          ? 'text-emerald-400'
                          : 'text-white/30'
                      }`} />
                      <input
                        id="auth-email-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => setEmailTouched(true)}
                        placeholder="exemple@gmail.com"
                        required
                        className={`w-full pl-11 pr-10 py-3.5 rounded-2xl text-sm font-medium text-white placeholder-white/30 outline-none transition-all ${
                          email.trim().length > 0 && !isValidEmail(email) && (email.includes('@') || emailTouched)
                            ? 'border-2 border-red-500/70 focus:ring-2 focus:ring-red-500/50'
                            : email.trim().length > 0 && isValidEmail(email)
                            ? 'border-2 border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/50'
                            : 'focus:ring-2 focus:ring-orange-500/50'
                        }`}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: !(email.trim().length > 0 && (isValidEmail(email) || (email.includes('@') || emailTouched)))
                            ? '1px solid rgba(255,255,255,0.12)'
                            : undefined,
                        }}
                        autoComplete="email"
                      />
                      {email.trim().length > 0 && isValidEmail(email) && (
                        <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                      )}
                      {email.trim().length > 0 && !isValidEmail(email) && (email.includes('@') || emailTouched) && (
                        <AlertCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                      )}
                    </div>
                    {email.trim().length > 0 && !isValidEmail(email) && (email.includes('@') || emailTouched) && (
                      <p className="text-[11px] text-red-400 font-medium mt-1.5 flex items-center gap-1">
                        <span>Format invalide (doit respecter ex: nom@gmail.com)</span>
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-xs sm:text-sm font-bold text-white/70 mb-1.5 block">Mot de passe *</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        id="auth-register-password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-11 pr-12 py-3.5 rounded-2xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Exigences de sécurité du mot de passe */}
                    <div className="mt-2 p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                      <p className="text-[11px] font-bold text-white/60">Le mot de passe doit comporter :</p>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                        <span className={`flex items-center gap-1 font-medium ${password.length >= 6 ? 'text-emerald-400' : 'text-white/40'}`}>
                          <span>{password.length >= 6 ? '✓' : '○'}</span>
                          <span>Min. 6 caractères</span>
                        </span>
                        <span className={`flex items-center gap-1 font-medium ${/[a-zA-Z]/.test(password) ? 'text-emerald-400' : 'text-white/40'}`}>
                          <span>{/[a-zA-Z]/.test(password) ? '✓' : '○'}</span>
                          <span>Des lettres (a-z)</span>
                        </span>
                        <span className={`flex items-center gap-1 font-medium ${/[0-9]/.test(password) ? 'text-emerald-400' : 'text-white/40'}`}>
                          <span>{/[0-9]/.test(password) ? '✓' : '○'}</span>
                          <span>Des chiffres (0-9)</span>
                        </span>
                        <span className={`flex items-center gap-1 font-medium ${/[^a-zA-Z0-9]/.test(password) ? 'text-emerald-400' : 'text-white/40'}`}>
                          <span>{/[^a-zA-Z0-9]/.test(password) ? '✓' : '○'}</span>
                          <span>Caractère spécial (@, #, !, ...)</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Login mode: Email & Password stack */
                <>
                  {/* Email */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs sm:text-sm font-bold text-white/70">Adresse email / Gmail *</label>
                      {email.trim().length > 0 && isValidEmail(email) && (
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Format valide
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                        email.trim().length > 0 && !isValidEmail(email) && (email.includes('@') || emailTouched)
                          ? 'text-red-400'
                          : email.trim().length > 0 && isValidEmail(email)
                          ? 'text-emerald-400'
                          : 'text-white/30'
                      }`} />
                      <input
                        id="auth-email-input"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => setEmailTouched(true)}
                        placeholder="exemple@gmail.com"
                        required
                        className={`w-full pl-11 pr-10 py-3.5 rounded-2xl text-sm font-medium text-white placeholder-white/30 outline-none transition-all ${
                          email.trim().length > 0 && !isValidEmail(email) && (email.includes('@') || emailTouched)
                            ? 'border-2 border-red-500/70 focus:ring-2 focus:ring-red-500/50'
                            : email.trim().length > 0 && isValidEmail(email)
                            ? 'border-2 border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/50'
                            : 'focus:ring-2 focus:ring-orange-500/50'
                        }`}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: !(email.trim().length > 0 && (isValidEmail(email) || (email.includes('@') || emailTouched)))
                            ? '1px solid rgba(255,255,255,0.12)'
                            : undefined,
                        }}
                        autoComplete="email"
                      />
                      {email.trim().length > 0 && isValidEmail(email) && (
                        <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                      )}
                      {email.trim().length > 0 && !isValidEmail(email) && (email.includes('@') || emailTouched) && (
                        <AlertCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                      )}
                    </div>
                    {email.trim().length > 0 && !isValidEmail(email) && (email.includes('@') || emailTouched) && (
                      <p className="text-[11px] text-red-400 font-medium mt-1.5 flex items-center gap-1">
                        <span>Format invalide (doit respecter ex: nom@gmail.com)</span>
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs sm:text-sm font-bold text-white/70">Mot de passe *</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setError(null);
                        }}
                        className="text-xs font-bold text-orange-400 hover:text-orange-300 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Mot de passe oublié ?</span>
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        id="auth-password-input"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-11 pr-12 py-3.5 rounded-2xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                        autoComplete="off"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Questions de sécurité personnelles (register only) - 2 colonnes sur sm/md/lg */}
              {mode === 'register' && (
                <div className="pt-3 border-t border-white/10 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-orange-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Informations de sécurité pour récupération de compte</span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Renseignez vos réponses secrètes. Elles vous permettront de récupérer votre mot de passe en cas d'oubli.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Question 1 */}
                    <div>
                      <label className="text-[11px] font-bold text-white/70 mb-1 block">Question secrète 1 *</label>
                      <select
                        value={securityQuestion1}
                        onChange={(e) => setSecurityQuestion1(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-white bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer"
                      >
                        <option value="Quelle est votre ville de naissance ?" className="bg-slate-900 text-white">Quelle est votre ville de naissance ?</option>
                        <option value="Quel est le nom de votre premier animal de compagnie ?" className="bg-slate-900 text-white">Quel est le nom de votre premier animal de compagnie ?</option>
                        <option value="Quel est votre plat ivoirien préféré ?" className="bg-slate-900 text-white">Quel est votre plat ivoirien préféré ?</option>
                        <option value="Quel est le prénom de votre meilleur(e) ami(e) d'enfance ?" className="bg-slate-900 text-white">Quel est le prénom de votre meilleur(e) ami(e) d'enfance ?</option>
                      </select>
                      <input
                        type="text"
                        value={securityAnswer1}
                        onChange={(e) => setSecurityAnswer1(e.target.value)}
                        placeholder="Votre réponse secrète *"
                        required
                        className="w-full mt-1.5 px-3 py-2.5 rounded-xl text-xs font-medium text-white placeholder-white/30 bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>

                    {/* Question 2 */}
                    <div>
                      <label className="text-[11px] font-bold text-white/70 mb-1 block">Question secrète 2 *</label>
                      <select
                        value={securityQuestion2}
                        onChange={(e) => setSecurityQuestion2(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-xs font-medium text-white bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer"
                      >
                        <option value="Quel est le prénom de votre mère ?" className="bg-slate-900 text-white">Quel est le prénom de votre mère ?</option>
                        <option value="Quel était votre surnom à l'école ?" className="bg-slate-900 text-white">Quel était votre surnom à l'école ?</option>
                        <option value="Dans quelle commune avez-vous grandi ?" className="bg-slate-900 text-white">Dans quelle commune avez-vous grandi ?</option>
                        <option value="Quel est le nom de votre école primaire ?" className="bg-slate-900 text-white">Quel est le nom de votre école primaire ?</option>
                      </select>
                      <input
                        type="text"
                        value={securityAnswer2}
                        onChange={(e) => setSecurityAnswer2(e.target.value)}
                        placeholder="Votre réponse secrète *"
                        required
                        className="w-full mt-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white placeholder-white/30 bg-white/10 border border-white/15 outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Error / Success */}
              {error && (
                <div className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">{error}</p>
                  </div>
                  {mode === 'login' && (
                    <div className="pt-1.5 border-t border-red-500/20 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setError(null);
                        }}
                        className="text-[11px] font-bold text-white bg-red-500/30 hover:bg-red-500/50 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Mot de passe oublié ? Récupérer ici</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {success && (
                <div className="p-3.5 rounded-2xl flex items-center gap-2"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-300 font-medium">{success}</p>
                </div>
              )}

              {/* Submit */}
              <button
                id="auth-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 rounded-2xl font-extrabold text-white text-base flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer mt-2"
                style={{
                  background: isLoading ? 'rgba(234,88,12,0.5)' : 'linear-gradient(135deg, #EA580C, #F97316)',
                  boxShadow: isLoading ? 'none' : '0 8px 28px rgba(234,88,12,0.35)',
                }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {mode === 'register' ? 'Création de compte...' : 'Connexion en cours...'}
                  </span>
                ) : (
                  mode === 'register' ? 'Créer mon compte' : 'Se connecter'
                )}
              </button>
            </form>

            {/* Google alternative */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">ou continuer avec</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              type="button"
              onClick={() => handleGoogleSignIn(mode === 'register' ? 'register' : 'login')}
              className="w-full py-3.5 px-5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-3 transition-all hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-blue-600/30 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              {/* Google Official Multi-color Logo on white circle */}
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              </div>
              <span>{mode === 'register' ? "S'inscrire avec Google" : 'Continuer avec Google'}</span>
            </button>

            {/* Switch mode */}
            <div className="mt-5 text-center">
              <span className="text-xs sm:text-sm text-white/50 font-medium">
                {mode === 'register' ? 'Vous avez déjà un compte ? ' : 'Pas encore de compte ? '}
              </span>
              <button
                type="button"
                onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); resetForm(); }}
                className="text-xs sm:text-sm font-bold text-orange-400 hover:text-orange-300 transition-colors cursor-pointer underline underline-offset-4 ml-1"
              >
                {mode === 'register' ? 'Se connecter' : 'Créer un compte'}
              </button>
            </div>
          </>
        )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

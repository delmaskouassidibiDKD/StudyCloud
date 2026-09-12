import React, { useState, useEffect } from 'react';
import { Mail, Clock, RefreshCw, ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { StudyCloudAPI } from '../../services/api';
import { DnaLogo } from '../DnaLogo';

interface EmailPendingVerificationProps {
  email: string;
  isLogin?: boolean;
  onBackToLogin: () => void;
  onEmailVerified?: (token: string, user: any) => void;
}

export function EmailPendingVerification({
  email,
  isLogin = false,
  onBackToLogin,
  onEmailVerified,
}: EmailPendingVerificationProps) {
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [resendCount, setResendCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoDetected, setIsAutoDetected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBlocked = !!blockedUntil && new Date(blockedUntil).getTime() > Date.now();

  const COOLDOWN_KEY = `sc_resend_target_${email.toLowerCase()}`;
  const BLOCKED_KEY = `sc_resend_blocked_${email.toLowerCase()}`;
  const COUNT_KEY = `sc_resend_count_${email.toLowerCase()}`;
  const COOLDOWN_DURATION_MS = 60 * 1000; // 1 minute exacte (60 secondes)

  // Initialisation et restauration de l'état persistant
  useEffect(() => {
    // Vérifier notice d'expiration éventuelle stockée lors d'un clic sur lien expiré
    const expiredNotice = localStorage.getItem('sc_verification_expired_notice');
    if (expiredNotice) {
      setError(expiredNotice);
      localStorage.removeItem('sc_verification_expired_notice');
    }

    // 1. Restaurer le compteur de renvois
    const savedCount = localStorage.getItem(COUNT_KEY);
    if (savedCount) {
      setResendCount(parseInt(savedCount, 10) || 1);
    } else {
      localStorage.setItem(COUNT_KEY, '1');
      setResendCount(1);
    }

    // 2. Restaurer le blocage de 3 heures
    const savedBlockedUntil = localStorage.getItem(BLOCKED_KEY);
    if (savedBlockedUntil) {
      const blockedTime = new Date(savedBlockedUntil).getTime();
      if (blockedTime > Date.now()) {
        setBlockedUntil(savedBlockedUntil);
      } else {
        localStorage.removeItem(BLOCKED_KEY);
        localStorage.setItem(COUNT_KEY, '0');
        setBlockedUntil(null);
        setResendCount(0);
      }
    }

    // 3. Restaurer le décompteur de 1 minute (60 secondes)
    const savedTarget = localStorage.getItem(COOLDOWN_KEY);
    if (savedTarget) {
      const targetTime = parseInt(savedTarget, 10);
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      if (remaining > 0) {
        setSecondsLeft(remaining);
      } else {
        setSecondsLeft(0);
      }
    } else {
      // Premier affichage : lancer un décompte initial de 60s (1 minute)
      const targetTime = Date.now() + COOLDOWN_DURATION_MS;
      localStorage.setItem(COOLDOWN_KEY, targetTime.toString());
      setSecondsLeft(60);
    }
  }, [email]);

  // Horloge de mise à jour toutes les 500ms et réveil instantané à la réactivation de l'écran
  useEffect(() => {
    const syncCooldown = () => {
      // Vérifier le blocage de 3h
      const savedBlockedUntil = localStorage.getItem(BLOCKED_KEY);
      if (savedBlockedUntil) {
        const blockedTime = new Date(savedBlockedUntil).getTime();
        const now = Date.now();
        if (blockedTime > now) {
          setBlockedUntil(savedBlockedUntil);
        } else {
          localStorage.removeItem(BLOCKED_KEY);
          localStorage.setItem(COUNT_KEY, '0');
          setBlockedUntil(null);
          setResendCount(0);
        }
      }

      // Vérifier le décompteur de 1 minute (60 secondes)
      const savedTarget = localStorage.getItem(COOLDOWN_KEY);
      if (savedTarget) {
        const targetTime = parseInt(savedTarget, 10);
        const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
        setSecondsLeft(remaining);
      } else {
        setSecondsLeft(0);
      }
    };

    syncCooldown();
    const interval = setInterval(syncCooldown, 500);

    const handleWakeUp = () => syncCooldown();
    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('focus', handleWakeUp);
    window.addEventListener('pageshow', handleWakeUp);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('focus', handleWakeUp);
      window.removeEventListener('pageshow', handleWakeUp);
    };
  }, [email]);

  // Polling automatique pour détection cross-device en temps réel (si l'email est confirmé sur smartphone ou autre onglet)
  useEffect(() => {
    let isMounted = true;
    let isChecking = false;

    const pollInterval = setInterval(async () => {
      if (isChecking || !email || isBlocked || isAutoDetected) return;
      isChecking = true;

      try {
        const res: any = await StudyCloudAPI.checkVerificationStatus(email);
        if (res && res.confirmed && res.token && res.user && isMounted) {
          clearInterval(pollInterval);
          setIsAutoDetected(true);
          setMessage('🎉 Confirmation validée avec succès ! Connexion instantanée à votre espace...');

          setTimeout(() => {
            if (onEmailVerified) {
              onEmailVerified(res.token, res.user);
            } else {
              localStorage.setItem('sc_auth_token', res.token);
              localStorage.setItem('sc_user', JSON.stringify(res.user));
              localStorage.removeItem('sc_pending_verification_email');
              localStorage.removeItem('sc_pending_verification_is_login');
              window.location.href = '/';
            }
          }, 900);
        }
      } catch (e) {
        // Ignorer silencieusement les erreurs réseaux temporaires de polling
      } finally {
        isChecking = false;
      }
    }, 1800);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [email, isBlocked, isAutoDetected, onEmailVerified]);

  // Renvoyer l'email
  const handleResend = async () => {
    if (secondsLeft > 0 || blockedUntil || isLoading) return;

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res: any = await StudyCloudAPI.resendVerification(email);

      if (res.success) {
        const newCount = res.resendCount || (resendCount + 1);
        setResendCount(newCount);
        localStorage.setItem(COUNT_KEY, newCount.toString());

        // Si bloqué (après 4 tentatives)
        if (res.isBlocked || res.blockedUntil || newCount >= 4) {
          const blockDate = res.blockedUntil || new Date(Date.now() + 3 * 3600 * 1000).toISOString();
          setBlockedUntil(blockDate);
          localStorage.setItem(BLOCKED_KEY, blockDate);
          setError('Quota atteint (4/4 tentatives). Veuillez patienter 3 heures avant de pouvoir réclamer un nouvel email.');
        } else {
          // Relancer le décompte persistant de 1 minute (60 secondes)
          const targetTime = Date.now() + COOLDOWN_DURATION_MS;
          localStorage.setItem(COOLDOWN_KEY, targetTime.toString());
          setSecondsLeft(60);
          setMessage('✨ Un nouveau lien de confirmation sécurisé (valable 1 minute) vient de vous être envoyé !');
        }
      } else {
        if (res.isBlocked) {
          setBlockedUntil(res.blockedUntil);
          localStorage.setItem(BLOCKED_KEY, res.blockedUntil);
        }
        setError(res.error || "Impossible de renvoyer l'email.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors du renvoi de l'email.");
    } finally {
      setIsLoading(false);
    }
  };

  // Calcul du temps restant de blocage (heures et minutes)
  const formatBlockedTime = () => {
    if (!blockedUntil) return '';
    const remainingMs = Math.max(0, new Date(blockedUntil).getTime() - Date.now());
    const hours = Math.floor(remainingMs / (3600 * 1000));
    const minutes = Math.ceil((remainingMs % (3600 * 1000)) / 60000);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} minute(s)`;
  };

  return (
    <div
      className="fixed inset-0 z-[99998] flex flex-col items-center justify-center overflow-auto py-10 px-4 sm:px-6"
      style={{
        background: isLogin
          ? 'linear-gradient(135deg, #09091d 0%, #0d1230 40%, #111a42 70%, #08111e 100%)'
          : 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 40%, #24243e 70%, #0f2027 100%)',
      }}
    >
      {/* Background orbs (Différenciés selon le mode Login 2FA ou Inscription) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {isLogin ? (
          <>
            <div
              className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[100px] animate-pulse"
              style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)' }}
            />
            <div
              className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full opacity-20 blur-[100px] animate-pulse"
              style={{ background: 'radial-gradient(circle, #4F46E5 0%, transparent 70%)', animationDelay: '2s' }}
            />
          </>
        ) : (
          <>
            <div
              className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] rounded-full opacity-15 blur-[90px] animate-pulse"
              style={{ background: 'radial-gradient(circle, #EA580C 0%, transparent 70%)' }}
            />
            <div
              className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-15 blur-[90px] animate-pulse"
              style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)', animationDelay: '2s' }}
            />
          </>
        )}
      </div>

      {/* Direct Content Container - Agrandissement & espacement premium */}
      <div className="relative z-10 w-full max-w-2xl md:max-w-3xl py-8 my-auto">
        {/* Top brand header with official DnaLogo */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3 notranslate select-none">
            <DnaLogo className="w-10 h-10 drop-shadow-[0_0_2px_rgba(0,0,0,1)]" glow={true} />
            <div className="flex flex-col leading-tight">
              <h1 className="font-extrabold tracking-tight text-2xl leading-none">
                <span className="text-orange-500">Study</span>
                <span className="text-blue-500">Cloud</span>
              </h1>
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest mt-0.5">
                DKD TECHNOLOGIES
              </p>
            </div>
          </div>
          {isLogin ? (
            <span className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Double Authentification (2FA)</span>
            </span>
          ) : (
            <span className="text-xs font-bold px-3.5 py-1.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm">
              Confirmation d'inscription
            </span>
          )}
        </div>

        {/* Big animated icon - Design distinct pour Connexion 2FA vs Inscription */}
        <div className="flex justify-center mb-7">
          {isLogin ? (
            <div className="relative">
              <div
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse"
                style={{
                  background: 'linear-gradient(135deg, #1E1B4B 0%, #2563EB 50%, #06B6D4 100%)',
                  boxShadow: '0 16px 45px rgba(6,182,212,0.35)',
                }}
              >
                <ShieldCheck className="w-12 h-12 sm:w-14 sm:h-14 text-white" strokeWidth={2.2} />
              </div>
            </div>
          ) : (
            <div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse"
              style={{
                background: 'linear-gradient(135deg, #EA580C 0%, #F97316 50%, #2563EB 100%)',
                boxShadow: '0 16px 45px rgba(234,88,12,0.45)',
              }}
            >
              <Mail className="w-12 h-12 sm:w-14 sm:h-14 text-white" strokeWidth={2.2} />
            </div>
          )}
        </div>

        {/* Main Heading */}
        <h2 className="text-2xl sm:text-3xl font-black text-white text-center mb-3 tracking-tight">
          {isLogin ? 'Autorisation de connexion requise 🛡️' : 'Vérifiez votre boîte email 🎓'}
        </h2>
        <p className="text-sm sm:text-base text-white/70 text-center leading-relaxed mb-6 max-w-xl mx-auto">
          {isLogin
            ? "Pour sécuriser l'accès à vos cours et protéger vos données, un lien d'autorisation à usage unique a été envoyé à :"
            : 'Un lien de confirmation sécurisé a été envoyé à votre adresse pour valider votre compte :'}
        </p>

        {/* Highlighted Email Badge */}
        <div
          className={`border rounded-2xl px-6 py-3.5 text-center mb-6 shadow-inner ${
            isLogin ? 'bg-cyan-950/30 border-cyan-500/30' : 'bg-white/10 border-white/20'
          }`}
        >
          <span
            className={`text-base sm:text-lg font-mono font-black break-all select-all tracking-wide ${
              isLogin ? 'text-cyan-300' : 'text-orange-400'
            }`}
          >
            {email}
          </span>
        </div>

        {/* Détection en direct cross-device (téléphone portable / ordinateur) */}
        <div
          className={`mb-6 p-4 rounded-2xl border flex items-center gap-3.5 shadow-md ${
            isLogin ? 'bg-cyan-500/10 border-cyan-500/25 text-cyan-200' : 'bg-blue-500/10 border-blue-500/25 text-blue-200'
          }`}
        >
          <span className="relative flex h-3.5 w-3.5 shrink-0">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isLogin ? 'bg-cyan-400' : 'bg-blue-400'
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-3.5 w-3.5 ${
                isLogin ? 'bg-cyan-500' : 'bg-blue-500'
              }`}
            ></span>
          </span>
          <div className="flex-1 text-xs sm:text-sm leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold mb-0.5">
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Détection automatique en direct</span>
            </div>
            <p className="opacity-80">
              Si vous confirmez le lien depuis votre téléphone ou un autre onglet, cet écran se connectera automatiquement sans rechargement.
            </p>
          </div>
        </div>

        {/* Message / Error banners */}
        {message && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-sm font-semibold flex items-center gap-3 shadow-lg">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-sm font-semibold flex items-center gap-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Alerte Expiration lorsque le décompteur de 1 minute est terminé */}
        {!isBlocked && secondsLeft === 0 && (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-amber-500/15 border border-amber-500/35 text-amber-200 flex items-start gap-3.5 shadow-lg shadow-amber-500/5">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-black text-sm sm:text-base text-amber-300">
                Le lien de confirmation précédent a expiré (validité 1 minute)
              </p>
              <p className="text-xs sm:text-sm text-amber-200/80 leading-relaxed">
                Le temps imparti est passé : ce lien ne peut plus être utilisé. Veuillez cliquer sur le bouton ci-dessous pour réclamer un nouveau lien valide.
              </p>
            </div>
          </div>
        )}

        {/* Blocked alert banner */}
        {isBlocked ? (
          <div className="mb-6 p-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 space-y-2.5">
            <div className="flex items-center gap-2 font-extrabold text-sm text-amber-300">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>Limite de renvois atteinte (4/4 tentatives)</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-200/80">
              Vous avez demandé 4 renvois sans confirmation. Par mesure de sécurité anti-spam, le bouton est suspendu pendant 3 heures.
            </p>
            <div className="flex items-center justify-between pt-2 border-t border-amber-500/20 text-xs sm:text-sm">
              <span className="font-bold text-amber-300">Temps d'attente restant :</span>
              <span className="font-mono font-black text-white bg-amber-500/30 px-2.5 py-1 rounded-lg">
                ⏳ {formatBlockedTime()}
              </span>
            </div>
          </div>
        ) : (
          /* Quota counter indicator */
          <div className="flex items-center justify-between text-xs sm:text-sm text-white/60 mb-4 px-2">
            <span>Tentatives effectuées aujourd'hui :</span>
            <span className={`font-bold ${resendCount >= 3 ? 'text-amber-400' : 'text-white/80'}`}>
              {resendCount} / 4
            </span>
          </div>
        )}

        {/* Main Action Button (Resend with Countdown or Claim New) */}
        <button
          type="button"
          onClick={handleResend}
          disabled={secondsLeft > 0 || isBlocked || isLoading || isAutoDetected}
          className={`w-full py-4 sm:py-4.5 px-6 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xl ${
            secondsLeft > 0 || isBlocked || isLoading || isAutoDetected
              ? 'bg-white/10 text-white/40 cursor-not-allowed border border-white/10'
              : isLogin
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-cyan-500/30 hover:scale-[1.01] active:scale-[0.99]'
              : 'bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 hover:from-orange-600 hover:to-orange-700 text-white shadow-orange-500/30 hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          {isAutoDetected ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-bounce" />
              <span>Connexion validée ! Accès en cours...</span>
            </>
          ) : isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Génération du lien en cours...</span>
            </>
          ) : isBlocked ? (
            <>
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Bloqué pendant {formatBlockedTime()}</span>
            </>
          ) : secondsLeft > 0 ? (
            <>
              <Clock
                className={`w-5 h-5 animate-spin ${isLogin ? 'text-cyan-300' : 'text-orange-400'}`}
                style={{ animationDuration: '4s' }}
              />
              <span>Lien actif · Renvoyer disponible dans ({secondsLeft}s)</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              <span>Réclamer un nouveau lien de confirmation</span>
            </>
          )}
        </button>

        {/* Help text */}
        <p className="text-xs sm:text-sm text-white/50 text-center mt-6 leading-relaxed">
          Pensez à vérifier votre dossier <strong>Spams / Courriers indésirables</strong> si l'email n'apparaît pas dans la minute.
        </p>

        {/* Back / Change email */}
        <div className="mt-8 pt-5 border-t border-white/10 flex justify-center">
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-sm sm:text-base font-bold text-white/70 hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Modifier l'email ou retourner à la connexion</span>
          </button>
        </div>
      </div>
    </div>
  );
}

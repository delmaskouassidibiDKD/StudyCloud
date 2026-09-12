import React, { useState, useEffect } from 'react';
import { Mail, Clock, RefreshCw, ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
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
  const [secondsLeft, setSecondsLeft] = useState(70);
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
  const COOLDOWN_DURATION_MS = 70 * 1000; // 70 secondes entre deux demandes de renvoi

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

    // 3. Restaurer le décompteur de 70 secondes
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
      // Premier affichage : décompte initial de 70s
      const targetTime = Date.now() + COOLDOWN_DURATION_MS;
      localStorage.setItem(COOLDOWN_KEY, targetTime.toString());
      setSecondsLeft(70);
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

      // Vérifier le décompteur de 70 secondes
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

  // Polling automatique et détection instantanée (cross-device et même appareil)
  useEffect(() => {
    let isMounted = true;
    let isChecking = false;

    const checkStatus = async () => {
      if (isChecking || !email || isAutoDetected) return;
      isChecking = true;

      try {
        const res: any = await StudyCloudAPI.checkVerificationStatus(email);
        if (res && res.confirmed && res.token && res.user && isMounted) {
          setIsAutoDetected(true);
          setMessage("🎉 Confirmation validée avec succès ! Passage automatique à l'étape suivante...");

          localStorage.removeItem('sc_pending_verification_email');
          localStorage.removeItem('sc_pending_verification_is_login');

          setTimeout(() => {
            if (onEmailVerified) {
              onEmailVerified(res.token, res.user);
            } else {
              localStorage.setItem('sc_auth_token', res.token);
              localStorage.setItem('sc_user', JSON.stringify(res.user));
              window.location.reload();
            }
          }, 400);
        }
      } catch (e) {
        // Ignorer silencieusement les erreurs réseaux temporaires de polling
      } finally {
        isChecking = false;
      }
    };

    // 1. Polling régulier rapide (1 seconde)
    const pollInterval = setInterval(checkStatus, 1000);

    // 2. Détection immédiate dès que l'utilisateur revient sur l'application (quitte l'app mail et revient)
    const handleImmediateWakeUp = () => {
      try {
        const stored = localStorage.getItem('dkd_verification_status');
        if (stored) {
          const data = JSON.parse(stored);
          if (Date.now() - data.timestamp < 300000 && data.status === 'confirmed') {
            localStorage.removeItem('dkd_verification_status');
          }
        }
      } catch (e) {}
      checkStatus();
    };

    document.addEventListener('visibilitychange', handleImmediateWakeUp);
    window.addEventListener('focus', handleImmediateWakeUp);
    window.addEventListener('pageshow', handleImmediateWakeUp);

    // 3. Écoute instantanée sur le même appareil/navigateur via BroadcastChannel
    let broadcastChannel: BroadcastChannel | null = null;
    try {
      broadcastChannel = new BroadcastChannel('studycloud_email_verification');
      broadcastChannel.onmessage = (ev) => {
        if (ev.data && (ev.data.email === email || ev.data.success)) {
          checkStatus();
        }
      };
    } catch (e) {}

    // 4. Écoute des signaux de stockage standardisés (dkd_verification_status et sc_email_verified_signal)
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'dkd_verification_status' || e.key === 'sc_email_verified_signal') {
        checkStatus();
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleImmediateWakeUp);
      window.removeEventListener('focus', handleImmediateWakeUp);
      window.removeEventListener('pageshow', handleImmediateWakeUp);
      window.removeEventListener('storage', handleStorageEvent);
      if (broadcastChannel) {
        try {
          broadcastChannel.close();
        } catch (e) {}
      }
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

        // Relancer le décompte persistant de 70 secondes
        const targetTime = res.nextAllowedAt ? new Date(res.nextAllowedAt).getTime() : (Date.now() + COOLDOWN_DURATION_MS);
        localStorage.setItem(COOLDOWN_KEY, targetTime.toString());
        const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
        setSecondsLeft(remaining || 70);

        // Si bloqué (après 4 tentatives)
        if (res.isBlocked || res.blockedUntil || newCount >= 4) {
          const blockDate = res.blockedUntil || new Date(Date.now() + 3 * 3600 * 1000).toISOString();
          setBlockedUntil(blockDate);
          localStorage.setItem(BLOCKED_KEY, blockDate);
          setError('Quota atteint (4/4 tentatives). Veuillez patienter 3 heures avant de pouvoir réclamer un nouvel email.');
        } else {
          setMessage('✨ Un nouveau lien de confirmation vient de vous être envoyé par email !');
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

  // Formatage du décompte en secondes (ex: 70s)
  const formatSeconds = (sec: number) => {
    return `${sec}s`;
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
      className="fixed inset-0 z-[99998] flex flex-col items-center justify-start sm:justify-center overflow-y-auto px-4 sm:px-8 py-6 sm:py-8"
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
      <div className="relative z-10 w-full max-w-2xl lg:max-w-3xl my-auto py-2">
        {/* Top brand header with official DnaLogo */}
        <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3 notranslate select-none">
            <DnaLogo className="w-9 h-9 drop-shadow-[0_0_2px_rgba(0,0,0,1)]" glow={true} />
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
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Double Authentification (2FA)</span>
            </span>
          ) : (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-sm">
              Confirmation d'inscription
            </span>
          )}
        </div>

        {/* Big animated icon - Design distinct pour Connexion 2FA vs Inscription */}
        <div className="flex justify-center mb-5">
          {isLogin ? (
            <div className="relative">
              <div
                className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse"
                style={{
                  background: 'linear-gradient(135deg, #1E1B4B 0%, #2563EB 50%, #06B6D4 100%)',
                  boxShadow: '0 16px 45px rgba(6,182,212,0.35)',
                }}
              >
                <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-white" strokeWidth={2.2} />
              </div>
            </div>
          ) : (
            <div
              className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse"
              style={{
                background: 'linear-gradient(135deg, #EA580C 0%, #F97316 50%, #2563EB 100%)',
                boxShadow: '0 16px 45px rgba(234,88,12,0.45)',
              }}
            >
              <Mail className="w-10 h-10 sm:w-12 sm:h-12 text-white" strokeWidth={2.2} />
            </div>
          )}
        </div>

        {/* Main Heading */}
        <h2 className="text-2xl sm:text-3xl font-black text-white text-center mb-2 tracking-tight">
          {isLogin ? 'Autorisation de connexion requise 🛡️' : 'Vérifiez votre boîte email 🎓'}
        </h2>
        <p className="text-sm sm:text-base text-white/70 text-center leading-relaxed mb-4 max-w-xl mx-auto">
          {isLogin
            ? "Pour sécuriser l'accès à vos cours et protéger vos données, un lien d'autorisation à usage unique a été envoyé à :"
            : 'Un lien de confirmation sécurisé a été envoyé à votre adresse pour valider votre compte :'}
        </p>

        {/* Highlighted Email Badge */}
        <div
          className={`border rounded-2xl px-6 py-3 text-center mb-5 shadow-inner max-w-xl mx-auto ${
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

        {/* Message / Error banners */}
        {message && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-sm font-semibold flex items-center gap-3 shadow-lg">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-sm font-semibold flex items-center gap-3 shadow-lg">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Indication disponible lorsque le décompteur de 70s est terminé */}
        {!isBlocked && secondsLeft === 0 && (
          <div className="mb-5 p-4 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-200 flex items-start gap-3 shadow-lg shadow-blue-500/5">
            <Mail className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm sm:text-base text-blue-300">
                Vous n'avez pas encore reçu l'email de confirmation ?
              </p>
              <p className="text-xs sm:text-sm text-blue-200/80 leading-relaxed">
                Vérifiez vos courriers indésirables (spams) ou cliquez sur le bouton ci-dessous pour renvoyer un nouvel email sécurisé.
              </p>
            </div>
          </div>
        )}

        {/* Blocked alert banner */}
        {isBlocked ? (
          <div className="mb-5 p-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 space-y-2.5">
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
              <span>Lien actif · Renvoyer disponible dans ({formatSeconds(secondsLeft)})</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-5 h-5" />
              <span>Renvoyer l'email de confirmation</span>
            </>
          )}
        </button>

        {/* Help text */}
        <p className="text-xs sm:text-sm text-white/50 text-center mt-5 leading-relaxed">
          Pensez à vérifier votre dossier <strong>Spams / Courriers indésirables</strong> si l'email n'apparaît pas dans la minute.
        </p>

        {/* Back / Change email */}
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-center">
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

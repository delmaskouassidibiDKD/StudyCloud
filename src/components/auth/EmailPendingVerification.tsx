import React, { useState, useEffect } from 'react';
import { Mail, Clock, RefreshCw, ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles } from 'lucide-react';
import { StudyCloudAPI } from '../../services/api';
import { DnaLogo } from '../DnaLogo';

interface EmailPendingVerificationProps {
  email: string;
  isLogin?: boolean;
  onBackToLogin: () => void;
  onEmailVerified?: () => void;
}

export function EmailPendingVerification({ email, isLogin = false, onBackToLogin }: EmailPendingVerificationProps) {
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [resendCount, setResendCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const COOLDOWN_KEY = `sc_resend_target_${email.toLowerCase()}`;
  const BLOCKED_KEY = `sc_resend_blocked_${email.toLowerCase()}`;
  const COUNT_KEY = `sc_resend_count_${email.toLowerCase()}`;

  // Initialisation et restauration de l'état persistant
  useEffect(() => {
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

    // 3. Restaurer le décompteur de 30 secondes
    const savedTarget = localStorage.getItem(COOLDOWN_KEY);
    if (savedTarget) {
      const targetTime = parseInt(savedTarget, 10);
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      setSecondsLeft(remaining);
    } else {
      // Premier affichage : lancer un décompte initial de 30s
      const targetTime = Date.now() + 30000;
      localStorage.setItem(COOLDOWN_KEY, targetTime.toString());
      setSecondsLeft(30);
    }
  }, [email]);

  // Horloge de mise à jour toutes les 500ms pour garantir une précision absolue même en cas de pause
  useEffect(() => {
    const interval = setInterval(() => {
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

      // Vérifier le décompteur de 30 secondes
      const savedTarget = localStorage.getItem(COOLDOWN_KEY);
      if (savedTarget) {
        const targetTime = parseInt(savedTarget, 10);
        const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
        setSecondsLeft(remaining);
      } else {
        setSecondsLeft(0);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [email]);

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
          setError('Quota atteint (4/4 tentatives). Veuillez patienter 3 heures avant de pouvoir renvoyer un nouvel email.');
        } else {
          // Relancer le décompte persistant de 30 secondes
          const targetTime = Date.now() + 30000;
          localStorage.setItem(COOLDOWN_KEY, targetTime.toString());
          setSecondsLeft(30);
          setMessage('✨ Un nouvel email de confirmation vient de vous être envoyé !');
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

  const isBlocked = !!blockedUntil && new Date(blockedUntil).getTime() > Date.now();

  return (
    <div
      className="fixed inset-0 z-[99998] flex flex-col items-center justify-center overflow-auto py-8 px-4"
      style={{
        background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a3e 40%, #24243e 70%, #0f2027 100%)',
      }}
    >
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full opacity-15 blur-[80px] animate-pulse"
          style={{ background: 'radial-gradient(circle, #EA580C 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-10%] left-[-5%] w-[350px] h-[350px] rounded-full opacity-15 blur-[80px] animate-pulse"
          style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)', animationDelay: '2s' }}
        />
      </div>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-xl md:max-w-2xl p-6 sm:p-8 md:p-10 rounded-3xl"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Top brand header with official DnaLogo */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5 notranslate select-none">
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
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
            {isLogin ? 'Sécurité 2FA' : 'Confirmation'}
          </span>
        </div>

        {/* Big animated icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl animate-pulse"
              style={{
                background: 'linear-gradient(135deg, #EA580C 0%, #F97316 50%, #2563EB 100%)',
                boxShadow: '0 12px 36px rgba(234,88,12,0.4)',
              }}
            >
              <Mail className="w-10 h-10 text-white" strokeWidth={2.2} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[#1a1a3e] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-black text-white text-center mb-2 tracking-tight">
          {isLogin ? 'Confirmez votre connexion 🔐' : 'Vérifiez votre boîte email 🎓'}
        </h2>
        <p className="text-xs text-white/60 text-center leading-relaxed mb-5">
          {isLogin
            ? "Pour confirmer qu'il s'agit bien de vous avant d'accéder à votre compte, un lien de confirmation a été envoyé à :"
            : 'Un lien de confirmation sécurisé a été envoyé à votre adresse pour valider votre compte :'}
        </p>

        {/* Highlighted Email Badge */}
        <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-center mb-6">
          <span className="text-sm font-extrabold text-orange-400 break-all select-all font-mono">
            {email}
          </span>
        </div>

        {/* Message / Error banners */}
        {message && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Blocked alert banner */}
        {isBlocked ? (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-extrabold text-xs text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Limite de renvois atteinte (4/4 tentatives)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/80">
              Vous avez demandé 4 renvois sans confirmation. Par mesure de sécurité anti-spam, le bouton est suspendu pendant 3 heures.
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-amber-500/20 text-xs">
              <span className="font-bold text-amber-300">Temps d'attente restant :</span>
              <span className="font-mono font-black text-white bg-amber-500/30 px-2 py-0.5 rounded-lg">
                ⏳ {formatBlockedTime()}
              </span>
            </div>
          </div>
        ) : (
          /* Quota counter indicator */
          <div className="flex items-center justify-between text-[11px] text-white/50 mb-4 px-1">
            <span>Tentatives effectuées aujourd'hui :</span>
            <span className={`font-bold ${resendCount >= 3 ? 'text-amber-400' : 'text-white/80'}`}>
              {resendCount} / 4
            </span>
          </div>
        )}

        {/* Main Action Button (Resend with Countdown) */}
        <button
          type="button"
          onClick={handleResend}
          disabled={secondsLeft > 0 || isBlocked || isLoading}
          className={`w-full py-3.5 px-5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            secondsLeft > 0 || isBlocked || isLoading
              ? 'bg-white/10 text-white/40 cursor-not-allowed border border-white/10'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30 hover:scale-[1.01] active:scale-[0.99]'
          }`}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Envoi en cours...</span>
            </>
          ) : isBlocked ? (
            <>
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Bloqué pendant {formatBlockedTime()}</span>
            </>
          ) : secondsLeft > 0 ? (
            <>
              <Clock className="w-4 h-4 text-orange-400 animate-spin" style={{ animationDuration: '4s' }} />
              <span>Renvoyer l'email ({secondsLeft}s)</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Renvoyer l'email de confirmation</span>
            </>
          )}
        </button>

        {/* Help text */}
        <p className="text-[11px] text-white/40 text-center mt-5 leading-relaxed">
          Pensez à vérifier votre dossier <strong>Spams / Courriers indésirables</strong> si l'email n'apparaît pas dans les 2 minutes.
        </p>

        {/* Back / Change email */}
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-center">
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-xs font-bold text-white/60 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Modifier l'email ou retourner à la connexion</span>
          </button>
        </div>
      </div>
    </div>
  );
}

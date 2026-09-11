import React, { useState, useEffect } from 'react';
import { Mail, ShieldCheck, ArrowLeft, KeyRound, AlertTriangle, CheckCircle2, Clock, ShieldAlert, Sparkles, Send, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { StudyCloudAPI } from '../../services/api';
import { DnaLogo } from '../DnaLogo';
import { validatePasswordRules } from './AuthPage';

interface ForgotPasswordFlowProps {
  initialEmail?: string;
  onCancel: () => void;
  onCodeSent: (targetEmail: string) => void;
  onPasswordResetSuccess: () => void;
}

type Step = 'email' | 'questions' | 'target-email' | 'reset-code';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

export function ForgotPasswordFlow({
  initialEmail = '',
  onCancel,
  onCodeSent,
  onPasswordResetSuccess,
}: ForgotPasswordFlowProps) {
  const [step, setStep] = useState<Step>('email');
  const [accountEmail, setAccountEmail] = useState(initialEmail);
  const [accountEmailTouched, setAccountEmailTouched] = useState(false);
  const [targetEmail, setTargetEmail] = useState(initialEmail);
  const [targetEmailTouched, setTargetEmailTouched] = useState(false);
  const [question1, setQuestion1] = useState('Quelle est votre ville de naissance ?');
  const [question2, setQuestion2] = useState('Quel est le prénom de votre mère ?');
  const [answer1, setAnswer1] = useState('');
  const [answer2, setAnswer2] = useState('');
  const [resetSessionToken, setResetSessionToken] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [attemptsToday, setAttemptsToday] = useState(0);

  // Vérifier si un blocage est enregistré localement pour cet email
  useEffect(() => {
    if (!accountEmail) return;
    const blockKey = `sc_pw_reset_blocked_${accountEmail.toLowerCase().trim()}`;
    const savedBlockedUntil = localStorage.getItem(blockKey);
    if (savedBlockedUntil) {
      const blockedTime = new Date(savedBlockedUntil).getTime();
      if (blockedTime > Date.now()) {
        setBlockedUntil(savedBlockedUntil);
      } else {
        localStorage.removeItem(blockKey);
        setBlockedUntil(null);
      }
    }
  }, [accountEmail]);

  // Décompteur de temps pour le blocage de 24h
  const formatBlockedTime = () => {
    if (!blockedUntil) return '';
    const remainingMs = Math.max(0, new Date(blockedUntil).getTime() - Date.now());
    const hours = Math.floor(remainingMs / (3600 * 1000));
    const minutes = Math.ceil((remainingMs % (3600 * 1000)) / 60000);
    if (hours > 0) return `${hours}h ${minutes}min`;
    return `${minutes} minute(s)`;
  };

  const isBlocked = !!blockedUntil && new Date(blockedUntil).getTime() > Date.now();

  // Étape 1 : Valider l'email et récupérer les questions de sécurité
  const handleStartRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountEmail.trim()) {
      setError('Veuillez renseigner votre adresse email.');
      return;
    }
    if (!isValidEmail(accountEmail)) {
      setError("Le format de votre adresse email est invalide (ex: exemple@gmail.com).");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res: any = await StudyCloudAPI.initForgotPassword(accountEmail.trim());
      if (res.success) {
        setQuestion1(res.question1 || 'Quelle est votre ville de naissance ?');
        setQuestion2(res.question2 || 'Quel est le prénom de votre mère ?');
        setTargetEmail(res.email || accountEmail.trim());
        setAttemptsToday(res.attemptsToday || 0);
        setStep('questions');
      } else {
        if (res.isBlocked && res.blockedUntil) {
          setBlockedUntil(res.blockedUntil);
          localStorage.setItem(`sc_pw_reset_blocked_${accountEmail.toLowerCase().trim()}`, res.blockedUntil);
        }
        setError(res.error || 'Impossible de lancer la réinitialisation.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion au serveur.');
    } finally {
      setIsLoading(false);
    }
  };

  // Étape 2 : Vérifier les réponses aux questions de sécurité
  const handleVerifyAnswers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer1.trim()) {
      setError('Veuillez répondre à la question de sécurité.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res: any = await StudyCloudAPI.verifySecurityAnswers({
        email: accountEmail.trim(),
        answer1: answer1.trim(),
        answer2: answer2.trim(),
      });

      if (res.success && res.verified) {
        setResetSessionToken(res.resetSessionToken);
        setStep('target-email');
      } else {
        setError(res.error || 'Réponse(s) de sécurité incorrecte(s).');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la validation.');
    } finally {
      setIsLoading(false);
    }
  };

  // Étape 3 : Envoyer le code à l'adresse email choisie
  const handleSendCode = async () => {
    if (!targetEmail.trim()) {
      setError("Veuillez indiquer l'adresse email de réception.");
      return;
    }
    if (!isValidEmail(targetEmail)) {
      setError("Le format de l'adresse email de réception est invalide (ex: exemple@gmail.com).");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res: any = await StudyCloudAPI.sendPasswordResetCode({
        email: accountEmail.trim(),
        targetEmail: targetEmail.trim(),
        resetSessionToken,
      });

      if (res.success) {
        onCodeSent(targetEmail.trim());
      } else {
        if (res.isBlocked && res.blockedUntil) {
          setBlockedUntil(res.blockedUntil);
          localStorage.setItem(`sc_pw_reset_blocked_${accountEmail.toLowerCase().trim()}`, res.blockedUntil);
        }
        setError(res.error || "Échec lors de l'envoi du code.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'envoi.");
    } finally {
      setIsLoading(false);
    }
  };

  // Étape 4 (optionnelle) : Saisir le code et changer le mot de passe
  const handleFinalReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim() || !newPassword.trim()) {
      setError('Code et nouveau mot de passe requis.');
      return;
    }
    const pwdRules = validatePasswordRules(newPassword);
    if (!pwdRules.isValid) {
      setError(pwdRules.message || 'Le mot de passe doit comporter au moins 6 caractères et contenir des lettres, des chiffres et des caractères spéciaux (ex: @, #, $, !, etc.).');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res: any = await StudyCloudAPI.resetPassword({
        email: accountEmail.trim(),
        code: resetCode.trim(),
        newPassword,
      });

      if (res.success) {
        onPasswordResetSuccess();
      } else {
        setError(res.error || 'Code invalide ou expiré.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la réinitialisation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99998] overflow-y-auto overflow-x-hidden"
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

      <div className="min-h-full w-full flex flex-col items-center justify-start py-8 sm:py-12 px-4">
        {/* Card */}
        <div
          className="relative z-10 w-full max-w-2xl md:max-w-3xl lg:max-w-4xl p-6 sm:p-8 md:p-10 rounded-3xl my-auto"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Brand Header with DnaLogo */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
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
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
            <KeyRound className="w-3 h-3" />
            Récupération
          </span>
        </div>

        {/* Blocage Quota 24h Banner */}
        {isBlocked && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-extrabold text-xs text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Quota de réclamations atteint (4/4 par jour)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-200/80">
              Par mesure de protection de votre compte, vous devez attendre 24 heures avant de formuler une nouvelle demande de réinitialisation.
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-amber-500/20 text-xs">
              <span className="font-bold text-amber-300">Temps d'attente restant :</span>
              <span className="font-mono font-black text-white bg-amber-500/30 px-2 py-0.5 rounded-lg">
                ⏳ {formatBlockedTime()}
              </span>
            </div>
          </div>
        )}

        {/* ── STEP 1 : EMAIL DE RÉCUPÉRATION ── */}
        {step === 'email' && (
          <div>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mx-auto mb-3 text-orange-400 shadow-lg shadow-orange-500/20">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-white">Mot de passe oublié</h2>
              <p className="text-xs text-white/50 mt-1">
                Indiquez l'adresse email de votre compte pour répondre à vos questions de sécurité.
              </p>
            </div>

            <form onSubmit={handleStartRecovery} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-white/60 block">
                    Adresse email du compte *
                  </label>
                  {accountEmail.trim().length > 0 && isValidEmail(accountEmail) && (
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Format valide
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                    accountEmail.trim().length > 0 && !isValidEmail(accountEmail) && (accountEmail.includes('@') || accountEmailTouched)
                      ? 'text-red-400'
                      : accountEmail.trim().length > 0 && isValidEmail(accountEmail)
                      ? 'text-emerald-400'
                      : 'text-white/30'
                  }`} />
                  <input
                    type="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    onBlur={() => setAccountEmailTouched(true)}
                    placeholder="exemple@gmail.com"
                    required
                    disabled={isBlocked || isLoading}
                    className={`w-full pl-10 pr-10 py-3 rounded-xl text-sm font-medium text-white placeholder-white/30 outline-none transition-all bg-white/10 ${
                      accountEmail.trim().length > 0 && !isValidEmail(accountEmail) && (accountEmail.includes('@') || accountEmailTouched)
                        ? 'border-2 border-red-500/70 focus:ring-2 focus:ring-red-500/50'
                        : accountEmail.trim().length > 0 && isValidEmail(accountEmail)
                        ? 'border-2 border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/50'
                        : 'border border-white/15 focus:ring-2 focus:ring-orange-500/50'
                    }`}
                  />
                  {accountEmail.trim().length > 0 && isValidEmail(accountEmail) && (
                    <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  )}
                  {accountEmail.trim().length > 0 && !isValidEmail(accountEmail) && (accountEmail.includes('@') || accountEmailTouched) && (
                    <AlertTriangle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                  )}
                </div>
                {accountEmail.trim().length > 0 && !isValidEmail(accountEmail) && (accountEmail.includes('@') || accountEmailTouched) && (
                  <p className="text-[11px] text-red-400 font-medium mt-1.5 flex items-center gap-1">
                    <span>Format invalide (doit respecter ex: nom@gmail.com)</span>
                  </p>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-xl flex items-start gap-2 bg-red-500/20 border border-red-500/30 text-red-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isBlocked || isLoading}
                className="w-full py-3.5 px-5 rounded-2xl font-extrabold text-white text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Vérification...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Vérifier mes questions secrètes</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={onCancel}
                className="text-white/60 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour à la connexion</span>
              </button>

              <button
                type="button"
                onClick={() => setStep('reset-code')}
                className="text-orange-400 hover:text-orange-300 font-semibold transition-colors cursor-pointer"
              >
                J'ai déjà un code →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 : QUESTIONS DE SÉCURITÉ ── */}
        {step === 'questions' && (
          <div>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-2.5 text-blue-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-white">Vérification de sécurité</h2>
              <p className="text-xs text-white/50 mt-1">
                Répondez à vos questions secrètes pour prouver que vous êtes bien le propriétaire :
              </p>
            </div>

            <form onSubmit={handleVerifyAnswers} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Question 1 */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <label className="text-xs font-bold text-orange-400 mb-2 block">
                    Question 1 : {question1}
                  </label>
                  <input
                    type="text"
                    value={answer1}
                    onChange={(e) => setAnswer1(e.target.value)}
                    placeholder="Votre réponse secrète *"
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all bg-white/10 border border-white/15"
                  />
                </div>

                {/* Question 2 */}
                {question2 && (
                  <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                    <label className="text-xs font-bold text-orange-400 mb-2 block">
                      Question 2 : {question2}
                    </label>
                    <input
                      type="text"
                      value={answer2}
                      onChange={(e) => setAnswer2(e.target.value)}
                      placeholder="Votre réponse secrète *"
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all bg-white/10 border border-white/15"
                    />
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-xl flex items-start gap-2 bg-red-500/20 border border-red-500/30 text-red-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-5 rounded-2xl font-extrabold text-white text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Validation en cours...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Valider mes réponses</span>
                  </>
                )}
              </button>

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Changer d'email</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 3 : CHOIX DE L'EMAIL DE RÉCEPTION + ENVOYER / ANNULER ── */}
        {step === 'target-email' && (
          <div>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2.5 text-emerald-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-white">Identité confirmée !</h2>
              <p className="text-xs text-white/50 mt-1">
                Vos réponses sont correctes. Indiquez l'adresse email où recevoir votre code de réinitialisation :
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-white/60 block">
                    Email qui recevra le mot de passe oublié *
                  </label>
                  {targetEmail.trim().length > 0 && isValidEmail(targetEmail) && (
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Format valide
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                    targetEmail.trim().length > 0 && !isValidEmail(targetEmail) && (targetEmail.includes('@') || targetEmailTouched)
                      ? 'text-red-400'
                      : targetEmail.trim().length > 0 && isValidEmail(targetEmail)
                      ? 'text-emerald-400'
                      : 'text-white/30'
                  }`} />
                  <input
                    type="email"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    onBlur={() => setTargetEmailTouched(true)}
                    placeholder="exemple@gmail.com"
                    required
                    autoFocus
                    className={`w-full pl-10 pr-10 py-3 rounded-xl text-sm font-medium text-white placeholder-white/30 outline-none transition-all bg-white/10 ${
                      targetEmail.trim().length > 0 && !isValidEmail(targetEmail) && (targetEmail.includes('@') || targetEmailTouched)
                        ? 'border-2 border-red-500/70 focus:ring-2 focus:ring-red-500/50'
                        : targetEmail.trim().length > 0 && isValidEmail(targetEmail)
                        ? 'border-2 border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/50'
                        : 'border border-white/15 focus:ring-2 focus:ring-orange-500/50'
                    }`}
                  />
                  {targetEmail.trim().length > 0 && isValidEmail(targetEmail) && (
                    <CheckCircle2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                  )}
                  {targetEmail.trim().length > 0 && !isValidEmail(targetEmail) && (targetEmail.includes('@') || targetEmailTouched) && (
                    <AlertTriangle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                  )}
                </div>
                {targetEmail.trim().length > 0 && !isValidEmail(targetEmail) && (targetEmail.includes('@') || targetEmailTouched) && (
                  <p className="text-[11px] text-red-400 font-medium mt-1.5 flex items-center gap-1">
                    <span>Format invalide (doit respecter ex: nom@gmail.com)</span>
                  </p>
                )}
              </div>

              {/* Indicateur de quota (4 réclamations / jour) */}
              <div className="flex items-center justify-between text-[11px] text-white/50 px-1">
                <span>Réclamations effectuées aujourd'hui :</span>
                <span className="font-bold text-orange-400">{attemptsToday} / 4</span>
              </div>

              {error && (
                <div className="p-3 rounded-xl flex items-start gap-2 bg-red-500/20 border border-red-500/30 text-red-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Boutons Envoyer & Annuler */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="py-3.5 px-4 rounded-2xl font-bold text-xs text-white/80 bg-white/10 hover:bg-white/15 border border-white/15 transition-all text-center cursor-pointer disabled:opacity-50"
                >
                  Annuler
                </button>

                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={isLoading || isBlocked}
                  className="py-3.5 px-4 rounded-2xl font-extrabold text-xs text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Envoi...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Envoyer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4 : SAISIE DU CODE ET NOUVEAU MOT DE PASSE ── */}
        {step === 'reset-code' && (
          <div>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mx-auto mb-2.5 text-orange-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-white">Nouveau mot de passe</h2>
              <p className="text-xs text-white/50 mt-1">
                Saisissez le code à 6 chiffres reçu par email et votre nouveau mot de passe :
              </p>
            </div>

            <form onSubmit={handleFinalReset} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-white/60 mb-1.5 block">
                  Adresse email du compte
                </label>
                <input
                  type="email"
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 bg-white/10 border border-white/15"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-white/60 mb-1.5 block">
                    Code à 6 chiffres
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Ex : 482910"
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-xl text-center text-lg font-mono font-black tracking-widest text-orange-400 placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 bg-white/10 border border-white/15"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/60 mb-1.5 block">
                    Nouveau mot de passe (min. 6 car.)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full px-4 pr-10 py-3 rounded-xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 bg-white/10 border border-white/15"
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Exigences de sécurité du mot de passe */}
                  <div className="mt-2 p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                    <p className="text-[11px] font-bold text-white/60">Le mot de passe doit comporter :</p>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <span className={`flex items-center gap-1 font-medium ${newPassword.length >= 6 ? 'text-emerald-400' : 'text-white/40'}`}>
                        <span>{newPassword.length >= 6 ? '✓' : '○'}</span>
                        <span>Min. 6 caractères</span>
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${/[a-zA-Z]/.test(newPassword) ? 'text-emerald-400' : 'text-white/40'}`}>
                        <span>{/[a-zA-Z]/.test(newPassword) ? '✓' : '○'}</span>
                        <span>Des lettres (a-z)</span>
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${/[0-9]/.test(newPassword) ? 'text-emerald-400' : 'text-white/40'}`}>
                        <span>{/[0-9]/.test(newPassword) ? '✓' : '○'}</span>
                        <span>Des chiffres (0-9)</span>
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${/[^a-zA-Z0-9]/.test(newPassword) ? 'text-emerald-400' : 'text-white/40'}`}>
                        <span>{/[^a-zA-Z0-9]/.test(newPassword) ? '✓' : '○'}</span>
                        <span>Caractère spécial (@, #, !, ...)</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl flex items-start gap-2 bg-red-500/20 border border-red-500/30 text-red-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-5 rounded-2xl font-extrabold text-white text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mise à jour...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enregistrer mon nouveau mot de passe</span>
                  </>
                )}
              </button>

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Annuler et retourner à la connexion</span>
                </button>
              </div>
            </form>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

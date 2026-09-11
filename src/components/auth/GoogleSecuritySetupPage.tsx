import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StudyCloudAPI } from '../../services/api';
import { DnaLogo } from '../DnaLogo';
import {
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { validatePasswordRules } from './AuthPage';

export function GoogleSecuritySetupPage() {
  const { user, token, updateProfile } = useAuth();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Questions de sécurité personnelles
  const [securityQuestion1, setSecurityQuestion1] = useState(
    user?.security_question_1 || 'Quelle est votre ville de naissance ?'
  );
  const [securityAnswer1, setSecurityAnswer1] = useState('');

  const [securityQuestion2, setSecurityQuestion2] = useState(
    user?.security_question_2 || 'Quel est le prénom de votre mère ?'
  );
  const [securityAnswer2, setSecurityAnswer2] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Session invalide. Veuillez vous reconnecter.');
      return;
    }

    const pwdRules = validatePasswordRules(password);
    if (!pwdRules.isValid) {
      setError(
        pwdRules.message ||
          'Le mot de passe doit comporter au moins 6 caractères et contenir des lettres, des chiffres et des caractères spéciaux (ex: @, #, $, !, etc.).'
      );
      return;
    }

    if (!securityAnswer1.trim()) {
      setError('Veuillez renseigner la réponse à la première question de sécurité.');
      return;
    }

    if (!securityAnswer2.trim()) {
      setError('Veuillez renseigner la réponse à la deuxième question de sécurité.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await StudyCloudAPI.setupSecurity(token, {
        password,
        securityQuestion1,
        securityAnswer1: securityAnswer1.trim(),
        securityQuestion2,
        securityAnswer2: securityAnswer2.trim(),
      });

      if (res.success && res.user) {
        updateProfile(res.user);
      } else {
        setError(res.message || 'Une erreur est survenue lors de la configuration.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-dvh h-dvh w-full flex flex-col justify-center items-center px-6 sm:px-12 md:px-16 py-6 text-white relative overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, #0b091f 0%, #151030 50%, #0d1326 100%)',
      }}
    >
      {/* Halos lumineux subtils en arrière-plan */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-orange-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[700px] h-[700px] bg-blue-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Contenu principal généreusement dimensionné directement sur le fond */}
      <div className="w-full max-w-5xl flex flex-col justify-center z-10 my-auto">
        {/* En-tête de la marque et titre */}
        <div className="mb-6">
          <div className="flex items-center gap-3.5 mb-2.5">
            <DnaLogo className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-[0_0_14px_rgba(234,88,12,0.6)] shrink-0" glow={true} />
            <span className="font-black text-2xl sm:text-3xl tracking-tight">
              <span className="text-orange-500">Study</span>
              <span className="text-blue-500">Cloud</span>
            </span>
            <span className="text-xs sm:text-sm px-3.5 py-1 rounded-full font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">
              Sécurité obligatoire
            </span>
            {user?.email && (
              <span className="text-sm sm:text-base text-white/60 ml-auto truncate max-w-[360px] hidden sm:inline font-medium">
                {user.email}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
            Sécurisez votre compte Google
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-white/70 mt-1.5 leading-relaxed">
            Définissez votre mot de passe et vos 2 questions secrètes pour récupérer votre espace à tout moment.
          </p>
        </div>

        {/* Message d'erreur si présent */}
        {error && (
          <div className="mb-4 px-5 py-3 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center gap-3 text-red-200 text-sm sm:text-base animate-shake">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span className="leading-tight">{error}</span>
          </div>
        )}

        {/* Formulaire fluide, large et confortable */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section Mot de passe */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm sm:text-base md:text-lg font-bold text-white/90 flex items-center gap-2.5">
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400" />
                <span>Nouveau mot de passe *</span>
              </label>
              <span className="text-xs sm:text-sm text-white/50">Utilisable pour vous reconnecter</span>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Entrez votre mot de passe"
                className="w-full pl-5 pr-14 py-3.5 sm:py-4 rounded-2xl text-base sm:text-lg font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/60 transition-all bg-white/[0.06] border border-white/15"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                data-form-type="other"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                title={showPassword ? 'Masquer' : 'Afficher'}
              >
                {showPassword ? <EyeOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Eye className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            </div>

            {/* Critères du mot de passe en 4 capsules horizontales bien visibles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-3">
              <div className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                password.length >= 6 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/5'
              }`}>
                <span>{password.length >= 6 ? '✓' : '○'}</span>
                <span>Min. 6 car.</span>
              </div>
              <div className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                /[a-zA-Z]/.test(password) ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/5'
              }`}>
                <span>{/[a-zA-Z]/.test(password) ? '✓' : '○'}</span>
                <span>Des lettres</span>
              </div>
              <div className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                /[0-9]/.test(password) ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/5'
              }`}>
                <span>{/[0-9]/.test(password) ? '✓' : '○'}</span>
                <span>Des chiffres</span>
              </div>
              <div className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                /[^a-zA-Z0-9]/.test(password) ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/5'
              }`}>
                <span>{/[^a-zA-Z0-9]/.test(password) ? '✓' : '○'}</span>
                <span>Spécial (@, #, !)</span>
              </div>
            </div>
          </div>

          {/* Section Questions secrètes de récupération (2 colonnes spacieuses) */}
          <div className="pt-2">
            <div className="flex items-center gap-2 text-sm sm:text-base md:text-lg font-bold text-orange-400 mb-3">
              <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Questions secrètes de récupération de compte</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
              {/* Question 1 */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm md:text-base font-bold text-white/80 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-orange-400" />
                  <span>Question 1 *</span>
                </label>
                <select
                  value={securityQuestion1}
                  onChange={(e) => setSecurityQuestion1(e.target.value)}
                  className="w-full px-4 py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm md:text-base font-medium text-white bg-slate-900/95 border border-white/15 outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer truncate"
                >
                  <option value="Quelle est votre ville de naissance ?">Quelle est votre ville de naissance ?</option>
                  <option value="Quel est le nom de votre premier animal de compagnie ?">Quel est le nom de votre premier animal de compagnie ?</option>
                  <option value="Quel est votre plat ivoirien préféré ?">Quel est votre plat ivoirien préféré ?</option>
                  <option value="Quel est le prénom de votre meilleur(e) ami(e) d'enfance ?">Quel est le prénom de votre meilleur(e) ami(e) d'enfance ?</option>
                </select>
                <input
                  type="text"
                  value={securityAnswer1}
                  onChange={(e) => setSecurityAnswer1(e.target.value)}
                  placeholder="Votre réponse secrète 1 *"
                  required
                  className="w-full px-4 py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm md:text-base font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/60 bg-white/[0.06] border border-white/15"
                />
              </div>

              {/* Question 2 */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm md:text-base font-bold text-white/80 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-orange-400" />
                  <span>Question 2 *</span>
                </label>
                <select
                  value={securityQuestion2}
                  onChange={(e) => setSecurityQuestion2(e.target.value)}
                  className="w-full px-4 py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm md:text-base font-medium text-white bg-slate-900/95 border border-white/15 outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer truncate"
                >
                  <option value="Quel est le prénom de votre mère ?">Quel est le prénom de votre mère ?</option>
                  <option value="Quel était votre surnom à l'école ?">Quel était votre surnom à l'école ?</option>
                  <option value="Dans quelle commune avez-vous grandi ?">Dans quelle commune avez-vous grandi ?</option>
                  <option value="Quel est le nom de votre école primaire ?">Quel est le nom de votre école primaire ?</option>
                </select>
                <input
                  type="text"
                  value={securityAnswer2}
                  onChange={(e) => setSecurityAnswer2(e.target.value)}
                  placeholder="Votre réponse secrète 2 *"
                  required
                  className="w-full px-4 py-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm md:text-base font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/60 bg-white/[0.06] border border-white/15"
                />
              </div>
            </div>
          </div>

          {/* Bouton Continuer */}
          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-base sm:text-lg tracking-wide text-white transition-all shadow-xl flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
                boxShadow: '0 8px 24px rgba(234, 88, 12, 0.45)',
              }}
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <span>Appliquer et continuer</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

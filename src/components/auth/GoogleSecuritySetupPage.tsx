import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StudyCloudAPI } from '../../services/api';
import { DnaLogo } from '../DnaLogo';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  User,
  HelpCircle,
  KeyRound,
  ArrowRight,
  LogOut,
  AlertCircle,
  Sparkles,
  Building2,
  GraduationCap
} from 'lucide-react';
import { validatePasswordRules } from './AuthPage';

export function GoogleSecuritySetupPage() {
  const { user, token, updateProfile, logout } = useAuth();

  const [name, setName] = useState(user?.name || '');
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

    if (!name.trim()) {
      setError('Veuillez renseigner votre nom complet.');
      return;
    }

    const pwdRules = validatePasswordRules(password);
    if (!pwdRules.isValid) {
      setError(pwdRules.message || 'Le mot de passe doit comporter au moins 6 caractères et contenir des lettres, des chiffres et des caractères spéciaux (ex: @, #, $, !, etc.).');
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
        name: name.trim(),
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
      className="min-h-dvh flex flex-col justify-between text-white relative overflow-x-hidden"
      style={{
        background: 'linear-gradient(135deg, #0b091f 0%, #151030 50%, #0d1326 100%)',
      }}
    >
      {/* Halo lumineux de fond */}
      <div className="absolute top-0 left-1/4 w-[700px] h-[700px] bg-orange-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-white/10 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #ff7a18, #af002d 100%)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            <DnaLogo className="w-6 h-6 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" glow={true} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black tracking-wider text-base text-white">StudyCloud</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                Sécurité
              </span>
            </div>
            <p className="text-[11px] text-white/50 hidden sm:block">
              Plateforme cloud pour étudiants, élèves, professionnels & entreprises
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs font-semibold text-white/60 hover:text-white px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
          title="Changer de compte ou se déconnecter"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Changer de compte</span>
        </button>
      </header>

      {/* Main Content: Spacieux sur grand écran (max-w-4xl) */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 z-10">
        <div className="w-full max-w-4xl">
          {/* Card principale avec effet glassmorphism */}
          <div
            className="rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl border backdrop-blur-xl relative overflow-hidden"
            style={{
              background: 'rgba(23, 21, 48, 0.75)',
              borderColor: 'rgba(255, 255, 255, 0.12)',
            }}
          >
            {/* Header info badge */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30 mb-3">
                <ShieldCheck className="w-4 h-4" />
                <span>Configuration de sécurité obligatoire</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                Sécurisez votre compte Google
              </h1>
              <p className="text-sm sm:text-base text-white/70 mt-2 max-w-2xl leading-relaxed">
                Vous avez créé votre compte automatiquement via Google. Afin de garantir un accès permanent et permettre la récupération de vos documents classés en toute circonstance, veuillez définir votre mot de passe et vos 2 questions secrètes.
              </p>

              {/* Compte Google lié */}
              {user?.email && (
                <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/80">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Compte connecté :</span>
                  <span className="font-semibold text-white">{user.email}</span>
                </div>
              )}
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-start gap-3 text-red-200 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
                <div>
                  <span className="font-bold">Attention : </span>
                  {error}
                </div>
              </div>
            )}

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Ligne 1: Nom complet & Mot de passe en 2 colonnes sur desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Nom complet */}
                <div>
                  <label className="text-xs sm:text-sm font-bold text-white/80 mb-2 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-orange-400" />
                    <span>Nom complet *</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Jean Dupont"
                    required
                    className="w-full px-4 py-3.5 rounded-2xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/60 transition-all"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
                  />
                  <p className="text-[11px] text-white/40 mt-1.5">
                    Nom associé à vos dossiers et documents partagés.
                  </p>
                </div>

                {/* Mot de passe */}
                <div>
                  <label className="text-xs sm:text-sm font-bold text-white/80 mb-2 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-orange-400" />
                    <span>Nouveau mot de passe *</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full pl-4 pr-12 py-3.5 rounded-2xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/60 transition-all"
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}
                      autoComplete="off"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                      title={showPassword ? 'Masquer' : 'Afficher'}
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

                  <p className="text-[11px] text-white/40 mt-1.5">
                    Vous permettra de vous connecter aussi avec votre adresse email.
                  </p>
                </div>
              </div>

              {/* Section questions de sécurité: Présentation claire en 2 colonnes sur tablette/desktop */}
              <div className="pt-5 border-t border-white/10 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-orange-400">
                  <KeyRound className="w-4 h-4" />
                  <span>Questions secrètes de récupération de compte</span>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">
                  Ces informations personnelles permettent de réclamer et réinitialiser votre mot de passe à tout moment si vous perdez vos accès.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Question 1 */}
                  <div
                    className="p-4 rounded-2xl border space-y-3"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-white/90">
                      <HelpCircle className="w-4 h-4 text-orange-400" />
                      <span>Question de sécurité 1 *</span>
                    </div>
                    <select
                      value={securityQuestion1}
                      onChange={(e) => setSecurityQuestion1(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl text-xs sm:text-sm font-medium text-white bg-slate-900 border border-white/20 outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer"
                    >
                      <option value="Quelle est votre ville de naissance ?">Quelle est votre ville de naissance ?</option>
                      <option value="Quel est le nom de votre premier animal de compagnie ?">Quel est le nom de votre premier animal de compagnie ?</option>
                      <option value="Quel est votre plat ivoirien préféré ?">Quel est votre plat ivoirien préféré ?</option>
                      <option value="Quel est le prénom de votre meilleur(e) ami(e) d'enfance ?">Quel est le prénom de votre meilleur(e) ami(e) d'enfance ?</option>
                    </select>
                    <div>
                      <label className="text-[11px] font-bold text-white/60 mb-1 block">Votre réponse secrète 1 *</label>
                      <input
                        type="text"
                        value={securityAnswer1}
                        onChange={(e) => setSecurityAnswer1(e.target.value)}
                        placeholder="Ex: Abidjan, Bouaké, Rex..."
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/60"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                      />
                    </div>
                  </div>

                  {/* Question 2 */}
                  <div
                    className="p-4 rounded-2xl border space-y-3"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold text-white/90">
                      <HelpCircle className="w-4 h-4 text-orange-400" />
                      <span>Question de sécurité 2 *</span>
                    </div>
                    <select
                      value={securityQuestion2}
                      onChange={(e) => setSecurityQuestion2(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-xl text-xs sm:text-sm font-medium text-white bg-slate-900 border border-white/20 outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer"
                    >
                      <option value="Quel est le prénom de votre mère ?">Quel est le prénom de votre mère ?</option>
                      <option value="Quel était votre surnom à l'école ?">Quel était votre surnom à l'école ?</option>
                      <option value="Dans quelle commune avez-vous grandi ?">Dans quelle commune avez-vous grandi ?</option>
                      <option value="Quel est le nom de votre école primaire ?">Quel est le nom de votre école primaire ?</option>
                    </select>
                    <div>
                      <label className="text-[11px] font-bold text-white/60 mb-1 block">Votre réponse secrète 2 *</label>
                      <input
                        type="text"
                        value={securityAnswer2}
                        onChange={(e) => setSecurityAnswer2(e.target.value)}
                        placeholder="Ex: Marie, Yopougon, Petit..."
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/60"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bouton d'application obligatoire */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-white/50 flex items-center gap-2 text-center sm:text-left">
                  <Sparkles className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <span>Tous les champs sont requis avant d'accéder à l'espace de travail.</span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-sm tracking-wide text-white transition-all shadow-xl flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
                    boxShadow: '0 8px 25px rgba(234, 88, 12, 0.4)',
                  }}
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Application en cours...</span>
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
      </main>

      {/* Footer Branding : Mention étudiants, élèves, professionnels & entreprises */}
      <footer className="w-full py-4 px-6 text-center text-xs text-white/40 border-t border-white/5 backdrop-blur-sm z-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-orange-400/80" />
            <span>Étudiants & Élèves</span>
            <span>•</span>
            <Building2 className="w-4 h-4 text-blue-400/80" />
            <span>Professionnels & Entreprises</span>
          </div>
          <p>© {new Date().getFullYear()} StudyCloud — Stockage sécurisé de documents et dossiers numériques</p>
        </div>
      </footer>
    </div>
  );
}

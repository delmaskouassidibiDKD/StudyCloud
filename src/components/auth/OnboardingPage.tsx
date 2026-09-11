import React, { useState } from 'react';
import {
  GraduationCap,
  Briefcase,
  Building2,
  Globe,
  User,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Phone,
  FileText,
  Camera,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { StudyCloudAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DnaLogo } from '../DnaLogo';
import studentLogo from '../../assets/student-logo.jpg';
import proLogo from '../../assets/pro-logo.jpg';

const COUNTRIES = [
  "Côte d'Ivoire", 'Sénégal', 'Mali', 'Burkina Faso', 'Guinée', 'Cameroun',
  'Gabon', 'Congo', "République démocratique du Congo", 'Madagascar', 'Bénin',
  'Togo', 'Niger', 'Tchad', 'Mauritanie', 'Maroc', 'Algérie', 'Tunisie',
  'France', 'Belgique', 'Canada', 'Autre',
];

const LEVELS = [
  'Lycée / Terminale', 'BTS 1', 'BTS 2', 'Licence 1', 'Licence 2', 'Licence 3',
  'Master 1', 'Master 2', 'Doctorat', 'Formation professionnelle', 'Autre',
];

export function OnboardingPage() {
  const { user, token, updateProfile } = useAuth();

  // Étape 1 : Question "Êtes-vous étudiant ?" (profiling)
  // Étape 2 : Coordonnées principales (Nom, Pays, Téléphone, etc.)
  // Étape 3 : Parcours académique (UNIQUEMENT si étudiant)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isStudent, setIsStudent] = useState<boolean | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Champs généraux (communs à tous)
  const [name, setName] = useState(user?.name || '');
  const [country, setCountry] = useState(user?.country || "Côte d'Ivoire");
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [bio, setBio] = useState(user?.bio || '');

  // Champ spécifique non-étudiant
  const [profession, setProfession] = useState('');

  // Champs spécifiques étudiant
  const [school, setSchool] = useState(user?.school || '');
  const [filiere, setFiliere] = useState(user?.filiere || '');
  const [level, setLevel] = useState(user?.level || '');

  // Passage de l'Étape 1 (Choix du profil) vers l'Étape 2
  const handleProceedFromStep1 = () => {
    setError(null);
    if (isStudent === null) {
      setError('Veuillez indiquer si vous êtes étudiant ou non pour continuer.');
      return;
    }
    setStep(2);
  };

  // Validation de l'Étape 2
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Le nom complet est obligatoire.');
      return;
    }
    if (!country) {
      setError('Le pays est obligatoire.');
      return;
    }

    if (isStudent) {
      // Pour les étudiants, on passe à l'étape 3 (informations scolaires)
      setStep(3);
    } else {
      // Pour les non-étudiants, on soumet directement le formulaire (questions importantes seulement)
      finalizeOnboarding(false);
    }
  };

  // Validation et soumission finale de l'Étape 3 (Étudiant)
  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!school.trim()) {
      setError("Le nom de l'école ou de l'université est obligatoire.");
      return;
    }
    if (!filiere.trim()) {
      setError('La filière ou spécialité est obligatoire.');
      return;
    }
    finalizeOnboarding(true);
  };

  // Envoi final des données à l'API et mise à jour locale
  const finalizeOnboarding = async (studentStatus: boolean) => {
    setIsLoading(true);
    setError(null);

    const finalSchool = studentStatus
      ? school.trim()
      : (profession.trim() || 'Particulier / Professionnel');

    const finalFiliere = studentStatus
      ? filiere.trim()
      : (profession.trim() || 'Général');

    const finalLevel = studentStatus
      ? (level || 'Non spécifié')
      : 'Professionnel';

    try {
      const res: any = await StudyCloudAPI.completeOnboarding(token!, {
        name: name.trim(),
        school: finalSchool,
        filiere: finalFiliere,
        level: finalLevel,
        country,
        phone: phone.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
        is_student: studentStatus ? 1 : 0,
        profession: !studentStatus ? profession.trim() : undefined,
      });

      if (res.success && res.data) {
        // Enregistrement dans le stockage local
        localStorage.setItem('unifolder_is_student', studentStatus ? 'true' : 'false');
        localStorage.setItem('unifolder_user_name', res.data.name || name.trim());
        localStorage.setItem('unifolder_user_country', res.data.country || country);
        localStorage.setItem('unifolder_user_school', res.data.school || finalSchool);
        localStorage.setItem('unifolder_user_filiere', res.data.filiere || finalFiliere);
        if (phone.trim()) localStorage.setItem('unifolder_user_phone', phone.trim());
        if (!studentStatus && profession.trim()) {
          localStorage.setItem('unifolder_user_profession', profession.trim());
        }

        updateProfile({
          ...res.data,
          is_student: studentStatus ? 1 : 0,
        });
      } else {
        setError(res.error || "Une erreur est survenue lors de l'enregistrement de votre profil.");
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de contacter le serveur StudyCloud.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = `w-full px-4 py-3 rounded-xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all`;
  const inputStyle = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' };

  // Calcul du pourcentage de progression
  const getProgressPercentage = () => {
    if (step === 1) return 33;
    if (isStudent) {
      return step === 2 ? 66 : 100;
    } else {
      return 100;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99997] flex flex-col items-center justify-start sm:justify-center overflow-y-auto py-8 sm:py-12 px-4"
      style={{ background: 'linear-gradient(135deg, #0b091e 0%, #151433 35%, #1e1b4b 70%, #0d1b2a 100%)' }}
    >
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-10%] left-[20%] w-[450px] h-[450px] rounded-full opacity-15 blur-[90px] animate-pulse"
          style={{ background: 'radial-gradient(circle, #10B981 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-5%] right-[10%] w-[400px] h-[400px] rounded-full opacity-15 blur-[90px]"
          style={{ background: 'radial-gradient(circle, #EA580C 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl md:max-w-3xl transition-all duration-300 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <DnaLogo className="w-9 h-9 drop-shadow-[0_0_8px_rgba(234,88,12,0.6)] shrink-0" glow={true} />
            <div>
              <div className="flex items-center gap-1.5 notranslate leading-none mb-1">
                <span className="text-lg font-black tracking-tight">
                  <span className="text-orange-500">Study</span>
                  <span className="text-blue-400">Cloud</span>
                </span>
              </div>
              <h2 className="text-sm font-black text-white leading-tight">
                {step === 1 && 'Configuration de votre profil'}
                {step === 2 && (isStudent ? 'Votre identité & coordonnées' : 'Informations importantes de votre compte')}
                {step === 3 && 'Votre établissement & études'}
              </h2>
              <p className="text-[11px] text-white/50 font-medium">
                {step === 1 && 'Étape 1 sur ' + (isStudent === false ? '2' : '3') + ' · Identification du profil'}
                {step === 2 && (isStudent ? 'Étape 2 sur 3 · Coordonnées personnelles' : 'Étape 2 sur 2 · Finalisation du compte')}
                {step === 3 && 'Étape 3 sur 3 · Cursus académique'}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-white/70">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Compte sécurisé</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full mb-7" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{
              width: `${getProgressPercentage()}%`,
              background: 'linear-gradient(90deg, #EA580C, #10B981)',
              boxShadow: '0 0 12px rgba(234,88,12,0.5)',
            }}
          />
        </div>

        {/* Message d'erreur global */}
        {error && (
          <div
            className="mb-5 p-3.5 rounded-2xl flex items-start gap-3 animate-shake"
            style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)' }}
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 font-medium leading-relaxed">{error}</p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════════
            ÉTAPE 1 : QUESTION MAÎTRESSE : "Êtes-vous étudiant ?"
            ════════════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center sm:text-left">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-2.5">
                Question essentielle
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Êtes-vous actuellement étudiant ?
              </h3>
              <p className="text-xs sm:text-sm text-white/60 mt-1.5 font-medium leading-relaxed max-w-xl">
                Afin de vous proposer des services et une expérience parfaitement adaptés à vos besoins.
              </p>
            </div>

            {/* 2 Grandes Cartes de Choix Interactives */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Option 1 : OUI, JE SUIS ÉTUDIANT */}
              <div
                id="onboard-choice-student"
                onClick={() => {
                  setIsStudent(true);
                  setError(null);
                }}
                className={`relative p-5 sm:p-6 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                  isStudent === true
                    ? 'ring-2 ring-emerald-400 bg-emerald-500/15 scale-[1.02] shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] hover:scale-[1.01] border border-white/10'
                }`}
                style={{ backdropFilter: 'blur(16px)' }}
              >
                {/* Check badge si sélectionné */}
                {isStudent === true && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}

                <div>
                  <div className="w-14 h-14 rounded-2xl bg-white border-2 border-emerald-400/80 flex items-center justify-center mb-4 p-1.5 shadow-[0_0_20px_rgba(16,185,129,0.35)] overflow-hidden">
                    <img src={studentLogo} alt="Profil étudiant" className="w-full h-full object-contain" />
                  </div>

                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 block mb-1">
                    Profil académique
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-white mb-2">
                    Oui, je suis étudiant
                  </h4>
                  <p className="text-xs text-white/60 font-medium leading-relaxed">
                    Vous êtes au lycée, à l'université, en BTS, en école supérieure ou en préparation de concours.
                  </p>
                </div>
              </div>

              {/* Option 2 : NON, JE NE SUIS PAS ÉTUDIANT */}
              <div
                id="onboard-choice-non-student"
                onClick={() => {
                  setIsStudent(false);
                  setError(null);
                }}
                className={`relative p-5 sm:p-6 rounded-2xl cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                  isStudent === false
                    ? 'ring-2 ring-orange-500 bg-orange-500/15 scale-[1.02] shadow-[0_0_30px_rgba(234,88,12,0.3)]'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] hover:scale-[1.01] border border-white/10'
                }`}
                style={{ backdropFilter: 'blur(16px)' }}
              >
                {/* Check badge si sélectionné */}
                {isStudent === false && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}

                <div>
                  <div className="w-14 h-14 rounded-2xl bg-white border-2 border-orange-400/80 flex items-center justify-center mb-4 p-1.5 shadow-[0_0_20px_rgba(234,88,12,0.35)] overflow-hidden">
                    <img src={proLogo} alt="Profil standard / pro" className="w-full h-full object-contain" />
                  </div>

                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400 block mb-1">
                    Profil standard / Pro
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-white mb-2">
                    Non, je ne suis pas étudiant
                  </h4>
                  <p className="text-xs text-white/60 font-medium leading-relaxed">
                    Vous êtes un professionnel, un enseignant, un particulier, un commerçant ou un indépendant.
                  </p>
                </div>
              </div>
            </div>

            <button
              id="onboard-continue-btn"
              type="button"
              onClick={handleProceedFromStep1}
              className={`w-full py-4 rounded-2xl font-extrabold text-white text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg mt-4 ${
                isStudent !== null
                  ? 'hover:scale-[1.01] active:scale-[0.99] opacity-100'
                  : 'opacity-70 hover:opacity-90'
              }`}
              style={{
                background:
                  isStudent === true
                    ? 'linear-gradient(135deg, #059669, #10B981)'
                    : 'linear-gradient(135deg, #EA580C, #F97316)',
                boxShadow:
                  isStudent === true
                    ? '0 6px 24px rgba(16,185,129,0.4)'
                    : '0 6px 24px rgba(234,88,12,0.4)',
              }}
            >
              Continuer
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════════
            ÉTAPE 2 :
            - Si NON-ÉTUDIANT : Questions importantes seulement (Nom, Pays, Tel, Profession, Bio, Avatar)
            - Si ÉTUDIANT : Identité & Contact (Nom, Pays, Tel, Avatar)
            ════════════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            {/* Bannière explicative spécifique pour non-étudiant */}
            {!isStudent && (
              <div
                className="p-3.5 rounded-2xl flex items-center gap-3 mb-4"
                style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
              >
                <Briefcase className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-xs text-blue-200 font-medium leading-relaxed">
                  En tant qu'utilisateur non-étudiant, vous n'avez pas de questions scolaires à remplir. Renseignez simplement vos informations essentielles pour accéder à l'ensemble des services.
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-3.5">
                {isStudent ? 'Vos coordonnées personnelles' : 'Informations importantes de votre profil'}
              </p>

              {/* Nom complet */}
              <label className="text-xs font-bold text-white/70 mb-1.5 block">
                Nom complet *
              </label>
              <div className="relative mb-3.5">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  id="onboard-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex : Konan Alexandre"
                  required
                  autoFocus
                  className={`${inputClass} pl-10`}
                  style={inputStyle}
                />
              </div>

              {/* Pays & Téléphone en 2 colonnes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
                <div>
                  <label className="text-xs font-bold text-white/70 mb-1.5 block">
                    Pays *
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none z-10" />
                    <select
                      id="onboard-country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      required
                      className={`${inputClass} pl-10 cursor-pointer`}
                      style={{ ...inputStyle, WebkitAppearance: 'none' }}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c} style={{ background: '#1a1a3e', color: 'white' }}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 mb-1.5 block">
                    Numéro de téléphone
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="onboard-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+225 07 00 00 00 00"
                      className={`${inputClass} pl-10`}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Champ "Profession / Domaine d'activité" affiché UNIQUEMENT si NON-ÉTUDIANT */}
              {!isStudent && (
                <div className="mb-3.5">
                  <label className="text-xs font-bold text-white/70 mb-1.5 block">
                    Profession ou domaine d'activité
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="onboard-profession"
                      type="text"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="Ex : Enseignant, Développeur, Commerçant, Indépendant..."
                      className={`${inputClass} pl-10`}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {/* Photo de profil (URL) */}
              <div className="mb-3.5">
                <label className="text-xs font-bold text-white/70 mb-1.5 block">
                  Photo de profil (URL - optionnel)
                </label>
                <div className="relative">
                  <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    id="onboard-avatar"
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://exemple.com/photo.jpg"
                    className={`${inputClass} pl-10`}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Courte bio pour les non-étudiants directement à cette étape */}
              {!isStudent && (
                <div className="mb-3.5">
                  <label className="text-xs font-bold text-white/70 mb-1.5 block">
                    Courte présentation / Bio (optionnel)
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-white/30" />
                    <textarea
                      id="onboard-bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Présentez brièvement vos activités ou vos objectifs..."
                      rows={2}
                      className={`${inputClass} pl-10 resize-none`}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
                className="flex-none px-4 py-3.5 rounded-2xl font-bold text-sm text-white/60 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>

              <button
                id={isStudent ? 'onboard-next-school-btn' : 'onboard-submit-pro-btn'}
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3.5 rounded-2xl font-extrabold text-white text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg"
                style={{
                  background: isStudent
                    ? 'linear-gradient(135deg, #EA580C, #F97316)'
                    : 'linear-gradient(135deg, #059669, #10B981)',
                  boxShadow: isStudent
                    ? '0 6px 24px rgba(234,88,12,0.4)'
                    : '0 6px 24px rgba(16,185,129,0.4)',
                }}
              >
                {isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : isStudent ? (
                  <>
                    Étape suivante (Études)
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Terminer et accéder à StudyCloud
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ════════════════════════════════════════════════════════════════════════
            ÉTAPE 3 : PARCOURS ACADÉMIQUE (UNIQUEMENT POUR LES ÉTUDIANTS)
            ════════════════════════════════════════════════════════════════════════ */}
        {step === 3 && isStudent && (
          <form onSubmit={handleStep3Submit} className="space-y-4">
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3.5">
                Votre cursus étudiant
              </p>

              {/* École & Filière en 2 colonnes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3.5">
                <div>
                  <label className="text-xs font-bold text-white/70 mb-1.5 block">
                    École / Université *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="onboard-school"
                      type="text"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="Ex : CME, INPHB, Univ. FHB..."
                      required
                      autoFocus
                      className={`${inputClass} pl-10`}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 mb-1.5 block">
                    Filière / Spécialité *
                  </label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="onboard-filiere"
                      type="text"
                      value={filiere}
                      onChange={(e) => setFiliere(e.target.value)}
                      placeholder="Ex : Informatique, Électrotech..."
                      required
                      className={`${inputClass} pl-10`}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Niveau d'études */}
              <label className="text-xs font-bold text-white/70 mb-1.5 block">
                Niveau d'études *
              </label>
              <div className="relative mb-3.5">
                <BookOpen className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none z-10" />
                <select
                  id="onboard-level"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  required
                  className={`${inputClass} pl-10 cursor-pointer`}
                  style={{ ...inputStyle, WebkitAppearance: 'none' }}
                >
                  <option value="" style={{ background: '#1a1a3e', color: '#aaa' }}>
                    Choisir un niveau d'études...
                  </option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l} style={{ background: '#1a1a3e', color: 'white' }}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bio courte */}
              <label className="text-xs font-bold text-white/70 mb-1.5 block">
                Bio courte (optionnel)
              </label>
              <div className="relative mb-3.5">
                <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-white/30" />
                <textarea
                  id="onboard-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Quelques mots sur vos études, vos objectifs..."
                  rows={2}
                  className={`${inputClass} pl-10 resize-none`}
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  setError(null);
                }}
                className="flex-none px-4 py-3.5 rounded-2xl font-bold text-sm text-white/60 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <ChevronLeft className="w-4 h-4" />
                Retour
              </button>

              <button
                id="onboard-submit-student-btn"
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3.5 rounded-2xl font-extrabold text-white text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-lg"
                style={{
                  background: isLoading
                    ? 'rgba(16,185,129,0.4)'
                    : 'linear-gradient(135deg, #059669, #10B981)',
                  boxShadow: isLoading ? 'none' : '0 6px 24px rgba(16,185,129,0.4)',
                }}
              >
                {isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {isLoading ? 'Enregistrement...' : 'Terminer et accéder à StudyCloud'}
              </button>
            </div>
          </form>
        )}

        {/* Footnote */}
        <p className="text-[11px] text-white/30 font-medium text-center mt-6 leading-relaxed">
          Ces informations permettent d'identifier vos documents partagés et de vous proposer les outils adaptés.
        </p>
      </div>
    </div>
  );
}

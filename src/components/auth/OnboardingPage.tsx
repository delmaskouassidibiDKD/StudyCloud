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
  Upload,
  Clock,
  X,
} from 'lucide-react';
import { StudyCloudAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { compressAvatarImage, getAvatarFromEmail } from '../../services/imageUtils';
import { DnaLogo } from '../DnaLogo';
import studentLogo from '../../assets/student-logo.jpg';
import proLogo from '../../assets/pro-logo.jpg';

export interface CountryMeta {
  name: string;
  dialCode: string;
  flag: string;
  placeholder: string;
}

export const COUNTRY_DATA: Record<string, CountryMeta> = {
  "Côte d'Ivoire": { name: "Côte d'Ivoire", dialCode: '+225', flag: '🇨🇮', placeholder: '07 00 00 00 00' },
  'Sénégal': { name: 'Sénégal', dialCode: '+221', flag: '🇸🇳', placeholder: '77 000 00 00' },
  'Mali': { name: 'Mali', dialCode: '+223', flag: '🇲🇱', placeholder: '70 00 00 00' },
  'Burkina Faso': { name: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫', placeholder: '70 00 00 00' },
  'Guinée': { name: 'Guinée', dialCode: '+224', flag: '🇬🇳', placeholder: '620 00 00 00' },
  'Cameroun': { name: 'Cameroun', dialCode: '+237', flag: '🇨🇲', placeholder: '6 00 00 00 00' },
  'Gabon': { name: 'Gabon', dialCode: '+241', flag: '🇬🇦', placeholder: '06 00 00 00' },
  'Congo': { name: 'Congo', dialCode: '+242', flag: '🇨🇬', placeholder: '06 000 00 00' },
  "République démocratique du Congo": { name: "République démocratique du Congo", dialCode: '+243', flag: '🇨🇩', placeholder: '81 000 0000' },
  'Madagascar': { name: 'Madagascar', dialCode: '+261', flag: '🇲🇬', placeholder: '32 00 000 00' },
  'Bénin': { name: 'Bénin', dialCode: '+229', flag: '🇧🇯', placeholder: '97 00 00 00' },
  'Togo': { name: 'Togo', dialCode: '+228', flag: '🇹🇬', placeholder: '90 00 00 00' },
  'Niger': { name: 'Niger', dialCode: '+227', flag: '🇳🇪', placeholder: '90 00 00 00' },
  'Tchad': { name: 'Tchad', dialCode: '+235', flag: '🇹🇩', placeholder: '66 00 00 00' },
  'Mauritanie': { name: 'Mauritanie', dialCode: '+222', flag: '🇲🇷', placeholder: '45 00 00 00' },
  'Maroc': { name: 'Maroc', dialCode: '+212', flag: '🇲🇦', placeholder: '6 00 00 00 00' },
  'Algérie': { name: 'Algérie', dialCode: '+213', flag: '🇩🇿', placeholder: '5 00 00 00 00' },
  'Tunisie': { name: 'Tunisie', dialCode: '+216', flag: '🇹🇳', placeholder: '20 000 000' },
  'France': { name: 'France', dialCode: '+33', flag: '🇫🇷', placeholder: '6 12 34 56 78' },
  'Belgique': { name: 'Belgique', dialCode: '+32', flag: '🇧🇪', placeholder: '470 12 34 56' },
  'Canada': { name: 'Canada', dialCode: '+1', flag: '🇨🇦', placeholder: '514 123 4567' },
  'Autre': { name: 'Autre', dialCode: '+', flag: '🌍', placeholder: 'Numéro avec indicatif' },
};

export const COUNTRIES = Object.keys(COUNTRY_DATA);

export const LEVELS = [
  'Lycée / Terminale', 'BTS 1', 'BTS 2', 'Licence 1', 'Licence 2', 'Licence 3',
  'Master 1', 'Master 2', 'Doctorat', 'Formation professionnelle', 'Autre',
];

export const SUGGESTED_DOMAINS = [
  'Enseignement & Éducation',
  'Informatique, Digital & Nouvelles Technologies',
  'Commerce, Vente & E-commerce',
  'Santé, Médecine & Pharmacie',
  'Finance, Banque & Comptabilité',
  'Droit, Justice & Juridique',
  'Ingénierie, BTP & Industrie',
  'Marketing, Communication & Médias',
  'Art, Design & Graphisme',
  'Administration, RH & Management',
  'Agriculture, Élevage & Agroalimentaire',
  'Transport, Logistique & Douane',
  'Tourisme, Hôtellerie & Restauration',
  'Artisanat & Services de proximité',
  'Professionnel indépendant / Consultant',
  'Autre secteur d\'activité',
];

export function OnboardingPage() {
  const { user, token, updateProfile, logout } = useAuth();

  // Étape 1 : Profiling ("Êtes-vous étudiant ?")
  // Étape 2 : Identité & coordonnées
  // Étape 3 : Cursus académique (si étudiant)
  const [step, setStep] = useState<1 | 2 | 3>(() => {
    if (user?.school || user?.filiere) return 3;
    if (user?.phone || user?.country) return 2;
    return 1;
  });
  const [isStudent, setIsStudent] = useState<boolean | null>(() => {
    if (user?.school && user.school !== 'Particulier / Professionnel') return true;
    if (user?.school === 'Particulier / Professionnel') return false;
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Champs généraux (communs à tous) - restauration du brouillon si présent
  const [name, setName] = useState(user?.name || '');
  const [country, setCountry] = useState(user?.country || "Côte d'Ivoire");
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(() => user?.avatar_url || getAvatarFromEmail(user?.email, user?.name));
  const [isCustomAvatar, setIsCustomAvatar] = useState(Boolean(user?.avatar_url && !user.avatar_url.startsWith('data:image/svg+xml')));
  const [showAllDomains, setShowAllDomains] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');

  // Métadonnées du pays actif (indicatif, drapeau, format)
  const currentCountry = COUNTRY_DATA[country] || { name: country, dialCode: '+225', flag: '🇨🇮', placeholder: '07 00 00 00 00' };

  // Champ spécifique non-étudiant
  const [profession, setProfession] = useState(() => localStorage.getItem('unifolder_user_profession') || '');

  // Champs spécifiques étudiant
  const [school, setSchool] = useState(user?.school || '');
  const [filiere, setFiliere] = useState(user?.filiere || '');
  const [level, setLevel] = useState(user?.level || '');

  // ─── Gestion de l'expiration 20 minutes et inactivité 15 minutes ─────────────
  const TOTAL_DURATION_SEC = 20 * 60; // 20 minutes maximum
  const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes d'inactivité

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const key = `sc_onb_start_${user?.id || 'default'}`;
    let start = localStorage.getItem(key);
    if (!start) {
      start = Date.now().toString();
      localStorage.setItem(key, start);
    }
    const elapsed = Math.floor((Date.now() - parseInt(start, 10)) / 1000);
    return Math.max(0, TOTAL_DURATION_SEC - elapsed);
  });

  const lastActivityRef = React.useRef<number>(Date.now());

  const handleSessionExpired = React.useCallback(async (reason: 'timeout' | 'inactivity') => {
    try {
      if (user?.id || user?.email) {
        await StudyCloudAPI.cancelUnfinalizedAccount(
          { userId: user?.id, email: user?.email },
          token || undefined
        );
      }
    } catch (e) {}
    localStorage.removeItem(`sc_onb_start_${user?.id || 'default'}`);
    const message = reason === 'timeout'
      ? "Votre session d'inscription a expiré (délai de 20 minutes dépassé sans finalisation). Vos données temporaires ont été effacées. Veuillez recommencer."
      : "Session d'inscription interrompue : vous avez quitté ou été inactif pendant plus de 15 minutes. Vos données temporaires ont été effacées. Veuillez recommencer.";
    localStorage.setItem('sc_onboarding_expired_notice', message);
    logout();
  }, [user, token, logout]);

  // Écoute des interactions pour détecter l'inactivité
  React.useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });
    window.addEventListener('touchstart', updateActivity, { passive: true });
    window.addEventListener('scroll', updateActivity, { passive: true });
    document.addEventListener('visibilitychange', updateActivity);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      document.removeEventListener('visibilitychange', updateActivity);
    };
  }, []);

  // Décompteur chaque seconde et surveillance de l'inactivité (15 minutes)
  React.useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      // 1. Inactivité > 15 minutes
      if (now - lastActivityRef.current >= INACTIVITY_LIMIT_MS) {
        clearInterval(timer);
        handleSessionExpired('inactivity');
        return;
      }

      // 2. Décompte global des 20 minutes
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSessionExpired('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handleSessionExpired]);

  // Sauvegarde automatique du brouillon pour reprise fluide sur tout appareil
  React.useEffect(() => {
    if (!token) return;
    const save = () => {
      StudyCloudAPI.saveOnboardingDraft(token, {
        name,
        school,
        filiere,
        level,
        country,
        phone,
        bio,
        avatarUrl,
      }).catch(() => {});
    };
    save();
    const interval = setInterval(save, 30000);
    return () => clearInterval(interval);
  }, [token, step, name, school, filiere, level, country, phone, bio, avatarUrl]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Gestion de l'import direct de l'image (logo ou photo) depuis l'appareil
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError(null);
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validation de la taille : max 1 Mo (1 048 576 octets)
    const MAX_SIZE_BYTES = 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setAvatarError("L'image dépasse 1 Mo. Veuillez choisir une image ne dépassant pas 1 Mo.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Validation des formats autorisés : JPG, PNG, BMP
    const validExtensions = ['.jpg', '.jpeg', '.png', '.bmp'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/bmp', 'image/x-ms-bmp'];
    const hasValidMime = validMimeTypes.includes(file.type);

    if (!hasValidExt && !hasValidMime) {
      setAvatarError("Format non autorisé. Les formats d'image autorisés sont JPG, PNG et BMP.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 3. Compression et recadrage carré optimal (256x256 px, ~15-25 Ko) pour Cloudflare D1
    compressAvatarImage(file, 256, 0.85)
      .then((result) => {
        setAvatarUrl(result);
        setIsCustomAvatar(true);
      })
      .catch(() => {
        setAvatarError("Impossible de traiter l'image sélectionnée. Veuillez réessayer.");
      });
  };

  // Passage de l'Étape 1 (Choix du profil) vers l'Étape 2
  const handleProceedFromStep1 = () => {
    setError(null);
    if (isStudent === null) {
      setError('Veuillez indiquer si vous êtes étudiant ou non pour continuer.');
      return;
    }
    setStep(2);
  };

  // Validation de l'Étape 2 (Nom, Pays, Téléphone et Profession obligatoires)
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
    if (!phone.trim()) {
      setError('Le numéro de téléphone est obligatoire.');
      return;
    }
    if (!isStudent && !profession.trim()) {
      setError("La profession ou domaine d'activité est obligatoire.");
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

    // Normalisation du téléphone avec l'indicatif correspondant au pays choisi
    const cleanPhone = phone.trim();
    let finalPhone = '';
    if (cleanPhone) {
      if (cleanPhone.startsWith('+')) {
        finalPhone = cleanPhone;
      } else {
        finalPhone = `${currentCountry.dialCode} ${cleanPhone}`;
      }
    }

    const finalAvatar = avatarUrl.trim() || user?.avatar_url || getAvatarFromEmail(user?.email, name);

    try {
      const res: any = await StudyCloudAPI.completeOnboarding(token!, {
        name: name.trim(),
        school: finalSchool,
        filiere: finalFiliere,
        level: finalLevel,
        country,
        phone: finalPhone || undefined,
        bio: bio.trim(),
        avatarUrl: finalAvatar,
        is_student: studentStatus ? 1 : 0,
        profession: !studentStatus ? profession.trim() : undefined,
      });

      if (res.success && res.data) {
        const savedAvatar = res.data.avatar_url || finalAvatar;

        // Enregistrement dans le stockage local
        localStorage.setItem('unifolder_is_student', studentStatus ? 'true' : 'false');
        localStorage.setItem('unifolder_user_name', res.data.name || name.trim());
        localStorage.setItem('unifolder_user_country', res.data.country || country);
        localStorage.setItem('unifolder_user_school', res.data.school || finalSchool);
        localStorage.setItem('unifolder_user_filiere', res.data.filiere || finalFiliere);
        if (savedAvatar) {
          localStorage.setItem('unifolder_user_avatar', savedAvatar);
        }
        if (finalPhone) localStorage.setItem('unifolder_user_phone', finalPhone);
        if (!studentStatus && profession.trim()) {
          localStorage.setItem('unifolder_user_profession', profession.trim());
        }

        localStorage.removeItem(`sc_onb_start_${user?.id || 'default'}`);

        // Déclencher l'envoi de l'email de bienvenue professionnel à son arrivée à l'accueil
        StudyCloudAPI.sendWelcomeEmail(token!).catch(() => {});

        updateProfile({
          ...res.data,
          avatar_url: finalAvatar || null,
          is_student: studentStatus ? 1 : 0,
        });
      } else {
        setError(res.error || "Une erreur est survenue lors de l'enregistrement de votre profil.");
      }
    } catch (err: any) {
      if (err.message?.includes('expirée') || err.message?.includes('410')) {
        handleSessionExpired('timeout');
        return;
      }
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

          <div className="flex items-center gap-2">
            {/* Décompteur de 20 minutes */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all shadow-sm ${
                timeLeft < 180
                  ? 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse'
                  : 'bg-orange-500/10 border-orange-500/30 text-orange-300'
              }`}
              title="Délai restant pour finaliser votre inscription (suppression automatique après 20 min ou 15 min d'inactivité)"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(timeLeft)}</span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-white/70">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Compte sécurisé</span>
            </div>
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

              {/* Pays & Téléphone en 2 colonnes avec indicatif dynamique */}
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
                      {COUNTRIES.map((c) => {
                        const meta = COUNTRY_DATA[c];
                        return (
                          <option key={c} value={c} style={{ background: '#1a1a3e', color: 'white' }}>
                            {meta ? `${meta.flag} ${c} (${meta.dialCode})` : c}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 mb-1.5 flex items-center justify-between">
                    <span>Numéro de téléphone *</span>
                    <span className="text-[11px] font-semibold text-orange-400/90">
                      Indicatif {currentCountry.dialCode}
                    </span>
                  </label>
                  <div className="flex rounded-xl overflow-hidden" style={inputStyle}>
                    {/* Badge indicatif pays synchronisé automatiquement avec le pays choisi */}
                    <div
                      className="flex items-center gap-1.5 px-3.5 py-3 bg-white/10 border-r border-white/10 text-orange-400 font-extrabold text-sm select-none shrink-0"
                      title={`Indicatif téléphonique pour ${country}`}
                    >
                      <span className="text-base leading-none">{currentCountry.flag}</span>
                      <span className="tracking-tight">{currentCountry.dialCode}</span>
                    </div>
                    <input
                      id="onboard-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={currentCountry.placeholder}
                      required
                      className="w-full px-3.5 py-3 text-sm font-medium text-white placeholder-white/30 outline-none bg-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Champ "Profession / Domaine d'activité" affiché UNIQUEMENT si NON-ÉTUDIANT */}
              {!isStudent && (
                <div className="mb-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-white/70 block">
                      Profession ou domaine d'activité *
                    </label>
                    <span className="text-[11px] font-semibold text-orange-400/90">
                      Obligatoire
                    </span>
                  </div>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      id="onboard-profession"
                      type="text"
                      list="domain-suggestions-list"
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="Sélectionnez un domaine ci-dessous ou saisissez le vôtre..."
                      required
                      className={`${inputClass} pl-10`}
                      style={inputStyle}
                    />
                    <datalist id="domain-suggestions-list">
                      {SUGGESTED_DOMAINS.map((dom) => (
                        <option key={dom} value={dom} />
                      ))}
                    </datalist>
                  </div>

                  {/* Suggestions interactives de domaines avec possibilité de saisie libre */}
                  <div className="mt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-white/60 font-medium flex items-center gap-1">
                        <span>✨ Suggestions (cliquez pour choisir ou écrivez librement) :</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAllDomains((prev) => !prev)}
                        className="text-orange-400 hover:text-orange-300 font-bold transition-colors cursor-pointer"
                      >
                        {showAllDomains ? 'Moins de choix' : `+ Voir plus (${SUGGESTED_DOMAINS.length})`}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {(showAllDomains ? SUGGESTED_DOMAINS : SUGGESTED_DOMAINS.slice(0, 8)).map((dom) => {
                        const isSelected = profession.trim().toLowerCase() === dom.toLowerCase();
                        return (
                          <button
                            key={dom}
                            type="button"
                            onClick={() => setProfession(dom)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-orange-600 text-white border-orange-400 shadow-[0_0_12px_rgba(234,88,12,0.4)] scale-[1.02]'
                                : 'bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white border-white/10'
                            }`}
                          >
                            {isSelected ? '✓ ' : ''}{dom}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Photo de profil ou Logo (Import direct depuis l'appareil - pas de lien URL) */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-white/70 block">
                    {isStudent ? 'Photo de profil' : 'Photo de profil ou logo'}
                  </label>
                  <span className="text-[10.5px] font-semibold text-emerald-400/90 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    {isCustomAvatar ? 'Image personnalisée importée' : 'Associée à votre adresse email'}
                  </span>
                </div>

                {/* Input fichier caché activé au clic */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.bmp,image/jpeg,image/png,image/bmp"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                />

                {/* Affichage immédiat de l'image (personnalisée ou issue de l'email) */}
                <div
                  className="p-3.5 rounded-2xl flex flex-col sm:flex-row items-center gap-4 transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}
                >
                  <div className="relative shrink-0 w-[120px] h-[120px] rounded-2xl overflow-hidden border-2 border-orange-500/50 shadow-[0_0_16px_rgba(234,88,12,0.25)] bg-black/40 flex items-center justify-center group">
                    <img
                      src={avatarUrl || getAvatarFromEmail(user?.email, name || user?.name)}
                      alt="Aperçu photo de profil"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] font-bold text-white bg-orange-600 px-2.5 py-1 rounded-lg shadow-sm hover:bg-orange-500 cursor-pointer"
                      >
                        Changer
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-left min-w-0">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold mb-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isCustomAvatar ? "Image importée avec succès (120×120 px)" : "Photo de profil par défaut (120×120 px)"}</span>
                    </div>
                    <p className="text-xs text-white/70 mb-3 leading-relaxed">
                      Votre image s'affichera sur votre profil StudyCloud.
                    </p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-orange-400" />
                        Changer l'image
                      </button>
                    </div>
                  </div>
                </div>

                {/* Message d'erreur format ou taille */}
                {avatarError && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{avatarError}</span>
                  </div>
                )}
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
          Ces informations permettent de configurer votre profil et de vous proposer les outils adaptés.
        </p>
      </div>
    </div>
  );
}

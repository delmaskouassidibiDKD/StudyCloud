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
  expectedLengths: number[];
  digitHint: string;
}

export const COUNTRY_DATA: Record<string, CountryMeta> = {
  "Côte d'Ivoire": {
    name: "Côte d'Ivoire",
    dialCode: '+225',
    flag: '🇨🇮',
    placeholder: '01 02 03 04 05',
    expectedLengths: [10],
    digitHint: '10 chiffres',
  },
  'Sénégal': {
    name: 'Sénégal',
    dialCode: '+221',
    flag: '🇸🇳',
    placeholder: '77 000 00 00',
    expectedLengths: [9],
    digitHint: '9 chiffres',
  },
  'Mali': {
    name: 'Mali',
    dialCode: '+223',
    flag: '🇲🇱',
    placeholder: '70 00 00 00',
    expectedLengths: [8],
    digitHint: '8 chiffres',
  },
  'Burkina Faso': {
    name: 'Burkina Faso',
    dialCode: '+226',
    flag: '🇧🇫',
    placeholder: '70 00 00 00',
    expectedLengths: [8],
    digitHint: '8 chiffres',
  },
  'Guinée': {
    name: 'Guinée',
    dialCode: '+224',
    flag: '🇬🇳',
    placeholder: '620 00 00 00',
    expectedLengths: [9],
    digitHint: '9 chiffres',
  },
  'Cameroun': {
    name: 'Cameroun',
    dialCode: '+237',
    flag: '🇨🇲',
    placeholder: '6 00 00 00 00',
    expectedLengths: [9],
    digitHint: '9 chiffres',
  },
  'Gabon': {
    name: 'Gabon',
    dialCode: '+241',
    flag: '🇬🇦',
    placeholder: '06 00 00 00',
    expectedLengths: [7, 8],
    digitHint: '7 ou 8 chiffres',
  },
  'Congo': {
    name: 'Congo',
    dialCode: '+242',
    flag: '🇨🇬',
    placeholder: '06 000 00 00',
    expectedLengths: [9],
    digitHint: '9 chiffres',
  },
  "République démocratique du Congo": {
    name: "République démocratique du Congo",
    dialCode: '+243',
    flag: '🇨🇩',
    placeholder: '81 000 0000',
    expectedLengths: [9, 10],
    digitHint: '9 ou 10 chiffres',
  },
  'Madagascar': {
    name: 'Madagascar',
    dialCode: '+261',
    flag: '🇲🇬',
    placeholder: '32 00 000 00',
    expectedLengths: [9, 10],
    digitHint: '9 ou 10 chiffres',
  },
  'Bénin': {
    name: 'Bénin',
    dialCode: '+229',
    flag: '🇧🇯',
    placeholder: '01 97 00 00 00',
    expectedLengths: [8, 10],
    digitHint: '8 ou 10 chiffres',
  },
  'Togo': {
    name: 'Togo',
    dialCode: '+228',
    flag: '🇹🇬',
    placeholder: '90 00 00 00',
    expectedLengths: [8],
    digitHint: '8 chiffres',
  },
  'Niger': {
    name: 'Niger',
    dialCode: '+227',
    flag: '🇳🇪',
    placeholder: '90 00 00 00',
    expectedLengths: [8],
    digitHint: '8 chiffres',
  },
  'Tchad': {
    name: 'Tchad',
    dialCode: '+235',
    flag: '🇹🇩',
    placeholder: '66 00 00 00',
    expectedLengths: [8],
    digitHint: '8 chiffres',
  },
  'Mauritanie': {
    name: 'Mauritanie',
    dialCode: '+222',
    flag: '🇲🇷',
    placeholder: '45 00 00 00',
    expectedLengths: [8],
    digitHint: '8 chiffres',
  },
  'Maroc': {
    name: 'Maroc',
    dialCode: '+212',
    flag: '🇲🇦',
    placeholder: '06 00 00 00 00',
    expectedLengths: [9, 10],
    digitHint: '9 ou 10 chiffres',
  },
  'Algérie': {
    name: 'Algérie',
    dialCode: '+213',
    flag: '🇩🇿',
    placeholder: '05 00 00 00 00',
    expectedLengths: [9, 10],
    digitHint: '9 ou 10 chiffres',
  },
  'Tunisie': {
    name: 'Tunisie',
    dialCode: '+216',
    flag: '🇹🇳',
    placeholder: '20 000 000',
    expectedLengths: [8],
    digitHint: '8 chiffres',
  },
  'France': {
    name: 'France',
    dialCode: '+33',
    flag: '🇫🇷',
    placeholder: '06 12 34 56 78',
    expectedLengths: [9, 10],
    digitHint: '9 ou 10 chiffres',
  },
  'Belgique': {
    name: 'Belgique',
    dialCode: '+32',
    flag: '🇧🇪',
    placeholder: '0470 12 34 56',
    expectedLengths: [9, 10],
    digitHint: '9 ou 10 chiffres',
  },
  'Canada': {
    name: 'Canada',
    dialCode: '+1',
    flag: '🇨🇦',
    placeholder: '514 123 4567',
    expectedLengths: [10],
    digitHint: '10 chiffres',
  },
  'Autre': {
    name: 'Autre',
    dialCode: '+',
    flag: '🌍',
    placeholder: 'Numéro avec indicatif',
    expectedLengths: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    digitHint: '6 à 15 chiffres',
  },
};

export const COUNTRIES = Object.keys(COUNTRY_DATA);

/**
 * Nettoie et extrait les chiffres utiles du numéro de téléphone
 * (enlève espaces, tirets, et l'indicatif s'il a été collé dans le champ)
 */
export function getCleanDigits(rawPhone: string, dialCode?: string): string {
  let digits = (rawPhone || '').replace(/\D/g, '');
  if (dialCode) {
    const dialDigits = dialCode.replace(/\D/g, '');
    if (dialDigits && digits.startsWith(dialDigits) && digits.length > dialDigits.length) {
      digits = digits.slice(dialDigits.length);
    }
  }
  return digits;
}

/**
 * Valide le numéro de téléphone en fonction du pays choisi et de la norme de chiffres requise
 */
export function validatePhoneNumber(rawPhone: string, countryName: string): {
  isValid: boolean;
  cleanDigits: string;
  count: number;
  expectedHint: string;
  error?: string;
} {
  const meta = COUNTRY_DATA[countryName] || COUNTRY_DATA['Autre'];
  const cleanDigits = getCleanDigits(rawPhone, meta.dialCode);
  const count = cleanDigits.length;

  if (!rawPhone || !rawPhone.trim() || count === 0) {
    return {
      isValid: false,
      cleanDigits: '',
      count: 0,
      expectedHint: meta.digitHint,
      error: 'Le numéro de téléphone est obligatoire.',
    };
  }

  const isMatch = meta.expectedLengths.includes(count);
  if (!isMatch) {
    let errorMsg = '';
    if (meta.expectedLengths.length === 1) {
      const exp = meta.expectedLengths[0];
      if (count < exp) {
        const missing = exp - count;
        errorMsg = `Le numéro pour ${meta.name} doit comporter exactement ${exp} chiffres (${count} saisi${count > 1 ? 's' : ''}, il manque ${missing} chiffre${missing > 1 ? 's' : ''}).`;
      } else {
        const excess = count - exp;
        errorMsg = `Le numéro pour ${meta.name} doit comporter exactement ${exp} chiffres (${count} saisi${count > 1 ? 's' : ''}, ${excess} chiffre${excess > 1 ? 's' : ''} en trop).`;
      }
    } else {
      errorMsg = `Le numéro pour ${meta.name} doit comporter ${meta.digitHint} (${count} chiffre${count > 1 ? 's' : ''} saisi${count > 1 ? 's' : ''}).`;
    }

    return {
      isValid: false,
      cleanDigits,
      count,
      expectedHint: meta.digitHint,
      error: errorMsg,
    };
  }

  return {
    isValid: true,
    cleanDigits,
    count,
    expectedHint: meta.digitHint,
  };
}

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
  // Toujours démarrer à l'Étape 1 : Question essentielle "Êtes-vous étudiant ?" (ne jamais sauter)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isStudent, setIsStudent] = useState<boolean | null>(() => {
    if (user?.is_student === 1) return true;
    if (user?.is_student === 0) return false;
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
  const [avatarUrl, setAvatarUrl] = useState(() => {
    if (user?.avatar_url && !user.avatar_url.startsWith('data:image/svg+xml')) {
      return user.avatar_url;
    }
    if (user?.is_student === 0) return proLogo;
    if (user?.is_student === 1) return studentLogo;
    return '';
  });
  const [isCustomAvatar, setIsCustomAvatar] = useState(Boolean(user?.avatar_url && !user.avatar_url.startsWith('data:image/svg+xml')));
  const [showAllDomains, setShowAllDomains] = useState(false);
  const [bio, setBio] = useState(user?.bio || '');

  // Métadonnées du pays actif (indicatif, drapeau, format, nombre de chiffres)
  const currentCountry = COUNTRY_DATA[country] || {
    name: country,
    dialCode: '+225',
    flag: '🇨🇮',
    placeholder: '01 02 03 04 05',
    expectedLengths: [10],
    digitHint: '10 chiffres',
  };

  // Validation en direct du numéro de téléphone selon les normes du pays
  const phoneValidation = React.useMemo(() => {
    return validatePhoneNumber(phone, country);
  }, [phone, country]);

  // Champ spécifique non-étudiant
  const [profession, setProfession] = useState(() => localStorage.getItem('unifolder_user_profession') || '');

  // Champs spécifiques étudiant
  const [school, setSchool] = useState(user?.school || '');
  const [filiere, setFiliere] = useState(user?.filiere || '');
  const [level, setLevel] = useState(user?.level || '');

  // ─── Gestion de l'horloge et de la persistance continue d'onboarding ───
  const TOTAL_DURATION_SEC = 7 * 60; // 7 minutes indicatif
  const startKey = `sc_onb_start_${user?.id || 'default'}`;
  const lastActiveKey = `sc_onb_last_active_${user?.id || 'default'}`;

  // Calcul dynamique et continu du temps restant
  const calculateRemainingSeconds = React.useCallback(() => {
    let start = localStorage.getItem(startKey);
    if (!start) {
      start = Date.now().toString();
      localStorage.setItem(startKey, start);
    }
    const elapsed = Math.floor((Date.now() - parseInt(start, 10)) / 1000);
    // Si le temps indicatif est écoulé, réinitialiser pour permettre à l'utilisateur de terminer en toute sérénité
    if (elapsed >= TOTAL_DURATION_SEC) {
      localStorage.setItem(startKey, Date.now().toString());
      return TOTAL_DURATION_SEC;
    }
    return Math.max(0, TOTAL_DURATION_SEC - elapsed);
  }, [startKey]);

  const [timeLeft, setTimeLeft] = useState<number>(calculateRemainingSeconds);

  const handleSessionExpired = React.useCallback(async (_reason: 'timeout' | 'inactivity') => {
    // Ne JAMAIS supprimer ni annuler un compte dont l'email est déjà vérifié !
    localStorage.removeItem(startKey);
    localStorage.removeItem(lastActiveKey);
    localStorage.removeItem('sc_onboarding_expired_notice');
  }, [startKey, lastActiveKey]);

  // Écoute des interactions pour rafraîchir l'activité en continu (même après sortie d'écran)
  React.useEffect(() => {
    const updateActivity = () => {
      localStorage.setItem(lastActiveKey, Date.now().toString());
    };

    // Initialiser l'activité courante
    if (!localStorage.getItem(lastActiveKey)) {
      updateActivity();
    }

    window.addEventListener('mousemove', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });
    window.addEventListener('touchstart', updateActivity, { passive: true });
    window.addEventListener('scroll', updateActivity, { passive: true });
    window.addEventListener('click', updateActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('click', updateActivity);
    };
  }, [lastActiveKey]);

  // Décompteur ininterrompu : continue de s'écouler même si l'écran s'éteint ou l'app est minimisée
  React.useEffect(() => {
    const syncContinuousTimer = () => {
      const remaining = calculateRemainingSeconds();
      setTimeLeft(remaining);
    };

    // Synchronisation immédiate
    syncContinuousTimer();

    // 1. Tick régulier toutes les 500ms
    const timer = setInterval(syncContinuousTimer, 500);

    // 2. Réactivation instantanée dès que l'écran se rallume, l'onglet redevient visible, ou l'utilisateur revient
    const handleWakeUp = () => {
      syncContinuousTimer();
    };

    document.addEventListener('visibilitychange', handleWakeUp);
    window.addEventListener('focus', handleWakeUp);
    window.addEventListener('pageshow', handleWakeUp);
    window.addEventListener('storage', handleWakeUp);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleWakeUp);
      window.removeEventListener('focus', handleWakeUp);
      window.removeEventListener('pageshow', handleWakeUp);
      window.removeEventListener('storage', handleWakeUp);
    };
  }, [calculateRemainingSeconds, handleSessionExpired, startKey, lastActiveKey]);

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

  // Traitement et validation d'un fichier image (via input ou glisser-déposer)
  const processAvatarFile = (file: File) => {
    setAvatarError(null);
    setError(null);
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

  // Gestion de l'import direct de l'image (logo ou photo) depuis l'appareil
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processAvatarFile(file);
    }
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

    // Validation stricte du nombre de chiffres exigé par le pays
    const phoneCheck = validatePhoneNumber(phone, country);
    if (!phoneCheck.isValid) {
      setError(phoneCheck.error || 'Numéro de téléphone invalide pour ce pays.');
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
      : 'Professionnel / Particulier';

    const finalFiliere = studentStatus
      ? filiere.trim()
      : (profession.trim() || 'Général');

    const finalLevel = studentStatus
      ? (level || 'Non spécifié')
      : 'Professionnel';

    // Validation et normalisation du téléphone avec l'indicatif correspondant au pays choisi
    const phoneCheck = validatePhoneNumber(phone, country);
    if (!phoneCheck.isValid) {
      setError(phoneCheck.error || 'Numéro de téléphone invalide pour ce pays.');
      setIsLoading(false);
      return;
    }
    const finalPhone = `${currentCountry.dialCode} ${phoneCheck.cleanDigits}`;

    // Logo par défaut adapté au profil si aucune image personnalisée importée
    const defaultAvatar = !studentStatus ? proLogo : studentLogo;
    const finalAvatar = isCustomAvatar && avatarUrl.trim()
      ? avatarUrl.trim()
      : defaultAvatar;

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
      setError(err.message || 'Impossible de contacter le serveur StudyCloud.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = `w-full px-4 py-3.5 rounded-xl text-sm font-medium text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all`;
  const inputStyle = { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' };

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
      className="fixed inset-0 z-[99997] overflow-y-auto"
      style={{ background: 'linear-gradient(135deg, #090818 0%, #111028 35%, #18153d 70%, #0a1322 100%)' }}
    >
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-10%] left-[20%] w-[450px] h-[450px] rounded-full opacity-15 blur-[90px] animate-pulse"
          style={{ background: 'radial-gradient(circle, #10B981 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-5%] right-[10%] w-[400px] h-[400px] rounded-full opacity-15 blur-[90px]"
          style={{ background: 'radial-gradient(circle, #EA580C 0%, transparent 70%)' }}
        />
      </div>

      <div className="min-h-full w-full flex flex-col items-center justify-start py-8 sm:py-14 px-4 sm:px-8 lg:px-12 relative z-10">
        <div className="w-full max-w-4xl lg:max-w-5xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3.5">
              <DnaLogo className="w-10 h-10 drop-shadow-[0_0_10px_rgba(234,88,12,0.6)] shrink-0" glow={true} />
              <div>
                <div className="flex items-center gap-1.5 notranslate leading-none mb-1">
                  <span className="text-xl font-black tracking-tight">
                    <span className="text-orange-500">Study</span>
                    <span className="text-blue-400">Cloud</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    DKD Technologies
                  </span>
                </div>
                <h2 className="text-base font-black text-white leading-tight">
                  {step === 1 && 'Configuration de votre profil'}
                  {step === 2 && (isStudent ? 'Votre identité & coordonnées' : 'Informations importantes de votre compte')}
                  {step === 3 && 'Votre établissement & études'}
                </h2>
                <p className="text-xs text-white/50 font-medium">
                  {step === 1 && 'Étape 1 sur ' + (isStudent === false ? '2' : '3') + ' · Identification du profil'}
                  {step === 2 && (isStudent ? 'Étape 2 sur 3 · Coordonnées personnelles' : 'Étape 2 sur 2 · Finalisation du compte')}
                  {step === 3 && 'Étape 3 sur 3 · Cursus académique'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Décompteur de 7 minutes */}
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-all shadow-sm ${
                  timeLeft < 180
                    ? 'bg-red-500/20 border-red-500/50 text-red-300 animate-pulse'
                    : 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                }`}
                title="Délai restant pour finaliser votre inscription"
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
          <div className="w-full h-2.5 rounded-full mb-8 sm:mb-10" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${getProgressPercentage()}%`,
                background: 'linear-gradient(90deg, #EA580C, #10B981)',
                boxShadow: '0 0 14px rgba(234,88,12,0.6)',
              }}
            />
          </div>

          {/* Message d'erreur global */}
          {error && (
            <div
              className="mb-6 p-4 rounded-2xl flex items-start gap-3 animate-shake"
              style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)' }}
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-red-300 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              ÉTAPE 1 : QUESTION ESSENTIELLE : "Êtes-vous étudiant ?"
              ════════════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-8 sm:space-y-10">
              <div className="text-center">
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider mb-3">
                  Question essentielle
                </div>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
                  Êtes-vous actuellement étudiant ?
                </h3>
                <p className="text-sm sm:text-base text-white/60 mt-2 font-medium leading-relaxed max-w-xl mx-auto">
                  Afin de vous proposer des services et une expérience parfaitement adaptés à vos besoins.
                </p>
              </div>

              {/* 2 Grandes Cartes de Choix Interactives sans les points d'informations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 pt-1">
                {/* Option 1 : OUI, JE SUIS ÉTUDIANT */}
                <div
                  id="onboard-choice-student"
                  onClick={() => {
                    setIsStudent(true);
                    if (!isCustomAvatar) setAvatarUrl(studentLogo);
                    setError(null);
                  }}
                  className={`relative p-8 sm:p-10 rounded-3xl cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                    isStudent === true
                      ? 'ring-2 ring-emerald-400 bg-emerald-500/15 scale-[1.02] shadow-[0_0_35px_rgba(16,185,129,0.3)]'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] hover:scale-[1.01] border border-white/10'
                  }`}
                  style={{ backdropFilter: 'blur(16px)' }}
                >
                  {isStudent === true && (
                    <div className="absolute top-6 right-6 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}

                  <div>
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-emerald-400/80 flex items-center justify-center mb-6 p-2 shadow-[0_0_20px_rgba(16,185,129,0.35)] overflow-hidden">
                      <img src={studentLogo} alt="Profil étudiant" className="w-full h-full object-contain" />
                    </div>

                    <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 block mb-2">
                      Profil académique
                    </span>
                    <h4 className="text-xl sm:text-2xl font-black text-white mb-3">
                      Oui, je suis étudiant
                    </h4>
                    <p className="text-sm text-white/70 font-medium leading-relaxed">
                      Vous êtes au lycée, à l'université, en BTS, en école supérieure ou en préparation de concours.
                    </p>
                  </div>
                </div>

                {/* Option 2 : NON, JE NE SUIS PAS ÉTUDIANT */}
                <div
                  id="onboard-choice-non-student"
                  onClick={() => {
                    setIsStudent(false);
                    if (!isCustomAvatar) setAvatarUrl(proLogo);
                    setError(null);
                  }}
                  className={`relative p-8 sm:p-10 rounded-3xl cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                    isStudent === false
                      ? 'ring-2 ring-orange-500 bg-orange-500/15 scale-[1.02] shadow-[0_0_35px_rgba(234,88,12,0.3)]'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] hover:scale-[1.01] border border-white/10'
                  }`}
                  style={{ backdropFilter: 'blur(16px)' }}
                >
                  {isStudent === false && (
                    <div className="absolute top-6 right-6 w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}

                  <div>
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-orange-400/80 flex items-center justify-center mb-6 p-2 shadow-[0_0_20px_rgba(234,88,12,0.35)] overflow-hidden">
                      <img src={proLogo} alt="Profil standard / pro" className="w-full h-full object-contain" />
                    </div>

                    <span className="text-xs font-extrabold uppercase tracking-widest text-orange-400 block mb-2">
                      Profil standard / Pro
                    </span>
                    <h4 className="text-xl sm:text-2xl font-black text-white mb-3">
                      Non, je ne suis pas étudiant
                    </h4>
                    <p className="text-sm text-white/70 font-medium leading-relaxed">
                      Vous êtes un professionnel, un enseignant, un particulier, un commerçant ou un indépendant.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  id="onboard-continue-btn"
                  type="button"
                  onClick={handleProceedFromStep1}
                  className={`w-full sm:max-w-md py-4 sm:py-5 px-8 rounded-2xl font-black text-white text-base sm:text-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xl ${
                    isStudent !== null
                      ? 'hover:scale-[1.02] active:scale-[0.99] opacity-100'
                      : 'opacity-70 hover:opacity-90'
                  }`}
                  style={{
                    background:
                      isStudent === true
                        ? 'linear-gradient(135deg, #059669, #10B981)'
                        : 'linear-gradient(135deg, #EA580C, #F97316)',
                    boxShadow:
                      isStudent === true
                        ? '0 8px 30px rgba(16,185,129,0.45)'
                        : '0 8px 30px rgba(234,88,12,0.45)',
                  }}
                >
                  Continuer
                  <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>
          )}

            {/* ════════════════════════════════════════════════════════════════════════
                ÉTAPE 2 :
                - Si NON-ÉTUDIANT : Profil Standard / Pro (Nom, Pays, Tel, Profession, Bio, Avatar)
                - Si ÉTUDIANT : Coordonnées (Nom, Pays, Tel, Avatar)
                ════════════════════════════════════════════════════════════════════════ */}
            {step === 2 && (
              <form onSubmit={handleStep2Submit} className="space-y-6 sm:space-y-8 bg-white/[0.03] border border-white/10 rounded-3xl p-6 sm:p-10 backdrop-blur-xl shadow-2xl">
                {/* Bannière explicative pour non-étudiant */}
                {!isStudent && (
                  <div
                    className="p-4 sm:p-5 rounded-2xl flex items-start sm:items-center gap-3.5"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(99, 102, 241, 0.08))',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0 text-blue-400">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <p className="text-xs sm:text-sm text-blue-200/90 font-medium leading-relaxed">
                      En tant qu'utilisateur non-étudiant, vous n'avez pas de questions scolaires à remplir. Renseignez simplement vos informations essentielles pour accéder directement à l'ensemble des services.
                    </p>
                  </div>
                )}

                <div className="space-y-5">
                  <div className="border-b border-white/10 pb-2">
                    <p className="text-xs font-black text-orange-400 uppercase tracking-wider">
                      {isStudent ? 'Vos coordonnées personnelles' : 'Informations importantes de votre profil'}
                    </p>
                  </div>

                  {/* Nom complet */}
                  <div>
                    <label className="text-xs font-bold text-white/80 mb-2 block">
                      Nom complet *
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        id="onboard-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex : Konan Alexandre"
                        required
                        autoFocus
                        className={`${inputClass} pl-11`}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  {/* Pays & Téléphone en 2 colonnes avec indicatif dynamique */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-bold text-white/80 mb-2 block">
                        Pays *
                      </label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none z-10" />
                        <select
                          id="onboard-country"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          required
                          className={`${inputClass} pl-11 cursor-pointer`}
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
                      <label className="text-xs font-bold text-white/80 mb-2 flex items-center justify-between">
                        <span>Numéro de téléphone *</span>
                        <span className="text-[11px] font-semibold text-orange-400">
                          Indicatif {currentCountry.dialCode} • {currentCountry.digitHint}
                        </span>
                      </label>
                      <div
                        className={`flex rounded-xl overflow-hidden transition-all ${
                          phone.trim() && !phoneValidation.isValid && phoneValidation.count > 0
                            ? 'ring-2 ring-red-500/50'
                            : phone.trim() && phoneValidation.isValid
                            ? 'ring-2 ring-emerald-500/50'
                            : ''
                        }`}
                        style={inputStyle}
                      >
                        {/* Badge indicatif pays */}
                        <div
                          className="flex items-center gap-1.5 px-3.5 py-3.5 bg-white/10 border-r border-white/10 text-orange-400 font-extrabold text-sm select-none shrink-0"
                          title={`Indicatif téléphonique pour ${country}`}
                        >
                          <span className="text-base leading-none">{currentCountry.flag}</span>
                          <span className="tracking-tight">{currentCountry.dialCode}</span>
                        </div>
                        <input
                          id="onboard-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => {
                            // Autoriser les chiffres, espaces et tirets
                            const cleaned = e.target.value.replace(/[^\d\s\-\.]/g, '');
                            setPhone(cleaned);
                            if (error) setError(null);
                          }}
                          placeholder={currentCountry.placeholder}
                          required
                          className="w-full px-4 py-3.5 text-sm font-medium text-white placeholder-white/30 outline-none bg-transparent"
                        />
                      </div>

                      {/* Indicateur de validation en temps réel du nombre de chiffres */}
                      <div className="mt-1.5 min-h-[18px] text-[11px] flex items-center gap-1.5">
                        {!phone.trim() ? (
                          <span className="text-white/40">
                            Exigé pour {country} : <strong className="text-white/70">{currentCountry.digitHint}</strong> (ex : {currentCountry.placeholder})
                          </span>
                        ) : phoneValidation.isValid ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Numéro valide ({phoneValidation.count} chiffres)
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {phoneValidation.error}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Champ "Profession / Domaine d'activité" affiché UNIQUEMENT si NON-ÉTUDIANT */}
                  {!isStudent && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-white/80 block">
                          Profession ou domaine d'activité *
                        </label>
                        <span className="text-[11px] font-semibold text-orange-400/90 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                          Obligatoire
                        </span>
                      </div>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                          id="onboard-profession"
                          type="text"
                          list="domain-suggestions-list"
                          value={profession}
                          onChange={(e) => setProfession(e.target.value)}
                          placeholder="Sélectionnez un domaine ci-dessous ou saisissez le vôtre..."
                          required
                          className={`${inputClass} pl-11`}
                          style={inputStyle}
                        />
                        <datalist id="domain-suggestions-list">
                          {SUGGESTED_DOMAINS.map((dom) => (
                            <option key={dom} value={dom} />
                          ))}
                        </datalist>
                      </div>

                      {/* Suggestions interactives avec espacement soigné */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white/60 font-medium flex items-center gap-1.5">
                            <span>✨ Suggestions (cliquez pour choisir ou écrivez librement) :</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowAllDomains((prev) => !prev)}
                            className="text-orange-400 hover:text-orange-300 font-bold transition-colors cursor-pointer text-xs"
                          >
                            {showAllDomains ? 'Moins de choix ▲' : `+ Voir plus (${SUGGESTED_DOMAINS.length}) ▼`}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto p-1">
                          {(showAllDomains ? SUGGESTED_DOMAINS : SUGGESTED_DOMAINS.slice(0, 8)).map((dom) => {
                            const isSelected = profession.trim().toLowerCase() === dom.toLowerCase();
                            return (
                              <button
                                key={dom}
                                type="button"
                                onClick={() => setProfession(dom)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
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

                  {/* Photo de profil ou Logo (Import direct - pas de lien URL) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-white/80 block">
                        {isStudent ? 'Photo de profil' : 'Photo de profil ou logo'}
                      </label>
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        {isCustomAvatar ? 'Image personnalisée importée' : 'Associée à votre adresse email'}
                      </span>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.bmp,image/jpeg,image/png,image/bmp"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />

                    <div
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.dataTransfer.files?.[0]) {
                          processAvatarFile(e.dataTransfer.files[0]);
                        }
                      }}
                      className="p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-center gap-5 transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-orange-500/40 shadow-[0_0_20px_rgba(234,88,12,0.2)] bg-black/40 flex items-center justify-center group">
                        <img
                          src={avatarUrl || (!isStudent ? proLogo : studentLogo)}
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
                        <h4 className="text-sm font-bold text-white mb-1">
                          {isCustomAvatar ? "Photo ou logo importé" : (!isStudent ? "Logo officiel Profil Professionnel" : "Logo officiel Profil Étudiant")}
                        </h4>
                        <p className="text-xs text-white/50 mb-3 leading-relaxed">
                          Formats acceptés : JPG, PNG, BMP (max 1 Mo). Si vous n'importez pas d'image, le logo adapté à votre profil sera utilisé.
                        </p>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/15 transition-all flex items-center gap-2 cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5 text-orange-400" />
                            {isCustomAvatar ? "Changer l'image" : "Importer une image"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {avatarError && (
                      <div className="mt-2.5 p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-xs text-red-300 font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{avatarError}</span>
                      </div>
                    )}
                  </div>

                  {/* Courte bio pour les non-étudiants */}
                  {!isStudent && (
                    <div>
                      <label className="text-xs font-bold text-white/80 mb-2 block">
                        Courte présentation / Bio (optionnel)
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-4 top-3.5 w-4 h-4 text-white/40" />
                        <textarea
                          id="onboard-bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Présentez brièvement vos activités ou vos objectifs..."
                          rows={3}
                          className={`${inputClass} pl-11 resize-none`}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Boutons d'action */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setError(null);
                    }}
                    className="flex-none px-5 py-3.5 rounded-2xl font-bold text-sm text-white/70 hover:text-white transition-all cursor-pointer flex items-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Retour
                  </button>

                  <button
                    id={isStudent ? 'onboard-next-school-btn' : 'onboard-submit-pro-btn'}
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-4 px-6 rounded-2xl font-black text-white text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-xl"
                    style={{
                      background: isStudent
                        ? 'linear-gradient(135deg, #EA580C, #F97316)'
                        : 'linear-gradient(135deg, #059669, #10B981)',
                      boxShadow: isStudent
                        ? '0 8px 25px rgba(234,88,12,0.45)'
                        : '0 8px 25px rgba(16,185,129,0.45)',
                    }}
                  >
                    {isLoading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : isStudent ? (
                      <>
                        Étape suivante (Études)
                        <ChevronRight className="w-5 h-5" />
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
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
              <form onSubmit={handleStep3Submit} className="space-y-6 sm:space-y-8 bg-white/[0.03] border border-white/10 rounded-3xl p-6 sm:p-10 backdrop-blur-xl shadow-2xl">
                <div className="space-y-5">
                  <div className="border-b border-white/10 pb-2">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                      Votre cursus étudiant
                    </p>
                  </div>

                  {/* École & Filière en 2 colonnes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="text-xs font-bold text-white/80 mb-2 block">
                        École / Université *
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                          id="onboard-school"
                          type="text"
                          value={school}
                          onChange={(e) => setSchool(e.target.value)}
                          placeholder="Ex : CME, INPHB, Univ. FHB..."
                          required
                          autoFocus
                          className={`${inputClass} pl-11`}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-white/80 mb-2 block">
                        Filière / Spécialité *
                      </label>
                      <div className="relative">
                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                          id="onboard-filiere"
                          type="text"
                          value={filiere}
                          onChange={(e) => setFiliere(e.target.value)}
                          placeholder="Ex : Informatique, Électrotech..."
                          required
                          className={`${inputClass} pl-11`}
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Niveau d'études */}
                  <div>
                    <label className="text-xs font-bold text-white/80 mb-2 block">
                      Niveau d'études *
                    </label>
                    <div className="relative">
                      <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none z-10" />
                      <select
                        id="onboard-level"
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                        required
                        className={`${inputClass} pl-11 cursor-pointer`}
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
                  </div>

                  {/* Bio courte */}
                  <div>
                    <label className="text-xs font-bold text-white/80 mb-2 block">
                      Bio courte (optionnel)
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-4 top-3.5 w-4 h-4 text-white/40" />
                      <textarea
                        id="onboard-bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Quelques mots sur vos études, vos objectifs..."
                        rows={3}
                        className={`${inputClass} pl-11 resize-none`}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(2);
                      setError(null);
                    }}
                    className="flex-none px-5 py-3.5 rounded-2xl font-bold text-sm text-white/70 hover:text-white transition-all cursor-pointer flex items-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Retour
                  </button>

                  <button
                    id="onboard-submit-student-btn"
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-4 px-6 rounded-2xl font-black text-white text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-xl"
                    style={{
                      background: isLoading
                        ? 'rgba(16,185,129,0.4)'
                        : 'linear-gradient(135deg, #059669, #10B981)',
                      boxShadow: isLoading ? 'none' : '0 8px 25px rgba(16,185,129,0.45)',
                    }}
                  >
                    {isLoading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    {isLoading ? 'Enregistrement...' : 'Terminer et accéder à StudyCloud'}
                  </button>
                </div>
              </form>
            )}

          {/* Footnote */}
          <p className="text-xs sm:text-sm text-white/30 font-medium text-center mt-8 sm:mt-10 leading-relaxed">
            Ces informations permettent de configurer votre profil et de vous proposer les outils adaptés.
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  User,
  GraduationCap,
  Mail,
  ShieldCheck,
  LogOut,
  Check,
  Edit2,
  X,
  Home,
  Globe,
  Camera,
  Upload,
  Briefcase,
  Building2,
  Trash2,
  AlertTriangle,
  Copy,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StudyCloudAPI } from '../services/api';
import { compressAvatarImage, getAvatarFromEmail } from '../services/imageUtils';
import studentLogo from '../assets/student-logo.jpg';
import proLogo from '../assets/pro-logo.jpg';

interface UserSettingsViewProps {
  onBack: () => void;
}

export const UserSettingsView: React.FC<UserSettingsViewProps> = ({ onBack }) => {
  const { user, updateProfile, logout } = useAuth();

  const [name, setName] = useState(() => user?.name || localStorage.getItem('unifolder_user_name') || 'Alexandre Kouassi');
  const [school, setSchool] = useState(() => user?.school || localStorage.getItem('unifolder_user_school') || 'CME');
  const [filiere, setFiliere] = useState(() => user?.filiere || localStorage.getItem('unifolder_user_filiere') || 'Électrotechniques');
  const [email, setEmail] = useState(() => user?.email || localStorage.getItem('unifolder_user_email') || 'delmaskouassidibi@gmail.com');
  const [country, setCountry] = useState(() => user?.country || localStorage.getItem('unifolder_user_country') || "Côte d'Ivoire");
  const [avatarUrl, setAvatarUrl] = useState(() => user?.avatar_url || localStorage.getItem('unifolder_user_avatar') || getAvatarFromEmail(user?.email, user?.name));

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Logout confirmation modal state
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Delete account modal state
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [confirmEmailInput, setConfirmEmailInput] = useState('');
  const [confirmNameInput, setConfirmNameInput] = useState('');
  const [emailCopied, setEmailCopied] = useState(false);
  const [nameCopied, setNameCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit modal state
  const [editingField, setEditingField] = useState<'name' | 'school' | 'filiere' | 'email' | 'country' | null>(null);
  const [tempValue, setTempValue] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const getOriginalValue = (field: 'name' | 'school' | 'filiere' | 'email' | 'country') => {
    if (field === 'name') return name;
    if (field === 'school') return school;
    if (field === 'filiere') return filiere;
    if (field === 'country') return country;
    return email;
  };

  const openEditModal = (field: 'name' | 'school' | 'filiere' | 'email' | 'country') => {
    setEditingField(field);
    setTempValue(getOriginalValue(field));
  };

  const handleSaveField = () => {
    if (!editingField) return;
    const trimmed = tempValue.trim();
    if (!trimmed) return;

    if (editingField === 'name') {
      setName(trimmed);
      localStorage.setItem('unifolder_user_name', trimmed);
    } else if (editingField === 'school') {
      setSchool(trimmed);
      localStorage.setItem('unifolder_user_school', trimmed);
    } else if (editingField === 'filiere') {
      setFiliere(trimmed);
      localStorage.setItem('unifolder_user_filiere', trimmed);
    } else if (editingField === 'email') {
      setEmail(trimmed);
      localStorage.setItem('unifolder_user_email', trimmed);
    } else if (editingField === 'country') {
      setCountry(trimmed);
      localStorage.setItem('unifolder_user_country', trimmed);
    }

    const updatedUser = {
      name: editingField === 'name' ? trimmed : name,
      school: editingField === 'school' ? trimmed : school,
      filiere: editingField === 'filiere' ? trimmed : filiere,
      email: editingField === 'email' ? trimmed : email,
      country: editingField === 'country' ? trimmed : country,
    };

    updateProfile(updatedUser);

    const userId = user?.id || localStorage.getItem('unifolder_user_id');
    if (userId) {
      StudyCloudAPI.syncUser({
        id: userId,
        ...updatedUser,
        avatarUrl: avatarUrl || undefined,
      }).catch((err) => console.warn('Erreur synchronisation utilisateur:', err));
    }

    setEditingField(null);
    triggerToast("Modifications enregistrées avec succès !");
  };

  const processAvatarFile = (file: File) => {
    // Vérification du format (JPG, PNG, BMP)
    const validTypes = ['image/jpeg', 'image/png', 'image/bmp'];
    const validExtensions = ['.jpg', '.jpeg', '.png', '.bmp'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!validTypes.includes(file.type) && !hasValidExt) {
      alert("Format d'image non supporté. Les formats autorisés sont JPG, PNG et BMP.");
      return;
    }

    // Vérification de la taille (max 1 Mo)
    if (file.size > 1024 * 1024) {
      alert(`L'image sélectionnée dépasse 1 Mo (${(file.size / (1024 * 1024)).toFixed(2)} Mo). Veuillez choisir une image ne dépassant pas 1 Mo.`);
      return;
    }

    // Compression et recadrage carré optimal (256x256 px, ~15-25 Ko) pour Cloudflare D1
    compressAvatarImage(file, 256, 0.85)
      .then((dataUrl) => {
        setAvatarUrl(dataUrl);
        localStorage.setItem('unifolder_user_avatar', dataUrl);
        updateProfile({ avatar_url: dataUrl });

        const userId = user?.id || localStorage.getItem('unifolder_user_id');
        if (userId) {
          StudyCloudAPI.syncUser({
            id: userId,
            name,
            email,
            school,
            filiere,
            country,
            avatarUrl: dataUrl,
          }).catch((err) => console.warn('Erreur synchronisation avatar:', err));
        }

        triggerToast("Logo / Photo de profil mis à jour avec succès !");
      })
      .catch(() => {
        alert("Impossible de traiter l'image sélectionnée. Veuillez réessayer.");
      });
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    processAvatarFile(file);
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    onBack();
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (e) {
      setConfirmEmailInput(email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    }
  };

  const handleCopyName = async () => {
    try {
      await navigator.clipboard.writeText(name);
      setNameCopied(true);
      setTimeout(() => setNameCopied(false), 2000);
    } catch (e) {
      setConfirmNameInput(name);
      setNameCopied(true);
      setTimeout(() => setNameCopied(false), 2000);
    }
  };

  const isDeleteAllowed =
    confirmEmailInput.trim().toLowerCase() === email.trim().toLowerCase() &&
    confirmNameInput.trim().toLowerCase() === name.trim().toLowerCase();

  const handleDeleteAccount = async () => {
    if (!isDeleteAllowed || isDeleting) return;
    setIsDeleting(true);
    try {
      const userId = user?.id || localStorage.getItem('unifolder_user_id') || '';
      await StudyCloudAPI.deleteAccount(userId, email);
    } catch (err) {
      console.warn('Erreur lors de la suppression backend:', err);
    }

    // Nettoyage complet du stockage local pour isoler et supprimer toutes traces
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}

    logout();
    window.location.href = '/';
  };

  // Détection du statut étudiant ou profil standard / professionnel
  const isStudent = user?.is_student === 1 || 
                    (user?.is_student !== 0 && localStorage.getItem('unifolder_is_student') === 'true') ||
                    (school && school !== 'Particulier / Professionnel' && school !== 'Professionnel / Particulier' && school !== filiere && user?.level !== 'Professionnel');

  const domainName = user?.profession || 
                     localStorage.getItem('unifolder_user_profession') || 
                     (filiere && filiere !== 'Particulier / Professionnel' && filiere !== 'Professionnel / Particulier' && filiere !== 'Général' ? filiere : '') ||
                     (school && school !== 'Particulier / Professionnel' && school !== 'Professionnel / Particulier' ? school : '');

  const isCustomUploaded = Boolean(avatarUrl && !avatarUrl.startsWith('data:image/svg+xml'));
  const displayAvatar = isCustomUploaded ? avatarUrl : (!isStudent ? proLogo : studentLogo);

  const isModified = editingField ? tempValue.trim() !== getOriginalValue(editingField) && tempValue.trim().length > 0 : false;

  const getFieldTitle = (field: string | null) => {
    switch (field) {
      case 'name': return "Nom de l'utilisateur";
      case 'school': return isStudent ? "École / Université" : "Statut du profil";
      case 'filiere': return isStudent ? "Filière / Spécialité" : "Profession ou domaine d'activité";
      case 'email': return "Adresse email";
      case 'country': return "Pays de résidence / établissement";
      default: return "";
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#FDFBF7] dark:bg-[#0b0f19] text-stone-900 dark:text-white overflow-y-auto animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-stone-900 dark:bg-[#1e293b] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border border-stone-700 dark:border-[#334155] flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header - En-tête noir très foncé solide (#070a13) sans transparence */}
      <div className="sticky top-0 z-10 bg-[#FDFBF7] dark:bg-[#070a13] border-b border-stone-200 dark:border-[#1e293b] px-4 md:px-8 py-3.5 md:py-4 flex items-center gap-3 shadow-sm">
        <button
          onClick={onBack}
          className="p-1.5 md:p-2 bg-[#F5F1E9] dark:bg-[#1e293b] hover:bg-stone-200 dark:hover:bg-[#283852] border border-stone-300 dark:border-[#334155] rounded-xl text-stone-800 dark:text-white transition-colors cursor-pointer flex items-center justify-center"
          title="Retour"
        >
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6 text-stone-800 dark:text-white" />
        </button>
        <h1 className="text-base md:text-xl font-extrabold text-stone-900 dark:text-white tracking-tight">
          Paramètres du Profil
        </h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8 text-center pb-24 md:pb-12">
        {/* Profile Card Header */}
        <div className="flex flex-col items-center justify-center space-y-3 md:space-y-4 pt-2">
          {/* Avatar container with camera overlay and drag-drop */}
          <div 
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files?.[0]) {
                processAvatarFile(e.dataTransfer.files[0]);
              }
            }}
            className="relative group cursor-pointer"
            onClick={() => avatarInputRef.current?.click()}
          >
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white dark:bg-[#111a2e] border-3 border-stone-800 dark:border-[#334155] flex items-center justify-center text-orange-600 dark:text-orange-500 shadow-[4px_4px_0px_0px_#1c1917] dark:shadow-none overflow-hidden">
              {displayAvatar ? (
                <img src={displayAvatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 md:w-16 md:h-16" />
              )}
            </div>
            {/* Quick camera trigger button overlapping the circle */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              title="Changer le logo / photo"
              className="absolute bottom-0 right-0 p-2 md:p-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-full border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              <Camera className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>

          {/* Boutons et instructions pour changer le logo */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-stone-900 dark:bg-[#1e293b] hover:bg-stone-800 dark:hover:bg-[#283852] text-white font-bold text-xs md:text-sm rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-orange-400" />
                <span>{avatarUrl ? "Changer le logo / photo" : "Ajouter un logo / photo"}</span>
              </button>
            </div>

            <p className="text-[11px] text-stone-500 dark:text-slate-400 font-medium text-center max-w-xs">
              JPG, PNG ou BMP (max. 1 Mo) • Format carré recommandé (120x120 px)
            </p>

            <input
              ref={avatarInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.bmp,image/jpeg,image/png,image/bmp"
              onChange={handleAvatarFileSelect}
              className="hidden"
            />
          </div>

          <div>
            <h2 className="text-xl md:text-2xl font-black text-stone-900 dark:text-white">{name}</h2>
            <p className="text-xs md:text-sm text-stone-500 dark:text-slate-400 font-medium">{email}</p>
          </div>
        </div>

        {/* Profile Information Fields */}
        <div className="bg-white dark:bg-[#111a2e] border border-stone-200 dark:border-[#1e293b] rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xs space-y-3 md:space-y-4">
          <h3 className="text-xs md:text-sm font-extrabold text-stone-900 dark:text-white text-left border-b border-stone-100 dark:border-[#1e293b] pb-2">
            Informations personnelles
          </h3>

          {/* Field 1: Name */}
          <div
            onClick={() => openEditModal('name')}
            className="group p-3 md:p-4 bg-stone-50 dark:bg-[#0b0f19] hover:bg-orange-50/50 dark:hover:bg-[#162033] border border-stone-200 dark:border-[#1e293b] rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5 md:space-y-1">
              <span className="text-[11px] md:text-xs font-bold text-stone-500 dark:text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                <span>Nom complet</span>
              </span>
              <span className="text-xs md:text-sm font-semibold text-stone-900 dark:text-white block">{name}</span>
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white dark:bg-[#1e293b] border border-stone-200 dark:border-[#334155] flex items-center justify-center text-stone-600 dark:text-white group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>

          {/* Field 2 & 3: Adapté selon Étudiant ou Non-Étudiant */}
          {isStudent ? (
            <>
              {/* Field 2 Étudiant: School */}
              <div
                onClick={() => openEditModal('school')}
                className="group p-3 md:p-4 bg-stone-50 dark:bg-[#0b0f19] hover:bg-orange-50/50 dark:hover:bg-[#162033] border border-stone-200 dark:border-[#1e293b] rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
              >
                <div className="space-y-0.5 md:space-y-1">
                  <span className="text-[11px] md:text-xs font-bold text-stone-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                    <span>Établissement / Université</span>
                  </span>
                  <span className="text-xs md:text-sm font-semibold text-stone-900 dark:text-white block">{school}</span>
                </div>
                <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white dark:bg-[#1e293b] border border-stone-200 dark:border-[#334155] flex items-center justify-center text-stone-600 dark:text-white group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
                  <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </div>
              </div>

              {/* Field 3 Étudiant: Filiere */}
              <div
                onClick={() => openEditModal('filiere')}
                className="group p-3 md:p-4 bg-stone-50 dark:bg-[#0b0f19] hover:bg-orange-50/50 dark:hover:bg-[#162033] border border-stone-200 dark:border-[#1e293b] rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
              >
                <div className="space-y-0.5 md:space-y-1">
                  <span className="text-[11px] md:text-xs font-bold text-stone-500 dark:text-slate-400 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                    <span>Filière / Spécialité</span>
                  </span>
                  <span className="text-xs md:text-sm font-semibold text-stone-900 dark:text-white block">{filiere}</span>
                </div>
                <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white dark:bg-[#1e293b] border border-stone-200 dark:border-[#334155] flex items-center justify-center text-stone-600 dark:text-white group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
                  <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Field 2 Non-Étudiant: Profession avec logo adapté (Briefcase) sans doublon */}
              <div
                onClick={() => openEditModal('filiere')}
                className="group p-3 md:p-4 bg-stone-50 dark:bg-[#0b0f19] hover:bg-orange-50/50 dark:hover:bg-[#162033] border border-stone-200 dark:border-[#1e293b] rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
              >
                <div className="space-y-0.5 md:space-y-1">
                  <span className="text-[11px] md:text-xs font-bold text-stone-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                    <span>Profession ou domaine d'activité</span>
                  </span>
                  <span className="text-xs md:text-sm font-semibold text-stone-900 dark:text-white block">{domainName || "Professionnel"}</span>
                </div>
                <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white dark:bg-[#1e293b] border border-stone-200 dark:border-[#334155] flex items-center justify-center text-stone-600 dark:text-white group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
                  <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </div>
              </div>

              {/* Field 3 Non-Étudiant: Statut profil */}
              <div className="p-3 md:p-4 bg-stone-50/60 dark:bg-[#0b0f19] border border-stone-200 dark:border-[#1e293b] rounded-xl md:rounded-2xl flex items-center justify-between text-left">
                <div className="space-y-0.5 md:space-y-1">
                  <span className="text-[11px] md:text-xs font-bold text-stone-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                    <span>Statut du profil</span>
                  </span>
                  <span className="text-xs md:text-sm font-semibold text-stone-900 dark:text-white block">Profil Professionnel / Non-étudiant</span>
                </div>
              </div>
            </>
          )}

          {/* Field 4: Email */}
          <div
            onClick={() => openEditModal('email')}
            className="group p-3 md:p-4 bg-stone-50 dark:bg-[#0b0f19] hover:bg-orange-50/50 dark:hover:bg-[#162033] border border-stone-200 dark:border-[#1e293b] rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5 md:space-y-1">
              <span className="text-[11px] md:text-xs font-bold text-stone-500 dark:text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                <span>Adresse email</span>
              </span>
              <span className="text-xs md:text-sm font-semibold text-stone-900 dark:text-white block">{email}</span>
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white dark:bg-[#1e293b] border border-stone-200 dark:border-[#334155] flex items-center justify-center text-stone-600 dark:text-white group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>

          {/* Field 5: Country */}
          <div
            onClick={() => openEditModal('country')}
            className="group p-3 md:p-4 bg-stone-50 dark:bg-[#0b0f19] hover:bg-orange-50/50 dark:hover:bg-[#162033] border border-stone-200 dark:border-[#1e293b] rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5 md:space-y-1">
              <span className="text-[11px] md:text-xs font-bold text-stone-500 dark:text-slate-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                <span>Pays de résidence</span>
              </span>
              <span className="text-xs md:text-sm font-semibold text-stone-900 dark:text-white block">{country}</span>
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white dark:bg-[#1e293b] border border-stone-200 dark:border-[#334155] flex items-center justify-center text-stone-600 dark:text-white group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>
        </div>

        {/* Additional Actions */}
        <div className="space-y-2.5 md:space-y-4">
          <button
            onClick={() => setShowTermsModal(true)}
            className="w-full flex items-center justify-between p-3.5 md:p-5 bg-white dark:bg-[#111a2e] hover:bg-stone-50 dark:hover:bg-[#162033] border border-stone-200 dark:border-[#1e293b] rounded-xl md:rounded-2xl text-stone-800 dark:text-white font-semibold text-xs md:text-sm transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 md:gap-3">
              <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-stone-600 dark:text-slate-300" />
              <span>Conditions d'utilisation</span>
            </div>
            <span className="text-stone-400 dark:text-slate-400 text-xs md:text-sm">→</span>
          </button>
        </div>

        {/* Actions : Déconnexion et Suppression de compte */}
        <div className="pt-4 md:pt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex-1 flex items-center justify-center gap-2 md:gap-3 py-3.5 md:py-4 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl border border-stone-300 dark:border-stone-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5 text-stone-500 dark:text-stone-400" />
            <span>Se déconnecter</span>
          </button>

          <button
            onClick={() => {
              setConfirmEmailInput('');
              setConfirmNameInput('');
              setShowDeleteAccountModal(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 md:gap-3 py-3.5 md:py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs md:text-sm rounded-xl md:rounded-2xl shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
            <span>Supprimer le compte</span>
          </button>
        </div>
      </div>

      {/* Edit Field Modal / Popup */}
      {editingField && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111a2e] border border-stone-300 dark:border-[#334155] rounded-2xl md:rounded-3xl p-6 md:p-8 w-full max-w-md md:max-w-2xl shadow-2xl space-y-4 md:space-y-6 text-left">
            <div className="flex items-center justify-between pb-3 md:pb-4 border-b border-stone-100 dark:border-[#1e293b]">
              <h3 className="font-bold text-sm md:text-xl text-stone-900 dark:text-white">
                Modifier : {getFieldTitle(editingField)}
              </h3>
              <button
                onClick={() => setEditingField(null)}
                className="p-1 hover:bg-stone-100 dark:hover:bg-[#1e293b] rounded-lg text-stone-500 dark:text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 md:space-y-3">
              <label className="text-xs md:text-sm font-bold text-stone-700 dark:text-slate-200">
                Nouvelle valeur :
              </label>
              <input
                type={editingField === 'email' ? 'email' : 'text'}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                autoFocus
                className="w-full bg-stone-50 dark:bg-[#070a13] border border-stone-300 dark:border-[#334155] rounded-xl md:rounded-2xl px-3.5 md:px-5 py-2.5 md:py-4 text-xs md:text-base text-stone-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div className="flex gap-2.5 md:gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="flex-1 py-2.5 md:py-3.5 px-4 bg-stone-100 dark:bg-[#1e293b] hover:bg-stone-200 dark:hover:bg-[#283852] text-stone-700 dark:text-slate-200 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveField}
                disabled={!isModified}
                className="flex-1 py-2.5 md:py-3.5 px-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs md:text-sm rounded-xl md:rounded-2xl shadow-xs transition-all cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Use Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111a2e] border border-stone-300 dark:border-[#334155] rounded-2xl md:rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-[#1e293b]">
              <h3 className="font-bold text-base md:text-lg text-stone-900 dark:text-white">
                Conditions d'utilisation
              </h3>
              <button
                onClick={() => setShowTermsModal(false)}
                className="p-1 hover:bg-stone-100 dark:hover:bg-[#1e293b] rounded-lg text-stone-500 dark:text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs md:text-sm text-stone-600 dark:text-slate-300 space-y-3 max-h-80 overflow-y-auto pr-1">
              <p>
                Bienvenue sur <strong>StudyCloud</strong>. En utilisant cette application, vous acceptez de respecter les présentes conditions.
              </p>
              <p>
                <strong>1. Protection des données personnelles :</strong> Vos documents, notes, cours et informations personnelles sont stockés de manière sécurisée et isolée sur votre compte.
              </p>
              <p>
                <strong>2. Partage responsable :</strong> Tout document partagé publiquement doit respecter les droits d'auteur et les règles académiques en vigueur.
              </p>
              <p>
                <strong>3. Propriété intellectuelle :</strong> StudyCloud est développé et maintenu par <strong>DKD TECHNOLOGIES</strong>.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs md:text-sm rounded-xl transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmation de Déconnexion */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#FDFBF7] dark:bg-[#111a2e] border-2 border-stone-800 dark:border-stone-700 rounded-2xl md:rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-[6px_6px_0px_0px_#1c1917] space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/40 border-2 border-stone-800 dark:border-stone-700 flex items-center justify-center mx-auto text-orange-600">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base md:text-lg text-stone-900 dark:text-white">
              Déconnexion
            </h3>
            <p className="text-xs md:text-sm text-stone-600 dark:text-stone-300 font-medium">
              Êtes-vous sûr de vouloir vous déconnecter de votre compte StudyCloud ?
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 px-4 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 font-bold text-xs md:text-sm rounded-xl border border-stone-300 dark:border-stone-600 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 py-3 px-4 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs md:text-sm rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Suppression Définitive du Compte */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-[#FDFBF7] dark:bg-[#111a2e] border-3 border-red-600 rounded-2xl md:rounded-3xl p-5 md:p-8 w-full max-w-md md:max-w-lg shadow-[8px_8px_0px_0px_#1c1917] space-y-4 md:space-y-5 text-left my-auto">
            {/* En-tête */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-2.5 text-red-600">
                <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 shrink-0" />
                <h3 className="font-extrabold text-base md:text-xl text-stone-900 dark:text-white">
                  Supprimer définitivement le compte
                </h3>
              </div>
              <button
                onClick={() => setShowDeleteAccountModal(false)}
                className="p-1.5 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-lg text-stone-700 dark:text-stone-300"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            {/* Avertissement majeur */}
            <div className="p-3.5 md:p-4 bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-900/60 rounded-xl md:rounded-2xl text-xs md:text-sm text-red-900 dark:text-red-200 space-y-1.5 leading-relaxed font-medium">
              <p className="font-extrabold text-red-700 dark:text-red-400">
                ⚠️ Cette action est irréversible !
              </p>
              <p>
                Si vous supprimez votre compte, <strong>toutes vos données, fichiers enregistrés, cours, plannings, notes et tout enregistrement seront supprimés : suppression définitive.</strong>
              </p>
            </div>

            {/* Champ 1 : Adresse Email */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  1. Votre adresse email :
                </label>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 dark:bg-orange-950/30 px-2 py-1 rounded-md border border-orange-200 transition-colors cursor-pointer"
                >
                  {emailCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{emailCopied ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
              <div className="text-xs font-semibold text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800/60 px-3 py-1.5 rounded-lg select-all truncate border border-stone-200 dark:border-stone-700">
                {email}
              </div>
              <input
                type="email"
                value={confirmEmailInput}
                onChange={(e) => setConfirmEmailInput(e.target.value)}
                placeholder="Collez ou saisissez votre adresse email..."
                className="w-full bg-white dark:bg-[#070a13] border-2 border-stone-800 dark:border-stone-700 rounded-xl p-3 text-xs md:text-sm text-stone-900 dark:text-white outline-none focus:border-red-500 shadow-[2px_2px_0px_0px_#1c1917]"
              />
            </div>

            {/* Champ 2 : Nom de Profil */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  2. Votre nom de profil :
                </label>
                <button
                  type="button"
                  onClick={handleCopyName}
                  className="flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 dark:bg-orange-950/30 px-2 py-1 rounded-md border border-orange-200 transition-colors cursor-pointer"
                >
                  {nameCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{nameCopied ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
              <div className="text-xs font-semibold text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800/60 px-3 py-1.5 rounded-lg select-all truncate border border-stone-200 dark:border-stone-700">
                {name}
              </div>
              <input
                type="text"
                value={confirmNameInput}
                onChange={(e) => setConfirmNameInput(e.target.value)}
                placeholder="Collez ou saisissez votre nom de profil..."
                className="w-full bg-white dark:bg-[#070a13] border-2 border-stone-800 dark:border-stone-700 rounded-xl p-3 text-xs md:text-sm text-stone-900 dark:text-white outline-none focus:border-red-500 shadow-[2px_2px_0px_0px_#1c1917]"
              />
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(false)}
                disabled={isDeleting}
                className="flex-1 py-3 md:py-3.5 px-4 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 font-bold text-xs md:text-sm rounded-xl border border-stone-300 dark:border-stone-700 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={!isDeleteAllowed || isDeleting}
                className="flex-1 py-3 md:py-3.5 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs md:text-sm rounded-xl border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer le compte</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

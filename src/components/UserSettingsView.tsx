import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserSettingsViewProps {
  onBack: () => void;
}

export const UserSettingsView: React.FC<UserSettingsViewProps> = ({ onBack }) => {
  const { logout } = useAuth();

  const [name, setName] = useState(() => localStorage.getItem('unifolder_user_name') || 'Alexandre Kouassi');
  const [school, setSchool] = useState(() => localStorage.getItem('unifolder_user_school') || 'CME');
  const [filiere, setFiliere] = useState(() => localStorage.getItem('unifolder_user_filiere') || 'Électrotechniques');
  const [email, setEmail] = useState(() => localStorage.getItem('unifolder_user_email') || 'delmaskouassidibi@gmail.com');
  const [country, setCountry] = useState(() => localStorage.getItem('unifolder_user_country') || "Côte d'Ivoire");

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

    setEditingField(null);
    triggerToast("Modifications enregistrées avec succès !");
  };

  const handleLogout = () => {
    if (window.confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
      logout();
      triggerToast("Vous avez été déconnecté avec succès.");
      onBack();
    }
  };

  const isModified = editingField ? tempValue.trim() !== getOriginalValue(editingField) && tempValue.trim().length > 0 : false;

  const getFieldTitle = (field: string | null) => {
    switch (field) {
      case 'name': return "Nom de l'utilisateur";
      case 'school': return "École / Université";
      case 'filiere': return "Filière / Spécialité";
      case 'email': return "Adresse email";
      case 'country': return "Pays de résidence / établissement";
      default: return "";
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#FDFBF7] text-stone-900 overflow-y-auto animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="sticky top-0 z-10 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-stone-200 px-4 md:px-8 py-3.5 md:py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 md:p-2 hover:bg-stone-200/60 rounded-xl text-stone-700 transition-colors cursor-pointer"
          title="Retour"
        >
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
        </button>
        <h1 className="text-base md:text-xl font-extrabold text-stone-900 tracking-tight">
          Paramètres du Profil
        </h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6 md:space-y-8 text-center pb-24 md:pb-12">
        {/* Profile Card Header */}
        <div className="flex flex-col items-center justify-center space-y-3 md:space-y-4 pt-2">
          <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-orange-100 border-3 border-stone-800 flex items-center justify-center text-orange-600 shadow-[3px_3px_0px_0px_#1c1917] overflow-hidden">
            <User className="w-10 h-10 md:w-14 md:h-14" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-stone-900">{name}</h2>
            <p className="text-xs md:text-sm text-stone-500 font-medium">{email}</p>
          </div>
        </div>

        {/* Profile Information Fields */}
        <div className="bg-white border border-stone-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xs space-y-3 md:space-y-4">
          <h3 className="text-xs md:text-sm font-extrabold text-stone-900 text-left border-b border-stone-100 pb-2">
            Informations personnelles
          </h3>

          {/* Field 1: Name */}
          <div
            onClick={() => openEditModal('name')}
            className="group p-3 md:p-4 bg-stone-50 hover:bg-orange-50/50 border border-stone-200 rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5 md:space-y-1">
              <span className="text-[11px] md:text-xs font-bold text-stone-500 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                <span>Nom complet</span>
              </span>
              <span className="text-xs md:text-sm font-semibold text-stone-900 block">{name}</span>
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>

          {/* Field 2: School */}
          <div
            onClick={() => openEditModal('school')}
            className="group p-3 md:p-4 bg-stone-50 hover:bg-orange-50/50 border border-stone-200 rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5 md:space-y-1">
              <span className="text-[11px] md:text-xs font-bold text-stone-500 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                <span>Établissement / Organisation</span>
              </span>
              <span className="text-xs md:text-sm font-semibold text-stone-900 block">{school}</span>
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>

          {/* Field 3: Filiere */}
          <div
            onClick={() => openEditModal('filiere')}
            className="group p-3 md:p-4 bg-stone-50 hover:bg-orange-50/50 border border-stone-200 rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5 md:space-y-1">
              <span className="text-[11px] md:text-xs font-bold text-stone-500 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                <span>Filière / Spécialité</span>
              </span>
              <span className="text-xs md:text-sm font-semibold text-stone-900 block">{filiere}</span>
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>

          {/* Field 4: Email */}
          <div
            onClick={() => openEditModal('email')}
            className="group p-3 md:p-4 bg-stone-50 hover:bg-orange-50/50 border border-stone-200 rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5 md:space-y-1">
              <span className="text-[11px] md:text-xs font-bold text-stone-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                <span>Adresse email</span>
              </span>
              <span className="text-xs md:text-sm font-semibold text-stone-900 block">{email}</span>
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>

          {/* Field 5: Country */}
          <div
            onClick={() => openEditModal('country')}
            className="group p-3 md:p-4 bg-stone-50 hover:bg-orange-50/50 border border-stone-200 rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5 md:space-y-1">
              <span className="text-[11px] md:text-xs font-bold text-stone-500 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
                <span>Pays de résidence</span>
              </span>
              <span className="text-xs md:text-sm font-semibold text-stone-900 block">{country}</span>
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>
        </div>

        {/* Additional Actions */}
        <div className="space-y-2.5 md:space-y-4">
          <button
            onClick={() => setShowTermsModal(true)}
            className="w-full flex items-center justify-between p-3.5 md:p-5 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl md:rounded-2xl text-stone-800 font-semibold text-xs md:text-sm transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 md:gap-3">
              <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-stone-600" />
              <span>Conditions d'utilisation</span>
            </div>
            <span className="text-stone-400 text-xs md:text-sm">→</span>
          </button>
        </div>

        {/* Logout Button */}
        <div className="pt-4 md:pt-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 md:gap-3 py-3.5 md:py-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl border border-red-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>

      {/* Edit Field Modal / Popup */}
      {editingField && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-stone-300 rounded-2xl md:rounded-3xl p-6 md:p-8 w-full max-w-md md:max-w-2xl shadow-xl space-y-4 md:space-y-6 text-left">
            <div className="flex items-center justify-between pb-3 md:pb-4 border-b border-stone-100">
              <h3 className="font-bold text-sm md:text-xl text-stone-900">
                Modifier : {getFieldTitle(editingField)}
              </h3>
              <button
                onClick={() => setEditingField(null)}
                className="p-1 hover:bg-stone-100 rounded-lg text-stone-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 md:space-y-3">
              <label className="text-xs md:text-sm font-bold text-stone-700">
                Nouvelle valeur :
              </label>
              <input
                type={editingField === 'email' ? 'email' : 'text'}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                autoFocus
                className="w-full bg-stone-50 border border-stone-300 rounded-xl md:rounded-2xl px-3.5 md:px-5 py-2.5 md:py-4 text-xs md:text-base text-stone-900 focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div className="flex gap-2.5 md:gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="flex-1 py-2.5 md:py-3.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-stone-300 rounded-2xl md:rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-base md:text-lg text-stone-900">
                Conditions d'utilisation
              </h3>
              <button
                onClick={() => setShowTermsModal(false)}
                className="p-1 hover:bg-stone-100 rounded-lg text-stone-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs md:text-sm text-stone-600 space-y-3 max-h-80 overflow-y-auto pr-1">
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
    </div>
  );
};

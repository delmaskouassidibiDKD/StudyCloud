import React, { useState } from 'react';
import { ArrowLeft, User, GraduationCap, Mail, BookOpen, ShieldCheck, LogOut, Check, Edit2, X, Home } from 'lucide-react';

interface UserSettingsViewProps {
  onBack: () => void;
}

export const UserSettingsView: React.FC<UserSettingsViewProps> = ({ onBack }) => {
  const [name, setName] = useState(() => localStorage.getItem('unifolder_user_name') || 'Alexandre Kouassi');
  const [school, setSchool] = useState(() => localStorage.getItem('unifolder_user_school') || 'CME');
  const [filiere, setFiliere] = useState(() => localStorage.getItem('unifolder_user_filiere') || 'Électrotechniques');
  const [email, setEmail] = useState(() => localStorage.getItem('unifolder_user_email') || 'delmaskouassidibi@gmail.com');
  
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit modal state
  const [editingField, setEditingField] = useState<'name' | 'school' | 'filiere' | 'email' | null>(null);
  const [tempValue, setTempValue] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const getOriginalValue = (field: 'name' | 'school' | 'filiere' | 'email') => {
    if (field === 'name') return name;
    if (field === 'school') return school;
    if (field === 'filiere') return filiere;
    return email;
  };

  const openEditModal = (field: 'name' | 'school' | 'filiere' | 'email') => {
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
    }

    setEditingField(null);
    triggerToast("Modifications enregistrées avec succès !");
  };

  const handleLogout = () => {
    if (window.confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
      localStorage.removeItem('unifolder_user_name');
      localStorage.removeItem('unifolder_user_school');
      localStorage.removeItem('unifolder_user_filiere');
      localStorage.removeItem('unifolder_user_email');
      alert("Vous avez été déconnecté avec succès.");
      window.location.reload();
    }
  };

  const isModified = editingField ? tempValue.trim() !== getOriginalValue(editingField) && tempValue.trim().length > 0 : false;

  const getFieldTitle = (field: string | null) => {
    switch (field) {
      case 'name': return "Nom de l'utilisateur";
      case 'school': return "École / Université";
      case 'filiere': return "Filière / Spécialité";
      case 'email': return "Adresse email";
      default: return "";
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-30 w-full bg-[#FDFBF7] text-stone-900 overflow-y-auto animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sticky Top Bar with Back Button */}
      <div className="sticky top-0 left-0 right-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-xs px-4 py-2 flex items-center justify-between border-b border-stone-200/60">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFBF7] hover:bg-stone-100 text-stone-900 font-bold text-xs rounded-xl border border-stone-300 transition-all cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>
        <h2 className="font-serif font-bold text-base text-stone-900">Paramètres</h2>
        <div className="w-16"></div>
      </div>

      <div className="w-full max-w-md mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center space-y-2 pt-2">
          <div className="w-20 h-20 rounded-full bg-orange-100 border border-stone-300 flex items-center justify-center text-orange-600 overflow-hidden shadow-sm">
            <User className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-lg text-stone-900">{name}</h3>
            <p className="text-xs text-stone-500 font-medium flex items-center justify-center gap-1">
              <Mail className="w-3.5 h-3.5 text-stone-400" />
              <span>{email}</span>
            </p>
            <p className="text-xs text-stone-600 font-medium flex items-center justify-center gap-1 pt-0.5">
              <Home className="w-3.5 h-3.5 text-orange-600" />
              <span>{school}</span>
            </p>
            <p className="text-xs text-stone-600 font-medium flex items-center justify-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-orange-600" />
              <span>{filiere}</span>
            </p>
          </div>
        </div>

        {/* Form Fields Section (Clickable to edit individually) */}
        <div className="space-y-4 bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
          <h4 className="font-bold text-sm text-stone-900 mb-1 pb-2 border-b border-stone-100 flex items-center gap-2">
            <User className="w-4 h-4 text-orange-600" />
            <span>Informations personnelles</span>
          </h4>

          {/* Field 1: Name */}
          <div 
            onClick={() => openEditModal('name')}
            className="group p-3 bg-stone-50 hover:bg-orange-50/50 border border-stone-200 rounded-xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-stone-500 block">Nom de l'utilisateur</span>
              <span className="text-xs font-semibold text-stone-900 block">{name}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Field 2: School */}
          <div 
            onClick={() => openEditModal('school')}
            className="group p-3 bg-stone-50 hover:bg-orange-50/50 border border-stone-200 rounded-xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
                <Home className="w-3.5 h-3.5 text-orange-600" />
                <span>École / Université</span>
              </span>
              <span className="text-xs font-semibold text-stone-900 block">{school}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Field 3: Filiere */}
          <div 
            onClick={() => openEditModal('filiere')}
            className="group p-3 bg-stone-50 hover:bg-orange-50/50 border border-stone-200 rounded-xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-orange-600" />
                <span>Filière / Spécialité</span>
              </span>
              <span className="text-xs font-semibold text-stone-900 block">{filiere}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Field 4: Email */}
          <div 
            onClick={() => openEditModal('email')}
            className="group p-3 bg-stone-50 hover:bg-orange-50/50 border border-stone-200 rounded-xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-orange-600" />
                <span>Adresse email</span>
              </span>
              <span className="text-xs font-semibold text-stone-900 block">{email}</span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-600 group-hover:bg-orange-600 group-hover:text-white group-hover:border-orange-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* Additional Actions */}
        <div className="space-y-2.5">
          <button
            onClick={() => setShowTermsModal(true)}
            className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-semibold text-xs transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-stone-600" />
              <span>Conditions d'utilisation</span>
            </div>
            <span className="text-stone-400 text-xs">→</span>
          </button>
        </div>

        {/* Bottom Logout Button */}
        <div className="pt-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>

      {/* Edit Field Modal / Popup */}
      {editingField && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-stone-300 rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-sm text-stone-900">
                Modifier : {getFieldTitle(editingField)}
              </h3>
              <button
                onClick={() => setEditingField(null)}
                className="p-1 hover:bg-stone-100 rounded-lg text-stone-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700">
                Nouvelle valeur :
              </label>
              <input
                type={editingField === 'email' ? 'email' : 'text'}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                autoFocus
                className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveField}
                disabled={!isModified}
                className={`flex-1 py-2.5 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  isModified
                    ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer shadow-sm'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-stone-300 rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-bold text-sm text-stone-900">Conditions d'utilisation</h3>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-stone-500 hover:text-stone-900 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="text-xs text-stone-600 space-y-2 leading-relaxed max-h-60 overflow-y-auto pr-1">
              <p>Bienvenue sur UniFolder. En utilisant notre plateforme de partage de documents et de dossiers universitaires, vous acceptez les présentes conditions générales d'utilisation.</p>
              <p>1. Les utilisateurs s'engagent à partager uniquement des contenus pédagogiques légaux et respectueux des droits d'auteur.</p>
              <p>2. UniFolder protège la confidentialité de vos données académiques et personnelles.</p>
              <p>3. L'utilisation abusive de la plateforme pourra entraîner la suspension du compte.</p>
            </div>
            <button
              onClick={() => setShowTermsModal(false)}
              className="w-full py-2.5 bg-stone-900 text-white font-bold text-xs rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

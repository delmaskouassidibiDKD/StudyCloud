import React, { useState } from 'react';
import { ArrowLeft, User, GraduationCap, Mail, BookOpen, ShieldCheck, LogOut, Check, Edit2, X, Home, Cloud, Database, RefreshCw, CheckCircle2, AlertCircle, Loader2, Server } from 'lucide-react';
import { StudyCloudAPI, getWorkerApiUrl, setWorkerApiUrl } from '../services/api';

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

  // Cloud & Worker state
  const [workerUrl, setWorkerUrl] = useState(() => getWorkerApiUrl());
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(() => localStorage.getItem('studycloud_last_sync') || '');

  // Edit modal state
  const [editingField, setEditingField] = useState<'name' | 'school' | 'filiere' | 'email' | null>(null);
  const [tempValue, setTempValue] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleTestConnection = async () => {
    setCloudStatus('checking');
    try {
      setWorkerApiUrl(workerUrl);
      const res = await StudyCloudAPI.checkHealth();
      if (res && res.success) {
        setCloudStatus('connected');
        triggerToast("Connexion au Cloudflare Worker réussie !");
      } else {
        setCloudStatus('error');
        triggerToast("Le Worker a répondu mais le statut est invalide.");
      }
    } catch (e: any) {
      setCloudStatus('error');
      triggerToast("Impossible de joindre le Worker. Vérifiez l'URL.");
    }
  };

  const handleSyncToCloud = async () => {
    setIsSyncing(true);
    try {
      setWorkerApiUrl(workerUrl);
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      const matieres = JSON.parse(localStorage.getItem('unifolder_saved_matieres') || '[]');
      const notes = JSON.parse(localStorage.getItem('unifolder_keep_notes') || '[]');
      const scheduleSlots = JSON.parse(localStorage.getItem('user_schedule_data') || '[]');
      const scheduleConfig = {
        days: JSON.parse(localStorage.getItem('user_schedule_days') || '["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"]'),
        hours: JSON.parse(localStorage.getItem('user_schedule_hours') || '["08:00 - 10:00","10:00 - 12:00","14:00 - 16:00","16:00 - 18:00"]'),
        zoomLevel: Number(localStorage.getItem('user_schedule_zoom') || '100'),
      };
      const alarms = JSON.parse(localStorage.getItem('unifolder_alarms') || '[]');

      await StudyCloudAPI.backupCloud({
        userId,
        userProfile: { name, email, school, filiere },
        matieres,
        notes,
        scheduleSlots,
        scheduleConfig,
        alarms,
      });

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString();
      setLastSyncTime(nowStr);
      localStorage.setItem('studycloud_last_sync', nowStr);
      setCloudStatus('connected');
      triggerToast("Données sauvegardées sur Cloudflare D1 avec succès !");
    } catch (err: any) {
      setCloudStatus('error');
      triggerToast("Erreur lors de la sauvegarde Cloud : " + (err.message || 'Erreur réseau'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    if (!window.confirm("Voulez-vous restaurer vos données depuis le Cloud ? Cela mettra à jour vos données locales.")) return;
    setIsRestoring(true);
    try {
      setWorkerApiUrl(workerUrl);
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      const res = await StudyCloudAPI.restoreCloud(userId);
      if (res && res.data) {
        const d = res.data;
        if (d.user) {
          if (d.user.name) { setName(d.user.name); localStorage.setItem('unifolder_user_name', d.user.name); }
          if (d.user.school) { setSchool(d.user.school); localStorage.setItem('unifolder_user_school', d.user.school); }
          if (d.user.filiere) { setFiliere(d.user.filiere); localStorage.setItem('unifolder_user_filiere', d.user.filiere); }
          if (d.user.email) { setEmail(d.user.email); localStorage.setItem('unifolder_user_email', d.user.email); }
        }
        if (d.matieres && d.matieres.length > 0) {
          localStorage.setItem('unifolder_saved_matieres', JSON.stringify(d.matieres));
        }
        if (d.notes && d.notes.length > 0) {
          localStorage.setItem('unifolder_keep_notes', JSON.stringify(d.notes));
        }
        if (d.scheduleSlots && d.scheduleSlots.length > 0) {
          localStorage.setItem('user_schedule_data', JSON.stringify(d.scheduleSlots));
        }
        if (d.scheduleConfig) {
          if (d.scheduleConfig.days_json) localStorage.setItem('user_schedule_days', d.scheduleConfig.days_json);
          if (d.scheduleConfig.hours_json) localStorage.setItem('user_schedule_hours', d.scheduleConfig.hours_json);
          if (d.scheduleConfig.zoom_level) localStorage.setItem('user_schedule_zoom', String(d.scheduleConfig.zoom_level));
        }
        if (d.alarms && d.alarms.length > 0) {
          localStorage.setItem('unifolder_alarms', JSON.stringify(d.alarms));
        }
        window.dispatchEvent(new Event('unifolder_files_updated'));
        triggerToast("Restauration depuis le Cloud réussie !");
      }
    } catch (err: any) {
      triggerToast("Erreur lors de la restauration : " + (err.message || 'Erreur réseau'));
    } finally {
      setIsRestoring(false);
    }
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
    <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#FDFBF7] text-stone-900 overflow-y-auto animate-fadeIn">
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

      <div className="w-full max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-6 md:space-y-8 pb-24">
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center space-y-2 pt-2 md:pt-6">
          <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-orange-100 border border-stone-300 flex items-center justify-center text-orange-600 overflow-hidden shadow-sm mb-2 md:mb-4">
            <User className="w-10 h-10 md:w-14 md:h-14" />
          </div>
          <div className="space-y-1 md:space-y-2">
            <h3 className="font-extrabold text-lg md:text-2xl text-stone-900">{name}</h3>
            <p className="text-xs md:text-sm text-stone-500 font-medium flex items-center justify-center gap-1.5 md:gap-2">
              <Mail className="w-3.5 h-3.5 md:w-4 md:h-4 text-stone-400" />
              <span>{email}</span>
            </p>
            <p className="text-xs md:text-sm text-stone-600 font-medium flex items-center justify-center gap-1.5 md:gap-2 pt-0.5 md:pt-1">
              <Home className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
              <span>{school}</span>
            </p>
            <p className="text-xs md:text-sm text-stone-600 font-medium flex items-center justify-center gap-1.5 md:gap-2">
              <GraduationCap className="w-3.5 h-3.5 md:w-4 md:h-4 text-orange-600" />
              <span>{filiere}</span>
            </p>
          </div>
        </div>

        {/* Form Fields Section (Clickable to edit individually) */}
        <div className="space-y-4 md:space-y-6 bg-white border border-stone-200 rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-sm">
          <h4 className="font-bold text-sm md:text-lg text-stone-900 mb-1 md:mb-3 pb-2 border-b border-stone-100 flex items-center gap-2">
            <User className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
            <span>Informations personnelles</span>
          </h4>

          {/* Field 1: Name */}
          <div
            onClick={() => openEditModal('name')}
            className="group p-3 md:p-4 bg-stone-50 hover:bg-orange-50/50 border border-stone-200 rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center justify-between text-left"
          >
            <div className="space-y-0.5 md:space-y-1">
              <span className="text-[11px] md:text-xs font-bold text-stone-500 block">Nom de l'utilisateur</span>
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
                <span>École / Université</span>
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

        {/* Cloudflare Cloud & Database Synchronization */}
        <div className="p-4 md:p-6 bg-white border border-stone-200 rounded-xl md:rounded-2xl shadow-xs space-y-4 text-left">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs md:text-sm text-stone-900">Cloud & Base de Données</h4>
                <p className="text-[10px] md:text-xs text-stone-500">Cloudflare D1 (SQL) & R2 Storage</p>
              </div>
            </div>
            <div>
              {cloudStatus === 'connected' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] md:text-xs font-bold border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connecté</span>
                </span>
              )}
              {cloudStatus === 'error' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-[10px] md:text-xs font-bold border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Hors-ligne</span>
                </span>
              )}
              {cloudStatus === 'checking' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full text-[10px] md:text-xs font-bold border border-orange-200">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Test en cours...</span>
                </span>
              )}
              {cloudStatus === 'idle' && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 text-stone-600 rounded-full text-[10px] md:text-xs font-bold border border-stone-200">
                  <Server className="w-3.5 h-3.5" />
                  <span>Prêt</span>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] md:text-xs font-bold text-stone-600">
              Adresse API du Worker Cloudflare :
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={workerUrl}
                onChange={(e) => {
                  setWorkerUrl(e.target.value);
                  setWorkerApiUrl(e.target.value);
                }}
                placeholder="https://studycloud-worker.votre-compte.workers.dev"
                className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:border-orange-500 font-mono"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={cloudStatus === 'checking'}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {cloudStatus === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
                <span>Tester</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleSyncToCloud}
              disabled={isSyncing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Sauvegarder vers le Cloud</span>
            </button>
            <button
              type="button"
              onClick={handleRestoreFromCloud}
              disabled={isRestoring}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl border border-stone-200 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              <span>Restaurer depuis le Cloud</span>
            </button>
          </div>

          {lastSyncTime && (
            <p className="text-[10px] md:text-xs text-stone-400 text-center pt-1">
              Dernière sauvegarde Cloud : <span className="font-semibold text-stone-600">{lastSyncTime}</span>
            </p>
          )}
        </div>

        {/* Bottom Logout Button */}
        <div className="pt-6 md:pt-10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl border border-red-200 transition-colors cursor-pointer"
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

            <div className="flex items-center gap-2.5 md:gap-4 pt-2 md:pt-4">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="flex-1 py-2.5 md:py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveField}
                disabled={!isModified}
                className={`flex-1 py-2.5 md:py-3.5 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl transition-all flex items-center justify-center gap-1.5 md:gap-2 ${isModified
                    ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer shadow-sm'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
              >
                <Check className="w-3.5 h-3.5 md:w-5 md:h-5" />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border border-stone-300 rounded-2xl md:rounded-3xl p-6 md:p-8 w-full max-w-md md:max-w-2xl shadow-xl space-y-4 md:space-y-6 text-left">
            <div className="flex items-center justify-between pb-3 md:pb-4 border-b border-stone-100">
              <h3 className="font-bold text-sm md:text-xl text-stone-900">Conditions d'utilisation</h3>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-stone-500 hover:text-stone-900 text-sm md:text-base font-bold"
              >
                ✕
              </button>
            </div>
            <div className="text-xs md:text-sm text-stone-600 space-y-3 md:space-y-4 leading-relaxed max-h-60 overflow-y-auto pr-2">
              <p>Bienvenue sur StudyCloud. En utilisant notre plateforme de partage de documents et de dossiers universitaires, vous acceptez les présentes conditions générales d'utilisation.</p>
              <p>1. Les utilisateurs s'engagent à partager uniquement des contenus pédagogiques légaux et respectueux des droits d'auteur.</p>
              <p>2. StudyCloud protège la confidentialité de vos données académiques et personnelles.</p>
              <p>3. L'utilisation abusive de la plateforme pourra entraîner la suspension du compte.</p>
            </div>
            <button
              onClick={() => setShowTermsModal(false)}
              className="w-full py-2.5 md:py-3.5 bg-stone-900 text-white font-bold text-xs md:text-sm rounded-xl md:rounded-2xl hover:bg-stone-800 transition-colors cursor-pointer mt-2 md:mt-4"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

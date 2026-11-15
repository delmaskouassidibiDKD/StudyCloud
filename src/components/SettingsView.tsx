import React, { useState, useEffect } from 'react';
import { User, Share2, Crown, Settings as SettingsIcon, GraduationCap, Mail, Bell, Headphones, MessageCircle, PlusCircle, Users, AlertTriangle, X, Check, BookOpen, Home, Youtube, LogOut, Camera, Briefcase, Building2, Scale } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PromotionView } from './PromotionView';
import { SettingsPricingView } from './SettingsPricingView';
import { NotificationsView } from './NotificationsView';
import { UserSettingsView } from './UserSettingsView';
import { ServiceProposalView } from './ServiceProposalView';
import { getLegalPortalUrl } from '../services/api';
import studentLogo from '../assets/student-logo.jpg';
import proLogo from '../assets/pro-logo.jpg';
import { useBackHandler } from '../services/backNavigation';
import { isWallpaperAvatarPollution } from '../utils/wallpaperHelper';

export const SettingsView: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeSubView, setActiveSubView] = useState<'none' | 'promotion' | 'pricing' | 'notifications' | 'user-settings' | 'service'>(() => {
    try {
      const saved = localStorage.getItem('studycloud_settings_subview') || localStorage.getItem('studycloud_open_subview');
      if (saved && ['promotion', 'pricing', 'notifications', 'user-settings', 'service'].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return 'none';
  });

  useEffect(() => {
    try {
      if (activeSubView && activeSubView !== 'none') {
        localStorage.setItem('studycloud_settings_subview', activeSubView);
      } else {
        localStorage.removeItem('studycloud_settings_subview');
        localStorage.removeItem('studycloud_open_subview');
      }
    } catch {}
  }, [activeSubView]);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // Gestion du bouton matériel / virtuel retour d'Android
  useBackHandler(activeSubView !== 'none', () => setActiveSubView('none'), 'settings-subview');
  useBackHandler(showReportModal, () => setShowReportModal(false), 'settings-report-modal');
  useBackHandler(showContactMenu, () => setShowContactMenu(false), 'settings-contact-menu');

  if (activeSubView === 'promotion') {
    return <PromotionView onBack={() => setActiveSubView('none')} />;
  }

  if (activeSubView === 'pricing') {
    return <SettingsPricingView onBack={() => setActiveSubView('none')} onSelectPlan={(plan) => alert(`Plan ${plan} sélectionné`)} />;
  }

  if (activeSubView === 'notifications') {
    return <NotificationsView onBack={() => setActiveSubView('none')} />;
  }

  if (activeSubView === 'user-settings') {
    return <UserSettingsView onBack={() => setActiveSubView('none')} />;
  }

  if (activeSubView === 'service') {
    return <ServiceProposalView onBack={() => setActiveSubView('none')} />;
  }

  const handleJoinGroup = () => {
    setShowContactMenu(false);
    window.open('https://chat.whatsapp.com/IPOnCB9rJhn7JECrNY20Ea', '_blank');
  };

  const handleOpenReport = () => {
    setShowContactMenu(false);
    setReportText('');
    setReportSubmitted(false);
    setShowReportModal(true);
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) return;
    setReportSubmitted(true);
    setTimeout(() => {
      setShowReportModal(false);
      setReportSubmitted(false);
      setReportText('');
      alert("Votre signalement a bien été envoyé à notre équipe technique. Merci !");
    }, 1500);
  };

  const handleLogout = () => {
    if (window.confirm("Êtes-vous sûr de vouloir vous déconnecter de votre compte StudyCloud ?")) {
      logout();
    }
  };

  const userName = user?.name || localStorage.getItem('unifolder_user_name') || 'Alexandre Kouassi';
  const userSchool = user?.school || localStorage.getItem('unifolder_user_school') || 'CME';
  const userFiliere = user?.filiere || localStorage.getItem('unifolder_user_filiere') || 'Électrotechniques';
  const userEmail = user?.email || localStorage.getItem('unifolder_user_email') || 'delmaskouassidibi@gmail.com';

  // Récupérer uniquement la vraie photo de profil de la base de données (jamais le fond d'écran)
  const rawDbAvatar = user?.avatar_url && !isWallpaperAvatarPollution(user.avatar_url) ? user.avatar_url : '';
  const lsAvatarRaw = localStorage.getItem('unifolder_user_avatar') || '';
  const safeLsAvatar = !isWallpaperAvatarPollution(lsAvatarRaw) ? lsAvatarRaw : '';
  if (lsAvatarRaw && !safeLsAvatar) {
    try { localStorage.removeItem('unifolder_user_avatar'); } catch {}
  }
  const userAvatar = rawDbAvatar || safeLsAvatar || '';

  // Détection du statut étudiant ou profil standard / professionnel
  const isStudent = user?.is_student === 1 || 
                    (user?.is_student !== 0 && localStorage.getItem('unifolder_is_student') === 'true') ||
                    (user?.school && user.school !== 'Particulier / Professionnel' && user.school !== 'Professionnel / Particulier' && user.school !== user.filiere && user.level !== 'Professionnel');

  // Domaine ou profession nettoyé pour éviter tout doublon
  const domainName = user?.profession || 
                     localStorage.getItem('unifolder_user_profession') || 
                     (userFiliere && userFiliere !== 'Particulier / Professionnel' && userFiliere !== 'Professionnel / Particulier' && userFiliere !== 'Général' ? userFiliere : '') ||
                     (userSchool && userSchool !== 'Particulier / Professionnel' && userSchool !== 'Professionnel / Particulier' ? userSchool : '');

  // Choix du logo/avatar adapté : si l'utilisateur n'a pas mis de photo personnelle en BDD, afficher le logo générique
  const isCustomUploaded = Boolean(userAvatar && !userAvatar.startsWith('data:image/svg+xml'));
  const genericAvatar = !isStudent ? proLogo : studentLogo;
  const displayAvatar = isCustomUploaded ? userAvatar : genericAvatar;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-4 md:py-6 pb-28 sm:pb-32 md:pb-8 relative">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-8 items-start">
        {/* Colonne GAUCHE : Profil utilisateur (md: 5 cols, lg: 4 cols) */}
        <div className="md:col-span-5 lg:col-span-4 w-full md:sticky md:top-4">
          <div className="w-full bg-white/85 dark:bg-stone-900/85 backdrop-blur-md border-3 border-stone-800 dark:border-stone-700 rounded-3xl p-6 md:p-7 shadow-[5px_5px_0px_0px_#1c1917] dark:shadow-none flex flex-col items-center text-center space-y-3 transition-all">
            {/* Profile Photo Circle */}
            <div 
              onClick={() => setActiveSubView('user-settings')}
              title="Cliquer pour changer le logo ou modifier le profil"
              className="w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full bg-white border-3 border-stone-800 flex items-center justify-center text-orange-600 shadow-[4px_4px_0px_0px_#1c1917] overflow-hidden my-1 md:my-2 transition-all hover:scale-105 cursor-pointer relative group"
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={userName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const imgEl = e.currentTarget;
                    if (imgEl.src !== genericAvatar) {
                      imgEl.src = genericAvatar;
                    }
                  }}
                />
              ) : (
                <User className="w-12 h-12 md:w-16 md:h-16" />
              )}
              <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                <Camera className="w-6 h-6 drop-shadow" />
                <span className="text-[10px] font-extrabold mt-0.5">Modifier</span>
              </div>
            </div>

            {/* User Name & Profile Info */}
            <div className="space-y-1 md:space-y-1.5 w-full">
              <h2 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-stone-900 dark:text-white tracking-tight">{userName}</h2>
              
              {/* Email */}
              <div className="flex items-center justify-center gap-1.5 md:gap-2 text-stone-600 dark:text-stone-300 text-xs sm:text-sm font-medium">
                <Mail className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="truncate">{userEmail}</span>
              </div>

              {/* Profil Étudiant vs Profil Standard / Professionnel */}
              {isStudent ? (
                <>
                  {userSchool && (
                    <div className="flex items-center justify-center gap-1.5 md:gap-2 text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-semibold">
                      <Building2 className="w-4 h-4 text-orange-600 shrink-0" />
                      <span className="truncate">{userSchool}</span>
                    </div>
                  )}
                  {userFiliere && userFiliere !== userSchool && (
                    <div className="flex items-center justify-center gap-1.5 md:gap-2 text-stone-700 dark:text-stone-300 text-xs sm:text-sm font-semibold">
                      <GraduationCap className="w-4 h-4 text-orange-600 shrink-0" />
                      <span className="truncate">{userFiliere}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-1.5 md:gap-2 text-stone-800 dark:text-stone-200 text-xs sm:text-sm font-bold">
                    <Briefcase className="w-4 h-4 text-orange-600 shrink-0" />
                    <span className="truncate">{domainName || "Professionnel indépendant"}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 md:gap-2 text-stone-500 dark:text-stone-400 text-[11px] sm:text-xs font-medium">
                    <Building2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>Profil Professionnel / Non-étudiant</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Colonne DROITE : Boutons d'action (md: 7 cols, lg: 8 cols) */}
        <div className="md:col-span-7 lg:col-span-8 w-full">
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {/* 1. Tutoriels YouTube */}
            <a 
              href="https://www.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 bg-[#FDFBF7] dark:bg-stone-900/90 hover:bg-red-50 dark:hover:bg-red-950/30 border-2 border-stone-800 dark:border-stone-700 rounded-xl md:rounded-2xl py-3 px-3.5 sm:px-4 text-stone-900 dark:text-white font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
            >
              <Youtube className="w-5 h-5 text-red-600 shrink-0" />
              <span className="truncate">Tutoriels YouTube</span>
            </a>

            {/* 2. Partager StudyCloud */}
            <button 
              onClick={() => setActiveSubView('promotion')}
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 bg-[#FDFBF7] dark:bg-stone-900/90 hover:bg-orange-50 dark:hover:bg-orange-950/30 border-2 border-stone-800 dark:border-stone-700 rounded-xl md:rounded-2xl py-3 px-3.5 sm:px-4 text-stone-900 dark:text-white font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
            >
              <Share2 className="w-5 h-5 text-orange-600 shrink-0" />
              <span className="truncate">Partager StudyCloud</span>
            </button>

            {/* 3. Abonnement */}
            <button 
              onClick={() => setActiveSubView('pricing')}
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 bg-[#FDFBF7] dark:bg-stone-900/90 hover:bg-orange-50 dark:hover:bg-amber-950/30 border-2 border-stone-800 dark:border-stone-700 rounded-xl md:rounded-2xl py-3 px-3.5 sm:px-4 text-stone-900 dark:text-white font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
            >
              <Crown className="w-5 h-5 text-amber-600 shrink-0" />
              <span className="truncate">Abonnement</span>
            </button>

            {/* 4. Notifications */}
            <button 
              onClick={() => setActiveSubView('notifications')}
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 bg-[#FDFBF7] dark:bg-stone-900/90 hover:bg-orange-50 dark:hover:bg-orange-950/30 border-2 border-stone-800 dark:border-stone-700 rounded-xl md:rounded-2xl py-3 px-3.5 sm:px-4 text-stone-900 dark:text-white font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
            >
              <Bell className="w-5 h-5 text-orange-600 shrink-0" />
              <span className="truncate">Notifications</span>
            </button>

            {/* 5. Proposer un service */}
            <button 
              onClick={() => setActiveSubView('service')}
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 bg-[#FDFBF7] dark:bg-stone-900/90 hover:bg-orange-50 dark:hover:bg-purple-950/30 border-2 border-stone-800 dark:border-stone-700 rounded-xl md:rounded-2xl py-3 px-3.5 sm:px-4 text-stone-900 dark:text-white font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
            >
              <PlusCircle className="w-5 h-5 text-purple-600 shrink-0" />
              <span className="truncate">Proposer un service</span>
            </button>

            {/* 6. Service client officiel */}
            <a 
              href="https://t.me/+QtRhdlTsMHxjODk0"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 bg-[#FDFBF7] dark:bg-stone-900/90 hover:bg-orange-50 dark:hover:bg-emerald-950/30 border-2 border-stone-800 dark:border-stone-700 rounded-xl md:rounded-2xl py-3 px-3.5 sm:px-4 text-stone-900 dark:text-white font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
            >
              <Headphones className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="truncate">Service client officiel</span>
            </a>

            {/* 7. Nous contacter / signaler un problème */}
            <button 
              onClick={() => setShowContactMenu(!showContactMenu)}
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 bg-[#FDFBF7] dark:bg-stone-900/90 hover:bg-orange-50 dark:hover:bg-blue-950/30 border-2 border-stone-800 dark:border-stone-700 rounded-xl md:rounded-2xl py-3 px-3.5 sm:px-4 text-stone-900 dark:text-white font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
            >
              <MessageCircle className="w-5 h-5 text-blue-600 shrink-0" />
              <span className="truncate">Nous contacter / problème</span>
            </button>

            {/* 8. Paramètres du compte */}
            <button 
              onClick={() => setActiveSubView('user-settings')}
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 bg-[#FDFBF7] dark:bg-stone-900/90 hover:bg-orange-50 dark:hover:bg-stone-800 border-2 border-stone-800 dark:border-stone-700 rounded-xl md:rounded-2xl py-3 px-3.5 sm:px-4 text-stone-900 dark:text-white font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
            >
              <SettingsIcon className="w-5 h-5 text-stone-700 dark:text-stone-300 shrink-0" />
              <span className="truncate">Paramètres</span>
            </button>

            {/* 9. Conditions d'utilisation & Confidentialité */}
            <a
              href={getLegalPortalUrl('cgu')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 bg-[#FDFBF7] dark:bg-stone-900/90 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-2 border-stone-800 dark:border-stone-700 rounded-xl md:rounded-2xl py-3 px-3.5 sm:px-4 text-stone-900 dark:text-white font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
            >
              <Scale className="w-5 h-5 text-amber-700 shrink-0" />
              <span className="truncate">CGU & Confidentialité</span>
            </a>

            {/* 10. Bouton de déconnexion direct */}
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center sm:justify-start gap-2.5 sm:gap-3 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border-2 border-stone-800 dark:border-red-900/60 rounded-xl md:rounded-2xl py-3 px-3.5 sm:px-4 text-red-700 dark:text-red-400 font-bold text-xs sm:text-sm shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
            >
              <LogOut className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <span className="truncate">Se déconnecter</span>
            </button>
          </div>
        </div>
      </div>

      {/* Popup Menu for Contact / Report */}
      {showContactMenu && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-2xl md:rounded-3xl p-5 md:p-8 w-full max-w-xs md:max-w-md shadow-[6px_6px_0px_0px_#1c1917] space-y-3 md:space-y-5 relative text-left">
            <div className="flex items-center justify-between pb-2 md:pb-4 border-b-2 border-stone-200">
              <h3 className="font-extrabold text-sm md:text-lg text-stone-900">Aide & Support</h3>
              <button
                onClick={() => setShowContactMenu(false)}
                className="p-1 md:p-1.5 hover:bg-stone-200 rounded-lg text-stone-700 border border-stone-800 bg-white"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
            <div className="space-y-2.5 md:space-y-3.5 pt-1 md:pt-2">
              <button
                onClick={handleJoinGroup}
                className="w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <Users className="w-4 h-4 md:w-5 md:h-5 text-emerald-700 shrink-0" />
                <span>Rejoindre le groupe</span>
              </button>
              <button
                onClick={handleOpenReport}
                className="w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-orange-50 hover:bg-orange-100 text-orange-900 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-orange-700 shrink-0" />
                <span>Signaler un problème</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Problem Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl p-6 md:p-8 w-full max-w-sm md:max-w-lg shadow-[8px_8px_0px_0px_#1c1917] space-y-4 md:space-y-6 relative text-left">
            <div className="flex items-center justify-between pb-3 md:pb-5 border-b-2 border-stone-300">
              <h3 className="font-extrabold text-base md:text-xl text-stone-900">Signaler un problème</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 md:p-2 hover:bg-stone-200 rounded-lg text-stone-700 border-2 border-stone-800 bg-[#F5F1E9] shadow-[2px_2px_0px_0px_#1c1917]"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
            {reportSubmitted ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 border-2 border-stone-800 flex items-center justify-center text-emerald-700">
                  <Check className="w-6 h-6" />
                </div>
                <p className="font-extrabold text-stone-900 text-sm">Signalement envoyé avec succès !</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-3 md:space-y-5">
                <label className="block text-xs md:text-sm font-bold text-stone-700">
                  Décrivez le problème rencontré :
                </label>
                <textarea
                  rows={5}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Expliquez ce qui ne va pas..."
                  required
                  className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917] resize-none"
                />
                <button
                  type="submit"
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm md:text-base py-3 md:py-4 rounded-xl md:rounded-2xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5"
                >
                  Envoyer le signalement
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


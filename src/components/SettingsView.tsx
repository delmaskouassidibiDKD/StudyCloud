import React, { useState, useEffect } from 'react';
import { User, Share2, Crown, Settings as SettingsIcon, GraduationCap, Mail, Bell, Headphones, MessageCircle, PlusCircle, Users, AlertTriangle, X, Check, BookOpen, Home, Youtube } from 'lucide-react';
import { PromotionView } from './PromotionView';
import { SettingsPricingView } from './SettingsPricingView';
import { NotificationsView } from './NotificationsView';
import { UserSettingsView } from './UserSettingsView';
import { ServiceProposalView } from './ServiceProposalView';

export const SettingsView: React.FC = () => {
  const [activeSubView, setActiveSubView] = useState<'none' | 'promotion' | 'pricing' | 'notifications' | 'user-settings' | 'service'>('none');
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);

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

  const userName = localStorage.getItem('unifolder_user_name') || 'Alexandre Kouassi';
  const userSchool = localStorage.getItem('unifolder_user_school') || 'CME';
  const userFiliere = localStorage.getItem('unifolder_user_filiere') || 'Électrotechniques';
  const userEmail = localStorage.getItem('unifolder_user_email') || 'delmaskouassidibi@gmail.com';

  return (
    <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-8 py-6 md:py-10 flex flex-col items-center text-center space-y-6 md:space-y-8 relative">
      {/* Profile Photo Circle */}
      <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-orange-100 border-3 border-stone-800 flex items-center justify-center text-orange-600 shadow-[4px_4px_0px_0px_#1c1917] overflow-hidden my-2 md:my-4 transition-all">
        <User className="w-12 h-12 md:w-16 md:h-16" />
      </div>

      {/* User Name */}
      <div className="space-y-1 md:space-y-2">
        <h2 className="text-2xl md:text-3xl font-extrabold text-stone-900 tracking-tight">{userName}</h2>
        <div className="flex items-center justify-center gap-1.5 md:gap-2 mt-1 md:mt-2 text-stone-600 text-sm md:text-base font-medium">
          <Mail className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
          <span>{userEmail}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 md:gap-2 mt-1 md:mt-1.5 text-stone-600 text-sm md:text-base font-semibold">
          <Home className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
          <span>{userSchool}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 md:gap-2 mt-1 md:mt-1.5 text-stone-600 text-sm md:text-base font-semibold">
          <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />
          <span>{userFiliere}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full space-y-3 md:space-y-4 pt-2 md:pt-4">
        <a 
          href="https://www.youtube.com"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-3 bg-[#FDFBF7] hover:bg-red-50 border-2 border-stone-800 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-stone-900 font-bold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
        >
          <Youtube className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
          <span>Tutoriels YouTube - Comprendre StudyCloud</span>
        </a>

        <button 
          onClick={() => setActiveSubView('promotion')}
          className="w-full flex items-center justify-center gap-3 bg-[#FDFBF7] hover:bg-orange-50 border-2 border-stone-800 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-stone-900 font-bold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
        >
          <Share2 className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
          <span>Partager</span>
        </button>

        <button 
          onClick={() => setActiveSubView('pricing')}
          className="w-full flex items-center justify-center gap-3 bg-[#FDFBF7] hover:bg-orange-50 border-2 border-stone-800 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-stone-900 font-bold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
        >
          <Crown className="w-5 h-5 md:w-6 md:h-6 text-amber-600" />
          <span>Abonnement</span>
        </button>

        <button 
          onClick={() => setActiveSubView('notifications')}
          className="w-full flex items-center justify-center gap-3 bg-[#FDFBF7] hover:bg-orange-50 border-2 border-stone-800 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-stone-900 font-bold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
        >
          <Bell className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
          <span>Notifications</span>
        </button>

        <button 
          onClick={() => setActiveSubView('service')}
          className="w-full flex items-center justify-center gap-3 bg-[#FDFBF7] hover:bg-orange-50 border-2 border-stone-800 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-stone-900 font-bold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
        >
          <PlusCircle className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
          <span>Proposer un service</span>
        </button>

        <a 
          href="https://t.me/+QtRhdlTsMHxjODk0"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-3 bg-[#FDFBF7] hover:bg-orange-50 border-2 border-stone-800 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-stone-900 font-bold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
        >
          <Headphones className="w-5 h-5 md:w-6 md:h-6 text-emerald-600" />
          <span>Service client officiel</span>
        </a>

        <button 
          onClick={() => setShowContactMenu(!showContactMenu)}
          className="w-full flex items-center justify-center gap-3 bg-[#FDFBF7] hover:bg-orange-50 border-2 border-stone-800 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-stone-900 font-bold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
        >
          <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
          <span>Nous contacter / signaler un problème</span>
        </button>

        <button 
          onClick={() => setActiveSubView('user-settings')}
          className="w-full flex items-center justify-center gap-3 bg-[#FDFBF7] hover:bg-orange-50 border-2 border-stone-800 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 md:px-6 text-stone-900 font-bold text-sm md:text-base shadow-[3px_3px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917]"
        >
          <SettingsIcon className="w-5 h-5 md:w-6 md:h-6 text-stone-700" />
          <span>Paramètres</span>
        </button>
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


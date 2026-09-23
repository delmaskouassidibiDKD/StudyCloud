import React, { useState } from 'react';
import { ArrowLeft, Bell, FileText, Clock, ChevronDown, ChevronUp, Trash2, CheckCheck } from 'lucide-react';

interface NotificationsViewProps {
  onBack: () => void;
}

const INITIAL_NOTIFICATIONS = [
  {
    id: '1',
    time: 'Il y a 22 h',
    title: 'Confirmation de dépôt de document',
    description: 'Nous avons bien reçu votre document de cours RET-70B-313263535, qui a été partagé avec succès dans votre espace de travail. Nos équipes pédagogiques ont validé l\'indexation de l\'ensemble des fichiers et des métadonnées associées pour un traitement optimal.',
    item: 'Mathématiques Avancées • Chapitre 4 : Intégrales et Séries',
    unread: true,
  },
  {
    id: '2',
    time: 'Il y a 1 jour',
    title: 'Mise à jour de la demande de partage',
    description: 'Votre dossier partagé "Physique Quantique - TD" a atteint 15 téléchargements ! Vous bénéficiez de bonus de stockage supplémentaires sur votre compte ainsi que d\'un badge spécial de contributeur actif dans la communauté.',
    item: 'Physique Quantique • TD & Corrections',
    unread: false,
  },
  {
    id: '3',
    time: 'Il y a 2 jours',
    title: 'Bienvenue sur StudyCloud !',
    description: 'Merci d\'avoir créé votre compte. Explorez les fonctionnalités de gestion de dossiers, de partage sécurisé et de suivi de vos notes académiques pour booster votre réussite universitaire tout au long de l\'année.',
    item: 'Guide de démarrage rapide StudyCloud',
    unread: false,
  },
];

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onBack }) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('studycloud_user_notifications');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Erreur lecture notifications locales', e);
    }
    return INITIAL_NOTIFICATIONS;
  });

  const saveNotifications = (newList: typeof INITIAL_NOTIFICATIONS) => {
    setNotifications(newList);
    try {
      localStorage.setItem('studycloud_user_notifications', JSON.stringify(newList));
    } catch (e) {
      console.warn('Erreur sauvegarde notifications locales', e);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDeleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.filter((n: any) => n.id !== id);
    saveNotifications(updated);
  };

  const handleClearAll = () => {
    if (window.confirm('Voulez-vous vraiment effacer toutes vos notifications ?')) {
      saveNotifications([]);
    }
  };

  const handleMarkAllRead = () => {
    const updated = notifications.map((n: any) => ({ ...n, unread: false }));
    saveNotifications(updated);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#FDFBF7] dark:bg-[#0b0f19] text-stone-900 dark:text-white overflow-y-auto animate-fadeIn">
      {/* Sticky Top Bar with Back Button - Solid Dark #070a13 */}
      <div className="sticky top-0 left-0 right-0 z-40 bg-[#FDFBF7] dark:bg-[#070a13] px-4 py-2 flex items-center justify-between border-b border-stone-200/60 dark:border-[#1e293b]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFBF7] dark:bg-[#1e293b] hover:bg-orange-50 dark:hover:bg-[#283852] text-stone-900 dark:text-white font-bold text-xs rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4 text-stone-900 dark:text-white" />
          <span>Retour</span>
        </button>
        <h2 className="font-serif font-bold text-base text-stone-900 dark:text-white">Boîte de réception</h2>
        <div className="flex items-center gap-1.5">
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2.5 py-1 text-red-600 hover:bg-red-50 text-[11px] md:text-xs font-bold rounded-lg border border-red-200 transition-colors cursor-pointer"
              title="Effacer toutes les notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tout effacer</span>
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-6 md:py-10 space-y-4 md:space-y-6 pb-20">
        {notifications.length > 0 && (
          <div className="flex items-center justify-between px-1 text-xs text-stone-600">
            <span className="font-bold">{notifications.length} notification{notifications.length > 1 ? 's' : ''}</span>
            {notifications.some((n: any) => n.unread) && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-orange-600 hover:text-orange-700 font-bold cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tout marquer comme lu</span>
              </button>
            )}
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="bg-white border-2 border-stone-800 rounded-3xl p-8 text-center shadow-[3px_3px_0px_0px_#1c1917] space-y-3 my-8">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 border-2 border-stone-800 flex items-center justify-center text-orange-600 shadow-[2px_2px_0px_0px_#1c1917]">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="font-extrabold text-base text-stone-900">Aucune notification</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Vous êtes à jour ! Vos alertes de devoirs, partages de cours et messages apparaîtront ici.
            </p>
          </div>
        ) : (
          notifications.map((notif: any) => {
            const isExpanded = !!expandedIds[notif.id];
            const isLong = notif.description.length > 80;

            return (
              <div
                key={notif.id}
                className={`bg-white border-2 border-stone-800 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-[3px_3px_0px_0px_#1c1917] relative transition-all ${
                  notif.unread ? 'border-l-4 border-l-orange-600' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <span className="text-[11px] md:text-xs font-bold text-stone-500 flex items-center gap-1 md:gap-1.5">
                    <Clock className="w-3 h-3 md:w-4 md:h-4 text-orange-600" />
                    {notif.time}
                  </span>
                  <div className="flex items-center gap-2">
                    {notif.unread && (
                      <span className="bg-orange-100 text-orange-700 text-[10px] md:text-xs font-extrabold px-2 py-0.5 md:py-1 md:px-3 rounded-full border border-orange-300">
                        Nouveau
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer cette notification"
                    >
                      <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-extrabold text-sm md:text-lg text-stone-900 mb-1.5 md:mb-2">
                  {notif.title}
                </h3>

                <div className="mb-3 md:mb-5">
                  <p className={`text-xs md:text-sm text-stone-600 leading-relaxed ${!isExpanded && isLong ? 'line-clamp-2 md:line-clamp-3' : ''}`}>
                    {notif.description}
                  </p>
                  {isLong && (
                    <div className="flex justify-end mt-1.5 md:mt-2.5">
                      <button
                        onClick={() => toggleExpand(notif.id)}
                        className="inline-flex items-center gap-1 md:gap-1.5 text-[11px] md:text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border border-orange-200 transition-all cursor-pointer active:scale-95"
                      >
                        <span>{isExpanded ? 'Voir moins' : 'Voir plus'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3 md:w-4 md:h-4" /> : <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Related Item Card */}
                <div className="bg-[#FDFBF7] border border-stone-300 rounded-xl md:rounded-2xl p-2.5 md:p-4 flex items-center gap-2.5 md:gap-3.5 text-xs md:text-sm text-stone-800 font-medium">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-orange-100 border border-stone-800 flex items-center justify-center text-orange-600 shrink-0">
                    <FileText className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                  <span className="truncate">{notif.item}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

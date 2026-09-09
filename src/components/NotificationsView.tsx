import React, { useState } from 'react';
import { ArrowLeft, Bell, FileText, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface NotificationsViewProps {
  onBack: () => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onBack }) => {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const notifications = [
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
      title: 'Bienvenue sur UniFolder !',
      description: 'Merci d\'avoir créé votre compte. Explorez les fonctionnalités de gestion de dossiers, de partage sécurisé et de suivi de vos notes académiques pour booster votre réussite universitaire tout au long de l\'année.',
      item: 'Guide de démarrage rapide UniFolder',
      unread: false,
    },
  ];

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#FDFBF7] text-stone-900 overflow-y-auto animate-fadeIn">
      {/* Sticky Top Bar with Back Button */}
      <div className="sticky top-0 left-0 right-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-xs px-4 py-2 flex items-center justify-between border-b border-stone-200/60">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFBF7] hover:bg-orange-50 text-stone-900 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>
        <h2 className="font-serif font-bold text-base text-stone-900">Boîte de réception</h2>
        <div className="w-16"></div> {/* Spacer for symmetry */}
      </div>

      <div className="w-full max-w-4xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-6 md:py-10 space-y-4 md:space-y-6 pb-20">
        {notifications.map((notif) => {
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
                {notif.unread && (
                  <span className="bg-orange-100 text-orange-700 text-[10px] md:text-xs font-extrabold px-2 py-0.5 md:py-1 md:px-3 rounded-full border border-orange-300">
                    Nouveau
                  </span>
                )}
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
        })}
      </div>
    </div>
  );
};

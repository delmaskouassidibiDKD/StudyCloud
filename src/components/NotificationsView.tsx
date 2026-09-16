import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Bell, FileText, Clock, ChevronDown, ChevronUp, Trash2, CheckCheck, Search, SlidersHorizontal, Check, X, BellRing } from 'lucide-react';
import { StudyCloudAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PushNotificationService } from '../services/pushNotifications';

interface NotificationsViewProps {
  onBack: () => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onBack }) => {
  const { user } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [pushPerm, setPushPerm] = useState<NotificationPermission>(() => PushNotificationService.getPermission());
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Cache local pour affichage instantané sans clignotement
  const cacheKey = user?.id ? `studycloud_notifs_${user.id}` : 'studycloud_notifs_guest';
  const [notifications, setNotifications] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [loading, setLoading] = useState(!notifications.length);

  // Fermeture du menu de tri au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Enregistrement du Service Worker pour les notifications push
  useEffect(() => {
    PushNotificationService.registerServiceWorker();
  }, []);

  // Chargement des notifications depuis Cloudflare D1
  const fetchNotifications = async (order = sortOrder) => {
    if (!user?.id) return;
    try {
      const res: any = await StudyCloudAPI.getNotifications(user.id, order);
      if (res && res.success && Array.isArray(res.data)) {
        const formatted = res.data.map((n: any) => ({
          id: n.id,
          title: n.title,
          description: n.description,
          item: n.item_ref || 'StudyCloud',
          unread: !n.is_read,
          type: n.type || 'general',
          created_at: n.created_at,
          time: formatNotificationTime(n.created_at),
        }));
        setNotifications(formatted);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(formatted));
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[Notifications Fetch Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(sortOrder);
  }, [user?.id, sortOrder]);

  const formatNotificationTime = (dateStr?: string) => {
    if (!dateStr) return "À l'instant";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Récemment";
    const diffMs = Date.now() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      return `Il y a ${diffMins} min`;
    }
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Il y a 1 jour';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const toggleExpand = async (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
    const target = notifications.find(n => n.id === id);
    if (target && target.unread && user?.id) {
      // Marquer automatiquement comme lu en base
      target.unread = false;
      setNotifications([...notifications]);
      StudyCloudAPI.markNotificationAsRead(user.id, id).catch(() => {});
    }
  };

  const handleDeleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(updated));
    } catch (e) {}
    if (user?.id) {
      StudyCloudAPI.deleteNotification(user.id, id).catch(() => {});
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Voulez-vous vraiment effacer toutes vos notifications ?')) {
      setNotifications([]);
      try {
        localStorage.setItem(cacheKey, JSON.stringify([]));
      } catch (e) {}
      if (user?.id) {
        StudyCloudAPI.deleteNotification(user.id, undefined, true).catch(() => {});
      }
    }
  };

  const handleMarkAllRead = async () => {
    const updated = notifications.map(n => ({ ...n, unread: false }));
    setNotifications(updated);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(updated));
    } catch (e) {}
    if (user?.id) {
      StudyCloudAPI.markNotificationAsRead(user.id, undefined, true).catch(() => {});
    }
  };

  const handleRequestPush = async () => {
    const perm = await PushNotificationService.requestPermission();
    setPushPerm(perm);
    if (perm === 'granted') {
      PushNotificationService.showNotification('Notifications Push activées !', {
        body: 'Vous recevrez désormais vos alertes StudyCloud directement en haut de votre écran.',
      });
    }
  };

  // Filtrage par le champ de recherche
  const filteredNotifications = notifications.filter(n => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.description && n.description.toLowerCase().includes(q)) ||
      (n.item && n.item.toLowerCase().includes(q))
    );
  });

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#FDFBF7] dark:bg-[#0b0f19] text-stone-900 dark:text-white overflow-y-auto animate-fadeIn">
      {/* Sticky Top Bar avec Bouton Retour, Recherche au milieu, Menu 3 traits de tri et Bouton supprimer */}
      <div className="sticky top-0 left-0 right-0 z-40 bg-[#FDFBF7]/95 dark:bg-[#070a13]/95 backdrop-blur-sm px-3 sm:px-4 py-2 flex items-center justify-between gap-2 md:gap-4 border-b border-stone-200/60 dark:border-[#1e293b]">
        {/* Bouton Retour */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFBF7] dark:bg-[#1e293b] hover:bg-orange-50 dark:hover:bg-[#283852] text-stone-900 dark:text-white font-bold text-xs rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-stone-900 dark:text-white" />
          <span className="hidden sm:inline">Retour</span>
        </button>

        {/* Champ de recherche au milieu, derrière le bouton retour */}
        <div className="flex-1 max-w-md mx-auto relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une notification..."
            className="w-full pl-9 pr-8 py-1.5 md:py-2 text-xs md:text-sm bg-white dark:bg-[#111827] border border-stone-300 dark:border-stone-700 rounded-xl outline-none focus:border-orange-500 text-stone-900 dark:text-white shadow-xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Actions à droite : Bouton 3 traits (Menu de tri) & Bouton Supprimer tout */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bouton trois traits avec petit menu déroulant pour trier par récent / ancien */}
          <div className="relative" ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`p-2 md:px-3 md:py-1.5 rounded-xl border-2 border-stone-800 dark:border-stone-700 font-bold text-xs flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none cursor-pointer ${
                showSortMenu ? 'bg-orange-500 text-white' : 'bg-[#FDFBF7] dark:bg-[#1e293b] text-stone-800 dark:text-stone-200 hover:bg-orange-50 dark:hover:bg-stone-800'
              }`}
              title="Trier les notifications"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{sortOrder === 'recent' ? 'Plus récent' : 'Plus ancien'}</span>
            </button>

            {/* Menu déroulant de tri */}
            {showSortMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#111827] border-2 border-stone-800 dark:border-stone-700 rounded-2xl shadow-xl z-50 overflow-hidden py-1 animate-fadeIn">
                <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-stone-400 border-b border-stone-100 dark:border-stone-800">
                  Trier par date
                </div>
                <button
                  onClick={() => { setSortOrder('recent'); setShowSortMenu(false); }}
                  className="w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-orange-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 transition-colors"
                >
                  <span>Le plus récent</span>
                  {sortOrder === 'recent' && <Check className="w-3.5 h-3.5 text-orange-600" />}
                </button>
                <button
                  onClick={() => { setSortOrder('oldest'); setShowSortMenu(false); }}
                  className="w-full px-3 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-orange-50 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 transition-colors"
                >
                  <span>Le plus ancien</span>
                  {sortOrder === 'oldest' && <Check className="w-3.5 h-3.5 text-orange-600" />}
                </button>
              </div>
            )}
          </div>

          {/* Bouton Tout effacer */}
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2.5 py-1.5 text-red-600 hover:bg-red-50 text-[11px] md:text-xs font-bold rounded-xl border border-red-200 transition-colors cursor-pointer shadow-xs"
              title="Effacer toutes les notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tout effacer</span>
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-4xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-4 md:py-8 space-y-4 md:space-y-6 pb-20">
        {/* Bannière d'activation des Push Notifications (si pas encore accordée) */}
        {pushPerm !== 'granted' && (
          <div className="p-3.5 md:p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-600 flex items-center justify-center shrink-0">
                <BellRing className="w-5 h-5 animate-bounce" />
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm font-extrabold text-stone-900 dark:text-white">
                  Activer les alertes sur votre téléphone
                </p>
                <p className="text-[11px] md:text-xs text-stone-500 dark:text-stone-400 truncate">
                  Recevez vos alertes de cours et parrainages même quand l'application est fermée.
                </p>
              </div>
            </div>
            <button
              onClick={handleRequestPush}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 cursor-pointer transition-all active:scale-95"
            >
              Activer
            </button>
          </div>
        )}

        {/* Sous-en-tête avec compteur et bouton marquer tout comme lu */}
        {filteredNotifications.length > 0 && (
          <div className="flex items-center justify-between px-1 text-xs text-stone-600 dark:text-stone-400">
            <span className="font-bold">
              {filteredNotifications.length} notification{filteredNotifications.length > 1 ? 's' : ''}
              {searchQuery && ` trouvée(s) pour "${searchQuery}"`}
            </span>
            {filteredNotifications.some(n => n.unread) && (
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

        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center my-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-3">
              <Bell className="w-7 h-7 stroke-[1.8]" />
            </div>
            <h3 className="font-extrabold text-base text-stone-900 dark:text-white">
              {searchQuery ? 'Aucun résultat trouvé' : 'Aucune notification'}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mx-auto mt-1">
              {searchQuery
                ? `Aucune notification ne correspond à votre recherche "${searchQuery}".`
                : 'Vous êtes à jour ! Vos alertes de documents, parrainages et messages apparaîtront ici.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif: any) => {
            const isExpanded = !!expandedIds[notif.id];
            const isLong = notif.description && notif.description.length > 80;

            return (
              <div
                key={notif.id}
                onClick={() => toggleExpand(notif.id)}
                className={`bg-white dark:bg-[#111827] border-2 border-stone-800 dark:border-stone-700 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-[3px_3px_0px_0px_#1c1917] dark:shadow-none relative transition-all cursor-pointer ${
                  notif.unread ? 'border-l-4 border-l-orange-600 dark:border-l-orange-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2 md:mb-4">
                  <span className="text-[11px] md:text-xs font-bold text-stone-500 dark:text-stone-400 flex items-center gap-1 md:gap-1.5">
                    <Clock className="w-3 h-3 md:w-4 md:h-4 text-orange-600" />
                    {notif.time}
                  </span>
                  <div className="flex items-center gap-2">
                    {notif.unread && (
                      <span className="bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 text-[10px] md:text-xs font-extrabold px-2 py-0.5 md:py-1 md:px-3 rounded-full border border-orange-300 dark:border-orange-800">
                        Nouveau
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDeleteNotification(notif.id, e)}
                      className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer cette notification"
                    >
                      <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-extrabold text-sm md:text-lg text-stone-900 dark:text-white mb-1.5 md:mb-2">
                  {notif.title}
                </h3>

                <div className="mb-3 md:mb-5">
                  <p className={`text-xs md:text-sm text-stone-600 dark:text-stone-300 leading-relaxed ${!isExpanded && isLong ? 'line-clamp-2 md:line-clamp-3' : ''}`}>
                    {notif.description}
                  </p>
                  {isLong && (
                    <div className="flex justify-end mt-1.5 md:mt-2.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpand(notif.id); }}
                        className="inline-flex items-center gap-1 md:gap-1.5 text-[11px] md:text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 dark:bg-orange-950/40 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg border border-orange-200 dark:border-orange-800 transition-all cursor-pointer active:scale-95"
                      >
                        <span>{isExpanded ? 'Voir moins' : 'Voir plus'}</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3 md:w-4 md:h-4" /> : <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Élément relié */}
                <div className="bg-[#FDFBF7] dark:bg-[#070a13] border border-stone-300 dark:border-stone-800 rounded-xl md:rounded-2xl p-2.5 md:p-4 flex items-center gap-2.5 md:gap-3.5 text-xs md:text-sm text-stone-800 dark:text-stone-200 font-medium">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-orange-100 dark:bg-orange-950/50 border border-stone-800 dark:border-stone-700 flex items-center justify-center text-orange-600 shrink-0">
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

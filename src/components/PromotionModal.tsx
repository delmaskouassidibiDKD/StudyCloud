import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Share2, Trophy, Gift, Users, Clock } from 'lucide-react';
import { StudyCloudAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface PromotionModalProps {
  onClose: () => void;
}

export const PromotionModal: React.FC<PromotionModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Clé de cache local par utilisateur pour que le code et le lien restent en permanence sans clignoter
  const cacheKey = user?.id ? `sc_referral_cache_${user.id}` : 'sc_referral_cache_guest';
  const getCachedData = () => {
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const cached = getCachedData();

  // Données dynamiques instantanées (persistantes en permanence sans clignotement)
  const [invitationCode, setInvitationCode] = useState<string>(() => {
    return cached?.referralCode || (user as any)?.referral_code || '';
  });
  const [referralsCount, setReferralsCount] = useState<number>(() => {
    if (typeof cached?.referralsCount === 'number') return cached.referralsCount;
    return typeof (user as any)?.referrals_count === 'number' ? (user as any).referrals_count : 0;
  });
  const [adFreeDaysEarned, setAdFreeDaysEarned] = useState<number>(() => {
    return typeof cached?.adFreeDaysEarned === 'number' ? cached.adFreeDaysEarned : 0;
  });
  const [shareUrl, setShareUrl] = useState<string>(() => {
    if (cached?.shareUrl) return cached.shareUrl;
    const initialCode = cached?.referralCode || (user as any)?.referral_code;
    return initialCode ? `https://studycloud-ai.delmaskouassidibi.workers.dev/invite/${initialCode}` : '';
  });
  const [rules, setRules] = useState<string[]>(() => {
    return Array.isArray(cached?.rules) && cached.rules.length > 0 ? cached.rules : [
      "Chaque fois que vous promouvez avec succès une personne qui s'inscrit, vous bénéficierez de 5 jours de publicité gratuite, qui peuvent être accumulés de manière illimitée~",
      "Un total de 3 personnes inscrites par vous, et 5 jours supplémentaires de publicité gratuite offerts~",
      "Un total de 5 personnes inscrites par vous, et 10 jours supplémentaires de publicité gratuite offerts~",
      "Un total de 7 personnes inscrites par vous, et 15 jours supplémentaires de publicité gratuite offerts~",
      "Un total de 10 personnes inscrites par vous, et 3650 jours supplémentaires de publicité gratuite offerts~"
    ];
  });
  const [referralsList, setReferralsList] = useState<any[]>(() => {
    return Array.isArray(cached?.referrals) ? cached.referrals : [];
  });
  // Ne pas afficher de clignotement si on a déjà des données en cache
  const [loading, setLoading] = useState<boolean>(!cached?.referralCode && !(user as any)?.referral_code);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res: any = await StudyCloudAPI.getReferralStatus(user?.id);
        if (isMounted && res && res.success) {
          const finalUrl = res.inviteUrl || (res.referralCode ? `https://studycloud-ai.delmaskouassidibi.workers.dev/invite/${res.referralCode}` : '');
          if (res.referralCode) setInvitationCode(res.referralCode);
          if (typeof res.referralsCount === 'number') setReferralsCount(res.referralsCount);
          if (typeof res.adFreeDaysEarned === 'number') setAdFreeDaysEarned(res.adFreeDaysEarned);
          if (finalUrl) setShareUrl(finalUrl);
          if (Array.isArray(res.rules) && res.rules.length > 0) setRules(res.rules);
          if (Array.isArray(res.referrals)) setReferralsList(res.referrals);

          // Sauvegarde locale permanente pour éliminer tout clignotement aux visites suivantes
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              referralCode: res.referralCode,
              referralsCount: res.referralsCount || 0,
              adFreeDaysEarned: res.adFreeDaysEarned || 0,
              shareUrl: finalUrl,
              rules: res.rules,
              referrals: res.referrals,
            }));
          } catch (e) {}
        }
      } catch (err) {
        console.error('[PromotionModal Error]', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStatus();
    return () => { isMounted = false; };
  }, [user?.id, cacheKey]);

  const activeShareUrl = shareUrl || (invitationCode ? `https://studycloud-ai.delmaskouassidibi.workers.dev/invite/${invitationCode}` : 'https://studycloud.dkd-technologies.com');

  const handleCopy = () => {
    navigator.clipboard.writeText(activeShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Promotion StudyCloud',
        text: `Rejoins-moi sur StudyCloud avec mon code d'invitation : ${invitationCode}`,
        url: activeShareUrl,
      }).catch(() => {});
    } else {
      handleCopy();
      alert("Lien de parrainage copié dans le presse-papier !");
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(activeShareUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn overflow-y-auto">
      <div className="bg-[#FDFBF7] dark:bg-[#0b0f19] border-3 border-stone-800 dark:border-stone-700 rounded-3xl shadow-[8px_8px_0px_0px_#1c1917] max-w-xl md:max-w-3xl w-full p-6 md:p-10 text-stone-900 dark:text-white relative my-auto max-h-[90vh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-300 dark:border-stone-800 mb-6 md:mb-8">
          <button
            onClick={() => setShowHistory(true)}
            className="text-xs md:text-sm text-stone-700 dark:text-stone-300 hover:text-stone-900 font-bold px-3 py-1.5 md:px-4 md:py-2 bg-stone-100 dark:bg-stone-800 rounded-xl border-2 border-stone-800 dark:border-stone-700 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
          >
            Record ({referralsList.length})
          </button>
          <h2 className="text-xl md:text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">Promotion</h2>
          <button
            onClick={onClose}
            className="p-2 md:p-2.5 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-700 dark:text-stone-300 border-2 border-stone-800 dark:border-stone-700 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Déjà promu sans encadré ni couleur autour */}
        <div className="text-center mb-6 md:mb-8">
          <p className="text-stone-800 dark:text-stone-200 font-bold text-lg md:text-2xl flex items-center justify-center gap-2">
            <span>Déjà promu</span>
            <span className="text-orange-600 dark:text-orange-400 font-black text-2xl md:text-4xl">
              {referralsCount}
            </span>
            <span>personne(s)</span>
          </p>
        </div>

        {/* QR Code Card */}
        <div className="bg-white dark:bg-[#111827] border-3 border-stone-800 dark:border-stone-700 rounded-2xl md:rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center shadow-[4px_4px_0px_0px_#1c1917] md:shadow-[6px_6px_0px_0px_#1c1917] mb-6 md:mb-8">
          <div className="w-48 h-48 md:w-60 md:h-60 bg-white rounded-xl md:rounded-2xl p-3 flex items-center justify-center relative overflow-hidden border border-stone-200">
            {activeShareUrl ? (
              <img
                src={qrImageUrl}
                alt="QR Code"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-stone-50">
                <span className="text-xs text-stone-400">Chargement...</span>
              </div>
            )}
          </div>
          <p className="text-xs md:text-base text-stone-700 dark:text-stone-300 mt-4 md:mt-5 font-mono font-bold">
            Mon code d'invitation: <span className="text-orange-600 dark:text-orange-400 font-extrabold">{invitationCode || '...'}</span>
          </p>
          <div className="mt-4 md:mt-6 flex items-center gap-2 md:gap-3 w-full md:w-3/4 mx-auto">
            <input
              type="text"
              readOnly
              value={activeShareUrl}
              className="bg-stone-100 dark:bg-stone-800 border-2 border-stone-800 dark:border-stone-700 rounded-xl md:rounded-2xl text-xs md:text-sm px-3 md:px-4 py-2.5 md:py-3 text-stone-700 dark:text-stone-300 font-mono flex-1 outline-none truncate"
            />
            <button
              onClick={handleCopy}
              className="bg-stone-900 hover:bg-stone-800 text-white text-xs md:text-sm font-bold px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center gap-1.5 md:gap-2 transition-all active:scale-95 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />}
              {copied ? 'Copié' : 'Copier'}
            </button>
          </div>
        </div>

        {/* Partager maintenant button */}
        <div className="mb-6 md:mb-8 md:w-3/4 lg:w-2/3 mx-auto">
          <button
            onClick={handleShare}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-base md:text-lg py-3.5 md:py-4 px-6 rounded-2xl md:rounded-3xl border-3 border-stone-800 shadow-[4px_4px_0px_0px_#1c1917] md:shadow-[6px_6px_0px_0px_#1c1917] flex items-center justify-center gap-2 md:gap-3 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
          >
            <Share2 className="w-5 h-5 md:w-6 md:h-6" />
            <span>Partager maintenant</span>
          </button>
        </div>

        {/* Informations promotionnelles */}
        <div className="bg-stone-100 dark:bg-[#111827] border-2 border-stone-800 dark:border-stone-700 rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-inner space-y-3 md:space-y-4">
          <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-4">
            <Trophy className="w-5 h-5 md:w-7 md:h-7 text-amber-600" />
            <h3 className="font-extrabold text-base md:text-xl text-stone-900 dark:text-white">Informations promotionnelles</h3>
          </div>
          <ol className="text-xs md:text-sm lg:text-base text-stone-700 dark:text-stone-300 space-y-2.5 md:space-y-4 list-decimal pl-4 md:pl-6 leading-relaxed font-medium">
            {rules.map((rule, idx) => (
              <li key={idx}>{rule}</li>
            ))}
          </ol>
        </div>
      </div>

      {/* Modal Historique */}
      {showHistory && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#111827] border-2 border-stone-800 dark:border-stone-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-600" />
                <h3 className="font-extrabold text-lg text-stone-900 dark:text-white">Mes Parrainages ({referralsList.length})</h3>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-stone-100 dark:divide-stone-800 space-y-2">
              {referralsList.length === 0 ? (
                <p className="text-center py-6 text-stone-500 text-sm">Aucun compte inscrit avec votre lien pour l'instant.</p>
              ) : (
                referralsList.map((ref: any, idx: number) => (
                  <div key={ref.id || idx} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-stone-900 dark:text-white">
                        {ref.referred_user_name || 'Étudiant inscrit'}
                      </p>
                      <p className="text-xs text-stone-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(ref.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs rounded-lg">
                      +{ref.reward_days || 5} jours
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

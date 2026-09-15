import React, { useState, useEffect } from 'react';
import { ArrowLeft, Copy, Check, Share2, Trophy, Sparkles, Users, Gift, Clock, ExternalLink } from 'lucide-react';
import { StudyCloudAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface PromotionViewProps {
  onBack: () => void;
}

export const PromotionView: React.FC<PromotionViewProps> = ({ onBack }) => {
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
  // Ne pas afficher de spinner/clignotement si on a déjà des données en cache
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
        console.error('[PromotionView Error]', err);
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
        title: 'Invitation officielle StudyCloud',
        text: `Rejoins-moi sur StudyCloud, la plateforme tout-en-un pour les étudiants ! Utilise mon code d'invitation : ${invitationCode}`,
        url: activeShareUrl,
      }).catch(() => {});
    } else {
      handleCopy();
      alert("Lien d'invitation copié dans votre presse-papier !");
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(activeShareUrl)}`;

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#FDFBF7] dark:bg-[#0b0f19] text-stone-900 dark:text-white overflow-y-auto animate-fadeIn">
      {/* Sticky Fixed Header at top */}
      <div className="sticky top-0 left-0 right-0 z-40 bg-[#FDFBF7]/95 dark:bg-[#070a13]/95 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between border-b border-stone-200/60 dark:border-[#1e293b]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFBF7] dark:bg-[#1e293b] hover:bg-orange-50 dark:hover:bg-[#283852] text-stone-900 dark:text-white font-bold text-xs rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4 text-stone-900 dark:text-white" />
          <span>Retour</span>
        </button>

        {referralsList.length > 0 && (
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 dark:bg-orange-950/50 hover:bg-orange-200 text-orange-800 dark:text-orange-300 font-bold text-xs rounded-xl border border-orange-300 dark:border-orange-800/60 transition-all cursor-pointer shadow-sm"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Historique ({referralsList.length})</span>
          </button>
        )}
      </div>

      <div className="w-full max-w-2xl lg:max-w-4xl mx-auto px-4 pt-4 md:pt-8 pb-16 flex flex-col items-center text-center space-y-5 md:space-y-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-serif font-black text-stone-900 dark:text-white mb-2 tracking-tight">Promotion</h1>
        </div>

        {/* Déjà promu sans encadré ni couleur autour, fondu directement dans le fond */}
        <div className="w-full flex flex-col items-center">
          <div className="text-stone-800 dark:text-stone-100 font-bold text-lg md:text-2xl flex items-center justify-center gap-2">
            <span>Déjà promu</span>
            <span className="text-orange-600 dark:text-orange-500 font-black text-2xl md:text-4xl">
              {referralsCount}
            </span>
            <span>personne(s)</span>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="w-full flex flex-col items-center py-2 md:py-4 space-y-3 md:space-y-4">
          <div className="relative w-48 h-48 md:w-60 md:h-60 bg-white border-3 border-stone-800 dark:border-stone-700 rounded-2xl md:rounded-3xl p-3 md:p-4 flex items-center justify-center shadow-[4px_4px_0px_0px_#1c1917] md:shadow-[6px_6px_0px_0px_#1c1917] overflow-hidden">
            {activeShareUrl ? (
              <img
                src={qrImageUrl}
                alt="QR Code Parrainage"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-stone-50">
                <span className="text-xs text-stone-400">Chargement...</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 bg-stone-100 dark:bg-[#1e293b] px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700">
            <span className="text-xs md:text-sm text-stone-700 dark:text-stone-300 font-medium">Mon code d'invitation :</span>
            <span className="text-base md:text-lg text-orange-600 dark:text-orange-400 font-mono font-black tracking-wider">
              {invitationCode || '...'}
            </span>
          </div>
        </div>

        {/* Action Buttons: Copier and Partager maintenant */}
        <div className="w-full md:w-3/4 lg:w-2/3 space-y-3 md:space-y-4 pt-1">
          <button
            onClick={handleCopy}
            disabled={loading}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm md:text-base py-3.5 md:py-4 px-6 rounded-xl md:rounded-2xl border-2 border-stone-800 shadow-[4px_4px_0px_0px_#1c1917] flex items-center justify-center gap-2 md:gap-3 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917] cursor-pointer disabled:opacity-50"
          >
            {copied ? <Check className="w-5 h-5 md:w-6 md:h-6 text-emerald-400" /> : <Copy className="w-5 h-5 md:w-6 md:h-6" />}
            <span>{copied ? 'Lien copié dans le presse-papier !' : 'Copier le lien'}</span>
          </button>

          <button
            onClick={handleShare}
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-base md:text-lg py-3.5 md:py-4 px-6 rounded-xl md:rounded-2xl border-2 border-stone-800 shadow-[4px_4px_0px_0px_#1c1917] flex items-center justify-center gap-2 md:gap-3 transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#1c1917] cursor-pointer disabled:opacity-50"
          >
            <Share2 className="w-5 h-5 md:w-6 md:h-6" />
            <span>Partager maintenant</span>
          </button>
        </div>

        {/* Informations promotionnelles dynamiques depuis la base D1 */}
        <div className="w-full text-left pt-3 md:pt-6 pb-8 space-y-3 md:space-y-4 bg-white dark:bg-[#111827] p-5 md:p-8 rounded-2xl md:rounded-3xl border-2 border-stone-800/80 dark:border-stone-700 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 shrink-0">
              <Trophy className="w-4.5 h-4.5" />
            </div>
            <h3 className="font-extrabold text-base md:text-xl text-stone-900 dark:text-white">
              Informations promotionnelles & Récompenses
            </h3>
          </div>

          <ol className="text-xs md:text-sm lg:text-base text-stone-700 dark:text-stone-300 space-y-3 md:space-y-4 list-decimal pl-5 md:pl-6 leading-relaxed font-medium">
            {rules.map((rule, index) => (
              <li key={index} className="pl-1">
                {rule}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Modal Historique des Parrainages */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
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
                <p className="text-center py-6 text-stone-500 text-sm">Aucune personne inscrite pour le moment.</p>
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

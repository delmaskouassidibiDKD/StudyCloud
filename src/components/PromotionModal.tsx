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
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);

  const [invitationCode, setInvitationCode] = useState<string>('...');
  const [referralsCount, setReferralsCount] = useState<number>(0);
  const [adFreeDaysEarned, setAdFreeDaysEarned] = useState<number>(0);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [rules, setRules] = useState<string[]>([
    "Chaque fois que vous promouvez avec succès une personne qui s'inscrit, vous bénéficierez de 5 jours de publicité gratuite, qui peuvent être accumulés de manière illimitée~",
    "Un total de 3 personnes inscrites par vous, et 5 jours supplémentaires de publicité gratuite offerts~",
    "Un total de 5 personnes inscrites par vous, et 10 jours supplémentaires de publicité gratuite offerts~",
    "Un total de 7 personnes inscrites par vous, et 15 jours supplémentaires de publicité gratuite offerts~",
    "Un total de 10 personnes inscrites par vous, et 3650 jours supplémentaires de publicité gratuite offerts~"
  ]);
  const [referralsList, setReferralsList] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const res: any = await StudyCloudAPI.getReferralStatus(user?.id);
        if (isMounted && res && res.success) {
          if (res.referralCode) setInvitationCode(res.referralCode);
          if (typeof res.referralsCount === 'number') setReferralsCount(res.referralsCount);
          if (typeof res.adFreeDaysEarned === 'number') setAdFreeDaysEarned(res.adFreeDaysEarned);
          if (res.inviteUrl) setShareUrl(res.inviteUrl);
          else if (res.referralCode) {
            setShareUrl(`https://studycloud-ai.delmaskouassidibi.workers.dev/invite/${res.referralCode}`);
          }
          if (Array.isArray(res.rules) && res.rules.length > 0) {
            setRules(res.rules);
          }
          if (Array.isArray(res.referrals)) {
            setReferralsList(res.referrals);
          }
        }
      } catch (err) {
        console.error('[PromotionModal Error]', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchStatus();
    return () => { isMounted = false; };
  }, [user?.id]);

  const activeShareUrl = shareUrl || (invitationCode !== '...' ? `https://studycloud-ai.delmaskouassidibi.workers.dev/invite/${invitationCode}` : 'https://studycloud.dkd-technologies.com');

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

        {/* Déjà promu */}
        <div className="text-center mb-6 md:mb-8 space-y-2">
          <p className="text-stone-800 dark:text-stone-200 font-bold text-lg md:text-2xl">
            Déjà promu <span className="text-orange-600 font-extrabold text-xl md:text-3xl px-2 py-0.5 bg-orange-50 dark:bg-orange-950/40 rounded-xl border border-orange-200 dark:border-orange-800/50">{loading ? '...' : referralsCount}</span> personne(s)
          </p>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded-full text-xs md:text-sm font-bold shadow-xs">
            <Gift className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Avantages débloqués : <strong>+{loading ? '...' : adFreeDaysEarned} jours</strong> de visibilité gratuite</span>
          </div>
        </div>

        {/* QR Code Card */}
        <div className="bg-white dark:bg-[#111827] border-3 border-stone-800 dark:border-stone-700 rounded-2xl md:rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center shadow-[4px_4px_0px_0px_#1c1917] md:shadow-[6px_6px_0px_0px_#1c1917] mb-6 md:mb-8">
          <div className="w-48 h-48 md:w-60 md:h-60 bg-white rounded-xl md:rounded-2xl p-3 flex items-center justify-center relative overflow-hidden border border-stone-200">
            {activeShareUrl && (
              <img
                src={qrImageUrl}
                alt="QR Code"
                className={`w-full h-full object-contain transition-opacity duration-300 ${qrLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setQrLoaded(true)}
              />
            )}
            {(!qrLoaded || loading) && (
              <div className="absolute inset-0 flex items-center justify-center bg-white p-4">
                <svg viewBox="0 0 24 24" className="w-full h-full text-stone-900 fill-current opacity-25 animate-pulse">
                  <path d="M2,2H10V10H2V2M4,4V8H8V4H4M14,2H22V10H14V2M16,4V8H20V4H16M2,14H10V22H2V14M4,16V20H8V16H4M18,14V18H22V14H18M14,18H16V22H14V18M18,20H22V22H18V20M12,2H14V6H12V2M12,8H14V12H12V8M6,12H8V14H6V12M10,12H12V14H10V12M16,12H20V14H16V12M12,14H14V18H12V14M12,20H14V22H12V20Z" />
                </svg>
              </div>
            )}
          </div>
          <p className="text-xs md:text-base text-stone-700 dark:text-stone-300 mt-4 md:mt-5 font-mono font-bold">
            Mon code d'invitation: <span className="text-orange-600 dark:text-orange-400 font-extrabold">{loading ? '...' : invitationCode}</span>
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

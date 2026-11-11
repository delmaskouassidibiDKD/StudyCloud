import React, { useState } from 'react';
import { X, Shield, FileText, Lock, Building, Scale, ArrowLeft, CheckCircle2, AlertTriangle, Search } from 'lucide-react';

interface LegalTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'cgu' | 'privacy' | 'mentions';
}

export const LegalTermsModal: React.FC<LegalTermsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'cgu',
}) => {
  const [activeTab, setActiveTab] = useState<'cgu' | 'privacy' | 'mentions'>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-8 animate-fadeIn text-stone-900">
      <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl w-full max-w-4xl h-[92vh] max-h-[850px] shadow-[8px_8px_0px_0px_#1c1917] flex flex-col overflow-hidden relative">
        
        {/* Header du Modal */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b-3 border-stone-800 bg-[#F5F1E9] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500 border-2 border-stone-800 flex items-center justify-center text-white shadow-[2px_2px_0px_0px_#1c1917] shrink-0">
              <Scale className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-stone-900 leading-tight">
                Cadre Juridique & Conditions
              </h2>
              <p className="text-[11px] sm:text-xs text-stone-600 font-semibold">
                StudyCloud • DKD Technologies • Concepteur : Dibi Kouassi Delmas
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-stone-100 border-2 border-stone-800 flex items-center justify-center text-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer shrink-0 active:translate-x-0.5 active:translate-y-0.5"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Barre de navigation par onglets */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b-2 border-stone-200 bg-[#FAF7F0] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 max-w-full">
            <button
              onClick={() => setActiveTab('cgu')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold border-2 border-stone-800 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'cgu'
                  ? 'bg-orange-500 text-white shadow-[2px_2px_0px_0px_#1c1917]'
                  : 'bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Conditions d'Utilisation (CGU)</span>
            </button>

            <button
              onClick={() => setActiveTab('privacy')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold border-2 border-stone-800 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'privacy'
                  ? 'bg-orange-500 text-white shadow-[2px_2px_0px_0px_#1c1917]'
                  : 'bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Confidentialité</span>
            </button>

            <button
              onClick={() => setActiveTab('mentions')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold border-2 border-stone-800 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'mentions'
                  ? 'bg-orange-500 text-white shadow-[2px_2px_0px_0px_#1c1917]'
                  : 'bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Mentions Légales</span>
            </button>
          </div>

          <span className="text-[11px] font-bold text-stone-500 hidden md:inline">
            Version 4.3 • Novembre 2026
          </span>
        </div>

        {/* Corps du Document Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 md:p-9 space-y-6 text-sm leading-relaxed text-stone-800 font-normal">

          {/* ONGLET 1 : CGU / CGV */}
          {activeTab === 'cgu' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-amber-50 border-2 border-stone-800 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#1c1917] flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-900">
                  <p className="font-extrabold mb-1">Règles fondamentales de StudyCloud</p>
                  <p>L'utilisation de StudyCloud implique l'adhésion sans réserve à ces conditions. Veuillez les lire attentivement pour sécuriser vos données, vos créations et vos transactions.</p>
                </div>
              </div>

              {/* 1. Mission */}
              <section className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-100 border border-stone-800 text-orange-700 flex items-center justify-center text-xs font-black">1</span>
                  Mission et Polyvalence de StudyCloud
                </h3>
                <p>
                  StudyCloud est une plateforme numérique tout-en-un éditée par <strong>DKD Technologies</strong> et conçue par <strong>Dibi Kouassi Delmas</strong>. Elle s'adresse aux étudiants, élèves, enseignants, créateurs de contenus, professionnels et particuliers, en réunissant :
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-stone-700 font-medium">
                  <li><strong>Un hub de ressources & pépites du web :</strong> sélection et curation des meilleurs outils gratuits et astuces d'Internet.</li>
                  <li><strong>Un espace d'organisation et d'étude :</strong> Classeur 3D, gestion par matières, calendrier, emplois du temps, bloc-notes et visionneuses multimédias.</li>
                  <li><strong>Une place de marché & Création de boutique :</strong> possibilité de créer sa boutique pour commercialiser ses documents originaux.</li>
                  <li><strong>Un stockage Cloud sécurisé :</strong> sauvegarde de documents, médias et archives accessibles sur tous les appareils.</li>
                  <li><strong>Des fonctionnalités d'Intelligence Artificielle intégrées :</strong> assistance à la synthèse, rédaction de fiches et devoirs guidés.</li>
                  <li><strong>Un portail de partage direct (StudyCloud Share) :</strong> génération de liens rapides pour échanger des dossiers de fichiers.</li>
                </ul>
              </section>

              {/* 2. Boutiques et Vente */}
              <section className="space-y-2 bg-[#F9F6F0] border-2 border-stone-800 rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_#1c1917]">
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-100 border border-stone-800 text-orange-700 flex items-center justify-center text-xs font-black">2</span>
                  Création de Boutique, Vente de Documents & Transactions Entre Membres
                </h3>
                <p>
                  StudyCloud permet aux utilisateurs d'ouvrir une vitrine en ligne pour vendre des documents numériques (résumés, fiches, cours personnels, guides pratiques).
                </p>
                <div className="space-y-2 pt-2">
                  <div className="p-3 bg-red-50 border-2 border-red-800 rounded-xl text-red-950 text-xs font-medium">
                    <strong>🚫 Interdiction absolue de vente de documents sous droits d'auteur & contenus pornographiques :</strong>
                    <p className="mt-1">
                      Il est formellement interdit de commercialiser des livres scannés, manuels officiels sous copyright, polycopiés volés ou tout contenu pornographique, érotique ou violent. Le vendeur garantit sur l'honneur qu'il est l'auteur unique des documents proposés ou détenteur des droits requis.
                    </p>
                  </div>

                  <div className="p-3 bg-orange-50 border-2 border-orange-800 rounded-xl text-orange-950 text-xs font-medium">
                    <strong>⚖️ Exonération totale en cas d'arnaque, vol ou litige entre utilisateurs :</strong>
                    <p className="mt-1">
                      StudyCloud fournit uniquement les outils informatiques d'hébergement. <strong>DKD Technologies et son fondateur Dibi Kouassi Delmas déclinent toute responsabilité en cas d'arnaque, de tromperie, de vol, de litige financier ou de non-conformité d'un document acheté entre utilisateurs.</strong> Les acheteurs et vendeurs assument seuls et à 100 % les risques de leurs transactions privées. Aucun remboursement ou indemnité ne pourra être exigé de l'éditeur du site.
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. Ressources & Signalement */}
              <section className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-100 border border-stone-800 text-orange-700 flex items-center justify-center text-xs font-black">3</span>
                  Menu Ressources & Bouton de Signalement
                </h3>
                <p>
                  Tout document partagé dans le menu public « Ressources » ou via StudyCloud Share engage la seule responsabilité de son auteur.
                </p>
                <p>
                  StudyCloud intègre un <strong>système de signalement</strong> permettant à quiconque de signaler en un clic un document illégal, piraté, pornographique ou frauduleux. DKD Technologies procède au retrait immédiat des contenus litigieux et au bannissement des contrevenants.
                </p>
              </section>

              {/* 4. Stockage & Impayés */}
              <section className="space-y-2 bg-[#F9F6F0] border-2 border-stone-800 rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_#1c1917]">
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-100 border border-stone-800 text-orange-700 flex items-center justify-center text-xs font-black">4</span>
                  Stockage Cloud : Non-Remboursable, Évolution et Impayés
                </h3>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-stone-700 text-xs sm:text-sm font-medium">
                  <li><strong>Achat non remboursable :</strong> Tout espace de stockage souscrit est définitif et ne donne lieu à aucun remboursement.</li>
                  <li><strong>Augmentation seule (Diminution impossible) :</strong> Une fois une formule de stockage achetée, il est impossible de la réduire ; seule une augmentation vers un palier supérieur est possible.</li>
                  <li><strong>Cycle en cas d'impayé :</strong> En cas d'expiration sans renouvellement, l'utilisateur reçoit une alerte. Si la situation n'est pas régularisée après délai de grâce, <strong>l'accès au stockage étendu est suspendu puis les fichiers excédentaires sont définitivement supprimés des serveurs pour libérer de la place</strong>, sans droit à dédommagement.</li>
                </ul>
              </section>

              {/* 5. IA & Crédits */}
              <section className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-100 border border-stone-800 text-orange-700 flex items-center justify-center text-xs font-black">5</span>
                  Fonctionnalités d'Intelligence Artificielle & Crédits Consommés
                </h3>
                <p>
                  Les fonctionnalités IA intégrées sont des outils d'assistance dont les générations restent indicatives.
                </p>
                <div className="p-3 bg-amber-50 border-2 border-stone-800 rounded-xl text-xs text-amber-950 font-medium">
                  <strong>Consommation définitive des crédits IA :</strong> Toute tâche lancée à l'IA consomme des ressources serveurs. Même si le résultat produit est incomplet, imparfait ou non satisfaisant pour l'utilisateur, <strong>les crédits consommés restent définitivement débités et ne sont jamais remboursés ou recrédités</strong>.
                </div>
              </section>

              {/* 6. Sécurité & Attaques */}
              <section className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-100 border border-stone-800 text-orange-700 flex items-center justify-center text-xs font-black">6</span>
                  Interdiction d'Attaques & Droit de Bannissement
                </h3>
                <p>
                  Toute tentative de piratage, de scan de vulnérabilité, d'injection ou d'attaque par déni de service (DDoS) est strictement prohibée sous peine de poursuites judiciaires. DKD Technologies se réserve le droit souverain d'expulser et de bannir immédiatement tout utilisateur malveillant.
                </p>
                <p className="text-xs text-stone-600">
                  Des interruptions temporaires de service pour maintenance technique ou pannes réseau peuvent survenir et ne donnent droit à aucune indemnité financière.
                </p>
              </section>
            </div>
          )}

          {/* ONGLET 2 : CONFIDENTIALITÉ */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-emerald-50 border-2 border-stone-800 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#1c1917] flex items-start gap-3">
                <Lock className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs text-emerald-900">
                  <p className="font-extrabold mb-1">Protection stricte de votre vie privée</p>
                  <p>DKD Technologies applique une politique de zéro revente de données personnelles et de respect absolu de la confidentialité de vos fichiers.</p>
                </div>
              </div>

              <section className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900">Données collectées</h3>
                <p>Nous collectons uniquement les éléments nécessaires au bon fonctionnement de votre espace :</p>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-stone-700 text-xs sm:text-sm font-medium">
                  <li><strong>Informations de compte :</strong> Nom, prénom, email, mot de passe sécurisé par hachage cryptographique fort.</li>
                  <li><strong>Fichiers et documents :</strong> Cours, fiches, photos, audios et vidéos que vous déposez dans votre espace de stockage.</li>
                  <li><strong>Historique IA :</strong> Résumés et modules générés pour votre confort de consultation.</li>
                </ul>
              </section>

              <section className="space-y-2 bg-[#F9F6F0] border-2 border-stone-800 rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_#1c1917]">
                <h3 className="text-base sm:text-lg font-black text-stone-900">Engagements Solennels de Non-Revente</h3>
                <ul className="space-y-2 text-xs sm:text-sm text-stone-800 font-medium">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Zéro Revente Commerciale :</strong> DKD Technologies ne vend, ne loue et ne partage jamais vos données ou documents avec des régies publicitaires ou des sociétés tierces.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Dossier Sécurisé Protégé :</strong> Vos fichiers privés placés sous code PIN bénéficient d'un verrouillage exclusif inaccessible à l'administrateur.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>IA Éphémère & Respectueuse :</strong> Les documents que vous analysez avec l'IA servent uniquement à générer la réponse demandée et ne sont pas utilisés pour entraîner des modèles publics tiers.</span>
                  </li>
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900">Cookies, Cache Hors-Ligne & PWA</h3>
                <p className="text-xs sm:text-sm text-stone-700">
                  StudyCloud utilise le stockage local de votre navigateur et le Service Worker PWA strictement à des fins techniques : maintenir votre session connectée, mémoriser vos préférences (thème, disposition) et vous permettre d'ouvrir vos fichiers récents même sans connexion Internet. Aucun cookie traceur publicitaire n'est utilisé.
                </p>
              </section>

              <section className="space-y-2 bg-red-50 border-2 border-stone-800 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#1c1917]">
                <h3 className="text-base sm:text-lg font-black text-red-950">Droit à l'Effacement Total (« Supprimer mon compte »)</h3>
                <p className="text-xs sm:text-sm text-red-900">
                  Vous conservez à tout moment la pleine maîtrise de vos données. En vous rendant dans vos Paramètres, vous disposez du bouton <strong>« Supprimer mon compte »</strong> qui détruit immédiatement et définitivement l'ensemble de vos fichiers, historiques, boutiques et données personnelles de nos serveurs.
                </p>
              </section>
            </div>
          )}

          {/* ONGLET 3 : MENTIONS LÉGALES */}
          {activeTab === 'mentions' && (
            <div className="space-y-6 animate-fadeIn">
              <section className="space-y-3 bg-[#F9F6F0] border-2 border-stone-800 rounded-2xl p-5 shadow-[3px_3px_0px_0px_#1c1917]">
                <h3 className="text-base sm:text-lg font-black text-stone-900">Identification de l'Éditeur</h3>
                <div className="space-y-2 text-xs sm:text-sm text-stone-800">
                  <p><strong>Société éditrice & propriétaire :</strong> DKD Technologies</p>
                  <p><strong>Concepteur & Fondateur :</strong> Dibi Kouassi Delmas (Étudiant ivoirien en filière électrotechnique, concepteur et développeur de la plateforme StudyCloud)</p>
                  <p><strong>Plateforme éditée :</strong> StudyCloud (Application web, PWA et mobile)</p>
                  <p><strong>Email support officiel :</strong> <span className="font-mono text-orange-700 font-bold">contact@dkd-technologies.com</span> / <span className="font-mono text-orange-700 font-bold">support@studycloud.app</span></p>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900">Propriété Intellectuelle & Droits Réservés</h3>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                  L'architecture logicielle, les concepts, le design graphique, les modèles de classeurs 3D et le logo de StudyCloud sont la propriété exclusive de DKD Technologies et de son fondateur Dibi Kouassi Delmas. Toute reproduction ou imitation non autorisée du site est interdite.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900">Droit Applicable</h3>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                  Les présentes conditions sont soumises à la réglementation en vigueur. En cas de contestation ou de désaccord, les parties s'engagent à privilégier une concertation amiable avec le support de DKD Technologies avant tout recours judiciaire.
                </p>
              </section>
            </div>
          )}

        </div>

        {/* Footer avec bouton OK de validation */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t-2 border-stone-300 bg-[#F5F1E9] flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] sm:text-xs text-stone-600 font-medium">
            En naviguant sur StudyCloud, vous acceptez l'ensemble de ces dispositions.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#2D4A3E] hover:bg-[#1e332a] text-white font-extrabold text-xs sm:text-sm rounded-xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all cursor-pointer shrink-0 active:translate-x-0.5 active:translate-y-0.5"
          >
            J'ai compris
          </button>
        </div>

      </div>
    </div>
  );
};


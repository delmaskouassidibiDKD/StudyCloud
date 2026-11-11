import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { DnaLogo } from './DnaLogo';

export type LegalTabType = 'cgu' | 'privacy' | 'mentions';

interface LegalTermsPageProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: LegalTabType;
}

interface SectionItem {
  id: string;
  label: string;
}

const SECTIONS_BY_TAB: Record<LegalTabType, SectionItem[]> = {
  cgu: [
    { id: 'overview', label: 'Aperçu & Mission' },
    { id: 'marketplace', label: 'Boutiques & Vente de documents' },
    { id: 'scam', label: 'Transactions & Exonération' },
    { id: 'resources', label: 'Menu Ressources & Signalement' },
    { id: 'storage', label: 'Stockage Cloud & Impayés' },
    { id: 'ai', label: 'Fonctionnalités IA & Crédits' },
    { id: 'security', label: 'Sécurité, Attaques & Maintenances' },
  ],
  privacy: [
    { id: 'privacy-overview', label: 'Aperçu de la politique' },
    { id: 'data-collected', label: 'Données recueillies' },
    { id: 'non-sale', label: 'Engagements de non-revente' },
    { id: 'cookies-pwa', label: 'Cookies, Stockage local & PWA' },
    { id: 'account-deletion', label: 'Droit à l\'effacement & Suppression' },
  ],
  mentions: [
    { id: 'publisher', label: 'Éditeur & Fondateur' },
    { id: 'ip', label: 'Propriété intellectuelle' },
    { id: 'law', label: 'Droit applicable & Contact' },
  ],
};

export const LegalTermsModal: React.FC<LegalTermsPageProps> = ({
  isOpen,
  onClose,
  defaultTab = 'cgu',
}) => {
  const [activeTab, setActiveTab] = useState<LegalTabType>(defaultTab);
  const [activeSectionId, setActiveSectionId] = useState<string>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(defaultTab);
    const firstSec = SECTIONS_BY_TAB[defaultTab]?.[0]?.id || 'overview';
    setActiveSectionId(firstSec);
  }, [defaultTab, isOpen]);

  // Synchroniser l'URL propre ou touche Échap
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setMobileMenuOpen(false);
    const el = document.getElementById(`sc-legal-${sectionId}`);
    if (el && scrollContainerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const currentSections = SECTIONS_BY_TAB[activeTab];

  return (
    <div
      className="fixed inset-0 z-[999999] bg-white text-[#1d1d1f] flex flex-col font-sans antialiased overflow-hidden"
      style={{ colorScheme: 'light' }}
    >
      {/* BARRE SUPÉRIEURE ÉPURÉE STYLE CLOUDFLARE / DOCUMENT OFFICIEL */}
      <header className="w-full bg-white border-b border-gray-200 px-4 sm:px-8 lg:px-12 h-16 sm:h-[72px] flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Logo StudyCloud */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-[#0f172a] flex items-center justify-center shadow-sm">
              <DnaLogo className="w-5 h-5" glow={false} />
            </div>
            <div className="flex flex-col text-left leading-none">
              <span className="font-black text-base sm:text-lg tracking-tight">
                <span className="text-orange-600">Study</span>
                <span className="text-blue-600">Cloud</span>
              </span>
              <span className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mt-0.5">
                DKD TECHNOLOGIES
              </span>
            </div>
          </button>

          {/* Navigation principale Desktop entre les 3 documents légaux */}
          <nav className="hidden md:flex items-center gap-1 border-l border-gray-200 pl-6 ml-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('cgu');
                setActiveSectionId(SECTIONS_BY_TAB.cgu[0].id);
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'cgu'
                  ? 'text-orange-600 bg-orange-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Conditions d'utilisation
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('privacy');
                setActiveSectionId(SECTIONS_BY_TAB.privacy[0].id);
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'privacy'
                  ? 'text-orange-600 bg-orange-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Politique de confidentialité
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('mentions');
                setActiveSectionId(SECTIONS_BY_TAB.mentions[0].id);
                scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'mentions'
                  ? 'text-orange-600 bg-orange-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              Mentions légales
            </button>
          </nav>
        </div>

        {/* Actions droite : bouton Retour à l'application + menu burger mobile */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retourner sur StudyCloud</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
            aria-label="Sommaire"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Sous-barre de sélection Mobile des 3 piliers */}
      <div className="md:hidden bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
        <button
          type="button"
          onClick={() => {
            setActiveTab('cgu');
            setActiveSectionId(SECTIONS_BY_TAB.cgu[0].id);
            scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
            activeTab === 'cgu' ? 'bg-gray-900 text-white' : 'text-gray-600 bg-white border border-gray-200'
          }`}
        >
          Conditions d'utilisation
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('privacy');
            setActiveSectionId(SECTIONS_BY_TAB.privacy[0].id);
            scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
            activeTab === 'privacy' ? 'bg-gray-900 text-white' : 'text-gray-600 bg-white border border-gray-200'
          }`}
        >
          Politique de confidentialité
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('mentions');
            setActiveSectionId(SECTIONS_BY_TAB.mentions[0].id);
            scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
            activeTab === 'mentions' ? 'bg-gray-900 text-white' : 'text-gray-600 bg-white border border-gray-200'
          }`}
        >
          Mentions légales
        </button>
      </div>

      {/* Menu Sommaire Mobile déroulant */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 px-6 py-4 space-y-2 shadow-sm shrink-0">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            Sommaire du document
          </p>
          {currentSections.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => scrollToSection(sec.id)}
              className={`block w-full text-left py-1.5 text-sm border-l-2 pl-3 transition-colors cursor-pointer ${
                activeSectionId === sec.id
                  ? 'border-orange-600 text-gray-900 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      )}

      {/* CONTENU PRINCIPAL PLEIN ÉCRAN (COLONNE GAUCHE SOMMAIRE + CORPS ÉDITORIAL BLANC) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto bg-white scroll-smooth"
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 py-10 sm:py-16">
          <div className="flex flex-col md:flex-row gap-10 lg:gap-16 items-start">

            {/* BARRE LATÉRALE GAUCHE STICKY (STYLE CLOUDFLARE) */}
            <aside className="hidden md:block w-64 lg:w-72 shrink-0 sticky top-10">
              <div className="mb-6">
                <p className="text-lg font-medium text-gray-900 tracking-tight mb-4">
                  {activeTab === 'cgu' && "conditions d'utilisation"}
                  {activeTab === 'privacy' && 'politique de confidentialité'}
                  {activeTab === 'mentions' && 'mentions légales'}
                </p>
                <div className="border-r border-gray-200 pr-4 space-y-3">
                  {currentSections.map((sec) => {
                    const isActive = activeSectionId === sec.id;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => scrollToSection(sec.id)}
                        className={`block w-full text-left text-[15px] leading-snug transition-colors cursor-pointer underline-offset-4 ${
                          isActive
                            ? 'text-gray-900 font-semibold underline decoration-gray-900'
                            : 'text-gray-600 hover:text-gray-900 underline decoration-gray-300'
                        }`}
                      >
                        {sec.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1 pr-4">
                <p>Version 4.3 — Novembre 2026</p>
                <p>Éditeur : DKD Technologies</p>
                <p>Fondateur : Dibi Kouassi Delmas</p>
              </div>
            </aside>

            {/* CORPS ÉDITORIAL SUR FOND BLANC PUR */}
            <main className="flex-1 max-w-3xl text-gray-800 space-y-10 pb-20">

              {/* =================== ONGLET 1 : CONDITIONS D'UTILISATION =================== */}
              {activeTab === 'cgu' && (
                <>
                  <header className="space-y-4 pb-8 border-b border-gray-200">
                    <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-tight text-gray-900 leading-[1.15]">
                      Conditions générales d'utilisation de StudyCloud
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600">
                      Les présentes conditions entrent en vigueur en novembre 2026.
                    </p>
                    <p className="text-sm sm:text-[15px] italic text-gray-600 leading-relaxed">
                      Édité par la société DKD Technologies — Plateforme créée et conçue par Dibi Kouassi Delmas, étudiant ivoirien en électrotechnique.
                    </p>
                  </header>

                  <section id="sc-legal-overview" className="scroll-mt-8 space-y-4">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      1. Aperçu et mission de la plateforme
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      Les présentes Conditions Générales d'Utilisation (« Conditions ») régissent l'accès et l'utilisation du site web et des services de <strong>StudyCloud</strong> (« nous », « notre » ou « DKD Technologies »). StudyCloud est un écosystème numérique polyvalent s'adressant à un large public : étudiants, élèves, professionnels, créateurs de contenus et particuliers.
                    </p>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      La plateforme réunit en un seul espace :
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-[16px] leading-[1.7] text-gray-700">
                      <li><strong>Un hub de ressources et pépites d'Internet :</strong> sélection d'outils gratuits, utilitaires web, logiciels et ressources incontournables pour gagner du temps ;</li>
                      <li><strong>Une place de marché et création de boutique en ligne :</strong> espace permettant aux utilisateurs de proposer et vendre leurs propres documents et contenus originaux ;</li>
                      <li><strong>Un espace d'organisation et de stockage Cloud :</strong> Classeur 3D, gestion par matières, calendrier, bloc-notes et sauvegarde sécurisée accessible sur ordinateur et téléphone ;</li>
                      <li><strong>Des fonctionnalités d'Intelligence Artificielle intégrées :</strong> outils d'aide à la synthèse, rédaction, questionnaires d'entraînement et devoirs guidés ;</li>
                      <li><strong>Un portail de partage direct (StudyCloud Share) :</strong> échange rapide de dossiers et fichiers par lien dédié.</li>
                    </ul>
                  </section>

                  <section id="sc-legal-marketplace" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      2. Création de boutique et vente de documents
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      StudyCloud met à disposition des outils techniques permettant à tout utilisateur d'ouvrir sa propre boutique et de commercialiser des documents numériques (fiches, résumés, guides pratiques, cours personnels).
                    </p>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      <strong>Interdiction formelle des contenus protégés et illicites :</strong> Il est strictement interdit de vendre, sans autorisation écrite préalable des ayants droit, des documents soumis au droit d'auteur (livres scannés, manuels scolaires ou universitaires protégés, œuvres tierces). Il est également formellement interdit de vendre ou diffuser tout contenu pornographique, érotique, violent, haineux ou frauduleux.
                    </p>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      Le créateur de la boutique garantit qu'il détient l'entière propriété intellectuelle des fichiers proposés à la vente. En cas d'infraction constatée, la boutique sera fermée immédiatement, le compte utilisateur définitivement banni et les faits signalés si nécessaire.
                    </p>
                  </section>

                  <section id="sc-legal-scam" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      3. Transactions entre utilisateurs & exonération en cas d'arnaque ou de vol
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      StudyCloud agit exclusivement en qualité d'intermédiaire technique mettant à disposition l'infrastructure logicielle de vitrine et de partage.
                    </p>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      <strong>DKD Technologies et son fondateur Dibi Kouassi Delmas ne sauraient en aucun cas être tenus responsables en cas d'arnaque, d'escroquerie, de vol, de fraude, de défaut de livraison ou de non-conformité commis par un utilisateur au détriment d'un autre.</strong>
                    </p>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      Tout utilisateur effectuant un achat auprès d'une boutique tierce ou concluant un accord privé avec un autre membre en assume seul et intégralement les risques. StudyCloud ne procède à aucun dédommagement ni remboursement au titre de litiges privés survenus entre utilisateurs. Tout auteur d'escroquerie identifié est immédiatement exclu de la plateforme.
                    </p>
                  </section>

                  <section id="sc-legal-resources" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      4. Publication dans le menu Ressources & Bouton de signalement
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      L'utilisateur qui publie un document, un lien ou une ressource dans la section publique « Ressources » ou via un lien StudyCloud Share en demeure le seul responsable civil et pénal. Il lui est strictement interdit de publier des œuvres protégées par le droit d'auteur sans autorisation, des contenus pornographiques ou des fichiers malveillants.
                    </p>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      <strong>Système de signalement :</strong> Des boutons « Signaler » sont mis à disposition pour permettre à tout utilisateur de signaler instantanément un contenu abusif, illégal ou qui ne respecte pas les présentes conditions. Dès réception d'un signalement vérifié, nous procédons au retrait immédiat du contenu concerné.
                    </p>
                  </section>

                  <section id="sc-legal-storage" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      5. Stockage Cloud : achat définitif, évolution et impayés
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      Chaque compte bénéficie d'un quota gratuit de bienvenue. Des formules payantes permettent d'étendre cet espace selon les besoins.
                    </p>
                    <ul className="list-disc pl-6 space-y-2 text-[16px] leading-[1.7] text-gray-700">
                      <li><strong>Achat non remboursable :</strong> Tout achat ou renouvellement d'espace de stockage est ferme et définitif. Aucun remboursement n'est accordé après activation.</li>
                      <li><strong>Augmentation uniquement (diminution impossible) :</strong> Une fois une formule d'espace achetée, il n'est plus possible de la diminuer ni de rétrograder vers une capacité inférieure pendant la période en cours ; seule une augmentation vers une offre supérieure est possible.</li>
                      <li><strong>Gestion des impayés :</strong> Si l'utilisateur ne règle pas le renouvellement de l'espace qu'il occupe au-delà du délai de tolérance après notification, l'accès à son espace étendu est suspendu. S'il persiste à ne pas régulariser sa situation, <strong>ses données et fichiers excédentaires seront définitivement effacés des serveurs pour libérer de l'espace</strong>, sans aucune possibilité d'indemnisation.</li>
                    </ul>
                  </section>

                  <section id="sc-legal-ai" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      6. Fonctionnalités d'Intelligence Artificielle et consommation des crédits
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      Les fonctionnalités d'Intelligence Artificielle intégrées à StudyCloud sont des outils d'aide à la productivité et à l'étude dont les réponses ont un caractère purement indicatif.
                    </p>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      <strong>Consommation ferme des crédits :</strong> Chaque requête ou tentative de création lancée par l'utilisateur consomme des ressources serveurs. <strong>Si l'IA consomme des crédits en tentant d'effectuer une tâche ou de créer un contenu et que le résultat obtenu est imparfait, incomplet ou insatisfaisant pour l'utilisateur, les crédits débités restent définitivement acquis et ne donnent lieu à aucun remboursement ni recrédit.</strong> DKD Technologies et Dibi Kouassi Delmas ne sont pas responsables de la précision des contenus produits par l'IA.
                    </p>
                  </section>

                  <section id="sc-legal-security" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      7. Sécurité, interdiction des attaques et continuité de service
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      Toute tentative de piratage, de scan de vulnérabilité, d'extraction automatisée non autorisée ou d'attaque par déni de service (DDoS) est formellement interdite et passible de poursuites. DKD Technologies se réserve le droit souverain de suspendre ou supprimer sans préavis tout compte présentant un comportement nuisible.
                    </p>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      Des interruptions ponctuelles pour maintenance technique ou incidents réseau indépendants de notre volonté peuvent survenir sans ouvrir droit à une quelconque indemnisation.
                    </p>
                  </section>
                </>
              )}

              {/* =================== ONGLET 2 : POLITIQUE DE CONFIDENTIALITÉ =================== */}
              {activeTab === 'privacy' && (
                <>
                  <header className="space-y-4 pb-8 border-b border-gray-200">
                    <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-tight text-gray-900 leading-[1.15]">
                      Politique de confidentialité de StudyCloud
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600">
                      La présente politique de confidentialité entre en vigueur en novembre 2026.
                    </p>
                    <p className="text-sm sm:text-[15px] italic text-gray-600 leading-relaxed">
                      La présente politique de confidentialité de StudyCloud (« Politique ») décrit les informations personnelles que DKD Technologies (« nous », « notre » ou « nos ») recueille, la manière dont nous utilisons ces informations et les droits dont vous disposez pour y accéder, les corriger ou les supprimer définitivement.
                    </p>
                  </header>

                  <section id="sc-legal-privacy-overview" className="scroll-mt-8 space-y-4">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      1. Aperçu
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      La protection de votre vie privée et la confidentialité de vos documents sont au cœur de la conception de StudyCloud. Nous collectons uniquement les données strictement nécessaires pour assurer le fonctionnement de votre espace Cloud, vos classeurs et vos créations.
                    </p>
                  </section>

                  <section id="sc-legal-data-collected" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      2. Informations que nous recueillons
                    </h2>
                    <ul className="list-disc pl-6 space-y-2 text-[16px] leading-[1.7] text-gray-700">
                      <li><strong>Données d'inscription et de compte :</strong> nom, prénom, adresse email, photo de profil facultative et mot de passe protégé par hachage cryptographique fort.</li>
                      <li><strong>Contenus et fichiers personnels :</strong> documents, médias, notes, emplois du temps et boutiques que vous enregistrez volontairement dans StudyCloud.</li>
                      <li><strong>Données techniques de sécurité :</strong> adresse IP et jetons d'authentification temporaires utilisés exclusivement pour bloquer les tentatives d'intrusion.</li>
                    </ul>
                  </section>

                  <section id="sc-legal-non-sale" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      3. Engagements de non-revente et respect des données
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      <strong>Zéro revente commerciale :</strong> DKD Technologies ne vend, ne loue et ne cède jamais vos données personnelles, vos adresses emails ou vos fichiers à des tiers, annonceurs ou régies publicitaires.
                    </p>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      Les documents déposés dans votre Dossier Sécurisé protégé par code PIN sont isolés et restent strictement privés. Les requêtes adressées aux fonctionnalités IA intégrées sont traitées de manière isolée et ne sont pas revendues pour entraîner des modèles commerciaux externes.
                    </p>
                  </section>

                  <section id="sc-legal-cookies-pwa" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      4. Cookies, stockage local et mode hors-ligne (PWA)
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      StudyCloud utilise le stockage local de votre navigateur et les technologies PWA uniquement à des fins techniques : maintenir votre session active, mémoriser votre thème ou langue préférée et autoriser la consultation hors-ligne de vos fichiers mis en cache. Aucun traceur publicitaire tiers n'est déployé.
                    </p>
                  </section>

                  <section id="sc-legal-account-deletion" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      5. Conservation et droit à l'effacement total (« Supprimer mon compte »)
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      Vos fichiers restent conservés tant que votre compte est actif et que votre espace est maintenu conformément aux formules souscrites. Vous disposez à tout moment dans vos paramètres d'un bouton <strong>« Supprimer mon compte »</strong> vous permettant d'effacer immédiatement et irréversiblement l'intégralité de vos fichiers et informations personnelles.
                    </p>
                  </section>
                </>
              )}

              {/* =================== ONGLET 3 : MENTIONS LÉGALES =================== */}
              {activeTab === 'mentions' && (
                <>
                  <header className="space-y-4 pb-8 border-b border-gray-200">
                    <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-tight text-gray-900 leading-[1.15]">
                      Mentions légales de StudyCloud
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600">
                      Informations officielles d'identification de l'éditeur.
                    </p>
                  </header>

                  <section id="sc-legal-publisher" className="scroll-mt-8 space-y-4">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      1. Éditeur de la plateforme & fondateur
                    </h2>
                    <ul className="list-none space-y-2.5 text-[16px] leading-[1.7] text-gray-700">
                      <li><strong>Société propriétaire et éditrice :</strong> DKD Technologies</li>
                      <li><strong>Créateur, concepteur et fondateur :</strong> Dibi Kouassi Delmas (étudiant ivoirien en filière électrotechnique et développeur-concepteur de la plateforme StudyCloud)</li>
                      <li><strong>Service édité :</strong> StudyCloud (Site web et application web progressive)</li>
                      <li><strong>Support officiel et signalements :</strong> contact@dkd-technologies.com / support@studycloud.app</li>
                    </ul>
                  </section>

                  <section id="sc-legal-ip" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      2. Propriété intellectuelle
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      L'ensemble de la structure du site StudyCloud, ses textes, interfaces, modèles visuels 3D, logos et logiciels sont la propriété exclusive de DKD Technologies et de son concepteur Dibi Kouassi Delmas. Toute reproduction, copie ou exploitation non autorisée est strictement interdite.
                    </p>
                  </section>

                  <section id="sc-legal-law" className="scroll-mt-8 space-y-4 pt-6 border-t border-gray-100">
                    <h2 className="text-2xl font-normal text-gray-900 tracking-tight">
                      3. Droit applicable et règlement des différends
                    </h2>
                    <p className="text-[16px] leading-[1.7] text-gray-700">
                      Les présentes dispositions sont régies par le droit en vigueur. En cas de différend, l'utilisateur est invité à contacter en priorité le service support officiel à l'adresse <strong>contact@dkd-technologies.com</strong> en vue d'une résolution amiable.
                    </p>
                  </section>
                </>
              )}

            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

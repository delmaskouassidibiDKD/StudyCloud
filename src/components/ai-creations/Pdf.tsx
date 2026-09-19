import { useState } from 'react';
import { Printer, Download, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react';

export default function Pdf() {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [downloaded, setDownloaded] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const textContent = `================================================================================
ÉNERGIE SOLAIRE PHOTOVOLTAÏQUE — MANUEL POUR TECHNICIENS
SUPPORT APPRENANT — DOCUMENT OFFICIEL DE FORMATION
Édité par les Drs TANOE & OYEDELE
Partenaires institutionnels : DGE | CME | ISA
================================================================================

OBJECTIF GÉNÉRAL DU MANUEL :
Comprendre la conversion photovoltaïque, analyser une architecture, 
dimensionner les principaux composants, réaliser les vérifications électriques, 
participer au câblage, mettre en service et assurer la maintenance/diagnostic d'une installation PV.

--------------------------------------------------------------------------------
PAGE 1 — PAGE DE GARDE ET IDENTIFICATION
--------------------------------------------------------------------------------
• Titre : ÉNERGIE SOLAIRE PHOTOVOLTAÏQUE — Manuel pour techniciens
• Organismes partenaires : Direction Générale de l'Énergie (DGE), Centre des Métiers de l'Électricité (CME), International Solar Alliance (ISA).
• Destinataire : Support apprenant pour techniciens et installateurs agréés.
• Références formateurs : Édité par les Drs TANOE & OYEDELE.

--------------------------------------------------------------------------------
PAGE 2 — SOMMAIRE GÉNÉRAL DU MANUEL
--------------------------------------------------------------------------------
• PARTIE I   : Fondamentaux scientifiques et technologiques (Page 04)
• PARTIE II  : Architectures et fonctionnement des systèmes PV (Page 12)
• PARTIE III : Dimensionnement des installations photovoltaïques (Page 24)
• PARTIE IV  : Câbles, protections et schémas électriques (Page 38)
• PARTIE V   : Installation, mise en service et travaux pratiques (Page 52)
• PARTIE VI  : Maintenance, diagnostic et instrumentation (Page 68)

Normes réglementaires :
- UTE C 15-712-1 : Installations PV raccordées au réseau
- UTE C 15-712-2 : Installations autonomes avec stockage batteries
- NF C 15-100   : Règles générales basse tension

--------------------------------------------------------------------------------
PAGE 3 — FONDAMENTAUX ET ARCHITECTURES DES SYSTÈMES PV
--------------------------------------------------------------------------------
1. LE GISEMENT SOLAIRE & EFFET PHOTOVOLTAÏQUE :
- Rayonnement global = Direct + Diffus + Albedo (réfléchi par le sol).
- Conditions standards STC : Irradiance 1000 W/m², Température cellule 25°C, Spectre AM 1.5.
- Influence thermique : Toute augmentation de température réduit la tension Voc et le rendement (-0.4%/°C sur le silicium).

2. LES 3 GRANDES ARCHITECTURES SYSTÈMES :
- Systèmes Autonomes (Site isolé) : Panneaux -> Régulateur MPPT -> Batteries -> Onduleur/Chargeur -> Récepteur.
- Systèmes Raccordés Réseau (Grid-Tied) : Panneaux -> Onduleur réseau synchronisé -> Tableau AC -> Réseau public.
- Systèmes Hybrides : Association solaire PV + Stockage batterie + Générateur de secours (groupe ou réseau).

--------------------------------------------------------------------------------
PAGE 4 — FORMULES CLÉS ET DIMENSIONNEMENT
--------------------------------------------------------------------------------
1. ÉNERGIE PRODUITE JOURNALIÈRE :
   E_prod = P_c × HSP × PR  [Wh/jour]
   (P_c : Puissance crête en Wc | HSP : Heures d'ensoleillement plein | PR : Performance Ratio ~0.80)

2. CAPACITÉ DU PARC DE BATTERIES :
   C_bat = (E_j × N_autonomie) / (U_bat × DoD)  [Ampères-heures (Ah)]
   (DoD max conseillé : 50% pour batterie Plomb, 85% pour LiFePO4)

3. SECTION DES CÂBLES DC :
   S = (2 × L × I_max × ρ) / ΔU  [mm²]
   (Chute de tension maximale tolérée en DC : inférieure à 1.5%)

4. TENSION MAXIMALE À FROID :
   Voc_max = N_s × Voc_stc × [1 + γ × (T_min - 25°C)]

--------------------------------------------------------------------------------
PAGE 5 — SÉCURITÉ, MISE EN SERVICE ET CONTRÔLES
--------------------------------------------------------------------------------
LES 4 RÈGLES DE SÉCURITÉ VITALE :
1. Ne jamais débrancher un connecteur MC4 sous charge (danger mortel d'arc électrique continu).
2. Toujours raccorder la batterie au régulateur avant de brancher les panneaux solaires.
3. Vérifier systématiquement la polarité (+ et -) au multimètre avant tout couplage.
4. Équipements de protection individuelle (EPI) obligatoires : gants isolants 1000V DC et écran facial.

PROCÉDURE CHRONOLOGIQUE DE MISE EN SERVICE (6 ÉTAPES) :
• Étape 1 : Contrôle visuel et vérification du serrage des bornes au tournevis dynamométrique.
• Étape 2 : Mesure de la continuité de terre et liaison équipotentielle (< 2 Ohms).
• Étape 3 : Contrôle de polarité des strings DC.
• Étape 4 : Mesure de la tension à vide (Voc) de chaque chaîne de panneaux.
• Étape 5 : Enclenchement de la protection AC, puis fermeture du sectionneur DC.
• Étape 6 : Relevé de la puissance injectée et contrôle thermique des connexions.

[Fin du document officiel - Édition 2026]
`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Manuel_Technicien_Energie_Solaire_PV.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  return (
    <div id="module-pdf" className="w-full min-h-screen bg-stone-200/80 pb-24">
      {/* 
        BARRE D'OUTILS COLLÉE TOUT EN HAUT ET FIXE (STICKY)
        Occupe immédiatement l'espace sous la navigation, sur une seule ligne.
      */}
      <div
        id="pdf-sticky-bar"
        className="sticky top-[53px] sm:top-[57px] z-40 w-full bg-stone-900 text-stone-100 border-b border-stone-800 shadow-md px-3 sm:px-6 py-2 overflow-x-auto"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-center sm:justify-end gap-2 sm:gap-3 flex-nowrap min-w-max sm:min-w-0">
          {/* Contrôleur de Zoom */}
          <div className="flex items-center bg-stone-800 rounded-lg p-0.5 border border-stone-700 text-xs shrink-0">
            <button
              id="btn-zoom-out"
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              className="p-1.5 hover:bg-stone-700 rounded text-stone-300 hover:text-white transition-colors"
              title="Zoom arrière"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono font-medium text-stone-200 min-w-[36px] text-center">
              {zoomLevel}%
            </span>
            <button
              id="btn-zoom-in"
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              className="p-1.5 hover:bg-stone-700 rounded text-stone-300 hover:text-white transition-colors"
              title="Zoom avant"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoomLevel !== 100 && (
              <button
                onClick={() => setZoomLevel(100)}
                className="p-1.5 hover:bg-stone-700 rounded text-stone-400 hover:text-stone-200 transition-colors border-l border-stone-700"
                title="Réinitialiser le zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Bouton Imprimer */}
          <button
            id="btn-pdf-print"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-semibold text-stone-200 hover:text-white transition-all shadow-xs active:scale-95 shrink-0"
            title="Imprimer le document"
          >
            <Printer className="w-3.5 h-3.5 text-stone-300" />
            <span>Imprimer</span>
          </button>

          {/* Bouton Télécharger */}
          <button
            id="btn-pdf-download"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-xs active:scale-95 shrink-0"
            title="Télécharger le document"
          >
            {downloaded ? (
              <>
                <Check className="w-3.5 h-3.5 text-stone-950" />
                <span>Téléchargé !</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger</span>
              </>
            )}
          </button>

          {/* Nombre total de pages */}
          <div
            id="pdf-total-pages-badge"
            className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 text-xs font-medium shrink-0 select-none"
          >
            5 pages
          </div>
        </div>
      </div>

      {/* 
        FLUX DE PAGES SUCCESSIVES NORMALISÉES :
        Chaque page est un conteneur indépendant, aux proportions A4 avec hauteur minimale adaptée,
        séparé des autres pages par un espacement net. Les textes ne se chevauchent jamais.
      */}
      <main
        id="pdf-pages-stream"
        style={{
          transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : undefined,
          transformOrigin: 'top center',
          transition: 'transform 0.15s ease-out'
        }}
        className="w-full max-w-3xl mx-auto px-3 sm:px-6 pt-6 space-y-12"
      >
        {/* ============================================================ */}
        {/* PAGE 1 : PAGE DE GARDE / COUVERTURE OFFICIELLE               */}
        {/* ============================================================ */}
        <article
          id="pdf-page-1"
          className="pdf-page relative bg-white w-full shadow-2xl border border-stone-300 rounded-sm mx-auto p-6 sm:p-10 md:p-12 flex flex-col justify-between text-stone-900 select-text"
          style={{ minHeight: '960px' }}
        >
          {/* En-tête Logos Institutionnels */}
          <header className="w-full flex items-center justify-between border-b border-stone-200 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-emerald-700 flex items-center justify-center text-white font-black text-xs shadow-xs">
                DGE
              </div>
              <div>
                <span className="text-xs font-black text-stone-900 block leading-tight">DGE</span>
                <span className="text-[9px] text-stone-500 block">Direction Générale de l'Énergie</span>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="flex items-center gap-0.5">
                <span className="text-lg font-black text-red-600">cm</span>
                <span className="text-lg font-black text-emerald-600">e</span>
              </div>
              <span className="text-[8px] font-semibold text-stone-500 text-center">
                Centre des Métiers de l'Électricité
              </span>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-base font-black tracking-wider text-amber-700">ISA</span>
              <span className="text-[8px] font-bold text-stone-500 uppercase tracking-wider">
                Solar Alliance
              </span>
            </div>
          </header>

          {/* Corps Page 1 : Titres & Illustration Panneaux Solaire */}
          <div className="my-auto py-4 space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-stone-900 tracking-tight uppercase font-serif">
                ÉNERGIE SOLAIRE PHOTOVOLTAÏQUE
              </h1>
              <p className="text-base sm:text-lg font-bold text-cyan-800">
                Manuel pour techniciens
              </p>
            </div>

            {/* Illustration SVG Solaire Techniciens */}
            <div className="w-full max-w-md mx-auto">
              <div className="relative w-full aspect-[16/9] max-h-[230px] bg-gradient-to-b from-sky-50 via-stone-50 to-stone-100 rounded-xl border border-stone-300 p-3 flex flex-col items-center justify-center overflow-hidden shadow-inner">
                <svg viewBox="0 0 500 280" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  {/* Soleil */}
                  <circle cx="430" cy="50" r="26" fill="#FBBF24" opacity="0.9" />
                  <path d="M430 14 L430 20 M430 80 L430 86 M394 50 L400 50 M460 50 L466 50" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Sol */}
                  <ellipse cx="250" cy="245" rx="220" ry="24" fill="#E2E8F0" />

                  {/* Panneau 1 */}
                  <g transform="translate(80, 95)">
                    <path d="M30 120 L30 140 M110 120 L110 140 M30 140 L110 140" stroke="#64748B" strokeWidth="3" />
                    <polygon points="10,120 130,120 110,45 0,45" fill="#1E293B" stroke="#0EA5E9" strokeWidth="2" />
                    <line x1="25" y1="45" x2="35" y2="120" stroke="#38BDF8" strokeWidth="0.8" opacity="0.7" />
                    <line x1="55" y1="45" x2="65" y2="120" stroke="#38BDF8" strokeWidth="0.8" opacity="0.7" />
                    <line x1="85" y1="45" x2="95" y2="120" stroke="#38BDF8" strokeWidth="0.8" opacity="0.7" />
                  </g>

                  {/* Panneau 2 */}
                  <g transform="translate(180, 110)">
                    <path d="M40 120 L40 140 M130 120 L130 140 M40 140 L130 140" stroke="#64748B" strokeWidth="3" />
                    <polygon points="15,120 150,120 130,35 5,35" fill="#0F172A" stroke="#38BDF8" strokeWidth="2" />
                    <line x1="35" y1="35" x2="45" y2="120" stroke="#0284C7" strokeWidth="1" />
                    <line x1="70" y1="35" x2="80" y2="120" stroke="#0284C7" strokeWidth="1" />
                    <line x1="105" y1="35" x2="115" y2="120" stroke="#0284C7" strokeWidth="1" />
                  </g>

                  {/* Technicien */}
                  <g transform="translate(240, 65)">
                    <path d="M12 25 Q18 16 24 25 Z" fill="#F59E0B" />
                    <circle cx="18" cy="28" r="5" fill="#D97706" />
                    <path d="M12 34 L24 34 L27 65 L9 65 Z" fill="#EA580C" />
                    <rect x="11" y="44" width="14" height="3" fill="#FEF08A" />
                    <path d="M12 36 L4 55 M24 36 L30 50" stroke="#EA580C" strokeWidth="4" strokeLinecap="round" />
                    <line x1="14" y1="65" x2="13" y2="105" stroke="#334155" strokeWidth="4.5" strokeLinecap="round" />
                    <line x1="22" y1="65" x2="23" y2="105" stroke="#334155" strokeWidth="4.5" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Badge Support */}
            <div>
              <span className="inline-block px-3.5 py-1 rounded bg-stone-100 border border-stone-300 text-xs font-extrabold text-stone-800 uppercase tracking-wider">
                SUPPORT APPRENANT
              </span>
            </div>

            {/* Objectif */}
            <div className="w-full text-left bg-sky-50/90 border border-sky-200 rounded-lg p-3.5 space-y-1">
              <span className="text-xs font-black text-sky-950 uppercase tracking-wider block">
                OBJECTIF :
              </span>
              <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                Comprendre la conversion photovoltaïque, analyser une architecture, dimensionner les principaux composants, réaliser les vérifications électriques, participer au câblage, mettre en service et assurer la maintenance/diagnostic d'une installation PV.
              </p>
            </div>

            {/* Inscription de l'élève */}
            <div className="w-full max-w-sm mx-auto space-y-2 text-left text-xs sm:text-sm text-stone-700">
              <div className="flex items-end gap-2">
                <span className="font-bold text-stone-900 shrink-0">Nom :</span>
                <div className="grow border-b border-stone-400 pb-0.5 text-stone-400 italic text-xs">
                  (Renseignez votre nom)
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="font-bold text-stone-900 shrink-0">Session :</span>
                <div className="grow border-b border-stone-400 pb-0.5 text-stone-500 italic text-xs">
                  Promotion Techniciens 2026
                </div>
              </div>
            </div>
          </div>

          {/* Pied de page Page 1 */}
          <footer className="w-full pt-3 border-t border-stone-300 flex items-center justify-between text-[10px] sm:text-xs text-stone-500">
            <span className="truncate">
              Formation technique | Support de référence édité par les Drs TANOE & OYEDELE
            </span>
            <span className="font-bold font-mono text-stone-900 ml-2">1</span>
          </footer>
        </article>

        {/* ============================================================ */}
        {/* PAGE 2 : SOMMAIRE GÉNÉRAL DU MANUEL (Nouvelle Page Dédiée)   */}
        {/* ============================================================ */}
        <article
          id="pdf-page-2"
          className="pdf-page relative bg-white w-full shadow-2xl border border-stone-300 rounded-sm mx-auto p-6 sm:p-10 md:p-12 flex flex-col justify-between text-stone-900 select-text"
          style={{ minHeight: '960px' }}
        >
          {/* En-tête Page 2 */}
          <header className="w-full flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded bg-emerald-700 flex items-center justify-center text-white font-bold text-[10px]">
                DGE
              </div>
              <span className="text-xs font-bold text-stone-800">Direction Générale de l'Énergie</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-sm font-black text-red-600">cm</span>
              <span className="text-sm font-black text-emerald-600">e</span>
            </div>
            <span className="text-xs font-bold text-amber-700 uppercase">ISA Solar</span>
          </header>

          {/* Corps Page 2 : Sommaire aéré */}
          <div className="my-auto py-4 space-y-4">
            <div className="border-b-2 border-stone-900 pb-2">
              <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-tight font-serif">
                SOMMAIRE GÉNÉRAL
              </h2>
              <span className="text-xs text-stone-500 font-medium">
                Programme de formation et compétences techniques
              </span>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-md space-y-1">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>PARTIE I — Fondamentaux scientifiques et technologiques</span>
                  <span className="font-mono text-stone-500">Page 04</span>
                </div>
                <p className="text-stone-600 text-xs leading-relaxed">
                  Rayonnement solaire (direct, diffus, albedo), effet photovoltaïque, jonction P-N, caractéristiques électriques I-V et P-V sous conditions STC.
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-md space-y-1">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>PARTIE II — Architectures et fonctionnement des systèmes PV</span>
                  <span className="font-mono text-stone-500">Page 12</span>
                </div>
                <p className="text-stone-600 text-xs leading-relaxed">
                  Systèmes autonomes isolés avec stockage batteries, systèmes raccordés au réseau électrique (onduleurs string) et systèmes hybrides avec appoint.
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-md space-y-1">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>PARTIE III — Dimensionnement des installations photovoltaïques</span>
                  <span className="font-mono text-stone-500">Page 24</span>
                </div>
                <p className="text-stone-600 text-xs leading-relaxed">
                  Bilan énergétique journalier, gisement solaire local (HSP), calcul de puissance crête requise et dimensionnement du parc de batteries.
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-md space-y-1">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>PARTIE IV — Câbles, protections et schémas électriques</span>
                  <span className="font-mono text-stone-500">Page 38</span>
                </div>
                <p className="text-stone-600 text-xs leading-relaxed">
                  Calcul des sections de conducteurs DC, limitation des chutes de tension (&lt; 1,5%), fusibles gPV, parafoudres DC/AC et liaison équipotentielle.
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-md space-y-1">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>PARTIE V — Installation, mise en service et travaux pratiques</span>
                  <span className="font-mono text-stone-500">Page 52</span>
                </div>
                <p className="text-stone-600 text-xs leading-relaxed">
                  Pose sécurisée en toiture, sertissage des connecteurs MC4, vérification des polarités et mise sous tension séquentielle.
                </p>
              </div>

              <div className="p-3 bg-stone-50 border border-stone-200 rounded-md space-y-1">
                <div className="flex justify-between font-bold text-stone-900">
                  <span>PARTIE VI — Maintenance, diagnostic et instrumentation</span>
                  <span className="font-mono text-stone-500">Page 68</span>
                </div>
                <p className="text-stone-600 text-xs leading-relaxed">
                  Mesures de Voc et Isc, thermographie infrarouge des points chauds, résistance d'isolement et recherche de pannes.
                </p>
              </div>
            </div>

            {/* Normes de référence */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-md p-2.5 text-xs text-stone-800">
              <span className="font-bold block mb-1">Rappels des normes de conformité :</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[11px] text-stone-700">
                <span>• <strong>UTE C 15-712-1 :</strong> Raccordé réseau</span>
                <span>• <strong>UTE C 15-712-2 :</strong> Sites isolés</span>
                <span>• <strong>NF C 15-100 :</strong> Basse tension</span>
              </div>
            </div>
          </div>

          {/* Pied de page Page 2 */}
          <footer className="w-full pt-3 border-t border-stone-300 flex items-center justify-between text-[10px] sm:text-xs text-stone-500">
            <span>Manuel pour techniciens | Support apprenant</span>
            <span className="font-bold font-mono text-stone-900 ml-2">2</span>
          </footer>
        </article>

        {/* ============================================================ */}
        {/* PAGE 3 : FONDAMENTAUX & ARCHITECTURES (Nouvelle Page Dédiée) */}
        {/* ============================================================ */}
        <article
          id="pdf-page-3"
          className="pdf-page relative bg-white w-full shadow-2xl border border-stone-300 rounded-sm mx-auto p-6 sm:p-10 md:p-12 flex flex-col justify-between text-stone-900 select-text"
          style={{ minHeight: '960px' }}
        >
          {/* En-tête Page 3 */}
          <header className="w-full flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded bg-emerald-700 flex items-center justify-center text-white font-bold text-[10px]">
                DGE
              </div>
              <span className="text-xs font-bold text-stone-800">Direction Générale de l'Énergie</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-sm font-black text-red-600">cm</span>
              <span className="text-sm font-black text-emerald-600">e</span>
            </div>
            <span className="text-xs font-bold text-amber-700 uppercase">ISA Solar</span>
          </header>

          {/* Corps Page 3 : Fondamentaux & Architectures */}
          <div className="my-auto py-4 space-y-5">
            <div className="border-b-2 border-stone-900 pb-2">
              <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-tight font-serif">
                1. FONDAMENTAUX & ARCHITECTURES SYSTÈMES
              </h2>
              <span className="text-xs text-stone-500 font-medium">
                Principes de conversion et typologie des installations PV
              </span>
            </div>

            {/* Bloc Gisement et STC */}
            <div className="space-y-2 text-xs sm:text-sm text-stone-800">
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wide">
                A. Effet Photovoltaïque et Conditions Standards (STC)
              </h3>
              <p className="leading-relaxed">
                Les cellules au silicium convertissent directement le flux de photons incidents en courant continu (DC) par excitation des électrons de la jonction P-N. Les caractéristiques de puissance d'un panneau solaire sont toujours certifiées en laboratoire sous les <strong>conditions STC</strong> (Standard Test Conditions) :
              </p>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2.5 bg-stone-100 rounded border border-stone-200">
                  <span className="block text-[11px] text-stone-500">Irradiance</span>
                  <span className="block font-black text-stone-900 text-sm">1 000 W/m²</span>
                </div>
                <div className="p-2.5 bg-stone-100 rounded border border-stone-200">
                  <span className="block text-[11px] text-stone-500">Température Cellule</span>
                  <span className="block font-black text-stone-900 text-sm">25 °C</span>
                </div>
                <div className="p-2.5 bg-stone-100 rounded border border-stone-200">
                  <span className="block text-[11px] text-stone-500">Masse d'Air Spectrale</span>
                  <span className="block font-black text-stone-900 text-sm">AM 1.5</span>
                </div>
              </div>
            </div>

            {/* Bloc Les 3 Architectures */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wide">
                B. Les 3 Grandes Familles d'Architectures
              </h3>

              <div className="space-y-2 text-xs text-stone-700">
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
                  <span className="font-bold text-stone-900 text-xs block mb-1">
                    1. Système Autonome (Site Isolé)
                  </span>
                  <p>
                    Composé d'un champ PV, d'un <strong>régulateur de charge MPPT</strong>, d'un banc de batteries de stockage (Plomb ou Lithium) et d'un onduleur autonome créateur de réseau. Indispensable pour l'électrification rurale sans accès au réseau public.
                  </p>
                </div>

                <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
                  <span className="font-bold text-stone-900 text-xs block mb-1">
                    2. Système Raccordé au Réseau (Grid-Connected)
                  </span>
                  <p>
                    L'énergie produite est immédiatement injectée sur le réseau de distribution via un <strong>onduleur synchronisé</strong>. En cas de coupure du réseau externe, l'onduleur s'arrête automatiquement en quelques millisecondes (protection anti-îlotage obligatoire DIN VDE 0126).
                  </p>
                </div>

                <div className="p-3 bg-stone-50 border border-stone-200 rounded-md">
                  <span className="font-bold text-stone-900 text-xs block mb-1">
                    3. Système Hybride (Micro-réseau)
                  </span>
                  <p>
                    Combine l'énergie solaire, un stockage sur batteries et une source d'appoint thermique (groupe électrogène ou appoint réseau). Permet une autonomie maximale avec continuité de service permanente.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pied de page Page 3 */}
          <footer className="w-full pt-3 border-t border-stone-300 flex items-center justify-between text-[10px] sm:text-xs text-stone-500">
            <span>Formation technique | Support de référence édité par les Drs TANOE & OYEDELE</span>
            <span className="font-bold font-mono text-stone-900 ml-2">3</span>
          </footer>
        </article>

        {/* ============================================================ */}
        {/* PAGE 4 : FORMULES DE CALCUL & DIMENSIONNEMENT (Nouvelle Page)*/}
        {/* ============================================================ */}
        <article
          id="pdf-page-4"
          className="pdf-page relative bg-white w-full shadow-2xl border border-stone-300 rounded-sm mx-auto p-6 sm:p-10 md:p-12 flex flex-col justify-between text-stone-900 select-text"
          style={{ minHeight: '960px' }}
        >
          {/* En-tête Page 4 */}
          <header className="w-full flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded bg-emerald-700 flex items-center justify-center text-white font-bold text-[10px]">
                DGE
              </div>
              <span className="text-xs font-bold text-stone-800">Direction Générale de l'Énergie</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-sm font-black text-red-600">cm</span>
              <span className="text-sm font-black text-emerald-600">e</span>
            </div>
            <span className="text-xs font-bold text-amber-700 uppercase">ISA Solar</span>
          </header>

          {/* Corps Page 4 : Formules Clés bien aérées */}
          <div className="my-auto py-4 space-y-5">
            <div className="border-b-2 border-stone-900 pb-2">
              <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-tight font-serif">
                2. FORMULES DE CALCUL & DIMENSIONNEMENT
              </h2>
              <span className="text-xs text-stone-500 font-medium">
                Relations mathématiques et critères d'ingénierie électrique
              </span>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              {/* Formule 1 */}
              <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-900 text-sm">Énergie Produite Estimée Journalière</span>
                  <span className="text-[11px] font-mono text-stone-500">[Wh/jour]</span>
                </div>
                <div className="bg-stone-900 text-amber-400 p-2 rounded font-mono text-xs sm:text-sm">
                  E_prod = P_c × HSP × PR
                </div>
                <p className="text-[11px] text-stone-600">
                  • <strong>P_c :</strong> Puissance crête totale installée (en Wc)<br />
                  • <strong>HSP :</strong> Heures de Soleil Plein (équivalent ensoleillement à 1000 W/m²)<br />
                  • <strong>PR :</strong> Ratio de performance global du système (généralement 0,75 à 0,85)
                </p>
              </div>

              {/* Formule 2 */}
              <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-900 text-sm">Capacité Nominale de la Batterie</span>
                  <span className="text-[11px] font-mono text-stone-500">[Ampères-heures (Ah)]</span>
                </div>
                <div className="bg-stone-900 text-amber-400 p-2 rounded font-mono text-xs sm:text-sm">
                  C_bat = (E_j × N_autonomie) / (U_bat × DoD)
                </div>
                <p className="text-[11px] text-stone-600">
                  • <strong>E_j :</strong> Consommation journalière totale (Wh/jour)<br />
                  • <strong>N_autonomie :</strong> Nombre de jours sans soleil (ex. 2 à 3 jours)<br />
                  • <strong>U_bat :</strong> Tension nominale du parc (12V, 24V ou 48V)<br />
                  • <strong>DoD :</strong> Profondeur de décharge maximale admissible (0,50 pour Plomb, 0,85 pour Lithium)
                </p>
              </div>

              {/* Formule 3 */}
              <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-900 text-sm">Section Minimale des Câbles DC</span>
                  <span className="text-[11px] font-mono text-stone-500">[mm²]</span>
                </div>
                <div className="bg-stone-900 text-amber-400 p-2 rounded font-mono text-xs sm:text-sm">
                  S = (2 × L × I_max × ρ) / ΔU_max
                </div>
                <p className="text-[11px] text-stone-600">
                  • <strong>L :</strong> Longueur simple aller du conducteur en cuivre (en mètres)<br />
                  • <strong>I_max :</strong> Courant maximal admissible (A)<br />
                  • <strong>ρ :</strong> Résistivité du cuivre (0,02314 Ω·mm²/m sous échauffement)<br />
                  • <strong>ΔU_max :</strong> Chute de tension maximale tolérée côté DC (stricte : &lt; 1,5%)
                </p>
              </div>
            </div>
          </div>

          {/* Pied de page Page 4 */}
          <footer className="w-full pt-3 border-t border-stone-300 flex items-center justify-between text-[10px] sm:text-xs text-stone-500">
            <span>Manuel pour techniciens | Support apprenant</span>
            <span className="font-bold font-mono text-stone-900 ml-2">4</span>
          </footer>
        </article>

        {/* ============================================================ */}
        {/* PAGE 5 : SÉCURITÉ & PROTOCOLE DE MISE EN SERVICE (Page Dédiée) */}
        {/* ============================================================ */}
        <article
          id="pdf-page-5"
          className="pdf-page relative bg-white w-full shadow-2xl border border-stone-300 rounded-sm mx-auto p-6 sm:p-10 md:p-12 flex flex-col justify-between text-stone-900 select-text"
          style={{ minHeight: '960px' }}
        >
          {/* En-tête Page 5 */}
          <header className="w-full flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded bg-emerald-700 flex items-center justify-center text-white font-bold text-[10px]">
                DGE
              </div>
              <span className="text-xs font-bold text-stone-800">Direction Générale de l'Énergie</span>
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-sm font-black text-red-600">cm</span>
              <span className="text-sm font-black text-emerald-600">e</span>
            </div>
            <span className="text-xs font-bold text-amber-700 uppercase">ISA Solar</span>
          </header>

          {/* Corps Page 5 : Sécurité & Procédure 6 étapes */}
          <div className="my-auto py-4 space-y-5">
            <div className="border-b-2 border-stone-900 pb-2">
              <h2 className="text-xl sm:text-2xl font-black text-stone-950 uppercase tracking-tight font-serif">
                3. SÉCURITÉ & PROCÉDURE DE MISE EN SERVICE
              </h2>
              <span className="text-xs text-stone-500 font-medium">
                Protocoles d'intervention de terrain et contrôles de conformité
              </span>
            </div>

            {/* Règles de Sécurité */}
            <div className="space-y-2">
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wide">
                A. Les 3 Règles Vitales du Technicien
              </h3>
              <div className="space-y-2 text-xs sm:text-sm text-stone-800">
                <div className="p-2.5 bg-amber-50 border-l-4 border-amber-500 rounded-r">
                  <strong>1. Interdiction d'ouverture sous charge :</strong> Ne jamais déconnecter une prise MC4 sous charge. L'arc électrique continu qui en résulte provoque des brûlures graves et des départs de feu. Ouvrir d'abord le sectionneur DC.
                </div>
                <div className="p-2.5 bg-stone-100 border-l-4 border-stone-700 rounded-r">
                  <strong>2. Ordre de raccordement régulateur :</strong> Raccorder TOUJOURS la batterie au régulateur EN PREMIER (calibrage de tension nominale), puis raccorder le champ solaire en second.
                </div>
                <div className="p-2.5 bg-stone-100 border-l-4 border-emerald-600 rounded-r">
                  <strong>3. Contrôle préalable de polarité :</strong> Mesurer systématiquement au multimètre la polarité (+ et -) de chaque chaîne avant enfichage pour éviter la destruction de l'onduleur.
                </div>
              </div>
            </div>

            {/* Procédure en 6 Étapes Numérotées */}
            <div className="space-y-2 pt-1">
              <h3 className="font-bold text-stone-900 text-sm uppercase tracking-wide">
                B. Protocole Chronologique de Mise en Service
              </h3>
              <div className="space-y-2 text-xs sm:text-sm text-stone-700">
                <div className="p-2.5 bg-stone-50 border border-stone-200 rounded flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <span><strong>Contrôle visuel mécanique :</strong> Vérification de l'étanchéité toiture et contrôle du serrage au tournevis dynamométrique.</span>
                </div>
                <div className="p-2.5 bg-stone-50 border border-stone-200 rounded flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <span><strong>Continuité de terre :</strong> Mesure de la continuité des cadres métalliques et de la liaison équipotentielle (&lt; 2 Ω).</span>
                </div>
                <div className="p-2.5 bg-stone-50 border border-stone-200 rounded flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <span><strong>Tension à vide (Voc) :</strong> Mesure de la tension de chaque string au multimètre 1000V DC et comparaison avec la plage MPPT.</span>
                </div>
                <div className="p-2.5 bg-stone-50 border border-stone-200 rounded flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">4</span>
                  <span><strong>Enclenchement AC :</strong> Fermeture du disjoncteur différentiel AC au tableau électrique général.</span>
                </div>
                <div className="p-2.5 bg-stone-50 border border-stone-200 rounded flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">5</span>
                  <span><strong>Enclenchement DC :</strong> Manœuvre de fermeture du sectionneur DC sur le coffret de protection et sur l'onduleur.</span>
                </div>
                <div className="p-2.5 bg-stone-50 border border-stone-200 rounded flex items-start gap-2">
                  <span className="w-5 h-5 rounded bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">6</span>
                  <span><strong>Relevé de production :</strong> Vérification du couplage réseau et contrôle thermique des connecteurs.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pied de page Page 5 */}
          <footer className="w-full pt-3 border-t border-stone-300 flex items-center justify-between text-[10px] sm:text-xs text-stone-500">
            <span>Formation technique | Support de référence édité par les Drs TANOE & OYEDELE</span>
            <span className="font-bold font-mono text-stone-900 ml-2">5</span>
          </footer>
        </article>
      </main>
    </div>
  );
}

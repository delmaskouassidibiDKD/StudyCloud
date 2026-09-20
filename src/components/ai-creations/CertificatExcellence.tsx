import React, { useRef } from 'react';
import {
  Download,
  Printer,
  X,
  Award,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { DnaLogo } from '../DnaLogo';

export interface CertificateData {
  id?: string;
  user_id?: string;
  source_file_id?: string;
  source_file_name?: string;
  topic: string;
  score: number;
  max_score?: number;
  certificate_code: string;
  student_name: string;
  issued_at?: string;
}

interface CertificatExcellenceProps {
  certificate: CertificateData;
  onClose: () => void;
}

export function CertificatExcellence({ certificate, onClose }: CertificatExcellenceProps) {
  const certRef = useRef<HTMLDivElement>(null);

  const formattedDate = certificate.issued_at
    ? new Date(certificate.issued_at).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });

  const handlePrintOrDownload = () => {
    window.print();
  };

  return (
    <div
      id="certificat-modal-overlay"
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex flex-col items-center justify-start overflow-y-auto p-3 sm:p-6"
    >
      {/* ========================================================
          BARRE D'ACTIONS SUPÉRIEURE (HORS IMPRESSION)
          Bouton Télécharger / Imprimer en haut
          ======================================================== */}
      <header className="w-full max-w-4xl flex items-center justify-between gap-4 mb-4 print:hidden">
        <div className="flex items-center gap-2.5 text-white">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
            <Award className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
              Certificat Officiel d'Excellence Académique
            </h2>
            <p className="text-[11px] text-stone-400">
              N° d'enregistrement : <span className="font-mono text-amber-300 font-bold">{certificate.certificate_code}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Bouton de Téléchargement / Impression */}
          <button
            id="btn-download-certificate"
            onClick={handlePrintOrDownload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs sm:text-sm shadow-lg hover:shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            title="Télécharger / Imprimer votre certificat officiel"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Télécharger le Certificat</span>
            <span className="sm:hidden">Télécharger</span>
          </button>

          {/* Bouton Fermer */}
          <button
            id="btn-close-certificate-modal"
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
            title="Fermer la vue"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ========================================================
          DOCUMENT OFFICIEL DU CERTIFICAT (FICHE DIPLÔME)
          Style parchemin haut de gamme avec ornements officiels
          ======================================================== */}
      <article
        ref={certRef}
        id="official-certificate-document"
        className="w-full max-w-4xl bg-[#FCFAF5] text-stone-900 border-[8px] sm:border-[12px] border-[#92400e]/70 shadow-2xl p-6 sm:p-12 relative overflow-hidden flex flex-col justify-between min-h-[700px] sm:min-h-[750px] print:m-0 print:p-8 print:border-8 print:shadow-none print:w-full print:min-h-screen"
        style={{
          backgroundImage: `
            radial-gradient(circle at center, rgba(251, 191, 36, 0.04) 0%, transparent 70%),
            linear-gradient(to right, rgba(146, 64, 14, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(146, 64, 14, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 24px 24px, 24px 24px'
        }}
      >
        {/* Fine bordure intérieure dorée de sécurité */}
        <div className="absolute inset-2 sm:inset-3 border border-amber-600/40 pointer-events-none rounded-xs" />
        <div className="absolute inset-3 sm:inset-4 border border-dashed border-amber-700/25 pointer-events-none rounded-xs" />

        {/* Motifs de coins officiels */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-amber-700 pointer-events-none" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-amber-700 pointer-events-none" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-amber-700 pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-amber-700 pointer-events-none" />

        {/* ========================================================
            EN-TÊTE OFFICIEL
            À gauche : DKD school numérique
            À droite : Logo officiel StudyCloud (DnaLogo) + DKD TECHNOLOGIES
            ======================================================== */}
        <header className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b-2 border-amber-800/30">
          {/* Gauche : DKD School Numérique */}
          <div className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" />
              <h1 className="font-serif font-black text-base sm:text-xl text-stone-900 tracking-wider uppercase">
                DKD school numérique
              </h1>
            </div>
            <p className="text-[10px] sm:text-xs font-serif font-bold text-amber-900 tracking-widest uppercase">
              Direction des Examens, Concours & Évaluations Supérieures
            </p>
            <p className="text-[9.5px] sm:text-[10px] font-sans text-stone-600 italic">
              Académie d'Ingénierie & d'Innovation Pédagogique
            </p>
          </div>

          {/* Droite : Logo officiel StudyCloud et DKD TECHNOLOGIES */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0369A1] text-white shadow-md border border-sky-800 select-none shrink-0 self-end sm:self-auto">
            {/* Vrai DnaLogo officiel */}
            <DnaLogo className="w-7 h-7 shrink-0" glow={true} />

            <div className="flex flex-col text-left leading-none">
              <div className="flex items-baseline text-base sm:text-lg font-black tracking-tight font-sans">
                <span className="text-[#F38020]">Study</span>
                <span className="text-[#38BDF8]">Cloud</span>
              </div>
              <span className="text-[8px] font-sans font-extrabold tracking-[0.22em] text-sky-100 uppercase mt-0.5">
                DKD TECHNOLOGIES
              </span>
            </div>
          </div>
        </header>

        {/* ========================================================
            CORPS DU CERTIFICAT D'EXCELLENCE ACADÉMIQUE
            ======================================================== */}
        <main className="relative z-10 py-6 sm:py-8 text-center space-y-6 sm:space-y-8 flex-1 flex flex-col justify-center">
          {/* Sceau doré officiel avec rubans */}
          <div className="flex justify-center items-center gap-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100/90 border border-amber-300 text-amber-900 text-xs font-bold font-serif tracking-widest uppercase shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Attestation Officielle de Réussite</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            </div>
          </div>

          {/* Grand titre solennel */}
          <div className="space-y-2">
            <h2 className="font-serif font-black text-2xl sm:text-4xl md:text-5xl text-stone-900 tracking-tight leading-none uppercase drop-shadow-xs">
              Certificat d'Excellence Académique
            </h2>
            <p className="text-xs sm:text-sm font-serif italic text-amber-950/80 max-w-xl mx-auto">
              Délivré par DKD School Numérique et l'écosystème StudyCloud en reconnaissance d'un niveau d'assimilation supérieur et d'une maîtrise conceptuelle exemplaire.
            </p>
          </div>

          {/* Récipiendaire */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] sm:text-xs font-serif uppercase tracking-widest text-stone-600 block">
              Le présent certificat est solennellement décerné à :
            </span>
            <div className="inline-block relative">
              <span className="text-xl sm:text-3xl md:text-4xl font-serif font-black text-amber-900 border-b-2 border-stone-900 pb-1 px-4 sm:px-8 tracking-wide">
                {certificate.student_name || "Étudiant DKD School Numérique"}
              </span>
            </div>
          </div>

          {/* Matière et Domaine évalué */}
          <div className="space-y-2 max-w-2xl mx-auto">
            <span className="text-[11px] sm:text-xs font-serif uppercase tracking-wider text-stone-600 block">
              Pour avoir brillamment validé l'épreuve officielle d'évaluation approfondie dans la discipline :
            </span>
            <div className="bg-amber-500/10 border-2 border-amber-600/40 rounded-lg px-6 py-2.5 inline-block">
              <span className="font-serif font-extrabold text-sm sm:text-lg text-stone-900 uppercase tracking-widest break-words">
                {certificate.topic}
              </span>
            </div>
          </div>

          {/* Détails des points et de la mention */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-2">
            {/* Note obtenue */}
            <div className="bg-white/80 p-3 rounded-lg border border-amber-300 shadow-2xs">
              <span className="text-[10px] uppercase font-serif text-stone-500 block font-semibold">Note Obtenue</span>
              <span className="font-serif font-black text-lg sm:text-xl text-emerald-800">
                {certificate.score} / {certificate.max_score || 20} Points
              </span>
            </div>

            {/* Mention attribuée */}
            <div className="bg-white/80 p-3 rounded-lg border border-amber-300 shadow-2xs">
              <span className="text-[10px] uppercase font-serif text-stone-500 block font-semibold">Distinction</span>
              <span className="font-serif font-bold text-xs sm:text-sm text-amber-900">
                {certificate.score >= 18 ? "Mention Très Bien • Félicitations" : "Mention Très Bien"}
              </span>
            </div>

            {/* Fiches validées */}
            <div className="bg-white/80 p-3 rounded-lg border border-amber-300 shadow-2xs">
              <span className="text-[10px] uppercase font-serif text-stone-500 block font-semibold">Épreuves Validées</span>
              <span className="font-serif font-bold text-xs sm:text-sm text-stone-800">
                4 Fiches Complètes
              </span>
            </div>
          </div>

          {/* Encart de sécurité et d'authentification */}
          <div className="text-[10px] sm:text-[11px] font-sans text-stone-600 space-y-0.5 pt-1">
            <p>
              Évalué avec rigueur sur : <strong>Problème d'Application Majeur, QCM d'Analyse, Questions de Synthèse Rédigée & Test de Discrimination Conceptuelle.</strong>
            </p>
            <p className="font-mono text-stone-500">
              Code d'Authenticité D1 : <strong>{certificate.certificate_code}</strong> • Archivé sur le registre immuable Cloudflare.
            </p>
          </div>
        </main>

        {/* ========================================================
            PIED DU CERTIFICAT : SCEAU & SIGNATURE OFFICIELLE
            À gauche : Sceau officiel de certification DKD
            À droite : Signature officielle de Delmas Kouassi Dibi
            ======================================================== */}
        <footer className="relative z-10 pt-6 border-t-2 border-amber-800/30 flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Gauche : Cachet / Sceau rouge et or de certification */}
          <div className="flex items-center gap-3">
            {/* Cachet circulaire officiel */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-3 border-dashed border-rose-800 bg-rose-50/80 text-rose-900 flex flex-col items-center justify-center p-1 text-center shadow-xs rotate-[-8deg] select-none shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-rose-800 mb-0.5" />
              <span className="text-[7.5px] sm:text-[8px] font-black uppercase tracking-tight font-serif leading-none">
                DKD TECHNOLOGIES
              </span>
              <span className="text-[6px] sm:text-[6.5px] font-bold uppercase tracking-widest text-rose-700 leading-none mt-0.5">
                CERTIFIÉ CONFORME
              </span>
            </div>

            <div className="text-left space-y-0.5">
              <span className="text-[9.5px] sm:text-[10px] font-serif uppercase tracking-wider text-stone-500 block">
                Délivré officiellement le :
              </span>
              <span className="font-serif font-bold text-xs sm:text-sm text-stone-800 block">
                {formattedDate}
              </span>
              <span className="text-[9px] text-stone-500 font-sans italic">
                Enregistré au registre des diplômes DKD
              </span>
            </div>
          </div>

          {/* Droite : Signature officielle de Delmas Kouassi Dibi */}
          <div className="text-center sm:text-right space-y-1">
            <span className="text-[10px] sm:text-[11px] font-serif uppercase tracking-wider text-stone-500 block">
              Pour le Conseil d'Évaluation & la Direction :
            </span>

            {/* Signature calligraphique vectorielle de Delmas Kouassi Dibi */}
            <div className="h-14 sm:h-16 flex items-center justify-center sm:justify-end py-1">
              <svg
                width="170"
                height="55"
                viewBox="0 0 170 55"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-stone-900"
              >
                {/* Paraphe artistique officiel Delmas Kouassi Dibi */}
                <path
                  d="M15 38 C 25 15, 30 10, 45 12 C 55 13, 35 48, 30 46 C 25 44, 40 22, 60 25 C 75 28, 65 42, 80 40 C 95 38, 90 20, 110 22 C 125 24, 115 45, 135 38 C 145 35, 155 18, 160 22"
                  stroke="#1c1917"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M20 48 Q 65 35 150 42"
                  stroke="#92400e"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <circle cx="156" cy="41" r="2.2" fill="#92400e" />
              </svg>
            </div>

            <div className="border-t border-stone-800/40 pt-1 text-center sm:text-right">
              <h3 className="font-serif font-black text-xs sm:text-sm text-stone-900 leading-tight">
                Delmas Kouassi Dibi
              </h3>
              <p className="text-[9.5px] sm:text-[10px] font-sans text-stone-600">
                Directeur Général & Fondateur — DKD TECHNOLOGIES
              </p>
              <p className="text-[8.5px] text-amber-900/80 font-serif italic">
                DKD School Numérique
              </p>
            </div>
          </div>
        </footer>
      </article>

      {/* Style print pour impression propre sur format A4 paysage ou portrait */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #official-certificate-document, #official-certificate-document * {
            visibility: visible;
          }
          #official-certificate-document {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            margin: 0;
            padding: 24px;
            box-shadow: none !important;
            border-width: 8px !important;
            page-break-inside: avoid;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #certificat-modal-overlay {
            background: transparent !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default CertificatExcellence;

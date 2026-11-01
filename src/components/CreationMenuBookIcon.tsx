import React from 'react';
import { DelmasRobot } from './DelmasRobot';

interface CreationMenuBookIconProps {
  className?: string;
}

export const CreationMenuBookIcon: React.FC<CreationMenuBookIconProps> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* 3D Open Book Vector SVG */}
      <svg
        className="w-full h-full filter drop-shadow-[0_8px_18px_rgba(2,132,199,0.35)]"
        viewBox="0 0 100 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Dégradé Couverture Extérieure Luxueuse (Bleu Saphir / Royal) */}
          <linearGradient id="bookCoverGradLeft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="50%" stopColor="#0369A1" />
            <stop offset="100%" stopColor="#0C4A6E" />
          </linearGradient>

          <linearGradient id="bookCoverGradRight" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="60%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#075985" />
          </linearGradient>

          {/* Dégradé Tranches de pages 3D (Épaisseur du livre) */}
          <linearGradient id="bookEdgeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="50%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>

          {/* Dégradé Pages Ouvertes Gauche & Droite */}
          <linearGradient id="bookPageLeft" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="75%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          <linearGradient id="bookPageRight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="25%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F0F9FF" />
          </linearGradient>

          {/* Dégradé Ruban Marque-page Doré */}
          <linearGradient id="bookRibbonGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="40%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>

          {/* Lueur Céleste au centre sous le robot */}
          <radialGradient id="centerAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ombre portée douce du livre */}
        <ellipse cx="50" cy="80" rx="42" ry="7" fill="#000000" fillOpacity="0.22" />

        {/* Couverture arrière gauche */}
        <path
          d="M 6 68 L 47 77 L 47 21 L 6 14 C 4 13.5 2 15 2 17.5 L 2 64.5 C 2 66.5 3.8 67.8 6 68 Z"
          fill="url(#bookCoverGradLeft)"
          stroke="#082F49"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Couverture arrière droite */}
        <path
          d="M 94 68 L 53 77 L 53 21 L 94 14 C 96 13.5 98 15 98 17.5 L 98 64.5 C 98 66.5 96.2 67.8 94 68 Z"
          fill="url(#bookCoverGradRight)"
          stroke="#082F49"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Reliure centrale inférieure (dos du livre) */}
        <path
          d="M 46 76 C 48 79 52 79 54 76 L 54 21 C 52 18 48 18 46 21 Z"
          fill="#0C4A6E"
          stroke="#082F49"
          strokeWidth="1"
        />

        {/* Épaisseur des pages 3D - tranche gauche */}
        <path
          d="M 6 64 L 46 73 L 46 76 L 6 68 Z"
          fill="url(#bookEdgeGrad)"
          stroke="#64748B"
          strokeWidth="0.8"
        />
        {/* Lignes de tranches de feuilles gauche */}
        <line x1="12" y1="65" x2="43" y2="72" stroke="#94A3B8" strokeWidth="0.5" />
        <line x1="10" y1="66.5" x2="44" y2="74" stroke="#64748B" strokeWidth="0.5" />

        {/* Épaisseur des pages 3D - tranche droite */}
        <path
          d="M 94 64 L 54 73 L 54 76 L 94 68 Z"
          fill="url(#bookEdgeGrad)"
          stroke="#64748B"
          strokeWidth="0.8"
        />
        {/* Lignes de tranches de feuilles droite */}
        <line x1="88" y1="65" x2="57" y2="72" stroke="#94A3B8" strokeWidth="0.5" />
        <line x1="90" y1="66.5" x2="56" y2="74" stroke="#64748B" strokeWidth="0.5" />

        {/* Page Ouverte Gauche (Incurvée avec perspective 3D) */}
        <path
          d="M 7 18 C 21 23 35 21 47 24 L 47 72 C 35 69 21 71 7 66 Z"
          fill="url(#bookPageLeft)"
          stroke="#334155"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />

        {/* Lignes de texte élégantes sur la page gauche */}
        <line x1="14" y1="28" x2="39" y2="30.5" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="14" y1="35" x2="40" y2="37.5" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="14" y1="42" x2="36" y2="44" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="14" y1="49" x2="38" y2="51" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="14" y1="56" x2="30" y2="57.5" stroke="#BAE6FD" strokeWidth="1.2" strokeLinecap="round" />

        {/* Page Ouverte Droite (Incurvée avec perspective 3D) */}
        <path
          d="M 53 24 C 65 21 79 23 93 18 L 93 66 C 79 71 65 69 53 72 Z"
          fill="url(#bookPageRight)"
          stroke="#334155"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />

        {/* Lignes de texte élégantes sur la page droite */}
        <line x1="61" y1="30.5" x2="86" y2="28" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="60" y1="37.5" x2="86" y2="35" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="64" y1="44" x2="86" y2="42" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="62" y1="51" x2="86" y2="49" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="70" y1="57.5" x2="86" y2="56" stroke="#BAE6FD" strokeWidth="1.2" strokeLinecap="round" />

        {/* Ruban marque-page doré élégant qui dépasse vers le bas */}
        <path
          d="M 48.5 25 Q 47.5 55 49 84 L 51 81 L 53 84 Q 52.5 55 51.5 25 Z"
          fill="url(#bookRibbonGrad)"
          stroke="#78350F"
          strokeWidth="0.8"
        />

        {/* Pli central ombré du livre */}
        <path
          d="M 48 24 C 49 26 51 26 52 24 L 52 73 C 51 71 49 71 48 73 Z"
          fill="#1E293B"
          fillOpacity="0.45"
        />

        {/* Petite étincelle scintillante d'apprentissage en haut à droite */}
        <path
          d="M 88 10 L 89.5 13.5 L 93 15 L 89.5 16.5 L 88 20 L 86.5 16.5 L 83 15 L 86.5 13.5 Z"
          fill="#FDE047"
          stroke="#B45309"
          strokeWidth="0.6"
        />

        {/* Halo doux sous le robot */}
        <ellipse cx="50" cy="50" rx="16" ry="16" fill="url(#centerAura)" />
      </svg>

      {/* Petit Robot Bleu qui bouge au milieu du livre */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-2">
        <div className="scale-65 sm:scale-75 md:scale-90 transition-transform">
          <DelmasRobot size={42} variant="blue" floating />
        </div>
      </div>
    </div>
  );
};


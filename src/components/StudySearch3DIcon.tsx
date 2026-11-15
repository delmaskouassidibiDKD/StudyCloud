import React from 'react';

interface StudySearch3DIconProps {
  className?: string;
}

export const StudySearch3DIcon: React.FC<StudySearch3DIconProps> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        className="w-full h-full filter drop-shadow-[0_8px_18px_rgba(66,133,244,0.45)]"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Dégradé Globe Céleste Web 3D */}
          <radialGradient id="globeGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="45%" stopColor="#2563EB" />
            <stop offset="85%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#0F172A" />
          </radialGradient>

          {/* Dégradé Anneau d'orbite Web */}
          <linearGradient id="orbitGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#A855F7" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#EC4899" stopOpacity="0.9" />
          </linearGradient>

          {/* Dégradé Verre Loupe (Lentille brillante) */}
          <radialGradient id="lensGlass" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#E0F2FE" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#38BDF8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0284C7" stopOpacity="0.6" />
          </radialGradient>

          {/* Dégradé Cadre de la Loupe 3D (Chrome Métallique) */}
          <linearGradient id="chromeRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#64748B" />
            <stop offset="75%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          {/* Dégradé Manche de la Loupe 3D */}
          <linearGradient id="handleGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="40%" stopColor="#EA580C" />
            <stop offset="80%" stopColor="#C2410C" />
            <stop offset="100%" stopColor="#7C2D12" />
          </linearGradient>

          {/* Dégradé Embout Doré du manche */}
          <linearGradient id="goldTip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#A16207" />
          </linearGradient>

          {/* Lueur Céleste externe */}
          <radialGradient id="searchGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ombre portée douce du socle */}
        <ellipse cx="50" cy="88" rx="36" ry="6" fill="#000000" fillOpacity="0.25" />

        {/* Lueur arrière */}
        <circle cx="45" cy="45" r="38" fill="url(#searchGlow)" />

        {/* 1. GLOBE WEB ARRIÈRE 3D */}
        <circle cx="45" cy="45" r="30" fill="url(#globeGrad)" stroke="#1E40AF" strokeWidth="1" />

        {/* Méridiens et parallèles du globe */}
        <ellipse cx="45" cy="45" rx="16" ry="29" stroke="#93C5FD" strokeOpacity="0.4" strokeWidth="1.2" fill="none" />
        <ellipse cx="45" cy="45" rx="29" ry="12" stroke="#93C5FD" strokeOpacity="0.4" strokeWidth="1.2" fill="none" />
        <line x1="45" y1="15" x2="45" y2="75" stroke="#93C5FD" strokeOpacity="0.45" strokeWidth="1.2" />
        <line x1="15" y1="45" x2="75" y2="45" stroke="#93C5FD" strokeOpacity="0.45" strokeWidth="1.2" />

        {/* Anneau orbital Web autour du globe */}
        <ellipse
          cx="45"
          cy="45"
          rx="38"
          ry="15"
          stroke="url(#orbitGrad)"
          strokeWidth="2.5"
          fill="none"
          transform="rotate(-25 45 45)"
          strokeDasharray="90 10"
        />

        {/* Les 4 Couleurs Google / Web étincelantes sur l'anneau */}
        {/* Point Bleu Google */}
        <circle cx="16" cy="33" r="3.2" fill="#4285F4" stroke="#FFFFFF" strokeWidth="1" />
        {/* Point Rouge Google */}
        <circle cx="74" cy="57" r="3.2" fill="#EA4335" stroke="#FFFFFF" strokeWidth="1" />
        {/* Point Jaune Google */}
        <circle cx="38" cy="62" r="2.8" fill="#FBBC05" stroke="#FFFFFF" strokeWidth="0.8" />
        {/* Point Vert Google */}
        <circle cx="58" cy="27" r="2.8" fill="#34A853" stroke="#FFFFFF" strokeWidth="0.8" />

        {/* 2. GRANDE LOUPE 3D DEVANT */}
        {/* Manche de la Loupe (incliné à 45 degrés vers le bas à droite) */}
        <g transform="rotate(45 52 52)">
          {/* Anneau doré de liaison du manche */}
          <rect x="70" y="50" width="4.5" height="12" rx="2" fill="url(#goldTip)" stroke="#78350F" strokeWidth="0.8" />
          {/* Corps du manche orange 3D */}
          <rect x="74" y="49" width="22" height="14" rx="5" fill="url(#handleGrad)" stroke="#7C2D12" strokeWidth="1.2" />
          {/* Reflet blanc sur le manche */}
          <rect x="77" y="51" width="16" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.4" />
          {/* Bout arrondi doré du manche */}
          <path d="M 96 51 C 98 53 98 59 96 61 Z" fill="url(#goldTip)" />
        </g>

        {/* Cadre Métallique de la Loupe (Chrome 3D) */}
        <circle cx="48" cy="44" r="24" fill="none" stroke="url(#chromeRing)" strokeWidth="5.5" />
        <circle cx="48" cy="44" r="21" fill="none" stroke="#0F172A" strokeWidth="1" strokeOpacity="0.4" />

        {/* Lentille en verre grossissante avec reflets holographiques */}
        <circle cx="48" cy="44" r="21" fill="url(#lensGlass)" />

        {/* Reflet spéculaire courbé sur la lentille */}
        <path
          d="M 34 32 C 40 26 54 26 62 33 C 58 35 44 34 34 32 Z"
          fill="#FFFFFF"
          fillOpacity="0.75"
        />

        {/* Petit point de brillance éclatante */}
        <circle cx="37" cy="40" r="2" fill="#FFFFFF" fillOpacity="0.85" />
        <circle cx="61" cy="54" r="1.5" fill="#FFFFFF" fillOpacity="0.6" />

        {/* Étoile scintillante / Sparkle 4 branches en haut à droite */}
        <path
          d="M 72 16 C 72 20 74 22 78 22 C 74 22 72 24 72 28 C 72 24 70 22 66 22 C 70 22 72 20 72 16 Z"
          fill="#FFFFFF"
          stroke="#38BDF8"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
};


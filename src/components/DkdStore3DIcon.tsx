import React from 'react';

interface DkdStore3DIconProps {
  className?: string;
}

export const DkdStore3DIcon: React.FC<DkdStore3DIconProps> = ({ className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        className="w-full h-full filter drop-shadow-[0_8px_18px_rgba(66,133,244,0.45)]"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Dégradé Bleu Play Store / DKD */}
          <linearGradient id="dkdBlueGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>

          {/* Dégradé Rouge / Rose Play Store */}
          <linearGradient id="dkdRedGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F87171" />
            <stop offset="50%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#DC2626" />
          </linearGradient>

          {/* Dégradé Jaune / Ambre Play Store */}
          <linearGradient id="dkdYellowGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Dégradé Vert Émeraude Play Store */}
          <linearGradient id="dkdGreenGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Dégradé Sac de Store 3D */}
          <linearGradient id="storeBagGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="50%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>

          {/* Anse Dorée du Sac */}
          <linearGradient id="bagHandleGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>

          {/* Lueur Céleste */}
          <radialGradient id="storeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ombre portée douce sous le sac */}
        <ellipse cx="50" cy="88" rx="36" ry="6" fill="#000000" fillOpacity="0.3" />

        {/* Lueur arrière */}
        <circle cx="50" cy="50" r="42" fill="url(#storeGlow)" />

        {/* 1. ANSE DU SAC DE STORE 3D */}
        <path
          d="M 32 30 C 32 14 68 14 68 30"
          stroke="url(#bagHandleGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />

        {/* 2. CORPS DU SAC DE STORE 3D */}
        <path
          d="M 20 30 L 80 30 C 85 30 88 34 87 39 L 81 81 C 80 85 76 87 72 87 L 28 87 C 24 87 20 85 19 81 L 13 39 C 12 34 15 30 20 30 Z"
          fill="url(#storeBagGrad)"
          stroke="#334155"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Revers supérieur du sac */}
        <path
          d="M 18 30 L 82 30 C 84 30 86 32 85 35 L 83 40 C 82 42 80 43 78 43 L 22 43 C 20 43 18 42 17 40 L 15 35 C 14 32 16 30 18 30 Z"
          fill="#1E293B"
          stroke="#475569"
          strokeWidth="1.2"
        />

        {/* 3. EMBLÈME PLAY STORE / DKD MULTICOLORE 3D AU CENTRE */}
        {/* Facette 1 : Triangle Bleu (côté gauche haut) */}
        <path
          d="M 33 46 L 55 58 L 33 69 Z"
          fill="url(#dkdBlueGrad)"
          stroke="#1E3A8A"
          strokeWidth="0.8"
        />

        {/* Facette 2 : Triangle Vert (haut vers droite) */}
        <path
          d="M 33 46 L 68 58 L 55 58 Z"
          fill="url(#dkdGreenGrad)"
          stroke="#065F46"
          strokeWidth="0.8"
        />

        {/* Facette 3 : Triangle Jaune (pointe droite) */}
        <path
          d="M 68 58 L 55 58 L 62 65 Z"
          fill="url(#dkdYellowGrad)"
          stroke="#92400E"
          strokeWidth="0.8"
        />

        {/* Facette 4 : Triangle Rouge (bas) */}
        <path
          d="M 33 69 L 55 58 L 68 58 L 33 69 Z"
          fill="url(#dkdRedGrad)"
          stroke="#991B1B"
          strokeWidth="0.8"
        />

        {/* 4. ÉTOILE BRILLANTE EN HAUT À DROITE DU SAC */}
        <path
          d="M 76 22 C 76 26 78 28 82 28 C 78 28 76 30 76 34 C 76 30 74 28 70 28 C 74 28 76 26 76 22 Z"
          fill="#FDE047"
        />
        <circle cx="76" cy="28" r="1.5" fill="#FFFFFF" />

        {/* Petit badge DKD en bas */}
        <rect x="36" y="76" width="28" height="7.5" rx="3.5" fill="#0F172A" stroke="#475569" strokeWidth="1" />
        <text
          x="50"
          y="82"
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="900"
          letterSpacing="0.8"
          fill="#93C5FD"
          fontFamily="system-ui, sans-serif"
        >
          DKD STORE
        </text>
      </svg>
    </div>
  );
};


import React from 'react';

interface DnaLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  glow?: boolean;
  style?: React.CSSProperties;
}

export function DnaLogo({ className, glow = false, style, ...props }: DnaLogoProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className || ''}`}
      style={{
        filter: glow ? 'drop-shadow(0 0 6px rgba(243, 128, 32, 0.6))' : undefined,
        ...style,
      }}
      {...props}
    >
      <defs>
        {/* Gradient pour fond sombre : Blanc et Orange lumineux */}
        <linearGradient id="scDnaGradDark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#F38020" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>

        {/* Gradient pour fond clair : Orange vif et saturé */}
        <linearGradient id="scDnaGradLight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#EA580C" />
          <stop offset="50%" stopColor="#F97316" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>

      {/* Strand 1 (Orange Study) */}
      <path
        d="M8 3C8 3 8 10 12 12C16 14 16 21 16 21"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="dna-strand"
      />

      {/* Strand 2 (Cloud Blue en fond clair / Blanc-Orange en fond sombre) */}
      <path
        d="M16 3C16 3 16 10 12 12C8 14 8 21 8 21"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="dna-strand-second"
      />

      {/* Rungs (Barreaux de liaison) */}
      <line x1="10" y1="6" x2="14" y2="6" strokeWidth="1.8" strokeLinecap="round" className="dna-rung" />
      <line x1="10.5" y1="9" x2="13.5" y2="9" strokeWidth="1.8" strokeLinecap="round" className="dna-rung-alt" />
      <line x1="11" y1="12" x2="13" y2="12" strokeWidth="3" strokeLinecap="round" className="dna-rung-center" />
      <line x1="10.5" y1="15" x2="13.5" y2="15" strokeWidth="1.8" strokeLinecap="round" className="dna-rung-alt" />
      <line x1="10" y1="18" x2="14" y2="18" strokeWidth="1.8" strokeLinecap="round" className="dna-rung" />
    </svg>
  );
}


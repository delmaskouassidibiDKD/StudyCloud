import React from 'react';

interface DnaLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  glow?: boolean;
}

export function DnaLogo({ className, glow = false, style, ...props }: DnaLogoProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-primary ${className || ''}`}
      style={{
        filter: glow ? 'drop-shadow(0 0 6px rgba(243, 128, 32, 0.75))' : undefined,
        ...style,
      }}
      {...props}
    >
      <defs>
        <linearGradient id="scDnaGradStatic" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#F38020" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>
      <path
        d="M8 3C8 3 8 10 12 12C16 14 16 21 16 21"
        stroke="#F38020"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ stroke: 'url(#scDnaGradStatic)' }}
      />
      <path
        d="M16 3C16 3 16 10 12 12C8 14 8 21 8 21"
        stroke="#F38020"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ stroke: 'url(#scDnaGradStatic)' }}
      />
      <line x1="10" y1="6" x2="14" y2="6" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <line x1="10.5" y1="9" x2="13.5" y2="9" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
      <line x1="11" y1="12" x2="13" y2="12" stroke="#F38020" strokeWidth="3" strokeLinecap="round" />
      <line x1="10.5" y1="15" x2="13.5" y2="15" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
      <line x1="10" y1="18" x2="14" y2="18" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

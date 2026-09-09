import React from 'react';

interface DnaLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  glow?: boolean;
}

export function DnaLogo({ className, glow = false, ...props }: DnaLogoProps) {
  const reactId = React.useId();
  // Absolute sanitization for CSS/SVG compatibility
  const sanitizedId = reactId.replace(/[^a-zA-Z0-9-]/g, '-').replace(/^-+|-+$/g, '');
  const filterId = `filter-${sanitizedId}`;
  const gradientId = `gradient-${sanitizedId}`;

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-primary ${className || ''}`}
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" />
          <stop offset="50%" stopColor="#F38020" />
          <stop offset="100%" stopColor="white" />
        </linearGradient>
        {glow && (
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>
      <g filter={glow ? `url(#${filterId})` : undefined}>
        <path
          d="M8 3C8 3 8 10 12 12C16 14 16 21 16 21"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ stroke: `url(#${gradientId})` }}
        />
        <path
          d="M16 3C16 3 16 10 12 12C8 14 8 21 8 21"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ stroke: `url(#${gradientId})` }}
        />
        <line x1="10" y1="6" x2="14" y2="6" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        <line x1="10.5" y1="9" x2="13.5" y2="9" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        <line x1="11" y1="12" x2="13" y2="12" stroke="#F38020" strokeWidth="3" strokeLinecap="round" />
        <line x1="10.5" y1="15" x2="13.5" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        <line x1="10" y1="18" x2="14" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      </g>
    </svg>
  );
}

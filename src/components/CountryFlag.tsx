import React from 'react';

interface CountryFlagProps {
  country?: string;
  className?: string;
}

export const CountryFlag: React.FC<CountryFlagProps> = ({
  country = "Côte d'Ivoire",
  className = "w-4 h-3",
}) => {
  const norm = (country || '').toLowerCase().trim();

  // Côte d'Ivoire: Orange (#FF8200) | White (#FFFFFF) | Green (#009A44)
  if (!norm || norm.includes('ivoire') || norm.includes('ci') || norm.includes('ivory')) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 rounded-[2px] overflow-hidden border border-stone-400/60 shadow-[0_1px_2px_rgba(0,0,0,0.15)] ${className}`}
        title="Côte d'Ivoire"
      >
        <svg viewBox="0 0 3 2" className="w-full h-full block" preserveAspectRatio="none">
          <rect width="1" height="2" x="0" fill="#FF8200" />
          <rect width="1" height="2" x="1" fill="#FFFFFF" />
          <rect width="1" height="2" x="2" fill="#009A44" />
        </svg>
      </span>
    );
  }

  // Sénégal: Green (#00853F) | Yellow (#FDEF42) with Green Star | Red (#E31B23)
  if (norm.includes('sénégal') || norm.includes('senegal') || norm.includes('sn')) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 rounded-[2px] overflow-hidden border border-stone-400/60 shadow-[0_1px_2px_rgba(0,0,0,0.15)] ${className}`}
        title="Sénégal"
      >
        <svg viewBox="0 0 3 2" className="w-full h-full block" preserveAspectRatio="none">
          <rect width="1" height="2" x="0" fill="#00853F" />
          <rect width="1" height="2" x="1" fill="#FDEF42" />
          <polygon points="1.5,0.65 1.57,0.9 1.82,0.9 1.62,1.05 1.69,1.3 1.5,1.15 1.31,1.3 1.38,1.05 1.18,0.9 1.43,0.9" fill="#00853F" />
          <rect width="1" height="2" x="2" fill="#E31B23" />
        </svg>
      </span>
    );
  }

  // Mali: Green (#14B53A) | Yellow (#FCD116) | Red (#CE1126)
  if (norm.includes('mali') || norm.includes('ml')) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 rounded-[2px] overflow-hidden border border-stone-400/60 shadow-[0_1px_2px_rgba(0,0,0,0.15)] ${className}`}
        title="Mali"
      >
        <svg viewBox="0 0 3 2" className="w-full h-full block" preserveAspectRatio="none">
          <rect width="1" height="2" x="0" fill="#14B53A" />
          <rect width="1" height="2" x="1" fill="#FCD116" />
          <rect width="1" height="2" x="2" fill="#CE1126" />
        </svg>
      </span>
    );
  }

  // Burkina Faso: Red (#EF2B2D) / Green (#009E49) with Yellow Star
  if (norm.includes('burkina') || norm.includes('bf')) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 rounded-[2px] overflow-hidden border border-stone-400/60 shadow-[0_1px_2px_rgba(0,0,0,0.15)] ${className}`}
        title="Burkina Faso"
      >
        <svg viewBox="0 0 3 2" className="w-full h-full block" preserveAspectRatio="none">
          <rect width="3" height="1" y="0" fill="#EF2B2D" />
          <rect width="3" height="1" y="1" fill="#009E49" />
          <polygon points="1.5,0.65 1.57,0.9 1.82,0.9 1.62,1.05 1.69,1.3 1.5,1.15 1.31,1.3 1.38,1.05 1.18,0.9 1.43,0.9" fill="#FCD116" />
        </svg>
      </span>
    );
  }

  // France: Blue (#002654) | White (#FFFFFF) | Red (#ED2939)
  if (norm.includes('france') || norm.includes('fr')) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 rounded-[2px] overflow-hidden border border-stone-400/60 shadow-[0_1px_2px_rgba(0,0,0,0.15)] ${className}`}
        title="France"
      >
        <svg viewBox="0 0 3 2" className="w-full h-full block" preserveAspectRatio="none">
          <rect width="1" height="2" x="0" fill="#002654" />
          <rect width="1" height="2" x="1" fill="#FFFFFF" />
          <rect width="1" height="2" x="2" fill="#ED2939" />
        </svg>
      </span>
    );
  }

  // Fallback: Globe SVG icon
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 text-orange-600 ${className}`}
      title={country}
    >
      <svg viewBox="0 0 24 24" className="w-full h-full fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    </span>
  );
};

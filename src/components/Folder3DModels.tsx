import React from 'react';
import { Check, ArrowRight, Sparkles, ChevronDown } from 'lucide-react';

// ============================================================================
// UTILITAIRES DE DATE DYNAMIQUE & GESTION DES COULEURS
// ============================================================================

// Obtenir la vraie date du jour dynamique avec jour, mois, année et heure
export const getDynamicCurrentDate = () => {
  const now = new Date();
  const day = now.getDate();
  const monthsShort = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  const monthsUpper = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthsShort[now.getMonth()];
  const monthUpper = monthsUpper[now.getMonth()];
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return {
    day,
    month,
    year,
    time: `${hours}:${minutes}`,
    // Formats adaptés pour chaque modèle
    model1: `${monthUpper} ${day}, ${year}`,
    model2: `${day} ${monthUpper} ${year} • ${hours}:${minutes}`,
    model3: `${day} ${month} ${year} at ${hours}:${minutes}`,
    model4: `${day} ${month} ${year} • ${hours}:${minutes}`,
    full: `${day} ${month} ${year} à ${hours}:${minutes}`
  };
};

// Éclaircit une couleur hexadécimale pour la couche secondaire du Modèle 2
export const lightenColor = (hex: string, factor: number = 0.45): string => {
  try {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    const newR = Math.min(255, Math.round(r + (255 - r) * factor));
    const newG = Math.min(255, Math.round(g + (255 - g) * factor));
    const newB = Math.min(255, Math.round(b + (255 - b) * factor));
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  } catch {
    return hex;
  }
};

// ============================================================================
// DONNÉES DES 4 MODÈLES (1, 2, 3, 4) CONFORMES AUX IMAGES FOURNIES
// ============================================================================

export interface FolderModelItem {
  id: string;
  model: 1 | 2 | 3 | 4;
  title: string;
  subtitle?: string;
  badge?: string;
  primaryColor: string;
  secondaryColor?: string;
  iconType?: string;
  textDark?: boolean;
}

export interface ClasseurCreatedFolder {
  id: string;
  name: string;
  model: 1 | 2 | 3 | 4;
  primaryColor: string;
  secondaryColor?: string;
  badge?: string;
  iconType?: string;
  textDark?: boolean;
  dateText: string;
  createdAt: number;
  parentId?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
}

// MODÈLE 1 : Onglets Index Pastel (Image 1 - 12 dossiers)
export const MODEL_1_FOLDERS: FolderModelItem[] = [
  { id: 'm1-1', model: 1, title: 'Daily Notes', primaryColor: '#E76239', textDark: false },
  { id: 'm1-2', model: 1, title: 'Journal', primaryColor: '#3E9B66', textDark: false },
  { id: 'm1-3', model: 1, title: 'Milestones', primaryColor: '#BE9EB3', textDark: true },
  { id: 'm1-4', model: 1, title: 'Music', primaryColor: '#E8B84B', textDark: true },
  { id: 'm1-5', model: 1, title: 'Wellness Tracker', primaryColor: '#E88C50', textDark: false },
  { id: 'm1-6', model: 1, title: 'Client Notes', primaryColor: '#CEE3EB', textDark: true },
  { id: 'm1-7', model: 1, title: 'Courses', primaryColor: '#479AA6', textDark: false },
  { id: 'm1-8', model: 1, title: 'Art Ideas', primaryColor: '#D7CFE3', textDark: true },
  { id: 'm1-9', model: 1, title: 'Content Planning', primaryColor: '#F5CAA0', textDark: true },
  { id: 'm1-10', model: 1, title: 'Portfolio', primaryColor: '#E6B7B3', textDark: true },
  { id: 'm1-11', model: 1, title: 'Books', primaryColor: '#B5872A', textDark: false },
  { id: 'm1-12', model: 1, title: 'Trip Itinerary', primaryColor: '#D7E6C5', textDark: true },
];

// MODÈLE 2 : Bicolore Écolier & Badges (Image 2 - 6 dossiers)
export const MODEL_2_FOLDERS: FolderModelItem[] = [
  { id: 'm2-1', model: 2, title: 'Art / Music / Drama', badge: 'ART/MUSIC/DRAMA', primaryColor: '#9B85E6', secondaryColor: '#D5CEFB', textDark: true },
  { id: 'm2-2', model: 2, title: 'English', badge: 'ENGLISH', primaryColor: '#77B6F8', secondaryColor: '#CEE4FD', textDark: true },
  { id: 'm2-3', model: 2, title: 'French / Spanish', badge: 'FRENCH/SPANISH', primaryColor: '#F4C938', secondaryColor: '#FFF69B', textDark: true },
  { id: 'm2-4', model: 2, title: 'General Links', badge: 'GENERAL LINKS', primaryColor: '#A9ACB4', secondaryColor: '#EBECEF', textDark: true },
  { id: 'm2-5', model: 2, title: 'Geo / History', badge: 'GEO/HISTORY', primaryColor: '#F19C65', secondaryColor: '#FED4B2', textDark: true },
  { id: 'm2-6', model: 2, title: 'Maths', badge: 'MATHS', primaryColor: '#F58DB2', secondaryColor: '#FDD5E4', textDark: true },
];

// MODÈLE 3 : Luminous Glow Néon 3D (Image 3 - 8 dossiers)
export const MODEL_3_FOLDERS: FolderModelItem[] = [
  { id: 'm3-1', model: 3, title: 'Advanced Experim...al Physics', primaryColor: '#18B2DC', iconType: 'chart', textDark: false },
  { id: 'm3-2', model: 3, title: 'Atomic & Molecular Spectrum', primaryColor: '#FFC400', iconType: 'atom', textDark: true },
  { id: 'm3-3', model: 3, title: 'History & Civilizati...di Arabia', primaryColor: '#7E57C2', iconType: 'moon', textDark: false },
  { id: 'm3-4', model: 3, title: 'Oral Skills For Scientific English', primaryColor: '#9575CD', iconType: 'book', textDark: false },
  { id: 'm3-5', model: 3, title: 'Quantum Physics', primaryColor: '#374151', iconType: 'quantum', textDark: false },
  { id: 'm3-6', model: 3, title: 'Solid State Physics 1', primaryColor: '#00C88C', iconType: 'flask', textDark: false },
  { id: 'm3-7', model: 3, title: 'Thermodynamics', primaryColor: '#FF6D00', iconType: 'gear', textDark: false },
  { id: 'm3-8', model: 3, title: 'Z.Lvl5', primaryColor: '#788292', iconType: 'orbital', textDark: false },
];

// MODÈLE 4 : Nuancier Designer, Typographie Serif & Date (Image 4 - 8 dossiers)
export const MODEL_4_FOLDERS: FolderModelItem[] = [
  { id: 'm4-1', model: 4, title: 'Mauve', primaryColor: '#63555F', textDark: false },
  { id: 'm4-2', model: 4, title: 'Plum', primaryColor: '#7D6575', textDark: false },
  { id: 'm4-3', model: 4, title: 'Lavender', primaryColor: '#D0C4F6', textDark: true },
  { id: 'm4-4', model: 4, title: 'Clay', primaryColor: '#786F64', textDark: false },
  { id: 'm4-5', model: 4, title: 'Taupe', primaryColor: '#A19182', textDark: false },
  { id: 'm4-6', model: 4, title: 'Oatmeal', primaryColor: '#FFFFE3', textDark: true },
  { id: 'm4-7', model: 4, title: 'Midnight', primaryColor: '#293B49', textDark: false },
  { id: 'm4-8', model: 4, title: 'Sky', primaryColor: '#8DC9F6', textDark: true },
];

// ============================================================================
// COMPOSANT 3D : MODÈLE 1 (Onglets Index Pastel avec case □ et flèche →)
// ============================================================================
export const FolderModel1SVG: React.FC<{
  item: FolderModelItem;
  isSelected?: boolean;
  dateText?: string;
}> = ({ item, isSelected, dateText }) => {
  const bg = item.primaryColor;
  const safeId = `m1-${item.id}-${bg.replace(/[^a-zA-Z0-9]/g, '')}`;
  const displayDate = dateText || item.subtitle || getDynamicCurrentDate().model1;

  return (
    <div className="relative w-full aspect-[220/150] select-none transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:scale-[1.02]">
      <svg
        viewBox="0 0 220 150"
        className="w-full h-full overflow-visible"
        style={{
          filter: isSelected
            ? 'drop-shadow(0 16px 24px rgba(0,0,0,0.45)) drop-shadow(0 0 14px rgba(249,115,22,0.75))'
            : 'drop-shadow(0 12px 18px rgba(0,0,0,0.32)) drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
        }}
      >
        <defs>
          <linearGradient id={`grad-${safeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={bg} stopOpacity="1" />
            <stop offset="100%" stopColor={bg} stopOpacity="0.88" />
          </linearGradient>
          <linearGradient id={`sheen-${safeId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Forme du dossier avec onglet diagonal à gauche */}
        <path
          d="M 10 0 
             L 78 0 
             Q 86 0 91 5 
             L 104 22 
             Q 109 26 118 26 
             L 212 26 
             Q 220 26 220 34 
             L 220 142 
             Q 220 150 212 150 
             L 8 150 
             Q 0 150 0 142 
             L 0 10 
             Q 0 0 10 0 Z"
          fill={`url(#grad-${safeId})`}
        />

        {/* Reflet lumineux 3D satiné */}
        <path
          d="M 10 0 
             L 78 0 
             Q 86 0 91 5 
             L 104 22 
             Q 109 26 118 26 
             L 212 26 
             Q 220 26 220 34 
             L 220 142 
             Q 220 150 212 150 
             L 8 150 
             Q 0 150 0 142 
             L 0 10 
             Q 0 0 10 0 Z"
          fill={`url(#sheen-${safeId})`}
        />

        {/* Biseau lumineux supérieur */}
        <path
          d="M 10 1 
             L 78 1 
             Q 86 1 90 6 
             L 103 23 
             Q 108 27 117 27 
             L 212 27"
          fill="none"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Ombre de biseau 3D inférieure */}
        <path
          d="M 2 142 
             Q 2 149 8 149 
             L 212 149 
             Q 218 149 218 142"
          fill="none"
          stroke="rgba(0,0,0,0.24)"
          strokeWidth="1.8"
        />

        {/* Case à cocher carrée □ dans l'onglet supérieur gauche */}
        <rect
          x="12"
          y="7"
          width="11"
          height="11"
          rx="2"
          fill="none"
          stroke="rgba(20,20,20,0.8)"
          strokeWidth="1.6"
        />
        {isSelected && (
          <path
            d="M 14.5 12.5 L 17 15 L 21 9"
            fill="none"
            stroke="#111827"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Titre en gras épuré */}
        <text
          x="12"
          y="68"
          fill="#111827"
          fontSize="17"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="-0.02em"
        >
          {item.title}
        </text>

        {/* Date en bas à gauche */}
        <text
          x="12"
          y="136"
          fill="#111827"
          opacity="0.85"
          fontSize="10"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.08em"
        >
          {displayDate}
        </text>

        {/* Flèche droite → en bas à droite */}
        <path
          d="M 194 133 L 206 133 M 201 128 L 206 133 L 201 138"
          fill="none"
          stroke="#111827"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

// ============================================================================
// COMPOSANT 3D : MODÈLE 2 (Bicolore Écolier, Rabat courbé, Date & Badge étiquette)
// ============================================================================
export const FolderModel2SVG: React.FC<{
  item: FolderModelItem;
  isSelected?: boolean;
  dateText?: string;
}> = ({ item, isSelected, dateText }) => {
  const backBg = item.primaryColor;
  const frontBg = item.secondaryColor || '#FFFFFF';
  const label = item.badge || item.title.toUpperCase();
  const safeId = `m2-${item.id}-${backBg.replace(/[^a-zA-Z0-9]/g, '')}`;
  const badgeWidth = Math.max(90, Math.min(190, label.length * 7.5 + 24));
  const displayDate = dateText || item.subtitle || getDynamicCurrentDate().model2;

  return (
    <div className="relative w-full aspect-[220/154] select-none transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:scale-[1.02]">
      <svg
        viewBox="0 0 220 154"
        className="w-full h-full overflow-visible"
        style={{
          filter: isSelected
            ? 'drop-shadow(0 16px 24px rgba(0,0,0,0.45)) drop-shadow(0 0 14px rgba(249,115,22,0.75))'
            : 'drop-shadow(0 12px 18px rgba(0,0,0,0.32)) drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
        }}
      >
        <defs>
          <linearGradient id={`grad-back-${safeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={backBg} />
            <stop offset="100%" stopColor={backBg} stopOpacity="0.88" />
          </linearGradient>
          <linearGradient id={`grad-front-${safeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={frontBg} />
            <stop offset="100%" stopColor={frontBg} stopOpacity="0.94" />
          </linearGradient>
          <linearGradient id={`gloss-${safeId}`} x1="0%" y1="0%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* 1. Couche Arrière avec onglet supérieur droit étendu */}
        <path
          d="M 12 18 
             L 112 18 
             Q 120 18 125 12 
             L 130 4 
             Q 134 0 142 0 
             L 210 0 
             Q 218 0 218 10 
             L 218 142 
             Q 218 152 208 152 
             L 12 152 
             Q 2 152 2 142 
             L 2 28 
             Q 2 18 12 18 Z"
          fill={`url(#grad-back-${safeId})`}
          stroke="#1E1E24"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />

        {/* Date dans l'onglet arrière supérieur droit (exactement où l'utilisateur a tracé le rouge sur image 2) */}
        <rect
          x="134"
          y="3"
          width="76"
          height="13.5"
          rx="3.5"
          fill="rgba(0,0,0,0.13)"
        />
        <text
          x="172"
          y="12.5"
          fill="#1E1E24"
          fontSize="7.4"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.02em"
          textAnchor="middle"
        >
          {displayDate}
        </text>

        {/* 2. Ombre portée sous le rabat avant sur la feuille arrière */}
        <path
          d="M 2 32 
             L 118 32 
             Q 128 32 134 40 
             L 142 50 
             Q 148 56 158 56 
             L 218 56"
          fill="none"
          stroke="rgba(0,0,0,0.26)"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* 3. Rabat avant courbé (pochette) */}
        <path
          d="M 12 32 
             L 118 32 
             Q 128 32 134 40 
             L 142 50 
             Q 148 56 158 56 
             L 208 56 
             Q 218 56 218 66 
             L 218 142 
             Q 218 152 208 152 
             L 12 152 
             Q 2 152 2 142 
             L 2 42 
             Q 2 32 12 32 Z"
          fill={`url(#grad-front-${safeId})`}
          stroke="#1E1E24"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />

        {/* 4. Reflet satiné sur le rabat avant */}
        <path
          d="M 12 32 
             L 118 32 
             Q 128 32 134 40 
             L 142 50 
             Q 148 56 158 56 
             L 208 56 
             Q 218 56 218 66 
             L 218 142 
             Q 218 152 208 152 
             L 12 152 
             Q 2 152 2 142 
             L 2 42 
             Q 2 32 12 32 Z"
          fill={`url(#gloss-${safeId})`}
        />

        {/* 5. Ligne de biseau lumineuse en bordure supérieure */}
        <path
          d="M 12 34 
             L 118 34 
             Q 127 34 133 41 
             L 141 51 
             Q 147 57 157 57 
             L 208 57"
          fill="none"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* 6. Badge Étiquette au bas gauche avec bordure 3D nette */}
        {/* Ombre offset 3D */}
        <rect
          x="13"
          y="117"
          width={badgeWidth}
          height="26"
          rx="8"
          fill="#1E1E24"
        />
        {/* Face blanche du badge */}
        <rect
          x="11"
          y="115"
          width={badgeWidth}
          height="26"
          rx="8"
          fill="#FFFFFF"
          stroke="#1E1E24"
          strokeWidth="2.2"
        />
        {/* Texte du badge */}
        <text
          x={11 + badgeWidth / 2}
          y="132"
          fill="#1E1E24"
          fontSize="11"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.06em"
          textAnchor="middle"
        >
          {label}
        </text>
      </svg>
    </div>
  );
};

// ============================================================================
// COMPOSANT 3D : MODÈLE 3 (Luminous Neon 3D avec Étoile Lumineuse & Icône Ligne)
// ============================================================================
export const FolderModel3SVG: React.FC<{
  item: FolderModelItem;
  isSelected?: boolean;
  dateText?: string;
}> = ({ item, isSelected, dateText }) => {
  const color = item.primaryColor;
  const safeId = `m3-${item.id}-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  const displayDate = dateText || item.subtitle || getDynamicCurrentDate().model3;

  // Rendu vectoriel précis des icônes scientifiques de l'image 3 (toujours éclatant)
  const renderSubjectIcon = () => {
    const strokeColor = item.textDark ? '#1F2937' : '#FFFFFF';
    const fillColor = item.textDark ? '#1F2937' : '#FFFFFF';

    switch (item.iconType) {
      case 'chart': // Advanced Experimental Physics
        return (
          <g stroke={strokeColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <rect x="96" y="80" width="8" height="24" rx="2" />
            <rect x="108" y="70" width="8" height="34" rx="2" />
            <rect x="120" y="84" width="8" height="20" rx="2" />
          </g>
        );
      case 'atom': // Atomic & Molecular Spectrum
        return (
          <g stroke={strokeColor} strokeWidth="1.8" fill="none">
            <circle cx="112" cy="84" r="3.5" fill={fillColor} />
            <ellipse cx="112" cy="84" rx="19" ry="8" transform="rotate(0 112 84)" />
            <ellipse cx="112" cy="84" rx="19" ry="8" transform="rotate(60 112 84)" />
            <ellipse cx="112" cy="84" rx="19" ry="8" transform="rotate(-60 112 84)" />
          </g>
        );
      case 'moon': // History & Civilization
        return (
          <g stroke={strokeColor} strokeWidth="2" strokeLinejoin="round" fill="none">
            <path d="M 120 72 A 13 13 0 1 1 106 94 A 15 15 0 0 0 120 72 Z" />
            <polygon points="123,75 124,77 126,77 124.5,78 125,80 123,79 121,80 121.5,78 120,77 122,77" fill={fillColor} />
          </g>
        );
      case 'book': // Oral Skills For Scientific English
        return (
          <g stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M 98 78 Q 112 74 112 88 Q 112 74 126 78 L 126 94 Q 112 90 112 104 Q 112 90 98 94 Z" />
            <line x1="112" y1="74" x2="112" y2="104" />
          </g>
        );
      case 'quantum': // Quantum Physics
        return (
          <g stroke={strokeColor} strokeWidth="1.8" fill="none">
            <ellipse cx="112" cy="84" rx="19" ry="7.5" transform="rotate(30 112 84)" />
            <ellipse cx="112" cy="84" rx="19" ry="7.5" transform="rotate(-30 112 84)" />
            <ellipse cx="112" cy="84" rx="19" ry="7.5" transform="rotate(90 112 84)" />
            <circle cx="112" cy="84" r="3" fill={fillColor} />
          </g>
        );
      case 'flask': // Solid State Physics 1
        return (
          <g stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M 108 72 L 116 72 M 110 72 L 110 79 L 100 95 Q 98 99 103 99 L 121 99 Q 126 99 124 95 L 114 79 L 114 72" />
            <path d="M 103 91 Q 112 89 121 91" strokeWidth="1.6" />
          </g>
        );
      case 'gear': // Thermodynamics
        return (
          <g stroke={strokeColor} strokeWidth="1.8" strokeLinejoin="round" fill="none">
            <circle cx="112" cy="84" r="6" />
            <path d="M 110 71 L 114 71 L 115 74 L 118 75 L 121 73 L 123 76 L 121 79 L 122 82 L 125 83 L 125 87 L 122 88 L 121 91 L 123 94 L 121 97 L 118 95 L 115 96 L 114 99 L 110 99 L 109 96 L 106 95 L 103 97 L 101 94 L 103 91 L 102 88 L 99 87 L 99 83 L 102 82 L 103 79 L 101 76 L 103 73 L 106 75 L 109 74 Z" />
          </g>
        );
      case 'orbital': // Z.Lvl5
      default:
        return (
          <g stroke={strokeColor} strokeWidth="1.8" fill="none">
            <circle cx="112" cy="84" r="4" fill={fillColor} />
            <circle cx="112" cy="84" r="16" strokeDasharray="3 2" opacity="0.8" />
            <ellipse cx="112" cy="84" rx="20" ry="9" transform="rotate(45 112 84)" />
            <ellipse cx="112" cy="84" rx="20" ry="9" transform="rotate(-45 112 84)" />
          </g>
        );
    }
  };

  return (
    <div className="relative w-full flex flex-col select-none group transition-transform duration-300 hover:-translate-y-1.5 hover:scale-[1.02]">
      {/* Conteneur du dossier 3D avec halo néon */}
      <div className="relative w-full aspect-[220/150]">
        <svg
          viewBox="0 0 220 150"
          className="w-full h-full overflow-visible"
          style={{
            filter: isSelected
              ? `drop-shadow(0 18px 26px ${color}A0) drop-shadow(0 0 16px rgba(249,115,22,0.9))`
              : `drop-shadow(0 14px 24px ${color}80) drop-shadow(0 6px 12px rgba(0,0,0,0.7))`
          }}
        >
          <defs>
            <linearGradient id={`grad-m3-${safeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color} stopOpacity="0.84" />
            </linearGradient>
            <linearGradient id={`sheen-m3-${safeId}`} x1="0%" y1="0%" x2="0%" y2="60%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="40%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </linearGradient>
            <filter id={`star-glow-${safeId}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Forme du dossier arrondie avec onglet à gauche */}
          <path
            d="M 16 0 
               L 82 0 
               Q 92 0 97 6 
               L 104 16 
               Q 109 22 118 22 
               L 204 22 
               Q 218 22 218 36 
               L 218 134 
               Q 218 148 204 148 
               L 16 148 
               Q 2 148 2 134 
               L 2 16 
               Q 2 0 16 0 Z"
            fill={`url(#grad-m3-${safeId})`}
          />

          {/* Dôme de lumière volumétrique 3D */}
          <path
            d="M 16 0 
               L 82 0 
               Q 92 0 97 6 
               L 104 16 
               Q 109 22 118 22 
               L 204 22 
               Q 218 22 218 36 
               L 218 134 
               Q 218 148 204 148 
               L 16 148 
               Q 2 148 2 134 
               L 2 16 
               Q 2 0 16 0 Z"
            fill={`url(#sheen-m3-${safeId})`}
          />

          {/* Ligne de reflet éclatant en bordure haute */}
          <path
            d="M 16 1 
               L 82 1 
               Q 91 1 96 7 
               L 103 17 
               Q 108 23 117 23 
               L 204 23"
            fill="none"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          {/* Étoile lumineuse blanche translucide ★ en haut à droite avec aura de néon */}
          <g transform="translate(190, 36) scale(0.9)">
            <polygon
              points="0,-10 3,-3 10,-3 4,2 6,9 0,5 -6,9 -4,2 -10,-3 -3,-3"
              fill="#FFFFFF"
              fillOpacity="0.88"
              filter={`url(#star-glow-${safeId})`}
            />
          </g>

          {/* Icône thématique centrale */}
          {renderSubjectIcon()}
        </svg>
      </div>

      {/* Titre et date au bas du dossier (comme sur l'image 3) */}
      <div className="mt-3 px-1 text-left">
        <div className="flex items-center justify-between gap-1 text-white font-extrabold text-xs sm:text-[13px] leading-tight">
          <span className="truncate group-hover:text-orange-400 transition-colors">
            {item.title}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-blue-400 shrink-0 opacity-70 group-hover:opacity-100" />
        </div>
        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
          {displayDate}
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// COMPOSANT 3D : MODÈLE 4 (Nuancier Designer, Typographie Serif & Date)
// ============================================================================
export const FolderModel4SVG: React.FC<{
  item: FolderModelItem;
  isSelected?: boolean;
  dateText?: string;
}> = ({ item, isSelected, dateText }) => {
  const color = item.primaryColor;
  const safeId = `m4-${item.id}-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  const displayDate = dateText || item.subtitle || getDynamicCurrentDate().model4;

  return (
    <div className="relative w-full aspect-[220/150] select-none transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:scale-[1.02]">
      <svg
        viewBox="0 0 220 150"
        className="w-full h-full overflow-visible"
        style={{
          filter: isSelected
            ? 'drop-shadow(6px 8px 0px rgba(0,0,0,0.55)) drop-shadow(0 0 16px rgba(249,115,22,0.8))'
            : 'drop-shadow(6px 7px 0px rgba(18,18,24,0.45)) drop-shadow(0 10px 16px rgba(0,0,0,0.25))'
        }}
      >
        <defs>
          <linearGradient id={`grad-m4-${safeId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.92" />
          </linearGradient>
          <linearGradient id={`sheen-m4-${safeId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
          </linearGradient>
        </defs>

        {/* Découpe 3D du nuancier avec onglet en haut à gauche */}
        <path
          d="M 10 0 
             L 88 0 
             Q 96 0 101 5 
             L 112 20 
             Q 117 24 126 24 
             L 212 24 
             Q 220 24 220 32 
             L 220 142 
             Q 220 150 212 150 
             L 8 150 
             Q 0 150 0 142 
             L 0 10 
             Q 0 0 10 0 Z"
          fill={`url(#grad-m4-${safeId})`}
        />

        {/* Texture satinée de papier haut de gamme */}
        <path
          d="M 10 0 
             L 88 0 
             Q 96 0 101 5 
             L 112 20 
             Q 117 24 126 24 
             L 212 24 
             Q 220 24 220 32 
             L 220 142 
             Q 220 150 212 150 
             L 8 150 
             Q 0 150 0 142 
             L 0 10 
             Q 0 0 10 0 Z"
          fill={`url(#sheen-m4-${safeId})`}
        />

        {/* Ligne de biseau lumineuse en bordure supérieure & gauche */}
        <path
          d="M 10 1 
             L 88 1 
             Q 96 1 100 5 
             L 111 21 
             Q 116 25 125 25 
             L 212 25"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* Pastille de la date (jour, mois, année, heure) remplaçant les codes hexadécimaux de l'image 1 */}
        <rect
          x="8"
          y="4.5"
          width="82"
          height="14"
          rx="4"
          fill={item.textDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.22)'}
        />
        <text
          x="49"
          y="14.5"
          fill={item.textDark ? '#2D3748' : '#FFFFFF'}
          fontSize="7.6"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, sans-serif"
          letterSpacing="0.02em"
          textAnchor="middle"
        >
          {displayDate}
        </text>

        {/* Nom du coloris en typographie Serif élégante au centre */}
        <text
          x="110"
          y="95"
          fill={item.textDark ? '#1F2937' : '#FFFFFF'}
          fontSize="20"
          fontWeight="600"
          fontFamily="Georgia, Cambria, 'Times New Roman', serif"
          textAnchor="middle"
          letterSpacing="0.02em"
        >
          {item.title}
        </text>
      </svg>
    </div>
  );
};

// ============================================================================
// CARTE UNIFIÉE D'AFFICHAGE & DE SÉLECTION D'UN MODÈLE
// ============================================================================
export const Folder3DCard: React.FC<{
  item: FolderModelItem;
  isSelected: boolean;
  customColor?: string | null;
  onSelect: (item: FolderModelItem) => void;
}> = ({ item, isSelected, customColor, onSelect }) => {
  const dynamicDates = getDynamicCurrentDate();

  // Si l'élément est sélectionné et qu'une couleur personnalisée a été choisie
  const effectivePrimaryColor = (isSelected && customColor) ? customColor : item.primaryColor;
  const effectiveSecondaryColor = (isSelected && customColor && item.model === 2)
    ? lightenColor(customColor, 0.45)
    : item.secondaryColor;

  const effectiveItem: FolderModelItem = {
    ...item,
    primaryColor: effectivePrimaryColor,
    secondaryColor: effectiveSecondaryColor,
  };

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative p-3 sm:p-4 rounded-2xl cursor-pointer transition-all duration-300 border ${
        isSelected
          ? 'bg-orange-500/15 border-orange-400 ring-2 ring-orange-400 shadow-[0_0_25px_rgba(249,115,22,0.4)] scale-[1.02]'
          : 'bg-[#0E1526]/80 hover:bg-[#141E34] border-white/10 hover:border-orange-400/40 shadow-md'
      }`}
    >
      {/* Badge indicateur de sélection */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
        {isSelected && (
          <span className="w-5 h-5 rounded-full bg-orange-500 text-black flex items-center justify-center shadow-lg animate-in zoom-in-75">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </span>
        )}
      </div>

      {/* Rendu 3D selon le modèle avec prise en compte de la date réelle et de la couleur */}
      <div className="w-full">
        {item.model === 1 && (
          <FolderModel1SVG
            item={effectiveItem}
            isSelected={isSelected}
            dateText={dynamicDates.model1}
          />
        )}
        {item.model === 2 && (
          <FolderModel2SVG
            item={effectiveItem}
            isSelected={isSelected}
            dateText={dynamicDates.model2}
          />
        )}
        {item.model === 3 && (
          <FolderModel3SVG
            item={effectiveItem}
            isSelected={isSelected}
            dateText={dynamicDates.model3}
          />
        )}
        {item.model === 4 && (
          <FolderModel4SVG
            item={effectiveItem}
            isSelected={isSelected}
            dateText={dynamicDates.model4}
          />
        )}
      </div>
    </div>
  );
};

// ============================================================================
// CARTE 3D RÉELLE DU DOSSIER CRÉÉ DANS LE CLASSEUR (À L'IDENTIQUE DU MODÈLE)
// ============================================================================
export const Classeur3DFolderCard: React.FC<{
  folder: ClasseurCreatedFolder;
  isDragging?: boolean;
}> = ({ folder, isDragging }) => {
  const item: FolderModelItem = {
    id: folder.id,
    model: folder.model,
    title: folder.name,
    primaryColor: folder.primaryColor,
    secondaryColor: folder.secondaryColor,
    badge: folder.badge,
    iconType: folder.iconType,
    textDark: folder.textDark,
  };

  return (
    <div
      className={`w-full select-none transition-all duration-200 ${
        isDragging ? 'opacity-25 scale-95' : ''
      }`}
    >
      {folder.model === 1 && (
        <FolderModel1SVG item={item} dateText={folder.dateText} />
      )}
      {folder.model === 2 && (
        <FolderModel2SVG item={item} dateText={folder.dateText} />
      )}
      {folder.model === 3 && (
        <FolderModel3SVG item={item} dateText={folder.dateText} />
      )}
      {folder.model === 4 && (
        <FolderModel4SVG item={item} dateText={folder.dateText} />
      )}
    </div>
  );
};

// ============================================================================
// FICHIER TEXTE / BLOC-NOTES TXT CONFORME À L'IMAGE 2 FOURNIE
// ============================================================================
export const TxtDocumentSVG: React.FC<{ className?: string }> = ({ className = "w-full h-auto" }) => {
  return (
    <svg 
      viewBox="0 0 160 215" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="txt-page-gradient" x1="0" y1="0" x2="160" y2="215" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#C6EEFA" />
          <stop offset="100%" stopColor="#A8E2F4" />
        </linearGradient>
        <linearGradient id="txt-fold-gradient" x1="122" y1="0" x2="160" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E2F7FD" />
          <stop offset="100%" stopColor="#89D3EB" />
        </linearGradient>
      </defs>

      {/* Page principale avec coins arrondis et coin supérieur droit biseauté pour le pli */}
      <path
        d="M 22 0 
           L 122 0 
           L 160 38 
           L 160 193 
           Q 160 215 138 215 
           L 22 215 
           Q 0 215 0 193 
           L 0 22 
           Q 0 0 22 0 Z"
        fill="url(#txt-page-gradient)"
      />

      {/* Ombre sous le pli */}
      <path
        d="M 122 0 
           L 122 28 
           Q 122 38 132 38 
           L 160 38 Z"
        fill="#000000"
        opacity="0.12"
      />

      {/* Coin plié supérieur droit (dog-ear) */}
      <path
        d="M 122 0 
           L 122 28 
           Q 122 38 132 38 
           L 160 38 Z"
        fill="url(#txt-fold-gradient)"
      />

      {/* 3 lignes de texte stylisées au centre (Image 2) */}
      {/* Ligne 1 : Segment court + Segment long */}
      <rect x="36" y="94" width="28" height="8.5" rx="4.25" fill="#3B5D71" />
      <rect x="72" y="94" width="52" height="8.5" rx="4.25" fill="#3B5D71" />

      {/* Ligne 2 : Segment long + Segment court */}
      <rect x="36" y="111" width="50" height="8.5" rx="4.25" fill="#3B5D71" />
      <rect x="94" y="111" width="30" height="8.5" rx="4.25" fill="#3B5D71" />

      {/* Ligne 3 : Segment moyen + Segment moyen */}
      <rect x="36" y="128" width="36" height="8.5" rx="4.25" fill="#3B5D71" />
      <rect x="80" y="128" width="44" height="8.5" rx="4.25" fill="#3B5D71" />

      {/* Texte TXT en gras italique au bas (Image 2) */}
      <text
        x="80"
        y="184"
        fill="#325467"
        fontSize="32"
        fontWeight="900"
        fontStyle="italic"
        fontFamily="system-ui, -apple-system, sans-serif"
        textAnchor="middle"
        letterSpacing="0.05em"
      >
        TXT
      </text>
    </svg>
  );
};


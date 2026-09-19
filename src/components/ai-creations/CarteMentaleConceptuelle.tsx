import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Download,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Edit2,
  Check,
  X,
  Palette,
  Crosshair,
  Layers,
  Sparkles,
  ChevronDown,
  LayoutGrid,
  FileImage,
  HelpCircle
} from 'lucide-react';

export interface ConceptCard {
  id: string;
  parentId: string | null;
  level: 0 | 1 | 2;
  pillTitle: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pillWidth: number;
  color: string;
  shadowColor?: string;
  collapsed?: boolean;
}

export interface ConceptMapDataset {
  id: string;
  name: string;
  badge: string;
  rootTitle: string;
  rootColor: string;
  cards: ConceptCard[];
}

// 1. DATASET 1: SAGE-FEMME - 3 PILIERS MAJEURS (Matching Image 3-Column Template)
const DATASET_SAGE_FEMME_3COL: ConceptMapDataset = {
  id: 'sage-femme-3col',
  name: 'Projet Sage-Femme (3 Piliers)',
  badge: 'Recommandé',
  rootTitle: 'PROJET SITE WEB SAGE-FEMME',
  rootColor: '#F59E0B',
  cards: [
    // --- COLONNE 1 : GYNÉCOLOGIE & PRÉVENTION (Cyan) ---
    {
      id: 'col-gyneco',
      parentId: 'root',
      level: 1,
      pillTitle: 'SUIVI & GYNÉCOLOGIE',
      description:
        'Accompagnement gynécologique de prévention tout au long de la vie de la femme : frottis, prescription de contraception et écoute bienveillante.',
      x: 320,
      y: 225,
      width: 260,
      height: 155,
      pillWidth: 195,
      color: '#06B6D4', // Cyan
      shadowColor: '#22D3EE'
    },
    {
      id: 'sub-suivi-feminin',
      parentId: 'col-gyneco',
      level: 2,
      pillTitle: 'SUIVI AU FÉMININ',
      description:
        'Consultation annuelle, frottis cervico-utérin, palpation mammaire et orientation personnalisée selon les besoins.',
      x: 180,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 160,
      color: '#06B6D4',
      shadowColor: '#22D3EE'
    },
    {
      id: 'sub-contraception',
      parentId: 'col-gyneco',
      level: 2,
      pillTitle: 'CONTRACEPTION',
      description:
        'Choix de la contraception adaptée : pilule, pose/retrait de stérilet (DIU), implant sous-cutané et suivi d’efficacité.',
      x: 460,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 160,
      color: '#06B6D4',
      shadowColor: '#22D3EE'
    },

    // --- COLONNE 2 : GROSSESSE & PRÉPARATION (Vert Émeraude) ---
    {
      id: 'col-grossesse',
      parentId: 'root',
      level: 1,
      pillTitle: 'GROSSESSE & NAISSANCE',
      description:
        'Suivi médical de la femme enceinte de la déclaration à l’accouchement : consultations mensuelles, échographies et préparation globale.',
      x: 760,
      y: 225,
      width: 260,
      height: 155,
      pillWidth: 205,
      color: '#10B981', // Vert émeraude
      shadowColor: '#34D399'
    },
    {
      id: 'sub-suivi-mensuel',
      parentId: 'col-grossesse',
      level: 2,
      pillTitle: 'SUIVI PRÉNATAL',
      description:
        'Consultations mensuelles obligatoires, suivi biologique, monitoring fœtal et déclaration administrative de grossesse.',
      x: 620,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 160,
      color: '#10B981',
      shadowColor: '#34D399'
    },
    {
      id: 'sub-prepa-naissance',
      parentId: 'col-grossesse',
      level: 2,
      pillTitle: 'PRÉPARATION NAISSANCE',
      description:
        'Entretien prénatal précoce (EPP), séances d’haptonomie, sophrologie, gestion des contractions et accueil du nouveau-né.',
      x: 900,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 185,
      color: '#10B981',
      shadowColor: '#34D399'
    },

    // --- COLONNE 3 : POSTNATAL & RÉÉDUCATION (Rose / Magenta) ---
    {
      id: 'col-postnatal',
      parentId: 'root',
      level: 1,
      pillTitle: 'POSTNATAL & RÉÉDUCATION',
      description:
        'Soutien bienveillant au retour à domicile : programme Prado, pesée du bébé, accompagnement de l’allaitement et rééducation périnéale.',
      x: 1200,
      y: 225,
      width: 260,
      height: 155,
      pillWidth: 215,
      color: '#EC4899', // Rose/Magenta
      shadowColor: '#F472B6'
    },
    {
      id: 'sub-visites-prado',
      parentId: 'col-postnatal',
      level: 2,
      pillTitle: 'VISITES PRADO & BÉBÉ',
      description:
        'Visites à domicile dès la sortie de la maternité, surveillance de la cicatrisation, poids du bébé et soutien de l’allaitement maternel.',
      x: 1060,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 180,
      color: '#EC4899',
      shadowColor: '#F472B6'
    },
    {
      id: 'sub-reeducation-perinee',
      parentId: 'col-postnatal',
      level: 2,
      pillTitle: 'RÉÉDUCATION PÉRINÉE',
      description:
        '10 séances personnalisées en CMP (connaissance et maîtrise du périnée) ou électrostimulation/biofeedback post-accouchement.',
      x: 1340,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 185,
      color: '#EC4899',
      shadowColor: '#F472B6'
    }
  ]
};

// 2. DATASET 2: SAGE-FEMME - VUE ÉTENDUE (6 COLONNES COMPLÈTES)
const DATASET_SAGE_FEMME_FULL: ConceptMapDataset = {
  id: 'sage-femme-6col',
  name: 'Projet Sage-Femme (Vue Complète)',
  badge: 'Complet',
  rootTitle: 'PROJET SITE WEB SAGE-FEMME',
  rootColor: '#F59E0B',
  cards: [
    // 1. Pages obligatoires & Accueil (Cobalt Blue)
    {
      id: 'col-accueil',
      parentId: 'root',
      level: 1,
      pillTitle: 'ACCUEIL & LÉGAL',
      description:
        'Page d’accueil attractive présentant l’ensemble des spécialités, mentions légales obligatoires et plan du site.',
      x: 200,
      y: 225,
      width: 240,
      height: 150,
      pillWidth: 165,
      color: '#0284C7',
      shadowColor: '#38BDF8'
    },
    {
      id: 'sub-accueil-1',
      parentId: 'col-accueil',
      level: 2,
      pillTitle: 'MENTIONS LÉGALES',
      description:
        'Identité RPPS, ordre professionnel des sages-femmes, hébergeur et politique RGPD.',
      x: 100,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 150,
      color: '#0284C7',
      shadowColor: '#38BDF8'
    },
    {
      id: 'sub-accueil-2',
      parentId: 'col-accueil',
      level: 2,
      pillTitle: 'PRÉSENTATION OFFRE',
      description:
        'Mise en valeur claire des motifs de consultation et prise de rendez-vous en ligne.',
      x: 300,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 165,
      color: '#0284C7',
      shadowColor: '#38BDF8'
    },

    // 2. Gynécologie
    {
      id: 'col-gyneco-6',
      parentId: 'root',
      level: 1,
      pillTitle: 'GYNÉCOLOGIE',
      description:
        'Suivi de prévention de la jeune fille à la femme ménopausée, contraception et bilans réguliers.',
      x: 520,
      y: 225,
      width: 240,
      height: 150,
      pillWidth: 150,
      color: '#2563EB',
      shadowColor: '#60A5FA'
    },
    {
      id: 'sub-gyneco-6-1',
      parentId: 'col-gyneco-6',
      level: 2,
      pillTitle: 'DÉPISTAGE & FROTTIS',
      description:
        'Frottis cervico-utérin tous les 3 ans, palpation mammaire et bilan sérologique.',
      x: 420,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 160,
      color: '#2563EB',
      shadowColor: '#60A5FA'
    },
    {
      id: 'sub-gyneco-6-2',
      parentId: 'col-gyneco-6',
      level: 2,
      pillTitle: 'PRESCRIPTIONS',
      description:
        'Pilules, stérilets cuivre/hormonal, implants et contraception d’urgence.',
      x: 620,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 150,
      color: '#2563EB',
      shadowColor: '#60A5FA'
    },

    // 3. Grossesse
    {
      id: 'col-grossesse-6',
      parentId: 'root',
      level: 1,
      pillTitle: 'GROSSESSE',
      description:
        'Surveillance de la grossesse normale, déclaration, bilans sanguins mensuels et monitoring.',
      x: 840,
      y: 225,
      width: 240,
      height: 150,
      pillWidth: 140,
      color: '#059669',
      shadowColor: '#34D399'
    },
    {
      id: 'sub-grossesse-6-1',
      parentId: 'col-grossesse-6',
      level: 2,
      pillTitle: 'SUIVI MÉDICAL',
      description:
        'Consultation mensuelle, tension, hauteur utérine et bruits du cœur du fœtus.',
      x: 740,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 140,
      color: '#059669',
      shadowColor: '#34D399'
    },
    {
      id: 'sub-grossesse-6-2',
      parentId: 'col-grossesse-6',
      level: 2,
      pillTitle: 'MONITORING',
      description:
        'Enregistrement du rythme cardiaque fœtal au cabinet ou à domicile sur prescription.',
      x: 940,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 140,
      color: '#059669',
      shadowColor: '#34D399'
    },

    // 4. Prépa Naissance
    {
      id: 'col-prepa-6',
      parentId: 'root',
      level: 1,
      pillTitle: 'PRÉPA NAISSANCE',
      description:
        'Les 8 séances de préparation à la parentalité : respiration, postures, haptonomie et allaitement.',
      x: 1160,
      y: 225,
      width: 240,
      height: 150,
      pillWidth: 165,
      color: '#16A34A',
      shadowColor: '#4ADE80'
    },
    {
      id: 'sub-prepa-6-1',
      parentId: 'col-prepa-6',
      level: 2,
      pillTitle: 'ENTRETIEN PRÉNATAL',
      description:
        'Entretien du 4e mois pour aborder les émotions, le projet de naissance et les attentes.',
      x: 1060,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 160,
      color: '#16A34A',
      shadowColor: '#4ADE80'
    },
    {
      id: 'sub-prepa-6-2',
      parentId: 'col-prepa-6',
      level: 2,
      pillTitle: 'HAPTONOMIE',
      description:
        'Communication affective in utero entre les deux parents et le bébé dès 4 mois.',
      x: 1260,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 145,
      color: '#16A34A',
      shadowColor: '#4ADE80'
    },

    // 5. Rééducation & Postnatal
    {
      id: 'col-reeduc-6',
      parentId: 'root',
      level: 1,
      pillTitle: 'RÉÉDUCATION',
      description:
        'Rééducation post-natale du périnée et de la sangle abdominale avec méthode douce.',
      x: 1480,
      y: 225,
      width: 240,
      height: 150,
      pillWidth: 150,
      color: '#D946EF',
      shadowColor: '#F0ABFC'
    },
    {
      id: 'sub-reeduc-6-1',
      parentId: 'col-reeduc-6',
      level: 2,
      pillTitle: 'VISITE POSTNATALE',
      description:
        'Examen médical complet 6 à 8 semaines après l’accouchement.',
      x: 1380,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 160,
      color: '#D946EF',
      shadowColor: '#F0ABFC'
    },
    {
      id: 'sub-reeduc-6-2',
      parentId: 'col-reeduc-6',
      level: 2,
      pillTitle: 'PÉRINÉE & SPORT',
      description:
        'Reprise du tonus musculaire périnéal avant toute reprise d’activité sportive.',
      x: 1580,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 160,
      color: '#D946EF',
      shadowColor: '#F0ABFC'
    },

    // 6. Cabinet, Contact & Blog
    {
      id: 'col-cabinet-6',
      parentId: 'root',
      level: 1,
      pillTitle: 'CABINET & CONTACT',
      description:
        'Biographie professionnelle de la praticienne, plan d’accès Google Map, parking et articles de blog.',
      x: 1800,
      y: 225,
      width: 240,
      height: 150,
      pillWidth: 175,
      color: '#F97316',
      shadowColor: '#FDBA74'
    },
    {
      id: 'sub-cabinet-6-1',
      parentId: 'col-cabinet-6',
      level: 2,
      pillTitle: 'PLAN D’ACCÈS',
      description:
        'Localisation précise, stationnement gratuit et accessibilité personnes à mobilité réduite.',
      x: 1700,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 150,
      color: '#F97316',
      shadowColor: '#FDBA74'
    },
    {
      id: 'sub-cabinet-6-2',
      parentId: 'col-cabinet-6',
      level: 2,
      pillTitle: 'BLOG DU CABINET',
      description:
        'Conseils d’hygiène, réponses aux questions fréquentes et actualités périnatalité.',
      x: 1900,
      y: 465,
      width: 210,
      height: 140,
      pillWidth: 155,
      color: '#F97316',
      shadowColor: '#FDBA74'
    }
  ]
};

// 3. DATASET 3: TEMPLATE ORIGINAL DE L'IMAGE ("CONCEPT MAP")
const DATASET_ORIGINAL_IMAGE: ConceptMapDataset = {
  id: 'original-concept-map',
  name: 'Modèle Image (Concept Map)',
  badge: 'Template Image',
  rootTitle: 'CONCEPT MAP',
  rootColor: '#F59E0B',
  cards: [
    // Column 1
    {
      id: 'orig-col-1',
      parentId: 'root',
      level: 1,
      pillTitle: 'IDENTIFY YOUR PASSION',
      description:
        'Discover what you’re truly passionate about. Consider your interests, skills, and values to determine what career path aligns with your aspirations.',
      x: 320,
      y: 225,
      width: 260,
      height: 160,
      pillWidth: 200,
      color: '#06B6D4',
      shadowColor: '#22D3EE'
    },
    {
      id: 'orig-sub-1-1',
      parentId: 'orig-col-1',
      level: 2,
      pillTitle: 'SELF REFLECTION',
      description:
        'Reflect on your strengths, weaknesses, and interests to gain clarity about your career direction.',
      x: 180,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 160,
      color: '#06B6D4',
      shadowColor: '#22D3EE'
    },
    {
      id: 'orig-sub-1-2',
      parentId: 'orig-col-1',
      level: 2,
      pillTitle: 'RESEARCH',
      description:
        'Conduct thorough research about different industries and professions to explore various career options.',
      x: 460,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 140,
      color: '#06B6D4',
      shadowColor: '#22D3EE'
    },

    // Column 2
    {
      id: 'orig-col-2',
      parentId: 'root',
      level: 1,
      pillTitle: 'SET CLEAR GOALS',
      description:
        'Define specific and achievable career goals. Break them down into smaller milestones to keep yourself motivated and focused on your journey towards the job.',
      x: 760,
      y: 225,
      width: 260,
      height: 160,
      pillWidth: 180,
      color: '#10B981',
      shadowColor: '#34D399'
    },
    {
      id: 'orig-sub-2-1',
      parentId: 'orig-col-2',
      level: 2,
      pillTitle: 'SMART GOALS',
      description:
        'Specific, Measurable, Achievable, Time-bound goals to ensure clarity and effectiveness in goal-setting.',
      x: 620,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 150,
      color: '#10B981',
      shadowColor: '#34D399'
    },
    {
      id: 'orig-sub-2-2',
      parentId: 'orig-col-2',
      level: 2,
      pillTitle: 'ACTION PLAN',
      description:
        'Develop a detailed action plan outlining the steps you need to take to achieve each of your career goals.',
      x: 900,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 150,
      color: '#10B981',
      shadowColor: '#34D399'
    },

    // Column 3
    {
      id: 'orig-col-3',
      parentId: 'root',
      level: 1,
      pillTitle: 'RELEVANT EXPERIENCE',
      description:
        'Acquire practical experience and skills relevant to your desired job. Seek internships, volunteer opportunities, or roles in your field enhance your qualifications.',
      x: 1200,
      y: 225,
      width: 260,
      height: 160,
      pillWidth: 210,
      color: '#EC4899',
      shadowColor: '#F472B6'
    },
    {
      id: 'orig-sub-3-1',
      parentId: 'orig-col-3',
      level: 2,
      pillTitle: 'INTERNSHIPS',
      description:
        'Seek out internships or apprenticeships in your desired field to gain practical experience and expand your professional network.',
      x: 1060,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 150,
      color: '#EC4899',
      shadowColor: '#F472B6'
    },
    {
      id: 'orig-sub-3-2',
      parentId: 'orig-col-3',
      level: 2,
      pillTitle: 'SKILL DEVELOPMENT',
      description:
        'Invest in acquiring new skills or enhancing existing ones through workshops, courses, or online learning platforms.',
      x: 1340,
      y: 470,
      width: 240,
      height: 150,
      pillWidth: 175,
      color: '#EC4899',
      shadowColor: '#F472B6'
    }
  ]
};

const ALL_DATASETS: ConceptMapDataset[] = [
  DATASET_SAGE_FEMME_3COL,
  DATASET_SAGE_FEMME_FULL,
  DATASET_ORIGINAL_IMAGE
];

const PRESET_PALETTES = [
  { name: 'Pop Pastel (Image)', col1: '#06B6D4', col2: '#10B981', col3: '#EC4899' },
  { name: 'Médical Pro', col1: '#0284C7', col2: '#0D9488', col3: '#7C3AED' },
  { name: 'Sunset Vif', col1: '#3B82F6', col2: '#F59E0B', col3: '#EF4444' }
];

function buildConceptMapDataset(data: any, fallbackTitle?: string): ConceptMapDataset | null {
  if (!data) return null;
  if (data.cards && Array.isArray(data.cards) && data.cards.length > 0) {
    return {
      id: 'ai-dataset',
      name: data.name || data.title || fallbackTitle || 'Carte Conceptuelle',
      badge: 'Généré par IA',
      rootTitle: data.rootTitle || data.title || fallbackTitle || 'Carte Conceptuelle',
      rootColor: data.rootColor || '#F59E0B',
      cards: data.cards
    };
  }

  const cols = Array.isArray(data.columns) ? data.columns : (Array.isArray(data.categories) ? data.categories : (Array.isArray(data.branches) ? data.branches : []));
  if (cols.length === 0) return null;

  const rootTitle = data.rootTitle || data.title || fallbackTitle || 'Carte Conceptuelle';
  const palette = ['#06B6D4', '#10B981', '#EC4899', '#3B82F6', '#F59E0B', '#8B5CF6'];
  const generatedCards: ConceptCard[] = [];
  const colWidth = 280;
  const startX = 200;

  cols.slice(0, 6).forEach((col: any, cIdx: number) => {
    const colId = `col_${cIdx + 1}`;
    const colColor = palette[cIdx % palette.length];
    const colTitle = col.title || col.name || col.label || `Colonne ${cIdx + 1}`;
    const xPos = startX + cIdx * colWidth;

    generatedCards.push({
      id: colId,
      parentId: 'root',
      level: 1,
      pillTitle: colTitle,
      description: col.description || col.subtitle || 'Axe fondamental',
      x: xPos,
      y: 190,
      width: 250,
      height: 90,
      pillWidth: Math.min(220, Math.max(120, colTitle.length * 9)),
      color: colColor,
      shadowColor: colColor
    });

    const items = Array.isArray(col.cards) ? col.cards : (Array.isArray(col.items) ? col.items : (Array.isArray(col.children) ? col.children : []));
    let curY = 320;
    items.forEach((item: any, iIdx: number) => {
      const cardTitle = typeof item === 'string' ? item : (item.title || item.pillTitle || item.pillText || item.name || `Notion ${iIdx + 1}`);
      const cardDesc = typeof item === 'string' ? '' : (item.description || item.desc || item.body || '');
      generatedCards.push({
        id: `${colId}_c_${iIdx + 1}`,
        parentId: colId,
        level: 2,
        pillTitle: cardTitle,
        description: cardDesc,
        x: xPos,
        y: curY,
        width: 250,
        height: cardDesc ? 100 : 70,
        pillWidth: Math.min(200, Math.max(100, cardTitle.length * 8)),
        color: colColor,
        shadowColor: colColor
      });
      curY += cardDesc ? 120 : 85;
    });
  });

  return {
    id: 'ai-dataset',
    name: rootTitle,
    badge: 'Généré par IA',
    rootTitle,
    rootColor: '#F59E0B',
    cards: generatedCards
  };
}

export default function CarteMentaleConceptuelle({ data, title }: { data?: any; title?: string }) {
  const dynamicDataset = useMemo(() => buildConceptMapDataset(data, title), [data, title]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(dynamicDataset ? 'ai-dataset' : 'sage-femme-3col');
  const [datasetsState, setDatasetsState] = useState<Record<string, ConceptMapDataset>>(() => {
    const base: Record<string, ConceptMapDataset> = {
      'sage-femme-3col': JSON.parse(JSON.stringify(DATASET_SAGE_FEMME_3COL)),
      'sage-femme-6col': JSON.parse(JSON.stringify(DATASET_SAGE_FEMME_FULL)),
      'original-concept-map': JSON.parse(JSON.stringify(DATASET_ORIGINAL_IMAGE))
    };
    if (dynamicDataset) {
      base['ai-dataset'] = dynamicDataset;
    }
    return base;
  });

  useEffect(() => {
    if (dynamicDataset) {
      setDatasetsState((prev) => ({
        ...prev,
        'ai-dataset': dynamicDataset
      }));
      setSelectedDatasetId('ai-dataset');
    }
  }, [dynamicDataset]);

  const activeDataset = datasetsState[selectedDatasetId] || (dynamicDataset || DATASET_SAGE_FEMME_3COL);
  const cards = activeDataset.cards;

  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editPill, setEditPill] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDatasetMenu, setShowDatasetMenu] = useState(false);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingCanvasRef = useRef(false);
  const isDraggingCardRef = useRef(false);
  const draggedCardIdRef = useRef<string | null>(null);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const initialPanRef = useRef({ x: 0, y: 0 });
  const initialCardsStateRef = useRef<ConceptCard[]>([]);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);

  // Group cards by parent
  const childrenMap = useMemo(() => {
    const map = new Map<string, ConceptCard[]>();
    cards.forEach((c) => {
      const arr = map.get(c.parentId || 'root') || [];
      arr.push(c);
      map.set(c.parentId || 'root', arr);
    });
    return map;
  }, [cards]);

  const cardMap = useMemo(() => {
    const map = new Map<string, ConceptCard>();
    cards.forEach((c) => map.set(c.id, c));
    return map;
  }, [cards]);

  // Root box definition
  const rootBox = useMemo(() => {
    const level1Cards = childrenMap.get('root') || [];
    if (level1Cards.length === 0) {
      return { x: 760, y: 65, width: 340, height: 70 };
    }
    const minX = Math.min(...level1Cards.map((c) => c.x));
    const maxX = Math.max(...level1Cards.map((c) => c.x));
    const centerX = (minX + maxX) / 2;
    return {
      x: centerX,
      y: 65,
      width: activeDataset.rootTitle.length > 20 ? 380 : 310,
      height: 72
    };
  }, [childrenMap, activeDataset.rootTitle]);

  // Check if card is visible
  const isCardVisible = useCallback(
    (card: ConceptCard): boolean => {
      if (card.level === 1) return true;
      if (card.parentId && collapsedParents[card.parentId]) {
        return false;
      }
      return true;
    },
    [collapsedParents]
  );

  // Calculate bounding box for auto-fit
  const calculateBounds = useCallback(() => {
    const visibleCards = cards.filter(isCardVisible);
    if (visibleCards.length === 0) {
      return { minX: 0, maxX: 1200, minY: 0, maxY: 700, width: 1200, height: 700 };
    }
    let minX = rootBox.x - rootBox.width / 2;
    let maxX = rootBox.x + rootBox.width / 2;
    let minY = rootBox.y - rootBox.height / 2;
    let maxY = rootBox.y + rootBox.height / 2;

    visibleCards.forEach((c) => {
      minX = Math.min(minX, c.x - c.width / 2 - 20);
      maxX = Math.max(maxX, c.x + c.width / 2 + 25);
      minY = Math.min(minY, c.y - c.height / 2 - 30);
      maxY = Math.max(maxY, c.y + c.height / 2 + 30);
    });

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(maxX - minX, 600),
      height: Math.max(maxY - minY, 500)
    };
  }, [cards, rootBox, isCardVisible]);

  // Fit to screen
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const containerW = rect.width || window.innerWidth;
    const containerH = rect.height || (window.innerHeight - 64);
    if (containerW <= 10 || containerH <= 10) return;

    const bounds = calculateBounds();
    const padX = containerW < 640 ? 20 : 50;
    const padY = containerW < 640 ? 30 : 60;

    const scaleX = (containerW - padX * 2) / bounds.width;
    const scaleY = (containerH - padY * 2) / bounds.height;
    const idealZoom = Math.min(scaleX, scaleY);
    const newZoom = Math.min(Math.max(idealZoom, 0.2), 1.25);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const newPanX = containerW / 2 - centerX * newZoom;
    const newPanY = containerH / 2 - centerY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [calculateBounds]);

  // Initial fit and window resize observer
  useEffect(() => {
    fitToScreen();
    const t = setTimeout(() => fitToScreen(), 120);
    return () => clearTimeout(t);
  }, [fitToScreen, selectedDatasetId]);

  // Zoom handlers
  const handleZoom = (delta: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const nextZoom = Math.min(Math.max(zoom + delta, 0.18), 2.2);
    const newPanX = centerX - (centerX - pan.x) * (nextZoom / zoom);
    const newPanY = centerY - (centerY - pan.y) * (nextZoom / zoom);

    setZoom(nextZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleReset = () => {
    const original =
      selectedDatasetId === 'sage-femme-3col'
        ? DATASET_SAGE_FEMME_3COL
        : selectedDatasetId === 'sage-femme-6col'
        ? DATASET_SAGE_FEMME_FULL
        : DATASET_ORIGINAL_IMAGE;

    setDatasetsState((prev) => ({
      ...prev,
      [selectedDatasetId]: JSON.parse(JSON.stringify(original))
    }));
    setCollapsedParents({});
    setTimeout(() => fitToScreen(), 40);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const nextZoom = Math.min(Math.max(zoom * zoomFactor, 0.18), 2.2);

    const newPanX = mouseX - (mouseX - pan.x) * (nextZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (nextZoom / zoom);

    setZoom(nextZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Dragging Canvas
  const handlePointerDown = (e: React.PointerEvent) => {
    if (editingCardId) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch pinch zoom
    if (activePointersRef.current.size === 2) {
      isDraggingCanvasRef.current = false;
      isDraggingCardRef.current = false;
      const pts = Array.from(activePointersRef.current.values()) as { x: number; y: number }[];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      initialPinchDistRef.current = dist;
      initialPinchZoomRef.current = zoom;
      return;
    }

    if (!isDraggingCardRef.current) {
      isDraggingCanvasRef.current = true;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      initialPanRef.current = { ...pan };
    }
  };

  const handleCardPointerDown = (cardId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      isDraggingCardRef.current = true;
      isDraggingCanvasRef.current = false;
      draggedCardIdRef.current = cardId;
      dragStartPosRef.current = { x: e.clientX, y: e.clientY };
      initialCardsStateRef.current = [...cards];
      setSelectedCardId(cardId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Pinch-to-zoom
    if (activePointersRef.current.size === 2 && initialPinchDistRef.current) {
      const pts = Array.from(activePointersRef.current.values()) as { x: number; y: number }[];
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = currentDist / initialPinchDistRef.current;
      const nextZoom = Math.min(Math.max(initialPinchZoomRef.current * ratio, 0.18), 2.2);

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
        const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
        const newPanX = midX - (midX - pan.x) * (nextZoom / zoom);
        const newPanY = midY - (midY - pan.y) * (nextZoom / zoom);
        setZoom(nextZoom);
        setPan({ x: newPanX, y: newPanY });
      }
      return;
    }

    // Panning canvas
    if (isDraggingCanvasRef.current) {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      setPan({
        x: initialPanRef.current.x + dx,
        y: initialPanRef.current.y + dy
      });
      return;
    }

    // Dragging single card
    if (isDraggingCardRef.current && draggedCardIdRef.current) {
      const dx = (e.clientX - dragStartPosRef.current.x) / zoom;
      const dy = (e.clientY - dragStartPosRef.current.y) / zoom;

      const targetId = draggedCardIdRef.current;
      const initialMap = new Map<string, ConceptCard>();
      initialCardsStateRef.current.forEach((c) => initialMap.set(c.id, c));
      const initial = initialMap.get(targetId);
      if (!initial) return;

      setDatasetsState((prev) => {
        const currDataset = prev[selectedDatasetId];
        return {
          ...prev,
          [selectedDatasetId]: {
            ...currDataset,
            cards: currDataset.cards.map((c) => {
              if (c.id === targetId) {
                return {
                  ...c,
                  x: Math.round(initial.x + dx),
                  y: Math.round(initial.y + dy)
                };
              }
              return c;
            })
          }
        };
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      initialPinchDistRef.current = null;
    }
    if (activePointersRef.current.size === 0) {
      isDraggingCanvasRef.current = false;
      isDraggingCardRef.current = false;
      draggedCardIdRef.current = null;
    }
  };

  // Editing card
  const startEditingCard = (card: ConceptCard) => {
    setEditingCardId(card.id);
    setEditPill(card.pillTitle);
    setEditDesc(card.description);
  };

  const saveEditingCard = () => {
    if (editingCardId && editPill.trim()) {
      setDatasetsState((prev) => {
        const curr = prev[selectedDatasetId];
        return {
          ...prev,
          [selectedDatasetId]: {
            ...curr,
            cards: curr.cards.map((c) => {
              if (c.id === editingCardId) {
                return {
                  ...c,
                  pillTitle: editPill.trim().toUpperCase(),
                  description: editDesc.trim(),
                  pillWidth: Math.max(editPill.trim().length * 10 + 40, 140)
                };
              }
              return c;
            })
          }
        };
      });
    }
    setEditingCardId(null);
  };

  const handleAddCard = (parentCard: ConceptCard) => {
    const newId = `card-custom-${Date.now()}`;
    const siblings = cards.filter((c) => c.parentId === parentCard.id);
    const offsetX = (siblings.length + 1) * 30 - 30;

    const newCard: ConceptCard = {
      id: newId,
      parentId: parentCard.id,
      level: 2,
      pillTitle: 'NOUVEAU BLOC',
      description: 'Cliquez sur Modifier pour personnaliser le texte de ce bloc.',
      x: parentCard.x + offsetX,
      y: parentCard.y + 240,
      width: 240,
      height: 150,
      pillWidth: 150,
      color: parentCard.color,
      shadowColor: parentCard.shadowColor || parentCard.color
    };

    setDatasetsState((prev) => {
      const curr = prev[selectedDatasetId];
      return {
        ...prev,
        [selectedDatasetId]: {
          ...curr,
          cards: [...curr.cards, newCard]
        }
      };
    });

    setCollapsedParents((prev) => ({ ...prev, [parentCard.id]: false }));
    setSelectedCardId(newId);
    startEditingCard(newCard);
  };

  const handleDeleteCard = (cardId: string) => {
    setDatasetsState((prev) => {
      const curr = prev[selectedDatasetId];
      const toDelete = new Set<string>([cardId]);
      curr.cards.forEach((c) => {
        if (c.parentId === cardId) toDelete.add(c.id);
      });
      return {
        ...prev,
        [selectedDatasetId]: {
          ...curr,
          cards: curr.cards.filter((c) => !toDelete.has(c.id))
        }
      };
    });
    setSelectedCardId(null);
  };

  // Toggle card children collapse
  const toggleCollapse = (cardId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedParents((prev) => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // Download SVG
  const handleExportSVG = () => {
    const svgEl = document.getElementById('concept-map-svg-stage');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carte-conceptuelle-${selectedDatasetId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Apply a palette to the 3 main columns
  const applyPalette = (palette: { col1: string; col2: string; col3: string }) => {
    setDatasetsState((prev) => {
      const curr = prev[selectedDatasetId];
      const level1Cards = curr.cards.filter((c) => c.level === 1);
      const colorMapping: Record<string, string> = {};

      if (level1Cards[0]) colorMapping[level1Cards[0].id] = palette.col1;
      if (level1Cards[1]) colorMapping[level1Cards[1].id] = palette.col2;
      if (level1Cards[2]) colorMapping[level1Cards[2].id] = palette.col3;

      return {
        ...prev,
        [selectedDatasetId]: {
          ...curr,
          cards: curr.cards.map((c) => {
            if (c.level === 1 && colorMapping[c.id]) {
              return { ...c, color: colorMapping[c.id], shadowColor: colorMapping[c.id] };
            }
            if (c.level === 2 && c.parentId && colorMapping[c.parentId]) {
              return { ...c, color: colorMapping[c.parentId], shadowColor: colorMapping[c.parentId] };
            }
            return c;
          })
        }
      };
    });
  };

  const selectedCard = selectedCardId ? cardMap.get(selectedCardId) : null;

  return (
    <div
      id="module-carte-mentale-conceptuelle"
      ref={containerRef}
      className={`relative w-full overflow-hidden select-none bg-[#F4F6F8] font-sans ${
        isFullscreen ? 'h-screen' : 'h-[calc(100vh-64px)] min-h-[560px]'
      }`}
      style={{ touchAction: 'none' }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* 
        FIXED TOP CONTROLS: Elevated, stationary, never moves during panning/zooming.
        Row 1: Main toolbar (zoom, fit, reset, export, fullscreen).
        Row 2: Selected card action bar directly below it, on the same line, disappearing when nothing is selected.
      */}
      <div
        id="concept-map-top-controls-wrapper"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1.5 pointer-events-auto"
      >
        {/* Row 1: Main Toolbar */}
        <div
          id="concept-map-toolbar-actions"
          className="flex items-center gap-1 bg-white/95 backdrop-blur-md px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl border-2 border-slate-800 shadow-md"
        >
          {/* Zoom Out */}
          <button
            id="btn-cm-zoom-out"
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors active:scale-95"
            title="Zoom arrière"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Zoom Percentage */}
          <span className="text-xs font-mono font-bold px-1 text-slate-800 min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          {/* Zoom In */}
          <button
            id="btn-cm-zoom-in"
            onClick={() => handleZoom(0.15)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors active:scale-95"
            title="Zoom avant"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          {/* Fit Screen ("Ajuster") */}
          <button
            id="btn-cm-fit"
            onClick={fitToScreen}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold transition-colors active:scale-95"
            title="Recentrer et adapter la carte"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ajuster</span>
          </button>

          {/* Reset Position */}
          <button
            id="btn-cm-reset"
            onClick={handleReset}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors active:scale-95"
            title="Disposition d'origine"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-0.5" />

          {/* Export SVG */}
          <button
            id="btn-cm-export"
            onClick={handleExportSVG}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors active:scale-95"
            title="Télécharger en format vectoriel SVG"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            id="btn-cm-fullscreen"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-800 transition-colors active:scale-95"
            title={isFullscreen ? 'Quitter plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Delete selected card - positioned at the end of top bar as requested */}
          {selectedCard && (
            <>
              <div className="h-4 w-px bg-slate-300 mx-0.5" />
              <button
                id="btn-card-delete"
                onClick={() => handleDeleteCard(selectedCard.id)}
                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors active:scale-95 animate-in fade-in zoom-in-95 duration-150"
                title="Supprimer ce bloc"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Row 2: Selected Card Action Bar - Appears on the same line just under the toolbar block, disappears when nothing is selected */}
        {selectedCard && (
          <div
            id="concept-map-selected-card-bar"
            className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border-2 border-slate-800 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150 max-w-[95vw] overflow-x-auto"
          >
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200 shrink-0">
              <span
                className="w-3.5 h-3.5 rounded-full border border-slate-900 shrink-0"
                style={{ backgroundColor: selectedCard.color }}
              />
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 max-w-[130px] sm:max-w-[200px] truncate">
                {selectedCard.pillTitle}
              </span>
            </div>

            <button
              id="btn-card-edit"
              onClick={() => startEditingCard(selectedCard)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 transition-colors shrink-0 active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Modifier</span>
            </button>

            <button
              id="btn-card-add"
              onClick={() => handleAddCard(selectedCard)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shrink-0 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>

            <button
              id="btn-card-close"
              onClick={() => setSelectedCardId(null)}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              title="Fermer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Inline Modal Editor */}
      {editingCardId && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-2 border-slate-900 p-5 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Modifier la carte conceptuelle
              </h4>
              <button
                onClick={() => setEditingCardId(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Titre du badge (Pilule)
              </label>
              <input
                type="text"
                value={editPill}
                onChange={(e) => setEditPill(e.target.value)}
                className="w-full p-2.5 rounded-xl border-2 border-slate-300 text-slate-900 text-sm font-bold uppercase tracking-wider focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Description / Texte de la carte
              </label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={4}
                className="w-full p-2.5 rounded-xl border-2 border-slate-300 text-slate-900 text-sm font-medium focus:outline-none focus:border-slate-900 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingCardId(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={saveEditingCard}
                className="inline-flex items-center gap-1 px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        ═══════════════════════════════════════════════════════════════
        MAIN SVG STAGE RENDERING:
        Matching the uploaded image "concept-map-free-google-docs-template-t.webp"
        ═══════════════════════════════════════════════════════════════
      */}
      <svg
        id="concept-map-svg-stage"
        className="w-full h-full block cursor-grab active:cursor-grabbing select-none"
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 
            1. ORTHOGONAL CONNECTING LINES (Branching Tree)
            Matching the crisp right-angle geometric lines of the reference image
          */}
          <g id="concept-map-connector-lines" stroke="#334155" strokeWidth={2} fill="none">
            {/* 1.1 Branch from Root down to Level 1 Cards */}
            {(() => {
              const level1 = cards.filter((c) => c.level === 1);
              if (level1.length === 0) return null;

              const rootBottomY = rootBox.y + rootBox.height / 2;
              const busY = rootBottomY + 46;
              const minX = Math.min(...level1.map((c) => c.x));
              const maxX = Math.max(...level1.map((c) => c.x));

              return (
                <g key="root-to-level1">
                  {/* Vertical drop from Root center */}
                  <line x1={rootBox.x} y1={rootBottomY} x2={rootBox.x} y2={busY} />
                  {/* Horizontal distribution bar */}
                  <line x1={minX} y1={busY} x2={maxX} y2={busY} />
                  {/* Vertical drops into each Level 1 card */}
                  {level1.map((card) => {
                    const pillTopY = card.y - card.height / 2 - 16;
                    return (
                      <line
                        key={`drop-lvl1-${card.id}`}
                        x1={card.x}
                        y1={busY}
                        x2={card.x}
                        y2={pillTopY}
                      />
                    );
                  })}
                </g>
              );
            })()}

            {/* 1.2 Branches from Level 1 Cards down to Level 2 Child Cards */}
            {cards
              .filter((c) => c.level === 1 && !collapsedParents[c.id])
              .map((parent) => {
                const children = (childrenMap.get(parent.id) || []).filter(isCardVisible);
                if (children.length === 0) return null;

                const parentBottomY = parent.y + parent.height / 2;
                const busY = parentBottomY + 42;
                const minChildX = Math.min(...children.map((c) => c.x));
                const maxChildX = Math.max(...children.map((c) => c.x));

                return (
                  <g key={`branch-parent-${parent.id}`}>
                    {/* Vertical drop from parent card bottom */}
                    <line x1={parent.x} y1={parentBottomY} x2={parent.x} y2={busY} />
                    {/* Horizontal distribution line across children */}
                    <line x1={minChildX} y1={busY} x2={maxChildX} y2={busY} />
                    {/* Vertical drops to each child card top pill */}
                    {children.map((child) => {
                      const childPillTopY = child.y - child.height / 2 - 16;
                      return (
                        <line
                          key={`drop-lvl2-${child.id}`}
                          x1={child.x}
                          y1={busY}
                          x2={child.x}
                          y2={childPillTopY}
                        />
                      );
                    })}
                  </g>
                );
              })}
          </g>

          {/* 
            2. ROOT NODE (CONCEPT MAP / PROJET SITE WEB SAGE-FEMME)
            - Rounded pill/box with dark 2px outline
            - Offset golden/amber solid 3D shadow (shifted +6, +6)
          */}
          <g
            id="concept-map-root-box"
            transform={`translate(${rootBox.x}, ${rootBox.y})`}
            className="cursor-pointer"
          >
            {/* Bottom-right offset solid shadow */}
            <rect
              x={-rootBox.width / 2 + 6}
              y={-rootBox.height / 2 + 6}
              width={rootBox.width}
              height={rootBox.height}
              rx={22}
              fill={activeDataset.rootColor}
              stroke="#1E293B"
              strokeWidth={2}
            />
            {/* Main white body */}
            <rect
              x={-rootBox.width / 2}
              y={-rootBox.height / 2}
              width={rootBox.width}
              height={rootBox.height}
              rx={22}
              fill="#FFFFFF"
              stroke="#1E293B"
              strokeWidth={2}
            />
            {/* Title Text */}
            <text
              textAnchor="middle"
              y={7}
              className="font-extrabold text-[21px] sm:text-[22px] tracking-wide fill-slate-800 select-none pointer-events-none"
            >
              {activeDataset.rootTitle}
            </text>
          </g>

          {/* 
            3. CONCEPT CARDS (Level 1 and Level 2)
            - Offset colored solid 3D shadow (+6px, +6px) with 2px dark border
            - White body with 2px dark border & rounded corners (rx=18)
            - Pill header sitting across top edge with 2px dark border
            - Bold uppercase text inside pill
            - Clean centered description text
          */}
          <g id="concept-map-cards-group">
            {cards.map((card) => {
              if (!isCardVisible(card)) return null;

              const isSelected = selectedCardId === card.id;
              const hasChildren = (childrenMap.get(card.id) || []).length > 0;
              const isCollapsed = collapsedParents[card.id];
              const halfW = card.width / 2;
              const halfH = card.height / 2;
              const pillHalfW = card.pillWidth / 2;

              return (
                <g
                  key={card.id}
                  id={`card-node-${card.id}`}
                  transform={`translate(${card.x}, ${card.y})`}
                  onPointerDown={(e) => handleCardPointerDown(card.id, e)}
                  onDoubleClick={() => startEditingCard(card)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedCardId(card.id);
                  }}
                  className="cursor-grab active:cursor-grabbing"
                >
                  {/* Selection Glow Indicator */}
                  {isSelected && (
                    <rect
                      x={-halfW - 6}
                      y={-halfH - 22}
                      width={card.width + 12}
                      height={card.height + 36}
                      rx={24}
                      fill="none"
                      stroke="#0F172A"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                    />
                  )}

                  {/* 3D Offset Colored Shadow (Shifted +6px, +6px) */}
                  <rect
                    x={-halfW + 6}
                    y={-halfH + 6}
                    width={card.width}
                    height={card.height}
                    rx={18}
                    fill={card.color}
                    stroke="#1E293B"
                    strokeWidth={2}
                  />

                  {/* Main White Card Body */}
                  <rect
                    x={-halfW}
                    y={-halfH}
                    width={card.width}
                    height={card.height}
                    rx={18}
                    fill="#FFFFFF"
                    stroke="#1E293B"
                    strokeWidth={2}
                  />

                  {/* Top Pill Header (Overlapping top edge) */}
                  <rect
                    x={-pillHalfW}
                    y={-halfH - 16}
                    width={card.pillWidth}
                    height={34}
                    rx={17}
                    fill={card.color}
                    stroke="#1E293B"
                    strokeWidth={2}
                  />

                  {/* Pill Title Text */}
                  <text
                    x={0}
                    y={-halfH + 5}
                    textAnchor="middle"
                    className="font-extrabold text-[11.5px] uppercase tracking-wider fill-slate-900 select-none pointer-events-none"
                  >
                    {card.pillTitle}
                  </text>

                  {/* Body Text via foreignObject */}
                  <foreignObject
                    x={-halfW + 14}
                    y={-halfH + 26}
                    width={card.width - 28}
                    height={card.height - 34}
                    className="pointer-events-none select-none"
                  >
                    <div className="w-full h-full flex items-center justify-center text-center px-1">
                      <p className="text-[12px] leading-relaxed text-slate-700 font-normal select-none">
                        {card.description}
                      </p>
                    </div>
                  </foreignObject>

                  {/* Collapse/Expand indicator for Level 1 cards with children */}
                  {hasChildren && card.level === 1 && (
                    <g
                      transform={`translate(0, ${halfH + 2})`}
                      onClick={(e) => toggleCollapse(card.id, e)}
                      className="cursor-pointer hover:scale-125 transition-transform"
                    >
                      <circle
                        r={8.5}
                        fill="#FFFFFF"
                        stroke="#1E293B"
                        strokeWidth={1.5}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        y={-0.5}
                        className="text-[11px] font-extrabold fill-slate-800 select-none pointer-events-none"
                      >
                        {isCollapsed ? '+' : '−'}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}

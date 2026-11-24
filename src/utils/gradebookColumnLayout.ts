/**
 * Moteur pur de disposition des colonnes périphériques des tableaux de notes & moyennes.
 *
 * Règle structurelle :
 * - Les colonnes centrales (NOTE 1..N + [+] sur un tableau Matière, ou les Matières / Trimestres
 *   sur une Moyenne Générale) restent toujours groupées au milieu comme un bloc indivisible.
 * - Toutes les colonnes périphériques (`rank`, `photo`, `matricule`, `name`, `total`, `average`, `mention`)
 *   peuvent être librement placées avant (gauche) ou après (droite) ce bloc central, dans n'importe quel ordre.
 * - Zéro colonne perdue, zéro doublon, rétrocompatibilité totale entre tableaux Matière (sans `total`)
 *   et tableaux Moyenne Générale Trimestrielle / Annuelle (avec `total`).
 */

export type GradebookPeripheralColumnKey =
  | 'rank'
  | 'photo'
  | 'matricule'
  | 'name'
  | 'total'
  | 'average'
  | 'mention';

export interface GradebookColumnOrder {
  left: GradebookPeripheralColumnKey[];
  right: GradebookPeripheralColumnKey[];
}

export type ColumnLayoutPresetId =
  | 'classic'
  | 'official'
  | 'admin'
  | 'synthesis_left';

export interface ColumnLayoutPreset {
  id: ColumnLayoutPresetId;
  name: string;
  description: string;
  order: GradebookColumnOrder;
}

export const SUBJECT_PERIPHERAL_KEYS: readonly GradebookPeripheralColumnKey[] = [
  'rank',
  'photo',
  'matricule',
  'name',
  'average',
  'mention',
] as const;

export const AVERAGE_PERIPHERAL_KEYS: readonly GradebookPeripheralColumnKey[] = [
  'rank',
  'photo',
  'matricule',
  'name',
  'total',
  'average',
  'mention',
] as const;

const ALL_VALID_KEYS: ReadonlySet<string> = new Set(AVERAGE_PERIPHERAL_KEYS);

export const DEFAULT_SUBJECT_COLUMN_ORDER: GradebookColumnOrder = {
  left: ['rank', 'photo', 'matricule', 'name'],
  right: ['average', 'mention'],
};

export const DEFAULT_AVERAGE_COLUMN_ORDER: GradebookColumnOrder = {
  left: ['rank', 'photo', 'matricule', 'name'],
  right: ['total', 'average', 'mention'],
};

export const GRADEBOOK_COLUMN_META: Record<
  GradebookPeripheralColumnKey,
  {
    label: string;
    shortLabel: string;
    defaultSide: 'left' | 'right';
    badgeColor: string;
  }
> = {
  rank: {
    label: 'Rang',
    shortLabel: 'Rang',
    defaultSide: 'left',
    badgeColor: 'amber',
  },
  photo: {
    label: 'Profil (Photo)',
    shortLabel: 'Profil',
    defaultSide: 'left',
    badgeColor: 'slate',
  },
  matricule: {
    label: 'Matricule',
    shortLabel: 'Matricule',
    defaultSide: 'left',
    badgeColor: 'violet',
  },
  name: {
    label: 'Nom & Prénom',
    shortLabel: 'Nom',
    defaultSide: 'left',
    badgeColor: 'blue',
  },
  total: {
    label: 'Total',
    shortLabel: 'Total',
    defaultSide: 'right',
    badgeColor: 'indigo',
  },
  average: {
    label: 'Moyenne',
    shortLabel: 'Moyenne',
    defaultSide: 'right',
    badgeColor: 'emerald',
  },
  mention: {
    label: 'Mention',
    shortLabel: 'Mention',
    defaultSide: 'right',
    badgeColor: 'teal',
  },
};

export const COLUMN_LAYOUT_PRESETS: readonly ColumnLayoutPreset[] = [
  {
    id: 'classic',
    name: 'Classique StudyCloud',
    description: 'Rang, Profil, Matricule, Nom à gauche · Moyenne, Mention à droite',
    order: {
      left: ['rank', 'photo', 'matricule', 'name'],
      right: ['total', 'average', 'mention'],
    },
  },
  {
    id: 'official',
    name: 'Relevé officiel (Rang après Moyenne)',
    description: 'Matricule, Profil, Nom à gauche · Moyenne, Rang, Mention à droite',
    order: {
      left: ['matricule', 'photo', 'name'],
      right: ['total', 'average', 'rank', 'mention'],
    },
  },
  {
    id: 'admin',
    name: 'Administratif (Rang à la fin)',
    description: 'Profil, Matricule, Nom à gauche · Moyenne, Mention, Rang tout au bout',
    order: {
      left: ['photo', 'matricule', 'name'],
      right: ['total', 'average', 'mention', 'rank'],
    },
  },
  {
    id: 'synthesis_left',
    name: 'Synthèse à gauche',
    description: 'Résultats (Rang, Nom, Moyenne, Mention) visibles immédiatement à gauche',
    order: {
      left: ['rank', 'name', 'total', 'average', 'mention'],
      right: ['photo', 'matricule'],
    },
  },
];

export function getDefaultColumnOrder(opts?: {
  includeTotal?: boolean;
}): GradebookColumnOrder {
  const base = opts?.includeTotal
    ? DEFAULT_AVERAGE_COLUMN_ORDER
    : DEFAULT_SUBJECT_COLUMN_ORDER;
  return {
    left: [...base.left],
    right: [...base.right],
  };
}

/**
 * Valide et normalise une disposition de colonnes.
 * - Retire les clés inconnues et doublons.
 * - Si `includeTotal` est true et `total` est absent (ex: réglage classe enregistré depuis une matière),
 *   insère automatiquement `total` juste devant `average` (ou au début de `right`).
 * - Réinsère toute clé requise manquante dans sa zone par défaut.
 * - Retourne `null` si `raw` est null / undefined / invalide.
 */
export function sanitizeGradebookColumnOrder(
  raw: unknown,
  opts?: { includeTotal?: boolean }
): GradebookColumnOrder | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.left) && !Array.isArray(obj.right)) return null;

  const includeTotal = Boolean(opts?.includeTotal);
  const allowedKeys = includeTotal
    ? AVERAGE_PERIPHERAL_KEYS
    : SUBJECT_PERIPHERAL_KEYS;
  const allowedSet = new Set<string>(allowedKeys);

  const seen = new Set<GradebookPeripheralColumnKey>();
  const left: GradebookPeripheralColumnKey[] = [];
  const right: GradebookPeripheralColumnKey[] = [];

  const pushUnique = (
    src: unknown,
    target: GradebookPeripheralColumnKey[]
  ) => {
    if (!Array.isArray(src)) return;
    for (const item of src) {
      if (typeof item !== 'string') continue;
      const clean = item.trim().toLowerCase() as GradebookPeripheralColumnKey;
      if (!ALL_VALID_KEYS.has(clean)) continue;
      if (!allowedSet.has(clean)) continue;
      if (seen.has(clean)) continue;
      seen.add(clean);
      target.push(clean);
    }
  };

  pushUnique(obj.left, left);
  pushUnique(obj.right, right);

  // Si aucune clé valide n'a été fournie, considérer invalide
  if (seen.size === 0) return null;

  // Compléter intelligemment les clés manquantes (notamment `total` si créé depuis un tableau Matière)
  if (includeTotal && !seen.has('total')) {
    const avgIdxRight = right.indexOf('average');
    const avgIdxLeft = left.indexOf('average');
    if (avgIdxRight >= 0) {
      right.splice(avgIdxRight, 0, 'total');
    } else if (avgIdxLeft >= 0) {
      left.splice(avgIdxLeft, 0, 'total');
    } else {
      right.unshift('total');
    }
    seen.add('total');
  }

  for (const key of allowedKeys) {
    if (!seen.has(key)) {
      const defSide = GRADEBOOK_COLUMN_META[key].defaultSide;
      if (defSide === 'left') left.push(key);
      else right.push(key);
      seen.add(key);
    }
  }

  return { left, right };
}

/**
 * Résout l'ordre effectif des colonnes selon la priorité standard StudyCloud :
 * 1. Surcharge explicite de cette feuille (`null` = réinitialisé au défaut)
 * 2. Réglage global de la classe (`classOrder`)
 * 3. Ordre par défaut StudyCloud
 */
export function resolveEffectiveColumnOrder(
  sheetOrder: GradebookColumnOrder | null | undefined,
  classOrder: GradebookColumnOrder | null | undefined,
  opts?: { includeTotal?: boolean }
): GradebookColumnOrder {
  if (sheetOrder === null) {
    return getDefaultColumnOrder(opts);
  }
  const cleanSheet = sanitizeGradebookColumnOrder(sheetOrder, opts);
  if (cleanSheet) return cleanSheet;

  const cleanClass = sanitizeGradebookColumnOrder(classOrder, opts);
  if (cleanClass) return cleanClass;

  return getDefaultColumnOrder(opts);
}

/**
 * Retourne true si la disposition correspond exactement au défaut StudyCloud.
 */
export function isDefaultColumnOrder(
  order: GradebookColumnOrder,
  opts?: { includeTotal?: boolean }
): boolean {
  const def = getDefaultColumnOrder(opts);
  const clean = sanitizeGradebookColumnOrder(order, opts) || def;
  return (
    clean.left.length === def.left.length &&
    clean.right.length === def.right.length &&
    clean.left.every((k, i) => k === def.left[i]) &&
    clean.right.every((k, i) => k === def.right[i])
  );
}

/**
 * Filtre une disposition pour obtenir uniquement les colonnes actuellement visibles
 * (masque `matricule` si `showMatricule === false`, masque `total` si `!includeTotal`).
 */
export function getVisibleColumnOrder(
  order: GradebookColumnOrder,
  opts: { showMatricule: boolean; includeTotal?: boolean }
): GradebookColumnOrder {
  const clean =
    sanitizeGradebookColumnOrder(order, { includeTotal: opts.includeTotal }) ||
    getDefaultColumnOrder({ includeTotal: opts.includeTotal });
  const keep = (k: GradebookPeripheralColumnKey) => {
    if (k === 'matricule' && !opts.showMatricule) return false;
    if (k === 'total' && !opts.includeTotal) return false;
    return true;
  };
  return {
    left: clean.left.filter(keep),
    right: clean.right.filter(keep),
  };
}

/**
 * Bascule une colonne d'un côté à l'autre du bloc central des notes.
 * - Vers 'left' : ajoutée à la fin de `left` (juste devant les notes).
 * - Vers 'right' : ajoutée au début de `right` (juste derrière les notes).
 */
export function moveColumnToSide(
  order: GradebookColumnOrder,
  key: GradebookPeripheralColumnKey,
  targetSide: 'left' | 'right',
  opts?: { includeTotal?: boolean }
): GradebookColumnOrder {
  const clean =
    sanitizeGradebookColumnOrder(order, opts) || getDefaultColumnOrder(opts);
  const left = clean.left.filter((k) => k !== key);
  const right = clean.right.filter((k) => k !== key);
  if (targetSide === 'left') {
    left.push(key);
  } else {
    right.unshift(key);
  }
  return { left, right };
}

/**
 * Déplace une colonne d'un cran vers la gauche (`up` / index - 1) ou vers la droite (`down` / index + 1)
 * à l'intérieur de sa zone (`left` ou `right`).
 */
export function moveColumnWithinSide(
  order: GradebookColumnOrder,
  key: GradebookPeripheralColumnKey,
  direction: 'up' | 'down',
  opts?: { includeTotal?: boolean }
): GradebookColumnOrder {
  const clean =
    sanitizeGradebookColumnOrder(order, opts) || getDefaultColumnOrder(opts);
  const left = [...clean.left];
  const right = [...clean.right];

  const shift = (arr: GradebookPeripheralColumnKey[]): boolean => {
    const idx = arr.indexOf(key);
    if (idx === -1) return false;
    const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= arr.length) return true;
    const tmp = arr[idx];
    arr[idx] = arr[nextIdx];
    arr[nextIdx] = tmp;
    return true;
  };

  if (!shift(left)) {
    shift(right);
  }
  return { left, right };
}

/**
 * Place une colonne relativement à une autre colonne (ou au bloc central `'notes'`).
 * Utilisé notamment par Assistant Delmas pour des instructions naturelles :
 * - "Mets le Rang derrière la Moyenne" → placeColumnRelative(order, 'rank', 'after', 'average')
 * - "Mets le Matricule devant le Nom" → placeColumnRelative(order, 'matricule', 'before', 'name')
 * - "Mets le Rang derrière les notes" → placeColumnRelative(order, 'rank', 'after', 'notes')
 */
export function placeColumnRelative(
  order: GradebookColumnOrder,
  key: GradebookPeripheralColumnKey,
  relation: 'before' | 'after' | 'start' | 'end',
  anchor?: GradebookPeripheralColumnKey | 'notes',
  opts?: { includeTotal?: boolean }
): GradebookColumnOrder {
  const clean =
    sanitizeGradebookColumnOrder(order, opts) || getDefaultColumnOrder(opts);
  const includeTotal = Boolean(opts?.includeTotal);
  if (key === 'total' && !includeTotal) return clean;

  const left = clean.left.filter((k) => k !== key);
  const right = clean.right.filter((k) => k !== key);

  if (relation === 'start') {
    left.unshift(key);
    return { left, right };
  }
  if (relation === 'end') {
    right.push(key);
    return { left, right };
  }
  if (anchor === 'notes' || !anchor) {
    if (relation === 'before') {
      left.push(key);
    } else {
      right.unshift(key);
    }
    return { left, right };
  }

  const leftIdx = left.indexOf(anchor);
  if (leftIdx >= 0) {
    left.splice(relation === 'before' ? leftIdx : leftIdx + 1, 0, key);
    return { left, right };
  }
  const rightIdx = right.indexOf(anchor);
  if (rightIdx >= 0) {
    right.splice(relation === 'before' ? rightIdx : rightIdx + 1, 0, key);
    return { left, right };
  }

  // Fallback si l'ancre n'est pas présente
  if (relation === 'before') left.push(key);
  else right.push(key);
  return { left, right };
}

/**
 * Retourne un preset adapté au type de feuille (`includeTotal`).
 */
export function getPresetColumnOrder(
  presetId: ColumnLayoutPresetId,
  opts?: { includeTotal?: boolean }
): GradebookColumnOrder {
  const preset =
    COLUMN_LAYOUT_PRESETS.find((p) => p.id === presetId) ||
    COLUMN_LAYOUT_PRESETS[0];
  return (
    sanitizeGradebookColumnOrder(preset.order, opts) ||
    getDefaultColumnOrder(opts)
  );
}

/**
 * Détecte si une disposition correspond à l'un des 4 modèles prédéfinis.
 */
export function detectMatchingPresetId(
  order: GradebookColumnOrder,
  opts?: { includeTotal?: boolean }
): ColumnLayoutPresetId | null {
  const clean =
    sanitizeGradebookColumnOrder(order, opts) || getDefaultColumnOrder(opts);
  for (const preset of COLUMN_LAYOUT_PRESETS) {
    const pOrder = getPresetColumnOrder(preset.id, opts);
    if (
      clean.left.length === pOrder.left.length &&
      clean.right.length === pOrder.right.length &&
      clean.left.every((k, i) => k === pOrder.left[i]) &&
      clean.right.every((k, i) => k === pOrder.right[i])
    ) {
      return preset.id;
    }
  }
  return null;
}

const normalizeColToken = (raw: unknown): string =>
  String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export function parsePeripheralColumnAlias(
  raw: unknown
): GradebookPeripheralColumnKey | 'notes' | null {
  const s = normalizeColToken(raw);
  if (!s) return null;
  if (s === 'rank' || s === 'rang' || s === 'classement') return 'rank';
  if (s === 'photo' || s === 'profil' || s === 'avatar') return 'photo';
  if (s === 'matricule' || s === 'mat' || s === 'id') return 'matricule';
  if (
    s === 'name' ||
    s === 'nom' ||
    s === 'prenom' ||
    s === 'nom & prenom' ||
    s === 'nom et prenom' ||
    s === 'eleve' ||
    s === 'eleves'
  ) {
    return 'name';
  }
  if (s === 'total' || s === 'total general' || s === 'total annuel') return 'total';
  if (
    s === 'average' ||
    s === 'avg' ||
    s === 'moy' ||
    s === 'moyenne' ||
    s === 'moyenne generale' ||
    s === 'moyenne annuelle'
  ) {
    return 'average';
  }
  if (s === 'mention' || s === 'appreciation') return 'mention';
  if (
    s === 'notes' ||
    s === 'note' ||
    s === 'matieres' ||
    s === 'matiere' ||
    s === 'trimestres' ||
    s === 'trimestre' ||
    s === 'centre' ||
    s === 'milieu'
  ) {
    return 'notes';
  }
  return null;
}

/**
 * Résout une action Assistant Delmas `{ type: 'set_column_order', ... }` en nouvelle disposition
 * (ou `null` pour réinitialiser par défaut, ou `undefined` si l'action est invalide).
 */
export function resolveColumnOrderFromDelmasAction(
  action: Record<string, any>,
  currentOrder: GradebookColumnOrder,
  opts?: { includeTotal?: boolean }
): GradebookColumnOrder | null | undefined {
  if (!action || typeof action !== 'object') return undefined;
  const includeTotal = Boolean(opts?.includeTotal);

  if (action.reset === true || action.default === true) {
    return null;
  }

  if (typeof action.preset === 'string' && action.preset.trim()) {
    const p = normalizeColToken(action.preset);
    let presetId: ColumnLayoutPresetId | null = null;
    if (p === 'classic' || p === 'classique' || p === 'default' || p === 'defaut') {
      return null;
    }
    if (p === 'official' || p === 'officiel' || p.includes('officiel') || p.includes('releve')) {
      presetId = 'official';
    } else if (p === 'admin' || p.includes('admin')) {
      presetId = 'admin';
    } else if (
      p === 'synthesis_left' ||
      p === 'synthesis' ||
      p.includes('synthese') ||
      p.includes('gauche')
    ) {
      presetId = 'synthesis_left';
    }
    if (presetId) {
      return getPresetColumnOrder(presetId, { includeTotal });
    }
  }

  if (Array.isArray(action.left) || Array.isArray(action.right)) {
    const mapList = (arr: unknown): GradebookPeripheralColumnKey[] =>
      Array.isArray(arr)
        ? arr
            .map((x) => parsePeripheralColumnAlias(x))
            .filter(
              (k): k is GradebookPeripheralColumnKey => k !== null && k !== 'notes'
            )
        : [];
    const cleaned = sanitizeGradebookColumnOrder(
      { left: mapList(action.left), right: mapList(action.right) },
      { includeTotal }
    );
    if (!cleaned) return undefined;
    return isDefaultColumnOrder(cleaned, { includeTotal }) ? null : cleaned;
  }

  const moveRaw = action.moveColumn ?? action.column ?? action.col;
  const moveKey = parsePeripheralColumnAlias(moveRaw);
  if (moveKey && moveKey !== 'notes') {
    if (moveKey === 'total' && !includeTotal) return undefined;
    const relRaw = normalizeColToken(action.relation ?? action.position ?? action.side ?? '');
    const anchorKey = parsePeripheralColumnAlias(
      action.anchor ?? action.target ?? action.reference ?? action.relativeTo
    );

    let nextOrder: GradebookColumnOrder;
    if (relRaw === 'left' || relRaw === 'gauche' || relRaw === 'avant_notes') {
      nextOrder = moveColumnToSide(currentOrder, moveKey, 'left', { includeTotal });
    } else if (relRaw === 'right' || relRaw === 'droite' || relRaw === 'apres_notes') {
      nextOrder = moveColumnToSide(currentOrder, moveKey, 'right', { includeTotal });
    } else if (
      relRaw === 'start' ||
      relRaw === 'debut' ||
      relRaw === 'first' ||
      relRaw === 'premier'
    ) {
      nextOrder = placeColumnRelative(currentOrder, moveKey, 'start', undefined, {
        includeTotal,
      });
    } else if (
      relRaw === 'end' ||
      relRaw === 'fin' ||
      relRaw === 'last' ||
      relRaw === 'dernier'
    ) {
      nextOrder = placeColumnRelative(currentOrder, moveKey, 'end', undefined, {
        includeTotal,
      });
    } else if (
      relRaw === 'before' ||
      relRaw === 'avant' ||
      relRaw === 'devant'
    ) {
      nextOrder = placeColumnRelative(
        currentOrder,
        moveKey,
        'before',
        anchorKey || 'notes',
        { includeTotal }
      );
    } else {
      // 'after' | 'apres' | 'derriere' (défaut le plus fréquent)
      nextOrder = placeColumnRelative(
        currentOrder,
        moveKey,
        'after',
        anchorKey || 'notes',
        { includeTotal }
      );
    }
    return isDefaultColumnOrder(nextOrder, { includeTotal }) ? null : nextOrder;
  }

  return undefined;
}

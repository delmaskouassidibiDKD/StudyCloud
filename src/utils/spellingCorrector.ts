/**
 * Module de correction orthographique et de normalisation intelligente
 * pour les catégories, titres, matières et descriptions de StudyCloud.
 */

// Dictionnaire de correction des fautes courantes et typos fréquentes (contexte académique & général)
export const SPELLING_DICTIONARY: Record<string, string> = {
  // Fautes sur les types de documents et évaluations
  DEVOIRE: 'DEVOIR',
  DEVOIRES: 'DEVOIRS',
  DEVOIR: 'DEVOIR',
  DEVOIRS: 'DEVOIRS',
  COUR: 'COURS',
  COURS: 'COURS',
  COURE: 'COURS',
  COURES: 'COURS',
  EXAM: 'EXAMEN',
  EXAMS: 'EXAMENS',
  EXAMAN: 'EXAMEN',
  EXAMANS: 'EXAMENS',
  EXAMAIN: 'EXAMEN',
  EXAMAINS: 'EXAMENS',
  EXAMEN: 'EXAMEN',
  EXAMENS: 'EXAMENS',
  EPREUV: 'ÉPREUVE',
  EPREUVES: 'ÉPREUVES',
  EPREUVE: 'ÉPREUVE',
  CONTROLE: 'CONTRÔLE',
  CONTROLES: 'CONTRÔLES',
  INTERRO: 'INTERROGATION',
  INTERROS: 'INTERROGATIONS',
  INTERROGATION: 'INTERROGATION',
  INTERROGATIONS: 'INTERROGATIONS',
  RESUME: 'RÉSUMÉ',
  RESUMES: 'RÉSUMÉS',
  SYNTHESE: 'SYNTHÈSE',
  SYNTHESES: 'SYNTHÈSES',
  RECAP: 'RÉCAPITULATIF',
  RECAPITULATIF: 'RÉCAPITULATIF',
  MEMOIRE: 'MÉMOIRE',
  MEMOIRES: 'MÉMOIRES',
  THESE: 'THÈSE',
  THESES: 'THÈSES',
  RAPORT: 'RAPPORT',
  RAPORTS: 'RAPPORTS',
  RAPPORT: 'RAPPORT',
  RAPPORTS: 'RAPPORTS',
  FICHE: 'FICHE',
  FICHES: 'FICHES',
  ANNALE: 'ANNALE',
  ANNALES: 'ANNALES',
  PROJET: 'PROJET',
  PROJETS: 'PROJETS',

  // Fautes sur les matières scolaires et universitaires
  MATH: 'MATHÉMATIQUES',
  MATHS: 'MATHÉMATIQUES',
  MATHEMATIQUE: 'MATHÉMATIQUES',
  MATHEMATIQUES: 'MATHÉMATIQUES',
  MATHEMETIQUE: 'MATHÉMATIQUES',
  MATHEMETIQUES: 'MATHÉMATIQUES',
  PHYSIQ: 'PHYSIQUE',
  PHYSIQUE: 'PHYSIQUE',
  PHYSIQUES: 'PHYSIQUE',
  CHIMI: 'CHIMIE',
  CHIMIE: 'CHIMIE',
  ELECTROTECNIQUE: 'ÉLECTROTECHNIQUE',
  ELECTROTECHNIQUE: 'ÉLECTROTECHNIQUE',
  ELECTRONIQ: 'ÉLECTRONIQUE',
  ELECTRONIQUE: 'ÉLECTRONIQUE',
  INFORMATIQ: 'INFORMATIQUE',
  INFORMATIQUE: 'INFORMATIQUE',
  FRANCAIS: 'FRANÇAIS',
  ANGLAI: 'ANGLAIS',
  ANGLAIS: 'ANGLAIS',
  HISTOIR: 'HISTOIRE',
  HISTOIRE: 'HISTOIRE',
  GEOGRAPHI: 'GÉOGRAPHIE',
  GEOGRAPHIE: 'GÉOGRAPHIE',
  PHILOSOPHI: 'PHILOSOPHIE',
  PHILOSOPHIE: 'PHILOSOPHIE',
  LITTERATUR: 'LITTÉRATURE',
  LITTERATURE: 'LITTÉRATURE',
  MECANIQ: 'MÉCANIQUE',
  MECANIQUE: 'MÉCANIQUE',
  THERMODYNAMIQ: 'THERMODYNAMIQUE',
  THERMODYNAMIQUE: 'THERMODYNAMIQUE',
  COMPTABILITE: 'COMPTABILITÉ',
  COMPTABILITÉ: 'COMPTABILITÉ',
  ECONOMI: 'ÉCONOMIE',
  ECONOMIE: 'ÉCONOMIE',
  GESTION: 'GESTION',
  DROIT: 'DROIT',
  BIOLOGI: 'BIOLOGIE',
  BIOLOGIE: 'BIOLOGIE',
  GEOLOGI: 'GÉOLOGIE',
  GEOLOGIE: 'GÉOLOGIE',
  STATISTIQ: 'STATISTIQUES',
  STATISTIQUE: 'STATISTIQUES',
  STATISTIQUES: 'STATISTIQUES',
  PROBABILITE: 'PROBABILITÉS',
  PROBABILITES: 'PROBABILITÉS',
  PROBABILITÉ: 'PROBABILITÉS',
  PROBABILITÉS: 'PROBABILITÉS',
  ALGEBRE: 'ALGÈBRE',
  GEOMETRIE: 'GÉOMÉTRIE',
  OPTIQ: 'OPTIQUE',
  OPTIQUE: 'OPTIQUE',
  ALGORITHMIQ: 'ALGORITHMIQUE',
  ALGORITHMIQUE: 'ALGORITHMIQUE',
};

/**
 * Corrige les fautes d'orthographe dans un texte ou une phrase.
 * Remplace les mots mal orthographiés par leur forme correcte tout en respectant les majuscules.
 */
export function correctSpellingInText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // Remplacement mot par mot avec les expressions régulières
  return trimmed.replace(/\b[A-Za-zÀ-ÿ0-9_/-]+\b/g, (word) => {
    const upperWord = word
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // enlever accents temporairement pour la clé de recherche

    // 1. Chercher dans le dictionnaire direct (avec ou sans accents)
    if (SPELLING_DICTIONARY[word.toUpperCase()]) {
      return SPELLING_DICTIONARY[word.toUpperCase()];
    }
    if (SPELLING_DICTIONARY[upperWord]) {
      return SPELLING_DICTIONARY[upperWord];
    }

    // 2. Règle générale : corriger les terminaisons erronées
    // ex: mots se terminant par 'OIRE' qui devraient être 'OIR' (comme DEVOIRE -> DEVOIR)
    if (upperWord === 'DEVOIRE') return 'DEVOIR';
    if (upperWord === 'DEVOIRES') return 'DEVOIRS';

    return word.toUpperCase();
  });
}

/**
 * Normalise et pluralise systématiquement une catégorie selon la règle de l'utilisateur :
 * "si on écrit un catégories et que on met s a la fin et un autre sans s
 *  les deux sont considérés la même chose et celui qui possède le s s'affiche"
 */
export function canonicalizeCategory(rawCategory: string): string {
  if (!rawCategory || typeof rawCategory !== 'string') return '';
  let clean = rawCategory.trim().toUpperCase();
  if (!clean || clean === "PAS D'INFORMATIONS" || clean === "NULL" || clean === "UNDEFINED") {
    return '';
  }

  // 1. Nettoyer les ponctuations superflues en début/fin
  clean = clean.replace(/^[#\-_\.\s]+|[#\-_\.\s]+$/g, '');

  // 2. Vérifier les abréviations et cas fixes
  if (clean === 'TD' || clean === 'TDS' || clean === 'TRAVAUX DIRIGÉS' || clean === 'TRAVAUX DIRIGES') return 'TD';
  if (clean === 'TP' || clean === 'TPS' || clean === 'TRAVAUX PRATIQUES') return 'TP';
  if (clean === 'TD/TP' || clean === 'TP/TD' || clean === 'TD-TP' || clean === 'TP-TD') return 'TD/TP';
  if (clean === 'BAC' || clean === 'BTS' || clean === 'DUT' || clean === 'LICENCE' || clean === 'MASTER') return clean;

  // 3. Corriger les fautes de frappe (ex: DEVOIRE -> DEVOIR, COUR -> COURS)
  const corrected = correctSpellingInText(clean);
  clean = corrected || clean;

  // 4. Règles spécifiques de pluralisation canonique pour les catégories :
  // Si le mot est "COUR" ou "COURS" -> "COURS"
  if (clean === 'COUR' || clean === 'COURS' || clean === 'COURE' || clean === 'COURES') {
    return 'COURS';
  }

  // Si le mot est "DEVOIR" ou "DEVOIRS" ou "DEVOIRE" -> "DEVOIRS"
  if (clean === 'DEVOIR' || clean === 'DEVOIRS' || clean === 'DEVOIRE' || clean === 'DEVOIRES') {
    return 'DEVOIRS';
  }

  // Si le mot est "EXAMEN" ou "EXAMENS" ou "EXAM" -> "EXAMENS"
  if (clean === 'EXAMEN' || clean === 'EXAMENS' || clean === 'EXAM' || clean === 'EXAMS') {
    return 'EXAMENS';
  }

  // Si le mot est "RÉSUMÉ" ou "RESUME" ou "RESUMES" -> "RÉSUMÉS"
  if (clean === 'RESUME' || clean === 'RESUMES' || clean === 'RÉSUMÉ' || clean === 'RÉSUMÉS') {
    return 'RÉSUMÉS';
  }

  // Si le mot est "PROJET" ou "PROJETS" -> "PROJETS"
  if (clean === 'PROJET' || clean === 'PROJETS') {
    return 'PROJETS';
  }

  // Si le mot est "NOTE" ou "NOTES" -> "NOTES"
  if (clean === 'NOTE' || clean === 'NOTES') {
    return 'NOTES';
  }

  // Si le mot est "FICHE" ou "FICHES" -> "FICHES"
  if (clean === 'FICHE' || clean === 'FICHES') {
    return 'FICHES';
  }

  // Si le mot est "ANNALE" ou "ANNALES" -> "ANNALES"
  if (clean === 'ANNALE' || clean === 'ANNALES') {
    return 'ANNALES';
  }

  // Règle générale : Si le mot ne se termine pas par 'S' et a au moins 4 lettres,
  // et n'est pas un acronyme tout en majuscules court (comme BTS, BTP), on lui ajoute un 'S'
  if (!clean.endsWith('S') && clean.length >= 4) {
    return clean + 'S';
  }

  return clean;
}

/**
 * Extrait la racine de comparaison (sans S final) pour regrouper deux variantes.
 * Ex: "COURS" et "COUR" ont la même racine "COUR".
 */
export function getCategoryRootKey(cat: string): string {
  const canonical = canonicalizeCategory(cat);
  if (!canonical) return '';
  if (canonical === 'TD' || canonical === 'TP' || canonical === 'TD/TP') return canonical;
  // Enlever le S final pour comparaison racine
  return canonical.replace(/S$/, '');
}

/**
 * Vérifie si une catégorie de document correspond à la catégorie sélectionnée par l'utilisateur.
 * Gère le singulier, le pluriel avec 'S', les fautes et la casse.
 */
export function isCategoryMatch(docCategory: string | undefined | null, targetCategory: string): boolean {
  if (!targetCategory || targetCategory === 'Tous') return true;
  if (!docCategory) return false;

  const targetCanon = canonicalizeCategory(targetCategory);
  const docCanon = canonicalizeCategory(docCategory);
  if (!targetCanon || !docCanon) return false;

  if (targetCanon === docCanon) return true;

  // Comparaison par racine (sans 'S')
  const targetRoot = getCategoryRootKey(targetCategory);
  const docRoot = getCategoryRootKey(docCategory);
  if (targetRoot && docRoot && targetRoot === docRoot) return true;

  // Comparaison brute en minuscule
  const dLow = docCategory.trim().toLowerCase();
  const tLow = targetCategory.trim().toLowerCase();
  if (dLow === tLow) return true;
  if (dLow.replace(/s$/, '') === tLow.replace(/s$/, '')) return true;

  return false;
}

/**
 * Pseudo-random hash déterministe par graine (seed) pour mélanger les catégories à chaque rechargement.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Algorithme de recommandation et de tri des catégories pour l'utilisateur :
 * 1. Déduplication stricte : aucun doublon n'apparaît deux fois.
 * 2. Pluralisation avec 'S' : la version avec 'S' est retenue.
 * 3. Affichage en fonction de l'utilisateur (filière, école, matières, interactions).
 * 4. Mélange dynamique au rechargement de page pour varier les premières catégories.
 */
export function rankAndShuffleCategories(
  rawCategories: string[],
  userProfile: {
    school?: string;
    filiere?: string;
    country?: string;
    matieres?: string[];
  } = {},
  publishedDocs: any[] = [],
  seed: string = ''
): string[] {
  // 1. Déduplication par racine et normalisation avec 'S'
  const rootMap = new Map<string, { label: string; count: number; userMatchScore: number }>();

  const uSchool = (userProfile.school || '').toLowerCase().trim();
  const uFiliere = (userProfile.filiere || '').toLowerCase().trim();
  const uCountry = (userProfile.country || '').toLowerCase().trim();
  const uMatieres = (userProfile.matieres || []).map(m => (m || '').toLowerCase().trim()).filter(Boolean);

  rawCategories.forEach(raw => {
    const canonical = canonicalizeCategory(raw);
    if (!canonical) return;
    const root = getCategoryRootKey(canonical);
    if (!root) return;

    if (!rootMap.has(root)) {
      rootMap.set(root, { label: canonical, count: 0, userMatchScore: 0 });
    } else {
      // Si la nouvelle étiquette a un 'S' ou est plus longue, on privilégie celle avec 'S'
      const existing = rootMap.get(root)!;
      if (canonical.endsWith('S') && !existing.label.endsWith('S')) {
        existing.label = canonical;
      }
    }
  });

  // 2. Calcul du score d'affinité utilisateur pour chaque catégorie à partir des documents publiés
  publishedDocs.forEach(doc => {
    const docCat = doc.category || '';
    const canonical = canonicalizeCategory(docCat);
    if (!canonical) return;
    const root = getCategoryRootKey(canonical);
    if (!root || !rootMap.has(root)) return;

    const entry = rootMap.get(root)!;
    entry.count += 1;

    let matchScore = 5; // Base pour chaque document dans cette catégorie

    const dFiliere = (doc.filiere || '').toLowerCase().trim();
    const dSchool = (doc.school || '').toLowerCase().trim();
    const dMatiere = (doc.matiere_name || '').toLowerCase().trim();
    const dCountry = (doc.country || '').toLowerCase().trim();

    if (uFiliere && dFiliere && (dFiliere.includes(uFiliere) || uFiliere.includes(dFiliere))) {
      matchScore += 30;
    }
    if (uSchool && dSchool && (dSchool.includes(uSchool) || uSchool.includes(dSchool))) {
      matchScore += 25;
    }
    if (uMatieres.some(m => m && (dMatiere.includes(m) || m.includes(dMatiere)))) {
      matchScore += 20;
    }
    if (uCountry && dCountry && (dCountry.includes(uCountry) || uCountry.includes(dCountry))) {
      matchScore += 10;
    }

    entry.userMatchScore += matchScore;
  });

  // 3. Application du mélange dynamique par rechargement (seed)
  // Permet à différentes catégories pertinentes de venir en premier à chaque chargement de page
  const activeSeed = seed || Date.now().toString(36);
  const scoredList = Array.from(rootMap.values()).map(item => {
    // Calcul d'une variance pseudo-aléatoire basée sur le nom de la catégorie et la graine de rechargement
    const hash = hashString(`${item.label}_${activeSeed}`);
    const shuffleBonus = (hash % 50); // bonus aléatoire de 0 à 49

    const totalScore = item.userMatchScore + (item.count * 3) + shuffleBonus;
    return {
      label: item.label,
      score: totalScore,
    };
  });

  // 4. Trier par score décroissant
  scoredList.sort((a, b) => b.score - a.score);

  // 5. Retourner la liste des labels uniques sans doublons
  return scoredList.map(item => item.label);
}

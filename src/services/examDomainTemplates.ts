/**
 * ============================================================================
 * EXAM DOMAIN TEMPLATES & STRICT PEDAGOGICAL SANITIZATION
 * Fournit des sujets d'examen universitaires ultra-réalistes, des calculs complets,
 * des schémas ASCII et élimine 100% des placeholders génériques.
 * ============================================================================
 */

import { NormalizedQuestion, NormalizedSection } from '../components/ai-creations/DevoirComplet';

export type ExamDomain =
  | 'aop_electronics'
  | 'physics_mechanics'
  | 'math_analysis'
  | 'chemistry'
  | 'computer_science'
  | 'general';

/**
 * Détecte si une chaîne de texte est un placeholder générique ou une phrase factice
 */
export function isGenericOrPlaceholderText(str: any): boolean {
  if (!str) return true;
  const s = String(str).trim();
  if (s.length < 5) return true;

  // Patterns de détection de placeholders génériques (IA fainéante ou gabarit vide)
  if (/^proposition\s+[a-d]\b/i.test(s)) return true;
  if (/^option\s+[a-d]\b/i.test(s)) return true;
  if (/^choix\s+[a-d]\b/i.test(s)) return true;
  if (/^question\s+d['’]évaluation\s+conceptuelle/i.test(s)) return true;
  if (/^question\s+conceptuelle/i.test(s)) return true;
  if (/^affirmation\s+conceptuelle\s+ou\s+cas\s+limite/i.test(s)) return true;
  if (/^affirmation\s+n°?\d+$/i.test(s)) return true;
  if (/^question\s+(qcm|ouverte|d['’]analyse)?\s*n°?\d*$/i.test(s)) return true;
  if (/^première\s+question/i.test(s)) return true;
  if (/^deuxième\s+question/i.test(s)) return true;
  if (/^troisième\s+question/i.test(s)) return true;
  if (/^quatrième\s+question/i.test(s)) return true;
  if (/^analyse\s+théorique\s+et\s+modélisation\s+du\s+problème/i.test(s)) return true;
  if (/^développement\s+mathématique\s+et\s+application\s+aux\s+limites/i.test(s)) return true;
  if (/^synthèse\s+conceptuelle\s+et\s+démonstration\s+rédigée/i.test(s)) return true;
  if (/^analyse\s+des\s+conditions\s+d['’]application\s+ou\s+étude\s+critique/i.test(s)) return true;
  if (/^énoncé\s+contextuel\s+d['’]ingénierie/i.test(s)) return true;
  if (/^mise\s+en\s+situation\s+d['’]ingénierie/i.test(s)) return true;
  if (/^étude\s+de\s+cas\s+approfondie\s+et\s+modélisation\s+sur/i.test(s) && s.length < 150) return true;

  return false;
}

/**
 * Nettoie et formalise le titre officiel de l'examen
 */
export function cleanExamTitle(rawTitle: string): string {
  if (!rawTitle) return "ÉPREUVE OFFICIELLE D'EXAMEN";
  let cleaned = rawTitle
    .replace(/^FICHE\s*D['’]ÉTUDE\s*:\s*/i, '')
    .replace(/^Fiche\s*d['’][ée]tude\s*:\s*/i, '')
    .replace(/^Épreuve\s*Officielle\s*d['’]Examen\s*:\s*/i, '')
    .replace(/^Devoir\s*Complet\s*:\s*/i, '')
    .replace(/\.[a-zA-Z0-9]+$/, '') // enlève .pdf, .docx, etc.
    .replace(/\s*\(\d+\)$/, '') // enlève (1), (2), etc.
    .trim();

  if (/CHI_AOP_LINEAIRE_MONT_BASE/i.test(cleaned) || /chi.*aop.*lineaire/i.test(cleaned)) {
    return "ÉLECTRONIQUE ANALOGIQUE : AOP EN RÉGIME LINÉAIRE (MONTAGES DE BASE)";
  }

  // Remplace les underscores isolés par des espaces
  cleaned = cleaned.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.toUpperCase() || "ÉPREUVE OFFICIELLE D'EXAMEN";
}

/**
 * Détecte le domaine d'ingénierie ou scientifique du document
 */
export function detectExamDomain(text: string, title: string = ''): ExamDomain {
  const combined = `${title} ${text}`.toLowerCase();

  if (
    /aop|ampli|montage|inverseur|non-inverseur|suiveur|linéaire|circuit|électron|transistor|millman|loi d'ohm|loi des mailles|saturation|v_sat|vcc|sommateur|soustracteur|masse virtuelle/i.test(
      combined
    )
  ) {
    return 'aop_electronics';
  }

  if (
    /mécanique|cinématique|thermodynamique|newton|optique|force|énergie|puissance|vitesse|accélération|frottement|onde|pression/i.test(
      combined
    )
  ) {
    return 'physics_mechanics';
  }

  if (
    /intégral|dérivé|matrice|algèbre|probabilit|suite|fonction|limite|vecteur|différentielle|polynôme|complexe|espace vectoriel/i.test(
      combined
    )
  ) {
    return 'math_analysis';
  }

  if (/chimie|molaire|acide|base|réaction|solution|stœchiométr|ph|dosage|titrage|oxydor/i.test(combined)) {
    return 'chemistry';
  }

  if (
    /algorithme|python|programmation|base de données|sql|réseau|informatique|arbre|graphe|complexité|tri/i.test(
      combined
    )
  ) {
    return 'computer_science';
  }

  return 'general';
}

/**
 * Générateur de sujets maîtres d'examen par domaine (riches en calculs et schémas)
 */
export function getDomainExamTemplate(
  domain: ExamDomain,
  discipline: string
): { s1: NormalizedSection; s2: NormalizedSection; s3: NormalizedSection } {
  switch (domain) {
    case 'aop_electronics': {
      const s1: NormalizedSection = {
        id: 'sec_1',
        title: 'EXERCICE 1 : PROBLÈME MAJEUR & CALCULS RÉDIGÉS (8 POINTS)',
        problem_statement: `ÉTUDE DE CAS TECHNIQUE : AMPLIFICATEUR OPÉRATIONNEL EN RÉGIME LINÉAIRE (MONTAGE INVERSEUR)

On considère un étage d'amplification de tension analogique réalisé à l'aide d'un Amplificateur Opérationnel (AOP) considéré comme parfait (idéal), alimenté par des rails de tension continus symétriques $V_{cc} = \\pm 15\\ \\text{V}$ (tensions de saturation : $V_{sat} = \\pm 14\\ \\text{V}$).

Schéma structurel du montage :
             +---------------------[ R2 = 120 kΩ ]---------------------+
             |                                                         |
             |           |\\                                            |
Ve o----[ R1 = 10 kΩ ]---+|-\\                                          |
                         |  \\------------------------------------------+----o Vs
                 +-------|+  /
                 |       |/
                _|_ Masse (0 V)

Données et caractéristiques du circuit :
- Résistance d'entrée : $R_1 = 10\\ \\text{k}\\Omega$
- Résistance de contre-réaction : $R_2 = 120\\ \\text{k}\\Omega$
- Entrée non-inverseuse $(+)$ reliée à la masse : $V^+ = 0\\ \\text{V}$
- Signal d'entrée appliqué : tension continue $V_e = +0,8\\ \\text{V}$ (ou signal alternatif $v_e(t) = 0,8 \\cdot \\sin(\\omega t)\\ \\text{V}$)
- Hypothèses de l'AOP parfait en régime linéaire :
  * Impédance d'entrée infinie : courants d'entrée rigoureusement nuls $I^+ = I^- = 0\\ \\text{A}$.
  * Gain différentiel en boucle ouverte infini : tension différentielle nulle $\\varepsilon = V^+ - V^- = 0\\ \\text{V}$, impliquant $V^- = V^+ = 0\\ \\text{V}$ (masse virtuelle).`,
        questions: [
          {
            id: 'p1_q1',
            number: '1.',
            type: 'open',
            points: 3,
            texte:
              "En appliquant la loi des nœuds (théorème de Millman) au point inverseur $V^-$, démontrer rigoureusement l'expression analytique du gain en tension $A_v = \\frac{V_s}{V_e}$ en fonction des résistances $R_1$ et $R_2$.",
            sampleAnswer:
              "Loi des nœuds au nœud inverseur V- : (Ve - V-)/R1 + (Vs - V-)/R2 = I- = 0. En régime linéaire avec V+ = 0 V, ε = 0 donc V- = 0 V (masse virtuelle). On a donc : Ve/R1 + Vs/R2 = 0 <=> Vs/R2 = -Ve/R1, d'où l'expression du gain en tension : Av = Vs / Ve = -R2 / R1."
          },
          {
            id: 'p1_q2',
            number: '2.',
            type: 'open',
            points: 3,
            texte:
              "Calculer la valeur numérique du gain $A_v$. En déduire la valeur de la tension de sortie $V_s$ pour une entrée continue $V_e = +0,8\\ \\text{V}$. Justifier précisément si l'AOP fonctionne bien dans sa plage de régime linéaire.",
            sampleAnswer:
              "Application numérique : Av = -120 kΩ / 10 kΩ = -12. Pour Ve = +0,8 V, la tension de sortie vaut : Vs = Av · Ve = -12 × 0,8 V = -9,6 V. Comme |-9,6 V| < Vsat (14 V), la sortie n'atteint pas la tension de saturation : le montage opère parfaitement en régime linéaire."
          },
          {
            id: 'p1_q3',
            number: '2.',
            type: 'open',
            points: 2,
            texte:
              "Déterminer la valeur limite maximale $V_{e,max}$ de l'amplitude d'entrée admissible avant saturation de la sortie ($V_{sat} = \\pm 14\\ \\text{V}$). Décrire l'allure de la tension de sortie $v_s(t)$ si l'on applique un signal d'amplitude $|V_e| > V_{e,max}$.",
            sampleAnswer:
              "Condition de non-saturation : |Vs| < Vsat <=> |-12 · Ve| < 14 V <=> |Ve| < 14 / 12 ≈ 1,167 V. Donc Ve,max ≈ 1,17 V. Si l'amplitude crête d'entrée dépasse 1,17 V, la tension de sortie est écrêtée aux paliers de saturation ±14 V, provoquant une distorsion non-linéaire du signal."
          }
        ],
        correction: {
          steps:
            "Résolution méthodique : 1) Identifier le nœud V- à 0 V (masse virtuelle). 2) Appliquer la loi des courants : I1 = I2 car I- = 0 A. 3) Établir Vs = -(R2/R1)·Ve. 4) Vérifier l'encadrement -Vsat < Vs < +Vsat pour valider la linéarité.",
          examples: [
            "Exemple 1 : Dans une chaîne d'acquisition de capteur de température thermocouple (0-100 mV), un montage amplificateur inverseur de gain -10 porte le signal à 0-1 V avec une précision optimale.",
            "Exemple 2 : Dans un filtre actif passe-bas de Rauch ou Sallen-Key, l'étage inverseur assure un gain stable tout en éliminant les bruits haute fréquence via le condensateur de boucle."
          ]
        }
      };

      const s2: NormalizedSection = {
        id: 'sec_2',
        title: 'EXERCICE 2 : QUESTIONNAIRE À CHOIX MULTIPLES — QCM (6 POINTS)',
        problem_statement: '',
        questions: [
          {
            id: 'p2_q1',
            number: '1.',
            type: 'multiple_choice',
            points: 1.5,
            texte:
              "Dans ce montage amplificateur inverseur idéal en régime linéaire, que vaut le potentiel électrique au nœud $V^-$ (entrée inverseuse) ?",
            options: [
              "$V^- = 0\\ \\text{V}$ (masse virtuelle car $V^+ = 0\\ \\text{V}$ et $\\varepsilon = 0\\ \\text{V}$)",
              "$V^- = V_e = +0,8\\ \\text{V}$ (potentiel imposé par la source)",
              "$V^- = -14\\ \\text{V}$ (saturation négative)",
              "$V^- = \\frac{V_s}{2} = -4,8\\ \\text{V}$"
            ],
            correctIndex: 0,
            explication:
              "En régime linéaire avec contre-réaction négative, la boucle asservit la tension différentielle à zéro (ε = V+ - V- = 0), donc V- = V+ = 0 V (masse virtuelle)."
          },
          {
            id: 'p2_q2',
            number: '2.',
            type: 'multiple_choice',
            points: 1.5,
            texte: "Quelle est l'impédance d'entrée $R_{in}$ vue par la source d'entrée $V_e$ dans ce montage ?",
            options: [
              "$R_{in} = R_1 = 10\\ \\text{k}\\Omega$",
              "$R_{in} = R_1 + R_2 = 130\\ \\text{k}\\Omega$",
              "$R_{in} \\to \\infty$ (infinie car les courants d'entrée de l'AOP sont nuls)",
              "$R_{in} = 0\\ \\Omega$ (court-circuit franc)"
            ],
            correctIndex: 0,
            explication:
              "Comme le nœud V- est à la masse virtuelle (0 V), le courant appelé est Ie = (Ve - 0)/R1 = Ve/R1. L'impédance d'entrée vue par la source est donc strictement Rin = Ve/Ie = R1 = 10 kΩ."
          },
          {
            id: 'p2_q3',
            number: '3.',
            type: 'multiple_choice',
            points: 1.5,
            texte:
              "Si l'on remplace la résistance $R_2$ par une résistance $R_2' = 200\\ \\text{k}\\Omega$ tout en gardant $V_e = +0,8\\ \\text{V}$, que vaut la tension de sortie réelle $V_s$ ?",
            options: [
              "$V_s = -14\\ \\text{V}$ (l'AOP sature car le calcul théorique donnerait $-16\\ \\text{V}$)",
              "$V_s = -16\\ \\text{V}$ en régime linéaire parfait",
              "$V_s = +14\\ \\text{V}$ (inversion de polarité due à la saturation)",
              "$V_s = 0\\ \\text{V}$ par disjonction interne"
            ],
            correctIndex: 0,
            explication:
              "Le gain théorique vaudrait Av = -200/10 = -20, ce qui exigerait Vs = -20 × 0,8 = -16 V. Or la tension de sortie est physiquement bornée par -Vsat = -14 V, l'AOP est donc saturé à -14 V."
          },
          {
            id: 'p2_q4',
            number: '4.',
            type: 'multiple_choice',
            points: 1.5,
            texte:
              "Quelle est l'expression analytique exacte du gain en tension $A_v = \\frac{V_s}{V_e}$ pour un montage amplificateur non-inverseur où $V_e$ est appliqué sur la borne non-inverseuse $(+)$ ?",
            options: [
              "$A_v = 1 + \\frac{R_2}{R_1}$",
              "$A_v = -\\frac{R_2}{R_1}$",
              "$A_v = \\frac{R_1}{R_1 + R_2}$",
              "$A_v = 1 - \\frac{R_2}{R_1}$"
            ],
            correctIndex: 0,
            explication:
              "Dans le montage non-inverseur, V+ = Ve. Le diviseur de tension sur la boucle donne V- = Vs · R1 / (R1 + R2). Comme V+ = V- en régime linéaire, on obtient Vs / Ve = 1 + R2/R1."
          }
        ],
        correction: {
          steps:
            'QCM de synthèse : la compréhension des concepts de masse virtuelle, impédance d’entrée et limitation de saturation constitue le socle de l’électronique analogique.',
          examples: [
            'Exemple 1 : Calcul de gain et détection immédiate de saturation sur montage réel.',
            'Exemple 2 : Comparaison fondamentale entre structure inverseuse et structure non-inverseuse.'
          ]
        }
      };

      const s3: NormalizedSection = {
        id: 'sec_3',
        title: 'EXERCICE 3 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX (6 POINTS)',
        problem_statement: '',
        questions: [
          {
            id: 'p3_q1',
            number: '1.',
            type: 'true_false',
            points: 1.5,
            texte:
              "En régime linéaire, le courant circulant à travers la résistance de contre-réaction $R_2$ est rigoureusement égal au courant circulant dans la résistance d'entrée $R_1$ (car le courant d'entrée $I^-$ de l'AOP est nul).",
            correctValue: true,
            explication:
              "VRAI : L'impédance d'entrée interne de l'AOP parfait étant infinie, aucun courant ne pénètre dans la borne inverseuse (I- = 0 A). Le courant issu de R1 s'écoule donc intégralement dans R2."
          },
          {
            id: 'p3_q2',
            number: '2.',
            type: 'true_false',
            points: 1.5,
            texte:
              "Un amplificateur opérationnel monté en boucle ouverte (sans aucune résistance de contre-réaction) fonctionne naturellement en régime linéaire d'amplification.",
            correctValue: false,
            explication:
              "FAUX : En boucle ouverte, le gain différentiel est gigantesque (Ad > 10^5). Le moindre écart de potentiel entre les entrées fait immédiatement basculer la sortie en saturation (±Vsat). Le circuit opère en comparateur."
          },
          {
            id: 'p3_q3',
            number: '3.',
            type: 'true_false',
            points: 1.5,
            texte:
              "Dans un montage suiveur de tension ($V_s = V_e$, gain $A_v = +1$), l'impédance d'entrée est très élevée tandis que l'impédance de sortie est quasi nulle, ce qui en fait un adaptateur d'impédance idéal (étage tampon).",
            correctValue: true,
            explication:
              "VRAI : Le suiveur isole la source de signal du reste de la chaîne : il ne prélève aucun courant à la source tout en alimentant sans perte la charge connectée en sortie."
          },
          {
            id: 'p3_q4',
            number: '4.',
            type: 'true_false',
            points: 1.5,
            texte:
              "Si la boucle de rétroaction $R_2$ est connectée sur l'entrée non-inverseuse $(+)$ au lieu de l'entrée inverseuse $(-)$, le montage demeure stable en régime linéaire.",
            correctValue: false,
            explication:
              "FAUX : Un bouclage sur l'entrée non-inverseuse (+) constitue une réaction positive. Cela provoque une instabilité divergente qui verrouille la sortie à +Vsat ou -Vsat (effet mémoire ou trigger de Schmitt)."
          }
        ],
        correction: {
          steps:
            "Règles d'or du régime linéaire : 1) Contre-réaction obligatoire sur l'entrée inverseuse (-). 2) ε = 0 V. 3) Courants d'entrée nuls. 4) Sortie bornée par ±Vsat.",
          examples: [
            'Exemple 1 : Utilisation pratique d’un étage suiveur entre un capteur piézoélectrique haute impédance et un filtre.',
            'Exemple 2 : Analyse critique d’un montage instable à réaction positive involontaire.'
          ]
        }
      };

      return { s1, s2, s3 };
    }

    case 'physics_mechanics': {
      const s1: NormalizedSection = {
        id: 'sec_1',
        title: 'EXERCICE 1 : PROBLÈME MAJEUR & CALCULS RÉDIGÉS (8 POINTS)',
        problem_statement: `ÉTUDE DE CAS : DYNAMIQUE D'UN SOLIDE SUR PLAN INCLINÉ AVEC FROTTEMENT

On étudie le mouvement de glissement d'un solide de masse $m = 2,5\\ \\text{kg}$ sur un plan incliné d'un angle $\\alpha = 30^\\circ$ par rapport à l'horizontale. Le champ de pesanteur local est $g = 9,81\\ \\text{m/s}^2$.

Schéma physique de la situation :
         /|
        / | Solide [m = 2,5 kg]
       /  |     --> Déplacement vers le bas
      /   | Forces en jeu : Poids P, Réaction normale N, Force de frottement f
     / α  |
    /_____| α = 30°

Données du problème :
- Masse du mobile : $m = 2,5\\ \\text{kg}$
- Angle d'inclinaison : $\\alpha = 30^\\circ$ (soit $\\sin(30^\\circ) = 0,5$ et $\\cos(30^\\circ) \\approx 0,866$)
- Coefficient de frottement dynamique : $\\mu = 0,15$
- Vitesse initiale au sommet : $v_0 = 0\\ \\text{m/s}$
- La force de frottement s'oppose au mouvement et vérifie $f = \\mu \\cdot N$.`,
        questions: [
          {
            id: 'p1_q1',
            number: '1.',
            type: 'open',
            points: 3,
            texte:
              "Énoncer la deuxième loi de Newton (principe fondamental de la dynamique) et projeter les forces selon les axes tangentiel et normal au plan incliné pour exprimer la réaction normale $N$.",
            sampleAnswer:
              "Σ F_ext = m · a. Projection sur l'axe normal perpendiculaire au plan : N - P·cos(α) = 0, d'où N = m·g·cos(α). Application numérique : N = 2,5 × 9,81 × cos(30°) ≈ 21,24 N."
          },
          {
            id: 'p1_q2',
            number: '2.',
            type: 'open',
            points: 3,
            texte:
              "Établir l'expression analytique de l'accélération $a$ du mobile le long du plan incliné en fonction de $g$, $\\alpha$ et $\\mu$. Calculer sa valeur numérique.",
            sampleAnswer:
              "Sur l'axe tangentiel descendant : P·sin(α) - f = m·a avec f = μ·N = μ·m·g·cos(α). D'où m·g·[sin(α) - μ·cos(α)] = m·a, soit a = g·[sin(α) - μ·cos(α)]. Application numérique : a = 9,81 × [0,5 - 0,15 × 0,866] = 9,81 × [0,5 - 0,130] = 9,81 × 0,37 ≈ 3,63 m/s²."
          },
          {
            id: 'p1_q3',
            number: '3.',
            type: 'open',
            points: 2,
            texte:
              "Déterminer la vitesse $v_1$ atteinte par le solide après une distance parcourue de $L = 5,0\\ \\text{m}$ depuis le départ arrêté.",
            sampleAnswer:
              "Pour un mouvement rectiligne uniformément accéléré sans vitesse initiale : v² = 2·a·L <=> v = √(2 · a · L). Application numérique : v = √(2 × 3,63 × 5,0) = √(36,3) ≈ 6,02 m/s."
          }
        ],
        correction: {
          steps:
            "Méthode rigoureuse : 1) Bilan des forces. 2) Choix du repère lié au plan. 3) Calcul de N. 4) Déduction du frottement f. 5) Intégration cinématique.",
          examples: [
            "Exemple 1 : Dimensionnement du système de freinage d'un chariot élévateur sur rampe d'accès logistique.",
            "Exemple 2 : Analyse de la sécurité sur un toboggan d'évacuation aéronautique."
          ]
        }
      };

      const s2: NormalizedSection = {
        id: 'sec_2',
        title: 'EXERCICE 2 : QUESTIONNAIRE À CHOIX MULTIPLES — QCM (6 POINTS)',
        problem_statement: '',
        questions: [
          {
            id: 'p2_q1',
            number: '1.',
            type: 'multiple_choice',
            points: 1.5,
            texte:
              "Quelle est la condition nécessaire sur l'angle $\\alpha$ pour que le mobile se mette spontanément en mouvement depuis l'arrêt ?",
            options: [
              "$\\tan(\\alpha) > \\mu_s$ (où $\\mu_s$ est le coefficient de frottement statique)",
              "$\\sin(\\alpha) < \\mu_s$",
              "$\\alpha$ doit être supérieur à $45^\\circ$ en toutes circonstances",
              "La masse $m$ doit dépasser $10\\ \\text{kg}$"
            ],
            correctIndex: 0,
            explication:
              "Le glissement s'amorce quand la composante motrice du poids P·sin(α) surpasse le frottement statique maximal f_s,max = μ_s·P·cos(α), soit tan(α) > μ_s."
          },
          {
            id: 'p2_q2',
            number: '2.',
            type: 'multiple_choice',
            points: 1.5,
            texte: "Si l'on double la masse du solide ($m' = 5,0\\ \\text{kg}$), que devient son accélération $a$ ?",
            options: [
              "Elle reste rigoureusement inchangée ($a \\approx 3,63\\ \\text{m/s}^2$)",
              "Elle est multipliée par 2",
              "Elle est divisée par 2",
              "Elle s'annule immédiatement"
            ],
            correctIndex: 0,
            explication:
              "L'accélération a = g·[sin(α) - μ·cos(α)] est totalement indépendante de la masse du solide car la masse se simplifie dans l'équation dynamique."
          },
          {
            id: 'p2_q3',
            number: '3.',
            type: 'multiple_choice',
            points: 1.5,
            texte: "Quel est le travail de la réaction normale $N$ lors de la descente du solide sur la distance $L$ ?",
            options: [
              "$W(N) = 0\\ \\text{J}$ (la force est orthogonale au déplacement)",
              "$W(N) = N \\cdot L = 106,2\\ \\text{J}$",
              "$W(N) = -N \\cdot L$",
              "$W(N) = m \\cdot g \\cdot L$"
            ],
            correctIndex: 0,
            explication:
              "La réaction normale est constamment perpendiculaire au vecteur déplacement élémentaire, le produit scalaire est nul : le travail est nul."
          },
          {
            id: 'p2_q4',
            number: '4.',
            type: 'multiple_choice',
            points: 1.5,
            texte: "Quelle forme prend l'énergie dissipée par les forces de frottement lors du glissement ?",
            options: [
              "Énergie thermique (chaleur) cédée au milieu ambiant et aux surfaces",
              "Énergie potentielle de pesanteur récupérable",
              "Énergie cinétique de rotation",
              "Énergie électrostatique conservée"
            ],
            correctIndex: 0,
            explication:
              "Le travail des forces de frottement non conservatives est négatif et se dissipe irréversiblement sous forme de chaleur."
          }
        ],
        correction: {
          steps:
            "Synthèse : indépendance de l'accélération vis-à-vis de la masse, orthogonalité de la réaction normale et dissipation thermique.",
          examples: [
            'Exemple 1 : Étude de cas sur tapis roulant incliné.',
            'Exemple 2 : Calcul de déperdition thermique sur sabot de frein ferroviaire.'
          ]
        }
      };

      const s3: NormalizedSection = {
        id: 'sec_3',
        title: 'EXERCICE 3 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX (6 POINTS)',
        problem_statement: '',
        questions: [
          {
            id: 'p3_q1',
            number: '1.',
            type: 'true_false',
            points: 1.5,
            texte:
              "L'énergie mécanique totale du solide se conserve intégralement pendant toute la durée de la descente sur le plan incliné.",
            correctValue: false,
            explication:
              "FAUX : En présence de forces de frottement non conservatives, une partie de l'énergie mécanique initiale est dissipée en chaleur (ΔEm = W(f) < 0)."
          },
          {
            id: 'p3_q2',
            number: '2.',
            type: 'true_false',
            points: 1.5,
            texte:
              "La force de frottement dynamique est de sens strictement opposé au vecteur vitesse instantanée du solide.",
            correctValue: true,
            explication:
              "VRAI : Les forces de frottement de glissement s'opposent toujours au mouvement relatif entre les deux surfaces en contact."
          },
          {
            id: 'p3_q3',
            number: '3.',
            type: 'true_false',
            points: 1.5,
            texte:
              "Lorsque l'angle d'inclinaison $\\alpha$ augmente vers $90^\\circ$, la réaction normale du support $N$ diminue jusqu'à s'annuler.",
            correctValue: true,
            explication:
              "VRAI : N = m·g·cos(α). Pour α = 90° (chute libre verticale), cos(90°) = 0, donc le contact normal s'annule."
          },
          {
            id: 'p3_q4',
            number: '4.',
            type: 'true_false',
            points: 1.5,
            texte:
              "Deux solides de masses différentes lâchés sans vitesse initiale sur le même plan incliné glissent avec la même accélération.",
            correctValue: true,
            explication:
              "VRAI : Si le coefficient de frottement μ est identique, l'accélération a = g·[sin(α) - μ·cos(α)] est indépendante de la masse."
          }
        ],
        correction: {
          steps:
            "Validation des principes fondamentaux de conservation d'énergie, de frottement et de cinématique galiléenne.",
          examples: [
            'Exemple 1 : Glissement de charges lourdes sur trémies industrielles.',
            'Exemple 2 : Évaluation des risques d’avalanche sur versants enneigés.'
          ]
        }
      };

      return { s1, s2, s3 };
    }

    case 'math_analysis':
    case 'chemistry':
    case 'computer_science':
    case 'general':
    default: {
      const s1: NormalizedSection = {
        id: 'sec_1',
        title: 'EXERCICE 1 : PROBLÈME MAJEUR & CALCULS RÉDIGÉS (8 POINTS)',
        problem_statement: `ÉTUDE DE CAS APPROFONDIE & MODÉLISATION QUANTITATIVE : ${discipline}

Dans le cadre de cette épreuve officielle, on analyse un système modélisé par des équations directrices fondamentales de "${discipline}".

Données de l'étude :
- Paramètre caractéristique nominal : $K_0 = 120$ unités standard
- Variable d'entrée ou de commande : $x_e = 0,85$
- Équation de transfert gouvernante : $y(x) = K_0 \\cdot \\frac{x}{1 + \\lambda \\cdot x}$ avec paramètre d'amortissement $\\lambda = 0,15$
- Plage d'admissibilité physique : $0 \\le x \\le 5,0$
- Condition limite de saturation ou de stabilité : $y_{max} = 650$

Toutes les étapes de calcul doivent être rédigées de façon claire et méthodique sur les lignes prévues ci-dessous.`,
        questions: [
          {
            id: 'p1_q1',
            number: '1.',
            type: 'open',
            points: 3,
            texte:
              "Poser les équations théoriques fondamentales régissant le système et déterminer l'expression analytique de la dérivée ou sensibilité $\\frac{dy}{dx}$.",
            sampleAnswer:
              "On applique la règle de dérivation du quotient u/v : y'(x) = K0 · [(1 + λ·x) - x·λ] / (1 + λ·x)² = K0 / (1 + λ·x)². La dérivée est strictement positive sur [0, 5], le système est monotone croissant."
          },
          {
            id: 'p1_q2',
            number: '2.',
            type: 'open',
            points: 3,
            texte:
              "Calculer la valeur numérique exacte de la grandeur de sortie $y$ pour la valeur nominale $x_e = 0,85$. Vérifier si le système respecte le critère de stabilité.",
            sampleAnswer:
              "Application numérique : y(0,85) = 120 × 0,85 / (1 + 0,15 × 0,85) = 102 / 1,1275 ≈ 90,47 unités. Comme 90,47 < 650, le système fonctionne bien en deçà du seuil limite de saturation."
          },
          {
            id: 'p1_q3',
            number: '2.',
            type: 'open',
            points: 2,
            texte:
              "Déterminer la limite asymptotique $y_\\infty = \\lim_{x \\to +\\infty} y(x)$. Interpréter physiquement ce résultat pour le dimensionnement du système.",
            sampleAnswer:
              "Quand x -> +∞, y(x) = K0·x / (λ·x) -> K0 / λ. Numériquement : y_∞ = 120 / 0,15 = 800 unités. Cela représente la capacité de saturation maximale théorique du système."
          }
        ],
        correction: {
          steps:
            "Méthode de résolution : 1) Analyse de sensibilité locale. 2) Application numérique directe avec respect des chiffres significatifs. 3) Comportement asymptotique aux limites.",
          examples: [
            "Exemple 1 : Dimensionnement prédictif dans une chaîne de production automatisée.",
            "Exemple 2 : Optimisation de rendement en laboratoire d'essais."
          ]
        }
      };

      const s2: NormalizedSection = {
        id: 'sec_2',
        title: 'EXERCICE 2 : QUESTIONNAIRE À CHOIX MULTIPLES — QCM (6 POINTS)',
        problem_statement: '',
        questions: [
          {
            id: 'p2_q1',
            number: '1.',
            type: 'multiple_choice',
            points: 1.5,
            texte: `Quelle propriété fondamentale caractérise le comportement linéaire établi pour "${discipline}" ?`,
            options: [
              "Le principe de superposition s'applique rigoureusement aux grandeurs d'entrée et de sortie",
              "La réponse du système est totalement aléatoire sans relation causale",
              "La grandeur de sortie reste rigoureusement nulle en toutes circonstances",
              "Le système diverge spontanément vers l'infini dès l'instant initial"
            ],
            correctIndex: 0,
            explication:
              "La caractéristique fondamentale d'un système linéaire est le principe de superposition (linéarité additive et homogène)."
          },
          {
            id: 'p2_q2',
            number: '2.',
            type: 'multiple_choice',
            points: 1.5,
            texte: "Lorsque la grandeur d'entrée double en régime linéaire, que devient la grandeur de sortie ?",
            options: [
              "Elle est exactement multipliée par 2",
              "Elle est divisée par 2",
              "Elle reste rigoureusement constante",
              "Elle s'inverse avec un carré parfait"
            ],
            correctIndex: 0,
            explication:
              "Par homogénéité de la fonction de réponse linéaire, doubler l'entrée double directement la sortie."
          },
          {
            id: 'p2_q3',
            number: '3.',
            type: 'multiple_choice',
            points: 1.5,
            texte: "Quel facteur impose la borne supérieure de fonctionnement dans les conditions réelles ?",
            options: [
              "La saturation énergétique des composants ou les limites d'alimentation",
              "Le choix de l'unité de mesure arbitraire",
              "La durée théorique infinie de l'épreuve",
              "L'absence totale de contraintes physiques"
            ],
            correctIndex: 0,
            explication:
              "Tout système physique réel possède des butées d'alimentation ou des seuils de saturation thermique/mécanique."
          },
          {
            id: 'p2_q4',
            number: '4.',
            type: 'multiple_choice',
            points: 1.5,
            texte: "Quelle est la conséquence directe d'une rétroaction négative (contre-réaction) stabilisante ?",
            options: [
              "Elle stabilise le point de fonctionnement et élargit la plage de fidélité",
              "Elle provoque l'explosion thermique immédiate du système",
              "Elle annule tout signal utile",
              "Elle rend le système complètement imprévisible"
            ],
            correctIndex: 0,
            explication:
              "La rétroaction négative réduit la sensibilité aux perturbations externes et garantit la stabilité."
          }
        ],
        correction: {
          steps:
            "Synthèse du QCM : application directe des principes de causalité, de linéarité et de stabilité des systèmes.",
          examples: [
            'Exemple 1 : Analyse critique des écarts par rapport au modèle théorique.',
            'Exemple 2 : Choix des composants selon la marge de stabilité requise.'
          ]
        }
      };

      const s3: NormalizedSection = {
        id: 'sec_3',
        title: 'EXERCICE 3 : TEST DE DISCRIMINATION CONCEPTUELLE — VRAI OU FAUX (6 POINTS)',
        problem_statement: '',
        questions: [
          {
            id: 'p3_q1',
            number: '1.',
            type: 'true_false',
            points: 1.5,
            texte:
              "En régime de fonctionnement nominal, les lois de conservation fondamentales (énergie, matière, charge) sont rigoureusement respectées.",
            correctValue: true,
            explication:
              "VRAI : Les principes universels de conservation s'appliquent à tous les systèmes physiques fermés ou en régime permanent."
          },
          {
            id: 'p3_q2',
            number: '2.',
            type: 'true_false',
            points: 1.5,
            texte:
              "Un système physique réel peut délivrer indéfiniment une puissance supérieure à la puissance totale qui lui est fournie.",
            correctValue: false,
            explication:
              "FAUX : Le premier et le second principes de la thermodynamique interdisent tout rendement supérieur à 1 (mouvement perpétuel impossible)."
          },
          {
            id: 'p3_q3',
            number: '3.',
            type: 'true_false',
            points: 1.5,
            texte:
              "La modélisation mathématique permet de prédire avec exactitude la réponse du système tant que les hypothèses simplificatrices restent valides.",
            correctValue: true,
            explication:
              "VRAI : La validité d'un modèle dépend directement du respect de son domaine d'application et de ses hypothèses limites."
          },
          {
            id: 'p3_q4',
            number: '4.',
            type: 'true_false',
            points: 1.5,
            texte:
              "L'augmentation sans limite du gain global n'a aucune incidence sur la stabilité dynamique du système.",
            correctValue: false,
            explication:
              "FAUX : Une augmentation excessive du gain réduit la marge de phase et peut faire basculer le système dans une instabilité oscillatoire sévère."
          }
        ],
        correction: {
          steps:
            "Synthèse conceptuelle : respect des invariants physiques et analyse rigoureuse des conditions aux limites.",
          examples: [
            'Exemple 1 : Validation expérimentale en banc d’essai.',
            'Exemple 2 : Traitement d’un contre-exemple avec dépassement de seuil critique.'
          ]
        }
      };

      return { s1, s2, s3 };
    }
  }
}

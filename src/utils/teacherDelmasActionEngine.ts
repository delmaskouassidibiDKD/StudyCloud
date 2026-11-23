import { safeJsonParse } from '../services/api';
import type { CustomMentionRule, GradebookSortMode } from './gradebookCalculations';
import type {
  TeacherDelmasFileRecord,
  TeacherDelmasWorkspaceSnapshot,
} from '../services/teacherGradebookApi';

export interface SupportedDelmasLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  promptInstruction: string;
}

export const SUPPORTED_DELMAS_LANGUAGES: SupportedDelmasLanguage[] = [
  {
    code: 'fr',
    name: 'Français',
    nativeName: 'Français',
    flag: '🇫🇷',
    promptInstruction:
      'TU DOIS TRAVAILLER ET RÉPONDRE EXCLUSIVEMENT ET À 100 % EN FRANÇAIS CLAIR, NATUREL ET PROFESSIONNEL.',
  },
  {
    code: 'en',
    name: 'Anglais',
    nativeName: 'English',
    flag: '🇬🇧',
    promptInstruction:
      'YOU MUST WORK AND RESPOND EXCLUSIVELY AND 100% IN CLEAR, NATURAL, PROFESSIONAL ENGLISH.',
  },
  {
    code: 'es',
    name: 'Espagnol',
    nativeName: 'Español',
    flag: '🇪🇸',
    promptInstruction:
      'DEBES TRABAJAR Y RESPONDER EXCLUSIVAMENTE Y AL 100% EN ESPAÑOL CLARO, NATURAL Y PROFESIONAL.',
  },
  {
    code: 'ar',
    name: 'Arabe',
    nativeName: 'العربية',
    flag: '🇸🇦',
    promptInstruction:
      'يجب عليك العمل والإجابة حصرياً وبالكامل بنسبة 100% باللغة العربية الفصحى الواضحة والمهنية.',
  },
  {
    code: 'de',
    name: 'Allemand',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    promptInstruction:
      'DU MUSST AUSSCHLIESSLICH UND ZU 100 % AUF KLAREM, PROFESSIONELLEM DEUTSCH ARBEITEN UND ANTWORTEN.',
  },
  {
    code: 'pt',
    name: 'Portugais',
    nativeName: 'Português',
    flag: '🇵🇹',
    promptInstruction:
      'VOCÊ DEVE TRABALHAR E RESPONDER EXCLUSIVAMENTE E 100% EM PORTUGUÊS CLARO E PROFISSIONAL.',
  },
  {
    code: 'zh',
    name: 'Chinois',
    nativeName: '中文',
    flag: '🇨🇳',
    promptInstruction:
      '你必须完全（100%）使用清晰、自然、专业的中文进行工作和回答。',
  },
  {
    code: 'ja',
    name: 'Japonais',
    nativeName: '日本語',
    flag: '🇯🇵',
    promptInstruction:
      'すべての作業と回答は、100%明確で自然な日本語で行ってください。',
  },
  {
    code: 'ru',
    name: 'Russe',
    nativeName: 'Русский',
    flag: '🇷🇺',
    promptInstruction:
      'ВЫ ДОЛЖНЫ РАБОТАТЬ И ОТВЕЧАТЬ ИСКЛЮЧИТЕЛЬНО И НА 100% НА ЯСНОМ ПРОФЕССИОНАЛЬНОМ РУССКОМ ЯЗЫКЕ.',
  },
  {
    code: 'it',
    name: 'Italien',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    promptInstruction:
      'DEVI LAVORARE E RISPONDERE ESCLUSIVAMENTE E AL 100% IN ITALIANO CHIARO E PROFESSIONALE.',
  },
];

export interface TeacherDelmasActiveContext {
  sheetKind: 'subject' | 'term_average' | 'annual_average';
  yearId?: string;
  yearLabel?: string;
  schoolId?: string;
  schoolName?: string;
  classId: string;
  className: string;
  levelName?: string;
  termId?: string;
  termName?: string;
  termCoefficient?: number | null;
  subjectId?: string;
  subjectName?: string;
  subjectCoefficient?: number | null;
  averageCardId?: string;
  averageCardTitle?: string;
  sortMode: GradebookSortMode;
  showMatricule: boolean;
  averageScale: number;
  mentionRules: CustomMentionRule[];
  zoomPercent: number;
  activeCellCoord?: string;
  activeCellValue?: string;
  noteColumns?: Array<{
    index: number; // 0-based
    colNumber: number; // 1-based
    title: string;
    label: string;
    maxScore: number;
    coeffEval: number;
  }>;
  students: Array<{
    rowIndex: number; // 1-based
    id: string;
    name: string;
    matricule?: string;
    notes?: string[];
    averageFormatted?: string;
    averageNumber?: number | null;
    rank?: string;
    mention?: string;
  }>;
  generalAverageMeta?: {
    totalClassCoeff?: number;
    classGeneralAverage?: number | null;
    passRatePercent?: number | null;
    subjects?: Array<{ id: string; name: string; coefficient?: number | null }>;
    terms?: Array<{ id: string; name: string; coefficient?: number | null }>;
  };
}

export type TeacherDelmasActionType =
  | 'add_students'
  | 'update_students'
  | 'set_students'
  | 'remove_students'
  | 'clear_notes'
  | 'add_note_column'
  | 'update_note_column'
  | 'delete_note_column'
  | 'swap_note_columns'
  | 'adjust_grades'
  | 'set_sort_mode'
  | 'set_show_matricule'
  | 'set_average_scale'
  | 'bulk_update_note_max'
  | 'set_mention_rules'
  | 'format_cells'
  | 'clear_formatting'
  | 'set_zoom'
  | 'reset_column_widths'
  | 'undo'
  | 'redo'
  | 'export_excel'
  | 'set_subject_coefficient'
  | 'set_term_coefficient'
  | 'copy_students_from_subject';

export interface TeacherDelmasAction {
  type: TeacherDelmasActionType;
  [key: string]: any;
}

export interface TeacherDelmasSheetBridge {
  getContext: () => TeacherDelmasActiveContext;
  executeActions: (
    actions: TeacherDelmasAction[],
    workspaceSnapshot?: TeacherDelmasWorkspaceSnapshot | null
  ) => Promise<string[]> | string[];
}

/**
 * Construit le prompt système complet pour l'Assistant Delmas :
 * - Force la langue choisie
 * - Indique exactement dans quelle école, classe, trimestre et matière l'utilisateur travaille
 * - Interdit formellement de modifier une autre matière/classe si l'utilisateur ne l'a pas demandé
 * - Interdit de modifier le tableau si l'utilisateur pose uniquement une question
 * - Expose le schéma JSON des actions pour piloter le tableau et toutes les fonctionnalités de l'interface
 */
export function buildTeacherDelmasSystemPrompt(params: {
  languageCode: string;
  activeContext: TeacherDelmasActiveContext;
  workspaceSnapshot?: TeacherDelmasWorkspaceSnapshot | null;
  conversationFiles?: TeacherDelmasFileRecord[];
}): string {
  const { languageCode, activeContext, workspaceSnapshot, conversationFiles } = params;
  const langObj =
    SUPPORTED_DELMAS_LANGUAGES.find((l) => l.code === languageCode) ||
    SUPPORTED_DELMAS_LANGUAGES[0];

  const sheetTitle =
    activeContext.sheetKind === 'subject'
      ? `Matière « ${activeContext.subjectName || 'Matière'} »${
          activeContext.subjectCoefficient !== undefined &&
          activeContext.subjectCoefficient !== null
            ? ` (Coeff ${activeContext.subjectCoefficient})`
            : ''
        }`
      : activeContext.sheetKind === 'term_average'
      ? `Tableau de Moyenne générale du trimestre « ${
          activeContext.termName || activeContext.averageCardTitle || 'Trimestre'
        } »`
      : `Tableau de Moyenne générale annuelle « ${
          activeContext.averageCardTitle || "Moyenne générale de l'année"
        } »`;

  // Résumé des colonnes de notes du tableau ouvert
  const noteColsSummary =
    activeContext.noteColumns && activeContext.noteColumns.length > 0
      ? activeContext.noteColumns
          .map(
            (c) =>
              `Colonne ${c.colNumber} (${c.label}) : barème /${c.maxScore}, coeff éval = ${c.coeffEval}`
          )
          .join('\n  - ')
      : 'Aucune colonne de note (tableau de moyenne générale)';

  // Résumé des élèves du tableau ouvert
  const nonEmptyStudents = activeContext.students.filter(
    (s) =>
      s.name.trim().length > 0 ||
      (s.matricule && s.matricule.trim().length > 0) ||
      (s.notes && s.notes.some((n) => String(n).trim().length > 0))
  );

  const studentsSummary =
    nonEmptyStudents.length > 0
      ? nonEmptyStudents
          .slice(0, 120)
          .map((s) => {
            const notesPart =
              s.notes && s.notes.length > 0
                ? ` | Notes: [${s.notes
                    .map((n, idx) => `N${idx + 1}=${n || '-'}`)
                    .join(', ')}]`
                : '';
            const matPart = s.matricule ? ` | Matricule: ${s.matricule}` : '';
            const avgPart = s.averageFormatted
              ? ` | Moyenne: ${s.averageFormatted}/${activeContext.averageScale}`
              : '';
            const rankPart = s.rank ? ` | Rang: ${s.rank}` : '';
            const mentionPart = s.mention ? ` | Mention: ${s.mention}` : '';
            return `Ligne ${s.rowIndex} (id="${s.id}") : Nom="${s.name}"${matPart}${notesPart}${avgPart}${rankPart}${mentionPart}`;
          })
          .join('\n  - ')
      : `Le tableau ouvert contient actuellement ${activeContext.students.length} lignes vides prêtes à être remplies.`;

  // Résumé de la base de données Moyennes de l'utilisateur (autres matières/classes du compte)
  let dbOverview = '';
  if (workspaceSnapshot) {
    const classLines: string[] = [];
    for (const cls of workspaceSnapshot.classes.slice(0, 25)) {
      const clsDisplay = cls.name
        ? cls.name.toLowerCase().includes(cls.level.toLowerCase())
          ? cls.name
          : `${cls.level} • ${cls.name}`
        : cls.level;
      const clsTerms = workspaceSnapshot.terms.filter((t) => t.classId === cls.id);
      const termSummaries = clsTerms.map((t) => {
        const subjs = workspaceSnapshot.subjects.filter(
          (s) => s.classId === cls.id && s.termId === t.id
        );
        const subjStr = subjs
          .map((s) => {
            const gb = workspaceSnapshot.gradebooks.find(
              (g) => g.subjectId === s.id && g.termId === t.id
            );
            const stdCount = gb ? gb.students.length : 0;
            return `${s.name} (id="${s.id}", coeff=${s.coefficient ?? 1}, ${stdCount} élèves)`;
          })
          .join(', ');
        return `${t.name} (id="${t.id}", coeff=${t.coefficient ?? 1}) : [${subjStr || 'aucune matière'}]`;
      });
      classLines.push(`- Classe « ${clsDisplay} » (id="${cls.id}") :\n    ${termSummaries.join('\n    ')}`);
    }

    // Détail des élèves des autres matières de la MÊME classe active pour lecture/comparaison rapide
    const sameClassGradebooks = workspaceSnapshot.gradebooks.filter(
      (g) => g.classId === activeContext.classId && g.subjectId !== activeContext.subjectId
    );
    const otherSubjectsDetails: string[] = [];
    for (const gb of sameClassGradebooks.slice(0, 15)) {
      const subj = workspaceSnapshot.subjects.find((s) => s.id === gb.subjectId);
      const term = workspaceSnapshot.terms.find((t) => t.id === gb.termId);
      if (!subj || gb.students.length === 0) continue;
      const stList = gb.students
        .slice(0, 60)
        .map(
          (st) =>
            `${st.name}${st.matricule ? ` (${st.matricule})` : ''}: notes=[${st.notes
              .filter((_, i) => i < gb.noteColCount)
              .map((n) => n || '-')
              .join(', ')}], moy/20=${st.average20 !== null ? st.average20.toFixed(2) : '-'}`
        )
        .join(' ; ');
      otherSubjectsDetails.push(
        `  * ${subj.name} (${term?.name || 'Trimestre'}, subjectId="${subj.id}") : ${stList}`
      );
    }

    dbOverview = `
[BASE DE DONNÉES « APPLICATION MOYENNES » DU COMPTE UTILISATEUR (LECTURE SEULE PAR DÉFAUT)] :
${classLines.length > 0 ? classLines.join('\n') : 'Aucune autre classe enregistrée.'}
${
  otherSubjectsDetails.length > 0
    ? `\n[DÉTAIL DES AUTRES MATIÈRES DE LA CLASSE ACTIVE « ${activeContext.className} »] :\n${otherSubjectsDetails.join('\n')}`
    : ''
}`;
  }

  // Résumé des fichiers liés dans le dossier de la conversation
  let filesContext = '';
  if (conversationFiles && conversationFiles.length > 0) {
    const fileBlocks = conversationFiles
      .filter((f) => f.extractedText && f.extractedText.trim().length > 0)
      .map(
        (f, i) =>
          `--- FICHIER ${i + 1} DU DOSSIER DE LA CONVERSATION : « ${f.fileName} » (${f.fileType}) ---\n${f.extractedText.slice(0, 25000)}`
      );
    if (fileBlocks.length > 0) {
      filesContext = `\n[DOSSIER DES FICHIERS LIÉS À CETTE CONVERSATION] :\n${fileBlocks.join('\n\n')}`;
    }
  }

  const mentionRulesStr = activeContext.mentionRules
    .map((r) => `>= ${r.min} : "${r.label}"`)
    .join(', ');

  return `Tu es **Assistant Delmas**, le copilote intelligent intégré au tableur de moyennes de StudyCloud.
${langObj.promptInstruction}

=====================================================================
1. EMPLACEMENT EXACT OÙ SE TROUVE L'UTILISATEUR EN CE MOMENT MÊME
=====================================================================
- Année scolaire : ${activeContext.yearLabel || 'Non spécifiée'}
- Établissement : ${activeContext.schoolName || 'Non spécifié'}
- Classe actuelle : **${activeContext.className}** ${activeContext.levelName ? `(Niveau : ${activeContext.levelName})` : ''}
- Trimestre actuel : **${activeContext.termName || 'Trimestre 1'}**
- Tableau actuellement ouvert à l'écran : **${sheetTitle}** (type="${activeContext.sheetKind}")
- Réglages actuels de ce tableau :
  * Tri : ${activeContext.sortMode === 'merit' ? 'Ordre de mérite (1er → dernier)' : activeContext.sortMode === 'alpha' ? 'Ordre alphabétique (A → Z)' : 'Ordre initial'}
  * Colonne Matricule affichée : ${activeContext.showMatricule ? 'OUI' : 'NON'}
  * Barème de la moyenne : Sur /${activeContext.averageScale}
  * Intervalles de mentions : ${mentionRulesStr}
  * Zoom : ${activeContext.zoomPercent}%
  ${activeContext.activeCellCoord ? `* Case actuellement sélectionnée par l'utilisateur : ${activeContext.activeCellCoord} (valeur="${activeContext.activeCellValue || ''}")` : ''}
- Colonnes de notes de ce tableau :
  - ${noteColsSummary}
- Élèves actuellement présents dans ce tableau ouvert (${nonEmptyStudents.length} élèves renseignés sur ${activeContext.students.length} lignes) :
  - ${studentsSummary}
${dbOverview}
${filesContext}

=====================================================================
2. RÈGLES STRICTES DE CIBLAGE ET D'EXÉCUTION (TRÈS IMPORTANT)
=====================================================================
1. **CIBLE EXCLUSIVE = LE TABLEAU OUVERT** :
   Tu sais exactement que l'utilisateur travaille en ce moment dans la classe **« ${activeContext.className} »** et dans **${sheetTitle}**.
   Quand l'utilisateur te demande d'écrire, d'ajouter des élèves, de saisir des notes, de trier, de changer le barème, d'afficher le matricule, d'ajuster des points ou de mettre en forme, tu appliques ces actions **UNIQUEMENT dans ce tableau actuellement ouvert** et **JAMAIS ailleurs** (ne touche jamais une autre matière ou une autre classe si l'utilisateur ne l'a pas explicitement demandé).
2. **AUCUNE MODIFICATION NON DEMANDÉE** :
   Si l'utilisateur te pose simplement une question (ex: « Dans quelle classe je suis ? », « Qui est le premier ? », « Combien d'élèves ont la moyenne ? », « Que contient cette image ? », « Compare avec les notes d'une autre matière ») SANS te demander de modifier le tableau, tu réponds clairement et le tableau \`"actions"\` DOIT être vide (\`"actions": []\`).
3. **EXTRACTION DEPUIS IMAGE / PHOTO / EXCEL / PDF / AUDIO** :
   Si l'utilisateur importe une photo de liste d'élèves, un relevé de notes manuscrit ou imprimé, un fichier Excel/CSV/Word/PDF ou dicte des notes, et demande de les mettre dans le tableau, lis toutes les lignes visibles avec une précision maximale et génère les actions (\`add_students\` ou \`update_students\` + \`set_show_matricule\` si des matricules sont présents) pour tout remplir d'un seul coup !

=====================================================================
3. FORMAT DE RÉPONSE OBLIGATOIRE (JSON STRICT)
=====================================================================
Tu dois TOUJOURS répondre avec un unique objet JSON valide (sans texte en dehors du JSON) ayant exactement cette structure :
\`\`\`json
{
  "chat_response": "Ta réponse claire, chaleureuse et précise dans la langue choisie (${langObj.name}). Explique ce que tu as fait ou réponds à la question.",
  "actions": [
    // Liste des actions à exécuter immédiatement sur le tableau ouvert (vide [] si aucune modification n'est demandée)
  ]
}
\`\`\`

=====================================================================
4. CATALOGUE COMPLET DES ACTIONS DISPONIBLES DANS "actions"
=====================================================================
Voici toutes les actions que tu peux placer dans \`"actions"\` lorsque l'utilisateur te demande d'agir sur le tableau :

1. **Ajouter des élèves (remplit d'abord les lignes vides du tableau puis ajoute des lignes)** :
   \`{ "type": "add_students", "students": [ { "name": "KOUASSI Delmas", "matricule": "24-001", "notes": ["15", "14.5", "18"] } ] }\`
   (Si tu ajoutes aussi des matricules et que la colonne Matricule est masquée, ajoute aussi \`{ "type": "set_show_matricule", "show": true, "scope": "sheet" }\`).

2. **Modifier les notes, le nom ou le matricule d'élèves existants** :
   \`{ "type": "update_students", "updates": [ { "matchName": "DKD", "rowIndex": 1, "newName": "DKD Kouassi", "matricule": "MAT-01", "notes": { "1": "16", "2": "17.5" } } ] }\`
   (Dans \`"notes"\`, la clé \`"1"\` correspond à NOTE 1, \`"2"\` à NOTE 2, etc. Tu peux cibler un élève par \`"matchName"\`, par \`"rowIndex"\` 1..N, ou par \`"studentId"\`).

3. **Remplacer toute la liste des élèves du tableau ouvert** :
   \`{ "type": "set_students", "students": [ { "name": "Élève 1", "matricule": "", "notes": ["12", "14"] } ] }\`

4. **Supprimer des élèves ou nettoyer les lignes vides** :
   \`{ "type": "remove_students", "names": ["Nom Élève"], "rowIndices": [3, 4], "removeEmpty": false }\`
   (Mets \`"removeEmpty": true\` pour supprimer toutes les lignes vides du tableau).

5. **Effacer des notes** :
   \`{ "type": "clear_notes", "mode": "all" }\` ou \`{ "type": "clear_notes", "mode": "specific", "colNumber": 1 }\`

6. **Ajouter une ou plusieurs colonnes de notes** :
   \`{ "type": "add_note_column", "title": "NOTE", "maxScore": 20, "coeffEval": 1, "count": 1 }\`

7. **Modifier l'intitulé, le barème (/20, /40...) ou le coefficient d'une colonne de note** :
   \`{ "type": "update_note_column", "colNumber": 1, "title": "DEVOIR", "maxScore": 40, "coeffEval": 2 }\`

8. **Supprimer ou déplacer une colonne de note** :
   \`{ "type": "delete_note_column", "colNumber": 7 }\`
   \`{ "type": "swap_note_columns", "colNumber1": 1, "colNumber2": 2 }\`

9. **Ajuster les notes (± Ajouter ou retirer des points comme le bouton Ajuster du ruban)** :
   \`{ "type": "adjust_grades", "mode": "all", "delta": 1.5 }\` (ou \`"mode": "specific", "colNumber": 2, "delta": -1\`)

10. **Changer le classement / tri des élèves (Ordre de mérite, Alphabétique, Ordre initial)** :
    \`{ "type": "set_sort_mode", "sortMode": "merit" }\` (\`"merit"\` = Ordre de mérite 1er → dernier, \`"alpha"\` = Ordre alphabétique A → Z, \`"order"\` = Ordre initial)

11. **Afficher ou masquer la colonne Matricule (ce tableau ou toute la classe)** :
    \`{ "type": "set_show_matricule", "show": true, "scope": "sheet" }\` (\`"scope": "sheet"\` par défaut, ou \`"class"\` si l'utilisateur demande pour toute la classe)

12. **Définir sur combien la moyenne générale est calculée (ex: sur /20, /40, /100...)** :
    \`{ "type": "set_average_scale", "scale": 40, "scope": "sheet" }\` (\`"scope": "sheet"\` par défaut, ou \`"class"\` si demandé pour toute la classe)

13. **Changer d'un coup le barème maximal de toutes les notes ou d'une note spécifique** :
    \`{ "type": "bulk_update_note_max", "mode": "all", "maxScore": 40, "convertExisting": false }\` (ou \`"mode": "specific", "colNumber": 1, "maxScore": 40, "convertExisting": true\`)

14. **Personnaliser les intervalles et libellés de Mentions** :
    \`{ "type": "set_mention_rules", "scope": "sheet", "rules": [ { "min": 16, "label": "Très Bien" }, { "min": 14, "label": "Bien" }, { "min": 12, "label": "Assez Bien" }, { "min": 10, "label": "Passable" }, { "min": 0, "label": "Insuffisant" } ] }\`

15. **Mettre en forme les cases (Gras, Italique, Souligné, Couleur du texte, Couleur de fond, Police, Taille, Alignement)** :
    \`{ "type": "format_cells", "target": "all" | "student" | "column" | "condition", "studentName": "DKD", "rowIndex": 1, "column": "name" | "matricule" | "note" | "average" | "mention" | "rank", "colNumber": 1, "condition": "average_below" | "average_above" | "rank_top", "threshold": 10, "style": { "bold": true, "italic": false, "underline": false, "textColor": "#dc2626", "bgColor": "#fee2e2", "fontFamily": "Calibri", "fontSize": 12, "textAlign": "center" } }\`

16. **Effacer la mise en forme / couleurs du tableau** :
    \`{ "type": "clear_formatting" }\`

17. **Copier les élèves depuis une autre matière de la base de données dans ce tableau ouvert** :
    \`{ "type": "copy_students_from_subject", "sourceSubjectName": "Physique", "includeNotes": false }\`

18. **Modifier le coefficient d'une matière ou d'un trimestre (dans les tableaux de Moyenne Générale)** :
    \`{ "type": "set_subject_coefficient", "subjectName": "Mathématiques", "coefficient": 4 }\`
    \`{ "type": "set_term_coefficient", "termName": "Trimestre 1", "coefficient": 2 }\`

19. **Zoom, Largeurs, Annuler (Undo), Rétablir (Redo), Exporter en Excel (.xlsx)** :
    \`{ "type": "set_zoom", "zoomPercent": 80 }\`
    \`{ "type": "reset_column_widths" }\`
    \`{ "type": "undo" }\`
    \`{ "type": "redo" }\`
    \`{ "type": "export_excel" }\`
`;
}

/**
 * Extrait proprement { chatResponse, actions } de la réponse brute du LLM
 * en garantissant qu'aucun JSON brut ne s'affiche jamais dans la bulle de discussion.
 */
export function parseTeacherDelmasAiResponse(rawText: string): {
  chatResponse: string;
  actions: TeacherDelmasAction[];
} {
  if (!rawText || typeof rawText !== 'string') {
    return { chatResponse: '', actions: [] };
  }

  const trimmed = rawText.trim();

  // 1. Tentative de parsing JSON direct ou via safeJsonParse
  const parsed = safeJsonParse<any>(trimmed);
  if (parsed && typeof parsed === 'object') {
    const candidateText =
      typeof parsed.chat_response === 'string'
        ? parsed.chat_response
        : typeof parsed.chat_message === 'string'
        ? parsed.chat_message
        : typeof parsed.response === 'string'
        ? parsed.response
        : typeof parsed.message === 'string'
        ? parsed.message
        : '';

    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.filter((a: any) => a && typeof a === 'object' && typeof a.type === 'string')
      : [];

    if (candidateText.trim()) {
      return {
        chatResponse: candidateText.trim(),
        actions,
      };
    }

    if (actions.length > 0) {
      return {
        chatResponse: '✓ Modifications appliquées directement dans votre tableau.',
        actions,
      };
    }
  }

  // 2. Fallback : s'il y a un bloc ```json ... ``` au milieu d'un texte libre
  let cleanText = trimmed;
  let extractedActions: TeacherDelmasAction[] = [];

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    const innerParsed = safeJsonParse<any>(codeBlockMatch[1]);
    if (innerParsed && typeof innerParsed === 'object') {
      if (Array.isArray(innerParsed.actions)) {
        extractedActions = innerParsed.actions.filter(
          (a: any) => a && typeof a === 'object' && typeof a.type === 'string'
        );
      }
      if (typeof innerParsed.chat_response === 'string' && innerParsed.chat_response.trim()) {
        return {
          chatResponse: innerParsed.chat_response.trim(),
          actions: extractedActions,
        };
      }
    }
    cleanText = trimmed.replace(/```(?:json)?\s*[\s\S]*?\s*```/gi, '').trim();
  }

  return {
    chatResponse: cleanText || 'Je suis à votre disposition pour votre tableau.',
    actions: extractedActions,
  };
}

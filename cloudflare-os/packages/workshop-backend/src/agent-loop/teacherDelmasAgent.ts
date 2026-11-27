/**
 * ============================================================================
 * STUDYCLOUD - AGENT NATIVE TOOL-CALLING + ZOD POUR ASSISTANT DELMAS (MOYENNES)
 * ============================================================================
 * Remplace l'ancien parsing texte fragile `<delmas_actions>` par de vrais outils
 * typés Zod dans une boucle multi-étapes (`maxSteps = 5`) :
 *  - Lecture temps réel du tableau + fichiers joints (jamais tronqués)
 *  - Validation stricte Zod de chaque action avant acceptation
 *  - Simulation d'état en mémoire + garde-fou anti-import partiel (ex: 2/10 élèves)
 *    qui renvoie automatiquement une erreur structurée au modèle pour qu'il
 *    complète les élèves manquants AVANT de répondre à l'utilisateur !
 *  - Protection anti-injection intégrée dans les outils destructifs
 * ============================================================================
 */

import { z } from "zod";
import {
  type AgentToolTraceEntry,
  type ChatCompletionRequester,
  type RegisteredAgentTool,
  runAgentToolLoop,
} from "./toolLoopCore.js";

export interface TeacherSheetStudentSnap {
  rowIndex?: number;
  id?: string;
  name: string;
  matricule?: string;
  notes?: string[];
  averageFormatted?: string;
  rank?: string;
  mention?: string;
}

export interface TeacherSheetContextInput {
  sheetKind: "subject" | "term_average" | "annual_average";
  classId?: string;
  className?: string;
  termId?: string;
  termName?: string;
  subjectId?: string;
  subjectName?: string;
  sortMode?: string;
  showMatricule?: boolean;
  averageScale?: number;
  zoomPercent?: number;
  noteColumns?: Array<{ colNumber: number; label: string; maxScore: number; coeffEval: number }>;
  students?: TeacherSheetStudentSnap[];
}

export interface TeacherAttachedFileInput {
  fileName: string;
  fileType?: string;
  extractedText?: string;
}

export interface DelmasActionItem {
  type: string;
  [key: string]: any;
}

export interface RunTeacherDelmasAgentParams {
  models: string[];
  systemPrompt: string;
  conversationMessages: Array<{ role: "user" | "assistant"; content: string }>;
  userPrompt: string;
  sheetContext?: TeacherSheetContextInput | null;
  attachedFiles?: TeacherAttachedFileInput[];
  recentUserMessages?: string[];
  allowActions: boolean;
  db?: any;
  userId?: string;
  requester: ChatCompletionRequester;
  stripReasoning?: (text: string) => string;
}

export interface RunTeacherDelmasAgentResult {
  supported: boolean;
  modelUsed: string | null;
  finalText: string;
  structuredActions: DelmasActionItem[];
  stepsUsed: number;
  toolTrace: AgentToolTraceEntry[];
  totalPromptChars: number;
  totalCompletionChars: number;
}

function normalizeStr(v: unknown): string {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Estime les noms d'élèves présents dans un fichier CSV/Excel joint pour permettre
 * à l'outil `add_or_update_students` de détecter immédiatement un import incomplet (ex: 2 sur 10).
 */
export function extractSpreadsheetExpectedNames(files?: TeacherAttachedFileInput[]): string[] {
  if (!Array.isArray(files) || files.length === 0) return [];
  const sheetFile = [...files]
    .reverse()
    .find(
      (f) =>
        /\.(xlsx|xls|csv)$/i.test(f?.fileName || "") &&
        typeof f?.extractedText === "string" &&
        f.extractedText.trim().length > 10
    );
  if (!sheetFile || !sheetFile.extractedText) return [];

  const lines = sheetFile.extractedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^\[---\s*Feuille Excel/i.test(l));
  if (lines.length < 2) return [];

  const splitLine = (line: string, delim: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQ = false;
          }
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const delim =
    splitLine(lines[0], ";").length > splitLine(lines[0], ",").length
      ? ";"
      : splitLine(lines[0], "\t").length > splitLine(lines[0], ",").length
      ? "\t"
      : ",";

  const rows = lines.map((l) => splitLine(l, delim));
  const fullNameRe =
    /^(?:nom\s*(?:et\s*)?prenoms?|noms?\s*(?:et\s*)?prenoms?|nom\s+complet|eleves?|etudiants?|apprenants?|full\s*name|student(?:\s*name)?|names?)$/;
  const summaryRe =
    /^(?:moyenne\s+(?:de\s+(?:la\s+)?|generale\s+)?classe|moyenne\s+generale|total|effectif|taux\s+de\s+reussite|statistiques|signature)/i;

  let headerIdx = -1;
  let fullCol = -1;
  let lastCol = -1;
  let firstCol = -1;

  for (let r = 0; r < Math.min(25, rows.length); r++) {
    const cols = rows[r];
    if (cols.length < 2) continue;
    cols.forEach((cell, idx) => {
      const h = normalizeStr(cell).replace(/\([^)]*\)/g, " ").replace(/&+/g, " ").replace(/\s+/g, " ").trim();
      if (fullCol === -1 && fullNameRe.test(h)) fullCol = idx;
      else if (lastCol === -1 && /^(?:nom|noms|last\s*name|surname)$/.test(h)) lastCol = idx;
      else if (firstCol === -1 && /^(?:prenom|prenoms|first\s*name)$/.test(h)) firstCol = idx;
    });
    if (fullCol !== -1 || lastCol !== -1) {
      headerIdx = r;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const names: string[] = [];
  for (let r = headerIdx + 1; r < rows.length && names.length < 300; r++) {
    const cols = rows[r];
    const rawName =
      fullCol !== -1
        ? String(cols[fullCol] || "").trim()
        : `${String(cols[lastCol] || "").trim()} ${firstCol !== -1 ? String(cols[firstCol] || "").trim() : ""}`.trim();
    if (!rawName || rawName.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(rawName)) continue;
    const normN = normalizeStr(rawName).replace(/&+/g, " ").replace(/\s+/g, " ").trim();
    if (fullNameRe.test(normN) || summaryRe.test(normN)) continue;
    names.push(rawName);
  }
  return names;
}

const DESTRUCTIVE_INTENT_REGEX =
  /(?:\b(?:supprim\w*|retir\w*|enlev\w*|enl[a-z]?v\w*|ote|oter|effac\w*|vide\w*|vider|nettoi\w*|nettoyer|remplac\w*|ecras\w*|reinitialis\w*|decolor\w*|recommenc\w*|degag\w*|vir\w*|par\s+defaut|sans\s+couleur|pas\s+de\s+couleur|reset|delete|remove|clear|erase|clean|replace|wipe)\b|\b(?:a\s+zero|a\s+blanc|sans\s+rien|rien\s+laisser|laisser\s+vide|table\s+rase|place\s+nette)\b)/i;

const UNFULFILLED_CLAIM_REGEX =
  /\b(c'est fait|voila c'est fait|j'ai mis|j'ai applique|j'ai colore|j'ai retire|j'ai enleve|j'ai supprime|j'ai efface|j'ai vide|j'ai insere|j'ai importe|j'ai rempli|j'ai renseigne|j'ai agrandi|j'ai modifie|j'ai trie|j'ai ajoute|j'ai mis a jour|j'ai reinitialise|j'ai nettoye|j'ai exporte|j'ai copie|j'ai deplace|est maintenant terminee?|est terminee?|est maintenant rempli\w*|est maintenant vide|est desormais vide|est maintenant a jour|tout semble etre a jour|tout est a jour|contient desormais|ont ete ajoute\w*|ont ete importe\w*|a ete mis a jour|a ete efface\w*)\b/i;

export async function runTeacherDelmasAgentLoop(
  params: RunTeacherDelmasAgentParams
): Promise<RunTeacherDelmasAgentResult> {
  const {
    models,
    systemPrompt,
    conversationMessages,
    userPrompt,
    sheetContext,
    attachedFiles = [],
    recentUserMessages = [],
    allowActions,
    db,
    userId,
    requester,
    stripReasoning,
  } = params;

  const collectedActions: DelmasActionItem[] = [];
  const shadowStudents = new Set<string>(
    (sheetContext?.students || [])
      .map((s) => normalizeStr(s.name))
      .filter(Boolean)
  );
  let shadowNoteColCount = sheetContext?.noteColumns?.length ?? 2;

  const expectedSpreadsheetNames = extractSpreadsheetExpectedNames(attachedFiles);
  const normUserPrompt = normalizeStr(userPrompt);
  const userRequestedSubset =
    /\b(seulement|uniquement|sauf|hormis|juste\s+(?:les\s+)?\d+|les\s+\d+\s+premiers?|top\s+\d+|filtre\w*|only\s+\d+|except)\b/i.test(
      normUserPrompt
    );
  const userAuthorizedDestructive =
    DESTRUCTIVE_INTENT_REGEX.test(normUserPrompt) ||
    recentUserMessages.some((m) => DESTRUCTIVE_INTENT_REGEX.test(normalizeStr(m)));
  const userAuthorizedDedup =
    userAuthorizedDestructive ||
    /\b(doublon\w*|double\w*|dedoubl\w*|fusionn\w*|merge|dedup\w*)\b/i.test(normUserPrompt);
  let unsupportedReported = false;

  const tools: RegisteredAgentTool[] = [];

  // 0. Outil d'honnêteté absolue : signaler clairement une demande impossible sans jamais mentir
  tools.push({
    name: "report_unsupported_request",
    description:
      "À appeler IMMÉDIATEMENT lorsqu'une demande de l'utilisateur est réellement IMPOSSIBLE depuis ce tableau (ex: créer/supprimer une école/classe/trimestre/autre matière, modifier une autre matière non ouverte, modifier une moyenne auto-calculée dans Moyenne Générale, prendre/générer/ajouter une vraie photo de profil élève, envoyer un email/SMS/WhatsApp, modifier un fichier sur le disque de l'utilisateur). Garantit une réponse 100 % honnête sans jamais mentir.",
    parameters: {
      type: "object",
      properties: {
        capability: {
          type: "string",
          description: "Action demandée qui est hors de portée de ce menu.",
        },
        reason: {
          type: "string",
          description: "Raison technique ou fonctionnelle précise.",
        },
        manualAlternative: {
          type: "string",
          description: "Étape manuelle exacte ou alternative la plus proche que l'utilisateur peut faire.",
        },
      },
      required: ["capability", "reason", "manualAlternative"],
    },
    schema: z.object({
      capability: z.string().min(1),
      reason: z.string().min(1),
      manualAlternative: z.string().min(1),
    }),
    execute: ({ capability, reason, manualAlternative }) => {
      unsupportedReported = true;
      return {
        ok: true,
        summary: `Limite honnête signalée (${capability})`,
        data: { capability, reason, manualAlternative },
        instruction:
          "Explique directement et honnêtement à l'utilisateur en 1 à 2 phrases pourquoi tu ne peux pas faire cette action ici, et donne-lui l'alternative manuelle exacte. Ne prétends JAMAIS l'avoir faite.",
      };
    },
  });

  // 1. Outil de lecture : inspecter le tableau actif + fichiers joints
  tools.push({
    name: "inspect_sheet_and_files",
    description:
      "Lit l'état actuel vérifié du tableau ouvert (nombre d'élèves, colonnes, réglages) et la liste complète des fichiers joints (Excel/CSV/PDF/images).",
    parameters: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "Nom optionnel d'un fichier joint dont on veut relire le contenu intégral.",
        },
      },
      required: [],
    },
    schema: z.object({
      fileName: z.string().optional(),
    }),
    execute: ({ fileName }) => {
      const matchedFile = fileName
        ? attachedFiles.find((f) => normalizeStr(f.fileName).includes(normalizeStr(fileName)))
        : attachedFiles[attachedFiles.length - 1];
      return {
        ok: true,
        summary: `État lu (${shadowStudents.size} élève(s), ${attachedFiles.length} fichier(s))`,
        data: {
          sheetKind: sheetContext?.sheetKind || "subject",
          subjectName: sheetContext?.subjectName || null,
          className: sheetContext?.className || null,
          namedStudentsCount: shadowStudents.size,
          noteColumnsCount: shadowNoteColCount,
          sortMode: sheetContext?.sortMode || "order",
          averageScale: sheetContext?.averageScale || 20,
          showMatricule: Boolean(sheetContext?.showMatricule),
          attachedFiles: attachedFiles.map((f) => ({
            fileName: f.fileName,
            fileType: f.fileType || "document",
            chars: (f.extractedText || "").length,
          })),
          expectedSpreadsheetStudentsCount: expectedSpreadsheetNames.length,
          ...(matchedFile
            ? {
                selectedFileContent: String(matchedFile.extractedText || "").slice(0, 45000),
              }
            : {}),
        },
      };
    },
  });

  // 2. Outil de lecture D1 : consulter une autre matière de la classe en lecture seule
  if (db && userId && userId !== "default-user" && sheetContext?.classId) {
    tools.push({
      name: "query_other_subject_d1",
      description:
        "Lit les élèves et notes d'une autre matière de la même classe directement depuis la base D1 (lecture seule, pour comparer ou répondre à une question).",
      parameters: {
        type: "object",
        properties: {
          subjectName: {
            type: "string",
            description: "Nom de l'autre matière recherchée (ex: Physique, Français).",
          },
        },
        required: ["subjectName"],
      },
      schema: z.object({
        subjectName: z.string().min(1),
      }),
      execute: async ({ subjectName }) => {
        try {
          const subjRows = await db
            .prepare(
              `SELECT id, name, coefficient FROM teacher_subjects WHERE user_id = ? AND class_id = ?`
            )
            .bind(userId, sheetContext.classId)
            .all();
          const list = Array.isArray(subjRows?.results) ? subjRows.results : [];
          const needle = normalizeStr(subjectName);
          const found = list.find(
            (s: any) =>
              normalizeStr(s.name) === needle || normalizeStr(s.name).includes(needle)
          );
          if (!found) {
            return {
              ok: false,
              error: `Matière « ${subjectName} » introuvable dans cette classe.`,
              data: { availableSubjects: list.map((s: any) => s.name) },
            };
          }
          const stRows = await db
            .prepare(
              `SELECT full_name, matricule, notes_json FROM teacher_gradebook_students WHERE user_id = ? AND subject_id = ? ORDER BY row_order ASC LIMIT 120`
            )
            .bind(userId, found.id)
            .all();
          const students = (Array.isArray(stRows?.results) ? stRows.results : []).map((r: any) => ({
            name: r.full_name,
            matricule: r.matricule || "",
            notes: (() => {
              try {
                return JSON.parse(r.notes_json || "[]");
              } catch {
                return [];
              }
            })(),
          }));
          return {
            ok: true,
            summary: `${students.length} élève(s) lus dans ${found.name} (D1)`,
            data: { subjectName: found.name, coefficient: found.coefficient, students },
          };
        } catch (err: any) {
          return { ok: false, error: err?.message || "Erreur lecture D1" };
        }
      },
    });
  }

  // Outils d'écriture activés UNIQUEMENT si allowActions est vrai
  if (allowActions) {
    const studentEntrySchema = z.object({
      name: z.string().min(1, "Nom d'élève requis").optional(),
      matchName: z.string().optional(),
      newName: z.string().optional(),
      studentId: z.string().optional(),
      rowIndex: z.number().int().positive().optional(),
      matricule: z.string().max(48).optional(),
      deltaAverage: z.number().min(-1000).max(1000).optional(),
      targetAverage: z.number().min(0).max(1000).optional(),
      viaColNumber: z.number().int().min(1).max(30).optional(),
      notes: z
        .union([
          z.array(z.union([z.string(), z.number(), z.null()])),
          z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
        ])
        .optional(),
    });

    // 3. Ajout / mise à jour / remplacement d'élèves (avec contrôle anti-import incomplet !)
    tools.push({
      name: "add_or_update_students",
      description:
        "Ajoute, met à jour ou remplace des élèves et leurs notes dans le tableau actif (matchName accepte aussi les ordinaux '1er', '2e', 'dernier' ; les notes acceptent les décalages relatifs '+1', '-0.5'). OBLIGATOIRE : lors d'un import depuis un fichier (Excel, CSV, image, PDF), inclure 100 % de TOUS les élèves du fichier sans jamais tronquer ni échantillonner.",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["add", "update", "replace"],
            description: "add = ajouter nouveaux élèves, update = modifier élèves existants, replace = remplacer toute la liste.",
          },
          students: {
            type: "array",
            description: "Liste complète des élèves à ajouter ou modifier.",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                matchName: { type: "string", description: "Nom existant ou ordinal ('1er', '2e', 'dernier')." },
                newName: { type: "string" },
                studentId: { type: "string" },
                rowIndex: { type: "number" },
                matricule: { type: "string" },
                deltaAverage: { type: "number" },
                targetAverage: { type: "number" },
                viaColNumber: { type: "number" },
                notes: {
                  description:
                    'Tableau de notes ["15", "14.5"] ou objet indexé par n° de note {"1": "16", "3": "+1.5"}.',
                },
              },
            },
          },
        },
        required: ["mode", "students"],
      },
      schema: z.object({
        mode: z.enum(["add", "update", "replace"]),
        students: z.array(studentEntrySchema).min(1, "Fournis au moins un élève").max(300),
      }),
      execute: ({ mode, students }) => {
        if (sheetContext?.sheetKind && sheetContext.sheetKind !== "subject") {
          return {
            ok: false,
            error:
              "Ce tableau est un tableau de moyenne générale calculé automatiquement ; on ne peut pas y ajouter/modifier des élèves directement.",
          };
        }
        if (mode === "replace" && !userAuthorizedDestructive) {
          return {
            ok: false,
            error: "Remplacement complet refusé car l'utilisateur n'a pas demandé d'écraser le tableau.",
            instruction: "Utilise mode='add' ou mode='update' à la place.",
          };
        }

        // Vérification anti-import incomplet par rapport au fichier Excel/CSV joint !
        if (
          (mode === "add" || mode === "replace") &&
          !userRequestedSubset &&
          expectedSpreadsheetNames.length >= 3 &&
          students.length < expectedSpreadsheetNames.length
        ) {
          const submittedSet = new Set(
            students.map((s) => normalizeStr(s.name || s.matchName || s.newName || "")).filter(Boolean)
          );
          const expectedSet = new Set(expectedSpreadsheetNames.map((n) => normalizeStr(n)));
          const matchesSpreadsheet = Array.from(submittedSet).some((n) => expectedSet.has(n));
          if (matchesSpreadsheet) {
            const missing = expectedSpreadsheetNames.filter(
              (n) => !submittedSet.has(normalizeStr(n)) && !shadowStudents.has(normalizeStr(n))
            );
            if (missing.length > 0) {
              return {
                ok: false,
                error: `IMPORT INCOMPLET DÉTECTÉ : tu n'as fourni que ${students.length} élève(s) alors que le fichier en contient ${expectedSpreadsheetNames.length} !`,
                data: {
                  submittedCount: students.length,
                  expectedCount: expectedSpreadsheetNames.length,
                  missingStudents: missing.slice(0, 40),
                },
                instruction:
                  "Appelle à nouveau add_or_update_students avec 100 % de TOUS les élèves du fichier et toutes leurs notes, sans en oublier un seul.",
              };
            }
          }
        }

        const normalizedItems = students.map((s) => ({
          ...s,
          name: s.name || s.matchName || s.newName || "",
          notes: s.notes,
        }));

        if (mode === "replace") {
          shadowStudents.clear();
          normalizedItems.forEach((s) => {
            const k = normalizeStr(s.name);
            if (k) shadowStudents.add(k);
          });
          collectedActions.push({ type: "set_students", students: normalizedItems });
        } else if (mode === "update") {
          normalizedItems.forEach((s) => {
            const k = normalizeStr(s.newName || s.name || s.matchName);
            if (k) shadowStudents.add(k);
          });
          collectedActions.push({
            type: "update_students",
            updates: normalizedItems.map((s) => ({
              ...s,
              matchName: s.matchName || s.name,
            })),
          });
        } else {
          normalizedItems.forEach((s) => {
            const k = normalizeStr(s.name);
            if (k) shadowStudents.add(k);
          });
          collectedActions.push({ type: "add_students", students: normalizedItems });
        }

        return {
          ok: true,
          summary: `${normalizedItems.length} élève(s) validés (${mode})`,
          data: {
            mode,
            appliedCount: normalizedItems.length,
            totalStudentsInSheet: shadowStudents.size,
            verifiedComplete: true,
          },
        };
      },
    });

    // 4. Effacement / suppression ciblée ou totale (avec pare-feu anti-injection)
    tools.push({
      name: "clear_table_data",
      description:
        "Efface tout le tableau ou un champ précis (notes/moyennes, noms, photos, matricules, mise en forme, lignes vides ou élèves précis).",
      parameters: {
        type: "object",
        properties: {
          scope: {
            type: "string",
            enum: [
              "all",
              "notes",
              "names",
              "photos",
              "matricules",
              "formatting",
              "empty_rows",
              "specific_students",
            ],
          },
          colNumber: {
            type: "number",
            description: "Numéro de colonne (1, 2...) si scope='notes' sur une seule colonne.",
          },
          studentName: {
            type: "string",
            description: "Nom d'un élève précis si l'effacement ne concerne qu'un seul élève.",
          },
          studentNames: {
            type: "array",
            items: { type: "string" },
            description: "Liste des élèves à supprimer si scope='specific_students'.",
          },
        },
        required: ["scope"],
      },
      schema: z.object({
        scope: z.enum([
          "all",
          "notes",
          "names",
          "photos",
          "matricules",
          "formatting",
          "empty_rows",
          "specific_students",
        ]),
        colNumber: z.number().int().min(1).max(30).optional(),
        studentName: z.string().optional(),
        studentNames: z.array(z.string().min(1)).optional(),
      }),
      execute: ({ scope, colNumber, studentName, studentNames }) => {
        if (!userAuthorizedDestructive) {
          return {
            ok: false,
            error:
              "Action destructive bloquée par le pare-feu anti-injection : l'utilisateur n'a pas demandé d'effacer ou supprimer de données.",
          };
        }
        const patch = studentName ? { studentName } : {};
        if (scope === "all") {
          shadowStudents.clear();
          collectedActions.push({ type: "clear_all" });
        } else if (scope === "notes") {
          collectedActions.push(
            colNumber
              ? { type: "clear_notes", mode: "specific", colNumber, ...patch }
              : { type: "clear_notes", mode: "all", ...patch }
          );
        } else if (scope === "names") {
          collectedActions.push({ type: "clear_names", ...patch });
        } else if (scope === "photos") {
          collectedActions.push({ type: "clear_photos", ...patch });
        } else if (scope === "matricules") {
          collectedActions.push({ type: "clear_matricules", ...patch });
        } else if (scope === "formatting") {
          collectedActions.push({ type: "clear_formatting", ...patch });
        } else if (scope === "empty_rows") {
          collectedActions.push({ type: "remove_students", removeEmpty: true });
        } else if (scope === "specific_students") {
          const names = studentNames?.length ? studentNames : studentName ? [studentName] : [];
          if (names.length === 0) {
            return {
              ok: false,
              error: "Précise studentNames ou studentName pour supprimer un élève.",
            };
          }
          names.forEach((n) => shadowStudents.delete(normalizeStr(n)));
          collectedActions.push({ type: "remove_students", names });
        }
        return {
          ok: true,
          summary: `Effacement validé (${scope})`,
          data: { scope, studentsRemaining: shadowStudents.size },
        };
      },
    });

    // 4B. Outil dédié ultra-précis : Modifier/Ajuster la MOYENNE ou une/plusieurs NOTES (élève précis, ordinal 1er/dernier, condition, repêchage, %, arrondi, plancher/plafond)
    tools.push({
      name: "adjust_grades_or_average",
      description:
        "OUTIL PRIORITAIRE pour modifier la MOYENNE d'un ou plusieurs élèves (ex: +1 pt sur la moyenne du 1er, diminuer la moyenne d'un élève, fixer une moyenne cible à 15, repêcher à 10 ceux entre 9.5 et 9.99) OU pour ajuster des NOTES précises ou globales (ex: augmenter/diminuer la note 3 du 1er, +10%, arrondir au demi-point, fixer un plancher/plafond).",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["adjust_student_average", "adjust_grades"],
            description:
              "adjust_student_average = ajuster/cibler la moyenne d'un ou plusieurs élèves (recalcule les notes sous-jacentes) ; adjust_grades = ajuster directement une ou plusieurs colonnes de notes (± points, %, arrondi, plancher/plafond).",
          },
          studentName: {
            type: "string",
            description: "Nom d'un élève ou ordinal ('1er', 'premier', '2e', '3e', 'dernier', 'major').",
          },
          studentNames: { type: "array", items: { type: "string" } },
          rowIndex: { type: "number", description: "Numéro de ligne visuel (1-based)." },
          rowIndices: { type: "array", items: { type: "number" } },
          condition: {
            type: "string",
            enum: [
              "average_below",
              "average_above",
              "average_between",
              "note_below",
              "note_above",
              "rank_top",
              "rank_bottom",
              "mention_equals",
              "empty_notes",
            ],
          },
          threshold: { type: "number" },
          minThreshold: { type: "number" },
          maxThreshold: { type: "number" },
          mentionLabel: { type: "string" },
          mode: { type: "string", enum: ["all", "specific"] },
          colNumber: { type: "number", description: "Numéro de colonne de note ciblée (1-based, ex: 3 pour Note 3)." },
          colNumbers: { type: "array", items: { type: "number" } },
          viaColNumber: {
            type: "number",
            description: "Pour adjust_student_average : colonne précise à modifier pour atteindre la nouvelle moyenne (ex: 3 pour ajuster via Note 3).",
          },
          delta: { type: "number", description: "Décalage en points sur les notes (ex: +1, -1.5)." },
          deltaAverage: { type: "number", description: "Décalage en points sur la moyenne (ex: +1, -0.5)." },
          targetAverage: { type: "number", description: "Moyenne cible exacte à atteindre (ex: 15 ou 10 pour un repêchage)." },
          percent: { type: "number", description: "Variation en pourcentage (ex: +10 pour +10%, -5 pour -5%)." },
          factor: { type: "number", description: "Multiplicateur direct (ex: 1.1)." },
          roundStep: { type: "number", description: "Pas d'arrondi (ex: 0.5 pour demi-point, 0.25, 1 pour entier)." },
          roundMode: { type: "string", enum: ["nearest", "up", "down"] },
          minClamp: { type: "number", description: "Note plancher minimale." },
          maxClamp: { type: "number", description: "Note plafond maximale." },
        },
        required: ["operation"],
      },
      schema: z.object({
        operation: z.enum(["adjust_student_average", "adjust_grades"]),
        studentName: z.string().optional(),
        studentNames: z.array(z.string()).optional(),
        rowIndex: z.number().int().positive().optional(),
        rowIndices: z.array(z.number().int().positive()).optional(),
        condition: z
          .enum([
            "average_below",
            "average_above",
            "average_between",
            "note_below",
            "note_above",
            "rank_top",
            "rank_bottom",
            "mention_equals",
            "empty_notes",
          ])
          .optional(),
        threshold: z.number().optional(),
        minThreshold: z.number().optional(),
        maxThreshold: z.number().optional(),
        mentionLabel: z.string().optional(),
        mode: z.enum(["all", "specific"]).optional(),
        colNumber: z.number().int().min(1).max(30).optional(),
        colNumbers: z.array(z.number().int().min(1).max(30)).optional(),
        viaColNumber: z.number().int().min(1).max(30).optional(),
        delta: z.number().min(-1000).max(1000).optional(),
        deltaAverage: z.number().min(-1000).max(1000).optional(),
        targetAverage: z.number().min(0).max(1000).optional(),
        percent: z.number().min(-100).max(500).optional(),
        factor: z.number().min(0.05).max(10).optional(),
        roundStep: z.number().positive().max(10).optional(),
        roundMode: z.enum(["nearest", "up", "down"]).optional(),
        minClamp: z.number().min(0).max(1000).optional(),
        maxClamp: z.number().min(0).max(1000).optional(),
      }),
      execute: (args) => {
        if (sheetContext?.sheetKind && sheetContext.sheetKind !== "subject") {
          return {
            ok: false,
            error:
              "Ce tableau est une Moyenne Générale calculée automatiquement depuis vos matières : pour ajuster des notes ou une moyenne de matière existante, l'utilisateur doit ouvrir la feuille de matière concernée.",
            instruction:
              "Appelle report_unsupported_request si la cellule est déjà calculée automatiquement, ou utilise edit_general_average_sheet s'il s'agit d'une case vide.",
          };
        }
        const hasMathOp =
          args.delta !== undefined ||
          args.deltaAverage !== undefined ||
          args.targetAverage !== undefined ||
          args.percent !== undefined ||
          args.factor !== undefined ||
          args.roundStep !== undefined ||
          args.minClamp !== undefined ||
          args.maxClamp !== undefined;
        if (!hasMathOp) {
          return {
            ok: false,
            error:
              "Précise au moins un paramètre mathématique (deltaAverage, targetAverage, delta, percent, roundStep, minClamp ou maxClamp).",
          };
        }
        const { operation, ...rest } = args;
        collectedActions.push({ type: operation, ...rest });
        return {
          ok: true,
          summary: `Ajustement validé (${operation})`,
          data: {
            operation,
            target: args.studentName || args.condition || "all",
            colNumber: args.colNumber ?? args.viaColNumber ?? null,
          },
        };
      },
    });

    // 4C. Gestion des lignes, doublons et casse des noms (ajouter lignes vides, fusionner doublons, MAJUSCULES/Minuscules/Title Case)
    tools.push({
      name: "manage_rows_and_names",
      description:
        "Ajoute des lignes vides en bas du tableau, supprime/fusionne automatiquement les élèves en doublon (même nom), ou formate les noms d'élèves (MAJUSCULES, Majuscule Initiale, minuscules, nettoyage des espaces).",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: ["add_empty_rows", "deduplicate_students", "format_student_names"],
          },
          count: { type: "number", description: "Nombre de lignes vides à ajouter (1 à 100)." },
          formatMode: {
            type: "string",
            enum: ["uppercase", "titlecase", "lowercase", "trim"],
            description: "Pour format_student_names.",
          },
          studentName: { type: "string" },
          studentNames: { type: "array", items: { type: "string" } },
        },
        required: ["operation"],
      },
      schema: z.object({
        operation: z.enum(["add_empty_rows", "deduplicate_students", "format_student_names"]),
        count: z.number().int().min(1).max(100).optional(),
        formatMode: z.enum(["uppercase", "titlecase", "lowercase", "trim"]).optional(),
        studentName: z.string().optional(),
        studentNames: z.array(z.string()).optional(),
      }),
      execute: (args) => {
        if (sheetContext?.sheetKind && sheetContext.sheetKind !== "subject") {
          return {
            ok: false,
            error: "Cette opération s'applique uniquement dans un tableau de matière.",
          };
        }
        if (args.operation === "deduplicate_students" && !userAuthorizedDedup) {
          return {
            ok: false,
            error: "Suppression de doublons refusée car l'utilisateur ne l'a pas demandée.",
          };
        }
        if (args.operation === "format_student_names") {
          collectedActions.push({
            type: "format_student_names",
            mode: args.formatMode || "uppercase",
            ...(args.studentName ? { studentName: args.studentName } : {}),
            ...(args.studentNames ? { studentNames: args.studentNames } : {}),
          });
        } else if (args.operation === "add_empty_rows") {
          collectedActions.push({ type: "add_empty_rows", count: args.count || 5 });
        } else {
          collectedActions.push({ type: "deduplicate_students" });
        }
        return {
          ok: true,
          summary: `Opération validée (${args.operation})`,
        };
      },
    });

    // 4D. Édition autorisée dans Moyenne Générale (cases vides uniquement, matricules, fusion de deux doublons)
    if (sheetContext?.sheetKind && sheetContext.sheetKind !== "subject") {
      tools.push({
        name: "edit_general_average_sheet",
        description:
          "Dans un tableau de Moyenne Générale (trimestrielle ou annuelle) : renseigne ou efface une moyenne manuelle sur une case VIDE, met à jour le matricule d'un élève, ou fusionne deux lignes doublons d'un même élève.",
        parameters: {
          type: "object",
          properties: {
            operation: {
              type: "string",
              enum: ["set_cell", "clear_cell", "set_matricule", "merge_students"],
            },
            studentName: { type: "string" },
            rowIndex: { type: "number" },
            subjectName: { type: "string" },
            termName: { type: "string" },
            value: { type: "number" },
            matricule: { type: "string" },
            secondaryStudentName: { type: "string" },
          },
          required: ["operation", "studentName"],
        },
        schema: z.object({
          operation: z.enum(["set_cell", "clear_cell", "set_matricule", "merge_students"]),
          studentName: z.string().min(1),
          rowIndex: z.number().int().positive().optional(),
          subjectName: z.string().optional(),
          termName: z.string().optional(),
          value: z.number().min(0).max(1000).optional(),
          matricule: z.string().max(48).optional(),
          secondaryStudentName: z.string().optional(),
        }),
        execute: (args) => {
          collectedActions.push({ type: "set_general_average_override", ...args });
          return {
            ok: true,
            summary: `Modification Moyenne Générale validée (${args.operation})`,
          };
        },
      });
    }

    // 5. Colonnes de notes, barèmes & déplacements
    tools.push({
      name: "manage_columns_and_grades",
      description:
        "Gère les colonnes de notes (ajouter, renommer, supprimer, échanger, déplacer, remplir une colonne ou copier une colonne/moyenne), change le barème max des notes (/20, /40...), déplace un élève ou copie les élèves d'une autre matière.",
      parameters: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: [
              "add_note_column",
              "update_note_column",
              "delete_note_column",
              "swap_note_columns",
              "move_note_column",
              "fill_note_column",
              "adjust_grades",
              "bulk_update_note_max",
              "move_student",
              "copy_students_from_subject",
            ],
          },
          title: { type: "string" },
          maxScore: { type: "number" },
          coeffEval: { type: "number" },
          count: { type: "number" },
          colNumber: { type: "number" },
          colNumbers: { type: "array", items: { type: "number" } },
          colNumber1: { type: "number" },
          colNumber2: { type: "number" },
          fromColNumber: { type: "number" },
          toColNumber: { type: "number" },
          copyFromColNumber: { type: "number" },
          fromAverage: { type: "boolean" },
          direction: { type: "string", enum: ["left", "right", "up", "down"] },
          value: { type: "string" },
          onlyEmpty: { type: "boolean" },
          mode: { type: "string", enum: ["all", "specific"] },
          delta: { type: "number" },
          percent: { type: "number" },
          roundStep: { type: "number" },
          roundMode: { type: "string", enum: ["nearest", "up", "down"] },
          minClamp: { type: "number" },
          maxClamp: { type: "number" },
          convertExisting: { type: "boolean" },
          studentName: { type: "string" },
          studentNames: { type: "array", items: { type: "string" } },
          condition: { type: "string" },
          threshold: { type: "number" },
          minThreshold: { type: "number" },
          maxThreshold: { type: "number" },
          rowIndex: { type: "number" },
          toRowIndex: { type: "number" },
          sourceSubjectName: { type: "string" },
          includeNotes: { type: "boolean" },
        },
        required: ["operation"],
      },
      schema: z.object({
        operation: z.enum([
          "add_note_column",
          "update_note_column",
          "delete_note_column",
          "swap_note_columns",
          "move_note_column",
          "fill_note_column",
          "adjust_grades",
          "bulk_update_note_max",
          "move_student",
          "copy_students_from_subject",
        ]),
        title: z.string().optional(),
        maxScore: z.number().positive().max(1000).optional(),
        coeffEval: z.number().positive().max(100).optional(),
        count: z.number().int().min(1).max(15).optional(),
        colNumber: z.number().int().min(1).max(30).optional(),
        colNumbers: z.array(z.number().int().min(1).max(30)).optional(),
        colNumber1: z.number().int().min(1).max(30).optional(),
        colNumber2: z.number().int().min(1).max(30).optional(),
        fromColNumber: z.number().int().min(1).max(30).optional(),
        toColNumber: z.number().int().min(1).max(30).optional(),
        copyFromColNumber: z.number().int().min(1).max(30).optional(),
        fromAverage: z.boolean().optional(),
        direction: z.enum(["left", "right", "up", "down"]).optional(),
        value: z.union([z.string(), z.number()]).optional(),
        onlyEmpty: z.boolean().optional(),
        mode: z.enum(["all", "specific"]).optional(),
        delta: z.number().min(-1000).max(1000).optional(),
        percent: z.number().min(-100).max(500).optional(),
        roundStep: z.number().positive().max(10).optional(),
        roundMode: z.enum(["nearest", "up", "down"]).optional(),
        minClamp: z.number().min(0).max(1000).optional(),
        maxClamp: z.number().min(0).max(1000).optional(),
        convertExisting: z.boolean().optional(),
        studentName: z.string().optional(),
        studentNames: z.array(z.string()).optional(),
        condition: z.string().optional(),
        threshold: z.number().optional(),
        minThreshold: z.number().optional(),
        maxThreshold: z.number().optional(),
        rowIndex: z.number().int().positive().optional(),
        toRowIndex: z.number().int().positive().optional(),
        sourceSubjectName: z.string().optional(),
        includeNotes: z.boolean().optional(),
      }),
      execute: (args) => {
        if (args.operation === "delete_note_column" && !userAuthorizedDestructive) {
          return { ok: false, error: "Suppression de colonne non autorisée sans demande explicite." };
        }
        const { operation, ...rest } = args;
        if (operation === "add_note_column") {
          shadowNoteColCount += args.count || 1;
        }
        collectedActions.push({ type: operation, ...rest });
        return {
          ok: true,
          summary: `Opération validée (${operation})`,
          data: { operation, noteColumnsCount: shadowNoteColCount },
        };
      },
    });

    // 6. Mise en forme complète (couleurs, polices, tailles, gras/italique/souligné/barré, alignement, conditions)
    tools.push({
      name: "format_cells",
      description:
        "Applique une mise en forme (couleurs texte/fond, police, taille, gras, italique, souligné, barré, alignement) sur tout le tableau, les en-têtes, un élève, une colonne ou selon condition.",
      parameters: {
        type: "object",
        properties: {
          target: { type: "string", enum: ["all", "header", "student", "column", "condition"] },
          studentName: { type: "string" },
          studentNames: { type: "array", items: { type: "string" } },
          rowIndex: { type: "number" },
          column: {
            type: "string",
            enum: ["all", "rank", "photo", "matricule", "name", "note", "subject", "term", "total", "average", "mention"],
          },
          colNumber: { type: "number" },
          colNumbers: { type: "array", items: { type: "number" } },
          includeHeader: { type: "boolean" },
          condition: {
            type: "string",
            enum: [
              "average_below",
              "average_above",
              "average_between",
              "note_below",
              "note_above",
              "rank_top",
              "rank_bottom",
              "mention_equals",
              "alternating_rows",
            ],
          },
          threshold: { type: "number" },
          minThreshold: { type: "number" },
          maxThreshold: { type: "number" },
          mentionLabel: { type: "string" },
          style: {
            type: "object",
            properties: {
              bold: { type: "boolean" },
              italic: { type: "boolean" },
              underline: { type: "boolean" },
              strikethrough: { type: "boolean" },
              textColor: { type: "string" },
              bgColor: { type: "string" },
              fontFamily: { type: "string" },
              fontSize: { type: "number" },
              fontSizeDelta: { type: "number" },
              textAlign: { type: "string", enum: ["left", "center", "right"] },
            },
          },
        },
        required: ["target", "style"],
      },
      schema: z.object({
        target: z.enum(["all", "header", "student", "column", "condition"]),
        studentName: z.string().optional(),
        studentNames: z.array(z.string()).optional(),
        rowIndex: z.number().int().positive().optional(),
        column: z
          .enum(["all", "rank", "photo", "matricule", "name", "note", "subject", "term", "total", "average", "mention"])
          .optional(),
        colNumber: z.number().int().min(1).max(30).optional(),
        colNumbers: z.array(z.number().int().min(1).max(30)).optional(),
        includeHeader: z.boolean().optional(),
        condition: z
          .enum([
            "average_below",
            "average_above",
            "average_between",
            "note_below",
            "note_above",
            "rank_top",
            "rank_bottom",
            "mention_equals",
            "alternating_rows",
          ])
          .optional(),
        threshold: z.number().optional(),
        minThreshold: z.number().optional(),
        maxThreshold: z.number().optional(),
        mentionLabel: z.string().optional(),
        style: z.object({
          bold: z.boolean().optional(),
          italic: z.boolean().optional(),
          underline: z.boolean().optional(),
          strikethrough: z.boolean().optional(),
          textColor: z.string().optional(),
          bgColor: z.string().optional(),
          fontFamily: z.string().optional(),
          fontSize: z.number().min(8).max(48).optional(),
          fontSizeDelta: z.number().min(-24).max(24).optional(),
          textAlign: z.enum(["left", "center", "right"]).optional(),
        }),
      }),
      execute: (args) => {
        collectedActions.push({ type: "format_cells", ...args });
        return {
          ok: true,
          summary: `Mise en forme validée (${args.target})`,
          data: { target: args.target, column: args.column || "all" },
        };
      },
    });

    // 7. Réglages, tri, disposition des colonnes, redimensionnement, zoom, plein écran, coefficients
    tools.push({
      name: "configure_sheet_settings",
      description:
        "Configure les réglages du tableau : tri, matricule, barème moyenne, ordre des colonnes, mentions, largeurs/hauteurs, zoom, plein écran, coefficient matière/trimestre, undo/redo/save.",
      parameters: {
        type: "object",
        properties: {
          settingType: {
            type: "string",
            enum: [
              "set_sort_mode",
              "set_show_matricule",
              "set_average_scale",
              "set_column_order",
              "set_mention_rules",
              "resize_columns",
              "resize_rows",
              "reset_column_widths",
              "set_zoom",
              "set_expand_level",
              "set_subject_coefficient",
              "set_term_coefficient",
              "undo",
              "redo",
              "save_gradebook",
            ],
          },
          sortMode: { type: "string", enum: ["merit", "alpha", "alpha_desc", "order"] },
          show: { type: "boolean" },
          scale: { type: "number" },
          scope: { type: "string", enum: ["sheet", "class"] },
          moveColumn: { type: "string" },
          relation: { type: "string", enum: ["before", "after", "start", "end"] },
          anchor: { type: "string" },
          preset: { type: "string" },
          reset: { type: "boolean" },
          rules: {
            type: "array",
            items: {
              type: "object",
              properties: { min: { type: "number" }, label: { type: "string" } },
            },
          },
          column: { type: "string" },
          colNumber: { type: "number" },
          widthPx: { type: "number" },
          deltaPx: { type: "number" },
          scaleFactor: { type: "number" },
          target: { type: "string", enum: ["all", "student", "row"] },
          studentName: { type: "string" },
          rowIndex: { type: "number" },
          heightPx: { type: "number" },
          zoomPercent: { type: "number" },
          level: { type: "number", enum: [0, 1, 2] },
          subjectName: { type: "string" },
          termName: { type: "string" },
          coefficient: { type: "number" },
        },
        required: ["settingType"],
      },
      schema: z.object({
        settingType: z.enum([
          "set_sort_mode",
          "set_show_matricule",
          "set_average_scale",
          "set_column_order",
          "set_mention_rules",
          "resize_columns",
          "resize_rows",
          "reset_column_widths",
          "set_zoom",
          "set_expand_level",
          "set_subject_coefficient",
          "set_term_coefficient",
          "undo",
          "redo",
          "save_gradebook",
        ]),
        sortMode: z.enum(["merit", "alpha", "alpha_desc", "order"]).optional(),
        show: z.boolean().optional(),
        scale: z.number().positive().max(1000).optional(),
        scope: z.enum(["sheet", "class"]).optional(),
        moveColumn: z.string().optional(),
        relation: z.enum(["before", "after", "start", "end"]).optional(),
        anchor: z.string().optional(),
        preset: z.string().optional(),
        reset: z.boolean().optional(),
        rules: z.array(z.object({ min: z.number(), label: z.string().min(1) })).optional(),
        column: z.string().optional(),
        colNumber: z.number().int().min(1).max(30).optional(),
        widthPx: z.number().positive().max(900).optional(),
        deltaPx: z.number().min(-400).max(400).optional(),
        scaleFactor: z.number().min(0.4).max(3).optional(),
        target: z.enum(["all", "student", "row"]).optional(),
        studentName: z.string().optional(),
        rowIndex: z.number().int().positive().optional(),
        heightPx: z.number().min(28).max(300).optional(),
        zoomPercent: z.number().min(30).max(200).optional(),
        level: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
        subjectName: z.string().optional(),
        termName: z.string().optional(),
        coefficient: z.number().min(0.25).max(100).optional(),
      }),
      execute: (args) => {
        const { settingType, ...rest } = args;
        collectedActions.push({ type: settingType, ...rest });
        return {
          ok: true,
          summary: `Réglage validé (${settingType})`,
          data: { settingType },
        };
      },
    });

    // 8. Export & Copie
    tools.push({
      name: "export_or_copy_table",
      description: "Télécharge le tableau en Excel, PDF, Word ou le copie dans le presse-papiers.",
      parameters: {
        type: "object",
        properties: {
          format: { type: "string", enum: ["excel", "pdf", "word", "copy"] },
        },
        required: ["format"],
      },
      schema: z.object({
        format: z.enum(["excel", "pdf", "word", "copy"]),
      }),
      execute: ({ format }) => {
        const map: Record<string, string> = {
          excel: "export_excel",
          pdf: "export_pdf",
          word: "export_word",
          copy: "copy_table",
        };
        collectedActions.push({ type: map[format] });
        return {
          ok: true,
          summary: `Export/copie déclenché (${format})`,
        };
      },
    });
  }

  const toolLoopSystemPrompt = `${systemPrompt}

══════════════════════════════════════════════════════════════════════════════
[MODE AGENT OUTILS NATIFS ACTIF — PRIORITAIRE SUR <delmas_actions>] :
- Tu disposes de VRAIS outils typés et vérifiés (${tools.map((t) => t.name).join(", ")}).
- Pour agir sur le tableau, **APPELLE DIRECTEMENT LES OUTILS** (tu n'as PAS besoin d'écrire de balise texte <delmas_actions>).
- **MODIFIER UNE MOYENNE OU UNE NOTE SPÉCIFIQUE** : utilise \`adjust_grades_or_average\` !
  * Ex: « augmente de +1 la moyenne du 1er » → \`adjust_grades_or_average({ operation: "adjust_student_average", studentName: "1er", deltaAverage: 1 })\`
  * Ex: « diminue de 1,5 la note 3 du premier » → \`adjust_grades_or_average({ operation: "adjust_grades", studentName: "1er", mode: "specific", colNumber: 3, delta: -1.5 })\`
  * Ex: « repêche à 10 tous les élèves entre 9,5 et 9,99 » → \`adjust_grades_or_average({ operation: "adjust_student_average", condition: "average_between", minThreshold: 9.5, maxThreshold: 9.99, targetAverage: 10 })\`
  * Ex: « arrondis toutes les notes au demi-point supérieur » → \`adjust_grades_or_average({ operation: "adjust_grades", mode: "all", roundStep: 0.5, roundMode: "up" })\`
- **DEMANDE IMPOSSIBLE = HONNÊTETÉ ABSOLUE** : si l'utilisateur demande quelque chose d'impossible ici (créer/supprimer école/classe/trimestre/matière, modifier une autre matière non ouverte, modifier une moyenne auto-calculée dans Moyenne Générale, téléverser/générer une vraie photo de profil élève, envoyer un email/SMS/WhatsApp, éditer un fichier local sur son appareil), appelle \`report_unsupported_request\` et explique-le honnêtement en 1 à 2 phrases avec l'étape manuelle exacte.
- Tu peux appeler PLUSIEURS outils en parallèle ou en séquence dans cette boucle (multi-tâches simultanées).
- Si un outil renvoie \`ok: false\` (ex: import incomplet 2/10 élèves ou champ invalide), CORRIGE immédiatement en rappelant l'outil avec les données complètes avant de répondre !
- Ne dis JAMAIS « J'ai fait » ou « C'est terminé » sans avoir réellement appelé un outil d'action qui a renvoyé \`ok: true\`.
- Une fois tes outils terminés avec \`ok: true\`, réponds en **1 SEULE PHRASE COURTE au passé composé** (zéro tableau Markdown, zéro question inutile à la fin).
══════════════════════════════════════════════════════════════════════════════`;

  const initialMessages: any[] = [
    { role: "system", content: toolLoopSystemPrompt },
    ...conversationMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const loopRes = await runAgentToolLoop({
    models,
    initialMessages,
    tools,
    maxSteps: 5,
    maxTokens: 8192,
    firstStepToolChoice: "auto",
    requester,
    stripReasoning,
    onBeforeFinish: ({ finalText }) => {
      if (
        allowActions &&
        !unsupportedReported &&
        collectedActions.length === 0 &&
        UNFULFILLED_CLAIM_REGEX.test(normalizeStr(finalText))
      ) {
        return "ATTENTION : tu viens d'affirmer avoir modifié le tableau mais tu n'as appelé AUCUN outil d'action ! Appelle immédiatement l'outil approprié (ou report_unsupported_request si l'action est réellement impossible) puis réponds honnêtement en 1 phrase courte.";
      }
      return null;
    },
  });

  return {
    supported: loopRes.supported,
    modelUsed: loopRes.modelUsed,
    finalText: loopRes.finalText,
    structuredActions: collectedActions,
    stepsUsed: loopRes.stepsUsed,
    toolTrace: loopRes.toolTrace,
    totalPromptChars: loopRes.totalPromptChars,
    totalCompletionChars: loopRes.totalCompletionChars,
  };
}

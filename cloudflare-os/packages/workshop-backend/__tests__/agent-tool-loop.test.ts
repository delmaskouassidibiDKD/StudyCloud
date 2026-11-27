import { describe, it, expect } from "vitest";
import {
  runTeacherDelmasAgentLoop,
  extractSpreadsheetExpectedNames,
} from "../src/agent-loop/teacherDelmasAgent.js";
import {
  runCreationStudioAgentLoop,
  auditCreationQuality,
} from "../src/agent-loop/creationStudioAgent.js";
import type { ChatCompletionRequester } from "../src/agent-loop/toolLoopCore.js";

describe("StudyCloud Native Tool-Calling + Zod Agent Loops", () => {
  it("Assistant Delmas : détecte un import Excel incomplet (2/10 élèves) et force le modèle à s'auto-corriger à 10/10", async () => {
    const excel10 = `[--- Feuille Excel : "Mathématiques" ---]
Rang,Nom & Prénom,NOTE 1 (/20),NOTE 2 (/20),Moyenne (/20),Mention
1er,KOUASSI Jean,16/20,17/20,"16,50",Très Bien
2e,DIALLO Fatoumata,15/20,16/20,"15,50",Bien
3e,TRAORE Ibrahim,14/20,15/20,"14,50",Bien
4e,BAMBA Aminata,13/20,14/20,"13,50",Assez Bien
5e,YAO Koffi,12/20,13/20,"12,50",Assez Bien
6e,KONE Mariam,11/20,12/20,"11,50",Passable
7e,OUATTARA Lassina,10/20,11/20,"10,50",Passable
8e,NGUESSAN Ahou,14.5/20,13.5/20,"14,00",Bien
9e,SORO Tenin,12.5/20,11.5/20,"12,00",Assez Bien
10e,COULIBALY Seydou,15.5/20,14.5/20,"15,00",Bien`;

    const expectedNames = extractSpreadsheetExpectedNames([
      { fileName: "Releve_Notes_Math.xlsx", extractedText: excel10 },
    ]);
    expect(expectedNames.length).toBe(10);

    let callCount = 0;
    const mockRequester: ChatCompletionRequester = async ({ messages }) => {
      callCount++;
      if (callCount === 1) {
        // Tour 1 : le modèle est paresseux et n'envoie que 2 élèves sur 10 !
        return {
          ok: true,
          status: 200,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "add_or_update_students",
                  arguments: JSON.stringify({
                    mode: "add",
                    students: [
                      { name: "KOUASSI Jean", notes: ["16", "17"] },
                      { name: "DIALLO Fatoumata", notes: ["15", "16"] },
                    ],
                  }),
                },
              },
            ],
          },
        };
      }
      if (callCount === 2) {
        // Vérifier que le retour d'outil `role: "tool"` signale exactement l'import incomplet (2/10)
        const lastToolMsg = messages[messages.length - 1];
        expect(lastToolMsg.role).toBe("tool");
        expect(String(lastToolMsg.content)).toContain("IMPORT INCOMPLET");
        expect(String(lastToolMsg.content)).toContain("COULIBALY Seydou");

        // Tour 2 : le modèle s'auto-corrige et soumet les 10 élèves complets !
        return {
          ok: true,
          status: 200,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_2",
                type: "function",
                function: {
                  name: "add_or_update_students",
                  arguments: JSON.stringify({
                    mode: "add",
                    students: expectedNames.map((n, idx) => ({
                      name: n,
                      notes: [String(10 + idx), String(11 + idx)],
                    })),
                  }),
                },
              },
            ],
          },
        };
      }
      // Tour 3 : confirmation courte après validation ok: true
      return {
        ok: true,
        status: 200,
        message: {
          role: "assistant",
          content: "J'ai ajouté les 10 élèves du fichier Excel dans Mathématiques.",
        },
      };
    };

    const res = await runTeacherDelmasAgentLoop({
      models: ["@cf/moonshotai/kimi-k2.7-code"],
      systemPrompt: "Tu es Assistant Delmas.",
      conversationMessages: [
        { role: "user", content: "IL FAUX METRE DANS LE TABLEAUX TOUT CES INFORMATION" },
      ],
      userPrompt: "IL FAUX METRE DANS LE TABLEAUX TOUT CES INFORMATION",
      sheetContext: {
        sheetKind: "subject",
        subjectName: "Mathématiques",
        students: [],
        noteColumns: [
          { colNumber: 1, label: "NOTE 1", maxScore: 20, coeffEval: 1 },
          { colNumber: 2, label: "NOTE 2", maxScore: 20, coeffEval: 1 },
        ],
      },
      attachedFiles: [{ fileName: "Releve_Notes_Math.xlsx", extractedText: excel10 }],
      allowActions: true,
      requester: mockRequester,
    });

    expect(res.supported).toBe(true);
    expect(res.stepsUsed).toBe(3);
    expect(res.structuredActions.length).toBe(1);
    expect(res.structuredActions[0].type).toBe("add_students");
    expect(res.structuredActions[0].students.length).toBe(10);
    expect(res.toolTrace[0].status).toBe("error");
    expect(res.toolTrace[1].status).toBe("ok");
  });

  it("Assistant Delmas : bloque un mensonge sans appel d'outil et bloque une injection clear_all non demandée", async () => {
    let callCount = 0;
    const mockRequester: ChatCompletionRequester = async () => {
      callCount++;
      if (callCount === 1) {
        // Le modèle prétend avoir fait l'action sans appeler d'outil
        return {
          ok: true,
          status: 200,
          message: {
            role: "assistant",
            content: "C'est fait ! Tout est à jour.",
          },
        };
      }
      if (callCount === 2) {
        // Tentative d'injection clear_all sur une demande d'ajout -> doit être bloquée !
        return {
          ok: true,
          status: 200,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_inj",
                type: "function",
                function: {
                  name: "clear_table_data",
                  arguments: JSON.stringify({ scope: "all" }),
                },
              },
              {
                id: "call_add",
                type: "function",
                function: {
                  name: "add_or_update_students",
                  arguments: JSON.stringify({
                    mode: "add",
                    students: [{ name: "KOUASSI Delmas", notes: ["16", "15"] }],
                  }),
                },
              },
            ],
          },
        };
      }
      return {
        ok: true,
        status: 200,
        message: {
          role: "assistant",
          content: "J'ai ajouté KOUASSI Delmas dans le tableau.",
        },
      };
    };

    const res = await runTeacherDelmasAgentLoop({
      models: ["@cf/moonshotai/kimi-k2.7-code"],
      systemPrompt: "Tu es Assistant Delmas.",
      conversationMessages: [{ role: "user", content: "Ajoute KOUASSI Delmas avec 16 et 15" }],
      userPrompt: "Ajoute KOUASSI Delmas avec 16 et 15",
      sheetContext: { sheetKind: "subject", subjectName: "Mathématiques", students: [] },
      allowActions: true,
      requester: mockRequester,
    });

    expect(res.structuredActions.length).toBe(1);
    expect(res.structuredActions[0].type).toBe("add_students");
    expect(res.toolTrace.some((t) => t.tool === "clear_table_data" && t.status === "error")).toBe(true);
    expect(res.toolTrace.some((t) => t.tool === "add_or_update_students" && t.status === "ok")).toBe(true);
  });

  it("Menu Création Studio : rejette un QCM incomplet (2 questions), force l'auto-correction à 8 questions et stoppe dès validation", async () => {
    let callCount = 0;
    const makeQuestions = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `q_${i + 1}`,
        question: `Question pédagogique n°${i + 1} sur le filtre passe-bas ?`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correct_index: i % 4,
        explanation: `Explication complète avec formule $\\dfrac{1}{1 + j\\omega RC}$ pour la question ${i + 1}.`,
      }));

    const mockRequester: ChatCompletionRequester = async ({ messages }) => {
      callCount++;
      if (callCount === 1) {
        // Tour 1 : le modèle ne génère que 2 questions -> rejeté par l'audit qualité !
        return {
          ok: true,
          status: 200,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "crea_1",
                type: "function",
                function: {
                  name: "submit_creation_module",
                  arguments: JSON.stringify({
                    creation_type: "questionnaire",
                    creation_title: "QCM Filtres Analogiques",
                    chat_response: "Voici votre QCM sur les filtres.",
                    creation_data: {
                      title: "QCM Filtres Analogiques",
                      questions: makeQuestions(2),
                    },
                  }),
                },
              },
            ],
          },
        };
      }
      // Tour 2 : l'outil a renvoyé une erreur de complétude -> le modèle corrige avec 8 questions complètes
      const lastToolMsg = messages[messages.length - 1];
      expect(lastToolMsg.role).toBe("tool");
      expect(String(lastToolMsg.content)).toContain("Seulement 2 question");

      return {
        ok: true,
        status: 200,
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "crea_2",
              type: "function",
              function: {
                name: "submit_creation_module",
                arguments: JSON.stringify({
                  creation_type: "questionnaire",
                  creation_title: "QCM Filtres Analogiques",
                  chat_response: "J'ai conçu votre QCM complet sur les filtres analogiques !",
                  creation_data: {
                    title: "QCM Filtres Analogiques",
                    questions: makeQuestions(8),
                  },
                }),
              },
            },
          ],
        },
      };
    };

    const res = await runCreationStudioAgentLoop({
      models: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast"],
      systemPrompt: "Tu es Delmas IA.",
      conversationMessages: [{ role: "user", content: "Crée un QCM complet sur ce cours" }],
      userPrompt: "Crée un QCM complet sur ce cours",
      isAgentCreationTask: true,
      requestedType: "questionnaire",
      creationTitle: "QCM Filtres Analogiques",
      docName: "cours_filtres.pdf",
      docContent: "Chapitre 1 : Filtre passe-bas RC, fréquence de coupure fc = 1/(2*pi*R*C)...",
      requester: mockRequester,
    });

    expect(res.supported).toBe(true);
    // Doit s'arrêter immédiatement au Tour 2 dès validation (pas de Tour 3 inutile !)
    expect(res.stepsUsed).toBe(2);
    expect(callCount).toBe(2);
    expect(res.verifiedCreation?.mode).toBe("creation");
    expect(res.verifiedCreation?.creation_type).toBe("questionnaire");
    expect(res.verifiedCreation?.creation_data?.questions?.length).toBe(8);
    expect(res.toolTrace[0].status).toBe("error");
    expect(res.toolTrace[1].status).toBe("ok");
  });

  it("Menu Création Chat libre : répond en Markdown naturel sans JSON ni appel d'outil pour une simple question", async () => {
    const mockRequester: ChatCompletionRequester = async () => ({
      ok: true,
      status: 200,
      message: {
        role: "assistant",
        content: "Le théorème de Millman permet de calculer le potentiel d'un nœud électrique.",
      },
    });

    const res = await runCreationStudioAgentLoop({
      models: ["@cf/moonshotai/kimi-k2.7-code"],
      systemPrompt: "Tu es Delmas IA.",
      conversationMessages: [{ role: "user", content: "Explique-moi le théorème de Millman" }],
      userPrompt: "Explique-moi le théorème de Millman",
      isAgentCreationTask: false,
      requester: mockRequester,
    });

    expect(res.supported).toBe(true);
    expect(res.verifiedCreation).toBeNull();
    expect(res.finalText).toContain("théorème de Millman");
    expect(res.toolTrace.length).toBe(0);
  });

  it("Repli gracieux (supported: false) si un modèle rejette le paramètre tools en 400", async () => {
    const mockRequester: ChatCompletionRequester = async () => ({
      ok: false,
      status: 400,
      unsupportedTools: true,
      errorText: "tools parameter not supported by this model",
    });

    const res = await runCreationStudioAgentLoop({
      models: ["@cf/legacy/no-tools-model"],
      systemPrompt: "Tu es Delmas IA.",
      conversationMessages: [{ role: "user", content: "Bonjour" }],
      userPrompt: "Bonjour",
      isAgentCreationTask: false,
      requester: mockRequester,
    });

    expect(res.supported).toBe(false);
    expect(auditCreationQuality({ mode: "chat", decision: "chat", creation_type: null, creation_title: null, creation_data: null, chat_response: "" }, null).errors.length).toBeGreaterThan(0);
  });
});

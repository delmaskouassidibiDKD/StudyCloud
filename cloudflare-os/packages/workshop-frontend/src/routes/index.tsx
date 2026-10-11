import { classifyRpcError, logRpcFailure, rpcFailureDescription } from "../rpcErrors";
import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useKumoToastManager } from "@cloudflare/kumo";
import { ChatComposer } from "../features/chat/composer/ChatComposer";
import MeshBackground from "../components/MeshBackground";
import HomeTaskSuggestions from "../components/AppShell/HomeTaskSuggestions";
import { useAuthenticatedApi } from "../AuthContext";
import { RpcStub } from "capnweb";
import {
  Overseer,
  AiChatAuthorInfo,
  CapsuleSpecifier,
  ChatAttachmentHandle,
  MessageFormatRef,
  SlashCommandRequest,
} from "@gadgets/workshop-shared/api";
import {
  getStoredSelectedModel,
  persistSelectedModel,
} from "../modelSelection";
import { useDocumentTitle } from "../useDocumentTitle";
import { homePromptFromSearch } from "../homePrompt";
import { composerDraftStorageKey } from "../features/chat/composer/draft/composerDraft";

type HomeSearch = { prompt?: string };

export const Route = createFileRoute("/")({
  component: HomePage,
  validateSearch: (search: Record<string, unknown>): HomeSearch => ({
    prompt: homePromptFromSearch(search.prompt),
  }),
});

// The Home page is the "new workspace" launcher. Persistent navigation (recents, favorites) lives
// in the AppShell rail, so this page focuses on a single thing: composing the first message of a
// new gadget — a centered column with a hero, the prompt composer, and a few task suggestions.
function HomePage() {
  return <HomePageContent prompt={Route.useSearch().prompt} />;
}

export function HomePageContent({ prompt }: HomeSearch) {
  useDocumentTitle("Accueil");

  const { authenticatedApi, currentUser } = useAuthenticatedApi();
  const navigate = useNavigate();
  const toasts = useKumoToastManager();

  const [models, setModels] = useState<AiChatAuthorInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  // Bumped each time a task suggestion is picked; the composer re-seeds its text off the nonce.
  const [seed, setSeed] = useState<{ text: string; nonce: number } | null>(null);

  useEffect(() => {
    if (!prompt) return;
    setSeed((previous) => ({ text: prompt, nonce: (previous?.nonce ?? 0) + 1 }));
    navigate({ to: "/", search: {}, replace: true });
  }, [navigate, prompt]);

  useEffect(() => {
    let cancelled = false;

    async function loadModelsAndConfig() {
      let finalModels: AiChatAuthorInfo[] = [];
      let defaultModelId: string | null = null;

      try {
        // 1. Interroger le Tableau de Bord StudyCloud
        const res = await fetch("https://worker-tableaux-de-bord.delmaskouassidibi.workers.dev/api/public/robot-rouge-config")
          .catch(() => null);

        if (res && res.ok) {
          const data: any = await res.json().catch(() => null);
          if (data && data.success) {
            const cfg = data.config || {};
            const inMaint = cfg.is_maintenance === 1 || cfg.is_maintenance === true || cfg.status === "maintenance";
            if (!cancelled) {
              setIsMaintenance(inMaint);
              if (inMaint) {
                setMaintenanceMessage(cfg.system_instructions ? "Le Studio IA est actuellement en maintenance pour optimisation." : "Service temporairement en maintenance.");
              }
            }

            if (Array.isArray(data.models) && data.models.length > 0) {
              finalModels = data.models.map((m: any) => ({
                id: m.id || m.model_id,
                name: m.name || m.id,
                type: "agent" as const,
              }));
            }
            if (cfg.default_model) {
              defaultModelId = cfg.default_model;
            }
          }
        }
      } catch (e) {
        // Ignorer l'erreur réseau distante
      }

      // 2. Si pas de modèles distants, interroger le backend RPC
      if (finalModels.length === 0) {
        try {
          const backendList = await authenticatedApi.listModels();
          if (backendList && backendList.length > 0) {
            finalModels = backendList;
          }
        } catch (err) {
          logRpcFailure("Failed to fetch backend models:", err);
        }
      }

      // 3. Catalogue de secours officiel (garantit qu'aucun étudiant ne voit jamais 'No agent' par erreur)
      if (finalModels.length === 0) {
        finalModels = [
          { id: "@cf/meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct (Workers AI)", type: "agent" },
          { id: "gemini-2.0-flash", name: "Google Gemini 2.0 Flash", type: "agent" },
          { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (Anthropic)", type: "agent" },
          { id: "gpt-4o-mini", name: "OpenAI GPT-4o Mini", type: "agent" },
          { id: "@cf/moonshotai/kimi-k2.7-code", name: "Kimi K2.7 Code (Workers AI)", type: "agent" },
          { id: "@cf/deepseek-ai/deepseek-v4-pro-0813", name: "DeepSeek V4 Pro (Workers AI)", type: "agent" },
        ];
      }

      if (cancelled) return;

      setModels(finalModels);

      // Déterminer le modèle sélectionné
      if (defaultModelId && finalModels.some(m => m.id === defaultModelId)) {
        setSelectedModel(defaultModelId);
        persistSelectedModel(defaultModelId);
      } else {
        const stored = getStoredSelectedModel(finalModels);
        const chosen = stored || finalModels[0]?.id || null;
        setSelectedModel(chosen);
        if (chosen) persistSelectedModel(chosen);
      }
    }

    loadModelsAndConfig();

    return () => {
      cancelled = true;
    };
  }, [authenticatedApi]);

  const handleModelChange = useCallback((value: string | null) => {
    setSelectedModel(value);
    persistSelectedModel(value);
  }, []);

  // Pre-create a provisional gadget as soon as the user starts interacting, so that navigation
  // after submit is instant. Same pattern as before — disposed on unmount if never consumed.
  const provisionalOverseerRef = useRef<{ stub: RpcStub<Overseer> } | null>(null);

  const ensureProvisionalGadget = useCallback(() => {
    if (!provisionalOverseerRef.current) {
      const overseer = authenticatedApi.newGadget();
      provisionalOverseerRef.current = { stub: overseer };
    }
  }, [authenticatedApi]);

  useEffect(() => {
    return () => {
      provisionalOverseerRef.current?.stub[Symbol.dispose]();
      provisionalOverseerRef.current = null;
    };
  }, []);

  const handleSend = useCallback(
    async (
      message: string | SlashCommandRequest,
      modelId: string | null,
      capsules?: CapsuleSpecifier[],
      attachments?: ChatAttachmentHandle[],
      formats?: MessageFormatRef[],
    ) => {
      if (isMaintenance) {
        toasts.add({ 
          title: "Service en maintenance", 
          description: maintenanceMessage || "Le Studio IA est temporairement en maintenance par l'administrateur.",
          variant: "warning" 
        });
        return;
      }
      try {
        ensureProvisionalGadget();
        const overseer = provisionalOverseerRef.current!.stub;
        // Pipeline both independent calls in one batch, but settle both before releasing the stub.
        const [chat, {id}] = await Promise.all([
          overseer.newChat(message, modelId, capsules, attachments, formats),
          overseer.getMetadata(),
        ]);
        provisionalOverseerRef.current?.stub[Symbol.dispose]();
        provisionalOverseerRef.current = null;
        // Open the conversation we just started.
        navigate({ to: "/workspace/$id", params: { id }, search: { chat } });
      } catch (err) {
        const transient = logRpcFailure("Failed to create gadget:", err,
            { reportSite: "workspace.create" });
        // A retry reuses the provisional gadget while the draft contains gadget-scoped references.
        if (!attachments?.length && !capsules?.length) {
          provisionalOverseerRef.current?.stub[Symbol.dispose]();
          provisionalOverseerRef.current = null;
        }
        if (!transient) {
          toasts.add({
            title: "Échec de création de l'espace de travail",
            description: rpcFailureDescription(err),
            variant: "error",
          });
        }
        throw err;
      }
    },
    [ensureProvisionalGadget, navigate, toasts],
  );

  const getOverseer = useCallback((): RpcStub<Overseer> => {
    ensureProvisionalGadget();
    return provisionalOverseerRef.current!.stub;
  }, [ensureProvisionalGadget]);

  const createCapsuleGatekeeper = useCallback(
    (accountId: number, url: string) => {
      ensureProvisionalGadget();
      return provisionalOverseerRef.current!.stub.newGatekeeper(accountId, url);
    },
    [ensureProvisionalGadget],
  );

  return (
    // Flat enterprise treatment: no mesh, no watermark hexagon, no prompt-glow. The AppShell's
    // <main> already supplies a faint dotted grid as the page background.
    <div className="relative isolate flex min-h-full w-full flex-col items-center justify-start px-4 pb-16 pt-10 sm:px-8 sm:pt-16 lg:pt-24">
      {/* The brand hex mesh, restored and de-warmed for the new system: a gentle perspective hex
          grid receding upward. Masked to fade out before the composer so it stays a quiet backdrop. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 95%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 95%)",
        }}
      >
        <MeshBackground />
      </div>
      <div className="flex w-full max-w-2xl flex-col items-stretch gap-8">
        {/* Hero */}
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight leading-tight text-kumo-default sm:text-4xl">
            Sur quoi travaillons-nous aujourd'hui ?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-5 tracking-[-0.25px] text-kumo-subtle">
            Posez une question, générez un document ou créez une application connectée à vos outils et données.
          </p>
        </header>

        {/* Bannière Maintenance Pilotée depuis le Tableau de Bord */}
        {isMaintenance && (
          <div className="w-full rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 p-4 text-amber-200 flex items-center gap-3.5 backdrop-blur-sm animate-pulse">
            <span className="text-2xl">🛠️</span>
            <div>
              <h3 className="font-bold text-amber-300 text-sm">Mode Maintenance Actif</h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                {maintenanceMessage || "Le Studio IA Robot Rouge est temporairement en maintenance pour optimisation par l'administrateur."}
              </p>
            </div>
          </div>
        )}

        {/* Composer */}
        <ChatComposer
          createCapsuleGatekeeper={createCapsuleGatekeeper}
          getOverseer={getOverseer}
          onSend={handleSend}
          isAgentActive={false}
          models={models}
          selectedModel={selectedModel === null ? null : { id: selectedModel }}
          onModelChange={handleModelChange}
          newChat
          offerFormats
          autoFocus
          minRows={3}
          seedText={seed?.text}
          seedNonce={seed?.nonce}
          draftStorageKey={currentUser
            ? composerDraftStorageKey(currentUser.id, "home")
            : undefined}
        />

        {/* A few example work tasks to spark ideas. Picking one seeds the composer above. */}
        <HomeTaskSuggestions
          onPick={(suggestion) =>
            setSeed((prev) => ({ text: suggestion, nonce: (prev?.nonce ?? 0) + 1 }))
          }
        />
      </div>
    </div>
  );
}

import { Check, File as FileIcon, WarningCircle, X } from "@phosphor-icons/react";
import type { ComposerAttachment } from "./useComposerAttachments";

export const ComposerAttachmentTray = ({
  attachments,
  disabled = false,
  onRemove,
}: {
  attachments: readonly ComposerAttachment[];
  disabled?: boolean;
  onRemove: (attachmentId: string) => void;
}) => {
  if (attachments.length === 0) return null;

  const uploadingCount = attachments.filter((a) => a.uploadState === "uploading").length;
  const readyCount = attachments.filter((a) => a.uploadState === "ready").length;
  const errorCount = attachments.filter((a) => a.uploadState === "error").length;
  const isAnyUploading = uploadingCount > 0;

  return (
    <div className="flex flex-col gap-1.5 px-3 pb-2 pt-1">
      {/* Bandeau d'état global pendant le traitement des fichiers */}
      {isAnyUploading ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-medium text-amber-300">
          <svg
            className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <path
              className="opacity-95"
              fill="currentColor"
              d="M12 3a9 9 0 0 1 9 9h-2.5a6.5 6.5 0 0 0-6.5-6.5V3z"
            />
          </svg>
          <span className="flex-1">
            Traitement et analyse de {attachments.length > 1 ? `vos ${attachments.length} fichiers` : "votre fichier"} en cours... ({readyCount}/{attachments.length} prêt{readyCount > 1 ? "s" : ""})
          </span>
          <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            Envoi en attente
          </span>
        </div>
      ) : errorCount > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11.5px] font-medium text-red-300">
          <WarningCircle size={14} weight="fill" className="text-red-400 shrink-0" />
          <span className="flex-1">
            {errorCount > 1 ? `${errorCount} fichiers n'ont pas pu être traités.` : "Un fichier n'a pas pu être traité."} Retirez-le avant d'envoyer.
          </span>
        </div>
      ) : readyCount > 0 ? (
        <div className="flex items-center gap-1.5 px-1 text-[11.5px] font-medium text-emerald-400">
          <Check size={13} weight="bold" />
          <span>
            {readyCount > 1 ? `Tous les ${readyCount} fichiers sont prêts` : "Fichier prêt"} — vous pouvez envoyer votre message
          </span>
        </div>
      ) : null}

      {/* Cartes des fichiers sélectionnés */}
      <div className="flex flex-wrap items-center gap-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className={`relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border transition-all ${
              attachment.uploadState === "uploading"
                ? "border-amber-500/40 bg-kumo-elevated ring-1 ring-amber-500/30"
                : attachment.uploadState === "error"
                  ? "border-red-500/50 bg-red-950/20"
                  : "border-kumo-line/70 bg-kumo-elevated"
            }`}
          >
            {attachment.previewUrl ? (
              <img
                src={attachment.previewUrl}
                alt={attachment.name ?? "Attached file"}
                className="h-full w-full object-cover"
              />
            ) : (
              <FileIcon size={22} className="text-kumo-inactive" />
            )}

            {/* 1. État EN COURS DE TRAITEMENT : Le petit cercle qui tourne sur le fichier sélectionné */}
            {attachment.uploadState === "uploading" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-black/65 backdrop-blur-[1.5px] p-1 text-center select-none">
                <svg
                  className="h-5 w-5 animate-spin text-white drop-shadow-md"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  />
                  <path
                    className="opacity-95"
                    fill="currentColor"
                    d="M12 3a9 9 0 0 1 9 9h-2.5a6.5 6.5 0 0 0-6.5-6.5V3z"
                  />
                </svg>
                <span className="mt-1 text-[8.5px] font-semibold text-white/95 leading-none tracking-tight">
                  Analyse...
                </span>
              </div>
            )}

            {/* 2. État PRÊT : Petit badge vert de succès avec coche */}
            {attachment.uploadState === "ready" && (
              <div
                className="absolute bottom-1 right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow ring-1 ring-white/60"
                title="Fichier prêt pour l'IA"
              >
                <Check size={10} weight="bold" />
              </div>
            )}

            {/* 3. État ERREUR : Badge rouge d'échec */}
            {attachment.uploadState === "error" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-red-950/80 px-1 text-center text-white backdrop-blur-[1px]">
                <WarningCircle size={15} weight="fill" className="text-red-400" />
                <span className="mt-0.5 text-[8.5px] font-semibold leading-tight text-red-200">
                  Échec
                </span>
              </div>
            )}

            {/* Bouton de suppression toujours accessible pour annuler */}
            <button
              type="button"
              aria-label="Remove attachment"
              disabled={disabled}
              onClick={() => onRemove(attachment.id)}
              className="absolute right-0.5 top-0.5 z-20 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={10} weight="bold" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};


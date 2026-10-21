/**
 * ============================================================================
 * STUDYCLOUD - WORKER IA MULTIMODAL CLOUDFLARE R2 + GEMINI 2.0 FLASH
 * ============================================================================
 * 
 * 🚀 FONCTIONNEMENT :
 * 1. Le client envoie l'URL ou la clé du fichier stocké dans Cloudflare R2 (fileUrl) + le prompt.
 * 2. Le Worker récupère le fichier depuis Cloudflare R2 sans repasser par le réseau client.
 * 3. Le buffer R2 est proprement converti en Blob natif avec le type MIME adéquat.
 * 4. Le fichier est téléversé sur l'API Files de Gemini via le SDK officiel @google/genai.
 * 5. Si nécessaire (fichiers vidéo/lourds), le Worker attend la fin du traitement (état ACTIVE).
 * 6. Le modèle multimodal 'gemini-2.0-flash' analyse le document/média et renvoie le résultat.
 */

import { GoogleGenAI } from "@google/genai";

// Détection de secours du type MIME à partir du nom ou de l'URL du fichier
function detectMimeType(filename = "") {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map = {
    // Vidéos
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    // Audios
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    aac: "audio/aac",
    flac: "audio/flac",
    // Documents
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Images
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  };
  return map[ext] || "application/octet-stream";
}

// Extraction de la clé R2 relative même si une URL complète ou signée est transmise
function extractR2Key(fileUrl) {
  if (!fileUrl) return "";
  try {
    if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
      const parsed = new URL(fileUrl);
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    }
  } catch (_) {}
  return fileUrl.replace(/^\/+/, "");
}

export default {
  async fetch(request, env, ctx) {
    // En-têtes CORS universels pour autoriser les requêtes du Chat StudyCloud
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id, *",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "POST") {
      try {
        const data = await request.json();
        const { fileUrl, fileType, prompt, model = "gemini-2.0-flash" } = data;

        if (!fileUrl) {
          return new Response(
            JSON.stringify({ success: false, error: "Le paramètre 'fileUrl' est obligatoire." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // 1. Sélection automatique du Bucket R2 (liaison BUCKET ou MON_R2_STUDYCLOUD)
        const bucket =
          env.MON_R2_STUDYCLOUD ||
          env.BUCKET ||
          env.MON_BUCKET_R2 ||
          env.BUCKET_MES_FICHIERS ||
          env.BUCKET_VIDEOS ||
          env.BUCKET_DOCUMENTS;

        if (!bucket) {
          throw new Error("Liaison Bucket R2 introuvable dans l'environnement Cloudflare Worker.");
        }

        // 2. Récupération de l'objet depuis R2
        const r2Key = extractR2Key(fileUrl);
        const fileObjFromR2 = await bucket.get(r2Key);

        if (!fileObjFromR2) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Fichier introuvable dans Cloudflare R2 pour la clé : "${r2Key}"`,
            }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // 3. Détermination fiable du type MIME
        const resolvedMimeType =
          fileType ||
          fileObjFromR2.httpMetadata?.contentType ||
          detectMimeType(r2Key);

        // 4. Extraction du arrayBuffer R2 et conversion en Blob natif Web
        // (CRUCIAL : le SDK @google/genai attend un Blob avec .size et .slice pour uploader)
        const arrayBuffer = await fileObjFromR2.arrayBuffer();
        const fileBlob = new Blob([arrayBuffer], { type: resolvedMimeType });

        // 5. Initialisation du SDK officiel @google/genai
        const apiKey =
          env.STUDYCLOUD_GEMINI_1 ||
          env.GEMINI_API_KEY ||
          env["studyCloud-Gemini-1"] ||
          data.apiKey;

        if (!apiKey) {
          throw new Error("Clé API Gemini introuvable (env.STUDYCLOUD_GEMINI_1).");
        }

        const ai = new GoogleGenAI({ apiKey });

        // 6. Téléversement vers la File API de Gemini
        // Note : config.mimeType doit impérativement être dans 'config' pour @google/genai
        const filename = r2Key.split("/").pop() || "document-etude";
        let uploadedFile = await ai.files.upload({
          file: fileBlob,
          config: {
            mimeType: resolvedMimeType,
            displayName: filename,
          },
        });

        // 7. Attente active si le média nécessite un traitement serveur Gemini (vidéos, etc.)
        let waitAttempts = 0;
        while (uploadedFile.state === "PROCESSING" && waitAttempts < 30) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          uploadedFile = await ai.files.get({ name: uploadedFile.name });
          waitAttempts++;
        }

        if (uploadedFile.state === "FAILED") {
          throw new Error("Le traitement du fichier par la File API de Gemini a échoué.");
        }

        // 8. Génération de contenu multimodal avec gemini-2.0-flash
        const response = await ai.models.generateContent({
          model: model || "gemini-2.0-flash",
          contents: [
            prompt || "Analyse attentivement ce document ou média et réponds aux questions de l'étudiant.",
            {
              fileData: {
                fileUri: uploadedFile.uri,
                mimeType: uploadedFile.mimeType || resolvedMimeType,
              },
            },
          ],
        });

        return new Response(
          JSON.stringify({
            success: true,
            text: response.text,
            fileName: filename,
            mimeType: resolvedMimeType,
            fileUri: uploadedFile.uri,
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json; charset=utf-8",
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message || "Erreur interne lors du traitement IA",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json; charset=utf-8",
            },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Endpoint non trouvé (utilisez POST pour analyser un fichier R2)" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  },
};

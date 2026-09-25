/**
 * StudyCloud - Connecteur Officiel Cloudflare Agents SDK (Durable Objects)
 * Communique avec le projet 'studycloud-agent' pour les créations pédagogiques structurées,
 * l'analyse profonde de documents et les conversations avec mémoire persistante.
 */

export const getStudyAgentUrl = (): string => {
  return (
    (import.meta as any).env?.VITE_STUDY_AGENT_URL ||
    localStorage.getItem('studycloud_agent_url') ||
    'https://studycloud-agent.delmaskouassidibi.workers.dev'
  ).replace(/\/+$/, '');
};

export const setStudyAgentUrl = (url: string) => {
  if (!url || !url.trim()) {
    localStorage.removeItem('studycloud_agent_url');
  } else {
    localStorage.setItem('studycloud_agent_url', url.trim());
  }
};

/**
 * Vérifie l'état de santé du Cloudflare Agent
 */
export async function checkAgentHealth(): Promise<{
  online: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const url = getStudyAgentUrl();
    const res = await fetch(`${url}/api/ai/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return { online: false, error: `Statut HTTP ${res.status}` };
    const data = await res.json();
    return { online: true, data };
  } catch (err: any) {
    return { online: false, error: err?.message || 'Agent inaccessible' };
  }
}

/**
 * Génère un module pédagogique structuré (QCM, Vrai/Faux, Carte Mentale, Résumé, Devoir...)
 * avec garantie de format JSON conforme à l'UI StudyCloud
 */
export async function generateAgentCreation(params: {
  toolType: string;
  docName: string;
  docContent: string;
  prompt?: string;
  userId?: string;
}): Promise<{
  success: boolean;
  creation_type: string;
  creation_title: string;
  creation_data: any;
  model?: string;
  rawText?: string;
}> {
  const agentUrl = getStudyAgentUrl();
  const currentUserId = params.userId || localStorage.getItem('unifolder_user_id') || 'default-user';

  const res = await fetch(`${agentUrl}/api/ai/creation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': currentUserId,
    },
    body: JSON.stringify({
      toolType: params.toolType,
      docName: params.docName,
      docContent: params.docContent,
      prompt: params.prompt || '',
      userId: currentUserId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Erreur de l'agent IA (${res.status})`);
  }

  return await res.json();
}

/**
 * Analyse approfondie d'un document académique
 */
export async function analyzeAgentDocument(params: {
  docName: string;
  docContent: string;
}): Promise<{
  success: boolean;
  analysis: {
    documentTitle: string;
    domain?: string;
    academicLevel?: string;
    summary: string;
    keyTopics: string[];
    prerequisites?: string[];
    recommendedModules?: string[];
  };
}> {
  const agentUrl = getStudyAgentUrl();

  const res = await fetch(`${agentUrl}/api/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(`Erreur lors de l'analyse du document (${res.status})`);
  }

  return await res.json();
}

/**
 * Discussion interactive avec Delmas IA via le Cloudflare Agent
 */
export async function sendAgentChatMessage(params: {
  message: string;
  history?: Array<{ role: string; content: string }>;
  docContent?: string;
  signal?: AbortSignal;
}): Promise<{
  success: boolean;
  response: string;
  model?: string;
}> {
  const agentUrl = getStudyAgentUrl();

  const res = await fetch(`${agentUrl}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
      history: params.history || [],
      attachedFileContent: params.docContent || '',
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    throw new Error(`Erreur communication agent (${res.status})`);
  }

  const data = await res.json();
  return {
    success: true,
    response: data.response || data.chat_response || '',
    model: data.model || 'Delmas IA (Cloudflare Agent)',
  };
}

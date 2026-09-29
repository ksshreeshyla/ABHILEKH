export interface GroundedQueryResult {
  answer: string;
  sources: Array<{
    documentId: string;
    documentTitle: string;
    archiveId: string;
    pageNumber: number;
    relevantExcerpt: string;
    sourceUrl?: string;
  }>;
  suggestedFollowUps: string[];
  isGeminiPowered: boolean;
}

/** Research requests stay on the backend so private model credentials never enter the browser bundle. */
export async function askArchivalAssistant(userQuery: string, responseLanguage: 'en' | 'hi' | 'mr' | 'kn' = 'en'): Promise<GroundedQueryResult> {
  const response = await fetch('/api/research/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: userQuery, responseLanguage }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.message || `Research service returned HTTP ${response.status}`);
  }
  return payload.data as GroundedQueryResult;
}

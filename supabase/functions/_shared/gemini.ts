// ─── Gemini shared config ─────────────────────────────────────────────────────
// Change GEMINI_MODEL here to update all AI functions at once.
export const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models'
export const GEMINI_MODEL = 'gemini-3.1-pro-preview'

// ─── Types ────────────────────────────────────────────────────────────────────
export type GeminiContent = { role: string; parts: Array<{ text: string }> }

export type GeminiResult = { text: string | null; error?: string }

export type GeminiOptions = {
  systemInstruction?: string
  contents: GeminiContent[]
  maxOutputTokens?: number
  temperature?: number
}

// ─── Helper ───────────────────────────────────────────────────────────────────
export async function callGemini(
  apiKey: string,
  options: GeminiOptions,
  model = GEMINI_MODEL
): Promise<GeminiResult> {
  const body: Record<string, unknown> = {
    contents: options.contents,
    generationConfig: {
      maxOutputTokens: options.maxOutputTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
    },
  }

  if (options.systemInstruction) {
    body.system_instruction = { parts: [{ text: options.systemInstruction }] }
  }

  try {
    const res = await fetch(
      `${GEMINI_API}/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    const data = await res.json()

    if (data.error) {
      const errMsg = `API error: ${JSON.stringify(data.error).substring(0, 300)}`
      console.error('Gemini API error:', errMsg)
      return { text: null, error: errMsg }
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
    return { text }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('Gemini fetch error:', errMsg)
    return { text: null, error: errMsg }
  }
}

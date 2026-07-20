type ChatCompletion = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

const systemPrompt = `You are Dreamboard's creative review assistant. Help the creator think, organize, and improve clarity while preserving their authorship and voice. Never claim to have changed their work, never invent source material, and offer concise, reviewable suggestions.`;

export async function POST(request: Request) {
  const baseUrl = process.env.AI_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    return Response.json({ configured: false, error: "The AI connector is built but not linked yet. Add AI_BASE_URL, AI_API_KEY, and AI_MODEL in the hosted environment settings." }, { status: 503 });
  }

  let input: { prompt?: string; context?: string };
  try { input = await request.json() as { prompt?: string; context?: string }; } catch { return Response.json({ error: "Send a valid AI request." }, { status: 400 }); }
  const prompt = input.prompt?.trim();
  if (!prompt) return Response.json({ error: "Write a request before asking Dreamboard AI." }, { status: 400 });

  try {
    const provider = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.5, max_tokens: 700, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `${prompt}\n\nContext:\n${(input.context || "").slice(0, 5000)}` }] }),
    });
    const data = await provider.json() as ChatCompletion;
    if (!provider.ok) return Response.json({ error: data.error?.message || "The connected AI provider did not accept the request." }, { status: 502 });
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return Response.json({ error: "The connected model did not return a review." }, { status: 502 });
    return Response.json({ text, configured: true });
  } catch {
    return Response.json({ error: "Dreamboard could not reach the connected AI provider." }, { status: 502 });
  }
}

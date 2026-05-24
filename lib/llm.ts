import type { AssessResponse } from "./types";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const SYSTEM_PROMPT = `You are a utility grid operations assistant. You will receive a structured outage risk assessment for a specific zone in Ontario, Canada. Generate a concise, professional plain-language summary (3-5 sentences) describing the risk level, the primary contributing factors, and 2-3 specific recommended utility actions. Write for a utility operations supervisor, not a general audience.`;

interface NarrativePayload {
  location: string;
  risk_score: number;
  risk_tier: AssessResponse["risk_tier"];
  storm_context: string;
  factors: AssessResponse["factors"];
}

export async function generateNarrative(payload: NarrativePayload): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return localNarrative(payload);

  const userPrompt = JSON.stringify(
    {
      location: payload.location,
      risk_score: payload.risk_score,
      risk_tier: payload.risk_tier,
      storm_event: payload.storm_context,
      factors: {
        wind_speed: payload.factors.wind.detail,
        canopy: payload.factors.canopy.detail,
        flood: payload.factors.flood.detail,
        outage_history: payload.factors.history.detail,
      },
    },
    null,
    2,
  );

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    return text.trim() || localNarrative(payload);
  } catch {
    return localNarrative(payload);
  }
}

function localNarrative(payload: NarrativePayload): string {
  const { location, risk_tier, factors, storm_context } = payload;
  const drivers = [
    { name: "wind", c: factors.wind.contribution, detail: factors.wind.detail },
    { name: "canopy", c: factors.canopy.contribution, detail: factors.canopy.detail },
    { name: "flood exposure", c: factors.flood.contribution, detail: factors.flood.detail },
    { name: "outage history", c: factors.history.contribution, detail: factors.history.detail },
  ].sort((a, b) => b.c - a.c);

  const top = drivers.slice(0, 2);
  const actions =
    risk_tier === "High"
      ? "Pre-position repair crews near the affected feeders, issue proactive public alerts within the next 2 hours, and monitor substation load for early anomaly detection."
      : risk_tier === "Medium"
        ? "Place on-call crews on standby, brief dispatch on the storm context, and verify backup feeder readiness."
        : "Maintain normal posture, but keep a watch on the wind forecast and any active alerts.";
  return [
    `${location} is currently rated ${risk_tier} Risk.`,
    `Top drivers: ${top.map((d) => `${d.name} (${d.detail})`).join("; ")}.`,
    `Storm context: ${storm_context}.`,
    actions,
  ].join(" ");
}

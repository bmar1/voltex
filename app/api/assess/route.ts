import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocode";
import { fetchWeather } from "@/lib/weather";
import { score } from "@/lib/scoring";
import { generateNarrative } from "@/lib/llm";
import type { AssessResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { location?: string };
  try {
    body = (await req.json()) as { location?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const location = body.location?.trim();
  if (!location) {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }

  try {
    const geo = await geocode(location);
    const weather = await fetchWeather(geo.coordinates);
    const scored = await score(geo.coordinates, weather, geo.fsa);
    const llm_narrative = await generateNarrative({
      location: geo.displayName,
      risk_score: scored.risk_score,
      risk_tier: scored.risk_tier,
      storm_context: scored.storm_context,
      factors: scored.factors,
    });

    const response: AssessResponse = {
      location: geo.displayName,
      coordinates: geo.coordinates,
      fsa: geo.fsa,
      risk_score: scored.risk_score,
      risk_tier: scored.risk_tier,
      factors: scored.factors,
      storm_context: scored.storm_context,
      llm_narrative,
      weather,
      generated_at: new Date().toISOString(),
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "assessment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

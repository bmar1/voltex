import { NextResponse } from "next/server";
import { fetchWeather } from "@/lib/weather";
import { score } from "@/lib/scoring";
import type { BatchAssessResponse, SlimAssessResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CityInput {
  name: string;
  label?: string;
  lat: number;
  lng: number;
  fsa?: string;
}

interface BatchBody {
  cities?: CityInput[];
}

export async function POST(req: Request) {
  let body: BatchBody;
  try {
    body = (await req.json()) as BatchBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const cities = body.cities;
  if (!Array.isArray(cities) || cities.length === 0) {
    return NextResponse.json({ error: "cities array is required" }, { status: 400 });
  }

  const settled = await Promise.allSettled(
    cities.map(async (city): Promise<SlimAssessResult> => {
      const coords = { lat: city.lat, lng: city.lng };
      const weather = await fetchWeather(coords);
      const scored = await score(coords, weather, city.fsa);
      return {
        name: city.name,
        label: city.label ?? city.name,
        coordinates: coords,
        risk_score: scored.risk_score,
        risk_tier: scored.risk_tier,
        factors: scored.factors,
        storm_context: scored.storm_context,
        weather,
        generated_at: new Date().toISOString(),
      };
    }),
  );

  const results: SlimAssessResult[] = [];
  const errors: { name: string; message: string }[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      results.push(r.value);
    } else {
      const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push({ name: cities[i].name, message });
    }
  });

  const response: BatchAssessResponse = {
    results,
    errors,
    generated_at: new Date().toISOString(),
  };
  return NextResponse.json(response);
}

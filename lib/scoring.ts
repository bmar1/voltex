import {
  loadDatasets,
  lookupCanopyDensity,
  lookupFloodExposure,
  lookupOutageCount,
} from "./datasets";
import type {
  Coordinates,
  FactorScore,
  RiskFactors,
  RiskTier,
  WeatherSnapshot,
} from "./types";

const WEIGHTS = { wind: 0.3, canopy: 0.25, flood: 0.2, history: 0.25 };

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function tierFor(score: number): RiskTier {
  if (score >= 0.7) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}

function buildFactor(
  label: string,
  raw: number | string | null,
  normalized: number,
  weight: number,
  detail: string,
): FactorScore {
  const n = clamp01(normalized);
  return {
    label,
    raw,
    normalized: n,
    weight,
    contribution: n * weight,
    detail,
  };
}

export interface ScoringResult {
  risk_score: number;
  risk_tier: RiskTier;
  factors: RiskFactors;
  storm_context: string;
}

export async function score(
  coords: Coordinates,
  weather: WeatherSnapshot,
  fsa?: string,
): Promise<ScoringResult> {
  const { outages, canopy, floods } = await loadDatasets();

  // Wind: normalize against 100km/h (sustained gale = ceiling).
  const wind = weather.windSpeedKmh ?? 0;
  const gust = weather.windGustKmh ?? 0;
  const windAnchor = Math.max(wind, gust * 0.85);
  const windNormalized = windAnchor / 100;
  const windDetail = `${Math.round(wind)} km/h sustained${
    gust ? `, ${Math.round(gust)} km/h gust` : ""
  }${weather.conditions ? ` — ${weather.conditions}` : ""}`;

  // Canopy: normalize using the 5x5 neighborhood vs the dataset's max cell density.
  const canopyLookup = lookupCanopyDensity(canopy, coords.lat, coords.lng);
  const cellMax = canopy?.maxCell ?? 1;
  const neighborhoodMax = cellMax * 25; // 5x5 cells
  const canopyNormalized = neighborhoodMax > 0
    ? canopyLookup.neighborhoodTrees / (neighborhoodMax * 0.4)
    : 0;
  const canopyDetail = canopy
    ? `${canopyLookup.cellTrees} city trees in cell, ${canopyLookup.neighborhoodTrees} within ~1 km²`
    : "canopy index unavailable";

  // Flood: 1.0 if inside a footprint, decays with distance otherwise.
  const floodLookup = lookupFloodExposure(floods, coords.lat, coords.lng);
  let floodNormalized = 0;
  let floodDetail = "no historical flood footprint nearby";
  if (floodLookup.insideFootprint) {
    floodNormalized = 1;
    floodDetail = "inside NRCan historical flood footprint";
  } else if (floodLookup.nearestKm < 50) {
    floodNormalized = 1 - floodLookup.nearestKm / 50;
    floodDetail = `nearest NRCan flood footprint ${floodLookup.nearestKm.toFixed(
      1,
    )} km away`;
  }

  // History: 311 storm-related counts at this FSA.
  const outageCount = lookupOutageCount(outages, fsa);
  const outageMax = outages?.maxCount ?? 1;
  const historyNormalized = outageMax > 0 ? outageCount / outageMax : 0;
  const historyDetail = fsa
    ? `${outageCount} storm-related 311 events recorded in ${fsa} (recent years)`
    : "no FSA resolved — outage history unavailable";

  const factors: RiskFactors = {
    wind: buildFactor("Wind", `${Math.round(wind)} km/h`, windNormalized, WEIGHTS.wind, windDetail),
    canopy: buildFactor(
      "Canopy",
      canopyLookup.neighborhoodTrees,
      canopyNormalized,
      WEIGHTS.canopy,
      canopyDetail,
    ),
    flood: buildFactor(
      "Flood",
      floodLookup.insideFootprint ? "inside footprint" : `${floodLookup.nearestKm.toFixed(1)} km`,
      floodNormalized,
      WEIGHTS.flood,
      floodDetail,
    ),
    history: buildFactor("Outage history", outageCount, historyNormalized, WEIGHTS.history, historyDetail),
  };

  const risk_score = clamp01(
    factors.wind.contribution +
      factors.canopy.contribution +
      factors.flood.contribution +
      factors.history.contribution,
  );

  const storm_context = buildStormContext(weather);

  return {
    risk_score: Math.round(risk_score * 100) / 100,
    risk_tier: tierFor(risk_score),
    factors,
    storm_context,
  };
}

function buildStormContext(weather: WeatherSnapshot): string {
  const parts: string[] = [];
  if (weather.conditions) parts.push(weather.conditions);
  if (weather.temperatureC !== undefined) parts.push(`${Math.round(weather.temperatureC)}°C`);
  if (weather.windSpeedKmh) parts.push(`winds ${Math.round(weather.windSpeedKmh)} km/h`);
  if (weather.windGustKmh) parts.push(`gusts ${Math.round(weather.windGustKmh)} km/h`);
  if (weather.alerts.length) parts.push(`alerts: ${weather.alerts.join(", ")}`);
  if (!parts.length) return "no live weather signal";
  return parts.join(" · ");
}

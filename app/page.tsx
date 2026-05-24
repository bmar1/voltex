"use client";

import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { ResultsView } from "@/components/ResultsView";
import type { AssessResponse } from "@/lib/types";

const LOADING_STEPS = [
  "Geocoding location",
  "Fetching live weather",
  "Scoring risk factors",
  "Generating operator brief",
];

export default function Home() {
  const [result, setResult] = useState<AssessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function runAssessment(location: string) {
    setLoading(true);
    setError(null);
    setStep(0);
    const stepTimer = setInterval(() => {
      setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 700);
    try {
      const res = await fetch("/api/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as AssessResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 pt-16 pb-24">
      <div className="flex w-full max-w-3xl flex-col items-center gap-10">
        <div className="flex w-full flex-col items-center gap-3 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/60">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }}
            />
            GridGuard
          </span>
          <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Storm outage risk, before it happens.
          </h1>
          <p className="max-w-xl text-balance text-base text-white/60">
            Enter any Ontario location and get a transparent risk score across wind,
            canopy, flood exposure and recent outage history — with an LLM-written
            recommendation for the operations supervisor on duty.
          </p>
        </div>

        <div className="w-full">
          <SearchBar onSubmit={runAssessment} loading={loading} />
        </div>

        {loading && (
          <div className="gg-card-strong w-full max-w-md p-4">
            <ul className="flex flex-col gap-2">
              {LOADING_STEPS.map((label, i) => {
                const active = i === step;
                const done = i < step;
                return (
                  <li key={label} className="flex items-center gap-3 text-sm">
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-colors duration-200`}
                      style={{
                        background: done
                          ? "var(--risk-low)"
                          : active
                            ? "var(--accent)"
                            : "rgba(255,255,255,0.2)",
                        boxShadow: active ? "0 0 10px var(--accent)" : "none",
                      }}
                    />
                    <span className={done ? "text-white/50" : active ? "text-white" : "text-white/40"}>
                      {label}
                      {active && "..."}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {error && (
          <div className="w-full max-w-md rounded-xl border border-red-400/30 bg-red-500/5 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !result && (
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                title: "Weighted, not opaque",
                body: "Wind 30 · Canopy 25 · Flood 20 · History 25. Every factor explained.",
              },
              {
                title: "Public datasets only",
                body: "Environment Canada · Toronto Open Data · NRCan flood layers.",
              },
              {
                title: "Operator-ready",
                body: "Each result includes a 3–5 sentence action brief for dispatch.",
              },
            ].map((card, i) => (
              <div
                key={card.title}
                className={`gg-card gg-enter gg-enter-${i + 1} p-4`}
              >
                <p className="text-sm font-medium text-white">{card.title}</p>
                <p className="mt-1 text-xs text-white/55">{card.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {result && !loading && (
        <div className="mt-16 w-full flex justify-center">
          <ResultsView data={result} onReset={() => setResult(null)} />
        </div>
      )}
    </main>
  );
}

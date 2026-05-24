"use client";

import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  defaultValue?: string;
  loading?: boolean;
  onSubmit: (value: string) => void;
}

const SUGGESTIONS = [
  "Scarborough, Ontario",
  "Mississauga, Ontario",
  "Ottawa, Ontario",
  "Hamilton, Ontario",
  "North Bay, Ontario",
];

export function SearchBar({ defaultValue = "", loading, onSubmit }: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    if (!v || loading) return;
    onSubmit(v);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className="flex items-center gap-2 rounded-2xl border px-3 py-2 backdrop-blur-md gg-card-strong"
        style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-5 w-5 shrink-0 text-white/40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          name="location"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter a location in Ontario..."
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
          className="flex-1 bg-transparent text-base text-white placeholder:text-white/30 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="gg-press inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-medium text-black disabled:opacity-40"
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              Assessing
            </>
          ) : (
            <>
              Assess risk
              <kbd className="ml-1 hidden rounded bg-black/10 px-1.5 py-0.5 font-mono text-[10px] text-black/60 sm:inline">
                ⏎
              </kbd>
            </>
          )}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            onClick={() => {
              setValue(s);
              onSubmit(s);
            }}
            className="gg-press rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:border-white/20 hover:text-white disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </form>
  );
}

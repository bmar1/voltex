import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Voltex storm outage risk map for Ontario";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#101216",
          color: "#e8eaed",
          fontFamily: "system-ui, sans-serif",
          padding: 64,
        }}
      >
        <svg width="96" height="96" viewBox="0 0 64 64" fill="none">
          <path
            d="M 10 40 A 22 22 0 0 1 54 40"
            stroke="#e8eaed"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line x1="22" y1="34" x2="22" y2="46" stroke="#e8eaed" strokeWidth="2" strokeLinecap="round" />
          <line x1="32" y1="30" x2="32" y2="46" stroke="#e0a458" strokeWidth="2" strokeLinecap="round" />
          <line x1="42" y1="34" x2="42" y2="46" stroke="#e8eaed" strokeWidth="2" strokeLinecap="round" />
          <line x1="9" y1="52" x2="55" y2="52" stroke="#e8eaed" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div
          style={{
            marginTop: 32,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          Voltex
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 30,
            color: "#9aa3ad",
            textAlign: "center",
            maxWidth: 880,
            lineHeight: 1.35,
          }}
        >
          Ontario storm outage risk on a hex zone map for utility operators
        </div>
      </div>
    ),
    { ...size },
  );
}

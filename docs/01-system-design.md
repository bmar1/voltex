# System Design

GridGuard is a map-first outage-risk dashboard for Ontario utility operators. It combines live weather, local static geospatial indices, transparent weighted scoring, and a Gemini-generated situation report into a single operational view.

This document describes the production system shape, runtime flows, data boundaries, and main design tradeoffs.

## Goals

GridGuard is designed to answer three operational questions quickly:

- Where are outage hotspots likely right now?
- Why is a zone risky?
- What should a control-room supervisor do next?

The current implementation is a deployable Next.js application rather than a utility SCADA or outage-management system. It intentionally favors explainability and public-data reproducibility over black-box prediction.

## High-Level Architecture

```mermaid
flowchart TB
  operator[Utility operator] --> browser[Browser dashboard]

  browser --> page[Next.js App Router UI]
  page --> batch[/POST /api/assess-batch/]
  page --> assess[/POST /api/assess/]
  page --> narrative[/POST /api/narrative/]

  batch --> weather[Environment Canada weather]
  assess --> geocode[Nominatim geocoding]
  assess --> weather
  narrative --> gemini[Gemini API]

  batch --> scoring[Scoring engine]
  assess --> scoring
  scoring --> derived[(Derived local indices)]

  derived --> canopy[Vegetation/canopy index]
  derived --> floods[Flood footprint index]
  derived --> outages[Outage-history proxy index]

  assess --> gemini
  assess --> response[Risk assessment + SITREP]
  batch --> board[Ontario risk board]
  narrative --> sitrep[Operator SITREP]

  response --> browser
  board --> browser
  sitrep --> browser
```

## Runtime Components

### Frontend

The frontend is a Next.js client-rendered dashboard with Leaflet map ownership isolated in `components/RiskDashboard.tsx`.

Core UI responsibilities:

- Render Ontario-wide monitored city pins.
- Track map viewport and show an exploration HUD.
- Let operators add custom Ontario locations.
- Open a detail panel for any selected city or custom assessment.
- Auto-request an operator briefing when a pin is selected.
- Switch theme and notify external map state via `gg-theme-change`.

Key components:

- `TopNav`: brand, mode switch, methodology navigation.
- `RiskDashboard`: Leaflet map, batch scoring, pins, viewport-aware HUD, search.
- `BriefingReport`: parsed SITREP rendering with report metadata.
- `RiskGauge`: score/tier visualization.
- `FactorBreakdown`: factor-level explainability.

### API Layer

The API layer is implemented as Next.js route handlers running in the Node.js runtime.

Endpoints:

- `POST /api/assess-batch`: scores monitored cities without LLM generation. Used on dashboard load and refresh.
- `POST /api/assess`: geocodes a user location, fetches weather, scores risk, and returns an LLM narrative.
- `POST /api/narrative`: generates a narrative from an already scored assessment payload.

The split keeps the map load fast and avoids making one LLM call per monitored city.

### Data and Model Layer

Local static datasets are transformed into small JSON indices by `scripts/build-indices.mjs`.

Runtime lookup happens through `lib/datasets.ts`:

- Tree canopy / vegetation density.
- Flood exposure via point-in-footprint or nearest footprint distance.
- Outage-history proxy using Toronto 311 data and provincial fallbacks.

Risk calculation happens in `lib/scoring.ts` and produces:

- `risk_score`: normalized value rounded to two decimals.
- `risk_tier`: Low, Medium, or High.
- `factors`: raw values, normalized values, weights, contributions, and details.
- `storm_context`: compact weather summary.

## Request Flow: Dashboard Load

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant D as RiskDashboard
  participant API as /api/assess-batch
  participant W as Environment Canada
  participant S as Scoring Engine
  participant L as Local Indices

  B->>D: Load / dashboard
  D->>API: POST monitored Ontario cities
  API->>W: Fetch nearest live weather per city
  API->>S: Score each city with concurrency limit
  S->>L: Lookup vegetation, flood, outage history
  L-->>S: Factor inputs
  S-->>API: Slim risk result per city
  API-->>D: results[], errors[], generated_at
  D->>D: Render pins, counts, explore HUD
```

Operational notes:

- Batch concurrency is limited to avoid overloading external weather services.
- LLM calls are intentionally excluded from batch scoring.
- Partial failure is allowed: successful cities render while failures are returned in `errors`.

## Request Flow: Custom Location

```mermaid
sequenceDiagram
  autonumber
  participant O as Operator
  participant UI as Dashboard UI
  participant A as /api/assess
  participant G as Nominatim
  participant W as Environment Canada
  participant S as Scoring Engine
  participant L as Local Indices
  participant M as Gemini

  O->>UI: Search Ontario address / city / postal code
  UI->>A: POST { location }
  A->>G: Geocode to coordinates and FSA when available
  A->>W: Fetch nearest live weather
  A->>S: Score coordinates
  S->>L: Lookup local and provincial static signals
  L-->>S: Factor inputs
  S-->>A: risk_score, risk_tier, factors
  A->>M: Generate SITREP
  M-->>A: Structured briefing text
  A-->>UI: Full AssessResponse
  UI->>UI: Add custom pin, fly to location, open detail panel
```

## Request Flow: Briefing on Pin Selection

```mermaid
stateDiagram-v2
  [*] --> PinUnselected
  PinUnselected --> PinSelected: operator clicks pin
  PinSelected --> BriefingLoading: no cached briefing
  PinSelected --> BriefingReady: cached briefing exists
  BriefingLoading --> BriefingReady: Gemini or local fallback returns
  BriefingLoading --> BriefingError: API failure
  BriefingError --> BriefingLoading: retry
  BriefingReady --> PinSelected: select another pin
```

Briefing behavior:

- Custom `/api/assess` responses include `llm_narrative` immediately.
- Monitored city pins fetch a narrative lazily through `/api/assess` or `/api/narrative` patterns.
- `lib/llm.ts` returns `source: gemini | local` so the UI can label fallback output.

## Data Flow and Trust Boundaries

```mermaid
flowchart LR
  subgraph External[External systems]
    nom[Nominatim]
    wx[Environment Canada]
    ai[Gemini API]
    public[Public dataset portals]
  end

  subgraph BuildTime[Build-time/local refresh]
    raw[Raw CSV/GeoJSON]
    builder[build-indices.mjs]
    idx[Derived JSON indices]
  end

  subgraph Runtime[Runtime app]
    api[Next.js API routes]
    score[Scoring engine]
    ui[Operator dashboard]
  end

  public --> raw --> builder --> idx
  ui --> api
  api --> nom
  api --> wx
  api --> score
  idx --> score
  api --> ai
  score --> api --> ui
```

Trust boundaries:

- Browser input is untrusted and validated at API route boundaries.
- External APIs are unreliable and wrapped with timeouts where applicable.
- Local derived indices are trusted application data but should be regenerated from documented sources.
- LLM output is advisory, labelled by source, and should never be the only operational control.

## Scoring Model

```mermaid
flowchart TD
  wind[Live wind and gust] --> nw[Normalize wind against 100 km/h]
  canopy[Canopy or vegetation density] --> nc[Normalize local density]
  flood[Flood footprint exposure] --> nf[Inside footprint or distance decay]
  history[Storm-related history proxy] --> nh[Normalize against max count]

  nw --> weighted[Weighted sum]
  nc --> weighted
  nf --> weighted
  nh --> weighted

  weighted --> score[Risk score 0.00-1.00]
  score --> tier{Tier}
  tier --> low[Low: < 0.40]
  tier --> medium[Medium: 0.40-0.69]
  tier --> high[High: >= 0.70]
```

Current weights:

- Wind: `0.30`
- Canopy / vegetation: `0.25`
- Flood exposure: `0.20`
- Outage-history proxy: `0.25`

Formula:

```text
risk_score = clamp01(
  0.30 * wind
+ 0.25 * canopy
+ 0.20 * flood
+ 0.25 * history
)
```

## Deployment View

```mermaid
flowchart TB
  user[Operator browser] --> edge[Hosting platform / CDN]
  edge --> next[Next.js server]

  subgraph NextRuntime[Node.js runtime]
    pages[App Router pages]
    apis[API routes]
    libs[Scoring + data libs]
  end

  next --> pages
  next --> apis
  apis --> libs
  libs --> data[(datasets/derived JSON)]
  apis --> ext1[Nominatim]
  apis --> ext2[Environment Canada]
  apis --> ext3[Gemini]

  subgraph Build[Build step]
    install[npm install]
    indices[npm run build:data]
    compile[next build]
  end

  install --> indices --> compile --> next
```

Recommended production deployment characteristics:

- Node.js runtime with filesystem access to `datasets/derived`.
- Environment variable `GEMINI_API_KEY` set only on the server.
- Static raw datasets kept out of the deployed bundle unless required for refresh jobs.
- `npm run build:data` run before `next build` or as a scheduled refresh pipeline.
- Health check against `/` and a lightweight synthetic check against `/api/assess-batch` with one city.

## Failure Modes

```mermaid
flowchart TD
  start[Assessment request] --> geocode{Geocode succeeds?}
  geocode -- no --> fail400[Return API error]
  geocode -- yes --> weather{Weather succeeds?}
  weather -- no --> fail500[Return API error or fallback if implemented]
  weather -- yes --> data{Derived data available?}
  data -- no --> partial[Score with zero or fallback factors]
  data -- yes --> score[Compute score]
  partial --> score
  score --> llm{Gemini succeeds?}
  llm -- yes --> gemini[SITREP source: gemini]
  llm -- no --> local[SITREP source: local]
  gemini --> done[Return assessment]
  local --> done
```

Important behavior:

- LLM failure should not block risk scoring.
- Dataset gaps should be visible in factor details.
- Batch scoring should tolerate per-city failures.

## Current Limitations

- Public data is used as a proxy for utility-owned outage and feeder data.
- Flood data is based on NRCan product footprints, not legal floodplain maps.
- Vegetation quality varies by region; Toronto has higher-resolution canopy data than northern Ontario.
- The score is a transparent heuristic, not a trained probabilistic outage model.
- No authentication or role-based access control is implemented yet.

## Production Evolution

```mermaid
flowchart LR
  v0[Current demo] --> v1[Authenticated utility dashboard]
  v1 --> v2[Utility feeder + asset GIS ingestion]
  v2 --> v3[Historical outage labels + calibrated model]
  v3 --> v4[OMS/crew workflow integration]
  v4 --> v5[Post-storm feedback loop]
```

Highest-value production additions:

- Real feeder topology and critical-load overlays.
- Utility outage event labels for model calibration.
- Storm forecast ingestion, not only current weather.
- Audit log of operator decisions and exported reports.
- Authentication, tenant isolation, and role-based access control.

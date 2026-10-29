# Next.js Framework Compliance

This project utilizes **Next.js 16.2.4** with the App Router. All framework-specific implementations (routing, rendering boundaries, metadata, layouts, or framework-specific behavior) must strictly follow the official Next.js 16 documentation. Do not apply legacy conventions from versions prior to 15/16.

# Project Philosophy

This repository is dedicated to building a **procedural fantasy map generator**. The engine follows a layered approach where each system builds upon the output of the previous one. The goal is a deterministic, scalable, and modular world-generation engine.

# Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Library:** React 19
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v4
- **Geometry:** `d3-delaunay` for mesh calculations
- **State:** Zustand (persistent middleware)

# Development & Coding Standards

To maintain a clean and scalable codebase, all contributors and AI agents must adhere to these strict rules:

### 1. Component Structure

- **Single Responsibility:** Each `.tsx` file must export **exactly one** default component.
- **File Length:** Components must be concise. Limit files to a maximum of **200 lines of code**. If a component exceeds this, extract sub-components or move logic to hooks/utils/services.

  **Exceptions** (files allowed to exceed 200 lines when atomic and single-responsibility):
  - **Page-level views** (`src/views/[PageName]/index.tsx`)
  - **Core services or generators** (e.g., `src/services/*`)
  - **Large feature components** with a single well-defined responsibility
  - Files with **closely related constants, configurations, or type definitions**

- **Props Definition:** Must always be named `TProps`. If not exported, define locally:
  `type TProps = { ... }` or `interface TProps { ... }`
- Never create trivial wrapper components that only forward props.

### 2. File Placement Rules

- **Pages** (`app/`):
  - Keep `app/[route]/page.tsx` **thin** — no implementation logic.
  - Import and render a View component from `src/views/`.

    ```tsx
    // app/page.tsx
    import HomeView from 'src/views/HomeView';

    export default function Home() {
      return <HomeView />;
    }
    ```

- **Views** (`src/views/[PageName]/`):
  - Page compositions and layout orchestration.
  - Example: `src/views/HomeView/index.tsx`, `src/views/HomeView/MapCanvasPanel.tsx`

- **Components** (`src/components/`):
  - General/reusable UI components, grouped in subfolders.
  - Example: `src/components/AppDialog/MapConfigDialog.tsx`, `src/components/MapLayout/HoverCellOverview.tsx`, `src/components/ui/button.tsx`

- **Services (Domain Logic)** (`src/services/`):
  - All non-hook business logic and core calculations.
  - Organized by domain: `src/services/terrain/`, `src/services/hydrology/`, `src/services/geopolitics/`, `src/services/rendering/`, `src/services/logistics/`, `src/services/utils/`, `src/services/pipeline/`

- **Configuration** (`src/configs/`):
  - Constants, default values, and configuration objects.
  - Example: `src/configs/map/common.ts`, `src/configs/map/hydrology.ts`

- **Hooks** (`src/hooks/`):
  - All custom React hooks.

- **State Management**:
  - Zustand stores → `src/store/`
  - React Context → `src/contexts/`

- **Styles** (`src/styles/`):
  - Global style files (.css).

- **Types** (`src/types/`):
  - All shared TypeScript types and interfaces.

### 3. TypeScript Naming Conventions & Management

- **Uniform Prefix:** All type definitions, whether using `type` or `interface`, must start with a capital **T**.
  - _Example (Interface):_ `interface TCell { ... }`
  - _Example (Type):_ `type TPoint = [number, number]`
- **Centralized Type Management:** All types and interfaces intended for shared use across multiple files/modules **must** be located within the `src/types/` directory.
  - General shared types should be placed in `src/types/global.ts`.
  - If a group of types serves a specific, large-scale purpose (e.g., `mesh`, `biomes`), create a dedicated file: `src/types/[category].ts`.
  - Do not define shared types inside components or feature folders.

### 4. Styling with Tailwind CSS

- **Utility First:** Use **Tailwind utility classes** by default.
- **Standard over Arbitrary:** Prefer standard scale values (`p-4`, `gap-2`, `mt-6`) over arbitrary values (`p-[17px]`) unless strictly necessary.

### 5. Architecture Rules

- `app/` → thin routing + metadata only.
- `src/views/` → page compositions (orchestrating UI components).
- `src/services/` → all domain logic, organized by domain (terrain, hydrology, geopolitics, rendering, pipeline, logistics, utils).
- `src/configs/` → configuration and constants.
- `src/components/` → reusable UI components.
- `src/store/` + `src/contexts/` → state management.
- `src/types/` → canonical location for all shared types.
- All world-generation randomness must go through `createSeededRandom()` from `src/services/utils/math.ts` (deterministic generation with FNV-1a hashing + LCG).

# Roadmap & Evolution (Pipeline Layers)

The development process is structured into sequential phases. Each layer builds upon the output of the previous one:

1. **Mesh** – Voronoi/Delaunay geometry
2. **Topography** – Elevation, tectonics, terrain classification
3. **Hydrology** – Rivers, lakes, climate (temperature, precipitation, wind)
4. **Population** – Population & economy distribution
5. **Geopolitics** – Nations, provinces, ethnic regions, capitals, economic hubs

# Project Navigation

1. `app/` — Routing and Metadata (thin)
2. `src/views/` — Page-level compositions and main UI layouts
3. `src/services/` — Domain logic organized by domain
   - `terrain/` — Mesh, topography, landform/biome classification
   - `hydrology/` — Rivers, lakes, temperature, precipitation, wind, climate
   - `geopolitics/` — Nations, provinces, ethnic regions, population, capitals
   - `rendering/` — Canvas rendering engine
   - `logistics/` — Route finding (Dijkstra)
   - `utils/` — Math, geometry, graph algorithms, collections
   - `pipeline/` — MapGenerator orchestrator
4. `src/configs/` — Constants, default values, configuration objects
5. `src/components/` — Reusable UI components
6. `src/store/` — Zustand state management
7. `src/contexts/` — React Context providers
8. `src/hooks/` — Shared React hooks
9. `src/types/` — **Canonical directory for all shared Type/Interface definitions**

# Testing Rules

- **Never run tests on your own.** This covers `npm test`, `npm run test:full`, `npm run test:e2e`, `vitest`, `playwright test` and `npm run bench:map`, including running a single file or a single case. To run any of them, ask the user first and get their confirmation, every time. Approval for one run does not carry over to the next.
- Static checks are fine to run without asking: `npm run typecheck`, `npm run eslint`, `prettier --check`, `npm run build`.
- Once the user has approved a run: after changing generation code, run `npm test`, and `npm run test:full` for large changes; after changing UI, run `npm run test:e2e`.
- Write or update tests freely, but do not execute them.
- Reports are written to `test-reports/` (gitignored).

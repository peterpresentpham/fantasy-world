# Next.js 16.2.4 Agent Guidelines

This project uses **Next.js 16.2.4 (App Router)** with React 19 and TypeScript (strict). All framework features (routing, metadata, layouts, rendering) must follow official Next.js 16 documentation.

## Core Philosophy

Procedural fantasy map generator built with a **layered, deterministic, and modular** architecture.

**Tech Stack:**

- Next.js 16.2.4 (App Router)
- React 19 + TypeScript (Strict)
- Tailwind CSS v4
- d3-delaunay (geometry)

## Strict Coding Standards

### 1. Component & Code Organization Rules

- Each `.tsx` file must export **exactly one** default component.
- Each `.tsx` file should ideally be kept **≤ 200 lines** to maintain readability and ease of maintenance.
- If a file exceeds 200 lines, extract sub-components or move logic out to hooks, utils, or services.
- **Never** create trivial wrapper components that only forward props.
- Props interface/type must always be named `TProps`.

**Exceptions – Files are allowed to exceed 200 lines when:**

The file is **atomic** (self-contained with a single clear responsibility) and falls into one of the following cases:

- **Page-level views** (`src/views/[PageName]/index.tsx` or `src/views/MapView/index.tsx`) that contain the overall layout and orchestration of an entire page.
- **Core services or generators** with concentrated, focused logic (e.g. `src/services/map-service.ts`, `src/services/heightmap-generator.ts`, `src/services/river-generator.ts`).
- **Large feature components** that have a single, well-defined responsibility and cannot be reasonably split further (e.g. complex Canvas renderer, SVG map renderer, or main editor component).
- Files that primarily contain **closely related constants, configurations, or type definitions**.

**Important Guideline:**

- Regular UI components should almost never exceed 200 lines.
- Always prefer extracting logic into custom hooks, services, or utilities before allowing a component to grow too large.

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

### 3. TypeScript Conventions

- All types and interfaces must be prefixed with **`T`**.
  - Example: `type TCoordinate = [number, number]`

- **Default Rule**: Most shared types should be placed in `src/types/global.ts`

- **When to create separate files**:
  - For types related to a specific domain or API group (e.g., user-related types) → create a dedicated file like `src/types/user.ts`
  - For types belonging to a large page or complex feature (e.g., types used in the Caro game page) → create a dedicated file like `src/types/caro.ts`

- Do **not** define shared types inside components or feature folders.

### 4. Styling

- Use **Tailwind utility classes** by default.
- Prefer standard scale values (`p-4`, `gap-2`, `mt-6`) over arbitrary values (`p-[17px]`) unless strictly necessary.

### 5. Architecture

- `app/` → thin routing + metadata only.
- `src/views/` → page compositions (orchestrating UI components).
- `src/services/` → all domain logic, organized by domain (terrain, hydrology, geopolitics, rendering, pipeline, logistics, utils).
- `src/configs/` → configuration and constants.
- `src/components/` → reusable UI components.
- `src/store/` + `src/contexts/` → state management.
- `src/types/` → canonical location for all shared types.
- All world-generation randomness must go through `createSeededRandom()` from `src/services/utils/math.ts` (deterministic generation with FNV-1a hashing + LCG).

## Development Flow (Pipeline Layers)

1. **Mesh** – Voronoi/Delaunay geometry
2. **Topography** – Elevation, tectonics, terrain classification
3. **Hydrology** – Rivers, lakes, climate (temperature, precipitation, wind)
4. **Population** – Population & economy distribution
5. **Geopolitics** – Nations, provinces, ethnic regions, capitals, economic hubs

## Testing Rules

- **Never run tests on your own** (`npm test`, `npm run test:full`, `npm run test:e2e`, `vitest`, `playwright test`, `npm run bench:map`, including a single file or case). Ask the user and get confirmation first, every time; one approval does not carry over.
- Static checks (`npm run typecheck`, `npm run eslint`, `prettier --check`, `npm run build`) may run without asking.
- Writing or updating tests is fine; executing them is not, without approval.

---

**Follow these rules strictly.** They exist to keep the codebase clean, maintainable, and scalable.

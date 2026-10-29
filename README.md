# Fantasy World

A procedural fantasy world-map generator that runs entirely in the browser. Type a seed and get a complete world: terrain, rivers and lakes, climate and biomes, population, nations, provinces, ethnic regions, capitals and trade hubs. The same seed always produces the same world.

Live: [fantasy.peter-present.xyz](https://fantasy.peter-present.xyz/)

## What you can do

- Generate a world from a seed, pick a terrain style (`balanced`, `ranges`, `rifted`, `archipelago`, `volcanic`, `continental`) and tune sea level, climate, cell count and number of nations.
- Switch views from the toolbar: landform, biome, political, ethnic, climate, population; toggle rivers and labels; view in 2D, isometric or 3D.
- Zoom and pan the map, hover a cell for its stats, click a nation or ethnic group for a detail panel.
- Paint terrain by hand, find logistics routes between two points, and export or import a world as JSON.
- Keyboard: `R` random seed, `1`–`6` views, `+` `-` `0` zoom, `Esc` close panels.

## Run it

Requires Node 20+ and npm.

```bash
npm install
npm run dev        # http://localhost:4001
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run eslint     # lint
npm run test       # unit + invariant tests (vitest)
npm run test:e2e   # browser tests (first: npx playwright install chromium)
```

## Learn more

- [documents/](./documents/) explains how the generator works and where it is going.
- [CLAUDE.md](./CLAUDE.md) holds the coding conventions and architecture rules.

Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, Zustand, d3-delaunay and Three.js.

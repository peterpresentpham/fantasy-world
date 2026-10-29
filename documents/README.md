# Documents

| File                                         | What it covers                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| [architecture.md](./architecture.md)         | Project layout, generation pipeline, worker and cache, state, rendering, UI |
| [world-generation.md](./world-generation.md) | How each stage builds the world: mesh, terrain, climate, population         |
| [hydrology.md](./hydrology.md)               | Rivers and lakes in detail                                                  |
| [geopolitics.md](./geopolitics.md)           | Nations, provinces, ethnic regions, capitals, borders                       |
| [roadmap.md](./roadmap.md)                   | What is done, known realism problems and the planned fixes                  |

These describe the code as it is today. When you change an algorithm, update the matching file in the same PR. Constants live in `src/configs/map/`; the docs name them rather than copying values.

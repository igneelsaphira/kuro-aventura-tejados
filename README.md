# Kuro: Aventura de Tejados

A standalone cozy rooftop game: run with Kuro through Santiago at night, double jump, and collect golden stars. Opens directly into the game, without the cleaning app, accounts, or cloud services.

## Run locally

Requires Node.js 22 LTS and npm.

```sh
npm ci
npm run web
```

Open http://localhost:8082. The game fills the browser viewport in desktop, portrait, and landscape layouts. Click **Jugar**, then click, tap, press **Space**, **Arrow Up**, or **W** to jump. You can jump twice before landing. Missing a gap makes Kuro fall and ends the run; **Volver a intentar** restarts. Press **P** or **Escape**, or use the pause button, to pause/resume. Switching away pauses automatically. Scores and the best score last for the current page session.

```sh
npm test       # deterministic gameplay regression tests
npm run build  # static web build in dist/
npm start     # Expo development server for mobile
```

## Visual update handoff

The `codex/visual-polish-handoff` branch contains the current playable version.
Use this branch when opening the project in another coding harness; these updates
have not been merged into `main`.

- Jump frames follow vertical velocity and return to the running sheet on landing.
- The secondary city uses `santiago-urban-depth-cutout.png`, with opaque buildings
  and transparent sky, in front of the main skyline and behind playable roofs.
- Rooftop facade rendering and the full moon crop from `moon-phases.png` are included.
- Earlier urban artwork variants are retained as source references; the current
  renderer only loads the cutout version.
- Gameplay physics remain in `src/game/engine.mjs`; Kuro remains 64 x 44.

Run `npm ci`, `npm test`, and `npm run build` after checkout. For an interactive
preview, run `npm run web` and open http://localhost:8082. A static hosting harness
can serve `dist/` after the build. No Codex-specific runtime is required.

## Project layout

- `App.js`: standalone full-screen entry point.
- `src/minigames/RooftopAdventureGame.js`: responsive scene, input, animation, and game screens.
- `src/game/engine.mjs`: deterministic platform generation, gravity, landing, double jumps, and scoring.
- `tests/engine.test.mjs`: falls, gap crossing, edge grace, scoring, pause, and resize regression coverage.
- `assets/kuro/`: cat sprite sheet, Santiago skyline, and rooftop tiles.

Visible roofs and collision platforms share the same coordinates and scroll speed. The simulation uses fixed 60 Hz steps with requestAnimationFrame rendering. Runs are endless with gradually increasing speed, small edge grace and jump buffering, and stars placed along gap crossings. The rooftop artwork is cropped using its actual uneven sprite bounds. Resizing preserves the current run. No environment variables or backend setup is needed.

## Origin and attribution

Extracted from [igneelsaphira/kuronekoclean](https://github.com/igneelsaphira/kuronekoclean/tree/feature/kuro-aventura-tejados), branch `feature/kuro-aventura-tejados`, commit `d37f6b5ec350d8198f625af8148dabd38af87e9f`. Original game and artwork credit belongs to its creators. This extraction does not assign a new license to the original code or artwork.

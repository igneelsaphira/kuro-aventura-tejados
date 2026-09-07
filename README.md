# Kuro: Aventura de Tejados

A standalone cozy rooftop game: run with Kuro through Santiago at night, double jump, and collect golden stars. Opens directly into the game, without the cleaning app, accounts, or cloud services.

## Run locally

Requires Node.js 22 LTS and npm.

```sh
npm ci
npm run web
```

Open http://localhost:8082. Click **Jugar**, then click, tap, press **Space**, or press **Arrow Up** to jump. You can jump twice before landing. Runs last approximately one minute; **Jugar otra vez** restarts and **Inicio** returns to the title screen. Scores are session-only.

```sh
npm run build  # static web build in dist/
npm start     # Expo development server for mobile
```

## Project layout

- `App.js`: standalone game page and return-to-title flow.
- `src/minigames/RooftopAdventureGame.js`: gameplay, physics, scoring, and rendering.
- `src/theme/tokens.js`: the small set of theme values used by the game.
- `assets/kuro/`: cat sprite sheet, Santiago skyline, and rooftop tiles.

The original game balance and 310 × 245 playfield are preserved as a baseline for polishing. Obstacles remain disabled, matching the source branch. No environment variables or backend setup is needed.

## Origin and attribution

Extracted from [igneelsaphira/kuronekoclean](https://github.com/igneelsaphira/kuronekoclean/tree/feature/kuro-aventura-tejados), branch `feature/kuro-aventura-tejados`, commit `d37f6b5ec350d8198f625af8148dabd38af87e9f`. Original game and artwork credit belongs to its creators. This extraction does not assign a new license to the original code or artwork.

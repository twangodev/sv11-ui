# Visual parity

The reference is ElevenLabs UI at `3a28ebab197f8cfa599934f52db12ad1396e54f4`, recorded in `../fixtures/upstream-parity.json`. The browser fixtures cover all 17 custom UI components and 11 blocks in light/dark mode at desktop/mobile widths.

`pnpm test:browser` checks rendering, theme application, horizontal overflow, and expanded voice-picker/microphone menus. It captures screenshots as test attachments. These are layout and interaction checks, not pixel-equality assertions.

## Compare against upstream

Use Node 24 and a clean checkout at the pinned revision. The reference runs the actual upstream React components. Only server actions and Next's link wrapper are replaced with local fixtures; no authenticated provider calls are made. React dependencies stay in a temporary directory, outside the Svelte project.

```bash
# Prepare and install the reference once.
REFERENCE_DIR=$(node tests/visual/prepare.mjs /path/to/elevenlabs-ui)
pnpm --dir "$REFERENCE_DIR" install --frozen-lockfile
pnpm exec playwright install chromium

# Terminal 1: upstream fixture (port 4176).
pnpm --dir "$REFERENCE_DIR" exec vite

# Terminal 2: Svelte fixture (port 4174).
pnpm exec vite --config tests/browser/vite.config.ts

# Terminal 3: matched screenshots and a comparison report.
node tests/visual/capture.mjs "$REFERENCE_DIR"
```

Open `test-results/visual/index.html`. Each case includes upstream, Svelte, and difference images, plus geometry/runtime details in `results.json`. `COMPONENTS`, `VIEWPORT`, `THEME`, and `VISUAL_OUTPUT` environment variables can narrow or separate runs. Screenshots use 1280px/390px viewport widths, 900px height, the same Geist fonts, device scale 1, and local noise/audio/iframe fixtures.

The reference templates and dependency lockfile are checked in; `prepare.mjs` verifies the upstream revision and copies its unmodified registry into a temporary fixture.

## Review boundaries

The comparison preserves neutral provider APIs, copy, and local sample media. Those differences are intentional. Animated orbs, processing waveforms, presence counters, timers, and server-driven states are not synchronized between frameworks, so raw changed-pixel percentages are diagnostic, not a parity score. Icons can also differ slightly with the React/Svelte Lucide releases. Check those regions visually rather than treating a low whole-image percentage as proof.

Installed components inherit the consumer's shadcn-svelte primitives and theme, which can change their appearance from these repository fixtures.

This pass restores the recorded/realtime transcriber and voice-navigation layouts, conversation gutters, button shadows, markdown spacing/colors, badge/popover/dropdown styling, and Pong’s board/score layout and matrix lettering. Voice navigation stacks its header and Pong scales its score/board row on small screens to keep the controls inside the viewport. Active provider states still need a separate authenticated visual review.

# Tie Dice — Product Requirements

An Owlbear Rodeo extension for running Dungeon Crawl Classics (DCC) games, starting with a dice roller for DCC's non-standard dice. See [GLOSSARY.md](../GLOSSARY.md) for precise terminology used below, and [ADR 0001](./adr/0001-avoid-dcc-trademark-branding.md) for the branding/licensing decision.

## Goals

- Give DCC groups playing on Owlbear Rodeo a roller that actually covers DCC's dice, which no existing OBR dice extension does.
- Ship something useful for the author's own table first; design it cleanly enough that a free public release is a packaging change, not a rewrite.
- Stay clear of Goodman Games' trademarks and copyrighted tables (see ADR 0001) — this is an independent, unofficial tool.

## Roadmap

1. **Phase 1 (this PRD's scope): Dice Roller.** Standalone extension, no character sheet or token integration yet.
2. **Phase 2 (deferred, not yet designed): Character Sheet.** Clickable weapon/item entries that roll a preset die + modifier. Token linking: a Token holds a reference to an independent Character Sheet record, so the sheet survives scene changes and token replacement. Possible stretch: display HP/AC near the linked token.
3. **Phase 3 (potential, not committed): Funnel support.** Multiple Character Sheets per player for DCC's 0-level funnel.
4. **Out of scope indefinitely:** Initiative tracking — the author already uses other extensions for this.

Phases 2 and 3 are intentionally unspecified beyond the above — they get their own design pass when work starts on them.

## Phase 1 Scope: Dice Roller

### Supported dice

A flat, rollable set — no chain-shift / advantage-disadvantage logic, no shift-by-N-steps mechanic. The Judge or player decides which die to roll per the table rules; the roller doesn't try to compute it for them.

d3, d4, d5, d6, d7, d8, d10, d12, d14, d16, d20, d24, d30, d100.

### Rolling

- Tray-style: stage one or more dice before rolling, **mixed types allowed** in a single roll (e.g. `1d20 + 1d8` for a Warrior's attack + Deed Die).
- Quantity per die type (e.g. `3d6`).
- A flat **modifier** control sits beside "Secret roll" (for players, who have no secret toggle, it takes the full row): a minus button, the value in the middle, a plus button. It starts at 0, steps by 1 from -20 to +99 (DCC penalties are small, ability modifiers only run -3 to +3, while stacked bonuses such as burned Luck can be large), and always shows its sign (`+3`, `-3`). The number can also be typed in. It is added to the total and shown in the breakdown (`1d6 (6) - 3` → total 3), and it resets to 0 after every roll. The total is not floored: `1d6 (3) - 7` shows a total of -4. A modifier with no dice staged does nothing. There is no formula parsing; richer modifiers (an Item's preset `d8+2`) still belong to Phase 2.
- On roll: show the per-die breakdown (with the modifier) and the total sum.
- Staged dice appear as pills (orange border, circled × to remove one die) with a text-style Clear button after them.
- There is no standing Roll bar. While dice are staged, the previous result in the last-roll card blurs back and a white "Roll the dice" pill with a purple border appears over it; hover and press grow it slightly. After a roll the pill goes away and the card shows the new result.
- Reveal animation: the pill fades out, the big number flickers through totals the dice could actually produce and decelerates onto the real one (about 0.75s in total), then the breakdown fades in. The roll is decided immediately but published to the room only when the number lands, so nobody sees the result before the roller does; closing the popover mid-reveal publishes it right away. People who prefer reduced motion skip the animation. The big card only ever shows the roller's own result; other players' rolls appear only in the history.

### Hidden Roll

- Available only to the GM role (role-gated, not a toggle every player can use). The toggle is labeled "Secret roll" and stays on until switched off, so its on state is the only indicator that the next roll is secret.
- Result is never broadcast to the room and never appears in the shared Roll History.
- Still gets logged — just only into the GM-only view (see below).

### Roll History

- One underlying chronological log (bounded, e.g. last ~20 rolls) — not two separate lists.
- Filtered by viewer role: Players see public rolls only. The GM sees every entry, with Hidden Rolls shown dimmed (70% opacity, plus a screen-reader label) so they're distinguishable without being a separate panel. The last-roll card adds no extra cue for a secret roll.
- A live "last roll" display in addition to the scrollable history.

### Presentation

- **Now**: numeric result display on dark glass surfaces over an animated moving-gradient background (a WebGL2 port of the Figma "Moving gradient" shader). The header has two round glass buttons: a Trippy/Calm button (Lucide sparkles and moon icons) and a pause/play button. The view button shows the current view (sparkles for Trippy, the moon for Calm); the pause button shows the action (play while paused). Icons crossfade with a small turn. Trippy (the default) is the bright palette; Calm is the same swirl in subtle dark greys with lighter glass surfaces and a white logo. Both choices are remembered per browser, and people who prefer reduced motion start paused. No 2D die illustrations and no 3D yet.
- **In progress (branch `3d-dice`)**: procedural 3D dice, skipping an illustrated middle step. The first candidate, three-polydice, has since been deleted from GitHub, so the work is built on [threejs-dice](https://github.com/byWulf/threejs-dice) (MIT, Three.js + cannon.js), vendored in `third_party/threejs-dice/` and ported to TypeScript with current Three.js and cannon-es in `src/dice3d/` (attribution in `THIRD_PARTY_NOTICES.md`). All shapes are generated in code, with no model files:
  - Ported from the library: d4, d6, d8, d10, d12, d20.
  - Built from vertex coordinates (faces come from a convex hull): d14 (heptagonal trapezohedron: 14 kites, with the two points 1.2 times as far from the middle as the ring is wide; taller than that and the kites get too narrow near the middle for two-digit numbers), d16 (sixteen equal-area pentagons, like a rounder d12; with no opposite faces, a tie for the top is settled by handedness so every face can be read), d24 (deltoidal icositetrahedron), d30 (rhombic triacontahedron).
  - Built another way: d5 is a thin triangular prism (1 and 5 on the ends, 2-4 on the sides), read from the bottom face like a d4, with a big number on each end and the bottom face's number repeated along the top ridge; d7 is a Chestahedron (seven faces: four equilateral triangles and three kites, all exactly the same area; a triangular base, three triangles rising from its edges and three kites meeting at the top), numbered 1-7; d3 is a cube numbered 1-3 twice; d100 is two d10s, a percentile die (00-90) and a units die (0-9), read as tens plus units with 00 and 0 meaning 100.
  - Numbers stay where they are: each die keeps its numbers in the same spots on every roll, as a real die does. Almost every die is symmetric: some rotation turns any face into any other and leaves the die looking the same. So when a throw lands on the wrong face, the die's starting pose is turned by the symmetry that carries the wanted face onto the face it landed on, and the throw plays out the same way but ends on the wanted face. That takes about 2 throws on average, a few milliseconds. The d5 uses the same trick within its sides and within its ends (landing on a side when an end is needed means a fresh throw). The exception is the d7: its faces are not interchangeable (three kinds of face, and the base triangle never ends up on top), so no throw can show every number from a fixed layout, and its numbers cycle around to match the roll.
  - Rolls are rigged, not simulated for their result: the number is decided first (crypto RNG, as now, with equal odds for every face), the throw is simulated to rest in the background and steered as above, and the identical throw is replayed. Each die gets its own lane of the floor (one die gets the whole floor), with walls only it feels, so dice never touch; that keeps every throw independent, which is what makes the steering work in a crowd (ten d20s average about 2 throws and 30ms). If a roll cannot be steered within about 250ms, the dice that did not fit reprint their numbers as a last resort. Physical fairness of a shape does not matter, only how it looks; for example the d7 shape on its own would land on some faces far more than others.
  - Number size: every number is the same physical height on every face of every die, 0.219 of the die's size. That is the height the numbers on the d24 naturally came out at, the smallest of any die, so the whole set matches it; the numbers on the d14 and d10, for example, are less than half the height they used to be. Numbers are centred on their faces (the ink is measured and centred, and faces that are kites or rhombi map the texture from their real outline) and use Space Grotesk, the app's font.
  - Development-only page: open `/?dice3d` on the dev server. It is stripped from production builds, so none of the 3D code ships yet. It has live size controls per die.

## Non-goals for Phase 1

- No character sheet, no token linking, no initiative tracking (see Roadmap).
- No formula input on rolls (a flat modifier is supported; there is no dice-expression parsing).
- No chain-shift / advantage-disadvantage die substitution.
- No reproduced official DCC tables (crit/fumble/spell tables) — see ADR 0001.

## Future Phase Considerations

Notes carried over from Phase 1 discussion, for whenever Phase 2/3 design starts. None of this is committed or specified — it's context so the next design pass doesn't start from zero.

### Phase 2: Character Sheet

- Items on the sheet are clickable to roll (e.g. a weapon entry rolls its own die).
- An Item can carry a preset die + modifier (e.g. weapon damage = `d8+2`) that rolls automatically when clicked, rather than requiring the player to pick dice and do math each time.
- Some rolls are inherently compound, not just die+modifier — e.g. a Warrior's attack rolls action die + Deed Die together (`1d20 + 1d8`). Sheet rolling likely needs to reuse the same mixed-type tray mechanism built for Phase 1 rather than a simpler single-die-plus-modifier model.
- Possible UX nicety (not required): right-click/cmd-click an item to roll an alternate die for that action — representing DCC's advantage/disadvantage-style die swaps (e.g. d16 instead of d20 for a two-handed weapon's initiative). The Judge can always just say which die to use verbally, so this is a convenience, not a dependency.
- Token linking: a Token holds a reference (ID) to an independent Character Sheet record (see [GLOSSARY.md](../GLOSSARY.md)), so the sheet survives scene changes and token replacement.
- Stretch goal: display current HP/AC near the linked token on the map, if feasible.
- Worth revisiting the Goodman Games Third-Party License (see ADR 0001) before adding anything table-driven (crit/fumble tables, spell tables) to the sheet — that's the point where reproducing official content would first become tempting.

### Phase 3: Funnel support (potential, not committed)

- Multiple Character Sheets per player, since DCC funnels start each player with 3-4 disposable 0-level characters.
- Not yet explored: how a player manages/switches between multiple linked sheets and tokens at once, and how mid-funnel character death and replacement should work.

## Technical Approach

- **Platform**: Owlbear Rodeo extension via `@owlbear-rodeo/sdk`. (Note: OBR's SDK has no hook to extend the native dice roller in place — it's a separate first-party extension — so this is built as a fully independent extension, which was the plan anyway.)
- **Relevant SDK primitives**: room metadata (~16kB cap) holds the bounded Roll History, and `OBR.room.onMetadataChange` pushes live updates to every client, so `OBR.broadcast` is not used. `OBR.player.getRole()` gates the secret-roll toggle. There is no built-in chat/log API to hook into.
- **Stack**: TypeScript + React + Vite. Fonts (Host Grotesk) are bundled, not loaded from a CDN. The background uses WebGL2 rather than WebGPU so it works in any Chrome iframe without extra permissions.
- **Hosting**: local development against OBR's local-extension testing flow to start; Vercel when ready to share with the group.

## Branding & Licensing

Project name: **Tie Dice** (earlier working names ZocchiDice and Wacky Dice are retired; the GitHub repo is `jakebuhrig/TieDice`). Does not use "Dungeon Crawl Classics" or "DCC" branding, and reproduces no official Goodman Games tables or text — mechanics only. Goodman Games' free Third-Party Publishing License remains an option to revisit if this goes to public release and official branding/content becomes desirable. Full reasoning in [ADR 0001](./adr/0001-avoid-dcc-trademark-branding.md).

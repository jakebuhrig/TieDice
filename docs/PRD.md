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
- No modifier/formula input (no "+3" field) — mirrors Owlbear Rodeo's own native roller. Modifier support belongs to Phase 2 (an Item's preset die + modifier), not the raw roller.
- On roll: show the per-die breakdown and the total sum.
- Staged dice appear as pills (orange border, circled × to remove one die) with a text-style Clear button after them.
- There is no standing Roll bar. While dice are staged, the previous result in the last-roll card blurs back and a white "Roll the dice" pill with a purple border appears over it; hover and press grow it slightly. After a roll the pill goes away and the card shows the new result.

### Hidden Roll

- Available only to the GM role (role-gated, not a toggle every player can use). The toggle is labeled "Roll in secret" and stays on until switched off, so its on state is the only indicator that the next roll is secret.
- Result is never broadcast to the room and never appears in the shared Roll History.
- Still gets logged — just only into the GM-only view (see below).

### Roll History

- One underlying chronological log (bounded, e.g. last ~20 rolls) — not two separate lists.
- Filtered by viewer role: Players see public rolls only. The GM sees every entry, with Hidden Rolls shown dimmed (70% opacity, plus a screen-reader label) so they're distinguishable without being a separate panel. The last-roll card adds no extra cue for a secret roll.
- A live "last roll" display in addition to the scrollable history.

### Presentation

- **Now**: numeric result display on dark glass surfaces over an animated moving-gradient background (a WebGL2 port of the Figma "Moving gradient" shader). The background has a pause/play button in the header; the choice is remembered per browser, and people who prefer reduced motion start paused. No 2D die illustrations and no 3D yet.
- **Later**: procedural 3D dice, skipping an illustrated middle step. Candidate approach: [three-polydice](https://github.com/manthrax/three-polydice) (MIT, Three.js + Ammo.js) already procedurally generates d14/d16/d20/d24/d30/d100 via closed-form geometry (no hand-made model assets); d3/d5/d7 aren't covered yet but are simple enough shapes to extend the same way.

## Non-goals for Phase 1

- No character sheet, no token linking, no initiative tracking (see Roadmap).
- No modifiers/formulas on rolls.
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

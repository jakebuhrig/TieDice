# Tie Dice

An Owlbear Rodeo extension implementing Dungeon Crawl Classics (DCC) tooling: starting with a dice roller for DCC's full dice chain, later extended with a character sheet linked to tokens.

## Language

**Extension**:
An Owlbear Rodeo add-on: a small web app loaded via a manifest and the OBR SDK, rendered inside the Owlbear Rodeo UI.
_Avoid_: Plug-in, module, add-on

**Dice Chain**:
DCC's standard set of die sizes (d3, d4, d5, d6, d7, d8, d10, d12, d14, d16, d20, d24, d30, plus d100 as a standalone addition this project also offers). This project surfaces them as a flat set of rollable dice — it does not implement automatic chain-shifting; the Judge or player picks the specific die to roll per the table rules.
_Avoid_: Zocchi dice (that's the physical dice brand DCC's chain popularized, not the rule concept)

**Hidden Roll**:
A roll available only to the GM role. Its result is logged to the GM-only Roll History, never broadcast to the room, and never appears in the shared Roll History — not even masked. Used for secret Judge rolls (e.g. corruption, mercurial magic).

**Modifier**:
A flat number added to (or, when negative, subtracted from) a roll's total, set with the −/+ control before rolling and reset to 0 after each roll. Stored on the roll record and shown in its breakdown, e.g. `1d6 (6) - 3`. Not a formula — it is one signed integer.

**Roll History**:
A single, bounded log of recent rolls (e.g. the last ~20), chronologically ordered. Not two separate lists — one underlying log, filtered by viewer role: Players see it with Hidden Rolls stripped out; the GM sees every entry, with Hidden Rolls flagged so they're distinguishable inline.

**Token**:
An Owlbear Rodeo scene item representing a character or creature on the current map.

**Character Sheet**:
An independent record holding one character's data. Its lifetime is not tied to any single Token — it persists across scenes and survives a Token being deleted or replaced.

**Link**:
A Token holding a reference (ID) to the Character Sheet it represents, so the sheet can be opened from the token. The sheet does not live inside the token.

**Funnel**:
DCC's 0-level character-creation mode where each player simultaneously controls multiple (typically 3-4) disposable 0-level characters. Deferred — not committed to this project yet.

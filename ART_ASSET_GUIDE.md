# ART & AUDIO ASSET GUIDE — দোকান সামলাও! (Dokaan Shamlao)

## 1. Visual Direction
- **Style**: Warm Bangladeshi 2D cartoon arcade aesthetic with bold `#3B2314` ink outlines (`stroke-width="5"`), readable silhouettes, and vibrant market colors (`#C9462C` terracotta red, `#F6C445` mustard gold, `#2E7D32` emerald green, `#FFF8E7` warm cream).
- **Typography**: `@fontsource/baloo-da-2` and `@fontsource/hind-siliguri` for authentic, high-legibility Bangla and English rendering.

## 2. Procedural SVG Character System (`src/game/art/characters.ts`)
- **Dimensions**: `220×290` viewBox with shared `FACE_ANCHOR` (`x: 110, y: 118`).
- **Cast (25 Looks)**: `shopkeeper`, `bhai`, `apa`, `chacha`, `student`, `regular2`, `impatient`, `bargain`, `dadu`, `nani`, `pichchi`, `schoolgirl`, `vip`, `bulk`, `credit`, `angry`, `confused`, `kipta`, `family`, `supplier`, `boss_king`, `boss_tycoon`, `boss_thief`, `boss_storm`, `boss_ghost`.
- **Expressions (7 Overlays)**: `neutral`, `happy`, `angry`, `talk`, `sad`, `surprised`, `blink`.
- **Shopkeeper Outfits (6 Unlockables)**: `outfit_apron`, `outfit_panjabi`, `outfit_lungi`, `outfit_cricket`, `outfit_boss`, `outfit_king`.

## 3. Product Packaging Templates (`src/game/art/products.ts`)
- **Dimensions**: `128×128` viewBox.
- **12 Parametric Templates**: `sack`, `bottle`, `packet`, `box`, `jar`, `bar`, `carton`, `round`, `stick`, `tray`, `umbrella`, `pile` with Bangla product labels (`চাল`, `ডাল`, `তেল`, `লবণ`, `চিনি`, `সেমাই`, `মুড়ি`, etc.).

## 4. Banknotes & Shop Props (`src/game/art/shop.ts`)
- **Bangladeshi Taka Notes**: `৳5`, `৳10`, `৳20`, `৳50`, `৳100`, `৳500`, `৳1000`.
- **Counterfeit Visual Tells (`fakeTell` 0..2)**:
  - `0`: Missing watermark diamond/circle on the right side of the note.
  - `1`: Off-color olive/grey tint on the paper and border.
  - `2`: Missing dashed metallic security thread.

## 5. Procedural Web Audio (`src/game/audio.ts`)
- All sound effects (`arrive`, `tap`, `correct`, `wrong`, `cash`, `win`, `lose`, `bossIntro`, `bossHit`, `bossDefeat`, `achievement`, `warning`) and the pentatonic background melody are synthesized via the Web Audio API with zero external copyrighted audio files.

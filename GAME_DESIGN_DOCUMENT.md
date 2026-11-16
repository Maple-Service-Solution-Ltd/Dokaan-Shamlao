# GAME DESIGN DOCUMENT — দোকান সামলাও! (Dokaan Shamlao)

## 1. Core Concept & Fantasy
The player steps behind the counter of a neighborhood Bangladeshi *mudi dokaan* (grocery store). Starting with a modest tin-roofed para shop stocked with rice, lentils, oil, and biscuits, the player serves a colorful cast of local customers, manages shelf inventory, calculates change in Bangladeshi Taka (`৳`), negotiates with wholesale *mohajons* (suppliers), handles load-shedding blackouts and monsoon downpours, and defeats 5 memorable Boss characters to earn the title of **দোকান সম্রাট (Ultimate Shopkeeper)**.

## 2. Core Gameplay Loop
1. **Customer Arrival**: Customers walk into one of up to 3 counter slots (or queue outside up to `lineCap`).
2. **Order Identification**: Customers request 1–5 products (either all at once, in waves for Elderly/Family/Forgetful customers, as riddles for Confused customers, or from memory for Repeat customers).
3. **Shelf Interaction**: The player taps products on categorized shelves (`মুদি`, `নাস্তা`, `ঠান্ডা`, `ঘরোয়া`, `বিশেষ`), using the `×১` / `×৫` toggle for bulk orders, or marks an item unavailable (`নেই`) if out of stock.
4. **Complications & Decisions**: Mid-transaction or mid-day, modal decisions trigger (bargaining, credit requests, coupon verification, angry customer complaints, internet outages, supplier negotiations, delivery inspections, and end-of-day cash/profit reconciliation).
5. **Payment & Change**:
   - **Exact Cash / Mobile Wallet**: Tap `টাকা নিন` (`Act.Collect`).
   - **Overpayment**: Assemble exact change using `৳500, ৳100, ৳50, ৳20, ৳10, ৳5` notes (`Act.Change`).
   - **Traps**: Spot counterfeit notes (`জাল নোট!`), underpaying *kipta* customers (`টাকা কম!`), or drawer change shortages (`খুচরা নেই`).
6. **Scoring & Progression**: Earn points, 1–3 stars, coins, XP, achievements, and shop customizations.

## 3. Customer Archetypes (18 Types)
Defined in `src/content/archetypes.ts`:
- `regular`, `impatient`, `bargain`, `elderly`, `child`, `vip`, `bulk`, `credit`, `angry`, `confused`, `forgetful`, `kipta`, `repeat`, `secret`, `family`, `debtor`, `booker`, `pickup`.

## 4. Boss Encounters (5 Bosses, 3 Phases Each)
1. **কাস্টমার ঝড় (Customer Storm)** — Levels 20 & 92: Rapid waves of impatient, bulk, and family customers. Losing 3 customers loses the encounter.
2. **বাকি সম্রাট (Credit King)** — Levels 40 & 84: Demands large credit tabs while periodically repaying part of his balance. Player must keep his running tab within the `৳3,000` limit.
3. **পাইকারি মহাজন (Wholesale Tycoon)** — Levels 60 & 88: Presents 3 wholesale offers with inflated list prices, fake discounts, and hidden fees. Player must pick the lowest true cost per unit within budget.
4. **চোর ধরো (Missing Stock)** — Levels 80 & 96: Alternates between stock audit puzzles (`Opening + Received - Sold = Shelf`) and fast-moving thief hotspots in the shop.
5. **হিসাবের ভূত (Accounting Ghost)** — Level 100: Final showdown combining scrambled ledger multiplication checks, profit-and-loss calculations, and daily cash reconciliation.

## 5. Economy & Scoring Formula
- **All currency values** (`buy`, `sell`, `cash`, `change`) are integers in multiples of `৳5`.
- **Order Score**: `base = 40 + 8 * min(units, 12) + floor(40 * patienceRatio) + (perfect ? 25 : 0)`, multiplied by archetype `scorePct` and combo multiplier (`+10%` per combo up to `+100%` cap).
- **End-of-Run Adjustments**: `+100` per completed objective, up to `+300` time bonus, up to `+200` profit bonus, minus cash mismatch and waste penalties.
- **Star Thresholds**: Calibrated per level via reference AI bots (`1★ = Win`, `2★ = 50% of skilled bot score`, `3★ = 75% of skilled bot score`).

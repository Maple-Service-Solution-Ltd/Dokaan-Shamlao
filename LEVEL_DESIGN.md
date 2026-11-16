# LEVEL DESIGN — দোকান সামলাও! (Dokaan Shamlao)

All **100 Story Mode levels** are defined in `src/content/levels.ts` and built/calibrated via `src/content/builder.ts`. Every level is verified by `tests/unit/levels-and-modes.test.ts` to ensure both skilled and casual/steady bots can complete all primary objectives.

## Chapter Structure

| Chapter | Levels | Environment | Core Mechanics Taught | Chapter Boss |
|---|---|---|---|---|
| **Chapter 1** | 1–20 | পাড়ার ছোট দোকান (Small Neighbourhood Shop) | Product selection, multi-item orders, giving change, quantities, queues, impatient/confused/forgetful/kipta/angry customers | Level 20: **কাস্টমার ঝড় (Customer Storm)** |
| **Chapter 2** | 21–40 | ব্যস্ত মুদি দোকান (Busy Grocery Shop) | Restocking (`🛒`), bargaining, credit book (`★` trust & limits), last piece, bulk buyers, expiry clearance, VIPs, Ramadan/School/Eid demand, repeat customers, credit collection, damaged goods, secret shoppers | Level 40: **বাকি সম্রাট (Credit King)** |
| **Chapter 3** | 41–60 | এলাকার জনপ্রিয় স্টোর (Popular Local Store) | Wholesale budget, load shedding, surprise expenses, daily closing, delivery inspection, heavy rain, fake notes, supplier negotiation, Pohela Boishakh Halkhata, wrong shipments, roof leaks, discount traps, supplier debt, fridge breakdown, Hisab Golmal, thieves, profit/loss | Level 60: **পাইকারি মহাজন (Wholesale Tycoon)** |
| **Chapter 4** | 61–80 | সুপার শপ (Super Shop) | Three-supplier race, internet outage, warehouse box rush, cricket fever, dead calculator (`power_failure`), fake supplier discounts, flood warnings, wedding bookings, limited supplier stock, winter market, product hunt (`shelfShuffle`), transport trouble, market price race, hidden stock, Puja shopping, overstock, fire alarm, inventory memory, Chand Raat | Level 80: **চোর ধরো (Missing Stock)** |
| **Chapter 5** | 81–100 | দোকান সম্রাটের চ্যালেঞ্জ (Shop King Challenge) | High-intensity combinations of all mechanics + Tier-2 Boss rematches (Levels 84, 88, 92, 96) culminating in the Final Boss | Level 100: **হিসাবের ভূত (Accounting Ghost)** |

## Level Progression & Star Calibration
- **Guided Tutorials (Levels 1–3)**: Highlight recommended actions and introduce basic tapping, multi-item orders, and change-making at a relaxed pace (`noPatience` on Level 1).
- **Dynamic Star Thresholds**: `storyConfig(n)` runs reference bots (`BOT_SKILLED` and `BOT_CASUAL`/`BOT_STEADY`) and sets `1★ = Level Complete`, `2★ = 50% of skilled score`, `3★ = 75% of skilled score`.

# CHALLENGE CATALOG — দোকান সামলাও! (Dokaan Shamlao)

All **67 challenges** are implemented as structured data in `src/content/challenges.ts` and validated by unit tests. Each challenge defines its category, difficulty (1–5), prerequisite level (`minLevel`), effects (customer mix, guaranteed archetypes, shop modifiers, timeline events), primary objectives, bonus points, and coin/XP rewards.

## A. Customer Challenges (15)
1. `impatient` — **অধৈর্য কাস্টমার (Impatient Customer)**: Half patience; serve at least `[2, 3, 4]` impatient customers.
2. `bargain` — **দরদামের ওস্তাদ (Bargain Master)**: Modal bargaining decision based on customer tone (`flex` 0..2).
3. `credit` — **বাকির কাস্টমার (Credit Customer)**: Credit decision using customer trust (`1..5★`) and shop `creditLimit`.
4. `confused` — **ভুলোমনা খালা (Confused Customer)**: Order lines appear as Bangla/English product riddles (`clue`).
5. `angry` — **রাগী কাস্টমার (Angry Customer)**: Arrives with a spoiled-goods or overcharge receipt complaint (`complaint` decision).
6. `vip` — **ভিআইপি কাস্টমার (VIP Customer)**: Large orders, big notes, low patience; tips `+10%` on flawless service.
7. `bulk` — **পাইকারি ক্রেতা (Bulk Buyer)**: Orders 5–10 units per line; teaches the `×৫` bulk toggle.
8. `forgetful` — **ভুলে-যাওয়া কাস্টমার (Forgetful Customer)**: Adds an extra wave item (`"ওহ্‌, আরেকটা জিনিস!"`) after initial items are bagged.
9. `queue_disaster` — **লাইনের বিপর্যয় (Queue Disaster)**: Sudden crowd bursts test queue switching by patience.
10. `wrong_order` — **মত বদল (Wrong Order)**: Customer swaps an item mid-order (`swapTo`).
11. `kipta` — **কিপ্টা কাস্টমার (Kipta Customer)**: Underpays the bill; player must tap `টাকা কম!` (`Act.Flag, 2`).
12. `change_problem` — **খুচরার আকাল (Change Problem)**: Finite note drawer (`limitedTill`); player must make exact change from available notes, press `খুচরা নেই`, or tap the `ভাঙতি আনুন` hotspot.
13. `repeat` — **নিয়মিত কাস্টমার (Repeat Customer)**: Visits twice; on the second visit asks for `"আগের মতোই দেন"` (`hiddenOrder`).
14. `secret_shopper` — **গোপন ক্রেতা (Secret Shopper)**: Undercover customer rates service `1..5★` based on speed and mistakes.
15. `family` — **পুরো পরিবার (Family Shopping)**: Multi-wave order as each family member adds items.

## B. Inventory Challenges (12)
1. `stock_out` — **মাল ফুরালো (Stock-out)**: Sudden stock depletion; reorder cartons (`🛒`) and unpack arrived boxes (`📦`).
2. `last_piece` — **শেষ পিস (Last Piece)**: Only 1 unit left while 2 customers want it; ration stock wisely.
3. `expiry` — **মেয়াদ শেষের পথে (Expiry Alert)**: Perishable stock nears expiry; tap `⏰` to start a clearance sale.
4. `delivery_delay` — **ডেলিভারি দেরি (Delivery Delay)**: Supplier lead time doubles (`leadTicks: 160`); order ahead.
5. `wrong_shipment` — **ভুল চালান (Wrong Shipment)**: Inspect incoming deliveries (`inspect` decision) to catch wrong items.
6. `price_shock` — **দাম বেড়েছে! (Price Shock)**: Wholesale cost jumps 25%; decide whether to raise retail price or hold margin.
7. `damaged_goods` — **নষ্ট মাল (Damaged Goods)**: Tap `🩹` on the shelf to remove damaged units before accidentally selling them.
8. `product_hunt` — **খুঁজে বের করো (Product Hunt)**: Shelf positions are shuffled (`shelfShuffle: true`).
9. `overstock` — **অতিরিক্ত মাল (Overstock)**: Excess stock of one item; tap `🏷️` to run a promotional offer.
10. `warehouse_rush` — **গুদামে দৌড় (Warehouse Rush)**: Multiple delivery boxes arrive at once and block the door unless unpacked in time.
11. `eid_demand` — **ঈদের চাহিদা (Eid Demand)**: 4× demand surge for Eid staples (`semai`, `sugar`, `oil`, `polao`).
12. `hidden_stock` — **লুকানো মাল (Hidden Stock)**: Stock is hidden in the back room; tap the `🔍 গুদাম খুঁজুন` hotspot.

## C. Cash & Accounting Challenges (10)
1. `cash_mismatch` — **ক্যাশ মিলছে না (Cash Mismatch)**: Zero mismatch allowed + end-of-day cash balance check.
2. `change_master` — **খুচরা মাস্টার (Change Master)**: High rate of large notes (`৳500`/`৳1000`) and hidden change sums at higher intensity.
3. `suspicious_note` — **জাল নোট (Suspicious Note)**: Inspect banknote watermark, color, and security thread; tap `জাল নোট!` (`Act.Flag, 1`).
4. `credit_collection` — **বাকি আদায় (Credit Collection)**: Old debtors visit; choose full demand, installment, or ledger proof based on their excuse.
5. `daily_closing` — **দিনের হিসাব (Daily Closing)**: Reconcile `Opening + Cash Sales + Collections - Supplier - Expenses`.
6. `discount_trap` — **ছাড়ের ফাঁদ (Discount Trap)**: Verify coupon minimum bill, eligible product, and expiry date.
7. `unexpected_expense` — **হঠাৎ খরচ (Unexpected Expense)**: Surprise utility/repair bills; choose immediate payment, split, or deferral.
8. `supplier_debt` — **মহাজনের দেনা (Supplier Debt)**: Accumulate enough cash before 75% of the level to pay the supplier's due.
9. `profit_or_loss` — **লাভ না ক্ষতি? (Profit or Loss)**: Achieve target profit and solve `Sales - COGS - Expenses - Waste`.
10. `hisab_golmal` — **হিসাবের গোলমাল (Hisab Golmal)**: Spot the ledger row where `Qty × Unit Price ≠ Total`.

## D. Emergency Challenges (10)
1. `load_shedding` — **লোডশেডিং (Load Shedding)**: Shop goes dark and product names hide; identify by silhouette or pay `৳50` for the charger light (`🔦`).
2. `heavy_rain` — **ঝুম বৃষ্টি (Heavy Rain)**: Lower customer patience, slower deliveries, and high demand for rain items (`candle`, `muri`, `tea`).
3. `flood_warning` — **বন্যার সতর্কতা (Flood Warning)**: Tap `⬆️` on threatened shelves within 16 seconds to lift stock above water.
4. `internet_outage` — **নেট নেই! (Internet Outage)**: Mobile wallet payments fail; switch to cash, khata credit (if trusted), or reschedule.
5. `fridge_breakdown` — **ফ্রিজ নষ্ট (Refrigerator Breakdown)**: Cold stock threatens to spoil; call the mechanic (`৳200`) or run a 40% clearance sale.
6. `power_failure` — **ক্যালকুলেটর বন্ধ (Power Failure)**: Calculator dies; add up customer bills manually (`hiddenTotal` decision).
7. `water_leakage` — **ছাদ চুঁইছে (Water Leakage)**: Tap the `💧` roof leak hotspot 3 times to place a bucket before stock gets soaked.
8. `security_alert` — **চোর চোর! (Security Alert)**: Tap the lurking thief hotspot (`🦹`) within 5 seconds before stock is stolen.
9. `sudden_crowd` — **হঠাৎ ভিড় (Sudden Crowd)**: Bus stops outside; rapid burst of customers enters at once.
10. `fire_alarm` — **ফায়ার অ্যালার্ম (Fire Alarm)**: Tap ① Main Switch → ② Extinguisher → ③ Window in sequence within 13 seconds.

## E. Supplier Challenges (8)
1. `wholesale_budget` — **পাইকারি বাজেট (Wholesale Budget)**: Low starting stock and tight cash; prioritize fast-moving staples.
2. `supplier_negotiation` — **মহাজনের সাথে দরাদরি (Supplier Negotiation)**: Read supplier mood to bid low or accept quote.
3. `three_supplier_race` — **তিন মহাজনের দৌড় (Three Supplier Race)**: Compare 3 suppliers on price, lead time, and good-unit percentage.
4. `limited_stock` — **সীমিত মাল (Limited Stock)**: Supplier has only 4–6 cartons available for the entire level.
5. `delivery_inspection` — **ডেলিভারি পরীক্ষা (Delivery Inspection)**: Compare invoice vs. delivered goods (wrong item, short count, or broken units).
6. `transport_trouble` — **গাড়ি আটকা (Transport Trouble)**: Delivery van stuck in traffic; hire a van, fetch yourself, or wait.
7. `fake_discount` — **নকল ছাড় (Fake Discount)**: Calculate true per-unit cost across inflated supplier "discount" offers.
8. `market_price_race` — **বাজারদরের দৌড় (Market Price Race)**: Wholesale prices fluctuate every 25% of the level (`▼` cheap / `▲` high).

## F. Seasonal Challenges (12)
1. `ramadan_rush` — **রমজানের ভিড় (Ramadan Rush)**
2. `eid_shopping_rush` — **ঈদের কেনাকাটা (Eid Shopping Rush)**
3. `chand_raat` — **চাঁদ রাত (Chand Raat)**
4. `pohela_boishakh` — **পহেলা বৈশাখ — হালখাতা (Pohela Boishakh)**
5. `winter_market` — **শীতের বাজার (Winter Market)**
6. `wedding_season` — **বিয়ের মৌসুম (Wedding Season)**
7. `school_reopening` — **স্কুল খুলেছে (School Reopening)**
8. `cricket_tournament` — **ক্রিকেট জ্বর (Cricket Tournament)**
9. `monsoon_market` — **বর্ষার বাজার (Monsoon Market)**
10. `puja_shopping` — **পূজার কেনাকাটা (Puja Shopping)**
11. `new_year_shopping` — **নববর্ষের রাত (New Year Shopping)**
12. `festival_price_shock` — **উৎসবে দামের আগুন (Festival Price Shock)**

## G. Skill Challenges (10)
1. `perfect_accuracy` — **নিখুঁত নির্ভুলতা (Perfect Accuracy)**
2. `speed_master` — **স্পিড মাস্টার (Speed Master)**
3. `zero_waste` — **শূন্য অপচয় (Zero Waste)**
4. `no_mistakes` — **ভুল চলবে না (No Mistakes)**
5. `fast_checkout` — **ফাস্ট চেকআউট (Fast Checkout)**
6. `five_perfect` — **পাঁচে পাঁচ (Five Perfect Orders)**
7. `limited_budget` — **টানাটানির দিন (Limited Budget)**
8. `customer_happiness` — **খুশি রাখো (Customer Happiness)**
9. `inventory_memory` — **স্মৃতির পরীক্ষা (Inventory Memory)**
10. `cash_counter_master` — **ক্যাশ কাউন্টার মাস্টার (Cash Counter Master)**

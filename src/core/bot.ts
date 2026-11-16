/**
 * Auto-player. Plays through the same action API as a human, with a configurable reaction delay.
 * Used to (1) prove every level and generated challenge is winnable, (2) calibrate star thresholds,
 * (3) drive tutorial hints and end-to-end tests.
 */
import { Sim } from './sim';
import { Act, DENOMS, type Customer } from './types';

export interface BotAction { type: number; a: number; b: number; rest: number[]; think: boolean }

const act = (type: number, a = 0, b = 0, rest: number[] = [], think = false): BotAction => ({ type, a, b, rest, think });

/** Exact change from a limited drawer (depth-first over denominations, largest first). */
export function makeChange(amount: number, till: number[] | null): number[] | null {
  const counts = DENOMS.map(() => 0);
  const dfs = (i: number, rest: number): boolean => {
    if (rest === 0) return true;
    if (i >= DENOMS.length) return false;
    const d = DENOMS[i]!;
    const max = Math.min(Math.floor(rest / d), till ? till[i] ?? 0 : 99);
    for (let n = max; n >= 0; n--) {
      counts[i] = n;
      if (dfs(i + 1, rest - n * d)) return true;
    }
    counts[i] = 0;
    return false;
  };
  return dfs(0, amount) ? counts : null;
}

function orderAction(sim: Sim, c: Customer): BotAction | null {
  const m = sim.cfg.mods;
  let waiting = false;
  for (let i = 0; i < c.order.length; i++) {
    const l = c.order[i]!;
    if (l.wave > c.wave || l.na || l.got >= l.qty) continue;
    const pidx = sim.cfg.products.indexOf(l.p);
    if ((sim.damaged[l.p] ?? 0) > 0) {
      const h = sim.hotspots.find((x) => x.kind === 'damaged' && x.p === l.p);
      if (h) return act(Act.Hotspot, h.id);
    }
    if (sim.available(l.p) > 0) return act(Act.Add, pidx, l.qty - l.got >= 5 ? 5 : 1);
    if ((sim.hidden[l.p] ?? 0) > 0) {
      const h = sim.hotspots.find((x) => x.kind === 'search');
      if (h && !sim.flag('closed')) return act(Act.Hotspot, h.id);
    }
    const box = sim.hotspots.find((x) => x.kind === 'box' && x.p === l.p);
    if (box) return act(Act.Hotspot, box.id);
    if (sim.deliveries.some((d) => d.p === l.p)) {
      // Wait for the delivery only while the customer still has patience to spare.
      if (c.patience > 60) { waiting = true; continue; }
      return act(Act.NotAvailable, i);
    }
    const canRestock = m.restock && sim.cartonsLeft !== 0 && (sim.noRestockUntil[l.p] ?? 0) <= sim.tick && sim.cash >= sim.cartonCost(l.p);
    if (canRestock && c.patience > (m.leadTicks ?? 80) + 40) return act(Act.Restock, pidx);
    return act(Act.NotAvailable, i);
  }
  return waiting ? null : null;
}

/** The next sensible action for the current state, or null to wait. */
export function nextAction(sim: Sim): BotAction | null {
  const d = sim.decision;
  if (d) return act(Act.Decide, d.id, d.best, [], true);
  const fires = sim.hotspots.filter((h) => h.kind === 'fire').sort((x, y) => (x.seq ?? 0) - (y.seq ?? 0));
  if (fires[0]) return act(Act.Hotspot, fires[0].id);
  for (const kind of ['thief', 'leak', 'flood', 'damaged', 'expiry', 'box'] as const) {
    const h = sim.hotspots.find((x) => x.kind === kind);
    if (h) return act(Act.Hotspot, h.id);
  }
  if (sim.flag('closed')) return null;
  const c = sim.current;
  if (c && c.state === 'paying' && c.pay) {
    const p = c.pay;
    if (p.fake) return act(Act.Flag, 1);
    if (p.given < p.total) return act(Act.Flag, 2);
    if (p.given === p.total) return act(Act.Collect);
    const till = sim.till ? sim.tillWith(p.given) : null;
    const counts = makeChange(p.given - p.total, till);
    if (!counts) return act(Act.Flag, 3);
    return act(Act.Change, counts[0], counts[1], counts.slice(2));
  }
  if (c && c.state === 'ordering') {
    const a = orderAction(sim, c);
    if (a) return a;
    // Blocked on a delivery: help someone else meanwhile.
    const other = sim.customers.find((x) => x.id !== c.id && (x.state === 'waiting' || x.state === 'ordering' || x.state === 'paying'));
    if (other) return act(Act.Select, other.id);
  }
  // Keep the shelves from running dry when a supplier is available.
  const m = sim.cfg.mods;
  if (m.restock && sim.cartonsLeft !== 0) {
    const reserve = (!sim.stats.debtPaid && !sim.stats.debtFailed ? m.supplierDebt ?? 0 : 0) + 100;
    for (let i = 0; i < sim.cfg.products.length; i++) {
      const p = sim.cfg.products[i]!;
      if (sim.available(p) <= 2 && !sim.deliveries.some((x) => x.p === p) && (sim.noRestockUntil[p] ?? 0) <= sim.tick
        && sim.cash - sim.cartonCost(p) >= reserve && !(sim.hidden[p]! > 0)) return act(Act.Restock, i);
    }
  }
  return null;
}

export interface BotOptions {
  /** Ticks between ordinary actions (5 = a brisk human). */
  actionDelay: number;
  /** Ticks spent reading a decision before answering. */
  thinkDelay: number;
}

export const BOT_SKILLED: BotOptions = { actionDelay: 4, thinkDelay: 18 };
export const BOT_STEADY: BotOptions = { actionDelay: 6, thinkDelay: 28 };
export const BOT_CASUAL: BotOptions = { actionDelay: 8, thinkDelay: 40 };

/** Plays a whole run. Returns the finished sim (with its action log). */
export function botPlay(sim: Sim, opts: BotOptions = BOT_SKILLED, maxTicks = 40_000): Sim {
  let wait = opts.actionDelay;
  let seenDecision = -1;
  while (!sim.ended && sim.tick < maxTicks) {
    if (wait > 0) wait--;
    if (wait <= 0) {
      const a = nextAction(sim);
      if (a) {
        if (a.think && seenDecision !== a.a) {
          seenDecision = a.a;
          wait = Math.min(opts.thinkDelay, Math.max(1, (sim.decision?.deadlineTick ?? 0) - sim.tick - 2));
        } else {
          sim.act(a.type, a.a, a.b, a.rest);
          wait = opts.actionDelay;
        }
      }
    }
    sim.step();
  }
  if (!sim.ended) sim.quit();
  return sim;
}

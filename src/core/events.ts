/**
 * Timeline events (things that happen to the shop) and hotspots (things the player taps in the scene).
 */
import type { Sim } from './sim';
import { TILL_REFILL } from './sim';
import type { Hotspot, TimelineEvent } from './types';
import { PRODUCT_MAP } from '@/content/products';
import { startDecisionFor } from './decisions';

function stocked(sim: Sim, min: number, filter?: (id: string) => boolean): string[] {
  return sim.cfg.products.filter((id) => sim.available(id) >= min && (!filter || filter(id)) && id !== sim.cfg.mods.giftItem);
}

export function fireTimeline(sim: Sim, ev: TimelineEvent, idx: number, count: number): void {
  const r = sim.rng(0xe7e47, idx, count);
  const n = ev.n ?? 0;
  const banner = (key: string, tone: 'warn' | 'info' | 'good' | 'bad' = 'warn', params?: Record<string, string | number>): void =>
    sim.emit({ t: 'banner', key, tone, params });
  switch (ev.kind) {
    case 'stockout': {
      const pool = stocked(sim, 1);
      if (!pool.length) return;
      const p = r.pick(pool);
      sim.stock[p] = sim.reserved(p);
      sim.emit({ t: 'stock', p });
      banner('ev.stockout', 'warn', { product: `#${p}` });
      if (!sim.cfg.mods.restock) {
        // Without a supplier button the regular delivery van brings a carton after a while.
        sim.deliveries.push({ id: sim.id(), p, units: PRODUCT_MAP[p]!.carton, arrive: sim.tick + (n || 200), defect: 0, cost: 0 });
      }
      return;
    }
    case 'lastPiece': {
      const pool = stocked(sim, 2);
      if (!pool.length) return;
      const p = r.pick(pool);
      sim.stock[p] = sim.reserved(p) + 1;
      sim.forceProduct = { p, left: 2 };
      sim.noRestockUntil[p] = sim.tick + 300;
      sim.emit({ t: 'stock', p });
      banner('ev.lastPiece', 'warn', { product: `#${p}` });
      return;
    }
    case 'expiry': {
      let pool = stocked(sim, 4, (id) => !!PRODUCT_MAP[id]!.perishable && !sim.expiring[id]);
      if (!pool.length) pool = stocked(sim, 4, (id) => !sim.expiring[id]);
      if (!pool.length) return;
      const p = r.pick(pool);
      const at = sim.tick + (n || 450);
      sim.expiring[p] = { units: Math.min(sim.available(p), 6), at };
      sim.addHotspot({ kind: 'expiry', p, until: at, data: 30 });
      banner('ev.expiry', 'warn', { product: `#${p}` });
      return;
    }
    case 'overstock': {
      const pool = stocked(sim, 1);
      if (!pool.length) return;
      const p = r.pick(pool);
      sim.stock[p] = PRODUCT_MAP[p]!.maxStock + 10;
      sim.focusP = p;
      sim.addHotspot({ kind: 'expiry', p, until: 0, data: 20 });
      sim.emit({ t: 'stock', p });
      banner('ev.overstock', 'info', { product: `#${p}` });
      return;
    }
    case 'damaged': {
      const pool = stocked(sim, 4, (id) => !sim.damaged[id]);
      if (!pool.length) return;
      const p = r.pick(pool);
      sim.damaged[p] = 3;
      sim.addHotspot({ kind: 'damaged', p, until: sim.tick + 250 });
      banner('ev.damaged', 'warn', { product: `#${p}` });
      return;
    }
    case 'priceShock': {
      const pool = stocked(sim, 1, (id) => !sim.priceRaised[id]);
      if (pool.length) startDecisionFor(sim, undefined, 'priceShock', r.pick(pool));
      return;
    }
    case 'deliveryRush': {
      const pool = [...sim.cfg.products].sort((a, b) => sim.stock[a]! - sim.stock[b]! || (a < b ? -1 : 1));
      for (let i = 0; i < (n || 4); i++) {
        const p = pool[i % pool.length]!;
        const d = { id: sim.id(), p, units: PRODUCT_MAP[p]!.carton, arrive: 0, defect: 0, cost: 0 };
        sim.deliveries.push(d);
        sim.addHotspot({ kind: 'box', p, until: sim.tick + 150 + i * 20, data: d.id });
      }
      banner('ev.deliveryRush', 'warn');
      return;
    }
    case 'loadShedding': {
      const dur = n || 220;
      sim.setFlag('dark', dur);
      sim.addHotspot({ kind: 'light', until: sim.tick + dur, data: 50 });
      banner('ev.loadShedding', 'warn');
      return;
    }
    case 'rain': sim.setFlag('rain', n || 300); banner('ev.rain', 'info'); return;
    case 'outage': sim.setFlag('outage', n || 300); banner('ev.outage', 'warn'); return;
    case 'powerFailure': sim.setFlag('powerOut', n || 250); banner('ev.powerFailure', 'warn'); return;
    case 'flood': {
      const pool = r.shuffle(stocked(sim, 2)).slice(0, n || 4);
      for (const p of pool) sim.addHotspot({ kind: 'flood', p, until: sim.tick + 160 });
      if (pool.length) banner('ev.flood', 'warn');
      return;
    }
    case 'fridge': {
      if (!sim.cfg.products.some((id) => PRODUCT_MAP[id]!.cold) || sim.flag('fridge')) return;
      sim.setFlag('fridge', 100_000);
      banner('ev.fridge', 'warn');
      startDecisionFor(sim, undefined, 'repair');
      return;
    }
    case 'leak': sim.addHotspot({ kind: 'leak', until: sim.tick + 100, taps: 3 }); banner('ev.leak', 'warn'); return;
    case 'thief': sim.addHotspot({ kind: 'thief', until: sim.tick + (n || 50) }); banner('ev.thief', 'warn'); return;
    case 'crowd':
      sim.burst += n || 4;
      sim.nextSpawnTick = sim.tick + 1;
      banner('ev.crowd', 'warn');
      return;
    case 'fire': {
      if (sim.flag('fire')) return;
      sim.setFlag('fire', 130);
      for (let s = 0; s < 3; s++) sim.addHotspot({ kind: 'fire', seq: s, until: sim.tick + 130 });
      banner('ev.fire', 'warn');
      return;
    }
    case 'expense': startDecisionFor(sim, undefined, 'expense', undefined, n); return;
    case 'debtDue': {
      const due = sim.cfg.mods.supplierDebt ?? n;
      if (due <= 0 || sim.stats.debtPaid || sim.stats.debtFailed) return;
      if (sim.cash >= due) {
        sim.payExpense(due);
        sim.stats.debtPaid = 1;
        banner('ev.debtPaid', 'good', { n: due });
      } else {
        sim.stats.debtFailed = 1;
        if (sim.cash > 0) sim.payExpense(sim.cash);
        sim.addRep(-30);
        banner('ev.debtFailed', 'bad', { n: due });
      }
      return;
    }
    case 'debtor': {
      const out = sim.debtors.find((d) => d.trust === 3 && d.amount > 0);
      let debt = n || r.pick([200, 300, 400, 500]);
      if (out) { debt = out.amount; sim.stats.creditOutstanding -= out.amount; out.amount = 0; }
      sim.specials.push({ tick: sim.tick + 1, arch: 'debtor', debt });
      return;
    }
    case 'offer': startDecisionFor(sim, undefined, 'offers'); return;
    case 'ledger': startDecisionFor(sim, undefined, 'ledger'); return;
    case 'stockAudit': startDecisionFor(sim, undefined, 'stockAudit'); return;
    case 'priceTick': {
      for (const id of sim.cfg.products) {
        sim.buyPct[id] = r.pick([75, 85, 95, 100, 110, 120, 130]);
        sim.emit({ t: 'stock', p: id });
      }
      banner('ev.priceTick', 'info');
      return;
    }
    case 'hiddenStock': return; // applied at init through mods.hiddenStock
    default: return;
  }
}

function remove(sim: Sim, h: Hotspot, ok: boolean): void {
  const i = sim.hotspots.indexOf(h);
  if (i >= 0) sim.hotspots.splice(i, 1);
  if (ok) sim.stats.hotspotsDone++;
  sim.emit({ t: 'hotspotDone', id: h.id, ok, kind: h.kind });
}

/** Player tapped a hotspot. Returns whether the tap was a legal action. */
export function tapHotspot(sim: Sim, h: Hotspot): boolean {
  switch (h.kind) {
    case 'box': {
      const d = sim.deliveries.find((x) => x.id === h.data);
      if (!d) { remove(sim, h, false); return true; }
      if (sim.cfg.mods.inspectPct && !d.inspected && d.cost > 0) {
        if (sim.decision) return false;
        d.inspected = true;
        remove(sim, h, true);
        startDecisionFor(sim, undefined, 'inspect', d.p, d.id);
        return true;
      }
      sim.deliveries.splice(sim.deliveries.indexOf(d), 1);
      sim.stock[d.p] = (sim.stock[d.p] ?? 0) + d.units;
      sim.emit({ t: 'stock', p: d.p });
      remove(sim, h, true);
      return true;
    }
    case 'leak':
      h.taps--;
      if (h.taps <= 0) { sim.addPoints(15, 'fix'); remove(sim, h, true); }
      else sim.emit({ t: 'hotspot', id: h.id });
      return true;
    case 'thief':
      sim.addPoints(25, 'catch');
      remove(sim, h, true);
      sim.emit({ t: 'banner', key: 'ev.thiefCaught', tone: 'good' });
      if (h.data === 1) sim.bossHit();
      return true;
    case 'expiry':
      if (!h.p) return false;
      sim.discount[h.p] = h.data ?? 30;
      sim.emit({ t: 'stock', p: h.p });
      remove(sim, h, true);
      sim.emit({ t: 'banner', key: 'ev.saleOn', tone: 'good', params: { product: `#${h.p}`, pct: h.data ?? 30 } });
      return true;
    case 'damaged': {
      if (!h.p) return false;
      const n = Math.min(sim.damaged[h.p] ?? 0, sim.stock[h.p] ?? 0);
      sim.stock[h.p] = (sim.stock[h.p] ?? 0) - n;
      sim.damaged[h.p] = 0;
      sim.addPoints(10, 'fix');
      sim.emit({ t: 'stock', p: h.p });
      remove(sim, h, true);
      return true;
    }
    case 'flood':
      sim.addPoints(10, 'fix');
      remove(sim, h, true);
      return true;
    case 'search': {
      if (sim.flag('closed')) return false;
      sim.setFlag('closed', 30);
      let found = 0;
      for (const id of Object.keys(sim.hidden).sort()) {
        found += sim.hidden[id]!;
        sim.stock[id] = (sim.stock[id] ?? 0) + sim.hidden[id]!;
        sim.hidden[id] = 0;
        sim.emit({ t: 'stock', p: id });
      }
      sim.emit({ t: 'banner', key: found > 0 ? 'ev.searchFound' : 'ev.searchEmpty', tone: found > 0 ? 'good' : 'info', params: { n: found } });
      if (found > 0) { sim.stats.hotspotsDone++; sim.addPoints(20, 'fix'); }
      return true;
    }
    case 'fire': {
      const expected = Math.min(...sim.hotspots.filter((x) => x.kind === 'fire').map((x) => x.seq ?? 0));
      if ((h.seq ?? 0) !== expected) {
        sim.mistake();
        sim.emit({ t: 'banner', key: 'ev.fireOrder', tone: 'bad' });
        return true;
      }
      remove(sim, h, true);
      if (!sim.hotspots.some((x) => x.kind === 'fire')) {
        sim.setFlag('fire', 0);
        sim.addPoints(50, 'fix');
        sim.emit({ t: 'banner', key: 'ev.fireOut', tone: 'good' });
      }
      return true;
    }
    case 'light': {
      const fee = h.data ?? 50;
      if (sim.cash < fee) { sim.emit({ t: 'banner', key: 'ev.noCash', tone: 'bad' }); return false; }
      sim.payExpense(fee);
      sim.setFlag('dark', 0);
      remove(sim, h, true);
      return true;
    }
    case 'changeRun': {
      if (sim.flag('closed') || !sim.till) return false;
      sim.setFlag('closed', 50);
      sim.till = sim.till.map((n, i) => Math.max(n, TILL_REFILL[i]!));
      sim.emit({ t: 'banner', key: 'ev.changeRun', tone: 'info' });
      return true;
    }
    default: return false;
  }
}

export function expireHotspot(sim: Sim, h: Hotspot): void {
  const r = sim.rng(0xe4b, h.id);
  switch (h.kind) {
    case 'box':
      // Unpacked boxes pile up at the entrance.
      h.until = 0;
      sim.stats.hotspotsMissed++;
      sim.addRep(-3);
      sim.emit({ t: 'banner', key: 'ev.boxBlock', tone: 'bad' });
      return;
    case 'leak': {
      const pool = sim.cfg.products.filter((id) => sim.available(id) >= 3);
      if (pool.length) {
        const p = r.pick(pool);
        sim.wasteUnits(p, 3);
        sim.emit({ t: 'banner', key: 'ev.leakDamage', tone: 'bad', params: { product: `#${p}` } });
      }
      sim.stats.hotspotsMissed++;
      remove(sim, h, false);
      return;
    }
    case 'thief': {
      const pool = sim.cfg.products.filter((id) => sim.available(id) >= 3);
      if (pool.length) {
        const p = r.pick(pool);
        const n = Math.min(sim.available(p), r.range(3, 6));
        sim.stock[p]! -= n;
        sim.stats.stolen += n;
        sim.emit({ t: 'stock', p });
        sim.emit({ t: 'banner', key: 'ev.stolen', tone: 'bad', params: { product: `#${p}`, n } });
      }
      sim.stats.hotspotsMissed++;
      if (h.data === 1) sim.bossStrike();
      remove(sim, h, false);
      return;
    }
    case 'expiry': {
      if (h.p) {
        const exp = sim.expiring[h.p];
        if (exp && exp.units > 0) { sim.wasteUnits(h.p, Math.min(exp.units, sim.available(h.p))); sim.emit({ t: 'banner', key: 'ev.expired', tone: 'bad', params: { product: `#${h.p}` } }); }
        delete sim.expiring[h.p];
      }
      remove(sim, h, false);
      return;
    }
    case 'damaged': remove(sim, h, false); return; // damaged units stay on the shelf as a trap
    case 'flood':
      if (h.p) {
        sim.wasteUnits(h.p, Math.floor(sim.available(h.p) / 2));
        sim.emit({ t: 'banner', key: 'ev.floodDamage', tone: 'bad', params: { product: `#${h.p}` } });
      }
      sim.stats.hotspotsMissed++;
      remove(sim, h, false);
      return;
    case 'fire': {
      const rest = sim.hotspots.filter((x) => x.kind === 'fire');
      for (const x of rest) remove(sim, x, false);
      sim.setFlag('fire', 0);
      sim.setFlag('closed', 60);
      sim.stats.hotspotsMissed++;
      const pool = r.shuffle(sim.cfg.products.filter((id) => sim.available(id) >= 5)).slice(0, 2);
      for (const p of pool) sim.wasteUnits(p, Math.floor(sim.available(p) / 5));
      sim.emit({ t: 'banner', key: 'ev.fireDamage', tone: 'bad' });
      return;
    }
    case 'light': remove(sim, h, false); return;
    default: remove(sim, h, false);
  }
}

/** Per-tick timers that are not hotspots: credit repayments, expiry sales, fridge. */
export function tickTimers(sim: Sim): void {
  const t = sim.tick;
  for (const d of sim.debtors) {
    if (d.amount > 0 && d.due > 0 && t >= d.due) {
      sim.addCash(d.amount);
      sim.stats.collected += d.amount;
      sim.stats.creditCollected += d.amount;
      sim.stats.creditOutstanding -= d.amount;
      sim.emit({ t: 'banner', key: 'ev.creditRepaid', tone: 'good', params: { n: d.amount } });
      d.amount = 0;
    }
  }
  // Expiring stock that was put on sale still expires on time.
  for (const p of Object.keys(sim.expiring)) {
    const exp = sim.expiring[p]!;
    if (t >= exp.at && !sim.hotspots.some((h) => h.kind === 'expiry' && h.p === p)) {
      if (exp.units > 0) {
        sim.wasteUnits(p, Math.min(exp.units, sim.available(p)));
        sim.emit({ t: 'banner', key: 'ev.expired', tone: 'bad', params: { product: `#${p}` } });
      }
      delete sim.expiring[p];
      if (sim.discount[p]) { sim.discount[p] = 0; sim.emit({ t: 'stock', p }); }
    }
  }
  if (sim.fridgeFixAt > 0 && t >= sim.fridgeFixAt) {
    sim.fridgeFixAt = 0;
    sim.setFlag('fridge', 0);
    sim.emit({ t: 'banner', key: 'ev.fridgeFixed', tone: 'good' });
  }
  if (sim.spoilAt > 0 && t >= sim.spoilAt) {
    sim.spoilAt = 0;
    for (const id of sim.cfg.products) {
      if (PRODUCT_MAP[id]!.cold) {
        sim.wasteUnits(id, sim.available(id));
        if (sim.discount[id]) sim.discount[id] = 0;
      }
    }
    sim.setFlag('fridge', 0);
    sim.emit({ t: 'banner', key: 'ev.spoiled', tone: 'bad' });
  }
}

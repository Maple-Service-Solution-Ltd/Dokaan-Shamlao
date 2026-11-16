/**
 * Decisions: every modal choice the player makes (bargaining, credit, coupons, supplier offers,
 * inspections, audits, boss moves…). Each kind has a builder that creates the puzzle from visible
 * information and a resolver that applies the consequences. The best option is always derivable
 * from what the card shows, so decisions are fair and testable.
 */
import type { Sim } from './sim';
import { round5 } from './sim';
import type { Customer, Decision, DecisionKind, DecisionOption, DecisionRow } from './types';
import { PRODUCT_MAP } from '@/content/products';

type NewDecision = Omit<Decision, 'id' | 'deadlineTick'>;

function ttl(sim: Sim, base: number): number {
  if (sim.cfg.guided) return base * 4;
  return sim.cfg.difficulty <= 3 ? base * 2 : sim.cfg.difficulty >= 8 ? Math.floor((base * 8) / 10) : base;
}

function bossTtl(sim: Sim): number {
  const b = sim.cfg.boss!;
  return b.phases[sim.boss!.phase]!.deadline;
}

function bossLevel(sim: Sim): number {
  return sim.boss && sim.cfg.boss ? sim.cfg.boss.phases[sim.boss.phase]!.level : Math.min(3, 1 + Math.floor(sim.cfg.difficulty / 4));
}

const amount = (n: number): DecisionOption => ({ key: 'opt.amount', params: { n } });

function urgent(sim: Sim, p: string): boolean {
  return sim.available(p) <= 0 && sim.customers.some((c) => c.order.some((l) => l.p === p && l.got < l.qty && !l.na));
}

function shuffledOptions(sim: Sim, salt: number, correct: number, candidates: number[]): { values: number[]; best: number } {
  const values = [correct];
  for (const v of candidates) if (values.length < 4 && !values.includes(v)) values.push(v);
  let bump = 25;
  while (values.length < 4) { if (!values.includes(correct + bump)) values.push(correct + bump); bump += 25; }
  sim.rng(0x0b7, salt, sim.tick).shuffle(values);
  return { values, best: values.indexOf(correct) };
}

/** Amount due before advances and credit are taken off. */
export function billTotal(sim: Sim, c: Customer): number {
  if (c.fixedTotal !== undefined) return c.fixedTotal;
  return Math.max(5, round5((sim.subtotal(c) * (100 - (c.discountPct ?? 0))) / 100));
}

export function giveCredit(sim: Sim, c: Customer, amountDue: number): void {
  const s = sim.stats;
  s.creditGiven += amountDue;
  s.creditOutstanding += amountDue;
  sim.debtors.push({ amount: amountDue, trust: c.trust, due: c.trust >= 4 ? sim.tick + 250 : 0 });
  if (s.creditOutstanding > (sim.cfg.mods.creditLimit ?? 1500)) {
    s.overLimit++;
    sim.addRep(-5);
    sim.emit({ t: 'banner', key: 'ev.overLimit', tone: 'bad' });
  }
}

function completeOnCredit(sim: Sim, c: Customer): void {
  c.creditPart = billTotal(sim, c);
  c.pay = { method: 'credit', total: 0, given: 0, discountPct: c.discountPct ?? 0, startTick: sim.tick };
  sim.complete(c, 0);
}

function unpack(sim: Sim, did: number, p: string, units: number): void {
  const i = sim.deliveries.findIndex((d) => d.id === did);
  if (i >= 0) sim.deliveries.splice(i, 1);
  if (units > 0 && sim.cfg.products.includes(p)) {
    sim.stock[p] = (sim.stock[p] ?? 0) + units;
    sim.emit({ t: 'stock', p });
  }
}

/** Builds and queues a decision. Returns false when the situation does not warrant one. */
export function startDecisionFor(sim: Sim, c: Customer | undefined, kind: DecisionKind, p?: string, extra?: number): boolean {
  const d = build(sim, c, kind, p, extra);
  if (!d) return false;
  if (c) {
    const target = kind === 'complaint' ? 'complaining' : 'deciding';
    if (c.state !== target) sim.setState(c, target);
  }
  sim.pushDecision(d);
  return true;
}

function build(sim: Sim, c: Customer | undefined, kind: DecisionKind, p?: string, extra?: number): NewDecision | null {
  const r = sim.rng(0xdec, sim.tick, c?.id ?? 0, kind.length);
  const base = { kind, customerId: c?.id, params: {}, data: {}, ttl: ttl(sim, 150) } satisfies Partial<NewDecision>;
  switch (kind) {
    case 'bargain': {
      if (!c) return null;
      const ask = r.pick([10, 15, 20]);
      return {
        ...base, title: 'dec.bargain.title', prompt: `dec.bargain.say.${c.flex}`, params: { pct: ask, total: sim.subtotal(c) },
        options: [{ key: 'opt.bargain.full', params: { pct: ask } }, { key: 'opt.bargain.small', params: { pct: 5 } }, { key: 'opt.bargain.no' }],
        best: [2, 1, 0][c.flex]!, ok: c.flex === 0 ? [0, 1] : c.flex === 1 ? [0] : [], data: { ask },
      };
    }
    case 'credit': {
      if (!c) return null;
      const bill = billTotal(sim, c);
      const limit = sim.cfg.mods.creditLimit ?? 1500;
      const out = sim.stats.creditOutstanding;
      const half = Math.max(5, round5(bill / 2));
      const best = out + bill <= limit && c.trust >= 4 ? 0 : c.trust >= 3 && out + (bill - half) <= limit ? 1 : 2;
      return {
        ...base, title: 'dec.credit.title', prompt: 'dec.credit.prompt', hint: `hint.trust.${c.trust}`,
        params: { total: bill, trust: c.trust, limit, out, half },
        options: [{ key: 'opt.credit.full' }, { key: 'opt.credit.half', params: { n: half } }, { key: 'opt.credit.no' }],
        best, ok: best === 0 ? [1] : best === 1 ? [2] : [], data: { half },
      };
    }
    case 'coupon': {
      if (!c) return null;
      const type = r.int(3);
      const valid = r.chance(50);
      const pct = r.pick([10, 15, 20]);
      const bill = sim.subtotal(c);
      const params: Record<string, string | number> = { pct, total: bill };
      if (type === 0) params.min = valid ? Math.max(5, round5((bill * r.range(50, 100)) / 100)) : bill + r.pick([20, 50, 100]);
      else if (type === 1) {
        const inOrder = c.order.filter((l) => l.got > 0).map((l) => l.p);
        const outside = sim.cfg.products.filter((x) => !inOrder.includes(x));
        params.product = `#${valid || outside.length === 0 ? inOrder[0] : r.pick(outside)}`;
      } else {
        const today = r.range(5, 25);
        params.today = today;
        params.day = valid ? today + r.range(0, 5) : today - r.range(1, 4);
      }
      const isValid = type === 1 ? c.order.some((l) => l.got > 0 && `#${l.p}` === params.product) : valid;
      return {
        ...base, title: 'dec.coupon.title', prompt: `dec.coupon.prompt.${type}`, params,
        options: [{ key: 'opt.coupon.accept', params: { pct } }, { key: 'opt.coupon.reject' }],
        best: isValid ? 0 : 1, data: { valid: isValid ? 1 : 0, pct },
      };
    }
    case 'complaint': {
      if (!c) return null;
      const type = r.int(2);
      if (type === 0) {
        return {
          ...base, title: 'dec.complaint.title', prompt: 'dec.complaint.prompt.0', params: { product: `#${r.pick(sim.cfg.products)}` },
          options: [{ key: 'opt.complaint.replace' }, { key: 'opt.complaint.argue' }, { key: 'opt.complaint.ignore' }],
          best: 0, data: { type, cost: 20 },
        };
      }
      const items = r.shuffle([...sim.cfg.products]).slice(0, Math.min(3, sim.cfg.products.length));
      let sum = 0;
      const rows: DecisionRow[] = items.map((id) => {
        const qty = r.range(1, 3);
        sum += qty * sim.sell[id]!;
        return { cells: [`#${id}`, qty, sim.sell[id]!, qty * sim.sell[id]!] };
      });
      const truth = r.chance(50);
      const diff = r.pick([10, 20, 50]);
      return {
        ...base, ttl: ttl(sim, 220), title: 'dec.complaint.title', prompt: 'dec.complaint.prompt.1', params: { charged: truth ? sum + diff : sum, n: diff },
        header: ['col.item', 'col.qty', 'col.price', 'col.total'], rows,
        options: [{ key: 'opt.complaint.refund', params: { n: diff } }, { key: 'opt.complaint.explain' }, { key: 'opt.complaint.argue' }],
        best: truth ? 0 : 1, data: { type, cost: diff, truth: truth ? 1 : 0 },
      };
    }
    case 'outage': {
      if (!c) return null;
      const best = c.hasCash ? 0 : c.trust >= 4 ? 1 : 2;
      return {
        ...base, title: 'dec.outage.title', prompt: c.hasCash ? 'dec.outage.say.cash' : 'dec.outage.say.nocash', hint: `hint.trust.${c.trust}`,
        params: { total: billTotal(sim, c), trust: c.trust },
        options: [{ key: 'opt.outage.cash' }, { key: 'opt.outage.khata' }, { key: 'opt.outage.later' }],
        best, ok: best === 1 ? [2] : [], data: {},
      };
    }
    case 'childShort': {
      if (!c) return null;
      const idxs: number[] = [];
      c.order.forEach((l, i) => { if (l.got > 0 && !l.free) idxs.push(i); });
      if (idxs.length < 2) return null;
      const totals = idxs.map((i) => c.order[i]!.got * sim.unitPrice(c.order[i]!.p));
      const bill = totals.reduce((a, b) => a + b, 0);
      const minLine = Math.min(...totals);
      const short = Math.max(5, Math.min(minLine, r.pick([5, 10, minLine])));
      const best = totals.indexOf(minLine);
      const ok = totals.map((t, i) => (t === minLine && i !== best ? i : -1)).filter((i) => i >= 0);
      ok.push(idxs.length);
      return {
        ...base, ttl: ttl(sim, 200), title: 'dec.child.title', prompt: 'dec.child.prompt', params: { money: bill - short, total: bill, n: short },
        header: ['col.item', 'col.qty', 'col.total'],
        rows: idxs.map((i, k) => ({ cells: [`#${c.order[i]!.p}`, c.order[i]!.got, totals[k]!] })),
        rowSelect: true, options: [{ key: 'opt.child.gift', params: { n: short } }],
        best, ok, data: { idxs, money: bill - short },
      };
    }
    case 'priceShock': {
      if (!p) return null;
      const keep = sim.cfg.objectives.some((o) => o.primary && o.metric === 'satisfaction');
      return {
        ...base, customerId: undefined, title: 'dec.priceShock.title', prompt: 'dec.priceShock.prompt', params: { product: `#${p}`, pct: 20 },
        options: [{ key: 'opt.price.raise', params: { pct: 20 } }, { key: 'opt.price.keep' }],
        best: keep ? 1 : 0, ok: [keep ? 0 : 1], data: { p },
      };
    }
    case 'expense': {
      const amt = extra && extra > 0 ? extra : r.pick([150, 200, 250]) + 50 * Math.floor(sim.cfg.difficulty / 3);
      const due = sim.stats.debtPaid || sim.stats.debtFailed ? 0 : sim.cfg.mods.supplierDebt ?? 0;
      const best = sim.cash - amt >= due + 100 ? 0 : sim.cash - amt / 2 >= due ? 2 : 1;
      return {
        ...base, customerId: undefined, ttl: ttl(sim, 200), title: 'dec.expense.title', prompt: `dec.expense.prompt.${r.int(3)}`,
        params: { n: amt, cash: sim.cash, due },
        options: [
          { key: 'opt.expense.now', params: { n: amt } },
          { key: 'opt.expense.later', params: { n: Math.floor((amt * 12) / 10) } },
          { key: 'opt.expense.half', params: { n: Math.floor(amt / 2), m: Math.floor((amt * 11) / 20) } },
        ],
        best, ok: best === 0 ? [] : best === 2 ? [1] : [], data: { amt },
      };
    }
    case 'inspect': {
      const d = sim.deliveries.find((x) => x.id === extra);
      if (!d) return null;
      const real = r.int(3);
      const others = r.shuffle(sim.cfg.products.filter((x) => x !== d.p && x !== d.defectP)).slice(0, 2);
      const rows: DecisionRow[] = [];
      let k = 0;
      for (let i = 0; i < 3; i++) {
        if (i === real) {
          const ordered = PRODUCT_MAP[d.p]!.carton;
          const cells: (string | number)[] = [`#${d.p}`, ordered, `#${d.p} × ${d.units}`, '@cond.ok'];
          if (d.defect === 1) cells[2] = `#${d.defectP} × ${d.units}`;
          if (d.defect === 2) cells[2] = `#${d.p} × ${d.units - Math.max(2, Math.floor((d.units * 3) / 10))}`;
          if (d.defect === 3) cells[3] = '@cond.damaged';
          rows.push({ cells });
        } else {
          const o = others[k++] ?? d.p;
          const n = PRODUCT_MAP[o]!.carton;
          rows.push({ cells: [`#${o}`, n, `#${o} × ${n}`, '@cond.ok'] });
        }
      }
      return {
        ...base, customerId: undefined, ttl: ttl(sim, 220), title: 'dec.inspect.title', prompt: 'dec.inspect.prompt', params: {},
        header: ['col.invoice', 'col.ordered', 'col.delivered', 'col.condition'], rows, rowSelect: true,
        options: [{ key: 'opt.inspect.ok' }], best: d.defect ? real : 3, data: { did: d.id, real },
      };
    }
    case 'negotiate': {
      if (!p) return null;
      const cost = sim.cartonCost(p);
      const mood = r.int(3);
      const quote = Math.ceil((cost * 115) / 500) * 5;
      const small = round5((cost * 107) / 100);
      return {
        ...base, customerId: undefined, title: 'dec.negotiate.title', prompt: `dec.negotiate.say.${mood}`, params: { product: `#${p}`, n: quote },
        options: [{ key: 'opt.negotiate.accept', params: { n: quote } }, { key: 'opt.negotiate.small', params: { n: small } }, { key: 'opt.negotiate.big', params: { n: cost } }],
        best: [2, 1, 0][mood]!, ok: mood === 0 ? [0, 1] : mood === 1 ? [0] : [], data: { p, mood, quote, small, cost },
      };
    }
    case 'suppliers': {
      if (!p) return null;
      const cost = sim.cartonCost(p);
      const offers = [
        { price: round5((cost * r.range(80, 90)) / 100), lead: r.range(20, 26) * 10, q: r.pick([75, 80, 85]) },
        { price: round5((cost * r.range(95, 105)) / 100), lead: r.range(10, 14) * 10, q: 100 },
        { price: round5((cost * r.range(120, 135)) / 100), lead: r.range(3, 5) * 10, q: 100 },
      ];
      r.shuffle(offers);
      const isUrgent = urgent(sim, p);
      const eff = offers.map((o) => Math.floor((o.price * 1000) / o.q));
      let best = 0;
      offers.forEach((o, i) => {
        const b = offers[best]!;
        if (isUrgent ? o.lead < b.lead : eff[i]! < eff[best]! || (eff[i] === eff[best] && o.lead < b.lead)) best = i;
      });
      const worst = eff.indexOf(Math.max(...eff));
      return {
        ...base, customerId: undefined, ttl: ttl(sim, 220), title: 'dec.suppliers.title', prompt: isUrgent ? 'dec.suppliers.urgent' : 'dec.suppliers.normal',
        params: { product: `#${p}` }, header: ['col.supplier', 'col.price', 'col.time', 'col.quality'],
        rows: offers.map((o, i) => ({ cells: [`@sup.${i}`, o.price, `${o.lead / 10} @unit.sec`, `${o.q}%`] })), rowSelect: true, options: [],
        best, ok: isUrgent ? [] : [0, 1, 2].filter((i) => i !== best && i !== worst),
        data: { p, prices: offers.map((o) => o.price), leads: offers.map((o) => o.lead), quals: offers.map((o) => o.q) },
      };
    }
    case 'transport': {
      if (!p) return null;
      const fee = r.pick([60, 80, 100]);
      const isUrgent = urgent(sim, p);
      const best = isUrgent ? (sim.cash >= fee ? 1 : 2) : 0;
      return {
        ...base, customerId: undefined, title: 'dec.transport.title', prompt: isUrgent ? 'dec.transport.urgent' : 'dec.transport.normal', params: { product: `#${p}` },
        options: [{ key: 'opt.transport.wait' }, { key: 'opt.transport.van', params: { n: fee } }, { key: 'opt.transport.self' }],
        best, ok: isUrgent ? (best === 1 ? [2] : []) : [1], data: { did: extra ?? 0, fee },
      };
    }
    case 'offers': return buildOffers(sim, p, false);
    case 'ledger': return buildLedger(sim, false);
    case 'stockAudit': return buildStockAudit(sim, false);
    case 'closing': case 'profit': return buildClosing(sim, kind, false);
    case 'debtor': {
      if (!c) return null;
      const t = c.debtorType ?? 0;
      const debt = c.debt ?? 300;
      return {
        ...base, title: 'dec.debtor.title', prompt: `dec.debtor.say.${t}`, params: { n: debt, half: round5(debt / 2) },
        options: [{ key: 'opt.debtor.full', params: { n: debt } }, { key: 'opt.debtor.part', params: { n: round5(debt / 2) } }, { key: 'opt.debtor.ledger' }],
        best: t, ok: t === 0 ? [1, 2] : t === 2 ? [1] : [], data: { debt, t },
      };
    }
    case 'hiddenTotal': {
      if (!c) return null;
      const lines = c.order.filter((l) => l.got > 0 && !l.free);
      if (lines.length === 0) return null;
      const correct = sim.subtotal(c);
      const unit = sim.unitPrice(lines[0]!.p);
      const low = Math.max(5, correct - r.pick([10, 20]));
      const vals = r.shuffle([correct, correct + unit, low === correct ? correct + 2 * unit : low]);
      return {
        ...base, ttl: ttl(sim, 220), title: 'dec.hiddenTotal.title', prompt: 'dec.hiddenTotal.prompt', params: {},
        header: ['col.item', 'col.qty', 'col.price'], rows: lines.map((l) => ({ cells: [`#${l.p}`, l.got, sim.unitPrice(l.p)] })),
        options: vals.map(amount), best: vals.indexOf(correct), data: { vals, correct },
      };
    }
    case 'booking': {
      if (!c || !c.booking) return null;
      const feasible = !!sim.cfg.mods.restock || c.booking.lines.every((l) => sim.available(l.p) >= l.qty);
      return {
        ...base, title: 'dec.booking.title', prompt: 'dec.booking.prompt', params: { n: c.booking.advance },
        header: ['col.item', 'col.qty', 'col.stock'], rows: c.booking.lines.map((l) => ({ cells: [`#${l.p}`, l.qty, Math.max(0, sim.available(l.p))] })),
        options: [{ key: 'opt.booking.accept', params: { n: c.booking.advance } }, { key: 'opt.booking.decline' }],
        best: feasible ? 0 : 1, data: {},
      };
    }
    case 'repair': {
      const fee = 200;
      const best = sim.cash >= fee + 50 ? 0 : 1;
      return {
        ...base, customerId: undefined, title: 'dec.repair.title', prompt: 'dec.repair.prompt', params: { n: fee, cash: sim.cash },
        options: [{ key: 'opt.repair.mechanic', params: { n: fee } }, { key: 'opt.repair.sale' }, { key: 'opt.repair.nothing' }],
        best, ok: best === 0 ? [1] : [], data: { fee },
      };
    }
    case 'creditKing': return buildCreditKing(sim);
    default: return null;
  }
}

function buildOffers(sim: Sim, p: string | undefined, boss: boolean): NewDecision | null {
  const r = sim.rng(0x0ff, sim.tick, sim.boss?.moves ?? 0);
  const level = bossLevel(sim);
  const prod = p ?? [...sim.cfg.products].sort((a, b) => sim.available(a) - sim.available(b) || (a < b ? -1 : 1))[r.int(Math.min(3, sim.cfg.products.length))]!;
  const def = PRODUCT_MAP[prod]!;
  const units = def.carton * 2;
  const base = sim.buy[prod]!;
  const offers = [
    { list: Math.ceil((base * r.range(96, 102)) / 100), disc: r.pick([0, 0, 5]), fee: level >= 2 ? r.pick([0, 30, 50]) : 0, bonus: 0 },
    { list: Math.ceil((base * r.range(130, 142)) / 100), disc: r.pick([20, 25]), fee: 0, bonus: level >= 3 ? r.pick([0, 2]) : 0 },
    { list: Math.ceil((base * r.range(110, 120)) / 100), disc: 10, fee: level >= 2 ? r.pick([0, 20, 40]) : 0, bonus: level >= 3 ? r.pick([0, 1, 3]) : 0 },
  ];
  r.shuffle(offers);
  const total = (o: (typeof offers)[number]): number => Math.ceil((o.list * units * (100 - o.disc)) / 100) + o.fee;
  const eff = (o: (typeof offers)[number]): number => Math.floor((total(o) * 1000) / (units + o.bonus));
  // Guarantee a unique cheapest offer.
  for (let guard = 0; guard < 6; guard++) {
    const e = offers.map(eff);
    const min = Math.min(...e);
    const ties = e.map((v, i) => (v === min ? i : -1)).filter((i) => i >= 0);
    if (ties.length < 2) break;
    offers[ties[1]!]!.fee += 10;
  }
  const totals = offers.map(total);
  let budget = sim.cash;
  if (boss) {
    const sorted = [...totals].sort((a, b) => a - b);
    budget = level >= 3 && r.chance(40) ? sorted[1]! + 5 : sorted[2]! + r.pick([50, 100, 200]);
  }
  let best = 3;
  offers.forEach((o, i) => { if (totals[i]! <= budget && (best === 3 || eff(o) < eff(offers[best]!))) best = i; });
  return {
    kind: 'offers', title: boss ? 'dec.offers.bossTitle' : 'dec.offers.title', prompt: 'dec.offers.prompt', params: { product: `#${prod}`, units, budget },
    header: ['col.offer', 'col.listPrice', 'col.discount', 'col.fee', 'col.units'],
    rows: offers.map((o, i) => ({ cells: [`@offer.${i}`, o.list, `${o.disc}%`, o.fee, o.bonus > 0 ? `${units} + ${o.bonus}` : units] })),
    rowSelect: true, options: [{ key: 'opt.offers.skip' }], best, ok: boss || best === 3 ? [] : [3],
    ttl: boss ? bossTtl(sim) : ttl(sim, 300), boss,
    data: { p: prod, totals, units: offers.map((o) => units + o.bonus), boss: boss ? 1 : 0 },
  };
}

function buildLedger(sim: Sim, boss: boolean): NewDecision {
  const r = sim.rng(0x1ed, sim.tick, sim.boss?.moves ?? 0);
  const n = Math.min(sim.cfg.products.length, 3 + bossLevel(sim));
  const items = r.shuffle([...sim.cfg.products]).slice(0, n);
  const wrong = r.int(items.length);
  const rows: DecisionRow[] = items.map((id, i) => {
    const qty = r.range(2, 9);
    const unit = sim.sell[id]!;
    let total = qty * unit;
    if (i === wrong) {
      const deltas = r.shuffle([10, -10, unit, -unit, 100, -100, 5]);
      total += deltas.find((d) => total + d > 0)!;
    }
    return { cells: [`#${id}`, qty, unit, total] };
  });
  return {
    kind: 'ledger', title: boss ? 'dec.ledger.bossTitle' : 'dec.ledger.title', prompt: 'dec.ledger.prompt', params: {},
    header: ['col.item', 'col.qty', 'col.price', 'col.total'], rows, rowSelect: true, options: [], best: wrong,
    ttl: boss ? bossTtl(sim) : ttl(sim, 300), boss, data: {},
  };
}

function buildStockAudit(sim: Sim, boss: boolean): NewDecision {
  const r = sim.rng(0x57a, sim.tick, sim.boss?.moves ?? 0);
  const n = Math.min(sim.cfg.products.length, 3 + bossLevel(sim));
  const items = r.shuffle([...sim.cfg.products]).slice(0, n);
  const wrong = r.int(items.length);
  const rows: DecisionRow[] = items.map((id, i) => {
    const open = r.range(12, 30);
    const recv = r.pick([0, 6, 12]);
    const sold = r.range(3, open + recv - 8);
    const shelf = open + recv - sold - (i === wrong ? r.range(2, 6) : 0);
    return { cells: [`#${id}`, open, recv, sold, shelf] };
  });
  return {
    kind: 'stockAudit', title: boss ? 'dec.audit.bossTitle' : 'dec.audit.title', prompt: 'dec.audit.prompt', params: {},
    header: ['col.item', 'col.opening', 'col.received', 'col.sold', 'col.shelf'], rows, rowSelect: true, options: [], best: wrong,
    ttl: boss ? bossTtl(sim) : ttl(sim, 300), boss, data: {},
  };
}

function buildClosing(sim: Sim, kind: 'closing' | 'profit', boss: boolean): NewDecision {
  const s = sim.stats;
  const common = { ttl: boss ? bossTtl(sim) : ttl(sim, 350), boss, header: ['col.entry', 'col.amount'] };
  if (kind === 'closing') {
    const correct = sim.expectedCash();
    const { values, best } = shuffledOptions(sim, 1, correct, [
      correct + (s.creditGiven || 150), correct + (s.paidOut || -100), correct - 50, correct + 100,
    ]);
    return {
      ...common, kind, title: boss ? 'dec.closing.bossTitle' : 'dec.closing.title', prompt: 'dec.closing.prompt', params: {},
      rows: [
        { cells: ['@row.opening', sim.cfg.startCash] }, { cells: ['@row.cashSales', s.cashSales] }, { cells: ['@row.collected', s.collected] },
        { cells: ['@row.supplier', -s.supplierSpend] }, { cells: ['@row.expenses', -s.paidOut] }, { cells: ['@row.creditSales', s.creditGiven] },
      ],
      options: values.map(amount), best, data: { correct },
    };
  }
  const correct = sim.profit();
  const { values, best } = shuffledOptions(sim, 2, correct, [
    s.revenue - s.cogs === correct ? correct + 80 : s.revenue - s.cogs, correct - 50, -correct === correct ? correct + 120 : s.revenue - s.expenses, correct + 100,
  ]);
  return {
    ...common, kind, title: boss ? 'dec.profit.bossTitle' : 'dec.profit.title', prompt: 'dec.profit.prompt', params: {},
    rows: [
      { cells: ['@row.revenue', s.revenue] }, { cells: ['@row.cogs', -s.cogs] }, { cells: ['@row.expenses', -s.expenses] }, { cells: ['@row.waste', -s.wasteValue] },
    ],
    options: values.map(amount), best, data: { correct },
  };
}

function buildCreditKing(sim: Sim): NewDecision {
  const b = sim.boss!;
  const r = sim.rng(0xc4e, b.moves, sim.tick);
  const level = bossLevel(sim);
  const limit = 3000;
  if (b.moves === 0) sim.kingOut = r.range(8, 14) * 100;
  let repaid = 0;
  if (limit - sim.kingOut < 300 || (b.moves > 0 && r.chance(35))) {
    repaid = Math.min(sim.kingOut, r.pick([400, 600, 1000]));
    sim.kingOut -= repaid;
  }
  const ask = level >= 3 ? r.range(8, 30) * 50 : r.pick([400, 600, 800, 1000, 1200, 1600]);
  const half = round5(ask / 2);
  const out = sim.kingOut;
  const best = out + ask <= limit ? 0 : out + half <= limit ? 1 : 2;
  return {
    kind: 'creditKing', title: 'dec.king.title', prompt: `dec.king.say.${r.int(4)}`, hint: repaid > 0 ? 'hint.king.repaid' : undefined,
    params: { limit, out, n: ask, half, repaid, room: limit - out },
    options: [{ key: 'opt.king.full', params: { n: ask } }, { key: 'opt.king.half', params: { n: half } }, { key: 'opt.king.no' }],
    best, ttl: bossTtl(sim), boss: true, data: { ask, half },
  };
}

/** Boss "moves": the scripted attacks of each boss encounter. */
export function bossMove(sim: Sim): void {
  const b = sim.boss!;
  const cfg = sim.cfg.boss!;
  const phase = cfg.phases[b.phase]!;
  let d: NewDecision | null = null;
  switch (cfg.id) {
    case 'creditKing': d = buildCreditKing(sim); break;
    case 'tycoon': d = buildOffers(sim, undefined, true); break;
    case 'thief':
      if (b.moves % 2 === 0) d = buildStockAudit(sim, true);
      else {
        sim.addHotspot({ kind: 'thief', until: sim.tick + Math.max(25, Math.floor(phase.deadline / 4)), data: 1 });
        sim.emit({ t: 'banner', key: 'ev.thief', tone: 'warn' });
      }
      break;
    case 'ghost': {
      const cycle = ['ledger', 'profit', 'ledger', 'closing'] as const;
      const k = cycle[b.moves % cycle.length]!;
      d = k === 'ledger' ? buildLedger(sim, true) : buildClosing(sim, k, true);
      break;
    }
    default: break;
  }
  b.moves++;
  b.nextMove = sim.tick + phase.every;
  if (d) sim.pushDecision(d);
}

export function closingDecision(sim: Sim, kind: 'closing' | 'profit' | 'ledger'): void {
  sim.pushDecision(kind === 'ledger' ? buildLedger(sim, false) : buildClosing(sim, kind, false));
}

/** Applies the consequences of a choice. `option` is -1 on timeout. */
export function resolveDecision(sim: Sim, d: Decision, option: number, good: boolean, c: Customer | undefined): void {
  const data = d.data as Record<string, number> & { p?: string; idxs?: number[]; vals?: number[]; prices?: number[]; leads?: number[]; quals?: number[]; totals?: number[]; units?: number[] };
  const alive = !!c && c.state !== 'lostPatience' && c.state !== 'leaving' && c.state !== 'gone';
  switch (d.kind) {
    case 'bargain': {
      if (!c || !alive) return;
      const accepted = option === 0 || (option === 1 && c.flex <= 1) || (option === 2 && c.flex === 0);
      if (!accepted) { sim.dismiss(c, 'angry', 'say.bargainFail'); return; }
      c.discountPct = option === 0 ? data.ask : option === 1 ? 5 : 0;
      if (option !== 2) sim.emit({ t: 'say', id: c.id, key: 'say.bargainOk' });
      sim.advancePayment(c);
      return;
    }
    case 'credit': {
      if (!c || !alive) return;
      if (option === 0) { completeOnCredit(sim, c); return; }
      if (option === 1) {
        c.creditPart = billTotal(sim, c) - data.half!;
        c.forceExact = true;
        sim.advancePayment(c);
        return;
      }
      sim.dismiss(c, c.trust >= 4 ? 'sad' : 'ok', 'say.creditNo');
      return;
    }
    case 'coupon': {
      if (!c || !alive) return;
      if (option === 0) c.discountPct = data.pct;
      else if (data.valid) { c.satisfaction -= 30; sim.emit({ t: 'say', id: c.id, key: 'say.couponAngry' }); }
      sim.advancePayment(c);
      return;
    }
    case 'complaint': {
      if (!c || !alive) return;
      if (good) {
        c.patience = c.patienceMax;
        sim.payExpense(data.type === 0 ? data.cost! : data.truth ? data.cost! : 0);
        sim.emit({ t: 'say', id: c.id, key: 'say.calm' });
      } else {
        c.patience = Math.floor(c.patience / 2);
        c.satisfaction -= 20;
        if (data.type === 1 && option === 0) sim.payExpense(data.cost!);
        sim.emit({ t: 'say', id: c.id, key: 'say.stillAngry' });
      }
      sim.setState(c, 'ordering');
      sim.emit({ t: 'orderChange', id: c.id });
      return;
    }
    case 'outage': {
      if (!c || !alive) return;
      if (option === 0) {
        if (!c.hasCash) { sim.dismiss(c, 'sad', 'say.noCash'); return; }
        c.forceExact = true;
        sim.advancePayment(c);
      } else if (option === 1) completeOnCredit(sim, c);
      else sim.dismiss(c, 'ok', 'say.later');
      return;
    }
    case 'childShort': {
      if (!c || !alive) return;
      const idxs = data.idxs ?? [];
      if (option >= 0 && option < idxs.length) c.order.splice(idxs[option]!, 1);
      else c.fixedTotal = data.money;
      c.forceExact = true;
      sim.emit({ t: 'orderChange', id: c.id });
      sim.advancePayment(c);
      return;
    }
    case 'priceShock': {
      const p = data.p!;
      sim.buy[p] = Math.ceil((sim.buy[p]! * 125) / 500) * 5;
      if (option === 0) { sim.sell[p] = round5((sim.sell[p]! * 120) / 100); sim.priceRaised[p] = true; }
      sim.emit({ t: 'stock', p });
      return;
    }
    case 'expense': {
      const amt = data.amt!;
      if (option === 0) sim.payExpense(amt);
      else if (option === 2) { sim.payExpense(Math.floor(amt / 2)); sim.deferred += Math.floor((amt * 11) / 20); }
      else sim.deferred += Math.floor((amt * 12) / 10);
      sim.stats.deferred = sim.deferred;
      return;
    }
    case 'inspect': {
      const dl = sim.deliveries.find((x) => x.id === data.did);
      if (!dl) return;
      if (good) { unpack(sim, dl.id, dl.p, PRODUCT_MAP[dl.p]!.carton >= dl.units ? dl.units : dl.units); sim.emit({ t: 'banner', key: dl.defect ? 'ev.inspectCaught' : 'ev.inspectOk', tone: 'good' }); return; }
      if (!dl.defect) {
        dl.arrive = sim.tick + 60; dl.inspected = true;
        sim.emit({ t: 'banner', key: 'ev.inspectFalse', tone: 'bad' });
        return;
      }
      if (dl.defect === 1) unpack(sim, dl.id, dl.defectP ?? dl.p, dl.units);
      else if (dl.defect === 2) {
        const short = Math.max(2, Math.floor((dl.units * 3) / 10));
        sim.stats.waste += short; sim.stats.wasteValue += short * sim.buy[dl.p]!;
        unpack(sim, dl.id, dl.p, dl.units - short);
      } else {
        unpack(sim, dl.id, dl.p, dl.units);
        sim.damaged[dl.p] = (sim.damaged[dl.p] ?? 0) + 3;
        sim.addHotspot({ kind: 'damaged', p: dl.p, until: sim.tick + 200 });
      }
      sim.emit({ t: 'banner', key: 'ev.inspectMissed', tone: 'bad' });
      return;
    }
    case 'negotiate': {
      const p = data.p!;
      const mood = data.mood!;
      let price = data.quote!;
      let lead = sim.cfg.mods.leadTicks ?? 80;
      if (option === 1) { if (mood <= 1) price = data.small!; else { lead += 40; sim.emit({ t: 'banner', key: 'ev.supplierAnnoyed', tone: 'bad' }); } }
      if (option === 2) { if (mood === 0) price = data.cost!; else { lead += 80; sim.emit({ t: 'banner', key: 'ev.supplierAnnoyed', tone: 'bad' }); } }
      if (sim.cash < price) { sim.emit({ t: 'banner', key: 'ev.noCash', tone: 'bad' }); return; }
      sim.orderDelivery(p, price, lead, 100, sim.restockCount + 100);
      return;
    }
    case 'suppliers': {
      const i = option >= 0 && option < 3 ? option : 1;
      const price = data.prices![i]!;
      if (sim.cash < price) { sim.emit({ t: 'banner', key: 'ev.noCash', tone: 'bad' }); return; }
      sim.orderDelivery(data.p!, price, data.leads![i]!, data.quals![i]!, sim.restockCount + 200);
      return;
    }
    case 'transport': {
      const dl = sim.deliveries.find((x) => x.id === data.did);
      if (!dl || dl.arrive === 0) return;
      if (option === 1) { sim.payExpense(data.fee!); dl.arrive = sim.tick + 30; }
      else if (option === 2) { sim.setFlag('closed', 80); dl.arrive = sim.tick + 80; }
      else dl.arrive += 200;
      return;
    }
    case 'offers': {
      if (data.boss || option < 0 || option > 2) return;
      const total = data.totals![option]!;
      if (sim.cash < total) { sim.emit({ t: 'banner', key: 'ev.noCash', tone: 'bad' }); return; }
      sim.orderDelivery(data.p!, total, 60, 100, sim.restockCount + 300, data.units![option]!);
      return;
    }
    case 'closing': {
      const mm = sim.mismatch();
      sim.emit({ t: 'banner', key: mm === 0 ? 'ev.closingClean' : 'ev.closingMismatch', tone: mm === 0 ? 'good' : 'bad', params: { n: mm } });
      return;
    }
    case 'creditKing': {
      if (option === 0) sim.kingOut += data.ask!;
      else if (option === 1) sim.kingOut += data.half!;
      return;
    }
    case 'debtor': {
      if (!c || !alive) return;
      const t = data.t!;
      const debt = data.debt!;
      let got = 0;
      if (option === 0) got = t === 0 ? debt : 0;
      else if (option === 1) got = t === 2 ? round5(debt / 2) : round5(debt / 2);
      else if (option === 2) got = t === 1 ? 0 : debt;
      if (got > 0) {
        sim.addCash(got);
        sim.stats.collected += got;
        sim.stats.creditCollected += got;
        sim.dismiss(c, 'ok', 'say.debtPaid');
      } else sim.dismiss(c, option < 0 ? 'ok' : 'sad', 'say.debtNo');
      return;
    }
    case 'hiddenTotal': {
      if (!c || !alive) return;
      const v = option >= 0 ? data.vals![option]! : data.correct!;
      if (v > data.correct!) { c.patience -= Math.floor(c.patienceMax / 10); sim.emit({ t: 'say', id: c.id, key: 'say.overcharged' }); }
      else if (v < data.correct!) c.fixedTotal = Math.max(5, v);
      sim.advancePayment(c);
      return;
    }
    case 'booking': {
      if (!c || !alive || !c.booking) return;
      if (option === 0) {
        const adv = c.booking.advance;
        sim.addCash(adv);
        sim.stats.cashSales += adv;
        sim.stats.revenue += adv;
        sim.specials.push({ tick: sim.tick + 350, arch: 'pickup', lines: c.booking.lines, advance: adv });
        sim.emit({ t: 'banner', key: 'ev.booked', tone: 'info' });
        sim.dismiss(c, 'ok', 'say.booked');
      } else sim.dismiss(c, 'ok', 'say.later');
      return;
    }
    case 'repair': {
      if (option === 0 && sim.cash >= data.fee!) {
        sim.payExpense(data.fee!);
        sim.fridgeFixAt = sim.tick + 100;
        sim.spoilAt = 0;
      } else if (option === 1) {
        for (const id of sim.cfg.products) if (PRODUCT_MAP[id]!.cold) { sim.discount[id] = 40; sim.emit({ t: 'stock', p: id }); }
        sim.spoilAt = sim.tick + 300;
      } else sim.spoilAt = sim.tick + 200;
      return;
    }
    default: return;
  }
}

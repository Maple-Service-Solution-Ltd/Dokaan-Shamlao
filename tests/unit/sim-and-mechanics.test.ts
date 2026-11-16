import { describe, expect, it } from 'vitest';
import { Sim, canTransition } from '@/core/sim';
import { Act, DENOMS } from '@/core/types';
import { makeChange, botPlay, BOT_SKILLED } from '@/core/bot';
import { replay } from '@/core/replay';
import { storyConfig } from '@/content/levels';

describe('Core simulation, customer state machine, cash & replay validation', () => {
  it('enforces valid customer state machine transitions', () => {
    expect(canTransition('entering', 'waiting')).toBe(true);
    expect(canTransition('waiting', 'ordering')).toBe(true);
    expect(canTransition('ordering', 'paying')).toBe(true);
    expect(canTransition('paying', 'satisfied')).toBe(true);
    expect(canTransition('entering', 'paying')).toBe(false);
    expect(canTransition('gone', 'waiting')).toBe(false);
  });

  it('computes exact change and bounded subset-sum correctly', () => {
    const counts = makeChange(135, null);
    expect(counts).not.toBeNull();
    const total = DENOMS.reduce((s, d, i) => s + d * (counts![i] ?? 0), 0);
    expect(total).toBe(135);

    // Limited drawer with only one 50-taka note cannot make 30 taka change
    const limitedTill = [0, 0, 1, 0, 0, 0];
    expect(Sim.canMakeChange(30, limitedTill)).toBe(false);
    expect(Sim.canMakeChange(50, limitedTill)).toBe(true);
  });

  it('processes manual product selection, wrong taps, and payment collection', () => {
    const cfg = storyConfig(1);
    const sim = new Sim(cfg);
    // Advance until first customer is waiting and auto-selected into ordering
    for (let i = 0; i < 25; i++) sim.step();
    const c = sim.current;
    expect(c).toBeDefined();
    expect(c!.state).toBe('ordering');

    const neededP = c!.order[0]!.p;
    const wrongP = cfg.products.find((p) => !c!.order.some((l) => l.p === p))!;
    const wrongIdx = cfg.products.indexOf(wrongP);
    const rightIdx = cfg.products.indexOf(neededP);

    // Tapping a product not in the order records a wrong tap
    sim.act(Act.Add, wrongIdx, 1);
    expect(sim.stats.wrongTaps).toBe(1);

    // Bag all required items for the customer
    for (const line of c!.order) {
      const idx = cfg.products.indexOf(line.p);
      while (line.got < line.qty) {
        sim.act(Act.Add, idx, 1);
      }
    }
    expect(c!.state).toBe('paying');
    expect(rightIdx).toBeGreaterThanOrEqual(0);

    // Level 1 uses exact payment
    expect(sim.act(Act.Collect)).toBe(true);
    expect(sim.stats.served).toBe(1);
  });

  it('replays a recorded action log deterministically and rejects tampered logs', () => {
    const cfg = storyConfig(3);
    const finished = botPlay(new Sim(cfg), BOT_SKILLED);
    expect(finished.ended).toBe(true);
    expect(finished.result?.won).toBe(true);

    const validReplay = replay(cfg, finished.log, finished.tick, false);
    expect(validReplay.ok).toBe(true);
    expect(validReplay.result?.score).toBe(finished.result?.score);
    expect(validReplay.result?.stars).toBe(finished.result?.stars);

    // Tamper with action order
    const outOfOrder = [
      [20, Act.Collect, 0, 0],
      [10, Act.Collect, 0, 0],
    ];
    expect(replay(cfg, outOfOrder, 30, false).error).toBe('actions_out_of_order');

    // Tamper with illegal action at tick 0
    const illegal = [[0, Act.Collect, 0, 0]];
    expect(replay(cfg, illegal, 10, false).error).toBe('illegal_action');
  });
});

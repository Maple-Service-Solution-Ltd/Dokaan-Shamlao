/**
 * Server-side run validation: re-simulate a recorded action log and return the authoritative result.
 */
import { Sim } from './sim';
import type { ActionTuple, GameConfig, RunResult } from './types';

export interface ReplayOutcome {
  ok: boolean;
  error?: string;
  result?: RunResult;
  /** Highest number of actions within any 10-tick (1 second) window. */
  peakActionsPerSec: number;
}

export const MAX_ACTIONS = 6000;
export const MAX_TICKS = 36_000; // one hour of simulated play

export function replay(cfg: GameConfig, log: ActionTuple[], endTick: number, quit: boolean): ReplayOutcome {
  const fail = (error: string): ReplayOutcome => ({ ok: false, error, peakActionsPerSec: 0 });
  if (!Array.isArray(log) || log.length > MAX_ACTIONS) return fail('too_many_actions');
  if (!Number.isInteger(endTick) || endTick < 0 || endTick > MAX_TICKS) return fail('bad_end_tick');
  let prev = 0;
  for (const a of log) {
    if (!Array.isArray(a) || a.length < 2 || a.length > 10 || a.some((n) => !Number.isInteger(n))) return fail('malformed_action');
    if (a[0]! < prev) return fail('actions_out_of_order');
    prev = a[0]!;
  }
  let peak = 0;
  for (let i = 0, j = 0; i < log.length; i++) {
    while (log[i]![0]! - log[j]![0]! >= 10) j++;
    peak = Math.max(peak, i - j + 1);
  }
  const sim = new Sim(cfg);
  let i = 0;
  const applyDue = (): string | null => {
    while (i < log.length && log[i]![0] === sim.tick) {
      const [, type, a, b, ...rest] = log[i]!;
      if (!sim.act(type!, a ?? 0, b ?? 0, rest)) return 'illegal_action';
      i++;
    }
    return null;
  };
  while (!sim.ended && sim.tick < endTick) {
    const err = applyDue();
    if (err) return { ...fail(err), peakActionsPerSec: peak };
    if (sim.ended) break;
    sim.step();
  }
  if (!sim.ended) {
    const err = applyDue();
    if (err) return { ...fail(err), peakActionsPerSec: peak };
  }
  if (i < log.length) return { ...fail('actions_after_end'), peakActionsPerSec: peak };
  if (!sim.ended) {
    if (!quit) return { ...fail('run_not_finished'), peakActionsPerSec: peak };
    sim.quit();
  }
  return { ok: true, result: sim.result!, peakActionsPerSec: peak };
}

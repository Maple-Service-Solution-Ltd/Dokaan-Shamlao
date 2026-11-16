/** Diagnostic: plays every story level and each mode with the reference bots and prints a report. */
import { Sim } from '../src/core/sim';
import { botPlay, BOT_CASUAL, BOT_SKILLED, BOT_STEADY } from '../src/core/bot';
import { replay } from '../src/core/replay';
import { storyConfig, TOTAL_LEVELS } from '../src/content/levels';
import { validateConfig } from '../src/content/builder';
import { endlessConfig, timeConfig, survivalConfig, dailyConfig, friendConfig } from '../src/content/modes';

const only = process.argv[2] ? Number(process.argv[2]) : 0;
let bad = 0;
const t0 = Date.now();
for (let n = 1; n <= TOTAL_LEVELS; n++) {
  if (only && n !== only) continue;
  try {
    const cfg = storyConfig(n);
    const errs = validateConfig(cfg);
    const s = botPlay(new Sim(cfg), BOT_SKILLED);
    const c = botPlay(new Sim(cfg), n > 60 ? BOT_STEADY : BOT_CASUAL);
    const rp = replay(cfg, s.log, s.tick, false);
    const fails = (r: Sim): string => r.result!.objectives.filter((o) => o.objective.primary && !o.done).map((o) => `${o.objective.metric}${o.objective.op}${o.objective.target}(=${o.value})`).join(',');
    const okAll = errs.length === 0 && s.result!.won && c.result!.won && rp.ok && rp.result!.score === s.result!.score;
    if (!okAll) bad++;
    if (!okAll || only) {
      console.log(`L${n} ${okAll ? 'ok' : 'FAIL'} errs=[${errs}] skilled=${s.result!.won}/${s.result!.reason}/${s.result!.score}/★${s.result!.stars} t=${s.tick}/${cfg.durationTicks} [${fails(s)}] casual=${c.result!.won}/${c.result!.reason}/${c.result!.score}/★${c.result!.stars} t=${c.tick} [${fails(c)}] replay=${rp.ok ? rp.result!.score : rp.error} ch=${cfg.challenges} n=${cfg.customers.count} prods=${cfg.products.length}`);
      if (only) console.log(JSON.stringify(s.result!.stats), '\nobjectives', JSON.stringify(cfg.objectives), '\nstars', cfg.stars);
    }
  } catch (e) { bad++; console.log(`L${n} THROW`, (e as Error).stack?.split('\n').slice(0, 4).join(' | ')); }
}
if (!only) {
  for (const [name, cfg] of [['endless', endlessConfig(123)], ['time60', timeConfig(5, 60)], ['time120', timeConfig(6, 120)], ['survival', survivalConfig(77)], ['daily', dailyConfig('2026-11-16', 999)], ['daily-fri', dailyConfig('2026-11-20', 4242)], ['friend', friendConfig('ABC123', 31337)]] as const) {
    try {
      const s = botPlay(new Sim(cfg), BOT_SKILLED, 20000);
      const c = botPlay(new Sim(cfg), BOT_CASUAL, 20000);
      console.log(`${name}: errs=[${validateConfig(cfg)}] skilled ${s.result!.won}/${s.result!.reason}/score ${s.result!.score}/served ${s.result!.stats.served}/t ${s.tick}; casual ${c.result!.won}/${c.result!.reason}/${c.result!.score}/served ${c.result!.stats.served}/t ${c.tick} ch=${cfg.challenges}`);
    } catch (e) { bad++; console.log(`${name} THROW`, (e as Error).stack?.split('\n').slice(0, 5).join(' | ')); }
  }
}
console.log(`done: ${bad} problem(s) in ${Date.now() - t0}ms`);

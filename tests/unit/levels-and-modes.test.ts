import { describe, expect, it } from 'vitest';
import { Sim } from '@/core/sim';
import { botPlay, BOT_CASUAL, BOT_SKILLED, BOT_STEADY } from '@/core/bot';
import { storyConfig, TOTAL_LEVELS } from '@/content/levels';
import { validateConfig } from '@/content/builder';
import {
  dailyConfig,
  endlessConfig,
  friendConfig,
  generateChallenge,
  survivalConfig,
  timeConfig,
} from '@/content/modes';

describe('100 Story Levels, 5 Bosses & 6 Game Modes', () => {
  it('validates all 100 Story Mode levels and confirms reference bots win every level', () => {
    expect(TOTAL_LEVELS).toBe(100);
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const cfg = storyConfig(n);
      expect(validateConfig(cfg)).toEqual([]);
      const skilled = botPlay(new Sim(cfg), BOT_SKILLED);
      expect(skilled.result?.won, `Level ${n} skilled bot should win`).toBe(true);

      const secondBot = n > 60 ? BOT_STEADY : BOT_CASUAL;
      const casual = botPlay(new Sim(cfg), secondBot);
      expect(casual.result?.won, `Level ${n} casual/steady bot should win`).toBe(true);
    }
  });

  it('validates Endless, Time Attack (60s/120s), Survival, Daily & Friend Challenge modes', () => {
    const configs = [
      endlessConfig(101),
      timeConfig(202, 60),
      timeConfig(303, 120),
      survivalConfig(404),
      dailyConfig('2026-11-16', 505),
      friendConfig('HK2026', 606),
    ];
    for (const cfg of configs) {
      expect(validateConfig(cfg)).toEqual([]);
      const run = botPlay(new Sim(cfg), BOT_SKILLED, 6000);
      expect(run.result).not.toBeNull();
      expect(run.result!.score).toBeGreaterThan(0);
    }
  });

  it('generates deterministic, playable procedural challenges across difficulty levels 1..10', () => {
    for (let diff = 1; diff <= 10; diff++) {
      const cfg1 = generateChallenge({
        seed: 9000 + diff,
        level: diff * 10,
        difficulty: diff,
        id: `gen:${diff}`,
        mode: 'daily',
        title: { bn: 'টেস্ট', en: 'Test' },
      });
      const cfg2 = generateChallenge({
        seed: 9000 + diff,
        level: diff * 10,
        difficulty: diff,
        id: `gen:${diff}`,
        mode: 'daily',
        title: { bn: 'টেস্ট', en: 'Test' },
      });
      expect(validateConfig(cfg1)).toEqual([]);
      expect(cfg1).toEqual(cfg2);
    }
  });
});

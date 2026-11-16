import type { Prisma } from '@prisma/client';
import { prisma } from '../src/server/db';
import { CONTENT_VERSION } from '../src/content/builder';
import { LEVEL_ROWS, storyConfig } from '../src/content/levels';
import { CHALLENGES } from '../src/content/challenges';
import { ACHIEVEMENTS } from '../src/content/achievements';
import { CUSTOMIZATION_ITEMS } from '../src/content/customization';
import { dailySeedForDate, dhakaDateString } from '../src/server/auth';
import { dailyConfig } from '../src/content/modes';

export async function seedDatabase(): Promise<void> {
  // 1. Seed Challenge Templates
  for (const ch of CHALLENGES) {
    await prisma.challengeTemplate.upsert({
      where: { id: ch.id },
      update: {
        category: ch.category,
        difficulty: ch.difficulty,
        minLevel: ch.minLevel,
        nameBn: ch.name.bn,
        nameEn: ch.name.en,
        definition: ch as unknown as Prisma.InputJsonValue,
        version: CONTENT_VERSION,
      },
      create: {
        id: ch.id,
        category: ch.category,
        difficulty: ch.difficulty,
        minLevel: ch.minLevel,
        nameBn: ch.name.bn,
        nameEn: ch.name.en,
        definition: ch as unknown as Prisma.InputJsonValue,
        version: CONTENT_VERSION,
      },
    });
  }

  // 2. Seed 100 Story Levels
  for (const row of LEVEL_ROWS) {
    const cfg = storyConfig(row.n);
    await prisma.level.upsert({
      where: { levelNumber: row.n },
      update: {
        chapter: cfg.chapter,
        titleBn: row.title.bn,
        titleEn: row.title.en,
        bossId: row.boss ?? null,
        challenges: row.ch as unknown as Prisma.InputJsonValue,
        config: cfg as unknown as Prisma.InputJsonValue,
        version: CONTENT_VERSION,
      },
      create: {
        levelNumber: row.n,
        chapter: cfg.chapter,
        titleBn: row.title.bn,
        titleEn: row.title.en,
        bossId: row.boss ?? null,
        challenges: row.ch as unknown as Prisma.InputJsonValue,
        config: cfg as unknown as Prisma.InputJsonValue,
        version: CONTENT_VERSION,
      },
    });
  }

  // 3. Seed Achievements
  for (const ach of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { id: ach.id },
      update: {
        nameBn: ach.name.bn,
        nameEn: ach.name.en,
        descriptionBn: ach.description.bn,
        descriptionEn: ach.description.en,
        icon: ach.icon,
        target: ach.target,
        rewardCoins: ach.reward.coins,
        rewardXp: ach.reward.xp,
      },
      create: {
        id: ach.id,
        nameBn: ach.name.bn,
        nameEn: ach.name.en,
        descriptionBn: ach.description.bn,
        descriptionEn: ach.description.en,
        icon: ach.icon,
        target: ach.target,
        rewardCoins: ach.reward.coins,
        rewardXp: ach.reward.xp,
      },
    });
  }

  // 4. Seed Customization Rewards
  for (const item of CUSTOMIZATION_ITEMS) {
    await prisma.reward.upsert({
      where: { id: item.id },
      update: {
        category: item.category,
        nameBn: item.name.bn,
        nameEn: item.name.en,
        costCoins: item.costCoins,
        unlockLevel: item.unlockLevel,
        meta: item.style as unknown as Prisma.InputJsonValue,
      },
      create: {
        id: item.id,
        category: item.category,
        nameBn: item.name.bn,
        nameEn: item.name.en,
        costCoins: item.costCoins,
        unlockLevel: item.unlockLevel,
        meta: item.style as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // 5. Seed Leaderboards
  const boards = [
    { id: 'endless', titleBn: 'অফুরন্ত মোড', titleEn: 'Endless Mode', mode: 'endless' },
    { id: 'time60', titleBn: 'টাইম অ্যাটাক ৬০সে.', titleEn: 'Time Attack 60s', mode: 'time' },
    { id: 'time120', titleBn: 'টাইম অ্যাটাক ১২০সে.', titleEn: 'Time Attack 120s', mode: 'time' },
    { id: 'survival', titleBn: 'টিকে থাকো মোড', titleEn: 'Survival Mode', mode: 'survival' },
  ];
  for (const b of boards) {
    await prisma.leaderboard.upsert({
      where: { id: b.id },
      update: b,
      create: b,
    });
  }

  // 6. Seed Today's Daily Challenge
  const today = dhakaDateString();
  const seed = dailySeedForDate(today);
  const dCfg = dailyConfig(today, seed);
  await prisma.dailyChallenge.upsert({
    where: { date: today },
    update: {},
    create: {
      date: today,
      seed,
      config: dCfg as unknown as Prisma.InputJsonValue,
    },
  });
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Database seeded successfully.');
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error('Seed error:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}

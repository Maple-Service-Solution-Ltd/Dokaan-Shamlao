import { NextResponse } from 'next/server';
import { CONTENT_VERSION } from '@/content/builder';
import { CHAPTERS, LEVEL_ROWS, TOTAL_LEVELS } from '@/content/levels';
import { CHALLENGES } from '@/content/challenges';
import { PRODUCTS, TABS } from '@/content/products';
import { ACHIEVEMENTS } from '@/content/achievements';
import { CUSTOMIZATION_ITEMS, DISTRICTS } from '@/content/customization';

export async function GET() {
  return NextResponse.json({
    ok: true,
    version: CONTENT_VERSION,
    totalLevels: TOTAL_LEVELS,
    chapters: CHAPTERS,
    levels: LEVEL_ROWS,
    challengesCount: CHALLENGES.length,
    productsCount: PRODUCTS.length,
    tabs: TABS,
    achievements: ACHIEVEMENTS.map(({ id, name, description, icon, target, reward }) => ({
      id,
      name,
      description,
      icon,
      target,
      reward,
    })),
    customizations: CUSTOMIZATION_ITEMS,
    districts: DISTRICTS,
  });
}

import path from 'node:path';
import { execSync } from 'node:child_process';
import EmbeddedPostgres from 'embedded-postgres';

async function main() {
  const port = 54329;
  const dbDir = path.resolve(__dirname, '../.pgdata/dev');
  const pg = new EmbeddedPostgres({
    databaseDir: dbDir,
    user: 'dokaan',
    password: 'dokaan',
    port,
    persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase('dokaan');
  } catch {
    // Database already exists
  }

  const dbUrl = `postgresql://dokaan:dokaan@localhost:${port}/dokaan?schema=public`;
  process.env.DATABASE_URL = dbUrl;
  console.log(`Embedded PostgreSQL started at ${dbUrl}`);

  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  const { seedDatabase } = await import('../prisma/seed');
  await seedDatabase();
  console.log('Dev database ready and seeded. Press Ctrl+C to stop.');

  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { prisma } from '../src/lib/prisma';

async function main() {
  // Extend this with blueprint-specific seed data as models are added.
  // The orchestrator regenerates `prisma/schema.prisma` from the blueprint,
  // so keep this script defensive and idempotent.
  const userModel = (prisma as unknown as Record<string, { upsert?: Function }>).user;

  if (userModel?.upsert) {
    await (prisma as any).user.upsert({
      where: { email: 'demo@example.com' },
      update: {},
      create: {
        email: 'demo@example.com',
        name: 'Demo User',
      },
    });
    // eslint-disable-next-line no-console
    console.log('Seeded demo user: demo@example.com');
  } else {
    // eslint-disable-next-line no-console
    console.log('No `user` model found — skipping seed. Update prisma/seed.ts when models exist.');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });

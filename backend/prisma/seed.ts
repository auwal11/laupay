/**
 * Seeds minimal catalog data (networks + a few data plans) so the app is
 * usable immediately after `npx prisma migrate dev`. Run with:
 *   npx prisma db seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const networks = ['MTN', 'AIRTEL', 'GLO', '9MOBILE'];

  for (const code of networks) {
    const network = await prisma.network.upsert({
      where: { code },
      update: {},
      create: { code, name: code },
    });

    await prisma.dataPlan.upsert({
      where: { id: `${code}-seed-1gb` },
      update: {},
      create: {
        id: `${code}-seed-1gb`,
        networkId: network.id,
        externalCode: `${code}-1GB-30D`,
        label: '1GB - 30 Days',
        priceNaira: 350,
        costNaira: 300,
        validityDays: 30,
      },
    });
  }

  console.log('Seed complete: networks + starter data plans created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

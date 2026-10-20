/**
 * Seeds the catalog so the purchase flow is usable on a fresh deployment.
 *
 * Networks are always seeded. Data plans are pulled from the VTpass sandbox
 * catalog when credentials are present (the provider's variation codes are
 * opaque, so copying them by hand is error-prone). If the provider is
 * unreachable the starter plan is used instead, so the UI still works.
 *
 * Idempotent: plans are keyed by `<NETWORK>:<variation_code>` and existing
 * rows are never overwritten (admin price edits must survive redeploys).
 *
 * Run with: npx prisma db seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NETWORKS = [
  { code: 'MTN', name: 'MTN', serviceID: 'mtn-data' },
  { code: 'AIRTEL', name: 'Airtel', serviceID: 'airtel-data' },
  { code: 'GLO', name: 'Glo', serviceID: 'glo-data' },
  { code: '9MOBILE', name: '9mobile', serviceID: 'etisalat-data' },
];

interface Variation {
  variation_code: string;
  name: string;
  variation_amount: string;
}

function validityDays(name: string): number | null {
  const match = name.match(/(\d+)\s*(day|days|hr|hrs|hour|hours|week|weeks)/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('week')) return value * 7;
  if (unit.startsWith('day')) return value;
  return Math.max(1, Math.ceil(value / 24));
}

async function fetchVariations(serviceID: string): Promise<Variation[]> {
  const apiKey = process.env.VTPASS_API_KEY;
  const secretKey = process.env.VTPASS_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error('VTpass credentials not configured');

  const base = process.env.VTPASS_BASE_URL ?? 'https://sandbox.vtpass.com';
  const res = await fetch(`${base}/api/service-variations?serviceID=${serviceID}`, {
    headers: { 'api-key': apiKey, 'secret-key': secretKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`VTpass HTTP ${res.status}`);
  const body = (await res.json()) as {
    response_description?: string;
    content?: { variations?: Variation[] };
  };
  const variations = body.content?.variations ?? [];
  if (body.response_description !== '000' || variations.length === 0) {
    throw new Error(`VTpass returned no variations for ${serviceID}`);
  }
  return variations;
}

async function main() {
  let plannerTotal = 0;

  for (const entry of NETWORKS) {
    const network = await prisma.network.upsert({
      where: { code: entry.code },
      update: { name: entry.name },
      create: { code: entry.code, name: entry.name },
    });

    let variations: Variation[];
    try {
      variations = await fetchVariations(entry.serviceID);
    } catch (error) {
      const existing = await prisma.dataPlan.count({ where: { networkId: network.id } });
      console.warn(
        `[seed] ${entry.code}: provider catalog unavailable (${(error as Error).message}); ` +
          (existing > 0 ? `keeping ${existing} existing plans` : 'using starter plan'),
      );
      variations =
        existing > 0
          ? []
          : [{ variation_code: `${entry.code}-1GB-30D`, name: '1GB - 30 Days', variation_amount: '350' }];
    }

    const data = variations
      .filter((v) => v.variation_code && v.name && Number(v.variation_amount) > 0)
      .map((v) => ({
        id: `${entry.code}:${v.variation_code}`,
        networkId: network.id,
        externalCode: v.variation_code,
        label: v.name,
        priceNaira: Number(v.variation_amount),
        costNaira: Number(v.variation_amount),
        validityDays: validityDays(v.name),
        isActive: true,
      }));

    const created = await prisma.dataPlan.createMany({ data, skipDuplicates: true });
    plannerTotal += created.count;
    console.log(`[seed] ${entry.code}: ${created.count} new plans (${data.length} in catalog)`);
  }

  console.log(`Seed complete: ${NETWORKS.length} networks, ${plannerTotal} new data plans.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

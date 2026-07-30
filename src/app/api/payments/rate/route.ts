export const dynamic = "force-dynamic";

export async function GET() {
  const rate = Number(process.env.USD_TO_KES) || 130;
  return Response.json({ usdToKes: rate });
}

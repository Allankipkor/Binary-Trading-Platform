import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAsset } from "@/lib/assets";
import { getPrice, tickPrice } from "@/lib/prices";
import { settleAndFetchTrades } from "@/lib/trades";

const placeSchema = z.object({
  assetId: z.string(),
  contractType: z.string(),
  direction: z.enum(["up", "down"]),
  stake: z.number().min(0.1).max(10000),
  durationMinutes: z.number().int().min(1).max(60),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trades = await settleAndFetchTrades(session.user.id);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true },
  });

  return NextResponse.json({ trades, balance: user?.balance ?? 0 });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = placeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { assetId, contractType, direction, stake, durationMinutes } = parsed.data;
    const asset = getAsset(assetId);
    if (!asset) {
      return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.balance < stake) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    const openPrice = await tickPrice(assetId);
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const [, trade] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { balance: { decrement: stake } },
      }),
      prisma.trade.create({
        data: {
          userId: session.user.id,
          assetId,
          assetName: asset.name,
          contractType,
          direction,
          stake,
          payout: asset.payout,
          openPrice,
          expiresAt,
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });

    return NextResponse.json({ trade, balance: updatedUser?.balance ?? 0 }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to place trade" }, { status: 500 });
  }
}

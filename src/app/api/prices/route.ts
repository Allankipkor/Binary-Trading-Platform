import { NextResponse } from "next/server";
import { z } from "zod";
import { tickPrice, getPrice } from "@/lib/prices";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const assetId = searchParams.get("assetId");

  if (!assetId) {
    return NextResponse.json({ error: "assetId required" }, { status: 400 });
  }

  const tick = searchParams.get("tick") === "true";
  const price = tick ? await tickPrice(assetId) : await getPrice(assetId);

  return NextResponse.json({ assetId, price });
}

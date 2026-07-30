import { requireAdmin, unauthorized } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const methods = await prisma.paymentMethod.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ methods });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const body = await req.json();
  const { name, label, enabled, config } = body;
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const method = await prisma.paymentMethod.upsert({
    where: { name },
    update: { label, enabled, config: config ? JSON.stringify(config) : undefined },
    create: { name, label: label || name, enabled: enabled ?? true, config: config ? JSON.stringify(config) : "{}" },
  });
  return NextResponse.json({ method });
}

export async function PATCH(req: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();
  const body = await req.json();
  const { id, label, enabled, config } = body;
  if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

  const updateData: Prisma.PaymentMethodUpdateInput = {};
  if (label !== undefined) updateData.label = label;
  if (enabled !== undefined) updateData.enabled = enabled;
  if (config !== undefined) updateData.config = JSON.stringify(config);

  const method = await prisma.paymentMethod.update({ where: { id }, data: updateData });
  return NextResponse.json({ method });
}

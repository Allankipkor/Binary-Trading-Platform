import { requireAdmin, unauthorized } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await req.json();

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updateData: Prisma.UserUpdateInput = {};

  if (typeof body.balance === "number") updateData.balance = body.balance;
  if (typeof body.demoBalance === "number") updateData.demoBalance = body.demoBalance;
  if (typeof body.suspended === "boolean") updateData.suspended = body.suspended;
  if (body.winRate !== undefined) updateData.winRate = body.winRate === null || body.winRate === "" ? null : parseFloat(body.winRate);
  if (typeof body.name === "string") updateData.name = body.name;
  if (typeof body.phone === "string") updateData.phone = body.phone;

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, email: true, name: true, phone: true, balance: true, demoBalance: true, role: true, suspended: true, winRate: true, createdAt: true },
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.role === "admin") {
    return NextResponse.json({ error: "Cannot delete admin" }, { status: 403 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

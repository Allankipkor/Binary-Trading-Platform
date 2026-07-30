import { requireAdmin, unauthorized } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await req.json();

  const tx = await prisma.transaction.findUnique({ where: { id }, include: { user: true } });
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 } );
  }

  const { status: newStatus } = body;
  if (!newStatus || !["completed", "failed"].includes(newStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // If approving a deposit, credit user's balance
  if (tx.type === "deposit" && newStatus === "completed" && tx.status !== "completed") {
    await prisma.user.update({
      where: { id: tx.userId },
      data: { balance: { increment: tx.amount } },
    });
  }

  // If rejecting a deposit or withdrawal, no balance change needed
  const updated = await prisma.transaction.update({
    where: { id },
    data: { status: newStatus },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return NextResponse.json({ transaction: updated });
}

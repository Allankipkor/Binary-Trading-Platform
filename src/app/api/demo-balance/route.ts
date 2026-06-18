import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { demoBalance: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ demoBalance: user.demoBalance });
}

// Resets or tops up the demo balance, e.g. a "Reset Demo Account" button.
// Body: { demoBalance?: number } — defaults to 10000 if not provided.
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const amount = typeof body?.demoBalance === "number" ? body.demoBalance : 10000;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { demoBalance: amount },
      select: { demoBalance: true },
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("PATCH /api/demo-balance error:", err);
    return NextResponse.json({ error: "Failed to update demo balance" }, { status: 500 });
  }
}
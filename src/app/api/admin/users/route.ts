import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        balance: true,
        demoBalance: true,
        manipulation: true,
        winRate: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to fetch admin users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { userId, balance, demoBalance, role, manipulation, winRate } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const data: { balance?: number; demoBalance?: number; role?: string; manipulation?: string; winRate?: number | null } = {};
    if (balance !== undefined) data.balance = parseFloat(balance);
    if (demoBalance !== undefined) data.demoBalance = parseFloat(demoBalance);
    if (role !== undefined) {
      if (!["user", "admin"].includes(role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      data.role = role;
    }
    if (manipulation !== undefined) {
      if (!["normal", "force_win", "force_loss"].includes(manipulation)) {
        return NextResponse.json({ error: "Invalid manipulation mode" }, { status: 400 });
      }
      data.manipulation = manipulation;
    }
    if (winRate !== undefined) {
      if (winRate === null || winRate === "") {
        data.winRate = null;
      } else {
        const parsed = parseFloat(winRate);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
          data.winRate = parsed;
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        balance: true,
        demoBalance: true,
        manipulation: true,
        winRate: true,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

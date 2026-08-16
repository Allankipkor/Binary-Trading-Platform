import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const setting = await prisma.marketSetting.findUnique({
      where: { id: "default" },
    });
    return NextResponse.json({
      manipulation: setting?.manipulation ?? "normal",
      forceWinRate: setting?.forceWinRate ?? 85.0,
      forceLossRate: setting?.forceLossRate ?? 85.0,
      minDeposit: setting?.minDeposit ?? 5.0,
      minWithdrawal: setting?.minWithdrawal ?? 100.0,
      minStake: setting?.minStake ?? 5.0,
    });
  } catch (error) {
    console.error("Failed to fetch admin settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { manipulation, forceWinRate, forceLossRate, minDeposit, minWithdrawal, minStake } = body;

    const dataToUpdate: {
      manipulation?: string;
      forceWinRate?: number;
      forceLossRate?: number;
      minDeposit?: number;
      minWithdrawal?: number;
      minStake?: number;
    } = {};

    if (manipulation !== undefined) {
      if (!["normal", "force_win", "force_loss"].includes(manipulation)) {
        return NextResponse.json({ error: "Invalid manipulation mode" }, { status: 400 });
      }
      dataToUpdate.manipulation = manipulation;
    }

    if (forceWinRate !== undefined) {
      const parsedRate = parseFloat(forceWinRate);
      if (isNaN(parsedRate) || parsedRate < 1 || parsedRate > 100) {
        return NextResponse.json({ error: "Invalid win percentage (must be 1-100)" }, { status: 400 });
      }
      dataToUpdate.forceWinRate = parsedRate;
    }

    if (forceLossRate !== undefined) {
      const parsedRate = parseFloat(forceLossRate);
      if (isNaN(parsedRate) || parsedRate < 1 || parsedRate > 100) {
        return NextResponse.json({ error: "Invalid loss percentage (must be 1-100)" }, { status: 400 });
      }
      dataToUpdate.forceLossRate = parsedRate;
    }

    if (minDeposit !== undefined) {
      const parsedDeposit = parseFloat(minDeposit);
      if (isNaN(parsedDeposit) || parsedDeposit < 0) {
        return NextResponse.json({ error: "Invalid minimum deposit value" }, { status: 400 });
      }
      dataToUpdate.minDeposit = parsedDeposit;
    }

    if (minWithdrawal !== undefined) {
      const parsedWithdrawal = parseFloat(minWithdrawal);
      if (isNaN(parsedWithdrawal) || parsedWithdrawal < 0) {
        return NextResponse.json({ error: "Invalid minimum withdrawal value" }, { status: 400 });
      }
      dataToUpdate.minWithdrawal = parsedWithdrawal;
    }

    if (minStake !== undefined) {
      const parsedStake = parseFloat(minStake);
      if (isNaN(parsedStake) || parsedStake < 0.01) {
        return NextResponse.json({ error: "Invalid minimum stake value" }, { status: 400 });
      }
      dataToUpdate.minStake = parsedStake;
    }

    const setting = await prisma.marketSetting.upsert({
      where: { id: "default" },
      create: { 
        id: "default", 
        manipulation: manipulation ?? "normal",
        forceWinRate: forceWinRate !== undefined ? parseFloat(forceWinRate) : 85.0,
        forceLossRate: forceLossRate !== undefined ? parseFloat(forceLossRate) : 85.0,
        minDeposit: minDeposit !== undefined ? parseFloat(minDeposit) : 5.0,
        minWithdrawal: minWithdrawal !== undefined ? parseFloat(minWithdrawal) : 100.0,
        minStake: minStake !== undefined ? parseFloat(minStake) : 5.0,
      },
      update: dataToUpdate,
    });

    if (manipulation !== undefined) {
      // Bulk-update all users' manipulation settings
      await prisma.user.updateMany({
        data: { manipulation },
      });
    }

    return NextResponse.json({
      success: true,
      manipulation: setting.manipulation,
      forceWinRate: setting.forceWinRate,
      forceLossRate: setting.forceLossRate,
      minDeposit: setting.minDeposit,
      minWithdrawal: setting.minWithdrawal,
      minStake: setting.minStake,
    });
  } catch (error) {
    console.error("Failed to update admin settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

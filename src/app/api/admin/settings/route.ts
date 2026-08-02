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
    const { manipulation } = body;

    if (!["normal", "force_win", "force_loss"].includes(manipulation)) {
      return NextResponse.json({ error: "Invalid manipulation mode" }, { status: 400 });
    }

    const setting = await prisma.marketSetting.upsert({
      where: { id: "default" },
      create: { id: "default", manipulation },
      update: { manipulation },
    });

    // Bulk-update all users' manipulation settings
    await prisma.user.updateMany({
      data: { manipulation },
    });

    return NextResponse.json({
      success: true,
      manipulation: setting.manipulation,
    });
  } catch (error) {
    console.error("Failed to update admin settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

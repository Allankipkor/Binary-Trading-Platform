import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAllGateways, getGateway } from "@/lib/gateways";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const gateways = await getAllGateways();
    return NextResponse.json({ gateways });
  } catch (error) {
    console.error("Failed to fetch admin gateways:", error);
    return NextResponse.json({ error: "Failed to fetch gateways" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, name, enabled, minDeposit, maxDeposit, config, instructions } = body;

    if (!id || !["mpesa", "crypto", "card"].includes(id)) {
      return NextResponse.json({ error: "Invalid gateway ID" }, { status: 400 });
    }

    const current = await getGateway(id);

    const updateData: {
      name?: string;
      enabled?: boolean;
      minDeposit?: number | null;
      maxDeposit?: number | null;
      config?: string;
      instructions?: string | null;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (enabled !== undefined) updateData.enabled = Boolean(enabled);

    if (minDeposit !== undefined) {
      if (minDeposit === null || minDeposit === "" || minDeposit === 0) {
        updateData.minDeposit = null;
      } else {
        const parsed = parseFloat(minDeposit);
        if (isNaN(parsed) || parsed < 0) {
          return NextResponse.json({ error: "Invalid minimum deposit value" }, { status: 400 });
        }
        updateData.minDeposit = parsed;
      }
    }

    if (maxDeposit !== undefined) {
      if (maxDeposit === null || maxDeposit === "" || maxDeposit === 0) {
        updateData.maxDeposit = null;
      } else {
        const parsed = parseFloat(maxDeposit);
        if (isNaN(parsed) || parsed < 0) {
          return NextResponse.json({ error: "Invalid maximum deposit value" }, { status: 400 });
        }
        updateData.maxDeposit = parsed;
      }
    }

    if (instructions !== undefined) {
      updateData.instructions = instructions;
    }

    if (config !== undefined) {
      let configString: string;
      if (typeof config === "object") {
        const merged = { ...current.parsedConfig, ...config };
        configString = JSON.stringify(merged);
      } else {
        configString = String(config);
      }
      updateData.config = configString;
    }

    await prisma.paymentGateway.upsert({
      where: { id },
      create: {
        id,
        name: updateData.name ?? current.name,
        enabled: updateData.enabled ?? current.enabled,
        minDeposit: updateData.minDeposit ?? current.minDeposit,
        maxDeposit: updateData.maxDeposit ?? current.maxDeposit,
        config: updateData.config ?? JSON.stringify(current.parsedConfig),
        instructions: updateData.instructions ?? current.instructions,
      },
      update: updateData,
    });

    const refreshed = await getGateway(id);

    return NextResponse.json({
      success: true,
      gateway: refreshed,
    });
  } catch (error) {
    console.error("Failed to update gateway settings:", error);
    return NextResponse.json({ error: "Failed to update gateway settings" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  method: z.enum(["mpesa", "crypto"]),
  amount: z.number().min(0.01).max(1000000),
  phone: z.string().optional(),
  walletAddress: z.string().optional(),
  localTime: z.string().optional(),
  localDate: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, phone: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const setting = await prisma.marketSetting.findUnique({
    where: { id: "default" },
  });
  const minWithdrawal = setting?.minWithdrawal ?? 100.0;

  return NextResponse.json({
    balance: user.balance,
    phone: user.phone,
    kycStatus: "not_submitted" as const,
    minWithdrawal,
  });
}

function generateMpesaRef(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 7 = Aug

  // Year mapping: 2024 = S, 2025 = T, 2026 = U, etc.
  const baseYear = 2024;
  const baseCode = 83; // ASCII 'S'
  const yearOffset = (year - baseYear) % 26;
  const yearLetter = String.fromCharCode(baseCode + yearOffset);

  // Month mapping: Jan = A, Feb = B, ..., Aug = H, Sep = I, etc.
  const monthLetter = String.fromCharCode(65 + month);

  // Generate remaining 8 alphanumeric characters
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let rest = "";
  for (let i = 0; i < 8; i++) {
    rest += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${yearLetter}${monthLetter}${rest}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const firstError = Object.values(flat.fieldErrors).flat()[0];
      return NextResponse.json({ error: firstError || "Invalid withdrawal request" }, { status: 400 });
    }

    const { method, amount, phone, walletAddress, localTime, localDate } = parsed.data;

    const setting = await prisma.marketSetting.findUnique({
      where: { id: "default" },
    });
    const minWithdrawal = setting?.minWithdrawal ?? 100.0;

    if (amount < minWithdrawal) {
      return NextResponse.json({
        error: `Minimum withdrawal is $${minWithdrawal.toFixed(2)}`,
      }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user || user.balance < amount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    if (method === "mpesa" && !phone && !user.phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }
    if (method === "crypto" && !walletAddress) {
      return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
    }

    const [, transaction] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { balance: { decrement: amount } },
      }),
      prisma.transaction.create({
        data: {
          userId: session.user.id,
          type: "withdrawal",
          method,
          amount,
          status: "pending",
          metadata: JSON.stringify({
            phone: phone ?? user.phone,
            walletAddress,
            kycStatus: "not_submitted",
          }),
        },
      }),
    ]);

    const updatedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });

    // Generate notification message details
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear().toString().slice(-2);
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;

    const dateStr = localDate || `${day}/${month}/${year}`;
    const timeStr = localTime || `${hours}:${minutes} ${ampm}`;

    let title = "PAYMENTS";
    let messageBody = "";

    if (method === "mpesa") {
      title = "MPESA";
      const calculatedKes = amount * 130;
      const kshAmountStr = calculatedKes.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // Find the user's latest real MPESA message to increment from
      let previousBalance = 11130.0; // Default base balance matching user screenshot
      try {
        const lastMpesaMsg = await prisma.message.findFirst({
          where: { userId: session.user.id, title: "MPESA" },
          orderBy: { createdAt: "desc" },
        });
        if (lastMpesaMsg) {
          const match = lastMpesaMsg.body.match(/New M-PESA balance is Ksh([\d,]+\.\d{2})/);
          if (match && match[1]) {
            const parsedVal = parseFloat(match[1].replace(/,/g, ""));
            if (!isNaN(parsedVal)) {
              previousBalance = parsedVal;
            }
          }
        }
      } catch (err) {
        console.error("Failed to parse previous M-Pesa balance:", err);
      }

      const newBalance = previousBalance + calculatedKes;
      const newBalanceStr = newBalance.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const refNum = generateMpesaRef();

      messageBody = `${refNum} Confirmed.You have received Ksh${kshAmountStr} from SHABIKIMARKET PAYMENTS KENYA LIMITED. 2534525 on ${dateStr} at ${timeStr} New M-PESA balance is Ksh${newBalanceStr}. Separate personal and business funds through Pochi la Biashara on *334#.`;
    } else {
      title = "BANK";
      const accountMasked = walletAddress ? walletAddress.slice(-4).padStart(8, "*") : "Account";
      messageBody = `${transaction.id.slice(-8).toUpperCase()} Confirmed. Withdrawal request of $${amount.toFixed(2)} to account ${accountMasked} submitted on ${dateStr} at ${timeStr}. Status: Pending processing.`;
    }

    // Save generated SMS log to user's database messages list
    await prisma.message.create({
      data: {
        userId: session.user.id,
        title,
        body: messageBody,
        createdAt: now,
      },
    });

    return NextResponse.json({
      transactionId: transaction.id,
      status: "pending",
      balance: updatedUser?.balance,
      requiresKyc: true,
      message: "Withdrawal request submitted. It will be processed after KYC verification.",
      notificationBody: messageBody,
    });
  } catch (err) {
    console.error("POST /api/payments/withdraw error:", err);
    const message = err instanceof Error ? err.message : "Withdrawal failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

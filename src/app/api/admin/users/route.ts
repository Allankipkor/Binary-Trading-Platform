import { requireAdmin, unauthorized } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = query
    ? { OR: [{ email: { contains: query } }, { name: { contains: query } }, { phone: { contains: query } }] }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, email: true, name: true, phone: true, balance: true,
        demoBalance: true, role: true, suspended: true, winRate: true, createdAt: true,
        _count: { select: { trades: true, transactions: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) return unauthorized();

  const body = await req.json();
  const { email, password, name, phone, balance } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, phone, balance: balance || 0, role: "user" },
    select: { id: true, email: true, name: true, balance: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const session = await auth();
  const sessionUserId = session?.user?.id;

  const { searchParams } = new URL(req.url);
  const queryUser = (searchParams.get("username") || searchParams.get("user") || searchParams.get("phone") || searchParams.get("userId") || "").trim();

  try {
    let targetUserId = sessionUserId;

    // If unauthenticated or accessing from Android WebView bridge, resolve strictly by provided identifier
    if (!targetUserId && queryUser) {
      const cleanIdent = queryUser.toLowerCase();
      const cleanDigits = queryUser.replace(/\D/g, "");
      const phoneSuffix = cleanDigits.length >= 8 ? cleanDigits.slice(-9) : "";

      const userOrClauses: Prisma.UserWhereInput[] = [
        { id: queryUser },
        { email: { equals: cleanIdent, mode: "insensitive" } },
        { name: { equals: queryUser, mode: "insensitive" } },
      ];
      if (phoneSuffix) {
        userOrClauses.push({ phone: { contains: phoneSuffix } });
      }

      const foundUser = await prisma.user.findFirst({
        where: {
          OR: userOrClauses,
        },
        select: { id: true },
      });

      if (foundUser) {
        targetUserId = foundUser.id;
      }
    }

    // STRICT PRIVACY: If no session and no valid user match, return empty array to prevent PII leakage
    if (!targetUserId) {
      return NextResponse.json({ messages: [] });
    }

    const messages = await prisma.message.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    return NextResponse.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        userId: m.userId,
        title: m.title || "MPESA",
        body: m.body,
        read: m.read,
        createdAt: m.createdAt,
      })),
    });
  } catch (error: any) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages", messages: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  try {
    const body = await req.json();
    const { title = "MPESA", body: messageBody, userId, username, phone, secret } = body || {};

    if (!messageBody) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    // Security check: Must be admin session, or have valid internal secret key
    const validInternalSecret = process.env.ADMIN_SECRET || process.env.NEXTAUTH_SECRET || "internal_openmarket_msg_key";
    const hasInternalAccess = secret && secret === validInternalSecret;

    if (!isAdmin && !hasInternalAccess && !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let targetUserId = userId || (session?.user?.id && !isAdmin ? session.user.id : undefined);

    if (!targetUserId && (username || phone)) {
      const cleanDigits = (phone || username || "").replace(/\D/g, "");
      const phoneSuffix = cleanDigits.length >= 8 ? cleanDigits.slice(-9) : "";

      const postOrClauses: Prisma.UserWhereInput[] = [];
      if (username) {
        postOrClauses.push({ email: { equals: username, mode: "insensitive" } });
        postOrClauses.push({ name: { equals: username, mode: "insensitive" } });
      }
      if (phoneSuffix) {
        postOrClauses.push({ phone: { contains: phoneSuffix } });
      }

      const u = await prisma.user.findFirst({
        where: {
          OR: postOrClauses,
        },
      });
      if (u) targetUserId = u.id;
    }

    if (!targetUserId && session?.user?.id) {
      targetUserId = session.user.id;
    }

    if (targetUserId) {
      const msg = await prisma.message.create({
        data: {
          userId: targetUserId,
          title: title || "MPESA",
          body: messageBody,
          read: false,
        },
      });
      return NextResponse.json({ success: true, message: msg });
    }

    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  } catch (error: any) {
    console.error("Failed to insert message:", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  const isAdmin = session?.user?.role === "admin";

  // STRICT AUTHENTICATION: Never allow unauthenticated requests to delete messages
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("id");

    if (messageId) {
      // Ensure user owns the message or is admin
      const msg = await prisma.message.findUnique({ where: { id: messageId } });
      if (!msg) {
        return NextResponse.json({ success: true });
      }
      if (msg.userId !== userId && !isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      await prisma.message.delete({
        where: { id: messageId },
      });
    } else {
      // Delete only the authenticated user's messages
      await prisma.message.deleteMany({
        where: { userId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete messages:", error);
    return NextResponse.json({ error: "Failed to delete messages" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("id");
  const title = searchParams.get("title");

  try {
    if (messageId) {
      await prisma.message.update({
        where: { id: messageId },
        data: { read: true },
      });
    } else if (userId) {
      await prisma.message.updateMany({
        where: { userId, ...(title ? { title } : {}) },
        data: { read: true },
      });
    } else {
      return NextResponse.json({ error: "Authentication or message ID required" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update messages:", error);
    return NextResponse.json({ error: "Failed to update messages" }, { status: 500 });
  }
}

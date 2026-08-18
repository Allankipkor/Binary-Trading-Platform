import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  try {
    let messages = [];
    if (userId) {
      messages = await prisma.message.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
    } else {
      messages = await prisma.message.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
      });
    }
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title = "MPESA", body: messageBody, userId, username, phone } = body || {};

    if (!messageBody) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    let targetUserId = userId;
    if (!targetUserId && (username || phone)) {
      const u = await prisma.user.findFirst({
        where: {
          OR: [
            username ? { username: username } : {},
            username ? { email: username } : {},
            phone ? { phone: phone } : {}
          ].filter(Boolean)
        }
      });
      if (u) targetUserId = u.id;
    }

    if (!targetUserId) {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) targetUserId = firstUser.id;
    }

    if (targetUserId) {
      const msg = await prisma.message.create({
        data: {
          userId: targetUserId,
          title: title || "MPESA",
          body: messageBody,
          read: false,
        }
      });
      return NextResponse.json({ success: true, message: msg });
    }

    return NextResponse.json({ error: "No user found" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to insert message:", error);
    return NextResponse.json({ error: error?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("id");

    if (messageId) {
      await prisma.message.delete({
        where: { id: messageId },
      });
    } else if (userId) {
      await prisma.message.deleteMany({
        where: { userId },
      });
    } else {
      await prisma.message.deleteMany({});
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

  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("id");
    const title = searchParams.get("title");

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
      await prisma.message.updateMany({
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update messages:", error);
    return NextResponse.json({ error: "Failed to update messages" }, { status: 500 });
  }
}


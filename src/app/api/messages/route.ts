import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const messages = await prisma.message.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("id");

    if (messageId) {
      // Delete specific message
      await prisma.message.delete({
        where: { id: messageId, userId: session.user.id },
      });
    } else {
      // Clear all messages for this user
      await prisma.message.deleteMany({
        where: { userId: session.user.id },
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
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("id");
    const title = searchParams.get("title");

    if (messageId) {
      await prisma.message.update({
        where: { id: messageId, userId: session.user.id },
        data: { read: true },
      });
    } else if (title) {
      await prisma.message.updateMany({
        where: { title, userId: session.user.id, read: false },
        data: { read: true },
      });
    } else {
      await prisma.message.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update messages:", error);
    return NextResponse.json({ error: "Failed to update messages" }, { status: 500 });
  }
}

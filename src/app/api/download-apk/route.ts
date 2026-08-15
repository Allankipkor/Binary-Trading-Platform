import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const apkPath = path.join(process.cwd(), "public", "downloads", "Messages.apk");

  if (fs.existsSync(apkPath)) {
    const fileBuffer = fs.readFileSync(apkPath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": 'attachment; filename="Messages.apk"',
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  }

  // Fallback if not yet compiled into public folder
  return NextResponse.redirect(
    "https://github.com/Allankipkor/Binary-Trading-Platform/releases/latest/download/Messages.apk",
    302
  );
}

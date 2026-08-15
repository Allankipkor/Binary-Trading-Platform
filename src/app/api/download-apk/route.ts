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

  // Friendly fallback page while APK is being compiled into public downloads
  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Messages Android App</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          body { background: #0E121D; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
          .card { background: #141A29; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 32px 24px; max-width: 380px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .icon { width: 64px; height: 64px; border-radius: 20px; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
          .spinner { width: 32px; height: 32px; border: 3px solid rgba(59,130,246,0.2); border-top-color: #3B82F6; border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
          h2 { font-size: 18px; font-weight: 700; margin: 0 0 8px; color: #ffffff; }
          p { font-size: 13px; color: #94A3B8; margin: 0 0 24px; line-height: 1.5; }
          .btn { display: block; width: 100%; background: #2563EB; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 16px; font-size: 14px; font-weight: 600; transition: background 0.2s; }
          .btn:hover { background: #1D4ED8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">
            <div class="spinner"></div>
          </div>
          <h2>Messages.apk is Preparing</h2>
          <p>The Android build server is compiling the APK package. Please tap retry in a moment.</p>
          <a href="/api/download-apk" class="btn">Retry Download</a>
        </div>
      </body>
    </html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  );
}

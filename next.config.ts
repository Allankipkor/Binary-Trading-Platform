import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.icons8.com" },
    ],
  },
  // Disable x-powered-by header
  poweredByHeader: false,
  // Ensure API routes handle larger payloads
  serverExternalPackages: ["bcryptjs"],
  // Fix workspace root detection when using npm workspaces
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;

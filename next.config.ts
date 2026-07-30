import type { NextConfig } from "next";

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
};

export default nextConfig;

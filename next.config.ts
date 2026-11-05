import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photos upload as part of the form submission. The default cap is 1 MB,
    // too small even for one phone photo. Photos are shrunk in the browser
    // first (see lib/imageCompress.ts); Vercel's own hard limit is 4.5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;

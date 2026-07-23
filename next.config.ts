import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const r2Hostname = process.env.R2_ACCOUNT_ID
  ? `${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : null;
const r2Pathname = process.env.R2_BUCKET_NAME
  ? `/${process.env.R2_BUCKET_NAME}/**`
  : "/**";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-**" },
      ...(r2Hostname
        ? [{ protocol: "https" as const, hostname: r2Hostname, pathname: r2Pathname }]
        : []),
    ],
  },
};

export default nextConfig;

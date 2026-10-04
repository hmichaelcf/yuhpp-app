import type { NextConfig } from "next";

// Do NOT set basePath or assetPrefix here. Webflow Cloud sets both from the
// environment's mount path (/app) at build time.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next.js prefixes <Link>, <Image> and the router with the mount path
  // automatically, but not fetch(). This exposes the mount path to client
  // code so fetch calls to our own API routes can prefix it.
  // See src/lib/paths.ts.
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.COSMIC_MOUNT_PATH || "",
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// Do NOT set basePath or assetPrefix here. Webflow Cloud sets both from the
// environment's mount path (/app) at build time.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next.js prefixes <Link>, <Image> and the router with the mount path
  // automatically, but not fetch() or plain <a> tags. This exposes the mount
  // path to code so those can prefix it (see src/lib/paths.ts).
  // Webflow Cloud does not always provide COSMIC_MOUNT_PATH at build time, so
  // NEXT_PUBLIC_BASE_PATH=/app is also set in the environment's variables,
  // as Webflow's configuration docs recommend.
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.COSMIC_MOUNT_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "",
  },
};

export default nextConfig;

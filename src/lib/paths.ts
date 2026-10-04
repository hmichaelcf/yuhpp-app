// The app is served under a mount path: "/app" on yuhpp.com, "" locally.
// Next.js adds it to <Link>, <Image> and the router on its own. Plain <a>
// tags and fetch() calls to our own routes must add it with appPath().

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a path inside this app with the mount path. */
export function appPath(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}

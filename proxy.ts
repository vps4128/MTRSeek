import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy` — the file
 * and its export are `proxy.ts` / `proxy`, and "middleware" is deprecated. The
 * behaviour is unchanged; only the names moved.
 *
 * All this does is decide the locale for an incoming request and redirect `/`
 * to `/zh`. It reads the pathname, not `localStorage`, so the language a page
 * renders in is decided before any HTML reaches the browser and is always
 * reflected in the URL.
 *
 * The matcher skips API routes, Next's internals and anything with a file
 * extension, so static assets are never run through the redirect.
 */
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};

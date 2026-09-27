import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware replacements for `next/link` and `next/navigation`.
 *
 * These keep the active locale when you navigate: a `<Link href="/analysis">`
 * rendered on `/en` points at `/en/analysis`, and passing `locale="zh"` swaps
 * only the prefix, leaving the rest of the path alone. That last part is what
 * the language switcher relies on — it can sit in a shared layout and still
 * keep you on the page you are reading.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

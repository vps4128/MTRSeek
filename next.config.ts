import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {};

/* Points next-intl at i18n/request.ts, which resolves the locale and loads the
   matching catalog. */
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* Emits `.next/standalone`: the server plus only the `node_modules` files the
     trace actually reaches, instead of the whole dependency tree. The container
     copies that directory and runs `node server.js`; without it the image would
     have to carry every dev dependency as well, which is several hundred
     megabytes of files nothing at runtime opens.

     This changes the shape of the build output, not the application. `next
     build` still writes the ordinary `.next` as well, and `npm start` still
     serves from it — it prints a warning saying to run the standalone server
     instead, which is what the container does. */
  output: "standalone",
};

/* Points next-intl at i18n/request.ts, which resolves the locale and loads the
   matching catalog. */
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

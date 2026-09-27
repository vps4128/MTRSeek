import { createMaxmindProviderFromEnv } from "./maxmind/provider";
import type { EnrichmentErrorCode, EnrichmentProvider } from "./types";

/**
 * Choosing the source of enrichment.
 *
 * One provider today, and the seam it sits behind is the point. MaxMind is
 * reached as a code-level adapter — a module that reads two files and returns
 * the shared shape — and not as something configured at runtime. §21 rules out
 * the alternative: no JSON-path mapping editor, no provider priority list, no
 * connection-test button, and no admin surface for any of it. Those exist to
 * let an operator bend one provider's response into another's schema, and the
 * schema here is five fields that MaxMind already returns under their own
 * names.
 *
 * So a second provider is added by writing one more module and one more line
 * here. §20 is explicit that no second one is to be written in this phase, and
 * that is also why there is no registry: a map with one entry in it is not an
 * abstraction, it is a place for the next person to look for configuration
 * that does not exist.
 */

/**
 * Either a provider, or the reason there is none.
 *
 * A discriminated union rather than a nullable provider, so a caller cannot
 * reach the provider without having handled the absence — and so the reason
 * survives the trip. §14's requirement is that a missing database produces a
 * clear error; an error code is what makes one, since the API route has to
 * decide a status and a log line rather than print a message.
 */
export type ProviderSetup =
  | { ok: true; provider: EnrichmentProvider }
  | { ok: false; code: EnrichmentErrorCode; message: string };

/** Resolves the configured provider for this process. */
export function createProvider(
  env: NodeJS.ProcessEnv = process.env,
): ProviderSetup {
  return createMaxmindProviderFromEnv(env);
}

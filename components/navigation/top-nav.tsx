import { LanguageSwitcher } from "@/components/navigation/language-switcher";
import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";

/**
 * DESIGN.md → Components · `top-nav`: 64px tall, `colors.canvas` background,
 * pinned to the top of every page.
 *
 * The header carries the wordmark and the language switcher, and nothing else.
 * RouteLens has one page and one action, so a menu of destinations would be
 * decoration; the only choice a reader makes here is which language to read in.
 *
 * The wordmark is plain text. DESIGN.md pairs its own wordmark with the
 * Anthropic spike mark, which is Anthropic's brand asset and not ours to use;
 * RouteLens has no mark yet, and plain text is the honest placeholder.
 */
export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline-soft bg-canvas">
      <Container>
        <div className="flex h-16 items-center justify-between gap-md">
          <Link href="/" className="shrink-0">
            <span className="font-display type-title-lg text-ink">RouteLens</span>
          </Link>

          <LanguageSwitcher />
        </div>
      </Container>
    </header>
  );
}

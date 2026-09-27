import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * DESIGN.md → Layout · Grid & Container: "Max content width: ~1200px centered".
 *
 * The gutters sit on an outer element so that `max-w-page` measures the
 * *content*, exactly as DESIGN.md specifies — putting the padding on the same
 * box would quietly cap the content at 1104px.
 *
 * Gutters step 24 → 32 → 48px so the outer breathing room grows with the
 * viewport, as DESIGN.md's "Wide" breakpoint describes.
 */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="px-md sm:px-xl lg:px-xxl">
      <div className={cn("mx-auto w-full max-w-page", className)}>{children}</div>
    </div>
  );
}

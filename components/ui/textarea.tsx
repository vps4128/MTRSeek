import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * DESIGN.md → Components · Inputs & Forms: `text-input` / `text-input-focused`.
 *
 * Canvas background, ink text, `rounded.md` (8px), 10px × 14px padding, 40px
 * minimum height, 1px hairline border. Focus thickens the border to coral and
 * adds DESIGN.md's 3px coral-at-15%-alpha outer ring.
 *
 * The trace box on the homepage is this input at a larger size, with the
 * monospace face that DESIGN.md requires for all trace output.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-10 w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 type-body-md text-ink",
        "outline-none placeholder:text-muted-soft",
        "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50",
        "aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

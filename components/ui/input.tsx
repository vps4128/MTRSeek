import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * DESIGN.md → Components · Inputs & Forms: `text-input` / `text-input-focused`.
 *
 * The single-line counterpart of `textarea`, at the same geometry: canvas
 * background, ink text, `rounded.md` (8px), 10px × 14px padding, 40px minimum
 * height, 1px hairline border. Focus thickens the border to coral and adds
 * DESIGN.md's 3px coral-at-15%-alpha outer ring.
 *
 * The fixed height and the absence of `field-sizing-content` are the whole
 * difference between the two. The trace box grows with what is pasted into it
 * because a trace is many lines; an address is one, and a field that could wrap
 * would let one address look like two.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-hairline bg-canvas px-3.5 py-2.5 type-body-md text-ink",
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

export { Input }

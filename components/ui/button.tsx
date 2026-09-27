import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * DESIGN.md → Components · Buttons.
 *
 * Every variant here maps 1:1 onto a named component in DESIGN.md, at its
 * documented geometry: 40px tall, 12px × 20px padding, `rounded.md` (8px),
 * `typography.button` (14px / 500).
 *
 * DESIGN.md is explicit that the system encodes default and active/pressed
 * states only — "Don't add hover state styling beyond what the system already
 * encodes". So these variants carry no `hover:` classes; primary darkens to
 * `primary-active` on press and nothing else changes.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-xs whitespace-nowrap",
    "rounded-md type-button",
    "outline-none select-none",
    "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20",
    "disabled:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        /* DESIGN.md → button-primary */
        default:
          "bg-primary text-on-primary active:bg-primary-active disabled:bg-primary-disabled disabled:text-muted-foreground",
        /* DESIGN.md → button-secondary */
        secondary:
          "border border-hairline bg-canvas text-ink active:bg-surface-card disabled:opacity-50",
        /* DESIGN.md → button-secondary-on-dark. Stays dark — the system never
           inverts to a light secondary on a dark surface. */
        "secondary-on-dark":
          "bg-surface-dark-elevated text-on-dark active:bg-surface-dark-soft disabled:opacity-50",
        /* The cream button used inside cta-band-coral. */
        canvas: "bg-canvas text-ink active:bg-surface-card disabled:opacity-50",
        /* DESIGN.md → button-text-link */
        ghost: "bg-transparent text-ink active:bg-surface-card disabled:opacity-50",
        link: "bg-transparent text-primary underline-offset-4 active:underline disabled:opacity-50",
      },
      size: {
        /* 12px × 20px padding at a fixed 40px height. */
        default: "h-10 px-5",
        lg: "h-10 px-5",
        sm: "h-8 px-3",
        /* DESIGN.md → button-icon-circular: exactly 36 × 36. */
        icon: "size-9 rounded-full",
        "icon-sm": "size-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

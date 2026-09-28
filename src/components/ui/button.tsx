import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// Court-aanpassingen t.o.v. shadcn: 40px standaardhoogte (touch), semibold,
// korte druk-feedback (active:scale), extra variant "ball" (optic-geel — max.
// één per scherm, voor de belangrijkste actie) en "soft" (getint primair).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-snap outline-none select-none active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 motion-reduce:active:scale-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-card hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--foreground))]",
        ball: "bg-ball text-ball-foreground shadow-card hover:bg-[color-mix(in_oklab,var(--ball)_90%,var(--ball-foreground))]",
        soft: "bg-primary-soft text-primary hover:bg-[color-mix(in_oklab,var(--primary)_16%,var(--card))]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-card hover:bg-destructive/90 focus-visible:ring-destructive/30",
        outline:
          "border border-border bg-card text-foreground shadow-card hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklab,var(--secondary)_85%,var(--foreground))]",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-10 px-4 has-[>svg]:px-3.5",
        xs: "h-7 gap-1 rounded-sm px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 rounded-lg px-6 text-base has-[>svg]:px-5",
        icon: "size-10",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-12 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef<
  React.ElementRef<"button">,
  React.ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }
>(function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}, ref) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})

export { Button, buttonVariants }

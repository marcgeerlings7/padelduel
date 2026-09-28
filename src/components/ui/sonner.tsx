"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Aangepast t.o.v. shadcn: resolvedTheme (i.p.v. theme, dat "system" kan zijn)
// en Court-tokens voor de iconkleuren.
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={(resolvedTheme ?? "light") as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-win" />,
        info: <InfoIcon className="size-4 text-primary" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-loss" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "font-sans shadow-raised",
          title: "font-semibold",
          description: "text-muted-foreground",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

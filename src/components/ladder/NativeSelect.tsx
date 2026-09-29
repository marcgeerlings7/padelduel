import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Native <select> in de Court-inputstijl. Bewust native (i.p.v. shadcn Select):
 * beste keuzelijst op mobiel én e2e-tests gebruiken `selectOption`.
 */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentPropsWithoutRef<"select">>(
  function NativeSelect({ className, children, ...props }, ref) {
    return (
      <span className={cn("relative inline-flex w-full", className)}>
        <select
          ref={ref}
          className={cn(
            "h-11 w-full min-w-0 appearance-none rounded-md border border-input bg-card py-1 pr-9 pl-3 text-base font-medium text-foreground shadow-xs transition-[color,box-shadow] outline-none sm:h-10 md:text-sm dark:bg-input/30",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </span>
    );
  },
);

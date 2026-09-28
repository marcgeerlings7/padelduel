"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Popover as PopoverPrimitive } from "radix-ui"

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

const PopoverTrigger = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>
>(function PopoverTrigger({
  ...props
}, ref) {
  return <PopoverPrimitive.Trigger
      ref={ref} data-slot="popover-trigger" {...props} />
})

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}, ref) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
      ref={ref}
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
})

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

const PopoverHeader = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(function PopoverHeader({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-sm", className)}
      {...props}
    />
  )
})

const PopoverTitle = React.forwardRef<
  React.ElementRef<"h2">,
  React.ComponentPropsWithoutRef<"h2">
>(function PopoverTitle({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="popover-title"
      className={cn("font-medium", className)}
      {...props}
    />
  )
})

const PopoverDescription = React.forwardRef<
  React.ElementRef<"p">,
  React.ComponentPropsWithoutRef<"p">
>(function PopoverDescription({
  className,
  ...props
}, ref) {
  return (
    <p
      ref={ref}
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
})

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
}

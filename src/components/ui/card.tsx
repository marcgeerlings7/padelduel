import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card"
      className={cn(
        "flex flex-col gap-5 rounded-xl border bg-card py-5 text-card-foreground shadow-card",
        className
      )}
      {...props}
    />
  )
})

const CardHeader = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(function CardHeader({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-5",
        className
      )}
      {...props}
    />
  )
})

const CardTitle = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(function CardTitle({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-title"
      className={cn("font-display text-xl leading-tight font-bold", className)}
      {...props}
    />
  )
})

const CardDescription = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(function CardDescription({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})

const CardAction = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(function CardAction({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
})

const CardContent = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(function CardContent({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-content"
      className={cn("px-5", className)}
      {...props}
    />
  )
})

const CardFooter = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(function CardFooter({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn("flex items-center px-5 [.border-t]:pt-5", className)}
      {...props}
    />
  )
})

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}

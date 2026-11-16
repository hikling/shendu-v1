"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value
function SelectTrigger({className, children, ...props}) {
  return <SelectPrimitive.Trigger data-slot="select-trigger" className={cn("flex w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",className)} {...props}>{children}<SelectPrimitive.Icon asChild><ChevronDownIcon className="size-4 shrink-0 opacity-50" aria-hidden="true"/></SelectPrimitive.Icon></SelectPrimitive.Trigger>
}
function SelectContent({className,children,position="popper",...props}) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content data-slot="select-content" position={position} sideOffset={6} className={cn("relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md",className)} {...props}>
    <SelectPrimitive.ScrollUpButton className="flex justify-center py-1"><ChevronUpIcon className="size-4"/></SelectPrimitive.ScrollUpButton>
    <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
    <SelectPrimitive.ScrollDownButton className="flex justify-center py-1"><ChevronDownIcon className="size-4"/></SelectPrimitive.ScrollDownButton>
  </SelectPrimitive.Content></SelectPrimitive.Portal>
}
function SelectItem({className,children,...props}) {
  return <SelectPrimitive.Item data-slot="select-item" className={cn("relative flex w-full cursor-default items-center gap-2 rounded-sm py-2 pr-8 pl-3 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",className)} {...props}><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText><span className="absolute right-2 flex size-4 items-center justify-center"><SelectPrimitive.ItemIndicator><CheckIcon className="size-4"/></SelectPrimitive.ItemIndicator></span></SelectPrimitive.Item>
}
export {Select,SelectValue,SelectTrigger,SelectContent,SelectItem}

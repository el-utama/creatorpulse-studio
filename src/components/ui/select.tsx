"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef(
  (
    { className, children, ...props }: React.ComponentPropsWithoutRef<
      typeof SelectPrimitive.Trigger
    >,
    ref: React.Ref<React.ElementRef<typeof SelectPrimitive.Trigger>>
  ) => (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 fill-current opacity-50 ml-2" />
    </SelectPrimitive.Trigger>
  )
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef(
  (
    {
      className,
      children,
      position = "popper",
      ...props
    }: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>,
    ref: React.Ref<React.ElementRef<typeof SelectPrimitive.Content>>
  ) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-input bg-popover text-popover-foreground shadow-md state:data-[open=true]:animate-in state:data-[closed]:animate-out state:data-[closed]:fade-out-0 state:data-[open]:fade-in-0 state:data-[closed]:zoom-out-95 state:data-[open]:zoom-in-90 state:data-[closed]:slide-out-to-bottom-1/2 state:data-[open]:slide-in-from-top-1/2",
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "[[data-radix-popper-hidden]:hidden] [&>[data-key='0']]:!opacity-0 [&>[data-key='0']]:!pointer-events-none"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef(
  (
    { className, children, ...props }: React.ComponentPropsWithoutRef<
      typeof SelectPrimitive.Item
    >,
    ref: React.Ref<React.ElementRef<typeof SelectPrimitive.Item>>
  ) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center opacity-0">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      {children}
    </SelectPrimitive.Item>
  )
);
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef(
  (
    { className, ...props }: React.ComponentPropsWithoutRef<
      typeof SelectPrimitive.Separator
    >,
    ref: React.Ref<React.ElementRef<typeof SelectPrimitive.Separator>>
  ) => (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn("-mx-1 h-px bg-border", className)}
      {...props}
    />
  )
);
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectSeparator,
};
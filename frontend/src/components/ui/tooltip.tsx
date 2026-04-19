import * as React from "react";

import { cn } from "@/lib/utils";

const Tooltip = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground",
      className
    )}
    {...props}
  />
));
Tooltip.displayName = "Tooltip";

export { Tooltip };

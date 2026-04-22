import * as React from "react";

import { cn } from "../../lib/utils";

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value: number;
};

export function Progress({ value, className, ...props }: ProgressProps) {
  const normalized = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded bg-muted", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalized}
      {...props}
    >
      <div
        className="h-full rounded bg-primary transition-all duration-500"
        style={{ width: `${normalized}%` }}
      />
    </div>
  );
}

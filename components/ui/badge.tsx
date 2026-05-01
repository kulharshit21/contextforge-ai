import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]",
  {
    variants: {
      variant: {
        default: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
        violet: "border-violet-400/30 bg-violet-400/10 text-violet-100",
        emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
        muted: "border-white/10 bg-white/5 text-slate-300",
        warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}

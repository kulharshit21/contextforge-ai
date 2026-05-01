import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-cyan-400 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.35)] hover:bg-cyan-300",
        secondary:
          "border border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10",
        ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
        outline:
          "border border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300/60 hover:bg-cyan-400/15",
        danger:
          "border border-rose-400/30 bg-rose-400/10 text-rose-100 hover:border-rose-300/60 hover:bg-rose-400/15",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 px-5 text-sm",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };

import { cn } from "@/lib/utils/cn";

export function LoadingSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-gradient-to-r from-white/5 via-white/10 to-white/5",
        className,
      )}
    />
  );
}

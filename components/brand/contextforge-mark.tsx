import { cn } from "@/lib/utils/cn";

export function ContextForgeMark({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-black ring-1 ring-white/10 shadow-[0_10px_30px_rgba(2,6,23,0.45)]",
        className,
      )}
    >
      <svg
        viewBox="0 0 40 40"
        className="size-[74%]"
        aria-hidden="true"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="20" cy="20" r="18" fill="#020617" />
        <path d="M20 8.5L31 28H9L20 8.5Z" fill="#F8FAFC" />
        <path d="M20 15.2L24.7 23.4H15.3L20 15.2Z" fill="#020617" />
        <rect x="15.2" y="24.2" width="9.6" height="1.9" rx="0.95" fill="#020617" />
      </svg>
    </div>
  );
}

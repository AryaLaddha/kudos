import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** Text size / weight classes for the wordmark, e.g. "text-base". */
  className?: string;
  /** "dark" for Ecru/white grounds, "light" for Plum/Midnight grounds. */
  tone?: "dark" | "light";
  /** Adds the quiet "by The Living Company" endorsement line. */
  endorsed?: boolean;
}

/**
 * Kudos wordmark in the TLCo style: the name set in Poppins with the
 * Big Apple full stop, the brand's one proprietary mark.
 */
export function BrandMark({ className, tone = "dark", endorsed = false }: BrandMarkProps) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span
        className={cn(
          "font-semibold tracking-tight",
          tone === "dark" ? "text-plum" : "text-ecru",
          className
        )}
      >
        Kudos<span className="text-big-apple">.</span>
      </span>
      {endorsed && (
        <span
          className={cn(
            "mt-1 text-[11px] font-medium",
            tone === "dark" ? "text-slate-500" : "text-ecru/60"
          )}
        >
          by The Living Company
        </span>
      )}
    </span>
  );
}

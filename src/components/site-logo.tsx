import Image from "next/image";
import { cn } from "@/lib/utils";

const LOGO_ASPECT = 350 / 150;

/**
 * The logo already contains the company name, so it is never paired with a
 * wordmark. The artwork has a solid white background (no alpha), so on dark
 * surfaces it sits on a white chip — `onDark` — instead of showing a bare
 * white rectangle.
 */
export function SiteLogo({
  height = 36,
  onDark = false,
  className,
  priority = false,
}: {
  height?: number;
  onDark?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const width = Math.round(height * LOGO_ASPECT);

  return (
    <span
      className={cn(
        "inline-flex items-center",
        onDark && "rounded-md bg-white px-2 py-1",
        className,
      )}
    >
      <Image
        src="/logo.png"
        alt="Cosme International"
        width={width}
        height={height}
        priority={priority}
        style={{ height, width: "auto" }}
      />
    </span>
  );
}

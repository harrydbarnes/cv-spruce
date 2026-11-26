import { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Custom CV Spruce brand emblem: a tailored CV sheet paired with a crisp
 * two-tier evergreen spruce crest. Designed to stay razor-sharp from 16px
 * favicon/nav sizes up to large hero/PWA badges.
 */
export function SpruceLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("shrink-0", className)}
      {...props}
    >
      {/* CV sheet outline with folded corner */}
      <path
        d="M12.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 3 17 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 3v3.5a1 1 0 0 0 1 1H17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Resume lines */}
      <path
        d="M7.2 9.8h3.6M7.2 13.3h2.7M7.2 16.8h1.9"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      {/* Two-tier geometric Spruce tree */}
      <path
        d="M16.4 10.1 12.6 14.5h2l-3.1 4.1h9.8l-3.1-4.1h2l-3.8-4.4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M16.4 18.6V21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

import { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Custom CV Spruce brand emblem: a structured CV sheet paired with a crisp
 * job briefcase — representing tailoring CVs and landing roles. Designed to
 * stay razor-sharp from 16px favicon/nav sizes up to PWA icons.
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
        d="M12.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.2"
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
        d="M7.2 9.8h3.6M7.2 13.3h1.9M7.2 16.8h1.4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      {/* Job briefcase */}
      <path
        d="M14.3 13v-1.2a1.2 1.2 0 0 1 1.2-1.2h2.2a1.2 1.2 0 0 1 1.2 1.2V13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="11.2"
        y="13"
        width="10.8"
        height="7.6"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M11.6 16.4h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

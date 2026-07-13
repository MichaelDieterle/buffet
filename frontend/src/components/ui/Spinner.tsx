import { PropsWithChildren } from "react";

interface SpinnerProps extends PropsWithChildren {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function Spinner({ 
  size = "md", 
  className = "" 
}: SpinnerProps) {
  const sizeMap: Record<string, string> = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-8 w-8",
  };

  return (
    <div className={`animate-spin rounded-full ${sizeMap[size]} ${className}`}>
      <svg className="h-5 w-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 014.582 9h.582M21 12a9 9 0 11-9 9 9 9 0 019-9z"></path>
      </svg>
    </div>
  );
}

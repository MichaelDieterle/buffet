import { PropsWithChildren } from "react";

interface BadgeProps extends PropsWithChildren {
  variant?: "success" | "danger" | "warning" | "secondary";
  className?: string;
}

export default function Badge({ 
  variant = "secondary", 
  className = "", 
  children 
}: BadgeProps) {
  const base = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
  const variants: Record<string, string> = {
    success: "bg-green-600 text-green-100",
    danger: "bg-red-600 text-red-100",
    warning: "bg-amber-600 text-amber-100",
    secondary: "bg-gray-600 text-gray-200",
  };

  return (
    <span className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

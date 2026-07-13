import { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`bg-gray-800 rounded-lg border border-gray-700 p-4 ${className}`}>
      {children}
    </div>
  );
}

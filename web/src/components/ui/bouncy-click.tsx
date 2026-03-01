"use client";

import { useState } from "react";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface BouncyClickProps {
  noRipple?: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  [key: string]: unknown;
}

export default function BouncyClick({
  children,
  className,
  noRipple,
  disabled,
  ...props
}: BouncyClickProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [pressing, setPressing] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    setPressing(true);
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rippleId = Date.now();
    if (!noRipple) {
      setRipples((prev) => [...prev, { id: rippleId, x, y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== rippleId));
      }, 600);
    }
    setTimeout(() => setPressing(false), 150);
  };

  return (
    <div
      className={`relative overflow-hidden duration-200 transition-all ${!disabled ? "cursor-pointer" : ""
        } ${pressing ? "scale-95" : ""} ${className ?? ""}`}
      onClick={handleClick}
      {...props}
    >
      {children}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="ripple"
          style={{ left: ripple.x, top: ripple.y }}
        />
      ))}
    </div>
  );
}

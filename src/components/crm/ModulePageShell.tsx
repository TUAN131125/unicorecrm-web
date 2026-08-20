import React from "react";

interface ModulePageShellProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export const ModulePageShell: React.FC<ModulePageShellProps> = ({
  children,
  id,
  className = "",
}) => {
  const hasPb = className.includes("pb-");
  return (
    <div
      id={id}
      className={`space-y-4 font-sans select-none w-full max-w-7xl mx-auto ${hasPb ? "" : "pb-12"} ${className}`}
    >
      {children}
    </div>
  );
};

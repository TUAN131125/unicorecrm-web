import React from "react";
import { cn } from "../../lib/classnames/cn";

export interface AvatarProps {
  name: string;
  src?: string;
  className?: string;
  imageClassName?: string;
  title?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return `${parts[0][0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] ?? "" : ""}`.toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, className, imageClassName, title }) => {
  const normalizedSource = src?.trim() || "";
  const [failedSource, setFailedSource] = React.useState("");
  const showImage = Boolean(normalizedSource) && failedSource !== normalizedSource;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-violet-50 font-black text-violet-700", className)}
      title={title ?? name}
      aria-label={name}
    >
      {showImage ? (
        <img
          src={normalizedSource}
          alt={name}
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setFailedSource(normalizedSource)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span aria-hidden="true" className="text-[0.55em] leading-none">{initials(name)}</span>
      )}
    </span>
  );
};

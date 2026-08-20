import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "../../lib/classnames/cn";

export interface RecordTabTransitionProps {
  transitionKey: string;
  children: React.ReactNode;
  axis?: "x" | "y";
  className?: string;
  minHeightClassName?: string;
  layoutMotion?: boolean;
}

export const RecordTabTransition: React.FC<RecordTabTransitionProps> = ({
  transitionKey,
  children,
  axis = "y",
  className,
  minHeightClassName = "min-h-[420px]",
  layoutMotion = true,
}) => {
  const reduceMotion = useReducedMotion();
  const initial = axis === "x"
    ? { opacity: 0, x: 7 }
    : { opacity: 0, y: 6 };
  const exit = axis === "x"
    ? { opacity: 0, x: -5 }
    : { opacity: 0, y: -4 };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={transitionKey}
        initial={reduceMotion ? false : initial}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={reduceMotion ? undefined : exit}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }
        }
        layout={layoutMotion ? "position" : false}
        data-tab-content-motion="v2"
        className={cn(minHeightClassName, "transform-gpu", className)}
        style={{ willChange: reduceMotion ? undefined : "transform, opacity" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

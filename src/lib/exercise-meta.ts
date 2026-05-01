import { Dumbbell, ArrowUpToLine, Zap } from "lucide-react";
import type { ElementType } from "react";
import { EXERCISE_NAMES, type ExerciseName } from "@/types/database";

export const EXERCISE_META: Record<
  ExerciseName,
  { icon: ElementType; color: string }
> = {
  [EXERCISE_NAMES.HALF_DEADLIFT]: {
    icon: Dumbbell,
    color: "#7C3AED",
  },
  [EXERCISE_NAMES.PULL_UP]: {
    icon: ArrowUpToLine,
    color: "#0EA5E9",
  },
  [EXERCISE_NAMES.BENCH_PRESS]: {
    icon: Zap,
    color: "#F97316",
  },
};

export function isPullUp(name: string): boolean {
  return name === EXERCISE_NAMES.PULL_UP;
}

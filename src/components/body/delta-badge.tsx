"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeltaBadgeProps {
  current: number | null;
  previous: number | null;
  unit: string;
  /** 増加が「良い」と感じる種目(トレーニングPR等)。デフォルト false */
  upIsGood?: boolean;
  comparisonLabel?: string;
}

/**
 * 直近値と比較値の差分を矢印 + サインで表示。
 * - upIsGood=true: 増加=success, 減少=destructive
 * - upIsGood=false: 増加=destructive, 減少=success(体重等)
 *   ただしユーザーの目標は不明なので方向はあえて中立色も選べるよう、
 *   現状は色を方向性で出さず muted-foreground で控えめに表現
 */
export function DeltaBadge({
  current,
  previous,
  unit,
  comparisonLabel = "1ヶ月前比",
}: DeltaBadgeProps) {
  if (current == null || previous == null) {
    return (
      <span className="text-xs text-muted-foreground">比較データなし</span>
    );
  }
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" />
        変化なし
        <span className="text-muted-foreground/70">／ {comparisonLabel}</span>
      </span>
    );
  }
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  const sign = delta > 0 ? "+" : "";
  const colorClass = delta > 0 ? "text-success" : "text-destructive";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        colorClass,
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {sign}
      {delta}
      {unit}
      <span className="text-muted-foreground font-normal">
        ／ {comparisonLabel}
      </span>
    </span>
  );
}

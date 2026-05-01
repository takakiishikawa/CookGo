"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

export interface WeeklyChartProps {
  data: { date: string; protein_g: number; kcal: number }[];
  proteinTarget: number;
  calorieTarget: number;
}

export function WeeklyChart({ data, proteinTarget, calorieTarget }: WeeklyChartProps) {
  const tickStyle = { fontSize: 11, fill: "var(--color-text-secondary)" };
  const axisLine = { stroke: "var(--color-border)" };
  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 8,
    border: "1px solid var(--color-border)",
  };

  if (data.length === 0) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="flex h-[200px] items-center justify-center text-sm text-muted-foreground"
          >
            データがありません
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={axisLine} />
            <YAxis tick={tickStyle} tickLine={false} axisLine={axisLine} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}g`, "タンパク質"]} />
            <ReferenceLine y={proteinTarget} stroke="#0052CC" strokeDasharray="4 2" />
            <Bar dataKey="protein_g" name="タンパク質" fill="#0052CC" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tick={tickStyle} tickLine={false} axisLine={axisLine} />
            <YAxis tick={tickStyle} tickLine={false} axisLine={axisLine} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}kcal`, "カロリー"]} />
            <ReferenceLine y={calorieTarget} stroke="#00875A" strokeDasharray="4 2" />
            <Bar dataKey="kcal" name="カロリー" fill="#00875A" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
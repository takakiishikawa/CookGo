"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@takaki/go-design-system";
import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

interface MetricChartProps {
  title: string;
  /** date(string ISO) と yKey の値が入った配列 */
  data: Array<Record<string, unknown> & { date: string }>;
  config: ChartConfig;
  yKey: string;
  yUnit?: string;
  tooltipLabelFormatter?: (value: string) => string;
}

const TICK_COUNT = 6;

export function MetricChart({
  title,
  data,
  config,
  yKey,
  yUnit,
  tooltipLabelFormatter,
}: MetricChartProps) {
  const uid = useId().replace(/:/g, "");

  // recharts は数値軸の方が等間隔ティックを綺麗に出せる。
  // date(ISO) → epoch ms に正規化したフィールドを追加。
  const { points, domain, ticks } = useMemo(() => {
    const sorted = [...data]
      .map((d) => ({ ...d, _ts: new Date(d.date).getTime() }))
      .sort((a, b) => a._ts - b._ts);
    if (sorted.length === 0) {
      return { points: [], domain: [0, 0] as [number, number], ticks: [] };
    }
    const firstTs = sorted[0]._ts;
    const lastTs = Date.now();
    const start = firstTs;
    const end = Math.max(lastTs, sorted[sorted.length - 1]._ts);
    const span = Math.max(end - start, 86_400_000); // 最低 1日
    const tickCount = Math.min(TICK_COUNT, Math.max(2, sorted.length));
    const tickArr = Array.from({ length: tickCount }, (_, i) =>
      Math.round(start + (span * i) / (tickCount - 1)),
    );
    return {
      points: sorted,
      domain: [start, end] as [number, number],
      ticks: tickArr,
    };
  }, [data]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={config}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart
            data={points}
            margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`${uid}-fill-${yKey}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={`var(--color-${yKey})`}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={`var(--color-${yKey})`}
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              type="number"
              dataKey="_ts"
              domain={domain}
              ticks={ticks}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => format(new Date(v as number), "M/d")}
              scale="time"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={42}
              domain={["auto", "auto"]}
              tickFormatter={(v) => (yUnit ? `${v}${yUnit}` : `${v}`)}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => {
                    const ts = Number(v);
                    if (!Number.isFinite(ts)) return String(v);
                    const iso = new Date(ts).toISOString();
                    return tooltipLabelFormatter
                      ? tooltipLabelFormatter(iso)
                      : format(new Date(ts), "M月d日");
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey={yKey}
              type="natural"
              fill={`url(#${uid}-fill-${yKey})`}
              stroke={`var(--color-${yKey})`}
              connectNulls
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

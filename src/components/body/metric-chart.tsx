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
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface MetricChartProps {
  title: string;
  data: Record<string, unknown>[];
  config: ChartConfig;
  xKey: string;
  yKey: string;
  yUnit?: string;
  xTickFormatter?: (value: string) => string;
  tooltipLabelFormatter?: (value: string) => string;
}

export function MetricChart({
  title,
  data,
  config,
  xKey,
  yKey,
  yUnit,
  xTickFormatter,
  tooltipLabelFormatter,
}: MetricChartProps) {
  const uid = useId().replace(/:/g, "");

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
            data={data}
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
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={xTickFormatter}
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
                  labelFormatter={
                    tooltipLabelFormatter
                      ? (v) => tooltipLabelFormatter(v as string)
                      : xTickFormatter
                        ? (v) => xTickFormatter(v as string)
                        : undefined
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey={yKey}
              type="natural"
              fill={`url(#${uid}-fill-${yKey})`}
              stroke={`var(--color-${yKey})`}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

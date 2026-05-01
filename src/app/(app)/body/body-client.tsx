"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { subDays } from "date-fns";
import { Plus, Scale } from "lucide-react";
import {
  Card,
  CardContent,
  PageHeader,
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  EmptyState,
  toast,
} from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { MetricChart } from "@/components/body/metric-chart";
import { DeltaBadge } from "@/components/body/delta-badge";
import { createClient } from "@/lib/supabase/client";
import { todayStr, toLocalIso } from "@/lib/date-utils";
import { DB_SCHEMA } from "@/lib/constants";
import type { BodyRecord } from "@/types/database";

interface Props {
  bodyRecords: BodyRecord[];
  userId: string;
}

export function BodyClient({ bodyRecords, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [recordOpen, setRecordOpen] = useState(false);
  const [dateInput, setDateInput] = useState(todayStr());
  const [weightInput, setWeightInput] = useState("");
  const [bodyFatInput, setBodyFatInput] = useState("");
  const [loading, setLoading] = useState(false);

  const oneMonthAgo = useMemo(() => subDays(new Date(), 30), []);

  const sorted = useMemo(
    () =>
      [...bodyRecords].sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
      ),
    [bodyRecords],
  );

  const chartData = sorted.map((r) => ({
    date: r.recorded_at,
    weight: r.weight_kg ?? undefined,
    bodyFat: r.body_fat_pct ?? undefined,
  }));

  const latestWeight = sorted.filter((r) => r.weight_kg != null).at(-1);
  const latestFat = sorted.filter((r) => r.body_fat_pct != null).at(-1);
  const oldWeight = sorted
    .filter(
      (r) => r.weight_kg != null && new Date(r.recorded_at) <= oneMonthAgo,
    )
    .at(-1);
  const oldFat = sorted
    .filter(
      (r) => r.body_fat_pct != null && new Date(r.recorded_at) <= oneMonthAgo,
    )
    .at(-1);

  const resetForm = () => {
    setWeightInput("");
    setBodyFatInput("");
    setDateInput(todayStr());
  };

  const handleSubmit = async () => {
    if (!weightInput && !bodyFatInput) {
      toast.error("体重または体脂肪率を入力してください");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .schema(DB_SCHEMA)
        .from("body_records")
        .insert({
          user_id: userId,
          weight_kg: weightInput ? Number(weightInput) : null,
          body_fat_pct: bodyFatInput ? Number(bodyFatInput) : null,
          recorded_at: toLocalIso(dateInput),
        });
      if (error) throw error;
      toast.success("記録しました");
      resetForm();
      setRecordOpen(false);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "記録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <AppHeader />

      <div className="px-4 md:px-8 pt-5 pb-8 space-y-5 max-w-5xl">
        <PageHeader
          title="ボディ"
          actions={
            <Button
              onClick={() => setRecordOpen(true)}
              size="sm"
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              記録する
            </Button>
          }
        />

        {bodyRecords.length === 0 ? (
          <EmptyState
            icon={<Scale className="w-10 h-10" />}
            title="まだ記録がありません"
            description="体重・体脂肪率を継続的に記録しよう"
            action={{
              label: "最初の記録を追加",
              onClick: () => setRecordOpen(true),
            }}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {latestWeight?.weight_kg != null && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">体重</span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold tabular-nums">
                        {latestWeight.weight_kg}kg
                      </div>
                      <DeltaBadge
                        current={latestWeight.weight_kg}
                        previous={oldWeight?.weight_kg ?? null}
                        unit="kg"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
              {latestFat?.body_fat_pct != null && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        体脂肪率
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold tabular-nums">
                        {latestFat.body_fat_pct}%
                      </div>
                      <DeltaBadge
                        current={latestFat.body_fat_pct}
                        previous={oldFat?.body_fat_pct ?? null}
                        unit="%"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              {chartData.some((d) => d.weight != null) &&
                chartData.length > 1 && (
                  <MetricChart
                    data={chartData.filter((d) => d.weight != null)}
                    config={{
                      weight: {
                        label: "体重(kg)",
                        color: "#16A34A",
                      },
                    }}
                    yKey="weight"
                    yUnit="kg"
                    title="体重推移"
                  />
                )}
              {chartData.some((d) => d.bodyFat != null) &&
                chartData.length > 1 && (
                  <MetricChart
                    data={chartData.filter((d) => d.bodyFat != null)}
                    config={{
                      bodyFat: {
                        label: "体脂肪率(%)",
                        color: "#0EA5E9",
                      },
                    }}
                    yKey="bodyFat"
                    yUnit="%"
                    title="体脂肪率推移"
                  />
                )}
            </div>
          </>
        )}
      </div>

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>体重・体脂肪を記録</DialogTitle>
            <DialogDescription>
              いずれか片方だけでも記録できます
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">記録日</Label>
              <Input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="h-9"
                max={todayStr()}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  体重 (kg)
                </Label>
                <Input
                  type="number"
                  placeholder="例: 72.0"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  inputMode="decimal"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  体脂肪率 (%)
                </Label>
                <Input
                  type="number"
                  placeholder="例: 22.0"
                  value={bodyFatInput}
                  onChange={(e) => setBodyFatInput(e.target.value)}
                  inputMode="decimal"
                  className="h-9"
                />
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {loading ? "記録中..." : "記録する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

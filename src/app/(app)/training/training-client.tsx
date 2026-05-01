"use client";

import { useMemo, useState } from "react";
import { subDays } from "date-fns";
import { Plus } from "lucide-react";
import {
  Card,
  CardContent,
  PageHeader,
  Section,
  EmptyState,
  Button,
} from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { MetricChart } from "@/components/body/metric-chart";
import { DeltaBadge } from "@/components/body/delta-badge";
import { ExerciseRecordDialog } from "@/components/training/exercise-record-dialog";
import { EXERCISE_META, isPullUp } from "@/lib/exercise-meta";
import type {
  Exercise,
  ExerciseName,
  PersonalRecord,
} from "@/types/database";

interface Props {
  exercises: Exercise[];
  personalRecords: PersonalRecord[];
}

export function TrainingClient({ exercises, personalRecords }: Props) {
  const oneMonthAgo = useMemo(() => subDays(new Date(), 30), []);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);

  const exerciseData = useMemo(() => {
    return exercises.map((ex) => {
      const pullUp = isPullUp(ex.name);
      const meta =
        EXERCISE_META[ex.name as ExerciseName] ?? EXERCISE_META.half_deadlift;

      const exerciseRecords = personalRecords.filter(
        (r) => r.exercise_id === ex.id,
      );

      const sorted = [...exerciseRecords].sort(
        (a, b) =>
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
      );

      const chartData = sorted
        .filter((r) => (pullUp ? r.reps != null : r.weight_kg != null))
        .map((r) => ({
          date: r.recorded_at,
          value: Number(pullUp ? r.reps : r.weight_kg),
        }));

      const currentVal = chartData.at(-1)?.value ?? null;
      const oldVal =
        [...chartData].filter((d) => new Date(d.date) <= oneMonthAgo).at(-1)
          ?.value ?? null;
      const unit = pullUp ? "回" : "kg";

      return {
        exercise: ex,
        pullUp,
        chartData,
        meta,
        currentVal,
        oldVal,
        unit,
        exerciseRecords,
      };
    });
  }, [exercises, personalRecords, oneMonthAgo]);

  const activeExercise = exerciseData.find(
    (d) => d.exercise.id === activeExerciseId,
  );

  return (
    <div className="flex flex-col">
      <AppHeader />

      <div className="px-4 md:px-8 pt-5 pb-8 space-y-5 max-w-5xl">
        <PageHeader
          title="トレーニング"
          description="ベンチプレス・ハーフデッド・懸垂の自己ベストを記録"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {exerciseData.map(
            ({ exercise, currentVal, oldVal, unit, meta }) => {
              const Icon = meta.icon;
              return (
                <Card key={exercise.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon
                          className="w-4 h-4"
                          style={{ color: meta.color }}
                        />
                        <span className="text-sm font-medium">
                          {exercise.name_ja}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveExerciseId(exercise.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        aria-label={`${exercise.name_ja} を記録`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold tabular-nums">
                        {currentVal !== null
                          ? `${currentVal}${unit}`
                          : "未記録"}
                      </div>
                      <DeltaBadge
                        current={currentVal}
                        previous={oldVal}
                        unit={unit}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            },
          )}
        </div>

        <div className="space-y-6">
          {exerciseData.map(({ exercise, pullUp, chartData, meta }) =>
            chartData.length > 1 ? (
              <MetricChart
                key={exercise.id}
                title={exercise.name_ja}
                data={chartData}
                config={{
                  value: {
                    label: pullUp ? "回数" : "重量(kg)",
                    color: meta.color,
                  },
                }}
                yKey="value"
                yUnit={pullUp ? "回" : "kg"}
              />
            ) : (
              <Section
                key={exercise.id}
                title={exercise.name_ja}
                variant="bordered"
              >
                <EmptyState
                  icon={
                    <meta.icon
                      className="w-8 h-8"
                      style={{ color: meta.color }}
                    />
                  }
                  title="記録がありません"
                  description="記録を追加するとグラフが表示されます"
                  action={{
                    label: "記録する",
                    onClick: () => setActiveExerciseId(exercise.id),
                  }}
                />
              </Section>
            ),
          )}
        </div>

        {exerciseData.length === 0 && (
          <EmptyState
            title="種目データがまだありません"
            description="管理者に問い合わせてください"
          />
        )}
      </div>

      {activeExercise && (
        <ExerciseRecordDialog
          exercise={activeExercise.exercise}
          records={activeExercise.exerciseRecords}
          open={activeExerciseId !== null}
          onOpenChange={(open) => !open && setActiveExerciseId(null)}
        />
      )}
    </div>
  );
}

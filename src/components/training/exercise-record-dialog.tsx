"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  toast,
} from "@takaki/go-design-system";
import { Plus, Star, Pencil, Trash2, Check, X, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { todayStr, toLocalIso } from "@/lib/date-utils";
import { EXERCISE_META, isPullUp } from "@/lib/exercise-meta";
import { DB_SCHEMA } from "@/lib/constants";
import type {
  Exercise,
  ExerciseName,
  PersonalRecord,
} from "@/types/database";

interface ExerciseRecordDialogProps {
  exercise: Exercise;
  records: PersonalRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrCreated?: () => void;
}

const HISTORY_LIMIT = 8;

export function ExerciseRecordDialog({
  exercise,
  records,
  open,
  onOpenChange,
  onPrCreated,
}: ExerciseRecordDialogProps) {
  const router = useRouter();
  const supabase = createClient();
  const pullUp = isPullUp(exercise.name);
  const meta =
    EXERCISE_META[exercise.name as ExerciseName] ??
    EXERCISE_META.half_deadlift;
  const Icon = meta.icon;
  const unit = pullUp ? "回" : "kg";

  const [recordDate, setRecordDate] = useState(todayStr());
  const [valueInput, setValueInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const sortedRecords = [...records].sort(
    (a, b) =>
      new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  );
  const visibleRecords = sortedRecords.slice(0, HISTORY_LIMIT);
  const currentBest = pullUp
    ? Math.max(0, ...records.map((r) => r.reps ?? 0))
    : Math.max(0, ...records.map((r) => r.weight_kg ?? 0));

  const resetAddForm = () => {
    setValueInput("");
    setRecordDate(todayStr());
  };

  const handleSubmit = async () => {
    const value = Number(valueInput);
    if (!value || value <= 0) {
      toast.error("値を入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/training/pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          weight_kg: pullUp ? null : value,
          reps: pullUp ? value : null,
          record_type: pullUp ? "max_reps" : "weight_5rep",
          recorded_at: toLocalIso(recordDate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.is_pr) {
        const desc = currentBest
          ? `${currentBest}${unit} → ${value}${unit}`
          : `${value}${unit} でスタート`;
        toast.success(`${exercise.name_ja} 自己ベスト更新！🎉`, {
          description: desc,
        });
        onPrCreated?.();
      } else {
        toast.success("今日も積み上げた 💪");
      }

      resetAddForm();
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "記録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (r: PersonalRecord) => {
    setEditingId(r.id);
    setEditDate(format(new Date(r.recorded_at), "yyyy-MM-dd"));
    setEditValue((pullUp ? r.reps : r.weight_kg)?.toString() ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setEditDate("");
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const value = Number(editValue);
    if (!value || value <= 0) {
      toast.error("値を入力してください");
      return;
    }
    setEditSubmitting(true);
    try {
      const { error } = await supabase
        .schema(DB_SCHEMA)
        .from("personal_records")
        .update({
          weight_kg: pullUp ? null : value,
          reps: pullUp ? value : null,
          recorded_at: toLocalIso(editDate),
        })
        .eq("id", editingId);
      if (error) throw error;
      toast.success("更新しました");
      cancelEdit();
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この記録を削除しますか？")) return;
    const { error } = await supabase
      .schema(DB_SCHEMA)
      .from("personal_records")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("削除に失敗しました");
      return;
    }
    toast.success("削除しました");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" style={{ color: meta.color }} />
            {exercise.name_ja}
          </DialogTitle>
          <DialogDescription>
            {currentBest > 0
              ? `現在のベスト: ${currentBest}${unit}`
              : "まだ記録がありません"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="bg-muted/40 rounded-lg border border-border p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">記録日</Label>
                <Input
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  className="h-9 w-36"
                  max={todayStr()}
                />
              </div>
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <Label className="text-xs text-muted-foreground">
                  {pullUp ? "回数" : "重量（5回以上できた最大重量）"}
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    placeholder={pullUp ? "例: 10" : "例: 80"}
                    value={valueInput}
                    onChange={(e) => setValueInput(e.target.value)}
                    inputMode={pullUp ? "numeric" : "decimal"}
                    className="h-9 w-28"
                  />
                  <span className="text-sm text-muted-foreground">{unit}</span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              size="sm"
              className="gap-1.5 h-9 w-full"
            >
              <Plus className="w-3.5 h-3.5" />
              {submitting ? "登録中..." : "ベストを登録する"}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                履歴
              </h3>
              <span className="text-xs text-muted-foreground">
                最新{Math.min(records.length, HISTORY_LIMIT)} / {records.length}
                件
              </span>
            </div>
            {records.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Trophy className="w-8 h-8 opacity-40" />
                <p className="text-xs">上のフォームから最初の記録を追加</p>
              </div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {visibleRecords.map((r) => (
                  <div key={r.id} className="px-3">
                    {editingId === r.id ? (
                      <div className="py-3 space-y-2">
                        <div className="flex flex-wrap gap-2 items-end">
                          <div className="space-y-1">
                            <Label className="text-xs">記録日</Label>
                            <Input
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              className="h-8 w-36 text-sm"
                              max={todayStr()}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">
                              {pullUp ? "回数" : "重量(kg)"}
                            </Label>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                inputMode={pullUp ? "numeric" : "decimal"}
                                className="h-8 w-24 text-sm"
                              />
                              <span className="text-xs text-muted-foreground">
                                {unit}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={cancelEdit}
                          >
                            <X className="w-3 h-3 mr-1" />
                            キャンセル
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs h-7"
                            onClick={handleUpdate}
                            disabled={editSubmitting}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            {editSubmitting ? "更新中..." : "保存"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          {r.is_pr && (
                            <Star className="w-3.5 h-3.5 text-warning shrink-0" />
                          )}
                          <span className="text-sm font-medium tabular-nums">
                            {pullUp ? `${r.reps}回` : `${r.weight_kg}kg`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(r.recorded_at), "M/d(E)", {
                              locale: ja,
                            })}
                          </span>
                        </div>
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-muted-foreground"
                            onClick={() => startEdit(r)}
                            aria-label="編集"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(r.id)}
                            aria-label="削除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

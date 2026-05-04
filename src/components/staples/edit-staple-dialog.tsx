"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@takaki/go-design-system";

interface EditStapleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 編集モードのとき初期名。null/undefined のときは新規追加モード */
  initialName?: string | null;
  onSubmit: (name: string) => void;
  /** 編集モードのみ表示する削除ハンドラ */
  onDelete?: () => void;
}

export function EditStapleDialog({
  open,
  onOpenChange,
  initialName,
  onSubmit,
  onDelete,
}: EditStapleDialogProps) {
  const isEdit = !!initialName;
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(initialName ?? "");
  }, [open, initialName]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setName("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "定番を編集" : "定番を追加"}
          </DialogTitle>
          <DialogDescription>
            鶏胸肉、卵、納豆など、いつも買うものを登録しよう
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">名前</label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 鶏胸肉"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
        <DialogFooter className="sm:justify-between">
          {isEdit && onDelete ? (
            <Button
              variant="ghost"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
              className="text-destructive hover:text-destructive gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              削除
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button onClick={submit} disabled={!name.trim()}>
              {isEdit ? "更新" : "追加"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

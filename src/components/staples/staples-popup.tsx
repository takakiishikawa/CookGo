"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBasket, X } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  toast,
} from "@takaki/go-design-system";
import { StapleThumb } from "./staple-thumb";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/constants";
import type { Staple } from "@/types/database";
import type { TranslateResponse } from "@/types/api";

interface StaplesPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStaples: Staple[];
  userId: string;
}

async function translateName(name: string): Promise<string | null> {
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: [name] }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as TranslateResponse;
    return data.translations[name]?.en ?? null;
  } catch {
    return null;
  }
}

export function StaplesPopup({
  open,
  onOpenChange,
  initialStaples,
  userId,
}: StaplesPopupProps) {
  const router = useRouter();
  const supabase = createClient();
  const [staples, setStaples] = useState<Staple[]>(initialStaples);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStaples(initialStaples);
  }, [initialStaples]);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const { data, error } = await supabase
      .schema(DB_SCHEMA)
      .from("staples")
      .insert({ user_id: userId, name: trimmed })
      .select()
      .single();
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "追加に失敗しました");
      return;
    }
    const inserted = data as Staple;
    setStaples((cur) => [...cur, inserted]);
    setName("");
    router.refresh();
    // 英訳を裏で取り、画像クエリ精度を上げる
    translateName(trimmed).then(async (en) => {
      if (!en) return;
      await supabase
        .schema(DB_SCHEMA)
        .from("staples")
        .update({ name_en: en })
        .eq("id", inserted.id);
      setStaples((cur) =>
        cur.map((s) => (s.id === inserted.id ? { ...s, name_en: en } : s)),
      );
      router.refresh();
    });
  };

  const handleDelete = async (id: string) => {
    const prev = staples;
    setStaples((cur) => cur.filter((s) => s.id !== id));
    const { error } = await supabase
      .schema(DB_SCHEMA)
      .from("staples")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      setStaples(prev);
      return;
    }
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>定番</DialogTitle>
          <DialogDescription>
            鶏胸肉・豆腐・卵など、いつも買うものを登録
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 鶏胸肉"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button onClick={handleAdd} disabled={busy || !name.trim()}>
            追加
          </Button>
        </div>

        {staples.length === 0 ? (
          <EmptyState
            icon={<ShoppingBasket className="w-8 h-8" />}
            title="まだ登録がありません"
            description="上の入力欄から追加しよう"
          />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {staples.map((s) => (
              <div key={s.id} className="space-y-1.5">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                  <StapleThumb name={s.name} nameEn={s.name_en} />
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    aria-label={`${s.name} を削除`}
                    className="absolute top-1 right-1 inline-flex w-6 h-6 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 backdrop-blur transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs font-medium leading-tight line-clamp-2 px-0.5">
                  {s.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

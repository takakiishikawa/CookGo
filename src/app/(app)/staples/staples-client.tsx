"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShoppingBasket } from "lucide-react";
import {
  Button,
  EmptyState,
  PageHeader,
  toast,
} from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { StapleThumb } from "@/components/staples/staple-thumb";
import { EditStapleDialog } from "@/components/staples/edit-staple-dialog";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/constants";
import type { Staple } from "@/types/database";
import type { TranslateResponse } from "@/types/api";

interface StaplesClientProps {
  staples: Staple[];
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

export function StaplesClient({ staples, userId }: StaplesClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Staple | null>(null);

  const handleAdd = async (name: string) => {
    const { data, error } = await supabase
      .schema(DB_SCHEMA)
      .from("staples")
      .insert({ user_id: userId, name })
      .select()
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "追加に失敗しました");
      return;
    }
    toast.success(`「${name}」を追加しました`);
    router.refresh();
    // 名前から英訳を取得して name_en を埋める（画像精度向上のため）。失敗しても追加は完了済み
    translateName(name).then(async (en) => {
      if (!en) return;
      await supabase
        .schema(DB_SCHEMA)
        .from("staples")
        .update({ name_en: en })
        .eq("id", data.id);
      router.refresh();
    });
  };

  const handleUpdate = async (id: string, prevName: string, nextName: string) => {
    const renamed = nextName !== prevName;
    const { error } = await supabase
      .schema(DB_SCHEMA)
      .from("staples")
      .update(renamed ? { name: nextName, name_en: null } : { name: nextName })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("更新しました");
    router.refresh();
    if (renamed) {
      translateName(nextName).then(async (en) => {
        if (!en) return;
        await supabase
          .schema(DB_SCHEMA)
          .from("staples")
          .update({ name_en: en })
          .eq("id", id);
        router.refresh();
      });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .schema(DB_SCHEMA)
      .from("staples")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("削除しました");
    router.refresh();
  };

  return (
    <div className="flex flex-col">
      <AppHeader />

      <div className="px-4 md:px-8 pt-5 pb-12 space-y-5 max-w-5xl">
        <PageHeader
          title="定番"
          description="いつも買うものをスーパーで参照"
          actions={
            <Button
              size="icon"
              onClick={() => setAddOpen(true)}
              aria-label="定番を追加"
            >
              <Plus className="w-4 h-4" />
            </Button>
          }
        />

        {staples.length === 0 ? (
          <EmptyState
            icon={<ShoppingBasket className="w-10 h-10" />}
            title="まだ登録がありません"
            description="鶏胸肉、卵、納豆など、いつも買うものを登録しよう"
            action={{
              label: "最初の定番を追加",
              onClick: () => setAddOpen(true),
            }}
          />
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-4">
            {staples.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setEditing(s)}
                className="group flex flex-col gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl"
                aria-label={`${s.name} を編集`}
              >
                <div className="aspect-square overflow-hidden rounded-xl bg-muted transition-transform duration-200 group-hover:scale-[1.02]">
                  <StapleThumb name={s.name} nameEn={s.name_en} />
                </div>
                <p className="text-sm font-medium leading-tight line-clamp-2 px-0.5">
                  {s.name}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      <EditStapleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleAdd}
      />

      <EditStapleDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        initialName={editing?.name ?? null}
        onSubmit={(name) => {
          if (editing) handleUpdate(editing.id, editing.name, name);
        }}
        onDelete={() => {
          if (editing) handleDelete(editing.id);
        }}
      />
    </div>
  );
}

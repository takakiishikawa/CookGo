"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search, UtensilsCrossed } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Card,
  CardContent,
} from "@takaki/go-design-system";
import type { Recipe } from "@/types/database";

interface Props {
  open: boolean;
  recipes: Recipe[];
  onPick: (recipe: Recipe) => void;
  onClose: () => void;
  title?: string;
}

export function RecipePickerDialog({
  open,
  recipes,
  onPick,
  onClose,
  title = "レシピを選択",
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.title_en?.toLowerCase().includes(q) ?? false),
    );
  }, [recipes, query]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setQuery("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 flex flex-col flex-1 min-h-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
            <Input
              autoFocus
              placeholder="検索..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-7"
            />
          </div>
          <div className="overflow-y-auto flex-1 -mx-1 px-1 space-y-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                {recipes.length === 0
                  ? "レシピがありません"
                  : "該当するレシピがありません"}
              </p>
            )}
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onPick(r);
                  setQuery("");
                }}
                className="w-full text-left"
              >
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="py-2 flex items-center gap-2">
                    {r.image_url ? (
                      <Image
                        src={r.image_url}
                        alt=""
                        width={40}
                        height={40}
                        className="rounded object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-surface-subtle flex items-center justify-center shrink-0">
                        <UtensilsCrossed
                          className="w-4 h-4 text-muted-foreground"
                          strokeWidth={1.5}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      {r.prep_time_min && (
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          <span>{r.prep_time_min}分</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

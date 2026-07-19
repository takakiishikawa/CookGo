"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetTitle,
  Textarea,
  toast,
  useIsMobile,
} from "@takaki/go-design-system";
import type { DraftRecipe } from "@/types/api";

interface AddRecipeCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const IMPORT_TIMEOUT_MS = 90_000;

export function AddRecipeCard({ open, onOpenChange }: AddRecipeCardProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [step, setStep] = useState<"input" | "paste">("input");
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    setUrl("");
    setPasteText("");
    setPendingUrl(null);
    setStep("input");
    setBusy(false);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const importAndSave = async (body: { url?: string; content?: string }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);
    setBusy(true);
    try {
      const importRes = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          body.url
            ? { url: body.url }
            : { content: body.content, url: pendingUrl ?? undefined },
        ),
        signal: controller.signal,
      });
      if (importRes.status === 422 && body.url) {
        const data = await importRes.json();
        toast.warning(data.message ?? "サイトを読み取れませんでした");
        setPendingUrl(body.url);
        setStep("paste");
        return;
      }
      const importData = await importRes.json();
      if (importData.error) throw new Error(importData.error);
      const draft = importData.draft as DraftRecipe;

      const saveRes = await fetch("/api/recipes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe: draft,
          source_tag: draft.source_tag ?? "ai_suggest",
        }),
        signal: controller.signal,
      });
      const saveData = await saveRes.json();
      if (saveData.error) throw new Error(saveData.error);

      toast.success(`「${draft.title}」を登録しました`);
      handleOpenChange(false);
      router.refresh();
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      toast.error(
        isAbort
          ? "時間がかかりすぎたため中断しました"
          : err instanceof Error
            ? err.message
            : "取り込みに失敗しました",
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  };

  const content =
    step === "paste" ? (
      <div className="space-y-3">
        <Alert variant="destructive">
          <TriangleAlert className="w-4 h-4" />
          <AlertTitle>サイトを読み取れませんでした</AlertTitle>
          <AlertDescription>
            {pendingUrl && (
              <span className="block break-all text-xs mb-1">
                {pendingUrl}
              </span>
            )}
            <span>
              レシピ本文(タイトル・材料)をコピーして下に貼り付けてください
            </span>
          </AlertDescription>
        </Alert>
        <Textarea
          rows={10}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="レシピのタイトル・材料を含む本文をそのまま貼り付け"
          disabled={busy}
          className="font-mono text-xs"
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPasteText("");
              setPendingUrl(null);
              setStep("input");
            }}
          >
            戻る
          </Button>
          <Button
            className="gap-1.5"
            onClick={() => importAndSave({ content: pasteText })}
            disabled={busy || !pasteText.trim()}
          >
            {busy ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {busy ? "生成中..." : "生成する"}
          </Button>
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="flex items-center bg-[oklch(96%_0.013_70)] rounded-full py-1.5 pl-4 pr-1.5">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a recipe link…"
            disabled={busy}
            className="flex-1 bg-transparent text-[13px] text-[oklch(24%_0.02_50)] placeholder:text-[oklch(50%_0.02_50)] outline-none min-w-0"
          />
          <button
            type="button"
            onClick={() => url.trim() && importAndSave({ url: url.trim() })}
            disabled={busy || !url.trim()}
            className="font-semibold text-[12.5px] text-white bg-[oklch(56%_0.15_35)] hover:bg-[oklch(49%_0.14_35)] transition-colors px-4 py-2.5 rounded-full disabled:opacity-50 shrink-0 flex items-center gap-1.5"
          >
            {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-[oklch(45%_0.02_50)]">
          No searching, no waiting — new ideas are already in your feed
          above.
        </p>
      </div>
    );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom">
          <SheetTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-0 mb-2">
            Add a recipe
          </SheetTitle>
          <div className="px-0 pb-6">{content}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Add a recipe
        </DialogTitle>
        {content}
      </DialogContent>
    </Dialog>
  );
}

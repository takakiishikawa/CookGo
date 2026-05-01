"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Globe,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from "@takaki/go-design-system";
import type { DraftRecipe } from "@/types/api";
import type {
  RecipeRecommendation,
  RecipeRecommendResponse,
} from "@/app/api/recipes/recommend/route";

interface AddRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "url" | "ai";
type Step = "input" | "recommendations" | "paste" | "loading";

const RECOMMEND_TIMEOUT_MS = 90_000;
const IMPORT_TIMEOUT_MS = 90_000;

const STAGE_MESSAGES = [
  "URL を取得しています…",
  "本文を解析しています…",
  "AI で材料・手順を構造化しています…",
  "保存しています…",
];

export function AddRecipeDialog({ open, onOpenChange }: AddRecipeDialogProps) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("url");
  const [step, setStep] = useState<Step>("input");
  const [busy, setBusy] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);

  // url tab
  const [urlInput, setUrlInput] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // paste fallback
  const [pasteText, setPasteText] = useState("");

  // ai tab
  const [aiQuery, setAiQuery] = useState("");
  const [recommendations, setRecommendations] = useState<RecipeRecommendation[]>(
    [],
  );

  const abortRef = useRef<AbortController | null>(null);
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ダイアログを閉じた時に状態リセット
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      setStep("input");
      setBusy(false);
      setStageIndex(0);
      setUrlInput("");
      setPasteText("");
      setAiQuery("");
      setPendingUrl(null);
      setRecommendations([]);
      setMode("url");
    }
  }, [open]);

  const startStageMessages = () => {
    setStageIndex(0);
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    stageTimerRef.current = setInterval(() => {
      setStageIndex((i) => Math.min(STAGE_MESSAGES.length - 1, i + 1));
    }, 7_000);
  };
  const stopStageMessages = () => {
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
  };

  // -----------------------------------------------------------------------
  // 推薦検索
  // -----------------------------------------------------------------------
  const fetchRecommendations = async () => {
    if (!aiQuery.trim()) {
      toast.error("条件を入力してください");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), RECOMMEND_TIMEOUT_MS);

    setBusy(true);
    setRecommendations([]);
    try {
      const res = await fetch("/api/recipes/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery.trim() }),
        signal: controller.signal,
      });
      const data = (await res.json()) as
        | RecipeRecommendResponse
        | { error: string };
      if ("error" in data) throw new Error(data.error);
      setRecommendations(data.recommendations);
      setStep("recommendations");
      if (data.recommendations.length === 0) {
        toast.info("該当するレシピが見つかりませんでした");
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      toast.error(
        isAbort
          ? "検索がタイムアウトしました。条件を変えて試してください"
          : err instanceof Error
            ? err.message
            : "検索に失敗しました",
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  };

  // -----------------------------------------------------------------------
  // URL or text を取り込んでそのまま保存 → 詳細ページへ遷移
  // -----------------------------------------------------------------------
  const importAndSave = async (
    body: { url?: string; content?: string; sourceUrl?: string },
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);

    setBusy(true);
    setStep("loading");
    startStageMessages();
    setPendingUrl(body.url ?? body.sourceUrl ?? null);

    try {
      // 1. インポート
      const importRes = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          body.url
            ? { url: body.url }
            : { content: body.content, url: body.sourceUrl },
        ),
        signal: controller.signal,
      });
      if (importRes.status === 422 && body.url) {
        // fetch 失敗 → ペースト画面へ
        const data = await importRes.json();
        toast.warning(data.message ?? "サイトの取得に失敗しました");
        setStep("paste");
        return;
      }
      const importData = await importRes.json();
      if (importData.error) throw new Error(importData.error);
      const draft = importData.draft as DraftRecipe;

      // 2. 保存
      setStageIndex(STAGE_MESSAGES.length - 1);
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
      onOpenChange(false);
      router.push(`/recipes/${saveData.recipe_id}`);
      router.refresh();
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      toast.error(
        isAbort
          ? "処理がタイムアウトしました"
          : err instanceof Error
            ? err.message
            : "取り込みに失敗しました",
      );
      setStep("input");
    } finally {
      clearTimeout(timeout);
      stopStageMessages();
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>レシピを追加</DialogTitle>
          <DialogDescription>
            URLから取り込むか、AIにレシピを探してもらう
          </DialogDescription>
        </DialogHeader>

        {/* ===== input ===== */}
        {step === "input" && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="url" className="gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                URLから取り込む
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                レシピを探す
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">レシピURL</label>
                <Input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") importAndSave({ url: urlInput });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  サイトを解析して材料・手順を自動で構造化、そのまま登録します。取得できないサイトはテキスト貼り付け画面に切り替わります。
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => importAndSave({ url: urlInput })}
                disabled={busy}
                className="w-full gap-1.5"
              >
                {busy ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                {busy ? "取り込み中..." : "URLから登録"}
              </Button>
            </TabsContent>

            <TabsContent value="ai" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">どんなレシピを探す?</label>
                <Textarea
                  rows={3}
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="例: 鶏胸肉の meal prep / ベトナム風朝食 / 簡単パスタ"
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">
                  日本語のレシピサイトから 5 件提案します
                </p>
              </div>
              <Button
                size="sm"
                onClick={fetchRecommendations}
                disabled={busy}
                className="w-full gap-1.5"
              >
                {busy ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {busy ? "検索中..." : "5件探す"}
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {/* ===== recommendations ===== */}
        {step === "recommendations" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              カードをタップで元サイトを開く。気に入ったら「作ってみる」で取り込み
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendations.map((r, i) => {
                const host = (() => {
                  try {
                    return new URL(r.url).hostname;
                  } catch {
                    return r.url;
                  }
                })();
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => window.open(r.url, "_blank", "noopener")}
                    className="text-left group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg"
                  >
                    <Card className="overflow-hidden flex flex-col h-full transition-shadow group-hover:shadow-md">
                      <div className="relative aspect-video bg-muted overflow-hidden">
                        {r.thumbnail ? (
                          <img
                            src={r.thumbnail}
                            alt={r.title}
                            className="w-full h-full object-cover transition-transform group-hover:scale-[1.04]"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <UtensilsCrossed className="w-8 h-8 text-muted-foreground/40" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 inline-flex items-center gap-1 bg-black/60 backdrop-blur text-white text-[10px] px-2 py-0.5 rounded-full">
                          <ExternalLink className="w-2.5 h-2.5" />
                          {host}
                        </div>
                      </div>
                      <CardContent className="p-3 space-y-2 flex-1 flex flex-col">
                        <p className="font-semibold text-sm leading-snug line-clamp-2">
                          {r.title}
                        </p>
                        {r.features.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.features.map((f, fi) => (
                              <Badge
                                key={fi}
                                variant="secondary"
                                className="text-[10px] font-normal"
                              >
                                {f}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {r.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {r.summary}
                          </p>
                        )}
                        <div className="mt-auto pt-1">
                          <Button
                            size="sm"
                            disabled={busy}
                            className="w-full gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              importAndSave({ url: r.url });
                            }}
                          >
                            作ってみる
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
            <div className="flex">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStep("input")}
              >
                条件を変える
              </Button>
            </div>
          </div>
        )}

        {/* ===== loading (取り込み中) ===== */}
        {step === "loading" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">
                {STAGE_MESSAGES[stageIndex]}
              </p>
              <p className="text-xs text-muted-foreground">
                AI処理に 20〜40 秒かかります。そのままお待ちください。
              </p>
            </div>
            {pendingUrl && (
              <p className="text-[10px] text-muted-foreground break-all max-w-md text-center">
                {pendingUrl}
              </p>
            )}
          </div>
        )}

        {/* ===== paste fallback ===== */}
        {step === "paste" && (
          <div className="space-y-3">
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 space-y-1">
              <Badge variant="outline">URL取得失敗</Badge>
              {pendingUrl && (
                <p className="text-xs text-muted-foreground break-all">
                  {pendingUrl}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                サイトから取得できなかったため、レシピ本文をコピーして下に貼り付けてください
              </p>
            </div>
            <Textarea
              rows={12}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="レシピのタイトル・材料・手順を含む本文をそのまま貼り付け"
              disabled={busy}
              className="font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setPasteText("");
                  setPendingUrl(null);
                  setStep("input");
                }}
              >
                戻る
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                onClick={() =>
                  importAndSave({
                    content: pasteText,
                    sourceUrl: pendingUrl ?? undefined,
                  })
                }
                disabled={busy || !pasteText.trim()}
              >
                {busy ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {busy ? "取り込み中..." : "AIで構造化して登録"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

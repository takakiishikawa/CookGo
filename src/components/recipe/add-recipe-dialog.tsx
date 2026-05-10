"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Globe,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from "@takaki/go-design-system";
import { cn } from "@/lib/utils";
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

const STAGE_MESSAGES_IMPORT = [
  "サイトを開いています…",
  "本文を読み取っています…",
  "AI が材料と手順を整えています…",
  "保存しています…",
];

const STAGE_MESSAGES_RECOMMEND = [
  "AI でレシピを探しています…",
  "良さそうな候補をまとめています…",
  "サムネイル画像を取得しています…",
];

export function AddRecipeDialog({ open, onOpenChange }: AddRecipeDialogProps) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("url");
  const [step, setStep] = useState<Step>("input");
  const [busy, setBusy] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [stageMessages, setStageMessages] = useState<string[]>(
    STAGE_MESSAGES_IMPORT,
  );

  const [urlInput, setUrlInput] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [recommendations, setRecommendations] = useState<RecipeRecommendation[]>(
    [],
  );

  const abortRef = useRef<AbortController | null>(null);
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const startStageMessages = (messages: string[]) => {
    setStageMessages(messages);
    setStageIndex(0);
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    stageTimerRef.current = setInterval(() => {
      setStageIndex((i) => Math.min(messages.length - 1, i + 1));
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
      toast.error("どんなレシピか教えてください");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), RECOMMEND_TIMEOUT_MS);

    setBusy(true);
    setRecommendations([]);
    setStep("loading");
    setPendingUrl(null);
    startStageMessages(STAGE_MESSAGES_RECOMMEND);
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
        toast.info("条件に合うレシピが見つかりませんでした。表現を変えて試してみてください");
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      toast.error(
        isAbort
          ? "時間がかかりすぎたため中断しました。もう一度お試しください"
          : err instanceof Error
            ? err.message
            : "検索に失敗しました",
      );
      setStep("input");
    } finally {
      clearTimeout(timeout);
      stopStageMessages();
      setBusy(false);
    }
  };

  // -----------------------------------------------------------------------
  // 取り込んでそのまま保存 → 詳細ページへ遷移
  // -----------------------------------------------------------------------
  const importAndSave = async (body: {
    url?: string;
    content?: string;
    sourceUrl?: string;
  }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), IMPORT_TIMEOUT_MS);

    setBusy(true);
    setStep("loading");
    startStageMessages(STAGE_MESSAGES_IMPORT);
    setPendingUrl(body.url ?? body.sourceUrl ?? null);

    try {
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
        const data = await importRes.json();
        toast.warning(data.message ?? "サイトを読み取れませんでした");
        setStep("paste");
        return;
      }
      const importData = await importRes.json();
      if (importData.error) throw new Error(importData.error);
      const draft = importData.draft as DraftRecipe;

      setStageIndex(STAGE_MESSAGES_IMPORT.length - 1);
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
      // 一覧に戻って新規追加されたレシピを確認しやすくする
      router.push("/recipes");
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
      setStep("input");
    } finally {
      clearTimeout(timeout);
      stopStageMessages();
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto",
          step === "recommendations" ? "max-w-3xl" : "max-w-md",
        )}
      >
        <DialogHeader>
          <DialogTitle>レシピを追加</DialogTitle>
          {step === "input" && (
            <DialogDescription>
              URL を貼るか、AI に探してもらいましょう
            </DialogDescription>
          )}
        </DialogHeader>

        {/* ===== input ===== */}
        {step === "input" && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="url">
                <span className="flex items-center justify-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  URL から取り込む
                </span>
              </TabsTrigger>
              <TabsTrigger value="ai">
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  レシピを探す
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recipe-url">レシピの URL</Label>
                <Input
                  id="recipe-url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") importAndSave({ url: urlInput });
                  }}
                />
              </div>
              <DialogFooter className="pt-1">
                <Button
                  onClick={() => importAndSave({ url: urlInput })}
                  disabled={busy || !urlInput.trim()}
                  className="gap-1.5"
                >
                  {busy ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {busy ? "取り込み中..." : "AI に取り込んでもらう"}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="ai" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-query">どんなレシピを探しますか?</Label>
                <Textarea
                  id="ai-query"
                  rows={3}
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="例: 鶏胸肉の meal prep / ベトナム風朝食 / 簡単パスタ"
                  disabled={busy}
                />
              </div>
              <DialogFooter className="pt-1">
                <Button
                  onClick={fetchRecommendations}
                  disabled={busy || !aiQuery.trim()}
                  className="gap-1.5"
                >
                  {busy ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {busy ? "探しています..." : "10 件探してもらう"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        )}

        {/* ===== recommendations ===== */}
        {step === "recommendations" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              気になるレシピをタップして元サイトを開いたり、「作ってみる」で取り込めます
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendations.map((r, i) => {
                const host = (() => {
                  try {
                    return new URL(r.url).hostname.replace(/^www\./, "");
                  } catch {
                    return r.url;
                  }
                })();
                return (
                  <Card
                    key={i}
                    onClick={() => window.open(r.url, "_blank", "noopener")}
                    className="overflow-hidden flex flex-col cursor-pointer transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-video bg-muted overflow-hidden">
                      {r.thumbnail ? (
                        <img
                          src={r.thumbnail}
                          alt={r.title}
                          className="w-full h-full object-cover"
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
                      <Button
                        size="sm"
                        disabled={busy}
                        className="w-full gap-1.5 mt-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          importAndSave({ url: r.url });
                        }}
                      >
                        作ってみる
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep("input")}
            >
              条件を変える
            </Button>
          </div>
        )}

        {/* ===== loading ===== */}
        {step === "loading" && (
          <div className="py-10 flex flex-col items-center gap-4">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">
                {stageMessages[stageIndex]}
              </p>
              <p className="text-xs text-muted-foreground">
                完了までに 20〜40 秒ほどかかります
              </p>
            </div>
          </div>
        )}

        {/* ===== paste fallback ===== */}
        {step === "paste" && (
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
                  レシピ本文(タイトル・材料・手順)をコピーして下に貼り付けてください
                </span>
              </AlertDescription>
            </Alert>
            <Textarea
              rows={12}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="レシピのタイトル・材料・手順を含む本文をそのまま貼り付け"
              disabled={busy}
              className="font-mono text-xs"
            />
            <DialogFooter>
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
                onClick={() =>
                  importAndSave({
                    content: pasteText,
                    sourceUrl: pendingUrl ?? undefined,
                  })
                }
                disabled={busy || !pasteText.trim()}
              >
                {busy ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {busy ? "取り込み中..." : "AI で取り込む"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

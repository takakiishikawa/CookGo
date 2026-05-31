"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ExternalLink,
  Globe,
  Plus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  UtensilsCrossed,
  X,
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
import type {
  IdentifyResponse,
  IdentifyResult,
} from "@/app/api/recipes/identify/route";

interface AddRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Mode = "url" | "ai" | "photo";
type Step = "input" | "recommendations" | "paste" | "loading";

/**
 * 画像を canvas で長辺 maxDim 以下に縮小し、JPEG base64 を返す。
 * Claude Vision は長辺 1568px 程度が推奨。送信ペイロードも軽くなる。
 */
async function fileToResizedBase64(
  file: File,
  maxDim = 1568,
  quality = 0.82,
): Promise<{ data: string; mediaType: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("画像を表示できませんでした"));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を処理できませんでした");
  ctx.drawImage(img, 0, 0, w, h);
  const out = canvas.toDataURL("image/jpeg", quality);
  return { data: out.split(",")[1] ?? "", mediaType: "image/jpeg" };
}

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

const STAGE_MESSAGES_IDENTIFY = [
  "写真を解析しています…",
  "食材・料理を特定しています…",
  "解説をまとめ、レシピを探しています…",
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

  const [urlInputs, setUrlInputs] = useState<string[]>([""]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [recommendations, setRecommendations] = useState<RecipeRecommendation[]>(
    [],
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [identified, setIdentified] = useState<IdentifyResult | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      setStep("input");
      setBusy(false);
      setStageIndex(0);
      setUrlInputs([""]);
      setPasteText("");
      setAiQuery("");
      setPendingUrl(null);
      setRecommendations([]);
      setImageFile(null);
      setImagePreview(null);
      setIdentified(null);
      setMode("url");
      setLoadingCount(0);
    }
  }, [open]);

  const durationLabel = (count: number): string => {
    const minSec = Math.max(1, count) * 20;
    const maxSec = Math.max(1, count) * 40;
    if (maxSec < 90) {
      return `完了までに ${minSec}〜${maxSec} 秒ほどかかります`;
    }
    const minMin = Math.ceil(minSec / 60);
    const maxMin = Math.ceil(maxSec / 60);
    if (minMin === maxMin) {
      return `完了までに 約 ${minMin} 分かかります`;
    }
    return `完了までに ${minMin}〜${maxMin} 分ほどかかります`;
  };

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
    setLoadingCount(1);
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
  // 写真から解説 + レシピ検索
  // -----------------------------------------------------------------------
  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選んでください");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const identifyAndRecommend = async () => {
    if (!imageFile) {
      toast.error("写真を選んでください");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // 解析 + 検索の 2 段階ぶん余裕を持たせる
    const timeout = setTimeout(
      () => controller.abort(),
      RECOMMEND_TIMEOUT_MS + 30_000,
    );

    setBusy(true);
    setIdentified(null);
    setRecommendations([]);
    setStep("loading");
    setPendingUrl(null);
    setLoadingCount(1);
    startStageMessages(STAGE_MESSAGES_IDENTIFY);
    try {
      const { data, mediaType } = await fileToResizedBase64(imageFile);
      const idRes = await fetch("/api/recipes/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mediaType }),
        signal: controller.signal,
      });
      const idData = (await idRes.json()) as
        | IdentifyResponse
        | { error: string };
      if ("error" in idData) throw new Error(idData.error);
      setIdentified(idData.result);

      // 解説が出来たらレシピ検索へ
      setStageIndex(STAGE_MESSAGES_IDENTIFY.length - 1);
      const recRes = await fetch("/api/recipes/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: idData.result.recipe_query || idData.result.name,
        }),
        signal: controller.signal,
      });
      const recData = (await recRes.json()) as
        | RecipeRecommendResponse
        | { error: string };
      if (!("error" in recData)) {
        setRecommendations(recData.recommendations);
      }
      setStep("recommendations");
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      toast.error(
        isAbort
          ? "時間がかかりすぎたため中断しました。もう一度お試しください"
          : err instanceof Error
            ? err.message
            : "写真の解析に失敗しました",
      );
      setStep("input");
    } finally {
      clearTimeout(timeout);
      stopStageMessages();
      setBusy(false);
    }
  };

  // -----------------------------------------------------------------------
  // 複数 URL の一括取り込み(URL タブの送信時に使用)
  // -----------------------------------------------------------------------
  const importAndSaveMany = async (urls: string[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // 1 件あたり 90 秒を確保
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(IMPORT_TIMEOUT_MS, urls.length * 90_000),
    );

    setBusy(true);
    setStep("loading");
    setLoadingCount(urls.length);
    stopStageMessages();
    setStageMessages([
      `${urls.length} 件のレシピを取り込んでいます…`,
    ]);
    setStageIndex(0);

    let success = 0;
    let failure = 0;
    let aborted = false;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      setStageMessages([
        `${i + 1} / ${urls.length} 件目を取り込んでいます…`,
      ]);
      setStageIndex(0);
      try {
        const importRes = await fetch("/api/recipes/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });
        if (importRes.status === 422) {
          // 一括時はテキスト貼り付けフォールバックは不可。失敗としてスキップ
          failure++;
          continue;
        }
        const importData = await importRes.json();
        if (importData.error) throw new Error(importData.error);
        const draft = importData.draft as DraftRecipe;

        setStageMessages([
          `${i + 1} / ${urls.length} 件目を保存しています…`,
        ]);
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
        success++;
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (isAbort) {
          aborted = true;
          break;
        }
        console.error("import failed for", url, err);
        failure++;
      }
    }

    clearTimeout(timeout);
    stopStageMessages();
    setBusy(false);

    if (aborted) {
      toast.error("時間がかかりすぎたため中断しました");
    }
    if (success > 0) {
      toast.success(`${success} 件のレシピを登録しました`);
    }
    if (failure > 0) {
      toast.warning(`${failure} 件は取り込めませんでした`);
    }

    if (success > 0) {
      onOpenChange(false);
      router.push("/recipes");
      router.refresh();
    } else {
      setStep("input");
    }
  };

  // -----------------------------------------------------------------------
  // 単発の取り込み(推薦カードクリック / テキスト貼り付け 用)
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
    setLoadingCount(1);
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
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="url">
                <span className="flex items-center justify-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  URL
                </span>
              </TabsTrigger>
              <TabsTrigger value="ai">
                <span className="flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  探す
                </span>
              </TabsTrigger>
              <TabsTrigger value="photo">
                <span className="flex items-center justify-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  写真
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>レシピの URL</Label>
                <div className="space-y-2">
                  {urlInputs.map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="url"
                        value={url}
                        onChange={(e) =>
                          setUrlInputs((prev) =>
                            prev.map((v, idx) =>
                              idx === i ? e.target.value : v,
                            ),
                          )
                        }
                        placeholder="https://..."
                        disabled={busy}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setUrlInputs((prev) =>
                            prev.length === 1
                              ? [""]
                              : prev.filter((_, idx) => idx !== i),
                          )
                        }
                        disabled={
                          busy ||
                          (urlInputs.length === 1 && !urlInputs[0].trim())
                        }
                        aria-label="この URL を削除"
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUrlInputs((prev) => [...prev, ""])}
                  disabled={busy}
                  className="gap-1.5 text-muted-foreground"
                >
                  <Plus className="w-3.5 h-3.5" />
                  URL を追加
                </Button>
              </div>
              <DialogFooter className="pt-1">
                <Button
                  onClick={() => {
                    const urls = urlInputs
                      .map((s) => s.trim())
                      .filter((s) => /^https?:\/\//i.test(s));
                    if (urls.length === 0) {
                      toast.error("URL を入力してください");
                      return;
                    }
                    if (urls.length === 1) {
                      importAndSave({ url: urls[0] });
                    } else {
                      importAndSaveMany(urls);
                    }
                  }}
                  disabled={
                    busy ||
                    !urlInputs.some((s) => /^https?:\/\//i.test(s.trim()))
                  }
                  className="gap-1.5"
                >
                  {busy ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {busy ? "生成中..." : "生成する"}
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

            <TabsContent value="photo" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>食材や料理の写真</Label>
                <p className="text-xs text-muted-foreground">
                  市場やスーパーで見つけた食材・料理の写真をアップすると、それが何かを解説して、合うレシピも探します
                </p>
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="アップロードした写真"
                      className="w-full max-h-64 object-contain rounded-lg border bg-muted"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      disabled={busy}
                      aria-label="写真を削除"
                      className="absolute top-2 right-2 h-7 w-7 rounded-full shadow"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-10 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Camera className="w-8 h-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      タップして写真を選ぶ
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        handleFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
              <DialogFooter className="pt-1">
                <Button
                  onClick={identifyAndRecommend}
                  disabled={busy || !imageFile}
                  className="gap-1.5"
                >
                  {busy ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {busy ? "解析しています..." : "解説してレシピを探す"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        )}

        {/* ===== recommendations ===== */}
        {step === "recommendations" && (
          <div className="space-y-3">
            {identified && <IdentifiedPanel info={identified} />}
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {identified
                  ? "関連するレシピは見つかりませんでした。"
                  : "条件に合うレシピが見つかりませんでした。"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                気になるレシピをタップして元サイトを開いたり、「作ってみる」で取り込めます
              </p>
            )}
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
                {durationLabel(loadingCount)}
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
                {busy ? "生成中..." : "生成する"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IdentifiedPanel({ info }: { info: IdentifyResult }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            <h3 className="text-lg font-bold leading-tight">{info.name}</h3>
            {info.name_en && (
              <span className="text-xs text-muted-foreground">
                {info.name_en}
              </span>
            )}
            {info.name_vi && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                {info.name_vi}
              </Badge>
            )}
          </div>
          {info.confidence && (
            <p className="text-xs text-muted-foreground">{info.confidence}</p>
          )}
        </div>
        {info.kind && <InfoRow label="種類" text={info.kind} />}
        {info.origin && <InfoRow label="これは何?" text={info.origin} />}
        {info.taste_profile && (
          <InfoRow label="味の特徴" text={info.taste_profile} />
        )}
        {info.pairings.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-primary">合う食材・料理</p>
            <ul className="space-y-1 text-sm leading-relaxed">
              {info.pairings.map((p, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-foreground">{p.food}</span>
                  {p.reason && (
                    <span className="text-xs text-muted-foreground">
                      {p.reason}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold text-primary">{label}</p>
      <p className="text-sm leading-relaxed text-foreground/90">{text}</p>
    </div>
  );
}

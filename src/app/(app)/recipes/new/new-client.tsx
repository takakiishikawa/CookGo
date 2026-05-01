"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Globe,
  PencilLine,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  CardContent,
  Badge,
  PageHeader,
  toast,
} from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";
import { RecipeEditor } from "@/components/recipe-editor";
import type { DraftRecipe } from "@/types/api";
import type {
  RecipeRecommendation,
  RecipeRecommendResponse,
} from "@/app/api/recipes/recommend/route";

type Mode = "name" | "ai" | "url";
type Step = "input" | "recommendations" | "paste" | "edit";

export function NewRecipeClient() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("name");
  const [step, setStep] = useState<Step>("input");

  // shared
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<DraftRecipe | null>(null);

  // mode: name
  const [titleInput, setTitleInput] = useState("");

  // mode: ai (web search)
  const [aiQuery, setAiQuery] = useState("");
  const [recommendations, setRecommendations] = useState<RecipeRecommendation[]>(
    [],
  );

  // mode: url
  const [urlInput, setUrlInput] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // 料理名から作る
  // -----------------------------------------------------------------------
  const generateFromName = async () => {
    if (!titleInput.trim()) {
      toast.error("料理名を入力してください");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/recipes/from-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleInput.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDraft(data.recipe as DraftRecipe);
      setStep("edit");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  // -----------------------------------------------------------------------
  // AI推薦(web search)
  // -----------------------------------------------------------------------
  const fetchRecommendations = async () => {
    if (!aiQuery.trim()) {
      toast.error("条件を入力してください");
      return;
    }
    setBusy(true);
    setRecommendations([]);
    try {
      const res = await fetch("/api/recipes/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery.trim() }),
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
      toast.error(err instanceof Error ? err.message : "検索に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  // -----------------------------------------------------------------------
  // URL取り込み (mode: url の直接入力 or 推薦カードの「作ってみる」)
  // -----------------------------------------------------------------------
  const importFromUrl = async (url: string) => {
    if (!url.trim()) {
      toast.error("URLを入力してください");
      return;
    }
    setBusy(true);
    setPendingUrl(url);
    try {
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (res.status === 422) {
        // fetch 失敗 → ペースト方式へ
        const data = await res.json();
        toast.warning(data.message ?? "サイトの取得に失敗しました");
        setStep("paste");
        return;
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDraft(data.draft as DraftRecipe);
      setStep("edit");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "取り込みに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const importFromText = async () => {
    if (!pasteText.trim()) {
      toast.error("レシピ本文を貼り付けてください");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: pasteText.trim(),
          url: pendingUrl ?? undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDraft(data.draft as DraftRecipe);
      setStep("edit");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "取り込みに失敗しました");
    } finally {
      setBusy(false);
    }
  };

  // -----------------------------------------------------------------------
  // 保存
  // -----------------------------------------------------------------------
  const saveSingleDraft = async (recipe: DraftRecipe) => {
    setSaving(true);
    try {
      const source_tag =
        recipe.source_tag ?? (mode === "name" ? "self" : "ai_suggest");
      const res = await fetch("/api/recipes/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe, source_tag }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`「${recipe.title}」を登録しました`);
      router.push(`/recipes/${data.recipe_id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    if (step === "edit") {
      if (mode === "ai") setStep("recommendations");
      else if (mode === "url") setStep(pendingUrl ? "paste" : "input");
      else setStep("input");
      return;
    }
    if (step === "recommendations" || step === "paste") {
      setStep("input");
      setPendingUrl(null);
      return;
    }
    router.push("/recipes");
  };

  return (
    <div className="flex flex-col">
      <AppHeader />
      <div className="px-4 md:px-8 pt-5 pb-24 space-y-5 max-w-3xl">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={back}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <PageHeader
            title="レシピを追加"
            description="料理名から作る・AIに探してもらう・URLから取り込む"
          />
        </div>

        {step === "input" && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="name" className="gap-1.5">
                <PencilLine className="w-3.5 h-3.5" />
                料理名から作る
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AIに探してもらう
              </TabsTrigger>
              <TabsTrigger value="url" className="gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                URLから取り込む
              </TabsTrigger>
            </TabsList>

            {/* 料理名から作る */}
            <TabsContent value="name" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">料理名</label>
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="例: 生姜焼き定食 / 冷奴 / アボカド和え"
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") generateFromName();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  料理名から AI が詳細レシピを生成します
                </p>
              </div>
              <Button
                size="sm"
                onClick={generateFromName}
                disabled={busy}
                className="w-full gap-1.5"
              >
                {busy ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {busy ? "生成中..." : "生成"}
              </Button>
            </TabsContent>

            {/* AIに探してもらう (web search) */}
            <TabsContent value="ai" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">どんなレシピを探す?</label>
                <Textarea
                  rows={3}
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="例: 鶏胸肉を使った meal prep / ベトナム風朝食 / 高タンパク 簡単レシピ"
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

            {/* URLから取り込む */}
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
                    if (e.key === "Enter") importFromUrl(urlInput);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  URL を解析して材料・手順を自動構造化します。取得できない場合は本文の貼り付け画面に切り替わります。
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => importFromUrl(urlInput)}
                disabled={busy}
                className="w-full gap-1.5"
              >
                {busy ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                {busy ? "取り込み中..." : "URLから取り込む"}
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {/* AI 推薦結果カード */}
        {step === "recommendations" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              気になるレシピで「作ってみる」を押すと取り込めます
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendations.map((r, i) => (
                <Card key={i} className="overflow-hidden flex flex-col">
                  <div className="aspect-video bg-muted overflow-hidden">
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
                  </div>
                  <CardContent className="p-3 space-y-2 flex-1 flex flex-col">
                    <p className="font-semibold text-sm leading-snug line-clamp-2">
                      {r.title}
                    </p>
                    {r.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {r.summary}
                      </p>
                    )}
                    <div className="text-[10px] text-muted-foreground truncate">
                      {(() => {
                        try {
                          return new URL(r.url).hostname;
                        } catch {
                          return r.url;
                        }
                      })()}
                    </div>
                    <div className="flex gap-1.5 mt-auto pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="flex-1 gap-1.5"
                      >
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          元サイト
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => importFromUrl(r.url)}
                        disabled={busy}
                        className="flex-1 gap-1.5"
                      >
                        {busy && pendingUrl === r.url && (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        )}
                        作ってみる
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {recommendations.length === 0 && (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground text-center">
                  該当するレシピが見つかりませんでした。条件を変えて再検索してください。
                </CardContent>
              </Card>
            )}
            <div className="flex gap-2 sticky bottom-0 bg-background py-3 -mx-4 px-4 md:-mx-8 md:px-8 border-t border-border">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("input")}
              >
                条件を変える
              </Button>
            </div>
          </div>
        )}

        {/* テキスト貼り付け fallback */}
        {step === "paste" && (
          <div className="space-y-3">
            <Card>
              <CardContent className="p-3 text-sm space-y-2">
                <Badge variant="outline">URL取得失敗</Badge>
                {pendingUrl && (
                  <p className="text-xs text-muted-foreground break-all">
                    {pendingUrl}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  サイトから取得できなかったため、レシピ本文をコピーして下に貼り付けてください
                </p>
              </CardContent>
            </Card>
            <Textarea
              rows={14}
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
                onClick={importFromText}
                disabled={busy}
              >
                {busy ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {busy ? "取り込み中..." : "AIで構造化して取り込む"}
              </Button>
            </div>
          </div>
        )}

        {/* 編集モード */}
        {step === "edit" && draft && (
          <RecipeEditor
            initial={draft}
            saving={saving}
            saveLabel="登録"
            onSave={saveSingleDraft}
            onCancel={back}
            cancelLabel="戻る"
          />
        )}
      </div>
    </div>
  );
}

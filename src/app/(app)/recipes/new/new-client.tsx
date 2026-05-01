"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Sparkles, PencilLine } from "lucide-react";
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
import type { PantryItem } from "@/types/database";

type Mode = "name" | "ai";
type Step = "input" | "candidates" | "edit";

export function NewRecipeClient({
  pantryItems,
}: {
  pantryItems: PantryItem[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("name");
  const [step, setStep] = useState<Step>("input");

  const [titleInput, setTitleInput] = useState("");
  const [conditions, setConditions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<DraftRecipe | null>(null);
  const [candidates, setCandidates] = useState<DraftRecipe[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const generateFromName = async () => {
    if (!titleInput.trim()) {
      toast.error("料理名を入力してください");
      return;
    }
    setGenerating(true);
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
      setGenerating(false);
    }
  };

  const generateCandidates = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/recipes/suggest-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conditions: conditions.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCandidates(data.candidates as DraftRecipe[]);
      setSelected(new Set());
      setStep("candidates");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const toggleSelect = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const saveSelectedCandidates = async () => {
    if (selected.size === 0) {
      toast.error("少なくとも1件選択してください");
      return;
    }
    setSaving(true);
    try {
      const recipes = Array.from(selected).map((i) => candidates[i]);
      const res = await fetch("/api/recipes/save-many", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipes, source_tag: "ai_suggest" }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`${data.recipe_ids.length}件のレシピを登録しました`);
      router.push("/recipes");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const saveSingleDraft = async (recipe: DraftRecipe) => {
    setSaving(true);
    try {
      const source_tag =
        recipe.source_tag ?? (mode === "ai" ? "ai_suggest" : "self");
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
      setStep(mode === "ai" ? "candidates" : "input");
      return;
    }
    if (step === "candidates") {
      setStep("input");
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
            description="料理名から作るか、AIに提案してもらえます"
          />
        </div>

        {step === "input" && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="name" className="gap-1.5">
                <PencilLine className="w-3.5 h-3.5" />
                料理名から作る
              </TabsTrigger>
              <TabsTrigger value="ai" className="gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AIに提案してもらう
              </TabsTrigger>
            </TabsList>

            <TabsContent value="name" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">料理名</label>
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="例: 生姜焼き定食 / 冷奴 / アボカド和え"
                  disabled={generating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") generateFromName();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  入力した料理名をAIが詳細レシピに展開し、編集画面で調整できます
                </p>
              </div>
              <Button
                size="sm"
                onClick={generateFromName}
                disabled={generating}
                className="w-full gap-1.5"
              >
                {generating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {generating ? "生成中..." : "生成"}
              </Button>
            </TabsContent>

            <TabsContent value="ai" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">条件(自由記述)</label>
                <Textarea
                  rows={4}
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="例: 鶏肉を使いたい / さっぱり系で作り置き / 朝食向けの簡単なもの"
                  disabled={generating}
                />
                <p className="text-xs text-muted-foreground">
                  3〜5件の候補を提案。気に入ったものを複数選んで一括登録できます。
                </p>
              </div>
              <Button
                size="sm"
                onClick={generateCandidates}
                disabled={generating}
                className="w-full gap-1.5"
              >
                {generating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {generating ? "提案中..." : "提案してもらう"}
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {step === "candidates" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              登録したいレシピを選択してください（複数選択可）
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {candidates.map((c, i) => {
                const active = selected.has(i);
                return (
                  <Card
                    key={i}
                    className={`cursor-pointer transition-all ${
                      active
                        ? "ring-2 ring-primary border-primary"
                        : "border-border hover:border-primary/40"
                    }`}
                    onClick={() => toggleSelect(i)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleSelect(i)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{c.title}</p>
                          {c.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {c.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {c.prep_time_min && (
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">
                            {c.prep_time_min}分
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="flex gap-2 sticky bottom-0 bg-background py-3 -mx-4 px-4 md:-mx-8 md:px-8 border-t border-border">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("input")}
              >
                戻る
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-1.5"
                onClick={saveSelectedCandidates}
                disabled={saving || selected.size === 0}
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {saving ? "保存中..." : `${selected.size}件を登録`}
              </Button>
            </div>
          </div>
        )}

        {step === "edit" && draft && (
          <RecipeEditor
            initial={draft}
            pantryItems={pantryItems}
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

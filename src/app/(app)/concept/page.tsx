import { Leaf } from "lucide-react";
import { ConceptPage } from "@takaki/go-design-system";
import { AppHeader } from "@/components/layout/app-header";

export default function ConceptPageRoute() {
  return (
    <div className="flex flex-col">
      <AppHeader />
      <ConceptPage
        productName="CookGo"
        productLogo={<Leaf className="w-5 h-5 text-primary" />}
        tagline="料理を楽しむためのレシピ管理アプリ"
        coreMessage="作りたいレシピをすぐ見つけ、ストレスなく料理に取りかかる。気に入ったレシピを自分のレパートリーとして育てていく。"
        coreValue="AIにレシピを提案してもらう、URL を貼って取り込む、料理名から作る — 3つの入口で素早くレシピを集め、自分の言葉と写真で育てていく。レシピごとの買い物リストや人数換算も組み込み、料理プロセスのフリクションを最小化する。"
        scope={{
          solve: [
            "条件に合うレシピを AI が web 検索で 5 件提案",
            "レシピ URL の自動取り込み(失敗時はテキスト貼り付けでフォールバック)",
            "料理名から AI が詳細レシピを生成",
            "材料の3言語表示(日本語・英語・ベトナム語)",
            "人数指定で材料量を自動換算",
            "レシピ別の買い物リスト(買う・買わない・買った)",
            "サムネイル写真をユーザー自身でアップロード",
          ],
          notSolve: [
            "栄養・カロリー計算",
            "食事ログ・献立カレンダー",
            "食材庫管理",
            "医療・臨床栄養の判断",
            "食材の自動購入・デリバリー連携",
          ],
        }}
        productLogic={{
          steps: [
            {
              title: "レシピを集める",
              description: "AIに探してもらう・URLから取り込む・料理名から作る",
            },
            {
              title: "AIが構造化",
              description: "材料・手順・3言語表記を自動で整形",
            },
            {
              title: "自分仕様に編集",
              description: "サムネイル差し替え、人数調整、編集で自分のレシピに",
            },
            {
              title: "買い物リストへ",
              description: "材料を買う/買わない・買ったでチェック管理",
            },
            {
              title: "レパートリーが育つ",
              description: "「作った」レシピが蓄積し、料理の幅が広がる",
            },
          ],
          outcome:
            "料理を始めるまでのフリクションがゼロになり、自分のレパートリーが自然に増える",
        }}
        resultMetric={{
          title: "週1回以上の新規レシピ追加 + 月1回以上の「作った」化",
          description:
            "レシピを集めて自分のものにするサイクルが回っている状態。集めるだけで終わらず、実際に作っている。",
        }}
        behaviorMetrics={[
          {
            title: "週1回以上のレシピ追加",
            description:
              "AI推薦・URL取り込み・料理名生成のいずれかでレシピを追加している",
          },
          {
            title: "月1回以上の買い物リスト利用",
            description:
              "レシピ詳細から買い物リストを開き、買う/買ったの状態を変更している",
          },
          {
            title: "サムネイル写真の差し替え",
            description: "自分で作ったレシピの写真をアップロードしている",
          },
          {
            title: "「作った」マークの活用",
            description: "実際に作ったレシピに「作った」マークをつけている",
          },
        ]}
      />
    </div>
  );
}

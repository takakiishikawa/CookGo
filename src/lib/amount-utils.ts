/**
 * 食材の量を人数比率でスケーリングする。
 * 大さじ・小さじ・カップ・分数・数値+単位 を可能な限り扱う。
 * パースできない場合(「適量」等)は元の文字列を返す。
 */

const NUMERIC_UNITS = new Set([
  "g",
  "kg",
  "ml",
  "l",
  "個",
  "本",
  "枚",
  "片",
  "切れ",
  "尾",
  "玉",
  "房",
  "袋",
  "缶",
  "丁",
  "杯",
  "粒",
  "束",
  "把",
  "株",
  "cc",
]);

const JP_PREFIXES = ["大さじ", "小さじ", "カップ"] as const;

function formatNumber(n: number): string {
  if (n <= 0) return "0";
  if (n < 1) {
    // 一般的な分数を見やすく
    if (Math.abs(n - 0.5) < 0.02) return "1/2";
    if (Math.abs(n - 0.25) < 0.02) return "1/4";
    if (Math.abs(n - 0.75) < 0.02) return "3/4";
    if (Math.abs(n - 1 / 3) < 0.03) return "1/3";
    if (Math.abs(n - 2 / 3) < 0.03) return "2/3";
    if (Math.abs(n - 1 / 8) < 0.02) return "1/8";
    return n.toFixed(2).replace(/\.?0+$/, "");
  }
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function parseNumeric(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  // 1/2, 3/4 形式
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const v = Number(frac[1]) / Number(frac[2]);
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * RecipeIngredient { amount, unit } を ratio 倍にスケールした表示文字列にする。
 *
 * 対応パターン:
 * 1. amount="150", unit="g" → "300g" (ratio=2)
 * 2. amount="3", unit="大さじ" → "大さじ6"
 * 3. amount="大さじ2", unit="" → "大さじ4"
 * 4. amount="大さじ1/2", unit="" → "大さじ1"
 * 5. amount="1/2", unit="個" → "1個"
 * 6. amount="適量", unit="" → "適量" (スケールせず)
 */
export function scaleAmountText(
  amount: string | null | undefined,
  unit: string | null | undefined,
  ratio: number,
): string {
  const a = (amount ?? "").trim();
  const u = (unit ?? "").trim();

  // 質的表現(少々/適量/ひとつまみ等)は数値スケール不可なので、ratio≠1 のときだけ倍率を後ろに添える
  const QUALITATIVE_RE = /少々|適量|ひとつまみ|お好みで?|とある/;
  if (QUALITATIVE_RE.test(a)) {
    const base = u ? `${a}${u}` : a;
    if (Math.abs(ratio - 1) < 0.01) return base;
    return `${base} × ${formatNumber(ratio)}`;
  }

  // Pattern 2/3: 大さじ・小さじ・カップが prefix で含まれる
  for (const prefix of JP_PREFIXES) {
    if (a.startsWith(prefix)) {
      // amount="大さじ2" 形式
      const rest = a.slice(prefix.length);
      const n = parseNumeric(rest);
      if (n != null) {
        return `${prefix}${formatNumber(n * ratio)}${u}`;
      }
    }
    if (u === prefix) {
      // amount="2", unit="大さじ" 形式
      const n = parseNumeric(a);
      if (n != null) {
        return `${prefix}${formatNumber(n * ratio)}`;
      }
    }
  }

  // Pattern 1/5: 数値 + 既知単位
  const n = parseNumeric(a);
  if (n != null && (NUMERIC_UNITS.has(u) || u === "")) {
    return `${formatNumber(n * ratio)}${u}`;
  }

  // パースできず: そのまま返す
  return u ? `${a}${u}` : a;
}

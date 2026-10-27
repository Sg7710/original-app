"use client";

import { useState } from "react";
import {
  saveSettings,
  useAccount,
  type MaxPriceTier,
  type SearchRadius,
  type TravelMode,
  saveTravelMode,
} from "@/hooks/useAccount";
import { PRICE_TIER_COLORS } from "@/lib/meshi/derived";
import type { DeckKind } from "@/lib/meshi/open-status";

const RADIUS_OPTIONS: { value: SearchRadius; label: string }[] = [
  { value: 1500, label: "1.5km" },
  { value: 3000, label: "3km" },
  { value: 5000, label: "5km" },
];

const TRAVEL_OPTIONS: { value: TravelMode; label: string }[] = [
  { value: "walk", label: "徒歩" },
  { value: "bike", label: "自転車" },
  { value: "car", label: "車" },
];

export const PRICE_OPTIONS: { value: MaxPriceTier; label: string; dots: (1 | 2 | 3 | 4)[] }[] = [
  { value: 1, label: "〜¥2,000", dots: [1] },
  { value: 2, label: "〜¥3,000", dots: [1, 2] },
  { value: 3, label: "〜¥6,000", dots: [1, 2, 3] },
  { value: null, label: "上限なし", dots: [1, 2, 3, 4] },
];

const DECK_KIND_OPTIONS: { value: DeckKind; label: string; note: string }[] = [
  { value: "open", label: "営業中", note: "" },
  { value: "opensSoon", label: "まもなく開店", note: "30分以内に開く" },
  { value: "closesSoon", label: "まもなく閉店", note: "閉店まで30分以内" },
];

/** 「出すお店」のチェック。最後の1つは外せない(1軒も出なくなるため)。 */
function DeckKindChecks({
  value,
  onChange,
}: {
  value: Record<DeckKind, boolean>;
  onChange: (value: Record<DeckKind, boolean>) => void;
}) {
  const checkedCount = DECK_KIND_OPTIONS.filter((o) => value[o.value]).length;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-text-primary">スワイプに出すお店</p>
      <div className="flex flex-col gap-1 rounded-[22px] bg-tab-active p-1">
        {DECK_KIND_OPTIONS.map((o) => {
          const checked = value[o.value];
          const locked = checked && checkedCount === 1;
          return (
            <label
              key={o.value}
              className={`flex h-11 items-center gap-3 rounded-[18px] px-3 text-xs font-bold ${
                checked
                  ? "bg-white text-text-primary shadow-[0_2px_8px_rgba(26,24,19,0.08)]"
                  : "text-[#8A8474]"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                aria-disabled={locked}
                onChange={() => {
                  if (!locked) onChange({ ...value, [o.value]: !checked });
                }}
                className="h-5 w-5 shrink-0 accent-[#1A1813]"
              />
              <span>{o.label}</span>
              {o.note && (
                <span className="text-[11px] font-normal text-text-tertiary">（{o.note}）</span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function radiusLabel(radiusM: number): string {
  return `${radiusM / 1000}km`;
}

export function priceLimitLabel(tier: MaxPriceTier): string {
  return PRICE_OPTIONS.find((o) => o.value === tier)?.label ?? "上限なし";
}

function Segmented<T>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: React.ReactNode; key: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-text-primary">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex gap-1 rounded-[22px] bg-tab-active p-1"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={`flex h-11 flex-1 items-center justify-center gap-1 rounded-[18px] text-xs font-bold ${
                active
                  ? "bg-white text-text-primary shadow-[0_2px_8px_rgba(26,24,19,0.08)]"
                  : "text-[#8A8474]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Distance + budget pickers, shared by the プロフィール tab and the conditions
 * sheet. Picks are a draft — nothing is saved or searched until
 * 「この条件でお店を探す」. `radiusValue` is the distance to start from (it may
 * have been widened just for this session via 「もっとお店を見てみよう」).
 */
export function SearchConditionsFields({
  radiusValue,
  onApplied,
}: {
  radiusValue?: number;
  onApplied: () => void;
}) {
  const account = useAccount();
  const [draftRadius, setDraftRadius] = useState<SearchRadius>(
    (radiusValue ?? account.settings.radiusM) as SearchRadius,
  );
  const [draftTier, setDraftTier] = useState<MaxPriceTier>(account.settings.maxPriceTier);
  const [draftKinds, setDraftKinds] = useState(account.settings.deckKinds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function apply() {
    setSaving(true);
    setError(false);
    try {
      await saveSettings({
        radiusM: draftRadius,
        maxPriceTier: draftTier,
        travelMode: account.settings.travelMode,
        deckKinds: draftKinds,
      });
      onApplied();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Segmented
        label="移動手段（お店までの時間の目安）"
        value={account.settings.travelMode}
        onChange={(mode) => {
          setError(false);
          // 表示が変わるだけなので、押したらすぐ保存する(探し直さない)
          saveTravelMode(mode).catch(() => setError(true));
        }}
        options={TRAVEL_OPTIONS.map((o) => ({ ...o, key: o.value }))}
      />
      <Segmented
        label="探す距離（半径）"
        value={draftRadius}
        onChange={setDraftRadius}
        options={RADIUS_OPTIONS.map((o) => ({ ...o, key: String(o.value) }))}
      />
      <Segmented
        label="予算の上限"
        value={draftTier}
        onChange={setDraftTier}
        options={PRICE_OPTIONS.map((o) => ({
          key: String(o.value),
          value: o.value,
          label: (
            <span className="flex flex-col items-center gap-0.5">
              <span className="flex gap-0.5">
                {o.dots.map((t) => (
                  <span
                    key={t}
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: PRICE_TIER_COLORS[t].bg }}
                  />
                ))}
              </span>
              <span className="text-[11px]">{o.label}</span>
            </span>
          ),
        }))}
      />
      <p className="text-[11px] leading-relaxed text-text-tertiary">
        価格が分からないお店（グレー）は、予算に関係なく表示します。
      </p>
      <DeckKindChecks value={draftKinds} onChange={setDraftKinds} />
      <button
        type="button"
        onClick={apply}
        disabled={saving}
        className="mt-auto h-12 shrink-0 rounded-full bg-accent text-sm font-bold text-text-primary disabled:opacity-60"
      >
        {saving ? "保存しています…" : "この条件でお店を探す"}
      </button>
      {error && (
        <p role="alert" className="text-[11px] text-[#D8452F]">
          設定を保存できませんでした。もう一度お試しください。
        </p>
      )}
    </>
  );
}

/** Slider-style "adjust" icon for the conditions button. */
export function SlidersIcon() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

/** Bottom sheet with only the distance + budget pickers, opened from the swipe header. */
export function ConditionsSheet({
  radiusValue,
  onClose,
}: {
  radiusValue: number;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-[85] flex flex-col justify-end"
      style={{ backgroundColor: "rgba(26,24,19,0.24)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="探す条件"
        className="flex min-h-[64%] flex-col gap-6 rounded-t-[26px] bg-white px-5 pb-8 pt-3"
        style={{ boxShadow: "0 -12px 32px rgba(26,24,19,0.12)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <span aria-hidden className="mx-auto h-1 w-10 shrink-0 rounded-full bg-[#E4DFD4]" />
        <div className="-mt-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-text-primary">探す条件</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-full px-4 text-sm font-bold text-text-secondary"
          >
            閉じる
          </button>
        </div>
        <SearchConditionsFields radiusValue={radiusValue} onApplied={onClose} />
      </div>
    </div>
  );
}

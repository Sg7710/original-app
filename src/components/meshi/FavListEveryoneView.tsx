"use client";

import { useMemo, useState } from "react";
import type { Store } from "@/types/store";
import type { Person } from "@/types/social";
import { TravelTime } from "./TravelTime";
import { Avatar } from "./Avatar";
import { PriceLabel } from "./PriceLabel";
import { StoreThumb } from "./StoreThumb";

interface FavListEveryoneViewProps {
  stores: Store[];
  people: Person[];
  myFavoritePlaceIds: Set<string>;
  onToggleMine: (placeId: string) => void;
}

export function FavListEveryoneView({
  stores,
  people,
  myFavoritePlaceIds,
  onToggleMine,
}: FavListEveryoneViewProps) {
  const [who, setWho] = useState<"all" | string>("all");

  const activePeople = who === "all" ? people : people.filter((p) => p.id === who);

  const rows = useMemo(() => {
    const byStore = new Map<string, Person[]>();
    for (const person of activePeople) {
      for (const placeId of person.wantIds) {
        const list = byStore.get(placeId) ?? [];
        list.push(person);
        byStore.set(placeId, list);
      }
    }
    return Array.from(byStore.entries())
      .map(([placeId, wanters]) => ({
        store: stores.find((s) => s.placeId === placeId),
        wanters,
      }))
      .filter((row): row is { store: Store; wanters: Person[] } => Boolean(row.store))
      .sort((a, b) => b.wanters.length - a.wanters.length);
  }, [activePeople, stores]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-[14px]">
        <button
          type="button"
          onClick={() => setWho("all")}
          className={`flex h-10 shrink-0 items-center rounded-[20px] px-4 text-xs font-bold ${
            who === "all"
              ? "border border-text-primary bg-text-primary text-app"
              : "border border-[rgba(26,24,19,0.1)] bg-white text-text-secondary"
          }`}
        >
          全員
        </button>
        {people.map((person) => {
          const active = who === person.id;
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => setWho(person.id)}
              className={`flex h-10 shrink-0 items-center gap-2 rounded-[20px] py-0 pl-1.5 pr-3.5 text-xs font-bold ${
                active
                  ? "border border-text-primary bg-text-primary text-app"
                  : "border border-[rgba(26,24,19,0.1)] bg-white text-text-secondary"
              }`}
            >
              <Avatar name={person.name} color={person.color} size={28} />
              <span>{person.name}</span>
            </button>
          );
        })}
      </div>

      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5">
        {rows.map(({ store, wanters }) => {
          const mine = myFavoritePlaceIds.has(store.placeId);
          return (
            <li
              key={store.placeId}
              className="flex flex-col gap-3 rounded-[20px] border border-card-border bg-white p-3"
            >
              <div className="flex items-center gap-[14px]">
                <StoreThumb store={store} size={64} radius={15} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-[15px] font-bold text-text-primary">{store.name}</p>
                  <p className="font-mono text-[11px] text-text-secondary">
                    <TravelTime store={store} />
                  </p>
                  <p className="font-mono text-[11px] text-text-secondary">
                    <PriceLabel store={store} />
                  </p>
                  <p className="truncate text-[11px] text-text-secondary">{store.genre}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleMine(store.placeId)}
                  className={`h-10 shrink-0 rounded-[20px] px-3.5 text-[11px] font-bold ${
                    mine ? "bg-tab-active text-[#8A8474]" : "bg-accent text-white"
                  }`}
                >
                  {mine ? "追加済み" : "＋ 自分にも"}
                </button>
              </div>
              <div className="flex items-center gap-2 border-t border-[rgba(26,24,19,0.06)] pt-2.5">
                <div className="flex -space-x-1.5">
                  {wanters.map((p) => (
                    <Avatar key={p.id} name={p.name} color={p.color} size={22} />
                  ))}
                </div>
                <span className="text-[11px] text-text-secondary">
                  {wanters.length >= 2
                    ? `${wanters.map((p) => p.name).join("・")}　${wanters.length}人`
                    : `${wanters[0]?.name}が食べたい`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

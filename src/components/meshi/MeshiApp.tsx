"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFavorites } from "@/hooks/useFavorites";
import { LIKE_HISTORY_DAYS, useLikeHistory } from "@/hooks/useLikeHistory";
import { useLocation } from "@/hooks/useLocation";
import { setTravelOrigin } from "@/hooks/useTravelTime";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePassHistory } from "@/hooks/usePassHistory";
import { useStores } from "@/hooks/useStores";
import { useAccount, type SearchRadius } from "@/hooks/useAccount";
import { orderForDeck } from "@/lib/meshi/derived";
import type { Store } from "@/types/store";
import { FRAME_CLASS } from "./frame";
import { LocationPermission } from "./LocationPermission";
import { OnboardingChoice } from "./OnboardingChoice";
import { TutorialOverlay } from "./TutorialOverlay";
import { Header } from "./Header";
import { SwipeTab } from "./SwipeTab";
import { FavListTab } from "./FavListTab";
import { BottomTabBar, type Tab } from "./BottomTabBar";
import { SettingsPanel } from "./SettingsPanel";
import { ConditionsSheet } from "./SearchConditions";

const RADIUS_STEPS: SearchRadius[] = [1500, 3000, 5000];
type Stage = "location" | "choice" | "app";
// lap1 = 1周目(全件ランダム順)、confirm = 「もう一度見ますか」、
// lap2 = 2周目(1回だけパスされた店のみ)、done = その日は以上
type SwipePhase = "lap1" | "confirm" | "lap2" | "done";

function CenteredMessage({
  title,
  body,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className={FRAME_CLASS}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        {body && <p className="text-sm text-text-secondary">{body}</p>}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 h-12 rounded-full bg-accent px-6 text-sm font-bold text-text-primary"
          >
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="h-12 rounded-full border border-card-border px-6 text-sm font-bold text-text-primary"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export function MeshiApp() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("swipe");
  const [idx, setIdx] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [phase, setPhase] = useState<SwipePhase>("lap1");
  const [lap2List, setLap2List] = useState<Store[]>([]);
  // この起動中にスワイプした店。条件を変えて探し直したとき、これらは山に入れない。
  const [swiped, setSwiped] = useState<ReadonlySet<string>>(new Set());
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());

  const account = useAccount();
  const { maxPriceTier } = account.settings;
  // 「もっとお店を見てみよう」で今回だけ広げた距離。設定は変えない。
  // 設定画面で距離を選び直したら、そちらを優先して解除する。
  const [radiusOverride, setRadiusOverride] = useState<SearchRadius | null>(null);
  const [settingsRadius, setSettingsRadius] = useState(account.settings.radiusM);
  if (account.settings.radiusM !== settingsRadius) {
    setSettingsRadius(account.settings.radiusM);
    setRadiusOverride(null);
  }
  const radiusM = radiusOverride ?? account.settings.radiusM;
  const { status: locationStatus, coords, request } = useLocation();
  const searchCoords = locationStatus === "granted" ? coords : null;
  // お店までの時間(Google の道の時間)は、この場所から計算する。
  useEffect(() => {
    setTravelOrigin(searchCoords);
  }, [searchCoords]);
  // 保存済みの距離を読み終えるまで検索しない(既定値で1回、設定値でもう1回、と二重に払わないため)。
  const search = useStores(searchCoords, account.loaded ? radiusM : null);
  // サーバーが1.5km→3kmに自動で広げた場合もあるので、実際に探した距離の次の段階へ。
  const searchedRadius = search.radius ?? radiusM;
  const nextRadius = RADIUS_STEPS.find((r) => r > searchedRadius) ?? null;
  const { favorites, addFavorite, removeFavorite, toggleFavorite } = useFavorites();
  const { history: likeHistory, recordLike } = useLikeHistory();
  const { seen: onboardingSeen, markSeen } = useOnboarding();
  const { getPassCount, recordPass } = usePassHistory();

  // 「食べたい」(直近7日のいいね)か「自分」に入っている店はスワイプに出さない。
  // 山を作った時点の状態で決める: スワイプ中にいいねした店をその場で抜くと、
  // 山の並びがずれて次のカードが飛ばされるため。
  const favoriteIdsNow = () => {
    const since = Date.now() - LIKE_HISTORY_DAYS * 86_400_000;
    const ids = new Set(favorites.map((f) => f.placeId));
    for (const e of likeHistory) if (e.likedAt >= since) ids.add(e.placeId);
    return ids;
  };
  const [hiddenFavorites, setHiddenFavorites] = useState<ReadonlySet<string>>(favoriteIdsNow);
  const [deckSource, setDeckSource] = useState(search.stores);
  if (search.stores !== deckSource) {
    setDeckSource(search.stores);
    setHiddenFavorites(favoriteIdsNow());
  }

  // 条件(距離・予算)や探す場所が変わったら、スワイプ済みの店を除いて山を作り直す。
  const placeKey = searchCoords ? `${searchCoords.lat},${searchCoords.lng}` : "";
  const conditionKey = `${radiusM}:${maxPriceTier}:${placeKey}`;
  const [appliedKey, setAppliedKey] = useState(conditionKey);
  if (conditionKey !== appliedKey) {
    // 距離が変わると探し直しの読み込み画面になるので、条件シートは閉じておく。
    if (conditionKey.split(":")[0] !== appliedKey.split(":")[0]) setConditionsOpen(false);
    setAppliedKey(conditionKey);
    setExcluded(swiped);
    setHiddenFavorites(favoriteIdsNow());
    setIdx(0);
    setPhase("lap1");
  }

  // 1周目の並び: 営業中を先に(シャッフル)、まもなく開店の店をあとに。
  // 価格が分からない店(priceTier なし)は予算に関係なく残す。
  const lap1List = useMemo(
    () =>
      orderForDeck(
        search.stores.filter(
          (s) =>
            !excluded.has(s.placeId) &&
            !hiddenFavorites.has(s.placeId) &&
            (maxPriceTier === null || s.priceTier === null || s.priceTier <= maxPriceTier),
        ),
      ),
    [search.stores, excluded, hiddenFavorites, maxPriceTier],
  );
  const currentList = phase === "lap2" ? lap2List : lap1List;

  // Freeze "is this a returning visitor" the first time we know it, so later
  // markSeen() calls can't flip this mid-flow.
  const [isReturningVisitor, setIsReturningVisitor] = useState<boolean | null>(null);
  if (isReturningVisitor === null && onboardingSeen !== undefined) {
    setIsReturningVisitor(onboardingSeen);
  }

  const [stage, setStage] = useState<Stage>("location");
  if (stage === "location" && locationStatus === "granted") {
    setStage(isReturningVisitor ? "app" : "choice");
  }

  if (isReturningVisitor === null) {
    return <div className={FRAME_CLASS} />;
  }

  if (stage === "location") {
    return (
      <LocationPermission
        status={locationStatus}
        onRequest={request}
        autoStart={isReturningVisitor}
      />
    );
  }

  if (stage === "choice") {
    return (
      <OnboardingChoice
        onChoose={(wantsTutorial) => {
          markSeen();
          setShowTutorial(wantsTutorial);
          setStage("app");
        }}
      />
    );
  }

  const openSettings = () => setTab("profile");
  // 1段階広げて探し直す。最大(5km)なら設定画面で条件を変えてもらう。
  const seeMore = nextRadius ? () => setRadiusOverride(nextRadius) : openSettings;
  const seeMoreLabel = nextRadius ? "もっとお店を見てみよう" : "条件を変える";

  // プロフィールタブは検索の状態に関係なく出す(距離を変えて探し直している間も編集を続けられるように)。
  if (tab === "profile") {
    return (
      <div className={FRAME_CLASS}>
        <SettingsPanel
          onShowTutorial={() => {
            setTab("swipe");
            setShowTutorial(true);
          }}
          onSearch={() => setTab("swipe")}
        />
        <BottomTabBar tab={tab} favCount={favorites.length} onChange={setTab} />
      </div>
    );
  }

  if (search.status === "error") {
    return (
      <CenteredMessage
        title="読み込めませんでした"
        actionLabel="再試行"
        onAction={search.retry}
        secondaryLabel="条件を変える"
        onSecondary={openSettings}
      />
    );
  }

  if (search.status !== "success") {
    return <CenteredMessage title="お店を探しています…" />;
  }

  // 半径1.5kmで0件なら、サーバーが3kmまで自動で広げている。それでも1件もなかった。
  if (search.stores.length === 0) {
    return (
      <CenteredMessage
        title="近くに営業中のお店が見つかりませんでした"
        body={
          nextRadius
            ? "距離を広げるか、時間をおいてもう一度お試しください。"
            : "半径5kmまで探しました。時間をおいてもう一度お試しください。"
        }
        actionLabel={seeMoreLabel}
        onAction={seeMore}
      />
    );
  }

  // 条件に合う店が1件もない(全部スワイプ済み・予算外)なら、そのまま「以上です」へ。
  if (phase === "lap1" && lap1List.length === 0) {
    setPhase("done");
  }

  // ST-5: 1周目を出し切ったら、1回だけパスされた店で2周目の山を作る。
  // 山が0件なら確認を出さずそのまま「以上です」。
  if (phase === "lap1" && lap1List.length > 0 && idx >= lap1List.length) {
    // パスしたあとに(別の回などで)いいねした店は、もう「食べたい」にあるので出さない。
    const liked = favoriteIdsNow();
    const pile = lap1List.filter((s) => getPassCount(s.placeId) === 1 && !liked.has(s.placeId));
    setLap2List(pile);
    setIdx(0);
    setPhase(pile.length === 0 ? "done" : "confirm");
  }
  if (phase === "lap2" && idx >= lap2List.length) {
    setIdx(0);
    setPhase("done");
  }

  function markSwiped(placeId: string) {
    setSwiped((prev) => new Set(prev).add(placeId));
  }

  function handlePass(placeId: string) {
    recordPass(placeId);
    markSwiped(placeId);
  }

  // 右スワイプは「食べたい」(いいね履歴)に入るだけ。「自分」へは見比べてから自分で入れる。
  function handleLike(placeId: string) {
    recordLike(placeId);
    markSwiped(placeId);
  }

  function handleAddMany(placeIds: string[]) {
    placeIds.forEach((placeId) => addFavorite(placeId));
  }

  return (
    <div ref={frameRef} className={FRAME_CLASS}>
      {tab === "fav" ? (
        <FavListTab
          favorites={favorites}
          stores={search.stores}
          coords={searchCoords}
          likeHistory={likeHistory}
          onRemove={removeFavorite}
          onToggleFavorite={toggleFavorite}
          onAddMany={handleAddMany}
          onOpenSettings={openSettings}
        />
      ) : (
        <>
          <Header
            locationStatus={locationStatus}
            radiusM={searchedRadius}
            maxPriceTier={maxPriceTier}
            onOpenConditions={() => setConditionsOpen(true)}
          />

          {phase === "confirm" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
              <h2 className="text-lg font-bold text-text-primary">もう一度見ますか？</h2>
              <p className="text-sm text-text-secondary">
                さっきパスした{lap2List.length}件を、もう一度だけ出します。
              </p>
              <div className="mt-4 flex w-full max-w-[260px] flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setPhase("lap2")}
                  className="h-12 rounded-full bg-accent text-sm font-bold text-text-primary"
                >
                  見る
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("done")}
                  className="h-12 rounded-full border border-card-border text-sm font-bold text-text-primary"
                >
                  見ない
                </button>
              </div>
            </div>
          ) : phase === "done" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
              <h2 className="text-lg font-bold text-text-primary">条件に合う近くの店は以上です</h2>
              <p className="text-sm text-text-secondary">
                {nextRadius
                  ? `半径${nextRadius / 1000}kmまで広げて、ほかのお店も見てみよう`
                  : "半径5kmまで探しました。予算などの条件を変えると、ほかのお店も見つかるかもしれません"}
              </p>
              <div className="mt-4 flex w-full max-w-[260px] flex-col gap-3">
                <button
                  type="button"
                  onClick={seeMore}
                  className="h-12 rounded-full bg-accent text-sm font-bold text-text-primary"
                >
                  {seeMoreLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("fav")}
                  className="h-12 rounded-full border border-card-border text-sm font-bold text-text-primary"
                >
                  食べたいリストを見る
                </button>
              </div>
            </div>
          ) : (
            <SwipeTab
              stores={currentList}
              idx={idx}
              isRelapse={phase === "lap2"}
              onAdvance={() => setIdx((i) => i + 1)}
              onLike={handleLike}
              onPass={handlePass}
            />
          )}
        </>
      )}

      <BottomTabBar tab={tab} favCount={favorites.length} onChange={setTab} />

      {conditionsOpen && tab === "swipe" && (
        <ConditionsSheet radiusValue={searchedRadius} onClose={() => setConditionsOpen(false)} />
      )}

      {showTutorial && (
        <TutorialOverlay
          containerRef={frameRef}
          onComplete={() => {
            setShowTutorial(false);
            // オーバーレイを閉じるとフォーカスが失われる(要素ごと消えるため)ので、
            // キーボード操作を続けられるようカードにフォーカスを戻す(8.2)。
            frameRef.current
              ?.querySelector<HTMLElement>('[tabindex="0"]')
              ?.focus({ preventScroll: true });
          }}
        />
      )}
    </div>
  );
}

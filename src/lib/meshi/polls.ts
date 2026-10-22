import { createClient } from "@/lib/supabase/client";

/** 投票の候補は2〜6軒(supabase/schema.sql の polls と同じ決まり)。 */
export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;
export const POLL_TITLE_MAX = 40;
export const DEFAULT_POLL_TITLE = "どこ食べに行く？";

export interface PollSummary {
  id: string;
  title: string;
  createdAt: number;
}

export interface Poll {
  id: string;
  title: string;
  placeIds: string[];
  createdAt: number;
  closesAt: number;
  closedAt: number | null;
  isOpen: boolean;
  isOwner: boolean;
  /** 決まった店(まだなら null) */
  winnerPlaceId: string | null;
  /** 票で決まったか、並んでルーレットで決まったか */
  decidedBy: "votes" | "roulette" | null;
  /** 1位が並んだ店(決め方を作った人が選ぶまで、またはルーレットの対象) */
  tiedPlaceIds: string[] | null;
  /** これが決選投票なら、元の投票 */
  parentPollId: string | null;
  /** 決選投票を作ったなら、その投票 */
  runoffPollId: string | null;
}

export class NotLoggedInError extends Error {}

/** 投票を作って、その ID を返す。ログインしていないと NotLoggedInError。 */
export async function createPoll(title: string, placeIds: string[]): Promise<string> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new NotLoggedInError();
  const { data, error } = await supabase
    .from("polls")
    .insert({ title: title.trim() || DEFAULT_POLL_TITLE, place_ids: placeIds })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** 自分が作った、まだ投票できる投票(新しい順)。ログインしていなければ空。 */
export async function listMyOpenPolls(): Promise<PollSummary[]> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("polls")
    .select("id, title, created_at")
    .is("closed_at", null)
    .gt("closes_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    title: p.title as string,
    createdAt: Date.parse(p.created_at as string),
  }));
}

/** 投票ページ用: ID を知っていれば、ログインなしでもその1件だけ読める(get_poll)。 */
export async function getPoll(id: string): Promise<Poll | null> {
  const { data, error } = await createClient().rpc("get_poll", { poll_id: id });
  if (error) throw error;
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) return null;
  return {
    id: row.id as string,
    title: row.title as string,
    placeIds: row.place_ids as string[],
    createdAt: Date.parse(row.created_at as string),
    closesAt: Date.parse(row.closes_at as string),
    closedAt: row.closed_at ? Date.parse(row.closed_at as string) : null,
    isOpen: row.is_open as boolean,
    isOwner: row.is_owner as boolean,
    winnerPlaceId: (row.winner_place_id as string | null) ?? null,
    decidedBy: (row.decided_by as "votes" | "roulette" | null) ?? null,
    tiedPlaceIds: (row.tied_place_ids as string[] | null) ?? null,
    parentPollId: (row.parent_poll_id as string | null) ?? null,
    runoffPollId: (row.runoff_poll_id as string | null) ?? null,
  };
}

export function pollUrl(id: string): string {
  return `${window.location.origin}/poll/${id}`;
}

// ── 投票する人(ログインなしでも投票できる) ──

const VOTER_KEY = "meshi:voterKey";
const VOTER_NAME = "meshi:voterName";
export const VOTER_NAME_MAX = 20;

/** この端末の投票者ID。同じ端末からならやり直しが上書きになる。 */
export function voterKey(): string {
  try {
    const saved = window.localStorage.getItem(VOTER_KEY);
    if (saved) return saved;
    const key = crypto.randomUUID();
    window.localStorage.setItem(VOTER_KEY, key);
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function savedVoterName(): string {
  try {
    return window.localStorage.getItem(VOTER_NAME) ?? "";
  } catch {
    return "";
  }
}

export function saveVoterName(name: string) {
  try {
    window.localStorage.setItem(VOTER_NAME, name);
  } catch {
    // 覚えられなくても、次に聞き直すだけ
  }
}

/** 候補ぜんぶへの答え(右=行きたい true / 左=パス false)をまとめて送る。 */
export async function castVotes(
  pollId: string,
  name: string,
  answers: Record<string, boolean>,
): Promise<void> {
  const { error } = await createClient().rpc("cast_votes", {
    poll_id: pollId,
    voter_key: voterKey(),
    voter_name: name,
    votes: Object.entries(answers).map(([place_id, wants]) => ({ place_id, wants })),
  });
  if (error) throw error;
}

export interface PollResults {
  /** この端末(voter_key)でもう投票したか */
  hasVoted: boolean;
  voters: number;
  /** 候補ごとの「行きたい」と答えた人の名前 */
  places: { placeId: string; names: string[] }[];
}

/** 結果。まだ投票していない人(作った人以外)には null(先に見てつられないように)。 */
export async function getPollResults(pollId: string): Promise<PollResults | null> {
  const { data, error } = await createClient().rpc("get_poll_results", {
    poll_id: pollId,
    voter_key: voterKey(),
  });
  if (error) throw error;
  if (!data) return null;
  const raw = data as {
    has_voted: boolean;
    voters: number;
    places: { place_id: string; names: string[] }[];
  };
  return {
    hasVoted: raw.has_voted,
    voters: raw.voters,
    places: raw.places.map((p) => ({ placeId: p.place_id, names: p.names })),
  };
}

// ── 投票を終えて1軒に決める ──

/** 作った人が「投票を終わる」。1位が並んだら、決め方を選ぶまで待ちになる。 */
export async function closePoll(pollId: string): Promise<void> {
  const { error } = await createClient().rpc("close_poll", { poll_id: pollId });
  if (error) throw error;
}

/** 並んだときの決め方。決選投票なら新しい投票の ID を返す。 */
export async function resolveTie(
  pollId: string,
  method: "roulette" | "runoff",
): Promise<string | null> {
  const { data, error } = await createClient().rpc("resolve_tie", {
    poll_id: pollId,
    method,
  });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** 3日たって自動で終わった投票を決める(誰が開いても同じ結果になる)。 */
export async function finalizeIfExpired(pollId: string): Promise<void> {
  const { error } = await createClient().rpc("finalize_if_expired", { poll_id: pollId });
  if (error) throw error;
}

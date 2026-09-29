import type { HeadToHead, MatchHistoryPage } from "@/server/services/statsService";

/** JSON-vorm van een server-type: Date wordt een ISO-string. */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

/** Response van GET /api/duos/[id]/matches. */
export type MatchHistoryResponse = Serialized<MatchHistoryPage>;
export type MatchHistoryItem = MatchHistoryResponse["entries"][number];

/** Response van GET /api/duos/[id]/head-to-head/[otherId]. */
export type HeadToHeadResponse = Serialized<HeadToHead>;
export type HeadToHeadMeetingItem = HeadToHeadResponse["meetings"][number];

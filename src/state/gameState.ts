import { create } from "zustand";

export type MissionStatus = "playing" | "failed" | "complete";

export type ChaseOutcome = "win" | "lose";

export type ActivityTag = "collect" | "chase" | "stealth" | "defense";

export interface ActivityResult {
  index: number;
  tag: ActivityTag;
  success: boolean;
  points: number;
}

export interface DinoStatsView {
  speed: number;
  toughness: number;
  power: number;
  senses: number;
}

export interface MissionState {
  trackingPercent: number; // 0..1
  scentCollected: number;
  scentTotal: number;
  missionStatus: MissionStatus;
  dinoId: string;
  dinoName: string;
  era: string;
  region: string;
  dinoStats: DinoStatsView;
  rank: number;

  activityResults: ActivityResult[];
  predatorPointsEarned: number;

  /** Persisted-aggregate predator points across all attempts of this dino. */
  totalPredatorPoints: number;
  /** Best completion% on this mission across all attempts (0..1). */
  bestMissionCompletion: number;
  /** Best single-run points on this mission. */
  bestMissionPoints: number;
  /** True if the run just stored was a new completion-% record. */
  newBestCompletion: boolean;
  /** True if the run just stored was a new points record. */
  newBestPoints: boolean;

  chaseActive: boolean;
  chasePercent: number; // 0..1 timer remaining
  chaseResult: ChaseOutcome | null;
  chaseResultFlashUntil: number;

  setTrackingPercent: (v: number) => void;
  setScentProgress: (collected: number, total: number) => void;
  setStatus: (s: MissionStatus) => void;
  setDino: (info: {
    id: string;
    name: string;
    era: string;
    region: string;
    stats: DinoStatsView;
    rank: number;
  }) => void;
  startChase: () => void;
  setChasePercent: (v: number) => void;
  endChase: (result: ChaseOutcome, flashUntil: number) => void;
  recordActivity: (r: ActivityResult) => void;
  setPersistedTotals: (info: {
    totalPredatorPoints: number;
    bestMissionCompletion: number;
    bestMissionPoints: number;
  }) => void;
  setNewBests: (info: { newBestCompletion: boolean; newBestPoints: boolean }) => void;
  reset: () => void;
}

const initialDinoStats: DinoStatsView = { speed: 0, toughness: 0, power: 0, senses: 0 };

const initial: Omit<
  MissionState,
  | "setTrackingPercent"
  | "setScentProgress"
  | "setStatus"
  | "setDino"
  | "startChase"
  | "setChasePercent"
  | "endChase"
  | "recordActivity"
  | "setPersistedTotals"
  | "setNewBests"
  | "reset"
> = {
  trackingPercent: 1,
  scentCollected: 0,
  scentTotal: 0,
  missionStatus: "playing",
  dinoId: "",
  dinoName: "",
  era: "",
  region: "",
  dinoStats: initialDinoStats,
  rank: 1,
  activityResults: [],
  predatorPointsEarned: 0,
  totalPredatorPoints: 0,
  bestMissionCompletion: 0,
  bestMissionPoints: 0,
  newBestCompletion: false,
  newBestPoints: false,
  chaseActive: false,
  chasePercent: 1,
  chaseResult: null,
  chaseResultFlashUntil: 0,
};

export const useGameState = create<MissionState>((set) => ({
  ...initial,
  setTrackingPercent: (v) => set({ trackingPercent: Math.max(0, Math.min(1, v)) }),
  setScentProgress: (collected, total) => set({ scentCollected: collected, scentTotal: total }),
  setStatus: (s) => set({ missionStatus: s }),
  setDino: (info) =>
    set({
      dinoId: info.id,
      dinoName: info.name,
      era: info.era,
      region: info.region,
      dinoStats: info.stats,
      rank: info.rank,
    }),
  startChase: () => set({ chaseActive: true, chasePercent: 1, chaseResult: null }),
  setChasePercent: (v) => set({ chasePercent: Math.max(0, Math.min(1, v)) }),
  endChase: (result, flashUntil) =>
    set({ chaseActive: false, chaseResult: result, chaseResultFlashUntil: flashUntil }),
  recordActivity: (r) =>
    set((s) => ({
      activityResults: [...s.activityResults, r],
      predatorPointsEarned: s.predatorPointsEarned + r.points,
    })),
  setPersistedTotals: (info) =>
    set({
      totalPredatorPoints: info.totalPredatorPoints,
      bestMissionCompletion: info.bestMissionCompletion,
      bestMissionPoints: info.bestMissionPoints,
    }),
  setNewBests: (info) =>
    set({ newBestCompletion: info.newBestCompletion, newBestPoints: info.newBestPoints }),
  reset: () => set({ ...initial, activityResults: [] }),
}));

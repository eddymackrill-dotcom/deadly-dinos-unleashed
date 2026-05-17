import { create } from "zustand";
import type { NodeResult, ScentNodeType } from "../levels/ScentSequence";

export type MissionStatus = "playing" | "failed" | "complete";

export type ChaseOutcome = "win" | "lose";

export interface DinoStatsView {
  speed: number;
  toughness: number;
  power: number;
  senses: number;
}

export interface ScentResultView {
  index: number;
  type: ScentNodeType;
  outcome: ChaseOutcome;
  points: number;
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

  /** Single source of truth — pushed wholesale from ScentSequence each time it changes. */
  scentResults: ScentResultView[];
  predatorPointsEarned: number;

  totalPredatorPoints: number;
  bestMissionCompletion: number;
  bestMissionPoints: number;
  newBestCompletion: boolean;
  newBestPoints: boolean;

  chaseActive: boolean;
  chasePercent: number;
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
  /** Replace the entire results array from the sequence. */
  setScentResults: (results: NodeResult[]) => void;
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
  | "setScentResults"
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
  scentResults: [],
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
  setScentResults: (results) => {
    const points = results.reduce((s, r) => s + r.points, 0);
    set({ scentResults: results.map((r) => ({ ...r })), predatorPointsEarned: points });
  },
  setPersistedTotals: (info) =>
    set({
      totalPredatorPoints: info.totalPredatorPoints,
      bestMissionCompletion: info.bestMissionCompletion,
      bestMissionPoints: info.bestMissionPoints,
    }),
  setNewBests: (info) =>
    set({ newBestCompletion: info.newBestCompletion, newBestPoints: info.newBestPoints }),
  reset: () => set({ ...initial, scentResults: [] }),
}));

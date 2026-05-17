import { create } from "zustand";

export type MissionStatus = "playing" | "failed" | "complete";

export type ChaseOutcome = "win" | "lose";

export interface MissionState {
  trackingPercent: number; // 0..1
  scentCollected: number;
  scentTotal: number;
  missionStatus: MissionStatus;
  dinoId: string;
  dinoName: string;
  era: string;
  region: string;

  chaseActive: boolean;
  chasePercent: number; // 0..1 timer remaining
  chaseResult: ChaseOutcome | null;
  chaseResultFlashUntil: number; // performance.now() ms; CAUGHT! / ESCAPED! still-frame end time

  setTrackingPercent: (v: number) => void;
  setScentProgress: (collected: number, total: number) => void;
  setStatus: (s: MissionStatus) => void;
  setDino: (info: { id: string; name: string; era: string; region: string }) => void;
  startChase: () => void;
  setChasePercent: (v: number) => void;
  endChase: (result: ChaseOutcome, flashUntil: number) => void;
  reset: () => void;
}

const initial: Pick<
  MissionState,
  | "trackingPercent"
  | "scentCollected"
  | "scentTotal"
  | "missionStatus"
  | "dinoId"
  | "dinoName"
  | "era"
  | "region"
  | "chaseActive"
  | "chasePercent"
  | "chaseResult"
  | "chaseResultFlashUntil"
> = {
  trackingPercent: 1,
  scentCollected: 0,
  scentTotal: 0,
  missionStatus: "playing",
  dinoId: "",
  dinoName: "",
  era: "",
  region: "",
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
    set({ dinoId: info.id, dinoName: info.name, era: info.era, region: info.region }),
  startChase: () => set({ chaseActive: true, chasePercent: 1, chaseResult: null }),
  setChasePercent: (v) => set({ chasePercent: Math.max(0, Math.min(1, v)) }),
  endChase: (result, flashUntil) =>
    set({ chaseActive: false, chaseResult: result, chaseResultFlashUntil: flashUntil }),
  reset: () => set({ ...initial }),
}));

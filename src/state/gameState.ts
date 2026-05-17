import { create } from "zustand";

export type MissionStatus = "playing" | "failed" | "complete";

export interface MissionState {
  trackingPercent: number; // 0..1
  scentCollected: number;
  scentTotal: number;
  missionStatus: MissionStatus;
  dinoId: string;
  dinoName: string;
  era: string;
  region: string;

  setTrackingPercent: (v: number) => void;
  setScentProgress: (collected: number, total: number) => void;
  setStatus: (s: MissionStatus) => void;
  setDino: (info: { id: string; name: string; era: string; region: string }) => void;
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
> = {
  trackingPercent: 1,
  scentCollected: 0,
  scentTotal: 0,
  missionStatus: "playing",
  dinoId: "",
  dinoName: "",
  era: "",
  region: "",
};

export const useGameState = create<MissionState>((set) => ({
  ...initial,
  setTrackingPercent: (v) => set({ trackingPercent: Math.max(0, Math.min(1, v)) }),
  setScentProgress: (collected, total) => set({ scentCollected: collected, scentTotal: total }),
  setStatus: (s) => set({ missionStatus: s }),
  setDino: (info) =>
    set({ dinoId: info.id, dinoName: info.name, era: info.era, region: info.region }),
  reset: () => set({ ...initial }),
}));

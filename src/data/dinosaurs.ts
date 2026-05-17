export interface DinoStats {
  speed: number;
  toughness: number;
  power: number;
  senses: number;
}

export interface DinoData {
  id: string;
  name: string;
  era: string;
  region: string;
  stats: DinoStats;
  /** Base seconds for the tracking bar before sensesStat / power-card modifiers. */
  baseTrackingDuration: number;
}

export const EORAPTOR: DinoData = {
  id: "eoraptor",
  name: "Eoraptor",
  era: "Late Triassic",
  region: "Argentina, 230 mya",
  stats: { speed: 6, toughness: 3, power: 2, senses: 5 },
  baseTrackingDuration: 25,
};

export function trackingDuration(stats: DinoStats, base: number, moreTimeCard = false): number {
  const sensesMult = 1 + stats.senses * 0.05;
  const cardMult = moreTimeCard ? 1.5 : 1;
  return base * sensesMult * cardMult;
}

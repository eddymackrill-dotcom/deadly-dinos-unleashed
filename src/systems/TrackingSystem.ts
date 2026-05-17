import { useGameState } from "../state/gameState";

/**
 * Drains a 0..1 tracking value at `1 / durationSeconds` per second.
 * Refills to 1 on `refill()`; triggers `onFail` once when it hits 0.
 */
export class TrackingSystem {
  private percent = 1;
  private failed = false;

  constructor(
    private durationSeconds: number,
    private onFail: () => void,
  ) {
    useGameState.getState().setTrackingPercent(this.percent);
  }

  tick(dt: number) {
    if (this.failed) return;
    this.percent = Math.max(0, this.percent - dt / this.durationSeconds);
    useGameState.getState().setTrackingPercent(this.percent);
    if (this.percent <= 0) {
      this.failed = true;
      this.onFail();
    }
  }

  refill() {
    if (this.failed) return;
    this.percent = 1;
    useGameState.getState().setTrackingPercent(this.percent);
  }

  setDuration(s: number) {
    this.durationSeconds = s;
  }

  get isFailed() {
    return this.failed;
  }
}

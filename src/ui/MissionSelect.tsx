import { useMemo } from "react";
import { DINO_ORDER, DINOS, type DinoId, type DinoStats } from "../data/dinosaurs";
import { LEVELS } from "../data/levels";
import { BIOMES } from "../data/biomes";
import { getMissionSave } from "../progression/Save";

const STAT_MAX = 12;
const UNLOCK_THRESHOLD = 0.5; // previous mission must reach 50% completion

const STAT_ROWS: Array<{ key: keyof DinoStats; label: string; tint: string }> = [
  { key: "speed", label: "SPD", tint: "#62d99a" },
  { key: "toughness", label: "TUF", tint: "#f6b663" },
  { key: "power", label: "POW", tint: "#ef6f7e" },
  { key: "senses", label: "SEN", tint: "#9aa9ff" },
];

function MiniStat({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-display text-[10px] tracking-wider text-white/70 w-7">{label}</span>
      <div className="relative h-1.5 flex-1 bg-black/50 rounded-full overflow-hidden">
        <div className="h-full" style={{ width: `${(value / STAT_MAX) * 100}%`, background: tint }} />
      </div>
      <span className="font-ui text-[10px] tabular-nums text-white/60 w-4 text-right">{value}</span>
    </div>
  );
}

interface CardData {
  id: DinoId;
  unlocked: boolean;
  completion: number;
  points: number;
}

function useCards(): CardData[] {
  return useMemo(() => {
    const cards: CardData[] = [];
    let prevCompletion = 1; // first dino is always unlocked
    for (const id of DINO_ORDER) {
      const save = getMissionSave(id, LEVELS[id].id);
      const unlocked = prevCompletion >= UNLOCK_THRESHOLD;
      cards.push({ id, unlocked, completion: save.completion, points: save.bestPoints });
      prevCompletion = save.completion;
    }
    return cards;
  }, []);
}

function MissionCard({ data, index, onSelect }: { data: CardData; index: number; onSelect: (id: DinoId) => void }) {
  const dino = DINOS[data.id];
  const biome = BIOMES[dino.biomeId];
  const [skyTop, skyBottom] = biome.skyGradient;

  return (
    <div className="relative w-[260px] rounded-2xl overflow-hidden border border-white/15 bg-stone-950/80 shadow-xl">
      {/* "Art": the biome sky gradient with the dino name. Rendered previews → M5/M6. */}
      <div
        className="h-28 flex items-end justify-center pb-2"
        style={{ background: `linear-gradient(180deg, ${skyTop}, ${skyBottom})` }}
      >
        <div className="font-display text-3xl tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] title-glitch">
          {dino.displayName}
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div className="font-ui text-[10px] tracking-widest text-white/55 uppercase">
          {dino.era} · {dino.region}
        </div>

        <div className="flex flex-col gap-1">
          {STAT_ROWS.map((s) => (
            <MiniStat key={s.key} label={s.label} value={dino.stats[s.key]} tint={s.tint} />
          ))}
        </div>

        <div className="mt-1 rounded-lg bg-black/30 px-2 py-1.5">
          <div className="font-display text-sm tracking-wide text-amber-200">{dino.animalPower.displayName}</div>
          <div className="font-ui text-[10px] leading-snug text-white/65">{dino.animalPower.description}</div>
        </div>

        <div className="flex items-center justify-between font-ui text-[10px] text-white/60">
          <span>{Math.round(data.completion * 100)}% complete</span>
          <span className="tabular-nums">{data.points} pts</span>
        </div>

        <button
          disabled={!data.unlocked}
          onClick={() => onSelect(data.id)}
          className={`mt-1 py-2 rounded-lg font-display tracking-widest text-sm transition-colors ${
            data.unlocked
              ? "bg-rose-500/25 border border-rose-300/40 text-rose-100 hover:bg-rose-500/40"
              : "bg-white/5 border border-white/10 text-white/30 cursor-not-allowed"
          }`}
        >
          {data.unlocked ? "SELECT" : "LOCKED"}
        </button>
      </div>

      {!data.unlocked && (
        <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-3xl mb-1" aria-hidden>
              🔒
            </div>
            <div className="font-ui text-[11px] text-white/75 leading-snug">
              LOCKED — reach {Math.round(UNLOCK_THRESHOLD * 100)}% on mission {index} to unlock
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MissionSelect({ onSelect }: { onSelect: (id: DinoId) => void }) {
  const cards = useCards();
  return (
    <div className="absolute inset-0 overflow-auto bg-[#0b2a2a] pointer-events-auto">
      {/* BBC-style grunge title bar. */}
      <div className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg">
        <div className="font-display text-4xl tracking-wider text-stone-900 title-glitch">
          CHOOSE YOUR PREDATOR
        </div>
        <div className="font-ui text-xs tracking-widest text-stone-800/80">
          DEADLY DINOS UNLEASHED · MISSION SELECT
        </div>
      </div>

      <div className="flex flex-wrap items-stretch justify-center gap-5 p-6">
        {cards.map((c, i) => (
          <MissionCard key={c.id} data={c} index={i} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

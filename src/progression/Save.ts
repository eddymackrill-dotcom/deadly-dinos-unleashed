const STORAGE_KEY = "deadly-dinos:v1";
const SAVE_VERSION = 1;

export interface MissionSave {
  completion: number; // best 0..1
  bestPoints: number;
  attempts: number;
  hiddenSecretsFound: number;
  /** Stable IDs of hidden secrets the player has discovered. Used to prevent
   *  respawn on replay. The count is also reflected in hiddenSecretsFound for
   *  back-compat with old reads. */
  foundSecretIds: string[];
}

export interface DinoSave {
  predatorPoints: number;
  missions: Record<string, MissionSave>;
  unlockedStyles: string[];
}

export interface SaveData {
  version: number;
  dinos: Record<string, DinoSave>;
}

function emptySave(): SaveData {
  return { version: SAVE_VERSION, dinos: {} };
}

function emptyDinoSave(): DinoSave {
  return { predatorPoints: 0, missions: {}, unlockedStyles: [] };
}

function emptyMissionSave(): MissionSave {
  return {
    completion: 0,
    bestPoints: 0,
    attempts: 0,
    hiddenSecretsFound: 0,
    foundSecretIds: [],
  };
}

function normalizeMissionSave(raw: Partial<MissionSave> | undefined): MissionSave {
  if (!raw) return emptyMissionSave();
  return {
    completion: raw.completion ?? 0,
    bestPoints: raw.bestPoints ?? 0,
    attempts: raw.attempts ?? 0,
    hiddenSecretsFound: raw.hiddenSecretsFound ?? 0,
    foundSecretIds: Array.isArray(raw.foundSecretIds) ? [...raw.foundSecretIds] : [],
  };
}

function readRaw(): SaveData {
  if (typeof window === "undefined" || !window.localStorage) return emptySave();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptySave();
    if (parsed.version !== SAVE_VERSION) return emptySave();
    if (!parsed.dinos || typeof parsed.dinos !== "object") return emptySave();
    return parsed as SaveData;
  } catch {
    return emptySave();
  }
}

function writeRaw(data: SaveData) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota or privacy mode — silently ignore */
  }
}

export function loadSave(): SaveData {
  return readRaw();
}

export function getDinoSave(dinoId: string): DinoSave {
  const save = readRaw();
  return save.dinos[dinoId] ?? emptyDinoSave();
}

export function getMissionSave(dinoId: string, missionId: string): MissionSave {
  const dino = getDinoSave(dinoId);
  return normalizeMissionSave(dino.missions[missionId]);
}

export interface MissionResultInput {
  dinoId: string;
  missionId: string;
  completion: number; // 0..1
  pointsEarned: number;
  hiddenSecretsFound?: number;
  /** Secret IDs discovered during this attempt. Merged into the persisted set. */
  foundSecretIds?: string[];
}

export interface SaveCommitResult {
  isNewBestCompletion: boolean;
  isNewBestPoints: boolean;
  totalPredatorPoints: number;
  mission: MissionSave;
}

/** Apply a mission result to the save. Keeps the best completion% and best
 *  points seen so far, accumulates total predator points across attempts. */
export function commitMissionResult(input: MissionResultInput): SaveCommitResult {
  const save = readRaw();
  const dino = save.dinos[input.dinoId] ?? emptyDinoSave();
  const mission = normalizeMissionSave(dino.missions[input.missionId]);

  const isNewBestCompletion = input.completion > mission.completion;
  const isNewBestPoints = input.pointsEarned > mission.bestPoints;

  const mergedSecrets = new Set(mission.foundSecretIds);
  for (const id of input.foundSecretIds ?? []) mergedSecrets.add(id);

  const updatedMission: MissionSave = {
    completion: Math.max(mission.completion, input.completion),
    bestPoints: Math.max(mission.bestPoints, input.pointsEarned),
    attempts: mission.attempts + 1,
    hiddenSecretsFound: Math.max(
      mission.hiddenSecretsFound,
      input.hiddenSecretsFound ?? mergedSecrets.size,
    ),
    foundSecretIds: Array.from(mergedSecrets),
  };

  const updatedDino: DinoSave = {
    ...dino,
    predatorPoints: dino.predatorPoints + input.pointsEarned,
    missions: { ...dino.missions, [input.missionId]: updatedMission },
  };

  const updatedSave: SaveData = {
    version: SAVE_VERSION,
    dinos: { ...save.dinos, [input.dinoId]: updatedDino },
  };

  writeRaw(updatedSave);

  return {
    isNewBestCompletion,
    isNewBestPoints,
    totalPredatorPoints: updatedDino.predatorPoints,
    mission: updatedMission,
  };
}

/** Test/dev helper: clear all saved state. Not wired to UI in M2. */
export function wipeSave() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

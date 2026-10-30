export type Terrain = "wall" | "stone" | "soil" | "water" | "wood";
export type FeatureType =
  | null
  | "overgrowth"
  | "console-temp"
  | "console-light"
  | "console-humidity"
  | "heart"
  | "cot"
  | "tree"
  | { kind: "journal"; index: number }
  | { kind: "pod"; speciesId: string; taken: boolean };

export interface PlantState {
  speciesId: string;
  growth: number; // 0-100
  water: number; // 0-2
  mature: boolean;
  thirstyFlag?: boolean;
}

export interface Tile {
  x: number;
  y: number;
  terrain: Terrain;
  feature: FeatureType;
  plant: PlantState | null;
  clearedAt?: number;
}

export const W = 15;
export const H = 11;

export interface SeedPodSpot {
  x: number;
  y: number;
  speciesId: string;
}
export interface JournalSpot {
  x: number;
  y: number;
  index: number;
}

function key(x: number, y: number) {
  return `${x},${y}`;
}

export function buildInitialMap(): {
  tiles: Tile[][];
  totalOvergrowth: number;
  totalSoil: number;
} {
  // base
  const tiles: Tile[][] = [];
  for (let y = 0; y < H; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < W; x++) {
      const border = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      row.push({
        x,
        y,
        terrain: border ? "wall" : "stone",
        feature: null,
        plant: null,
      });
    }
    tiles.push(row);
  }
  const at = (x: number, y: number) => tiles[y][x];

  // pond (blocked water)
  const waters: [number, number][] = [
    [11, 1],
    [12, 1],
    [11, 2],
  ];
  for (const [x, y] of waters) {
    at(x, y).terrain = "water";
    at(x, y).feature = null;
  }

  // wood floor near cot
  const woods: [number, number][] = [
    [1, 8],
    [2, 8],
    [1, 9],
    [2, 9],
  ];
  for (const [x, y] of woods) {
    if (at(x, y).terrain !== "wall") at(x, y).terrain = "wood";
  }

  // soils
  const soils: [number, number][] = [
    [3, 1],
    [6, 1],
    [8, 1],
    [2, 4],
    [6, 4],
    [8, 4],
    [5, 5],
    [9, 5],
    [2, 7],
    [3, 8],
    [6, 8],
    [8, 8],
    [11, 7],
    [12, 7],
  ];
  for (const [x, y] of soils) at(x, y).terrain = "soil";

  // consoles (blocked)
  at(2, 1).feature = "console-temp";
  at(7, 1).feature = "console-light";
  at(12, 8).feature = "console-humidity";

  // heart
  at(7, 5).feature = "heart";

  // cot (walkable)
  at(1, 9).feature = "cot";

  // decorative blocked trees
  const trees: [number, number][] = [
    [1, 1],
    [13, 1],
    [5, 9],
    [9, 9],
  ];
  for (const [x, y] of trees) at(x, y).feature = "tree";

  // overgrowth (blocked until cleared)
  const overgrowth: [number, number][] = [
    [4, 2],
    [5, 3],
    [4, 4],
    [5, 4],
    [9, 3],
    [10, 4],
    [10, 6],
    [6, 6],
    [8, 6],
    [3, 5],
    [7, 3],
    [11, 5],
    [5, 7],
    [9, 8],
  ];
  for (const [x, y] of overgrowth) {
    // never overwrite special features/soils/water
    const t = at(x, y);
    if (
      t.feature === null &&
      t.terrain !== "water" &&
      t.terrain !== "wall" &&
      t.terrain !== "soil"
    ) {
      t.feature = "overgrowth";
    }
  }

  // journals (walkable, on stone/wood)
  const journals: JournalSpot[] = [
    { x: 1, y: 2, index: 0 },
    { x: 2, y: 2, index: 1 },
    { x: 12, y: 3, index: 2 },
    { x: 7, y: 2, index: 3 },
    { x: 13, y: 6, index: 4 },
    { x: 6, y: 9, index: 5 },
  ];
  for (const j of journals) {
    const t = at(j.x, j.y);
    // ensure walkable base
    if (t.terrain === "soil") t.terrain = "stone";
    if (t.feature === "overgrowth") t.feature = null;
    t.feature = { kind: "journal", index: j.index };
  }

  // seed pods (walkable)
  const pods: SeedPodSpot[] = [
    { x: 4, y: 6, speciesId: "sunspire" },
    { x: 11, y: 6, speciesId: "gloomcap" },
    { x: 9, y: 2, speciesId: "skyvine" },
  ];
  for (const p of pods) {
    const t = at(p.x, p.y);
    if (t.terrain === "soil") t.terrain = "stone";
    if (t.feature === "overgrowth") t.feature = null;
    t.feature = { kind: "pod", speciesId: p.speciesId, taken: false };
  }

  const totalOvergrowth = tiles
    .flat()
    .filter((t) => t.feature === "overgrowth").length;
  const totalSoil = tiles.flat().filter((t) => t.terrain === "soil").length;

  return { tiles, totalOvergrowth, totalSoil };
}

export function isBlocked(tile: Tile): boolean {
  if (tile.terrain === "wall" || tile.terrain === "water") return true;
  const f = tile.feature;
  if (f === "overgrowth") return true;
  if (
    f === "console-temp" ||
    f === "console-light" ||
    f === "console-humidity" ||
    f === "heart" ||
    f === "tree"
  )
    return true;
  return false;
}

export function featureLabel(f: FeatureType): string {
  if (!f) return "";
  if (typeof f === "string") return f;
  if (f.kind === "journal") return `journal-${f.index}`;
  if (f.kind === "pod") return `pod-${f.speciesId}`;
  return "";
}

// BFS path for click-to-move
export function findPath(
  tiles: Tile[][],
  from: { x: number; y: number },
  to: { x: number; y: number }
): { x: number; y: number }[] | null {
  if (from.x === to.x && from.y === to.y) return [];
  const h = tiles.length;
  const w = tiles[0].length;
  if (
    to.x < 0 ||
    to.y < 0 ||
    to.x >= w ||
    to.y >= h ||
    isBlocked(tiles[to.y][to.x])
  )
    return null;
  const prev = new Map<string, string>();
  const seen = new Set<string>([key(from.x, from.y)]);
  const q: { x: number; y: number }[] = [{ ...from }];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (q.length) {
    const cur = q.shift()!;
    if (cur.x === to.x && cur.y === to.y) {
      const path: { x: number; y: number }[] = [];
      let c = key(to.x, to.y);
      while (c !== key(from.x, from.y)) {
        const [px, py] = c.split(",").map(Number);
        path.unshift({ x: px, y: py });
        c = prev.get(c)!;
      }
      return path;
    }
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      if (isBlocked(tiles[ny][nx])) continue;
      seen.add(k);
      prev.set(k, key(cur.x, cur.y));
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}

export function climateMatch(
  tempRange: [number, number],
  humRange: [number, number],
  lightRange: [number, number],
  climate: { temp: number; humidity: number; light: number }
): number {
  const axis = (v: number, [a, b]: [number, number]) => {
    if (v >= a && v <= b) return 1;
    const d = v < a ? a - v : v - b;
    // falloff: 50 away => 0.2
    return Math.max(0.15, 1 - d / 42);
  };
  const t = axis(climate.temp, tempRange);
  const h = axis(climate.humidity, humRange);
  const l = axis(climate.light, lightRange);
  return (t + h + l) / 3;
}

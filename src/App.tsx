import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  Sprout,
  Droplets,
  Droplet,
  Thermometer,
  Sun,
  Moon,
  BookOpen,
  BedDouble,
  Heart,
  Sparkles,
  Wind,
  Compass,
  MapPin,
  TreePine,
  Flower2,
  Scissors,
  FlaskConical,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
  Play,
  RotateCcw,
  Eye,
  Package,
  Lightbulb,
  Zap,
  Cloud,
  Star,
  Hammer,
} from "lucide-react";
import { SPECIES, JOURNALS, stageForVitality, speciesById } from "./game/data";
import {
  buildInitialMap,
  isBlocked,
  findPath,
  climateMatch,
  type Tile,
  type PlantState,
} from "./game/map";

/* ---------------------------------- types ---------------------------------- */
interface Toast {
  id: number;
  title: string;
  sub?: string;
  kind: "seed" | "journal" | "success" | "warn" | "info" | "climate";
}
interface Climate {
  temp: number;
  humidity: number;
  light: number;
}
type Tab = "garden" | "climate" | "journal" | "wilds";

const MAX_ENERGY = 100;
const MAX_WATER = 6;
const CLEAR_COST = 15;
const PLANT_COST = 5;
const WATER_COST = 2;

const PRESETS: { name: string; desc: string; c: Climate; icon: string }[] = [
  { name: "Dawn Mist", desc: "cool · wet · dim", c: { temp: 42, humidity: 82, light: 30 }, icon: "mist" },
  { name: "Desert Noon", desc: "hot · dry · blaze", c: { temp: 85, humidity: 20, light: 90 }, icon: "sun" },
  { name: "Deep Shade", desc: "cold · soaked · dark", c: { temp: 25, humidity: 88, light: 15 }, icon: "moon" },
  { name: "Heart Balance", desc: "mild · soft · even", c: { temp: 58, humidity: 62, light: 58 }, icon: "heart" },
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ----------------------------------- App ----------------------------------- */
export default function App() {
  const [screen, setScreen] = useState<"intro" | "game">("intro");
  const [tiles, setTiles] = useState<Tile[][]>(() => buildInitialMap().tiles);
  const [totals] = useState(() => {
    const b = buildInitialMap();
    return { overgrowth: b.totalOvergrowth, soil: b.totalSoil };
  });
  const [player, setPlayer] = useState({ x: 1, y: 8, dir: "down" });
  const [energy, setEnergy] = useState(MAX_ENERGY);
  const [water, setWater] = useState(MAX_WATER);
  const [day, setDay] = useState(1);
  const [seeds, setSeeds] = useState<Record<string, number>>({
    fernwhisper: 3,
    mistorchid: 1,
    sunspire: 0,
    gloomcap: 0,
    skyvine: 0,
    heartbloom: 0,
  });
  const [selectedSeed, setSelectedSeed] = useState("fernwhisper");
  const [climate, setClimate] = useState<Climate>({ temp: 55, humidity: 62, light: 48 });
  const [journalsFound, setJournalsFound] = useState<boolean[]>(Array(6).fill(false));
  const [grownLog, setGrownLog] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tab, setTab] = useState<Tab>("garden");
  const [journalModal, setJournalModal] = useState<number | null>(null);
  const [plantModal, setPlantModal] = useState<{ x: number; y: number } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [victory, setVictory] = useState(false);
  const [victoryOpen, setVictoryOpen] = useState(false);
  const toastId = useRef(1);
  const walkingRef = useRef(false);

  const pushToast = useCallback((title: string, sub?: string, kind: Toast["kind"] = "info") => {
    const id = toastId.current++;
    setToasts((t) => [...t.slice(-4), { id, title, sub, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  /* ------------------------------- derived ------------------------------- */
  const flat = useMemo(() => tiles.flat(), [tiles]);
  const remainingOvergrowth = flat.filter((t) => t.feature === "overgrowth").length;
  const cleared = totals.overgrowth - remainingOvergrowth;
  const matureNow = flat.filter((t) => t.plant?.mature).length;
  const growingNow = flat.filter((t) => t.plant && !t.plant.mature).length;
  const foundCount = journalsFound.filter(Boolean).length;
  const bioEver = new Set(grownLog).size;
  const matureScore = Math.min(grownLog.length, 10) / 10;
  const vitality = Math.round(
    (cleared / Math.max(1, totals.overgrowth)) * 25 +
      matureScore * 45 +
      (foundCount / 6) * 15 +
      (bioEver / 6) * 15
  );
  const stage = stageForVitality(vitality);
  const hasMatureHeart = useMemo(
    () => flat.some((t) => t.plant?.mature && t.plant.speciesId === "heartbloom"),
    [flat]
  );
  const canAwaken = hasMatureHeart && vitality >= 75 && !victory;

  const neighborsOf = useCallback(
    (x: number, y: number) => {
      const pts = [
        { x, y },
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ];
      return pts.filter((p) => p.x >= 0 && p.y >= 0 && p.x < 15 && p.y < 11).map((p) => tiles[p.y][p.x]);
    },
    [tiles]
  );

  /* --------------------------- context action --------------------------- */
  interface Ctx {
    type: string;
    label: string;
    sub: string;
    x?: number;
    y?: number;
    disabled?: string;
  }
  const contextAction: Ctx | null = useMemo(() => {
    const near = neighborsOf(player.x, player.y);
    const adjOver = near.find((t) => t.feature === "overgrowth");
    if (adjOver)
      return {
        type: "clear",
        label: "Cut back overgrowth",
        sub: `Vines at (${adjOver.x}, ${adjOver.y}) · −${CLEAR_COST} energy`,
        x: adjOver.x,
        y: adjOver.y,
        disabled: energy < CLEAR_COST ? `Need ${CLEAR_COST} energy — sleep to restore` : undefined,
      };
    const pod = near.find(
      (t) => typeof t.feature === "object" && t.feature !== null && (t.feature as { kind: string }).kind === "pod" && !(t.feature as { kind: string; taken?: boolean }).taken
    ) as Tile | undefined;
    if (pod) {
      const f = pod.feature as { kind: "pod"; speciesId: string };
      const sp = speciesById(f.speciesId);
      return { type: "pod", label: `Collect ${sp.name} pod`, sub: "+2 seeds · free", x: pod.x, y: pod.y };
    }
    const jour = near.find(
      (t) => typeof t.feature === "object" && t.feature !== null && (t.feature as { kind: string }).kind === "journal"
    ) as Tile | undefined;
    if (jour) {
      const f = jour.feature as { kind: "journal"; index: number };
      if (!journalsFound[f.index])
        return { type: "journal", label: `Read weathered page — “${JOURNALS[f.index].title}”`, sub: "Elara's journal · may hold seeds", x: jour.x, y: jour.y };
    }
    const heartNear = near.some((t) => t.feature === "heart");
    if (heartNear) {
      if (victory) return { type: "heart-calm", label: "Rest at the Heart", sub: "The dome breathes with you" };
      if (canAwaken)
        return { type: "awaken", label: "AWAKEN THE HEART", sub: "Heartbloom open · vitality 75%+ · touch the tree" };
      return {
        type: "heart",
        label: "Inspect the Heart Tree",
        sub: hasMatureHeart
          ? `Vitality ${vitality}% — needs 75% to awaken`
          : "Needs an open Heartbloom + 75% vitality",
      };
    }
    const consoleNear = near.find(
      (t) => t.feature === "console-temp" || t.feature === "console-light" || t.feature === "console-humidity"
    );
    if (consoleNear)
      return { type: "console", label: "Open climate console", sub: "Tune temperature · humidity · light", x: consoleNear.x, y: consoleNear.y };
    const cotNear = near.some((t) => t.feature === "cot");
    if (cotNear) return { type: "sleep", label: `Sleep — begin day ${day + 1}`, sub: "Restores energy · grows watered plants" };
    const waterNear = near.some((t) => t.terrain === "water");
    if (waterNear && water < MAX_WATER)
      return { type: "refill", label: "Refill watering can", sub: "Pond water · cool and green" };
    // plants: mature first
    const mature = near.find((t) => t.plant?.mature);
    if (mature) {
      const sp = speciesById(mature.plant!.speciesId);
      return { type: "harvest", label: `Gather ${sp.name}`, sub: `Yields ${sp.seedYield[0]}–${sp.seedYield[1]} seeds`, x: mature.x, y: mature.y };
    }
    const thirsty = near.find((t) => t.plant && !t.plant.mature && (t.plant.water <= 0 || t.plant.water < 2));
    // only suggest watering if player has water
    if (thirsty && water > 0) {
      const sp = speciesById(thirsty.plant!.speciesId);
      return {
        type: "water",
        label: thirsty.plant!.water <= 0 ? `Water thirsty ${sp.name}` : `Top up ${sp.name}`,
        sub: `−1 can · −${WATER_COST} energy`,
        x: thirsty.x,
        y: thirsty.y,
        disabled: energy < WATER_COST ? "Not enough energy" : undefined,
      };
    }
    if (thirsty && water <= 0)
      return { type: "refill-needed", label: "Can is empty", sub: "Refill at the pond (north-east)" };
    const emptySoil = near.find((t) => t.terrain === "soil" && !t.plant);
    if (emptySoil) {
      const sp = speciesById(selectedSeed);
      const count = seeds[selectedSeed] ?? 0;
      return {
        type: "plant",
        label: count > 0 ? `Plant ${sp.name}` : "No seeds of this kind",
        sub: count > 0 ? `Dark soil · −${PLANT_COST} energy` : "Collect pods or clear vines for seeds",
        x: emptySoil.x,
        y: emptySoil.y,
        disabled: count <= 0 ? "Select another seed in Garden tab" : energy < PLANT_COST ? "Need energy — sleep" : undefined,
      };
    }
    return null;
  }, [neighborsOf, player, energy, water, journalsFound, day, seeds, selectedSeed, vitality, hasMatureHeart, canAwaken, victory, tiles]);

  /* --------------------------------- moves --------------------------------- */
  const tryStep = useCallback(
    (dx: number, dy: number) => {
      if (walkingRef.current) return;
      const nx = player.x + dx;
      const ny = player.y + dy;
      if (nx < 0 || ny < 0 || nx >= 15 || ny >= 11) return;
      const t = tiles[ny][nx];
      if (isBlocked(t)) {
        if (t.feature === "overgrowth")
          pushToast("Tangled vines block the way", "Stand beside them and cut (E)", "warn");
        return;
      }
      const dir = dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up";
      setPlayer({ x: nx, y: ny, dir });
    },
    [player, tiles, pushToast]
  );

  const walkPath = useCallback(
    (path: { x: number; y: number }[]) => {
      if (!path.length || walkingRef.current) return;
      walkingRef.current = true;
      let i = 0;
      const step = () => {
        if (i >= path.length) {
          walkingRef.current = false;
          return;
        }
        const p = path[i];
        setPlayer((prev) => ({
          x: p.x,
          y: p.y,
          dir: p.x > prev.x ? "right" : p.x < prev.x ? "left" : p.y > prev.y ? "down" : "up",
        }));
        i++;
        setTimeout(step, 110);
      };
      step();
    },
    []
  );

  const handleTileClick = (tx: number, ty: number) => {
      const tile = tiles[ty][tx];
      const adj = Math.abs(tile.x - player.x) + Math.abs(tile.y - player.y);
      // overgrowth clicked
      if (tile.feature === "overgrowth") {
        if (adj === 1) doClear(tile.x, tile.y);
        else pushToast("Too tangled from here", "Click a glowing path to walk closer, then cut", "warn");
        return;
      }
      // special interactions when adjacent or standing
      if (adj <= 1) {
        if (typeof tile.feature === "object" && tile.feature !== null) {
          const f = tile.feature as { kind: string; index?: number; speciesId?: string; taken?: boolean };
          if (f.kind === "pod" && !f.taken) {
            doCollect(tile.x, tile.y);
            return;
          }
          if (f.kind === "journal") {
            doRead(f.index!);
            return;
          }
        }
        if (tile.terrain === "soil" && !tile.plant) {
          const c = seeds[selectedSeed] ?? 0;
          if (c > 0) doPlant(tile.x, tile.y, selectedSeed);
          else setPlantModal({ x: tile.x, y: tile.y });
          return;
        }
        if (tile.plant?.mature) {
          doHarvest(tile.x, tile.y);
          return;
        }
        if (tile.plant && !tile.plant.mature && tile.plant.water <= 0 && water > 0) {
          doWater(tile.x, tile.y);
          return;
        }
      }
      if (isBlocked(tile)) {
        if (tile.feature === "heart") pushToast("The Heart Tree", canAwaken ? "Press E to AWAKEN" : "Needs Heartbloom + 75% vitality", "info");
        else if (typeof tile.feature === "string" && tile.feature.startsWith("console")) {
          setTab("climate");
          pushToast("Climate console linked", "Tune the dome from the Climate tab", "climate");
        }
        return;
      }
      const path = findPath(tiles, player, { x: tx, y: ty });
      if (path) walkPath(path);
      else pushToast("No path", "Vines or glass block the way", "warn");
    };

  /* -------------------------------- actions -------------------------------- */
  function doClear(x: number, y: number) {
    if (energy < CLEAR_COST) {
      pushToast("Too exhausted to cut", "Sleep in the cot to restore energy", "warn");
      return;
    }
    setEnergy((e) => e - CLEAR_COST);
    setTiles((prev) => prev.map((row) => row.map((t) => (t.x === x && t.y === y ? { ...t, feature: null } : t))));
    // seed reward
    const roll = Math.random();
    const foundJ = journalsFound.filter(Boolean).length;
    if (roll < 0.58) {
      const pool = ["fernwhisper", "fernwhisper", "mistorchid", "sunspire", "gloomcap", "skyvine"];
      if (foundJ >= 5) pool.push("heartbloom");
      const pick = pool[rand(0, pool.length - 1)];
      const n = rand(1, 2);
      setSeeds((s) => ({ ...s, [pick]: (s[pick] ?? 0) + n }));
      pushToast(`Vines hid ${n}× ${speciesById(pick).name} seeds`, "The dome provides", "seed");
    } else if (roll < 0.68) {
      setEnergy((e) => Math.min(MAX_ENERGY, e + 8));
      pushToast("Found sun-syrup!", "+8 energy", "success");
    } else {
      pushToast("Path cleared", `${cleared + 1}/${totals.overgrowth} thickets opened`, "success");
    }
  }

  function doCollect(x: number, y: number) {
    const t = tiles[y][x];
    const f = t.feature as { kind: "pod"; speciesId: string; taken: boolean };
    if (!f || f.taken) return;
    setTiles((prev) =>
      prev.map((row) => row.map((c) => (c.x === x && c.y === y ? { ...c, feature: { kind: "pod", speciesId: f.speciesId, taken: true } as Tile["feature"] } : c)))
    );
    setSeeds((s) => ({ ...s, [f.speciesId]: (s[f.speciesId] ?? 0) + 2 }));
    pushToast(`+2 ${speciesById(f.speciesId).name} seeds`, "Seed pod cracked gently open", "seed");
  }

  function doRead(index: number) {
    if (!journalsFound[index]) {
      const j = JOURNALS[index];
      setJournalsFound((prev) => prev.map((v, i) => (i === index ? true : v)));
      if (j.rewardSeeds) {
        setSeeds((s) => ({ ...s, [j.rewardSeeds!.speciesId]: (s[j.rewardSeeds!.speciesId] ?? 0) + j.rewardSeeds!.count }));
      }
      pushToast(`Journal ${index + 1}/6 — “${j.title}”`, j.rewardText ?? "Elara's words linger", "journal");
    }
    setJournalModal(index);
  }

  function doPlant(x: number, y: number, speciesId: string) {
    const count = seeds[speciesId] ?? 0;
    if (count <= 0) {
      pushToast("No seeds", "Choose a seed you carry", "warn");
      return;
    }
    if (energy < PLANT_COST) {
      pushToast("Too tired to plant", "Sleep to restore energy", "warn");
      return;
    }
    const t = tiles[y][x];
    if (t.terrain !== "soil" || t.plant) return;
    const plant: PlantState = { speciesId, growth: 0, water: 1, mature: false };
    setTiles((prev) => prev.map((row) => row.map((c) => (c.x === x && c.y === y ? { ...c, plant } : c))));
    setSeeds((s) => ({ ...s, [speciesId]: s[speciesId] - 1 }));
    setEnergy((e) => e - PLANT_COST);
    setWater((w) => w); // planting uses soil moisture, not can
    pushToast(`Planted ${speciesById(speciesId).name}`, "Water it daily — sleep to grow", "success");
    setPlantModal(null);
  }

  function doWater(x: number, y: number) {
    if (water <= 0) {
      pushToast("Can is empty", "Refill at the pond, north-east", "warn");
      return;
    }
    if (energy < WATER_COST) {
      pushToast("Too tired", "Sleep first", "warn");
      return;
    }
    const t = tiles[y][x];
    if (!t.plant || t.plant.mature || t.plant.water >= 2) return;
    setTiles((prev) =>
      prev.map((row) => row.map((c) => (c.x === x && c.y === y && c.plant ? { ...c, plant: { ...c.plant, water: c.plant.water + 1 } } : c)))
    );
    setWater((w) => w - 1);
    setEnergy((e) => e - WATER_COST);
  }

  function doHarvest(x: number, y: number) {
    const t = tiles[y][x];
    if (!t.plant?.mature) return;
    const sp = speciesById(t.plant.speciesId);
    const n = rand(sp.seedYield[0], sp.seedYield[1]);
    setTiles((prev) => prev.map((row) => row.map((c) => (c.x === x && c.y === y ? { ...c, plant: null } : c))));
    setSeeds((s) => ({ ...s, [sp.id]: (s[sp.id] ?? 0) + n }));
    setEnergy((e) => Math.min(MAX_ENERGY, e + 4));
    pushToast(`Gathered ${sp.name}`, `+${n} seeds · +4 energy`, "seed");
  }

  function doSleep() {
    const nextDay = day + 1;
    setDay(nextDay);
    setEnergy(MAX_ENERGY);
    // dew
    let dew = 0;
    if (climate.humidity >= 70) dew = 1;
    if (dew) setWater((w) => Math.min(MAX_WATER, w + dew));
    // grow
    let maturedNow: string[] = [];
    setTiles((prev) =>
      prev.map((row) =>
        row.map((t) => {
          if (!t.plant || t.plant.mature) return t;
          if (t.plant.water <= 0) return { ...t, plant: { ...t.plant, thirstyFlag: true } };
          const sp = speciesById(t.plant.speciesId);
          const m = climateMatch(sp.temp, sp.humidity, sp.light, climate);
          // growth scaled: perfect climate = full rate, poor = 25%
          const rate = 0.35 + 0.65 * m;
          const gain = (100 / sp.growthDays) * rate;
          const ng = t.plant.growth + gain;
          if (ng >= 100) {
            maturedNow.push(t.plant.speciesId);
            return { ...t, plant: { ...t.plant, growth: 100, water: Math.max(0, t.plant.water - 1), mature: true } };
          }
          return { ...t, plant: { ...t.plant, growth: ng, water: t.plant.water - 1 } };
        })
      )
    );
    setTimeout(() => {
      if (maturedNow.length) {
        setGrownLog((g) => [...g, ...maturedNow]);
        const names = [...new Set(maturedNow)].map((id) => speciesById(id).name).join(", ");
        pushToast(`Day ${nextDay} — ${maturedNow.length} plant(s) matured!`, names, "success");
      } else {
        const thirstyCount = flat.filter((t) => t.plant && !t.plant.mature && t.plant.water <= 0).length;
        if (thirstyCount > 0) pushToast(`Day ${nextDay}`, `${thirstyCount} plant(s) thirsty — water them!`, "warn");
        else pushToast(`Day ${nextDay} — the dome breathes`, dew ? "Dew refilled +1 water" : "Energy restored", "info");
      }
      // respawn a taken pod
      setTiles((prev) => {
        const taken = prev.flat().filter((t) => typeof t.feature === "object" && t.feature !== null && (t.feature as { kind: string }).kind === "pod" && (t.feature as { kind: string; taken: boolean }).taken);
        if (taken.length && Math.random() < 0.6) {
          const pick = taken[rand(0, taken.length - 1)];
          return prev.map((row) =>
            row.map((c) =>
              c.x === pick.x && c.y === pick.y
                ? { ...c, feature: { kind: "pod", speciesId: (c.feature as { kind: "pod"; speciesId: string }).speciesId, taken: false } as Tile["feature"] }
                : c
            )
          );
        }
        return prev;
      });
    }, 60);
  }

  function doContext() {
    if (!contextAction || contextAction.disabled) {
      if (contextAction?.disabled) pushToast("Can't do that yet", contextAction.disabled, "warn");
      return;
    }
    const a = contextAction;
    if (a.type === "clear") doClear(a.x!, a.y!);
    else if (a.type === "pod") doCollect(a.x!, a.y!);
    else if (a.type === "journal") {
      const t = tiles[a.y!][a.x!];
      const f = t.feature as { kind: "journal"; index: number };
      doRead(f.index);
    } else if (a.type === "plant") {
      if ((seeds[selectedSeed] ?? 0) > 0) doPlant(a.x!, a.y!, selectedSeed);
      else setPlantModal({ x: a.x!, y: a.y! });
    } else if (a.type === "water") doWater(a.x!, a.y!);
    else if (a.type === "harvest") doHarvest(a.x!, a.y!);
    else if (a.type === "refill") {
      setWater(MAX_WATER);
      pushToast("Can refilled", "Pond water sloshes, green and alive", "info");
    } else if (a.type === "sleep") doSleep();
    else if (a.type === "console") {
      setTab("climate");
      pushToast("Console linked", "Adjust the dome's breath", "climate");
    } else if (a.type === "heart") {
      pushToast("The Heart Tree is silent", a.sub, "info");
    } else if (a.type === "awaken") {
      setVictory(true);
      setVictoryOpen(true);
    } else if (a.type === "heart-calm") {
      pushToast("The Heart hums", "Petals drift in a slow spiral", "success");
    }
  }

  /* -------------------------------- keyboard ------------------------------- */
  useEffect(() => {
    if (screen !== "game") return;
    const h = (e: KeyboardEvent) => {
      if (journalModal !== null || plantModal !== null || victoryOpen || helpOpen) {
        if (e.key === "Escape") {
          setJournalModal(null);
          setPlantModal(null);
          setVictoryOpen(false);
          setHelpOpen(false);
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (["arrowup", "w"].includes(k)) {
        e.preventDefault();
        tryStep(0, -1);
      } else if (["arrowdown", "s"].includes(k)) {
        e.preventDefault();
        tryStep(0, 1);
      } else if (["arrowleft", "a"].includes(k)) {
        e.preventDefault();
        tryStep(-1, 0);
      } else if (["arrowright", "d"].includes(k)) {
        e.preventDefault();
        tryStep(1, 0);
      } else if (k === "e" || k === "enter" || k === " ") {
        e.preventDefault();
        doContext();
      } else if (k === "n") {
        doSleep();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tiles, player, energy, water, contextAction, journalModal, plantModal, victoryOpen, helpOpen]);

  /* --------------------------------- visuals ------------------------------- */
  const butterflies = useMemo(() => {
    const n = Math.min(9, Math.floor(vitality / 11));
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      left: 8 + ((i * 37 + vitality * 3) % 84),
      top: 12 + ((i * 53 + day * 7) % 70),
      delay: (i * 0.7) % 4,
      dur: 5 + (i % 4),
      color: ["#f9a8d4", "#fde68a", "#a5f3fc", "#bbf7d0"][i % 4],
    }));
  }, [vitality, day]);

  const spores = useMemo(() => {
    const n = 8 + Math.floor(vitality / 8);
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      left: (i * 29 + 13) % 96,
      top: (i * 41 + 23) % 92,
      delay: (i * 0.43) % 5,
      dur: 6 + ((i * 7) % 6),
      size: 3 + ((i * 3) % 4),
    }));
  }, [vitality]);

  const weatherText = useMemo(() => {
    const parts: string[] = [];
    if (climate.temp >= 75) parts.push("brazen heat shimmers");
    else if (climate.temp <= 30) parts.push("cold breath fogs");
    else parts.push("mild air drifts");
    if (climate.humidity >= 75) parts.push("mist hangs thick");
    else if (climate.humidity <= 30) parts.push("air crackles dry");
    if (climate.light >= 75) parts.push("sun shafts blaze");
    else if (climate.light <= 30) parts.push("lanterns do the sun's work");
    return parts.join(" · ");
  }, [climate]);

  const avgMatch = useMemo(() => {
    const growing = flat.filter((t) => t.plant && !t.plant.mature);
    if (!growing.length) return null;
    const avg = growing.reduce((a, t) => a + climateMatch(speciesById(t.plant!.speciesId).temp, speciesById(t.plant!.speciesId).humidity, speciesById(t.plant!.speciesId).light, climate), 0) / growing.length;
    return Math.round(avg * 100);
  }, [flat, climate]);

  function resetGame() {
    const b = buildInitialMap();
    setTiles(b.tiles);
    setPlayer({ x: 1, y: 8, dir: "down" });
    setEnergy(MAX_ENERGY);
    setWater(MAX_WATER);
    setDay(1);
    setSeeds({ fernwhisper: 3, mistorchid: 1, sunspire: 0, gloomcap: 0, skyvine: 0, heartbloom: 0 });
    setSelectedSeed("fernwhisper");
    setClimate({ temp: 55, humidity: 62, light: 48 });
    setJournalsFound(Array(6).fill(false));
    setGrownLog([]);
    setVictory(false);
    setVictoryOpen(false);
    setTab("garden");
    setToasts([]);
  }

  /* --------------------------------- intro --------------------------------- */
  if (screen === "intro") {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#07120d] text-emerald-50">
        {/* ambient bg */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(52,211,153,0.25),transparent_60%),radial-gradient(ellipse_at_20%_110%,rgba(251,146,60,0.15),transparent_50%),radial-gradient(ellipse_at_85%_90%,rgba(192,132,252,0.18),transparent_55%)]" />
          <div className="dome-arch absolute left-1/2 -translate-x-1/2 top-[-18vw] w-[110vw] h-[110vw] max-w-[1100px] max-h-[1100px] rounded-full border-[3px] border-emerald-200/20" />
          <div className="dome-arch absolute left-1/2 -translate-x-1/2 top-[-14vw] w-[92vw] h-[92vw] max-w-[920px] max-h-[920px] rounded-full border border-emerald-100/10" />
          <div className="absolute inset-0 opacity-[0.14]" style={{ backgroundImage: "linear-gradient(rgba(110,231,183,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(110,231,183,0.4) 1px, transparent 1px)", backgroundSize: "56px 56px" }} />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 lg:py-16">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-950/60 px-4 py-1.5 text-[11px] tracking-[0.25em] uppercase text-emerald-200/90">
              <Sparkles size={13} /> A restoration fable · sealed dome · one botanist
            </div>
            <h1 className="mt-6 font-serif text-5xl lg:text-7xl leading-[0.95] tracking-tight">
              <span className="block text-emerald-100/90 italic font-light">The Forgotten</span>
              <span className="block font-black bg-gradient-to-r from-emerald-200 via-lime-200 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(52,211,153,0.35)]">GREENHOUSE</span>
            </h1>
            <p className="mt-5 max-w-2xl mx-auto text-emerald-100/70 text-base lg:text-lg leading-relaxed">
              Decades ago Dr. Elara Vance sealed the glass against the blight — and never returned.
              You slip through a cracked pane with a trowel, a can, and her scattered journals.
              Clear the vines. Learn the climates. Wake the Heart.
            </p>
          </motion.div>

          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { icon: <Sprout size={18} />, t: "Seed discovery", d: "Cut vines, crack pods, read pages — 6 species, each with a climate soul." },
              { icon: <FlaskConical size={18} />, t: "Climate controls", d: "Three consoles + live panel: temperature, humidity, light. Plants judge you." },
              { icon: <Scissors size={18} />, t: "Overgrown pathways", d: "14 thickets seal shortcuts & secrets. Clearing feeds vitality." },
              { icon: <BookOpen size={18} />, t: "Lost journals", d: "6 pages of Elara's hand. Hints, lore, and seeds pressed in paper." },
            ].map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }} className="rounded-2xl border border-emerald-100/10 bg-emerald-950/50 backdrop-blur p-4 text-left">
                <div className="w-9 h-9 rounded-xl bg-emerald-400/15 border border-emerald-300/20 flex items-center justify-center text-emerald-200">{c.icon}</div>
                <div className="mt-3 font-semibold text-emerald-50">{c.t}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-emerald-100/60">{c.d}</div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8 rounded-3xl border border-amber-200/15 bg-gradient-to-br from-emerald-950/80 to-[#1a130a]/80 p-6 lg:p-8 backdrop-blur">
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-amber-200/90 text-xs tracking-[0.2em] uppercase"><Compass size={14} /> How a day works</div>
                <ol className="mt-3 space-y-2 text-[14px] text-emerald-50/80 leading-relaxed list-none">
                  <li><b className="text-emerald-100">1 · Explore</b> — WASD / arrows or click paths. The dome is 15×11 rooms of glass.</li>
                  <li><b className="text-emerald-100">2 · Clear & collect</b> — press <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-[12px]">E</kbd> beside vines, pods & pages.</li>
                  <li><b className="text-emerald-100">3 · Plant & water</b> — dark soil + pond water. Match the climate or growth stalls.</li>
                  <li><b className="text-emerald-100">4 · Sleep</b> — the cot advances a day. Watered plants grow overnight.</li>
                  <li><b className="text-emerald-100">5 · Awaken</b> — grow a Heartbloom + reach 75% vitality, then touch the Heart Tree.</li>
                </ol>
              </div>
              <div className="w-full lg:w-72 shrink-0 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">You carry</div>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-300" /> 3× Moonpetal Fern</div>
                  <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-300" /> 1× Mist Orchid</div>
                  <div className="flex items-center gap-2 text-white/50"><Droplet size={14} /> Watering can · 6</div>
                  <div className="flex items-center gap-2 text-white/50"><Zap size={14} /> Shears · 100 energy</div>
                </div>
                <button onClick={() => { setScreen("game"); setHelpOpen(false); pushToast("The pane seals behind you", "Find the cot (south-west) — sleep to grow", "info"); }} className="mt-4 w-full group rounded-xl bg-gradient-to-r from-emerald-400 to-lime-300 text-emerald-950 font-bold py-3 flex items-center justify-center gap-2 hover:brightness-110 transition shadow-[0_0_30px_rgba(52,211,153,0.35)]">
                  <Play size={16} className="group-hover:scale-110 transition" /> Enter the dome
                </button>
                <div className="mt-2 text-center text-[11px] text-white/40">Best with keyboard · touch D-pad included</div>
              </div>
            </div>
          </motion.div>
          <div className="mt-6 text-center text-[12px] text-emerald-100/40">A changing ecosystem: fog lifts · butterflies return · glass clears as vitality rises</div>
        </div>
      </div>
    );
  }

  /* --------------------------------- game ---------------------------------- */
  const energyPct = (energy / MAX_ENERGY) * 100;

  return (
    <div className="min-h-screen bg-[#07120d] text-emerald-50 flex flex-col overflow-x-hidden">
      {/* top bar */}
      <header className="z-30 sticky top-0 border-b border-emerald-100/10 bg-[#0a1a12]/90 backdrop-blur">
        <div className="max-w-[1280px] mx-auto px-3 lg:px-5 py-2.5 flex items-center gap-2 lg:gap-4 flex-wrap">
          <div className="flex items-center gap-2.5 mr-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-lime-500 flex items-center justify-center text-emerald-950 shadow-[0_0_20px_rgba(52,211,153,0.4)]"><Leaf size={18} /></div>
            <div className="leading-tight">
              <div className="font-serif font-bold text-[15px] tracking-tight">The Forgotten Greenhouse</div>
              <div className="text-[11px] text-emerald-200/60 -mt-0.5">Day {day} · <span style={{ color: stage.color }}>{stage.name}</span> · {stage.epithet}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5" title="Energy — clearing, planting, watering">
              <Zap size={14} className="text-amber-300" />
              <div className="w-20 lg:w-24 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400 transition-all" style={{ width: `${energyPct}%` }} /></div>
              <span className="text-[12px] tabular-nums w-7">{energy}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5" title="Water — refill at pond">
              <Droplets size={14} className="text-sky-300" />
              <div className="flex gap-0.5">{Array.from({ length: MAX_WATER }).map((_, i) => (<span key={i} className={`w-1.5 h-3 rounded-full ${i < water ? "bg-sky-300" : "bg-white/15"}`} />))}</div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5" title="Dome vitality">
              <Sparkles size={14} className="text-lime-300" />
              <div className="w-20 lg:w-24 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-lime-300 to-amber-200 transition-all" style={{ width: `${vitality}%` }} /></div>
              <span className="text-[12px] tabular-nums font-bold">{vitality}%</span>
            </div>
            <button onClick={() => setHelpOpen(true)} className="rounded-full border border-white/10 bg-white/5 p-2 hover:bg-white/10" title="Help (H)"><Info size={15} /></button>
            <button onClick={resetGame} className="rounded-full border border-white/10 bg-white/5 p-2 hover:bg-white/10" title="Restart"><RotateCcw size={15} /></button>
          </div>
        </div>
        {/* climate mini strip */}
        <div className="max-w-[1280px] mx-auto px-3 lg:px-5 pb-2 flex items-center gap-3 text-[11px] text-emerald-100/60">
          <span className="flex items-center gap-1"><Thermometer size={12} className="text-orange-300" /> {climate.temp}°</span>
          <span className="flex items-center gap-1"><Droplets size={12} className="text-sky-300" /> {climate.humidity}%</span>
          <span className="flex items-center gap-1"><Sun size={12} className="text-amber-200" /> {climate.light}%</span>
          <span className="hidden sm:inline text-white/30">·</span>
          <span className="hidden sm:inline italic truncate">{weatherText}</span>
          {avgMatch !== null && <span className="ml-auto hidden md:inline rounded-full bg-white/5 border border-white/10 px-2 py-0.5">crop comfort {avgMatch}%</span>}
        </div>
      </header>

      {/* main */}
      <div className="flex-1 w-full max-w-[1280px] mx-auto px-3 lg:px-5 py-3 lg:py-4 grid lg:grid-cols-[1fr_360px] gap-3 lg:gap-4 items-start">
        {/* board column */}
        <div className="min-w-0">
          <div className="relative rounded-3xl overflow-hidden border border-emerald-100/15 shadow-[0_20px_80px_rgba(0,0,0,0.5)] bg-[#0d2016]">
            {/* sky / dome header inside board */}
            <div className="relative px-4 pt-3 pb-2 flex items-center justify-between text-[11px] tracking-[0.18em] uppercase text-emerald-100/50">
              <span className="flex items-center gap-1.5"><Eye size={12} /> Sealed Dome · Sector 7</span>
              <span className="flex items-center gap-1.5"><Wind size={12} /> {cleared}/{totals.overgrowth} paths · {matureNow} blooming · {foundCount}/6 pages</span>
            </div>
            {/* grid wrapper with climate tint */}
            <div className="relative px-2 sm:px-3 pb-3">
              <div className="relative rounded-2xl overflow-hidden border border-white/10" style={{ background: "linear-gradient(180deg,#12291c 0%, #0e2016 60%, #0a1811 100%)" }}>
                {/* grid */}
                <div className="relative grid" style={{ gridTemplateColumns: "repeat(15, 1fr)" }}>
                  {tiles.map((row) =>
                    row.map((t) => (
                      <TileCell
                        key={`${t.x},${t.y}`}
                        tile={t}
                        isPlayer={player.x === t.x && player.y === t.y}
                        playerDir={player.dir}
                        journalsFound={journalsFound}
                        climate={climate}
                        onClick={() => handleTileClick(t.x, t.y)}
                      />
                    ))
                  )}
                </div>

                {/* climate overlays */}
                <div className="pointer-events-none absolute inset-0" style={{ background: climate.temp >= 70 ? `rgba(251,146,60,${((climate.temp - 70) / 60) * 0.28})` : climate.temp <= 30 ? `rgba(96,165,250,${((30 - climate.temp) / 60) * 0.32})` : "transparent" }} />
                <div className="pointer-events-none absolute inset-0 mist-layer" style={{ opacity: climate.humidity >= 65 ? (climate.humidity - 65) / 70 + 0.15 : 0 }} />
                <div className="pointer-events-none absolute inset-0" style={{ background: climate.light <= 30 ? `rgba(2,6,12,${((30 - climate.light) / 50) * 0.55})` : "transparent" }} />
                {climate.light >= 75 && <div className="pointer-events-none absolute inset-0 sunrays" style={{ opacity: (climate.light - 75) / 50 + 0.25 }} />}
                {/* vitality fog */}
                <div className="pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ opacity: (100 - vitality) / 100 * 0.55, background: "radial-gradient(ellipse at 50% 40%, rgba(148,163,184,0.35), rgba(71,85,105,0.5) 70%, rgba(15,23,42,0.65))", backdropFilter: "blur(0.6px)" }} />
                {/* vignette */}
                <div className="pointer-events-none absolute inset-0" style={{ boxShadow: "inset 0 0 120px rgba(0,0,0,0.55)", }} />

                {/* spores */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {spores.map((s) => (
                    <span key={s.id} className="spore" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />
                  ))}
                </div>
                {/* butterflies */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {butterflies.map((b) => (
                    <span key={b.id} className="butterfly" style={{ left: `${b.left}%`, top: `${b.top}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }}>
                      <span className="bfly-wing left" style={{ background: b.color }} />
                      <span className="bfly-wing right" style={{ background: b.color }} />
                    </span>
                  ))}
                </div>
              </div>

              {/* toasts over board (mobile friendly) */}
              <div className="pointer-events-none absolute top-10 right-2 sm:right-3 z-20 flex flex-col gap-2 w-[240px]">
                <AnimatePresence>
                  {toasts.map((t) => (
                    <motion.div key={t.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} className="pointer-events-auto rounded-xl border border-white/12 bg-[#0b1c13]/95 backdrop-blur px-3 py-2 shadow-xl">
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 ${t.kind === "seed" ? "text-lime-300" : t.kind === "journal" ? "text-amber-200" : t.kind === "warn" ? "text-orange-300" : t.kind === "climate" ? "text-sky-300" : "text-emerald-300"}`}>
                          {t.kind === "seed" ? <Sprout size={14} /> : t.kind === "journal" ? <BookOpen size={14} /> : t.kind === "warn" ? <Hammer size={14} /> : t.kind === "climate" ? <FlaskConical size={14} /> : <Sparkles size={14} />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-semibold leading-tight">{t.title}</div>
                          {t.sub && <div className="text-[11.5px] text-white/60 leading-snug">{t.sub}</div>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* action bar */}
          <div className="mt-3 grid md:grid-cols-[1fr_auto] gap-3">
            <div className="rounded-2xl border border-emerald-100/12 bg-[#0c1e14]/90 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {contextAction ? (
                  <>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/60 flex items-center gap-1.5"><Compass size={12} /> Nearby · press E</div>
                    <div className="mt-0.5 font-semibold truncate">{contextAction.label}</div>
                    <div className="text-[12px] text-white/55 truncate">{contextAction.sub}</div>
                    {contextAction.disabled && <div className="text-[12px] text-orange-300/90">{contextAction.disabled}</div>}
                  </>
                ) : (
                  <>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/60">Wander</div>
                    <div className="font-semibold text-white/70">No chore in reach — explore the glass</div>
                    <div className="text-[12px] text-white/45">Move with WASD · click glowing paths · find pods & pages</div>
                  </>
                )}
              </div>
              <button
                onClick={doContext}
                disabled={!contextAction || !!contextAction.disabled || (contextAction.type === "refill-needed")}
                className={`shrink-0 rounded-xl px-4 lg:px-5 py-3 font-bold text-[14px] flex items-center gap-2 transition ${!contextAction || contextAction.disabled ? "bg-white/8 text-white/35 border border-white/10 cursor-not-allowed" : contextAction.type === "awaken" ? "bg-gradient-to-r from-pink-400 via-amber-200 to-emerald-300 text-emerald-950 shadow-[0_0_30px_rgba(244,114,182,0.5)] animate-pulse" : "bg-gradient-to-r from-emerald-400 to-lime-300 text-emerald-950 hover:brightness-110 shadow-[0_0_24px_rgba(52,211,153,0.35)]"}`}
              >
                {contextAction?.type === "clear" ? <Scissors size={16} /> : contextAction?.type === "plant" ? <Sprout size={16} /> : contextAction?.type === "water" ? <Droplets size={16} /> : contextAction?.type === "harvest" ? <Flower2 size={16} /> : contextAction?.type === "journal" ? <BookOpen size={16} /> : contextAction?.type === "sleep" ? <BedDouble size={16} /> : contextAction?.type === "awaken" ? <Heart size={16} /> : <Sparkles size={16} />}
                {contextAction?.type === "awaken" ? "Awaken" : "Do (E)"}
              </button>
              <button onClick={doSleep} className="shrink-0 rounded-xl px-3 py-3 border border-white/12 bg-white/5 hover:bg-white/10 flex items-center gap-1.5 text-[13px]" title="Sleep (N)">
                <Moon size={15} /> <span className="hidden sm:inline">Sleep</span>
              </button>
            </div>
            {/* d-pad */}
            <div className="rounded-2xl border border-emerald-100/12 bg-[#0c1e14]/90 p-2.5 flex items-center gap-2 justify-center">
              <div className="grid grid-cols-3 gap-1">
                <span />
                <PadBtn onClick={() => tryStep(0, -1)}><ChevronUp size={16} /></PadBtn>
                <span />
                <PadBtn onClick={() => tryStep(-1, 0)}><ChevronLeft size={16} /></PadBtn>
                <PadBtn onClick={() => tryStep(0, 1)}><ChevronDown size={16} /></PadBtn>
                <PadBtn onClick={() => tryStep(1, 0)}><ChevronRight size={16} /></PadBtn>
              </div>
              <div className="text-[11px] text-white/40 leading-tight pl-1">WASD<br />arrows<br />click<br />to walk</div>
            </div>
          </div>

          {/* legend */}
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
            {[
              { c: "bg-[#3a2c22]", t: "soil — plant" },
              { c: "bg-emerald-500/70", t: "vines — cut" },
              { c: "bg-sky-400/70", t: "pond — refill" },
              { c: "bg-amber-300/80", t: "journal" },
              { c: "bg-orange-400/80", t: "console" },
              { c: "bg-pink-400/80", t: "Heart Tree" },
            ].map((l, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/60"><span className={`w-2 h-2 rounded-full ${l.c}`} />{l.t}</span>
            ))}
          </div>
        </div>

        {/* sidebar */}
        <aside className="min-w-0 rounded-3xl border border-emerald-100/12 bg-[#0b1a12]/90 overflow-hidden lg:sticky lg:top-[104px]">
          <div className="grid grid-cols-4 border-b border-white/10 text-[12px] font-semibold">
            {(["garden", "climate", "journal", "wilds"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`py-2.5 capitalize transition flex items-center justify-center gap-1 ${tab === t ? "bg-emerald-400/15 text-emerald-100 border-b-2 border-emerald-300" : "text-white/45 hover:text-white/80 hover:bg-white/5"}`}>
                {t === "garden" ? <Sprout size={13} /> : t === "climate" ? <FlaskConical size={13} /> : t === "journal" ? <BookOpen size={13} /> : <Leaf size={13} />}
                <span className="hidden sm:inline">{t === "wilds" ? "Ecosystem" : t}</span>
              </button>
            ))}
          </div>
          <div className="p-3 lg:p-4 max-h-[640px] overflow-y-auto custom-scroll">
            {tab === "garden" && (
              <GardenTab seeds={seeds} selected={selectedSeed} onSelect={setSelectedSeed} climate={climate} journalsFound={journalsFound} />
            )}
            {tab === "climate" && (
              <ClimateTab climate={climate} onChange={setClimate} onPreset={(c) => { setClimate(c); pushToast("Climate shifted", "Watch leaves respond overnight", "climate"); }} />
            )}
            {tab === "journal" && (
              <JournalTab found={journalsFound} onOpen={setJournalModal} />
            )}
            {tab === "wilds" && (
              <WildsTab vitality={vitality} stage={stage} cleared={cleared} totalOver={totals.overgrowth} grownLog={grownLog} foundCount={foundCount} matureNow={matureNow} growingNow={growingNow} hasHeart={hasMatureHeart} canAwaken={canAwaken} onAwaken={() => { setVictory(true); setVictoryOpen(true); }} weather={weatherText} />
            )}
          </div>
        </aside>
      </div>

      {/* footer hint */}
      <div className="w-full max-w-[1280px] mx-auto px-5 pb-6 text-center text-[11px] text-white/30">
        Move <b>WASD / arrows / click</b> · Act <b>E</b> · Sleep <b>N</b> · Esc closes pages · The dome remembers everything you grow
      </div>

      {/* modals */}
      <AnimatePresence>
        {journalModal !== null && (
          <JournalModal index={journalModal} onClose={() => setJournalModal(null)} />
        )}
        {plantModal && (
          <PlantModal x={plantModal.x} y={plantModal.y} seeds={seeds} selected={selectedSeed} onSelect={setSelectedSeed} climate={climate} onPlant={(id) => doPlant(plantModal.x, plantModal.y, id)} onClose={() => setPlantModal(null)} />
        )}
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
        {victoryOpen && <VictoryModal day={day} vitality={vitality} grownLog={grownLog} onClose={() => setVictoryOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

function PadBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="w-9 h-9 rounded-lg border border-white/12 bg-white/6 hover:bg-emerald-400/20 active:scale-95 flex items-center justify-center">{children}</button>;
}

/* -------------------------------- TileCell -------------------------------- */
function TileCell({ tile, isPlayer, playerDir, journalsFound, climate, onClick }: { tile: Tile; isPlayer: boolean; playerDir: string; journalsFound: boolean[]; climate: { temp: number; humidity: number; light: number }; onClick: () => void }) {
  const { terrain, feature, plant } = tile;
  const isSoil = terrain === "soil";
  const f = feature as unknown as { kind?: string; index?: number; speciesId?: string; taken?: boolean } | string | null;

  let bg = "bg-[#16281d]";
  if (terrain === "wall") bg = "bg-[#0a1410]";
  else if (terrain === "water") bg = "bg-[#0c2a3a]";
  else if (terrain === "wood") bg = "bg-[#2a2016]";
  else if (terrain === "soil") bg = "bg-[#241a12]";
  else {
    bg = (tile.x + tile.y) % 2 === 0 ? "bg-[#152619]" : "bg-[#132217]";
  }
  const isOver = feature === "overgrowth";
  const isConsole = typeof feature === "string" && (feature as string).startsWith("console");
  const isHeart = feature === "heart";
  const isCot = feature === "cot";
  const isTree = feature === "tree";
  const isJournal = typeof f === "object" && f !== null && f.kind === "journal";
  const isPod = typeof f === "object" && f !== null && f.kind === "pod";

  return (
    <button onClick={onClick} className={`relative aspect-square w-full ${bg} border-[0.5px] border-white/[0.06] overflow-hidden group hover:brightness-125 transition focus:outline-none ${isOver ? "cursor-pointer" : ""}`} title={`${tile.x},${tile.y} ${terrain}${feature ? " · " + (typeof feature === "string" ? feature : (feature as { kind: string }).kind) : ""}`}>
      {/* terrain texture */}
      {terrain === "wall" && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="absolute inset-[3px] rounded-[3px] border border-emerald-100/15 bg-gradient-to-br from-[#1b2f26] to-[#0b1712]" />
          <span className="absolute w-1 h-1 rounded-full bg-emerald-100/25 left-[5px] top-[5px]" />
          <span className="absolute w-1 h-1 rounded-full bg-emerald-100/25 right-[5px] top-[5px]" />
          <span className="absolute w-1 h-1 rounded-full bg-emerald-100/25 left-[5px] bottom-[5px]" />
          <span className="absolute w-1 h-1 rounded-full bg-emerald-100/25 right-[5px] bottom-[5px]" />
        </span>
      )}
      {terrain === "stone" && !feature && !plant && (
        <span className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(rgba(110,231,183,0.12) 1px, transparent 1px)", backgroundSize: "10px 10px" }} />
      )}
      {terrain === "wood" && (
        <span className="absolute inset-0 opacity-60" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 8px, rgba(0,0,0,0.25) 8px 9px)" }} />
      )}
      {isSoil && (
        <span className="absolute inset-[2px] rounded-[4px] bg-gradient-to-br from-[#3b2a1c] to-[#211510] border border-amber-100/10">
          <span className="absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(rgba(0,0,0,0.5) 1.2px, transparent 1.2px)", backgroundSize: "8px 8px" }} />
        </span>
      )}
      {terrain === "water" && (
        <span className="absolute inset-0 overflow-hidden">
          <span className="absolute inset-0 bg-gradient-to-br from-sky-400/50 via-cyan-500/30 to-blue-900/60" />
          <span className="water-shimmer absolute inset-0" />
          <Droplet size={12} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sky-100/70" />
        </span>
      )}
      {/* features */}
      {isOver && (
        <span className="absolute inset-0 bg-gradient-to-br from-emerald-900/90 to-[#0d2a16]">
          <span className="vine-sway absolute inset-0 flex items-center justify-center gap-[1px]">
            <Leaf size={13} className="text-emerald-400 -rotate-12" />
            <Leaf size={16} className="text-lime-400 rotate-12" />
            <Leaf size={13} className="text-green-500 rotate-45" />
          </span>
          <span className="absolute inset-[2px] rounded border border-lime-300/30 animate-pulse" />
        </span>
      )}
      {isConsole && (
        <span className="absolute inset-[3px] rounded-md border flex flex-col items-center justify-center gap-[1px] text-[9px] font-bold"
          style={{
            background: feature === "console-temp" ? "linear-gradient(180deg,#431407,#7c2d12)" : feature === "console-light" ? "linear-gradient(180deg,#422006,#92400e)" : "linear-gradient(180deg,#082f49,#0c4a6e)",
            borderColor: "rgba(255,255,255,0.2)",
          }}>
          {feature === "console-temp" ? <Thermometer size={13} className="text-orange-300" /> : feature === "console-light" ? <Sun size={13} className="text-amber-200" /> : <Droplets size={13} className="text-sky-200" />}
          <span className="text-white/80 leading-none hidden sm:block">{feature === "console-temp" ? "HEAT" : feature === "console-light" ? "LAMP" : "MIST"}</span>
          <span className="absolute top-[2px] right-[2px] w-1 h-1 rounded-full bg-lime-300 animate-ping" />
        </span>
      )}
      {isHeart && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="absolute w-[86%] h-[86%] rounded-full" style={{ background: "radial-gradient(circle, rgba(244,114,182,0.35), transparent 70%)" }} />
          <TreePine size={22} className="text-emerald-200 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <Heart size={10} className="absolute text-pink-300 animate-pulse" style={{ top: "30%" }} />
        </span>
      )}
      {isCot && (
        <span className="absolute inset-0 flex items-center justify-center">
          <BedDouble size={18} className="text-amber-200/90" />
          <span className="absolute bottom-[3px] text-[8px] tracking-widest text-amber-100/60">COT</span>
        </span>
      )}
      {isTree && (
        <span className="absolute inset-0 flex items-center justify-center bg-[#0e2115]">
          <TreePine size={20} className="text-emerald-700" />
        </span>
      )}
      {isJournal && (
        <span className="absolute inset-0 flex items-center justify-center">
          {(journalsFound[(f as { index: number }).index]) ? (
            <BookOpen size={13} className="text-white/25" />
          ) : (
            <span className="relative">
              <span className="absolute -inset-1 rounded-full bg-amber-300/30 animate-ping" />
              <BookOpen size={14} className="relative text-amber-200 drop-shadow-[0_0_6px_rgba(252,211,77,0.8)]" />
            </span>
          )}
        </span>
      )}
      {isPod && !(f as { taken?: boolean }).taken && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="relative">
            <span className="absolute -inset-1.5 rounded-full animate-pulse" style={{ background: `${speciesById((f as { speciesId: string }).speciesId).glow}` }} />
            <Sprout size={14} className="relative" style={{ color: speciesById((f as { speciesId: string }).speciesId).color }} />
          </span>
        </span>
      )}
      {/* plants */}
      {plant && <PlantSprite plant={plant} climate={climate} />}
      {/* player */}
      {isPlayer && (
        <span className="absolute inset-0 z-10 flex items-center justify-center">
          <span className="absolute w-[92%] h-[92%] rounded-full bg-amber-200/15 blur-[3px]" />
          <span className="player-bob relative w-[68%] h-[68%] rounded-full bg-gradient-to-br from-amber-100 via-amber-200 to-orange-300 border-2 border-emerald-950 shadow-[0_2px_10px_rgba(0,0,0,0.6)] flex items-center justify-center">
            <span className="w-[55%] h-[55%] rounded-full bg-gradient-to-br from-emerald-800 to-emerald-950 flex items-center justify-center">
              <Leaf size={11} className="text-lime-200" />
            </span>
            <span className={`absolute w-0 h-0 border-[4px] border-transparent ${playerDir === "up" ? "-top-[7px] border-b-amber-200" : playerDir === "down" ? "-bottom-[7px] border-t-amber-200" : playerDir === "left" ? "-left-[7px] border-r-amber-200" : "-right-[7px] border-l-amber-200"}`} style={{ borderTopColor: playerDir === "down" ? "#fde68a" : "transparent", borderBottomColor: playerDir === "up" ? "#fde68a" : "transparent", borderLeftColor: playerDir === "right" ? "#fde68a" : "transparent", borderRightColor: playerDir === "left" ? "#fde68a" : "transparent" }} />
          </span>
        </span>
      )}
      {/* hover ring for actionable */}
      {!isPlayer && (isOver || isPod || isJournal || (isSoil && !plant)) && (
        <span className="absolute inset-[1px] rounded-[3px] border border-white/0 group-hover:border-lime-200/60 transition" />
      )}
    </button>
  );
}

function PlantSprite({ plant, climate }: { plant: PlantState; climate: { temp: number; humidity: number; light: number } }) {
  const sp = speciesById(plant.speciesId);
  const m = climateMatch(sp.temp, sp.humidity, sp.light, climate);
  if (plant.mature) {
    return (
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="absolute w-[90%] h-[90%] rounded-full" style={{ background: `radial-gradient(circle, ${sp.glow}, transparent 70%)` }} />
        <span className="mature-bloom relative flex items-center justify-center">
          {[0, 60, 120, 180, 240, 300].map((r) => (
            <span key={r} className="absolute w-[10px] h-[10px] rounded-full" style={{ background: sp.color, transform: `rotate(${r}deg) translateY(-8px)`, opacity: 0.95, boxShadow: `0 0 6px ${sp.color}` }} />
          ))}
          <span className="relative w-[10px] h-[10px] rounded-full bg-white border border-black/20 shadow" />
          <Sparkles size={8} className="absolute -top-[9px] -right-[9px] text-white/90 animate-pulse" />
        </span>
        <Flower2 size={9} className="absolute bottom-[2px] opacity-0" />
      </span>
    );
  }
  if (plant.growth >= 35) {
    return (
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-end gap-[1px]">
          <Leaf size={12} className="-rotate-12" style={{ color: sp.color }} />
          <Leaf size={15} style={{ color: sp.color }} />
          <Leaf size={12} className="rotate-12" style={{ color: sp.color }} />
        </span>
        {plant.water <= 0 && <Droplets size={9} className="absolute top-[2px] right-[2px] text-orange-300 animate-bounce" />}
        <span className="absolute bottom-[1px] h-[2px] rounded-full bg-white/20 overflow-hidden w-[70%]"><span className="block h-full" style={{ width: `${plant.growth}%`, background: m > 0.75 ? "#4ade80" : m > 0.5 ? "#facc15" : "#fb7185" }} /></span>
      </span>
    );
  }
  if (plant.growth > 2) {
    return (
      <span className="absolute inset-0 flex items-center justify-center">
        <Sprout size={13} style={{ color: sp.color }} />
        {plant.water <= 0 && <span className="absolute top-[2px] right-[2px] w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />}
      </span>
    );
  }
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <span className="w-[7px] h-[7px] rounded-full bg-amber-100/90 border border-amber-900 shadow" />
      {plant.water <= 0 && <Droplets size={8} className="absolute top-[2px] right-[2px] text-orange-300 animate-bounce" />}
    </span>
  );
}

/* --------------------------------- tabs ---------------------------------- */
function GardenTab({ seeds, selected, onSelect, climate, journalsFound }: { seeds: Record<string, number>; selected: string; onSelect: (id: string) => void; climate: Climate; journalsFound: boolean[] }) {
  const foundJ = journalsFound.filter(Boolean).length;
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">Seed satchel · tap to equip</div>
      <div className="mt-2 space-y-2">
        {SPECIES.map((s) => {
          const count = seeds[s.id] ?? 0;
          // heartbloom hint locked until journal 5?
          const heartLocked = s.id === "heartbloom" && !journalsFound[5] && count <= 0;
          const m = Math.round(climateMatch(s.temp, s.humidity, s.light, climate) * 100);
          const isSel = selected === s.id;
          return (
            <button key={s.id} onClick={() => count > 0 && onSelect(s.id)} disabled={count <= 0} className={`w-full text-left rounded-2xl border p-2.5 flex gap-2.5 transition ${isSel ? "border-lime-300/60 bg-lime-300/10 shadow-[0_0_20px_rgba(163,230,53,0.15)]" : count > 0 ? "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]" : "border-white/5 bg-white/[0.02] opacity-55"}`}>
              <span className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border border-white/10" style={{ background: `radial-gradient(circle at 50% 40%, ${s.glow}, rgba(0,0,0,0.4))` }}>
                <span className="w-5 h-5 rounded-full" style={{ background: s.color, boxShadow: `0 0 12px ${s.color}` }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[13.5px] truncate">{heartLocked ? "??? (find Elara's last page)" : s.name}</span>
                  <span className={`text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-full ${count > 0 ? "bg-emerald-400/20 text-emerald-100" : "bg-white/10 text-white/40"}`}>×{count}</span>
                </span>
                <span className="block text-[11px] text-white/50 italic">{s.latin} · {s.growthDays}d</span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px]">
                  <span className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${m}%`, background: m > 75 ? "#4ade80" : m > 50 ? "#facc15" : "#fb7185" }} /></span>
                  <span className="text-white/55">{m}% happy now</span>
                  {isSel && count > 0 && <span className="ml-auto text-lime-200 text-[10px] uppercase tracking-widest">equipped</span>}
                </span>
                <span className="mt-1 block text-[11px] text-white/45 leading-snug">{s.personality}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-[12px] text-white/60 leading-relaxed">
        <span className="text-amber-200 font-semibold">Field tips</span> — pods respawn after sleep · harvest a mature plant for 2–4 seeds · {foundJ}/6 pages found. Vines often hide seeds.
      </div>
    </div>
  );
}

function ClimateTab({ climate, onChange, onPreset }: { climate: Climate; onChange: (c: Climate) => void; onPreset: (c: Climate) => void }) {
  const slider = (key: keyof Climate, icon: React.ReactNode, label: string, hint: string, gradient: string) => (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-semibold text-[13px]">{icon}{label}</span>
        <span className="text-[13px] font-bold tabular-nums">{climate[key]}{key === "temp" ? "°" : "%"}</span>
      </div>
      <input type="range" min={0} max={100} value={climate[key]} onChange={(e) => onChange({ ...climate, [key]: Number(e.target.value) })} className="climate-range w-full mt-2" style={{ background: gradient }} />
      <div className="mt-1 text-[11px] text-white/50">{hint}</div>
    </div>
  );
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">Dome breath · live</div>
      {slider("temp", <Thermometer size={14} className="text-orange-300" />, "Temperature", "Fern 40–65 · Ember 68–95 · Gloom <40 · Heart 45–70", "linear-gradient(90deg,#38bdf8,#4ade80,#facc15,#fb923c,#ef4444)")}
      {slider("humidity", <Droplets size={14} className="text-sky-300" />, "Humidity", "Orchid 65+ · Gloom 70+ · Ember <40 · Vine 40–70", "linear-gradient(90deg,#78350f,#38bdf8,#e0f2fe)")}
      {slider("light", <Sun size={14} className="text-amber-200" />, "Light", "Fern <50 shade · Ember 65+ blaze · Gloom <35 dark · Heart ~58", "linear-gradient(90deg,#020617,#854d0e,#fde047,#fff)")}
      <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60 pt-1">Elara's presets</div>
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => onPreset(p.c)} className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-emerald-400/15 p-2.5 text-left transition">
            <div className="flex items-center gap-1.5 font-semibold text-[12.5px]">{p.icon === "sun" ? <Sun size={13} className="text-amber-300" /> : p.icon === "moon" ? <Moon size={13} className="text-sky-300" /> : p.icon === "heart" ? <Heart size={13} className="text-pink-300" /> : <Cloud size={13} className="text-emerald-200" />}{p.name}</div>
            <div className="text-[11px] text-white/50">{p.desc}</div>
            <div className="text-[10.5px] text-white/40 tabular-nums">{p.c.temp}° · {p.c.humidity}% · {p.c.light}%</div>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-sky-200/15 bg-sky-950/30 p-3 text-[12px] text-sky-100/70 leading-relaxed">
        Climate is free to change, but plants feel it overnight. Poor match = slow growth. Watch the “happy” bars in Garden.
      </div>
    </div>
  );
}

function JournalTab({ found, onOpen }: { found: boolean[]; onOpen: (i: number) => void }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/60">Elara Vance · {found.filter(Boolean).length}/6 recovered</div>
      <div className="mt-2 space-y-2">
        {JOURNALS.map((j, i) => (
          <button key={j.id} onClick={() => found[i] && onOpen(i)} className={`w-full text-left rounded-2xl border p-3 transition ${found[i] ? "border-amber-200/25 bg-amber-100/[0.06] hover:bg-amber-100/[0.1]" : "border-white/8 bg-white/[0.02] opacity-70"}`}>
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${found[i] ? "bg-amber-300/20 text-amber-200" : "bg-white/8 text-white/35"}`}><BookOpen size={14} /></span>
              <div className="min-w-0">
                <div className="font-semibold text-[13px] truncate">{found[i] ? `${i + 1} · ${j.title}` : `${i + 1} · Undiscovered page`}</div>
                <div className="text-[11px] text-white/50">{found[i] ? j.date : `Hint: ${j.locationHint}`}</div>
              </div>
              {found[i] ? <Eye size={13} className="ml-auto text-amber-200/70 shrink-0" /> : <MapPin size={13} className="ml-auto text-white/30 shrink-0" />}
            </div>
            {!found[i] && <div className="mt-1.5 text-[11.5px] text-white/45">Search: {j.locationHint}. Look for golden glow.</div>}
            {found[i] && <div className="mt-1.5 text-[11.5px] text-amber-100/60 italic line-clamp-1">“{j.body[0]}”</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

function WildsTab({ vitality, stage, cleared, totalOver, grownLog, foundCount, matureNow, growingNow, hasHeart, canAwaken, onAwaken, weather }: { vitality: number; stage: { name: string; epithet: string; description: string; color: string }; cleared: number; totalOver: number; grownLog: string[]; foundCount: number; matureNow: number; growingNow: number; hasHeart: boolean; canAwaken: boolean; onAwaken: () => void; weather: string }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const bio = new Set(grownLog).size;
  const rows = [
    { label: "Pathways opened", v: cleared, max: totalOver, pct: Math.round((cleared / Math.max(1, totalOver)) * 100), w: "25%" },
    { label: "Plants ever matured", v: Math.min(grownLog.length, 10), max: 10, pct: Math.round((Math.min(grownLog.length, 10) / 10) * 100), w: "45%" },
    { label: "Journal pages", v: foundCount, max: 6, pct: Math.round((foundCount / 6) * 100), w: "15%" },
    { label: "Biodiversity", v: bio, max: 6, pct: Math.round((bio / 6) * 100), w: "15%" },
  ];
  return (
    <div>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/80 to-black/40 p-4 flex items-center gap-4">
        <div className="relative w-[92px] h-[92px] shrink-0">
          <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
            <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
            <circle cx="42" cy="42" r={R} fill="none" stroke={stage.color} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (C * vitality) / 100} className="transition-all duration-700" style={{ filter: `drop-shadow(0 0 6px ${stage.color})` }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-black tabular-nums">{vitality}%</span><span className="text-[9px] uppercase tracking-widest text-white/50">vitality</span></div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">Ecosystem</div>
          <div className="font-serif text-xl font-bold" style={{ color: stage.color }}>{stage.name} <span className="text-white/40 text-sm font-normal italic">· {stage.epithet}</span></div>
          <div className="mt-1 text-[12px] text-white/60 leading-snug">{stage.description}</div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
            <div className="flex justify-between text-[12px]"><span className="text-white/70">{r.label}</span><span className="tabular-nums text-white/50">{r.v}/{r.max} · {r.w}</span></div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-lime-300 transition-all" style={{ width: `${r.pct}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[12px]">
        <div className="flex items-center gap-1.5 text-white/70"><Wind size={13} /> <b>Inside weather</b></div>
        <div className="mt-1 italic text-white/55 capitalize">{weather}</div>
        <div className="mt-2 flex gap-3 text-white/60">
          <span className="flex items-center gap-1"><Flower2 size={13} className="text-pink-300" /> {matureNow} blooming</span>
          <span className="flex items-center gap-1"><Sprout size={13} className="text-lime-300" /> {growingNow} growing</span>
          <span className="flex items-center gap-1"><Star size={13} className="text-amber-200" /> {bio}/6 species ever</span>
        </div>
        {grownLog.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {[...new Set(grownLog)].map((id) => (
              <span key={id} className="rounded-full px-2 py-0.5 text-[11px] border border-white/12" style={{ color: speciesById(id).color, borderColor: `${speciesById(id).color}55`, background: `${speciesById(id).glow}` }}>{speciesById(id).name}</span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 rounded-2xl border p-3 text-[12.5px] leading-relaxed" style={{ borderColor: canAwaken ? "rgba(244,114,182,0.4)" : "rgba(255,255,255,0.1)", background: canAwaken ? "rgba(244,114,182,0.08)" : "rgba(255,255,255,0.03)" }}>
        <div className="font-semibold flex items-center gap-1.5"><Heart size={14} className="text-pink-300" /> Wake the Heart</div>
        <ul className="mt-1.5 space-y-1 text-white/65">
          <li>{hasHeart ? "✓" : "○"} A Heartbloom stands open somewhere</li>
          <li>{vitality >= 75 ? "✓" : "○"} Vitality 75%+ (now {vitality}%)</li>
          <li>○ Press your palm to the central tree (walk beside it, E)</li>
        </ul>
        {canAwaken && <button onClick={onAwaken} className="mt-2 w-full rounded-xl bg-gradient-to-r from-pink-400 to-amber-200 text-emerald-950 font-bold py-2.5 hover:brightness-110">Awaken now</button>}
      </div>
    </div>
  );
}

/* --------------------------------- modals --------------------------------- */
function ModalShell({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ y: 24, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.97 }} onClick={(e) => e.stopPropagation()} className={`relative w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[86vh] overflow-y-auto custom-scroll rounded-3xl border border-amber-100/20 bg-gradient-to-br from-[#f5ead2] to-[#e8d5ae] text-[#2b2114] shadow-2xl`}>
        <button onClick={onClose} className="absolute top-3 right-3 rounded-full bg-black/10 hover:bg-black/20 p-1.5"><X size={16} /></button>
        {children}
      </motion.div>
    </motion.div>
  );
}

function JournalModal({ index, onClose }: { index: number; onClose: () => void }) {
  const j = JOURNALS[index];
  return (
    <ModalShell onClose={onClose}>
      <div className="p-6 lg:p-8">
        <div className="text-[11px] tracking-[0.25em] uppercase text-[#8a6d3b]">Recovered page {index + 1} / 6 · {j.date}</div>
        <h2 className="mt-1 font-serif text-3xl font-bold">“{j.title}”</h2>
        <div className="mt-1 text-[12px] italic text-[#8a6d3b]">found: {j.locationHint}</div>
        <div className="my-4 h-px bg-[#8a6d3b]/25" />
        <div className="space-y-3 font-serif text-[15.5px] leading-relaxed">
          {j.body.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        {j.rewardText && <div className="mt-4 rounded-xl bg-[#2b2114] text-amber-100 px-4 py-3 text-[13px] flex items-center gap-2"><Package size={15} /> {j.rewardText}</div>}
        <div className="mt-4 rounded-xl border border-[#8a6d3b]/30 bg-white/40 px-4 py-3 text-[13px] flex gap-2"><Lightbulb size={15} className="shrink-0 mt-0.5 text-[#8a6d3b]" /><span><b>Gardener's note:</b> {j.tip}</span></div>
        <button onClick={onClose} className="mt-5 w-full rounded-xl bg-[#2b2114] text-amber-100 font-semibold py-3 hover:bg-black">Fold the page away</button>
      </div>
    </ModalShell>
  );
}

function PlantModal({ x, y, seeds, selected, onSelect, climate, onPlant, onClose }: { x: number; y: number; seeds: Record<string, number>; selected: string; onSelect: (id: string) => void; climate: Climate; onPlant: (id: string) => void; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose}>
      <div className="p-6">
        <div className="text-[11px] tracking-[0.25em] uppercase text-[#8a6d3b]">Dark soil · plot ({x}, {y})</div>
        <h2 className="font-serif text-2xl font-bold">Choose a seed</h2>
        <p className="text-[13px] text-[#6b5636]">Watered soil remembers. Match the climate and it will thank you overnight.</p>
        <div className="mt-4 space-y-2">
          {SPECIES.map((s) => {
            const c = seeds[s.id] ?? 0;
            const m = Math.round(climateMatch(s.temp, s.humidity, s.light, climate) * 100);
            return (
              <div key={s.id} className={`rounded-2xl border p-3 flex items-center gap-3 ${selected === s.id ? "border-[#2b2114] bg-white/60" : "border-[#8a6d3b]/25 bg-white/30"}`}>
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.color }}><Sprout size={16} className="text-white" /></span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[14px]">{s.name} <span className="font-normal text-[12px] text-[#6b5636]">×{c} · {m}% happy</span></div>
                  <div className="text-[12px] text-[#6b5636]">{s.temp[0]}–{s.temp[1]}° · H {s.humidity[0]}–{s.humidity[1]} · L {s.light[0]}–{s.light[1]}</div>
                </div>
                <button disabled={c <= 0} onClick={() => { onSelect(s.id); onPlant(s.id); }} className={`rounded-lg px-3 py-2 text-[13px] font-bold ${c > 0 ? "bg-[#2b2114] text-amber-100 hover:bg-black" : "bg-black/10 text-black/30 cursor-not-allowed"}`}>{c > 0 ? "Plant" : "None"}</button>
              </div>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} wide>
      <div className="p-6 lg:p-8">
        <div className="text-[11px] tracking-[0.25em] uppercase text-[#8a6d3b]">Field guide</div>
        <h2 className="font-serif text-3xl font-bold">Botanist's handbook</h2>
        <div className="mt-4 grid sm:grid-cols-2 gap-3 text-[13.5px] leading-relaxed">
          {[
            { t: "Move", d: "WASD / arrows, or click any glowing path. Clicking a far tile auto-walks (BFS). Vines, water and consoles block.", i: <Compass size={15} /> },
            { t: "Act (E)", d: "One contextual button does everything: cut, collect, read, plant, water, gather, refill, sleep, awaken. Stand beside the target.", i: <Sparkles size={15} /> },
            { t: "Energy & water", d: "Cut 15 · plant 5 · water 2. Sleep restores energy. Pond (NE) refills the can. Humid nights gift +1 dew.", i: <Zap size={15} /> },
            { t: "Growing", d: "Plants drink 1 water/night. Growth = base × climate match. Thirsty plants stall (orange drop). Mature = harvest for 2–4 seeds.", i: <Sprout size={15} /> },
            { t: "Climate", d: "Free to tune. Each species shows % happy. Use presets or consoles. Nights apply the match — check Garden tab before sleeping.", i: <FlaskConical size={15} /> },
            { t: "Winning", d: "Vitality = paths 25 + harvests 45 + pages 15 + species 15. Grow Heartbloom (last page) + 75% vitality → touch Heart.", i: <Heart size={15} /> },
          ].map((c, i) => (
            <div key={i} className="rounded-2xl border border-[#8a6d3b]/25 bg-white/40 p-3.5"><div className="flex items-center gap-1.5 font-bold">{c.i}{c.t}</div><div className="mt-1 text-[#5c4a2e]">{c.d}</div></div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-[#2b2114] text-amber-100/90 p-4 text-[13px] leading-relaxed">
          <b>Climates at a glance</b> — Fern: cool·wet·shade · Ember: hot·dry·blaze · Orchid: warm·soaked·soft · Gloom: cold·soaked·dark · Vine: warm·bright·medium · Heart: 45–70 all.
        </div>
        <button onClick={onClose} className="mt-4 w-full rounded-xl bg-[#2b2114] text-amber-100 font-semibold py-3">Back to the glass</button>
      </div>
    </ModalShell>
  );
}

function VictoryModal({ day, vitality, grownLog, onClose }: { day: number; vitality: number; grownLog: string[]; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur" onClick={onClose}>
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-xl rounded-3xl overflow-hidden border border-pink-200/30 bg-gradient-to-br from-[#1c0f1e] via-[#0f2418] to-[#0a1a12] p-8 text-center shadow-[0_0_80px_rgba(244,114,182,0.3)]">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(244,114,182,0.25), transparent 60%), radial-gradient(ellipse at 50% 100%, rgba(52,211,153,0.2), transparent 60%)" }} />
        <Heart size={40} className="mx-auto text-pink-300 animate-pulse drop-shadow-[0_0_20px_rgba(244,114,182,0.9)]" />
        <div className="mt-3 text-[11px] tracking-[0.3em] uppercase text-pink-200/70">The dome exhales</div>
        <h2 className="mt-1 font-serif text-4xl font-black bg-gradient-to-r from-pink-200 via-amber-100 to-emerald-200 bg-clip-text text-transparent">It Remembers You</h2>
        <p className="mt-3 text-[14.5px] text-white/70 leading-relaxed">
          You press your palm to the bark. The Heartbloom opens — pink, then gold — and light runs
          through the veins of the glass like sunrise through honey. Butterflies rise in a spiral.
          Somewhere, a page turns by itself. <i>Elara's last line was for you: “It was never sealed. It was waiting.”</i>
        </p>
        <div className="mt-4 flex justify-center gap-2 flex-wrap text-[12px]">
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">Day {day}</span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{vitality}% vitality</span>
          <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{new Set(grownLog).size}/6 species</span>
        </div>
        <button onClick={onClose} className="mt-5 w-full rounded-xl bg-gradient-to-r from-pink-300 via-amber-200 to-emerald-200 text-emerald-950 font-bold py-3 hover:brightness-110">Keep tending Eden</button>
        <div className="mt-2 text-[11px] text-white/40">You can still explore, complete journals & reach 100%</div>
      </motion.div>
    </motion.div>
  );
}

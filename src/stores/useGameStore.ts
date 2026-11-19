import { create } from 'zustand';
import { STARTER_BLUEPRINTS } from '@/data/starterBlueprints';
import { TECH_TREE } from '@/data/techTree';
import {
  ControlSettings,
  FlightTelemetry,
  GameScreen,
  GraphicsQuality,
  GraphicsSettings,
  PlayerProgress,
  RocketBlueprint,
  SaveSlotData,
  SurfaceSample,
  TrajectoryPrediction,
} from '@/game/core/types';
import {
  deleteSaveSlotFromDB,
  listAllSaveSlots,
  loadSlotFromDB,
  saveSlotToDB,
  supabaseSync,
} from '@/services/storage/saveManager';
import { soundEngine } from '@/services/audio/soundEngine';

export interface ToastMessage {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'danger';
}

const DEFAULT_PROGRESS: PlayerProgress = {
  agencyName: 'ORBITAL COMMAND',
  credits: 25000,
  science: 40,
  completedMissions: [],
  activeMissionId: 'm_first_launch',
  unlockedTech: ['basic_rocketry'],
  collectedSamples: [],
  launchedFlights: 0,
  maxAltitudeReached: 0,
  landedBodies: ['earth'],
  orbitedBodies: [],
  spaceportLevel: 1,
  lastSavedAt: Date.now(),
};

const QUALITY_PRESETS: Record<GraphicsQuality, Omit<GraphicsSettings, 'audioEnabled' | 'masterVolume'>> = {
  low: { quality: 'low', starCount: 1500, shadows: false, clouds: false, particles: false },
  medium: { quality: 'medium', starCount: 3200, shadows: true, clouds: true, particles: true },
  high: { quality: 'high', starCount: 6000, shadows: true, clouds: true, particles: true },
  ultra: { quality: 'ultra', starCount: 10000, shadows: true, clouds: true, particles: true },
};

interface GameStoreState {
  screen: GameScreen;
  activeSlotId: string;
  saveSlots: SaveSlotData[];
  progress: PlayerProgress;
  blueprints: RocketBlueprint[];
  selectedBlueprintId: string;

  // Flight UI state
  telemetry: FlightTelemetry | null;
  trajectory: TrajectoryPrediction | null;
  timeWarp: number;
  mapView: boolean;

  // Overlays / Modals
  activePanel: 'none' | 'missions' | 'tech' | 'saves' | 'settings' | 'profile';
  toasts: ToastMessage[];

  // Settings
  graphics: GraphicsSettings;
  controls: ControlSettings;

  // Actions
  setScreen: (screen: GameScreen) => void;
  setActivePanel: (panel: GameStoreState['activePanel']) => void;
  setMapView: (val: boolean) => void;
  setTimeWarp: (warp: number) => void;
  setTelemetry: (t: FlightTelemetry | null) => void;
  setTrajectory: (tr: TrajectoryPrediction | null) => void;

  // Blueprint management
  selectBlueprint: (id: string) => void;
  saveBlueprint: (bp: RocketBlueprint) => void;
  deleteBlueprint: (id: string) => void;
  getSelectedBlueprint: () => RocketBlueprint;

  // Progression
  addRewards: (credits: number, science: number) => void;
  spendCredits: (amount: number) => boolean;
  completeMission: (missionId: string, title: string, credits: number, science: number) => void;
  unlockTech: (techId: string) => boolean;
  addSurfaceSample: (sample: SurfaceSample) => void;
  recordFlightStats: (maxAlt: number, soiBodyId: string, orbited: boolean, landed: boolean) => void;
  incrementLaunches: () => void;
  upgradeSpaceport: () => boolean;
  setAgencyName: (name: string) => void;

  // Persistence
  initSaves: () => Promise<void>;
  saveCurrentSlot: (slotId?: string, slotName?: string) => Promise<void>;
  loadSlot: (slotId: string) => Promise<void>;
  createNewGame: (slotId: string, agencyName: string) => Promise<void>;
  deleteSlot: (slotId: string) => Promise<void>;

  // Settings & Notifications
  setGraphicsQuality: (q: GraphicsQuality) => void;
  updateGraphics: (patch: Partial<GraphicsSettings>) => void;
  updateControls: (patch: Partial<ControlSettings>) => void;
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  screen: 'main_menu',
  activeSlotId: 'slot_1',
  saveSlots: [],
  progress: { ...DEFAULT_PROGRESS },
  blueprints: [...STARTER_BLUEPRINTS],
  selectedBlueprintId: STARTER_BLUEPRINTS[1].id, // Orbital Vanguard default

  telemetry: null,
  trajectory: null,
  timeWarp: 1,
  mapView: false,

  activePanel: 'none',
  toasts: [],

  graphics: {
    ...QUALITY_PRESETS.high,
    audioEnabled: true,
    masterVolume: 0.45,
  },
  controls: {
    invertPitch: false,
    sensitivity: 1.0,
    showTouchControls: 'auto',
  },

  setScreen: (screen) => {
    soundEngine.playClick();
    set({ screen, activePanel: 'none', mapView: screen === 'solar_map' });
  },

  setActivePanel: (panel) => {
    soundEngine.playClick();
    set((s) => ({ activePanel: s.activePanel === panel ? 'none' : panel }));
  },

  setMapView: (val) => set({ mapView: val }),

  setTimeWarp: (warp) => set({ timeWarp: warp }),

  setTelemetry: (telemetry) => set({ telemetry }),

  setTrajectory: (trajectory) => set({ trajectory }),

  selectBlueprint: (id) => set({ selectedBlueprintId: id }),

  saveBlueprint: (bp) => {
    set((s) => {
      const exists = s.blueprints.some((b) => b.id === bp.id);
      const next = exists
        ? s.blueprints.map((b) => (b.id === bp.id ? { ...bp, updatedAt: Date.now() } : b))
        : [...s.blueprints, { ...bp, createdAt: Date.now(), updatedAt: Date.now() }];
      return { blueprints: next, selectedBlueprintId: bp.id };
    });
    get().saveCurrentSlot();
    get().pushToast({
      title: 'Чертёж сохранён',
      body: `Ракета «${bp.name}» добавлена в ангар.`,
      type: 'success',
    });
  },

  deleteBlueprint: (id) => {
    set((s) => {
      const filtered = s.blueprints.filter((b) => b.id !== id);
      if (filtered.length === 0) return s;
      const nextSelected =
        s.selectedBlueprintId === id ? filtered[0].id : s.selectedBlueprintId;
      return { blueprints: filtered, selectedBlueprintId: nextSelected };
    });
    get().saveCurrentSlot();
  },

  getSelectedBlueprint: () => {
    const s = get();
    return (
      s.blueprints.find((b) => b.id === s.selectedBlueprintId) ??
      s.blueprints[0] ??
      STARTER_BLUEPRINTS[0]
    );
  },

  addRewards: (credits, science) => {
    set((s) => ({
      progress: {
        ...s.progress,
        credits: s.progress.credits + credits,
        science: s.progress.science + science,
      },
    }));
  },

  spendCredits: (amount) => {
    const s = get();
    if (s.progress.credits < amount) return false;
    set({
      progress: {
        ...s.progress,
        credits: s.progress.credits - amount,
      },
    });
    return true;
  },

  completeMission: (missionId, title, credits, science) => {
    const s = get();
    if (s.progress.completedMissions.includes(missionId)) return;
    soundEngine.playMissionComplete();
    set({
      progress: {
        ...s.progress,
        credits: s.progress.credits + credits,
        science: s.progress.science + science,
        completedMissions: [...s.progress.completedMissions, missionId],
      },
    });
    get().pushToast({
      title: `Миссия выполнена: ${title}`,
      body: `Награда: +${credits.toLocaleString()} ₵ и +${science} ⚡ науки`,
      type: 'success',
    });
    get().saveCurrentSlot();
  },

  unlockTech: (techId) => {
    const s = get();
    const node = TECH_TREE.find((t) => t.id === techId);
    if (!node) return false;
    if (s.progress.unlockedTech.includes(techId)) return true;
    const prereqsMet = node.prerequisites.every((p) => s.progress.unlockedTech.includes(p));
    if (!prereqsMet || s.progress.science < node.costScience) return false;

    soundEngine.playMissionComplete();
    set({
      progress: {
        ...s.progress,
        science: s.progress.science - node.costScience,
        unlockedTech: [...s.progress.unlockedTech, techId],
      },
    });
    get().pushToast({
      title: `Технология открыта`,
      body: `«${node.name}» теперь доступна в конструкторе.`,
      type: 'success',
    });
    get().saveCurrentSlot();
    return true;
  },

  addSurfaceSample: (sample) => {
    soundEngine.playMissionComplete();
    set((s) => ({
      progress: {
        ...s.progress,
        science: s.progress.science + sample.scienceValue,
        credits: s.progress.credits + sample.creditValue,
        collectedSamples: [sample, ...s.progress.collectedSamples],
      },
    }));
    get().pushToast({
      title: `Образец собран: ${sample.name}`,
      body: `+${sample.scienceValue} ⚡ науки, +${sample.creditValue.toLocaleString()} ₵`,
      type: 'success',
    });
    get().saveCurrentSlot();
  },

  recordFlightStats: (maxAlt, soiBodyId, orbited, landed) => {
    set((s) => {
      const p = s.progress;
      const nextMaxAlt = Math.max(p.maxAltitudeReached, maxAlt);
      const nextOrbited =
        orbited && !p.orbitedBodies.includes(soiBodyId)
          ? [...p.orbitedBodies, soiBodyId]
          : p.orbitedBodies;
      const nextLanded =
        landed && !p.landedBodies.includes(soiBodyId)
          ? [...p.landedBodies, soiBodyId]
          : p.landedBodies;

      if (
        nextMaxAlt === p.maxAltitudeReached &&
        nextOrbited === p.orbitedBodies &&
        nextLanded === p.landedBodies
      ) {
        return s;
      }
      return {
        progress: {
          ...p,
          maxAltitudeReached: nextMaxAlt,
          orbitedBodies: nextOrbited,
          landedBodies: nextLanded,
        },
      };
    });
  },

  incrementLaunches: () => {
    set((s) => ({
      progress: {
        ...s.progress,
        launchedFlights: s.progress.launchedFlights + 1,
      },
    }));
  },

  upgradeSpaceport: () => {
    const s = get();
    const cost = s.progress.spaceportLevel * 15000;
    if (s.progress.credits < cost || s.progress.spaceportLevel >= 5) return false;
    soundEngine.playMissionComplete();
    set({
      progress: {
        ...s.progress,
        credits: s.progress.credits - cost,
        spaceportLevel: s.progress.spaceportLevel + 1,
      },
    });
    get().pushToast({
      title: 'Космодром модернизирован',
      body: `Уровень инфраструктуры повышен до ${s.progress.spaceportLevel}.`,
      type: 'success',
    });
    get().saveCurrentSlot();
    return true;
  },

  setAgencyName: (name) => {
    set((s) => ({ progress: { ...s.progress, agencyName: name } }));
    get().saveCurrentSlot();
  },

  initSaves: async () => {
    const slots = await listAllSaveSlots();
    set({ saveSlots: slots });
    if (slots.length > 0) {
      const latest = slots[0];
      set({
        activeSlotId: latest.slotId,
        progress: { ...DEFAULT_PROGRESS, ...latest.progress },
        blueprints: latest.blueprints.length > 0 ? latest.blueprints : [...STARTER_BLUEPRINTS],
        selectedBlueprintId: latest.selectedBlueprintId || STARTER_BLUEPRINTS[1].id,
      });
    }
  },

  saveCurrentSlot: async (slotId, slotName) => {
    const s = get();
    const targetId = slotId ?? s.activeSlotId;
    const data: SaveSlotData = {
      slotId: targetId,
      name: slotName ?? s.progress.agencyName,
      updatedAt: Date.now(),
      progress: { ...s.progress, lastSavedAt: Date.now() },
      blueprints: s.blueprints,
      selectedBlueprintId: s.selectedBlueprintId,
    };
    await saveSlotToDB(data);
    supabaseSync.syncSlot(data).catch(() => {});
    const slots = await listAllSaveSlots();
    set({ saveSlots: slots, activeSlotId: targetId });
  },

  loadSlot: async (slotId) => {
    const data = await loadSlotFromDB(slotId);
    if (!data) return;
    set({
      activeSlotId: data.slotId,
      progress: { ...DEFAULT_PROGRESS, ...data.progress },
      blueprints: data.blueprints.length > 0 ? data.blueprints : [...STARTER_BLUEPRINTS],
      selectedBlueprintId: data.selectedBlueprintId || STARTER_BLUEPRINTS[1].id,
      screen: 'spaceport',
      activePanel: 'none',
    });
    get().pushToast({
      title: 'Сохранение загружено',
      body: `Космическая программа «${data.progress.agencyName}» восстановлена.`,
      type: 'info',
    });
  },

  createNewGame: async (slotId, agencyName) => {
    const fresh: PlayerProgress = {
      ...DEFAULT_PROGRESS,
      agencyName: agencyName.trim() || 'ORBITAL COMMAND',
      lastSavedAt: Date.now(),
    };
    set({
      activeSlotId: slotId,
      progress: fresh,
      blueprints: [...STARTER_BLUEPRINTS],
      selectedBlueprintId: STARTER_BLUEPRINTS[1].id,
      screen: 'spaceport',
      activePanel: 'none',
    });
    await get().saveCurrentSlot(slotId, fresh.agencyName);
  },

  deleteSlot: async (slotId) => {
    await deleteSaveSlotFromDB(slotId);
    const slots = await listAllSaveSlots();
    set({ saveSlots: slots });
  },

  setGraphicsQuality: (q) => {
    set((s) => ({
      graphics: {
        ...s.graphics,
        ...QUALITY_PRESETS[q],
      },
    }));
  },

  updateGraphics: (patch) => {
    set((s) => {
      const next = { ...s.graphics, ...patch };
      soundEngine.setConfig(next.audioEnabled, next.masterVolume);
      return { graphics: next };
    });
  },

  updateControls: (patch) => {
    set((s) => ({ controls: { ...s.controls, ...patch } }));
  },

  pushToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 5200);
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

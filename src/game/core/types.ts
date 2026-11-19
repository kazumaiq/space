export type GameScreen =
  | 'main_menu'
  | 'spaceport'
  | 'builder'
  | 'flight'
  | 'solar_map';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type PartCategory =
  | 'command'
  | 'fuel'
  | 'engine'
  | 'structural'
  | 'aero'
  | 'utility'
  | 'science';

export type AttachMode = 'stack' | 'radial';

export interface RocketPartDef {
  id: string;
  name: string;
  category: PartCategory;
  attachMode: AttachMode;
  description: string;
  cost: number;
  dryMass: number; // metric tons (t)
  fuelCapacity: number; // metric tons (t) of propellant
  oxidizerRatio?: number;
  thrustASL?: number; // kN at sea level
  thrustVac?: number; // kN in vacuum
  ispASL?: number; // seconds at sea level
  ispVac?: number; // seconds in vacuum
  isSolidBooster?: boolean;
  isDecoupler?: boolean;
  isParachute?: boolean;
  isLandingLeg?: boolean;
  isSolarPanel?: boolean;
  isScience?: boolean;
  isCommand?: boolean;
  batteryCapacity?: number; // kWh
  powerGen?: number; // kW
  dragCoeff: number;
  width: number; // meters (diameter)
  height: number; // meters
  techRequired?: string; // tech node id, undefined = starter
  color: string;
  accentColor: string;
  shape:
    | 'capsule'
    | 'probe'
    | 'tank_small'
    | 'tank_medium'
    | 'tank_large'
    | 'engine_bell'
    | 'engine_vac'
    | 'srb'
    | 'decoupler'
    | 'fairing'
    | 'parachute'
    | 'landing_leg'
    | 'solar_panel'
    | 'science_bay'
    | 'battery';
}

export interface PlacedPart {
  uid: string;
  partId: string;
  stage: number; // 0 = top/last stage, higher = fires earlier
  position: [number, number, number]; // local VAB coords in meters (Y up)
  rotation: [number, number, number]; // radians
  scale: number; // 0.75 - 1.5
  symmetry?: 1 | 2 | 4; // for radial parts
  radialAngle?: number;
  attachedToUid?: string;
}

export interface RocketBlueprint {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  parts: PlacedPart[];
  isBuiltIn?: boolean;
}

export interface StageStats {
  stageIndex: number;
  wetMass: number; // t
  dryMass: number; // t
  fuelMass: number; // t
  thrustASL: number; // kN
  thrustVac: number; // kN
  ispVac: number; // s
  twrASL: number;
  deltaV: number; // m/s
  burnTime: number; // s
}

export interface RocketStats {
  totalWetMass: number; // t
  totalDryMass: number; // t
  totalFuel: number; // t
  totalCost: number;
  launchThrustASL: number; // kN
  launchTWR: number;
  totalDeltaV: number; // m/s
  partCount: number;
  hasCommand: boolean;
  hasEngine: boolean;
  hasParachute: boolean;
  hasLandingLegs: boolean;
  hasScience: boolean;
  stages: StageStats[];
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CelestialBody {
  id: string;
  name: string;
  nameRu: string;
  type: 'star' | 'planet' | 'moon';
  parentId: string | null;
  radius: number; // meters
  mass: number; // kg
  mu: number; // G * M (m^3 / s^2)
  surfaceGravity: number; // m/s^2
  atmosphereHeight: number; // meters (0 if airless)
  atmosphereDensity: number; // kg/m^3 at sea level
  scaleHeight: number; // meters
  orbitRadius: number; // meters from parent center
  orbitPeriod: number; // seconds
  orbitInitialAngle: number; // radians
  rotationPeriod: number; // seconds
  soiRadius: number; // Sphere of Influence in meters
  surfaceTempK: number;
  color: string;
  atmosphereColor?: string;
  resources: string[];
  description: string;
  playable: boolean;
}

export interface OrbitalElements {
  bodyId: string;
  semiMajorAxis: number; // meters
  eccentricity: number;
  inclination: number; // radians
  apoapsis: number; // altitude above surface in meters
  periapsis: number; // altitude above surface in meters
  orbitalPeriod: number; // seconds (Infinity if escape)
  timeToApoapsis: number; // seconds
  timeToPeriapsis: number; // seconds
  isEscape: boolean;
  isSuborbital: boolean;
  isStableOrbit: boolean;
  specificEnergy: number;
}

export type FlightPhase =
  | 'PRELAUNCH'
  | 'ASCENT'
  | 'ATMOSPHERIC'
  | 'SUBORBITAL'
  | 'LOW_ORBIT'
  | 'HIGH_ORBIT'
  | 'ESCAPE'
  | 'LUNAR_TRANSFER'
  | 'LUNAR_ORBIT'
  | 'DESCENT'
  | 'LANDED'
  | 'CRASHED';

export type SasMode = 'OFF' | 'STABILITY' | 'PROGRADE' | 'RETROGRADE';

export interface ActiveStagePart {
  uid: string;
  partId: string;
  stage: number;
  fuelRemaining: number; // tons
  fuelCapacity: number; // tons
  active: boolean;
  detached: boolean;
  position: [number, number, number];
  scale: number;
  radialAngle?: number;
}

export interface DetachedDebris {
  id: string;
  parts: ActiveStagePart[];
  position: Vec3; // world meters relative to SOI body
  velocity: Vec3;
  angularVel: Vec3;
  createdAt: number;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  z: number;
  bodyId: string;
}

export interface TrajectoryPrediction {
  points: TrajectoryPoint[];
  encounterBodyId: string | null;
  encounterDistance: number | null;
  apoapsisPos: Vec3 | null;
  periapsisPos: Vec3 | null;
}

export interface FlightTelemetry {
  phase: FlightPhase;
  soiBodyId: string;
  altitude: number; // m above surface
  speed: number; // m/s relative to SOI body
  verticalSpeed: number; // m/s
  horizontalSpeed: number; // m/s
  acceleration: number; // m/s^2
  gForce: number;
  thrustKN: number;
  throttle: number; // 0..1
  massTons: number;
  fuelRemaining: number; // tons
  fuelTotal: number; // tons
  twr: number;
  dynamicPressure: number; // Pa
  atmosphericTempK: number;
  electricCharge: number; // 0..100%
  currentStage: number;
  maxStage: number;
  missionTime: number; // seconds
  orbital: OrbitalElements;
  sasMode: SasMode;
  parachutesDeployed: boolean;
  landingLegsDeployed: boolean;
  solarPanelsDeployed: boolean;
  roverDeployed: boolean;
  scienceCollectedHere: boolean;
  pitch: number; // radians
  yaw: number; // radians
  roll: number; // radians
}

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  rewardCredits: number;
  rewardScience: number;
  targetBodyId: string;
  category: 'altitude' | 'orbit' | 'lunar' | 'science' | 'landing' | 'station';
  requirementText: string;
  prerequisiteId?: string;
}

export interface TechNode {
  id: string;
  name: string;
  branch: 'propulsion' | 'structures' | 'deepspace';
  tier: 1 | 2 | 3;
  costScience: number;
  description: string;
  unlocksParts: string[];
  prerequisites: string[];
}

export interface SurfaceSample {
  id: string;
  bodyId: string;
  name: string;
  scienceValue: number;
  creditValue: number;
  collectedAt: number;
}

export interface GraphicsSettings {
  quality: GraphicsQuality;
  starCount: number;
  shadows: boolean;
  clouds: boolean;
  particles: boolean;
  audioEnabled: boolean;
  masterVolume: number;
}

export interface ControlSettings {
  invertPitch: boolean;
  sensitivity: number;
  showTouchControls: 'auto' | 'always' | 'off';
}

export interface PlayerProgress {
  agencyName: string;
  credits: number;
  science: number;
  completedMissions: string[];
  activeMissionId: string | null;
  unlockedTech: string[];
  collectedSamples: SurfaceSample[];
  launchedFlights: number;
  maxAltitudeReached: number;
  landedBodies: string[];
  orbitedBodies: string[];
  spaceportLevel: number;
  lastSavedAt: number;
}

export interface SaveSlotData {
  slotId: string;
  name: string;
  updatedAt: number;
  progress: PlayerProgress;
  blueprints: RocketBlueprint[];
  selectedBlueprintId: string;
}

import { CelestialBody, Vec3 } from '@/game/core/types';

/**
 * Scaled Solar System (1:10 planetary scale, KSP-inspired) so orbital launches,
 * trans-lunar injections, and planetary landings follow real Keplerian physics
 * while remaining exciting and playable in real-time browser sessions.
 *
 * Earth radius: 600 km, g0 = 9.81 m/s^2, LEO ~2,250 m/s, Karman line 70 km.
 * Moon orbit: 12,000 km from Earth, radius 175 km, g0 = 1.62 m/s^2, SOI 2,400 km.
 */
export const G_CONST = 6.6743e-11;

export const CELESTIAL_BODIES: CelestialBody[] = [
  {
    id: 'earth',
    name: 'Earth',
    nameRu: 'Земля',
    type: 'planet',
    parentId: null,
    radius: 600_000, // 600 km
    mass: 5.2915e22,
    mu: 9.81 * 600_000 * 600_000, // 3.5316e12 m^3/s^2 -> exact 9.81 m/s^2 at surface
    surfaceGravity: 9.81,
    atmosphereHeight: 70_000, // 70 km
    atmosphereDensity: 1.225,
    scaleHeight: 5_600,
    orbitRadius: 0,
    orbitPeriod: 0,
    orbitInitialAngle: 0,
    rotationPeriod: 21_600, // 6h day cycle
    soiRadius: 84_000_000,
    surfaceTempK: 288,
    color: '#2563eb',
    atmosphereColor: '#38bdf8',
    resources: ['Вода', 'Азот/Кислород', 'Силикаты'],
    description: 'Родная планета с плотной атмосферой, океанами и стартовым космодромом.',
    playable: true,
  },
  {
    id: 'moon',
    name: 'Moon',
    nameRu: 'Луна',
    type: 'moon',
    parentId: 'earth',
    radius: 175_000, // 175 km
    mass: 7.43e20,
    mu: 1.62 * 175_000 * 175_000, // 4.96125e10 m^3/s^2 -> exact 1.62 m/s^2 at surface
    surfaceGravity: 1.62,
    atmosphereHeight: 0,
    atmosphereDensity: 0,
    scaleHeight: 1,
    orbitRadius: 12_000_000, // 12,000 km
    orbitPeriod: 138_984, // Kepler T = 2*pi*sqrt(a^3/mu_earth)
    orbitInitialAngle: 0.65,
    rotationPeriod: 138_984,
    soiRadius: 2_400_000, // 2,400 km
    surfaceTempK: 220,
    color: '#94a3b8',
    resources: ['Гелий-3', 'Лунный реголит', 'Титан', 'Водяной лёд'],
    description: 'Естественный спутник Земли. Идеальная первая цель для орбитальных и посадочных миссий.',
    playable: true,
  },
  {
    id: 'mars',
    name: 'Mars',
    nameRu: 'Марс',
    type: 'planet',
    parentId: 'earth', // Simplified local system reference for deep-space navigation
    radius: 320_000,
    mass: 5.7e21,
    mu: 3.71 * 320_000 * 320_000,
    surfaceGravity: 3.71,
    atmosphereHeight: 50_000,
    atmosphereDensity: 0.02,
    scaleHeight: 8_000,
    orbitRadius: 48_000_000,
    orbitPeriod: 1_111_000,
    orbitInitialAngle: 2.4,
    rotationPeriod: 22_200,
    soiRadius: 4_800_000,
    surfaceTempK: 210,
    color: '#dc4a2b',
    atmosphereColor: '#f97316',
    resources: ['Оксид железа', 'Подповерхностный лёд', 'Перхлораты'],
    description: 'Красная планета с разреженной атмосферой и следами древних океанов.',
    playable: true,
  },
  {
    id: 'phobos',
    name: 'Phobos',
    nameRu: 'Фобос',
    type: 'moon',
    parentId: 'mars',
    radius: 18_000,
    mass: 1.1e18,
    mu: 0.08 * 18_000 * 18_000,
    surfaceGravity: 0.08,
    atmosphereHeight: 0,
    atmosphereDensity: 0,
    scaleHeight: 1,
    orbitRadius: 950_000,
    orbitPeriod: 28_000,
    orbitInitialAngle: 1.1,
    rotationPeriod: 28_000,
    soiRadius: 120_000,
    surfaceTempK: 233,
    color: '#78716c',
    resources: ['Углеродистые породы', 'Редкие металлы'],
    description: 'Внутренний спутник Марса с крайне низкой гравитацией.',
    playable: false,
  },
  {
    id: 'deimos',
    name: 'Deimos',
    nameRu: 'Деймос',
    type: 'moon',
    parentId: 'mars',
    radius: 12_000,
    mass: 3.5e17,
    mu: 0.04 * 12_000 * 12_000,
    surfaceGravity: 0.04,
    atmosphereHeight: 0,
    atmosphereDensity: 0,
    scaleHeight: 1,
    orbitRadius: 1_800_000,
    orbitPeriod: 75_000,
    orbitInitialAngle: 4.0,
    rotationPeriod: 75_000,
    soiRadius: 90_000,
    surfaceTempK: 233,
    color: '#a8a29e',
    resources: ['Силикаты', 'Углерод'],
    description: 'Внешний малый спутник Марса.',
    playable: false,
  },
  {
    id: 'venus',
    name: 'Venus',
    nameRu: 'Венера',
    type: 'planet',
    parentId: 'earth',
    radius: 580_000,
    mass: 4.4e22,
    mu: 8.87 * 580_000 * 580_000,
    surfaceGravity: 8.87,
    atmosphereHeight: 90_000,
    atmosphereDensity: 6.5,
    scaleHeight: 7_200,
    orbitRadius: 34_000_000,
    orbitPeriod: 680_000,
    orbitInitialAngle: -1.6,
    rotationPeriod: -180_000,
    soiRadius: 5_500_000,
    surfaceTempK: 737,
    color: '#eab308',
    atmosphereColor: '#fde047',
    resources: ['Серная кислота', 'Углекислый газ', 'Базальт'],
    description: 'Планета со сверхплотной атмосферой и экстремальным парниковым эффектом.',
    playable: false,
  },
  {
    id: 'mercury',
    name: 'Mercury',
    nameRu: 'Меркурий',
    type: 'planet',
    parentId: 'earth',
    radius: 244_000,
    mass: 3.3e21,
    mu: 3.7 * 244_000 * 244_000,
    surfaceGravity: 3.7,
    atmosphereHeight: 0,
    atmosphereDensity: 0,
    scaleHeight: 1,
    orbitRadius: 68_000_000,
    orbitPeriod: 1_650_000,
    orbitInitialAngle: 3.9,
    rotationPeriod: 120_000,
    soiRadius: 3_000_000,
    surfaceTempK: 440,
    color: '#737373',
    resources: ['Железное ядро', 'Платиноиды'],
    description: 'Ближайшая к Солнцу каменистая планета с огромными перепадами температур.',
    playable: false,
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    nameRu: 'Юпитер',
    type: 'planet',
    parentId: 'earth',
    radius: 2_200_000,
    mass: 1.8e24,
    mu: 24.79 * 2_200_000 * 2_200_000,
    surfaceGravity: 24.79,
    atmosphereHeight: 200_000,
    atmosphereDensity: 4.0,
    scaleHeight: 15_000,
    orbitRadius: 95_000_000,
    orbitPeriod: 3_200_000,
    orbitInitialAngle: 0.9,
    rotationPeriod: 9_800,
    soiRadius: 18_000_000,
    surfaceTempK: 165,
    color: '#d97706',
    atmosphereColor: '#fbbf24',
    resources: ['Водород', 'Гелий-3'],
    description: 'Крупнейший газовый гигант системы.',
    playable: false,
  },
  {
    id: 'europa',
    name: 'Europa',
    nameRu: 'Европа',
    type: 'moon',
    parentId: 'jupiter',
    radius: 156_000,
    mass: 4.8e20,
    mu: 1.31 * 156_000 * 156_000,
    surfaceGravity: 1.31,
    atmosphereHeight: 0,
    atmosphereDensity: 0,
    scaleHeight: 1,
    orbitRadius: 6_500_000,
    orbitPeriod: 88_000,
    orbitInitialAngle: 2.1,
    rotationPeriod: 88_000,
    soiRadius: 900_000,
    surfaceTempK: 102,
    color: '#cbd5e1',
    resources: ['Подлёдный океан', 'Водяной лёд'],
    description: 'Ледяной спутник Юпитера со скрытым океаном.',
    playable: false,
  },
  {
    id: 'saturn',
    name: 'Saturn',
    nameRu: 'Сатурн',
    type: 'planet',
    parentId: 'earth',
    radius: 1_900_000,
    mass: 1.0e24,
    mu: 10.44 * 1_900_000 * 1_900_000,
    surfaceGravity: 10.44,
    atmosphereHeight: 180_000,
    atmosphereDensity: 3.2,
    scaleHeight: 14_000,
    orbitRadius: 135_000_000,
    orbitPeriod: 5_400_000,
    orbitInitialAngle: -0.7,
    rotationPeriod: 10_600,
    soiRadius: 16_000_000,
    surfaceTempK: 134,
    color: '#fde68a',
    atmosphereColor: '#fcd34d',
    resources: ['Водород', 'Метан', 'Кольцевой лёд'],
    description: 'Газовый гигант с величественной системой колец.',
    playable: false,
  },
  {
    id: 'titan',
    name: 'Titan',
    nameRu: 'Титан',
    type: 'moon',
    parentId: 'saturn',
    radius: 257_000,
    mass: 1.34e21,
    mu: 1.35 * 257_000 * 257_000,
    surfaceGravity: 1.35,
    atmosphereHeight: 85_000,
    atmosphereDensity: 1.8,
    scaleHeight: 11_000,
    orbitRadius: 7_200_000,
    orbitPeriod: 120_000,
    orbitInitialAngle: 0.4,
    rotationPeriod: 120_000,
    soiRadius: 1_200_000,
    surfaceTempK: 94,
    color: '#f59e0b',
    atmosphereColor: '#fb923c',
    resources: ['Жидкий метан', 'Азот', 'Органические соединения'],
    description: 'Крупнейший спутник Сатурна с плотной азотной атмосферой и метановыми морями.',
    playable: false,
  },
];

export const BODY_MAP: Record<string, CelestialBody> = Object.fromEntries(
  CELESTIAL_BODIES.map((b) => [b.id, b])
);

export function getBodyById(id: string): CelestialBody {
  return BODY_MAP[id] ?? BODY_MAP['earth'];
}

/**
 * Computes a body's position in Earth-centered inertial coordinates (meters) at simulation time `simTime` (s).
 */
export function getBodyWorldPosition(bodyId: string, simTime: number): Vec3 {
  const body = getBodyById(bodyId);
  if (!body.parentId || body.orbitRadius === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const parentPos = getBodyWorldPosition(body.parentId, simTime);
  const angularVel = body.orbitPeriod > 0 ? (2 * Math.PI) / body.orbitPeriod : 0;
  const angle = body.orbitInitialAngle + angularVel * simTime;
  return {
    x: parentPos.x + Math.cos(angle) * body.orbitRadius,
    y: parentPos.y,
    z: parentPos.z + Math.sin(angle) * body.orbitRadius,
  };
}

/**
 * Computes a body's instantaneous orbital velocity in Earth-centered inertial frame (m/s).
 */
export function getBodyWorldVelocity(bodyId: string, simTime: number): Vec3 {
  const body = getBodyById(bodyId);
  if (!body.parentId || body.orbitRadius === 0 || body.orbitPeriod === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const parentVel = getBodyWorldVelocity(body.parentId, simTime);
  const angularVel = (2 * Math.PI) / body.orbitPeriod;
  const angle = body.orbitInitialAngle + angularVel * simTime;
  const speed = angularVel * body.orbitRadius;
  return {
    x: parentVel.x - Math.sin(angle) * speed,
    y: parentVel.y,
    z: parentVel.z + Math.cos(angle) * speed,
  };
}

import { MISSIONS_CATALOG } from '@/data/missions';
import { FlightTelemetry, MissionDef } from '@/game/core/types';

/**
 * Evaluates live telemetry and returns any newly completed mission definitions.
 */
export function evaluateMissions(
  telemetry: FlightTelemetry,
  completedIds: string[],
  hasScienceModule: boolean,
  collectedLunarSample: boolean
): MissionDef[] {
  const newlyCompleted: MissionDef[] = [];

  for (const m of MISSIONS_CATALOG) {
    if (completedIds.includes(m.id)) continue;

    let achieved = false;
    switch (m.id) {
      case 'm_first_launch':
        achieved = telemetry.soiBodyId === 'earth' && telemetry.altitude >= 10_000;
        break;
      case 'm_karman_line':
        achieved = telemetry.soiBodyId === 'earth' && telemetry.altitude >= 100_000;
        break;
      case 'm_first_orbit':
        achieved =
          telemetry.soiBodyId === 'earth' &&
          telemetry.orbital.isStableOrbit &&
          telemetry.orbital.periapsis >= 75_000;
        break;
      case 'm_orbital_science':
        achieved =
          telemetry.soiBodyId === 'earth' &&
          telemetry.altitude >= 80_000 &&
          telemetry.scienceCollectedHere &&
          hasScienceModule;
        break;
      case 'm_lunar_soi':
        achieved = telemetry.soiBodyId === 'moon';
        break;
      case 'm_lunar_orbit':
        achieved = telemetry.soiBodyId === 'moon' && telemetry.orbital.isStableOrbit;
        break;
      case 'm_lunar_landing':
        achieved = telemetry.soiBodyId === 'moon' && telemetry.phase === 'LANDED';
        break;
      case 'm_lunar_rover':
        achieved = telemetry.soiBodyId === 'moon' && collectedLunarSample;
        break;
      case 'm_station_core':
        achieved =
          telemetry.soiBodyId === 'earth' &&
          telemetry.orbital.isStableOrbit &&
          telemetry.orbital.periapsis >= 200_000 &&
          hasScienceModule;
        break;
    }

    if (achieved) {
      newlyCompleted.push(m);
    }
  }

  return newlyCompleted;
}

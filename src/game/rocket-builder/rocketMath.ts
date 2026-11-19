import { getPartDef } from '@/data/partsCatalog';
import { PlacedPart, RocketStats, StageStats } from '@/game/core/types';

const G0 = 9.80665;

export function calculateRocketStats(parts: PlacedPart[]): RocketStats {
  if (parts.length === 0) {
    return {
      totalWetMass: 0,
      totalDryMass: 0,
      totalFuel: 0,
      totalCost: 0,
      launchThrustASL: 0,
      launchTWR: 0,
      totalDeltaV: 0,
      partCount: 0,
      hasCommand: false,
      hasEngine: false,
      hasParachute: false,
      hasLandingLegs: false,
      hasScience: false,
      stages: [],
    };
  }

  let totalDryMass = 0;
  let totalFuel = 0;
  let totalCost = 0;
  let hasCommand = false;
  let hasEngine = false;
  let hasParachute = false;
  let hasLandingLegs = false;
  let hasScience = false;

  let maxStage = 0;

  for (const p of parts) {
    const def = getPartDef(p.partId);
    if (!def) continue;
    const scaleMass = Math.pow(p.scale || 1, 2);
    totalDryMass += def.dryMass * scaleMass;
    totalFuel += def.fuelCapacity * scaleMass;
    totalCost += def.cost;
    if (def.isCommand) hasCommand = true;
    if ((def.thrustVac ?? 0) > 0) hasEngine = true;
    if (def.isParachute) hasParachute = true;
    if (def.isLandingLeg) hasLandingLegs = true;
    if (def.isScience) hasScience = true;
    if (p.stage > maxStage) maxStage = p.stage;
  }

  const totalWetMass = totalDryMass + totalFuel;

  // Stage-by-stage Tsiolkovsky Delta-V calculation (firing from maxStage down to 0)
  const stages: StageStats[] = [];
  let totalDeltaV = 0;
  let launchThrustASL = 0;

  for (let s = maxStage; s >= 0; s--) {
    // All parts still attached during stage s have stage <= s
    let wetMass = 0;
    let stageFuel = 0;
    let stageThrustASL = 0;
    let stageThrustVac = 0;
    let massFlowVac = 0;

    for (const p of parts) {
      if (p.stage > s) continue;
      const def = getPartDef(p.partId);
      if (!def) continue;
      const scaleMass = Math.pow(p.scale || 1, 2);
      wetMass += def.dryMass * scaleMass + def.fuelCapacity * scaleMass;

      if (p.stage === s) {
        stageFuel += def.fuelCapacity * scaleMass;
        if ((def.thrustVac ?? 0) > 0) {
          const tASL = (def.thrustASL ?? 0) * (p.scale || 1);
          const tVac = (def.thrustVac ?? 0) * (p.scale || 1);
          const ispV = def.ispVac ?? 300;
          stageThrustASL += tASL;
          stageThrustVac += tVac;
          // mass flow in metric tons/sec: kN / (m/s^2 * s) = t/s
          massFlowVac += tVac / (ispV * G0);
        }
      }
    }

    if (s === maxStage) {
      launchThrustASL = stageThrustASL;
    }

    const dryMassAfterBurn = Math.max(0.1, wetMass - stageFuel);
    const effectiveIspVac = massFlowVac > 0 ? stageThrustVac / (massFlowVac * G0) : 0;
    const twrASL = wetMass > 0 ? stageThrustASL / (wetMass * G0) : 0;
    const deltaV =
      stageFuel > 0 && effectiveIspVac > 0 && wetMass > dryMassAfterBurn
        ? effectiveIspVac * G0 * Math.log(wetMass / dryMassAfterBurn)
        : 0;
    const burnTime = massFlowVac > 0 ? stageFuel / massFlowVac : 0;

    totalDeltaV += deltaV;
    stages.push({
      stageIndex: s,
      wetMass,
      dryMass: dryMassAfterBurn,
      fuelMass: stageFuel,
      thrustASL: stageThrustASL,
      thrustVac: stageThrustVac,
      ispVac: effectiveIspVac,
      twrASL,
      deltaV,
      burnTime,
    });
  }

  const launchTWR = totalWetMass > 0 ? launchThrustASL / (totalWetMass * G0) : 0;

  return {
    totalWetMass,
    totalDryMass,
    totalFuel,
    totalCost,
    launchThrustASL,
    launchTWR,
    totalDeltaV,
    partCount: parts.length,
    hasCommand,
    hasEngine,
    hasParachute,
    hasLandingLegs,
    hasScience,
    stages,
  };
}

/**
 * Re-stacks all stack-mode parts vertically without gaps so the rocket is clean and cohesive.
 */
export function autoStackRocketParts(parts: PlacedPart[]): PlacedPart[] {
  const stackParts = parts
    .filter((p) => getPartDef(p.partId)?.attachMode === 'stack')
    .sort((a, b) => a.position[1] - b.position[1]);
  const radialParts = parts.filter((p) => getPartDef(p.partId)?.attachMode === 'radial');

  let currentY = 0;
  const updatedStack = stackParts.map((p) => {
    const def = getPartDef(p.partId);
    const h = (def?.height ?? 1.5) * (p.scale || 1);
    const centerY = currentY + h / 2;
    currentY += h;
    return {
      ...p,
      position: [0, Number(centerY.toFixed(3)), 0] as [number, number, number],
    };
  });

  return [...updatedStack, ...radialParts];
}

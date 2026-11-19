import * as THREE from 'three';
import { getPartDef } from '@/data/partsCatalog';
import {
  getBodyById,
  getBodyWorldPosition,
  getBodyWorldVelocity,
} from '@/data/solarSystem';
import {
  ActiveStagePart,
  DetachedDebris,
  FlightPhase,
  FlightTelemetry,
  RocketBlueprint,
  SasMode,
  Vec3,
} from '@/game/core/types';
import { computeOrbitalElements } from '@/game/orbital/kepler';

const G0 = 9.80665;

export interface ControlInputs {
  pitch: number; // -1..1
  yaw: number; // -1..1
  roll: number; // -1..1
  throttleDelta: number; // -1..1
}

export class FlightEngine {
  public soiBodyId = 'earth';
  public simTime = 0;
  public missionTime = 0;

  // Position & velocity in active SOI body's inertial frame (meters, m/s)
  public position: Vec3 = { x: 0, y: 600_005, z: 0 };
  public velocity: Vec3 = { x: 0, y: 0, z: 0 };

  // Rocket orientation quaternion (+Y is rocket nose)
  public orientation = new THREE.Quaternion();
  public angularVelocity = new THREE.Vector3(0, 0, 0);

  public throttle = 0;
  public currentStage = 0;
  public maxStage = 0;
  public ignited = false;
  public launched = false;
  public crashed = false;
  public landed = true;

  public sasMode: SasMode = 'STABILITY';
  public parachutesDeployed = false;
  public landingLegsDeployed = false;
  public solarPanelsDeployed = false;
  public roverDeployed = false;
  public electricCharge = 100;
  public scienceCollectedHere = false;

  public parts: ActiveStagePart[] = [];
  public debris: DetachedDebris[] = [];

  private lastAccel = 0;
  private lastThrustKN = 0;
  private lastDynPressure = 0;
  private lastTempK = 288;

  public loadBlueprint(blueprint: RocketBlueprint): void {
    this.soiBodyId = 'earth';
    this.missionTime = 0;
    this.ignited = false;
    this.launched = false;
    this.crashed = false;
    this.landed = true;
    this.throttle = 0.85;
    this.sasMode = 'STABILITY';
    this.parachutesDeployed = false;
    this.landingLegsDeployed = false;
    this.solarPanelsDeployed = false;
    this.roverDeployed = false;
    this.electricCharge = 100;
    this.scienceCollectedHere = false;
    this.debris = [];

    let maxS = 0;
    this.parts = blueprint.parts.map((p) => {
      const def = getPartDef(p.partId);
      const scaleMass = Math.pow(p.scale || 1, 2);
      const cap = (def?.fuelCapacity ?? 0) * scaleMass;
      if (p.stage > maxS) maxS = p.stage;
      return {
        uid: p.uid,
        partId: p.partId,
        stage: p.stage,
        fuelRemaining: cap,
        fuelCapacity: cap,
        active: false,
        detached: false,
        position: [...p.position] as [number, number, number],
        scale: p.scale || 1,
        radialAngle: p.radialAngle,
      };
    });

    this.maxStage = maxS;
    this.currentStage = maxS;

    const earth = getBodyById('earth');
    // Place rocket upright on Earth's north-equatorial launchpad (+Y axis)
    this.position = { x: 0, y: earth.radius + 3, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.orientation.identity();
    this.angularVelocity.set(0, 0, 0);
  }

  public getMassAndFuel(): { massTons: number; fuelRemaining: number; fuelTotal: number } {
    let dry = 0;
    let fuelRem = 0;
    let fuelTot = 0;
    for (const p of this.parts) {
      if (p.detached) continue;
      const def = getPartDef(p.partId);
      if (!def) continue;
      dry += def.dryMass * Math.pow(p.scale, 2);
      fuelRem += p.fuelRemaining;
      fuelTot += p.fuelCapacity;
    }
    return {
      massTons: Math.max(0.2, dry + fuelRem),
      fuelRemaining: fuelRem,
      fuelTotal: fuelTot,
    };
  }

  public hasPartCapability(check: (id: string) => boolean): boolean {
    return this.parts.some((p) => !p.detached && check(p.partId));
  }

  /**
   * Spacebar action: first press ignites current stage; subsequent presses decouple & ignite next stage.
   */
  public triggerStage(): { action: 'ignite' | 'separate' | 'none'; stage: number } {
    if (this.crashed) return { action: 'none', stage: this.currentStage };

    if (!this.ignited) {
      this.ignited = true;
      this.launched = true;
      this.landed = false;
      if (this.throttle < 0.2) this.throttle = 1.0;
      for (const p of this.parts) {
        if (!p.detached && p.stage === this.currentStage) {
          p.active = true;
        }
      }
      return { action: 'ignite', stage: this.currentStage };
    }

    if (this.currentStage > 0) {
      const oldStage = this.currentStage;
      const detachedParts: ActiveStagePart[] = [];
      for (const p of this.parts) {
        if (!p.detached && p.stage >= oldStage) {
          p.detached = true;
          p.active = false;
          detachedParts.push({ ...p });
        }
      }

      if (detachedParts.length > 0) {
        const backward = new THREE.Vector3(0, -1, 0).applyQuaternion(this.orientation);
        this.debris.push({
          id: `debris_${Date.now()}_${oldStage}`,
          parts: detachedParts,
          position: {
            x: this.position.x + backward.x * 4,
            y: this.position.y + backward.y * 4,
            z: this.position.z + backward.z * 4,
          },
          velocity: {
            x: this.velocity.x + backward.x * 6,
            y: this.velocity.y + backward.y * 6,
            z: this.velocity.z + backward.z * 6,
          },
          angularVel: {
            x: (Math.random() - 0.5) * 0.6,
            y: (Math.random() - 0.5) * 0.3,
            z: (Math.random() - 0.5) * 0.6,
          },
          createdAt: this.simTime,
        });
      }

      this.currentStage -= 1;
      for (const p of this.parts) {
        if (!p.detached && p.stage === this.currentStage) {
          p.active = true;
        }
      }
      return { action: 'separate', stage: this.currentStage };
    }

    return { action: 'none', stage: this.currentStage };
  }

  public setThrottle(val: number): void {
    this.throttle = Math.max(0, Math.min(1, val));
  }

  public toggleParachutes(): boolean {
    const hasChute = this.parts.some(
      (p) => !p.detached && getPartDef(p.partId)?.isParachute
    );
    if (!hasChute) return false;
    this.parachutesDeployed = !this.parachutesDeployed;
    return this.parachutesDeployed;
  }

  public toggleLandingLegs(): boolean {
    const hasLegs = this.parts.some(
      (p) => !p.detached && getPartDef(p.partId)?.isLandingLeg
    );
    if (!hasLegs) return false;
    this.landingLegsDeployed = !this.landingLegsDeployed;
    return this.landingLegsDeployed;
  }

  public toggleSolarPanels(): boolean {
    const hasSolar = this.parts.some(
      (p) => !p.detached && getPartDef(p.partId)?.isSolarPanel
    );
    if (!hasSolar) return false;
    this.solarPanelsDeployed = !this.solarPanelsDeployed;
    return this.solarPanelsDeployed;
  }

  public step(dt: number, inputs: ControlInputs, timeWarp: number): void {
    if (dt <= 0) return;

    // Sub-step high time warp to maintain numerical stability
    const subSteps = timeWarp > 5 ? Math.min(20, Math.ceil(timeWarp)) : 2;
    const subDt = (dt * timeWarp) / subSteps;

    // Throttle control operates at real-time speed
    if (inputs.throttleDelta !== 0) {
      this.setThrottle(this.throttle + inputs.throttleDelta * dt * 0.75);
    }

    for (let s = 0; s < subSteps; s++) {
      this.stepSingle(subDt, inputs, timeWarp);
    }
  }

  private stepSingle(dt: number, inputs: ControlInputs, timeWarp: number): void {
    this.simTime += dt;
    if (this.launched && !this.crashed) {
      this.missionTime += dt;
    }

    const body = getBodyById(this.soiBodyId);
    const rVec = new THREE.Vector3(this.position.x, this.position.y, this.position.z);
    const rMag = rVec.length();
    const altitude = rMag - body.radius;

    // Electric charge update
    let powerGen = 0;
    for (const p of this.parts) {
      if (p.detached) continue;
      const def = getPartDef(p.partId);
      if (def?.isSolarPanel && this.solarPanelsDeployed) {
        powerGen += def.powerGen ?? 5;
      }
    }
    const powerDrain = this.sasMode !== 'OFF' ? 0.15 : 0.04;
    this.electricCharge = Math.max(
      0,
      Math.min(100, this.electricCharge + (powerGen * 0.2 - powerDrain) * dt)
    );

    if (this.crashed) {
      this.lastThrustKN = 0;
      this.lastAccel = 0;
      return;
    }

    // Atmosphere density
    let atmoDensity = 0;
    let atmoRatio = 0;
    if (body.atmosphereHeight > 0 && altitude < body.atmosphereHeight) {
      atmoDensity =
        body.atmosphereDensity * Math.exp(-Math.max(0, altitude) / body.scaleHeight);
      atmoRatio = Math.min(1, atmoDensity / Math.max(0.001, body.atmosphereDensity));
    }

    // Active thrust & fuel burn
    let thrustKN = 0;
    const { massTons } = this.getMassAndFuel();

    if (this.ignited) {
      // Find active engines & fuel tanks in current stage (or stage <= currentStage for liquid)
      const stageLiquidTanks = this.parts.filter(
        (p) =>
          !p.detached &&
          p.stage === this.currentStage &&
          p.fuelRemaining > 0 &&
          !getPartDef(p.partId)?.isSolidBooster
      );
      const totalStageLiquidFuel = stageLiquidTanks.reduce((a, b) => a + b.fuelRemaining, 0);

      for (const p of this.parts) {
        if (p.detached || !p.active) continue;
        const def = getPartDef(p.partId);
        if (!def || !def.thrustVac) continue;

        if (def.isSolidBooster) {
          if (p.fuelRemaining <= 0) continue;
          const tASL = (def.thrustASL ?? def.thrustVac) * p.scale;
          const tVac = def.thrustVac * p.scale;
          const tNow = tVac + (tASL - tVac) * atmoRatio;
          const ispNow =
            (def.ispVac ?? 250) + ((def.ispASL ?? 230) - (def.ispVac ?? 250)) * atmoRatio;
          const burnRate = tNow / (ispNow * G0); // tons/s
          const used = Math.min(p.fuelRemaining, burnRate * dt);
          p.fuelRemaining -= used;
          if (used > 0) thrustKN += tNow;
        } else {
          if (this.throttle <= 0.001 || totalStageLiquidFuel <= 0) continue;
          const tASL = (def.thrustASL ?? def.thrustVac) * p.scale;
          const tVac = def.thrustVac * p.scale;
          const tNow = (tVac + (tASL - tVac) * atmoRatio) * this.throttle;
          const ispNow =
            (def.ispVac ?? 320) + ((def.ispASL ?? 290) - (def.ispVac ?? 320)) * atmoRatio;
          const burnRate = tNow / (ispNow * G0); // tons/s
          const fuelNeeded = burnRate * dt;

          // Draw fuel proportionally from current stage tanks
          let remainingToDraw = fuelNeeded;
          for (const tank of stageLiquidTanks) {
            if (remainingToDraw <= 0) break;
            const take = Math.min(tank.fuelRemaining, remainingToDraw);
            tank.fuelRemaining -= take;
            remainingToDraw -= take;
          }
          if (remainingToDraw < fuelNeeded) {
            thrustKN += tNow * (1 - remainingToDraw / Math.max(1e-9, fuelNeeded));
          }
        }
      }
    }

    this.lastThrustKN = thrustKN;

    // If still landed on ground and not enough thrust to lift off
    const localGravity = body.mu / (rMag * rMag);
    const weightKN = massTons * localGravity;

    if (this.landed) {
      if (this.ignited && thrustKN > weightKN * 1.01) {
        this.landed = false;
        this.roverDeployed = false;
      } else {
        // Stay glued to surface
        const up = rVec.clone().normalize();
        const surfaceR = body.radius + 3;
        this.position = { x: up.x * surfaceR, y: up.y * surfaceR, z: up.z * surfaceR };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.lastAccel = 0;
        return;
      }
    }

    // Attitude control (only when timeWarp <= 10)
    const torqueStrength = 1.6;
    const damping = this.sasMode !== 'OFF' ? 4.5 : 0.8;

    const hasManualInput =
      Math.abs(inputs.pitch) > 0.01 ||
      Math.abs(inputs.yaw) > 0.01 ||
      Math.abs(inputs.roll) > 0.01;

    if (timeWarp <= 10) {
      if (hasManualInput) {
        this.angularVelocity.x += inputs.pitch * torqueStrength * dt;
        this.angularVelocity.z -= inputs.yaw * torqueStrength * dt;
        this.angularVelocity.y += inputs.roll * torqueStrength * dt;
      } else if (this.sasMode === 'PROGRADE' || this.sasMode === 'RETROGRADE') {
        const vVec = new THREE.Vector3(this.velocity.x, this.velocity.y, this.velocity.z);
        if (vVec.length() > 5) {
          const targetDir = vVec.normalize();
          if (this.sasMode === 'RETROGRADE') targetDir.negate();
          const targetQuat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            targetDir
          );
          this.orientation.slerp(targetQuat, Math.min(1, dt * 3.5));
          this.angularVelocity.multiplyScalar(0.5);
        }
      }

      // Apply angular damping
      const dampFactor = Math.exp(-damping * dt);
      this.angularVelocity.multiplyScalar(dampFactor);
      this.angularVelocity.clampLength(0, 2.2);

      // Integrate orientation
      const dq = new THREE.Quaternion(
        this.angularVelocity.x * dt * 0.5,
        this.angularVelocity.y * dt * 0.5,
        this.angularVelocity.z * dt * 0.5,
        1
      ).normalize();
      this.orientation.multiply(dq).normalize();
    }

    // Acceleration calculation: Gravity + Thrust + Aerodynamic Drag
    const upDir = rVec.clone().normalize();
    const rocketNose = new THREE.Vector3(0, 1, 0).applyQuaternion(this.orientation).normalize();

    const accelGrav = upDir.clone().multiplyScalar(-localGravity);
    const accelThrust = rocketNose.clone().multiplyScalar(thrustKN / massTons); // kN / t = m/s^2

    // Drag
    const velVec = new THREE.Vector3(this.velocity.x, this.velocity.y, this.velocity.z);
    const speed = velVec.length();
    let accelDrag = new THREE.Vector3(0, 0, 0);
    this.lastDynPressure = 0.5 * atmoDensity * speed * speed;
    this.lastTempK =
      body.surfaceTempK + (atmoDensity > 1e-5 ? Math.min(2200, 0.0004 * atmoDensity * speed * speed) : 0);

    if (atmoDensity > 1e-7 && speed > 0.1) {
      const baseCdA = this.parachutesDeployed ? 85.0 : 1.35;
      const dragForceN = 0.5 * atmoDensity * speed * speed * baseCdA;
      const dragAccelMag = Math.min(speed / Math.max(dt, 0.01), dragForceN / (massTons * 1000));
      accelDrag = velVec.clone().normalize().multiplyScalar(-dragAccelMag);
    }

    const totalAccel = new THREE.Vector3()
      .add(accelGrav)
      .add(accelThrust)
      .add(accelDrag);

    this.lastAccel = totalAccel.length();

    // Symplectic / Velocity Verlet integration for position & velocity
    this.velocity.x += totalAccel.x * dt;
    this.velocity.y += totalAccel.y * dt;
    this.velocity.z += totalAccel.z * dt;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Update debris physics (ballistic)
    for (const d of this.debris) {
      const dr = Math.sqrt(d.position.x ** 2 + d.position.y ** 2 + d.position.z ** 2);
      if (dr > body.radius) {
        const g = -body.mu / (dr * dr * dr);
        d.velocity.x += d.position.x * g * dt;
        d.velocity.y += d.position.y * g * dt;
        d.velocity.z += d.position.z * g * dt;
        d.position.x += d.velocity.x * dt;
        d.position.y += d.velocity.y * dt;
        d.position.z += d.velocity.z * dt;
      }
    }
    // Prune old debris
    if (this.debris.length > 6) {
      this.debris.shift();
    }

    // Ground collision / landing detection
    const newR = Math.sqrt(
      this.position.x ** 2 + this.position.y ** 2 + this.position.z ** 2
    );
    if (newR <= body.radius + 3) {
      const impactSpeed = Math.sqrt(
        this.velocity.x ** 2 + this.velocity.y ** 2 + this.velocity.z ** 2
      );
      const safeLandingSpeed = this.landingLegsDeployed || this.parachutesDeployed ? 14 : 9;

      const norm = {
        x: this.position.x / newR,
        y: this.position.y / newR,
        z: this.position.z / newR,
      };
      this.position = {
        x: norm.x * (body.radius + 3),
        y: norm.y * (body.radius + 3),
        z: norm.z * (body.radius + 3),
      };
      this.velocity = { x: 0, y: 0, z: 0 };

      if (impactSpeed > safeLandingSpeed) {
        this.crashed = true;
        this.ignited = false;
        this.throttle = 0;
      } else {
        this.landed = true;
        this.ignited = false;
        this.throttle = 0;
        this.parachutesDeployed = false;
        // Align upright to surface normal
        this.orientation.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(norm.x, norm.y, norm.z)
        );
      }
      return;
    }

    // Sphere of Influence (SOI) transitions between Earth, Moon, and Mars
    this.checkSoiTransitions();
  }

  private checkSoiTransitions(): void {
    const moon = getBodyById('moon');
    const mars = getBodyById('mars');

    if (this.soiBodyId === 'earth') {
      // Check entry into Moon SOI
      const moonPos = getBodyWorldPosition('moon', this.simTime);
      const dx = this.position.x - moonPos.x;
      const dy = this.position.y - moonPos.y;
      const dz = this.position.z - moonPos.z;
      const distMoon = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distMoon < moon.soiRadius * 0.98) {
        const moonVel = getBodyWorldVelocity('moon', this.simTime);
        this.position = { x: dx, y: dy, z: dz };
        this.velocity = {
          x: this.velocity.x - moonVel.x,
          y: this.velocity.y - moonVel.y,
          z: this.velocity.z - moonVel.z,
        };
        this.soiBodyId = 'moon';
        this.scienceCollectedHere = false;
        return;
      }

      // Check entry into Mars SOI
      const marsPos = getBodyWorldPosition('mars', this.simTime);
      const mx = this.position.x - marsPos.x;
      const my = this.position.y - marsPos.y;
      const mz = this.position.z - marsPos.z;
      const distMars = Math.sqrt(mx * mx + my * my + mz * mz);
      if (distMars < mars.soiRadius * 0.98) {
        const marsVel = getBodyWorldVelocity('mars', this.simTime);
        this.position = { x: mx, y: my, z: mz };
        this.velocity = {
          x: this.velocity.x - marsVel.x,
          y: this.velocity.y - marsVel.y,
          z: this.velocity.z - marsVel.z,
        };
        this.soiBodyId = 'mars';
        this.scienceCollectedHere = false;
      }
    } else if (this.soiBodyId === 'moon' || this.soiBodyId === 'mars') {
      const currentBody = getBodyById(this.soiBodyId);
      const dist = Math.sqrt(
        this.position.x ** 2 + this.position.y ** 2 + this.position.z ** 2
      );
      if (dist > currentBody.soiRadius * 1.02) {
        const bodyPos = getBodyWorldPosition(this.soiBodyId, this.simTime);
        const bodyVel = getBodyWorldVelocity(this.soiBodyId, this.simTime);
        this.position = {
          x: this.position.x + bodyPos.x,
          y: this.position.y + bodyPos.y,
          z: this.position.z + bodyPos.z,
        };
        this.velocity = {
          x: this.velocity.x + bodyVel.x,
          y: this.velocity.y + bodyVel.y,
          z: this.velocity.z + bodyVel.z,
        };
        this.soiBodyId = 'earth';
        this.scienceCollectedHere = false;
      }
    }
  }

  public getTelemetry(): FlightTelemetry {
    const body = getBodyById(this.soiBodyId);
    const rMag = Math.sqrt(
      this.position.x ** 2 + this.position.y ** 2 + this.position.z ** 2
    );
    const altitude = Math.max(0, rMag - body.radius);
    const speed = Math.sqrt(
      this.velocity.x ** 2 + this.velocity.y ** 2 + this.velocity.z ** 2
    );

    const up = {
      x: this.position.x / Math.max(1, rMag),
      y: this.position.y / Math.max(1, rMag),
      z: this.position.z / Math.max(1, rMag),
    };
    const verticalSpeed =
      this.velocity.x * up.x + this.velocity.y * up.y + this.velocity.z * up.z;
    const horizontalSpeed = Math.sqrt(Math.max(0, speed * speed - verticalSpeed * verticalSpeed));

    const { massTons, fuelRemaining, fuelTotal } = this.getMassAndFuel();
    const localG = body.mu / (rMag * rMag);
    const twr = massTons > 0 ? this.lastThrustKN / (massTons * Math.max(0.1, localG)) : 0;

    const orbital = computeOrbitalElements(this.position, this.velocity, this.soiBodyId);

    // Determine flight phase
    let phase: FlightPhase = 'PRELAUNCH';
    if (this.crashed) {
      phase = 'CRASHED';
    } else if (this.landed) {
      phase = this.launched ? 'LANDED' : 'PRELAUNCH';
    } else if (this.soiBodyId === 'moon') {
      if (orbital.isStableOrbit) phase = 'LUNAR_ORBIT';
      else if (verticalSpeed < -5 && altitude < 50_000) phase = 'DESCENT';
      else phase = 'LUNAR_TRANSFER';
    } else {
      if (orbital.isEscape) phase = 'ESCAPE';
      else if (orbital.isStableOrbit) {
        phase = orbital.periapsis > 250_000 ? 'HIGH_ORBIT' : 'LOW_ORBIT';
      } else if (altitude < body.atmosphereHeight) {
        phase = verticalSpeed >= 0 ? 'ASCENT' : 'DESCENT';
      } else {
        phase = 'SUBORBITAL';
      }
    }

    const euler = new THREE.Euler().setFromQuaternion(this.orientation, 'YXZ');

    return {
      phase,
      soiBodyId: this.soiBodyId,
      altitude,
      speed,
      verticalSpeed,
      horizontalSpeed,
      acceleration: this.lastAccel,
      gForce: this.lastAccel / G0,
      thrustKN: this.lastThrustKN,
      throttle: this.throttle,
      massTons,
      fuelRemaining,
      fuelTotal,
      twr,
      dynamicPressure: this.lastDynPressure,
      atmosphericTempK: this.lastTempK,
      electricCharge: this.electricCharge,
      currentStage: this.currentStage,
      maxStage: this.maxStage,
      missionTime: this.missionTime,
      orbital,
      sasMode: this.sasMode,
      parachutesDeployed: this.parachutesDeployed,
      landingLegsDeployed: this.landingLegsDeployed,
      solarPanelsDeployed: this.solarPanelsDeployed,
      roverDeployed: this.roverDeployed,
      scienceCollectedHere: this.scienceCollectedHere,
      pitch: euler.x,
      yaw: euler.y,
      roll: euler.z,
    };
  }
}

export const flightEngine = new FlightEngine();

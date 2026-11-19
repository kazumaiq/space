import { getBodyById, getBodyWorldPosition } from '@/data/solarSystem';
import { TrajectoryPoint, TrajectoryPrediction, Vec3 } from '@/game/core/types';

interface WorkerRequest {
  position: Vec3; // relative to SOI body (meters)
  velocity: Vec3; // relative to SOI body (m/s)
  soiBodyId: string;
  simTime: number;
  steps?: number;
}

function gravAccel(pos: Vec3, mu: number): Vec3 {
  const r2 = pos.x * pos.x + pos.y * pos.y + pos.z * pos.z;
  const r = Math.sqrt(r2);
  if (r < 1) return { x: 0, y: 0, z: 0 };
  const f = -mu / (r2 * r);
  return { x: pos.x * f, y: pos.y * f, z: pos.z * f };
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { position, velocity, soiBodyId, simTime, steps = 220 } = event.data;
  const body = getBodyById(soiBodyId);
  const mu = body.mu;
  const radius = body.radius;

  const rMag = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
  const vMag = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);

  // Estimate orbital period to choose an adaptive integration step
  const energy = (vMag * vMag) / 2 - mu / Math.max(1, rMag);
  let totalDuration = 3600;
  if (energy < -1e-5) {
    const a = -mu / (2 * energy);
    const period = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
    totalDuration = Math.min(Math.max(period * 1.05, 180), 90_000);
  } else {
    totalDuration = 18_000;
  }

  const dt = totalDuration / steps;

  let px = position.x;
  let py = position.y;
  let pz = position.z;
  let vx = velocity.x;
  let vy = velocity.y;
  let vz = velocity.z;

  const points: TrajectoryPoint[] = [{ x: px, y: py, z: pz, bodyId: soiBodyId }];

  let maxR = rMag;
  let minR = rMag;
  let apoapsisPos: Vec3 | null = { x: px, y: py, z: pz };
  let periapsisPos: Vec3 | null = { x: px, y: py, z: pz };

  let encounterBodyId: string | null = null;
  let encounterDistance: number | null = null;
  const moonBody = getBodyById('moon');

  for (let i = 1; i <= steps; i++) {
    // RK4 step
    const k1a = gravAccel({ x: px, y: py, z: pz }, mu);
    const k1vx = vx, k1vy = vy, k1vz = vz;

    const p2 = { x: px + k1vx * dt * 0.5, y: py + k1vy * dt * 0.5, z: pz + k1vz * dt * 0.5 };
    const k2a = gravAccel(p2, mu);
    const k2vx = vx + k1a.x * dt * 0.5, k2vy = vy + k1a.y * dt * 0.5, k2vz = vz + k1a.z * dt * 0.5;

    const p3 = { x: px + k2vx * dt * 0.5, y: py + k2vy * dt * 0.5, z: pz + k2vz * dt * 0.5 };
    const k3a = gravAccel(p3, mu);
    const k3vx = vx + k2a.x * dt * 0.5, k3vy = vy + k2a.y * dt * 0.5, k3vz = vz + k2a.z * dt * 0.5;

    const p4 = { x: px + k3vx * dt, y: py + k3vy * dt, z: pz + k3vz * dt };
    const k4a = gravAccel(p4, mu);
    const k4vx = vx + k3a.x * dt, k4vy = vy + k3a.y * dt, k4vz = vz + k3a.z * dt;

    px += (dt / 6) * (k1vx + 2 * k2vx + 2 * k3vx + k4vx);
    py += (dt / 6) * (k1vy + 2 * k2vy + 2 * k3vy + k4vy);
    pz += (dt / 6) * (k1vz + 2 * k2vz + 2 * k3vz + k4vz);

    vx += (dt / 6) * (k1a.x + 2 * k2a.x + 2 * k3a.x + k4a.x);
    vy += (dt / 6) * (k1a.y + 2 * k2a.y + 2 * k3a.y + k4a.y);
    vz += (dt / 6) * (k1a.z + 2 * k2a.z + 2 * k3a.z + k4a.z);

    const curR = Math.sqrt(px * px + py * py + pz * pz);
    points.push({ x: px, y: py, z: pz, bodyId: soiBodyId });

    if (curR > maxR) {
      maxR = curR;
      apoapsisPos = { x: px, y: py, z: pz };
    }
    if (curR < minR) {
      minR = curR;
      periapsisPos = { x: px, y: py, z: pz };
    }

    // Check lunar encounter when orbiting Earth
    if (soiBodyId === 'earth' && !encounterBodyId) {
      const futureTime = simTime + i * dt;
      const moonPos = getBodyWorldPosition('moon', futureTime);
      const dx = px - moonPos.x;
      const dy = py - moonPos.y;
      const dz = pz - moonPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < moonBody.soiRadius) {
        encounterBodyId = 'moon';
        encounterDistance = dist - moonBody.radius;
      }
    }

    // Stop if trajectory impacts surface
    if (curR <= radius) {
      break;
    }
  }

  const response: TrajectoryPrediction = {
    points,
    encounterBodyId,
    encounterDistance,
    apoapsisPos,
    periapsisPos,
  };

  self.postMessage(response);
};

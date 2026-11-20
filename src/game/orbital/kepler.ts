import { getBodyById } from '@/data/solarSystem';
import { OrbitalElements, Vec3 } from '@/game/core/types';

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function mag(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Computes classical 3D Keplerian orbital elements from relative position r (m) and velocity v (m/s).
 */
export function computeOrbitalElements(
  r: Vec3,
  v: Vec3,
  bodyId: string
): OrbitalElements {
  const body = getBodyById(bodyId);
  const mu = body.mu;
  const R = body.radius;

  const rMag = Math.max(1, mag(r));
  const vMag = mag(v);

  // Specific angular momentum h = r x v
  const h = cross(r, v);
  const hMag = mag(h);

  // Specific orbital energy E = v^2 / 2 - mu / r
  const energy = (vMag * vMag) / 2 - mu / rMag;

  // Eccentricity vector: e = ((v^2 - mu/r) * r - (r . v) * v) / mu
  const rDotV = dot(r, v);
  const c1 = vMag * vMag - mu / rMag;
  const eVec: Vec3 = {
    x: (c1 * r.x - rDotV * v.x) / mu,
    y: (c1 * r.y - rDotV * v.y) / mu,
    z: (c1 * r.z - rDotV * v.z) / mu,
  };
  const eccentricity = mag(eVec);

  // Semi-major axis a = -mu / (2 * E)
  // Note: straight vertical suborbital flight has e = 1.0 but negative energy (bound!).
  // True escape occurs only when specific orbital energy >= 0.
  const isEscape = energy >= 0;
  const semiMajorAxis = Math.abs(energy) > 1e-9 ? -mu / (2 * energy) : Infinity;

  // Inclination (relative to equatorial XZ plane, Y is north pole)
  const inclination = hMag > 1e-6 ? Math.acos(Math.max(-1, Math.min(1, h.y / hMag))) : 0;

  let periapsisDist: number;
  let apoapsisDist: number;

  if (isEscape) {
    periapsisDist = hMag > 1e-6 ? (hMag * hMag) / (mu * (1 + eccentricity)) : rMag;
    apoapsisDist = Infinity;
  } else {
    periapsisDist = semiMajorAxis * (1 - eccentricity);
    apoapsisDist = semiMajorAxis * (1 + eccentricity);
  }

  const periapsis = periapsisDist - R;
  const apoapsis = isEscape ? Infinity : apoapsisDist - R;

  const orbitalPeriod =
    !isEscape && semiMajorAxis > 0
      ? 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu)
      : Infinity;

  // Approximate time to apoapsis / periapsis via mean anomaly
  let timeToPeriapsis = 0;
  let timeToApoapsis = 0;

  if (!isEscape && orbitalPeriod < Infinity && eccentricity > 1e-4) {
    const cosNu = Math.max(-1, Math.min(1, dot(eVec, r) / (eccentricity * rMag)));
    let nu = Math.acos(cosNu);
    if (rDotV < 0) {
      nu = 2 * Math.PI - nu;
    }
    // Eccentric anomaly E
    const cosE = (eccentricity + Math.cos(nu)) / (1 + eccentricity * Math.cos(nu));
    let E = Math.acos(Math.max(-1, Math.min(1, cosE)));
    if (nu > Math.PI) {
      E = 2 * Math.PI - E;
    }
    const M = E - eccentricity * Math.sin(E);
    const n = (2 * Math.PI) / orbitalPeriod;
    const tSincePeri = M / n;
    timeToPeriapsis = orbitalPeriod - tSincePeri;
    const halfPeriod = orbitalPeriod / 2;
    timeToApoapsis =
      tSincePeri <= halfPeriod
        ? halfPeriod - tSincePeri
        : orbitalPeriod + halfPeriod - tSincePeri;
  }

  const safeAlt = body.atmosphereHeight > 0 ? body.atmosphereHeight + 2000 : 5000;
  const isStableOrbit = !isEscape && periapsis > safeAlt;
  const isSuborbital = !isEscape && periapsis <= safeAlt;

  return {
    bodyId,
    semiMajorAxis,
    eccentricity,
    inclination,
    apoapsis,
    periapsis,
    orbitalPeriod,
    timeToApoapsis,
    timeToPeriapsis,
    isEscape,
    isSuborbital,
    isStableOrbit,
    specificEnergy: energy,
  };
}

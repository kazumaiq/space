import * as THREE from 'three';

function hash2d(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2d(ix, iy, seed);
  const b = hash2d(ix + 1, iy, seed);
  const c = hash2d(ix, iy + 1, seed);
  const d = hash2d(ix + 1, iy + 1, seed);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * smoothNoise(x * freq, y * freq, seed + i * 19);
    freq *= 2.02;
    amp *= 0.5;
  }
  return value;
}

export interface PlanetTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  cloudsMap?: THREE.CanvasTexture;
}

const cache: Record<string, PlanetTextureSet> = {};

export function getPlanetTextures(bodyId: string): PlanetTextureSet {
  if (cache[bodyId]) return cache[bodyId];

  const width = 1024;
  const height = 512;

  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = width;
  mapCanvas.height = height;
  const mapCtx = mapCanvas.getContext('2d')!;
  const mapImg = mapCtx.createImageData(width, height);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bumpCtx.createImageData(width, height);

  let cloudsMap: THREE.CanvasTexture | undefined;

  if (bodyId === 'earth') {
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = width;
    cloudCanvas.height = height;
    const cloudCtx = cloudCanvas.getContext('2d')!;
    const cloudImg = cloudCtx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
      const v = y / height;
      const lat = Math.abs(v - 0.5) * 2; // 0 equator -> 1 poles
      for (let x = 0; x < width; x++) {
        const u = x / width;
        // Seamless spherical-ish sampling
        const angle = u * Math.PI * 2;
        const nx = Math.cos(angle) * 2.2 + 3.5;
        const ny = v * 4.4;
        const nz = Math.sin(angle) * 2.2 + 3.5;

        const elev = fbm(nx + nz * 0.45, ny + nz * 0.35, 11, 5);
        const detail = fbm(u * 16, v * 8, 47, 4);
        const idx = (y * width + x) * 4;

        let r = 0, g = 0, b = 0, bump = 0;

        if (lat > 0.86 + (detail - 0.5) * 0.12) {
          // Polar ice cap
          r = 228; g = 238; b = 246; bump = 160;
        } else if (elev < 0.52) {
          // Ocean depth gradient
          const depth = elev / 0.52;
          r = Math.floor(10 + depth * 20);
          g = Math.floor(38 + depth * 64);
          b = Math.floor(96 + depth * 82);
          bump = 20;
        } else {
          // Land biomes
          const landH = (elev - 0.52) / 0.48;
          bump = Math.min(255, Math.floor(80 + landH * 175));
          if (landH > 0.65) {
            // High mountains / snow
            r = 168 + Math.floor(landH * 50);
            g = 164 + Math.floor(landH * 50);
            b = 158 + Math.floor(landH * 50);
          } else if (lat < 0.35 && detail > 0.54) {
            // Arid / desert
            r = 178 + Math.floor(detail * 25);
            g = 152 + Math.floor(detail * 20);
            b = 104;
          } else {
            // Temperate forest / plains
            r = Math.floor(42 + landH * 65 + detail * 20);
            g = Math.floor(104 + landH * 42 + detail * 24);
            b = Math.floor(50 + landH * 28);
          }
        }

        mapImg.data[idx] = r;
        mapImg.data[idx + 1] = g;
        mapImg.data[idx + 2] = b;
        mapImg.data[idx + 3] = 255;

        bumpImg.data[idx] = bump;
        bumpImg.data[idx + 1] = bump;
        bumpImg.data[idx + 2] = bump;
        bumpImg.data[idx + 3] = 255;

        // Cloud swirling layer
        const cVal = fbm(nx * 1.6 + 10, ny * 2.1 + Math.sin(angle * 2) * 0.4, 93, 5);
        const alpha = cVal > 0.54 ? Math.min(235, Math.floor(((cVal - 0.54) / 0.34) * 255)) : 0;
        cloudImg.data[idx] = 248;
        cloudImg.data[idx + 1] = 252;
        cloudImg.data[idx + 2] = 255;
        cloudImg.data[idx + 3] = alpha;
      }
    }

    cloudCtx.putImageData(cloudImg, 0, 0);
    cloudsMap = new THREE.CanvasTexture(cloudCanvas);
    cloudsMap.wrapS = THREE.RepeatWrapping;
    cloudsMap.needsUpdate = true;
  } else if (bodyId === 'moon') {
    // Generate realistic lunar maria + craters
    const craters: Array<{ u: number; v: number; r: number; depth: number }> = [];
    for (let i = 0; i < 65; i++) {
      craters.push({
        u: hash2d(i, 1, 201),
        v: 0.1 + hash2d(i, 2, 202) * 0.8,
        r: 0.012 + Math.pow(hash2d(i, 3, 203), 2) * 0.065,
        depth: 0.4 + hash2d(i, 4, 204) * 0.6,
      });
    }

    for (let y = 0; y < height; y++) {
      const v = y / height;
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const base = fbm(u * 10, v * 5, 31, 5);
        const fine = fbm(u * 32, v * 16, 71, 3);

        // Dark basaltic maria
        let shade = 0.48 + base * 0.34 + (fine - 0.5) * 0.14;
        if (base < 0.46) shade *= 0.72;

        let craterBump = 0;
        for (const c of craters) {
          let du = Math.abs(u - c.u);
          if (du > 0.5) du = 1 - du;
          const dv = (v - c.v) * 0.55;
          const d = Math.sqrt(du * du + dv * dv);
          if (d < c.r) {
            const norm = d / c.r;
            if (norm < 0.78) {
              craterBump -= (1 - norm / 0.78) * 0.32 * c.depth;
              shade -= 0.07 * c.depth;
            } else {
              // Bright raised crater rim
              const rim = 1 - Math.abs(norm - 0.89) / 0.11;
              craterBump += rim * 0.25 * c.depth;
              shade += rim * 0.12;
            }
          }
        }

        const val = Math.max(38, Math.min(228, Math.floor(shade * 220)));
        const bump = Math.max(0, Math.min(255, Math.floor((0.5 + craterBump + (fine - 0.5) * 0.3) * 255)));
        const idx = (y * width + x) * 4;

        mapImg.data[idx] = val;
        mapImg.data[idx + 1] = val - 2;
        mapImg.data[idx + 2] = val - 5;
        mapImg.data[idx + 3] = 255;

        bumpImg.data[idx] = bump;
        bumpImg.data[idx + 1] = bump;
        bumpImg.data[idx + 2] = bump;
        bumpImg.data[idx + 3] = 255;
      }
    }
  } else {
    // Mars / generic rocky planet
    for (let y = 0; y < height; y++) {
      const v = y / height;
      const lat = Math.abs(v - 0.5) * 2;
      for (let x = 0; x < width; x++) {
        const u = x / width;
        const n = fbm(u * 12, v * 6, 55, 5);
        const idx = (y * width + x) * 4;
        if (lat > 0.9) {
          mapImg.data[idx] = 235;
          mapImg.data[idx + 1] = 230;
          mapImg.data[idx + 2] = 225;
        } else {
          mapImg.data[idx] = Math.floor(145 + n * 85);
          mapImg.data[idx + 1] = Math.floor(62 + n * 52);
          mapImg.data[idx + 2] = Math.floor(38 + n * 30);
        }
        mapImg.data[idx + 3] = 255;
        const b = Math.floor(n * 255);
        bumpImg.data[idx] = b;
        bumpImg.data[idx + 1] = b;
        bumpImg.data[idx + 2] = b;
        bumpImg.data[idx + 3] = 255;
      }
    }
  }

  mapCtx.putImageData(mapImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  const map = new THREE.CanvasTexture(mapCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.needsUpdate = true;

  const set: PlanetTextureSet = { map, bumpMap, cloudsMap };
  cache[bodyId] = set;
  return set;
}

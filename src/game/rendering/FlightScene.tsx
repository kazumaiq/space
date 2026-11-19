import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { getBodyById, getBodyWorldPosition } from '@/data/solarSystem';
import { flightEngine } from '@/game/physics/flightEngine';
import { PlanetMesh } from '@/game/planets/PlanetMesh';
import { SpaceBackdrop } from '@/game/rendering/SpaceBackdrop';
import { SpaceportComplex } from '@/game/rendering/SpaceportScene';
import { RocketMesh } from '@/game/spacecraft/RocketMesh';
import { useFlightControls } from '@/game/controls/useFlightControls';
import { evaluateMissions } from '@/game/missions/missionTracker';
import { soundEngine } from '@/services/audio/soundEngine';
import { useGameStore } from '@/stores/useGameStore';
import { TrajectoryPrediction } from '@/game/core/types';
import { getPartDef } from '@/data/partsCatalog';

const PLANET_SCALE = 0.001; // 1 unit = 1 km for distant planets & map view

const LaunchSmoke: React.FC<{ active: boolean; altitude: number }> = ({ active, altitude }) => {
  const groupRef = useRef<THREE.Group>(null);
  const puffs = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        angle: (i / 14) * Math.PI * 2,
        speed: 4 + (i % 4) * 2.2,
        offset: (i * 0.37) % 1,
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.children.forEach((child, idx) => {
      const p = puffs[idx];
      const phase = (t * 0.9 + p.offset) % 1;
      const dist = phase * p.speed * 3.2;
      child.position.set(
        Math.cos(p.angle) * dist,
        -2.5 + phase * 1.4,
        Math.sin(p.angle) * dist
      );
      const sc = 0.8 + phase * 3.8;
      child.scale.setScalar(sc);
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = active && altitude < 180 ? (1 - phase) * 0.45 : 0;
    });
  });

  if (!active || altitude > 200) return null;

  return (
    <group ref={groupRef}>
      {puffs.map((_, i) => (
        <mesh key={i}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#cbd5e1" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

const SurfaceRover: React.FC<{ visible: boolean }> = ({ visible }) => {
  const roverRef = useRef<THREE.Group>(null);
  const posRef = useRef({ x: 5, z: 4, heading: 0 });

  useFrame((_, delta) => {
    if (!visible || !roverRef.current) return;
    // Simple rover drive using arrow / WASD while deployed
    const t = performance.now() * 0.001;
    roverRef.current.position.set(
      posRef.current.x + Math.sin(t * 0.25) * 1.5,
      -0.8,
      posRef.current.z + Math.cos(t * 0.25) * 1.5
    );
    roverRef.current.rotation.y = t * 0.25;
  });

  if (!visible) return null;

  return (
    <group ref={roverRef} position={[5, -0.8, 4]}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 0.5, 2.2]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.65, 0.4]}>
        <cylinderGeometry args={[0.1, 0.1, 0.9, 8]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0, 1.1, 0.4]}>
        <boxGeometry args={[0.45, 0.28, 0.35]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
      </mesh>
      {[-0.9, 0.9].map((x) =>
        [-0.8, 0, 0.8].map((z) => (
          <mesh key={`${x}_${z}`} position={[x, -0.35, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.28, 0.28, 0.22, 12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.9} />
          </mesh>
        ))
      )}
    </group>
  );
};

const FlightSimulationLoop: React.FC = () => {
  const { scene } = useThree();
  const rocketGroupRef = useRef<THREE.Group>(null);
  const planetGroupRef = useRef<THREE.Group>(null);
  const padGroupRef = useRef<THREE.Group>(null);
  const moonMeshRef = useRef<THREE.Group>(null);

  const workerRef = useRef<Worker | null>(null);
  const lastUiUpdateRef = useRef(0);
  const lastWorkerReqRef = useRef(0);

  const mapView = useGameStore((s) => s.mapView);
  const timeWarp = useGameStore((s) => s.timeWarp);
  const graphics = useGameStore((s) => s.graphics);
  const telemetry = useGameStore((s) => s.telemetry);
  const trajectory = useGameStore((s) => s.trajectory);

  const { readInputs } = useFlightControls({
    onStage: () => {
      const res = flightEngine.triggerStage();
      if (res.action === 'ignite') {
        useGameStore.getState().incrementLaunches();
        soundEngine.playStageSeparate();
        useGameStore.getState().pushToast({
          title: 'Зажигание!',
          body: `Ступень ${res.stage + 1} активирована. Поехали!`,
          type: 'info',
        });
      } else if (res.action === 'separate') {
        soundEngine.playStageSeparate();
        useGameStore.getState().pushToast({
          title: 'Разделение ступеней',
          body: `Активирована ступень ${res.stage + 1}.`,
          type: 'info',
        });
      }
    },
    onToggleSas: () => {
      const order: Array<typeof flightEngine.sasMode> = [
        'STABILITY',
        'PROGRADE',
        'RETROGRADE',
        'OFF',
      ];
      const next = order[(order.indexOf(flightEngine.sasMode) + 1) % order.length];
      flightEngine.sasMode = next;
      soundEngine.playClick();
    },
    onToggleParachute: () => {
      const deployed = flightEngine.toggleParachutes();
      soundEngine.playClick();
      if (deployed) {
        useGameStore.getState().pushToast({
          title: 'Парашют раскрыт',
          body: 'Аэродинамическое торможение активно.',
          type: 'info',
        });
      }
    },
    onToggleLegs: () => {
      flightEngine.toggleLandingLegs();
      soundEngine.playClick();
    },
    onToggleSolar: () => {
      flightEngine.toggleSolarPanels();
      soundEngine.playClick();
    },
    onToggleMap: () => {
      useGameStore.getState().setMapView(!useGameStore.getState().mapView);
      soundEngine.playClick();
    },
    onCutThrottle: () => {
      flightEngine.setThrottle(0);
    },
    onFullThrottle: () => {
      flightEngine.setThrottle(1);
    },
  });

  // Setup Web Worker for off-thread orbital trajectory prediction
  useEffect(() => {
    const worker = new Worker(
      new URL('@/game/orbital/trajectory.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e: MessageEvent<TrajectoryPrediction>) => {
      useGameStore.getState().setTrajectory(e.data);
    };
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
      soundEngine.updateEngineThrust(0, false);
    };
  }, []);

  useFrame((_, rawDelta) => {
    const dt = Math.min(0.05, rawDelta);
    const inputs = readInputs();
    const store = useGameStore.getState();

    // Limit time warp while in atmosphere or engines thrusting
    const activeBody = getBodyById(flightEngine.soiBodyId);
    const rMag = Math.sqrt(
      flightEngine.position.x ** 2 +
        flightEngine.position.y ** 2 +
        flightEngine.position.z ** 2
    );
    const alt = rMag - activeBody.radius;
    const effectiveWarp =
      alt < activeBody.atmosphereHeight && store.timeWarp > 5
        ? 5
        : store.timeWarp;

    flightEngine.step(dt, inputs, effectiveWarp);

    // Update sound engine
    const inAtmo = activeBody.atmosphereHeight > 0 && alt < activeBody.atmosphereHeight;
    const thrustRatio = flightEngine.ignited
      ? Math.min(1, flightEngine.getTelemetry().thrustKN / 220)
      : 0;
    soundEngine.updateEngineThrust(thrustRatio, inAtmo);

    // Update rocket orientation in local 3D view
    if (rocketGroupRef.current) {
      rocketGroupRef.current.quaternion.copy(flightEngine.orientation);
    }

    // Update sky background color (blue sky at Earth sea level -> deep black space)
    if (!store.mapView) {
      if (flightEngine.soiBodyId === 'earth' && alt < 65_000) {
        const t = Math.max(0, Math.min(1, 1 - alt / 65_000));
        const sky = new THREE.Color('#02050b').lerp(new THREE.Color('#133a6b'), Math.pow(t, 1.5));
        scene.background = sky;
      } else {
        scene.background = new THREE.Color('#02050b');
      }
    } else {
      scene.background = new THREE.Color('#02050b');
    }

    // Position the active planet relative to rocket (floating origin, scaled to avoid float32 overflow)
    if (planetGroupRef.current && !store.mapView) {
      // Planet visual radius scaled down smoothly when high, exact horizon when low
      const distKm = rMag * PLANET_SCALE;
      const dirX = -flightEngine.position.x / Math.max(1, rMag);
      const dirY = -flightEngine.position.y / Math.max(1, rMag);
      const dirZ = -flightEngine.position.z / Math.max(1, rMag);

      // Keep planet mesh at exact visual distance in km-units (1 unit = 1m near ground, transitioning smoothly)
      const visualScale = alt < 25_000 ? 0.01 : PLANET_SCALE;
      const visualRadius = activeBody.radius * visualScale;
      const visualDist = visualRadius + alt * visualScale;
      planetGroupRef.current.position.set(
        dirX * visualDist,
        dirY * visualDist,
        dirZ * visualDist
      );
      planetGroupRef.current.scale.setScalar(visualScale / PLANET_SCALE);
      void distKm;
    }

    // Position launchpad near rocket when low on Earth
    if (padGroupRef.current && !store.mapView) {
      if (flightEngine.soiBodyId === 'earth' && alt < 4000) {
        padGroupRef.current.visible = true;
        padGroupRef.current.position.set(
          -flightEngine.position.x,
          activeBody.radius - flightEngine.position.y,
          -flightEngine.position.z
        );
      } else {
        padGroupRef.current.visible = false;
      }
    }

    // Position Moon in local sky when in Earth SOI
    if (moonMeshRef.current && !store.mapView) {
      const moonPos = getBodyWorldPosition('moon', flightEngine.simTime);
      const dx = moonPos.x - flightEngine.position.x;
      const dy = moonPos.y - flightEngine.position.y;
      const dz = moonPos.z - flightEngine.position.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      // Place Moon in skybox distance proportional to real angular size
      const skyDist = 2200;
      const moonBody = getBodyById('moon');
      const apparentRadius = Math.max(18, (moonBody.radius / Math.max(1, d)) * skyDist * 1.4);
      moonMeshRef.current.position.copy(dir.multiplyScalar(skyDist));
      moonMeshRef.current.scale.setScalar(apparentRadius / 175);
      moonMeshRef.current.visible = flightEngine.soiBodyId === 'earth';
    }

    // Throttle React/Zustand telemetry updates to ~15 Hz for ultra-smooth 60 FPS rendering
    const now = performance.now();
    if (now - lastUiUpdateRef.current > 66) {
      lastUiUpdateRef.current = now;
      const tel = flightEngine.getTelemetry();
      store.setTelemetry(tel);

      store.recordFlightStats(
        tel.altitude,
        tel.soiBodyId,
        tel.orbital.isStableOrbit,
        tel.phase === 'LANDED'
      );

      // Evaluate missions
      const hasSci = flightEngine.hasPartCapability(
        (id) => Boolean(getPartDef(id)?.isScience)
      );
      const collectedMoonSample = store.progress.collectedSamples.some(
        (s) => s.bodyId === 'moon'
      );
      const newlyDone = evaluateMissions(
        tel,
        store.progress.completedMissions,
        hasSci,
        collectedMoonSample
      );
      for (const m of newlyDone) {
        store.completeMission(m.id, m.title, m.rewardCredits, m.rewardScience);
      }
    }

    // Request trajectory prediction from Web Worker every 400ms
    if (now - lastWorkerReqRef.current > 400 && workerRef.current) {
      lastWorkerReqRef.current = now;
      workerRef.current.postMessage({
        position: { ...flightEngine.position },
        velocity: { ...flightEngine.velocity },
        soiBodyId: flightEngine.soiBodyId,
        simTime: flightEngine.simTime,
        steps: 200,
      });
    }
  });

  const activeBody = getBodyById(telemetry?.soiBodyId ?? 'earth');
  const minY = flightEngine.parts.reduce(
    (acc, p) => (p.detached ? acc : Math.min(acc, p.position[1])),
    0
  );
  const reentryHeat =
    telemetry && telemetry.atmosphericTempK > 450
      ? Math.min(1, (telemetry.atmosphericTempK - 450) / 1100)
      : 0;

  // Orbital Map View points
  const mapPoints = useMemo(() => {
    if (!trajectory || trajectory.points.length < 2) return null;
    const scale = 0.00001; // 100 km = 1 unit in Map View
    return trajectory.points.map(
      (pt) => new THREE.Vector3(pt.x * scale, pt.y * scale, pt.z * scale)
    );
  }, [trajectory]);

  const moonOrbitRing = useMemo(() => {
    const r = 12_000_000 * 0.00001; // 120 units
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    return pts;
  }, []);

  if (mapView) {
    const scale = 0.00001; // 100 km = 1 scene unit
    const moonPos = getBodyWorldPosition('moon', flightEngine.simTime);
    const shipWorldPos =
      flightEngine.soiBodyId === 'moon'
        ? {
            x: moonPos.x + flightEngine.position.x,
            y: moonPos.y + flightEngine.position.y,
            z: moonPos.z + flightEngine.position.z,
          }
        : flightEngine.position;

    const trajOffset: [number, number, number] =
      flightEngine.soiBodyId === 'moon'
        ? [moonPos.x * scale, moonPos.y * scale, moonPos.z * scale]
        : [0, 0, 0];

    return (
      <group>
        <SpaceBackdrop starCount={Math.min(3500, graphics.starCount)} sunDirection={[250, 80, 180]} />

        {/* Earth in Map View */}
        <PlanetMesh
          bodyId="earth"
          radius={600_000 * scale}
          atmosphereColor="#38bdf8"
          showClouds={graphics.clouds}
          rotationSpeed={0.01}
          segments={48}
        />

        {/* Moon Orbit Ring */}
        <Line points={moonOrbitRing} color="#475569" lineWidth={1} transparent opacity={0.55} />

        {/* Moon in Map View */}
        <group position={[moonPos.x * scale, moonPos.y * scale, moonPos.z * scale]}>
          <PlanetMesh bodyId="moon" radius={175_000 * scale} rotationSpeed={0.005} segments={32} />
          {/* Moon SOI wireframe */}
          <mesh>
            <sphereGeometry args={[2_400_000 * scale, 24, 24]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.08} />
          </mesh>
          <Html distanceFactor={140} center>
            <div className="map-tag">ЛУНА</div>
          </Html>
        </group>

        {/* Predicted Trajectory Curve */}
        {mapPoints && (
          <group position={trajOffset}>
            <Line
              points={mapPoints}
              color={trajectory?.encounterBodyId === 'moon' ? '#f97316' : '#38bdf8'}
              lineWidth={2}
            />
            {trajectory?.apoapsisPos && !telemetry?.orbital.isEscape && (
              <group
                position={[
                  trajectory.apoapsisPos.x * scale,
                  trajectory.apoapsisPos.y * scale,
                  trajectory.apoapsisPos.z * scale,
                ]}
              >
                <mesh>
                  <sphereGeometry args={[0.45, 10, 10]} />
                  <meshBasicMaterial color="#38bdf8" />
                </mesh>
                <Html distanceFactor={80} center>
                  <div className="map-tag ap">
                    Ap {Math.round((telemetry?.orbital.apoapsis ?? 0) / 1000)} км
                  </div>
                </Html>
              </group>
            )}
            {trajectory?.periapsisPos && (telemetry?.orbital.periapsis ?? -1) > 0 && (
              <group
                position={[
                  trajectory.periapsisPos.x * scale,
                  trajectory.periapsisPos.y * scale,
                  trajectory.periapsisPos.z * scale,
                ]}
              >
                <mesh>
                  <sphereGeometry args={[0.45, 10, 10]} />
                  <meshBasicMaterial color="#f97316" />
                </mesh>
                <Html distanceFactor={80} center>
                  <div className="map-tag pe">
                    Pe {Math.round((telemetry?.orbital.periapsis ?? 0) / 1000)} км
                  </div>
                </Html>
              </group>
            )}
          </group>
        )}

        {/* Spacecraft Icon in Map View */}
        <mesh position={[shipWorldPos.x * scale, shipWorldPos.y * scale, shipWorldPos.z * scale]}>
          <octahedronGeometry args={[0.55, 0]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>

        <OrbitControls makeDefault minDistance={12} maxDistance={420} />
      </group>
    );
  }

  return (
    <group>
      <SpaceBackdrop starCount={graphics.starCount} sunDirection={[140, 60, 110]} />

      {/* Active SOI Planet (floating origin) */}
      <group ref={planetGroupRef}>
        <PlanetMesh
          bodyId={activeBody.id}
          radius={activeBody.radius * PLANET_SCALE}
          atmosphereColor={activeBody.atmosphereColor}
          showClouds={graphics.clouds && activeBody.id === 'earth'}
          rotationSpeed={0}
          segments={graphics.quality === 'low' ? 40 : 64}
        />
      </group>

      {/* Distant Moon in sky */}
      <group ref={moonMeshRef}>
        <PlanetMesh bodyId="moon" radius={175} rotationSpeed={0} segments={32} />
      </group>

      {/* Launchpad when close to Earth surface */}
      <group ref={padGroupRef}>
        <SpaceportComplex level={useGameStore.getState().progress.spaceportLevel} />
      </group>

      {/* Player Spacecraft at floating origin [0, 0, 0] */}
      <group ref={rocketGroupRef}>
        <group position={[0, -minY, 0]}>
          <RocketMesh
            parts={flightEngine.parts}
            throttle={telemetry?.throttle ?? 0}
            ignited={flightEngine.ignited}
            parachutesDeployed={flightEngine.parachutesDeployed}
            landingLegsDeployed={flightEngine.landingLegsDeployed}
            solarPanelsDeployed={flightEngine.solarPanelsDeployed}
            reentryHeat={reentryHeat}
          />
        </group>
        <LaunchSmoke
          active={Boolean(graphics.particles && flightEngine.ignited && (telemetry?.thrustKN ?? 0) > 20)}
          altitude={telemetry?.altitude ?? 0}
        />
      </group>

      {/* Surface Rover when deployed after landing */}
      <SurfaceRover visible={Boolean(telemetry?.roverDeployed && telemetry?.phase === 'LANDED')} />

      {/* Detached debris stages */}
      {flightEngine.debris.map((d) => {
        const dx = d.position.x - flightEngine.position.x;
        const dy = d.position.y - flightEngine.position.y;
        const dz = d.position.z - flightEngine.position.z;
        if (dx * dx + dy * dy + dz * dz > 2500 * 2500) return null;
        return (
          <group key={d.id} position={[dx, dy, dz]}>
            <RocketMesh parts={d.parts} />
          </group>
        );
      })}

      <OrbitControls
        makeDefault
        target={[0, 4, 0]}
        enablePan={false}
        minDistance={8}
        maxDistance={120}
      />
    </group>
  );
};

export const FlightScene: React.FC = () => {
  const graphics = useGameStore((s) => s.graphics);
  const mapView = useGameStore((s) => s.mapView);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas
        shadows={graphics.shadows}
        camera={{
          position: mapView ? [0, 90, 145] : [18, 12, 22],
          fov: 48,
          near: 0.2,
          far: 14000,
        }}
        dpr={graphics.quality === 'low' ? 1 : [1, 2]}
      >
        <FlightSimulationLoop />
      </Canvas>
    </div>
  );
};

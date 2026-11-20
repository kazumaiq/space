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

const PLANET_SCALE = 0.001; // 1 unit = 1 km for planetary view

const LaunchSmoke: React.FC<{ active: boolean; altitude: number }> = ({ active, altitude }) => {
  const groupRef = useRef<THREE.Group>(null);
  const puffs = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        angle: (i / 10) * Math.PI * 2,
        speed: 2.2 + (i % 3) * 1.1,
        offset: (i * 0.37) % 1,
      })),
    []
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime;
    groupRef.current.children.forEach((child, idx) => {
      const p = puffs[idx];
      const phase = (t * 1.1 + p.offset) % 1;
      const dist = 1.2 + phase * p.speed * 2.2;
      child.position.set(
        Math.cos(p.angle) * dist,
        -2.2 - phase * 1.8,
        Math.sin(p.angle) * dist
      );
      const sc = 0.35 + phase * 1.15;
      child.scale.setScalar(sc);
      const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      mat.opacity = active && altitude < 120 ? (1 - phase) * 0.28 : 0;
    });
  });

  if (!active || altitude > 140) return null;

  return (
    <group ref={groupRef}>
      {puffs.map((_, i) => (
        <mesh key={i}>
          <icosahedronGeometry args={[0.85, 1]} />
          <meshStandardMaterial color="#e2e8f0" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

const SurfaceRover: React.FC<{ visible: boolean }> = ({ visible }) => {
  const roverRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!visible || !roverRef.current) return;
    const t = clock.elapsedTime * 0.3;
    roverRef.current.position.set(5 + Math.sin(t) * 1.5, -0.8, 4 + Math.cos(t) * 1.5);
    roverRef.current.rotation.y = t;
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

const ResponsiveCameraSetup: React.FC<{ mapView: boolean }> = ({ mapView }) => {
  const { camera, size } = useThree();

  useEffect(() => {
    const isPortrait = size.width < size.height;
    if (mapView) {
      camera.position.set(0, isPortrait ? 130 : 90, isPortrait ? 195 : 145);
    } else {
      camera.position.set(isPortrait ? 22 : 16, isPortrait ? 12 : 10, isPortrait ? 28 : 22);
    }
    camera.updateProjectionMatrix();
  }, [mapView, size.width, size.height, camera]);

  return null;
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

    const activeBody = getBodyById(flightEngine.soiBodyId);
    const rMag = Math.sqrt(
      flightEngine.position.x ** 2 +
        flightEngine.position.y ** 2 +
        flightEngine.position.z ** 2
    );
    const alt = Math.max(0, rMag - activeBody.radius);
    const effectiveWarp =
      alt < activeBody.atmosphereHeight && store.timeWarp > 5
        ? 5
        : store.timeWarp;

    flightEngine.step(dt, inputs, effectiveWarp);

    const inAtmo = activeBody.atmosphereHeight > 0 && alt < activeBody.atmosphereHeight;
    const thrustRatio = flightEngine.ignited
      ? Math.min(1, flightEngine.getTelemetry().thrustKN / 220)
      : 0;
    soundEngine.updateEngineThrust(thrustRatio, inAtmo);

    if (rocketGroupRef.current) {
      rocketGroupRef.current.quaternion.copy(flightEngine.orientation);
    }

    // Smooth atmospheric sky gradient from Earth surface to deep space
    if (!store.mapView) {
      if (flightEngine.soiBodyId === 'earth' && alt < 65_000) {
        const t = Math.max(0, Math.min(1, 1 - alt / 65_000));
        const sky = new THREE.Color('#02050b').lerp(new THREE.Color('#0e2f56'), Math.pow(t, 1.4));
        scene.background = sky;
      } else {
        scene.background = new THREE.Color('#02050b');
      }
    } else {
      scene.background = new THREE.Color('#02050b');
    }

    // Position the active planet cleanly below the rocket without clipping the launchpad
    if (planetGroupRef.current && !store.mapView) {
      const dirX = -flightEngine.position.x / Math.max(1, rMag);
      const dirY = -flightEngine.position.y / Math.max(1, rMag);
      const dirZ = -flightEngine.position.z / Math.max(1, rMag);

      // Hide spherical globe while very close to Earth launchpad (launchpad apron provides horizon),
      // then reveal curved Earth cleanly above 800 m so there is zero z-fighting or gray clipping.
      if (flightEngine.soiBodyId === 'earth' && alt < 800) {
        planetGroupRef.current.visible = false;
      } else {
        planetGroupRef.current.visible = true;
        const visualRadius = activeBody.radius * PLANET_SCALE; // 600 units for Earth
        const visualDist = visualRadius + Math.max(12, alt * PLANET_SCALE);
        planetGroupRef.current.position.set(
          dirX * visualDist,
          dirY * visualDist,
          dirZ * visualDist
        );
      }
    }

    // Launchpad & surface ground apron on Earth
    if (padGroupRef.current && !store.mapView) {
      if (flightEngine.soiBodyId === 'earth' && alt < 2500) {
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

    // Moon visible in Earth sky
    if (moonMeshRef.current && !store.mapView) {
      const moonPos = getBodyWorldPosition('moon', flightEngine.simTime);
      const dx = moonPos.x - flightEngine.position.x;
      const dy = moonPos.y - flightEngine.position.y;
      const dz = moonPos.z - flightEngine.position.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      const skyDist = 2200;
      const moonBody = getBodyById('moon');
      const apparentRadius = Math.max(18, (moonBody.radius / Math.max(1, d)) * skyDist * 1.4);
      moonMeshRef.current.position.copy(dir.multiplyScalar(skyDist));
      moonMeshRef.current.scale.setScalar(apparentRadius / 175);
      moonMeshRef.current.visible = flightEngine.soiBodyId === 'earth';
    }

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
  const activeParts = flightEngine.parts.filter((p) => !p.detached);
  const centerY =
    activeParts.length > 0
      ? activeParts.reduce((acc, p) => acc + p.position[1], 0) / activeParts.length
      : 0;
  const reentryHeat =
    telemetry && telemetry.atmosphericTempK > 450
      ? Math.min(1, (telemetry.atmosphericTempK - 450) / 1100)
      : 0;

  const mapPoints = useMemo(() => {
    if (!trajectory || trajectory.points.length < 2) return null;
    const scale = 0.00001;
    return trajectory.points.map(
      (pt) => new THREE.Vector3(pt.x * scale, pt.y * scale, pt.z * scale)
    );
  }, [trajectory]);

  const moonOrbitRing = useMemo(() => {
    const r = 12_000_000 * 0.00001;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    return pts;
  }, []);

  if (mapView) {
    const scale = 0.00001;
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
        <ResponsiveCameraSetup mapView />
        <SpaceBackdrop starCount={Math.min(3500, graphics.starCount)} sunDirection={[250, 80, 180]} />

        <PlanetMesh
          bodyId="earth"
          radius={600_000 * scale}
          atmosphereColor="#38bdf8"
          showClouds={graphics.clouds}
          rotationSpeed={0.01}
          segments={48}
        />

        <Line points={moonOrbitRing} color="#475569" lineWidth={1} transparent opacity={0.55} />

        <group position={[moonPos.x * scale, moonPos.y * scale, moonPos.z * scale]}>
          <PlanetMesh bodyId="moon" radius={175_000 * scale} rotationSpeed={0.005} segments={32} />
          <mesh>
            <sphereGeometry args={[2_400_000 * scale, 24, 24]} />
            <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.08} />
          </mesh>
          <Html distanceFactor={140} center>
            <div className="map-tag">ЛУНА</div>
          </Html>
        </group>

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
      <ResponsiveCameraSetup mapView={false} />
      <SpaceBackdrop starCount={graphics.starCount} sunDirection={[140, 60, 110]} />

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

      <group ref={moonMeshRef}>
        <PlanetMesh bodyId="moon" radius={175} rotationSpeed={0} segments={32} />
      </group>

      <group ref={padGroupRef}>
        <SpaceportComplex level={useGameStore.getState().progress.spaceportLevel} />
      </group>

      {/* Center rocket visually around [0, 0, 0] */}
      <group ref={rocketGroupRef}>
        <group position={[0, -centerY, 0]}>
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

      <SurfaceRover visible={Boolean(telemetry?.roverDeployed && telemetry?.phase === 'LANDED')} />

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
        target={[0, 0, 0]}
        enablePan={false}
        minDistance={10}
        maxDistance={120}
      />
    </group>
  );
};

export const FlightScene: React.FC = () => {
  const graphics = useGameStore((s) => s.graphics);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas
        shadows={graphics.shadows}
        camera={{
          position: [18, 11, 24],
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

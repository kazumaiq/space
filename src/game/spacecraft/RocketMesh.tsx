import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPartDef } from '@/data/partsCatalog';
import { PlacedPart, ActiveStagePart } from '@/game/core/types';

type RenderPart = Pick<
  PlacedPart | ActiveStagePart,
  'uid' | 'partId' | 'stage' | 'position' | 'scale' | 'radialAngle'
> & {
  active?: boolean;
  detached?: boolean;
  fuelRemaining?: number;
};

interface RocketMeshProps {
  parts: RenderPart[];
  throttle?: number;
  ignited?: boolean;
  parachutesDeployed?: boolean;
  landingLegsDeployed?: boolean;
  solarPanelsDeployed?: boolean;
  selectedUid?: string | null;
  onSelectPart?: (uid: string) => void;
  inAtmosphere?: boolean;
  reentryHeat?: number; // 0..1
}

const EngineFlame: React.FC<{ intensity: number; radius: number; isVacuum?: boolean }> = ({
  intensity,
  radius,
  isVacuum,
}) => {
  const outerRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const flicker = 0.88 + Math.sin(clock.elapsedTime * 55) * 0.12 + Math.cos(clock.elapsedTime * 89) * 0.06;
    if (outerRef.current) {
      const len = (1.8 + intensity * 4.5) * flicker;
      outerRef.current.scale.set(1, len, 1);
      outerRef.current.position.y = -len * 0.5;
    }
    if (innerRef.current) {
      const len = (1.1 + intensity * 2.6) * flicker;
      innerRef.current.scale.set(1, len, 1);
      innerRef.current.position.y = -len * 0.5;
    }
  });

  if (intensity <= 0.02) return null;

  return (
    <group position={[0, -0.75, 0]}>
      <mesh ref={outerRef}>
        <coneGeometry args={[radius * (isVacuum ? 1.15 : 0.72), 1, 16, 1, true]} />
        <meshBasicMaterial
          color={isVacuum ? '#38bdf8' : '#f97316'}
          transparent
          opacity={Math.min(0.85, 0.35 + intensity * 0.5)}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={innerRef}>
        <coneGeometry args={[radius * 0.42, 1, 12, 1, true]} />
        <meshBasicMaterial
          color="#fffbeb"
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        color={isVacuum ? '#38bdf8' : '#fb923c'}
        intensity={intensity * 8}
        distance={22}
        decay={2}
        position={[0, -1.5, 0]}
      />
    </group>
  );
};

export const RocketMesh: React.FC<RocketMeshProps> = ({
  parts,
  throttle = 0,
  ignited = false,
  parachutesDeployed = false,
  landingLegsDeployed = false,
  solarPanelsDeployed = false,
  selectedUid = null,
  onSelectPart,
  reentryHeat = 0,
}) => {
  return (
    <group>
      {parts.map((part) => {
        if (part.detached) return null;
        const def = getPartDef(part.partId);
        if (!def) return null;

        const isSelected = selectedUid === part.uid;
        const s = part.scale || 1;
        const w = (def.width / 2) * s;
        const h = def.height * s;
        const emissive = isSelected ? '#0284c7' : reentryHeat > 0.15 ? '#ea580c' : '#000000';
        const emissiveIntensity = isSelected ? 0.45 : reentryHeat * 0.8;

        const isFiring =
          ignited &&
          part.active &&
          (def.thrustVac ?? 0) > 0 &&
          (def.isSolidBooster ? (part.fuelRemaining ?? 1) > 0 : throttle > 0.02);

        const flameIntensity = def.isSolidBooster ? 1 : throttle;

        return (
          <group
            key={part.uid}
            position={part.position}
            rotation={[0, part.radialAngle ?? 0, 0]}
            onClick={(e) => {
              if (onSelectPart) {
                e.stopPropagation();
                onSelectPart(part.uid);
              }
            }}
          >
            {/* CAPSULE */}
            {def.shape === 'capsule' && (
              <group>
                <mesh castShadow receiveShadow>
                  <cylinderGeometry args={[w * 0.48, w, h, 24]} />
                  <meshStandardMaterial
                    color={def.color}
                    metalness={0.35}
                    roughness={0.42}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                  />
                </mesh>
                {/* Heatshield base */}
                <mesh position={[0, -h * 0.48, 0]}>
                  <cylinderGeometry args={[w * 1.01, w * 0.96, h * 0.12, 24]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.6} />
                </mesh>
                {/* Cockpit window */}
                <mesh position={[0, h * 0.08, w * 0.72]} rotation={[-0.25, 0, 0]}>
                  <boxGeometry args={[w * 0.55, h * 0.24, 0.12]} />
                  <meshStandardMaterial
                    color="#0ea5e9"
                    emissive="#38bdf8"
                    emissiveIntensity={0.4}
                    metalness={0.9}
                    roughness={0.1}
                  />
                </mesh>
              </group>
            )}

            {/* PROBE CORE */}
            {def.shape === 'probe' && (
              <group>
                <mesh castShadow receiveShadow>
                  <cylinderGeometry args={[w, w, h, 8]} />
                  <meshStandardMaterial
                    color="#d97706"
                    metalness={0.8}
                    roughness={0.25}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                  />
                </mesh>
                <mesh position={[0, 0, w * 0.9]}>
                  <sphereGeometry args={[0.16 * s, 12, 12]} />
                  <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.6} />
                </mesh>
              </group>
            )}

            {/* FUEL TANKS */}
            {(def.shape === 'tank_small' ||
              def.shape === 'tank_medium' ||
              def.shape === 'tank_large') && (
              <group>
                <mesh castShadow receiveShadow>
                  <cylinderGeometry args={[w, w, h, 28]} />
                  <meshStandardMaterial
                    color={def.color}
                    metalness={0.28}
                    roughness={0.38}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                  />
                </mesh>
                {/* Mission Accent Band */}
                <mesh position={[0, h * 0.22, 0]}>
                  <cylinderGeometry args={[w * 1.012, w * 1.012, h * 0.14, 28]} />
                  <meshStandardMaterial color={def.accentColor} metalness={0.25} roughness={0.45} />
                </mesh>
                {/* Top & bottom structural rings */}
                <mesh position={[0, h * 0.47, 0]}>
                  <cylinderGeometry args={[w * 1.02, w * 1.02, 0.14, 28]} />
                  <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[0, -h * 0.47, 0]}>
                  <cylinderGeometry args={[w * 1.02, w * 1.02, 0.14, 28]} />
                  <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
                </mesh>
                {/* External LOX feed pipe */}
                <mesh position={[w * 1.02, 0, 0]}>
                  <cylinderGeometry args={[0.07 * s, 0.07 * s, h * 0.92, 8]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.75} roughness={0.3} />
                </mesh>
              </group>
            )}

            {/* ENGINES */}
            {(def.shape === 'engine_bell' || def.shape === 'engine_vac') && (
              <group>
                {/* Engine mounting skirt */}
                <mesh position={[0, h * 0.3, 0]} castShadow>
                  <cylinderGeometry args={[w * 0.96, w * 0.72, h * 0.36, 20]} />
                  <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.35} />
                </mesh>
                {/* Bell nozzle */}
                <mesh position={[0, -h * 0.12, 0]} castShadow>
                  <cylinderGeometry
                    args={[
                      w * 0.32,
                      def.shape === 'engine_vac' ? w * 0.78 : w * 0.65,
                      h * 0.68,
                      24,
                      1,
                      false,
                    ]}
                  />
                  <meshStandardMaterial
                    color={def.color}
                    metalness={0.85}
                    roughness={0.28}
                    emissive={isFiring ? '#ea580c' : emissive}
                    emissiveIntensity={isFiring ? 0.55 : emissiveIntensity}
                  />
                </mesh>
                {isFiring && (
                  <EngineFlame
                    intensity={flameIntensity}
                    radius={w * 0.65}
                    isVacuum={def.shape === 'engine_vac'}
                  />
                )}
              </group>
            )}

            {/* SOLID ROCKET BOOSTER */}
            {def.shape === 'srb' && (
              <group>
                <mesh castShadow receiveShadow>
                  <cylinderGeometry args={[w, w, h * 0.78, 20]} />
                  <meshStandardMaterial
                    color={def.color}
                    metalness={0.25}
                    roughness={0.42}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                  />
                </mesh>
                {/* Nose cone */}
                <mesh position={[0, h * 0.51, 0]} castShadow>
                  <coneGeometry args={[w, h * 0.25, 20]} />
                  <meshStandardMaterial color={def.accentColor} metalness={0.3} roughness={0.4} />
                </mesh>
                {/* Nozzle */}
                <mesh position={[0, -h * 0.45, 0]}>
                  <cylinderGeometry args={[w * 0.55, w * 0.8, h * 0.18, 16]} />
                  <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
                </mesh>
                {isFiring && <EngineFlame intensity={1} radius={w * 0.75} />}
              </group>
            )}

            {/* DECOUPLER */}
            {def.shape === 'decoupler' && (
              <group>
                <mesh castShadow>
                  <cylinderGeometry args={[w, w, h, 24]} />
                  <meshStandardMaterial
                    color="#1e293b"
                    metalness={0.65}
                    roughness={0.38}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                  />
                </mesh>
                <mesh>
                  <cylinderGeometry args={[w * 1.02, w * 1.02, h * 0.26, 24]} />
                  <meshStandardMaterial color="#eab308" metalness={0.4} roughness={0.45} />
                </mesh>
              </group>
            )}

            {/* FAIRING */}
            {def.shape === 'fairing' && (
              <mesh castShadow>
                <coneGeometry args={[w, h, 24]} />
                <meshStandardMaterial
                  color={def.color}
                  metalness={0.22}
                  roughness={0.32}
                  emissive={emissive}
                  emissiveIntensity={emissiveIntensity}
                />
              </mesh>
            )}

            {/* PARACHUTE */}
            {def.shape === 'parachute' && (
              <group>
                <mesh castShadow>
                  <cylinderGeometry args={[w * 0.75, w, h, 16]} />
                  <meshStandardMaterial
                    color={def.color}
                    metalness={0.25}
                    roughness={0.5}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                  />
                </mesh>
                {parachutesDeployed && (
                  <group position={[0, 4.5, 0]}>
                    <mesh>
                      <sphereGeometry args={[3.2, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                      <meshStandardMaterial
                        color="#f97316"
                        side={THREE.DoubleSide}
                        roughness={0.8}
                      />
                    </mesh>
                    {/* Risers */}
                    {[0, 1.57, 3.14, 4.71].map((a) => (
                      <mesh
                        key={a}
                        position={[Math.cos(a) * 1.2, -2.1, Math.sin(a) * 1.2]}
                        rotation={[Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28]}
                      >
                        <cylinderGeometry args={[0.025, 0.025, 4.4, 6]} />
                        <meshBasicMaterial color="#e2e8f0" />
                      </mesh>
                    ))}
                  </group>
                )}
              </group>
            )}

            {/* LANDING LEGS */}
            {def.shape === 'landing_leg' && (
              <group
                rotation={[0, 0, landingLegsDeployed ? -0.58 : 0.08]}
                position={[landingLegsDeployed ? 0.35 : 0, landingLegsDeployed ? -0.35 : 0, 0]}
              >
                <mesh castShadow>
                  <boxGeometry args={[0.16 * s, h, 0.16 * s]} />
                  <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.35} />
                </mesh>
                <mesh position={[0, -h * 0.52, 0]}>
                  <cylinderGeometry args={[0.28 * s, 0.34 * s, 0.12 * s, 10]} />
                  <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.4} />
                </mesh>
              </group>
            )}

            {/* SOLAR PANEL */}
            {def.shape === 'solar_panel' && (
              <group>
                <mesh castShadow>
                  <boxGeometry args={[0.14 * s, h * 0.7, 0.35 * s]} />
                  <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
                </mesh>
                {solarPanelsDeployed && (
                  <mesh position={[1.9 * s, 0, 0]}>
                    <boxGeometry args={[3.4 * s, h * 0.9, 0.05]} />
                    <meshStandardMaterial
                      color="#1d4ed8"
                      emissive="#1e3a8a"
                      emissiveIntensity={0.35}
                      metalness={0.85}
                      roughness={0.18}
                    />
                  </mesh>
                )}
              </group>
            )}

            {/* BATTERY */}
            {def.shape === 'battery' && (
              <group>
                <mesh castShadow>
                  <cylinderGeometry args={[w, w, h, 24]} />
                  <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.35} />
                </mesh>
                <mesh>
                  <cylinderGeometry args={[w * 1.015, w * 1.015, h * 0.32, 24]} />
                  <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={0.45} />
                </mesh>
              </group>
            )}

            {/* SCIENCE BAY */}
            {def.shape === 'science_bay' && (
              <group>
                <mesh castShadow receiveShadow>
                  <cylinderGeometry args={[w, w, h, 24]} />
                  <meshStandardMaterial
                    color={def.color}
                    metalness={0.45}
                    roughness={0.35}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                  />
                </mesh>
                {/* Sensor optic pod */}
                <mesh position={[w * 0.95, 0, 0]}>
                  <boxGeometry args={[0.25 * s, h * 0.55, 0.45 * s]} />
                  <meshStandardMaterial color="#0284c7" emissive="#38bdf8" emissiveIntensity={0.4} />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
};

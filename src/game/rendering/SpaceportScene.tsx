import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { SpaceBackdrop } from '@/game/rendering/SpaceBackdrop';
import { RocketMesh } from '@/game/spacecraft/RocketMesh';
import { useGameStore } from '@/stores/useGameStore';

export const SpaceportComplex: React.FC<{ level?: number }> = ({ level = 1 }) => {
  return (
    <group>
      {/* Ground terrain apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[180, 48]} />
        <meshStandardMaterial color="#1f2d24" roughness={0.95} metalness={0.02} />
      </mesh>

      {/* Concrete Launchpad Foundation */}
      <mesh position={[0, 0.4, 0]} receiveShadow castShadow>
        <boxGeometry args={[16, 0.8, 16]} />
        <meshStandardMaterial color="#475569" roughness={0.85} metalness={0.15} />
      </mesh>

      {/* Blast flame deflector trench */}
      <mesh position={[0, 0.82, 0]} receiveShadow>
        <boxGeometry args={[5.5, 0.1, 14]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Launch clamps */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ang) => (
        <mesh
          key={ang}
          position={[Math.cos(ang) * 2.4, 1.3, Math.sin(ang) * 2.4]}
          castShadow
        >
          <boxGeometry args={[0.5, 1.2, 0.5]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}

      {/* Umbilical Launch Tower (Gantry) */}
      <group position={[-6.2, 0.8, 0]}>
        <mesh position={[0, 11, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 22, 2.6]} />
          <meshStandardMaterial color="#dc2626" metalness={0.55} roughness={0.45} wireframe={false} />
        </mesh>
        {/* Cross beams */}
        {[4, 8, 12, 16, 20].map((y) => (
          <mesh key={y} position={[1.8, y, 0]} castShadow>
            <boxGeometry args={[3.4, 0.35, 0.6]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.35} />
          </mesh>
        ))}
        {/* Aviation warning beacon */}
        <mesh position={[0, 22.5, 0]}>
          <sphereGeometry args={[0.35, 12, 12]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <pointLight position={[0, 22.8, 0]} color="#ef4444" intensity={4} distance={15} />
      </group>

      {/* Vehicle Assembly Building (VAB Hangar) */}
      <group position={[34, 0, -24]}>
        <mesh position={[0, 12, 0]} castShadow receiveShadow>
          <boxGeometry args={[24, 24, 20]} />
          <meshStandardMaterial color="#334155" metalness={0.35} roughness={0.6} />
        </mesh>
        {/* Hangar bay doors */}
        <mesh position={[-12.1, 9, 0]}>
          <boxGeometry args={[0.3, 18, 9]} />
          <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Accent stripe */}
        <mesh position={[0, 21.5, 0]}>
          <boxGeometry args={[24.4, 1.5, 20.4]} />
          <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={0.25} />
        </mesh>
      </group>

      {/* Mission Control Tower */}
      <group position={[-28, 0, 20]}>
        <mesh position={[0, 6, 0]} castShadow receiveShadow>
          <boxGeometry args={[10, 12, 10]} />
          <meshStandardMaterial color="#475569" roughness={0.55} />
        </mesh>
        {/* Illuminated control deck */}
        <mesh position={[0, 13.5, 0]} castShadow>
          <cylinderGeometry args={[6.8, 5.2, 3.2, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 13.5, 0]}>
          <cylinderGeometry args={[6.9, 6.2, 1.4, 8]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={0.65}
            roughness={0.15}
          />
        </mesh>
      </group>

      {/* Cryogenic Fuel Storage Spheres */}
      {[-16, -23].map((z, i) => (
        <group key={z} position={[-18, 3.2, z]}>
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[2.8, 20, 20]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.35} roughness={0.3} />
          </mesh>
          <mesh position={[0, -2.5, 0]}>
            <cylinderGeometry args={[2.2, 2.4, 1.2, 12]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {i === 0 && level >= 2 && (
            <mesh position={[0, 3.4, 0]}>
              <sphereGeometry args={[0.25, 10, 10]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          )}
        </group>
      ))}

      {/* Roadway from VAB to Pad */}
      <mesh rotation={[-Math.PI / 2, 0, -0.58]} position={[14, 0.04, -10]} receiveShadow>
        <planeGeometry args={[42, 7]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>
    </group>
  );
};

export const SpaceportScene: React.FC = () => {
  const graphics = useGameStore((s) => s.graphics);
  const blueprint = useGameStore((s) => s.getSelectedBlueprint());
  const spaceportLevel = useGameStore((s) => s.progress.spaceportLevel);

  // Compute lowest Y of blueprint so rocket sits cleanly on pad
  const minY = blueprint.parts.reduce((acc, p) => Math.min(acc, p.position[1]), 0);
  const offsetY = 1.6 - minY;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas
        shadows={graphics.shadows}
        camera={{ position: [18, 13, 24], fov: 46, near: 0.1, far: 10000 }}
        dpr={graphics.quality === 'low' ? 1 : [1, 2]}
      >
        <color attach="background" args={['#0c1e38']} />
        <fog attach="fog" args={['#0c1e38', 75, 240]} />
        <SpaceBackdrop starCount={Math.min(2000, graphics.starCount)} sunDirection={[60, 50, 40]} />
        <SpaceportComplex level={spaceportLevel} />
        <group position={[0, offsetY, 0]}>
          <RocketMesh parts={blueprint.parts} />
        </group>
        <OrbitControls
          target={[0, 8, 0]}
          enablePan={false}
          minDistance={12}
          maxDistance={65}
          maxPolarAngle={Math.PI * 0.48}
        />
      </Canvas>
    </div>
  );
};

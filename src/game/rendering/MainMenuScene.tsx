import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PlanetMesh } from '@/game/planets/PlanetMesh';
import { SpaceBackdrop } from '@/game/rendering/SpaceBackdrop';
import { useGameStore } from '@/stores/useGameStore';

const OrbitingMoon: React.FC = () => {
  const moonGroup = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (moonGroup.current) {
      const t = clock.elapsedTime * 0.06 + 0.8;
      moonGroup.current.position.set(Math.cos(t) * 14, Math.sin(t * 0.4) * 2.2, Math.sin(t) * 14);
    }
  });
  return (
    <group ref={moonGroup}>
      <PlanetMesh bodyId="moon" radius={1.15} rotationSpeed={0.012} segments={40} />
    </group>
  );
};

const CameraDrift: React.FC = () => {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.08;
    camera.position.x = Math.sin(t) * 2.4 + 4.5;
    camera.position.y = Math.cos(t * 0.7) * 1.1 + 1.8;
    camera.lookAt(-1.2, 0, 0);
  });
  return null;
};

export const MainMenuScene: React.FC = () => {
  const graphics = useGameStore((s) => s.graphics);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <Canvas
        shadows={graphics.shadows}
        camera={{ position: [4.5, 1.8, 12.5], fov: 45, near: 0.1, far: 12000 }}
        dpr={graphics.quality === 'low' ? 1 : [1, 2]}
      >
        <color attach="background" args={['#02050b']} />
        <SpaceBackdrop starCount={graphics.starCount} sunDirection={[40, 18, 25]} />
        <group position={[-2.2, -0.8, 0]}>
          <PlanetMesh
            bodyId="earth"
            radius={4.6}
            atmosphereColor="#38bdf8"
            showClouds={graphics.clouds}
            rotationSpeed={0.018}
            segments={graphics.quality === 'low' ? 36 : 64}
          />
          <OrbitingMoon />
        </group>
        <CameraDrift />
      </Canvas>
    </div>
  );
};

import React, { useMemo } from 'react';
import * as THREE from 'three';

interface SpaceBackdropProps {
  starCount?: number;
  sunDirection?: [number, number, number];
}

export const SpaceBackdrop: React.FC<SpaceBackdropProps> = ({
  starCount = 5000,
  sunDirection = [120, 45, 90],
}) => {
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const palette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#dbeafe'),
      new THREE.Color('#fef3c7'),
      new THREE.Color('#93c5fd'),
      new THREE.Color('#fed7aa'),
    ];

    for (let i = 0; i < starCount; i++) {
      const r = 4200 + Math.random() * 1800;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const c = palette[Math.floor(Math.random() * palette.length)];
      const brightness = 0.5 + Math.random() * 0.5;
      col[i * 3] = c.r * brightness;
      col[i * 3 + 1] = c.g * brightness;
      col[i * 3 + 2] = c.b * brightness;
    }

    return { positions: pos, colors: col };
  }, [starCount]);

  const sunPos = useMemo(() => {
    const v = new THREE.Vector3(...sunDirection).normalize().multiplyScalar(3200);
    return [v.x, v.y, v.z] as [number, number, number];
  }, [sunDirection]);

  return (
    <group>
      {/* Ambient subtle galactic bounce + directional sunlight */}
      <ambientLight intensity={0.22} color="#94a3b8" />
      <directionalLight
        position={sunDirection}
        intensity={2.6}
        color="#fffbeb"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <hemisphereLight args={['#38bdf8', '#090d16', 0.2]} />

      {/* Multi-colored deep space starfield */}
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={starCount} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={starCount} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          size={6.5}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.92}
          depthWrite={false}
        />
      </points>

      {/* Distant Sun disk & volumetric corona */}
      <group position={sunPos}>
        <mesh>
          <sphereGeometry args={[125, 24, 24]} />
          <meshBasicMaterial color="#fffbeb" />
        </mesh>
        <mesh>
          <sphereGeometry args={[210, 24, 24]} />
          <meshBasicMaterial color="#fde68a" transparent opacity={0.28} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[360, 24, 24]} />
          <meshBasicMaterial color="#fb923c" transparent opacity={0.11} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
};

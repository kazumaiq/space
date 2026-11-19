import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getPlanetTextures } from '@/game/rendering/proceduralTextures';

interface PlanetMeshProps {
  bodyId: string;
  radius: number;
  position?: [number, number, number];
  atmosphereColor?: string;
  showClouds?: boolean;
  rotationSpeed?: number;
  segments?: number;
}

const ATMOSPHERE_VERTEX = `
  varying vec3 vNormal;
  varying vec3 vPositionNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ATMOSPHERE_FRAGMENT = `
  uniform vec3 glowColor;
  varying vec3 vNormal;
  varying vec3 vPositionNormal;
  void main() {
    float intensity = pow(0.68 - dot(vNormal, -vPositionNormal), 3.2);
    gl_FragColor = vec4(glowColor, clamp(intensity, 0.0, 0.85));
  }
`;

export const PlanetMesh: React.FC<PlanetMeshProps> = ({
  bodyId,
  radius,
  position = [0, 0, 0],
  atmosphereColor,
  showClouds = true,
  rotationSpeed = 0.008,
  segments = 64,
}) => {
  const planetRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  const textures = useMemo(() => getPlanetTextures(bodyId), [bodyId]);

  const atmosphereMaterial = useMemo(() => {
    if (!atmosphereColor) return null;
    return new THREE.ShaderMaterial({
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      uniforms: {
        glowColor: { value: new THREE.Color(atmosphereColor) },
      },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
  }, [atmosphereColor]);

  useFrame((_, delta) => {
    if (planetRef.current && rotationSpeed !== 0) {
      planetRef.current.rotation.y += rotationSpeed * delta;
    }
    if (cloudsRef.current && rotationSpeed !== 0) {
      cloudsRef.current.rotation.y += rotationSpeed * 1.35 * delta;
    }
  });

  return (
    <group position={position}>
      <mesh ref={planetRef} receiveShadow castShadow>
        <sphereGeometry args={[radius, segments, segments]} />
        <meshStandardMaterial
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={radius * 0.006}
          roughness={bodyId === 'earth' ? 0.72 : 0.92}
          metalness={bodyId === 'earth' ? 0.08 : 0.02}
        />
      </mesh>

      {showClouds && textures.cloudsMap && (
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[radius * 1.007, Math.max(32, segments - 16), Math.max(32, segments - 16)]} />
          <meshStandardMaterial
            map={textures.cloudsMap}
            transparent
            opacity={0.82}
            depthWrite={false}
            roughness={0.95}
          />
        </mesh>
      )}

      {atmosphereMaterial && (
        <mesh material={atmosphereMaterial}>
          <sphereGeometry args={[radius * 1.055, 48, 48]} />
        </mesh>
      )}
    </group>
  );
};

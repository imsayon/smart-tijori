'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import {
  Box3,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  Vector3,
  MathUtils,
} from 'three';

export type SpatialMode = 'hero' | 'story' | 'telemetry' | 'vault';

function useCenteredModel(path: string, scale: number) {
  const { scene } = useLoader(GLTFLoader, path);
  return useMemo(() => {
    const model = scene.clone(true);
    const bounds = new Box3().setFromObject(model);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const fit = scale / Math.max(size.x, size.y, size.z, 0.001);
    model.position.sub(center.multiplyScalar(fit));
    model.scale.setScalar(fit);
    return model;
  }, [scene, scale]);
}

function KineticDust({ count = 48 }: { count?: number }) {
  const points = useMemo(() => {
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 1.2 + ((i * 17) % 25) / 10;
      coords[i * 3] = Math.cos(angle * 2.3) * radius;
      coords[i * 3 + 1] = Math.sin(angle * 3.1) * 2.2;
      coords[i * 3 + 2] = Math.sin(angle * 1.7) * radius;
    }
    return coords;
  }, [count]);

  const groupRef = useRef<Group>(null);
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.04;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.03) * 0.06;
  });

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[points, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.065}
          color="#d4af37"
          transparent
          opacity={0.45}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

function CartLockMechanism({
  progress,
  mode = 'story',
  interactive = true,
}: {
  progress: number;
  mode?: SpatialMode;
  interactive?: boolean;
}) {
  const lock = useCenteredModel('/atelier/cartlock.glb', mode === 'telemetry' ? 1.8 : 2.5);
  const branch = useCenteredModel('/atelier/branch.glb', mode === 'telemetry' ? 1.2 : 1.7);
  const group = useRef<Group>(null);
  const branchGroup = useRef<Group>(null);
  const pointer = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, isDragging: false });

  useFrame((state) => {
    if (!group.current) return;

    pointer.current.x = MathUtils.lerp(pointer.current.x, pointer.current.targetX, 0.08);
    pointer.current.y = MathUtils.lerp(pointer.current.y, pointer.current.targetY, 0.08);

    const time = state.clock.elapsedTime;
    const idleY = Math.sin(time * 0.35) * 0.05;
    const idleX = Math.cos(time * 0.25) * 0.03;

    if (mode === 'hero') {
      group.current.rotation.y = -0.28 + progress * 0.85 + pointer.current.x * 0.45 + idleY;
      group.current.rotation.x = 0.12 - pointer.current.y * 0.3 + idleX;
      group.current.position.y = Math.sin(time * 0.5) * 0.08;
    } else if (mode === 'telemetry') {
      group.current.rotation.y = time * 0.22 + pointer.current.x * 0.25;
      group.current.rotation.x = 0.16 + Math.sin(time * 0.3) * 0.06 - pointer.current.y * 0.15;
    } else if (mode === 'vault') {
      group.current.rotation.y = -0.1 + Math.sin(time * 0.4) * 0.12 + pointer.current.x * 0.5;
      group.current.rotation.x = 0.08 - pointer.current.y * 0.25;
    } else {
      group.current.rotation.y = -0.38 + progress * 1.4 + pointer.current.x * 0.35 + idleY;
      group.current.rotation.x = 0.12 + Math.sin(progress * Math.PI) * 0.08 - pointer.current.y * 0.2;
    }

    if (branchGroup.current) {
      if (mode === 'story') {
        const branchScale = progress > 0.35 ? 0.45 + Math.min(0.4, (progress - 0.35) * 0.7) : 0;
        branchGroup.current.scale.setScalar(branchScale);
        branchGroup.current.position.x = 1.48 + Math.sin(time * 0.6) * 0.04;
        branchGroup.current.position.y = -0.18 + Math.cos(time * 0.5) * 0.05;
      } else if (mode === 'hero') {
        branchGroup.current.scale.setScalar(0.72);
        branchGroup.current.position.set(1.65, -0.22 + Math.sin(time * 0.4) * 0.06, -0.4);
      }
    }
  });

  const onPointerDown = () => { pointer.current.isDragging = true; };
  const onPointerUp = () => { pointer.current.isDragging = false; };
  const onPointerMove = (e: { pointer: { x: number; y: number } }) => {
    if (interactive) {
      pointer.current.targetX = e.pointer.x;
      pointer.current.targetY = e.pointer.y;
    }
  };
  const onPointerLeave = () => {
    pointer.current.targetX = 0;
    pointer.current.targetY = 0;
    pointer.current.isDragging = false;
  };

  return (
    <group
      ref={group}
      rotation={[0.1, -0.36, -0.05]}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <mesh position={[0, 0, -2.8]}>
        <planeGeometry args={[12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <primitive object={lock} position={[0, mode === 'telemetry' ? 0.05 : 0.12, 0]} />

      {(mode === 'hero' || mode === 'story') && (
        <group ref={branchGroup} position={[1.56, -0.2, -0.64]}>
          <primitive object={branch} />
        </group>
      )}
    </group>
  );
}

function LedgerHalo({ progress, mode = 'story' }: { progress: number; mode?: SpatialMode }) {
  const ring = useRef<InstancedMesh>(null);
  const ringCount = mode === 'telemetry' ? 36 : 64;

  const matrices = useMemo(() => {
    const entries: Matrix4[] = [];
    const object = new Object3D();
    const radius = mode === 'telemetry' ? 1.55 : 2.15 + progress * 0.22;
    for (let index = 0; index < ringCount; index++) {
      const angle = (index / ringCount) * Math.PI * 2;
      object.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * 0.04,
        Math.sin(angle) * radius,
      );
      object.rotation.set(0, -angle, 0.18);
      object.scale.set(mode === 'telemetry' ? 0.45 : 0.69, 0.022, 0.075);
      object.updateMatrix();
      entries.push(object.matrix.clone());
    }
    return entries;
  }, [progress, ringCount, mode]);

  useEffect(() => {
    if (!ring.current) return;
    matrices.forEach((matrix, index) => ring.current?.setMatrixAt(index, matrix));
    ring.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);

  const baseRadius = mode === 'telemetry' ? 1.55 : 2.15 + progress * 0.22;
  const outerRadius = mode === 'telemetry' ? 1.85 : 2.52 + progress * 0.22;

  return (
    <>
      <instancedMesh ref={ring} args={[undefined, undefined, matrices.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c8a858" roughness={0.35} metalness={0.4} />
      </instancedMesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.45, 0]}>
        <torusGeometry args={[baseRadius, 0.014, 6, 90]} />
        <meshBasicMaterial color="#d4e992" transparent opacity={0.65} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]}>
        <torusGeometry args={[outerRadius, 0.007, 5, 90]} />
        <meshBasicMaterial color="#b3924f" transparent opacity={0.35} />
      </mesh>
    </>
  );
}

function TijoriSafeDial({ progress }: { progress: number }) {
  const dialRef = useRef<Group>(null);
  useFrame((state) => {
    if (!dialRef.current) return;
    dialRef.current.rotation.z = -progress * Math.PI * 2.5 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
  });

  return (
    <group position={[0, -0.1, 0.2]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.1, 1.15, 0.16, 48]} />
        <meshStandardMaterial color="#503523" roughness={0.4} metalness={0.6} />
      </mesh>
      <group ref={dialRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.9, 0.9, 0.22, 32]} />
          <meshStandardMaterial color="#c9a247" roughness={0.25} metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.78, 0.12]}>
          <boxGeometry args={[0.06, 0.22, 0.04]} />
          <meshBasicMaterial color="#d4e992" />
        </mesh>
      </group>
    </group>
  );
}

export default function SpatialScene({
  progress = 0,
  mode = 'story',
  interactive = true,
}: {
  progress?: number;
  mode?: SpatialMode;
  interactive?: boolean;
}) {
  const isTelemetry = mode === 'telemetry';
  const isVault = mode === 'vault';
  const cameraPosition = isTelemetry ? [4.2, 3.2, 5.2] as const : [5.8, 4.3, 7.4] as const;

  return (
    <Canvas
      camera={{ position: cameraPosition, fov: isTelemetry ? 28 : 34 }}
      dpr={[1, 1.5]}
      frameloop="always"
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={1.8} color="#f7f1e4" />
      <hemisphereLight args={['#faf2e3', '#1c3427', 1.3]} />
      <directionalLight position={[4, 8, 6]} intensity={2.5} color="#fff1d6" />
      <pointLight position={[-3, 2, -1]} intensity={6} color="#d4af37" distance={9} />
      <pointLight position={[3, -1, 3]} intensity={4} color="#d4e992" distance={7} />

      <Suspense fallback={null}>
        <KineticDust count={isTelemetry ? 24 : 44} />
        {isVault ? (
          <TijoriSafeDial progress={progress} />
        ) : (
          <>
            <LedgerHalo progress={progress} mode={mode} />
            <CartLockMechanism progress={progress} mode={mode} interactive={interactive} />
          </>
        )}
      </Suspense>
    </Canvas>
  );
}

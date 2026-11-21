'use client';

import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Box3, Group, InstancedMesh, Matrix4, Object3D, Vector3 } from 'three';

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

function CartLock({ progress }: { progress: number }) {
  const lock = useCenteredModel('/atelier/cartlock.glb', 2.55);
  const branch = useCenteredModel('/atelier/branch.glb', 1.75);
  const group = useRef<Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y = -0.36 + progress * 0.95 + pointer.current.x * 0.24 + Math.sin(state.clock.elapsedTime * 0.28) * 0.035;
    group.current.rotation.x = 0.1 + pointer.current.y * 0.12;
  });
  return <group ref={group} rotation={[0.1, -0.36 + progress * 0.95, -0.08]}
    onPointerMove={event => { pointer.current.x = event.pointer.x; pointer.current.y = event.pointer.y; }}
    onPointerLeave={() => { pointer.current.x = 0; pointer.current.y = 0; }}>
    <mesh position={[0, 0, -2.9]}>
      <planeGeometry args={[10, 7]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    <primitive object={lock} position={[0, 0.12, 0]} />
    <group position={[1.56, -0.2, -0.64]} scale={progress > 0.43 ? 0.45 + Math.min(0.4, (progress - 0.43) * 0.65) : 0}>
      <primitive object={branch} />
    </group>
  </group>;
}

function LedgerHalo({ progress }: { progress: number }) {
  const ring = useRef<InstancedMesh>(null);
  const matrices = useMemo(() => {
    const entries: Matrix4[] = [];
    const object = new Object3D();
    for (let index = 0; index < 64; index++) {
      const angle = index / 64 * Math.PI * 2;
      object.position.set(Math.cos(angle) * (2.15 + progress * 0.2), Math.sin(angle) * 0.04,
        Math.sin(angle) * (2.15 + progress * 0.2));
      object.rotation.set(0, -angle, 0.18);
      object.scale.set(0.69, 0.022, 0.075);
      object.updateMatrix();
      entries.push(object.matrix.clone());
    }
    return entries;
  }, [progress]);

  useEffect(() => {
    if (!ring.current) return;
    matrices.forEach((matrix, index) => ring.current?.setMatrixAt(index, matrix));
    ring.current.instanceMatrix.needsUpdate = true;
  }, [matrices]);
  return <>
    <instancedMesh ref={ring} args={[undefined, undefined, matrices.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#bdd88a" roughness={0.45} metalness={0.1} />
    </instancedMesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.48, 0]}>
      <torusGeometry args={[2.15 + progress * 0.2, 0.012, 6, 100]} />
      <meshBasicMaterial color="#d4e992" transparent opacity={0.5} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.51, 0]}>
      <torusGeometry args={[2.52 + progress * 0.2, 0.006, 5, 100]} />
      <meshBasicMaterial color="#b5c89c" transparent opacity={0.28} />
    </mesh>
  </>;
}

export default function SpatialScene({ progress }: { progress: number }) {
  return <Canvas camera={{ position: [5.8, 4.3, 7.4], fov: 34 }} dpr={[1, 1.5]} frameloop="always"
    gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}>
    <ambientLight intensity={1.7} color="#e8efd9" />
    <hemisphereLight args={['#f0e8d5', '#213a2c', 1.2]} />
    <directionalLight position={[3, 7, 5]} intensity={2.2} color="#fff0ce" />
    <pointLight position={[-3, 1.5, -1]} intensity={8} color="#d6e892" distance={8} />
    <Suspense fallback={null}>
      <LedgerHalo progress={progress} />
      <CartLock progress={progress} />
    </Suspense>
  </Canvas>;
}

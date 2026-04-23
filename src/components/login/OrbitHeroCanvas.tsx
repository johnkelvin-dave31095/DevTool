import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type PointerState = {
  active: boolean;
  x: number;
  y: number;
};

type ScrollState = {
  current: number;
  target: number;
};

type ClusterSpec = {
  center: [number, number, number];
  focusRadius: number;
};

type OrbitCubeSpec = {
  radius: number;
  verticalRadius: number;
  depthRadius: number;
  speed: number;
  phase: number;
  wobble: number;
  repulsion: number;
  scale: [number, number, number];
};

type SphereTileSpec = {
  theta: number;
  phi: number;
  radius: number;
  drift: number;
  repulsion: number;
  scale: [number, number, number];
};

type StillLifeSpec = {
  kind: "cube" | "sphere";
  offset: [number, number, number];
  drift: number;
  phase: number;
  repulsion: number;
  scale: [number, number, number];
};

const STORY_CLUSTERS: ClusterSpec[] = [
  { center: [-10.5, 8.2, -2.4], focusRadius: 11.5 },
  { center: [10.8, 7.1, -1.2], focusRadius: 11.5 },
  { center: [0, -18.5, 2.4], focusRadius: 13.5 },
];

const CAMERA_PATH_POINTS = [
  new THREE.Vector3(-14.2, 10.8, 12.8),
  new THREE.Vector3(-11.4, 9.8, 8.6),
  new THREE.Vector3(-2.6, 9.3, 14.8),
  new THREE.Vector3(6.4, 8.5, 12.6),
  new THREE.Vector3(13.2, 8.1, 8.8),
  new THREE.Vector3(8.2, 0.4, 16.2),
  new THREE.Vector3(2.2, -9.4, 14.1),
  new THREE.Vector3(0.4, -17.6, 10.2),
  new THREE.Vector3(0.2, -22.6, 8.8),
];

const LOOK_PATH_POINTS = [
  new THREE.Vector3(-10.5, 8.2, -2.4),
  new THREE.Vector3(-8.8, 8.1, -1.4),
  new THREE.Vector3(0.8, 8.4, -0.8),
  new THREE.Vector3(10.8, 7.1, -1.2),
  new THREE.Vector3(7.2, 2.4, 0.4),
  new THREE.Vector3(2.6, -6.8, 1),
  new THREE.Vector3(0.2, -14.8, 1.8),
  new THREE.Vector3(0, -18.5, 2.4),
];

const CAMERA_FOV_STOPS = [
  { t: 0, value: 28.5 },
  { t: 0.24, value: 34.8 },
  { t: 0.5, value: 29.2 },
  { t: 0.78, value: 35.6 },
  { t: 1, value: 30.4 },
];

function sampleScalarStops(stops: Array<{ t: number; value: number }>, progress: number) {
  if (progress <= stops[0].t) {
    return stops[0].value;
  }

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const current = stops[index];

    if (progress <= current.t) {
      const localProgress = (progress - previous.t) / (current.t - previous.t);
      return THREE.MathUtils.lerp(previous.value, current.value, localProgress);
    }
  }

  return stops[stops.length - 1].value;
}

function createOrbitCubes() {
  const cubes: OrbitCubeSpec[] = [];

  for (let index = 0; index < 22; index += 1) {
    const seed = index * 13.7;
    cubes.push({
      radius: 2.55 + Math.sin(seed * 0.18) * 0.55,
      verticalRadius: 1.1 + Math.cos(seed * 0.15) * 0.26,
      depthRadius: 0.8 + Math.sin(seed * 0.22) * 0.28,
      speed: 0.08 + Math.cos(seed * 0.12) * 0.018,
      phase: (index / 22) * Math.PI * 2,
      wobble: 0.07 + ((Math.sin(seed * 0.35) + 1) * 0.03),
      repulsion: 0.54 + ((Math.cos(seed * 0.28) + 1) * 0.16),
      scale: [
        0.18 + ((Math.sin(seed * 0.24) + 1) * 0.08),
        0.22 + ((Math.cos(seed * 0.19) + 1) * 0.09),
        0.18 + ((Math.sin(seed * 0.31 + 0.6) + 1) * 0.08),
      ],
    });
  }

  return cubes;
}

function createSphereTiles() {
  const tiles: SphereTileSpec[] = [];

  for (let index = 0; index < 54; index += 1) {
    const phi = Math.acos(1 - (2 * (index + 0.5)) / 54);
    const theta = Math.PI * (1 + Math.sqrt(5)) * index;
    const seed = index * 9.1;

    tiles.push({
      theta,
      phi,
      radius: 3.25 + Math.sin(seed * 0.18) * 0.18,
      drift: 0.08 + ((Math.cos(seed * 0.21) + 1) * 0.03),
      repulsion: 0.52 + ((Math.sin(seed * 0.29) + 1) * 0.18),
      scale: [
        0.5 + ((Math.sin(seed * 0.13) + 1) * 0.14),
        0.18 + ((Math.cos(seed * 0.17) + 1) * 0.05),
        0.5 + ((Math.sin(seed * 0.19 + 0.4) + 1) * 0.14),
      ],
    });
  }

  return tiles;
}

function createStillLifeObjects() {
  const objects: StillLifeSpec[] = [];
  const rawOffsets: Array<[number, number, number]> = [
    [-2.8, 1.1, -1.4],
    [-1.2, 2.1, 0.7],
    [1.9, 1.8, -0.6],
    [3, 0.2, 1.2],
    [2.3, -1.9, -1.1],
    [-0.4, -2.6, 1.3],
    [-3.2, -1.4, 0.4],
    [0.7, 0.3, 2.1],
    [-1.9, 0.1, -2],
    [1.2, -3.1, 0.1],
    [3.5, -2.8, 1.8],
    [-3.7, 2.5, 0.6],
  ];

  rawOffsets.forEach((offset, index) => {
    const seed = index * 8.3;

    objects.push({
      kind: index % 3 === 0 ? "sphere" : "cube",
      offset,
      drift: 0.03 + ((Math.cos(seed * 0.24) + 1) * 0.015),
      phase: index * 0.62,
      repulsion: 0.55 + ((Math.sin(seed * 0.27) + 1) * 0.16),
      scale:
        index % 3 === 0
          ? [0.58 + ((Math.sin(seed * 0.16) + 1) * 0.12), 0.58 + ((Math.sin(seed * 0.16) + 1) * 0.12), 0.58 + ((Math.sin(seed * 0.16) + 1) * 0.12)]
          : [
              0.34 + ((Math.sin(seed * 0.18) + 1) * 0.12),
              0.34 + ((Math.cos(seed * 0.22) + 1) * 0.12),
              0.34 + ((Math.sin(seed * 0.26 + 0.4) + 1) * 0.12),
            ],
    });
  });

  return objects;
}

export function OrbitHeroCanvas() {
  const pointerRef = useRef<PointerState>({ active: false, x: 0, y: 0 });
  const scrollRef = useRef<ScrollState>({ current: 0, target: 0 });

  function handlePointerMove(event: React.MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const normalizedY = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1);

    pointerRef.current = {
      active: true,
      x: THREE.MathUtils.clamp(normalizedX, -1, 1),
      y: THREE.MathUtils.clamp(normalizedY, -1, 1),
    };
  }

  function handlePointerLeave() {
    pointerRef.current = { active: false, x: 0, y: 0 };
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    scrollRef.current.target = THREE.MathUtils.clamp(
      scrollRef.current.target + event.deltaY * 0.00028,
      0,
      1,
    );
  }

  return (
    <div
      className="absolute inset-0"
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      onWheel={handleWheel}
    >
      <Canvas
        dpr={[1, 1.2]}
        camera={{ position: [-14.2, 10.8, 12.8], fov: 28.5 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#dcecf2"]} />
        <fog attach="fog" args={["#dcecf2", 14, 58]} />
        <ambientLight intensity={1.15} color="#ffffff" />
        <directionalLight position={[4.5, 6, 5]} intensity={1.3} color="#ffffff" />
        <pointLight position={[0, 1, 2.4]} intensity={8.5} color="#d3f7ff" distance={12} />
        <pointLight position={[3.4, -1.2, 2]} intensity={3.6} color="#bcefff" distance={10} />
        <pointLight position={[-4, 2.4, 1.8]} intensity={3.2} color="#ffffff" distance={10} />
        <SceneRoot pointerRef={pointerRef} scrollRef={scrollRef} />
      </Canvas>
    </div>
  );
}

function SceneRoot({
  pointerRef,
  scrollRef,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  scrollRef: React.MutableRefObject<ScrollState>;
}) {
  const { camera } = useThree();
  const cameraCurve = useMemo(
    () => new THREE.CatmullRomCurve3(CAMERA_PATH_POINTS, false, "catmullrom", 0.68),
    [],
  );
  const lookCurve = useMemo(
    () => new THREE.CatmullRomCurve3(LOOK_PATH_POINTS, false, "catmullrom", 0.68),
    [],
  );
  const lookTarget = useRef(new THREE.Vector3());
  const cameraTarget = useRef(new THREE.Vector3());
  const tangent = useRef(new THREE.Vector3());
  const sideVector = useRef(new THREE.Vector3());
  const liftVector = useRef(new THREE.Vector3());
  const worldUp = useRef(new THREE.Vector3(0, 1, 0));
  const forward = useRef(new THREE.Vector3());
  const rollQuaternion = useRef(new THREE.Quaternion());
  const lookQuaternion = useRef(new THREE.Quaternion());

  useFrame((_, delta) => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;

    scrollRef.current.current = THREE.MathUtils.lerp(
      scrollRef.current.current,
      scrollRef.current.target,
      1 - Math.exp(-delta * 1.75),
    );

    const progress = scrollRef.current.current;
    const baseCameraPoint = cameraCurve.getPointAt(progress);
    const baseLookPoint = lookCurve.getPointAt(progress);
    tangent.current.copy(cameraCurve.getTangentAt(progress)).normalize();
    sideVector.current.crossVectors(tangent.current, worldUp.current).normalize();
    liftVector.current.crossVectors(sideVector.current, tangent.current).normalize();

    const motionBias = scrollRef.current.target - scrollRef.current.current;
    const sideDrift =
      Math.sin(progress * Math.PI * 3.2) * 0.18 +
      THREE.MathUtils.clamp(motionBias * 3.4, -0.08, 0.08);
    const liftDrift =
      Math.sin(progress * Math.PI * 4.4 + 0.6) * 0.09 +
      THREE.MathUtils.clamp(Math.abs(motionBias) * 0.32, 0, 0.08);

    cameraTarget.current
      .copy(baseCameraPoint)
      .addScaledVector(sideVector.current, sideDrift)
      .addScaledVector(liftVector.current, liftDrift);

    perspectiveCamera.position.lerp(cameraTarget.current, 1 - Math.exp(-delta * 2.6));
    lookTarget.current.lerp(baseLookPoint, 1 - Math.exp(-delta * 3.1));
    perspectiveCamera.lookAt(lookTarget.current);

    const targetFov = sampleScalarStops(CAMERA_FOV_STOPS, progress);
    perspectiveCamera.fov = THREE.MathUtils.lerp(
      perspectiveCamera.fov,
      targetFov,
      1 - Math.exp(-delta * 2.2),
    );
    perspectiveCamera.updateProjectionMatrix();

    forward.current.subVectors(lookTarget.current, perspectiveCamera.position).normalize();
    rollQuaternion.current.setFromAxisAngle(
      forward.current,
      tangent.current.x * 0.035 + Math.sin(progress * Math.PI * 3.4) * 0.012,
    );
    lookQuaternion.current.copy(perspectiveCamera.quaternion);
    perspectiveCamera.quaternion.slerp(
      lookQuaternion.current.multiply(rollQuaternion.current),
      0.05,
    );
  });

  return (
    <>
      <DepthBackdrop />
      <PointAOrbitCluster pointerRef={pointerRef} lookCurve={lookCurve} scrollRef={scrollRef} />
      <PointBSphereCluster pointerRef={pointerRef} lookCurve={lookCurve} scrollRef={scrollRef} />
      <PointCStillLifeCluster pointerRef={pointerRef} lookCurve={lookCurve} scrollRef={scrollRef} />
    </>
  );
}

function DepthBackdrop() {
  const roomRefs = useRef<Array<THREE.Mesh | null>>([]);
  const coreRefs = useRef<Array<THREE.Mesh | null>>([]);
  const edgeRefs = useRef<Array<THREE.LineSegments | null>>([]);
  const sweepRefs = useRef<Array<THREE.Mesh | null>>([]);
  const moteRefs = useRef<Array<THREE.Mesh | null>>([]);
  const roomSpec = useMemo(
    () => ({
      center: new THREE.Vector3(0, -5.5, -0.8),
      size: [42, 54, 30] as [number, number, number],
      color: "#c4dce4",
      coreColor: "#eef9fd",
      edgeColor: "#f4fdff",
      sweepColor: "#c9f4ff",
    }),
    [],
  );
  const moteOffsets = useMemo(
    () =>
      Array.from({ length: 40 }, (_, index) => ({
        x: ((index % 8) - 3.5) * 4.6 + (index % 2 === 0 ? 0.8 : -0.8),
        y: -22 + Math.floor(index / 4) * 4.4 + ((index % 3) - 1) * 1.3,
        z: -11 - (index % 5) * 2.7,
        phase: index * 0.47,
        scale: 0.18 + (index % 5) * 0.05,
      })),
    [],
  );

  useFrame((state) => {
    roomRefs.current.forEach((mesh) => {
      if (!mesh) {
        return;
      }

      mesh.position.copy(roomSpec.center);
      mesh.rotation.y = Math.sin(state.clock.elapsedTime * 0.04) * 0.05;
      mesh.rotation.x = Math.cos(state.clock.elapsedTime * 0.03) * 0.025;
    });

    coreRefs.current.forEach((mesh) => {
      if (!mesh) {
        return;
      }

      mesh.position.copy(roomSpec.center);
      mesh.rotation.y = -Math.sin(state.clock.elapsedTime * 0.035) * 0.04;
      mesh.rotation.x = Math.cos(state.clock.elapsedTime * 0.028) * 0.02;
    });

    edgeRefs.current.forEach((edges) => {
      if (!edges) {
        return;
      }

      edges.position.copy(roomSpec.center);
      edges.rotation.y = Math.sin(state.clock.elapsedTime * 0.04) * 0.05;
      edges.rotation.x = Math.cos(state.clock.elapsedTime * 0.03) * 0.025;
    });

    sweepRefs.current.forEach((mesh, index) => {
      if (!mesh) {
        return;
      }

      const room = roomSpec;
      const isVerticalSweep = index % 2 === 0;
      const phase = state.clock.elapsedTime * (0.16 + index * 0.01) + index;

      mesh.position.copy(room.center);
      mesh.position.z += room.size[2] * 0.5 - 0.8;

      if (isVerticalSweep) {
        mesh.position.x += Math.sin(phase) * (room.size[0] * 0.3);
        mesh.position.y += Math.cos(phase * 0.6) * (room.size[1] * 0.08);
      } else {
        mesh.position.y += Math.sin(phase * 0.9) * (room.size[1] * 0.28);
        mesh.position.x += Math.cos(phase * 0.5) * (room.size[0] * 0.08);
      }

      mesh.rotation.z = isVerticalSweep ? 0.08 : Math.PI / 2;
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(phase * 1.1) * 0.03;
    });

    moteRefs.current.forEach((mesh, index) => {
      if (!mesh) {
        return;
      }

      const mote = moteOffsets[index];
      mesh.position.x = mote.x + Math.sin(state.clock.elapsedTime * 0.12 + mote.phase) * 0.7;
      mesh.position.y = mote.y + Math.cos(state.clock.elapsedTime * 0.1 + mote.phase) * 0.5;
      mesh.position.z = mote.z + Math.sin(state.clock.elapsedTime * 0.08 + mote.phase) * 0.4;
      mesh.scale.setScalar(mote.scale + Math.sin(state.clock.elapsedTime * 0.14 + mote.phase) * 0.02);
    });
  });

  return (
    <>
      <mesh
        ref={(node) => {
          roomRefs.current[0] = node;
        }}
        position={roomSpec.center}
      >
        <boxGeometry args={roomSpec.size} />
        <meshBasicMaterial
          color={roomSpec.color}
          side={THREE.BackSide}
          transparent
          opacity={0.32}
        />
      </mesh>

      <mesh
        ref={(node) => {
          coreRefs.current[0] = node;
        }}
        position={roomSpec.center}
      >
        <boxGeometry
          args={[
            roomSpec.size[0] * 0.88,
            roomSpec.size[1] * 0.88,
            roomSpec.size[2] * 0.88,
          ]}
        />
        <meshBasicMaterial
          color={roomSpec.coreColor}
          side={THREE.BackSide}
          wireframe
          transparent
          opacity={0.16}
        />
      </mesh>

      <lineSegments
        ref={(node) => {
          edgeRefs.current[0] = node;
        }}
        position={roomSpec.center}
      >
        <edgesGeometry args={[new THREE.BoxGeometry(roomSpec.size[0], roomSpec.size[1], roomSpec.size[2])]} />
        <lineBasicMaterial
          color={roomSpec.edgeColor}
          transparent
          opacity={0.52}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <mesh
        ref={(node) => {
          sweepRefs.current[0] = node;
        }}
        position={roomSpec.center}
      >
        <planeGeometry args={[roomSpec.size[0] * 0.16, roomSpec.size[1] * 0.9]} />
        <meshBasicMaterial
          color={roomSpec.sweepColor}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh
        ref={(node) => {
          sweepRefs.current[1] = node;
        }}
        position={roomSpec.center}
      >
        <planeGeometry args={[roomSpec.size[0] * 0.78, roomSpec.size[1] * 0.12]} />
        <meshBasicMaterial
          color={roomSpec.sweepColor}
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {moteOffsets.map((mote, index) => (
        <mesh
          key={`depth-mote-${index}`}
          ref={(node) => {
            moteRefs.current[index] = node;
          }}
          position={[mote.x, mote.y, mote.z]}
        >
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={index % 3 === 0 ? "#ffffff" : index % 3 === 1 ? "#caf1ff" : "#e6dcff"}
            transparent
            opacity={0.22}
          />
        </mesh>
      ))}
    </>
  );
}

function PointAOrbitCluster({
  pointerRef,
  lookCurve,
  scrollRef,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  lookCurve: THREE.CatmullRomCurve3;
  scrollRef: React.MutableRefObject<ScrollState>;
}) {
  const cubeRefs = useRef<Array<THREE.Mesh | null>>([]);
  const avoidanceMemoryRef = useRef<number[]>([]);
  const pointerWorld = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
  const focusPoint = useRef(new THREE.Vector3());
  const clusterCenter = useRef(new THREE.Vector3(...STORY_CLUSTERS[0].center));
  const { viewport } = useThree();
  const cubes = useMemo(() => createOrbitCubes(), []);

  useFrame((state, delta) => {
    focusPoint.current.copy(lookCurve.getPointAt(scrollRef.current.current));
    const pointer = pointerRef.current;
    pointerWorld.current.set(
      pointer.active ? focusPoint.current.x + pointer.x * viewport.width * 0.24 : 999,
      pointer.active ? focusPoint.current.y + pointer.y * viewport.height * 0.18 : 999,
      focusPoint.current.z,
    );

    const visibilityWeight = THREE.MathUtils.clamp(
      1 - clusterCenter.current.distanceTo(focusPoint.current) / STORY_CLUSTERS[0].focusRadius,
      0,
      1,
    );

    cubes.forEach((cube, index) => {
      const mesh = cubeRefs.current[index];

      if (!mesh) {
        return;
      }

      const elapsed = state.clock.elapsedTime;
      const orbitAngle = elapsed * cube.speed + cube.phase;
      const baseX =
        clusterCenter.current.x +
        Math.cos(orbitAngle) * cube.radius +
        Math.sin(elapsed * 0.22 + cube.phase) * cube.wobble;
      const baseY =
        clusterCenter.current.y +
        Math.sin(orbitAngle * 0.94) * cube.verticalRadius +
        Math.cos(elapsed * 0.31 + cube.phase) * cube.wobble;
      const baseZ =
        clusterCenter.current.z +
        Math.sin(orbitAngle * 1.16) * cube.depthRadius +
        Math.cos(elapsed * 0.26 + cube.phase) * 0.08;

      const dx = baseX - pointerWorld.current.x;
      const dy = baseY - pointerWorld.current.y;
      const distance = Math.hypot(dx, dy);
      const influence = pointer.active
        ? THREE.MathUtils.clamp((1.3 - distance) / 1.3, 0, 1) * visibilityWeight
        : 0;
      const retained = Math.max(
        influence,
        THREE.MathUtils.lerp(
          avoidanceMemoryRef.current[index] ?? 0,
          0,
          1 - Math.exp(-delta * 1.8),
        ),
      );
      avoidanceMemoryRef.current[index] = retained;

      const avoidance = Math.max(influence, retained * 0.74);
      const escapeDistance = cube.repulsion * (0.48 + avoidance * 1.4);
      const pushX = distance > 0 ? (dx / distance) * escapeDistance : 0;
      const pushY = distance > 0 ? (dy / distance) * escapeDistance : 0;

      targetPosition.current.set(baseX + pushX, baseY + pushY, baseZ + avoidance * 0.32);
      mesh.position.lerp(targetPosition.current, 1 - Math.exp(-delta * 6.8));
      mesh.rotation.x = THREE.MathUtils.lerp(
        mesh.rotation.x,
        orbitAngle * 0.32 + avoidance * 0.14,
        1 - Math.exp(-delta * 3.6),
      );
      mesh.rotation.y = THREE.MathUtils.lerp(
        mesh.rotation.y,
        orbitAngle * 0.22 + Math.sin(elapsed * 0.4 + cube.phase) * 0.16,
        1 - Math.exp(-delta * 3.2),
      );
      mesh.rotation.z = THREE.MathUtils.lerp(
        mesh.rotation.z,
        orbitAngle * 0.2 + avoidance * 0.12,
        1 - Math.exp(-delta * 3.3),
      );
      mesh.scale.x = THREE.MathUtils.lerp(mesh.scale.x, cube.scale[0] * (1 + avoidance * 0.05), 1 - Math.exp(-delta * 5));
      mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, cube.scale[1] * (1 + avoidance * 0.05), 1 - Math.exp(-delta * 5));
      mesh.scale.z = THREE.MathUtils.lerp(mesh.scale.z, cube.scale[2] * (1 + avoidance * 0.05), 1 - Math.exp(-delta * 5));
    });
  });

  return (
    <>
      {cubes.map((cube, index) => (
        <mesh
          key={`orbit-${cube.phase}-${index}`}
          ref={(node) => {
            cubeRefs.current[index] = node;
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshPhysicalMaterial
            color="#ecfbff"
            roughness={0.03}
            metalness={0}
            transmission={0.98}
            thickness={1.25}
            ior={1.22}
            transparent
            opacity={0.8}
            clearcoat={1}
            clearcoatRoughness={0.05}
            reflectivity={0.8}
            attenuationColor="#d8f6ff"
            attenuationDistance={1.8}
          />
        </mesh>
      ))}
    </>
  );
}

function PointBSphereCluster({
  pointerRef,
  lookCurve,
  scrollRef,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  lookCurve: THREE.CatmullRomCurve3;
  scrollRef: React.MutableRefObject<ScrollState>;
}) {
  const tileRefs = useRef<Array<THREE.Mesh | null>>([]);
  const avoidanceMemoryRef = useRef<number[]>([]);
  const pointerWorld = useRef(new THREE.Vector3());
  const focusPoint = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
  const normal = useRef(new THREE.Vector3());
  const orientation = useRef(new THREE.Quaternion());
  const zAxis = useRef(new THREE.Vector3(0, 0, 1));
  const clusterCenter = useRef(new THREE.Vector3(...STORY_CLUSTERS[1].center));
  const { viewport } = useThree();
  const tiles = useMemo(() => createSphereTiles(), []);

  useFrame((state, delta) => {
    focusPoint.current.copy(lookCurve.getPointAt(scrollRef.current.current));
    const pointer = pointerRef.current;
    pointerWorld.current.set(
      pointer.active ? focusPoint.current.x + pointer.x * viewport.width * 0.26 : 999,
      pointer.active ? focusPoint.current.y + pointer.y * viewport.height * 0.2 : 999,
      focusPoint.current.z,
    );

    const visibilityWeight = THREE.MathUtils.clamp(
      1 - clusterCenter.current.distanceTo(focusPoint.current) / STORY_CLUSTERS[1].focusRadius,
      0,
      1,
    );

    tiles.forEach((tile, index) => {
      const mesh = tileRefs.current[index];

      if (!mesh) {
        return;
      }

      const elapsed = state.clock.elapsedTime;
      normal.current.set(
        Math.sin(tile.phi) * Math.cos(tile.theta + elapsed * 0.04),
        Math.cos(tile.phi),
        Math.sin(tile.phi) * Math.sin(tile.theta + elapsed * 0.04),
      );

      const driftRadius = tile.radius + Math.sin(elapsed * tile.drift + tile.theta) * 0.08;
      const baseX = clusterCenter.current.x + normal.current.x * driftRadius;
      const baseY = clusterCenter.current.y + normal.current.y * driftRadius;
      const baseZ = clusterCenter.current.z + normal.current.z * driftRadius;

      const dx = baseX - pointerWorld.current.x;
      const dy = baseY - pointerWorld.current.y;
      const distance = Math.hypot(dx, dy);
      const influence = pointer.active
        ? THREE.MathUtils.clamp((1.36 - distance) / 1.36, 0, 1) * visibilityWeight
        : 0;
      const retained = Math.max(
        influence,
        THREE.MathUtils.lerp(
          avoidanceMemoryRef.current[index] ?? 0,
          0,
          1 - Math.exp(-delta * 1.85),
        ),
      );
      avoidanceMemoryRef.current[index] = retained;

      const avoidance = Math.max(influence, retained * 0.76);
      const escapeDistance = tile.repulsion * (0.42 + avoidance * 1.38);
      const pushX = distance > 0 ? (dx / distance) * escapeDistance : 0;
      const pushY = distance > 0 ? (dy / distance) * escapeDistance : 0;

      targetPosition.current.set(baseX + pushX, baseY + pushY, baseZ + avoidance * 0.22);
      mesh.position.lerp(targetPosition.current, 1 - Math.exp(-delta * 6.4));

      orientation.current.setFromUnitVectors(zAxis.current, normal.current.clone().normalize());
      mesh.quaternion.slerp(orientation.current, 1 - Math.exp(-delta * 4.2));
      mesh.rotation.z += delta * 0.03;
      mesh.scale.x = THREE.MathUtils.lerp(mesh.scale.x, tile.scale[0] * (1 + avoidance * 0.05), 1 - Math.exp(-delta * 4.8));
      mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, tile.scale[1] * (1 + avoidance * 0.05), 1 - Math.exp(-delta * 4.8));
      mesh.scale.z = THREE.MathUtils.lerp(mesh.scale.z, tile.scale[2] * (1 + avoidance * 0.05), 1 - Math.exp(-delta * 4.8));
    });
  });

  return (
    <>
      {tiles.map((tile, index) => (
        <mesh
          key={`sphere-tile-${tile.theta}-${index}`}
          ref={(node) => {
            tileRefs.current[index] = node;
          }}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshPhysicalMaterial
            color="#effcff"
            roughness={0.04}
            metalness={0}
            transmission={0.98}
            thickness={1.18}
            ior={1.23}
            transparent
            opacity={0.78}
            clearcoat={1}
            clearcoatRoughness={0.05}
            reflectivity={0.82}
            attenuationColor="#dff8ff"
            attenuationDistance={2}
          />
        </mesh>
      ))}
    </>
  );
}

function PointCStillLifeCluster({
  pointerRef,
  lookCurve,
  scrollRef,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  lookCurve: THREE.CatmullRomCurve3;
  scrollRef: React.MutableRefObject<ScrollState>;
}) {
  const objectRefs = useRef<Array<THREE.Mesh | null>>([]);
  const avoidanceMemoryRef = useRef<number[]>([]);
  const pointerWorld = useRef(new THREE.Vector3());
  const focusPoint = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
  const clusterCenter = useRef(new THREE.Vector3(...STORY_CLUSTERS[2].center));
  const { viewport } = useThree();
  const objects = useMemo(() => createStillLifeObjects(), []);

  useFrame((state, delta) => {
    focusPoint.current.copy(lookCurve.getPointAt(scrollRef.current.current));
    const pointer = pointerRef.current;
    pointerWorld.current.set(
      pointer.active ? focusPoint.current.x + pointer.x * viewport.width * 0.24 : 999,
      pointer.active ? focusPoint.current.y + pointer.y * viewport.height * 0.18 : 999,
      focusPoint.current.z,
    );

    const visibilityWeight = THREE.MathUtils.clamp(
      1 - clusterCenter.current.distanceTo(focusPoint.current) / STORY_CLUSTERS[2].focusRadius,
      0,
      1,
    );

    objects.forEach((object, index) => {
      const mesh = objectRefs.current[index];

      if (!mesh) {
        return;
      }

      const elapsed = state.clock.elapsedTime;
      const baseX =
        clusterCenter.current.x +
        object.offset[0] +
        Math.sin(elapsed * object.drift + object.phase) * 0.12;
      const baseY =
        clusterCenter.current.y +
        object.offset[1] +
        Math.cos(elapsed * object.drift * 1.2 + object.phase) * 0.1;
      const baseZ =
        clusterCenter.current.z +
        object.offset[2] +
        Math.sin(elapsed * object.drift * 1.4 + object.phase) * 0.08;

      const dx = baseX - pointerWorld.current.x;
      const dy = baseY - pointerWorld.current.y;
      const distance = Math.hypot(dx, dy);
      const influence = pointer.active
        ? THREE.MathUtils.clamp((1.34 - distance) / 1.34, 0, 1) * visibilityWeight
        : 0;
      const retained = Math.max(
        influence,
        THREE.MathUtils.lerp(
          avoidanceMemoryRef.current[index] ?? 0,
          0,
          1 - Math.exp(-delta * 1.9),
        ),
      );
      avoidanceMemoryRef.current[index] = retained;

      const avoidance = Math.max(influence, retained * 0.78);
      const escapeDistance = object.repulsion * (0.36 + avoidance * 1.2);
      const pushX = distance > 0 ? (dx / distance) * escapeDistance : 0;
      const pushY = distance > 0 ? (dy / distance) * escapeDistance : 0;

      targetPosition.current.set(baseX + pushX, baseY + pushY, baseZ + avoidance * 0.18);
      mesh.position.lerp(targetPosition.current, 1 - Math.exp(-delta * 5.8));
      mesh.rotation.x = THREE.MathUtils.lerp(
        mesh.rotation.x,
        Math.sin(elapsed * 0.18 + object.phase) * 0.2 + avoidance * 0.08,
        1 - Math.exp(-delta * 2.8),
      );
      mesh.rotation.y = THREE.MathUtils.lerp(
        mesh.rotation.y,
        Math.cos(elapsed * 0.15 + object.phase) * 0.2 + avoidance * 0.08,
        1 - Math.exp(-delta * 2.8),
      );
      mesh.rotation.z = THREE.MathUtils.lerp(
        mesh.rotation.z,
        Math.sin(elapsed * 0.13 + object.phase) * 0.14,
        1 - Math.exp(-delta * 2.6),
      );
      mesh.scale.x = THREE.MathUtils.lerp(mesh.scale.x, object.scale[0] * (1 + avoidance * 0.04), 1 - Math.exp(-delta * 4.2));
      mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, object.scale[1] * (1 + avoidance * 0.04), 1 - Math.exp(-delta * 4.2));
      mesh.scale.z = THREE.MathUtils.lerp(mesh.scale.z, object.scale[2] * (1 + avoidance * 0.04), 1 - Math.exp(-delta * 4.2));
    });
  });

  return (
    <>
      {objects.map((object, index) => (
        <mesh
          key={`still-life-${object.kind}-${index}`}
          ref={(node) => {
            objectRefs.current[index] = node;
          }}
        >
          {object.kind === "sphere" ? <sphereGeometry args={[0.5, 32, 32]} /> : <boxGeometry args={[1, 1, 1]} />}
          <meshPhysicalMaterial
            color={object.kind === "sphere" ? "#f4fdff" : "#ecfbff"}
            roughness={0.04}
            metalness={0}
            transmission={0.97}
            thickness={1.16}
            ior={1.2}
            transparent
            opacity={0.8}
            clearcoat={1}
            clearcoatRoughness={0.05}
            reflectivity={0.8}
            attenuationColor="#dbf7ff"
            attenuationDistance={2}
          />
        </mesh>
      ))}
    </>
  );
}

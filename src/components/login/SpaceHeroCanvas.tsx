import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
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

type PlanetSpec = {
  center: [number, number, number];
  radius: number;
  color: string;
  glowColor: string;
  atmosphereColor: string;
  focusRadius: number;
  ringColor?: string;
  ringTilt?: [number, number, number];
};

type AsteroidSpec = {
  clusterIndex: number;
  orbitRadius: number;
  verticalRadius: number;
  depthRadius: number;
  speed: number;
  phase: number;
  wobble: number;
  repulsion: number;
  scale: [number, number, number];
  spin: [number, number, number];
};

const BLACK_HOLE_POSITION = new THREE.Vector3(5, -1, -42);
const LOGIN_LAUNCH_DURATION_SECONDS = 4.8;

const PLANETS: PlanetSpec[] = [
  {
    center: [-12, 8.8, -4.4],
    radius: 3.2,
    color: "#6cc7ff",
    glowColor: "#7edfff",
    atmosphereColor: "#9fe9ff",
    focusRadius: 13,
    ringColor: "#9fdcff",
    ringTilt: [1.12, 0.28, -0.2],
  },
  {
    center: [23.8, 8.4, -3.4],
    radius: 3.6,
    color: "#8fa7ff",
    glowColor: "#b2c0ff",
    atmosphereColor: "#d6e1ff",
    focusRadius: 13,
  },
  {
    center: [0, -18.8, 1.8],
    radius: 2.94,
    color: "#7ee0bc",
    glowColor: "#9dffd8",
    atmosphereColor: "#d2ffe9",
    focusRadius: 14.5,
    ringColor: "#b6ffe7",
    ringTilt: [1.34, -0.14, 0.42],
  },
];

const CAMERA_PATH_POINTS = [
  new THREE.Vector3(-20.2, 11.6, 18.4),
  new THREE.Vector3(-16.2, 10.4, 12.6),
  new THREE.Vector3(-2.6, 9.7, 18.8),
  new THREE.Vector3(10.4, 9.4, 19.6),
  new THREE.Vector3(19.6, 9.1, 17.2),
  new THREE.Vector3(26.8, 8.9, 10.8),
  new THREE.Vector3(17.4, 0.8, 21.2),
  new THREE.Vector3(6.2, -9.8, 17.2),
  new THREE.Vector3(0.2, -18.2, 10.6),
  new THREE.Vector3(0, -24.2, 9.4),
];

const LOOK_PATH_POINTS = [
  new THREE.Vector3(-14.8, 9.7, 0.8),
  new THREE.Vector3(-11.2, 9.2, -1.6),
  new THREE.Vector3(0.8, 8.9, -2.6),
  new THREE.Vector3(12.4, 8.8, -3.2),
  new THREE.Vector3(23.8, 8.4, -3.4),
  new THREE.Vector3(15.2, 2.8, -1.3),
  new THREE.Vector3(4.8, -6.4, 0.3),
  new THREE.Vector3(0.8, -14.2, 1),
  new THREE.Vector3(0, -18.8, 1.8),
];

const CAMERA_FOV_STOPS = [
  { t: 0, value: 27.8 },
  { t: 0.18, value: 36.2 },
  { t: 0.42, value: 29.4 },
  { t: 0.74, value: 37.4 },
  { t: 1, value: 31.2 },
];

function wrapProgress(value: number) {
  return THREE.MathUtils.euclideanModulo(value, 1);
}

const BLACK_HOLE_VERTEX_SHADER = `
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const BLACK_HOLE_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.8);
  float wave = sin((vWorldPosition.y + vWorldPosition.x) * 1.8 + uTime * 1.4) * 0.5 + 0.5;
  float ripple = sin(length(vWorldPosition.xy) * 3.2 - uTime * 1.6) * 0.5 + 0.5;
  float glow = fresnel * (0.65 + wave * 0.35) + ripple * 0.08;
  vec3 color = mix(uColorA, uColorB, clamp(glow, 0.0, 1.0));
  float alpha = clamp(glow * 0.22, 0.0, 0.26);

  gl_FragColor = vec4(color, alpha);
}
`;

const BLACK_HOLE_DISK_VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BLACK_HOLE_DISK_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec3 uHotColor;
uniform vec3 uCoolColor;

varying vec2 vUv;

void main() {
  vec2 centered = vUv - 0.5;
  float radius = length(centered) * 2.0;
  float angle = atan(centered.y, centered.x);

  float inner = smoothstep(0.42, 0.54, radius);
  float outer = 1.0 - smoothstep(0.92, 1.05, radius);
  float band = inner * outer;

  float swirl = sin(angle * 9.0 - uTime * 1.9 + radius * 14.0) * 0.5 + 0.5;
  float turbulence = sin(angle * 17.0 + uTime * 2.3 - radius * 23.0) * 0.5 + 0.5;
  float streaks = pow(swirl * 0.7 + turbulence * 0.3, 1.8);

  float heat = smoothstep(0.48, 0.68, radius) * (1.0 - smoothstep(0.68, 0.94, radius));
  vec3 color = mix(uCoolColor, uHotColor, clamp(heat + streaks * 0.35, 0.0, 1.0));

  float alpha = band * (0.12 + streaks * 0.42);
  alpha *= 1.0 - smoothstep(0.94, 1.05, radius);

  gl_FragColor = vec4(color, alpha);
}
`;

function sampleScalarStops(
  stops: Array<{ t: number; value: number }>,
  progress: number,
) {
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

function createAsteroids() {
  const asteroids: AsteroidSpec[] = [];

  PLANETS.forEach((planet, clusterIndex) => {
    const count = clusterIndex === 2 ? 42 : 34;

    for (let index = 0; index < count; index += 1) {
      const seed = clusterIndex * 100 + index * 11.4;
      asteroids.push({
        clusterIndex,
        orbitRadius: planet.radius + 1.9 + Math.sin(seed * 0.22) * 1.2,
        verticalRadius: 1.4 + Math.cos(seed * 0.18) * 0.8,
        depthRadius: 1.6 + Math.sin(seed * 0.27) * 1.1,
        speed: 0.06 + Math.cos(seed * 0.11) * 0.015,
        phase: (index / count) * Math.PI * 2 + clusterIndex * 0.8,
        wobble: 0.16 + (Math.sin(seed * 0.31) + 1) * 0.08,
        repulsion: 0.62 + (Math.cos(seed * 0.28) + 1) * 0.18,
        scale: [
          0.18 + (Math.sin(seed * 0.16) + 1) * 0.12,
          0.12 + (Math.cos(seed * 0.24) + 1) * 0.1,
          0.14 + (Math.sin(seed * 0.21 + 0.4) + 1) * 0.11,
        ],
        spin: [
          0.4 + Math.sin(seed * 0.17) * 0.3,
          0.5 + Math.cos(seed * 0.14) * 0.35,
          0.3 + Math.sin(seed * 0.19) * 0.25,
        ],
      });
    }
  });

  return asteroids;
}

function createStarPositions() {
  const positions = new Float32Array(720 * 3);

  for (let index = 0; index < 720; index += 1) {
    const stride = index * 3;
    positions[stride] = (Math.random() - 0.5) * 94;
    positions[stride + 1] = (Math.random() - 0.45) * 82 - 6;
    positions[stride + 2] = -10 - Math.random() * 68;
  }

  return positions;
}

export function SpaceHeroCanvas({
  children,
  resetSignal = 0,
  launchSignal = false,
}: {
  children?: ReactNode;
  resetSignal?: number;
  launchSignal?: boolean;
}) {
  const pointerRef = useRef<PointerState>({ active: false, x: 0, y: 0 });
  const scrollRef = useRef<ScrollState>({ current: 0, target: 0 });

  useEffect(() => {
    scrollRef.current.target = 0;
  }, [resetSignal]);

  function handlePointerMove(event: React.MouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    const normalizedY = -(
      ((event.clientY - bounds.top) / bounds.height) * 2 -
      1
    );

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
    if (launchSignal) {
      return;
    }

    event.preventDefault();
    scrollRef.current.target += event.deltaY * 0.00028;
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
        camera={{
          position: [-17.6, 10.2, 15.8],
          fov: 26.2,
          near: 0.1,
          far: 120,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#020816"]} />
        <fog attach="fog" args={["#020816", 22, 88]} />
        <ambientLight intensity={0.18} color="#7fa7e2" />
        <directionalLight
          position={[10, 12, 10]}
          intensity={0.8}
          color="#ffffff"
        />
        <pointLight
          position={[5, -1, -24]}
          intensity={14}
          color="#8db6ff"
          distance={52}
        />
        <pointLight
          position={[5, -1, -20]}
          intensity={8}
          color="#c8dcff"
          distance={34}
        />
        <pointLight
          position={[-12, 9, 3]}
          intensity={16}
          color="#5ad6ff"
          distance={24}
        />
        <pointLight
          position={[23.8, 8.4, 5]}
          intensity={15}
          color="#8ea0ff"
          distance={24}
        />
        <pointLight
          position={[0, -18, 6]}
          intensity={18}
          color="#76ffd2"
          distance={28}
        />
        <SceneRoot
          pointerRef={pointerRef}
          scrollRef={scrollRef}
          launchSignal={launchSignal}
        >
          {children}
        </SceneRoot>
      </Canvas>
    </div>
  );
}

function SceneRoot({
  pointerRef,
  scrollRef,
  children,
  launchSignal,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  scrollRef: React.MutableRefObject<ScrollState>;
  children?: ReactNode;
  launchSignal: boolean;
}) {
  const { camera } = useThree();
  const cameraCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(CAMERA_PATH_POINTS, true, "catmullrom", 0.68),
    [],
  );
  const lookCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(LOOK_PATH_POINTS, true, "catmullrom", 0.68),
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
  const launchStateRef = useRef<{
    active: boolean;
    startAt: number;
    initialized: boolean;
    startCamera: THREE.Vector3;
    startLook: THREE.Vector3;
  }>({
    active: false,
    startAt: 0,
    initialized: false,
    startCamera: new THREE.Vector3(),
    startLook: new THREE.Vector3(),
  });

  useEffect(() => {
    if (launchSignal) {
      launchStateRef.current.active = true;
      launchStateRef.current.initialized = false;
    } else {
      launchStateRef.current.active = false;
      launchStateRef.current.initialized = false;
    }
  }, [launchSignal]);

  useFrame((_, delta) => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;

    if (launchStateRef.current.active) {
      if (!launchStateRef.current.initialized) {
        launchStateRef.current.startAt = performance.now();
        launchStateRef.current.initialized = true;
        launchStateRef.current.startCamera.copy(perspectiveCamera.position);
        launchStateRef.current.startLook.copy(lookTarget.current);
      }

      const elapsed =
        (performance.now() - launchStateRef.current.startAt) / 1000;
      const rawProgress = Math.min(elapsed / LOGIN_LAUNCH_DURATION_SECONDS, 1);
      const zoomOutPhase = THREE.MathUtils.smootherstep(
        Math.min(rawProgress / 0.52, 1),
        0,
        1,
      );
      const divePhase =
        rawProgress > 0.3
          ? THREE.MathUtils.smootherstep((rawProgress - 0.3) / 0.7, 0, 1)
          : 0;
      const zoomOutCamera = new THREE.Vector3(3.6, 14.4, 34.8);
      const zoomOutLook = new THREE.Vector3(1.6, 6.2, -8.4);
      const diveGuideCamera = new THREE.Vector3(8.4, 4.2, 18.2);
      const diveGuideLook = new THREE.Vector3(5.4, 0.8, -24);
      const blackHoleApproach = BLACK_HOLE_POSITION.clone().add(
        new THREE.Vector3(0.35, 0.08, 5.4),
      );

      const cameraAfterZoom = launchStateRef.current.startCamera
        .clone()
        .lerp(zoomOutCamera, zoomOutPhase);
      const lookAfterZoom = launchStateRef.current.startLook
        .clone()
        .lerp(zoomOutLook, zoomOutPhase);
      const cameraTowardDive = cameraAfterZoom
        .clone()
        .lerp(
          diveGuideCamera,
          THREE.MathUtils.smootherstep(divePhase, 0, 0.58),
        );
      const lookTowardDive = lookAfterZoom
        .clone()
        .lerp(diveGuideLook, THREE.MathUtils.smootherstep(divePhase, 0, 0.52));

      perspectiveCamera.position.copy(
        cameraTowardDive.lerp(
          blackHoleApproach,
          THREE.MathUtils.smootherstep(divePhase, 0.32, 1),
        ),
      );
      lookTarget.current.copy(
        lookTowardDive.lerp(
          BLACK_HOLE_POSITION,
          THREE.MathUtils.smootherstep(divePhase, 0.24, 1),
        ),
      );
      perspectiveCamera.lookAt(lookTarget.current);

      const pullbackFov = THREE.MathUtils.lerp(28.5, 39.5, zoomOutPhase);
      perspectiveCamera.fov = THREE.MathUtils.lerp(
        pullbackFov,
        16.8,
        THREE.MathUtils.smootherstep(divePhase, 0.3, 1),
      );
      perspectiveCamera.updateProjectionMatrix();

      forward.current
        .subVectors(lookTarget.current, perspectiveCamera.position)
        .normalize();
      rollQuaternion.current.setFromAxisAngle(
        forward.current,
        THREE.MathUtils.lerp(0.012, -0.016, divePhase),
      );
      lookQuaternion.current.copy(perspectiveCamera.quaternion);
      perspectiveCamera.quaternion.slerp(
        lookQuaternion.current.multiply(rollQuaternion.current),
        0.05,
      );

      return;
    }

    scrollRef.current.current = THREE.MathUtils.lerp(
      scrollRef.current.current,
      scrollRef.current.target,
      1 - Math.exp(-delta * 1.8),
    );

    const progress = wrapProgress(scrollRef.current.current);
    const baseCameraPoint = cameraCurve.getPointAt(progress);
    const baseLookPoint = lookCurve.getPointAt(progress);
    tangent.current.copy(cameraCurve.getTangentAt(progress)).normalize();
    sideVector.current
      .crossVectors(tangent.current, worldUp.current)
      .normalize();
    liftVector.current
      .crossVectors(sideVector.current, tangent.current)
      .normalize();

    const motionBias = scrollRef.current.target - scrollRef.current.current;
    const sideDrift =
      Math.sin(progress * Math.PI * 3.1) * 0.24 +
      THREE.MathUtils.clamp(motionBias * 3.6, -0.1, 0.1);
    const liftDrift =
      Math.sin(progress * Math.PI * 4.6 + 0.4) * 0.13 +
      THREE.MathUtils.clamp(Math.abs(motionBias) * 0.38, 0, 0.1);

    cameraTarget.current
      .copy(baseCameraPoint)
      .addScaledVector(sideVector.current, sideDrift)
      .addScaledVector(liftVector.current, liftDrift);

    perspectiveCamera.position.lerp(
      cameraTarget.current,
      1 - Math.exp(-delta * 2.8),
    );
    lookTarget.current.lerp(baseLookPoint, 1 - Math.exp(-delta * 3.1));
    perspectiveCamera.lookAt(lookTarget.current);

    const targetFov = sampleScalarStops(CAMERA_FOV_STOPS, progress);
    perspectiveCamera.fov = THREE.MathUtils.lerp(
      perspectiveCamera.fov,
      targetFov,
      1 - Math.exp(-delta * 2.1),
    );
    perspectiveCamera.updateProjectionMatrix();

    forward.current
      .subVectors(lookTarget.current, perspectiveCamera.position)
      .normalize();
    rollQuaternion.current.setFromAxisAngle(
      forward.current,
      tangent.current.x * 0.03 + Math.sin(progress * Math.PI * 3.2) * 0.01,
    );
    lookQuaternion.current.copy(perspectiveCamera.quaternion);
    perspectiveCamera.quaternion.slerp(
      lookQuaternion.current.multiply(rollQuaternion.current),
      0.05,
    );
  });

  return (
    <>
      <SpaceBackdrop />
      <BlackHoleCore />
      {PLANETS.map((planet, index) => (
        <PlanetCluster
          key={`planet-${planet.center[0]}-${planet.center[1]}`}
          planet={planet}
          index={index}
        />
      ))}
      {children ? <LoginAnchor>{children}</LoginAnchor> : null}
      <AsteroidField
        pointerRef={pointerRef}
        lookCurve={lookCurve}
        scrollRef={scrollRef}
      />
    </>
  );
}

function LoginAnchor({ children }: { children: ReactNode }) {
  const anchor = PLANETS[0];

  return (
    <group
      position={[
        anchor.center[0] - 1,
        anchor.center[1] + 0.6,
        anchor.center[2] + 0.1,
      ]}
      rotation={[-0.05, -0.26, 6.27]}
    >
      <Html transform distanceFactor={7.7} occlude={false}>
        <div className="pointer-events-auto w-[16.8rem]">{children}</div>
      </Html>
    </group>
  );
}

function BlackHoleCore() {
  const groupRef = useRef<THREE.Group | null>(null);
  const holePosition = useMemo(() => BLACK_HOLE_POSITION.clone(), []);
  const diskRef = useRef<THREE.Mesh | null>(null);
  const diskBackRef = useRef<THREE.Mesh | null>(null);
  const lensShellRef = useRef<THREE.Mesh | null>(null);
  const lensMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColorA: { value: new THREE.Color("#3554aa") },
          uColorB: { value: new THREE.Color("#9fb8ff") },
        },
        vertexShader: BLACK_HOLE_VERTEX_SHADER,
        fragmentShader: BLACK_HOLE_FRAGMENT_SHADER,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const diskMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uHotColor: { value: new THREE.Color("#ffd39a") },
          uCoolColor: { value: new THREE.Color("#667cff") },
        },
        vertexShader: BLACK_HOLE_DISK_VERTEX_SHADER,
        fragmentShader: BLACK_HOLE_DISK_FRAGMENT_SHADER,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return;
    }

    groupRef.current.position.lerp(holePosition, 1 - Math.exp(-delta * 2.5));
    groupRef.current.rotation.z += delta * 0.02;

    lensMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    diskMaterial.uniforms.uTime.value = state.clock.elapsedTime;

    if (diskRef.current) {
      diskRef.current.rotation.z += delta * 0.14;
    }

    if (diskBackRef.current) {
      diskBackRef.current.rotation.z -= delta * 0.08;
    }

    if (lensShellRef.current) {
      lensShellRef.current.rotation.y += delta * 0.05;
      lensShellRef.current.rotation.z -= delta * 0.04;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh
        ref={diskBackRef}
        rotation={[1.34, 0.12, -0.24]}
        material={diskMaterial}
      >
        <ringGeometry args={[3.4, 7.8, 96]} />
      </mesh>

      <mesh scale={[1.04, 1.04, 1.04]}>
        <sphereGeometry args={[3.18, 48, 48]} />
        <meshBasicMaterial color="#05060e" transparent opacity={0.92} />
      </mesh>

      <mesh>
        <sphereGeometry args={[2.9, 40, 40]} />
        <meshBasicMaterial color="#02030a" />
      </mesh>

      <mesh scale={[0.82, 0.82, 0.82]}>
        <sphereGeometry args={[2.9, 40, 40]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.96} />
      </mesh>

      <mesh
        ref={diskRef}
        rotation={[1.16, -0.18, 0.32]}
        material={diskMaterial}
      >
        <ringGeometry args={[3.0, 7.1, 96]} />
      </mesh>

      <mesh
        ref={lensShellRef}
        scale={[1.28, 1.28, 1.28]}
        material={lensMaterial}
      >
        <sphereGeometry args={[2.9, 56, 56]} />
      </mesh>

      <mesh scale={[2.1, 2.1, 2.1]}>
        <sphereGeometry args={[2.9, 28, 28]} />
        <meshBasicMaterial
          color="#4961b4"
          transparent
          opacity={0.025}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

function SpaceBackdrop() {
  const starPositions = useMemo(() => createStarPositions(), []);
  const starFieldRef = useRef<THREE.Points | null>(null);

  useFrame((state) => {
    if (starFieldRef.current) {
      starFieldRef.current.rotation.y = state.clock.elapsedTime * 0.005;
      starFieldRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.03) * 0.02;
    }
  });

  return (
    <>
      <points ref={starFieldRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={starPositions.length / 3}
            array={starPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#dcecff"
          size={0.16}
          sizeAttenuation
          transparent
          opacity={0.88}
        />
      </points>
    </>
  );
}

function PlanetCluster({
  planet,
  index,
}: {
  planet: PlanetSpec;
  index: number;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);
  const planetVector = useMemo(
    () =>
      new THREE.Vector3(planet.center[0], planet.center[1], planet.center[2]),
    [planet.center],
  );

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.lerp(planetVector, 1 - Math.exp(-delta * 3));
      groupRef.current.rotation.y += delta * (0.12 + index * 0.02);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        Math.sin(state.clock.elapsedTime * 0.08 + index) * 0.06,
        1 - Math.exp(-delta * 2.2),
      );
    }

    if (ringRef.current && planet.ringTilt) {
      ringRef.current.rotation.x = planet.ringTilt[0];
      ringRef.current.rotation.y =
        planet.ringTilt[1] + state.clock.elapsedTime * 0.05;
      ringRef.current.rotation.z = planet.ringTilt[2];
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[planet.radius, 48, 48]} />
        <meshStandardMaterial
          color={planet.color}
          roughness={0.85}
          metalness={0.04}
          emissive={planet.glowColor}
          emissiveIntensity={0.24}
        />
      </mesh>

      <mesh scale={[1.18, 1.18, 1.18]}>
        <sphereGeometry args={[planet.radius, 40, 40]} />
        <meshBasicMaterial
          color={planet.atmosphereColor}
          transparent
          opacity={0.14}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh
        position={[
          planet.radius * 0.28,
          planet.radius * 0.12,
          planet.radius * 0.86,
        ]}
      >
        <sphereGeometry args={[planet.radius * 0.14, 24, 24]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.22} />
      </mesh>

      {planet.ringColor ? (
        <mesh ref={ringRef}>
          <torusGeometry args={[planet.radius + 1.5, 0.12, 20, 120]} />
          <meshBasicMaterial
            color={planet.ringColor}
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function AsteroidField({
  pointerRef,
  lookCurve,
  scrollRef,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  lookCurve: THREE.CatmullRomCurve3;
  scrollRef: React.MutableRefObject<ScrollState>;
}) {
  const asteroidRefs = useRef<Array<THREE.Mesh | null>>([]);
  const avoidanceMemoryRef = useRef<number[]>([]);
  const pointerWorld = useRef(new THREE.Vector3());
  const focusPoint = useRef(new THREE.Vector3());
  const targetPosition = useRef(new THREE.Vector3());
  const asteroidMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#8b97aa",
        roughness: 0.95,
        metalness: 0.02,
      }),
    [],
  );
  const asteroids = useMemo(() => createAsteroids(), []);
  const { viewport } = useThree();

  useFrame((state, delta) => {
    focusPoint.current.copy(
      lookCurve.getPointAt(wrapProgress(scrollRef.current.current)),
    );
    const pointer = pointerRef.current;
    pointerWorld.current.set(
      pointer.active
        ? focusPoint.current.x + pointer.x * viewport.width * 0.24
        : 999,
      pointer.active
        ? focusPoint.current.y + pointer.y * viewport.height * 0.18
        : 999,
      focusPoint.current.z,
    );

    asteroids.forEach((asteroid, index) => {
      const mesh = asteroidRefs.current[index];

      if (!mesh) {
        return;
      }

      const elapsed = state.clock.elapsedTime;
      const planet = PLANETS[asteroid.clusterIndex];
      const clusterCenter = new THREE.Vector3(
        planet.center[0],
        planet.center[1],
        planet.center[2],
      );
      const orbitAngle = elapsed * asteroid.speed + asteroid.phase;

      const baseX =
        planet.center[0] +
        Math.cos(orbitAngle) * asteroid.orbitRadius +
        Math.sin(elapsed * 0.24 + asteroid.phase) * asteroid.wobble;
      const baseY =
        planet.center[1] +
        Math.sin(orbitAngle * 0.92) * asteroid.verticalRadius +
        Math.cos(elapsed * 0.19 + asteroid.phase) * asteroid.wobble;
      const baseZ =
        planet.center[2] +
        Math.sin(orbitAngle * 1.14) * asteroid.depthRadius +
        Math.cos(elapsed * 0.21 + asteroid.phase) * 0.14;

      const dx = baseX - pointerWorld.current.x;
      const dy = baseY - pointerWorld.current.y;
      const distance = Math.hypot(dx, dy);
      const visibilityWeight = THREE.MathUtils.clamp(
        1 - clusterCenter.distanceTo(focusPoint.current) / planet.focusRadius,
        0,
        1,
      );
      const influence = pointer.active
        ? THREE.MathUtils.clamp((1.54 - distance) / 1.54, 0, 1) *
          visibilityWeight
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

      const avoidance = Math.max(influence, retained * 0.78);
      const escapeDistance = asteroid.repulsion * (0.42 + avoidance * 1.46);
      const pushX = distance > 0 ? (dx / distance) * escapeDistance : 0;
      const pushY = distance > 0 ? (dy / distance) * escapeDistance : 0;

      targetPosition.current.set(
        baseX + pushX,
        baseY + pushY,
        baseZ + avoidance * 0.22,
      );
      mesh.position.lerp(targetPosition.current, 1 - Math.exp(-delta * 6.4));
      mesh.rotation.x += delta * asteroid.spin[0] * 0.4;
      mesh.rotation.y += delta * asteroid.spin[1] * 0.42;
      mesh.rotation.z += delta * asteroid.spin[2] * 0.36;

      mesh.scale.x = THREE.MathUtils.lerp(
        mesh.scale.x,
        asteroid.scale[0] * (1 + avoidance * 0.05),
        1 - Math.exp(-delta * 5),
      );
      mesh.scale.y = THREE.MathUtils.lerp(
        mesh.scale.y,
        asteroid.scale[1] * (1 + avoidance * 0.05),
        1 - Math.exp(-delta * 5),
      );
      mesh.scale.z = THREE.MathUtils.lerp(
        mesh.scale.z,
        asteroid.scale[2] * (1 + avoidance * 0.05),
        1 - Math.exp(-delta * 5),
      );
    });
  });

  return (
    <>
      {asteroids.map((asteroid, index) => (
        <mesh
          key={`asteroid-${asteroid.clusterIndex}-${asteroid.phase}-${index}`}
          ref={(node) => {
            asteroidRefs.current[index] = node;
          }}
          material={asteroidMaterial}
        >
          <icosahedronGeometry args={[1, 0]} />
        </mesh>
      ))}
    </>
  );
}

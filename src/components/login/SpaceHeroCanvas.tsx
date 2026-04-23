import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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

type PlanetInteractionState = {
  clicks: number;
  explodingAt: number | null;
  burstId: number;
};

type SceneBlastState = {
  triggeredAt: number | null;
  burstId: number;
};

type BlackHoleInteractionState = {
  clicks: number;
  destroyedAt: number | null;
  burstId: number;
};

type ExplosionFragmentSpec = {
  direction: [number, number, number];
  offset: [number, number, number];
  scale: [number, number, number];
  spin: [number, number, number];
};

const BLACK_HOLE_POSITION = new THREE.Vector3(40, 20, -90);
const LOGIN_LAUNCH_DURATION_SECONDS = 4.8;
const PLANET_CLICK_THRESHOLD = 6;
const BLACK_HOLE_CLICK_THRESHOLD = 20;
const PLANET_EXPLOSION_DURATION_MS = 1700;
const SCENE_BLAST_DURATION_MS = 3600;

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
  new THREE.Vector3(-21.4, 12.4, 17.6),
  new THREE.Vector3(-17.2, 10.7, 11.2),
  new THREE.Vector3(-9.2, 10.3, 20.9),
  new THREE.Vector3(4.8, 10.9, 25.8),
  new THREE.Vector3(17.8, 10.2, 18.1),
  new THREE.Vector3(28.4, 9.1, 11.2),
  new THREE.Vector3(19.4, 0.6, 24.0),
  new THREE.Vector3(8.6, -8.8, 22.6),
  new THREE.Vector3(2.6, -16.2, 15.2),
  new THREE.Vector3(0.8, -22.6, 9.4),
  new THREE.Vector3(-6.4, -12.4, 24.8),
  new THREE.Vector3(-18.8, 2.2, 23.6),
];

const LOOK_PATH_POINTS = [
  new THREE.Vector3(-13.8, 9.4, -1.2),
  new THREE.Vector3(-12, 8.8, -4.4),
  new THREE.Vector3(-4.4, 8.8, -3.2),
  new THREE.Vector3(9.6, 8.7, -4.8),
  new THREE.Vector3(20.8, 8.5, -4.1),
  new THREE.Vector3(23.8, 8.4, -3.4),
  new THREE.Vector3(14.2, 1.6, -1.7),
  new THREE.Vector3(4.4, -9.4, 0.4),
  new THREE.Vector3(0.6, -16.8, 1.5),
  new THREE.Vector3(0, -18.8, 1.8),
  new THREE.Vector3(-3.8, -8.4, -0.6),
  new THREE.Vector3(-10.8, 4.4, -2.4),
];

const CAMERA_FOV_STOPS = [
  { t: 0, value: 28.4 },
  { t: 0.16, value: 33.8 },
  { t: 0.34, value: 29.2 },
  { t: 0.54, value: 34.9 },
  { t: 0.74, value: 30.4 },
  { t: 0.9, value: 35.4 },
  { t: 1, value: 29.6 },
];

function wrapProgress(value: number) {
  return THREE.MathUtils.euclideanModulo(value, 1);
}

const STORY_POINT_A_LOOK = new THREE.Vector3(-12.2, 8.9, -4.1);
const STORY_POINT_B_LOOK = new THREE.Vector3(23.8, 8.4, -3.4);
const STORY_POINT_C_LOOK = new THREE.Vector3(0, -18.6, 1.6);

const STORY_POINT_A_WIDE = new THREE.Vector3(-23.8, 12.6, 19.6);
const STORY_POINT_B_WIDE = new THREE.Vector3(13.2, 9.8, 22.4);
const STORY_POINT_C_WIDE = new THREE.Vector3(7.4, -8.4, 23.8);
const STORY_CAMERA_FOV = 31.4;

function sampleStoryCamera(progress: number) {
  const wrapped = wrapProgress(progress);
  const roll = 0;

  if (wrapped < 1 / 3) {
    const t = THREE.MathUtils.smootherstep(wrapped / (1 / 3), 0, 1);
    return {
      camera: STORY_POINT_A_WIDE.clone().lerp(STORY_POINT_B_WIDE, t),
      look: STORY_POINT_A_LOOK.clone().lerp(STORY_POINT_B_LOOK, t),
      fov: STORY_CAMERA_FOV,
      roll,
    };
  }

  if (wrapped < 2 / 3) {
    const t = THREE.MathUtils.smootherstep((wrapped - 1 / 3) / (1 / 3), 0, 1);
    return {
      camera: STORY_POINT_B_WIDE.clone().lerp(STORY_POINT_C_WIDE, t),
      look: STORY_POINT_B_LOOK.clone().lerp(STORY_POINT_C_LOOK, t),
      fov: STORY_CAMERA_FOV,
      roll,
    };
  }

  const t = THREE.MathUtils.smootherstep((wrapped - 2 / 3) / (1 / 3), 0, 1);
  return {
    camera: STORY_POINT_C_WIDE.clone().lerp(STORY_POINT_A_WIDE, t),
    look: STORY_POINT_C_LOOK.clone().lerp(STORY_POINT_A_LOOK, t),
    fov: STORY_CAMERA_FOV,
    roll,
  };
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

function createExplosionFragments(
  planetIndex: number,
  burstId: number,
  radius: number,
) {
  const count = 24 + planetIndex * 6;
  const fragments: ExplosionFragmentSpec[] = [];

  for (let index = 0; index < count; index += 1) {
    const seed = burstId * 101 + planetIndex * 31 + index * 17.13;
    const theta = ((index + 0.5) / count) * Math.PI * 2 + seed * 0.03;
    const phi = Math.acos(
      THREE.MathUtils.clamp(
        Math.sin(seed * 0.29) * 0.68 + Math.cos(seed * 0.11) * 0.18,
        -1,
        1,
      ),
    );
    const direction = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    ).normalize();
    const spread = radius * (0.22 + (Math.sin(seed * 0.41) + 1) * 0.12);

    fragments.push({
      direction: [direction.x, direction.y, direction.z],
      offset: [
        direction.x * spread,
        direction.y * spread,
        direction.z * spread,
      ],
      scale: [
        radius * (0.08 + (Math.sin(seed * 0.17) + 1) * 0.05),
        radius * (0.06 + (Math.cos(seed * 0.13) + 1) * 0.04),
        radius * (0.11 + (Math.sin(seed * 0.23 + 0.4) + 1) * 0.04),
      ],
      spin: [
        0.8 + Math.sin(seed * 0.19) * 0.65,
        0.9 + Math.cos(seed * 0.14) * 0.6,
        0.7 + Math.sin(seed * 0.27) * 0.55,
      ],
    });
  }

  return fragments;
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
  const blastTimeoutRef = useRef<number | null>(null);
  const [planetInteractions, setPlanetInteractions] = useState<
    PlanetInteractionState[]
  >(() =>
    PLANETS.map(() => ({
      clicks: 0,
      explodingAt: null,
      burstId: 0,
    })),
  );
  const [sceneBlast, setSceneBlast] = useState<SceneBlastState>({
    triggeredAt: null,
    burstId: 0,
  });
  const [blackHoleInteraction, setBlackHoleInteraction] =
    useState<BlackHoleInteractionState>({
      clicks: 0,
      destroyedAt: null,
      burstId: 0,
    });

  useEffect(() => {
    scrollRef.current.target = 0;
  }, [resetSignal]);

  useEffect(() => {
    return () => {
      if (blastTimeoutRef.current !== null) {
        window.clearTimeout(blastTimeoutRef.current);
      }
    };
  }, []);

  function handlePlanetClick(planetIndex: number) {
    if (launchSignal || sceneBlast.triggeredAt !== null) {
      return;
    }

    setPlanetInteractions((current) => {
      const next = [...current];
      const planet = next[planetIndex];

      if (!planet || planet.explodingAt !== null) {
        return current;
      }

      const nextClicks = planet.clicks + 1;

      if (nextClicks >= PLANET_CLICK_THRESHOLD) {
        next[planetIndex] = {
          clicks: PLANET_CLICK_THRESHOLD,
          explodingAt: performance.now(),
          burstId: planet.burstId + 1,
        };
      } else {
        next[planetIndex] = {
          ...planet,
          clicks: nextClicks,
        };
      }

      return next;
    });
  }

  function handleBlackHoleClick() {
    if (
      launchSignal ||
      sceneBlast.triggeredAt !== null ||
      blackHoleInteraction.destroyedAt !== null
    ) {
      return;
    }

    setBlackHoleInteraction((current) => {
      const nextClicks = current.clicks + 1;

      if (nextClicks < BLACK_HOLE_CLICK_THRESHOLD) {
        return {
          ...current,
          clicks: nextClicks,
        };
      }

      const triggeredAt = performance.now();
      const nextBurstId = current.burstId + 1;
      setPlanetInteractions((planets) =>
        planets.map((planet) => ({
          clicks: PLANET_CLICK_THRESHOLD,
          explodingAt: triggeredAt,
          burstId: planet.burstId + 1,
        })),
      );
      setSceneBlast({
        triggeredAt,
        burstId: nextBurstId,
      });

      if (blastTimeoutRef.current !== null) {
        window.clearTimeout(blastTimeoutRef.current);
      }

      blastTimeoutRef.current = window.setTimeout(() => {
        setSceneBlast((latest) => ({
          ...latest,
          triggeredAt: null,
        }));
        blastTimeoutRef.current = null;
      }, SCENE_BLAST_DURATION_MS);

      return {
        clicks: BLACK_HOLE_CLICK_THRESHOLD,
        destroyedAt: triggeredAt,
        burstId: nextBurstId,
      };
    });
  }

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
          planetInteractions={planetInteractions}
          onPlanetClick={handlePlanetClick}
          sceneBlast={sceneBlast}
          blackHoleInteraction={blackHoleInteraction}
          onBlackHoleClick={handleBlackHoleClick}
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
  planetInteractions,
  onPlanetClick,
  sceneBlast,
  blackHoleInteraction,
  onBlackHoleClick,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  scrollRef: React.MutableRefObject<ScrollState>;
  children?: ReactNode;
  launchSignal: boolean;
  planetInteractions: PlanetInteractionState[];
  onPlanetClick: (planetIndex: number) => void;
  sceneBlast: SceneBlastState;
  blackHoleInteraction: BlackHoleInteractionState;
  onBlackHoleClick: () => void;
}) {
  const { camera } = useThree();
  const lookTarget = useRef(new THREE.Vector3());
  const cameraTarget = useRef(new THREE.Vector3());
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
    const sceneBlastProgress =
      sceneBlast.triggeredAt === null
        ? 0
        : THREE.MathUtils.clamp(
            (performance.now() - sceneBlast.triggeredAt) /
              SCENE_BLAST_DURATION_MS,
            0,
            1,
          );

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
    const storyboard = sampleStoryCamera(progress);
    const baseCameraPoint = storyboard.camera;
    const baseLookPoint = storyboard.look;
    sideVector.current
      .crossVectors(
        forward.current
          .subVectors(baseLookPoint, baseCameraPoint)
          .normalize(),
        worldUp.current,
      )
      .normalize();
    liftVector.current
      .crossVectors(sideVector.current, forward.current)
      .normalize();

    const motionBias = scrollRef.current.target - scrollRef.current.current;
    const sideDrift = THREE.MathUtils.clamp(motionBias * 0.8, -0.018, 0.018);
    const liftDrift = THREE.MathUtils.clamp(Math.abs(motionBias) * 0.08, 0, 0.018);

    cameraTarget.current
      .copy(baseCameraPoint)
      .addScaledVector(sideVector.current, sideDrift)
      .addScaledVector(liftVector.current, liftDrift);

    if (sceneBlastProgress > 0) {
      const blastVector = baseCameraPoint
        .clone()
        .sub(BLACK_HOLE_POSITION)
        .normalize();
      const blastPush = THREE.MathUtils.smootherstep(sceneBlastProgress, 0, 0.78);
      const shakeFalloff = 1 - THREE.MathUtils.smootherstep(sceneBlastProgress, 0.16, 1);
      const shakeStrength = 1.55 * shakeFalloff;
      const elapsed = performance.now() * 0.001;
      const shakeX =
        Math.sin(elapsed * 30) * shakeStrength +
        Math.cos(elapsed * 23) * shakeStrength * 0.45;
      const shakeY =
        Math.cos(elapsed * 27) * shakeStrength * 0.8 +
        Math.sin(elapsed * 18) * shakeStrength * 0.38;
      const shakeZ = Math.sin(elapsed * 34) * shakeStrength * 0.34;

      cameraTarget.current
        .addScaledVector(blastVector, blastPush * 28)
        .addScaledVector(sideVector.current, shakeX)
        .addScaledVector(liftVector.current, shakeY)
        .addScaledVector(forward.current, shakeZ);

      lookTarget.current
        .copy(baseLookPoint)
        .addScaledVector(blastVector, -blastPush * 4.2)
        .addScaledVector(sideVector.current, shakeX * 0.22)
        .addScaledVector(liftVector.current, shakeY * 0.18);
    } else {
      lookTarget.current.lerp(baseLookPoint, 1 - Math.exp(-delta * 3.1));
    }

    perspectiveCamera.position.lerp(
      cameraTarget.current,
      1 - Math.exp(-delta * (sceneBlastProgress > 0 ? 4.2 : 2.35)),
    );
    perspectiveCamera.lookAt(lookTarget.current);

    const targetFov =
      storyboard.fov +
      THREE.MathUtils.smootherstep(sceneBlastProgress, 0, 0.4) * 22 -
      THREE.MathUtils.smootherstep(sceneBlastProgress, 0.58, 1) * 8;
    perspectiveCamera.fov = THREE.MathUtils.lerp(
      perspectiveCamera.fov,
      targetFov,
      1 - Math.exp(-delta * (sceneBlastProgress > 0 ? 4.6 : 2.35)),
    );
    perspectiveCamera.updateProjectionMatrix();

    forward.current
      .subVectors(lookTarget.current, perspectiveCamera.position)
      .normalize();
    rollQuaternion.current.setFromAxisAngle(
      forward.current,
      storyboard.roll,
    );
    lookQuaternion.current.copy(perspectiveCamera.quaternion);
    perspectiveCamera.quaternion.slerp(
      lookQuaternion.current.multiply(rollQuaternion.current),
      0.05,
    );
  });

  return (
    <>
      <SceneBlastLight sceneBlast={sceneBlast} />
      <SpaceBackdrop sceneBlast={sceneBlast} />
      <BlackHoleCore
        sceneBlast={sceneBlast}
        blackHoleInteraction={blackHoleInteraction}
        onBlackHoleClick={onBlackHoleClick}
      />
      {PLANETS.map((planet, index) => (
        <PlanetCluster
          key={`planet-${planet.center[0]}-${planet.center[1]}`}
          planet={planet}
          index={index}
          interaction={planetInteractions[index]}
          onPlanetClick={() => onPlanetClick(index)}
          sceneBlast={sceneBlast}
        />
      ))}
      {children ? <LoginAnchor>{children}</LoginAnchor> : null}
      <AsteroidField
        pointerRef={pointerRef}
        scrollRef={scrollRef}
        sceneBlast={sceneBlast}
      />
    </>
  );
}

function SceneBlastLight({ sceneBlast }: { sceneBlast: SceneBlastState }) {
  const lightRef = useRef<THREE.PointLight | null>(null);

  useFrame(() => {
    if (!lightRef.current) {
      return;
    }

    const blastProgress =
      sceneBlast.triggeredAt === null
        ? 0
        : THREE.MathUtils.clamp(
            (performance.now() - sceneBlast.triggeredAt) /
              SCENE_BLAST_DURATION_MS,
            0,
            1,
          );
    const flash =
      THREE.MathUtils.smootherstep(blastProgress, 0, 0.08) *
      (1 - THREE.MathUtils.smootherstep(blastProgress, 0.16, 1));

    lightRef.current.intensity = flash * 260;
    lightRef.current.distance = 90 + blastProgress * 70;
  });

  return (
    <pointLight
      ref={lightRef}
      position={BLACK_HOLE_POSITION.toArray()}
      intensity={0}
      distance={90}
      color="#eef5ff"
    />
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

function BlackHoleCore({
  sceneBlast,
  blackHoleInteraction,
  onBlackHoleClick,
}: {
  sceneBlast: SceneBlastState;
  blackHoleInteraction: BlackHoleInteractionState;
  onBlackHoleClick: () => void;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const holePosition = useMemo(() => BLACK_HOLE_POSITION.clone(), []);
  const diskRef = useRef<THREE.Mesh | null>(null);
  const diskBackRef = useRef<THREE.Mesh | null>(null);
  const lensShellRef = useRef<THREE.Mesh | null>(null);
  const shockwaveRef = useRef<THREE.Mesh | null>(null);
  const shockwaveMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const haloMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const outerPulseRef = useRef<THREE.Mesh | null>(null);
  const outerPulseMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const whiteOutlineRef = useRef<THREE.Mesh | null>(null);
  const whiteOutlineMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const purpleOutlineRef = useRef<THREE.Mesh | null>(null);
  const purpleOutlineMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const coreMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const innerVoidMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
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

    const clickProgress =
      blackHoleInteraction.clicks / BLACK_HOLE_CLICK_THRESHOLD;
    const blastProgress =
      sceneBlast.triggeredAt === null
        ? 0
        : THREE.MathUtils.clamp(
            (performance.now() - sceneBlast.triggeredAt) /
              SCENE_BLAST_DURATION_MS,
            0,
            1,
          );
    const destroyedProgress =
      blackHoleInteraction.destroyedAt === null
        ? 0
        : THREE.MathUtils.clamp(
            (performance.now() - blackHoleInteraction.destroyedAt) /
              SCENE_BLAST_DURATION_MS,
            0,
            1,
          );
    const collapseProgress =
      blackHoleInteraction.destroyedAt === null
        ? 0
        : THREE.MathUtils.smootherstep(destroyedProgress, 0.08, 0.7);
    const chargePulse =
      clickProgress > 0
        ? Math.sin(state.clock.elapsedTime * (2.4 + clickProgress * 5.2)) * 0.5 +
          0.5
        : 0;

    groupRef.current.position.lerp(holePosition, 1 - Math.exp(-delta * 2.5));
    groupRef.current.rotation.z += delta * 0.02;
    groupRef.current.scale.setScalar(
      (1 + clickProgress * 0.1 + chargePulse * clickProgress * 0.06) *
        THREE.MathUtils.lerp(
          1 + THREE.MathUtils.smootherstep(blastProgress, 0, 0.8) * 0.52,
          0.06,
          collapseProgress,
        ),
    );

    lensMaterial.uniforms.uTime.value = state.clock.elapsedTime;
    diskMaterial.uniforms.uTime.value = state.clock.elapsedTime;

    if (diskRef.current) {
      diskRef.current.rotation.z += delta * (0.14 + blastProgress * 1.8);
    }

    if (diskBackRef.current) {
      diskBackRef.current.rotation.z -= delta * (0.08 + blastProgress * 1.2);
    }

    if (lensShellRef.current) {
      lensShellRef.current.rotation.y += delta * (0.05 + blastProgress * 0.3);
      lensShellRef.current.rotation.z -= delta * (0.04 + blastProgress * 0.22);
    }

    if (shockwaveRef.current) {
      const shockwaveScale =
        sceneBlast.triggeredAt === null
          ? 0.001
          : THREE.MathUtils.lerp(
              0.001,
              34,
              THREE.MathUtils.smootherstep(blastProgress, 0, 1),
            );
      shockwaveRef.current.scale.setScalar(shockwaveScale);
    }

    if (shockwaveMaterialRef.current) {
      shockwaveMaterialRef.current.opacity =
        sceneBlast.triggeredAt === null
          ? 0
          : (1 - THREE.MathUtils.smootherstep(blastProgress, 0, 1)) * 0.22;
    }

    if (haloMaterialRef.current) {
      haloMaterialRef.current.opacity =
        (0.025 + clickProgress * 0.08 + blastProgress * 0.2) *
        (1 - collapseProgress * 0.9);
    }

    if (outerPulseRef.current) {
      outerPulseRef.current.scale.setScalar(
        2.8 +
          clickProgress * 0.6 +
          chargePulse * clickProgress * 0.2 +
          THREE.MathUtils.smootherstep(blastProgress, 0, 1) * 8.6,
      );
    }

    if (outerPulseMaterialRef.current) {
      outerPulseMaterialRef.current.opacity =
        sceneBlast.triggeredAt === null
          ? clickProgress * (0.04 + chargePulse * 0.05)
          : (1 - THREE.MathUtils.smootherstep(blastProgress, 0.18, 1)) * 0.18;
      outerPulseMaterialRef.current.opacity *= 1 - collapseProgress;
    }

    if (whiteOutlineRef.current) {
      whiteOutlineRef.current.scale.setScalar(
        1.18 + clickProgress * 0.16 + chargePulse * clickProgress * 0.08,
      );
    }

    if (purpleOutlineRef.current) {
      purpleOutlineRef.current.scale.setScalar(
        1.42 + clickProgress * 0.22 + chargePulse * clickProgress * 0.12,
      );
    }

    if (whiteOutlineMaterialRef.current) {
      whiteOutlineMaterialRef.current.opacity =
        (0.16 + clickProgress * 0.28 + chargePulse * clickProgress * 0.16) *
        (1 - collapseProgress);
    }

    if (purpleOutlineMaterialRef.current) {
      purpleOutlineMaterialRef.current.opacity =
        (0.18 + clickProgress * 0.34 + chargePulse * clickProgress * 0.18) *
        (1 - collapseProgress);
    }

    if (coreMaterialRef.current) {
      coreMaterialRef.current.opacity = 0.92 * (1 - collapseProgress * 0.95);
    }

    if (innerVoidMaterialRef.current) {
      innerVoidMaterialRef.current.opacity = 0.96 * (1 - collapseProgress);
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
        <meshBasicMaterial
          ref={coreMaterialRef}
          color="#05060e"
          transparent
          opacity={0.92}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[2.9, 40, 40]} />
        <meshBasicMaterial color="#02030a" />
      </mesh>

      <mesh scale={[0.82, 0.82, 0.82]}>
        <sphereGeometry args={[2.9, 40, 40]} />
        <meshBasicMaterial
          ref={innerVoidMaterialRef}
          color="#000000"
          transparent
          opacity={0.96}
        />
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
          ref={haloMaterialRef}
          color="#4961b4"
          transparent
          opacity={0.025}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>

      <mesh ref={whiteOutlineRef} scale={[1.18, 1.18, 1.18]}>
        <sphereGeometry args={[3.18, 40, 40]} />
        <meshBasicMaterial
          ref={whiteOutlineMaterialRef}
          color="#ffffff"
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={purpleOutlineRef} scale={[1.42, 1.42, 1.42]}>
        <sphereGeometry args={[3.18, 40, 40]} />
        <meshBasicMaterial
          ref={purpleOutlineMaterialRef}
          color="#a855f7"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={outerPulseRef}>
        <sphereGeometry args={[3.3, 24, 24]} />
        <meshBasicMaterial
          ref={outerPulseMaterialRef}
          color="#dbe7ff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>

      <mesh ref={shockwaveRef}>
        <sphereGeometry args={[3.4, 28, 28]} />
        <meshBasicMaterial
          ref={shockwaveMaterialRef}
          color="#8eb5ff"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh onClick={onBlackHoleClick}>
        <sphereGeometry args={[7.8, 24, 24]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>
    </group>
  );
}

function SpaceBackdrop({ sceneBlast }: { sceneBlast: SceneBlastState }) {
  const starPositions = useMemo(() => createStarPositions(), []);
  const starFieldRef = useRef<THREE.Points | null>(null);
  const starsMaterialRef = useRef<THREE.PointsMaterial | null>(null);

  useFrame((state, delta) => {
    const blastProgress =
      sceneBlast.triggeredAt === null
        ? 0
        : THREE.MathUtils.clamp(
            (performance.now() - sceneBlast.triggeredAt) /
              SCENE_BLAST_DURATION_MS,
            0,
            1,
          );

    if (starFieldRef.current) {
      starFieldRef.current.rotation.y = state.clock.elapsedTime * 0.005;
      starFieldRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.03) * 0.02;
      starFieldRef.current.position.z = THREE.MathUtils.lerp(
        starFieldRef.current.position.z,
        blastProgress * 64,
        1 - Math.exp(-delta * 4.1),
      );
      starFieldRef.current.scale.set(
        1 + blastProgress * 3.1,
        1 + blastProgress * 0.5,
        1 + blastProgress * 6.4,
      );
    }

    if (starsMaterialRef.current) {
      starsMaterialRef.current.size = 0.16 + blastProgress * 0.6;
      starsMaterialRef.current.opacity = 0.88 - blastProgress * 0.7;
      starsMaterialRef.current.color.set(
        new THREE.Color().lerpColors(
          new THREE.Color("#dcecff"),
          new THREE.Color("#f6fbff"),
          THREE.MathUtils.smootherstep(blastProgress, 0, 0.45),
        ),
      );
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
          ref={starsMaterialRef}
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
  interaction,
  onPlanetClick,
  sceneBlast,
}: {
  planet: PlanetSpec;
  index: number;
  interaction: PlanetInteractionState;
  onPlanetClick: () => void;
  sceneBlast: SceneBlastState;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const bodyGroupRef = useRef<THREE.Group | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);
  const atmosphereRef = useRef<THREE.Mesh | null>(null);
  const highlightRef = useRef<THREE.Mesh | null>(null);
  const planetMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const atmosphereMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const highlightMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const ringMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const fragmentGroupRef = useRef<THREE.Group | null>(null);
  const fragmentRefs = useRef<Array<THREE.Mesh | null>>([]);
  const planetVector = useMemo(
    () =>
      new THREE.Vector3(planet.center[0], planet.center[1], planet.center[2]),
    [planet.center],
  );
  const fragments = useMemo(
    () => createExplosionFragments(index, interaction.burstId, planet.radius),
    [index, interaction.burstId, planet.radius],
  );
  const blastDirection = useMemo(
    () => planetVector.clone().sub(BLACK_HOLE_POSITION).normalize(),
    [planetVector],
  );

  useFrame((state, delta) => {
    const clickProgress = interaction.clicks / PLANET_CLICK_THRESHOLD;
    const pulse =
      clickProgress > 0
        ? Math.sin(
            state.clock.elapsedTime * (1.8 + clickProgress * 3.1) + index,
          ) *
            0.5 +
          0.5
        : 0;
    const buildIntensity = clickProgress * (0.58 + pulse * 0.42);
    const sceneBlastProgress =
      sceneBlast.triggeredAt === null
        ? 0
        : THREE.MathUtils.clamp(
            (performance.now() - sceneBlast.triggeredAt) /
              SCENE_BLAST_DURATION_MS,
            0,
            1,
          );
    const explosionProgress =
      interaction.explodingAt === null && sceneBlast.triggeredAt === null
        ? 0
        : THREE.MathUtils.clamp(
            (performance.now() -
              (sceneBlast.triggeredAt ??
                interaction.explodingAt ??
                performance.now())) /
              (sceneBlast.triggeredAt === null
                ? PLANET_EXPLOSION_DURATION_MS
                : SCENE_BLAST_DURATION_MS),
            0,
            1,
          );
    const planetVisibility =
      interaction.explodingAt === null && sceneBlast.triggeredAt === null
        ? 1
        : 1 - explosionProgress;
    const planetScale =
      interaction.explodingAt === null && sceneBlast.triggeredAt === null
        ? 1 + buildIntensity * 0.04
        : THREE.MathUtils.lerp(
            1.06,
            0.22,
            THREE.MathUtils.smootherstep(explosionProgress, 0, 1),
          );

    if (groupRef.current) {
      const targetPlanetPosition = planetVector
        .clone()
        .addScaledVector(
          blastDirection,
          sceneBlastProgress * (24 + index * 6),
        );
      groupRef.current.position.lerp(
        targetPlanetPosition,
        1 - Math.exp(-delta * 3),
      );
      groupRef.current.rotation.y += delta * (0.12 + index * 0.02);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        Math.sin(state.clock.elapsedTime * 0.08 + index) * 0.06,
        1 - Math.exp(-delta * 2.2),
      );
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        sceneBlastProgress * (2.2 + index * 0.55),
        1 - Math.exp(-delta * 3.6),
      );
    }

    if (planetMaterialRef.current) {
      planetMaterialRef.current.emissiveIntensity =
        0.24 + clickProgress * 0.95 + pulse * clickProgress * 0.48;
      planetMaterialRef.current.opacity = planetVisibility;
    }

    if (atmosphereRef.current) {
      const atmosphereScale =
        1.18 + clickProgress * 0.08 + explosionProgress * 0.14;
      atmosphereRef.current.scale.setScalar(atmosphereScale);
    }

    if (atmosphereMaterialRef.current) {
      atmosphereMaterialRef.current.opacity =
        0.14 + clickProgress * 0.18 + pulse * clickProgress * 0.08;
      atmosphereMaterialRef.current.opacity *=
        interaction.explodingAt === null && sceneBlast.triggeredAt === null
          ? 1
          : 1 - explosionProgress * 0.24;
    }

    if (highlightRef.current) {
      const highlightScale =
        1 + clickProgress * 0.35 + explosionProgress * 0.48;
      highlightRef.current.scale.setScalar(highlightScale);
    }

    if (highlightMaterialRef.current) {
      highlightMaterialRef.current.opacity =
        (0.22 + clickProgress * 0.34 + pulse * clickProgress * 0.16) *
        planetVisibility;
    }

    if (ringRef.current && planet.ringTilt) {
      ringRef.current.rotation.x = planet.ringTilt[0];
      ringRef.current.rotation.y =
        planet.ringTilt[1] + state.clock.elapsedTime * 0.05;
      ringRef.current.rotation.z = planet.ringTilt[2];
      ringRef.current.scale.setScalar(
        1 + clickProgress * 0.03 + explosionProgress * 0.06,
      );
    }

    if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity =
        (0.22 + clickProgress * 0.12) *
        (interaction.explodingAt === null && sceneBlast.triggeredAt === null
          ? 1
          : 1 - explosionProgress * 0.5);
    }

    if (fragmentGroupRef.current) {
      fragmentGroupRef.current.visible =
        interaction.explodingAt !== null || sceneBlast.triggeredAt !== null;
    }

    fragmentRefs.current.forEach((fragment, fragmentIndex) => {
      if (!fragment) {
        return;
      }

      if (interaction.explodingAt === null && sceneBlast.triggeredAt === null) {
        fragment.visible = false;
        return;
      }

      const fragmentSpec = fragments[fragmentIndex];
      const explodeEase = THREE.MathUtils.smootherstep(explosionProgress, 0, 1);
      const blastTravelBoost =
        sceneBlast.triggeredAt === null
          ? 0
          : sceneBlastProgress * (18 + index * 3.2);
      const travel =
        planet.radius *
        (0.3 + explodeEase * (3.4 + fragmentIndex * 0.015) + blastTravelBoost);
      fragment.visible = true;
      fragment.position.set(
        fragmentSpec.offset[0] + fragmentSpec.direction[0] * travel,
        fragmentSpec.offset[1] + fragmentSpec.direction[1] * travel,
        fragmentSpec.offset[2] + fragmentSpec.direction[2] * travel,
      );
      fragment.rotation.x += delta * fragmentSpec.spin[0];
      fragment.rotation.y += delta * fragmentSpec.spin[1];
      fragment.rotation.z += delta * fragmentSpec.spin[2];
      fragment.scale.set(
        fragmentSpec.scale[0] * (1 - explodeEase * 0.7),
        fragmentSpec.scale[1] * (1 - explodeEase * 0.7),
        fragmentSpec.scale[2] * (1 - explodeEase * 0.7),
      );
    });

    if (bodyGroupRef.current) {
      bodyGroupRef.current.scale.setScalar(planetScale);
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={bodyGroupRef}>
        <mesh onClick={onPlanetClick}>
          <sphereGeometry args={[planet.radius, 48, 48]} />
          <meshStandardMaterial
            ref={planetMaterialRef}
            color={planet.color}
            roughness={0.85}
            metalness={0.04}
            emissive={planet.glowColor}
            emissiveIntensity={0.24}
            transparent
          />
        </mesh>

        <mesh ref={atmosphereRef}>
          <sphereGeometry args={[planet.radius, 40, 40]} />
          <meshBasicMaterial
            ref={atmosphereMaterialRef}
            color={planet.atmosphereColor}
            transparent
            opacity={0.14}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        <mesh
          ref={highlightRef}
          position={[
            planet.radius * 0.28,
            planet.radius * 0.12,
            planet.radius * 0.86,
          ]}
        >
          <sphereGeometry args={[planet.radius * 0.14, 24, 24]} />
          <meshBasicMaterial
            ref={highlightMaterialRef}
            color="#ffffff"
            transparent
            opacity={0.22}
          />
        </mesh>

        {planet.ringColor ? (
          <mesh ref={ringRef}>
            <torusGeometry args={[planet.radius + 1.5, 0.12, 20, 120]} />
            <meshBasicMaterial
              ref={ringMaterialRef}
              color={planet.ringColor}
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ) : null}
      </group>

      <group ref={fragmentGroupRef} visible={false}>
        {fragments.map((fragment, fragmentIndex) => (
          <mesh
            key={`fragment-${index}-${interaction.burstId}-${fragmentIndex}`}
            ref={(node) => {
              fragmentRefs.current[fragmentIndex] = node;
            }}
            visible={false}
          >
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={planet.color}
              emissive={planet.glowColor}
              emissiveIntensity={0.52}
              roughness={0.56}
              metalness={0.08}
              transparent
              opacity={0.95}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function AsteroidField({
  pointerRef,
  scrollRef,
  sceneBlast,
}: {
  pointerRef: React.MutableRefObject<PointerState>;
  scrollRef: React.MutableRefObject<ScrollState>;
  sceneBlast: SceneBlastState;
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
        transparent: true,
        opacity: 0.96,
      }),
    [],
  );
  const asteroids = useMemo(() => createAsteroids(), []);
  const { viewport } = useThree();

  useFrame((state, delta) => {
    const blastProgress =
      sceneBlast.triggeredAt === null
        ? 0
        : THREE.MathUtils.clamp(
            (performance.now() - sceneBlast.triggeredAt) /
              SCENE_BLAST_DURATION_MS,
            0,
            1,
          );

    focusPoint.current.copy(
      sampleStoryCamera(scrollRef.current.current).look,
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
      const blastDirection = new THREE.Vector3()
        .subVectors(clusterCenter, BLACK_HOLE_POSITION)
        .normalize();
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
      const blastOffsetScale =
        blastProgress * (18 + asteroid.clusterIndex * 4.6);

      targetPosition.current.set(
        baseX + pushX + blastDirection.x * blastOffsetScale,
        baseY + pushY + blastDirection.y * blastOffsetScale,
        baseZ +
          avoidance * 0.22 +
          blastDirection.z * blastOffsetScale +
          blastProgress * 4.4,
      );
      mesh.position.lerp(targetPosition.current, 1 - Math.exp(-delta * 6.4));
      mesh.rotation.x +=
        delta * asteroid.spin[0] * (0.4 + blastProgress * 5.4);
      mesh.rotation.y +=
        delta * asteroid.spin[1] * (0.42 + blastProgress * 5.9);
      mesh.rotation.z +=
        delta * asteroid.spin[2] * (0.36 + blastProgress * 5.1);

      mesh.scale.x = THREE.MathUtils.lerp(
        mesh.scale.x,
        asteroid.scale[0] * (1 + avoidance * 0.05 + blastProgress * 0.48),
        1 - Math.exp(-delta * 5),
      );
      mesh.scale.y = THREE.MathUtils.lerp(
        mesh.scale.y,
        asteroid.scale[1] * (1 + avoidance * 0.05 + blastProgress * 0.48),
        1 - Math.exp(-delta * 5),
      );
      mesh.scale.z = THREE.MathUtils.lerp(
        mesh.scale.z,
        asteroid.scale[2] * (1 + avoidance * 0.05 + blastProgress * 0.48),
        1 - Math.exp(-delta * 5),
      );
    });

    asteroidMaterial.opacity = 0.96 - blastProgress * 0.82;
    asteroidMaterial.emissive.set("#8db0ff");
    asteroidMaterial.emissiveIntensity = blastProgress * 0.72;
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

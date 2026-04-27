import { AsciiRenderer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const LOGO_URL = "/brand-mark.png";
const IDLE_ROTATION_SPEED_Y = 0.5;
const INITIAL_LOGO_VIEWPORT_FRACTION = 0.36;
const BRAND_PURPLE = "#7854ff";

type LogoInstance = {
  position: [number, number, number];
  scale: number;
};

type LogoMeshData = {
  height: number;
  instances: LogoInstance[];
  width: number;
};

type DustSpec = {
  position: [number, number, number];
  scale: number;
  speed: number;
};

function seededNoise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function useLogoMeshData(url: string) {
  const [data, setData] = useState<LogoMeshData | null>(null);

  useEffect(() => {
    let isActive = true;

    const image = new Image();
    image.src = url;

    image.onload = () => {
      if (!isActive) {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }

      context.drawImage(image, 0, 0);
      const {
        data: pixels,
        width,
        height,
      } = context.getImageData(0, 0, canvas.width, canvas.height);

      const sampleStep = 18;
      const aspect = width / height;
      const worldHeight = 10;
      const worldWidth = worldHeight * aspect;
      const rawPoints: Array<{
        x: number;
        y: number;
        z: number;
        seed: number;
      }> = [];

      for (let y = 0; y < height; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
          const pixelIndex = (y * width + x) * 4;
          const red = pixels[pixelIndex];
          const green = pixels[pixelIndex + 1];
          const blue = pixels[pixelIndex + 2];
          const alpha = pixels[pixelIndex + 3];
          const brightness = (red + green + blue) / 3;

          if (alpha < 10 || brightness > 242) {
            continue;
          }

          const normalizedX = x / width - 0.5;
          const normalizedY = 0.5 - y / height;
          const seed = x * 0.173 + y * 0.349;
          const baseDepth =
            Math.sin(normalizedX * Math.PI * 3.2) * 0.28 +
            Math.cos(normalizedY * Math.PI * 2.6) * 0.18;

          rawPoints.push({
            x: normalizedX * worldWidth,
            y: normalizedY * worldHeight,
            z: baseDepth,
            seed,
          });
        }
      }

      if (rawPoints.length === 0) {
        setData(null);
        return;
      }

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      rawPoints.forEach((point) => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const contentWidth = maxX - minX || 1;
      const contentHeight = maxY - minY || 1;
      const thicknessLayers: number = 6;
      const thickness = 2.2;
      const instances: LogoInstance[] = [];

      rawPoints.forEach((point, pointIndex) => {
        for (
          let layerIndex = 0;
          layerIndex < thicknessLayers;
          layerIndex += 1
        ) {
          const layerProgress =
            thicknessLayers === 1 ? 0 : layerIndex / (thicknessLayers - 1);
          const centeredDepth = (layerProgress - 0.5) * thickness;
          const noise = seededNoise(
            point.seed + pointIndex * 0.19 + layerIndex * 3.17,
          );
          const jitterX =
            (seededNoise(point.seed + layerIndex * 5.11) - 0.5) * 0.05;
          const jitterY =
            (seededNoise(point.seed + layerIndex * 7.37) - 0.5) * 0.05;
          const jitterZ =
            (seededNoise(point.seed + layerIndex * 2.63) - 0.5) * 0.08;

          instances.push({
            position: [
              point.x - centerX + jitterX,
              point.y - centerY + jitterY,
              point.z + centeredDepth + jitterZ,
            ],
            scale: 0.11 + noise * 0.06,
          });
        }
      });

      setData({
        instances,
        width: contentWidth,
        height: contentHeight,
      });
    };

    return () => {
      isActive = false;
    };
  }, [url]);

  return data;
}

function LogoAsciiMesh() {
  const data = useLogoMeshData(LOGO_URL);
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const viewport = useThree((state) => state.viewport);

  useEffect(() => {
    if (!meshRef.current || !data) {
      return;
    }

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scaleVector = new THREE.Vector3();

    data.instances.forEach((instance, index) => {
      matrix.compose(
        new THREE.Vector3(...instance.position),
        quaternion,
        scaleVector.setScalar(instance.scale),
      );
      meshRef.current!.setMatrixAt(index, matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [data]);

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return;
    }

    const elapsed = state.clock.getElapsedTime();
    const targetX = 0;
    const targetY = elapsed * IDLE_ROTATION_SPEED_Y;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetX,
      1 - Math.exp(-delta * 2.4),
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetY,
      1 - Math.exp(-delta * 2.4),
    );
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      0,
      1 - Math.exp(-delta * 2),
    );
  });

  if (!data) {
    return null;
  }

  const targetWidth = viewport.width * INITIAL_LOGO_VIEWPORT_FRACTION;
  const targetHeight = viewport.height * INITIAL_LOGO_VIEWPORT_FRACTION;
  const fitScale = Math.min(
    targetWidth / data.width,
    targetHeight / data.height,
  );

  return (
    <group ref={groupRef} scale={fitScale}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, data.instances.length]}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshPhongMaterial
          color="#ffffff"
          emissive={BRAND_PURPLE}
          emissiveIntensity={0.6}
          flatShading
        />
      </instancedMesh>
    </group>
  );
}

function ParticleDust() {
  const groupRef = useRef<THREE.Group>(null);
  const dustSpecs = useMemo<DustSpec[]>(
    () =>
      Array.from({ length: 36 }, (_, index) => {
        const seed = index * 17.31;
        return {
          position: [
            (seededNoise(seed) - 0.5) * 12,
            (seededNoise(seed + 11.7) - 0.5) * 8,
            -3.5 + seededNoise(seed + 4.2) * 5.5,
          ],
          scale: 0.035 + seededNoise(seed + 7.8) * 0.045,
          speed: 0.2 + seededNoise(seed + 15.4) * 0.45,
        };
      }),
    [],
  );

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const elapsed = state.clock.getElapsedTime();

    groupRef.current.children.forEach((child, index) => {
      const spec = dustSpecs[index];
      child.position.y = spec.position[1] + Math.sin(elapsed * spec.speed + index) * 0.18;
      child.position.x = spec.position[0] + Math.cos(elapsed * spec.speed * 0.7 + index) * 0.1;
    });
  });

  return (
    <group ref={groupRef}>
      {dustSpecs.map((spec, index) => (
        <mesh key={`dust-${index}`} position={spec.position} scale={spec.scale}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color={BRAND_PURPLE} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ScanBrackets() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!groupRef.current) {
      return;
    }

    const elapsed = state.clock.getElapsedTime();
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      Math.sin(elapsed * 0.2) * 0.08,
      1 - Math.exp(-delta * 2),
    );
  });

  return (
    <group ref={groupRef} position={[0, 0, -0.4]}>
      <group position={[-2.85, 1.95, 0]}>
        <mesh position={[0.24, 0, 0]}>
          <boxGeometry args={[0.48, 0.04, 0.04]} />
          <meshBasicMaterial color={BRAND_PURPLE} />
        </mesh>
        <mesh position={[0, -0.24, 0]}>
          <boxGeometry args={[0.04, 0.48, 0.04]} />
          <meshBasicMaterial color={BRAND_PURPLE} />
        </mesh>
      </group>

      <group position={[2.85, 1.95, 0]}>
        <mesh position={[-0.24, 0, 0]}>
          <boxGeometry args={[0.48, 0.04, 0.04]} />
          <meshBasicMaterial color={BRAND_PURPLE} />
        </mesh>
        <mesh position={[0, -0.24, 0]}>
          <boxGeometry args={[0.04, 0.48, 0.04]} />
          <meshBasicMaterial color={BRAND_PURPLE} />
        </mesh>
      </group>

      <group position={[-2.85, -1.95, 0]}>
        <mesh position={[0.24, 0, 0]}>
          <boxGeometry args={[0.48, 0.04, 0.04]} />
          <meshBasicMaterial color={BRAND_PURPLE} />
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <boxGeometry args={[0.04, 0.48, 0.04]} />
          <meshBasicMaterial color={BRAND_PURPLE} />
        </mesh>
      </group>

      <group position={[2.85, -1.95, 0]}>
        <mesh position={[-0.24, 0, 0]}>
          <boxGeometry args={[0.48, 0.04, 0.04]} />
          <meshBasicMaterial color={BRAND_PURPLE} />
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <boxGeometry args={[0.04, 0.48, 0.04]} />
          <meshBasicMaterial color={BRAND_PURPLE} />
        </mesh>
      </group>
    </group>
  );
}

export function AsciiLogoScene() {
  return (
    <div className="relative h-full w-full">
      <Canvas
        className="!h-full !w-full"
        style={{ display: "block", width: "100%", height: "100%" }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 11.8], fov: 34 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#05020b"]} />

        <ambientLight intensity={0.18} />
        <pointLight position={[5, 6, 9]} intensity={3.2} color="#ffffff" />
        <pointLight position={[-6, -4, 5]} intensity={1.1} color={BRAND_PURPLE} />
        <pointLight position={[0, 0, -8]} intensity={0.6} color={BRAND_PURPLE} />

        <ParticleDust />
        <ScanBrackets />
        <LogoAsciiMesh />

        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          target={[0, 0, 0]}
          rotateSpeed={0.65}
          zoomSpeed={0.9}
          minDistance={6}
          maxDistance={22}
          minPolarAngle={Math.PI * 0.38}
          maxPolarAngle={Math.PI * 0.62}
        />

        <AsciiRenderer
          bgColor="#05020b"
          fgColor={BRAND_PURPLE}
          characters={"    ****@@$$%%%%"}
          invert
          resolution={0.16}
        />
      </Canvas>
    </div>
  );
}

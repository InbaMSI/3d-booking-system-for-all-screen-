"use client";

import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { CanvasTexture, DoubleSide, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { VideoTexture } from "three";
import type { Seat, SeatInventory } from "@/lib/api/types";
import { getLookAngles, getLookDirection, getSeatCameraPose } from "@/lib/domain/seats";
import { TrailerPlayer } from "./trailer-player";
import { SeatMap2D } from "./seat-map-2d";

const AuditoriumCanvas = dynamic(
  () => Promise.resolve(AuditoriumCanvasInner),
  { ssr: false, loading: () => <AuditoriumLoadingFallback /> },
);

interface AuditoriumCanvasProps {
  inventory: SeatInventory;
  selectedIds: string[];
  previewSeatId: string | null;
  trailerUrl: string | null;
  onToggleSeat: (seatId: string) => void;
}

function AuditoriumCanvasInner(props: AuditoriumCanvasProps) {
  const [videoTexture, setVideoTexture] = useState<VideoTexture | null>(null);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  const [lookDirection, setLookDirection] = useState("facing the screen");
  const onTextureChange = useCallback((texture: VideoTexture | null, aspect: number | null) => {
    setVideoTexture(texture);
    setVideoAspect(aspect);
  }, []);
  const controls = useRef<OrbitControlsImpl>(null);
  const mobile = useSmallScreen();
  return (
    <section aria-label="3D auditorium preview" className={`auditorium-viewer ${mobile ? "mobile-viewer" : ""}`}>
      <div className="canvas-wrap">
        <Canvas
          aria-label="Interactive auditorium model. Drag to orbit, scroll to zoom, and click an available seat to preview its view."
          camera={{ position: [0, 19, 44], fov: 43 }}
          fallback={(
            <div className="canvas-webgl-fallback">
              <p role="status">3D preview is unavailable. Use the accessible seat map to continue.</p>
              <SeatMap2D onToggle={props.onToggleSeat} seats={props.inventory.seats} selectedIds={props.selectedIds} />
            </div>
          )}
          gl={{ antialias: true, powerPreference: "low-power" }}
          dpr={[1, 1.5]}
        >
          <color attach="background" args={["#090d17"]} />
          <ambientLight intensity={1.4} />
          <directionalLight intensity={2.2} position={[3, 8, 4]} />
          <Suspense fallback={null}>
            <AuditoriumModel
              inventory={props.inventory}
              onToggleSeat={props.onToggleSeat}
              selectionEnabled={!props.previewSeatId}
              selectedIds={props.selectedIds}
              videoAspect={videoAspect}
              videoTexture={videoTexture}
            />
          </Suspense>
          <SeatViewCamera
            controls={controls}
            previewSeat={props.inventory.seats.find((seat) => seat.id === props.previewSeatId) ?? null}
            screenCenter={props.inventory.screen.center}
          />
          <FirstPersonLookControls
            enabled={props.previewSeatId !== null}
            key={props.previewSeatId ?? "overview"}
            onLookDirectionChange={setLookDirection}
          />
          {!props.previewSeatId && (
            <OrbitControls
              ref={controls}
              enableDamping
              dampingFactor={0.08}
              enableZoom
              makeDefault
              maxDistance={58}
              maxPolarAngle={Math.PI / 2.05}
              minDistance={8}
              minPolarAngle={0.24}
              target={[0, 5, -2]}
              zoomSpeed={0.8}
            />
          )}
        </Canvas>
        <div className="canvas-label"><span className="canvas-live" /> PROCEDURAL 3D · 71 FT × 37.4 FT · 1.89:1</div>
        <div aria-label="Seat availability legend" className="auditorium-legend">
          <span><i className="legend-seat available" /> Available</span>
          <span><i className="legend-seat selected" /> Selected</span>
          <span><i className="legend-seat held" /> Held</span>
          <span><i className="legend-seat booked" /> Booked</span>
          <span><i className="legend-seat elite" /> Elite · raised rear</span>
          <span><i className="legend-seat lounger" /> Lounger · front row</span>
        </div>
        {props.previewSeatId && (
          <div aria-live="polite" className="seated-view-indicator">
            SEATED 360° VIEW · {lookDirection.toUpperCase()}
          </div>
        )}
        <div aria-hidden="true" className="canvas-controls-hint">
          {props.previewSeatId
            ? "Drag anywhere to look all around · scroll to zoom · return to overview"
            : "Drag to orbit · scroll to zoom · click a free seat"}
        </div>
      </div>
      <TrailerPlayer onTextureChange={onTextureChange} src={props.trailerUrl} />
    </section>
  );
}

function useSmallScreen(): boolean {
  const [small, setSmall] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 720px)");
    const update = () => setSmall(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return small;
}

export function AuditoriumLoadingFallback({ message = "Preparing the auditorium…" }: { message?: string }) {
  return <div aria-live="polite" className="canvas-fallback"><span className="loading-ring" />{message}</div>;
}

export function AuditoriumModel({
  inventory,
  selectedIds,
  videoAspect,
  videoTexture,
  onToggleSeat,
  selectionEnabled,
}: {
  inventory: SeatInventory;
  selectedIds: string[];
  videoAspect: number | null;
  videoTexture: VideoTexture | null;
  onToggleSeat: (seatId: string) => void;
  selectionEnabled: boolean;
}) {
  const layout = useMemo(() => {
    const rowGroups = new Map<string, Seat[]>();
    for (const seat of inventory.seats) {
      const row = rowGroups.get(seat.row) ?? [];
      row.push(seat);
      rowGroups.set(seat.row, row);
    }
    const rows = [...rowGroups.values()].map((seats) => ({
      seats,
      centerZ: seats[0].z,
      level: seats[0].y,
      width: Math.max(...seats.map((seat) => seat.x)) - Math.min(...seats.map((seat) => seat.x)) + 0.8,
    }));
    const minZ = Math.min(inventory.screen.center[2] - 1, ...inventory.seats.map((seat) => seat.z)) - 2;
    const maxZ = Math.max(...inventory.seats.map((seat) => seat.z)) + 1.5;
    const width = Math.max(...inventory.seats.map((seat) => Math.abs(seat.x))) * 2 + 3;
    const wallHeight = Math.max(
      inventory.screen.center[1] + inventory.screen.height / 2,
      ...inventory.seats.map((seat) => seat.y + seat.eyeHeight),
    ) + 1;
    const ceilingY = wallHeight + 0.6;
    return {
      rows,
      floorCenterZ: (minZ + maxZ) / 2,
      floorDepth: maxZ - minZ,
      floorWidth: Math.max(width, inventory.screen.width + 3),
      wallHeight,
      ceilingY,
    };
  }, [inventory]);
  return (
    <group>
      <mesh position={[0, -0.35, layout.floorCenterZ]} receiveShadow>
        <boxGeometry args={[layout.floorWidth, 0.5, layout.floorDepth]} />
        <meshStandardMaterial color="#171c27" roughness={0.92} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={`wall-${side}`} position={[side * (layout.floorWidth / 2 + 0.25), 0, layout.floorCenterZ]}>
          <mesh position={[0, layout.wallHeight / 2, 0]} receiveShadow>
            <boxGeometry args={[0.5, layout.wallHeight, layout.floorDepth]} />
            <meshStandardMaterial color="#111723" roughness={0.88} />
          </mesh>
          <mesh position={[-side * 0.24, 1.1, 0]}>
            <boxGeometry args={[0.06, 0.08, layout.floorDepth - 1]} />
            <meshBasicMaterial color="#34313a" />
          </mesh>
        </group>
      ))}
      <mesh position={[0, layout.ceilingY, layout.floorCenterZ]} receiveShadow>
        <boxGeometry args={[layout.floorWidth, 0.35, layout.floorDepth]} />
        <meshStandardMaterial color="#171820" roughness={0.82} />
      </mesh>
      {[-1, 1].flatMap((side) =>
        [-12, 0, 12].map((zOffset) => (
          <group key={`sconce-${side}-${zOffset}`} position={[side * (layout.floorWidth / 2 - 0.7), 3.2, layout.floorCenterZ + zOffset]}>
            <pointLight color="#d9b786" intensity={3} distance={10} decay={2} />
            <mesh>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshBasicMaterial color="#d9b786" />
            </mesh>
          </group>
        )),
      )}
      {layout.rows.map(({ seats, centerZ, level, width }) => (
        <mesh key={`riser-${seats[0].row}`} position={[0, level - 0.16, centerZ]} receiveShadow>
          <boxGeometry args={[width, 0.32, 1.5]} />
          <meshStandardMaterial color="#232a35" roughness={0.9} />
        </mesh>
      ))}
      <ScreenMesh inventory={inventory} videoAspect={videoAspect} videoTexture={videoTexture} />
      <SeatSelectionController enabled={selectionEnabled} onToggleSeat={onToggleSeat} seats={inventory.seats} selectedIds={selectedIds} />
    </group>
  );
}

export function ScreenMesh({
  inventory,
  videoAspect,
  videoTexture,
}: {
  inventory: SeatInventory;
  videoAspect: number | null;
  videoTexture: VideoTexture | null;
}) {
  const [screenX, screenY, screenZ] = inventory.screen.center;
  const screenWidth = inventory.screen.width;
  const screenHeight = inventory.screen.height;
  const videoSize = getVideoPlaneSize(inventory, videoAspect);
  const [videoWidth, videoHeight] = videoSize;
  const screenGeometry = useMemo(
    () => createCurvedScreenGeometry(screenWidth, screenHeight),
    [screenHeight, screenWidth],
  );
  const videoGeometry = useMemo(
    () => createCurvedScreenGeometry(videoWidth, videoHeight),
    [videoHeight, videoWidth],
  );
  const placeholderTexture = useMemo(
    () => videoTexture ? null : createTrailerPlaceholder(),
    [videoTexture],
  );
  useEffect(() => () => {
    screenGeometry.dispose();
    videoGeometry.dispose();
    placeholderTexture?.dispose();
  }, [placeholderTexture, screenGeometry, videoGeometry]);
  const texture = videoTexture ?? placeholderTexture;
  return (
    <group>
      <mesh geometry={screenGeometry} position={[screenX, screenY, screenZ]}>
        <meshBasicMaterial color="#05070c" side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={videoGeometry} position={[screenX, screenY, screenZ + 0.012]}>
        <meshBasicMaterial color="#ffffff" map={texture ?? undefined} side={DoubleSide} toneMapped={false} />
      </mesh>
      <ScreenFrame inventory={inventory} />
    </group>
  );
}

function createCurvedScreenGeometry(width: number, height: number): PlaneGeometry {
  const radius = 75;
  const geometry = new PlaneGeometry(width, height, 64, 1);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    positions.setZ(index, radius - Math.sqrt(radius ** 2 - x ** 2));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createTrailerPlaceholder(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 540;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create the cinema screen preview texture.");

  const background = context.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, "#111b2b");
  background.addColorStop(0.55, "#39434c");
  background.addColorStop(1, "#090d15");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(512, 285, 6, 512, 285, 420);
  glow.addColorStop(0, "rgba(241, 185, 106, 0.88)");
  glow.addColorStop(0.16, "rgba(154, 105, 73, 0.55)");
  glow.addColorStop(0.52, "rgba(56, 68, 80, 0.28)");
  glow.addColorStop(1, "rgba(9, 13, 21, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(255, 219, 164, 0.32)";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(512, 285, 230, 112, 0, 0, Math.PI * 2);
  context.stroke();
  context.textAlign = "center";
  context.fillStyle = "#fff1d8";
  context.font = "500 32px Georgia, serif";
  context.fillText("YOUR SEAT VIEW", 512, 455);
  context.fillStyle = "rgba(255, 241, 216, 0.7)";
  context.font = "500 15px Arial, sans-serif";
  context.fillText("AUTHORIZED TRAILER NOT CONFIGURED", 512, 487);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function ScreenFrame({ inventory }: { inventory: SeatInventory }) {
  const [x, y, z] = inventory.screen.center;
  const thickness = 0.14;
  const frameDepth = 0.08;
  return (
    <group>
      <mesh position={[x, y + inventory.screen.height / 2 + thickness / 2, z + 0.04]}>
        <boxGeometry args={[inventory.screen.width + thickness * 2, thickness, frameDepth]} />
        <meshStandardMaterial color="#34313a" metalness={0.38} roughness={0.46} />
      </mesh>
      <mesh position={[x, y - inventory.screen.height / 2 - thickness / 2, z + 0.04]}>
        <boxGeometry args={[inventory.screen.width + thickness * 2, thickness, frameDepth]} />
        <meshStandardMaterial color="#34313a" metalness={0.38} roughness={0.46} />
      </mesh>
      <mesh position={[x - inventory.screen.width / 2 - thickness / 2, y, z + 0.04]}>
        <boxGeometry args={[thickness, inventory.screen.height, frameDepth]} />
        <meshStandardMaterial color="#34313a" metalness={0.38} roughness={0.46} />
      </mesh>
      <mesh position={[x + inventory.screen.width / 2 + thickness / 2, y, z + 0.04]}>
        <boxGeometry args={[thickness, inventory.screen.height, frameDepth]} />
        <meshStandardMaterial color="#34313a" metalness={0.38} roughness={0.46} />
      </mesh>
    </group>
  );
}

function getVideoPlaneSize(inventory: SeatInventory, aspect: number | null): [number, number] {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) {
    return [inventory.screen.width, inventory.screen.height];
  }
  const screenAspect = inventory.screen.width / inventory.screen.height;
  return aspect > screenAspect
    ? [inventory.screen.width, inventory.screen.width / aspect]
    : [inventory.screen.height * aspect, inventory.screen.height];
}

function setCanvasCursor(event: ThreeEvent<PointerEvent>, cursor: string): void {
  const target = event.nativeEvent.currentTarget;
  if (target instanceof HTMLCanvasElement) target.style.cursor = cursor;
}

function setPerspectiveFov(camera: PerspectiveCamera, fov: number): void {
  const focalLength = camera.getFilmHeight() / (2 * Math.tan((fov * Math.PI) / 360));
  camera.setFocalLength(focalLength);
  camera.updateProjectionMatrix();
}

export function SeatSelectionController({
  seats,
  selectedIds,
  onToggleSeat,
  enabled = true,
}: {
  seats: Seat[];
  selectedIds: string[];
  onToggleSeat: (seatId: string) => void;
  enabled?: boolean;
}) {
  return (
    <>
      {seats.map((seat) => (
        <SeatMesh enabled={enabled} key={seat.id} onSelect={onToggleSeat} seat={seat} selected={selectedIds.includes(seat.id)} />
      ))}
    </>
  );
}

export const SeatMesh = memo(function SeatMesh({ seat, selected, onSelect, enabled }: { seat: Seat; selected: boolean; onSelect: (id: string) => void; enabled: boolean }) {
  const { gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const unavailable = seat.availability !== "available" && !selected;
  const color = selected
    ? "#e7b65f"
    : unavailable
      ? seat.availability === "held" ? "#8f7460" : "#4d5360"
      : seat.category === "lounger" ? "#9a7958" : "#557081";
  const lounger = seat.category === "lounger";
  useEffect(() => () => {
    gl.domElement.style.cursor = "grab";
  }, [gl]);
  return (
    <group position={[seat.x, seat.y, seat.z]}>
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(enabled);
          setCanvasCursor(event, !enabled ? "grab" : unavailable ? "not-allowed" : "pointer");
        }}
        onPointerOut={(event) => {
          setHovered(false);
          setCanvasCursor(event, "grab");
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (enabled && !unavailable && event.delta < 6) onSelect(seat.id);
        }}
        position={[0, 0.31, 0]}
      >
        <boxGeometry args={[lounger ? 0.72 : 0.55, 0.22, lounger ? 0.76 : 0.58]} />
        <meshStandardMaterial color={color} roughness={0.68} />
      </mesh>
      <mesh position={[0, lounger ? 0.76 : 0.72, 0.25]} rotation={[0.12, 0, 0]}>
        <boxGeometry args={[lounger ? 0.72 : 0.55, lounger ? 0.74 : 0.62, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.74} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (lounger ? 0.34 : 0.29), 0.48, 0.03]}>
          <boxGeometry args={[0.1, 0.16, lounger ? 0.72 : 0.57]} />
          <meshStandardMaterial color="#353a44" roughness={0.62} />
        </mesh>
      ))}
      <mesh position={[-0.2, 0.1, 0]} castShadow>
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color="#292e37" />
      </mesh>
      <mesh position={[0.2, 0.1, 0]} castShadow>
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshStandardMaterial color="#292e37" />
      </mesh>
      {hovered && (
        <Html center distanceFactor={13} position={[0, 1.25, 0]} style={{ pointerEvents: "none" }}>
          <span className="seat-hover-label">
            {seat.row}{String(seat.number).padStart(2, "0")} · {unavailable ? seat.availability : selected ? "selected" : "available"}
          </span>
        </Html>
      )}
    </group>
  );
});

function setCameraLookDirection(camera: PerspectiveCamera, yaw: number, pitch: number): void {
  const direction = getLookDirection(yaw, pitch);
  const target = new Vector3(
    camera.position.x + direction.x,
    camera.position.y + direction.y,
    camera.position.z + direction.z,
  );
  camera.lookAt(target);
}

export function FirstPersonLookControls({
  enabled,
  onLookDirectionChange,
}: {
  enabled: boolean;
  onLookDirectionChange: (direction: string) => void;
}) {
  const { camera, gl } = useThree();

  useEffect(() => {
    if (!enabled) return;
    onLookDirectionChange("facing the screen");
    const canvas = gl.domElement;
    const pitchLimit = 1.42;
    const sensitivity = 0.004;
    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let yaw = 0;
    let originYaw = 0;
    let pitch = 0;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || pointerId !== null) return;
      event.preventDefault();
      const direction = camera.getWorldDirection(new Vector3());
      ({ yaw, pitch } = getLookAngles(direction));
      originYaw = yaw;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      yaw += deltaX * sensitivity;
      pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch + deltaY * sensitivity));
      if (camera instanceof PerspectiveCamera) setCameraLookDirection(camera, yaw, pitch);
    };

    const finishPointer = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      pointerId = null;
      canvas.style.cursor = "grab";
      const offset = ((yaw - originYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const direction = Math.abs(offset) < 0.35
        ? "facing the screen"
        : Math.abs(offset) > 2.35
          ? "looking behind you"
          : offset > 0
            ? "looking right"
            : "looking left";
      onLookDirectionChange(direction);
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (!(camera instanceof PerspectiveCamera)) return;
      setPerspectiveFov(camera, Math.max(52, Math.min(100, camera.fov + Math.sign(event.deltaY) * 2.5)));
    };

    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", finishPointer);
    canvas.addEventListener("pointercancel", finishPointer);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", finishPointer);
      canvas.removeEventListener("pointercancel", finishPointer);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.style.cursor = "grab";
    };
  }, [camera, enabled, gl, onLookDirectionChange]);

  return null;
}

export function SeatViewCamera({
  controls,
  previewSeat,
  screenCenter,
}: {
  controls: React.RefObject<OrbitControlsImpl | null>;
  previewSeat: Seat | null;
  screenCenter: readonly [number, number, number];
}) {
  return <CameraTransition controls={controls} previewSeat={previewSeat} screenCenter={screenCenter} />;
}

export function CameraTransition({
  controls,
  previewSeat,
  screenCenter,
}: {
  controls: React.RefObject<OrbitControlsImpl | null>;
  previewSeat: Seat | null;
  screenCenter: readonly [number, number, number];
}) {
  const { camera } = useThree();
  const transition = useRef<{
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    targetFov: number;
    progress: number;
  } | null>(null);
  const goal = useMemo(() => {
    if (previewSeat) {
      const pose = getSeatCameraPose(previewSeat, screenCenter);
      return {
        position: [pose.position.x, pose.position.y, pose.position.z] as [number, number, number],
        target: [pose.target.x, pose.target.y, pose.target.z] as [number, number, number],
        fov: 68,
      };
    }
    return { position: [0, 19, 44] as [number, number, number], target: [0, 5, -2] as [number, number, number], fov: 43 };
  }, [previewSeat, screenCenter]);

  useEffect(() => {
    const start = camera.position.toArray() as [number, number, number];
    const perspectiveCamera = camera instanceof PerspectiveCamera ? camera : null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      camera.position.set(...goal.position);
      camera.lookAt(...goal.target);
      if (perspectiveCamera) {
        setPerspectiveFov(perspectiveCamera, goal.fov);
      }
      controls.current?.target.set(...goal.target);
      if (!previewSeat) controls.current?.update();
      return;
    }
    const startTarget = controls.current?.target.toArray()
      ?? camera.position.clone().addScaledVector(camera.getWorldDirection(new Vector3()), 10).toArray() as [number, number, number];
    transition.current = {
      position: start,
      target: startTarget,
      fov: perspectiveCamera?.fov ?? goal.fov,
      targetFov: goal.fov,
      progress: 0,
    };
  }, [camera, controls, goal, previewSeat]);

  useFrame((_, delta) => {
    const current = transition.current;
    if (!current) return;
    current.progress = Math.min(1, current.progress + delta / 0.8);
    const eased = current.progress * current.progress * (3 - 2 * current.progress);
    camera.position.set(
      current.position[0] + (goal.position[0] - current.position[0]) * eased,
      current.position[1] + (goal.position[1] - current.position[1]) * eased,
      current.position[2] + (goal.position[2] - current.position[2]) * eased,
    );
    const targetX = current.target[0] + (goal.target[0] - current.target[0]) * eased;
    const targetY = current.target[1] + (goal.target[1] - current.target[1]) * eased;
    const targetZ = current.target[2] + (goal.target[2] - current.target[2]) * eased;
    controls.current?.target.set(targetX, targetY, targetZ);
    camera.lookAt(targetX, targetY, targetZ);
    if (camera instanceof PerspectiveCamera) {
      setPerspectiveFov(camera, current.fov + (current.targetFov - current.fov) * eased);
    }
    if (!previewSeat) controls.current?.update();
    if (current.progress >= 1) transition.current = null;
  });

  return null;
}

export { AuditoriumCanvas };

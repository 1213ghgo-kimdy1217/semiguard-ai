import * as THREE from "three";
import type { ProcessId } from "@shared/processScenarios";
import type { StageState } from "./studio-types";
import { local } from "./studio-i18n";

type MonitorProcess = Exclude<ProcessId, "oxidation">;

type Placement = {
  position: [number, number, number];
  width: number;
  mount: "stand" | "cabinet";
  yaw: number;
  tilt: number;
  accent: number;
};

// Each console sits behind its inspection subject. The EDS screen mounts
// against the tester cabinet instead of adding a second floor stand.
const placements: Record<MonitorProcess, Placement> = {
  wafer: { position: [2.55, 1.9, -.54], width: 1.68, mount: "stand", yaw: .16, tilt: -.14, accent: 0x71c8d1 },
  photo: { position: [2.25, 2.3, -1.47], width: 2.17, mount: "stand", yaw: .16, tilt: -.1, accent: 0xae97dc },
  etch: { position: [2.08, 2.36, -1.48], width: 2.26, mount: "stand", yaw: .17, tilt: -.14, accent: 0xe1b379 },
  deposition: { position: [2, 1.9, -1.05], width: 2.4, mount: "stand", yaw: .25, tilt: -.24, accent: 0x76cdbd },
  metal: { position: [1.42, 1.75, -.92], width: 2.4, mount: "stand", yaw: .22, tilt: -.24, accent: 0xd9b16c },
  eds: { position: [1.92, 2.13, -.27], width: 1.65, mount: "cabinet", yaw: .13, tilt: -.3, accent: 0x74c9aa },
  packaging: { position: [2, 1.9, -.85], width: 2.4, mount: "stand", yaw: .25, tilt: -.24, accent: 0xe4ba73 },
};

const copy = {
  title: ["가상 검사 기록", "Virtual inspection records", "仮想検査記録"],
  observed: ["관측값", "Observed", "観測値"],
  reference: ["선택한 참고값", "Selected reference", "選択した参考値"],
  indices: ["교육용 검사 지수", "Educational inspection indices", "教育用の検査指数"],
  waiting: ["검사 기록 대기", "Awaiting inspection records", "検査記録を待っています"],
  hint: ["관찰 단계에서 기록을 비교해요.", "Compare records during observation.", "観察の段階で記録を比較します。"],
} as const;

const displayWidth = 960;
const displayHeight = 560;
const numberText = (value: number | undefined) =>
  value !== undefined && Number.isFinite(value) ? value.toFixed(1) : "—";

export function createInspectionMonitor(process: MonitorProcess) {
  const placement = placements[process];
  const root = new THREE.Group();
  root.name = "inspection-monitor";
  root.position.set(placement.position[0], 0, placement.position[2]);
  root.rotation.y = placement.yaw;

  const screen = new THREE.Group();
  screen.name = "inspection-monitor-housing";
  screen.position.y = placement.position[1];
  screen.rotation.x = placement.tilt;
  root.add(screen);

  const housing = new THREE.MeshStandardMaterial({ color: 0x17272c, metalness: .54, roughness: .44 });
  const bracket = new THREE.MeshStandardMaterial({ color: 0x73898b, metalness: .66, roughness: .31 });
  const indicator = new THREE.MeshBasicMaterial({ color: placement.accent });

  function box(
    dimensions: [number, number, number],
    position: [number, number, number],
    material: THREE.Material,
    parent: THREE.Object3D,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
    mesh.position.set(...position);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const width = placement.width;
  const height = width * displayHeight / displayWidth;
  box([width + .13, height + .134, .19], [0, -.013, 0], housing, screen);
  box([width + .11, .026, .2], [0, height / 2 + .067, 0], bracket, screen);
  box([.23, .023, .015], [width / 2 - .13, -height / 2 - .046, .101], indicator, screen);
  if (placement.mount === "cabinet") {
    box([.43, .31, .39], [0, placement.position[1] - .08, -.25], bracket, root);
  } else {
    const pedestalHeight = placement.position[1] - .19;
    box([.15, pedestalHeight, .14], [0, pedestalHeight / 2, -.17], bracket, root);
    box([.47, .11, .29], [0, placement.position[1] - .27, -.13], housing, root);
    box([.86, .08, .54], [0, .04, -.15], housing, root);
  }

  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  if (canvas) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  const context = canvas?.getContext("2d");
  const texture = context && canvas ? new THREE.CanvasTexture(canvas) : null;
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ color: texture ? 0xffffff : 0x0a1e25, map: texture, toneMapped: false }),
  );
  face.name = "inspection-monitor-display";
  face.position.z = .101;
  screen.add(face);

  const accent = `#${placement.accent.toString(16).padStart(6, "0")}`;
  let previousDisplay = "";

  function update(state: StageState) {
    if (!context || !texture || !root.visible || state.process !== process) return;
    for (let parent = root.parent; parent; parent = parent.parent) {
      if (!parent.visible) return;
    }
    const language = state.language;
    const mayShowReadings = state.phase === "observe" || state.phase === "decide" || state.phase === "review";
    const current = mayShowReadings && state.currentReading?.processId === process ? state.currentReading : undefined;
    const reference = state.referenceReading?.processId === process ? state.referenceReading : undefined;
    const rows = current?.channels.map(channel => ({
      name: local(channel.name, language),
      observed: numberText(channel.value),
      reference: numberText(reference?.channels.find(item => item.id === channel.id)?.reference),
    })) ?? [];

    const display = JSON.stringify([language, rows]);
    if (display === previousDisplay) return;
    previousDisplay = display;

    const label = (value: string, x: number, y: number, size: number, color: string, maxWidth: number) => {
      context.fillStyle = color;
      context.font = `600 ${size}px Arial, sans-serif`;
      context.fillText(value, x, y, maxWidth);
    };
    context.fillStyle = "#081c24";
    context.fillRect(0, 0, displayWidth, displayHeight);
    context.fillStyle = accent;
    context.fillRect(0, 0, displayWidth, 8);
    label(local(copy.title, language), 34, 60, 34, accent, 892);

    if (!rows.length) {
      label(local(copy.waiting, language), 34, 255, 52, "#e4f0ef", 892);
      label(local(copy.hint, language), 34, 330, 34, "#a6bdc5", 892);
    } else {
      const cardWidth = 434;
      const compact = rows.length > 2;
      const cardHeight = compact ? 188 : 350;
      const titleOffset = compact ? 48 : 77;
      const legendOffset = compact ? 103 : 157;
      const valueOffset = compact ? 165 : 250;
      const valueSize = compact ? 56 : 77;
      rows.forEach((row, index) => {
        const x = 34 + (index % 2) * 458;
        const y = 90 + Math.floor(index / 2) * 204;
        context.fillStyle = "#15323b";
        context.fillRect(x, y, cardWidth, cardHeight);
        label(row.name, x + 18, y + titleOffset, 32, "#e4f0ef", 398);
        label(local(copy.observed, language), x + 18, y + legendOffset, 25, "#a1d9d2", 180);
        label(local(copy.reference, language), x + 220, y + legendOffset, 25, "#a6bdc5", 196);
        label(row.observed, x + 18, y + valueOffset, valueSize, "#d1fff3", 180);
        label(row.reference, x + 220, y + valueOffset, valueSize, "#d3e2e8", 196);
      });
    }
    label(local(copy.indices, language), 34, 535, 27, "#a6bdc5", 892);
    texture.needsUpdate = true;
  }

  return { root, update };
}

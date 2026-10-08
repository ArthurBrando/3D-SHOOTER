
import * as THREE from "three";

const $ = (id) => document.getElementById(id);

const host = $("canvasHost");
const viewport = $("viewport");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090d0b);

const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
host.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xc9ffdc, 0x17251b, 2));

const light = new THREE.DirectionalLight(0xffffff, 1.7);
light.position.set(3, 7, 4);
scene.add(light);

const grid = new THREE.GridHelper(40, 40, 0x28543a, 0x15271c);
grid.position.y = -0.015;
scene.add(grid);

const surfaces = {
  floor: null,
  ceiling: null,
  front: null,
  back: null,
  left: null,
  right: null
};

const imageNames = {
  floor: "name-floor",
  ceiling: "name-ceiling",
  front: "name-front",
  back: "name-back",
  left: "name-left",
  right: "name-right"
};

let room = new THREE.Group();
scene.add(room);

let width = 4;
let depth = 5;
let height = 2.8;
let walking = false;
let yaw = 0;
let pitch = 0;
let dragging = false;
let previousX = 0;
let previousY = 0;
let moveX = 0;
let moveZ = 0;
let toastTimer;

const keys = new Set();
const textureLoader = new THREE.TextureLoader();

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function readDimensions() {
  const w = Number($("roomWidth").value);
  const d = Number($("roomDepth").value);
  const h = Number($("roomHeight").value);

  if (![w, d, h].every(Number.isFinite) ||
      w < 2 || w > 30 || d < 2 || d > 30 || h < 2 || h > 8) {
    notify("Use width/depth from 2–30 m and height from 2–8 m.");
    return false;
  }

  width = w;
  depth = d;
  height = h;
  return true;
}

function makeSurface(key, w, h, x, y, z, rx, ry, rz) {
  const geometry = new THREE.PlaneGeometry(w, h);
  const texture = surfaces[key];

  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  }

  const material = new THREE.MeshStandardMaterial({
    color: texture ? 0xffffff : 0x26372c,
    map: texture,
    side: THREE.DoubleSide,
    roughness: 0.92,
    metalness: 0
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  room.add(mesh);
}

function buildRoom(resetCamera = false) {
  while (room.children.length) {
    const object = room.children[0];
    room.remove(object);
    object.geometry?.dispose();
    if (object.material) object.material.dispose();
  }

  // Room interior: floor is y=0, ceiling is y=height.
  makeSurface("floor", width, depth, 0, 0, 0, -Math.PI / 2, 0, 0);
  makeSurface("ceiling", width, depth, 0, height, 0, Math.PI / 2, 0, 0);

  makeSurface("front", width, height, 0, height / 2, -depth / 2, 0, 0, 0);
  makeSurface("back", width, height, 0, height / 2, depth / 2, 0, Math.PI, 0);

  makeSurface("left", depth, height, -width / 2, height / 2, 0, 0, Math.PI / 2, 0);
  makeSurface("right", depth, height, width / 2, height / 2, 0, -Math.PI / 2, 0);

  if (resetCamera) {
    walking = false;
    $("walkBtn").textContent = "FIRST PERSON";
    $("crosshair").style.display = "none";
    camera.position.set(0, height * 0.72, depth / 2 + Math.max(width, depth) * 0.9);
    camera.lookAt(0, height / 2, 0);
  }

  updateStatus("ENVIRONMENT READY");
}

function updateStatus(text) {
  $("viewStatus").textContent = text;
}

function loadPhoto(key, file) {
  if (!file || !file.type.startsWith("image/")) {
    notify("Please select a valid image.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    textureLoader.load(
      reader.result,
      (texture) => {
        const old = surfaces[key];
        surfaces[key] = texture;
        if (old) old.dispose();

        const name = $(imageNames[key]);
        name.textContent = file.name;
        name.parentElement.classList.add("has-photo");

        buildRoom(false);
        notify("Surface texture loaded successfully.");
      },
      undefined,
      () => notify("Could not load this image.")
    );
  };

  reader.onerror = () => notify("Could not read this file.");
  reader.readAsDataURL(file);
}

document.querySelectorAll("[data-surface]").forEach((input) => {
  input.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) loadPhoto(input.dataset.surface, file);
    input.value = "";
  });
});

$("buildBtn").addEventListener("click", () => {
  if (!readDimensions()) return;
  buildRoom(true);
  notify("3D environment generated.");
});

$("applyBtn").addEventListener("click", () => {
  if (!readDimensions()) return;
  buildRoom(false);
  notify("Dimensions updated.");
});

$("resetBtn").addEventListener("click", () => {
  buildRoom(true);
  notify("Camera position reset.");
});

$("walkBtn").addEventListener("click", () => {
  walking = !walking;

  if (walking) {
    camera.position.set(0, Math.min(1.65, height - 0.2), depth / 2 - 0.5);
    yaw = Math.PI;
    pitch = 0;
    camera.rotation.order = "YXZ";
    camera.rotation.set(0, yaw, 0);
    $("walkBtn").textContent = "EXIT FIRST PERSON";
    $("crosshair").style.display = "block";
    $("viewMode").textContent = "FIRST PERSON";
    updateStatus("WALK MODE ACTIVE");
    notify("Drag the right side to look. Use the left side to move.");
  } else {
    $("walkBtn").textContent = "FIRST PERSON";
    $("crosshair").style.display = "none";
    $("viewMode").textContent = "3D ENVIRONMENT";
    buildRoom(true);
  }
});

$("arBtn").addEventListener("click", async () => {
  if (!navigator.xr) {
    notify("WebXR is unavailable in this browser. AR is not enabled in this prototype.");
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-ar");
    notify(supported
      ? "AR is supported on this device. Spatial placement will be added in the next stage."
      : "This browser/device does not support immersive AR.");
  } catch {
    notify("Could not verify AR support.");
  }
});

// Desktop keyboard controls.
window.addEventListener("keydown", (event) => {
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight"].includes(event.code)) {
    keys.add(event.code);
    if (walking) event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("blur", () => keys.clear());

// Drag to look. In first-person mode, the left side also moves the player.
viewport.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button, input, label")) return;
  dragging = true;
  previousX = event.clientX;
  previousY = event.clientY;
  viewport.setPointerCapture?.(event.pointerId);
});

viewport.addEventListener("pointermove", (event) => {
  if (!dragging) return;

  const dx = event.clientX - previousX;
  const dy = event.clientY - previousY;
  previousX = event.clientX;
  previousY = event.clientY;

  if (walking) {
    if (event.clientX > window.innerWidth * 0.42) {
      yaw -= dx * 0.004;
      pitch = THREE.MathUtils.clamp(pitch - dy * 0.004, -1.45, 1.45);
      camera.rotation.order = "YXZ";
      camera.rotation.set(pitch, yaw, 0);
    } else {
      moveX = THREE.MathUtils.clamp(dx / 30, -1, 1);
      moveZ = THREE.MathUtils.clamp(dy / 30, -1, 1);
    }
  } else {
    camera.position.x -= dx * 0.006;
    camera.position.y += dy * 0.006;
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.2, height * 2.5);
    camera.lookAt(0, height / 2, 0);
  }
});

function stopDrag() {
  dragging = false;
  moveX = 0;
  moveZ = 0;
}

viewport.addEventListener("pointerup", stopDrag);
viewport.addEventListener("pointercancel", stopDrag);
viewport.addEventListener("lostpointercapture", stopDrag);

function updateMovement(delta) {
  if (!walking) return;

  const forward =
    (keys.has("KeyW") ? 1 : 0) -
    (keys.has("KeyS") ? 1 : 0) + -moveZ;

  const side =
    (keys.has("KeyD") ? 1 : 0) -
    (keys.has("KeyA") ? 1 : 0) + moveX;

  const speed = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? 4.5 : 2.3) * delta;

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();

  const right = new THREE.Vector3().crossVectors(direction, camera.up).normalize();

  camera.position.addScaledVector(direction, forward * speed);
  camera.position.addScaledVector(right, side * speed);

  // Keep the player inside the room and above the floor.
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -width / 2 + 0.22, width / 2 - 0.22);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -depth / 2 + 0.22, depth / 2 - 0.22);
  camera.position.y = Math.min(1.65, height - 0.2);
}

function resize() {
  const w = host.clientWidth || 1;
  const h = host.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);

let previousTime = 0;

function animate(time) {
  requestAnimationFrame(animate);
  const delta = Math.min((time - previousTime) / 1000 || 0, 0.05);
  previousTime = time;

  updateMovement(delta);
  renderer.render(scene, camera);
}

buildRoom(true);
resize();
requestAnimationFrame(animate);

$("loading").style.display = "none";
updateStatus("ENGINE READY");

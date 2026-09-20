// The Kiwi watch, small. Same model as the v2 hero (js/scene.js) without the stage around it:
// it turns with the pointer, and a tap drops it so the face can show what a detected fall looks like.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const TAU = Math.PI * 2;

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
function shapeGeo(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 24);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}
function strapGeo(width, thick, A, B, y0) {
  const g = new THREE.BoxGeometry(width, 1, thick, 8, 96, 1);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position, f0 = Math.asin(y0 / A), f1 = Math.PI * 1.003;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), k = p.getY(i), z = p.getZ(i), f = f0 + (f1 - f0) * k;
    let ny = Math.sin(f) / A, nz = Math.cos(f) / B; const nl = Math.hypot(ny, nz); ny /= nl; nz /= nl;
    const taper = 1 - 0.2 * Math.min(1, k * 3);
    p.setXYZ(i, x * taper, A * Math.sin(f) + ny * z, -B + B * Math.cos(f) + nz * z);
  }
  g.computeVertexNormals();
  return g;
}

export function createWatch(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  // the canvas is 1.8 times the button it sits on (journey.css), so the view is 1.8 times wider at the same distance:
  // the watch keeps its size and perspective, and the strap has room to swing through a full tumble without being cut
  const camera = new THREE.PerspectiveCamera(51.5, 0.8, 0.1, 40);
  camera.position.set(0, 0, 7.4);
  const key = new THREE.DirectionalLight('#fff4e6', 2.6); key.position.set(4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#7b93f5', 3.4); rim.position.set(-6, 2, -4); scene.add(rim);

  const watch = new THREE.Group(); scene.add(watch);
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: '#2a2c31', metalness: 1, roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  watch.add(new THREE.Mesh(new RoundedBoxGeometry(1.74, 2.06, 0.5, 10, 0.34), bodyMat));
  const bezel = new THREE.Mesh(shapeGeo(1.6, 1.92, 0.3), new THREE.MeshStandardMaterial({ color: '#020203', roughness: 0.35, metalness: 0.2 }));
  bezel.position.z = 0.2515; watch.add(bezel);

  const SW = 512, SH = 640, scr = document.createElement('canvas'); scr.width = SW; scr.height = SH;
  const c = scr.getContext('2d'), screenTex = new THREE.CanvasTexture(scr);
  screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 8;
  const screen = new THREE.Mesh(shapeGeo(1.4, 1.75, 0.22), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.z = 0.2535; watch.add(screen);
  const glass = new THREE.Mesh(shapeGeo(1.6, 1.92, 0.3), new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.035, clearcoat: 1, envMapIntensity: 1.2 }));
  glass.position.z = 0.257; watch.add(glass);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 40), bodyMat); crown.rotation.z = Math.PI / 2; crown.position.set(0.93, 0.38, 0); watch.add(crown);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 12, 40), new THREE.MeshStandardMaterial({ color: '#7b93f5', emissive: '#7b93f5', emissiveIntensity: 0.6, roughness: 0.4 }));
  ring.rotation.y = Math.PI / 2; ring.position.set(1.012, 0.38, 0); watch.add(ring);
  const btn = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.5, 0.17, 4, 0.03), bodyMat); btn.position.set(0.885, -0.32, 0); watch.add(btn);
  const strapMat = new THREE.MeshPhysicalMaterial({ color: '#15171c', roughness: 0.72, metalness: 0, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#5b6270') });
  const sg = strapGeo(1.2, 0.12, 1.72, 1.12, 0.9);
  const strapTop = new THREE.Mesh(sg, strapMat); strapTop.position.z = -0.06; watch.add(strapTop);
  const strapBot = new THREE.Mesh(sg, strapMat); strapBot.rotation.z = Math.PI; strapBot.position.z = -0.06; watch.add(strapBot);

  const FONT = '"Source Sans 3", system-ui, sans-serif';
  let face = 'idle', faceT = 0, bpm = 72, sig = 0;
  function drawFace(now) {
    c.clearRect(0, 0, SW, SH);
    if (face === 'idle') {
      c.fillStyle = '#000'; c.fillRect(0, 0, SW, SH);
      c.fillStyle = '#8b93a3'; c.font = `600 26px ${FONT}`; c.textAlign = 'left'; c.fillText('KIWI', 44, 70);
      c.textAlign = 'right'; c.fillText('84%', SW - 44, 70);
      const d = new Date(), hh = d.getHours() % 12 || 12, mm = String(d.getMinutes()).padStart(2, '0');
      c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = `600 168px ${FONT}`; c.fillText(`${hh}:${mm}`, 38, 232);
      c.fillStyle = '#5ff2b6'; c.font = `600 84px ${FONT}`; c.fillText(String(Math.round(bpm)), 44, 368);
      c.fillStyle = '#8b93a3'; c.font = `600 26px ${FONT}`; c.fillText('BPM', 170, 368);
      c.strokeStyle = '#5ff2b6'; c.lineWidth = 5; c.lineJoin = 'round'; c.beginPath();
      for (let i = 0; i < 160; i++) {
        const t = sig + i * 0.045, v = Math.sin(t * 1.4) * 0.1 + Math.pow(Math.max(0, Math.sin(t * 1.9)), 26) * 0.55;
        const x = 40 + i / 159 * (SW - 80), y = 470 - v * 110; i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      c.fillStyle = '#5ff2b6'; c.beginPath(); c.arc(52, 566, 8, 0, TAU); c.fill();
      c.fillStyle = '#c9cfdb'; c.font = `500 27px ${FONT}`; c.fillText('Fall detection on', 74, 576);
    } else if (face === 'alert') {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.012);
      c.fillStyle = `rgb(${Math.round(176 + 34 * pulse)},${Math.round(20 + 12 * pulse)},18)`; c.fillRect(0, 0, SW, SH);
      c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = `700 96px ${FONT}`; c.fillText('Fall', 40, 168); c.fillText('detected', 40, 262);
      const left = Math.max(0, 5 - faceT), cx = SW / 2, cy = 440;
      c.lineWidth = 14; c.strokeStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(cx, cy, 78, 0, TAU); c.stroke();
      c.strokeStyle = '#fff'; c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy, 78, -Math.PI / 2, -Math.PI / 2 + TAU * (left / 5)); c.stroke();
      c.textAlign = 'center'; c.font = `700 74px ${FONT}`; c.fillText(String(Math.ceil(left)), cx, cy + 26);
      c.font = `500 27px ${FONT}`; c.fillText('Calling caregiver', cx, 586);
    } else {
      c.fillStyle = '#03130c'; c.fillRect(0, 0, SW, SH);
      c.strokeStyle = '#5ff2b6'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.arc(SW / 2, 250, 104, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(SW / 2 - 46, 252); c.lineTo(SW / 2 - 10, 290); c.lineTo(SW / 2 + 52, 214); c.stroke();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = `600 46px ${FONT}`; c.fillText('Caregiver notified', SW / 2, 452);
    }
    screenTex.needsUpdate = true;
  }

  let W = 0, H = 0, px = 0, py = 0, sx = 0, sy = 0, clock = performance.now();
  let tumble = 0, drop = 0, vy = 0, spin = 0;
  function render(now) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (w !== W || h !== H) { W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const dt = Math.min(0.05, (now - clock) / 1000); clock = now;
    sig += dt * 2.7; faceT += dt;
    bpm += ((face === 'idle' ? 72 : 118) - bpm) * dt * 1.5;
    sx += (px - sx) * Math.min(1, dt * 5); sy += (py - sy) * Math.min(1, dt * 5);
    if (face === 'alert' && faceT > 5) { face = 'ok'; faceT = 0; }
    if (face === 'ok' && faceT > 1.8) { face = 'idle'; }
    // the drop: fall, one bounce, and a tumble that winds back to rest
    vy -= 26 * dt; drop += vy * dt;
    if (drop < -0.55) { drop = -0.55; vy = Math.abs(vy) > 1.2 ? -vy * 0.32 : 0; }
    if (face === 'idle') drop += (0 - drop) * Math.min(1, dt * 4), vy = drop > -0.01 ? 0 : vy;
    spin *= Math.pow(0.04, dt); tumble += spin * dt; tumble += (Math.round(tumble / TAU) * TAU - tumble) * Math.min(1, dt * 3);
    const tt = now * 0.001;
    watch.position.y = drop + Math.sin(tt * 0.9) * 0.05;
    watch.rotation.set(0.1 + Math.sin(tt * 0.7) * 0.04 + sy * 0.35 + tumble, -0.5 + Math.sin(tt * 0.5) * 0.1 + sx * 0.7, 0.06 - sx * 0.06);
    drawFace(now);
    renderer.render(scene, camera);
  }
  return {
    render,
    pointer(x, y) { px = x; py = y; },
    fall() { if (face !== 'idle') return; face = 'alert'; faceT = 0; vy = 2.2; spin = -13; },
  };
}

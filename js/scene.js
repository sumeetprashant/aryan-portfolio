import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BG = new THREE.Color('#06070a');
const BG_ALERT = new THREE.Color('#1c0504');
const RED = new THREE.Color('#ff3b2f');
const ICE = new THREE.Color('#cfe0ff');
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
  const len = 1, g = new THREE.BoxGeometry(width, len, thick, 8, 96, 1);
  g.translate(0, len / 2, 0);
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

export function createScene(canvas, hooks = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = BG.clone();
  scene.fog = new THREE.Fog(BG.clone(), 10, 22);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, 10);

  const key = new THREE.DirectionalLight('#fff1e0', 2.6); key.position.set(4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight('#7fa8ff', 3.2); rim.position.set(-6, 2, -4); scene.add(rim);
  const under = new THREE.PointLight('#ff3b2f', 0, 12, 1.6); under.position.set(0, -1.6, 2.5); scene.add(under);

  /* ---------------- the watch ---------------- */
  const watch = new THREE.Group(); scene.add(watch);
  const S = 0.8; watch.scale.setScalar(S);
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: '#2a2c31', metalness: 1, roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.74, 2.06, 0.5, 10, 0.34), bodyMat); watch.add(body);
  const bezel = new THREE.Mesh(shapeGeo(1.6, 1.92, 0.3), new THREE.MeshStandardMaterial({ color: '#020203', roughness: 0.35, metalness: 0.2 }));
  bezel.position.z = 0.2515; watch.add(bezel);

  const SW = 512, SH = 640, scr = document.createElement('canvas'); scr.width = SW; scr.height = SH;
  const sx = scr.getContext('2d'), screenTex = new THREE.CanvasTexture(scr);
  screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 8;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  const screen = new THREE.Mesh(shapeGeo(1.4, 1.75, 0.22), screenMat); screen.position.z = 0.2535; watch.add(screen);
  const glass = new THREE.Mesh(shapeGeo(1.6, 1.92, 0.3), new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.02, transparent: true, opacity: 0.035, clearcoat: 1, envMapIntensity: 1.2 }));
  glass.position.z = 0.257; watch.add(glass);

  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 40), bodyMat); crown.rotation.z = Math.PI / 2; crown.position.set(0.93, 0.38, 0); watch.add(crown);
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 12, 40), new THREE.MeshStandardMaterial({ color: '#ff3b2f', emissive: '#ff3b2f', emissiveIntensity: 0.6, roughness: 0.4 }));
  crownRing.rotation.y = Math.PI / 2; crownRing.position.set(1.012, 0.38, 0); watch.add(crownRing);
  const btn = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.5, 0.17, 4, 0.03), bodyMat); btn.position.set(0.885, -0.32, 0); watch.add(btn);
  const sensor = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.08, 48), new THREE.MeshPhysicalMaterial({ color: '#0a0b0d', roughness: 0.15, metalness: 0.3, clearcoat: 1 }));
  sensor.rotation.x = Math.PI / 2; sensor.position.z = -0.28; watch.add(sensor);

  const EA = 1.72, EB = 1.12, strapMat = new THREE.MeshPhysicalMaterial({ color: '#101114', roughness: 0.72, metalness: 0, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#5b6270') });
  const sg = strapGeo(1.2, 0.12, EA, EB, 0.9);
  const strapTop = new THREE.Mesh(sg, strapMat); strapTop.position.z = -0.06; watch.add(strapTop);
  const strapBot = new THREE.Mesh(sg, strapMat); strapBot.rotation.z = Math.PI; strapBot.position.z = -0.06; watch.add(strapBot);

  /* ---------------- depth: back glow + dust ---------------- */
  const glC = document.createElement('canvas'); glC.width = glC.height = 256; const glx = glC.getContext('2d');
  const gg = glx.createRadialGradient(128, 128, 0, 128, 128, 128); gg.addColorStop(0, 'rgba(255,255,255,.55)'); gg.addColorStop(0.35, 'rgba(255,255,255,.16)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
  glx.fillStyle = gg; glx.fillRect(0, 0, 256, 256);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glC), color: '#2b4a9c', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  glow.position.z = -6; scene.add(glow);
  const DUST = 260, dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dp[i * 3] = (Math.random() - 0.5) * 22; dp[i * 3 + 1] = (Math.random() - 0.5) * 12; dp[i * 3 + 2] = -7 + Math.random() * 12; }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustG, new THREE.PointsMaterial({ color: '#9fb6e8', size: 0.028, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  scene.add(dust);

  /* ---------------- floor shadow + alert rings ---------------- */
  const FLOOR = -2.3;
  const shC = document.createElement('canvas'); shC.width = shC.height = 256; const shx = shC.getContext('2d');
  const grd = shx.createRadialGradient(128, 128, 0, 128, 128, 128); grd.addColorStop(0, 'rgba(0,0,0,.9)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  shx.fillStyle = grd; shx.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shC), transparent: true, opacity: 0, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = FLOOR; scene.add(shadow);
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.y = FLOOR + 0.01; m.userData.t = -1; scene.add(m); rings.push(m);
  }

  /* ---------------- live signal ribbons ---------------- */
  const N = 420, bufs = [0, 1, 2].map(() => new Float32Array(N)), imp = [0, 0, 0], lines = [];
  for (let a = 0; a < 3; a++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3));
    const col = new Float32Array(N * 2 * 3), idx = [];
    for (let i = 0; i < N; i++) { const u = i / (N - 1), e = Math.max(0, Math.min(1, (u - 0.44) / 0.3)), f = e * e * (3 - 2 * e) * (u > 0.97 ? (1 - u) / 0.03 : 1); col.fill(f, i * 6, i * 6 + 6); if (i < N - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ color: ICE.clone(), vertexColors: true, transparent: true, opacity: [0.2, 0.3, 0.85][a], blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const l = new THREE.Mesh(g, m); l.position.set(0, [1.7, 0.55, -0.85][a], [-5, -4, -3][a]); l.frustumCulled = false; l.userData.th = [0.012, 0.014, 0.02][a]; scene.add(l); lines.push(l);
  }
  let sigT = 0, owed = 0;
  function sample() {
    sigT += 0.045;
    const beat = Math.pow(Math.max(0, Math.sin(sigT * 1.9)), 26) * 0.55;
    for (let a = 0; a < 3; a++) {
      imp[a] *= 0.86;
      const v = Math.sin(sigT * (1 + a * 0.37) + a * 2.1) * 0.12 + Math.sin(sigT * 3.1 + a) * 0.04 + (Math.random() - 0.5) * 0.014 + (a === 2 ? beat : 0) + imp[a];
      bufs[a].copyWithin(0, 1); bufs[a][N - 1] = v;
    }
  }
  for (let i = 0; i < N; i++) sample();

  /* ---------------- watch face ---------------- */
  let face = 'idle', faceT = 0, bpm = 72, fontReady = false, peakG = 4.8;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fontReady = true; });
  const DISPLAY = () => (fontReady ? '"Bricolage Display"' : 'system-ui') + ',sans-serif';
  function drawFace(now) {
    const c = sx; c.clearRect(0, 0, SW, SH);
    if (face === 'idle') {
      c.fillStyle = '#000'; c.fillRect(0, 0, SW, SH);
      c.fillStyle = '#8b93a3'; c.font = '500 26px ' + DISPLAY(); c.textAlign = 'left'; c.fillText('KIWI', 44, 70);
      c.textAlign = 'right'; c.fillText('84%', SW - 44, 70);
      const d = new Date(), hh = d.getHours() % 12 || 12, mm = ('0' + d.getMinutes()).slice(-2);
      c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '600 168px ' + DISPLAY(); c.fillText(hh + ':' + mm, 38, 232);
      c.fillStyle = '#5ff2b6'; c.font = '600 84px ' + DISPLAY(); c.fillText(String(Math.round(bpm)), 44, 368);
      c.fillStyle = '#8b93a3'; c.font = '500 26px ' + DISPLAY(); c.fillText('BPM', 44 + c.measureText('00').width * 3.1, 368);
      c.strokeStyle = '#5ff2b6'; c.lineWidth = 5; c.lineJoin = 'round'; c.shadowColor = '#5ff2b6'; c.shadowBlur = 16; c.beginPath();
      for (let i = 0; i < 160; i++) { const v = bufs[2][N - 160 + i]; const x = 40 + i / 159 * (SW - 80), y = 470 - v * 110; i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke(); c.shadowBlur = 0;
      c.fillStyle = '#5ff2b6'; c.beginPath(); c.arc(52, 566, 8, 0, TAU); c.fill();
      c.fillStyle = '#c9cfdb'; c.font = '500 27px ' + DISPLAY(); c.fillText('Fall detection on', 74, 576);
    } else if (face === 'alert') {
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.012);
      c.fillStyle = 'rgb(' + Math.round(176 + 34 * pulse) + ',' + Math.round(20 + 12 * pulse) + ',18)'; c.fillRect(0, 0, SW, SH);
      c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '700 96px ' + DISPLAY(); c.fillText('Fall', 40, 168); c.fillText('detected', 40, 262);
      c.font = '500 30px ' + DISPLAY(); c.fillText('Peak ' + peakG.toFixed(1) + ' g · wrist impact', 42, 330);
      const left = Math.max(0, 5 - faceT), cx = SW / 2, cy = 468;
      c.lineWidth = 14; c.strokeStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(cx, cy, 78, 0, TAU); c.stroke();
      c.strokeStyle = '#fff'; c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy, 78, -Math.PI / 2, -Math.PI / 2 + TAU * (left / 5)); c.stroke();
      c.textAlign = 'center'; c.font = '700 74px ' + DISPLAY(); c.fillText(String(Math.ceil(left)), cx, cy + 26);
      c.font = '500 27px ' + DISPLAY(); c.fillText('Calling caregiver', cx, 596);
    } else {
      c.fillStyle = '#03130c'; c.fillRect(0, 0, SW, SH);
      c.strokeStyle = '#5ff2b6'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round'; c.shadowColor = '#5ff2b6'; c.shadowBlur = 24;
      c.beginPath(); c.arc(SW / 2, 250, 104, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(SW / 2 - 46, 252); c.lineTo(SW / 2 - 10, 290); c.lineTo(SW / 2 + 52, 214); c.stroke(); c.shadowBlur = 0;
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '600 46px ' + DISPLAY(); c.fillText('Caregiver notified', SW / 2, 452);
      c.fillStyle = '#9fb3a9'; c.font = '500 28px ' + DISPLAY(); c.fillText('Location shared · 4 s', SW / 2, 500);
    }
    screenTex.needsUpdate = true;
  }

  /* ---------------- state ---------------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.6, 0.9); composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let W = 0, H = 0, portrait = false;
  const home = new THREE.Vector3(), pos = new THREE.Vector3(), rot = new THREE.Vector3(), vel = new THREE.Vector3(), w = new THREE.Vector3();
  const REST = new THREE.Vector3(-0.5, -0.3, 0.3);
  function restY() { const c = Math.cos(REST.x), sn = Math.sin(REST.x); return FLOOR + S * (EB * -sn + Math.hypot(EA * c, EB * sn) + 0.1); }
  function layout() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight; if (!cw || !ch) return false;
    if (cw === W && ch === H) return true;
    W = cw; H = ch; portrait = W / H < 0.9;
    renderer.setSize(W, H, false); composer.setSize(W, H); bloom.resolution.set(W, H);
    camera.aspect = W / H; camera.position.z = portrait ? 13.5 : 10; camera.updateProjectionMatrix();
    const halfW = Math.tan(THREE.MathUtils.degToRad(15)) * camera.position.z * camera.aspect;
    home.set(portrait ? 0 : halfW * 0.5, portrait ? 1.35 : 0.42, 0);
    if (state === 'idle') pos.copy(home);
    return true;
  }
  let frozen = false, state = 'idle', stT = 0, impacts = 0, alert = 0, shake = 0, scrollP = 0, px = 0, py = 0, spx = 0, spy = 0, visible = true, clock = performance.now(), recoverFrom = null;

  function fall(g) {
    if (state !== 'idle') return false;
    peakG = g || 4.8; state = 'falling'; stT = 0; impacts = 0;
    vel.set(-0.5, 2.4, 0); w.set(-8.5, 1.4, 2.6);
    imp[0] += 1.5 * (Math.random() > 0.5 ? 1 : -1); imp[1] -= 1.9; imp[2] += 2.4;
    face = 'alert'; faceT = 0;
    hooks.onFall && hooks.onFall(peakG);
    return true;
  }
  function nearest(v, target) { return target + TAU * Math.round((v - target) / TAU); }

  function update(dt, now) {
    owed += dt * 60; while (owed >= 1) { sample(); owed -= 1; }
    bpm += ((state === 'idle' ? 72 : 118) + Math.sin(now * 0.0007) * 3 - bpm) * dt * 1.5;
    spx += (px - spx) * Math.min(1, dt * 5); spy += (py - spy) * Math.min(1, dt * 5);
    stT += dt; faceT += dt;
    const tt = now * 0.001;

    if (state === 'idle') {
      const sc = scrollP;
      const tx = home.x + (portrait ? 0 : sc * 1.2), ty = home.y + Math.sin(tt * 0.9) * 0.07 + sc * 1.4;
      pos.x += (tx - pos.x) * Math.min(1, dt * 6); pos.y += (ty - pos.y) * Math.min(1, dt * 6); pos.z += (0 - pos.z) * Math.min(1, dt * 6);
      const ry = -0.52 + Math.sin(tt * 0.5) * 0.1 + spx * 0.55 + sc * 2.4, rx = 0.1 + Math.sin(tt * 0.7) * 0.04 + spy * 0.32 - sc * 0.5, rz = 0.06 + spx * -0.06;
      rot.x += (rx - rot.x) * Math.min(1, dt * 5); rot.y += (ry - rot.y) * Math.min(1, dt * 5); rot.z += (rz - rot.z) * Math.min(1, dt * 5);
    } else if (state === 'falling' || state === 'down') {
      const ry0 = restY();
      if (state === 'falling') {
        vel.y -= 21 * dt; pos.addScaledVector(vel, dt);
        if (pos.y <= ry0) {
          pos.y = ry0; impacts++; shake = impacts === 1 ? 0.3 : 0.1;
          vel.y = -vel.y * 0.34; vel.x *= 0.5; w.multiplyScalar(0.35);
          if (impacts === 1) { rings.forEach((r, i) => { r.userData.t = -i * 0.55; }); hooks.onImpact && hooks.onImpact(); }
          if (impacts >= 3 || Math.abs(vel.y) < 0.8) { state = 'down'; vel.set(0, 0, 0); }
        }
        if (impacts === 0) { rot.x += w.x * dt; rot.y += w.y * dt; rot.z += w.z * dt; }
      }
      if (impacts > 0) {
        const k = Math.min(1, dt * 7);
        rot.x += (nearest(rot.x, REST.x) - rot.x) * k; rot.y += (nearest(rot.y, REST.y) - rot.y) * k; rot.z += (nearest(rot.z, REST.z) - rot.z) * k;
        if (state === 'down') pos.y += (ry0 - pos.y) * k;
      }
      if (state === 'down' && faceT > 5 && !frozen) { face = 'ok'; }
      if (state === 'down' && faceT > 6.6 && !frozen) {
        state = 'recover'; stT = 0; rot.x -= TAU * Math.round(rot.x / TAU); rot.y -= TAU * Math.round(rot.y / TAU); rot.z -= TAU * Math.round(rot.z / TAU);
        recoverFrom = { p: pos.clone(), r: rot.clone() }; hooks.onRecover && hooks.onRecover();
      }
    } else if (state === 'recover') {
      const u = Math.min(1, stT / 1.5), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      pos.lerpVectors(recoverFrom.p, home, e);
      rot.set(recoverFrom.r.x + (0.1 - recoverFrom.r.x) * e, recoverFrom.r.y + (-0.52 - recoverFrom.r.y) * e, recoverFrom.r.z + (0.06 - recoverFrom.r.z) * e);
      if (u >= 1) { state = 'idle'; face = 'idle'; }
    }

    const wantAlert = state === 'falling' || state === 'down' ? 1 : 0;
    alert += (wantAlert - alert) * Math.min(1, dt * (wantAlert ? 9 : 2.2));
    scene.background.copy(BG).lerp(BG_ALERT, alert); scene.fog.color.copy(scene.background);
    under.intensity = alert * 26; rim.color.set('#7fa8ff').lerp(RED, alert * 0.85); key.intensity = 2.6 - alert * 1.1;
    lines.forEach((l, a) => {
      l.material.color.copy(ICE).lerp(RED, alert);
      const p = l.geometry.attributes.position, span = 20;
      const th = l.userData.th, amp = 1.4 + a * 0.5;
      for (let i = 0; i < N; i++) { const x = (i / (N - 1) - 0.5) * span, y = bufs[a][i] * amp, dy = i ? (bufs[a][i] - bufs[a][i - 1]) * amp : 0, dx = span / (N - 1), n = Math.hypot(dx, dy), ox = -dy / n * th, oy = dx / n * th; p.setXYZ(i * 2, x + ox, y + oy, 0); p.setXYZ(i * 2 + 1, x - ox, y - oy, 0); }
      p.needsUpdate = true;
    });
    rings.forEach((r) => {
      if (r.userData.t < -5) return; r.userData.t += dt; const t = r.userData.t;
      if (t < 0) { r.material.opacity = 0; return; }
      const u = t / 2.6; if (u >= 1) { r.material.opacity = 0; r.userData.t = state === 'down' ? 0 : -9; return; }
      const s = 0.6 + u * 6.5; r.scale.set(s, s, 1); r.position.x = pos.x; r.material.opacity = (1 - u) * 0.75;
    });
    glow.position.x = pos.x; glow.position.y = pos.y * 0.6; glow.material.color.set('#2b4a9c').lerp(RED, alert); glow.material.opacity = 0.55 + alert * 0.25;
    dust.rotation.y = tt * 0.012; dust.position.y = Math.sin(tt * 0.2) * 0.2; dust.material.color.set('#9fb6e8').lerp(RED, alert * 0.8);
    const hgt = Math.max(0, pos.y - restY());
    shadow.position.x = pos.x; shadow.material.opacity = Math.max(0, 0.75 - hgt * 0.45) * (state === 'idle' ? 0.25 : 1); const ss = 0.8 + hgt * 0.5; shadow.scale.set(ss, ss, 1);

    shake *= Math.pow(0.002, dt);
    camera.position.x = (Math.random() - 0.5) * shake + spx * 0.25; camera.position.y = (Math.random() - 0.5) * shake - spy * 0.15;
    camera.lookAt(0, 0, 0);
    watch.position.copy(pos); watch.rotation.set(rot.x, rot.y, rot.z);
    drawFace(now);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - clock) / 1000); clock = now;
    if (!visible && state === 'idle') return;
    if (!layout()) return;
    update(dt, now); composer.render();
  }
  requestAnimationFrame(frame);

  function debugPose(name) {
    frozen = true; layout(); face = name === 'after' ? 'ok' : 'alert'; faceT = 2.2; state = 'down'; impacts = 3; alert = 1;
    pos.set(home.x, restY(), 0); rot.copy(REST); rings.forEach((r, i) => { r.userData.t = i * 0.6; });
  }
  return {
    fall, debugPose,
    impulse(vx, vy) { imp[0] += vx * 0.12; imp[1] += vy * 0.12; imp[2] += Math.hypot(vx, vy) * 0.1; },
    pointer(x, y) { px = x; py = y; },
    scroll(p) { scrollP = p; },
    setVisible(v) { visible = v; },
    get state() { return state; },
    signal: bufs,
  };
}

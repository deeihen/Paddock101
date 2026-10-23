import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Drop a CC-licensed car at public/models/f1.glb and it replaces the procedural one.
const MODEL_URL = `${import.meta.env.BASE_URL}models/f1.glb`;
const CAR_LENGTH = 5.4;

const INK = 0x111418;
const PAPER = 0xf7f7f3;
const RED = 0xe10600;

export const COMPOUNDS = {
  soft: 0xe10600,
  medium: 0xf2c200,
  hard: 0xffffff,
  inter: 0x2ba84a,
  wet: 0x1f6feb,
};

// Camera/car pose per [data-cam] stop. Scroll scrubs between consecutive stops.
// c = camera pos, t = look target, shift = horizontal frame offset (neg = car sits right)
// launch: 0 = parked, 1 = gone into the distance, 2 = lapped back into place (z wraps)
const base = { c: [8.5, 2.8, 9.5], t: [0, 0.4, 0], shift: -0.3, explode: 0, rot: -0.5, car: 1, track: 0, labels: 0, spin: 1, flow: 0, dims: 0, pit: 0, launch: 2 };
export const KEYFRAMES = {
  hero: { ...base, flow: 0.35, launch: 0 },
  lights: { ...base, c: [2.4, 0.75, -7], t: [0, 0.5, 2], shift: 0, rot: 0, spin: 0, launch: 0 },
  launch: { ...base, c: [2.4, 0.75, -7], t: [0, 0.5, 2], shift: 0, rot: 0, spin: 0, launch: 1, flow: 1 },
  'basics-a': { ...base, c: [0, 1.4, 10], t: [0, 0.5, 0], shift: -0.22, rot: Math.PI / 2, spin: 0 },
  'basics-b': { ...base, c: [-7, 4, 6], t: [0, 0.3, 0], shift: -0.22, rot: Math.PI / 2, spin: 0 },
  'basics-c': { ...base, c: [0.01, 13, 0.5], t: [0, 0, 0], shift: -0.22, rot: 0, spin: 0 },
  'basics-d': { ...base, c: [8, 2, -6], t: [0, 0.5, 0], shift: -0.22, rot: 0.8, spin: 0 },
  'car-a': { ...base, c: [7, 5, 7], t: [0, 0.3, 0], shift: -0.2, rot: 0, spin: 0, dims: 1 },
  'car-b': { ...base, c: [9.5, 7, 9.5], t: [0, 0.8, 0], shift: -0.2, rot: 0, explode: 1, labels: 1, spin: 0 },
  'car-c': { ...base, c: [3.6, 3.8, 0.6], t: [0, 0.8, -1], shift: -0.2, rot: 0, explode: 1, labels: 1, spin: 0 },
  'car-d': { ...base, c: [-6.5, 2.4, -6], t: [0, 0.7, -0.8], shift: -0.2, rot: 0, explode: 0.35, labels: 1, spin: 0, flow: 1 },
  'car-e': { ...base, c: [2.6, 2.6, 3.4], t: [0, 0.8, 0.2], shift: -0.2, rot: 0, spin: 0 },
  tyre: { ...base, c: [4.6, 1, 4.8], t: [0.85, 0.36, 1.65], shift: -0.15, rot: 0, spin: 0 },
  strategy: { ...base, c: [0.01, 8, 9], t: [0, 0, 0], shift: -0.2, rot: -0.6, spin: 0, pit: 1 },
  flags: { ...base, c: [0.01, 8, 9], t: [0, 0, 0], shift: -0.2, rot: -0.6, spin: 0 },
  track: { ...base, c: [0.01, 30, 9], t: [0, 0, 0.5], shift: -0.2, car: 0, track: 1, spin: 0 },
  circuits: { ...base, c: [14, 9, 14], t: [0, 0, 0], shift: 0, car: 0, track: 1, spin: 0 },
  teams: { ...base, shift: 0 },
  history: { ...base, c: [0, 1.4, 11], t: [0, 0.5, 0], shift: -0.28, rot: Math.PI / 2, spin: 0.4 },
  finish: { ...base, shift: 0 },
};

// Flat numeric state so GSAP can tween every field.
export function flatten(k) {
  return {
    cx: k.c[0], cy: k.c[1], cz: k.c[2],
    tx: k.t[0], ty: k.t[1], tz: k.t[2],
    shift: k.shift, explode: k.explode, rot: k.rot, car: k.car, track: k.track, labels: k.labels, spin: k.spin,
    flow: k.flow, dims: k.dims, pit: k.pit, launch: k.launch,
  };
}

export function createScene(canvas, { reduceMotion }) {
  const state = flatten(KEYFRAMES.hero);
  const target = { ...state }; // scroll writes here; the loop eases state toward it

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d0, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(5, 8, 4);
  scene.add(sun);

  const grid = new THREE.GridHelper(60, 60, INK, INK);
  grid.material.transparent = true;
  grid.material.opacity = 0.08;
  scene.add(grid);

  const paperMat = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 0.85, metalness: 0, flatShading: true });
  const redMat = new THREE.MeshStandardMaterial({ color: RED, roughness: 0.6, flatShading: true });
  const inkMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.9, flatShading: true });
  const ringMat = new THREE.MeshBasicMaterial({ color: COMPOUNDS.soft });
  const edgeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.55 });

  const withEdges = (mesh, threshold = 25) => {
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, threshold), edgeMat));
    return mesh;
  };

  // ---------- car ----------
  const car = new THREE.Group();
  scene.add(car);
  let parts = []; // { obj, base: Vector3, dir: Vector3 }
  const named = {};
  let bbox = new THREE.Box3();

  shadowBlob();
  buildProceduralCar();

  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(MODEL_URL, (gltf) => {
    car.clear();
    parts = [];
    for (const k in named) delete named[k];
    useGLB(gltf.scene);
  }, undefined, () => { /* no model shipped: keep procedural car */ });

  function part(name, geo, mat, pos, dir, rot) {
    const m = withEdges(new THREE.Mesh(geo, mat));
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    car.add(m);
    parts.push({ obj: m, base: m.position.clone(), dir: new THREE.Vector3(...dir) });
    if (name) named[name] = m;
    return m;
  }

  function buildProceduralCar() {
    const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
    const taper = (r1, r2, len, seg = 10) => new THREE.CylinderGeometry(r1, r2, len, seg).rotateX(Math.PI / 2);
    const H = Math.PI / 2;

    part('floor', box(1.5, 0.05, 3.7), inkMat, [0, 0.1, -0.2], [0, -0.9, 0]);
    part('tub', box(0.72, 0.48, 1.6), paperMat, [0, 0.42, 0.35], [0, 0, 0]);
    part('nose', taper(0.1, 0.28, 1.5), paperMat, [0, 0.36, 1.85], [0, 0, 1.2]);
    part('cover', taper(0.38, 0.14, 2.0), paperMat, [0, 0.55, -1.15], [0, 1.4, 0]);
    part('airbox', box(0.3, 0.38, 0.5), paperMat, [0, 0.95, -0.35], [0, 1.8, 0]);
    part('pu', box(0.48, 0.38, 0.85), redMat, [0, 0.45, -0.95], [0, 0.15, 0]);
    part('sidepodL', box(0.42, 0.34, 1.4), paperMat, [0.6, 0.34, -0.35], [1.1, 0.1, 0]);
    part('sidepodR', box(0.42, 0.34, 1.4), paperMat, [-0.6, 0.34, -0.35], [-1.1, 0.1, 0]);
    part('helmet', new THREE.SphereGeometry(0.14, 16, 12), redMat, [0, 0.76, 0.2], [0, 0.6, 0]);

    const halo = part('halo', new THREE.TorusGeometry(0.3, 0.028, 8, 24, Math.PI), inkMat, [0, 0.72, 0.28], [0, 1.1, 0.1], [-H, 0, 0]);
    halo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36), inkMat).translateZ(0.3).rotateX(-0.6).translateY(-0.08));

    const fw = part('frontWing', box(1.9, 0.03, 0.45), paperMat, [0, 0.12, 2.5], [0, 0, 1.6]);
    fw.add(withEdges(new THREE.Mesh(box(1.7, 0.03, 0.25), paperMat)).translateY(0.08).translateZ(-0.12));
    for (const s of [-1, 1]) fw.add(withEdges(new THREE.Mesh(box(0.03, 0.22, 0.5), redMat)).translateX(s * 0.95).translateY(0.08));

    const rw = part('rearWing', box(1.0, 0.03, 0.35), paperMat, [0, 0.95, -2.3], [0, 0.7, -1.4]);
    rw.add(withEdges(new THREE.Mesh(box(1.0, 0.03, 0.25), paperMat)).translateY(0.12).translateZ(-0.1));
    for (const s of [-1, 1]) rw.add(withEdges(new THREE.Mesh(box(0.03, 0.5, 0.55), redMat)).translateX(s * 0.5).translateY(0.02));
    rw.add(withEdges(new THREE.Mesh(box(0.06, 0.6, 0.12), inkMat)).translateY(-0.35));

    addWheels({ r: 0.36, front: [0.86, 1.65, 0.3], rear: [0.82, -1.45, 0.4] });

    bbox.setFromObject(car);
  }

  // spec: r = radius, front/rear = [x, z, width] in car space
  function addWheels({ r, front, rear }) {
    const wheel = (name, x, z, width) => {
      const g = new THREE.Group();
      const tyre = withEdges(new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 40).rotateZ(Math.PI / 2), inkMat), 40);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.75, 0.014, 6, 48).rotateY(Math.PI / 2), ringMat);
      ring.position.x = Math.sign(x) * (width / 2 + 0.002);
      g.add(tyre, ring);
      g.position.set(x, r, z);
      car.add(g);
      parts.push({ obj: g, base: g.position.clone(), dir: new THREE.Vector3(Math.sign(x) * 1.4, 0, Math.sign(z) * 0.5), wheel: true });
      named[`wheel${z > 0 ? 'F' : 'R'}${x > 0 ? 'L' : 'R'}`] = g;
      if (name) named[name] = g;
    };
    wheel('tyre', front[0], front[1], front[2]);
    wheel(null, -front[0], front[1], front[2]);
    wheel(null, rear[0], rear[1], rear[2]);
    wheel(null, -rear[0], rear[1], rear[2]);
  }

  // Part groups for f1.glb ("2026 | F1 Audi FOM Update"), matched on its mesh names.
  // dir = explode offset in car space; s = mirror x by the side the group sits on
  const GROUPS = [
    ['hide', /rim_blur|cinture_off/],
    ['frontWing', /frontwing|frontflap|frontspoiler/, [0, -0.1, 1.5]],
    ['nose', /nosecone/, [0, 0.15, 0.9]],
    ['halo', /^hal[_-]/, [0, 1.1, 0.1]],
    ['engineCover', /topcanopy|camera_wing/, [0, 1.3, -0.3]],
    ['sidepodL', /sidepod_fl/, [1.2, 0.1, 0], true],
    ['sidepodR', /sidepod_fr/, [1.2, 0.1, 0], true],
    ['floor', /floor_damage|diffuser/, [0, -0.7, 0]],
    ['rearWing', /rearwing|drs/, [0, 0.9, -1.3]],
    ['steering', /steering|_sw_|paddle|_dial|^led_|^tag_/, [0, 1.0, 0.6]],
    // corner codes also appear in wing/sidepod names, so wheels match last
    ['wheelFL', /(^|_)(fl|lf)(\d|_|-)/, [1.5, 0, 0.35], true],
    ['wheelFR', /(^|_)(fr|rf)(\d|_|-)/, [1.5, 0, 0.35], true],
    ['wheelRL', /(^|_)(bl|lr)(\d|_|-)/, [1.5, 0, -0.35], true],
    ['wheelRR', /(^|_)(br|rr)(\d|_|-)/, [1.5, 0, -0.35], true],
  ];
  const SUSPENSION = /susp/;
  const sidewalls = [];

  function useGLB(model) {
    // measure in car space, not in whatever pose the render loop left it
    car.position.set(0, 0, 0);
    car.rotation.set(0, 0, 0);
    car.scale.setScalar(1);
    car.updateMatrixWorld(true);
    let b = new THREE.Box3().setFromObject(model);
    model.scale.multiplyScalar(CAR_LENGTH / b.getSize(new THREE.Vector3()).z);
    model.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(model);
    const c = b.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.z -= c.z;
    model.position.y -= b.min.y;
    car.add(model);
    car.updateMatrixWorld(true);
    bbox.setFromObject(car);

    const groups = {};
    const meshes = [];
    model.traverse((o) => o.isMesh && meshes.push(o));
    for (const o of meshes) {
      const name = o.name.toLowerCase();
      if (/sidewall/i.test(o.material.name) && !sidewalls.includes(o.material)) {
        // lettering is printed red in the texture: keep its brightness, take hue from material.color
        o.material.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            diffuseColor.rgb = diffuse * max(sampledDiffuseColor.r, max(sampledDiffuseColor.g, sampledDiffuseColor.b));`);
        };
        sidewalls.push(o.material);
      }
      if (SUSPENSION.test(name)) continue; // arms stay on the chassis, so the exploded wheels show them
      const hit = GROUPS.find(([, re]) => re.test(name));
      if (!hit) continue;
      if (hit[0] === 'hide') { o.visible = false; continue; }
      (groups[hit[0]] ??= new THREE.Group()).attach(o);
    }
    for (const [key, , dir, mirrored] of GROUPS) {
      const g = groups[key];
      if (!g) continue;
      car.add(g);
      // pivot each group on its own centre so labels and offsets read from the part itself
      const center = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());
      g.children.forEach((ch) => ch.position.sub(center));
      g.position.copy(center);
      const d = new THREE.Vector3(...dir);
      if (mirrored) d.x *= Math.sign(center.x) || 1;
      parts.push({ obj: g, base: g.position.clone(), dir: d, wheel: key.startsWith('wheel') });
      named[key] = g;
    }
    named.tyre = named.wheelFL;
    named.pu = named.engineCover;
    setCompound(currentCompound);
    buildDims();
  }

  function shadowBlob() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(17,20,24,0.35)');
    r.addColorStop(1, 'rgba(17,20,24,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 7.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.005;
    scene.add(m);
    shadowBlob.mesh = m;
  }

  // ---------- track ----------
  const trackGroup = new THREE.Group();
  scene.add(trackGroup);
  const curve = new THREE.CatmullRomCurve3(
    [[-8, -3], [-4, -5.2], [2, -5], [6.5, -4.6], [8.6, -2], [7, 0.6], [3, 1], [2, 3], [5, 5], [2, 6.6], [-4, 6], [-7, 3.6], [-6, 1], [-9, 0]]
      .map(([x, z]) => new THREE.Vector3(x, 0.02, z)),
    true, 'centripetal',
  );
  const tubeGeo = new THREE.TubeGeometry(curve, 400, 0.09, 6, true);
  const trackMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true });
  const track = new THREE.Mesh(tubeGeo, trackMat);
  const ghostMat = new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.12 });
  const ghost = new THREE.Mesh(tubeGeo, ghostMat);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 14), new THREE.MeshBasicMaterial({ color: RED }));
  trackGroup.add(ghost, track, marker);
  const trackIndexCount = tubeGeo.index.count;

  // ---------- background: turntable, dust, airflow, dimensions ----------
  const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

  // turntable ring with degree ticks; turns with the car
  const turntable = new THREE.Group();
  const ttMat = lineMat(INK, 0.4);
  {
    const pts = [];
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2, r = 3.6, len = i % 15 === 0 ? 0.35 : i % 5 === 0 ? 0.18 : 0.08;
      pts.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(a) * (r + len), 0, Math.sin(a) * (r + len));
    }
    const ticks = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    turntable.add(new THREE.LineSegments(ticks, ttMat));
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * Math.PI * 2) * 3.6, 0, Math.sin((i / 128) * Math.PI * 2) * 3.6))), ttMat);
    turntable.add(ring);
    turntable.position.y = 0.006;
  }
  scene.add(turntable);

  // dust: static depth cue so camera moves read as travel through space
  const dust = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(
      Array.from({ length: 900 * 3 }, (_, i) => (Math.random() - 0.5) * (i % 3 === 1 ? 14 : 60) + (i % 3 === 1 ? 7 : 0)), 3)),
    new THREE.PointsMaterial({ color: INK, size: 0.045, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  scene.add(dust);

  // airflow: short streaks travelling nose-to-tail, lifted over the bodywork
  const FLOW_N = 220;
  const flowPos = new Float32Array(FLOW_N * 6);
  const flowSeed = Array.from({ length: FLOW_N }, () => [(Math.random() - 0.5) * 3.2, 0.05 + Math.random() * 1.5, (Math.random() - 0.5) * 9, 0.7 + Math.random() * 0.6]);
  const flowGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
  const flowMat = lineMat(0x1f6feb, 0);
  const flow = new THREE.LineSegments(flowGeo, flowMat);
  flow.frustumCulled = false;
  scene.add(flow);
  const lift = (x, y, z) => 0.5 * Math.exp(-(z * z) / 3.5) * Math.max(0, 1 - Math.abs(x) / 1.1) * Math.max(0, 1 - y / 1.7);

  // dimension lines (regulation wheelbase and width), rebuilt when the model changes
  const dims = new THREE.Group();
  const dimsMat = lineMat(RED, 0);
  const DIMS = [['Wheelbase 3.40 m', new THREE.Vector3()], ['Width 1.90 m', new THREE.Vector3()]];
  function buildDims() {
    dims.clear();
    const fz = named.wheelFL?.position.z ?? 1.4, rz = named.wheelRL?.position.z ?? -1.9;
    const hw = Math.max(Math.abs(bbox.min.x), bbox.max.x), x = hw + 0.4, z = bbox.max.z + 0.4, t = 0.12;
    const pts = [
      x, 0.02, rz, x, 0.02, fz, x - t, 0.02, rz, x + t, 0.02, rz, x - t, 0.02, fz, x + t, 0.02, fz,
      -hw, 0.02, z, hw, 0.02, z, -hw, 0.02, z - t, -hw, 0.02, z + t, hw, 0.02, z - t, hw, 0.02, z + t,
    ];
    dims.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), dimsMat));
    DIMS[0][1].set(x, 0.02, (fz + rz) / 2);
    DIMS[1][1].set(0, 0.02, z);
    car.add(dims);
  }
  buildDims();

  // ---------- labels ----------
  const LABELS = [
    ['Front wing', 'frontWing', [0, -0.35, 0.48]],
    ['Halo', 'halo', [0, 0.28, -0.01]],
    ['Engine cover', 'pu', [0, 0.07, -0.25]],
    ['Steering wheel', 'steering', [0, 0.2, 0.05]],
    ['Sidepod', 'sidepodL', [0.35, -0.14, 0.05]],
    ['Floor', 'floor', [-0.35, -0.45, -0.1]],
    ['Rear wing', 'rearWing', [0, 0.4, -0.43]],
    ['Tyre', 'tyre', [0.48, -0.15, 0.3]],
  ];
  const labelLayer = document.querySelector('.labels');
  const labelEls = LABELS.map(([text]) => {
    const el = document.createElement('div');
    el.className = 'label';
    el.innerHTML = `<span>${text}</span>`;
    labelLayer.append(el);
    return el;
  });

  const dimsLayer = Object.assign(document.createElement('div'), { className: 'labels labels--dims' });
  document.body.append(dimsLayer);
  const dimEls = DIMS.map(([text]) => {
    const el = Object.assign(document.createElement('div'), { className: 'label label--dim', innerHTML: `<span>${text}</span>` });
    dimsLayer.append(el);
    return el;
  });
  const placeLabel = (el) => {
    v.project(camera);
    el.style.visibility = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 ? 'visible' : 'hidden';
    el.style.transform = `translate(${((v.x + 1) / 2) * w - 4}px, ${((1 - v.y) / 2) * h - 4}px)`;
  };

  let currentCompound = 'soft';
  function setCompound(name) {
    currentCompound = name;
    ringMat.color.setHex(COMPOUNDS[name]);
    // tints the sidewall lettering on the real tyres
    for (const m of sidewalls) m.color.setHex(COMPOUNDS[name]);
  }

  // ---------- loop ----------
  const v = new THREE.Vector3();
  let spinAngle = 0;
  let last = performance.now();
  let w = 0, h = 0, mobile = false;

  function resize() {
    w = innerWidth; h = innerHeight; mobile = w < 768;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = mobile ? 50 : 35;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    for (const k in target) state[k] = reduceMotion ? target[k] : THREE.MathUtils.damp(state[k], target[k], 4, dt);
    if (!reduceMotion) spinAngle += dt * 0.18 * state.spin;
    // once idle spin stops, settle on the nearest full turn so keyframe angles mean what they say
    if (state.spin < 0.5) spinAngle = THREE.MathUtils.damp(spinAngle, Math.round(spinAngle / (Math.PI * 2)) * Math.PI * 2, 3, dt);

    camera.position.set(state.cx, state.cy, state.cz);
    camera.lookAt(state.tx, state.ty, state.tz);
    const shift = mobile ? 0 : state.shift;
    camera.setViewOffset(w, h, shift * w, 0, w, h);

    car.rotation.y = state.rot + spinAngle;
    // launch wraps: 0 parked, 1 gone ahead (+40), 2 back in place having come round from -40
    car.position.z = THREE.MathUtils.euclideanModulo(state.launch * 40 + 40, 80) - 40;
    shadowBlob.mesh.position.z = car.position.z;
    turntable.rotation.y = car.rotation.y;
    ttMat.opacity = 0.4 * state.car;
    if (!reduceMotion) dust.rotation.y += dt * 0.01;

    flow.visible = state.flow > 0.01;
    flowMat.opacity = 0.55 * state.flow;
    if (flow.visible) {
      flow.rotation.y = car.rotation.y;
      flow.position.z = car.position.z;
      flowSeed.forEach((p, i) => {
        if (!reduceMotion) p[2] -= dt * 7 * p[3];
        if (p[2] < -4.5) p[2] += 9;
        const [x, y, z] = p, z2 = z + 0.55 * p[3];
        flowPos.set([x, y + lift(x, y, z), z, x, y + lift(x, y, z2), z2], i * 6);
      });
      flowGeo.attributes.position.needsUpdate = true;
    }

    dimsMat.opacity = 0.85 * state.dims;
    dimsLayer.style.opacity = state.dims;
    if (state.dims > 0.01) {
      car.updateMatrixWorld();
      DIMS.forEach(([, p], i) => { car.localToWorld(v.copy(p)); placeLabel(dimEls[i]); });
    }

    const s = Math.max(state.car, 0.0001);
    car.scale.setScalar(s);
    car.visible = state.car > 0.01;
    shadowBlob.mesh.material.opacity = state.car * (1 - state.explode * 0.6);
    for (const p of parts) p.obj.position.copy(p.base).addScaledVector(p.dir, p.wheel ? Math.max(state.explode, state.pit) : state.explode);

    trackGroup.visible = state.track > 0.01;
    ghostMat.opacity = 0.12 * state.track;
    trackMat.opacity = state.track;
    tubeGeo.setDrawRange(0, Math.floor((trackIndexCount * state.track) / 3) * 3);
    marker.position.copy(curve.getPointAt(state.track % 1));
    marker.scale.setScalar(state.track);

    labelLayer.style.opacity = state.labels;
    if (state.labels > 0.01) {
      car.updateMatrixWorld();
      LABELS.forEach(([, name, n], i) => {
        const obj = named[name];
        if (obj?.isMesh) {
          if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
          obj.geometry.boundingBox.getCenter(v).applyMatrix4(obj.matrixWorld);
        } else if (obj) obj.getWorldPosition(v);
        else car.localToWorld(v.set(
          THREE.MathUtils.lerp(bbox.min.x, bbox.max.x, n[0] + 0.5),
          THREE.MathUtils.lerp(bbox.min.y, bbox.max.y, n[1] + 0.5),
          THREE.MathUtils.lerp(bbox.min.z, bbox.max.z, n[2] + 0.5),
        ));
        v.project(camera);
        const el = labelEls[i];
        const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        el.style.visibility = visible ? 'visible' : 'hidden';
        el.style.transform = `translate(${((v.x + 1) / 2) * w - 4}px, ${((1 - v.y) / 2) * h - 4}px)`;
      });
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    state,
    target,
    setCompound,
  };
}

// Icosahedral/Dodecahedral Transitions (IDT): a 3D world of its own on DICTO's
// Euclid–Kepler cell (Kaleidohedra DISCOVERIES.md #8; geometry in
// geometry-extensions/roof-fold.js). Sites are a simple cubic lattice of
// period phi^2 (icosahedron edge 1). Four solids, one at a time, several per
// site: cube, dodecahedron, icosahedron, great stellated dodecahedron (the star). Tap a solid to add the
// chosen one at that site, or across the face when it's already there;
// long-press removes. The View picker redraws the same build as alternating
// patterns (site colourings, each with its own space group), in X-ray (inner
// solids through outer ones) or as the exact merged surface of the dodecahedra.
import * as THREE from 'three';
import { ROOF_FOLD_KINDS, ROOF_FOLD_WORLD_SCALE as WS, roofFoldSolids, mergedDodecaSurface, mergedDodecaEdges, ROOF_FOLD_PATTERNS } from '../geometry-extensions/roof-fold.js';
import { t } from './i18n.js';
import { getSettings, onSettingsChange } from './settings.js';

const STORAGE_KEY = 'rhombiverse-roof-fold-world';
const VIEWS = ['built', 'starIco', 'dodecaStar', 'checker', 'merged'];
const KIND_COLOR = { cube: 0x9fb4c8, dodeca: 0xffc857, ico: 0x5fd38a, star: 0xff7a59 };
const PARITY_COLOR = [0xffc857, 0x7cc4ff];
const OCTANT_COLOR = [0xffc857, 0x7cc4ff, 0xff7a59, 0x5fd38a, 0xc792ea, 0x4dd0e1, 0xf06292, 0xe8eef7];
const PATTERNS = Object.keys(ROOF_FOLD_PATTERNS);
const VERTICES = ['off', 'cube', 'all'];
const ALTERNATING = ['starIco', 'dodecaStar', 'checker'];
// X-ray: the innermost solid stays solid, the ones around it fade outward (cube is inscribed in the dodecahedron).
const XRAY = { ico: { opacity: 1, order: 0 }, star: { opacity: 0.42, order: 1 }, cube: { opacity: 0.3, order: 2 }, dodeca: { opacity: 0.16, order: 3 } };
const FIRST_COLOR = 0x00e5ff;
const GHOST_COLOR = 0x9de0ff;
const EDGE_COLOR = 0x0b1220;
const NODE_COLOR = 0xe8eef7;
const ODD_SHADE = 0.62;
const lang = () => getSettings().language;
const siteKey = (s) => s.join();
const solidKey = (s, kind) => `${s.join()},${kind}`;
const DIRECTIONS = [];
for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) DIRECTIONS.push([x, y, z]);

export function createRoofFoldWorld({ scene, onChange = () => {}, showHudPrompt = () => {}, fitView = () => {} }) {
  const SOLIDS = roofFoldSolids();
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // ---- state ----
  const solids = new Map(); // solidKey -> { site: [x, y, z], kind }
  const view = { piece: 'dodeca', mode: 'built', parity: false, vertices: 'off', pattern: 'xyz', xray: false };
  let active = false;
  let skeleton = false;
  let opacity = 1;
  let latticeView = false;
  let infoOpen = false;

  function setFromJSON(data) {
    solids.clear();
    for (const s of Array.isArray(data?.solids) ? data.solids : []) {
      if (!Array.isArray(s?.site) || s.site.length !== 3 || !s.site.every(Number.isInteger) || !ROOF_FOLD_KINDS.includes(s.kind)) continue;
      solids.set(solidKey(s.site, s.kind), { site: [...s.site], kind: s.kind });
    }
  }
  const toJSON = () => ({ solids: [...solids.values()] });
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (data) {
      setFromJSON(data);
      if (ROOF_FOLD_KINDS.includes(data.view?.piece)) view.piece = data.view.piece;
      if (VIEWS.includes(data.view?.mode)) view.mode = data.view.mode;
      view.parity = data.view?.parity === true;
      if (VERTICES.includes(data.view?.vertices)) view.vertices = data.view.vertices;
      if (PATTERNS.includes(data.view?.pattern)) view.pattern = data.view.pattern;
      view.xray = data.view?.xray === true;
    }
  } catch { /* corrupt or blocked storage: start empty */ }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...toJSON(), view })); } catch { /* best-effort */ }
  }
  const sites = () => { const m = new Map(); for (const s of solids.values()) m.set(siteKey(s.site), s.site); return [...m.values()]; };

  // ---- what to draw ----
  // Octants has 8 colours, so it's only offered in Checkerboard; the two-solid views fall back to x+y+z.
  const patternName = () => (view.pattern === 'octants' && view.mode !== 'checker' ? 'xyz' : view.pattern);
  const colourIndex = (site) => ROOF_FOLD_PATTERNS[patternName()].of(...site);
  const odd = (site) => colourIndex(site) % 2 === 1;
  const shade = (hex, site) => { const c = new THREE.Color(hex); return view.parity && odd(site) ? c.multiplyScalar(ODD_SHADE) : c; };
  function drawList() {
    const built = [...solids.values()];
    switch (view.mode) {
      case 'starIco': return sites().map((site) => ({ site, kind: odd(site) ? 'ico' : 'star' }));
      case 'dodecaStar': return sites().map((site) => ({ site, kind: odd(site) ? 'star' : 'dodeca' }));
      default: return built;
    }
  }
  const colourOf = (item) => (view.mode === 'checker'
    ? new THREE.Color((patternName() === 'octants' ? OCTANT_COLOR : PARITY_COLOR)[colourIndex(item.site)])
    : shade(KIND_COLOR[item.kind], item.site));

  // ---- drawing ----
  const pieceMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const ghostMaterial = new THREE.MeshStandardMaterial({ color: GHOST_COLOR, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  const firstMaterial = new THREE.MeshStandardMaterial({ color: FIRST_COLOR, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
  const nodeGeometry = new THREE.SphereGeometry(0.07, 12, 8);
  const nodeMaterial = new THREE.MeshStandardMaterial({ color: NODE_COLOR });
  const pickTargets = [];
  function clearGroup() {
    for (const child of [...group.children]) {
      group.remove(child);
      if (child.geometry !== nodeGeometry) child.geometry.dispose();
      if (child.isLineSegments) child.material.dispose();
      if (child.isInstancedMesh) child.dispose();
      if (child.userData.ownMaterial) child.material.dispose();
    }
    pickTargets.length = 0;
  }
  // One mesh for a list of polygons ({ polygon, offset, colour, record }), plus its edge lines.
  function meshOf(polys, edges, material, edgeColor, tag) {
    const pos = [], col = [], line = [];
    const records = [];
    for (const { polygon, offset, colour, record } of polys) {
      const P = polygon.map((p) => p.map((c, a) => c * WS + offset[a]));
      for (let i = 1; i + 1 < P.length; i++) {
        for (const p of [P[0], P[i], P[i + 1]]) { pos.push(...p); col.push(colour.r, colour.g, colour.b); }
        records.push(record);
      }
    }
    for (const { a, b, offset } of edges) line.push(...a.map((c, i) => c * WS + offset[i]), ...b.map((c, i) => c * WS + offset[i]));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, material);
    mesh.userData.roofFold = tag;
    mesh.userData.records = records;
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(line, 3));
    return [mesh, new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: edgeColor }))];
  }
  const centreOf = (site) => site.map((c) => c * 2 * WS);
  function solidPolys(items, colourFn) {
    const polys = [], edges = [];
    for (const item of items) {
      const offset = centreOf(item.site);
      const colour = colourFn(item);
      for (const polygon of SOLIDS[item.kind].faces) polys.push({ polygon, offset, colour, record: item });
      for (const [a, b] of SOLIDS[item.kind].edges) edges.push({ a, b, offset });
    }
    return { polys, edges };
  }
  function mergedPolys() {
    const polys = [], edges = [];
    const surface = mergedDodecaSurface(sites());
    for (const { site, polygon } of surface) {
      const colour = view.mode === 'merged' && view.parity ? shade(KIND_COLOR.dodeca, site) : new THREE.Color(KIND_COLOR.dodeca);
      // Surface pieces are already in cell units around the origin of site 0 (centre 2 * site).
      polys.push({ polygon, offset: [0, 0, 0], colour, record: { site, kind: 'dodeca' } });
    }
    for (const [a, b] of mergedDodecaEdges(surface, sites())) edges.push({ a, b, offset: [0, 0, 0] });
    return { polys, edges };
  }
  // Cube vertices of every occupied cell, or every vertex of every drawn solid.
  function nodeMarkers(items) {
    const corners = new Map();
    const put = (p) => corners.set(p.map((c) => c.toFixed(4)).join(), p);
    if (view.vertices === 'cube') {
      for (const s of sites()) for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) put([(2 * s[0] + dx) * WS, (2 * s[1] + dy) * WS, (2 * s[2] + dz) * WS]);
    } else {
      for (const { site, kind } of items) for (const f of SOLIDS[kind].faces) for (const v of f) put(v.map((c, a) => c * WS + centreOf(site)[a]));
    }
    const mesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, Math.max(1, corners.size));
    const m = new THREE.Matrix4();
    [...corners.values()].forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(...p)));
    mesh.count = corners.size;
    return mesh;
  }
  function emptyNeighbourSites() {
    const occupied = new Set(sites().map(siteKey));
    const out = new Map();
    for (const s of sites()) for (const d of DIRECTIONS) {
      if (Math.abs(d[0]) + Math.abs(d[1]) + Math.abs(d[2]) !== 1) continue;
      const n = s.map((c, i) => c + d[i]);
      if (!occupied.has(siteKey(n))) out.set(siteKey(n), n);
    }
    return [...out.values()];
  }
  function rebuild() {
    renderInfo();
    clearGroup();
    if (!active) return;
    pieceMaterial.transparent = opacity < 1;
    pieceMaterial.opacity = opacity;
    pieceMaterial.depthWrite = opacity >= 1;
    if (solids.size) {
      const items = view.mode === 'merged' ? sites().map((site) => ({ site, kind: 'dodeca' })) : drawList();
      // X-ray: one mesh per solid kind, each with its own see-through level.
      const layers = view.mode === 'merged' ? [{ ...mergedPolys(), material: pieceMaterial }]
        : view.xray ? ROOF_FOLD_KINDS.map((kind) => {
          const own = items.filter((it) => it.kind === kind);
          if (!own.length) return null;
          const o = XRAY[kind].opacity * opacity;
          const material = pieceMaterial.clone();
          Object.assign(material, { transparent: o < 1, opacity: o, depthWrite: o >= 1 });
          return { ...solidPolys(own, colourOf), material, order: XRAY[kind].order };
        }).filter(Boolean)
        : [{ ...solidPolys(items, colourOf), material: pieceMaterial }];
      for (const { polys, edges, material, order = 0 } of layers) {
        const [mesh, lines] = meshOf(polys, edges, material, EDGE_COLOR, 'piece');
        if (material !== pieceMaterial) mesh.userData.ownMaterial = true;
        mesh.renderOrder = order;
        mesh.visible = !skeleton;
        if (skeleton) lines.material.color.setHex(GHOST_COLOR);
        group.add(mesh, lines);
        pickTargets.push(mesh);
      }
      if (view.vertices !== 'off') group.add(nodeMarkers(items));
      if (latticeView) {
        const ghosts = emptyNeighbourSites().map((site) => ({ site, kind: view.piece }));
        if (ghosts.length) {
          const g = solidPolys(ghosts, () => new THREE.Color(GHOST_COLOR));
          const [gm, gl] = meshOf(g.polys, g.edges, ghostMaterial, GHOST_COLOR, 'ghost');
          group.add(gm, gl);
          pickTargets.push(gm);
        }
      }
    } else {
      const f = solidPolys([{ site: [0, 0, 0], kind: view.piece }], () => new THREE.Color(FIRST_COLOR));
      const [mesh, lines] = meshOf(f.polys, f.edges, firstMaterial, FIRST_COLOR, 'first');
      group.add(mesh, lines);
      pickTargets.push(mesh);
    }
    renderPanel();
  }

  // ---- building ----
  function commit() { save(); rebuild(); onChange(); }
  // Keep the whole build in view (fitView only ever zooms out).
  function fitBuild() {
    const S = sites();
    if (!S.length) { fitView([0, 0, 0], 2.2 * WS); return; }
    const c = [0, 1, 2].map((a) => S.reduce((t, s) => t + s[a], 0) / S.length * 2 * WS);
    const r = Math.max(...S.map((s) => Math.hypot(...s.map((v, a) => v * 2 * WS - c[a])))) + 1.8 * WS;
    fitView(c, r);
  }
  const pieceName = (kind) => t(`roofFold.${kind}`, lang());
  function add(site, kind) {
    const k = solidKey(site, kind);
    if (solids.has(k)) return false;
    solids.set(k, { site: [...site], kind });
    commit();
    fitBuild();
    return true;
  }
  // The neighbouring site whose direction best matches the face's outward normal.
  function siteAcross(site, normal) {
    let best = null, bestDot = -Infinity;
    for (const d of DIRECTIONS) {
      const dd = (d[0] * normal.x + d[1] * normal.y + d[2] * normal.z) / Math.hypot(...d);
      if (dd > bestDot) { bestDot = dd; best = d; }
    }
    return site.map((c, i) => c + best[i]);
  }
  function handleTap(hit, mode) {
    const tag = hit.object.userData.roofFold;
    const record = hit.object.userData.records?.[hit.faceIndex];
    if (!tag || !record) return false;
    const chisel = mode === 'chisel';
    if (tag === 'first' || tag === 'ghost') return chisel ? false : add(record.site, view.piece);
    if (chisel) {
      // As built, the tapped solid goes; in a redrawn view, everything at that site.
      const asBuilt = view.mode === 'built' || view.mode === 'checker';
      const gone = asBuilt ? [solidKey(record.site, record.kind)] : ROOF_FOLD_KINDS.map((k) => solidKey(record.site, k));
      if (!gone.some((k) => solids.delete(k))) return false;
      commit();
      return true;
    }
    if (!solids.has(solidKey(record.site, view.piece))) {
      add(record.site, view.piece);
      showHudPrompt(t('roofFold.prompt.inside', lang(), { piece: pieceName(view.piece) }), 3000);
      return true;
    }
    const across = siteAcross(record.site, hit.face.normal);
    if (add(across, view.piece)) return true;
    showHudPrompt(t('roofFold.prompt.taken', lang(), { piece: pieceName(view.piece) }), 2500);
    return false;
  }

  // ---- info ----
  const info = document.createElement('div');
  info.id = 'worldrooffold-info';
  info.className = 'qc-info';
  info.setAttribute('aria-live', 'polite');
  document.body.appendChild(info);
  function renderInfo() {
    const show = active && infoOpen;
    info.classList.toggle('visible', show);
    if (!show) return;
    const L = lang();
    const all = [...solids.values()];
    const count = (k) => all.filter((s) => s.kind === k).length;
    const S = sites();
    const even = S.filter((s) => !odd(s)).length;
    const alternating = ALTERNATING.includes(view.mode);
    const row = (k, v) => `<div><span class="w4d-info-k">${k}</span> ${v}</div>`;
    info.innerHTML = [
      row(t('roofFold.info.solids', L), all.length ? t('roofFold.info.counts', L, { cube: count('cube'), dodeca: count('dodeca'), ico: count('ico'), star: count('star') }) : t('hull.info.none', L)),
      all.length ? row(t('roofFold.info.sites', L), t('roofFold.info.siteCounts', L, { n: S.length, even, odd: S.length - even })) : '',
      row(t('roofFold.info.group', L), alternating ? ROOF_FOLD_PATTERNS[patternName()].group : 'Pm-3 (No. 200)'),
    ].join('');
  }

  // ---- panel ----
  const panel = document.createElement('div');
  panel.id = 'worldrooffold-panel';
  panel.className = 'qc-panel';
  panel.innerHTML = `
    <div class="w4d-row"><label class="hull-pick"><span class="rf-piece-label"></span> <select class="hull-select" data-select="piece"></select></label></div>
    <div class="w4d-row"><label class="hull-pick"><span class="rf-view-label"></span> <select class="hull-select" data-select="mode"></select></label></div>
    <div class="w4d-row rf-pattern-row"><label class="hull-pick"><span class="rf-pattern-label"></span> <select class="hull-select" data-select="pattern"></select></label></div>
    <div class="w4d-row w4d-options"></div>`;
  document.body.appendChild(panel);
  const pieceSelect = panel.querySelector('[data-select="piece"]');
  const modeSelect = panel.querySelector('[data-select="mode"]');
  const optionsRow = panel.querySelector('.w4d-options');
  const patternRow = panel.querySelector('.rf-pattern-row');
  const patternSelect = panel.querySelector('[data-select="pattern"]');
  function renderPanel() {
    panel.classList.toggle('visible', active);
    if (!active) return;
    const L = lang();
    panel.querySelector('.rf-piece-label').textContent = t('hull.piece', L);
    panel.querySelector('.rf-view-label').textContent = t('roofFold.view', L);
    pieceSelect.innerHTML = ROOF_FOLD_KINDS.map((k) => `<option value="${k}"${k === view.piece ? ' selected' : ''}>${t(`roofFold.${k}`, L)}</option>`).join('');
    modeSelect.innerHTML = VIEWS.map((v) => `<option value="${v}"${v === view.mode ? ' selected' : ''}>${t(`roofFold.view.${v}`, L)}</option>`).join('');
    patternRow.style.display = ALTERNATING.includes(view.mode) ? '' : 'none';
    panel.querySelector('.rf-pattern-label').textContent = t('roofFold.pattern', L);
    patternSelect.innerHTML = PATTERNS.filter((p) => p !== 'octants' || view.mode === 'checker')
      .map((p) => `<option value="${p}"${p === patternName() ? ' selected' : ''}>${t(`roofFold.pattern.${p}`, L)}</option>`).join('');
    // Checkerboard colours by the pattern itself; X-ray doesn't apply to the merged surface.
    optionsRow.innerHTML = [
      view.mode === 'checker' ? '' : `<button type="button" data-opt="parity" class="${view.parity ? 'active' : ''}">${t('roofFold.parity', L)}</button>`,
      view.mode === 'merged' ? '' : `<button type="button" data-opt="xray" class="${view.xray ? 'active' : ''}">${t('roofFold.xray', L)}</button>`,
      `<button type="button" data-opt="vertices" class="${view.vertices !== 'off' ? 'active' : ''}">${t('roofFold.vertices', L)}: ${t(`roofFold.vertices.${view.vertices}`, L)}</button>`,
      `<button type="button" data-opt="info" class="${infoOpen ? 'active' : ''}">${t('hyper.info', L)}</button>`,
    ].join('');
  }
  pieceSelect.addEventListener('change', () => {
    if (!ROOF_FOLD_KINDS.includes(pieceSelect.value)) return;
    view.piece = pieceSelect.value;
    save();
    rebuild();
  });
  modeSelect.addEventListener('change', () => {
    if (!VIEWS.includes(modeSelect.value)) return;
    view.mode = modeSelect.value;
    if (view.mode === 'checker' && view.vertices === 'off') view.vertices = 'cube';
    save();
    if (ALTERNATING.includes(view.mode)) showHudPrompt(t('roofFold.prompt.alt', lang()), 4000);
    rebuild();
  });
  patternSelect.addEventListener('change', () => {
    if (!PATTERNS.includes(patternSelect.value)) return;
    view.pattern = patternSelect.value;
    save();
    rebuild();
  });
  optionsRow.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-opt]');
    if (!b) return;
    if (b.dataset.opt === 'parity') { view.parity = !view.parity; save(); }
    else if (b.dataset.opt === 'xray') { view.xray = !view.xray; save(); }
    else if (b.dataset.opt === 'vertices') { view.vertices = VERTICES[(VERTICES.indexOf(view.vertices) + 1) % VERTICES.length]; save(); }
    else if (b.dataset.opt === 'info') infoOpen = !infoOpen;
    rebuild();
  });
  let shownLang = lang();
  onSettingsChange((st) => { if (st.language !== shownLang) { shownLang = st.language; if (active) rebuild(); } });

  return {
    group,
    meshes: () => pickTargets,
    handleTap,
    setActive(on) {
      if (on === active) return;
      active = on;
      group.visible = on;
      if (!on) { panel.classList.remove('visible'); info.classList.remove('visible'); }
      rebuild();
      if (on) fitBuild();
    },
    setSkeleton(on) { skeleton = on; if (active) rebuild(); },
    setTranslucent(o) { if (o !== opacity) { opacity = o; if (active) rebuild(); } },
    setLatticeView(on) { latticeView = on; if (active) rebuild(); },
    get isEmpty() { return solids.size === 0; },
    clear() { solids.clear(); commit(); },
    snapshot: toJSON,
    restore(json) { setFromJSON(json); save(); rebuild(); onChange(); },
    toJSON,
  };
}

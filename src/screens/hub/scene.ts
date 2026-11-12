// First-person stadium hub — pure math + Skia drawing, all worklets (runs on the UI thread).
// Camera stands on the centre spot of a pitch inside a stadium bowl; mode gates stand on an arc
// around it. Nothing here allocates React state; the Home screen feeds yaw / time shared values.
import { Skia, SkCanvas, SkPath, BlendMode, BlurStyle, PaintStyle, StrokeCap, TileMode, createPicture } from '@shopify/react-native-skia';
import type { Sky } from '../../ui/daytime';

export type GateDef = { key: string; ang: number; color: string; main?: boolean };
export type SceneCfg = { W: number; H: number; f: number; cy: number; camY: number; R: number; gw: number; gh: number; hq: boolean };
export const DEG = Math.PI / 180;

// camera space (x right, y up, z forward) for a world point; yaw = heading
export function toCam(x: number, y: number, z: number, yaw: number, camY: number) {
  'worklet';
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return [x * c + z * s, y - camY, x * s - z * c];
}
export function project(cx: number, cy: number, cz: number, cfg: SceneCfg) {
  'worklet';
  return [cfg.W / 2 + (cx / cz) * cfg.f, cfg.cy - (cy / cz) * cfg.f];
}
// gate radius pulls in a little when the gate is in focus
export function gateR(ang: number, yaw: number, R: number) {
  'worklet';
  let d = ang - yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const k = Math.max(0, 1 - Math.abs(d) / (16 * DEG));
  return R - .75 * k * k;
}
// screen rect of a gate (for hit tests and labels): [x0, y0, x1, y1, depth] or null when behind
export function gateRect(ang: number, yaw: number, cfg: SceneCfg) {
  'worklet';
  const R = gateR(ang, yaw, cfg.R), px = Math.sin(ang) * R, pz = -Math.cos(ang) * R;
  const c = toCam(px, 0, pz, yaw, cfg.camY); if (c[2] < .5) return null;
  const sx = cfg.W / 2 + (c[0] / c[2]) * cfg.f, k = cfg.f / c[2];
  const y0 = cfg.cy - ((cfg.gh - cfg.camY) * k), y1 = cfg.cy + cfg.camY * k;
  return [sx - cfg.gw / 2 * k, y0, sx + cfg.gw / 2 * k, y1, c[2]];
}

const clipZ = .25;
// clip a camera-space polygon to z > clipZ, then project
function polyPath(pts: number[][], cfg: SceneCfg) {
  'worklet';
  const out: number[][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ai = a[2] > clipZ, bi = b[2] > clipZ;
    if (ai) out.push(a);
    if (ai !== bi) { const t = (clipZ - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, clipZ]); }
  }
  if (out.length < 3) return null;
  const pb = Skia.PathBuilder.Make();
  for (let i = 0; i < out.length; i++) { const p = project(out[i][0], out[i][1], out[i][2], cfg); if (i) pb.lineTo(p[0], p[1]); else pb.moveTo(p[0], p[1]); }
  pb.close(); return pb.build();
}
function seg(pb: any, a: number[], b: number[], cfg: SceneCfg) {
  'worklet';
  let A = a, B = b;
  if (A[2] <= clipZ && B[2] <= clipZ) return;
  if (A[2] <= clipZ) { const t = (clipZ - A[2]) / (B[2] - A[2]); A = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, clipZ]; }
  if (B[2] <= clipZ) { const t = (clipZ - B[2]) / (A[2] - B[2]); B = [B[0] + (A[0] - B[0]) * t, B[1] + (A[1] - B[1]) * t, clipZ]; }
  const p = project(A[0], A[1], A[2], cfg), q = project(B[0], B[1], B[2], cfg); pb.moveTo(p[0], p[1]); pb.lineTo(q[0], q[1]);
}
const hex = (c: string, a: number) => { 'worklet'; const k = Skia.Color(c); return Float32Array.from([k[0], k[1], k[2], a]); };
const rnd = (i: number) => { 'worklet'; const r = Math.sin(i * 127.1 + 311.7) * 43758.5453; return r - Math.floor(r); };

export function drawScene(cfg: SceneCfg, yaw: number, t: number, sky: Sky, gates: GateDef[], icons: SkPath[][], focus: number) {
  'worklet';
  return createPicture((c: SkCanvas) => {
    const { W, H, camY } = cfg, horizon = cfg.cy;
    const p = Skia.Paint(); p.setAntiAlias(true);
    // ---- sky ----
    p.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: horizon }, [hex(sky.top, 1), hex(sky.mid, 1), hex(sky.low, 1)], [0, .6, 1], TileMode.Clamp));
    c.drawRect(Skia.XYWHRect(0, 0, W, horizon + 2), p); p.setShader(null);
    // stars (fixed directions in the sky dome)
    if (sky.stars > .02) {
      const sp = Skia.Paint(); sp.setAntiAlias(true);
      for (let i = 0; i < (cfg.hq ? 90 : 40); i++) {
        const a = rnd(i) * Math.PI * 2, el = .04 + rnd(i + 50) * .9; let d = a - yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        if (Math.abs(d) > 1.1) continue;
        const x = W / 2 + Math.tan(d) * cfg.f, y = horizon - Math.tan(el) * cfg.f * .9;
        const tw = .55 + .45 * Math.sin(t * (1 + rnd(i + 9) * 2) + i);
        sp.setColor(hex('#e8fbff', sky.stars * tw * (.4 + rnd(i + 3) * .6))); c.drawCircle(x, y, .6 + rnd(i + 7) * 1.4, sp);
      }
    }
    // sun / moon at a fixed bearing
    {
      let d = 35 * DEG - yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      if (Math.abs(d) < 1.1) {
        const x = W / 2 + Math.tan(d) * cfg.f, y = horizon - cfg.f * .55, day = sky.k === 'day' || sky.k === 'dawn';
        const g = Skia.Paint(); g.setAntiAlias(true);
        g.setShader(Skia.Shader.MakeRadialGradient({ x, y }, 90, [hex(day ? '#fff6d0' : '#cfe0ff', .55 * sky.sun), hex(day ? '#ffcf6a' : '#8fa8ff', 0)], null, TileMode.Clamp)); c.drawCircle(x, y, 90, g); g.setShader(null);
        g.setColor(hex(day ? '#fffbe8' : '#e6eeff', sky.sun)); c.drawCircle(x, y, day ? 18 : 14, g);
        if (!day) { g.setColor(hex(sky.top, 1)); c.drawCircle(x + 7, y - 4, 12, g); }
      }
    }
    // clouds
    if (sky.weather !== 'clear' && sky.k !== 'night') {
      const cp = Skia.Paint(); cp.setAntiAlias(true); cp.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 18, true));
      for (let i = 0; i < 7; i++) {
        let d = rnd(i + 20) * Math.PI * 2 + t * .004 - yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        if (Math.abs(d) > 1) continue;
        const x = W / 2 + Math.tan(d) * cfg.f, y = horizon - 60 - rnd(i + 30) * cfg.f * .5;
        cp.setColor(hex(sky.weather === 'rain' ? '#7a84a8' : '#ffffff', sky.weather === 'rain' ? .55 : .35));
        c.drawOval(Skia.XYWHRect(x - 90, y - 22, 180, 44), cp);
      }
    }
    // ---- ground ----
    p.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: horizon }, { x: 0, y: H }, [hex(sky.ground, 1), hex(sky.groundHi, 1)], null, TileMode.Clamp));
    c.drawRect(Skia.XYWHRect(0, horizon, W, H - horizon), p); p.setShader(null);
    // mowing stripes (3 m bands across the pitch, x ∈ [-34, 34], z ∈ [-52, 52])
    {
      const sp = Skia.Paint(); sp.setAntiAlias(true); sp.setColor(hex('#ffffff', .05 + sky.lights * .02));
      for (let i = 0; i < 12; i++) {
        const z0 = -52 + i * 9, z1 = z0 + 4.5;
        const P = [[-34, 0, z0], [34, 0, z0], [34, 0, z1], [-34, 0, z1]].map(q => toCam(q[0], q[1], q[2], yaw, camY));
        const path = polyPath(P, cfg); if (path) c.drawPath(path, sp);
      }
    }
    // pitch lines
    {
      const lp = Skia.Paint(); lp.setAntiAlias(true); lp.setStyle(PaintStyle.Stroke); lp.setStrokeWidth(2); lp.setColor(hex('#ffffff', .55));
      const pb = Skia.PathBuilder.Make(); const L = (a: number[], b: number[]) => seg(pb, toCam(a[0], 0, a[1], yaw, camY), toCam(b[0], 0, b[1], yaw, camY), cfg);
      L([-34, 0], [34, 0]); L([-34, -52], [34, -52]); L([-34, 52], [34, 52]); L([-34, -52], [-34, 52]); L([34, -52], [34, 52]);
      L([-20, -52], [-20, -36]); L([20, -52], [20, -36]); L([-20, -36], [20, -36]); L([-20, 52], [-20, 36]); L([20, 52], [20, 36]); L([-20, 36], [20, 36]);
      for (let i = 0; i < 48; i++) { const a0 = i / 48 * Math.PI * 2, a1 = (i + 1) / 48 * Math.PI * 2; L([Math.cos(a0) * 9.15, Math.sin(a0) * 9.15], [Math.cos(a1) * 9.15, Math.sin(a1) * 9.15]); }
      c.drawPath(pb.build(), lp);
    }
    // ---- stadium bowl (stands) ----
    {
      const sp = Skia.Paint(); sp.setAntiAlias(true);
      const tiers = [[38, 0, 42, 6, sky.k === 'day' ? '#2a2f6a' : '#1c1458'], [42, 6, 47, 12, sky.k === 'day' ? '#232760' : '#150e44'], [47, 12, 52, 17, sky.k === 'day' ? '#1c1f52' : '#0e0a30']];
      const a0 = yaw - 70 * DEG, step = 5 * DEG, n = 28;
      for (const tr of tiers) {
        sp.setColor(hex(tr[4] as string, 1));
        for (let i = 0; i < n; i++) {
          const a = a0 + i * step, b = a + step + .002;
          const P = [[Math.sin(a) * (tr[0] as number), tr[1] as number, -Math.cos(a) * (tr[0] as number)], [Math.sin(b) * (tr[0] as number), tr[1] as number, -Math.cos(b) * (tr[0] as number)], [Math.sin(b) * (tr[2] as number), tr[3] as number, -Math.cos(b) * (tr[2] as number)], [Math.sin(a) * (tr[2] as number), tr[3] as number, -Math.cos(a) * (tr[2] as number)]].map(q => toCam(q[0], q[1], q[2], yaw, camY));
          const path = polyPath(P, cfg); if (path) c.drawPath(path, sp);
        }
      }
      // seat rows
      const rowP = Skia.Paint(); rowP.setAntiAlias(true); rowP.setStyle(PaintStyle.Stroke); rowP.setStrokeWidth(1); rowP.setColor(hex('#8f7bff', .22));
      for (let rr = 0; rr < 8; rr++) {
        const r = 38.6 + rr * 1.7, y = (r - 38) * 1.2, pb = Skia.PathBuilder.Make();
        for (let i = 0; i < n; i++) { const a = a0 + i * step, b = a + step; seg(pb, toCam(Math.sin(a) * r, y, -Math.cos(a) * r, yaw, camY), toCam(Math.sin(b) * r, y, -Math.cos(b) * r, yaw, camY), cfg); }
        c.drawPath(pb.build(), rowP);
      }
      // roof canopy
      { sp.setColor(hex('#07051c', 1));
        for (let i = 0; i < n; i++) { const a = a0 + i * step, b = a + step + .002;
          const P = [[Math.sin(a) * 52, 17, -Math.cos(a) * 52], [Math.sin(b) * 52, 17, -Math.cos(b) * 52], [Math.sin(b) * 46, 21, -Math.cos(b) * 46], [Math.sin(a) * 46, 21, -Math.cos(a) * 46]].map(q => toCam(q[0], q[1], q[2], yaw, camY));
          const path = polyPath(P, cfg); if (path) c.drawPath(path, sp); } }
      // roof edge + tier glow lines
      const gp = Skia.Paint(); gp.setAntiAlias(true); gp.setStyle(PaintStyle.Stroke);
      const rings: [number, number, string, number][] = [[46, 21, '#27e6ff', 2.4], [52, 17, '#a43bff', 1.4], [47, 12, '#a43bff', 1.1], [38, 0, '#27e6ff', 1.6]];
      for (const [r, y, col, w] of rings) {
        const pb = Skia.PathBuilder.Make();
        for (let i = 0; i < n; i++) { const a = a0 + i * step, b = a + step; seg(pb, toCam(Math.sin(a) * r, y, -Math.cos(a) * r, yaw, camY), toCam(Math.sin(b) * r, y, -Math.cos(b) * r, yaw, camY), cfg); }
        const path = pb.build(); gp.setStrokeWidth(w * 3); gp.setColor(hex(col, .18)); c.drawPath(path, gp); gp.setStrokeWidth(w); gp.setColor(hex(col, .8)); c.drawPath(path, gp);
      }
      // crowd flashes / seat lights
      if (cfg.hq) {
        const dp = Skia.Paint(); dp.setAntiAlias(true);
        for (let i = 0; i < 220; i++) {
          const a = rnd(i + 200) * Math.PI * 2; let d = a - yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; if (Math.abs(d) > 1.1) continue;
          const r = 39 + rnd(i + 300) * 12, y = (r - 38) * 1.2;
          const q = toCam(Math.sin(a) * r, y, -Math.cos(a) * r, yaw, camY); if (q[2] < 1) continue; const s = project(q[0], q[1], q[2], cfg);
          const fl = Math.max(0, Math.sin(t * (2 + rnd(i) * 3) + i * 3)); dp.setColor(hex(rnd(i + 5) > .5 ? '#fff6d0' : '#9fefff', .25 + fl * .5)); c.drawCircle(s[0], s[1], 1 + fl, dp);
        }
      }
    }
    // ---- floodlight towers ----
    {
      const tp = Skia.Paint(); tp.setAntiAlias(true); const add = Skia.Paint(); add.setAntiAlias(true); add.setBlendMode(BlendMode.Plus);
      for (const ang of [-32, 32, -96, 96, -160, 160]) {
        const a = ang * DEG, r = 55; const base = toCam(Math.sin(a) * r, 0, -Math.cos(a) * r, yaw, camY), top = toCam(Math.sin(a) * r, 34, -Math.cos(a) * r, yaw, camY);
        if (top[2] < 2) continue; const b = project(base[0], base[1], base[2], cfg), tt = project(top[0], top[1], top[2], cfg);
        if (tt[0] < -80 || tt[0] > W + 80) continue;
        const k = cfg.f / top[2];
        tp.setColor(hex('#2a2460', 1)); tp.setStrokeWidth(Math.max(1.5, k * .8)); tp.setStyle(PaintStyle.Stroke); c.drawLine(b[0], b[1], tt[0], tt[1], tp);
        tp.setStyle(PaintStyle.Fill); tp.setColor(hex('#3a3480', 1)); c.drawRect(Skia.XYWHRect(tt[0] - k * 3, tt[1] - k * 2, k * 6, k * 2.6), tp);
        const L = sky.lights;
        if (L > .05) {
          add.setShader(Skia.Shader.MakeRadialGradient({ x: tt[0], y: tt[1] - k }, k * 14, [hex('#fffbe8', .9 * L), hex('#bfe9ff', .25 * L), hex('#bfe9ff', 0)], [0, .25, 1], TileMode.Clamp));
          c.drawCircle(tt[0], tt[1] - k, k * 14, add); add.setShader(null);
          // light cone toward the pitch
          const cone = Skia.PathBuilder.Make().moveTo(tt[0] - k * 2, tt[1]).lineTo(tt[0] + k * 2, tt[1]).lineTo(W / 2 + (W / 2 - tt[0]) * .2 + 60, horizon + 40).lineTo(W / 2 + (W / 2 - tt[0]) * .2 - 60, horizon + 40).close().build();
          add.setShader(Skia.Shader.MakeLinearGradient({ x: tt[0], y: tt[1] }, { x: tt[0], y: horizon + 40 }, [hex('#dff6ff', .16 * L), hex('#dff6ff', 0)], null, TileMode.Clamp)); c.drawPath(cone, add); add.setShader(null);
        }
      }
    }
    // ---- gates (far → near) ----
    const order: number[] = []; for (let i = 0; i < gates.length; i++) order.push(i);
    order.sort((a, b) => { const da = Math.abs(Math.atan2(Math.sin(gates[a].ang - yaw), Math.cos(gates[a].ang - yaw))), db = Math.abs(Math.atan2(Math.sin(gates[b].ang - yaw), Math.cos(gates[b].ang - yaw))); return db - da; });
    const gp = Skia.Paint(); gp.setAntiAlias(true);
    const glow = Skia.Paint(); glow.setAntiAlias(true); glow.setStyle(PaintStyle.Stroke); glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 7, true)); glow.setBlendMode(BlendMode.Plus);
    const line = Skia.Paint(); line.setAntiAlias(true); line.setStyle(PaintStyle.Stroke); line.setStrokeCap(StrokeCap.Round);
    const add = Skia.Paint(); add.setAntiAlias(true); add.setBlendMode(BlendMode.Plus);
    for (const gi of order) {
      const g = gates[gi], R = gateR(g.ang, yaw, cfg.R), px = Math.sin(g.ang) * R, pz = -Math.cos(g.ang) * R;
      const ctr = toCam(px, 0, pz, yaw, camY); if (ctr[2] < .8) continue;
      const sc = project(ctr[0], ctr[1], ctr[2], cfg); const k = cfg.f / ctr[2];
      if (sc[0] < -cfg.gw * k * 1.5 || sc[0] > W + cfg.gw * k * 1.5) continue;
      const foc = gi === focus, pulse = .5 + .5 * Math.sin(t * 3 + gi);
      const ux = Math.cos(g.ang), uz = Math.sin(g.ang), w = cfg.gw * (g.main ? 1.18 : 1), h = cfg.gh * (g.main ? 1.12 : 1), ch = w * .2;
      const P = (u: number, v: number) => toCam(px + ux * u, v, pz + uz * u, yaw, camY);
      // floor ring
      { const pb = Skia.PathBuilder.Make(); for (let i = 0; i < 28; i++) { const a0 = i / 28 * Math.PI * 2, a1 = (i + 1) / 28 * Math.PI * 2; seg(pb, toCam(px + Math.cos(a0) * w * .62, .02, pz + Math.sin(a0) * w * .62, yaw, camY), toCam(px + Math.cos(a1) * w * .62, .02, pz + Math.sin(a1) * w * .62, yaw, camY), cfg); }
        const rp = pb.build(); glow.setStrokeWidth(6); glow.setColor(hex(g.color, foc ? .9 : .45)); c.drawPath(rp, glow); line.setStrokeWidth(1.6); line.setColor(hex(g.color, .9)); c.drawPath(rp, line); }
      // light shaft
      { const top = project(ctr[0], h * 2.4 - camY, ctr[2], cfg), bw = w * .3 * k; add.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: sc[1] }, { x: 0, y: top[1] }, [hex(g.color, foc ? .2 : .08), hex(g.color, 0)], null, TileMode.Clamp));
        const sh = Skia.PathBuilder.Make().moveTo(sc[0] - bw, sc[1]).lineTo(sc[0] + bw, sc[1]).lineTo(sc[0] + bw * .35, top[1]).lineTo(sc[0] - bw * .35, top[1]).close().build();
        c.drawPath(sh, add); add.setShader(null); }
      // portal frame (chamfered hexagon standing on the floor)
      const shape = [[-w / 2 + ch, 0], [w / 2 - ch, 0], [w / 2, ch], [w / 2, h - ch], [w / 2 - ch, h], [-w / 2 + ch, h], [-w / 2, h - ch], [-w / 2, ch]].map(q => P(q[0], q[1]));
      const fp = polyPath(shape, cfg); if (!fp) continue;
      const topY = project(ctr[0], h - camY, ctr[2], cfg)[1];
      gp.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: topY }, { x: 0, y: sc[1] }, [hex(g.color, foc ? .5 : .32), hex('#0a0626', .92), hex('#05020f', .96)], [0, .55, 1], TileMode.Clamp));
      c.drawPath(fp, gp); gp.setShader(null);
      glow.setStrokeWidth(foc ? 10 : 6); glow.setColor(hex(g.color, (foc ? .75 : .4) + .15 * pulse)); c.drawPath(fp, glow);
      line.setStrokeWidth(foc ? 2.6 : 1.8); line.setColor(hex(g.color, 1)); c.drawPath(fp, line);
      const inner = polyPath([[-w / 2 + ch * 1.4, w * .1], [w / 2 - ch * 1.4, w * .1], [w / 2 - w * .1, ch + w * .1], [w / 2 - w * .1, h - ch - w * .1], [w / 2 - ch * 1.4, h - w * .1], [-w / 2 + ch * 1.4, h - w * .1], [-w / 2 + w * .1, h - ch - w * .1], [-w / 2 + w * .1, ch + w * .1]].map(q => P(q[0], q[1])), cfg);
      if (inner) { line.setStrokeWidth(1); line.setColor(hex('#ffffff', .25)); c.drawPath(inner, line); }
      // icon
      const ic = icons[gi]; if (ic && ic.length) {
        const cyI = project(ctr[0], h * .56 - camY + Math.sin(t * 2 + gi) * .06, ctr[2], cfg)[1], s = (w * .55 * k) / 64;
        c.save(); c.translate(sc[0] - 32 * s, cyI - 32 * s); c.scale(s, s);
        const ip = Skia.Paint(); ip.setAntiAlias(true); ip.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 4 }, { x: 0, y: 60 }, [hex('#ffffff', 1), hex(g.color, 1)], null, TileMode.Clamp));
        const ig = Skia.Paint(); ig.setAntiAlias(true); ig.setStyle(PaintStyle.Stroke); ig.setStrokeWidth(6); ig.setColor(hex(g.color, .35));
        c.drawPath(ic[0], ig); c.drawPath(ic[0], ip);
        if (ic[1]) { const il = Skia.Paint(); il.setAntiAlias(true); il.setStyle(PaintStyle.Stroke); il.setStrokeWidth(2.6); il.setStrokeCap(StrokeCap.Round); il.setColor(hex('#0a0626', .85)); c.drawPath(ic[1], il); }
        c.restore();
      }
      // sparkles orbiting the focused gate
      if (foc && cfg.hq) for (let i = 0; i < 6; i++) {
        const a = t * 1.3 + i * 1.047, q = toCam(px + Math.cos(a) * w * .7, .3 + ((t * .6 + i * .3) % 1) * h, pz + Math.sin(a) * w * .7, yaw, camY);
        if (q[2] < .5) continue; const s = project(q[0], q[1], q[2], cfg); add.setColor(hex(i % 2 ? '#ffffff' : g.color, .8)); c.drawCircle(s[0], s[1], 2.2, add);
      }
    }
    // ---- dust motes / rain ----
    if (cfg.hq) {
      const dp = Skia.Paint(); dp.setAntiAlias(true); dp.setBlendMode(BlendMode.Plus);
      for (let i = 0; i < 40; i++) {
        const a = rnd(i + 400) * Math.PI * 2, r = 2.5 + rnd(i + 500) * 9, y = ((rnd(i + 600) * 6 + t * (.15 + rnd(i) * .2)) % 6);
        const q = toCam(Math.sin(a) * r, y, -Math.cos(a) * r, yaw, camY); if (q[2] < .4) continue; const s = project(q[0], q[1], q[2], cfg);
        dp.setColor(hex(i % 3 ? '#9fefff' : '#e0b8ff', .35 * Math.min(1, y) * (1 - y / 6))); c.drawCircle(s[0], s[1], 1 + 6 / q[2], dp);
      }
    }
    if (sky.weather === 'rain') {
      const rp = Skia.Paint(); rp.setAntiAlias(true); rp.setStrokeWidth(1.2); rp.setColor(hex('#cfe0ff', .35));
      for (let i = 0; i < (cfg.hq ? 70 : 30); i++) { const x = rnd(i + 700) * W, y = ((rnd(i + 800) * H + t * (700 + rnd(i) * 300)) % (H + 40)) - 20; c.drawLine(x, y, x - 3, y + 14, rp); }
    }
    // vignette
    const vg = Skia.Paint(); vg.setShader(Skia.Shader.MakeRadialGradient({ x: W / 2, y: H * .5 }, Math.max(W, H) * .75, [hex('#000000', 0), hex('#02010a', .65)], [.55, 1], TileMode.Clamp));
    c.drawRect(Skia.XYWHRect(0, 0, W, H), vg);
  }, Skia.XYWHRect(0, 0, cfg.W, cfg.H));
}

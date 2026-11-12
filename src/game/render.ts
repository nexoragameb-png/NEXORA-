// Skia renderer for the NEXORA match. Records one SkPicture per frame.
import { Skia, SkCanvas, SkImage, SkPaint, SkPicture, TileMode, FilterMode, MipmapMode, BlendMode, PaintStyle, StrokeCap, BlurStyle, ClipOp, createPicture } from '@shopify/react-native-skia';
import { Engine, Body, PR, aimPreview } from './engine';
import { TRAILS } from './data';

const BALL_SKSL = `
uniform shader img;
uniform float3 c0;
uniform float3 c1;
uniform float3 c2;
uniform float isz;
uniform float aa;
half4 main(float2 p){
  float d=length(p);
  if(d>1.0) return half4(0);
  float z=sqrt(max(0.0,1.0-d*d));
  float3 n=float3(p.x,p.y,z);
  float3 q=float3(dot(c0,n),dot(c1,n),dot(c2,n));
  float2 uv=q.xy; if(q.z<0.0) uv.x=-uv.x;
  half4 c=img.eval((uv*0.93*0.5+0.5)*isz);
  float3 L=normalize(float3(-0.42,-0.55,0.72));
  float dif=0.62+0.5*max(dot(n,L),0.0);
  float3 H=normalize(L+float3(0,0,1));
  float sp=pow(max(dot(n,H),0.0),36.0)*0.55;
  float rim=pow(1.0-z,2.5);
  float3 col=c.rgb*dif*(1.0-0.45*rim)+float3(sp)+float3(0.35,0.6,1.0)*rim*0.18;
  float a=smoothstep(1.0,1.0-aa,d);
  return half4(half3(col)*a,a);
}`;
const ballFx = Skia.RuntimeEffect.Make(BALL_SKSL)!;

const col = (c: string, a = 1) => { const k = Skia.Color(c); return Float32Array.from([k[0], k[1], k[2], k[3] * a]); };
const TEAM_GLOW = ['#36c8ff', '#ff3d6e'];
const TEAM_HI = ['#c8f3ff', '#ffd0dc'];

export type Images = { field: SkImage | null; goal: SkImage | null; ball: SkImage | null; t0: SkImage | null; t1: SkImage | null };
export type View = { W: number; H: number; s: number; ox: number; oy: number };

export function computeView(e: Engine, W: number, H: number, top: number, bottom: number): View {
  const f = e.f, FS = 1.12;
  const playH = Math.max(300, H - top - bottom);
  const s = Math.min(W / (f.R - f.L + 56 * FS), playH / ((f.B - f.T) + 2 * e.GG.h + 48)) * .99;
  return { W, H, s, ox: W / 2 - e.CX * s, oy: top + playH / 2 - e.CY * s };
}

const P = () => { const p = Skia.Paint(); p.setAntiAlias(true); return p; };
const paints = {
  img: P(), fill: P(), stroke: P(), add: P(), add2: P(), glow: P(), shadow: P(), dark: P(),
};
paints.add2.setStyle(PaintStyle.Stroke); paints.add2.setBlendMode(BlendMode.Plus);
paints.stroke.setStyle(PaintStyle.Stroke); paints.stroke.setStrokeCap(StrokeCap.Round);
paints.add.setBlendMode(BlendMode.Plus);
paints.glow.setStyle(PaintStyle.Stroke); paints.glow.setBlendMode(BlendMode.Plus); paints.glow.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 6, true));

export function staticLayer(e: Engine, v: View, im: Images): SkPicture {
  return createPicture((c: SkCanvas) => {
    const p = P(); p.setColor(Skia.Color('#02040c')); c.drawRect(Skia.XYWHRect(0, 0, v.W, v.H), p);
    const f = e.f;
    if (im.field) {
      // blurred, darkened stadium fill behind everything
      const k = Math.max(v.W / f.W, v.H / f.H) * 1.05;
      const bp = P(); bp.setImageFilter(Skia.ImageFilter.MakeBlur(14, 14, TileMode.Clamp, null));
      c.drawImageRect(im.field, Skia.XYWHRect(0, 0, im.field.width(), im.field.height()), Skia.XYWHRect((v.W - f.W * k) / 2, (v.H - f.H * k) / 2, f.W * k, f.H * k), bp);
      const d = P(); d.setColor(Skia.Color('rgba(2,4,14,0.62)')); c.drawRect(Skia.XYWHRect(0, 0, v.W, v.H), d);
      c.save(); c.translate(v.ox, v.oy); c.scale(v.s, v.s);
      // sharp field with soft feathered edges
      c.saveLayer(undefined, Skia.XYWHRect(-40, -40, f.W + 80, f.H + 80));
      c.drawImageRectOptions(im.field, Skia.XYWHRect(0, 0, im.field.width(), im.field.height()), Skia.XYWHRect(0, 0, f.W, f.H), FilterMode.Linear, MipmapMode.Linear, null);
      const m = P(); m.setBlendMode(BlendMode.DstIn);
      m.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: f.H }, [col('#000', 0), col('#000'), col('#000'), col('#000', 0)], [0, .06, .94, 1], TileMode.Clamp));
      c.drawRect(Skia.XYWHRect(0, 0, f.W, f.H), m);
      m.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: f.W, y: 0 }, [col('#000', 0), col('#000'), col('#000'), col('#000', 0)], [0, .05, .95, 1], TileMode.Clamp));
      c.drawRect(Skia.XYWHRect(0, 0, f.W, f.H), m);
      c.restore();
      // subtle neon outline of the playing area
      const F = e.F, o = P(); o.setStyle(PaintStyle.Stroke); o.setStrokeWidth(3); o.setColor(Skia.Color('rgba(120,220,255,0.35)'));
      o.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 4, true));
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(F.l, F.t, F.r - F.l, F.b - F.t), 70, 70), o);
      c.restore();
    }
  }, { width: v.W, height: v.H });
}

// ---- pre-rendered sprites (built once per team logo; per-frame cost = 2-3 drawImage calls) ----
const SPR = 192, sprCache = new Map<any, { disc: SkImage; gloss: SkImage }>();
let shadowSpr: SkImage | null = null;
function makeImg(w: number, h: number, draw: (c: SkCanvas) => void): SkImage | null {
  // CPU raster surface: built once, no extra GPU/WebGL context, safe to draw from any thread
  const surf = Skia.Surface.Make(w, h);
  if (!surf) return null;
  const c = surf.getCanvas(); c.clear(Float32Array.from([0, 0, 0, 0])); draw(c); surf.flush?.();
  const img = surf.makeImageSnapshot(); const ni = (img as any).makeNonTextureImage?.();
  return ni || img;
}
function sprites(team: 0 | 1, logo: SkImage | null) {
  const key = logo || team; const hit = sprCache.get(key); if (hit) return hit;
  const R = SPR / 2, r = R - 2;
  const disc = makeImg(SPR, SPR, c => {
    // v3: no solid red/blue team disc underneath any more: the metallic art fills the piece and the
    // team reads from the neon ring drawn around it (see ringSprite / drawPiece)
    if (logo) {
      const dk = P(); dk.setColor(col('#050816')); c.drawCircle(R, R, r * .97, dk);
      c.drawImageRectOptions(logo, Skia.XYWHRect(0, 0, logo.width(), logo.height()), Skia.XYWHRect(R - r, R - r, r * 2, r * 2), FilterMode.Linear, MipmapMode.Linear, null);
    } else {
      const dk = P(); dk.setShader(Skia.Shader.MakeRadialGradient({ x: R - r * .3, y: R - r * .35 }, r * 1.2, [col('#3a4468'), col('#0b0f24')], null, TileMode.Clamp)); c.drawCircle(R, R, r * .97, dk);
      const edge = P(); edge.setStyle(PaintStyle.Stroke); edge.setStrokeWidth(4); edge.setColor(col(TEAM_GLOW[team], .9)); c.drawCircle(R, R, r * .8, edge);
    }
  })!;
  const gloss = makeImg(SPR, SPR, c => {
    if (logo) { const sp = P(); sp.setStyle(PaintStyle.Stroke); sp.setStrokeCap(StrokeCap.Round); sp.setStrokeWidth(4); sp.setColor(col('#ffffff', .35)); c.drawArc(Skia.XYWHRect(R - r * .95, R - r * .95, r * 1.9, r * 1.9), 205, 60, false, sp); return; }
    const gl = P(); gl.setShader(Skia.Shader.MakeRadialGradient({ x: R - r * .35, y: R - r * .45 }, r * .95, [col('#ffffff', .42), col('#ffffff', .08), col('#ffffff', 0)], [0, .45, 1], TileMode.Clamp));
    c.drawCircle(R, R, r * .86, gl);
    const sp = P(); sp.setStyle(PaintStyle.Stroke); sp.setStrokeCap(StrokeCap.Round); sp.setStrokeWidth(5); sp.setColor(col('#ffffff', .6));
    c.drawArc(Skia.XYWHRect(R - r * .95, R - r * .95, r * 1.9, r * 1.9), 200, 70, false, sp);
  })!;
  const v = { disc, gloss }; sprCache.set(key, v); return v;
}
function shadowSprite() {
  if (shadowSpr) return shadowSpr;
  shadowSpr = makeImg(128, 128, c => { const p = P(); p.setShader(Skia.Shader.MakeRadialGradient({ x: 64, y: 64 }, 64, [col('#000', 1), col('#000', .5), col('#000', 0)], [0, .55, 1], TileMode.Clamp)); c.drawCircle(64, 64, 64, p); });
  return shadowSpr;
}
const sprPaint = P(); const shPaint = P();
function drawShadowFast(c: SkCanvas, x: number, y: number, r: number, a: number) {
  const s = shadowSprite(); if (!s) return; const R = r * 1.3; shPaint.setAlphaf(a);
  c.drawImageRectOptions(s, Skia.XYWHRect(0, 0, 128, 128), Skia.XYWHRect(x + r * .14 - R, y + r * .26 - R, 2 * R, 2 * R), FilterMode.Linear, MipmapMode.None, shPaint);
}

// team-tinted neon ring (pre-rendered once per team: blurred halo + crisp double line + tick marks)
const RS = 256, ringCache: (SkImage | null)[] = [null, null];
function ringSprite(team: 0 | 1) {
  if (ringCache[team]) return ringCache[team];
  const R = RS / 2, rr = R * .78; // ring radius inside the sprite; maps to piece r + 5
  ringCache[team] = makeImg(RS, RS, c => {
    const g = P(); g.setStyle(PaintStyle.Stroke); g.setStrokeWidth(16); g.setColor(col(TEAM_GLOW[team], .45)); g.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 9, true)); c.drawCircle(R, R, rr, g);
    const l = P(); l.setStyle(PaintStyle.Stroke); l.setStrokeWidth(5); l.setShader(Skia.Shader.MakeSweepGradient(R, R, [col(TEAM_GLOW[team]), col(TEAM_HI[team]), col(TEAM_GLOW[team]), col(TEAM_HI[team]), col(TEAM_GLOW[team])], null, TileMode.Clamp)); c.drawCircle(R, R, rr, l);
    const t = P(); t.setStyle(PaintStyle.Stroke); t.setStrokeWidth(1.6); t.setColor(col(TEAM_HI[team], .55)); c.drawCircle(R, R, rr + 9, t);
    const k = P(); k.setStyle(PaintStyle.Stroke); k.setStrokeWidth(3); k.setStrokeCap(StrokeCap.Round); k.setColor(col('#ffffff', .8));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; c.drawLine(R + Math.cos(a) * (rr + 6), R + Math.sin(a) * (rr + 6), R + Math.cos(a) * (rr + 12), R + Math.sin(a) * (rr + 12), k); }
  });
  return ringCache[team];
}
const ringPaint = (() => { const p = P(); p.setBlendMode(BlendMode.Plus); return p; })();
const arcPaint = (() => { const p = P(); p.setStyle(PaintStyle.Stroke); p.setStrokeCap(StrokeCap.Round); p.setBlendMode(BlendMode.Plus); return p; })();

function drawPiece(c: SkCanvas, e: Engine, b: Body, x: number, y: number, img: SkImage | null, t: number, active: boolean, dark: boolean, held: boolean) {
  const team = b.team as 0 | 1, sc = 1 + b.sq * .07, r = b.r * sc;
  drawShadowFast(c, x, y, r, .5);
  if (b.tr.length > 1) {
    const ap = paints.add;
    for (let i = 0; i < b.tr.length; i++) { const q = b.tr[i], k = (i + 1) / b.tr.length; ap.setColor(col(TEAM_GLOW[team], .08 * k)); c.drawCircle(q.x, q.y, r * (.6 + .35 * k), ap); }
  }
  // neon team ring: dimmer for the side that is waiting, breathing for the side to move
  const rs = ringSprite(team);
  if (rs) {
    const pulse = active ? .5 + .5 * Math.sin(t * 4.2) : 0, rr = (r + 5 + pulse * 1.5) / .78;
    ringPaint.setAlphaf(dark ? .45 : active ? .8 + .2 * pulse : .75);
    c.drawImageRectOptions(rs, Skia.XYWHRect(0, 0, RS, RS), Skia.XYWHRect(x - rr, y - rr, 2 * rr, 2 * rr), FilterMode.Linear, MipmapMode.None, ringPaint);
  }
  if (active || held) {
    // orbiting arc segments; the held (selected) disc spins faster and tighter
    const sp = held ? 3.2 : 1.1, rad = r + (held ? 13 : 15), w = held ? 4.5 : 3, rot = (t * sp * 57.2958) % 360;
    arcPaint.setStrokeWidth(w); arcPaint.setColor(col(held ? '#ffffff' : TEAM_HI[team], held ? .95 : .7));
    const box = Skia.XYWHRect(x - rad, y - rad, rad * 2, rad * 2);
    for (let i = 0; i < 3; i++) c.drawArc(box, rot + i * 120, held ? 62 : 38, false, arcPaint);
  }
  const s = sprites(team, img);
  c.save(); c.translate(x, y); c.rotate(b.ang * 57.2958, 0, 0);
  c.drawImageRectOptions(s.disc, Skia.XYWHRect(0, 0, SPR, SPR), Skia.XYWHRect(-r, -r, 2 * r, 2 * r), FilterMode.Linear, MipmapMode.None, sprPaint);
  c.restore();
  if (dark) { const dk = paints.dark; dk.setColor(col('#060818', .34)); c.drawCircle(x, y, r * .99, dk); }
  c.drawImageRectOptions(s.gloss, Skia.XYWHRect(0, 0, SPR, SPR), Skia.XYWHRect(x - r, y - r, 2 * r, 2 * r), FilterMode.Linear, MipmapMode.None, sprPaint);
  void e;
}

function drawBall(c: SkCanvas, b: Body, x: number, y: number, img: SkImage | null, s: number) {
  const r = b.r * (1 + b.sq * .08);
  drawShadowFast(c, x, y, r, .6);
  if (!img) { const p = paints.fill; p.setColor(col('#ffffff')); c.drawCircle(x, y, r, p); return; }
  const R = b.R, isz = img.width();
  const sh = ballFx.makeShaderWithChildren([R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8], isz, Math.min(.2, 1.6 / (r * s))],
    [img.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None)]);
  const p = paints.img; p.setShader(sh);
  c.save(); c.translate(x, y); c.scale(r, r); c.drawCircle(0, 0, 1, p); c.restore(); p.setShader(null);
}

// soft additive halo under a fast ball (pre-rendered sprite, one drawImage)
let haloSpr: SkImage | null = null; const haloCF = new Map<string, any>();
const haloPaint = (() => { const p = P(); p.setBlendMode(BlendMode.Plus); return p; })();
function drawBallHalo(c: SkCanvas, e: Engine, x: number, y: number, ballIdx: number) {
  const sp = Math.hypot(e.ball.vx, e.ball.vy); if (sp < 120) return;
  if (!haloSpr) haloSpr = makeImg(128, 128, cc => { const p = P(); p.setShader(Skia.Shader.MakeRadialGradient({ x: 64, y: 64 }, 64, [col('#ffffff', .9), col('#ffffff', .25), col('#ffffff', 0)], [0, .35, 1], TileMode.Clamp)); cc.drawCircle(64, 64, 64, p); });
  if (!haloSpr) return;
  const tc = (TRAILS[ballIdx % TRAILS.length] || TRAILS[0]).c[0], R = e.ball.r * (2.2 + Math.min(1.4, sp / 1400));
  let cf = haloCF.get(tc); if (!cf) { cf = Skia.ColorFilter.MakeBlend(Skia.Color(tc), BlendMode.SrcIn); haloCF.set(tc, cf); } haloPaint.setColorFilter(cf); haloPaint.setAlphaf(Math.min(.55, sp / 2600));
  c.drawImageRectOptions(haloSpr, Skia.XYWHRect(0, 0, 128, 128), Skia.XYWHRect(x - R, y - R, 2 * R, 2 * R), FilterMode.Linear, MipmapMode.None, haloPaint);
}

// goal: expanding double shockwave + glowing goal mouth
function drawGoalFx(c: SkCanvas, e: Engine, t: number) {
  const w = e.wave; const g = paints.add2;
  if (w) {
    const k = w.a / 1.2, cc = TEAM_GLOW[w.t];
    for (let i = 0; i < 2; i++) {
      const kk = Math.max(0, k - i * .18); if (kk <= 0) continue;
      g.setStrokeWidth(18 * (1 - kk) + 2); g.setColor(col(i ? '#ffffff' : cc, .75 * (1 - kk)));
      c.drawCircle(w.x, w.y, 40 + kk * 520, g);
    }
  }
  // the goal line of the team in possession glows softly; flashes after a goal
  for (const gl of e.goals) {
    const a = .12 + .06 * Math.sin(t * 3 + gl.team) + (w && w.t === gl.team ? .6 * (1 - w.a / 1.2) : 0);
    g.setStrokeWidth(6); g.setColor(col(TEAM_GLOW[gl.team === 0 ? 1 : 0], a)); c.drawLine(gl.x1, gl.y, gl.x2, gl.y, g);
  }
}

function drawTrail(c: SkCanvas, e: Engine, ballIdx: number) {
  const tr = e.trail, n = tr.length; if (n < 2) return;
  const cs = (TRAILS[ballIdx % TRAILS.length] || TRAILS[0]).c, BW = e.ball.r, p = paints.stroke;
  p.setBlendMode(BlendMode.Plus);
  const layers: [number, number, string][] = [[2.2, .16, cs[0]], [1.1, .42, cs[1] || cs[0]], [.42, .95, cs[2] || '#ffffff']];
  for (const [w, a, cc] of layers) for (let i = 1; i < n; i++) {
    const q = tr[i], o = tr[i - 1], k = i / n;
    p.setStrokeWidth(Math.max(.6, BW * w * k * q.a)); p.setColor(col(cc, Math.min(1, a * q.a * (.35 + .65 * k))));
    c.drawLine(o.x, o.y, q.x, q.y, p);
  }
  p.setBlendMode(BlendMode.SrcOver);
}

// power colour: green → yellow → red, continuous
const lerpC = (a: number[], b: number[], k: number) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const PC = [[.24, 1, .66], [1, .82, .34], [1, .29, .35]];
function powerCol(p: number, a = 1) { const c = p < .5 ? lerpC(PC[0], PC[1], p / .5) : lerpC(PC[1], PC[2], (p - .5) / .5); return Float32Array.from([c[0], c[1], c[2], a]); }
const aimGlow = (() => { const p = P(); p.setBlendMode(BlendMode.Plus); p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 9, true)); return p; })();
const aimFill = P();
const aimLine = (() => { const p = P(); p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(2.2); return p; })();
const dotPaint = (() => { const p = P(); p.setBlendMode(BlendMode.Plus); return p; })();

// classic aiming arrow: tapered shaft + notched arrowhead, length and colour follow the power,
// plus a dotted trajectory hint (bounces off the side walls) whose length depends on disc accuracy
function drawAim(c: SkCanvas, e: Engine, t: number) {
  const a = e.aimInfo(); if (!a || a.p <= 0) return;
  const b = a.b, x = b.x, y = b.y, pw = a.p, team = b.team as 0 | 1, ux = a.ux, uy = a.uy, nx = -uy, ny = ux;
  // power ring around the disc
  arcPaint.setStrokeWidth(5); arcPaint.setColor(powerCol(pw, .95));
  c.drawArc(Skia.XYWHRect(x - b.r - 20, y - b.r - 20, (b.r + 20) * 2, (b.r + 20) * 2), -90, 360 * pw, false, arcPaint);
  const s0 = b.r + 24, L = 70 + pw * 240, hl = 34 + pw * 12, hw = 21 + pw * 8, w0 = 3.5, w1 = 8 + pw * 5;
  const bx = x + ux * s0, by = y + uy * s0, tipx = bx + ux * L, tipy = by + uy * L, nkx = tipx - ux * hl, nky = tipy - uy * hl;
  const back = hl * .22; // notch: wings sit slightly behind the neck
  const pb = Skia.PathBuilder.Make();
  pb.moveTo(bx + nx * w0, by + ny * w0)
    .lineTo(nkx + nx * w1, nky + ny * w1)
    .lineTo(nkx - ux * back + nx * hw, nky - uy * back + ny * hw)
    .lineTo(tipx, tipy)
    .lineTo(nkx - ux * back - nx * hw, nky - uy * back - ny * hw)
    .lineTo(nkx - nx * w1, nky - ny * w1)
    .lineTo(bx - nx * w0, by - ny * w0)
    .quadTo(bx - ux * 5, by - uy * 5, bx + nx * w0, by + ny * w0).close();
  const path = pb.build();
  aimGlow.setColor(powerCol(pw, .55)); c.drawPath(path, aimGlow);
  aimFill.setShader(Skia.Shader.MakeLinearGradient({ x: bx, y: by }, { x: tipx, y: tipy }, [powerCol(pw, .25), powerCol(pw, .95), col('#ffffff', 1)], [0, .62, 1], TileMode.Clamp));
  c.drawPath(path, aimFill); aimFill.setShader(null);
  aimLine.setColor(col('#ffffff', .75)); c.drawPath(path, aimLine);
  // dotted trajectory with side-wall reflection
  const steps = Math.max(3, Math.round((6 + pw * 8) * (e.cfg.stats ? aimPreview(e.statsOf(team).accuracy) : 1)));
  let px = tipx, py = tipy, dx = ux, dy = uy; const F = e.F, gap = 30, ph = (t * 40) % gap;
  for (let i = 0; i < steps; i++) {
    const step = i === 0 ? 18 + ph : gap; px += dx * step; py += dy * step;
    if (px < F.l + 10) { px = 2 * (F.l + 10) - px; dx = -dx; } else if (px > F.r - 10) { px = 2 * (F.r - 10) - px; dx = -dx; }
    if (py < F.t || py > F.b) break;
    const k = 1 - i / steps; dotPaint.setColor(team ? col('#ffd0dc', .7 * k) : col('#c8f3ff', .7 * k)); c.drawCircle(px, py, 2.2 + 2.6 * k, dotPaint);
  }
  // soft tether back toward the finger
  const tl = b.r + 14 + pw * 60; aimLine.setColor(col('#ffffff', .22)); c.drawLine(x - ux * b.r, y - uy * b.r, x - ux * tl, y - uy * tl, aimLine);
}

function drawParts(c: SkCanvas, e: Engine) {
  if (!e.parts.length) return; const p = paints.add;
  for (const q of e.parts) { const k = Math.max(0, q.l / q.m); p.setColor(col(q.c, Math.min(1, k * 1.2))); c.drawCircle(q.x, q.y, q.r * (q.k === 3 ? 1.3 : .6 + k * .8), p); }
}

function drawGoals(c: SkCanvas, e: Engine, im: SkImage | null, t: number) {
  if (!im) return;
  const GG = e.GG, iw = im.width(), ih = im.height();
  e.goals.forEach((g, i) => {
    const sx = Math.sin(t * 40) * 8 * e.shake[i];
    if (g.d < 0) c.drawImageRectOptions(im, Skia.XYWHRect(0, 0, iw, ih), Skia.XYWHRect(GG.x + sx, g.y - GG.h - 2, GG.w, GG.h), FilterMode.Linear, MipmapMode.Linear, null);
    else { c.save(); c.translate(0, g.y + 2 + GG.h); c.scale(1, -1); c.drawImageRectOptions(im, Skia.XYWHRect(0, 0, iw, ih), Skia.XYWHRect(GG.x + sx, 0, GG.w, GG.h), FilterMode.Linear, MipmapMode.Linear, null); c.restore(); }
  });
}

export function frame(e: Engine, v: View, im: Images, bg: SkPicture | null, ballIdx: number, t: number, hq = true): SkPicture {
  return createPicture((c: SkCanvas) => {
    if (bg) c.drawPicture(bg);
    // smooth (noise-like) camera shake instead of per-frame random jitter
    const cam = e.cam, shx = cam > .05 ? (Math.sin(t * 61) + Math.sin(t * 37.3) * .6) * cam * 2.6 : 0, shy = cam > .05 ? (Math.sin(t * 53.7) + Math.sin(t * 29.1) * .6) * cam * 2.6 : 0;
    c.save(); c.translate(v.ox + shx, v.oy + shy); c.scale(v.s, v.s);
    const al = e.alpha();
    drawGoals(c, e, im.goal, t);
    if (hq) drawGoalFx(c, e, t);
    const pos = (b: Body) => [b.px + (b.x - b.px) * al + b.vox, b.py + (b.y - b.py) * al + b.voy];
    const aimTeam = e.phase === 'aim' ? e.turn : -1;
    for (const b of e.bodies) if (b !== e.ball) { const [x, y] = pos(b); drawPiece(c, e, b, x, y, b.team === 0 ? im.t0 : im.t1, t, b.team === aimTeam && !e.drag && !e.isAiTurn(), e.phase === 'aim' && b.team !== e.turn, !!e.drag && e.drag.b === b); }
    drawTrail(c, e, ballIdx);
    { const [x, y] = pos(e.ball); if (hq) drawBallHalo(c, e, x, y, ballIdx); drawBall(c, e.ball, x, y, im.ball, v.s); }
    drawAim(c, e, t);
    drawParts(c, e);
    c.restore();
    if (e.flash > 0) { const p = paints.fill; p.setColor(col('#ffffff', e.flash * .28)); c.drawRect(Skia.XYWHRect(0, 0, v.W, v.H), p); }
  }, { width: v.W, height: v.H });
}

export function toWorld(v: View, x: number, y: number) { return { x: (x - v.ox) / v.s, y: (y - v.oy) / v.s }; }
export type { SkPaint };

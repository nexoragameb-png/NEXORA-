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
const TEAM_RING = [['#1d4bff', '#8fe6ff', '#2e7bff', '#c9f4ff', '#1d4bff'], ['#ff2b4a', '#ffc08a', '#d81b3c', '#ffe1c4', '#ff2b4a']];
const TEAM_GLOW = ['#3bb6ff', '#ff5b6b'];

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
    const ring = P(); ring.setShader(Skia.Shader.MakeSweepGradient(R, R, TEAM_RING[team].map(s => col(s)), null, TileMode.Clamp));
    c.drawCircle(R, R, r, ring);
    const dk = P(); dk.setColor(col('#050816')); c.drawCircle(R, R, r * .87, dk);
    if (logo) {
      c.save(); c.clipRRect(Skia.RRectXY(Skia.XYWHRect(R - r * .84, R - r * .84, r * 1.68, r * 1.68), r * .84, r * .84), ClipOp.Intersect, true);
      c.drawImageRectOptions(logo, Skia.XYWHRect(0, 0, logo.width(), logo.height()), Skia.XYWHRect(R - r * .9, R - r * .9, r * 1.8, r * 1.8), FilterMode.Linear, MipmapMode.Linear, null);
      c.restore();
    }
    const edge = P(); edge.setStyle(PaintStyle.Stroke); edge.setStrokeWidth(3); edge.setColor(col('#000000', .35)); c.drawCircle(R, R, r * .87, edge);
  })!;
  const gloss = makeImg(SPR, SPR, c => {
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

function drawPiece(c: SkCanvas, e: Engine, b: Body, x: number, y: number, img: SkImage | null, t: number, active: boolean, dark: boolean) {
  const team = b.team as 0 | 1, sc = 1 + b.sq * .07, r = b.r * sc;
  drawShadowFast(c, x, y, r, .5);
  if (b.tr.length > 1) {
    const ap = paints.add;
    for (let i = 0; i < b.tr.length; i++) { const q = b.tr[i], k = (i + 1) / b.tr.length; ap.setColor(col(TEAM_GLOW[team], .08 * k)); c.drawCircle(q.x, q.y, r * (.6 + .35 * k), ap); }
  }
  if (active) {
    const pulse = .55 + .45 * Math.sin(t * 5.5), g = paints.add2;
    g.setStrokeWidth(14); g.setColor(col(TEAM_GLOW[team], .16 + .12 * pulse)); c.drawCircle(x, y, r + 8 + pulse * 3, g);
    g.setStrokeWidth(3.5); g.setColor(col(TEAM_GLOW[team], .6 + .35 * pulse)); c.drawCircle(x, y, r + 7 + pulse * 3, g);
  }
  const s = sprites(team, img);
  c.save(); c.translate(x, y); c.rotate(b.ang * 57.2958, 0, 0);
  c.drawImageRectOptions(s.disc, Skia.XYWHRect(0, 0, SPR, SPR), Skia.XYWHRect(-r, -r, 2 * r, 2 * r), FilterMode.Linear, MipmapMode.None, sprPaint);
  c.restore();
  if (dark) { const dk = paints.dark; dk.setColor(col('#060818', .38)); c.drawCircle(x, y, r * .99, dk); }
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

function drawAim(c: SkCanvas, e: Engine, t: number) {
  const a = e.aimInfo(); if (!a || a.p <= 0) return;
  const b = a.b, x = b.x, y = b.y, pw = a.p, team = b.team as 0 | 1;
  const cA = pw < .5 ? '#3dffa8' : pw < .8 ? '#ffd257' : '#ff4a5a';
  // power ring
  const g = paints.add2; g.setStrokeCap(StrokeCap.Round); g.setStrokeWidth(6); g.setColor(col(cA, .95));
  c.drawArc(Skia.XYWHRect(x - b.r - 12, y - b.r - 12, (b.r + 12) * 2, (b.r + 12) * 2), -90, 360 * pw, false, g);
  // direction arrow (gradient beam + head)
  const L = PR + 30 + pw * 230, ex = x + a.ux * L, ey = y + a.uy * L;
  const sp = paints.stroke; sp.setStrokeWidth(10 + pw * 6);
  sp.setShader(Skia.Shader.MakeLinearGradient({ x: x + a.ux * b.r, y: y + a.uy * b.r }, { x: ex, y: ey }, [col(cA, 0), col(cA, .85), col('#ffffff', .95)], [0, .7, 1], TileMode.Clamp));
  sp.setBlendMode(BlendMode.Plus); c.drawLine(x + a.ux * b.r, y + a.uy * b.r, ex - a.ux * 14, ey - a.uy * 14, sp); sp.setShader(null); sp.setBlendMode(BlendMode.SrcOver);
  const hb = Skia.PathBuilder.Make(), px = -a.uy, py = a.ux, hs = 22 + pw * 8;
  hb.moveTo(ex + a.ux * 6, ey + a.uy * 6).lineTo(ex - a.ux * hs + px * hs * .62, ey - a.uy * hs + py * hs * .62).lineTo(ex - a.ux * hs - px * hs * .62, ey - a.uy * hs - py * hs * .62).close(); const hp = hb.build();
  const f = paints.fill; f.setColor(col('#ffffff', .95)); c.drawPath(hp, f);
  // predicted path dots
  const ad = paints.add; const steps = Math.max(2, Math.round((7 + pw * 7) * (e.cfg.stats ? aimPreview(e.statsOf(team).accuracy) : 1)));
  for (let i = 1; i <= steps; i++) { const d = L + i * 26, k = 1 - i / (steps + 1); ad.setColor(col(team ? '#ffb0b8' : '#bfe8ff', .55 * k)); c.drawCircle(x + a.ux * d, y + a.uy * d, 3.2 * k + 1, ad); }
  // pull-back tether
  const tp = paints.stroke; tp.setStrokeWidth(3); tp.setColor(col('#ffffff', .25)); c.drawLine(x, y, x - a.ux * (b.r + 20 + pw * 70), y - a.uy * (b.r + 20 + pw * 70), tp);
  void t;
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
    const cam = e.cam, shx = cam > .05 ? (Math.random() - .5) * cam * 7 : 0, shy = cam > .05 ? (Math.random() - .5) * cam * 7 : 0;
    c.save(); c.translate(v.ox + shx, v.oy + shy); c.scale(v.s, v.s);
    const al = e.alpha();
    drawGoals(c, e, im.goal, t);
    if (hq) drawGoalFx(c, e, t);
    const pos = (b: Body) => [b.px + (b.x - b.px) * al + b.vox, b.py + (b.y - b.py) * al + b.voy];
    const aimTeam = e.phase === 'aim' ? e.turn : -1;
    for (const b of e.bodies) if (b !== e.ball) { const [x, y] = pos(b); drawPiece(c, e, b, x, y, b.team === 0 ? im.t0 : im.t1, t, b.team === aimTeam && !(e.drag && e.drag.b !== b) && !e.isAiTurn(), e.phase === 'aim' && b.team !== e.turn); }
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

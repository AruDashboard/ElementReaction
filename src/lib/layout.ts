export interface LayoutNode {
  [key: string]: unknown;
}

export interface LayoutEdge {
  s: number;
  t: number;
  Le: number;
}

export interface LayoutConfig {
  nodeSize: number;
  direction: 'LR' | 'TB' | 'none';
  flowStrength: number;
  seeds: number;
}

export interface StageSize {
  W: number;
  H: number;
}

export interface Point {
  x: number;
  y: number;
}

interface ForcePoint extends Point {
  dx: number;
  dy: number;
}

interface SegmentDistance {
  d: number;
  dx: number;
  dy: number;
  inside: boolean;
}

export function createLayout(
  N: LayoutNode[],
  E: LayoutEdge[],
  LAY: LayoutConfig,
  stageSize: () => StageSize,
): () => Point[] {
  const S = LAY.nodeSize;
  const BW = S + 26;
  const BH = S + 40;

  const K = E.length ? E.reduce((a, e) => a + e.Le, 0) / E.length : S * 3;

  const mulberry =
    (a: number): (() => number) =>
    () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;

      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

  const dir = LAY.direction;
  const flow = LAY.flowStrength;

  function depths(): number[] {
    const n = N.length;
    const d: number[] = new Array(n).fill(0);
    const indeg: number[] = new Array(n).fill(0);

    E.forEach((e) => {
      if (e.s !== e.t) indeg[e.t]++;
    });

    const seen: boolean[] = new Array(n).fill(false);
    const queue: number[] = [];

    const start = (): number => {
      for (let i = 0; i < n; i++) {
        if (!seen[i] && indeg[i] === 0) return i;
      }

      for (let i = 0; i < n; i++) {
        if (!seen[i]) return i;
      }

      return -1;
    };

    let s: number;

    while ((s = start()) >= 0) {
      seen[s] = true;
      queue.push(s);

      while (queue.length) {
        const u = queue.shift()!;

        E.forEach((e) => {
          if (e.s === u && !seen[e.t]) {
            seen[e.t] = true;
            d[e.t] = d[u] + 1;
            queue.push(e.t);
          }
        });
      }
    }

    return d;
  }

  const DEPTH = depths();

  const segX = (a: Point, b: Point, c: Point, d: Point): boolean => {
    const o = (p: Point, q: Point, r: Point): number =>
      Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));

    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };

  function ptSeg(p: Point, a: Point, b: Point): SegmentDistance {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const l2 = vx * vx + vy * vy || 1;

    let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2;

    const inside = t > 0.05 && t < 0.95;

    t = Math.max(0, Math.min(1, t));

    const px = a.x + vx * t;
    const py = a.y + vy * t;
    const dx = p.x - px;
    const dy = p.y - py;

    return {
      d: Math.hypot(dx, dy),
      dx,
      dy,
      inside,
    };
  }

  function layoutOnce(seed: number, W: number, H: number, iters: number): Point[] {
    const rnd = mulberry(seed * 7919 + 13);
    const n = N.length;

    const P: ForcePoint[] = N.map(() => ({
      x: 0,
      y: 0,
      dx: 0,
      dy: 0,
    }));

    const maxd = Math.max(1, ...DEPTH);
    const spread = Math.sqrt(n) * K * 0.7;
    const ar = Math.sqrt(W / H);

    P.forEach((p, i) => {
      if (seed % 4 === 0 && dir !== 'none') {
        const along = (DEPTH[i] - maxd / 2) * K;
        const across = (rnd() - 0.5) * spread;

        p.x = dir === 'LR' ? along : across;
        p.y = dir === 'LR' ? across : along;
      } else {
        p.x = (rnd() - 0.5) * spread * 2 * ar;
        p.y = ((rnd() - 0.5) * spread * 2) / ar;
      }
    });

    const gx = 0.12 * Math.min(1, H / W);
    const gy = 0.12 * Math.min(1, W / H);

    for (let it = 0; it < iters; it++) {
      const temp = K * 0.8 * Math.pow(1 - it / iters, 1.5) + 0.3;

      P.forEach((p) => {
        p.dx = 0;
        p.dy = 0;
      });

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = P[i];
          const b = P[j];

          let dx = a.x - b.x;
          let dy = a.y - b.y;

          if (!dx && !dy) {
            dx = rnd() - 0.5;
            dy = rnd() - 0.5;
          }

          const d = Math.hypot(dx, dy) || 1;
          const f = (K * K * 0.8) / d;
          const ux = dx / d;
          const uy = dy / d;

          a.dx += ux * f;
          a.dy += uy * f;
          b.dx -= ux * f;
          b.dy -= uy * f;

          const ox = BW - Math.abs(dx);
          const oy = BH - Math.abs(dy);

          if (ox > 0 && oy > 0) {
            if (ox < oy) {
              const s = Math.sign(dx) * ox * 1.5;
              a.dx += s;
              b.dx -= s;
            } else {
              const s = Math.sign(dy) * oy * 1.5;
              a.dy += s;
              b.dy -= s;
            }
          }
        }
      }

      for (const e of E) {
        if (e.s === e.t) continue;

        const a = P[e.s];
        const b = P[e.t];

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = (d * d) / e.Le;

        a.dx += (dx / d) * f;
        a.dy += (dy / d) * f;
        b.dx -= (dx / d) * f;
        b.dy -= (dy / d) * f;

        if (dir !== 'none' && flow > 0) {
          const gap = dir === 'LR' ? dx : dy;
          const want = e.Le * 0.6;

          if (gap < want) {
            const s = (want - gap) * 0.6 * flow;

            if (dir === 'LR') {
              b.dx += s;
              a.dx -= s;
            } else {
              b.dy += s;
              a.dy -= s;
            }
          }
        }
      }

      const clear = S * 0.75 + 10;

      for (const e of E) {
        if (e.s === e.t) continue;

        for (let c = 0; c < n; c++) {
          if (c === e.s || c === e.t) continue;

          const r = ptSeg(P[c], P[e.s], P[e.t]);

          if (r.inside && r.d < clear) {
            const m = r.d || 1;
            const s = (clear - r.d) * 2;

            const ux = r.d ? r.dx / m : 1;
            const uy = r.d ? r.dy / m : 0;

            P[c].dx += ux * s;
            P[c].dy += uy * s;

            P[e.s].dx -= (ux * s) / 2;
            P[e.s].dy -= (uy * s) / 2;
            P[e.t].dx -= (ux * s) / 2;
            P[e.t].dy -= (uy * s) / 2;
          }
        }
      }

      P.forEach((p) => {
        p.dx -= p.x * gx;
        p.dy -= p.y * gy;

        const l = Math.hypot(p.dx, p.dy) || 1;
        const st = Math.min(l, temp);

        p.x += (p.dx / l) * st;
        p.y += (p.dy / l) * st;
      });
    }

    return P.map((p) => ({
      x: p.x,
      y: p.y,
    }));
  }

  function score(P: Point[], W: number, H: number): number {
    let cross = 0;
    let near = 0;
    let len = 0;
    let bad = 0;

    for (let i = 0; i < E.length; i++) {
      const a = E[i];

      if (a.s === a.t) continue;

      len += Math.hypot(P[a.s].x - P[a.t].x, P[a.s].y - P[a.t].y);

      if (dir !== 'none') {
        const g = dir === 'LR' ? P[a.t].x - P[a.s].x : P[a.t].y - P[a.s].y;

        if (g < S) bad++;
      }

      for (let j = i + 1; j < E.length; j++) {
        const b = E[j];

        if (b.s === b.t || a.s === b.s || a.s === b.t || a.t === b.s || a.t === b.t) {
          continue;
        }

        if (segX(P[a.s], P[a.t], P[b.s], P[b.t])) {
          cross++;
        }
      }

      for (let c = 0; c < P.length; c++) {
        if (c === a.s || c === a.t) continue;

        const r = ptSeg(P[c], P[a.s], P[a.t]);

        if (r.inside && r.d < S * 0.6) {
          near++;
        }
      }
    }

    let ov = 0;

    for (let i = 0; i < P.length; i++) {
      for (let j = i + 1; j < P.length; j++) {
        if (Math.abs(P[i].x - P[j].x) < BW && Math.abs(P[i].y - P[j].y) < BH) {
          ov++;
        }
      }
    }

    const xs = P.map((p) => p.x);
    const ys = P.map((p) => p.y);

    const bw = Math.max(...xs) - Math.min(...xs) + BW;

    const bh = Math.max(...ys) - Math.min(...ys) + BH;

    const fit = Math.min((W - 80) / bw, (H - 80) / bh);

    return (
      cross * 1000 +
      near * 600 +
      ov * 2000 +
      bad * (flow > 0 ? 80 * flow : 0) +
      len * 0.01 +
      250 / Math.min(fit, 2.2)
    );
  }

  let seedBase = 0;

  function bestLayout(): Point[] {
    const { W, H } = stageSize();
    const n = N.length;

    if (!n) return [];

    const seeds = Math.max(4, Math.min(LAY.seeds, Math.floor(40000 / (n * n + 1))));

    let best: Point[] | null = null;
    let bs = Infinity;

    for (let k = 0; k < seeds; k++) {
      const P = layoutOnce(seedBase + k, W, H, 320);

      const s = score(P, W, H);

      if (s < bs) {
        bs = s;
        best = P;
      }
    }

    seedBase += seeds;

    if (best === null) {
      return [];
    }

    const points: Point[] = best;

    const cx = points.reduce((a, p) => a + p.x, 0) / n;

    const cy = points.reduce((a, p) => a + p.y, 0) / n;

    return points.map((p) => ({
      x: p.x - cx,
      y: p.y - cy,
    }));
  }

  return bestLayout;
}

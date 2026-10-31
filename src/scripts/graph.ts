import { createLayout, type LayoutConfig, type LayoutEdge, type Point } from '../lib/layout';
import { graphConfig } from '../data/graph';
import fontUrl from '../assets/fonts/genshin-subset.woff2?url';

interface GraphNode {
  id: string;
  label?: string;
  image?: string;
  color?: string;
}
interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  color?: string;
}
interface GraphConfig {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout?: Partial<LayoutConfig>;
  style?: Partial<{ edgeColor: string; labelColor: string; highlightColor: string }>;
}
interface RenderNode extends GraphNode, Point {
  i: number;
  el: SVGGElement;
  fb?: boolean;
}
interface RenderEdge extends GraphEdge, LayoutEdge {
  label: string;
  lw: number;
  off: number;
  color: string;
  el: SVGGElement;
  path: SVGPathElement;
  text: SVGTextElement;
}
type ImageType = 'image/png' | 'image/jpeg';
const byId = <T extends HTMLElement | SVGElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};
const errorMessage = (e: unknown): string => (e instanceof Error ? errorMessage(e) : String(e));
const NS = 'http://www.w3.org/2000/svg';
function mk<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
  parent?: SVGElement,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs ?? {})) el.setAttribute(key, String(value));
  parent?.appendChild(el);
  return el;
}

(async function () {
  let cfg: GraphConfig = graphConfig as GraphConfig;
  const q = new URLSearchParams(location.search).get('config');
  if (q) {
    try {
      const response = await fetch(q);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const custom: GraphConfig = await response.json();
      if (!Array.isArray(custom.nodes) || !Array.isArray(custom.edges))
        throw new Error('配置需要 nodes 和 edges 数组');
      if (
        custom.nodes.some((n) => !n || typeof n.id !== 'string') ||
        new Set(custom.nodes.map((n) => n.id)).size !== custom.nodes.length
      )
        throw new Error('节点 id 必须是唯一字符串');
      if (custom.edges.some((e) => !e || typeof e.from !== 'string' || typeof e.to !== 'string'))
        throw new Error('边需要 from 和 to 字符串');
      cfg = custom;
    } catch (e) {
      byId('status').textContent = '配置加载失败，已使用默认图：' + errorMessage(e);
    }
  }
  await document.fonts.ready;
  const LAY: LayoutConfig = Object.assign(
    { nodeSize: 64, direction: 'LR', flowStrength: 1, seeds: 32 },
    cfg.layout,
  );
  LAY.nodeSize = Math.max(24, Math.min(160, Number(LAY.nodeSize) || 64));
  LAY.seeds = Math.max(4, Math.min(64, Number(LAY.seeds) || 32));
  const STY = Object.assign(
    { edgeColor: '#6e7f96', labelColor: '#c9d1d9', highlightColor: '#58a6ff' },
    cfg.style,
  );
  document.title = 'title';
  document.documentElement.style.setProperty('--accent', STY.highlightColor);

  const S = LAY.nodeSize;
  const svg = byId<SVGSVGElement>('svg'),
    vp = byId<SVGGElement>('vp');
  const gEdges = byId<SVGGElement>('edges'),
    gNodes = byId<SVGGElement>('nodes'),
    defs = byId<SVGDefsElement>('defs');

  const N = (cfg.nodes || []).map((n, i) => ({ ...n, i, x: 0, y: 0 })) as unknown as RenderNode[];
  const idx = new Map<string, number>(N.map((n) => [n.id, n.i]));
  const E: RenderEdge[] = [];
  (cfg.edges || []).forEach((e) => {
    if (!idx.has(e.from) || !idx.has(e.to)) return console.warn('忽略未知节点的边', e);
    E.push({
      ...e,
      s: idx.get(e.from)!,
      t: idx.get(e.to)!,
      label: e.label || '',
    } as unknown as RenderEdge);
  });
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.font = '12px Genshin, sans-serif';
  E.forEach((e) => {
    e.lw = ctx.measureText(e.label).width;
    e.Le = Math.max(S * 2 + 20, S + e.lw + 70);
  });

  const groups = new Map<string, RenderEdge[]>();
  E.forEach((e) => {
    const k = Math.min(e.s, e.t) + '|' + Math.max(e.s, e.t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(e);
  });
  groups.forEach((g) =>
    g.forEach((e, i) => {
      e.off = e.s === e.t ? 0 : (i - (g.length - 1) / 2) * S * 1.1;
    }),
  );
  const stageSize = () => ({ W: svg.clientWidth || 1200, H: svg.clientHeight || 700 });
  const bestLayout = createLayout(N, E, LAY, stageSize);

  const clip = mk('clipPath', { id: 'clipSq' }, defs);
  mk('rect', { x: -S / 2, y: -S / 2, width: S, height: S, rx: 10 }, clip);

  N.forEach((n) => {
    const g = mk(
      'g',
      { class: 'node', tabindex: 0, role: 'button', 'aria-label': n.label || n.id },
      gNodes,
    );
    n.el = g;
    mk(
      'rect',
      { class: 'frame', x: -S / 2 - 2, y: -S / 2 - 2, width: S + 4, height: S + 4, rx: 12 },
      g,
    );
    const fb = () => {
      if (n.fb) return;
      n.fb = true;
      mk(
        'rect',
        { x: -S / 2, y: -S / 2, width: S, height: S, rx: 10, fill: n.color || '#2d3748' },
        g,
      );
      mk('text', { class: 'fallback', y: 9 }, g).textContent = (n.label || n.id).slice(0, 1);
    };
    if (n.image) {
      const im = mk(
        'image',
        {
          href: n.image,
          x: -S / 2,
          y: -S / 2,
          width: S,
          height: S,
          'clip-path': 'url(#clipSq)',
          preserveAspectRatio: 'xMidYMid slice',
        },
        g,
      );
      im.addEventListener('error', () => {
        im.remove();
        fb();
      });
    } else fb();
    mk('text', { y: S / 2 + 20 }, g).textContent = n.label || n.id;
    g.addEventListener('mouseenter', () => highlight(n.i));
    g.addEventListener('focus', () => highlight(n.i));
    g.addEventListener('blur', () => highlight(-1));
    g.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        highlight(n.i);
      }
    });
    g.addEventListener('mouseleave', () => highlight(-1));
    g.addEventListener('pointerdown', (ev) => dragStart(ev, n));
  });
  E.forEach((e) => {
    const color = e.color || STY.edgeColor;
    e.color = color;
    const g = mk('g', { class: 'edge' }, gEdges);
    e.el = g;
    e.path = mk('path', { stroke: color }, g);
    e.text = mk('text', { fill: STY.labelColor }, g);
    e.text.textContent = e.label;
  });

  function highlight(i: number): void {
    N.forEach((n) => {
      const on =
        i < 0 ||
        n.i === i ||
        E.some((e) => (e.s === i && e.t === n.i) || (e.t === i && e.s === n.i));
      n.el.classList.toggle('dim', !on);
      n.el.classList.toggle('hl', i >= 0 && n.i === i);
    });
    E.forEach((e) => {
      const on = i < 0 || e.s === i || e.t === i;
      e.el.classList.toggle('dim', !on);
      e.path.style.stroke = i >= 0 && on ? STY.highlightColor : e.color;
    });
  }

  const clipBox = (c: Point, q: Point, half: number): Point => {
    const dx = q.x - c.x,
      dy = q.y - c.y,
      m = Math.max(Math.abs(dx), Math.abs(dy)) || 1,
      k = half / m;
    return { x: c.x + dx * k, y: c.y + dy * k };
  };

  function drawEdges() {
    for (const e of E) {
      const a = N[e.s],
        b = N[e.t];
      let d: string,
        lx: number,
        ly: number,
        ang = 0,
        nx = 0,
        ny = -1;
      if (e.s === e.t) {
        const y0 = a.y - S / 2 - 3,
          h = S * 0.9;
        d = `M${a.x - S * 0.25},${y0} C${a.x - S * 0.65},${y0 - h} ${a.x + S * 0.65},${y0 - h} ${a.x + S * 0.25},${y0 - 5}`;
        lx = a.x;
        ly = y0 - h * 0.75 - 6;
      } else {
        const [ca, cb] = e.s < e.t ? [a, b] : [b, a];
        const cdx = cb.x - ca.x,
          cdy = cb.y - ca.y,
          cl = Math.hypot(cdx, cdy) || 1;
        const c = {
          x: (a.x + b.x) / 2 - (cdy / cl) * e.off,
          y: (a.y + b.y) / 2 + (cdx / cl) * e.off,
        };
        const p0 = clipBox(a, c, S / 2 + 4),
          p1 = clipBox(b, c, S / 2 + 8);
        d = `M${p0.x},${p0.y} Q${c.x},${c.y} ${p1.x},${p1.y}`;
        lx = p0.x * 0.25 + c.x * 0.5 + p1.x * 0.25;
        ly = p0.y * 0.25 + c.y * 0.5 + p1.y * 0.25;
        ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
        if (Math.cos(ang) < 0) ang += Math.PI;
        nx = Math.sin(ang);
        ny = -Math.cos(ang);
        if (e.off) {
          const side = Math.sign((c.x - (a.x + b.x) / 2) * nx + (c.y - (a.y + b.y) / 2) * ny);
          nx *= side;
          ny *= side;
        }
      }
      e.path.setAttribute('d', d);
      const off = e.s === e.t ? 0 : 9;

      e.text.setAttribute(
        'transform',
        `translate(${lx + nx * off},${ly + ny * off}) rotate(${(ang * 180) / Math.PI}) translate(0,4)`,
      );
    }
  }
  function drawNodes() {
    N.forEach((n) => n.el.setAttribute('transform', `translate(${n.x},${n.y})`));
  }
  function draw() {
    drawNodes();
    drawEdges();
    if (autoFit) fit();
  }

  const view = { k: 1, x: 0, y: 0 };
  let autoFit = true;
  const applyView = () =>
    vp.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
  function fit() {
    if (!N.length) return;
    const { W, H } = stageSize(),
      pad = 40;
    const bb = vp.getBBox();
    const x0 = bb.x - 5,
      x1 = bb.x + bb.width + 5;
    const y0 = bb.y - 5,
      y1 = bb.y + bb.height + 5;
    const k = Math.max(
      0.01,
      Math.min(
        Math.max(1, W - pad * 2) / Math.max(1, x1 - x0),
        Math.max(1, H - pad * 2) / Math.max(1, y1 - y0),
        2.2,
      ),
    );
    view.k = k;
    view.x = W / 2 - ((x0 + x1) / 2) * k;
    view.y = H / 2 - ((y0 + y1) / 2) * k;
    applyView();
  }
  const toWorld = (ev: PointerEvent): Point => {
    const r = svg.getBoundingClientRect();
    return {
      x: (ev.clientX - r.left - view.x) / view.k,
      y: (ev.clientY - r.top - view.y) / view.k,
    };
  };

  svg.addEventListener(
    'wheel',
    (ev) => {
      ev.preventDefault();
      autoFit = false;
      const r = svg.getBoundingClientRect(),
        mx = ev.clientX - r.left,
        my = ev.clientY - r.top;
      const k = Math.max(0.1, Math.min(6, view.k * Math.exp(-ev.deltaY * 0.0015)));
      view.x = mx - ((mx - view.x) * k) / view.k;
      view.y = my - ((my - view.y) * k) / view.k;
      view.k = k;
      applyView();
    },
    { passive: false },
  );
  svg.addEventListener('pointerdown', (ev) => {
    if ((ev.target as Element).closest('.node')) return;
    autoFit = false;
    svg.classList.add('panning');
    svg.setPointerCapture(ev.pointerId);
    const sx = ev.clientX,
      sy = ev.clientY,
      vx = view.x,
      vy = view.y;
    const mv = (e: PointerEvent) => {
      view.x = vx + e.clientX - sx;
      view.y = vy + e.clientY - sy;
      applyView();
    };
    const up = () => {
      svg.classList.remove('panning');
      svg.removeEventListener('pointermove', mv);
      svg.removeEventListener('pointerup', up);
      svg.removeEventListener('pointercancel', up);
    };
    svg.addEventListener('pointermove', mv);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
  });
  function dragStart(ev: PointerEvent, n: RenderNode): void {
    ev.stopPropagation();
    cancelAnimationFrame(raf);
    autoFit = false;
    svg.setPointerCapture(ev.pointerId);
    const w0 = toWorld(ev),
      ox = n.x - w0.x,
      oy = n.y - w0.y;
    const mv = (e: PointerEvent) => {
      const w = toWorld(e);
      n.x = w.x + ox;
      n.y = w.y + oy;
      drawNodes();
      drawEdges();
    };
    const up = () => {
      svg.removeEventListener('pointermove', mv);
      svg.removeEventListener('pointerup', up);
      svg.removeEventListener('pointercancel', up);
    };
    svg.addEventListener('pointermove', mv);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
  }

  let raf = 0;
  function tweenTo(T: Point[], ms = 900): void {
    cancelAnimationFrame(raf);
    const from = N.map((n) => ({ x: n.x, y: n.y })),
      t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms),
        k = 1 - Math.pow(1 - t, 3);
      N.forEach((n, i) => {
        n.x = from[i].x + (T[i].x - from[i].x) * k;
        n.y = from[i].y + (T[i].y - from[i].y) * k;
      });
      draw();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  const relayout = () => {
    autoFit = true;
    tweenTo(bestLayout());
  };

  const EXPORT_CSS = `
    .node .frame{fill:#161b22;stroke:#3d4655;stroke-width:1.5}
    .node text{fill:#e6edf3;font-size:13px;text-anchor:middle}
    .node .fallback{font-size:26px;font-weight:600}
    .edge path{fill:none;stroke-width:1.8}
    .edge text{font-size:12px;text-anchor:middle;paint-order:stroke;stroke:#0b0f14;stroke-width:5px;stroke-linejoin:round}
    text{font-family:Genshin,"PingFang SC","Microsoft YaHei",sans-serif}`;
  async function toDataURL(src: string): Promise<string> {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const b = await response.blob();
      return await new Promise<string>((ok, no) => {
        const r = new FileReader();
        r.onload = () =>
          typeof r.result === 'string' ? ok(r.result) : no(new Error('Invalid data URL'));
        r.onerror = no;
        r.readAsDataURL(b);
      });
    } catch (e) {
      return await new Promise<string>((ok, no) => {
        const im = new Image();
        im.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = im.naturalWidth;
            c.height = im.naturalHeight;
            const ctx = c.getContext('2d');
            if (!ctx) throw new Error('Canvas 2D unavailable');
            ctx.drawImage(im, 0, 0);
            ok(c.toDataURL('image/png'));
          } catch (err) {
            no(err);
          }
        };
        im.onerror = no;
        im.src = src;
      });
    }
  }
  async function exportImage(type: ImageType): Promise<void> {
    if (!N.length) throw new Error('暂无可导出的节点');
    const pad = 48,
      bb = vp.getBBox(),
      w = bb.width + pad * 2,
      h = bb.height + pad * 2;
    const scale = Math.min(2, 8000 / Math.max(w, h));
    const root = document.createElementNS(NS, 'svg');
    root.setAttribute('xmlns', NS);
    root.setAttribute('width', String(Math.round(w * scale)));
    root.setAttribute('height', String(Math.round(h * scale)));
    root.setAttribute('viewBox', `${bb.x - pad} ${bb.y - pad} ${w} ${h}`);
    mk('style', {}, root).textContent =
      `@font-face{font-family:Genshin;src:url(${await toDataURL(fontUrl)}) format('woff2');}` +
      EXPORT_CSS;
    root.appendChild(defs.cloneNode(true));
    mk('rect', { x: bb.x - pad, y: bb.y - pad, width: w, height: h, fill: '#0b0f14' }, root);
    const copy = vp.cloneNode(true) as SVGGElement;
    copy.removeAttribute('transform');
    root.appendChild(copy);
    copy.querySelectorAll('.dim,.hl').forEach((el) => el.classList.remove('dim', 'hl'));
    copy.querySelectorAll('.edge path').forEach((p, i) => {
      p.style.stroke = '';
      p.setAttribute('stroke', E[i].color);
    });
    let failed = 0;
    await Promise.all(
      [...copy.querySelectorAll('image')].map(async (im) => {
        try {
          im.setAttribute('href', await toDataURL(im.getAttribute('href') || ''));
        } catch (e) {
          failed++;
          const g = im.parentNode as SVGElement,
            n = N.find((m) => m.image === im.getAttribute('href'));
          mk(
            'rect',
            {
              x: -S / 2,
              y: -S / 2,
              width: S,
              height: S,
              rx: 10,
              fill: (n && n.color) || '#2d3748',
            },
            g,
          );
          mk('text', { class: 'fallback', y: 9 }, g).textContent = (
            (n && (n.label || n.id)) ||
            '?'
          ).slice(0, 1);
          im.remove();
        }
      }),
    );
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(root)], {
        type: 'image/svg+xml;charset=utf-8',
      }),
    );
    const c = document.createElement('canvas');
    c.width = Number(root.getAttribute('width'));
    c.height = Number(root.getAttribute('height'));
    try {
      const img = new Image();
      await new Promise<void>((ok, no) => {
        img.onload = () => ok();
        img.onerror = no;
        img.src = url;
      });
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');
      ctx.drawImage(img, 0, 0);
    } finally {
      URL.revokeObjectURL(url);
    }
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, type, 0.95));
    if (!blob) throw new Error('无法生成图片');
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'graph' + (type === 'image/png' ? '.png' : '.jpg');
    a.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    if (failed) alert(`有 ${failed} 个节点图片无法读取`);
  }
  const bindExport = (id: string, type: ImageType) =>
    (byId<HTMLButtonElement>(id).onclick = async () => {
      const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-export]')];
      buttons.forEach((button) => (button.disabled = true));
      try {
        await exportImage(type);
        byId('status').textContent = '图片已导出';
      } catch (e) {
        console.error(e);
        byId('status').textContent = '导出失败：' + errorMessage(e);
      } finally {
        buttons.forEach((button) => (button.disabled = false));
      }
    });
  bindExport('btnPng', 'image/png');
  bindExport('btnJpg', 'image/jpeg');

  byId<HTMLButtonElement>('btnRelayout').onclick = () => setTimeout(relayout, 0);
  byId<HTMLButtonElement>('btnFit').onclick = () => {
    autoFit = true;
    fit();
  };
  window.addEventListener('resize', () => {
    if (autoFit) fit();
  });

  N.forEach((n) => {
    n.x = 0;
    n.y = 0;
  });
  draw();
  setTimeout(relayout, 30);
})();

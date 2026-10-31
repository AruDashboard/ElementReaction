export interface GraphConfig {
  banner?: { title?: string; subtitle?: string; logo?: string };
  layout?: {
    nodeSize?: number;
    direction?: 'LR' | 'TB' | 'none';
    flowStrength?: number;
    seeds?: number;
  };
  style?: { edgeColor?: string; labelColor?: string; highlightColor?: string };
  nodes: { id: string; label?: string; image?: string; color?: string }[];
  edges: { from: string; to: string; label?: string; color?: string }[];
}

const base = import.meta.env.BASE_URL;

export const graphConfig: GraphConfig = {
  layout: { nodeSize: 32, direction: 'none', flowStrength: 0, seeds: 32 },
  style: { edgeColor: '#6e7f96', labelColor: '#c9d1d9', highlightColor: '#a8c7fa' },
  nodes: [
    { id: 'pyro', label: '火', color: '#ed7856' },
    { id: 'hydro', label: '水', color: '#4ca9dc' },
    { id: 'hydro-moon', label: '月', color: '#4ca9dc' },
    { id: 'electro', label: '雷', color: '#b18bdd' },
    { id: 'cryo', label: '冰', color: '#93d5e4' },
    { id: 'cryo-star', label: '星', color: '#93d5e4' },
    { id: 'dendro', label: '草', color: '#98bc4b' },
    { id: 'anemo', label: '风', color: '#67c5ad' },
    { id: 'geo', label: '岩', color: '#d9b45c' },
  ].map((node) => ({ ...node, image: `${base}images/elements/${node.id}.png` })),
  edges: [
    { from: 'pyro', to: 'hydro', label: '蒸发' },
    { from: 'pyro', to: 'cryo', label: '融化' },
    { from: 'pyro', to: 'electro', label: '超载' },
    { from: 'hydro', to: 'electro', label: '感电' },
    { from: 'hydro-moon', to: 'electro', label: '月感电' },
    { from: 'hydro', to: 'cryo', label: '冻结' },
    { from: 'cryo', to: 'electro', label: '超导' },
    { from: 'cryo-star', to: 'electro', label: '星超导' },
    { from: 'dendro', to: 'pyro', label: '燃烧' },
    { from: 'dendro', to: 'hydro', label: '绽放' },
    { from: 'dendro', to: 'electro', label: '激化' },
    ...['pyro', 'hydro', 'electro', 'cryo'].map((to) => ({ from: 'anemo', to, label: '扩散' })),
    ...['pyro', 'hydro', 'electro', 'cryo'].map((to) => ({ from: 'geo', to, label: '结晶' })),
    { from: 'geo', to: 'hydro-moon', label: '月结晶' },
    { from: 'anemo', to: 'cryo-star', label: '星扩散' },
  ],
};

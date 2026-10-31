export interface GraphConfig {
  banner?: { title?: string; subtitle?: string; logo?: string };
  layout?: {
    nodeSize?: number;
    direction?: 'LR' | 'TB' | 'none';
    flowStrength?: number;
    seeds?: number;
  };
  style?: { edgeColor?: string; labelColor?: string; highlightColor?: string };
  nodes: {
    id: string;
    label?: string;
    image?: string;
    color?: string;
    split?: { label?: string; color?: string; image?: string }[];
  }[];
  edges: { from: string; to: string; label?: string; color?: string; group?: 'moon' | 'star' }[];
}

const base = import.meta.env.BASE_URL;

const elements = [
  { id: 'pyro', label: '火', color: '#ed7856' },
  { id: 'hydro', label: '水', color: '#4ca9dc' },
  { id: 'electro', label: '雷', color: '#b18bdd' },
  { id: 'cryo', label: '冰', color: '#93d5e4' },
  { id: 'dendro', label: '草', color: '#98bc4b' },
  { id: 'anemo', label: '风', color: '#67c5ad' },
  { id: 'geo', label: '岩', color: '#d9b45c' },
].map((node) => ({ ...node, image: `${base}images/elements/${node.id}.png` }));

const el = (id: string) => elements.find((e) => e.id === id)!;
const products = [
  { id: 'dendro-core', label: '草原核', color: '#6f9a3a', split: [el('dendro'), el('hydro')] },
  { id: 'quicken', label: '激化', color: '#89a84f', split: [el('dendro'), el('electro')] },
];

export const graphConfig: GraphConfig = {
  layout: { nodeSize: 32, direction: 'none', flowStrength: 0, seeds: 32 },
  style: { edgeColor: '#6e7f96', labelColor: '#c9d1d9', highlightColor: '#a8c7fa' },
  nodes: [...elements, ...products],
  edges: [
    { from: 'pyro', to: 'hydro', label: '蒸发' },
    { from: 'pyro', to: 'cryo', label: '融化' },
    { from: 'pyro', to: 'electro', label: '超载' },
    { from: 'hydro', to: 'electro', label: '感电' },
    { from: 'hydro', to: 'cryo', label: '冻结' },
    { from: 'cryo', to: 'electro', label: '超导' },
    { from: 'dendro', to: 'pyro', label: '燃烧' },
    { from: 'dendro', to: 'dendro-core', label: '绽放' },
    { from: 'hydro', to: 'dendro-core', label: '绽放' },
    { from: 'dendro-core', to: 'electro', label: '超绽放' },
    { from: 'dendro-core', to: 'pyro', label: '烈绽放' },
    { from: 'dendro', to: 'quicken', label: '激化' },
    { from: 'electro', to: 'quicken', label: '激化' },
    { from: 'quicken', to: 'electro', label: '超激化' },
    { from: 'quicken', to: 'dendro', label: '蔓激化' },
    ...['pyro', 'hydro', 'electro', 'cryo'].map((to) => ({ from: 'anemo', to, label: '扩散' })),
    ...['pyro', 'hydro', 'electro', 'cryo'].map((to) => ({ from: 'geo', to, label: '结晶' })),
    { from: 'hydro', to: 'electro', label: '月感电', group: 'moon' },
    { from: 'geo', to: 'hydro', label: '月结晶', group: 'moon' },
    { from: 'cryo', to: 'electro', label: '星超导', group: 'star' },
    { from: 'anemo', to: 'cryo', label: '星扩散', group: 'star' },
  ],
};

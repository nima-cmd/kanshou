// AniList's coverImage.color can be anything from near-black to pastel. These
// helpers keep the accent readable on our dark background.

const FALLBACK = "#e8a0bf";

function parse(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const toHex = (rgb: number[]) => "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

/** The cover color, lightened until it stands out against near-black. */
export function accentFor(color: string | null): string {
  let rgb = color ? parse(color) : null;
  if (!rgb) return FALLBACK;
  for (let i = 0; i < 10 && luminance(rgb) < 0.18; i++) {
    rgb = rgb.map((c) => c + (255 - c) * 0.18) as [number, number, number];
  }
  return toHex(rgb);
}

/** Ink to put on top of the accent. */
export function inkFor(accent: string): string {
  const rgb = parse(accent);
  return rgb && luminance(rgb) > 0.4 ? "#14121a" : "#fdfbf7";
}

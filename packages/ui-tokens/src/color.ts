/** OKLCH to sRGB maths (Ottosson), so no colour library is needed. */
export type Rgb = [number, number, number];

/** "oklch(L C H)" or "oklch(L C H / A%)". */
export function parseOklch(s: string): { l: number; c: number; h: number; a: number } {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)%\s*)?\)$/.exec(s.trim());
  if (!m) throw new Error(`not an oklch colour: ${s}`);
  return { l: +m[1]!, c: +m[2]!, h: +m[3]!, a: m[4] === undefined ? 1 : +m[4] / 100 };
}

/** Linear sRGB, clamped to the gamut. */
export function oklchToLinear(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin: Rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return lin.map((v) => Math.min(1, Math.max(0, v))) as Rgb;
}

const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const hex2 = (v: number) => Math.round(gamma(v) * 255).toString(16).padStart(2, "0");

/** "#rrggbb", or "rgba(r, g, b, a)" when the colour has alpha. */
export function toCss(oklch: string): string {
  const { l, c, h, a } = parseOklch(oklch);
  const lin = oklchToLinear(l, c, h);
  if (a === 1) return `#${lin.map(hex2).join("")}`;
  return `rgba(${lin.map((v) => Math.round(gamma(v) * 255)).join(", ")}, ${a})`;
}

/** WCAG relative luminance of an opaque OKLCH colour. */
export function luminance(oklch: string): number {
  const { l, c, h } = parseOklch(oklch);
  const [r, g, b] = oklchToLinear(l, c, h);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

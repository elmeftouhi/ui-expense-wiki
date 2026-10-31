export interface ColorOption {
  label: string
  textColor: string
  backgroundColor: string
  isCustom?: boolean
}

export const CATEGORY_COLORS: ColorOption[] = [
  { label: 'Blue', textColor: '#2563EB', backgroundColor: '#EFF6FF' },
  { label: 'Sky', textColor: '#0284C7', backgroundColor: '#F0F9FF' },
  { label: 'Cyan', textColor: '#0891B2', backgroundColor: '#ECFEFF' },
  { label: 'Teal', textColor: '#0D9488', backgroundColor: '#F0FDFA' },
  { label: 'Emerald', textColor: '#059669', backgroundColor: '#ECFDF5' },
  { label: 'Lime', textColor: '#65A30D', backgroundColor: '#F7FEE7' },
  { label: 'Amber', textColor: '#D97706', backgroundColor: '#FFFBEB' },
  { label: 'Orange', textColor: '#EA580C', backgroundColor: '#FFF7ED' },
  { label: 'Red', textColor: '#DC2626', backgroundColor: '#FEF2F2' },
  { label: 'Rose', textColor: '#E11D48', backgroundColor: '#FFF1F2' },
  { label: 'Pink', textColor: '#DB2777', backgroundColor: '#FDF2F8' },
  { label: 'Fuchsia', textColor: '#C026D3', backgroundColor: '#FDF4FF' },
  { label: 'Purple', textColor: '#7C3AED', backgroundColor: '#F5F3FF' },
  { label: 'Indigo', textColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  { label: 'Brown', textColor: '#8B5E3C', backgroundColor: '#FAF5F0' },
  { label: 'Slate', textColor: '#475569', backgroundColor: '#F1F5F9' },
]

const HEX_6_RE = /^#[0-9A-F]{6}$/i
const HEX_3_RE = /^#[0-9A-F]{3}$/i

/** Normalizes `#RGB` or `RRGGBB` into uppercase `#RRGGBB`, or returns `null` if invalid. */
export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim()
  const prefixed = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (HEX_6_RE.test(prefixed)) return prefixed.toUpperCase()
  if (HEX_3_RE.test(prefixed)) {
    const [, r, g, b] = prefixed.toUpperCase()
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return null
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.slice(1)
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = relativeLuminance(...rgb1)
  const l2 = relativeLuminance(...rgb2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h / 6, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tn = t
    if (tn < 0) tn += 1
    if (tn > 1) tn -= 1
    if (tn < 1 / 6) return p + (q - p) * 6 * tn
    if (tn < 1 / 2) return q
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

/**
 * Generates an accessible `(textColor, backgroundColor)` `#RRGGBB` pair from any accent hex:
 * - `backgroundColor`: soft 12% pastel tint blended with white (or `#F1F5F9` for near-white inputs)
 * - `textColor`: preserves hue/saturation while darkening if needed to ensure >= 4.5:1 WCAG contrast
 */
export function deriveCategoryColorPair(accentHex: string): ColorOption {
  const normalized = normalizeHexColor(accentHex) ?? CATEGORY_COLORS[0].textColor
  const baseRgb = hexToRgb(normalized)

  // Soft pastel background (12% accent + 88% white); avoid pure white so badge stays visible
  let bgRgb: [number, number, number] = [
    Math.round(baseRgb[0] * 0.12 + 255 * 0.88),
    Math.round(baseRgb[1] * 0.12 + 255 * 0.88),
    Math.round(baseRgb[2] * 0.12 + 255 * 0.88),
  ]
  if (relativeLuminance(...bgRgb) > 0.96) {
    bgRgb = [241, 245, 249] // #F1F5F9 fallback for near-white picks
  }

  let fgRgb = baseRgb
  if (contrastRatio(fgRgb, bgRgb) < 4.5) {
    const [h, s, initialL] = rgbToHsl(...baseRgb)
    let l = Math.min(initialL, 0.45)
    while (l > 0.12) {
      const candidate = hslToRgb(h, s, l)
      fgRgb = candidate
      if (contrastRatio(candidate, bgRgb) >= 4.5) break
      l -= 0.03
    }
  }

  const textColor = rgbToHex(...fgRgb)
  const backgroundColor = rgbToHex(...bgRgb)

  return {
    label: `Custom (${textColor})`,
    textColor,
    backgroundColor,
    isCustom: true,
  }
}

/** Resolves an existing category's saved colors to a preset or a preserved custom color option. */
export function resolveCategoryColor(
  textColor?: string,
  backgroundColor?: string,
): ColorOption {
  if (!textColor && !backgroundColor) return CATEGORY_COLORS[0]

  const preset = CATEGORY_COLORS.find(
    (c) =>
      c.textColor.toLowerCase() === textColor?.toLowerCase() &&
      (!backgroundColor || c.backgroundColor.toLowerCase() === backgroundColor.toLowerCase()),
  ) ?? CATEGORY_COLORS.find(
    (c) => c.textColor.toLowerCase() === textColor?.toLowerCase(),
  )

  if (preset) return preset

  const validText = textColor ? normalizeHexColor(textColor) : null
  const validBg = backgroundColor ? normalizeHexColor(backgroundColor) : null
  if (validText) {
    const derived = deriveCategoryColorPair(validText)
    return {
      label: `Custom (${validText})`,
      textColor: validText,
      backgroundColor: validBg ?? derived.backgroundColor,
      isCustom: true,
    }
  }

  return CATEGORY_COLORS[0]
}

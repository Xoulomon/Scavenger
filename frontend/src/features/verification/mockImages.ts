// Mock image data (images are not stored on-chain)

export function getMockImages(materialId: number): { before: string; after: string } {
  const hue = (materialId * 67) % 360
  return {
    before: `https://placehold.co/400x300/${hslToHex(hue, 40, 70)}/${hslToHex(hue, 40, 30)}?text=Before+%23${materialId}`,
    after: `https://placehold.co/400x300/${hslToHex((hue + 120) % 360, 40, 70)}/${hslToHex((hue + 120) % 360, 40, 30)}?text=After+%23${materialId}`,
  }
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `${f(0)}${f(8)}${f(4)}`
}

// Jetable : génère les 8 jetons de Coéquipiers de L'Imposteur en recolorant le
// crewmate déjà détouré (public/pion_imposteur.png, rouge = l'Imposteur lui-même).
// On ne touche qu'aux pixels « corps » (rouge dominant) ; le contour noir et le
// hublot bleu sont préservés. L'état « suspect » est rendu en CSS (halo rouge),
// donc pas de variantes ici. → public/cards/imposteur/crew-<couleur>.png
import { Jimp } from 'jimp'

// Couleurs des 8 Coéquipiers (les 8 pions fournis), en HSV cible.
// h: teinte 0-360 · s: saturation 0-1 · vMul: facteur de luminosité appliqué à
// la luminosité du pixel rouge source (préserve les ombres/reflets du corps).
const COLORS = {
  blanc:      { h: 0,   s: 0.05, vMul: 1.18 },
  bleu:       { h: 212, s: 0.85, vMul: 1.0 },
  noir:       { h: 0,   s: 0.0,  vMul: 0.32 },
  orange:     { h: 28,  s: 0.95, vMul: 1.05 },
  rose:       { h: 330, s: 0.45, vMul: 1.1 },
  vert:       { h: 130, s: 0.85, vMul: 0.92 },
  'vert-clair': { h: 80, s: 0.75, vMul: 1.05 },
  violet:     { h: 272, s: 0.6,  vMul: 1.0 },
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60; if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}
function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255].map((n) => Math.max(0, Math.min(255, Math.round(n))))
}

const src = await Jimp.read('public/pion_imposteur.png')

for (const [name, t] of Object.entries(COLORS)) {
  const img = src.clone()
  const d = img.bitmap.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const r = d[i], g = d[i + 1], b = d[i + 2]
    // Pixel « corps » = rouge dominant (exclut contour noir, hublot bleu, reflets blancs).
    if (r > 70 && r - g > 35 && r - b > 35) {
      const { v } = rgbToHsv(r, g, b)
      const [nr, ng, nb] = hsvToRgb(t.h, t.s, Math.min(1, v * t.vMul))
      d[i] = nr; d[i + 1] = ng; d[i + 2] = nb
    }
  }
  // Réduit la taille : jetons de plateau (≈ 160 px de haut suffisent).
  img.resize({ h: 240 })
  await img.write(`public/cards/imposteur/crew-${name}.png`)
  console.log(`crew-${name}.png OK`)
}

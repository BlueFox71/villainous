// Script jetable : zoome le bas des cartes en conflit (badge de force bas-gauche
// + label de type bas-centre) et le coin coût de Voler aux Riches. Sortie _crops/.
import { Jimp } from 'jimp'
import { mkdirSync } from 'node:fs'

const CARDS = 'public/cards/prince-jean/'
const OUT = '_crops/'
mkdirSync(OUT, { recursive: true })

// Bas de carte : force (bas-gauche) + type (bas-centre)
for (const f of ['niquedouille', 'pendard', 'petit_jean', 'voler_riches', 'sherif_nottingham']) {
  const img = await Jimp.read(`${CARDS}${f}.png`)
  const H = img.bitmap.height
  const W = img.bitmap.width
  const strip = img.clone().crop({ x: 0, y: H - 130, w: W, h: 130 })
  strip.resize({ w: W * 2, h: 130 * 2 })
  await strip.write(`${OUT}bottom_${f}.png`)
}

// Coût (haut) de Voler aux Riches : zone plus large
{
  const img = await Jimp.read(`${CARDS}voler_riches.png`)
  const top = img.clone().crop({ x: 0, y: 0, w: 220, h: 220 })
  top.resize({ w: 660, h: 660 })
  await top.write(`${OUT}cost_voler_riches_big.png`)
}
console.log('crops OK')

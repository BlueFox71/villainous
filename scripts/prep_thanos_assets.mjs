// Jetable : range les cartes/plateau/dos/portrait/présentation de Thanos depuis
// assets/decks/Thanos/ (+ portraits/présentations) vers public/, aux noms
// kebab-case ASCII attendus par les CardDef. Redimensionne au gabarit du projet.
import { Jimp } from 'jimp'
import { mkdirSync, existsSync } from 'node:fs'

const SRC = 'assets/decks/Thanos'
const OUT = 'public/cards/thanos'
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
if (!existsSync('public/presentations')) mkdirSync('public/presentations', { recursive: true })

// [fichier source, destination, largeur cible]
const CARD_W = 620
const cards = [
  // Alliés
  ['légions de thanos.png', 'legions-de-thanos.png'],
  ['Black swan.png', 'black-swan.png'],
  ['Proxima minuit.png', 'proxima-minuit.png'],
  ['Corvus glaive.png', 'corvus-glaive.png'],
  ["Mâchoire d'ébène.png", 'machoire-d-ebene.png'],
  ['Main noir.png', 'nain-noir.png'],
  // Événements
  ['Cosultation du puits.png', 'consultation-du-puits.png'],
  ['Goût du pouvoir cosmique.png', 'gout-du-pouvoir-cosmique.png'],
  ['Un modeste prix à payer.png', 'un-modeste-prix-a-payer.png'],
  ['Sentence.png', 'sentence.png'],
  ['Le titan fou.png', 'le-titan-fou.png'],
  ['Distorsion de la réalité.png', 'distorsion-de-la-realite.png'],
  // Objets
  ['Faveur de la mort.png', 'faveur-de-la-mort.png'],
  ['Trône spatial.png', 'trone-spatial.png'],
  // Pierres (réserve)
  ['Pierre du pouvoir.png', 'pierre-du-pouvoir.png'],
  ['Pierre du temps.png', 'pierre-du-temps.png'],
  ["Pierre de l'espace.png", 'pierre-de-l-espace.png'],
  ["Pierre de l'esprit.png", 'pierre-de-l-esprit.png'],
  ["Pierre de l'âme.png", 'pierre-de-l-ame.png'],
  ['Pierre de la réalité.png', 'pierre-de-la-realite.png'],
  // Fatalité
  ['Adam warlock.png', 'adam-warlock.png'],
  ['Drax le destructuer.png', 'drax-le-destructeur.png'],
  ['Gamora.png', 'gamora.png'],
  ['Nebula.png', 'nebula.png'],
  ["découverte d'une pierre.png", 'decouverte-d-une-pierre.png'],
  ["Quelqu'en soit le prix.png", 'quel-qu-en-soit-le-prix.png'],
  // Dos
  ['Dos méchant.png', 'back-villain.png'],
  ['Dos fata.png', 'back-fate.png'],
  // Dos des Pierres (facultatif mais présents)
  ['Dos Pierre du pouvoir.png', 'back-pierre-du-pouvoir.png'],
  ['dos Pierre du temps.png', 'back-pierre-du-temps.png'],
  ["Dos de l'espace.png", 'back-pierre-de-l-espace.png'],
  ["Dos pierre de l'esprit.png", 'back-pierre-de-l-esprit.png'],
  ["Dos pierre de l'âme.png", 'back-pierre-de-l-ame.png'],
  ['Dos pierre de la réalité.png', 'back-pierre-de-la-realite.png'],
]

let ok = 0
for (const [s, d] of cards) {
  try {
    const img = await Jimp.read(`${SRC}/${s}`)
    img.resize({ w: CARD_W })
    await img.write(`${OUT}/${d}`)
    ok++
  } catch (e) {
    console.error('ÉCHEC', s, '→', d, ':', e.message)
  }
}
console.log(`${ok}/${cards.length} cartes rangées dans ${OUT}`)

// Plateau (paysage) → board.png (largeur 2400 pour rester net et léger)
{
  const b = await Jimp.read(`${SRC}/Plateau.png`)
  b.resize({ w: 2400 })
  await b.write(`${OUT}/board.png`)
  console.log('board.png OK', b.bitmap.width + 'x' + b.bitmap.height)
}

// Portrait (racine public) + présentation
{
  const p = await Jimp.read('assets/portraits/Thanos_portrait.png')
  p.resize({ w: 900 })
  await p.write('public/thanos.png')
  console.log('public/thanos.png OK')
  const pr = await Jimp.read('assets/presentations/Thanos_portrait.png')
  await pr.write('public/presentations/thanos.png')
  console.log('public/presentations/thanos.png OK')
}

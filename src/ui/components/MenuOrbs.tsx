// Orbes lumineux décoratifs de l'accueil : de petites sphères floutées qui
// flottent et dérivent en arrière-plan. Purement cosmétique (aucune logique de
// jeu). Les orbes sont générés une seule fois (au chargement du module) via un
// PRNG déterministe, donc stables entre rendus, sans dépendre de Math.random.

/** Teintes des orbes (centre lumineux), assorties aux vilains. */
const TINTS = [
  '214,188,255', // violet clair
  '255,230,170', // doré
  '190,225,255', // bleu froid
  '255,255,255', // blanc pur
]

const DRIFTS = ['orbDriftA', 'orbDriftB', 'orbDriftC']

// Grille jitterée : une cellule par orbe, avec un décalage aléatoire à
// l'intérieur de la cellule. Garantit une couverture homogène de tout l'écran
// (sans amas ni zones vides) tout en gardant un placement « naturel ».
const COLS = 11
const ROWS = 7 // 11 × 7 = 77 orbes

/** PRNG déterministe (LCG) : même séquence à chaque chargement. */
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

const rng = makeRng(0x5eed)
const pick = (max: number) => Math.floor(rng() * max)
const between = (min: number, max: number) => min + rng() * (max - min)

const ORBS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const cellW = 100 / COLS
  const cellH = 100 / ROWS
  return {
    // Centre de la cellule + jitter sur ~70 % de sa largeur/hauteur.
    left: col * cellW + cellW * between(0.15, 0.85),
    top: row * cellH + cellH * between(0.15, 0.85),
    size: between(5, 20),
    tint: pick(TINTS.length),
    drift: pick(DRIFTS.length),
    dur: between(24, 44),
    twk: between(3.5, 7.5),
    delay: between(0, 9),
  }
})

/** Couche d'orbes flottants en arrière-plan de l'accueil (non interactive). */
export function MenuOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {ORBS.map((o, i) => (
        <div
          key={i}
          className="menu-orb"
          style={{
            left: `${o.left}%`,
            top: `${o.top}%`,
            width: `${o.size}px`,
            height: `${o.size}px`,
            // Contour très doux : centre semi-transparent qui se fond tôt vers le
            // transparent, sans halo marqué.
            background: `radial-gradient(circle, rgba(${TINTS[o.tint]},0.6) 0%, rgba(${TINTS[o.tint]},0.18) 45%, rgba(${TINTS[o.tint]},0) 75%)`,
            boxShadow: `0 0 ${o.size * 0.9}px rgba(${TINTS[o.tint]},0.22)`,
            animationName: `${DRIFTS[o.drift]}, orbTwinkle`,
            animationDuration: `${o.dur}s, ${o.twk}s`,
            animationDelay: `${o.delay}s, ${o.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

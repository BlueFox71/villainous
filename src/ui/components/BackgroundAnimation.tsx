import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { villainAnimation, villainAnimationList, type VillainAnimation } from '../villainAnimations'
import type { VillainKey } from '../store/gameStore'

interface PropAnimProps {
  villain: VillainKey
  /** true = vilain du joueur ; false = adversaire. Sert à la trajectoire `cross`. */
  isPlayer: boolean
  /** Image à afficher (déjà choisie par le parent : cycle de couleurs pour l'Imposteur). */
  src: string
  /** Index de l'animation choisie pour ce passage (un vilain peut en avoir plusieurs). */
  animIdx: number
}

// Imposteur : couleurs tournant dans le sens HORAIRE (les autres en anti-horaire).
// Le jeton est le nom de fichier sans `ejected_`/`.png` (ex. `blue_dark`).
const CW_COLORS = new Set(['blue_dark', 'dark', 'green', 'pink', 'white', 'yellow'])
function spinClockwise(src: string): boolean {
  const m = src.match(/ejected_(.+)\.png$/)
  return m ? CW_COLORS.has(m[1]) : false
}

// Réglages de l'envol `sky-arc` (vol « habité » plutôt que glissé tout droit).
const ROT_AMP_DEG = 3 // amplitude du tangage (rotation ± degrés)
const ROT_CYCLES = 2.5 // nombre d'oscillations sur toute la montée
const BOB_AMP_PX = 8 // amplitude du flottement vertical superposé
const END_SCALE = 0.62 // échelle en fin de montée (s'éloigne dans le ciel)
const CURVE_BOW = 0.1 // bombement latéral de la trajectoire (× longueur du trajet)
const FADE_IN = 0.1 // part du trajet en fondu d'apparition
const FADE_OUT = 0.15 // part du trajet en fondu de disparition
const PEAK_OPACITY = 0.85 // opacité de pointe (ambiance qui survole sans masquer)
const ASCENT_SAMPLES = 48 // pas d'échantillonnage de la courbe de Bézier
const DRIFT_END_SCALE = 0.65 // échelle finale du coéquipier éjecté (rétrécit en dérivant)
const FIRE_IMAGE = '/animations/flamme_verte.png' // souffle de feu vert (Maléfique)
const PAGE_ASPECT = 285 / 339 // ratio l/h des pages de Slenderman
// Roses de la Reine de Cœur (durées en s) : apparition échelonnée, rougissement,
// maintien en rouge, puis fondu de disparition de toute la nuée.
const ROSE_STAGGER = 0.22 // écart d'apparition entre deux roses
const ROSE_APPEAR = 0.6 // durée du fondu d'apparition d'une rose
const ROSE_RED_FADE = 1.2 // durée de la coulure rouge (synchronisée ; cf. rosePaint en CSS)
const ROSE_HOLD = 4 // maintien en rouge avant disparition (demandé : 4 s)
// DEBUG TEMPORAIRE : fige le décor au centre de l'écran (pas de trajet) pour caler
// finement les FX (flamme, canons…). Remettre à `false` avant de committer.
const FREEZE_DEBUG: boolean = false
// Trajectoire `paws` (Cruella) : empreintes qui s'impriment puis s'effacent une par une.
const PAW_CROSS_STEP = 0.16 // s — écart d'apparition (et de disparition) entre deux empreintes
const PAW_CROSS_LIFE = 8 // s — durée de vie d'une empreinte (impression → pose → effacement ; cf. CSS)

/** Un décor de vilain qui passe à l'écran (UN passage). Deux trajectoires :
 *  - `cross` : traversée linéaire de la bande haute (joueur de gauche à droite,
 *    adversaire de droite à gauche), via les keyframes CSS.
 *  - `sky-arc` : arrive par le milieu-gauche et s'élève en ARC pour sortir en haut
 *    à droite (≈ 3/4), avec tangage, flottement, mise à l'échelle (profondeur) et
 *    fondus aux extrémités. Trajectoire relative à l'écran (API Web Animations). */
function VillainProp({ villain, isPlayer, src, animIdx }: PropAnimProps) {
  const anim = villainAnimationList(villain)[animIdx]
  const ref = useRef<HTMLDivElement>(null)
  const path = anim?.path ?? 'cross'
  // Traînée de pas (Kronk de Yzma, trajectoire `water-cross` avec image) : des triangles marquent le
  // sol au niveau de ses pieds, échelonnés DANS LE SENS DE SA COURSE (joueur → vers la droite ;
  // adversaire → vers la gauche), chacun en fondu sur 3 s. L'apparition est calée sur la position de
  // ses pieds → le triangle paraît à son passage et RESTE derrière lui.
  const [kronkPrints] = useState(() => {
    const dur = anim?.durationSec ?? 30
    const hPct = anim?.heightPct ?? 8
    const W = typeof window !== 'undefined' ? window.innerWidth : 1920
    const H = typeof window !== 'undefined' ? window.innerHeight : 1080
    const movingLeft = !isPlayer // adversaire = RTL ; joueur = LTR (comme `cross`)
    const START_PCT = 96
    const END_PCT = 6
    const SPACING_PX = 12 // espacement entre deux triangles
    const imgWvw = hPct * 1.06 * (H / W) // largeur de l'image en vw (ratio kronk ≈ 1,06)
    const foot = imgWvw * 0.5 // pieds ≈ centre de l'image
    const travel = 100 + imgWvw // course totale en vw
    const spanPx = ((START_PCT - END_PCT) / 100) * W
    const n = Math.min(400, Math.max(2, Math.round(spanPx / SPACING_PX))) // plafonné pour la perf
    return Array.from({ length: n }, (_, i) => {
      const left = START_PCT - (i / (n - 1)) * (START_PCT - END_PCT)
      // Fraction du trajet où les pieds atteignent `left` : RTL part de 100vw, LTR part de -largeur.
      const f = movingLeft ? (100 + foot - left) / travel : (left + imgWvw - foot) / travel
      return { left, delay: Math.max(0, f * dur) }
    })
  })
  // Plumes (Iago) : 1 à 3 « flux » par passage (→ 1 à 3 plumes à la fois), chacun
  // ressemant en boucle pendant le vol, direction/position/taille tirées au hasard.
  // Décidé une fois au montage (= un passage).
  const [featherList] = useState(() => {
    const hp = anim?.heightPct ?? 8
    const n = 1 + Math.floor(Math.random() * 3) // 1..3
    return Array.from({ length: n }, () => ({
      fly: 1 + Math.floor(Math.random() * 3), // direction (keyframe 1..3)
      delay: Math.random() * 2, // déphasage de la boucle
      left: 10 + Math.random() * 14, // %
      top: 38 + Math.random() * 18, // %
      sz: hp * (0.08 + Math.random() * 0.06), // vh (petite)
    }))
  })

  // Pages (Slenderman) : positions tirées au hasard sur TOUT l'écran (avec marges),
  // une fois au montage. Rendues dans le calque de fond (même plan que le bateau),
  // réparties sur toute la surface.
  const [pagePositions] = useState<{ x: number; y: number }[]>(() => {
    if (path !== 'pages' || !anim?.images) return []
    const vw = window.innerWidth
    const vh = window.innerHeight
    const ph = ((anim.heightPct ?? 15) / 100) * vh
    const pw = ph * PAGE_ASPECT
    const mx = pw / 2 + 10 // marge latérale
    const myTop = ph / 2 + 50 // sous le header
    const myBot = ph / 2 + 60 // au-dessus de la barre du bas
    return anim.images.map(() => ({
      x: mx + Math.random() * (vw - 2 * mx),
      y: myTop + Math.random() * (vh - myTop - myBot),
    }))
  })

  // Roses (Reine de Cœur) : 8 à 12 copies à des positions/orientations au hasard
  // (hors marges), figées une fois au montage.
  const [roseItems] = useState<{ x: number; y: number; rot: number }[]>(() => {
    if (path !== 'roses' || !anim?.image) return []
    const vw = window.innerWidth
    const vh = window.innerHeight
    const ph = ((anim.heightPct ?? 10) / 100) * vh
    const half = ph / 2 // rose ≈ carrée (514×515)
    const mx = half + 12 // marge latérale
    const myTop = half + 50 // sous le header
    const myBot = half + 60 // au-dessus de la barre du bas
    const n = 16 + Math.floor(Math.random() * 9) // 16..24
    return Array.from({ length: n }, () => ({
      x: mx + Math.random() * (vw - 2 * mx),
      y: myTop + Math.random() * (vh - myTop - myBot),
      rot: Math.random() * 360,
    }))
  })

  // Cruella (path `paws`) : DEUX traînées d'empreintes traversent en même temps — une dans la bande
  // HAUTE (droite→gauche, le sens d'Yzma), une dans la bande BASSE (gauche→droite) → deux chiens en
  // sens opposés. Chaque empreinte porte son propre `delay` (impression échelonnée par rangée).
  // Positions/orientations figées au montage ; impression + effacement joués en CSS (cf. cruellaPawCross).
  const [pawItems] = useState<{ x: number; y: number; rot: number; delay: number }[]>(() => {
    if (path !== 'paws') return []
    const vw = window.innerWidth
    const vh = window.innerHeight
    const ph = ((anim?.heightPct ?? 6) / 100) * vh // hauteur d'une empreinte (px)
    const mx = ph * 0.6 + 12 // marge latérale (l'empreinte ne sort pas du cadre)
    // Une rangée traversante : `yPct` la bande, `movingLeft` le sens de marche.
    const makeRow = (yPct: number, movingLeft: boolean) => {
      const yBand = (yPct / 100) * vh
      const wander = (Math.random() - 0.5) * (vh * 0.05) // léger dénivelé
      const n = 16 + Math.floor(Math.random() * 5) // 16..20 empreintes en travers
      return Array.from({ length: n }, (_, j) => {
        const t = n > 1 ? j / (n - 1) : 0
        return {
          x: movingLeft ? vw - mx - t * (vw - 2 * mx) : mx + t * (vw - 2 * mx),
          y: yBand + (t - 0.5) * wander + (j % 2 ? ph * 0.14 : -ph * 0.14), // alternance pattes G/D
          rot: (movingLeft ? -90 : 90) + (Math.random() - 0.5) * 16, // pointe dans le sens de marche
          delay: j * PAW_CROSS_STEP, // s (échelonné par rangée → chaque rangée s'imprime une à une)
        }
      })
    }
    return [
      ...makeRow(anim?.topPct ?? 8, true), // bande HAUTE, droite → gauche
      ...makeRow(88, false), // bande BASSE, gauche → droite
    ]
  })

  // Cheshire (Reine de Cœur, path `fade`) : une seule position au hasard (hors marges),
  // figée au montage.
  const [fadePos] = useState<{ x: number; y: number } | null>(() => {
    if (path !== 'fade' || !anim?.image) return null
    const vw = window.innerWidth
    const vh = window.innerHeight
    const ph = ((anim.heightPct ?? 20) / 100) * vh
    const half = ph / 2
    const mx = half + 12 // marge latérale
    const myTop = half + 50 // sous le header
    const myBot = half + 60 // au-dessus de la barre du bas
    return {
      x: mx + Math.random() * (vw - 2 * mx),
      y: myTop + Math.random() * (vh - myTop - myBot),
    }
  })

  // Pétales de la rose enchantée (Gaston) : 16 à 21 pétales tombent en VOLETANT (chute + ondulation
  // latérale + oscillation de rotation), nimbés d'une lueur rose, la plupart portant une flammèche.
  // Image/colonne/taille/vitesse/phases tirées au hasard, figées au montage ; tout est joué en CSS.
  const [petalItems] = useState<
    {
      img: string; left: number; size: number; dur: number; delay: number
      sway: number; swayDur: number; rotDur: number; rotDir: number; flame: boolean
    }[]
  >(() => {
    if (path !== 'petals' || !anim?.images) return []
    const imgs = anim.images
    const base = anim.heightPct ?? 5
    const n = anim.count ?? 16 + Math.floor(Math.random() * 6) // 16..21
    return Array.from({ length: n }, () => ({
      img: imgs[Math.floor(Math.random() * imgs.length)],
      left: 2 + Math.random() * 94, // % de la largeur
      size: base * (0.7 + Math.random() * 0.7), // vh (tailles variées)
      dur: 6 + Math.random() * 5, // s (chute lente, 6..11)
      delay: Math.random() * 4, // s (étalement)
      sway: 3 + Math.random() * 5, // vw (amplitude du voletement latéral)
      swayDur: 2.2 + Math.random() * 1.8, // s (période d'ondulation)
      rotDur: 2.5 + Math.random() * 2.5, // s (oscillation de rotation)
      rotDir: Math.random() < 0.5 ? -1 : 1, // sens de l'oscillation
      flame: Math.random() < 0.7, // ~70 % portent une flammèche
    }))
  })

  // Pièces (Prince Jean) : pluie de 16 à 22 pièces tombant du haut vers le bas, sur
  // toute la largeur. Image/colonne/taille/vitesse/spin tirées au hasard, figées au
  // montage. La chute elle-même est jouée en CSS (cf. coinFall).
  const [coinItems] = useState<
    { img: string; left: number; dur: number; delay: number; spin: number }[]
  >(() => {
    if (path !== 'coins' || !anim?.images) return []
    const imgs = anim.images
    const n = anim.count ?? 48 + Math.floor(Math.random() * 19) // défaut 48..66 (pluie dense)
    return Array.from({ length: n }, () => ({
      img: imgs[Math.floor(Math.random() * imgs.length)],
      left: 2 + Math.random() * 94, // % de la largeur
      // Taille IDENTIQUE pour toutes les pièces (= heightPct, posée au rendu).
      dur: 2.6 + Math.random() * 2.6, // s (vitesse de chute)
      delay: Math.random() * 3.2, // s (étalement de la pluie)
      spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540), // tours, sens au hasard
    }))
  })

  // Montée (Ursula : bulles ; Hadès : âmes) : 18 à 30 éléments par défaut (ou `count`),
  // taille/colonne/vitesse/ondulation au hasard, figés au montage. `sides` les concentre
  // sur les deux marges. La montée est jouée en CSS (cf. bubbleRise).
  const [bubbleItems] = useState<
    {
      img: string; left: number; size: number; dur: number; delay: number
      sway: number; swayDur: number; swayDelay: number; op: number
    }[]
  >(() => {
    if (path !== 'rise' || !anim?.images) return []
    const base = anim.heightPct ?? 5
    const imgs = anim.images
    const n = anim.count ?? 18 + Math.floor(Math.random() * 13) // défaut 18..30 (sinon imposé)
    // Répartition : sur toute la largeur, ou concentrée sur les DEUX CÔTÉS (`sides`) en
    // laissant ~16 % au centre pour les plateaux — chaque âme tirée dans la marge G ou D.
    const sideLeft = () =>
      Math.random() < 0.5 ? 1 + Math.random() * 41 : 58 + Math.random() * 41
    return Array.from({ length: n }, () => ({
      img: imgs[Math.floor(Math.random() * imgs.length)], // teinte au hasard
      left: anim.sides ? sideLeft() : 2 + Math.random() * 96, // % de la largeur (point d'ancrage)
      size: base * (0.45 + Math.random() * 1.1), // vh (bulles de tailles variées)
      dur: 5 + Math.random() * 4.5, // s (montée régulière, linéaire)
      delay: Math.random() * 5, // s (étalement du flux)
      sway: 2 + Math.random() * 4, // vw (amplitude d'ondulation, pendule ±)
      swayDur: 2.2 + Math.random() * 1.8, // s (période d'ondulation)
      swayDelay: -(Math.random() * 3), // s (phase d'ondulation décalée)
      op: 0.5 + Math.random() * 0.4, // opacité de pointe
    }))
  })

  // Flammes (Hadès) : 12 à 16 flammes le long du bas, taille/colonne/vitesse de boucle/
  // phase/miroir au hasard. La boucle d'animation (sprite) est jouée en CSS.
  const [flameItems] = useState<
    { left: number; size: number; loop: number; delay: number; flip: boolean; op: number }[]
  >(() => {
    if (path !== 'fire-bottom' || !anim?.sprite) return []
    const base = anim.heightPct ?? 32
    const n = 64 + Math.floor(Math.random() * 33) // 64..96 (mur de feu dense)
    const slot = 100 / n // largeur d'un emplacement régulier
    return Array.from({ length: n }, (_, i) => ({
      // Centres répartis RÉGULIÈREMENT de 0 à 100 % (+ léger décalage). Les flammes des
      // bords débordent (centrées via translateX(-50%)) et couvrent donc les coins.
      left: (i / (n - 1)) * 100 + (Math.random() - 0.5) * slot * 0.5, // % (centre)
      size: base * (0.55 + Math.random() * 0.95), // vh (0.55×–1.5×)
      loop: 2.3 + Math.random() * 1.1, // s (vitesse de la boucle de feu)
      delay: -(Math.random() * 3), // s (phase décalée)
      flip: Math.random() < 0.5, // miroir horizontal pour varier
      op: 0.8 + Math.random() * 0.2, // opacité
    }))
  })

  // Couleur des YEUX (Facilier) tirée au hasard : violet (original), blanc (désaturé +
  // éclairci) ou vert (rotation de teinte). Appliquée en `filter` sur le seul calque des
  // yeux, ce qui re-teinte aussi leur halo (le glow violet devient blanc/vert).
  const [voodooFilter] = useState(() => {
    const filters = [
      'none', // violet (original)
      'saturate(0) brightness(1.7)', // blanc
      'saturate(1.6) hue-rotate(160deg)', // vert
    ]
    return filters[Math.floor(Math.random() * filters.length)]
  })

  // Trajectoire `drift-spin` : dérive LINÉAIRE (vitesse constante) à hauteur constante
  // (reste visible tout le long), avec ROTATION LENTE de l'image (corps éjecté à la
  // Among Us). Sens de traversée selon le camp (joueur = gauche→droite, adversaire =
  // droite→gauche) ; sens de rotation selon la couleur.
  useLayoutEffect(() => {
    if (FREEZE_DEBUG || path !== 'drift-spin') return
    const el = ref.current
    if (!el || !anim) return
    const { width: w, height: h } = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    // Hors champ d'un bord à l'autre, MÊME hauteur (haut). Joueur → vers la droite ;
    // adversaire → vers la gauche (miroir).
    const y = vh / 6
    const offLeft = -w - w / 2
    const offRight = vw + w / 2
    const startX = isPlayer ? offLeft : offRight
    const endX = isPlayer ? offRight : offLeft
    const top = y - h / 2
    const spin = (spinClockwise(src) ? 1 : -1) * (anim.spinTurns ?? 1.25) * 360
    const anim2 = el.animate(
      [
        { transform: `translate(${startX}px, ${top}px) rotate(0deg) scale(1)` },
        { transform: `translate(${endX}px, ${top}px) rotate(${spin}deg) scale(${DRIFT_END_SCALE})` },
      ],
      { duration: (anim.durationSec ?? 16) * 1000, easing: 'linear', fill: 'both' },
    )
    return () => anim2.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Trajectoire `sky-arc` : calculée après montage (taille de l'élément + écran).
  useLayoutEffect(() => {
    if (FREEZE_DEBUG || path !== 'sky-arc') return
    const el = ref.current
    if (!el || !anim) return
    const { width: w, height: h } = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    // Trajectoire relative à l'écran, VARIÉE à chaque passage. Coordonnées calculées
    // pour un vol vers la DROITE (côté joueur), puis MIROITÉES pour l'adversaire.
    //  - 'arc'  : entre par le MILIEU-gauche et grimpe en cloche vers le haut-droite.
    //  - 'flat' : entre par le HAUT-gauche et file plus HORIZONTALEMENT vers la droite.
    const rnd = (a: number, b: number) => a + Math.random() * (b - a)
    const style = Math.random() < 0.5 ? 'arc' : 'flat'
    const p0 = { x: -w, y: 0 }
    const p2 = { x: 0, y: 0 }
    if (style === 'arc') {
      p0.y = vh * rnd(0.4, 0.62) // entrée milieu-gauche
      p2.x = vw * rnd(0.62, 0.85) // sortie haut-droite (~2/3–3/4)
      p2.y = -h
    } else {
      p0.y = vh * rnd(0.05, 0.2) // entrée haut-gauche
      p2.x = vw + w // sortie par le bord droit
      p2.y = vh * rnd(0.05, 0.28) // en restant haut → trajet quasi horizontal
    }
    // Adversaire : on MIROITE horizontalement (vol vers la gauche).
    if (!isPlayer) {
      p0.x = vw - p0.x
      p2.x = vw - p2.x
    }
    // Arc bombé vers le HAUT : point de contrôle au milieu, relevé (lift vertical).
    // Plus discret pour le style 'flat' (on veut un trajet horizontal).
    const segLen = Math.hypot(p2.x - p0.x, p2.y - p0.y) || 1
    const lift = CURVE_BOW * segLen * rnd(0.7, 1.4) * (style === 'arc' ? 1 : 0.5)
    const p1 = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 - lift }
    const bezier = (t: number) => {
      const u = 1 - t
      return {
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
      }
    }
    // Échantillonnage : à chaque pas on compose translation (centre suivant la
    // courbe + flottement), tangage (rotation), échelle (profondeur) et opacité.
    const frames: Keyframe[] = []
    for (let i = 0; i <= ASCENT_SAMPLES; i++) {
      const t = i / ASCENT_SAMPLES
      const pt = bezier(t)
      const rot = ROT_AMP_DEG * Math.sin(t * Math.PI * ROT_CYCLES)
      const bob = BOB_AMP_PX * Math.sin(t * Math.PI * ROT_CYCLES * 2)
      const scale = 1 - (1 - END_SCALE) * t
      // Coins haut-gauche (la rotation/échelle se font autour du centre).
      const left = pt.x - w / 2
      const top = pt.y + bob - h / 2
      const ramp =
        t < FADE_IN ? t / FADE_IN : t > 1 - FADE_OUT ? Math.max(0, (1 - t) / FADE_OUT) : 1
      const opacity = ramp * PEAK_OPACITY
      frames.push({
        transform: `translate(${left}px, ${top}px) rotate(${rot}deg) scale(${scale})`,
        opacity,
      })
    }
    const anim2 = el.animate(frames, {
      duration: (anim.durationSec ?? 10) * 1000,
      easing: 'linear',
      fill: 'both',
    })
    return () => anim2.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!anim) return null
  const heightPct = anim.heightPct ?? 8
  const durationSec = anim.durationSec ?? 30
  // DEBUG : fige le décor au centre de l'écran (pas de trajet) pour caler les FX.
  const freezeStyle = FREEZE_DEBUG
    ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%) scale(1.6)', opacity: 1 }
    : undefined

  if (path === 'pages') {
    // 8 pages apparaissent une à une en fondu, réparties sur tout l'écran, décalées de
    // 0,3 s, même durée d'apparition (3 s). Rendues dans le calque de FOND (même plan
    // que le bateau et les autres décors, en arrière-plan de l'UI).
    return (
      <div className="page-layer pointer-events-none absolute inset-0" aria-hidden>
        {pagePositions.map((p, i) => (
          <img
            key={i}
            src={anim.images?.[i]}
            alt=""
            className={`page-note${anim.glitch ? ' glitch-note' : ''}`}
            style={{ left: `${p.x}px`, top: `${p.y}px`, height: `${heightPct}vh`, animationDelay: `${i * 0.3}s` }}
            draggable={false}
          />
        ))}
      </div>
    )
  }

  if (path === 'roses') {
    // 8 à 12 roses BLANCHES apparaissent une à une (échelonnées), puis toutes virent
    // au ROUGE en même temps (calque rouge masqué à la forme de la rose, en multiply
    // pour garder le relief), maintenu ROSE_HOLD s, avant que toute la nuée disparaisse
    // en fondu. Délais calculés ici, animations jouées en CSS (cf. index.css).
    const n = roseItems.length
    const appearDone = (n - 1) * ROSE_STAGGER + ROSE_APPEAR // dernière rose posée
    const outDelay = appearDone + ROSE_RED_FADE + ROSE_HOLD // début du fondu global
    return (
      <div
        className="rose-layer pointer-events-none absolute inset-0"
        style={{ animationDelay: `${outDelay}s` }}
        aria-hidden
      >
        {roseItems.map((r, i) => (
          <div
            key={i}
            className="rose-note"
            style={{
              left: `${r.x}px`,
              top: `${r.y}px`,
              height: `${heightPct}vh`,
              animationDelay: `${i * ROSE_STAGGER}s`,
              '--rose-rot': `${r.rot}deg`,
            } as CSSProperties}
          >
            <img src={anim.image} alt="" className="rose-white" draggable={false} />
            <span
              className="rose-red"
              style={{
                animationDelay: `${appearDone}s`,
                // Masque = forme de la rose. La coulure (révélation du haut vers le bas)
                // est faite en CSS par un clip-path animé (cf. rosePaint).
                WebkitMaskImage: `url(${anim.image})`,
                maskImage: `url(${anim.image})`,
              }}
            />
          </div>
        ))}
      </div>
    )
  }

  if (path === 'fade') {
    // Le Chat du Cheshire se matérialise en fondu à un endroit au hasard, reste ~5 s, puis
    // s'évapore (fondu + léger grandissement). Durée totale = `durationSec` (cf. cheshireFade).
    if (!fadePos) return null
    return (
      <div className="page-layer pointer-events-none absolute inset-0" aria-hidden>
        <img
          src={anim.image}
          alt=""
          className="cheshire-fade"
          style={{
            left: `${fadePos.x}px`,
            top: `${fadePos.y}px`,
            height: `${heightPct}vh`,
            animationDuration: `${durationSec}s`,
            ...freezeStyle,
          }}
          draggable={false}
        />
      </div>
    )
  }

  if (path === 'paws') {
    // Traînée d'empreintes en travers de la bande haute (R→L) : chaque empreinte s'imprime à son tour
    // (cruellaPawCross : surgit en grossissant), reste posée, puis s'efface — décalage `PAW_CROSS_STEP`
    // → apparition ET disparition une par une. Fond du PNG transparent → `invert` donne une patte
    // blanche propre, sans `mix-blend-mode` (lisible quel que soit l'arrière-plan).
    return (
      <div className="paw-cross-layer pointer-events-none absolute inset-0" aria-hidden>
        {pawItems.map((p, i) => (
          <span
            key={i}
            className="paw-cross"
            style={{ left: `${p.x}px`, top: `${p.y}px`, transform: `translate(-50%, -50%) rotate(${p.rot}deg)` }}
          >
            <img
              src={anim.image}
              alt=""
              className="paw-cross-img"
              draggable={false}
              style={{ height: `${heightPct}vh`, animationDelay: `${p.delay}s`, animationDuration: `${PAW_CROSS_LIFE}s` }}
            />
          </span>
        ))}
      </div>
    )
  }

  if (path === 'fire-bottom') {
    // Rangée de flammes en bas de l'écran : chaque flamme joue le sprite en boucle
    // (background-position par pas), avec taille/colonne/phase au hasard. Le calque
    // apparaît/disparaît en fondu (fireAppear).
    const frames = anim.frames ?? 1
    return (
      <div className="fire-layer pointer-events-none absolute inset-0" style={{ animationDuration: `${durationSec}s`, filter: anim.tint }} aria-hidden>
        {flameItems.map((f, i) => (
          <div
            key={i}
            className="fire-flame"
            style={{
              left: `${f.left}%`,
              height: `${f.size}vh`,
              width: `${(f.size * 403) / 360}vh`,
              opacity: f.op,
              backgroundImage: `url(${anim.sprite})`,
              animationDuration: `${f.loop}s`,
              animationDelay: `${f.delay}s`,
              transform: f.flip ? 'translateX(-50%) scaleX(-1)' : 'translateX(-50%)',
              '--frames': frames,
              '--fh': `${f.size}vh`,
            } as CSSProperties}
          />
        ))}
      </div>
    )
  }

  if (path === 'voodoo') {
    // Les totems (base, violette) apparaissent en fondu en BAS de l'écran (pour les deux
    // camps). Le calque des yeux se superpose pile (même canevas) et brille 3 fois (faible
    // → moyen → fort) ; le 3ᵉ éclat est tenu ~3 s, puis tout s'éteint en douceur. La
    // couleur des YEUX (violet/blanc/vert) est tirée au hasard (filtre sur leur calque).
    return (
      <div
        className="voodoo-layer"
        style={{ height: `${heightPct}vh`, animationDuration: `${durationSec}s`, bottom: '2vh' }}
      >
        <img src={anim.image} alt="" className="voodoo-base" draggable={false} />
        <span className="voodoo-eyes-wrap" style={{ filter: voodooFilter }}>
          <img
            src={anim.overlayImage}
            alt=""
            className="voodoo-eyes"
            style={{ animationDuration: `${durationSec}s` }}
            draggable={false}
          />
        </span>
      </div>
    )
  }

  if (path === 'rise') {
    // Bulles montantes : l'enveloppe monte du bas vers le haut de façon LINÉAIRE et
    // continue (fondu aux extrémités) ; l'image à l'intérieur ondule latéralement
    // (pendule indépendant) → montée fluide sans à-coup. Joué en CSS (cf. bubbleRiseY/
    // bubbleSway).
    return (
      <div
        className={`bubble-layer pointer-events-none absolute inset-0${anim?.glow ? ' souls-layer' : ''}`}
        aria-hidden
      >
        {bubbleItems.map((b, i) => (
          <span
            key={i}
            className="bubble-rise"
            style={{
              left: `${b.left}%`,
              animationDuration: `${b.dur}s`,
              animationDelay: `${b.delay}s`,
              '--bubble-op': b.op,
            } as CSSProperties}
          >
            <img
              src={b.img}
              alt=""
              className="bubble-sway"
              draggable={false}
              style={{
                height: `${b.size}vh`,
                animationDuration: `${b.swayDur}s`,
                animationDelay: `${b.swayDelay}s`,
                '--bubble-sway': `${b.sway}vw`,
              } as CSSProperties}
            />
          </span>
        ))}
      </div>
    )
  }

  if (path === 'coins') {
    // Pluie de pièces : chaque pièce tombe du haut (hors écran) jusqu'en bas (clippée
    // par le calque), en tournoyant. Position/taille/vitesse/délai/spin posés en inline.
    return (
      <div className="coin-layer pointer-events-none absolute inset-0" aria-hidden>
        {coinItems.map((c, i) => (
          <img
            key={i}
            src={c.img}
            alt=""
            className="coin-fall"
            style={{
              left: `${c.left}%`,
              height: `${heightPct}vh`,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              '--coin-spin': `${c.spin}deg`,
            } as CSSProperties}
            draggable={false}
          />
        ))}
      </div>
    )
  }

  if (path === 'petals') {
    // Pétales de la rose enchantée : chaque pétale tombe (`.gp-petal`), ondule latéralement
    // (`.gp-petal-flutter`) et oscille en rotation (`.gp-petal-spin`) ; l'image porte la lueur rose,
    // et ~70 % portent une petite flamme. Wrappers en inline-block → chacun se cale sur le pétale.
    // (Préfixe `gp-` : évite la collision avec le décor `petals` de la Reine de Cœur.)
    return (
      <div className="gp-petal-layer pointer-events-none absolute inset-0" aria-hidden>
        {petalItems.map((p, i) => (
          <span
            key={i}
            className="gp-petal"
            style={{ left: `${p.left}%`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
          >
            <span
              className="gp-petal-flutter"
              style={{ animationDuration: `${p.swayDur}s`, animationDelay: `${p.delay}s`, '--sx': `${p.sway}vw` } as CSSProperties}
            >
              <span
                className="gp-petal-spin"
                style={{ animationDuration: `${p.rotDur}s`, animationDelay: `${p.delay}s`, '--rotdir': p.rotDir } as CSSProperties}
              >
                <img src={p.img} alt="" className="gp-petal-img" style={{ height: `${p.size}vh` }} draggable={false} />
                {p.flame && <span className="gp-petal-flame" />}
              </span>
            </span>
          </span>
        ))}
      </div>
    )
  }

  if (path === 'water-cross') {
    // Traverse le HAUT de l'écran. La VIDÉO (Tic-Tac de Crochet) garde son sens d'origine (toujours RTL,
    // clip déjà retourné en CSS). L'IMAGE (Kronk de Yzma) part dans le SENS du camp (comme `cross`/
    // Imposteur) : joueur de gauche à droite (LTR), adversaire de droite à gauche (RTL), et l'image est
    // retournée pour regarder dans le sens du déplacement (selon `facesLeft`).
    const movingLeft = anim.video ? true : !isPlayer
    const flip = movingLeft ? !anim.facesLeft : !!anim.facesLeft
    const imgStyle = { transform: flip ? 'scaleX(-1)' : undefined }
    return (
      <Fragment>
        {!anim.video && anim.onFoot && (
          <div className="kronk-trail" style={{ top: `calc(${anim.topPct ?? 2}% + ${heightPct - 1}vh)` }}>
            {kronkPrints.map((p, i) => (
              <span
                key={i}
                className="kronk-print"
                style={{
                  left: `${p.left}%`,
                  // Le triangle pointe dans le SENS de la course (gauche par défaut ; retourné si LTR).
                  transform: movingLeft ? undefined : 'translateX(-50%) scaleX(-1)',
                  animationDelay: `${p.delay}s`,
                }}
              />
            ))}
          </div>
        )}
        <div
          className="villain-prop"
          style={{
            top: `${anim.topPct ?? 2}%`,
            height: `${heightPct}vh`,
            animationName: movingLeft ? 'villainDriftRTL' : 'villainDriftLTR',
            animationDuration: `${durationSec}s`,
          }}
        >
          {anim.video ? (
            <video className="water-clip" src={anim.video} autoPlay loop muted playsInline />
          ) : anim.onFoot ? (
            // À pied (Kronk) : wrapper = vibration de course (rebond + secousse) ; l'image regarde dans le sens.
            <span className="water-run">
              <img src={anim.image} alt="" className="h-full w-auto select-none opacity-90" style={imgStyle} draggable={false} />
            </span>
          ) : anim.gait ? (
            // Démarche posée (filles de Trémaine) : wrapper = léger rebond + balancement (un peu de vibration).
            <span className="water-step">
              <img src={anim.image} alt="" className="h-full w-auto select-none" style={imgStyle} draggable={false} />
            </span>
          ) : (
            // Dérive simple (ex. dirigeable de Ratigan) : wrapper = léger flottement vertical (`water-float`).
            <span className="water-float">
              <img src={anim.image} alt="" className="h-full w-auto select-none" style={imgStyle} draggable={false} />
            </span>
          )}
        </div>
      </Fragment>
    )
  }

  if (path === 'drift-spin') {
    // Dérive linéaire + rotation lente (pilotées en JS) ; aucune orientation à gérer
    // (l'image tourne sur elle-même). transform-origin au centre pour la rotation.
    return (
      <div
        ref={ref}
        className="villain-prop villain-prop--free"
        style={{ height: `${heightPct}vh`, transformOrigin: 'center', ...freezeStyle }}
      >
        <img src={src} alt="" className="h-full w-auto select-none" draggable={false} />
      </div>
    )
  }

  if (path === 'sky-arc') {
    // Joueur = vol vers la DROITE ; adversaire = miroir (vol vers la GAUCHE). On
    // oriente l'image dans le sens du déplacement (facesLeft = l'image pointe à
    // gauche au naturel).
    const movingRight = isPlayer
    const flip = movingRight ? anim.facesLeft : !anim.facesLeft
    return (
      <div
        ref={ref}
        className="villain-prop villain-prop--free"
        style={{ height: `${heightPct}vh`, opacity: 0, transformOrigin: 'center', ...freezeStyle }}
      >
        {anim.feathers && (
          // Traînée de plumes derrière l'oiseau (côté queue = gauche quand il va à
          // droite). Rendue AVANT l'image pour passer sous l'oiseau. Miroitée pour un
          // vol vers la gauche.
          <div className="feather-fx" style={{ transform: movingRight ? undefined : 'scaleX(-1)' }}>
            {featherList.map((f, i) => (
              <span
                key={i}
                className="feather"
                style={{
                  left: `${f.left}%`,
                  top: `${f.top}%`,
                  width: `${f.sz * 1.9}vh`,
                  height: `${f.sz}vh`,
                  animationName: `featherFly${f.fly}`,
                  animationDelay: `${f.delay}s`,
                }}
              />
            ))}
          </div>
        )}
        <img
          src={src}
          alt=""
          className="h-full w-auto select-none"
          style={{ transform: flip ? 'scaleX(-1)' : undefined }}
          draggable={false}
        />
        {anim.cannons && (
          // Les TROIS canons de coque (anneaux jaunes), côté gauche du bateau affiché,
          // tirant vers le haut-gauche en rafale (léger décalage). Pour un vol vers la
          // gauche on miroite tout le groupe (positions + dérive) via scaleX(-1).
          <div className="cannon-fx" style={{ transform: movingRight ? undefined : 'scaleX(-1)' }}>
            {[0, 1, 2].map((i) => {
              const pos = { left: `${10 + i * 9}%`, top: '62%' }
              const delay = `${i * 0.12}s`
              const smoke = `${heightPct * 0.42}vh`
              const flash = `${heightPct * 0.3}vh`
              return (
                <Fragment key={i}>
                  <span className="cannon-smoke" style={{ ...pos, width: smoke, height: smoke, animationDelay: delay }} />
                  <span className="cannon-flash" style={{ ...pos, width: flash, height: flash, animationDelay: delay }} />
                </Fragment>
              )
            })}
          </div>
        )}
        {anim.fireBreath && (
          // Jet de feu vert (image colorisée) crachant par BOUFFÉES depuis la gueule
          // (à droite quand le dragon va à droite) : chaque bouffée grandit de petite à
          // grande puis s'estompe. Groupe miroité pour un vol vers la gauche.
          <div className="fire-fx" style={{ transform: movingRight ? undefined : 'scaleX(-1)' }}>
            <img
              src={FIRE_IMAGE}
              alt=""
              className="dragon-flame"
              style={{ right: '-93%', bottom: '-40%', width: `${heightPct * 1.7}vh` }}
              draggable={false}
            />
          </div>
        )}
      </div>
    )
  }

  // Trajectoire `cross` : joueur de gauche à droite (LTR) ; adversaire l'inverse.
  const movingLeft = !isPlayer
  const flip = movingLeft ? !anim.facesLeft : !!anim.facesLeft
  return (
    <div
      className="villain-prop"
      style={{
        top: '1%',
        height: `${heightPct}vh`,
        animationName: movingLeft ? 'villainDriftRTL' : 'villainDriftLTR',
        animationDuration: `${durationSec}s`,
      }}
    >
      <img
        src={src}
        alt=""
        className="h-full w-auto select-none opacity-90"
        style={{ transform: flip ? 'scaleX(-1)' : undefined }}
        draggable={false}
      />
    </div>
  )
}

interface Props {
  playerVillain: VillainKey
  opponentVillain: VillainKey
  /** DEBUG : changer `seq` (>0) force un passage immédiat du vilain `villain` sur
   *  le camp `side`. Permet de tester n'importe quel vilain sur n'importe quel côté. */
  debugFire?: { seq: number; villain: VillainKey; side: 'player' | 'opponent' }
}

// Fréquence d'apparition : par tranche de 10 min, on tire un nombre d'apparitions
// (4 à 6) et on découpe la fenêtre en autant d'écarts, tous ≥ 1 min 15 s, dont la
// somme fait 10 min. → exactement 4–6 apparitions / 10 min, jamais deux trop proches.
const WINDOW_MS = 10 * 60_000 // tranche de référence : 10 min
const MIN_GAP_MS = 75_000 // plancher entre deux apparitions : 1 min 15 s
const APPEARANCES_MIN = 4
const APPEARANCES_MAX = 6
// Marge ajoutée à la durée de traversée avant de démonter le prop.
const CLEANUP_BUFFER_MS = 1_500

// Écarts (ms) d'une fenêtre : N apparitions (4–6), chacune ≥ MIN_GAP_MS, somme = 10 min.
function makeWindowGaps(): number[] {
  const span = APPEARANCES_MAX - APPEARANCES_MIN + 1
  const n = APPEARANCES_MIN + Math.floor(Math.random() * span)
  const extra = WINDOW_MS - n * MIN_GAP_MS // marge à répartir au hasard
  const weights = Array.from({ length: n }, () => Math.random())
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  return weights.map((w) => MIN_GAP_MS + (w / sum) * extra)
}

// Mélange (Fisher-Yates), sans muter l'entrée.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Couche de décor animé en arrière-plan de la partie. Chaque vilain qui possède
 *  une animation envoie son prop traverser l'écran, à intervalles ALÉATOIRES. Le
 *  prop n'est monté que le temps de son passage. Posée au-dessus des panneaux
 *  mais sans interaction. */
export function BackgroundAnimation({
  playerVillain,
  opponentVillain,
  debugFire,
}: Props) {
  // `play` non-null = un passage est en cours ; `id` sert de clé de remontage,
  // `villain` mémorise le vilain affiché, `src` l'image choisie pour ce passage.
  type Play = { id: number; villain: VillainKey; src: string; animIdx: number } | null
  const [playerPlay, setPlayerPlay] = useState<Play>(null)
  const [opponentPlay, setOpponentPlay] = useState<Play>(null)
  const seq = useRef(0)
  const cleanupTimers = useRef<number[]>([])
  // File d'images mélangée par vilain : on épuise toutes les couleurs avant qu'une ne
  // réapparaisse (la file se régénère mélangée une fois vide). Clé = `villain#animIdx`
  // (chaque animation d'un vilain a sa propre file d'images).
  const imageQueues = useRef<Record<string, string[]>>({})
  const pickImage = (villain: VillainKey, animIdx: number, a: VillainAnimation): string => {
    if (a.path === 'pages' || a.path === 'coins' || a.path === 'rise' || a.path === 'water-cross' || a.path === 'voodoo' || a.path === 'fire-bottom' || a.path === 'paws' || a.path === 'petals') return '' // pas d'image unique ici
    if (!a.images || a.images.length === 0) return a.image ?? ''
    const key = `${villain}#${animIdx}`
    const q = imageQueues.current
    if (!q[key] || q[key].length === 0) q[key] = shuffle(a.images)
    return q[key].shift() as string
  }

  // Déclenche un passage sur un côté. Par défaut le vilain du camp ; `villainOverride`
  // permet d'afficher n'importe quel vilain sur ce camp (debug). Si le vilain a plusieurs
  // animations, on en tire une au hasard. Démonte après la traversée.
  const fire = (side: 'player' | 'opponent', villainOverride?: VillainKey) => {
    const villain = villainOverride ?? (side === 'player' ? playerVillain : opponentVillain)
    const list = villainAnimationList(villain)
    if (list.length === 0) return
    const animIdx = Math.floor(Math.random() * list.length)
    const anim = list[animIdx]
    const id = ++seq.current
    const set = side === 'player' ? setPlayerPlay : setOpponentPlay
    set({ id, villain, src: pickImage(villain, animIdx, anim), animIdx })
    if (FREEZE_DEBUG) return // figé : on garde le prop monté (pas de démontage auto)
    const lifeMs = (anim.durationSec ?? 30) * 1000 + CLEANUP_BUFFER_MS
    const t = window.setTimeout(() => set((cur) => (cur?.id === id ? null : cur)), lifeMs)
    cleanupTimers.current.push(t)
  }

  // Planificateur par fenêtre de 10 min : on consomme une file d'écarts (4–6 par
  // fenêtre, ≥ 1 min 15 s) ; à chaque échéance on envoie au hasard le prop du joueur
  // OU de l'adversaire (parmi ceux qui possèdent une animation), puis on planifie le
  // suivant. La file se régénère quand elle est vide (nouvelle fenêtre de 10 min).
  useEffect(() => {
    if (FREEZE_DEBUG) return // figé : pas d'apparitions aléatoires
    const sides = (['player', 'opponent'] as const).filter((s) =>
      villainAnimation(s === 'player' ? playerVillain : opponentVillain),
    )
    if (sides.length === 0) return
    let timer: number
    let gaps: number[] = []
    const nextGap = () => {
      if (gaps.length === 0) gaps = makeWindowGaps()
      return gaps.shift() as number
    }
    const schedule = () => {
      timer = window.setTimeout(() => {
        fire(sides[Math.floor(Math.random() * sides.length)])
        schedule()
      }, nextGap())
    }
    schedule()
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerVillain, opponentVillain])

  // DEBUG : un clic sur un bouton incrémente `debugFire.seq` → on force le passage
  // du vilain choisi sur le camp choisi.
  useEffect(() => {
    if (debugFire && debugFire.seq > 0) fire(debugFire.side, debugFire.villain)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugFire?.seq])

  // Nettoyage des timers de démontage au démontage du composant.
  useEffect(() => () => cleanupTimers.current.forEach((t) => window.clearTimeout(t)), [])

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: -1 }} aria-hidden>
      {playerPlay !== null && (
        <VillainProp key={`p-${playerPlay.id}`} villain={playerPlay.villain} isPlayer src={playerPlay.src} animIdx={playerPlay.animIdx} />
      )}
      {opponentPlay !== null && (
        <VillainProp
          key={`o-${opponentPlay.id}`}
          villain={opponentPlay.villain}
          isPlayer={false}
          src={opponentPlay.src}
          animIdx={opponentPlay.animIdx}
        />
      )}
    </div>
  )
}

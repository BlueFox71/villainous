import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { villainDecor, type VillainDecor as VillainDecorData } from '../villainDecor'
import type { VillainKey } from '../store/gameStore'

// Grain de pellicule : bruit (feTurbulence) généré par un petit SVG encodé en
// data-URI — auto-contenu, aucun fichier externe. Répété en mosaïque et déplacé en
// CSS pour « grouiller » comme le grain argentique d'un vieux film.
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/** Décor « vieille pellicule » : grain + scintillement + rayures + poussières +
 *  vignette sépia + perforations latérales. Tous les paramètres aléatoires sont
 *  figés une fois au montage (positions/durées/teintes), l'animation est jouée en
 *  CSS (cf. `index.css`, section « Décor permanent : pellicule de cinéma »). */
function FilmDecor() {
  // Rayures verticales : left / épaisseur / durée du cycle / déphasage / amplitude
  // du tremblement / teinte (la plupart sombres, quelques-unes claires sur le fond
  // sombre), tirés une fois au montage.
  const [scratches] = useState(() =>
    Array.from({ length: 7 }, () => ({
      left: 4 + Math.random() * 92, // %
      width: 0.6 + Math.random() * 1.6, // px
      dur: 3.5 + Math.random() * 6, // s (cycle apparition → tremblement → disparition)
      delay: -(Math.random() * 9), // s (déphasage : elles ne vont/viennent pas ensemble)
      jitter: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 6), // px (tremblement latéral)
      bright: Math.random() < 0.3, // ~1 rayure sur 3 est claire (éraflure « lumineuse »)
    })),
  )
  // Poussières / cheveux : petites taches qui apparaissent une fraction de seconde
  // puis disparaissent, à des moments décalés (durées/délais au hasard).
  const [dust] = useState(() =>
    Array.from({ length: 12 }, () => ({
      left: Math.random() * 100, // %
      top: Math.random() * 100, // %
      size: 1 + Math.random() * 2.6, // px
      dur: 4 + Math.random() * 7, // s
      delay: -(Math.random() * 11), // s
    })),
  )
  return (
    <div className="film-decor" aria-hidden>
      {/* Grain argentique animé. */}
      <div className="film-grain" style={{ backgroundImage: GRAIN_URL }} />
      {/* Scintillement de luminosité (projecteur instable). */}
      <div className="film-flicker" />
      {/* Rayures verticales. */}
      {scratches.map((s, i) => (
        <span
          key={i}
          className={`film-scratch${s.bright ? ' film-scratch--bright' : ''}`}
          style={{
            left: `${s.left}%`,
            width: `${s.width}px`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            '--scratch-jitter': `${s.jitter}px`,
          } as CSSProperties}
        />
      ))}
      {/* Poussières / cheveux. */}
      {dust.map((d, i) => (
        <span
          key={i}
          className="film-dust"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: `${d.size}px`,
            height: `${d.size}px`,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
          }}
        />
      ))}
      {/* Perforations (sprocket holes) défilant vers le bas sur les deux bords :
          donne l'impression que la pellicule tourne dans le projecteur. */}
      <div className="film-perforations film-perforations--left" />
      <div className="film-perforations film-perforations--right" />
    </div>
  )
}

/** Décor « sablier » : un filet de sable tombe du haut vers le bas (concentré au
 *  centre = le col du sablier) pendant qu'un niveau de sable se remplit au fond puis
 *  se vide en boucle (sablier qu'on retourne). Grains tirés une fois au montage,
 *  animation jouée en CSS (cf. `index.css`, section « Décor permanent : sablier »). */
// Teintes de sable (matières opaques, variées) : un vrai tas de sable n'est pas d'une
// seule couleur. Tirées par grain pour casser l'aspect « doré uniforme ».
const SAND_TONES = ['#e8c98a', '#d9b06c', '#c89a55', '#f0dca6', '#bf8f4d']

// Profil (clip-path) du tas de sable : triangle net (pic au centre, pentes droites).
const SAND_PILE_CLIP = 'polygon(50% 0, 100% 9%, 100% 100%, 0 100%, 0 9%)'

function SandDecor() {
  // Grains FINS et denses formant un RIDEAU RECTANGULAIRE : répartis uniformément sur
  // une bande verticale centrée et tombant tout droit (aucune dérive) → largeur
  // constante du haut au bas. + quelques grains ÉPARS sur toute la largeur (hors du
  // rideau central), plus lents et plus discrets.
  const BAND = 9 // % de la colonne : largeur du rideau central
  const [grains] = useState(() => [
    // Rideau central, dense.
    ...Array.from({ length: 420 }, (_, i) => ({
      left: 50 + (Math.random() - 0.5) * BAND, // % (réparti sur toute la bande)
      w: 0.7 + Math.random() * 1.3, // px (grain très fin)
      h: (0.7 + Math.random() * 1.3) * (1.6 + Math.random() * 1.8), // px (léger flou de chute)
      dur: 0.8 + Math.random() * 0.8, // s (chute rapide)
      delay: -(Math.random() * 2), // s (flux continu, déphasé)
      op: 0.5 + Math.random() * 0.45, // opacité
      tone: SAND_TONES[i % SAND_TONES.length], // teinte de sable
    })),
    // Grains épars hors du rideau (toute la largeur), un peu plus lents.
    ...Array.from({ length: 45 }, (_, i) => ({
      left: Math.random() * 100, // % (n'importe où dans la colonne)
      w: 0.9 + Math.random() * 1.4, // px (un peu plus gros → visibles)
      h: (0.9 + Math.random() * 1.4) * (1.5 + Math.random() * 1.7), // px
      dur: 1.2 + Math.random() * 1.2, // s (chute plus lente)
      delay: -(Math.random() * 3), // s
      op: 0.6 + Math.random() * 0.35, // bien visibles
      tone: SAND_TONES[i % SAND_TONES.length],
    })),
  ])
  return (
    <div className="sand-decor" aria-hidden>
      {/* Grains fins qui tombent en s'évasant. */}
      <div className="sand-stream">
        {grains.map((g, i) => (
          <span
            key={i}
            className="sand-grain"
            style={{
              left: `${g.left}%`,
              width: `${g.w}px`,
              height: `${g.h}px`,
              background: g.tone,
              opacity: g.op,
              animationDuration: `${g.dur}s`,
              animationDelay: `${g.delay}s`,
            }}
          />
        ))}
      </div>
      {/* Niveau de sable : se remplit (tas) puis se vide → boucle. Silhouette (apex
          arrondi + pentes ondulées) posée en clip-path inline. */}
      <div className="sand-fill" style={{ clipPath: SAND_PILE_CLIP }} />
    </div>
  )
}

/** Décor « espace » : un champ d'étoiles (points blancs) défile vers la droite, avec
 *  profondeur — les étoiles proches sont plus grosses, plus rapides et laissent une
 *  traînée → on file dans l'espace comme à travers le hublot d'une fusée. Étoiles
 *  tirées une fois au montage, défilement joué en CSS (cf. `index.css`). */
function SpaceDecor() {
  const [stars] = useState(() =>
    Array.from({ length: 80 }, () => {
      const depth = Math.random() // 0 = lointaine, 1 = proche
      const size = 1.8 + depth * 3.4 // px (proche = plus grosse)
      const dur = 120 - depth * 55 // s (proche = plus rapide : ~65 à 120 s)
      return {
        top: Math.random() * 100, // %
        size,
        dur,
        delay: -(Math.random() * dur), // s (étalées sur le trajet)
        op: 0.7 + depth * 0.3, // proche = plus brillante
      }
    }),
  )
  return (
    <div className="space-decor" aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={{
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.op,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  )
}

// Ratio largeur/hauteur d'une frame du sprite de flamme (cf. fire_sprite.png).
const FLAME_ASPECT = 403 / 360

/** Décor « feu » : un mur de flammes permanent en bas de l'écran. Chaque flamme joue le
 *  sprite vertical en boucle (cf. `.fire-flame` dans index.css) ; teinte (`tint`) posée
 *  sur le conteneur. Tailles/positions/phases tirées une fois au montage. */
function FireDecor({ decor }: { decor: Extract<VillainDecorData, { kind: 'fire' }> }) {
  const base = decor.heightPct ?? 32
  const [flames] = useState(() => {
    const n = 48 + Math.floor(Math.random() * 17) // 48..64 (mur dense)
    const slot = 100 / n
    return Array.from({ length: n }, (_, i) => ({
      // Centres répartis régulièrement de 0 à 100 % (+ léger décalage) ; les flammes
      // des bords débordent (centrées) et couvrent donc les coins de la colonne.
      left: (i / (n - 1)) * 100 + (Math.random() - 0.5) * slot * 0.5, // %
      size: base * (0.55 + Math.random() * 0.95), // vh
      loop: 2.3 + Math.random() * 1.1, // s (vitesse de la boucle de feu)
      delay: -(Math.random() * 3), // s (phase décalée)
      flip: Math.random() < 0.5, // miroir horizontal pour varier
      op: 0.8 + Math.random() * 0.2, // opacité
    }))
  })
  return (
    <div className="fire-decor" style={{ filter: decor.tint }} aria-hidden>
      {flames.map((f, i) => (
        <div
          key={i}
          className="fire-flame"
          style={{
            left: `${f.left}%`,
            height: `${f.size}vh`,
            width: `${f.size * FLAME_ASPECT}vh`,
            opacity: f.op,
            backgroundImage: `url(${decor.sprite})`,
            animationDuration: `${f.loop}s`,
            animationDelay: `${f.delay}s`,
            transform: f.flip ? 'translateX(-50%) scaleX(-1)' : 'translateX(-50%)',
            '--frames': decor.frames,
            '--fh': `${f.size}vh`,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

/** Décor « chevelure dorée » : des mèches lumineuses pendent du haut de l'écran et se
 *  balancent lentement (transform-origin en haut → pendule), un halo doré pulse au
 *  rythme de l'incantation, et des particules d'or montent en scintillant. Mèches/
 *  particules tirées une fois au montage, animation jouée en CSS (cf. `index.css`,
 *  section « Décor permanent : chevelure dorée »). */
function GoldenHairDecor() {
  // Mèches : position / épaisseur / hauteur / durée d'oscillation / déphasage /
  // amplitude du balancement / opacité, tirées une fois au montage.
  const [strands] = useState(() =>
    Array.from({ length: 36 }, () => ({
      left: Math.random() * 100, // %
      width: 1 + Math.random() * 3.4, // px (mèches d'épaisseurs variées)
      height: 62 + Math.random() * 38, // % (certaines mèches plus courtes)
      dur: 5 + Math.random() * 6, // s (oscillation lente)
      delay: -(Math.random() * 11), // s (déphasage : elles ne se balancent pas ensemble)
      swing: 1.5 + Math.random() * 5, // deg (amplitude du balancement, pivot en haut)
      op: 0.3 + Math.random() * 0.5,
    })),
  )
  // Particules d'or : petits points qui montent en scintillant (la magie de la fleur).
  const [motes] = useState(() =>
    Array.from({ length: 26 }, () => ({
      left: Math.random() * 100, // %
      size: 1.4 + Math.random() * 2.8, // px
      dur: 7 + Math.random() * 8, // s (montée lente)
      delay: -(Math.random() * 15), // s
    })),
  )
  // Incantation « Fleur aux pétales d'or… » : à intervalle aléatoire, une vague de
  // lumière jaune vif court du haut vers le bas le long des mèches (classe `is-singing`
  // → animation CSS `hairSing`), puis s'estompe. On reprogramme une incantation après.
  const [singing, setSinging] = useState(false)
  useEffect(() => {
    const SING_MS = 45200 // durée de l'incantation : remplissage 25 s + brillance 15 s + fondu 5 s (≈ keyframes hairSing)
    let glow: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    // Première incantation au bout de 2 min ; ensuite, entre 3 min et 3 min 30 après la
    // fin de la précédente.
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        setSinging(true)
        glow = setTimeout(() => {
          setSinging(false)
          schedule(180000 + Math.random() * 30000) // 3 min → 3 min 30
        }, SING_MS)
      }, delay)
    }
    schedule(75000) // première incantation après 1 min 15 s
    return () => {
      clearTimeout(next)
      clearTimeout(glow)
    }
  }, [])
  return (
    <div className={`hair-decor${singing ? ' is-singing' : ''}`} aria-hidden>
      {/* Mèches dorées suspendues. */}
      {strands.map((s, i) => (
        <span
          key={i}
          className="hair-strand"
          style={{
            left: `${s.left}%`,
            width: `${s.width}px`,
            height: `${s.height}%`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            '--hair-swing': `${s.swing}deg`,
            '--hair-op': s.op,
          } as CSSProperties}
        />
      ))}
      {/* Particules d'or qui montent en scintillant. */}
      {motes.map((m, i) => (
        <span
          key={i}
          className="hair-mote"
          style={{
            left: `${m.left}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
      {/* Halo doré qui pulse au rythme de l'incantation. */}
      <div className="hair-glow" />
    </div>
  )
}

/** Décor « vidéo » : une vidéo en boucle (plein cadre, `object-fit: cover`) recouverte
 *  d'un dégradé teinté en `mix-blend-mode: color` → la vidéo est colorée tout en gardant
 *  sa luminance/ses mouvements (cf. `index.css`, `.video-decor`). */
function VideoDecor({ decor }: { decor: Extract<VillainDecorData, { kind: 'video' }> }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fadeRef = useRef<HTMLDivElement>(null)
  // Bouclage en fondu (au lieu du `loop` natif qui coupe sec) : sur les FADE_OUT
  // dernières secondes, on fond la vidéo au noir ; à la fin, on la redémarre en
  // refondant depuis le noir (FADE_IN) → aucune coupure visible.
  useEffect(() => {
    const v = videoRef.current
    const f = fadeRef.current
    if (!v || !f) return
    const FADE_OUT = 5 // s (fondu au noir en fin de vidéo)
    const FADE_IN = 3 // s (refondu au démarrage)
    let fadingOut = false
    const onTime = () => {
      if (!v.duration || Number.isNaN(v.duration)) return
      if (!fadingOut && v.currentTime >= v.duration - FADE_OUT) {
        fadingOut = true
        f.style.transitionDuration = `${FADE_OUT}s`
        f.style.opacity = '1' // fondu au noir
      }
    }
    const onEnded = () => {
      v.currentTime = 0
      void v.play()
      fadingOut = false
      f.style.transitionDuration = `${FADE_IN}s`
      f.style.opacity = '0' // refondu depuis le noir
    }
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('ended', onEnded)
    }
  }, [])
  return (
    <div className="video-decor" aria-hidden>
      {/* Sizing posé EN INLINE (et non via CSS) : un élément remplacé comme <video> ne
          s'étire pas toujours via une règle de classe → on garantit le plein cadre ici.
          Pas de `loop` natif : le bouclage en fondu est géré au-dessus. */}
      <video
        ref={videoRef}
        src={decor.src}
        autoPlay
        muted
        playsInline
        style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {decor.gradient && <div className="video-tint" style={{ backgroundImage: decor.gradient }} />}
      {/* Voile noir du fondu de bouclage (opacité pilotée en JS). */}
      <div ref={fadeRef} className="video-fade" />
    </div>
  )
}

// Les 11 pièces découpées (mêmes images que la pluie de pièces temporaire de Prince Jean).
const COIN_IMAGES = Array.from({ length: 11 }, (_, i) => `/animations/piece-${i + 1}.png`)

/** Décor « poussière d'or » : de fines particules dorées dérivent lentement vers le haut
 *  en ondulant (vitesses/tailles variées) ; environ une sur quatre scintille (éclat de
 *  reflet déphasé). Quelques PIÈCES tombent lentement en tournoyant par-dessus. Voile
 *  chaud + vignette posés sur le conteneur. Éléments tirés une fois au montage, animations
 *  jouées en CSS (cf. `index.css`, section « poussière d'or »). */
function GoldDustDecor() {
  const [motes] = useState(() =>
    Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * 100, // %
      size: 1 + Math.random() * 3, // px (fines particules, quelques plus grosses)
      dur: 10 + Math.random() * 11, // s (dérive lente, 10–21 s)
      delay: -(Math.random() * 21), // s (flux continu, déphasé)
      sway: 2 + Math.random() * 5, // vw (amplitude d'ondulation latérale)
      swayDur: 3 + Math.random() * 3, // s (période d'ondulation)
      op: 0.3 + Math.random() * 0.5, // opacité de pointe
      twinkle: i % 4 === 0, // ~1/4 scintille
      twkDur: 1.4 + Math.random() * 2, // s (cycle de scintillement)
      twkDelay: -(Math.random() * 3), // s (déphasage du scintillement)
    })),
  )
  // Pièces qui tombent lentement en tournoyant, en continu. La ROTATION est un multiple
  // de 360° → bouclage sans à-coup (le saut de position se fait hors écran, invisible).
  const [coins] = useState(() =>
    Array.from({ length: 9 }, () => ({
      img: COIN_IMAGES[Math.floor(Math.random() * COIN_IMAGES.length)],
      left: 4 + Math.random() * 92, // %
      size: 2.2 + Math.random() * 2.3, // vh
      dur: 12 + Math.random() * 10, // s (chute lente, 12–22 s)
      delay: -(Math.random() * 22), // s (étalées sur tout le trajet)
      spin: (Math.random() < 0.5 ? -1 : 1) * 360 * (1 + Math.floor(Math.random() * 3)), // ±360/720/1080°
      op: 0.5 + Math.random() * 0.3, // un peu transparentes (arrière-plan)
    })),
  )
  return (
    <div className="gold-dust-decor" aria-hidden>
      {motes.map((m, i) => (
        // Enveloppe = dérive ascendante (translateY) ; enfant = ondulation latérale
        // (pendule) → mouvement flottant sans à-coup, comme les bulles d'Ursula.
        <span
          key={i}
          className="gold-mote-rise"
          style={{
            left: `${m.left}%`,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
          }}
        >
          <span
            className="gold-mote-sway"
            style={{
              '--sway': `${m.sway}vw`,
              animationDuration: `${m.swayDur}s`,
              animationDelay: `${m.delay}s`,
            } as CSSProperties}
          >
            <span
              className={`gold-mote${m.twinkle ? ' gold-mote--twinkle' : ''}`}
              style={{
                width: `${m.size}px`,
                height: `${m.size}px`,
                opacity: m.op,
                ...(m.twinkle
                  ? { animationDuration: `${m.twkDur}s`, animationDelay: `${m.twkDelay}s` }
                  : null),
              }}
            />
          </span>
        </span>
      ))}
      {/* Pièces qui tombent lentement en tournoyant (réutilise les keyframes coinFall). */}
      {coins.map((c, i) => (
        <img
          key={`coin-${i}`}
          src={c.img}
          alt=""
          className="gold-coin"
          style={{
            left: `${c.left}%`,
            height: `${c.size}vh`,
            opacity: c.op,
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

/** Décor « ronces » : l'image `ronces.png` (ronces noires sur fond blanc) posée en
 *  `mix-blend-mode: multiply` → le blanc disparaît, seules les ronces restent, par-dessus
 *  une lueur verte pulsante (la magie de Maléfique) ; des étincelles vertes s'élèvent en
 *  scintillant. Étincelles tirées une fois au montage. */
function ThornsDecor() {
  // Étincelles vertes qui montent en scintillant.
  const [sparks] = useState(() =>
    Array.from({ length: 26 }, () => ({
      left: Math.random() * 100, // %
      size: 1.4 + Math.random() * 2.6, // px
      dur: 6 + Math.random() * 6, // s (montée)
      delay: -(Math.random() * 12), // s
      drift: (Math.random() - 0.5) * 8, // vw (dérive latérale)
      op: 0.5 + Math.random() * 0.4,
    })),
  )
  return (
    <div className="thorns-decor" aria-hidden>
      {/* Lueur verte pulsante (la magie qui émane du sol). */}
      <div className="thorn-glow" />
      {/* Boule verte hypnotique qui se balade DERRIÈRE les ronces (la magie de Maléfique). */}
      <div className="thorn-orb" />
      {/* Étincelles vertes. */}
      {sparks.map((s, i) => (
        <span
          key={`spark-${i}`}
          className="thorn-spark"
          style={{
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            '--drift': `${s.drift}vw`,
            '--op': s.op,
          } as CSSProperties}
        />
      ))}
      {/* Ronces : image en multiply (le blanc s'efface, les ronces noires restent).
          Trois calques superposés (0° / 90° / 60°) → enchevêtrement plus dense. */}
      <div className="thorn-bramble" />
      <div className="thorn-bramble thorn-bramble--rot" />
      <div className="thorn-bramble thorn-bramble--rot45" />
    </div>
  )
}

/** Décor « forest » (Slenderman) — CONSTRUCTION ÉTAPE PAR ÉTAPE.
 *  Étape 2 : des TRONCS noirs en silhouette et des COUCHES DE BRUME bleutées partagent le
 *  même empilement (z-index = profondeur×100) → la brume s'intercale ENTRE les troncs.
 *  La brume DÉRIVE (nappes mobiles). Un SOL sombre est au premier plan. */
// Couches de brume, indexées par PROFONDEUR (0 lointain → 1 proche). Le z-index (= depth×100)
// les entrelace avec les troncs (eux aussi indexés par profondeur) → la brume passe ENTRE les
// arbres. Du plus lointain (clair/haut/flou) au plus proche (sombre/bas).
const FOREST_FOG: { depth: number; bottom: number; height: number; blur: number; color: string; op: number }[] = [
  { depth: 0.12, bottom: 34, height: 42, blur: 22, color: '120, 150, 205', op: 0.45 }, // très lointain : bleu pâle, haut
  { depth: 0.32, bottom: 22, height: 48, blur: 18, color: '140, 172, 220', op: 0.6 }, // lointain : bleuté
  { depth: 0.62, bottom: 10, height: 50, blur: 13, color: '92, 120, 170', op: 0.85 }, // intermédiaire : bleu-gris
  { depth: 0.86, bottom: 2, height: 40, blur: 9, color: '58, 80, 122', op: 0.96 }, // proche : bleu froid sombre
]
function fogStyle(f: (typeof FOREST_FOG)[number]): CSSProperties {
  return {
    zIndex: Math.round(f.depth * 100),
    bottom: `${f.bottom}%`,
    height: `${f.height}%`,
    filter: `blur(${f.blur}px)`,
    background: `linear-gradient(to top, rgba(${f.color}, ${f.op}) 0%, rgba(${f.color}, ${f.op * 0.5}) 40%, rgba(${f.color}, 0) 100%)`,
  }
}
type FogBlob = { depth: number; left: number; top: number; w: number; h: number; blur: number; color: string; op: number; amp: number; dur: number; delay: number }
function fogBlobStyle(b: FogBlob): CSSProperties {
  return {
    zIndex: Math.round(b.depth * 100),
    left: `${b.left}%`,
    top: `${b.top}%`,
    width: `${b.w}vh`,
    height: `${b.h}vh`,
    background: `radial-gradient(ellipse at center, rgba(${b.color}, ${b.op}) 0%, rgba(${b.color}, 0) 70%)`,
    filter: `blur(${b.blur}px)`,
    animationDuration: `${b.dur}s`,
    animationDelay: `${b.delay}s`,
    '--amp': `${b.amp}vw`,
  } as CSSProperties
}
function ForestDecor() {
  // Glitch « bug pixel » psychologique (Slenderman) : par bouffées aléatoires toutes les 2–3 min,
  // toute la scène se déchire ~1–2 s (esprit datamosh de Sombra) ET la SILHOUETTE de Slenderman
  // apparaît furtivement à un endroit au hasard (le glitch « révèle » sa présence).
  const [glitch, setGlitch] = useState(false)
  const [figureLeft, setFigureLeft] = useState(50)
  useEffect(() => {
    let burst: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const schedule = () => {
      next = setTimeout(() => {
        setFigureLeft(12 + Math.random() * 76) // nouvel emplacement à chaque apparition
        setGlitch(true)
        burst = setTimeout(() => {
          setGlitch(false)
          schedule()
        }, 1200 + Math.random() * 900) // bouffée de 1,2–2,1 s
      }, 60000 + Math.random() * 60000) // 1–2 min entre deux bouffées
    }
    schedule()
    return () => {
      clearTimeout(next)
      clearTimeout(burst)
    }
  }, [])
  // Nappes de brume floues qui DÉRIVENT (va-et-vient lent) → la brume bouge. Indexées par
  // profondeur (z-index = depth×100) pour passer ENTRE les troncs ; parallaxe (vitesses variées).
  const [fogBlobs] = useState(() =>
    Array.from({ length: 11 }, () => {
      const depth = Math.random() // 0 lointain, 1 proche
      return {
        depth,
        left: Math.random() * 100, // %
        top: 44 + Math.random() * 46, // % (moitié basse)
        w: 34 + Math.random() * 34, // vh (grosses nappes)
        h: 16 + Math.random() * 18, // vh (aplatie : la brume s'étale horizontalement)
        blur: 16 + (1 - depth) * 20, // px
        color: depth < 0.5 ? '140, 172, 220' : '72, 98, 152', // bleuté (lointain plus clair)
        op: 0.28 + Math.random() * 0.24, // plus opaques
        amp: 16 + Math.random() * 16, // vw (va-et-vient large → bien visible)
        dur: 7 + Math.random() * 7, // s
        delay: -(Math.random() * 24), // s (déphasage)
      }
    }),
  )
  // Troncs = images PNG (fond transparent) passées en SILHOUETTE NOIRE (filter brightness(0)).
  // Emplacement, nombre et miroir tirés au hasard ; tronc3 (grappe de bouleaux) n'apparaît
  // qu'UNE seule fois, exceptionnellement.
  const [trees] = useState(() => {
    const COMMON = ['/animations/tronc1.png', '/animations/tronc2.png']
    const make = (img: string, special = false) => {
      const depth = Math.random() // 0 = lointain, 1 = proche
      return {
        img,
        depth, // pour le z-index (entrelacement avec la brume)
        left: Math.random() * 100, // %
        w: special ? 16 + Math.random() * 10 : (5 + depth * 9) * (0.7 + Math.random() * 0.6), // vh
        hPct: 112 + Math.random() * 28, // % (dépasse le haut de l'écran : feuillage hors champ)
        lean: (Math.random() - 0.5) * 3, // deg (léger penchant)
        blur: (1 - depth) * 2.4, // px (lointain = plus flou)
        flip: Math.random() < 0.5, // miroir horizontal pour varier
      }
    }
    const n = 13 + Math.floor(Math.random() * 7) // 13–19 troncs communs
    const arr = Array.from({ length: n }, () => make(COMMON[Math.floor(Math.random() * COMMON.length)]))
    arr.push(make('/animations/tronc3.png', true)) // exceptionnel : une seule fois
    return arr
  })
  return (
    <div className={`forest-decor${glitch ? ' is-glitching' : ''}`} aria-hidden>
      {/* Troncs ET brume partagent le MÊME empilement, chacun avec un z-index = profondeur×100
          → la brume s'intercale entre les troncs (certains devant, d'autres derrière). */}
      {/* Bandes de brume (dégradés). */}
      {FOREST_FOG.map((f, i) => (
        <div key={`fog-${i}`} className="forest-mist" style={fogStyle(f)} />
      ))}
      {/* Nappes de brume mobiles. */}
      {fogBlobs.map((b, i) => (
        <span key={`blob-${i}`} className="forest-fog-blob" style={fogBlobStyle(b)} />
      ))}
      {/* Troncs (images PNG en silhouette noire ; z-index par profondeur). */}
      {trees.map((t, i) => (
        <span
          key={i}
          className="forest-tree"
          style={{
            zIndex: Math.round(t.depth * 100),
            left: `${t.left}%`,
            width: `${t.w}vh`,
            height: `${t.hPct}%`,
            backgroundImage: `url(${t.img})`,
            filter: `brightness(0) blur(${t.blur}px)`,
            transform: `translateX(-50%) rotate(${t.lean}deg) scaleX(${t.flip ? -1 : 1})`,
          }}
        />
      ))}
      {/* Silhouette de Slenderman (parmi les arbres), révélée seulement pendant la bouffée. */}
      <div
        className="forest-figure"
        style={{ left: `${figureLeft}%`, backgroundImage: 'url(/animations/slenderman_animation.png)' }}
      />
      {/* Sol sombre, au premier plan (au-dessus de tout). */}
      <div className="forest-ground" style={{ zIndex: 130 }} />
      {/* Scanlines du glitch (par-dessus tout, visible seulement en bouffée). */}
      <div className="forest-static" />
    </div>
  )
}

/** Décor « petals » : des pétales de roses rouges tombent du haut en voletant (oscillation
 *  latérale) et en tournoyant, sur un fond cramoisi sombre. Pétales tirés une fois au montage,
 *  chute jouée en CSS (cf. `index.css`, section « pétales de roses »). (Reine de Cœur) */
const PETAL_REDS = ['#c8162e', '#a8122a', '#d83350', '#8e0e22', '#b81832']
function PetalsDecor() {
  const [petals] = useState(() =>
    Array.from({ length: 36 }, (_, i) => ({
      left: Math.random() * 100, // %
      size: 1.3 + Math.random() * 2.3, // vh (largeur du pétale ; hauteur = ×1,4)
      dur: 13 + Math.random() * 11, // s (durée de chute, lente)
      delay: -(Math.random() * 24), // s (étalement)
      sx: 4 + Math.random() * 8, // vw (amplitude du voletement latéral)
      color: PETAL_REDS[i % PETAL_REDS.length],
      op: 0.6 + Math.random() * 0.4,
    })),
  )
  return (
    <div className="petals-decor" aria-hidden>
      {petals.map((p, i) => (
        <span
          key={i}
          className="petal"
          style={{
            left: `${p.left}%`,
            width: `${p.size}vh`,
            height: `${p.size * 1.4}vh`,
            // Fallback ; `petalFall` pilote position ET couleur (blanc en haut → rouge en bas).
            backgroundColor: p.color,
            opacity: p.op,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            '--red': p.color,
            '--sx': `${p.sx}vw`,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

/** Décor « water » : une mer de nuit — des reflets de lune (traînées horizontales claires)
 *  ondulent (va-et-vient lent) et scintillent (opacité) sur l'eau, dans le bas de l'écran.
 *  Reflets tirés une fois au montage, animations en CSS (cf. `index.css`). (Capitaine Crochet) */
function WaterDecor() {
  const [glints] = useState(() =>
    Array.from({ length: 46 }, () => ({
      left: Math.random() * 55, // % (concentrés à gauche)
      top: 68 + Math.random() * 20, // % (surface de l'eau)
      w: 1.2 + Math.random() * 3.5, // vh (minuscules traînées)
      h: 0.25 + Math.random() * 0.45, // vh (très fine)
      op: 0.18 + Math.random() * 0.3,
      sway: 2 + Math.random() * 4, // vw (ondulation latérale)
      swayDur: 4 + Math.random() * 4, // s
      shimDur: 2.2 + Math.random() * 2.6, // s (scintillement)
      delay: -(Math.random() * 8), // s
    })),
  )
  // Nuages : nappes pâles floues qui dérivent lentement en haut du ciel.
  const [clouds] = useState(() =>
    Array.from({ length: 13 }, () => ({
      left: Math.random() * 100, // %
      top: 2 + Math.random() * 38, // % (haut/milieu du ciel)
      w: 42 + Math.random() * 46, // vh (larges)
      h: 10 + Math.random() * 12, // vh (aplatis)
      op: 0.12 + Math.random() * 0.16,
      amp: 6 + Math.random() * 12, // vw (dérive latérale)
      dur: 22 + Math.random() * 20, // s (lent)
      delay: -(Math.random() * 40), // s
    })),
  )
  return (
    <div className="water-decor" aria-hidden>
      {/* Nuages en haut. */}
      {clouds.map((c, i) => (
        <span
          key={`cloud-${i}`}
          className="water-cloud"
          style={{
            left: `${c.left}%`,
            top: `${c.top}%`,
            width: `${c.w}vh`,
            height: `${c.h}vh`,
            opacity: c.op,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
            '--amp': `${c.amp}vw`,
          } as CSSProperties}
        />
      ))}
      {/* Île de Neverland au loin, en bas à gauche. */}
      <div className="water-island" />
      {glints.map((g, i) => (
        <span
          key={i}
          className="water-glint"
          style={{
            left: `${g.left}%`,
            top: `${g.top}%`,
            width: `${g.w}vh`,
            height: `${g.h}vh`,
            animationDuration: `${g.swayDur}s, ${g.shimDur}s`,
            animationDelay: `${g.delay}s, ${g.delay}s`,
            '--sway': `${g.sway}vw`,
            '--op': g.op,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

/** Décor permanent d'arrière-plan d'un vilain (rien si aucun décor défini). */
export function VillainDecor({ villain }: { villain: VillainKey }) {
  const decor = villainDecor(villain)
  if (!decor) return null
  switch (decor.kind) {
    case 'film':
      return <FilmDecor />
    case 'sand':
      return <SandDecor />
    case 'space':
      return <SpaceDecor />
    case 'fire':
      return <FireDecor decor={decor} />
    case 'goldenHair':
      return <GoldenHairDecor />
    case 'video':
      return <VideoDecor decor={decor} />
    case 'goldDust':
      return <GoldDustDecor />
    case 'thorns':
      return <ThornsDecor />
    case 'forest':
      return <ForestDecor />
    case 'petals':
      return <PetalsDecor />
    case 'water':
      return <WaterDecor />
    default:
      return null
  }
}

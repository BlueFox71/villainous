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

/** Décor « Enfers » (Hadès) : mur de feu BLEU (mêmes flammes que `fire`) + âmes spectrales
 *  qui montent du Styx + braises bleues + lueur bleue pulsante. Par moments un COUP DE COLÈRE
 *  (classe `is-angry`) : le feu vire au rouge/orange et grossit, un voile de rage rougeoie.
 *  Éléments tirés une fois au montage ; colère pilotée par un timer (cf. `index.css`). */
function UnderworldDecor() {
  const base = 32
  const [flames] = useState(() => {
    const n = 48 + Math.floor(Math.random() * 17)
    const slot = 100 / n
    return Array.from({ length: n }, (_, i) => ({
      left: (i / (n - 1)) * 100 + (Math.random() - 0.5) * slot * 0.5,
      size: base * (0.55 + Math.random() * 0.95),
      loop: 2.3 + Math.random() * 1.1,
      delay: -(Math.random() * 3),
      flip: Math.random() < 0.5,
      op: 0.8 + Math.random() * 0.2,
    }))
  })
  // Âmes spectrales : silhouettes (images homme/femme) teintées vert-gris, qui montent du
  // fond en dérivant et en se dissipant.
  const [souls] = useState(() =>
    Array.from({ length: 9 }, () => {
      const h = 16 + Math.random() * 16 // vh
      const AMES = ['/animations/ame_homme.png', '/animations/ame_femme.png', '/animations/ame_homme2.png']
      return {
        img: AMES[Math.floor(Math.random() * AMES.length)],
        left: Math.random() * 100,
        w: h * 0.55, // vh (≈ ratio d'une silhouette ; contain garde la proportion)
        h,
        dur: 9 + Math.random() * 7, // s (montée lente)
        delay: -(Math.random() * 16),
        drift: (Math.random() - 0.5) * 10, // vw
        op: 0.25 + Math.random() * 0.3,
        flip: Math.random() < 0.5 ? -1 : 1, // miroir horizontal aléatoire
      }
    }),
  )
  // Braises bleues : étincelles qui montent du feu en scintillant.
  const [embers] = useState(() =>
    Array.from({ length: 22 }, () => ({
      left: Math.random() * 100,
      size: 1.4 + Math.random() * 2.4, // px
      dur: 4 + Math.random() * 4, // s
      delay: -(Math.random() * 8),
      drift: (Math.random() - 0.5) * 7, // vw
      op: 0.5 + Math.random() * 0.4,
    })),
  )
  // Coup de colère : à intervalle aléatoire, le feu s'embrase en rouge ~3–4 s.
  const [angry, setAngry] = useState(false)
  useEffect(() => {
    let rage: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const schedule = () => {
      next = setTimeout(() => {
        setAngry(true)
        rage = setTimeout(() => {
          setAngry(false)
          schedule()
        }, 3000 + Math.random() * 1800) // colère 3–4,8 s
      }, 16000 + Math.random() * 20000) // 16–36 s entre deux colères
    }
    schedule()
    return () => {
      clearTimeout(next)
      clearTimeout(rage)
    }
  }, [])
  return (
    <div className={`underworld-decor${angry ? ' is-angry' : ''}`} aria-hidden>
      {/* Lueur bleue pulsante au-dessus du feu. */}
      <div className="uw-glow" />
      {/* Voile de rage (rougeoie pendant la colère). */}
      <div className="uw-rage" />
      {/* Âmes spectrales (derrière les flammes). */}
      {souls.map((s, i) => (
        <span
          key={`soul-${i}`}
          className="uw-soul"
          style={{
            left: `${s.left}%`,
            width: `${s.w}vh`,
            height: `${s.h}vh`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            '--drift': `${s.drift}vw`,
            '--op': s.op,
            '--soul-img': `url(${s.img})`,
            '--flip': s.flip,
          } as CSSProperties}
        />
      ))}
      {/* Base bleue lumineuse au sol (comble le vide sous/entre les flammes). */}
      <div className="uw-base" />
      {/* Mur de feu bleu (la teinte est pilotée par `.uw-fire`, retintée en colère). */}
      <div className="uw-fire">
        {flames.map((f, i) => (
          <div
            key={i}
            className="fire-flame"
            style={{
              left: `${f.left}%`,
              height: `${f.size}vh`,
              width: `${f.size * FLAME_ASPECT}vh`,
              opacity: f.op,
              backgroundImage: 'url(/animations/fire_sprite.png)',
              animationDuration: `${f.loop}s`,
              animationDelay: `${f.delay}s`,
              transform: f.flip ? 'translateX(-50%) scaleX(-1)' : 'translateX(-50%)',
              '--frames': 39,
              '--fh': `${f.size}vh`,
            } as CSSProperties}
          />
        ))}
      </div>
      {/* Braises bleues (devant les flammes). */}
      {embers.map((e, i) => (
        <span
          key={`ember-${i}`}
          className="uw-ember"
          style={{
            left: `${e.left}%`,
            width: `${e.size}px`,
            height: `${e.size}px`,
            animationDuration: `${e.dur}s`,
            animationDelay: `${e.delay}s`,
            '--drift': `${e.drift}vw`,
            '--op': e.op,
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
function WaterDecor({ side }: { side?: 'left' | 'right' }) {
  // Houle douce : larges traînées diffuses qui ondulent lentement sur l'eau.
  const [swells] = useState(() =>
    Array.from({ length: 7 }, () => ({
      left: Math.random() * 100, // %
      top: 70 + Math.random() * 24, // % (surface de l'eau)
      w: 40 + Math.random() * 45, // vh (larges)
      h: 2 + Math.random() * 4, // vh (douces)
      op: 0.06 + Math.random() * 0.1, // très diffuses
      sway: 3 + Math.random() * 5, // vw
      swayDur: 8 + Math.random() * 6, // s (lent)
      shimDur: 5 + Math.random() * 4, // s
      delay: -(Math.random() * 12), // s
    })),
  )
  // Poussière de fée (Clochette) : étincelles dorées qui flottent et scintillent dans le ciel.
  const [pixie] = useState(() =>
    Array.from({ length: 28 }, () => ({
      left: Math.random() * 100, // %
      top: 4 + Math.random() * 70, // % (surtout le ciel)
      size: 2 + Math.random() * 3.5, // px
      op: 0.5 + Math.random() * 0.5,
      fx: 1 + Math.random() * 3, // vw (dérive)
      fy: 1 + Math.random() * 3, // vh
      floatDur: 5 + Math.random() * 6, // s
      twkDur: 1.4 + Math.random() * 2, // s (scintillement)
      delay: -(Math.random() * 10), // s
    })),
  )
  // Nuages : nappes pâles floues qui dérivent lentement en haut du ciel.
  const [clouds] = useState(() =>
    Array.from({ length: 13 }, () => ({
      left: Math.random() * 100, // %
      top: 2 + Math.random() * 38, // % (haut/milieu du ciel)
      w: 42 + Math.random() * 46, // vh (larges)
      h: 11 + Math.random() * 13, // vh (aplatis)
      op: 0.26 + Math.random() * 0.24, // plus prononcés
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
      {/* Île de Neverland au loin. Colonne joueur (gauche, qui déborde de -10% vers la gauche) :
          on décale l'île vers la droite pour qu'elle ne parte pas hors champ. */}
      <div className="water-island" style={side === 'left' ? { left: '10%' } : undefined} />
      {/* Houle douce sur l'eau. */}
      {swells.map((g, i) => (
        <span
          key={`swell-${i}`}
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
      {/* Poussière de fée dans le ciel. */}
      {pixie.map((p, i) => (
        <span
          key={`pixie-${i}`}
          className="water-pixie"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.floatDur}s, ${p.twkDur}s`,
            animationDelay: `${p.delay}s, ${p.delay}s`,
            '--fx': `${p.fx}vw`,
            '--fy': `${p.fy}vh`,
            '--op': p.op,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

// Réseau de caustiques : SVG `feTurbulence` (type « turbulence ») dont la matrice de couleur
// transforme le bruit en un voile de fines lignes vert-bleu (l'alpha suit un seuil sur la somme
// RVB → lignes lumineuses là où le bruit est fort). Auto-contenu (data-URI), comme le grain de
// pellicule. Tuilable (stitchTiles). Deux fréquences → deux calques superposés. Discret dans la
// grotte (l'élément central est la vapeur rose).
const CAUSTIC_URL = (freq: string, seed: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='turbulence' baseFrequency='${freq}' numOctaves='2' seed='${seed}' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.42 0 0 0 0 0.85 0 0 0 0 0.78 1.7 1.7 1.7 0 -1.9'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E")`

// Bulles de la grotte : surtout BLEUES/transparentes (l'aspect « vraie bulle ») pour CONTRASTER
// avec la vapeur rose — sans quoi on confond les deux. Une rose de temps en temps pour le lien
// avec la scène. Tableau pondéré dans lequel on tire au hasard.
const GROTTO_BUBBLES = [
  '/animations/bulle-bleu.png', '/animations/bulle-bleu.png',
  '/animations/bulle.png', '/animations/bulle.png',
  '/animations/bulle-rose.png',
]

/** Décor « grotte d'Ursula » : eau vert-bleu très sombre, fortement vignettée. Des colonnes de
 *  VAPEUR ROSE/magenta montent du fond en s'enroulant et en grossissant (les évents de la grotte),
 *  une lueur rosée pulse par en-dessous, de discrètes caustiques teintées scintillent en haut, et
 *  des bulles (surtout roses) montent du fond. Vapeur/bulles tirées une fois au montage, animations
 *  jouées en CSS (cf. `index.css`, section « grotte d'Ursula »). */
function GrottoDecor() {
  // Colonnes de vapeur : quelques ÉVENTS au fond (position/taille de base) émettent chacun
  // plusieurs bouffées étagées dans le temps → colonne continue qui s'enroule en montant.
  const [puffs] = useState(() => {
    const vents = Array.from({ length: 4 }, () => ({
      left: 8 + Math.random() * 80, // % (réparti sur la largeur)
      base: 16 + Math.random() * 14, // vh (taille de base des bouffées de cet évent)
    }))
    return vents.flatMap((v, vi) => {
      const n = 6 + Math.floor(Math.random() * 3) // 6–8 bouffées par évent
      const dur = 11 + Math.random() * 6 // s (montée lente, commune à l'évent → cadence régulière)
      return Array.from({ length: n }, (_, i) => ({
        key: `${vi}-${i}`,
        left: v.left + (Math.random() - 0.5) * 6, // % (léger éparpillement)
        size: v.base * (0.7 + Math.random() * 0.7), // vh
        dur,
        delay: -((i / n) * dur) - Math.random() * 1.5, // s (étagées → flux continu)
        sx: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5), // vw (enroulement latéral)
        op: 0.4 + Math.random() * 0.32, // opacité de pointe (relevée : vapeur plus présente)
      }))
    })
  })
  // Bulles éparses qui montent du fond (réutilise `.bubble-rise`/`.bubble-sway` d'Ursula).
  const [bubbles] = useState(() =>
    Array.from({ length: 22 }, () => ({
      img: GROTTO_BUBBLES[Math.floor(Math.random() * GROTTO_BUBBLES.length)],
      left: Math.random() * 100, // %
      size: 1.8 + Math.random() * 3.6, // vh (bulles de tailles variées)
      dur: 16 + Math.random() * 14, // s (montée lente, 16–30 s)
      delay: -(Math.random() * 30), // s (flux continu, déphasé)
      sway: 1.5 + Math.random() * 3, // vw (amplitude d'ondulation)
      swayDur: 2.6 + Math.random() * 2.4, // s (période d'ondulation)
      op: 0.75 + Math.random() * 0.25, // opacité de pointe (PNG très transparents → on pousse)
    })),
  )
  // Filées de bulles : 2–3 points fixes d'où monte un FLOT continu de bulles (étagées dans le
  // temps comme les évents de vapeur, ondulation serrée → elles restent grosso modo en colonne).
  const [streams] = useState(() => {
    const cols = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
      left: 12 + Math.random() * 76, // % (point d'émission)
    }))
    return cols.flatMap((c, ci) => {
      const n = 8 + Math.floor(Math.random() * 3) // 8–10 bulles dans la filée
      const dur = 15 + Math.random() * 7 // s (cadence régulière de la filée, montée lente)
      return Array.from({ length: n }, (_, i) => ({
        key: `${ci}-${i}`,
        img: GROTTO_BUBBLES[Math.floor(Math.random() * GROTTO_BUBBLES.length)],
        left: c.left + (Math.random() - 0.5) * 2.5, // % (resserré autour du point)
        size: 1.4 + Math.random() * 2, // vh (bulles plutôt petites)
        dur,
        delay: -((i / n) * dur) - Math.random() * 0.6, // s (étagées → flot continu)
        sway: 0.8 + Math.random() * 1.4, // vw (ondulation serrée → reste en colonne)
        swayDur: 2.2 + Math.random() * 1.8, // s
        op: 0.8 + Math.random() * 0.2, // opacité de pointe (PNG très transparents → on pousse)
      }))
    })
  })
  // Taches d'encre (fixées au montage) : gouttes noires réparties qui, lors de l'invasion,
  // jaillissent (scale 0 → géant) en se chevauchant pour noyer toute la colonne, puis se
  // dissipent. Délais étagés → l'encre « gicle » en plusieurs jets successifs.
  const [inkBlobs] = useState(() => {
    // Border-radius organique (8 valeurs → ellipse irrégulière) : casse le cercle parfait pour
    // un contour de fumée. Tiré une fois par giclée.
    const br = () => {
      const r = () => `${42 + Math.random() * 16}%`
      return `${r()} ${r()} ${r()} ${r()} / ${r()} ${r()} ${r()} ${r()}`
    }
    // UN SEUL foyer (plutôt bas/centre, comme si l'encre jaillissait d'Ursula) : toutes les
    // giclées partent groupées de là, puis s'étalent VERS L'EXTÉRIEUR pour envahir → un seul
    // point de départ logique, pas plusieurs.
    const ox = 38 + Math.random() * 24 // % (foyer horizontal)
    const oy = 62 + Math.random() * 22 // % (foyer plutôt bas)
    return Array.from({ length: 8 }, () => {
      // Décalage initial serré autour du foyer + direction d'expansion radiale (vers l'extérieur).
      const ang = Math.random() * Math.PI * 2
      const spread = Math.random() * 9 // % (rayon du petit amas de départ)
      return {
        left: ox + Math.cos(ang) * spread, // % (groupées près du foyer)
        top: oy + Math.sin(ang) * spread, // %
        size: 52 + Math.random() * 46, // vh (grosses : un seul amas doit couvrir en s'étalant)
        delay: Math.random() * 4.5, // s (jets successifs, bien étalés)
        br: br(), // forme irrégulière propre à chaque giclée
        // Dérive dans la direction radiale → l'encre s'épanouit depuis le foyer.
        dx: Math.cos(ang) * (24 + Math.random() * 22), // vh
        dy: Math.sin(ang) * (24 + Math.random() * 22), // vh
        rot: (Math.random() - 0.5) * 90, // deg (rotation → l'encre s'enroule)
      }
    })
  })
  // Événement surprise : à intervalle aléatoire, le nuage d'encre d'Ursula envahit tout
  // l'arrière-plan puis se dissipe. On (dé)monte le calque d'encre le temps de l'animation.
  const [inking, setInking] = useState(false)
  useEffect(() => {
    // Pas d'effet « flash » si l'utilisateur a demandé moins d'animations.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const INK_MS = 19500 // durée totale (giclée la plus tardive ≈ 4,5 s + animation 14 s + marge)
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        setInking(true)
        clear = setTimeout(() => {
          setInking(false)
          schedule(120000 + Math.random() * 120000) // 2 min → 4 min avant la prochaine
        }, INK_MS)
      }, delay)
    }
    schedule(70000 + Math.random() * 40000) // première invasion entre 1 min 10 et 1 min 50
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className="grotto-decor" aria-hidden>
      {/* Caustiques discrètes (sens et vitesses opposés → scintillement), tout en haut. */}
      <div className="caustic-web caustic-web--a" style={{ backgroundImage: CAUSTIC_URL('0.011 0.016', 4) }} />
      <div className="caustic-web caustic-web--b" style={{ backgroundImage: CAUSTIC_URL('0.016 0.022', 9) }} />
      {/* Lueur rosée des évents, par en-dessous (pulse lentement). */}
      <div className="grotto-glow" />
      {/* Colonnes de vapeur rose qui montent en s'enroulant et en grossissant. */}
      {puffs.map((p) => (
        <span
          key={`puff-${p.key}`}
          className="grotto-vapor"
          style={{
            left: `${p.left}%`,
            width: `${p.size}vh`,
            height: `${p.size}vh`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            '--sx': `${p.sx}vw`,
            '--vop': p.op,
          } as CSSProperties}
        />
      ))}
      {/* Bulles montantes (surtout roses). */}
      {bubbles.map((b, i) => (
        <span
          key={`bub-${i}`}
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
              animationDelay: `${b.delay}s`,
              '--bubble-sway': `${b.sway}vw`,
            } as CSSProperties}
          />
        </span>
      ))}
      {/* Filées de bulles : 2–3 flots continus montant de points fixes. */}
      {streams.map((b) => (
        <span
          key={`stream-${b.key}`}
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
              animationDelay: `${b.delay}s`,
              '--bubble-sway': `${b.sway}vw`,
            } as CSSProperties}
          />
        </span>
      ))}
      {/* Vignette : coins très sombres (la grotte est plongée dans l'obscurité). */}
      <div className="grotto-vignette" />
      {/* Événement surprise : le nuage d'encre d'Ursula envahit tout l'arrière-plan puis se
          dissipe (monté seulement pendant l'invasion → l'animation joue une fois). */}
      {inking && (
        <div className="grotto-ink">
          {/* Voile noir de fond (comble les éventuels interstices entre les giclées). */}
          <div className="ink-veil" />
          {inkBlobs.map((b, i) => (
            <span
              key={`ink-${i}`}
              className="ink-blob"
              style={{
                left: `${b.left}%`,
                top: `${b.top}%`,
                width: `${b.size}vh`,
                height: `${b.size}vh`,
                borderRadius: b.br,
                animationDelay: `${b.delay}s`,
                '--dx': `${b.dx}vh`,
                '--dy': `${b.dy}vh`,
                '--rot': `${b.rot}deg`,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Facteur d'échelle appliqué à toutes les tailles de masques (réglage d'un seul chiffre).
const VOODOO_MASK_SCALE = 0.4
// Décalage vertical (% de la hauteur d'écran) ajouté à tous les masques (descend l'ensemble).
const VOODOO_MASK_TOP_OFFSET = 8

// Disposition VALIDÉE par l'utilisateur : 10 masques répartis dans les DEUX bandes VISIBLES autour
// du plateau — une bande HAUTE (top ~0–4 %) et une bande BASSE (top ~52–57 %), le plateau opaque
// occupant le milieu. Positions/tailles figées (curées à la main) plutôt qu'aléatoires, pour
// garantir que tous les masques restent visibles. `depth` ne sert qu'au z-index (×100).
const VOODOO_MASK_LAYOUT = [
  { img: 6, left: 24.27, top: -0.5, depth: 0.75, size: 24.93, blur: 0.61, br: 1.15, bob: 3.32, bobDur: 6.94, bobDelay: -9.19, rot: 5.18, breDur: 11.71, breDelay: -3.15, opLo: 0.56, opHi: 0.85, flip: -1 },
  { img: 4, left: 16.8, top: 56.69, depth: 0.86, size: 26.71, blur: 0.34, br: 1.19, bob: 2.22, bobDur: 9.01, bobDelay: -1.47, rot: 2.43, breDur: 11.54, breDelay: -13.31, opLo: 0.56, opHi: 0.91, flip: -1 },
  { img: 10, left: 68.54, top: 0.6, depth: 0.53, size: 21.41, blur: 1.14, br: 1.06, bob: 4.59, bobDur: 7.82, bobDelay: -4.95, rot: 1.94, breDur: 7.82, breDelay: -6.33, opLo: 0.5, opHi: 0.79, flip: 1 },
  { img: 2, left: 38.62, top: 52.88, depth: 0.96, size: 28.3, blur: 0.11, br: 1.23, bob: 3.87, bobDur: 8.76, bobDelay: -7.53, rot: 5.34, breDur: 9.46, breDelay: -0.44, opLo: 0.67, opHi: 0.97, flip: 1 },
  { img: 7, left: 37.49, top: 0.67, depth: 0.88, size: 27.15, blur: 0.28, br: 1.2, bob: 4.83, bobDur: 8.47, bobDelay: -7.12, rot: 3.73, breDur: 9.94, breDelay: -1.17, opLo: 0.52, opHi: 0.9, flip: -1 },
  { img: 3, left: 68.29, top: 56.28, depth: 0.93, size: 27.87, blur: 0.17, br: 1.22, bob: 2.9, bobDur: 5.82, bobDelay: -3.43, rot: 4.87, breDur: 8.57, breDelay: -1.09, opLo: 0.55, opHi: 0.84, flip: 1 },
  { img: 9, left: 78.9, top: 1.35, depth: 0.97, size: 28.49, blur: 0.08, br: 1.24, bob: 3.09, bobDur: 7.21, bobDelay: -8.97, rot: 3.18, breDur: 10.26, breDelay: -3.09, opLo: 0.58, opHi: 0.84, flip: -1 },
  { img: 5, left: 52.06, top: 0.67, depth: 0.65, size: 23.45, blur: 0.83, br: 1.11, bob: 3.67, bobDur: 8.81, bobDelay: -3.71, rot: 2.84, breDur: 10.86, breDelay: -9.82, opLo: 0.51, opHi: 0.92, flip: 1 },
  { img: 1, left: 55.18, top: 56.03, depth: 0.99, size: 28.8, blur: 0.03, br: 1.25, bob: 3.64, bobDur: 5.57, bobDelay: -0.06, rot: 5.11, breDur: 13.47, breDelay: -3.91, opLo: 0.6, opHi: 0.99, flip: 1 },
  { img: 8, left: 93, top: 3.68, depth: 0.46, size: 20.3, blur: 1.3, br: 1.03, bob: 2.84, bobDur: 7.05, bobDelay: -7.52, rot: 3.47, breDur: 8.52, breDelay: -4.42, opLo: 0.6, opHi: 0.93, flip: -1 },
].map((m) => ({
  ...m,
  size: m.size * VOODOO_MASK_SCALE,
  top: m.top + VOODOO_MASK_TOP_OFFSET,
}))

// Les 11 images de masques : l'image affichée à chaque emplacement est tirée au hasard au montage
// (les positions/tailles, elles, restent figées — cf. VOODOO_MASK_LAYOUT).
const VOODOO_MASKS = Array.from({ length: 11 }, (_, i) => `/animations/masque${i + 1}.png`)

// Couleurs de la magie vaudou : violet/magenta et vert toxique (la lumière de l'au-delà).
const VOODOO_MOTE_COLORS = ['#d11ad1', '#b026ff', '#5ee84b', '#7CFC00', '#e040fb']

/** Décor « vaudou » (Dr Facilier) : des masques tribaux flottent dans une pénombre violacée
 *  (« Friends on the Other Side ») — chacun est bercé (translation verticale) et RESPIRE en
 *  opacité (il émerge de l'ombre puis s'y fond) avec une légère rotation, à des profondeurs
 *  variées (taille/flou/luminosité). Des particules de magie violette/verte montent en
 *  scintillant. Par moments, une INVOCATION (classe `is-summoning`) : les masques s'illuminent
 *  (luminosité + halo) et une vague de magie déferle. Éléments tirés une fois au montage,
 *  animations jouées en CSS (cf. `index.css`, section « masques vaudou »). */
function VoodooDecor() {
  // Masques : positions/tailles figées validées (deux bandes visibles, cf. VOODOO_MASK_LAYOUT) ;
  // l'IMAGE de chaque emplacement est tirée au hasard au montage (11 masques mélangés). Chacun se
  // berce (translation verticale) et « respire » en opacité (émerge de l'ombre puis s'y fond) avec
  // une légère oscillation, le tout déphasé.
  const [masks] = useState(() => {
    const imgs = [...VOODOO_MASKS].sort(() => Math.random() - 0.5)
    return VOODOO_MASK_LAYOUT.map((m, i) => ({ ...m, img: imgs[i % imgs.length] }))
  })
  // Particules de magie : montent du bas en ondulant et en scintillant, violettes ou vertes.
  const [motes] = useState(() =>
    Array.from({ length: 34 }, (_, i) => ({
      left: Math.random() * 100, // %
      size: 1.6 + Math.random() * 3, // px
      dur: 8 + Math.random() * 8, // s (montée lente)
      delay: -(Math.random() * 16), // s
      sway: 2 + Math.random() * 5, // vw (ondulation latérale)
      swayDur: 3 + Math.random() * 3, // s
      twkDur: 1.3 + Math.random() * 1.8, // s (scintillement)
      twkDelay: -(Math.random() * 3), // s
      op: 0.4 + Math.random() * 0.5,
      color: VOODOO_MOTE_COLORS[i % VOODOO_MOTE_COLORS.length],
    })),
  )
  // Invocation « amis de l'au-delà » : à intervalle aléatoire, les masques s'illuminent et une
  // vague de magie déferle ~5 s, puis tout retombe dans la pénombre. On reprogramme ensuite.
  const [summoning, setSummoning] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const SUMMON_MS = 5200 // durée de l'invocation (cf. .voodoo-summon / transitions)
    let end: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        setSummoning(true)
        end = setTimeout(() => {
          setSummoning(false)
          schedule(95000 + Math.random() * 75000) // 1 min 35 → 2 min 50 avant la prochaine
        }, SUMMON_MS)
      }, delay)
    }
    schedule(55000 + Math.random() * 35000) // première invocation entre 55 s et 1 min 30
    return () => {
      clearTimeout(next)
      clearTimeout(end)
    }
  }, [])
  return (
    <div className={`voodoo-decor${summoning ? ' is-summoning' : ''}`} aria-hidden>
      {/* Lueur de magie qui pulse par en-dessous (renforcée pendant l'invocation). */}
      <div className="voodoo-glow" />
      {/* Masques flottants : enveloppe = bercement vertical ; image = respiration + rotation. */}
      {masks.map((m, i) => (
        <span
          key={i}
          className="voodoo-mask-bob"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            zIndex: Math.round(m.depth * 100),
            animationDuration: `${m.bobDur}s`,
            animationDelay: `${m.bobDelay}s`,
            '--bob': `${m.bob}vh`,
          } as CSSProperties}
        >
          <img
            src={m.img}
            alt=""
            className="voodoo-mask"
            draggable={false}
            style={{
              height: `${m.size}vh`,
              animationDuration: `${m.breDur}s`,
              animationDelay: `${m.breDelay}s`,
              '--flip': m.flip,
              '--blur': `${m.blur}px`,
              '--br': m.br,
              '--rot': `${m.rot}deg`,
              '--op-lo': m.opLo,
              '--op-hi': m.opHi,
            } as CSSProperties}
          />
        </span>
      ))}
      {/* Particules de magie violette/verte qui montent en ondulant et en scintillant. */}
      {motes.map((m, i) => (
        <span
          key={`mote-${i}`}
          className="voodoo-mote-rise"
          style={{
            left: `${m.left}%`,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
          }}
        >
          <span
            className="voodoo-mote-sway"
            style={{
              animationDuration: `${m.swayDur}s`,
              animationDelay: `${m.delay}s`,
              '--sway': `${m.sway}vw`,
            } as CSSProperties}
          >
            <span
              className="voodoo-mote"
              style={{
                width: `${m.size}px`,
                height: `${m.size}px`,
                opacity: m.op,
                background: m.color,
                animationDuration: `${m.twkDur}s`,
                animationDelay: `${m.twkDelay}s`,
                '--mote-color': m.color,
              } as CSSProperties}
            />
          </span>
        </span>
      ))}
      {/* Vague de magie de l'invocation (radiale, déferle pendant `is-summoning`). */}
      <div className="voodoo-summon" />
      {/* Vignette violacée (la pénombre de l'échoppe). */}
      <div className="voodoo-vignette" />
    </div>
  )
}

// Les mondes flottants de la galaxie de Bowser (Super Mario Galaxy) qui défilent à l'écran.
// `GALAXY_WORLD_COUNT` = nombre d'images `galaxy<N>.png` dans public/animations/ (à incrémenter si
// l'utilisateur en ajoute).
const GALAXY_WORLD_COUNT = 37
const GALAXY_WORLDS = Array.from({ length: GALAXY_WORLD_COUNT }, (_, i) => `/animations/galaxy${i + 1}.png`)
// Bande verticale (% de la hauteur d'écran) où les mondes défilent : limitée au HAUT, pour éviter
// le bas de l'écran et la zone du plateau (où ça passerait derrière l'UI). Ajustable.
const GALAXY_WORLD_TOP_MIN = 0
const GALAXY_WORLD_TOP_MAX = 11
// Averses SURPRISES de Bowser : ~100 objets traversent l'écran (comme les mondes mais en masse).
// Deux variantes : pluie d'ÉTOILES (`star.png`) ou pluie de FRAGMENTS (6 images tirées au hasard).
const STAR_SHOWER_COUNT = 100
const FRAGMENT_IMAGES = Array.from({ length: 6 }, (_, i) => `/animations/fragment${i + 1}.png`)
// Surprises de Bowser : averse de fragments ou averse d'étoiles. En mode NORMAL, elles défilent
// dans cet ordre (cycle), une toutes les 3 min.
type SurpriseKind = 'fragments' | 'stars'
const SURPRISE_ORDER: SurpriseKind[] = ['fragments', 'fragments', 'stars']
// MODE TEST : à `true`, on n'affiche QUE les surprises (mondes désactivés, surprises fréquentes)
// pour les régler ; remettre à `false` pour rétablir le défilement des mondes (surprises rares).
const GALAXY_TEST_SHOWER_ONLY = false
// En mode test, quelle surprise montrer : 'alternate' (étoiles/fragments), 'stars' ou 'fragments'.
const GALAXY_TEST_SHOWER_KIND: 'alternate' | 'stars' | 'fragments' = 'fragments'

/** Décor « galaxie de Bowser » (Super Mario Galaxy) : un espace BLEU profond — champ d'étoiles
 *  scintillantes + nébuleuses bleues qui dérivent. Les MONDES flottants (images `galaxy*`) défilent
 *  lentement en travers de l'écran (parallaxe + rotation lente sur eux-mêmes). Un TROU NOIR tourne
 *  et ASPIRE des particules qui spiralent vers son centre. L'OBSERVATOIRE s'épuise : sa luminosité
 *  décline puis revient en boucle (comme s'il perdait son énergie). Éléments tirés une fois au
 *  montage, animations en CSS (cf. index.css, section « galaxie de Bowser »). */
function GalaxyDecor() {
  // Préchargement des images d'averse (étoile + 6 fragments) au montage : sinon, au 1ᵉʳ
  // déclenchement, les images jamais affichées se décodent en direct et « popent » à l'écran.
  useEffect(() => {
    for (const src of ['/animations/star.png', ...FRAGMENT_IMAGES]) {
      const img = new Image()
      img.src = src
    }
  }, [])
  // Champ d'étoiles : points bleus/blancs qui scintillent (taille/teinte/cadence variées).
  const [stars] = useState(() =>
    Array.from({ length: 960 }, () => {
      const blue = Math.random() < 0.45
      return {
        left: Math.random() * 100, // %
        top: Math.random() * 100, // %
        size: 1 + Math.random() * 2.4, // px
        color: blue ? (Math.random() < 0.5 ? '#7fb3ff' : '#aee0ff') : '#ffffff',
        twkDur: 1.6 + Math.random() * 3, // s
        twkDelay: -(Math.random() * 5), // s
        op: 0.4 + Math.random() * 0.5,
      }
    }),
  )
  // Nébuleuses bleues/indigo/cyan : grandes nappes floues qui dérivent lentement.
  const [nebulae] = useState(() => {
    const TONES = ['40, 90, 220', '30, 150, 220', '90, 60, 200', '20, 110, 180']
    return Array.from({ length: 5 }, (_, i) => ({
      left: Math.random() * 100, // %
      top: Math.random() * 100, // %
      w: 42 + Math.random() * 42, // vh
      h: 30 + Math.random() * 36, // vh
      tone: TONES[i % TONES.length],
      op: 0.16 + Math.random() * 0.16,
      dur: 26 + Math.random() * 22, // s
      delay: -(Math.random() * 40), // s
      amp: 6 + Math.random() * 10, // vw
    }))
  })
  // Objets qui DÉFILENT (les mondes + l'observatoire) : à intervalle régulier (~45 s), un objet
  // apparaît à droite et traverse lentement vers la gauche, petit, puis s'efface hors champ. La
  // plupart du temps un seul à la fois, mais 10 % du temps DEUX apparaissent ensemble. `seq`
  // redémarre l'animation ; `kind` distingue un monde (qui tournoie) de l'observatoire (qui garde
  // son effet « épuisé », sans rotation).
  type Crosser = { seq: number; img: string; kind: 'world' | 'obs'; top: number; size: number; dur: number }
  const [crossers, setCrossers] = useState<Crosser[]>([])
  // Vrai pendant qu'une averse surprise est à l'écran → on saute le défilement d'un monde
  // (l'averse « décale » le prochain monde).
  const showerActiveRef = useRef(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (GALAXY_TEST_SHOWER_ONLY) return // MODE TEST : pas de mondes (on ne montre que l'averse)
    // File d'attente mélangée : les mondes + l'observatoire, parcourus en boucle.
    const ITEMS: { img: string; kind: 'world' | 'obs' }[] = [
      ...GALAXY_WORLDS.map((img) => ({ img, kind: 'world' as const })),
      { img: '/animations/observatory.png', kind: 'obs' as const },
    ].sort(() => Math.random() - 0.5)
    let i = 0
    let seq = 0
    const timers = new Set<ReturnType<typeof setTimeout>>()
    // Fait apparaître un objet et programme son retrait de l'état une fois la traversée finie.
    const spawnOne = () => {
      const item = ITEMS[i % ITEMS.length]
      i++
      const c: Crosser = {
        seq: seq++,
        ...item,
        // Uniquement dans la BANDE HAUTE de l'écran (au-dessus du plateau) : on évite le bas de
        // l'écran et la zone du plateau, où ça passerait derrière l'UI. Bande ajustable ici.
        top: GALAXY_WORLD_TOP_MIN + Math.random() * (GALAXY_WORLD_TOP_MAX - GALAXY_WORLD_TOP_MIN), // %
        size: item.kind === 'obs' ? 8 + Math.random() * 3 : 5 + Math.random() * 4, // vh (petits)
        dur: 44 + Math.random() * 14, // s (longue traversée)
      }
      setCrossers((prev) => [...prev, c])
      const rm = setTimeout(() => {
        setCrossers((prev) => prev.filter((x) => x.seq !== c.seq))
        timers.delete(rm)
      }, c.dur * 1000 + 300)
      timers.add(rm)
    }
    const launch = () => {
      // Pendant une averse surprise, on saute ce monde (l'averse le décale).
      if (!showerActiveRef.current) {
        spawnOne()
        if (Math.random() < 0.1) spawnOne() // 10 % : un deuxième monde en même temps
      }
      const n = setTimeout(launch, 45000) // ~toutes les 45 s
      timers.add(n)
    }
    const first = setTimeout(launch, 3000 + Math.random() * 4000) // premier au bout de 3–7 s
    timers.add(first)
    return () => timers.forEach(clearTimeout)
  }, [])
  // SURPRISES : averse de fragments / d'étoiles (~100 objets qui traversent lentement de droite à
  // gauche en tournoyant). En mode test : fréquentes (type forcé par `GALAXY_TEST_SHOWER_KIND`). En
  // mode normal : rares, dans l'ordre `SURPRISE_ORDER`, et elles décalent le prochain monde.
  type ShowerStar = { img: string; top: number; size: number; dur: number; delay: number; rot: number }
  const [shower, setShower] = useState<{ seq: number; stars: ShowerStar[] } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let seq = 0
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    // Type de surprise pour ce tir : forcé en mode test, sinon cycle `SURPRISE_ORDER`.
    const pickKind = (n: number): SurpriseKind => {
      if (!GALAXY_TEST_SHOWER_ONLY) return SURPRISE_ORDER[n % SURPRISE_ORDER.length]
      if (GALAXY_TEST_SHOWER_KIND === 'alternate') return n % 2 === 1 ? 'fragments' : 'stars'
      return GALAXY_TEST_SHOWER_KIND
    }
    const fire = () => {
      const useFragments = pickKind(seq) === 'fragments'
      showerActiveRef.current = true // pendant la surprise, les mondes sont décalés
      const TOTAL = 22 // s (durée totale visée de l'averse)
      const stars: ShowerStar[] = Array.from({ length: STAR_SHOWER_COUNT }, () => {
        const dur = 15 + Math.random() * 3 // s (traversée ULTRA lente)
        return {
          img: useFragments ? FRAGMENT_IMAGES[Math.floor(Math.random() * FRAGMENT_IMAGES.length)] : '/animations/star.png',
          top: Math.random() * 96, // % (toute la hauteur)
          size: 1.4 + Math.random() * 3, // vh (petits objets)
          dur,
          // Délai POSITIF étalé : chaque objet ENTRE par la droite à un instant différent (arrivée
          // progressive, pas tous ensemble), calé pour finir dans le budget TOTAL.
          delay: Math.random() * (TOTAL - dur), // s
          rot: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540), // tours pendant la traversée
        }
      })
      setShower({ seq: seq++, stars })
      // Durée réelle de l'averse = max(delay + dur) : on démonte APRÈS.
      const lifeMs = Math.max(...stars.map((s) => s.delay + s.dur)) * 1000 + 600
      clear = setTimeout(() => {
        setShower(null)
        showerActiveRef.current = false
      }, lifeMs)
      next = setTimeout(fire, GALAXY_TEST_SHOWER_ONLY ? lifeMs + 2500 : 180000) // test: après la surprise ; normal: toutes les 3 min
    }
    next = setTimeout(fire, GALAXY_TEST_SHOWER_ONLY ? 1500 : 180000) // 1ʳᵉ : test 1,5 s ; normal après 3 min
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  // Trou noir — effet aspirant : des particules SPIRALENT vers le centre (angle/rayon de départ +
  // durée/délai variés → flux continu happé par le trou). Étoiles bleues + matière orangée.
  const [bhMotes] = useState(() =>
    Array.from({ length: 28 }, () => ({
      a: Math.random() * 360, // deg (angle de départ)
      r: 8 + Math.random() * 9, // vh (rayon de départ)
      dur: 2.4 + Math.random() * 2.6, // s (temps de chute vers le centre)
      delay: -(Math.random() * 5), // s (flux continu)
      size: 1.4 + Math.random() * 2.4, // px
      color: Math.random() < 0.5 ? '#aee0ff' : '#ff8a3a',
    })),
  )
  return (
    <div className="galaxy-decor" aria-hidden>
      {/* Nébuleuses bleues qui dérivent. */}
      {nebulae.map((n, i) => (
        <span
          key={`neb-${i}`}
          className="galaxy-nebula"
          style={{
            left: `${n.left}%`,
            top: `${n.top}%`,
            width: `${n.w}vh`,
            height: `${n.h}vh`,
            background: `radial-gradient(ellipse at center, rgba(${n.tone}, ${n.op}) 0%, rgba(${n.tone}, 0) 70%)`,
            animationDuration: `${n.dur}s`,
            animationDelay: `${n.delay}s`,
            '--amp': `${n.amp}vw`,
          } as CSSProperties}
        />
      ))}
      {/* Champ d'étoiles scintillantes, qui dérive TRÈS lentement (calque un peu plus large que
          l'écran pour ne pas laisser de bord vide pendant la dérive). */}
      <div className="galaxy-starfield">
        {stars.map((s, i) => (
          <span
            key={`star-${i}`}
            className="galaxy-star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              background: s.color,
              boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
              opacity: s.op,
              animationDuration: `${s.twkDur}s`,
              animationDelay: `${s.twkDelay}s`,
            }}
          />
        ))}
      </div>
      {/* Objets qui défilent (1, parfois 2) : monde (qui tournoie) ou observatoire (effet « épuisé »). */}
      {crossers.map((c) => (
        <span
          key={c.seq}
          className="galaxy-world"
          style={{ top: `${c.top}%`, animationDuration: `${c.dur}s` }}
        >
          {c.kind === 'obs' ? (
            <img
              src={c.img}
              alt=""
              className="galaxy-observatory"
              draggable={false}
              style={{ height: `${c.size}vh` }}
            />
          ) : (
            <img
              src={c.img}
              alt=""
              className="galaxy-world-img"
              draggable={false}
              style={{ height: `${c.size}vh` }}
            />
          )}
        </span>
      ))}
      {/* Averse SURPRISE (étoiles OU fragments) : ~100 objets traversent de droite à gauche en tournoyant. */}
      {shower?.stars.map((s, i) => (
        <img
          key={`shower-${shower.seq}-${i}`}
          src={s.img}
          alt=""
          className="galaxy-star-shoot"
          draggable={false}
          style={{
            top: `${s.top}%`,
            height: `${s.size}vh`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            '--spin': `${s.rot}deg`,
          } as CSSProperties}
        />
      ))}
      {/* Trou noir : l'image tourne (sens inverse) et des particules sont aspirées vers son centre. */}
      <div className="galaxy-blackhole" style={{ left: '78%', top: '6%', width: '20vh', height: '20vh' }}>
        {bhMotes.map((m, i) => (
          <span
            key={`bh-${i}`}
            className="galaxy-bh-mote"
            style={{
              width: `${m.size}px`,
              height: `${m.size}px`,
              background: m.color,
              boxShadow: `0 0 6px ${m.color}`,
              animationDuration: `${m.dur}s`,
              animationDelay: `${m.delay}s`,
              '--a': `${m.a}deg`,
              '--r': `${m.r}vh`,
            } as CSSProperties}
          />
        ))}
        <img src="/animations/trou_noir.png" alt="" className="galaxy-bh-img" draggable={false} />
      </div>
    </div>
  )
}

/** Décor permanent d'arrière-plan d'un vilain (rien si aucun décor défini). */
export function VillainDecor({ villain, side }: { villain: VillainKey; side?: 'left' | 'right' }) {
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
    case 'underworld':
      return <UnderworldDecor />
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
      return <WaterDecor side={side} />
    case 'grotto':
      return <GrottoDecor />
    case 'voodoo':
      return <VoodooDecor />
    case 'galaxy':
      return <GalaxyDecor />
    default:
      return null
  }
}

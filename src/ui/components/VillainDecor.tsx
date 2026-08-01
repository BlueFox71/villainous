import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import { villainDecor, UNDERWATER_ORB_IMAGES, TITAN_STONES, TITAN_GAUNTLET, type VillainDecor as VillainDecorData } from '../villainDecor'
import type { VillainKey } from '../store/gameStore'
import { onSurprise } from '../surpriseBus'
import { setVillainColorOverride } from '../villainColorState'

// Côté du décor courant (joueur = left, adversaire = right), fourni par le wrapper
// <VillainDecor> pour que chaque décor à surprise puisse s'abonner au bon canal du
// bus de test sans qu'on ait à lui passer `side` en prop.
const DecorSideContext = createContext<'left' | 'right'>('left')

/**
 * MODE TEST — abonne le décor courant au déclencheur de surprise (par côté). Le
 * composant déclare un `fireRef = useRef(...)`, y dépose sa fonction de surprise
 * (`fireRef.current = fire`), et passe le ref ici : il est appelé quand l'outil de
 * test tire la surprise de ce côté.
 */
function useSurpriseSub(fireRef: React.MutableRefObject<() => void>) {
  const side = useContext(DecorSideContext)
  useEffect(() => onSurprise(side, () => fireRef.current()), [side, fireRef])
}

// Grain de pellicule : bruit (feTurbulence) généré par un petit SVG encodé en
// data-URI — auto-contenu, aucun fichier externe. Répété en mosaïque et déplacé en
// CSS pour « grouiller » comme le grain argentique d'un vieux film.
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

// SURPRISE « LA PELLICULE CASSE » (Pat Hibulaire) : l'accident de projection, en trois temps.
// 1) LE CADRE DÉCROCHE — l'image saute et la barre noire d'interimage traverse l'écran de bas en
//    haut, de plus en plus vite (le projecteur a perdu la boucle). 2) LA BRÛLURE — une tache
//    incandescente s'ouvre et MANGE l'image en s'étalant, jusqu'au blanc. 3) ON REMBOBINE —
//    l'amorce défile, le compte à rebours du projecteur balaie son cercle (3-2-1), flash, et la
//    pellicule repart. 100 % CSS, aucun asset. Les bornes ci-dessous doivent rester EN PHASE avec
//    la timeline CSS (keyframes `film*`, index.css).
const FILM_BREAK_TEST = false
const FILM_BREAK_MS = 12_500 // décrochage (3,4 s) + brûlure (3,2 s) + blanc (1 s) + amorce (3,6 s) + reprise (1,9 s)
const FILM_BREAK_GAP_MIN_MS = FILM_BREAK_TEST ? 16_000 : 150_000 // 2 min 30
const FILM_BREAK_GAP_MAX_MS = FILM_BREAK_TEST ? 20_000 : 260_000 // 4 min 20

/** Décor « vieille pellicule » : grain + scintillement + rayures + poussières +
 *  vignette sépia + perforations latérales. Tous les paramètres aléatoires sont
 *  figés une fois au montage (positions/durées/teintes), l'animation est jouée en
 *  CSS (cf. `index.css`, section « Décor permanent : pellicule de cinéma »).
 *  Surprise : « la pellicule casse » (cf. ci-dessus). */
function FilmDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
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
  // SURPRISE : `broken` porte le point d'amorce de la brûlure (elle ne perce jamais au même
  // endroit) + un compteur qui sert de clé React (rejoue les animations). `null` = tout va bien.
  const [broken, setBroken] = useState<{ run: number; x: number; y: number } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      // Le point d'amorce reste dans la BANDE BASSE : le plateau, opaque, masque le centre de la
      // colonne — une brûlure qui perce derrière lui ne se verrait qu'une fois déjà étalée.
      setBroken({ run: ++run, x: 22 + Math.random() * 56, y: 60 + Math.random() * 16 })
      clear = setTimeout(() => setBroken(null), FILM_BREAK_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(FILM_BREAK_GAP_MIN_MS + Math.random() * (FILM_BREAK_GAP_MAX_MS - FILM_BREAK_GAP_MIN_MS))
      }, delay)
    }
    schedule(FILM_BREAK_TEST ? 3000 : 80_000 + Math.random() * 40_000) // 1re casse : 1 min 20 à 2 min
    // MODE TEST : casse la pellicule à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className={`film-decor${broken ? ' is-breaking' : ''}`} aria-hidden>
      {/* LA PELLICULE elle-même : tout ce qui saute et décroche quand elle casse. */}
      <div className="film-world">
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
      {/* SURPRISE « LA PELLICULE CASSE ». */}
      {broken && (
        <div className="film-break" key={broken.run}>
          {/* 1) La barre noire d'INTERIMAGE remonte l'écran, de plus en plus vite. */}
          <span className="film-roll-bar" />
          {/* 2) La BRÛLURE perce l'image et l'étale jusqu'au blanc. */}
          <span className="film-burn" style={{ left: `${broken.x}%`, top: `${broken.y}%` }} />
          <span className="film-white" />
          {/* 3) L'AMORCE et son compte à rebours (cercle + aiguille qui balaie). */}
          <div className="film-leader">
            <span className="film-leader-grain" style={{ backgroundImage: GRAIN_URL }} />
            <span className="film-leader-ring" />
            <span className="film-leader-cross" />
            <span className="film-leader-sweep" />
            {[3, 2, 1].map((n, i) => (
              <span key={n} className="film-leader-num" style={{ animationDelay: `${7.6 + i}s` }}>
                {n}
              </span>
            ))}
          </div>
        </div>
      )}
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

// SURPRISE « LA TEMPÊTE DE SABLE ». Le vent se lève, le sablier ploie sous les bourrasques, puis la
// tempête DÉFERLE : des nappes de sable filent en travers de la colonne, des bourrasques la balaient,
// une dune monte du bas et la visibilité tombe presque à zéro — avant que tout se dégage. 100 % CSS.
// À GARDER en phase avec les keyframes `ss*` (index.css).
const SAND_STORM_TEST = false
const SAND_STORM_MS = 13_000 // le vent se lève (2,5 s) + déferlement (2,5 s) + pic (4 s) + ça se dégage (4 s)
const SAND_STORM_GAP_MIN_MS = SAND_STORM_TEST ? 9000 : 150_000 // 2 min 30
const SAND_STORM_GAP_MAX_MS = SAND_STORM_TEST ? 15_000 : 260_000 // 4 min 20
// Grains EN VOL : de fines traînées qui filent en travers de l'écran (c'est du vent, pas une
// chute). Volontairement COURTES, floues et discrètes — le sable soufflé, c'est la turbulence des
// nappes ci-dessous qui le porte ; ces grains ne sont qu'un détail de premier plan. Trop longs ou
// trop nets, ils se lisent comme des « traits » posés sur l'image.
const SAND_STORM_GRAINS = 90
// Les NAPPES de sable soufflé. Surtout PAS un motif régulier (des bandes se lisent comme des
// rayures géométriques) : on prend la même TURBULENCE SVG que les caustiques de la grotte, ÉTIRÉE
// à l'horizontale (`w` ≫ `h`) → le bruit s'allonge en voiles de sable. Chaque nappe a sa
// fréquence, sa graine, sa taille de tuile et sa vitesse ; le défilement parcourt EXACTEMENT une
// largeur de tuile, donc la boucle est invisible.
const SAND_STORM_NOISE = (freq: string, seed: number, cut: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' seed='${seed}' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.96 0 0 0 0 0.8 0 0 0 0 0.52 1.4 1.4 1.4 0 -${cut}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23s)'/%3E%3C/svg%3E")`
const SAND_STORM_SHEETS = [
  { rot: -6, freq: '0.9 0.9', seed: 3, cut: 1.5, w: 120, h: 30, dur: 1.1, op: 0.5 },
  { rot: -10, freq: '1.4 1.1', seed: 8, cut: 1.68, w: 80, h: 20, dur: 0.75, op: 0.36 },
  { rot: -3, freq: '0.6 0.7', seed: 14, cut: 1.34, w: 170, h: 46, dur: 1.8, op: 0.3 },
]
// Bourrasques : de grosses bouffées floues qui traversent la colonne, décalées dans le temps.
const SAND_STORM_GUSTS = [
  { top: 12, delay: 2.4, dur: 4.6, h: 26 },
  { top: 46, delay: 4.1, dur: 5.2, h: 34 },
  { top: 70, delay: 6.2, dur: 4.2, h: 22 },
]

function SandDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Grains FINS et denses formant un RIDEAU RECTANGULAIRE : répartis uniformément sur
  // une bande verticale centrée et tombant tout droit (aucune dérive) → largeur
  // constante du haut au bas. + quelques grains ÉPARS sur toute la largeur (hors du
  // rideau central), plus lents et plus discrets.
  const BAND = 9 // % de la colonne : largeur du rideau central
  const [grains] = useState(() => [
    // Rideau central, dense.
    ...Array.from({ length: 200 }, (_, i) => ({
      left: 50 + (Math.random() - 0.5) * BAND, // % (réparti sur toute la bande)
      w: 0.7 + Math.random() * 1.3, // px (grain très fin)
      h: (0.7 + Math.random() * 1.3) * (1.6 + Math.random() * 1.8), // px (léger flou de chute)
      dur: 0.8 + Math.random() * 0.8, // s (chute rapide)
      delay: -(Math.random() * 2), // s (flux continu, déphasé)
      op: 0.5 + Math.random() * 0.45, // opacité
      tone: SAND_TONES[i % SAND_TONES.length], // teinte de sable
    })),
    // Grains épars hors du rideau (toute la largeur), un peu plus lents.
    ...Array.from({ length: 30 }, (_, i) => ({
      left: Math.random() * 100, // % (n'importe où dans la colonne)
      w: 0.9 + Math.random() * 1.4, // px (un peu plus gros → visibles)
      h: (0.9 + Math.random() * 1.4) * (1.5 + Math.random() * 1.7), // px
      dur: 1.2 + Math.random() * 1.2, // s (chute plus lente)
      delay: -(Math.random() * 3), // s
      op: 0.6 + Math.random() * 0.35, // bien visibles
      tone: SAND_TONES[i % SAND_TONES.length],
    })),
  ])
  // Grains EN VOL de la tempête : de fines traînées horizontales, longueurs/vitesses/hauteurs
  // variées, qui partent au fil de la séquence (jamais toutes ensemble) et dérivent un peu en
  // montant ou en descendant (`drop`) — le vent n'est pas rectiligne.
  const [stormGrains] = useState(() =>
    Array.from({ length: SAND_STORM_GRAINS }, (_, i) => ({
      top: Math.random() * 104 - 2, // %
      len: 1.2 + Math.random() * 4.5, // vh (courte : un grain qui passe, pas un trait tiré)
      thick: 0.08 + Math.random() * 0.2, // vh
      dur: 0.5 + Math.random() * 1.2, // s (c'est du vent : ça file)
      delay: 1.4 + Math.random() * 8.6, // s (réparti sur toute la tempête)
      drop: (Math.random() - 0.5) * 14, // vh (dérive verticale sur le trajet)
      op: 0.18 + Math.random() * 0.4, // discrète : elle ponctue la nappe, elle ne la dessine pas
      tone: SAND_TONES[i % SAND_TONES.length],
    })),
  )
  // SURPRISE : `storm` porte un compteur qui sert de clé React (rejoue les animations). `null` = le
  // sablier s'écoule normalement.
  const [storm, setStorm] = useState<{ run: number } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setStorm({ run: ++run })
      clear = setTimeout(() => setStorm(null), SAND_STORM_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(SAND_STORM_GAP_MIN_MS + Math.random() * (SAND_STORM_GAP_MAX_MS - SAND_STORM_GAP_MIN_MS))
      }, delay)
    }
    schedule(SAND_STORM_TEST ? 3000 : 70_000 + Math.random() * 45_000) // 1re tempête : 1 min 10 à 1 min 55
    // MODE TEST : lève le vent à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className={`sand-decor${storm ? ' is-storm' : ''}`} aria-hidden>
      {/* LE SABLIER : tout ce qui PLOIE sous le vent et se désature pendant la tempête. */}
      <div className="sand-world">
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
      {/* SURPRISE « LA TEMPÊTE DE SABLE ». */}
      {storm && (
        <div className="sand-storm" key={storm.run}>
          {/* Le voile ocre qui déferle et fait tomber la visibilité. */}
          <span className="ss-veil" />
          {/* Les trois nappes de sable soufflé (turbulence étirée). L'enveloppe porte l'inclinaison
              et le fondu d'entrée/sortie ; l'enfant porte la texture, son opacité propre et son
              défilement — d'exactement une largeur de tuile (`--w`), donc sans raccord visible. */}
          {SAND_STORM_SHEETS.map((s, i) => (
            <span key={`ss-sheet-${i}`} className="ss-sheet" style={{ transform: `rotate(${s.rot}deg)` }}>
              <span
                className="ss-sheet-inner"
                style={
                  {
                    backgroundImage: SAND_STORM_NOISE(s.freq, s.seed, s.cut),
                    backgroundSize: `${s.w}vh ${s.h}vh`,
                    opacity: s.op,
                    animationDuration: `${s.dur}s`,
                    '--w': `${s.w}vh`,
                  } as CSSProperties
                }
              />
            </span>
          ))}
          {/* Les bourrasques : de grosses bouffées floues qui traversent la colonne. */}
          {SAND_STORM_GUSTS.map((g, i) => (
            <span
              key={`ss-gust-${i}`}
              className="ss-gust"
              style={{ top: `${g.top}%`, height: `${g.h}vh`, animationDuration: `${g.dur}s`, animationDelay: `${g.delay}s` }}
            />
          ))}
          {/* Les grains en vol, qui filent en travers de l'écran. */}
          {stormGrains.map((g, i) => (
            <span
              key={`ss-fly-${i}`}
              className="ss-fly"
              style={
                {
                  top: `${g.top}%`,
                  width: `${g.len}vh`,
                  height: `${g.thick}vh`,
                  background: `linear-gradient(to right, rgba(0, 0, 0, 0), ${g.tone})`,
                  opacity: g.op,
                  animationDuration: `${g.dur}s`,
                  animationDelay: `${g.delay}s`,
                  '--drop': `${g.drop}vh`,
                } as CSSProperties
              }
            />
          ))}
          {/* La DUNE que le vent pousse en bas de la colonne, puis qui retombe. */}
          <span className="ss-dune" />
        </div>
      )}
    </div>
  )
}

/** Décor « espace » : un champ d'étoiles (points blancs) défile vers la droite, avec
 *  profondeur — les étoiles proches sont plus grosses, plus rapides et laissent une
 *  traînée → on file dans l'espace comme à travers le hublot d'une fusée. Étoiles
 *  tirées une fois au montage, défilement joué en CSS (cf. `index.css`). */
// SURPRISE « SABOTAGE — FUSION DU RÉACTEUR » (L'Imposteur) : l'alerte rouge s'empare de la colonne.
// Le champ d'étoiles VIRE AU ROUGE (voile `multiply` : les étoiles blanches rougissent sans éclairer
// le noir), une sirène muette pulse, des BANDES DE DANGER hachurées défilent en haut et en bas, et le
// décor TREMBLE de plus en plus fort pendant que le panneau d'alerte égrène son COMPTE À REBOURS (une
// seconde par seconde, en vrai). À zéro : FLASH blanc, puis « SABOTAGE RÉPARÉ » et tout revient à la
// normale. 100 % CSS + texte, aucun asset (keyframes `sab*`, cf. index.css). Les bornes ci-dessous
// doivent rester EN PHASE avec la timeline CSS. Flag de test → cadence rapprochée pour régler.
const SPACE_SABOTAGE_TEST = false
const SPACE_SABOTAGE_START = 8 // secondes affichées au départ du compte à rebours
const SPACE_SABOTAGE_MS = 11_000 // 8 s de décompte + flash + ~3 s de « réparé »
const SPACE_SABOTAGE_GAP_MIN_MS = SPACE_SABOTAGE_TEST ? 6000 : 75_000 // 1 min 15 (c'est une SURPRISE : c'est rare)
const SPACE_SABOTAGE_GAP_MAX_MS = SPACE_SABOTAGE_TEST ? 11_000 : 150_000 // 2 min 30

/** Décor « espace » : champ d'étoiles défilant vers la droite, avec profondeur (les étoiles
 *  proches sont plus grosses, plus rapides et plus brillantes). Étoiles tirées une fois au
 *  montage. SURPRISE : « sabotage — fusion du réacteur » (cf. ci-dessus). */
function SpaceDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // SURPRISE « sabotage » : on monte le calque `.space-sabotage` le temps de la séquence, avec un
  // compteur de passage en clé React → les animations CSS repartent de zéro à chaque déclenchement.
  // Seul le DÉCOMPTE est piloté en JS (un cran par seconde) ; le reste est joué en CSS.
  const [sabRun, setSabRun] = useState<number | null>(null)
  const [count, setCount] = useState(SPACE_SABOTAGE_START)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let tick: ReturnType<typeof setInterval>
    let run = 0
    const fire = () => {
      setSabRun(++run)
      setCount(SPACE_SABOTAGE_START)
      let left = SPACE_SABOTAGE_START
      tick = setInterval(() => setCount(Math.max(0, --left)), 1000)
      clear = setTimeout(() => {
        clearInterval(tick)
        setSabRun(null)
      }, SPACE_SABOTAGE_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(SPACE_SABOTAGE_GAP_MIN_MS + Math.random() * (SPACE_SABOTAGE_GAP_MAX_MS - SPACE_SABOTAGE_GAP_MIN_MS))
      }, delay)
    }
    schedule(SPACE_SABOTAGE_TEST ? 3000 : 45_000 + Math.random() * 30_000) // 1re alerte : 45 s à 1 min 15
    // MODE TEST : déclenche le sabotage à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
      clearInterval(tick)
    }
  }, [])
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
    <div className={`space-decor${sabRun !== null ? ' is-sabotage' : ''}`} aria-hidden>
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
      {/* SURPRISE « sabotage » : monté le temps de la séquence ; la clé React rejoue les
          animations CSS à chaque passage. */}
      {sabRun !== null && (
        <div className="space-sabotage" key={sabRun}>
          {/* Voile `multiply` : les étoiles blanches rougissent (le fond noir, lui, ne bouge pas). */}
          <div className="sab-tint" />
          {/* La sirène : une lueur rouge qui pulse depuis les bords. */}
          <div className="sab-alarm" />
          {/* Bandes de danger hachurées, en haut et en bas. */}
          <div className="sab-stripes sab-stripes--top" />
          <div className="sab-stripes sab-stripes--bottom" />
          {/* Le panneau d'alerte : le décompte, puis « sabotage réparé ». */}
          <div className="sab-panel">
            <div className="sab-alert">
              <span className="sab-label">⚠ ALERTE ⚠</span>
              <span className="sab-title">Fusion du réacteur</span>
              <span className="sab-count">{`0:0${count}`}</span>
            </div>
            <div className="sab-fixed">Sabotage réparé</div>
          </div>
          {/* Le flash de la fusion, à zéro. */}
          <div className="sab-flash" />
        </div>
      )}
    </div>
  )
}

// Ratio largeur/hauteur d'une frame du sprite de flamme (cf. fire_sprite.png).
const FLAME_ASPECT = 403 / 360
// Marge transparente SOUS la flamme dans chaque frame (92 px sur 360 = constante, cf. mesure).
// La flamme étant ancrée par le bas (`bottom: 0`), cette marge grandit avec la taille et fait
// « remonter » la base visible → on compense par un `bottom` négatif de `gap × hauteur`.
const FLAME_BASE_GAP = 92 / 360

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
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
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
    // MODE TEST : déclenche le coup de colère à la demande.
    fireRef.current = () => {
      setAngry(true)
      rage = setTimeout(() => setAngry(false), 3500)
    }
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
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
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
  // Pétales d'or qui tombent en voletant (chute + ondulation latérale + rotation lente). On réutilise
  // les 3 images de pétale de Gaston, colorées en JAUNE DORÉ via un filtre (cf. `.hair-petal-img`).
  const [petals] = useState(() =>
    Array.from({ length: 14 }, () => ({
      img: `/animations/petale-${1 + Math.floor(Math.random() * 3)}.png`,
      left: Math.random() * 100, // %
      size: 2.4 + Math.random() * 2.4, // vh (hauteur du pétale)
      dur: 8 + Math.random() * 7, // s (chute lente)
      delay: -(Math.random() * 15), // s (déphasage)
      sway: 2 + Math.random() * 4, // vw (amplitude d'ondulation)
      swayDur: 3 + Math.random() * 2, // s
      rotDur: 4 + Math.random() * 4, // s (rotation sur soi)
      rotDir: Math.random() < 0.5 ? 'normal' : 'reverse', // sens de rotation
      op: 0.45 + Math.random() * 0.4,
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
    // MODE TEST : déclenche l'incantation à la demande.
    fireRef.current = () => {
      setSinging(true)
      glow = setTimeout(() => setSinging(false), SING_MS)
    }
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
      {/* Pétales d'or qui tombent en voletant (images de Gaston colorées en doré). */}
      {petals.map((p, i) => (
        <span
          key={`hp-${i}`}
          className="hair-petal-fall"
          style={{ left: `${p.left}%`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
        >
          <span
            className="hair-petal-sway"
            style={{ animationDuration: `${p.swayDur}s`, animationDelay: `${p.delay}s`, '--sway': `${p.sway}vw` } as CSSProperties}
          >
            <img
              src={p.img}
              alt=""
              className="hair-petal-img"
              draggable={false}
              style={{ height: `${p.size}vh`, opacity: p.op, animationDuration: `${p.rotDur}s`, animationDirection: p.rotDir }}
            />
          </span>
        </span>
      ))}
      {/* La FLEUR D'OR magique (sun-drop) au bas de la colonne : elle luit, et plus fort pendant l'incantation. */}
      <img src="/animations/flower.png" alt="" className="hair-flower" draggable={false} />
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
      void v.play().catch(() => {}) // best-effort (autoplay possiblement bloqué)
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

// Teintes de sorcellerie violette pour la poussière de magie (variées : violet, magenta, mauve).
const QUEEN_MOTE_COLORS = ['#b026ff', '#d11ad1', '#e040fb', '#9b4dd6']

// Couleurs des bulles de potion qui montent (suffixes de classe `.queen-bubble--*`).
const QUEEN_BUBBLE_TINTS = ['green']

/** La potion de la Méchante Reine en train de mijoter (la scène du film : elle prépare son
 *  breuvage de déguisement). Un VERRE translucide contient un liquide qui change de couleur en
 *  boucle — transparent → noir → #AF3716 (rouille) → #334826 (vert sombre) — puis un ÉCLAIR
 *  foudroie le verre (flash + foudre) et le liquide se VAPORISE en un gaz #556B5D qui s'échappe,
 *  avant de reprendre depuis le début. Le liquide bouillonne pendant l'infusion.
 *  Les couleurs sont pilotées par `data-phase` (cf. index.css, section « potion ») ; la séquence
 *  est cadencée par une chaîne de timers ci-dessous. */
type PotionPhase = 'clear' | 'black' | 'rust' | 'green' | 'transmuted' | 'gas' | 'fall' | 'gone'
// Délai avant que le verre ne réapparaisse après être tombé. En prod : 2 min ; pour le test : 10 s.
const POTION_REAPPEAR_MS = 120_000 // 2 min
function PotionBrew() {
  const [phase, setPhase] = useState<PotionPhase>('clear')
  const [strike, setStrike] = useState(false) // éclair en cours
  // Bouillons à l'intérieur du liquide (montent puis s'effacent, clipés par le liquide).
  const [brew] = useState(() =>
    Array.from({ length: 18 }, () => ({
      left: 12 + Math.random() * 76, // %
      size: 0.7 + Math.random() * 1.6, // vh
      dur: 1.6 + Math.random() * 1.6, // s (bouillonne plus vite)
      delay: -(Math.random() * 3), // s
    })),
  )
  // Volutes de gaz qui s'échappent du verre une fois la potion vaporisée (phase « gas »).
  const [gas] = useState(() =>
    Array.from({ length: 9 }, () => ({
      left: 30 + Math.random() * 40, // %
      size: 5 + Math.random() * 7, // vh
      dur: 3.4 + Math.random() * 2.6, // s
      delay: -(Math.random() * 4), // s
      drift: (Math.random() - 0.5) * 6, // vw (dérive latérale en montant)
    })),
  )
  // Séquence en boucle : chaque étape est programmée par un timer décalé ; à la fin, on relance.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const run = () => {
      const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
      setPhase('clear')
      setStrike(false)
      at(4500, () => setPhase('black')) // le liquide se trouble et noircit
      at(8000, () => setPhase('rust')) // vire au rouge-rouille (#AF3716)
      at(11500, () => setPhase('green')) // puis au vert sombre (#334826)
      at(15000, () => setStrike(true)) // l'éclair foudroie le verre
      at(15800, () => {
        setStrike(false)
        setPhase('transmuted') // le liquide vire au #556B5D et reste plein 10 s
      })
      at(25800, () => setPhase('gas')) // puis il se vide en se vaporisant
      at(28800, () => setPhase('fall')) // le verre vidé se renverse et tombe
      at(30000, () => setPhase('gone')) // disparu (après l'animation de chute)
      at(30000 + POTION_REAPPEAR_MS, run) // réapparaît puis tout recommence
    }
    run()
    return () => timers.forEach(clearTimeout)
  }, [])
  return (
    <div className={`queen-potion${strike ? ' is-strike' : ''}`} data-phase={phase} aria-hidden>
      {/* Foudre + flash (visibles seulement pendant `is-strike`). */}
      <div className="potion-bolt" />
      <div className="potion-flash" />
      {/* Le verre et son contenu. */}
      <div className="potion-glass">
        <div className="potion-liquid">
          <span className="potion-surface" />
          {brew.map((b, i) => (
            <span
              key={i}
              className="potion-brew-bubble"
              style={{
                left: `${b.left}%`,
                width: `${b.size}vh`,
                height: `${b.size}vh`,
                animationDuration: `${b.dur}s`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </div>
        <div className="potion-shine" />
        <div className="potion-rim" />
      </div>
      {/* Gaz qui s'échappe du verre (phase « gas »). */}
      {gas.map((g, i) => (
        <span
          key={`gas-${i}`}
          className="potion-gas"
          style={{
            left: `${g.left}%`,
            width: `${g.size}vh`,
            height: `${g.size}vh`,
            animationDuration: `${g.dur}s`,
            animationDelay: `${g.delay}s`,
            '--drift': `${g.drift}vw`,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

// SURPRISE « MIROIR, MON BEAU MIROIR » (Méchante Reine) : l'invocation du Miroir magique, en trois
// temps. 1) L'INVOCATION — la fumée du décor s'aspire vers le centre en volutes, la lumière baisse et
// un grand MIROIR ovale se rassemble (cadre doré en CSS, glace noire, filet lumineux qui court le long
// du bord). 2) LES FLAMMES VERTES — un tourbillon vert monte dans la glace, puis le MASQUE se
// matérialise au milieu des flammes et se tient en respirant (halo qui pulse, léger tremblement).
// 3) RETOUR À LA FUMÉE — le masque se dissout vers le haut, le cadre s'assombrit et le miroir se
// défait en volutes qui repartent dans le décor. Le seul asset est le MASQUE (`decor.mirrorMask`) :
// cadre, glace, flammes et volutes sont en CSS. Séquence jouée en CSS (keyframes `qm*`, index.css) :
// le calque est (dé)monté le temps de la surprise, sa clé React rejoue donc tout depuis le début à
// chaque passage. Les bornes ci-dessous doivent rester EN PHASE avec la timeline CSS.
const QUEEN_MIRROR_TEST = false
const QUEEN_MIRROR_MS = 11_200 // invocation (1,8 s) + flammes (1,4 s) + masque tenu (3,6 s) + dissolution (2,4 s) + fumée (2 s)
const QUEEN_MIRROR_GAP_MIN_MS = QUEEN_MIRROR_TEST ? 6000 : 150_000 // 2 min 30 (c'est une SURPRISE : c'est rare)
const QUEEN_MIRROR_GAP_MAX_MS = QUEEN_MIRROR_TEST ? 11_000 : 270_000 // 4 min 30

/** Décor « Méchante Reine » (Blanche-Neige) : la fumée violette de sorcellerie (vidéo `video`)
 *  SURMONTÉE de trois couches qui racontent la Reine — des BULLES de potion verte montent du fond
 *  (le chaudron ; réutilise l'enveloppe `.bubble-rise`/`.bubble-sway` d'Ursula), une fine POUSSIÈRE
 *  de sorcellerie violette monte en scintillant (réutilise les motes de Facilier, teintés violet),
 *  et une POTION mijote dans un verre (changement de couleurs → éclair → vaporisation → chute).
 *  Éléments tirés une fois au montage, animations en CSS (cf. index.css, section « Méchante Reine »).
 *  Surprise : « Miroir, mon beau miroir » (cf. ci-dessus). */
function EvilQueenDecor({ decor }: { decor: Extract<VillainDecorData, { kind: 'evilQueen' }> }) {
  // Bulles de potion : montent du fond en ondulant (réutilise `.bubble-rise`/`.bubble-sway`),
  // dessinées en CSS (pas d'image) → la couleur vient de la classe `.queen-bubble--*` (vert /
  // transparent / bleu / jaune, réparties au hasard).
  const [bubbles] = useState(() =>
    Array.from({ length: 22 }, (_, i) => ({
      left: Math.random() * 100, // %
      size: 0.8 + Math.random() * 2.4, // vh (petites bulles)
      dur: 9 + Math.random() * 9, // s (montée lente, 9–18 s)
      delay: -(Math.random() * 18), // s (flux continu, déphasé)
      sway: 1.4 + Math.random() * 3, // vw (ondulation latérale)
      swayDur: 2.4 + Math.random() * 2.2, // s (période d'ondulation)
      op: 0.8, // opacité des bulles
      tint: QUEEN_BUBBLE_TINTS[i % QUEEN_BUBBLE_TINTS.length], // couleur de la bulle
    })),
  )
  // Poussière de sorcellerie violette : monte en ondulant et en scintillant (mêmes mécaniques que
  // les motes de Facilier : enveloppe = montée, milieu = ondulation, image = scintillement).
  const [motes] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      left: Math.random() * 100, // %
      size: 1.6 + Math.random() * 2.8, // px
      dur: 8 + Math.random() * 8, // s (montée lente)
      delay: -(Math.random() * 16), // s
      sway: 2 + Math.random() * 5, // vw (ondulation latérale)
      swayDur: 3 + Math.random() * 3, // s
      twkDur: 1.3 + Math.random() * 1.8, // s (scintillement)
      twkDelay: -(Math.random() * 3), // s
      op: 0.4 + Math.random() * 0.5,
      color: QUEEN_MOTE_COLORS[i % QUEEN_MOTE_COLORS.length],
    })),
  )
  // Pommes empoisonnées réparties sur toute la zone joueur : on les pose sur une GRILLE 3×2 (avec un
  // peu de jitter) pour éviter qu'elles se regroupent, puis chacune se balade lentement autour de sa
  // case (dérive X/Y modérée), avec un tangage léger et un halo vert toxique qui pulse.
  const APPLE_COLS = 3
  const APPLE_ROWS = 2
  const [apples] = useState(() =>
    Array.from({ length: APPLE_COLS * APPLE_ROWS }, (_, i) => {
      const cx = i % APPLE_COLS
      const cy = Math.floor(i / APPLE_COLS)
      return {
        left: ((cx + 0.5) / APPLE_COLS) * 100 + (Math.random() - 0.5) * 12, // % (centre de case ± jitter)
        top: ((cy + 0.5) / APPLE_ROWS) * 100 + (Math.random() - 0.5) * 16, // %
        size: 2.6 + Math.random() * 3.4, // vh (petites pommes)
        dx: 5 + Math.random() * 7, // vw (dérive horizontale modérée, reste dans sa zone)
        dy: 7 + Math.random() * 9, // vh (dérive verticale modérée)
        floatDur: 24 + Math.random() * 16, // s (balade lente, 24–40 s)
        lean: 3 + Math.random() * 4, // deg (tangage)
        leanDur: 6.5 + Math.random() * 3.5, // s
        glowDur: 4 + Math.random() * 2.5, // s (pulsation du halo)
        delay: -(Math.random() * 20), // s (déphasage)
      }
    }),
  )
  // SURPRISE « Miroir, mon beau miroir » : volutes de fumée qui convergent vers le miroir (puis en
  // repartent à la fin) — angle autour du centre, distance de départ, taille et déphasage.
  const [wisps] = useState(() =>
    Array.from({ length: 12 }, (_, i) => ({
      // Réparties tout autour du miroir (12 secteurs) avec un peu de jitter.
      angle: (i / 12) * 360 + (Math.random() - 0.5) * 22, // deg
      dist: 11 + Math.random() * 9, // vh (distance de départ au centre)
      size: 3 + Math.random() * 3.5, // vh
      delay: Math.random() * 0.9, // s (elles n'arrivent pas toutes ensemble)
      spin: (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 70), // deg (elles s'enroulent)
    })),
  )
  // Le calque du miroir est monté le temps de la séquence, avec un compteur de passage en clé React
  // → les animations CSS repartent de zéro à chaque déclenchement. Timer interne (rare), aussi tiré
  // par l'outil de test (bouton ✨ du panneau Animation).
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  const [mirrorRun, setMirrorRun] = useState<number | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      clearTimeout(clear) // (re)déclenchement manuel : on repart d'une séquence propre
      setMirrorRun(++run)
      clear = setTimeout(() => setMirrorRun(null), QUEEN_MIRROR_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(QUEEN_MIRROR_MS + QUEEN_MIRROR_GAP_MIN_MS + Math.random() * (QUEEN_MIRROR_GAP_MAX_MS - QUEEN_MIRROR_GAP_MIN_MS))
      }, delay)
    }
    schedule(QUEEN_MIRROR_TEST ? 3000 : 45_000 + Math.random() * 30_000) // 1re apparition : 45 s à 1 min 15
    // MODE TEST : déclenche la séquence à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className={`queen-decor${mirrorRun !== null ? ' queen-decor--mirror' : ''}`} aria-hidden>
      {/* Fond : la vidéo de fumée violette (réutilise le décor vidéo générique, avec son bouclage en fondu). */}
      <VideoDecor decor={{ kind: 'video', src: decor.src, gradient: decor.gradient }} />
      {/* Bulles de potion verte qui montent du chaudron. */}
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
          <span
            className={`bubble-sway queen-bubble queen-bubble--${b.tint}`}
            style={{
              width: `${b.size}vh`,
              height: `${b.size}vh`,
              animationDuration: `${b.swayDur}s`,
              animationDelay: `${b.delay}s`,
              '--bubble-sway': `${b.sway}vw`,
            } as CSSProperties}
          />
        </span>
      ))}
      {/* Poussière de sorcellerie violette qui monte en scintillant. */}
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
      {/* Potion qui mijote : verre + liquide qui change de couleur, éclair, puis vaporisation. */}
      <PotionBrew />
      {/* Pommes empoisonnées qui lévitent : enveloppe = bercement vertical ; halo vert pulsant derrière ; image qui tangue. */}
      {apples.map((a, i) => (
        <span
          key={`apple-${i}`}
          className="queen-apple-bob"
          style={{
            left: `${a.left}%`,
            top: `${a.top}%`,
            animationDuration: `${a.floatDur}s`,
            animationDelay: `${a.delay}s`,
            '--dx': `${a.dx}vw`,
            '--dy': `${a.dy}vh`,
          } as CSSProperties}
        >
          <span
            className="queen-apple-glow"
            style={{
              width: `${a.size * 1.7}vh`,
              height: `${a.size * 1.7}vh`,
              animationDuration: `${a.glowDur}s`,
              animationDelay: `${a.delay}s`,
            }}
          />
          <img
            src={decor.apple}
            alt=""
            className="queen-apple"
            draggable={false}
            style={{
              height: `${a.size}vh`,
              animationDuration: `${a.leanDur}s`,
              animationDelay: `${a.delay}s`,
              '--lean': `${a.lean}deg`,
            } as CSSProperties}
          />
        </span>
      ))}
      {/* SURPRISE « Miroir, mon beau miroir ». Monté seulement pendant la séquence (clé = n° de
          passage → les animations CSS rejouent depuis le début à chaque déclenchement). */}
      {mirrorRun !== null && (
        <div className="queen-mirror" key={mirrorRun}>
          {/* Voile sombre : la lumière baisse le temps de l'invocation, puis remonte. */}
          <div className="qm-veil" />
          {/* Les volutes de fumée : elles convergent vers le centre (invocation) puis en repartent
              (le miroir se défait). Même jeu d'éléments, deux classes / deux moments. */}
          {wisps.map((w, i) => (
            <span
              key={`in-${i}`}
              className="qm-wisp qm-wisp--in"
              style={{
                width: `${w.size}vh`,
                height: `${w.size}vh`,
                animationDelay: `${w.delay}s`,
                '--angle': `${w.angle}deg`,
                '--dist': `${w.dist}vh`,
                '--spin': `${w.spin}deg`,
              } as CSSProperties}
            />
          ))}
          {wisps.map((w, i) => (
            <span
              key={`out-${i}`}
              className="qm-wisp qm-wisp--out"
              style={{
                width: `${w.size}vh`,
                height: `${w.size}vh`,
                animationDelay: `${8.4 + w.delay}s`, // départ quand le cadre commence à se défaire
                '--angle': `${w.angle}deg`,
                '--dist': `${w.dist}vh`,
                '--spin': `${-w.spin}deg`,
              } as CSSProperties}
            />
          ))}
          {/* Le miroir : cadre doré ovale (conic-gradient métallique) + glace noire. */}
          <div className="qm-frame">
            <div className="qm-glass">
              {/* Tourbillon de flammes vertes : deux couches contra-rotatives + un brasier au fond. */}
              <div className="qm-blaze" />
              <div className="qm-flames" />
              <div className="qm-flames qm-flames--b" />
              {/* Le masque : halo vert derrière, puis l'image qui se matérialise et se dissout. */}
              <div className="qm-face-glow" />
              <img src={decor.mirrorMask} alt="" className="qm-mask" draggable={false} />
            </div>
            {/* Filet lumineux qui court le long du cadre. */}
            <div className="qm-rim" />
          </div>
        </div>
      )}
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
// SURPRISE « LE COFFRE DÉBORDE… ET SE VIDE » (Prince Jean) : sa cupidité en trois temps.
// 1) LE DÉLUGE — un torrent de pièces (et quelques diamants) se déverse du haut de la colonne,
//    bien plus dense que sa pluie de passage. 2) LE MAGOT — l'or S'EMPILE en bas de la colonne, le
//    tas grossit et des éclats le parcourent : le seul moment où son or est à lui. 3) LA FUITE —
//    le tas s'affaisse et se vide, la lueur retombe, et il ne reste que sa poussière d'or.
// Aucun nouvel asset : les 11 pièces sont déjà celles du décor, les 4 diamants existent déjà.
// Les bornes ci-dessous doivent rester EN PHASE avec la timeline CSS (keyframes `pj*`, index.css).
const PJ_HOARD_TEST = false
const PJ_HOARD_MS = 13_000 // déluge (5,5 s) + magot tenu (3 s) + fuite (4,5 s)
const PJ_HOARD_GAP_MIN_MS = PJ_HOARD_TEST ? 16_000 : 150_000 // 2 min 30
const PJ_HOARD_GAP_MAX_MS = PJ_HOARD_TEST ? 20_000 : 260_000 // 4 min 20
const PJ_FLOOD = 110 // pièces/diamants qui se déversent (à un instant donné, un tiers seulement est en vol)
const PJ_REST = 30 // pièces qui restent posées sur le tas
const GEM_IMAGES = Array.from({ length: 4 }, (_, i) => `/animations/diamant-${i + 1}.png`)
// Profil du tas, à garder en phase avec `.pj-mound` (index.css) : pied à 12 vh, crête 22 vh plus
// haut, et une demi-largeur volontairement PLUS LARGE que le monticule principal — les deux
// monticules latéraux prolongent le tas jusqu'aux bords de la colonne.
const PJ_MOUND_BOTTOM = 12 // vh
const PJ_MOUND_HEIGHT = 22 // vh
const PJ_MOUND_HALF = 62 // % de la colonne
/** Hauteur (vh) de la surface du tas à l'abscisse `left` (%), profil elliptique. */
const moundSurface = (left: number) =>
  PJ_MOUND_BOTTOM + PJ_MOUND_HEIGHT * Math.sqrt(Math.max(0, 1 - ((left - 50) / PJ_MOUND_HALF) ** 2))

function GoldDustDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
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
  // SURPRISE — LE DÉLUGE : les pièces qui se déversent (une sur six est un diamant, pour l'éclat).
  const [flood] = useState(() =>
    Array.from({ length: PJ_FLOOD }, (_, i) => ({
      img: i % 6 === 5 ? GEM_IMAGES[i % GEM_IMAGES.length] : COIN_IMAGES[i % COIN_IMAGES.length],
      left: -2 + Math.random() * 104, // %
      size: 2 + Math.random() * 2.6, // vh
      dur: 1.1 + Math.random() * 0.7, // s (chute franche : ça se DÉVERSE)
      delay: Math.random() * 3.4, // s (le torrent s'étale sur toute la montée du tas)
      spin: (Math.random() < 0.5 ? -1 : 1) * 360 * (1 + Math.floor(Math.random() * 2)),
    })),
  )
  // …et LE MAGOT : les pièces qui restent posées sur le tas, posées une à une.
  const [rest] = useState(() =>
    Array.from({ length: PJ_REST }, (_, i) => {
      const left = 2 + Math.random() * 96 // %
      return {
        img: i % 7 === 6 ? GEM_IMAGES[i % GEM_IMAGES.length] : COIN_IMAGES[i % COIN_IMAGES.length],
        left,
        // Le tas est bombé : la pièce se pose sur le PROFIL du monticule à SON abscisse (profil
        // elliptique, comme le `border-radius` du tas — une sinusoïde faisait flotter les pièces
        // du centre au-dessus de la surface), à une fraction de la hauteur pour qu'aucune ne
        // dépasse la crête.
        bottom: PJ_MOUND_BOTTOM + (moundSurface(left) - PJ_MOUND_BOTTOM) * (0.35 + Math.random() * 0.62), // vh
        size: 2.2 + Math.random() * 2.4, // vh
        tilt: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 40), // deg
        delay: 0.6 + Math.random() * 3, // s (elles s'accumulent pendant que le tas monte)
      }
    }),
  )
  // SURPRISE : `hoard` = un compteur qui sert de clé React (rejoue les animations). `null` = repos.
  const [hoard, setHoard] = useState<{ run: number } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setHoard({ run: ++run })
      clear = setTimeout(() => setHoard(null), PJ_HOARD_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(PJ_HOARD_GAP_MIN_MS + Math.random() * (PJ_HOARD_GAP_MAX_MS - PJ_HOARD_GAP_MIN_MS))
      }, delay)
    }
    schedule(PJ_HOARD_TEST ? 3000 : 80_000 + Math.random() * 40_000) // 1er coffre : 1 min 20 à 2 min
    // MODE TEST : fait déborder le coffre à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
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
      {/* SURPRISE « LE COFFRE DÉBORDE… ET SE VIDE ». */}
      {hoard && (
        <div className="pj-hoard" key={hoard.run}>
          {/* La lueur dorée monte d'un cran pendant que l'or s'entasse, puis retombe. */}
          <span className="pj-glow" />
          {/* 1) LE DÉLUGE. */}
          {flood.map((f, i) => (
            <img
              key={`pj-fall-${i}`}
              src={f.img}
              alt=""
              className="pj-fall"
              style={{
                left: `${f.left}%`,
                height: `${f.size}vh`,
                animationDuration: `${f.dur}s`,
                animationDelay: `${f.delay}s`,
                '--coin-spin': `${f.spin}deg`,
              } as CSSProperties}
              draggable={false}
            />
          ))}
          {/* 2) LE MAGOT : le tas et les pièces qui s'y posent une à une. TROIS monticules qui se
              chevauchent (et poussent à des rythmes légèrement décalés) : un dôme unique se lisait
              comme une bosse lisse, pas comme un tas d'or. */}
          <span className="pj-mound pj-mound--l" />
          <span className="pj-mound pj-mound--r" />
          <span className="pj-mound" />
          <div className="pj-rest-layer">
            {rest.map((r, i) => (
              <img
                key={`pj-rest-${i}`}
                src={r.img}
                alt=""
                className="pj-rest"
                style={{
                  left: `${r.left}%`,
                  bottom: `${r.bottom}vh`,
                  height: `${r.size}vh`,
                  animationDelay: `${r.delay}s`,
                  '--tilt': `${r.tilt}deg`,
                } as CSSProperties}
                draggable={false}
              />
            ))}
          </div>
          {/* Les éclats de reflet qui parcourent le tas pendant qu'il est à son plus haut. */}
          <span className="pj-glint" />
          <span className="pj-glint pj-glint--2" />
        </div>
      )}
    </div>
  )
}

// SURPRISE « TOUCHEZ LE FUSEAU… » (Maléfique) : la MALÉDICTION, en trois temps. 1) LE FEU FOLLET —
// la boule verte qui erre derrière les ronces s'efface et sa magie se rassemble EN HAUT de la colonne
// (le plateau du vilain en occupe le milieu), où elle enfle en pulsant (le sortilège qui attire
// Aurore ; hauteur réglable d'un seul endroit : `--thorn-curse-y`). 2) LE ROUET — il se rétracte en un
// point incandescent tandis que le ROUET se matérialise autour de lui en silhouette noire (roue à
// rayons + fuseau), tournant de plus en plus vite, la pointe du fuseau brillant de vert. 3) LA
// PIQÛRE — la pointe éclate : un flash vert et deux ondes déferlent sur tout l'écran, puis le rouet
// ralentit, s'efface, et la boule reprend sa balade. 100 % CSS, aucun asset (keyframes `thornCurse*`
// / `thornWisp` / `thornWheel*`, cf. index.css). Les bornes ci-dessous doivent rester EN PHASE avec
// la timeline CSS. Flag de test → cadence rapprochée pour régler.
const THORN_CURSE_TEST = false
const THORN_CURSE_MS = 9000 // durée totale : follet (0–2,4 s) → rouet (2,4–5 s) → piqûre (5 s) → fondu (–9 s)
const THORN_CURSE_GAP_MIN_MS = THORN_CURSE_TEST ? 6000 : 75_000 // 1 min 15 (c'est une SURPRISE : c'est rare)
const THORN_CURSE_GAP_MAX_MS = THORN_CURSE_TEST ? 11_000 : 150_000 // 2 min 30

/** Décor « ronces » : l'image `ronces.png` (ronces noires sur fond blanc) posée en
 *  `mix-blend-mode: multiply` → le blanc disparaît, seules les ronces restent, par-dessus
 *  une lueur verte pulsante (la magie de Maléfique) ; des étincelles vertes s'élèvent en
 *  scintillant. Étincelles tirées une fois au montage.
 *  SURPRISE : « Touchez le fuseau… » (cf. ci-dessus). */
function ThornsDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // SURPRISE « touchez le fuseau… » : on monte le calque `.thorn-curse` le temps de la séquence,
  // avec un compteur de passage en clé React → les animations CSS repartent de zéro à chaque
  // déclenchement (même mécanique que la clé noire du Seigneur des clés).
  const [curseRun, setCurseRun] = useState<number | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setCurseRun(++run)
      clear = setTimeout(() => setCurseRun(null), THORN_CURSE_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(THORN_CURSE_GAP_MIN_MS + Math.random() * (THORN_CURSE_GAP_MAX_MS - THORN_CURSE_GAP_MIN_MS))
      }, delay)
    }
    schedule(THORN_CURSE_TEST ? 3000 : 45_000 + Math.random() * 30_000) // 1re apparition : 45 s à 1 min 15
    // MODE TEST : déclenche la malédiction à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
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
    <div className={`thorns-decor${curseRun !== null ? ' is-cursing' : ''}`} aria-hidden>
      {/* Lueur verte pulsante (la magie qui émane du sol). */}
      <div className="thorn-glow" />
      {/* Boule verte hypnotique qui se balade DERRIÈRE les ronces (la magie de Maléfique).
          Enveloppe : pendant la malédiction, elle s'efface (sa magie part au centre) puis revient —
          on anime l'ENVELOPPE pour ne pas relancer la balade (`orbWander`) de l'orbe. */}
      <div className="thorn-orb-wrap">
        <div className="thorn-orb" />
      </div>
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
      {/* SURPRISE « Touchez le fuseau… » : monté le temps de la séquence, PAR-DESSUS les ronces
          (z-index) pour rester lisible. La clé React rejoue les animations à chaque passage. */}
      {curseRun !== null && (
        <div className="thorn-curse" key={curseRun}>
          {/* Voile sombre : la scène s'éteint autour du sortilège. */}
          <div className="thorn-veil" />
          {/* Le feu follet : il enfle au centre, puis se rétracte en un point sur la pointe du fuseau. */}
          <div className="thorn-wisp" />
          {/* Le rouet, en silhouette : jante + rayons (qui tournent) + moyeu + fuseau à droite. */}
          <div className="thorn-wheel">
            <div className="thorn-wheel-spokes" />
            <div className="thorn-wheel-hub" />
            <div className="thorn-spindle">
              <span className="thorn-spindle-tip" />
            </div>
          </div>
          {/* La piqûre : flash vert + deux ondes qui déferlent depuis la pointe. */}
          <div className="thorn-prick-flash" />
          <div className="thorn-wave" />
          <div className="thorn-wave thorn-wave--late" />
        </div>
      )}
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
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
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
    // MODE TEST : déclenche l'apparition de Slenderman à la demande.
    fireRef.current = () => {
      setFigureLeft(12 + Math.random() * 76)
      setGlitch(true)
      burst = setTimeout(() => setGlitch(false), 1600)
    }
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

// SURPRISE « QU'ON LUI COUPE LA TÊTE ! » (Reine de Cœur) : sa colère, en trois temps. 1) LE SILENCE —
// les pétales se FIGENT en plein vol et le fond cramoisi vire au ROUGE SANG, la vignette se referme.
// 2) LE CRI — tout le champ de pétales est BALAYÉ VERS LE HAUT (ils repartent à contresens de leur
// chute) pendant que deux ondes en forme de CŒUR se propagent sur toute la colonne. 3) LE VERDICT —
// la sentence s'abat au centre comme un COUP DE TAMPON (elle arrive floue et trop grande, se pose net)
// avec une secousse, marque un temps, puis tout retombe et les pétales reprennent leur chute.
// 100 % CSS + texte, aucun asset (keyframes `qh*`, cf. index.css). Les bornes ci-dessous doivent rester
// EN PHASE avec la timeline CSS. Flag de test → cadence rapprochée pour régler.
const QUEEN_FURY_TEST = false
const QUEEN_FURY_MS = 10_000 // silence (0–1,2 s) → cri (1,2–4 s) → verdict (1,6–7,5 s) → retour
const QUEEN_FURY_GAP_MIN_MS = QUEEN_FURY_TEST ? 6000 : 75_000 // 1 min 15 (c'est une SURPRISE : c'est rare)
const QUEEN_FURY_GAP_MAX_MS = QUEEN_FURY_TEST ? 11_000 : 150_000 // 2 min 30

/** Décor « petals » : des pétales de roses rouges tombent du haut en voletant (oscillation
 *  latérale) et en tournoyant, sur un fond cramoisi sombre. Pétales tirés une fois au montage,
 *  chute jouée en CSS (cf. `index.css`, section « pétales de roses »). (Reine de Cœur)
 *  SURPRISE : « Qu'on lui coupe la tête ! » (cf. ci-dessus). */
const PETAL_REDS = ['#c8162e', '#a8122a', '#d83350', '#8e0e22', '#b81832']
function PetalsDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // SURPRISE « qu'on lui coupe la tête ! » : la classe `is-fury` fige les pétales et emporte leur
  // champ ; le calque `.queen-fury` (monté le temps de la séquence, clé React = numéro de passage)
  // joue le sang, les ondes en cœur et le verdict.
  const [furyRun, setFuryRun] = useState<number | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setFuryRun(++run)
      clear = setTimeout(() => setFuryRun(null), QUEEN_FURY_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(QUEEN_FURY_GAP_MIN_MS + Math.random() * (QUEEN_FURY_GAP_MAX_MS - QUEEN_FURY_GAP_MIN_MS))
      }, delay)
    }
    schedule(QUEEN_FURY_TEST ? 3000 : 45_000 + Math.random() * 30_000) // 1re colère : 45 s à 1 min 15
    // MODE TEST : déclenche la colère à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
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
    <div className={`petals-decor${furyRun !== null ? ' is-fury' : ''}`} aria-hidden>
      {/* Champ de pétales : c'est LUI qu'emporte la bourrasque (les pétales, eux, sont figés) —
          on anime l'enveloppe pour ne pas casser leur chute (`petalFall`). */}
      <div className="petal-field">
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
      {/* SURPRISE « Qu'on lui coupe la tête ! » : monté le temps de la séquence ; la clé React
          rejoue les animations CSS à chaque passage. */}
      {furyRun !== null && (
        <div className="queen-fury" key={furyRun}>
          {/* Le fond vire au rouge sang, et la vignette se referme. */}
          <div className="qh-blood" />
          <div className="qh-vignette" />
          {/* Deux ondes en forme de cœur, qui se propagent depuis le verdict. */}
          <div className="qh-heart" />
          <div className="qh-heart qh-heart--late" />
          {/* La sentence, tamponnée. */}
          <div className="qh-verdict">Qu'on lui coupe la tête !</div>
        </div>
      )}
    </div>
  )
}

// SURPRISE « LA BORDÉE » (Capitaine Crochet) : le JOLLY ROGER — mouillé dans le lagon, au centre de
// l'illustration de Neverland — CANONNE LE CIEL, comme quand Crochet tire sur Peter Pan en plein vol.
// Chaque coup : l'ÉCLAIR de bouche claque sur le navire (halo orange + son reflet sur l'eau), le
// BOULET s'élève en ARC au-dessus de la mer en semant une traînée de fumée qui s'étale, puis il
// ÉCLATE en plein ciel (flash + bouffée qui gonfle et se dissipe + éclats). 100 % CSS, aucun asset.
// Les bornes ci-dessous doivent rester EN PHASE avec la timeline CSS (keyframes `water*`, index.css).
const WATER_BARRAGE_TEST = false
const WATER_SHOTS = 5 // coups d'une salve
const WATER_TRAIL_PUFFS = 7 // bouffées de fumée semées le long de l'arc, par coup
const WATER_BARRAGE_MS = 11_000 // salve complète : dernier départ (~3,4 s) + vol + explosion + dissipation
const WATER_BARRAGE_GAP_MIN_MS = WATER_BARRAGE_TEST ? 9000 : 140_000 // ≈ 2 min 20
const WATER_BARRAGE_GAP_MAX_MS = WATER_BARRAGE_TEST ? 14_000 : 260_000 // ≈ 4 min 20
// Géométrie de l'île, à garder EN PHASE avec `.water-island` (index.css) : la boîte fait 34 vh de
// large, l'illustration (415×315) y tient en `contain` — donc ~25,8 vh de haut — calée en bas à
// gauche, à `bottom: 15 %`. Le NAVIRE se trouve aux ~54 % de la largeur et ~70 % de la hauteur de
// l'illustration (depuis le haut) : c'est de là que part chaque coup.
const WATER_ISLAND_W_VH = 34
const WATER_ISLAND_H_VH = 25.8
const WATER_ISLAND_BOTTOM_PCT = 15
const WATER_SHIP_X = 0.51 // fraction de la largeur de l'île
const WATER_SHIP_Y = 0.62 // fraction de sa hauteur, depuis le HAUT

// Un coup de canon de la salve. La trajectoire est un ARC : X linéaire (`waterBallX`), Y décéléré
// (`waterBallY`, ease-out quad) — le boulet ralentit à mesure qu'il monte, comme un vrai tir.
type WaterShot = {
  delay: number // s (échelonnement dans la salve)
  flight: number // s (bouche → apogée)
  dx: number // vh parcourus vers le large (en vh comme le reste du décor : la colonne est étroite,
  //            des vw feraient sortir l'apogée du cadre du vilain)
  dy: number // vh de montée jusqu'à l'apogée
  size: number // vh (calibre du boulet)
  grow: number // agrandissement du boulet pendant le vol (il vient vers nous)
  puffs: { t: number; x: number; y: number; size: number; drift: number }[] // fumée semée sur l'arc
  sparks: { sx: number; sy: number; dur: number }[] // éclats de l'explosion
}

/** Tire un coup au hasard (position d'apogée, calibre, fumée, éclats). La fumée est semée AUX MÊMES
 *  coordonnées que le boulet — même courbe qu'en CSS — à l'instant où il passe. */
function makeWaterShot(i: number): WaterShot {
  const flight = 1.5 + Math.random() * 0.5 // s
  const dx = 9 + Math.random() * 13 // vh (vers le large, à droite du navire — sans sortir de la colonne)
  const dy = 55 + Math.random() * 20 // vh (assez pour éclater HAUT dans le ciel, au-dessus de l'île)
  return {
    delay: i * 0.72 + Math.random() * 0.3,
    flight,
    dx,
    dy,
    size: 0.8 + Math.random() * 0.5,
    grow: 1.5 + Math.random() * 0.6,
    puffs: Array.from({ length: WATER_TRAIL_PUFFS }, (_, k) => {
      const t = (k + 1) / (WATER_TRAIL_PUFFS + 1)
      return {
        t,
        x: dx * t, // vh
        y: dy * (1 - (1 - t) ** 2), // vh (ease-out quad, comme la courbe CSS du boulet)
        size: 1.3 + t * 2.4 + Math.random(), // vh (la fumée s'épaissit en s'étalant)
        drift: (Math.random() - 0.25) * 2.6, // vh (elle dérive avec le vent)
      }
    }),
    sparks: Array.from({ length: 8 }, (_, k) => {
      const ang = (k / 8) * Math.PI * 2 + Math.random() * 0.4
      const dist = 3 + Math.random() * 4
      return {
        sx: +(Math.cos(ang) * dist).toFixed(2), // vh
        sy: +(Math.sin(ang) * dist).toFixed(2), // vh
        dur: 0.6 + Math.random() * 0.45, // s
      }
    }),
  }
}

/** Décor « water » : une mer de nuit — des reflets de lune (traînées horizontales claires)
 *  ondulent (va-et-vient lent) et scintillent (opacité) sur l'eau, dans le bas de l'écran.
 *  Reflets tirés une fois au montage, animations en CSS (cf. `index.css`).
 *  Surprise : « la bordée » — le Jolly Roger canonne le ciel (cf. ci-dessus). (Capitaine Crochet) */
function WaterDecor({ side }: { side?: 'left' | 'right' }) {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
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
  // SURPRISE « la bordée » : `barrage` = la salve en cours (les coups tirés au hasard + un compteur
  // qui sert de clé React pour rejouer les animations). `null` = le canon se tait.
  const [barrage, setBarrage] = useState<{ run: number; shots: WaterShot[] } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setBarrage({ run: ++run, shots: Array.from({ length: WATER_SHOTS }, (_, i) => makeWaterShot(i)) })
      clear = setTimeout(() => setBarrage(null), WATER_BARRAGE_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(WATER_BARRAGE_GAP_MIN_MS + Math.random() * (WATER_BARRAGE_GAP_MAX_MS - WATER_BARRAGE_GAP_MIN_MS))
      }, delay)
    }
    schedule(WATER_BARRAGE_TEST ? 3000 : 55_000 + Math.random() * 45_000) // 1re salve : 55 s à 1 min 40
    // MODE TEST : déclenche la salve à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  // Bouche du canon = le Jolly Roger sur l'illustration de l'île (elle-même décalée côté joueur).
  const islandLeft = side === 'left' ? 10 : 1 // % (cf. `.water-island`)
  const muzzle = {
    left: `calc(${islandLeft}% + ${(WATER_SHIP_X * WATER_ISLAND_W_VH).toFixed(1)}vh)`,
    bottom: `calc(${WATER_ISLAND_BOTTOM_PCT}% + ${((1 - WATER_SHIP_Y) * WATER_ISLAND_H_VH).toFixed(1)}vh)`,
  }
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
      {/* SURPRISE « la bordée » : tout part de la BOUCHE du canon (le Jolly Roger dans le lagon) ;
          chaque coup place ses éléments par rapport à ce point. La clé React rejoue les animations
          CSS à chaque salve. */}
      {barrage && (
        <div className="water-barrage" key={barrage.run} style={muzzle}>
          {barrage.shots.map((s, i) => (
            <div key={i} className="water-shot">
              {/* L'éclair de bouche : la lueur qui claque au canon + son reflet étalé sur l'eau. */}
              <span className="water-muzzle" style={{ animationDelay: `${s.delay}s` }} />
              <span className="water-muzzle-water" style={{ animationDelay: `${s.delay}s` }} />
              {/* La fumée semée le long de l'arc : chaque bouffée éclot quand le boulet passe. */}
              {s.puffs.map((p, k) => (
                <span
                  key={`puff-${k}`}
                  className="water-trail"
                  style={{
                    left: `${p.x}vh`,
                    bottom: `${p.y}vh`,
                    width: `${p.size}vh`,
                    height: `${p.size}vh`,
                    animationDelay: `${(s.delay + p.t * s.flight).toFixed(2)}s`,
                    '--drift': `${p.drift}vh`,
                  } as CSSProperties}
                />
              ))}
              {/* LE BOULET : X linéaire (enveloppe) × Y décéléré (enfant) = arc de tir. */}
              <span
                className="water-ball-x"
                style={{ '--dx': `${s.dx}vh`, animationDuration: `${s.flight}s`, animationDelay: `${s.delay}s` } as CSSProperties}
              >
                <span
                  className="water-ball-y"
                  style={{ '--dy': `${s.dy}vh`, animationDuration: `${s.flight}s`, animationDelay: `${s.delay}s` } as CSSProperties}
                >
                  <span
                    className="water-ball"
                    style={{
                      width: `${s.size}vh`,
                      height: `${s.size}vh`,
                      animationDuration: `${s.flight}s, ${s.flight}s`,
                      animationDelay: `${s.delay}s, ${s.delay}s`,
                      '--grow': s.grow,
                    } as CSSProperties}
                  />
                </span>
              </span>
              {/* L'EXPLOSION à l'apogée : flash, bouffée de fumée qui gonfle, éclats projetés. */}
              <span className="water-burst" style={{ left: `${s.dx}vh`, bottom: `${s.dy}vh` }}>
                <span className="water-burst-flash" style={{ animationDelay: `${(s.delay + s.flight).toFixed(2)}s` }} />
                <span className="water-burst-smoke" style={{ animationDelay: `${(s.delay + s.flight).toFixed(2)}s` }} />
                {s.sparks.map((k, j) => (
                  <span
                    key={`spark-${j}`}
                    className="water-burst-spark"
                    style={{
                      animationDuration: `${k.dur}s`,
                      animationDelay: `${(s.delay + s.flight).toFixed(2)}s`,
                      '--sx': `${k.sx}vh`,
                      '--sy': `${k.sy}vh`,
                    } as CSSProperties}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Intervalle (ms) entre deux éclairs de la tempête de Davy Jones (timer aléatoire).
const FD_LIGHTNING_GAP_MIN_MS = 5000
const FD_LIGHTNING_GAP_MAX_MS = 13000

// Silhouette de vague tuilable (1 crête + 1 creux par tuile, viewBox 1440×320, étirée par
// `preserveAspectRatio=none`). Remplie d'un dégradé vertical (clair en crête → sombre au pied) pour
// donner du VOLUME à la vague. Auto-contenue (data-URI) → réutilisée en fond `repeat-x` qui défile.
const fdWaveSvg = (top: string, bottom: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320' preserveAspectRatio='none'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>` +
      `<stop offset='0' stop-color='${top}'/><stop offset='1' stop-color='${bottom}'/></linearGradient></defs>` +
      `<path fill='url(%23g)' d='M0,150 C240,70 480,70 720,150 C960,230 1200,230 1440,150 L1440,320 L0,320 Z'/>` +
      `</svg>`,
  )}")`

// Couches de vagues, du LOINTAIN (sombre, lent, haut) au PROCHE (clair, rapide, bas). Chaque couche
// défile horizontalement à sa vitesse (parallaxe → impression de houle/profondeur). `rev` inverse le
// sens d'une couche sur deux pour casser le défilement uniforme.
// La 1ʳᵉ couche est la LIGNE D'HORIZON : large et lente, posée à la hauteur de l'horizon (bottom ~27vh)
// et teintée comme la mer → sa crête qui ondule fait la séparation mer/ciel (plus de trait droit).
const FD_WAVE_LAYERS = [
  { top: '#1f5a4b', bot: '#123129', h: 7, bottom: 27, tile: 135, dur: 22, op: 1, rev: false },
  { top: '#1c4a40', bot: '#0a201c', h: 17, bottom: 0, tile: 92, dur: 15, op: 0.92, rev: false },
  { top: '#246055', bot: '#0e2a24', h: 14, bottom: 0, tile: 74, dur: 11, op: 0.95, rev: true },
  { top: '#2f7766', bot: '#123128', h: 11, bottom: 0, tile: 60, dur: 8, op: 1, rev: false },
] as const

// SURPRISE « Le Hollandais plonge ». Chronologie : la BRUME monte d'abord en fondu lent (10 s, navire
// en surface) → le navire COULE sous la ligne d'eau (clip, pas de fondu) → il REMONTE → puis la brume
// se DISSIPE lentement (10 s). Minuteur aléatoire (comme les autres décors). FD_DIVE_TEST → cadence
// rapide pour régler (à remettre false).
const FD_DIVE_TEST = false
const FD_DIVE_GAP_MIN_MS = FD_DIVE_TEST ? 4000 : 150000
const FD_DIVE_GAP_MAX_MS = FD_DIVE_TEST ? 9000 : 300000
const FD_MIST_IN_MS = 10000 // entrée lente de la brume (navire encore en surface)
const FD_DIVE_DOWN_MS = 3000 // descente sous les flots
const FD_DIVE_SUBMERGED_MS = 20000 // temps immergé avant de remonter (20 s)
const FD_DIVE_UP_MS = 3000 // émersion (remontée)
const FD_MIST_OUT_MS = 10000 // dissipation lente de la brume (navire de nouveau en surface)

// Gerbe d'écume de la plongée : gouttelettes qui jaillissent en éventail vers le haut (motif fixe,
// varié par l'index). dx en vw, dy en vh (négatif = vers le haut).
const FD_SPLASH_DROPS = Array.from({ length: 18 }, (_, i) => {
  const t = i / 17
  const ang = -Math.PI * (0.12 + 0.76 * t) // éventail de ~-22° à ~-155° (vers le haut, des 2 côtés)
  const dist = 7 + (i % 5) * 2.6
  return {
    dx: +(Math.cos(ang) * dist).toFixed(1), // vw
    dy: +(Math.sin(ang) * dist * 1.7).toFixed(1), // vh (négatif = monte)
    size: 0.8 + (i % 3) * 0.5, // vh
    delay: +((i % 6) * 0.04).toFixed(2), // s
    dur: +(0.75 + (i % 4) * 0.16).toFixed(2), // s
    op: 0.7 + (i % 3) * 0.1,
  }
})

// Brume de surface (pendant l'immersion) : nappes blanchâtres basses qui dérivent le long de la ligne
// d'eau. Réutilisent le keyframe `waterCloudDrift` (dérive latérale alternée). Motif fixe varié par index.
const FD_MIST_PUFFS = Array.from({ length: 15 }, (_, i) => ({
  left: -10 + (i / 14) * 120, // % (réparties d'un bord à l'autre, débordant légèrement)
  bottom: 9 + (i % 3) * 4, // vh (bande basse, à la surface)
  w: 40 + (i % 4) * 12, // vh (larges, recouvrement jusqu'aux côtés)
  h: 9 + (i % 3) * 4, // vh (aplaties)
  amp: 4 + (i % 4) * 2, // vw (dérive)
  dur: 16 + (i % 5) * 3, // s
  delay: -((i % 7) * 2.5), // s
}))

/** Décor « Hollandais Volant » de Davy Jones (Pirates des Caraïbes) : une mer démontée vue de nuit.
 *  Ciel d'orage vert-sarcelle, des couches de HOULE qui ondulent en bas de l'écran (crêtes d'écume),
 *  une TEMPÊTE de pluie battante diagonale (réutilise le modèle de `castleAssault`) avec voile d'orage
 *  et ÉCLAIRS verdâtres occasionnels, et le HOLLANDAIS VOLANT (image) qui tangue et roule au centre.
 *  Tous les paramètres aléatoires sont figés au montage ; l'animation est jouée en CSS (cf. index.css,
 *  section « Décor permanent : la mer de Davy Jones »). */
function FlyingDutchmanDecor({ decor }: { decor: Extract<VillainDecorData, { kind: 'flyingDutchman' }> }) {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Nuages d'orage : masses gris-vert basses et lourdes qui dérivent lentement dans le ciel (au-dessus
  // de l'horizon). Réutilisent le keyframe `waterCloudDrift` (dérive latérale alternée).
  const [clouds] = useState(() =>
    Array.from({ length: 12 }, () => ({
      left: Math.random() * 100, // %
      top: 2 + Math.random() * 46, // % (ciel, au-dessus de l'horizon ~69 %)
      w: 40 + Math.random() * 48, // vh (larges)
      h: 12 + Math.random() * 16, // vh (aplatis)
      op: 0.5 + Math.random() * 0.45,
      amp: 5 + Math.random() * 12, // vw (dérive latérale)
      dur: 26 + Math.random() * 24, // s (lent)
      delay: -(Math.random() * 50), // s
    })),
  )
  // Houle : larges traînées vert-sarcelle qui ondulent (sway) et scintillent (opacité) sur l'eau.
  const [swells] = useState(() =>
    Array.from({ length: 9 }, () => ({
      left: Math.random() * 100, // %
      top: 66 + Math.random() * 30, // % (la mer occupe le bas)
      w: 45 + Math.random() * 50, // vh (larges)
      h: 2.5 + Math.random() * 5, // vh
      op: 0.08 + Math.random() * 0.14,
      sway: 4 + Math.random() * 6, // vw
      swayDur: 6 + Math.random() * 5, // s
      shimDur: 4 + Math.random() * 3.5, // s
      delay: -(Math.random() * 12), // s
    })),
  )
  // Crêtes d'écume : petites bandes blanches qui apparaissent et s'effacent sur la houle.
  const [foam] = useState(() =>
    Array.from({ length: 16 }, () => ({
      left: Math.random() * 100, // %
      top: 70 + Math.random() * 26, // %
      w: 6 + Math.random() * 14, // vh
      sway: 2 + Math.random() * 4, // vw
      swayDur: 4 + Math.random() * 3, // s
      fadeDur: 2.5 + Math.random() * 3, // s
      delay: -(Math.random() * 8), // s
    })),
  )
  // Pluie battante : traits fins diagonaux qui tombent vite (réutilise le keyframe `caRain`).
  const [rain] = useState(() =>
    Array.from({ length: 160 }, () => ({
      left: Math.random() * 100, // %
      len: 7 + Math.random() * 13, // vh
      dur: 0.4 + Math.random() * 0.45, // s (chute rapide)
      delay: -(Math.random() * 1.2), // s
      op: 0.16 + Math.random() * 0.34,
      thick: 0.8 + Math.random() * 1, // px
    })),
  )
  // Embruns qui s'élèvent de la houle (gouttelettes claires qui montent et retombent).
  const [spray] = useState(() =>
    Array.from({ length: 22 }, () => ({
      left: Math.random() * 100, // %
      size: 1 + Math.random() * 2.5, // px
      dur: 2.6 + Math.random() * 2.4, // s
      delay: -(Math.random() * 6), // s
      drift: (Math.random() - 0.5) * 8, // vw
      op: 0.3 + Math.random() * 0.4,
    })),
  )
  // Éclair : compteur incrémenté à intervalle aléatoire ; le calque (monté avec key={flash}) rejoue
  // son animation de flash à chaque incrément (même mécanique que `castleAssault`). Sur son propre
  // minuteur (l'éclair n'est PAS la surprise — la surprise est la plongée du navire).
  const [flash, setFlash] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    const schedule = () => {
      next = setTimeout(() => {
        setFlash((f) => f + 1)
        schedule()
      }, FD_LIGHTNING_GAP_MIN_MS + Math.random() * (FD_LIGHTNING_GAP_MAX_MS - FD_LIGHTNING_GAP_MIN_MS))
    }
    schedule()
    return () => clearTimeout(next)
  }, [])
  // SURPRISE « Le Hollandais plonge » : phase de l'animation + gerbe d'écume. Séquence :
  // misting-in (brume monte 10 s, navire en surface) → diving (coule) → submerged → surfacing (remonte)
  // → misting-out (brume se dissipe 10 s, navire en surface) → idle. Pas de fondu du navire : il passe
  // sous la ligne d'eau (clip) et revient au même endroit.
  type FdPhase = 'idle' | 'misting-in' | 'diving' | 'submerged' | 'surfacing' | 'misting-out'
  const [shipPhase, setShipPhase] = useState<FdPhase>('idle')
  const [splash, setSplash] = useState(0) // incrémenté pour rejouer la gerbe (plongée + émersion)
  const phaseRef = useRef<FdPhase>('idle')
  const setPhase = (p: FdPhase) => {
    phaseRef.current = p
    setShipPhase(p)
  }
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let timers: ReturnType<typeof setTimeout>[] = []
    const dive = () => {
      if (phaseRef.current !== 'idle') return // pas de nouvelle plongée pendant une plongée
      setPhase('misting-in') // 1) la brume monte en fondu lent (navire encore en surface)
      timers.push(
        setTimeout(() => {
          setPhase('diving') // 2) le navire coule sous la ligne d'eau
          setSplash((s) => s + 1) // gerbe d'écume au moment où il s'enfonce
          timers.push(
            setTimeout(() => {
              setPhase('submerged') // 3) immergé un court instant
              timers.push(
                setTimeout(() => {
                  setPhase('surfacing') // 4) il remonte
                  setSplash((s) => s + 1) // gerbe d'écume à l'émersion
                  timers.push(
                    setTimeout(() => {
                      setPhase('misting-out') // 5) la brume se dissipe lentement
                      timers.push(setTimeout(() => setPhase('idle'), FD_MIST_OUT_MS))
                    }, FD_DIVE_UP_MS),
                  )
                }, FD_DIVE_SUBMERGED_MS),
              )
            }, FD_DIVE_DOWN_MS),
          )
        }, FD_MIST_IN_MS),
      )
    }
    const schedule = () => {
      timers.push(
        setTimeout(() => {
          dive()
          schedule()
        }, FD_DIVE_GAP_MIN_MS + Math.random() * (FD_DIVE_GAP_MAX_MS - FD_DIVE_GAP_MIN_MS)),
      )
    }
    schedule()
    fireRef.current = dive // MODE TEST : déclenche une plongée à la demande.
    return () => {
      timers.forEach(clearTimeout)
      timers = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="fd-decor" aria-hidden>
      {/* Plan de mer (bas de l'écran) : sa crête est la ligne d'horizon (séparation mer/ciel). */}
      <div className="fd-sea" />
      {/* Voile d'orage froid (bleuté en haut, vignette en bas). */}
      <div className="fd-storm" />
      {/* Nuages d'orage qui dérivent dans le ciel (au-dessus de l'horizon). */}
      {clouds.map((c, i) => (
        <span
          key={`cloud-${i}`}
          className="fd-cloud"
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
      {/* Vagues : couches de silhouettes ondulées qui défilent en parallaxe (la mer démontée). */}
      {FD_WAVE_LAYERS.map((w, i) => (
        <div
          key={`wave-${i}`}
          className="fd-wave"
          style={{
            height: `${w.h}vh`,
            bottom: `${w.bottom}vh`,
            opacity: w.op,
            backgroundImage: fdWaveSvg(w.top, w.bot),
            backgroundSize: `${w.tile}vh 100%`,
            animationDuration: `${w.dur}s`,
            animationDirection: w.rev ? 'reverse' : 'normal',
            '--tile': `${w.tile}vh`,
          } as CSSProperties}
        />
      ))}
      {/* Houle : larges traînées qui ondulent et scintillent. */}
      {swells.map((g, i) => (
        <span
          key={`swell-${i}`}
          className="fd-swell"
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
      {/* Crêtes d'écume sur la houle. */}
      {foam.map((f, i) => (
        <span
          key={`foam-${i}`}
          className="fd-foam"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: `${f.w}vh`,
            animationDuration: `${f.swayDur}s, ${f.fadeDur}s`,
            animationDelay: `${f.delay}s, ${f.delay}s`,
            '--sway': `${f.sway}vw`,
          } as CSSProperties}
        />
      ))}
      {/* Embruns qui montent de la mer. */}
      {spray.map((s, i) => (
        <span
          key={`spray-${i}`}
          className="fd-spray"
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
      {/* Le Hollandais Volant. Posé APRÈS les vagues → au PREMIER PLAN, mais AVANT la pluie → la pluie
          tombe devant lui. Le STAGE clippe à la ligne de flottaison (overflow hidden) : quand le navire
          COULE (translateY vers le bas via `fd-ship-sink`), il passe sous ce bord et disparaît sans
          fondu. L'image porte le tangage continu. */}
      <div className="fd-ship-stage">
        <div
          className={`fd-ship-sink${shipPhase === 'diving' ? ' is-diving' : shipPhase === 'submerged' ? ' is-submerged' : shipPhase === 'surfacing' ? ' is-surfacing' : ''}`}
        >
          <img className="fd-ship" src={decor.ship} alt="" />
        </div>
      </div>
      {/* Brume de surface : nappes blanchâtres basses qui dérivent le long de la ligne d'eau. Présente
          de l'entrée de brume jusqu'à sa dissipation ; entre en fondu (is-entering), reste pleine, puis
          se dissipe (is-clearing). */}
      {shipPhase !== 'idle' && (
        <div className={`fd-mist${shipPhase === 'misting-in' ? ' is-entering' : shipPhase === 'misting-out' ? ' is-clearing' : ''}`}>
          {FD_MIST_PUFFS.map((m, i) => (
            <span
              key={`mist-${i}`}
              className="fd-mist-puff"
              style={{
                left: `${m.left}%`,
                bottom: `${m.bottom}vh`,
                width: `${m.w}vh`,
                height: `${m.h}vh`,
                animationDuration: `${m.dur}s`,
                animationDelay: `${m.delay}s`,
                '--amp': `${m.amp}vw`,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
      {/* Gerbe d'écume de la plongée/émersion (rejouée à chaque incrément de `splash`). */}
      {splash > 0 && (
        <div className="fd-splash" key={splash}>
          {FD_SPLASH_DROPS.map((d, i) => (
            <span
              key={`drop-${i}`}
              className="fd-splash-drop"
              style={{
                width: `${d.size}vh`,
                height: `${d.size}vh`,
                animationDuration: `${d.dur}s`,
                animationDelay: `${d.delay}s`,
                '--dx': `${d.dx}vw`,
                '--dy': `${d.dy}vh`,
                '--op': d.op,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
      {/* Pluie battante diagonale. */}
      <div className="fd-rain">
        {rain.map((r, i) => (
          <span
            key={`rain-${i}`}
            className="fd-raindrop"
            style={{
              left: `${r.left}%`,
              width: `${r.thick}px`,
              height: `${r.len}vh`,
              opacity: r.op,
              animationDuration: `${r.dur}s`,
              animationDelay: `${r.delay}s`,
            }}
          />
        ))}
      </div>
      {/* Éclair verdâtre (rejoué à chaque incrément de `flash`). */}
      <div className="fd-lightning" key={flash} />
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
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
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
    // MODE TEST : déclenche l'invasion d'encre à la demande.
    fireRef.current = () => {
      setInking(true)
      clear = setTimeout(() => setInking(false), INK_MS)
    }
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
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
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
    // MODE TEST : déclenche l'invocation à la demande.
    fireRef.current = () => {
      setSummoning(true)
      end = setTimeout(() => setSummoning(false), SUMMON_MS)
    }
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
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Préchargement des images d'averse (étoile + 6 fragments) au montage : sinon, au 1ᵉʳ
  // déclenchement, les images jamais affichées se décodent en direct et « popent » à l'écran.
  useEffect(() => {
    for (const src of ['/animations/star.png', ...FRAGMENT_IMAGES]) {
      const img = new Image()
      img.src = src
    }
  }, [])
  // Champ d'étoiles : points bleus/blancs qui scintillent (taille/teinte/cadence variées).
  // Nombre volontairement modéré : un champ plein écran reste très dense à ~400, et CHAQUE
  // étoile est un élément animé (twinkle) — au-delà, le coût de compositing explose sans gain
  // visuel. Cf. `.galaxy-star` (index.css) qui, pour la même raison, n'utilise PAS `will-change`.
  const [stars] = useState(() =>
    Array.from({ length: 400 }, () => {
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
    const fire = fireRef.current = () => {
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

/** Décor « image » : une simple image d'arrière-plan fixe affichée en plein cadre (`cover`, centrée).
 *  Base sobre et générique (cf. Scar, dont le décor repart de `background_scar.jpg`) ; des couches
 *  animées pourront être ajoutées par-dessus par la suite. */
function ImageDecor({ decor }: { decor: Extract<VillainDecorData, { kind: 'image' }> }) {
  return (
    <div
      className="image-decor"
      style={{ backgroundImage: `url(${decor.src})` }}
      aria-hidden
    />
  )
}


// Animation SURPRISE des jets de fumée de Scar : ils n'apparaissent que par bouffées (cf. ScarDecor).
// `SCAR_JET_DURATION_MS` = durée d'une bouffée ; l'intervalle entre deux bouffées est aléatoire
// (`SCAR_JET_GAP_MIN/MAX_MS`). MODE TEST : à `true`, bouffées fréquentes (toutes les ~10 s) pour régler.
const SCAR_JET_TEST = false
const SCAR_JET_DURATION_MS = 5000 // durée d'une bouffée de jets
const SCAR_JET_GAP_MIN_MS = SCAR_JET_TEST ? 10000 : 120000 // 10 s en test, sinon 2 min
const SCAR_JET_GAP_MAX_MS = SCAR_JET_TEST ? 10000 : 240000 // 10 s en test, sinon 4 min

/** Décor « scar » (Le Roi Lion) : l'image de fond `background_scar.jpg` (rendu `image`) surmontée de
 *  plusieurs couches qui recréent le cimetière des éléphants de « Soyez prêtes » —
 *   • GEYSERS de vapeur verte qui jaillissent d'évents au sol et montent en s'enroulant (`vaporRise`) ;
 *   • RAYONS de lumière verte qui filtrent d'en haut et vacillent (enveloppe = balancement, enfant = flicker) ;
 *   • BRAISES vertes qui s'élèvent en scintillant ;
 *   • LUEUR verte malsaine qui palpite par en-dessous + VIGNETTE qui assombrit les coins ;
 *   • ÉRUPTION ponctuelle (minuterie) : un évent crache un gros panache + un flash vert (pyrotechnies) ;
 *   • YEUX luisants (hyènes / crâne) qui s'allument et clignent dans l'ombre.
 *  Éléments tirés une fois au montage ; animations en CSS (cf. index.css, section « Scar »). */
function ScarDecor({ decor }: { decor: Extract<VillainDecorData, { kind: 'scar' }> }) {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Geysers : évents fixes au sol émettant chacun une colonne continue de vapeur verte (bouffées
  // étagées dans le temps → flux régulier qui s'enroule en montant).
  const [puffs] = useState(() => {
    const vents = Array.from({ length: 5 }, () => ({
      left: 8 + Math.random() * 84, // % (répartis sur la largeur)
      base: 16 + Math.random() * 14, // vh (taille de base des bouffées de cet évent)
    }))
    return vents.flatMap((v, vi) => {
      const n = 6 + Math.floor(Math.random() * 3) // 6–8 bouffées par évent
      const dur = 9 + Math.random() * 6 // s (montée, commune à l'évent → cadence régulière)
      return Array.from({ length: n }, (_, i) => ({
        key: `${vi}-${i}`,
        left: v.left + (Math.random() - 0.5) * 6, // % (léger éparpillement)
        size: v.base * (0.7 + Math.random() * 0.7), // vh
        dur,
        delay: -((i / n) * dur) - Math.random() * 1.5, // s (étagées → flux continu)
        sx: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5), // vw (enroulement latéral)
        op: 0.4 + Math.random() * 0.32, // opacité de pointe
      }))
    })
  })
  // Six JETS de fumée verte PUISSANTS (haute pression) qui fusent du bas de l'écran, répartis
  // régulièrement sur la largeur : chaque évent crache une colonne dense de bouffées étagées, fine et fulgurante.
  const [jets] = useState(() => {
    const vents = [
      { left: 9 + (Math.random() - 0.5) * 5 }, // %
      { left: 25 + (Math.random() - 0.5) * 5 }, // %
      { left: 42 + (Math.random() - 0.5) * 5 }, // %
      { left: 58 + (Math.random() - 0.5) * 5 }, // %
      { left: 75 + (Math.random() - 0.5) * 5 }, // %
      { left: 91 + (Math.random() - 0.5) * 5 }, // % (6 jets répartis régulièrement)
    ]
    return vents.flatMap((v, vi) => {
      const dur = 0.95 + Math.random() * 0.25 // s (montée FULGURANTE = très forte pression)
      const base = 11 + Math.random() * 4 // vh (bouffées FINES)
      // Fenêtre d'ÉMISSION : on lance des bouffées (à un coup) pendant EMIT s, puis plus rien ; les
      // dernières finissent leur montée avant le démontage → ni pop au début, ni coupure à la fin.
      const EMIT = 3.6 // s (émission ; EMIT + dur doit rester < SCAR_JET_DURATION_MS/1000)
      const n = 60 // bouffées émises sur la fenêtre (densité de la colonne)
      return Array.from({ length: n }, (_, i) => ({
        key: `${vi}-${i}`,
        left: v.left + (Math.random() - 0.5) * 2, // % (très resserré → jet fin et net)
        size: base * (0.75 + Math.random() * 0.5), // vh
        dur,
        delay: (i / n) * EMIT + Math.random() * 0.06, // s (POSITIFS étalés sur la fenêtre → arrive par le bas ET les dernières finissent)
        sx: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2), // vw (enroulement minime → reste une colonne fine)
        op: 0.6 + Math.random() * 0.3, // opacité de pointe (bien dense)
      }))
    })
  })
  // Bouffée SURPRISE : les jets ne sont montés que pendant `SCAR_JET_DURATION_MS`, puis retirés ; on
  // reprogramme la suivante après un intervalle aléatoire (cf. SCAR_JET_* ; désactivé en reduced-motion).
  const [jetsOn, setJetsOn] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let off: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const gap = () => SCAR_JET_GAP_MIN_MS + Math.random() * (SCAR_JET_GAP_MAX_MS - SCAR_JET_GAP_MIN_MS)
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        setJetsOn(true)
        off = setTimeout(() => {
          setJetsOn(false)
          schedule(gap())
        }, SCAR_JET_DURATION_MS)
      }, delay)
    }
    schedule(gap())
    return () => {
      clearTimeout(next)
      clearTimeout(off)
    }
  }, [])
  // Rayons de lumière verte qui descendent des hauteurs (la lumière qui filtre entre les piliers de
  // roche), vacillant en opacité et oscillant légèrement.
  const [rays] = useState(() =>
    Array.from({ length: 9 }, () => ({
      left: Math.random() * 100, // %
      width: 0.8 + Math.random() * 3, // vw (faisceaux d'épaisseurs variées)
      height: 55 + Math.random() * 45, // % (descendent plus ou moins bas)
      op: 0.1 + Math.random() * 0.22, // discrets
      flickDur: 3 + Math.random() * 5, // s (vacillement)
      flickDelay: -(Math.random() * 8), // s
      sway: 0.5 + Math.random() * 1.5, // vw (léger balancement)
      swayDur: 7 + Math.random() * 6, // s
    })),
  )
  // Braises vertes spectrales qui montent du bas en scintillant.
  const [sparks] = useState(() =>
    Array.from({ length: 24 }, () => ({
      left: Math.random() * 100, // %
      size: 1.4 + Math.random() * 2.4, // px
      dur: 5 + Math.random() * 5, // s (montée)
      delay: -(Math.random() * 10), // s
      drift: (Math.random() - 0.5) * 8, // vw (dérive latérale)
      op: 0.5 + Math.random() * 0.4,
    })),
  )
  // Éruption ponctuelle : à intervalle aléatoire, un évent crache un GROS panache vert (plusieurs
  // bouffées jouées une fois) + un flash, puis se dissipe. On (dé)monte le calque le temps de l'effet.
  const [erupt, setErupt] = useState<{ seq: number; left: number; plumes: { key: string; size: number; dur: number; delay: number; sx: number; op: number }[] } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const fire = fireRef.current = () => {
      const left = 15 + Math.random() * 70 // % (évent qui entre en éruption)
      const n = 9
      const plumes = Array.from({ length: n }, (_, i) => ({
        key: `${seq}-${i}`,
        size: 18 + Math.random() * 16, // vh (gros panache)
        dur: 2 + Math.random() * 1, // s (montée vigoureuse)
        delay: (i / n) * 0.9 + Math.random() * 0.2, // s (jets successifs)
        sx: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 7), // vw
        op: 0.55 + Math.random() * 0.3,
      }))
      setErupt({ seq: seq++, left, plumes })
      clear = setTimeout(() => setErupt(null), 3400) // durée totale de l'éruption
      next = setTimeout(fire, 26000 + Math.random() * 16000) // 26–42 s entre deux éruptions
    }
    next = setTimeout(fire, 8000 + Math.random() * 8000) // première éruption après 8–16 s
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className="scar-decor" aria-hidden>
      {/* Image de fond (réutilise le rendu générique `image`). */}
      <ImageDecor decor={{ kind: 'image', src: decor.src }} />
      {/* Lueur verte malsaine qui palpite par en-dessous (la source des évents). */}
      <div className="scar-glow" />
      {/* Vignette : assombrit les coins (placée sous les couches lumineuses pour ne pas les ternir). */}
      <div className="scar-vignette" />
      {/* Rayons de lumière verte : enveloppe = balancement latéral ; enfant = vacillement d'opacité. */}
      {rays.map((r, i) => (
        <span
          key={`ray-${i}`}
          className="scar-ray-sway"
          style={{
            left: `${r.left}%`,
            width: `${r.width}vw`,
            height: `${r.height}%`,
            animationDuration: `${r.swayDur}s`,
            '--sway': `${r.sway}vw`,
          } as CSSProperties}
        >
          <span
            className="scar-ray"
            style={{
              opacity: r.op,
              animationDuration: `${r.flickDur}s`,
              animationDelay: `${r.flickDelay}s`,
            }}
          />
        </span>
      ))}
      {/* Geysers de vapeur verte qui jaillissent du sol et montent en s'enroulant. */}
      {puffs.map((p) => (
        <span
          key={`geyser-${p.key}`}
          className="scar-geyser"
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
      {/* SURPRISE : bouffée des 6 jets de fumée verte (montée fulgurante), montée seulement pendant
          SCAR_JET_DURATION_MS toutes les quelques minutes (cf. effet jetsOn). */}
      {jetsOn && jets.map((j) => (
        <span
          key={`jet-${j.key}`}
          className="scar-jet"
          style={{
            left: `${j.left}%`,
            width: `${j.size}vh`,
            height: `${j.size}vh`,
            animationDuration: `${j.dur}s`,
            animationDelay: `${j.delay}s`,
            '--sx': `${j.sx}vw`,
            '--vop': j.op,
          } as CSSProperties}
        />
      ))}
      {/* Éruption ponctuelle : flash + gros panache vert (montée jouée une fois). */}
      {erupt && (
        <div className="scar-eruption" style={{ left: `${erupt.left}%` }}>
          <span className="scar-flash" />
          {/* Fond vert au pied de l'éruption : comble la base pour ne pas avoir un vide sous les panaches. */}
          <span className="scar-erupt-base" />
          {erupt.plumes.map((p) => (
            <span
              key={`erupt-${p.key}`}
              className="scar-erupt"
              style={{
                width: `${p.size}vh`,
                height: `${p.size}vh`,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
                '--sx': `${p.sx}vw`,
                '--vop': p.op,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
      {/* Braises vertes qui montent en scintillant. */}
      {sparks.map((s, i) => (
        <span
          key={`spark-${i}`}
          className="scar-spark"
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
    </div>
  )
}

// Couleurs des potions de Yzma : magenta, cyan, vert acide, orange, violet, rose — des teintes vives
// et variées (l'étagère de fioles bariolées de son laboratoire).
const YZMA_COLORS = ['#d11ad1', '#1ad1c4', '#7cfc00', '#ff7a1a', '#b026ff', '#ff2d7a']

// Surprise « Pull the lever, Kronk ! » : une potion explose en un nuage de fumée de transformation
// multicolore (cf. YzmaDecor). `..._DURATION_MS` = durée d'une explosion ; intervalle aléatoire entre deux
// (`..._GAP_MIN/MAX_MS`). MODE TEST : à `true`, explosions fréquentes (~10 s) pour régler.
const YZMA_BOOM_TEST = false
const YZMA_BOOM_DURATION_MS = 4200 // durée d'une explosion (double boom : 2e foyer décalé + bouffée + onde + marge)
const YZMA_BOOM_GAP_MIN_MS = YZMA_BOOM_TEST ? 10000 : 60000 // 10 s en test, sinon 1 min
const YZMA_BOOM_GAP_MAX_MS = YZMA_BOOM_TEST ? 10000 : 60000 // 10 s en test, sinon 1 min

// Surprise « Yzma transformée en CHAT » : une grosse fumée noire monte du bas du plateau, se dissipe et
// révèle le chat (image `cat_yzma`) avec un « ? », qui prend un temps puis DÉTALE vers la gauche. `..._STEP_MS`
// = repères de la séquence (cf. YzmaDecor) ; intervalle aléatoire entre deux (`..._GAP_MIN/MAX_MS`).
const YZMA_CAT_TEST = false
const YZMA_CAT_DURATION_MS = 18300 // durée totale (fumée ~9 s → révélation → arrêt → fuite complète) + marge de démontage
const YZMA_CAT_GAP_MIN_MS = YZMA_CAT_TEST ? 21000 : 180000 // 21 s en test (> durée scène), sinon 3 min
const YZMA_CAT_GAP_MAX_MS = YZMA_CAT_TEST ? 21000 : 300000 // 21 s en test (> durée scène), sinon 5 min

// Images des fioles baladeuses de Yzma (ratio largeur/hauteur pour une largeur stable + facteur de taille
// par image : la potion_yzma plus grande, la potion_neutre plus petite).
const YZMA_VIAL_IMAGES = [
  { src: '/animations/potion_yzma.png', aspect: 334 / 450, scale: 1.25 }, // flacon vertical (plus grand)
  { src: '/animations/potion_neutre.png', aspect: 887 / 469, scale: 0.6 }, // flacon horizontal rose (plus petit)
]

/** Une fiole de potion qui SE BALADE en rebondissant sur les bords du conteneur (façon écran de veille
 *  Windows), en TOURNANT lentement pendant le déplacement, nimbée d'un halo coloré qui pulse. Position
 *  pilotée en requestAnimationFrame (UI, pas le moteur) ; `speed` en % de la plus petite dimension / s
 *  → vitesse constante quel que soit l'écran. En reduced-motion : placée au centre, immobile. */
function YzmaVial({ img }: { img: { src: string; aspect: number; scale: number } }) {
  const [v] = useState(() => ({
    size: (8 + Math.random() * 4) * img.scale, // vh (hauteur du flacon × facteur de taille de l'image)
    lean: 2 + Math.random() * 4, // deg (tangage léger)
    leanDur: 5 + Math.random() * 3, // s
    glow: YZMA_COLORS[Math.floor(Math.random() * YZMA_COLORS.length)], // halo coloré
    glowDur: 3.5 + Math.random() * 2.5, // s
    speed: 6 + Math.random() * 5, // % / s (vitesse de la balade)
    dir: Math.random() * Math.PI * 2, // rad (direction initiale)
    spinDur: 14 + Math.random() * 12, // s (rotation lente pendant le déplacement)
    spinDir: Math.random() < 0.5 ? 1 : -1, // sens de rotation
  }))
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    const box = el?.parentElement // .yzma-decor
    if (!el || !box) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.style.transform = `translate(${(box.clientWidth - el.offsetWidth) / 2}px, ${(box.clientHeight - el.offsetHeight) / 2}px)`
      return
    }
    let x = Math.random() * Math.max(1, box.clientWidth - el.offsetWidth)
    let y = Math.random() * Math.max(1, box.clientHeight - el.offsetHeight)
    const px = (Math.min(box.clientWidth, box.clientHeight) * v.speed) / 100 / 1000 // px/ms
    let vx = Math.cos(v.dir) * px
    let vy = Math.sin(v.dir) * px
    let raf = 0
    let last = 0
    const step = (t: number) => {
      const dt = last ? Math.min(t - last, 50) : 0 // ms (borné : évite un grand saut au retour d'onglet)
      last = t
      const W = box.clientWidth
      const H = box.clientHeight
      const w = el.offsetWidth
      const h = el.offsetHeight
      x += vx * dt
      y += vy * dt
      if (x <= 0) { x = 0; vx = Math.abs(vx) } else if (x >= W - w) { x = W - w; vx = -Math.abs(vx) }
      if (y <= 0) { y = 0; vy = Math.abs(vy) } else if (y >= H - h) { y = H - h; vy = -Math.abs(vy) }
      el.style.transform = `translate(${x}px, ${y}px)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [v])
  return (
    <span ref={ref} className="yzma-vial-roam">
      <span
        className="yzma-vial-glow"
        style={{
          width: `${v.size * 0.95}vh`,
          height: `${v.size * 0.95}vh`,
          background: `radial-gradient(circle, ${v.glow} 0%, ${v.glow}00 70%)`,
          animationDuration: `${v.glowDur}s`,
        }}
      />
      {/* Wrapper = rotation lente pendant le déplacement ; l'image = tangage léger (lean). */}
      <span className="yzma-vial-spin" style={{ animationDuration: `${v.spinDur}s`, '--spin-dir': v.spinDir } as CSSProperties}>
        <img
          src={img.src}
          alt=""
          className="yzma-vial"
          draggable={false}
          style={{
            height: `${v.size}vh`,
            width: `${v.size * img.aspect}vh`, // largeur d'après le ratio de l'image
            animationDuration: `${v.leanDur}s`,
            '--lean': `${v.lean}deg`,
          } as CSSProperties}
        />
      </span>
    </span>
  )
}

/** Décor « yzma » (Kuzco, l'empereur mégalo) : le laboratoire secret de potions de Yzma — une pénombre
 *  de pierre violacée, une lueur magenta qui pulse par en-dessous, des BULLES multicolores qui montent
 *  en ondulant et des VOLUTES de vapeur colorées qui s'élèvent des évents, le tout vignetté ; 5 fioles de
 *  potion qui SE BALADENT en rebondissant sur les bords (écran de veille, pilotées en JS) ; et par moments
 *  une SURPRISE « Pull the lever » : une potion explose en un nuage de fumée de transformation multicolore.
 *  Éléments tirés une fois au montage ; animations CSS (cf. index.css) sauf la balade (requestAnimationFrame). */
function YzmaDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Bulles multicolores qui montent du fond en ondulant (enveloppe = montée, milieu = ondulation,
  // pastille = la bulle colorée). Schéma nesté de la poussière d'or / des motes vaudou.
  const [bubbles] = useState(() =>
    Array.from({ length: 44 }, (_, i) => ({
      left: Math.random() * 100, // %
      size: 0.9 + Math.random() * 2.6, // vh
      dur: 8 + Math.random() * 8, // s (montée lente)
      delay: -(Math.random() * 16), // s (flux continu, déphasé)
      sway: 1.5 + Math.random() * 3.5, // vw (ondulation latérale)
      swayDur: 2.6 + Math.random() * 2.4, // s
      op: 0.45 + Math.random() * 0.4, // opacité de pointe
      color: YZMA_COLORS[i % YZMA_COLORS.length],
    })),
  )
  // Volutes de vapeur colorées : quelques ÉVENTS au fond crachent des bouffées étagées qui montent en
  // s'enroulant (réutilise le keyframe `vaporRise`). Chaque évent a sa couleur.
  const [wisps] = useState(() => {
    const vents = Array.from({ length: 5 }, (_, i) => ({
      left: 10 + Math.random() * 80, // %
      base: 13 + Math.random() * 10, // vh (taille de base des bouffées)
      color: YZMA_COLORS[i % YZMA_COLORS.length],
    }))
    return vents.flatMap((v, vi) => {
      const n = 6 + Math.floor(Math.random() * 3) // 6–8 bouffées par évent
      const dur = 10 + Math.random() * 6 // s (montée, commune à l'évent → cadence régulière)
      return Array.from({ length: n }, (_, i) => ({
        key: `${vi}-${i}`,
        left: v.left + (Math.random() - 0.5) * 6, // %
        size: v.base * (0.7 + Math.random() * 0.7), // vh
        dur,
        delay: -((i / n) * dur) - Math.random() * 1.5, // s (étagées → flux continu)
        sx: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 5), // vw (enroulement)
        op: 0.25 + Math.random() * 0.22, // opacité de pointe (diffuse)
        color: v.color,
      }))
    })
  })
  // Étape 2 — FIOLES BALADEUSES : 5 flacons de potion (images `potion_yzma` / `potion_neutre`) se
  // baladent en rebondissant sur les bords (façon écran de veille), en tournant lentement et nimbés
  // d'un halo. Chaque fiole est un `YzmaVial` autonome (son propre rAF) — cf. le composant plus haut.
  // SURPRISE « Pull the lever » : à intervalle aléatoire, une potion explose à un endroit au hasard en un
  // nuage de fumée de transformation (flash + onde + bouffées colorées qui giclent). Calque (dé)monté le
  // temps de l'effet → les animations à un coup jouent une fois. Désactivé en reduced-motion.
  const [boom, setBoom] = useState<{
    seq: number
    blasts: {
      key: string
      left: number
      top: number
      delay: number
      puffs: { key: string; size: number; dx: number; dy: number; dur: number; delay: number; op: number; color: string }[]
    }[]
  } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () => YZMA_BOOM_GAP_MIN_MS + Math.random() * (YZMA_BOOM_GAP_MAX_MS - YZMA_BOOM_GAP_MIN_MS)
    // Un foyer d'explosion : une origine (left/top) + un nuage de bouffées colorées qui giclent en radial.
    const makeBlast = (bi: number, seqId: number, delay: number) => {
      const n = 14
      const puffs = Array.from({ length: n }, (_, i) => {
        const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4 // réparties en cercle (+ jitter)
        const dist = 12 + Math.random() * 22 // vh (distance d'éjection radiale)
        return {
          key: `${seqId}-${bi}-${i}`,
          size: 8 + Math.random() * 10, // vh
          dx: Math.cos(ang) * dist, // vh
          dy: Math.sin(ang) * dist, // vh
          dur: 1.4 + Math.random() * 1, // s
          delay: Math.random() * 0.5, // s (le nuage « bouillonne » en plusieurs jets)
          op: 0.5 + Math.random() * 0.35,
          color: YZMA_COLORS[Math.floor(Math.random() * YZMA_COLORS.length)],
        }
      })
      return { key: `${seqId}-${bi}`, left: 22 + Math.random() * 56, top: 26 + Math.random() * 48, delay, puffs }
    }
    const fire = fireRef.current = () => {
      // DOUBLE BOOM : deux foyers à des endroits différents, le second décalé d'un court instant.
      const s = seq++
      const blasts = [makeBlast(0, s, 0), makeBlast(1, s, 0.45 + Math.random() * 0.4)]
      setBoom({ seq: s, blasts })
      clear = setTimeout(() => setBoom(null), YZMA_BOOM_DURATION_MS)
      next = setTimeout(fire, gap())
    }
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  // SURPRISE « Yzma en chat » : à intervalle aléatoire, une grosse fumée noire monte du bas du plateau, se
  // dissipe et révèle le chat (avec un « ? »), qui marque un temps puis DÉTALE vers la gauche. Calque
  // (dé)monté le temps de la scène → les animations à un coup jouent une fois. Désactivé en reduced-motion.
  const [cat, setCat] = useState<{
    seq: number
    puffs: { key: string; left: number; size: number; sx: number; sx2: number; delay: number; op: number }[]
  } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () => YZMA_CAT_GAP_MIN_MS + Math.random() * (YZMA_CAT_GAP_MAX_MS - YZMA_CAT_GAP_MIN_MS)
    const fire = fireRef.current = () => {
      const s = seq++
      // Grosse fumée noire DENSE : beaucoup de grosses bouffées qui montent du bas-centre en s'évasant et
      // recouvrent entièrement le chat, puis se dissipent (le révèlent).
      const puffs = Array.from({ length: 26 }, (_, i) => ({
        key: `${s}-${i}`,
        left: 50 + (Math.random() - 0.5) * 48, // % (large, autour du centre-bas)
        size: 26 + Math.random() * 26, // vh (TRÈS grosses bouffées)
        sx: (Math.random() - 0.5) * 12, // vw (dérive en montant)
        sx2: (Math.random() - 0.5) * 28, // vw (dérive finale)
        delay: Math.random() * 0.5, // s
        op: 0.88 + Math.random() * 0.12,
      }))
      setCat({ seq: s, puffs })
      clear = setTimeout(() => setCat(null), YZMA_CAT_DURATION_MS)
      next = setTimeout(fire, gap())
    }
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className="yzma-decor" aria-hidden>
      {/* Lueur magenta qui pulse par en-dessous (les potions au fond). */}
      <div className="yzma-glow" />
      {/* Volutes de vapeur colorées qui montent des évents en s'enroulant. */}
      {wisps.map((w) => (
        <span
          key={`wisp-${w.key}`}
          className="yzma-wisp"
          style={{
            left: `${w.left}%`,
            width: `${w.size}vh`,
            height: `${w.size}vh`,
            background: `radial-gradient(circle, ${w.color} 0%, ${w.color}66 42%, ${w.color}00 72%)`,
            animationDuration: `${w.dur}s`,
            animationDelay: `${w.delay}s`,
            '--sx': `${w.sx}vw`,
            '--vop': w.op,
          } as CSSProperties}
        />
      ))}
      {/* Bulles multicolores qui montent en ondulant. */}
      {bubbles.map((b, i) => (
        <span
          key={`bub-${i}`}
          className="yzma-bubble-rise"
          style={{
            left: `${b.left}%`,
            animationDuration: `${b.dur}s`,
            animationDelay: `${b.delay}s`,
          }}
        >
          <span
            className="yzma-bubble-sway"
            style={{
              animationDuration: `${b.swayDur}s`,
              animationDelay: `${b.delay}s`,
              '--sway': `${b.sway}vw`,
            } as CSSProperties}
          >
            <span
              className="yzma-bubble"
              style={{
                width: `${b.size}vh`,
                height: `${b.size}vh`,
                opacity: b.op,
                background: `radial-gradient(circle at 35% 30%, #ffffffcc 0%, ${b.color} 45%, ${b.color}00 100%)`,
                boxShadow: `0 0 6px ${b.color}aa`,
              }}
            />
          </span>
        </span>
      ))}
      {/* Fioles qui SE BALADENT en rebondissant sur les bords (DVD), en tournant lentement et nimbées
          d'un halo : 1 potion_yzma + 5 potion_neutre ; chaque fiole pilote son propre trajet. */}
      {[0, 1, 1, 1, 1, 1].map((idx, i) => (
        <YzmaVial key={i} img={YZMA_VIAL_IMAGES[idx]} />
      ))}
      {/* Vignette : coins sombres (le laboratoire plongé dans la pénombre). */}
      <div className="yzma-vignette" />
      {/* SURPRISE « Pull the lever » : DOUBLE explosion d'une potion en nuage de fumée multicolore (au-dessus
          de tout le décor) — deux foyers, le second décalé (bl.delay). Animations jouées une fois. */}
      {boom &&
        boom.blasts.map((bl) => (
          <div key={`boom-${bl.key}`} className="yzma-boom" style={{ left: `${bl.left}%`, top: `${bl.top}%` }}>
            <span className="yzma-boom-flash" style={{ animationDelay: `${bl.delay}s` }} />
            <span className="yzma-boom-ring" style={{ animationDelay: `${bl.delay}s` }} />
            {bl.puffs.map((p) => (
              <span
                key={`boom-${p.key}`}
                className="yzma-boom-puff"
                style={{
                  width: `${p.size}vh`,
                  height: `${p.size}vh`,
                  background: `radial-gradient(circle, ${p.color} 0%, ${p.color}66 45%, ${p.color}00 72%)`,
                  animationDuration: `${p.dur}s`,
                  animationDelay: `${p.delay + bl.delay}s`,
                  '--dx': `${p.dx}vh`,
                  '--dy': `${p.dy}vh`,
                  '--op': p.op,
                } as CSSProperties}
              />
            ))}
          </div>
        ))}
      {/* SURPRISE « Yzma en chat » : grosse fumée noire qui monte du bas, se dissipe et révèle le chat
          (avec « ? »), qui marque un temps puis DÉTALE vers la gauche. Au-dessus de tout le décor. */}
      {cat && (
        <div className="yzma-cat-scene">
          {cat.puffs.map((p) => (
            <span
              key={`catsmoke-${p.key}`}
              className="yzma-cat-smoke"
              style={{
                left: `${p.left}%`,
                width: `${p.size}vh`,
                height: `${p.size}vh`,
                animationDelay: `${p.delay}s`,
                '--sx': `${p.sx}vw`,
                '--sx2': `${p.sx2}vw`,
                '--op': p.op,
              } as CSSProperties}
            />
          ))}
          <span className="yzma-cat-figure">
            <span className="yzma-cat-q">?</span>
            <img src="/animations/cat_yzma.png" alt="" className="yzma-cat-img" draggable={false} />
          </span>
        </div>
      )}
    </div>
  )
}

// ----- Décor « laBonneFee » : la magie de la Bonne Fée (Marraine de Shrek) qui retombe -----
// Décor : des volutes de fumée lumineuse TEXTURÉES (bruit fractal) qui TOMBENT du haut en dérivant et en se
// dissipant (sa magie qui retombe), sur un fond violacé. Toute la fumée est d'UNE seule couleur à la fois,
// qui CYCLE dans l'ordre toutes les minutes ; à chaque changement, une lumière blanc-bleu s'illumine derrière
// la fumée (et masque la bascule de couleur). 100 % CSS.
// Les 3 couleurs de fumée, parcourues dans l'ordre (1 par minute) : violet → magenta → rouge.
const BF_SMOKE_COLORS = ['#C674F1', '#C33976', '#F9012E']
// Durée pendant laquelle une couleur reste affichée avant de passer à la suivante.
const BF_COLOR_PERIOD_MS = 60000 // 1 min
// Fioles « potion_fee » qui TOMBENT une à une (assets copiés dans public/animations) : une toutes les
// BF_POTION_PERIOD_MS, chacune chute de haut en bas, démontée après BF_POTION_FALL_MS (couvre la descente).
const BF_POTION_IMAGES = [
  // #2 retiré (image écartée) → fioles 1, 3, 4, 5.
  ...[1, 3, 4, 5].map((n) => `/animations/potion_fee${n}.png`),
  '/animations/baguette_magique.png', // la baguette tombe aussi, parmi les potions
]
const BF_POTION_PERIOD_MS = 30000 // une potion (ou la baguette) tombe toutes les 30 s
const BF_POTION_FALL_MS = 21000 // marge couvrant la chute (~20 s) avant démontage

// ----- SURPRISE « HOLDING OUT FOR A HERO » (le karaoké du bal, Shrek 2) -----
// La Bonne Fée empoigne le micro et la salle devient sa scène :
//  1. LES LUMIÈRES S'ÉTEIGNENT — un voile sombre tombe sur la magie rose, qui se retire ;
//  2. LA SCÈNE S'ALLUME — cinq POURSUITES de COULEURS différentes (magenta, violet, cyan, or, corail)
//     s'allument en haut de la colonne et balaient la salle en se CROISANT ;
//  3. LE REFRAIN — TOUT bat la mesure : un voile rose pulse sur le temps, des ONDES SONORES partent
//     de la scène (bas de la colonne), un ÉGALISEUR danse en bas, des PAILLETTES accrochent la lumière
//     des spots un peu partout et des NOTES de musique montent ;
//  4. LE DERNIER ACCORD — les cinq poursuites se braquent sur le centre, un FLASH blanc claque, et la
//     salle rallume sa magie rose comme si de rien n'était.
// 100 % CSS, aucun asset. ⚠️ Les jalons sont écrits en % dans les keyframes `bfHero*` (index.css),
// toutes calées sur une durée de 12 s → garder BF_HERO_DUR_MS en phase.
const BF_HERO_DUR_MS = 12_000 // séquence complète
const BF_HERO_GAP_MIN_MS = 75_000 // entre deux numéros (c'est une SURPRISE : c'est rare)
const BF_HERO_GAP_MAX_MS = 130_000
const BF_HERO_BEAT_MS = 405 // le TEMPO (≈ 148 BPM, celui de « Holding Out for a Hero »)
const BF_HERO_RINGS = 4 // ondes sonores en vol (une part à chaque temps)
const BF_HERO_GLINTS = 46 // paillettes qui accrochent la lumière des spots
const BF_HERO_BARS = 26 // barres de l'égaliseur
const BF_HERO_NOTES = 14 // notes de musique qui montent
const BF_HERO_NOTE_GLYPHS = ['♪', '♫', '♩', '♬']
// Les POURSUITES : cinq projecteurs alignés en haut de la colonne (`left` = le point d'accroche, qui
// sert aussi de PIVOT au faisceau). Chacun balaie la salle entre SES deux angles `a0`/`a1` (en degrés,
// positif = vers la droite) — un projecteur sur deux part à l'envers, d'où les faisceaux qui se
// CROISENT — puis vient se braquer sur le centre (`conv`) au dernier accord. `c` = sa couleur, en
// composantes « R, G, B » (le CSS en tire le dégradé du faisceau et le halo de la source).
const BF_HERO_BEAMS = [
  { left: 8, c: '255, 92, 196', a0: 34, a1: -6, conv: 20 }, // magenta
  { left: 29, c: '168, 116, 255', a0: -22, a1: 18, conv: 9 }, // violet
  { left: 50, c: '116, 226, 255', a0: 26, a1: -26, conv: 0 }, // cyan
  { left: 71, c: '255, 196, 104', a0: -18, a1: 22, conv: -9 }, // or
  { left: 92, c: '255, 118, 150', a0: 6, a1: -34, conv: -20 }, // corail
]
// Teintes des paillettes : celles des spots (+ un blanc chaud) → elles semblent renvoyer leur lumière.
const BF_HERO_GLINT_COLORS = [
  'rgba(255, 92, 196, 0.95)', 'rgba(168, 116, 255, 0.92)', 'rgba(116, 226, 255, 0.92)',
  'rgba(255, 196, 104, 0.95)', 'rgba(255, 244, 252, 0.95)',
]

interface BfHeroShow {
  /** Paillettes de la salle : semées sur tout l'écran, chacune scintillant sur le tempo. */
  glints: { left: number; top: number; size: number; color: string; beats: number; delay: number }[]
  /** Barres de l'égaliseur : hauteur au repos + rythme propre (multiples du tempo). */
  bars: { h: number; beats: number; delay: number }[]
  /** Notes de musique qui montent en dérivant. */
  notes: { glyph: string; left: number; size: number; dur: number; delay: number; sway: number; rot: number }[]
}

/** Tire les éléments aléatoires d'un numéro (un tirage par déclenchement → jamais deux fois le même). */
function buildBfHeroShow(): BfHeroShow {
  return {
    glints: Array.from({ length: BF_HERO_GLINTS }, () => ({
      left: Math.random() * 100, // % (du calque tournant, qui déborde de l'écran)
      top: Math.random() * 100, // %
      size: 0.4 + Math.random() * 1.2, // vh
      color: BF_HERO_GLINT_COLORS[Math.floor(Math.random() * BF_HERO_GLINT_COLORS.length)],
      beats: 1 + Math.floor(Math.random() * 3), // scintille tous les 1, 2 ou 3 temps
      delay: Math.random() * 1.2, // s (déphasés → l'écran pétille en continu)
    })),
    bars: Array.from({ length: BF_HERO_BARS }, () => ({
      h: 4 + Math.random() * 14, // vh (hauteur maxi de la barre)
      beats: 1 + Math.floor(Math.random() * 2), // certaines barres suivent le temps, d'autres le double
      delay: -(Math.random() * 0.8), // s (négatif → déjà en mouvement à l'allumage)
    })),
    notes: Array.from({ length: BF_HERO_NOTES }, () => ({
      glyph: BF_HERO_NOTE_GLYPHS[Math.floor(Math.random() * BF_HERO_NOTE_GLYPHS.length)],
      left: 6 + Math.random() * 88, // %
      size: 2.4 + Math.random() * 3, // vh
      dur: 4 + Math.random() * 3.5, // s (montée)
      delay: 1 + Math.random() * 6.5, // s (échelonnées sur tout le refrain)
      sway: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 9), // vw (dérive latérale)
      rot: (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 45), // deg
    })),
  }
}

/** Décor « laBonneFee » (Marraine de Shrek) : sa MAGIE ROSE qui retombe — des volutes de fumée rose lumineuse
 *  qui TOMBENT lentement du haut en dérivant latéralement et en se dissipant, sur un fond violacé, surmontées
 *  d'une lueur rose pulsante en haut (la source) et vignetté. Éléments tirés une fois au montage ; animations
 *  CSS (cf. index.css).
 *  SURPRISE « Holding Out for a Hero » : le karaoké du bal (cf. le bloc BF_HERO_* ci-dessus). */
function LaBonneFeeDecor() {
  // Volutes de fumée qui tombent : enveloppe = descente (bfSmokeFall), milieu = dérive latérale (bfSmokeSway),
  // pastille = la bouffée floue. Tailles/vitesses/dérives/textures variées, figées au montage (la COULEUR, elle,
  // est gérée à part car elle cycle dans le temps).
  const [smoke] = useState(() =>
    Array.from({ length: 130 }, () => ({
      left: -20 + Math.random() * 140, // % (déborde au-delà des bords → fumée répartie sur tout l'espace)
      size: 16 + Math.random() * 34, // vh (grosses bouffées floues)
      dur: 5 + Math.random() * 6, // s (descente plus rapide)
      delay: -(Math.random() * 11), // s (flux continu, déphasé)
      sway: 2 + Math.random() * 6, // vw (ondulation latérale)
      swayDur: 4 + Math.random() * 4, // s
      drift: (Math.random() - 0.5) * 70, // vw (DÉRIVE diagonale nette pendant la chute → ne descend pas tout droit)
      op: 0.18 + Math.random() * 0.28, // opacité de pointe (diffuse)
      // Masque de bruit fractal (cf. .bf-smoke en CSS) décalé/pivoté/zoomé par volute → chacune a une texture
      // nuageuse DIFFÉRENTE (sinon toutes identiques car même masque).
      mx: Math.random() * 100, // % (position X du masque)
      my: Math.random() * 100, // % (position Y du masque)
      rot: Math.random() * 360, // deg (rotation de la volute → texture orientée autrement)
      texScale: 130 + Math.random() * 90, // % (zoom du masque → grain variable)
    })),
  )
  // COULEUR DE LA FUMÉE : toute la fumée partage une seule couleur, qui passe à la suivante (dans l'ordre) toutes
  // les BF_COLOR_PERIOD_MS. À chaque bascule, on incrémente `flashSeq` → la lumière blanc-bleu derrière la fumée
  // se rejoue (calque `.bf-color-flash` remonté par sa `key`), ce qui masque le changement de teinte.
  const [colorIdx, setColorIdx] = useState(0)
  const [flashSeq, setFlashSeq] = useState(0)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const tick = () => {
      setColorIdx((c) => (c + 1) % BF_SMOKE_COLORS.length)
      setFlashSeq((s) => s + 1)
      t = setTimeout(tick, BF_COLOR_PERIOD_MS)
    }
    t = setTimeout(tick, BF_COLOR_PERIOD_MS)
    return () => clearTimeout(t)
  }, [])
  const color = BF_SMOKE_COLORS[colorIdx]
  // POTION QUI TOMBE : toutes les BF_POTION_PERIOD_MS, une fiole (au hasard parmi les 5) chute de haut en bas
  // à une position/taille/rotation tirées au sort. Démontée après sa chute. Désactivé en reduced-motion.
  const [potion, setPotion] = useState<{ seq: number; src: string; left: number; size: number; rot: number; dur: number } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const drop = () => {
      const s = seq++
      setPotion({
        seq: s,
        src: BF_POTION_IMAGES[Math.floor(Math.random() * BF_POTION_IMAGES.length)],
        left: 8 + Math.random() * 80, // % (position horizontale)
        size: 11 + Math.random() * 5, // vh (hauteur de la fiole)
        // pivot lent et régulier pendant la chute : ~1 tour (sens au hasard), étalé linéairement sur la descente
        rot: (Math.random() < 0.5 ? -1 : 1) * (270 + Math.random() * 180), // deg
        dur: 20, // s (durée de la chute)
      })
      clear = setTimeout(() => setPotion(null), BF_POTION_FALL_MS)
      next = setTimeout(drop, BF_POTION_PERIOD_MS)
    }
    next = setTimeout(drop, 4000) // 1re potion peu après le chargement, puis toutes les 30 s
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  // SURPRISE « Holding Out for a Hero » : le numéro entier est piloté par des keyframes CSS calées sur
  // BF_HERO_DUR_MS (aucune machine à phases nécessaire) ; on monte le calque, on le démonte à la fin.
  // Timer interne (rare), aussi tirée à la demande par l'outil de test (`useSurpriseSub`).
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  const [hero, setHero] = useState<{ seq: number; show: BfHeroShow } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let end: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () => BF_HERO_GAP_MIN_MS + Math.random() * (BF_HERO_GAP_MAX_MS - BF_HERO_GAP_MIN_MS)
    const fire = (fireRef.current = () => {
      clearTimeout(next) // (re)déclenchement manuel : on repart d'un cycle propre
      clearTimeout(end)
      setHero({ seq: seq++, show: buildBfHeroShow() })
      end = setTimeout(() => setHero(null), BF_HERO_DUR_MS)
      next = setTimeout(fire, BF_HERO_DUR_MS + gap())
    })
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(end)
    }
  }, [])
  return (
    <div className={`bf-decor${hero ? ' bf-decor--hero' : ''}`} aria-hidden>
      {/* Lueur rose pulsante en haut (la source de la magie). */}
      <div className="bf-glow" />
      {/* Lumière blanc-bleu qui s'illumine DERRIÈRE la fumée à chaque changement de couleur (rejouée via sa key). */}
      {flashSeq > 0 && <div key={flashSeq} className="bf-color-flash" />}
      {/* Volutes de fumée qui TOMBENT en dérivant et se dissipant (couleur commune `color`, qui cycle). */}
      {smoke.map((s, i) => (
        <span
          key={`smoke-${i}`}
          className="bf-smoke-fall"
          style={{ left: `${s.left}%`, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s`, '--drift': `${s.drift}vw` } as CSSProperties}
        >
          <span
            className="bf-smoke-sway"
            style={{ animationDuration: `${s.swayDur}s`, animationDelay: `${s.delay}s`, '--sway': `${s.sway}vw` } as CSSProperties}
          >
            <span
              className="bf-smoke"
              style={{
                width: `${s.size}vh`,
                height: `${s.size}vh`,
                opacity: s.op,
                background: `radial-gradient(circle, ${color} 0%, ${color}88 40%, ${color}00 72%)`,
                transform: `rotate(${s.rot}deg)`,
                maskPosition: `${s.mx}% ${s.my}%`,
                maskSize: `${s.texScale}% ${s.texScale}%`,
                WebkitMaskPosition: `${s.mx}% ${s.my}%`,
                WebkitMaskSize: `${s.texScale}% ${s.texScale}%`,
              }}
            />
          </span>
        </span>
      ))}
      {/* Potion qui TOMBE de haut en bas (une toutes les 30 s, image au hasard ; rejouée via sa key).
          Deux mouvements séparés : le conteneur gère la CHUTE (ease-in, accélère) ; l'image gère
          le PIVOT lent et régulier (linéaire) — d'où les deux animation-timing-function distinctes. */}
      {potion && (
        <span
          key={potion.seq}
          className="bf-potion-fall"
          style={{ left: `${potion.left}%`, animationDuration: `${potion.dur}s` } as CSSProperties}
        >
          <img
            src={potion.src}
            alt=""
            className="bf-potion"
            draggable={false}
            style={{ height: `${potion.size}vh`, animationDuration: `${potion.dur}s`, '--rot': `${potion.rot}deg` } as CSSProperties}
          />
        </span>
      )}
      {/* Vignette : coins assombris. */}
      <div className="bf-vignette" />
      {/* SURPRISE « Holding Out for a Hero » : le karaoké du bal, PAR-DESSUS tout le décor. Tout le
          calque est rejoué à neuf à chaque numéro (remontage par `key`) ; le tempo (`--beat`) est la
          seule variable partagée, dont dérivent les rythmes des éclats, des ondes et de l'égaliseur. */}
      {hero && (
        <div key={hero.seq} className="bf-hero" style={{ '--beat': `${BF_HERO_BEAT_MS}ms` } as CSSProperties}>
          {/* 1. Les lumières s'éteignent. */}
          <div className="bf-hero-dark" />
          {/* 2 & 3. La scène s'allume : tout ce qui joue le numéro partage cette enveloppe de fondu. */}
          <div className="bf-hero-on">
            {/* Les POURSUITES COLORÉES : cinq projecteurs qui balaient la salle en se croisant, puis
                se braquent tous sur le centre au dernier accord. Angles et couleur posés en inline. */}
            {BF_HERO_BEAMS.map((b, i) => (
              <div
                key={i}
                className="bf-hero-beam"
                style={{
                  left: `${b.left}%`,
                  '--c': b.c,
                  '--a0': `${b.a0}deg`,
                  '--a1': `${b.a1}deg`,
                  '--conv': `${b.conv}deg`,
                } as CSSProperties}
              />
            ))}
            {/* Les PAILLETTES de la salle, semées sur tout l'écran dans un calque qui tourne lentement ;
                chacune accroche la lumière sur un multiple du tempo, déphasée. */}
            <div className="bf-hero-glitter">
              {hero.show.glints.map((g, i) => (
                <span
                  key={i}
                  className="bf-hero-glint"
                  style={{
                    left: `${g.left}%`,
                    top: `${g.top}%`,
                    width: `${g.size}vh`,
                    height: `${g.size}vh`,
                    background: g.color,
                    boxShadow: `0 0 ${g.size * 2.4}vh ${g.color}`,
                    animationDuration: `calc(var(--beat) * ${g.beats})`,
                    animationDelay: `${g.delay}s`,
                  }}
                />
              ))}
            </div>
            {/* Le voile rose qui PULSE sur le temps (tout le décor bat la mesure). */}
            <div className="bf-hero-beat" />
            {/* Les ONDES SONORES : une part de la scène (bas de la colonne) à chaque temps. */}
            {Array.from({ length: BF_HERO_RINGS }, (_, i) => (
              <span key={i} className="bf-hero-ring" style={{ animationDelay: `calc(var(--beat) * ${i})` }} />
            ))}
            {/* L'ÉGALISEUR, en bas de la colonne. */}
            <div className="bf-hero-eq">
              {hero.show.bars.map((b, i) => (
                <span
                  key={i}
                  className="bf-hero-eq-bar"
                  style={{
                    height: `${b.h}vh`,
                    animationDuration: `calc(var(--beat) * ${b.beats})`,
                    animationDelay: `${b.delay}s`,
                  }}
                />
              ))}
            </div>
            {/* Les NOTES de musique, qui montent en dérivant. */}
            {hero.show.notes.map((n, i) => (
              <span
                key={i}
                className="bf-hero-note"
                style={{
                  left: `${n.left}%`,
                  fontSize: `${n.size}vh`,
                  animationDuration: `${n.dur}s`,
                  animationDelay: `${n.delay}s`,
                  '--sway': `${n.sway}vw`,
                  '--rot': `${n.rot}deg`,
                } as CSSProperties}
              >
                {n.glyph}
              </span>
            ))}
          </div>
          {/* 4. Le dernier accord : flash blanc. */}
          <div className="bf-hero-flash" />
        </div>
      )}
    </div>
  )
}

// Images qui tombent dans le décor de Ratigan : les PIÈCES de Prince Jean (réutilisées, cf. COIN_IMAGES) + 4 diamants.
const RATIGAN_DIAMANTS = Array.from({ length: 4 }, (_, i) => `/animations/diamant-${i + 1}.png`)
// Ombre portée commune aux objets qui tombent.
const RATIGAN_SHADOW = 'drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4))'
// Teintes des diamants : rouge, bleu et blanc (l'image est un cristal clair → on la colore au filtre
// `sepia + hue-rotate`, qui préserve les facettes ; le blanc reste l'image d'origine).
const DIAMOND_TINTS = [
  `grayscale(1) sepia(1) saturate(20) hue-rotate(-66deg) brightness(1) ${RATIGAN_SHADOW}`, // rouge
  `grayscale(1) sepia(1) saturate(12) hue-rotate(188deg) brightness(1) ${RATIGAN_SHADOW}`, // bleu
  RATIGAN_SHADOW, // blanc (sans teinte)
]

/** Décor « clockwork » (Ratigan — Basil, détective privé) : le beffroi de Big Ben.
 *  ARRIÈRE-PLAN : voile ambré au gaz + nappes de brume qui dérivent, un grand CADRAN d'horloge lumineux
 *  (disque ambré + ticks + aiguilles qui tournent) et de grands ENGRENAGES (rouages) qui tournent lentement
 *  sur eux-mêmes (parallaxe par tailles/opacités). DEVANT : une pluie permanente de PIÈCES (celles de Prince
 *  Jean) et de diamants qui tombent en tournoyant (mécanique `coinFall` en boucle, ×135 ; diamants teintés
 *  rouge/bleu/blanc) + une cloche sans teinte. SURPRISE ponctuelle : une cascade d'EAU (#B93A59) se
 *  déverse ~7 s par moments. Éléments tirés une fois au montage ; rotations multiples de 360° (bouclage net). */
function ClockworkDecor({ side }: { side?: 'left' | 'right' }) {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // La colonne du décor déborde de 10 % (de la largeur écran) vers le bord EXTÉRIEUR (gauche pour le
  // joueur, droite pour l'adversaire), donc une partie de la boîte est hors écran de ce côté. On biaise
  // la répartition horizontale vers le bord INTÉRIEUR (visible) pour que la pluie reste centrée sur la
  // colonne réellement affichée, au lieu d'être décalée vers le débordement.
  const [lo, hi] = side === 'right' ? [-10, 100] : side === 'left' ? [20, 98] : [4, 96]
  const [items] = useState(() => {
    const rain = Array.from({ length: 135 }, () => {
      // Un objet sur deux ≈ un diamant (teinté), l'autre une pièce de Prince Jean (non teintée).
      const isDiamond = Math.random() < 0.5
      const img = isDiamond
        ? RATIGAN_DIAMANTS[Math.floor(Math.random() * RATIGAN_DIAMANTS.length)]
        : COIN_IMAGES[Math.floor(Math.random() * COIN_IMAGES.length)]
      return {
        img,
        filter: isDiamond ? DIAMOND_TINTS[Math.floor(Math.random() * DIAMOND_TINTS.length)] : RATIGAN_SHADOW,
        left: lo + Math.random() * (hi - lo), // % (biaisé selon le côté, cf. ci-dessus)
        // Diamants nettement plus gros que les pièces.
        size: isDiamond ? 3.6 + Math.random() * 3.8 : 1.8 + Math.random() * 2.4, // vh
        dur: 20 + Math.random() * 14, // s (chute lente, 20–34 s)
        delay: -(Math.random() * 34), // s (étalées sur tout le trajet)
        spin: (Math.random() < 0.5 ? -1 : 1) * 360 * (1 + Math.floor(Math.random() * 3)), // ±360/720/1080°
        op: 0.6,
      }
    })
    // Une SEULE cloche (sans teinte : couleurs d'origine, juste une ombre) et bien plus grosse, qui
    // tombe comme les diamants.
    const cloche = {
      img: '/animations/cloche-main.png',
      filter: RATIGAN_SHADOW, // pas de teinte couleur, juste l'ombre portée
      left: lo + Math.random() * (hi - lo),
      size: 10 + Math.random() * 3, // vh (bien plus grosse que la pluie)
      dur: 24 + Math.random() * 10, // s (chute lente)
      delay: -(Math.random() * 34), // s
      spin: (Math.random() < 0.5 ? -1 : 1) * 360 * (1 + Math.floor(Math.random() * 3)),
      op: 0.6,
    }
    return [...rain, cloche]
  })
  // ARRIÈRE-PLAN : de grands ENGRENAGES (image `rouage_plat.png`) qui tournent lentement sur eux-mêmes,
  // DERRIÈRE la pluie et la cascade (les rouages de Big Ben). Tailles/positions/vitesses/sens tirés une
  // fois au montage.
  const [cogs] = useState(() => {
    // Répartis sur une GRILLE 3×2 (une cellule par engrenage) + jitter → bien étalés (pas en paquet).
    const cells = [
      { left: 18, top: 26 }, { left: 50, top: 20 }, { left: 82, top: 30 },
      { left: 20, top: 72 }, { left: 52, top: 76 }, { left: 84, top: 66 },
    ]
    return cells.map((cell) => ({
      left: cell.left + (Math.random() - 0.5) * 14, // % (jitter dans la cellule)
      top: cell.top + (Math.random() - 0.5) * 16, // %
      size: 26 + Math.random() * 32, // vh (grands engrenages)
      dur: 16 + Math.random() * 26, // s (rotation lente)
      spin: Math.random() < 0.5 ? 360 : -360, // sens horaire / antihoraire
      op: 0.18 + Math.random() * 0.16, // discrets (arrière-plan)
    }))
  })
  // Nappes de BRUME AMBRÉE (gaz de Big Ben) qui dérivent lentement, tout au fond.
  const [mist] = useState(() =>
    Array.from({ length: 4 }, () => ({
      left: 12 + Math.random() * 76, // %
      top: 18 + Math.random() * 60, // %
      w: 48 + Math.random() * 40, // vh
      h: 28 + Math.random() * 26, // vh
      dur: 22 + Math.random() * 18, // s (dérive lente)
      delay: -(Math.random() * 30), // s
      amp: 6 + Math.random() * 8, // vw (va-et-vient)
      op: 0.1 + Math.random() * 0.12,
    })),
  )
  // Colonnes d'eau de la cascade (couleur #B93A59, 2 nuances ; filets qui tombent vite, hauteurs et débits
  // variés) ; positions biaisées sur la colonne visible.
  const [falls] = useState(() =>
    Array.from({ length: 72 }, () => {
      const r = Math.random()
      const h = r < 0.4 ? 8 + Math.random() * 5 : r < 0.75 ? 14 + Math.random() * 9 : 24 + Math.random() * 13 // vh
      return {
        left: lo + Math.random() * (hi - lo), // %
        w: 0.5 + Math.random() * 0.9, // vh (filet fin)
        h, // vh (hauteur de colonne)
        dur: 0.4 + Math.random() * 0.6, // s (chute rapide : lent/moyen/rapide)
        delay: -(Math.random() * 1.2), // s
        teal: Math.random() < 0.5, // true = nuance plus claire (profondeur)
        op: 0.6 + Math.random() * 0.35,
      }
    }),
  )
  // Bouillons blancs (« écume ») au pied de la cascade : petits ronds qui frémissent.
  const [foam] = useState(() =>
    Array.from({ length: 28 }, () => ({
      left: lo + Math.random() * (hi - lo), // %
      size: 1.6 + Math.random() * 2.8, // vh
      dur: 0.12 + Math.random() * 0.32, // s (frémissement rapide)
      delay: -(Math.random() * 0.4), // s
      op: 0.7 + Math.random() * 0.3,
    })),
  )
  // SURPRISE : par moments, une cascade D'EAU se déverse quelques secondes, puis s'arrête ; on reprogramme
  // la suivante après un intervalle aléatoire (désactivée en reduced-motion).
  const [waterOn, setWaterOn] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let off: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const gap = () => 35000 + Math.random() * 35000 // 35–70 s entre deux cascades
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        setWaterOn(true)
        off = setTimeout(() => {
          setWaterOn(false)
          schedule(gap())
        }, 7000) // la cascade coule ~7 s
      }, delay)
    }
    schedule(15000 + Math.random() * 15000) // première cascade entre 15 et 30 s
    // MODE TEST : déclenche la cascade d'eau à la demande.
    fireRef.current = () => {
      setWaterOn(true)
      off = setTimeout(() => setWaterOn(false), 7000)
    }
    return () => {
      clearTimeout(next)
      clearTimeout(off)
    }
  }, [])
  return (
    <div className="clockwork-decor" aria-hidden>
      {/* Tout au fond : voile ambré + nappes de brume au gaz qui dérivent. */}
      <div className="cw-ambient" />
      {mist.map((m, i) => (
        <span
          key={`mist-${i}`}
          className="cw-mist"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: `${m.w}vh`,
            height: `${m.h}vh`,
            opacity: m.op,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
            '--amp': `${m.amp}vw`,
          } as CSSProperties}
        />
      ))}
      {/* Grand CADRAN d'horloge lumineux (Big Ben), au fond : disque ambré + ticks + aiguilles qui tournent. */}
      <div className="cw-clockface">
        <span className="cw-clock-hand cw-clock-hand--h" />
        <span className="cw-clock-hand cw-clock-hand--m" />
        <span className="cw-clock-center" />
      </div>
      {/* Arrière-plan : grands engrenages dessinés en CSS qui tournent lentement (rouages de Big Ben).
          Rendus AVANT la pluie de rouages/diamants et la cascade → derrière elles. */}
      {cogs.map((c, i) => (
        <span
          key={`cog-${i}`}
          className="cw-cog"
          style={{
            left: `${c.left}%`,
            top: `${c.top}%`,
            width: `${c.size}vh`,
            height: `${c.size}vh`,
            opacity: c.op,
            animationDuration: `${c.dur}s`,
            '--spin': `${c.spin}deg`,
          } as CSSProperties}
        >
          <img src="/animations/rouage_plat.png" alt="" className="cw-cog-img" draggable={false} />
        </span>
      ))}
      {items.map((c, i) => (
        <img
          key={i}
          src={c.img}
          alt=""
          className="cw-fall"
          style={{
            left: `${c.left}%`,
            height: `${c.size}vh`,
            opacity: c.op,
            filter: c.filter,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
            '--coin-spin': `${c.spin}deg`,
          } as CSSProperties}
          draggable={false}
        />
      ))}
      {/* SURPRISE : cascade d'EAU (#B93A59) qui se déverse par moments (colonnes qui tombent + écume au pied). */}
      <div className={`cw-water${waterOn ? ' is-pouring' : ''}`}>
        <div className="cw-water-veil" />
        {falls.map((f, i) => (
          <span
            key={`fall-${i}`}
            className={`cw-water-fall${f.teal ? ' is-teal' : ''}`}
            style={{
              left: `${f.left}%`,
              width: `${f.w}vh`,
              opacity: f.op,
              animationDuration: `${f.dur}s`,
              animationDelay: `${f.delay}s`,
              '--fh': `${f.h}vh`,
            } as CSSProperties}
          />
        ))}
        <div className="cw-water-foamband" />
        {foam.map((b, i) => (
          <span
            key={`foam-${i}`}
            className="cw-water-bubble"
            style={{
              left: `${b.left}%`,
              width: `${b.size}vh`,
              height: `${b.size}vh`,
              opacity: b.op,
              animationDuration: `${b.dur}s`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// SURPRISE Cruella : DEUX traînées d'empreintes de pattes (deux chiens) traversent la neige — une en
// haut, une en bas, en sens opposés ; la 2ᵉ démarre quand la 1ʳᵉ a fini de s'imprimer. Elles marquent
// un temps puis s'effacent UNE PAR UNE (dans l'ordre où elles ont été posées). Sur minuterie ;
// désactivée en reduced-motion (la minuterie ne se lance pas). Le minutage total est calculé par tir
// (cf. fire()) à partir du nombre réel d'empreintes.
const CRUELLA_PAW_TEST = false // true = cadence rapide pour le réglage
const CRUELLA_PAW_STAMP_STEP_S = 0.17 // s — délai entre deux empreintes qui s'impriment
const CRUELLA_PAW_STAMP_DUR_S = 0.45 // s — durée de l'impression d'une empreinte (cf. keyframe)
const CRUELLA_PAW_HOLD_MS = 1500 // ms — temps où toute la traînée reste posée avant de s'effacer
const CRUELLA_PAW_OUT_STEP_S = 0.13 // s — délai entre deux disparitions (effacement une par une)
const CRUELLA_PAW_OUT_DUR_MS = 700 // ms — durée du fondu d'une empreinte (cf. CSS transition)
const CRUELLA_PAW_GAP_MIN_MS = CRUELLA_PAW_TEST ? 2_500 : 120_000
const CRUELLA_PAW_GAP_MAX_MS = CRUELLA_PAW_TEST ? 5_000 : 240_000

// Taches dalmatiennes : silhouettes noires arrondies et irrégulières. Chaque tache a un
// `border-radius` aléatoire (4 coins) → forme organique, jamais un disque parfait.
function randomBlobRadius(): string {
  const r = () => 40 + Math.random() * 45 // % (chaque coin entre 40 et 85 %)
  return `${r()}% ${r()}% ${r()}% ${r()}% / ${r()}% ${r()}% ${r()}% ${r()}%`
}

/** Décor « cruella » : nuit d'hiver enneigée (Les 101 Dalmatiens). Fond bleu-nuit froid avec un
 *  faible halo lunaire ; de la neige tombe en voletant (profondeur : flocons proches plus gros,
 *  rapides et flous) ; de subtiles taches dalmatiennes noires dérivent en fondu (la fourrure
 *  tachetée). Une traînée d'EMPREINTES de pattes de chiot s'imprimera par moments dans la neige
 *  (étape 2). Éléments tirés une fois au montage, animations jouées en CSS (cf. index.css). */
function CruellaDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Flocons : profondeur (0 lointain → 1 proche) qui pilote taille / vitesse / flou / opacité, plus
  // un voletement latéral (--sx) et un déphasage pour un flux continu.
  const [flakes] = useState(() =>
    Array.from({ length: 90 }, () => {
      const depth = Math.random() // 0 lointain, 1 proche
      return {
        left: Math.random() * 100, // %
        size: 1.4 + depth * 5, // px (proche = plus gros)
        dur: 16 - depth * 8, // s (proche = tombe plus vite : ~8 à 16 s)
        delay: -(Math.random() * 16), // s (étalés sur tout le trajet)
        sx: 2 + Math.random() * 7, // vw (amplitude du voletement latéral)
        swayDur: 3 + Math.random() * 3, // s (période d'ondulation)
        blur: (1 - depth) * 1.6, // px (lointain = légèrement flou)
        op: 0.4 + depth * 0.55, // proche = plus opaque
      }
    }),
  )
  // Taches dalmatiennes : grosses taches noires qui apparaissent/dérivent très lentement en fondu,
  // surtout dans les marges. Forme et trajet figés au montage.
  const [spots] = useState(() =>
    Array.from({ length: 14 }, () => ({
      left: Math.random() * 100, // %
      top: Math.random() * 100, // %
      size: 4 + Math.random() * 9, // vh
      radius: randomBlobRadius(),
      dx: (Math.random() - 0.5) * 10, // vw (dérive lente)
      dy: (Math.random() - 0.5) * 10, // vh
      dur: 26 + Math.random() * 22, // s (cycle apparition → dérive → disparition)
      delay: -(Math.random() * 40), // s (déphasage)
      op: 0.82 + Math.random() * 0.13, // opacité de pointe (taches bien visibles, ~0,82–0,95)
      lean: (Math.random() - 0.5) * 24, // deg (rotation pendant la dérive)
    })),
  )
  // SURPRISE : traînée d'empreintes de pattes. Calque (dé)monté le temps de la scène ; chaque
  // empreinte « s'imprime » (cruellaPawStamp, jouée une fois) avec un délai croissant → elles
  // apparaissent une à une ; puis tout le calque se fond (`is-leaving`) avant d'être démonté.
  const [paws, setPaws] = useState<{
    seq: number
    items: { key: string; left: number; top: number; rot: number; size: number; delay: number; outDelay: number }[]
  } | null>(null)
  const [pawsLeaving, setPawsLeaving] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let leave: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () => CRUELLA_PAW_GAP_MIN_MS + Math.random() * (CRUELLA_PAW_GAP_MAX_MS - CRUELLA_PAW_GAP_MIN_MS)
    // Une traînée : ligne de marche en travers de l'écran. `yBase` donne la hauteur, `ltr` le sens de
    // la marche, `idx` préfixe les clés, `delayBase` (s) décale le début de l'impression (pour
    // enchaîner la 2ᵉ traînée après la 1ʳᵉ). Chaque empreinte pointe dans le sens de la marche et
    // s'imprime après la précédente. Le décor n'est visible que dans les bandes HAUTE et BASSE.
    const makeTrail = (s: number, idx: number, yBase: number, ltr: boolean, delayBase: number) => {
      const n = 11 + Math.floor(Math.random() * 4) // 11–14 empreintes
      const wander = (Math.random() - 0.5) * 8 // % (léger dénivelé)
      const size = 4.5 + Math.random() * 2 // vh (taille d'une empreinte — bien visible)
      const rot = ltr ? 90 : -90 // les pattes pointent dans le sens de la marche
      return Array.from({ length: n }, (_, i) => {
        const t = n > 1 ? i / (n - 1) : 0
        return {
          key: `${s}-${idx}-${i}`,
          left: ltr ? 5 + t * 90 : 95 - t * 90, // %
          top: yBase + (t - 0.5) * wander + (i % 2 ? 2.5 : -2.5), // alternance pattes G/D
          rot: rot + (Math.random() - 0.5) * 18, // deg (léger lacet)
          size,
          delay: delayBase + i * CRUELLA_PAW_STAMP_STEP_S, // s (s'imprime après la précédente)
        }
      })
    }
    const fire = fireRef.current = () => {
      const s = seq++
      setPawsLeaving(false)
      // Deux chiens en sens OPPOSÉS : un en HAUT (5–11 %), un un peu plus bas (62–69 %). La 2ᵉ traînée
      // démarre quand la 1ʳᵉ a fini de s'imprimer (delayBase = fin d'impression de la 1ʳᵉ).
      const ltr = Math.random() < 0.5
      const trailA = makeTrail(s, 0, 5 + Math.random() * 6, ltr, 0)
      const aEndS = (trailA.length - 1) * CRUELLA_PAW_STAMP_STEP_S + CRUELLA_PAW_STAMP_DUR_S
      const trailB = makeTrail(s, 1, 62 + Math.random() * 7, !ltr, aEndS)
      // Effacement UNE PAR UNE, dans l'ordre de pose (la combinaison est déjà dans l'ordre d'apparition).
      const items = [...trailA, ...trailB].map((it, i) => ({ ...it, outDelay: i * CRUELLA_PAW_OUT_STEP_S }))
      setPaws({ seq: s, items })
      // Minutage : impression (jusqu'à `appearEndS`) → temps de pose (HOLD) → effacement échelonné.
      const appearEndS = aEndS + (trailB.length - 1) * CRUELLA_PAW_STAMP_STEP_S + CRUELLA_PAW_STAMP_DUR_S
      const leaveAtMs = appearEndS * 1000 + CRUELLA_PAW_HOLD_MS
      const outSpanMs = (items.length - 1) * CRUELLA_PAW_OUT_STEP_S * 1000 + CRUELLA_PAW_OUT_DUR_MS
      const durationMs = leaveAtMs + outSpanMs + 250 // +marge pour ne pas couper le dernier fondu
      leave = setTimeout(() => setPawsLeaving(true), leaveAtMs)
      clear = setTimeout(() => {
        setPaws(null)
        setPawsLeaving(false)
      }, durationMs)
      next = setTimeout(fire, durationMs + gap())
    }
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(leave)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className="cruella-decor" aria-hidden>
      {/* Halo lunaire froid + vignette (posés par CSS sur le conteneur via ::before/::after). */}
      <div className="cruella-moon" />
      {/* Taches dalmatiennes noires qui dérivent en fondu (derrière la neige). */}
      {spots.map((s, i) => (
        <span
          key={`spot-${i}`}
          className="cruella-spot"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}vh`,
            height: `${s.size}vh`,
            borderRadius: s.radius,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            '--dx': `${s.dx}vw`,
            '--dy': `${s.dy}vh`,
            '--op': s.op,
            '--lean': `${s.lean}deg`,
          } as CSSProperties}
        />
      ))}
      {/* Neige : enveloppe = chute (translateY) ; enfant = voletement latéral (pendule). */}
      {flakes.map((f, i) => (
        <span
          key={`flake-${i}`}
          className="cruella-flake-fall"
          style={{
            left: `${f.left}%`,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
          }}
        >
          <span
            className="cruella-flake-sway"
            style={{
              animationDuration: `${f.swayDur}s`,
              animationDelay: `${f.delay}s`,
              '--sx': `${f.sx}vw`,
            } as CSSProperties}
          >
            <span
              className="cruella-flake"
              style={{
                width: `${f.size}px`,
                height: `${f.size}px`,
                opacity: f.op,
                filter: f.blur ? `blur(${f.blur}px)` : undefined,
              }}
            />
          </span>
        </span>
      ))}
      {/* Traînées d'empreintes de pattes (par-dessus la neige). En sortie (`is-leaving`), chaque
          empreinte s'efface à son tour (transition-delay = `--out-delay`) → disparition une par une. */}
      {paws && (
        <div
          className={`cruella-paws${pawsLeaving ? ' is-leaving' : ''}`}
          style={{ '--paw-out-dur': `${CRUELLA_PAW_OUT_DUR_MS}ms` } as CSSProperties}
        >
          {paws.items.map((p) => (
            // Conteneur = position + orientation (dans le sens de la marche) ; l'image porte
            // l'animation d'« impression » (surgit en grossissant puis se cale).
            <span
              key={p.key}
              className="cruella-paw"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: `${p.size}vh`,
                transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
              }}
            >
              <img
                src="/animations/patte.png"
                alt=""
                className="cruella-paw-img"
                draggable={false}
                style={{ animationDelay: `${p.delay}s`, '--out-delay': `${p.outDelay}s` } as CSSProperties}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// SURPRISE « Lucifer » de Madame de Trémaine. Déroulé : Lucifer traverse la hall en semant des traces
// de pattes sales ; une NUÉE DE POUSSIÈRE envahit le bas ; à son PIC, le fond bascule (fondu) vers la
// version SALE du hall (qui reste). ~1 min plus tard, quelques SAVONS apparaissent et le fond revient
// TRÈS LENTEMENT au propre. `TEST` → cadence rapide pour le réglage.
const TREMAINE_LUCIFER_TEST = false
const TREMAINE_LUCIFER_DUR_MS = 7000 // durée de la traversée de Lucifer
const TREMAINE_SMOKE_START_MS = 500 // début de la nuée de poussière (peu après son entrée)
const TREMAINE_SMOKE_DUR_MS = 5200 // durée de la nuée
const TREMAINE_SMOKE_PEAK_FRAC = 0.46 // fraction de la nuée à laquelle on bascule vers le fond sale
const TREMAINE_DIRTY_HOLD_MS = TREMAINE_LUCIFER_TEST ? 12_000 : 60_000 // temps « sale » avant nettoyage (~1 min)
const TREMAINE_CLEAN_MS = 19_000 // retour TRÈS lent du fond sale au fond propre
const TREMAINE_LUCIFER_GAP_MIN_MS = TREMAINE_LUCIFER_TEST ? 6_000 : 120_000
const TREMAINE_LUCIFER_GAP_MAX_MS = TREMAINE_LUCIFER_TEST ? 10_000 : 240_000

const TREMAINE_DIRTY_SRC = '/animations/background_tremaine_sale.png'

/** Décor « tremaine » (Madame de Trémaine — Cendrillon) : l'entrée du manoir (image de fond `src` :
 *  grand escalier, hall dallé) surmontée de couches d'ambiance — VIGNETTE froide, POUSSIÈRES pâles
 *  et LUEUR de bougie. SURPRISE périodique en plusieurs temps : Lucifer traverse en salissant le sol,
 *  une nuée de poussière monte → au pic, le fond bascule (fondu) vers la version SALE ; ~1 min après,
 *  des savons apparaissent et le fond revient très lentement au propre. Tiré au montage ; CSS. */
function TremaineDecor({ decor }: { decor: Extract<VillainDecorData, { kind: 'tremaine' }> }) {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Poussières : fines particules pâles qui dérivent et montent lentement dans la pénombre
  // (schéma proche de la poussière d'or, teinte froide), tirées une fois au montage.
  const [motes] = useState(() =>
    Array.from({ length: 42 }, () => ({
      left: Math.random() * 100, // %
      top: Math.random() * 100, // %
      size: 1.8 + Math.random() * 4, // px
      dur: 11 + Math.random() * 12, // s (dérive)
      delay: -(Math.random() * 20), // s (déphasage → flux continu)
      dx: (Math.random() - 0.5) * 8, // vw (dérive latérale)
      dy: -(3 + Math.random() * 8), // vh (monte légèrement)
      op: 0.3 + Math.random() * 0.45, // opacité de base
      twinkle: Math.random() < 0.35, // ~1/3 scintille
    })),
  )

  // SURPRISE : la scène entière (traces + nuée + savons) est tirée d'un coup dans `event`. Des drapeaux
  // pilotent les phases successives : Lucifer visible, nuée visible, fond sale affiché, nettoyage en cours.
  const [event, setEvent] = useState<{
    seq: number
    puffs: { key: string; left: number; size: number; delay: number; dx: number }[]
    bubbles: { key: string; left: number; size: number; dur: number; delay: number }[]
  } | null>(null)
  const [luciferOn, setLuciferOn] = useState(false)
  const [smokeOn, setSmokeOn] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [cleaning, setCleaning] = useState(false)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timers: ReturnType<typeof setTimeout>[] = []
    let seq = 0
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
    const gap = () =>
      TREMAINE_LUCIFER_GAP_MIN_MS + Math.random() * (TREMAINE_LUCIFER_GAP_MAX_MS - TREMAINE_LUCIFER_GAP_MIN_MS)

    const fire = fireRef.current = () => {
      const s = seq++
      // — Nuée de poussière : grosses bouffées réparties sur la largeur, qui montent et envahissent le
      //   bas de l'image puis se dissipent (elles culminent ensemble pour masquer le basculement du fond).
      const puffs = Array.from({ length: 9 }, (_, i) => ({
        key: `${s}-p${i}`,
        left: 4 + Math.random() * 92,
        size: 20 + Math.random() * 20, // vh
        delay: Math.random() * 0.9, // s (léger étalement → elles culminent ensemble)
        dx: (Math.random() - 0.5) * 10, // vw (dérive)
      }))
      // — Mousse (phase nettoyage) : quelques GROSSES bulles de savon qui montent.
      const bubbles = Array.from({ length: 10 }, (_, i) => ({
        key: `${s}-b${i}`,
        left: Math.random() * 60, // % (plutôt sur la gauche)
        size: 10 + Math.random() * 8, // vh (XXL)
        dur: 4 + Math.random() * 3.5, // s
        delay: Math.random() * 5, // s (étalées sur la phase nettoyage)
      }))

      setDirty(false)
      setCleaning(false)
      setEvent({ seq: s, puffs, bubbles })
      setLuciferOn(true)
      setSmokeOn(true)

      // Bascule vers le fond SALE au pic de la nuée (le swap est masqué par la poussière).
      const tPeak = TREMAINE_SMOKE_START_MS + TREMAINE_SMOKE_DUR_MS * TREMAINE_SMOKE_PEAK_FRAC
      at(tPeak, () => setDirty(true))
      at(TREMAINE_SMOKE_START_MS + TREMAINE_SMOKE_DUR_MS, () => setSmokeOn(false))
      at(TREMAINE_LUCIFER_DUR_MS + 200, () => setLuciferOn(false))
      // ~1 min plus tard : savons + retour TRÈS lent au propre.
      const tClean = tPeak + TREMAINE_DIRTY_HOLD_MS
      at(tClean, () => {
        setCleaning(true)
        setDirty(false)
      })
      const tEnd = tClean + TREMAINE_CLEAN_MS + 400
      at(tEnd, () => {
        setEvent(null)
        setCleaning(false)
      })
      at(tEnd + gap(), fire)
    }
    at(gap(), fire)
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="tremaine-decor" aria-hidden>
      <div className="tremaine-bg" style={{ backgroundImage: `url(${decor.src})` }} />
      {/* Fond SALE en fondu par-dessus le propre (opacité pilotée : `is-shown` apparaît vite, le retrait
          en `is-cleaning` est très lent → nettoyage progressif). */}
      <div
        className={`tremaine-bg-dirty${dirty ? ' is-shown' : ''}${cleaning ? ' is-cleaning' : ''}`}
        style={{ backgroundImage: `url(${TREMAINE_DIRTY_SRC})`, '--clean': `${TREMAINE_CLEAN_MS}ms` } as CSSProperties}
      />
      {/* Lueur de bougie (applique murale, à droite) qui vacille. */}
      <div className="tremaine-candle" />
      {/* Poussières dans la pénombre. */}
      {motes.map((m, i) => (
        <span
          key={`mote-${i}`}
          className={`tremaine-mote${m.twinkle ? ' is-twinkle' : ''}`}
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            opacity: m.op,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
            '--dx': `${m.dx}vw`,
            '--dy': `${m.dy}vh`,
            '--op': m.op,
          } as CSSProperties}
        />
      ))}
      {event && (
        <>
          {/* Nuée de poussière qui envahit le bas de l'image pendant le passage. */}
          {smokeOn && (
            <div className="tremaine-dust">
              {event.puffs.map((pf) => (
                <span
                  key={pf.key}
                  className="tremaine-dust-puff"
                  style={{
                    left: `${pf.left}%`,
                    width: `${pf.size}vh`,
                    height: `${pf.size}vh`,
                    animationDuration: `${TREMAINE_SMOKE_DUR_MS}ms`,
                    animationDelay: `${pf.delay}s`,
                    '--dx': `${pf.dx}vw`,
                  } as CSSProperties}
                />
              ))}
            </div>
          )}
          {/* Lucifer : traverse de gauche à droite en faisant ses bêtises, puis dash hors champ. */}
          {luciferOn && (
            <div
              key={event.seq}
              className="tremaine-lucifer"
              style={{ '--dur': `${TREMAINE_LUCIFER_DUR_MS}ms` } as CSSProperties}
            >
              <img src="/animations/lucifer.png" alt="" draggable={false} />
            </div>
          )}
          {/* Phase nettoyage : grosses bulles de savon qui montent. */}
          {cleaning && (
            <div className="tremaine-soaps">
              {event.bubbles.map((b) => (
                <span
                  key={b.key}
                  className="tremaine-foam"
                  style={{
                    left: `${b.left}%`,
                    width: `${b.size}vh`,
                    height: `${b.size}vh`,
                    animationDuration: `${b.dur}s`,
                    animationDelay: `${b.delay}s`,
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Les supers « éliminés » par chaque version d'Omnidroïde (groupes 1→6 fournis par l'utilisateur) :
// l'écran holo affiche l'Omnidroïde courant ET la colonne de ses victimes (mugshots tamponnés).
const SYNDROME_HERO_GROUPS: string[][] = [
  ['/animations/heroes/1/hero-05.png', '/animations/heroes/1/hero-09.png', '/animations/heroes/1/hero-20.png'],
  ['/animations/heroes/2/hero-06.png', '/animations/heroes/2/hero-10.png'],
  ['/animations/heroes/3/hero-11.png', '/animations/heroes/3/hero-12.png', '/animations/heroes/3/hero-14.png'],
  ['/animations/heroes/4/hero-01.png', '/animations/heroes/4/hero-04.png', '/animations/heroes/4/hero-15.png'],
  ['/animations/heroes/5/hero-03.png', '/animations/heroes/5/hero-07.png', '/animations/heroes/5/hero-08.png', '/animations/heroes/5/hero-16.png'],
  ['/animations/heroes/6/hero-02.png', '/animations/heroes/6/hero-13.png', '/animations/heroes/6/hero-17.png'],
]

// SURPRISE « PROJECT KRONOS COUNTDOWN » (Les Indestructibles) : le compte à rebours de lancement de la
// fusée Kronos s'affiche par-dessus l'écran de la base — minuteur HH:MM:SS qui DÉFILE seconde par seconde
// (façon film, cf. assets/compteur.png), puis disparaît. Intervalle aléatoire entre deux apparitions
// (`..._GAP_MIN/MAX_MS`). MODE TEST : à `true`, apparitions fréquentes (~8 s) pour régler ; À REMETTRE
// `false` avant commit.
const KRONOS_TEST = false
const KRONOS_DUR_MS = 15000 // durée d'affichage du compte à rebours
const KRONOS_GAP_MIN_MS = KRONOS_TEST ? 7000 : 95000
const KRONOS_GAP_MAX_MS = KRONOS_TEST ? 11000 : 190000
const pad2 = (n: number) => String(n).padStart(2, '0')

/** Décor « syndrome » (Les Indestructibles) : la base secrète high-tech de Syndrome baignée d'énergie
 *  POINT-ZÉRO. Fond noir/rouge, GRILLE en perspective qui défile, PARTICULES rouges qui montent, LUEUR
 *  pulsante, SCANLINES, ARCS électriques, vignette. ÉCRAN HOLOGRAPHIQUE : pour chaque version
 *  d'Omnidroïde (cycle des 6), on affiche le robot ET la colonne de ses supers « éliminés » (mugshots
 *  estampillés « TERMINATED »). SURPRISE périodique : le compte à rebours « PROJECT KRONOS COUNTDOWN »
 *  recouvre l'écran et défile en direct. Tiré au montage ; CSS. */
function SyndromeDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Particules d'énergie point-zéro : points cyan lumineux qui montent en dérivant et se fondent.
  const [motes] = useState(() =>
    Array.from({ length: 34 }, () => ({
      left: Math.random() * 100, // %
      top: Math.random() * 100, // %
      size: 1.6 + Math.random() * 3.4, // px
      dur: 9 + Math.random() * 10, // s
      delay: -(Math.random() * 18), // s
      dx: (Math.random() - 0.5) * 7, // vw
      dy: -(6 + Math.random() * 12), // vh (monte)
      op: 0.4 + Math.random() * 0.5,
    })),
  )
  // Arcs électriques : éclairs cyan qui crépitent par à-coups (flash bref, à intervalles désynchronisés).
  const [arcs] = useState(() =>
    Array.from({ length: 6 }, () => ({
      left: 6 + Math.random() * 88, // %
      top: 8 + Math.random() * 64, // %
      size: 7 + Math.random() * 10, // vh (hauteur de l'éclair)
      rot: (Math.random() - 0.5) * 50, // deg
      dur: 3.5 + Math.random() * 4, // s (période du cycle, l'éclat n'est qu'un court instant)
      delay: -(Math.random() * 6), // s
    })),
  )
  // Écran holographique : les 6 designs d'Omnidroïdes défilent un par un (cycle), en silhouette cyan.
  // `holo` = index courant (re-déclenche le flicker d'apparition via `key`). Figé en reduced-motion.
  const [holo, setHolo] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setHolo((h) => (h + 1) % 6), 3600)
    return () => clearInterval(id)
  }, [])
  // SURPRISE « PROJECT KRONOS COUNTDOWN ». Le compte à rebours est PERSISTANT : il défile en continu
  // (même quand le panneau est masqué), si bien qu'à chaque réapparition on reprend là où on en était
  // — pas de reset. `remain` = secondes restantes avant lancement (départ 08:10:42, façon film).
  const [remain, setRemain] = useState(8 * 3600 + 10 * 60 + 42)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setRemain((r) => (r > 0 ? r - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [])
  // Apparitions par à-coups : on ne fait que basculer la VISIBILITÉ (`kronos` = n° du tir, null = masqué) ;
  // la valeur affichée suit `remain`, qui n'est jamais remis à zéro entre deux affichages.
  const [kronos, setKronos] = useState<number | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timers: ReturnType<typeof setTimeout>[] = []
    let seq = 0
    const gap = () => KRONOS_GAP_MIN_MS + Math.random() * (KRONOS_GAP_MAX_MS - KRONOS_GAP_MIN_MS)
    const fire = fireRef.current = () => {
      setKronos(seq++)
      timers.push(
        setTimeout(() => {
          setKronos(null)
          timers.push(setTimeout(fire, gap()))
        }, KRONOS_DUR_MS),
      )
    }
    timers.push(setTimeout(fire, gap()))
    return () => timers.forEach(clearTimeout)
  }, [])
  const kh = Math.floor(remain / 3600)
  const km = Math.floor((remain % 3600) / 60)
  const ks = remain % 60
  return (
    <div className="syndrome-decor" aria-hidden>
      <div className="syndrome-grid" />
      <div className="syndrome-glow" />
      {/* Écran holographique : pour chaque Omnidroïde (cycle des 6, ~3,6 s), le robot en silhouette cyan
          ET la colonne de ses supers « éliminés » (mugshots qui surgissent puis reçoivent un tampon rouge). */}
      <div className="syndrome-holo">
        <div className="syndrome-holo-botwrap">
          <span
            key={`bot-${holo}`}
            className="syndrome-holo-bot"
            style={{ '--bot': `url(/animations/omnidroide-${holo + 1}.png)` } as CSSProperties}
          />
          <span key={`num-${holo}`} className="syndrome-holo-num">
            {holo + 1}
          </span>
        </div>
        <div key={`vic-${holo}`} className="syndrome-holo-victims">
          {SYNDROME_HERO_GROUPS[holo].map((src, i) => (
            <span className="syndrome-victim" key={src} style={{ animationDelay: `${0.5 + i * 0.55}s` }}>
              <img src={src} alt="" draggable={false} />
              <span className="syndrome-victim-stamp" style={{ animationDelay: `${0.5 + i * 0.55 + 0.32}s` }}>
                TERMINATED
              </span>
            </span>
          ))}
        </div>
        <span className="syndrome-holo-scan" />
      </div>
      {/* Particules d'énergie point-zéro. */}
      {motes.map((m, i) => (
        <span
          key={`smote-${i}`}
          className="syndrome-mote"
          style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            opacity: m.op,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
            '--dx': `${m.dx}vw`,
            '--dy': `${m.dy}vh`,
            '--op': m.op,
          } as CSSProperties}
        />
      ))}
      {/* Arcs électriques qui crépitent. */}
      {arcs.map((a, i) => (
        <span
          key={`sarc-${i}`}
          className="syndrome-arc"
          style={{
            left: `${a.left}%`,
            top: `${a.top}%`,
            height: `${a.size}vh`,
            animationDuration: `${a.dur}s`,
            animationDelay: `${a.delay}s`,
            transform: `translate(-50%, -50%) rotate(${a.rot}deg)`,
          }}
        />
      ))}
      <div className="syndrome-scan" />
      {/* SURPRISE : panneau « PROJECT KRONOS COUNTDOWN » qui recouvre l'écran, minuteur HH:MM:SS en
          direct, puis se retire en fondu (animation calée sur `--dur`). Le bloc se re-monte par `key`
          → la séquence d'apparition rejoue ; la silhouette de Syndrome pointe l'écran (SVG). */}
      {kronos !== null && (
        <div
          key={kronos}
          className="syndrome-kronos"
          style={{ '--dur': `${KRONOS_DUR_MS}ms` } as CSSProperties}
        >
          <div className="syndrome-kronos-title">COMPTE À REBOURS — PROJET KRONOS</div>
          {/* Bande pleine largeur (couleur d'écran plus claire) qui court derrière le minuteur. */}
          <div className="syndrome-kronos-band">
            <div className="syndrome-kronos-clock">
              <div className="syndrome-kronos-grp">
                <span className="syndrome-kronos-digits">{pad2(kh)}</span>
                <span className="syndrome-kronos-label">HEURES</span>
              </div>
              <span className="syndrome-kronos-colon">:</span>
              <div className="syndrome-kronos-grp">
                <span className="syndrome-kronos-digits">{pad2(km)}</span>
                <span className="syndrome-kronos-label">MINUTES</span>
              </div>
              <span className="syndrome-kronos-colon">:</span>
              <div className="syndrome-kronos-grp">
                {/* La `key` sur les secondes les re-monte chaque tic → petit « flip » de défilement. */}
                <span key={ks} className="syndrome-kronos-digits is-tick">
                  {pad2(ks)}
                </span>
                <span className="syndrome-kronos-label">SECONDES</span>
              </div>
            </div>
          </div>
          <div className="syndrome-kronos-launch">AVANT LANCEMENT</div>
          <div className="syndrome-kronos-floor" />
        </div>
      )}
    </div>
  )
}

// Jeu de glyphes de la pluie de code (binaire dominant + quelques symboles « hacker »).
const CYBER_GLYPHS = '0101010101<>[]{}/#$%*+=01'
// Construit une colonne de code : N glyphes empilés (un par ligne, rendus via white-space: pre).
function cyberColumnText(): string {
  const n = 14 + Math.floor(Math.random() * 18) // 14–31 glyphes
  let s = ''
  for (let i = 0; i < n; i++) s += CYBER_GLYPHS[Math.floor(Math.random() * CYBER_GLYPHS.length)] + '\n'
  return s.slice(0, -1)
}

// Crâne de piratage de Sombra en ASCII demi-teinte (cf. assets/animations/ascii_sombra.png). Lignes alignées
// en monospace (espaces de tête = centrage de la silhouette hexagonale).
const SKULL_ART = [
  '                           :PB@Bk:',
  '                       ,jB@@B@B@B@BBL.',
  '                    7G@B@B@BMMMMMB@B@B@Nr',
  '                :kB@B@@@MMOMOMOMOMMMM@B@B@B1,',
  '            :5@B@B@B@BBMMOMOMOMOMOMOMM@@@B@B@BBu.',
  '         70@@@B@B@B@BXBBOMOMOMOMOMOMMBMPB@B@B@B@B@Nr',
  '       G@@@BJ iB@B@@  OBMOMOMOMOMOMOM@2  B@B@B. EB@B@S',
  '       @@BM@GJBU.  iSuB@OMOMOMOMOMOMM@OU1:  .kBLM@M@B@',
  '       B@MMB@B       7@BBMMOMOMOMOMOBB@:       B@BMM@B',
  '       @@@B@B         7@@@MMOMOMOMM@B@:         @@B@B@',
  '       @@OLB.          BNB@MMOMOMM@BEB          rBjM@B',
  '       @@  @           M  OBOMOMM@q  M          .@  @@',
  '       @@OvB           B:u@MMOMOMMBJiB          .BvM@B',
  '       @B@B@J         0@B@MMOMOMOMB@B@u         q@@@B@',
  '       B@MBB@v       G@@BMMMMMMMMMMMBB@5       F@BMM@B',
  '       @BBM@BPNi   LMEB@OMMMM@B@MMOMM@BZM7   rEqB@MBB@',
  '       B@@@BM  B@B@B  qBMOMB@B@B@BMOMBL  B@B@B  @B@B@M',
  '        J@@@@PB@B@B@B7G@OMBB.   ,@MMM@qLB@B@@@BqB@BBv',
  '           iGB@,i0@M@B@MMO@E  :  M@OMM@@@B@Pii@@N:',
  '              .   B@M@B@MMM@B@B@B@MMM@@@M@B',
  '                  @B@B.i@MBB@B@B@@BM@::B@B@',
  '                  B@@@ .B@B.:@B@ :B@B  @B@O',
  '                    :0 r@B@  B@@ .@B@: P:',
  '                        vMB :@B@ :BO7',
  '                            ,B@B',
].join('\n')
// Durée de la frappe : on révèle SKULL_STEP caractères toutes les ~16 ms.
const SKULL_STEP = 3
const SKULL_TYPE_MS = Math.ceil(SKULL_ART.length / SKULL_STEP) * 16

/** Crâne ASCII de Sombra qui « se tape » caractère par caractère (effet machine à écrire), avec un
 *  curseur clignotant tant que la frappe n'est pas finie. Isolé dans son propre composant pour que
 *  seul lui (et non tout le décor) se re-rende à chaque tick. La sortie en fondu est portée par le
 *  parent via la classe `is-leaving`. */
function CyberSkull({ leaving }: { leaving: boolean }) {
  const [count, setCount] = useState(0)
  const done = count >= SKULL_ART.length
  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => {
        const next = c + SKULL_STEP
        if (next >= SKULL_ART.length) {
          clearInterval(id)
          return SKULL_ART.length
        }
        return next
      })
    }, 16)
    return () => clearInterval(id)
  }, [])
  return (
    <div className={`cyber-skull-wrap${leaving ? ' is-leaving' : ''}`}>
      <pre className="cyber-skull">
        {SKULL_ART.slice(0, count)}
        {!done && <span className="cyber-skull-caret">▋</span>}
      </pre>
    </div>
  )
}

/** Décor « cyber » (Sombra — Overwatch) : son interface de piratage. Fond violet très sombre,
 *  une PLUIE de code (colonnes de glyphes qui tombent ; un dégradé clippé sur le texte éclaire la
 *  tête en cyan/magenta et estompe la traîne), une DISTORSION glitch en arrière-plan (deux copies
 *  décalées magenta/cyan découpées en tranches horizontales animées — d'après l'effet glitch CSS
 *  classique), une ligne de scan qui balaie l'écran, et par moments des SURPRISES : une vague de
 *  glitch qui parcourt l'écran, et le CRÂNE de piratage de Sombra qui
 *  se tape en ASCII caractère par caractère puis s'efface. Aléas figés au montage ; animations
 *  jouées en CSS (cf. index.css). */
function CyberDecor({ side }: { side?: 'left' | 'right' }) {
  const fireRef = useRef<() => void>(() => {}) // surprise : crâne ASCII
  useSurpriseSub(fireRef)
  const fireRef2 = useRef<() => void>(() => {}) // surprise : vague de glitch
  useSurpriseSub(fireRef2)
  // La colonne du décor déborde vers le bord EXTÉRIEUR : on biaise la répartition horizontale vers
  // le bord INTÉRIEUR visible (comme Ratigan / Crochet).
  const [lo, hi] = side === 'right' ? [-8, 100] : side === 'left' ? [0, 108] : [0, 100]
  // Colonnes de code qui tombent (tête cyan ou magenta tirée par colonne).
  const [cols] = useState(() =>
    Array.from({ length: 32 }, () => {
      const cyan = Math.random() < 0.5
      return {
        left: lo + Math.random() * (hi - lo), // %
        size: 1.4 + Math.random() * 1.5, // vh (taille de police)
        dur: 6 + Math.random() * 11, // s (vitesse de chute)
        delay: -(Math.random() * 17), // s (étalées sur tout le trajet)
        text: cyberColumnText(),
        head: cyan ? '#67e8f9' : '#e879f9', // tête : cyan / magenta
        tail: cyan ? 'rgba(34,211,238,0)' : 'rgba(168,85,247,0)', // traîne transparente
        op: 0.45 + Math.random() * 0.45,
      }
    }),
  )
  // SURPRISE : une vague de glitch balaie tout l'écran par moments, puis se dissipe ; on reprogramme
  // la suivante après un intervalle aléatoire (désactivée en reduced-motion).
  const [glitchOn, setGlitchOn] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let on: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const gap = () => 20000 + Math.random() * 28000 // 20–48 s entre deux vagues
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        setGlitchOn(true)
        on = setTimeout(() => {
          setGlitchOn(false)
          schedule(gap())
        }, 1100) // la vague dure ~1,1 s
      }, delay)
    }
    schedule(8000 + Math.random() * 10000) // première vague entre 8 et 18 s
    // MODE TEST : déclenche la vague de glitch à la demande.
    fireRef2.current = () => {
      setGlitchOn(true)
      on = setTimeout(() => setGlitchOn(false), 1100)
    }
    return () => {
      clearTimeout(next)
      clearTimeout(on)
    }
  }, [])
  // SURPRISE : le crâne ASCII se tape au centre, reste affiché, puis s'efface ; on reprogramme le
  // suivant (désactivée en reduced-motion).
  const [skull, setSkull] = useState(false)
  const [skullLeaving, setSkullLeaving] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let show: ReturnType<typeof setTimeout>
    let leave: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    const HOLD_MS = 3000 // crâne tenu après la frappe
    const FADE_MS = 900 // fondu de sortie (cf. transition CSS)
    const gap = () => 30000 + Math.random() * 30000 // 30–60 s entre deux apparitions
    const schedule = (delay: number) => {
      show = setTimeout(() => {
        setSkullLeaving(false)
        setSkull(true) // (re)monte CyberSkull → frappe depuis zéro
        leave = setTimeout(() => setSkullLeaving(true), SKULL_TYPE_MS + HOLD_MS)
        clear = setTimeout(() => {
          setSkull(false)
          setSkullLeaving(false)
          schedule(gap())
        }, SKULL_TYPE_MS + HOLD_MS + FADE_MS)
      }, delay)
    }
    schedule(12000 + Math.random() * 12000) // première apparition entre 12 et 24 s
    // MODE TEST : déclenche l'apparition du crâne à la demande.
    fireRef.current = () => {
      setSkullLeaving(false)
      setSkull(true)
      leave = setTimeout(() => setSkullLeaving(true), SKULL_TYPE_MS + HOLD_MS)
      clear = setTimeout(() => {
        setSkull(false)
        setSkullLeaving(false)
      }, SKULL_TYPE_MS + HOLD_MS + FADE_MS)
    }
    return () => {
      clearTimeout(show)
      clearTimeout(leave)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className={`cyber-decor${glitchOn ? ' is-glitching' : ''}`} aria-hidden>
      {/* Distorsion glitch en ARRIÈRE-PLAN (derrière la pluie) : deux copies décalées magenta/cyan
          découpées en tranches horizontales animées (clip-path) → smear RGB type datamosh. Les deux
          copies sont des pseudo-éléments (cf. .cyber-mosh::before/::after dans index.css). */}
      <div className="cyber-mosh" />
      {/* Pluie de code : colonnes de glyphes qui tombent (tête éclairée via dégradé clippé au texte). */}
      {cols.map((c, i) => (
        <span
          key={`col-${i}`}
          className="cyber-col"
          style={{
            left: `${c.left}%`,
            fontSize: `${c.size}vh`,
            opacity: c.op,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
            '--head': c.head,
            '--tail': c.tail,
          } as CSSProperties}
        >
          {c.text}
        </span>
      ))}
      {/* Ligne de scan qui balaie l'écran (par-dessus la pluie). */}
      <div className="cyber-sweep" />
      {/* Vague de glitch (jouée quand `is-glitching`). */}
      <div className="cyber-glitch" />
      {/* SURPRISE : crâne ASCII qui se tape au centre (au premier plan, lisible au-dessus du reste). */}
      {skull && <CyberSkull leaving={skullLeaving} />}
    </div>
  )
}

// Éclair de l'orage : flash bref (double-clignotement géré par le keyframe `caLightning`) à
// intervalle aléatoire. Désactivé en reduced-motion (le timer ne démarre pas).
const CA_LIGHTNING_GAP_MIN_MS = 7000
const CA_LIGHTNING_GAP_MAX_MS = 20000

/** Décor « assaut du château » (Gaston — La Belle et la Bête) : l'IMAGE du château de la Bête (`src`)
 *  ASSOMBRIE en nuit d'orage (filtre + voile bleu-nuit + vignette), sous une PLUIE battante et diagonale,
 *  avec des TORCHES qui crépitent au premier plan (la foule qui marche sur le château) d'où montent des
 *  braises, et par moments un ÉCLAIR qui illumine la scène. Éléments tirés une fois au montage ; éclair
 *  piloté par un timer (cf. index.css, section « assaut du château »). */
function CastleAssaultDecor({ decor }: { decor: Extract<VillainDecorData, { kind: 'castleAssault' }> }) {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Pluie : traits fins et diagonaux qui tombent vite, répartis sur toute la largeur, déphasés.
  const [rain] = useState(() =>
    Array.from({ length: 150 }, () => ({
      left: Math.random() * 100, // %
      len: 6 + Math.random() * 12, // vh (longueur du trait)
      dur: 0.45 + Math.random() * 0.5, // s (chute rapide)
      delay: -(Math.random() * 1.2), // s
      op: 0.16 + Math.random() * 0.34,
      thick: 0.8 + Math.random() * 0.9, // px
    })),
  )
  // Torches de la foule : elles DÉFILENT vers la DROITE en boucle (la foule en marche qui arrive par
  // la gauche, traverse, puis recycle hors champ). Réparties régulièrement, MÊME vitesse → espacement
  // constant ; chaque torche a sa taille/hauteur/cadence de crépitement. Le défilement anime `left`
  // (de -8 % à 108 %) ; un `left` statique sert de repli en reduced-motion (défilement coupé).
  const TORCH_COUNT = 9
  const TORCH_MARCH_S = 26 // s pour traverser la colonne
  const [torches] = useState(() =>
    Array.from({ length: TORCH_COUNT }, (_, i) => ({
      left: 4 + (i / (TORCH_COUNT - 1)) * 92, // % (repli statique réparti)
      bottom: 12 + Math.random() * 4, // vh (base, ~alignées)
      size: 2.6 + Math.random() * 2, // vh (hauteur de flamme)
      flickDur: 0.5 + Math.random() * 0.45, // s
      flickDelay: -(Math.random() * 1.5), // s
      marchDelay: -((i / TORCH_COUNT) * TORCH_MARCH_S) - Math.random() * 0.5, // s (étalées sur le trajet)
      bobDur: 0.5 + Math.random() * 0.3, // s (cadence du pas)
      bobDelay: -(Math.random() * 1), // s (déphasage : pas désynchronisés)
    })),
  )
  // Braises qui montent des torches.
  const [embers] = useState(() =>
    Array.from({ length: 26 }, () => ({
      left: Math.random() * 100, // %
      size: 1 + Math.random() * 2, // px
      dur: 3 + Math.random() * 3, // s
      delay: -(Math.random() * 6), // s
      drift: (Math.random() - 0.5) * 9, // vw
      op: 0.4 + Math.random() * 0.4,
    })),
  )
  // La FOULE : silhouettes de villageois qui MARCHENT avec les torches (mêmes animations `caTorchMarch`
  // + `caTorchBob`). La plupart brandissent une FOURCHE (pole + dents). Décalées par rapport aux torches
  // (marchDelay déphasé) pour s'entremêler. Silhouettes pures (presque noires) sur la lueur des torches.
  const CROWD_COUNT = 7
  const [crowd] = useState(() =>
    Array.from({ length: CROWD_COUNT }, (_, i) => ({
      left: 2 + (i / (CROWD_COUNT - 1)) * 96, // % (repli statique réparti)
      bottom: 1 + Math.random() * 3, // vh (les pieds, ~au sol)
      size: 9 + Math.random() * 4, // vh (hauteur de la silhouette)
      fork: Math.random() < 0.72, // ~72 % portent une fourche
      forkRot: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 10), // deg (côté + inclinaison)
      bobDur: 0.5 + Math.random() * 0.3, // s (cadence du pas)
      bobDelay: -(Math.random() * 1), // s
      marchDelay: -(((i + 0.5) / CROWD_COUNT) * TORCH_MARCH_S) - Math.random() * 0.5, // s (déphasées vs torches)
    })),
  )
  // FENÊTRES du château allumées : petites lueurs chaudes (la Bête veille à l'intérieur) qui vacillent
  // doucement, groupées sur la tour (centre-haut de l'image). Positions/réglages à ajuster si besoin.
  const CASTLE_WINDOWS = [
    { left: 44, top: 15, size: 1.5, dur: 3.2, delay: 0 },
    { left: 51.8, top: 15.5, size: 1.2, dur: 4.1, delay: -1.2 },
    { left: 44, top: 20, size: 1.1, dur: 3.6, delay: -2.1 },
    { left: 47.4, top: 6.5, size: 1.3, dur: 4.6, delay: -0.6 },
    { left: 47.6, top: 12, size: 1.0, dur: 3.9, delay: -3 },
  ]
  // Éclair : on incrémente un compteur à intervalle aléatoire ; le calque, monté avec `key={flash}`,
  // rejoue son animation de flash à chaque incrément.
  const [flash, setFlash] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    const schedule = () => {
      next = setTimeout(() => {
        setFlash((f) => f + 1)
        schedule()
      }, CA_LIGHTNING_GAP_MIN_MS + Math.random() * (CA_LIGHTNING_GAP_MAX_MS - CA_LIGHTNING_GAP_MIN_MS))
    }
    schedule()
    // MODE TEST : déclenche un éclair à la demande.
    fireRef.current = () => setFlash((f) => f + 1)
    return () => clearTimeout(next)
  }, [])
  return (
    <div className="ca-decor" aria-hidden>
      {/* Image du château assombrie (filtre nuit d'orage). */}
      <div className="ca-bg" style={{ backgroundImage: `url(${decor.src})` }} />
      {/* Voile d'orage bleu-nuit par-dessus l'image. */}
      <div className="ca-storm" />
      {/* Fenêtres du château allumées (lueurs chaudes qui vacillent ; derrière la pluie). */}
      {CASTLE_WINDOWS.map((w, i) => (
        <span
          key={`win-${i}`}
          className="ca-window"
          style={{
            left: `${w.left}%`,
            top: `${w.top}%`,
            width: `${w.size}vh`,
            height: `${w.size * 1.5}vh`,
            animationDuration: `${w.dur}s`,
            animationDelay: `${w.delay}s`,
          }}
        />
      ))}
      {/* Pluie battante diagonale. */}
      <div className="ca-rain">
        {rain.map((r, i) => (
          <span
            key={`rain-${i}`}
            className="ca-raindrop"
            style={{
              left: `${r.left}%`,
              width: `${r.thick}px`,
              height: `${r.len}vh`,
              opacity: r.op,
              animationDuration: `${r.dur}s`,
              animationDelay: `${r.delay}s`,
            }}
          />
        ))}
      </div>
      {/* Lueur chaude collective au sol (les torches de la foule). */}
      <div className="ca-fireglow" />
      {/* La FOULE : silhouettes de villageois qui marchent (mêmes animations que les torches), la
          plupart brandissant une fourche. Rendues AVANT les torches → les flammes passent devant. */}
      {crowd.map((c, i) => (
        <div
          key={`vil-${i}`}
          className="ca-villager"
          style={{
            left: `${c.left}%`,
            bottom: `${c.bottom}vh`,
            animationDuration: `${TORCH_MARCH_S}s, ${c.bobDur}s`,
            animationDelay: `${c.marchDelay}s, ${c.bobDelay}s`,
          }}
        >
          {c.fork && (
            <span
              className="ca-pitchfork"
              style={{ height: `${c.size * 0.95}vh`, bottom: `${c.size * 0.55}vh`, transform: `rotate(${c.forkRot}deg)` }}
            />
          )}
          <span className="ca-villager-body" style={{ width: `${c.size * 0.4}vh`, height: `${c.size * 0.78}vh` }} />
          <span className="ca-villager-head" style={{ width: `${c.size * 0.26}vh`, height: `${c.size * 0.26}vh`, bottom: `${c.size * 0.72}vh` }} />
        </div>
      ))}
      {/* Torches : bâton + halo + flamme qui crépite. La flamme et le halo sont posés au SOMMET du
          bâton (bottom = hauteur du bâton). */}
      {torches.map((t, i) => {
        const stickH = t.size * 1.6 // vh (hauteur du bâton sous la flamme)
        return (
          <div
            key={`torch-${i}`}
            className="ca-torch"
            style={{
              left: `${t.left}%`,
              bottom: `${t.bottom}vh`,
              animationDuration: `${TORCH_MARCH_S}s, ${t.bobDur}s`,
              animationDelay: `${t.marchDelay}s, ${t.bobDelay}s`,
            }}
          >
            <span className="ca-torch-stick" style={{ width: `${t.size * 0.22}vh`, height: `${stickH}vh` }} />
            <span
              className="ca-torch-glow"
              style={{ width: `${t.size * 3}vh`, height: `${t.size * 3}vh`, bottom: `${stickH}vh`, animationDuration: `${t.flickDur}s`, animationDelay: `${t.flickDelay}s` }}
            />
            <span
              className="ca-flame"
              style={{ width: `${t.size * 0.6}vh`, height: `${t.size}vh`, bottom: `${stickH}vh`, animationDuration: `${t.flickDur}s`, animationDelay: `${t.flickDelay}s` }}
            />
          </div>
        )
      })}
      {/* Braises qui montent des torches. */}
      {embers.map((e, i) => (
        <span
          key={`ember-${i}`}
          className="ca-ember"
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
      {/* Éclair (rejoué à chaque incrément de `flash`). */}
      <div className="ca-lightning" key={flash} />
    </div>
  )
}

// Teintes de la magie de Mim (rose dominant + un peu de violet — « I love PINK! »).
const MIM_SMOKE_TINTS = [
  'radial-gradient(circle, rgba(255, 120, 210, 0.9) 0%, rgba(220, 90, 200, 0.45) 45%, rgba(150, 60, 160, 0) 72%)', // rose
  'radial-gradient(circle, rgba(214, 130, 255, 0.85) 0%, rgba(170, 90, 230, 0.42) 45%, rgba(110, 60, 170, 0) 72%)', // violet
]
const MIM_SPARK_COLORS = ['#ff8de0', '#ff5fc8', '#e07bff', '#ffb3ec']
// Palette des étoiles + points colorés flottant dans le décor (couleurs demandées).
const MIM_DECO_COLORS = ['#EE8B2D', '#C79C3B', '#C5CBD7', '#AA578A', '#328498']
// Sommets d'une étoile à `points` branches, centrée (50,50) dans un viewBox 100×100. `innerRatio` =
// rapport rayon intérieur / extérieur (creux des branches). Pointe du haut en premier.
function mimStarPolygon(points: number, innerRatio: number): string {
  const outer = 48
  const inner = outer * innerRatio
  const verts: string[] = []
  const step = Math.PI / points
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + i * step
    verts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`)
  }
  return verts.join(' ')
}

// Les transformations du DUEL DE SORCIERS (images détourées, fond transparent). Chaque sorcier se
// balade dans la colonne et passe d'un animal à l'autre toutes les minutes. Mim = fumée ROSE, Merlin
// (son adversaire) = fumée BLEUE.
// Les PNG sont DÉTOURÉS AU PLUS JUSTE (bordures transparentes retirées) → la hauteur de l'image = la
// hauteur visible de l'animal. On applique alors un facteur `scale` propre à chaque animal pour une
// taille relative NATURELLE (souris minuscule, éléphant imposant), au lieu de tout afficher à l'identique.
type DuelAnimal = { src: string; scale: number }
const MIM_ANIMALS: DuelAnimal[] = [
  { src: '/animations/mim-crocodile.png', scale: 1.35 },
  { src: '/animations/mim-lion.png', scale: 1.3 }, // « tigre » (félin)
  { src: '/animations/mim-fox.png', scale: 0.82 },
  { src: '/animations/mim-snake.png', scale: 0.8 }, // serpent lové, compact
  { src: '/animations/mim-elephant.png', scale: 1.55 },
  { src: '/animations/mim-rhinoceros.png', scale: 1.15 },
  { src: '/animations/mim-poule.png', scale: 0.6 },
  { src: '/animations/mim-dragon.png', scale: 4.2 },
]
const MERLIN_ANIMALS: DuelAnimal[] = [
  { src: '/animations/merlin-1.png', scale: 0.92 }, // bouc
  { src: '/animations/merlin-2.png', scale: 0.62 }, // souris
  { src: '/animations/merlin-3.png', scale: 0.66 }, // crabe (large, bas)
  { src: '/animations/merlin-4.png', scale: 0.4 }, // tortue
  { src: '/animations/merlin-5.png', scale: 0.136 }, // chenille
  { src: '/animations/merlin-6.png', scale: 1.3 }, // morse / phoque
  { src: '/animations/merlin-7.png', scale: 0.78 }, // lièvre
]
// ⚠️ Réglage : 10_000 pour défiler vite et VOIR toutes les transformations. À REMETTRE 60_000 avant commit.
const MIM_MORPH_MS = 10_000 // une transformation par minute (réglage temporaire : 10 s)
// Bouffées de fumée (radial-gradient posé en inline sur `.duel-puff`) et halo de la créature.
const MIM_PUFF_BG = 'radial-gradient(circle, rgba(255, 150, 225, 0.95) 0%, rgba(230, 110, 220, 0.7) 40%, rgba(180, 80, 190, 0) 72%)'
const MERLIN_PUFF_BG = 'radial-gradient(circle, rgba(150, 200, 255, 0.95) 0%, rgba(100, 150, 235, 0.7) 40%, rgba(70, 110, 190, 0) 72%)'
// SURPRISE : pluie des 54 cartes (planche cards_game découpée, cf. public/animations/cards/) qui tombent
// en tournoyant dans la colonne, par moments, puis cesse. Minuterie aléatoire (comme les surprises de
// Scar/Yzma). Image tirée au hasard par carte.
const MIM_CARD_IMAGES = Array.from(
  { length: 54 },
  (_, i) => `/animations/cards/card-${String(i + 1).padStart(2, '0')}.png`,
)
const MIM_CARD_DURATION_MS = 6500 // durée d'une averse de cartes
const MIM_CARD_GAP_MIN_MS = 60_000 // averse toutes les 1 à 3 min
const MIM_CARD_GAP_MAX_MS = 180_000

/** Un sorcier transformé qui DÉFILE horizontalement le long du BAS de la colonne (ancré au sol, pour
 *  rester visible sous le plateau) et se TRANSFORME toutes les minutes : une bouffée de fumée (`puffBg`)
 *  recouvre le swap, et le nouvel animal SURGIT de la fumée (`.duel-creature-pop`). Il fait demi-tour aux
 *  bords. `firstMs` décale la 1ʳᵉ transformation (pour désynchroniser Mim et Merlin → effet de duel).
 *  Ordre tiré au montage. Position en requestAnimationFrame (UI). En reduced-motion : posé au sol, au
 *  centre, immobile, sans transformation. */
function DuelWanderer({ animals, puffBg, halo, firstMs }: { animals: DuelAnimal[]; puffBg: string; halo: string; firstMs: number }) {
  const [order] = useState(() => [...animals].sort(() => Math.random() - 0.5))
  const [v] = useState(() => ({
    size: 15 + Math.random() * 4, // vh (hauteur de l'animal)
    speed: 4 + Math.random() * 3, // % de la largeur / s
    dir: Math.random() < 0.5 ? -1 : 1, // sens de marche initial
    lean: 2 + Math.random() * 3, // deg (tangage léger)
    leanDur: 4 + Math.random() * 2, // s
  }))
  const [step, setStep] = useState(0) // index dans `order`
  const [puffKey, setPuffKey] = useState(0) // remonte le puff à chaque transformation
  const ref = useRef<HTMLSpanElement>(null)
  // Marche horizontale ancrée au bas de la colonne (RAF) : seul `x` bouge, `y` est recollé au sol à
  // chaque frame (la hauteur change à la transformation → la créature « pousse » vers le haut depuis le sol).
  useEffect(() => {
    const el = ref.current
    const box = el?.parentElement // .mim-decor
    if (!el || !box) return
    // Hauteur au-dessus du sol (les animaux ne défilent pas tout en bas de la colonne).
    const lift = box.clientHeight * 0.22
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.style.transform = `translate(${(box.clientWidth - el.offsetWidth) / 2}px, ${box.clientHeight - el.offsetHeight - lift}px)`
      return
    }
    let x = Math.random() * Math.max(1, box.clientWidth - el.offsetWidth)
    const px = (box.clientWidth * v.speed) / 100 / 1000 // px/ms (horizontal)
    let vx = v.dir * px
    let raf = 0
    let last = 0
    const stepFn = (t: number) => {
      const dt = last ? Math.min(t - last, 50) : 0 // ms (borné : pas de saut au retour d'onglet)
      last = t
      const W = box.clientWidth
      const w = el.offsetWidth
      const h = el.offsetHeight
      // Marge horizontale : on rétrécit la plage de marche (demi-tour avant les bords de la colonne).
      const margin = W * 0.2
      const minX = margin
      const maxX = Math.max(minX, W - w - margin)
      x += vx * dt
      if (x <= minX) { x = minX; vx = Math.abs(vx) } else if (x >= maxX) { x = maxX; vx = -Math.abs(vx) }
      const y = box.clientHeight - h - lift // ancré au sol, remonté de `lift`
      el.style.transform = `translate(${x}px, ${y}px)`
      raf = requestAnimationFrame(stepFn)
    }
    raf = requestAnimationFrame(stepFn)
    return () => cancelAnimationFrame(raf)
  }, [v])
  // Transformation toutes les minutes (1ʳᵉ après `firstMs`) : animal suivant + bouffée de fumée.
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let interval = 0
    const morph = () => {
      setStep((s) => (s + 1) % order.length)
      setPuffKey((k) => k + 1)
    }
    const lead = window.setTimeout(() => {
      morph()
      interval = window.setInterval(morph, MIM_MORPH_MS)
    }, firstMs)
    return () => {
      window.clearTimeout(lead)
      window.clearInterval(interval)
    }
  }, [order.length, firstMs])
  return (
    <span ref={ref} className="duel-wanderer">
      {/* Bouffée de fumée qui recouvre la transformation (rejouée à chaque step ; couleur en inline). */}
      {puffKey > 0 && <span key={`puff-${puffKey}`} className="duel-puff" style={{ height: `${v.size * 1.7}vh`, background: puffBg }} />}
      {/* L'animal courant : surgit de la fumée (pop, rejoué via key) ; l'image tangue doucement. */}
      <span key={`an-${step}`} className="duel-creature-pop">
        <img
          src={order[step].src}
          alt=""
          className="duel-creature"
          draggable={false}
          style={{ height: `${v.size * order[step].scale}vh`, filter: `drop-shadow(0 0 1.4vh ${halo})`, animationDuration: `${v.leanDur}s`, '--lean': `${v.lean}deg` } as CSSProperties}
        />
      </span>
    </span>
  )
}

/** Décor « magie de Mad Madam Mim » (Merlin l'Enchanteur) — 100 % CSS (hors transformations). Pénombre
 *  VIOLETTE, LUEUR magenta pulsante, VOLUTES de fumée ROSE & violette qui montent (réutilise `vaporRise`)
 *  et fines ÉTINCELLES roses qui montent en scintillant. Par-dessus, le DUEL DE SORCIERS : Mim (fumée
 *  rose) et Merlin (fumée bleue) se baladent dans la colonne et se transforment chacun toutes les
 *  minutes (cf. `DuelWanderer`). */
function MimDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Volutes de fumée rose/violette : quelques évents en bas, bouffées étagées par évent → colonnes.
  const VENTS = 5
  const PER_VENT = 4
  const SMOKE_DUR = 12 // s (sert à étager les départs)
  const [smoke] = useState(() =>
    Array.from({ length: VENTS }, (_, v) => ({
      left: 8 + (v / (VENTS - 1)) * 84, // %
      puffs: Array.from({ length: PER_VENT }, (_, p) => ({
        size: 16 + Math.random() * 14, // vh
        dur: SMOKE_DUR + Math.random() * 5, // s
        delay: -((p / PER_VENT) * SMOKE_DUR) - Math.random() * 2, // s (étagé → colonne continue)
        sx: (Math.random() - 0.5) * 9, // vw (enroulement latéral)
        op: 0.16 + Math.random() * 0.16,
        tint: MIM_SMOKE_TINTS[Math.floor(Math.random() * MIM_SMOKE_TINTS.length)],
      })),
    })),
  )
  // Étincelles roses qui montent en ondulant et en scintillant (enveloppe = montée, milieu =
  // ondulation, pastille = scintillement — réutilise les motes de Facilier).
  const [motes] = useState(() =>
    Array.from({ length: 40 }, () => ({
      left: Math.random() * 100, // %
      size: 1.6 + Math.random() * 2.8, // px
      dur: 8 + Math.random() * 8, // s (montée lente)
      delay: -(Math.random() * 16), // s
      sway: 2 + Math.random() * 5, // vw
      swayDur: 3 + Math.random() * 3, // s
      twkDur: 1.3 + Math.random() * 1.8, // s
      twkDelay: -(Math.random() * 3), // s
      op: 0.4 + Math.random() * 0.5,
      color: MIM_SPARK_COLORS[Math.floor(Math.random() * MIM_SPARK_COLORS.length)],
    })),
  )
  // Étoiles colorées (nombre de branches variable 4→8) qui scintillent, dispersées dans la colonne.
  const [stars] = useState(() =>
    Array.from({ length: 16 }, () => {
      const points = 4 + Math.floor(Math.random() * 5) // 4..8 branches
      return {
        left: Math.random() * 100, // %
        top: Math.random() * 100, // %
        size: 1.5 + Math.random() * 2.6, // vh
        rot: Math.random() * 360, // deg
        color: MIM_DECO_COLORS[Math.floor(Math.random() * MIM_DECO_COLORS.length)],
        poly: mimStarPolygon(points, 0.4 + Math.random() * 0.14),
        twkDur: 2.2 + Math.random() * 2.6, // s
        twkDelay: -(Math.random() * 5), // s
        op: 0.45 + Math.random() * 0.45,
      }
    }),
  )
  // Points colorés (pastilles) qui scintillent.
  const [dots] = useState(() =>
    Array.from({ length: 24 }, () => ({
      left: Math.random() * 100, // %
      top: Math.random() * 100, // %
      size: 2 + Math.random() * 4, // px
      color: MIM_DECO_COLORS[Math.floor(Math.random() * MIM_DECO_COLORS.length)],
      twkDur: 1.6 + Math.random() * 2.4, // s
      twkDelay: -(Math.random() * 5), // s
      op: 0.4 + Math.random() * 0.5,
    })),
  )
  // SURPRISE : averse de cartes qui tombent en tournoyant. Calque (dé)monté le temps de la scène,
  // piloté par un timer aléatoire. Désactivé en reduced-motion (le timer ne démarre pas).
  const [cards, setCards] = useState<{
    seq: number
    items: { key: string; img: string; left: number; size: number; dur: number; delay: number; spin: number }[]
  } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () => MIM_CARD_GAP_MIN_MS + Math.random() * (MIM_CARD_GAP_MAX_MS - MIM_CARD_GAP_MIN_MS)
    const fire = fireRef.current = () => {
      const s = seq++
      const n = 14 + Math.floor(Math.random() * 10) // 14..23 cartes
      const items = Array.from({ length: n }, (_, i) => ({
        key: `${s}-${i}`,
        img: MIM_CARD_IMAGES[Math.floor(Math.random() * MIM_CARD_IMAGES.length)],
        left: 2 + Math.random() * 92, // % de la largeur de la colonne
        size: 7 + Math.random() * 5, // vh (hauteur de carte)
        dur: 2.6 + Math.random() * 2.4, // s (vitesse de chute)
        delay: Math.random() * 2.8, // s (étalement de l'averse)
        spin: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 480), // tours, sens au hasard
      }))
      setCards({ seq: s, items })
      clear = setTimeout(() => {
        setCards(null)
        next = setTimeout(fire, gap())
      }, MIM_CARD_DURATION_MS)
    }
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className="mim-decor" aria-hidden>
      {/* Lueur magenta pulsante (par-dessous). */}
      <div className="mim-glow" />
      {/* Volutes de fumée rose/violette. */}
      {smoke.map((vent, v) =>
        vent.puffs.map((p, i) => (
          <span
            key={`smoke-${v}-${i}`}
            className="mim-smoke"
            style={{
              left: `${vent.left}%`,
              width: `${p.size}vh`,
              height: `${p.size}vh`,
              background: p.tint,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              '--sx': `${p.sx}vw`,
              '--vop': p.op,
            } as CSSProperties}
          />
        )),
      )}
      {/* Étincelles roses (montée > ondulation > scintillement). */}
      {motes.map((m, i) => (
        <span
          key={`mote-${i}`}
          className="voodoo-mote-rise"
          style={{ left: `${m.left}%`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
        >
          <span
            className="voodoo-mote-sway"
            style={{ animationDuration: `${m.swayDur}s`, animationDelay: `${m.delay}s`, '--sway': `${m.sway}vw` } as CSSProperties}
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
      {/* Étoiles colorées (nombre de branches variable) qui scintillent. */}
      {stars.map((s, i) => (
        <svg
          key={`star-${i}`}
          className="mim-star"
          viewBox="0 0 100 100"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}vh`,
            height: `${s.size}vh`,
            color: s.color,
            opacity: s.op,
            transform: `translate(-50%, -50%) rotate(${s.rot}deg)`,
            animationDuration: `${s.twkDur}s`,
            animationDelay: `${s.twkDelay}s`,
          }}
        >
          <polygon points={s.poly} fill="currentColor" />
        </svg>
      ))}
      {/* Points colorés (pastilles) qui scintillent. */}
      {dots.map((d, i) => (
        <span
          key={`dot-${i}`}
          className="mim-dot"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: `${d.size}px`,
            height: `${d.size}px`,
            background: d.color,
            color: d.color,
            opacity: d.op,
            animationDuration: `${d.twkDur}s`,
            animationDelay: `${d.twkDelay}s`,
          }}
        />
      ))}
      {/* SURPRISE : averse de cartes (les 54 cartes) qui tombent en tournoyant, par moments. */}
      {cards && (
        <div className="mim-cards">
          {cards.items.map((c) => (
            <img
              key={c.key}
              src={c.img}
              alt=""
              className="mim-card-fall"
              draggable={false}
              style={{
                left: `${c.left}%`,
                height: `${c.size}vh`,
                animationDuration: `${c.dur}s`,
                animationDelay: `${c.delay}s`,
                '--spin': `${c.spin}deg`,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
      {/* Le DUEL DE SORCIERS : Mim (fumée rose) et Merlin (fumée bleue) se baladent et se transforment
          chacun toutes les minutes, décalés d'une demi-minute pour un effet d'échange. */}
      <DuelWanderer animals={MIM_ANIMALS} puffBg={MIM_PUFF_BG} halo="rgba(255, 110, 210, 0.7)" firstMs={MIM_MORPH_MS} />
      <DuelWanderer animals={MERLIN_ANIMALS} puffBg={MERLIN_PUFF_BG} halo="rgba(110, 170, 255, 0.7)" firstMs={MIM_MORPH_MS / 2} />
    </div>
  )
}

// Teinte des volutes de vapeur du Chaudron (radial-gradient vert posé en inline) + couleurs des âmes.
const CAULDRON_SMOKE_TINT =
  'radial-gradient(circle, rgba(150, 255, 165, 0.55) 0%, rgba(60, 200, 110, 0.32) 45%, rgba(20, 100, 55, 0) 72%)'
// Teinte DORÉE (#FFD70C) de la 2ᵉ surprise : la vapeur du chaudron vire à l'or.
const CAULDRON_SMOKE_TINT_GOLD =
  'radial-gradient(circle, rgba(255, 240, 140, 0.6) 0%, rgba(255, 215, 12, 0.34) 45%, rgba(150, 115, 0, 0) 72%)'
const CAULDRON_SOUL_COLORS = ['#9dffb0', '#6bffae', '#bfffd0', '#7cffa0', '#5fe39a']
// SURPRISE « Éruption du Chaudron » : par moments, la gueule s'embrase, une gerbe de vapeur verte
// jaillit et les SOLDATS RESSUSCITÉS (image `squelettes.png`) se dressent hors du chaudron puis y
// retombent. Intervalle aléatoire (`..._GAP_MIN/MAX_MS`). MODE TEST : à `true`, éruptions fréquentes
// (~8 s) pour régler ; À REMETTRE `false` avant commit.
const CAULDRON_ERUPT_TEST = false
const CAULDRON_ERUPT_DUR_MS = 16500 // durée d'une éruption : montée (~2 s) + maintien (~12,5 s) + retombée (~2 s)
const CAULDRON_ERUPT_GAP_MIN_MS = CAULDRON_ERUPT_TEST ? 6000 : 80000
const CAULDRON_ERUPT_GAP_MAX_MS = CAULDRON_ERUPT_TEST ? 10000 : 160000
// 2ᵉ SURPRISE « Vapeur dorée » : par moments, la vapeur verte du chaudron VIRE À L'OR (#FFD70C) — la
// fumée et la lueur passent au doré le temps de la scène, puis reviennent au vert (fondu croisé).
// MODE TEST : à `true`, fréquent (~8 s) pour régler ; À REMETTRE `false` avant commit.
const CAULDRON_GOLD_TEST = false
const CAULDRON_GOLD_DUR_MS = 9000 // durée de la scène dorée (fondus d'entrée/sortie inclus)
const CAULDRON_GOLD_GAP_MIN_MS = CAULDRON_GOLD_TEST ? 6000 : 70000
const CAULDRON_GOLD_GAP_MAX_MS = CAULDRON_GOLD_TEST ? 10000 : 150000

/** Décor « salle du Chaudron Noir » (Le Seigneur des Ténèbres — Le Chaudron Magique) — 100 % CSS (hors
 *  l'image des squelettes). Crypte de pierre SOMBRE, lueur verte pulsante au sol, le CHAUDRON NOIR au
 *  centre-bas avec sa gueule de bouillon VERT lumineux qui palpite, VOLUTES de vapeur verte qui montent
 *  (réutilise `vaporRise`) et ÂMES/feux follets verts qui s'élèvent. SURPRISE périodique : éruption —
 *  flash vert + gerbe de vapeur + les Soldats Ressuscités se dressent hors du chaudron puis y retombent. */
function CauldronDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Volutes de vapeur VERTE qui montent de la gueule du Chaudron (concentrées au centre, au-dessus du pot).
  const SMOKE = 30
  const SMOKE_DUR = 11 // s (sert à étager les départs → colonne continue)
  const [smoke] = useState(() =>
    Array.from({ length: SMOKE }, (_, i) => ({
      left: 34 + Math.random() * 32, // % (centré sur le chaudron, un peu plus large)
      size: 14 + Math.random() * 16, // vh
      dur: SMOKE_DUR + Math.random() * 5, // s
      delay: -((i / SMOKE) * SMOKE_DUR) - Math.random() * 2, // s (étagé → colonne dense et continue)
      sx: (Math.random() - 0.5) * 11, // vw (enroulement latéral)
      op: 0.16 + Math.random() * 0.18,
    })),
  )
  // Âmes / feux follets verts qui montent en ondulant et scintillant (enveloppe = montée, milieu =
  // ondulation, pastille = scintillement — réutilise les motes de Facilier, comme le décor de Mim).
  const [souls] = useState(() =>
    Array.from({ length: 30 }, () => ({
      left: Math.random() * 100, // %
      size: 1.8 + Math.random() * 3, // px
      dur: 9 + Math.random() * 8, // s (montée lente)
      delay: -(Math.random() * 17), // s
      sway: 2 + Math.random() * 5, // vw
      swayDur: 3 + Math.random() * 3, // s
      twkDur: 1.4 + Math.random() * 1.8, // s
      twkDelay: -(Math.random() * 3), // s
      op: 0.4 + Math.random() * 0.5,
      color: CAULDRON_SOUL_COLORS[Math.floor(Math.random() * CAULDRON_SOUL_COLORS.length)],
    })),
  )
  // SURPRISE « éruption » : tirée par à-coups (timer aléatoire). `erupt` porte la séquence (re-monte les
  // calques via `key`) + des bouffées de vapeur qui jaillissent. Désactivée en reduced-motion.
  const [erupt, setErupt] = useState<{
    seq: number
    puffs: { key: string; left: number; size: number; delay: number; sx: number; op: number }[]
  } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () => CAULDRON_ERUPT_GAP_MIN_MS + Math.random() * (CAULDRON_ERUPT_GAP_MAX_MS - CAULDRON_ERUPT_GAP_MIN_MS)
    const fire = fireRef.current = () => {
      const s = seq++
      // Grosses bouffées de vapeur verte qui jaillissent de la gueule, étalées sur le début de l'éruption.
      const puffs = Array.from({ length: 12 }, (_, i) => ({
        key: `${s}-${i}`,
        left: 36 + Math.random() * 28, // % (centré sur le chaudron)
        size: 18 + Math.random() * 18, // vh
        delay: Math.random() * 1.1, // s (jaillissent ~ensemble)
        sx: (Math.random() - 0.5) * 16, // vw (enroulement)
        op: 0.22 + Math.random() * 0.2,
      }))
      setErupt({ seq: s, puffs })
      clear = setTimeout(() => {
        setErupt(null)
        next = setTimeout(fire, gap())
      }, CAULDRON_ERUPT_DUR_MS)
    }
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  // 2ᵉ SURPRISE « vapeur dorée » : timer aléatoire indépendant. `golden` = n° de la scène (null = vert
  // normal). Pendant la scène, une COUCHE de vapeur dorée (mêmes positions) se fond par-dessus le vert.
  const [golden, setGolden] = useState<number | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () => CAULDRON_GOLD_GAP_MIN_MS + Math.random() * (CAULDRON_GOLD_GAP_MAX_MS - CAULDRON_GOLD_GAP_MIN_MS)
    const fire = fireRef.current = () => {
      setGolden(seq++)
      clear = setTimeout(() => {
        setGolden(null)
        next = setTimeout(fire, gap())
      }, CAULDRON_GOLD_DUR_MS)
    }
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className="cauldron-decor" aria-hidden>
      {/* Lueur verte pulsante (au sol, par-dessous). */}
      <div className="cauldron-glow" />
      {/* Âmes vertes qui montent (montée > ondulation > scintillement). */}
      {souls.map((m, i) => (
        <span
          key={`soul-${i}`}
          className="voodoo-mote-rise"
          style={{ left: `${m.left}%`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
        >
          <span
            className="voodoo-mote-sway"
            style={{ animationDuration: `${m.swayDur}s`, animationDelay: `${m.delay}s`, '--sway': `${m.sway}vw` } as CSSProperties}
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
      {/* SURPRISE — les SOLDATS RESSUSCITÉS se dressent hors du chaudron (rendus AVANT le pot → leur bas
          est masqué par le corps du chaudron, ils semblent en émerger), puis y retombent. */}
      {erupt && (
        <img
          key={`sk-${erupt.seq}`}
          src="/animations/squelettes.png"
          alt=""
          className="cauldron-skeletons"
          draggable={false}
          style={{ '--dur': `${CAULDRON_ERUPT_DUR_MS}ms` } as CSSProperties}
        />
      )}
      {/* Le CHAUDRON NOIR au centre-bas : corps sombre, gueule de bouillon vert lumineux qui palpite. */}
      <div className="cauldron-pot">
        <span className="cauldron-rim" />
        <span className={`cauldron-mouth${erupt ? ' is-erupting' : ''}`} />
      </div>
      {/* Volutes de vapeur verte par-dessus la gueule du chaudron. */}
      {smoke.map((p, i) => (
        <span
          key={`csmoke-${i}`}
          className="cauldron-smoke"
          style={{
            left: `${p.left}%`,
            width: `${p.size}vh`,
            height: `${p.size}vh`,
            background: CAULDRON_SMOKE_TINT,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            '--sx': `${p.sx}vw`,
            '--vop': p.op,
          } as CSSProperties}
        />
      ))}
      {/* 2ᵉ SURPRISE — la vapeur vire à l'OR (#FFD70C) : couche dorée (mêmes positions que le vert) qui
          se fond par-dessus le temps de la scène, plus une lueur dorée. */}
      {golden !== null && (
        <div key={`gold-${golden}`} className="cauldron-gold" style={{ '--dur': `${CAULDRON_GOLD_DUR_MS}ms` } as CSSProperties}>
          <div className="cauldron-glow-gold" />
          {smoke.map((p, i) => (
            <span
              key={`gsmoke-${i}`}
              className="cauldron-smoke"
              style={{
                left: `${p.left}%`,
                width: `${p.size}vh`,
                height: `${p.size}vh`,
                background: CAULDRON_SMOKE_TINT_GOLD,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
                '--sx': `${p.sx}vw`,
                '--vop': p.op,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
      {/* SURPRISE — flash vert + gerbe de vapeur qui jaillit (par-dessus le chaudron). */}
      {erupt && (
        <>
          <span key={`fl-${erupt.seq}`} className="cauldron-flash" style={{ '--dur': `${CAULDRON_ERUPT_DUR_MS}ms` } as CSSProperties} />
          {erupt.puffs.map((p) => (
            <span
              key={p.key}
              className="cauldron-erupt-puff"
              style={{
                left: `${p.left}%`,
                width: `${p.size}vh`,
                height: `${p.size}vh`,
                background: CAULDRON_SMOKE_TINT,
                animationDelay: `${p.delay}s`,
                '--sx': `${p.sx}vw`,
                '--vop': p.op,
              } as CSSProperties}
            />
          ))}
        </>
      )}
    </div>
  )
}

// SURPRISE : averse de JOUETS de Sunnyside (détourés, public/animations/toys/) qui tombent en tournoyant,
// par moments, puis cesse. Minuterie aléatoire (comme la pluie de cartes de Mim).
// Chaque jouet apparaît UNE seule fois par averse, SAUF l'alien (les petits aliens vont en bande →
// plusieurs exemplaires).
const SUNNY_TOY_ALIEN = '/animations/toys/toy_alien.png'
const SUNNY_TOY_UNIQUE = [
  'baby', 'chenille', 'chunk', 'clown', 'insecte',
  'ken', 'petit_bois', 'phone', 'pieuvre', 'robot', 'singe',
].map((n) => `/animations/toys/toy_${n}.png`)
const SUNNY_TOY_DURATION_MS = 7000 // durée d'une averse de jouets
const SUNNY_TOY_GAP_MIN_MS = 60_000 // averse toutes les 1 à 3 min
const SUNNY_TOY_GAP_MAX_MS = 180_000
// Couleurs des ballons de garderie qui montent.
const SUNNY_BALLOON_COLORS = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9ec7']

/** Décor « sunnyside » (Lotso — Toy Story 3) : la garderie Sunnyside, sur fond du PAPIER PEINT D'ANDY
 *  (ciel bleu + nuages blancs floconneux). Les nuages DÉRIVENT lentement en boucle (vitesse/altitude/
 *  taille variées) ; une teinte ROSE FRAISE chaude baigne le bas (Lotso sent la fraise) ; de douces
 *  PAILLETTES montent en scintillant et une vignette tiède encadre le tout. Par moments, SURPRISE : une
 *  averse de JOUETS tombe en tournoyant. 100 % CSS. En reduced-motion : tout est figé. */
function SunnysideDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Nuages floconneux qui dérivent : altitude (top), taille, vitesse et phase variées. Chacun est un
  // amas de bosses (`.sunny-cloud` + pseudo-éléments en CSS) ; `--drift` = sens/longueur du trajet.
  const [clouds] = useState(() =>
    Array.from({ length: 9 }, (_, i) => ({
      top: 4 + Math.random() * 62, // % (réparti sur le haut/milieu)
      size: 9 + Math.random() * 12, // vh (hauteur de l'amas)
      dur: 38 + Math.random() * 40, // s (dérive lente)
      delay: -(Math.random() * 70), // s (phase décalée → déjà en place au montage)
      dir: i % 2 === 0 ? 1 : -1, // sens de dérive alterné
      op: 0.82 + Math.random() * 0.18,
    })),
  )
  // Douces paillettes chaudes qui montent en ondulant et scintillant (réutilise les motes de Facilier).
  const [motes] = useState(() =>
    Array.from({ length: 28 }, () => ({
      left: Math.random() * 100, // %
      size: 1.4 + Math.random() * 2.6, // px
      dur: 9 + Math.random() * 8, // s (montée lente)
      delay: -(Math.random() * 17), // s
      sway: 2 + Math.random() * 4, // vw
      swayDur: 3 + Math.random() * 3, // s
      twkDur: 1.4 + Math.random() * 1.8, // s
      twkDelay: -(Math.random() * 3), // s
      op: 0.35 + Math.random() * 0.4,
    })),
  )
  // Ballons colorés qui montent en ondulant (ambiance garderie) : enveloppe = montée, intérieur = sway.
  const [balloons] = useState(() =>
    Array.from({ length: 6 }, () => ({
      left: 4 + Math.random() * 92, // %
      size: 7 + Math.random() * 5, // vh (hauteur du ballon)
      dur: 16 + Math.random() * 12, // s (montée lente)
      delay: -(Math.random() * 26), // s (phase décalée → déjà en route au montage)
      sway: 2 + Math.random() * 4, // vw
      swayDur: 3.5 + Math.random() * 2.5, // s
      color: SUNNY_BALLOON_COLORS[Math.floor(Math.random() * SUNNY_BALLOON_COLORS.length)],
    })),
  )
  // SURPRISE : averse de jouets qui tombent en tournoyant. Calque (dé)monté le temps de la scène, piloté
  // par un timer aléatoire. Désactivé en reduced-motion (le timer ne démarre pas).
  const [toys, setToys] = useState<{
    seq: number
    items: { key: string; img: string; left: number; size: number; dur: number; delay: number; spin: number }[]
  } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () => SUNNY_TOY_GAP_MIN_MS + Math.random() * (SUNNY_TOY_GAP_MAX_MS - SUNNY_TOY_GAP_MIN_MS)
    const fire = fireRef.current = () => {
      const s = seq++
      // Chaque jouet unique une fois + une bande d'aliens (3 à 7 exemplaires), le tout mélangé.
      const aliens = 3 + Math.floor(Math.random() * 5) // 3..7 aliens
      const imgs = [...SUNNY_TOY_UNIQUE, ...Array.from({ length: aliens }, () => SUNNY_TOY_ALIEN)]
      for (let i = imgs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[imgs[i], imgs[j]] = [imgs[j], imgs[i]]
      }
      const items = imgs.map((img, i) => ({
        key: `${s}-${i}`,
        img,
        left: 2 + Math.random() * 92, // % de la largeur de la colonne
        // Les aliens sont plus petits que les autres jouets.
        size: img === SUNNY_TOY_ALIEN ? 5 + Math.random() * 2.5 : 8 + Math.random() * 6, // vh
        dur: 2.8 + Math.random() * 2.6, // s (vitesse de chute)
        delay: Math.random() * 3, // s (étalement de l'averse)
        spin: (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 360), // tours, sens au hasard
      }))
      setToys({ seq: s, items })
      clear = setTimeout(() => {
        setToys(null)
        next = setTimeout(fire, gap())
      }, SUNNY_TOY_DURATION_MS)
    }
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className="sunnyside-decor" aria-hidden>
      {/* Arc-en-ciel pastel discret (derrière les nuages). */}
      <div className="sunny-rainbow" />
      {/* Soleil chaleureux dans un coin haut : disque + halo qui pulse + rayons qui tournent lentement. */}
      <div className="sunny-sun">
        <span className="sunny-sun-rays" />
        <span className="sunny-sun-core" />
      </div>
      {/* Teinte rose fraise chaude qui baigne le bas (Lotso). */}
      <div className="sunny-strawberry" />
      {/* Nuages blancs floconneux qui dérivent. */}
      {clouds.map((c, i) => (
        <span
          key={`cloud-${i}`}
          className="sunny-cloud"
          style={{
            top: `${c.top}%`,
            height: `${c.size}vh`,
            width: `${c.size * 1.7}vh`,
            opacity: c.op,
            animationName: c.dir === 1 ? 'sunnyCloudDriftR' : 'sunnyCloudDriftL',
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
      {/* Ballons colorés qui montent en ondulant. */}
      {balloons.map((b, i) => (
        <span
          key={`balloon-${i}`}
          className="sunny-balloon-rise"
          style={{ left: `${b.left}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
        >
          <span
            className="sunny-balloon-sway"
            style={{ animationDuration: `${b.swayDur}s`, animationDelay: `${b.delay}s`, '--sway': `${b.sway}vw` } as CSSProperties}
          >
            <span className="sunny-balloon" style={{ height: `${b.size}vh`, width: `${b.size * 0.82}vh`, background: b.color }} />
          </span>
        </span>
      ))}
      {/* Paillettes chaudes (montée > ondulation > scintillement). */}
      {motes.map((m, i) => (
        <span
          key={`smote-${i}`}
          className="voodoo-mote-rise"
          style={{ left: `${m.left}%`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
        >
          <span
            className="voodoo-mote-sway"
            style={{ animationDuration: `${m.swayDur}s`, animationDelay: `${m.delay}s`, '--sway': `${m.sway}vw` } as CSSProperties}
          >
            <span
              className="voodoo-mote"
              style={{
                width: `${m.size}px`,
                height: `${m.size}px`,
                opacity: m.op,
                background: '#fff4c2',
                animationDuration: `${m.twkDur}s`,
                animationDelay: `${m.twkDelay}s`,
                '--mote-color': '#fff4c2',
              } as CSSProperties}
            />
          </span>
        </span>
      ))}
      {/* SURPRISE : averse de jouets qui tombent en tournoyant, par moments. */}
      {toys && (
        <div className="sunny-toys">
          {toys.items.map((t) => (
            <img
              key={t.key}
              src={t.img}
              alt=""
              className="sunny-toy-fall"
              draggable={false}
              style={{
                left: `${t.left}%`,
                height: `${t.size}vh`,
                animationDuration: `${t.dur}s`,
                animationDelay: `${t.delay}s`,
                '--spin': `${t.spin}deg`,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Décor « teamRocket » (Team Rocket — Pokémon) : le CIEL de la Team Rocket.
// ============================================================================
const TR_BLAST_DURATION_MS = 10000 // durée d'un blast-off (fuite + scintillement) — synchro avec le CSS
const TR_BLAST_GAP_MIN_MS = 120_000 // « s'envole vers d'autres cieux » toutes les 2 à 4 min
const TR_BLAST_GAP_MAX_MS = 240_000
const TR_BLAST_TEST = false // ⚠️ true → blast-off toutes les ~10 s pour régler (à remettre false avant commit)
// Paires de couleurs des bandes (rayons) du fond flashy : on en change à CHAQUE apparition (cycle
// sur `seq`) pour varier d'une surprise à l'autre (violet/rose, mauve/bleu foncé, bleu foncé/rouge…).
const TR_BLAST_BAND_PAIRS: [string, string][] = [
  ['#7b3a83', '#ec72b6'], // violet / rose
  ['#b89bb9', '#1e2a52'], // mauve / bleu foncé
  ['#1e2a52', '#d6334b'], // bleu foncé / rouge
  ['#d6334b', '#66bbe2'], // rouge / bleu ciel
]
// Pokémon de type Vol / lévitants qui DÉRIVENT en permanence dans le ciel derrière la montgolfière
// (couche de parallaxe). Par Pokémon : `big` (grand sur la bande basse), `fast` (vitesse) et `rev`
// (image qui regarde à DROITE au naturel, au lieu de gauche → retournement inversé).
const TR_SKY_POKEMON: { src: string; big: boolean; fast: boolean; rev?: boolean }[] = [
  { src: '/animations/ptera.png', big: true, fast: true }, // 1 Ptéra
  { src: '/animations/papilusion.png', big: false, fast: false }, // 2 Papilusion
  { src: '/animations/insecateur.png', big: true, fast: true }, // 3 Insécateur
  { src: '/animations/nosferapti.png', big: false, fast: false }, // 4 Nosferapti
  { src: '/animations/nosferalto.png', big: true, fast: false }, // 5 Nosferalto
  { src: '/animations/dracolosse.png', big: true, fast: true }, // 6 Dracolosse
  { src: '/animations/dardargnan.png', big: true, fast: true }, // 7 Dardargnan
  { src: '/animations/aeromite.png', big: false, fast: true }, // 8 Aéromite
  { src: '/animations/fantominus.png', big: false, fast: false }, // 9 Fantominus
  { src: '/animations/spectrum.png', big: true, fast: false }, // 10 Spectrum
  { src: '/animations/mew.png', big: false, fast: true, rev: true }, // 11 Mew (regarde à droite)
  { src: '/animations/dracaufeu.png', big: true, fast: true, rev: true }, // 12 Dracaufeu (regarde à droite)
  { src: '/animations/abra.png', big: false, fast: false }, // 13 Abra
  { src: '/animations/mewtwo.png', big: true, fast: true, rev: true }, // Mewtwo (regarde à droite)
  // Lot ajouté : tous petits & lents sauf indication.
  { src: '/animations/togetic.png', big: false, fast: false }, // A Togetic
  { src: '/animations/magneton.png', big: false, fast: false }, // B Magnéton
  { src: '/animations/magneti.png', big: false, fast: false }, // C Magnéti
  { src: '/animations/rapasdepic.png', big: true, fast: true }, // D Rapasdepic (grand, rapide)
  { src: '/animations/porygon.png', big: false, fast: false }, // E Porygon
  { src: '/animations/baudrive.png', big: false, fast: false }, // F Baudrive
  { src: '/animations/goelise.png', big: false, fast: false }, // G Goélise
  { src: '/animations/floravol.png', big: false, fast: false }, // H Floravol
  { src: '/animations/granivol.png', big: false, fast: false }, // I Granivol
  { src: '/animations/nostenfer.png', big: true, fast: true, rev: true }, // J Nostenfer (grand, rapide, regarde à droite)
  { src: '/animations/xatu.png', big: true, fast: false }, // K Xatu (grand, lent)
  { src: '/animations/noarfang.png', big: true, fast: true }, // L Noarfang (grand, rapide)
]
// Bandes de ciel (en % de la hauteur) où les Pokémon traversent, SANS recouvrir le plateau :
//  - le ciel du HAUT (au-dessus des lieux, là où vole le ballon) ;
//  - la bande entre les LIEUX et les OBJECTIFS, en bas. Ajuste les % au besoin.
const TR_SKY_BANDS: [number, number][] = [
  [1, 14], // haut
  [54, 66], // entre lieux et objectifs (bas)
]

/** Décor « teamRocket » : l'image de fond `background_team_rocket.jpg` (plein cadre) surmontée de la
 *  MONGOLFIÈRE Miaouss (image, petite) qui traverse lentement le ciel en tanguant. SURPRISE minutée :
 *  « La Team Rocket s'envole vers d'autres cieux ! » — le trio (image `team_rocket_cieux.png`) jaillit
 *  du plateau, file en diagonale vers le haut en rétrécissant (il s'éloigne), puis disparaît dans un
 *  éclat d'étoile (le *DING* de fin d'épisode). En reduced-motion : décor posé, dérives figées,
 *  blast-off désactivé (le timer ne démarre pas). */
function TeamRocketDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Le ballon est une image fournie (transparente) ; s'il manque, on l'escamote sans rien casser.
  const [balloonOk, setBalloonOk] = useState(true)
  // Pokémon par VAGUES : 2 par passage (un dans la bande HAUTE, un dans la bande BASSE), tirés au
  // hasard, qui traversent UNE fois ; la vague suivante démarre quand ils sont sortis de l'écran.
  const [wave, setWave] = useState<{
    id: number
    mons: { src: string; rev: boolean; top: number; size: number; dur: number; dir: number; bobDur: number; behind: boolean }[]
  }>({ id: 0, mons: [] })
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let id = 0
    // Construit un Pokémon de la vague pour la bande `bandIdx` (0 = haut, 1 = bas).
    const build = (mon: (typeof TR_SKY_POKEMON)[number], bandIdx: number) => {
      const [bandMin, bandMax] = TR_SKY_BANDS[bandIdx]
      const size = bandIdx === 1
        ? (mon.big ? 13 + Math.random() * 4 : 8 + Math.random() * 3) // bas : grand 13–17, petit 8–11
        : 4 + Math.random() * 5 // haut : 4–9 (lointain)
      const dur = mon.fast ? 20 + Math.random() * 10 : 45 + Math.random() * 25 // rapide 20–30 s, lent 45–70 s
      return {
        src: mon.src,
        rev: !!mon.rev,
        top: bandMin + Math.random() * (bandMax - bandMin), // % dans sa bande
        size,
        dur,
        dir: Math.random() < 0.5 ? 1 : -1, // sens de traversée au hasard
        bobDur: 3 + Math.random() * 3, // s (flottement vertical)
        // Bande HAUTE : les PETITS (taille basse) passent DERRIÈRE la montgolfière (profondeur).
        behind: bandIdx === 0 && size < 6.5,
      }
    }
    const spawn = () => {
      id += 1
      const shuffled = [...TR_SKY_POKEMON].sort(() => Math.random() - 0.5)
      const mons = [build(shuffled[0], 0), build(shuffled[1], 1)] // 1 haut + 1 bas
      setWave({ id, mons })
      const maxDur = Math.max(...mons.map((m) => m.dur))
      timer = setTimeout(spawn, (maxDur + 1) * 1000) // vague suivante une fois sortis (+1 s de marge)
    }
    spawn()
    return () => clearTimeout(timer)
  }, [])
  // Plein d'étoiles qui scintillent PENDANT la surprise (position/taille/rythme/phase variés).
  const [stars] = useState(() =>
    Array.from({ length: 70 }, () => ({
      top: Math.random() * 100, // %
      left: Math.random() * 100, // %
      size: 0.8 + Math.random() * 2, // vh
      dur: 0.9 + Math.random() * 1.8, // s (clignotement)
      delay: Math.random() * 1.2, // s (phase décalée)
      pink: Math.random() < 0.4, // 40 % rose, sinon blanc
    })),
  )
  // SURPRISE : blast-off. Calque (dé)monté le temps de la scène, piloté par un timer aléatoire.
  // Position de départ (x) et sens de la culbute (spin) tirés à chaque tir. Désactivé en reduced-motion.
  const [blast, setBlast] = useState<{ seq: number; x: number; spin: number; bandA: string; bandB: string } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () =>
      TR_BLAST_TEST ? 10_000 : TR_BLAST_GAP_MIN_MS + Math.random() * (TR_BLAST_GAP_MAX_MS - TR_BLAST_GAP_MIN_MS)
    const fire = (fireRef.current = () => {
      const s = seq++
      const [bandA, bandB] = TR_BLAST_BAND_PAIRS[s % TR_BLAST_BAND_PAIRS.length] // paire qui change à chaque apparition
      setBlast({
        seq: s,
        x: 28 + Math.random() * 24, // % (départ plutôt vers la gauche → fuite en diagonale vers le coin haut-droit)
        spin: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 140), // tours de la culbute, sens au hasard
        bandA,
        bandB,
      })
      clear = setTimeout(() => {
        setBlast(null)
        next = setTimeout(fire, gap())
      }, TR_BLAST_DURATION_MS)
    })
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className="tr-sky-decor" aria-hidden>
      {/* La mongolfière Miaouss (ballon « R ») : posée en DERNIER PLAN (juste après le fond), donc
          DERRIÈRE les Pokémon. Traverse lentement le ciel en tanguant. */}
      {balloonOk && (
        <span className="tr-balloon-drift">
          <span className="tr-balloon-bob">
            <img
              className="tr-balloon-img"
              src="/animations/team_rocket_ballon.png"
              alt=""
              draggable={false}
              onError={() => setBalloonOk(false)}
            />
          </span>
        </span>
      )}
      {/* Pokémon par vagues (2 par passage : un par bande), DEVANT la montgolfière. Chacun traverse
          UNE fois (iteration 1, fill forwards → reste hors champ à la fin, jusqu'à la vague suivante). */}
      {wave.mons.map((p, i) => (
        <span
          key={`tr-poke-${wave.id}-${i}`}
          className="tr-poke"
          style={{
            top: `${p.top}%`,
            zIndex: p.behind ? 0 : 2, // derrière (0) ou devant (2) la montgolfière (z-index 1)
            animationName: p.dir === 1 ? 'trPokeDriftR' : 'trPokeDriftL',
            animationDuration: `${p.dur}s`,
            animationIterationCount: 1,
            animationFillMode: 'forwards',
          }}
        >
          <span className="tr-poke-bob" style={{ animationDuration: `${p.bobDur}s` }}>
            {/* Images orientées à GAUCHE au naturel → retournées quand le Pokémon part à DROITE. Pour
                celles qui regardent déjà à droite (`rev`), c'est l'inverse (retournées vers la gauche). */}
            <img
              className="tr-poke-img"
              src={p.src}
              alt=""
              draggable={false}
              style={{ height: `${p.size}vh`, transform: (p.rev ? p.dir === -1 : p.dir === 1) ? 'scaleX(-1)' : undefined }}
            />
          </span>
        </span>
      ))}
      {/* SURPRISE : « s'envole vers d'autres cieux ! ». Un fond flashy (rayons rouge/blanc qui
          tournent + flash) s'allume, le logo « R » surgit en haut centré, et le trio file vers le
          coin haut en rétrécissant, puis un éclat d'étoile (DING) jaillit au point de fuite. */}
      {blast && (
        <div className="tr-blast" key={blast.seq}>
          {/* Fond flashy : rayons en éventail (2 couleurs, variables selon l'apparition) qui tournent. */}
          <div className="tr-blast-flash" style={{ '--band-a': blast.bandA, '--band-b': blast.bandB } as CSSProperties} />
          {/* Plein d'étoiles qui scintillent par-dessus le fond flashy. */}
          {stars.map((s, i) => (
            <span
              key={`tr-star-${i}`}
              className={`tr-star${s.pink ? ' tr-star-pink' : ''}`}
              style={{
                top: `${s.top}%`,
                left: `${s.left}%`,
                width: `${s.size}vh`,
                height: `${s.size}vh`,
                animationDuration: `${s.dur}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          ))}
          {/* Logo « R » de la Team Rocket en haut centré (pop puis disparition). */}
          <img className="tr-blast-logo" src="/animations/R_team_rocket.png" alt="" draggable={false} />
          <div className="tr-blast-fly" style={{ left: `${blast.x}%` }}>
            <img
              className="tr-blast-trio"
              src="/animations/team_rocket_cieux.png"
              alt=""
              draggable={false}
              style={{ '--spin': `${blast.spin}deg` } as CSSProperties}
            />
            <span className="tr-twinkle" style={{ animationDelay: `${Math.round(TR_BLAST_DURATION_MS * 0.72)}ms` }} />
          </div>
        </div>
      )}
    </div>
  )
}

// Dé UNIQUE qui bascule sur une nouvelle face toutes les 10 s. Faces RÉELLES du jeu
// (mêmes images que le lancer de dés : le dé en os rouge d'Oogie Boogie).
const OOGIE_DIE_SWAP_MS = 10000
const oogieDieSrc = (face: number) => `/cards/oogie-boogie/die-${face}.webp`
// Teintes des feux follets sous la lumière noire (vert dominant + quelques violets).
const OOGIE_MOTE_COLORS = ['#8aff9a', '#b6ff7a', '#7cff9f', '#c69cff', '#a878ff']
// SURPRISE « les insectes se déversent » : par moments, une nuée d'insectes grouille depuis le bas et
// envahit l'écran en frétillant, puis se disperse. Intervalle aléatoire (`..._GAP_MIN/MAX_MS`).
// MODE TEST : à `true`, fréquent (~8 s) pour régler ; À REMETTRE `false` avant commit.
const OOGIE_BUGS_TEST = true
const OOGIE_BUGS_DUR_MS = 6000 // durée de l'invasion (montée + grouillement + dispersion)
const OOGIE_BUGS_GAP_MIN_MS = OOGIE_BUGS_TEST ? 6000 : 70000
const OOGIE_BUGS_GAP_MAX_MS = OOGIE_BUGS_TEST ? 10000 : 150000

/** Décor « tanière-casino d'Oogie Boogie » (L'Étrange Noël de Monsieur Jack). Pénombre, LUEUR de
 *  LUMIÈRE NOIRE verte & violette qui pulse et fine POUSSIÈRE verte qui monte (motes de Facilier),
 *  surmontées d'une DÉCO HALLOWEEN : guirlande de fanions/fantômes en haut, citrouille à chapeau qui
 *  luit dans un coin, un gros DÉ unique (faces réelles du dé en os rouge) qui flotte et bascule sur une
 *  nouvelle face toutes les 10 s, et 2-3 PERCE-OREILLES qui se baladent. SURPRISE : par moments une nuée
 *  de perce-oreilles se déverse depuis le bas. */
function OogieDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Dé UNIQUE : la face affichée + un compteur de bascule (sert de clé React pour rejouer l'anim de
  // tumble). Toutes les 10 s, on tire une nouvelle face (jamais deux fois la même d'affilée).
  const [die, setDie] = useState(() => ({ face: 1 + Math.floor(Math.random() * 6), flip: 0 }))
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      setDie((d) => {
        let face = 1 + Math.floor(Math.random() * 6)
        if (face === d.face) face = (d.face % 6) + 1 // évite de retomber sur la même face
        return { face, flip: d.flip + 1 }
      })
    }, OOGIE_DIE_SWAP_MS)
    return () => clearInterval(id)
  }, [])
  // Perce-oreilles qui se baladent en permanence (2 ou 3) : traversent lentement l'écran en frétillant.
  const [earwigs] = useState(() =>
    Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
      top: 70 + Math.random() * 22, // % (le long du bas)
      size: 4.5 + Math.random() * 2.5, // vh (longueur du corps)
      dur: 26 + Math.random() * 20, // s (traversée lente)
      delay: -(Math.random() * 30), // s (déjà en route au montage)
      rtl: Math.random() < 0.5, // sens de marche (droite→gauche)
      wig: 0.22 + Math.random() * 0.12, // s (frétillement des pattes)
      tilt: (Math.random() - 0.5) * 12, // deg (légère inclinaison du corps)
    })),
  )
  // Poussière verte (feux follets) qui monte en ondulant et scintillant (motes de Facilier).
  const [motes] = useState(() =>
    Array.from({ length: 26 }, () => ({
      left: Math.random() * 100, // %
      size: 1.6 + Math.random() * 2.6, // px
      dur: 9 + Math.random() * 8, // s
      delay: -(Math.random() * 17), // s
      sway: 2 + Math.random() * 5, // vw
      swayDur: 3 + Math.random() * 3, // s
      twkDur: 1.4 + Math.random() * 1.8, // s
      twkDelay: -(Math.random() * 3), // s
      op: 0.35 + Math.random() * 0.4,
      color: OOGIE_MOTE_COLORS[Math.floor(Math.random() * OOGIE_MOTE_COLORS.length)],
    })),
  )
  // SURPRISE « les insectes se déversent » : tirée par à-coups (timer aléatoire). Chaque insecte grimpe
  // du bas vers une destination au hasard (dérive latérale) en frétillant, puis se disperse en fondu.
  const [bugs, setBugs] = useState<{
    seq: number
    items: { key: string; left: number; size: number; dx: number; dy: number; dur: number; delay: number; wig: number; rot: number }[]
  } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () => OOGIE_BUGS_GAP_MIN_MS + Math.random() * (OOGIE_BUGS_GAP_MAX_MS - OOGIE_BUGS_GAP_MIN_MS)
    const fire = fireRef.current = () => {
      const s = seq++
      const items = Array.from({ length: 54 }, (_, i) => ({
        key: `${s}-${i}`,
        left: Math.random() * 100, // % (point de départ sur la largeur)
        size: 6 + Math.random() * 7, // px (longueur du corps)
        dx: (Math.random() - 0.5) * 40, // vw (dérive latérale en grimpant)
        dy: 18 + Math.random() * 80, // vh (hauteur atteinte)
        dur: 2.6 + Math.random() * 2.2, // s (vitesse de reptation)
        delay: Math.random() * 1.6, // s (la nuée se déverse progressivement)
        wig: 0.18 + Math.random() * 0.16, // s (frétillement rapide)
        rot: (Math.random() - 0.5) * 50, // deg (orientation du corps)
      }))
      setBugs({ seq: s, items })
      clear = setTimeout(() => {
        setBugs(null)
        next = setTimeout(fire, gap())
      }, OOGIE_BUGS_DUR_MS)
    }
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className="oogie-decor" aria-hidden>
      {/* Pleine lune (disque jaune halo) en haut à droite, derrière la guirlande. */}
      <div className="oogie-moon" />
      {/* Lueur de lumière noire (verte + violette) qui pulse. */}
      <div className="oogie-glow" />
      {/* Guirlande Halloween (fanions + fantômes + citrouilles) suspendue en haut, qui se balance. */}
      <img className="oogie-garland" src="/animations/guirlande_halloween.png" alt="" draggable={false} />
      {/* Poussière verte qui monte (montée > ondulation > scintillement). */}
      {motes.map((m, i) => (
        <span
          key={`omote-${i}`}
          className="voodoo-mote-rise"
          style={{ left: `${m.left}%`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
        >
          <span
            className="voodoo-mote-sway"
            style={{ animationDuration: `${m.swayDur}s`, animationDelay: `${m.delay}s`, '--sway': `${m.sway}vw` } as CSSProperties}
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
      {/* Dé unique aux faces réelles : flotte (wrapper bob) et bascule à chaque changement de face
          (l'img est re-montée via key={die.flip} → l'anim de tumble rejoue). */}
      <div className="oogie-die-anchor">
        <div className="oogie-die-bob">
          <img
            key={die.flip}
            className="oogie-die-img oogie-die-tumble"
            src={oogieDieSrc(die.face)}
            alt=""
            draggable={false}
          />
        </div>
      </div>
      {/* Citrouille à chapeau de sorcière, posée dans un coin, qui luit (jack-o'-lantern) et se balance. */}
      <img className="oogie-pumpkin" src="/animations/citrouille.png" alt="" draggable={false} />
      {/* Perce-oreilles qui se baladent : traversée lente (sens via animation-direction + miroir de l'img). */}
      {earwigs.map((w, i) => (
        <span
          key={`ew-${i}`}
          className="oogie-earwig-walk"
          style={{
            top: `${w.top}%`,
            animationDuration: `${w.dur}s`,
            animationDelay: `${w.delay}s`,
            animationDirection: w.rtl ? 'reverse' : 'normal',
          }}
        >
          <span className="oogie-earwig-wig" style={{ animationDuration: `${w.wig}s` }}>
            <img
              src="/animations/perce_oreille.png"
              alt=""
              draggable={false}
              style={{ width: `${w.size}vh`, transform: `scaleX(${w.rtl ? -1 : 1}) rotate(${w.tilt}deg)` }}
            />
          </span>
        </span>
      ))}
      {/* SURPRISE — les perce-oreilles se déversent : nuée qui grimpe du bas en frétillant puis se disperse. */}
      {bugs && (
        <div className="oogie-bugs">
          {bugs.items.map((b) => (
            <span
              key={b.key}
              className="oogie-bug-crawl"
              style={{
                left: `${b.left}%`,
                animationDuration: `${b.dur}s`,
                animationDelay: `${b.delay}s`,
                '--dx': `${b.dx}vw`,
                '--dy': `${b.dy}vh`,
              } as CSSProperties}
            >
              {/* Orientation du corps (statique) ; le frétillement est sur l'enfant. */}
              <span className="oogie-bug-orient" style={{ transform: `rotate(${b.rot}deg)` }}>
                <img
                  src="/animations/perce_oreille.png"
                  alt=""
                  draggable={false}
                  className="oogie-bug-img"
                  style={{ width: `${b.size * 2.4}px`, animationDuration: `${b.wig}s` }}
                />
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Couleurs des bonbons de Sugar Rush (vermicelles + bokeh).
const CANDY_COLORS = ['#ff5fa2', '#ffffff', '#7be0c2', '#ffe14d', '#5fb8ff', '#c79bff', '#ff7a7a', '#ffa14d']
// Quelques bonbons qui font office de BOLIDES sur la piste (les concurrents de la course de Sugar Rush).
const CANDY_RACERS = [
  '/animations/bonbon-1.png', '/animations/bonbon-2.png', '/animations/bonbon-5.png',
  '/animations/bonbon-9.png', '/animations/bonbon-11.png', '/animations/bonbon-13.png',
  // Variantes de couleur du nounours (bonbon-11) : jaune / vert / bleu / violet.
  '/animations/bonbon-11-jaune.png', '/animations/bonbon-11-vert.png',
  '/animations/bonbon-11-bleu.png', '/animations/bonbon-11-violet.png',
]
// Bonbons « crocodile » : images VERTICALES (tête en bas) → sur la route, on les couche d'un quart de
// tour vers la GAUCHE (tête vers l'avant) pour qu'ils roulent comme des bolides.
const CANDY_CROCS = new Set([
  '/animations/bonbon-1.png', '/animations/bonbon-12.png', '/animations/bonbon-13.png',
  '/animations/bonbon-14.png', '/animations/bonbon-15.png',
])

// SURPRISE « TURBO ! » (Sa Sucrerie / Roi Candy) : le virus se démasque. Le monde en sucre se CORROMPT
// — la scène TRESSAUTE et se DÉDOUBLE en blanc/cyan (le bug d'écran de Slenderman, repris sur
// l'enveloppe `.candy-field`), des SCANLINES défilent, des BANDES de l'image sont arrachées, un
// balayage cathodique descend, les couleurs déraillent puis la palette rose vire au BLANC-BLEU GLACÉ
// de Turbo, son nom claque deux fois en gros pixels, un flash — et tout se recolle
// en sucre. 100 % CSS + texte, aucun asset (keyframes `cg*`, cf. index.css). Les bornes ci-dessous
// doivent rester EN PHASE avec la timeline CSS. Flag de test → cadence rapprochée pour régler.
const CANDY_GLITCH_TEST = false
const CANDY_GLITCH_MS = 6500 // premiers soubresauts → corruption → pic (« TURBO ») → tout se recolle
const CANDY_GLITCH_GAP_MIN_MS = CANDY_GLITCH_TEST ? 6000 : 75_000 // 1 min 15 (c'est une SURPRISE : c'est rare)
const CANDY_GLITCH_GAP_MAX_MS = CANDY_GLITCH_TEST ? 11_000 : 150_000 // 2 min 30

/** Décor « candy » (Sa Sucrerie / Roi Candy — Les Mondes de Ralph) : le monde de bonbons de Sugar Rush.
 *  Fond rose/magenta gourmand, des VERMICELLES colorés (sprinkles) tombent en voletant (chute + ondulation
 *  + rotation), un BOKEH sucré (ronds doux colorés) dérive et scintille en fond, une bande de GLAÇAGE
 *  blanc ondulé borde le bas, et — la COURSE de Sugar Rush — une PISTE (route) qui défile en bas, des
 *  TRAÎNÉES de vitesse qui la zèbrent et des BONBONS-BOLIDES qui la filent. En reduced-motion : tout figé. */
function CandyDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // SURPRISE « TURBO ! » : la classe `is-glitch` corrompt tout le décor (désaturation/contraste qui
  // déraillent + soubresauts), le calque `.candy-glitch` (monté le temps de la séquence, clé React =
  // numéro de passage) ajoute les bandes arrachées, la grille de gros pixels, le balayage et le nom.
  const [glitchRun, setGlitchRun] = useState<number | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setGlitchRun(++run)
      clear = setTimeout(() => setGlitchRun(null), CANDY_GLITCH_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(CANDY_GLITCH_GAP_MIN_MS + Math.random() * (CANDY_GLITCH_GAP_MAX_MS - CANDY_GLITCH_GAP_MIN_MS))
      }, delay)
    }
    schedule(CANDY_GLITCH_TEST ? 3000 : 45_000 + Math.random() * 30_000) // 1re corruption : 45 s à 1 min 15
    // MODE TEST : déclenche le glitch à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  // Vermicelles colorés (petites capsules) qui tombent en voletant.
  const [sprinkles] = useState(() =>
    Array.from({ length: 30 }, () => ({
      left: Math.random() * 100, // %
      size: 1.4 + Math.random() * 1.4, // vh (longueur de la capsule)
      dur: 6 + Math.random() * 6, // s (chute)
      delay: -(Math.random() * 12), // s
      sway: 2 + Math.random() * 4, // vw
      swayDur: 2.5 + Math.random() * 2, // s
      rotDur: 2.5 + Math.random() * 3, // s
      rotDir: Math.random() < 0.5 ? 'normal' : 'reverse', // sens de rotation
      color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
      op: 0.7 + Math.random() * 0.3,
    })),
  )
  // Bokeh sucré : ronds doux flous qui dérivent vers le haut en scintillant (profondeur gourmande).
  const [bokeh] = useState(() =>
    Array.from({ length: 16 }, () => ({
      left: Math.random() * 100, // %
      size: 5 + Math.random() * 10, // vh (gros ronds flous)
      dur: 16 + Math.random() * 14, // s (dérive lente)
      delay: -(Math.random() * 28), // s
      sway: 1.5 + Math.random() * 3, // vw
      swayDur: 5 + Math.random() * 4, // s
      color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
      op: 0.12 + Math.random() * 0.16,
    })),
  )
  // Bonbons-bolides : quelques bonbons qui FILENT le long de la piste (rebond + passage rapide).
  const [racers] = useState(() =>
    Array.from({ length: 3 }, () => ({
      img: CANDY_RACERS[Math.floor(Math.random() * CANDY_RACERS.length)],
      size: 6 + Math.random() * 2.5, // vh
      dur: 38 + Math.random() * 6, // s (~40 s par traversée)
      delay: -(Math.random() * 44), // s
      hopDur: 0.9 + Math.random() * 0.5, // s (rebond)
      bottom: 22.5 + Math.random() * 2, // vh (voie sur la route)
    })),
  )
  // Traînées de vitesse qui zèbrent la piste (sensation de course au sol).
  const [streaks] = useState(() =>
    Array.from({ length: 7 }, () => ({
      bottom: 23 + Math.random() * 10, // vh (dans la bande de route)
      width: 8 + Math.random() * 16, // vw
      dur: 20 + Math.random() * 6, // s (très lente)
      delay: -(Math.random() * 26), // s
      color: CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)],
      op: 0.5 + Math.random() * 0.4,
    })),
  )
  return (
    <div className={`candy-decor${glitchRun !== null ? ' is-glitch' : ''}`} aria-hidden>
      {/* Tout le contenu du décor dans une enveloppe : c'est ELLE que le glitch déchire (secousses
          + dédoublement blanc/cyan), sur le modèle du bug d'écran de Slenderman. */}
      <div className="candy-field">
      {/* Bokeh sucré (derrière). */}
      {bokeh.map((b, i) => (
        <span
          key={`cbok-${i}`}
          className="candy-bokeh-rise"
          style={{ left: `${b.left}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
        >
          <span
            className="candy-bokeh-sway"
            style={{ animationDuration: `${b.swayDur}s`, animationDelay: `${b.delay}s`, '--sway': `${b.sway}vw` } as CSSProperties}
          >
            <span
              className="candy-bokeh"
              style={{ width: `${b.size}vh`, height: `${b.size}vh`, opacity: b.op, background: `radial-gradient(circle, ${b.color} 0%, ${b.color}00 70%)` }}
            />
          </span>
        </span>
      ))}
      {/* Piste de course : la route défile horizontalement (sensation de vitesse). */}
      <div className="candy-street" />
      {/* Glaçage blanc ondulé en bas (le bord de la piste). */}
      <div className="candy-frosting" />
      {/* Bonbons-bolides qui filent le long de la piste (course > rebond > bonbon). */}
      {racers.map((r, i) => (
        <span
          key={`crace-${i}`}
          className="candy-racer"
          style={{ bottom: `${r.bottom}vh`, animationDuration: `${r.dur}s`, animationDelay: `${r.delay}s` }}
        >
          <span className="candy-racer-hop" style={{ animationDuration: `${r.hopDur}s` }}>
            <img
              src={r.img}
              alt=""
              draggable={false}
              style={{ height: `${r.size}vh`, transform: CANDY_CROCS.has(r.img) ? 'rotate(-90deg)' : undefined }}
            />
          </span>
        </span>
      ))}
      {/* Traînées de vitesse qui zèbrent la piste. */}
      {streaks.map((s, i) => (
        <span
          key={`cstreak-${i}`}
          className="candy-streak"
          style={{
            bottom: `${s.bottom}vh`,
            width: `${s.width}vw`,
            opacity: s.op,
            background: `linear-gradient(to right, ${s.color}00, ${s.color})`,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
      {/* Vermicelles colorés qui tombent en voletant. */}
      {sprinkles.map((s, i) => (
        <span
          key={`cspr-${i}`}
          className="candy-sprinkle-fall"
          style={{ left: `${s.left}%`, animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
        >
          <span
            className="candy-sprinkle-sway"
            style={{ animationDuration: `${s.swayDur}s`, animationDelay: `${s.delay}s`, '--sway': `${s.sway}vw` } as CSSProperties}
          >
            <span
              className="candy-sprinkle"
              style={{ height: `${s.size}vh`, width: `${s.size * 0.32}vh`, background: s.color, opacity: s.op, animationDuration: `${s.rotDur}s`, animationDirection: s.rotDir }}
            />
          </span>
        </span>
      ))}
      </div>
      {/* SURPRISE « TURBO ! » : monté le temps de la séquence ; la clé React rejoue les
          animations CSS à chaque passage. */}
      {glitchRun !== null && (
        <div className="candy-glitch" key={glitchRun}>
          {/* Bandes arrachées : elles inversent la scène (blend `difference`) et sautent en pas. */}
          <div className="cg-tear cg-tear--1" />
          <div className="cg-tear cg-tear--2" />
          <div className="cg-tear cg-tear--3" />
          <div className="cg-tear cg-tear--4" />
          <div className="cg-tear cg-tear--5" />
          {/* Scanlines qui défilent en sautant (la signature du bug d'écran de Slenderman). */}
          <div className="cg-scan" />
          {/* La palette de Turbo : le rose bonbon vire au blanc-bleu glacé. */}
          <div className="cg-turbo-tint" />
          {/* Balayage d'écran cathodique qui descend en boucle. */}
          <div className="cg-roll" />
          {/* Son nom, en gros pixels, dédoublé rouge/cyan. */}
          <div className="cg-name" data-text="TURBO">TURBO</div>
          {/* Le pic de corruption. */}
          <div className="cg-flash" />
        </div>
      )}
    </div>
  )
}

// Surprise « Shere Khan traverse » : durée de la traversée (doit correspondre au keyframe `jungleTigerCross`)
// et intervalle aléatoire entre deux passages. Flag de test → passages rapprochés pour régler.
const JUNGLE_TIGER_TEST = false
const JUNGLE_TIGER_WALK_MS = 15000 // ~15 s pour traverser la colonne en rôdant
const JUNGLE_TIGER_GAP_MIN_MS = JUNGLE_TIGER_TEST ? 4000 : 70000 // 1 min 10
const JUNGLE_TIGER_GAP_MAX_MS = JUNGLE_TIGER_TEST ? 8000 : 150000 // 2 min 30

// Surprise « la Fleur Rouge » : tout s'embrase (voile orangé + mur de flammes + braises + lueur), puis la
// PLUIE arrive et éteint le feu. Séquence : embrasement (BURN) → la pluie tombe sur le feu (OVERLAP) → le
// feu s'éteint en fondu (FADE) → la pluie continue seule (ALONE) → les dernières gouttes (TAPER).
const JUNGLE_FIRE_TEST = false
const JUNGLE_FIRE_BURN_MS = 13000 // embrasement seul avant la pluie
const JUNGLE_FIRE_OVERLAP_MS = 5000 // 5 s de pluie pendant que le feu brûle encore
const JUNGLE_FIRE_FADE_MS = 1800 // fondu d'extinction du feu (doit correspondre à `jungleFireOut`)
const JUNGLE_RAIN_ALONE_MS = 5000 // 5 s de pluie après la disparition du feu
const JUNGLE_RAIN_TAPER_MS = 4000 // dissipation : les dernières gouttes tombent (fondu `jungleRainTaper`)
const JUNGLE_FIRE_GAP_MIN_MS = JUNGLE_FIRE_TEST ? 6000 : 90000 // 1 min 30
const JUNGLE_FIRE_GAP_MAX_MS = JUNGLE_FIRE_TEST ? 11000 : 180000 // 3 min

/** Décor « jungle » (Shere Khan — Le Livre de la Jungle) : une jungle À CONTRE-JOUR. Fond vert sombre +
 *  lueur chaude au centre + vignette, des RAIS de lumière chaude qui filtrent à travers la canopée, des
 *  LIANES (images) qui pendent du haut et se balancent (pivot en haut), des FEUILLES (image) en silhouette
 *  qui encadrent les coins et quelques-unes qui dérivent en tombant, des LUCIOLES ambrées qui flottent et
 *  clignotent, et SHERE KHAN en silhouette noire tapi en bas (respiration subtile). Éléments tirés une
 *  fois au montage, animations en CSS (cf. index.css, section « jungle »). */
function JungleDecor() {
  const fireRef = useRef<() => void>(() => {}) // surprise : traversée du tigre
  useSurpriseSub(fireRef)
  const fireRef2 = useRef<() => void>(() => {}) // surprise : la Fleur Rouge (embrasement + pluie)
  useSurpriseSub(fireRef2)
  // Lianes suspendues : image / position / largeur / longueur / amplitude & période de balancement /
  // déphasage / miroir / opacité de la silhouette, tirés une fois au montage. On distingue les lianes
  // FINES (liane 1/4/5, longues et étroites) des TOUFFES de feuillage (liane-3, large et courte) :
  // ces dernières sont plus GROSSES et en PLUSIEURS exemplaires.
  const THIN_LIANAS = ['/animations/liane-1.png', '/animations/liane-4.png', '/animations/liane-5.png']
  const [lianas] = useState(() => [
    // Lianes fines (longues, étroites).
    ...Array.from({ length: 6 }, (_, i) => ({
      img: THIN_LIANAS[i % THIN_LIANAS.length],
      left: 3 + Math.random() * 94, // %
      top: -1, // % (accrochées tout en haut)
      w: 4 + Math.random() * 7, // vh (largeur de la liane)
      hPct: 30 + Math.random() * 45, // % (longueur : pend plus ou moins bas)
      swing: 1.5 + Math.random() * 3.5, // deg
      dur: 6 + Math.random() * 5, // s
      delay: -(Math.random() * 11), // s
      flip: Math.random() < 0.5,
      op: 0.6 + Math.random() * 0.35,
    })),
    // Touffes de feuillage (liane-3) : plus grosses, plusieurs exemplaires, accrochées PLUS HAUT
    // (elles débordent par le haut du cadre → on n'en voit que la retombée).
    ...Array.from({ length: 5 }, () => ({
      img: '/animations/liane-3.png',
      left: 6 + Math.random() * 88, // %
      top: -8 - Math.random() * 5, // % (remontées en haut, sans descendre trop bas : -8 à -13 %)
      w: 13 + Math.random() * 11, // vh (bien plus large)
      hPct: 24 + Math.random() * 14, // % (touffe : retombée visible)
      swing: 1 + Math.random() * 2.5, // deg (balancement plus ample mais lent)
      dur: 7 + Math.random() * 5, // s
      delay: -(Math.random() * 11), // s
      flip: Math.random() < 0.5,
      op: 0.65 + Math.random() * 0.3,
    })),
  ])
  // Feuilles qui encadrent les coins (silhouettes fixes, légèrement bercées par le vent). Repoussées
  // hors-cadre (une partie déborde) pour ne montrer qu'un bord de feuillage, sans dominer.
  const [frameLeaves] = useState(() =>
    [
      { left: -6, top: -8, w: 13, rot: 18, flip: false },
      { left: 106, top: -6, w: 14, rot: -22, flip: true },
      { left: -8, top: 96, w: 11, rot: -150, flip: true },
      { left: 105, top: 98, w: 10, rot: 156, flip: false },
    ].map((l, i) => ({ ...l, dur: 7 + i * 1.3, delay: -(Math.random() * 8), sway: 1.5 + Math.random() * 2 })),
  )
  // Feuilles qui dérivent en tombant (silhouette) : chute lente + voletement latéral + rotation sur soi.
  const [fallLeaves] = useState(() =>
    Array.from({ length: 9 }, () => ({
      left: Math.random() * 100, // %
      size: 2.2 + Math.random() * 2.6, // vh
      dur: 11 + Math.random() * 9, // s (chute lente)
      delay: -(Math.random() * 20), // s
      sway: 3 + Math.random() * 6, // vw (voletement)
      swayDur: 3 + Math.random() * 2.5, // s
      rotDur: 5 + Math.random() * 5, // s
      rotDir: Math.random() < 0.5 ? 'normal' : 'reverse',
      flip: Math.random() < 0.5,
      op: 0.45 + Math.random() * 0.4,
    })),
  )
  // Lucioles ambrées : flottent (montée ondulante) et clignotent (opacité), comme la poussière d'or.
  const [fireflies] = useState(() =>
    Array.from({ length: 30 }, () => ({
      left: Math.random() * 100, // %
      size: 1.6 + Math.random() * 2.6, // px
      dur: 9 + Math.random() * 9, // s (montée lente)
      delay: -(Math.random() * 18), // s
      sway: 2 + Math.random() * 5, // vw (ondulation latérale)
      swayDur: 2.6 + Math.random() * 2.6, // s
      twkDur: 1.1 + Math.random() * 1.8, // s (clignotement)
      twkDelay: -(Math.random() * 3), // s
      op: 0.4 + Math.random() * 0.5,
    })),
  )
  // Rais de lumière chaude qui filtrent (vacillent doucement). Positions/largeurs tirées au montage.
  const [rays] = useState(() =>
    Array.from({ length: 5 }, () => ({
      left: 8 + Math.random() * 84, // %
      w: 6 + Math.random() * 10, // vh
      rot: -22 + Math.random() * 18, // deg
      dur: 5 + Math.random() * 4, // s (vacillement)
      delay: -(Math.random() * 8), // s
      op: 0.06 + Math.random() * 0.08,
    })),
  )
  // SURPRISE : Shere Khan traverse le bas de la colonne de GAUCHE À DROITE en rôdant, puis disparaît
  // hors champ. État `walk` monté/démonté par une minuterie (durée = la traversée, intervalle aléatoire),
  // comme les surprises de Scar/Yzma. Désactivée en `prefers-reduced-motion`.
  const [walk, setWalk] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let cross: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        setWalk(true)
        cross = setTimeout(() => {
          setWalk(false)
          schedule(JUNGLE_TIGER_GAP_MIN_MS + Math.random() * (JUNGLE_TIGER_GAP_MAX_MS - JUNGLE_TIGER_GAP_MIN_MS))
        }, JUNGLE_TIGER_WALK_MS)
      }, delay)
    }
    schedule(JUNGLE_TIGER_TEST ? 2000 : 12000 + Math.random() * 18000) // 1ʳᵉ traversée après ~12–30 s
    // MODE TEST : déclenche la traversée du tigre à la demande.
    fireRef.current = () => {
      setWalk(true)
      cross = setTimeout(() => setWalk(false), JUNGLE_TIGER_WALK_MS)
    }
    return () => {
      clearTimeout(next)
      clearTimeout(cross)
    }
  }, [])
  // SURPRISE « la Fleur Rouge » : mur de flammes orangées (réutilise le sprite `.fire-flame`) qui s'embrase
  // au bas de la colonne. Flammes tirées une fois au montage (positions/tailles/phases).
  const [flames] = useState(() => {
    const n = 90 + Math.floor(Math.random() * 24) // 90..113 (mur TRÈS dense, double rangée)
    return Array.from({ length: n }, (_, i) => ({
      left: (i / (n - 1)) * 100 + (Math.random() - 0.5) * (140 / n), // % (réparties + jitter qui les chevauche)
      size: 34 * (0.5 + Math.random() * 1.05), // vh (hauteur de flamme, variées)
      loop: 2.1 + Math.random() * 1.2, // s (vitesse de la boucle de feu)
      delay: -(Math.random() * 3), // s (phase décalée)
      flip: Math.random() < 0.5, // miroir horizontal
      op: 0.85 + Math.random() * 0.15,
    }))
  })
  // Braises orangées qui montent en scintillant pendant l'embrasement.
  const [embers] = useState(() =>
    Array.from({ length: 60 }, () => ({
      left: Math.random() * 100, // %
      size: 1.6 + Math.random() * 3, // px
      dur: 3 + Math.random() * 3.5, // s (montée)
      delay: -(Math.random() * 6), // s
      drift: (Math.random() - 0.5) * 9, // vw (dérive latérale)
      op: 0.5 + Math.random() * 0.4,
    })),
  )
  // Gouttes de pluie (réparties, fines, légèrement inclinées) qui éteignent le feu. Tirées au montage.
  const [drops] = useState(() =>
    Array.from({ length: 140 }, () => ({
      left: Math.random() * 100, // %
      len: 5 + Math.random() * 7, // vh (longueur de la traînée)
      w: 1 + Math.random() * 1.2, // px (épaisseur)
      dur: 0.5 + Math.random() * 0.5, // s (chute rapide)
      delay: -(Math.random() * 1), // s (déphasage : flux continu)
      op: 0.35 + Math.random() * 0.45,
    })),
  )
  // SURPRISE « la Fleur Rouge » + extinction par la pluie, en PHASES (chaîne de timers, cf. PotionBrew) :
  // `fire` = flammes/lueur ; `fireOut` = fondu d'extinction ; `rain` = pluie ; `rainTaper` = dernières
  // gouttes (la pluie se dissipe). Désactivée en `prefers-reduced-motion`.
  const [fire, setFire] = useState(false)
  const [fireOut, setFireOut] = useState(false)
  const [rain, setRain] = useState(false)
  const [rainTaper, setRainTaper] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
    const run = () => {
      setFire(true)
      setFireOut(false)
      setRain(false)
      setRainTaper(false)
      const tRain = JUNGLE_FIRE_BURN_MS // la pluie commence (le feu brûle encore)
      const tFireOut = tRain + JUNGLE_FIRE_OVERLAP_MS // 5 s plus tard, le feu s'éteint
      const tFireGone = tFireOut + JUNGLE_FIRE_FADE_MS // feu disparu (fin du fondu)
      const tTaper = tFireGone + JUNGLE_RAIN_ALONE_MS // 5 s de pluie seule, puis dernières gouttes
      const tEnd = tTaper + JUNGLE_RAIN_TAPER_MS
      at(tRain, () => setRain(true))
      at(tFireOut, () => setFireOut(true))
      at(tFireGone, () => {
        setFire(false)
        setFireOut(false)
      })
      at(tTaper, () => setRainTaper(true))
      at(tEnd, () => {
        setRain(false)
        setRainTaper(false)
        at(JUNGLE_FIRE_GAP_MIN_MS + Math.random() * (JUNGLE_FIRE_GAP_MAX_MS - JUNGLE_FIRE_GAP_MIN_MS), run)
      })
    }
    at(JUNGLE_FIRE_TEST ? 3000 : 40000 + Math.random() * 30000, run) // 1ʳᵉ bouffée après ~40–70 s
    fireRef2.current = run // MODE TEST : déclenche « la Fleur Rouge » à la demande.
    return () => timers.forEach(clearTimeout)
  }, [])
  return (
    <div className="jungle-decor" aria-hidden>
      {/* Lueur chaude au centre + vignette (posées via ::before/::after dans index.css). */}
      {/* Rais de lumière chaude qui filtrent à travers la canopée. */}
      {rays.map((r, i) => (
        <span
          key={`ray-${i}`}
          className="jungle-ray"
          style={{
            left: `${r.left}%`,
            width: `${r.w}vh`,
            opacity: r.op,
            transform: `translateX(-50%) rotate(${r.rot}deg)`,
            animationDuration: `${r.dur}s`,
            animationDelay: `${r.delay}s`,
          }}
        />
      ))}
      {/* Lucioles ambrées (enveloppe = montée ; milieu = ondulation ; image = clignotement). */}
      {fireflies.map((f, i) => (
        <span key={`fly-${i}`} className="jungle-firefly-rise" style={{ left: `${f.left}%`, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }}>
          <span className="jungle-firefly-sway" style={{ animationDuration: `${f.swayDur}s`, animationDelay: `${f.delay}s`, '--sway': `${f.sway}vw` } as CSSProperties}>
            <span
              className="jungle-firefly"
              style={{ width: `${f.size}px`, height: `${f.size}px`, opacity: f.op, animationDuration: `${f.twkDur}s`, animationDelay: `${f.twkDelay}s` }}
            />
          </span>
        </span>
      ))}
      {/* SURPRISE : Shere Khan traverse le bas de la colonne de gauche à droite en rôdant (silhouette
          noire). L'enveloppe glisse (translateX) ; l'enfant porte la silhouette + le balancement de
          démarche (bob vertical). Monté seulement pendant la traversée. */}
      {walk && (
        <div className="jungle-tiger-walk">
          <div className="jungle-tiger" style={{ backgroundImage: 'url(/animations/shere_khan.png)' }} />
        </div>
      )}
      {/* Lianes qui pendent du haut et se balancent (pivot en haut), en silhouette. Enveloppe =
          centrage + miroir (transform statique) ; enfant = balancement (rotate animé). */}
      {lianas.map((l, i) => (
        <span
          key={`liana-${i}`}
          className="jungle-liana"
          style={{ left: `${l.left}%`, top: `${l.top}%`, width: `${l.w}vh`, height: `${l.hPct}%`, transform: `translateX(-50%) scaleX(${l.flip ? -1 : 1})` }}
        >
          <span
            className="jungle-liana-swing"
            style={{
              opacity: l.op,
              backgroundImage: `url(${l.img})`,
              animationDuration: `${l.dur}s`,
              animationDelay: `${l.delay}s`,
              '--swing': `${l.swing}deg`,
            } as CSSProperties}
          />
        </span>
      ))}
      {/* Feuilles qui encadrent les coins (grandes silhouettes bercées par le vent). Enveloppe =
          position + orientation de base ; enfant = bercement (rotate animé). */}
      {frameLeaves.map((l, i) => (
        <span
          key={`frame-${i}`}
          className="jungle-leaf-frame"
          style={{ left: `${l.left}%`, top: `${l.top}%`, width: `${l.w}vh`, transform: `rotate(${l.rot}deg) scaleX(${l.flip ? -1 : 1})` }}
        >
          <span
            className="jungle-leaf-frame-sway"
            style={{
              backgroundImage: 'url(/animations/feuille.png)',
              animationDuration: `${l.dur}s`,
              animationDelay: `${l.delay}s`,
              '--sway': `${l.sway}deg`,
            } as CSSProperties}
          />
        </span>
      ))}
      {/* Feuilles qui dérivent en tombant (silhouette). */}
      {fallLeaves.map((l, i) => (
        <span key={`fall-${i}`} className="jungle-leaf-fall" style={{ left: `${l.left}%`, animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }}>
          <span className="jungle-leaf-sway" style={{ animationDuration: `${l.swayDur}s`, animationDelay: `${l.delay}s`, '--sway': `${l.sway}vw` } as CSSProperties}>
            <span
              className="jungle-leaf-img"
              style={{
                width: `${l.size}vh`,
                height: `${l.size * (740 / 641)}vh`,
                opacity: l.op,
                backgroundImage: 'url(/animations/feuille.png)',
                animationDuration: `${l.rotDur}s`,
                animationDirection: l.rotDir,
              }}
            />
          </span>
        </span>
      ))}
      {/* SURPRISE « la Fleur Rouge » : tout s'embrase (voile orangé + mur de flammes + braises + lueur),
          posé AU-DESSUS de tout le décor (mais derrière l'UI). Le feu fond en entrée, puis s'éteint en
          fondu (`is-out`) quand la pluie l'a noyé. */}
      {fire && (
        <div className={`jungle-fire${fireOut ? ' is-out' : ''}`}>
          {/* Voile orangé qui envahit toute la colonne (le « fond devient orangé »). */}
          <div className="jungle-fire-veil" />
          {/* Lueur chaude pulsante au bas. */}
          <div className="jungle-fire-glow" />
          {/* Mur de flammes (réutilise le sprite `.fire-flame`, déjà orangé). */}
          {flames.map((f, i) => (
            <div
              key={`flame-${i}`}
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
          {/* Braises orangées qui montent. */}
          {embers.map((e, i) => (
            <span
              key={`ember-${i}`}
              className="jungle-ember"
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
      )}
      {/* PLUIE qui éteint le feu : posée au-dessus du feu. Quand `is-tapering`, la pluie se dissipe
          (dernières gouttes). */}
      {rain && (
        <div className={`jungle-rain${rainTaper ? ' is-tapering' : ''}`}>
          {/* Léger voile froid/bleuté (la pluie rafraîchit la scène orangée). */}
          <div className="jungle-rain-veil" />
          {drops.map((d, i) => (
            <span
              key={`drop-${i}`}
              className="jungle-raindrop"
              style={{
                left: `${d.left}%`,
                height: `${d.len}vh`,
                width: `${d.w}px`,
                opacity: d.op,
                animationDuration: `${d.dur}s`,
                animationDelay: `${d.delay}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Décor permanent d'arrière-plan d'un vilain (rien si aucun décor défini). */
/** Décor « atmosfear » (Le Seigneur des clés — le Gardien d'Atmosfear) : sa CASSETTE VHS.
 *  Fond NOIR avec un CHRONOMÈTRE au format MM:SS en haut, centré, qui égrène le temps écoulé
 *  depuis le début de la partie (police EvanstonTavern), précédé à sa gauche d'une LUNE dont la
 *  PHASE suit la PROGRESSION D'OBJECTIF (`objectivePct`, 0→100) : à 0 % fin croissant (forme
 *  initiale), à 100 % pleine lune (forme finale). Base sobre destinée à recevoir des couches
 *  VHS par-dessus. */
// Cycle des animations du bas : RIEN → BOUGIES (15 s) → RIEN → FLAMMES (15 s) → RIEN → … (cross-fade).
// Chaque animation s'affiche 15 s, séparée par un temps « rien ». Réglage : `ATMOSFEAR_FLAME_TEST`
// accélère le cycle pour la mise au point (les 15 s deviennent ~5 s).
const ATMOSFEAR_FLAME_TEST = false
const ATMOSFEAR_TIME = ATMOSFEAR_FLAME_TEST ? 0.34 : 1 // facteur d'accélération (mise au point)
const ATMOSFEAR_SHOW_MS = 15_000 * ATMOSFEAR_TIME // durée d'affichage de chaque animation (15 s)
const ATMOSFEAR_GAP_MS = 5_000 * ATMOSFEAR_TIME // temps « rien » entre les deux

// SURPRISE « LA CLÉ NOIRE » : les 6 clés colorées JAILLISSENT du centre et tournent en orbite (ellipse
// aplatie) autour du chronomètre, puis s'ÉTEIGNENT une à une tandis que la CLÉ NOIRE grossit au centre
// en pulsant d'une lueur violette (le chrono s'assombrit, éclipsé) ; enfin tout s'estompe. Séquence
// jouée en CSS (keyframes `afk*`, cf. index.css) : le calque est (dé)monté le temps de la surprise, sa
// clé React rejoue donc les animations depuis le début à chaque passage. Flag de test → cadence
// rapprochée pour régler.
const ATMOSFEAR_KEYS_TEST = false
const ATMOSFEAR_KEYS_MS = 7600 // durée totale de la séquence (doit correspondre aux keyframes `afk*`)
const ATMOSFEAR_KEYS_GAP_MIN_MS = ATMOSFEAR_KEYS_TEST ? 6000 : 75_000 // 1 min 15 (c'est une SURPRISE : c'est rare)
const ATMOSFEAR_KEYS_GAP_MAX_MS = ATMOSFEAR_KEYS_TEST ? 11_000 : 150_000 // 2 min 30
// Retard (s) avant que les clés colorées commencent à s'éteindre, une à une (cf. `afkKeyOut`), et pas
// entre deux extinctions. À garder en phase avec le retard de `.afk-black` dans index.css.
const ATMOSFEAR_KEY_OUT_DELAY_S = 3
const ATMOSFEAR_KEY_OUT_STEP_S = 0.28
// Les 6 clés colorées (props du vilain publié) qui composent l'orbite, dans l'ordre du cercle.
const ATMOSFEAR_KEY_IMAGES = [
  '/cards/custom-seigneur-cles/cle-bleu.webp',
  '/cards/custom-seigneur-cles/cle-vert.webp',
  '/cards/custom-seigneur-cles/cle-jaune.webp',
  '/cards/custom-seigneur-cles/cle-orange.webp',
  '/cards/custom-seigneur-cles/cle-rouge.webp',
  '/cards/custom-seigneur-cles/cle-violet.webp',
]
// La CLÉ NOIRE au centre : pas d'asset dédié (l'illustration `cle-noire.webp` est une CARTE) → on
// reprend un prop de clé, passé au NOIR par un filtre CSS (`.afk-black`) et nimbé de violet.
const ATMOSFEAR_BLACK_KEY_IMAGE = '/cards/custom-seigneur-cles/cle-violet.webp'

function AtmosfearDecor({
  side,
  objectivePct = 0,
  timerRunning = false,
}: {
  side?: 'left' | 'right'
  objectivePct?: number
  timerRunning?: boolean
}) {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // CHRONOMÈTRE : même mécanique que le `GameTimer` (cf. components/GameTimer.tsx) → démarre au
  // premier instant où la partie « tourne » et se fige à la fin. Capture `Date.now` dans l'effet
  // au même rendu que le GameTimer → les deux minuteurs démarrent EXACTEMENT en même temps. Tant
  // que la partie n'a pas démarré → 00:00. Pur UI (pas le moteur) : l'horloge réelle est permise.
  const startRef = useRef<number | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  useEffect(() => {
    if (!timerRunning) return
    if (startRef.current === null) startRef.current = Date.now()
    const tick = () => setElapsedMs(Date.now() - (startRef.current ?? Date.now()))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [timerRunning])
  const elapsed = Math.floor(elapsedMs / 1000)
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const ss = String(elapsed % 60).padStart(2, '0')
  // Cycle RIEN → BOUGIES → RIEN → FLAMMES → … : on démarre sur RIEN, puis on enchaîne les phases via
  // des setTimeout (première bascule après le temps « rien » initial, donc rien à la base).
  const [decorPhase, setDecorPhase] = useState<'none' | 'candles' | 'flames'>('none')
  useEffect(() => {
    const seq: { kind: 'none' | 'candles' | 'flames'; dur: number }[] = [
      { kind: 'candles', dur: ATMOSFEAR_SHOW_MS },
      { kind: 'none', dur: ATMOSFEAR_GAP_MS },
      { kind: 'flames', dur: ATMOSFEAR_SHOW_MS },
      { kind: 'none', dur: ATMOSFEAR_GAP_MS },
    ]
    let i = 0
    let id: number
    const advance = () => {
      setDecorPhase(seq[i].kind)
      const d = seq[i].dur
      i = (i + 1) % seq.length
      id = window.setTimeout(advance, d)
    }
    id = window.setTimeout(advance, ATMOSFEAR_GAP_MS) // rien au départ, puis on lance la séquence
    return () => window.clearTimeout(id)
  }, [])
  // SURPRISE « la clé noire » : on monte le calque `.atmosfear-keys` le temps de la séquence, avec un
  // compteur de passage en clé React → les animations CSS repartent de zéro à chaque déclenchement.
  const [keysRun, setKeysRun] = useState<number | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setKeysRun(++run)
      clear = setTimeout(() => setKeysRun(null), ATMOSFEAR_KEYS_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(ATMOSFEAR_KEYS_GAP_MIN_MS + Math.random() * (ATMOSFEAR_KEYS_GAP_MAX_MS - ATMOSFEAR_KEYS_GAP_MIN_MS))
      }, delay)
    }
    schedule(ATMOSFEAR_KEYS_TEST ? 3000 : 45_000 + Math.random() * 30_000) // 1re apparition : 45 s à 1 min 15
    // MODE TEST : déclenche la séquence à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  // La colonne du décor déborde de 10 % vers son bord EXTÉRIEUR (marginLeft pour le joueur,
  // marginRight pour l'adversaire, cf. App.tsx) → son axe `left:50%` n'est plus le centre visible.
  // On recale le minuteur de 5 % vers le bord INTÉRIEUR : joueur (left) → vers la droite, adversaire
  // (right) → vers la gauche.
  const timerLeft = side === 'right' ? '45%' : '55%'
  // Phase de la lune (fraction éclairée, light venant de la GAUCHE) pilotée par la progression
  // d'objectif : 0 % → fin croissant (0,06), 100 % → pleine (1). La moitié GAUCHE est toujours
  // peinte ; un TERMINATEUR elliptique (cercle aplati horizontalement, donc bord courbe comme une
  // vraie phase) se superpose au centre :
  //  - croissant (f < 0,5) : ellipse NOIRE qui ronge la moitié gauche → il ne reste qu'un croissant ;
  //  - gibbeuse (f > 0,5) : ellipse BLEUE qui complète la moitié droite → vers la pleine lune.
  // Sa largeur (scaleX) va de la pleine largeur (croissant fin / pleine lune) à 0 (premier quartier,
  // terminateur droit vertical).
  const moonProgress = Math.min(1, Math.max(0, objectivePct / 100))
  const moonPhase = 0.06 + 0.94 * moonProgress
  // Même principe que la lune : la TAILLE des flammes suit la progression d'objectif. Facteur
  // appliqué à la taille de base de chaque flamme : 0 % → ×25 (petite flamme déjà visible),
  // 100 % → ×200 (grande flamme). Base ~0,2 vh → ~5 vh à 0 %, ~40 vh à 100 %.
  const flameGrow = 25 + 175 * moonProgress
  const moonCrescent = moonPhase < 0.5
  const moonTermColor = moonCrescent ? '#000' : '#558cf4'
  const moonTermScale = moonCrescent ? (0.5 - moonPhase) * 2 : (moonPhase - 0.5) * 2
  // Rangée de PETITES FLAMMES alignées (réutilise le sprite `fire_sprite.png` / `.fire-flame`),
  // réparties régulièrement sur toute la largeur. Posée juste au-dessus de la barre d'objectif
  // (offset `--atmosfear-flames-bottom` dans index.css). Tirées une fois au montage.
  const [flames] = useState(() => {
    const n = 32
    return Array.from({ length: n }, (_, i) => ({
      left: (i / (n - 1)) * 100, // % (répartition régulière)
      size: 0.2 + Math.random() * 0.08, // vh (taille de BASE = ×1 ; ×100 à 100 % d'objectif → ~20-28 vh)
      loop: 2.3 + Math.random() * 1.1, // s (vitesse de la boucle de feu)
      delay: -(Math.random() * 3), // s (phase décalée)
      flip: Math.random() < 0.5, // miroir horizontal pour varier
      op: 0.85 + Math.random() * 0.15, // opacité
    }))
  })
  // Rotation aléatoire (figée au montage) de chaque image de bougies : entre -10° et +5°.
  const [candleRot] = useState(() => Array.from({ length: 14 }, () => -10 + Math.random() * 15))
  // « Fonte » des bougies selon la progression d'objectif : on coupe le BAS du contenu (clip-path
  // s'enfonce vers la base. Pas de coupe/masque sur l'image : la bougie DESCEND simplement (translateY)
  // et c'est le `overflow:hidden` du conteneur qui la clippe à la ligne de sol → elle s'enfonce dans
  // le sol au fil de l'objectif, en gardant sa flamme. À 0 % rien ne descend ; à 100 % ~58 % de descente.
  const candleCutPx = 0.9 * 334 * moonProgress // px de bougie « fondus » (utilisé pour la descente)
  // Descente de l'image MOINS une légère remontée d'autant que l'objectif avance (à 100 % on remonte un peu).
  const candleSink = (candleCutPx / 384) * 100 - 20 * moonProgress // % (translateY, positif = bas)
  return (
    <div className="atmosfear-decor" aria-hidden>
      {/* Chronomètre MM:SS en haut, centré (les deux groupes de chiffres en tabular-nums pour
          ne pas frémir, le « : » fixe entre les deux), précédé de la lune à sa gauche. Pendant la
          surprise, il est ÉCLIPSÉ (assombri) le temps que la clé noire prenne le centre. */}
      <div
        className={`atmosfear-timer${keysRun !== null ? ' is-eclipsed' : ''}`}
        style={{ left: timerLeft }}
      >
        {/* Lune qui se remplit : moitié gauche éclairée + terminateur elliptique par-dessus. */}
        <span className="atmosfear-moon">
          <span className="atmosfear-moon-half" />
          <span
            className="atmosfear-moon-term"
            style={{ background: moonTermColor, transform: `scaleX(${moonTermScale})` }}
          />
        </span>
        {/* Chaque chiffre dans une case de largeur fixe (la police EvanstonTavern n'a pas de
            chiffres à chasse fixe → sans ça le texte se décale à chaque changement). */}
        <span className="atmosfear-num">
          {mm.split('').map((c, i) => (
            <span key={i} className="atmosfear-digit">{c}</span>
          ))}
        </span>
        <span className="atmosfear-colon">:</span>
        <span className="atmosfear-num">
          {ss.split('').map((c, i) => (
            <span key={i} className="atmosfear-digit">{c}</span>
          ))}
        </span>
      </div>
      {/* Rangée de BOUGIES (candles.gif), même emplacement que les flammes. Le gif a un grand vide
          transparent à droite → on superpose plusieurs images qui se chevauchent (marge négative en
          CSS) pour rapprocher les groupes. Affichée 15 s dans le cycle (rien → bougies → rien → flammes). */}
      <div className={`atmosfear-candles${decorPhase === 'candles' ? ' is-shown' : ''}`} aria-hidden>
        {candleRot.map((r, i) => (
          <img
            key={i}
            src="/animations/candles.gif"
            alt=""
            className="atmosfear-candle-img"
            style={{ transform: `translateY(${candleSink}%) rotate(${r}deg)` }}
          />
        ))}
      </div>
      {/* Rangée de petites flammes alignées, au-dessus de la barre d'objectif. La taille suit la
          progression d'objectif (`flameGrow`) ; affichée 15 s dans le cycle (alterne avec les bougies). */}
      <div className={`atmosfear-flames${decorPhase === 'flames' ? ' is-shown' : ''}`}>
        {flames.map((f, i) => {
          const s = f.size * flameGrow // taille effective = base × croissance liée à l'objectif
          return (
            <div
              key={i}
              className="fire-flame"
              style={{
                left: `${f.left}%`,
                // Compense la marge transparente sous la flamme → base visible fixe quelle que soit la taille.
                bottom: `${-FLAME_BASE_GAP * s}vh`,
                height: `${s}vh`,
                width: `${s * FLAME_ASPECT}vh`,
                opacity: f.op,
                backgroundImage: 'url(/animations/fire_sprite.png)',
                animationDuration: `${f.loop}s`,
                animationDelay: `${f.delay}s`,
                transform: f.flip ? 'translateX(-50%) scaleX(-1)' : 'translateX(-50%)',
                '--frames': 39,
                '--fh': `${s}vh`,
              } as CSSProperties}
            />
          )
        })}
      </div>
      {/* SURPRISE « la clé noire ». Monté seulement pendant la séquence (clé = n° de passage → les
          animations CSS rejouent à chaque fois). */}
      {keysRun !== null && (
        <div key={keysRun} className="atmosfear-keys">
          {/* Orbite : le conteneur jaillit du centre (scale) ; l'anneau est APLATI verticalement
              (`scaleY`) → les clés décrivent une ellipse. Chaque clé annule ce squash ET la rotation
              de l'anneau (mêmes durée/timing) pour rester droite et non déformée. */}
          <div className="afk-orbit" style={{ left: timerLeft }}>
            <div className="afk-ring">
              {ATMOSFEAR_KEY_IMAGES.map((src, i) => (
                <span
                  key={src}
                  className="afk-slot"
                  style={{ '--afk-a': `${(i / ATMOSFEAR_KEY_IMAGES.length) * 360}deg` } as CSSProperties}
                >
                  <span className="afk-spin">
                    {/* Extinction échelonnée : les clés meurent une à une, dans l'ordre du cercle. */}
                    <img
                      className="afk-key"
                      src={src}
                      alt=""
                      style={{ animationDelay: `${ATMOSFEAR_KEY_OUT_DELAY_S + i * ATMOSFEAR_KEY_OUT_STEP_S}s` }}
                    />
                  </span>
                </span>
              ))}
            </div>
          </div>
          {/* La CLÉ NOIRE : elle grossit au centre (sur le chrono éclipsé) en pulsant de violet. */}
          <img className="afk-black" src={ATMOSFEAR_BLACK_KEY_IMAGE} alt="" style={{ left: timerLeft }} />
        </div>
      )}
    </div>
  )
}

// Couleur unique des triangles « bling-bling » de Tamatoa + vitesse de défilement commune (identique
// pour tous → ils avancent à la même allure, comme un tapis).
const TAMATOA_YELLOW = '#FFD11A'
const TAMATOA_SCROLL_SEC = 20
// Triangle aux SOMMETS ARRONDIS : SVG data-URI dont le contour épais en `stroke-linejoin: round`
// (même couleur que le remplissage) arrondit les trois coins. Auto-contenu (aucun fichier).
const TAMATOA_TRI_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpolygon points='50,18 18,82 82,82' fill='%23FFD11A' stroke='%23FFD11A' stroke-width='20' stroke-linejoin='round'/%3E%3C/svg%3E\")"
// Pluie « bling-bling » permanente de Tamatoa : les PIÈCES d'or de Prince Jean (cf. COIN_IMAGES) + les
// 4 diamants laissés BLANCS (couleurs d'origine), avec une discrète lueur. Ombre portée chaude commune.
const TAMATOA_SHADOW = 'drop-shadow(0 3px 5px rgba(0, 0, 0, 0.45))'
const TAMATOA_DIAMANTS = Array.from({ length: 4 }, (_, i) => `/animations/diamant-${i + 1}.png`)
// Filtres de la pluie : MÊME liste de fonctions (et même ORDRE) en normal et pendant la surprise, pour que
// `transition: filter` interpole proprement à l'entrée ET à la sortie (sinon le filtre « saute »). En normal
// les valeurs sont neutres (grayscale 0, sepia 0, saturate 1, hue-rotate 0) ; les diamants juste un peu plus
// lumineux pour rester bien blancs. Pendant la surprise, on bascule vers la teinte cyan.
const TAMATOA_RAIN_FILTER = `grayscale(0) brightness(1) sepia(0) saturate(1) hue-rotate(0deg) ${TAMATOA_SHADOW}`
const TAMATOA_DIAMOND_FILTER = `grayscale(0) brightness(1.18) sepia(0) saturate(1) hue-rotate(0deg) ${TAMATOA_SHADOW}`
// Bulles de Tamatoa (le crabe vit sous l'eau, à Lalotai) : surtout bleues/transparentes.
const TAMATOA_BUBBLES = ['/animations/bulle-bleu.png', '/animations/bulle-bleu.png', '/animations/bulle.png']
// Animation SURPRISE de Tamatoa : les triangles « bling-bling » disparaissent, des POINTS BLEUS fixes
// (#0001FB) s'allument partout, la pluie se teinte en CYAN (#64D9FE) et la couleur du vilain vire au
// MAGENTA (#FD27FC) le temps de l'animation.
const TAMATOA_SURPRISE_DOT = '#0001FB'
const TAMATOA_SURPRISE_VILLAIN_COLOR = '#FD27FC'
// La couleur du vilain ADVERSE vire au BLEU (#0001FB) le temps de la surprise.
const TAMATOA_SURPRISE_OPPONENT_COLOR = '#0001FB'
// Teinte cyan #64D9FE approchée par filtre (même technique que les teintes de diamants de Ratigan :
// grayscale → sepia → saturate → hue-rotate), appliquée à toute la pluie pendant la surprise.
const TAMATOA_SURPRISE_RAIN_FILTER = `grayscale(1) brightness(1.4) sepia(1) saturate(6) hue-rotate(165deg) ${TAMATOA_SHADOW}`
// La surprise du décor est INDÉPENDANTE de l'animation de passage `disco` (les deux couches sont
// découplées) : elle a sa propre minuterie interne (toutes les TAMATOA_SURPRISE_EVERY_MS) et dure
// TAMATOA_SURPRISE_MS. Le bus de test peut aussi la déclencher à la demande.
const TAMATOA_SURPRISE_MS = 10000
const TAMATOA_SURPRISE_EVERY_MS = 150000 // ~2 min 30 entre deux surprises

/** Décor « tamatoa » (Vaiana — l'antre « Shiny / Bling Bling » du crabe) : un fond de GROTTE sombre
 *  sur lequel défilent vers la DROITE plein de petits TRIANGLES JAUNES FLOUTÉS et BRILLANTS (le
 *  bling-bling de son trésor) — couleur et vitesse identiques, rotation FIXE aléatoire. Par-dessus, une
 *  pluie permanente de pièces/diamants et des bulles qui montent.
 *  SURPRISE (minutée + déclencheur de test) : les triangles s'éteignent, des POINTS BLEUS fixes (#0001FB)
 *  s'allument partout, la pluie se teinte en cyan (#64D9FE), la couleur du vilain vire au magenta
 *  (#FD27FC) ET celle de l'ADVERSAIRE au bleu (#0001FB) le temps de l'animation, puis tout revient. */
function TamatoaDecor({ opponentVillain }: { opponentVillain?: VillainKey | string }) {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  const [surpriseOn, setSurpriseOn] = useState(false)
  const [tris] = useState(() =>
    Array.from({ length: 120 }, () => ({
      top: Math.random() * 100, // % (réparti sur toute la hauteur)
      size: 0.8 + Math.random() * 2.4, // vh (PETITS)
      delay: -(Math.random() * TAMATOA_SCROLL_SEC), // s (flux continu, déphasé sur une période)
      blur: 1.5 + Math.random() * 4, // px (léger flou)
      op: 0.7 + Math.random() * 0.3, // opacité de pointe (vif)
      glow: 9 + Math.random() * 10, // px (halo lumineux marqué = bling brillant)
      twDur: 1.2 + Math.random() * 2.2, // s (scintillement)
      twDelay: -(Math.random() * 3), // s
      rot: Math.random() * 360, // ° (rotation FIXE, non animée)
    })),
  )
  // Pluie PERMANENTE qui tombe en tournoyant (réutilise la mécanique `coinFall` / `cw-fall` de Ratigan,
  // en boucle). 10 % de diamants (blancs, un peu plus gros), 90 % de pièces ; PLUS, plus rares et plus
  // GROS, l'HAMEÇON de Maui et TE FITI (les trésors que convoite le crabe) tombent dans la même pluie.
  const [rain] = useState(() => {
    const drops = Array.from({ length: 90 }, () => {
      const isDiamond = Math.random() < 0.1
      const img = isDiamond
        ? TAMATOA_DIAMANTS[Math.floor(Math.random() * TAMATOA_DIAMANTS.length)]
        : COIN_IMAGES[Math.floor(Math.random() * COIN_IMAGES.length)]
      return {
        img,
        filter: isDiamond ? TAMATOA_DIAMOND_FILTER : TAMATOA_RAIN_FILTER,
        left: 2 + Math.random() * 96, // %
        size: isDiamond ? 2 + Math.random() * 1.8 : 1.8 + Math.random() * 2.2, // vh (diamants un peu plus gros)
        dur: 18 + Math.random() * 14, // s (chute lente, 18–32 s)
        delay: -(Math.random() * 32), // s (étalées sur tout le trajet → flux continu)
        spin: (Math.random() < 0.5 ? -1 : 1) * 360 * (1 + Math.floor(Math.random() * 3)), // ±360/720/1080°
        op: 0.55 + Math.random() * 0.35,
      }
    })
    // UN SEUL exemplaire de chaque gros trésor : l'HAMEÇON de Maui et TE FITI (plus petit), qui tombent
    // un peu plus lentement que les pièces. Chacun est confiné à une MOITIÉ distincte de la colonne (gauche
    // / droite) pour qu'ils ne tombent jamais au même endroit.
    const treasures = [
      { img: '/animations/hamecon.png', size: 12 + Math.random() * 4, left: 6 + Math.random() * 32 }, // vh / % (moitié gauche)
      { img: '/animations/te_fiti.png', size: 3.5 + Math.random() * 1.5, left: 56 + Math.random() * 34 }, // vh / % (moitié droite)
    ].map((t) => ({
      img: t.img,
      filter: TAMATOA_RAIN_FILTER,
      left: t.left, // %
      size: t.size,
      dur: 24 + Math.random() * 12, // s (chute plus lente, 24–36 s)
      delay: -(Math.random() * 36), // s
      spin: (Math.random() < 0.5 ? -1 : 1) * 360 * (1 + Math.floor(Math.random() * 2)), // ±360/720°
      op: 0.7 + Math.random() * 0.3,
    }))
    return [...drops, ...treasures]
  })
  // Quelques BULLES qui montent en ondulant, AU-DESSUS de la pluie (réutilise `.bubble-rise`/`.bubble-sway`).
  const [bubbles] = useState(() =>
    Array.from({ length: 16 }, () => ({
      img: TAMATOA_BUBBLES[Math.floor(Math.random() * TAMATOA_BUBBLES.length)],
      left: Math.random() * 100, // %
      size: 1.6 + Math.random() * 3.4, // vh (tailles variées)
      dur: 14 + Math.random() * 12, // s (montée lente, 14–26 s)
      delay: -(Math.random() * 26), // s (flux continu, déphasé)
      sway: 1.5 + Math.random() * 3, // vw (amplitude d'ondulation)
      swayDur: 2.6 + Math.random() * 2.4, // s (période d'ondulation)
      op: 0.7 + Math.random() * 0.25, // opacité de pointe (PNG transparents → on pousse)
    })),
  )
  // POINTS BLEUS de la surprise : semés partout, position/taille FIXES (aucun défilement). Tirés une
  // fois au montage ; rendus en permanence mais visibles seulement quand `surpriseOn`.
  const [dots] = useState(() =>
    Array.from({ length: 120 }, () => ({
      top: Math.random() * 100, // %
      left: Math.random() * 100, // %
      size: 0.5 + Math.random() * 1.6, // vh
    })),
  )
  // SURPRISE : INDÉPENDANTE de l'animation de passage `disco` (couches découplées). Minuterie interne
  // (toutes les TAMATOA_SURPRISE_EVERY_MS) ; l'outil de test peut aussi la déclencher via le bus.
  // Joue TAMATOA_SURPRISE_MS, puis tout revient.
  useEffect(() => {
    let onT: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let restT: ReturnType<typeof setTimeout>
    // Durée de fondu des couleurs de méchant (variable CSS lue par les éléments colorés du plateau —
    // cases, masque Héros, bordure du plateau). Fondu de 3 s à l'entrée comme à la sortie, puis repos
    // instantané (0 s) pour ne pas ralentir les changements de couleur hors surprise.
    const setColorFade = (d: string) => document.documentElement.style.setProperty('--villain-color-fade', d)
    const begin = () => {
      setColorFade('3s') // entrée : bascule vers le magenta / bleu en fondu de 3 s
      setSurpriseOn(true)
      setVillainColorOverride('tamatoa', TAMATOA_SURPRISE_VILLAIN_COLOR)
      // La couleur du vilain ADVERSE vire au bleu le temps de la surprise (s'il y a un adversaire).
      if (opponentVillain) setVillainColorOverride(opponentVillain, TAMATOA_SURPRISE_OPPONENT_COLOR)
      clearTimeout(onT) // si re-déclenchée pendant qu'elle joue, on prolonge proprement
      onT = setTimeout(() => {
        setColorFade('3s') // sortie : les couleurs reviennent en fondu lent (comme le décor)
        setSurpriseOn(false)
        setVillainColorOverride('tamatoa', null)
        if (opponentVillain) setVillainColorOverride(opponentVillain, null)
        clearTimeout(restT)
        restT = setTimeout(() => setColorFade('0s'), 3000) // une fois le fondu fini, retour instantané au repos
      }, TAMATOA_SURPRISE_MS)
    }
    fireRef.current = begin
    // Minuterie interne qui se ré-arme : déclenche la surprise périodiquement (1ʳᵉ après une période).
    const schedule = () => {
      next = setTimeout(() => {
        begin()
        schedule()
      }, TAMATOA_SURPRISE_EVERY_MS)
    }
    schedule()
    return () => {
      clearTimeout(onT)
      clearTimeout(next)
      clearTimeout(restT)
      setColorFade('0s')
      // Garde-fou : on n'abandonne jamais un override posé.
      setVillainColorOverride('tamatoa', null)
      if (opponentVillain) setVillainColorOverride(opponentVillain, null)
    }
  }, [opponentVillain])
  return (
    <div className="tamatoa-decor" aria-hidden>
      {/* Triangles « bling-bling » : s'éteignent pendant la surprise. Fondu de 3 s à l'entrée comme à la sortie. */}
      <div style={{ position: 'absolute', inset: 0, opacity: surpriseOn ? 0 : 1, transition: 'opacity 3s ease-out' }}>
      {tris.map((t, i) => (
        <span
          key={i}
          className="tamatoa-tri-scroll"
          style={{ top: `${t.top}%`, animationDuration: `${TAMATOA_SCROLL_SEC}s`, animationDelay: `${t.delay}s` }}
        >
          <span
            className="tamatoa-tri"
            style={{
              width: `${t.size}vh`,
              height: `${t.size}vh`,
              backgroundImage: TAMATOA_TRI_SVG,
              transform: `rotate(${t.rot}deg)`,
              filter: `blur(${t.blur}px) drop-shadow(0 0 ${t.glow}px ${TAMATOA_YELLOW}) drop-shadow(0 0 ${t.glow / 2}px #fff8c4)`,
              animationDuration: `${t.twDur}s`,
              animationDelay: `${t.twDelay}s`,
              '--op': t.op,
            } as CSSProperties}
          />
        </span>
      ))}
      </div>
      {/* POINTS BLEUS fixes (#0001FB) : remplacent les triangles pendant la surprise (aucun défilement). */}
      <div style={{ position: 'absolute', inset: 0, opacity: surpriseOn ? 1 : 0, transition: 'opacity 3s ease-out' }}>
        {dots.map((d, i) => (
          <span
            key={`dot-${i}`}
            style={{
              position: 'absolute',
              top: `${d.top}%`,
              left: `${d.left}%`,
              width: `${d.size}vh`,
              height: `${d.size}vh`,
              borderRadius: '50%',
              backgroundColor: TAMATOA_SURPRISE_DOT,
              boxShadow: `0 0 ${d.size * 2.5}vh ${TAMATOA_SURPRISE_DOT}`,
            }}
          />
        ))}
      </div>
      {/* Pluie permanente de pièces & diamants qui tombent en tournoyant (devant les triangles).
          Pendant la surprise, toute la pluie se teinte en cyan (#64D9FE). */}
      {rain.map((c, i) => (
        <img
          key={`rain-${i}`}
          src={c.img}
          alt=""
          className="cw-fall"
          style={{
            left: `${c.left}%`,
            height: `${c.size}vh`,
            opacity: c.op,
            filter: surpriseOn ? TAMATOA_SURPRISE_RAIN_FILTER : c.filter,
            transition: 'filter 3s ease-out',
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
            '--coin-spin': `${c.spin}deg`,
          } as CSSProperties}
          draggable={false}
        />
      ))}
      {/* Quelques bulles qui montent en ondulant, AU-DESSUS de la pluie. */}
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
      <div className="tamatoa-vignette" />
    </div>
  )
}

export function VillainDecor({
  villain,
  side,
  opponentVillain,
  objectivePct,
  timerRunning,
  capturedStones,
}: {
  /** Clé du vilain : `VillainKey` native OU id `custom-…` d'un vilain publié (les deux résolus par
   *  `villainDecor`). */
  villain: VillainKey | string
  side?: 'left' | 'right'
  /** Vilain ADVERSE (l'autre camp) — utilisé par le décor `tamatoa` : sa surprise teinte temporairement
   *  la couleur de l'adversaire en bleu. */
  opponentVillain?: VillainKey | string
  /** Progression d'objectif (0→100) de CE camp — utilisée par le décor `atmosfear` (phase de lune). */
  objectivePct?: number
  /** La partie « tourne » (même condition que le `GameTimer`) — le décor `atmosfear` y synchronise
   *  le démarrage de son minuteur. */
  timerRunning?: boolean
  /** `cardId` des Pierres d'Infinité CAPTURÉES (zone Compétences) de CE camp — utilisées par le décor
   *  `titan` (Thanos) : chaque gemme du Gantelet ne s'allume que si sa Pierre est de la liste. */
  capturedStones?: string[]
}) {
  const decor = villainDecor(villain)
  if (!decor) return null
  // Côté fourni à tous les décors (abonnement au bus de surprise du mode test).
  return (
    <DecorSideContext.Provider value={side ?? 'left'}>
      {renderDecorBody(decor, side, objectivePct, timerRunning, opponentVillain, capturedStones)}
    </DecorSideContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Décor permanent : Tabbou — vue SOUS L'EAU vers la surface. Fond NOIR pur ; la
// SURFACE de l'eau miroitante (deux calques de caustiques bleutées qui ondulent
// en dérivant, réutilisant la turbulence SVG du décor grotte) recouvre TOUT le
// décor.
// ---------------------------------------------------------------------------
// Caustiques utilisées comme MASQUE : la turbulence SVG donne, via feColorMatrix, un ALPHA selon
// la somme RVB du bruit (alpha = 1.7·(R+V+B) − `cut`) → forme des caustiques dans le canal alpha.
// `cut` élevé = calque CLAIRSEMÉ (seules les crêtes du bruit passent). La couleur de sortie est sans
// importance (masquage alpha) : c'est le dégradé du calque, en dessous, qui donne la couleur.
const UNDERWATER_CAUSTIC_URL = (freq: string, seed: number, cut: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='turbulence' baseFrequency='${freq}' numOctaves='2' seed='${seed}' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 1.7 1.7 1.7 0 -${cut}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E")`

// Beaucoup de calques, chacun CLAIRSEMÉ (seuil `cut` élevé → peu de caustiques), avec fréquence,
// graine, taille de tuile, dérive et respiration d'opacité propres → miroitement dense mais fin.
const UNDERWATER_LAYERS = 4

// Nombre d'éclairs bleus qui claquent par intermittence (chacun sur son propre cycle décalé).
const UNDERWATER_BOLTS = 5

// Surprise « Coup Fatal » : durée totale (ms) de l'anim boule → explosion → cercles, après laquelle
// on démonte les éléments. À GARDER en phase avec la timeline CSS (keyframes `uwSmash*`, index.css).
const UNDERWATER_SMASH_MS = 9600

type BoltPt = [number, number]
interface BoltFork {
  x: number
  y: number
  ang: number
}

// Un sous-tracé (tronc ou branche) par DÉPLACEMENT DE POINT-MILIEU (« fractal lightning ») : on part
// d'un segment [a→b] et, à chaque niveau, on coupe chaque segment en son milieu que l'on décale
// PERPENDICULAIREMENT d'un montant aléatoire dont l'amplitude est DIVISÉE PAR 2 à chaque niveau →
// tracé chaotique naturel (technique de référence des jeux). Renvoie la polyligne + des milieux
// candidats pour accrocher des branches.
function fractalBolt(ax: number, ay: number, bx: number, by: number, depth: number, spread: number) {
  let segs: Array<[number, number, number, number]> = [[ax, ay, bx, by]]
  const forks: BoltFork[] = []
  for (let d = 0; d < depth; d++) {
    const amp = spread * Math.pow(0.5, d) // amplitude décroissante
    const next: Array<[number, number, number, number]> = []
    for (const [x1, y1, x2, y2] of segs) {
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.hypot(dx, dy) || 1
      const off = (Math.random() - 0.5) * amp
      // Milieu décalé perpendiculairement (normale = (-dy, dx)/len), clampé dans le cadre.
      const nx = Math.max(2, Math.min(98, (x1 + x2) / 2 + (-dy / len) * off))
      const ny = (y1 + y2) / 2 + (dx / len) * off
      next.push([x1, y1, nx, ny], [nx, ny, x2, y2])
      if (d === 2) forks.push({ x: nx, y: ny, ang: Math.atan2(dy, dx) }) // candidats de fourche
    }
    segs = next
  }
  const pts: BoltPt[] = [[segs[0][0], segs[0][1]]]
  for (const s of segs) pts.push([s[2], s[3]])
  return { pts, forks }
}

// Assemble un éclair complet : le TRONC (haut → bas) puis 1 à 3 BRANCHES accrochées à des milieux,
// réunis en UN SEUL `d` (sous-tracés M…L…) et dans l'ordre tronc→branches → le `stroke-dashoffset`
// révèle le tronc d'abord puis les branches, et l'ensemble s'efface d'un bloc (pas de segment détaché).
function buildBolt(): string {
  const fmt = (pts: BoltPt[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const trunk = fractalBolt(44 + Math.random() * 12, 0, 30 + Math.random() * 40, 200, 6, 46)
  const subpaths = [fmt(trunk.pts)]
  const forks = trunk.forks.sort((a, b) => a.y - b.y) // de haut en bas → révélées dans l'ordre
  const nBranch = 1 + Math.floor(Math.random() * 3)
  for (let k = 0; k < nBranch && forks.length; k++) {
    const f = forks.splice(Math.floor(Math.random() * forks.length), 1)[0]
    const blen = 34 + Math.random() * 46
    const ang = f.ang + (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.55) // s'écarte du tronc
    const ex = Math.max(2, Math.min(98, f.x + Math.cos(ang) * blen))
    const ey = f.y + Math.abs(Math.sin(ang)) * blen // toujours vers le bas
    subpaths.push(fmt(fractalBolt(f.x, f.y, ex, ey, 4, 22).pts))
  }
  return subpaths.join(' ')
}

function UnderwaterDecor() {
  // SURPRISE « Coup Fatal » (Tabbou élimine tous les combattants) : une boule d'énergie apparaît en
  // haut au centre, se charge, puis EXPLOSE en projetant trois rayons #992C0A vers le plateau.
  // Déclenchée par le bus de surprise (mode test ; à terme, l'événement moteur du coup fatal). `seq`
  // sert de clé React pour REJOUER l'anim à chaque déclenchement.
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  const [smash, setSmash] = useState<number | null>(null)
  useEffect(() => {
    let clear: ReturnType<typeof setTimeout>
    let seq = 0
    fireRef.current = () => {
      setSmash(seq++)
      clearTimeout(clear)
      clear = setTimeout(() => setSmash(null), UNDERWATER_SMASH_MS)
    }
    return () => clearTimeout(clear)
  }, [])
  const [layers] = useState(() =>
    Array.from({ length: UNDERWATER_LAYERS }, (_, i) => {
      const bf = 0.008 + Math.random() * 0.02 // fréquence de base du bruit
      const seed = 1 + Math.floor(Math.random() * 90)
      const cut = 2.0 + Math.random() * 0.5 // seuil alpha : moyen → densité intermédiaire
      const dur = 14 + Math.random() * 16 // s (respiration lente)
      const size = 34 + Math.random() * 30 // vh (taille de tuile du masque)
      const dir = Math.random() < 0.5 ? -1 : 1
      const sx = dir * (10 + Math.random() * 16) // vh (dérive horizontale du masque)
      const sy = (Math.random() - 0.5) * 30 // vh (dérive verticale)
      const s0 = 1 + Math.random() * 0.1 // zoom de départ
      const s2 = s0 + 0.08 + Math.random() * 0.14 // zoom d'arrivée
      // Enveloppe d'opacité : pic OU creux au milieu (chaque calque respire à son rythme).
      const base = 0.4 + Math.random() * 0.35
      const swing = 0.25 + Math.random() * 0.3
      const up = Math.random() < 0.5
      return {
        url: UNDERWATER_CAUSTIC_URL(`${bf.toFixed(4)} ${(bf * 1.5).toFixed(4)}`, seed, cut),
        dur,
        size,
        sx,
        sy,
        s0,
        s1: (s0 + s2) / 2,
        s2,
        o0: base,
        o1: up ? Math.min(1, base + swing) : Math.max(0.08, base - swing),
        o2: base * (0.75 + Math.random() * 0.3),
        // Décalage RÉPARTI par indice (phase distincte garantie pour chaque calque) + jitter :
        // les respirations d'opacité ne battent jamais en phase.
        delay: -(((i + Math.random() * 0.6) / UNDERWATER_LAYERS) * dur),
      }
    }),
  )
  // Nappes de BRUME BLEUE floues qui traversent lentement l'écran (par-dessus les caustiques),
  // en montant/descendant légèrement et en apparaissant/disparaissant en fondu.
  const [mist] = useState(() =>
    Array.from({ length: 4 }, () => {
      const dir = Math.random() < 0.5 ? 1 : -1 // sens de traversée
      const w = 80 + Math.random() * 80 // vh (nappe large)
      return {
        top: Math.random() * 100, // %
        w, // vh
        h: w * (0.4 + Math.random() * 0.7), // vh (dimensions inégales → difforme)
        radius: randomBlobRadius(), // bords organiques → forme irrégulière
        dur: 28 + Math.random() * 26, // s (traversée lente)
        delay: -(Math.random() * 45), // s (déphasées)
        x0: -85 * dir, // vw (départ hors champ)
        x1: 85 * dir, // vw (arrivée hors champ)
        y: (Math.random() - 0.5) * 12, // vh (léger dénivelé)
        op: 0.24 + Math.random() * 0.16, // opacité de pointe (plus discrète)
      }
    }),
  )
  // Orbes des mondes (Brawl) : boules lumineuses qui flottent doucement et pulsent ; UN SEUL
  // exemplaire par carte de monde (halo blanc/bleu autour).
  const [orbs] = useState(() =>
    UNDERWATER_ORB_IMAGES.map((img) => ({
      img,
      zoom: 1.0 + Math.random() * 0.15, // effet « petite planète » : très léger gros plan
      left: Math.random() * 100, // %
      top: Math.random() * 100, // %
      size: 4 + Math.random() * 6, // vh
      dx: (Math.random() - 0.5) * 12, // vw (amplitude de flottement)
      dy: (Math.random() - 0.5) * 12, // vh
      floatDur: 16 + Math.random() * 16, // s
      pulseDur: 3 + Math.random() * 3, // s
      delay: -(Math.random() * 20), // s (déphasés)
      op: 0.55 + Math.random() * 0.4, // opacité de pointe
    })),
  )
  // Éclairs bleus : tracés fixés au montage, chacun claque brièvement une fois par cycle, à un
  // moment décalé (delay réparti par indice → ils ne flashent pas ensemble).
  const [bolts] = useState(() =>
    Array.from({ length: UNDERWATER_BOLTS }, (_, i) => {
      const dur = 8 + Math.random() * 10 // s (cadence des frappes)
      return {
        d: buildBolt(),
        left: 6 + Math.random() * 84, // %
        top: -4 + Math.random() * 84, // % (n'importe où dans la colonne, pas seulement en haut)
        w: 5 + Math.random() * 6, // vw (éclair étroit)
        h: 24 + Math.random() * 22, // vh (plus court)
        dur,
        delay: -(((i + Math.random() * 0.6) / UNDERWATER_BOLTS) * dur), // décalage réparti
      }
    }),
  )
  return (
    <div className="underwater-decor" aria-hidden>
      {/* Chaque calque masque le même dégradé (couleur) avec ses propres caustiques clairsemées. */}
      {layers.map((l, i) => (
        <div
          key={i}
          className="underwater-surface"
          style={
            {
              WebkitMaskImage: l.url,
              maskImage: l.url,
              WebkitMaskSize: `${l.size}vh ${l.size}vh`,
              maskSize: `${l.size}vh ${l.size}vh`,
              animationDuration: `${l.dur}s`,
              animationDelay: `${l.delay}s`,
              '--sx': `${l.sx}vh`,
              '--sy': `${l.sy}vh`,
              '--s0': l.s0,
              '--s1': l.s1,
              '--s2': l.s2,
              '--o0': l.o0,
              '--o1': l.o1,
              '--o2': l.o2,
            } as CSSProperties
          }
        />
      ))}
      {/* Nappes de brume bleue qui traversent l'écran. */}
      {mist.map((m, i) => (
        <span
          key={`mist-${i}`}
          className="underwater-mist"
          style={
            {
              top: `${m.top}%`,
              width: `${m.w}vh`,
              height: `${m.h}vh`,
              borderRadius: m.radius,
              animationDuration: `${m.dur}s`,
              animationDelay: `${m.delay}s`,
              '--x0': `${m.x0}vw`,
              '--x1': `${m.x1}vw`,
              '--y': `${m.y}vh`,
              '--op': m.op,
            } as CSSProperties
          }
        />
      ))}
      {/* Orbes des mondes : boules blanches lumineuses qui flottent et pulsent. */}
      {orbs.map((o, i) => (
        <span
          key={`orb-${i}`}
          className="underwater-orb"
          style={
            {
              left: `${o.left}%`,
              top: `${o.top}%`,
              width: `${o.size}vh`,
              height: `${o.size}vh`,
              animationDelay: `${o.delay}s`,
              '--float-dur': `${o.floatDur}s`,
              '--pulse-dur': `${o.pulseDur}s`,
              '--dx': `${o.dx}vw`,
              '--dy': `${o.dy}vh`,
              '--op': o.op,
            } as CSSProperties
          }
        >
          <img className="underwater-orb-img" src={o.img} alt="" style={{ '--zoom': o.zoom } as CSSProperties} />
          {/* Calque blanc par-dessus l'image (éclaircit la carte → aspect orbe lumineuse). */}
          <span className="underwater-orb-veil" />
        </span>
      ))}
      {/* Éclairs bleus qui claquent par intermittence : tracé fin (halo + cœur). */}
      {bolts.map((b, i) => (
        <div
          key={`bolt-${i}`}
          className="underwater-bolt"
          style={
            {
              left: `${b.left}%`,
              top: `${b.top}%`,
              width: `${b.w}vw`,
              height: `${b.h}vh`,
              // Durée/décalage transmis aux enfants (les propriétés perso héritent).
              '--dur': `${b.dur}s`,
              '--delay': `${b.delay}s`,
            } as CSSProperties
          }
        >
          <svg className="underwater-bolt-svg" viewBox="0 0 100 200" preserveAspectRatio="none">
            {/* Halo bleu sous le cœur, puis cœur fin quasi-blanc (même tracé, synchronisés). */}
            <path className="underwater-bolt-glow" d={b.d} pathLength={100} />
            <path className="underwater-bolt-core" d={b.d} pathLength={100} />
          </svg>
        </div>
      ))}
      {/* Surprise « Coup Fatal » : Tabbou AILÉ apparaît 3 s au centre en haut, PUIS enchaîne sur la
          boule d'énergie qui se charge → explose → émet trois cercles (onde de choc) #992C0A décalés. */}
      {smash != null && (
        <div key={smash} className="uw-smash">
          {/* Halo lumineux derrière les ailes (screen) → transperce les panneaux translucides du plateau. */}
          <span className="uw-smash-wings-glow" />
          <img className="uw-smash-wings" src="/animations/tabbou_ailes.png" alt="" draggable={false} />
          <span className="uw-smash-ball" />
          <span className="uw-smash-burst" />
          <span className="uw-smash-ring" style={{ '--ring-delay': '0s' } as CSSProperties} />
          <span className="uw-smash-ring" style={{ '--ring-delay': '0.13s' } as CSSProperties} />
          <span className="uw-smash-ring" style={{ '--ring-delay': '0.26s' } as CSSProperties} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Décor permanent : Le Flagelleur Mental — le MONDE À L'ENVERS (Stranger Things).
// Ciel d'orage nocturne quasi-noir. Des NUAGES sombres et flous DÉRIVENT lentement en
// travers de la colonne (profondeur : proches = gros/opaques/nets/rapides ; lointains =
// petits/pâles/flous/lents), chacun traversant en fondu aux bords (comme la brume de Tabbou).
// Des ÉCLAIRS ROUGES fractals (réutilisent `buildBolt`, comme les éclairs bleus de Tabbou)
// claquent par intermittence, chacun sur son cycle décalé. Chaque frappe s'accompagne d'un
// LARGE HALO ROUGE en `mix-blend-mode: screen`, posé AU-DESSUS des nuages → il les ILLUMINE
// en rouge le temps du flash (au repos, les nuages restent sombres). 100 % CSS. La révélation
// de l'éclair réutilise `underwaterBolt` (dashoffset/opacité, générique) ; le halo est synchro.
// ---------------------------------------------------------------------------
const UPSIDE_DOWN_CLOUDS = 15
const UPSIDE_DOWN_TOP_CLOUDS = 7 // plafond de nuages amassés en haut de la colonne (la source de l'orage)
const UPSIDE_DOWN_BOLTS = 6
const UPSIDE_DOWN_MOTES = 120
// Surprise « Le Flagelleur Mental apparaît » : un gros tonnerre éclate et révèle la silhouette de la
// créature, entourée d'une lueur blanc & rouge, visible ~3 s, puis elle se dissipe. Le calque est
// (dé)monté le temps de l'animation (REVEAL_MS). ⚠️ REVEAL_MS doit rester en phase avec la durée des
// keyframes `udFlayer*` (index.css, 7 s).
const UPSIDE_DOWN_FLAYER_TEST = false // true → cadence accélérée (~8–12 s) pour régler
const UD_FLAYER_REVEAL_MS = 7000
const UD_FLAYER_GAP_MIN_MS = UPSIDE_DOWN_FLAYER_TEST ? 8000 : 120000 // 2 min
const UD_FLAYER_GAP_MAX_MS = UPSIDE_DOWN_FLAYER_TEST ? 12000 : 240000 // 4 min

function UpsideDownDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Nappes de nuages : la profondeur (0 lointain → 1 proche) corrèle taille/opacité/netteté/vitesse.
  // Chacune TRAVERSE la colonne (translateX --x0 → --x1) en fondu aux bords. Figées au montage.
  const [clouds] = useState(() =>
    Array.from({ length: UPSIDE_DOWN_CLOUDS }, () => {
      const depth = Math.random()
      const dir = Math.random() < 0.5 ? 1 : -1
      const w = 52 + depth * 92 // vh (nappe large)
      return {
        top: -8 + Math.random() * 108, // % (réparti sur toute la hauteur, un peu au-delà)
        w, // vh
        h: w * (0.46 + Math.random() * 0.4), // vh (nappe aplatie)
        radius: randomBlobRadius(), // bords organiques
        blur: 30 - depth * 16, // px (proches plus nets)
        op: 0.26 + depth * 0.44, // opacité de pointe
        dur: 74 - depth * 36 + Math.random() * 22, // s (proches plus rapides)
        delay: -(Math.random() * 90), // s (déphasées)
        x0: -95 * dir, // vw (départ hors champ)
        x1: 95 * dir, // vw (arrivée hors champ)
        y: (Math.random() - 0.5) * 9, // vh (léger dénivelé)
      }
    }),
  )
  // PLAFOND de nuages amassés en HAUT du div (la source de l'orage) : nappes larges et basses,
  // agglutinées près du bord haut, qui dérivent LENTEMENT (débordent largement des bords → couvre
  // continu, jamais de trou). Plus opaques/nettes que les nuages de fond. Figées au montage.
  const [topClouds] = useState(() =>
    Array.from({ length: UPSIDE_DOWN_TOP_CLOUDS }, (_, i) => {
      const dir = i % 2 === 0 ? 1 : -1
      const w = 78 + Math.random() * 70 // vh (nappe très large)
      return {
        top: -14 + Math.random() * 16, // % (amassées tout en haut)
        w, // vh
        h: w * (0.34 + Math.random() * 0.24), // vh (nappe aplatie, basse)
        radius: randomBlobRadius(),
        blur: 6 + Math.random() * 7, // px (plafond NET)
        op: 0.62 + Math.random() * 0.3, // opacité de pointe (plafond dense)
        dur: 120 + Math.random() * 60, // s (dérive lente)
        delay: -(Math.random() * 160), // s (déphasées → couvert dès le montage)
        x0: -70 * dir, // vw
        x1: 70 * dir, // vw
        y: (Math.random() - 0.5) * 5, // vh (peu de dénivelé)
      }
    }),
  )
  // Spores en suspension : fines particules pâles FIGÉES au montage qui dérivent très lentement (boucle
  // fermée → pas de « pop ») en balançant et scintillant. La profondeur (0 lointain → 1 proche) corrèle
  // taille/opacité/netteté/vitesse. Rendues ENTRE les nuages et les éclairs → le halo rouge (screen) des
  // frappes les baigne de rouge le temps du flash (tie-in avec l'effet-signature).
  const [motes] = useState(() =>
    Array.from({ length: UPSIDE_DOWN_MOTES }, () => {
      const depth = Math.random()
      const sgn = () => (Math.random() < 0.5 ? 1 : -1)
      return {
        left: Math.random() * 100, // %
        top: -5 + Math.random() * 110, // %
        size: 2.2 + depth * 6, // px (proches plus grosses)
        blur: 0.6 + (1 - depth) * 1.6, // px (bord floconneux ; lointaines plus floues)
        op: 0.45 + depth * 0.5, // opacité de pointe
        driftDur: 18 + (1 - depth) * 24 + Math.random() * 9, // s (lointaines plus lentes)
        driftDelay: -(Math.random() * 40), // s (déphasées)
        dx: sgn() * (3 + Math.random() * 7), // vh (amplitude de dérive)
        dy: sgn() * (2 + Math.random() * 6), // vh
        dx2: sgn() * (2 + Math.random() * 6), // vh (2e point d'inflexion)
        sway: 0.4 + Math.random() * 1.3, // vh (balancement latéral)
        swayDur: 4 + Math.random() * 5, // s
        swayDelay: -(Math.random() * 6), // s
        twDur: 7 + Math.random() * 7, // s (respiration lente, pas un clignotement)
        twDelay: -(Math.random() * 12), // s
      }
    }),
  )
  // Éclairs rouges : tracé fractal figé, chacun claque sur un cycle décalé (delay réparti par indice
  // → ils ne flashent jamais ensemble), avec un halo dont le rayon `glow` illumine les nuages autour.
  const [bolts] = useState(() =>
    Array.from({ length: UPSIDE_DOWN_BOLTS }, (_, i) => {
      const dur = 6.5 + Math.random() * 9 // s (cadence des frappes)
      return {
        d: buildBolt(),
        left: 5 + Math.random() * 86, // %
        top: -8 + Math.random() * 66, // % (n'importe où en haut de la colonne)
        w: 6 + Math.random() * 7, // vw (éclair étroit)
        h: 26 + Math.random() * 24, // vh
        glow: 38 + Math.random() * 26, // vh (rayon du halo qui illumine les nuages)
        dur,
        delay: -(((i + Math.random() * 0.6) / UPSIDE_DOWN_BOLTS) * dur),
      }
    }),
  )
  // ARBRES de Hawkins (12 silhouettes de sapins `arbre-1..12.png`) : ligne d'arbres au bas de la colonne
  // (backdrop de forêt), DERRIÈRE les poteaux. Profondeur (0 lointain → 1 proche) : proches plus grands,
  // opaques, nets, base plus basse ; lointains plus petits, flous, estompés, base un peu plus haute
  // (horizon). Image/miroir tirés au hasard, positions figées au montage. Triés far→near (overlap correct).
  const [trees] = useState(() => {
    const N = 12
    return Array.from({ length: N }, () => {
      const depth = Math.random()
      return {
        img: 1 + Math.floor(Math.random() * 12), // arbre-1..12
        left: Math.random() * 104 - 2, // % (déborde un peu des bords)
        h: 24 + depth * 30, // vh (proches plus grands)
        bottom: (1 - depth) * 6, // vh (lointains un peu plus haut = horizon)
        blur: (1 - depth) * 1.7, // px
        op: 0.4 + depth * 0.5,
        flip: Math.random() < 0.5,
        // Tangage (effet vent) : bascule depuis la base. Amplitude un peu plus forte pour les proches.
        sway: 0.25 + depth * 0.7, // deg (léger)
        swayDur: 4 + Math.random() * 4, // s
        swayDelay: -(Math.random() * 6), // s (désynchronise)
        depth,
      }
    }).sort((a, b) => a.depth - b.depth) // lointains d'abord → les proches passent devant
  })
  // POTEAUX électriques de Hawkins (image `pylones.png`, silhouette recolorée en ardoise sombre pour
  // rester lisible sur le ciel quasi-noir). Plein-hauteur, rootés au bas, avec PROFONDEUR (proches plus
  // grands/nets/opaques). Figés au montage. On calcule aussi les ancres des traverses (haut/bas) pour
  // y accrocher les FILS. Ratio image = 199/959.
  const POLE_RATIO = 199 / 959
  const [poles] = useState(() => {
    // Profils curés (premier plan) : x (% centre), profondeur (0 lointain → 1 proche), miroir horizontal.
    const defs = [
      { left: 20, depth: 0.4, flip: false },
      { left: 60, depth: 1.0, flip: true },
      { left: 91, depth: 0.12, flip: false },
    ]
    return defs.map((d) => {
      // Poteaux PLUS PETITS et PLUS BAS : rootés en bas, une hauteur réduite descend d'autant traverses
      // et fils (les ancres `armY*` suivent). La profondeur joue sur taille/opacité/flou.
      const h = 46 + d.depth * 16 // vh (46→62 ; proches un peu plus grands)
      return {
        left: d.left, // % (centre du fût)
        h, // vh
        w: h * POLE_RATIO, // vh
        blur: (1 - d.depth) * 1.4, // px (lointains plus flous)
        op: 0.52 + d.depth * 0.44,
        flip: d.flip,
        // Ancres des fils (en % de hauteur d'écran) : le poteau est rooté en bas (top = 100 - h vh ≈ %),
        // traverses haute ~8,5 % et basse ~16 % depuis le sommet de l'image.
        armYUpper: 100 - h + 0.085 * h,
        armYLower: 100 - h + 0.16 * h,
      }
    })
  })
  // FILS électriques : chaînettes (courbes quadratiques qui s'affaissent) entre traverses de poteaux
  // voisins (déjà triés par `left`). 3 câbles par travée (2 en haut, 1 en bas). Coordonnées en % (SVG
  // viewBox 0..100, preserveAspectRatio none → épouse la colonne).
  const wirePaths = (() => {
    const out: string[] = []
    // Câbles à 3 niveaux (2 haut + 1 bas) entre deux ancres, affaissés en chaînette.
    const span3 = (ax: number, aUp: number, aLow: number, bx: number, bUp: number, bLow: number) => {
      const sag = Math.abs(bx - ax) * 0.16 + 2.5 // % (croît avec la portée)
      const levels: [number, number][] = [
        [aUp, bUp],
        [aUp + 1.5, bUp + 1.5],
        [aLow, bLow],
      ]
      for (const [ya, yb] of levels) {
        out.push(`M ${ax} ${ya} Q ${(ax + bx) / 2} ${Math.max(ya, yb) + sag} ${bx} ${yb}`)
      }
    }
    // Travées entre poteaux voisins (déjà triés par `left`).
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i]
      const b = poles[i + 1]
      span3(a.left, a.armYUpper, a.armYLower, b.left, b.armYUpper, b.armYLower)
    }
    // Ligne qui PART VERS LA GAUCHE depuis le poteau le plus à gauche (elle continue hors champ vers un
    // poteau invisible). Ancre de départ hors cadre (x < 0), un peu plus HAUTE (poteau lointain plus haut).
    const first = poles.reduce((m, p) => (p.left < m.left ? p : m), poles[0])
    span3(-14, first.armYUpper - 5, first.armYLower - 5, first.left, first.armYUpper, first.armYLower)
    // Ligne qui PART VERS LA DROITE depuis le 3ᵉ poteau (le plus à droite), en miroir : elle file hors
    // champ (x > 100) vers un poteau invisible, avec une ancre d'arrivée un peu plus HAUTE (poteau lointain).
    const last = poles.reduce((m, p) => (p.left > m.left ? p : m), poles[0])
    span3(last.left, last.armYUpper, last.armYLower, 114, last.armYUpper - 5, last.armYLower - 5)
    return out
  })()
  // Surprise : le Flagelleur Mental apparaît sous un gros tonnerre. On (dé)monte le calque `.ud-flayer`
  // le temps de l'animation. 2-3 ÉNORMES éclairs, re-tirés à chaque frappe (variété) et étagés en delay
  // → ils claquent coup sur coup et « ouvrent la porte » à l'entrée de la créature.
  const [reveal, setReveal] = useState<{ bolts: { d: string; left: number; delay: number }[] } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const fire = () => {
      const n = 2 + Math.floor(Math.random() * 2) // 2 ou 3
      const bolts = Array.from({ length: n }, (_, i) => ({
        d: buildBolt(),
        left: 30 + (i + 0.5) * (40 / n) + (Math.random() - 0.5) * 10, // répartis sur la largeur centrale
        delay: i * 0.14 + Math.random() * 0.05, // s (coup sur coup)
      }))
      setReveal({ bolts })
      clear = setTimeout(() => setReveal(null), UD_FLAYER_REVEAL_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(UD_FLAYER_GAP_MIN_MS + Math.random() * (UD_FLAYER_GAP_MAX_MS - UD_FLAYER_GAP_MIN_MS))
      }, delay)
    }
    schedule(60000 + Math.random() * 40000) // première apparition entre 1 min et 1 min 40
    // MODE TEST : déclenche l'apparition à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className="ud-decor" aria-hidden>
      {/* Nappes de nuages sombres qui dérivent. */}
      {clouds.map((c, i) => (
        <span
          key={`cloud-${i}`}
          className="ud-cloud"
          style={
            {
              top: `${c.top}%`,
              width: `${c.w}vh`,
              height: `${c.h}vh`,
              borderRadius: c.radius,
              filter: `blur(${c.blur}px)`,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              '--x0': `${c.x0}vw`,
              '--x1': `${c.x1}vw`,
              '--y': `${c.y}vh`,
              '--op': c.op,
            } as CSSProperties
          }
        />
      ))}
      {/* PLAFOND de nuages amassés en haut du div (la source de l'orage). */}
      {topClouds.map((c, i) => (
        <span
          key={`topcloud-${i}`}
          className="ud-cloud ud-cloud-top"
          style={
            {
              top: `${c.top}%`,
              width: `${c.w}vh`,
              height: `${c.h}vh`,
              borderRadius: c.radius,
              filter: `blur(${c.blur}px)`,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              '--x0': `${c.x0}vw`,
              '--x1': `${c.x1}vw`,
              '--y': `${c.y}vh`,
              '--op': c.op,
            } as CSSProperties
          }
        />
      ))}
      {/* Spores en suspension (au-dessus des nuages, sous les éclairs → baignées de rouge à la frappe). */}
      {motes.map((m, i) => (
        <span
          key={`mote-${i}`}
          className="ud-mote"
          style={
            {
              left: `${m.left}%`,
              top: `${m.top}%`,
              animationDuration: `${m.driftDur}s`,
              animationDelay: `${m.driftDelay}s`,
              '--dx': `${m.dx}vh`,
              '--dy': `${m.dy}vh`,
              '--dx2': `${m.dx2}vh`,
            } as CSSProperties
          }
        >
          <span
            className="ud-mote-dot"
            style={
              {
                width: `${m.size}px`,
                height: `${m.size}px`,
                filter: m.blur > 0.05 ? `blur(${m.blur}px)` : undefined,
                '--op': m.op,
                '--sway': `${m.sway}vh`,
                animationDuration: `${m.swayDur}s, ${m.twDur}s`,
                animationDelay: `${m.swayDelay}s, ${m.twDelay}s`,
              } as CSSProperties
            }
          />
        </span>
      ))}
      {/* Ligne d'ARBRES (sapins de Hawkins) au bas de la colonne, DERRIÈRE les poteaux. */}
      {trees.map((t, i) => (
        <img
          key={`tree-${i}`}
          className="ud-tree"
          src={`/animations/arbre-${t.img}.png`}
          alt=""
          draggable={false}
          style={{
            left: `${t.left}%`,
            height: `${t.h}vh`,
            bottom: `${t.bottom}vh`,
            opacity: t.op,
            filter: `invert(1) brightness(0.2) blur(${t.blur}px)`,
            animationDuration: `${t.swayDur}s`,
            animationDelay: `${t.swayDelay}s`,
            '--flip': t.flip ? -1 : 1,
            '--sw': `${t.sway}deg`,
          } as CSSProperties}
        />
      ))}
      {/* Poteaux électriques de Hawkins (silhouettes ardoise) + leurs fils, au premier plan (sous les
          éclairs → baignés de rouge à la frappe). */}
      <svg className="ud-wires" viewBox="0 0 100 100" preserveAspectRatio="none">
        <g className="ud-wire-sway">
          {wirePaths.map((d, i) => (
            <path key={`wire-${i}`} d={d} />
          ))}
        </g>
      </svg>
      {poles.map((p, i) => (
        <img
          key={`pole-${i}`}
          className="ud-pole"
          src="/animations/pylones.png"
          alt=""
          draggable={false}
          style={{
            left: `${p.left}%`,
            height: `${p.h}vh`,
            width: `${p.w}vh`,
            opacity: p.op,
            filter: `invert(1) brightness(0.26) blur(${p.blur}px)`,
            transform: `translateX(-50%)${p.flip ? ' scaleX(-1)' : ''}`,
          }}
        />
      ))}
      {/* Éclairs rouges + leur halo d'illumination (au-dessus des nuages). */}
      {bolts.map((b, i) => (
        <div
          key={`bolt-${i}`}
          className="ud-bolt"
          style={
            {
              left: `${b.left}%`,
              top: `${b.top}%`,
              width: `${b.w}vw`,
              height: `${b.h}vh`,
              '--dur': `${b.dur}s`,
              '--delay': `${b.delay}s`,
            } as CSSProperties
          }
        >
          {/* Halo rouge qui ILLUMINE les nuages (screen), synchronisé au flash de l'éclair. */}
          <span className="ud-bolt-glow" style={{ '--glow': `${b.glow}vh` } as CSSProperties} />
          {/* L'éclair : halo rouge épais sous un cœur clair rosé (même tracé → synchronisés). */}
          <svg className="ud-bolt-svg" viewBox="0 0 100 200" preserveAspectRatio="none">
            <path className="ud-bolt-halo" d={b.d} pathLength={100} />
            <path className="ud-bolt-core" d={b.d} pathLength={100} />
          </svg>
        </div>
      ))}
      {/* SURPRISE : gros tonnerre + apparition du Flagelleur Mental (lueur blanc & rouge), ~3 s. */}
      {reveal && (
        <div className="ud-flayer">
          {/* Flash du tonnerre : embrasement blanc → rouge plein cadre (screen), one-shot. */}
          <span className="ud-flayer-flash" />
          {/* 2-3 énormes éclairs, étagés (delay), qui ouvrent l'entrée de la créature. */}
          {reveal.bolts.map((b, i) => (
            <svg
              key={`fbolt-${i}`}
              className="ud-flayer-bolt"
              viewBox="0 0 100 200"
              preserveAspectRatio="none"
              style={{ left: `${b.left}%`, '--delay': `${b.delay}s` } as CSSProperties}
            >
              <path className="ud-flayer-bolt-halo" d={b.d} pathLength={100} />
              <path className="ud-flayer-bolt-core" d={b.d} pathLength={100} />
            </svg>
          ))}
          {/* Lueur blanc & rouge derrière la silhouette (pulse le temps de l'apparition). */}
          <span className="ud-flayer-glow" />
          {/* La créature (silhouette rouge sur transparent), auréolée de blanc/rouge. */}
          <img className="ud-flayer-img" src="/animations/flagelleur_mental.png" alt="" />
        </div>
      )}
    </div>
  )
}

// Décor `felGate` (Gul'dan) : marée de gangrené. 100 % CSS, aucun asset.
const FEL_VAPOR = 26 // colonnes de gangrené qui montent
const FEL_VAPOR_DUR = 12 // s (sert à étager les départs → colonnes continues)
const FEL_ASHES = 34 // cendres de gangrené qui s'élèvent
// Teintes de la vapeur (radial-gradient posé en inline) : le VERT FEL domine, quelques colonnes VIOLET
// du Vide en accent (pour distinguer Gul'dan des autres décors verts).
const FEL_VAPOR_GREEN =
  'radial-gradient(circle, rgba(150, 255, 120, 0.52) 0%, rgba(70, 220, 60, 0.3) 45%, rgba(25, 120, 30, 0) 72%)'
const FEL_VAPOR_VIOLET =
  'radial-gradient(circle, rgba(205, 140, 255, 0.5) 0%, rgba(150, 70, 235, 0.3) 45%, rgba(80, 25, 130, 0) 72%)'
// Couleurs des cendres montantes : vert fel (majorité) et violet du Vide (accent).
const FEL_ASH_GREEN = ['#8dff6b', '#a6ff7c', '#6bff5a', '#c4ffb0', '#7cff8f']
const FEL_ASH_VIOLET = ['#c98bff', '#b164ff', '#e0b0ff']
// Mer de LAVE FEL au pied de la colonne (hauteur de la nappe + nb de bulles qui la crèvent).
const FEL_LAVA_HEIGHT_VH = 44
const FEL_LAVA_BUBBLES = 22

/** Silhouette d'une VAGUE de lave, en SVG encodé en data-URI (aucun fichier). Le tracé sert deux
 *  fois : rempli d'un dégradé de croûte sombre (le corps de la vague) puis repassé au trait clair
 *  (la LÈVRE en fusion qui court sur la crête). Deux profils (`variant`) — chacun combine deux
 *  longueurs d'onde pour ne pas ressembler à une sinusoïde parfaite —, tous deux BOUCLABLES : le
 *  tracé part et revient à la même hauteur, donc la répétition horizontale est invisible. */
function felWaveUrl(variant: 0 | 1, lip: string, lipWidth: number): string {
  // viewBox 240 × 60, étiré ensuite par `background-size` (preserveAspectRatio='none').
  const crest =
    variant === 0
      ? 'M0,30 C18,14 38,11 58,21 C76,30 90,45 114,43 C137,41 149,19 173,17 C197,15 215,33 240,30'
      : 'M0,26 C26,33 42,45 66,41 C88,37 98,15 124,13 C150,11 160,30 186,32 C208,34 220,20 240,26'
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 60' preserveAspectRatio='none'>` +
    `<defs><linearGradient id='c' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='#24501d'/><stop offset='0.3' stop-color='#0e1c0c'/>` +
    `<stop offset='1' stop-color='#070d06'/></linearGradient></defs>` +
    `<path d='${crest} L240,60 L0,60 Z' fill='url(#c)'/>` +
    `<path d='${crest}' fill='none' stroke='${lip}' stroke-width='${lipWidth}' stroke-linecap='round'/>` +
    `</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** Les VAGUES de la mer de lave, du large (en haut, petites et lentes) jusqu'aux rives proches (en
 *  bas, amples et rapides). Rendues dans cet ordre : chaque vague RECOUVRE la précédente jusqu'au
 *  bas de la mer → parallaxe, et surtout aucune bande ne se termine par une coupe horizontale.
 *  `top` = hauteur de la crête au-dessus du bas de la mer, `amp` = hauteur de la houle, `period` =
 *  longueur d'onde (vh) ; `dur` en s, une vague sur deux remonte le courant. */
const FEL_LAVA_WAVES = [
  { top: 38, amp: 5, period: 26, dur: 64, back: false, variant: 0, lip: 'rgba(190,255,160,0.75)', lw: 2, op: 0.85 },
  { top: 33.5, amp: 7.5, period: 35, dur: 48, back: true, variant: 1, lip: 'rgba(180,255,150,0.85)', lw: 2.4, op: 0.9 },
  { top: 27, amp: 10, period: 45, dur: 36, back: false, variant: 0, lip: 'rgba(200,255,170,0.9)', lw: 2.8, op: 0.95 },
  { top: 19, amp: 14, period: 60, dur: 27, back: true, variant: 1, lip: 'rgba(215,255,185,0.95)', lw: 3.2, op: 1 },
] as const
// Couleur de fond de la vague sous sa houle : EXACTEMENT le dernier `stop` du dégradé de
// `felWaveUrl`, pour que le remplissage prolonge le SVG sans raccord visible.
const FEL_WAVE_BODY = '#070d06'

// SURPRISE « LE PORTAIL DES TÉNÈBRES ». Le CONTOUR de la colonne devient l'arche du portail :
// le pourtour s'embrase de fel, l'intérieur s'ouvre sur L'ESPACE (Draenor vu depuis le Vide), et
// des feux / brumes verts nés au bord sont ASPIRÉS en spirale vers le centre. Jalons (ms depuis
// le début) — à garder en phase avec les transitions CSS de `.fel-gate--*`.
const FEL_GATE_CHARGE_MS = 1600 // l'arche s'allume (le fel court le long du contour)
const FEL_GATE_OPEN_MS = 3000 // l'intérieur se déchire : l'espace apparaît (flash)
const FEL_GATE_SUCK_MS = 8600 // fin de l'aspiration → le portail se referme
const FEL_GATE_DUR_MS = 10600 // fin de la séquence (retour au décor normal)
const FEL_GATE_GAP_MIN_MS = 60_000 // entre deux ouvertures (c'est une SURPRISE : c'est rare)
const FEL_GATE_GAP_MAX_MS = 110_000
const FEL_GATE_MOTES = 38 // feux / brumes aspirés vers le centre
const FEL_GATE_STARS = 70 // étoiles du fond spatial vu au travers du portail

/** Un feu / une brume de gangrené aspiré vers le centre du portail : il naît sur le CONTOUR
 *  (position de départ en % depuis le centre) et se rue vers le cœur en tournant. */
type FelGateMote = {
  fx: number // % de la largeur de la colonne (départ, depuis le centre : ±50 = le bord)
  fy: number // % de la hauteur
  size: number // vh
  dur: number // s (temps de chute vers le cœur)
  delay: number // s (négatif : flux déjà en cours → aucun « pop » à l'ouverture)
  spin: number // deg (spirale : rotation du trajet pendant la chute)
  violet: boolean // accent du Vide
  flame: boolean // feu net (petit et vif) plutôt que brume (large et floue)
}

/** Tire les feux / brumes du portail : départs répartis sur tout le pourtour de la colonne
 *  (un bord tiré au sort, l'autre coordonnée libre) → l'aspiration vient de partout. */
function buildFelGateMotes(): FelGateMote[] {
  return Array.from({ length: FEL_GATE_MOTES }, (_, i) => {
    // Bord de départ : on plaque une coordonnée au bord (±48 %) et on laisse l'autre libre.
    const vertical = Math.random() < 0.62 // la colonne est haute : plus de départs par les grands côtés
    const edge = (Math.random() < 0.5 ? -1 : 1) * (44 + Math.random() * 10)
    const free = (Math.random() - 0.5) * 96
    const flame = Math.random() < 0.55
    const dur = 2.6 + Math.random() * 2.6
    return {
      fx: vertical ? free : edge,
      fy: vertical ? edge : free,
      size: flame ? 2 + Math.random() * 2.4 : 6 + Math.random() * 8, // vh
      dur,
      delay: -((i / FEL_GATE_MOTES) * dur * 2) - Math.random() * 1.2, // s (étagé → flux continu)
      spin: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 70), // deg
      violet: Math.random() < 0.24,
      flame,
    }
  })
}

function FelGateDecor() {
  // Volutes de gangrené qui montent du sol (réutilise le keyframe `vaporRise`), étagées → colonnes
  // continues. ~1/5 vire au violet (accent du Vide). Figées au montage.
  const [vapor] = useState(() =>
    Array.from({ length: FEL_VAPOR }, (_, i) => ({
      left: Math.random() * 100, // %
      size: 13 + Math.random() * 17, // vh
      dur: FEL_VAPOR_DUR + Math.random() * 6, // s
      delay: -((i / FEL_VAPOR) * FEL_VAPOR_DUR) - Math.random() * 2, // s (étagé → colonne dense)
      sx: (Math.random() - 0.5) * 12, // vw (enroulement latéral)
      op: 0.14 + Math.random() * 0.18,
      violet: Math.random() < 0.22, // accent du Vide
    })),
  )
  // Cendres de gangrené qui s'élèvent en ondulant et scintillant (réutilise les motes de Facilier :
  // enveloppe = montée, milieu = ondulation, pastille = scintillement). Majorité verte, accent violet.
  const [ashes] = useState(() =>
    Array.from({ length: FEL_ASHES }, () => {
      const violet = Math.random() < 0.25
      const palette = violet ? FEL_ASH_VIOLET : FEL_ASH_GREEN
      return {
        left: Math.random() * 100, // %
        size: 1.6 + Math.random() * 3, // px
        dur: 9 + Math.random() * 9, // s (montée lente)
        delay: -(Math.random() * 18), // s
        sway: 2 + Math.random() * 5, // vw
        swayDur: 3 + Math.random() * 3, // s
        twkDur: 1.6 + Math.random() * 2, // s
        twkDelay: -(Math.random() * 3), // s
        op: 0.4 + Math.random() * 0.5,
        color: palette[Math.floor(Math.random() * palette.length)],
      }
    }),
  )
  // Bulles de lave fel : elles gonflent puis CRÈVENT la surface de la mer de lave. Réparties sur
  // toute la largeur et étagées en hauteur dans la nappe (plus bas = plus proche = plus grosse).
  const [lavaBubbles] = useState(() =>
    Array.from({ length: FEL_LAVA_BUBBLES }, () => {
      const depth = Math.random() // 0 = au fond (loin, petite), 1 = au premier plan (grosse)
      return {
        left: Math.random() * 100, // %
        // Cantonnées au HAUT de la nappe : le bandeau du joueur masque le bas de la colonne, une
        // bulle qui crève en dessous ne se verrait jamais.
        bottom: (0.95 - depth * 0.42) * FEL_LAVA_HEIGHT_VH, // vh
        size: 1.2 + depth * 3.4, // vh
        dur: 2.4 + Math.random() * 3.4, // s (gonfle → crève)
        delay: -(Math.random() * 6), // s
      }
    }),
  )
  // Feux / brumes aspirés et étoiles du fond spatial : tirés une fois au montage (le portail
  // rejoue toujours le même ciel ; les trajets bouclent en CSS tant qu'il est ouvert).
  const [gateMotes] = useState(buildFelGateMotes)
  const [gateStars] = useState(() =>
    Array.from({ length: FEL_GATE_STARS }, () => ({
      left: Math.random() * 100, // %
      top: Math.random() * 100, // %
      size: 1 + Math.random() * 2.4, // px
      op: 0.35 + Math.random() * 0.6,
      dur: 2.4 + Math.random() * 4, // s (scintillement)
      delay: -(Math.random() * 6), // s
    })),
  )

  // SURPRISE « le Portail des Ténèbres ». Phases : `charge` = l'arche s'embrase le long du contour ;
  // `open` = l'intérieur se déchire sur l'espace (flash) ; `suck` = les feux de gangrené sont aspirés
  // vers le cœur ; `close` = le portail se referme. Timer interne (rare), aussi tiré par l'outil de test.
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  const [gate, setGate] = useState<{ seq: number; phase: 'charge' | 'open' | 'suck' | 'close' } | null>(null)
  useEffect(() => {
    let next: ReturnType<typeof setTimeout>
    const steps: ReturnType<typeof setTimeout>[] = []
    let seq = 0
    const gap = () => FEL_GATE_GAP_MIN_MS + Math.random() * (FEL_GATE_GAP_MAX_MS - FEL_GATE_GAP_MIN_MS)
    // Ne change de phase que si la séquence en cours est toujours celle qu'on a lancée.
    const phase = (s: number, p: 'open' | 'suck' | 'close', at: number) =>
      steps.push(setTimeout(() => setGate((g) => (g && g.seq === s ? { ...g, phase: p } : g)), at))
    const fire = (fireRef.current = () => {
      clearTimeout(next) // (re)déclenchement manuel : on repart d'un cycle propre
      for (const t of steps.splice(0)) clearTimeout(t)
      const s = seq++
      setGate({ seq: s, phase: 'charge' })
      phase(s, 'open', FEL_GATE_CHARGE_MS)
      phase(s, 'suck', FEL_GATE_OPEN_MS)
      phase(s, 'close', FEL_GATE_SUCK_MS)
      steps.push(setTimeout(() => setGate((g) => (g && g.seq === s ? null : g)), FEL_GATE_DUR_MS))
      next = setTimeout(fire, FEL_GATE_DUR_MS + gap())
    })
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      for (const t of steps) clearTimeout(t)
    }
  }, [])
  // Portail ouvert (l'espace est visible) : l'ambiance de Draenor s'efface derrière le Vide.
  const gateOpen = gate?.phase === 'open' || gate?.phase === 'suck'

  return (
    <div className="fel-decor" aria-hidden>
      <div className={`fel-ambient${gateOpen ? ' fel-ambient--gate' : ''}`}>
        {/* MER DE LAVE FEL au pied de la colonne : bain en fusion sous des plaques de croûte qui
            dérivent, crête incandescente à l'horizon, et bulles qui crèvent la surface. */}
        <div className="fel-lava" style={{ height: `${FEL_LAVA_HEIGHT_VH}vh` }}>
          <div className="fel-lava-shore" />
          {FEL_LAVA_WAVES.map((w, i) => (
            <span
              key={`flw-${i}`}
              className="fel-lava-wave"
              style={{
                height: `${w.top}vh`,
                opacity: w.op,
                // La houle en haut, puis un aplat de croûte qui descend jusqu'au bas de la mer.
                backgroundImage: `${felWaveUrl(w.variant, w.lip, w.lw)}, linear-gradient(${FEL_WAVE_BODY}, ${FEL_WAVE_BODY})`,
                backgroundSize: `${w.period}vh ${w.amp}vh, 100% 100%`,
                animationDuration: `${w.dur}s`,
                animationDirection: w.back ? 'reverse' : 'normal',
                // Le défilement fait EXACTEMENT une longueur d'onde : la boucle est invisible.
                '--period': `${w.period}vh`,
                '--amp': `${w.amp}vh`,
              } as CSSProperties}
            />
          ))}
          {lavaBubbles.map((b, i) => (
            <span
              key={`flb-${i}`}
              className="fel-lava-bubble"
              style={{
                left: `${b.left}%`,
                bottom: `${b.bottom}vh`,
                width: `${b.size}vh`,
                height: `${b.size * 0.6}vh`,
                animationDuration: `${b.dur}s`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
        </div>
        {/* Lueur fel VERTE pulsante (au sol, les lieux corrompus). */}
        <div className="fel-glow" />
        {/* Lueur VIOLETTE du Vide, sur un autre battement (l'appel des Anciens Dieux). */}
        <div className="fel-glow-void" />
        {/* Cendres de gangrené qui montent (montée > ondulation > scintillement). */}
        {ashes.map((m, i) => (
          <span
            key={`ash-${i}`}
            className="voodoo-mote-rise"
            style={{ left: `${m.left}%`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
          >
            <span
              className="voodoo-mote-sway"
              style={{ animationDuration: `${m.swayDur}s`, animationDelay: `${m.delay}s`, '--sway': `${m.sway}vw` } as CSSProperties}
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
        {/* Volutes de gangrené (par-dessus les cendres). */}
        {vapor.map((p, i) => (
          <span
            key={`fvap-${i}`}
            className="fel-vapor"
            style={{
              left: `${p.left}%`,
              width: `${p.size}vh`,
              height: `${p.size}vh`,
              background: p.violet ? FEL_VAPOR_VIOLET : FEL_VAPOR_GREEN,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              '--sx': `${p.sx}vw`,
              '--vop': p.op,
            } as CSSProperties}
          />
        ))}
      </div>
      {/* SURPRISE : LE PORTAIL DES TÉNÈBRES s'ouvre — le CONTOUR de la colonne EST l'arche. */}
      {gate && (
        <div className={`fel-gate fel-gate--${gate.phase}`}>
          {/* L'AU-DELÀ : l'espace vu au travers du portail (nébuleuse fel + étoiles). */}
          <div className="fel-gate-space">
            {gateStars.map((s, i) => (
              <span
                key={`fgs-${i}`}
                className="fel-gate-star"
                style={{
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  '--op': s.op,
                  animationDuration: `${s.dur}s`,
                  animationDelay: `${s.delay}s`,
                } as CSSProperties}
              />
            ))}
          </div>
          {/* LE MAELSTRÖM : les bras de fel (verts) et du Vide (violet) qui tournent autour du cœur. */}
          <div className="fel-gate-vortex">
            <div className="fel-gate-arm fel-gate-arm--a" />
            <div className="fel-gate-arm fel-gate-arm--b" />
            <div className="fel-gate-arm fel-gate-arm--c" />
          </div>
          {/* Le CŒUR : l'œil vert-blanc du portail, qui bat et avale tout. */}
          <div className="fel-gate-core" />
          {/* Feux et brumes de gangrené ASPIRÉS depuis le contour vers le cœur (spirale). */}
          <div className="fel-gate-pull">
            {gateMotes.map((m, i) => (
              <span
                key={`fgm-${i}`}
                className="fel-gate-swirl"
                style={{
                  animationDuration: `${m.dur}s`,
                  animationDelay: `${m.delay}s`,
                  '--spin': `${m.spin}deg`,
                } as CSSProperties}
              >
                <span
                  className={`fel-gate-mote${m.flame ? ' fel-gate-mote--flame' : ''}`}
                  style={{
                    width: `${m.size}vh`,
                    height: `${m.size}vh`,
                    background: m.violet ? FEL_VAPOR_VIOLET : FEL_VAPOR_GREEN,
                    // Flou proportionnel à la taille : une brume se fond, un feu reste net.
                    '--mb': `${m.flame ? 0.3 : m.size / 3.4}vh`,
                    // Départ sur le contour : % de la COLONNE (le plan entier se contracte vers
                    // le centre → le feu converge sur le cœur en tournant).
                    left: `calc(50% + ${m.fx}%)`,
                    top: `calc(50% + ${m.fy}%)`,
                  } as CSSProperties}
                />
              </span>
            ))}
          </div>
          {/* L'ARCHE : le contour de la colonne s'embrase (double liseré + halo fel). */}
          <div className="fel-gate-rim" />
          {/* Le fel qui COURT le long de l'arche (dégradé conique en rotation, masqué en anneau). */}
          <div className="fel-gate-rim-run" />
          {/* Flash de la déchirure (l'instant où l'espace apparaît). */}
          <div className="fel-gate-flash" />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SURPRISE PARTAGÉE Sumbra/Killaire : les ESPRITS LIBÉRÉS qui FLOTTENT et s'élèvent depuis le BAS de
// la colonne (World of Light : Galeem/Dharkon vaincu relâche les combattants capturés en esprits). Les
// têtes-esprits (images `spirit-1..17.png`, aura arc-en-ciel) montent en fondu et bercent puis se
// dissipent. Apparaissent EN BAS (visible ; le plateau opaque masque le centre). Surprise
// minutée + déclenchable en test (fireRef). Utilisée par RiftDecor (Sumbra) ET RadianceDecor (Killaire).
// ---------------------------------------------------------------------------
const SPIRIT_IMAGES = Array.from({ length: 17 }, (_, i) => `/animations/spirit-${i + 1}.png`)
const SPIRITS_TEST = false // true → cadence accélérée (~8–12 s) pour régler
const SPIRITS_COUNT = 14 // nb d'esprits relâchés par envol
const SPIRITS_DURATION_MS = 12500 // durée d'un envol (≥ delay max + dur max des keyframes)
const SPIRITS_GAP_MIN_MS = SPIRITS_TEST ? 8000 : 90000 // 1 min 30
const SPIRITS_GAP_MAX_MS = SPIRITS_TEST ? 12000 : 200000 // ~3 min 20

type SpiritItem = {
  img: string; left: number; size: number; top: number; rise: number
  sway: number; r0: number; r1: number; dur: number; delay: number; op: number
}

function SpiritsSurprise({ fireRef }: { fireRef: React.MutableRefObject<() => void> }) {
  const [swarm, setSwarm] = useState<SpiritItem[] | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    const fire = () => {
      // Images tirées SANS REMISE (mélange puis on prend SPIRITS_COUNT des 17) → aucun doublon d'image
      // dans un même envol.
      const pool = [...SPIRIT_IMAGES]
      for (let k = pool.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1))
        ;[pool[k], pool[j]] = [pool[j], pool[k]]
      }
      const items: SpiritItem[] = Array.from({ length: SPIRITS_COUNT }, (_, i) => {
        const size = 4.5 + Math.random() * 4.5 // vh (hauteur de l'esprit)
        const top = 78 + Math.random() * 16 // % (apparaît EN BAS de la colonne ; ≈ top vh, colonne pleine hauteur)
        return {
          img: pool[i],
          left: 3 + Math.random() * 88, // % (réparti sur la largeur)
          size,
          top,
          // Montée = distance du bas (top vh) + sa propre taille + marge → chaque esprit SORT complètement
          // par le haut (sinon fill-mode `both` le figerait encore à l'écran = « bloqué »).
          rise: top + size + 14 + Math.random() * 10, // vh
          sway: (Math.random() - 0.5) * 8, // vw (balancement latéral au milieu de la montée)
          r0: (Math.random() - 0.5) * 16, // deg (inclinaison de départ/arrivée)
          r1: (Math.random() - 0.5) * 20, // deg (inclinaison au milieu)
          dur: 5 + Math.random() * 4, // s (montée lente et flottante)
          delay: Math.random() * 2.5, // s (entrée étagée → ils montent en désordre)
          op: 0.75 + Math.random() * 0.25,
        }
      })
      setSwarm(items)
      clear = setTimeout(() => setSwarm(null), SPIRITS_DURATION_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(SPIRITS_GAP_MIN_MS + Math.random() * (SPIRITS_GAP_MAX_MS - SPIRITS_GAP_MIN_MS))
      }, delay)
    }
    schedule(45000 + Math.random() * 40000) // 1re apparition entre 45 s et ~1 min 25
    fireRef.current = fire // MODE TEST : relâche les esprits à la demande.
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [fireRef])
  if (!swarm) return null
  return (
    <div className="spirits-swarm" aria-hidden>
      {swarm.map((s, i) => (
        <span
          key={`spirit-${i}`}
          className="spirit-float"
          style={
            {
              left: `${s.left}%`,
              top: `${s.top}%`,
              '--sz': `${s.size}vh`,
              '--rise': `${s.rise}vh`,
              '--sway': `${s.sway}vw`,
              '--r0': `${s.r0}deg`,
              '--r1': `${s.r1}deg`,
              '--sop': s.op,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            } as CSSProperties
          }
        >
          {/* Traînée arc-en-ciel laissée en montant (s'estompe vers le bas, derrière l'esprit). */}
          <span className="spirit-trail" />
          <img className="spirit-img" src={s.img} alt="" style={{ height: `${s.size}vh` }} />
        </span>
      ))}
    </div>
  )
}

// Décor permanent : SUMBRA (Dharkon — SSBU « La Lueur du Monde »), kind `rift`.
// LES TÉNÈBRES BRISENT LE MONDE. Fond d'abîme noir-violet + vignette lourde, une LUEUR
// centrale rouge-violet qui pulse (l'œil de Dharkon), et surtout des FISSURES DENSES qui
// apparaissent EN CONTINU : chacune se TRACE (stroke-dashoffset), luit un moment puis s'efface
// et renaît, réparties dans TOUTES LES DIRECTIONS (SVG pivoté d'un angle aléatoire). Le tracé
// fractal réutilise `buildBolt` (comme les éclairs de Tabbou/Flagelleur) — une fissure = un
// éclair figé, trait NOIR (la déchirure du Vide) cerné d'un liseré violet lumineux. Du VIDE suinte du bas (volutes
// violettes, réutilise `vaporRise`) et une POUSSIÈRE d'esprits violette/rouge dérive (réutilise
// `.voodoo-mote-*`). 100 % CSS.
// ---------------------------------------------------------------------------
const RIFT_CRACKS = 26 // fissures qui apparaissent/disparaissent en continu (dense)
const RIFT_VAPOR = 16 // volutes de Vide qui suintent du bas
const RIFT_VAPOR_DUR = 12 // s (sert à étager les départs → colonnes continues)
const RIFT_MOTES = 42 // poussière d'esprits qui dérive
// Teinte de la vapeur du Vide (radial posé en inline) : violet sombre.
const RIFT_VAPOR_VIOLET =
  'radial-gradient(circle, rgba(180, 90, 255, 0.42) 0%, rgba(120, 40, 210, 0.24) 45%, rgba(60, 15, 110, 0) 72%)'
// Couleurs de la poussière d'esprits : violet du Vide (majorité) + éclats rouges de Dharkon (accent).
const RIFT_MOTE_VIOLET = ['#c98bff', '#b164ff', '#e0b0ff', '#a24dff']
const RIFT_MOTE_RED = ['#ff5a7a', '#ff2b4a', '#ff8098']
const RIFT_SHOTS = 5 // TIRS de Vide horizontaux qui filent de gauche à droite (violets — les faisceaux de Dharkon)

function RiftDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Fissures : tracé fractal figé + rotation aléatoire (toutes directions), chacune sur son cycle
  // (durée/délai variés → elles apparaissent et disparaissent en continu, jamais toutes ensemble).
  // Figées au montage.
  const [cracks] = useState(() =>
    Array.from({ length: RIFT_CRACKS }, () => {
      const dur = 7 + Math.random() * 8 // s
      return {
        d: buildBolt(),
        left: Math.random() * 100, // % (centre de la boîte)
        top: -6 + Math.random() * 112, // %
        w: 12 + Math.random() * 20, // vh (boîte de la fissure)
        h: 20 + Math.random() * 32, // vh
        rot: Math.random() * 360, // deg (toutes directions)
        dur,
        delay: -(Math.random() * dur), // s (déphasées → dense dès le montage)
      }
    }),
  )
  // Volutes de Vide qui montent du bas (réutilise `vaporRise`), étagées → colonnes continues. Figées.
  const [vapor] = useState(() =>
    Array.from({ length: RIFT_VAPOR }, (_, i) => ({
      left: Math.random() * 100, // %
      size: 13 + Math.random() * 16, // vh
      dur: RIFT_VAPOR_DUR + Math.random() * 6, // s
      delay: -((i / RIFT_VAPOR) * RIFT_VAPOR_DUR) - Math.random() * 2, // s (étagé → colonne dense)
      sx: (Math.random() - 0.5) * 12, // vw (enroulement latéral)
      op: 0.12 + Math.random() * 0.16,
    })),
  )
  // Poussière d'esprits qui s'élève en ondulant et scintillant (réutilise les motes de Facilier :
  // enveloppe = montée, milieu = ondulation, pastille = scintillement). Majorité violette, accent rouge.
  const [motes] = useState(() =>
    Array.from({ length: RIFT_MOTES }, () => {
      const red = Math.random() < 0.22
      const palette = red ? RIFT_MOTE_RED : RIFT_MOTE_VIOLET
      return {
        left: Math.random() * 100, // %
        size: 1.6 + Math.random() * 3, // px
        dur: 9 + Math.random() * 9, // s (montée lente)
        delay: -(Math.random() * 18), // s
        sway: 2 + Math.random() * 5, // vw
        swayDur: 3 + Math.random() * 3, // s
        twkDur: 1.6 + Math.random() * 2, // s
        twkDelay: -(Math.random() * 3), // s
        op: 0.4 + Math.random() * 0.5,
        color: palette[Math.floor(Math.random() * palette.length)],
      }
    }),
  )
  // TIRS de Vide horizontaux qui filent de GAUCHE À DROITE (les faisceaux de Dharkon). Trait violet
  // (tête à droite, traîne à gauche) qui FILE vite en travers puis reste parqué hors champ (dart bref +
  // pause → tirs répétés, déphasés). Hauteur ALÉATOIRE (ceux à mi-hauteur passent derrière le plateau).
  const [shots] = useState(() =>
    Array.from({ length: RIFT_SHOTS }, () => {
      const dur = 2.6 + Math.random() * 2.6 // s (cycle : le tir lui-même est bref → rapide + pause)
      const len = 22 + Math.random() * 20 // % de la largeur de colonne (longueur du trait)
      return {
        top: 3 + Math.random() * 92, // % (hauteur aléatoire sur toute la colonne)
        len,
        thick: 0.18 + Math.random() * 0.42, // vh (trait très fin, façon laser)
        dur,
        delay: -(Math.random() * dur), // s (déphasé → tirs étalés dès le montage)
        op: 0.75 + Math.random() * 0.25,
      }
    }),
  )
  return (
    <div className="rift-decor" aria-hidden>
      {/* Œil de Dharkon : lueur centrale rouge-violet qui pulse. */}
      <div className="rift-glow" />
      {/* Poussière d'esprits qui monte (montée > ondulation > scintillement). */}
      {motes.map((m, i) => (
        <span
          key={`rmote-${i}`}
          className="voodoo-mote-rise"
          style={{ left: `${m.left}%`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
        >
          <span
            className="voodoo-mote-sway"
            style={{ animationDuration: `${m.swayDur}s`, animationDelay: `${m.delay}s`, '--sway': `${m.sway}vw` } as CSSProperties}
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
      {/* Volutes de Vide qui suintent du bas. */}
      {vapor.map((p, i) => (
        <span
          key={`rvap-${i}`}
          className="rift-vapor"
          style={{
            left: `${p.left}%`,
            width: `${p.size}vh`,
            height: `${p.size}vh`,
            background: RIFT_VAPOR_VIOLET,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            '--sx': `${p.sx}vw`,
            '--vop': p.op,
          } as CSSProperties}
        />
      ))}
      {/* Fissures denses qui apparaissent/disparaissent en continu (dans toutes les directions). */}
      {cracks.map((c, i) => (
        <div
          key={`crack-${i}`}
          className="rift-crack"
          style={
            {
              left: `${c.left}%`,
              top: `${c.top}%`,
              width: `${c.w}vh`,
              height: `${c.h}vh`,
              transform: `translate(-50%, -50%) rotate(${c.rot}deg)`,
              '--dur': `${c.dur}s`,
              '--delay': `${c.delay}s`,
            } as CSSProperties
          }
        >
          <svg className="rift-crack-svg" viewBox="0 0 100 200" preserveAspectRatio="none">
            <path className="rift-crack-halo" d={c.d} pathLength={100} />
            <path className="rift-crack-core" d={c.d} pathLength={100} />
          </svg>
        </div>
      ))}
      {/* Tirs de Vide violets qui filent de gauche à droite (les faisceaux de Dharkon). */}
      {shots.map((s, i) => (
        <span
          key={`rshot-${i}`}
          className="rift-shot"
          style={
            {
              top: `${s.top}%`,
              width: `${s.len}%`,
              height: `${s.thick}vh`,
              '--beam-op': s.op,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            } as CSSProperties
          }
        />
      ))}
      {/* SURPRISE : les esprits libérés qui s'élèvent depuis le bas. */}
      <SpiritsSurprise fireRef={fireRef} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Décor permanent : KILLAIRE (Galeem — SSBU « La Lueur du Monde »), kind `radiance`.
// LE MIROIR LUMINEUX du `rift` de Sumbra. LA LUMIÈRE SUBMERGE LE MONDE. Fond blanc-doré
// éblouissant + vignette CLAIRE, une LUEUR centrale blanc-or qui pulse (le cœur de Galeem), et
// surtout des RAYONS DENSES qui jaillissent EN CONTINU : chacun se TRACE (stroke-dashoffset), éclate
// un moment puis s'estompe et renaît, répartis dans TOUTES LES DIRECTIONS (SVG pivoté d'un angle
// aléatoire). Le tracé réutilise `buildBolt` (comme les fissures de Sumbra), mais cœur BLANC lumineux
// cerné d'un liseré doré (exact négatif de la fissure noire à liseré violet). De la LUMIÈRE dorée
// monte du bas (volutes, réutilise `vaporRise`) et une POUSSIÈRE d'esprits or/blanc/bleu dérive
// (réutilise `.voodoo-mote-*` ; accents BLEUS = la couleur de Killaire). 100 % CSS.
// ---------------------------------------------------------------------------
const RADIANCE_RAYS = 26 // rayons de lumière qui jaillissent/s'estompent en continu (dense)
const RADIANCE_VAPOR = 16 // volutes de lumière qui montent du bas
const RADIANCE_VAPOR_DUR = 12 // s (sert à étager les départs → colonnes continues)
const RADIANCE_MOTES = 42 // poussière d'esprits qui dérive
const RADIANCE_SHOTS = 5 // TIRS de lumière horizontaux qui filent de droite à gauche (faisceaux de Galeem)
// Teinte de la vapeur de lumière (radial posé en inline) : blanc-doré chaud.
const RADIANCE_VAPOR_GOLD =
  'radial-gradient(circle, rgba(255, 240, 190, 0.5) 0%, rgba(255, 210, 110, 0.26) 45%, rgba(255, 180, 60, 0) 72%)'
// Couleurs de la poussière d'esprits : or/blanc de la Lumière (majorité) + éclats bleus de Killaire (accent).
const RADIANCE_MOTE_GOLD = ['#fff3c0', '#ffe08a', '#ffd257', '#fffbe6']
const RADIANCE_MOTE_BLUE = ['#8ea6ff', '#5d74ff', '#b6c6ff']

function RadianceDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Rayons : tracé fractal figé + rotation aléatoire (toutes directions), chacun sur son cycle
  // (durée/délai variés → ils jaillissent et s'estompent en continu, jamais tous ensemble). Figés au montage.
  const [rays] = useState(() =>
    Array.from({ length: RADIANCE_RAYS }, () => {
      const dur = 7 + Math.random() * 8 // s
      return {
        d: buildBolt(),
        left: Math.random() * 100, // % (centre de la boîte)
        top: -6 + Math.random() * 112, // %
        w: 12 + Math.random() * 20, // vh (boîte du rayon)
        h: 20 + Math.random() * 32, // vh
        rot: Math.random() * 360, // deg (toutes directions)
        dur,
        delay: -(Math.random() * dur), // s (déphasés → dense dès le montage)
      }
    }),
  )
  // Volutes de lumière qui montent du bas (réutilise `vaporRise`), étagées → colonnes continues. Figées.
  const [vapor] = useState(() =>
    Array.from({ length: RADIANCE_VAPOR }, (_, i) => ({
      left: Math.random() * 100, // %
      size: 13 + Math.random() * 16, // vh
      dur: RADIANCE_VAPOR_DUR + Math.random() * 6, // s
      delay: -((i / RADIANCE_VAPOR) * RADIANCE_VAPOR_DUR) - Math.random() * 2, // s (étagé → colonne dense)
      sx: (Math.random() - 0.5) * 12, // vw (enroulement latéral)
      op: 0.12 + Math.random() * 0.16,
    })),
  )
  // Poussière d'esprits qui s'élève en ondulant et scintillant (réutilise les motes de Facilier).
  // Majorité or/blanc, accent bleu (la couleur de Killaire).
  const [motes] = useState(() =>
    Array.from({ length: RADIANCE_MOTES }, () => {
      const blue = Math.random() < 0.22
      const palette = blue ? RADIANCE_MOTE_BLUE : RADIANCE_MOTE_GOLD
      return {
        left: Math.random() * 100, // %
        size: 1.6 + Math.random() * 3, // px
        dur: 9 + Math.random() * 9, // s (montée lente)
        delay: -(Math.random() * 18), // s
        sway: 2 + Math.random() * 5, // vw
        swayDur: 3 + Math.random() * 3, // s
        twkDur: 1.6 + Math.random() * 2, // s
        twkDelay: -(Math.random() * 3), // s
        op: 0.4 + Math.random() * 0.5,
        color: palette[Math.floor(Math.random() * palette.length)],
      }
    }),
  )
  // TIRS de lumière horizontaux qui filent de DROITE À GAUCHE (les faisceaux de Galeem). Chacun est un
  // trait lumineux (tête à droite, traîne à gauche) qui FILE vite en travers puis reste parqué hors champ
  // (dart bref + pause → tirs répétés, déphasés). Hauteur ALÉATOIRE sur toute la colonne (ceux à
  // mi-hauteur passent derrière le plateau opaque). Figés au montage.
  const [shots] = useState(() =>
    Array.from({ length: RADIANCE_SHOTS }, () => {
      const dur = 2.6 + Math.random() * 2.6 // s (cycle : le tir lui-même est bref → rapide + pause)
      const len = 22 + Math.random() * 20 // % de la largeur de colonne (longueur du trait)
      return {
        top: 3 + Math.random() * 92, // % (hauteur aléatoire sur toute la colonne)
        len,
        thick: 0.18 + Math.random() * 0.42, // vh (trait TRÈS fin, façon laser)
        dur,
        delay: -(Math.random() * dur), // s (déphasé → tirs étalés dès le montage)
        op: 0.75 + Math.random() * 0.25,
        from: -(len + 6), // % (départ entièrement hors champ à gauche)
      }
    }),
  )
  return (
    <div className="radiance-decor" aria-hidden>
      {/* Cœur de Galeem : lueur centrale blanc-or qui pulse. */}
      <div className="radiance-glow" />
      {/* Poussière d'esprits qui monte (montée > ondulation > scintillement). */}
      {motes.map((m, i) => (
        <span
          key={`amote-${i}`}
          className="voodoo-mote-rise"
          style={{ left: `${m.left}%`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
        >
          <span
            className="voodoo-mote-sway"
            style={{ animationDuration: `${m.swayDur}s`, animationDelay: `${m.delay}s`, '--sway': `${m.sway}vw` } as CSSProperties}
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
      {/* Volutes de lumière qui montent du bas. */}
      {vapor.map((p, i) => (
        <span
          key={`avap-${i}`}
          className="radiance-vapor"
          style={{
            left: `${p.left}%`,
            width: `${p.size}vh`,
            height: `${p.size}vh`,
            background: RADIANCE_VAPOR_GOLD,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            '--sx': `${p.sx}vw`,
            '--vop': p.op,
          } as CSSProperties}
        />
      ))}
      {/* Rayons denses qui jaillissent/s'estompent en continu (dans toutes les directions). */}
      {rays.map((r, i) => (
        <div
          key={`ray-${i}`}
          className="radiance-ray"
          style={
            {
              left: `${r.left}%`,
              top: `${r.top}%`,
              width: `${r.w}vh`,
              height: `${r.h}vh`,
              transform: `translate(-50%, -50%) rotate(${r.rot}deg)`,
              '--dur': `${r.dur}s`,
              '--delay': `${r.delay}s`,
            } as CSSProperties
          }
        >
          <svg className="radiance-ray-svg" viewBox="0 0 100 200" preserveAspectRatio="none">
            <path className="radiance-ray-halo" d={r.d} pathLength={100} />
            <path className="radiance-ray-core" d={r.d} pathLength={100} />
          </svg>
        </div>
      ))}
      {/* Tirs de lumière qui filent de droite à gauche (les faisceaux de Galeem). */}
      {shots.map((s, i) => (
        <span
          key={`shot-${i}`}
          className="radiance-shot"
          style={
            {
              top: `${s.top}%`,
              width: `${s.len}%`,
              height: `${s.thick}vh`,
              '--from': `${s.from}%`,
              '--beam-op': s.op,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            } as CSSProperties
          }
        />
      ))}
      {/* SURPRISE : les esprits libérés qui s'élèvent depuis le bas. */}
      <SpiritsSurprise fireRef={fireRef} />
    </div>
  )
}

// Décor `theWorld` (Dio) : horloges & temps. 100 % CSS, aucun asset.
const DIO_NUMERALS_FLOAT = 22 // chiffres romains flottants qui montent
// Chiffres romains du cadran, en ordre horaire à partir du haut (XII).
const DIO_CLOCK_NUMERALS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
// Glyphes tirés pour les chiffres romains flottants.
const DIO_NUMERAL_GLYPHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
// Couleurs : or (The World) en majorité, magenta (aura de Dio) en accent.
const DIO_NUMERAL_GOLD = ['#ffe08a', '#ffd257', '#f5c542', '#ffeab0']
const DIO_NUMERAL_MAGENTA = ['#e06bff', '#c94dff', '#ff7ad4']

// SURPRISE « ZA WARUDO ! » — L'ARRÊT DU TEMPS. Jalons (ms depuis le début de la séquence) : à garder
// en phase avec les durées CSS de `.dio-stop*`.
const DIO_STOP_WIND_MS = 3000 // amorce : le temps DÉFILE (la trotteuse s'emballe, l'or monte en puissance)
const DIO_STOP_COUNT_DELAY_MS = 700 // après le GEL : temps mort avant le 1er chiffre du décompte
const DIO_STOP_COUNT = 9 // les neuf secondes de temps arrêté (I → IX)
const DIO_STOP_TICK_MS = 1000 // une seconde arrêtée par chiffre
// Le temps reprend son cours juste après le dernier chiffre (amorce + attente + les neuf secondes).
const DIO_STOP_RESUME_MS = DIO_STOP_WIND_MS + DIO_STOP_COUNT_DELAY_MS + DIO_STOP_COUNT * DIO_STOP_TICK_MS + 600
const DIO_STOP_DUR_MS = DIO_STOP_RESUME_MS + 1800 // fin de la séquence (décor redevenu normal)
const DIO_STOP_GAP_MIN_MS = 60_000 // entre deux arrêts du temps (c'est une SURPRISE : c'est rare)
const DIO_STOP_GAP_MAX_MS = 110_000
const DIO_STOP_SHARDS = 18 // éclats de temps suspendus, parfaitement immobiles
const DIO_STOP_LINES = 16 // lignes de vitesse (manga) figées, en éventail depuis l'horloge

/** Un éclat de temps suspendu pendant l'arrêt : losange doré (ou magenta) qui apparaît puis ne
 *  bouge PLUS DU TOUT — c'est tout le propos de la séquence. */
type DioShard = { left: number; top: number; size: number; rot: number; op: number; delay: number; magenta: boolean }

function buildDioShards(): DioShard[] {
  return Array.from({ length: DIO_STOP_SHARDS }, () => ({
    left: 4 + Math.random() * 92, // %
    top: 4 + Math.random() * 92, // %
    size: 1.1 + Math.random() * 2.6, // vh
    rot: Math.random() * 360, // deg (orientation figée)
    op: 0.4 + Math.random() * 0.5,
    delay: Math.random() * 0.5, // s (ils se figent les uns après les autres)
    magenta: Math.random() < 0.25,
  }))
}

/** Une ligne de vitesse figée : elle part de l'horloge (angle) et file vers l'extérieur (distance +
 *  longueur), comme les traits d'impact d'une planche de manga. */
type DioSpeedLine = { ang: number; dist: number; len: number; thick: number; op: number; delay: number }

function buildDioSpeedLines(): DioSpeedLine[] {
  return Array.from({ length: DIO_STOP_LINES }, () => ({
    ang: Math.random() * 360, // deg
    dist: 12 + Math.random() * 26, // vh (départ, depuis le centre du cadran)
    len: 10 + Math.random() * 34, // vh
    thick: 0.12 + Math.random() * 0.3, // vh (trait très fin)
    op: 0.25 + Math.random() * 0.45,
    delay: Math.random() * 0.35, // s
  }))
}

function TheWorldDecor() {
  // Chiffres romains flottants : montent en ondulant (réutilise les motes de Facilier), l'enfant est un
  // GLYPHE romain (au lieu d'une pastille) qui scintille. Majorité dorée, accent magenta. Figés au montage.
  const [numerals] = useState(() =>
    Array.from({ length: DIO_NUMERALS_FLOAT }, () => {
      const magenta = Math.random() < 0.22
      const palette = magenta ? DIO_NUMERAL_MAGENTA : DIO_NUMERAL_GOLD
      return {
        glyph: DIO_NUMERAL_GLYPHS[Math.floor(Math.random() * DIO_NUMERAL_GLYPHS.length)],
        left: Math.random() * 100, // %
        size: 1.4 + Math.random() * 2.6, // vh (hauteur de police)
        dur: 13 + Math.random() * 12, // s (montée lente)
        delay: -(Math.random() * 25), // s
        sway: 2 + Math.random() * 5, // vw
        swayDur: 4 + Math.random() * 4, // s
        twkDur: 2.2 + Math.random() * 2.4, // s
        twkDelay: -(Math.random() * 4), // s
        op: 0.35 + Math.random() * 0.45,
        color: palette[Math.floor(Math.random() * palette.length)],
      }
    }),
  )
  // Positions (en %) des chiffres romains autour du cadran de l'horloge nette (12 positions horaires).
  const clockNums = DIO_CLOCK_NUMERALS.map((n, i) => {
    const ang = (i * Math.PI) / 6 // 30° par cran
    return { n, left: 50 + Math.sin(ang) * 40, top: 50 - Math.cos(ang) * 40 }
  })
  // Éclats de temps & lignes de vitesse de la surprise : tirés une fois au montage (l'arrêt du temps
  // rejoue toujours la même « photo » du monde figé).
  const [shards] = useState(buildDioShards)
  const [speedLines] = useState(buildDioSpeedLines)

  // SURPRISE « ZA WARUDO ! » — l'ARRÊT DU TEMPS. Phases : `wind` = le temps s'emballe (la trotteuse
  // vrille, l'or monte) ; `stop` = TOUT SE FIGE (les couches du décor sont mises en PAUSE — donc elles
  // reprendront exactement là où elles se sont arrêtées — le monde se désature, et les cinq secondes
  // s'affichent en chiffres romains dans le cadran) ; `resume` = le temps reprend son cours (2ᵉ flash,
  // l'horloge rattrape en vrillant). Timer interne (rare), aussi tiré par l'outil de test.
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  const [stop, setStop] = useState<{ seq: number; phase: 'wind' | 'stop' | 'resume' } | null>(null)
  useEffect(() => {
    // Pas d'arrêt du temps en reduced-motion (minuterie non lancée, et le calque est masqué en CSS).
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let next: ReturnType<typeof setTimeout>
    const steps: ReturnType<typeof setTimeout>[] = []
    let seq = 0
    const gap = () => DIO_STOP_GAP_MIN_MS + Math.random() * (DIO_STOP_GAP_MAX_MS - DIO_STOP_GAP_MIN_MS)
    // Ne change de phase que si la séquence en cours est toujours celle qu'on a lancée.
    const phase = (s: number, p: 'stop' | 'resume', at: number) =>
      steps.push(setTimeout(() => setStop((v) => (v && v.seq === s ? { ...v, phase: p } : v)), at))
    const fire = (fireRef.current = () => {
      clearTimeout(next) // (re)déclenchement manuel : on repart d'un cycle propre
      for (const t of steps.splice(0)) clearTimeout(t)
      const s = seq++
      setStop({ seq: s, phase: 'wind' })
      phase(s, 'stop', DIO_STOP_WIND_MS) // LE GEL
      phase(s, 'resume', DIO_STOP_RESUME_MS) // « Le temps reprend son cours. »
      steps.push(setTimeout(() => setStop((v) => (v && v.seq === s ? null : v)), DIO_STOP_DUR_MS))
      next = setTimeout(fire, DIO_STOP_DUR_MS + gap())
    })
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      for (const t of steps) clearTimeout(t)
    }
  }, [])
  // Le temps est ARRÊTÉ : on met en pause (et on désature) toutes les couches du décor.
  const frozen = stop?.phase === 'stop'

  return (
    <div
      className={`dio-decor${frozen ? ' dio-decor--stopped' : ''}${stop?.phase === 'wind' ? ' dio-decor--winding' : ''}`}
      aria-hidden
    >
      {/* Aura dorée pulsante (le rayonnement de The World). */}
      <div className="dio-aura" />
      {/* Grand mandala d'horloge qui tourne lentement en arrière-plan (anneaux + graduations dorées).
          Débordant largement → ses anneaux extérieurs restent visibles dans les marges. */}
      <div className="dio-mandala" />
      {/* Chiffres romains flottants (montée > ondulation > scintillement du glyphe). */}
      {numerals.map((m, i) => (
        <span
          key={`dnum-${i}`}
          className="voodoo-mote-rise"
          style={{ left: `${m.left}%`, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
        >
          <span
            className="voodoo-mote-sway"
            style={{ animationDuration: `${m.swayDur}s`, animationDelay: `${m.delay}s`, '--sway': `${m.sway}vw` } as CSSProperties}
          >
            <span
              className="dio-numeral"
              style={{
                fontSize: `${m.size}vh`,
                color: m.color,
                opacity: m.op,
                animationDuration: `${m.twkDur}s`,
                animationDelay: `${m.twkDelay}s`,
                '--num-color': m.color,
              } as CSSProperties}
            >
              {m.glyph}
            </span>
          </span>
        </span>
      ))}
      {/* Horloge dorée nette dans la BANDE HAUTE (au-dessus du plateau, donc bien visible) : cadran,
          chiffres romains posés par trigonométrie, et 3 aiguilles qui tournent. */}
      <div className="dio-clock">
        <span className="dio-clock-ring" />
        {clockNums.map((c, i) => (
          <span key={`cnum-${i}`} className="dio-clock-num" style={{ left: `${c.left}%`, top: `${c.top}%` }}>
            {c.n}
          </span>
        ))}
        <span className="dio-hand dio-hand--h" />
        <span className="dio-hand dio-hand--m" />
        <span className="dio-hand dio-hand--s" />
        <span className="dio-clock-center" />
      </div>
      {/* SURPRISE « ZA WARUDO ! » : le temps défile de plus en plus vite, puis TOUT S'ARRÊTE neuf
          secondes. Aucun texte : le flash GRIS et l'horloge disent tout. */}
      {stop && (
        <div className={`dio-stop dio-stop--${stop.phase}`}>
          {/* Amorce : l'or s'accumule autour du cadran (la charge de The World). */}
          <div className="dio-stop-charge" />
          {/* La trotteuse vrille : pendant l'amorce (le temps défile) ET au retour (elle rattrape les
              neuf secondes perdues, puis s'efface). Masquée pendant le gel — plus rien ne tourne. */}
          {stop.phase !== 'stop' && (
            <div className={`dio-stop-spin${stop.phase === 'resume' ? ' dio-stop-spin--back' : ''}`} />
          )}
          {/* LE FLASH : GRIS au gel (le monde perd ses couleurs), DORÉ au retour (elles reviennent).
              La clé de phase le fait rejouer à chaque bascule. */}
          {stop.phase !== 'wind' && (
            <div
              key={stop.phase}
              className={`dio-stop-flash${stop.phase === 'resume' ? ' dio-stop-flash--back' : ''}`}
            />
          )}
          {/* Onde de choc partie du cadran : seulement au gel. */}
          {frozen && <div className="dio-stop-wave" />}
          {/* Le monde arrêté : voile indigo froid (avec la désaturation des couches, la vie a quitté
              l'image), lignes de vitesse figées et éclats de temps suspendus. */}
          <div className="dio-stop-veil" />
          {speedLines.map((l, i) => (
            <span
              key={`dsl-${i}`}
              className="dio-stop-line"
              style={{
                height: `${l.len}vh`,
                width: `${l.thick}vh`,
                transitionDelay: `${l.delay}s`,
                '--ang': `${l.ang}deg`,
                '--dist': `${l.dist}vh`,
                '--op': l.op,
              } as CSSProperties}
            />
          ))}
          {shards.map((s, i) => (
            <span
              key={`dsh-${i}`}
              className={`dio-stop-shard${s.magenta ? ' dio-stop-shard--magenta' : ''}`}
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.size}vh`,
                height: `${s.size * 1.9}vh`,
                transitionDelay: `${s.delay}s`,
                '--rot': `${s.rot}deg`,
                '--op': s.op,
              } as CSSProperties}
            />
          ))}
          {/* Le décompte des neuf secondes arrêtées, en chiffres romains, DANS le cadran figé (qui
              s'éclipse pendant ce temps) : un chiffre par seconde, I → IX. */}
          {frozen &&
            DIO_NUMERAL_GLYPHS.slice(0, DIO_STOP_COUNT).map((g, i) => (
              <span
                key={`dsc-${i}`}
                className="dio-stop-count"
                style={{ animationDelay: `${DIO_STOP_COUNT_DELAY_MS + i * DIO_STOP_TICK_MS}ms` }}
              >
                {g}
              </span>
            ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Décor permanent : Mr Monopoly — le PLATEAU de Monopoly.
// L'image du plateau (vue de dessus) en grand CARRÉ centré sur la colonne, sur un fond
// de table vert feutré, surmontée de deux couches d'ambiance EN BOUCLE :
//  • des PIONS 2D (chapeau, voiture, chien, chat, botte, bateau) qui font le TOUR du
//    plateau (keyframe `monopolyRide` : un carré parcouru en left/top, sens variable) ;
//  • des CHANTIERS où poussent des MAISONS vertes (1→4) qui se muent en HÔTEL rouge,
//    tiennent un instant, puis se rasent et repartent (machine à états JS par chantier).
// Positions figées en % du carré (donc calées sur le plateau) ; tailles en vh.
// ---------------------------------------------------------------------------

// Le pion marche au MILIEU de la bande de cases (inset depuis le bord) ; les maisons se
// posent un peu plus vers l'intérieur, sur la bande de couleur des propriétés.
const MONOPOLY_TOKEN_INSET = 7 // % depuis le bord (couloir des pions)
const MONOPOLY_HOUSE_INSET = 11.5 // % depuis le bord (bande de couleur des propriétés)
const MONOPOLY_HOTEL_STEP = 5 // 5ᵉ palier = HÔTEL (après 4 maisons), comme au vrai jeu
const MONOPOLY_STEPS = 40 // cases du plateau : le pion avance case par case (À GARDER = `steps(40)` du CSS)

// Point du parcours des pions pour une progression `t` ∈ [0,1) — MÊME géométrie que le keyframe
// `monopolyRide` : un carré (a..b) parcouru dans le sens horaire (haut → droite → bas → gauche).
// Sert à placer les chantiers sur les cases échantillonnées par `steps(40)`.
function monopolyRidePoint(t: number): { left: number; top: number } {
  const a = MONOPOLY_TOKEN_INSET
  const b = 100 - MONOPOLY_TOKEN_INSET
  const seg = (((t % 1) + 1) % 1) * 4 // 0..4 : quart de parcours (0 = haut, 1 = droite, 2 = bas, 3 = gauche)
  if (seg < 1) return { left: a + (b - a) * seg, top: a } // bord HAUT (gauche → droite)
  if (seg < 2) return { left: b, top: a + (b - a) * (seg - 1) } // bord DROIT (haut → bas)
  if (seg < 3) return { left: b - (b - a) * (seg - 2), top: b } // bord BAS (droite → gauche)
  return { left: a, top: b - (b - a) * (seg - 3) } // bord GAUCHE (bas → haut)
}

// Ancre d'un CHANTIER alignée sur la CASE `k` (0→39) : même position tangentielle que la pastille
// rouge de la case (donc « sous » le pion), mais poussée vers l'intérieur jusqu'à la BANDE des maisons
// (anneau jaune). L'axe suit le bord (h en haut/bas, v à gauche/droite).
function monopolyCaseSite(k: number): { left: number; top: number; axis: 'h' | 'v' } {
  const H = MONOPOLY_HOUSE_INSET
  const p = monopolyRidePoint(k / MONOPOLY_STEPS)
  const seg = (((k / MONOPOLY_STEPS) % 1) + 1) % 1 * 4
  if (seg < 1) return { left: p.left, top: H, axis: 'h' } // bord HAUT
  if (seg < 2) return { left: 100 - H, top: p.top, axis: 'v' } // bord DROIT
  if (seg < 3) return { left: p.left, top: 100 - H, axis: 'h' } // bord BAS
  return { left: H, top: p.top, axis: 'v' } // bord GAUCHE
}

interface MonopolyToken { src: string; dur: number; delay: number }
interface MonopolySite { left: number; top: number; axis: 'h' | 'v'; caseId: number }
// Un événement du script : à l'instant `t` (secondes depuis le début de la partie), le chantier de
// cette case doit afficher `count` bâtiments (0 = vide, 1..4 = maisons, 5 = hôtel).
interface MonopolyEvent { t: number; count: number }

// Les cases (0→39) sur lesquelles se construisent les chantiers. SOURCE UNIQUE : ancres du décor +
// carrés verts du debug. Réglable en changeant simplement les n° de cases.
// Le dé (image détourée) — affiché en DEUX exemplaires qui SE BALADENT sur toute la colonne du joueur
// (en repère plein cadre, pas sur le plateau) tout en roulant en continu.
const MONOPOLY_DIE_IMAGE = '/animations/monopoly-de.png'
// Les 4 jetons Monopoly (images détourées) qui font le tour du plateau.
const MONOPOLY_TOKEN_IMAGES = [
  '/animations/monopoly-pion-chapeau.png',
  '/animations/monopoly-pion-voiture.png',
  '/animations/monopoly-pion-chien.png',
  '/animations/monopoly-pion-bateau.png',
]

const MONOPOLY_SITE_CASES = [29, 28, 26, 19, 6, 7, 9, 1, 3, 4]
const MONOPOLY_SITES: MonopolySite[] = MONOPOLY_SITE_CASES.map((c) => ({ ...monopolyCaseSite(c), caseId: c }))

// Durée du SCÉNARIO (comme une partie de Monopoly qui se développe) : 20 min. Après quoi l'état final
// (le plateau construit) reste affiché — pas de remise à zéro qui ferait tout disparaître d'un coup.
const MONOPOLY_SCRIPT_DURATION = 20 * 60 // s

// PRNG déterministe (mulberry32) : le script est le MÊME à chaque partie (graine fixe), mais varié
// d'une case à l'autre. (UI seulement — pas de contrainte de déterminisme du moteur ici.)
function monopolyRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Génère le SCÉNARIO : pour chaque case, une suite d'événements (achat → montée des maisons → parfois
// une revente → … → cible finale, certaines en hôtel). Les cases démarrent à des moments différents et
// montent à leur rythme → un plateau qui se développe progressivement sur 20 min, comme une partie.
function buildMonopolyScript(cases: number[], duration: number): Record<number, MonopolyEvent[]> {
  const rng = monopolyRng(0x9e3779b9) // graine fixe
  const script: Record<number, MonopolyEvent[]> = {}
  cases.forEach((c) => {
    const events: MonopolyEvent[] = []
    // Cible finale : ~30 % hôtel (5), ~45 % 3-4 maisons, ~25 % 1-2 maisons.
    const r = rng()
    const target = r < 0.3 ? 5 : r < 0.75 ? 3 + Math.floor(rng() * 2) : 1 + Math.floor(rng() * 2)
    let t = duration * (0.03 + rng() * 0.5) // premier achat, étalé sur la 1re moitié
    let count = 0
    while (count < target && t < duration * 0.96) {
      count++
      events.push({ t, count })
      // Parfois, une REVENTE (on rase 1-2 maisons) avant de reconstruire — le va-et-vient d'une partie.
      if (count >= 2 && count < target && rng() < 0.16) {
        t += duration * (0.015 + rng() * 0.035)
        count -= Math.min(count - 1, 1 + Math.floor(rng() * 2))
        events.push({ t, count })
      }
      t += duration * (0.025 + rng() * 0.075) // délai avant la maison suivante
    }
    script[c] = events
  })
  return script
}

const MONOPOLY_SCRIPT = buildMonopolyScript(MONOPOLY_SITE_CASES, MONOPOLY_SCRIPT_DURATION)

// --- SURPRISE : « LA TABLE RENVERSÉE » ---------------------------------------------------
// Le grand classique de la soirée Monopoly qui finit mal, en quatre temps :
//  1. le plateau TREMBLE (montée de tension) ;
//  2. LE COUP : il est soulevé, bascule et TOMBE HORS DE L'ÉCRAN par le bas en tournant — au même
//     instant, tout ce qui était dessus (les 4 pions, les maisons vertes, les hôtels rouges, les
//     2 dés et une volée de billets) est ÉJECTÉ en arc BALISTIQUE dans toute la colonne, avec une
//     secousse d'écran ;
//  3. la table est NUE un instant (les derniers billets finissent de retomber) ;
//  4. on RAMASSE le plateau : il remonte par le bas, se repose d'un coup sec (2ᵉ secousse) puis
//     s'immobilise en rebondissant — et les chantiers REPOUSSENT (les bâtiments, démontés le temps
//     du vol, rejouent leur `monopolyPop`). Le compte de chaque chantier n'est PAS perdu : seul
//     l'affichage a été balayé.
// ⚠️ Les 3 jalons ci-dessous sont exprimés en % dans le keyframe `monopolyBoardFlip` (dont la durée
// est posée en inline = MONOPOLY_FLIP_DUR_MS) : 18 % et 68 %. À garder en phase.
const MONOPOLY_FLIP_DUR_MS = 6000 // séquence complète
const MONOPOLY_FLIP_SHAKE_MS = 0.18 * MONOPOLY_FLIP_DUR_MS // LE COUP part ici (fin du tremblement)
const MONOPOLY_FLIP_LAND_MS = 0.68 * MONOPOLY_FLIP_DUR_MS // le plateau est reposé sur la table
const MONOPOLY_FLIP_GAP_MIN_MS = 50_000 // entre deux renversements (c'est une SURPRISE : c'est rare)
const MONOPOLY_FLIP_GAP_MAX_MS = 95_000
const MONOPOLY_FLIP_BILLS = 16 // billets projetés
// Teintes des billets Monopoly (1 / 5 / 10 / 20 / 50 / 100 / 500).
const MONOPOLY_BILL_COLORS = ['#f4efe2', '#f6b8c8', '#f6e08a', '#a8d8a0', '#8fc4e8', '#e2c9a0', '#f2a65a']

// Un projectile du renversement. `left`/`top` sont en % du CARRÉ du plateau (point de départ, donc
// calé sur là où l'objet se trouvait) ; la trajectoire, elle, est en vh (repère écran).
interface MonopolyDebris {
  kind: 'token' | 'die' | 'house' | 'hotel' | 'bill'
  src?: string // image (pion / dé)
  color?: string // billet
  left: number // % du carré du plateau
  top: number // %
  dx: number // vh (portée horizontale, vers l'extérieur)
  peak: number // vh (apex de l'arc, négatif = vers le haut)
  fall: number // vh (chute finale, hors cadre)
  spin: number // deg (tournoiement sur tout le trajet)
  dur: number // s
  delay: number // s (tout ne part pas exactement en même temps)
  size: number // vh (pions / dés / billets)
}

/** Tire les projectiles d'un renversement : chaque objet part de SA place sur le plateau et est
 *  projeté vers l'extérieur (le côté où il se trouvait) en arc balistique. */
function buildMonopolyDebris(): MonopolyDebris[] {
  const launch = (left: number, top: number, extra: Partial<MonopolyDebris>): MonopolyDebris => ({
    kind: 'bill',
    left,
    top,
    dx: (left < 50 ? -1 : 1) * (8 + Math.random() * 34), // projeté du côté où il était
    peak: -(18 + Math.random() * 30), // apex de l'arc
    fall: 70 + Math.random() * 45, // sort par le bas du cadre
    spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 900),
    dur: 2.2 + Math.random() * 1.2,
    delay: Math.random() * 0.22,
    size: 2,
    ...extra,
  })
  const out: MonopolyDebris[] = []
  // Les 4 pions, pris à un point au hasard de leur anneau (leur position exacte est portée par CSS).
  MONOPOLY_TOKEN_IMAGES.forEach((src) => {
    const p = monopolyRidePoint(Math.random())
    out.push(launch(p.left, p.top, { kind: 'token', src, size: 2.6 }))
  })
  // Les 2 dés (ils traînaient sur le plateau).
  for (let i = 0; i < 2; i++) {
    out.push(launch(38 + Math.random() * 24, 38 + Math.random() * 24, { kind: 'die', src: MONOPOLY_DIE_IMAGE, size: 2.4 }))
  }
  // Les bâtiments : 1 ou 2 par CHANTIER (≈ 1 sur 4 en hôtel rouge).
  MONOPOLY_SITES.forEach((s) => {
    for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) {
      out.push(launch(s.left, s.top, { kind: Math.random() < 0.25 ? 'hotel' : 'house' }))
    }
  })
  // La volée de BILLETS, ramassée un peu partout sur le plateau (ils flottent un peu plus longtemps).
  for (let i = 0; i < MONOPOLY_FLIP_BILLS; i++) {
    out.push(launch(12 + Math.random() * 76, 12 + Math.random() * 76, {
      color: MONOPOLY_BILL_COLORS[Math.floor(Math.random() * MONOPOLY_BILL_COLORS.length)],
      size: 1.5 + Math.random() * 1.1,
      dur: 2.6 + Math.random() * 1.4,
    }))
  }
  return out
}

// Petite MAISON / HÔTEL 2D (toit + corps) en SVG inline. Vert = maison, rouge = hôtel.
function MonopolyBuilding({ hotel }: { hotel?: boolean }) {
  return (
    <svg className={hotel ? 'monopoly-hotel' : 'monopoly-house'} viewBox="0 0 20 18" aria-hidden>
      <polygon points="10,1 19,8 1,8" />
      <rect x="3" y="8" width="14" height="9" rx="0.5" />
    </svg>
  )
}

// Un CHANTIER : suit le SCÉNARIO de sa case. Il programme un timeout par événement ; à chaque
// échéance, `count` prend la valeur voulue (les maisons apparaissent une à une, parfois se rasent…).
// `count` 0 = vide, 1..4 = maisons, 5 = hôtel. Après le dernier événement, l'état reste (pas de boucle).
// `swept` : le chantier vient d'être BALAYÉ par un renversement de table → on n'affiche rien le temps
// du vol (le `count` est conservé ; au retour, les bâtiments sont recréés et rejouent `monopolyPop`).
function MonopolyBuildSite({ site, events, swept }: { site: MonopolySite; events: MonopolyEvent[]; swept?: boolean }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const timers = events.map((e) => setTimeout(() => setCount(e.count), e.t * 1000))
    return () => timers.forEach(clearTimeout)
  }, [events])

  if (count === 0 || swept) return null
  const hotel = count >= MONOPOLY_HOTEL_STEP
  return (
    <div
      className={`monopoly-site monopoly-site--${site.axis}`}
      style={{ left: `${site.left}%`, top: `${site.top}%` }}
    >
      {hotel
        ? <MonopolyBuilding hotel />
        : Array.from({ length: count }, (_, i) => <MonopolyBuilding key={i} />)}
    </div>
  )
}

// Fond de table : un CHAMP d'éléments Monopoly (emoji) qui montent en dérivant et tournoyant, en
// semi-transparence, DERRIÈRE le plateau → remplit le vert autour du plateau. Positions/durées figées
// une fois au montage ; l'animation est en CSS (`monopolyFloat`).
function MonopolyBackdrop() {
  const [items] = useState(() => {
    const glyphs = ['💵', '💰', '🪙', '🎩', '❓', '🚂', '💎', '🏠']
    return Array.from({ length: 24 }, (_, i) => ({
      glyph: glyphs[i % glyphs.length],
      left: Math.random() * 100, // %
      size: 2 + Math.random() * 2.6, // vh
      dur: 16 + Math.random() * 16, // s (montée)
      delay: -Math.random() * 32, // s (étalés → flux continu, aucun « pop » au montage)
      sway: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 5), // vw (dérive latérale)
      rot: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 70), // deg (tournoiement)
    }))
  })
  return (
    <div className="monopoly-bg" aria-hidden>
      {items.map((it, i) => (
        <span
          key={i}
          className="monopoly-bg-item"
          style={{
            left: `${it.left}%`,
            fontSize: `${it.size}vh`,
            animationDuration: `${it.dur}s`,
            animationDelay: `${it.delay}s`,
            '--sway': `${it.sway}vw`,
            '--rot': `${it.rot}deg`,
          } as CSSProperties}
        >
          {it.glyph}
        </span>
      ))}
    </div>
  )
}

function MonopolyDecor({ decor }: { decor: Extract<VillainDecorData, { kind: 'monopoly' }> }) {
  // Pions iconiques : les 4 jetons Monopoly (images) qui SAUTILLENT case par case autour du plateau,
  // répartis autour de l'anneau (delay négatif = décalage sur le parcours), à vitesses variées. TOUS
  // dans le sens HORAIRE (le sens « normal » de `monopolyRide`) pour respecter le sens de jeu.
  const [tokens] = useState<MonopolyToken[]>(() => {
    const srcs = MONOPOLY_TOKEN_IMAGES
    return srcs.map((src, i) => {
      const dur = 30 + Math.random() * 14 // s (balade lente)
      return {
        src,
        dur,
        delay: -(i / srcs.length) * dur - Math.random() * 2, // réparti autour du parcours
      }
    })
  })
  const overlayVars = {
    '--a': `${MONOPOLY_TOKEN_INSET}%`,
    '--b': `${100 - MONOPOLY_TOKEN_INSET}%`,
  } as CSSProperties

  // SURPRISE « la table renversée ». Phases : `shake` = le plateau tremble ; `burst` = le coup est
  // parti (le plateau tombe hors de l'écran, tout ce qui était dessus vole) ; `back` = le plateau est
  // reposé sur la table (tout se replace). Timer interne (rare), aussi tiré par l'outil de test.
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  const [flip, setFlip] = useState<{ seq: number; phase: 'shake' | 'burst' | 'back'; debris: MonopolyDebris[] } | null>(null)
  useEffect(() => {
    let next: ReturnType<typeof setTimeout>
    let burst: ReturnType<typeof setTimeout>
    let back: ReturnType<typeof setTimeout>
    let end: ReturnType<typeof setTimeout>
    let seq = 0
    const gap = () => MONOPOLY_FLIP_GAP_MIN_MS + Math.random() * (MONOPOLY_FLIP_GAP_MAX_MS - MONOPOLY_FLIP_GAP_MIN_MS)
    // Ne change de phase que si la séquence en cours est toujours celle qu'on a lancée.
    const phase = (s: number, p: 'burst' | 'back') => setFlip((f) => (f && f.seq === s ? { ...f, phase: p } : f))
    const fire = (fireRef.current = () => {
      clearTimeout(next) // (re)déclenchement manuel : on repart d'un cycle propre
      clearTimeout(burst)
      clearTimeout(back)
      clearTimeout(end)
      const s = seq++
      setFlip({ seq: s, phase: 'shake', debris: buildMonopolyDebris() })
      // LE COUP : le plateau part hors cadre, tout est balayé et projeté (+ secousse d'écran).
      burst = setTimeout(() => phase(s, 'burst'), MONOPOLY_FLIP_SHAKE_MS)
      // Le plateau est reposé sur la table : pions, dés et chantiers reviennent (+ 2ᵉ secousse).
      back = setTimeout(() => phase(s, 'back'), MONOPOLY_FLIP_LAND_MS)
      end = setTimeout(() => setFlip(null), MONOPOLY_FLIP_DUR_MS)
      next = setTimeout(fire, MONOPOLY_FLIP_DUR_MS + gap())
    })
    next = setTimeout(fire, gap())
    return () => {
      clearTimeout(next)
      clearTimeout(burst)
      clearTimeout(back)
      clearTimeout(end)
    }
  }, [])
  // `swept` : le plateau est en l'air / hors cadre → ce qui vivait dessus est masqué. Les projectiles,
  // eux, restent affichés jusqu'à la fin (les derniers billets retombent pendant que le plateau revient).
  const swept = flip?.phase === 'burst'
  const shakeClass = flip?.phase === 'burst' ? ' monopoly-decor--shake' : flip?.phase === 'back' ? ' monopoly-decor--slam' : ''

  return (
    <div className={`monopoly-decor${shakeClass}`} aria-hidden>
      <MonopolyBackdrop />
      <div
        className={`monopoly-board${flip ? ' monopoly-board--flip' : ''}`}
        style={flip ? { animationDuration: `${MONOPOLY_FLIP_DUR_MS}ms` } : undefined}
      >
        <img src={decor.src} alt="" className="monopoly-board-img" />
        <div className="monopoly-overlay" style={overlayVars}>
          {tokens.map((t, i) => (
            <span
              key={i}
              // Balayé : on le MASQUE (sans le démonter) → son parcours CSS continue de tourner et il
              // réapparaît à la bonne case, au lieu de repartir du début de l'anneau.
              className={`monopoly-token${swept ? ' monopoly-token--swept' : ''}`}
              style={{
                animationDuration: `${t.dur}s`,
                animationDelay: `${t.delay}s`,
              }}
            >
              <img
                src={t.src}
                alt=""
                className="monopoly-token-glyph"
                style={{
                  // Un bond par case : durée = durée du tour / nb de cases ; même délai que le
                  // parcours → l'apex du saut tombe pile au changement de case.
                  animationDuration: `${t.dur / MONOPOLY_STEPS}s`,
                  animationDelay: `${t.delay}s`,
                }}
              />
            </span>
          ))}
          {MONOPOLY_SITES.map((s, i) => (
            <MonopolyBuildSite key={i} site={s} events={MONOPOLY_SCRIPT[s.caseId]} swept={swept} />
          ))}
        </div>
      </div>
      {/* Les DEUX dés SE BALADENT sur toute la colonne du joueur (hors du plateau, en repère plein
          cadre) et roulent en continu. */}
      <div className={`monopoly-dice${swept ? ' monopoly-dice--swept' : ''}`}>
        <img src={MONOPOLY_DIE_IMAGE} alt="" className="monopoly-die monopoly-die--a" />
        <img src={MONOPOLY_DIE_IMAGE} alt="" className="monopoly-die monopoly-die--b" />
      </div>
      {/* SURPRISE : tout ce qui était sur le plateau, projeté en arc. Calque calé sur le CARRÉ du
          plateau (coordonnées de départ en % du plateau) mais NON basculé — les projectiles volent
          dans le repère de la colonne. */}
      {flip && flip.phase !== 'shake' && (
        <div className="monopoly-flip">
          {flip.debris.map((d, i) => (
            <span
              key={i}
              className="monopoly-debris"
              style={{
                left: `${d.left}%`,
                top: `${d.top}%`,
                animationDuration: `${d.dur}s`,
                animationDelay: `${d.delay}s`,
                '--dx': `${d.dx}vh`,
                '--peak': `${d.peak}vh`,
                '--fall': `${d.fall}vh`,
              } as CSSProperties}
            >
              <span
                className="monopoly-debris-spin"
                style={{
                  animationDuration: `${d.dur}s`,
                  animationDelay: `${d.delay}s`,
                  '--spin': `${d.spin}deg`,
                } as CSSProperties}
              >
                {d.kind === 'bill' ? (
                  <span className="monopoly-bill" style={{ height: `${d.size}vh`, background: d.color }} />
                ) : d.kind === 'house' || d.kind === 'hotel' ? (
                  <MonopolyBuilding hotel={d.kind === 'hotel'} />
                ) : (
                  <img src={d.src} alt="" className="monopoly-debris-img" style={{ height: `${d.size}vh` }} />
                )}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Décor `otherworld` (Pyramid Head — Silent Hill) : L'AUTRE MONDE. Un ciel gris SOMBRE et BRUMEUX
// (nappes de brume qui dérivent) d'où pendent des CHAÎNES et des CAGES suspendues qui se balancent
// très lentement, tandis que des BRAISES ROUGES montent du bas en scintillant.
// ---------------------------------------------------------------------------
// Les 3 cages, avec leur ratio natif (largeur/hauteur du PNG) → la hauteur se déduit de la largeur,
// sans déformer l'image. Chaque cage embarque déjà sa chaîne d'accrochage vers le haut.
const OW_CAGES = [
  { img: '/animations/cage-1.png', ratio: 123 / 485 },
  { img: '/animations/cage-2.png', ratio: 181 / 888 },
  { img: '/animations/cage-3.png', ratio: 251 / 1009 },
]
const OW_CHAIN_RATIO = 99 / 1025 // ratio natif de chaine.png
const OW_CHAINS = 7 // chaînes nues qui pendent du haut
const OW_FOG = 6 // nappes de brume qui dérivent
const OW_EMBERS = 40 // braises rouges qui montent
// SURPRISE « le Passage à l'Autre Monde » (Silent Hill) : la sirène monte, le monde BASCULE et tout
// L'ARRIÈRE-PLAN vire au rouge sang (ciel, brume, cages, chaînes), puis revient au gris. Les couches
// restent DANS le décor : l'UI (plateau, cartes, panneaux) n'est pas touchée. Phases : `siren` (le
// rouge s'installe) → `held` (basculé) → `back` (retour). Secousse coupée en `prefers-reduced-motion`.
const OW_SHIFT_TEST = false // true → cadence accélérée pour régler
const OW_SHIFT_SIREN_MS = 2200 // montée de la sirène (doit correspondre à `owShiftIn`)
const OW_SHIFT_HOLD_MS = 7000 // le monde reste basculé
const OW_SHIFT_BACK_MS = 2600 // retour au gris (doit correspondre à `owShiftOut`)
const OW_SHIFT_QUAKE_MS = 700 // secousse de la bascule (doit correspondre à `owShiftQuake`)
const OW_SHIFT_GAP_MIN_MS = OW_SHIFT_TEST ? 6000 : 100_000 // 1 min 40 (c'est une SURPRISE : c'est rare)
const OW_SHIFT_GAP_MAX_MS = OW_SHIFT_TEST ? 11_000 : 190_000 // 3 min 10
const OW_STORM_EMBERS = 70 // braises de la tempête (s'ajoutent au filet permanent)
const OW_BLOOD = 10 // coulures de sang qui suintent du haut
const OW_BLOOD_STAINS = 9 // taches de sang imbibées dans le grillage (elles ne coulent pas)

/** Les couches ROUGES de la bascule. Elles restent DANS le décor (z -1) : seul l'ARRIÈRE-PLAN vire au
 *  rouge, l'UI (plateau, cartes, panneaux) n'est pas touchée. `.ow-decor` porte `isolation: isolate`
 *  pour que les `mix-blend-mode` se mélangent au décor et à lui seul. Posées EN DERNIER dans le
 *  décor : le mélange s'applique à tout ce qui a été peint avant (ciel, brume, chaînes, cages…). */
function OtherworldShift({ phase }: { phase: 'siren' | 'held' | 'back' }) {
  // Tirés à CHAQUE bascule (le composant est monté/démonté avec elle) → deux passages ne se
  // ressemblent jamais. La tempête de braises : une nuée dense et rapide, bien plus vive que le
  // filet permanent. Les coulures de sang : elles descendent du haut puis sèchent en place.
  const [storm] = useState(() =>
    Array.from({ length: OW_STORM_EMBERS }, () => ({
      left: Math.random() * 100, // %
      size: 1.6 + Math.random() * 3.4, // px
      dur: 3 + Math.random() * 4, // s (montée bien plus rapide qu'au repos)
      delay: -(Math.random() * 6), // s
      drift: (Math.random() - 0.5) * 22, // vw (dérive large : ça tourbillonne)
      rise: 70 + Math.random() * 50, // vh
      op: 0.55 + Math.random() * 0.45,
    })),
  )
  const [blood] = useState(() =>
    Array.from({ length: OW_BLOOD }, () => {
      const w = 0.8 + Math.random() * 1.7 // vh (épaisseur : plus large qu'une chaîne, pour ne pas s'y confondre)
      const h = 16 + Math.random() * 42 // vh (jusqu'où elle descend)
      return {
        left: 2 + Math.random() * 96, // %
        w,
        h,
        dur: 2.5 + Math.random() * 3.5, // s (elle coule, elle ne tombe pas)
        delay: Math.random() * 2.4, // s (elles ne partent pas toutes ensemble)
        op: 0.75 + Math.random() * 0.25,
        // Renflements noyés dans la traînée (le « goo » les y fond) : l'épaisseur ondule.
        bulges: Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => ({
          top: 12 + Math.random() * 70, // % de la hauteur de la coulure
          d: w * (1.25 + Math.random() * 0.75), // vh (diamètre du renflement)
        })),
        tip: w * (0.55 + Math.random() * 0.25), // vh (pointe plus étroite → la coulure s'effile)
      }
    }),
  )
  // TACHES imbibées dans le grillage (les parois « blood stained » de l'Autre Monde) : contours
  // irréguliers, orientations variées, elles s'imprègnent sans couler.
  const [stains] = useState(() =>
    Array.from({ length: OW_BLOOD_STAINS }, () => ({
      left: -4 + Math.random() * 104, // %
      top: -4 + Math.random() * 96, // %
      w: 6 + Math.random() * 16, // vh
      ratio: 0.5 + Math.random() * 1.1, // hauteur = largeur × ratio
      rot: Math.random() * 360, // deg (casse la répétition du contour)
      delay: Math.random() * 1.8, // s
      op: 0.35 + Math.random() * 0.45,
    })),
  )
  return (
    <>
      {/* 1. Teinte : remplace la couleur en gardant la luminance → l'arrière-plan vire au rouge sans
             s'aplatir (cages et chaînes restent lisibles en silhouette). */}
      <div className={`ow-shift ow-shift--hue is-${phase}`} />
      {/* 2. Brûlure : assombrit et sature (la rouille), surtout vers le bas et les bords. */}
      <div className={`ow-shift ow-shift--burn is-${phase}`} />
      {/* 3. La TEMPÊTE de braises : elle se lève dès la sirène et s'éteint avec le retour au gris. */}
      <div className={`ow-shift is-${phase}`}>
        {storm.map((e, i) => (
          <span
            key={`ow-storm-${i}`}
            className="ow-ember ow-ember-storm"
            style={{
              left: `${e.left}%`,
              width: `${e.size}px`,
              height: `${e.size}px`,
              animationDuration: `${e.dur}s`,
              animationDelay: `${e.delay}s`,
              '--drift': `${e.drift}vw`,
              '--rise': `${e.rise}vh`,
              '--op': e.op,
            } as CSSProperties}
          />
        ))}
      </div>
      {/* 4. Effets de surface, montés SEULEMENT une fois le monde basculé : le GRILLAGE rouillé se
             pose (le décor pèle), le SANG suinte PAR-DESSUS (il coule sur le treillis), puis grain
             et vignette. */}
      <div className={`ow-shift is-${phase}`}>
        {phase !== 'siren' && (
          <>
            <div className="ow-shift-mesh" />
            <div className="ow-shift-rust" />
            {/* Le SANG, en un seul calque passé au filtre « goo » : sans lui, coulures et renflements
                resteraient des formes géométriques nettes au lieu de fusionner. */}
            <div className="ow-blood-layer">
              <svg className="ow-goo-def" aria-hidden focusable="false">
                <filter id="ow-goo">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                  <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
                  />
                </filter>
              </svg>
              {stains.map((s, i) => (
                <span
                  key={`ow-stain-${i}`}
                  className="ow-blood-stain"
                  style={{
                    left: `${s.left}%`,
                    top: `${s.top}%`,
                    width: `${s.w}vh`,
                    height: `${s.w * s.ratio}vh`,
                    opacity: s.op,
                    rotate: `${s.rot}deg`,
                    animationDelay: `${s.delay}s`,
                  }}
                />
              ))}
              {blood.map((b, i) => (
                <span
                  key={`ow-blood-${i}`}
                  className="ow-blood"
                  style={{
                    left: `${b.left}%`,
                    width: `${b.w}vh`,
                    opacity: b.op,
                    animationDelay: `${b.delay}s`,
                    '--h': `${b.h}vh`,
                    '--dur': `${b.dur}s`,
                  } as CSSProperties}
                >
                  <span className="ow-blood-run" style={{ '--h': `${b.h}vh` } as CSSProperties} />
                  {b.bulges.map((g, j) => (
                    <span
                      key={`g-${j}`}
                      className="ow-blood-bulge"
                      style={{ top: `${g.top}%`, width: `${g.d}vh`, height: `${g.d}vh` }}
                    />
                  ))}
                  {/* Pointe effilée, calée sur la fin de la traînée. */}
                  <span
                    className="ow-blood-tip"
                    style={{ top: `calc(${b.h}vh - ${b.tip}vh)`, width: `${b.tip}vh`, height: `${b.tip}vh` }}
                  />
                </span>
              ))}
            </div>
          </>
        )}
        <div className="ow-shift-grain" />
        <div className="ow-shift-vignette" />
      </div>
    </>
  )
}

function OtherworldDecor() {
  const fireRef = useRef<() => void>(() => {}) // surprise : le Passage à l'Autre Monde
  useSurpriseSub(fireRef)
  // Chaînes nues suspendues au plafond. La chaîne garde son RATIO natif (sinon les maillons s'étirent
  // en une corde lisse) : c'est donc la LARGEUR qui règle la longueur de la retombée — les chaînes
  // proches sont larges et descendent bas, les lointaines fines et courtes (profondeur). Tirées une
  // fois au montage, réparties en bandes pour ne pas se tasser au même endroit.
  const [chains] = useState(() =>
    Array.from({ length: OW_CHAINS }, (_, i) => {
      const far = Math.random() < 0.45 // chaîne d'arrière-plan (plus pâle, plus fine, plus courte)
      return {
        left: (i * 100) / OW_CHAINS + Math.random() * (100 / OW_CHAINS), // % (une par bande)
        w: (far ? 1.6 : 2.8) + Math.random() * (far ? 1.4 : 1.8), // vh → hauteur ≈ ×10.4 (16 à 48 vh)
        swing: 0.6 + Math.random() * 1.6, // deg (balancement très léger)
        dur: 9 + Math.random() * 7, // s
        delay: -(Math.random() * 15), // s
        flip: Math.random() < 0.5,
        op: far ? 0.42 + Math.random() * 0.2 : 0.75 + Math.random() * 0.22,
      }
    }),
  )
  // Cages suspendues : une par image (+ une 4ᵉ reprise au hasard). On tire la HAUTEUR totale et le BAS
  // de la retombée (la largeur s'en déduit par le ratio natif de l'image) : ainsi les cages descendent
  // toutes aussi bas quelle que soit l'image, et leur chaîne d'accrochage sort du cadre par le haut.
  const [cages] = useState(() =>
    [...OW_CAGES, OW_CAGES[Math.floor(Math.random() * OW_CAGES.length)]].map((c, i) => {
      const h = 34 + Math.random() * 12 // vh (hauteur totale image = chaîne + cage)
      const bottom = 23 + Math.random() * 8 // vh (où s'arrête la cage, sous le haut de l'écran)
      return {
        ...c,
        left: 12 + i * 24 + Math.random() * 10, // % (réparties sur la largeur, sans se superposer)
        top: bottom - h, // vh (négatif : le haut de la chaîne sort du cadre)
        w: h * c.ratio, // vh (largeur déduite → aucune déformation)
        swing: 0.8 + Math.random() * 1.8, // deg
        dur: 8 + Math.random() * 6, // s (balancement lourd, lent)
        delay: -(Math.random() * 13), // s
        flip: Math.random() < 0.5,
        op: 0.65 + Math.random() * 0.3,
      }
    }),
  )
  // Nappes de brume grise : de larges taches douces qui dérivent latéralement en respirant.
  const [fog] = useState(() =>
    Array.from({ length: OW_FOG }, () => ({
      left: -20 + Math.random() * 120, // %
      top: Math.random() * 92, // %
      w: 45 + Math.random() * 60, // vh
      h: 16 + Math.random() * 22, // vh
      drift: 3 + Math.random() * 7, // vw (amplitude de dérive)
      dur: 22 + Math.random() * 20, // s (très lente)
      delay: -(Math.random() * 30), // s
      op: 0.1 + Math.random() * 0.14,
    })),
  )
  // Braises rouges : montent du bas en dérivant et en s'éteignant (réutilise le principe des braises
  // de la Fleur Rouge, en rouge sang).
  const [embers] = useState(() =>
    Array.from({ length: OW_EMBERS }, () => ({
      left: Math.random() * 100, // %
      size: 1.4 + Math.random() * 2.8, // px
      dur: 7 + Math.random() * 8, // s (montée lente)
      delay: -(Math.random() * 15), // s
      drift: (Math.random() - 0.5) * 14, // vw (dérive latérale)
      rise: 55 + Math.random() * 45, // vh (hauteur atteinte avant extinction)
      op: 0.45 + Math.random() * 0.45,
    })),
  )
  // SURPRISE « le Passage à l'Autre Monde », en PHASES (chaîne de timers, comme la Fleur Rouge de la
  // jungle) : `siren` → `held` (la bascule, avec sa secousse) → `back` → rien.
  const [shift, setShift] = useState<'siren' | 'held' | 'back' | null>(null)
  const [quake, setQuake] = useState(false)
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms))
    const run = () => {
      setShift('siren')
      at(OW_SHIFT_SIREN_MS, () => {
        setShift('held')
        // La bascule : le décor tremble le temps de la secousse.
        if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
          setQuake(true)
          at(OW_SHIFT_QUAKE_MS, () => setQuake(false))
        }
      })
      at(OW_SHIFT_SIREN_MS + OW_SHIFT_HOLD_MS, () => setShift('back'))
      at(OW_SHIFT_SIREN_MS + OW_SHIFT_HOLD_MS + OW_SHIFT_BACK_MS, () => {
        setShift(null)
        at(OW_SHIFT_GAP_MIN_MS + Math.random() * (OW_SHIFT_GAP_MAX_MS - OW_SHIFT_GAP_MIN_MS), run)
      })
    }
    at(OW_SHIFT_TEST ? 3000 : 45_000 + Math.random() * 35_000, run) // 1ʳᵉ bascule après ~45–80 s
    fireRef.current = run // MODE TEST : déclenche la bascule à la demande.
    return () => timers.forEach(clearTimeout)
  }, [])
  return (
    <div className={`ow-decor${shift ? ' is-shifted' : ''}${quake ? ' is-shaking' : ''}`} aria-hidden>
      {/* Nappes de brume grise qui dérivent (posées avant les suspensions : elles restent en fond). */}
      {fog.map((f, i) => (
        <span
          key={`ow-fog-${i}`}
          className="ow-fog"
          style={{
            left: `${f.left}%`,
            top: `${f.top}%`,
            width: `${f.w}vh`,
            height: `${f.h}vh`,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
            '--drift': `${f.drift}vw`,
            '--fog-op': f.op,
          } as CSSProperties}
        />
      ))}
      {/* Chaînes nues qui pendent du plafond. L'image est RETOURNÉE (`scaleY(-1)`) : sa pointe effilée
          se perd dans le plafond et ce sont les gros maillons qui pendent. L'enveloppe pose la
          position + les miroirs ; l'enfant porte la silhouette et le balancement — son pivot passe
          donc en `bottom center` (`is-flipped`), qui est le HAUT à l'écran une fois retourné. */}
      {chains.map((c, i) => (
        <span
          key={`ow-chain-${i}`}
          className="ow-chain"
          style={{
            left: `${c.left}%`,
            width: `${c.w}vh`,
            height: `${c.w / OW_CHAIN_RATIO}vh`,
            transform: `translateX(-50%) scaleX(${c.flip ? -1 : 1}) scaleY(-1)`,
          }}
        >
          <span
            className="ow-hang is-flipped"
            style={{
              opacity: c.op,
              backgroundImage: 'url(/animations/chaine.png)',
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              '--swing': `${c.swing}deg`,
            } as CSSProperties}
          />
        </span>
      ))}
      {/* Cages suspendues qui se balancent lourdement (même mécanique que les chaînes). */}
      {cages.map((c, i) => (
        <span
          key={`ow-cage-${i}`}
          className="ow-cage"
          style={{
            left: `${c.left}%`,
            top: `${c.top}vh`,
            width: `${c.w}vh`,
            height: `${c.w / c.ratio}vh`,
            transform: `translateX(-50%) scaleX(${c.flip ? -1 : 1})`,
          }}
        >
          <span
            className="ow-hang"
            style={{
              opacity: c.op,
              backgroundImage: `url(${c.img})`,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
              '--swing': `${c.swing}deg`,
            } as CSSProperties}
          />
        </span>
      ))}
      {/* Lueur rouge sourde qui bat en bas (la rouille incandescente), sous les braises. */}
      <div className="ow-glow" />
      {/* Braises rouges qui montent en scintillant. */}
      {embers.map((e, i) => (
        <span
          key={`ow-ember-${i}`}
          className="ow-ember"
          style={{
            left: `${e.left}%`,
            width: `${e.size}px`,
            height: `${e.size}px`,
            animationDuration: `${e.dur}s`,
            animationDelay: `${e.delay}s`,
            '--drift': `${e.drift}vw`,
            '--rise': `${e.rise}vh`,
            '--op': e.op,
          } as CSSProperties}
        />
      ))}
      {/* SURPRISE : la bascule rouge, posée EN DERNIER pour teinter tout l'arrière-plan (et lui seul). */}
      {shift && <OtherworldShift phase={shift} />}
    </div>
  )
}

// Décor permanent : GRAND COUNCILWOMAN (Lilo & Stitch), kind `federation`.
// LA PASSERELLE DU CROISEUR FÉDÉRAL, vue de l'orbite. Fond bleu profond + vignette, la TRAME
// HEXAGONALE de son plateau (alvéoles sourdes, dont quelques-unes RESPIRENT), l'ARC DE LA PLANÈTE en
// bas nimbé de son liseré d'ATMOSPHÈRE, des PANNEAUX HOLOGRAPHIQUES cyan dont les lignes clignotent,
// et un BALAYAGE de scan qui descend périodiquement. 100 % CSS (aucun asset).
// La trame est un vrai pavage : alvéoles POINTE EN HAUT, pas horizontal = largeur, pas vertical = 3/4
// de la hauteur, rangées impaires décalées d'une demi-largeur. Tout est en `vh` (donc régulier quelle
// que soit la largeur de colonne) et la grille est générée assez large pour déborder — le
// `overflow: hidden` de la colonne la recadre.
// ---------------------------------------------------------------------------
const FED_HEX_W = 16 // vh (largeur d'une alvéole)
const FED_HEX_H = FED_HEX_W * 1.1547 // vh (hauteur d'un hexagone pointe en haut : w × 2/√3)
const FED_HEX_COLS = 9 // couvre ~144 vh de large (toute la colonne, même sur écran très large)
const FED_HEX_ROWS = 10 // couvre ~125 vh de haut
const FED_HEX_BREATHING = 16 // alvéoles qui respirent en permanence (console qui travaille)
const FED_PANELS = 4 // panneaux holographiques
// SURPRISE « LE RAYON DE CAPTURE » : l'écran TREMBLE, un CÔNE de lumière bleue descend du haut, et la
// trame hexagonale S'ALLUME en une VAGUE QUI DESCEND (le champ de confinement se referme sur la scène),
// avant un FLASH et la dissipation. Le calque du rayon est (dé)monté le temps de la séquence (sa clé
// React rejoue les animations) ; la vague de la trame, elle, est pilotée par la classe `is-capturing`
// sur la racine (retard par alvéole porté par `--fed-cage`). Durées : keyframes `fed*` (index.css).
const FED_BEAM_TEST = false
const FED_BEAM_MS = 6000 // durée totale de la séquence
const FED_BEAM_GAP_MIN_MS = FED_BEAM_TEST ? 7000 : 80_000 // 1 min 20 (c'est une SURPRISE : c'est rare)
const FED_BEAM_GAP_MAX_MS = FED_BEAM_TEST ? 12_000 : 160_000 // 2 min 40

function FederationDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // La trame : positions du pavage + le sous-ensemble qui respire + le retard de la vague du champ de
  // confinement (par RANGÉE → la vague descend en même temps que le rayon). Figée au montage.
  const [hexes] = useState(() => {
    const breathing = new Set<number>()
    const total = FED_HEX_COLS * FED_HEX_ROWS
    while (breathing.size < FED_HEX_BREATHING) breathing.add(Math.floor(Math.random() * total))
    return Array.from({ length: total }, (_, i) => {
      const r = Math.floor(i / FED_HEX_COLS)
      const c = i % FED_HEX_COLS
      return {
        x: c * FED_HEX_W + (r % 2 ? FED_HEX_W / 2 : 0) - FED_HEX_W / 2, // vh (débord d'une demi-alvéole à gauche)
        y: r * FED_HEX_H * 0.75 - FED_HEX_H / 2, // vh
        // Retard de l'allumage : la rangée dicte la vague, un peu de hasard casse l'effet de ligne.
        // Le pas entre rangées doit rester GRAND devant la durée d'une alvéole (`fedCage`, 1,5 s),
        // sinon toutes s'allument ensemble et la vague ne se lit plus comme une bande qui descend.
        cage: r * 0.22 + Math.random() * 0.13, // s
        // Alvéoles qui respirent : cycle et déphasage propres.
        breath: breathing.has(i)
          ? { dur: 5 + Math.random() * 5, delay: -(Math.random() * 10), op: 0.5 + Math.random() * 0.5 }
          : null,
      }
    })
  })
  // Panneaux holographiques : posés sur les MARGES (gauche/droite) pour laisser le centre — où
  // s'affiche le plateau — dégagé. Chacun porte 3 à 6 lignes de données qui clignotent. Figés.
  const [panels] = useState(() =>
    Array.from({ length: FED_PANELS }, (_, i) => ({
      left: i % 2 ? 62 + Math.random() * 22 : 3 + Math.random() * 14, // % (alterne les deux marges)
      top: 8 + Math.random() * 62, // %
      w: 9 + Math.random() * 6, // vh
      dur: 6 + Math.random() * 5, // s (respiration du panneau)
      delay: -(Math.random() * 8), // s
      bars: Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () => ({
        w: 30 + Math.random() * 65, // % de la largeur du panneau
        dur: 1.4 + Math.random() * 3.4, // s (clignotement de la ligne)
        delay: -(Math.random() * 4), // s
      })),
    })),
  )
  // SURPRISE : le rayon de capture. `beam` = n° de passage (clé React) ; la classe `is-capturing`
  // déclenche en parallèle le tremblement et la vague de la trame.
  const [beam, setBeam] = useState<number | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setBeam(++run)
      clear = setTimeout(() => setBeam(null), FED_BEAM_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(FED_BEAM_GAP_MIN_MS + Math.random() * (FED_BEAM_GAP_MAX_MS - FED_BEAM_GAP_MIN_MS))
      }, delay)
    }
    schedule(FED_BEAM_TEST ? 3000 : 50_000 + Math.random() * 35_000) // 1re capture : 50 s à 1 min 25
    // MODE TEST : déclenche la capture à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className={`fed-decor${beam !== null ? ' is-capturing' : ''}`} aria-hidden>
      {/* La trame hexagonale de la Fédération (le motif du plateau de la Conseillère). Chaque alvéole
          porte son calque d'ALLUMAGE (champ de confinement, opacité seule → composité) ; celles qui
          respirent portent en plus un calque de lueur douce. */}
      <div className="fed-grid">
        {hexes.map((h, i) => (
          <span
            key={`fed-hex-${i}`}
            className="fed-hex"
            style={
              {
                left: `${h.x}vh`,
                top: `${h.y}vh`,
                width: `${FED_HEX_W}vh`,
                height: `${FED_HEX_H}vh`,
                '--fed-cage': `${h.cage}s`,
              } as CSSProperties
            }
          >
            {h.breath && (
              <span
                className="fed-hex-breath"
                style={{
                  animationDuration: `${h.breath.dur}s`,
                  animationDelay: `${h.breath.delay}s`,
                  '--op': h.breath.op,
                } as CSSProperties}
              />
            )}
            <span className="fed-hex-cage" />
          </span>
        ))}
      </div>
      {/* L'ARC DE LA PLANÈTE en bas de l'écran : un très grand disque dont on ne voit que la calotte,
          surmonté de son liseré d'ATMOSPHÈRE lumineux. */}
      <div className="fed-planet">
        <div className="fed-planet-limb" />
      </div>
      {/* Panneaux holographiques cyan : cadre translucide + lignes de données qui clignotent. */}
      {panels.map((p, i) => (
        <div
          key={`fed-panel-${i}`}
          className="fed-panel"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.w}vh`,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
          }}
        >
          {p.bars.map((b, j) => (
            <span
              key={j}
              className="fed-panel-bar"
              style={{ width: `${b.w}%`, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
            />
          ))}
        </div>
      ))}
      {/* Balayage de scan : nappe cyan qui descend périodiquement (la passerelle scrute la planète). */}
      <div className="fed-scan" />
      {/* SURPRISE : le rayon de capture (cône + cœur du faisceau + la CIBLE + flash final). */}
      {beam !== null && (
        <div key={beam} className="fed-beam">
          <div className="fed-beam-cone" />
          <div className="fed-beam-core" />
          {/* STITCH, pris dans le faisceau au bas du cône : silhouette noire à contre-jour, happée
              vers le haut à mesure que le champ se referme, puis emportée par le flash. */}
          <img className="fed-beam-stitch" src="/animations/stitch.png" alt="" />
          <div className="fed-beam-flash" />
        </div>
      )}
    </div>
  )
}

// Décor permanent : MICHAEL MYERS (Halloween), kind `haddonfield`.
// LA NUIT DU 31 OCTOBRE À HADDONFIELD. Nuit de banlieue FROIDE et déserte : les pavillons en
// silhouette noire au fond (dont quelques fenêtres allumées, l'une s'éteignant de temps en temps),
// un LAMPADAIRE blafard qui grésille, une BRUME basse qui dérive dans la rue, des FEUILLES MORTES
// qui tombent en voletant puis roulent au sol, et la CITROUILLE du générique qui luit en haut de la
// colonne, sa flamme vacillant à l'intérieur.
// Répartition volontaire : la citrouille occupe la BANDE HAUTE et tout le reste la BANDE BASSE — le
// plateau, opaque, masque le centre de la colonne (même contrainte que les masques de Facilier).
// ---------------------------------------------------------------------------
const HD_LEAVES = 30 // feuilles mortes qui tombent
const HD_GROUND_LEAVES = 8 // feuilles qui roulent au ras du sol
// Teintes d'automne (feuilles sèches) : brun, rouille, ocre — jamais de vert.
const HD_LEAF_COLORS = ['#8a4b22', '#a35d24', '#6b3a17', '#c07a2c', '#7a5320', '#9c3f1f', '#b8843a']
// Les pavillons de Haddonfield : profils FIGÉS (silhouettes noires découpées sur le ciel). `left`/`w`
// en % de la colonne, `h` en vh ; `lit` = fenêtre allumée (chaude), `dies` = elle s'éteint en cours de
// partie (quelqu'un vient de se coucher… ou pas).
// La ligne de toits reste BASSE (≈ 11-16 vh) : au-delà, elle mangeait toute la bande visible et une
// silhouette debout dans la rue se retrouvait entièrement sur du noir, donc invisible.
const HD_HOUSES = [
  { left: -5, w: 20, h: 13, lit: true, dies: false },
  { left: 13, w: 16, h: 16, lit: false, dies: false },
  { left: 30, w: 18, h: 11, lit: true, dies: true },
  { left: 47, w: 21, h: 15, lit: false, dies: false },
  { left: 67, w: 17, h: 12, lit: true, dies: false },
  { left: 83, w: 22, h: 14, lit: false, dies: false },
]
// SURPRISE « THE SHAPE » : le trope signature du film. Le lampadaire GRÉSILLE et, quand la lumière
// revient, Michael est là — planté dans la rue, parfaitement IMMOBILE. Il ne fait rien, ne s'approche
// pas : il regarde. Puis il se fond de nouveau dans la nuit. Tout l'effet tient dans l'absence de
// mouvement, donc la silhouette n'a AUCUNE animation propre hors le fondu d'entrée/sortie.
const HD_SHAPE_TEST = false
const HD_SHAPE_MS = 14_000 // fondu d'apparition (4 s) + immobilité (5 s) + effacement en fondu (5 s)
const HD_SHAPE_GAP_MIN_MS = HD_SHAPE_TEST ? 8000 : 120_000 // 2 min
const HD_SHAPE_GAP_MAX_MS = HD_SHAPE_TEST ? 13_000 : 240_000 // 4 min
// Emplacements CURÉS où il peut se tenir (bande basse uniquement — ailleurs le plateau le masque).
// `left` en %, `bottom` en vh, `h` = sa taille en vh (plus petit = plus loin dans la rue).
// Ils restent dans la MOITIÉ GAUCHE de la colonne : à droite, il se retrouvait à cheval sur les
// piles de cartes et le pion, où on ne le voyait plus.
const HD_SHAPE_SPOTS = [
  { left: 6, bottom: 0, h: 17 },
  { left: 16, bottom: 1.5, h: 15 },
  { left: 27, bottom: -0.5, h: 19 },
  { left: 38, bottom: 1, h: 16 },
  { left: 50, bottom: 0, h: 18 },
]

function HaddonfieldDecor() {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Feuilles mortes : schéma nesté chute > voltige > rotation (comme les pétales de la Reine de
  // Cœur), avec de la PROFONDEUR — les feuilles lointaines sont petites, lentes et sombres.
  const [leaves] = useState(() =>
    Array.from({ length: HD_LEAVES }, () => {
      const depth = Math.random() // 0 = loin, 1 = tout près
      return {
        left: -6 + Math.random() * 112, // % (déborde : elles entrent/sortent par les côtés)
        size: 0.7 + depth * 1.5, // vh
        fallDur: 11 - depth * 4.5, // s (les proches tombent plus vite)
        fallDelay: -(Math.random() * 14), // s
        swayDur: 1.9 + Math.random() * 2.2, // s (voltige latérale)
        sway: (Math.random() < 0.5 ? -1 : 1) * (1.4 + Math.random() * 3.4), // vh
        spinDur: 1.3 + Math.random() * 2.6, // s (elle tourne sur elle-même en tombant)
        op: 0.3 + depth * 0.45,
        color: HD_LEAF_COLORS[Math.floor(Math.random() * HD_LEAF_COLORS.length)],
      }
    }),
  )
  // Feuilles au SOL : elles ne tombent pas, elles sont poussées par le vent et raclent le bitume
  // d'un bout à l'autre de la rue (elles ne partent pas toutes dans le même sens).
  const [groundLeaves] = useState(() =>
    Array.from({ length: HD_GROUND_LEAVES }, () => ({
      bottom: 1 + Math.random() * 7, // vh
      size: 0.9 + Math.random() * 1.3, // vh
      dur: 7 + Math.random() * 7, // s (traversée)
      delay: -(Math.random() * 16), // s
      rtl: Math.random() < 0.35, // quelques-unes remontent la rue
      op: 0.3 + Math.random() * 0.35,
      color: HD_LEAF_COLORS[Math.floor(Math.random() * HD_LEAF_COLORS.length)],
    })),
  )
  // Nappes de brume basse : elles traversent la rue en s'effaçant aux deux bords.
  const [mist] = useState(() =>
    Array.from({ length: 5 }, (_, i) => ({
      bottom: 1 + i * 3.5 + Math.random() * 2, // vh
      w: 40 + Math.random() * 45, // vh
      h: 7 + Math.random() * 7, // vh
      dur: 34 + Math.random() * 28, // s
      delay: -(Math.random() * 50), // s
      op: 0.1 + Math.random() * 0.14,
    })),
  )
  // SURPRISE : `shape` = l'emplacement tiré pour ce passage (+ un compteur qui sert de clé React
  // pour rejouer les animations). `null` = il n'est pas là.
  const [shape, setShape] = useState<{ spot: (typeof HD_SHAPE_SPOTS)[number]; run: number; flip: boolean } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      const spot = HD_SHAPE_SPOTS[Math.floor(Math.random() * HD_SHAPE_SPOTS.length)]
      setShape({ spot, run: ++run, flip: Math.random() < 0.5 })
      clear = setTimeout(() => setShape(null), HD_SHAPE_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(HD_SHAPE_GAP_MIN_MS + Math.random() * (HD_SHAPE_GAP_MAX_MS - HD_SHAPE_GAP_MIN_MS))
      }, delay)
    }
    schedule(HD_SHAPE_TEST ? 3000 : 60_000 + Math.random() * 40_000) // 1re apparition : 1 min à 1 min 40
    // MODE TEST : le fait apparaître à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div className={`hd-decor${shape ? ' is-stalking' : ''}`} aria-hidden>
      {/* LA CITROUILLE du générique, en haut de la colonne : sa flamme vacille à l'intérieur (halo
          orange qui bat) — le seul point CHAUD d'un décor entièrement froid. */}
      <div className="hd-pumpkin">
        <div className="hd-pumpkin-glow" />
        <img className="hd-pumpkin-img" src="/animations/citrouille_meyers.png" alt="" />
      </div>
      {/* LA RUE. Tout ce qui est « au sol » vit dans ce calque, dont le bas est remonté au-dessus du
          panneau du joueur (`bottom: HD_GROUND`) : posé à 0, le trottoir passait derrière le panneau
          et on ne voyait plus ni les pavillons ni le pied du lampadaire. */}
      <div className="hd-ground">
        {/* LA CHAUSSÉE : bande d'asphalte au ras du sol, un peu plus claire que les pavillons — c'est
            elle qui donne un FOND sur lequel se détacher ; sans elle, tout le bas de la colonne était
            un aplat noir et une silhouette posée là devenait invisible. */}
        <div className="hd-road" />
        {/* Les PAVILLONS au fond : découpes noires (corps + toit à deux pentes) sur le ciel. */}
        <div className="hd-street">
          {HD_HOUSES.map((h, i) => (
            <div key={`hd-house-${i}`} className="hd-house" style={{ left: `${h.left}%`, width: `${h.w}%`, height: `${h.h}vh` }}>
              <span className="hd-house-roof" />
              <span className="hd-house-body" />
              {h.lit && <span className={`hd-window${h.dies ? ' hd-window--dies' : ''}`} />}
            </div>
          ))}
        </div>
        {/* BRUME basse qui dérive dans la rue. */}
        {mist.map((m, i) => (
          <span
            key={`hd-mist-${i}`}
            className="hd-mist"
            style={
              {
                bottom: `${m.bottom}vh`,
                width: `${m.w}vh`,
                height: `${m.h}vh`,
                animationDuration: `${m.dur}s`,
                animationDelay: `${m.delay}s`,
                '--op': m.op,
              } as CSSProperties
            }
          />
        ))}
        {/* LES DEUX LAMPADAIRES (un de chaque côté de la rue, celui de gauche plus loin donc plus
            court) : mât, tête, cône de lumière blafarde et flaque au sol. Ce sont eux qui GRÉSILLENT
            au moment où Michael apparaît. */}
        <div className="hd-lamp hd-lamp--left">
          <span className="hd-lamp-pole" />
          <span className="hd-lamp-head" />
          <span className="hd-lamp-cone" />
          <span className="hd-lamp-pool" />
        </div>
        <div className="hd-lamp">
          <span className="hd-lamp-pole" />
          <span className="hd-lamp-head" />
          <span className="hd-lamp-cone" />
          <span className="hd-lamp-pool" />
        </div>
        {/* FEUILLES AU SOL raclées par le vent d'un bout à l'autre de la rue. */}
        {groundLeaves.map((g, i) => (
          <span
            key={`hd-ground-leaf-${i}`}
            className={`hd-ground-leaf${g.rtl ? ' hd-ground-leaf--rtl' : ''}`}
            style={{
              bottom: `${g.bottom}vh`,
              width: `${g.size}vh`,
              height: `${g.size * 1.35}vh`,
              background: g.color,
              opacity: g.op,
              animationDuration: `${g.dur}s`,
              animationDelay: `${g.delay}s`,
            }}
          />
        ))}
        {/* SURPRISE « THE SHAPE » : il est là. Il ne bouge pas. */}
        {shape && (
          <img
            key={shape.run}
            className="hd-shape"
            src="/animations/silhouette_meyers.png"
            alt=""
            style={{
              left: `${shape.spot.left}%`,
              bottom: `${shape.spot.bottom}vh`,
              height: `${shape.spot.h}vh`,
              '--flip': shape.flip ? -1 : 1,
            } as CSSProperties}
          />
        )}
      </div>
      {/* FEUILLES MORTES qui tombent (chute > voltige > rotation). */}
      {leaves.map((l, i) => (
        <span
          key={`hd-leaf-${i}`}
          className="hd-leaf-fall"
          style={{ left: `${l.left}%`, animationDuration: `${l.fallDur}s`, animationDelay: `${l.fallDelay}s` }}
        >
          <span
            className="hd-leaf-sway"
            style={
              { animationDuration: `${l.swayDur}s`, '--sway': `${l.sway}vh` } as CSSProperties
            }
          >
            <span
              className="hd-leaf"
              style={{
                width: `${l.size}vh`,
                height: `${l.size * 1.35}vh`,
                background: l.color,
                opacity: l.op,
                animationDuration: `${l.spinDur}s`,
              }}
            />
          </span>
        </span>
      ))}
      <div className="hd-vignette" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Décor permanent : ISABELLA (The Promised Neverland), kind `graceField`.
// LE JARDIN D'ENFANCE — ET SON MENSONGE. La MAISON de Grace Field posée dans sa prairie, la lisière
// de FORÊT derrière elle et, tout au fond, LE MUR infranchissable percé de sa PORTE. Par-dessus,
// une JOURNÉE défile en boucle (plein jour → crépuscule doré → nuit → aube) : c'est l'objectif
// d'Isabella, ses « activités quotidiennes ». La nuit, les étoiles sortent, les fenêtres de la maison
// s'allument et les LUCIOLES gagnent la prairie ; le jour, elles s'effacent. Des MATRICULES à 5
// chiffres s'inscrivent en fondu dans le ciel, comme tamponnés sur la nuque des enfants.
// Répartition volontaire : le ciel (étoiles, matricules) occupe la BANDE HAUTE, la maison et la
// prairie la BANDE BASSE — le plateau, opaque, masque le centre de la colonne.
// ---------------------------------------------------------------------------
// Durée d'une JOURNÉE complète (s). Toutes les couches du cycle (crépuscule, nuit, étoiles, fenêtres,
// lucioles) partagent cette durée : elles doivent rester rigoureusement en phase.
const GF_DAY_S = 300
const GF_FIREFLIES = 26
const GF_STARS = 46
// Matricules tatoués sur la nuque : ceux d'Emma, Norman et Ray (canoniques), complétés de numéros
// de la même famille — c'est le motif qui compte, pas l'exactitude de chaque enfant.
const GF_TAGS = ['63194', '22194', '81194', '16194', '24194', '98718', '35204', '71592']
// La lisière de FORÊT derrière le mur : Grace Field est cachée au cœur d'une forêt de FEUILLUS (pas
// de conifères). Chaque arbre = un tronc + une couronne bosselée (empilement de dégradés radiaux dans
// un seul élément). Profils FIGÉS : `left`/`w` en % de la colonne, `h` en vh, `c` la teinte de la
// couronne (les plus CLAIRES sont les plus lointaines) et `sway` la période de balancement (s).
const GF_TREES = [
  { left: -4, w: 13, h: 8.5, c: '#16240e', sway: 7.5 },
  { left: 4, w: 10, h: 6.5, c: '#22351a', sway: 6.2 },
  { left: 11, w: 15, h: 9.5, c: '#101c0a', sway: 8.4 },
  { left: 21, w: 11, h: 7, c: '#1c2d14', sway: 6.8 },
  { left: 29, w: 14, h: 8, c: '#152210', sway: 7.9 },
  { left: 39, w: 10, h: 6, c: '#25391c', sway: 5.8 },
  { left: 46, w: 15, h: 9, c: '#111e0b', sway: 8.1 },
  { left: 57, w: 11, h: 7, c: '#1e3016', sway: 6.5 },
  { left: 64, w: 14, h: 8.5, c: '#14210f', sway: 7.7 },
  { left: 75, w: 10, h: 6.5, c: '#243818', sway: 6 },
  { left: 82, w: 15, h: 9, c: '#0e1a09', sway: 8.6 },
  { left: 93, w: 12, h: 7.5, c: '#1a2b12', sway: 7 },
]
// LE GRAND ARBRE de la pelouse — celui sous lequel les enfants jouent, planté à droite de la maison.
// Plus grand, plus proche, plus sombre que la lisière : c'est lui qui donne la profondeur au pré.
const GF_BIG_TREE = { left: 80, bottom: 19.5, w: 30, h: 20, c: '#0d1808', sway: 9.5 }
// HERBES du premier plan : des brins qui se dressent au bord du pré et ondulent au vent. Ils sont
// enracinés dans la bande RÉELLEMENT visible (~17→20 vh) et montent devant les fleurs Vida.
const GF_BLADES = 170
// SURPRISE « LA MOISSON ». La cloche sonne — celle qui annonce l'expédition d'un enfant. Deux ondes
// partent du clocheton, le monde se FIGE et se DÉSATURE, une lueur rouge monte du sol, les FLEURS
// VIDA (celles qu'on pose sur les corps expédiés) s'ouvrent dans la prairie et leurs pétales
// dérivent ; puis le rouge reflue et les lucioles se rallument. Aucun texte.
const GF_HARVEST_TEST = false
const GF_HARVEST_MS = 14_000 // cloche (1,5 s) + bascule (3 s) + rouge tenu (6 s) + retour (3,5 s)
const GF_HARVEST_GAP_MIN_MS = GF_HARVEST_TEST ? 9000 : 150_000 // 2 min 30
const GF_HARVEST_GAP_MAX_MS = GF_HARVEST_TEST ? 15_000 : 260_000 // 4 min 20
// Les fleurs Vida qui poussent dans la prairie : `left` en %, `bottom` en vh (le pied du massif),
// `h` la hauteur de la fleur en vh (tige comprise). Elles sont enracinées dans la BANDE VISIBLE
// (~17→20 vh) : plus bas, le panneau du joueur masquerait leur pied.
const GF_VIDA = [
  { left: 9, bottom: 18, h: 9, delay: 0.2, flip: false },
  { left: 25, bottom: 17, h: 11.5, delay: 0.9, flip: true },
  { left: 41, bottom: 19.5, h: 7, delay: 0.5, flip: false },
  { left: 61, bottom: 17.5, h: 10.5, delay: 1.2, flip: true },
  { left: 77, bottom: 19, h: 7.5, delay: 0.7, flip: false },
  { left: 87, bottom: 17.5, h: 10, delay: 1.5, flip: true },
]
const GF_PETALS = 22

function GraceFieldDecor({ decor }: { decor: Extract<VillainDecorData, { kind: 'graceField' }> }) {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Étoiles de la bande haute : elles ne sont visibles que la NUIT (le calque parent suit le cycle),
  // chacune scintillant sur son propre rythme.
  const [stars] = useState(() =>
    Array.from({ length: GF_STARS }, () => ({
      left: Math.random() * 100, // %
      top: Math.random() * 26, // vh
      size: 0.15 + Math.random() * 0.28, // vh
      dur: 2.4 + Math.random() * 4, // s
      delay: -(Math.random() * 6), // s
      op: 0.45 + Math.random() * 0.5,
    })),
  )
  // MATRICULES : ils s'inscrivent lentement dans le ciel puis s'effacent, jamais deux en même temps
  // au même endroit (cycle long, décalé par index).
  const [tags] = useState(() =>
    GF_TAGS.map((n, i) => ({
      n,
      left: 3 + (i % 4) * 23 + Math.random() * 7, // %
      top: (i < 4 ? 1.5 : 12) + Math.random() * 7, // vh
      size: 1.2 + Math.random() * 1, // vh
      dur: 22 + Math.random() * 14, // s
      delay: -(i * 5 + Math.random() * 4), // s
      tilt: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 7), // deg
    })),
  )
  // LUCIOLES au-dessus de la prairie : dérive lente (nestée : dérive > montée) + clignotement propre.
  const [fireflies] = useState(() =>
    Array.from({ length: GF_FIREFLIES }, () => ({
      left: -4 + Math.random() * 108, // %
      bottom: 20 + Math.random() * 16, // vh (au-dessus de l'herbe, autour de la maison)
      size: 0.3 + Math.random() * 0.4, // vh
      driftDur: 14 + Math.random() * 16, // s
      drift: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 8), // vh
      riseDur: 6 + Math.random() * 7, // s
      rise: 1.5 + Math.random() * 4, // vh
      blinkDur: 1.6 + Math.random() * 3, // s
      delay: -(Math.random() * 20), // s
    })),
  )
  // HERBES : des brins de hauteur, d'inclinaison et de teinte variées, plantés le long du bord du pré
  // (les plus hauts derrière, les plus sombres devant) et bercés chacun à son rythme.
  const [blades] = useState(() =>
    Array.from({ length: GF_BLADES }, () => {
      const depth = Math.random() // 0 = au fond du pré, 1 = au premier plan
      return {
        left: -2 + Math.random() * 104, // %
        bottom: 16 + (1 - depth) * 8.5, // vh (les lointains montent vers l'horizon)
        w: 0.16 + depth * 0.5, // vh
        h: (0.9 + Math.random() * 1.9) * (0.45 + depth * 1.35), // vh
        c: depth > 0.6 ? '#2c4a15' : '#4d7526', // les brins proches sont plus sombres
        tilt: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 9), // deg
        dur: 3.4 + Math.random() * 3.4, // s (le vent ne les prend pas tous ensemble)
        delay: Math.random() * 6, // s
      }
    }),
  )
  // Pétales de Vida emportés pendant la Moisson (chute > dérive latérale > rotation).
  const [petals] = useState(() =>
    Array.from({ length: GF_PETALS }, () => ({
      left: Math.random() * 100, // %
      size: 0.8 + Math.random() * 1.4, // vh
      fallDur: 6 + Math.random() * 5, // s
      delay: Math.random() * 6, // s (ils partent au fil de la séquence, pas tous ensemble)
      swayDur: 2 + Math.random() * 2.2, // s
      sway: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 3), // vh
      spinDur: 1.6 + Math.random() * 2.4, // s
      op: 0.45 + Math.random() * 0.45,
    })),
  )
  // SURPRISE : `harvest` porte un compteur qui sert de clé React (rejoue les animations). `null` =
  // journée ordinaire.
  const [harvest, setHarvest] = useState<{ run: number } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setHarvest({ run: ++run })
      clear = setTimeout(() => setHarvest(null), GF_HARVEST_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(GF_HARVEST_GAP_MIN_MS + Math.random() * (GF_HARVEST_GAP_MAX_MS - GF_HARVEST_GAP_MIN_MS))
      }, delay)
    }
    schedule(GF_HARVEST_TEST ? 3000 : 75_000 + Math.random() * 45_000) // 1re Moisson : 1 min 15 à 2 min
    // MODE TEST : sonne la cloche à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  return (
    <div
      className={`gf-decor${harvest ? ' is-harvest' : ''}`}
      style={{ '--day': `${GF_DAY_S}s` } as CSSProperties}
      aria-hidden
    >
      {/* LE MONDE : tout ce qui se DÉSATURE quand la cloche sonne. */}
      <div className="gf-world">
        {/* ÉTOILES (visibles la nuit seulement — le calque suit le cycle du jour). */}
        <div className="gf-stars">
          {stars.map((s, i) => (
            <span
              key={`gf-star-${i}`}
              className="gf-star"
              style={
                {
                  left: `${s.left}%`,
                  top: `${s.top}vh`,
                  width: `${s.size}vh`,
                  height: `${s.size}vh`,
                  animationDuration: `${s.dur}s`,
                  animationDelay: `${s.delay}s`,
                  '--op': s.op,
                } as CSSProperties
              }
            />
          ))}
        </div>
        {/* MATRICULES tamponnés dans le ciel. */}
        {tags.map((t, i) => (
          <span
            key={`gf-tag-${i}`}
            className="gf-tag"
            style={{
              left: `${t.left}%`,
              top: `${t.top}vh`,
              fontSize: `${t.size}vh`,
              animationDuration: `${t.dur}s`,
              animationDelay: `${t.delay}s`,
              transform: `rotate(${t.tilt}deg)`,
            }}
          >
            {t.n}
          </span>
        ))}
        {/* LE MUR, tout au fond : la bande de béton qui ferme l'horizon, et sa PORTE. */}
        <div className="gf-wall">
          <span className="gf-gate" />
        </div>
        {/* LA LISIÈRE DE FORÊT (feuillus), devant le mur. */}
        <div className="gf-treeline">
          {GF_TREES.map((t, i) => (
            <span
              key={`gf-tree-${i}`}
              className="gf-tree"
              style={
                {
                  left: `${t.left}%`,
                  width: `${t.w}%`,
                  height: `${t.h}vh`,
                  '--c': t.c,
                  animationDuration: `${t.sway}s`,
                  animationDelay: `-${i * 0.7}s`,
                } as CSSProperties
              }
            >
              <span className="gf-tree-trunk" />
              <span className="gf-tree-crown" />
            </span>
          ))}
        </div>
        {/* LE GRAND ARBRE de la pelouse, à droite de la maison. */}
        <span
          className="gf-tree gf-tree--big"
          style={
            {
              left: `${GF_BIG_TREE.left}%`,
              bottom: `${GF_BIG_TREE.bottom}vh`,
              width: `${GF_BIG_TREE.w}%`,
              height: `${GF_BIG_TREE.h}vh`,
              '--c': GF_BIG_TREE.c,
              animationDuration: `${GF_BIG_TREE.sway}s`,
            } as CSSProperties
          }
        >
          <span className="gf-tree-trunk" />
          <span className="gf-tree-crown" />
        </span>
        {/* LA MAISON de Grace Field, avec le halo chaud de ses fenêtres qui s'allument la nuit. */}
        <div className="gf-home">
          <span className="gf-home-glow" />
          <img className="gf-home-img" src={decor.home} alt="" />
        </div>
        {/* LA PRAIRIE : le pré qui descend jusqu'au bas de l'écran… */}
        <div className="gf-field" />
        {/* …et ses HERBES de premier plan, qui ondulent au vent. */}
        <div className="gf-grass">
          {blades.map((b, i) => (
            <span
              key={`gf-blade-${i}`}
              className="gf-blade"
              style={
                {
                  left: `${b.left}%`,
                  bottom: `${b.bottom}vh`,
                  width: `${b.w}vh`,
                  height: `${b.h}vh`,
                  background: `linear-gradient(to top, #1f3410, ${b.c})`,
                  animationDuration: `${b.dur}s`,
                  animationDelay: `-${b.delay}s`,
                  '--tilt': `${b.tilt}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        {/* LUCIOLES (dérive > montée > clignotement) — elles s'éteignent pendant la Moisson. */}
        <div className="gf-fireflies">
          {fireflies.map((f, i) => (
            <span
              key={`gf-fly-${i}`}
              className="gf-fly-drift"
              style={
                {
                  left: `${f.left}%`,
                  bottom: `${f.bottom}vh`,
                  animationDuration: `${f.driftDur}s`,
                  animationDelay: `${f.delay}s`,
                  '--drift': `${f.drift}vh`,
                } as CSSProperties
              }
            >
              <span
                className="gf-fly-rise"
                style={{ animationDuration: `${f.riseDur}s`, '--rise': `${f.rise}vh` } as CSSProperties}
              >
                <span
                  className="gf-fly"
                  style={{ width: `${f.size}vh`, height: `${f.size}vh`, animationDuration: `${f.blinkDur}s` }}
                />
              </span>
            </span>
          ))}
        </div>
        {/* LE CYCLE DU JOUR : le crépuscule doré puis la nuit se posent sur le paysage (mur, forêt,
            maison, prairie) ; étoiles, matricules et lucioles restent AU-DESSUS (z-index) — sans quoi
            la nuit éteindrait précisément ce qu'elle est censée révéler. */}
        <div className="gf-dusk" />
        <div className="gf-night" />
      </div>
      {/* SURPRISE « LA MOISSON » : la cloche, le rouge, les fleurs Vida. */}
      {harvest && (
        <div className="gf-harvest" key={harvest.run}>
          {/* Les deux ondes de la cloche, parties du clocheton. */}
          <span className="gf-bell-ring" />
          <span className="gf-bell-ring gf-bell-ring--2" />
          {/* Le rouge : voile général + lueur qui monte du sol. */}
          <span className="gf-blood-veil" />
          <span className="gf-blood-rise" />
          {/* Les fleurs Vida poussent dans la prairie (elles jaillissent du sol : `transform-origin`
              au pied). Une sur deux est miroitée pour qu'on ne lise pas six fois la même. */}
          {GF_VIDA.map((v, i) => (
            <img
              key={`gf-vida-${i}`}
              className={`gf-vida${v.flip ? ' gf-vida--flip' : ''}`}
              src={decor.vida}
              alt=""
              style={{
                left: `${v.left}%`,
                bottom: `${v.bottom}vh`,
                height: `${v.h}vh`,
                animationDelay: `${v.delay}s`,
              }}
            />
          ))}
          {/* …et leurs pétales dérivent. */}
          {petals.map((p, i) => (
            <span
              key={`gf-petal-${i}`}
              className="gf-petal-fall"
              style={{ left: `${p.left}%`, animationDuration: `${p.fallDur}s`, animationDelay: `${p.delay}s` }}
            >
              <span
                className="gf-petal-sway"
                style={{ animationDuration: `${p.swayDur}s`, '--sway': `${p.sway}vh` } as CSSProperties}
              >
                <span
                  className="gf-petal"
                  style={{
                    width: `${p.size}vh`,
                    height: `${p.size * 1.5}vh`,
                    opacity: p.op,
                    animationDuration: `${p.spinDur}s`,
                  }}
                />
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="gf-vignette" />
    </div>
  )
}

// Décor permanent : ULTRON (Marvel), kind `ultronFactory`.
// L'USINE DE SOKOVIA. Hangar d'acier sombre mordu par une lueur ROUGE : un CONVOYEUR défile en
// continu au sol en portant des CHÂSSIS de drones inertes, des BRAS ROBOTISÉS pivotent au-dessus de
// la chaîne en crachant des GERBES D'ÉTINCELLES de soudure, une poussière métallique flotte, et au
// fond les PAIRES D'YEUX ROUGES de l'armée s'allument rangée par rangée.
// L'armée est branchée sur la PROGRESSION D'OBJECTIF (`objectivePct`, comme la lune du Seigneur des
// clés) : plus Ultron approche de L'ÈRE D'ULTRON, plus il y a d'yeux allumés — l'armée s'éveille.
// Même contrainte de mise en page que `haddonfield` : tout ce qui est « au sol » vit dans un calque
// remonté au-dessus du panneau du joueur, sinon c'est masqué. 100 % CSS (aucun asset).
// ---------------------------------------------------------------------------
// Les rangées de l'armée, du FOND (petites, floues, sombres) vers l'AVANT. `bottom` en vh au-dessus
// du convoyeur, `size` = taille d'un œil en vh, `n` = nombre de paires sur la rangée.
const UF_ARMY_ROWS = [
  { bottom: 24, size: 0.46, blur: 0.9, op: 0.5, n: 13 },
  { bottom: 19.5, size: 0.6, blur: 0.55, op: 0.66, n: 11 },
  { bottom: 15, size: 0.8, blur: 0.25, op: 0.84, n: 9 },
  { bottom: 10.5, size: 1, blur: 0, op: 1, n: 7 },
]
// Part de l'armée déjà éveillée à 0 % d'objectif : sans ce plancher, le décor démarrerait sans son
// élément signature (le fond du hangar serait vide).
const UF_ARMY_FLOOR = 0.2
const UF_CHASSIS = 5 // châssis de drones portés par le convoyeur
const UF_ARMS = [22, 52, 80] // position (%) des bras robotisés au-dessus de la chaîne
const UF_SPARKS_PER_ARM = 12 // étincelles par gerbe de soudure
const UF_DUST = 26 // poussière métallique en suspension
// SURPRISE « SOKOVIA S'ÉLÈVE » : le sol tremble, puis toute l'usine est ARRACHÉE et s'élève ; sous
// elle s'ouvre le cratère incandescent et des blocs de roche se détachent et tombent dans le vide.
// Puis la dalle redescend et se repose dans un dernier choc.
// Elle ne monte que de ~16 vh (et non hors cadre) : au-delà, la colonne se vidait de tout son décor
// pendant plusieurs secondes — on veut voir l'usine SOULEVÉE, pas une colonne vide.
const UF_RISE_TEST = false
const UF_RISE_MS = 9000
const UF_RISE_GAP_MIN_MS = UF_RISE_TEST ? 9000 : 120_000 // 2 min
const UF_RISE_GAP_MAX_MS = UF_RISE_TEST ? 14_000 : 240_000 // 4 min
const UF_DEBRIS = 24 // blocs de roche arrachés qui tombent dans le cratère

function UltronFactoryDecor({ objectivePct }: { objectivePct?: number }) {
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // L'ARMÉE : positions figées au montage. `wake` = ordre d'éveil (les rangées du FOND s'allument
  // en premier — l'armée s'éveille depuis la profondeur du hangar et avance vers nous) ; à rangée
  // égale l'ordre est tiré au hasard pour que la ligne ne s'allume pas de gauche à droite.
  const [army] = useState(() => {
    const eyes = UF_ARMY_ROWS.flatMap((row, r) =>
      Array.from({ length: row.n }, (_, i) => ({
        row: r,
        // Réparti sur toute la largeur, avec un léger décalage par rangée (les rangs ne sont pas
        // alignés en colonnes) et un peu de jeu individuel.
        left: ((i + 0.5) / row.n) * 100 + (r % 2 ? 2.5 : -2.5) + (Math.random() * 3 - 1.5),
        bottom: row.bottom + (Math.random() * 1.4 - 0.7),
        size: row.size,
        blur: row.blur,
        op: row.op,
        // Battement propre à chaque œil (une armée n'a pas un clignotement synchrone).
        dur: 3 + Math.random() * 4, // s
        delay: -(Math.random() * 7), // s
        rank: 0, // rempli juste après
      })),
    )
    // Ordre d'éveil : les rangées de DEVANT d'abord (les plus grandes et les seules bien dégagées —
    // le fond du hangar est à moitié masqué par le plateau, y allumer les premiers yeux ne se
    // voyait pas), puis le hasard à rangée égale.
    const order = eyes.map((_, i) => i).sort((a, b) => eyes[b].row - eyes[a].row || Math.random() - 0.5)
    order.forEach((idx, rank) => (eyes[idx].rank = rank))
    return eyes
  })
  // Châssis inertes sur le convoyeur : taille/vitesse/déphasage figés au montage.
  const [chassis] = useState(() =>
    Array.from({ length: UF_CHASSIS }, (_, i) => ({
      h: 7.5 + Math.random() * 2.5, // vh
      dur: 26 + Math.random() * 16, // s (la chaîne avance lentement)
      delay: -((i / UF_CHASSIS) * 34 + Math.random() * 4), // s (étalés le long de la chaîne)
    })),
  )
  // Gerbes de soudure : chaque étincelle a sa direction, sa portée et son moment. Le cycle est long
  // (le bras ne soude que par à-coups) et décalé par bras.
  const [sparks] = useState(() =>
    UF_ARMS.map((_, a) =>
      Array.from({ length: UF_SPARKS_PER_ARM }, () => ({
        dx: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 9), // vh (portée latérale)
        up: 1.5 + Math.random() * 4.5, // vh (hauteur du rebond)
        dur: 0.5 + Math.random() * 0.5, // s (vie d'une étincelle)
        delay: a * 1.9 + Math.random() * 0.9, // s (dans le cycle commun, décalé par bras)
      })),
    ),
  )
  // Poussière métallique en suspension : dérive lente en boucle fermée + scintillement.
  const [dust] = useState(() =>
    Array.from({ length: UF_DUST }, () => {
      const depth = Math.random()
      return {
        left: Math.random() * 100, // %
        top: 4 + Math.random() * 78, // %
        size: 1 + depth * 2.6, // px
        dx: (Math.random() * 2 - 1) * (2 + depth * 5), // vh
        dy: (Math.random() * 2 - 1) * (1.5 + depth * 3), // vh
        dur: 16 + Math.random() * 22, // s
        delay: -(Math.random() * 30), // s
        op: 0.12 + depth * 0.4,
      }
    }),
  )
  // Les BLOCS DE ROCHE de la surprise : profils figés au montage (le calque, lui, est monté et
  // démonté à chaque passage — sa clé React rejoue les animations).
  const [debris] = useState(() =>
    Array.from({ length: UF_DEBRIS }, () => ({
      left: -4 + Math.random() * 108, // %
      size: 1.4 + Math.random() * 4.6, // vh
      fall: 6 + Math.random() * 12, // vh (profondeur de chute dans le cratère)
      dur: 1.6 + Math.random() * 2.4, // s
      delay: 1.4 + Math.random() * 3.4, // s (ils s'arrachent au fil de l'ascension)
      spin: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 300), // °
      radius: randomBlobRadius(), // silhouette irrégulière (réutilise le générateur des taches)
    })),
  )
  // SURPRISE : `rise` = n° de passage (clé React) ; la classe `is-rising` pilote en parallèle la
  // secousse et l'ascension de la dalle.
  const [rise, setRise] = useState<number | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setRise(++run)
      clear = setTimeout(() => setRise(null), UF_RISE_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(UF_RISE_GAP_MIN_MS + Math.random() * (UF_RISE_GAP_MAX_MS - UF_RISE_GAP_MIN_MS))
      }, delay)
    }
    schedule(UF_RISE_TEST ? 3000 : 60_000 + Math.random() * 40_000) // 1re élévation : 1 min à 1 min 40
    // MODE TEST : déclenche l'élévation à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  // Combien d'yeux sont allumés : plancher + progression d'objectif (0→100).
  const lit = Math.round(army.length * (UF_ARMY_FLOOR + (1 - UF_ARMY_FLOOR) * Math.min(100, Math.max(0, objectivePct ?? 0)) / 100))
  return (
    <div className={`uf-decor${rise !== null ? ' is-rising' : ''}`} aria-hidden>
      {/* Poussière métallique en suspension (dérive + scintillement). */}
      {dust.map((d, i) => (
        <span
          key={`uf-dust-${i}`}
          className="uf-dust"
          style={
            {
              left: `${d.left}%`,
              top: `${d.top}%`,
              animationDuration: `${d.dur}s`,
              animationDelay: `${d.delay}s`,
              '--dx': `${d.dx}vh`,
              '--dy': `${d.dy}vh`,
            } as CSSProperties
          }
        >
          <span
            className="uf-dust-dot"
            style={{ width: `${d.size}px`, height: `${d.size}px`, opacity: d.op }}
          />
        </span>
      ))}
      {/* SURPRISE : LE CRATÈRE. Il vit SOUS la dalle (rendu avant elle) et n'apparaît que dans la
          brèche ouverte par l'ascension — d'où le calque monté à la demande. */}
      {rise !== null && (
        <div key={rise} className="uf-crater">
          <div className="uf-crater-glow" />
          {debris.map((d, i) => (
            <span
              key={i}
              className="uf-rock"
              style={
                {
                  left: `${d.left}%`,
                  width: `${d.size}vh`,
                  height: `${d.size * (0.7 + (i % 3) * 0.15)}vh`,
                  borderRadius: d.radius,
                  animationDuration: `${d.dur}s`,
                  animationDelay: `${d.delay}s`,
                  '--fall': `${d.fall}vh`,
                  '--spin': `${d.spin}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      {/* LE SOL DE L'USINE (remonté au-dessus du panneau du joueur). C'est la DALLE que la surprise
          arrache et soulève : tout ce qu'elle porte (convoyeur, armée, bras) s'élève avec elle. */}
      <div className="uf-ground">
        {/* L'ARMÉE au fond : des paires d'yeux dans le noir. Celles qui sont ÉVEILLÉES brûlent en
            rouge et battent chacune à son rythme ; les autres ne sont qu'un reflet sur du métal. */}
        {army.map((e, i) => (
          <span
            key={`uf-drone-${i}`}
            className={`uf-drone${e.rank < lit ? ' is-on' : ''}`}
            style={
              {
                left: `${e.left}%`,
                bottom: `${e.bottom}vh`,
                height: `${e.size * 6.5}vh`,
                filter: e.blur ? `blur(${e.blur}px)` : undefined,
                animationDuration: `${e.dur}s`,
                animationDelay: `${e.delay}s`,
                '--op': e.op,
              } as CSSProperties
            }
          >
            {/* Le corps : une masse d'épaules à peine plus claire que la pénombre — c'est elle qui
                fait lire une FOULE, là où des yeux seuls ne donnaient que des points épars. */}
            <i className="uf-drone-body" />
            {/* Les deux fentes doivent tenir DANS la tête (≈ 1,6 × `size` de large) : plus larges,
                elles débordaient de part et d'autre du crâne. */}
            <i className="uf-drone-eyes" style={{ gap: `${e.size * 0.32}vh` }}>
              <i className="uf-eye-dot" style={{ width: `${e.size * 0.58}vh`, height: `${e.size * 0.34}vh` }} />
              <i className="uf-eye-dot" style={{ width: `${e.size * 0.58}vh`, height: `${e.size * 0.34}vh` }} />
            </i>
          </span>
        ))}
        {/* LES BRAS ROBOTISÉS : ils pivotent au-dessus de la chaîne, tête de soudure au bout, et
            crachent une gerbe d'étincelles par à-coups. */}
        {UF_ARMS.map((left, a) => (
          <div key={`uf-arm-${a}`} className="uf-arm" style={{ left: `${left}%`, animationDelay: `${-a * 2.7}s` }}>
            <span className="uf-arm-segment" />
            <span className="uf-arm-shoulder" />
            <span className="uf-arm-head" style={{ animationDelay: `${a * 1.9}s` }} />
            {/* La gerbe : chaque étincelle part de la tête, file de travers et retombe. */}
            {sparks[a].map((s, i) => (
              <span
                key={i}
                className="uf-spark-fly"
                style={
                  {
                    animationDuration: `${s.dur}s`,
                    animationDelay: `${s.delay}s`,
                    '--dx': `${s.dx}vh`,
                  } as CSSProperties
                }
              >
                <span
                  className="uf-spark"
                  style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s`, '--up': `${s.up}vh` } as CSSProperties}
                />
              </span>
            ))}
          </div>
        ))}
        {/* Le DESSOUS ARRACHÉ de la dalle : socle de roche déchiqueté, accroché sous le convoyeur.
            Il vit à `bottom: -14vh`, donc hors champ (derrière le panneau du joueur) tant que
            l'usine repose au sol — il n'apparaît QUE pendant l'élévation. */}
        <div className="uf-slab" />
        {/* LE CONVOYEUR : la bande crantée défile en continu, sur ses rouleaux. */}
        <div className="uf-belt">
          <span className="uf-belt-tread" />
          <span className="uf-belt-edge" />
        </div>
        {/* Les CHÂSSIS inertes portés par la chaîne (silhouettes : tête anguleuse + torse). Chacun
            porte un œil ÉTEINT — il n'est pas encore né. */}
        {chassis.map((c, i) => (
          <div
            key={`uf-chassis-${i}`}
            className="uf-chassis"
            style={{ height: `${c.h}vh`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
          >
            <span className="uf-chassis-head" />
            <span className="uf-chassis-body" />
          </div>
        ))}
      </div>
      <div className="uf-vignette" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Décor permanent : THANOS (Marvel), kind `titan`.
// TITAN, SA PLANÈTE MORTE — ET LE GANTELET QUI COMPTE SES PIERRES. Le ciel est une nébuleuse
// violet/magenta étoilée qui vire à l'ocre-rouille en descendant vers un sol stérile ; à l'horizon,
// les TOURS BRISÉES de la cité en silhouette. Surtout, les BLOCS de la planète éclatée dérivent EN
// SUSPENSION, tournant lentement sur eux-mêmes (la gravité est morte avec elle), pendant que des
// CENDRES montent du sol.
// Dans la bande haute, LE GANTELET DE L'INFINI fait office de JAUGE : ses six logements (4 phalanges,
// le dos de la main, le pouce) portent chacun une Pierre, ALLUMÉE seulement si Thanos l'a réellement
// capturée en Compétences — même principe que la phase de lune d'`atmosfear`, mais nominatif : c'est
// bien la gemme de CETTE Pierre qui s'allume, à sa couleur.
// Répartition volontaire : le Gantelet et le ciel occupent la BANDE HAUTE, les tours et le sol la
// BANDE BASSE, les blocs en suspension les MARGES — le plateau, opaque, masque le centre.
// ---------------------------------------------------------------------------
// (Les 6 PIERRES et leurs logements sont une DONNÉE de décor : `TITAN_STONES`, villainDecor.ts.)
// Profils de BLOC : trois découpes irrégulières (clip-path) suffisent à ce qu'aucun débris ne se
// lise comme la copie d'un autre, la rotation et la taille faisant le reste.
const TITAN_ROCK_SHAPES = [
  'polygon(18% 4%, 62% 0%, 96% 34%, 88% 78%, 52% 100%, 12% 86%, 0% 44%)',
  'polygon(34% 0%, 82% 14%, 100% 56%, 70% 96%, 24% 88%, 4% 52%, 10% 20%)',
  'polygon(8% 22%, 48% 2%, 90% 18%, 100% 62%, 66% 92%, 26% 98%, 0% 66%)',
]
// LES BLOCS DE TITAN en suspension. `left` en %, `top` en vh, `size` en vh, `depth` de 0 (au fond :
// petit, pâle, flou, lent) à 1 (au premier plan). Profils FIGÉS et répartis dans les MARGES et les
// bandes haute/basse : le centre de la colonne est masqué par le plateau, un bloc y serait perdu.
const TITAN_ROCKS = [
  { left: -3, top: 26, size: 7, depth: 1, shape: 0, driftDur: 26, drift: 4, spinDur: 150 },
  { left: 6, top: 8, size: 3.4, depth: 0.4, shape: 1, driftDur: 34, drift: -3, spinDur: 210 },
  { left: 14, top: 44, size: 4.6, depth: 0.7, shape: 2, driftDur: 29, drift: 3.5, spinDur: 170 },
  { left: 23, top: 17, size: 2.4, depth: 0.2, shape: 0, driftDur: 40, drift: 2.4, spinDur: 260 },
  { left: 31, top: 62, size: 5.6, depth: 0.85, shape: 1, driftDur: 24, drift: -4.5, spinDur: 140 },
  { left: 44, top: 30, size: 2.8, depth: 0.3, shape: 2, driftDur: 37, drift: 3, spinDur: 230 },
  { left: 55, top: 12, size: 3.8, depth: 0.5, shape: 0, driftDur: 31, drift: -2.8, spinDur: 190 },
  { left: 63, top: 52, size: 6.4, depth: 0.95, shape: 1, driftDur: 22, drift: 4.2, spinDur: 130 },
  { left: 72, top: 24, size: 3.2, depth: 0.35, shape: 2, driftDur: 35, drift: -3.2, spinDur: 240 },
  { left: 80, top: 40, size: 4.8, depth: 0.75, shape: 0, driftDur: 28, drift: 3.8, spinDur: 165 },
  { left: 88, top: 9, size: 2.6, depth: 0.25, shape: 1, driftDur: 42, drift: -2.2, spinDur: 270 },
  { left: 95, top: 58, size: 7.4, depth: 1, shape: 2, driftDur: 25, drift: 4.6, spinDur: 145 },
  { left: 37, top: 76, size: 3, depth: 0.45, shape: 0, driftDur: 33, drift: -2.6, spinDur: 220 },
  { left: 50, top: 84, size: 4.2, depth: 0.65, shape: 1, driftDur: 27, drift: 3.4, spinDur: 180 },
]
// LES TOURS BRISÉES de la cité de Titan, à l'horizon : `left`/`w` en % de la colonne, `h` en vh.
// Toutes en silhouette (aucune lumière : plus personne n'habite là).
const TITAN_TOWERS = [
  { left: -2, w: 9, h: 7 },
  { left: 8, w: 6, h: 11 },
  { left: 15, w: 11, h: 5.5 },
  { left: 27, w: 7, h: 9.5 },
  { left: 35, w: 9, h: 6.5 },
  { left: 45, w: 6, h: 12 },
  { left: 52, w: 10, h: 5 },
  { left: 63, w: 7, h: 8.5 },
  { left: 71, w: 11, h: 6 },
  { left: 83, w: 6, h: 10.5 },
  { left: 90, w: 10, h: 7.5 },
]
const TITAN_STARS = 44
const TITAN_ASH = 26
// SURPRISE « LE CLAQUEMENT ». Les six gemmes montent en puissance (~2,6 s), un FLASH blanc et une
// onde de choc partent du Gantelet, puis LE MONDE SE DÉSAGRÈGE : les couches se désaturent et
// s'effacent tandis que la poussière s'envole, dans un silence noir — avant que tout se reforme.
// À GARDER en phase avec les keyframes `titanSnap*` / `tgCharge` (index.css).
const TITAN_SNAP_TEST = false
const TITAN_SNAP_MS = 13_000 // charge (2,6 s) + flash + poussière tenue (5,4 s) + retour du monde (5 s)
const TITAN_SNAP_GAP_MIN_MS = TITAN_SNAP_TEST ? 9000 : 160_000 // 2 min 40
const TITAN_SNAP_GAP_MAX_MS = TITAN_SNAP_TEST ? 15_000 : 280_000 // 4 min 40
// Poussière du Claquement : bien plus dense que les cendres permanentes (c'est un monde qui part).
const TITAN_DUST = 90

function TitanDecor({ stones }: { stones?: string[] }) {
  const side = useContext(DecorSideContext)
  const fireRef = useRef<() => void>(() => {})
  useSurpriseSub(fireRef)
  // Étoiles de la nébuleuse (bande haute), chacune scintillant à son rythme.
  const [stars] = useState(() =>
    Array.from({ length: TITAN_STARS }, () => ({
      left: Math.random() * 100, // %
      top: Math.random() * 34, // vh
      size: 0.12 + Math.random() * 0.26, // vh
      dur: 2.6 + Math.random() * 4.5, // s
      delay: -(Math.random() * 7), // s
      op: 0.4 + Math.random() * 0.55,
    })),
  )
  // CENDRES permanentes : elles montent du sol en ondulant, en fondu aux deux extrémités.
  const [ash] = useState(() =>
    Array.from({ length: TITAN_ASH }, () => ({
      left: Math.random() * 100, // %
      size: 0.18 + Math.random() * 0.34, // vh
      dur: 9 + Math.random() * 9, // s (montée lente : l'air est mort)
      delay: -(Math.random() * 18), // s
      sway: (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 4), // vh
      swayDur: 3.4 + Math.random() * 3, // s
      brown: Math.random() < 0.5, // cendre grise ou poussière brune
    })),
  )
  // POUSSIÈRE du Claquement : elle part du bas ET du milieu (le monde se défait partout), monte en
  // dérivant, départs échelonnés sur la phase « poussière » de la séquence.
  const [dust] = useState(() =>
    Array.from({ length: TITAN_DUST }, () => ({
      left: Math.random() * 100, // %
      bottom: Math.random() * 70, // vh (elles ne naissent pas toutes au sol)
      size: 0.2 + Math.random() * 0.5, // vh
      dur: 3.5 + Math.random() * 3.5, // s
      delay: 2.6 + Math.random() * 3.2, // s (après le flash, jamais avant)
      dx: (Math.random() - 0.5) * 16, // vw
      brown: Math.random() < 0.55, // gris cendre ou brun terreux
    })),
  )
  // SURPRISE : `snap` porte un compteur qui sert de clé React (rejoue les animations). `null` = le
  // monde tourne normalement.
  const [snap, setSnap] = useState<{ run: number } | null>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let clear: ReturnType<typeof setTimeout>
    let next: ReturnType<typeof setTimeout>
    let run = 0
    const fire = () => {
      setSnap({ run: ++run })
      clear = setTimeout(() => setSnap(null), TITAN_SNAP_MS)
    }
    const schedule = (delay: number) => {
      next = setTimeout(() => {
        fire()
        schedule(TITAN_SNAP_GAP_MIN_MS + Math.random() * (TITAN_SNAP_GAP_MAX_MS - TITAN_SNAP_GAP_MIN_MS))
      }, delay)
    }
    schedule(TITAN_SNAP_TEST ? 3000 : 80_000 + Math.random() * 50_000) // 1er Claquement : 1 min 20 à 2 min 10
    // MODE TEST : claque des doigts à la demande depuis le panneau Animation.
    fireRef.current = fire
    return () => {
      clearTimeout(next)
      clearTimeout(clear)
    }
  }, [])
  // La colonne du décor déborde de 10 % vers son bord EXTÉRIEUR (cf. App.tsx) → son axe `left:50%`
  // n'est plus le centre visible. On recale le Gantelet (et l'onde de choc, qui en part) de 5 % vers
  // le bord INTÉRIEUR, comme le minuteur d'`atmosfear`.
  const gauntletLeft = side === 'right' ? '45%' : '55%'
  const captured = stones ?? []
  return (
    <div
      className={`titan-decor${snap ? ' is-snap' : ''}`}
      style={{ '--tg-left': gauntletLeft } as CSSProperties}
      aria-hidden
    >
      {/* LE MONDE : tout ce que le Claquement réduit en poussière. */}
      <div className="titan-world">
        {/* La nébuleuse : deux nappes qui dérivent en sens contraire, très lentement. */}
        <div className="titan-nebula" />
        <div className="titan-nebula titan-nebula--2" />
        {/* Les ÉTOILES, derrière tout le reste. */}
        <div className="titan-stars">
          {stars.map((s, i) => (
            <span
              key={`ti-star-${i}`}
              className="titan-star"
              style={
                {
                  left: `${s.left}%`,
                  top: `${s.top}vh`,
                  width: `${s.size}vh`,
                  height: `${s.size}vh`,
                  animationDuration: `${s.dur}s`,
                  animationDelay: `${s.delay}s`,
                  '--op': s.op,
                } as CSSProperties
              }
            />
          ))}
        </div>
        {/* LES TOURS BRISÉES à l'horizon (silhouettes), puis le SOL et sa brume de poussière. */}
        <div className="titan-towers">
          {TITAN_TOWERS.map((t, i) => (
            <span
              key={`ti-tower-${i}`}
              className={`titan-tower titan-tower--${i % 3}`}
              style={{ left: `${t.left}%`, width: `${t.w}%`, height: `${t.h}vh` }}
            />
          ))}
        </div>
        <div className="titan-ground" />
        <div className="titan-haze" />
        {/* LES BLOCS DE LA PLANÈTE ÉCLATÉE : enveloppe = dérive lente (montée/descente), enfant =
            rotation sur soi-même. La profondeur (`depth`) règle taille perçue, pâleur et flou. */}
        {TITAN_ROCKS.map((r, i) => (
          <span
            key={`ti-rock-${i}`}
            className="titan-rock-drift"
            style={
              {
                left: `${r.left}%`,
                top: `${r.top}vh`,
                width: `${r.size}vh`,
                height: `${r.size}vh`,
                animationDuration: `${r.driftDur}s`,
                animationDelay: `-${i * 1.7}s`,
                '--drift': `${r.drift}vh`,
                // Au fond : pâle, flou et effacé ; au premier plan : net et sombre.
                opacity: 0.3 + r.depth * 0.6,
                filter: `blur(${(1 - r.depth) * 0.34}vh)`,
              } as CSSProperties
            }
          >
            <span
              className="titan-rock"
              style={{
                clipPath: TITAN_ROCK_SHAPES[r.shape],
                animationDuration: `${r.spinDur}s`,
                // Roche de Titan : rouille éclairée par la nébuleuse (le haut capte le violet).
                background: `linear-gradient(150deg, #6b4a52 0%, #4a2f3c 45%, #241722 100%)`,
              }}
            />
          </span>
        ))}
        {/* LES CENDRES qui montent du sol (dérive latérale > montée). */}
        <div className="titan-ashes">
          {ash.map((a, i) => (
            <span
              key={`ti-ash-${i}`}
              className="titan-ash-rise"
              style={{ left: `${a.left}%`, animationDuration: `${a.dur}s`, animationDelay: `${a.delay}s` }}
            >
              <span
                className="titan-ash-sway"
                style={{ animationDuration: `${a.swayDur}s`, '--sway': `${a.sway}vh` } as CSSProperties}
              >
                <span
                  className={`titan-ash${a.brown ? ' titan-ash--brown' : ''}`}
                  style={{ width: `${a.size}vh`, height: `${a.size}vh` }}
                />
              </span>
            </span>
          ))}
        </div>
      </div>
      {/* LE GANTELET DE L'INFINI — la JAUGE. Son halo grandit avec le nombre de Pierres serties
          (`--lit`) ; chaque gemme ne s'allume que si SA Pierre est capturée. */}
      <div className="titan-gauntlet" style={{ '--lit': captured.length } as CSSProperties}>
        <span className="tg-aura" />
        {/* Le Gantelet : l'illustration du dos des cartes Pierre, bords fondus en CSS. Ses six
            logements sont dessinés VIDES — il n'y a qu'à y poser les gemmes. */}
        <img className="tg-img" src={TITAN_GAUNTLET} alt="" />
        {/* Les 6 gemmes, chacune dans son logement (positions relevées sur l'illustration). */}
        {TITAN_STONES.map((s) => (
          <span
            key={s.id}
            className={`tg-gem${captured.includes(s.id) ? ' is-lit' : ''}`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.d}%`, '--c': s.c } as CSSProperties}
          />
        ))}
      </div>
      {/* SURPRISE « LE CLAQUEMENT » : la charge, le flash, l'onde de choc, le silence noir et la
          poussière. Les gemmes, elles, sont mises en charge par la classe `is-snap` du décor. */}
      {snap && (
        <div className="titan-snap" key={snap.run}>
          <span className="titan-charge" />
          <span className="titan-flash" />
          <span className="titan-shock" />
          <span className="titan-void" />
          {dust.map((d, i) => (
            <span
              key={`ti-dust-${i}`}
              className="titan-dust-rise"
              style={
                {
                  left: `${d.left}%`,
                  bottom: `${d.bottom}vh`,
                  animationDuration: `${d.dur}s`,
                  animationDelay: `${d.delay}s`,
                  '--dx': `${d.dx}vw`,
                } as CSSProperties
              }
            >
              <span
                className={`titan-dust${d.brown ? ' titan-dust--brown' : ''}`}
                style={{ width: `${d.size}vh`, height: `${d.size}vh` }}
              />
            </span>
          ))}
        </div>
      )}
      <div className="titan-vignette" />
    </div>
  )
}

function renderDecorBody(
  decor: VillainDecorData,
  side?: 'left' | 'right',
  objectivePct?: number,
  timerRunning?: boolean,
  opponentVillain?: VillainKey | string,
  capturedStones?: string[],
) {
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
    case 'evilQueen':
      return <EvilQueenDecor decor={decor} />
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
    case 'flyingDutchman':
      return <FlyingDutchmanDecor decor={decor} />
    case 'grotto':
      return <GrottoDecor />
    case 'voodoo':
      return <VoodooDecor />
    case 'galaxy':
      return <GalaxyDecor />
    case 'underwater':
      return <UnderwaterDecor />
    case 'upsideDown':
      return <UpsideDownDecor />
    case 'felGate':
      return <FelGateDecor />
    case 'otherworld':
      return <OtherworldDecor />
    case 'federation':
      return <FederationDecor />
    case 'haddonfield':
      return <HaddonfieldDecor />
    case 'ultronFactory':
      return <UltronFactoryDecor objectivePct={objectivePct} />
    case 'graceField':
      return <GraceFieldDecor decor={decor} />
    case 'rift':
      return <RiftDecor />
    case 'radiance':
      return <RadianceDecor />
    case 'theWorld':
      return <TheWorldDecor />
    case 'yzma':
      return <YzmaDecor />
    case 'laBonneFee':
      return <LaBonneFeeDecor />
    case 'clockwork':
      return <ClockworkDecor side={side} />
    case 'cruella':
      return <CruellaDecor />
    case 'tremaine':
      return <TremaineDecor decor={decor} />
    case 'cyber':
      return <CyberDecor side={side} />
    case 'castleAssault':
      return <CastleAssaultDecor decor={decor} />
    case 'mim':
      return <MimDecor />
    case 'cauldron':
      return <CauldronDecor />
    case 'syndrome':
      return <SyndromeDecor />
    case 'sunnyside':
      return <SunnysideDecor />
    case 'teamRocket':
      return <TeamRocketDecor />
    case 'atmosfear':
      return <AtmosfearDecor side={side} objectivePct={objectivePct} timerRunning={timerRunning} />
    case 'tamatoa':
      return <TamatoaDecor opponentVillain={opponentVillain} />
    case 'oogie':
      return <OogieDecor />
    case 'candy':
      return <CandyDecor />
    case 'jungle':
      return <JungleDecor />
    case 'scar':
      return <ScarDecor decor={decor} />
    case 'image':
      return <ImageDecor decor={decor} />
    case 'monopoly':
      return <MonopolyDecor decor={decor} />
    case 'titan':
      return <TitanDecor stones={capturedStones} />
    default:
      return null
  }
}

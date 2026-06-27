import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playShatter, playCrack } from '../sfx'

interface Props {
  /** Image du plateau à faire « éclater comme un miroir » (façon Hearthstone). */
  src: string
  /** Plateau ciblé : on mesure sa position pour caler l'éclat dessus, puis les
   *  morceaux volent à travers TOUT l'écran. */
  targetRef: React.RefObject<HTMLElement | null>
  /** Appelé une seule fois au DÉBUT de l'animation (ex. lancer la musique). */
  onStart?: () => void
  /** Appelé une fois l'animation terminée (éclats partis → écran de fin). */
  onDone?: () => void
}

// Phase « fissures » calée sur la DURÉE du son « craquement » (≈ 1,95 s) ; puis
// explosion RALENTIE pour que le TOTAL reste ~4,9 s — l'écran de fin (onDone) tombe
// alors sur la ~4,9ᵉ seconde de la musique de fin.
const CRACK_MS = 1950
const SHARD_MS = 2650
const MAX_DELAY_MS = 300
const TOTAL_MS = CRACK_MS + SHARD_MS + MAX_DELAY_MS // ≈ 4900 ms

type Pt = { x: number; y: number }
type Poly = Pt[]

interface Shard {
  clip: string // polygon(...) en %
  tx: number // projection horizontale (% de la taille du plateau)
  ty: number // projection verticale (+ gravité)
  rot: number // rotation finale (deg)
  delay: number // décalage de départ (s)
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const clamp = (v: number) => Math.max(0, Math.min(100, v))
const round = (v: number) => Math.round(v * 10) / 10

function area(poly: Poly): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}
function centroid(poly: Poly): Pt {
  let x = 0
  let y = 0
  for (const p of poly) {
    x += p.x
    y += p.y
  }
  return { x: x / poly.length, y: y / poly.length }
}

/** Coupe un polygone convexe par la droite passant par `p` de normale `n` : renvoie
 *  les deux moitiés (toujours convexes, qui pavent l'original). */
function splitPoly(poly: Poly, p: Pt, n: Pt): [Poly, Poly] {
  const a: Poly = []
  const b: Poly = []
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]
    const nxt = poly[(i + 1) % poly.length]
    const dCur = (cur.x - p.x) * n.x + (cur.y - p.y) * n.y
    const dNxt = (nxt.x - p.x) * n.x + (nxt.y - p.y) * n.y
    if (dCur >= 0) a.push(cur)
    else b.push(cur)
    if ((dCur > 0 && dNxt < 0) || (dCur < 0 && dNxt > 0)) {
      const t = dCur / (dCur - dNxt)
      const ip = { x: cur.x + t * (nxt.x - cur.x), y: cur.y + t * (nxt.y - cur.y) }
      a.push(ip)
      b.push(ip)
    }
  }
  return [a, b]
}

/** Polyligne jaggée (fissure éclair) de `from` à `to`, gigue perpendiculaire. */
function jaggedPath(from: Pt, to: Pt, segments: number, jitter: number): string {
  const pts: Pt[] = [from]
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  for (let i = 1; i < segments; i++) {
    const t = i / segments
    const j = (Math.random() - 0.5) * 2 * jitter
    pts.push({ x: clamp(from.x + dx * t + px * j), y: clamp(from.y + dy * t + py * j) })
  }
  pts.push(to)
  return 'M ' + pts.map((p) => `${round(p.x)} ${round(p.y)}`).join(' L ')
}

/**
 * ~20 éclats IRRÉGULIERS (coupes récursives aléatoires, façon Voronoi), une grosse
 * fissure éclair + ramifications, et un point d'impact d'où tout part. Chaque éclat
 * reçoit une projection FORTE (vers l'extérieur + gravité), une rotation et un délai.
 */
function buildShatter(): { shards: Shard[]; cracks: { d: string; delay: number }[] } {
  const impact = { x: rnd(36, 64), y: rnd(34, 60) }
  const polys: Poly[] = [[
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]]
  const TARGET = 20
  let guard = 0
  while (polys.length < TARGET && guard++ < 400) {
    polys.sort((a, b) => area(b) - area(a))
    const idx = Math.floor(Math.random() * Math.min(3, polys.length))
    const poly = polys[idx]
    const c = centroid(poly)
    const ang = Math.random() * Math.PI
    const p = { x: c.x + rnd(-14, 14), y: c.y + rnd(-14, 14) }
    const [pa, pb] = splitPoly(poly, p, { x: Math.cos(ang), y: Math.sin(ang) })
    if (pa.length >= 3 && pb.length >= 3 && area(pa) > 18 && area(pb) > 18) {
      polys.splice(idx, 1, pa, pb)
    }
  }
  const shards: Shard[] = polys.map((poly) => {
    const c = centroid(poly)
    const dx = c.x - impact.x
    const dy = c.y - impact.y
    const m = Math.hypot(dx, dy) || 1
    // Projection forte (en % de la largeur du plateau) → les morceaux traversent
    // l'écran. + biais de gravité vers le bas.
    const spread = rnd(140, 320)
    return {
      clip: 'polygon(' + poly.map((p) => `${round(p.x)}% ${round(p.y)}%`).join(', ') + ')',
      tx: (dx / m) * spread,
      ty: (dy / m) * spread + rnd(60, 180),
      rot: rnd(-260, 260),
      delay: Math.random() * (MAX_DELAY_MS / 1000),
    }
  })
  // BEAUCOUP de grosses fissures blanches qui jaillissent de l'impact vers les
  // bords (rayons jaggés) + des ramifications, le tout étalé dans le temps pour un
  // « craquèlement » lent qui se propage.
  const rayEdge = (ang: number): Pt => {
    const dx = Math.cos(ang)
    const dy = Math.sin(ang)
    const tX = dx === 0 ? Infinity : (dx > 0 ? 100 - impact.x : impact.x) / Math.abs(dx)
    const tY = dy === 0 ? Infinity : (dy > 0 ? 100 - impact.y : impact.y) / Math.abs(dy)
    const t = Math.min(tX, tY)
    return { x: clamp(impact.x + dx * t), y: clamp(impact.y + dy * t) }
  }
  const cracks: { d: string; delay: number }[] = []
  const RAYS = 7
  for (let i = 0; i < RAYS; i++) {
    const ang = (i / RAYS) * Math.PI * 2 + rnd(-0.22, 0.22)
    const end = rayEdge(ang)
    // Fissure principale (de l'impact au bord), apparition échelonnée.
    cracks.push({ d: jaggedPath(impact, end, 5, 8), delay: i * 0.12 })
    // Au plus une ramification, pas systématique.
    if (Math.random() < 0.5) {
      const f = rnd(0.4, 0.75)
      const from = { x: impact.x + (end.x - impact.x) * f, y: impact.y + (end.y - impact.y) * f }
      const bEnd = rayEdge(ang + (Math.random() < 0.5 ? -1 : 1) * rnd(0.5, 1.1))
      const to = { x: (from.x + bEnd.x) / 2, y: (from.y + bEnd.y) / 2 }
      cracks.push({ d: jaggedPath(from, to, 3, 7), delay: i * 0.12 + 0.22 })
    }
  }
  return { shards, cracks }
}

/**
 * Le plateau (`src`) se fissure d'un grand éclair puis vole en éclats à travers
 * l'écran comme un miroir brisé (inspiration Hearthstone), avant l'écran de fin.
 * Overlay plein écran (portail) calé sur le plateau `targetRef`. `onDone` en fin.
 */
export function MirrorShatter({ src, targetRef, onStart, onDone }: Props) {
  const { shards, cracks } = useMemo(() => buildShatter(), [])
  const [phase, setPhase] = useState<'crack' | 'boom'>('crack')
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const startedRef = useRef(false)

  // Mesure la position/taille du plateau au montage (calage de l'éclat).
  useLayoutEffect(() => {
    const el = targetRef.current
    if (el) {
      const r = el.getBoundingClientRect()
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Enchaîne crack → boom → fin, et lance la musique AU DÉBUT (une seule fois, même
  // en StrictMode). Les minuteries, elles, sont re-planifiées à chaque montage.
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      onStart?.()
      // Bruit de craquement PENDANT la propagation des fissures.
      playCrack()
    }
    const t1 = window.setTimeout(() => {
      // Bruit d'explosion AU MOMENT où le plateau vole en éclats.
      playShatter()
      setPhase('boom')
    }, CRACK_MS)
    const t2 = window.setTimeout(() => onDone?.(), TOTAL_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[78] overflow-hidden">
      {rect && (
        <div
          className={`absolute ${phase === 'crack' ? 'mirror-shake' : ''}`}
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        >
          {/* Pas de fond derrière les éclats : le plateau vivant est déjà masqué côté
              App (visibility:hidden) et les morceaux pavent toute l'image pendant les
              fissures. Au boom ils s'envolent et laissent voir le fond de la page. */}

          {/* Les éclats : image entière clippée à chaque polygone irrégulier. À
              l'explosion, transition CSS → projection + rotation + rétrécissement
              + fondu, avec décalages échelonnés. */}
          {shards.map((s, i) => (
            <div
              key={i}
              className="absolute inset-0"
              style={{
                clipPath: s.clip,
                WebkitClipPath: s.clip,
                backgroundImage: `url(${src})`,
                backgroundSize: '100% 100%',
                transition: `transform ${SHARD_MS}ms cubic-bezier(0.25, 0.5, 0.3, 1) ${s.delay}s, opacity ${SHARD_MS}ms ease-in ${s.delay}s`,
                willChange: 'transform, opacity',
                ...(phase === 'boom'
                  ? { transform: `translate(${s.tx}%, ${s.ty}%) rotate(${s.rot}deg) scale(0.4)`, opacity: 0 }
                  : null),
              }}
            />
          ))}

          {/* Fissure éclair (Hearthstone), tracée pendant la phase « crack ». */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ opacity: phase === 'crack' ? 1 : 0, transition: 'opacity 0.3s ease-out', filter: 'drop-shadow(0 0 1.2px rgba(180,220,255,0.9))' }}
          >
            {cracks.map((c, i) => (
              <path
                key={i}
                d={c.d}
                fill="none"
                stroke="rgba(248,252,255,0.97)"
                strokeWidth={0.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mirror-crack"
                style={{ animationDelay: `${c.delay}s` }}
              />
            ))}
          </svg>

          {/* Éclair lumineux au moment de la rupture (début de l'explosion). */}
          <div className={`absolute inset-0 bg-white ${phase === 'boom' ? 'mirror-flash' : ''}`} style={{ opacity: 0 }} />
        </div>
      )}

      <style>{`
        /* Tremblement subtil et continu pendant que les fissures grandissent. */
        .mirror-shake { animation: mirrorShake 0.42s ease-in-out infinite; }
        @keyframes mirrorShake {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-1.3px, 1px); }
          50% { transform: translate(1.3px, -0.8px); }
          75% { transform: translate(-0.9px, 1.2px); }
        }
        /* Fissures tracées LENTEMENT (chacune ~1,4 s), avec un délai propre → le
           réseau de grosses fissures blanches se propage progressivement. */
        .mirror-crack {
          stroke-dasharray: 320;
          stroke-dashoffset: 320;
          animation: crackDraw 0.9s ease-out forwards;
        }
        @keyframes crackDraw { to { stroke-dashoffset: 0; } }
        .mirror-flash { animation: mirrorFlash 0.5s ease-out forwards; }
        @keyframes mirrorFlash {
          0% { opacity: 0; }
          22% { opacity: 0.9; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>,
    document.body,
  )
}

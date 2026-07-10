import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance, PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { playHistoryEvent } from '../sfx'

const imgOf = (c?: CardInstance) => (c ? getCardDef(c.cardId)?.image : undefined)

// Dimensions de la carte « droite » (px). Tournée de -90°, son empreinte devient
// CARD_H (largeur) × CARD_W (hauteur) → tient dans la marge gauche, en plus grand.
const CARD_W = 44
const CARD_H = 62

/** Carte tournée à gauche (-90°), centrée dans son empreinte tournée. */
function RotatedCard({ src, fate }: { src?: string; fate?: boolean }) {
  const border = fate ? 'border-white/40' : 'border-white/20'
  const style = { width: CARD_W, height: CARD_H, transform: 'translate(-50%, -50%) rotate(-90deg)' }
  return (
    <div className="relative" style={{ width: CARD_H, height: CARD_W }}>
      {src ? (
        <img src={src} alt="" className={`absolute left-1/2 top-1/2 rounded border ${border}`} style={style} />
      ) : (
        <div
          className={`absolute left-1/2 top-1/2 rounded border border-dashed bg-white/5 ${border}`}
          style={style}
        />
      )}
    </div>
  )
}

/** Une pile (pioche ou défausse) tournée, avec compteur ; zoom au survol si `zoom`.
 *  Si `onClick` est fourni, la pile devient cliquable (ouvre le détail). */
function Pile({
  src,
  count,
  fate,
  zoom,
  onClick,
  upright,
  uprightWidth = 'w-32',
  zoomClass = 'bottom-0 left-full ml-1',
}: {
  src?: string
  count: number
  fate?: boolean
  zoom?: boolean
  onClick?: () => void
  /** Carte affichée DROITE (verticale) au lieu de la petite carte couchée. */
  upright?: boolean
  /** Largeur (classe Tailwind) de la carte en mode `upright`. */
  uprightWidth?: string
  /** Position du zoom au survol (classes d'ancrage). Défaut : à droite, aligné bas. */
  zoomClass?: string
}) {
  const [hover, setHover] = useState(false)
  const clickable = !!onClick && count > 0
  const border = fate ? 'border-white/40' : 'border-white/20'
  return (
    <div
      className={`relative ${clickable ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={clickable ? onClick : undefined}
      title={clickable ? 'Voir la défausse' : undefined}
      // On ne remonte au-dessus du reste (dont l'éventail de la main) QUE s'il y a un
      // aperçu zoom à afficher au survol (défausse). La pioche (sans zoom) reste au plan
      // du fond → elle passe sous les cartes de la main / de la distribution.
      style={{ zIndex: hover && zoom ? 50 : 1 }}
    >
      {upright ? (
        src ? (
          <img src={src} alt="" className={`${uprightWidth} rounded border ${border}`} />
        ) : (
          <div className={`aspect-[5/7] ${uprightWidth} rounded border border-dashed bg-white/5 ${border}`} />
        )
      ) : (
        <RotatedCard src={src} fate={fate} />
      )}
      <span className="absolute -bottom-1 -right-1 rounded-full bg-black/85 px-1 text-[8px] font-mono text-white">
        {count}
      </span>
      {/* Zoom de la défausse : carte droite. Position pilotée par `zoomClass`
          (par défaut à droite, aligné bas). */}
      {zoom && src && hover && (
        <div className={`absolute ${zoomClass} z-50 rounded-lg border border-white/20 bg-[#0b0a12] p-1 shadow-2xl`}>
          <img src={src} alt="" className="h-72 w-auto max-w-none rounded" />
        </div>
      )}
    </div>
  )
}

/** Fenêtre listant toutes les cartes d'une défausse (plus récentes en premier).
 *  Lecture seule par défaut ; si `onPick` est fourni, chaque carte devient
 *  cliquable (ex. « Te revoilà ! » : choisir la carte à reprendre en main). Sans
 *  `onClose`, la fenêtre ne peut pas être fermée sans choisir (choix obligatoire). */
export function DiscardModal({
  cards,
  label,
  onClose,
  onPick,
}: {
  cards: CardInstance[]
  label: string
  onClose?: () => void
  onPick?: (instanceId: string) => void
}) {
  // Ordre : du dessus de la pile (dernière défaussée) vers le fond.
  const ordered = [...cards].reverse()
  // Carte survolée → aperçu ancré JUSTE AU-DESSUS de la vignette (on mémorise sa
  // position écran, l'aperçu est rendu en `fixed` hors du conteneur défilable pour
  // ne pas être rogné par l'`overflow`).
  const [hovered, setHovered] = useState<{ id: string; rect: DOMRect } | null>(null)
  const hoveredCard = hovered ? ordered.find((c) => c.instanceId === hovered.id) : undefined
  // Rendu via portail sur <body> : la modale est sinon imbriquée dans la colonne
  // du plateau (conteneur défilable), ce qui empêchait son fond de couvrir tout
  // l'écran (effet « transparent »).
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-2xl flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-purple-200">
            {label} <span className="font-normal text-white/40">({cards.length})</span>
          </h2>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
            >
              Fermer ✕
            </button>
          )}
        </div>
        {onPick && (
          <p className="text-center text-sm text-amber-200/90">Clique une carte pour la reprendre en main.</p>
        )}
        {ordered.length === 0 ? (
          <p className="text-sm text-white/50">La défausse est vide.</p>
        ) : (
          <div className="flex max-h-[70vh] flex-wrap justify-center gap-3 overflow-y-auto">
            {ordered.map((c) => (
              <img
                key={c.instanceId}
                src={imgOf(c)}
                alt={c.name}
                title={c.name}
                onMouseEnter={(e) =>
                  setHovered({ id: c.instanceId, rect: e.currentTarget.getBoundingClientRect() })
                }
                onMouseLeave={() => setHovered((h) => (h?.id === c.instanceId ? null : h))}
                onClick={onPick ? () => onPick(c.instanceId) : undefined}
                className={`w-24 rounded-lg border border-white/15 transition hover:border-amber-300 ${onPick ? 'cursor-pointer hover:brightness-110' : 'cursor-zoom-in'}`}
              />
            ))}
          </div>
        )}
      </div>
      {/* Aperçu de la carte survolée, ancré juste AU-DESSUS de la vignette (centré
          dessus). Bascule en dessous si la place manque en haut de l'écran. */}
      {hoveredCard && hovered && (() => {
        const above = hovered.rect.top > 300
        return (
          <div
            className="pointer-events-none fixed z-[80]"
            style={{
              left: hovered.rect.left + hovered.rect.width / 2,
              top: above ? hovered.rect.top - 6 : hovered.rect.bottom + 6,
              transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            }}
          >
            <img
              src={imgOf(hoveredCard)}
              alt={hoveredCard.name}
              className="h-72 w-auto max-w-none rounded-xl border-2 border-amber-300/70 shadow-2xl"
            />
          </div>
        )
      })()}
    </div>,
    document.body,
  )
}

/**
 * Dr Facilier — Pile de l'Au-delà (face cachée). Affiche le dos Vilain teinté de
 * fuchsia avec le compteur de cartes. Rendue uniquement si la pile est non vide.
 */
export function AuDelaPile({
  player,
  uprightWidth = 'w-28',
}: {
  player: PlayerState
  uprightWidth?: string
}) {
  const count = player.auDela.length
  const [open, setOpen] = useState(false)
  if (count === 0) return null
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); playHistoryEvent(); setOpen(true) }}
        className="relative cursor-pointer"
        title="Voir la Pile de l'Au-delà"
      >
        <img
          src={player.backVillainImage}
          alt="Pile de l'Au-delà"
          className={`${uprightWidth} rounded border-2 border-fuchsia-400/70 shadow-[0_0_8px_rgba(217,70,239,0.5)] transition hover:brightness-110`}
        />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-black/85 px-1 text-[8px] font-mono text-white">
          {count}
        </span>
      </button>
      <span className="text-[8px] font-bold uppercase tracking-wide text-fuchsia-300/90">Au-delà</span>
      {open && (
        <DiscardModal
          cards={player.auDela}
          label={`Pile de l'Au-delà — ${player.villainName}`}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * La Méchante Reine — zone INGRÉDIENTS (face VISIBLE), à la même place que la Pile
 * de l'Au-delà de Facilier. Affiche les Ingrédients déjà joués (face up) pour
 * qu'on voie lesquels sont dedans, et le compteur n/4. Cliquer agrandit. Rendue
 * uniquement pour la Méchante Reine (champ `ingredients` défini).
 */
export function IngredientsPile({
  player,
  uprightWidth = 'w-20',
}: {
  player: PlayerState
  uprightWidth?: string
}) {
  const [open, setOpen] = useState(false)
  if (player.ingredients === undefined) return null
  const ingredients = player.ingredients
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-fuchsia-300/90">
        Ingrédients {ingredients.length}/4
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (ingredients.length > 0) { playHistoryEvent(); setOpen(true) } }}
        className={`grid grid-cols-2 gap-1 ${ingredients.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
        title={ingredients.length > 0 ? 'Voir les Ingrédients' : 'Aucun Ingrédient joué'}
      >
        {ingredients.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`aspect-[5/7] ${uprightWidth} rounded border border-dashed border-fuchsia-400/40 bg-white/5`}
              />
            ))
          : ingredients.map((c) => (
              <img
                key={c.instanceId}
                src={imgOf(c)}
                alt={c.name}
                title={c.name}
                className={`${uprightWidth} rounded border-2 border-fuchsia-400/70 shadow-[0_0_6px_rgba(217,70,239,0.5)] transition hover:brightness-110`}
              />
            ))}
      </button>
      {open && (
        <DiscardModal
          cards={ingredients}
          label={`Ingrédients — ${player.villainName}`}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Gul'dan — zone ARTÉFACTS, au même emplacement et sur le même modèle que la pile
 * Ingrédients de la Méchante Reine. Affiche les Artéfacts déjà joués (face up) + le
 * compteur n/4. Rendue uniquement pour Gul'dan (champ `artifacts` défini).
 */
export function ArtifactsPile({
  player,
  uprightWidth = 'w-20',
}: {
  player: PlayerState
  uprightWidth?: string
}) {
  const [open, setOpen] = useState(false)
  if (player.artifacts === undefined) return null
  const artifacts = player.artifacts
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-violet-300/90">
        Artéfacts {artifacts.length}/4
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (artifacts.length > 0) { playHistoryEvent(); setOpen(true) } }}
        className={`grid grid-cols-2 gap-1 ${artifacts.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
        title={artifacts.length > 0 ? 'Voir les Artéfacts' : 'Aucun Artéfact joué'}
      >
        {artifacts.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`aspect-[5/7] ${uprightWidth} rounded border border-dashed border-violet-400/40 bg-white/5`}
              />
            ))
          : artifacts.map((c) => (
              <img
                key={c.instanceId}
                src={imgOf(c)}
                alt={c.name}
                title={c.name}
                className={`${uprightWidth} rounded border-2 border-violet-400/70 shadow-[0_0_6px_rgba(167,139,250,0.5)] transition hover:brightness-110`}
              />
            ))}
      </button>
      {open && (
        <DiscardModal
          cards={artifacts}
          label={`Artéfacts — ${player.villainName}`}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Isabella — HORLOGE, à la même place que les piles secondaires (Au-delà, Ingrédients,
 * Artéfacts…). Affiche l'horloge (Horloge.png), une AIGUILLE orientée sur l'heure courante
 * (XII→II→IV→VI→VIII→X) et une ✓ sur chaque heure VALIDÉE (une Activité y a été jouée).
 * Rendue uniquement pour Isabella (champ `validatedHours` défini).
 */
export function ClockPile({ player, size = 'w-24' }: { player: PlayerState; size?: string }) {
  if (player.validatedHours === undefined || player.clockHour === undefined) return null
  const HOURS = ['XII', 'II', 'IV', 'VI', 'VIII', 'X']
  const hour = player.clockHour
  const validated = new Set(player.validatedHours)
  // Géométrie estimée sur Horloge.png (691×940) : pivot du cadran + rayon jusqu'aux chiffres.
  const CX = 50, CY = 61.5 // centre du cadran (% de l'image)
  const RX = 30, RY = 22 // rayon (% largeur / hauteur) — le cadran est ~circulaire en pixels
  const mark = (i: number) => {
    const th = ((-90 + i * 60) * Math.PI) / 180
    return { left: `${CX + RX * Math.cos(th)}%`, top: `${CY + RY * Math.sin(th)}%` }
  }
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-amber-200/90">
        Horloge {validated.size}/6
      </span>
      <div
        className={`relative ${size} aspect-[691/940]`}
        title={`Heure : ${HOURS[hour]} — validées : ${[...validated].sort((a, b) => a - b).map((i) => HOURS[i]).join(', ') || 'aucune'} (${validated.size}/6)`}
      >
        <img src="/isabella-horloge.png" alt="Horloge" className="h-full w-full object-contain" />
        {/* Aiguille : part du pivot vers le haut (XII), tourne de heure×60°. */}
        <div
          className="absolute w-[3px] rounded bg-amber-300 shadow-[0_0_4px_rgba(252,211,77,0.8)]"
          style={{
            left: `${CX}%`,
            top: `${CY}%`,
            height: `${RY}%`,
            transform: `translate(-50%, -100%) rotate(${hour * 60}deg)`,
            transformOrigin: '50% 100%',
          }}
        />
        {/* Pivot central. */}
        <div
          className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200"
          style={{ left: `${CX}%`, top: `${CY}%` }}
        />
        {/* ✓ sur chaque heure validée. */}
        {HOURS.map((h, i) =>
          validated.has(i) ? (
            <span
              key={h}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-300 drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"
              style={mark(i)}
            >
              ✓
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}

/**
 * Davy Jones — TRÉSORS RÉCUPÉRÉS (face visible), à la même place que les piles
 * secondaires (Au-delà, Ingrédients…). Affiche les jetons Trésor déjà récupérés et le
 * compteur n/5. Rendu uniquement pour Davy Jones (champ `claimedTreasures` défini).
 */
export function ClaimedTreasuresPile({
  player,
  uprightWidth = 'w-9',
}: {
  player: PlayerState
  uprightWidth?: string
}) {
  if (player.claimedTreasures === undefined) return null
  const claimed = player.claimedTreasures
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-amber-300/90">
        Trésors {claimed.length}/5
      </span>
      <div className="grid grid-cols-5 gap-0.5" title={`Trésors récupérés : ${claimed.length}/5`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const id = claimed[i]
          return id ? (
            <img
              key={id}
              src={`/cards/davy-jones/treasure-${id}.png`}
              alt={id}
              title={id}
              className={`${uprightWidth} aspect-square object-contain drop-shadow-[0_0_5px_rgba(251,191,36,0.7)]`}
            />
          ) : (
            <div
              key={i}
              className={`${uprightWidth} aspect-square bg-amber-300/15`}
              style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * Le Seigneur des Ténèbres — tuile CHAUDRON MAGIQUE (à deux faces), affichée à la
 * même place que les piles secondaires (Au-delà, Ingrédients…). Face « Chaudron »
 * tant qu'il n'est pas réveillé, face « Pouvoir » une fois réveillé. Rendue
 * uniquement pour ce vilain (champ `blackCauldron` défini).
 */
export function CauldronTile({
  player,
  uprightWidth = 'w-16',
}: {
  player: PlayerState
  uprightWidth?: string
}) {
  const [hovered, setHovered] = useState(false)
  if (player.blackCauldron === undefined) return null
  const st = player.blackCauldron
  const label = st === 'powered' ? 'Réveillé' : st === 'claimed' ? 'En sa possession' : 'À s’emparer'
  const tone = st === 'powered' ? 'text-lime-300' : st === 'claimed' ? 'text-amber-200' : 'text-white/40'
  const tile =
    st === 'powered'
      ? '/cards/seigneur-tenebres/cauldron-powered.png'
      : '/cards/seigneur-tenebres/cauldron.png'
  return (
    <div
      className="relative flex flex-col items-center gap-0.5"
      title={`Chaudron Magique : ${label}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ zIndex: hovered ? 50 : undefined }}
    >
      <span className="text-[8px] font-bold uppercase tracking-wide text-lime-300/90">Chaudron</span>
      <img
        src={tile}
        alt="Chaudron Magique"
        className={`${uprightWidth} h-auto cursor-zoom-in object-contain transition-transform hover:scale-105 ${
          st === 'set-aside'
            ? 'opacity-30 grayscale'
            : st === 'powered'
              ? 'drop-shadow-[0_0_6px_rgba(132,204,22,0.7)]'
              : ''
        }`}
      />
      <span className={`text-[8px] font-semibold ${tone}`}>{label}</span>
      {/* Aperçu agrandi au survol (affiché à droite, comme le zoom des cartes). */}
      {hovered && (
        <div className="pointer-events-none absolute left-full top-0 z-50 ml-2">
          <img
            src={tile}
            alt="Chaudron Magique"
            className={`w-48 max-w-none rounded-lg border-2 shadow-2xl ${
              st === 'set-aside' ? 'border-white/30 opacity-60 grayscale' : st === 'powered' ? 'border-lime-400/70' : 'border-amber-300/60'
            }`}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Oogie Boogie — PILE Perce-Oreilles (face VISIBLE), à la même place que la Pile de
 * l'Au-delà. Affiche les Imposteur Perce-Oreilles RÉUSSIS empilés près de Sandy Claws
 * et le compte /4 (objectif). Rendue uniquement pour Oogie (champ `impostorPile`).
 */
export function ImpostorPile({
  player,
  uprightWidth = 'w-14',
}: {
  player: PlayerState
  uprightWidth?: string
}) {
  const [open, setOpen] = useState(false)
  if (player.impostorPile === undefined) return null
  const pile = player.impostorPile
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-lime-300/90">
        Perce-Oreilles {pile.length}/4
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (pile.length > 0) { playHistoryEvent(); setOpen(true) } }}
        className={`flex flex-wrap justify-center gap-1 ${pile.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
        title={pile.length > 0 ? 'Voir la pile Perce-Oreilles' : 'Pile Perce-Oreilles vide'}
      >
        {pile.length === 0 ? (
          <div className={`aspect-[5/7] ${uprightWidth} rounded border border-dashed border-lime-400/40 bg-white/5`} />
        ) : (
          pile.map((c) => (
            <img
              key={c.instanceId}
              src={imgOf(c)}
              alt={c.name}
              title={c.name}
              className={`${uprightWidth} rounded border-2 border-lime-400/70 shadow-[0_0_6px_rgba(163,230,53,0.5)] transition hover:brightness-110`}
            />
          ))
        )}
      </button>
      {open && (
        <DiscardModal
          cards={pile}
          label={`Pile Perce-Oreilles — ${player.villainName}`}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Scar — pile SUCCESSION (face VISIBLE), à la même place que la Pile de l'Au-delà.
 * Affiche les Héros éliminés qui s'y trouvent (Mufasa puis les suivants) et la
 * Force combinée /15 (objectif). Rendue uniquement pour Scar (champ `succession`).
 */
export function SuccessionPile({
  player,
  uprightWidth = 'w-14',
}: {
  player: PlayerState
  uprightWidth?: string
}) {
  const [open, setOpen] = useState(false)
  if (player.succession === undefined) return null
  const pile = player.succession
  const force = pile.reduce((n, c) => n + (c.strength ?? 0), 0)
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-amber-300/90">
        Succession {force}/15
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (pile.length > 0) { playHistoryEvent(); setOpen(true) } }}
        className={`flex flex-wrap justify-center gap-1 ${pile.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
        title={pile.length > 0 ? 'Voir la pile Succession' : 'Pile Succession vide'}
      >
        {pile.length === 0 ? (
          <div className={`aspect-[5/7] ${uprightWidth} rounded border border-dashed border-amber-400/40 bg-white/5`} />
        ) : (
          pile.map((c) => (
            <img
              key={c.instanceId}
              src={imgOf(c)}
              alt={c.name}
              title={`${c.name} (force ${c.strength ?? '?'})`}
              className={`${uprightWidth} rounded border-2 border-amber-400/70 shadow-[0_0_6px_rgba(251,191,36,0.5)] transition hover:brightness-110`}
            />
          ))
        )}
      </button>
      {open && (
        <DiscardModal
          cards={pile}
          label={`Pile Succession — ${player.villainName}`}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Cruella d'Enfer — pile des CHIOTS CAPTURÉS (face VISIBLE), à la même place que la
 * Pile de l'Au-delà / Succession / Ingrédients. Affiche les Tuiles Chiots capturées
 * (on voit lesquelles) et le total /99 (objectif). Rendue uniquement pour Cruella
 * (champ `puppyTiles` défini).
 */
export function CapturedPuppiesPile({
  player,
  uprightWidth = 'w-12',
  revealMode = false,
  revealRemaining = 0,
  onRevealTile,
  onDoneReveal,
  addMode = false,
  addCandidates,
  onAddTile,
}: {
  player: PlayerState
  uprightWidth?: string
  /** Repéré ! : les Tuiles face cachée de la réserve deviennent cliquables pour les révéler. */
  revealMode?: boolean
  revealRemaining?: number
  onRevealTile?: (tileId: string) => void
  onDoneReveal?: () => void
  /** Ici mes petits ! / Lampe / Horace… : les Tuiles candidates de la réserve
   *  deviennent cliquables pour en amener une sur son lieu (clic direct, pas de modale). */
  addMode?: boolean
  addCandidates?: string[]
  onAddTile?: (tileId: string) => void
}) {
  if (player.puppyTiles === undefined) return null
  const captured = player.puppyTiles.filter((t) => t.state === 'captured')
  const reserve = player.puppyTiles.filter((t) => t.state === 'reserve')
  const total = captured.reduce((n, t) => n + t.value, 0)
  const shortLoc = (home: string) => (home === 'maison-radcliff' ? 'maison' : home)
  const tileSrc = (t: { homeLocation: string; value: number; revealed: boolean }) =>
    t.revealed ? `/cards/cruella/tuile-${shortLoc(t.homeLocation)}-${t.value}.png` : '/cards/cruella/tuile-dos.png'
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="flex w-full flex-col items-center gap-0.5">
        <span className="text-[8px] font-bold uppercase tracking-wide text-rose-300/90">
          Chiots capturés {total}/99
        </span>
        <div
          className="flex w-full flex-wrap justify-center gap-1"
          title={`${captured.length} Tuile(s) Chiots capturée(s) — ${total} Chiots`}
        >
          {captured.length === 0 ? (
            <div className={`aspect-[5/7] ${uprightWidth} rounded border border-dashed border-rose-400/40 bg-white/5`} />
          ) : (
            captured.map((t) => (
              <img
                key={t.id}
                src={tileSrc(t)}
                alt={`Tuile Chiots ${t.value}`}
                title={`${t.value} chiots`}
                className={`${uprightWidth} relative z-0 rounded border-2 border-rose-400/70 shadow-[0_0_6px_rgba(244,114,182,0.5)] transition-transform duration-150 ease-out hover:z-30 hover:scale-[3.4]`}
              />
            ))
          )}
        </div>
      </div>
      {/* Réserve : les tuiles ni capturées ni posées (face cachée tant que non révélées).
          Tuiles petites pour que toute la réserve tienne sans défilement ni pousser le
          reste de la colonne (pioche/défausse). */}
      <div className="flex w-full flex-col items-center gap-0.5">
        <span className="text-[8px] font-bold uppercase tracking-wide text-rose-300/50">
          {addMode ? 'Choisis une tuile à amener' : `Réserve ${reserve.length}`}
        </span>
        <div className="flex w-full flex-wrap justify-center gap-0.5" title={`${reserve.length} Tuile(s) Chiots en réserve`}>
          {reserve.map((t) => {
            // Repéré ! : une Tuile face cachée devient cliquable (révélation).
            // Ici mes petits ! / Lampe… : une Tuile candidate devient cliquable (amener).
            const canReveal = revealMode && !t.revealed
            const canAdd = addMode && (addCandidates?.includes(t.id) ?? false)
            if (canReveal || canAdd) {
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => (canAdd ? onAddTile?.(t.id) : onRevealTile?.(t.id))}
                  title={canAdd ? 'Amener cette Tuile Chiots sur son lieu' : 'Révéler cette Tuile Chiots'}
                  className="animate-pulse cursor-pointer rounded ring-2 ring-fuchsia-400 transition hover:brightness-125"
                >
                  <img
                    src={tileSrc(t)}
                    alt={t.revealed ? `Tuile Chiots ${t.value}` : 'Tuile face cachée'}
                    className="w-7 rounded border border-fuchsia-300"
                  />
                </button>
              )
            }
            return (
              <img
                key={t.id}
                src={tileSrc(t)}
                alt={t.revealed ? `Tuile Chiots ${t.value}` : 'Tuile Chiots (face cachée)'}
                title={t.revealed ? `${t.value} chiots` : 'Tuile face cachée'}
                className={
                  t.revealed
                    ? 'relative z-0 w-7 rounded border border-rose-400/30 opacity-80 transition-transform duration-150 ease-out hover:z-30 hover:scale-[3.6] hover:opacity-100'
                    : 'w-7 rounded border border-rose-400/30 opacity-80'
                }
              />
            )
          })}
        </div>
        {revealMode && (
          <button
            type="button"
            onClick={() => onDoneReveal?.()}
            className="mt-1 rounded border border-fuchsia-400/60 bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-100 hover:bg-fuchsia-500/30"
          >
            Terminer ({revealRemaining})
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Pioche (dos) + défausse (dernière carte), tournées à gauche et empilées dans la
 * marge : `kind='fate'` (au-dessus de l'image) ou `kind='villain'` (en dessous).
 */
export function DeckPiles({
  player,
  kind,
  playerIndex,
  show = 'both',
  upright = false,
  uprightWidth = 'w-32',
  zoomClass,
}: {
  player: PlayerState
  kind: 'villain' | 'fate'
  /** Index du joueur — pose `data-discard-pile` sur la défausse Vilain (cible du
   *  « vol » du showcase défausse) et `data-deck-pile` sur la pioche Vilain
   *  (origine du vol des cartes piochées, ex. Tyrannie). */
  playerIndex?: number
  /** Quelles piles afficher : les deux empilées (`both`, défaut), la pioche seule
   *  (`deck`) ou la défausse seule (`discard`) — pour les disposer séparément. */
  show?: 'both' | 'deck' | 'discard'
  /** Affiche la pile droite (verticale) au lieu de la petite carte couchée. */
  upright?: boolean
  /** Largeur (classe Tailwind) en mode `upright`. */
  uprightWidth?: string
  /** Position du zoom de la défausse au survol (classes d'ancrage). */
  zoomClass?: string
}) {
  const isFate = kind === 'fate'
  const back = isFate ? player.backFateImage : player.backVillainImage
  const deckCount = isFate ? player.fateDeck.length : player.deck.length
  const discard = isFate ? player.fateDiscard : player.discard
  const last = discard[discard.length - 1]
  const [showDiscard, setShowDiscard] = useState(false)
  const openDiscard = () => { playHistoryEvent(); setShowDiscard(true) }
  const discardLabel = `Défausse ${isFate ? 'Fatalité' : 'Vilain'} — ${player.villainName}`
  const deckPile =
    !isFate && playerIndex !== undefined ? (
      <div data-deck-pile={playerIndex}>
        <Pile src={back} count={deckCount} fate={isFate} upright={upright} uprightWidth={uprightWidth} />
      </div>
    ) : (
      <Pile src={back} count={deckCount} fate={isFate} upright={upright} uprightWidth={uprightWidth} />
    )
  const discardPile =
    !isFate && playerIndex !== undefined ? (
      <div data-discard-pile={playerIndex}>
        <Pile src={imgOf(last)} count={discard.length} fate={isFate} zoom upright={upright} uprightWidth={uprightWidth} zoomClass={zoomClass} onClick={openDiscard} />
      </div>
    ) : (
      <Pile src={imgOf(last)} count={discard.length} fate={isFate} zoom upright={upright} uprightWidth={uprightWidth} zoomClass={zoomClass} onClick={openDiscard} />
    )
  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* `show` permet de disposer les piles séparément (Hadès : pioche à droite,
          défausse à gauche). Par défaut, les deux empilées. */}
      {show === 'deck'
        ? deckPile
        : show === 'discard'
          ? discardPile
          : /* Fatalité : défausse au-dessus, pioche en dessous (inversé vs Vilain). */
            isFate
            ? (
                <>
                  {discardPile}
                  {deckPile}
                </>
              )
            : (
                <>
                  {deckPile}
                  {discardPile}
                </>
              )}
      {showDiscard && (
        <DiscardModal cards={discard} label={discardLabel} onClose={() => setShowDiscard(false)} />
      )}
    </div>
  )
}

/**
 * Syndrome — tuile(s) OMNIDROÏDE prêtes à jouer (v.X9 / v.10), affichées « à part »
 * (à la même place que les piles secondaires), HORS de la main. Jouables comme une
 * carte classique : on clique une action « Jouer une carte », puis la tuile ici.
 * `canPlay` = on est en mode « Jouer une carte » → la tuile pulse et devient cliquable.
 * Rendue uniquement pour Syndrome (`omnidroidStage` défini) et s'il y a une tuile prête.
 */
export function OmnidroidPile({
  player,
  canPlay = false,
  onPlay,
  uprightWidth = 'w-16',
  onCardDragStart,
  onCardDragMove,
  onCardDragDrop,
  onCardDragCancel,
  draggingInstanceId,
}: {
  player: PlayerState
  canPlay?: boolean
  onPlay?: (instanceId: string) => void
  uprightWidth?: string
  /** Glisser-déposer (comme une carte de main) : actifs quand une action « Jouer une
   *  carte » est disponible (`canPlay`). Lâcher sur un lieu joue la tuile. */
  onCardDragStart?: (instanceId: string, x: number, y: number) => void
  onCardDragMove?: (x: number, y: number) => void
  onCardDragDrop?: (instanceId: string, x: number, y: number) => void
  onCardDragCancel?: () => void
  draggingInstanceId?: string | null
}) {
  const [hovered, setHovered] = useState(false)
  const dragPointer = useRef<{ id: string; startX: number; startY: number; dragging: boolean } | null>(null)
  if (player.omnidroidStage === undefined) return null
  const tiles = player.hand.filter((c) => c.isOmnidroid)
  if (tiles.length === 0) return null
  const draggable = canPlay && !!onCardDragStart
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-orange-300/90">Omnidroïde</span>
      <div className="flex gap-1">
        {tiles.map((c) => {
          const clickable = canPlay && !!onPlay
          const isDragging = draggingInstanceId === c.instanceId
          return (
            <div
              key={c.instanceId}
              className="relative"
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{ zIndex: hovered ? 50 : undefined }}
            >
              <button
                type="button"
                disabled={!clickable && !draggable}
                onClick={() => { if (clickable) onPlay?.(c.instanceId) }}
                onPointerDown={
                  draggable
                    ? (e) => {
                        if (e.button !== 0) return
                        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                        dragPointer.current = { id: c.instanceId, startX: e.clientX, startY: e.clientY, dragging: false }
                      }
                    : undefined
                }
                onPointerMove={
                  draggable
                    ? (e) => {
                        const d = dragPointer.current
                        if (!d || d.id !== c.instanceId) return
                        if (!d.dragging) {
                          if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return
                          d.dragging = true
                          onCardDragStart?.(c.instanceId, e.clientX, e.clientY)
                        }
                        onCardDragMove?.(e.clientX, e.clientY)
                      }
                    : undefined
                }
                onPointerUp={
                  draggable
                    ? (e) => {
                        const d = dragPointer.current
                        dragPointer.current = null
                        if (!d || d.id !== c.instanceId) return
                        if (d.dragging) onCardDragDrop?.(c.instanceId, e.clientX, e.clientY)
                      }
                    : undefined
                }
                onContextMenu={
                  draggable
                    ? (e) => { if (dragPointer.current?.dragging) { e.preventDefault(); dragPointer.current = null; onCardDragCancel?.() } }
                    : undefined
                }
                title={draggable ? `Glissez ${c.name} sur un lieu pour le jouer` : `${c.name} — prêt (utilise une action « Jouer une carte »)`}
                className={`block touch-none ${draggable ? 'cursor-grab animate-pulse' : clickable ? 'cursor-pointer animate-pulse' : 'cursor-default'} ${isDragging ? 'opacity-40' : ''}`}
              >
                <img
                  src={imgOf(c)}
                  alt={c.name}
                  className={`${uprightWidth} rounded border-2 transition hover:brightness-110 ${
                    clickable || draggable ? 'border-amber-400 ring-2 ring-amber-400/70' : 'border-orange-400/70'
                  }`}
                />
              </button>
              {hovered && !isDragging && (
                <div className="pointer-events-none absolute left-full top-0 z-50 ml-2">
                  <img src={imgOf(c)} alt={c.name} className="w-48 max-w-none rounded-lg border-2 border-orange-400/70 shadow-2xl" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Madame Mim — pile + défausse des MÉTAMORPHOSES DE MERLIN (2ᵉ pioche Fatalité,
 * dédiée). Affichée AU-DESSUS des piles Fatalité traditionnelles (cf. StacksCards).
 * Rendue uniquement pour le vilain qui a une pioche Merlin (`merlinDeck` défini).
 */
export function MerlinPiles({ player, uprightWidth = 'w-16' }: { player: PlayerState; uprightWidth?: string }) {
  const [showDiscard, setShowDiscard] = useState(false)
  if (player.merlinDeck === undefined) return null
  const deck = player.merlinDeck
  const discard = player.merlinDiscard ?? []
  const last = discard[discard.length - 1]
  const back = '/cards/madame-mim/back-merlin.png'
  return (
    <div className="flex shrink-0 gap-3" title="Métamorphoses de Merlin (pioche & vaincues)">
      <Pile src={back} count={deck.length} fate upright uprightWidth={uprightWidth} />
      <Pile
        src={imgOf(last)}
        count={discard.length}
        fate
        zoom
        upright
        uprightWidth={uprightWidth}
        zoomClass="left-0 top-full mt-1"
        onClick={discard.length > 0 ? () => { playHistoryEvent(); setShowDiscard(true) } : undefined}
      />
      {showDiscard && (
        <DiscardModal
          cards={discard}
          label={`Métamorphoses de Merlin vaincues — ${player.villainName}`}
          onClose={() => setShowDiscard(false)}
        />
      )}
    </div>
  )
}

/**
 * Tamatoa — pile + défausse des cartes MAUI (3ᵉ pioche). Affichée comme les piles Merlin.
 * Rendue uniquement pour le vilain qui a une pioche Maui (`mauiDeck` défini).
 */
export function MauiPiles({ player, uprightWidth = 'w-16' }: { player: PlayerState; uprightWidth?: string }) {
  const [showDiscard, setShowDiscard] = useState(false)
  if (player.mauiDeck === undefined) return null
  const deck = player.mauiDeck
  const discard = player.mauiDiscard ?? []
  const last = discard[discard.length - 1]
  const back = '/cards/tamatoa/back-maui.png'
  return (
    <div className="flex shrink-0 gap-3" title="Cartes Maui (pioche & défausse)">
      <Pile src={back} count={deck.length} fate upright uprightWidth={uprightWidth} />
      <Pile
        src={imgOf(last)}
        count={discard.length}
        fate
        zoom
        upright
        uprightWidth={uprightWidth}
        zoomClass="left-0 top-full mt-1"
        onClick={discard.length > 0 ? () => { playHistoryEvent(); setShowDiscard(true) } : undefined}
      />
      {showDiscard && (
        <DiscardModal
          cards={discard}
          label={`Cartes Maui — ${player.villainName}`}
          onClose={() => setShowDiscard(false)}
        />
      )}
    </div>
  )
}

/** Ultron (Marvel) — les 4 tuiles AMÉLIORATION dans l'ordre, images sous /cards/ultron/.
 *  Face cachée = dos (condition d'accomplissement) ; révélée = Compétence. */
const ULTRON_TILES = [
  { name: 'Transformation', face: '/cards/ultron/tile-transformation.png', back: '/cards/ultron/tile-back-transformation.png' },
  { name: 'Optimisation', face: '/cards/ultron/tile-optimisation.png', back: '/cards/ultron/tile-back-optimisation.png' },
  { name: 'Forme finale', face: '/cards/ultron/tile-forme-finale.png', back: '/cards/ultron/tile-back-forme-finale.png' },
  { name: "L'ère d'Ultron", face: '/cards/ultron/tile-ere-d-ultron.png', back: '/cards/ultron/tile-back-ere-d-ultron.png' },
]

/**
 * Ultron — pile secondaire des 4 tuiles AMÉLIORATION (Transformation → Optimisation →
 * Forme finale → L'ère d'Ultron). Les tuiles déjà révélées montrent leur Compétence ;
 * les autres leur dos (condition). La PROCHAINE tuile complétable pulse, et un bouton
 * « Compléter » apparaît quand `canComplete` (condition remplie, tour du joueur). Rendue
 * uniquement pour Ultron (objectif ULTRON_AGE_REVEALED) — sinon `null`.
 */
export function AmeliorationTiles({
  player,
  canComplete = false,
  onComplete,
}: {
  player: PlayerState
  canComplete?: boolean
  onComplete?: () => void
}) {
  if (player.objective.type !== 'ULTRON_AGE_REVEALED') return null
  const revealed = player.ultronUpgrades ?? 0
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-wide text-red-300/90">
        Améliorations {revealed}/4
      </span>
      <div className="flex gap-0.5">
        {ULTRON_TILES.map((t, i) => {
          const isRevealed = i < revealed
          const isNext = i === revealed
          return (
            <img
              key={t.name}
              src={isRevealed ? t.face : t.back}
              alt={t.name}
              title={t.name}
              className={`w-8 rounded-sm border object-cover ${
                isRevealed ? 'border-red-400/70' : 'border-white/15'
              } ${isNext && canComplete ? 'ring-2 ring-amber-300 animate-pulse' : ''} ${
                !isRevealed && !isNext ? 'opacity-60' : ''
              }`}
            />
          )
        })}
      </div>
      {canComplete && (
        <button
          type="button"
          onClick={onComplete}
          className="mt-0.5 rounded-md border border-amber-300/60 bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-100 transition hover:bg-amber-400/30"
        >
          Compléter
        </button>
      )}
    </div>
  )
}


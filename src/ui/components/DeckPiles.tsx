import { useState } from 'react'
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
      style={{ zIndex: hover ? 50 : 1 }}
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

/** Fenêtre listant toutes les cartes d'une défausse (plus récentes en premier). */
function DiscardModal({
  cards,
  label,
  onClose,
}: {
  cards: CardInstance[]
  label: string
  onClose: () => void
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
          >
            Fermer ✕
          </button>
        </div>
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
                className="w-24 cursor-zoom-in rounded-lg border border-white/15 transition hover:border-amber-300"
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


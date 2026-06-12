import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { CardInstance, PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

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
      {/* Zoom de la défausse : carte droite, s'ouvre en HAUT-DROITE (évite le
          débordement bas qui provoquait une scrollbar). */}
      {zoom && src && hover && (
        <div className="absolute bottom-0 left-full z-50 ml-1 rounded-lg border border-white/20 bg-[#0b0a12] p-1 shadow-2xl">
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
  // Carte survolée → aperçu agrandi (rendu en grand au centre, hors du conteneur
  // défilable pour ne pas être rogné).
  const [hovered, setHovered] = useState<string | null>(null)
  const hoveredCard = ordered.find((c) => c.instanceId === hovered)
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
          <div className="grid max-h-[70vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-5">
            {ordered.map((c) => (
              <img
                key={c.instanceId}
                src={imgOf(c)}
                alt={c.name}
                title={c.name}
                onMouseEnter={() => setHovered(c.instanceId)}
                onMouseLeave={() => setHovered((h) => (h === c.instanceId ? null : h))}
                className="w-full cursor-zoom-in rounded-lg border border-white/15 transition hover:border-amber-300"
              />
            ))}
          </div>
        )}
      </div>
      {/* Aperçu agrandi de la carte survolée (centré, au-dessus de tout). */}
      {hoveredCard && (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center">
          <img
            src={imgOf(hoveredCard)}
            alt={hoveredCard.name}
            className="max-h-[80vh] w-auto rounded-xl border-2 border-amber-300/70 shadow-2xl"
          />
        </div>
      )}
    </div>,
    document.body,
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
}) {
  const isFate = kind === 'fate'
  const back = isFate ? player.backFateImage : player.backVillainImage
  const deckCount = isFate ? player.fateDeck.length : player.deck.length
  const discard = isFate ? player.fateDiscard : player.discard
  const last = discard[discard.length - 1]
  const [showDiscard, setShowDiscard] = useState(false)
  const openDiscard = () => setShowDiscard(true)
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
        <Pile src={imgOf(last)} count={discard.length} fate={isFate} zoom upright={upright} uprightWidth={uprightWidth} onClick={openDiscard} />
      </div>
    ) : (
      <Pile src={imgOf(last)} count={discard.length} fate={isFate} zoom upright={upright} uprightWidth={uprightWidth} onClick={openDiscard} />
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


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
}: {
  src?: string
  count: number
  fate?: boolean
  zoom?: boolean
  onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  const clickable = !!onClick && count > 0
  return (
    <div
      className={`relative ${clickable ? 'cursor-pointer' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={clickable ? onClick : undefined}
      title={clickable ? 'Voir la défausse' : undefined}
      style={{ zIndex: hover ? 50 : 1 }}
    >
      <RotatedCard src={src} fate={fate} />
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
                className="w-full rounded-lg border border-white/15"
              />
            ))}
          </div>
        )}
      </div>
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
}: {
  player: PlayerState
  kind: 'villain' | 'fate'
  /** Index du joueur — pose `data-discard-pile` sur la défausse Vilain (cible du
   *  « vol » du showcase défausse) et `data-deck-pile` sur la pioche Vilain
   *  (origine du vol des cartes piochées, ex. Tyrannie). */
  playerIndex?: number
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
        <Pile src={back} count={deckCount} fate={isFate} />
      </div>
    ) : (
      <Pile src={back} count={deckCount} fate={isFate} />
    )
  const discardPile =
    !isFate && playerIndex !== undefined ? (
      <div data-discard-pile={playerIndex}>
        <Pile src={imgOf(last)} count={discard.length} fate={isFate} zoom onClick={openDiscard} />
      </div>
    ) : (
      <Pile src={imgOf(last)} count={discard.length} fate={isFate} zoom onClick={openDiscard} />
    )
  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Fatalité : défausse au-dessus, pioche en dessous (inversé vs Vilain). */}
      {isFate ? (
        <>
          {discardPile}
          {deckPile}
        </>
      ) : (
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


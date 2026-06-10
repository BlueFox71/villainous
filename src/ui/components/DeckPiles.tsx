import { useState } from 'react'
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

/** Une pile (pioche ou défausse) tournée, avec compteur ; zoom au survol si `zoom`. */
function Pile({ src, count, fate, zoom }: { src?: string; count: number; fate?: boolean; zoom?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
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
        <Pile src={imgOf(last)} count={discard.length} fate={isFate} zoom />
      </div>
    ) : (
      <Pile src={imgOf(last)} count={discard.length} fate={isFate} zoom />
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
    </div>
  )
}


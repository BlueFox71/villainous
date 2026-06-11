import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { ChoiceModal } from './ChoiceModal'

interface Props {
  /** Carte révélée (dernière de la pioche). */
  card: CardInstance
  /** Garder la carte révélée (l'ajouter à la main). */
  onKeep: () => void
  /** Remélanger la pioche et piocher la première carte. */
  onReshuffle: () => void
}

/**
 * Retourne-toi (Slenderman) : montre la dernière carte de la pioche et propose
 * de l'ajouter à la main, ou de remélanger la pioche et piocher la première.
 */
export function DeckPeekModal({ card, onKeep, onReshuffle }: Props) {
  const def = getCardDef(card.cardId)
  return (
    <ChoiceModal
      title="Retourne-toi"
      prompt="Dernière carte de votre pioche :"
      header={
        <div className="flex flex-col items-center gap-1">
          {def?.image ? (
            <img src={def.image} alt={card.name} className="w-40 rounded-lg border border-white/20" />
          ) : (
            <div className="flex h-56 w-40 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-center text-sm text-white">
              {card.name}
            </div>
          )}
          <span className="text-sm font-semibold text-amber-200">{card.name}</span>
        </div>
      }
      options={[
        { key: 'keep', label: 'Ajouter à ma main', onSelect: onKeep },
        { key: 'reshuffle', label: 'Mélanger et piocher la 1ʳᵉ carte', onSelect: onReshuffle },
      ]}
    />
  )
}

import type { CardInstance } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { ChoiceModal } from './ChoiceModal'

interface Props {
  /** Cartes du royaume dont la capacité peut être activée. */
  cards: CardInstance[]
  onPick: (card: CardInstance) => void
  onClose: () => void
}

/** Choix de la carte à activer quand plusieurs portent le symbole « Activer ». */
export function ActivatePickModal({ cards, onPick, onClose }: Props) {
  return (
    <ChoiceModal
      title="Activer une capacité"
      prompt="Quelle carte veux-tu activer ?"
      layout="row"
      options={cards.map((c) => ({
        key: c.instanceId,
        label: c.name,
        description: `Coût d’activation : ${c.activatedCost ?? 0} ${(c.activatedCost ?? 0) > 0 ? 'Pouvoir' : '(gratuit)'}`,
        imageSrc: getCardDef(c.cardId)?.image,
        onSelect: () => onPick(c),
      }))}
      onCancel={onClose}
    />
  )
}

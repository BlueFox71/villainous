import type { CardType } from '../../engine/types'
import { ChoiceModal } from './ChoiceModal'

interface Props {
  /** Les 2 types proposés au choix. */
  types: CardType[]
  /** true = Prédiction (révèle jusqu'à trouver) ; false = Tombée de la nuit (4 cartes). */
  untilFound?: boolean
  /** Choisir le type de carte à conserver. */
  onChoose: (cardType: CardType) => void
}

const TYPE_LABEL: Record<string, string> = {
  effect: 'Événement',
  item: 'Objet',
  ally: 'Allié',
  condition: 'Condition',
  hero: 'Héros',
  curse: 'Malédiction',
}

/**
 * Choix d'un type de carte avant révélation de la pioche.
 *  - Tombée de la nuit (Slenderman) : dévoile 4 cartes, garde la 1ʳᵉ du type.
 *  - Prédiction (Jafar) : dévoile jusqu'à trouver une carte du type, la garde.
 */
export function TypeChoiceModal({ types, untilFound = false, onChoose }: Props) {
  return (
    <ChoiceModal
      title={untilFound ? 'Prédiction' : 'Tombée de la nuit'}
      prompt={
        untilFound
          ? 'Choisissez un type : on dévoile votre pioche jusqu’à trouver une carte de ce type, vous la gardez et défaussez les autres dévoilées.'
          : 'Choisissez un type : on dévoile les 4 premières cartes de votre pioche, vous gardez la première de ce type et défaussez les autres.'
      }
      layout="row"
      options={types.map((t) => ({ key: t, label: TYPE_LABEL[t] ?? t, onSelect: () => onChoose(t) }))}
    />
  )
}

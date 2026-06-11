import type { CardType } from '../../engine/types'

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
  const title = untilFound ? 'Prédiction' : 'Tombée de la nuit'
  const desc = untilFound
    ? 'Choisissez un type : on dévoile votre pioche jusqu’à trouver une carte de ce type, vous la gardez et défaussez les autres dévoilées.'
    : 'Choisissez un type : on dévoile les 4 premières cartes de votre pioche, vous gardez la première de ce type et défaussez les autres.'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-purple-200">{title}</h2>
        <p className="text-center text-sm text-white/70">{desc}</p>
        <div className="flex w-full gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChoose(t)}
              className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-purple-950 hover:bg-amber-400"
            >
              {TYPE_LABEL[t] ?? t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

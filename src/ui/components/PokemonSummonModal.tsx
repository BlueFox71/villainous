import { getCardDef } from '../../data/registry'

interface Props {
  /** Pokémon invocables (cardId) parmi lesquels choisir. */
  candidateCardIds: string[]
  /** Le Pokémon choisi est invoqué sur le lieu du dresseur. */
  onResolve: (cardId: string) => void
}

/**
 * Team Rocket — un dresseur (Sacha/Ondine/Pierre) posé invoque l'un de ses deux
 * Pokémon (« Cherchez X ou Y et jouez-le »). Petite modale de choix : les deux
 * Pokémon ne sont pas encore sur le plateau, on les présente côte à côte.
 */
export function PokemonSummonModal({ candidateCardIds, onResolve }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/15 bg-[#120c22] p-5 text-white">
        <h2 className="text-center text-lg font-bold text-purple-200">Quel Pokémon faire apparaître ?</h2>
        <div className="flex flex-wrap justify-center gap-4">
          {candidateCardIds.map((cardId) => {
            const def = getCardDef(cardId)
            return (
              <button
                key={cardId}
                type="button"
                onClick={() => onResolve(cardId)}
                className="flex flex-col items-center gap-2 rounded-lg border border-white/20 p-2 hover:border-amber-400 hover:bg-white/10"
              >
                <img src={def?.image} alt={def?.name ?? cardId} className="w-28 rounded" />
                <span className="text-sm font-medium text-amber-200">{def?.name ?? cardId}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

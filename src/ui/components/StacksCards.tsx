import type { PlayerState } from '../../engine/types'
import { DeckPiles } from './DeckPiles'

/**
 * Bloc « stacks-cards » : les deux piles FATALITÉ d'un camp (défausse puis
 * pioche), alignées à gauche. Le zoom de la défausse s'ouvre en bas-droite.
 * Partagé entre la colonne du joueur et celle du bot (seul `player` varie).
 */
export function StacksCards({ player }: { player: PlayerState }) {
  return (
    <div className="stacks-cards flex shrink-0 gap-3">
      <DeckPiles player={player} kind="fate" show="deck" upright uprightWidth="w-16" />
      <DeckPiles player={player} kind="fate" show="discard" upright uprightWidth="w-16" zoomClass="left-0 top-full mt-1" />
    </div>
  )
}

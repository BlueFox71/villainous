import type { PlayerState } from '../../engine/types'
import { DeckPiles } from './DeckPiles'

/**
 * Bloc « stacks-cards » : les deux piles FATALITÉ d'un camp (défausse puis
 * pioche), alignées à gauche. Le zoom de la défausse s'ouvre en bas-droite.
 * Partagé entre la colonne du joueur et celle du bot (seul `player` varie).
 */
export function StacksCards({ player, playerIndex }: { player: PlayerState; playerIndex?: number }) {
  // Yzma : la pioche Fatalité unique est inutilisée (ses 4 pioches par lieu sont
  // affichées sur les lieux, cf. HeroRow). On masque donc cette grande pile, mais
  // on garde la défausse Fatalité (partagée par les 4 pioches). Pour ne RIEN décaler
  // (ni la défausse, ni la rangée des zones de Fatalité à droite), on remplace la
  // pile masquée par un espace réservé invisible de même largeur.
  const hideFateDeck = player.fateDecks !== undefined
  return (
    <div className="stacks-cards flex shrink-0 gap-3" data-fate-pile={playerIndex}>
      {hideFateDeck ? (
        <div aria-hidden className="w-16 shrink-0" />
      ) : (
        <DeckPiles player={player} kind="fate" show="deck" upright uprightWidth="w-16" />
      )}
      <DeckPiles player={player} kind="fate" show="discard" upright uprightWidth="w-16" zoomClass="left-0 top-full mt-1" />
    </div>
  )
}

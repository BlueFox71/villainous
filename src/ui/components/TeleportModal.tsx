import type { PlayerState } from '../../engine/types'
import { teleportTargets } from '../../engine/rules'
import { ChoiceModal } from './ChoiceModal'

interface Props {
  /** Joueur qui se téléporte (Slenderman). */
  player: PlayerState
  /** Déplace le pion vers le lieu choisi. */
  onResolve: (to: string) => void
}

/**
 * Téléportation : choisir le lieu (portant un Héros sans Lampe de poche) où
 * déplacer son pion.
 */
export function TeleportModal({ player, onResolve }: Props) {
  const targets = teleportTargets(player)
  const nameOf = (id: string) => player.locations.find((l) => l.id === id)?.name ?? id

  return (
    <ChoiceModal
      title="Téléportation"
      prompt="Déplacez votre pion sur un lieu portant un Héros, puis jouez-y."
      options={targets.map((to) => ({ key: to, label: nameOf(to), onSelect: () => onResolve(to) }))}
    />
  )
}

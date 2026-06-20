import type { PlayerState } from '../../engine/types'
import { ChoiceModal } from './ChoiceModal'

interface Props {
  /** Joueur dont le pion peut être déplacé (Maléfique). */
  target: PlayerState
  /** `locationId` = déplacer là ; `null` = ne pas déplacer. */
  onMove: (locationId: string | null) => void
  /** Titre = carte source (Roi Stéphane, Le Satyre, Anneau étoile…). */
  title?: string
}

/** Le joueur qui a joué la Fatalité peut déplacer le pion de la cible sur
 *  n'importe quel lieu, ou choisir de ne pas le déplacer (Roi Stéphane, Le
 *  Satyre, Anneau étoile…). */
export function PawnMoveModal({ target, onMove, title = 'Roi Stéphane' }: Props) {
  return (
    <ChoiceModal
      title={title}
      prompt={`Tu peux déplacer le pion de ${target.villainName} sur n'importe quel lieu.`}
      options={target.locations.map((loc) => ({
        key: loc.id,
        label: loc.name,
        description: loc.id === target.pawnLocation ? 'Lieu actuel du pion' : undefined,
        onSelect: () => onMove(loc.id),
      }))}
      onCancel={() => onMove(null)}
      cancelLabel="Ne pas déplacer"
    />
  )
}

import type { PlayerState } from '../../engine/types'
import { dingoSwapOptions } from '../../engine/rules'
import { ChoiceModal } from './ChoiceModal'

interface Props {
  /** Joueur (Pat Hibulaire) dont les tuiles Objectif peuvent être perturbées. */
  target: PlayerState
  /** Intervertit les tuiles des lieux `from`/`to`. */
  onResolve: (from: string, to: string) => void
  /** Ne rien faire (l'effet est facultatif). */
  onSkip: () => void
}

/**
 * Dingo (Pat Hibulaire) — le joueur qui a posé la Fatalité choisit d'intervertir
 * deux tuiles Objectif voisines, OU de déplacer une tuile vers un emplacement
 * « libre » (tuile déjà remplie). Choix par lieux (sans révéler le contenu caché).
 */
export function DingoModal({ target, onResolve, onSkip }: Props) {
  const opts = dingoSwapOptions(target)
  const name = (id: string) => target.locations.find((l) => l.id === id)?.name ?? id
  return (
    <ChoiceModal
      title="Dingo"
      prompt={`Tu peux intervertir 2 tuiles Objectif voisines de ${target.villainName}, ou déplacer une tuile vers un emplacement libre.`}
      options={opts.map((o) => ({
        key: `${o.from}>${o.to}`,
        label: o.toCompleted
          ? `Déplacer la tuile de ${name(o.from)} → ${name(o.to)} (libre)`
          : `Intervertir ${name(o.from)} ↔ ${name(o.to)}`,
        onSelect: () => onResolve(o.from, o.to),
      }))}
      onCancel={onSkip}
      cancelLabel="Ne rien faire"
      peekable
    />
  )
}

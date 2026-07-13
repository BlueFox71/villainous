import type { GameState } from '../../engine/types'
import { stonesInOpponentRealms } from '../../engine/thanos'
import { getCardDef } from '../../data/registry'

/**
 * Thanos — panneau de CAPTURE (humain). Additif et isolé : ne touche pas au flux
 * « Déplacer » partagé. Affiché pendant le tour ACTION de Thanos quand une action
 * « Déplacer un objet/allié » est disponible (`moveActionId`).
 *  - DÉPLOYER : envoyer un Allié du plateau sur un lieu adverse portant une Pierre.
 *  - RAPATRIER : ramener un Allié déployé (capture la Pierre de son lieu → Compétence).
 * Chaque geste consomme l'action « Déplacer » (côté moteur).
 */
export function ThanosCapturePanel({
  state,
  humanIndex,
  moveActionId,
  onDeploy,
  onRetrieve,
}: {
  state: GameState
  humanIndex: number
  moveActionId?: string
  onDeploy: (actionId: string, allyInstanceId: string, oppIndex: number, oppLocationId: string) => void
  onRetrieve: (actionId: string, allyInstanceId: string, to: string) => void
}) {
  const me = state.players[humanIndex]
  if (me.objective.type !== 'THANOS_STONES') return null
  const deployed = me.deployedAllies ?? []
  const stoneLocs = stonesInOpponentRealms(state, humanIndex)
  const boardAllies = me.locations.flatMap((l) =>
    (me.board[l.id] ?? [])
      .filter((c) => c.type === 'ally' && !c.attachedTo && !c.thanosAlly)
      .map((c) => ({ id: c.instanceId, name: c.name, locId: l.id })),
  )
  if (deployed.length === 0 && stoneLocs.length === 0) return null
  const homeLoc = me.pawnLocation ?? me.locations[0]?.id
  const homeName = me.locations.find((l) => l.id === homeLoc)?.name ?? homeLoc
  const disabled = !moveActionId
  const oppName = (i: number) => state.players[i]?.villainName ?? 'adversaire'
  const oppLocName = (i: number, loc: string) =>
    state.players[i]?.locations.find((l) => l.id === loc)?.name ?? loc

  return (
    <div className="flex flex-col items-stretch gap-1 rounded-md border border-amber-400/50 bg-amber-950/40 p-1.5 text-[10px] text-amber-100">
      <span className="text-center text-[9px] font-bold uppercase tracking-wide text-amber-300">
        Pierres d’Infinité
      </span>
      {disabled && (
        <span className="text-center text-[8px] text-amber-200/70">
          (utilise une action « Déplacer » pour transférer)
        </span>
      )}
      {/* RAPATRIER — capture */}
      {deployed.map((d) => (
        <button
          key={`ret-${d.ally.instanceId}`}
          type="button"
          disabled={disabled}
          onClick={() => moveActionId && onRetrieve(moveActionId, d.ally.instanceId, homeLoc)}
          className="rounded bg-amber-600/80 px-1 py-0.5 font-semibold text-white enabled:hover:bg-amber-500 disabled:opacity-40"
          title={`Rapatrier ${d.ally.name} vers ${homeName} (capture la Pierre)`}
        >
          ⟵ Rapatrier {d.ally.name} ({oppLocName(d.oppIndex, d.oppLocationId)})
        </button>
      ))}
      {/* DÉPLOYER — envoyer un Allié sur une Pierre adverse */}
      {stoneLocs.map((s) =>
        boardAllies.map((a) => (
          <button
            key={`dep-${a.id}-${s.oppIndex}-${s.locationId}`}
            type="button"
            disabled={disabled}
            onClick={() => moveActionId && onDeploy(moveActionId, a.id, s.oppIndex, s.locationId)}
            className="rounded bg-purple-700/80 px-1 py-0.5 font-semibold text-white enabled:hover:bg-purple-600 disabled:opacity-40"
            title={`Transférer ${a.name} chez ${oppName(s.oppIndex)} (${oppLocName(s.oppIndex, s.locationId)}) — ${getCardDef(s.stone.cardId)?.name}`}
          >
            {a.name} ⟶ {oppLocName(s.oppIndex, s.locationId)}
          </button>
        )),
      )}
    </div>
  )
}

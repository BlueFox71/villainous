import type { MouseEvent } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { BoardImage, LOCATIONS_LEFT } from './BoardImage'
import { Scroller } from './Scroller'

interface Props {
  player: PlayerState
  pawnOutline?: string
  onClose: () => void
}

/**
 * Vue globale (loupe) du plateau d'un joueur : l'image du plateau (pion + Héros
 * posés en haut, masquant les actions recouvertes) et, sous chaque lieu, les
 * Alliés/Objets. Un Objet associé à un Allié est groupé dans un encadré bleu.
 */
export function BoardModal({ player, pawnOutline, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <Scroller
        className="max-h-full w-full max-w-5xl rounded-2xl border border-white/15 bg-[#0b0a12] p-4"
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Plateau de {player.villainName}</h2>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
          >
            Fermer ✕
          </button>
        </div>

        {/* Plateau : pion + Héros posés en haut (masquant les actions recouvertes). */}
        <BoardImage player={player} showPawn heroesOnImage pawnOutline={pawnOutline} imgClassName="border border-white/10" />

        {/* Cartes posées, une colonne par lieu — décalées pour s'aligner sous
            les lieux de l'image (la grille démarre au bord gauche des lieux). */}
        <div className="grid grid-cols-4 gap-2" style={{ marginLeft: `${LOCATIONS_LEFT}%` }}>
          {player.locations.map((loc) => {
            const cards = player.board[loc.id] ?? []
            // Les Héros sont affichés sur l'image (en haut) ; ici on ne montre que
            // les Alliés/Objets (cartes « racine », hors objets associés).
            const roots = cards.filter((c) => c.type !== 'hero' && !c.attachedTo)
            return (
              <div key={loc.id} className="flex flex-col gap-2 rounded-lg border border-white/10 p-2">
                <h3 className="text-center text-xs font-semibold text-white/80">{loc.name}</h3>
                {roots.length === 0 && (
                  <p className="text-center text-[11px] italic text-white/30">—</p>
                )}
                {roots.map((c) => {
                  const def = getCardDef(c.cardId)
                  const attached = cards.filter((a) => a.attachedTo === c.instanceId)
                  // Allié porteur d'Objet(s) : encadré couleur groupant l'association.
                  if (attached.length > 0) {
                    return (
                      <div
                        key={c.instanceId}
                        className="flex flex-wrap items-end gap-1 rounded-lg border-2 border-sky-400 bg-sky-400/10 p-1"
                      >
                        <img src={def?.image} alt={c.name} title={c.name} className="w-20 rounded" />
                        {attached.map((a) => (
                          <img
                            key={a.instanceId}
                            src={getCardDef(a.cardId)?.image}
                            alt={a.name}
                            title={`associé : ${a.name}`}
                            className="w-14 rounded"
                          />
                        ))}
                      </div>
                    )
                  }
                  return (
                    <img
                      key={c.instanceId}
                      src={def?.image}
                      alt={c.name}
                      title={c.name}
                      className="w-20 rounded border border-white/15"
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
        </div>
      </Scroller>
    </div>
  )
}

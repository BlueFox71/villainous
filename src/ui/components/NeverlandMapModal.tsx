import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  player: PlayerState
  onResolve: (itemInstanceId: string, to: string, attachTo?: string) => void
  onCancel: () => void
}

/**
 * Carte du Pays Imaginaire — défausse-la pour jouer GRATUITEMENT un Objet de la
 * main : on choisit l'Objet, puis sa cible (un Allié/Héros pour un Objet associé,
 * sinon un lieu non bloqué).
 */
export function NeverlandMapModal({ player, onResolve, onCancel }: Props) {
  const [pickedItem, setPickedItem] = useState<string | null>(null)
  const locName = (id: string) => player.locations.find((l) => l.id === id)?.name ?? id
  const handItems = player.hand.filter((c) => c.type === 'item')
  const item = handItems.find((c) => c.instanceId === pickedItem)
  const locked = new Set(player.lockedLocations ?? [])

  // Cibles de l'étape 2 selon le type d'Objet choisi.
  const attachTargets =
    item && (item.attach === 'ally' || item.attach === 'hero')
      ? player.locations.flatMap((l) =>
          (player.board[l.id] ?? [])
            .filter((c) =>
              item.attach === 'ally' ? c.type === 'ally' && !c.isWicket : c.type === 'hero',
            )
            .map((c) => ({ card: c, loc: l.id })),
        )
      : []
  const locTargets =
    item && item.attach !== 'ally' && item.attach !== 'hero'
      ? player.locations.filter((l) => !locked.has(l.id) && (!item.playOnlyAt || item.playOnlyAt === l.id))
      : []

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#0b1408] p-6 text-white">
        <h2 className="text-xl font-black text-lime-200">Carte du Pays Imaginaire</h2>
        {!item ? (
          <>
            <p className="text-center text-sm text-white/70">
              Défaussez la Carte du Pays Imaginaire pour jouer gratuitement un Objet de votre main.
            </p>
            {handItems.length === 0 ? (
              <p className="text-sm text-white/50">Aucun Objet en main.</p>
            ) : (
              <div className="flex flex-wrap justify-center gap-3">
                {handItems.map((c) => (
                  <button
                    key={c.instanceId}
                    type="button"
                    onClick={() => setPickedItem(c.instanceId)}
                    className="rounded-lg border-2 border-white/15 p-1 transition hover:border-lime-300"
                  >
                    <img src={getCardDef(c.cardId)?.image} alt={c.name} className="h-44 w-auto rounded" />
                    <div className="mt-1 text-center text-[11px] text-white/80">{c.name}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-center text-sm text-white/70">
              <b className="text-lime-200">{item.name}</b> —{' '}
              {item.attach === 'ally' || item.attach === 'hero'
                ? `associer à ${item.attach === 'ally' ? 'un Allié' : 'un Héros'} :`
                : 'sur quel lieu ?'}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {item.attach === 'ally' || item.attach === 'hero'
                ? attachTargets.map(({ card, loc }) => (
                    <button
                      key={card.instanceId}
                      type="button"
                      onClick={() => onResolve(item.instanceId, loc, card.instanceId)}
                      className="rounded-lg border border-lime-300/60 px-3 py-2 text-xs font-bold text-lime-100 hover:bg-lime-400/20"
                    >
                      {card.name}
                      <span className="block text-white/50">{locName(loc)}</span>
                    </button>
                  ))
                : locTargets.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => onResolve(item.instanceId, l.id)}
                      className="rounded-lg border border-lime-300/60 px-4 py-2 text-sm font-bold text-lime-100 hover:bg-lime-400/20"
                    >
                      {l.name}
                    </button>
                  ))}
              {((item.attach === 'ally' || item.attach === 'hero') && attachTargets.length === 0) && (
                <span className="text-sm text-white/50">Aucune cible valide.</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPickedItem(null)}
              className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
            >
              ← Changer d'Objet
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white/60 hover:bg-white/10"
        >
          Annuler
        </button>
      </div>
    </div>,
    document.body,
  )
}

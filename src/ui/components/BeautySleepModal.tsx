import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'

interface Props {
  /** Joueur Yzma (pour lister les Héros du royaume et les lieux/voisins). */
  player: PlayerState
  /** Applique les choix (chaque option indépendante). `heroMove` null = aucun déplacement. */
  onConfirm: (
    gainPower: boolean,
    draw: boolean,
    heroMove: { heroInstanceId: string; to: string } | null,
  ) => void
}

/** Lieux voisins (non verrouillés) d'un lieu donné, selon l'ordre du plateau. */
function neighborIds(player: PlayerState, locId: string): string[] {
  const ids = player.locations.map((l) => l.id)
  const locked = new Set(player.lockedLocations ?? [])
  const i = ids.indexOf(locId)
  if (i < 0) return []
  const out: string[] = []
  if (i > 0) out.push(ids[i - 1])
  if (i < ids.length - 1) out.push(ids[i + 1])
  return out.filter((id) => !locked.has(id))
}

/**
 * Beauté endormie (Yzma) — réveil au début du tour, AVANT le déplacement. Trois
 * effets INDÉPENDANTS, chacun facultatif : gagner 2 Pouvoir, piocher 2 cartes, et
 * déplacer un Héros du royaume vers un lieu voisin. On valide ensuite et le
 * déplacement de la figurine redevient possible.
 */
export function BeautySleepModal({ player, onConfirm }: Props) {
  const [gainPower, setGainPower] = useState(true)
  const [draw, setDraw] = useState(true)
  const [heroId, setHeroId] = useState<string | null>(null)
  const [dest, setDest] = useState<string | null>(null)

  // Héros présents dans le royaume (avec leur lieu courant).
  const heroes = player.locations.flatMap((l) =>
    (player.board[l.id] ?? []).filter((c) => c.type === 'hero').map((c) => ({ card: c, locId: l.id })),
  )
  const locName = (id: string) => player.locations.find((l) => l.id === id)?.name ?? id
  const selectedHero = heroes.find((h) => h.card.instanceId === heroId)
  const dests = selectedHero ? neighborIds(player, selectedHero.locId) : []
  const heroMove = heroId && dest ? { heroInstanceId: heroId, to: dest } : null

  const pickHero = (id: string, locId: string) => {
    if (heroId === id) {
      setHeroId(null)
      setDest(null)
      return
    }
    setHeroId(id)
    // Pré-sélectionne l'unique voisin si possible (confort).
    const n = neighborIds(player, locId)
    setDest(n.length === 1 ? n[0] : null)
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#1a1226] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">Beauté endormie — réveil</h2>
        <p className="text-center text-sm text-white/70">
          Avant de vous déplacer, vous pouvez (chaque choix indépendant) :
        </p>

        {/* Options Pouvoir / Pioche. */}
        <div className="flex w-full flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
            <input type="checkbox" checked={gainPower} onChange={(e) => setGainPower(e.target.checked)} className="h-4 w-4 accent-amber-400" />
            <span className="text-sm font-semibold">Gagner <b className="text-amber-200">2 Pouvoir</b></span>
          </label>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/15 bg-white/5 px-4 py-2 hover:bg-white/10">
            <input type="checkbox" checked={draw} onChange={(e) => setDraw(e.target.checked)} className="h-4 w-4 accent-amber-400" />
            <span className="text-sm font-semibold">Piocher <b className="text-amber-200">2 cartes</b></span>
          </label>
        </div>

        {/* Déplacement d'un Héros (facultatif). */}
        <div className="w-full rounded-lg border border-white/15 bg-white/5 p-3">
          <div className="mb-2 text-sm font-semibold">
            Déplacer un Héros vers un lieu voisin <span className="text-white/50">(facultatif)</span>
          </div>
          {heroes.length === 0 ? (
            <div className="text-xs text-white/50">Aucun Héros dans votre royaume.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {heroes.map(({ card, locId }) => {
                const def = getCardDef(card.cardId)
                const isSel = heroId === card.instanceId
                return (
                  <button
                    key={card.instanceId}
                    type="button"
                    onClick={() => pickHero(card.instanceId, locId)}
                    title={`${card.name} — ${locName(locId)}`}
                    className={`relative rounded-lg border-2 p-1 transition ${
                      isSel ? 'border-amber-300 ring-2 ring-amber-300' : 'border-white/20 hover:border-amber-300/60'
                    }`}
                  >
                    {def?.image ? (
                      <img src={def.image} alt={card.name} className="h-28 w-auto rounded" />
                    ) : (
                      <span className="block px-3 py-6 text-xs">{card.name}</span>
                    )}
                    <span className="mt-1 block text-center text-[10px] text-white/60">{locName(locId)}</span>
                  </button>
                )
              })}
            </div>
          )}
          {/* Destinations voisines une fois un Héros choisi. */}
          {selectedHero && (
            <div className="mt-3">
              <div className="mb-1 text-xs text-white/60">Lieu de destination :</div>
              <div className="flex flex-wrap gap-2">
                {dests.length === 0 ? (
                  <span className="text-xs text-white/50">Aucun lieu voisin disponible.</span>
                ) : (
                  dests.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDest(id)}
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                        dest === id ? 'border-amber-300 bg-amber-400/20 text-amber-100' : 'border-white/20 hover:border-amber-300/60'
                      }`}
                    >
                      {locName(id)}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onConfirm(gainPower, draw, heroMove)}
          className="rounded-xl border border-amber-300/70 bg-amber-400/20 px-5 py-2 text-sm font-bold text-amber-100 hover:bg-amber-400/30"
        >
          Valider
        </button>
      </div>
    </div>,
    document.body,
  )
}

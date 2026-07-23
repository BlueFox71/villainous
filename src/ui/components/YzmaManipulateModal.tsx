import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { plural } from '../../engine/plural'

interface Props {
  /** Yzma (le contrôleur) : pour ses lieux, pioches et défausse Fatalité. */
  player: PlayerState
  mode: 'hero-to-decks' | 'reshuffle'
  /** Nombre maximal de pioches à mélanger. */
  count: number
  /** Le contrôleur peut refuser (« Vous pouvez »). */
  optional: boolean
  /** Héros candidats (instanceId) de la défausse Fatalité (mode `hero-to-decks`). */
  heroIds: string[]
  /** Résout : Héros choisi (ou null) + pioches à mélanger (vide + null = refuser). */
  onResolve: (heroInstanceId: string | null, locationIds: string[]) => void
}

/**
 * Yzma — Paysan / Attention au groove ! / Pacha : le joueur choisit (optionnellement)
 * un Héros de la défausse Fatalité et jusqu'à `count` pioche(s) où le mélanger, puis
 * elles sont reformées les plus égales possibles. Mode `reshuffle` (Pacha) : pas de
 * Héros, on choisit seulement les pioches à mélanger.
 */
export function YzmaManipulateModal({ player, mode, count, optional, heroIds, onResolve }: Props) {
  const [hero, setHero] = useState<string | null>(null)
  const [locs, setLocs] = useState<string[]>([])
  const heroes = player.fateDiscard.filter((c) => heroIds.includes(c.instanceId))
  const toggleLoc = (id: string) =>
    setLocs((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < count ? [...sel, id] : sel))
  const needHero = mode === 'hero-to-decks'
  const canConfirm = locs.length >= 1 && locs.length <= count && (!needHero || hero !== null)
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-white/15 bg-[#1a1226] p-6 text-white">
        <h2 className="text-xl font-black text-amber-200">
          {mode === 'reshuffle' ? 'Mélanger des pioches Fatalité' : 'Mélanger un Héros dans une pioche'}
        </h2>
        <p className="text-center text-sm text-white/70">
          {mode === 'reshuffle'
            ? `Choisissez jusqu'à ${count} ${plural(count, 'pioche')} à mélanger ensemble, puis reformées les plus égales possibles.`
            : `Choisissez un Héros de la défausse Fatalité, puis ${count > 1 ? `1 à ${count}` : 'la'} ${plural(count, 'pioche')} où le mélanger.`}
        </p>

        {needHero && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-amber-300/80">Héros de la défausse</span>
            <div className="flex flex-wrap justify-center gap-3">
              {heroes.map((c) => {
                const def = getCardDef(c.cardId)
                const sel = hero === c.instanceId
                return (
                  <button
                    key={c.instanceId}
                    type="button"
                    onClick={() => setHero((h) => (h === c.instanceId ? null : c.instanceId))}
                    title={c.name}
                    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-1 transition ${
                      sel ? 'border-amber-300 ring-2 ring-amber-300' : 'border-white/20 hover:border-amber-300/60'
                    }`}
                  >
                    {def?.image ? (
                      <img src={def.image} alt={c.name} className="h-36 w-auto rounded" />
                    ) : (
                      <span className="px-2 py-6 text-sm">{c.name}</span>
                    )}
                    <span className="text-[11px] font-bold text-amber-100">
                      {c.name} (F{c.strength ?? 0})
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-amber-300/80">
            Pioches ({locs.length}/{count})
          </span>
          <div className="flex flex-wrap justify-center gap-2">
            {player.locations.map((l) => {
              const n = (player.fateDecks?.[l.id] ?? []).length
              const sel = locs.includes(l.id)
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleLoc(l.id)}
                  className={`flex flex-col items-center rounded-lg border px-4 py-2 text-sm font-bold transition ${
                    sel
                      ? 'border-amber-300 bg-amber-400/20 text-amber-100 ring-2 ring-amber-300'
                      : 'border-amber-300/40 text-amber-100/80 hover:bg-amber-400/10'
                  }`}
                >
                  {l.name}
                  <span className="text-[10px] font-normal text-amber-200/60">{n} carte{n > 1 ? 's' : ''}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {optional && (
            <button
              type="button"
              onClick={() => onResolve(null, [])}
              className="rounded-xl border border-white/25 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Ne rien faire
            </button>
          )}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onResolve(needHero ? hero : null, locs)}
            className="rounded-xl border border-amber-300/70 bg-amber-400/20 px-5 py-2 text-sm font-bold text-amber-100 hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Valider
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

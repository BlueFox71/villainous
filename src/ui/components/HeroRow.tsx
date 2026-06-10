import { useState } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { LOCATIONS_LEFT } from './BoardImage'
import { GlowBorder } from './GlowBorder'

/**
 * Rangée des zones « Héros » par lieu (alignée sous les lieux de l'image, comme
 * la grille du méchant). Les Héros, posés par la Fatalité adverse, s'affichent
 * ici ; agrandissement au survol pour les lire.
 */
interface HeroRowProps {
  player: PlayerState
  /** Forces effectives des Héros (par instanceId). */
  strengths: Record<string, number>
  /** Héros cliquables (mode « éliminer — choix de la cible »). */
  vanquishTargets?: string[]
  onVanquishPickHero?: (instanceId: string, name: string) => void
  /** Vrai si le joueur peut payer 2 JT pour défausser un Déguisement
   *  (tour du joueur, JT suffisants). Affiche un bouton sous le Héros porteur. */
  canDiscardDeguisement?: boolean
  onDiscardDeguisement?: (instanceId: string) => void
  /** instanceIds des Héros en attente de showcase (courant + en file) — à masquer
   *  du plateau tant que leur showcase n'a pas atterri. */
  hiddenInstanceIds?: string[]
  /** instanceIds des Héros à faire clignoter en rouge (Robin des Bois quand sa
   *  pénalité prend effet). Flash one-shot. */
  redBlinkInstanceIds?: string[]
  offset?: boolean
}

export function HeroRow({
  player,
  strengths,
  vanquishTargets = [],
  onVanquishPickHero,
  canDiscardDeguisement = false,
  onDiscardDeguisement,
  hiddenInstanceIds = [],
  redBlinkInstanceIds = [],
  offset = true,
}: HeroRowProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div
      className="grid grid-cols-4 gap-2"
      style={offset ? { marginLeft: `${LOCATIONS_LEFT}%` } : undefined}
    >
      {player.locations.map((loc, index) => {
        const cellCards = player.board[loc.id] ?? []
        const heroes = cellCards.filter(
          (c) => c.type === 'hero' && !hiddenInstanceIds.includes(c.instanceId),
        )
        const previewPos =
          index === 0
            ? 'left-0'
            : index === player.locations.length - 1
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2'
        return (
          <div
            key={loc.id}
            data-hero-cell={`${player.villain}:${loc.id}`}
            className="relative flex min-h-[90px] flex-wrap items-start justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 p-2"
          >
            {/* Indicateur : contour blanc sur toute case héros contenant ≥1 Héros. */}
            {heroes.length > 0 && <GlowBorder color="#ffffff" radius={8} />}
            {heroes.map((c) => {
              const def = getCardDef(c.cardId)
              const isHovered = hovered === c.instanceId
              const attached = cellCards.filter((a) => a.attachedTo === c.instanceId)
              const locked = c.lockedPower ?? 0
              const isTarget = vanquishTargets.includes(c.instanceId)
              const deguisement = attached.find((a) => a.cardId === 'deguisement')
              return (
                <figure
                  key={c.instanceId}
                  data-hero-card={c.instanceId}
                  onMouseEnter={() => setHovered(c.instanceId)}
                  onMouseLeave={() => setHovered((h) => (h === c.instanceId ? null : h))}
                  className="relative m-0"
                  style={{ zIndex: isHovered ? 50 : 1 }}
                >
                  <div className="relative">
                    <img
                      src={def?.image}
                      alt={c.name}
                      title={`${c.name}${def ? ` — ${def.text}` : ''}`}
                      onClick={isTarget ? () => onVanquishPickHero?.(c.instanceId, c.name) : undefined}
                      className={`w-14 rounded border ${
                        isTarget
                          ? 'cursor-pointer border-red-500 ring-2 ring-red-500'
                          : 'border-white/40'
                      } ${redBlinkInstanceIds.includes(c.instanceId) ? 'red-flash' : ''}`}
                    />
                    {/* Badge MODIFICATEUR uniquement : +N (Adam de la Halle, Épée de
                        Vérité) ou −N (Sommeil sans Rêves) quand la force du Héros est
                        modifiée. Pas de badge de force « brute ». */}
                    {strengths[c.instanceId] !== undefined &&
                      strengths[c.instanceId] - (c.strength ?? 0) !== 0 && (
                        <span
                          title={`Force modifiée : ${strengths[c.instanceId] - (c.strength ?? 0) > 0 ? '+' : ''}${
                            strengths[c.instanceId] - (c.strength ?? 0)
                          } (base ${c.strength ?? '?'} → ${strengths[c.instanceId]})`}
                          className={`absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-white/40 px-1 text-[10px] font-bold text-white ${
                            strengths[c.instanceId] - (c.strength ?? 0) > 0 ? 'bg-emerald-600' : 'bg-orange-700'
                          }`}
                        >
                          {strengths[c.instanceId] - (c.strength ?? 0) > 0 ? '+' : ''}
                          {strengths[c.instanceId] - (c.strength ?? 0)}
                        </span>
                      )}
                    {locked > 0 && (
                      <span
                        title={`${locked} JT verrouillé${locked > 1 ? 's' : ''} sur cette carte (rendus au PJ si vaincu).`}
                        className="absolute -bottom-1 -left-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-white/40 bg-amber-500 px-1 text-[10px] font-bold text-purple-950"
                      >
                        🔒{locked}
                      </span>
                    )}
                    {attached.map((a, i) => (
                      <img
                        key={a.instanceId}
                        src={getCardDef(a.cardId)?.image}
                        alt={a.name}
                        title={`associé : ${a.name}`}
                        className="absolute w-8 rounded border-2 border-fuchsia-400 shadow-md"
                        style={{ right: -4 - i * 5, bottom: -2, zIndex: 5 + i }}
                      />
                    ))}
                  </div>
                  {isHovered && (
                    <div className={`absolute top-full ${previewPos} mt-1 flex w-max items-end gap-1 rounded-lg border border-white/20 bg-[#0b0a12] p-1 shadow-2xl`}>
                      <img src={def?.image} alt={c.name} className="h-[22rem] w-auto max-w-none shrink-0 rounded" />
                      {attached.map((a) => (
                        <img
                          key={a.instanceId}
                          src={getCardDef(a.cardId)?.image}
                          alt={a.name}
                          className="h-[22rem] w-auto max-w-none shrink-0 rounded border-2 border-fuchsia-400"
                        />
                      ))}
                    </div>
                  )}
                  {deguisement && canDiscardDeguisement && (
                    <button
                      onClick={() => onDiscardDeguisement?.(deguisement.instanceId)}
                      title="Défausser le Déguisement (2 JT)"
                      className="mt-0.5 w-full rounded bg-fuchsia-700 px-1 py-0.5 text-[9px] font-bold text-white hover:bg-fuchsia-600"
                    >
                      −2 JT 🗡
                    </button>
                  )}
                </figure>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

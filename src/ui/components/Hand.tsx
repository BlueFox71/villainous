import { useState } from 'react'
import type { CardInstance } from '../../engine/types'
import type { Accent } from '../accents'
import { getCardDef } from '../../data/registry'

type HandMode = 'idle' | 'play' | 'discard' | 'condition-ally'

interface Props {
  hand: CardInstance[]
  accent: Accent
  mode: HandMode
  /** Main cachée (adversaire) : on n'affiche que des dos de cartes. */
  hidden: boolean
  /** URL du dos de carte vilain (varie selon le joueur). */
  backImage: string
  power: number
  /** instanceId des Conditions actuellement déclenchables (cadre rose). */
  armedConditionIds?: string[]
  /** Si défini, force l'affichage du zoom sur la carte de cet instanceId
   *  (typiquement quand l'utilisateur survole un bouton extérieur). */
  forcedHoverId?: string | null
  /** Vrai s'il y a au moins un Allié sur le lieu courant : un Objet « à associer »
   *  n'est jouable que dans ce cas. */
  attachTargetsAvailable: boolean
  /** Vrai si les cartes Événement sont temporairement interdites (Roi Richard). */
  blockEvents: boolean
  /** Coût effectif d'une carte (Couronne −1, Bâton Magique −1 sur Événement/
   *  Malédiction, Épée de Vérité +2…). Absent → coût de base. */
  costFor?: (card: CardInstance) => number
  selectedToDiscard: string[]
  /** Si défini (Tyrannie) : la défausse est OBLIGATOIRE et doit porter EXACTEMENT
   *  ce nombre de cartes — le bouton se débloque alors seulement à ce compte, et
   *  on masque « Annuler ». */
  requiredDiscardCount?: number
  /** Disposition des cartes :
   *  - 'panel' (défaut) : rangée à plat, retour à la ligne (colonnes latérales).
   *  - 'fan' : éventail ancré en bas de l'écran (style jeu de cartes en ligne). */
  layout?: 'panel' | 'fan'
  /** Largeur (classe Tailwind) des cartes ; par défaut w-48 (éventail) / w-24 (panel). */
  cardWidthClass?: string
  onPlayCard: (instanceId: string) => void
  onToggleDiscard: (instanceId: string) => void
  onConfirmDiscard: () => void
  onCancel: () => void
}

export function Hand({
  hand,
  accent,
  mode,
  hidden,
  backImage,
  power,
  attachTargetsAvailable,
  blockEvents,
  costFor,
  armedConditionIds = [],
  forcedHoverId = null,
  selectedToDiscard,
  // requiredDiscardCount / onConfirmDiscard / onCancel : les boutons d'action
  // (Défausser / Annuler) vivent désormais dans la « actions-case » (colonne du
  // milieu) — voir App. On garde ces props dans l'interface pour ne pas casser les
  // appelants, sans les lire ici.
  layout = 'panel',
  cardWidthClass,
  onPlayCard,
  onToggleDiscard,
}: Props) {
  // instanceId de la carte survolée localement, pour l'aperçu zoom.
  const [hovered, setHovered] = useState<string | null>(null)

  const fan = layout === 'fan'

  if (hidden) {
    // Main cachée (adversaire) : on n'affiche que des dos de cartes. En éventail
    // (`fan`), on reprend la MÊME géométrie que la main du joueur (angle + arc),
    // mais sans révéler ni survol, et à la taille fixe des dos (w-24, inchangée).
    if (fan) {
      return (
        <section className="relative flex w-full flex-col items-center px-2 pb-1">
          <div className="flex items-end justify-center pt-2">
            {hand.map((ci, i) => {
              const mid = (hand.length - 1) / 2
              const off = i - mid
              const fanAngle = off * 5 // degrés par cran
              const fanLift = Math.abs(off) * Math.abs(off) * 3 // px vers le bas (arc)
              return (
                <img
                  key={ci.instanceId}
                  src={backImage}
                  alt="Carte cachée"
                  className="m-0 w-24 shrink-0 rounded-lg border border-white/10 opacity-90"
                  style={{
                    marginLeft: i === 0 ? 0 : '-2.5rem',
                    transformOrigin: 'bottom center',
                    transform: `translateY(${fanLift}px) rotate(${fanAngle}deg)`,
                    zIndex: i,
                  }}
                />
              )
            })}
          </div>
        </section>
      )
    }
    return (
      <section className={`rounded-xl border p-2 ${accent.panelIdle}`}>
        <div className="flex flex-wrap justify-center gap-1.5">
          {hand.map((ci) => (
            <img
              key={ci.instanceId}
              src={backImage}
              alt="Carte cachée"
              className="w-24 rounded-lg border border-white/10 opacity-90"
            />
          ))}
        </div>
      </section>
    )
  }

  const active = mode !== 'idle'

  return (
    <section
      className={
        fan
          ? 'relative flex w-full flex-col items-center px-2 pb-1'
          : `rounded-xl border p-2 ${active ? 'border-amber-400/70 bg-amber-400/5' : accent.panelIdle}`
      }
    >
      {/* Les boutons d'action (Défausser / Annuler) vivent désormais dans la
          « actions-case » de la colonne du milieu (voir App), pour tous les modes. */}
      <div
        className={
          fan
            ? 'flex items-end justify-center pt-2'
            : 'flex flex-wrap justify-center gap-1.5'
        }
      >
        {hand.map((ci, i) => {
          const card = getCardDef(ci.cardId)
          if (!card) return null
          // Géométrie de l'éventail : chaque carte est tournée autour de son bas,
          // d'autant plus que sa distance au centre est grande, et descend en arc.
          const mid = (hand.length - 1) / 2
          const off = i - mid
          const fanAngle = off * 5 // degrés par cran
          const fanLift = Math.abs(off) * Math.abs(off) * 3 // px vers le bas (arc)
          const baseCost = card.cost ?? 0
          const cost = costFor ? costFor(ci) : baseCost
          const isArmed = armedConditionIds.includes(ci.instanceId)
          // Un Objet à associer exige un Allié présent sur le lieu.
          const needsAlly = ci.attach === 'ally'
          const playable =
            mode === 'play'
              ? card.type !== 'condition' &&
                cost <= power &&
                (!needsAlly || attachTargetsAvailable) &&
                !(blockEvents && card.type === 'effect')
              : mode === 'condition-ally'
                ? card.type === 'ally' // Lâcheté : seuls les Alliés sont jouables, gratuit
                : false
          const checked = selectedToDiscard.includes(ci.instanceId)
          const clickable = playable || mode === 'discard'
          const dimmed = (mode === 'play' || mode === 'condition-ally') && !playable
          const onClick = playable
            ? () => onPlayCard(ci.instanceId)
            : mode === 'discard'
              ? () => onToggleDiscard(ci.instanceId)
              : undefined
          // Condition activée (jouable en réaction) : clignotant ROSE pulsé.
          const ring = playable
            ? 'border-amber-400 ring-2 ring-amber-400/60'
            : checked
              ? 'border-sky-400 ring-2 ring-sky-400/70'
              : isArmed
                ? 'border-fuchsia-400 ring-2 ring-fuchsia-400 armed-blink-rose'
                : 'border-white/15'

          const isHovered = hovered === ci.instanceId || forcedHoverId === ci.instanceId

          return (
            <figure
              key={ci.instanceId}
              data-hand-card={ci.instanceId}
              onMouseEnter={() => setHovered(ci.instanceId)}
              onMouseLeave={() => setHovered((h) => (h === ci.instanceId ? null : h))}
              className={`relative m-0 shrink-0 ${cardWidthClass ?? (fan ? 'w-36' : 'w-24')} ${dimmed ? 'opacity-40' : ''} ${
                fan ? 'transition-transform duration-150 ease-out' : ''
              }`}
              style={
                fan
                  ? {
                      marginLeft: i === 0 ? 0 : '-3.5rem',
                      transformOrigin: 'bottom center',
                      transform: isHovered
                        ? 'translateY(-3.5rem) rotate(0deg) scale(1.6)'
                        : `translateY(${fanLift}px) rotate(${fanAngle}deg)`,
                      zIndex: isHovered ? 40 : i,
                    }
                  : { zIndex: isHovered ? 30 : 0 }
              }
            >
              <img
                src={card.image}
                alt={card.name}
                title={`${card.name} — ${card.text}`}
                onClick={onClick}
                className={`w-full rounded-lg border ${clickable ? 'cursor-pointer' : ''} ${ring}`}
              />
              {cost !== baseCost && (
                <span
                  title="Coût modifié (Couronne / Bâton Magique / Épée de Vérité)"
                  className={`absolute left-1 top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-white/40 px-1 text-[10px] font-bold text-white ${
                    cost < baseCost ? 'bg-emerald-600' : 'bg-orange-700'
                  }`}
                >
                  {cost}
                </span>
              )}
              {checked && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
                  ✓
                </span>
              )}
              {/* Aperçu zoom au survol — même effet que sur le plateau.
                  En éventail, la carte se relève déjà : pas d'aperçu géant. */}
              {isHovered && !fan && (
                <div className="absolute bottom-full left-1/2 mb-1 flex w-max -translate-x-1/2 rounded-lg border border-white/20 bg-[#0b0a12] p-1 shadow-2xl">
                  <img src={card.image} alt={card.name} className="h-[22rem] w-auto max-w-none shrink-0" />
                </div>
              )}
            </figure>
          )
        })}
      </div>
    </section>
  )
}

import type { PlayerState } from '../../engine/types'
import type { Accent } from '../accents'
import { useAnimatedNumber } from '../hooks/useAnimatedNumber'
import { getCardDef } from '../../data/registry'
import { VILLAIN_COLOR } from '../villainColors'

interface Props {
  player: PlayerState
  accent: Accent
  isActive: boolean
  isWinner: boolean
  /** Affiche la case objectif dans le panneau (défaut). La passer à `false`
   *  quand l'objectif est rendu ailleurs (cf. `ObjectiveBox`, bande du bas). */
  showObjective?: boolean
}

/** En-tête d'un camp : nom + jetons de pouvoir (+ objectif si `showObjective`).
 *  L'objectif lui-même est rendu par `ObjectiveBox`, réutilisable hors panneau. */
export function PlayerPanel({ player, accent, isActive, isWinner, showObjective = true }: Props) {
  const displayedPower = useAnimatedNumber(player.power)
  // Fond teinté à la couleur du méchant (plus marqué quand c'est son tour).
  const color = VILLAIN_COLOR[player.villain]
  return (
    <div
      className={`player rounded-xl border-2 px-4 py-5 shadow-lg backdrop-blur-sm transition-colors ${isActive ? accent.panelActive : accent.panelIdle}`}
      style={
        color
          ? {
              backgroundColor: `${color}${isActive ? '4d' : '33'}`,
              // Contour à la couleur du méchant (éclaircie pour rester visible).
              borderColor: `color-mix(in srgb, ${color}, white ${isActive ? '55%' : '35%'})`,
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className={`truncate text-lg font-semibold ${accent.title}`}>{player.villainName}</h2>
        {isWinner && <span className="shrink-0 text-lg">🏆</span>}
      </div>

      <div className="mt-2 flex items-stretch gap-2">
        {/* Case jetons de pouvoir (à gauche). Sans l'objectif, elle s'étire. */}
        <div
          className={`flex flex-col items-center justify-center rounded-lg border border-white/15 bg-black/20 px-5 py-3 ${
            showObjective ? '' : 'flex-1'
          }`}
          title="Jetons de pouvoir"
        >
          <span className="-mt-1.5 text-[9px] uppercase tracking-wide text-white/40">Jetons</span>
          <span className="flex items-center gap-1.5 text-3xl font-bold text-amber-100">
            <img src="/jeton_pouvoir.png" alt="" className="h-9 w-9 rounded-full" />
            {displayedPower}
          </span>
        </div>

        {/* Case objectif (à droite) — masquable quand rendue ailleurs. */}
        {showObjective && <ObjectiveBox player={player} accent={accent} isWinner={isWinner} />}
      </div>
    </div>
  )
}

/** Case « objectif » d'un camp : progression selon le type d'objectif. Extraite
 *  de `PlayerPanel` pour pouvoir être affichée séparément (ex. bande du bas). */
export function ObjectiveBox({
  player,
  accent,
  isWinner,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
}) {
  return (
    <div className="flex flex-1 flex-col justify-center rounded-lg border border-white/15 bg-black/20 px-3 py-1">
      {player.objective.type === 'POWER_THRESHOLD' ? (
        <PowerThresholdProgress
          player={player}
          accent={accent}
          isWinner={isWinner}
          threshold={player.objective.threshold}
        />
      ) : player.objective.type === 'CARDS_IN_REALM' ? (
        <CardsInRealmProgress
          player={player}
          accent={accent}
          isWinner={isWinner}
          cardId={player.objective.cardId}
          count={player.objective.count}
          label="Pages"
        />
      ) : player.objective.type === 'CONTROL_HERO' ? (
        <ControlHeroProgress
          player={player}
          accent={accent}
          isWinner={isWinner}
          heroCardId={player.objective.heroCardId}
          itemCardId={player.objective.itemCardId}
          itemLocationId={player.objective.itemLocationId}
        />
      ) : player.objective.type === 'ROYAL_CROQUET' ? (
        <RoyalCroquetProgress player={player} accent={accent} isWinner={isWinner} />
      ) : player.objective.type === 'DEFEAT_HERO_AT_LOCATION' ? (
        <DefeatHeroProgress
          player={player}
          accent={accent}
          isWinner={isWinner}
          heroCardId={player.objective.heroCardId}
          locationId={player.objective.locationId}
        />
      ) : player.objective.type === 'ITEMS_AT_LOCATION' ? (
        <ItemsAtLocationProgress
          player={player}
          accent={accent}
          isWinner={isWinner}
          itemCardIds={player.objective.itemCardIds}
          locationId={player.objective.locationId}
        />
      ) : player.objective.type === 'UNTRAPPED_TITANS_AT_LOCATION' ? (
        <TitansAtLocationProgress
          player={player}
          accent={accent}
          isWinner={isWinner}
          locationId={player.objective.locationId}
          count={player.objective.count}
        />
      ) : player.objective.type === 'REIGN_NEW_ORLEANS' ? (
        <ReignProgress player={player} accent={accent} isWinner={isWinner} />
      ) : player.objective.type === 'DEPLETE_OBSERVATORY_AND_CAPTURE' ? (
        <DepleteObservatoryProgress
          player={player}
          accent={accent}
          isWinner={isWinner}
          blockerHeroCardId={player.objective.blockerHeroCardId}
        />
      ) : player.objective.type === 'KEEP_SABOTAGE' ? (
        <SabotageProgress
          player={player}
          accent={accent}
          isWinner={isWinner}
          turns={player.objective.turns}
        />
      ) : (
        <CurseEachLocationProgress player={player} accent={accent} isWinner={isWinner} />
      )}
    </div>
  )
}

function PowerThresholdProgress({
  player,
  accent,
  isWinner,
  threshold,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
  threshold: number
}) {
  const animated = useAnimatedNumber(player.power)
  const pct = Math.min(100, (animated / threshold) * 100)
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>Objectif</span>
        <span className="font-mono text-white">
          {animated} / {threshold}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isWinner ? 'bg-amber-400' : accent.gauge}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  )
}

function CardsInRealmProgress({
  player,
  accent,
  isWinner,
  cardId,
  count,
  label,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
  cardId: string
  count: number
  label: string
}) {
  const have = player.locations.reduce(
    (n, loc) => n + (player.board[loc.id] ?? []).filter((c) => c.cardId === cardId && !c.attachedTo).length,
    0,
  )
  const animated = useAnimatedNumber(have)
  const pct = Math.min(100, (animated / count) * 100)
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>{label}</span>
        <span className="font-mono text-white">
          {animated} / {count}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isWinner ? 'bg-amber-400' : accent.gauge}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  )
}

function TitansAtLocationProgress({
  player,
  accent,
  isWinner,
  locationId,
  count,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
  locationId: string
  count: number
}) {
  // Hadès : Titans NON entravés présents sur le lieu cible (Mont Olympe).
  const have = (player.board[locationId] ?? []).filter((c) => c.isTitan && !c.trapped).length
  const animated = useAnimatedNumber(have)
  const pct = Math.min(100, (animated / count) * 100)
  const locName = player.locations.find((l) => l.id === locationId)?.name ?? locationId
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>Titans · {locName}</span>
        <span className="font-mono text-white">
          {animated} / {count}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isWinner ? 'bg-amber-400' : accent.gauge}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  )
}

function ReignProgress({
  player,
  accent,
  isWinner,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
}) {
  // Dr Facilier : étapes vers la victoire (Talisman détenu, Régner dans l'Au-delà,
  // Divination prête à être jouée au Royaume du vaudou).
  const all = Object.values(player.board).flat()
  const talisman = all.some((c) => c.cardId === 'talisman' && !c.attachedTo)
  const regner = player.auDela.some((c) => c.cardId === 'regner-nouvelle-orleans')
  const divReady = player.hand.some((c) => c.cardId === 'divination-facilier')
  const steps = [
    { ok: talisman, title: 'Détenir le Talisman' },
    { ok: regner, title: 'Régner dans la Pile de l’Au-delà' },
    { ok: divReady, title: 'Divination en main' },
  ]
  const done = steps.filter((s) => s.ok).length
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>Au-delà</span>
        <span className="font-mono text-white">{done} / {steps.length}</span>
      </div>
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <div
            key={i}
            title={s.title}
            className={`h-2 flex-1 rounded-full ${
              s.ok ? (isWinner ? 'bg-amber-400' : accent.gauge) : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </>
  )
}

function ControlHeroProgress({
  player,
  accent,
  isWinner,
  heroCardId,
  itemCardId,
  itemLocationId,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
  heroCardId: string
  itemCardId: string
  itemLocationId: string
}) {
  const controls = Object.values(player.board)
    .flat()
    .some((c) => c.type === 'hero' && c.cardId === heroCardId && c.hypnotized)
  const itemPlaced = (player.board[itemLocationId] ?? []).some((c) => c.cardId === itemCardId)
  const heroName = getCardDef(heroCardId)?.name ?? 'Héros'
  const itemName = getCardDef(itemCardId)?.name ?? 'Objet'
  const locName = player.locations.find((l) => l.id === itemLocationId)?.name ?? itemLocationId
  const steps = [
    { ok: controls, title: `${heroName} sous Hypnose` },
    { ok: itemPlaced, title: `${itemName} au ${locName}` },
  ]
  const done = steps.filter((s) => s.ok).length
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>Objectif</span>
        <span className="font-mono text-white">{done} / {steps.length}</span>
      </div>
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <div
            key={i}
            title={s.title}
            className={`h-2 flex-1 rounded-full ${
              s.ok ? (isWinner ? 'bg-amber-400' : accent.gauge) : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </>
  )
}

function DepleteObservatoryProgress({
  player,
  accent,
  isWinner,
  blockerHeroCardId,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
  blockerHeroCardId?: string
}) {
  // Bowser : épuiser l'Observatoire (0 Étoile) ET capturer Peach. Mario présent
  // (blockerHeroCardId) interdit la victoire tant qu'il est là.
  const stars = player.observatoryStars ?? 0
  const depleted = stars <= 0
  const captured = !!player.peachCaptured
  const blocked = blockerHeroCardId
    ? Object.values(player.board)
        .flat()
        .some((c) => c.type === 'hero' && c.cardId === blockerHeroCardId)
    : false
  const steps = [
    { ok: depleted, title: depleted ? 'Observatoire épuisé' : `Observatoire : ${stars} Étoile${stars > 1 ? 's' : ''}` },
    { ok: captured, title: captured ? 'Peach capturée' : 'Peach non capturée' },
  ]
  const done = steps.filter((s) => s.ok).length
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>
          {blocked ? '⛔ Mario présent' : 'Objectif'}
        </span>
        <span className="font-mono text-white">{done} / {steps.length}</span>
      </div>
      <div className="flex gap-1">
        {steps.map((s, i) => (
          <div
            key={i}
            title={s.title}
            className={`h-2 flex-1 rounded-full ${
              s.ok && !blocked ? (isWinner ? 'bg-amber-400' : accent.gauge) : s.ok ? 'bg-white/40' : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </>
  )
}

/** L'Imposteur — objectif « conserver un Sabotage `turns` tours ». Affiche si un
 *  Sabotage (O2 / Réacteur) est posé et la progression du compte à rebours. */
function SabotageProgress({
  player,
  accent,
  isWinner,
  turns,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
  turns: number
}) {
  const sabotage = Object.values(player.board)
    .flat()
    .find((c) => (c.cardId === 'sabotage-o2' || c.cardId === 'sabotage-reacteur') && !c.attachedTo)
  const elapsed = sabotage?.sabotageTurns ?? 0
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>Sabotage</span>
        <span className="font-mono text-white">
          {sabotage ? `${elapsed} / ${turns} tours` : 'Aucun'}
        </span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: turns }).map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full ${
              i < elapsed ? (isWinner ? 'bg-amber-400' : accent.gauge) : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </>
  )
}

function RoyalCroquetProgress({
  player,
  accent,
  isWinner,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
}) {
  // Un arceau (Carte Garde transformée) par lieu = condition du Coup Royal.
  const filled = player.locations.map((loc) =>
    (player.board[loc.id] ?? []).some((c) => c.isWicket),
  )
  const done = filled.filter(Boolean).length
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>Arceaux</span>
        <span className="font-mono text-white">{done} / {filled.length}</span>
      </div>
      <div className="flex gap-1">
        {filled.map((ok, i) => (
          <div
            key={i}
            title={player.locations[i].name}
            className={`h-2 flex-1 rounded-full ${
              ok ? (isWinner ? 'bg-amber-400' : accent.gauge) : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </>
  )
}

function DefeatHeroProgress({
  player,
  accent,
  isWinner,
  heroCardId,
  locationId,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
  heroCardId: string
  locationId: string
}) {
  const heroName = getCardDef(heroCardId)?.name ?? 'Héros'
  const targetLoc = player.locations.find((l) =>
    (player.board[l.id] ?? []).some((c) => c.type === 'hero' && c.cardId === heroCardId),
  )
  const targetName = player.locations.find((l) => l.id === locationId)?.name ?? locationId
  // 0 = pas dans le royaume ; 1 = présent ailleurs ; 2 = sur le lieu cible.
  const step = !targetLoc ? 0 : targetLoc.id === locationId ? 2 : 1
  const status = step === 0 ? 'Hors-jeu' : step === 1 ? targetLoc!.name : `✓ ${targetName}`
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>{heroName}</span>
        <span className="font-mono text-white">{status}</span>
      </div>
      <div className="flex gap-1">
        {[0, 1].map((i) => (
          <div
            key={i}
            title={i === 0 ? 'Peter Pan dans le royaume' : `Peter Pan sur ${targetName}`}
            className={`h-2 flex-1 rounded-full ${
              step > i ? (isWinner ? 'bg-amber-400' : accent.gauge) : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </>
  )
}

function ItemsAtLocationProgress({
  player,
  accent,
  isWinner,
  itemCardIds,
  locationId,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
  itemCardIds: string[]
  locationId: string
}) {
  const cell = player.board[locationId] ?? []
  const locName = player.locations.find((l) => l.id === locationId)?.name ?? locationId
  const atLoc = itemCardIds.filter((id) => cell.some((c) => c.cardId === id && !c.attachedTo)).length
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>{locName}</span>
        <span className="font-mono text-white">{atLoc} / {itemCardIds.length}</span>
      </div>
      <div className="flex gap-1">
        {itemCardIds.map((id) => {
          const ok = cell.some((c) => c.cardId === id && !c.attachedTo)
          return (
            <div
              key={id}
              title={getCardDef(id)?.name ?? id}
              className={`h-2 flex-1 rounded-full ${ok ? (isWinner ? 'bg-amber-400' : accent.gauge) : 'bg-white/15'}`}
            />
          )
        })}
      </div>
    </>
  )
}

function CurseEachLocationProgress({
  player,
  accent,
  isWinner,
}: {
  player: PlayerState
  accent: Accent
  isWinner: boolean
}) {
  const filled = player.locations.map((loc) =>
    (player.board[loc.id] ?? []).some((c) => c.type === 'curse'),
  )
  const done = filled.filter(Boolean).length
  return (
    <>
      <div className="mb-1 flex justify-between text-sm">
        <span className={accent.accentText}>Malédictions</span>
        <span className="font-mono text-white">{done} / {filled.length}</span>
      </div>
      <div className="flex gap-1">
        {filled.map((ok, i) => (
          <div
            key={i}
            title={player.locations[i].name}
            className={`h-2 flex-1 rounded-full ${
              ok ? (isWinner ? 'bg-amber-400' : accent.gauge) : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </>
  )
}

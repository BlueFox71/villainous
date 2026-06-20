import { useEffect, useRef, useState } from 'react'
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
  /** instanceId de la carte en cours de sélection : garde un cadre jaune le temps
   *  de choisir la cible/destination (modes « poser », « associer », cibler…). */
  selectedCardId?: string | null
  /** Si défini, force l'affichage du zoom sur la carte de cet instanceId
   *  (typiquement quand l'utilisateur survole un bouton extérieur). */
  forcedHoverId?: string | null
  /** Vrai s'il y a au moins un Allié sur le lieu courant : un Objet « à associer »
   *  n'est jouable que dans ce cas. */
  attachTargetsAvailable: boolean
  /** Vrai si les cartes Événement sont temporairement interdites (Roi Richard). */
  blockEvents: boolean
  /** Vrai s'il y a au moins un Allié dans le royaume — une carte « gain par Allié »
   *  (Joyeux non-anniversaire) est injouable sinon. */
  realmHasAllies: boolean
  /** Vrai s'il y a au moins un Héros dans le royaume — une carte « gain par Héros »
   *  (Magnifiques Taxes) est injouable sinon. */
  realmHasHeroes: boolean
  /** Vrai s'il y a au moins un Ingrédient joué (zone Ingrédients) PAYABLE — Foudre
   *  est injouable sinon (rien de reproductible : son coût = celui de l'Ingrédient). */
  hasIngredients: boolean
  /** Vrai s'il y a au moins un Héros sur le lieu du pion — « Je vais vous broyer
   *  les os ! » est injouable sinon. */
  heroAtPawn: boolean
  /** Vrai s'il existe un Héros éliminable sur le lieu du pion (assez de Poison,
   *  priorité Prof) — « Croque ! » est injouable sinon. */
  canBite: boolean
  /** Vrai s'il y a au moins une Hyène dans le royaume — Festin (Scar) est
   *  injouable sinon. */
  realmHasHyena: boolean
  /** Vrai s'il y a au moins une Hyène sur un AUTRE lieu que celui du pion —
   *  « Suivez-moi ! » (Scar) est injouable sinon. */
  hyenaElsewhere: boolean
  /** Vrai s'il y a au moins un Héros ou Événement dans la défausse Fatalité —
   *  « Petit secret » (Scar) est injouable sinon. */
  fateDiscardHasCard: boolean
  /** Vrai si une action « réelle » (hors marqueurs) a déjà été utilisée ce tour —
   *  Beauté endormie (Yzma) n'est jouable qu'en PREMIÈRE action, donc injouable
   *  ensuite. */
  realActionUsed: boolean
  /** Vrai s'il y a au moins un jeton Pouvoir sur Kronk — « Le chemin qui balance »
   *  (Yzma) est injouable sinon (elle n'aurait aucun effet). */
  kronkHasPowerToken: boolean
  /** Vrai s'il y a au moins un Héros dans la défausse Fatalité — « Fausses
   *  funérailles » (Yzma) est injouable sinon (0 jeton gagné). */
  fateDiscardHasHero: boolean
  /** Vrai si « Ironie du sort » (Yzma) ferait quelque chose : un Allié sur le lieu
   *  du pion ET un Événement de la défausse abordable une fois Ironie payée. Sinon
   *  la carte est injouable (elle gaspillerait du Pouvoir). */
  poeticJusticeUsable: boolean
  /** Vrai s'il existe un Héros déplaçable (Capture, effet MOVE_REALM_HERO_TO) :
   *  force ≤ max, sur un AUTRE lieu que la destination, accepté par celle-ci. La
   *  carte est injouable sinon (aucun effet). */
  relocateTargetAvailable: boolean
  /** Vrai s'il existe un Héros à pirater (Boop !, non déjà piraté). Sinon la carte
   *  est injouable. */
  hackTargetAvailable: boolean
  /** Vrai si le pion est sur le lieu de Raiponce (Mère Gothel) — un Événement
   *  « Je t'aime bien plus » est injouable sinon (il n'aurait aucun effet). */
  pawnWithRaiponce: boolean
  /** Vrai s'il existe une carte récupérable dans la défausse (Le diable l'emporte :
   *  Objet ou Événement). La carte est injouable sinon. */
  recoverFromDiscardAvailable: boolean
  /** Vrai s'il existe une capacité activable dans le royaume (Finissez le travail !).
   *  La carte est injouable sinon. */
  hasActivatableCard: boolean
  /** Gaston — vrai si Gaston peut RETIRER un Obstacle (au moins un présent ET Belle
   *  pas dans le royaume). Les cartes dont le seul effet est de retirer un Obstacle
   *  (Très mauvais caractère, Laissez-moi vous regarder, Sortez !) sont injouables sinon. */
  canRemoveObstacle?: boolean
  /** Gaston — vrai s'il reste de la place pour REPLACER un Obstacle (< 8). Sous le
   *  charme est injouable sinon (règle officielle : pas de place pour replacer). */
  canReplaceObstacle?: boolean
  /** Gaston — vrai s'il existe un Allié/Objet (non associé) déplaçable. « Tous avec
   *  moi ! » est injouable sinon. */
  realmHasMovableCard?: boolean
  /** Gaston — vrai si la Bête OU Belle est dans le royaume. « Montre-moi la Bête ! »
   *  est injouable sinon (aucun effet). */
  showMeBeastUsable?: boolean
  /** Le Seigneur des clés — vrai s'il y a au moins une clé sur le lieu du pion.
   *  Toute Puissance / C'est moi qui décide / Pierre tombale sont injouables sinon. */
  keyAtPawn?: boolean
  /** Le Seigneur des clés — vrai s'il y a au moins une clé posée sur le plateau.
   *  00:00 est injouable sinon (aucune clé à prendre au dé). */
  keysOnBoard?: boolean
  /** Le Seigneur des clés — vrai s'il possède au moins une clé. Répondez ! est
   *  injouable sinon (0 Pouvoir gagné). */
  ownsKey?: boolean
  /** Madame de Trémaine — cardId présents dans le royaume (pour griser un Allié « en
   *  robe de bal » dont la version ordinaire n'est pas en jeu). */
  realmCardIds?: string[]
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
  realmHasAllies,
  realmHasHeroes,
  hasIngredients,
  heroAtPawn,
  canBite,
  realmHasHyena,
  hyenaElsewhere,
  fateDiscardHasCard,
  realActionUsed,
  kronkHasPowerToken,
  fateDiscardHasHero,
  poeticJusticeUsable,
  relocateTargetAvailable,
  hackTargetAvailable,
  pawnWithRaiponce,
  recoverFromDiscardAvailable,
  hasActivatableCard,
  canRemoveObstacle = true,
  canReplaceObstacle = true,
  realmHasMovableCard = true,
  showMeBeastUsable = true,
  keyAtPawn = true,
  keysOnBoard = true,
  ownsKey = true,
  realmCardIds,
  costFor,
  armedConditionIds = [],
  forcedHoverId = null,
  selectedCardId = null,
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

  // Apparition « carte par carte » : on repère les cartes nouvellement ajoutées à
  // la main (pioche) et on leur attribue un rang → délai d'entrée échelonné, calé
  // sur le vol des dos de cartes (≈110 ms d'écart, ~500 ms de vol). `enterDelays`
  // mappe instanceId → délai (ms) ; vidé une fois les entrées terminées.
  const prevIdsRef = useRef<string[]>(hand.map((c) => c.instanceId))
  const [enterDelays, setEnterDelays] = useState<Record<string, number>>({})
  useEffect(() => {
    const prev = prevIdsRef.current
    const cur = hand.map((c) => c.instanceId)
    const added = cur.filter((id) => !prev.includes(id))
    prevIdsRef.current = cur
    if (added.length === 0) return
    setEnterDelays((m) => {
      const next = { ...m }
      added.forEach((id, k) => {
        next[id] = 480 + k * 110 // ≈ vol du dos + décalage par carte
      })
      return next
    })
    const clear = window.setTimeout(
      () =>
        setEnterDelays((m) => {
          const n = { ...m }
          added.forEach((id) => delete n[id])
          return n
        }),
      480 + added.length * 110 + 400,
    )
    return () => window.clearTimeout(clear)
  }, [hand])

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
          // Joyeux non-anniversaire (gain par Allié) : injouable sans Allié au royaume.
          const needsAllyInRealm = (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_ALLY_IN_REALM')
          // Magnifiques Taxes (gain par Héros) / Cruelle diablesse (déplace un Héros) :
          // injouable sans Héros au royaume. Gaston — Belle est à moi (action gratuite
          // « Éliminer un Héros ») : idem, injouable sans Héros à cibler.
          const needsHeroInRealm = (card.effects ?? []).some(
            (e) =>
              e.type === 'GAIN_POWER_PER_HERO_IN_REALM' ||
              e.type === 'RELOCATE_OWN_HERO' ||
              (e.type === 'GRANT_FREE_ACTION' && e.actionType === 'VANQUISH') ||
              // Le Seigneur des clés — Banni ! (déplace un Héros) / Souffre-douleur
              // (réduit la force d'un Héros) : sans Héros au royaume, aucun effet.
              e.type === 'MOVE_HERO_TO_LOCATION' ||
              e.type === 'REDUCE_HERO_STRENGTH_TEMP' ||
              // Madame de Trémaine — Piège : sans Héros à piéger, aucun effet.
              e.type === 'TRAP_HERO',
          )
          // Madame de Trémaine — Allié « en robe de bal » : injouable si sa version
          // ordinaire (`replacesCardId`) n'est pas en jeu.
          const needsReplaceTarget = !!ci.replacesCardId
          const replaceOk = !needsReplaceTarget || (realmCardIds ?? []).includes(ci.replacesCardId!)
          // Foudre (duplique un Ingrédient) : injouable sans Ingrédient joué PAYABLE
          // (son coût = celui de l'Ingrédient reproduit ; cf. prop hasIngredients).
          const needsIngredient = (card.effects ?? []).some((e) => e.type === 'DUPLICATE_INGREDIENT')
          // « Je vais vous broyer les os ! » : injouable sans Héros sur le lieu du pion.
          const needsHeroHere = (card.effects ?? []).some((e) => e.type === 'USE_COVERED_ACTIONS_THIS_TURN')
          // « Croque ! » : injouable sans Héros éliminable sur le lieu du pion.
          const needsBite = (card.effects ?? []).some((e) => e.type === 'TAKE_A_BITE')
          // Festin (Scar) : injouable sans Hyène dans le royaume.
          const needsHyena = !!card.requiresHyenaInRealm
          // Suivez-moi ! (Scar) : injouable sans Hyène sur un autre lieu que le pion.
          const needsHyenaElsewhere = (card.effects ?? []).some((e) => e.type === 'FOLLOW_ME')
          // Petit secret (Scar) : injouable si la défausse Fatalité est vide.
          const needsFateDiscard = (card.effects ?? []).some((e) => e.type === 'PLAY_FATE_HERO_FROM_DISCARD')
          // Beauté endormie (Yzma) : jouable uniquement en PREMIÈRE action du tour.
          const needsFirstAction = (card.effects ?? []).some((e) => e.type === 'BEAUTY_SLEEP')
          // Le chemin qui balance (Yzma) : injouable sans jeton Pouvoir sur Kronk.
          const needsKronkToken = (card.effects ?? []).some((e) => e.type === 'KRONK_DISCARD_TOKENS')
          // Fausses funérailles (Yzma) : injouable sans Héros en défausse Fatalité.
          const needsFateDiscardHero = (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_FATE_DISCARD_HERO')
          // Ironie du sort (Yzma) : injouable sans Allié sur le lieu / sans Événement
          // abordable en défausse (elle gaspillerait sinon du Pouvoir).
          const needsPoeticJustice = (card.effects ?? []).some((e) => e.type === 'POETIC_JUSTICE')
          // Capture (Ratigan) : injouable sans Héros déplaçable hors de la destination.
          const needsRelocateTarget = (card.effects ?? []).some((e) => e.type === 'MOVE_REALM_HERO_TO')
          // Boop ! (Sombra) : injouable sans Héros à pirater (aucun, ou tous déjà piratés).
          const needsHackTarget = (card.effects ?? []).some((e) => e.type === 'HACK_HERO')
          // « Je t'aime bien plus » (Gothel) : Événement injouable si le pion n'est pas
          // sur le lieu de Raiponce (il n'aurait aucun effet). La Brosse à cheveux
          // (Objet) reste jouable : elle se pose et pourra rejoindre Raiponce plus tard.
          const needsPawnWithRaiponce =
            card.type === 'effect' && (card.effects ?? []).some((e) => e.type === 'GAIN_CONFIANCE_WITH_RAIPONCE')
          // Le diable l'emporte (Cruella) : injouable sans carte récupérable en défausse.
          const needsRecoverTarget = (card.effects ?? []).some((e) => e.type === 'RECOVER_FROM_DISCARD_CHOICE')
          // Finissez le travail ! (Cruella) : injouable sans capacité activable.
          const needsActivatable = (card.effects ?? []).some((e) => e.type === 'GRANT_FREE_ACTIVATE')
          // Gaston — cartes dont le SEUL effet est de retirer des Obstacles (Très mauvais
          // caractère, Laissez-moi vous regarder, Sortez !) : injouables si Belle bloque
          // ou s'il ne reste aucun Obstacle.
          const cardFx = card.effects ?? []
          const needsRemoveObstacle = cardFx.length > 0 && cardFx.every((e) => e.type === 'REMOVE_OBSTACLE')
          // Sous le charme : injouable si les 8 Obstacles sont déjà posés (rien à replacer).
          const needsReplaceObstacle = cardFx.some((e) => e.type === 'REPLACE_OBSTACLE')
          // Tous avec moi ! : injouable sans Allié/Objet déplaçable.
          const needsMovableCard = cardFx.some((e) => e.type === 'GRANT_FREE_ACTION' && e.actionType === 'MOVE_ITEM_ALLY')
          // Montre-moi la Bête ! : injouable si ni la Bête ni Belle dans le royaume.
          const needsShowMeBeast = cardFx.some((e) => e.type === 'SHOW_ME_THE_BEAST')
          // Le Seigneur des clés — Toute Puissance / C'est moi qui décide / Pierre tombale :
          // injouables sans clé sur le lieu du pion. 00:00 : injouable sans clé sur le plateau.
          const needsKeyAtPawn = cardFx.some((e) => e.type === 'TAKE_KEY_AT_PAWN' || e.type === 'ROLL_DIE_TAKE_KEY_AT_PAWN')
          const needsKeysOnBoard = cardFx.some((e) => e.type === 'CHOOSE_COLOR_ROLL_TAKE_KEY' || e.type === 'ROLL_DIE_TAKE_KEY_FROM_BOARD')
          // Cartes qui exigent une clé POSSÉDÉE : Répondez ! (0 Pouvoir sinon),
          // Trop facile / Plus qu'une minute (« perdez une clé de votre choix »).
          const needsOwnedKey = cardFx.some(
            (e) => e.type === 'GAIN_POWER_PER_KEY_COLOR' || e.type === 'LOSE_KEY_GAIN_POWER' || e.type === 'LOSE_KEY_DRAW',
          )
          const playable =
            mode === 'play'
              ? card.type !== 'condition' &&
                cost <= power &&
                (!needsAlly || attachTargetsAvailable) &&
                (!needsAllyInRealm || realmHasAllies) &&
                (!needsHeroInRealm || realmHasHeroes) &&
                (!needsIngredient || hasIngredients) &&
                (!needsHeroHere || heroAtPawn) &&
                (!needsBite || canBite) &&
                (!needsHyena || realmHasHyena) &&
                (!needsHyenaElsewhere || hyenaElsewhere) &&
                (!needsFateDiscard || fateDiscardHasCard) &&
                (!needsFirstAction || !realActionUsed) &&
                (!needsKronkToken || kronkHasPowerToken) &&
                (!needsFateDiscardHero || fateDiscardHasHero) &&
                (!needsPoeticJustice || poeticJusticeUsable) &&
                (!needsRelocateTarget || relocateTargetAvailable) &&
                (!needsHackTarget || hackTargetAvailable) &&
                (!needsPawnWithRaiponce || pawnWithRaiponce) &&
                (!needsRecoverTarget || recoverFromDiscardAvailable) &&
                (!needsActivatable || hasActivatableCard) &&
                (!needsRemoveObstacle || canRemoveObstacle) &&
                (!needsReplaceObstacle || canReplaceObstacle) &&
                (!needsMovableCard || realmHasMovableCard) &&
                (!needsShowMeBeast || showMeBeastUsable) &&
                (!needsKeyAtPawn || keyAtPawn) &&
                (!needsKeysOnBoard || keysOnBoard) &&
                (!needsOwnedKey || ownsKey) &&
                replaceOk &&
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
          // Carte en cours de sélection (on choisit sa cible) → cadre jaune maintenu.
          const isSelected = selectedCardId === ci.instanceId
          // Condition activée (jouable en réaction) : clignotant ROSE pulsé.
          const ring = isSelected
            ? 'border-amber-400 ring-2 ring-amber-400/80'
            : playable
              ? 'border-amber-400 ring-2 ring-amber-400/60'
              : checked
                ? 'border-sky-400 ring-2 ring-sky-400/70'
                : isArmed
                  ? 'border-fuchsia-400 ring-2 ring-fuchsia-400 armed-blink-rose'
                  : 'border-white/15'

          const isHovered = hovered === ci.instanceId || forcedHoverId === ci.instanceId
          // Carte fraîchement piochée : entrée en fondu échelonnée (opacité seule).
          const enterDelay = enterDelays[ci.instanceId]
          const enterAnim =
            enterDelay !== undefined ? `handDeal 260ms ease-out ${enterDelay}ms both` : undefined

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
                      animation: enterAnim,
                    }
                  : { zIndex: isHovered ? 30 : 0, animation: enterAnim }
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

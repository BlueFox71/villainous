import { useEffect, useRef, useState } from 'react'
import type { CardInstance } from '../../engine/types'
import type { Accent } from '../accents'
import { getCardDef } from '../../data/registry'

type HandMode = 'idle' | 'play' | 'discard' | 'condition-ally'

/** Isabella — libellés des 6 heures de l'horloge (index 0..5). */
const CLOCK_HOURS = ['XII', 'II', 'IV', 'VI', 'VIII', 'X']

/** Largeur d'une carte (rem) d'après sa classe Tailwind (défaut éventail : w-36 = 9rem). */
const remForCardWidth = (cls?: string) =>
  cls === 'w-28' ? 7 : cls === 'w-24' ? 6 : cls === 'w-48' ? 12 : 9

/** Géométrie de l'éventail, ADAPTÉE au nombre de cartes. Jusqu'à 9 cartes : aspect
 *  habituel (recouvrement `baseOverlapRem`, 5°/carte, arc ×3). À partir de 10 (Dio peut
 *  en accumuler beaucoup), on RESSERRE fortement : recouvrement accru pour BORNER la
 *  largeur de l'éventail (≈ sa largeur à 8 cartes) afin de ne plus pousser l'interface,
 *  et angle/arc aplatis (moins « en éventail »). */
function fanGeometry(count: number, cardWidthRem: number, baseOverlapRem: number) {
  const baseStep = cardWidthRem - baseOverlapRem // pas horizontal habituel entre 2 cartes
  const cappedSpread = cardWidthRem + 7 * baseStep // largeur cible au-delà du seuil
  const step = count <= 9 ? baseStep : Math.max(1.4, (cappedSpread - cardWidthRem) / (count - 1))
  return {
    marginRem: step - cardWidthRem, // marginLeft (négatif = recouvrement)
    anglePer: count <= 9 ? 5 : Math.max(1.5, 30 / (count - 1)),
    liftCoeff: count <= 9 ? 3 : Math.min(3, 48 / Math.pow((count - 1) / 2, 2)),
  }
}

interface Props {
  hand: CardInstance[]
  accent: Accent
  mode: HandMode
  /** Main cachée (adversaire) : on n'affiche que des dos de cartes. */
  hidden: boolean
  /** URL du dos de carte vilain (varie selon le joueur). */
  backImage: string
  power: number
  /** Isabella — heure courante de l'horloge (index 0..5) ; grise les Activités hors heure. */
  clockHour?: number
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
  /** Dio — vrai s'il y a au moins un Allié DÉFAUSSABLE dans le royaume (The World / Stands /
   *  associés exclus) — Vampirisme (défausser un Allié pour piocher) est injouable sinon. */
  realmHasDiscardableAlly?: boolean
  /** Pyramid Head — vrai s'il existe en main une carte dont le TYPE a un exemplaire en
   *  défausse — Pacte de Sang est injouable sinon (rien à récupérer). */
  pacteSangPlayable?: boolean
  /** Vrai s'il y a au moins une Tuile Chiots posée (Cruella) — « J'adore les belles
   *  fourrures » est injouable sinon. */
  realmHasPuppyTile: boolean
  /** Vrai s'il y a au moins un Héros dans le royaume — une carte « gain par Héros »
   *  (Magnifiques Taxes) est injouable sinon. */
  realmHasHeroes: boolean
  /** Le Seigneur des Ténèbres — Nous avons conclu un marché ! : vrai si au moins une des
   *  deux options est réalisable (défausse non vide, OU Épée Magique défaussable pour le
   *  Chaudron). Injouable sinon. */
  bargainPlayable?: boolean
  /** Sa Sucrerie — Il lui est défendu de courir : jouable si (Allié + Héros) OU course active. */
  raceBanPlayable?: boolean
  /** Shere Khan — vrai s'il y a au moins un jeton Feu dans le royaume (C'est moi, Shere Khan). */
  realmHasFire?: boolean
  /** Davy Jones — vrai s'il y a au moins un jeton Trésor FACE CACHÉE sur un Héros (La Marque Noire). */
  realmHasFacedownTreasure?: boolean
  /** Le Seigneur des Ténèbres — On te tient : vrai si au moins une option est possible
   *  (chercher Tirelire OU éliminer un Héros de force 1). Injouable sinon. */
  pigKeeperPlayable?: boolean
  /** Hadès — Préparez-vous au combat ! : vrai s'il existe un Titan non entravé déplaçable
   *  (destination atteignable) ET assez de Pouvoir (≥2). Injouable sinon. */
  titanMovePlayable?: boolean
  /** Le Flagelleur Mental — Tunnel de Hawkins : vrai s'il existe un lieu (autorisé) portant
   *  assez d'Alliés défaussables pour poser un Tunnel. Injouable sinon (rien à sacrifier). */
  tunnelPlayable?: boolean
  /** Le Flagelleur Mental — Will sous emprise : vrai si un deck est consultable (Méchant
   *  non vide, ou Fatalité non vide et +1 Pouvoir finançable). Injouable sinon (aucun deck). */
  willScryPlayable?: boolean
  /** Reine de Cœur — Par ordre de la Reine ! : vrai s'il existe au moins une Carte Garde
   *  transformable en arceau. Injouable sinon. */
  canTransformGuards?: boolean
  /** Sombra — vrai s'il y a au moins un Piratage/IEM ou un Héros piraté dans le royaume.
   *  Skycode (gain par piratage) et Protocole Sombra (détruit les piratages) sont
   *  injouables sinon (aucun effet ; et Protocole ne peut pas faire gagner). */
  hasHackInPlay?: boolean
  /** Vrai s'il y a au moins un Ingrédient joué (zone Ingrédients) PAYABLE — Foudre
   *  est injouable sinon (rien de reproductible : son coût = celui de l'Ingrédient). */
  hasIngredients: boolean
  /** Vrai s'il y a au moins un Héros sur le lieu du pion — « Je vais vous broyer
   *  les os ! » est injouable sinon. */
  heroAtPawn: boolean
  /** Shere Khan — Bravo ! Bravo ! : vrai si au moins une action est recouverte (Héros ou
   *  jeton Feu) sur le lieu du pion. */
  coveredAtPawn?: boolean
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
  /** Vrai si Raiponce est DÉJÀ sur la Tour (Mère Gothel) — « Je serai la méchante »
   *  (ramener Raiponce sur la Tour + perdre 1 Confiance) est injouable alors. */
  raiponceAtTour?: boolean
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
  /** Slenderman — vrai s'il y a au moins une Page sur le lieu du pion. « Dessin
   *  inquiétant » (+1 JT/Page) est injouable sinon (0 JT → aucun effet). */
  pageAtPawn?: boolean
  /** Identifiant du lieu où se trouve le pion (Dr Facilier — Divination : jouable
   *  uniquement au Royaume du vaudou). */
  pawnLocationId?: string
  /** Le Piégeur — disponibilité des cibles pour ses cartes d'attaque (calculée par App).
   *  Grise Marque/Force brute/Sanctuaire/Memento/Rayon quand aucune cible valide. */
  piegeurGates?: { reveal: boolean; injure: boolean; hook: boolean; finish: boolean; move: boolean }
  /** Le Seigneur des clés — vrai s'il y a au moins une clé posée sur le plateau.
   *  00:00 est injouable sinon (aucune clé à prendre au dé). */
  keysOnBoard?: boolean
  /** Le Seigneur des clés — vrai s'il possède au moins une clé. Répondez ! est
   *  injouable sinon (0 Pouvoir gagné). */
  ownsKey?: boolean
  /** Lotso — vrai s'il y a quelque chose à amener sur la Salle des Chenilles (Héros hors
   *  Salle, ou Buzz hors Salle). « Pas l'âge minimum requis » est injouable sinon. */
  lotsoToRoomAvailable?: boolean
  /** Lotso — vrai s'il y a un Héros réductible hors de la Salle des Chenilles. « Patrouille
   *  de nuit » est injouable sinon. */
  lotsoHeroOutsideRoom?: boolean
  /** Lotso — vrai s'il y a au moins un Héros dans la Salle des Chenilles. « Les nouveaux
   *  jouets n'ont pas la moindre chance » est injouable sinon. */
  lotsoHeroInRoom?: boolean
  /** Madame de Trémaine — cardId présents dans le royaume (pour griser un Allié « en
   *  robe de bal » dont la version ordinaire n'est pas en jeu). */
  realmCardIds?: string[]
  /** Madame de Trémaine — vrai si la défausse Fatalité n'est pas vide (Je ne reviens
   *  jamais sur ma parole est injouable sinon). */
  fateDiscardNonEmpty?: boolean
  /** Vrai si la défausse de Méchant n'est pas vide (J'ai dit « Si » est injouable
   *  sinon : rien à remélanger dans la pioche). */
  villainDiscardNonEmpty?: boolean
  /** Glisser-déposer : id de l'action « Jouer une carte » disponible sur le lieu
   *  courant. Si défini, les cartes jouables deviennent saisissables (drag) vers le
   *  plateau, même sans avoir cliqué l'action au préalable. */
  dragPlayActionId?: string
  /** Phase ACTION de l'humain : autorise le glissé des cartes « jouables sans action »
   *  (Turbo-Statique) même sans action « Jouer une carte » disponible. */
  canFreePlay?: boolean
  /** Phase MOVE de l'humain : tant qu'il n'a pas déplacé son pion, saisir une carte rappelle
   *  qu'il doit d'abord se déplacer. */
  mustMoveFirst?: boolean
  /** Saisie d'une carte NON jouable pendant son tour : remonte la raison (à afficher). */
  onUnplayable?: (reason: string) => void
  /** Glissé au pointeur : début (seuil franchi), avec la position du curseur. */
  onCardDragStart?: (instanceId: string, x: number, y: number) => void
  /** Glissé au pointeur : déplacement du curseur (met à jour le fantôme). */
  onCardDragMove?: (x: number, y: number) => void
  /** Glissé au pointeur : lâcher (l'App fait le hit-test du plateau et joue). */
  onCardDragDrop?: (instanceId: string, x: number, y: number) => void
  /** Glissé au pointeur : annulation (clic droit) → la carte revient en main. */
  onCardDragCancel?: () => void
  /** instanceId de la carte en cours de glissé (pour l'estomper dans la main). */
  draggingInstanceId?: string | null
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
  /** Distribution / pioche animée : instanceId des cartes encore « en vol » dans l'overlay
   *  (cf. OpeningDeal). Elles occupent leur place dans l'éventail mais restent invisibles
   *  (opacité 0) jusqu'à leur atterrissage, puis apparaissent en fondu. */
  dealHiddenIds?: string[]
  /** Vrai si l'apparition des cartes est pilotée par l'overlay de pioche (cf. OpeningDeal) :
   *  on désactive alors le fondu d'entrée interne `enterDelays` (sinon double animation). */
  dealManaged?: boolean
  onPlayCard: (instanceId: string) => void
  /** Clic sur une Condition « armée » (clignotante) dans la main pendant le tour
   *  d'un adversaire : déclenche la réaction (raccourci du panneau « Réaction
   *  disponible »). Absent → la carte armée reste un simple indicateur visuel. */
  onActivateReaction?: (instanceId: string) => void
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
  clockHour,
  attachTargetsAvailable,
  blockEvents,
  realmHasAllies,
  realmHasDiscardableAlly = false,
  pacteSangPlayable = true,
  realmHasPuppyTile,
  realmHasHeroes,
  bargainPlayable = true,
  raceBanPlayable = true,
  realmHasFire = false,
  realmHasFacedownTreasure = false,
  pigKeeperPlayable = true,
  titanMovePlayable = true,
  tunnelPlayable = true,
  willScryPlayable = true,
  canTransformGuards = true,
  hasHackInPlay,
  hasIngredients,
  heroAtPawn,
  coveredAtPawn = false,
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
  raiponceAtTour = false,
  recoverFromDiscardAvailable,
  hasActivatableCard,
  canRemoveObstacle = true,
  canReplaceObstacle = true,
  realmHasMovableCard = true,
  showMeBeastUsable = true,
  keyAtPawn = true,
  pageAtPawn = true,
  pawnLocationId,
  piegeurGates,
  keysOnBoard = true,
  ownsKey = true,
  lotsoToRoomAvailable = true,
  lotsoHeroOutsideRoom = true,
  lotsoHeroInRoom = true,
  realmCardIds,
  fateDiscardNonEmpty = true,
  villainDiscardNonEmpty = true,
  dragPlayActionId,
  canFreePlay,
  mustMoveFirst,
  onUnplayable,
  onCardDragStart,
  onCardDragMove,
  onCardDragDrop,
  onCardDragCancel,
  draggingInstanceId = null,
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
  dealHiddenIds,
  dealManaged,
  cardWidthClass,
  onPlayCard,
  onActivateReaction,
  onToggleDiscard,
}: Props) {
  // instanceId de la carte survolée localement, pour l'aperçu zoom.
  const [hovered, setHovered] = useState<string | null>(null)
  // Glisser-déposer au pointeur : suivi du glissé en cours (seuil pour distinguer
  // d'un clic) et drapeau pour neutraliser le clic qui suit un glissé.
  const dragPointer = useRef<{ id: string; startX: number; startY: number; dragging: boolean } | null>(null)
  const suppressClickRef = useRef(false)

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
    // Apparition pilotée par l'overlay de pioche (cf. OpeningDeal) : pas de fondu interne.
    if (dealManaged) return
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
  }, [hand, dealManaged])

  const fan = layout === 'fan'

  if (hidden) {
    // Main cachée (adversaire) : on n'affiche que des dos de cartes. En éventail
    // (`fan`), on reprend la MÊME géométrie que la main du joueur (angle + arc),
    // mais sans révéler ni survol, et à la taille fixe des dos (w-24, inchangée).
    if (fan) {
      return (
        <section className="relative flex w-full flex-col items-center px-2 pb-1">
          <div className="flex items-end justify-center pt-2">
            {(() => {
              const geo = fanGeometry(hand.length, 6, 2.5) // dos = w-24, recouvrement -2.5rem
              return hand.map((ci, i) => {
              const mid = (hand.length - 1) / 2
              const off = i - mid
              const fanAngle = off * geo.anglePer // degrés par cran
              const fanLift = Math.abs(off) * Math.abs(off) * geo.liftCoeff // px vers le bas (arc)
              // Pioche animée de l'adversaire : on masque le dos tant qu'il « vole »
              // dans l'overlay (cf. OpeningDeal), puis il apparaît à son atterrissage.
              const dealHidden = dealHiddenIds?.includes(ci.instanceId) ?? false
              return (
                <img
                  key={ci.instanceId}
                  data-hand-card={ci.instanceId}
                  src={backImage}
                  alt="Carte cachée"
                  className="m-0 w-24 shrink-0 rounded-lg border border-white/10 opacity-90 transition-opacity duration-300"
                  style={{
                    marginLeft: i === 0 ? 0 : `${geo.marginRem}rem`,
                    transformOrigin: 'bottom center',
                    transform: `translateY(${fanLift}px) rotate(${fanAngle}deg)`,
                    zIndex: i,
                    opacity: dealHidden ? 0 : undefined,
                    transitionDuration: dealHidden ? '0ms' : '300ms',
                  }}
                />
              )
            })
            })()}
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

  // Éventail adaptatif : resserre fortement la main du joueur dès 10 cartes (Dio).
  const geo = fanGeometry(hand.length, remForCardWidth(cardWidthClass), 3.5)

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
          const fanAngle = off * geo.anglePer // degrés par cran
          const fanLift = Math.abs(off) * Math.abs(off) * geo.liftCoeff // px vers le bas (arc)
          const baseCost = card.cost ?? 0
          const cost = costFor ? costFor(ci) : baseCost
          const isArmed = armedConditionIds.includes(ci.instanceId)
          // Un Objet à associer exige un Allié présent sur le lieu.
          const needsAlly = ci.attach === 'ally'
          // Objet à associer à un HÉROS (Bug → Vanellope von Schweetz) : injouable si le
          // Héros-cible (attachOnlyCardId) — ou tout Héros si non restreint — n'est pas en jeu.
          const needsHeroHost = ci.type === 'item' && ci.attach === 'hero'
          const heroHostOk =
            !needsHeroHost ||
            (ci.attachOnlyCardId ? (realmCardIds ?? []).includes(ci.attachOnlyCardId) : realmHasHeroes)
          // Joyeux non-anniversaire (gain par Allié), Go ! (déplacer des Alliés) et Tendre
          // un Piège (déplacer un Allié puis Vanquish) : injouables sans Allié au royaume.
          const needsAllyInRealm =
            !!card.requiresAllyInRealm ||
            (card.effects ?? []).some(
              (e) => e.type === 'GAIN_POWER_PER_ALLY_IN_REALM' || e.type === 'RELOCATE_ALLIES' || e.type === 'MOVE_ALLY_FREELY',
            )
          // Cruella — J'adore les belles fourrures : injouable sans Tuile Chiots au royaume.
          const needsPuppyInRealm = (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_PUPPY_LOCATION')
          // Magnifiques Taxes (gain par Héros) / Cruelle diablesse (déplace un Héros) :
          // injouable sans Héros au royaume. Gaston — Belle est à moi (action gratuite
          // « Éliminer un Héros ») : idem, injouable sans Héros à cibler.
          // Nous avons conclu un marché ! : injouable si aucune option n'est réalisable
          // (calcul fait dans App → `bargainPlayable`).
          const needsBargain = (card.effects ?? []).some((e) => e.type === 'BARGAIN_RESHUFFLE_OR_SWORD')
          // On te tient : injouable si Tirelire déjà en jeu ET aucun Héros de force 1
          // (calcul fait dans App → `pigKeeperPlayable`).
          const needsPigKeeper = (card.effects ?? []).some((e) => e.type === 'PIGKEEPER_RESOLVE')
          // Par ordre de la Reine ! : injouable sans Carte Garde transformable (calcul App).
          const needsTransformGuards = (card.effects ?? []).some((e) => e.type === 'TRANSFORM_GUARDS')
          // Gul'dan — un Artéfact (Sceptre de Sargeras) reste JOUABLE sans Héros : il a
          // toujours l'effet de rejoindre la pile Artéfacts (quitte à gagner 0 Pouvoir).
          // Isabella — une ACTIVITÉ (à `allowedHours`) reste jouable dès la bonne heure, même
          // si son 2e effet (déplacer un Héros…) n'est pas réalisable (il est alors sans effet).
          const isActivite = !!(ci.allowedHours && ci.allowedHours.length > 0)
          const needsHeroInRealm = !ci.isArtifact && !isActivite && (card.effects ?? []).some(
            (e) =>
              e.type === 'GAIN_POWER_PER_HERO_IN_REALM' ||
              e.type === 'RELOCATE_OWN_HERO' ||
              (e.type === 'GRANT_FREE_ACTION' && e.actionType === 'VANQUISH') ||
              // Le Seigneur des clés — Banni ! (déplace un Héros) / Souffre-douleur
              // (réduit la force d'un Héros) : sans Héros au royaume, aucun effet.
              e.type === 'MOVE_HERO_TO_LOCATION' ||
              e.type === 'REDUCE_HERO_STRENGTH_TEMP' ||
              // Sombra — Adios (déplace un Héros vers un lieu voisin) : sans Héros, aucun effet.
              e.type === 'RELOCATE_HERO_ADJACENT' ||
              // Madame de Trémaine — Piège : sans Héros à piéger, aucun effet.
              e.type === 'TRAP_HERO' ||
              // Madame de Trémaine — Douze coups de minuit : sans Héros, aucun effet.
              e.type === 'INSTANT_VANQUISH_ALL_HEROES' ||
              // Tamatoa — Appât (pioche 1 par Héros) / Tu ressembles à des fruits de mer
              // (éliminer un Héros) / Sans pouvoir (jetons Force −1) : sans Héros, aucun effet.
              e.type === 'DRAW_PER_HERO_IN_REALM' ||
              e.type === 'DEFEAT_HERO_PAY_STRENGTH' ||
              e.type === 'ADD_MINUS_FORCE_TOKENS',
          )
          // Madame de Trémaine — Allié « en robe de bal » : injouable si sa version
          // ordinaire (`replacesCardId`) n'est pas en jeu.
          const needsReplaceTarget = !!ci.replacesCardId
          const replaceOk = !needsReplaceTarget || (realmCardIds ?? []).includes(ci.replacesCardId!)
          // Madame de Trémaine — Sale voleuse ! (INSTANT_VANQUISH_HERO_LE restreint à
          // certains cardId) : injouable si aucun des Héros visés n'est dans le royaume.
          const vanquishOnly = (card.effects ?? [])
            .filter((e) => e.type === 'INSTANT_VANQUISH_HERO_LE' && e.onlyCardIds)
            .flatMap((e) => (e.type === 'INSTANT_VANQUISH_HERO_LE' ? e.onlyCardIds ?? [] : []))
          const vanquishOnlyOk =
            vanquishOnly.length === 0 || vanquishOnly.some((id) => (realmCardIds ?? []).includes(id))
          // Madame de Trémaine — Je ne reviens jamais sur ma parole : injouable si la
          // défausse Fatalité est vide (rien à remélanger).
          const needsFateDiscardCard = (card.effects ?? []).some((e) => e.type === 'RESHUFFLE_FATE_DISCARD')
          // J'ai dit « Si » : injouable si la défausse de Méchant est vide.
          const needsVillainDiscard = (card.effects ?? []).some((e) => e.type === 'RESHUFFLE_DISCARD_AND_DRAW')
          // Foudre / Manipulation (duplique un Ingrédient / Artéfact) : injouable sans
          // carte à reproduire dans la pile source (Foudre exige aussi qu'elle soit
          // payable) ; cf. prop hasIngredients (Ingrédient payable OU Artéfact joué).
          const needsIngredient = (card.effects ?? []).some((e) => e.type === 'DUPLICATE_INGREDIENT')
          // Isabella — Activité : injouable si l'heure courante n'est pas dans ses heures autorisées.
          const wrongHour =
            !!card.allowedHours && card.allowedHours.length > 0 && !card.allowedHours.includes(clockHour ?? 0)
          // Il lui est défendu de courir : injouable si NI (Allié + Héros) NI jeton Pilote
          // sur le circuit (rien à faire). Calcul fourni par App → `raceBanPlayable`.
          const needsRaceBan = (card.effects ?? []).some((e) => e.type === 'RACE_BAN')
          // L'important, c'est de payer : injouable sans Pouvoir à dépenser, ou si une
          // action de lieu a déjà été jouée ce tour (jouable seulement AVANT les actions).
          const needsPowerToSpend = (card.effects ?? []).some((e) => e.type === 'PAY_TO_RACE')
          const needsBeforeActions = !!card.playableOnlyBeforeActions
          // « Je vais vous broyer les os ! » (Méchante Reine) : injouable sans Héros sur le
          // lieu du pion. Shere Khan — Bravo ! Bravo ! (`includeFire`) : injouable si AUCUNE
          // action n'est recouverte (Héros OU jeton Feu) sur le lieu du pion → gate `coveredAtPawn`.
          // Tamatoa — Piégé (`exceptFate`) : « n'importe quel Héros » → injouable sans Héros
          // dans le ROYAUME (pas forcément sur le lieu du pion).
          const needsHeroInRealmCovered = (card.effects ?? []).some((e) => e.type === 'USE_COVERED_ACTIONS_THIS_TURN' && e.exceptFate)
          const needsHeroHere = (card.effects ?? []).some((e) => e.type === 'USE_COVERED_ACTIONS_THIS_TURN' && !e.includeFire && !e.exceptFate)
          const needsCoveredAtPawn = (card.effects ?? []).some((e) => e.type === 'USE_COVERED_ACTIONS_THIS_TURN' && e.includeFire)
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
          // Fausses funérailles (Yzma) / Indigne de moi (Dio) : injouable sans Héros à compter.
          const needsFateDiscardHero = (card.effects ?? []).some((e) => e.type === 'GAIN_POWER_PER_FATE_DISCARD_HERO')
          // Dio — Vampirisme / Gul'dan — Drain d'Âme : injouable sans Allié défaussable dans le royaume.
          const needsDiscardableAlly = (card.effects ?? []).some((e) => e.type === 'DIO_DISCARD_ALLY_DRAW' || e.type === 'DISCARD_ALLY_DRAW')
          // Pyramid Head — Pacte de Sang : injouable sans carte de même type récupérable.
          const needsPacteSang = (card.effects ?? []).some((e) => e.type === 'PACTE_DE_SANG')
          // Ironie du sort (Yzma) : injouable sans Allié sur le lieu / sans Événement
          // abordable en défausse (elle gaspillerait sinon du Pouvoir).
          const needsPoeticJustice = (card.effects ?? []).some((e) => e.type === 'POETIC_JUSTICE')
          // Capture (Ratigan) : injouable sans Héros déplaçable hors de la destination.
          const needsRelocateTarget = (card.effects ?? []).some((e) => e.type === 'MOVE_REALM_HERO_TO')
          // Boop ! (Sombra) : injouable sans Héros à pirater (aucun, ou tous déjà piratés).
          const needsHackTarget = (card.effects ?? []).some((e) => e.type === 'HACK_HERO')
          // Skycode (gain par piratage) / Protocole Sombra (détruit les piratages, ou
          // victoire si TOUS les lieux sont piratés) : injouables sans aucun Piratage/IEM
          // ni Héros piraté dans le royaume (aucun effet — Protocole ne peut alors pas
          // faire gagner non plus, la victoire exigeant des Piratages partout).
          const needsHackInPlay = (card.effects ?? []).some(
            (e) => e.type === 'GAIN_POWER_PER_HACK' || e.type === 'SOMBRA_PROTOCOL',
          )
          // « Je t'aime bien plus » (Gothel) : Événement injouable si le pion n'est pas
          // sur le lieu de Raiponce (il n'aurait aucun effet). La Brosse à cheveux
          // (Objet) reste jouable : elle se pose et pourra rejoindre Raiponce plus tard.
          const needsPawnWithRaiponce =
            card.type === 'effect' && (card.effects ?? []).some((e) => e.type === 'GAIN_CONFIANCE_WITH_RAIPONCE')
          // « Je serai la méchante » (Gothel) : Événement injouable si Raiponce est DÉJÀ
          // sur la Tour (ramener + perdre 1 Confiance n'aurait que l'inconvénient).
          const needsRaiponceNotAtTour =
            card.type === 'effect' && (card.effects ?? []).some((e) => e.type === 'MOVE_RAIPONCE' && e.to === 'tour')
          // Le diable l'emporte (Cruella) : injouable sans carte récupérable en défausse.
          const needsRecoverTarget = (card.effects ?? []).some((e) => e.type === 'RECOVER_FROM_DISCARD_CHOICE')
          // Finissez le travail ! (Cruella) : injouable sans capacité activable.
          const needsActivatable = (card.effects ?? []).some((e) => e.type === 'GRANT_FREE_ACTIVATE')
          // Shere Khan — Tout le monde fuit : injouable si NI capacité activable NI Héros à
          // éliminer dans le royaume (les deux actions seraient impossibles).
          const needsActivateOrVanquish = (card.effects ?? []).some((e) => e.type === 'GRANT_FREE_ACTIVATE_OR_VANQUISH')
          // Shere Khan — C'est moi, Shere Khan : injouable si aucun jeton Feu dans le royaume.
          const needsFireInRealm = (card.effects ?? []).some((e) => e.type === 'REMOVE_FIRE_AT_PAWN')
          // Davy Jones — La Marque Noire : REVEAL_TREASURE sans `atHostLocation` (Bill le Bottier exclu).
          const needsFacedownTreasure = (card.effects ?? []).some((e) => e.type === 'REVEAL_TREASURE' && !e.atHostLocation)
          // Shere Khan — Jeune et sans défense : injouable s'il n'y a NI Héros NI Allié.
          const needsHeroOrAlly = (card.effects ?? []).some((e) => e.type === 'MOVE_HERO_TO_ALLY_OR_POWER_PER_ALLY' || e.type === 'MOVE_ANY_HERO_TO_ALLY')
          // Gaston — cartes dont le SEUL effet est de retirer des Obstacles (Très mauvais
          // caractère, Laissez-moi vous regarder, Sortez !) : injouables si Belle bloque
          // ou s'il ne reste aucun Obstacle.
          const cardFx = card.effects ?? []
          // Le Piégeur — cartes d'attaque : injouables sans cible valide (cf. piegeurGates,
          // calculé par App). Marque = révéler un Survivant sur le lieu du pion ; Force brute
          // = un révélé non critique ; Sanctuaire = un critique + crochet actif ; Memento =
          // un critique à 1 vie ; Rayon = un Survivant non accroché.
          const needsPiegeurReveal = cardFx.some((e) => e.type === 'PIEGEUR_REVEAL' && e.atPawn)
          const needsPiegeurInjure = cardFx.some((e) => e.type === 'PIEGEUR_INJURE')
          const needsPiegeurHook = cardFx.some((e) => e.type === 'PIEGEUR_HOOK')
          const needsPiegeurFinish = cardFx.some((e) => e.type === 'PIEGEUR_FINISH')
          const needsPiegeurMove = cardFx.some((e) => e.type === 'PIEGEUR_MOVE_SURVIVOR')
          const needsRemoveObstacle = cardFx.length > 0 && cardFx.every((e) => e.type === 'REMOVE_OBSTACLE')
          // Sous le charme : injouable si les 8 Obstacles sont déjà posés (rien à replacer).
          const needsReplaceObstacle = cardFx.some((e) => e.type === 'REPLACE_OBSTACLE')
          // Tous avec moi ! : injouable sans Allié/Objet déplaçable.
          const needsMovableCard = cardFx.some((e) => e.type === 'GRANT_FREE_ACTION' && e.actionType === 'MOVE_ITEM_ALLY')
          // C'est votre dernière chance : injouable si NI Objet/Allié déplaçable NI capacité activable.
          const needsMoveOrActivate = cardFx.some((e) => e.type === 'GRANT_FREE_MOVE_OR_ACTIVATE')
          // Syndrome — Identification, je vous prie : injouable sans lieu portant un Héros
          // OU sans Allié/Objet (non associé) à déplacer.
          const needsIdentification = cardFx.some((e) => e.type === 'MOVE_ALLY_OR_ITEM_TO_HERO_LOCATION')
          // Dr Facilier — Divination : sans effet hors du Royaume du vaudou → injouable ailleurs.
          const needsVaudou = cardFx.some((e) => e.type === 'DIVINATION')
          // Hadès — Préparez-vous au combat ! : injouable sans Titan déplaçable (+ Pouvoir).
          const needsTitanMove = cardFx.some((e) => e.type === 'MOVE_TITAN_INTERACTIVE')
          // Le Flagelleur Mental — Tunnel de Hawkins : injouable si aucun lieu (autorisé) ne
          // porte assez d'Alliés défaussables pour le poser (calcul App → `tunnelPlayable`).
          const needsTunnel = cardFx.some((e) => e.type === 'FLAYER_PLACE_TUNNEL')
          // Le Flagelleur Mental — Will sous emprise : injouable si aucun deck n'est
          // consultable (calcul App → `willScryPlayable`).
          const needsScry = cardFx.some((e) => e.type === 'FLAYER_WILL_SCRY')
          // Lotso — Le Bibliothécaire (coût variable) : injouable sans jeton Pouvoir à
          // dépenser OU sans Héros au royaume (rien à réduire).
          const needsBookworm = cardFx.some((e) => e.type === 'LOTSO_BOOKWORM')
          // Lotso — Pas l'âge minimum requis : injouable si rien à amener sur la Salle des
          // Chenilles (Buzz déjà dedans ET aucun Héros sur un autre lieu).
          const needsToRoomCandidate = cardFx.some((e) => e.type === 'LOTSO_MOVE' && e.scope === 'to-room')
          // Lotso — Patrouille de nuit : injouable sans Héros réductible HORS de la Salle.
          const needsHeroOutsideRoom = cardFx.some((e) => e.type === 'LOTSO_REDUCE' && e.scope === 'not-room' && e.target === 'one')
          // Lotso — Enfermés / Les nouveaux jouets : injouable sans Héros dans la Salle des
          // Chenilles (Buzz ne compte pas).
          const needsHeroInRoom = cardFx.some((e) => e.type === 'LOTSO_REDUCE' && e.scope === 'room' && e.target === 'all')
          // Montre-moi la Bête ! : injouable si ni la Bête ni Belle dans le royaume.
          const needsShowMeBeast = cardFx.some((e) => e.type === 'SHOW_ME_THE_BEAST')
          // Le Seigneur des clés — Toute Puissance / C'est moi qui décide / Pierre tombale :
          // injouables sans clé sur le lieu du pion. 00:00 : injouable sans clé sur le plateau.
          const needsKeyAtPawn = cardFx.some((e) => e.type === 'TAKE_KEY_AT_PAWN' || e.type === 'ROLL_DIE_TAKE_KEY_AT_PAWN')
          // Slenderman — Dessin inquiétant : injouable sans Page sur le lieu du pion (0 JT).
          const needsPageAtPawn = cardFx.some((e) => e.type === 'GAIN_POWER_PER_CARD_AT_PAWN')
          const needsKeysOnBoard = cardFx.some((e) => e.type === 'CHOOSE_COLOR_ROLL_TAKE_KEY' || e.type === 'ROLL_DIE_TAKE_KEY_FROM_BOARD')
          // Cartes qui exigent une clé POSSÉDÉE : Répondez ! (0 Pouvoir sinon),
          // Trop facile / Plus qu'une minute (« perdez une clé de votre choix »).
          const needsOwnedKey = cardFx.some(
            (e) => e.type === 'GAIN_POWER_PER_KEY_COLOR' || e.type === 'LOSE_KEY_GAIN_POWER' || e.type === 'LOSE_KEY_DRAW',
          )
          // Conditions de jouabilité « Jouer une carte » (indépendantes du mode UI) :
          // sert au clic (mode 'play') ET au glisser-déposer (dragPlayActionId).
          const canPlay =
            card.type !== 'condition' &&
            !card.reactiveOnly &&
            cost <= power &&
            (!needsAlly || attachTargetsAvailable) &&
            heroHostOk &&
            (!needsAllyInRealm || realmHasAllies) &&
            (!needsPuppyInRealm || realmHasPuppyTile) &&
            (!needsHeroInRealm || realmHasHeroes) &&
            (!needsBargain || bargainPlayable) &&
            (!needsPigKeeper || pigKeeperPlayable) &&
            (!needsTransformGuards || canTransformGuards) &&
            (!needsIngredient || hasIngredients) &&
            !wrongHour &&
            (!needsPowerToSpend || power >= 1) &&
            (!needsBeforeActions || !realActionUsed) &&
            (!needsRaceBan || raceBanPlayable) &&
            (!needsHeroHere || heroAtPawn) &&
            (!needsHeroInRealmCovered || realmHasHeroes) &&
            (!needsCoveredAtPawn || coveredAtPawn) &&
            (!needsBite || canBite) &&
            (!needsHyena || realmHasHyena) &&
            (!needsHyenaElsewhere || hyenaElsewhere) &&
            (!needsFateDiscard || fateDiscardHasCard) &&
            (!needsFirstAction || !realActionUsed) &&
            (!needsKronkToken || kronkHasPowerToken) &&
            (!needsFateDiscardHero || fateDiscardHasHero) &&
            (!needsDiscardableAlly || realmHasDiscardableAlly) &&
            (!needsPacteSang || pacteSangPlayable) &&
            (!needsPoeticJustice || poeticJusticeUsable) &&
            (!needsRelocateTarget || relocateTargetAvailable) &&
            (!needsHackTarget || hackTargetAvailable) &&
            (!needsHackInPlay || !!hasHackInPlay) &&
            (!needsPawnWithRaiponce || pawnWithRaiponce) &&
            (!needsRaiponceNotAtTour || !raiponceAtTour) &&
            (!needsRecoverTarget || recoverFromDiscardAvailable) &&
            (!needsActivatable || hasActivatableCard) &&
            (!needsActivateOrVanquish || hasActivatableCard || realmHasHeroes) &&
            (!needsFireInRealm || realmHasFire) &&
            (!needsFacedownTreasure || realmHasFacedownTreasure) &&
            (!needsHeroOrAlly || realmHasHeroes || realmHasAllies) &&
            (!needsRemoveObstacle || canRemoveObstacle) &&
            (!needsReplaceObstacle || canReplaceObstacle) &&
            (!needsMovableCard || realmHasMovableCard) &&
            (!needsMoveOrActivate || realmHasMovableCard || hasActivatableCard) &&
            (!needsIdentification || (realmHasHeroes && realmHasMovableCard)) &&
            (!needsVaudou || pawnLocationId === 'royaume-vaudou') &&
            (!needsTitanMove || titanMovePlayable) &&
            (!needsTunnel || tunnelPlayable) &&
            (!needsScry || willScryPlayable) &&
            (!needsBookworm || (realmHasHeroes && power >= 1)) &&
            (!needsToRoomCandidate || lotsoToRoomAvailable) &&
            (!needsHeroOutsideRoom || lotsoHeroOutsideRoom) &&
            (!needsHeroInRoom || lotsoHeroInRoom) &&
            (!needsShowMeBeast || showMeBeastUsable) &&
            (!needsKeyAtPawn || keyAtPawn) &&
            (!needsPageAtPawn || pageAtPawn) &&
            (!needsKeysOnBoard || keysOnBoard) &&
            (!needsOwnedKey || ownsKey) &&
            (!needsPiegeurReveal || !!piegeurGates?.reveal) &&
            (!needsPiegeurInjure || !!piegeurGates?.injure) &&
            (!needsPiegeurHook || !!piegeurGates?.hook) &&
            (!needsPiegeurFinish || !!piegeurGates?.finish) &&
            (!needsPiegeurMove || !!piegeurGates?.move) &&
            replaceOk &&
            vanquishOnlyOk &&
            (!needsFateDiscardCard || fateDiscardNonEmpty) &&
            (!needsVillainDiscard || villainDiscardNonEmpty) &&
            !(blockEvents && card.type === 'effect')
          // Raison d'injouabilité (1ʳᵉ condition qui échoue, MÊME ordre que `canPlay`) :
          // affichée à l'écran quand on tente de saisir une carte non jouable.
          const unplayableReason: string | null = !canPlay
            ? card.type === 'condition'
              ? 'Une Condition se joue en réaction, pendant le tour d’un adversaire.'
              : card.reactiveOnly
                ? 'Cette carte se joue en réaction, juste après un lancer de dés (pas via Jouer une carte).'
              : cost > power
                ? `Pas assez de Pouvoir : coût ${cost}, vous avez ${power}.`
                : needsAlly && !attachTargetsAvailable
                  ? 'Aucun Allié sur le plateau pour recevoir cet Objet.'
                  : needsHeroHost && !heroHostOk
                    ? ci.attachOnlyCardId
                      ? `${getCardDef(ci.attachOnlyCardId)?.name ?? 'Le Héros requis'} n’est pas dans votre royaume.`
                      : 'Aucun Héros dans votre royaume pour recevoir cet Objet.'
                  : needsAllyInRealm && !realmHasAllies
                    ? 'Aucun Allié dans votre royaume.'
                    : needsPuppyInRealm && !realmHasPuppyTile
                      ? 'Aucune Tuile Chiots dans votre royaume.'
                      : needsHeroInRealm && !realmHasHeroes
                        ? 'Aucun Héros dans votre royaume.'
                        : needsBargain && !bargainPlayable
                          ? 'Aucune option réalisable (défausse vide et pas d’Épée Magique à échanger).'
                          : needsPigKeeper && !pigKeeperPlayable
                            ? 'Tirelire déjà en jeu et aucun Héros de force 1 à éliminer.'
                            : needsTransformGuards && !canTransformGuards
                              ? 'Aucune Carte Garde transformable en arceau.'
                              : needsIngredient && !hasIngredients
                                ? 'Aucun Ingrédient en jeu payable à reproduire.'
                                : wrongHour
                                  ? `Activité jouable seulement à ${(card.allowedHours ?? []).map((h) => CLOCK_HOURS[h] ?? '?').join(', ')} — il est ${CLOCK_HOURS[clockHour ?? 0] ?? '?'}.`
                                : needsPowerToSpend && power < 1
                                  ? 'Aucun jeton Pouvoir à dépenser.'
                                  : needsBeforeActions && realActionUsed
                                    ? 'Jouable uniquement AVANT vos actions (vous avez déjà agi ce tour).'
                                    : needsRaceBan && !raceBanPlayable
                                      ? 'Ni Allié + Héros, ni course en cours : rien à faire.'
                                      : needsHeroInRealmCovered && !realmHasHeroes
                                        ? 'Aucun Héros dans votre royaume.'
                                      : needsHeroHere && !heroAtPawn
                                        ? 'Aucun Héros sur le lieu de votre pion.'
                                      : needsCoveredAtPawn && !coveredAtPawn
                                        ? 'Aucune action recouverte (Héros ou jeton Feu) sur votre lieu.'
                                        : needsBite && !canBite
                                          ? 'Aucun Héros à croquer sur le lieu de votre pion.'
                                          : needsHyena && !realmHasHyena
                                            ? 'Aucune Hyène dans votre royaume.'
                                            : needsHyenaElsewhere && !hyenaElsewhere
                                              ? 'Aucune Hyène sur un autre lieu que votre pion.'
                                              : needsFateDiscard && !fateDiscardHasCard
                                                ? 'Défausse Fatalité vide.'
                                                : needsFirstAction && realActionUsed
                                                  ? 'Jouable uniquement en première action du tour.'
                                                  : needsKronkToken && !kronkHasPowerToken
                                                    ? 'Aucun jeton Pouvoir sur Kronk.'
                                                    : needsFateDiscardHero && !fateDiscardHasHero
                                                      ? 'Aucun Héros dans la défausse Fatalité.'
                                                      : needsDiscardableAlly && !realmHasDiscardableAlly
                                                        ? 'Aucun Allié à défausser dans votre royaume.'
                                                      : needsPacteSang && !pacteSangPlayable
                                                        ? 'Aucune carte de votre main n’a d’équivalent (même type) en défausse.'
                                                      : needsPoeticJustice && !poeticJusticeUsable
                                                        ? 'Aucun Allié sur votre lieu, ou aucun Événement abordable en défausse.'
                                                        : needsRelocateTarget && !relocateTargetAvailable
                                                          ? 'Aucun Héros déplaçable.'
                                                          : needsHackTarget && !hackTargetAvailable
                                                            ? 'Aucun Héros à pirater.'
                                                            : needsHackInPlay && !hasHackInPlay
                                                              ? 'Aucun Piratage ni Héros piraté en jeu.'
                                                              : needsPawnWithRaiponce && !pawnWithRaiponce
                                                                ? 'Votre pion n’est pas sur le lieu de Raiponce.'
                                                                : needsRaiponceNotAtTour && raiponceAtTour
                                                                  ? 'Raiponce est déjà sur la Tour.'
                                                                  : needsRecoverTarget && !recoverFromDiscardAvailable
                                                                    ? 'Aucune carte récupérable dans votre défausse.'
                                                                    : needsActivatable && !hasActivatableCard
                                                                      ? 'Aucune capacité activable.'
                                                                    : needsActivateOrVanquish && !hasActivatableCard && !realmHasHeroes
                                                                      ? 'Aucune capacité à activer ni Héros à éliminer.'
                                                                    : needsFireInRealm && !realmHasFire
                                                                      ? 'Aucun jeton Feu à retirer dans votre royaume.'
                                                                    : needsFacedownTreasure && !realmHasFacedownTreasure
                                                                      ? 'Aucun jeton Trésor face cachée sur un Héros à révéler.'
                                                                    : needsHeroOrAlly && !realmHasHeroes && !realmHasAllies
                                                                      ? 'Aucun Héros ni Allié dans votre royaume.'
                                                                      : needsRemoveObstacle && !canRemoveObstacle
                                                                        ? 'Aucun Obstacle à retirer (ou Belle bloque).'
                                                                        : needsReplaceObstacle && !canReplaceObstacle
                                                                          ? 'Aucun Obstacle à replacer (les 8 sont posés).'
                                                                          : needsMovableCard && !realmHasMovableCard
                                                                            ? 'Aucun Allié ou Objet déplaçable.'
                                                                            : needsMoveOrActivate && !(realmHasMovableCard || hasActivatableCard)
                                                                              ? 'Rien à déplacer ni de capacité à activer.'
                                                                              : needsIdentification && !(realmHasHeroes && realmHasMovableCard)
                                                                                ? 'Il faut un Héros dans votre royaume ET un Allié/Objet déplaçable.'
                                                                                : needsVaudou && pawnLocationId !== 'royaume-vaudou'
                                                                                  ? 'Jouable uniquement au Royaume du vaudou.'
                                                                                : needsTitanMove && !titanMovePlayable
                                                                                  ? 'Aucun Titan déplaçable (Titan non entravé + Pouvoir requis).'
                                                                                : needsTunnel && !tunnelPlayable
                                                                                  ? 'Pas assez d’Alliés à défausser sur un même lieu pour poser un Tunnel.'
                                                                                : needsScry && !willScryPlayable
                                                                                  ? 'Aucun deck à consulter (deck Méchant vide, et Fatalité vide ou +1 Pouvoir non finançable).'
                                                                                : needsBookworm && !(realmHasHeroes && power >= 1)
                                                                                  ? 'Il faut un Héros dans votre royaume et au moins 1 Pouvoir.'
                                                                                  : needsToRoomCandidate && !lotsoToRoomAvailable
                                                                                    ? 'Rien à amener sur la Salle des Chenilles.'
                                                                                    : needsHeroOutsideRoom && !lotsoHeroOutsideRoom
                                                                                      ? 'Aucun Héros réductible hors de la Salle des Chenilles.'
                                                                                      : needsHeroInRoom && !lotsoHeroInRoom
                                                                                        ? 'Aucun Héros dans la Salle des Chenilles.'
                                                                                        : needsShowMeBeast && !showMeBeastUsable
                                                                                          ? 'Ni la Bête ni Belle dans votre royaume.'
                                                                                          : needsKeyAtPawn && !keyAtPawn
                                                                                            ? 'Aucune clé sur le lieu de votre pion.'
                                                                                            : needsPageAtPawn && !pageAtPawn
                                                                                            ? 'Aucune Page sur le lieu de votre pion.'
                                                                                            : needsKeysOnBoard && !keysOnBoard
                                                                                              ? 'Aucune clé sur le plateau.'
                                                                                              : needsOwnedKey && !ownsKey
                                                                                                ? 'Vous ne possédez aucune clé.'
                                                                                                : !replaceOk
                                                                                                  ? 'Sa version ordinaire n’est pas en jeu.'
                                                                                                  : !vanquishOnlyOk
                                                                                                    ? 'Aucun des Héros visés n’est dans votre royaume.'
                                                                                                    : needsFateDiscardCard && !fateDiscardNonEmpty
                                                                                                      ? 'Défausse Fatalité vide (rien à remélanger).'
                                                                                                      : needsVillainDiscard && !villainDiscardNonEmpty
                                                                                                        ? 'Défausse de Méchant vide (rien à remélanger).'
                                                                                                        : blockEvents && card.type === 'effect'
                                                                                                          ? 'Un Héros (Roi Richard / Tirelire) empêche de jouer des Événements.'
                                                                                                          : 'Cette carte n’est pas jouable pour le moment.'
            : null
          const playable =
            mode === 'play'
              ? canPlay
              : mode === 'condition-ally'
                ? card.type === 'ally' // Lâcheté : seuls les Alliés sont jouables, gratuit
                : false
          // Glisser-déposer : la carte est saisissable dès qu'une action « Jouer une
          // carte » est disponible et que la carte serait jouable (même hors mode 'play').
          // Turbo-Statique (playableWithoutAction) est saisissable même SANS action de
          // pose, tant qu'on est en phase ACTION de l'humain (`canFreePlay`).
          const dragEligible =
            (!!dragPlayActionId || (!!card.playableWithoutAction && canFreePlay)) &&
            canPlay &&
            mode !== 'discard'
          const checked = selectedToDiscard.includes(ci.instanceId)
          // « Jouer une carte » ne se fait PLUS au clic : on glisse la carte sur le plateau.
          // Le clic reste utile uniquement pour la défausse et la réaction « condition-ally »
          // (Lâcheté), où le glissé n'est pas disponible.
          // Condition « armée » (clignotante) jouable en réaction pendant le tour d'un
          // adversaire : on autorise le clic direct sur la carte comme raccourci du
          // panneau « Réaction disponible ».
          const reactionClickable = isArmed && !!onActivateReaction
          const clickable = (mode === 'condition-ally' && playable) || mode === 'discard' || reactionClickable
          const dimmed = (mode === 'play' || mode === 'condition-ally') && !playable
          const onClick =
            mode === 'condition-ally' && playable
              ? () => onPlayCard(ci.instanceId)
              : mode === 'discard'
                ? () => onToggleDiscard(ci.instanceId)
                : reactionClickable
                  ? () => onActivateReaction!(ci.instanceId)
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
          // Distribution d'ouverture : carte encore « en vol » dans l'overlay → on garde
          // sa place dans l'éventail mais on la masque, puis elle apparaît en fondu à son
          // atterrissage (cf. OpeningDeal).
          const dealHidden = dealHiddenIds?.includes(ci.instanceId) ?? false

          return (
            <figure
              key={ci.instanceId}
              data-hand-card={ci.instanceId}
              onMouseEnter={() => setHovered(ci.instanceId)}
              onMouseLeave={() => setHovered((h) => (h === ci.instanceId ? null : h))}
              className={`relative m-0 shrink-0 ${cardWidthClass ?? (fan ? 'w-36' : 'w-24')} ${dimmed ? 'opacity-40' : ''} ${dealHidden ? 'pointer-events-none' : ''} ${
                fan ? 'transition-[transform,opacity] duration-150 ease-out' : ''
              }`}
              style={
                fan
                  ? {
                      marginLeft: i === 0 ? 0 : `${geo.marginRem}rem`,
                      transformOrigin: 'bottom center',
                      transform: isHovered
                        ? 'translateY(-3.5rem) rotate(0deg) scale(1.6)'
                        : `translateY(${fanLift}px) rotate(${fanAngle}deg)`,
                      zIndex: isHovered ? 40 : i,
                      animation: enterAnim,
                      opacity: dealHidden ? 0 : undefined,
                      transitionDuration: dealHidden ? '0ms' : '300ms',
                    }
                  : { zIndex: isHovered ? 30 : 0, animation: enterAnim, opacity: dealHidden ? 0 : undefined }
              }
            >
              <img
                src={card.image}
                alt={card.name}
                title={`${card.name} — ${card.text}`}
                // L'image ne doit PAS déclencher le drag natif du navigateur : il volerait
                // les événements pointer et figerait notre fantôme.
                draggable={false}
                style={dragEligible ? { touchAction: 'none' } : undefined}
                onClick={() => {
                  // Un clic qui suit un glissé est neutralisé (le glissé a déjà joué/ciblé).
                  if (suppressClickRef.current) { suppressClickRef.current = false; return }
                  onClick?.()
                }}
                onPointerDown={
                  dragEligible
                    ? (e) => {
                        if (e.button !== 0) return
                        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                        dragPointer.current = { id: ci.instanceId, startX: e.clientX, startY: e.clientY, dragging: false }
                      }
                    : // Carte saisie alors qu'on ne peut pas la jouer : on affiche POURQUOI.
                      // - Phase MOVE : il faut d'abord déplacer son pion.
                      // - Phase ACTION : la vraie raison d'injouabilité (sauf défausse / réaction).
                      mustMoveFirst
                      ? (e) => {
                          if (e.button !== 0) return
                          onUnplayable?.('Vous devez déplacer votre pion avant de faire vos actions')
                        }
                      : canFreePlay && unplayableReason && mode !== 'discard' && mode !== 'condition-ally'
                        ? (e) => {
                            if (e.button !== 0) return
                            onUnplayable?.(unplayableReason)
                          }
                        : undefined
                }
                onPointerMove={
                  dragEligible
                    ? (e) => {
                        const d = dragPointer.current
                        if (!d || d.id !== ci.instanceId) return
                        if (!d.dragging) {
                          if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return
                          d.dragging = true
                          onCardDragStart?.(ci.instanceId, e.clientX, e.clientY)
                        }
                        onCardDragMove?.(e.clientX, e.clientY)
                      }
                    : undefined
                }
                onPointerUp={
                  dragEligible
                    ? (e) => {
                        const d = dragPointer.current
                        dragPointer.current = null
                        if (!d || d.id !== ci.instanceId) return
                        if (d.dragging) {
                          // Neutralise le clic « parasite » qui suit le glissé. On l'auto-efface
                          // après ce clic (setTimeout 0) : s'il ne retombe pas sur cette carte
                          // (lâché ailleurs), le flag ne doit pas bloquer un futur vrai clic.
                          suppressClickRef.current = true
                          window.setTimeout(() => { suppressClickRef.current = false }, 0)
                          onCardDragDrop?.(ci.instanceId, e.clientX, e.clientY)
                        }
                      }
                    : undefined
                }
                onContextMenu={
                  dragEligible
                    ? (e) => {
                        // Clic droit pendant un glissé : on annule (la carte revient en main).
                        if (dragPointer.current?.dragging) {
                          e.preventDefault()
                          dragPointer.current = null
                          suppressClickRef.current = true
                          window.setTimeout(() => { suppressClickRef.current = false }, 0)
                          onCardDragCancel?.()
                        }
                      }
                    : undefined
                }
                className={`w-full rounded-lg border ${clickable ? 'cursor-pointer' : dragEligible ? 'cursor-grab' : mustMoveFirst || (canFreePlay && unplayableReason) ? 'cursor-not-allowed' : ''} ${ring} ${
                  draggingInstanceId === ci.instanceId ? 'opacity-0' : ''
                }`}
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

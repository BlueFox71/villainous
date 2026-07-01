// =============================================================================
// Modèle de données des cartes.
//
// Le TEXTE français reste la source de vérité « humaine ». Les `effects` sont la
// traduction machine, exécutée par le moteur (engine/effects.ts) : on les ajoute
// progressivement, carte par carte. Les champs de présentation (image, texte,
// nom anglais) restent ici ; les champs de jeu (type/coût/force/effets) sont
// recopiés dans les CardInstance par buildDeckInstances pour que le moteur soit
// autosuffisant.
// =============================================================================

import type {
  AuDelaEffect,
  CardInstance,
  CardType,
  ConditionTrigger,
  CurseDiscardTrigger,
  Effect,
  LocationActionType,
  LocationId,
  PlacementRestriction,
  SelfStrengthMod,
  StrengthMod,
} from '../engine/types'

// CardType est un concept de jeu : il vit dans le moteur, on le ré-exporte ici
// par commodité pour le reste de data/.
export type { CardType } from '../engine/types'

/** À quel paquet appartient la carte. */
export type DeckKind = 'villain' | 'fate'

/**
 * Classement « malus » d'une carte Fatalité DURABLE (Héros/Objet) du point de vue
 * du joueur ciblé. Sert UNIQUEMENT à l'IA pour moduler son agressivité Fatalité
 * (cf. mémoire projet « villainous-fate-malus ») : poids croissant, l'absence de
 * champ = NEUTRE (typiquement le Héros-cible de l'objectif). Renseigné par cardId
 * dans `data/fateMalus.ts` et attaché aux CardDef par le registre.
 *
 *  slow / slow2 / slow3        → RALENTIT (gêne ; ++ / +++ = beaucoup)
 *  block-advance / -advance3   → EMPÊCHE D'AVANCER (fait reculer la progression)
 *  block-win                   → EMPÊCHE DE GAGNER (bloc dur tant que présent)
 */
export type FateMalus =
  | 'slow'
  | 'slow2'
  | 'slow3'
  | 'block-advance'
  | 'block-advance3'
  | 'block-win'

export interface CardDef {
  /** Slug stable (kebab-case, ASCII). Sert de clé et d'id de rendu. */
  id: string
  /** Nom français imprimé sur la carte. */
  name: string
  /** Nom anglais officiel (wiki) — utile pour recouper règles et stratégies. */
  englishName: string
  deck: DeckKind
  type: CardType
  /** Coût en pouvoir pour jouer la carte. Cartes Vilain uniquement
   *  (les cartes Fatalité n'ont pas de coût). */
  cost?: number
  /** Coût VARIABLE : affiche « ? » dans la pastille de coût (le vrai coût est calculé au
   *  jeu, ex. Banqueroute = Force du Héros ciblé). Purement visuel. */
  costVariable?: boolean
  /** Force au combat. Alliés et Héros uniquement. */
  strength?: number
  /** Pour un Objet : à quoi il s'associe une fois joué. `'ally'` = posé sur un
   *  Allié présent sur le lieu ; `'hero'` = posé sur un Héros (Objets Fatalité) ;
   *  absent / `'location'` = posé sur le lieu lui-même. Sans effet pour les
   *  autres types (un Allié va toujours sur le lieu). */
  attach?: 'location' | 'ally' | 'hero'
  /** Objet qui ne peut être associé QU'au Héros de ce cardId (Sa Sucrerie — Bug →
   *  Vanellope von Schweetz uniquement). */
  attachOnlyCardId?: string
  /** Pour un Objet associé (`attach: 'ally' | 'hero'`) : bonus de force conféré
   *  à la carte hôte tant que cet Objet lui est associé (Arc et Flèches / Cimeterre
   *  / Lance : +1 ; Épée de Vérité / Vœu : +2). Donnée réutilisable : le moteur
   *  somme ce champ sur tous les Objets associés, sans connaître la carte. */
  attachStrengthBonus?: number
  /** Objet « bouclier » associé à un Allié (Cruella — Tisonnier) : défaussé à la
   *  place de son Allié quand celui-ci devrait être défaussé. */
  shieldAllyFromDiscard?: boolean
  /** Indice IA (donnée réutilisable) : à quel point RETIRER cet Objet gêne son
   *  propriétaire — plus c'est haut, plus une Fatalité de défausse (Dégonflage, Onix…)
   *  vise cet Objet en priorité. Team Rocket : Mongolfière (tempo) ≫ Pokéball > Pokédex
   *  volé > rose de James. Non renseigné = 0 (l'auto-résolution retombe sur coût/force). */
  fateRemovalPriority?: number
  /** Pyramid Head — flags Héros/Objet Fatalité (cf. CardInstance). */
  blocksJudgmentTile?: boolean
  immuneToCage?: boolean
  souffranceSurcharge?: boolean
  disablesMetatron?: boolean
  shieldsHostFromVanquish?: boolean
  /** Mr. Monopoly — flags Maisons/Loyer (cf. CardInstance). */
  shadowReducesHouseCost?: boolean
  blocksRent?: boolean
  blocksHousePlacement?: boolean
  blocksHousesWhenPawnHere?: boolean
  reducesPowerGains?: boolean
  /** Mr. Monopoly — Banqueroute : le coût de la carte = la Force (effective) du Héros ciblé. */
  costEqualsTargetStrength?: boolean
  /** Mr. Monopoly — Chien : se déplace vers le pion à la fin de chaque tour. */
  movesTowardPawnEndOfTurn?: boolean
  /** Mr. Monopoly — Règles inventées : +N au coût d'une carte ciblant le Héros porteur. */
  eventTargetSurcharge?: number
  /** Mr. Monopoly — Officier de police : id du lieu Prison où il envoie un Héros à son arrivée. */
  sendsHeroToPrisonOnMove?: string
  /** Mr. Monopoly — Case Départ : +N Pouvoir quand le pion se rend sur ce lieu ou le dépasse. */
  powerOnPawnCrossOrLand?: number
  /** Nombre d'exemplaires dans le paquet. */
  copies: number
  /** Texte de règle français, recopié de la carte. Source de vérité. */
  text: string
  /** URL de l'illustration, servie depuis public/ (ex. '/cards/prince-jean/...'). */
  image: string
  /** Effets immédiats résolus à la mise en jeu (optionnel, ajouté au fil de l'eau). */
  effects?: Effect[]
  /** Effets « à la pose » d'un Héros (Fatalité), résolus sur la CIBLE quand
   *  le Héros est posé sur son plateau. Optionnel — ajouté au fil de l'eau. */
  onPlace?: Effect[]
  /** Effets « à la mort » d'un Héros, résolus sur le joueur qui l'a éliminé
   *  (Toby remélangé dans la pioche Fatalité, Belle Marianne fait apparaître
   *  Robin sur son lieu). */
  onVanquish?: Effect[]
  /** Pour un Héros : lieux où il ne peut être ni posé ni déplacé (Dame Gertrude
   *  ne peut pas aller sur la Prison). */
  forbiddenLocations?: LocationId[]
  /** Pour une Malédiction : restriction imposée à son lieu. */
  placementRestriction?: PlacementRestriction
  /** Héros qui, tant qu'il est en jeu, interdit la pose/le déplacement d'un Allié
   *  sur ce lieu (Cendrillon en robe de bal → Salle de Bal). */
  blocksAlliesAtLocation?: LocationId
  /** Héros qui, tant qu'il est en jeu, immobilise TOUS les Alliés (Ulf). */
  blocksAllyMoves?: boolean
  /** Héros qui immobilise les Alliés présents sur SON lieu uniquement (Syndrome — Frozone). */
  blocksAllyMovesHere?: boolean
  /** Lotso — Rex : protégé (ni Vaincre ni réduction) tant qu'il partage son lieu avec un
   *  autre Héros (ignoré si sa force est 0). */
  protectedWithOtherHero?: boolean
  /** Nombre minimum d'Alliés requis pour éliminer ce Héros (Lotso — Bayonne/Hamm : 2). */
  minAlliesToVanquish?: number
  /** Modificateur passif de force sur les AUTRES cartes du même lieu (aura). */
  strengthMod?: StrengthMod
  /** Modificateurs conditionnels de la PROPRE force de la carte (synergies). */
  selfStrengthMods?: SelfStrengthMod[]
  /** Déclencheur de défausse automatique (typiquement les Malédictions). */
  discardWhen?: CurseDiscardTrigger
  /** Pour une Condition : descripteur du trigger côté adversaire. */
  trigger?: ConditionTrigger
  /** Nombre maximum d'exemplaires de cette carte posés sur un même lieu (Page : 2). */
  maxAtLocation?: number
  /** Jafar : coût (en Pouvoir) de la capacité activée (action « Activer »). La
   *  présence de ce champ indique que la carte porte le symbole Activer. */
  activatedCost?: number
  /** La carte ne peut être posée QUE sur ce lieu (Lampe Merveilleuse → Caverne). */
  playOnlyAt?: string
  /** L'Imposteur — Tâche / Sabotage : seuil de Coéquipiers sur son lieu déclenchant
   *  sa défausse avant le déplacement de fin de tour (+1 avec le Coéquipier imposteur). */
  discardAtCrewmates?: number
  /** L'Imposteur — Sabotage : carte d'objectif (survivre 3 tours) qui attire les
   *  Coéquipiers. */
  isSabotage?: boolean
  /** Capitaine Crochet : Objet qui DONNE une action à son lieu tant qu'il y est
   *  posé (Canon → Vaincre, Boîte à Crochets → Gagner 1, Ingénieux → Déplacer un
   *  Héros). */
  grantsAction?: { type: LocationActionType; amount?: number; label: string }
  /** Ursula — Pacte : lieu lié au Pacte (le Héros porteur est éliminé s'il y est
   *  déplacé). */
  contractLocationId?: LocationId
  /** Hadès — Titan (Lythos, Hydros, Pyros, Stratos, Argès) : Allié spécial déplacé
   *  vers le Mont Olympe pour l'objectif. */
  isTitan?: boolean
  /** Team Rocket — Pokémon : Héros (deck Fatalité) capturé via l'action Attraper
   *  (CATCH_POKEMON) au lieu d'être vaincu. Compte pour l'objectif CAPTURE_POKEMON. */
  isPokemon?: boolean
  /** Team Rocket — Dresseur (Héros Fatalité) : à sa pose, cherche l'un de ces Pokémon
   *  (cardId) dans la pioche Fatalité et le pose sur le même lieu. */
  summonsPokemonCardIds?: string[]
  /** Team Rocket — Allié évolutif : `cardId` de son évolution (Abo→Arbok, Smogo→Smogogo,
   *  Miaouss→Persian). Utilisé par l'Événement « Évolution ». */
  evolvesToCardId?: string
  /** Team Rocket — Pikachu : Pokémon Fatalité « joué d'office dès qu'il est dévoilé ». */
  playWhenRevealed?: boolean
  /** L'Allié peut Éliminer un Héros sur un lieu VOISIN (Flibustiers, Cerbère). */
  reachesAdjacentVanquish?: boolean
  /** L'Allié peut Éliminer un Héros sur N'IMPORTE QUEL lieu (Team Rocket — Persian). */
  reachesAnyLocationVanquish?: boolean
  /** Objet « véhicule » : sur son lieu, on peut 1×/tour déplacer la figurine + cet
   *  Objet vers n'importe quel lieu et y faire une action (hors Fatalité).
   *  Hadès — Char ; Bowser — Bateau (même mécanisme, voir applyChariotMove). */
  ridesWithPawn?: boolean
  /** Allié qui retourne en main au lieu d'être défaussé après un Vanquish (Hydre). */
  returnToHandOnVanquish?: boolean
  /** Dr Facilier — comportement de la carte révélée depuis la Pile de l'Au-delà
   *  (Divination). Absent = simple défausse si révélée. */
  auDela?: AuDelaEffect
  /** Dr Facilier — l'Événement va dans la Pile de l'Au-delà au lieu de la défausse
   *  quand il est joué (Amis de l'au-delà, Régner sur la Nouvelle-Orléans). */
  goesToAuDelaOnPlay?: boolean
  /** La carte compte AUSSI comme un Objet (Esprits des masques = Allié + Objet) :
   *  ciblable par les effets « Objet » (Joujou). */
  alsoItem?: boolean
  /** Héros qui doit être éliminé AVANT les autres Héros du royaume (Prof —
   *  La Méchante Reine ; même logique que Provocation). */
  mustDefeatFirst?: boolean
  /** Héros Fatalité posé OBLIGATOIREMENT sur ce lieu (même verrouillé), quel que
   *  soit le choix de l'adversaire (Blanche-Neige → Maison des Nains). */
  forcedFateLocation?: LocationId
  /** Fatalité : si cette carte fait partie des DEUX cartes dévoilées, le joueur qui
   *  pose la Fatalité PEUT jouer les deux (au lieu d'en défausser une). La 2ᵉ reste
   *  facultative (Ray — Dr Facilier ; Dormeur — La Méchante Reine). */
  fatePlayBoth?: boolean
  /** Scar — Allié « Hyène » : utilisé par ses synergies (force par Hyène, jeux
   *  gratuits, défausses comptées…). */
  isHyena?: boolean
  /** Scar — carte injouable s'il n'y a aucune Hyène dans le royaume (Festin :
   *  rien à déplacer sinon). */
  requiresHyenaInRealm?: boolean
  /** Team Rocket — Évolution : injouable s'il n'y a aucun Allié dans le royaume
   *  (rien à faire évoluer). */
  requiresAllyInRealm?: boolean
  /** Le Seigneur des Ténèbres — Mort-vivant du Chaudron : jouable seulement quand le
   *  Chaudron Noir est activé (`blackCauldron === 'powered'`). */
  requiresPoweredCauldron?: boolean
  /** Le Seigneur des Ténèbres — Mort-vivant du Chaudron : à la pose, « échange » un
   *  Objet de ce cardId présent sur le lieu de destination (défaussé). Le lieu doit en
   *  porter un, sinon la carte est injouable. */
  consumesItemCardId?: string
  /** Héros qui interdit au joueur de jouer des Événements tant qu'il est en jeu
   *  (Roi Richard, Tirelire). */
  blocksVillainEvents?: boolean
  /** Héros qui interdit la pose de l'Objet de ce cardId sur SON lieu (Les Elfes →
   *  Squelettes de Soldats). */
  blocksItemPlacement?: string
  /** Allié déplacé sur le lieu du pion au lieu d'être défaussé après une action
   *  Éliminer un Héros à laquelle il participe (Crapaud). */
  relocateToPawnOnVanquish?: boolean
  /** Sa Sucrerie — Cybug en Sucre : au lieu d'être défaussé après une action Éliminer
   *  un Héros, l'Allié RESTE en jeu, gagne ce nombre en Force (cumulatif) et est déplacé
   *  sur un lieu au choix. */
  survivesVanquishGain?: number
  /** Carte « jouée OU déplacée » : ses `effects` se redéclenchent aussi quand l'Allié/
   *  Objet est déplacé entre deux lieux (en plus de la pose). Ex. Pilotes (Sa Sucrerie) :
   *  GAIN_POWER 1 à la pose ET à chaque déplacement. */
  effectsAlsoOnMove?: boolean
  /** Carte jouable SANS action « Jouer une carte » (en payant son coût) : elle peut être
   *  jouée à tout moment du tour et ne consomme aucune action de lieu. Ex. Turbo-Statique
   *  (Sa Sucrerie). */
  playableWithoutAction?: boolean
  /** Carte jouable uniquement AVANT d'avoir effectué une action de lieu ce tour (après
   *  le déplacement du pion). Ex. L'important, c'est de payer (Sa Sucrerie). */
  playableOnlyBeforeActions?: boolean
  /** Shere Khan — Baloo : tant que ce Héros est dans le royaume, AUCUN autre Héros ne peut
   *  être éliminé ; chaque tentative pose à la place un jeton Pouvoir sur lui, et à
   *  `shieldsOtherHeroesUntilTokens` jetons il est défaussé (avec ses jetons). */
  shieldsOtherHeroesUntilTokens?: number
  /** Héros (Fatalité) qui, tant qu'il est dans le royaume, augmente de N le coût de
   *  TOUTE carte jouée (« l'action Jouer une carte coûte N de plus »). Ex. Sergent
   *  Calhoun (Sa Sucrerie, +1). Cumulatif par exemplaire présent. */
  playCardCostSurcharge?: number
  /** Carte Fatalité (Héros ou Objet associé) qui fait perdre N jetons Pouvoir au vilain
   *  quand sa figurine ARRIVE sur le lieu de cette carte. Ex. Chicha (Yzma, 2),
   *  Zirgouflex (Ursula, 1). Cumulatif ; plancher 0. */
  powerLossOnPawnArrive?: number
  /** Héros (Fatalité) qui renchérit de N le coût d'un PACTE qui le cible (Roi Triton,
   *  Ursula, +1). Appliqué à la pose via `attachTo` (cf. applyPlayCard). Les Événements
   *  ciblant ce Héros ne sont pas couverts (cible choisie après le paiement). */
  pacteTargetSurcharge?: number
  /** Héros (Fatalité) qui, tant qu'il est dans le royaume, fait coûter N jetons Pouvoir
   *  l'action « Déplacer un Objet ou un Allié » (normalement gratuite). Ex. Ralph la Casse
   *  (Sa Sucrerie, +1). Cumulatif par exemplaire. */
  moveActionSurcharge?: number
  /** Sombra — carte de « Piratage » (Piratage, IEM) : posée sur un lieu, NON
   *  déplaçable, et comptée comme un Objet pour les conditions adverses. Le lieu qui
   *  en porte une est « piraté ». `hackDisablesAction` : à la pose, le joueur
   *  désactive une action du lieu (recouverte par l'image Hack) tant que le piratage
   *  reste (Piratage = oui ; IEM = non). */
  isPiratage?: boolean
  hackDisablesAction?: boolean
  /** Objet qui résout ses effets puis est DÉFAUSSÉ au lieu de rester sur le plateau
   *  (Sombra — Faille). */
  discardOnPlay?: boolean
  /** Pat Hibulaire — Grillon : Allié qui peut suivre chaque Héros joué dans le
   *  royaume (déplacé auto sur le lieu du Héros). */
  followsHeroes?: boolean
  /** Pat Hibulaire — Bandit : plusieurs exemplaires jouables lors d'une même action
   *  « Jouer une carte ». */
  playMultiplePerAction?: boolean
  /** Gaston — Lefou : un Vanquish effectué sur SON lieu ne défausse pas les Alliés
   *  utilisés (ils retournent en main). */
  keepAlliesOnVanquishHere?: boolean
  /** Le Seigneur des clés — Appel : pioche 1 carte quand le Seigneur est ciblé par
   *  une Fatalité. */
  drawCardOnFateTargeted?: boolean
  /** Le Seigneur des clés — Hellin : Héros qui recouvre UNE action de plus. */
  coversExtraAction?: boolean
  /** Madame de Trémaine — Allié « en robe de bal » : jouable uniquement pour
   *  remplacer l'Allié `replacesCardId` déjà en jeu (défaussé au passage). */
  replacesCardId?: string
  /** Madame Mim — Métamorphose Mim (Allié) : ne peut éliminer QUE la Métamorphose de
   *  Merlin (Héros) de ce cardId. */
  transformationTarget?: string
  /** Madame Mim — drapeaux : Métamorphose Mim (Allié, deck Méchant) / de Merlin (Héros,
   *  deck Merlin). */
  isMimTransformation?: boolean
  isMerlinTransformation?: boolean
  /** Tamatoa — drapeaux (cf. CardInstance). */
  isMauiCard?: boolean
  joinsAlliesOnAllyPlay?: boolean
  moveAnyCardOnVanquish?: boolean
  gainPowerWhenFated?: number
  triggersMauiDeck?: boolean
  shieldsHeroesAtLocation?: boolean
  coversActionsLikeHero?: boolean
  selfDiscardOnPawnEndTurnHere?: boolean
  /** Syndrome — Énergie au Point Zéro (Objet associé à un Héros) : empêche de déplacer
   *  le Héros hôte (en plus de son `attachStrengthBonus` négatif). */
  immobilizesHostHero?: boolean
  /** Syndrome — Champ de Force (Objet Fatalité associé à un Héros) : défaussé à la place
   *  du Héros s'il doit être éliminé (bouclier). */
  shieldHeroFromVanquish?: boolean
  /** Syndrome — Télécommande : compte comme Objet pour les conditions adverses mais
   *  n'est pas affectée par les effets visant Alliés/Objets (défausser/déplacer). */
  immuneToAllyItemEffects?: boolean
  /** IA uniquement : classement « malus » de cette carte Fatalité durable pour le
   *  joueur ciblé. Renseigné via `data/fateMalus.ts` et attaché par le registre
   *  (pas dans les `.cards.ts`). Absent = NEUTRE. */
  fateMalus?: FateMalus
  /** Oogie Boogie — carte jouée en réaction, pas via « Jouer une carte » (Dés pipés :
   *  relance un dé pendant un lancer). Injouable normalement. */
  reactiveOnly?: boolean
  // --- Davy Jones (Jetons Trésor) ------------------------------------------
  /** Héros (Jack Sparrow) : bloque l'action Éliminer tant que le pion de Davy est sur son lieu. */
  blocksVanquishHere?: boolean
  /** Allié (Le Second Maccus) : utilisé pour un Vanquish, on peut défausser un autre Allié à sa place. */
  survivesVanquishByDiscardingAlly?: boolean
  /** Allié (Le Kraken) : pas défaussé quand il élimine un Héros à Trésor révélé. */
  survivesVanquishWithRevealedTreasure?: boolean
  /** Allié (Hadras) : quand défaussé, révèle un jeton Trésor sur un Héros. */
  revealTreasureOnDiscard?: boolean
  /** Objet Fatalité (Le Black Pearl) : à la mort de l'hôte, se réassocie à un autre Héros du lieu. */
  reattachOnHostDefeat?: boolean
  // --- Dio Brando ----------------------------------------------------------
  /** Dio — carte « Stand » HORS deck (sauf The World) : séparée dans `standPile` au setup,
   *  entre en jeu uniquement par fetch (associée à sa carte invocatrice). */
  isStand?: boolean
  /** Dio — The World : suit toujours le pion (déplacé avec lui). */
  followsPawn?: boolean
  /** Dio — The World : ne peut jamais être défaussé. */
  cannotBeDiscarded?: boolean
  /** Dio — carte invocatrice : va chercher ce Stand dans `standPile` et se l'associe. */
  summonsStandCardId?: string
  /** Dio — Héros (Jotaro / Joseph) retiré du jeu quand il est vaincu (pas en défausse). */
  removedFromGameOnDefeat?: boolean
  /** Effets résolus UNIQUEMENT via « Activer une capacité » (Objets/Stands « Activer » :
   *  La flèche, Masque de pierre, Justice). Distinct de `effects` (qui se résout à la pose). */
  activatedEffects?: Effect[]
  // --- La Bonne Fée --------------------------------------------------------
  /** Objet de TRANSFORMATION (Héros en Meuble ! / en Colombe !) : associé à un Héros,
   *  réduit la force EFFECTIVE de son hôte à 0 (réversible : retiré = force restaurée).
   *  Marque aussi le Héros comme « transformé » (défaussable par « Nettoyage de fond »). */
  zeroesHostStrength?: boolean
  /** Héros (Fatalité) qui renchérit de N le coût de l'action « Activer » une capacité
   *  d'un Objet/Allié situé sur SON lieu (La Bonne Fée — l'Âne, +1). Cumulatif. */
  activateCostSurchargeHere?: number
  /** Héros (Fatalité) qui interdit de jouer OU de déplacer un Objet sur SON lieu
   *  (La Bonne Fée — Harold & Lillian). */
  blocksAllItemsHere?: boolean
  /** Objet associé à un Héros qui empêche d'associer à ce même Héros un Objet dont le
   *  cardId figure dans cette liste (La Bonne Fée — Humainement beau protège de
   *  « Héros en Meuble ! »). */
  protectsHostFromCardIds?: string[]
  /** Potion (La Bonne Fée — Filtre d'amour / Heureux pour toujours) : cible de la
   *  « Réserve de potions » et des 2 potions requises par l'objectif. */
  isPotion?: boolean
}

/** Développe une liste de définitions en un paquet concret (un élément par
 *  exemplaire), prêt à être mélangé. */
export function buildDeck(cards: CardDef[], deck: DeckKind): CardDef[] {
  return cards
    .filter((c) => c.deck === deck)
    .flatMap((c) => Array.from({ length: c.copies }, () => c))
}

/** Développe un deck en exemplaires jouables (CardInstance) avec des id uniques.
 *  Recopie les champs de jeu pour que le moteur n'ait pas besoin de data/.
 *  `prefix` permet de garantir des instanceId uniques entre joueurs (ex. 'p0:'). */
export function buildDeckInstances(
  cards: CardDef[],
  deck: DeckKind,
  prefix = '',
): CardInstance[] {
  return cards
    .filter((c) => c.deck === deck)
    .flatMap((c) =>
      Array.from(
        { length: c.copies },
        (_, i): CardInstance => ({
          instanceId: `${prefix}${c.id}#${i + 1}`,
          cardId: c.id,
          name: c.name,
          type: c.type,
          cost: c.cost,
          strength: c.strength,
          attach: c.attach,
          attachOnlyCardId: c.attachOnlyCardId,
          attachStrengthBonus: c.attachStrengthBonus,
          shieldAllyFromDiscard: c.shieldAllyFromDiscard,
          fateRemovalPriority: c.fateRemovalPriority,
          blocksJudgmentTile: c.blocksJudgmentTile,
          immuneToCage: c.immuneToCage,
          souffranceSurcharge: c.souffranceSurcharge,
          disablesMetatron: c.disablesMetatron,
          shieldsHostFromVanquish: c.shieldsHostFromVanquish,
          shadowReducesHouseCost: c.shadowReducesHouseCost,
          blocksRent: c.blocksRent,
          blocksHousePlacement: c.blocksHousePlacement,
          blocksHousesWhenPawnHere: c.blocksHousesWhenPawnHere,
          reducesPowerGains: c.reducesPowerGains,
          costEqualsTargetStrength: c.costEqualsTargetStrength,
          movesTowardPawnEndOfTurn: c.movesTowardPawnEndOfTurn,
          eventTargetSurcharge: c.eventTargetSurcharge,
          sendsHeroToPrisonOnMove: c.sendsHeroToPrisonOnMove,
          powerOnPawnCrossOrLand: c.powerOnPawnCrossOrLand,
          effects: c.effects,
          onPlace: c.onPlace,
          onVanquish: c.onVanquish,
          forbiddenLocations: c.forbiddenLocations,
          placementRestriction: c.placementRestriction,
          blocksAlliesAtLocation: c.blocksAlliesAtLocation,
          blocksAllyMoves: c.blocksAllyMoves,
          blocksAllyMovesHere: c.blocksAllyMovesHere,
          protectedWithOtherHero: c.protectedWithOtherHero,
          minAlliesToVanquish: c.minAlliesToVanquish,
          strengthMod: c.strengthMod,
          selfStrengthMods: c.selfStrengthMods,
          discardWhen: c.discardWhen,
          trigger: c.trigger,
          maxAtLocation: c.maxAtLocation,
          activatedCost: c.activatedCost,
          playOnlyAt: c.playOnlyAt,
          discardAtCrewmates: c.discardAtCrewmates,
          isSabotage: c.isSabotage,
          grantsAction: c.grantsAction,
          contractLocationId: c.contractLocationId,
          isTitan: c.isTitan,
          isPokemon: c.isPokemon,
          summonsPokemonCardIds: c.summonsPokemonCardIds,
          reachesAdjacentVanquish: c.reachesAdjacentVanquish,
          reachesAnyLocationVanquish: c.reachesAnyLocationVanquish,
          ridesWithPawn: c.ridesWithPawn,
          returnToHandOnVanquish: c.returnToHandOnVanquish,
          auDela: c.auDela,
          goesToAuDelaOnPlay: c.goesToAuDelaOnPlay,
          alsoItem: c.alsoItem,
          mustDefeatFirst: c.mustDefeatFirst,
          forcedFateLocation: c.forcedFateLocation,
          fatePlayBoth: c.fatePlayBoth,
          isHyena: c.isHyena,
          requiresHyenaInRealm: c.requiresHyenaInRealm,
          requiresAllyInRealm: c.requiresAllyInRealm,
          evolvesToCardId: c.evolvesToCardId,
          playWhenRevealed: c.playWhenRevealed,
          requiresPoweredCauldron: c.requiresPoweredCauldron,
          consumesItemCardId: c.consumesItemCardId,
          blocksVillainEvents: c.blocksVillainEvents,
          blocksItemPlacement: c.blocksItemPlacement,
          relocateToPawnOnVanquish: c.relocateToPawnOnVanquish,
          survivesVanquishGain: c.survivesVanquishGain,
          effectsAlsoOnMove: c.effectsAlsoOnMove,
          playableWithoutAction: c.playableWithoutAction,
          playableOnlyBeforeActions: c.playableOnlyBeforeActions,
          shieldsOtherHeroesUntilTokens: c.shieldsOtherHeroesUntilTokens,
          playCardCostSurcharge: c.playCardCostSurcharge,
          powerLossOnPawnArrive: c.powerLossOnPawnArrive,
          pacteTargetSurcharge: c.pacteTargetSurcharge,
          moveActionSurcharge: c.moveActionSurcharge,
          isPiratage: c.isPiratage,
          hackDisablesAction: c.hackDisablesAction,
          discardOnPlay: c.discardOnPlay,
          followsHeroes: c.followsHeroes,
          playMultiplePerAction: c.playMultiplePerAction,
          keepAlliesOnVanquishHere: c.keepAlliesOnVanquishHere,
          drawCardOnFateTargeted: c.drawCardOnFateTargeted,
          coversExtraAction: c.coversExtraAction,
          replacesCardId: c.replacesCardId,
          reactiveOnly: c.reactiveOnly,
          transformationTarget: c.transformationTarget,
          isMimTransformation: c.isMimTransformation,
          isMerlinTransformation: c.isMerlinTransformation,
          isMauiCard: c.isMauiCard,
          joinsAlliesOnAllyPlay: c.joinsAlliesOnAllyPlay,
          moveAnyCardOnVanquish: c.moveAnyCardOnVanquish,
          gainPowerWhenFated: c.gainPowerWhenFated,
          triggersMauiDeck: c.triggersMauiDeck,
          shieldsHeroesAtLocation: c.shieldsHeroesAtLocation,
          coversActionsLikeHero: c.coversActionsLikeHero,
          selfDiscardOnPawnEndTurnHere: c.selfDiscardOnPawnEndTurnHere,
          immobilizesHostHero: c.immobilizesHostHero,
          shieldHeroFromVanquish: c.shieldHeroFromVanquish,
          immuneToAllyItemEffects: c.immuneToAllyItemEffects,
          blocksVanquishHere: c.blocksVanquishHere,
          survivesVanquishByDiscardingAlly: c.survivesVanquishByDiscardingAlly,
          survivesVanquishWithRevealedTreasure: c.survivesVanquishWithRevealedTreasure,
          revealTreasureOnDiscard: c.revealTreasureOnDiscard,
          reattachOnHostDefeat: c.reattachOnHostDefeat,
          isStand: c.isStand,
          followsPawn: c.followsPawn,
          cannotBeDiscarded: c.cannotBeDiscarded,
          summonsStandCardId: c.summonsStandCardId,
          removedFromGameOnDefeat: c.removedFromGameOnDefeat,
          activatedEffects: c.activatedEffects,
          zeroesHostStrength: c.zeroesHostStrength,
          activateCostSurchargeHere: c.activateCostSurchargeHere,
          blocksAllItemsHere: c.blocksAllItemsHere,
          protectsHostFromCardIds: c.protectsHostFromCardIds,
          isPotion: c.isPotion,
        }),
      ),
    )
}

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
  /** Thanos — carte PIERRE D'INFINITÉ : « hors deck » (séparée dans `stoneSupply` au
   *  setup). N'entre pas dans le paquet de 30. Cf. CardInstance.isInfinityStone. */
  isInfinityStone?: boolean
  /** Thanos — Mâchoire d'Ébène : non défaussé s'il élimine chez un adversaire détenant
   *  une Pierre d'Infinité. Cf. CardInstance. */
  survivesVanquishVsStoneHolder?: boolean
  /** Nombre d'exemplaires dans le paquet. */
  copies: number
  /** Texte de règle français, recopié de la carte. Source de vérité. */
  text: string
  /** URL de l'illustration, servie depuis public/ (ex. '/cards/prince-jean/...'). */
  image: string
  /** Effets immédiats résolus à la mise en jeu (optionnel, ajouté au fil de l'eau). */
  effects?: Effect[]
  /** Gul'dan — carte « Artéfact » : jouée, elle est comptée dans les Artéfacts
   *  possédés (objectif : posséder les 4 pour ouvrir la Porte des Ténèbres). Sert aussi
   *  aux Héros qui renchérissent (Medivh) ou neutralisent (Khadgar) les Artéfacts. */
  isArtifact?: boolean
  /** Gul'dan — Corruption : une fois jouée, la carte RESTE posée sur le lieu du pion
   *  (elle « corrompt » le lieu) au lieu d'aller en défausse. */
  staysOnLocationOnPlay?: boolean
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
  /** Héros qui ne peut JAMAIS être déplacé en tant que Héros (Grand Councilwoman —
   *  STITCH). Exclu de toutes les relocalisations de Héros. Exception : une fois enfermé
   *  (associé à la CAGE via `attachedTo`), il est transporté quand la CAGE est déplacée. */
  cannotBeMoved?: boolean
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
  /** Condition jouable UNIQUEMENT dans la fenêtre de réaction de FIN DE TOUR adverse
   *  (Michael — Aura effrayante). Les autres Conditions se jouent en cours de tour. */
  reactAtEndOfTurn?: boolean
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
  /** Gul'dan — Medivh (Fatalité) : tant que ce Héros est en jeu, jouer un Artéfact
   *  (`isArtifact`) coûte N Pouvoir de plus (cumulatif par Héros de ce type). */
  increasesArtifactCost?: number
  /** Gul'dan — Illidan (Fatalité) : tant que ce Héros est en jeu, les cartes dont le
   *  cardId figure ici sont INJOUABLES (ex. le Crâne de Gul'dan). */
  blocksCardIds?: string[]
  /** Gul'dan — Khadgar (Fatalité) : tant que ce Héros est en jeu, un Artéfact posé ne
   *  déclenche PAS son effet et Manipulation ne peut rien dupliquer. */
  nullifiesArtifacts?: boolean
  /** Isabella — Activité : heures (index 0..5 = XII, II, IV, VI, VIII, X) auxquelles la
   *  carte peut être jouée. Injouable hors de ces heures. */
  allowedHours?: number[]
  /** Isabella — passifs des Héros Fatalité (cf. CardInstance). */
  eventCostSurcharge?: number
  eventCostDiscountWhenLoved?: number
  activateSurcharge?: number
  activiteCostDiscountWhenLoved?: number
  drawToAtEndOfTurnWhenLoved?: number
  powerPerLovedAtTurnStartWhenLoved?: number
  unlocksCoveredActionsHere?: boolean
  bornEnlarged?: boolean
  immuneToIncendieWhenLoved?: boolean
  drawWhenFatedWhenLoved?: boolean
  powerPenaltyOnPawnArrive?: number
  discardItemOnPawnArrive?: boolean
  /** Gul'dan — Fatalité (Événement) qui se POSE sur un lieu au lieu de se défausser
   *  (Armée de la Lumière, Kil'jaeden) : routée vers le choix de lieu (pendingFateObjectPlace). */
  fateAttachesToLocation?: boolean
  /** Gul'dan — Armée de la Lumière (Fatalité posée) : empêche la corruption de son lieu. */
  blocksCorruptionHere?: boolean
  /** Gul'dan — Kil'jaeden (Fatalité posée) : Gul'dan perd N Pouvoir au début de chaque tour. */
  drainsPowerAtTurnStart?: number
  /** Gul'dan — Armée de la Lumière : défaussable en payant N Pouvoir (à tout moment). */
  fateRemovalPowerCost?: number
  /** Gul'dan — Kil'jaeden : défaussable seulement une fois les 4 lieux corrompus. */
  discardWhenAllCorrupted?: boolean
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
  /** Le Flagelleur Mental — Démogorgon : +N Pouvoir à chaque déplacement de cet Allié
   *  (au déplacement seulement, pas à la pose). */
  powerOnMove?: number
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
  /** Le Seigneur des Ténèbres — Soldats Ressuscités : cet Allié n'est PAS défaussé
   *  lorsqu'il participe à une action Éliminer un Héros — il RESTE en jeu à sa place
   *  (armée immortelle). N'affecte QUE le Vanquish. */
  survivesVanquishInPlace?: boolean
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
  // --- Le Piégeur (Dead by Daylight) ---------------------------------------
  /** Le Piégeur — carte SURVIVANT (hors-deck, paquet « Survivant ») : séparée du deck
   *  Fatalité au setup et posée FACE CACHÉE, une par lieu. Révélée par une carte du
   *  Piégeur (elle recouvre alors les actions comme un Héros + déclenche son effet). */
  isSurvivor?: boolean
  // --- Dio Brando ----------------------------------------------------------
  /** Dio — carte « Stand » HORS deck (sauf The World) : séparée dans `standPile` au setup,
   *  entre en jeu uniquement par fetch (associée à sa carte invocatrice). */
  isStand?: boolean
  /** Dio — The World : suit toujours le pion (déplacé avec lui). */
  followsPawn?: boolean
  /** Dio — The World : ne peut jamais être défaussé. */
  cannotBeDiscarded?: boolean
  /** Le Flagelleur Mental — Billy sous emprise : ne peut PAS être défaussé pour payer
   *  le coût en Alliés d'un Tunnel de Hawkins (défaussable autrement). */
  cannotDiscardForTunnel?: boolean
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
  /** Tabbou — Link : tant que ce Héros est dans le royaume, l'action « Dévoiler une
   *  tuile Combattant » ne peut dévoiler que N tuiles au maximum par usage. */
  fighterRevealCap?: number
  /** Tabbou — Kirby : renchérit de N le coût (en Pouvoir) de l'action « Dévoiler une
   *  tuile Combattant » tant que ce Héros est dans le royaume. Cumulatif. */
  fighterRevealSurcharge?: number
  /** Tabbou — Canon Obscur : les cartes Objets coûtent N de moins tant que le pion
   *  se trouve sur le même lieu que cette carte (cumulatif). */
  itemCostReductionHere?: number
  /** Ultron (Marvel) — SENTINELLE (« Drone ») : classification d'Allié référencée par les
   *  tuiles Amélioration et certaines cartes (« retirer/défausser un Drone »). */
  isSentry?: boolean
  // --- Michael Myers (Halloween) -------------------------------------------
  /** ARME (« associée à Meyers ») : entre dans la zone Arme équipée (une seule à la fois).
   *  Le coût de la carte (`cost`) sert de base variable à ASSASSINER. */
  isWeapon?: boolean
  /** ARME : effets « quand vous éliminez un Héros » avec cette arme équipée (désactivés
   *  tant qu'un Héros `disablesEquippedWeapon` — Jaime Strode — est présent). */
  weaponOnKill?: Effect[]
  /** ASSASSINER : le coût de la carte = le coût de l'Arme équipée (variable). */
  costEqualsWeaponCost?: boolean
  /** Héros hors-deck (LAURIE) : séparé du paquet Fatalité au setup dans `reserveHeroes`
   *  (n'entre en jeu que via « Gardons le meilleur pour la fin »). */
  startsInReserve?: boolean
  /** Injouable tant que le Mal Intérieur du vilain n'atteint pas ce palier (Gardons le
   *  meilleur pour la fin : 3). */
  requiresMalInterieur?: number
  /** Héros (LAURIE) : le coût pour l'ASSASSINER augmente de N par AUTRE Héros du royaume. */
  assassinateSurchargePerOtherHero?: number
  /** Héros (JAIME STRODE) : tant qu'il est présent, l'effet « quand vous éliminez » de
   *  l'Arme équipée est désactivé. */
  disablesEquippedWeapon?: boolean
}

/** Développe une liste de définitions en un paquet concret (un élément par
 *  exemplaire), prêt à être mélangé. */
export function buildDeck(cards: CardDef[], deck: DeckKind): CardDef[] {
  return cards
    .filter((c) => c.deck === deck)
    .flatMap((c) => Array.from({ length: c.copies }, () => c))
}

/** Champs de `CardDef` qui NE sont PAS des champs de jeu recopiés dans une
 *  `CardInstance` : identité de deck-building, présentation, ou méta d'IA. `id` devient
 *  `cardId`. TOUT LE RESTE est un champ de jeu, recopié tel quel par `buildDeckInstances`.
 *  → Ajouter un champ de jeu = l'ajouter à `CardDef` ET `CardInstance`, rien d'autre ici.
 *  (`as const satisfies (keyof CardDef)[]` : garde-fou contre une faute de frappe.) */
const NON_INSTANCE_CARD_FIELDS = [
  'id',
  'englishName',
  'deck',
  'copies',
  'text',
  'image',
  'costVariable', // purement visuel (pastille « ? ») — le vrai coût est calculé au jeu
  'fateMalus', // indice IA lu via le registre (getCardDef), pas par le moteur
] as const satisfies readonly (keyof CardDef)[]

/** Champs de JEU d'une carte = `CardDef` privé des champs ci-dessus. */
type GameCardFields = Omit<CardDef, (typeof NON_INSTANCE_CARD_FIELDS)[number]>

// GARDE-FOU COMPILE-TIME : tout champ de jeu de `CardDef` doit exister sur `CardInstance`,
// sinon `buildDeckInstances` le recopierait sans qu'il soit typé côté moteur. Si cette ligne
// passe au ROUGE, ajoute le champ manquant à `CardInstance` (engine/types.ts) — le tuple
// d'erreur nomme précisément le champ fautif.
type _GameFieldsOnInstance = keyof GameCardFields extends keyof CardInstance
  ? true
  : ['champ de jeu absent de CardInstance :', Exclude<keyof GameCardFields, keyof CardInstance>]
const _assertGameFieldsOnInstance: _GameFieldsOnInstance = true
void _assertGameFieldsOnInstance

/** Ensemble runtime des champs à exclure (dérivé de la même liste : source unique). */
const NON_INSTANCE_CARD_FIELD_SET: ReadonlySet<string> = new Set(NON_INSTANCE_CARD_FIELDS)

/** Développe un deck en exemplaires jouables (CardInstance) avec des id uniques.
 *  Recopie GÉNÉRIQUEMENT tous les champs de jeu (tout sauf `NON_INSTANCE_CARD_FIELDS`) pour
 *  que le moteur n'ait pas besoin de data/. `prefix` garantit des instanceId uniques entre
 *  joueurs (ex. 'p0:'). */
export function buildDeckInstances(
  cards: CardDef[],
  deck: DeckKind,
  prefix = '',
): CardInstance[] {
  return cards
    .filter((c) => c.deck === deck)
    .flatMap((c) => {
      // Champs de jeu = toutes les entrées de la carte sauf celles exclues (présentation…).
      const game = Object.fromEntries(
        Object.entries(c).filter(([k]) => !NON_INSTANCE_CARD_FIELD_SET.has(k)),
      ) as GameCardFields
      return Array.from(
        { length: c.copies },
        (_, i): CardInstance => ({
          ...game,
          instanceId: `${prefix}${c.id}#${i + 1}`,
          cardId: c.id,
        }),
      )
    })
}

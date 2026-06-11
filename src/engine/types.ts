// =============================================================================
// Types du domaine — Moteur de jeu Villainous
//
// CONTRAINTE ARCHITECTURALE : ce fichier (et tout le dossier engine/) ne doit
// JAMAIS importer React, Zustand, ni quoi que ce soit lié à l'UI. Le moteur est
// pur : il reçoit un GameState + une GameAction et renvoie un nouveau GameState.
// Le moteur ne sait pas qui joue (humain ou bot).
// =============================================================================

/** Identifiant d'un lieu. Volontairement `string` : le moteur est agnostique
 *  du vilain. Les lieux concrets sont définis dans data/villains/. */
export type LocationId = string

/** Identifiant d'un vilain (ex. 'princeJohn'). */
export type VillainId = string

/**
 * Types d'actions de lieu. Pour l'Étape 1, seul GAIN_POWER est résolu par le
 * moteur ; les autres sont déjà listés pour que les étapes suivantes n'aient
 * qu'à les implémenter dans le dispatcher (actions.ts), sans toucher aux types.
 */
export type LocationActionType =
  | 'GAIN_POWER'
  | 'PLAY_CARD'
  | 'FATE'
  | 'MOVE_ITEM_ALLY'
  | 'MOVE_HERO'
  | 'VANQUISH'
  | 'DISCARD_CARDS'
  /** Jafar : activer la capacité d'un Allié/Objet portant le symbole « Activer »
   *  (Iago, Sceptre Serpent). Capacités activées — implémentation à venir. */
  | 'ACTIVATE'

/** Rangée d'une action sur le plateau. Les héros recouvrent la rangée du HAUT
 *  d'un lieu : la position est donc structurante pour la mécanique de Fatalité
 *  (implémentée aux étapes suivantes). */
export type ActionRow = 'top' | 'bottom'

/** Une action disponible sur un lieu. */
export interface LocationAction {
  /** Identifiant stable, unique au sein d'un lieu (ex. 'gain-power'). */
  id: string
  type: LocationActionType
  /** Libellé affiché à l'utilisateur. */
  label: string
  /** Rangée (haut/bas) telle qu'imprimée sur le plateau. */
  row: ActionRow
  /** Montant de pouvoir gagné, pour les actions GAIN_POWER. */
  amount?: number
}

/** Un lieu du plateau d'un vilain. */
export interface Location {
  id: LocationId
  name: string
  actions: LocationAction[]
}

/**
 * Définition statique d'un vilain (données, voir data/villains/). Sert à
 * construire l'état initial via createInitialGame().
 */
export interface VillainDef {
  id: VillainId
  name: string
  /** Plateau : exactement 4 lieux dans l'ordre d'affichage. */
  locations: Location[]
  /** Condition de victoire data-driven (interprétée par engine/rules.ts). */
  objective: ObjectiveDef
  /** Description lisible de la condition de victoire. */
  objectiveDescription: string
  /** URL de l'image du plateau (servie depuis public/). */
  boardImage: string
  /** URL de l'image du pion. */
  pawnImage: string
  /** Hauteur d'affichage du pion en pixels (les pions ont des proportions
   *  différentes : PJ trapu, Maléfique élancée). */
  pawnHeightPx: number
  /** Dos de carte Vilain. */
  backVillainImage: string
  /** Dos de carte Fatalité. */
  backFateImage: string
  /** Lieux VERROUILLÉS à la mise en place (Jafar : la Caverne aux Merveilles).
   *  Recopié dans PlayerState.lockedLocations. Absent = aucun verrou. */
  lockedLocationsAtStart?: LocationId[]
}

/**
 * Descripteur d'objectif d'un vilain. Le moteur sait évaluer chaque variant ;
 * ajouter un nouvel objectif = un variant + un case dans hasReachedObjective.
 */
export type ObjectiveDef =
  /** Atteindre un seuil de pouvoir au début de son tour (Prince Jean = 20). */
  | { type: 'POWER_THRESHOLD'; threshold: number }
  /** Avoir au moins une carte de type 'curse' (Malédiction Maléfique) sur
   *  chacun des 4 lieux du royaume. */
  | { type: 'CURSE_EACH_LOCATION' }
  /** Avoir au moins `count` exemplaires d'une carte donnée (`cardId`) posés dans
   *  le royaume, tous lieux confondus (Slenderman : 8 Pages). */
  | { type: 'CARDS_IN_REALM'; cardId: string; count: number }
  /** Contrôler un Héros précis (hypnotisé) ET avoir un Objet précis posé sur un
   *  lieu donné (Jafar : Génie sous Hypnose + Lampe Merveilleuse au Palais du
   *  Sultan). */
  | {
      type: 'CONTROL_HERO'
      /** cardId du Héros à contrôler (hypnotisé). */
      heroCardId: string
      /** cardId de l'Objet requis. */
      itemCardId: string
      /** Lieu où l'Objet doit se trouver. */
      itemLocationId: LocationId
    }
  /** Reine de Cœur : réussir un Coup Royal (un arceau sur chaque lieu + condition
   *  de la carte). La victoire est déclenchée par la carte Coup Royal, pas par un
   *  contrôle passif en début de tour. */
  | { type: 'ROYAL_CROQUET' }

/** Phase courante à l'intérieur d'un tour. */
export type TurnPhase =
  /** Déplacement obligatoire vers un lieu différent. */
  | 'MOVE'
  /** Exécution des actions du lieu courant. */
  | 'ACTION'

/** Statut global de la partie. */
export type GameStatus = 'PLAYING' | 'WON'

/** Catégorie de carte. Concept de jeu (pas de présentation) → vit dans le moteur.
 *  'curse' = type unique à Maléfique : posé sur un lieu, applique un effet
 *  passif et a une condition de défausse propre. */
export type CardType = 'ally' | 'item' | 'effect' | 'condition' | 'hero' | 'curse'

/**
 * Effet composable d'une carte, exécuté par le dispatcher (engine/effects.ts).
 * Union volontairement minimale pour l'instant — on l'étend au fur et à mesure
 * sans toucher au reste du moteur.
 */
export type Effect =
  | { type: 'GAIN_POWER'; amount: number }
  /** Gagne `amount` pouvoir par Héros présent dans le royaume (Magnifiques Taxes). */
  | { type: 'GAIN_POWER_PER_HERO_IN_REALM'; amount: number }
  /** Gagne `amount` pouvoir par Allié présent dans le royaume (arceaux inclus —
   *  ils comptent comme Alliés). Reine de Cœur : Joyeux non-anniversaire. */
  | { type: 'GAIN_POWER_PER_ALLY_IN_REALM'; amount: number }
  /** Gagne `amount` pouvoir par carte `cardId` (posée librement) sur le lieu du
   *  pion de l'acteur. Slenderman : Dessin inquiétant (1 par Page). */
  | { type: 'GAIN_POWER_PER_CARD_AT_PAWN'; cardId: string; amount: number }
  /** Autorise l'acteur à utiliser UNE action recouverte par un Héros ce tour-ci
   *  (réutilise la mécanique Persifleur). Slenderman : Brouillage. */
  | { type: 'GRANT_USE_COVERED_ACTION' }
  /** L'acteur perd jusqu'à `amount` JT, transférés en lockedPower sur la carte
   *  hôte du contexte (Petit Jean : −4 JT au PJ, stockés sur Petit Jean). */
  | { type: 'LOSE_POWER_TO_HOST'; amount: number }
  /** Défausse toutes les cartes (Objet ou Malédiction) de cardId donné sur le
   *  lieu hôte du contexte (Frère Tuck : Mandats ; Pâquerette : Sommeil sans Rêves). */
  | { type: 'DISCARD_CARDS_AT_HOST'; cardId: string }
  /** Défausse tous les Alliés présents sur le lieu hôte (Prince Philippe). */
  | { type: 'DISCARD_ALLIES_AT_HOST' }
  /** Pour chaque lieu adjacent au lieu hôte, déplace UN Allié (le premier
   *  trouvé) vers le lieu hôte. Roi Hubert. */
  | { type: 'PULL_ALLY_FROM_EACH_ADJACENT' }
  /** Déplace le pion du propriétaire (l'acteur) vers un lieu différent — choisi
   *  automatiquement comme celui portant le plus de Malédictions (pénalise
   *  Maléfique). Roi Stéphane. */
  | { type: 'MOVE_OWNER_PAWN_FORCED' }
  /** Révèle la première carte du deck Fatalité du propriétaire. Si c'est un
   *  Héros, joue-le sur le lieu hôte (ou le premier lieu valide). Sinon,
   *  la carte est remise sur le dessus. Aurore. */
  | { type: 'REVEAL_FATE_TOP_PLAY_IF_HERO' }
  /** Remet la carte hôte dans la pioche Fatalité de l'acteur et la remélange.
   *  La carte est retirée de fateDiscard (où elle vient d'arriver). Toby. */
  | { type: 'RESHUFFLE_HOST_INTO_FATE_DECK' }
  /** Cherche un Héros de cardId donné dans fateDeck + fateDiscard de l'acteur,
   *  le retire, et le pose sur le board au lieu hôte du contexte. Belle Marianne. */
  | { type: 'SEARCH_AND_PLACE_HERO'; cardId: string }
  /** Déplace un Héros (cible donnée par ctx.targetHeroId) vers un lieu donné
   *  dans le royaume de l'acteur. Respecte forbiddenLocations. Emprisonnement. */
  | { type: 'MOVE_HERO_TO_LOCATION'; locationId: LocationId }
  /** Exécute un Vanquish sur le Héros (ctx.targetHeroId) avec les alliés
   *  (ctx.allyInstanceIds). `keepAllies` = ne pas défausser les alliés
   *  (Intimidation). Sinon = Vanquish standard. */
  | { type: 'VANQUISH_HERO'; keepAllies: boolean }
  /** Déplace librement un Allié (ctx.allyMove.instanceId) vers n'importe quel
   *  lieu (ctx.allyMove.to) — sans contrainte d'adjacence. Tendre un Piège. */
  | { type: 'MOVE_ALLY_FREELY' }
  /** Au prochain tour, le déplacement n'est pas obligatoire. Disparition. */
  | { type: 'GRANT_SKIP_NEXT_MOVE' }
  /** Met en attente un déplacement de Héros vers un lieu voisin : l'acteur choisit
   *  un de SES Héros et un lieu adjacent (Apparition). */
  | { type: 'RELOCATE_HERO_ADJACENT' }
  /** Met en attente une téléportation : l'acteur déplace son pion vers un lieu qui
   *  porte un Héros (sans Lampe de poche), puis y joue normalement. Slenderman :
   *  Téléportation. */
  | { type: 'TELEPORT_TO_HERO' }
  /** Révèle la dernière carte de la pioche de l'acteur et lui propose un choix
   *  (RESOLVE_DECK_PEEK) : l'ajouter à sa main, OU remélanger la pioche et piocher
   *  la première carte. Slenderman : Retourne-toi. */
  | { type: 'PEEK_BOTTOM_THEN_CHOOSE' }
  /** Mélange la défausse de l'acteur dans sa pioche (nouvelle pioche unique) puis
   *  pioche `count` cartes. Slenderman : Perdu dans les bois. */
  | { type: 'RESHUFFLE_DISCARD_AND_DRAW'; count: number }
  /** Demande à l'acteur un type de carte (Événement/Objet), puis dévoile les
   *  `count` premières cartes de sa pioche : ajoute la 1ʳᵉ du type choisi à sa
   *  main et défausse les autres. Slenderman : Tombée de la nuit. */
  | { type: 'CHOOSE_TYPE_REVEAL_DRAW'; count: number }
  /** Demande à l'acteur un type parmi `types` (2 options), puis dévoile sa pioche
   *  JUSQU'À trouver une carte de ce type : il l'ajoute à sa main et défausse les
   *  autres dévoilées. Jafar : Prédiction (Objet / Allié). */
  | { type: 'REVEAL_UNTIL_TYPE'; types: CardType[] }
  /** Active la récompense Apparence de Dragon (+3 JT si fatalisé avant son prochain tour). */
  | { type: 'ARM_DRAGON_FORM_REWARD' }
  /** Élimine instantanément le Héros cible (ctx.targetHeroId) si sa force est
   *  ≤ maxStrength. Sans alliés. Apparence de Dragon. `atPawn` : exige en plus que
   *  le Héros soit sur le lieu du pion de l'acteur (Jafar : Ah, je suis un serpent ?). */
  | { type: 'INSTANT_VANQUISH_HERO_LE'; maxStrength: number; atPawn?: boolean }
  /** Élimine instantanément le Héros cible (ctx.targetHeroId) s'il se trouve sur
   *  le lieu du pion de l'acteur. Sans alliés, sans limite de force. Disparition. */
  | { type: 'INSTANT_VANQUISH_HERO_AT_PAWN' }
  /** À la pose d'un Héros : « capture » jusqu'à `max` cartes de `cardId` présentes
   *  sur le lieu hôte en les associant au Héros (attachedTo = hôte). Une carte
   *  capturée ne compte plus dans le royaume. Enquêteur (toutes) / Enfant Perdu
   *  (max 1) capturent les Pages de Slenderman. `max` absent = toutes. */
  | { type: 'CAPTURE_CARDS_AT_HOST'; cardId: string; max?: number }
  /** À la mort d'un Héros : rend à la MAIN de l'acteur les cartes (`cardId`)
   *  capturées par ce Héros (associées à l'hôte). Enquêteur / Enfant Perdu :
   *  Slenderman récupère ses Pages en main. */
  | { type: 'RELEASE_CAPTURED_TO_HAND'; cardId?: string }
  /** Jafar — Scarabée d'Or : déverrouille un lieu (retire le Cadenas). */
  | { type: 'UNLOCK_LOCATION'; locationId: LocationId }
  /** Jafar — Lampe Merveilleuse : cherche un Héros (`heroCardId`) dans le deck
   *  Fatalité de l'acteur lui-même et le pose sur SON board au lieu `locationId`. */
  | { type: 'SUMMON_FATE_HERO_TO_OWN_REALM'; heroCardId: string; locationId: LocationId }
  /** Reine de Cœur — Coup Royal : si un arceau se trouve sur chaque lieu, révèle
   *  les 5 premières cartes de la pioche ; si la somme de leurs coûts < force
   *  totale des arceaux, victoire ; sinon ces 5 cartes sont défaussées. */
  | { type: 'ROYAL_CROQUET_ATTEMPT' }
  /** Reine de Cœur — Rapetisser / Agrandir : règle la taille du Héros cible
   *  (ctx.targetHeroId). Si le Héros porte déjà la taille OPPOSÉE, il revient à la
   *  normale ; sinon il prend `size`. Le Loir ne peut pas être rapetissé. */
  | { type: 'SET_HERO_SIZE'; size: 'shrunk' | 'enlarged' }
  /** Reine de Cœur — Par ordre de la Reine ! : ouvre la sélection de 1 ou 2
   *  Cartes Gardes à transformer en arceaux (pendingTransformWickets). Sans
   *  Carte Garde éligible, l'effet ne fait rien. */
  | { type: 'TRANSFORM_GUARDS'; max: number }
  /** Jafar — Sacrifice Nécessaire : défausse l'Allié ou l'Objet du royaume désigné
   *  par ctx.allyInstanceIds[0] (+ ses Objets associés si c'est un Allié), puis
   *  gagne `amount` Pouvoir. */
  | { type: 'DISCARD_OWN_FOR_POWER'; amount: number }
  /** Jafar — Hypnose : prend le contrôle du Héros cible (ctx.targetHeroId) du
   *  royaume de l'acteur. Le marque `hypnotized` : il compte alors comme un Allié
   *  (force inchangée) et ne recouvre plus les actions. Coût (= force du Héros)
   *  prélevé à la pose, hors de cet effet. */
  | { type: 'HYPNOTIZE_HERO' }

/**
 * Un exemplaire physique d'une carte en jeu. Comme une même carte existe en
 * plusieurs copies (ex. 3× Magnifiques Taxes), chaque exemplaire a un id unique
 * pour le suivre (pioche → main → défausse → plateau).
 *
 * L'instance embarque les champs de JEU (type/coût/force/effets) afin que le
 * moteur soit autosuffisant et n'importe jamais data/. La présentation (image,
 * texte) reste dans CardDef, retrouvée par `cardId` côté UI.
 */
export interface CardInstance {
  /** Identifiant unique de cet exemplaire (ex. 'magnifiques-taxes#2'). */
  instanceId: string
  /** Référence vers la définition de carte (CardDef.id). */
  cardId: string
  /** Nom (pour le journal). */
  name: string
  type: CardType
  /** Coût en pouvoir (cartes Vilain). */
  cost?: number
  /** Force (Alliés & Héros). */
  strength?: number
  /** Pour un Objet : cible d'association à la pose (recopié de CardDef).
   *  `'ally'` = sur un Allié du lieu ; sinon (défaut) posé sur le lieu. */
  attach?: 'location' | 'ally' | 'hero'
  /** Si cet exemplaire est associé à une autre carte, `instanceId` de la carte
   *  porteuse (un Allié). Fixé à la pose ; absent pour les Alliés et les Objets
   *  posés directement sur le lieu. La carte porteuse vit sur le même lieu. */
  attachedTo?: string
  /** Effets immédiats résolus à la mise en jeu. */
  effects?: Effect[]
  /** Effets « à la pose » d'un Héros (Fatalité), résolus sur la CIBLE après que
   *  le Héros est entré sur son plateau. Vide pour les autres types. */
  onPlace?: Effect[]
  /** Effets « à la mort » d'un Héros, résolus sur le PROPRIÉTAIRE du Héros (qui
   *  a fait le Vanquish) après que la carte est partie en défausse Fatalité. */
  onVanquish?: Effect[]
  /** Lieux où ce Héros ne peut être ni posé ni déplacé (ex. Dame Gertrude →
   *  jamais sur la Prison). Vide / absent = aucune restriction. */
  forbiddenLocations?: LocationId[]
  /** Jetons de pouvoir verrouillés sur cette carte (Petit Jean +4 prélevés au
   *  PJ, Voler aux Riches ≤4 prélevés sur un Héros). Restitués au joueur quand
   *  la carte est défaussée/vaincue (mécanique combat — bloc B). */
  lockedPower?: number
  /** Restrictions imposées sur le lieu où cette carte est posée (Malédictions). */
  placementRestriction?: PlacementRestriction
  /** Modificateur passif de force pour les cartes du même lieu. */
  strengthMod?: StrengthMod
  /** Déclencheur de défausse automatique de cette carte. */
  discardWhen?: CurseDiscardTrigger
  /** Pour une Condition : descripteur du trigger côté adversaire. */
  trigger?: ConditionTrigger
  /** Nombre maximum d'exemplaires de CETTE carte (même cardId) posés librement
   *  sur un même lieu. La Page : 2 (« un lieu qui a moins de 2 pages »). */
  maxAtLocation?: number
  /** Jafar — Hypnose : ce Héros est sous le contrôle de Jafar. Il compte alors
   *  comme un Allié (force inchangée, capacité ignorée) et ne recouvre plus les
   *  actions du lieu. Il reste de type 'hero' pour l'objectif CONTROL_HERO. */
  hypnotized?: boolean
  /** Jafar — capacité activée : coût (en Pouvoir) de l'action « Activer » pour
   *  cette carte (Iago : 1). Présence du champ = la carte porte le symbole
   *  Activer. La capacité elle-même est dispatchée par cardId dans le moteur. */
  activatedCost?: number
  /** Jafar — Sablier Géant : la capacité a été activée ce tour-ci (effet « jusqu'à
   *  la fin de votre tour »). Réinitialisé à la fin du tour de l'acteur. */
  activatedThisTurn?: boolean
  /** Cette carte ne peut être posée QUE sur ce lieu (Jafar : Lampe Merveilleuse →
   *  Caverne aux Merveilles). Absent = n'importe quel lieu non verrouillé. */
  playOnlyAt?: LocationId
  /** Reine de Cœur : cette Carte Garde a été transformée en arceau (croquet).
   *  Un arceau ne compte plus comme un Allié et sert l'objectif Coup Royal. */
  isWicket?: boolean
  /** Reine de Cœur : taille d'un Héros. `'shrunk'` (rapetissé) → ne recouvre
   *  qu'une action du haut ; `'enlarged'` (agrandi) → recouvre une action de plus.
   *  Absent = taille normale (recouvre la rangée du haut). */
  heroSize?: 'shrunk' | 'enlarged'
  /** Reine de Cœur — Agrandir : lieu adjacent dans lequel un Héros agrandi
   *  recouvre une action supplémentaire (le côté gauche OU droite choisi à la
   *  pose). Présent uniquement quand `heroSize === 'enlarged'`. */
  enlargeTargetId?: LocationId
}

/** Restrictions de pose imposées par une carte sur son lieu (Malédictions, Héros). */
export type PlacementRestriction =
  /** Aucun Héros ne peut être posé sur ce lieu (Feu Infernal). */
  | { type: 'no-heroes' }
  /** Force minimale requise pour qu'un Héros soit posé sur ce lieu (Forêt de Ronces). */
  | { type: 'min-hero-strength'; value: number }
  /** Aucune Malédiction ne peut être posée sur ce lieu (Pimprenelle). */
  | { type: 'no-curses' }

/** Modificateur passif de force appliqué aux cartes d'un même lieu. */
export type StrengthMod =
  /** Modifie la force des Héros présents sur le même lieu (Sommeil sans Rêves : -2). */
  | { target: 'heroes-here'; delta: number }

/** Déclencheur d'une carte Condition : décrit la situation côté ADVERSAIRE
 *  (active player) qui rend la Condition jouable. */
export type ConditionTrigger =
  /** L'adversaire actif a au moins `value` JT (Avarice). */
  | { type: 'opponent-power-ge'; value: number }
  /** L'adversaire actif a au moins `value` cartes en main. `requiresOwnAlly`
   *  ajoute la contrainte « le joueur a un Allié en main » (Lâcheté). */
  | { type: 'opponent-hand-ge'; value: number; requiresOwnAlly?: boolean }
  /** L'adversaire actif a au moins `value` Alliés dans son royaume (Tyrannie,
   *  Lâcheté). `requiresOwnAlly` ajoute la contrainte « le joueur a un Allié en
   *  main » (Lâcheté pose un Allié gratuit). */
  | { type: 'opponent-allies-in-realm-ge'; value: number; requiresOwnAlly?: boolean }
  /** L'adversaire actif a au moins `value` Objets dans son royaume (Jafar :
   *  Tromperie). */
  | { type: 'opponent-items-in-realm-ge'; value: number }
  /** L'adversaire actif a déplacé un Allié ou un Objet ce tour-ci (Sombres desseins). */
  | { type: 'opponent-moved-card' }
  /** L'adversaire actif a pioché au moins une carte ce tour-ci (Sans visage). */
  | { type: 'opponent-drew-card' }
  /** L'adversaire actif vient de vaincre CE TOUR un Héros de force ≥ `value`
   *  (Méchanceté). */
  | { type: 'opponent-vanquished-hero-strength-ge'; value: number }

/** Déclencheur de défausse automatique d'une carte (typiquement une Malédiction). */
export type CurseDiscardTrigger =
  /** Défausse quand un Héros est joué sur le lieu de la carte (Forêt de Ronces). */
  | { type: 'hero-played-here' }
  /** Défausse quand un Allié est joué (posé depuis la main) sur le lieu, pas
   *  quand on l'y déplace (Sommeil sans Rêves). */
  | { type: 'ally-played-here' }
  /** Défausse quand le pion du propriétaire arrive sur le lieu (Feu Infernal). */
  | { type: 'pawn-moves-here' }

/**
 * État propre à UN joueur (un vilain). Tout ce qui lui appartient en propre.
 * Le moteur agit sur le joueur actif (state.players[state.activePlayer]).
 */
export interface PlayerState {
  villain: VillainId
  /** Nom affichable du vilain (pratique pour l'UI et le journal). */
  villainName: string
  /** Copie du plateau du vilain (lieux + actions). */
  locations: Location[]
  /** URL de l'image du plateau (copiée depuis VillainDef). */
  boardImage: string
  /** URL de l'image du pion (copiée depuis VillainDef). */
  pawnImage: string
  /** Hauteur d'affichage du pion en pixels. */
  pawnHeightPx: number
  /** Dos de carte Vilain (copié depuis VillainDef). */
  backVillainImage: string
  /** Dos de carte Fatalité (copié depuis VillainDef). */
  backFateImage: string
  /** Lieu où se trouve le pion. `null` tant qu'il n'a pas joué son 1ᵉʳ déplacement. */
  pawnLocation: LocationId | null
  /** Points de pouvoir accumulés. */
  power: number
  /** Condition de victoire (copiée depuis le vilain). */
  objective: ObjectiveDef
  /** Description de la condition de victoire. */
  objectiveDescription: string
  /** Pioche (deck Vilain mélangé). On pioche depuis l'avant (index 0). */
  deck: CardInstance[]
  /** Cartes en main. */
  hand: CardInstance[]
  /** Défausse. Remélangée dans la pioche quand celle-ci est vide. */
  discard: CardInstance[]
  /** Cartes posées (Alliés/Objets) par lieu, indexées par LocationId. */
  board: Record<LocationId, CardInstance[]>
  /** Pioche Fatalité : les Héros (et cartes Fatalité) que les ADVERSAIRES jouent
   *  contre ce joueur via l'action Fatalité. Mélangée à la mise en place. */
  fateDeck: CardInstance[]
  /** Défausse Fatalité (carte révélée non jouée, héros vaincus…). */
  fateDiscard: CardInstance[]
  /** Disparition (Maléfique) : au prochain tour, le déplacement n'est pas
   *  obligatoire. Drapeau consommé au début du tour suivant (MOVE ou SKIP_MOVE). */
  skipNextMove?: boolean
  /** Apparence de Dragon : si une Fatalité cible ce joueur avant son prochain
   *  tour, gagne 3 JT. Réinitialisé au début de son tour. */
  dragonFormReward?: boolean
  /** Lever du jour (Slenderman) : ce joueur ne peut pas jouer de Page jusqu'à la
   *  fin de son prochain tour. Consommé à la fin de son tour. */
  noPagePlay?: boolean
  /** Jafar : lieux VERROUILLÉS (Cadenas) — inaccessibles au pion et à la pose
   *  tant que le verrou n'est pas retiré (Scarabée d'Or). La Caverne aux
   *  Merveilles démarre verrouillée. */
  lockedLocations?: LocationId[]
}

/**
 * État complet et sérialisable d'une partie. C'est la seule source de vérité.
 * Aucune méthode : uniquement des données, manipulées par des fonctions pures.
 * Le moteur ne sait pas qui (humain ou bot) contrôle chaque joueur.
 */
export interface GameState {
  /** Joueurs de la partie (chacun un vilain distinct). */
  players: PlayerState[]
  /** Index du joueur dont c'est le tour. */
  activePlayer: number
  /** Numéro de tour global (incrémenté à chaque passage de joueur), à partir de 1. */
  turn: number
  phase: TurnPhase
  /** Ids des actions déjà exécutées ce tour-ci par le joueur actif. */
  usedActionIds: string[]
  status: GameStatus
  /** Index du joueur gagnant, ou null tant que la partie continue. */
  winner: number | null
  /** État du PRNG déterministe, partagé (voir engine/rng.ts). */
  rngState: number
  /** File append-only d'événements à afficher en grand par l'UI (Événement
   *  joué, Condition jouée, effet déclenché remarquable). Le moteur n'efface
   *  jamais ; l'UI suit un curseur local pour savoir ce qu'elle a déjà montré. */
  showcaseEvents: ShowcaseEvent[]
  /** Vrai si le joueur actif vient de bouger sur un lieu portant Persifleur :
   *  il peut utiliser UNE action recouverte de ce lieu. Consommé à l'usage. */
  persifleurAvailable: boolean
  /** Force du dernier Héros vaincu CE TOUR (Méchanceté trigger). Reset à
   *  chaque fin de tour. */
  lastVanquishedHeroStrength?: number
  /**
   * Fatalité en cours : le joueur actif a révélé 2 cartes du deck Fatalité d'une
   * cible et doit en choisir une (RESOLVE_FATE) avant tout autre coup. `null`
   * hors d'une résolution de Fatalité.
   */
  pendingFate: PendingFate | null
  /**
   * Diablo (Maléfique) — action gratuite armée : après avoir déplacé Diablo, le
   * joueur peut effectuer UNE action disponible du lieu où Diablo se trouve
   * (DIABLO_FREE_ACTION) ou la décliner (DIABLO_SKIP_FREE_ACTION). Optionnel :
   * absent / `null` = aucune action gratuite en attente. Expire en fin de tour.
   */
  diabloFree?: { instanceId: string; locationId: LocationId } | null
  /**
   * Tendre un Piège : après le déplacement (immédiat) de l'Allié, le joueur PEUT
   * faire une action Éliminer un Héros (facultative). `true` tant qu'elle est
   * proposée ; consommée par TRAP_VANQUISH / TRAP_SKIP_VANQUISH ou la fin de tour.
   */
  pendingTrapVanquish?: boolean
  /**
   * Tyrannie en cours : le joueur `playerIndex` a pioché et doit maintenant
   * choisir `count` cartes de sa main à défausser (RESOLVE_TYRANNY_DISCARD)
   * avant que la partie ne reprenne. Absent hors d'une résolution de Tyrannie.
   */
  pendingTyrannyDiscard?: { playerIndex: number; count: number }
  /**
   * Aurore : un Héros révélé doit être posé sur le plateau de `targetIndex`, et
   * c'est `chooserIndex` (le joueur qui a joué la Fatalité) qui choisit le lieu
   * (RESOLVE_HERO_PLACEMENT). Absent hors de ce choix.
   */
  pendingHeroPlacement?: { chooserIndex: number; targetIndex: number; hero: CardInstance }
  /**
   * Roi Stéphane : `chooserIndex` (le joueur qui a joué la Fatalité) peut
   * déplacer le pion de `targetIndex` (Maléfique) sur n'importe quel lieu, ou
   * pas (optionnel). Résolu par RESOLVE_PAWN_MOVE. Absent hors de ce choix.
   */
  pendingPawnMove?: { chooserIndex: number; targetIndex: number }
  /**
   * Roi Hubert : `chooserIndex` peut attirer UN Allié de chaque lieu voisin de
   * `dest` vers `dest`, sur le plateau de `targetIndex`. Résolu par
   * RESOLVE_HUBERT_PULL. Absent hors de ce choix.
   */
  pendingHubertPull?: { chooserIndex: number; targetIndex: number; dest: LocationId }
  /**
   * Retourne-toi (Slenderman) : la dernière carte de la pioche de `playerIndex`
   * a été révélée (`card`). Le joueur doit choisir (RESOLVE_DECK_PEEK) entre
   * l'ajouter à sa main ou remélanger sa pioche et piocher la première carte.
   * Absent / `null` hors de ce choix.
   */
  pendingDeckPeek?: { playerIndex: number; card: CardInstance } | null
  /**
   * Tombée de la nuit (Slenderman) : `playerIndex` doit choisir un type de carte
   * (Événement/Objet) avant de dévoiler `count` cartes de sa pioche
   * (RESOLVE_TYPE_CHOICE). Absent / `null` hors de ce choix.
   */
  pendingTypeChoice?: {
    playerIndex: number
    count: number
    /** Les 2 types proposés au choix (défaut : Événement/Objet). */
    types: CardType[]
    /** true = on dévoile JUSQU'À trouver le type (Prédiction) ; false = on
     *  dévoile `count` cartes et on garde la 1ʳᵉ du type (Tombée de la nuit). */
    untilFound?: boolean
  } | null
  /**
   * Déplacement de Héros vers un lieu voisin en attente : `chooserIndex` choisit
   * un Héros du royaume de `targetIndex` et un lieu adjacent (RESOLVE_HERO_RELOCATE).
   * Apparition (chooser = target = Slenderman) ; Vent de panique (Fatalité :
   * chooser = adversaire, target = Slenderman). Absent / `null` hors de ce choix.
   */
  pendingHeroRelocate?: { chooserIndex: number; targetIndex: number } | null
  /** Téléportation (Slenderman) : `playerIndex` doit choisir un lieu portant un
   *  Héros où déplacer son pion (RESOLVE_TELEPORT). Absent / `null` sinon. */
  pendingTeleport?: { playerIndex: number } | null
  /** Manipulation (Jafar) : `playerIndex` doit choisir une carte de SA défausse à
   *  reprendre en main (RESOLVE_MANIPULATION). Absent / `null` sinon. */
  pendingManipulation?: { playerIndex: number } | null
  /** Coup Royal (Reine de Cœur) : 5 cartes révélées à montrer au joueur, avec le
   *  verdict (force totale des arceaux vs somme des coûts). Purement informatif —
   *  fermé par DISMISS_ROYAL_CROQUET. Absent / `null` sinon. */
  pendingRoyalCroquet?: {
    playerIndex: number
    revealed: CardInstance[]
    wicketStrength: number
    costSum: number
    won: boolean
  } | null
  /** Par ordre de la Reine ! (Reine de Cœur) : `playerIndex` doit choisir 1 ou 2
   *  Cartes Gardes à transformer en arceaux (RESOLVE_TRANSFORM_WICKETS). `max` = 2.
   *  Absent / `null` sinon. */
  pendingTransformWickets?: { playerIndex: number; max: number } | null
  /** Le joueur actif a déplacé un Allié/Objet ce tour-ci (déclencheur Sombres desseins). */
  activeMovedCard?: boolean
  /** Le joueur actif a pioché ≥1 carte ce tour-ci via un effet (déclencheur Sans visage). */
  activeDrewCard?: boolean
  /** File append-only de petits effets flottants déclenchés par le moteur
   *  (ex. Robin des Bois qui « chipe » 1 Pouvoir). L'UI les consomme via un
   *  curseur local et les anime ; n'affecte pas la logique de jeu. */
  floatingFx?: FloatingFx[]
  /** Journal lisible des événements, par ordre chronologique. */
  log: string[]
}

/** Petit effet flottant émis par le moteur (animation UI, sans impact règle). */
export type FloatingFx =
  /** Robin des Bois réduit un gain de Pouvoir du propriétaire de son royaume
   *  (anime un flash rouge sur sa carte, au lieu de `locationId`). */
  | { kind: 'robin-steal'; amount: number; playerIndex: number; locationId: string }
  /** Magnifiques Taxes : +`amount` Pouvoir par Héros — anime « +N 🪙 » sur CHAQUE
   *  Héros du royaume (`instanceId` = la carte Héros source). */
  | { kind: 'taxes-gain'; amount: number; playerIndex: number; instanceId: string }
  /** Tyrannie : `count` cartes piochées « affluent » de la pioche vers la main
   *  du joueur (animation de vol) avant la défausse. */
  | { kind: 'tyranny-draw'; playerIndex: number; count: number }
  /** Pose d'un Allié/Objet sur le plateau : la carte « vole » de la main vers le
   *  lieu de destination. Émis pour les deux joueurs ; l'UI n'anime que le bot
   *  (l'humain l'est déjà avant le dispatch, avec l'image réelle de la carte). */
  | { kind: 'play-card'; playerIndex: number; locationId: LocationId; cardId: string }

/** Événement « cinématique » émis par le moteur pour que l'UI affiche la
 *  carte en grand avec un message d'effet. Purement informatif (n'affecte pas
 *  la logique de jeu) ; le moteur le pousse, l'UI le consomme à son rythme. */
export interface ShowcaseEvent {
  /** Carte mise en avant (utilisée pour retrouver l'image et le texte). */
  cardId: string
  /** Description courte de l'effet appliqué (affichée sous la carte). */
  message: string
  /** Index du joueur QUI A JOUÉ la carte (détermine la position du showcase). */
  playerIndex: number
  /** Si la carte est posée sur le plateau d'un joueur (Héros via Fatalité,
   *  Malédiction…), où elle atterrit — pour animer le « vol » du showcase. */
  destination?: { playerIndex: number; locationId: string }
  /** instanceId exact de l'exemplaire posé (Héros Fatalité), pour que l'UI
   *  puisse le masquer du plateau tant que le showcase n'a pas atterri. */
  cardInstanceId?: string
  /** Pouvoir gagné par la carte (Événement/Condition) — animé en « +N JT »
   *  par-dessus le showcase. Absent / 0 = pas d'animation de gain. */
  gainedPower?: number
  /** Pouvoir gagné par le PROPRIÉTAIRE à l'arrivée d'un Héros (Mandat d'Arrêt) —
   *  animé en « +N 🪙 » sur le lieu d'arrivée APRÈS la fermeture du showcase. */
  landingPowerGain?: number
  /** Durée d'affichage en millisecondes (défaut 3000). Mode test : « limité ». */
  durationMs?: number
  /** Si vrai, le showcase reste affiché jusqu'à fermeture manuelle (mode test
   *  « fixe », pour caler les positions). Ignore `durationMs`. */
  fixed?: boolean
  /** Variante « défausse » : au lieu d'une seule carte, on montre plusieurs
   *  cartes retirées (Alliés/Malédiction défaussés par Prince Philippe, etc.)
   *  AVANT qu'elles ne disparaissent. `cardId` reste défini (1ʳᵉ carte) pour
   *  les chemins génériques, mais l'affichage liste `cardIds`. */
  discard?: {
    /** Les cartes retirées, dans l'ordre, à afficher côte à côte. */
    cardIds: string[]
    /** Style d'encadré : 'red' = rouge clignotant (retiré par une attaque),
     *  'dark' = encadré foncé (défausse volontaire de l'adversaire). */
    variant: 'red' | 'dark'
    /** Ancrage vertical : 'center' (défaut) ou 'bottom' (près de la main). */
    anchor?: 'center' | 'bottom'
  }
}

/** Fatalité révélée en attente de résolution par le joueur actif. */
export interface PendingFate {
  /** Index du joueur ciblé (celui qui subira le Héros/effet). */
  target: number
  /** Les 2 cartes révélées du deck Fatalité de la cible (retirées de sa pioche). */
  revealed: CardInstance[]
}

/**
 * Les actions de jeu que le moteur sait appliquer. C'est l'unique surface
 * d'entrée du moteur : applyAction(state, action) → nouveau state.
 */
export type GameAction =
  | { type: 'MOVE'; to: LocationId }
  | { type: 'EXECUTE_ACTION'; actionId: string }
  /** Jouer une carte de la main via une action « Jouer une carte » du lieu courant.
   *  `to` = lieu de destination (n'importe quel lieu non verrouillé), requis pour
   *  un Allié/Objet ; ignoré pour un Événement. `attachTo` = instanceId de l'Allié
   *  porteur, requis pour un Objet à associer. */
  | {
      type: 'PLAY_CARD'
      actionId: string
      instanceId: string
      to?: LocationId
      attachTo?: string
      /** Héros adverse ciblé par la carte (Emprisonnement → quel Héros déplacer ?
       *  Intimidation/Tendre un Piège → quel Héros éliminer ?). */
      targetHeroId?: string
      /** Alliés à utiliser pour les cartes qui déclenchent un Vanquish
       *  (Intimidation, Tendre un Piège). */
      allyInstanceIds?: string[]
      /** Allié à déplacer librement avant l'effet (Tendre un Piège). */
      allyMove?: { instanceId: string; to: LocationId }
    }
  /** Défausser un ensemble de cartes de la main via une action « Défausser ». */
  | { type: 'DISCARD_CARDS'; actionId: string; instanceIds: string[] }
  /** Déplacer un Allié/Objet (et ses Objets associés) vers un lieu voisin. */
  | { type: 'MOVE_CARD'; actionId: string; instanceId: string; to: LocationId }
  /** Action de lieu « Déplacer un Héros » : déplace un Héros du royaume du joueur
   *  actif vers un lieu VOISIN de celui où il se trouve (Slenderman, Maison Perdue). */
  | { type: 'MOVE_HERO'; actionId: string; heroInstanceId: string; to: LocationId }
  /** Action de lieu « Activer » (Jafar) : active la capacité d'un Allié/Objet du
   *  royaume portant le symbole Activer. `cardInstanceId` = la carte activée.
   *  `to`/`itemInstanceId` paramètrent la capacité (Iago : lieu de destination +
   *  Objet emmené). Le coût d'activation est prélevé par le moteur. */
  | {
      type: 'ACTIVATE'
      actionId: string
      cardInstanceId: string
      to?: LocationId
      itemInstanceId?: string
    }
  /** Éliminer un Héros : somme des forces des alliés ≥ force du héros. Le héros
   *  va à la défausse Fatalité, les alliés (et leurs objets associés) à la défausse. */
  | { type: 'VANQUISH'; actionId: string; heroInstanceId: string; allyInstanceIds: string[] }
  /** Le joueur actif paie 2 JT pour défausser un Déguisement Fatalité associé
   *  à un Héros adverse de SON plateau. Action hors-tour-de-lieu. */
  | { type: 'DISCARD_DEGUISEMENT'; instanceId: string }
  /** Disparition : passer la phase MOVE obligatoire sans déplacer le pion. */
  | { type: 'SKIP_MOVE' }
  /** Déplacement gratuit du Shérif de Nottingham (1×/tour par Shérif) vers
   *  n'importe quel autre lieu. +1 JT si la destination porte un Héros. */
  | { type: 'SHERIFF_MOVE'; instanceId: string; to: LocationId }
  /** Déplacement gratuit de Diablo (1×/tour) vers n'importe quel autre lieu, en
   *  phase MOVE uniquement (« avant que Maléfique ne se déplace »). Arme ensuite
   *  une action gratuite (DIABLO_FREE_ACTION) sur ce lieu. */
  | { type: 'DIABLO_MOVE'; instanceId: string; to: LocationId }
  /** Diablo (V2) : effectue UNE action disponible du lieu où Diablo se trouve,
   *  gratuitement, sans déplacer le pion ni consommer les actions du lieu courant.
   *  L'action Fatalité est exclue. */
  | {
      type: 'DIABLO_FREE_ACTION'
      action: Extract<
        GameAction,
        { type: 'EXECUTE_ACTION' | 'PLAY_CARD' | 'DISCARD_CARDS' | 'MOVE_CARD' | 'VANQUISH' }
      >
    }
  /** Diablo (V2) : décline l'action gratuite armée. */
  | { type: 'DIABLO_SKIP_FREE_ACTION' }
  /** Tendre un Piège : effectue l'action Éliminer un Héros facultative (après le
   *  déplacement d'Allié déjà appliqué). */
  | { type: 'TRAP_VANQUISH'; heroInstanceId: string; allyInstanceIds: string[] }
  /** Tendre un Piège : termine sans éliminer de Héros (action facultative). */
  | { type: 'TRAP_SKIP_VANQUISH' }
  /** Jouer une Condition (Avarice, Lâcheté) pendant le tour d'un adversaire.
   *  `playerIndex` ≠ activePlayer. `to`/`attachTo` pour Lâcheté (Allié à poser). */
  | {
      type: 'PLAY_CONDITION'
      playerIndex: number
      instanceId: string
      allyInstanceId?: string
      to?: LocationId
      attachTo?: string
    }
  /** Lancer la Fatalité : révéler 2 cartes du deck Fatalité de l'adversaire. */
  | { type: 'FATE'; actionId: string }
  /** Résoudre la Fatalité : jouer une des cartes révélées. `to` = lieu où poser
   *  un Héros chez la cible. `targetHeroId` = Héros adverse ciblé par Voler aux
   *  Riches (verrouille des JT dessus) ou Déguisement (s'y attache). */
  | { type: 'RESOLVE_FATE'; instanceId: string; to?: LocationId; targetHeroId?: string }
  /** Résoudre la défausse de Tyrannie : `instanceIds` = les cartes choisies dans
   *  la main du joueur en attente (`pendingTyrannyDiscard`) à envoyer en défausse. */
  | { type: 'RESOLVE_TYRANNY_DISCARD'; instanceIds: string[] }
  /** Aurore : poser le Héros révélé (`pendingHeroPlacement`) sur `locationId`. */
  | { type: 'RESOLVE_HERO_PLACEMENT'; locationId: LocationId }
  /** Roi Stéphane : déplacer le pion (`pendingPawnMove`) sur `locationId`, ou
   *  `null` pour ne pas le déplacer (l'effet est optionnel). */
  | { type: 'RESOLVE_PAWN_MOVE'; locationId: LocationId | null }
  /** Roi Hubert : attirer les Alliés choisis (≤1 par lieu voisin) vers son lieu. */
  | { type: 'RESOLVE_HUBERT_PULL'; allyInstanceIds: string[] }
  /** Retourne-toi : `keep` = ajouter la carte révélée (dernière de la pioche) à
   *  la main ; sinon remélanger la pioche et piocher la première carte. */
  | { type: 'RESOLVE_DECK_PEEK'; keep: boolean }
  /** Tombée de la nuit : `cardType` = type choisi (Événement/Objet) ; dévoile les
   *  cartes en attente, garde la 1ʳᵉ de ce type, défausse les autres. */
  | { type: 'RESOLVE_TYPE_CHOICE'; cardType: CardType }
  /** Apparition / Vent de panique : déplace le Héros choisi vers le lieu voisin. */
  | { type: 'RESOLVE_HERO_RELOCATE'; heroInstanceId: string; to: LocationId }
  /** Téléportation : déplace le pion vers le lieu (portant un Héros) choisi. */
  | { type: 'RESOLVE_TELEPORT'; to: LocationId }
  /** Manipulation : reprend en main la carte `instanceId` de la défausse du joueur. */
  | { type: 'RESOLVE_MANIPULATION'; instanceId: string }
  /** Coup Royal : ferme la fenêtre de révélation (informatif). */
  | { type: 'DISMISS_ROYAL_CROQUET' }
  /** Par ordre de la Reine ! : transforme en arceaux les Cartes Gardes choisies
   *  (1 ou 2 instanceIds). */
  | { type: 'RESOLVE_TRANSFORM_WICKETS'; instanceIds: string[] }
  /** MODE TEST uniquement : inflige directement un Héros Fatalité (déjà construit
   *  par l'UI) sur un lieu du joueur ACTIF, déclenchant ses effets « à la pose »,
   *  les arrivées et les showcases — comme si un adversaire l'avait joué. */
  | { type: 'TEST_PLACE_FATE'; card: CardInstance; to: LocationId }
  /** MODE TEST uniquement : joue une Condition (déjà construite) pour le joueur
   *  actif, déclencheur et restriction de tour contournés. `allyInstanceId`/`to`
   *  permettent de CHOISIR l'Allié et le lieu (Lâcheté) ; sinon auto-sélection. */
  | { type: 'TEST_PLAY_CONDITION'; card: CardInstance; allyInstanceId?: string; to?: LocationId }
  /** MODE TEST uniquement : joue une carte Fatalité non-Héros (Voler aux Riches,
   *  Déguisement) CONTRE le joueur actif, ciblant l'un de ses Héros via
   *  `targetHeroId` — comme si un adversaire l'avait jouée. */
  | { type: 'TEST_PLAY_FATE_CARD'; card: CardInstance; targetHeroId?: string }
  | { type: 'END_TURN' }

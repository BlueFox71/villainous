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
  /** La Méchante Reine : « Préparer du Poison » — convertit N jetons Pouvoir en
   *  N jetons Poison (N au choix). Timide (Héros Fatalité) fait coûter 1 Pouvoir
   *  SUPPLÉMENTAIRE le fait d'utiliser l'action. */
  | 'BREW_POISON'

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
  /** instanceId de l'Objet qui accorde cette action (Capitaine Crochet : Canon,
   *  Boîte à Crochets, Ingénieux Mécanisme). Absent pour les actions imprimées. */
  grantedBy?: string
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
  /** Bowser : mise en place des Étoiles. `locationId` = l'Observatoire de la
   *  Comète ; `count` = Étoiles posées au départ. Ce lieu est VERROUILLÉ
   *  dynamiquement dès qu'il tombe à 0 Étoile. Absent = vilain sans Étoiles. */
  starSetup?: { locationId: LocationId; count: number }
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
  /** Capitaine Crochet : éliminer un Héros précis (`heroCardId`) sur un lieu
   *  précis (`locationId`). Victoire ÉVÉNEMENTIELLE — déclenchée à l'instant du
   *  Vanquish (performVanquish), pas par un contrôle passif en début de tour. */
  | { type: 'DEFEAT_HERO_AT_LOCATION'; heroCardId: string; locationId: LocationId }
  /** Ursula : avoir TOUS les Objets `itemCardIds` (non associés) posés sur le lieu
   *  `locationId` au début de son tour (Trident + Couronne au Repaire). */
  | { type: 'ITEMS_AT_LOCATION'; itemCardIds: string[]; locationId: LocationId }
  /** Hadès : avoir au moins `count` Titans NON entravés sur le lieu `locationId`
   *  (Mont Olympe) au début de son tour. */
  | { type: 'UNTRAPPED_TITANS_AT_LOCATION'; locationId: LocationId; count: number }
  /** Dr Facilier : détenir le Talisman et révéler « Régner sur la Nouvelle-Orléans »
   *  depuis la Pile de l'Au-delà via Divination. Victoire ÉVÉNEMENTIELLE — déclenchée
   *  au moment de la résolution de Divination, pas par un contrôle passif. */
  | { type: 'REIGN_NEW_ORLEANS' }
  /** Bowser : au début de son tour, l'Observatoire de la Comète est « épuisé »
   *  (0 Étoile) ET Peach a été capturée (drapeau `peachCaptured`, posé uniquement
   *  par la carte Impuissance). `blockerHeroCardId` (Mario) : tant qu'un Héros de
   *  ce cardId est présent dans le royaume, la victoire est impossible. */
  | { type: 'DEPLETE_OBSERVATORY_AND_CAPTURE'; blockerHeroCardId?: string }
  /** L'Imposteur : conserver un Sabotage (Objet) posé dans le royaume pendant
   *  `turns` tours sans qu'il soit défaussé. Victoire vérifiée en début de tour
   *  (le compte à rebours du Sabotage est porté par l'instance d'Objet). */
  | { type: 'KEEP_SABOTAGE'; turns: number }
  /** Scar : éliminer d'abord `firstHeroCardId` (Mufasa) — placé dans la pile
   *  Succession — puis y accumuler une Force combinée ≥ `minForce`. Victoire
   *  vérifiée au début de son tour. */
  | { type: 'SUCCESSION_FORCE'; firstHeroCardId: string; minForce: number }
  /** Yzma : jouer `heroCardId` (Kuzco, trouvé dans ses 4 pioches Fatalité) et
   *  l'éliminer en utilisant l'Allié `allyCardId` (Kronk). Drapeau posé au Vanquish. */
  | { type: 'DEFEAT_HERO_WITH_ALLY'; heroCardId: string; allyCardId: string }
  /** Ratigan : objectif DOUBLE. Côté « L'Esprit Supérieur » (départ) — au début de
   *  son tour, l'Objet `itemCardId` (Reine Robot, non associé) doit se trouver sur
   *  `locationId` (Buckingham Palace). Si la Reine Robot est défaussée, la tuile
   *  Objectif bascule côté « Le Rat » (drapeau `becameTheRat`) : il faut alors
   *  éliminer le Héros `altHeroCardId` (Basil) — drapeau `objectiveHeroDefeated`
   *  posé au Vanquish. Dans les deux cas, le Héros `blockerHeroCardId` (Reine
   *  Moustoria) présent sur `locationId` empêche la victoire. */
  | {
      type: 'RATIGAN_DUAL'
      itemCardId: string
      locationId: LocationId
      altHeroCardId: string
      blockerHeroCardId: string
    }
  /** Sombra : avoir une carte de Piratage (`isPiratage`) sur CHACUN des 4 lieux
   *  (Lumérico compris) ET jouer la carte `winCardId` (Protocole Sombra). Victoire
   *  ÉVÉNEMENTIELLE — déclenchée par Protocole Sombra quand tous les lieux sont
   *  piratés (pas un contrôle passif en début de tour). */
  | { type: 'SOMBRA'; winCardId: string }

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
export type CardType = 'ally' | 'item' | 'effect' | 'condition' | 'hero' | 'curse' | 'ingredient'

/**
 * L'Imposteur — un COÉQUIPIER : pion neutre posé sur une CASE d'action du
 * plateau (lieu + rangée + emplacement gauche/droite). Au repos il est « normal »
 * (au-dessus du plateau, ne recouvre rien) ; quand il « suspecte » l'Imposteur il
 * devient `suspect` et recouvre l'action de sa case. Deux Coéquipiers ne peuvent
 * pas occuper la même case. Seul l'Imposteur en possède (8 au total).
 */
export interface Crewmate {
  /** Identité stable et couleur (ex. 'blanc', 'bleu', 'noir'…). Sert aussi de clé
   *  de rendu (jeton public/cards/imposteur/crew-<color>.png). */
  color: string
  /** Lieu où se trouve le Coéquipier. */
  locationId: LocationId
  /** Rangée de la case occupée (les actions du HAUT au départ). */
  row: ActionRow
  /** Emplacement gauche (0) ou droite (1) parmi les 2 actions de la rangée. */
  slot: number
  /** Vrai = suspecte l'Imposteur → recouvre l'action de sa case (pion « suspect »).
   *  Faux = normal, au-dessus du plateau, ne recouvre rien. */
  suspect: boolean
  /** Défaussé (éliminé du plateau par Tuer / Trahison…). N'occupe plus de case et
   *  n'est plus affiché ; peut revenir via la Fatalité (Arrivée tardive). */
  discarded?: boolean
}

/**
 * Effet composable d'une carte, exécuté par le dispatcher (engine/effects.ts).
 * Union volontairement minimale pour l'instant — on l'étend au fur et à mesure
 * sans toucher au reste du moteur.
 */
export type Effect =
  | { type: 'GAIN_POWER'; amount: number }
  /** L'Imposteur — Tuer : défausse un Coéquipier sur le lieu du pion ou le lieu d'un
   *  Allié de l'Imposteur (choix interactif → pendingCrewmateKill) ; les autres
   *  Coéquipiers de ce lieu deviennent suspects. */
  | { type: 'KILL_CREWMATE' }
  /** L'Imposteur — Porte désactivée : les Coéquipiers ne se déplacent pas à la fin
   *  de ce tour (drapeau crewmatesSkipMove). */
  | { type: 'SKIP_CREWMATE_MOVE' }
  /** L'Imposteur — Fausse accusation : défausse un Coéquipier (auto : un suspect en
   *  priorité, n'importe où) ; tous les autres redeviennent normaux. */
  | { type: 'FALSE_ACCUSATION' }
  /** L'Imposteur — Assurance : un Coéquipier suspect sur le lieu du pion / d'un
   *  Allié redevient normal (auto). */
  | { type: 'REASSURE_CREWMATE' }
  /** L'Imposteur — Lumière désactivée : déplace `count` Coéquipiers (hors sabotage)
   *  vers un lieu voisin (auto : vers le lieu voisin le moins occupé). */
  | { type: 'MOVE_CREWMATES_NEIGHBOR'; count: number }
  /** L'Imposteur — Communication désactivée : défausse un Objet du royaume issu
   *  d'une Fatalité (auto). */
  | { type: 'DISCARD_FATE_ITEM' }
  /** L'Imposteur (Fatalité, ciblant l'Imposteur) — rend SUSPECTS jusqu'à `count`
   *  Coéquipiers : `scope` = 'away' (hors lieu du pion / d'un Allié) ou 'any'.
   *  count absent = tous ceux du périmètre. Corps découvert / Tâche visuelle. */
  | { type: 'CREWMATES_SUSPECT'; scope: 'away' | 'any'; count?: number }
  /** L'Imposteur (Fatalité) — augmente de `amount` le compte à rebours d'un Sabotage
   *  présent (Corps découvert). */
  | { type: 'SABOTAGE_COUNTDOWN'; amount: number }
  /** L'Imposteur — Tâche visuelle : l'adversaire CHOISIT jusqu'à `count` Coéquipiers
   *  à rendre suspects (interactif → pendingCrewmateSuspect). */
  | { type: 'CREWMATES_SUSPECT_CHOOSE'; count: number }
  /** L'Imposteur (Fatalité) — déplace UN Coéquipier vers un lieu voisin (auto).
   *  Réparation rapide. */
  | { type: 'MOVE_ONE_CREWMATE_NEIGHBOR' }
  /** L'Imposteur (Fatalité) — Arrivée tardive : remet en jeu un Coéquipier défaussé
   *  sur la rangée la plus à gauche ou à droite du royaume (auto). */
  | { type: 'PLACE_DISCARDED_CREWMATE' }
  /** L'Imposteur (Fatalité) — Réunion d'urgence : rassemble tous les Coéquipiers sur
   *  un lieu (auto : le lieu le plus peuplé), répartis sur les deux rangées. */
  | { type: 'GATHER_CREWMATES' }
  /** L'Imposteur — Trahison : élimine un Coéquipier qui NE suspecte PAS l'Imposteur. */
  | { type: 'KILL_NORMAL_CREWMATE' }
  /** L'Imposteur — Insidieux : un Coéquipier suspect (n'importe où) redevient normal. */
  | { type: 'REASSURE_ANY' }
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
  /** La Méchante Reine — « Je vais vous broyer les os ! » : ce tour-ci, l'acteur
   *  peut aussi effectuer TOUTES les actions recouvertes par un Héros sur son lieu
   *  (drapeau uncoverCoveredActions). */
  | { type: 'USE_COVERED_ACTIONS_THIS_TURN' }
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
  /** Capitaine Crochet — Clochette (à la pose) : défausse un Allié sur le lieu où
   *  elle arrive (ctx.hostLocationId). */
  | { type: 'DISCARD_ALLY_AT_HOST' }
  /** Jafar (Fatalité) — Abu/Aladdin (à la pose) : l'adversaire choisit un Objet à
   *  associer au Héros (ctx.hostInstanceId). `fromHand` (Aladdin) inclut aussi les
   *  Objets de la main de la cible. Ouvre pendingFateChoice. */
  | { type: 'STEAL_ITEM_TO_HERO'; fromHand?: boolean }
  /** Ursula — Métamorphose / Grimsby : déplace le Cadenas entre le Palais et le
   *  Repaire d'Ursula (exactement un des deux est bloqué). */
  | { type: 'TOGGLE_URSULA_LOCK' }
  /** Ursula — Chaudron : gagne `amount` Pouvoir par Pacte (carte avec
   *  contractLocationId) dans le royaume. */
  | { type: 'GAIN_POWER_PER_CONTRACT'; amount: number }
  /** Ursula — Divination : dévoile la pioche Vilain jusqu'à un Pacte, l'ajoute à
   *  la main, défausse les autres dévoilées. */
  | { type: 'REVEAL_VILLAIN_UNTIL_CONTRACT' }
  /** Ursula — Polochon (Fatalité) : mélange la défausse Vilain de l'acteur dans
   *  sa pioche Vilain. */
  | { type: 'SHUFFLE_VILLAIN_DISCARD' }
  /** Ursula — Eurêka (Fatalité) : associe au Héros hôte (ctx.hostInstanceId) un
   *  Objet pris dans la défausse Fatalité de l'acteur. */
  | { type: 'EUREKA_ATTACH_ITEM' }
  /** Ursula — Sébastien (Fatalité) : ouvre le choix d'un Pacte (associé à un autre
   *  Héros) à transférer sur le Héros hôte (ctx.hostInstanceId). */
  | { type: 'STEAL_CONTRACT_TO_HOST' }
  /** Ursula — Max (Fatalité) : si joué sur le lieu d'Ursula, l'adversaire déplace
   *  la figurine d'Ursula vers un lieu non bloqué (pendingPawnMove). */
  | { type: 'MOVE_URSULA_PAWN' }
  /** Ursula — Opportunisme : récupère un Objet ou un Événement de la défausse
   *  Vilain (au choix) et l'ajoute à la main. */
  | { type: 'RECOVER_ITEM_OR_EVENT' }
  /** Ursula — Ariel (Fatalité) : déplace un Objet du royaume sur le lieu d'Ariel
   *  (ctx.hostLocationId) et le « gèle » (Ursula ne peut plus le déplacer tant
   *  qu'Ariel est en jeu). */
  | { type: 'ARIEL_FREEZE_ITEM' }
  /** Ursula — Âmes en Perdition : déplace chaque Héros portant un Pacte vers le
   *  lieu de son Pacte s'il est voisin non bloqué (déclenche les Pactes). */
  | { type: 'AMES_EN_PERDITION' }
  /** Ursula — Colère Titanesque : ouvre le choix d'un lieu voisin où effectuer une
   *  action (pendingGiantAction). */
  | { type: 'GIANT_ACTION' }
  /** Capitaine Crochet — Digne Adversaire / Obsession : dévoile le deck Fatalité
   *  de l'acteur jusqu'à trouver un Héros, le joue dans SON royaume (Peter Pan →
   *  Arbre du Pendu, sinon lieu du pion), défausse les autres cartes dévoilées. */
  | { type: 'REVEAL_OWN_FATE_PLAY_HERO' }
  /** Capitaine Crochet — Monsieur Starkey : ouvre le déplacement d'un Héros du
   *  royaume de l'acteur vers un lieu voisin (pendingHeroRelocate). `anyLocation`
   *  (Tourbillon/Ursula) autorise N'IMPORTE quel lieu non bloqué. */
  | { type: 'RELOCATE_OWN_HERO'; anyLocation?: boolean }
  /** Capitaine Crochet — Faites-leur peur ! : regarde les 2 premières cartes
   *  Fatalité de l'acteur ; défausse automatiquement les non-Héros, garde les
   *  Héros sur le dessus (heuristique : on creuse vers les Héros). */
  | { type: 'SCRY_OWN_FATE_TOP2' }
  /** Déplace un Allié vers un lieu voisin non bloqué et lui donne `amount` force
   *  jusqu'à la fin du tour. `amount: 0` = simple déplacement (Bowser — Grand
   *  Terrier). `label` : nom de la carte (titre/log) ; `optional` : déplacement
   *  facultatif (« vous pouvez »), autorise SKIP_ALLY_MOVE_BUFF.
   *  Sert : Capitaine Crochet — Pas de Quartier ! (+2) ; Bowser — Grand Terrier (+0). */
  | { type: 'MOVE_ALLY_BUFF'; amount: number; label?: string; optional?: boolean }
  /** Hadès — Préparez-vous au combat ! : ouvre le choix d'un Titan non entravé et
   *  d'un lieu de destination (≤ `maxSteps` lieux). `paid` : Hadès paie le
   *  déplacement (2 JT pour 1 lieu, 5 JT pour 2). Ouvre pendingTitanMove. */
  | { type: 'MOVE_TITAN_INTERACTIVE'; paid: boolean; maxSteps: number }
  /** Hadès — Alignement des planètes : désentrave tous ses Titans entravés qu'il
   *  peut se payer (1 JT chacun, des plus avancés vers Les Enfers). */
  | { type: 'UNTRAP_TITANS_PAY' }
  /** Hadès — Quel talent ! : gagne `amount` Pouvoir par carte du type `cardType`
   *  (Allié — les Titans sont des Alliés) dans sa défausse. */
  | { type: 'GAIN_POWER_PER_TYPE_IN_DISCARD'; cardType: CardType; amount: number }
  /** Hadès — Talon d'Achille : réduit de `amount` la force du Héros cible
   *  (ctx.targetHeroId) jusqu'à la fin du tour (via tempStrengthBonus négatif). */
  | { type: 'REDUCE_HERO_STRENGTH_TEMP'; amount: number }
  /** Fatalité Hadès — Éclairs : entrave tous les Titans d'un lieu (auto : le lieu
   *  qui en porte le plus). Résolu sur le royaume de la cible (ctx.actorIndex). */
  | { type: 'TRAP_TITANS_AT_BEST_LOCATION' }
  /** Fatalité Hadès — Héra (entrave) / Pégase (repousse) : ouvre le choix d'un
   *  Titan (pendingTitanSelect) par le joueur qui a posé la Fatalité. `atHost` :
   *  candidats limités au lieu hôte (Héra) ; sinon tous les Titans non entravés
   *  (Pégase). `pushSteps` (kind 'push') = nombre de lieux repoussés. */
  | { type: 'OPEN_TITAN_SELECT'; kind: 'trap' | 'push'; atHost?: boolean; pushSteps?: number }
  /** Fatalité Hadès — De zéro en héros : repousse le Titan non entravé le plus
   *  avancé de `steps` lieux vers Les Enfers (auto). */
  | { type: 'PUSH_TITAN_BACK_AUTO'; steps: number }
  /** Fatalité Hadès — Hermès : cherche `heroCardId` (Zeus) dans le deck/défausse
   *  Fatalité de la cible et le place sur le dessus de son deck Fatalité. */
  | { type: 'SEARCH_FATE_HERO_TO_TOP'; heroCardId: string }
  /** Fatalité Hadès — Mégara (à la pose) : déplace un Héros (autre qu'elle) du
   *  lieu hôte vers n'importe quel lieu non bloqué (auto). */
  | { type: 'MOVE_HERO_FROM_HOST_ANYWHERE' }
  /** Hadès — Œil des Moires : dévoile la pioche Vilain jusqu'à une carte de type
   *  `cardType` (Allié — Titans inclus), l'ajoute à la main, défausse les autres.
   *  Variante NON interactive de REVEAL_UNTIL_TYPE (un seul type, pas de choix). */
  | { type: 'REVEAL_VILLAIN_UNTIL_TYPE'; cardType: CardType }
  /** Dr Facilier — Divination : si l'acteur est au Royaume du Vaudou, mélange sa
   *  Pile de l'Au-delà et révèle `count` cartes (2 si Mama Odie est dans son
   *  royaume), puis l'acteur résout leurs effets Au-delà dans l'ordre de son choix
   *  (pendingDivination). Hors du Royaume du Vaudou : sans effet. */
  | { type: 'DIVINATION'; count: number }
  /** Dr Facilier (Fatalité, résolu sur la CIBLE = Facilier) — L'étoile du soir :
   *  place un Allié du royaume (auto : le plus fort) dans la Pile de l'Au-delà. */
  | { type: 'FATE_ALLY_TO_AUDELA' }
  /** Dr Facilier (Fatalité) — Si près du but / Charlotte : place les `count`
   *  premières cartes de la pioche Vilain de la cible dans sa Pile de l'Au-delà. */
  | { type: 'FATE_TOP_DECK_TO_AUDELA'; count: number }
  /** Dr Facilier (Fatalité) — Joujou (à la pose) : place un Objet du lieu hôte
   *  (auto : hors Talisman) dans la Pile de l'Au-delà. */
  | { type: 'FATE_ITEM_AT_HOST_TO_AUDELA' }
  /** Dr Facilier (Fatalité) — Big Daddy Le Bœuf (à la pose) : retire une carte de
   *  la Pile de l'Au-delà (auto : Régner en priorité) et la place sur le dessus de
   *  la pioche Vilain de la cible. */
  | { type: 'FATE_AUDELA_TO_DECK_TOP' }
  /** Dr Facilier (Fatalité) — Naveen (à la pose) : déplace tous les Héros du
   *  royaume de la cible vers un lieu voisin (auto). */
  | { type: 'FATE_MOVE_ALL_HEROES_ADJACENT' }
  /** Dr Facilier — Tour de passe-passe : regarde les `look` premières cartes de la
   *  pioche de l'acteur, en ajoute `take` à la main (auto : les plus utiles) et
   *  défausse les autres. */
  | { type: 'LOOK_TOP_DRAW_DISCARD'; look: number; take: number }
  /** Ratigan — Liste de Fidget : dévoile les cartes de la pioche de l'acteur une à
   *  une jusqu'à en trouver une du type `cardType` (Objet). Cette carte rejoint sa
   *  main, les AUTRES cartes dévoilées sont défaussées. Toutes les cartes dévoilées
   *  sont montrées au joueur (pendingReveal). `title` : titre du modal d'info. */
  | { type: 'REVEAL_DECK_UNTIL_TYPE'; cardType: CardType; title?: string }
  /** Dr Facilier — Désespoir : prend une carte de la Pile de l'Au-delà (auto :
   *  carte clé en priorité) et l'ajoute à la main de l'acteur. */
  | { type: 'TAKE_FROM_AUDELA_TO_HAND' }
  /** Dr Facilier — Terreur : récupère dans la défausse de l'acteur une carte d'un
   *  des `types` (auto : Événement en priorité) et l'ajoute à sa main. */
  | { type: 'RECOVER_TYPE_FROM_DISCARD'; types: CardType[] }
  /** Ratigan — Extravagance : le joueur CHOISIT une carte d'un des `types` (Objet)
   *  dans sa défausse et l'ajoute à sa main (ouvre pendingRecover). `label` : titre
   *  affiché. Paramétrable et réutilisable (variante « avec choix » de RECOVER…). */
  | { type: 'RECOVER_FROM_DISCARD_CHOICE'; types: CardType[]; label?: string }
  /** Sombra — Protocole Sombra : détruit tous les Piratages/IEM du royaume (→
   *  défausse) et les Héros piratés (Boop attaché → défausse Fatalité). Si TOUS les
   *  lieux sont piratés au moment où on le joue, Sombra gagne la partie. */
  | { type: 'SOMBRA_PROTOCOL' }
  /** Sombra — Skycode : gagne 1 Pouvoir par lieu piraté ET par Héros piraté. */
  | { type: 'GAIN_POWER_PER_HACK' }
  /** Sombra — Vol de données (Fatalité) : la cible perd 1 Pouvoir par Piratage/IEM
   *  présent dans son royaume. */
  | { type: 'LOSE_POWER_PER_PIRATAGE' }
  /** Sombra — Boop ! : « pirate » le Héros cible (ctx.targetHeroId) → sa capacité est
   *  annulée (`abilityHacked`). Katya Volskaya ne peut pas être piratée. */
  | { type: 'HACK_HERO' }
  /** Sombra — Information : pioche `draw` cartes puis en défausse `discard` au choix
   *  (ouvre la sélection de défausse). */
  | { type: 'DRAW_THEN_DISCARD'; draw: number; discard: number }
  /** Sombra — Invisibilité : l'acteur est immunisé à la Fatalité jusqu'à son prochain
   *  tour (`noFate`). */
  | { type: 'FATE_IMMUNITY' }
  /** Sombra — Faille : le prochain Piratage joué ce tour est gratuit (`freePiratage`). */
  | { type: 'GRANT_FREE_PIRATAGE' }
  /** Bowser — remet `amount` Étoile(s) sur l'Observatoire de l'acteur (Mario,
   *  Vous avez obtenu une grande étoile !). Resync le verrou dynamique. No-op si
   *  l'acteur n'a pas d'Observatoire (pas Bowser). */
  | { type: 'RETURN_STAR_TO_OBSERVATORY'; amount: number }
  /** Bowser — Goinfre (Fatalité) : l'acteur (cible) perd `amount` jetons Pouvoir
   *  (plancher 0). */
  | { type: 'LOSE_POWER'; amount: number }
  /** Bowser — épuisement d'énergie : retire 1 Étoile de l'Observatoire et la pose
   *  sur l'Allié `ctx.allyInstanceIds[0]` (sur le lieu du pion). No-op si plus
   *  d'Étoile ou pas d'Allié cible. Resync le verrou. */
  | { type: 'DRAIN_STAR_TO_ALLY' }
  /** Bowser — Luigi (Fatalité, à la pose) : défausse tous les Alliés du lieu hôte
   *  (+ leurs Objets associés) ; chaque Étoile portée par ces Alliés est remise à
   *  l'Observatoire. */
  | { type: 'DISCARD_ALLIES_AND_RETURN_STARS_AT_HOST' }
  /** Bowser — Dino Piranha / Kamella (à la pose d'un Allié) : si l'Allié hôte est
   *  joué sur l'Observatoire, retire 1 Étoile de l'Observatoire et la pose sur lui.
   *  No-op sinon. */
  | { type: 'DRAIN_STAR_TO_SELF_IF_AT_OBSERVATORY' }
  /** Bowser — Impuissance : capture Peach (drapeau `peachCaptured`) si un Héros
   *  `peachCardId` est présent dans le royaume de l'acteur. No-op sinon (l'autre
   *  branche « Éliminer un Héros » passe par INSTANT_VANQUISH_HERO_LE). */
  | { type: 'CAPTURE_PEACH'; peachCardId: string }
  /** Bowser — Impuissance : résout le choix « Éliminer un Héros ≤ maxStrength OU
   *  capturer Peach ». Si `ctx.targetHeroId` est fourni → Vanquish instantané du
   *  Héros ; sinon → capture de Peach. */
  | { type: 'IMPUISSANCE_RESOLVE'; peachCardId: string; maxStrength: number }
  /** Bowser — Te revoilà ! : ouvre le choix (pendingRecover) d'une carte
   *  QUELCONQUE de la défausse à reprendre en main. */
  | { type: 'RECOVER_ANY_FROM_DISCARD' }
  /** Bowser — Vol du château : dévoile la pioche jusqu'à un Allié ou un Objet, le
   *  joue gratuitement sur le lieu du pion, et remet les autres cartes dévoilées
   *  sur le dessus de la pioche (ordre conservé). */
  | { type: 'REVEAL_UNTIL_PLAY_ALLY_OR_ITEM' }
  /** Bowser — Comète farceuse (Fatalité) : défausse un Objet du royaume de la
   *  cible (auto : un Objet non associé). */
  | { type: 'DISCARD_ONE_ITEM' }
  /** La Méchante Reine — gagne `amount` jetons Poison (Trône, Jalousie…). */
  | { type: 'GAIN_POISON'; amount: number }
  /** La Méchante Reine — Caquet de vieille mégère : gagne `amount` Pouvoir par lieu
   *  du royaume où se trouve au moins un Héros. */
  | { type: 'GAIN_POWER_PER_LOCATION_WITH_HERO'; amount: number }
  /** La Méchante Reine — « Croque ! » : choisit un Héros sur le lieu du pion et
   *  défausse autant de jetons Poison que sa force pour l'éliminer (interactif →
   *  pendingTakeABite). */
  | { type: 'TAKE_A_BITE' }
  /** La Méchante Reine — Miroir magique : cherche `heroCardId` (Blanche-Neige)
   *  dans la pioche/défausse Fatalité et la joue immédiatement. */
  | { type: 'FETCH_FATE_HERO'; heroCardId: string }
  /** La Méchante Reine — Poussière de momie : jusqu'au début de son prochain tour,
   *  chaque Fatalité ciblant ce joueur ajoute 1 jeton Poison (drapeau). */
  | { type: 'POISON_ON_FATE_TARGETED' }
  /** La Méchante Reine — Joyeux (Fatalité) : la cible défausse autant de jetons
   *  Poison que de Héros présents dans son royaume. */
  | { type: 'DISCARD_POISON_PER_HERO_IN_REALM' }
  /** La Méchante Reine — Animaux de la forêt (Fatalité) : révèle la main de la
   *  cible ; le joueur qui pose la Fatalité y choisit une carte à défausser
   *  (ouvre pendingFateChoice, kind `discard-from-hand`). */
  | { type: 'DISCARD_FROM_TARGET_HAND' }
  /** La Méchante Reine — Premier baiser d'amour (Fatalité) : la cible défausse 1
   *  jeton Poison, puis le joueur qui pose la Fatalité choisit un Héros de la
   *  défausse Fatalité de la cible à remettre sur le dessus de sa pioche Fatalité
   *  (ouvre pendingFateChoice, kind `fate-discard-hero-to-top`). */
  | { type: 'LOVES_FIRST_KISS' }
  /** La Méchante Reine — Magie noire : récupère en main un Objet/Ingrédient de la
   *  pioche ou de la défausse (auto : le plus utile) puis mélange la pioche. */
  | { type: 'BLACK_MAGIC_TUTOR' }
  /** La Méchante Reine — Foudre : reproduit l'effet d'un Ingrédient déjà joué
   *  (auto : Caquet en priorité). */
  | { type: 'DUPLICATE_INGREDIENT' }
  /** La Méchante Reine — Hurlement d'effroi : déplace chaque Héros de force ≤ 3 du
   *  lieu le plus menaçant vers un lieu voisin non bloqué (auto). */
  | { type: 'SCREAM_OF_FRIGHT' }
  /** La Méchante Reine — Vanité : réorganise les `count` premières cartes de sa
   *  pioche pour mettre la plus utile sur le dessus (auto). */
  | { type: 'SCRY_OWN_DECK'; count: number }
  /** La Méchante Reine — Noir de nuit : autorise à refaire une action (hors
   *  Fatalité) de son lieu ce tour-ci (drapeau repeatActionAvailable). */
  | { type: 'GRANT_REPEAT_ACTION' }
  /** Scar — Sarabi (Fatalité, à la pose) : défausse une Hyène sur le lieu de Sarabi
   *  (auto : la plus forte). */
  | { type: 'DISCARD_HYENA_AT_HOST' }
  /** Scar — Nala (Fatalité, à la pose) : déplace le Héros le plus fort du royaume
   *  vers le lieu comptant le moins d'Alliés de Scar (auto, défensif). */
  | { type: 'FATE_MOVE_HERO_TO_SAFEST' }
  /** Scar — Festin : rassemble toutes les Hyènes du royaume sur le lieu du pion
   *  (auto : consolidation, pour booster Hyène affamée). */
  | { type: 'GATHER_HYENAS' }
  /** Scar — Hakuna Matata (Fatalité) : si un Héros de force ≤ 3 est dans la pile
   *  Succession, le rejoue dans le royaume (auto, anti-Scar) ; sinon déplace un
   *  Héros (FATE_MOVE_HERO_TO_SAFEST). */
  | { type: 'HAKUNA_MATATA' }
  /** Scar — Shenzi (à la pose) : joue gratuitement une Hyène de la main (auto : la
   *  plus forte) sur le lieu de Shenzi. Nécessite hostLocationId (post-placement). */
  | { type: 'PLAY_FREE_HYENA' }
  /** Scar — Troupeau de gnous (à la pose) : s'il y a un Héros sur le lieu, le
   *  déplace vers un lieu voisin (auto). Nécessite hostLocationId (post-placement). */
  | { type: 'GNOUS_MOVE' }
  /** Scar — Longue vie au roi ! : dévoile les 4 premières cartes Fatalité, joue le
   *  Héros le plus fort dévoilé sur le lieu du pion (auto), défausse le reste. */
  | { type: 'REVEAL_FATE_PLAY_HERO'; count: number }
  /** Scar — Petit secret : joue un Héros de la défausse Fatalité (auto : le plus
   *  fort) sur le lieu du pion. */
  | { type: 'PLAY_FATE_HERO_FROM_DISCARD' }
  /** Scar — Soyez prêtes ! : défausse les 3 premières cartes de la pioche, puis
   *  récupère en main jusqu'à 2 Alliés (auto : Hyènes/forts d'abord) de la défausse,
   *  ou à défaut 1 Événement. */
  | { type: 'BE_PREPARED' }
  /** Scar — Suivez-moi ! : effectue une action disponible d'un lieu portant une
   *  Hyène (hors lieu du pion). Auto : déclenche la meilleure action « Gagner du
   *  pouvoir » d'un tel lieu. */
  | { type: 'FOLLOW_ME' }
  /** Yzma — Fausses funérailles : gagne 1 JT par Héros dans la défausse Fatalité,
   *  plafonné à `max`. */
  | { type: 'GAIN_POWER_PER_FATE_DISCARD_HERO'; max: number }
  /** Yzma — Mauvais levier : le joueur perd la moitié de ses jetons Pouvoir
   *  (arrondie au supérieur). */
  | { type: 'LOSE_HALF_POWER' }
  /** Yzma — agir sur l'une de SES pioches Fatalité (ouvre pendingYzmaOwnDeck) :
   *   - `attack` (À l'attaque !) : dévoile la pioche, joue tous ses Héros sur ce lieu,
   *     remélange le reste ;
   *   - `hammer` (Je l'écraserai avec un marteau) : dévoile 2 cartes au hasard et les
   *     défausse. */
  | { type: 'YZMA_OWN_DECK_ACTION'; mode: 'attack' | 'hammer' | 'snoop' }
  /** Yzma — Bras droit : récupère Kronk en main (depuis la pioche/défausse). S'il est
   *  déjà dans le royaume, reprend en main ses Objets associés (ses jetons sont
   *  défaussés). */
  | { type: 'FIND_KRONK' }
  /** Yzma — Le chemin qui balance : défausse tous les jetons Pouvoir de Kronk et en
   *  gagne autant. */
  | { type: 'KRONK_DISCARD_TOKENS' }
  /** Yzma — Chemin de la droiture (Fatalité) : pose 2 jetons sur Kronk si Kuzco est
   *  dans le royaume, sinon 1. */
  | { type: 'KRONK_ADD_TOKENS_IF_KUZCO' }
  /** Yzma — Finis le travail : déplace un Allié vers n'importe quel lieu portant au
   *  moins un Héros (ouvre pendingFinishJob). */
  | { type: 'FINISH_THE_JOB' }
  /** Yzma — En fuite (Fatalité) : retire un Héros du royaume, le mélange avec les 4
   *  pioches Fatalité, puis reforme 4 pioches les plus égales possibles (auto). */
  | { type: 'YZMA_HERO_REALM_TO_DECKS' }
  /** Yzma — Attention au groove ! / Paysan : prend un Héros de la défausse Fatalité et
   *  le mélange dans `count` pioche(s), reformées également. `optional` (Paysan : « Vous
   *  pouvez ») = le contrôleur peut refuser. Le contrôleur choisit le Héros et la/les
   *  pioche(s) (bot : Héros le plus fort + pioches les plus petites). */
  | { type: 'YZMA_HERO_DISCARD_TO_DECKS'; count: number; optional?: boolean }
  /** Yzma — Pacha (Fatalité) : mélange `count` pioches Fatalité ensemble, reformées
   *  également. `optional` (« Vous pouvez ») = le contrôleur peut refuser. */
  | { type: 'YZMA_RESHUFFLE_DECKS'; count: number; optional?: boolean }
  /** Yzma — Ironie du sort : si le joueur est avec un Allié, choisit un Événement de
   *  sa défausse, en paie le coût et le rejoue (ouvre pendingReplayEvent). */
  | { type: 'POETIC_JUSTICE' }
  /** Yzma — Beauté endormie : pose un effet différé (au prochain tour, avant le
   *  déplacement : +2 JT et pioche 2 cartes). */
  | { type: 'BEAUTY_SLEEP' }
  /** Ratigan — Le Grand Génie du Mal : piochez `draw` cartes OU gagnez `power` JT
   *  (résolu automatiquement par une heuristique : pioche si la main est courte,
   *  sinon Pouvoir). */
  | { type: 'DRAW_OR_GAIN_POWER'; draw: number; power: number }
  /** Ratigan — Capture : déplace un Héros du royaume de force ≤ `maxStrength` vers
   *  `locationId` (auto : le Héros éligible le plus fort). Respecte forbiddenLocations. */
  | { type: 'MOVE_REALM_HERO_TO'; maxStrength: number; locationId: LocationId }
  /** Ratigan — Cloche : cherche la carte `cardId` (Félicia) dans la pioche ou la
   *  défausse de l'acteur, l'ajoute à sa main, puis remélange sa pioche. */
  | { type: 'TUTOR_CARD_TO_HAND'; cardId: string }
  /** Ratigan — Basil (Fatalité, à la pose) : défausse un Objet non associé du lieu
   *  hôte (auto : `preferCardId` — la Reine Robot — en priorité, sinon le plus cher).
   *  Défausser la Reine Robot bascule l'objectif de Ratigan côté « Le Rat ». */
  | { type: 'DISCARD_ITEM_AT_HOST'; preferCardId?: string }
  /** Ratigan — Félicia (à la pose) : défausse un Héros du lieu hôte (auto : le plus
   *  À la pose, le joueur DOIT soit défausser un Allié de son lieu (ctx.allyInstanceIds[0]),
   *  soit payer `power` jetons Pouvoir de plus (géré dans applyPlayCard). Injouable si
   *  aucune des deux options n'est possible. L'effet ne réalise QUE la défausse (le
   *  supplément est prélevé au paiement du coût) ; no-op si l'option « payer » est choisie. */
  | { type: 'DISCARD_ALLY_AT_HOST_OR_PAY'; power: number }
  /** Ratigan — Piège ingénieux : élimine TOUS les Héros du lieu `locationId` (sans
   *  Allié, comme un Vanquish gratuit) : restitue leur Pouvoir verrouillé, déclenche
   *  leurs effets « à la mort », et pose le drapeau de victoire si Basil est éliminé
   *  côté « Le Rat ». */
  | { type: 'ELIMINATE_ALL_HEROES_AT'; locationId: LocationId }
  /** Ratigan — Brutes (à la pose) : si l'Allié est joué sur un lieu où le pion n'est
   *  PAS, le joueur peut effectuer UNE action disponible de ce lieu, hors Fatalité
   *  (fenêtre `actAtLocation` skippable, comme « Suivez-moi ! » / la Canne). */
  | { type: 'ALLY_REMOTE_ACTION' }

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
  /** Pour un Objet associé : bonus de force conféré à la carte hôte (recopié de
   *  CardDef). Sommé par effectiveStrength sur tous les Objets associés à une carte. */
  attachStrengthBonus?: number
  /** Capitaine Crochet : Objet qui DONNE une action à son lieu tant qu'il y est
   *  posé (Canon → Vaincre, Boîte à Crochets → Gagner 1, Ingénieux Mécanisme →
   *  Déplacer un Héros). */
  grantsAction?: { type: LocationActionType; amount?: number; label: string }
  /** Bonus de force temporaire « jusqu'à la fin du tour » (Pas de Quartier !).
   *  Remis à zéro à la fin du tour du joueur actif. */
  tempStrengthBonus?: number
  /** Ursula — Pacte : lieu lié au Pacte. Le Héros porteur est éliminé s'il est
   *  déplacé sur ce lieu. */
  contractLocationId?: LocationId
  /** Ursula — Ariel : Objet « gelé ». Ursula ne peut plus le déplacer tant que le
   *  Héros d'instanceId `frozenBy` (Ariel) est présent dans son royaume. */
  frozenBy?: string
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
  /** Bowser — Étoiles déposées sur cet Allié (drainées de l'Observatoire par
   *  épuisement d'énergie, Dino Piranha, Kamella…). Défaussées avec la carte ;
   *  une Étoile est perdue si l'Allié sert à éliminer un Héros (cf. règle carte). */
  stars?: number
  /** Yzma — jetons Pouvoir posés sur Kronk (gagnés à chaque déplacement). À 3+, Kronk
   *  « passe au-dessus du plateau » et devient un Héros (drapeau `kronkTransformed`). */
  kronkPower?: number
  /** Yzma — Kronk a atteint 3+ jetons : il est devenu un Héros (n'est plus un Allié). */
  kronkTransformed?: boolean
  /** Restrictions imposées sur le lieu où cette carte est posée (Malédictions). */
  placementRestriction?: PlacementRestriction
  /** Modificateur passif de force que cette carte applique aux AUTRES cartes du
   *  même lieu (aura : Sommeil sans Rêves, Niquedouille, Pendard, Sablier Géant). */
  strengthMod?: StrengthMod
  /** Modificateurs conditionnels de SA PROPRE force (Créature Rieuse, Génie,
   *  Rajah, Adam de la Halle…). Sommés par effectiveStrength. */
  selfStrengthMods?: SelfStrengthMod[]
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
  /** Ratigan — Piège ingénieux : amorcé via Activer. Au début du PROCHAIN tour de
   *  son propriétaire (avant le déplacement), tous les Héros de son lieu sont
   *  éliminés, puis cette carte est défaussée. */
  trapArmed?: boolean
  /** Cette carte ne peut être posée QUE sur ce lieu (Jafar : Lampe Merveilleuse →
   *  Caverne aux Merveilles). Absent = n'importe quel lieu non verrouillé. */
  playOnlyAt?: LocationId
  /** L'Imposteur — Tâche / Sabotage : seuil de Coéquipiers sur son lieu qui, avant
   *  le déplacement de fin de tour, provoque sa défausse (+1 si le Coéquipier
   *  imposteur est sur ce lieu). Donnée réutilisable, recopiée de CardDef. */
  discardAtCrewmates?: number
  /** L'Imposteur — Sabotage : compte pour l'objectif (survivre 3 tours) et attire
   *  tous les Coéquipiers. `sabotageTurns` porte son compte à rebours. */
  isSabotage?: boolean
  /** L'Imposteur — Objet posé sur le royaume via une FATALITÉ (Vidéo de surveillance,
   *  Carte). Ciblable par « Communication désactivée ». État de jeu (runtime). */
  fromFate?: boolean
  /** Reine de Cœur : cette Carte Garde a été transformée en arceau (croquet).
   *  Un arceau ne compte plus comme un Allié et sert l'objectif Coup Royal. */
  isWicket?: boolean
  /** Hadès — Titan (Lythos, Hydros, Pyros, Stratos, Argès) : Allié spécial joué
   *  sur Les Enfers, déplacé (en payant du Pouvoir) vers le Mont Olympe. Compte
   *  pour l'objectif s'il y arrive sans être entravé. Recopié de CardDef. */
  isTitan?: boolean
  /** Hadès — Titan « entravé » par un Héros (Zeus, Héra, Éclairs…). Un Titan
   *  entravé ne peut plus être déplacé, ne participe pas aux Vanquish et ne compte
   *  pas pour l'objectif tant qu'il n'est pas désentravé. État de jeu (runtime). */
  trapped?: boolean
  /** L'Imposteur — Sabotage (O2 / Réacteur) : nombre de tours écoulés depuis sa
   *  pose. À `turns` (3) l'Imposteur gagne. État de jeu (runtime), incrémenté par
   *  la mécanique des Coéquipiers (à venir). */
  sabotageTurns?: number
  /** L'Allié peut Éliminer un Héros sur son lieu OU sur un lieu voisin (Flibustiers,
   *  Archers Loups, Cerbère). Donnée réutilisable, recopiée de CardDef. */
  reachesAdjacentVanquish?: boolean
  /** Objet « véhicule » : 1×/tour, déplace la figurine + cet Objet vers n'importe
   *  quel lieu pour y agir (hors Fatalité). Char (Hadès) / Bateau (Bowser).
   *  Recopié de CardDef ; consommé via CHARIOT_MOVE / applyChariotMove. */
  ridesWithPawn?: boolean
  /** Quand cet Allié est utilisé pour un Vanquish, il retourne dans la main au lieu
   *  d'être défaussé (Hadès : Hydre). Recopié de CardDef. */
  returnToHandOnVanquish?: boolean
  /** Dr Facilier — comportement de la carte révélée depuis la Pile de l'Au-delà.
   *  Recopié de CardDef. Absent = la carte est simplement défaussée si révélée. */
  auDela?: AuDelaEffect
  /** Dr Facilier — quand cette carte (un Événement : Amis de l'au-delà, Régner sur
   *  la Nouvelle-Orléans) est jouée, elle va dans la Pile de l'Au-delà au lieu de
   *  la défausse. Recopié de CardDef. */
  goesToAuDelaOnPlay?: boolean
  /** La carte compte AUSSI comme un Objet (en plus de son `type`). Dr Facilier —
   *  Esprits des masques (Allié + Objet) : ciblable par les effets « Objet »
   *  (Joujou). Recopié de CardDef. */
  alsoItem?: boolean
  /** Héros à éliminer avant les autres (Prof). Recopié de CardDef. */
  mustDefeatFirst?: boolean
  /** Héros Fatalité posé d'office sur ce lieu (Blanche-Neige → Maison des Nains).
   *  Recopié de CardDef. */
  forcedFateLocation?: LocationId
  /** Fatalité : révélée parmi les deux, autorise à jouer les DEUX cartes (Ray,
   *  Dormeur). Recopié de CardDef. */
  fatePlayBoth?: boolean
  /** Scar — Allié « Hyène » (synergies de Scar). Recopié de CardDef. */
  isHyena?: boolean
  /** Scar — injouable sans Hyène dans le royaume (Festin). Recopié de CardDef. */
  requiresHyenaInRealm?: boolean
  /** Sombra — carte de Piratage (Piratage, IEM) : posée sur un lieu, NON déplaçable,
   *  comptée comme Objet pour les conditions adverses. Recopié de CardDef. */
  isPiratage?: boolean
  /** Sombra — Piratage qui désactive une action du lieu à la pose (Piratage = oui,
   *  IEM = non). Recopié de CardDef. */
  hackDisablesAction?: boolean
  /** Sombra — Faille : résout ses effets puis est défaussé (ne reste pas en jeu). */
  discardOnPlay?: boolean
  /** Sombra — id de l'action du lieu désactivée par ce Piratage (recouverte par
   *  l'image Hack) tant que le Piratage reste sur le lieu. Posé à la pose. */
  hackedActionId?: string
  /** Sombra — Héros « piraté » (Boop attaché) : sa capacité est annulée (carte sans
   *  effet). Posé quand Boop lui est associé ; retiré si Boop est retiré. */
  abilityHacked?: boolean
  /** Reine de Cœur : taille d'un Héros. `'shrunk'` (rapetissé) → ne recouvre
   *  qu'une action du haut ; `'enlarged'` (agrandi) → recouvre une action de plus.
   *  Absent = taille normale (recouvre la rangée du haut). */
  heroSize?: 'shrunk' | 'enlarged'
  /** Reine de Cœur — Agrandir : lieu adjacent dans lequel un Héros agrandi
   *  recouvre une action supplémentaire (le côté gauche OU droite choisi à la
   *  pose). Présent uniquement quand `heroSize === 'enlarged'`. */
  enlargeTargetId?: LocationId
  /** Reine de Cœur — Rapetisser : action du haut (de son lieu) que le Héros
   *  rapetissé LAISSE LIBRE (choisie à la pose). Il recouvre l'AUTRE action du
   *  haut. Présent uniquement quand `heroSize === 'shrunk'`. */
  shrunkFreeActionId?: string
}

/** Restrictions de pose imposées par une carte sur son lieu (Malédictions, Héros). */
export type PlacementRestriction =
  /** Aucun Héros ne peut être posé sur ce lieu (Feu Infernal). */
  | { type: 'no-heroes' }
  /** Force minimale requise pour qu'un Héros soit posé sur ce lieu (Forêt de Ronces). */
  | { type: 'min-hero-strength'; value: number }
  /** Aucune Malédiction ne peut être posée sur ce lieu (Pimprenelle). */
  | { type: 'no-curses' }

/** Modificateur passif de force qu'une carte applique aux AUTRES cartes de son
 *  lieu (aura). Donnée réutilisable : le moteur somme ces modificateurs sur le
 *  lieu sans connaître la carte source. */
export type StrengthMod =
  /** Modifie la force des Héros du même lieu (Sommeil sans Rêves : -2 ; Sablier
   *  Géant : -2 mais seulement s'il a été activé ce tour-ci →
   *  `onlyIfActivatedThisTurn`). */
  | { target: 'heroes-here'; delta: number; onlyIfActivatedThisTurn?: boolean }
  /** Modifie la force des Alliés du même lieu. `excludeSelf` : la carte source
   *  ne se modifie pas elle-même (Niquedouille : +1 aux AUTRES Alliés ; Pendard :
   *  -1 aux AUTRES Alliés). */
  | { target: 'allies-here'; delta: number; excludeSelf?: boolean }
  /** Modifie la force de TOUS les Héros du royaume (aura globale, pas seulement le
   *  lieu). `excludeSelf` : la carte source ne s'affecte pas (Adam de la Halle :
   *  +1 à tous les AUTRES Héros). */
  | { target: 'heroes-realm'; delta: number; excludeSelf?: boolean }

/** Modificateur passif qu'une carte applique à SA PROPRE force selon une
 *  condition. Donnée réutilisable : le moteur évalue chaque variant, la carte ne
 *  porte que les paramètres (plus de cardId codé en dur dans effectiveStrength).
 *  Ajouter une synergie de ce genre = un variant + un case dans effectiveStrength. */
export type SelfStrengthMod =
  /** +delta par carte de type `cardType` présente sur le MÊME lieu
   *  (Créature Rieuse : +1 par Héros ici). */
  | { kind: 'per-type-here'; cardType: CardType; delta: number }
  /** +delta si au moins une carte de type `cardType` est présente sur le même
   *  lieu (Sinistre Créature : +1 si une Malédiction ici). */
  | { kind: 'if-type-here'; cardType: CardType; delta: number }
  /** +delta si une carte `cardId` est présente — sur le même lieu
   *  (`scope: 'location'`, Génie + Lampe Merveilleuse) ou n'importe où dans le
   *  royaume (`scope: 'realm'`, Rajah + Princesse Jasmine). */
  | { kind: 'if-card'; cardId: string; scope: 'location' | 'realm'; delta: number }
  /** +delta par AUTRE Héros présent dans le royaume (Blanche-Neige : +1 par
   *  autre Héros). N'inclut pas la carte elle-même. */
  | { kind: 'per-other-hero-realm'; delta: number }
  /** +delta s'il n'y a AUCUN autre Héros sur le même lieu (Grincheux : +1 s'il
   *  est seul sur son lieu). */
  | { kind: 'if-alone-here'; delta: number }
  /** Scar — +delta par AUTRE Hyène (`isHyena`) sur le MÊME lieu (Hyène affamée). */
  | { kind: 'per-other-hyena-here'; delta: number }

/** Dr Facilier — comportement d'une carte RÉVÉLÉE depuis la Pile de l'Au-delà
 *  par Divination. Donnée réutilisable, interprétée par resolveAuDela (effects.ts).
 *  Une carte sans `auDela` est simplement défaussée quand elle est révélée. */
export type AuDelaEffect =
  /** Amis de l'au-delà : gagne `amount` Pouvoir, puis se défausse. */
  | { kind: 'gain-power-discard'; amount: number }
  /** Esprits des ombres : se défausse et fait perdre `amount` Pouvoir. */
  | { kind: 'lose-power-discard'; amount: number }
  /** Régner sur la Nouvelle-Orléans : si Facilier détient le Talisman, victoire ;
   *  sinon, la carte retourne dans la Pile de l'Au-delà. */
  | { kind: 'win-if-talisman' }
  /** Ombre du Dr Facilier : la carte est posée sur le lieu `locationId`. */
  | { kind: 'place-on-location'; locationId: LocationId }
  /** Tour de passe-passe : regarde les `look` premières cartes de la pioche, en
   *  ajoute `take` à la main, défausse les autres, puis se défausse. */
  | { kind: 'scry-draw-discard'; look: number; take: number }
  /** Esprits des masques : défausse toutes les cartes Esprits des masques
   *  révélées, remet les AUTRES cartes révélées (non encore résolues) dans la
   *  Pile de l'Au-delà sans appliquer leur effet, et interrompt la résolution. */
  | { kind: 'masks-abort' }

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
  /** L'adversaire actif vient de vaincre CE TOUR un Héros de force ≤ `value`
   *  (Yzma — Férocité). */
  | { type: 'opponent-vanquished-hero-strength-le'; value: number }
  /** L'adversaire actif a défaussé au moins `value` cartes ce tour-ci (Désespoir). */
  | { type: 'opponent-discarded-ge'; value: number }
  /** L'adversaire actif a gagné au moins `value` jetons Pouvoir ce tour-ci (Terreur). */
  | { type: 'opponent-gained-power-ge'; value: number }
  /** L'adversaire actif a joué au moins `value` cartes ce tour-ci (Insidieux). */
  | { type: 'opponent-played-cards-ge'; value: number }
  /** L'adversaire actif a ciblé le joueur avec une action Fatalité ce tour-ci
   *  (Scar — La vie n'est pas juste). */
  | { type: 'opponent-fate-targeted-me' }

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
  /** Yzma — QUATRE pioches Fatalité (une par lieu, indexées par id de lieu). Quand
   *  ce champ est défini, `fateDeck` est inutilisé (vide) : l'adversaire choisit une
   *  pioche par lieu lors d'une Fatalité. `undefined` pour les autres vilains. */
  fateDecks?: Record<LocationId, CardInstance[]>
  /** Défausse Fatalité (carte révélée non jouée, héros vaincus…). Yzma : une seule
   *  défausse partagée par ses 4 pioches. */
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
  /** Dr Facilier — Pile de l'Au-delà : cartes mises de côté (Amis de l'au-delà,
   *  Régner, Alliés/cartes ajoutés par les adversaires…). Divination en révèle 3
   *  au hasard et résout leurs effets Au-delà. Toujours présent (`[]`) ; seul
   *  Facilier l'alimente. */
  auDela: CardInstance[]
  /** Scar — Pile Succession : Mufasa éliminé y est placé, ainsi que les Héros
   *  éliminés ensuite. La Force combinée des Héros de la pile détermine l'objectif.
   *  `undefined` pour les vilains autres que Scar. */
  succession?: CardInstance[]
  /** Yzma — objectif DEFEAT_HERO_WITH_ALLY : passé à `true` dès que l'Allié requis
   *  (Kronk) élimine le Héros requis (Kuzco). Ratigan le réutilise côté « Le Rat »
   *  (Basil éliminé). `undefined` pour les autres vilains. */
  objectiveHeroDefeated?: boolean
  /** Ratigan — objectif DOUBLE : passé à `true` quand la Reine Robot est défaussée
   *  (par Basil), basculant la tuile Objectif côté « Le Rat » (éliminer Basil).
   *  `undefined` pour les autres vilains. */
  becameTheRat?: boolean
  /** Yzma — Beauté endormie : effet différé armé ; déclenché au début du prochain
   *  tour d'Yzma (avant le déplacement : ouvre pendingBeautySleep). */
  beautySleepPending?: boolean
  /** Yzma — Beauté endormie : verrou « seule action ». Posé quand la carte est
   *  jouée : aucune AUTRE action n'est permise ce tour-ci. Réinitialisé au début
   *  du tour suivant. */
  soleActionLock?: boolean
  /** Sombra — Invisibilité : immunisée à la Fatalité jusqu'au début de son prochain
   *  tour (posé quand la carte est jouée, réinitialisé à son tour suivant). */
  noFate?: boolean
  /** Sombra — Faille : le prochain Piratage joué ce tour est GRATUIT (coût 0).
   *  Consommé à la pose d'un Piratage. */
  freePiratage?: boolean
  /** Bowser — Étoiles présentes sur l'Observatoire de la Comète. `undefined`
   *  pour les vilains sans Étoiles. Quand ce compteur tombe à 0, le lieu
   *  `starLocationId` est verrouillé (helper syncObservatoryLock). */
  observatoryStars?: number
  /** Bowser — id du lieu Observatoire (recopié de VillainDef.starSetup), pour
   *  savoir quel lieu verrouiller à 0 Étoile et où les remettre. */
  starLocationId?: LocationId
  /** Bowser — Peach a été capturée (via Impuissance). Condition de victoire. */
  peachCaptured?: boolean
  /** L'Imposteur — ses 8 COÉQUIPIERS posés sur le plateau (cases d'action).
   *  Absent pour les autres vilains. Voir l'interface `Crewmate`. */
  crewmates?: Crewmate[]
  /** L'Imposteur — Porte désactivée : les Coéquipiers ne se déplacent pas à la fin
   *  du prochain tour (drapeau consommé au moment du déplacement). */
  crewmatesSkipMove?: boolean
  /** La Méchante Reine — jetons POISON accumulés (défaussés par « Croque ! » pour
   *  éliminer un Héros). `undefined` pour les autres vilains. */
  poison?: number
  /** La Méchante Reine — zone INGRÉDIENTS : un exemplaire de chaque Ingrédient
   *  déjà joué (Caquet, Hurlement, Noir de nuit, Poussière de momie). Quand les 4
   *  Ingrédients DIFFÉRENTS y sont, la Maison des Nains est déverrouillée. */
  ingredients?: CardInstance[]
  /** La Méchante Reine — id du lieu Maison des Nains (verrouillé tant que les 4
   *  Ingrédients ne sont pas joués). Recopié à la mise en place. */
  cottageLocationId?: LocationId
  /** La Méchante Reine — Poussière de momie : jusqu'au début de son prochain tour,
   *  chaque Fatalité ciblant ce joueur ajoute 1 jeton Poison. */
  poisonOnFateTargeted?: boolean
  /** La Méchante Reine — Noir de nuit : autorise à effectuer une SECONDE fois une
   *  action (hors Fatalité) de son lieu ce tour-ci. Consommé à la réutilisation. */
  repeatActionAvailable?: boolean
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
  /** La Méchante Reine — « Je vais vous broyer les os ! » : ce tour-ci, le joueur
   *  actif peut utiliser TOUTES les actions recouvertes par un Héros sur son lieu.
   *  Réinitialisé au début de chaque tour. */
  uncoverCoveredActions?: boolean
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
   * Vanquish FACULTATIF en attente, proposé après une autre action :
   *   - `source: 'trap'` (Tendre un Piège) : éliminer n'importe quel Héros ;
   *   - `source: 'gnous'` (Scar — Troupeau de gnous) : éliminer un Héros sur le
   *     `locationId` où le Héros vient d'être repoussé ;
   *   - `source: 'uniforme'` (Ratigan — Uniforme) : éliminer un Héros sur le
   *     `locationId` de l'Allié porteur, qui DOIT participer (`requiredAllyInstanceId`).
   * Consommé par TRAP_VANQUISH / TRAP_SKIP_VANQUISH ou la fin de tour.
   */
  pendingTrapVanquish?: {
    source: 'trap' | 'gnous' | 'uniforme'
    locationId?: LocationId
    /** Uniforme : instanceId de l'Allié porteur, OBLIGATOIRE parmi les participants. */
    requiredAllyInstanceId?: string
  } | null
  /**
   * Tyrannie en cours : le joueur `playerIndex` a pioché et doit maintenant
   * choisir `count` cartes de sa main à défausser (RESOLVE_TYRANNY_DISCARD)
   * avant que la partie ne reprenne. Absent hors d'une résolution de Tyrannie.
   */
  pendingTyrannyDiscard?: {
    playerIndex: number
    count: number
    /** Nombre de cartes à piocher APRÈS la défausse (Tâche : Station essence = 1). */
    thenDraw?: number
    /** Libellé de la source (journal/showcase). Défaut : « Tyrannie ». */
    label?: string
  }
  /** Sombra — Information : `playerIndex` vient de piocher `drawnIds` cartes ; il
   *  choisit ensuite de défausser `discardCount` cartes de sa main (RESOLVE_INFORMATION
   *  discardDrawn=false → ouvre la sélection) OU de défausser les cartes piochées
   *  (discardDrawn=true). */
  pendingInformation?: {
    playerIndex: number
    drawnIds: string[]
    discardCount: number
  } | null
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
  pendingPawnMove?: { chooserIndex: number; targetIndex: number; via?: string }
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
   * Ratigan — Le Grand Génie du Mal : `playerIndex` choisit entre piocher `draw`
   * cartes OU gagner `power` Pouvoir (RESOLVE_DRAW_OR_GAIN_POWER). Absent / `null`
   * hors de ce choix.
   */
  pendingDrawOrGainPower?: { playerIndex: number; draw: number; power: number } | null
  /**
   * Déplacement de Héros vers un lieu voisin en attente : `chooserIndex` choisit
   * un Héros du royaume de `targetIndex` et un lieu adjacent (RESOLVE_HERO_RELOCATE).
   * Apparition (chooser = target = Slenderman) ; Vent de panique (Fatalité :
   * chooser = adversaire, target = Slenderman). Absent / `null` hors de ce choix.
   */
  pendingHeroRelocate?: {
    chooserIndex: number
    targetIndex: number
    anyLocation?: boolean
    candidateIds?: string[]
    /** Dr Facilier — Poupées vaudou : le Héros ne peut être déplacé que de 1 lieu
     *  dans cette direction (−1 = gauche, +1 = droite), comme les Poupées. */
    forcedDirection?: number
    /** Ratigan — Capture : la destination est IMPOSÉE (Repaire secret) ; le joueur
     *  choisit seulement QUEL Héros (parmi `candidateIds`) déplacer vers ce lieu. */
    forcedLocationId?: LocationId
    /** Le déplacement est FACULTATIF (« vous pouvez ») : SKIP_HERO_RELOCATE permis. */
    optional?: boolean
    /** Scar — Troupeau de gnous : après le déplacement, ouvre un Vanquish facultatif
     *  sur le lieu d'arrivée (pendingTrapVanquish `source: 'gnous'`). */
    thenTrapVanquish?: boolean
  } | null
  /**
   * Flèche de Mome Raths (Fatalité, Reine de Cœur) : `chooserIndex` (joueur qui pose
   * la Fatalité) déplace un Allié du royaume de `targetIndex` vers le lieu non bloqué
   * de son choix (RESOLVE_ALLY_RELOCATE). Absent / `null` hors de ce choix.
   */
  pendingAllyRelocate?: { chooserIndex: number; targetIndex: number } | null
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
  /** Faites-leur peur ! (Capitaine Crochet) : `playerIndex` regarde les 2 cartes
   *  `cards` retirées du dessus de sa pioche Fatalité, puis les défausse ou les
   *  remet sur le dessus dans l'ordre de son choix (RESOLVE_SCRY).
   *  `rerevealFate` (Scar — La vie n'est pas juste, en réaction) : on trie les 2 cartes
   *  que l'adversaire s'apprête à révéler ; les gardées retournent sur le DESSUS de la
   *  pioche Fatalité (les écartées sont défaussées), PUIS l'adversaire re-révèle sa
   *  Fatalité depuis ce dessus modifié (il pioche donc la gardée + la suivante). */
  pendingScry?: { playerIndex: number; cards: CardInstance[]; rerevealFate?: boolean; pasSiVite?: boolean } | null
  /** Déplacement d'un Allié vers un lieu voisin non bloqué : `playerIndex` choisit
   *  l'Allié ; il gagne `amount` force jusqu'à la fin du tour (RESOLVE_ALLY_MOVE_BUFF).
   *  `label` : titre/log (carte source) ; `optional` : facultatif → SKIP_ALLY_MOVE_BUFF
   *  permis. Sert Pas de Quartier ! (Crochet, +2) et Grand Terrier (Bowser, +0). */
  pendingAllyMoveBuff?: { playerIndex: number; amount: number; label?: string; optional?: boolean } | null
  /** Choix sur une carte Fatalité ciblant le royaume de `targetIndex`, fait par
   *  `chooserIndex` (celui qui a joué la Fatalité) — RESOLVE_FATE_CHOICE :
   *   - `steal-item-to-hero` (Abu/Aladdin) : associer un Objet (`candidateIds`) au
   *     Héros `hostInstanceId` ;
   *   - `remove-ally` (K.O.) : retirer un Allié (`candidateIds`) du royaume ;
   *   - `remove-item` (Migraine Atroce) : défausser un Objet du royaume ;
   *   - `discard-from-hand` (Animaux de la forêt) : révèle la MAIN de la cible et
   *     le chooser y choisit une carte à défausser ;
   *   - `fate-discard-hero-to-top` (Premier baiser d'amour) : le chooser choisit un
   *     Héros de la DÉFAUSSE Fatalité de la cible à remettre sur le dessus de sa
   *     pioche Fatalité.
   *   - `play-revealed-fate-hero` (Scar — Longue vie au roi !) : le chooser (= la
   *     cible) choisit, parmi les Héros dévoilés (déposés dans sa défausse Fatalité),
   *     lequel jouer dans son royaume ; les autres restent défaussés.
   *   - `play-fate-card-from-discard` (Scar — Petit secret) : le chooser (= la cible)
   *     choisit une carte Fatalité (Héros ou Événement) de SA défausse Fatalité et la
   *     joue (Héros → royaume ; Événement → ses effets se re-déclenchent). */
  pendingFateChoice?: {
    chooserIndex: number
    targetIndex: number
    kind:
      | 'steal-item-to-hero'
      | 'remove-ally'
      | 'remove-item'
      | 'discard-from-hand'
      | 'fate-discard-hero-to-top'
      | 'play-revealed-fate-hero'
      | 'play-fate-card-from-discard'
      | 'hand-to-deck-top'
    hostInstanceId?: string
    candidateIds: string[]
  } | null
  /** Digne Adversaire / Obsession (Capitaine Crochet) : `playerIndex` a dévoilé son
   *  deck Fatalité jusqu'à `hero` ; il choisit de le JOUER (et où) ou de le DÉFAUSSER
   *  (RESOLVE_FETCHED_HERO). `discarded` = autres cartes dévoilées (à défausser),
   *  montrées pour information. */
  pendingFetchedHero?: { playerIndex: number; hero: CardInstance; discarded: CardInstance[] } | null
  /** Vol du château (Bowser) : `playerIndex` a dévoilé sa pioche jusqu'à un Allié/
   *  Objet (`found`) ; `revealed` = cartes dévoilées AVANT (déjà remises sur le
   *  dessus de la pioche, montrées pour information). Le joueur choisit le LIEU où
   *  poser `found` (RESOLVE_CASTLE_THEFT) ; `toHand` = l'Objet s'associe (à un Allié/
   *  Héros) → il va en main, pas de choix de lieu. Affiché des deux côtés. */
  pendingCastleTheft?: { playerIndex: number; found: CardInstance; revealed: CardInstance[]; toHand: boolean } | null
  /** Opportunisme (Ursula) : `playerIndex` choisit une carte (`candidateIds`) de sa
   *  défausse Vilain à reprendre en main (RESOLVE_RECOVER). */
  pendingRecover?: {
    playerIndex: number
    candidateIds: string[]
    /** Mélange le deck APRÈS la reprise (Tâche : Téléchargement de L'Imposteur). */
    thenShuffle?: boolean
    /** Libellé de la source (journal). Défaut : « Opportunisme ». */
    label?: string
  } | null
  /** Scar — Soyez prêtes ! : après avoir défaussé 3 cartes, `playerIndex` reprend en
   *  main soit 1 Événement, soit jusqu'à 2 Alliés de sa défausse (RESOLVE_BE_PREPARED ;
   *  `instanceId` null = terminer). `alliesOnly` : on a déjà repris 1 Allié, seuls les
   *  Alliés restent éligibles (un 2ᵉ, ou terminer). */
  pendingBePrepared?: { playerIndex: number; candidateIds: string[]; alliesOnly: boolean } | null
  /** Scar — Shenzi : `playerIndex` peut jouer GRATUITEMENT une Hyène de sa main
   *  (`candidateIds`) sur `locationId` (le lieu de Shenzi) — RESOLVE_FREE_HYENA ;
   *  `instanceId` null = ne pas jouer. */
  pendingFreeHyena?: { playerIndex: number; locationId: string; candidateIds: string[] } | null
  /** Scar — Hakuna Matata (Fatalité) : `playerIndex` choisit AU CHOIX de rejouer un
   *  Héros de force ≤ 3 de la pile Succession (`successionIds`), OU de déplacer un
   *  Héros du royaume (`realmHeroIds`) vers n'importe quel lieu — RESOLVE_HAKUNA_MATATA. */
  pendingHakunaMatata?: { playerIndex: number; successionIds: string[]; realmHeroIds: string[] } | null
  /** L'Imposteur — Tuer / Fausse accusation : `playerIndex` choisit le Coéquipier
   *  (par couleur) à défausser parmi `candidateColors` (RESOLVE_CREWMATE_KILL).
   *  `mode` = 'kill' (les autres Coéquipiers du LIEU deviennent suspects) ou
   *  'false-accusation' (TOUS les autres redeviennent normaux). */
  pendingCrewmateKill?: {
    playerIndex: number
    candidateColors: string[]
    /** 'kill' (Tuer — les autres du LIEU deviennent suspects) · 'false-accusation'
     *  (les autres redeviennent normaux) · 'reassure' (Assurance — le choisi
     *  redevient normal, pas de défausse). */
    mode: 'kill' | 'false-accusation' | 'reassure' | 'kill-normal' | 'move'
  } | null
  /** L'Imposteur — Tâche visuelle (Fatalité) : `chooserIndex` (l'adversaire qui joue
   *  la Fatalité) rend suspects jusqu'à `remaining` Coéquipiers de `targetIndex`
   *  (l'Imposteur). RESOLVE_CREWMATE_SUSPECT (un par un) / DONE_CREWMATE_SUSPECT. */
  pendingCrewmateSuspect?: { chooserIndex: number; targetIndex: number; remaining: number } | null
  /** L'Imposteur — Assurance : après avoir rendu un Coéquipier normal, l'Imposteur
   *  (`playerIndex`) peut le déplacer (`color`) vers un des `eligibleLocs` (lieux à
   *  ≤ 2 d'écart). RESOLVE_CREWMATE_MOVE / DONE_CREWMATE_MOVE (facultatif). */
  pendingCrewmateMove?: { playerIndex: number; color: string; eligibleLocs: LocationId[] } | null
  /** L'Imposteur — Vidéo de surveillance / Carte (Fatalité) : `chooserIndex`
   *  (l'adversaire qui joue la Fatalité) associe l'Objet `card` à un lieu du
   *  royaume de `targetIndex` (l'Imposteur). RESOLVE_FATE_OBJECT_PLACE. */
  pendingFateObjectPlace?: { chooserIndex: number; targetIndex: number; card: CardInstance } | null
  /** Ratigan — Appel à l'aide (Fatalité) : `chooserIndex` (l'adversaire qui joue la
   *  Fatalité) choisit le lieu du royaume de `targetIndex` (Ratigan) où poser le
   *  Héros `heroCardId` (cherché dans la pioche/défausse Fatalité) — ou l'y déplacer
   *  s'il y est déjà (`mode`). RESOLVE_FATE_HERO_PLACE. */
  pendingFateHeroPlace?: {
    chooserIndex: number
    targetIndex: number
    heroCardId: string
    heroName: string
    mode: 'place' | 'move'
  } | null
  /** Colère Titanesque (Ursula) / Canne (Dr Facilier) : `playerIndex` doit choisir
   *  un lieu voisin sur lequel effectuer une action (RESOLVE_GIANT_LOCATION).
   *  `viaCanne` = ouverture par la Canne (action Fatalité du voisin exclue, usage
   *  unique par tour). `viaFollowMe` (Scar — Suivez-moi !) : les lieux candidats ne
   *  sont pas les voisins mais ceux listés dans `locations` (lieux portant une Hyène,
   *  hors lieu du pion) ; action Fatalité exclue. */
  pendingGiantAction?: {
    playerIndex: number
    viaCanne?: boolean
    viaFollowMe?: boolean
    locations?: string[]
  } | null
  /** Colère Titanesque : tant que ce champ est posé, le joueur actif agit comme
   *  s'il était sur ce lieu (cf. currentLocation) ; effacé après UNE action. */
  actAtLocation?: LocationId | null
  /** Sauvegarde de `usedActionIds` avant l'action « géante », restaurée après
   *  (l'action d'un lieu voisin ne consomme pas l'économie d'actions normale). */
  usedBeforeGiant?: string[] | null
  /** Fenêtre `actAtLocation` FACULTATIVE (Ratigan — Brutes) : le joueur peut
   *  renoncer (SKIP_REMOTE_ACTION) au lieu d'agir. Absent pour les fenêtres
   *  obligatoires (Char/Bateau, Suivez-moi !, Canne). */
  actAtLocationSkippable?: boolean | null
  /** Le joueur actif a déplacé un Allié/Objet ce tour-ci (déclencheur Sombres desseins). */
  activeMovedCard?: boolean
  /** Le joueur actif a pioché ≥1 carte ce tour-ci via un effet (déclencheur Sans visage). */
  activeDrewCard?: boolean
  /** Nombre de cartes défaussées par le joueur actif ce tour-ci (déclencheur
   *  Désespoir, Dr Facilier). Remis à 0 en fin de tour. */
  activeDiscardedCount?: number
  /** Pouvoir gagné par le joueur actif ce tour-ci (déclencheur Terreur, Dr
   *  Facilier). Remis à 0 en fin de tour. */
  activeGainedPower?: number
  /** Nombre de cartes jouées par le joueur actif ce tour-ci (déclencheur Insidieux,
   *  L'Imposteur). Remis à 0 en fin de tour. */
  activePlayedCount?: number
  /** Indices des joueurs ciblés par une action Fatalité du joueur actif ce tour-ci
   *  (déclencheur Scar — La vie n'est pas juste). Remis à [] en fin de tour. */
  activeFateTargets?: number[]
  /** Hadès — Préparez-vous au combat ! / action « Déplacer » sur un Titan :
   *  `playerIndex` (Hadès) choisit un de ses Titans non entravés (`titanCandidateIds`)
   *  et un lieu de destination, puis le déplace (RESOLVE_TITAN_MOVE). `paid` : le
   *  déplacement coûte 2 JT (1 lieu) ou 5 JT (2 lieux). `maxSteps` borne la portée. */
  pendingTitanMove?: { playerIndex: number; titanCandidateIds: string[]; paid: boolean; maxSteps: number } | null
  /** Dr Facilier — Divination : `playerIndex` (Facilier) a révélé `cards` de sa
   *  Pile de l'Au-delà et doit en résoudre les effets Au-delà dans l'ordre de son
   *  choix (RESOLVE_DIVINATION, `topInstanceIds` = ordre de résolution). Absent /
   *  `null` hors d'une Divination. */
  pendingDivination?: { playerIndex: number; cards: CardInstance[] } | null
  /** Dr Facilier — Tour de passe-passe : `playerIndex` regarde les `cards`
   *  premières cartes de sa pioche et en choisit `take` à ajouter à sa main ; les
   *  autres sont défaussées (RESOLVE_LOOK_TOP). Absent / `null` sinon. */
  pendingLookTop?: {
    playerIndex: number
    cards: CardInstance[]
    take: number
    /** Titre affiché dans le modal de choix (défaut : « Tour de passe-passe »).
     *  Permet de réutiliser ce mécanisme pour d'autres cartes (ex. Tombée de la
     *  nuit, quand plusieurs cartes du type choisi sont révélées). */
    title?: string
    /** Tour de passe-passe révélé pendant une Divination : une fois ce choix résolu,
     *  reprendre la Divination avec ces cartes restantes (à résoudre dans l'ordre). */
    resumeDivination?: { playerIndex: number; cards: CardInstance[] }
  } | null
  /** Ratigan — Liste de Fidget : cartes dévoilées de la pioche montrées au joueur
   *  (purement informatif). La carte gardée (`keptInstanceId`) est DÉJÀ dans la main
   *  et les autres DÉJÀ en défausse ; ce pending ne sert qu'à afficher le résultat
   *  jusqu'à acquittement (ACKNOWLEDGE_REVEAL). Absent / `null` sinon. */
  pendingReveal?: {
    playerIndex: number
    cards: CardInstance[]
    keptInstanceId?: string
    title?: string
  } | null
  /** Sombra — Piratage : `playerIndex` vient de poser le Piratage `instanceId` sur
   *  `locationId` et doit CHOISIR l'action de ce lieu à désactiver (recouverte par un
   *  Hack tant que le Piratage y reste). `actionIds` = actions désactivables (non
   *  déjà piratées). RESOLVE_HACK. */
  pendingHack?: {
    playerIndex: number
    locationId: LocationId
    instanceId: string
    actionIds: string[]
  } | null
  /** La Méchante Reine — « Croque ! » : `playerIndex` choisit lequel des Héros
   *  `candidateIds` (présents sur son lieu et payables avec son Poison) éliminer
   *  en défaussant autant de Poison que sa force (RESOLVE_TAKE_A_BITE). */
  pendingTakeABite?: { playerIndex: number; candidateIds: string[] } | null
  /** La Méchante Reine — Hurlement d'effroi : `playerIndex` choisit un déplacement
   *  parmi `options` (déplacer les Héros de force ≤ 3 d'un lieu `from` vers un lieu
   *  voisin non bloqué `to`), ou décline (RESOLVE_SCREAM sans option). */
  pendingScream?: { playerIndex: number; options: { from: LocationId; to: LocationId }[] } | null
  /** La Méchante Reine — Foudre : `playerIndex` choisit lequel des Ingrédients de
   *  sa zone (`candidateIds`) reproduire (RESOLVE_DUPLICATE_INGREDIENT). On retient
   *  `foudreInstanceId` et `actionId` pour pouvoir ANNULER (remettre Foudre en main
   *  et libérer l'action) — CANCEL_DUPLICATE_INGREDIENT. */
  pendingDuplicateIngredient?: {
    playerIndex: number
    candidateIds: string[]
    foudreInstanceId?: string
    actionId?: string
  } | null
  /** Dr Facilier — Si près du but / Charlotte (Fatalité) : `chooserIndex` (qui a
   *  joué la Fatalité) regarde les `cards` premières cartes de la pioche Vilain de
   *  `targetIndex` (Facilier). Il en place autant qu'il veut (parmi celles qui le
   *  PEUVENT) dans la Pile de l'Au-delà et remet les autres sur le dessus de la
   *  pioche dans l'ordre choisi (RESOLVE_FATE_SCRY). Absent / `null` sinon. */
  pendingFateScry?: { chooserIndex: number; targetIndex: number; cards: CardInstance[] } | null
  /** Yzma (Fatalité) — `chooserIndex` (qui a joué la Fatalité) cible `targetIndex`
   *  (Yzma, aux 4 pioches). Deux phases :
   *   - `phase: 'deck'` : il choisit l'une des pioches NON VIDES (par `locationId`) —
   *     RESOLVE_YZMA_FATE_DECK ;
   *   - `phase: 'card'` : il voit toutes les `cards` de la pioche choisie (`locationId`)
   *     et en joue UNE sur ce lieu (ou aucune si rien de jouable), le reste est
   *     remélangé et replacé — RESOLVE_YZMA_FATE_CARD. */
  pendingYzmaFate?: {
    chooserIndex: number
    targetIndex: number
    phase: 'deck' | 'card'
    locationId?: LocationId
    cards?: CardInstance[]
    /** Yzma — Supériorité : c'est YZMA (et non l'adversaire) qui choisit la pioche
     *  (phase `deck`). Le choix de la CARTE reste à l'adversaire (`chooserIndex`). */
    deckChooserIndex?: number
  } | null
  /** Yzma — agir sur l'une de SES pioches Fatalité (À l'attaque ! / Marteau) :
   *  `playerIndex` (Yzma) choisit le lieu de la pioche, puis l'effet `mode` s'applique
   *  (RESOLVE_YZMA_OWN_DECK). */
  pendingYzmaOwnDeck?: {
    playerIndex: number
    mode: 'attack' | 'hammer' | 'snoop'
    /** Snoop (Indiscrétion) / À l'attaque ! : cartes dévoilées à MONTRER au joueur
     *  avant de continuer (snoop : replacer ; attack : jouer Héros + résoudre). */
    revealCards?: CardInstance[]
    /** À l'attaque ! : lieu de la pioche dévoilée, mémorisé pour l'exécution au 2ᵉ
     *  temps (à la fermeture du modal de révélation). */
    revealLocationId?: LocationId
    /** Marteau : après le choix de la pioche, le joueur choisit lui-même les cartes à
     *  défausser, mais FACE CACHÉE (« au hasard ») — il voit les dos. `cards` = pioche
     *  (remélangée) où piocher ; `count` = nombre à défausser (RESOLVE_YZMA_HAMMER). */
    hammerPick?: { locationId: LocationId; cards: CardInstance[]; count: number }
  } | null
  /** Yzma — manipulation interactive des pioches Fatalité (Paysan / Attention au groove !
   *  / Pacha) : le contrôleur (`playerIndex`) choisit éventuellement un Héros de la
   *  défausse (`heroIds`, mode `hero-to-decks`) et jusqu'à `count` pioche(s) à mélanger,
   *  puis reformées également. `optional` = il peut refuser (RESOLVE_YZMA_MANIPULATE). */
  pendingYzmaManipulate?: {
    playerIndex: number
    mode: 'hero-to-decks' | 'reshuffle'
    count: number
    optional: boolean
    /** Héros candidats (instanceId) de la défausse Fatalité (mode `hero-to-decks`). */
    heroIds: string[]
  } | null
  /** Yzma — Finis le travail : `playerIndex` choisit un Allié (`allyInstanceId`) puis
   *  un lieu portant un Héros (RESOLVE_FINISH_JOB). */
  pendingFinishJob?: { playerIndex: number; allyInstanceId?: string } | null
  /** Yzma — Beauté endormie (effet différé) : au début de son tour, AVANT de se
   *  déplacer, `playerIndex` peut (chaque choix indépendant) gagner 2 JT, piocher
   *  2 cartes et déplacer un Héros de son royaume vers un lieu voisin
   *  (RESOLVE_BEAUTY_SLEEP). Le déplacement reste bloqué tant qu'il n'est pas résolu. */
  pendingBeautySleep?: { playerIndex: number } | null
  /** Yzma — Ironie du sort : `playerIndex` choisit un Événement de sa défausse
   *  (`candidateIds`, abordables), en paie le coût et le rejoue (RESOLVE_REPLAY_EVENT). */
  pendingReplayEvent?: { playerIndex: number; candidateIds: string[] } | null
  /** Hadès (Fatalité) — Héra / Pégase : `chooserIndex` (le joueur qui a joué la
   *  Fatalité) choisit un Titan parmi `titanCandidateIds` (du royaume de Hadès =
   *  `playerIndex`) à entraver (`kind: 'trap'`) ou à repousser de `pushSteps` lieux
   *  vers Les Enfers (`kind: 'push'`) — RESOLVE_TITAN_SELECT. */
  pendingTitanSelect?: {
    playerIndex: number
    chooserIndex: number
    titanCandidateIds: string[]
    kind: 'trap' | 'push'
    pushSteps?: number
  } | null
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
  /** Déplacement d'une carte (Allié/Objet/Malédiction) d'un lieu à un autre :
   *  la carte « vole » du lieu de départ vers le lieu d'arrivée (émis pour les
   *  deux joueurs ; l'UI anime l'image réelle de la carte). */
  | { kind: 'move-card'; playerIndex: number; cardId: string; from: LocationId; to: LocationId }
  /** L'Imposteur — une Tâche est neutralisée (défaussée) car assez de Coéquipiers
   *  ont atteint son lieu. L'UI joue le son « Task complete ». */
  | { kind: 'task-completed'; playerIndex: number; cardId: string }
  /** L'Imposteur — la Fatalité « Corps découvert » est jouée : l'UI affiche le
   *  bandeau « DEAD BODY REPORTED » et joue le son associé. */
  | { kind: 'dead-body'; playerIndex: number }
  /** L'Imposteur — la Fatalité « Réunion d'urgence » est jouée : l'UI affiche le
   *  bandeau « EMERGENCY MEETING » (pleine largeur) et joue le son associé. */
  | { kind: 'emergency-meeting'; playerIndex: number }

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
  /** Combo « jouer les deux » (Ray/Dormeur) : 2ᵉ carte FACULTATIVE → le joueur
   *  peut la jouer (RESOLVE_FATE) ou passer (PASS_FATE). Absent = obligatoire. */
  optional?: boolean
}

/**
 * Les actions de jeu que le moteur sait appliquer. C'est l'unique surface
 * d'entrée du moteur : applyAction(state, action) → nouveau state.
 */
export type GameAction =
  | { type: 'MOVE'; to: LocationId }
  /** Exécute une action instantanée du lieu (Gagner Pouvoir, Préparer du Poison).
   *  `count` : nb de jetons convertis pour « Préparer du Poison » (N Pouvoir →
   *  N Poison). Ignoré pour les autres actions ; défaut 1. */
  | { type: 'EXECUTE_ACTION'; actionId: string; count?: number }
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
      /** Reine de Cœur — Rapetisser : action du haut que le Héros rapetissé laisse
       *  LIBRE (le joueur choisit ; l'autre est recouverte). */
      shrinkFreeActionId?: string
      /** Ratigan — Engrenages EN JEU à défausser pour réduire le coût de l'Objet
       *  joué (−3 par Engrenage). instanceIds d'Engrenages non associés du royaume. */
      engrenagesIds?: string[]
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
  /** Hadès — Char : déplace la figurine + le Char vers `to` (n'importe quel lieu),
   *  1×/tour, et donne accès aux actions de ce lieu (hors Fatalité). */
  | { type: 'CHARIOT_MOVE'; instanceId: string; to: LocationId }
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
  /** Ratigan — Brutes : renonce à l'action distante facultative (ferme la fenêtre
   *  `actAtLocation` sans agir). */
  | { type: 'SKIP_REMOTE_ACTION' }
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
  | {
      type: 'RESOLVE_FATE'
      instanceId: string
      to?: LocationId
      targetHeroId?: string
      /** Reine de Cœur — Agrandir : lieu voisin vers lequel le Héros agrandi
       *  « pivote » (le joueur qui pose la Fatalité choisit le sens). Absent =
       *  choix automatique par le moteur (bot). */
      enlargeToward?: LocationId
    }
  /** Passer la 2ᵉ carte FACULTATIVE d'un combo « jouer les deux » (Ray/Dormeur) :
   *  on défausse la carte révélée restante sans la jouer. */
  | { type: 'PASS_FATE' }
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
  /** Ratigan — Le Grand Génie du Mal : `choice` = piocher (`'draw'`) OU gagner du
   *  Pouvoir (`'power'`). */
  | { type: 'RESOLVE_DRAW_OR_GAIN_POWER'; choice: 'draw' | 'power' }
  /** Apparition / Vent de panique : déplace le Héros choisi vers le lieu voisin. */
  | { type: 'RESOLVE_HERO_RELOCATE'; heroInstanceId: string; to: LocationId }
  /** Décline un déplacement de Héros FACULTATIF (Poupées vaudou). */
  | { type: 'SKIP_HERO_RELOCATE' }
  /** Flèche de Mome Raths : déplace l'Allié choisi vers le lieu (non bloqué) choisi. */
  | { type: 'RESOLVE_ALLY_RELOCATE'; allyInstanceId: string; to: LocationId }
  /** Dr Facilier — Canne : ouvre le choix d'un lieu voisin où effectuer UNE action
   *  disponible (hors Fatalité), tant que le pion est sur le lieu de la Canne. */
  | { type: 'USE_CANNE' }
  /** Téléportation : déplace le pion vers le lieu (portant un Héros) choisi. */
  | { type: 'RESOLVE_TELEPORT'; to: LocationId }
  /** Manipulation : reprend en main la carte `instanceId` de la défausse du joueur. */
  | { type: 'RESOLVE_MANIPULATION'; instanceId: string }
  /** Coup Royal : ferme la fenêtre de révélation (informatif). */
  | { type: 'DISMISS_ROYAL_CROQUET' }
  /** Par ordre de la Reine ! : transforme en arceaux les Cartes Gardes choisies
   *  (1 ou 2 instanceIds). */
  | { type: 'RESOLVE_TRANSFORM_WICKETS'; instanceIds: string[] }
  /** Faites-leur peur ! : `topInstanceIds` = cartes à remettre sur le dessus de la
   *  pioche Fatalité, dans l'ordre (1ʳᵉ = tout en haut) ; les autres sont
   *  défaussées. Liste vide = tout défausser. */
  | { type: 'RESOLVE_SCRY'; topInstanceIds: string[] }
  /** Pas de Quartier ! : déplace l'Allié `instanceId` vers le lieu voisin `to`
   *  (non bloqué) et lui donne +force jusqu'à la fin du tour. */
  | { type: 'RESOLVE_ALLY_MOVE_BUFF'; instanceId: string; to: LocationId }
  /** Décline un déplacement d'Allié FACULTATIF (Grand Terrier). */
  | { type: 'SKIP_ALLY_MOVE_BUFF' }
  /** Abu/Aladdin/K.O. : applique le choix sur la carte `instanceId` (Objet à voler
   *  ou Allié à retirer) — cf. pendingFateChoice. */
  | { type: 'RESOLVE_FATE_CHOICE'; instanceId: string }
  /** Digne Adversaire / Obsession : joue le Héros dévoilé sur le lieu `to` (`play:
   *  true`) ou le défausse (`play: false`). */
  | { type: 'RESOLVE_FETCHED_HERO'; play: boolean; to?: LocationId }
  /** Vol du château : pose l'Allié/Objet dévoilé (`found`) sur le lieu `to` (ou en
   *  main si associable). */
  | { type: 'RESOLVE_CASTLE_THEFT'; to?: LocationId }
  /** L'Imposteur — Tuer : défausse le Coéquipier `color` choisi (pendingCrewmateKill). */
  | { type: 'RESOLVE_CREWMATE_KILL'; color: string }
  /** L'Imposteur — Tâche visuelle : rend suspect le Coéquipier `color` choisi. */
  | { type: 'RESOLVE_CREWMATE_SUSPECT'; color: string }
  /** L'Imposteur — Tâche visuelle : termine la sélection (moins de 3 choisis). */
  | { type: 'DONE_CREWMATE_SUSPECT' }
  /** L'Imposteur — Assurance : déplace le Coéquipier rassuré vers le lieu `to`. */
  | { type: 'RESOLVE_CREWMATE_MOVE'; to: LocationId }
  /** L'Imposteur — Assurance : ne pas déplacer (termine). */
  | { type: 'DONE_CREWMATE_MOVE' }
  /** L'Imposteur — Vidéo de surveillance / Carte : associe l'Objet au lieu choisi. */
  | { type: 'RESOLVE_FATE_OBJECT_PLACE'; locationId: LocationId }
  /** Ratigan — Appel à l'aide : pose/déplace le Héros cherché sur le lieu choisi. */
  | { type: 'RESOLVE_FATE_HERO_PLACE'; locationId: LocationId }
  /** Carte du Pays Imaginaire : défausse la Carte (du royaume) et joue
   *  gratuitement l'Objet `itemInstanceId` de la main sur le lieu `to`
   *  (associé à `attachTo` si l'Objet s'associe). */
  | { type: 'USE_NEVERLAND_MAP'; itemInstanceId: string; to: LocationId; attachTo?: string }
  /** Opportunisme : reprend en main la carte `instanceId` de la défausse Vilain. */
  | { type: 'RESOLVE_RECOVER'; instanceId: string }
  | { type: 'RESOLVE_BE_PREPARED'; instanceId: string | null }
  | { type: 'RESOLVE_FREE_HYENA'; instanceId: string | null }
  | { type: 'RESOLVE_HAKUNA_MATATA'; mode: 'play' | 'move'; instanceId: string }
  /** Colère Titanesque : choisit le lieu voisin `locationId` où agir (le joueur y
   *  effectue ensuite UNE action normale). */
  | { type: 'RESOLVE_GIANT_LOCATION'; locationId: LocationId }
  /** Hadès — Préparez-vous au combat ! : déplace le Titan `titanInstanceId` vers
   *  le lieu `to` (1 ou 2 lieux). Le coût (2 ou 5 JT) est prélevé si `pendingTitanMove.paid`. */
  | { type: 'RESOLVE_TITAN_MOVE'; titanInstanceId: string; to: LocationId }
  /** Hadès (Fatalité) — Héra / Pégase : entrave ou repousse le Titan `titanInstanceId`. */
  | { type: 'RESOLVE_TITAN_SELECT'; titanInstanceId: string }
  /** Dr Facilier — Divination : résout les cartes révélées (pendingDivination)
   *  dans l'ordre `topInstanceIds` (1ʳᵉ résolue en premier). */
  | { type: 'RESOLVE_DIVINATION'; topInstanceIds: string[] }
  /** Dr Facilier — Tour de passe-passe : garde `keepInstanceIds` (parmi les cartes
   *  révélées de pendingLookTop) en main ; les autres sont défaussées. */
  | { type: 'RESOLVE_LOOK_TOP'; keepInstanceIds: string[] }
  /** Ratigan — Liste de Fidget : acquitte l'affichage des cartes dévoilées
   *  (pendingReveal) ; aucune décision, ferme simplement le modal d'info. */
  | { type: 'ACKNOWLEDGE_REVEAL' }
  /** Sombra — Piratage : désactive l'action `actionId` du lieu piraté. */
  | { type: 'RESOLVE_HACK'; actionId: string }
  /** Sombra — Information : `discardDrawn` = true → défausse les cartes piochées ;
   *  false → ouvre la sélection pour défausser `discardCount` cartes de la main. */
  | { type: 'RESOLVE_INFORMATION'; discardDrawn: boolean }
  /** La Méchante Reine — « Croque ! » : élimine le Héros choisi (`heroInstanceId`)
   *  en défaussant autant de Poison que sa force. */
  | { type: 'RESOLVE_TAKE_A_BITE'; heroInstanceId: string }
  /** La Méchante Reine — Foudre : reproduit l'Ingrédient choisi (`ingredientInstanceId`). */
  | { type: 'RESOLVE_DUPLICATE_INGREDIENT'; ingredientInstanceId: string }
  /** La Méchante Reine — Foudre : ANNULE le choix (Foudre revient en main, l'action
   *  « Jouer une carte » est de nouveau disponible). */
  | { type: 'CANCEL_DUPLICATE_INGREDIENT' }
  /** La Méchante Reine — Hurlement d'effroi : déplace les Héros (force ≤ 3) du lieu
   *  `from` vers `to`. Les deux absents = décliner (ne rien déplacer). */
  | { type: 'RESOLVE_SCREAM'; from?: LocationId; to?: LocationId }
  /** Dr Facilier — Si près du but / Charlotte : `toAudelaIds` rejoignent la Pile de
   *  l'Au-delà ; `deckTopOrder` (les autres cartes révélées) reviennent sur le
   *  dessus de la pioche Vilain de Facilier, 1ʳᵉ = tout en haut. */
  | { type: 'RESOLVE_FATE_SCRY'; toAudelaIds: string[]; deckTopOrder: string[] }
  /** Yzma (Fatalité) : choisir l'une des 4 pioches (par lieu), puis la carte à jouer. */
  | { type: 'RESOLVE_YZMA_FATE_DECK'; locationId: LocationId }
  | { type: 'RESOLVE_YZMA_FATE_CARD'; instanceId: string | null }
  /** Yzma : choisir la pioche (lieu) sur laquelle agir (À l'attaque ! / Marteau). */
  | { type: 'RESOLVE_YZMA_OWN_DECK'; locationId: LocationId }
  /** Yzma — Marteau : choisir (face cachée) les cartes à défausser de la pioche. */
  | { type: 'RESOLVE_YZMA_HAMMER'; instanceIds: string[] }
  /** Yzma — Paysan / Attention au groove ! / Pacha : choisir un Héros (ou aucun) et
   *  les pioches à mélanger (`locationIds` vide + `heroInstanceId` null = refuser). */
  | { type: 'RESOLVE_YZMA_MANIPULATE'; heroInstanceId: string | null; locationIds: LocationId[] }
  /** Yzma — Finis le travail : choisir l'Allié puis le lieu (à Héros) de destination. */
  | { type: 'RESOLVE_FINISH_JOB'; allyInstanceId?: string; to?: LocationId }
  /** Yzma — Beauté endormie (effet différé) : choix indépendants à appliquer avant
   *  le déplacement. `heroMove` (optionnel) déplace un Héros du royaume vers un lieu
   *  voisin. Tout omettre / `false` / `null` = ne rien faire de ce choix. */
  | {
      type: 'RESOLVE_BEAUTY_SLEEP'
      gainPower: boolean
      draw: boolean
      heroMove: { heroInstanceId: string; to: LocationId } | null
    }
  /** Yzma — Ironie du sort : Événement de la défausse à rejouer (null = aucun). */
  | { type: 'RESOLVE_REPLAY_EVENT'; instanceId: string | null }
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
  | { type: 'TEST_PLAY_FATE_CARD'; card: CardInstance; targetHeroId?: string; enlargeToward?: LocationId }
  | { type: 'END_TURN' }

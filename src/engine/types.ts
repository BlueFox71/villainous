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
  /** Le Seigneur des clés : « Obtenir une clé » — ramasse une clé présente sur le
   *  lieu courant (choix interactif). */
  | 'OBTAIN_KEY'
  /** Team Rocket : « Attraper un Pokémon » — comme un Vanquish, mais cible un
   *  Pokémon (Héros `isPokemon`) présent : il part dans la pile de Captures au lieu
   *  de la défausse Fatalité. Compte pour l'objectif CAPTURE_POKEMON. */
  | 'CATCH_POKEMON'
  /** Tabbou : « Dévoiler une tuile Combattant » — révèle 1 tuile Combattant depuis
   *  la pioche (face cachée) vers la réserve commune (face visible). Action custom
   *  imprimée sur l'Émissaire Subspatial ; aussi accordée par des cartes. */
  | 'REVEAL_FIGHTER'

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
  /** Face ALTERNATIVE (« B ») d'un lieu TRANSFORMABLE (Atelier — vilains à lieux
   *  mutables). `name`/`actions` portent toujours la face ACTIVE (lue partout dans le
   *  moteur/l'UI) ; `altName`/`altActions` gardent la face INACTIVE pour pouvoir
   *  (re)basculer via l'effet `SWITCH_LOCATION_VERSION`. `version` = face active
   *  ('a' par défaut). `bColumnImage` = image de colonne bakée de la face B,
   *  superposée en jeu quand le lieu est en B. Absent = lieu non transformable. */
  altName?: string
  altActions?: LocationAction[]
  version?: 'a' | 'b'
  bColumnImage?: string
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
  /** Description lisible de la condition de victoire (texte stratégique enrichi). */
  objectiveDescription: string
  /** Objectif EXACT tel qu'imprimé sur le plateau (texte court). Affiché en priorité
   *  dans la fiche du vilain ; repli sur `objectiveDescription` si absent. */
  boardObjective?: string
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
  /** Dos de carte des paquets PERSONNALISÉS (3e dos, vilains persos). Absent = les
   *  cartes de paquet perso reprennent le dos Vilain. */
  backExtraImage?: string
  /** Lieux VERROUILLÉS à la mise en place (Jafar : la Caverne aux Merveilles).
   *  Recopié dans PlayerState.lockedLocations. Absent = aucun verrou. */
  lockedLocationsAtStart?: LocationId[]
  /** Atelier — objectif ALTERNATIF activable par l'effet `SWITCH_OBJECTIVE` (vilains à
   *  objectif transformable). `boardImage` = plateau alternatif optionnel (image du
   *  vilain + panneau objectif de la face B). Recopié dans PlayerState (alt*). Absent =
   *  objectif non transformable. */
  altObjective?: { objective: ObjectiveDef; objectiveDescription: string; boardImage?: string }
  /** Bowser : mise en place des Étoiles. `locationId` = l'Observatoire de la
   *  Comète ; `count` = Étoiles posées au départ. Ce lieu est VERROUILLÉ
   *  dynamiquement dès qu'il tombe à 0 Étoile. Absent = vilain sans Étoiles. */
  starSetup?: { locationId: LocationId; count: number }
  /** Tabbou : mise en place des tuiles Combattants. `tiles` = la pioche (couleur +
   *  illustration de chaque tuile), mélangée au départ ; `emissaireLocationId` = le
   *  4ᵉ lieu (Émissaire Subspatial), VERROUILLÉ au départ et débloqué en posant 3 Orbes
   *  subspatiaux sur les 3 autres lieux (`orbLocationIds`). Absent = vilain sans Combattants. */
  fighterSetup?: {
    tiles: { color: FighterColor; art: string; name?: string }[]
    emissaireLocationId: LocationId
    orbLocationIds: LocationId[]
  }
  /** Pat Hibulaire : les 5 « tuiles Objectif » candidates (objectif
   *  COMPLETE_GOAL_TOKENS). À la mise en place, on en tire 4 au hasard, une par
   *  lieu (la 5ᵉ reste hors-jeu). Recopié vers PlayerState.goals. Absent = vilain
   *  sans tuiles Objectif. */
  goalKinds?: PeteGoalKind[]
  /** Mère Gothel — Héros « tuile » posé dans le royaume à la mise en place (Raiponce
   *  sur la Tour). Il n'est PAS dans le deck Fatalité ; il est toujours présent et
   *  revient sur `locationId` s'il est éliminé (cf. performVanquish). */
  startingHeroTile?: { cardId: string; name: string; strength: number; locationId: LocationId }
  /** Cruella d'Enfer — les 12 Tuiles Chiots placées en réserve (face cachée) à la
   *  mise en place. Chaque tuile vaut `value` Chiots et appartient au lieu `homeLocation`
   *  (« le lieu indiqué »). Recopié vers PlayerState.puppyTiles. Absent ailleurs. */
  startingPuppyTiles?: { value: number; homeLocation: LocationId }[]
  /** Gaston — nombre de jetons Obstacle posés sur CHAQUE lieu à la mise en place
   *  (2 → 8 au total). Recopié vers PlayerState.obstacles. Absent ailleurs. */
  startingObstacles?: number
  /** Le Seigneur des clés — nombre de clés posées par lieu à la mise en place
   *  (3 → 12 au total ; ≥1 de chaque couleur garanti). Déclenche la génération des
   *  clés dans createInitialGame. Absent ailleurs. */
  startingKeysPerLocation?: number
  /** Oogie Boogie — Prisonnier posé sur un lieu à la mise en place (Perce-Oreilles /
   *  Sandy Claws sur l'Antre). La carte est sortie du deck Fatalité. Elle ancre la
   *  pile d'Imposteurs et déclenche le retour de Jack à 4 imposteurs. Absent ailleurs. */
  prisonerSetup?: { cardId: string; locationId: LocationId }
  /** Syndrome — mise en place de l'Omnidroïde (tuiles HORS deck). `startLocation` :
   *  lieu où l'Omnidroïde v.X8 débute. `stages` : la séquence v.X8 → v.X9 → v.10
   *  (le 1er est posé sur le plateau, les suivants forment `omnidroidPile`). Absent
   *  ailleurs. */
  /** Lotso — la tuile GARDIEN « Buzz l'Éclair » (deux faces, hors deck), posée sur
   *  `locationId` (Salle des Chenilles) au départ, face Gardien. */
  guardianSetup?: { cardId: string; name: string; locationId: LocationId; strength: number }
  /** Tamatoa — dos de la 3ᵉ pioche (Maui), affichée à part. */
  mauiDeckBackImage?: string
  omnidroidSetup?: {
    startLocation: LocationId
    stages: {
      cardId: string
      name: string
      strength: number
      stage: 'x8' | 'x9' | 'x10'
      /** Modifications Majeures à défausser du royaume pour jouer cette tuile (x9 : 1, v.10 : 3). */
      upgradeCost?: number
      /** Lieu imposé pour jouer cette tuile (v.10 → Métroville). */
      forceLocation?: LocationId
    }[]
  }
}

/** Le Seigneur des clés — couleurs de clé (le dé a une face par couleur). */
export type KeyColor = 'bleu' | 'rouge' | 'vert' | 'jaune' | 'violet' | 'orange'

/** Le Seigneur des clés — l'ordre canonique des 6 couleurs (faces du dé, affichage). */
export const KEY_COLORS: KeyColor[] = ['bleu', 'rouge', 'vert', 'jaune', 'violet', 'orange']

/** Le Seigneur des clés — une clé. `location` = lieu où elle est posée, ou `null`
 *  si le Seigneur la POSSÈDE. */
export interface KeyToken {
  id: string
  color: KeyColor
  location: LocationId | null
  /** Gévaudan — clé VOLÉE : retirée du Seigneur, rattachée à ce Héros (instanceId).
   *  Une telle clé ne compte PAS comme possédée. Rendue à sa mort. */
  stolenBy?: string
}

/**
 * Descripteur d'objectif d'un vilain. Le moteur sait évaluer chaque variant ;
 * ajouter un nouvel objectif = un variant + un case dans hasReachedObjective.
 */
export type ObjectiveDef =
  /** Atteindre un seuil de pouvoir au début de son tour (Prince Jean = 20). */
  | { type: 'POWER_THRESHOLD'; threshold: number }
  /** Isabella — HORLOGE : valider les 6 heures (XII, II, IV, VI, VIII, X) en jouant au
   *  moins une Activité à chacune (cumulatif). Victoire au début de son tour quand
   *  `validatedHours` contient les 6 indices. */
  | { type: 'ISABELLA_CLOCK' }
  /** Avoir au moins une carte de type 'curse' (Malédiction Maléfique) sur
   *  chacun des 4 lieux du royaume. */
  | { type: 'CURSE_EACH_LOCATION' }
  /** Pyramid Head : avoir une TUILE DE JUGEMENT sur chacun des lieux du royaume au
   *  début de son tour (`judgmentTiles` = nombre de lieux tuilés, depuis Silent Hill
   *  à droite vers la gauche). */
  | { type: 'JUDGMENT_TILES_ALL' }
  /** Ultron (Marvel) : révéler ses 4 tuiles AMÉLIORATION dans l'ordre (Transformation,
   *  Optimisation, Forme finale, L'ère d'Ultron). Victoire IMMÉDIATE quand la 4ᵉ est
   *  révélée (`ultronUpgrades` atteint 4). Une seule Amélioration par tour. */
  | { type: 'ULTRON_AGE_REVEALED' }
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
  /** Mère Gothel : avoir au moins `threshold` jetons Confiance au début de son tour. */
  | { type: 'CONFIANCE_THRESHOLD'; threshold: number }
  /** Cruella d'Enfer : avoir CAPTURÉ au moins `threshold` Chiots (somme des valeurs
   *  des Tuiles Chiots capturées) au début de son tour. */
  | { type: 'PUPPY_THRESHOLD'; threshold: number }
  /** Gaston : avoir RETIRÉ ses 8 jetons Obstacle (aucun ne reste sur le plateau)
   *  au début de son tour. */
  | { type: 'REMOVE_ALL_OBSTACLES' }
  /** Le Seigneur des clés : posséder au moins 1 clé de CHAQUE couleur (6) au début
   *  de son tour. Bloqué tant qu'il détient la Clé Noire. */
  | { type: 'KEYS_ALL_COLORS' }
  /** Madame de Trémaine : MARIER une fille au Prince. Au début de son tour, victoire
   *  si une fille EN ROBE DE BAL (`ballGownCardIds`) ET le Prince (`princeCardId`)
   *  sont sur `ballroomId`, que les Cloches de Mariage (`bellsCardId`) sont en jeu,
   *  et qu'aucune Pantoufle de Verre (`slipperCardId`) n'est dans le royaume. */
  | {
      type: 'MARRY_PRINCE'
      ballroomId: LocationId
      ballGownCardIds: string[]
      princeCardId: string
      bellsCardId: string
      /** Les Pantoufles de Verre (2 cartes distinctes) : tant qu'UNE est dans le
       *  royaume, le mariage est impossible. */
      slipperCardIds: string[]
    }
  /** Pat Hibulaire : remplir ses 4 tuiles Objectif (tirées parmi 5 à la mise en
   *  place, une par lieu). Chaque tuile a sa propre condition (voir PeteGoalKind),
   *  vérifiée en début de tour (Round Up / Strike It Rich / Rule the Realm) ou à
   *  l'instant déclencheur (Win Big / Power Play). `blockerHeroCardId` (Mickey) :
   *  tant qu'un Héros de ce cardId est présent dans le royaume, aucune tuile ne
   *  peut être complétée (et donc la victoire est impossible). */
  | { type: 'COMPLETE_GOAL_TOKENS'; blockerHeroCardId?: string }
  /** Le Seigneur des Ténèbres : avoir un Allié « Mort-vivant du Chaudron »
   *  (cardId `cauldron-born`) sur CHACUN de ses lieux. */
  | { type: 'CAULDRON_BORN_EVERYWHERE' }
  /** Madame Mim : vaincre les 7 Métamorphoses de Merlin (la pioche Merlin est vide
   *  ET aucune Métamorphose de Merlin n'est en jeu — toutes en `merlinDiscard`). */
  | { type: 'DEFEAT_ALL_MERLIN' }
  /** Lotso : réunir les `heroCardIds` (4 Héros) sur `roomId` (Salle des Chenilles), tous
   *  à force EFFECTIVE 0, ET avoir la tuile Buzz (isBuzz, n'importe quelle face) sur ce lieu. */
  | { type: 'LOTSO_GATHER'; roomId: LocationId; heroCardIds: string[] }
  /** Syndrome : ÉLIMINER l'Omnidroïde v.10 (via la Télécommande activée à son lieu)
   *  ET n'avoir aucun Héros dans son royaume au début de son tour. La progression
   *  v.X8 → v.X9 → v.10 est portée par `omnidroidStage` (cf. omnidroidSetup). */
  | { type: 'DEFEAT_OMNIDROID_V10' }
  /** Sa Sucrerie (King Candy) : franchir la case Départ/Arrivée du circuit (`trackPos`
   *  boucle 0→17→0) alors qu'une course est active (`raceActive`) et qu'un BUG (Glitch)
   *  est associé à Vanellope von Schweetz. Victoire ÉVÉNEMENTIELLE — déclenchée à
   *  l'instant où le pion King Candy franchit l'index 0, AVANT le jeton Pilote. */
  | { type: 'KING_CANDY_RACE' }
  /** Shere Khan : VAINCRE `heroCardId` (Mowgli) alors qu'AUCUN jeton Feu n'est présent
   *  dans son royaume. Victoire ÉVÉNEMENTIELLE — déclenchée à l'instant du Vanquish de
   *  Mowgli (performVanquish), uniquement si `fireTokens` est vide. */
  | { type: 'DEFEAT_HERO_NO_FIRE'; heroCardId: string }
  /** Davy Jones : RÉCUPÉRER les `count` jetons Trésor (poser face cachée sur un Héros →
   *  révéler → vaincre ce Héros). Victoire ÉVÉNEMENTIELLE — déclenchée quand
   *  `claimedTreasures.length` atteint `count` (au Vanquish d'un Héros à trésor révélé). */
  | { type: 'CLAIM_ALL_TREASURES'; count: number }
  /** Team Rocket : au début de son tour, avoir au moins `count` Pokémon dans la pile
   *  de Captures (`capturedPokemon`), dont obligatoirement celui de cardId `requiredCardId`
   *  (Pikachu). Les Pokémon arrivent par la Fatalité et sont capturés via l'action
   *  CATCH_POKEMON (Attraper). */
  | { type: 'CAPTURE_POKEMON'; count: number; requiredCardId: string }
  /** La Bonne Fée (Marraine de Shrek) : MARIER Fiona au Prince Charmant. Victoire
   *  ÉVÉNEMENTIELLE — déclenchée en activant `winCardId` (« Embrasse-la tout de
   *  suite ! ») quand le Héros `heroCardId` (Fiona), portant ses deux potions
   *  `potionCardIds` (Filtre d'amour + Heureux pour toujours), ET l'Allié `allyCardId`
   *  (Prince Charmant) sont présents sur `ballroomId` (Salle de Bal). Tant qu'un Héros
   *  de `blockerHeroCardId` (Shrek) est dans le royaume, la victoire est impossible. */
  | {
      type: 'KISS_AT_BALL'
      ballroomId: LocationId
      heroCardId: string
      allyCardId: string
      potionCardIds: string[]
      blockerHeroCardId: string
      winCardId: string
    }
  /** Dio Brando : objectif DOUBLE et ÉVÉNEMENTIEL. (1) Avoir RETIRÉ DU JEU les Héros
   *  `joestarCardIds` (Jotaro + Joseph — ils quittent la partie, pas la défausse, quand
   *  vaincus : cf. `removedFromGame`) ET (2) avoir effectué, dans un MÊME tour, TOUTES
   *  les actions HORS-Fatalité de son royaume (les 14 cases non-Fatalité des 4 lieux),
   *  rendu possible par ZA WARUDO!. Victoire déclenchée à l'instant où la dernière action
   *  requise est effectuée (le drapeau `dioRealmSweepDone` est posé par la boucle d'action). */
  | { type: 'DIO_ALL_ACTIONS'; joestarCardIds: string[] }
  /** Le Piégeur (Dead by Daylight) : ÉLIMINER les 4 Survivants. Victoire ÉVÉNEMENTIELLE
   *  — déclenchée à l'instant où le dernier Survivant est éliminé (plus aucun Survivant
   *  ni sur le plateau, ni dans la pile). */
  | { type: 'PIEGEUR_ELIMINATE_ALL_SURVIVORS' }
  /** Tabbou : au début de son tour, avoir TUÉ au moins `threshold` Combattants (tuiles
   *  Combattants à l'état `killed`). Tant qu'un Héros de `raiseHeroCardId` (Samus) est
   *  présent dans le royaume, le seuil monte à `raiseTo` (30). Les Combattants sont
   *  dévoilés (pioche → réserve) puis tués par couleur via des cartes. */
  | { type: 'KILL_FIGHTERS'; threshold: number; raiseHeroCardId?: string; raiseTo?: number }
  /** Le Flagelleur Mental (Stranger Things) : ouvrir le Monde à l'Envers. Victoire
   *  ÉVÉNEMENTIELLE — déclenchée en ACTIVANT `gateCardId` (Entrée du Monde à l'Envers,
   *  présente n'importe où dans le royaume) quand : (a) le Héros `heroCardId` (Onze) est
   *  sur le MÊME lieu que l'Entrée ; (b) chacun des `tunnelLocationCount` premiers lieux
   *  porte au moins un `tunnelCardId` (Tunnel de Hawkins). L'unique action ACTIVER du
   *  plateau étant sur le dernier lieu, la figurine s'y trouve de fait au moment d'activer. */
  | {
      type: 'FLAYER_GATE'
      gateCardId: string
      heroCardId: string
      tunnelCardId: string
      tunnelLocationCount: number
    }
  /** Thanos (Marvel) : CAPTURER les 6 PIERRES D'INFINITÉ dans sa zone Compétences
   *  (`stoneSkills`). Les Pierres (hors deck) sont d'abord jouées comme Objets dans le
   *  domaine d'un adversaire (qui peut les activer) ; Thanos les capture en transférant
   *  un Allié porteur dans son domaine — la Pierre devient alors une Compétence. Victoire
   *  vérifiée au début de son tour quand `stoneSkills.length === 6`. Tant qu'un Héros de
   *  `blockerHeroCardId` (Adam Warlock) est présent dans le royaume, la victoire est
   *  impossible. */
  | { type: 'THANOS_STONES'; blockerHeroCardId?: string }
  /** Grand Councilwoman : au début de son tour, le Héros `heroCardId` (STITCH) est
   *  ENFERMÉ — associé (attachedTo) à l'Objet `itemCardId` (la CAGE) — ET la CAGE se
   *  trouve sur `locationId` (le Vaisseau de Gantu). STITCH est immobile en tant que
   *  Héros ; une fois enfermé, il est transporté par la CAGE (on déplace la CAGE, avec
   *  STITCH dedans, jusqu'au Vaisseau de Gantu). */
  | { type: 'HERO_CAGED'; heroCardId: string; itemCardId: string; locationId: LocationId }
  /** Michael Myers : ÉLIMINER le Héros `heroCardId` (LAURIE STRODE), où qu'il soit dans le
   *  royaume. Victoire ÉVÉNEMENTIELLE — déclenchée à l'instant du Vanquish (performVanquish). */
  | { type: 'DEFEAT_NAMED_HERO'; heroCardId: string }

/** Pat Hibulaire — les 5 types de tuile Objectif (4 tirés par partie) :
 *  - `win-big`        : gagner ≥4 Pouvoir via UNE SEULE Petite Partie ? sur le lieu ;
 *  - `power-play`     : dépenser ≥6 Pouvoir en un tour avec le pion sur le lieu ;
 *  - `strike-it-rich` : ≥3 Objets sur le lieu au début du tour ;
 *  - `round-up`       : Alliés de force totale ≥10 sur le lieu au début du tour ;
 *  - `rule-the-realm` : plus d'Alliés que de Héros sur CHAQUE lieu au début du tour. */
export type PeteGoalKind =
  | 'win-big'
  | 'power-play'
  | 'strike-it-rich'
  | 'round-up'
  | 'rule-the-realm'

/** Pat Hibulaire — une tuile Objectif posée sur un lieu. Retirée du plateau (mais
 *  conservée ici `completed: true`) une fois remplie ; les 4 tuiles complétées = victoire. */
export interface GoalToken {
  kind: PeteGoalKind
  /** Lieu sur lequel la tuile est posée (toutes les conditions « sur ce lieu »). */
  locationId: LocationId
  /** Remplie (retirée du plateau). */
  completed: boolean
  /** Révélée à l'adversaire (Clarabelle, Hors-la-loi, Dingo…). Affichage seulement. */
  revealed: boolean
}

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

/** Cruella d'Enfer — une Tuile Chiots (suivi de la progression vers 99 Chiots). */
export interface PuppyTile {
  /** Identifiant stable et unique (ex. 'maison-11-a'). */
  id: string
  /** Nombre de Chiots (11 ou 22). */
  value: number
  /** Lieu indiqué sur la tuile (« le lieu indiqué » des cartes d'ajout). */
  homeLocation: LocationId
  /** Lieu courant : `homeLocation` à l'ajout, peut changer (Roadster, Sergent Tibs). */
  location: LocationId
  /** Réserve / posée sur un lieu / capturée. */
  state: 'reserve' | 'board' | 'captured'
  /** Révélée une fois pour toutes (face visible). Une tuile posée/capturée l'est toujours. */
  revealed: boolean
}

/** Tabbou — couleur d'une tuile Combattant (groupe pour « tuer d'une même couleur »). */
export type FighterColor =
  | 'magenta'
  | 'orange'
  | 'rouge'
  | 'marron'
  | 'bleu'
  | 'violet'
  | 'vert'
  | 'jaune'
  | 'gris'

/** Tabbou — une tuile Combattant. Flux : `pile` (pioche face cachée) → `reserve`
 *  (dévoilée, face visible, en attente) → `killed` (tuée, compte vers l'objectif).
 *  Quand la pioche se vide, les tuiles `killed` sont remélangées en `pile`. */
export interface FighterTile {
  /** Identifiant stable et unique (ex. 'fighter-12'). */
  id: string
  color: FighterColor
  /** URL de l'illustration du combattant (public/cards/tabbou/tuiles/…). */
  art: string
  /** Nom du combattant (Meta Knight, Kirby…), affiché en infobulle. Optionnel. */
  name?: string
  state: 'pile' | 'reserve' | 'killed'
}

/**
 * Effet composable d'une carte, exécuté par le dispatcher (engine/effects.ts).
 * Union volontairement minimale pour l'instant — on l'étend au fur et à mesure
 * sans toucher au reste du moteur.
 */
export type Effect =
  // ── Tamatoa (pioche Maui + mécanique des Objets-objectif) ─────────────────
  /** Dévoile et joue la 1ʳᵉ carte de la pioche MAUI (forcé : auto en début de tour tant
   *  que Maui est en jeu, et chaîne Heihei Maui). */
  | { type: 'PLAY_TOP_MAUI' }
  /** « Pas exactement l'heure de Maui » : dévoile la 1ʳᵉ carte Maui, puis le joueur CHOISIT
   *  de la jouer ou de la défausser (pendingMauiChoice). */
  | { type: 'REVEAL_TOP_MAUI_CHOICE' }
  /** Crustacé doté du pouvoir de création : (option) remélange la défausse Fatalité,
   *  dévoile `reveal` cartes Fatalité, joue les Objets dévoilés (dont le Cœur), défausse le reste. */
  | { type: 'CRUSTACEAN_REVEAL'; reveal: number }
  /** Appât : pioche 1 carte par Héros dans le royaume. */
  | { type: 'DRAW_PER_HERO_IN_REALM' }
  /** Beau et brillant : remélange la défausse Maui dans la pioche Maui. */
  | { type: 'RESHUFFLE_MAUI_DISCARD' }
  /** Tu ressembles à des fruits de mer : paie Pouvoir = force d'un Héros choisi, l'élimine. */
  | { type: 'DEFEAT_HERO_PAY_STRENGTH' }
  /** Sans pouvoir / Pas si difficile : ajoute jusqu'à `max` jetons Force −1 à un Héros. */
  | { type: 'ADD_MINUS_FORCE_TOKENS'; max: number }
  /** L'heure de Maui : cherche Maui, le joue, associe l'Hameçon ; si déjà en jeu, le déplace + retire ses jetons. */
  | { type: 'FETCH_MAUI_ATTACH_HOOK' }
  /** Fuite (Fatalité) : déplace un Héros ou un Objet non associé vers un lieu voisin. */
  | { type: 'MOVE_HERO_OR_ITEM_ADJACENT' }
  /** Mini Maui (Fatalité) : regarde et réordonne les `count` premières cartes de la pioche Maui. */
  | { type: 'REORDER_MAUI_TOP'; count: number }
  /** Cœur de Te Fiti (onPlace) : cherche Moana, la pose sur le lieu du Cœur et lui associe le Cœur. */
  | { type: 'HEART_FETCH_MOANA' }
  /** Moana (onPlace) : si le Cœur de Te Fiti est dans le royaume, le lui associe. */
  | { type: 'MOANA_STEAL_HEART' }
  /** Carte Maui — jetons Force +1 : `allies` à tous les Alliés, `heroes` à tous les Héros. */
  | { type: 'MAUI_FORCE_TOKENS'; allies: number; heroes: number }
  /** Carte Maui — défausse les `count` premières cartes d'une (ou des) pioche(s).
   *  `protectCardIds` (Michael — Blessure) : ces cartes ne peuvent pas être défaussées
   *  (remises sur le dessus de la pioche). */
  | { type: 'DISCARD_TOP_DECK'; whichDeck: 'fate' | 'villain' | 'both'; count: number; protectCardIds?: string[] }
  /** Carte Maui (Requin) — joue la 1ʳᵉ carte Fatalité sur Tamatoa lui-même. */
  | { type: 'PLAY_TOP_FATE_ON_SELF' }
  /** Carte Maui (Coléoptère) — mélange tous les Alliés et les répartit équitablement. */
  | { type: 'SHUFFLE_REDISTRIBUTE_ALLIES' }
  /** Carte Maui (Cochon) — perd `lose` Pouvoir et pioche `draw` cartes. */
  | { type: 'LOSE_POWER_DRAW'; lose: number; draw: number }
  /** Carte Maui (Lézard) — défausse un Allié, gagne Pouvoir = sa force. */
  | { type: 'DISCARD_ALLY_GAIN_POWER' }
  /** Gul'dan — Drain d'Âme : défausse un Allié (au choix) puis pioche `draw` cartes. Si
   *  l'Allié défaussé est `bonusCardId` (Esclave Draenei), gagne aussi `bonusPower` Pouvoir. */
  | { type: 'DISCARD_ALLY_DRAW'; draw: number; bonusCardId?: string; bonusPower?: number }
  /** Carte Maui (Heihei) — défaussée, puis dévoile et joue les `count` prochaines cartes Maui. */
  | { type: 'MAUI_CHAIN'; count: number }
  /** Carte Maui (Poisson) — gagne 1 Pouvoir par Condition en main, puis les défausse. */
  | { type: 'REVEAL_HAND_POWER_PER_CONDITION' }
  /** Carte Maui (Étoile de mer) — au prochain tour, déplacement de la figurine facultatif. */
  | { type: 'OPTIONAL_SKIP_MOVE_NEXT' }
  /** Le Seigneur des Ténèbres : s'emparer du Chaudron Noir (tuile hors deck).
   *  Fait passer `blackCauldron` de 'set-aside' à 'claimed' (sans effet si déjà
   *  réclamé/activé). Sources : Montrez-moi le Chaudron Noir, Nous avons conclu un
   *  marché, et la défaite de Hen Wen (onVanquish). */
  | { type: 'CLAIM_BLACK_CAULDRON' }
  /** Le Seigneur des Ténèbres — RÉVEILLE le Chaudron Magique réclamé (face Pouvoir :
   *  'claimed' → 'powered'). « Notre heure est venue ! ». Sans effet si pas réclamé. */
  | { type: 'POWER_BLACK_CAULDRON' }
  /** Le Seigneur des Ténèbres — REND DORMANT le Chaudron Magique réveillé ('powered' →
   *  'claimed'). Sacrifice de Gurki (Fatalité). Sans effet s'il n'est pas réveillé. */
  | { type: 'DORMANT_BLACK_CAULDRON' }
  /** Pioche `count` cartes (Capturés). */
  | { type: 'DRAW_CARDS'; count: number }
  /** Oogie — Père Noël : défausse FACULTATIVE d'autant de cartes que voulu (choix
   *  du joueur, ouvre pendingDiscardThenDraw), PUIS pioche `draw` cartes. */
  | { type: 'DISCARD_ANY_THEN_DRAW'; draw: number }
  /** Gul'dan — Connexion : défausse autant de cartes de la main que voulu (choix
   *  interactif), gagne `amount` Pouvoir par carte défaussée. */
  | { type: 'DISCARD_ANY_FOR_POWER'; amount: number }
  // --- Sa Sucrerie (King Candy / Sugar Rush) --------------------------------
  /** Bug (Glitch) : la carte vient d'être associée à Vanellope → LANCE la course :
   *  place le pion King Candy ET le jeton Pilote sur Départ/Arrivée (index 0),
   *  `raceActive = true`, puis le tour se termine. */
  | { type: 'KING_CANDY_START_RACE' }
  /** Bug (Glitch) joué : si un Bug était DÉJÀ associé à Vanellope (course en cours),
   *  le pion King Candy ET le jeton Pilote avancent de 2 cases ; sinon (1ᵉʳ Bug) LANCE
   *  la course (= KING_CANDY_START_RACE). Résolu après l'association de la carte. */
  | { type: 'KING_CANDY_PLAY_BUG' }
  /** Sa Sucrerie — L'important, c'est de payer : ouvre le choix de dépenser 1 à
   *  min(6, Pouvoir) jetons pour avancer le pion d'autant de cases (pendingPayRace). */
  | { type: 'PAY_TO_RACE' }
  /** Sa Sucrerie — Il lui est défendu de courir : recule le jeton Pilote de 3 (si course),
   *  puis (si Allié + Héros) ouvre le déplacement libre d'Alliés vers le lieu d'un Héros
   *  chaîné à un Vanquish facultatif gardant les Alliés (pendingAllyRelocate → trap 'race-ban'). */
  | { type: 'RACE_BAN' }
  /** Sa Sucrerie — Sergent Calhoun / Ralph la Casse (Fatalité, onPlace) : le fataliseur
   *  PEUT déplacer le Héros `heroCardId` (Vanellope) du royaume fatalisé vers le lieu de
   *  son choix (pendingHeroRelocate, anyLocation, optional). Sans ce Héros → aucun effet. */
  | { type: 'RELOCATE_FATE_TARGET_HERO'; heroCardId: string }
  /** Sa Sucrerie — Princesse Vanellope (Fatalité) : le fataliseur fait reculer le pion
   *  King Candy de 0 à `max` cases (choix interactif pendingPawnBack ; borné par trackPos). */
  | { type: 'KING_CANDY_PAWN_BACK_CHOICE'; max: number }
  /** Sa Sucrerie — Niveau Inachevé (Fatalité) : dévoile les 4 1ʳᵉˢ cartes de la pioche
   *  Méchant ; le fataliseur en place 2 sur le dessus et 2 sous la pioche, dans l'ordre de
   *  son choix (pendingFateReorder deck 'villain-split2', chooserIndex = activePlayer). */
  | { type: 'NIVEAU_INACHEVE' }
  /** Sa Sucrerie — Le Faisceau (Fatalité) : le fataliseur choisit un lieu, y rassemble
   *  tous les Cybugs en Sucre des lieux voisins, puis peut défausser un Cybug de ce lieu
   *  (pendingBeacon). Sans Cybug dans le royaume → aucun effet. */
  | { type: 'BEACON_GATHER_CYBUGS' }
  /** Sa Sucrerie — C'est quoi toutes ces étincelles magiques ? (Fatalité) : défausse un
   *  Bug associé à Vanellope ; s'il en reste au moins un ensuite, le jeton Pilote avance
   *  de 3. Sans Bug sur Vanellope → aucun effet. */
  | { type: 'KING_CANDY_SPARKLES' }
  /** Sa Sucrerie — Médaille de Vanellope (Fatalité) : le fataliseur choisit un Héros de la
   *  défausse Fatalité de Sa Sucrerie et le joue sur le lieu de son choix avec +1 Force
   *  (pendingMedal). Sans Héros en défausse Fatalité → aucun effet. */
  | { type: 'MEDAL_PLAY_FATE_HERO' }
  // --- Mr. Monopoly : mécanique des Maisons / Loyer --------------------------
  /** Affaire : pose des MAISONS sur le lieu où se trouve l'adversaire (choix interactif
   *  de la quantité, paie le coût de chacune). Ouvre `pendingBuyHouses`. */
  | { type: 'MONOPOLY_BUY_HOUSES' }
  /** Monopoly (Condition) / pose forcée : ajoute 1 maison sur le lieu courant de
   *  l'adversaire et paie son coût (sans choix). Sans effet si non posable. */
  | { type: 'MONOPOLY_ADD_ONE_HOUSE' }
  /** Erreur de la banque en votre faveur : gagne 1 Pouvoir par maison posée (plafonné
   *  à `max`). */
  | { type: 'MONOPOLY_GAIN_PER_HOUSE'; max: number }
  /** Carte bancaire : déplace `count` maisons d'un lieu adverse vers un autre (choix
   *  interactif). Ouvre `pendingMoveHouses`. */
  | { type: 'MONOPOLY_MOVE_HOUSES'; count: number }
  /** Chapeau haut de forme : si une carte Affaire (`affaireCardId`) est dans la défausse,
   *  rejoue son effet (pose de maisons). Sans Affaire en défausse → aucun effet. */
  | { type: 'MONOPOLY_FETCH_AFFAIRE'; affaireCardId: string }
  /** Rénovation (Fatalité) : Mr. Monopoly perd la MOITIÉ de son Pouvoir (arrondi au
   *  supérieur), plafonnée à `max`. */
  | { type: 'MONOPOLY_LOSE_HALF_POWER'; max: number }
  /** Voiture (Fatalité, onPlace) : le FATALISEUR peut déplacer un Héros (au choix) du
   *  royaume vers n'importe quel lieu (pendingHeroRelocate anyLocation/optional). */
  | { type: 'RELOCATE_ANY_HERO_FATE' }
  /** Libéré de prison (Fatalité) : le FATALISEUR choisit — déplacer un Héros vers
   *  n'importe quel lieu, OU déplacer le pion de Mr. Monopoly vers la Prison (`prisonLocationId`). */
  | { type: 'MONOPOLY_FREE_FROM_JAIL'; prisonLocationId: LocationId }
  /** Reculez de trois cases : déplace le pion vers n'importe quel lieu, autorise UNE action
   *  de ce lieu (hors Fatalité), puis le tour se termine. Ouvre `pendingBackwardMove`. */
  | { type: 'MONOPOLY_BACKWARD_MOVE' }
  /** Monotonie (Condition) : rejoue GRATUITEMENT une carte (hors Condition) de la défausse. */
  | { type: 'MONOPOLY_MONOTONY' }
  /** Beaucoup trop de versions (Fatalité) / Bateau : DÉTRUIT une maison au choix
   *  (ouvre `pendingMoveHouses` en mode destruction si plusieurs lieux maisonnés ;
   *  sinon retire directement). */
  | { type: 'MONOPOLY_DESTROY_HOUSE' }
  // --- Shere Khan (Le Livre de la Jungle) : mécanique des Jetons Feu ----------
  /** Feu Rouge des Hommes (Fatalité) : le fataliseur POSE un jeton Feu sur une action au
   *  choix d'un lieu de Shere Khan, OU déplace un jeton Feu existant vers une autre action. */
  | { type: 'PLACE_OR_MOVE_FIRE' }
  /** Mowgli (onPlace) : pose un jeton Feu sur une action du lieu d'arrivée du Héros. */
  | { type: 'PLACE_FIRE_AT_HOST' }
  /** C'est moi, Shere Khan : retire un jeton Feu d'une action du lieu du pion (au choix). */
  | { type: 'REMOVE_FIRE_AT_PAWN' }
  /** C'est très intéressant… (Condition) : choix multiple — gagner 1 Pouvoir / piocher 1 /
   *  déplacer un jeton Feu vers une autre action. */
  | { type: 'INTERESSANT_CHOICE' }
  /** Tout le monde fuit : action gratuite au choix « Activer une capacité » OU « Éliminer
   *  un Héros ». */
  | { type: 'GRANT_FREE_ACTIVATE_OR_VANQUISH' }
  /** Jeune et sans défense : déplacer un Héros sur le lieu d'un Allié OU gagner 1 Pouvoir
   *  par Allié du royaume. */
  | { type: 'MOVE_HERO_TO_ALLY_OR_POWER_PER_ALLY' }
  /** À toi de jouer, cousin : dévoile la pioche jusqu'à un Allié, le joue gratuitement,
   *  défausse les autres dévoilées. */
  | { type: 'REVEAL_UNTIL_ALLY_PLAY_FREE' }
  /** C'est à moi que vous le direz : défausse `count` cartes Fatalité, puis on PEUT remettre
   *  une carte Fatalité de la défausse dans la pioche. */
  | { type: 'DISCARD_FATE_THEN_RECOVER'; count: number }
  /** Lancé sur ses traces : si `heroCardId` (Mowgli) est dans le royaume → l'éliminer ;
   *  sinon, le chercher (pioche/défausse Fatalité) et le jouer sur le lieu du pion. */
  | { type: 'DEFEAT_OR_FETCH_HERO'; heroCardId: string }
  /** Aie confiance : récupère `count` cartes de la défausse et les remélange dans la pioche. */
  | { type: 'RECOVER_CARDS_TO_DECK'; count: number }
  /** La Patrouille de la Jungle (onPlace) : dévoile la 1ʳᵉ carte Fatalité ; si Événement,
   *  la joue ; sinon la replace sur la pioche. */
  | { type: 'REVEAL_FATE_PLAY_IF_EVENT' }
  /** Vautours (onPlace) : déplace un Héros du lieu d'arrivée + les Vautours vers un lieu. */
  | { type: 'VULTURES_MOVE' }
  /** Bagheera (onPlace) : disperse les Héros et Alliés du lieu d'arrivée vers d'autres lieux. */
  | { type: 'BAGHEERA_SCATTER' }
  /** Meute de Loups (onPlace) : défausse un Objet ou une carte Macaques du lieu d'arrivée. */
  | { type: 'WOLF_PACK_DISCARD' }
  /** Prendre le tigre par la queue (Fatalité) : déplace un Héros au choix + déplace le pion
   *  de Shere Khan vers un lieu portant un Héros. */
  | { type: 'TIGER_BY_THE_TAIL' }
  /** C'est mon ami (Fatalité) : +`amount` Force (jeton) à tous les Héros d'un lieu au choix. */
  | { type: 'BUFF_HEROES_AT_LOCATION'; amount: number }
  // --- Davy Jones (Jetons Trésor) ------------------------------------------
  /** Pose un jeton Trésor FACE CACHÉE (pioché de la réserve) sur un Héros qui n'en a pas
   *  (choix interactif du Héros). Ils sont là / 2ᵉ partie de Maudit sois-tu. */
  | { type: 'PLACE_TREASURE_FACEDOWN' }
  /** RÉVÈLE (face visible) un jeton Trésor face cachée sur un Héros (choix interactif).
   *  `atHostLocation` : restreint au lieu de la carte porteuse (Bill le Bottier). */
  | { type: 'REVEAL_TREASURE'; atHostLocation?: boolean }
  /** Les amis deviennent des ennemis : échange les trésors entre 2 Héros OU déplace le
   *  trésor d'un Héros vers un autre (choix interactif). */
  | { type: 'MOVE_SWAP_TREASURE' }
  /** Maudit sois-tu, Jack Sparrow (Fatalité) : retire un trésor d'un Héros → réserve,
   *  puis pose un trésor face cachée sur un Héros. */
  | { type: 'CURSE_TREASURE_CYCLE' }
  /** As-tu peur de la mort ? : dévoile la Fatalité jusqu'à un Héros, le joue sur un lieu
   *  au choix, et ajoute un jeton Trésor face cachée sur ce Héros. */
  | { type: 'FETCH_HERO_PLACE_TREASURE' }
  /** La Poursuite : déplace n'importe quel Héros vers un lieu où se trouve un Allié
   *  (choix interactif du Héros et du lieu). */
  | { type: 'MOVE_ANY_HERO_TO_ALLY' }
  /** Où ça pointe-t-il ? (Fatalité) : déplace un Héros AVEC trésor n'importe où, et/ou un
   *  Héros SANS trésor n'importe où (deux déplacements facultatifs). */
  | { type: 'WHERE_POINTS' }
  /** Réveillez le Kraken ! : défausse un Allié, puis cherche LE KRAKEN et le joue
   *  gratuitement sur le lieu du pion. */
  | { type: 'WAKE_KRAKEN' }
  /** L'amour de Calypso (Fatalité) : réduit le Pouvoir de Davy à `max`. */
  | { type: 'CAP_POWER'; max: number }
  /** Je considère cela comme un non : récupère `count` cartes au choix de la défausse. */
  | { type: 'RECOVER_N_FROM_DISCARD'; count: number }
  /** Will Turner (Fatalité, à la pose) : défausse un Allié de force ≤ 2 de son lieu. */
  | { type: 'WILL_TURNER_DISCARD' }
  // --- Dio Brando -----------------------------------------------------------
  /** Va chercher le Stand `standCardId` dans `standPile` et l'associe à la carte hôte
   *  (ctx.hostInstanceId / hostLocationId) : la carte invocatrice qui vient d'entrer en
   *  jeu (Héros Joestar via onPlace, ou Allié de Dio). No-op si le Stand est introuvable. */
  | { type: 'FETCH_STAND_ATTACH'; standCardId: string }
  /** Va chercher la carte `cardId` (pioche/défausse Méchant) et l'ajoute à la main
   *  (Enya Geil → « La flèche »). No-op si introuvable. */
  | { type: 'FETCH_CARD_TO_HAND'; cardId: string }
  /** Dio — ZA WARUDO! : ARRÊTE LE TEMPS pour ce tour (`zaWarudoActive`). Le pion peut
   *  ensuite se déplacer librement entre les lieux (ZA_WARUDO_RELOCATE) et faire les
   *  actions de n'importe quel lieu (hors Fatalité), chacune coûtant un Pouvoir croissant
   *  (1, 2, 3…). Sans effet si The World n'est pas en jeu, ou si Star Platinum est présent. */
  | { type: 'ZA_WARUDO_ACTIVATE' }
  /** Dio — défausser un Allié du royaume (The World épargné) pour gagner `amount` Pouvoir :
   *  ouvre un choix interactif (pendingDioDiscardAlly). Bot : le plus faible. Effet générique. */
  | { type: 'DIO_DISCARD_ALLY_GAIN'; amount: number }
  /** Dio — Vampirisme : défausser un Allié du royaume (The World épargné) pour PIOCHER
   *  `count` cartes — choix interactif (pendingDioDiscardAlly). Bot : le plus faible. */
  | { type: 'DIO_DISCARD_ALLY_DRAW'; count: number }
  /** Pyramid Head — Rites de Jugement (à la pose) : pose la 1ʳᵉ TUILE DE JUGEMENT sur le
   *  lieu le plus à droite (Silent Hill). */
  | { type: 'PYRAMID_PLACE_RITES' }
  /** Pyramid Head — Propager la souffrance : dépense 1 piste de souffrance pour étendre les
   *  tuiles d'un lieu vers la GAUCHE (contigu). Injouable sans souffrance / sans tuile / si
   *  tout est tuilé / si Maria bloque le prochain lieu. */
  | { type: 'PYRAMID_PROPAGATE' }
  /** Pyramid Head — Dissipation (Fatalité) : retire la tuile la plus à GAUCHE. */
  | { type: 'PYRAMID_REMOVE_TILE' }
  /** Pyramid Head — Métatron (Activer) : gagne `amount` piste(s) de souffrance (le coût en
   *  Pouvoir est prélevé par `activatedCost`). Annulé si James est en jeu ; Laura ajoute
   *  +1 au coût en Pouvoir. */
  | { type: 'GAIN_SOUFFRANCE'; amount: number }
  /** Pyramid Head — Angela (à la pose) : le joueur perd `amount` piste(s) de souffrance. */
  | { type: 'LOSE_SOUFFRANCE'; amount: number }
  /** Pyramid Head — James (à la pose) : défausse l'Objet `cardId` (Métatron) du royaume. */
  | { type: 'DISCARD_REALM_CARD'; cardId: string }
  /** Défausse (de la main du joueur actif) `count` cartes, choisies par le moteur (auto :
   *  les moins utiles). Sert Redemption (Fatalité Pyramid Head). */
  | { type: 'DISCARD_OWN_CARDS'; count: number }
  /** Pyramid Head — Pacte de Sang : défausser une carte de la main (au choix), puis
   *  récupérer une carte du MÊME type dans la défausse (au choix) → main. Deux choix
   *  interactifs (pendingPacteSang puis pendingRecover, label « Pacte de sang »). */
  | { type: 'PACTE_DE_SANG' }
  /** Pyramid Head — Sacrifice Humain (capacité ACTIVÉE) : ouvre un choix (pendingSacrifice) :
   *  regarder les 3 1ʳᵉˢ cartes de la pioche et en garder 1 (le reste défaussé), OU gagner
   *  2 Pouvoir. */
  | { type: 'SACRIFICE_HUMAIN_CHOICE' }
  /** Pyramid Head — Cage de l'Expiation (à la pose, après association à un Héros sur une
   *  tuile) : ouvre le choix du lieu où DÉPLACER le Héros porteur (pendingCageMove). */
  | { type: 'CAGE_MOVE_HOST' }
  /** Pyramid Head — Cage de l'Expiation (capacité ACTIVÉE) : ARME la Cage → au début du
   *  prochain tour, le Héros porteur est éliminé (sauf Eddie, `immuneToCage`). */
  | { type: 'CAGE_ARM' }
  /** Dio — Masque de pierre (Activer) : défausse TOUTE la main, gagne 1 Pouvoir par carte. */
  | { type: 'DIO_DISCARD_HAND_GAIN_POWER' }
  /** Dio — Fondation Speedwagon (Fatalité) : défausse un Objet non associé du royaume de Dio
   *  (auto : le plus précieux — choix du fataliseur). */
  | { type: 'DIO_DISCARD_ITEM_IN_REALM' }
  /** Dio — Cartomancie (Fatalité) : réduit de `amount` la force d'un Allié de Dio (auto : le
   *  plus fort — choix du fataliseur), via un jeton permanent (plancher 0). */
  | { type: 'DIO_REDUCE_ALLY_STRENGTH'; amount: number }
  /** Dio — Lumière du Soleil (Fatalité) : ouvre le choix de DIO (pendingDioSunlight) entre
   *  défausser sa main ou perdre `lose` Pouvoir. Bot : l'option la moins coûteuse pour lui. */
  | { type: 'DIO_SUNLIGHT_CHOICE'; lose: number }
  /** Dio — Tu oses t'approcher de moi : dévoile les `count` 1ʳᵉˢ cartes Fatalité, joue TOUS
   *  les Héros révélés sur LE MANOIR (repaire de Dio = 1ᵉʳ lieu ; chacun déclenche son Stand),
   *  défausse le reste. */
  | { type: 'DIO_REVEAL_FATE_HEROES_AT_PAWN'; count: number }
  /** Dio — CREAM (Stand de Vanilla Ice, à l'invocation) : ouvre un choix interactif
   *  (pendingDioCream) du Héros à défausser parmi ceux de force inférieure à Vanilla Ice
   *  présents sur son lieu. Bot : le plus fort éligible. */
  | { type: 'DIO_CREAM_DISCARD_HERO' }
  /** Dio — Quête vers le paradis : va chercher un OBJET (non-Stand) dans la pioche ou la
   *  défausse et l'ajoute à la main (choix interactif via pendingRecover, label « Quête
   *  vers le paradis » ; pioche remélangée ensuite). */
  | { type: 'DIO_QUEST_FOR_HEAVEN' }
  /** Dio — MUDA! (Condition) : ouvre un choix interactif (pendingDioMuda) du Héros à éliminer
   *  sur le lieu du pion (facultatif) et gagne `gain` Pouvoir. Bot : le plus fort. */
  | { type: 'DIO_MUDA'; gain: number }
  /** Vanellope (début de tour) & « Enfin un vrai Kart ! » (Fatalité) : dévoile la 1ʳᵉ
   *  carte Méchant de la pioche de Sa Sucrerie, avance le jeton Pilote de (coût + 2)
   *  cases, puis remet la carte SOUS la pioche. Sans effet hors course. */
  | { type: 'KING_CANDY_ADVANCE_RACER_BY_REVEAL'; bonus?: number }
  /** Avance le jeton Pilote de `amount` cases (C'est quoi toutes ces étincelles : +3). */
  | { type: 'KING_CANDY_ADVANCE_RACER'; amount: number }
  /** Recule le jeton Pilote de `amount` cases (Mémoire Verrouillée 2, Taffyta 2,
   *  Il lui est défendu de courir 3). Borné à l'index 0. */
  | { type: 'KING_CANDY_MOVE_RACER_BACK'; amount: number }
  /** Sa Sucrerie — Taffyta Crème Brûlée (jouée OU déplacée) : choix « reculer le Pilote
   *  de 2 » OU « effectuer une action Jouer une carte gratuite ». Si les deux sont
   *  possibles → pending interactif ; sinon la seule option réalisable s'applique. */
  | { type: 'TAFFYTA_CHOICE' }
  /** Déplace le pion King Candy de `steps` cases sur le circuit (signé : négatif =
   *  recul, Princesse Vanellope −4 ; positif = Le plus puissant Virus +2). Pendant une
   *  course, un franchissement de Départ/Arrivée vers l'avant déclenche la victoire. */
  | { type: 'KING_CANDY_MOVE_TRACK'; steps: number }
  /** Turbo-Statique : CE tour, King Candy peut utiliser ses 3 actions accessibles même
   *  si elles sont recouvertes (Héros ou jeton Pilote). Pose `turboUncoverThisTurn`. */
  | { type: 'KING_CANDY_TURBO' }
  // --- Syndrome (Les Indestructibles) ---------------------------------------
  /** Mirage : dévoile la pioche Fatalité jusqu'au 1er Héros, le joue sur le MÊME lieu que
   *  Mirage (sa destination de pose), défausse les autres dévoilées. */
  | { type: 'REVEAL_FATE_HERO_AT_PAWN' }
  /** 15 ans plus tard : dévoile la pioche Fatalité jusqu'au 1er Héros, à JOUER sur le lieu
   *  de SON choix (pendingFetchedHero), avec sa force réduite de `weakenBy`. Les autres
   *  cartes dévoilées sont défaussées. */
  | { type: 'REVEAL_FATE_HERO_CHOOSE_LOC'; weakenBy?: number }
  /** Identification, je vous prie : déplace un Allié ou un Objet (non associé) vers un
   *  lieu portant ≥1 Héros (auto : le plus utile vers le lieu d'un Héros). */
  | { type: 'MOVE_ALLY_OR_ITEM_TO_HERO_LOCATION' }
  /** Unité de Confinement : réduit la force d'un Héros à 0 (`forceZeroed`). Auto : le
   *  Héros le plus fort du royaume. */
  | { type: 'REDUCE_HERO_FORCE_TO_ZERO' }
  /** Qui est le plus super ? (Condition) : gagne autant de Pouvoir que le COÛT de la
   *  dernière carte jouée par l'adversaire (`lastPlayedCardCost`). */
  | { type: 'GAIN_POWER_EQUAL_LAST_PLAYED_COST' }
  /** Sonde Bio (Condition) : élimine un Héros du royaume de force ≤ celle du dernier
   *  Héros vaincu par l'adversaire (`lastVanquishedHeroStrength`). Auto : le plus fort
   *  éligible. */
  | { type: 'DEFEAT_REALM_HERO_AUTO'; useLastVanquishStrength?: boolean }
  /** Fatalité — Alors ça, c'est un truc de dingue ! : défausse TOUS les Alliés et Objets
   *  du royaume de la cible, sauf ceux de `exceptCardId` (Champ de Force). */
  | { type: 'DISCARD_VILLAIN_BOARD_EXCEPT'; exceptCardId: string }
  /** Fatalité — Violette (à la pose) : défausse toutes les cartes `cardId` du royaume
   *  de la cible (Énergie au Point Zéro). */
  | { type: 'DISCARD_ALL_OF_CARDID_IN_REALM'; cardId: string }
  /** Gul'dan — Défaite (Fatalité) : le fataliseur CHOISIT un type (Alliés OU Objets) et
   *  défausse TOUTES les cartes de ce type du royaume de la cible (choix via
   *  pendingFateDiscardType ; le bot auto-résout). */
  | { type: 'FATE_DISCARD_TYPE_CHOICE' }
  /** Gul'dan — Prophète Velen (Fatalité, onPlace) : cherche la carte `cardId` (Armée de
   *  la Lumière) dans la défausse/pioche Fatalité de la cible et la REJOUE (posée sur un
   *  lieu choisi par le fataliseur, via pendingFateObjectPlace). */
  | { type: 'FATE_REPLAY_CARD_FROM_DISCARD'; cardId: string }
  /** Fatalité — effet COMMUN aux Indestructibles + Frozone (à la pose) : si la
   *  Télécommande de Syndrome est dans le royaume (non associée), associez-la
   *  IMMÉDIATEMENT à ce Héros (il « vole » la Télécommande → Syndrome ne peut plus
   *  l'activer jusqu'à ce que le Héros soit vaincu). */
  | { type: 'ATTACH_REMOTE_IF_IN_REALM' }
  /** Fatalité — Elastigirl (à la pose) : défausse UN Allié (au choix du fatalisateur ;
   *  auto = le plus fort) sur le lieu hôte. L'Omnidroïde est épargné. */
  | { type: 'DISCARD_ONE_ALLY_AT_HOST' }
  /** Fatalité — Flèche (à la pose) : déplace UN Héros (au choix ; auto) du royaume vers
   *  le lieu hôte (celui où Flèche est jouée). */
  | { type: 'MOVE_HERO_TO_HOST' }
  /** Fatalité — Intrusion : la cible révèle sa main (journal, pas d'effet mécanique). */
  | { type: 'REVEAL_HAND' }
  /** Fatalité — Monologue : la cible défausse `count` cartes de sa main AU CHOIX
   *  (interactif via pendingTyrannyDiscard ; auto pour le bot). */
  | { type: 'TARGET_DISCARD_CHOICE'; count: number; label?: string }
  // --- Lotso (Toy Story 3) ---------------------------------------------------
  /** Big Baby / Bienvenue à Sunnyside : dévoile la pioche Fatalité jusqu'au 1er Héros,
   *  le joue sur la Salle des Chenilles (`atRoom`) ou sur un lieu HORS de la Salle
   *  (`!atRoom`, auto). Défausse les autres dévoilées. */
  | { type: 'LOTSO_REVEAL_HERO'; atRoom: boolean }
  /** Réductions de force (jetons −1) Lotso. `scope` : 'room' (Héros de la Salle),
   *  'not-room' (hors Salle), 'all' (tous), 'at-pawn' (lieu du pion). `target` :
   *  'all' ou 'one' (auto : le plus fort). `byRoomCount` : montant = nb de Héros de la
   *  Salle. `toZero` : réduit jusqu'à 0. Sinon `amount`. */
  | {
      type: 'LOTSO_REDUCE'
      scope: 'room' | 'not-room' | 'all' | 'at-pawn'
      target: 'all' | 'one'
      amount?: number
      byRoomCount?: boolean
      toZero?: boolean
    }
  /** Lotso — Le Bibliothécaire : coût VARIABLE. Ouvre une répartition interactive où le
   *  joueur dépense des jetons Pouvoir (1 = −1 force) ventilés entre les Héros de son
   *  choix (cf. `pendingLotsoBookworm`). */
  | { type: 'LOTSO_BOOKWORM' }
  /** Déplacements Lotso. `scope` : 'to-room' (un Héros [ou Buzz] vers la Salle),
   *  'all-to-room' (tous les Héros vers la Salle), 'from-room' (un Héros hors de la
   *  Salle), 'from-host' (un Héros [ou Buzz] du lieu hôte vers ailleurs). `includeBuzz` :
   *  la tuile Buzz est une cible possible. Auto. */
  | { type: 'LOTSO_MOVE'; scope: 'to-room' | 'all-to-room' | 'from-room' | 'from-host'; includeBuzz?: boolean }
  /** Retourne la tuile Buzz sur sa face `to` ('demo' = Allié ; 'guardian' = Gardien) et
   *  la déplace (`moveTo` : 'bottom' = un lieu de la rangée basse au choix/auto ;
   *  'cour-top' = en haut de la Cour de Récréation). */
  | { type: 'LOTSO_FLIP_BUZZ'; to: 'demo' | 'guardian'; moveTo?: 'bottom' | 'cour-top' }
  /** Andy nous cherche (Fatalité) : +`amount` force (jetons +1) à tous les Héros dont la
   *  force n'a pas été réduite à 0. */
  | { type: 'LOTSO_BOOST_NONZERO'; amount: number }
  /** Jouets de Bonnie (Fatalité) : retire tous les jetons Force négatifs d'un Héros
   *  (auto : le plus réduit) — restaure sa force. */
  | { type: 'LOTSO_RESTORE_HERO' }
  /** Le Grappin (Fatalité) : défausse un Héros de force 0 (auto), puis mélange la
   *  défausse Fatalité dans la pioche Fatalité. */
  | { type: 'LOTSO_DISCARD_ZERO_HERO' }
  /** Jessie / Lotso était son préféré (Fatalité) : défausse un Allié de Lotso (auto : le
   *  plus fort ; Buzz démo épargné). */
  | { type: 'LOTSO_FATE_DISCARD_ALLY' }
  /** Woody (Fatalité, à la pose) : si le Chapeau de Woody est en jeu, défaussez-le ; puis
   *  déplace les Héros de la Salle des Chenilles vers d'autres lieux (auto, dispersion). */
  | { type: 'WOODY_RELEASE' }
  /** Médaillon de Daisy (Fatalité) : si Big Baby est en jeu, défaussez-le ; puis mélange
   *  la défausse Fatalité dans la pioche Fatalité. */
  | { type: 'DAISY_LOCKET' }
  /** Fatalité — Travail d'équipe : le fatalisateur regarde les `count` premières cartes de
   *  la pioche Fatalité de la cible et les réordonne. Auto (simplifié) : Héros d'abord
   *  (au plus défavorable pour la cible). */
  | { type: 'REORDER_FATE_TOP'; count: number }
  /** Fatalité — Pas de Capes ! : au PROCHAIN tour de la cible, son déplacement est
   *  ANNULÉ (le pion reste sur place ; flag `skipMoveForcedNextTurn`). */
  | { type: 'FORCE_SKIP_NEXT_MOVE' }
  // --- Le Piégeur (Dead by Daylight) --------------------------------------
  /** RÉVÉLER un Survivant face cachée (ouvre pendingPiegeur, phase 'target'). `atPawn` =
   *  seulement sur le lieu du pion (Marque d'éraflure) ; sinon n'importe où (Explosion).
   *  `thenMove` = après révélation, le déplacer vers un voisin (phase 'dest'). La révélation
   *  déclenche l'effet « Lorsque révélé » du Survivant (auto). */
  | { type: 'PIEGEUR_REVEAL'; atPawn?: boolean; thenMove?: boolean }
  /** FORCE BRUTE : blesse un Survivant révélé du lieu du pion (sain→blessé + déplacement),
   *  OU le passe en critique s'il est déjà blessé. Direct critique si PERSONNE N'ÉCHAPPE
   *  À LA MORT est en jeu. Ouvre pendingPiegeur (phase 'target'). */
  | { type: 'PIEGEUR_INJURE' }
  /** SANCTUAIRE MONSTRUEUX : accroche un Survivant CRITIQUE du lieu du pion au crochet de
   *  ce lieu (−1 vie + hookedThisTurn). Ouvre pendingPiegeur. */
  | { type: 'PIEGEUR_HOOK' }
  /** MEMENTO MORI : élimine un Survivant CRITIQUE à 1 vie sur le lieu du pion. */
  | { type: 'PIEGEUR_FINISH' }
  /** RAYON DE TERREUR : déplace un Survivant (n'importe lequel) vers un lieu voisin. */
  | { type: 'PIEGEUR_MOVE_SURVIVOR' }
  /** PUDDING DE SURVIVANTS : +1 Pouvoir, +1 par Survivant éliminé OU révélé. */
  | { type: 'PIEGEUR_PUDDING_POWER' }
  /** Effet « Lorsque révélé » AUTO d'un Survivant (résolu à la révélation, hostInstanceId
   *  = le Survivant). HEAL = un Survivant récupère un segment ; UNHOOK = décrocher un
   *  Survivant (→ blessé) ; MEG_FLEE = ce Survivant fuit au lieu le plus loin du pion ;
   *  JAKE_SABOTAGE = désactiver un crochet 1 tour OU défausser un piège à ours. */
  | { type: 'PIEGEUR_HEAL' }
  | { type: 'PIEGEUR_UNHOOK' }
  | { type: 'PIEGEUR_MEG_FLEE' }
  | { type: 'PIEGEUR_JAKE_SABOTAGE' }
  /** ADRÉNALINE (Fatalité) : un Survivant récupère un segment PUIS fuit (lieu le plus loin). */
  | { type: 'PIEGEUR_ADRENALINE' }
  /** PURIFICATION (Fatalité) : défausse PERSONNE N'ÉCHAPPE À LA MORT (main ou royaume du Piégeur). */
  | { type: 'PIEGEUR_PURIFY' }
  // --- Madame Mim ---------------------------------------------------------
  /** J'établis les règles : vainc directement une Métamorphose de Merlin du royaume
   *  (→ merlinDiscard + remplacement au Lieu du Duel). 2ᵉ voie de victoire. */
  | { type: 'DEFEAT_MERLIN_IN_REALM' }
  /** Duel de Sorcellerie : pose la prochaine Métamorphose de Merlin (dessus de la
   *  pioche Merlin) au Lieu du Duel (en plus de celle déjà présente). */
  | { type: 'PLACE_MERLIN_AT_DUEL' }
  /** Pas de Tricherie : réordonne le dessus de la pioche Merlin pour faire venir une
   *  Métamorphose que Madame Mim peut vaincre (auto-optimisé). */
  | { type: 'REORDER_MERLIN_DECK_TOP2' }
  /** Le Savoir conduit à la Puissance (Fatalité) : déplace une Métamorphose de Merlin
   *  vers un autre lieu (auto : loin d'une Métamorphose Mim prête). */
  | { type: 'MOVE_MERLIN_ANYWHERE' }
  /** Merlin (Fatalité) : remet une Métamorphose de Merlin VAINCUE (merlinDiscard, au
   *  hasard) dans la pioche Merlin. */
  | { type: 'RECYCLE_DEFEATED_MERLIN' }
  /** Archimède (Fatalité) : remplace la Métamorphose de Merlin en jeu par le dessus de
   *  la pioche Merlin (la remplacée est remélangée dans la pioche). */
  | { type: 'SWAP_DUEL_MERLIN' }
  /** Merlin Microbe (Fatalité) : défausse une Métamorphose Mim (Allié) du royaume. */
  | { type: 'DISCARD_MIM_TRANSFORMATION' }
  /** Le Seigneur des Ténèbres — choix « s'emparer du Chaudron Magique OU gagner `power`
   *  Pouvoir » (Montre-moi le Chaudron Magique). */
  | { type: 'CLAIM_CAULDRON_OR_POWER'; power: number }
  /** Le Seigneur des Ténèbres — Nous avons conclu un marché ! : choix « mélanger sa
   *  défausse Vilain dans sa pioche » OU « payer `power` Pouvoir supplémentaires pour
   *  défausser l'Épée Magique de son royaume et s'emparer du Chaudron Magique ». Le
   *  choix n'est proposé que si LES DEUX options sont possibles (sinon auto-résolu). */
  | { type: 'BARGAIN_RESHUFFLE_OR_SWORD'; power: number }
  /** Le Seigneur des Ténèbres — Retour à la vie de Gurki (Fatalité) : mélange la
   *  défausse Fatalité du joueur dans sa pioche, dévoile 2 cartes Fatalité et permet de
   *  jouer les deux. */
  | { type: 'RESHUFFLE_FATE_REVEAL_PLAY_BOTH' }
  /** Le Seigneur des Ténèbres — Nous touchons du doigt la victoire : jouer GRATUITEMENT
   *  un Objet de sa main (sur un lieu choisi). Sans effet si aucun Objet en main. */
  | { type: 'GRANT_FREE_ITEM_PLAY' }
  /** Rassemble tous les Alliés du joueur sur le lieu de la carte hôte (Ritournel). */
  | { type: 'GATHER_ALLIES_TO_HOST' }
  | { type: 'GAIN_POWER'; amount: number }
  /** Oogie Boogie — Imposteur Perce-Oreilles : lance les 2 dés (pendingDice
   *  `impostor`). ≥7 → succès (pile près de Sandy Claws / jeton -1 sur Jack si
   *  revenu) ; ≤6 → la carte est défaussée. */
  | { type: 'ROLL_IMPOSTOR' }
  /** Oogie Boogie — Préparation de Noël : lance les 2 dés (pendingDice
   *  `making-christmas`). ≤7 → pioche 1 ; ≥8 → action de royaume gratuite. */
  | { type: 'ROLL_MAKING_CHRISTMAS' }
  /** Oogie Boogie — Mais quelle merveille ! : effectue d'abord un Vanquish
   *  (ctx.targetHeroId + allyInstanceIds), met les Alliés de côté, puis lance les
   *  dés (pendingDice `merveille`). ≤7 → Alliés en main ; ≥8 → restent en jeu. */
  | { type: 'ROLL_MERVEILLE' }
  /** Oogie Boogie — Ce sont des vacances : défausse les 3 premières cartes de SA
   *  pioche Fatalité, pioche 1 carte Vilain par Héros ainsi défaussé. */
  | { type: 'DISCARD_TOP_FATE_DRAW_PER_HERO'; count: number }
  /** Oogie Boogie — Jack Skellington joué en FATALITÉ : retire 1 Imposteur de la
   *  pile (impostorsPlaced − 1, plancher 0). La carte Jack part en défausse Fatalité. */
  | { type: 'JACK_FATE_DISCARD_IMPOSTOR' }
  /** Oogie Boogie — Cette fois l'affaire est dans le sac : rejoue un Événement de
   *  la défausse gratuitement ; s'il lance les dés, le résultat est choisi (au mieux).
   *  Réutilise pendingReplayEvent avec le drapeau `bagControlledDice`. */
  | { type: 'REPLAY_EVENT_BAG' }
  /** Oogie Boogie — Joyeux Halloween ! (Condition) : lance les 2 dés. ≥8 → gagne le
   *  total en Pouvoir ; ≤7 → vole 1 Pouvoir à l'adversaire actif. Résolu immédiatement. */
  | { type: 'ROLL_TRICK_OR_TREAT' }
  /** Pioche `count` cartes (générique). */
  | { type: 'DRAW_CARDS'; count: number }
  /** Oogie Boogie — Sally (onPlace, Fatalité) : déplace le pion d'Oogie sur le lieu
   *  où Sally est posée et active la restriction de déplacement (lieux voisins). */
  | { type: 'SALLY_PLACED' }
  /** Mère Gothel — gagne `amount` jetons Confiance (pris dans la Réserve : n'entame
   *  pas son Pouvoir). Objectif : 10 Confiance au début de son tour. */
  | { type: 'GAIN_CONFIANCE'; amount: number }
  /** Mère Gothel — perd `amount` jetons Confiance (rendus à la Réserve, plancher 0). */
  | { type: 'LOSE_CONFIANCE'; amount: number }
  /** Mère Gothel — perd `amount` Confiance SI la carte (onPlace) arrive sur le lieu
   *  de Raiponce ; sinon rien (La Reine et le Roi). */
  | { type: 'LOSE_CONFIANCE_AT_RAIPONCE'; amount: number }
  /** Le Satyre — si ce Héros (onPlace) arrive sur le lieu du pion du propriétaire,
   *  le joueur qui pose la Fatalité peut déplacer ce pion sur n'importe quel lieu
   *  (pendingPawnMove). Sinon rien. */
  | { type: 'MOVE_OWNER_PAWN_IF_AT_PAWN'; label?: string }
  /** La Main froide — le propriétaire défausse `amount` carte(s) au hasard de sa
   *  main (aléa via rngState). */
  | { type: 'FATE_DISCARD_RANDOM_HAND'; amount: number }
  /** Flynn Rider — à l'arrivée, le propriétaire (Gothel) perd jusqu'à `amount`
   *  Confiance, déposés sur ce Héros (heldConfiance) ; rendus s'il est vaincu. */
  | { type: 'FLYNN_TAKE_CONFIANCE'; amount: number }
  /** Mère Gothel — déplace Raiponce (Héros-tuile). `to` : 'tour'/'corona' = lieu
   *  extrême ; 'left'/'right' = de `steps` lieux (défaut 1) vers la Tour / Corona. */
  | { type: 'MOVE_RAIPONCE'; to: 'tour' | 'corona' | 'left' | 'right'; steps?: number }
  /** Mère Gothel — gagne `amount` Confiance SI le pion est sur le lieu de Raiponce
   *  (+`bonusAtTour` si ce lieu est la Tour). Sinon rien. */
  | { type: 'GAIN_CONFIANCE_WITH_RAIPONCE'; amount: number; bonusAtTour: number }
  /** Mère Gothel — N'écoute que moi : Raiponce ne se déplacera pas à la fin de ce tour. */
  | { type: 'SKIP_RAIPONCE_MOVE' }
  /** Mère Gothel — Vengeance : effectue une action « Éliminer un Héros » (offerte à la
   *  Tour) et arme le bonus de Confiance (+1 si le Héros éliminé n'est pas Raiponce). */
  | { type: 'VENGEANCE' }
  /** Mère Gothel — Lance-moi ta chevelure : si Raiponce est sur la Tour, gagnez
   *  `confianceIfAtTower` Confiance ; sinon, déplacez-la de 1 à `maxSteps` lieux vers
   *  la Tour (choix du nombre de lieux → pendingRaiponceHomeward si ≥ 2 options). */
  | { type: 'RAIPONCE_HOMEWARD'; confianceIfAtTower: number; maxSteps: number }
  /** Mère Gothel — Frères Stabbington : Allié qui, joué sur le lieu de Raiponce
   *  (hors Tour), permet (au choix) de la déplacer sur la Tour. Marqueur : la
   *  résolution a lieu APRÈS placement (applyPlayCard → pendingRaiponceToTower). */
  | { type: 'OFFER_RAIPONCE_TO_TOWER' }
  // --- Cruella d'Enfer : Tuiles Chiots --------------------------------------
  /** Choisis une Tuile Chiots de la réserve et ajoute-la sur son lieu indiqué
   *  (interactif → pendingPuppyAdd ; bot : meilleure connue). Ici mes petits !,
   *  Lampe électrique, Sans cœur, Horace (option ajouter). */
  | { type: 'ADD_PUPPY_FROM_RESERVE'; label?: string }
  /** Capture une Tuile Chiots posée sur le lieu du pion (J'ai payé pour ça). */
  | { type: 'CAPTURE_PUPPY_AT_PAWN' }
  /** Capture jusqu'à `max` Tuiles Chiots posées sur le lieu de la carte hôte
   *  (Jasper, Horace). Nécessite hostLocationId. */
  | { type: 'CAPTURE_PUPPY_AT_HOST'; max: number }
  /** Révèle jusqu'à `count` Tuiles Chiots face cachée de la réserve (Repéré !). */
  | { type: 'REVEAL_PUPPY_RESERVE'; count: number }
  /** Gagne 1 Pouvoir par lieu portant ≥ 1 Tuile Chiots (J'adore les belles fourrures). */
  | { type: 'GAIN_POWER_PER_PUPPY_LOCATION' }
  /** Fatalité — Évasion : remet `count` Tuile(s) Chiots CAPTURÉE(s) dans la réserve
   *  (face visible). Auto : la plus grosse valeur (nuit le plus). */
  | { type: 'UNCAPTURE_PUPPY_TO_RESERVE'; count: number }
  /** Fatalité — Nous sommes des labradors : remet dans la réserve jusqu'à `max`
   *  Tuiles Chiots NON capturées d'un même lieu. */
  | { type: 'RETURN_BOARD_PUPPIES_TO_RESERVE'; max: number }
  /** Fatalité — Sergent Tibs : déplace jusqu'à `max` Tuiles Chiots non capturées
   *  vers le lieu hôte du Héros (hostLocationId). */
  | { type: 'MOVE_BOARD_PUPPIES_TO_HERO'; max: number }
  /** Tabbou — dévoile `count` tuile(s) Combattant : pioche (`pile`) → réserve
   *  (`reserve`, face visible). Tirage aléatoire (rngState). Si la pioche est vide,
   *  les tuiles `killed` y sont remélangées d'abord. (Émissaire, Destin, Flèche, Primides). */
  | { type: 'REVEAL_FIGHTERS'; count: number }
  /** Tabbou — tue TOUTES les tuiles Combattants d'UNE couleur choisie dans la réserve
   *  (`reserve` → `killed`). Choix interactif de la couleur (Collection, Bowser). */
  | { type: 'KILL_FIGHTERS_COLOR' }
  /** Tabbou — tue jusqu'à `max` tuiles Combattants de la réserve, toutes couleurs
   *  confondues (choix interactif tuile par tuile). Coup Fatal (`max` = 10). */
  | { type: 'KILL_FIGHTERS_FREE'; max: number }
  /** Tabbou (Fatalité) — remet `count` tuile(s) TUÉE(s) dans la réserve (`killed` →
   *  `reserve`), même couleur si possible (Réveil = 2, Rassemblement = 3). Recul. */
  | { type: 'RETURN_KILLED_FIGHTERS'; count: number; sameColorIfPossible?: boolean }
  /** Tabbou — Orbe subspatial : à la pose (Objet sur un lieu), si les 3 lieux hors
   *  Émissaire portent chacun ≥ 1 Orbe, déverrouille l'Émissaire Subspatial. */
  | { type: 'SUBSPACE_ORB_PLACED' }
  /** Tabbou — Destin : ouvre le choix « Dévoiler 3 Combattants » OU « Gagner 4 Pouvoir »
   *  (pendingDestinChoice). */
  | { type: 'DESTIN_CHOICE' }
  /** Fatalité — Perdita : prend 1 Tuile Chiots capturée et la repose (non capturée)
   *  sur le lieu hôte du Héros. */
  | { type: 'PLACE_CAPTURED_PUPPY_AT_HERO' }
  /** Cruella — Finissez le travail ! : autorise UNE action « Activer » gratuite ce
   *  tour, sur le lieu courant (drapeau freeActivate). */
  | { type: 'GRANT_FREE_ACTIVATE' }
  // --- Gaston : jetons Obstacle ---------------------------------------------
  /** Retire jusqu'à `max` jetons Obstacle. `sameLocation` : tous depuis UN SEUL lieu
   *  (Laissez-moi vous regarder). Sinon, librement répartis (Très mauvais caractère,
   *  Sortez !, Monsieur D'Arque, Aussi belle que moi). Interactif (pendingObstacle) ;
   *  bloqué si Belle est dans le royaume. */
  | { type: 'REMOVE_OBSTACLE'; max: number; sameLocation?: boolean }
  /** Replace `count` jetons Obstacle (bornés à 2/lieu, total 8). `mode` :
   *  'free' (défaut, lieux au choix) ; 'each-location' (jusqu'à 1 sur CHAQUE lieu —
   *  C'est toi) ; 'fill-location' (remplit UN lieu choisi à 2 — Vous m'avez sauvé la vie).
   *  Sous le charme, Je n'ai jamais…, Me masser les pieds. Interactif (pendingObstacle). */
  | {
      type: 'REPLACE_OBSTACLE'
      count: number
      mode?: 'free' | 'each-location' | 'fill-location'
      auto?: boolean
      /** Gaston — Sous le charme : une fois le(s) Obstacle(s) replacé(s), ouvre le choix
       *  « gagner `power` Pouvoir OU piocher `draw` cartes » (pendingDrawOrGainPower).
       *  `cardId` = carte source (affichage du modal). */
      thenDrawOrGain?: { draw: number; power: number; cardId?: string }
    }
  /** Retire TOUS les jetons Obstacle d'un lieu précis (Vanquish de la Bête → Château ;
   *  de Maurice → Maison de Belle). Non bloqué par Belle (déclenché par un Vanquish). */
  | { type: 'REMOVE_OBSTACLES_AT_LOCATION'; locationId: LocationId }
  /** Gaston — Belle est à moi / Tous avec moi : « Effectuez une action X ». Arme une
   *  action gratuite de type `actionType` exécutable depuis le lieu du pion ce tour
   *  (grantedAction), même si le lieu ne la propose pas (cf. Diablo). */
  | { type: 'GRANT_FREE_ACTION'; actionType: LocationActionType }
  /** Madame de Trémaine — C'est votre dernière chance : effectue UNE action gratuite
   *  au CHOIX entre « Déplacer un Objet ou un Allié » et « Activer ». Si une seule des
   *  deux est possible, elle est armée directement ; si les deux le sont, ouvre le choix
   *  (pendingMoveOrActivate). Injouable si aucune des deux n'est possible. */
  | { type: 'GRANT_FREE_MOVE_OR_ACTIVATE' }
  /** Gaston — Gardez-moi en otage : dévoile la pioche Fatalité jusqu'au 1er Héros,
   *  le joue sur `locationId`, retire `removeObstacle` Obstacle(s), remélange le reste. */
  | { type: 'REVEAL_FATE_UNTIL_HERO_PLAY'; locationId: LocationId; removeObstacle?: number }
  /** Gaston — Montre-moi la Bête ! : si la Bête est en jeu → retire 1 Obstacle ;
   *  si Belle est en jeu → replace 1 Obstacle ; si LES DEUX → gagne 2 Pouvoir (à la
   *  place). */
  | { type: 'SHOW_ME_THE_BEAST' }
  /** Gaston (Fatalité) — C'est la fête : le joueur qui fatalise choisit un Héros de
   *  la défausse Fatalité de Gaston et le pose sur un lieu (auto : le plus fort, là
   *  où il gêne le plus). (Distinct de PLAY_FATE_HERO_FROM_DISCARD, propre à Scar.) */
  | { type: 'FATE_PLAY_HERO_FROM_DISCARD' }
  /** Gaston (Fatalité, à la pose) — Maurice : cherche son `itemCardId` (Invention de
   *  Maurice) dans la pioche/défausse Fatalité de la cible et l'associe au Héros hôte
   *  (sur son lieu). Auto. */
  | { type: 'FETCH_FATE_ITEM_TO_HOST'; itemCardId: string }
  /** Gaston (Fatalité, à la pose) — La Bête : déplace tous les Alliés (non associés)
   *  du lieu hôte vers les AUTRES lieux non bloqués (auto : dispersion en round-robin),
   *  pour les éloigner de la Bête. */
  | { type: 'MOVE_ALLIES_FROM_HOST_AWAY' }
  /** Sa Sucrerie — Go ! : déplacer jusqu'à `count` Alliés du royaume de l'acteur, chacun
   *  vers N'IMPORTE QUEL lieu (choix interactif via pendingAllyRelocate, facultatif). */
  | { type: 'RELOCATE_ALLIES'; count: number; title?: string }
  /** Gaston (Fatalité, à la pose) — Mrs Samovar et Zip : disperse tous les Héros du
   *  royaume de la cible (sauf l'hôte) à travers les lieux (auto, round-robin). */
  | { type: 'SCATTER_REALM_HEROES' }
  // --- Le Seigneur des clés : clés de couleur + dé ---------------------------
  /** « Obtenir une clé » / Toute Puissance : ramasse une clé présente sur le lieu du
   *  pion (choix interactif → pendingKeyTake ; bot : couleur encore manquante). */
  | { type: 'TAKE_KEY_AT_PAWN' }
  /** Pierre tombale : lance le dé ; si une clé de la couleur obtenue est sur le lieu
   *  du pion, la ramasse (auto). */
  | { type: 'ROLL_DIE_TAKE_KEY_AT_PAWN' }
  /** Action « Obtenir une clé » : lance le dé ; ramasse une clé de la couleur obtenue
   *  n'importe où sur le plateau (auto). */
  | { type: 'ROLL_DIE_TAKE_KEY_FROM_BOARD' }
  /** Madame de Trémaine — Piège : PIÈGE un Héros choisi (`trapped`) : sa capacité est
   *  ignorée, mais il continue de recouvrir les actions (présence physique). */
  | { type: 'TRAP_HERO' }
  /** Madame de Trémaine — Canne : retire (défausse) toutes les Pantoufles de Verre du
   *  royaume. */
  | { type: 'REMOVE_GLASS_SLIPPER' }
  /** Fatalité (Bibbidi-Bobbidi-Boo / Doux Rossignol) : la cible défausse `count`
   *  carte(s) au hasard de sa main. */
  | { type: 'TARGET_DISCARD_RANDOM'; count: number }
  /** Madame de Trémaine — Je ne reviens jamais sur ma parole : mélange sa défausse
   *  Fatalité avec sa pioche Fatalité pour en former une nouvelle. */
  | { type: 'RESHUFFLE_FATE_DISCARD' }
  /** 00:00 : le joueur choisit une couleur, lance le dé ; si match, ramasse une clé
   *  de cette couleur sur le plateau (pendingColorChoice puis dé auto). */
  | { type: 'CHOOSE_COLOR_ROLL_TAKE_KEY' }
  /** Trop facile : perd une clé au choix (→ plateau) puis gagne `power` Pouvoir. */
  | { type: 'LOSE_KEY_GAIN_POWER'; power: number }
  /** Plus qu'une minute : perd une clé au choix (→ plateau) puis pioche `draw`. */
  | { type: 'LOSE_KEY_DRAW'; draw: number }
  /** Répondez ! : gagne 1 Pouvoir par couleur de clé DIFFÉRENTE possédée. */
  | { type: 'GAIN_POWER_PER_KEY_COLOR' }
  /** Misérable cloporte : pioche autant de cartes Méchant que l'adversaire a défaussé
   *  ce tour (activeDiscardedCount). */
  | { type: 'DRAW_PER_OPPONENT_DISCARD' }
  /** Peste : le prochain tour de l'adversaire actif est plafonné à `actions` action(s). */
  | { type: 'CAP_OPPONENT_NEXT_TURN'; actions: number }
  /** Manque de temps : défausse toute la main puis pioche `draw` cartes. */
  | { type: 'DISCARD_HAND_DRAW'; draw: number }
  /** Carte Temps : au PROCHAIN tour, une action pourra être effectuée 2 fois
   *  (repeatActionNextTurn → repeatActionAvailable au début du tour). */
  | { type: 'GRANT_REPEAT_ACTION_NEXT_TURN' }
  /** Anne de Chantraine (à la pose) : la cible (le Seigneur) défausse toutes ses
   *  cartes en main du type `cardType`. */
  | { type: 'TARGET_DISCARD_ALL_OF_TYPE'; cardType: CardType }
  /** Baron Samedi (à la pose) : lance le dé ; tant qu'il est présent, le Seigneur ne
   *  peut pas gagner de clé de cette couleur AU DÉ (dieBlockedColor). */
  | { type: 'ROLL_DIE_BLOCK_KEY_COLOR' }
  /** Gévaudan (à la pose) : vole 1 clé possédée au Seigneur (rattachée au Héros hôte). */
  | { type: 'STEAL_KEY_TO_HERO' }
  /** Gévaudan (à la mort) : rend au Seigneur les clés volées (attachées à ce Héros). */
  | { type: 'RETURN_STOLEN_KEYS' }
  /** J'ai affronté mon cauchemar ! : lance le dé ; le Seigneur perd toutes ses clés
   *  de la couleur obtenue (→ plateau). */
  | { type: 'ROLL_DIE_LOSE_KEYS_COLOR' }
  /** Sorcellerie : remet une clé possédée par le Seigneur sur un lieu (auto :
   *  une couleur unique pour faire le plus de dégât, sur un lieu éloigné). */
  | { type: 'RETURN_OWNED_KEY_TO_BOARD' }
  /** Duel : reprend toutes les clés du plateau et les redistribue aléatoirement,
   *  équilibrées sur chaque lieu (les clés possédées restent au Seigneur). */
  | { type: 'REDISTRIBUTE_BOARD_KEYS' }
  /** Plaisir ou souffrance : le Seigneur choisit — perdre `power` Pouvoir OU reposer
   *  une clé (pendingPlaisir ; bot : le moindre mal). */
  | { type: 'PLAISIR_OU_SOUFFRANCE'; power: number }
  /** Cruella — Quels idiots ! : au CHOIX, déplacer un Allié sur le lieu du pion OU
   *  chercher un Allié (pioche/défausse) → main puis remélanger. Ouvre le choix
   *  (pendingQuelsIdiots) avec sous-choix de l'Allié. */
  | { type: 'QUELS_IDIOTS' }
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
  /** Gagne `amount` pouvoir par Héros présent dans le royaume (Magnifiques Taxes).
   *  `atPawn` : ne compte que les Héros du lieu du pion (Gul'dan — Sceptre de Sargeras). */
  | { type: 'GAIN_POWER_PER_HERO_IN_REALM'; amount: number; atPawn?: boolean }
  /** Team Rocket — Togepi (Fatalité) : RETIRE `amount` pouvoir à l'acteur par Héros
   *  présent dans son royaume (plancher 0). `max` : perte totale plafonnée (Tabbou — Mario). */
  | { type: 'LOSE_POWER_PER_HERO_IN_REALM'; amount: number; max?: number }
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
  | { type: 'USE_COVERED_ACTIONS_THIS_TURN'; includeFire?: boolean; exceptFate?: boolean }
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
  /** Ouvre une action « Éliminer un Héros » FACULTATIVE (fenêtre pendingTrapVanquish,
   *  source 'duncan') si au moins un Héros est présent dans le royaume — le joueur
   *  choisit le Héros et les Alliés, ou passe. Sa Sucrerie — Duncan et Wynnchel
   *  (« joué ou déplacé »). Sans effet s'il n'y a aucun Héros. */
  | { type: 'OPTIONAL_FREE_VANQUISH' }
  /** Déplace librement un Allié (ctx.allyMove.instanceId) vers n'importe quel
   *  lieu (ctx.allyMove.to) — sans contrainte d'adjacence. Tendre un Piège. */
  | { type: 'MOVE_ALLY_FREELY' }
  /** Au prochain tour, le déplacement n'est pas obligatoire. Disparition. */
  | { type: 'GRANT_SKIP_NEXT_MOVE' }
  /** Met en attente un déplacement de Héros vers un lieu voisin : l'acteur choisit
   *  un de SES Héros et un lieu adjacent (Apparition). `optional` (Co‑Pilote — « Vous
   *  pouvez déplacer un Héros ») : le déplacement peut être décliné (skip). */
  | { type: 'RELOCATE_HERO_ADJACENT'; optional?: boolean }
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
  /** Madame de Trémaine — Je ne reviens jamais : mélange la défausse Fatalité dans la
   *  pioche Fatalité, puis l'acteur regarde les `count` premières cartes et les replace
   *  dans l'ordre de son choix sur le dessus (pendingFateReorder). */
  | { type: 'RESHUFFLE_FATE_THEN_REORDER'; count: number }
  /** L'acteur peut défausser N'IMPORTE QUEL nombre de cartes de sa main (choix
   *  interactif, 0 inclus), puis pioche jusqu'à avoir `handLimit` cartes en main.
   *  Madame de Trémaine : J'allais oublier un détail. `label` = source (journal). */
  | { type: 'DISCARD_ANY_THEN_REFILL'; handLimit: number; label?: string }
  /** Demande à l'acteur un type de carte (Événement/Objet), puis dévoile les
   *  `count` premières cartes de sa pioche : ajoute la 1ʳᵉ du type choisi à sa
   *  main et défausse les autres. Slenderman : Tombée de la nuit. */
  | { type: 'CHOOSE_TYPE_REVEAL_DRAW'; count: number }
  /** Demande à l'acteur un type parmi `types` (2 options), puis dévoile sa pioche
   *  JUSQU'À trouver une carte de ce type : il l'ajoute à sa main et défausse les
   *  autres dévoilées. Jafar : Prédiction (Objet / Allié). `excludePiratage` : une
   *  carte de Piratage/IEM ne compte PAS comme « Objet » (Sombra — Glitch : les
   *  Piratages comptent comme Objets pour l'adversaire, pas pour Sombra elle-même). */
  | { type: 'REVEAL_UNTIL_TYPE'; types: CardType[]; excludePiratage?: boolean }
  /** Active la récompense Apparence de Dragon (+3 JT si fatalisé avant son prochain tour). */
  | { type: 'ARM_DRAGON_FORM_REWARD' }
  /** Élimine instantanément le Héros cible (ctx.targetHeroId) si sa force est
   *  ≤ maxStrength. Sans alliés. Apparence de Dragon. `atPawn` : exige en plus que
   *  le Héros soit sur le lieu du pion de l'acteur (Jafar : Ah, je suis un serpent ?).
   *  `onlyCardIds` : restreint les cibles à ces `cardId` précis (Madame de Trémaine —
   *  Sale voleuse ! ne vise que Cendrillon / Cendrillon en robe de bal). La carte est
   *  alors injouable si aucun de ces Héros n'est dans le royaume. */
  | { type: 'INSTANT_VANQUISH_HERO_LE'; maxStrength: number; atPawn?: boolean; onlyCardIds?: string[] }
  /** Élimine instantanément TOUS les Héros du royaume de l'acteur, sans exception ni
   *  choix (sans alliés). Madame de Trémaine — Douze coups de minuit. Injouable si le
   *  royaume ne contient aucun Héros. */
  | { type: 'INSTANT_VANQUISH_ALL_HEROES' }
  /** Rassemble TOUTES les copies des Objets Fatalité dont le `cardId` ∈ `cardIds`
   *  (pioche + défausse Fatalité + plateau, en les détachant) et les pose, non associées,
   *  sur `locationId` (défaut : lieu du pion) du royaume de l'acteur. Madame de Trémaine —
   *  Douze coups de minuit : ramène les deux Pantoufles de Verre après le board-wipe. */
  | { type: 'FETCH_FATE_ITEMS_TO_REALM'; cardIds: string[]; locationId?: LocationId }
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
  /** Atelier — bascule la FACE d'un lieu transformable (échange name/actions avec la
   *  face alternative). `to` : 'a' | 'b' | 'toggle' (sens au choix de la carte).
   *  `atPlayedLocation` : cible le LIEU OÙ LA CARTE EST JOUÉE (le lieu du pion), pour une
   *  carte « jouée sur un lieu pour le transformer » (ex. Gul'dan — Corruption). Dans ce
   *  cas `locationId` est ignoré/optionnel. */
  | { type: 'SWITCH_LOCATION_VERSION'; locationId?: LocationId; to: 'a' | 'b' | 'toggle'; atPlayedLocation?: boolean }
  /** Gul'dan — Ouverture de la Porte des Ténèbres : victoire immédiate. Ne réussit (et
   *  la carte n'est jouable) que si les 3 conditions sont réunies : pion sur la Porte
   *  des Ténèbres (dernier lieu), les 4 lieux corrompus (face B), et les 4 Artéfacts
   *  possédés (joués). */
  | { type: 'DARK_PORTAL_WIN' }
  /** Gul'dan — Corruption : quand au moins `count` lieux sont corrompus (face B),
   *  déverrouille le DERNIER lieu du royaume (la Porte des Ténèbres, verrouillée au départ). */
  | { type: 'UNLOCK_LAST_LOCATION_IF_CORRUPTED'; count: number }
  /** Atelier — bascule l'OBJECTIF actif (remplace condition + description + image de
   *  plateau par la face alternative). `to` : 'a' | 'b' | 'toggle'. */
  | { type: 'SWITCH_OBJECTIVE'; to: 'a' | 'b' | 'toggle' }
  /** Jafar — Lampe Merveilleuse : cherche un Héros (`heroCardId`) dans le deck
   *  Fatalité de l'acteur lui-même et le pose sur SON board au lieu `locationId`. */
  | { type: 'SUMMON_FATE_HERO_TO_OWN_REALM'; heroCardId: string; locationId: LocationId }
  /** Déplace l'Allié (`cardId`) du royaume de l'acteur vers le lieu HÔTE de la carte
   *  qui déclenche l'effet (ctx.hostLocationId). Madame de Trémaine — Pataud (onPlace) :
   *  attire Lucifer sur son lieu. Sans effet si l'Allié n'est pas en jeu / déjà là. */
  | { type: 'MOVE_ALLY_TO_HOST'; cardId: string }
  /** Mère Gothel — Maximus (onPlace) : le joueur qui pose la Fatalité peut déplacer
   *  une carte Cavaliers du roi (lieu voisin) PUIS déplacer Maximus (lieu voisin).
   *  Ouvre `pendingMaximus` (phases « cavaliers » → « maximus »). */
  | { type: 'MAXIMUS_RELOCATE' }
  /** Madame de Trémaine — La Clé (pose) : déplace le Héros nommé `heroCardId` (Cendrillon),
   *  s'il est dans le royaume, vers `locationId` (sa Chambre) et le piège (jeton Enfermé).
   *  Sans effet si le Héros n'est pas en jeu. */
  | { type: 'MOVE_NAMED_HERO_TO_AND_TRAP'; heroCardId: string; locationId: LocationId }
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
  /** Reine de Cœur — Le Chafouin (Fatalité, à la pose) : retransforme jusqu'à `max`
   *  ARCEAUX de la cible en Cartes Gardes (recul d'objectif). Auto-résolu (choix du
   *  fataliseur), un arceau par lieu pour maximiser les cases perdues. */
  | { type: 'REVERT_WICKETS'; max: number }
  /** Jafar — Sacrifice Nécessaire : défausse l'Allié ou l'Objet du royaume désigné
   *  par ctx.allyInstanceIds[0] (+ ses Objets associés si c'est un Allié), puis
   *  gagne `amount` Pouvoir. */
  | { type: 'DISCARD_OWN_FOR_POWER'; amount: number }
  /** Jafar — Hypnose : prend le contrôle du Héros cible (ctx.targetHeroId) du
   *  royaume de l'acteur. Le marque `hypnotized` : il compte alors comme un Allié
   *  (force inchangée) et ne recouvre plus les actions. Coût (= force du Héros)
   *  prélevé à la pose, hors de cet effet. */
  | { type: 'HYPNOTIZE_HERO' }
  /** Isabella — AMOUR : un Héros du royaume « aime » Isabella (choix interactif via
   *  pendingGrantLove ; le bot auto-résout). Il devient un ALLIÉ (zone basse), capacités
   *  annulées sauf sa clause « Amour ». Sans Héros aimable (non déjà aimé) : aucun effet. */
  | { type: 'GRANT_LOVE' }
  /** Isabella — Fatalité (Maman est un ennemi / Évasion) : un Héros qui aime Isabella
   *  cesse de l'aimer (redevient un Héros) — auto : le plus fort des Héros aimés. Sans
   *  Héros aimé : aucun effet. */
  | { type: 'UNGRANT_LOVE' }
  /** Isabella — INCENDIE (Fatalité) : arme le blocage des Activités « à la prochaine heure »
   *  (pose `incendiePending` sur la cible). Sans effet si Phil aime Isabella (immunité). */
  | { type: 'INCENDIE' }
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
  /** La Bonne Fée — Nettoyage de fond : défausse (vers la pile Fatalité) TOUS les Héros
   *  transformés du royaume de l'acteur — ceux portant un Objet `zeroesHostStrength`
   *  (Héros en Meuble / en Colombe) — avec leurs Objets associés. Auto (pas de choix). */
  | { type: 'DISCARD_TRANSFORMED_HEROES' }
  /** La Bonne Fée — On est presque arrivé ? (Fatalité) : plafonne le PROCHAIN tour de
   *  l'acteur (la cible de la Fatalité) à `actions` actions (réutilise actionsCapNextTurn). */
  | { type: 'CAP_SELF_NEXT_TURN'; actions: number }
  /** La Bonne Fée — Infiltration (Fatalité) : l'acteur doit défausser une carte OU perdre
   *  `lose` Pouvoir. Auto (malus subi) : garde sa main et perd le Pouvoir si possible,
   *  sinon défausse une carte (la moins coûteuse). */
  | { type: 'DISCARD_ONE_OR_LOSE'; lose: number }
  /** La Bonne Fée — Réserve de potions : cherche une Potion (`isPotion`) dans la pioche
   *  OU la défausse et l'ajoute à la main (auto : la potion manquante, défausse d'abord). */
  | { type: 'FETCH_POTION' }
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
  | { type: 'GAIN_POWER_PER_TYPE_IN_DISCARD'; cardType: CardType; amount: number; cardTypes?: CardType[]; cap?: number }
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
   *  Variante NON interactive de REVEAL_UNTIL_TYPE (un seul type, pas de choix).
   *  `keepOthersOnTop` (Team Rocket — James) : remet les autres dévoilées sur le
   *  DESSUS de la pioche (ordre conservé) au lieu de les défausser. */
  | { type: 'REVEAL_VILLAIN_UNTIL_TYPE'; cardType: CardType; keepOthersOnTop?: boolean }
  /** Dr Facilier — Divination : si l'acteur est au Royaume du Vaudou, mélange sa
   *  Pile de l'Au-delà et révèle `count` cartes (2 si Mama Odie est dans son
   *  royaume), puis l'acteur résout leurs effets Au-delà dans l'ordre de son choix
   *  (pendingDivination). Hors du Royaume du Vaudou : sans effet. */
  | { type: 'DIVINATION'; count: number }
  /** Dr Facilier (Fatalité, résolu sur la CIBLE = Facilier) — L'étoile du soir :
   *  place un Allié du royaume (auto : le plus fort) dans la Pile de l'Au-delà. */
  | { type: 'FATE_ALLY_TO_AUDELA' }
  /** Oogie Boogie (Fatalité, résolu sur la CIBLE = Oogie) — Diversion : déplace un Héros
   *  vers un lieu voisin, puis défausse un Allié/Objet du lieu d'arrivée. */
  | { type: 'DIVERSION' }
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
  | { type: 'LOOK_TOP_DRAW_DISCARD'; look: number; take: number; title?: string; returnToDeck?: boolean }
  /** Ratigan — Liste de Fidget : dévoile les cartes de la pioche de l'acteur une à
   *  une jusqu'à en trouver une du type `cardType` (Objet). Cette carte rejoint sa
   *  main, les AUTRES cartes dévoilées sont défaussées. Toutes les cartes dévoilées
   *  sont montrées au joueur (pendingReveal). `title` : titre du modal d'info. */
  | { type: 'REVEAL_DECK_UNTIL_TYPE'; cardType: CardType; title?: string; cardTypes?: CardType[]; keepOnTop?: boolean }
  /** Sa Sucrerie — Aigre Bill (joué OU déplacé) : ouvre le choix FACULTATIF de fouiller
   *  la pioche Méchant (dévoiler jusqu'à un Allié → main, réordonner le reste sur le
   *  dessus). Sans Allié dans la pioche+défausse → aucun effet. */
  | { type: 'AIGRE_BILL_DIG' }
  /** Dr Facilier — Désespoir : prend une carte de la Pile de l'Au-delà (auto :
   *  carte clé en priorité) et l'ajoute à la main de l'acteur. */
  | { type: 'TAKE_FROM_AUDELA_TO_HAND' }
  /** Dr Facilier — Terreur : le joueur CHOISIT une carte d'un des `types` (Allié ou
   *  Événement) dans sa défausse et l'ajoute à sa main (ouvre pendingRecover ; bot :
   *  auto-pick). `label` : titre de la modale de choix. */
  | { type: 'RECOVER_TYPE_FROM_DISCARD'; types: CardType[]; label?: string }
  /** Isabella — Activité : VALIDE l'heure courante de l'horloge (ajoute l'index à
   *  `validatedHours`). Placé en tête des `effects` d'une Activité ; les bonus suivent. */
  | { type: 'VALIDATE_HOUR' }
  /** Isabella — RADAR DE POCHE (capacité activée) : ce tour-ci les Activités sont jouables
   *  à toute heure ; EN CONTREPARTIE, pioche dans la pioche Fatalité jusqu'à un Héros, le
   *  joue sur un lieu au choix (pendingFateHeroPlace) et défausse les autres cartes piochées. */
  | { type: 'RADAR_POCHE' }
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
  /** Bowser — Te revoilà ! / Mère Gothel — Ce qu'il m'a pris : ouvre le choix
   *  (pendingRecover) d'une carte QUELCONQUE de la défausse à reprendre en main.
   *  `label` : titre affiché (log/showcase) ; défaut « Te revoilà ! ». */
  | { type: 'RECOVER_ANY_FROM_DISCARD'; label?: string; count?: number; optional?: boolean }
  /** Bowser — Vol du château : dévoile la pioche jusqu'à un Allié ou un Objet, le
   *  joue gratuitement sur le lieu du pion, et remet les autres cartes dévoilées
   *  sur le dessus de la pioche (ordre conservé). */
  | { type: 'REVEAL_UNTIL_PLAY_ALLY_OR_ITEM' }
  /** Bowser — Comète farceuse (Fatalité) : défausse un Objet du royaume de la
   *  cible (auto : un Objet non associé). */
  | { type: 'DISCARD_ONE_ITEM' }
  /** Team Rocket — Onix (Pokémon Fatalité, à la pose) : défausse un Allié OU un Objet
   *  du royaume de la cible (auto : le plus « précieux » — force d'Allié ou coût d'Objet).
   *  `onlyType` restreint aux Alliés OU aux Objets (Le Flagelleur Mental — CHALEUR :
   *  Alliés seulement) ; `cardName` = libellé pour le journal/la modale (défaut « Onix »). */
  | { type: 'DISCARD_ALLY_OR_ITEM'; onlyType?: 'ally' | 'item'; cardName?: string }
  /** Team Rocket — Évolution : fait évoluer un Allié du royaume (choix interactif via
   *  `pendingEvolveAlly`). L'Allié choisi est défaussé, son évolution cherchée et posée
   *  sur le même lieu. */
  | { type: 'EVOLVE_ALLY' }
  /** Team Rocket — « Oui, la guerre ! » : couche (K.O.) un Pokémon de force ≥ `minStrength`
   *  du royaume (auto : le plus fort), gratuitement — il devient attrapable. */
  | { type: 'KO_POKEMON_GE'; minStrength: number }
  /** Team Rocket — Stari (Pokémon Fatalité, à la pose) : déplace un Allié du royaume vers
   *  un lieu voisin (auto : le 1ᵉʳ Allié déplaçable). « Vous pouvez » → no-op si rien. */
  | { type: 'MOVE_OWN_ALLY_ADJACENT' }
  /** Team Rocket — « On n'abandonne pas ses amis » (Fatalité) : reprend un Pokémon CAPTURÉ
   *  de force ≤ `maxStrength` (auto : le plus fort éligible) et le remet sur le dessus de la
   *  pioche Fatalité. Ne fonctionne qu'une fois par Pokémon (`noReturnFromCapture`). */
  | { type: 'UNCAPTURE_POKEMON_LE'; maxStrength: number }
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
   *  dans la pioche/défausse Fatalité et la joue immédiatement. `locationId` : lieu
   *  de pose imposé (Gaston — Miroir magique : la Bête au Château de la Bête) ;
   *  défaut = la Maison des Nains (Méchante Reine). */
  | { type: 'FETCH_FATE_HERO'; heroCardId: string; locationId?: LocationId }
  /** Sa Sucrerie — Médaillon des Héros de Ralph (à la pose) : cherche Ralph la Casse
   *  (pioche/défausse Fatalité), le pose sur le lieu HÔTE du Médaillon en lui associant
   *  le Médaillon, et arme son `onVanquish` (à sa mort → chercher Vanellope sur ce lieu). */
  | { type: 'MEDAILLON_FETCH_RALPH' }
  /** Le Seigneur des Ténèbres — On te tient, valet de ferme ! : choix « chercher
   *  `heroCardId` (Tirelire) et la jouer sur le lieu de son choix » (sans `targetHeroId`)
   *  OU « éliminer un Héros de force ≤ `maxStrength` » (avec `targetHeroId`). */
  | { type: 'PIGKEEPER_RESOLVE'; heroCardId: string; maxStrength: number }
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
  /** La Méchante Reine — Foudre : reproduit l'effet d'un Ingrédient déjà joué.
   *  `zone` = pile source ('ingredients' par défaut ; 'artifacts' pour Gul'dan —
   *  Manipulation). `freeDuplication` : la reproduction est gratuite (Manipulation
   *  paie son coût fixe à la pose) ; sinon le coût = celui de la carte reproduite
   *  (Foudre), payé à la reproduction. */
  | { type: 'DUPLICATE_INGREDIENT'; zone?: 'ingredients' | 'artifacts'; freeDuplication?: boolean }
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
  /** Le joueur perd la moitié de ses jetons Pouvoir. `roundUp` (défaut true) :
   *  arrondi supérieur (Yzma — Mauvais levier) ; false = arrondi inférieur (Pat
   *  Hibulaire — Épuisé). */
  | { type: 'LOSE_HALF_POWER'; roundUp?: boolean }
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
  /** Sa Sucrerie — Mémoire Verrouillée : gagner `power` Pouvoir OU reculer le jeton
   *  Pilote de `racerBack`. Le choix n'est offert que si une course est active (le jeton
   *  Pilote est sur le circuit) ; sinon, on gagne simplement le Pouvoir. */
  | { type: 'POWER_OR_RACER_BACK'; power: number; racerBack: number }
  /** Ratigan — Capture : déplace un Héros du royaume de force ≤ `maxStrength` vers
   *  `locationId` (auto : le Héros éligible le plus fort). Respecte forbiddenLocations. */
  | { type: 'MOVE_REALM_HERO_TO'; maxStrength: number; locationId: LocationId }
  /** Ratigan — Toby (à la pose) : « Vous pouvez déplacer un Héros vers le lieu de
   *  votre choix. » Ouvre `pendingHeroRelocate` (anyLocation, optionnel) avec les
   *  Héros du royaume comme candidats, SAUF Toby lui-même (carte hôte exclue). */
  | { type: 'RELOCATE_REALM_HERO_ANYWHERE' }
  /** Cruella — Capitaine (Fatalité, à la pose) : déplace un Allié du lieu de Capitaine
   *  (ctx.hostLocationId) vers un lieu voisin. Auto (choix du fataliseur) : éloigne
   *  l'Allié le plus précieux (Jasper/Horace) vers le voisin ayant le moins de Tuiles. */
  | { type: 'MOVE_ALLY_FROM_HOST_ADJACENT' }
  /** Ratigan — Cloche : cherche la carte `cardId` (Félicia) dans la pioche ou la
   *  défausse de l'acteur, l'ajoute à sa main, puis remélange sa pioche. */
  | { type: 'TUTOR_CARD_TO_HAND'; cardId: string }
  /** Thanos — met en jeu une PIERRE D'INFINITÉ « libre » (depuis stoneSupply) dans le
   *  domaine d'un adversaire : posée sur son lieu (celui de son pion), associée à un Allié
   *  adverse présent s'il y en a un (sinon au lieu). La Pierre ne peut plus être défaussée
   *  par l'adversaire (`cannotBeDiscarded`). Aucun effet s'il n'y a plus de Pierre libre.
   *  (Consultation du Puits, Fatalité « Découverte d'une Pierre ».) */
  | { type: 'THANOS_SEED_STONE' }
  /** Thanos — Un Modeste Prix à Payer : gagne 1 Pouvoir + 1 par adversaire contrôlant au
   *  moins une Pierre d'Infinité. */
  | { type: 'THANOS_MODEST_PRICE' }
  /** Thanos — Nebula (Fatalité, onPlace, résolu SUR Thanos) : Thanos défausse 1 Pouvoir par
   *  Pierre qu'il détient (Compétences) ; Nebula (hôte) gagne autant de jetons Force +1. */
  | { type: 'THANOS_NEBULA_DRAIN' }
  /** Thanos — Quel qu'en Soit le Prix (Fatalité) : Thanos défausse de sa main 1 carte par
   *  Pierre d'Infinité qu'il contrôle (Compétences). Auto : les moins chères d'abord. */
  | { type: 'THANOS_WHATEVER_IT_TAKES' }
  /** Thanos — Proxima Minuit (Allié, onPlace) : élimine un Héros de force EFFECTIVE ≤ 3 sur
   *  son lieu (auto : le plus faible éligible). Aucun Héros éligible → aucun effet. */
  | { type: 'THANOS_PROXIMA_ELIMINATE' }
  /** Thanos — Gamora (Fatalité, onPlace SUR Thanos) : élimine un Allié de Thanos sur le lieu
   *  de Gamora (auto : le plus fort) ; Gamora gagne alors 2 jetons Force +1. Sans Allié, rien. */
  | { type: 'THANOS_GAMORA_ELIMINATE' }
  /** Thanos — Pierre du Pouvoir (activation) : pose `amount` jetons Force +1 sur l'Allié le
   *  plus fort du contrôleur (auto). Sans Allié, aucun effet. */
  | { type: 'THANOS_STONE_ADD_FORCE'; amount: number }
  /** Thanos — Sentence : transfère jusqu'à `count` Alliés de Thanos sur un lieu adverse
   *  portant une Pierre (auto : le 1er lieu à Pierre, les Alliés les plus forts), puis pose
   *  1 jeton Force +1 sur chacun. Sans Pierre en jeu ni Allié, aucun effet. */
  | { type: 'THANOS_TRANSFER_TO_STONE'; count: number }
  /** Ratigan — Basil (Fatalité, à la pose) : défausse un Objet non associé du lieu
   *  hôte (auto : `preferCardId` — la Reine Robot — en priorité, sinon le plus cher).
   *  Défausser la Reine Robot bascule l'objectif de Ratigan côté « Le Rat ».
   *  `excludePiratage` : ignore les Piratages/IEM (Sombra — Zarya ne détruit qu'un
   *  vrai Objet, pas une carte de Piratage). */
  | { type: 'DISCARD_ITEM_AT_HOST'; preferCardId?: string; excludePiratage?: boolean }
  /** Ratigan — Félicia (à la pose) : défausse un Héros du lieu hôte (auto : le plus
   *  À la pose, le joueur DOIT soit défausser un Allié de son lieu (ctx.allyInstanceIds[0]),
   *  soit payer `power` jetons Pouvoir de plus (géré dans applyPlayCard). Injouable si
   *  aucune des deux options n'est possible. L'effet ne réalise QUE la défausse (le
   *  supplément est prélevé au paiement du coût) ; no-op si l'option « payer » est choisie. */
  | { type: 'DISCARD_ALLY_AT_HOST_OR_PAY'; power: number }
  /** Le Flagelleur Mental — Tunnel de Hawkins (à la pose) : coût additionnel = défausser
   *  `baseAllies` Alliés du royaume (+1 si un Héros `surchargeHeroCardId` — Onze — est
   *  présent), choisis via `ctx.allyInstanceIds` (Billy `cannotDiscardForTunnel` exclu).
   *  Puis, si la pose porte le nombre de `tunnelCardId` du royaume à `rewardAtCount`,
   *  gagne `rewardPower` Pouvoir (une fois, en atteignant le seuil). */
  | {
      type: 'FLAYER_PLACE_TUNNEL'
      baseAllies: number
      surchargeHeroCardId: string
      tunnelCardId: string
      rewardAtCount: number
      rewardPower: number
    }
  /** Le Flagelleur Mental — THE FLAYED (à la pose, AVANT placement) : si le royaume
   *  atteint `count` exemplaires de `flayedCardId` (celui-ci compris), pose le latch de
   *  déblocage du lieu `locationId` (Monde à l'Envers) et le déverrouille — sauf si WILL
   *  BYERS (`willCardId`) est présent (il le re-verrouille). */
  | { type: 'FLAYER_FLAYED_UNLOCK'; flayedCardId: string; count: number; locationId: LocationId; willCardId: string }
  /** Le Flagelleur Mental — WILL BYERS (onPlace) : re-verrouille `locationId` tant qu'il
   *  est présent. */
  | { type: 'FLAYER_GATE_LOCK'; locationId: LocationId }
  /** Le Flagelleur Mental — WILL BYERS (onVanquish) : à son départ, redéverrouille
   *  `locationId` si le latch de déblocage est posé et qu'aucun autre WILL BYERS
   *  (`willCardId`) n'est présent. */
  | { type: 'FLAYER_GATE_REFRESH'; locationId: LocationId; willCardId: string }
  /** Le Flagelleur Mental — BILLY SOUS EMPRISE (capacité activée) : cherche le Héros
   *  `heroCardId` (Onze) dans la pioche/défausse Fatalité et le pose dans le royaume, sur
   *  le lieu de Billy (`ctx.hostLocationId`). Bloqué tant que `blockerHeroCardId` (Max) est
   *  présent (double-garde ; l'activation est déjà exclue par activatableCards). */
  | { type: 'FLAYER_FETCH_ONZE'; heroCardId: string; blockerHeroCardId: string }
  /** Le Flagelleur Mental — WILL SOUS EMPRISE : regarde les `count` premières cartes de sa
   *  pioche Méchant et les réordonne (réutilise pendingFateReorder deck:'villain', UI + auto
   *  bot). NB : l'option « ou deck Fatalité (+1 Pouvoir) » reste à ajouter (couche de choix). */
  | { type: 'FLAYER_WILL_SCRY'; count: number }
  /** Ratigan — Piège ingénieux : élimine TOUS les Héros du lieu `locationId` (sans
   *  Allié, comme un Vanquish gratuit) : restitue leur Pouvoir verrouillé, déclenche
   *  leurs effets « à la mort », et pose le drapeau de victoire si Basil est éliminé
   *  côté « Le Rat ». */
  | { type: 'ELIMINATE_ALL_HEROES_AT'; locationId: LocationId }
  /** Ratigan — Brutes (à la pose) : si l'Allié est joué sur un lieu où le pion n'est
   *  PAS, le joueur peut effectuer UNE action disponible de ce lieu, hors Fatalité
   *  (fenêtre `actAtLocation` skippable, comme « Suivez-moi ! » / la Canne).
   *  `includeCovered` (Team Rocket — Smogogo) : autorise aussi les actions RECOUVERTES. */
  | { type: 'ALLY_REMOTE_ACTION'; includeCovered?: boolean }
  /** Pat Hibulaire — Une Petite Partie ? : révèle les `reveal` premières cartes
   *  Méchant de la pioche, gagne la somme de leur coût (−1 si un Héros
   *  `reducerHeroCardId` (Oswald) est présent), puis les défausse. Si le gain ≥ 4 et
   *  que la tuile Win Big est sur le lieu du pion, elle est complétée (victoire si
   *  c'est la 4ᵉ). */
  | { type: 'PLAY_A_GAME'; reveal: number; reducerHeroCardId?: string }
  /** Pat Hibulaire (Fatalité ciblant Pat) — révèle une de ses tuiles Objectif face
   *  cachée (auto : la première non révélée). Effet d'affichage seulement. */
  | { type: 'REVEAL_PETE_GOAL' }
  /** Pat Hibulaire (Fatalité) — Planqués : défausse un Allié de `cardId` (Bandit) du
   *  royaume de la cible (auto : le premier trouvé). */
  | { type: 'DISCARD_ALLY_BY_CARDID'; cardId: string }
  /** Pat Hibulaire (Fatalité) — Assommé Bêtement : dévoile les `count` premières
   *  cartes Méchant de la cible, défausse celles de coût ≥ `minCost`, remélange les
   *  autres et les replace sur le dessus de sa pioche. */
  | { type: 'FATE_SCRY_DISCARD_BY_COST'; count: number; minCost: number }
  /** Pat Hibulaire (Fatalité) — Minnie (à la pose) : défausse un Allié OU un Objet
   *  (non associé) du royaume de la cible (auto : le plus fort / le plus cher). */
  /** Défausse l'Allié le plus fort, à défaut l'Objet le plus cher (Minnie). `onlyType`
   *  restreint la cible (Sweet Nightingale → 'ally' ; Jaq → 'item') ; `preferCardIds`
   *  privilégie certaines cibles (Jaq → Cloches/Canne). */
  | { type: 'FATE_DISCARD_STRONGEST_ALLY_OR_ITEM'; onlyType?: 'ally' | 'item'; preferCardIds?: string[]; maxStrength?: number }
  /** Madame de Trémaine — Bibbidi-Bobbidi-Boo : retire le jeton « piégé » d'un Héros
   *  du royaume de la cible (il redevient actif). Sans Héros piégé, aucun effet. */
  | { type: 'UNTRAP_HERO' }
  /** Pat Hibulaire (Fatalité) — Pluto (à la pose) : déplace un Objet (non associé)
   *  du royaume de la cible vers le lieu hôte (auto : le premier trouvé ailleurs). */
  | { type: 'FATE_MOVE_ITEM_TO_HOST' }
  /** Pat Hibulaire — Attaque Aérienne : déplace le pion sur un lieu portant un Héros
   *  (auto : le plus fort) et l'élimine sans Allié ; puis plus aucune autre action
   *  ce tour-ci (soleActionLock). */
  | { type: 'AIR_STRIKE' }
  /** Pat Hibulaire — Cheval (`beneficial: true`, déplacement utile pour Pat) /
   *  Horace (Fatalité, `beneficial: false`, déplacement perturbateur par l'adversaire) :
   *  déplace un Allié OU un Objet (non associé) du royaume vers n'importe quel lieu.
   *  Résolu automatiquement par une heuristique d'objectif (vers / hors d'une tuile). */
  | { type: 'MOVE_ALLY_OR_ITEM_SMART'; beneficial: boolean }
  /** Pat Hibulaire — Sournois : pioche `draw` cartes Méchant, puis replace 1 carte
   *  de la main sur le dessous de la pioche (auto : la plus chère). */
  | { type: 'DRAW_THEN_BOTTOM'; draw: number }
  /** Pat Hibulaire — Dingo (Fatalité, à la pose) : perturbe les tuiles Objectif de
   *  la cible — déplace une tuile non remplie vers un lieu voisin libre, ou l'échange
   *  avec une tuile voisine (auto). */
  | { type: 'FATE_DISTURB_GOAL' }
  // ── Grand Councilwoman (capture de STITCH) ───────────────────────────────
  /** ENFERMÉ : associe le Héros `heroCardId` (STITCH) à l'Objet `itemCardId` (la CAGE)
   *  s'ils se trouvent sur le même lieu (attachedTo = la CAGE). Le Héros devient alors
   *  « transporté » par la CAGE (il la suit quand elle est déplacée). Sans effet /
   *  injouable s'ils ne sont pas co-localisés (garde-fou moteur). */
  | { type: 'ATTACH_HERO_TO_ITEM'; heroCardId: string; itemCardId: string }
  /** EN LIBERTÉ (Fatalité) : au choix — LIBÈRE le Héros `heroCardId` (STITCH) de l'Objet
   *  auquel il est associé (le détache de la CAGE) OU déplace un Héros vers un lieu voisin.
   *  Auto-résolu par le lanceur : libère STITCH s'il est enfermé, sinon relocalise un Héros. */
  | { type: 'FREE_HERO_OR_RELOCATE'; heroCardId: string }
  /** ALOHA (Fatalité) : au choix — TRANSFORME un Allié de `allyCardIds` (Dr Jumba / Peakley)
   *  présent dans le royaume de la cible en Héros Fatalité (garde sa force, recouvre les
   *  actions, contrôlé par l'adversaire) OU déplace un Héros vers un lieu voisin. Auto
   *  (lanceur) : transforme l'Allié le plus fort disponible, sinon relocalise un Héros. */
  | { type: 'TRANSFORM_ALLY_OR_RELOCATE'; allyCardIds: string[] }
  /** RAPPORT : dévoile la pioche Méchant JUSQU'À une carte de type `cardType`, la JOUE
   *  gratuitement (placement interactif), défausse les autres cartes dévoilées.
   *  Généralise REVEAL_UNTIL_ALLY_PLAY_FREE à un type de carte quelconque. */
  | { type: 'REVEAL_UNTIL_TYPE_PLAY_FREE'; cardType: CardType }
  /** CAPITAINE GANTU : (facultatif) choisir une carte de sa défausse Méchant et la JOUER
   *  gratuitement (placement interactif). Sans effet si la défausse est vide. */
  | { type: 'PLAY_FROM_DISCARD_FREE' }
  /** BOUTEILLE MORDUE (Fatalité) : défausse OU déplace un Objet (non associé) du royaume
   *  de la cible. Auto (lanceur) : défausse l'Objet le plus gênant, à défaut le déplace. */
  | { type: 'FATE_DISCARD_OR_MOVE_ITEM' }
  /** STITCH EN VUE / ATTRAPÉ : dévoile la pioche Fatalité JUSQU'AU 1er Héros, DÉFAUSSE les
   *  autres cartes dévoilées, puis pose le Héros. S'il porte `forcedFateLocation` (STITCH →
   *  Maison de Lilo), il y est posé d'office ; sinon le joueur choisit le lieu (pendingFetchedHero).
   *  `mustPlay` (STITCH EN VUE : « Jouez-le ») force la pose ; sans lui (ATTRAPÉ : « Jouez-le
   *  ou défaussez-le ») le joueur peut défausser le Héros. */
  | { type: 'REVEAL_FATE_UNTIL_HERO_CHOICE'; mustPlay?: boolean }
  // ── Michael Myers (Halloween) ─────────────────────────────────────────────
  /** Gardons le meilleur pour la fin : déverrouille `locationId` (Demeure des Strode), y
   *  pose LAURIE (Héros hors-deck de `reserveHeroes`), puis va chercher une Arme dans la
   *  pioche/défausse et la joue GRATUITEMENT (pendingRecover free-play). Requiert Mal
   *  Intérieur niveau 3 (garde-fou de jouabilité). */
  | { type: 'MICHAEL_KEEP_BEST'; locationId: LocationId }
  /** Arme du crime : va chercher une ARME dans la pioche (et défausse) → choix, ajoutée à
   *  la main (pendingRecover). */
  | { type: 'MICHAEL_FETCH_WEAPON' }
  /** Jouez avec la nourriture : dévoile la pioche Fatalité jusqu'au 1er Héros, le pose sur le
   *  LIEU DU PION, défausse les autres cartes dévoilées. */
  | { type: 'REVEAL_FATE_UNTIL_HERO_AT_PAWN' }
  /** Lumière mourrante : révèle les `count` DERNIÈRES cartes de la pioche Méchant, en garde 1
   *  en main (pendingLookTop), défausse les autres. */
  | { type: 'LOOK_BOTTOM_DRAW'; count: number }
  /** Trophée de chasse : gagne `base` Pouvoir + 1 par palier de Mal Intérieur (1..3). */
  | { type: 'GAIN_POWER_PER_MAL_INTERIEUR'; base: number }
  /** Souvenir de Judith (Fatalité) : perd `base` Pouvoir + 1 par palier de Mal Intérieur. */
  | { type: 'LOSE_POWER_PER_MAL_INTERIEUR'; base: number }
  /** Trace de sang (Objet activé) : CHOIX — gagner `power` Pouvoir OU déplacer un Héros vers
   *  un lieu voisin (pendingBloodTrace). */
  | { type: 'BLOOD_TRACE'; power: number }
  /** Désarmement (Fatalité) : défausse l'Arme équipée du vilain. */
  | { type: 'DISCARD_EQUIPPED_WEAPON' }
  /** Hache de bûcheron (on-kill) : ouvre une action de royaume GRATUITE au choix
   *  (pendingFreeRealmAction). */
  | { type: 'GRANT_FREE_ANY_ACTION' }
  /** Obsession : l'adversaire ne peut pas utiliser l'action Fatalité contre le vilain à son
   *  prochain tour (pose `noFate` + `noFateSkipReset` pour survivre au tour intermédiaire). */
  | { type: 'OBSESSION_BLOCK_FATE' }
  /** Aura effrayante (Condition jouée en réaction) : au DÉBUT du prochain tour du vilain, une
   *  action « Jouer une carte » GRATUITE est accordée (pose `freePlayCardNextTurn`). */
  | { type: 'GRANT_FREE_PLAY_NEXT_TURN' }
  /** Couteau de cuisine (on-kill) : le vilain REJOUE un tour (pose `extraTurn` ; en fin de
   *  tour il rejoue au lieu de passer la main). */
  | { type: 'GRANT_EXTRA_TURN' }
  /** Arme du crime : va chercher une ARME dans la PIOCHE (choix) → l'ajoute à la main OU
   *  paie son coût et l'équipe (pendingWeaponFetch). */
  | { type: 'MICHAEL_FETCH_WEAPON_FROM_DECK' }
  /** Incarnation du mal : mélange la défausse, en révèle les `count` premières cartes, puis
   *  le joueur en garde en main (pendingLookTop) — les autres retournent en défausse. */
  | { type: 'SHUFFLE_DISCARD_REVEAL'; count: number }

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
  /** Objet qui ne peut être associé QU'au Héros de ce cardId (Sa Sucrerie — Bug). */
  attachOnlyCardId?: string
  /** Pour un Objet associé : bonus de force conféré à la carte hôte (recopié de
   *  CardDef). Sommé par effectiveStrength sur tous les Objets associés à une carte. */
  attachStrengthBonus?: number
  /** Objet « bouclier » associé à un Allié (Cruella — Tisonnier) : quand l'Allié
   *  devrait être défaussé, cet Objet est défaussé À SA PLACE et l'Allié survit. */
  shieldAllyFromDiscard?: boolean
  /** Indice IA (recopié de CardDef) : priorité de RETRAIT par une Fatalité de défausse
   *  (Dégonflage / Onix). Plus c'est haut, plus l'auto-résolution vise cet Objet ; non
   *  renseigné = 0 (retombe sur coût/force). Cf. Team Rocket (Mongolfière ≫ Pokéball…). */
  fateRemovalPriority?: number
  /** Capitaine Crochet : Objet qui DONNE une action à son lieu tant qu'il y est
   *  posé (Canon → Vaincre, Boîte à Crochets → Gagner 1, Ingénieux Mécanisme →
   *  Déplacer un Héros). */
  grantsAction?: { type: LocationActionType; amount?: number; label: string }
  /** Madame Mim — Métamorphose Mim (Allié) : ne peut éliminer QUE la Métamorphose de
   *  Merlin (Héros) de ce cardId (garde-fou dans performVanquish). */
  transformationTarget?: string
  /** Madame Mim — drapeaux d'affichage/mécanique : Métamorphose Mim (Allié, deck Méchant)
   *  ou Métamorphose de Merlin (Héros, deck Merlin, posée au Lieu du Duel). */
  isMimTransformation?: boolean
  isMerlinTransformation?: boolean
  /** Oogie Boogie — Prisonnier (Perce-Oreilles) posé à l'Antre au setup. C'est une
   *  carte de type 'hero' mais qui n'est PAS un Héros au sens du jeu : non vaincable,
   *  ignorée par tous les prédicats « Héros » (ciblage Vaincre, comptages, présence,
   *  auras de force). Sert uniquement d'ancre à la pile d'Imposteurs (objectif). */
  isPrisoner?: boolean
  /** Tamatoa — carte de la pioche MAUI (séparée du deck Fatalité au setup). */
  isMauiCard?: boolean
  /** Tamatoa — Chauves-souris à huit yeux : peuvent rejoindre un Allié qu'on vient de jouer. */
  joinsAlliesOnAllyPlay?: boolean
  /** Tamatoa — Monstre Arboricole : déplacer n'importe quelle carte après un Vanquish. */
  moveAnyCardOnVanquish?: boolean
  /** Isabella — Activité : heures (index 0..5 = XII, II, IV, VI, VIII, X) auxquelles cette
   *  carte peut être jouée. Injouable si l'heure courante n'y figure pas. Recopié de CardDef. */
  allowedHours?: number[]
  /** Tamatoa — Hameçon de Maui : gagne N Pouvoir chaque fois que Tamatoa est ciblé par la Fatalité. */
  gainPowerWhenFated?: number
  /** Tamatoa — Maui (Héros) : déclenche la pioche Maui en début de tour tant qu'il est en jeu. */
  triggersMauiDeck?: boolean
  /** Tamatoa — Quelque chose qui brille : protège du Vanquish les Héros de son lieu ;
   *  recouvre les actions comme un Héros ; se défausse quand Tamatoa finit son tour ici. */
  shieldsHeroesAtLocation?: boolean
  coversActionsLikeHero?: boolean
  selfDiscardOnPawnEndTurnHere?: boolean
  /** Bonus de force temporaire « jusqu'à la fin du tour » (Pas de Quartier !).
   *  Remis à zéro à la fin du tour du joueur actif. */
  tempStrengthBonus?: number
  /** Jetons de force PERMANENTS posés sur la carte (Oogie Boogie : jeton Force -1
   *  collé à Jack Skellington par chaque Imposteur joué après son retour). Sommé
   *  par effectiveStrength (peut être négatif). */
  forceTokens?: number
  /** Carte qui ne se joue PAS via une action « Jouer une carte » : elle est jouée
   *  en réaction (Oogie Boogie — Dés pipés : relance un dé pendant un lancer). */
  reactiveOnly?: boolean
  // --- Davy Jones (Jetons Trésor) ------------------------------------------
  /** Jeton Trésor posé sur ce Héros (runtime). `id` = id du trésor (compas-de-jack…),
   *  `faceUp` = révélé (effet actif) ou face cachée. Un Héros n'en porte qu'un. */
  treasure?: { id: string; faceUp: boolean }
  /** Héros (Davy Jones — Jack Sparrow) : tant qu'il est en jeu et que le pion de Davy
   *  est sur SON lieu, Davy ne peut pas faire d'action Éliminer un Héros. */
  blocksVanquishHere?: boolean
  /** Allié (Davy Jones — Le Second Maccus) : utilisé pour un Vanquish, on PEUT défausser
   *  un AUTRE Allié du royaume à sa place (il survit). */
  survivesVanquishByDiscardingAlly?: boolean
  /** Allié (Davy Jones — Le Kraken) : n'est pas défaussé quand il élimine un Héros
   *  porteur d'un jeton Trésor RÉVÉLÉ. */
  survivesVanquishWithRevealedTreasure?: boolean
  /** Allié (Davy Jones — Hadras) : quand il est défaussé, révèle un jeton Trésor
   *  face cachée sur un Héros. */
  revealTreasureOnDiscard?: boolean
  /** Objet Fatalité (Davy Jones — Le Black Pearl) : à la mort de l'hôte, se réassocie
   *  à un autre Héros du lieu. */
  reattachOnHostDefeat?: boolean
  // --- Le Piégeur (Dead by Daylight) ---------------------------------------
  /** Carte SURVIVANT (hors-deck) : posée FACE CACHÉE 1/lieu au setup. Recopié de CardDef. */
  isSurvivor?: boolean
  /** Survivant RÉVÉLÉ (face visible) : recouvre alors les actions comme un Héros.
   *  Absent/false = face cachée (ne recouvre rien, ne peut être attaqué). */
  revealed?: boolean
  /** Survivant — SEGMENT de santé (état) : sain → blessé → critique. `critical` = immobile
   *  (ne fuit plus) et seul état où il peut être mis sur un crochet. Distinct des vies. */
  survivorState?: 'healthy' | 'injured' | 'critical'
  /** Survivant — POINTS DE VIE (3 au départ), perdus UNIQUEMENT sur un crochet
   *  (−1 à l'accrochage, −1 par fin de tour du Piégeur encore accroché). 0 = éliminé. */
  survivorLives?: number
  /** Survivant — accroché à un crochet : immobile, perd 1 vie à chaque fin de tour du
   *  Piégeur. Éliminé à 0 vie (le crochet est alors retiré du jeu). */
  onHook?: boolean
  /** Survivant — accroché CE tour-ci (via Sanctuaire Monstrueux) : la perte de vie « par
   *  tour supplémentaire » de la fin de tour du Piégeur est sautée une fois (le −1 de
   *  l'accrochage a déjà été appliqué). Nettoyé en fin de tour. */
  hookedThisTurn?: boolean
  /** Survivant — immobilisé par un PIÈGE À OURS : saute la fuite tant que > 0
   *  (décrémenté en fin de tour du Piégeur). */
  trapImmobilizedTurns?: number
  // --- Thanos (Pierres d'Infinité) -----------------------------------------
  /** Carte PIERRE D'INFINITÉ (hors deck) : séparée dans `stoneSupply` au setup. Entre
   *  en jeu comme Objet dans le domaine d'un adversaire (association à un Allié adverse ou
   *  au lieu), activable par qui la contrôle ; capturée → devient une Compétence de Thanos. */
  isInfinityStone?: boolean
  /** Allié de THANOS déployé dans le domaine d'un ADVERSAIRE (rangée du haut). Vit sur le
   *  board de l'adversaire mais appartient à Thanos ; sert à capturer une Pierre puis à la
   *  rapatrier (Transférer). Ignoré par les prédicats « Allié adverse » de l'adversaire. */
  thanosAlly?: boolean
  /** Allié (Mâchoire d'Ébène) : non défaussé lorsqu'il élimine chez un adversaire détenant
   *  une Pierre d'Infinité. */
  survivesVanquishVsStoneHolder?: boolean
  // --- Dio Brando (Stands + The World) -------------------------------------
  /** Dio — carte « Stand » : HORS deck (sauf The World). Séparée dans `standPile` au
   *  setup ; n'entre en jeu que par fetch (`FETCH_STAND_ATTACH`) quand sa carte
   *  invocatrice est jouée, puis associée à elle (bonus de force + aura passive). */
  isStand?: boolean
  /** Dio — The World : suit TOUJOURS le pion (déplacé avec lui) et ne peut jamais être
   *  défaussé. */
  followsPawn?: boolean
  cannotBeDiscarded?: boolean
  /** Le Flagelleur Mental — Billy sous emprise : ne peut PAS être défaussé pour payer le
   *  coût en Alliés d'un Tunnel de Hawkins (mais reste défaussable autrement). */
  cannotDiscardForTunnel?: boolean
  /** Dio — carte invocatrice : quand elle entre en jeu (Allié de Dio, ou Héros Joestar
   *  via la Fatalité), elle va chercher ce Stand dans `standPile` et se l'associe. */
  summonsStandCardId?: string
  /** Dio — Héros (Jotaro / Joseph) RETIRÉ DU JEU lorsqu'il est vaincu : il ne va pas en
   *  défausse Fatalité mais dans `removedFromGame` (objectif + déblocage de The World). */
  removedFromGameOnDefeat?: boolean
  /** Effets résolus UNIQUEMENT via l'action « Activer une capacité » (et NON à la pose ni
   *  à l'invocation). Pour les Objets/Stands « Activer » dont le moteur résout l'effet
   *  générique (Dio — La flèche : piocher 4 ; Masque de pierre ; Justice). */
  activatedEffects?: Effect[]
  /** La Bonne Fée — Objet de transformation (Meuble / Colombe) associé à un Héros :
   *  réduit la force EFFECTIVE de l'hôte à 0 et le marque « transformé ». */
  zeroesHostStrength?: boolean
  /** La Bonne Fée — l'Âne : +N au coût de l'action « Activer » sur son lieu. */
  activateCostSurchargeHere?: number
  /** La Bonne Fée — Harold & Lillian : interdit de jouer/déplacer un Objet sur son lieu. */
  blocksAllItemsHere?: boolean
  /** La Bonne Fée — Humainement beau : empêche d'associer à l'hôte un Objet de ces cardId. */
  protectsHostFromCardIds?: string[]
  /** La Bonne Fée — Potion (Filtre d'amour / Heureux pour toujours) : cible de la
   *  « Réserve de potions » (FETCH_POTION) et des 2 potions de l'objectif. */
  isPotion?: boolean
  /** Tabbou — Link : plafonne à N le nombre de tuiles Combattants dévoilables en UN
   *  usage de l'action « Dévoiler une tuile Combattant » tant qu'il est là. */
  fighterRevealCap?: number
  /** Tabbou — Kirby : renchérit de N le coût de l'action « Dévoiler une tuile Combattant ». */
  fighterRevealSurcharge?: number
  /** Tabbou — Canon Obscur : les cartes Objets coûtent N de moins tant que le pion
   *  se trouve sur le même lieu que cette carte (cumulatif). */
  itemCostReductionHere?: number
  /** Ursula — Pacte : lieu lié au Pacte. Le Héros porteur est éliminé s'il est
   *  déplacé sur ce lieu. */
  contractLocationId?: LocationId
  /** Ursula — Ariel : Objet « gelé ». Ursula ne peut plus le déplacer tant que le
   *  Héros d'instanceId `frozenBy` (Ariel) est présent dans son royaume. */
  frozenBy?: string
  // --- Michael Myers (Halloween) -------------------------------------------
  /** ARME équipée (« associée à Meyers ») : vit dans `PlayerState.equippedWeapon`. */
  isWeapon?: boolean
  /** ARME : effets « quand vous éliminez un Héros » (désactivés si un Héros
   *  `disablesEquippedWeapon` est présent). */
  weaponOnKill?: Effect[]
  /** ASSASSINER : coût = coût de l'Arme équipée (variable). */
  costEqualsWeaponCost?: boolean
  /** Héros hors-deck (LAURIE) : séparé dans `reserveHeroes` au setup. */
  startsInReserve?: boolean
  /** Injouable tant que le Mal Intérieur n'atteint pas ce palier (Gardons le meilleur : 3). */
  requiresMalInterieur?: number
  /** Héros (LAURIE) : coût d'ASSASSINER +N par AUTRE Héros du royaume. */
  assassinateSurchargePerOtherHero?: number
  /** Héros (JAIME STRODE) : désactive l'effet on-kill de l'Arme équipée tant qu'il est là. */
  disablesEquippedWeapon?: boolean
  /** Si cet exemplaire est associé à une autre carte, `instanceId` de la carte
   *  porteuse (un Allié). Fixé à la pose ; absent pour les Alliés et les Objets
   *  posés directement sur le lieu. La carte porteuse vit sur le même lieu. */
  attachedTo?: string
  /** Effets immédiats résolus à la mise en jeu. */
  effects?: Effect[]
  /** Gul'dan — carte « Artéfact » (comptée dans les Artéfacts possédés). Recopié de CardDef. */
  isArtifact?: boolean
  /** Gul'dan — Corruption : reste posée sur le lieu du pion à la pose. Recopié de CardDef. */
  staysOnLocationOnPlay?: boolean
  /** Effets « à la pose » d'un Héros (Fatalité), résolus sur la CIBLE après que
   *  le Héros est entré sur son plateau. Vide pour les autres types. */
  onPlace?: Effect[]
  /** Effets « à la mort » d'un Héros, résolus sur le PROPRIÉTAIRE du Héros (qui
   *  a fait le Vanquish) après que la carte est partie en défausse Fatalité. */
  onVanquish?: Effect[]
  /** Lieux où ce Héros ne peut être ni posé ni déplacé (ex. Dame Gertrude →
   *  jamais sur la Prison). Vide / absent = aucune restriction. */
  forbiddenLocations?: LocationId[]
  /** Héros qui ne peut JAMAIS être déplacé en tant que Héros (Grand Councilwoman —
   *  STITCH). Exclu de toutes les relocalisations de Héros. Une fois enfermé (associé
   *  à la CAGE via `attachedTo`), il est transporté quand la CAGE est déplacée. */
  cannotBeMoved?: boolean
  /** Jetons de pouvoir verrouillés sur cette carte (Petit Jean +4 prélevés au
   *  PJ, Voler aux Riches ≤4 prélevés sur un Héros). Restitués au joueur quand
   *  la carte est défaussée/vaincue (mécanique combat — bloc B). */
  lockedPower?: number
  /** Mère Gothel — jetons Confiance « détenus » par ce Héros (Flynn Rider : pris à
   *  Gothel à son arrivée, rendus si Flynn est vaincu). Affiché en badge. */
  heldConfiance?: number
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
  /** Tant que ce Héros est dans le royaume, AUCUN Allié ne peut être posé ni déplacé
   *  sur ce lieu (Madame de Trémaine — Cendrillon en robe de bal : la Salle de Bal). */
  blocksAlliesAtLocation?: LocationId
  /** Tant que ce Héros est dans le royaume, AUCUN Allié ne peut quitter son lieu
   *  (Mère Gothel — Ulf : les Alliés sont immobilisés). */
  blocksAllyMoves?: boolean
  /** Tant que ce Héros est en jeu, les Alliés présents sur SON lieu (uniquement) ne
   *  peuvent pas être déplacés (Syndrome — Frozone). */
  blocksAllyMovesHere?: boolean
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
  /** Condition jouable UNIQUEMENT dans la fenêtre de réaction de FIN DE TOUR adverse
   *  (Michael — Aura effrayante). */
  reactAtEndOfTurn?: boolean
  /** Nombre maximum d'exemplaires de CETTE carte (même cardId) posés librement
   *  sur un même lieu. La Page : 2 (« un lieu qui a moins de 2 pages »). */
  maxAtLocation?: number
  /** Jafar — Hypnose : ce Héros est sous le contrôle de Jafar. Il compte alors
   *  comme un Allié (force inchangée, capacité ignorée) et ne recouvre plus les
   *  actions du lieu. Il reste de type 'hero' pour l'objectif CONTROL_HERO. */
  hypnotized?: boolean
  /** Isabella — AMOUR : ce Héros « aime » Isabella. Il devient alors un ALLIÉ (zone basse,
   *  force inchangée) : ses capacités de Héros sont annulées (il ne recouvre plus les
   *  actions), SEULE sa clause « Amour » reste active. Reste de type 'hero'. Jumeau de
   *  `hypnotized`. */
  loved?: boolean
  // --- Isabella : passifs des Héros Fatalité (base = actif tant que NON aimé ; « Amour »
  //     = actif une fois aimé). Tous data-driven, portés par la carte Héros. -----------
  /** GILDA/NORMAN (base, non aimé) : les Événements d'Isabella coûtent +N. */
  eventCostSurcharge?: number
  /** NORMAN (Amour) : les Événements coûtent −N une fois aimé. */
  eventCostDiscountWhenLoved?: number
  /** EMMA (base, non aimé) : l'action « Activer une capacité » coûte +N. */
  activateSurcharge?: number
  /** PHIL (Amour) : les Activités coûtent −N une fois aimé. */
  activiteCostDiscountWhenLoved?: number
  /** GILDA (Amour) : à la fin du tour d'Isabella, compléter la main à N cartes. */
  drawToAtEndOfTurnWhenLoved?: number
  /** DON (Amour) : au début du tour d'Isabella, +N Pouvoir par Héros qui l'aime. */
  powerPerLovedAtTurnStartWhenLoved?: number
  /** Isabella — SŒUR KRONE (Allié) : si Isabella est sur son lieu, elle peut utiliser les
   *  actions recouvertes par un Héros de ce lieu (comme les Yeux de Kaa). */
  unlocksCoveredActionsHere?: boolean
  /** Isabella — DON (Héros) : arrive AGRANDI (façon Reine de Cœur) → recouvre ses 2 actions
   *  du haut + une action du haut d'un lieu voisin. À la pose, on fixe `heroSize:'enlarged'`
   *  + `enlargeTargetId` (un lieu voisin). Recopié de CardDef. */
  bornEnlarged?: boolean
  /** PHIL (Amour) : tant qu'il aime Isabella, elle est IMMUNISÉE à Incendie. */
  immuneToIncendieWhenLoved?: boolean
  /** CONNY (Amour) : tant qu'il aime Isabella, piocher 1 carte quand elle subit une Fatalité. */
  drawWhenFatedWhenLoved?: boolean
  /** TÉLÉPHONE À FICELLE (Objet Fatalité associé) : si Isabella arrive sur ce lieu, −N Pouvoir. */
  powerPenaltyOnPawnArrive?: number
  /** PARALYSIE DES ÉMETTEURS (Objet Fatalité associé) : si Isabella arrive sur ce lieu, défausse un Objet. */
  discardItemOnPawnArrive?: boolean
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
  /** Team Rocket — POKÉMON : Héros (deck Fatalité) qui se CAPTURE (action Attraper /
   *  CATCH_POKEMON) au lieu de se vaincre — il rejoint la pile de Captures. Compte
   *  pour l'objectif CAPTURE_POKEMON. Recopié de CardDef. */
  isPokemon?: boolean
  /** Team Rocket — DRESSEUR (Héros Fatalité) : à sa pose, on cherche l'un de ces
   *  Pokémon (cardId) dans la pioche Fatalité et on le pose sur le même lieu (Sacha →
   *  Pikachu/Dracaufeu…). Recopié de CardDef. */
  summonsPokemonCardIds?: string[]
  /** Team Rocket — Pokémon invoqué : instanceId du dresseur qui l'a fait venir (lien
   *  « si ce Pokémon est défaussé, défaussez aussi le dresseur »). */
  summonedByInstanceId?: string
  /** Team Rocket — Pokémon VAINCU mais pas encore attrapé : « couché » (K.O.), il
   *  RESTE sur son lieu (ne recouvre plus d'action, n'est plus vaincable). On l'attrape
   *  via l'action Attraper (→ pile de Captures). `koOnTurn` = n° du tour où il a été
   *  vaincu ; non attrapé à la fin du tour suivant, il part en défausse Fatalité. */
  pokemonKO?: boolean
  koOnTurn?: number
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
  /** L'Allié peut Éliminer un Héros sur N'IMPORTE QUEL lieu (Team Rocket — Persian).
   *  Recopié de CardDef. */
  reachesAnyLocationVanquish?: boolean
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
  /** Gul'dan — Medivh : renchérit les Artéfacts de N tant qu'il est en jeu. Recopié de CardDef. */
  increasesArtifactCost?: number
  /** Gul'dan — Illidan : rend injouables ces cardIds tant qu'il est en jeu. Recopié de CardDef. */
  blocksCardIds?: string[]
  /** Gul'dan — Khadgar : tant que ce Héros est en jeu, un Artéfact posé ne déclenche
   *  PAS son effet et Manipulation ne peut rien dupliquer (la victoire reste possible).
   *  Recopié de CardDef. */
  nullifiesArtifacts?: boolean
  /** Gul'dan — Fatalités qui se POSENT sur un lieu (Armée de la Lumière, Kil'jaeden) au
   *  lieu de se défausser : routées vers pendingFateObjectPlace. Recopié de CardDef. */
  fateAttachesToLocation?: boolean
  /** Gul'dan — Armée de la Lumière : tant que cette carte (posée) est sur un lieu,
   *  Gul'dan ne peut pas le corrompre. Recopié de CardDef. */
  blocksCorruptionHere?: boolean
  /** Gul'dan — Kil'jaeden : Gul'dan perd N Pouvoir au début de chacun de ses tours tant
   *  que cette carte (posée) est en jeu. Recopié de CardDef. */
  drainsPowerAtTurnStart?: number
  /** Gul'dan — Armée de la Lumière : Gul'dan peut défausser cette carte (posée) en payant
   *  N Pouvoir (action REMOVE_FATE_LOCATION_CARD). Recopié de CardDef. */
  fateRemovalPowerCost?: number
  /** Gul'dan — Kil'jaeden : cette carte (posée) ne peut être défaussée que si les 4 lieux
   *  sont corrompus (puis gratuitement). Recopié de CardDef. */
  discardWhenAllCorrupted?: boolean
  /** Héros Fatalité posé d'office sur ce lieu (Blanche-Neige → Maison des Nains).
   *  Recopié de CardDef. */
  forcedFateLocation?: LocationId
  /** Fatalité : révélée parmi les deux, autorise à jouer les DEUX cartes (Ray,
   *  Dormeur). Recopié de CardDef. */
  fatePlayBoth?: boolean
  /** Scar — Allié « Hyène » (synergies de Scar). Recopié de CardDef. */
  isHyena?: boolean
  /** Le Seigneur des Ténèbres — Mort-vivant du Chaudron : jouable UNIQUEMENT quand
   *  le Chaudron Noir est activé (`blackCauldron === 'powered'`). Recopié de CardDef. */
  requiresPoweredCauldron?: boolean
  /** Le Seigneur des Ténèbres — Mort-vivant du Chaudron : à la pose, doit « échanger »
   *  un Objet de ce cardId présent sur le lieu de destination (défaussé). Le lieu doit
   *  donc en porter un, sinon la carte est injouable. Recopié de CardDef. */
  consumesItemCardId?: string
  /** Héros qui, tant qu'il est en jeu, interdit au joueur de jouer des Événements
   *  (Roi Richard, Tirelire). Recopié de CardDef. */
  blocksVillainEvents?: boolean
  /** Héros qui interdit la pose de l'Objet de ce cardId sur SON lieu (Les Elfes →
   *  Squelettes de Soldats). Recopié de CardDef. */
  blocksItemPlacement?: string
  /** Allié qui, au lieu d'être défaussé après une action Éliminer un Héros à laquelle il
   *  participe, est déplacé sur le lieu du pion (Crapaud). Recopié de CardDef. */
  relocateToPawnOnVanquish?: boolean
  /** Sa Sucrerie — Cybug en Sucre : Allié qui, au lieu d'être défaussé après une action
   *  Éliminer un Héros, RESTE en jeu, gagne ce nombre en Force (jeton +N cumulatif) et est
   *  déplacé sur un lieu AU CHOIX (pendingAllyRelocate restreint). Recopié de CardDef. */
  survivesVanquishGain?: number
  /** Carte « jouée OU déplacée » : ses `effects` se redéclenchent au déplacement de
   *  l'Allié/Objet (en plus de la pose). Ex. Pilotes (Sa Sucrerie). Recopié de CardDef. */
  effectsAlsoOnMove?: boolean
  /** Le Flagelleur Mental — Démogorgon : gagne N Pouvoir CHAQUE FOIS que cet Allié est
   *  déplacé (uniquement au déplacement, pas à la pose). Recopié de CardDef. */
  powerOnMove?: number
  /** Carte jouable SANS action « Jouer une carte » (paie son coût, ne consomme aucune
   *  action). Ex. Turbo-Statique (Sa Sucrerie). Recopié de CardDef. */
  playableWithoutAction?: boolean
  /** Carte jouable uniquement AVANT toute action de lieu ce tour (après le déplacement).
   *  Ex. L'important, c'est de payer (Sa Sucrerie). Recopié de CardDef. */
  playableOnlyBeforeActions?: boolean
  /** Shere Khan — Baloo : protège tous les autres Héros (jeton Pouvoir à la place ; défaussé
   *  à N jetons). Recopié de CardDef. */
  shieldsOtherHeroesUntilTokens?: number
  /** Pyramid Head — Maria : tant qu'elle est sur un lieu, aucune TUILE DE JUGEMENT ne peut
   *  y être propagée. Recopié de CardDef. */
  blocksJudgmentTile?: boolean
  /** Ultron (Marvel) — SENTINELLE (« Drone ») : classification d'Allié référencée par les
   *  tuiles Amélioration et certaines cartes. Recopié de CardDef. */
  isSentry?: boolean
  /** Pyramid Head — Eddie : ne peut pas être éliminé par la Cage de l'Expiation. */
  immuneToCage?: boolean
  /** Pyramid Head — Laura : tant qu'elle est en jeu, obtenir une piste de souffrance
   *  (Métatron) coûte 1 Pouvoir de plus. */
  souffranceSurcharge?: boolean
  /** Pyramid Head — James : tant qu'il est en jeu, Métatron n'a aucun effet. */
  disablesMetatron?: boolean
  /** Pyramid Head — Protection de l'âme (Objet associé) : le Héros porteur ne peut pas
   *  être éliminé tant que cet Objet lui est associé. */
  shieldsHostFromVanquish?: boolean
  // --- Mr. Monopoly --------------------------------------------------------
  /** Mr. Monopoly — L'Ombre de Monopoly (Objet) : tant que le pion partage son lieu, le
   *  coût d'ACHAT d'une maison est réduit de 1. Recopié de CardDef. */
  shadowReducesHouseCost?: boolean
  /** Mr. Monopoly — Fer à repasser (Héros Fatalité) : tant qu'il est dans le royaume,
   *  Mr. Monopoly ne gagne plus aucun loyer. Recopié de CardDef. */
  blocksRent?: boolean
  /** Mr. Monopoly — Haut de forme (Héros Fatalité) : tant qu'il est dans le royaume,
   *  Mr. Monopoly ne peut poser AUCUNE nouvelle maison. Recopié de CardDef. */
  blocksHousePlacement?: boolean
  /** Mr. Monopoly — Chaussure (Héros Fatalité) : Mr. Monopoly ne peut pas poser de maison
   *  TANT QUE son pion se trouve sur le lieu de ce Héros. Recopié de CardDef. */
  blocksHousesWhenPawnHere?: boolean
  /** Mr. Monopoly — Brouette (Héros Fatalité) : tant qu'il est dans le royaume, les
   *  cartes/actions/loyers rapportent 1 Pouvoir de moins. Recopié de CardDef. */
  reducesPowerGains?: boolean
  /** Mr. Monopoly — Banqueroute : le coût de la carte = la Force (effective) du Héros
   *  ciblé (résolu au moment de jouer la carte). Recopié de CardDef. */
  costEqualsTargetStrength?: boolean
  /** Mr. Monopoly — Chien (Héros Fatalité) : à la fin de chaque tour, se déplace d'un
   *  lieu vers le pion de Mr. Monopoly. Recopié de CardDef. */
  movesTowardPawnEndOfTurn?: boolean
  /** Mr. Monopoly — Règles inventées (Objet Fatalité associé à un Héros) : jouer une carte
   *  qui CIBLE ce Héros coûte N Pouvoir de plus. Recopié de CardDef. */
  eventTargetSurcharge?: number
  /** Mr. Monopoly — Officier de police (Allié) : quand il SE DÉPLACE sur un lieu portant
   *  un Héros, ce Héros est envoyé à la Prison (id de lieu porté ici). Recopié de CardDef. */
  sendsHeroToPrisonOnMove?: LocationId
  /** Mr. Monopoly — Case Départ (Objet) : chaque fois que le pion du propriétaire SE REND
   *  sur le lieu de cet Objet OU le DÉPASSE (déplacement qui le franchit), gagne N Pouvoir.
   *  Recopié de CardDef. */
  powerOnPawnCrossOrLand?: number
  /** Shere Khan — Baloo : nombre de jetons Pouvoir accumulés sur lui (runtime). */
  protectionTokens?: number
  /** Héros (Fatalité) qui augmente de N le coût de toute carte jouée tant qu'il est dans
   *  le royaume (Sergent Calhoun, +1). Recopié de CardDef. */
  playCardCostSurcharge?: number
  /** Carte Fatalité qui fait perdre N Pouvoir au vilain quand sa figurine arrive sur
   *  son lieu (Chicha 2, Zirgouflex 1). Recopié de CardDef. */
  powerLossOnPawnArrive?: number
  /** Héros (Fatalité) qui renchérit de N le coût d'un Pacte le ciblant (Roi Triton, +1).
   *  Recopié de CardDef. */
  pacteTargetSurcharge?: number
  /** Héros (Fatalité) qui fait coûter N Pouvoir l'action « Déplacer un Objet/Allié » tant
   *  qu'il est dans le royaume (Ralph la Casse, +1). Recopié de CardDef. */
  moveActionSurcharge?: number
  /** Scar — injouable sans Hyène dans le royaume (Festin). Recopié de CardDef. */
  requiresHyenaInRealm?: boolean
  /** Team Rocket — Évolution : injouable sans Allié dans le royaume. Recopié de CardDef. */
  requiresAllyInRealm?: boolean
  /** Team Rocket — Allié évolutif : `cardId` de son évolution. Recopié de CardDef. */
  evolvesToCardId?: string
  /** Team Rocket — Pikachu : Pokémon Fatalité « joué d'office dès qu'il est dévoilé »
   *  (la Fatalité ne laisse pas le choix). Recopié de CardDef. */
  playWhenRevealed?: boolean
  /** Team Rocket — Pokémon déjà repris une fois de la pile de Captures par « On n'abandonne
   *  pas ses amis » : ne peut plus l'être (drapeau runtime, posé à la reprise). */
  noReturnFromCapture?: boolean
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
  /** Pat Hibulaire — Grillon : à chaque Héros joué dans le royaume du propriétaire,
   *  cet Allié peut être déplacé sur le lieu du Héros (auto). Recopié de CardDef. */
  followsHeroes?: boolean
  /** Pat Hibulaire — Bandit : on peut jouer plusieurs exemplaires lors d'une même
   *  action « Jouer une carte ». Recopié de CardDef. */
  playMultiplePerAction?: boolean
  /** Gaston — Lefou : un Vanquish effectué sur SON lieu ne défausse pas les Alliés
   *  utilisés (ils retournent en main). Recopié de CardDef. */
  keepAlliesOnVanquishHere?: boolean
  /** Le Seigneur des Ténèbres — Soldats Ressuscités : cet Allié n'est PAS défaussé
   *  lorsqu'il participe à une action Éliminer un Héros — il RESTE en jeu à sa place
   *  (armée immortelle), contrairement à `keepAlliesOnVanquishHere` (retour en main).
   *  N'affecte QUE le Vanquish : il reste défaussable par d'autres effets. Recopié de CardDef. */
  survivesVanquishInPlace?: boolean
  /** Le Seigneur des clés — Appel : pioche 1 carte quand le Seigneur est ciblé par
   *  une Fatalité. Recopié de CardDef. */
  drawCardOnFateTargeted?: boolean
  /** Le Seigneur des clés — Hellin : Héros qui recouvre UNE action de plus (3 au
   *  lieu de 2). Recopié de CardDef. */
  coversExtraAction?: boolean
  /** Madame de Trémaine — Allié « en robe de bal » : ne peut être joué que pour
   *  REMPLACER l'Allié `replacesCardId` déjà en jeu (qui est alors défaussé). */
  replacesCardId?: string
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
  /** Syndrome — l'Omnidroïde (Allié spécial, tuile hors deck). `omnidroidStage` =
   *  version (x8/x9/x10). Participe aux Vanquish comme un Allié ; à la fin du Vanquish,
   *  v.X8/v.X9 sont retirés du royaume et la version suivante arrive en main, tandis
   *  que v.10 reste. Recopié de la définition de tuile. */
  isOmnidroid?: boolean
  omnidroidStage?: 'x8' | 'x9' | 'x10'
  /** Syndrome — pour jouer cette tuile Omnidroïde (en main), défausser ce nombre de
   *  Modifications Majeures du royaume (x9 : 1, v.10 : 3). */
  omnidroidUpgradeCost?: number
  /** Syndrome — lieu imposé pour poser cette tuile Omnidroïde (v.10 → Métroville). */
  omnidroidForceLocation?: LocationId
  /** Syndrome — Énergie au Point Zéro : Objet associé à un Héros qui, en plus de son
   *  malus de force (`attachStrengthBonus` négatif), EMPÊCHE de déplacer ce Héros. */
  immobilizesHostHero?: boolean
  /** Syndrome — Champ de Force (Objet Fatalité associé à un Héros) : si ce Héros doit
   *  être éliminé, cet Objet est défaussé À SA PLACE et le Héros survit (bouclier,
   *  équivalent Héros de `shieldAllyFromDiscard`). Donnée réutilisable. */
  shieldHeroFromVanquish?: boolean
  /** Syndrome — l'Omnidroïde ET la Télécommande comptent comme Objet pour les conditions
   *  adverses, mais ne peuvent PAS être affectés par les effets visant Alliés/Objets
   *  (défausser/déplacer un Allié ou un Objet). Exemptés partout via ce drapeau. */
  immuneToAllyItemEffects?: boolean
  /** Syndrome — Unité de Confinement : la force EFFECTIVE de ce Héros est réduite à 0
   *  (jetons Force). État de jeu (runtime), posé sur le Héros ciblé. */
  forceZeroed?: boolean
  /** Modificateur PERMANENT de force porté par la carte (Syndrome — 15 ans plus tard :
   *  −2 sur le Héros joué). La force de base reste intacte (l'UI affiche le badge
   *  « force modifiée »). Sommé par effectiveStrength. */
  permanentStrengthDelta?: number
  /** Lotso — tuile GARDIEN « Buzz l'Éclair » (deux faces). `buzzMode` : 'guardian'
   *  (protège les Héros de son lieu du Vaincre) ou 'demo' (Allié force 1). */
  isBuzz?: boolean
  buzzMode?: 'guardian' | 'demo'
  /** Lotso — Rex : tant qu'il partage son lieu avec un autre Héros, il ne peut être ni
   *  ciblé par un Vaincre ni réduit par des jetons Force −1 (ignoré si sa force est 0). */
  protectedWithOtherHero?: boolean
  /** Nombre minimum d'Alliés requis pour éliminer ce Héros (Lotso — Bayonne/Hamm : 2 ;
   *  généralise gardes-chateau / enfants-perdus). Ignoré si sa force est 0. */
  minAlliesToVanquish?: number
  /** Condition PIOCHÉE pendant le tour d'un adversaire (réaction : « Je travaille en
   *  solo », « Appel »…) : instantané des compteurs du tour au moment de la pioche. La
   *  Condition ne peut alors réagir qu'aux événements survenus APRÈS (on compare à cet
   *  instantané), pas à ceux d'avant qu'on l'ait en main. Effacé au début de chaque tour. */
  conditionBaseline?: {
    gainedPower: number
    discarded: number
    playedCards: number
    playedItems: number
    playedAllies: number
  }
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
  | { target: 'heroes-here'; delta: number; onlyIfActivatedThisTurn?: boolean; excludeSelf?: boolean }
  /** Modifie la force des Alliés du même lieu. `excludeSelf` : la carte source
   *  ne se modifie pas elle-même (Niquedouille : +1 aux AUTRES Alliés ; Pendard :
   *  -1 aux AUTRES Alliés). */
  | { target: 'allies-here'; delta: number; excludeSelf?: boolean }
  /** Modifie la force de TOUS les Héros du royaume (aura globale, pas seulement le
   *  lieu). `excludeSelf` : la carte source ne s'affecte pas (Adam de la Halle :
   *  +1 à tous les AUTRES Héros). `exceptCardId` : un Héros de ce cardId n'est PAS
   *  affecté (Lotso — Chapeau de Woody : −1 à tous les Héros SAUF Woody). */
  | { target: 'heroes-realm'; delta: number; excludeSelf?: boolean; exceptCardId?: string; onlyPokemon?: boolean }

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
  /** +delta si au moins un Objet est associé à cette carte (Jean / Crochet : +1
   *  s'il porte un Objet). */
  | { kind: 'if-attached-item'; delta: number }
  /** +delta par lieu du royaume occupé par au moins un Héros, le sien COMPRIS
   *  (Michel / Crochet). */
  | { kind: 'per-location-with-hero'; delta: number }
  /** Scar — +delta par AUTRE Hyène (`isHyena`) sur le MÊME lieu (Hyène affamée). */
  | { kind: 'per-other-hyena-here'; delta: number }
  /** +delta par AUTRE carte de MÊME cardId présente dans le royaume (Gaston —
   *  Loups : +1 par autre Loup). Réutilisable pour toute carte « en meute ». */
  | { kind: 'per-other-same-cardId-realm'; delta: number }
  /** +delta par AUTRE carte dont le cardId est dans `cardIds`, présente dans le
   *  royaume (Oogie Boogie — Trio Am/Stram/Gram : +1 par autre membre du trio).
   *  N'inclut pas la carte elle-même. */
  | { kind: 'per-other-in-set-realm'; cardIds: string[]; delta: number }
  /** +delta par AUTRE Héros présent sur le même lieu (Taram). */
  | { kind: 'per-other-hero-here'; delta: number }
  /** +delta FORFAITAIRE s'il y a AU MOINS un autre Héros sur le même lieu (Tabbou —
   *  Meta Knight : +1 dès qu'un autre Héros l'accompagne, quel qu'en soit le nombre). */
  | { kind: 'if-other-hero-here'; delta: number }
  /** +delta par AUTRE carte de type `cardType` présente sur le même lieu (Syndrome —
   *  Gardes : +1 par autre Allié). Exclut la carte elle-même. */
  | { kind: 'per-other-type-here'; cardType: CardType; delta: number }
  /** +delta par AUTRE carte du MÊME cardId présente sur le même lieu (Pyramid Head —
   *  Infirmière : +1 par autre Infirmière). Exclut la carte elle-même. */
  | { kind: 'per-other-same-here'; delta: number }
  /** Syndrome — Jack-Jack : sa force EFFECTIVE devient celle du Héros le plus fort sur
   *  son lieu (comparaison sur la force de base, sans récursion). */
  | { kind: 'match-strongest-hero-here' }
  /** Davy Jones — L'Équipage du Hollandais Volant : +delta par AUTRE lieu (≠ le sien)
   *  où se trouve au moins un Allié. */
  | { kind: 'per-other-location-with-ally'; delta: number }
  /** Davy Jones — James Norrington : +delta par jeton Trésor déjà RÉCUPÉRÉ par le
   *  propriétaire du royaume (claimedTreasures). */
  | { kind: 'per-claimed-treasure'; delta: number }

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
  /** L'adversaire actif a déplacé un Allié ou un Objet ce tour-ci (Sombres desseins).
   *  `requiresOwnHeroMaxStrength` : contrainte supplémentaire « le joueur a, dans son
   *  royaume, un Héros de force ≤ cette valeur » (Affront élimine un Héros ≤ 3 : injouable
   *  sinon, car sans effet). */
  | { type: 'opponent-moved-card'; requiresOwnHeroMaxStrength?: number }
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
  /** L'adversaire actif a joué AU PLUS `value` cartes jusqu'ici ce tour-ci (Michael Myers —
   *  Aura effrayante : jouable en réaction tant qu'il n'a joué aucune carte, value 0). */
  | { type: 'opponent-played-cards-le'; value: number }
  /** L'adversaire actif a réalisé au moins `value` actions de lieu ce tour-ci
   *  (Gaston — Aussi belle que moi : ≥ 4 actions). */
  | { type: 'opponent-actions-ge'; value: number }
  /** L'adversaire actif a ciblé le joueur avec une action Fatalité ce tour-ci
   *  (Scar — La vie n'est pas juste). */
  | { type: 'opponent-fate-targeted-me' }
  /** L'adversaire actif a joué au moins `value` Objet(s) ce tour-ci (Le Seigneur des
   *  Ténèbres — Nous touchons du doigt la victoire). */
  | { type: 'opponent-played-item'; value: number }
  /** L'adversaire actif a joué au moins un Allié ce tour-ci (Davy Jones — Wyvern
   *  s'exprime). `requiresOwnAlly` : exige EN PLUS un Allié en main (Le Flagelleur Mental —
   *  INTRUS pose un Allié gratuit : injouable sans Allié à poser). */
  | { type: 'opponent-played-ally'; requiresOwnAlly?: boolean }
  /** L'adversaire actif a joué un ÉVÉNEMENT de coût ≥ `value` ce tour-ci (Le Piégeur —
   *  Fermeture de la trappe). */
  | { type: 'opponent-played-event-cost-ge'; value: number }
  /** L'adversaire actif t'a joué (par la Fatalité) un Héros de force ≤ `value` ce tour-ci
   *  (Team Rocket — « Pour vous jouer un mauvais tour »). */
  | { type: 'opponent-played-fate-hero-le'; value: number }
  /** L'adversaire actif a déplacé SON PION ce tour-ci (Mr. Monopoly — Monopoly : on
   *  pose alors une maison sur son lieu d'arrivée). */
  | { type: 'opponent-moved-pawn' }
  /** La partie dure depuis au moins `ms` millisecondes (temps réel estampillé par l'UI
   *  dans `state.elapsedMs` — Mr. Monopoly : Monotonie). */
  | { type: 'game-elapsed-ge'; ms: number }

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
  /** Dos de carte des paquets PERSONNALISÉS (copié depuis VillainDef). Absent =
   *  les cartes de paquet perso reprennent le dos Vilain. */
  backExtraImage?: string
  /** Lieu où se trouve le pion. `null` tant qu'il n'a pas joué son 1ᵉʳ déplacement. */
  pawnLocation: LocationId | null
  /** Points de pouvoir accumulés. */
  power: number
  /** Condition de victoire (copiée depuis le vilain). */
  objective: ObjectiveDef
  /** Description de la condition de victoire. */
  objectiveDescription: string
  /** Atelier — objectif ALTERNATIF (« face B ») d'un vilain à objectif transformable.
   *  `objective`/`objectiveDescription` portent toujours l'objectif ACTIF ; les champs
   *  `alt*` gardent l'objectif INACTIF pour pouvoir (re)basculer via `SWITCH_OBJECTIVE`.
   *  `altBoardImage` = image de plateau alternative (image du vilain + panneau objectif),
   *  échangée avec `boardImage` à la bascule. `objectiveVersion` = face active ('a'
   *  par défaut). Absents = objectif non transformable. */
  altObjective?: ObjectiveDef
  altObjectiveDescription?: string
  altBoardImage?: string
  objectiveVersion?: 'a' | 'b'
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
  /** Conditions (instanceId) présentes en main au DÉBUT du tour courant : seules
   *  celles-ci peuvent être jouées en réaction ce tour. Une Condition piochée en cours
   *  de tour (ex. « J'allais oublier un détail ») n'est PAS réactable. `undefined` (1ᵉʳ
   *  tour / états construits à la main) = aucune restriction. Réévalué à chaque tour. */
  reactableConditionIds?: string[]
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
  /** Ratigan — la Reine Robot a été POSÉE sur le plateau au moins une fois. Condition
   *  pour que SA DÉFAUSSE bascule l'objectif côté « Le Rat » : défausser la Reine
   *  Robot depuis la MAIN (jamais posée) ne bascule PAS. `undefined` ailleurs. */
  reineRobotWasInPlay?: boolean
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
  /** Le Seigneur des Ténèbres — état de la tuile CHAUDRON NOIR (hors deck) :
   *  'set-aside' = mise de côté (pas encore réclamée), 'claimed' = à côté du portrait
   *  (face Chaudron, inactive), 'powered' = activée (face Pouvoir → permet de jouer
   *  les Morts-vivants du Chaudron). `undefined` pour les autres vilains. */
  blackCauldron?: 'set-aside' | 'claimed' | 'powered'
  /** Le Seigneur des Ténèbres — la capacité « échange » du Chaudron réveillé (payer 2
   *  Pouvoir pour transformer un Squelette de Soldat en Soldat Ressuscité) a déjà été
   *  utilisée CE TOUR (une seule fois par tour). Réinitialisé au début du tour. */
  cauldronExchangeUsedThisTurn?: boolean
  /** Gul'dan — zone ARTÉFACTS (comme les Ingrédients de la Méchante Reine) : un
   *  exemplaire de chaque Artéfact joué (Livre de Medivh, Œil de Dalaran, Sceptre de
   *  Sargeras, Crâne de Gul'dan), affichée au même endroit que la pile Ingrédients.
   *  Posséder les 4 est requis pour ouvrir la Porte des Ténèbres. `undefined` ailleurs. */
  artifacts?: CardInstance[]
  /** Mère Gothel — jetons CONFIANCE accumulés (au-dessus de son plateau). Objectif :
   *  en atteindre 10 au début de son tour. Pris dans la Réserve quand elle en gagne
   *  (n'entame pas son Pouvoir), rendus quand elle en perd. `undefined` ailleurs. */
  confiance?: number
  /** Mère Gothel — N'écoute que moi : Raiponce ne se déplace pas à la fin de ce tour
   *  (drapeau consommé lors de la dérive de fin de tour). */
  raiponceSkipMove?: boolean
  /** Mère Gothel — Vengeance : le prochain Vanquish de ce tour rapporte 1 Confiance
   *  si le Héros éliminé n'est pas Raiponce. Consommé au Vanquish / en fin de tour. */
  vengeanceConfianceArmed?: boolean
  /** Cruella d'Enfer — ses 12 Tuiles Chiots. État de chacune :
   *  - `reserve` : dans la réserve au-dessus du plateau (face cachée tant que `revealed` est faux) ;
   *  - `board`   : posée sur un lieu (visible), pas encore capturée ;
   *  - `captured`: capturée (compte vers l'objectif de 99 Chiots).
   *  `homeLocation` = lieu indiqué sur la tuile ; `location` = lieu courant (peut différer
   *  après un déplacement Roadster/Sergent Tibs). `undefined` pour les autres vilains. */
  puppyTiles?: PuppyTile[]
  /** Tabbou — ses tuiles Combattants (pioche `pile` → réserve `reserve` → tuées
   *  `killed`). Le nombre de `killed` est comparé au seuil de l'objectif KILL_FIGHTERS.
   *  `undefined` pour les autres vilains. */
  fighterTiles?: FighterTile[]
  /** Tabbou — id du lieu Émissaire Subspatial (recopié de fighterSetup), pour savoir
   *  quel lieu déverrouiller quand 3 Orbes subspatiaux sont posés. */
  emissaireLocationId?: LocationId
  /** Cruella d'Enfer — Finissez le travail ! : une action « Activer » gratuite est
   *  disponible ce tour sur le lieu courant (consommée à l'usage). */
  freeActivate?: boolean
  /** L'Imposteur — ses 8 COÉQUIPIERS posés sur le plateau (cases d'action).
   *  Absent pour les autres vilains. Voir l'interface `Crewmate`. */
  crewmates?: Crewmate[]
  /** L'Imposteur — Porte désactivée : les Coéquipiers ne se déplacent pas à la fin
   *  du prochain tour (drapeau consommé au moment du déplacement). */
  crewmatesSkipMove?: boolean
  /** La Méchante Reine — jetons POISON accumulés (défaussés par « Croque ! » pour
   *  éliminer un Héros). `undefined` pour les autres vilains. */
  poison?: number
  /** Pyramid Head — pistes de SOUFFRANCE accumulées (monnaie, comme le Poison ;
   *  gagnées en activant Métatron, dépensées par « Propager la souffrance »). */
  souffrance?: number
  /** Pyramid Head — nombre de TUILES DE JUGEMENT posées. Les tuiles occupent les
   *  lieux les plus à DROITE (depuis Silent Hill) vers la gauche, de façon contiguë :
   *  `judgmentTiles` lieux tuilés = les `judgmentTiles` derniers de `locations`. Une
   *  tuile recouvre les actions du HAUT de son lieu (comme un Héros). */
  judgmentTiles?: number
  /** Ultron (Marvel) — nombre de tuiles AMÉLIORATION révélées (0→4), dans l'ordre
   *  Transformation, Optimisation, Forme finale, L'ère d'Ultron. À 4, victoire
   *  (objectif ULTRON_AGE_REVEALED). Défini uniquement pour Ultron. */
  ultronUpgrades?: number
  /** Ultron — une Amélioration a déjà été complétée CE tour (max 1/tour). Réinitialisé
   *  en fin de tour. */
  ultronUpgradeThisTurn?: boolean
  /** Ultron — TRANSFORMATION (1ʳᵉ Amélioration révélée) : le passif « en jouant une
   *  Sentinelle, reprendre 1 carte de la défausse » a déjà été déclenché CE tour (1/tour).
   *  Réinitialisé en fin de tour. */
  ultronTransfoUsedThisTurn?: boolean
  /** Ultron — OPTIMISATION (2ᵉ Amélioration révélée) : le passif « une action Jouer une
   *  carte utilisée comme Déplacer un Allié/Objet » a déjà été employé CE tour (1/tour).
   *  Réinitialisé en fin de tour. */
  ultronOptimUsedThisTurn?: boolean
  /** Isabella — HORLOGE : heure courante (index 0..5 = XII, II, IV, VI, VIII, X).
   *  Démarre à XII (0) et avance d'un cran au DÉBUT de chacun de ses tours (sauf le
   *  tout premier). Défini uniquement pour Isabella (objectif ISABELLA_CLOCK). */
  clockHour?: number
  /** Isabella — indices des heures VALIDÉES (une Activité y a été jouée). Victoire
   *  quand les 6 heures sont validées. */
  validatedHours?: number[]
  /** Isabella — RADAR DE POCHE : ce tour-ci, les Activités sont jouables quelle que soit
   *  l'heure (verrou d'heure ignoré). Expire en fin de tour. */
  activiteAnyHourThisTurn?: boolean
  /** Isabella — INCENDIE (Fatalité) : posé pour bloquer les Activités « à la prochaine
   *  heure ». `incendiePending` = armé par la carte ; au prochain début de tour d'Isabella
   *  il devient `incendieActive` (Activités bloquées ce tour) puis se dissipe. */
  incendiePending?: boolean
  incendieActive?: boolean
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
  /** Pat Hibulaire — ses 4 tuiles Objectif (une par lieu), tirées parmi 5 à la
   *  mise en place. Objectif COMPLETE_GOAL_TOKENS : les 4 `completed` = victoire.
   *  `undefined` pour les autres vilains. */
  goals?: GoalToken[]
  /** Pat Hibulaire — Pouvoir dépensé pendant le tour courant (pour la tuile
   *  Power Play : ≥6 dépensés avec le pion sur son lieu). Remis à 0 en début de tour. */
  powerSpentThisTurn?: number
  /** Gaston — jetons OBSTACLE restants par lieu (0 à 2). 2 par lieu au départ (8 au
   *  total). Objectif REMOVE_ALL_OBSTACLES : tous à 0 au début de son tour. Retirés
   *  par REMOVE_OBSTACLE / Vanquish (Bête, Maurice) ; replacés par REPLACE_OBSTACLE
   *  (Fatalité, Sous le charme). `undefined` pour les autres vilains. */
  obstacles?: Record<LocationId, number>
  /** Shere Khan — jetons FEU posés sur des ACTIONS de ses lieux (recouvrent l'action,
   *  qui devient inutilisable, comme un Héros recouvre la rangée du haut). Pour chaque
   *  lieu : la liste des `actionId` recouverts. Posés/déplacés par la Fatalité (Feu Rouge
   *  des Hommes, Mowgli), retirés par les cartes Méchant (C'est moi Shere Khan, Macaques,
   *  C'est très intéressant…). Objectif bloqué tant qu'il en reste un. `undefined` sinon. */
  fireTokens?: Record<LocationId, string[]>
  /** Davy Jones — RÉSERVE de jetons Trésor non encore posés ni récupérés (ids mélangés,
   *  face cachée). On en pioche le 1ᵉʳ pour poser un trésor face cachée sur un Héros.
   *  `undefined` pour les autres vilains. */
  treasureReserve?: string[]
  /** Davy Jones — jetons Trésor RÉCUPÉRÉS définitivement (objectif : en récupérer 5). */
  claimedTreasures?: string[]
  /** Le Seigneur des clés — ses 12 clés (réparties sur les lieux à la mise en place).
   *  `location` = lieu, `null` = possédée par lui (objectif : ≥1 de chaque couleur).
   *  `undefined` pour les autres vilains. */
  keys?: KeyToken[]
  /** Le Seigneur des clés — Baron Samedi : couleur de clé que le dé NE PEUT plus
   *  donner tant que Baron Samedi est présent. */
  dieBlockedColor?: KeyColor
  /** Le Seigneur des clés — Carte Temps : au PROCHAIN tour, une action pourra être
   *  effectuée 2 fois (converti en repeatActionAvailable au début du tour). */
  repeatActionNextTurn?: boolean
  /** Le Seigneur des clés — Peste : plafond d'actions imposé au PROCHAIN tour de ce
   *  joueur (converti en `actionsCap` au début de son tour). */
  actionsCapNextTurn?: number
  /** Plafond d'actions de lieu actif CE tour-ci (Peste). Au-delà, plus aucune action
   *  de lieu n'est disponible (END_TURN reste possible). Effacé en fin de tour. */
  actionsCap?: number
  /** Oogie Boogie — nombre d'Imposteur Perce-Oreilles réussis posés près de Sandy
   *  Claws (0→4). À 4, Jack Skellington revient et Sandy Claws est retiré. */
  impostorsPlaced?: number
  /** Oogie Boogie — PILE Perce-Oreilles : les cartes Imposteur réussies, EMPILÉES à
   *  côté de Sandy Claws (et non défaussées) tant que Jack n'est pas revenu. Affichée
   *  comme la Pile de l'Au-delà. À 4 (ou au retour de Jack), la pile part en défausse.
   *  Reste synchronisée avec `impostorsPlaced` (le compteur fait foi pour la logique). */
  impostorPile?: CardInstance[]
  /** Oogie Boogie — Jack Skellington est revenu (Héros à l'Antre) : les Imposteurs
   *  joués ensuite lui collent un jeton Force -1 au lieu d'alimenter la pile. */
  jackReturned?: boolean
  /** Oogie Boogie — jetons « Salut, Oogie ! » sous la figurine (Fatalité). Chacun
   *  retire 2 au PROCHAIN lancer de dés, puis est défaussé. */
  helloOogieTokens?: number
  /** Oogie Boogie — Sally : tant qu'elle est en jeu, Oogie ne peut se déplacer que
   *  vers un lieu VOISIN au début de son tour. */
  sallyRestrict?: boolean
  /** Madame Mim — 2ᵉ pioche Fatalité, dédiée aux Métamorphoses de Merlin (les « Héros »).
   *  À la mise en place, 1 Merlin est posé au Lieu du Duel ; à chaque défaite, on en
   *  pioche un autre ici. `fateDeck` reste la pioche Fatalité TRADITIONNELLE (8 cartes,
   *  ce que jouent les adversaires). `undefined` pour les autres vilains. */
  merlinDeck?: CardInstance[]
  /** Madame Mim — Métamorphoses de Merlin VAINCUES (objectif : en avoir 7). La carte
   *  Fatalité « Merlin » peut en remettre une au hasard dans `merlinDeck`. */
  merlinDiscard?: CardInstance[]
  /** Tamatoa — 3ᵉ pioche (cartes MAUI, 10), séparée du deck Fatalité au setup. Jouée
   *  carte par carte tant que Maui (Héros) est en jeu (et via « Pas exactement l'heure
   *  de Maui »). `undefined` pour les autres vilains. */
  mauiDeck?: CardInstance[]
  mauiDiscard?: CardInstance[]
  // --- Dio Brando ----------------------------------------------------------
  /** Dio — RÉSERVE de Stands HORS deck (Cream, Justice, Star Platinum, Silver Chariot,
   *  Hierophant green, Magician Red, The fool), séparée des deux pioches au setup.
   *  Chaque Stand entre en jeu par fetch quand sa carte invocatrice est jouée. The World
   *  n'est PAS ici (il est dans le deck Méchant). `undefined` pour les autres vilains. */
  standPile?: CardInstance[]
  /** Dio — cardId des Héros RETIRÉS DU JEU (Jotaro, Joseph) : vaincus, ils quittent la
   *  partie au lieu d'aller en défausse Fatalité (et débloquent The World + l'objectif). */
  removedFromGame?: string[]
  /** Dio — ZA WARUDO! est ACTIF ce tour : le joueur peut faire les actions de n'importe
   *  quel lieu (hors Fatalité), chacune coûtant un Pouvoir croissant. */
  zaWarudoActive?: boolean
  /** Dio — nombre d'actions déjà payées via ZA WARUDO! ce tour (coût de la suivante =
   *  ce compteur + 1). Remis à 0 en début de tour. */
  zaWarudoActionsDone?: number
  /** Dio — clés « locId:actionId » des actions HORS-Fatalité du royaume effectuées ce
   *  tour (pour l'objectif « toutes les actions en un même tour »). Remis à [] au début
   *  du tour. */
  dioRealmActionsThisTurn?: string[]
  /** Dio — posé quand les 14 actions hors-Fatalité ont été effectuées dans le tour : la
   *  vérification de victoire (combinée à Jotaro+Joseph retirés) se fait alors. */
  dioRealmSweepDone?: boolean
  /** Le Flagelleur Mental — latch : le Monde à l'Envers a été DÉBLOQUÉ (3 THE FLAYED
   *  réunis au moins une fois). Une fois posé, le déblocage est permanent — mais WILL
   *  BYERS, tant qu'il est présent, re-verrouille tout de même le lieu. */
  flayerGateUnlocked?: boolean
  /** Tamatoa — Étoile de mer Maui : au prochain tour, le déplacement de la figurine
   *  n'est pas obligatoire (le joueur peut rester sur place). */
  tamatoaSkipMoveNext?: boolean
  /** Syndrome — progression de l'Omnidroïde. `x8`/`x9`/`x10` = la version en jeu (ou
   *  l'attente de jouer la suivante : `x9-hand`/`x10-hand`) ; `destroyed` = v.10
   *  éliminé via la Télécommande (objectif rempli). `undefined` pour les autres. */
  omnidroidStage?: 'x8' | 'x9-hand' | 'x9' | 'x10-hand' | 'x10' | 'destroyed'
  /** Syndrome — tuiles Omnidroïde pas encore jouées (v.X9 puis v.10), dans l'ordre. */
  omnidroidPile?: CardInstance[]
  /** Syndrome (Fatalité Pas de Capes !) : au PROCHAIN tour, le déplacement est annulé
   *  (le pion reste sur place). Consommé au début du tour. */
  skipMoveForcedNextTurn?: boolean
  /** Sa Sucrerie (King Candy) — position du pion sur le circuit en huit (index 0..17
   *  dans `locations[0].actions`). Le déplacement est de 1 à 4 cases (au lieu d'un
   *  changement de lieu). `0` = case Départ/Arrivée. `undefined` pour les autres. */
  trackPos?: number
  /** Sa Sucrerie — position du jeton Pilote (Vanellope) sur le circuit (0..17), ou
   *  `null` s'il n'est pas en course. Le jeton COUVRE l'action où il se trouve. */
  racerPos?: number | null
  /** Sa Sucrerie — une COURSE est active (un Bug a été associé à Vanellope et lancé
   *  la course). King Candy gagne s'il franchit Départ/Arrivée avant le jeton Pilote. */
  raceActive?: boolean
  /** Sa Sucrerie (Turbo-Statique) : CE tour, King Candy peut utiliser ses 3 actions
   *  accessibles même si elles sont recouvertes (Héros ou jeton Pilote). Consommé en
   *  fin de tour. */
  turboUncoverThisTurn?: boolean
  /** Team Rocket — PILE DE CAPTURES : les Pokémon (Héros `isPokemon`) capturés via
   *  l'action Attraper (CATCH_POKEMON), conservés ici au lieu d'être défaussés.
   *  Objectif CAPTURE_POKEMON : en avoir ≥ count dont Pikachu. `undefined` ailleurs. */
  capturedPokemon?: CardInstance[]
  /** Mr. Monopoly — MAISONS posées sur les lieux du royaume ADVERSE (clé = id du lieu
   *  adverse, valeur = nombre de maisons, 0..4). 4 = HÔTEL (plafond). Quand le pion
   *  adverse arrive sur un lieu maisonné, Mr. Monopoly encaisse le loyer. Objectif
   *  POWER_THRESHOLD 30. `undefined` pour les autres vilains. */
  houses?: Record<LocationId, number>
  // --- Le Piégeur (Dead by Daylight) ---------------------------------------
  /** RÉSERVE hors-deck des 4 Survivants avant placement (vide une fois posés au setup).
   *  Sert aussi à retenir l'ordre ; `undefined` pour les autres vilains. */
  survivorPile?: CardInstance[]
  /** Le Piégeur — CROCHETS par lieu (1 par lieu au départ). `present` = un crochet est
   *  là (retiré quand un survivant y est éliminé) ; `disabledTurns` > 0 = désactivé par
   *  une carte Fatalité (Sabotage) pendant N tours. `undefined` pour les autres vilains.
   *  Les PIÈGES À OURS ne sont pas comptés ici : ils sont détectés par la présence de la
   *  carte-objet (cardId `custom-le-piegeur-piege-a-ours`) sur le lieu. */
  hooks?: Record<LocationId, { present: boolean; disabledTurns: number }>
  // --- Thanos (Pierres d'Infinité) -----------------------------------------
  /** RÉSERVE hors-deck des Pierres d'Infinité pas encore en jeu (6 au départ). Une Pierre
   *  en sort quand un adversaire la « récupère » (jouée comme Objet dans SON domaine).
   *  `undefined` pour les autres vilains. */
  stoneSupply?: CardInstance[]
  /** Zone COMPÉTENCES de Thanos : les Pierres CAPTURÉES (rapatriées dans son domaine).
   *  Objectif THANOS_STONES = en avoir 6. `undefined` pour les autres vilains. */
  stoneSkills?: CardInstance[]
  /** Alliés de Thanos DÉPLOYÉS dans le domaine d'un adversaire (en attente de rapatriement
   *  pour capturer une Pierre). `oppIndex` = l'adversaire concerné, `oppLocationId` = son lieu.
   *  Rapatrier l'Allié capture la Pierre présente sur ce lieu. `undefined` ailleurs. */
  deployedAllies?: { ally: CardInstance; oppIndex: number; oppLocationId: LocationId }[]
  // --- Michael Myers (Halloween) -------------------------------------------
  /** Palier de MAL INTÉRIEUR (1→3). Monte de 1 (plafond 3) à chaque Héros éliminé par le
   *  vilain. Niveau 2 : +1 carte piochée en fin de tour. Niveau 3 : toutes ses cartes
   *  coûtent 1 Pouvoir de moins. `undefined` pour les autres vilains. */
  malInterieur?: number
  /** ARME équipée (une seule à la fois) : Objet « associé à Meyers », hors board.
   *  `null` = aucune arme. `undefined` pour les autres vilains. */
  equippedWeapon?: CardInstance | null
  /** Héros hors-deck en réserve (LAURIE) : entrent en jeu via « Gardons le meilleur pour
   *  la fin ». Séparés du paquet Fatalité au setup. `undefined` pour les autres vilains. */
  reserveHeroes?: CardInstance[]
  /** Obsession : quand `true`, la remise à zéro de `noFate` est sautée une fois (pour que le
   *  blocage Fatalité survive au tour intermédiaire du vilain et frappe le PROCHAIN tour
   *  adverse). Consommé au début du tour du vilain. */
  noFateSkipReset?: boolean
  /** Aura effrayante : une action « Jouer une carte » gratuite est accordée au DÉBUT du
   *  prochain tour du vilain (converti en `grantedAction` puis consommé). */
  freePlayCardNextTurn?: boolean
  /** Couteau de cuisine : le vilain REJOUE un tour. À la fin de son tour, il rejoue (même
   *  joueur) au lieu de passer la main ; consommé à ce moment. */
  extraTurn?: boolean
}

/**
 * Oogie Boogie — ce qu'il faut faire du résultat d'un lancer de dés une fois
 * celui-ci confirmé (après modificateurs et éventuelles relances). Discriminé par
 * `kind` ; résolu par applyResolveDice.
 */
export type DiceOutcome =
  /** Imposteur Perce-Oreilles : ≥7 → succès (pile près de Sandy Claws, ou jeton
   *  Force -1 sur Jack s'il est revenu) ; ≤6 → la carte est défaussée (déjà partie
   *  en défausse par le flux de jeu : seul le compteur de succès est affecté). */
  | { kind: 'impostor' }
  /** Préparation de Noël : ≤7 → pioche 1 carte ; ≥8 → une action de royaume
   *  gratuite (hors Fatalité). */
  | { kind: 'making-christmas' }
  /** Mais quelle merveille ! : Vanquish déjà résolu (Alliés mis de côté). ≤7 →
   *  Alliés rendus en main ; ≥8 → Alliés restent sur leur lieu (non défaussés). */
  | { kind: 'merveille'; allyInstanceIds: string[]; locationId: LocationId }
  /** Joyeux Halloween ! (Condition) : ≥8 → gagne le total en Pouvoir ; ≤7 → vole
   *  1 Pouvoir à l'adversaire `targetIndex`. */
  | { kind: 'trick-or-treat'; targetIndex: number }

/**
 * Oogie Boogie — fenêtre de résolution d'un lancer de dés. Ouverte dès qu'une
 * carte lance les 2 dés : le joueur voit le résultat (déjà modifié par Gram /
 * Salut Oogie !), peut RELANCER un dé avec un Dés pipés (RESOLVE_DICE_REROLL),
 * puis confirme (RESOLVE_DICE) pour appliquer l'`outcome`.
 */
export interface PendingDice {
  playerIndex: number
  /** Valeurs faciales des deux dés (après relances). */
  dice: [number, number]
  /** Modificateur appliqué au total (Gram +1, Salut Oogie ! -2 chacun…). */
  modifier: number
  /** Total effectif = dice[0] + dice[1] + modifier. */
  total: number
  /** Libellé de la carte/contexte (journal + modale). */
  context: string
  /** Id de la carte à l'origine du lancer (affichée à côté de la modale). */
  cardId?: string
  /** Ce qu'il faut faire du total une fois confirmé. */
  outcome: DiceOutcome
  /** Vrai si le joueur peut encore relancer (un Dés pipés en main). Recalculé. */
  canReroll: boolean
  /** Oogie — Cette fois l'affaire est dans le sac : le joueur CHOISIT le résultat des
   *  dés (au lieu de lancer). Le bot garde l'auto-best (dice par défaut). */
  chooseDice?: boolean
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
  /** Durée réelle écoulée depuis le début de la partie, en millisecondes. ESTAMPILLÉE
   *  par la couche UI/store (le moteur ne lit jamais l'horloge : déterminisme). Sert au
   *  garde-fou de jouabilité de la Condition « Monotonie » de Mr. Monopoly (≥ 10 min).
   *  `undefined` tant que l'UI ne l'a pas renseignée (≈ 0). */
  elapsedMs?: number
  phase: TurnPhase
  /** Ids des actions déjà exécutées ce tour-ci par le joueur actif. */
  usedActionIds: string[]
  /** Michael Myers — Aura effrayante : fenêtre de réaction de FIN DE TOUR. Quand le joueur
   *  actif (`endingPlayer`) termine son tour SANS avoir joué de carte, le tour est mis en
   *  PAUSE ici (avant de passer la main) pour laisser les non-actifs jouer une Condition
   *  `reactAtEndOfTurn` (Aura). Un nouvel END_TURN referme la fenêtre et passe la main.
   *  `null`/absent hors de cette fenêtre. */
  endTurnReaction?: { endingPlayer: number } | null
  /** Pat Hibulaire — Bandit : après avoir joué un Bandit, `playerIndex` peut en
   *  enchaîner d'AUTRES sur le même lieu (`locationId`) dans la même action « Jouer
   *  une carte » (chacun paie son coût) — RESOLVE_BANDIT_CHAIN. `null`/absent sinon. */
  pendingBanditChain?: { playerIndex: number; locationId: LocationId } | null
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
  /** Tamatoa — Piégé : comme `uncoverCoveredActions`, mais les actions FATALITÉ recouvertes
   *  restent indisponibles (« sauf Fatalité »). Réinitialisé chaque tour. */
  uncoverExceptFate?: boolean
  /** Shere Khan — Bravo ! Bravo ! : ce tour-ci, le joueur peut aussi utiliser les actions
   *  recouvertes par un jeton FEU sur le lieu de son pion. Réinitialisé chaque tour. */
  uncoverFireThisTurn?: boolean
  /** Force du dernier Héros vaincu CE TOUR (Méchanceté trigger). Reset à
   *  chaque fin de tour. */
  lastVanquishedHeroStrength?: number
  /** Coût de la DERNIÈRE carte jouée par le joueur actif CE TOUR (Syndrome — « Qui est
   *  le plus super ? » : gagne autant de Pouvoir que ce coût). Reset au début du tour. */
  lastPlayedCardCost?: number
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
    source: 'trap' | 'gnous' | 'uniforme' | 'duncan' | 'race-ban'
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
    /** Défausse FACULTATIVE d'un nombre LIBRE de cartes (0 inclus), au lieu d'exactement
     *  `count` (Madame de Trémaine : J'allais oublier un détail). */
    optional?: boolean
    /** Après la défausse, compléter la main jusqu'à `drawTo` cartes (au lieu de
     *  `thenDraw`). Madame de Trémaine : J'allais oublier un détail (= 4). */
    drawTo?: number
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
  /** Oogie — Qu'est-ce que le Père Noël t'a apporté ? : le joueur défausse autant de
   *  cartes qu'il veut de sa main (RESOLVE_DISCARD_THEN_DRAW), puis pioche `draw`. */
  pendingDiscardThenDraw?: { playerIndex: number; draw: number; powerPerCard?: number } | null
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
   * Mauvais Coup (Pat Hibulaire) : `playerIndex` a révélé les 2 dernières cartes
   * de sa pioche (`cards`, dans l'ordre de la pioche — `cards[1]` est tout en bas)
   * et doit en choisir 1 à prendre en main, l'autre repartant sur le DESSUS ou le
   * DESSOUS de la pioche (RESOLVE_MAUVAIS_COUP). Absent / `null` hors de ce choix.
   */
  pendingMauvaisCoup?: { playerIndex: number; cards: CardInstance[] } | null
  /**
   * Sournois (Pat Hibulaire) : `playerIndex` a pioché 2 cartes et doit maintenant
   * choisir 1 carte de sa main à replacer sur le DESSUS ou le DESSOUS de sa pioche
   * (RESOLVE_SOURNOIS). Choix PRIVÉ (rien au journal). Absent / `null` sinon.
   */
  pendingSournois?: { playerIndex: number } | null
  /**
   * Dingo (Pat Hibulaire) : `chooserIndex` (joueur ayant posé la Fatalité) peut
   * intervertir 2 tuiles Objectif voisines de `targetIndex` (déplacer 1 tuile vers
   * un lieu « libre » = échanger avec une tuile remplie). Résolu par RESOLVE_DINGO
   * (facultatif). Absent / `null` hors de ce choix.
   */
  pendingDingo?: { chooserIndex: number; targetIndex: number } | null
  /**
   * Cheval (Pat Hibulaire) : `playerIndex` peut déplacer un Allié ou un Objet de son
   * royaume sur n'importe quel lieu (RESOLVE_ALLY_ITEM_MOVE). Facultatif. Absent /
   * `null` hors de ce choix.
   */
  pendingAllyItemMove?: { playerIndex: number; beneficial: boolean } | null
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
    /** Sombra — Glitch : une carte de Piratage/IEM ne compte pas comme « Objet ». */
    excludePiratage?: boolean
  } | null
  /**
   * Ratigan — Le Grand Génie du Mal / Gaston — Sous le charme : `playerIndex` choisit
   * entre piocher `draw` cartes OU gagner `power` Pouvoir (RESOLVE_DRAW_OR_GAIN_POWER).
   * `cardId` = carte source (pour l'affichage du modal) ; défaut = Le Grand Génie du
   * Mal. Absent / `null` hors de ce choix.
   */
  pendingDrawOrGainPower?: { playerIndex: number; draw: number; power: number; cardId?: string } | null
  /** Michael Myers — Trace de sang (Objet activé) : `playerIndex` choisit entre gagner
   *  `power` Pouvoir (RESOLVE_BLOOD_TRACE 'power') et déplacer un Héros vers un lieu voisin
   *  (RESOLVE_BLOOD_TRACE 'move' → pendingHeroRelocate). Absent / `null` sinon. */
  pendingBloodTrace?: { playerIndex: number; power: number } | null
  /** Michael Myers — Arme du crime : `playerIndex` choisit une ARME parmi `candidateIds`
   *  (cartes de sa PIOCHE), puis l'ajoute à sa main OU paie son coût et l'équipe
   *  (RESOLVE_WEAPON_FETCH `equip`). Facultatif (peut ne rien prendre). Absent / `null` sinon. */
  pendingWeaponFetch?: { playerIndex: number; candidateIds: string[] } | null
  /** La Bonne Fée — Infiltration (Fatalité) : `playerIndex` (la CIBLE) choisit de
   *  défausser une carte de sa main OU de perdre `lose` Pouvoir (RESOLVE_INFILTRATION).
   *  Ouvert uniquement quand la main n'est pas vide (sinon perte de Pouvoir auto). */
  pendingInfiltration?: { playerIndex: number; lose: number } | null
  /** Sa Sucrerie — Mémoire Verrouillée : choix « gagner `power` Pouvoir » OU « reculer
   *  le jeton Pilote de `racerBack` » (RESOLVE_POWER_OR_RACER_BACK). Ouvert seulement en
   *  course active. */
  pendingPowerOrRacerBack?: { playerIndex: number; power: number; racerBack: number } | null
  /** Sa Sucrerie — Taffyta Crème Brûlée : `playerIndex` choisit entre « reculer le Pilote
   *  de 2 » et « effectuer une action Jouer une carte gratuite » (RESOLVE_TAFFYTA_CHOICE).
   *  N'apparaît que si LES DEUX sont possibles (sinon la seule option s'applique). */
  pendingTaffytaChoice?: { playerIndex: number } | null
  /** Sa Sucrerie — L'important, c'est de payer : `playerIndex` choisit combien de jetons
   *  Pouvoir dépenser (1 à `max`) pour avancer son pion d'autant (RESOLVE_PAY_RACE). */
  pendingPayRace?: { playerIndex: number; max: number } | null
  /** Mr. Monopoly — Affaire : `playerIndex` choisit combien de MAISONS (1 à `max`) poser
   *  sur le lieu adverse `locationId` (chacune coûte `unitCost` Pouvoir). RESOLVE_BUY_HOUSES. */
  pendingBuyHouses?: { playerIndex: number; locationId: LocationId; max: number; unitCost: number } | null
  /** Mr. Monopoly — Carte bancaire : déplacer des maisons. Phase 'from' : choisir le lieu
   *  source parmi `sources` (lieux maisonnés). Phase 'to' : choisir le lieu destination
   *  parmi `dests`. `remaining` maisons restant à déplacer ; `from` = source en cours.
   *  `destroy` = mode destruction (retire au lieu de déplacer). RESOLVE_MOVE_HOUSES. */
  pendingMoveHouses?: {
    playerIndex: number
    phase: 'from' | 'to'
    remaining: number
    from?: LocationId
    destroy?: boolean
  } | null
  /** Mr. Monopoly — Libéré de prison (Fatalité) : `chooserIndex` (le fataliseur) choisit de
   *  déplacer un Héros du royaume `targetIndex` (RESOLVE_FREE_FROM_JAIL avec heroInstanceId +
   *  locationId), ou d'envoyer le pion de Mr. Monopoly à la Prison (`toPrison`). */
  pendingFreeFromJail?: { chooserIndex: number; targetIndex: number; prisonLocationId: LocationId } | null
  /** Mr. Monopoly — Reculez de trois cases : `playerIndex` choisit le lieu où déplacer son
   *  pion (RESOLVE_BACKWARD_MOVE), après quoi il ne pourra effectuer qu'UNE action puis finir. */
  pendingBackwardMove?: { playerIndex: number } | null
  /** Mr. Monopoly — `noFateThisTurn` : pendant la fenêtre « Reculez de trois cases », l'action
   *  Fatalité est interdite (l'unique action accordée doit être hors Fatalité). */
  monopolyNoFate?: boolean
  /** Mr. Monopoly — Canne : `playerIndex` choisit une action EMPRUNTÉE parmi `options`
   *  (actions hors Fatalité des lieux adverses maisonnés). RESOLVE_CANNE_BORROW. */
  pendingCanneBorrow?: { playerIndex: number; options: { locationId: LocationId; actionId: string; label: string }[] } | null
  /** Sa Sucrerie — Princesse Vanellope (Fatalité) : `chooserIndex` (le fataliseur) choisit
   *  de combien (0 à `max`) reculer le pion King Candy de `playerIndex` (RESOLVE_PAWN_BACK). */
  pendingPawnBack?: { playerIndex: number; chooserIndex: number; max: number } | null
  /** Sa Sucrerie — Le Faisceau (Fatalité) : `chooserIndex` (le fataliseur) agit sur le
   *  royaume de `playerIndex` (Sa Sucrerie). Phase 'pick-location' : choisir le lieu de
   *  rassemblement (`locationIds`). Phase 'discard' : défausser FACULTATIVEMENT un Cybug
   *  (`cybugIds`) du lieu rassemblé. RESOLVE_BEACON. */
  pendingBeacon?: {
    playerIndex: number
    chooserIndex: number
    kind: 'pick-location' | 'discard'
    locationIds?: LocationId[]
    cybugIds?: string[]
  } | null
  /** Sa Sucrerie — Médaille de Vanellope (Fatalité) : `chooserIndex` (le fataliseur) joue un
   *  Héros de la défausse Fatalité de `playerIndex` (Sa Sucrerie) avec +1 Force. Phase
   *  'pick-hero' (`heroIds`) puis 'pick-location' (`heroInstanceId` choisi, `locationIds`).
   *  RESOLVE_MEDAL. */
  pendingMedal?: {
    playerIndex: number
    chooserIndex: number
    kind: 'pick-hero' | 'pick-location'
    heroIds?: string[]
    heroInstanceId?: string
    locationIds?: LocationId[]
  } | null
  /** Madame de Trémaine — C'est votre dernière chance : `playerIndex` choisit entre
   *  effectuer une action « Déplacer un Objet ou un Allié » et une action « Activer »
   *  (RESOLVE_MOVE_OR_ACTIVATE). N'apparaît que si LES DEUX sont possibles. */
  pendingMoveOrActivate?: { playerIndex: number } | null
  /** Shere Khan — Tout le monde fuit : `playerIndex` choisit entre effectuer une action
   *  « Activer une capacité » et une action « Éliminer un Héros » (RESOLVE_ACTIVATE_OR_VANQUISH).
   *  N'apparaît que si LES DEUX sont possibles. */
  pendingActivateOrVanquish?: { playerIndex: number } | null
  /** Le Flagelleur Mental — Will sous emprise : `playerIndex` choisit quel deck consulter
   *  (Méchant = gratuit, Fatalité = `fateExtraCost` Pouvoir en plus) avant de regarder ses
   *  `count` premières cartes et de les réordonner (RESOLVE_SCRY_DECK_CHOICE → pendingFateReorder). */
  pendingScryDeckChoice?: { playerIndex: number; count: number; fateExtraCost: number } | null
  /** Shere Khan — C'est moi, Shere Khan : `playerIndex` choisit quel jeton Feu retirer
   *  (lieu + action) quand il y en a plusieurs (RESOLVE_REMOVE_FIRE). */
  pendingRemoveFire?: { playerIndex: number } | null
  /** Shere Khan — pose interactive d'un jeton Feu : `chooserIndex` choisit l'action du
   *  royaume de `targetIndex` à recouvrir (RESOLVE_PLACE_FIRE). Deux cas :
   *   - Feu Rouge des Hommes (Fatalité) : le fataliseur choisit, n'importe quel lieu.
   *   - Mowgli (à son arrivée) : Shere Khan choisit, mais UNIQUEMENT sur son lieu d'arrivée
   *     (`locationId` renseigné → le choix est restreint à ce lieu). */
  pendingPlaceFire?: { chooserIndex: number; targetIndex: number; locationId?: string } | null
  /** Shere Khan — Lancé sur ses traces : `playerIndex` choisit quel Héros de son royaume
   *  éliminer (gratuitement) quand il y en a plusieurs (RESOLVE_SHERE_KHAN_DEFEAT). */
  pendingShereKhanDefeat?: { playerIndex: number } | null
  /** Shere Khan — C'est à moi que vous le direz : `playerIndex` PEUT choisir une carte de
   *  sa défausse Fatalité à remélanger dans sa pioche Fatalité, ou passer (RESOLVE_RECOVER_FATE). */
  pendingRecoverFate?: { playerIndex: number } | null
  /** Shere Khan — À toi de jouer, cousin : `playerIndex` joue gratuitement l'Allié `ally`
   *  (dévoilé) sur le lieu de son choix (RESOLVE_FREE_PLAY_ALLY). */
  pendingFreePlayAlly?: { playerIndex: number; ally: CardInstance } | null
  /** Grand Councilwoman — RAPPORT (Objet dévoilé) / CAPITAINE GANTU (carte de la défausse) :
   *  `playerIndex` joue GRATUITEMENT la carte `card` avec placement interactif
   *  (RESOLVE_FREE_PLAY_CARD ; `targetId` = lieu de pose, ou instanceId de l'hôte pour un
   *  Objet associé à un Héros/Allié). `label` = source (journal). */
  pendingFreePlayCard?: { playerIndex: number; card: CardInstance; label: string } | null
  /** Grand Councilwoman — CAPITAINE GANTU : `playerIndex` choisit (facultatif) une carte de
   *  sa défausse Méchant (`candidateIds`) à jouer gratuitement (→ pendingFreePlayCard).
   *  RESOLVE_PICK_DISCARD_TO_PLAY (`instanceId` absent = ne rien jouer). */
  pendingPickDiscardToPlay?: { playerIndex: number; candidateIds: string[] } | null
  /** Shere Khan — Jeune et sans défense : `playerIndex` choisit (kind 'choose') de déplacer
   *  un Héros sur le lieu d'un Allié (kind 'pick-hero' → 'pick-ally') ou de gagner 1 Pouvoir
   *  par Allié. `heroInstanceId` = Héros retenu pour le déplacement. RESOLVE_YOUNG. */
  pendingYoung?: { playerIndex: number; kind: 'choose' | 'pick-hero' | 'pick-ally'; heroInstanceId?: string } | null
  /** Shere Khan — Aie confiance : `playerIndex` choisit jusqu'à `remaining` cartes de sa
   *  défausse (`chosen` = déjà choisies) à remélanger dans sa pioche (RESOLVE_RECOVER_TO_DECK). */
  pendingRecoverToDeck?: { playerIndex: number; remaining: number; chosen: string[] } | null
  /** Shere Khan — C'est très intéressant : `playerIndex` effectue une ou plusieurs actions
   *  parmi gagner 1 Pouvoir / piocher 1 / déplacer 1 jeton Feu (`done` = déjà faites).
   *  RESOLVE_INTERESSANT. */
  pendingInteressant?: { playerIndex: number; done: ('power' | 'draw' | 'fire')[] } | null
  /** Shere Khan — Kaa (capacité activée) : choisir un Objet de la défausse à jouer (payer
   *  son coût, l'associer à Kaa sur `locationId`). RESOLVE_KAA_PLAY. */
  pendingKaaPlay?: { playerIndex: number; hostInstanceId: string; locationId: LocationId } | null
  /** Shere Khan — Le Roi Singe (capacité activée) : déplacer une carte Macaques vers
   *  n'importe quel lieu. `macaqueInstanceId` est choisi d'abord (si plusieurs), puis le
   *  lieu de destination. RESOLVE_MONKEY_KING. */
  pendingMonkeyKing?: { playerIndex: number; macaqueInstanceId?: string } | null
  /** Shere Khan — Kaa (bouclier) : lors d'un Vanquish où Kaa serait défaussé, le joueur
   *  peut défausser UN Objet associé à sa place (ou rien). Le Vanquish est rejoué avec la
   *  décision. RESOLVE_KAA_SHIELD. */
  pendingKaaShield?: {
    playerIndex: number
    heroInstanceId: string
    allyInstanceIds: string[]
    itemInstanceIds: string[]
    raceBan: boolean
  } | null
  // --- Davy Jones (Jetons Trésor) ------------------------------------------
  /** Davy Jones : `playerIndex` choisit un Héros (sans trésor) — `heroInstanceId` — puis
   *  QUEL jeton Trésor de la réserve y poser face cachée (RESOLVE_PLACE_TREASURE, 2 phases). */
  pendingPlaceTreasure?: { playerIndex: number; heroInstanceId?: string } | null
  /** Davy Jones : `playerIndex` choisit un Héros porteur d'un trésor face cachée à
   *  RÉVÉLER, parmi `candidateIds` (RESOLVE_REVEAL_TREASURE). */
  pendingRevealTreasure?: { playerIndex: number; candidateIds: string[] } | null
  /** Davy Jones — Les amis deviennent des ennemis : `playerIndex` choisit un Héros source
   *  (`fromHeroId`) puis un Héros cible ; échange/déplace les trésors (RESOLVE_MOVE_SWAP_TREASURE). */
  pendingMoveSwapTreasure?: { playerIndex: number; fromHeroId?: string } | null
  /** Davy Jones — Réveillez le Kraken ! : `playerIndex` choisit un Allié à défausser avant
   *  de jouer Le Kraken gratuitement sur le lieu du pion (RESOLVE_WAKE_KRAKEN). */
  pendingWakeKraken?: { playerIndex: number } | null
  /** Tamatoa — « Pas exactement l'heure de Maui » : la 1ʳᵉ carte de la pioche Maui est
   *  dévoilée (toujours en tête de `mauiDeck`) ; `playerIndex` choisit de la JOUER ou de
   *  la DÉFAUSSER (RESOLVE_MAUI_CHOICE). */
  pendingMauiChoice?: { playerIndex: number } | null
  /** Dio — `playerIndex` choisit un Allié de son royaume à défausser (The World épargné),
   *  pour gagner `gain` Pouvoir ET/OU piocher `draw` cartes (RESOLVE_DIO_DISCARD_ALLY). */
  pendingDioDiscardAlly?: { playerIndex: number; gain?: number; draw?: number; bonusCardId?: string; bonusPower?: number } | null
  /** Dio — CREAM (Stand de Vanilla Ice) : `playerIndex` choisit un Héros (`candidateIds`,
   *  force < Vanilla Ice) sur `locationId` à défausser (RESOLVE_DIO_CREAM). */
  pendingDioCream?: { playerIndex: number; locationId: LocationId; candidateIds: string[] } | null
  /** Dio — MUDA! : le Pouvoir (5) est DÉJÀ gagné ; `playerIndex` choisit (facultatif) un
   *  Héros (`candidateIds`) de son lieu à éliminer en plus (RESOLVE_DIO_MUDA). */
  pendingDioMuda?: { playerIndex: number; candidateIds: string[] } | null
  /** Dio — Lumière du Soleil (Fatalité) : DIO (`playerIndex`) choisit entre défausser sa main
   *  et perdre `lose` Pouvoir (RESOLVE_DIO_SUNLIGHT). */
  pendingDioSunlight?: { playerIndex: number; lose: number } | null
  /** Pyramid Head — Pacte de Sang : `playerIndex` choisit une carte de sa main à défausser
   *  (RESOLVE_PACTE_SANG) ; on enchaîne ensuite sur un pendingRecover (même type). */
  pendingPacteSang?: { playerIndex: number } | null
  /** Pyramid Head — Sacrifice Humain : `playerIndex` choisit « regarder 3 / garder 1 » OU
   *  « gagner 2 Pouvoir » (RESOLVE_SACRIFICE). */
  pendingSacrifice?: { playerIndex: number } | null
  /** Pyramid Head — Cage de l'Expiation : `playerIndex` choisit le lieu où déplacer le Héros
   *  `heroInstanceId` (porteur de la Cage) — RESOLVE_CAGE_MOVE. */
  pendingCageMove?: { playerIndex: number; heroInstanceId: string } | null
  /** Le Seigneur des Ténèbres — Montre-moi le Chaudron Magique / Nous avons conclu un
   *  marché : `playerIndex` choisit entre s'emparer du Chaudron Magique et gagner
   *  `power` Pouvoir (RESOLVE_CAULDRON_CHOICE). N'apparaît que si le Chaudron est encore
   *  à s'emparer (sinon on gagne directement le Pouvoir). */
  pendingCauldronChoice?: { playerIndex: number; power: number } | null
  /** Le Seigneur des Ténèbres — Nous avons conclu un marché ! : `playerIndex` choisit
   *  entre « mélanger sa défausse dans sa pioche » et « payer `power` Pouvoir pour
   *  défausser l'Épée Magique et s'emparer du Chaudron » (RESOLVE_BARGAIN_CHOICE).
   *  N'apparaît que si LES DEUX options sont possibles. */
  pendingBargainChoice?: { playerIndex: number; power: number } | null
  /** Le Seigneur des Ténèbres — Nous touchons du doigt la victoire : `playerIndex` joue
   *  gratuitement un Objet de sa main sur un lieu (RESOLVE_FREE_ITEM_PLAY) ou renonce
   *  (SKIP_FREE_ITEM_PLAY). */
  pendingFreeItemPlay?: { playerIndex: number } | null
  /** Madame de Trémaine — Je ne reviens jamais : `playerIndex` regarde `cards` (top de
   *  sa pioche Fatalité) et les replace dans l'ordre de son choix (RESOLVE_FATE_REORDER).
   *  `deck` = pioche concernée : 'fate' (défaut), 'merlin' (Madame Mim — Pas de Tricherie,
   *  regarde le dessus de la pioche de Métamorphoses de Merlin) ou 'villain' (Sa Sucrerie —
   *  Aigre Bill, replace sur le dessus de la pioche Méchant). */
  pendingFateReorder?: {
    playerIndex: number
    cards: CardInstance[]
    deck?: 'fate' | 'merlin' | 'villain' | 'villain-split2'
    /** Qui ORDONNE (défaut = playerIndex, le propriétaire). Sa Sucrerie — Niveau Inachevé :
     *  le fataliseur ordonne la pioche Méchant de l'adversaire. */
    chooserIndex?: number
  } | null
  /** Sa Sucrerie — Aigre Bill (joué OU déplacé, FACULTATIF) : `playerIndex` choisit de
   *  fouiller (dévoiler sa pioche Méchant jusqu'à un Allié → main, puis réordonner le
   *  reste sur le dessus) ou de renoncer (RESOLVE_AIGRE_BILL). */
  pendingAigreBill?: { playerIndex: number } | null
  /**
   * Mère Gothel — Lance-moi ta chevelure : `chooserIndex` choisit de combien de
   * lieux (parmi `options`) ramener Raiponce vers la Tour (RESOLVE_RAIPONCE_HOMEWARD).
   * N'apparaît que lorsqu'il y a ≥ 2 possibilités (sinon le déplacement est auto).
   */
  pendingRaiponceHomeward?: {
    chooserIndex: number
    options: { steps: number; locationId: LocationId; locationName: string }[]
  } | null
  /**
   * Mère Gothel — Frères Stabbington : un Allié vient d'être joué sur le lieu de
   * Raiponce ; `chooserIndex` PEUT la déplacer sur la Tour (RESOLVE_RAIPONCE_TO_TOWER,
   * `move` true/false). Absent / `null` hors de ce choix.
   */
  pendingRaiponceToTower?: { chooserIndex: number } | null
  /**
   * Cruella d'Enfer — choix d'une Tuile Chiots de la réserve à ajouter sur son lieu
   * indiqué. `candidateTileIds` = tuiles de la réserve éligibles ; `label` = titre.
   * Résolu par RESOLVE_PUPPY_ADD. Absent / `null` hors de ce choix.
   */
  pendingPuppyAdd?: { playerIndex: number; candidateTileIds: string[]; label: string } | null
  /**
   * Cruella d'Enfer — Repéré ! : `playerIndex` peut révéler jusqu'à `remaining`
   * Tuiles Chiots FACE CACHÉE de la réserve (en cliquant dessus). Résolu par
   * RESOLVE_PUPPY_REVEAL (une tuile) ou DONE_PUPPY_REVEAL (arrêter). `null` sinon.
   */
  pendingPuppyReveal?: { playerIndex: number; remaining: number } | null
  /** Tabbou — Dévoiler des Combattants : `playerIndex` retourne jusqu'à `remaining`
   *  tuiles FACE CACHÉE de la grille (clic direct sur les dos) — pioche → réserve.
   *  RESOLVE_FIGHTER_REVEAL (une tuile) ou DONE_FIGHTER_REVEAL (arrêter). `null` sinon. */
  pendingFighterReveal?: { playerIndex: number; remaining: number } | null
  /** Tabbou — Tuer des Combattants d'une même couleur : `playerIndex` choisit une
   *  couleur présente dans la réserve (RESOLVE_FIGHTER_KILL_COLOR) ; toutes les tuiles
   *  de cette couleur sont tuées. `null` sinon. */
  pendingFighterKillColor?: { playerIndex: number } | null
  /** Tabbou — Coup Fatal : `playerIndex` tue jusqu'à `remaining` tuiles Combattants de
   *  la réserve (RESOLVE_FIGHTER_KILL_FREE une tuile, DONE_FIGHTER_KILL_FREE arrête).
   *  `null` sinon. */
  pendingFighterKillFree?: { playerIndex: number; remaining: number } | null
  /** Tabbou — Destin : `playerIndex` choisit « Dévoiler 3 Combattants » OU « Gagner 4
   *  Pouvoir » (RESOLVE_DESTIN_CHOICE). `null` sinon. */
  pendingDestinChoice?: { playerIndex: number } | null
  /**
   * Cruella d'Enfer — Horace : quand SES DEUX options sont possibles (capturer une
   * Tuile Chiots sur son lieu OU en amener une de la réserve), `playerIndex` choisit
   * (RESOLVE_HORACE_CHOICE). `locationId` = lieu d'Horace. `null` sinon.
   */
  pendingHoraceChoice?: { playerIndex: number; locationId: LocationId } | null
  /**
   * Cruella d'Enfer — capture de Tuiles Chiots avec CHOIX : plus de tuiles posées
   * sur `locationId` que le nombre capturable → `playerIndex` choisit lesquelles
   * (RESOLVE_PUPPY_CAPTURE), `remaining` restant à capturer. `null` sinon.
   */
  pendingPuppyCapture?: { playerIndex: number; locationId: LocationId; remaining: number } | null
  /**
   * Gaston — retrait/replacement interactif de jetons Obstacle. `chooserIndex`
   * clique un lieu (RESOLVE_OBSTACLE) ou termine (DONE_OBSTACLE) ; `targetIndex` =
   * propriétaire des Obstacles (Gaston). `kind` : 'remove' (cartes de Gaston) ou
   * 'replace' (Fatalité adverse). `remaining` : clics restants. `sameLocation` (remove) :
   * tous depuis un seul lieu, verrouillé par `lockedLocationId`. `fillLocation` (replace) :
   * un clic remplit le lieu choisi (Vous m'avez sauvé la vie). `label` : titre affiché.
   */
  pendingObstacle?: {
    chooserIndex: number
    targetIndex: number
    kind: 'remove' | 'replace'
    remaining: number
    sameLocation?: boolean
    fillLocation?: boolean
    lockedLocationId?: LocationId | null
    label: string
    /** Gaston — Sous le charme : suivi déclenché à la fermeture du pending (choix
     *  gagner Pouvoir / piocher). */
    then?: { drawOrGain: { draw: number; power: number; cardId?: string } }
  } | null
  /**
   * Gaston — Belle est à moi / Tous avec moi : action gratuite armée de type
   * `actionType`, exécutable depuis le lieu du pion (PERFORM_GRANTED_ACTION) ou
   * déclinée (SKIP_GRANTED_ACTION). `null`/absent hors de cette fenêtre.
   */
  grantedAction?: { playerIndex: number; actionType: LocationActionType; label: string } | null
  /**
   * Le Seigneur des clés — choix interactif d'une clé. `kind` : 'take' (ramasser une
   * clé présente sur `locationId`) ou 'lose' (rendre une clé POSSÉDÉE au plateau).
   * `then` : suivi après un 'lose' (gagner Pouvoir / piocher). Résolu par RESOLVE_KEY.
   */
  pendingKey?: {
    playerIndex: number
    kind: 'take' | 'lose'
    locationId?: LocationId
    /** Filtre de couleur (prise au dé) : seules les clés de cette couleur sont prenables. */
    color?: KeyColor
    /** 'lose' : si vrai, le joueur choisit AUSSI le lieu où reposer la clé (un lieu
     *  comptant < 3 clés). Sinon la clé revient sur le lieu du pion. */
    chooseDest?: boolean
    then?: { gainPower?: number; draw?: number }
    label: string
  } | null
  /** Le Seigneur des clés — dernier lancer du dé de couleur, pour l'animation UI.
   *  `seq` croît à chaque lancer ; `by` = index du joueur qui lance. */
  dieRoll?: { seq: number; color: KeyColor; by: number } | null
  /** Le Seigneur des clés — 00:00 : `playerIndex` choisit une couleur (RESOLVE_KEY_COLOR),
   *  puis le dé est lancé automatiquement. */
  pendingKeyColor?: { playerIndex: number } | null
  /** Le Seigneur des clés — Plaisir ou souffrance : le Seigneur choisit perdre `power`
   *  Pouvoir OU reposer une clé (RESOLVE_PLAISIR). */
  pendingPlaisir?: { playerIndex: number; power: number } | null
  /**
   * Le Seigneur des clés — Fatalité interactive où l'ADVERSAIRE (`chooserIndex`)
   * choisit une clé POSSÉDÉE du Seigneur (`targetIndex`). `mode` : 'steal' (Gévaudan :
   * la clé est volée par le Héros `hostInstanceId`) ou 'return' (Sorcellerie : la clé
   * est reposée sur un lieu choisi). Résolu par RESOLVE_STEAL_KEY.
   */
  pendingStealKey?: {
    chooserIndex: number
    targetIndex: number
    mode: 'steal' | 'return'
    hostInstanceId?: string
    /** Nombre de clés restant à voler (Gévaudan en vole 2). Défaut : 1. */
    count?: number
  } | null
  /** Le Seigneur des clés — dernière couleur obtenue au dé (affichage UI). */
  lastDieColor?: KeyColor | null
  /** Oogie Boogie — dernier lancer des 2 dés, pour l'animation UI. `seq` croît à
   *  chaque lancer (relances comprises) ; `by` = index du joueur qui lance. */
  diceRoll?: { seq: number; dice: [number, number]; total: number; modifier: number; by: number; context: string; cardId?: string } | null
  /** Oogie Boogie — fenêtre de résolution d'un lancer en cours (RESOLVE_DICE /
   *  RESOLVE_DICE_REROLL). `null` hors d'un lancer. */
  pendingDice?: PendingDice | null
  /** Oogie Boogie — Préparation de Noël (≥8) : `playerIndex` peut effectuer UNE
   *  action de royaume gratuite (hors Fatalité), puis RESOLVE/skip. */
  pendingFreeRealmAction?: { playerIndex: number } | null
  /** Oogie Boogie — Cette fois l'affaire est dans le sac : pendant le rejeu d'un
   *  Événement, tout lancer de dés est CONTRÔLÉ (résolu au meilleur résultat). */
  bagControlledDice?: boolean | null
  /**
   * Gaston — La Rose (Fatalité) : chaîne en cours. `phase` :
   *  - 'play-other' : l'autre carte révélée avec la Rose est en train d'être jouée ;
   *    une fois résolue, on pioche 2 cartes Fatalité (→ 'play-new').
   *  - 'play-new'   : une des 2 cartes piochées est en train d'être jouée ; une fois
   *    résolue, on retire 1 Obstacle et la chaîne se termine.
   * Avancée automatiquement par syncRoseChain quand plus aucun choix n'est en attente.
   */
  roseChain?: { target: number; phase: 'play-other' | 'play-new' } | null
  /**
   * Cruella d'Enfer — Quels idiots ! : `phase` = 'choose' (déplacer un Allié OU en
   * chercher un), puis 'move' / 'tutor' (choix de l'Allié parmi `candidateIds`).
   * `canMove`/`canTutor` : options offertes au choix initial. Résolu par
   * RESOLVE_QUELS_IDIOTS (choix) puis RESOLVE_QUELS_IDIOTS_PICK (Allié). `null` sinon.
   */
  pendingQuelsIdiots?: {
    playerIndex: number
    phase: 'choose' | 'move' | 'tutor'
    canMove?: boolean
    canTutor?: boolean
    candidateIds?: string[]
  } | null
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
    /** Madame de Trémaine — La Clé : le Héros déplacé reçoit un jeton Enfermé (piège). */
    thenTrap?: boolean
    /** Oogie Boogie — Diversion : après le déplacement, défausse un Allié ou un Objet sur
     *  le lieu d'arrivée (ouvre pendingDiversionDiscard). */
    thenDiscardAllyItem?: boolean
    /** Davy Jones — La Poursuite : destinations AUTORISÉES restreintes à ces lieux (ceux
     *  portant un Allié). Combiné avec `anyLocation` (sinon = voisins). Absent = pas de
     *  restriction supplémentaire. */
    allowedLocationIds?: LocationId[]
    /** Gaston — Mrs Samovar et Zip : mode « plusieurs Héros ». Après chaque déplacement,
     *  le pending SE ROUVRE avec les `candidateIds` restants (le Héros déplacé est retiré),
     *  jusqu'à ce qu'il n'en reste plus ou que le joueur s'arrête (optional). */
    repeatCandidates?: boolean
  } | null
  /**
   * Le Piégeur — choix interactif d'une carte d'attaque, en DEUX phases :
   *  - `phase: 'target'` : choisir QUEL Survivant cibler (clic sur un Survivant de
   *    `candidateIds`) — révéler / blesser / accrocher / achever / déplacer ;
   *  - `phase: 'dest'` : choisir vers quel lieu VOISIN déplacer `chosenSurvivorId`
   *    (après révélation Marque, blessure, ou Rayon), parmi `destLocs`.
   * `kind` = effet en cours. Absent / `null` hors de ce choix.
   */
  pendingPiegeur?: {
    chooserIndex: number
    kind: 'reveal' | 'reveal-move' | 'injure' | 'hook' | 'finish' | 'move'
    phase: 'target' | 'dest'
    candidateIds: string[]
    chosenSurvivorId?: string
    destLocs?: LocationId[]
  } | null
  /**
   * Flèche de Mome Raths (Fatalité, Reine de Cœur) : `chooserIndex` (joueur qui pose
   * la Fatalité) déplace un Allié du royaume de `targetIndex` vers le lieu non bloqué
   * de son choix (RESOLVE_ALLY_RELOCATE). Absent / `null` hors de ce choix.
   */
  pendingAllyRelocate?: {
    chooserIndex: number
    targetIndex: number
    /** Nb d'Alliés encore déplaçables (Go ! : 2). Défaut 1. */
    remaining?: number
    /** Peut s'arrêter avant d'avoir tout déplacé (Go !). Défaut false. */
    optional?: boolean
    /** Libellé affiché (défaut « Flèche de Mome Raths »). */
    title?: string
    /** Restreint les Alliés déplaçables à ces instanceId (Cybug en Sucre : seuls les
     *  Cybugs survivants). Absent = tous les Alliés du royaume. */
    onlyInstanceIds?: string[]
    /** Stari (Team Rocket) : la destination doit être un lieu VOISIN de l'Allié déplacé
     *  (et non n'importe quel lieu). Défaut false. */
    adjacentOnly?: boolean
    /** Sa Sucrerie — Il lui est défendu de courir : à la fermeture de la fenêtre, ouvre un
     *  Vanquish facultatif (pendingTrapVanquish `source: 'race-ban'`, Alliés non défaussés). */
    thenRaceBanVanquish?: boolean
  } | null
  /** Syndrome — « Identification, je vous prie » : `playerIndex` (l'acteur) doit déplacer
   *  un de ses Alliés OU Objets (non associé) vers un lieu de son royaume portant ≥1 Héros
   *  (RESOLVE_IDENTIFICATION). Absent / `null` hors de ce choix. */
  pendingIdentification?: { playerIndex: number } | null
  /** Team Rocket — Évolution : `playerIndex` choisit l'Allié à faire évoluer parmi
   *  `candidateIds` (Alliés évolutifs du royaume dont l'évolution n'est pas déjà en jeu).
   *  Résolu par RESOLVE_EVOLVE_ALLY. Absent / `null` hors de ce choix. */
  pendingEvolveAlly?: { playerIndex: number; candidateIds: string[] } | null
  /** Team Rocket — un DRESSEUR (Sacha/Ondine/Pierre) posé invoque l'un de ses deux Pokémon
   *  (« Cherchez X ou Y et jouez-le »). `chooserIndex` (le joueur qui pose la Fatalité)
   *  choisit lequel parmi `candidateCardIds` (présents dans la pioche Fatalité) ; le Pokémon
   *  est posé dans le royaume de `targetIndex` sur `locationId`, lié au dresseur
   *  `dresserInstanceId`. Résolu par RESOLVE_POKEMON_SUMMON. Absent / `null` sinon. */
  pendingPokemonSummon?: {
    chooserIndex: number
    targetIndex: number
    dresserInstanceId: string
    locationId: LocationId
    candidateCardIds: string[]
  } | null
  /** Team Rocket — « Oui, la guerre ! » : `chooserIndex` choisit (clic plateau) le Pokémon
   *  à coucher (K.O.) parmi `candidateIds` (ses Pokémon ≥ force requise non encore couchés).
   *  Résolu par RESOLVE_KO_POKEMON. Absent / `null` sinon. */
  pendingKoPokemon?: { chooserIndex: number; candidateIds: string[] } | null
  /** Pat Hibulaire — « Planqués » : le joueur qui pose la Fatalité (`chooserIndex`) choisit
   *  quel Allié (`candidateIds`, p. ex. plusieurs Bandits) défausser du royaume de
   *  `targetIndex`. `cardName` = libellé pour la modale. Résolu par RESOLVE_FATE_DISCARD_ALLY. */
  pendingFateDiscardAlly?: {
    chooserIndex: number
    targetIndex: number
    candidateIds: string[]
    cardName: string
  } | null
  /** Lotso — choix interactif d'une CIBLE (carte du royaume) : `kind` 'reduce' (réduire un
   *  Héros, de `amount` ou jusqu'à 0 si `toZero`) ou 'move-to-room' (déplacer un Héros ou
   *  Buzz sur la Salle des Chenilles). `candidateIds` = cibles valides (RESOLVE_LOTSO_TARGET). */
  pendingLotsoTarget?: {
    playerIndex: number
    kind: 'reduce' | 'move-to-room'
    candidateIds: string[]
    amount?: number
    toZero?: boolean
    label: string
  } | null
  /** Lotso — Réinitialisation : après avoir retourné Buzz en mode Démo, `playerIndex`
   *  choisit le LIEU où le déplacer (n'importe lequel, partie inférieure). `buzzInstanceId`
   *  = la tuile Buzz à déplacer (RESOLVE_LOTSO_BUZZ_MOVE). */
  pendingLotsoBuzzMove?: { playerIndex: number; buzzInstanceId: string } | null
  /** Lotso — Le Bibliothécaire : `playerIndex` dépense des jetons Pouvoir (1 = −1 force)
   *  qu'il RÉPARTIT librement entre plusieurs Héros (clic Héros = −1 + −1 Pouvoir),
   *  jusqu'à épuisement du Pouvoir / des cibles ou « Terminer ». `spent` = total déjà
   *  dépensé (pour le journal). RESOLVE_LOTSO_BOOKWORM (heroInstanceId=null → terminer). */
  pendingLotsoBookworm?: { playerIndex: number; spent: number } | null
  /** Lotso — Flex (capacité activée) : déplace un Héros OU Buzz du lieu de Flex vers
   *  n'importe quel AUTRE lieu, en 2 phases. `fromLocationId` = lieu de Flex ;
   *  `candidateIds` = Héros/Buzz déplaçables ; `cardInstanceId` absent → phase « quelle
   *  carte » (RESOLVE_LOTSO_FLEX cardInstanceId), présent → phase « quel lieu »
   *  (RESOLVE_LOTSO_FLEX to). */
  pendingLotsoFlex?: {
    playerIndex: number
    fromLocationId: LocationId
    candidateIds: string[]
    cardInstanceId?: string
  } | null
  /** Mère Gothel — Maximus : `chooserIndex` (joueur qui a posé la Fatalité) déplace
   *  d'abord une carte Cavaliers du roi du royaume de `targetIndex` vers un lieu voisin
   *  (phase « cavaliers »), puis Maximus lui-même vers un lieu voisin (phase « maximus »).
   *  Les deux déplacements sont FACULTATIFS. */
  pendingMaximus?: {
    chooserIndex: number
    targetIndex: number
    maximusInstanceId: string
    phase: 'cavaliers' | 'maximus'
  } | null
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
      | 'remove-card'
      | 'discard-from-hand'
      | 'fate-discard-hero-to-top'
      | 'play-revealed-fate-hero'
      | 'play-fate-card-from-discard'
      | 'hand-to-deck-top'
    hostInstanceId?: string
    candidateIds: string[]
    /** Nom de la carte Fatalité déclencheuse (Vieillissement, Majorité…), pour le log
     *  du retrait (`remove-card`). Absent → libellé par défaut. */
    via?: string
  } | null
  /** Madame Mim — Le Savoir conduit à la Puissance (Fatalité) : `chooserIndex`
   *  choisit une Métamorphose de Merlin (`candidateIds`) du royaume de `targetIndex`
   *  et un lieu de destination (RESOLVE_MERLIN_MOVE). */
  pendingMerlinMove?: { chooserIndex: number; targetIndex: number; candidateIds: string[] } | null
  /** Digne Adversaire / Obsession (Capitaine Crochet) : `playerIndex` a dévoilé son
   *  deck Fatalité jusqu'à `hero` ; il choisit de le JOUER (et où) ou de le DÉFAUSSER
   *  (RESOLVE_FETCHED_HERO). `discarded` = autres cartes dévoilées (à défausser),
   *  montrées pour information. */
  pendingFetchedHero?: { playerIndex: number; hero: CardInstance; discarded: CardInstance[]; placeTreasureAfter?: boolean; mustPlay?: boolean } | null
  /** Tamatoa — Crustacé doté du pouvoir de création : Objets dévoilés (Cœur de Te Fiti /
   *  Quelque chose qui brille) à JOUER un par un sur le lieu du choix de `playerIndex`
   *  (RESOLVE_CRUSTACEAN_PLACE). `items[0]` = l'Objet en cours de placement. */
  pendingCrustaceanPlace?: { playerIndex: number; items: CardInstance[] } | null
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
    /** Nombre de cartes à récupérer (défaut 1). Davy Jones — Je considère cela comme un
     *  non : 2. Décrémenté à chaque reprise ; le pending se ferme à 0 ou si plus de candidat. */
    count?: number
    /** Reprise FACULTATIVE : le joueur peut ne rien reprendre (RESOLVE_RECOVER sans
     *  instanceId ferme le pending). Ultron — Transformation. */
    optional?: boolean
    /** Michael Myers — Gardons le meilleur pour la fin : la carte reprise (une Arme) est
     *  ÉQUIPÉE gratuitement (→ `equippedWeapon`) au lieu d'aller en main. */
    equipWeapon?: boolean
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
  /** Gul'dan — Défaite (Fatalité) : `chooserIndex` (l'adversaire qui joue la Fatalité)
   *  choisit un type (Alliés OU Objets) ; toutes les cartes de ce type du royaume de
   *  `targetIndex` (Gul'dan) sont défaussées. RESOLVE_FATE_DISCARD_TYPE. */
  pendingFateDiscardType?: { chooserIndex: number; targetIndex: number } | null
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
    /** Isabella — Radar de poche : après la pose du Héros, ouvrir une action de royaume
     *  GRATUITE (pendingFreeRealmAction) pour jouer une Activité sans dépenser d'action. */
    thenFreeRealmAction?: boolean
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
    /** Oogie — Préparation de Noël (≥8) : action gratuite sur N'IMPORTE QUEL lieu du
     *  royaume (hors Fatalité). Les lieux candidats sont listés dans `locations`. */
    viaChristmas?: boolean
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
  /** Fenêtre `actAtLocation` où les actions RECOUVERTES sont aussi jouables (Team Rocket —
   *  Smogogo : « une action, recouverte ou non »). Effacé à la fermeture de la fenêtre. */
  actAtLocationIgnoreCover?: boolean | null
  /** Le joueur actif a déplacé un Allié/Objet ce tour-ci (déclencheur Sombres desseins). */
  activeMovedCard?: boolean
  /** Le joueur actif a déplacé SON PION ce tour-ci (déclencheur Mr. Monopoly — Monopoly). */
  activeMovedPawn?: boolean
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
  /** Nombre d'OBJETS joués par le joueur actif ce tour-ci (déclencheur Le Seigneur des
   *  Ténèbres — Nous touchons du doigt la victoire). Remis à 0 en fin de tour. */
  activePlayedItemCount?: number
  /** Coût MAXIMUM d'un ÉVÉNEMENT joué par le joueur actif ce tour-ci (déclencheur Le
   *  Piégeur — Fermeture de la trappe). 0 si aucun. Remis à 0 en fin de tour. */
  activePlayedEventMaxCost?: number
  /** Nombre d'ALLIÉS joués par le joueur actif ce tour-ci (déclencheur Davy Jones —
   *  Wyvern s'exprime). Remis à 0 en fin de tour. */
  activePlayedAllyCount?: number
  /** Indices des joueurs ciblés par une action Fatalité du joueur actif ce tour-ci
   *  (déclencheur Scar — La vie n'est pas juste). Remis à [] en fin de tour. */
  activeFateTargets?: number[]
  /** Héros (Fatalité) joués CE TOUR par l'actif contre un adversaire : `{ target, strength }`.
   *  Sert au déclencheur Team Rocket « Pour vous jouer un mauvais tour » (Héros ≤3 reçu).
   *  Remis à [] en fin de tour. */
  activeFateHeroesAgainst?: { target: number; strength: number }[]
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
  /** Dr Facilier (Fatalité) — L'étoile du soir : le joueur qui pose la Fatalité
   *  (`chooserIndex`) choisit un Allié du royaume de la cible (`targetIndex`, = Facilier)
   *  à placer dans sa Pile de l'Au-delà (RESOLVE_FATE_ALLY_TO_AUDELA). Ouvert seulement
   *  s'il y a ≥2 Alliés à départager ; auto (le plus fort) sinon. */
  pendingFateAllyToAuDela?: { chooserIndex: number; targetIndex: number } | null
  /** Oogie Boogie (Fatalité) — Mettons fin à ce cauchemar : le joueur qui pose la
   *  Fatalité (`chooserIndex`) voit la main de la cible (`targetIndex`, = Oogie) et en
   *  défausse une carte (RESOLVE_FATE_DISCARD_HAND). Ouvert seulement si la main n'est
   *  pas vide. */
  pendingFateDiscardHand?: { chooserIndex: number; targetIndex: number } | null
  /** Hadès — Alignement des planètes : `playerIndex` choisit quels Titans entravés
   *  désentraver (1 JT chacun, max = son Pouvoir). RESOLVE_UNTRAP_TITANS. */
  pendingUntrapTitans?: { playerIndex: number } | null
  /** Oogie Boogie (Fatalité) — Diversion, 2ᵉ temps : après avoir déplacé un Héros vers
   *  `locationId`, le joueur qui pose la Fatalité (`chooserIndex`) défausse un Allié ou un
   *  Objet (non associé) qui s'y trouve (RESOLVE_DIVERSION_DISCARD). */
  pendingDiversionDiscard?: { chooserIndex: number; targetIndex: number; locationId: LocationId } | null
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
    /** Isabella — Cloche : les cartes NON gardées sont remises dans le deck (puis mélangé)
     *  au lieu d'être défaussées. */
    returnToDeck?: boolean
    /** Michael — Lumière mourrante : le joueur CHOISIT, à la résolution, de défausser les
     *  cartes non gardées OU de les remettre sur le DESSUS de la pioche (RESOLVE_LOOK_TOP
     *  `toTop`). Les cartes non gardées viennent du BAS de la pioche (déjà retirées). */
    offerTopOrDiscard?: boolean
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
    /** Texte explicatif sous le titre (sinon texte par défaut « Objet trouvé… »). */
    subtitle?: string
    /** Cartes à surligner comme Héros (Oogie — Ce sont des vacances : les Héros
     *  dévoilés qui déclenchent une pioche). */
    heroInstanceIds?: string[]
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
  /** Isabella — AMOUR : `playerIndex` choisit un Héros de son royaume (`candidateIds`,
   *  Héros non déjà aimés) qui va « aimer » Isabella (RESOLVE_GRANT_LOVE). Le bot auto-résout. */
  pendingGrantLove?: { playerIndex: number; candidateIds: string[] } | null
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
    /** Pile source des candidats ('ingredients' par défaut ; 'artifacts' pour Manipulation). */
    zone?: 'ingredients' | 'artifacts'
    /** Reproduction gratuite (Manipulation) : ne pas prélever le coût de la carte reproduite. */
    freeDuplication?: boolean
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
  pendingReplayEvent?: { playerIndex: number; candidateIds: string[]; free?: boolean; bagControlledDice?: boolean; playFromDiscard?: boolean } | null
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
  /** Variante « révélation à suspense » (Une Petite Partie ?) : on dévoile les
   *  cartes une à une (1 s d'intervalle), un compteur de coût total s'incrémente à
   *  chaque carte, puis il scintille avant l'affichage du badge `gainedPower` JT. */
  reveal?: {
    /** Cartes révélées, dans l'ordre de dévoilement. */
    cardIds: string[]
    /** Coût de chaque carte (même ordre) — incrémente le total affiché. */
    costs: number[]
    /** Variante « scrutation + défausse » (Assommé Bêtement) : on dévoile les
     *  cartes, celles marquées `discarded` virent au gris (partent à la défausse),
     *  puis les autres sont remélangées (dos) et reposées sur le dessus de la pioche.
     *  Absent/false = révélation « à suspense » classique (Une Petite Partie ?). */
    scry?: boolean
    /** Pour la variante `scry` : par carte (même ordre que `cardIds`), vrai si elle
     *  est défaussée (coût ≥ seuil), faux si elle est conservée et remise sur le dessus. */
    discarded?: boolean[]
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
  /** Sa Sucrerie (King Candy) — déplacement sur le circuit en huit : avance le pion de
   *  `steps` cases Action (1 à 4 normalement ; 2 ou 3 si Félix Fixe Jr. est en jeu).
   *  Remplace l'action MOVE pour ce vilain. Pendant une course, franchir Départ/Arrivée
   *  (index 0) déclenche la victoire si un Bug est associé à Vanellope. */
  | { type: 'MOVE_TRACK'; steps: number }
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
  /** Thanos — DÉPLOIE un de ses Alliés dans le domaine d'un adversaire (via l'action
   *  « Déplacer un objet/allié »), sur `oppLocationId`, pour aller capturer une Pierre. */
  | { type: 'THANOS_DEPLOY_ALLY'; actionId: string; allyInstanceId: string; oppIndex: number; oppLocationId: LocationId }
  /** Thanos — RAPATRIE un Allié déployé vers `to` (son royaume) ; capture la Pierre présente
   *  sur le lieu adverse où il était déployé (→ Compétence). */
  | { type: 'THANOS_RETRIEVE_ALLY'; actionId: string; allyInstanceId: string; to: LocationId }
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
      /** Oogie — Baignoire : Alliés (de l'ancien lieu) à emmener vers `to`. Absent =
       *  tous (comportement par défaut / bot). */
      allyInstanceIds?: string[]
    }
  /** Éliminer un Héros : somme des forces des alliés ≥ force du héros. Le héros
   *  va à la défausse Fatalité, les alliés (et leurs objets associés) à la défausse. */
  | { type: 'VANQUISH'; actionId: string; heroInstanceId: string; allyInstanceIds: string[] }
  /** Team Rocket — Attraper un Pokémon : comme VANQUISH, mais la cible est un Pokémon
   *  (Héros `isPokemon`) ; il rejoint la pile de Captures (`capturedPokemon`) au lieu de
   *  la défausse Fatalité. Compte pour l'objectif CAPTURE_POKEMON. */
  | { type: 'CATCH_POKEMON'; actionId: string; heroInstanceId: string; allyInstanceIds: string[] }
  /** Le joueur actif paie 2 JT pour défausser un Déguisement Fatalité associé
   *  à un Héros adverse de SON plateau. Action hors-tour-de-lieu. */
  | { type: 'DISCARD_DEGUISEMENT'; instanceId: string }
  /** Défausse volontaire de cartes de la MAIN, sans coût ni pioche de remplacement.
   *  Utilisé par le BOT (via chooseAction) pour ne pas thésauriser : en fin de tour,
   *  s'il dépasse sa limite de main, il jette l'excédent (les cartes les moins
   *  importantes). Non énuméré dans la recherche ; l'UI humaine ne l'expose pas. */
  | { type: 'DISCARD_HAND_CARDS'; instanceIds: string[] }
  /** Disparition : passer la phase MOVE obligatoire sans déplacer le pion. */
  | { type: 'SKIP_MOVE' }
  /** Déplacement gratuit du Shérif de Nottingham (1×/tour par Shérif) vers
   *  n'importe quel autre lieu. +1 JT si la destination porte un Héros. */
  | { type: 'SHERIFF_MOVE'; instanceId: string; to: LocationId }
  /** Hadès — Char : déplace la figurine + le Char vers `to` (n'importe quel lieu),
   *  1×/tour, et donne accès aux actions de ce lieu (hors Fatalité). */
  | { type: 'CHARIOT_MOVE'; instanceId: string; to: LocationId }
  /** Dio — ZA WARUDO! (temps arrêté) : déplace LIBREMENT le pion vers `to` (autant de
   *  fois que voulu ce tour), pour accéder aux actions de ce lieu. Gratuit. Le coût
   *  croissant est prélevé par ACTION effectuée, pas par déplacement. */
  | { type: 'ZA_WARUDO_RELOCATE'; to: LocationId }
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
  /** Michael Myers — Trace de sang : 'power' (gagne le Pouvoir) ou 'move' (déplacer un Héros). */
  | { type: 'RESOLVE_BLOOD_TRACE'; choice: 'power' | 'move' }
  /** Michael Myers — Arme du crime : `instanceId` = Arme choisie (absent = ne rien prendre) ;
   *  `equip` = payer son coût et l'équiper (sinon ajout à la main). */
  | { type: 'RESOLVE_WEAPON_FETCH'; instanceId?: string; equip?: boolean }
  /** La Bonne Fée — Infiltration : la cible défausse la carte `instanceId` (`'discard'`)
   *  OU perd le Pouvoir (`'lose'`). */
  | { type: 'RESOLVE_INFILTRATION'; choice: 'lose' } | { type: 'RESOLVE_INFILTRATION'; choice: 'discard'; instanceId: string }
  | { type: 'RESOLVE_POWER_OR_RACER_BACK'; choice: 'power' | 'racer' }
  /** Madame de Trémaine — C'est votre dernière chance : résout le choix entre
   *  « Déplacer un Objet ou un Allié » (`move`) et « Activer » (`activate`). */
  | { type: 'RESOLVE_MOVE_OR_ACTIVATE'; choice: 'move' | 'activate' }
  /** Shere Khan — Tout le monde fuit : choisir l'action gratuite (Activer / Vaincre). */
  | { type: 'RESOLVE_ACTIVATE_OR_VANQUISH'; choice: 'activate' | 'vanquish' }
  /** Le Flagelleur Mental — Will sous emprise : choisir le deck à consulter (Méchant / Fatalité). */
  | { type: 'RESOLVE_SCRY_DECK_CHOICE'; deck: 'villain' | 'fate' }
  /** Shere Khan — C'est moi, Shere Khan : retire le jeton Feu de (locationId, actionId). */
  | { type: 'RESOLVE_REMOVE_FIRE'; locationId: LocationId; actionId: string }
  /** Shere Khan — Feu Rouge des Hommes : pose le jeton Feu sur l'action choisie. */
  | { type: 'RESOLVE_PLACE_FIRE'; locationId: LocationId; actionId: string }
  /** Shere Khan — Lancé sur ses traces : éliminer le Héros choisi (gratuit). */
  | { type: 'RESOLVE_SHERE_KHAN_DEFEAT'; heroInstanceId: string }
  /** Shere Khan — C'est à moi que vous le direz : remettre la carte Fatalité `instanceId`
   *  (de la défausse) dans la pioche Fatalité, ou passer (`instanceId` absent). */
  | { type: 'RESOLVE_RECOVER_FATE'; instanceId?: string }
  /** Shere Khan — À toi de jouer, cousin : jouer l'Allié dévoilé sur `locationId`. */
  | { type: 'RESOLVE_FREE_PLAY_ALLY'; locationId: LocationId }
  /** Grand Councilwoman — RAPPORT / CAPITAINE GANTU : jouer gratuitement la carte en
   *  attente. `targetId` = lieu de pose (Allié / Objet de lieu / Héros) OU instanceId de
   *  l'hôte (Objet associé à un Héros/Allié). Absent pour une carte Événement.
   *  `cancel` : renoncer à jouer la carte (elle part en défausse) — évite tout blocage. */
  | { type: 'RESOLVE_FREE_PLAY_CARD'; targetId?: string; cancel?: boolean }
  /** Grand Councilwoman — CAPITAINE GANTU : `instanceId` de la carte de la défausse à
   *  jouer gratuitement (absent = ne rien jouer). */
  | { type: 'RESOLVE_PICK_DISCARD_TO_PLAY'; instanceId?: string }
  /** Shere Khan — Jeune et sans défense : `choice` (move/gain) puis `heroInstanceId` /
   *  `allyInstanceId` (le Héros est déplacé sur le lieu de cet Allié). */
  | { type: 'RESOLVE_YOUNG'; choice?: 'move' | 'gain'; heroInstanceId?: string; allyInstanceId?: string }
  /** Shere Khan — Aie confiance : choisir une carte de la défausse à récupérer (`instanceId`)
   *  ou terminer (`done`). */
  | { type: 'RESOLVE_RECOVER_TO_DECK'; instanceId?: string; done?: boolean }
  /** Shere Khan — C'est très intéressant : effectuer une action (`option`) ou terminer (`done`). */
  | { type: 'RESOLVE_INTERESSANT'; option?: 'power' | 'draw' | 'fire'; done?: boolean }
  /** Shere Khan — Kaa : jouer l'Objet `instanceId` de la défausse (l'associer à Kaa). */
  | { type: 'RESOLVE_KAA_PLAY'; instanceId: string }
  /** Shere Khan — Le Roi Singe : choisir le Macaque puis le lieu de destination. */
  | { type: 'RESOLVE_MONKEY_KING'; macaqueInstanceId?: string; to?: LocationId }
  /** Shere Khan — Kaa (bouclier) : défausser l'Objet `itemInstanceId` à la place de Kaa,
   *  ou laisser Kaa être défaussé (`decline`). */
  | { type: 'RESOLVE_KAA_SHIELD'; itemInstanceId?: string; decline?: boolean }
  /** Davy Jones : phase 1 choisir le Héros (`heroInstanceId`), phase 2 le Trésor (`treasureId`). */
  | { type: 'RESOLVE_PLACE_TREASURE'; heroInstanceId?: string; treasureId?: string }
  /** Davy Jones : révéler le jeton Trésor du Héros `heroInstanceId`. */
  | { type: 'RESOLVE_REVEAL_TREASURE'; heroInstanceId: string }
  /** Davy Jones — Les amis : choisir le Héros source puis le Héros cible (échange/déplace). */
  | { type: 'RESOLVE_MOVE_SWAP_TREASURE'; heroInstanceId: string }
  /** Davy Jones — Réveillez le Kraken : défausser l'Allié `allyInstanceId` choisi. */
  | { type: 'RESOLVE_WAKE_KRAKEN'; allyInstanceId: string }
  /** Madame de Trémaine — Je ne reviens jamais : replace les cartes Fatalité regardées
   *  sur le dessus de la pioche dans l'ordre `orderedIds` (1ᵉʳ = dessus). */
  | { type: 'RESOLVE_FATE_REORDER'; orderedIds: string[] }
  /** Mère Gothel — Lance-moi ta chevelure : `steps` = nombre de lieux dont Raiponce
   *  est ramenée vers la Tour (1 ou 2). */
  | { type: 'RESOLVE_RAIPONCE_HOMEWARD'; steps: number }
  /** Mère Gothel — Frères Stabbington : `move` = déplacer (ou non) Raiponce sur la Tour. */
  | { type: 'RESOLVE_RAIPONCE_TO_TOWER'; move: boolean }
  /** Cruella d'Enfer — choix de la Tuile Chiots (réserve) à ajouter sur son lieu indiqué. */
  | { type: 'RESOLVE_PUPPY_ADD'; tileId: string }
  /** Cruella d'Enfer — Repéré ! : révèle une Tuile Chiots face cachée de la réserve. */
  | { type: 'RESOLVE_PUPPY_REVEAL'; tileId: string }
  /** Cruella d'Enfer — Repéré ! : arrête de révéler (révélation facultative). */
  | { type: 'DONE_PUPPY_REVEAL' }
  /** Tabbou — Dévoiler : retourne une tuile Combattant face cachée (pioche → réserve). */
  | { type: 'RESOLVE_FIGHTER_REVEAL'; tileId: string }
  /** Tabbou — Dévoiler : arrête de dévoiler (facultatif). */
  | { type: 'DONE_FIGHTER_REVEAL' }
  /** Tabbou — Tuer des Combattants : couleur choisie (toutes les tuiles de cette
   *  couleur dans la réserve sont tuées). */
  | { type: 'RESOLVE_FIGHTER_KILL_COLOR'; color: FighterColor }
  /** Tabbou — Coup Fatal : tue une tuile Combattant de la réserve. */
  | { type: 'RESOLVE_FIGHTER_KILL_FREE'; tileId: string }
  /** Tabbou — Coup Fatal : arrête de tuer (facultatif). */
  | { type: 'DONE_FIGHTER_KILL_FREE' }
  /** Tabbou — Destin : `reveal` = dévoiler 3 Combattants ; `power` = gagner 4 Pouvoir. */
  | { type: 'RESOLVE_DESTIN_CHOICE'; choice: 'reveal' | 'power' }
  /** Cruella d'Enfer — Horace : `capture` = capturer sur son lieu (true) OU amener
   *  une Tuile de la réserve (false). */
  | { type: 'RESOLVE_HORACE_CHOICE'; capture: boolean }
  /** Cruella d'Enfer — choix d'une Tuile Chiots à capturer (plusieurs sur le lieu). */
  | { type: 'RESOLVE_PUPPY_CAPTURE'; tileId: string }
  /** Cruella d'Enfer — Quels idiots ! : choix de l'option (déplacer / chercher). */
  | { type: 'RESOLVE_QUELS_IDIOTS'; choice: 'move' | 'tutor' }
  /** Cruella d'Enfer — Quels idiots ! : choix de l'Allié (à déplacer ou à chercher). */
  | { type: 'RESOLVE_QUELS_IDIOTS_PICK'; instanceId: string }
  /** Gaston — retire/replace un jeton Obstacle sur `locationId` (pendingObstacle). */
  | { type: 'RESOLVE_OBSTACLE'; locationId: LocationId }
  /** Gaston — termine le retrait/replacement d'Obstacles en attente (pendingObstacle). */
  | { type: 'DONE_OBSTACLE' }
  /** Gaston — exécute l'action gratuite armée (Belle est à moi / Tous avec moi). */
  | { type: 'PERFORM_GRANTED_ACTION'; action: Extract<GameAction, { type: 'VANQUISH' | 'MOVE_CARD' | 'PLAY_CARD' }> }
  /** Sa Sucrerie — Taffyta Crème Brûlée : résout le choix « reculer le Pilote de 2 »
   *  OU « effectuer une action Jouer une carte gratuite ». */
  | { type: 'RESOLVE_TAFFYTA_CHOICE'; choice: 'racer-back' | 'play-card' }
  /** Sa Sucrerie — Aigre Bill : fouiller (`dig: true`) ou renoncer (`dig: false`). */
  | { type: 'RESOLVE_AIGRE_BILL'; dig: boolean }
  /** Sa Sucrerie — L'important, c'est de payer : dépenser `amount` jetons Pouvoir (1..max)
   *  pour avancer le pion d'autant de cases. */
  | { type: 'RESOLVE_PAY_RACE'; amount: number }
  /** Mr. Monopoly — Affaire : poser `amount` maisons (1..max) sur le lieu adverse en attente. */
  | { type: 'RESOLVE_BUY_HOUSES'; amount: number }
  /** Mr. Monopoly — Carte bancaire / destruction : choisir un lieu (`locationId`). En phase
   *  'from' = lieu source (ou lieu à détruire) ; en phase 'to' = lieu destination. */
  | { type: 'RESOLVE_MOVE_HOUSES'; locationId: LocationId }
  /** Mr. Monopoly — Libéré de prison : soit déplacer un Héros (`heroInstanceId` + `locationId`),
   *  soit envoyer Mr. Monopoly en Prison (`toPrison: true`). */
  | { type: 'RESOLVE_FREE_FROM_JAIL'; heroInstanceId?: string; locationId?: LocationId; toPrison?: boolean }
  /** Mr. Monopoly — Reculez de trois cases : déplacer le pion vers `locationId` (n'importe lequel). */
  | { type: 'RESOLVE_BACKWARD_MOVE'; locationId: LocationId }
  /** Mr. Monopoly — Canne : ouvre le choix d'une action empruntée à un lieu maisonné adverse. */
  | { type: 'USE_CANNE_MONOPOLY' }
  /** Mr. Monopoly — Canne : exécute l'action empruntée (`actionId` du lieu adverse `locationId`). */
  | { type: 'RESOLVE_CANNE_BORROW'; locationId: LocationId; actionId: string }
  /** Sa Sucrerie — Princesse Vanellope : reculer le pion King Candy de `amount` (0..max). */
  | { type: 'RESOLVE_PAWN_BACK'; amount: number }
  /** Sa Sucrerie — Le Faisceau : choisir le lieu de rassemblement (`locationId`) puis,
   *  en phase 'discard', défausser un Cybug (`cybugInstanceId`) ou passer (`skip`). */
  | { type: 'RESOLVE_BEACON'; locationId?: LocationId; cybugInstanceId?: string; skip?: boolean }
  /** Sa Sucrerie — Médaille de Vanellope : choisir le Héros (`heroInstanceId`) puis le lieu
   *  (`locationId`) où le jouer (+1 Force). */
  | { type: 'RESOLVE_MEDAL'; heroInstanceId?: string; locationId?: LocationId }
  /** Gaston — décline l'action gratuite armée. */
  | { type: 'SKIP_GRANTED_ACTION' }
  /** Le Seigneur des clés — action « Obtenir une clé » (ramasse une clé du lieu courant). */
  | { type: 'OBTAIN_KEY'; actionId: string }
  /** Le Seigneur des clés — résout un choix de clé (ramasser/perdre) : `keyId` ;
   *  `locationId` = lieu de dépose (perte avec choix du lieu, Plaisir ou souffrance). */
  | { type: 'RESOLVE_KEY'; keyId: string; locationId?: LocationId }
  /** Le Seigneur des clés — 00:00 : couleur choisie avant le lancer du dé. */
  | { type: 'RESOLVE_KEY_COLOR'; color: KeyColor }
  /** Le Seigneur des clés — Plaisir ou souffrance : 'power' (perdre du Pouvoir) ou 'key'. */
  | { type: 'RESOLVE_PLAISIR'; choice: 'power' | 'key' }
  /** Le Seigneur des clés — Sorcellerie / Gévaudan : l'adversaire choisit la clé `keyId`
   *  du Seigneur (`locationId` = lieu où la reposer, mode 'return' uniquement). */
  | { type: 'RESOLVE_STEAL_KEY'; keyId: string; locationId?: LocationId }
  /** Mère Gothel — Couronne : défausse l'Objet `instanceId` (capacité gratuite, à
   *  tout moment du tour) pour gagner 1 jeton Confiance. */
  | { type: 'SACRIFICE_COURONNE'; instanceId: string }
  /** Mauvais Coup : `keepInstanceId` = carte (parmi les 2 révélées) prise en main ;
   *  l'autre repart sur le DESSUS (`top`) ou le DESSOUS (`bottom`) de la pioche. */
  | { type: 'RESOLVE_MAUVAIS_COUP'; keepInstanceId: string; otherPlacement: 'top' | 'bottom' }
  /** Sournois : replace la carte `instanceId` de la main sur le dessus/dessous. */
  | { type: 'RESOLVE_SOURNOIS'; instanceId: string; placement: 'top' | 'bottom' }
  /** Cheval : déplace l'Allié/Objet `instanceId` vers `to`. `instanceId`/`to` null =
   *  ne rien déplacer (facultatif). `auto` = le bot délègue le choix à l'heuristique. */
  | { type: 'RESOLVE_ALLY_ITEM_MOVE'; instanceId: string | null; to: LocationId | null; auto?: boolean }
  /** Bandit : enchaîne d'autres Bandits (`instanceIds`) sur le même lieu, dans la
   *  même action. Tableau vide = n'en jouer aucun de plus. */
  | { type: 'RESOLVE_BANDIT_CHAIN'; instanceIds: string[] }
  /** Dingo : intervertit les tuiles Objectif des lieux `from` et `to` (voisins).
   *  `from`/`to` null = ne rien faire (facultatif). */
  | { type: 'RESOLVE_DINGO'; from: LocationId | null; to: LocationId | null }
  /** Apparition / Vent de panique : déplace le Héros choisi vers le lieu voisin. */
  | { type: 'RESOLVE_HERO_RELOCATE'; heroInstanceId: string; to: LocationId }
  /** Décline un déplacement de Héros FACULTATIF (Poupées vaudou). */
  | { type: 'SKIP_HERO_RELOCATE' }
  /** Le Piégeur — choisit le Survivant ciblé (phase 'target' de pendingPiegeur). */
  | { type: 'RESOLVE_PIEGEUR_TARGET'; survivorInstanceId: string }
  /** Le Piégeur — choisit le lieu voisin de destination (phase 'dest' de pendingPiegeur). */
  | { type: 'RESOLVE_PIEGEUR_DEST'; to: LocationId }
  /** Le Piégeur — paie 2 Pouvoir pour défausser une PALETTE (Objet Fatalité) qui bloque un lieu. */
  | { type: 'DISCARD_PALETTE'; instanceId: string }
  /** Flèche de Mome Raths : déplace l'Allié choisi vers le lieu (non bloqué) choisi. */
  | { type: 'RESOLVE_ALLY_RELOCATE'; allyInstanceId: string; to: LocationId }
  | { type: 'SKIP_ALLY_RELOCATE' }
  /** Team Rocket — un dresseur invoque le Pokémon `cardId` choisi (cf. pendingPokemonSummon). */
  | { type: 'RESOLVE_POKEMON_SUMMON'; cardId: string }
  /** Team Rocket — « Oui, la guerre ! » : couche le Pokémon choisi (cf. pendingKoPokemon). */
  | { type: 'RESOLVE_KO_POKEMON'; instanceId: string }
  /** Pat Hibulaire — « Planqués » : défausse l'Allié choisi (cf. pendingFateDiscardAlly). */
  | { type: 'RESOLVE_FATE_DISCARD_ALLY'; instanceId: string }
  /** Syndrome — « Identification, je vous prie » : déplace l'Allié/Objet choisi vers le
   *  lieu (portant un Héros) choisi. */
  | { type: 'RESOLVE_IDENTIFICATION'; cardInstanceId: string; to: LocationId }
  /** Lotso — résout `pendingLotsoTarget` : applique l'effet (réduction / déplacement vers
   *  la Salle) à la carte choisie. */
  | { type: 'RESOLVE_LOTSO_TARGET'; instanceId: string }
  /** Team Rocket — résout `pendingEvolveAlly` : fait évoluer l'Allié choisi. */
  | { type: 'RESOLVE_EVOLVE_ALLY'; instanceId: string }
  /** Lotso — résout `pendingLotsoBuzzMove` : déplace la tuile Buzz (mode Démo) vers le lieu choisi. */
  | { type: 'RESOLVE_LOTSO_BUZZ_MOVE'; to: LocationId }
  /** Lotso — Le Bibliothécaire : applique une réduction de −1 (et −1 Pouvoir) au Héros
   *  choisi, ou termine la répartition si `heroInstanceId` est null. */
  | { type: 'RESOLVE_LOTSO_BOOKWORM'; heroInstanceId: string | null }
  /** Lotso — Flex : phase « quelle carte » (`cardInstanceId`) puis phase « quel lieu »
   *  (`to`). Un seul champ est renseigné selon la phase en cours. */
  | { type: 'RESOLVE_LOTSO_FLEX'; cardInstanceId?: string; to?: LocationId }
  /** Mère Gothel — Maximus, phase « cavaliers » : déplace le Cavaliers du roi choisi
   *  vers `to` (lieu voisin), ou passe (`allyInstanceId`/`to` = null). */
  | { type: 'RESOLVE_MAXIMUS_CAVALIERS'; allyInstanceId: string | null; to: LocationId | null }
  /** Mère Gothel — Maximus, phase « maximus » : déplace Maximus vers `to` (lieu voisin),
   *  ou passe (`to` = null). */
  | { type: 'RESOLVE_MAXIMUS_MOVE'; to: LocationId | null }
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
  /** Gul'dan — Défaite : le fataliseur choisit le type à défausser (Alliés OU Objets). */
  | { type: 'RESOLVE_FATE_DISCARD_TYPE'; cardType: CardType }
  /** Gul'dan — défausse une Fatalité posée sur un lieu (Armée de la Lumière : −3 Pouvoir ;
   *  Kil'jaeden : gratuit une fois les 4 lieux corrompus). */
  | { type: 'REMOVE_FATE_LOCATION_CARD'; instanceId: string }
  /** Carte du Pays Imaginaire : défausse la Carte (du royaume) et joue
   *  gratuitement l'Objet `itemInstanceId` de la main sur le lieu `to`
   *  (associé à `attachTo` si l'Objet s'associe). */
  | { type: 'USE_NEVERLAND_MAP'; itemInstanceId: string; to: LocationId; attachTo?: string }
  /** Opportunisme : reprend en main la carte `instanceId` de la défausse Vilain. */
  | { type: 'RESOLVE_RECOVER'; instanceId?: string }
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
  /** Dr Facilier — L'étoile du soir : place l'Allié choisi (`allyInstanceId`, du royaume
   *  de la cible) dans sa Pile de l'Au-delà (résout pendingFateAllyToAuDela). */
  | { type: 'RESOLVE_FATE_ALLY_TO_AUDELA'; allyInstanceId: string }
  /** Oogie Boogie — Mettons fin à ce cauchemar : défausse la carte `cardInstanceId` de la
   *  main de la cible (résout pendingFateDiscardHand). */
  | { type: 'RESOLVE_FATE_DISCARD_HAND'; cardInstanceId: string }
  /** Hadès — Alignement des planètes : désentrave les Titans `instanceIds` (1 JT chacun). */
  | { type: 'RESOLVE_UNTRAP_TITANS'; instanceIds: string[] }
  /** Oogie Boogie — Diversion : défausse l'Allié/Objet `cardInstanceId` du lieu d'arrivée
   *  (résout pendingDiversionDiscard). */
  | { type: 'RESOLVE_DIVERSION_DISCARD'; cardInstanceId: string }
  /** Dr Facilier — Tour de passe-passe : garde `keepInstanceIds` (parmi les cartes
   *  révélées de pendingLookTop) en main ; les autres sont défaussées. */
  | { type: 'RESOLVE_LOOK_TOP'; keepInstanceIds: string[]; toTop?: boolean }
  /** Ratigan — Liste de Fidget : acquitte l'affichage des cartes dévoilées
   *  (pendingReveal) ; aucune décision, ferme simplement le modal d'info. */
  | { type: 'ACKNOWLEDGE_REVEAL' }
  /** Sombra — Piratage : désactive l'action `actionId` du lieu piraté. */
  | { type: 'RESOLVE_HACK'; actionId: string }
  /** Sombra — Information : `discardDrawn` = true → défausse les cartes piochées ;
   *  false → ouvre la sélection pour défausser `discardCount` cartes de la main. */
  | { type: 'RESOLVE_INFORMATION'; discardDrawn: boolean }
  /** Oogie — Père Noël : défausse les cartes choisies de la main puis pioche. */
  | { type: 'RESOLVE_DISCARD_THEN_DRAW'; instanceIds: string[] }
  /** Oogie — Affaire dans le sac : le joueur choisit la valeur des deux dés. */
  | { type: 'RESOLVE_DICE_CHOICE'; dice: [number, number] }
  /** Mim — Le Savoir conduit à la Puissance : Merlin choisi déplacé vers `to`. */
  | { type: 'RESOLVE_MERLIN_MOVE'; merlinInstanceId: string; to: LocationId }
  /** La Méchante Reine — « Croque ! » : élimine le Héros choisi (`heroInstanceId`)
   *  en défaussant autant de Poison que sa force. */
  | { type: 'RESOLVE_TAKE_A_BITE'; heroInstanceId: string }
  /** Isabella — AMOUR : le Héros choisi (`heroInstanceId`) se met à aimer Isabella. */
  | { type: 'RESOLVE_GRANT_LOVE'; heroInstanceId: string }
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
  /** Oogie Boogie — confirme le lancer de dés en cours et applique son issue. */
  | { type: 'RESOLVE_DICE' }
  /** Oogie Boogie — joue un Dés pipés (`instanceId`) pour relancer le dé `dieIndex`
   *  (0 ou 1) du lancer en cours. */
  | { type: 'RESOLVE_DICE_REROLL'; instanceId: string; dieIndex: 0 | 1 }
  /** Oogie Boogie — Préparation de Noël (≥8) : action de royaume gratuite déclinée. */
  | { type: 'SKIP_FREE_REALM_ACTION' }
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
  /** Le Seigneur des Ténèbres — ACTIVE le Chaudron Noir réclamé (le retourne sur sa
   *  face Pouvoir : `blackCauldron` 'claimed' → 'powered'). Permet ensuite de jouer
   *  les Morts-vivants du Chaudron. Action gratuite (ne consomme pas d'action de lieu). */
  | { type: 'ACTIVATE_CAULDRON' }
  /** Le Seigneur des Ténèbres — capacité du Chaudron RÉVEILLÉ, une fois par tour AVANT
   *  de déplacer le pion (phase MOVE) : payer 2 Pouvoir pour remplacer un Objet
   *  « Squelettes de Soldats » (`squeletteInstanceId`, sur n'importe quel lieu) par un
   *  « Soldat Ressuscité » de la main (`soldierInstanceId`), posé sur le lieu du Squelette. */
  | { type: 'CAULDRON_EXCHANGE'; squeletteInstanceId: string; soldierInstanceId: string }
  /** Le Seigneur des Ténèbres — résout le choix « s'emparer du Chaudron OU gagner du
   *  Pouvoir » (Montre-moi le Chaudron Magique). */
  | { type: 'RESOLVE_CAULDRON_CHOICE'; choice: 'cauldron' | 'power' }
  | { type: 'RESOLVE_MAUI_CHOICE'; choice: 'play' | 'discard' }
  /** Dio — Vampirisme : défausse l'Allié choisi et gagne le Pouvoir prévu. */
  | { type: 'RESOLVE_DIO_DISCARD_ALLY'; allyInstanceId: string }
  /** Dio — CREAM : défausse le Héros choisi (force < Vanilla Ice) sur le lieu de Cream. */
  | { type: 'RESOLVE_DIO_CREAM'; heroInstanceId: string }
  /** Dio — MUDA! : élimine le Héros choisi (ou aucun si omis) et gagne le Pouvoir prévu. */
  | { type: 'RESOLVE_DIO_MUDA'; heroInstanceId?: string }
  /** Dio — Lumière du Soleil : défausse la main ('discard') ou perd du Pouvoir ('lose'). */
  | { type: 'RESOLVE_DIO_SUNLIGHT'; choice: 'discard' | 'lose' }
  /** Pyramid Head — Pacte de Sang : défausse la carte `instanceId` de la main, puis ouvre
   *  la récupération d'une carte du même type. */
  | { type: 'RESOLVE_PACTE_SANG'; instanceId: string }
  /** Pyramid Head — Sacrifice Humain : applique le choix (regarder 3 / garder 1, ou gagner 2). */
  | { type: 'RESOLVE_SACRIFICE'; choice: 'look' | 'gain' }
  /** Pyramid Head — Cage de l'Expiation : déplace le Héros porteur vers `locationId`. */
  | { type: 'RESOLVE_CAGE_MOVE'; locationId: LocationId }
  | { type: 'RESOLVE_CRUSTACEAN_PLACE'; to: LocationId }
  /** Le Seigneur des Ténèbres — résout le choix « mélanger sa défausse OU défausser
   *  l'Épée Magique pour s'emparer du Chaudron » (Nous avons conclu un marché !). */
  | { type: 'RESOLVE_BARGAIN_CHOICE'; choice: 'reshuffle' | 'sword' }
  /** Le Seigneur des Ténèbres — joue gratuitement l'Objet `instanceId` de la main sur
   *  le lieu `to` (Nous touchons du doigt la victoire). */
  | { type: 'RESOLVE_FREE_ITEM_PLAY'; instanceId: string; to: LocationId }
  /** Renonce au jeu gratuit d'un Objet (Nous touchons du doigt la victoire). */
  | { type: 'SKIP_FREE_ITEM_PLAY' }
  /** Ultron (Marvel) — compléter la PROCHAINE tuile Amélioration (action libre, 1/tour).
   *  `discard` = instanceId(s) des Sentinelles à défausser selon la tuile (Transformation :
   *  2 Sentinelles ; Optimisation : 1 Drone de combat portant 2 Alliage impénétrable ;
   *  Forme finale & L'ère d'Ultron : aucune défausse). */
  | { type: 'ULTRON_COMPLETE_UPGRADE'; discard?: string[] }
  /** Ultron (Marvel) — OPTIMISATION (2ᵉ Amélioration) : 1×/tour, utilise l'action « Jouer une
   *  carte » `actionId` du lieu du pion comme un « Déplacer un Allié/Objet » (déplace `instanceId`
   *  vers `to`). Consomme ce slot d'action. */
  | { type: 'ULTRON_OPTIMIZE_MOVE'; actionId: string; instanceId: string; to: LocationId }
  | { type: 'END_TURN' }

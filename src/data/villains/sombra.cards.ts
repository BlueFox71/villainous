// =============================================================================
// Sombra — cartes (deck Méchant de 30 + deck Fatalité de 15).
//
// Source : feuille « Sombra » de Villainous_Template-Alexis_1_1.xlsx + images FR du
// dossier assets/decks/Sombra/. Le TEXTE est la source de vérité ; les `effects`
// sont ajoutés au fil de l'eau. Plusieurs cartes reposent sur des mécaniques dédiées
// (Piratage / hack d'une action, verrou de Lumérico via Faille, objectif Protocole
// Sombra) implémentées par phases — elles restent « texte seul » en attendant.
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/sombra/${f}`

export const sombraCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Piratage (posés sur un lieu, non déplaçables, comptés comme
  // Objets pour les conditions adverses)
  // ----------------------------------------------------------------------
  {
    id: 'piratage',
    name: 'Piratage',
    englishName: 'Hack',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 4,
    isPiratage: true,
    hackDisablesAction: true,
    text: 'Piratez un lieu, ce qui désactive une case d’action de votre choix tant que le Piratage y reste.',
    image: img('piratage.webp'),
    journal: 'Piratage : {nomLieu} est piraté — une case d’action est coupée.',
  },
  {
    id: 'iem',
    name: 'IEM',
    englishName: 'EMP',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 2,
    isPiratage: true,
    text: 'Piratez un lieu de votre choix sans désactivation de cases.',
    image: img('iem.webp'),
    journal: 'IEM : {nomLieu} est piraté, sans rien couper.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Objets
  // ----------------------------------------------------------------------
  {
    id: 'transducteur',
    name: 'Transducteur',
    englishName: 'Translocator',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    text: 'Activer : payez 1 jeton Pouvoir. Déplacez-vous sur le Transducteur et jouez les actions disponibles, en dehors des actions Fatalité.',
    image: img('transducteur.webp'),
    activatedCost: 1,
    journal: 'Transducteur : posé sur {nomLieu}, il rappellera Sombra à lui.',
  },
  {
    id: 'faille',
    name: 'Faille',
    englishName: 'Breach',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: 'Déverrouille l’accès à Lumérico, puis défaussez cette carte pour jouer un Piratage gratuitement.',
    image: img('faille.webp'),
    discardOnPlay: true,
    effects: [
      { type: 'UNLOCK_LOCATION', locationId: 'lumerico' },
      { type: 'GRANT_FREE_PIRATAGE' },
    ],
    journal: 'Faille : Lumérico s’ouvre, et un Piratage part gratuitement.',
  },
  {
    id: 'arme-uzi',
    name: 'Arme Uzi',
    englishName: 'Machine Pistol',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    attach: 'ally',
    attachStrengthBonus: 2,
    text: 'Associez cette carte à un Allié, sa force augmente de 2. Puis vous pouvez effectuer une action Éliminer un Héros.',
    image: img('arme-uzi.webp'),
    journal: 'Arme Uzi : +2 Force pour {nomAllié}, prêt à en finir tout de suite.',
  },
  {
    id: 'jeux-de-piste',
    name: 'Jeux de piste',
    englishName: 'Treasure Hunt',
    deck: 'villain',
    type: 'item',
    cost: 1,
    copies: 1,
    grantsAction: { type: 'GAIN_POWER', amount: 1, label: 'Gagner 1 pouvoir' },
    text: 'Ce lieu gagne l’action : Gagner 1 jeton Pouvoir.',
    image: img('jeux-de-piste.webp'),
    journal: 'Jeux de piste : {nomLieu} gagne l’action Gagner 1 JT.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Alliés
  // ----------------------------------------------------------------------
  {
    id: 'membres-los-muertos',
    name: 'Membres de Los Muertos',
    englishName: 'Los Muertos Members',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 2,
    text: 'Activer : allez chercher Arme Uzi dans votre pioche ou votre défausse et ajoutez-la à votre main.',
    image: img('membres-los-muertos.webp'),
    activatedCost: 0,
    journal: 'Les Membres de Los Muertos rejoignent le royaume : ils iront chercher l’Arme Uzi.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Événements
  // ----------------------------------------------------------------------
  {
    id: 'information',
    name: 'Information',
    englishName: 'Information',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 3,
    text: 'Piochez 3 cartes puis défaussez 2 cartes de votre choix, ou défaussez 3 cartes.',
    image: img('information.webp'),
    // Seule carte de ce type à offrir l'ALTERNATIVE (main OU cartes piochées) → modale de
    // choix. Les autres (Bataille d'esprits, Wyvern s'exprime, Carte Destin) enchaînent
    // directement sur la défausse.
    effects: [{ type: 'DRAW_THEN_DISCARD', draw: 3, discard: 2, orDiscardDrawn: true }],
    journal: 'Information : 3 cartes piochées, 2 rendues — ou tout part en défausse.',
  },
  {
    id: 'boop',
    name: 'Boop !',
    englishName: 'Boop!',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 3,
    text: 'Associez cette carte à un Héros, ce qui annule l’effet de la carte.',
    image: img('boop.webp'),
    effects: [{ type: 'HACK_HERO' }],
    journal:
      'Boop ! : {nomHéros} est piraté, sa capacité annulée.\n' +
      'Boop ! : aucun Héros à pirater.',
  },
  {
    id: 'protocole-sombra',
    name: 'Protocole Sombra',
    englishName: 'Sombra Protocol',
    deck: 'villain',
    type: 'effect',
    cost: 4,
    copies: 2,
    text: 'Détruisez tous les Piratages et IEM de votre royaume ; si un Héros est piraté, il est aussi détruit. Si vous effectuez un Protocole Sombra alors que tous les lieux sont piratés, vous gagnez la partie.',
    image: img('protocole-sombra.webp'),
    effects: [{ type: 'SOMBRA_PROTOCOL' }],
    journal: 'Protocole Sombra : tous les Piratages et IEM sautent — et les Héros piratés avec.',
  },
  {
    id: 'invisibilite',
    name: 'Invisibilité',
    englishName: 'Stealth',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Sombra ne peut pas subir de Fatalité pendant 1 tour.',
    image: img('invisibilite.webp'),
    effects: [{ type: 'FATE_IMMUNITY' }],
    journal: 'Invisibilité : plus aucune Fatalité ne touchera Sombra pendant un tour.',
  },
  {
    id: 'glitch',
    name: 'Glitch',
    englishName: 'Glitch',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Choisissez Objet ou Événement, puis piochez jusqu’à trouver une carte de ce type, ajoutez-la à votre main et placez les autres sous votre pioche.',
    image: img('glitch.webp'),
    // Pour SA propre recherche, un Piratage/IEM ne compte pas comme « Objet ».
    effects: [{ type: 'REVEAL_UNTIL_TYPE', types: ['item', 'effect'], excludePiratage: true }],
    journal: 'Glitch : la pioche est fouillée jusqu’à la carte voulue.',
  },
  {
    id: 'adios',
    name: 'Adios',
    englishName: 'Adios',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Déplacez un Héros vers un lieu voisin.',
    image: img('adios.webp'),
    effects: [{ type: 'RELOCATE_HERO_ADJACENT' }],
    journal:
      'Adios : {nomHéros} recule vers {nomLieu}.\n' +
      'Adios : aucun Héros à repousser.',
  },
  {
    id: 'skycode',
    name: 'Skycode',
    englishName: 'Skycode',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 1,
    text: 'Gagnez 1 jeton Pouvoir par lieu et par Héros piraté.',
    image: img('skycode.webp'),
    effects: [{ type: 'GAIN_POWER_PER_HACK' }],
    journal: 'Skycode : gagne {NbJT} JT, un piratage à la fois.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Conditions
  // ----------------------------------------------------------------------
  {
    id: 'un-coup-d-avance',
    name: 'Un coup d’avance',
    englishName: 'One Step Ahead',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Cette carte est jouable pendant le tour d’un adversaire s’il gagne au moins 3 jetons Pouvoir. Gagnez 3 jetons Pouvoir.',
    image: img('un-coup-d-avance.webp'),
    trigger: { type: 'opponent-gained-power-ge', value: 3 },
    effects: [{ type: 'GAIN_POWER', amount: 3 }],
    journal: 'Un coup d’avance : la richesse adverse rapporte 3 JT.',
  },
  {
    id: 'pas-si-vite',
    name: 'Pas si vite',
    englishName: 'Not So Fast',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 1,
    text: 'Cette carte est jouable pendant le tour d’un adversaire s’il vous cible avec une action Fatalité. Choisissez la carte Fatalité à la place de l’autre joueur.',
    image: img('pas-si-vite.webp'),
    trigger: { type: 'opponent-fate-targeted-me' },
    journal: 'Pas si vite : c’est Sombra qui choisit la Fatalité jouée contre elle.',
  },

  // ======================================================================
  // DECK FATALITÉ — Héros
  // ======================================================================
  {
    id: 'l-oeil',
    name: 'L’Œil',
    englishName: 'The Eye',
    deck: 'fate',
    type: 'hero',
    strength: 6,
    copies: 1,
    text: 'Retirez un Piratage ou un IEM sur le lieu où L’Œil est joué. Tant que L’Œil est présent, Sombra ne peut pas poser de Piratage ni d’IEM sur ce lieu.',
    image: img('l-oeil.webp'),
    // À la pose : retire un Piratage/IEM de son lieu (priorité au Piratage). Le blocage
    // « pas de Piratage tant qu'il est là » est géré à la pose d'un Piratage (rules).
    onPlace: [{ type: 'DISCARD_ITEM_AT_HOST', preferCardId: 'piratage' }],
    journal: 'L’Œil apparaît : le piratage de son lieu est levé, et rien ne s’y installera plus.',
  },
  {
    id: 'zarya',
    name: 'Zarya',
    englishName: 'Zarya',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Détruisez un Objet sur le lieu où Zarya est jouée.',
    image: img('zarya.webp'),
    // Un VRAI Objet seulement : les cartes de Piratage/IEM ne sont pas ciblables.
    onPlace: [{ type: 'DISCARD_ITEM_AT_HOST', excludePiratage: true }],
    journal:
      'Zarya apparaît : le royaume perd {nomObjet}.\n' +
      'Zarya apparaît : aucun Objet à détruire sur son lieu.',
  },
  {
    id: 'katya-volskaya',
    name: 'Katya Volskaya',
    englishName: 'Katya Volskaya',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Katya ne peut pas être piratée. Si Katya est éliminée, allez chercher Zarya et jouez-la.',
    image: img('katya-volskaya.webp'),
    onVanquish: [{ type: 'SEARCH_AND_PLACE_HERO', cardId: 'zarya' }],
    journal: 'Katya Volskaya apparaît : impossible à pirater — l’éliminer ferait accourir Zarya.',
  },
  {
    id: 'lynx-seventeen',
    name: 'LYNX Seventeen',
    englishName: 'LYNX Seventeen',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Vos Piratages et IEM coûtent 1 jeton Pouvoir supplémentaire.',
    image: img('lynx-seventeen.webp'),
    journal: 'LYNX Seventeen apparaît : Piratages et IEM coûtent 1 JT de plus.',
  },
  {
    id: 'guillermo-portero',
    name: 'Guillermo Portero',
    englishName: 'Guillermo Portero',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Guillermo ne peut être joué que sur Lumérico (même si le lieu est bloqué). Tant que Guillermo est sur le lieu, Sombra ne peut pas pirater ce lieu.',
    image: img('guillermo-portero.webp'),
    forcedFateLocation: 'lumerico',
    journal: 'Guillermo Portero apparaît à Lumérico : le lieu devient impiratable.',
  },
  {
    id: 'soldat-76',
    name: 'Soldat 76',
    englishName: 'Soldier: 76',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Défaussez un Allié sur le lieu où Soldat 76 est joué.',
    image: img('soldat-76.webp'),
    onPlace: [{ type: 'DISCARD_ALLY_AT_HOST' }],
    journal:
      'Soldat 76 apparaît : le royaume perd {nomAllié}.\n' +
      'Soldat 76 apparaît : aucun Allié à emporter.',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements
  // ----------------------------------------------------------------------
  {
    id: 'shutdown',
    name: 'Shutdown',
    englishName: 'Shutdown',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Associez cette carte à un lieu : au prochain tour de Sombra, elle ne pourra pas pirater ce lieu (ni y poser d’IEM).',
    image: img('shutdown.webp'),
    journal: 'Shutdown : {nomLieu} restera impiratable au prochain tour.',
  },
  {
    id: 'reinitialisation',
    name: 'Réinitialisation',
    englishName: 'Reset',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: 'Retirez un Piratage sur le lieu choisi.',
    image: img('reinitialisation.webp'),
    journal: 'Réinitialisation : un Piratage est levé.',
  },
  {
    id: 'vol-de-donnees',
    name: 'Vol de données',
    englishName: 'Data Theft',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Sombra perd 1 jeton Pouvoir par Piratage ou IEM présent dans son royaume.',
    image: img('vol-de-donnees.webp'),
    effects: [{ type: 'LOSE_POWER_PER_PIRATAGE' }],
    journal: 'Vol de données : chaque Piratage coûte 1 JT à Sombra.',
  },
  {
    id: 'accule',
    name: 'Acculé',
    englishName: 'Cornered',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Sombra dévoile sa main : choisissez une carte et remettez-la sur le dessus de son deck Méchant.',
    image: img('accule.webp'),
    journal:
      'Acculé : {nomCarte} repart sur le dessus de la pioche.\n' +
      'Acculé : la main est fouillée, et une carte repart sur la pioche.',
  },
]

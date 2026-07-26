// =============================================================================
// Pat Hibulaire (Pete) — cartes (deck Méchant de 30 + deck Fatalité de 15).
//
// Source : images FR du dossier assets/decks/Pat Hibulaire/ (texte recopié
// fidèlement) + wiki Villainous (https://disney-villainous.fandom.com/wiki/Pete)
// pour les quantités. Le TEXTE est la source de vérité ; les `effects` exécutables
// sont ajoutés au fil de l'eau. Plusieurs cartes reposent sur le sous-système des
// tuiles Objectif (Dingo, Clarabelle, Hors-la-loi…) implémenté progressivement.
//
// Répartition Méchant (30) : 14 Alliés, 8 Événements, 4 Conditions, 4 Objets.
// Répartition Fatalité (15) : 8 Héros, 7 Événements.
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/pat-hibulaire/${f}`

export const patHibulaireCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Alliés
  // ----------------------------------------------------------------------
  {
    id: 'bandit',
    name: 'Bandit',
    englishName: 'Bandit',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 7,
    text: 'Vous pouvez jouer plusieurs BANDIT lors d’une même action Jouer une carte.',
    image: img('bandit.webp'),
    playMultiplePerAction: true,
    journal: 'Un Bandit rejoint le royaume.',
  },
  {
    id: 'cheval',
    name: 'Cheval',
    englishName: 'Horse',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 2,
    copies: 3,
    text: 'Vous pouvez déplacer un Allié ou un Objet de votre royaume sur n’importe quel lieu.',
    image: img('cheval.webp'),
    effects: [{ type: 'MOVE_ALLY_OR_ITEM_SMART', beneficial: true }],
    journal:
      'Le Cheval rejoint le royaume et emmène {nomAllié} jusqu’à {nomLieu}.\n' +
      'Le Cheval rejoint le royaume et emmène {nomObjet} jusqu’à {nomLieu}.\n' +
      'Le Cheval rejoint le royaume.',
  },
  {
    id: 'perroquet',
    name: 'Perroquet',
    englishName: 'Parrot',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 1,
    copies: 3,
    text: 'Choisissez une carte de votre défausse et ajoutez-la à votre main.',
    image: img('perroquet.webp'),
    effects: [{ type: 'RECOVER_ANY_FROM_DISCARD' }],
    journal:
      'Le Perroquet rejoint le royaume et rapporte {nomCarte} de la défausse.\n' +
      'Le Perroquet rejoint le royaume.',
  },
  {
    id: 'grillon',
    name: 'Grillon',
    englishName: 'Cricket',
    deck: 'villain',
    type: 'ally',
    cost: 1,
    strength: 1,
    copies: 1,
    text: 'À chaque fois qu’un Héros est joué dans votre royaume, vous pouvez déplacer GRILLON sur le même lieu.',
    image: img('grillon.webp'),
    followsHeroes: true,
    journal: 'Le Grillon rejoint le royaume : il suivra les Héros qui arrivent.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Événements
  // ----------------------------------------------------------------------
  {
    id: 'une-petite-partie',
    name: 'Une Petite Partie ?',
    englishName: 'Play a Game',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 4,
    text: 'Révélez les 2 premières cartes Méchant de votre pioche. Gagnez autant de jetons Pouvoir que la somme de leur coût, puis défaussez-les.',
    image: img('une-petite-partie.webp'),
    effects: [{ type: 'PLAY_A_GAME', reveal: 2, reducerHeroCardId: 'oswald' }],
    journal: 'Une Petite Partie ? : deux cartes de la pioche sont dévoilées, et leur coût total est encaissé.',
  },
  {
    id: 'sournois-pat',
    name: 'Sournois',
    englishName: 'Sneaky Pete',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 3,
    text: 'Piochez 2 cartes Méchant, puis placez 1 carte de votre main sur le dessus ou le dessous de votre pioche.',
    image: img('sournois.webp'),
    effects: [{ type: 'DRAW_THEN_BOTTOM', draw: 2 }],
    journal: 'Sournois : deux cartes piochées, et une carte de la main repart sous ou sur la pioche.',
  },
  {
    id: 'attaque-aerienne',
    name: 'Attaque Aérienne',
    englishName: 'Air Strike!',
    deck: 'villain',
    type: 'effect',
    cost: 3,
    copies: 1,
    text: 'Déplacez Pat Hibulaire sur n’importe quel lieu où se trouve un Héros et éliminez-le. Puis votre tour est terminé.',
    image: img('attaque-aerienne.webp'),
    effects: [{ type: 'AIR_STRIKE' }],
    journal:
      'Attaque Aérienne : Pat fonce sur {nomLieu} et écrase {nomHéros} — le tour s’arrête là.\n' +
      'Attaque Aérienne : le raid s’achève, et le tour avec lui.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Conditions
  // ----------------------------------------------------------------------
  {
    id: 'mauvais-coup',
    name: 'Mauvais Coup',
    englishName: 'Mischief',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Cette carte est jouable pendant le tour d’un adversaire s’il gagne 3 jetons Pouvoir ou plus. Prenez 2 cartes Méchant du dessous de votre pioche, puis placez 1 carte de votre main sur le dessus ou le dessous de votre pioche.',
    image: img('mauvais-coup.webp'),
    trigger: { type: 'opponent-gained-power-ge', value: 3 },
    journal: 'Mauvais Coup : deux cartes du dessous de la pioche passent en main, une carte y retourne.',
  },
  {
    id: 'affront',
    name: 'Affront',
    englishName: 'Outrage',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Cette carte est jouable pendant le tour d’un adversaire s’il déplace un Allié ou un Objet. Éliminez un Héros de force 3 ou moins.',
    image: img('affront.webp'),
    trigger: { type: 'opponent-moved-card', requiresOwnHeroMaxStrength: 3 },
    journal:
      'Affront : {nomHéros} est emporté en représailles.\n' +
      'Affront : aucun Héros à emporter.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Objets (verrouillés par lieu : ajoutent une action au lieu)
  // ----------------------------------------------------------------------
  {
    id: 'magot',
    name: 'Magot',
    englishName: 'Bank Loot',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: 'Cette carte peut uniquement être jouée sur Frontier Town. Ce lieu gagne l’action : Gagner 1 jeton Pouvoir.',
    image: img('magot.webp'),
    playOnlyAt: 'frontier-town',
    grantsAction: { type: 'GAIN_POWER', amount: 1, label: 'Gagner 1 pouvoir' },
    journal: 'Magot : Frontier Town gagne l’action Gagner 1 JT.',
  },
  {
    id: 'vieux-tacot',
    name: 'Vieux Tacot',
    englishName: 'Jalopy',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: 'Cette carte peut uniquement être jouée sur la Station Service. Ce lieu gagne l’action : Jouer une carte.',
    image: img('vieux-tacot.webp'),
    playOnlyAt: 'station-service',
    grantsAction: { type: 'PLAY_CARD', label: 'Jouer une carte' },
    journal: 'Vieux Tacot : la Station Service gagne l’action Jouer une carte.',
  },
  {
    id: 'cargaison-volee',
    name: 'Cargaison Volée',
    englishName: 'Stolen Cargo',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: 'Cette carte peut uniquement être jouée sur l’Aéroport. Ce lieu gagne l’action : Gagner 1 jeton Pouvoir.',
    image: img('cargaison-volee.webp'),
    playOnlyAt: 'aeroport',
    grantsAction: { type: 'GAIN_POWER', amount: 1, label: 'Gagner 1 pouvoir' },
    journal: 'Cargaison Volée : l’Aéroport gagne l’action Gagner 1 JT.',
  },
  {
    id: 'steamboat-willie',
    name: 'Steamboat Willie',
    englishName: 'Steamboat Willie',
    deck: 'villain',
    type: 'item',
    cost: 3,
    copies: 1,
    text: 'Cette carte peut uniquement être jouée sur le Ponton. Ce lieu gagne l’action : Déplacer un Objet ou un Allié.',
    image: img('steamboat-willie.webp'),
    playOnlyAt: 'ponton',
    grantsAction: { type: 'MOVE_ITEM_ALLY', label: 'Déplacer un objet ou un allié' },
    journal: 'Steamboat Willie : le Ponton gagne l’action Déplacer un Objet ou un Allié.',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros
  // ----------------------------------------------------------------------
  {
    id: 'mickey',
    name: 'Mickey',
    englishName: 'Mickey Mouse',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'Pat Hibulaire ne peut pas remplir d’objectif tant que MICKEY est présent dans le royaume.',
    image: img('mickey.webp'),
    journal: 'Mickey apparaît : aucun objectif ne peut être rempli tant qu’il est là.',
  },
  {
    id: 'minnie',
    name: 'Minnie',
    englishName: 'Minnie Mouse',
    deck: 'fate',
    type: 'hero',
    strength: 4,
    copies: 1,
    text: 'Vous pouvez défausser un Allié ou un Objet.',
    image: img('minnie.webp'),
    onPlace: [{ type: 'FATE_DISCARD_STRONGEST_ALLY_OR_ITEM' }],
    journal:
      'Minnie apparaît : le royaume perd {nomAllié}.\n' +
      'Minnie apparaît : le royaume perd {nomObjet}.\n' +
      'Minnie apparaît.',
  },
  {
    id: 'donald',
    name: 'Donald',
    englishName: 'Donald Duck',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Pat Hibulaire doit éliminer DONALD avant les autres Héros.',
    image: img('donald.webp'),
    mustDefeatFirst: true,
    journal: 'Donald apparaît : il devra tomber avant les autres Héros.',
  },
  {
    id: 'dingo',
    name: 'Dingo',
    englishName: 'Goofy',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Vous pouvez intervertir 2 tuiles Objectif voisines OU déplacer 1 tuile Objectif sur un lieu voisin qui n’en contient pas.',
    image: img('dingo.webp'),
    onPlace: [{ type: 'FATE_DISTURB_GOAL' }],
    journal: 'Dingo apparaît : il déplace ou échange des tuiles Objectif.',
  },
  {
    id: 'horace',
    name: 'Horace',
    englishName: 'Horace Horsecollar',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Vous pouvez déplacer un Allié ou un Objet sur n’importe quel lieu.',
    image: img('horace.webp'),
    onPlace: [{ type: 'MOVE_ALLY_OR_ITEM_SMART', beneficial: false }],
    journal:
      'Horace apparaît : il déplace {nomAllié} jusqu’à {nomLieu}.\n' +
      'Horace apparaît : il déplace {nomObjet} jusqu’à {nomLieu}.\n' +
      'Horace apparaît.',
  },
  {
    id: 'clarabelle',
    name: 'Clarabelle',
    englishName: 'Clarabelle Cow',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Vous pouvez dévoiler une des tuiles Objectif de Pat Hibulaire.',
    image: img('clarabelle.webp'),
    onPlace: [{ type: 'REVEAL_PETE_GOAL' }],
    journal: 'Clarabelle apparaît : une tuile Objectif est dévoilée.',
  },
  {
    id: 'pluto',
    name: 'Pluto',
    englishName: 'Pluto',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Vous pouvez déplacer un Objet sur le lieu où vous jouez PLUTO.',
    image: img('pluto.webp'),
    onPlace: [{ type: 'FATE_MOVE_ITEM_TO_HOST' }],
    journal: 'Pluto apparaît : un Objet est attiré sur son lieu.',
  },
  {
    id: 'oswald',
    name: 'Oswald, le Lapin Chanceux',
    englishName: 'Oswald the Lucky Rabbit',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Pat Hibulaire gagne 1 jeton Pouvoir de moins quand il joue UNE PETITE PARTIE ?.',
    image: img('oswald.webp'),
    journal: 'Oswald apparaît : Une Petite Partie ? rapporte 1 JT de moins.',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements
  // ----------------------------------------------------------------------
  {
    id: 'hors-la-loi',
    name: 'Hors-la-loi',
    englishName: 'Outlawed',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Pat Hibulaire perd jusqu’à 2 jetons Pouvoir. Vous pouvez dévoiler une de ses tuiles Objectif.',
    image: img('hors-la-loi.webp'),
    effects: [{ type: 'LOSE_POWER', amount: 2 }, { type: 'REVEAL_PETE_GOAL' }],
    journal: 'Hors-la-loi : jusqu’à 2 JT s’envolent, et une tuile Objectif est dévoilée.',
  },
  {
    id: 'planques',
    name: 'Planqués',
    englishName: 'Hide',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Défaussez un BANDIT.',
    image: img('planques.webp'),
    effects: [{ type: 'DISCARD_ALLY_BY_CARDID', cardId: 'bandit' }],
    journal: 'Planqués : un Bandit part en défausse.',
  },
  {
    id: 'assomme-betement',
    name: 'Assommé Bêtement',
    englishName: 'Knocked Silly',
    deck: 'fate',
    type: 'effect',
    copies: 2,
    text: 'Dévoilez les 5 premières cartes Méchant de la pioche de Pat Hibulaire. Défaussez les cartes d’un coût supérieur ou égal à 2, mélangez les autres et replacez-les sur le dessus de la pioche.',
    image: img('assomme-betement.webp'),
    effects: [{ type: 'FATE_SCRY_DISCARD_BY_COST', count: 5, minCost: 2 }],
    journal: 'Assommé Bêtement : les 5 premières cartes sont dévoilées, et les plus chères partent en défausse.',
  },
  {
    id: 'epuise',
    name: 'Épuisé',
    englishName: 'Tired',
    deck: 'fate',
    type: 'effect',
    copies: 1,
    text: 'Pat Hibulaire perd la moitié de ses jetons Pouvoir, arrondie à l’inférieur.',
    image: img('epuise.webp'),
    effects: [{ type: 'LOSE_HALF_POWER', roundUp: false }],
    journal: 'Épuisé : la moitié des JT de Pat Hibulaire s’envole.',
  },
]

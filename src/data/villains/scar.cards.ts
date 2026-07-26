// =============================================================================
// Scar (Le Roi Lion) — cartes (deck Méchant de 30 + deck Fatalité de 15).
//
// Source : images FR du dossier assets/decks/Scar/ (texte recopié fidèlement) +
// wiki Villainous FR. Le TEXTE est la source de vérité.
// STATUT : toutes les cartes sont implémentées (Hyènes + per-other-hyena-here,
// pile Succession via Mufasa, Banzaï/Ed/Shenzi, Troupeau de gnous, Suivez-moi,
// Festin, Petit secret, Longue vie au roi, Hakuna Matata, Bâton de Rafiki bouclier,
// aura de Zazu). Aucune carte « texte seul ».
//
// =============================================================================

import type { CardDef } from '../types'

const img = (f: string) => `/cards/scar/${f}`

export const scarCards: CardDef[] = [
  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Alliés (Hyènes & Gnous)
  // ----------------------------------------------------------------------
  {
    id: 'hyene-affamee',
    name: 'Hyène affamée',
    englishName: 'Hungry Hyena',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 1,
    copies: 6,
    text: 'La force de la Hyène affamée augmente de 1 pour chaque autre Hyène sur le même lieu qu’elle.',
    image: img('hyene-affamee.webp'),
    isHyena: true,
    selfStrengthMods: [{ kind: 'per-other-hyena-here', delta: 1 }],
    journal: 'La Hyène affamée rejoint le royaume.',
  },
  {
    id: 'troupeau-gnous',
    name: 'Troupeau de gnous',
    englishName: 'Wildebeest Stampede',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 3,
    copies: 2,
    text: 'S’il y a un Héros sur le lieu où vous jouez Troupeau de gnous, déplacez-le vers un lieu voisin. Puis vous pouvez effectuer une action Éliminer un Héros sur ce nouveau lieu.',
    image: img('troupeau-gnous.webp'),
    effects: [{ type: 'GNOUS_MOVE' }],
    journal:
      'Le Troupeau de gnous déferle et emporte {nomHéros} jusqu’à {nomLieu}.\n' +
      'Le Troupeau de gnous rejoint le royaume.',
  },
  {
    id: 'banzai',
    name: 'Banzaï la hyène',
    englishName: 'Banzai',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'Gagnez 1 jeton Pouvoir pour chaque autre Hyène défaussée depuis le lieu où se trouve Banzaï.',
    image: img('banzai.webp'),
    isHyena: true,
    journal: 'Banzaï la hyène rejoint le royaume.',
  },
  {
    id: 'ed',
    name: 'Ed la hyène',
    englishName: 'Ed',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'Jouer des Hyènes sur le lieu où se trouve Ed coûte 1 jeton Pouvoir de moins.',
    image: img('ed.webp'),
    isHyena: true,
    journal: 'Ed la hyène rejoint le royaume.',
  },
  {
    id: 'shenzi',
    name: 'Shenzi la hyène',
    englishName: 'Shenzi',
    deck: 'villain',
    type: 'ally',
    cost: 2,
    strength: 2,
    copies: 1,
    text: 'Vous pouvez jouer une Hyène gratuitement de votre main.',
    image: img('shenzi.webp'),
    isHyena: true,
    effects: [{ type: 'PLAY_FREE_HYENA' }],
    journal:
      'Shenzi la hyène rejoint le royaume, et {nomAllié} suit gratuitement.\n' +
      'Shenzi la hyène rejoint le royaume.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Événements
  // ----------------------------------------------------------------------
  {
    id: 'longue-vie-roi',
    name: 'Longue vie au roi !',
    englishName: 'Long Live the King!',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 4,
    text: 'Dévoilez les 4 premières cartes Fatalité de votre pioche. Vous pouvez jouer un Héros. Défaussez les autres cartes dévoilées.',
    image: img('longue-vie-roi.webp'),
    effects: [{ type: 'REVEAL_FATE_PLAY_HERO', count: 4 }],
    journal:
      'Longue vie au roi ! : les Fatalités sont dévoilées, et {nomHéros} entre en scène.\n' +
      'Longue vie au roi ! : quatre cartes Fatalité sont dévoilées.',
  },
  {
    id: 'petit-secret',
    name: 'Petit secret',
    englishName: 'Little Secret',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Choisissez une carte Fatalité dans la défausse et jouez-la.',
    image: img('petit-secret.webp'),
    effects: [{ type: 'PLAY_FATE_HERO_FROM_DISCARD' }],
    journal: 'Petit secret : une carte Fatalité de la défausse est rejouée.',
  },
  {
    id: 'soyez-pretes',
    name: 'Soyez prêtes !',
    englishName: 'Be Prepared!',
    deck: 'villain',
    type: 'effect',
    cost: 1,
    copies: 3,
    text: 'Défaussez les 3 premières cartes de votre pioche. Vous pouvez choisir 1 Événement ou jusqu’à 2 Alliés de votre défausse et les ajouter à votre main.',
    image: img('soyez-pretes.webp'),
    effects: [{ type: 'BE_PREPARED' }],
    journal:
      'Soyez prêtes ! : trois cartes partent en défausse, et {nomCarte} revient en main.\n' +
      'Soyez prêtes ! : trois cartes partent en défausse, de quoi récupérer des renforts.',
  },
  {
    id: 'suivez-moi',
    name: 'Suivez-moi !',
    englishName: 'Follow Me!',
    deck: 'villain',
    type: 'effect',
    cost: 0,
    copies: 3,
    text: 'Choisissez une Hyène qui ne se trouve pas sur votre lieu. Effectuez 1 action disponible de ce lieu, en dehors d’une action Fatalité.',
    image: img('suivez-moi.webp'),
    effects: [{ type: 'FOLLOW_ME' }],
    journal: 'Suivez-moi ! : une Hyène éloignée prête son lieu, le temps d’une action.',
  },
  {
    id: 'festin',
    name: 'Festin',
    englishName: 'Feast',
    deck: 'villain',
    type: 'effect',
    cost: 2,
    copies: 2,
    text: 'Choisissez un lieu et déplacez-y autant de Hyènes de votre royaume que vous le désirez.',
    image: img('festin.webp'),
    requiresHyenaInRealm: true,
    effects: [{ type: 'GATHER_HYENAS' }],
    journal: 'Festin : les Hyènes du royaume se rassemblent sur un même lieu.',
  },

  // ----------------------------------------------------------------------
  // DECK MÉCHANT — Conditions
  // ----------------------------------------------------------------------
  {
    id: 'vie-pas-juste',
    name: 'La vie n’est pas juste',
    englishName: 'Life’s Not Fair',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il vous cible avec une action Fatalité. Avant qu’il ne fasse son action, regardez les deux premières cartes Fatalité de votre pioche, puis défaussez ou replacez chacune d’elles.',
    image: img('vie-pas-juste.webp'),
    trigger: { type: 'opponent-fate-targeted-me' },
    effects: [{ type: 'SCRY_OWN_FATE_TOP2' }],
    journal: 'La vie n’est pas juste : les deux premières cartes Fatalité sont triées avant l’attaque.',
  },
  {
    id: 'orgueil',
    name: 'Orgueil',
    englishName: 'Pride',
    deck: 'villain',
    type: 'condition',
    cost: 0,
    copies: 2,
    text: 'Jouable pendant le tour d’un adversaire s’il défausse au moins deux cartes. Gagnez 3 jetons Pouvoir.',
    image: img('orgueil.webp'),
    trigger: { type: 'opponent-discarded-ge', value: 2 },
    effects: [{ type: 'GAIN_POWER', amount: 3 }],
    journal: 'Orgueil : les défausses adverses rapportent 3 JT.',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Événements
  // ----------------------------------------------------------------------
  {
    id: 'hakuna-matata',
    name: 'Hakuna Matata',
    englishName: 'Hakuna Matata',
    deck: 'fate',
    type: 'effect',
    copies: 3,
    text: 'Choisissez un Héros de force 3 ou moins dans la pile Succession et jouez-le, ou déplacez un Héros vers un lieu de votre choix.',
    image: img('hakuna-matata.webp'),
    effects: [{ type: 'HAKUNA_MATATA' }],
    journal: 'Hakuna Matata : un Héros revient de la pile Succession, ou un Héros change de lieu.',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Objets
  // ----------------------------------------------------------------------
  {
    id: 'vision',
    name: 'Vision',
    englishName: 'Vision',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    attachStrengthBonus: 3,
    copies: 3,
    text: 'Associez cette carte à un Héros qui ne possède aucun Objet : sa force augmente de 3.',
    image: img('vision.webp'),
    journal: 'Vision : +3 Force pour {nomHéros}.',
  },
  {
    id: 'baton-rafiki',
    name: 'Bâton de Rafiki',
    englishName: 'Rafiki’s Staff',
    deck: 'fate',
    type: 'item',
    attach: 'hero',
    copies: 1,
    text: 'Associez cette carte à un Héros. Si ce Héros doit être éliminé, défaussez cet Objet à la place.',
    image: img('baton-rafiki.webp'),
    journal: 'Bâton de Rafiki : {nomHéros} encaissera la prochaine élimination à sa place.',
  },

  // ----------------------------------------------------------------------
  // DECK FATALITÉ — Héros
  // ----------------------------------------------------------------------
  {
    id: 'mufasa',
    name: 'Mufasa',
    englishName: 'Mufasa',
    deck: 'fate',
    type: 'hero',
    strength: 6,
    copies: 1,
    text: 'Lorsque Mufasa est éliminé, placez-le dans la pile Succession. Tant que Mufasa est dans la pile Succession, les Héros que vous éliminez y sont également placés.',
    image: img('mufasa.webp'),
    journal: 'Mufasa apparaît : éliminé, il ouvre la pile Succession — les Héros vaincus y rejoindront.',
  },
  {
    id: 'nala',
    name: 'Nala',
    englishName: 'Nala',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Vous pouvez déplacer un Héros vers n’importe quel lieu.',
    image: img('nala.webp'),
    onPlace: [{ type: 'FATE_MOVE_HERO_TO_SAFEST' }],
    journal:
      'Nala apparaît : elle met {nomHéros} à l’abri sur {nomLieu}.\n' +
      'Nala apparaît.',
  },
  {
    id: 'rafiki',
    name: 'Rafiki',
    englishName: 'Rafiki',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Scar doit éliminer Rafiki avant les autres Héros.',
    image: img('rafiki.webp'),
    mustDefeatFirst: true,
    journal: 'Rafiki apparaît : il devra tomber avant les autres Héros.',
  },
  {
    id: 'sarabi',
    name: 'Sarabi',
    englishName: 'Sarabi',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Vous pouvez défausser une Hyène sur le lieu où vous jouez Sarabi.',
    image: img('sarabi.webp'),
    onPlace: [{ type: 'DISCARD_HYENA_AT_HOST' }],
    journal:
      'Sarabi apparaît : elle chasse {nomAllié} du royaume.\n' +
      'Sarabi apparaît : aucune Hyène à chasser sur son lieu.',
  },
  {
    id: 'pumbaa',
    name: 'Pumbaa',
    englishName: 'Pumbaa',
    deck: 'fate',
    type: 'hero',
    strength: 3,
    copies: 1,
    text: 'Si Timon se trouve dans le royaume, la force de Pumbaa augmente de 2.',
    image: img('pumbaa.webp'),
    selfStrengthMods: [{ kind: 'if-card', cardId: 'timon', scope: 'realm', delta: 2 }],
    journal: 'Pumbaa apparaît : +2 Force tant que Timon est dans le royaume.',
  },
  {
    id: 'timon',
    name: 'Timon',
    englishName: 'Timon',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'Si Pumbaa se trouve dans le royaume, la force de Timon augmente de 2.',
    image: img('timon.webp'),
    selfStrengthMods: [{ kind: 'if-card', cardId: 'pumbaa', scope: 'realm', delta: 2 }],
    journal: 'Timon apparaît : +2 Force tant que Pumbaa est dans le royaume.',
  },
  {
    id: 'zazu',
    name: 'Zazu',
    englishName: 'Zazu',
    deck: 'fate',
    type: 'hero',
    strength: 2,
    copies: 1,
    text: 'La force des autres Héros sur le lieu où se trouve Zazu est réduite de 2. Celle des Héros sur les autres lieux est augmentée de 1.',
    image: img('zazu.webp'),
    journal: 'Zazu apparaît : −2 Force pour les Héros de son lieu, +1 pour les autres.',
  },
  {
    id: 'simba',
    name: 'Simba',
    englishName: 'Simba',
    deck: 'fate',
    type: 'hero',
    strength: 5,
    copies: 1,
    text: 'La force des Hyènes ne peut pas dépasser 2.',
    image: img('simba.webp'),
    journal: 'Simba apparaît : la Force des Hyènes plafonne à 2.',
  },
]

export const scarCardById: Record<string, CardDef> = Object.fromEntries(
  scarCards.map((c) => [c.id, c]),
)

import type { VillainKey } from './store/gameStore'

/**
 * Packs (boîtes) Disney Villainous : chaque pack regroupe un lot de vilains et a
 * un nom, une image et une date de sortie (USA). Donnée de présentation pure
 * (hors moteur), à la manière de `villainGuide` / `villainColors`.
 *
 * Renseigné pack par pack ; les images vivent dans `public/packs/`.
 */
export interface VillainPack {
  /** Slug ASCII unique du pack. */
  id: string
  /** Nom commercial du pack. */
  name: string
  /** Image de la boîte (servie depuis `public/`), si disponible. */
  image?: string
  /** Date de sortie aux USA (texte court). */
  releaseUS: string
  /** Date de sortie en France (texte court). */
  releaseFR: string
  /** Vilains du pack PRÉSENTS dans le jeu (clés du registre). */
  villains: VillainKey[]
  /** Vilains du pack NON implémentés (noms d'affichage seulement) — pour un catalogue complet. */
  otherMembers?: string[]
}

/** Liste des packs, dans l'ordre de sortie. */
export const VILLAIN_PACKS: VillainPack[] = [
  {
    id: 'pack-1',
    name: 'Quel méchant sommeille en vous ?',
    image: '/packs/pack-1.png',
    releaseUS: 'Juillet 2018',
    releaseFR: 'Novembre 2018',
    villains: ['crochet', 'jafar', 'maleficent', 'princeJohn', 'reineCoeur', 'ursula'],
  },
  {
    id: 'pack-2',
    name: "Mauvais jusqu'à l'os",
    image: '/packs/pack-2.png',
    releaseUS: 'Mars 2019',
    releaseFR: 'Septembre 2019',
    villains: ['facilier', 'hades', 'mechanteReine'],
  },
  {
    id: 'pack-3',
    name: 'La fin est proche !',
    image: '/packs/pack-3.png',
    releaseUS: 'Juillet 2019',
    releaseFR: 'Novembre 2019',
    villains: ['ratigan', 'scar', 'yzma'],
  },
  {
    id: 'pack-4',
    name: 'Cruellement infects',
    image: '/packs/pack-4.png',
    releaseUS: 'Mars 2020',
    releaseFR: 'Septembre 2020',
    villains: ['cruella', 'gothel', 'patHibulaire'],
  },
  {
    id: 'pack-5',
    name: 'Monstrueusement malsains',
    image: '/packs/pack-5.png',
    releaseUS: 'Février 2021',
    releaseFR: 'Septembre 2021',
    // « Le Seigneur des clés » du jeu est une collab fan distincte → non rattaché ici.
    villains: ['gaston', 'madameTremaine', 'seigneurTenebres'],
  },
  {
    id: 'pack-6',
    name: 'Plus grands, plus méchants',
    image: '/packs/pack-6.png',
    releaseUS: 'Mars 2022',
    releaseFR: 'Septembre 2022',
    villains: ['lotso', 'madameMim', 'syndrome'],
  },
  {
    id: 'pack-7',
    name: "Rempli d'effroi",
    image: '/packs/pack-7.png',
    releaseUS: 'Octobre 2023',
    releaseFR: 'Février 2024',
    villains: ['oogieBoogie'],
  },
  {
    id: 'pack-8',
    name: 'Morsure sucrée',
    image: '/packs/pack-8.png',
    releaseUS: 'Juin 2024',
    releaseFR: 'Septembre 2024',
    villains: ['saSucrerie'],
    otherMembers: ['Shere Khan'],
  },
  {
    id: 'pack-9',
    name: 'Larmes de fond',
    releaseUS: 'Octobre 2023',
    releaseFR: 'Février 2024',
    villains: [],
    otherMembers: ['Davy Jones', 'Tamatoa'],
  },
]

/** Index vilain → pack (construit une fois). */
const PACK_BY_VILLAIN: Partial<Record<VillainKey, VillainPack>> = {}
for (const pack of VILLAIN_PACKS) {
  for (const key of pack.villains) PACK_BY_VILLAIN[key] = pack
}

/** Pack d'un vilain (undefined si pas encore rattaché à un pack). */
export function villainPack(key: VillainKey): VillainPack | undefined {
  return PACK_BY_VILLAIN[key]
}

/** Créateur d'un vilain de COLLABORATION (fan-made, hors packs officiels). */
const VILLAIN_CREATOR: Partial<Record<VillainKey, string>> = {
  slenderman: 'Alexis',
  imposteur: 'Alexis',
  sombra: 'Alexis',
  seigneurCles: 'Alexis',
  bowser: 'Jules',
}

/** Créateur d'un vilain de collaboration (undefined si vilain officiel / inconnu). */
export function villainCreator(key: VillainKey): string | undefined {
  return VILLAIN_CREATOR[key]
}

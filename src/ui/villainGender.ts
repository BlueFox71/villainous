import { isCustomKey, villainKeyOf, type VillainKey } from './store/gameStore'

/** Genre grammatical du vilain — sert aux pronoms du journal (« Il/Elle subit… »).
 *  Présentation pure (comme `villainColors`/`villainArt`). Défaut : masculin. */
const FEMININE: ReadonlySet<VillainKey> = new Set<VillainKey>([
  'maleficent',
  'reineCoeur',
  'ursula',
  'mechanteReine',
  'yzma',
  'sombra',
  'gothel',
  'cruella',
  'madameTremaine',
  'madameMim',
  'laBonneFee',
  'teamRocket', // « la Team Rocket »
])

/** Genre du vilain à partir de son id de jeu (`player.villain`). 'f' = féminin. */
export function villainGender(villain: string): 'm' | 'f' {
  if (isCustomKey(villain)) return 'm' // vilains publiés : pas de donnée de genre
  return FEMININE.has(villainKeyOf(villain)) ? 'f' : 'm'
}

/** Article défini précédant le nom du vilain (« contre la Team Rocket »). La plupart
 *  des vilains sont des noms propres sans article → chaîne vide par défaut. */
const ARTICLE: Partial<Record<VillainKey, string>> = {
  teamRocket: 'la ',
}

/** Article (« la »/« le »…) à mettre devant le nom du vilain, ou '' si nom propre. */
export function villainArticle(villain: string): string {
  if (isCustomKey(villain)) return ''
  return ARTICLE[villainKeyOf(villain)] ?? ''
}

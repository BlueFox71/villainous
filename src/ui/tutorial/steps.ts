// =============================================================================
// Tutoriel interactif guidé (Prince Jean) — définition des ÉTAPES.
//
// Chaque étape affiche une consigne et VERROUILLE le jeu : seule l'action attendue
// (`gate`) est autorisée ; les autres sont refusées avec un message doux. L'étape
// avance quand l'action attendue vient d'être appliquée (`advanceOn`). Les étapes
// `info` n'attendent aucune action de jeu : on avance avec le bouton « Suivant ».
//
// Le verrouillage vit dans le store (gameStore.submit) ; l'affichage dans
// TutorialOverlay. On gate par TYPE d'action (pas par carte précise) → robuste quelle
// que soit la main tirée.
// =============================================================================
import type { GameAction, GameState } from '../../engine/types'

export interface TutorialStep {
  id: string
  /** Consigne (gras Markdown simple `**…**` rendu par l'overlay). */
  text: string
  /** Étape informative : aucune action de jeu, on avance avec « Suivant ». */
  info?: boolean
  /** Attribut `data-tutorial` de l'élément à mettre en évidence (spotlight — à venir). */
  target?: string
  /** Action de jeu AUTORISÉE (les autres sont bloquées). Absent = tout est bloqué. */
  gate?: (action: GameAction, state: GameState) => boolean
  /** Passe à l'étape suivante quand cette action vient d'être appliquée. */
  advanceOn?: (action: GameAction) => boolean
  /** Message si le joueur tente une action non autorisée. */
  blockHint?: string
}

/** Actions de RÉSOLUTION (suites d'un coup : choix de Fatalité, reprise…) : toujours
 *  tolérées pendant une étape « action » pour ne pas bloquer une séquence entamée. */
const isResolution = (t: string) =>
  t.startsWith('RESOLVE_') ||
  t.startsWith('PASS') ||
  t.startsWith('ACKNOWLEDGE') ||
  t.startsWith('SKIP') ||
  t.startsWith('DONE') ||
  t.startsWith('CANCEL')

export const TUTORIAL_STEPS: TutorialStep[] = [
  // --- Concepts généraux de Villainous (le Prince Jean n'est que le support) ---
  {
    id: 'intro',
    info: true,
    text: "Bienvenue dans **Villainous** ! Ici, tu incarnes un **méchant** et tu affrontes un adversaire. Chaque méchant a **son propre objectif** à atteindre pour gagner. Apprenons les règles ensemble sur un premier tour.",
  },
  {
    id: 'objective',
    info: true,
    target: 'objective',
    text: "Ton méchant est le **Prince Jean**. Son objectif : posséder **20 jetons Pouvoir** au début d'un de tes tours. Chaque méchant gagne différemment — ici, il faut donc **accumuler du Pouvoir**.",
  },
  {
    id: 'power',
    info: true,
    text: "Les **jetons Pouvoir** sont la **monnaie** du jeu : ils servent à **jouer tes cartes** (chaque carte a un coût) et, pour le Prince Jean, ils **sont** la condition de victoire. Tu en as 5 pour commencer.",
  },
  {
    id: 'turn',
    info: true,
    text: "Un tour se déroule en deux temps : d'abord tu **déplaces ton pion** sur un **autre lieu** (obligatoire), puis tu utilises les **actions** de ce lieu. Commençons.",
  },
  {
    id: 'move',
    target: 'locations',
    text: "Chaque lieu offre des actions différentes (les symboles en haut/bas). Déplace ton pion sur **Nottingham** : il propose à la fois « Gagner du Pouvoir » et « Jouer une carte ».",
    gate: (a) => a.type === 'MOVE' && a.to === 'nottingham',
    advanceOn: (a) => a.type === 'MOVE' && a.to === 'nottingham',
    blockHint: 'Déplace ton pion sur Nottingham pour continuer.',
  },
  {
    id: 'actions',
    info: true,
    target: 'actions',
    text: "Un lieu affiche plusieurs **types d'actions** : **Gagner du Pouvoir**, **Jouer une carte**, **Fatalité** (gêner l'adversaire), **Éliminer un Héros**, **Déplacer**… Tu peux utiliser **chaque action une fois** ce tour-ci, dans l'ordre que tu veux.",
  },
  {
    id: 'gain',
    target: 'actions',
    text: "Commence par l'action **« Gagner 1 Pouvoir »** de Nottingham : clique dessus. C'est la façon la plus simple de progresser vers tes 20.",
    gate: (a) => a.type === 'EXECUTE_ACTION' || isResolution(a.type),
    advanceOn: (a) => a.type === 'EXECUTE_ACTION',
    blockHint: 'Utilise l\'action « Gagner 1 Pouvoir » de Nottingham.',
  },
  {
    id: 'cards',
    info: true,
    target: 'hand',
    text: "Ta **main** contient 4 types de cartes : **Alliés** (se posent sur un lieu, ils ont une Force pour combattre), **Objets** (bonus, souvent attachés à un Allié), **Effets** (action ponctuelle puis défaussés) et **Conditions** (se déclenchent en réaction au tour adverse).",
  },
  {
    id: 'play',
    target: 'hand',
    text: "Utilise l'action **« Jouer une carte »** de Nottingham et joue un **Allié** : il se pose sur un lieu et te servira plus tard à **éliminer les Héros**. (Jouer une carte coûte son prix en Pouvoir.)",
    gate: (a) => a.type === 'PLAY_CARD' || isResolution(a.type),
    advanceOn: (a) => a.type === 'PLAY_CARD',
    blockHint: 'Joue une carte de ta main via l\'action « Jouer une carte ».',
  },
  {
    id: 'fate',
    info: true,
    text: "À son tour, l'adversaire peut utiliser une action **Fatalité** pour t'envoyer des **Héros** dans ton domaine : ils **recouvrent tes actions** et te ralentissent. Tu t'en débarrasses avec l'action **« Éliminer un Héros »**, si tes Alliés présents ont assez de **Force**.",
  },
  {
    id: 'end',
    target: 'end-turn',
    text: "Quand tu as fini, **termine ton tour** : clique « Terminer le tour ». Tu repioches jusqu'à 4 cartes, puis l'adversaire joue.",
    gate: (a) => a.type === 'END_TURN' || isResolution(a.type),
    advanceOn: (a) => a.type === 'END_TURN',
    blockHint: 'Termine ton tour pour continuer.',
  },
  {
    id: 'outro',
    info: true,
    text: "🎉 Voilà la **boucle de base** : **se déplacer → utiliser les actions du lieu → terminer**. Répète-la en gérant tes Pouvoir, tes cartes et les Héros adverses jusqu'à atteindre ton objectif. À toi de jouer !",
  },
]

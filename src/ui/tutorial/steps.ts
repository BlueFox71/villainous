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
  {
    id: 'intro',
    info: true,
    target: 'objective',
    text: "Bienvenue ! Tu incarnes le **Prince Jean**. Ton objectif : posséder **20 jetons Pouvoir** au début d'un de tes tours. Suivons ensemble ton premier tour.",
  },
  {
    id: 'move',
    target: 'locations',
    text: "Chaque tour commence par un **déplacement obligatoire** vers un autre lieu. Déplace ton pion sur **Nottingham**.",
    gate: (a) => a.type === 'MOVE' && a.to === 'nottingham',
    advanceOn: (a) => a.type === 'MOVE' && a.to === 'nottingham',
    blockHint: 'Déplace ton pion sur Nottingham pour continuer.',
  },
  {
    id: 'gain',
    target: 'actions',
    text: "Te voilà sur ton lieu. Utilise l'action **« Gagner 1 Pouvoir »** : c'est ainsi que tu progresses vers les 20.",
    gate: (a) => a.type === 'EXECUTE_ACTION' || isResolution(a.type),
    advanceOn: (a) => a.type === 'EXECUTE_ACTION',
    blockHint: 'Utilise une action « Gagner du Pouvoir » de ton lieu.',
  },
  {
    id: 'play',
    target: 'hand',
    text: "Joue maintenant une **carte de ta main** via une action **« Jouer une carte »** (un Allié se pose sur un lieu et t'aidera à éliminer les Héros).",
    gate: (a) => a.type === 'PLAY_CARD' || isResolution(a.type),
    advanceOn: (a) => a.type === 'PLAY_CARD',
    blockHint: 'Joue une carte de ta main (action « Jouer une carte »).',
  },
  {
    id: 'end',
    target: 'end-turn',
    text: "Quand tu as fini tes actions, **termine ton tour** : clique « Terminer le tour ».",
    gate: (a) => a.type === 'END_TURN' || isResolution(a.type),
    advanceOn: (a) => a.type === 'END_TURN',
    blockHint: 'Termine ton tour pour continuer.',
  },
  {
    id: 'outro',
    info: true,
    text: "🎉 Bravo ! Tu as joué ton premier tour : **déplacement → action de lieu → carte → fin de tour**, c'est la boucle de base. Continue à jouer pour atteindre 20 Pouvoir — et attends-toi à voir des **Héros** (Fatalité) débarquer pour te gêner : tu les élimineras avec tes Alliés.",
  },
]

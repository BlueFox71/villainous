import { describe, it, expect } from 'vitest'
import type { GameState, VillainDef } from '../../engine/types'
import {
  SAVE_VERSION,
  SAVE_KEY,
  saveGame,
  loadSavedGame,
  clearSavedGame,
  snapshotForSave,
  stripDataUrls,
  reinjectVillainImages,
} from '../store/gamePersistence'

/** Stockage factice (en mémoire) : le moteur de test tourne en env `node`, sans
 *  sessionStorage. On injecte ce faux Storage aux fonctions pour les tester purement. */
function fakeStore() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v) },
    removeItem: (k: string) => { map.delete(k) },
  }
}

// GameState minimal : les fonctions ne valident que la présence de `players` (tableau).
const fakeState = {
  players: [{ villain: 'custom-guldan' }, { villain: 'maleficent' }],
} as unknown as GameState

const soloSnap = {
  mode: 'solo' as const,
  seats: ['local', 'bot'] as ['local', 'bot'],
  localPlayerIndex: 0,
  testMode: false,
  preTestState: null,
  state: fakeState,
}

describe('gamePersistence — stockage', () => {
  it('round-trip : loadSavedGame relit exactement ce que saveGame a écrit', () => {
    const store = fakeStore()
    saveGame(soloSnap, store)
    expect(loadSavedGame(store)).toEqual({ v: SAVE_VERSION, ...soloSnap })
  })

  it('jette une sauvegarde de version obsolète (schéma changé)', () => {
    const store = fakeStore()
    store.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION + 1, ...soloSnap }))
    expect(loadSavedGame(store)).toBeUndefined()
  })

  it('jette une sauvegarde corrompue (JSON invalide)', () => {
    const store = fakeStore()
    store.setItem(SAVE_KEY, '{pas du json')
    expect(loadSavedGame(store)).toBeUndefined()
  })

  it('jette une sauvegarde sans état de partie valide', () => {
    const store = fakeStore()
    store.setItem(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION }))
    expect(loadSavedGame(store)).toBeUndefined()
  })

  it('renvoie undefined quand rien n’est sauvegardé', () => {
    expect(loadSavedGame(fakeStore())).toBeUndefined()
  })

  it('clearSavedGame efface la sauvegarde', () => {
    const store = fakeStore()
    saveGame(soloSnap, store)
    clearSavedGame(store)
    expect(loadSavedGame(store)).toBeUndefined()
  })

  it('sans stockage (env sans sessionStorage), les fonctions sont inertes', () => {
    expect(() => saveGame(soloSnap, null)).not.toThrow()
    expect(loadSavedGame(null)).toBeUndefined()
    expect(() => clearSavedGame(null)).not.toThrow()
  })

  it('snapshotForSave ne renvoie l’instantané qu’en solo (jamais en réseau)', () => {
    expect(snapshotForSave(soloSnap)).toEqual(soloSnap)
    expect(snapshotForSave({ ...soloSnap, mode: 'host' })).toBeNull()
    expect(snapshotForSave({ ...soloSnap, mode: 'client' })).toBeNull()
  })

  it('saveGame retire les images base64 (data:) de l’état avant d’écrire', () => {
    const store = fakeStore()
    const heavy = {
      players: [
        { villain: 'custom-guldan', boardImage: 'data:image/png;base64,AAAA', pawnImage: '/pion.png' },
      ],
    } as unknown as GameState
    saveGame({ ...soloSnap, state: heavy }, store)
    const p = loadSavedGame(store)!.state.players[0] as unknown as { boardImage: string; pawnImage: string }
    expect(p.boardImage).toBe('') // dataURL retiré
    expect(p.pawnImage).toBe('/pion.png') // chemin natif conservé
  })
})

describe('stripDataUrls', () => {
  it('remplace toute chaîne data: par une chaîne vide, récursivement', () => {
    const input = {
      a: 'data:image/png;base64,ZZZ',
      b: '/chemin/natif.png',
      c: [{ img: 'data:xxx' }, { img: 'ok' }],
      n: 42,
      z: null,
    }
    expect(stripDataUrls(input)).toEqual({
      a: '',
      b: '/chemin/natif.png',
      c: [{ img: '' }, { img: 'ok' }],
      n: 42,
      z: null,
    })
  })

  it('ne mute pas l’entrée', () => {
    const input = { img: 'data:xxx' }
    stripDataUrls(input)
    expect(input.img).toBe('data:xxx')
  })
})

describe('reinjectVillainImages', () => {
  const def = {
    boardImage: 'board-A',
    pawnImage: 'pawn',
    backVillainImage: 'backV',
    backFateImage: 'backF',
    altObjective: { boardImage: 'board-B' },
    locations: [{ id: 'loc-1', bColumnImage: 'colB' }, { id: 'loc-2' }],
  } as unknown as VillainDef
  const defOf = (id: string) => (id === 'custom-x' ? def : undefined)

  it('remplit les images du joueur depuis le def (objectif face A)', () => {
    const state = {
      players: [{ villain: 'custom-x', boardImage: '', pawnImage: '', backVillainImage: '', backFateImage: '', locations: [{ id: 'loc-1', bColumnImage: '' }, { id: 'loc-2' }] }],
    } as unknown as GameState
    const out = reinjectVillainImages(state, defOf)
    const p = out.players[0] as unknown as { boardImage: string; altBoardImage?: string; pawnImage: string; locations: { bColumnImage?: string }[] }
    expect(p.boardImage).toBe('board-A')
    expect(p.altBoardImage).toBe('board-B')
    expect(p.pawnImage).toBe('pawn')
    expect(p.locations[0].bColumnImage).toBe('colB')
  })

  it('respecte la bascule d’objectif (face B → boardImage = image alternative)', () => {
    const state = {
      players: [{ villain: 'custom-x', objectiveVersion: 'b', boardImage: '', locations: [] }],
    } as unknown as GameState
    const p = reinjectVillainImages(state, defOf).players[0] as unknown as { boardImage: string; altBoardImage?: string }
    expect(p.boardImage).toBe('board-B')
    expect(p.altBoardImage).toBe('board-A')
  })

  it('laisse le joueur intact si le vilain est introuvable (placeholders)', () => {
    const state = { players: [{ villain: 'inconnu', boardImage: '' }] } as unknown as GameState
    const p = reinjectVillainImages(state, defOf).players[0] as unknown as { boardImage: string }
    expect(p.boardImage).toBe('')
  })
})

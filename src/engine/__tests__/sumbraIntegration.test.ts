import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  toVillainDef,
  toDeckCardDefs,
  toCombattantInstances,
  type CustomVillain,
} from '../../data/customVillain'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame, type PlayerSetup } from '../state'
import {
  resolveCombattantRevenue,
  conqueredLocationCount,
  combattantRevenue,
  isLocationControlled,
} from '../spirits'

// Charge l'export réel de Sumbra (données de jeu ; les images sont ignorées ici pour la
// vitesse). Valide que la donnée produite par l'Atelier alimente correctement le moteur.
function loadSumbra(): CustomVillain {
  const p = resolve(process.cwd(), 'assets/custom-exports/custom-mrl4fb45.json')
  const v = JSON.parse(readFileSync(p, 'utf8')) as CustomVillain
  // Allège les images (non nécessaires aux tests moteur).
  for (const l of v.locations as unknown[]) delete (l as { image?: string }).image
  for (const c of v.cards as unknown[]) { delete (c as { image?: string }).image; delete (c as { artImage?: string }).artImage }
  return v
}

function buildSumbraGame(): ReturnType<typeof createInitialGame> {
  const v = loadSumbra()
  const main = toDeckCardDefs(v)
  const setup: PlayerSetup = {
    villain: { ...toVillainDef(v), name: v.name },
    deckCards: buildDeckInstances(main, 'villain', 'p0:'),
    fateCards: buildDeckInstances(main, 'fate', 'p0f:'),
    combattantCards: toCombattantInstances(v, 'p0:comb:'),
  }
  const opp: PlayerSetup = {
    villain: { ...toVillainDef(v), id: 'opp', name: 'Adversaire', objective: { type: 'POWER_THRESHOLD', threshold: 20 } },
    deckCards: [{ instanceId: 'p1:c', cardId: 'c', name: 'c', type: 'ally', strength: 1, cost: 1 }],
    fateCards: [],
  }
  return createInitialGame([setup, opp], 999)
}

describe('Sumbra — intégration depuis l’export réel', () => {
  it('construit une partie : objectif esprits, 86 Combattants, défenses, jauge à 0', () => {
    const g = buildSumbraGame()
    const p = g.players[0]
    expect(p.objective.type).toBe('SPIRIT_THRESHOLD')
    expect(p.spirits).toBe(0)
    expect(p.combattantDeck?.length).toBe(86)
    // Les 2 lieux de droite sont conquérables (defense) ; les 2 home ne le sont pas.
    const defs = p.locations.map((l) => l.defense)
    expect(defs.filter((d) => d !== undefined).length).toBe(2)
    // 2 lieux home contrôlés d'emblée, aucun conquis.
    expect(conqueredLocationCount(g, 0)).toBe(0)
    expect(combattantRevenue(g, 0)).toBe(0)
  })

  it('chaque Combattant porte ses valeurs d’esprit et son verbe', () => {
    const g = buildSumbraGame()
    for (const c of g.players[0].combattantDeck ?? []) {
      expect(c.spiritSun, `${c.name} sun`).toBeGreaterThanOrEqual(1)
      expect(c.spiritMoon, `${c.name} moon`).toBeGreaterThanOrEqual(1)
      expect(c.combattantVerb, `${c.name} verbe`).toBeTruthy()
      expect(c.combattantMagnitude, `${c.name} N`).toBeGreaterThanOrEqual(1)
    }
  })

  it('conquérir un lieu (garnison ≥ Défense) ouvre le revenu et capture des esprits', () => {
    let g = buildSumbraGame()
    // Trouve un lieu conquérable et sa défense.
    const conquerable = g.players[0].locations.find((l) => l.defense !== undefined)!
    // Pose des Marionnettes d'Élite (Force 3) jusqu'à ≥ défense.
    const elite = () => ({ instanceId: `e${Math.random()}`, cardId: 'custom-mrl4fb45-c3', name: "Élite", type: 'ally' as const, strength: 3 })
    const need = Math.ceil(conquerable.defense! / 3)
    for (let i = 0; i < need; i++) {
      g = {
        ...g,
        players: g.players.map((p, idx) =>
          idx === 0
            ? { ...p, board: { ...p.board, [conquerable.id]: [...(p.board[conquerable.id] ?? []), elite()] } }
            : p,
        ),
      }
    }
    expect(isLocationControlled(g, 0, conquerable.id)).toBe(true)
    expect(combattantRevenue(g, 0)).toBeGreaterThanOrEqual(1)
    const rev = resolveCombattantRevenue(g, 0)
    expect(rev.players[0].spirits ?? 0).toBeGreaterThanOrEqual(1)
  })
})

import { describe, it, expect } from 'vitest'
import { applyAction, placeFateHeroWithEffects } from '../actions'
import { effectiveStrength } from '../rules'
import { createInitialGame } from '../state'
import { buildDeckInstances } from '../../data/types'
import { getCardDef } from '../../data/registry'
import { teamRocket } from '../../data/villains/team-rocket'
import { teamRocketCards } from '../../data/villains/team-rocket.cards'
import type { CardInstance, GameState } from '../types'
import { me, withActive } from './_helpers'

const trGame = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: teamRocket,
        deckCards: buildDeckInstances(teamRocketCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(teamRocketCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

function ally(id: string, cardId: string, strength: number): CardInstance {
  const def = getCardDef(cardId)
  return { instanceId: id, cardId, name: cardId, type: 'ally', strength, strengthMod: def?.strengthMod }
}
function pokemon(id: string, cardId: string, strength: number): CardInstance {
  const def = getCardDef(cardId)
  return { instanceId: id, cardId, name: cardId, type: 'hero', isPokemon: true, strength, strengthMod: def?.strengthMod }
}
function captured(cardId: string): CardInstance {
  return { instanceId: cardId, cardId, name: cardId, type: 'hero', isPokemon: true, strength: 1 }
}

describe('Team Rocket — Attraper un Pokémon (CATCH_POKEMON)', () => {
  it('Vaincre un Pokémon le COUCHE (K.O.) sur place au lieu de le défausser', () => {
    // Le Vaincre du Centre Pokémon est en bas (non recouvert par le Pokémon présent).
    let s = applyAction(trGame(), { type: 'MOVE', to: 'centre-pokemon' })
    s = withActive(s, {
      board: { ...me(s).board, 'centre-pokemon': [pokemon('pk', 'togepi', 1), ally('a1', 'miaouss', 3)] },
    })
    s = applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'pk', allyInstanceIds: ['a1'] })
    const p = me(s)
    const ko = (p.board['centre-pokemon'] ?? []).find((c) => c.instanceId === 'pk')
    expect(ko?.pokemonKO).toBe(true) // reste sur le plateau, couché
    expect(p.capturedPokemon ?? []).toHaveLength(0) // pas encore attrapé
    expect(p.fateDiscard.map((c) => c.instanceId)).not.toContain('pk')
    expect(p.discard.map((c) => c.instanceId)).toContain('a1') // l'Allié est dépensé
  })

  it('Attraper prend un Pokémon DÉJÀ couché (depuis n’importe quel lieu) → pile de Captures', () => {
    // Pokémon couché posé au Centre Pokémon ; on l'attrape via l'action du Labo.
    let s = withActive(trGame(), { pawnLocation: 'foret' })
    s = applyAction(s, { type: 'MOVE', to: 'labo' })
    s = withActive(s, {
      board: {
        ...me(s).board,
        'centre-pokemon': [{ instanceId: 'pk', cardId: 'togepi', name: 'Togepi', type: 'hero', isPokemon: true, strength: 1, pokemonKO: true, koOnTurn: s.turn }],
      },
    })
    s = applyAction(s, { type: 'CATCH_POKEMON', actionId: 'catch', heroInstanceId: 'pk', allyInstanceIds: [] })
    const p = me(s)
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'pk')).toBe(false)
    expect((p.capturedPokemon ?? []).map((c) => c.instanceId)).toContain('pk')
  })

  it('Vaincre un Pokémon échoue si la Force des Alliés est insuffisante', () => {
    let s = applyAction(trGame(), { type: 'MOVE', to: 'centre-pokemon' })
    s = withActive(s, {
      board: { ...me(s).board, 'centre-pokemon': [pokemon('pk', 'pikachu', 5), ally('a1', 'miaouss', 3)] },
    })
    expect(() =>
      applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'pk', allyInstanceIds: ['a1'] }),
    ).toThrow()
  })

  it('Attraper refuse un Pokémon pas encore vaincu (non couché)', () => {
    let s = withActive(trGame(), { pawnLocation: 'foret' })
    s = applyAction(s, { type: 'MOVE', to: 'labo' })
    s = withActive(s, {
      board: { ...me(s).board, 'centre-pokemon': [pokemon('pk', 'togepi', 1)] },
    })
    expect(() =>
      applyAction(s, { type: 'CATCH_POKEMON', actionId: 'catch', heroInstanceId: 'pk', allyInstanceIds: [] }),
    ).toThrow()
  })

  it('un Pokémon couché frais survit à une fin de tour ; expiré, il part en défausse', () => {
    // Frais (KO ce tour-ci) : survit.
    let s = withActive(trGame(), {
      board: { foret: [{ instanceId: 'pk', cardId: 'togepi', name: 'Togepi', type: 'hero', isPokemon: true, strength: 1, pokemonKO: true, koOnTurn: trGame().turn }] },
      pawnLocation: 'labo',
    })
    s = applyAction(s, { type: 'MOVE', to: 'foret' })
    s = applyAction(s, { type: 'END_TURN' })
    expect(Object.values(me(s).board).flat().some((c) => c.instanceId === 'pk')).toBe(true)
    // Expiré (KO il y a ≥ 2 tours) : défaussé à la fin du tour.
    let s2 = withActive(trGame(), {
      board: { foret: [{ instanceId: 'pk2', cardId: 'togepi', name: 'Togepi', type: 'hero', isPokemon: true, strength: 1, pokemonKO: true, koOnTurn: trGame().turn - 2 }] },
      pawnLocation: 'labo',
    })
    s2 = applyAction(s2, { type: 'MOVE', to: 'foret' })
    s2 = applyAction(s2, { type: 'END_TURN' })
    const p = me(s2)
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'pk2')).toBe(false)
    expect(p.fateDiscard.map((c) => c.instanceId)).toContain('pk2')
  })

  it('victoire : 4 Pokémon dont Pikachu dans la pile au début du tour', () => {
    let s = trGame()
    s = withActive(s, {
      capturedPokemon: [captured('dracaufeu'), captured('stari'), captured('goupix'), captured('pikachu')],
      pawnLocation: 'labo',
    })
    s = applyAction(s, { type: 'MOVE', to: 'foret' })
    s = applyAction(s, { type: 'END_TURN' })
    expect(s.status).toBe('WON')
  })

  it('Dracaufeu : +1 à la force des AUTRES Pokémon (pas lui-même)', () => {
    const s = withActive(trGame(), {
      board: {
        labo: [pokemon('drac', 'dracaufeu', 4), pokemon('tog', 'togepi', 1)],
        foret: [pokemon('star', 'stari', 3)],
      },
    })
    // Togepi (autre lieu : aura GLOBALE de royaume) : 1 → 2.
    expect(effectiveStrength(s, s.activePlayer, 'tog')).toBe(2)
    // Stari (autre lieu) : 3 → 4.
    expect(effectiveStrength(s, s.activePlayer, 'star')).toBe(4)
    // Dracaufeu ne se buffe pas lui-même : reste 4.
    expect(effectiveStrength(s, s.activePlayer, 'drac')).toBe(4)
  })

  it('un dresseur invoque son Pokémon (depuis la pioche Fatalité) sur le même lieu', () => {
    const s0 = trGame()
    const sacha = {
      instanceId: 'sacha1', cardId: 'sacha', name: 'Sacha', type: 'hero' as const,
      strength: 1, summonsPokemonCardIds: ['pikachu', 'dracaufeu'],
    }
    const s = placeFateHeroWithEffects(s0, 0, 0, sacha, 'foret', 'Forêt')
    const cell = s.players[0].board['foret'] ?? []
    expect(cell.some((c) => c.instanceId === 'sacha1')).toBe(true)
    const poke = cell.find((c) => c.isPokemon)
    expect(poke).toBeDefined()
    expect(['pikachu', 'dracaufeu']).toContain(poke!.cardId)
    expect(poke!.summonedByInstanceId).toBe('sacha1')
    // Le Pokémon invoqué a quitté la pioche Fatalité.
    expect(s.players[0].fateDeck.some((c) => c.instanceId === poke!.instanceId)).toBe(false)
  })

  it('pas de victoire : 4 Pokémon mais SANS Pikachu', () => {
    let s = trGame()
    s = withActive(s, {
      capturedPokemon: [captured('dracaufeu'), captured('stari'), captured('goupix'), captured('onix')],
      pawnLocation: 'labo',
    })
    s = applyAction(s, { type: 'MOVE', to: 'foret' })
    s = applyAction(s, { type: 'END_TURN' })
    expect(s.status).not.toBe('WON')
  })
})

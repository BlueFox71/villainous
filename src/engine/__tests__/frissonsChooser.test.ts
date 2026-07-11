import { describe, it, expect } from 'vitest'
import { resolveEffect } from '../effects'
import { flagelleurMental, flagelleurMentalCards } from '../../data/published/flagelleurMental'
import { buildDeckInstances } from '../../data/types'
import { createInitialGame } from '../state'
import type { CardInstance, GameState } from '../types'

const hero = (): CardInstance => ({ instanceId: 'h1', cardId: 'mike', name: 'Mike', type: 'hero', strength: 2 })

/** Partie à 2 Flagelleurs (suffit : on teste seulement le CHOISISSEUR du déplacement). */
function game(): GameState {
  const seat = () => ({
    villain: flagelleurMental,
    deckCards: buildDeckInstances(flagelleurMentalCards, 'villain', 'p:'),
    fateCards: buildDeckInstances(flagelleurMentalCards, 'fate', 'pf:'),
  })
  return createInitialGame([seat(), seat()], 7)
}

describe('Frissons (RELOCATE_HERO_ADJACENT) — qui choisit le Héros à déplacer', () => {
  it('Fatalité : le déplacement est choisi par le LANCEUR (playedBy), pas par la cible', () => {
    const base = game()
    // Le joueur 1 (fataliseur) lance Frissons contre le joueur 0 (cible), dont le Héros
    // est dans le royaume. Contexte identique au chemin générique des Fatalités Événement.
    const s: GameState = {
      ...base,
      activePlayer: 1,
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, board: { ...p.board, [p.locations[0].id]: [hero()] } } : p,
      ),
    }
    const next = resolveEffect(s, { type: 'RELOCATE_HERO_ADJACENT' }, { actorIndex: 0, playedBy: 1 })
    expect(next.pendingHeroRelocate).toBeTruthy()
    expect(next.pendingHeroRelocate?.chooserIndex).toBe(1) // le bot fataliseur choisit
    expect(next.pendingHeroRelocate?.targetIndex).toBe(0) // le Héros déplacé est chez la cible
  })

  it('Action du vilain (sans playedBy) : le chooser reste l’acteur', () => {
    const base = game()
    const s: GameState = {
      ...base,
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, board: { ...p.board, [p.locations[0].id]: [hero()] } } : p,
      ),
    }
    const next = resolveEffect(s, { type: 'RELOCATE_HERO_ADJACENT' }, { actorIndex: 0 })
    expect(next.pendingHeroRelocate?.chooserIndex).toBe(0)
    expect(next.pendingHeroRelocate?.targetIndex).toBe(0)
  })
})

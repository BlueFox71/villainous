import { describe, it, expect } from 'vitest'
import { applyAction, placeFateHeroWithEffects } from '../actions'
import { resolveEffects } from '../effects'
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
  return {
    instanceId: id, cardId, name: cardId, type: 'ally', strength,
    strengthMod: def?.strengthMod, evolvesToCardId: def?.evolvesToCardId,
    reachesAdjacentVanquish: def?.reachesAdjacentVanquish, reachesAnyLocationVanquish: def?.reachesAnyLocationVanquish,
  }
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
    // Le Vaincre de l'Arène est en bas (non recouvert par le Pokémon présent).
    let s = applyAction(trGame(), { type: 'MOVE', to: 'arene' })
    s = withActive(s, {
      board: { ...me(s).board, arene: [pokemon('pk', 'togepi', 1), ally('a1', 'miaouss', 3)] },
    })
    s = applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'pk', allyInstanceIds: ['a1'] })
    const p = me(s)
    const ko = (p.board['arene'] ?? []).find((c) => c.instanceId === 'pk')
    expect(ko?.pokemonKO).toBe(true) // reste sur le plateau, couché
    expect(p.capturedPokemon ?? []).toHaveLength(0) // pas encore attrapé
    expect(p.fateDiscard.map((c) => c.instanceId)).not.toContain('pk')
    expect(p.discard.map((c) => c.instanceId)).toContain('a1') // l'Allié est dépensé
    // L'Allié dépensé QUITTE le plateau (pas de doublon plateau + défausse).
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'a1')).toBe(false)
    expect(p.discard.filter((c) => c.instanceId === 'a1')).toHaveLength(1)
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

  it('un dresseur (2 Pokémon dispo) ouvre le CHOIX du Pokémon invoqué (pendingPokemonSummon)', () => {
    const s0 = trGame()
    const sacha = {
      instanceId: 'sacha1', cardId: 'sacha', name: 'Sacha', type: 'hero' as const,
      strength: 1, summonsPokemonCardIds: ['pikachu', 'dracaufeu'],
    }
    const s = placeFateHeroWithEffects(s0, 0, 0, sacha, 'foret', 'Forêt')
    // Le dresseur est posé, mais le Pokémon n'est pas encore là : un choix s'ouvre.
    expect((s.players[0].board['foret'] ?? []).some((c) => c.instanceId === 'sacha1')).toBe(true)
    expect((s.players[0].board['foret'] ?? []).some((c) => c.isPokemon)).toBe(false)
    expect(s.pendingPokemonSummon).toMatchObject({
      chooserIndex: 0, targetIndex: 0, dresserInstanceId: 'sacha1', locationId: 'foret',
    })
    expect(s.pendingPokemonSummon!.candidateCardIds.sort()).toEqual(['dracaufeu', 'pikachu'])
    // Choix de Pikachu → il est posé sur le même lieu, lié au dresseur, retiré de la pioche.
    const after = applyAction(s, { type: 'RESOLVE_POKEMON_SUMMON', cardId: 'pikachu' })
    const poke = (after.players[0].board['foret'] ?? []).find((c) => c.isPokemon)
    expect(poke?.cardId).toBe('pikachu')
    expect(poke?.summonedByInstanceId).toBe('sacha1')
    expect(after.players[0].fateDeck.some((c) => c.cardId === 'pikachu')).toBe(false)
    expect(after.pendingPokemonSummon).toBeNull()
  })

  it('un dresseur invoque DIRECTEMENT son Pokémon si un seul candidat est disponible', () => {
    let s = trGame()
    // On retire Dracaufeu de la pioche Fatalité : seul Pikachu reste invocable par Sacha.
    s = { ...s, players: s.players.map((p, i) => i === 0 ? { ...p, fateDeck: p.fateDeck.filter((c) => c.cardId !== 'dracaufeu') } : p) }
    const sacha = {
      instanceId: 'sacha1', cardId: 'sacha', name: 'Sacha', type: 'hero' as const,
      strength: 1, summonsPokemonCardIds: ['pikachu', 'dracaufeu'],
    }
    s = placeFateHeroWithEffects(s, 0, 0, sacha, 'foret', 'Forêt')
    expect(s.pendingPokemonSummon ?? null).toBeNull() // pas de choix
    const poke = (s.players[0].board['foret'] ?? []).find((c) => c.isPokemon)
    expect(poke?.cardId).toBe('pikachu')
    expect(poke?.summonedByInstanceId).toBe('sacha1')
  })

  it('lien dresseur↔Pokémon : un Pokémon couché expiré entraîne la défausse de son dresseur', () => {
    let s = withActive(trGame(), {
      board: {
        foret: [
          { instanceId: 'sacha1', cardId: 'sacha', name: 'Sacha', type: 'hero', strength: 1 },
          { instanceId: 'pk', cardId: 'pikachu', name: 'Pikachu', type: 'hero', isPokemon: true, strength: 5, pokemonKO: true, koOnTurn: trGame().turn - 2, summonedByInstanceId: 'sacha1' },
        ],
      },
      pawnLocation: 'labo',
    })
    s = applyAction(s, { type: 'MOVE', to: 'foret' })
    s = applyAction(s, { type: 'END_TURN' })
    const p = me(s)
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'pk')).toBe(false)
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'sacha1')).toBe(false)
    expect(p.fateDiscard.map((c) => c.instanceId)).toEqual(expect.arrayContaining(['pk', 'sacha1']))
  })

  it('la CAPTURE d’un Pokémon ne défausse PAS son dresseur', () => {
    let s = withActive(trGame(), { pawnLocation: 'foret' })
    s = applyAction(s, { type: 'MOVE', to: 'labo' })
    s = withActive(s, {
      board: {
        ...me(s).board,
        foret: [
          { instanceId: 'sacha1', cardId: 'sacha', name: 'Sacha', type: 'hero', strength: 1 },
          { instanceId: 'pk', cardId: 'togepi', name: 'Togepi', type: 'hero', isPokemon: true, strength: 1, pokemonKO: true, koOnTurn: s.turn, summonedByInstanceId: 'sacha1' },
        ],
      },
    })
    s = applyAction(s, { type: 'CATCH_POKEMON', actionId: 'catch', heroInstanceId: 'pk', allyInstanceIds: [] })
    const p = me(s)
    expect((p.capturedPokemon ?? []).map((c) => c.instanceId)).toContain('pk')
    // Le dresseur reste sur le plateau (capture ≠ défausse).
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'sacha1')).toBe(true)
  })

  it('Onix (à la pose) défausse l’Allié OU l’Objet le plus précieux du royaume', () => {
    const onix: CardInstance = {
      instanceId: 'onix1', cardId: 'onix', name: 'Onix', type: 'hero', isPokemon: true,
      strength: 4, onPlace: [{ type: 'DISCARD_ALLY_OR_ITEM' }],
    }
    let s = withActive(trGame(), {
      board: {
        foret: [ally('a1', 'abo', 2)],
        arene: [{ instanceId: 'it1', cardId: 'mongolfiere', name: 'Mongolfière', type: 'item', cost: 3 }],
      },
    })
    s = placeFateHeroWithEffects(s, 0, 0, onix, 'labo', 'Laboratoire')
    const p = me(s)
    // L'Objet (coût 3) est plus « précieux » que l'Allié Abo (force 2) → c'est lui qui saute.
    expect(p.discard.map((c) => c.cardId)).toContain('mongolfiere')
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'a1')).toBe(true)
  })

  it('Dégonflage défausse un Objet (non associé) du royaume', () => {
    let s = withActive(trGame(), {
      board: { foret: [{ instanceId: 'it1', cardId: 'mongolfiere', name: 'Mongolfière', type: 'item', cost: 3 }] },
    })
    s = resolveEffects(s, [{ type: 'DISCARD_ONE_ITEM' }], { actorIndex: 0 })
    expect(me(s).discard.map((c) => c.cardId)).toContain('mongolfiere')
    expect(Object.values(me(s).board).flat().some((c) => c.instanceId === 'it1')).toBe(false)
  })

  it('Évolution : Abo → Arbok sur le même lieu (choix interactif)', () => {
    let s = withActive(trGame(), { board: { foret: [ally('a1', 'abo', 2)] } })
    s = resolveEffects(s, [{ type: 'EVOLVE_ALLY' }], { actorIndex: 0 })
    expect(s.pendingEvolveAlly?.candidateIds).toEqual(['a1'])
    s = applyAction(s, { type: 'RESOLVE_EVOLVE_ALLY', instanceId: 'a1' })
    const p = me(s)
    expect(s.pendingEvolveAlly ?? null).toBeNull()
    expect((p.board['foret'] ?? []).some((c) => c.cardId === 'arbok')).toBe(true)
    expect((p.board['foret'] ?? []).some((c) => c.cardId === 'abo')).toBe(false)
    expect(p.discard.some((c) => c.cardId === 'abo')).toBe(true)
    // Arbok n'est plus dans la pioche/main/défausse (il est posé).
    expect(p.deck.some((c) => c.cardId === 'arbok')).toBe(false)
    expect(p.hand.some((c) => c.cardId === 'arbok')).toBe(false)
  })

  it('Évolution : Smogo → Smogogo GARDE son Objet associé et déclenche l’action distante', () => {
    const pokeball: CardInstance = { instanceId: 'pb1', cardId: 'pokeball', name: 'Pokéball', type: 'item', attach: 'ally', attachedTo: 's1', attachStrengthBonus: 1 }
    let s = withActive(trGame(), { pawnLocation: 'labo', board: { arene: [ally('s1', 'smogo', 2), pokeball] } })
    s = resolveEffects(s, [{ type: 'EVOLVE_ALLY' }], { actorIndex: 0 })
    expect(s.pendingEvolveAlly?.candidateIds).toEqual(['s1'])
    s = applyAction(s, { type: 'RESOLVE_EVOLVE_ALLY', instanceId: 's1' })
    const p = me(s)
    const smogogo = (p.board['arene'] ?? []).find((c) => c.cardId === 'smogogo')
    expect(smogogo).toBeDefined()
    // La Pokéball reste sur le plateau, ré-associée au Smogogo évolué (pas défaussée).
    const pb = (p.board['arene'] ?? []).find((c) => c.cardId === 'pokeball')
    expect(pb?.attachedTo).toBe(smogogo!.instanceId)
    expect(p.discard.some((c) => c.cardId === 'pokeball')).toBe(false)
    // Smogogo posé hors du lieu du pion → fenêtre d'action distante (recouverte ou non).
    expect(s.actAtLocation).toBe('arene')
    expect(s.actAtLocationIgnoreCover).toBe(true)
  })

  it('Évolution : un Allié dont l’évolution est DÉJÀ en jeu n’est pas candidat', () => {
    let s = withActive(trGame(), { board: { foret: [ally('a1', 'abo', 2), ally('a2', 'arbok', 3)] } })
    s = resolveEffects(s, [{ type: 'EVOLVE_ALLY' }], { actorIndex: 0 })
    expect(s.pendingEvolveAlly ?? null).toBeNull() // aucun candidat → pas de choix
  })

  it('Oui, la guerre ! : couche (K.O.) un Pokémon de force ≥3 (épargne ceux <3)', () => {
    let s = withActive(trGame(), {
      board: { foret: [pokemon('p1', 'togepi', 1)], arene: [pokemon('p2', 'stari', 3)] },
    })
    s = resolveEffects(s, [{ type: 'KO_POKEMON_GE', minStrength: 3 }], { actorIndex: 0 })
    const all = Object.values(me(s).board).flat()
    expect(all.find((c) => c.instanceId === 'p2')?.pokemonKO).toBe(true) // ≥3 → couché
    expect(all.find((c) => c.instanceId === 'p1')?.pokemonKO ?? false).toBe(false) // <3 → épargné
  })

  it('Oui, la guerre ! : avec ≥2 Pokémon ≥3, ouvre le CHOIX interactif (clic plateau)', () => {
    let s = withActive(trGame(), {
      board: { foret: [pokemon('p1', 'stari', 3)], arene: [pokemon('p2', 'dracaufeu', 4)] },
    })
    s = resolveEffects(s, [{ type: 'KO_POKEMON_GE', minStrength: 3 }], { actorIndex: 0 })
    // Pas d'auto-couché : un pending de choix s'ouvre avec les deux candidats.
    expect(s.pendingKoPokemon).toMatchObject({ chooserIndex: 0 })
    expect(s.pendingKoPokemon!.candidateIds.sort()).toEqual(['p1', 'p2'])
    expect(Object.values(me(s).board).flat().every((c) => !c.pokemonKO)).toBe(true)
    // Un Pokémon hors candidats est refusé...
    expect(() => applyAction(s, { type: 'RESOLVE_KO_POKEMON', instanceId: 'zzz' })).toThrow()
    // ...le candidat choisi est couché.
    const after = applyAction(s, { type: 'RESOLVE_KO_POKEMON', instanceId: 'p1' })
    expect(Object.values(me(after).board).flat().find((c) => c.instanceId === 'p1')?.pokemonKO).toBe(true)
    expect(Object.values(me(after).board).flat().find((c) => c.instanceId === 'p2')?.pokemonKO ?? false).toBe(false)
    expect(after.pendingKoPokemon).toBeNull()
  })

  it('Pour vous jouer un mauvais tour : déclencheur — Héros Fatalité ≤3 joué contre toi', () => {
    const trGame2 = createInitialGame(
      [
        { villain: teamRocket, deckCards: buildDeckInstances(teamRocketCards, 'villain', 'p0:'), fateCards: buildDeckInstances(teamRocketCards, 'fate', 'p0f:') },
        { villain: teamRocket, deckCards: buildDeckInstances(teamRocketCards, 'villain', 'p1:'), fateCards: buildDeckInstances(teamRocketCards, 'fate', 'p1f:') },
      ],
      7,
    )
    // Joueur 1 (actif) joue un Héros Fatalité (force 1) contre le joueur 0.
    const dresseur: CardInstance = { instanceId: 'd1', cardId: 'sacha', name: 'Sacha', type: 'hero', strength: 1 }
    const s = placeFateHeroWithEffects({ ...trGame2, activePlayer: 1 }, 0, 1, dresseur, 'foret', 'Forêt')
    expect((s.activeFateHeroesAgainst ?? []).some((e) => e.target === 0 && e.strength <= 3)).toBe(true)
  })

  it('James : remet les cartes non-Objet dévoilées sur le DESSUS de la pioche', () => {
    let s = withActive(trGame(), {
      deck: [
        { instanceId: 'e1', cardId: 'jessie-rocket', name: 'Jessie', type: 'effect' },
        { instanceId: 'i1', cardId: 'pokeball', name: 'Pokéball', type: 'item', attach: 'ally' },
        { instanceId: 'e2', cardId: 'reperage', name: 'Repérage', type: 'effect' },
      ],
    })
    s = resolveEffects(s, [{ type: 'REVEAL_VILLAIN_UNTIL_TYPE', cardType: 'item', keepOthersOnTop: true }], { actorIndex: 0 })
    const p = me(s)
    expect(p.hand.some((c) => c.instanceId === 'i1')).toBe(true) // l'Objet va en main
    expect(p.deck[0]?.instanceId).toBe('e1') // l'Événement dévoilé revient sur le dessus
    expect(p.discard.some((c) => c.instanceId === 'e1')).toBe(false) // pas défaussé
  })

  it('Stari (à la pose) ouvre le choix INTERACTIF de déplacement d’un Allié (lieu voisin)', () => {
    const stari: CardInstance = {
      instanceId: 'st', cardId: 'stari', name: 'Stari', type: 'hero', isPokemon: true, strength: 3,
      onPlace: [{ type: 'MOVE_OWN_ALLY_ADJACENT' }],
    }
    let s = withActive(trGame(), { board: { labo: [ally('a1', 'abo', 2)] } })
    s = placeFateHeroWithEffects(s, 0, 0, stari, 'foret', 'Forêt')
    // Pas d'auto-déplacement : un pending facultatif restreint aux lieux voisins s'ouvre.
    expect(s.pendingAllyRelocate).toMatchObject({ targetIndex: 0, optional: true, adjacentOnly: true })
    expect((me(s).board['labo'] ?? []).some((c) => c.instanceId === 'a1')).toBe(true) // pas encore déplacé
    // Un lieu NON voisin (Centre Pokémon) est refusé...
    expect(() => applyAction(s, { type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId: 'a1', to: 'centre-pokemon' })).toThrow()
    // ...un lieu voisin (Laboratoire ← Forêt) est accepté.
    const after = applyAction(s, { type: 'RESOLVE_ALLY_RELOCATE', allyInstanceId: 'a1', to: 'foret' })
    expect((me(after).board['foret'] ?? []).some((c) => c.instanceId === 'a1')).toBe(true)
    expect((me(after).board['labo'] ?? []).some((c) => c.instanceId === 'a1')).toBe(false)
    expect(after.pendingAllyRelocate).toBeNull()
  })

  it('Stari (à la pose) peut PASSER (déplacement facultatif)', () => {
    const stari: CardInstance = {
      instanceId: 'st', cardId: 'stari', name: 'Stari', type: 'hero', isPokemon: true, strength: 3,
      onPlace: [{ type: 'MOVE_OWN_ALLY_ADJACENT' }],
    }
    let s = withActive(trGame(), { board: { labo: [ally('a1', 'abo', 2)] } })
    s = placeFateHeroWithEffects(s, 0, 0, stari, 'foret', 'Forêt')
    const after = applyAction(s, { type: 'SKIP_ALLY_RELOCATE' })
    expect(after.pendingAllyRelocate).toBeNull()
    expect((me(after).board['labo'] ?? []).some((c) => c.instanceId === 'a1')).toBe(true) // resté en place
  })

  it("On n'abandonne pas ses amis : reprend un Pokémon capturé ≤3 sur le dessus de la pioche Fatalité", () => {
    const cap = (id: string, str: number): CardInstance => ({ instanceId: id, cardId: id, name: id, type: 'hero', isPokemon: true, strength: str })
    let s = withActive(trGame(), { capturedPokemon: [cap('dracaufeu', 4), cap('stari', 3)] })
    s = resolveEffects(s, [{ type: 'UNCAPTURE_POKEMON_LE', maxStrength: 3 }], { actorIndex: 0 })
    const p = me(s)
    expect(p.fateDeck[0]?.cardId).toBe('stari') // remis sur le dessus
    expect(p.fateDeck[0]?.noReturnFromCapture).toBe(true) // marqué (une seule fois)
    expect((p.capturedPokemon ?? []).some((c) => c.cardId === 'stari')).toBe(false)
    expect((p.capturedPokemon ?? []).some((c) => c.cardId === 'dracaufeu')).toBe(true) // force 4 > 3 : reste capturé
  })

  it('Repérage ouvre le choix de pose (pendingFetchedHero) ; Toilettage le scry (pendingScry)', () => {
    let s1 = withActive(trGame(), {})
    s1 = resolveEffects(s1, [{ type: 'REVEAL_OWN_FATE_PLAY_HERO' }], { actorIndex: 0 })
    expect(s1.pendingFetchedHero?.playerIndex).toBe(0)
    let s2 = withActive(trGame(), {})
    s2 = resolveEffects(s2, [{ type: 'SCRY_OWN_FATE_TOP2' }], { actorIndex: 0 })
    expect(s2.pendingScry?.playerIndex).toBe(0)
    expect((s2.pendingScry?.cards.length ?? 0)).toBeGreaterThan(0)
  })

  it("Persian : élimine un Héros sur un lieu NON voisin (n'importe quel lieu)", () => {
    let s = applyAction(trGame(), { type: 'MOVE', to: 'arene' })
    s = withActive(s, {
      board: {
        ...me(s).board,
        arene: [{ instanceId: 'h', cardId: 'cible', name: 'Héros', type: 'hero', strength: 4 }],
        labo: [ally('per', 'persian', 4)], // Labo et Arène ne sont PAS voisins
      },
    })
    s = applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'h', allyInstanceIds: ['per'] })
    const p = me(s)
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'h')).toBe(false) // vaincu
    expect(p.discard.some((c) => c.instanceId === 'per')).toBe(true) // Persian dépensé
  })

  it('rose de James : vaincre un Pokémon avec l’Allié porteur déclenche Attraper', () => {
    let s = applyAction(trGame(), { type: 'MOVE', to: 'arene' })
    s = withActive(s, {
      board: {
        ...me(s).board,
        arene: [
          pokemon('pk', 'togepi', 1),
          ally('a1', 'miaouss', 3),
          { instanceId: 'rose', cardId: 'rose-de-james', name: 'rose de James', type: 'item', attach: 'ally', attachedTo: 'a1' },
        ],
      },
    })
    s = applyAction(s, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: 'pk', allyInstanceIds: ['a1'] })
    const p = me(s)
    expect((p.capturedPokemon ?? []).some((c) => c.instanceId === 'pk')).toBe(true) // attrapé direct
    expect(Object.values(p.board).flat().some((c) => c.instanceId === 'pk')).toBe(false)
    expect(p.discard.some((c) => c.cardId === 'rose-de-james')).toBe(true) // rose défaussée avec l'Allié
  })

  it('Pokédex volé : un Pokémon couché (qui aurait expiré) survit un tour de plus', () => {
    // koOnTurn = turn-2 : SANS Pokédex il partirait en défausse ; AVEC, il survit (seuil 3).
    let s = withActive(trGame(), {
      board: {
        foret: [{ instanceId: 'pk', cardId: 'togepi', name: 'Togepi', type: 'hero', isPokemon: true, strength: 1, pokemonKO: true, koOnTurn: trGame().turn - 2 }],
        labo: [{ instanceId: 'dex', cardId: 'pokedex-vole', name: 'Pokédex volé', type: 'item' }],
      },
      pawnLocation: 'centre-pokemon',
    })
    s = applyAction(s, { type: 'MOVE', to: 'arene' })
    s = applyAction(s, { type: 'END_TURN' })
    expect(Object.values(me(s).board).flat().some((c) => c.instanceId === 'pk')).toBe(true) // sursis
  })

  it('Smogo : joué hors du lieu du pion ouvre une fenêtre d’action distante (hors Fatalité)', () => {
    let s = applyAction(trGame(), { type: 'MOVE', to: 'centre-pokemon' })
    const smogo: CardInstance = { instanceId: 'sm', cardId: 'smogo', name: 'Smogo', type: 'ally', cost: 1, strength: 2, effects: [{ type: 'ALLY_REMOTE_ACTION' }] }
    s = withActive(s, { hand: [smogo], power: 5 })
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'sm', to: 'foret' })
    expect(s.actAtLocation).toBe('foret')
    expect(s.actAtLocationSkippable).toBe(true)
    expect(s.actAtLocationIgnoreCover ?? false).toBe(false) // Smogo ne touche pas aux actions recouvertes
  })

  it('Smogogo : fenêtre distante incluant les actions RECOUVERTES', () => {
    let s = applyAction(trGame(), { type: 'MOVE', to: 'centre-pokemon' })
    const smogogo: CardInstance = { instanceId: 'sg', cardId: 'smogogo', name: 'Smogogo', type: 'ally', cost: 2, strength: 3, effects: [{ type: 'ALLY_REMOTE_ACTION', includeCovered: true }] }
    s = withActive(s, { hand: [smogogo], power: 5 })
    s = applyAction(s, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'sg', to: 'foret' })
    expect(s.actAtLocation).toBe('foret')
    expect(s.actAtLocationIgnoreCover).toBe(true)
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

import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { teamRocketCards } from '../villains/team-rocket.cards'
import { buildDeck } from '../types'

describe('cartes de Team Rocket — intégrité du paquet', () => {
  it('le deck Méchant totalise 30 cartes', () => {
    expect(buildDeck(teamRocketCards, 'villain')).toHaveLength(30)
  })

  it('le deck Fatalité totalise 15 cartes', () => {
    expect(buildDeck(teamRocketCards, 'fate')).toHaveLength(15)
  })

  it('les 3 dresseurs (Sacha/Ondine/Pierre) sont des Héros Fatalité', () => {
    for (const id of ['sacha', 'ondine', 'pierre']) {
      const c = teamRocketCards.find((x) => x.id === id)
      expect(c?.deck).toBe('fate')
      expect(c?.type).toBe('hero')
      expect(c?.isPokemon).toBeFalsy()
    }
  })

  it('les 6 Pokémon sont des Héros Fatalité marqués isPokemon', () => {
    const pokemon = teamRocketCards.filter((c) => c.isPokemon)
    expect(pokemon.map((c) => c.id).sort()).toEqual(
      ['dracaufeu', 'goupix', 'onix', 'pikachu', 'stari', 'togepi'],
    )
    for (const c of pokemon) {
      expect(c.deck).toBe('fate')
      expect(c.type).toBe('hero')
      expect(typeof c.strength).toBe('number')
    }
  })

  it('Pikachu (cible obligatoire de l’objectif) est un Pokémon de force 5', () => {
    const pika = teamRocketCards.find((c) => c.id === 'pikachu')
    expect(pika?.isPokemon).toBe(true)
    expect(pika?.strength).toBe(5)
  })

  it('les Alliés évolutifs sont présents (1 exemplaire chacun)', () => {
    for (const id of ['abo', 'arbok', 'smogo', 'smogogo', 'miaouss', 'persian']) {
      const c = teamRocketCards.find((x) => x.id === id)
      expect(c?.type).toBe('ally')
      expect(c?.copies).toBe(1)
    }
  })

  it('chaque carte a les champs requis et cohérents', () => {
    const ids = new Set<string>()
    for (const c of teamRocketCards) {
      expect(c.id).toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.name.length).toBeGreaterThan(0)
      expect(c.englishName.length).toBeGreaterThan(0)
      expect(c.text.length).toBeGreaterThan(0)
      expect(c.copies).toBeGreaterThanOrEqual(1)
      expect(c.image).toMatch(/^\/cards\/team-rocket\/.+\.(png|webp)$/)
      if (c.deck === 'villain') expect(typeof c.cost).toBe('number')
      else expect(c.cost).toBeUndefined()
      if (c.type === 'hero') expect(typeof c.strength).toBe('number')
      if (c.attach) expect(c.type).toBe('item')
      if (c.isPokemon) expect(c.type).toBe('hero')
    }
  })

  it('chaque illustration référencée existe dans public/', () => {
    for (const c of teamRocketCards) {
      expect(existsSync('public' + c.image), `image manquante : ${c.image}`).toBe(true)
    }
  })
})

import { describe, it, expect } from 'vitest'
import {
  createVariant,
  syncVariantFromBase,
  variantCardId,
  variantSyncState,
  findVariantBase,
  variantsOf,
  toCardDefs,
  type CustomVillain,
  type CustomCard,
} from '../customVillain'

// Base minimale mais RÉALISTE : 2 lieux (avec actions = structure), 2 cartes Vilain
// (mécaniques : coût / force / effets). On teste que la variante hérite des mécaniques
// et ne diffère que par la présentation.
function baseVillain(): CustomVillain {
  return {
    formatVersion: 1,
    id: 'custom-base',
    name: 'Kilaire',
    devise: 'La lumière triomphe',
    stars: 4,
    color: '#f5c518',
    pawnHeightPx: 56,
    portrait: 'data:base-portrait',
    presentation: 'data:base-presentation',
    boardArt: 'data:base-boardart',
    pawnImage: 'data:base-pawn',
    audio: 'data:base-audio',
    backVillainImage: 'data:base-back-villain',
    boardObjective: 'Atteignez 15 esprits',
    objectiveDescription: 'Marquez 15 esprits pour gagner.',
    objective: { type: 'POWER_THRESHOLD', threshold: 15 },
    locations: [
      {
        id: 'loc-1',
        name: 'LIEU A',
        image: 'data:base-loc1',
        actions: [{ id: 'g1', type: 'GAIN_POWER', amount: 1, row: 'top', label: 'Gagner 1' }],
      },
      {
        id: 'loc-2',
        name: 'LIEU B',
        image: 'data:base-loc2',
        actions: [{ id: 'p2', type: 'PLAY_CARD', row: 'top', label: 'Jouer' }],
      },
    ],
    cards: [
      {
        id: 'renfort',
        name: 'Renfort',
        englishName: 'Reinforcement',
        deck: 'villain',
        type: 'ally',
        cost: 2,
        strength: 2,
        copies: 3,
        text: 'Un allié fidèle.',
        image: 'data:base-card-renfort',
        effects: [{ kind: 'GAIN_POWER', amount: 1 }] as unknown as CustomCard['effects'],
      },
      {
        id: 'decharge',
        name: 'Décharge',
        englishName: 'Discharge',
        deck: 'villain',
        type: 'effect',
        cost: 1,
        copies: 2,
        text: 'Gagnez du pouvoir.',
        image: 'data:base-card-decharge',
      },
    ],
    createdAt: '2026-07-15T10:00:00Z',
    updatedAt: '2026-07-15T10:00:00Z',
  }
}

describe('createVariant — variante liée vierge', () => {
  it('clone les cartes de la base avec un id de variante + baseCardId, toutes « liées »', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')

    expect(v.variantOf).toBe('custom-base')
    expect(v.variantBaseStamp).toBe(base.updatedAt)
    expect(v.published).toBe(false)
    expect(v.cards).toHaveLength(2)
    for (const c of v.cards) {
      expect(c.baseCardId).toBeDefined()
      expect(c.id).toBe(variantCardId('custom-sombra', c.baseCardId!))
      expect(c.variantOverride).toBeUndefined()
    }
  })

  it('hérite des mécaniques ET de la présentation de la base au départ', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')
    const renfort = v.cards.find((c) => c.baseCardId === 'renfort')!
    expect(renfort.cost).toBe(2)
    expect(renfort.strength).toBe(2)
    expect(renfort.name).toBe('Renfort') // présentation héritée tant qu'on n'a rien changé
    expect(v.objective).toEqual(base.objective)
  })
})

describe('syncVariantFromBase — propagation depuis la base', () => {
  it('propage une correction de MÉCANIQUE sur une carte liée', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')

    // On corrige la base : coût de Renfort 2 → 3, et son texte.
    const base2 = structuredClone(base)
    base2.cards[0].cost = 3
    base2.cards[0].text = 'Un allié RENFORCÉ.'
    base2.updatedAt = '2026-07-16T10:00:00Z'

    const synced = syncVariantFromBase(base2, v)
    const renfort = synced.cards.find((c) => c.baseCardId === 'renfort')!
    expect(renfort.cost).toBe(3) // mécanique propagée
    expect(renfort.text).toBe('Un allié RENFORCÉ.') // présentation d'une carte LIÉE suit aussi la base
    expect(synced.variantBaseStamp).toBe('2026-07-16T10:00:00Z')
  })

  it('CONSERVE la présentation d’une carte « override » mais propage ses mécaniques', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')

    // La variante re-texte/re-nomme Renfort (visuel/texte only) → override.
    const renfortV = v.cards.find((c) => c.baseCardId === 'renfort')!
    renfortV.variantOverride = true
    renfortV.name = 'Renfort des Ténèbres'
    renfortV.text = 'Un serviteur obscur.'
    renfortV.image = 'data:variant-card-renfort'

    // Base change coût + texte.
    const base2 = structuredClone(base)
    base2.cards[0].cost = 3
    base2.cards[0].text = 'Un allié RENFORCÉ.'

    const synced = syncVariantFromBase(base2, v)
    const renfort = synced.cards.find((c) => c.baseCardId === 'renfort')!
    expect(renfort.cost).toBe(3) // mécanique TOUJOURS propagée
    expect(renfort.name).toBe('Renfort des Ténèbres') // présentation override conservée
    expect(renfort.text).toBe('Un serviteur obscur.')
    expect(renfort.image).toBe('data:variant-card-renfort')
    expect(renfort.variantOverride).toBe(true)
  })

  it('suit l’AJOUT et le RETRAIT de cartes dans la base', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')

    const base2 = structuredClone(base)
    base2.cards.pop() // retire « decharge »
    base2.cards.push({
      id: 'ferveur',
      name: 'Ferveur',
      englishName: 'Fervor',
      deck: 'villain',
      type: 'effect',
      cost: 3,
      copies: 1,
      text: 'Marquez des esprits.',
      image: 'data:base-card-ferveur',
    })

    const synced = syncVariantFromBase(base2, v)
    const baseIds = synced.cards.map((c) => c.baseCardId).sort()
    expect(baseIds).toEqual(['ferveur', 'renfort'])
  })

  it('applique les surcharges VILAIN (couleur, nom, devise…) et hérite du reste', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')
    v.name = 'Sombra'
    v.color = '#3a1f5c'
    v.devise = 'Les ténèbres engloutissent tout'
    v.portrait = 'data:variant-portrait'
    v.pawnImage = 'data:variant-pawn'

    const synced = syncVariantFromBase(base, v)
    expect(synced.name).toBe('Sombra')
    expect(synced.color).toBe('#3a1f5c')
    expect(synced.devise).toBe('Les ténèbres engloutissent tout')
    expect(synced.portrait).toBe('data:variant-portrait')
    expect(synced.pawnImage).toBe('data:variant-pawn')
    expect(synced.objective).toEqual(base.objective) // règles héritées
  })

  it('CONSERVE les ornements de dos propres à la variante quand la base change les siens', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')
    // La variante définit ses propres ornements de dos (Killaire).
    v.backOverlays = [{ id: 'o1', image: 'data:variant-ornement', x: 50, y: 50, size: 40, aspect: 1 }]

    // La base change ses ornements de son côté.
    const base2 = structuredClone(base)
    base2.backOverlays = [{ id: 'b1', image: 'data:base-ornement', x: 10, y: 10, size: 20, aspect: 1 }]

    const synced = syncVariantFromBase(base2, v)
    expect(synced.backOverlays).toEqual(v.backOverlays) // ornements de la VARIANTE conservés
  })

  it('applique nom + image de lieu de la variante, garde la STRUCTURE (actions) de la base', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')
    v.locations[0].name = 'CONTRÉE DE L’OMBRE'
    v.locations[0].image = 'data:variant-loc1'

    // La base change une ACTION (structure).
    const base2 = structuredClone(base)
    base2.locations[0].actions.push({ id: 'v1', type: 'VANQUISH', row: 'bottom', label: 'Éliminer' })

    const synced = syncVariantFromBase(base2, v)
    expect(synced.locations[0].name).toBe('CONTRÉE DE L’OMBRE') // nom variante
    expect(synced.locations[0].image).toBe('data:variant-loc1') // image variante
    expect(synced.locations[0].actions).toHaveLength(2) // structure propagée depuis la base
    expect(synced.locations[1].name).toBe('LIEU B') // lieu non surchargé → base
  })

  it('FACE B : conserve nom/image propres à la variante, hérite des actions de la base', () => {
    const base = baseVillain()
    // La base rend le lieu 1 transformable (face B avec sa propre action).
    base.locations[0].alt = {
      name: 'LIEU A (RÉVÉLÉ)',
      image: 'data:base-loc1-b',
      actions: [{ id: 'gb', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2' }],
    }
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')

    // La variante skinne la face B (nom + image), sans toucher aux actions.
    v.locations[0].alt = {
      ...v.locations[0].alt,
      name: 'OMBRE (RÉVÉLÉE)',
      image: 'data:variant-loc1-b',
      imagePos: { x: 25, y: 75, zoom: 1.2 },
    }

    // La base modifie l'action de la face B (structure).
    const base2 = structuredClone(base)
    base2.locations[0].alt!.actions!.push({ id: 'vb', type: 'VANQUISH', row: 'bottom', label: 'Éliminer' })

    const synced = syncVariantFromBase(base2, v)
    const alt = synced.locations[0].alt!
    expect(alt.name).toBe('OMBRE (RÉVÉLÉE)') // nom face B de la variante
    expect(alt.image).toBe('data:variant-loc1-b') // image face B de la variante
    expect(alt.imagePos).toEqual({ x: 25, y: 75, zoom: 1.2 }) // cadrage de la variante
    expect(alt.actions).toHaveLength(2) // actions face B propagées depuis la base
  })

  it('FACE B : une variante qui ne skinne pas la face B hérite de celle de la base', () => {
    const base = baseVillain()
    base.locations[0].alt = {
      name: 'LIEU A (RÉVÉLÉ)',
      image: 'data:base-loc1-b',
      actions: [{ id: 'gb', type: 'GAIN_POWER', amount: 2, row: 'top', label: 'Gagner 2' }],
    }
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')

    const synced = syncVariantFromBase(base, v)
    const alt = synced.locations[0].alt!
    expect(alt.name).toBe('LIEU A (RÉVÉLÉ)') // hérité de la base
    expect(alt.image).toBe('data:base-loc1-b') // hérité de la base
  })
})

describe('syncVariantFromBase — consignes / Journal re-clés', () => {
  /** Base avec un Journal par carte + une variante qui a réécrit celui d'une carte re-baptisée. */
  function withNotes() {
    const base = baseVillain()
    base.botStrategy = {
      howToWin: 'Marque des esprits.',
      journal: {
        villainNotes: {
          renfort: 'Renfort : {nomAllié} rejoint la lutte.',
          decharge: 'Décharge : gagne {NbJT} Pouvoir.',
        },
      },
    }
    const variant = createVariant(base, 'custom-skin', 'Sumbra', '2026-07-16T10:00:00Z')
    // La variante a re-baptisé « Renfort » → son message de Journal cite CE nom.
    variant.botStrategy = {
      journal: {
        villainNotes: {
          [variantCardId('custom-skin', 'renfort')]: 'Tentacule : {nomAllié} rejoint la lutte.',
          // Note MORTE (clée sur l'id de base) : abandonnée au profit de la note re-clée.
          renfort: 'ancienne note morte',
        },
      },
    }
    return { base, variant }
  }

  it('déplace les notes de la base sur les ids de cartes de la VARIANTE', () => {
    const { base, variant } = withNotes()
    const notes = syncVariantFromBase(base, variant).botStrategy?.journal?.villainNotes ?? {}
    const ids = new Set(syncVariantFromBase(base, variant).cards.map((c) => c.id))
    expect(Object.keys(notes).every((id) => ids.has(id))).toBe(true) // aucune note morte
    expect(notes[variantCardId('custom-skin', 'decharge')]).toBe('Décharge : gagne {NbJT} Pouvoir.')
  })

  it('CONSERVE la note propre à la variante (nom de carte re-baptisée)', () => {
    const { base, variant } = withNotes()
    const notes = syncVariantFromBase(base, variant).botStrategy?.journal?.villainNotes ?? {}
    expect(notes[variantCardId('custom-skin', 'renfort')]).toBe('Tentacule : {nomAllié} rejoint la lutte.')
  })

  it('hérite du texte général de la base', () => {
    const { base, variant } = withNotes()
    expect(syncVariantFromBase(base, variant).botStrategy?.howToWin).toBe('Marque des esprits.')
  })
})

describe('variantSyncState — détection d’état au chargement', () => {
  it('un vilain sans variantOf est « independent »', () => {
    const base = baseVillain()
    expect(variantSyncState(base, undefined)).toBe('independent')
  })

  it('une variante dont la base est absente est « orphan »', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')
    expect(variantSyncState(v, undefined)).toBe('orphan')
  })

  it('une variante à jour est « synced », « stale » si la base a évolué depuis', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')
    expect(variantSyncState(v, base)).toBe('synced')

    const base2 = { ...base, updatedAt: '2026-07-20T00:00:00Z' }
    expect(variantSyncState(v, base2)).toBe('stale')
  })

  it('resynchroniser une variante « stale » la remet « synced »', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')
    const base2 = { ...structuredClone(base), updatedAt: '2026-07-20T00:00:00Z' }
    const resynced = syncVariantFromBase(base2, v)
    expect(variantSyncState(resynced, base2)).toBe('synced')
  })
})

describe('findVariantBase / variantsOf — relations dans une liste', () => {
  it('retrouve la base et liste les variantes', () => {
    const base = baseVillain()
    const v1 = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')
    const v2 = createVariant(base, 'custom-autre', 'Autre', '2026-07-15T12:00:00Z')
    const all = [base, v1, v2]
    expect(findVariantBase(v1, all)).toBe(base)
    expect(findVariantBase(base, all)).toBeUndefined()
    expect(variantsOf('custom-base', all).map((x) => x.id).sort()).toEqual(['custom-autre', 'custom-sombra'])
  })
})

describe('toCardDefs — nettoyage des champs de variante', () => {
  it('retire baseCardId et variantOverride (champs éditeur, hors moteur)', () => {
    const base = baseVillain()
    const v = createVariant(base, 'custom-sombra', 'Sombra', '2026-07-15T12:00:00Z')
    v.cards[0].variantOverride = true
    const defs = toCardDefs(v)
    for (const d of defs) {
      expect('baseCardId' in d).toBe(false)
      expect('variantOverride' in d).toBe(false)
    }
    // L'id de variante, lui, est conservé (c'est le cardId de jeu).
    expect(defs[0].id).toBe(variantCardId('custom-sombra', 'renfort'))
  })
})

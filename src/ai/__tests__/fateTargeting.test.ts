import { describe, it, expect } from 'vitest'
import { villainFateTargetingBonus } from '../villainStrategy'
import { singleGame } from '../../engine/__tests__/_helpers'
import { createInitialGame } from '../../engine/state'
import { maleficent } from '../../data/villains/maleficent'
import { maleficentCards } from '../../data/villains/maleficent.cards'
import { jafar } from '../../data/villains/jafar'
import { jafarCards } from '../../data/villains/jafar.cards'
import { crochet } from '../../data/villains/crochet'
import { crochetCards } from '../../data/villains/crochet.cards'
import { reineCoeur } from '../../data/villains/reineCoeur'
import { reineCoeurCards } from '../../data/villains/reineCoeur.cards'
import { hades } from '../../data/villains/hades'
import { hadesCards } from '../../data/villains/hades.cards'
import { ratigan } from '../../data/villains/ratigan'
import { ratiganCards } from '../../data/villains/ratigan.cards'
import { ursula } from '../../data/villains/ursula'
import { ursulaCards } from '../../data/villains/ursula.cards'
import { scar } from '../../data/villains/scar'
import { scarCards } from '../../data/villains/scar.cards'
import { cruella } from '../../data/villains/cruella'
import { cruellaCards } from '../../data/villains/cruella.cards'
import { gothel } from '../../data/villains/gothel'
import { gothelCards } from '../../data/villains/gothel.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, PlayerState } from '../../engine/types'

// Fabrique une carte minimale (champs lus par villainFateTargetingBonus uniquement).
const card = (p: Partial<CardInstance> & Pick<CardInstance, 'cardId' | 'type'>): CardInstance =>
  ({ instanceId: p.cardId + ':1', ...p }) as CardInstance

/** PlayerState Prince Jean avec une seule case `here` portant `cards`. */
function pjWith(cards: CardInstance[]): PlayerState {
  const p = singleGame().players[0]
  const here = p.locations[0].id
  return { ...p, board: { ...p.board, [here]: cards } }
}

/** PlayerState Maléfique avec un plateau `board` injecté (par lieu). */
function malWith(board: Record<string, CardInstance[]>): PlayerState {
  const g = createInitialGame(
    [
      {
        villain: maleficent,
        deckCards: buildDeckInstances(maleficentCards, 'villain', 'm:'),
        fateCards: buildDeckInstances(maleficentCards, 'fate', 'mf:'),
      },
    ],
    1,
  )
  const p = g.players[0]
  return { ...p, board: { ...p.board, ...board } }
}

/** PlayerState Jafar avec un plateau `board` injecté (par lieu). */
function jafarWith(board: Record<string, CardInstance[]>): PlayerState {
  const g = createInitialGame(
    [
      {
        villain: jafar,
        deckCards: buildDeckInstances(jafarCards, 'villain', 'j:'),
        fateCards: buildDeckInstances(jafarCards, 'fate', 'jf:'),
      },
    ],
    1,
  )
  const p = g.players[0]
  return { ...p, board: { ...p.board, ...board } }
}

/** PlayerState Reine de Cœur avec un plateau `board` injecté (par lieu). */
function reineWith(board: Record<string, CardInstance[]>): PlayerState {
  const g = createInitialGame(
    [
      {
        villain: reineCoeur,
        deckCards: buildDeckInstances(reineCoeurCards, 'villain', 'r:'),
        fateCards: buildDeckInstances(reineCoeurCards, 'fate', 'rf:'),
      },
    ],
    1,
  )
  const p = g.players[0]
  return { ...p, board: { ...p.board, ...board } }
}

/** PlayerState Hadès avec un plateau `board` injecté (par lieu).
 *  Lieux : enfers, thebes, jardins, mont-olympe. */
function hadesWith(board: Record<string, CardInstance[]>): PlayerState {
  const g = createInitialGame(
    [
      {
        villain: hades,
        deckCards: buildDeckInstances(hadesCards, 'villain', 'h:'),
        fateCards: buildDeckInstances(hadesCards, 'fate', 'hf:'),
      },
    ],
    1,
  )
  const p = g.players[0]
  return { ...p, board: { ...p.board, ...board } }
}

/** PlayerState Crochet avec un plateau `board` injecté (par lieu).
 *  Lieux : jolly-roger (objectif), rocher-crane, lagune-sirenes, arbre-pendu (le plus loin). */
function crochetWith(board: Record<string, CardInstance[]>): PlayerState {
  const g = createInitialGame(
    [
      {
        villain: crochet,
        deckCards: buildDeckInstances(crochetCards, 'villain', 'c:'),
        fateCards: buildDeckInstances(crochetCards, 'fate', 'cf:'),
      },
    ],
    1,
  )
  const p = g.players[0]
  return { ...p, board: { ...p.board, ...board } }
}

describe('villainFateTargetingBonus — ciblage Fatalité du Prince Jean', () => {
  it('récompense le Déguisement posé sur un ennemi mortel (Roi Richard / Robin)', () => {
    const richard = card({ cardId: 'roi-richard', type: 'hero', strength: 5 })
    const deg = card({ cardId: 'deguisement', type: 'item', attachedTo: richard.instanceId })
    expect(villainFateTargetingBonus(pjWith([richard, deg]))).toBe(4)
  })

  it('ne récompense pas le Déguisement posé sur un Héros quelconque', () => {
    const bobby = card({ cardId: 'bobby', type: 'hero', strength: 2 })
    const deg = card({ cardId: 'deguisement', type: 'item', attachedTo: bobby.instanceId })
    expect(villainFateTargetingBonus(pjWith([bobby, deg]))).toBe(0)
  })

  it('récompense le Pouvoir volé déposé sur une Voleuse dure à éliminer (Dame Gertrude)', () => {
    const gertrude = card({ cardId: 'dame-gertrude', type: 'hero', strength: 6, lockedPower: 4 })
    expect(villainFateTargetingBonus(pjWith([gertrude]))).toBe(4)
  })

  it('ne récompense pas le Pouvoir volé sur un porteur non recommandé', () => {
    const adam = card({ cardId: 'adam-halle', type: 'hero', strength: 2, lockedPower: 4 })
    expect(villainFateTargetingBonus(pjWith([adam]))).toBe(0)
  })

  it('récompense aussi le Déguisement qui protège un porteur de Pouvoir volé', () => {
    // Bobby n'est pas prioritaire, mais porte du Pouvoir volé : le protéger empêche
    // le Prince Jean de le reprendre → bonus.
    const bobby = card({ cardId: 'bobby', type: 'hero', strength: 2, lockedPower: 4 })
    const deg = card({ cardId: 'deguisement', type: 'item', attachedTo: bobby.instanceId })
    expect(villainFateTargetingBonus(pjWith([bobby, deg]))).toBe(4)
  })

  it('cumule les bonus (Pouvoir volé sur une Voleuse + Déguisement dessus)', () => {
    const gertrude = card({ cardId: 'dame-gertrude', type: 'hero', strength: 6, lockedPower: 4 })
    const deg = card({ cardId: 'deguisement', type: 'item', attachedTo: gertrude.instanceId })
    expect(villainFateTargetingBonus(pjWith([gertrude, deg]))).toBe(8)
  })
})

describe('villainFateTargetingBonus — ciblage Fatalité de Maléfique', () => {
  it('récompense Pimprenelle posée sur un lieu NON maudit (verrouille une case)', () => {
    const pimprenelle = card({ cardId: 'pimprenelle', type: 'hero', strength: 4 })
    expect(villainFateTargetingBonus(malWith({ forest: [pimprenelle] }))).toBe(4)
  })

  it('ne récompense pas Pimprenelle sur un lieu déjà maudit (case perdue de toute façon)', () => {
    const pimprenelle = card({ cardId: 'pimprenelle', type: 'hero', strength: 4 })
    const sommeil = card({ cardId: 'sommeil-sans-reves', type: 'curse' })
    expect(villainFateTargetingBonus(malWith({ forest: [pimprenelle, sommeil] }))).toBe(0)
  })

  it('ne récompense pas un autre Héros sur un lieu non maudit', () => {
    const philippe = card({ cardId: 'prince-philippe', type: 'hero', strength: 5 })
    expect(villainFateTargetingBonus(malWith({ forest: [philippe] }))).toBe(0)
  })
})

describe('villainFateTargetingBonus — ciblage Fatalité de Jafar', () => {
  it('récompense le Vœu associé au Génie non hypnotisé (renchérit l’Hypnose)', () => {
    const genie = card({ cardId: 'genie', type: 'hero', strength: 6 })
    const voeu = card({ cardId: 'voeu', type: 'item', attachedTo: genie.instanceId })
    expect(villainFateTargetingBonus(jafarWith({ caverne: [genie, voeu] }))).toBe(4)
  })

  it('ne récompense plus le Vœu une fois le Génie hypnotisé', () => {
    const genie = card({ cardId: 'genie', type: 'hero', strength: 6, hypnotized: true })
    const voeu = card({ cardId: 'voeu', type: 'item', attachedTo: genie.instanceId })
    expect(villainFateTargetingBonus(jafarWith({ caverne: [genie, voeu] }))).toBe(0)
  })

  it('ne récompense pas le Vœu sur un autre Héros que le Génie', () => {
    const rajah = card({ cardId: 'rajah', type: 'hero', strength: 4 })
    const voeu = card({ cardId: 'voeu', type: 'item', attachedTo: rajah.instanceId })
    expect(villainFateTargetingBonus(jafarWith({ rues: [rajah, voeu] }))).toBe(0)
  })
})

describe('villainFateTargetingBonus — ciblage Fatalité de Crochet', () => {
  it('récompense la Poussière de Fée sur un Héros bénéficiaire (au lieu-objectif, sans bonus de distance)', () => {
    const jean = card({ cardId: 'jean', type: 'hero', strength: 2 })
    const dust = card({ cardId: 'poussiere-fee', type: 'item', attachedTo: jean.instanceId })
    expect(villainFateTargetingBonus(crochetWith({ 'jolly-roger': [jean, dust] }))).toBe(4)
  })

  it('ne récompense pas la Poussière de Fée sur Clochette ou les Enfants Perdus', () => {
    const clochette = card({ cardId: 'clochette', type: 'hero', strength: 2 })
    const dust = card({ cardId: 'poussiere-fee', type: 'item', attachedTo: clochette.instanceId })
    expect(villainFateTargetingBonus(crochetWith({ 'jolly-roger': [clochette, dust] }))).toBe(0)
  })

  it('récompense un Héros posé loin du Jolly Roger, pas sur le Jolly Roger', () => {
    const michelFar = card({ cardId: 'michel', type: 'hero', strength: 1 })
    expect(villainFateTargetingBonus(crochetWith({ 'arbre-pendu': [michelFar] }))).toBe(4) // distance max
    const michelHere = card({ cardId: 'michel', type: 'hero', strength: 1 })
    expect(villainFateTargetingBonus(crochetWith({ 'jolly-roger': [michelHere] }))).toBe(0)
  })

  it('Tic Tac, lui, est mieux placé PRÈS du Jolly Roger', () => {
    const ttHere = card({ cardId: 'tic-tac', type: 'hero', strength: 5 })
    expect(villainFateTargetingBonus(crochetWith({ 'jolly-roger': [ttHere] }))).toBe(4) // près = bonus plein
    const ttFar = card({ cardId: 'tic-tac', type: 'hero', strength: 5 })
    expect(villainFateTargetingBonus(crochetWith({ 'arbre-pendu': [ttFar] }))).toBe(0) // loin = rien
  })

  it('pénalise la présence de l’Ingénieux Mécanisme (à viser avec Migraine Atroce)', () => {
    const device = card({ cardId: 'ingenieux-mecanisme', type: 'item' })
    expect(villainFateTargetingBonus(crochetWith({ 'jolly-roger': [device] }))).toBe(-4)
  })
})

describe('villainFateTargetingBonus — ciblage Fatalité de la Reine de Cœur', () => {
  it('récompense Dodo posé sur un lieu SANS arceau (verrouille la case)', () => {
    const dodo = card({ cardId: 'dodo', type: 'hero', strength: 3 })
    expect(villainFateTargetingBonus(reineWith({ labyrinthe: [dodo] }))).toBe(4)
  })

  it('ne récompense pas Dodo sur un lieu qui a déjà un arceau (case acquise)', () => {
    const dodo = card({ cardId: 'dodo', type: 'hero', strength: 3 })
    const arceau = card({ cardId: 'gardes-coeur', type: 'ally', strength: 3, isWicket: true })
    expect(villainFateTargetingBonus(reineWith({ labyrinthe: [dodo, arceau] }))).toBe(0)
  })

  it('ne récompense pas un autre Héros (Alice) via cette règle de placement', () => {
    const alice = card({ cardId: 'alice', type: 'hero', strength: 5 })
    expect(villainFateTargetingBonus(reineWith({ labyrinthe: [alice] }))).toBe(0)
  })
})

describe('villainFateTargetingBonus — ciblage Fatalité d’Hadès', () => {
  it('récompense Zeus posé au Mont Olympe (entrave les Titans qui arrivent)', () => {
    const zeus = card({ cardId: 'zeus', type: 'hero', strength: 5 })
    expect(villainFateTargetingBonus(hadesWith({ 'mont-olympe': [zeus] }))).toBe(4)
  })

  it('ne récompense pas Zeus posé ailleurs qu’au Mont Olympe', () => {
    const zeus = card({ cardId: 'zeus', type: 'hero', strength: 5 })
    expect(villainFateTargetingBonus(hadesWith({ thebes: [zeus] }))).toBe(0)
  })

  it('récompense Hercule posé aux Enfers (y bloque les Titans)', () => {
    const hercule = card({ cardId: 'hercule', type: 'hero', strength: 5 })
    expect(villainFateTargetingBonus(hadesWith({ enfers: [hercule] }))).toBe(4)
  })

  it('pénalise la présence du Char (à défausser via Du gospel pur !)', () => {
    const char = card({ cardId: 'char', type: 'item' })
    expect(villainFateTargetingBonus(hadesWith({ enfers: [char] }))).toBe(-4)
  })
})

describe('villainFateTargetingBonus — Ratigan & Ursula', () => {
  function oneVillainPlayer(v: typeof reineCoeur, cards: typeof reineCoeurCards, board: Record<string, CardInstance[]>): PlayerState {
    const g = createInitialGame(
      [{ villain: v, deckCards: buildDeckInstances(cards, 'villain', 'x:'), fateCards: buildDeckInstances(cards, 'fate', 'xf:') }],
      1,
    )
    return { ...g.players[0], board: { ...g.players[0].board, ...board } }
  }

  it('Ratigan : récompense la Reine Moustoria posée à Buckingham Palace', () => {
    const moustoria = card({ cardId: 'reine-moustoria', type: 'hero', strength: 5 })
    expect(villainFateTargetingBonus(oneVillainPlayer(ratigan, ratiganCards, { 'buckingham-palace': [moustoria] }))).toBe(4)
    expect(villainFateTargetingBonus(oneVillainPlayer(ratigan, ratiganCards, { 'big-ben': [moustoria] }))).toBe(0)
  })

  it('Ursula : récompense Bigette associée au Roi Triton, pas à un autre Héros', () => {
    const triton = card({ cardId: 'roi-triton', type: 'hero', strength: 6 })
    const bigette = card({ cardId: 'bigette', type: 'item', attachedTo: triton.instanceId })
    expect(villainFateTargetingBonus(oneVillainPlayer(ursula, ursulaCards, { repaire: [triton, bigette] }))).toBe(4)
    const eric = card({ cardId: 'prince-eric', type: 'hero', strength: 4 })
    const bigette2 = card({ cardId: 'bigette', type: 'item', attachedTo: eric.instanceId })
    expect(villainFateTargetingBonus(oneVillainPlayer(ursula, ursulaCards, { repaire: [eric, bigette2] }))).toBe(0)
  })

  it('Scar : récompense le Bâton de Rafiki sur Mufasa ou Simba, pas ailleurs', () => {
    const mufasa = card({ cardId: 'mufasa', type: 'hero', strength: 6 })
    const baton = card({ cardId: 'baton-rafiki', type: 'item', attachedTo: mufasa.instanceId })
    expect(villainFateTargetingBonus(oneVillainPlayer(scar, scarCards, { savane: [mufasa, baton] }))).toBe(4)
    const nala = card({ cardId: 'nala', type: 'hero', strength: 3 })
    const baton2 = card({ cardId: 'baton-rafiki', type: 'item', attachedTo: nala.instanceId })
    expect(villainFateTargetingBonus(oneVillainPlayer(scar, scarCards, { savane: [nala, baton2] }))).toBe(0)
  })

  it('Cruella : récompense Pongo posé sur un lieu PORTANT des Tuiles Chiots', () => {
    const pongo = card({ cardId: 'pongo', type: 'hero', strength: 4 })
    const withTile = oneVillainPlayer(cruella, cruellaCards, { laiterie: [pongo] })
    const tiled = { ...withTile, puppyTiles: [{ id: 't1', value: 22, homeLocation: 'laiterie', location: 'laiterie', state: 'board' as const, revealed: true }] }
    expect(villainFateTargetingBonus(tiled)).toBe(4)
    // Sans Tuile sur son lieu : pas de bonus.
    expect(villainFateTargetingBonus(oneVillainPlayer(cruella, cruellaCards, { laiterie: [pongo] }))).toBe(0)
  })

  it('Mère Gothel : Pascal récompensé sur la Tour ; Brosse/Couronne pénalisées', () => {
    const pascal = card({ cardId: 'pascal', type: 'hero', strength: 2 })
    expect(villainFateTargetingBonus(oneVillainPlayer(gothel, gothelCards, { tour: [pascal] }))).toBe(4)
    expect(villainFateTargetingBonus(oneVillainPlayer(gothel, gothelCards, { corona: [pascal] }))).toBe(0)
    const brosse = card({ cardId: 'brosse-a-cheveux', type: 'item' })
    const couronne = card({ cardId: 'couronne-gothel', type: 'item' })
    expect(villainFateTargetingBonus(oneVillainPlayer(gothel, gothelCards, { tour: [brosse, couronne] }))).toBe(-8)
  })
})

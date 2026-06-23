import { describe, it, expect } from 'vitest'
import { createInitialGame } from '../state'
import { applyAction } from '../actions'
import { effectiveStrength, hasReachedObjective, conditionIsTriggered, movableCards } from '../rules'
import { resolveEffects } from '../effects'
import { syndrome } from '../../data/villains/syndrome'
import { syndromeCards } from '../../data/villains/syndrome.cards'
import { buildDeckInstances } from '../../data/types'
import type { CardInstance, GameState } from '../types'

const game = (seed = 7): GameState =>
  createInitialGame(
    [
      {
        villain: syndrome,
        deckCards: buildDeckInstances(syndromeCards, 'villain', 'p0:'),
        fateCards: buildDeckInstances(syndromeCards, 'fate', 'p0f:'),
      },
    ],
    seed,
  )

let n = 0
const card = (cardId: string, type: CardInstance['type'], extra: Partial<CardInstance> = {}): CardInstance => ({
  instanceId: `t${n++}`,
  cardId,
  name: cardId,
  type,
  ...extra,
})

/** Pose le pion + un Héros + l'Omnidroïde sur un lieu, en phase ACTION. */
const arena = (
  base: GameState,
  loc: string,
  cards: CardInstance[],
  patch: Partial<GameState['players'][number]> = {},
): GameState =>
  ({
    ...base,
    phase: 'ACTION',
    players: [
      {
        ...base.players[0],
        pawnLocation: loc,
        board: { ...base.players[0].board, [loc]: cards },
        ...patch,
      },
    ],
  }) as GameState

describe('Syndrome — mise en place', () => {
  it('Omnidroïde v.X8 posé sur l’Île de Nomanisan ; pile = [v.X9, v.10] ; stade x8', () => {
    const s = game()
    const p = s.players[0]
    const onIsland = (p.board['ile-nomanisan'] ?? []).find((c) => c.isOmnidroid)
    expect(onIsland?.omnidroidStage).toBe('x8')
    expect(onIsland?.strength).toBe(5)
    expect(p.omnidroidStage).toBe('x8')
    expect(p.omnidroidPile?.map((c) => c.omnidroidStage)).toEqual(['x9', 'x10'])
    expect(p.objective.type).toBe('DEFEAT_OMNIDROID_V10')
    expect(hasReachedObjective(s, 0)).toBe(false)
  })
})

describe('Syndrome — progression de l’Omnidroïde', () => {
  it('v.X8 vainc un Héros → retiré, v.X9 en main, stade x9-hand', () => {
    const base = game()
    const omni = (base.players[0].board['ile-nomanisan'] ?? []).find((c) => c.isOmnidroid)!
    const hero = card('h', 'hero', { strength: 3 })
    // Maison des Parr a l'action « Vaincre » en bas (Île de Nomanisan n'en a pas). On
    // déplace l'Omnidroïde de départ vers Maison des Parr (on vide l'Île pour éviter un doublon).
    const s0 = {
      ...base,
      phase: 'ACTION' as const,
      players: [{
        ...base.players[0],
        pawnLocation: 'maison-des-parr',
        board: { ...base.players[0].board, 'ile-nomanisan': [], 'maison-des-parr': [omni, hero] },
      }],
    } as GameState
    const s = applyAction(s0, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: hero.instanceId, allyInstanceIds: [omni.instanceId] })
    const p = s.players[0]
    expect(Object.values(p.board).flat().some((c) => c.isOmnidroid)).toBe(false)
    expect(p.omnidroidStage).toBe('x9-hand')
    expect(p.hand.some((c) => c.cardId === 'omnidroide-v-x9')).toBe(true)
  })

  it('jouer v.X9 défausse 1 Modification Majeure → stade x9, sur le plateau', () => {
    const base = game()
    const v9 = base.players[0].omnidroidPile!.find((c) => c.omnidroidStage === 'x9')!
    const mod = card('modification-majeure', 'item')
    const s0 = arena(base, 'base-syndrome', [mod], {
      omnidroidStage: 'x9-hand',
      hand: [v9],
      power: 0,
    })
    const s = applyAction(s0, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: v9.instanceId, to: 'base-syndrome' })
    const p = s.players[0]
    expect(p.omnidroidStage).toBe('x9')
    expect((p.board['base-syndrome'] ?? []).some((c) => c.isOmnidroid && c.omnidroidStage === 'x9')).toBe(true)
    expect(p.discard.some((c) => c.cardId === 'modification-majeure')).toBe(true)
    expect(Object.values(p.board).flat().some((c) => c.cardId === 'modification-majeure')).toBe(false)
  })

  it('jouer v.X9 sans Modification Majeure est refusé', () => {
    const base = game()
    const v9 = base.players[0].omnidroidPile!.find((c) => c.omnidroidStage === 'x9')!
    const s0 = arena(base, 'base-syndrome', [], { omnidroidStage: 'x9-hand', hand: [v9], power: 0 })
    expect(() =>
      applyAction(s0, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: v9.instanceId, to: 'base-syndrome' }),
    ).toThrow(/Modification/)
  })

  it('v.X9 vainc un Héros → retiré, Télécommande + v.10 en main, stade x10-hand', () => {
    const base = game()
    const v9 = { ...base.players[0].omnidroidPile!.find((c) => c.omnidroidStage === 'x9')!, instanceId: 'v9' }
    const hero = card('h', 'hero', { strength: 4 })
    // Maison des Parr : l'action « Vaincre » est en bas (non recouverte par le Héros).
    const s0 = arena(base, 'maison-des-parr', [v9, hero], { omnidroidStage: 'x9', omnidroidPile: base.players[0].omnidroidPile!.filter((c) => c.omnidroidStage === 'x10') })
    const s = applyAction(s0, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: hero.instanceId, allyInstanceIds: ['v9'] })
    const p = s.players[0]
    expect(p.omnidroidStage).toBe('x10-hand')
    expect(p.hand.some((c) => c.cardId === 'telecommande-de-syndrome')).toBe(true)
    expect(p.hand.some((c) => c.cardId === 'omnidroide-v-x10')).toBe(true)
  })

  it('v.10 doit être joué sur Métroville (3 Modifications Majeures) et N’est PAS retiré au Vanquish', () => {
    const base = game()
    const v10 = { ...base.players[0].omnidroidPile!.find((c) => c.omnidroidStage === 'x10')!, instanceId: 'v10' }
    const mods = [card('modification-majeure', 'item'), card('modification-majeure', 'item'), card('modification-majeure', 'item')]
    // Refusé ailleurs que Métroville.
    const sBad = arena(base, 'base-syndrome', mods, { omnidroidStage: 'x10-hand', hand: [v10], power: 0 })
    expect(() => applyAction(sBad, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'v10', to: 'base-syndrome' })).toThrow(/Métroville/)
    // Accepté sur Métroville : défausse 3 Modifs, stade x10.
    const sOk0 = arena(base, 'metroville', mods, { omnidroidStage: 'x10-hand', hand: [v10], power: 0 })
    const sOk = applyAction(sOk0, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: 'v10', to: 'metroville' })
    const p = sOk.players[0]
    expect(p.omnidroidStage).toBe('x10')
    expect((p.board['metroville'] ?? []).some((c) => c.isOmnidroid && c.omnidroidStage === 'x10')).toBe(true)
    expect(p.discard.filter((c) => c.cardId === 'modification-majeure')).toHaveLength(3)
  })

  it('Télécommande activée (pion + v.10 sur Métroville) détruit le v.10 ; victoire si aucun Héros', () => {
    const base = game()
    const v10 = card('omnidroide-v-x10', 'ally', { strength: 7, isOmnidroid: true, omnidroidStage: 'x10' })
    const remote = card('telecommande-de-syndrome', 'item', { activatedCost: 0, grantsAction: { type: 'ACTIVATE', label: 'Activer (Télécommande)' } })
    const s0 = arena(base, 'metroville', [v10, remote], { omnidroidStage: 'x10', power: 0 })
    // L'action « Activer » est ACCORDÉE par la Télécommande (id granted:<instanceId>).
    const s = applyAction(s0, { type: 'ACTIVATE', actionId: `granted:${remote.instanceId}`, cardInstanceId: remote.instanceId })
    expect(s.players[0].omnidroidStage).toBe('destroyed')
    // v.10 RETOURNÉ sur place (pas défaussé) : reste sur Métroville, face détruite.
    expect((s.players[0].board['metroville'] ?? []).some((c) => c.cardId === 'omnidroide-v-x10-detruit')).toBe(true)
    expect(s.players[0].discard.some((c) => c.cardId.startsWith('omnidroide'))).toBe(false)
    expect(s.status).toBe('WON')
    expect(s.winner).toBe(0)
  })

  it('objectif NON atteint si l’Omnidroïde est détruit mais un Héros reste', () => {
    const base = game()
    const s = arena(base, 'metroville', [card('h', 'hero', { strength: 2 })], { omnidroidStage: 'destroyed' })
    expect(hasReachedObjective(s, 0)).toBe(false)
    // Sans Héros : objectif atteint.
    const s2 = arena(base, 'metroville', [], { omnidroidStage: 'destroyed' })
    expect(hasReachedObjective(s2, 0)).toBe(true)
  })
})

describe('Syndrome — forces particulières', () => {
  it('Gardes : +1 force par autre Allié sur le même lieu', () => {
    const base = game()
    const g = card('gardes', 'ally', { strength: 1, selfStrengthMods: [{ kind: 'per-other-type-here', cardType: 'ally', delta: 1 }] })
    const a1 = card('securite', 'ally', { strength: 2 })
    const a2 = card('securite', 'ally', { strength: 2 })
    const s = arena(base, 'metroville', [g, a1, a2])
    // 2 autres Alliés → 1 + 2 = 3.
    expect(effectiveStrength(s, 0, g.instanceId)).toBe(3)
  })

  it('Jack-Jack : sa force égale celle du Héros le plus fort sur son lieu', () => {
    const base = game()
    const jj = card('jack-jack', 'hero', { strength: 1, selfStrengthMods: [{ kind: 'match-strongest-hero-here' }] })
    const strong = card('m-indestructible', 'hero', { strength: 6 })
    const s = arena(base, 'metroville', [jj, strong])
    expect(effectiveStrength(s, 0, jj.instanceId)).toBe(6)
  })

  it('Énergie au Point Zéro : −2 à la force du Héros hôte', () => {
    const base = game()
    const hero = card('h', 'hero', { strength: 5 })
    const energie = card('energie-au-point-zero', 'item', { attach: 'hero', attachStrengthBonus: -2, immobilizesHostHero: true, attachedTo: hero.instanceId })
    const s = arena(base, 'metroville', [hero, energie])
    expect(effectiveStrength(s, 0, hero.instanceId)).toBe(3)
  })

  it('Unité de Confinement : la force d’un Héros tombe à 0', () => {
    const base = game()
    const hero = card('h', 'hero', { strength: 5, forceZeroed: true })
    const s = arena(base, 'metroville', [hero])
    expect(effectiveStrength(s, 0, hero.instanceId)).toBe(0)
  })

  it('Condition piochée en réaction (Je travaille en solo → 15 ans plus tard) : ne réagit qu’au Pouvoir gagné APRÈS la pioche', () => {
    const base = game()
    const quinze = card('15-ans-plus-tard', 'condition', { trigger: { type: 'opponent-gained-power-ge', value: 1 }, effects: [{ type: 'REVEAL_FATE_HERO_AT_PAWN' }] })
    // Joueur 0 réagit pendant le tour de l'adversaire (activePlayer = 1) : l'adversaire a
    // DÉJÀ gagné 3 Pouvoir et défaussé 1 carte ce tour-ci ; le joueur 0 va piocher « 15
    // ans plus tard » via « Je travaille en solo ».
    const s0 = {
      ...base,
      activePlayer: 1,
      activeGainedPower: 3,
      activeDiscardedCount: 1,
      players: [
        { ...base.players[0], deck: [quinze], hand: [] },
        { ...base.players[0], villainName: 'Adv' },
      ],
    } as unknown as GameState
    // « Je travaille en solo » : pioche 1 carte (= 15 ans plus tard) pour le joueur 0.
    const s = resolveEffects(s0, [{ type: 'DRAW_PER_OPPONENT_DISCARD' }], { actorIndex: 0 })
    const drawn = s.players[0].hand.find((c) => c.cardId === '15-ans-plus-tard')!
    expect(drawn.conditionBaseline?.gainedPower).toBe(3)
    // Le Pouvoir gagné AVANT la pioche ne déclenche pas la Condition.
    expect(conditionIsTriggered(s, drawn, 0)).toBe(false)
    // L'adversaire gagne 1 Pouvoir de plus APRÈS : la Condition devient jouable.
    const s2 = { ...s, activeGainedPower: 4 }
    expect(conditionIsTriggered(s2, drawn, 0)).toBe(true)
  })

  it('Alors ça, c’est un truc de dingue ! : défausse Alliés+Objets sauf Champ de Force (garde Héros et Omnidroïde)', () => {
    const base = game()
    const omni = card('omnidroide-v-x8', 'ally', { strength: 5, isOmnidroid: true, omnidroidStage: 'x8', immuneToAllyItemEffects: true })
    const ally = card('securite', 'ally', { strength: 2 })
    const item = card('modification-majeure', 'item')
    const hero = card('h', 'hero', { strength: 3 })
    const shield = card('champ-de-force', 'item', { attach: 'hero', shieldHeroFromVanquish: true, attachedTo: hero.instanceId })
    const s0 = arena(base, 'metroville', [omni, ally, item, hero, shield], { omnidroidStage: 'x8' })
    const s = resolveEffects(s0, [{ type: 'DISCARD_VILLAIN_BOARD_EXCEPT', exceptCardId: 'champ-de-force' }], { actorIndex: 0 })
    const cell = s.players[0].board['metroville'] ?? []
    expect(cell.some((c) => c.instanceId === ally.instanceId)).toBe(false) // Allié défaussé
    expect(cell.some((c) => c.instanceId === item.instanceId)).toBe(false) // Objet défaussé
    expect(s.players[0].discard.some((c) => c.instanceId === ally.instanceId)).toBe(true)
    expect(cell.some((c) => c.instanceId === hero.instanceId)).toBe(true) // Héros gardé
    expect(cell.some((c) => c.cardId === 'champ-de-force')).toBe(true) // Champ de Force gardé
    expect(cell.some((c) => c.isOmnidroid)).toBe(true) // Omnidroïde gardé (tuile hors deck)
  })

  it('Qui est le plus super ? : gagne = coût de la carte jouée (0 si coût 0 → injouable)', () => {
    const base = game()
    const cond = card('qui-est-le-plus-super', 'condition', {
      trigger: { type: 'opponent-played-cards-ge', value: 1 },
      effects: [{ type: 'GAIN_POWER_EQUAL_LAST_PLAYED_COST' }],
    })
    const mk = (cost: number) =>
      ({
        ...base,
        activePlayer: 0,
        activePlayedCount: 1,
        lastPlayedCardCost: cost,
        players: [base.players[0], { ...base.players[0], power: 0 }],
      }) as GameState
    // Carte adverse à coût 0 → Condition NON déclenchée (aucun gain possible).
    expect(conditionIsTriggered(mk(0), cond, 1)).toBe(false)
    // Carte adverse à coût 3 → déclenchée ; la jouer rapporte 3 Pouvoir.
    const s3 = mk(3)
    expect(conditionIsTriggered(s3, cond, 1)).toBe(true)
    const after = resolveEffects(s3, [{ type: 'GAIN_POWER_EQUAL_LAST_PLAYED_COST' }], { actorIndex: 1 })
    expect(after.players[1].power).toBe(3)
  })

  it('l’Omnidroïde n’est PAS affecté par les effets visant Alliés/Objets (ex. Elastigirl défausse un Allié)', () => {
    const base = game()
    const omni = card('omnidroide-v-x8', 'ally', { strength: 5, isOmnidroid: true, omnidroidStage: 'x8', immuneToAllyItemEffects: true })
    const ally = card('securite', 'ally', { strength: 2 })
    const s0 = arena(base, 'metroville', [omni, ally])
    // DISCARD_ALLIES_AT_HOST (Elastigirl) sur Métroville : ne touche QUE l'Allié normal.
    const s = resolveEffects(s0, [{ type: 'DISCARD_ALLIES_AT_HOST' }], { actorIndex: 0, hostLocationId: 'metroville' })
    const cell = s.players[0].board['metroville'] ?? []
    expect(cell.some((c) => c.isOmnidroid)).toBe(true) // Omnidroïde épargné
    expect(cell.some((c) => c.instanceId === ally.instanceId)).toBe(false) // Allié défaussé
  })

  it('Identification ne peut pas cibler l’Omnidroïde', () => {
    const base = game()
    const omni = card('omnidroide-v-x8', 'ally', { strength: 5, isOmnidroid: true, omnidroidStage: 'x8', immuneToAllyItemEffects: true })
    const hero = card('h', 'hero', { strength: 3 })
    const s0 = {
      ...base,
      pendingIdentification: { playerIndex: 0 },
      players: [{ ...base.players[0], board: { ...base.players[0].board, 'base-syndrome': [omni], metroville: [hero] } }],
    } as GameState
    expect(() => applyAction(s0, { type: 'RESOLVE_IDENTIFICATION', cardInstanceId: omni.instanceId, to: 'metroville' })).toThrow(/Omnidroïde|invalide/)
  })

  it('un Omnidroïde compte comme un Objet pour les conditions adverses (items-in-realm)', () => {
    const base = game()
    // Syndrome (joueur 0, actif) a l'Omnidroïde v.X8 sur son plateau (alsoItem).
    expect((base.players[0].board['ile-nomanisan'] ?? []).some((c) => c.isOmnidroid && c.alsoItem)).toBe(true)
    const cond = card('x', 'condition', { trigger: { type: 'opponent-items-in-realm-ge', value: 1 } })
    const s = {
      ...base,
      activePlayer: 0,
      players: [base.players[0], { ...base.players[0] }],
    } as GameState
    // Le joueur 1 réagit à Syndrome (actif) : son unique Omnidroïde compte comme 1 Objet.
    expect(conditionIsTriggered(s, cond, 1)).toBe(true)
  })

  it('15 ans plus tard : le Héros joué garde sa force de BASE + un modificateur −2 (badge visible)', () => {
    const base = game()
    const fateHero = card('h', 'hero', { strength: 6 })
    const s0 = {
      ...base,
      activePlayer: 0,
      players: [{ ...base.players[0], pawnLocation: 'metroville', fateDeck: [fateHero], fateDiscard: [] }],
    } as GameState
    // Dévoile + ouvre le choix de lieu (pendingFetchedHero) ; force réduite de 2.
    const s1 = resolveEffects(s0, [{ type: 'REVEAL_FATE_HERO_CHOOSE_LOC', weakenBy: 2 }], { actorIndex: 0 })
    expect(s1.pendingFetchedHero?.hero.permanentStrengthDelta).toBe(-2)
    expect(s1.pendingFetchedHero?.hero.strength).toBe(6) // base intacte
    // Le joueur choisit le lieu (Métroville).
    const s2 = applyAction(s1, { type: 'RESOLVE_FETCHED_HERO', play: true, to: 'metroville' })
    const placed = (s2.players[0].board['metroville'] ?? []).find((c) => c.instanceId === fateHero.instanceId)!
    expect(placed.strength).toBe(6) // base conservée → l'UI compare base vs effectif
    expect(effectiveStrength(s2, 0, placed.instanceId)).toBe(4) // 6 − 2
  })

  it('Effet commun : un Héros vole la Télécommande si elle est dans le royaume ; elle est libérée à sa mort', () => {
    const base = game()
    const hero = card('frozone', 'hero', { strength: 3 })
    const remote = card('telecommande-de-syndrome', 'item', { activatedCost: 0 })
    const s0 = {
      ...base,
      players: [{ ...base.players[0], board: { ...base.players[0].board, metroville: [hero], 'base-syndrome': [remote] } }],
    } as GameState
    // À la pose, le Héros s'empare de la Télécommande (associée à lui, sur son lieu).
    const s1 = resolveEffects(s0, [{ type: 'ATTACH_REMOTE_IF_IN_REALM' }], { actorIndex: 0, hostInstanceId: hero.instanceId, hostLocationId: 'metroville' })
    const att = (s1.players[0].board['metroville'] ?? []).find((c) => c.cardId === 'telecommande-de-syndrome')
    expect(att?.attachedTo).toBe(hero.instanceId)
    expect((s1.players[0].board['base-syndrome'] ?? []).some((c) => c.cardId === 'telecommande-de-syndrome')).toBe(false)
    // En vainquant le Héros (Maison des Parr, Vaincre en bas), la Télécommande est libérée.
    const ally = card('securite', 'ally', { strength: 5 })
    const s2 = {
      ...s1,
      phase: 'ACTION' as const,
      players: [{ ...s1.players[0], pawnLocation: 'maison-des-parr', board: { ...s1.players[0].board, metroville: [], 'maison-des-parr': [hero, att!, ally] } }],
    } as GameState
    const s3 = applyAction(s2, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: hero.instanceId, allyInstanceIds: [ally.instanceId] })
    const freed = (s3.players[0].board['maison-des-parr'] ?? []).find((c) => c.cardId === 'telecommande-de-syndrome')
    expect(freed).toBeDefined()
    expect(freed?.attachedTo).toBeUndefined()
  })

  it('Frozone immobilise les Alliés de SON lieu uniquement', () => {
    const base = game()
    const frozone = card('frozone', 'hero', { strength: 3, blocksAllyMovesHere: true })
    const allyHere = card('securite', 'ally', { strength: 2 })
    const allyElsewhere = card('securite', 'ally', { strength: 2 })
    const s = {
      ...base,
      phase: 'ACTION' as const,
      players: [{
        ...base.players[0],
        pawnLocation: 'base-syndrome',
        board: { ...base.players[0].board, 'ile-nomanisan': [], metroville: [frozone, allyHere], 'base-syndrome': [allyElsewhere] },
      }],
    } as GameState
    const movable = movableCards(s).map((m) => m.instanceId)
    expect(movable.includes(allyHere.instanceId)).toBe(false) // sur le lieu de Frozone → bloqué
    expect(movable.includes(allyElsewhere.instanceId)).toBe(true) // ailleurs → déplaçable
  })

  it('Elastigirl défausse UN seul Allié (le plus fort) sur son lieu, pas tous', () => {
    const base = game()
    const a1 = card('securite', 'ally', { strength: 2 })
    const a2 = card('gardes', 'ally', { strength: 4 })
    const s0 = { ...base, players: [{ ...base.players[0], board: { ...base.players[0].board, metroville: [a1, a2] } }] } as GameState
    const s = resolveEffects(s0, [{ type: 'DISCARD_ONE_ALLY_AT_HOST' }], { actorIndex: 0, hostLocationId: 'metroville' })
    const cell = s.players[0].board['metroville'] ?? []
    expect(cell.some((c) => c.instanceId === a2.instanceId)).toBe(false) // le plus fort défaussé
    expect(cell.some((c) => c.instanceId === a1.instanceId)).toBe(true) // l'autre reste
  })

  it('Mirage : joue le Héros révélé sur le MÊME lieu que Mirage (pas le lieu du pion)', () => {
    const base = game()
    const mirage = card('mirage', 'ally', { cost: 3, effects: [{ type: 'REVEAL_FATE_HERO_AT_PAWN' }] })
    const filler = card('intrusion', 'effect')
    const fateHero = card('m-indestructible', 'hero', { strength: 6 })
    const after = card('monologue', 'effect') // sous le Héros : NE doit PAS être dévoilée
    const s0 = {
      ...base,
      phase: 'ACTION' as const,
      players: [{
        ...base.players[0],
        pawnLocation: 'maison-des-parr',
        power: 5,
        hand: [mirage],
        fateDeck: [filler, fateHero, after],
        fateDiscard: [],
      }],
    } as GameState
    // Pion sur Maison des Parr, mais Mirage joué sur Métroville.
    const s = applyAction(s0, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: mirage.instanceId, to: 'metroville' })
    const p = s.players[0]
    expect((p.board['metroville'] ?? []).some((c) => c.cardId === 'mirage')).toBe(true)
    expect((p.board['metroville'] ?? []).some((c) => c.instanceId === fateHero.instanceId)).toBe(true)
    expect((p.board['maison-des-parr'] ?? []).some((c) => c.type === 'hero')).toBe(false)
    // La carte révélée AVANT le Héros est défaussée…
    expect(p.fateDiscard.some((c) => c.instanceId === filler.instanceId)).toBe(true)
    // …mais on s'ARRÊTE au 1er Héros : la carte en-dessous RESTE dans la pioche (pas vidée).
    expect(p.fateDeck.some((c) => c.instanceId === after.instanceId)).toBe(true)
    expect(p.fateDiscard.some((c) => c.instanceId === after.instanceId)).toBe(false)
  })

  it('Identification, je vous prie : ouvre un choix interactif puis déplace l’Allié vers un lieu avec Héros', () => {
    const base = game()
    const ident = card('identification-je-vous-prie', 'effect', { cost: 2, effects: [{ type: 'MOVE_ALLY_OR_ITEM_TO_HERO_LOCATION' }] })
    const ally = card('securite', 'ally', { strength: 2 })
    const hero = card('h', 'hero', { strength: 3 })
    const s0 = {
      ...base,
      phase: 'ACTION' as const,
      players: [{
        ...base.players[0],
        pawnLocation: 'base-syndrome',
        power: 5,
        hand: [ident],
        board: { ...base.players[0].board, 'base-syndrome': [ally], metroville: [hero] },
      }],
    } as GameState
    // Jouer la carte ouvre le pending (choix interactif), sans déplacer encore.
    const s1 = applyAction(s0, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: ident.instanceId })
    expect(s1.pendingIdentification?.playerIndex).toBe(0)
    expect((s1.players[0].board['base-syndrome'] ?? []).some((c) => c.instanceId === ally.instanceId)).toBe(true)
    // Résoudre : déplace l'Allié choisi vers le lieu (avec Héros) choisi.
    const s2 = applyAction(s1, { type: 'RESOLVE_IDENTIFICATION', cardInstanceId: ally.instanceId, to: 'metroville' })
    expect(s2.pendingIdentification).toBeNull()
    expect((s2.players[0].board['metroville'] ?? []).some((c) => c.instanceId === ally.instanceId)).toBe(true)
    expect((s2.players[0].board['base-syndrome'] ?? []).some((c) => c.instanceId === ally.instanceId)).toBe(false)
  })

  it('Identification, je vous prie : injouable s’il n’y a aucun lieu avec un Héros', () => {
    const base = game()
    const ident = card('identification-je-vous-prie', 'effect', { cost: 2, effects: [{ type: 'MOVE_ALLY_OR_ITEM_TO_HERO_LOCATION' }] })
    const ally = card('securite', 'ally', { strength: 2 })
    const s0 = {
      ...base,
      phase: 'ACTION' as const,
      players: [{
        ...base.players[0],
        pawnLocation: 'base-syndrome',
        power: 5,
        hand: [ident],
        board: { ...base.players[0].board, 'base-syndrome': [ally] },
      }],
    } as GameState
    expect(() => applyAction(s0, { type: 'PLAY_CARD', actionId: 'play-card', instanceId: ident.instanceId })).toThrow(/Identification/)
  })

  it('Champ de Force : protège le Héros d’une élimination (l’Objet est défaussé à sa place)', () => {
    const base = game()
    const hero = card('h', 'hero', { strength: 2 })
    const shield = card('champ-de-force', 'item', { attach: 'hero', shieldHeroFromVanquish: true, attachedTo: hero.instanceId })
    const ally = card('securite', 'ally', { strength: 3 })
    const s0 = arena(base, 'maison-des-parr', [hero, shield, ally])
    const s = applyAction(s0, { type: 'VANQUISH', actionId: 'vanquish', heroInstanceId: hero.instanceId, allyInstanceIds: [ally.instanceId] })
    const p = s.players[0]
    // Le Héros survit ; le Champ de Force part en défausse Fatalité ; l’Allié reste.
    expect((p.board['maison-des-parr'] ?? []).some((c) => c.instanceId === hero.instanceId)).toBe(true)
    expect(p.fateDiscard.some((c) => c.cardId === 'champ-de-force')).toBe(true)
    expect((p.board['maison-des-parr'] ?? []).some((c) => c.instanceId === ally.instanceId)).toBe(true)
  })
})

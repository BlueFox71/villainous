import { describe, it, expect } from 'vitest'
import type { CardInstance, CombattantVerb, GameState, Location, VillainDef } from '../types'
import { createInitialGame, type PlayerSetup } from '../state'
import {
  alignment,
  captureCombattant,
  applyCombattantVerb,
  resolveCombattantRevenue,
  resolveRevenueCombattant,
  isLocationControlled,
  conqueredLocationCount,
  controlledLocationCount,
  combattantRevenue,
  garrisonForce,
  syncLocationControl,
} from '../spirits'
import { hasReachedObjective } from '../rules'
import { applyAction } from '../actions'
import { resolveEffect } from '../effects'

// --- Fixtures ---------------------------------------------------------------

/** 4 lieux : 2 home (loc-1/loc-2) + 2 conquérables (loc-3 def 3, loc-4 def 5). Les 2
 *  conquérables ont une face alt pour tester la bascule visuelle. */
function locations(): Location[] {
  const acts = (id: string) => [
    { id: `${id}-p`, type: 'PLAY_CARD' as const, label: 'Jouer', row: 'top' as const },
    { id: `${id}-g`, type: 'GAIN_POWER' as const, label: 'Gagner 1', row: 'bottom' as const, amount: 1 },
  ]
  // Pour les lieux conquérables : main = face A (nom « Contrôlé », affichée UNE FOIS contrôlé) ;
  // alt = face B (nom « Rival », affichée au départ tant que non contrôlé).
  return [
    { id: 'loc-1', name: 'Home A', actions: acts('a') },
    { id: 'loc-2', name: 'Home B', actions: acts('b') },
    { id: 'loc-3', name: 'Contrôlé 3', actions: acts('c'), altName: 'Rival 3', altActions: acts('c'), version: 'a', defense: 3 },
    { id: 'loc-4', name: 'Contrôlé 4', actions: acts('d'), altName: 'Rival 4', altActions: acts('d'), version: 'a', defense: 5 },
  ]
}

function combattant(
  id: string,
  sun: number,
  moon: number,
  verb: CombattantVerb,
  magnitude: number,
): CardInstance {
  return {
    instanceId: `comb:${id}`,
    cardId: id,
    name: id.toUpperCase(),
    type: 'hero',
    strength: 3,
    spiritSun: sun,
    spiritMoon: moon,
    combattantVerb: verb,
    combattantMagnitude: magnitude,
  }
}

function ally(id: string, strength: number): CardInstance {
  return { instanceId: `ally:${id}`, cardId: id, name: id, type: 'ally', strength }
}

function villain(): VillainDef {
  return {
    id: 'custom-test-sumbra',
    name: 'Sumbra Test',
    locations: locations(),
    objective: { type: 'SPIRIT_THRESHOLD', threshold: 10, camp: 'moon' },
    objectiveDescription: 'Capturez 10 esprits.',
    boardImage: '',
    pawnImage: '',
    pawnHeightPx: 100,
    backVillainImage: '',
    backFateImage: '',
  }
}

function game(combattants: CardInstance[] = []): GameState {
  const setup: PlayerSetup = {
    villain: villain(),
    deckCards: Array.from({ length: 8 }, (_, i) => ({
      instanceId: `p0:card${i}`,
      cardId: `card${i}`,
      name: `Carte ${i}`,
      type: 'ally',
      strength: 1,
      cost: 1,
    })),
    fateCards: [],
    combattantCards: combattants,
  }
  // Un 2e joueur factice (le moteur attend ≥ 2 joueurs).
  const opp: PlayerSetup = {
    villain: { ...villain(), id: 'custom-test-opp', objective: { type: 'POWER_THRESHOLD', threshold: 20 } },
    deckCards: [{ instanceId: 'p1:c', cardId: 'c', name: 'c', type: 'ally', strength: 1, cost: 1 }],
    fateCards: [],
  }
  return createInitialGame([setup, opp], 12345)
}

/** Place un Allié sur un lieu (mutation directe pour les tests de contrôle). */
function place(state: GameState, playerIndex: number, loc: string, a: CardInstance): GameState {
  return {
    ...state,
    players: state.players.map((p, i) =>
      i === playerIndex ? { ...p, board: { ...p.board, [loc]: [...(p.board[loc] ?? []), a] } } : p,
    ),
  }
}

// --- Tests ------------------------------------------------------------------

describe('Sumbra/Kilaire — esprits & alignement', () => {
  it('camp moon : capture la valeur 🌑 ; alignement = signe(moon - sun)', () => {
    const g = game()
    const p = g.players[0]
    const sumbraAligned = combattant('x', 1, 4, 'decharge', 3) // moon 4 > sun 1 → aligné
    const killaireAligned = combattant('y', 4, 1, 'decharge', 3) // moon 1 < sun 4 → désaligné
    expect(alignment(p, sumbraAligned)).toBe(1)
    expect(alignment(p, killaireAligned)).toBe(-1)
    // Capture = valeur moon.
    expect((captureCombattant(g, 0, sumbraAligned).players[0].spirits ?? 0)).toBe(4)
    expect((captureCombattant(g, 0, killaireAligned).players[0].spirits ?? 0)).toBe(1)
  })

  it('Décharge : Bonus +N Pouvoir / Malus -N Pouvoir', () => {
    let g = game()
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, power: 5 } : p)) }
    const c = combattant('x', 1, 4, 'decharge', 3)
    expect(applyCombattantVerb(g, 0, c, 1).players[0].power).toBe(8)
    expect(applyCombattantVerb(g, 0, c, -1).players[0].power).toBe(2)
  })

  it('Ferveur : ±N esprits en direct', () => {
    let g = game()
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, spirits: 5 } : p)) }
    const c = combattant('x', 1, 4, 'ferveur', 2)
    expect(applyCombattantVerb(g, 0, c, 1).players[0].spirits).toBe(7)
    expect(applyCombattantVerb(g, 0, c, -1).players[0].spirits).toBe(3)
  })

  it('Surtension Malus : annule la capture du prochain Combattant', () => {
    let g = game()
    const c = combattant('x', 1, 4, 'surtension', 1)
    g = applyCombattantVerb(g, 0, c, -1) // arme le drapeau
    expect(g.players[0].combattantZeroCaptureNext).toBe(true)
    const next = combattant('y', 1, 4, 'decharge', 2)
    const after = captureCombattant(g, 0, next)
    expect(after.players[0].spirits ?? 0).toBe(0) // capture annulée
    expect(after.players[0].combattantZeroCaptureNext).toBeUndefined() // drapeau consommé
  })

  it('Aubaine : modifie le coût des cartes ce tour (signé)', () => {
    const g = game()
    const c = combattant('x', 1, 4, 'aubaine', 1)
    expect(applyCombattantVerb(g, 0, c, 1).players[0].spiritCostMod).toBe(1)
    expect(applyCombattantVerb(g, 0, c, -1).players[0].spiritCostMod).toBe(-1)
  })

  it('Rempart : ±N Force TEMPORAIRE sur TOUS les lieux du joueur (ce tour)', () => {
    const g = game()
    const c = combattant('x', 1, 4, 'rempart', 2) // aligné (moon 4) → Bonus +2
    const bonus = applyCombattantVerb(g, 0, c, 1)
    const tf = bonus.players[0].locationTempForce ?? {}
    // Les 4 lieux reçoivent +2.
    expect(g.players[0].locations.every((l) => tf[l.id] === 2)).toBe(true)
    // Malus : −2 sur tous les lieux.
    const malus = applyCombattantVerb(g, 0, c, -1)
    const tfm = malus.players[0].locationTempForce ?? {}
    expect(g.players[0].locations.every((l) => tfm[l.id] === -2)).toBe(true)
  })

  it('Renfort Malus : main > N → ouvre un CHOIX de défausse (N cartes)', () => {
    let g = game()
    // Donne 3 cartes en main (> N=2) → choix interactif.
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, hand: p.deck.slice(0, 3), deck: p.deck.slice(3) } : p)) }
    const c = combattant('x', 1, 4, 'renfort', 2)
    const after = applyCombattantVerb(g, 0, c, -1)
    expect(after.pendingCombattantChoices?.[0]).toMatchObject({ kind: 'discard', count: 2 })
    expect(after.players[0].hand.length).toBe(3) // rien défaussé tant que le choix n'est pas résolu
  })

  it('Renfort Malus : main ≤ N → défausse forcée de toute la main (aucun choix)', () => {
    let g = game()
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, hand: p.deck.slice(0, 2), deck: p.deck.slice(2) } : p)) }
    const c = combattant('x', 1, 4, 'renfort', 3) // N=3 ≥ main(2) → tout défaussé
    const after = applyCombattantVerb(g, 0, c, -1)
    expect(after.pendingCombattantChoices ?? []).toEqual([])
    expect(after.players[0].hand.length).toBe(0)
    expect(after.players[0].discard.length).toBe(2)
  })
})

describe('Sumbra/Kilaire — contrôle de lieu', () => {
  it('lieu-home toujours contrôlé ; conquérable contrôlé si garnison ≥ Défense', () => {
    let g = game()
    expect(isLocationControlled(g, 0, 'loc-1')).toBe(true) // home
    expect(isLocationControlled(g, 0, 'loc-3')).toBe(false) // rival, aucune garnison
    // Garnison insuffisante (2 < 3).
    g = place(g, 0, 'loc-3', ally('a1', 2))
    expect(isLocationControlled(g, 0, 'loc-3')).toBe(false)
    // Garnison suffisante (2 + 2 = 4 ≥ 3).
    g = place(g, 0, 'loc-3', ally('a2', 2))
    expect(garrisonForce(g, 0, 'loc-3')).toBe(4)
    expect(isLocationControlled(g, 0, 'loc-3')).toBe(true)
    expect(controlledLocationCount(g, 0)).toBe(3) // 2 home + loc-3
    expect(conqueredLocationCount(g, 0)).toBe(1)
    expect(combattantRevenue(g, 0)).toBe(1)
  })

  it('verrou (locksLocationControl) : contrôle définitif même sans Allié', () => {
    let g = game()
    g = place(g, 0, 'loc-4', { instanceId: 'lock', cardId: 'base', name: 'Base', type: 'item', locksLocationControl: true })
    expect(isLocationControlled(g, 0, 'loc-4')).toBe(true)
  })

  it('démarre RIVAL sur la face B (alt) ; conquérir bascule sur la face A (main)', () => {
    let g = game()
    // Au départ (aucune garnison) : lieu conquérable affiche sa face B (alt = « Rival 3 »).
    const start = g.players[0].locations.find((l) => l.id === 'loc-3')!
    expect(start.version).toBe('b')
    expect(start.name).toBe('Rival 3')
    // Conquis (garnison 3 ≥ 3) → bascule face A (main = « Contrôlé 3 »).
    g = place(g, 0, 'loc-3', ally('a1', 3))
    g = syncLocationControl(g, 0)
    const loc3 = g.players[0].locations.find((l) => l.id === 'loc-3')!
    expect(loc3.version).toBe('a')
    expect(loc3.name).toBe('Contrôlé 3')
  })
})

describe('Sumbra/Kilaire — revenu & victoire', () => {
  it('revenu 0 à 2 lieux (rien pioché) ; 1 à 3 lieux', () => {
    const deck = [combattant('c1', 1, 4, 'decharge', 3), combattant('c2', 1, 3, 'decharge', 2)]
    let g = game(deck)
    // 2 lieux home → revenu 0.
    const noRevenue = resolveCombattantRevenue(g, 0)
    expect(noRevenue.players[0].spirits ?? 0).toBe(0)
    // Conquiert loc-3 (garnison 3 ≥ 3) → revenu 1.
    g = place(g, 0, 'loc-3', ally('a', 3))
    const rev = resolveCombattantRevenue(g, 0)
    // 1 Combattant pioché : capture sa valeur moon (c1 = 4).
    expect((rev.players[0].spirits ?? 0)).toBeGreaterThanOrEqual(4)
    expect(rev.players[0].combattantDiscard?.length).toBe(1)
  })

  it('Surtension Bonus (revenu) : pioche un Combattant SUPPLÉMENTAIRE qui capture aussi', () => {
    let g = game()
    // Deck ordonné : Surtension aligné (🌑3 > ☀️1) puis un Décharge aligné (🌑2).
    const surt = combattant('s', 1, 3, 'surtension', 1)
    const extra = combattant('e', 1, 2, 'decharge', 1)
    g = {
      ...g,
      players: g.players.map((p, i) =>
        i === 0 ? { ...p, combattantDeck: [surt, extra, ...(p.combattantDeck ?? [])] } : p,
      ),
    }
    // Conquiert loc-3 (garnison 3 ≥ 3) → revenu de base 1.
    g = place(g, 0, 'loc-3', ally('a', 3))
    const rev = resolveCombattantRevenue(g, 0)
    // 2 Combattants révélés (1 de base + 1 via Surtension Bonus), tous deux capturés.
    expect((rev.players[0].revealedCombattants ?? []).length).toBe(2)
    expect(rev.players[0].spirits ?? 0).toBe(3 + 2) // 🌑3 (surtension) + 🌑2 (extra)
    // Le Combattant supplémentaire est enchaîné DANS le même showcase (glisse à droite).
    const scEvents = rev.showcaseEvents.filter((e) => (e.combattantExtras ?? []).length > 0)
    expect(scEvents.length).toBe(1)
    expect(scEvents[0].cardId).toBe('s') // principal = la carte Surtension
    expect(scEvents[0].combattantExtras?.map((x) => x.cardId)).toEqual(['e'])
    // Pastilles d'esprits : delta signé par carte + camp du joueur (moon pour Sumbra).
    expect(scEvents[0].combattantCamp).toBe('moon')
    expect(scEvents[0].combattantSpiritDelta).toBe(3) // 🌑3 capturés par la carte Surtension
    expect(scEvents[0].combattantExtras?.[0]?.spiritDelta).toBe(2) // 🌑2 par l'extra
    // Le compteur est consommé (pas de re-pioche par la boucle de revenu).
    expect(rev.players[0].extraCombattantDrawsThisTurn).toBe(0)
    // Les 2 Combattants sont bien en défausse.
    expect(rev.players[0].combattantDiscard?.length).toBe(2)
  })

  it('Surtension Bonus HORS revenu (mode test « en Combattant ») : enchaîne aussi l\'extra', () => {
    // resolveCombattantRevenue n\'est PAS appelé ici : on résout un seul Combattant Surtension
    // (comme le fait le mode test), qui doit tout de même piocher/enchaîner son extra.
    let g = game()
    const surt = combattant('s', 1, 3, 'surtension', 1)
    const extra = combattant('e', 1, 2, 'decharge', 1)
    g = {
      ...g,
      players: g.players.map((p, i) =>
        i === 0 ? { ...p, combattantDeck: [extra, ...(p.combattantDeck ?? [])] } : p,
      ),
    }
    const out = resolveRevenueCombattant(g, 0, surt)
    // Principal (🌑3) + extra pioché (🌑2) capturés, tous deux en défausse et dans la rangée.
    expect(out.players[0].spirits ?? 0).toBe(3 + 2)
    expect((out.players[0].revealedCombattants ?? []).length).toBe(2)
    expect(out.players[0].combattantDiscard?.length).toBe(2)
    expect(out.players[0].extraCombattantDrawsThisTurn).toBe(0)
    const sc = out.showcaseEvents.filter((e) => (e.combattantExtras ?? []).length > 0)
    expect(sc.length).toBe(1)
    expect(sc[0].combattantExtras?.map((x) => x.cardId)).toEqual(['e'])
  })

  it('Renfort Bonus : défausse vide → pioche forcée (aucun choix ouvert)', () => {
    const c = combattant('r', 1, 3, 'renfort', 1) // moon 3 > sun 1 → aligné (Bonus) pour Sumbra
    const g = game([c]) // défausse Méchant vide au départ
    const handBefore = g.players[0].hand.length
    const out = resolveRevenueCombattant(g, 0, c)
    expect(out.players[0].hand.length).toBe(handBefore + 1) // pioche forcée : +1 en main
    expect(out.pendingCombattantChoices ?? []).toEqual([]) // pas de choix (défausse vide)
    expect(out.log.some((l) => /pioche 1 carte Méchant \(Renfort\)/.test(l))).toBe(true)
  })

  it('Renfort Bonus : défausse non vide → CHOIX interactif (piocher / récupérer)', () => {
    const c = combattant('r', 1, 3, 'renfort', 1)
    let g = game([c])
    const good = { instanceId: 'd:good', cardId: 'good', name: 'Bonne', type: 'ally' as const, strength: 5, cost: 4 }
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, discard: [...p.discard, good] } : p)) }
    const revealed = resolveRevenueCombattant(g, 0, c)
    // Un choix draw-or-recover est ouvert (rien n'est pioché/récupéré tant qu'il n'est pas résolu).
    expect(revealed.pendingCombattantChoices?.[0]?.kind).toBe('draw-or-recover')
    expect(revealed.players[0].hand.some((x) => x.instanceId === 'd:good')).toBe(false)
    // Résolution « récupérer » → la carte choisie passe en main, le choix est dépilé.
    const done = applyAction(revealed, { type: 'RESOLVE_COMBATTANT_DRAW_OR_RECOVER', choice: 'recover', recoverInstanceId: 'd:good' })
    expect(done.players[0].hand.some((x) => x.instanceId === 'd:good')).toBe(true)
    expect(done.players[0].discard.some((x) => x.instanceId === 'd:good')).toBe(false)
    expect(done.pendingCombattantChoices ?? []).toEqual([])
  })

  it('Renfort Malus : main > count → CHOIX de la carte à défausser', () => {
    const c = combattant('r', 3, 1, 'renfort', 1) // sun 3 > moon 1 → désaligné (Malus) pour Sumbra
    const g = game([c]) // main de départ ≥ 2 cartes (deckCards → main pleine)
    const revealed = resolveRevenueCombattant(g, 0, c)
    expect(revealed.pendingCombattantChoices?.[0]?.kind).toBe('discard')
    const handBefore = revealed.players[0].hand
    const pick = handBefore[0].instanceId
    const done = applyAction(revealed, { type: 'RESOLVE_COMBATTANT_DISCARD', instanceIds: [pick] })
    expect(done.players[0].hand.some((x) => x.instanceId === pick)).toBe(false) // défaussée
    expect(done.players[0].discard.some((x) => x.instanceId === pick)).toBe(true)
    expect(done.pendingCombattantChoices ?? []).toEqual([])
  })

  it('Renfort Malus : main vide → rien (aucun choix)', () => {
    const c = combattant('r', 3, 1, 'renfort', 1)
    let g = game([c])
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, hand: [] } : p)) }
    const out = resolveRevenueCombattant(g, 0, c)
    expect(out.pendingCombattantChoices ?? []).toEqual([])
  })

  it('victoire quand esprits ≥ seuil', () => {
    let g = game()
    expect(hasReachedObjective(g, 0)).toBe(false)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, spirits: 10 } : p)) }
    expect(hasReachedObjective(g, 0)).toBe(true)
  })

  it('franchir le seuil GRÂCE au revenu ne gagne pas ce tour : victoire confirmée au tour suivant', () => {
    // Deck de 2 Combattants moon=4 (capture +4 par revenu). loc-3 conquis → revenu 1.
    let g = game([combattant('c1', 1, 4, 'decharge', 3), combattant('c2', 1, 4, 'decharge', 3)])
    g = place(g, 0, 'loc-3', ally('a', 3)) // garnison 3 ≥ 3 → revenu 1
    // Début de tour à 9 esprits (seuil 10) : le revenu va franchir le seuil ce tour-ci.
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, spirits: 9 } : p)) }

    // Le joueur 1 termine → début du tour du joueur 0 : victoire vérifiée AVANT le revenu.
    const start1 = applyAction({ ...g, activePlayer: 1, phase: 'ACTION' }, { type: 'END_TURN' })
    expect(start1.status).toBe('PLAYING') // 9 < 10 au début du tour → PAS de victoire
    expect(start1.players[0].spirits ?? 0).toBeGreaterThanOrEqual(10) // revenu appliqué (au-delà du seuil)

    // Tour suivant : au début du tour du joueur 0, le seuil est détenu dès le départ → victoire.
    const start2 = applyAction({ ...start1, activePlayer: 1, phase: 'ACTION' }, { type: 'END_TURN' })
    expect(start2.status).toBe('WON')
    expect(start2.winner).toBe(0)
  })

  it('applyAction (post-action) synchronise le contrôle : la pose bascule la face', () => {
    // (déplacé ci-dessous après le bloc effets pour rester groupé)
    void 0
  })
})

describe('Sumbra/Kilaire — effets de cartes', () => {
  it('CAPTURE_SPIRITS ajoute des esprits ; FORMATION (fuite) en retire 1 par capture', () => {
    let g = game()
    g = resolveEffect(g, { type: 'CAPTURE_SPIRITS', amount: 3 }, { actorIndex: 0 })
    expect(g.players[0].spirits).toBe(3)
    // Pose une Formation (reducesSpiritCapture) → capture suivante −1.
    g = place(g, 0, 'loc-1', { instanceId: 'form', cardId: 'formation', name: 'Formation', type: 'item', reducesSpiritCapture: true })
    g = resolveEffect(g, { type: 'CAPTURE_SPIRITS', amount: 3 }, { actorIndex: 0 })
    expect(g.players[0].spirits).toBe(3 + 2) // 3 - 1 (fuite) = 2
  })

  it('DRAW_COMBATTANT_BONUS pioche 1 Combattant et force le Bonus', () => {
    // Combattant désaligné pour Sumbra (sun>moon) mais Bonus FORCÉ (Décharge +2 Pouvoir).
    const deck = [combattant('c1', 4, 1, 'decharge', 2)]
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, power: 1 } : p)) }
    g = resolveEffect(g, { type: 'DRAW_COMBATTANT_BONUS' }, { actorIndex: 0 })
    // Capture moon (1) + Bonus Décharge +2 Pouvoir.
    expect(g.players[0].spirits).toBe(1)
    expect(g.players[0].power).toBe(3)
    expect(g.players[0].combattantDiscard?.length).toBe(1)
    // Le showcase porte les pastilles esprits (+1) ET Pouvoir (+2).
    const sc = g.showcaseEvents[g.showcaseEvents.length - 1]
    expect(sc.combattantSpiritDelta).toBe(1)
    expect(sc.combattantPowerDelta).toBe(2)
    expect(sc.combattantCamp).toBe('moon')
  })

  it('CHOC_DES_TITANS capture la somme puis OUVRE le choix payer/subir (interactif)', () => {
    const deck = [combattant('c1', 1, 4, 'ferveur', 2)]
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, power: 5 } : p)) }
    g = resolveEffect(g, { type: 'CHOC_DES_TITANS', payForBonus: true }, { actorIndex: 0 })
    // La SOMME (1+4=5) est capturée tout de suite ; le verbe attend le choix du joueur.
    expect(g.players[0].spirits).toBe(5)
    expect(g.players[0].power).toBe(5)
    expect(g.pendingChocTitans?.playerIndex).toBe(0)
    expect(g.players[0].combattantDiscard?.length ?? 0).toBe(0)
    // Le showcase n'est PAS encore révélé pendant le choix ; le pending mémorise la somme captée.
    expect(g.pendingChocTitans?.capturedSum).toBe(5)
    expect(g.showcaseEvents.some((e) => e.combattantExtras !== undefined)).toBe(false)
  })

  it('RESOLVE_CHOC_TITANS pay:true → paie 2 Pouvoir, applique le Bonus, révèle le showcase NET', () => {
    const deck = [combattant('c1', 1, 4, 'ferveur', 2)]
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, power: 5 } : p)) }
    g = resolveEffect(g, { type: 'CHOC_DES_TITANS', payForBonus: true }, { actorIndex: 0 })
    g = applyAction(g, { type: 'RESOLVE_CHOC_TITANS', pay: true })
    // Somme 5 + Bonus Ferveur (+2) = 7 esprits ; 5 − 2 Pouvoir = 3 ; Combattant en défausse.
    expect(g.players[0].spirits).toBe(5 + 2)
    expect(g.players[0].power).toBe(3)
    expect(g.pendingChocTitans).toBeFalsy()
    expect(g.players[0].combattantDiscard?.length).toBe(1)
    // Le showcase est révélé APRÈS le choix, avec le delta NET : +7 esprits et −2 Pouvoir.
    const sc = g.showcaseEvents[g.showcaseEvents.length - 1]
    expect(sc.combattantSpiritDelta).toBe(7)
    expect(sc.combattantPowerDelta).toBe(-2)
  })

  it('RESOLVE_CHOC_TITANS pay:false → aucun Pouvoir dépensé, Malus appliqué', () => {
    const deck = [combattant('c1', 1, 4, 'ferveur', 2)]
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, power: 5 } : p)) }
    g = resolveEffect(g, { type: 'CHOC_DES_TITANS', payForBonus: true }, { actorIndex: 0 })
    g = applyAction(g, { type: 'RESOLVE_CHOC_TITANS', pay: false })
    // Somme 5 − Malus Ferveur (−2) = 3 esprits ; Pouvoir intact (5).
    expect(g.players[0].spirits).toBe(5 - 2)
    expect(g.players[0].power).toBe(5)
    expect(g.pendingChocTitans).toBeFalsy()
    expect(g.players[0].combattantDiscard?.length).toBe(1)
  })

  it('CHOC_DES_TITANS sans les 2 Pouvoir → pas de choix, Malus direct', () => {
    const deck = [combattant('c1', 1, 4, 'ferveur', 2)]
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, power: 1 } : p)) }
    g = resolveEffect(g, { type: 'CHOC_DES_TITANS', payForBonus: true }, { actorIndex: 0 })
    // 1 Pouvoir < 2 → aucun choix : capture 5 puis Malus Ferveur (−2) = 3.
    expect(g.pendingChocTitans).toBeFalsy()
    expect(g.players[0].spirits).toBe(5 - 2)
    expect(g.players[0].power).toBe(1)
    expect(g.players[0].combattantDiscard?.length).toBe(1)
  })

  it('FATE_DRAW_COMBATTANT (COMBATTANT) : pose un Héros + retire les esprits adverses', () => {
    const deck = [combattant('c1', 3, 1, 'decharge', 2)] // camp adverse (sun) = 3
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, spirits: 5 } : p)) }
    // Fatalité contre le joueur 0 (idx = actor = cible).
    g = resolveEffect(g, { type: 'FATE_DRAW_COMBATTANT', asHero: true }, { actorIndex: 0, playedBy: 1 })
    expect(g.players[0].spirits).toBe(2) // 5 - 3 (sun adverse)
    const pawn = g.players[0].pawnLocation!
    expect((g.players[0].board[pawn] ?? []).some((c) => c.cardId === 'c1' && c.type === 'hero')).toBe(true)
  })

  it('FATE_DRAW_COMBATTANT (Une lueur d\'espoir, asHero=false) : retire les esprits adverses ET défausse le Combattant', () => {
    const deck = [combattant('c1', 3, 1, 'decharge', 2)] // camp adverse (sun) = 3
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, spirits: 5 } : p)) }
    g = resolveEffect(g, { type: 'FATE_DRAW_COMBATTANT', asHero: false }, { actorIndex: 0, playedBy: 1 })
    expect(g.players[0].spirits).toBe(2) // 5 - 3 (sun adverse)
    // Sans pose en Héros, le Combattant pioché part dans la défausse Combattant (visible/recyclé).
    expect(g.players[0].combattantDiscard?.length).toBe(1)
    expect(g.players[0].combattantDiscard?.[0]?.cardId).toBe('c1')
    // Il ne reste plus en Héros sur le plateau.
    const pawn = g.players[0].pawnLocation!
    expect((g.players[0].board[pawn] ?? []).some((c) => c.cardId === 'c1')).toBe(false)
  })

  it('LOSE_SPIRITS_LAST_COMBATTANT both : retire la somme des deux camps du dernier pioché', () => {
    const deck = [combattant('c1', 2, 3, 'decharge', 2)]
    let g = game(deck)
    g = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, spirits: 8 } : p)) }
    // Pioche d'abord un Combattant (met à jour lastCombattantDrawn) via revenu forcé.
    g = place(g, 0, 'loc-3', ally('a', 3)) // conquiert → revenu 1
    g = resolveEffect(g, { type: 'DRAW_COMBATTANT_BONUS' }, { actorIndex: 0 }) // pioche c1 → last = {2,3}
    const before = g.players[0].spirits ?? 0
    g = resolveEffect(g, { type: 'LOSE_SPIRITS_LAST_COMBATTANT', scope: 'both' }, { actorIndex: 0 })
    expect(g.players[0].spirits).toBe(Math.max(0, before - 5))
  })

  it('applyAction (post-action) synchronise le contrôle : la pose bascule la face', () => {
    // Vérifie l'intégration : après une action, syncLocationControlAll flippe le lieu.
    let g = game()
    // Simule une pose d'Allié suffisante via mutation + une action neutre (END_TURN sur l'autre).
    g = place(g, 0, 'loc-3', ally('a', 4))
    // Une action quelconque du joueur 0 déclenche la synchro : contrôlé → face A (main).
    const moved = applyAction(g, { type: 'MOVE', to: 'loc-3' })
    const loc3 = moved.players[0].locations.find((l) => l.id === 'loc-3')!
    expect(loc3.version).toBe('a')
  })
})

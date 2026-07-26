import { describe, it, expect } from 'vitest'
import type { CardInstance, Location, VillainDef } from '../types'
import { createInitialGame, type PlayerSetup } from '../state'
import { applyAction, bestJournalLine } from '../actions'
import { resolveEffect } from '../effects'
import { fillJournal, journalLine, journalLogLine, JOURNAL_TAG_RE } from '../journalTemplate'

/** Dernière ligne de log, corps après le préfixe vilain (pour tester la balise). */
function taggedBody(log: string[]): string {
  const last = log[log.length - 1]
  return last.slice(last.indexOf(' ') + 1)
}

function combattant(name: string, verb: 'ferveur' | 'decharge' = 'ferveur', mag = 0): CardInstance {
  return {
    instanceId: `cb:${name}`,
    cardId: `cb-${name}`,
    name,
    type: 'hero',
    strength: 3,
    spiritSun: 1,
    spiritMoon: 4,
    combattantVerb: verb,
    combattantMagnitude: mag,
  }
}

// --- Helpers purs -----------------------------------------------------------

describe('journalTemplate — substitution pure', () => {
  it('fillJournal remplace les {clé} (accents compris) et laisse les inconnues', () => {
    const ctx = { NbEspritMoi: 4, nomHéros: 'Peter Pan' }
    expect(fillJournal('capture {NbEspritMoi}🌑', ctx)).toBe('capture 4🌑')
    expect(fillJournal('élimine {nomHéros}.', ctx)).toBe('élimine Peter Pan.')
    // Clé absente → laissée telle quelle (repérage à l'œil).
    expect(fillJournal('perd {NbInconnu}🌑', ctx)).toBe('perd {NbInconnu}🌑')
  })

  it('journalLine choisit la bonne issue (ligne) puis remplit', () => {
    const tpl = 'Malus : capture {NbEspritMoi}🌑.\nBonus : capture {NbEspritMoi}🌑, paie 2 JT.'
    expect(journalLine(tpl, { NbEspritMoi: 5 }, 0)).toBe('Malus : capture 5🌑.')
    expect(journalLine(tpl, { NbEspritMoi: 5 }, 1)).toBe('Bonus : capture 5🌑, paie 2 JT.')
    // Index hors bornes → dernière ligne (garde-fou).
    expect(journalLine(tpl, { NbEspritMoi: 5 }, 9)).toBe('Bonus : capture 5🌑, paie 2 JT.')
  })

  it('journalLogLine balise la ligne ; JOURNAL_TAG_RE la re-décode', () => {
    const line = journalLogLine('Sumbra', 'capture 4🌑', 'play-card')
    const body = line.slice('Sumbra '.length) // corps après le préfixe vilain
    const m = JOURNAL_TAG_RE.exec(body)
    expect(m).not.toBeNull()
    expect(m![1]).toBe('play-card') // icône
    expect(m![2]).toBe('capture 4🌑') // texte
  })
})

// --- Intégration : PLAY_CARD d'une carte à template -------------------------

function locations(): Location[] {
  const acts = (id: string) => [
    { id: `${id}-p`, type: 'PLAY_CARD' as const, label: 'Jouer', row: 'top' as const },
  ]
  return [
    { id: 'loc-1', name: 'Home A', actions: acts('a') },
    { id: 'loc-2', name: 'Home B', actions: acts('b') },
  ]
}

function villain(): VillainDef {
  return {
    id: 'custom-jtpl',
    name: 'Testeur',
    locations: locations(),
    objective: { type: 'POWER_THRESHOLD', threshold: 20 },
    objectiveDescription: 'test',
  } as VillainDef
}

/** Partie minimale : joueur 0 = Testeur, une carte à `journal` en main. */
function gameWith(card: CardInstance) {
  const setup: PlayerSetup = {
    villain: villain(),
    deckCards: [card, { instanceId: 'p0:x', cardId: 'x', name: 'x', type: 'ally', strength: 1, cost: 1 }],
    fateCards: [],
  }
  const opp: PlayerSetup = {
    villain: { ...villain(), id: 'custom-jtpl-opp' },
    deckCards: [{ instanceId: 'p1:c', cardId: 'c', name: 'c', type: 'ally', strength: 1, cost: 1 }],
    fateCards: [],
  }
  const g = createInitialGame([setup, opp], 999)
  return {
    ...g,
    activePlayer: 0,
    phase: 'ACTION' as const,
    usedActionIds: [],
    players: g.players.map((p, i) =>
      i === 0 ? { ...p, power: 5, hand: [card], pawnLocation: 'loc-1' } : p,
    ),
  }
}

describe('journalTemplate — émission en partie (PLAY_CARD)', () => {
  it('remplace les lignes codées en dur par le message authoré balisé (placeholders remplis)', () => {
    const card: CardInstance = {
      instanceId: 'p0:pantin',
      cardId: 'pantin',
      name: 'Pantin',
      type: 'ally',
      strength: 1,
      cost: 1,
      journal: 'pose un Pantin et capture {NbEspritMoi}🌑.',
      effects: [{ type: 'CAPTURE_SPIRITS', amount: 2 }],
    }
    const g = gameWith(card)
    const before = g.log.length
    const after = applyAction(g, { type: 'PLAY_CARD', actionId: 'a-p', instanceId: 'p0:pantin', to: 'loc-1' })
    const newLines = after.log.slice(before)
    // Une seule ligne de journal ajoutée par la carte, balisée + placeholder rempli.
    const journaled = newLines.filter((l) => JOURNAL_TAG_RE.test(l.slice(l.indexOf(' ') + 1)))
    expect(journaled.length).toBe(1)
    expect(journaled[0]).toContain('Testeur')
    expect(journaled[0]).toContain('pose un Pantin et capture 2🌑.')
    // La ligne « joue **Pantin** » codée en dur a bien été retirée.
    expect(newLines.some((l) => l.includes('joue **Pantin**'))).toBe(false)
    // L'effet a bien eu lieu (2 esprits capturés).
    expect(after.players[0].spirits).toBe(2)
    // journalVars ne persiste pas.
    expect(after.journalVars).toBeUndefined()
  })

  it('skin camp Lumière : le 🌑 du template devient ☀️ en partie', () => {
    const card: CardInstance = {
      instanceId: 'p0:pantin',
      cardId: 'pantin',
      name: 'Pantin',
      type: 'ally',
      strength: 1,
      cost: 1,
      journal: 'pose un Pantin et capture {NbEspritMoi}🌑.',
      effects: [{ type: 'CAPTURE_SPIRITS', amount: 2 }],
    }
    const g0 = gameWith(card)
    // Camp Lumière (comme Killaire) : objectif SPIRIT_THRESHOLD / sun → campEmoji = ☀️.
    const g = {
      ...g0,
      players: g0.players.map((p, i) =>
        i === 0 ? { ...p, objective: { type: 'SPIRIT_THRESHOLD' as const, threshold: 30, camp: 'sun' as const } } : p,
      ),
    }
    const before = g.log.length
    const after = applyAction(g, { type: 'PLAY_CARD', actionId: 'a-p', instanceId: 'p0:pantin', to: 'loc-1' })
    const tagged = after.log
      .slice(before)
      .map((l) => JOURNAL_TAG_RE.exec(l.slice(l.indexOf(' ') + 1)))
      .find((m): m is RegExpExecArray => m !== null)
    expect(tagged).toBeTruthy()
    expect(tagged![2]).toContain('☀️')
    expect(tagged![2]).not.toContain('🌑')
  })

  it('une carte SANS journal garde son log par défaut', () => {
    const card: CardInstance = {
      instanceId: 'p0:plain',
      cardId: 'plain',
      name: 'Ordinaire',
      type: 'ally',
      strength: 1,
      cost: 1,
    }
    const g = gameWith(card)
    const before = g.log.length
    const after = applyAction(g, { type: 'PLAY_CARD', actionId: 'a-p', instanceId: 'p0:plain', to: 'loc-1' })
    const newLines = after.log.slice(before)
    expect(newLines.some((l) => l.includes('joue **Ordinaire**'))).toBe(true)
    expect(newLines.some((l) => JOURNAL_TAG_RE.test(l.slice(l.indexOf(' ') + 1)))).toBe(false)
  })

  it('Choc des Titans : la résolution émet la bonne issue (Malus=ligne 0, Bonus=ligne 1)', () => {
    const base = gameWith({ instanceId: 'p0:dummy', cardId: 'dummy', name: 'Dummy', type: 'ally', cost: 1 })
    const pending = {
      playerIndex: 0,
      card: combattant('CTitan'),
      spiritsBefore: 5,
      powerBefore: 5,
      capturedSum: 5,
      journal:
        'déclenche le **Choc des Titans**. Capture au total {NbEspritMoi}🌑 et subit le **Malus**.\n' +
        'déclenche le **Choc des Titans**. Capture au total {NbEspritMoi}🌑, paie 2 JT et applique le **Bonus**.',
    }
    const g = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, power: 5, spirits: 5 } : p)), pendingChocTitans: pending }
    const malus = applyAction(g, { type: 'RESOLVE_CHOC_TITANS', pay: false })
    const mm = JOURNAL_TAG_RE.exec(taggedBody(malus.log))
    expect(mm).not.toBeNull()
    expect(mm![2]).toBe('déclenche le **Choc des Titans**. Capture au total 5🌑 et subit le **Malus**.')
    const bonus = applyAction(g, { type: 'RESOLVE_CHOC_TITANS', pay: true })
    const bm = JOURNAL_TAG_RE.exec(taggedBody(bonus.log))
    expect(bm).not.toBeNull()
    expect(bm![2]).toBe('déclenche le **Choc des Titans**. Capture au total 5🌑, paie 2 JT et applique le **Bonus**.')
  })
})

describe('journalTemplate — émission Fatalité (RESOLVE_FATE, perspective cible)', () => {
  it('la Fatalité émet le message du point de vue de la CIBLE ({nomVilain}/{NbEspritMoi})', () => {
    const base = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const fateCard: CardInstance = {
      instanceId: 'fate:lib',
      cardId: 'liberation',
      name: 'Libération',
      type: 'effect',
      journal: 'Libération : {nomVilain} perd {NbEspritMoi}🌑.',
      effects: [{ type: 'LOSE_SPIRITS_LAST_COMBATTANT', scope: 'both' }],
    }
    // Cible = joueur 0 (5 esprits) ; l'adversaire (joueur 1) joue la Fatalité.
    const g = {
      ...base,
      activePlayer: 1,
      lastCombattantDrawn: { sun: 2, moon: 3 },
      players: base.players.map((p, i) => (i === 0 ? { ...p, spirits: 5 } : p)),
      pendingFate: { target: 0, revealed: [fateCard] },
    }
    const before = g.log.length
    const after = applyAction(g, { type: 'RESOLVE_FATE', instanceId: 'fate:lib' })
    // Sumbra (cible) a perdu 5 esprits (2+3).
    expect(after.players[0].spirits).toBe(0)
    // Ligne balisée présente parmi les nouvelles lignes (des lignes de sync peuvent suivre).
    const tagged = after.log
      .slice(before)
      .map((l) => JOURNAL_TAG_RE.exec(l.slice(l.indexOf(' ') + 1)))
      .find((m): m is RegExpExecArray => m !== null)
    expect(tagged).toBeTruthy()
    expect(tagged![1]).toBe('fate') // icône Fatalité
    expect(tagged![2]).toBe('Libération : Testeur perd 5🌑.') // {nomVilain}=cible, {NbEspritMoi}=perte
  })
})

describe('journalTemplate — placeholders génériques via action / effets (Flagelleur)', () => {
  it('{nomLieu} est rempli depuis le lieu de pose (action.to)', () => {
    const card: CardInstance = {
      instanceId: 'p0:froid',
      cardId: 'froid',
      name: 'Froid',
      type: 'item',
      cost: 1,
      journal: 'Froid : les Alliés de {nomLieu} gagnent +1 Force.',
    }
    const g = gameWith(card)
    const before = g.log.length
    const after = applyAction(g, { type: 'PLAY_CARD', actionId: 'a-p', instanceId: 'p0:froid', to: 'loc-1' })
    const tagged = after.log
      .slice(before)
      .map((l) => JOURNAL_TAG_RE.exec(l.slice(l.indexOf(' ') + 1)))
      .find((m): m is RegExpExecArray => m !== null)
    expect(tagged).toBeTruthy()
    expect(tagged![2]).toBe('Froid : les Alliés de Home A gagnent +1 Force.')
  })

  it('FLAYER_PLACE_TUNNEL expose {nbAlliés} (nb d’Alliés défaussés)', () => {
    const g = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const ally = (id: string): CardInstance => ({ instanceId: `ally:${id}`, cardId: id, name: id, type: 'ally', strength: 1 })
    const withAllies = {
      ...g,
      players: g.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'loc-1': [ally('a1'), ally('a2')] } } : p)),
    }
    const after = resolveEffect(
      withAllies,
      { type: 'FLAYER_PLACE_TUNNEL', baseAllies: 2, surchargeHeroCardId: 'onze', tunnelCardId: 'tunnel', rewardAtCount: 3, rewardPower: 3 },
      { actorIndex: 0, allyInstanceIds: ['ally:a1', 'ally:a2'] },
    )
    expect(after.journalVars?.['nbAlliés']).toBe(2)
  })
})

describe('journalTemplate — émission DIFFÉRÉE (choix interactif)', () => {
  it('diffère puis émet {nomCarte} à la résolution du choix (RECOVER_ANY_FROM_DISCARD)', () => {
    const card: CardInstance = {
      instanceId: 'p0:passage',
      cardId: 'passage',
      name: 'Passage',
      type: 'effect',
      cost: 1,
      journal: 'récupère {nomCarte} de sa défausse.',
      effects: [{ type: 'RECOVER_ANY_FROM_DISCARD', label: 'Passage' }],
    }
    const recoverable: CardInstance = { instanceId: 'p0:old', cardId: 'old', name: 'Vieux Sort', type: 'effect', cost: 1 }
    const g0 = gameWith(card)
    const g = { ...g0, players: g0.players.map((p, i) => (i === 0 ? { ...p, discard: [recoverable] } : p)) }
    const isTagged = (l: string) => JOURNAL_TAG_RE.test(l.slice(l.indexOf(' ') + 1))

    // 1) On joue la carte : le choix (pendingRecover) s'ouvre → journal DIFFÉRÉ (aucune ligne).
    const afterPlay = applyAction(g, { type: 'PLAY_CARD', actionId: 'a-p', instanceId: 'p0:passage' })
    expect(afterPlay.pendingRecover).toBeTruthy()
    expect(afterPlay.pendingJournal).toBeTruthy()
    expect(afterPlay.log.some(isTagged)).toBe(false) // rien encore

    // 2) On résout le choix : le message est émis avec {nomCarte} rempli.
    const afterResolve = applyAction(afterPlay, { type: 'RESOLVE_RECOVER', instanceId: 'p0:old' })
    expect(afterResolve.pendingJournal).toBeFalsy()
    const tagged = afterResolve.log
      .map((l) => JOURNAL_TAG_RE.exec(l.slice(l.indexOf(' ') + 1)))
      .find((m): m is RegExpExecArray => m !== null)
    expect(tagged).toBeTruthy()
    expect(tagged![2]).toBe('récupère Vieux Sort de sa défausse.')
  })

  it('Pas de Quartier ! : émet {nomAllié} + {nomLieu} à la résolution du déplacement', () => {
    const card: CardInstance = {
      instanceId: 'p0:pdq',
      cardId: 'pas-de-quartier',
      name: 'Pas de Quartier !',
      type: 'effect',
      cost: 1,
      journal:
        'Pas de Quartier ! : à l’abordage de {nomLieu} pour {nomAllié}, +2 Force.\n' +
        'Pas de Quartier ! : aucun Allié à envoyer à l’abordage.',
      effects: [{ type: 'MOVE_ALLY_BUFF', amount: 2 }],
    }
    const ally: CardInstance = { instanceId: 'a1', cardId: 'a1', name: 'Boucanier', type: 'ally', strength: 2 }
    const g0 = gameWith(card)
    const g = { ...g0, players: g0.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'loc-1': [ally] } } : p)) }
    const afterPlay = applyAction(g, { type: 'PLAY_CARD', actionId: 'a-p', instanceId: 'p0:pdq' })
    expect(afterPlay.pendingAllyMoveBuff).toBeTruthy()
    expect(afterPlay.pendingJournal).toBeTruthy()
    const after = applyAction(afterPlay, { type: 'RESOLVE_ALLY_MOVE_BUFF', instanceId: 'a1', to: 'loc-2' })
    const tagged = JOURNAL_TAG_RE.exec(taggedBody(after.log))
    expect(tagged).not.toBeNull()
    expect(tagged![2]).toBe('Pas de Quartier ! : à l’abordage de Home B pour Boucanier, +2 Force.')
  })

  it('K.O. (Fatalité) : émet {nomAllié} à la résolution du choix de l’adversaire', () => {
    const base = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const ally: CardInstance = { instanceId: 'a1', cardId: 'a1', name: 'Flibustiers', type: 'ally', strength: 2 }
    const fateCard: CardInstance = {
      instanceId: 'fate:ko',
      cardId: 'ko',
      name: 'K.O.',
      type: 'effect',
      journal:
        'K.O. : {nomAllié} hors de combat.\n' +
        'K.O. : aucun Allié de Force 3 ou moins à mettre hors de combat.',
    }
    const g = {
      ...base,
      activePlayer: 1,
      players: base.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'loc-1': [ally] } } : p)),
      pendingFate: { target: 0, revealed: [fateCard] },
    }
    const afterFate = applyAction(g, { type: 'RESOLVE_FATE', instanceId: 'fate:ko' })
    expect(afterFate.pendingFateChoice).toBeTruthy()
    expect(afterFate.pendingJournal).toBeTruthy()
    const after = applyAction(afterFate, { type: 'RESOLVE_FATE_CHOICE', instanceId: 'a1' })
    const tagged = after.log
      .map((l) => JOURNAL_TAG_RE.exec(l.slice(l.indexOf(' ') + 1)))
      .find((m): m is RegExpExecArray => m !== null)
    expect(tagged).toBeTruthy()
    expect(tagged![1]).toBe('fate')
    expect(tagged![2]).toBe('K.O. : Flibustiers hors de combat.')
    expect(after.players[0].discard.some((c) => c.instanceId === 'a1')).toBe(true)
  })
})

describe('journalTemplate — effets qui exposent des noms (journalVars)', () => {
  it('DRAW_COMBATTANT_BONUS expose {nomCombattant}', () => {
    const g = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const withDeck = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, combattantDeck: [combattant('Kirby')] } : p)) }
    const after = resolveEffect(withDeck, { type: 'DRAW_COMBATTANT_BONUS' }, { actorIndex: 0 })
    expect(after.journalVars?.['nomCombattant']).toBe('Kirby')
  })

  it('REVEAL_UNTIL_ALLY_PLAY_FREE expose {nomAllié}', () => {
    const g = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const ally: CardInstance = { instanceId: 'p0:al', cardId: 'al', name: 'Marie', type: 'ally', strength: 2 }
    const withDeck = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, deck: [ally], discard: [] } : p)) }
    const after = resolveEffect(withDeck, { type: 'REVEAL_UNTIL_ALLY_PLAY_FREE' }, { actorIndex: 0 })
    expect(after.journalVars?.['nomAllié']).toBe('Marie')
  })

  // --- Prince Jean : cibles interactives exposées sur des Effect PARTAGÉS -----
  it('MOVE_HERO_TO_LOCATION expose {nomHéros} (Emprisonnement)', () => {
    const g = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const hero: CardInstance = { instanceId: 'h1', cardId: 'h1', name: 'Robin des Bois', type: 'hero', strength: 3 }
    const withHero = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'loc-1': [hero] } } : p)) }
    const after = resolveEffect(withHero, { type: 'MOVE_HERO_TO_LOCATION', locationId: 'loc-2' }, { actorIndex: 0, targetHeroId: 'h1' })
    expect(after.journalVars?.['nomHéros']).toBe('Robin des Bois')
  })

  it('VANQUISH_HERO expose {nomHéros} (Intimidation, Tendre un Piège)', () => {
    const g = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const hero: CardInstance = { instanceId: 'h1', cardId: 'h1', name: 'Petit Jean', type: 'hero', strength: 1 }
    const ally: CardInstance = { instanceId: 'a1', cardId: 'a1', name: 'Pendard', type: 'ally', strength: 3 }
    const withBoard = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'loc-1': [hero, ally] } } : p)) }
    const after = resolveEffect(withBoard, { type: 'VANQUISH_HERO', keepAllies: true }, { actorIndex: 0, targetHeroId: 'h1', allyInstanceIds: ['a1'] })
    expect(after.journalVars?.['nomHéros']).toBe('Petit Jean')
  })

  it('MOVE_ALLY_FREELY expose {nomAllié} (Tendre un Piège)', () => {
    const g = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const ally: CardInstance = { instanceId: 'a1', cardId: 'a1', name: 'Shérif de Nottingham', type: 'ally', strength: 3 }
    const withBoard = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'loc-1': [ally] } } : p)) }
    const after = resolveEffect(withBoard, { type: 'MOVE_ALLY_FREELY' }, { actorIndex: 0, allyMove: { instanceId: 'a1', to: 'loc-2' } })
    expect(after.journalVars?.['nomAllié']).toBe('Shérif de Nottingham')
  })

  // --- Boîte de base (Maléfique / Jafar / Ursula / Reine de Cœur / Crochet) ----
  it('INSTANT_VANQUISH_HERO_LE expose {nomHéros} (Méchanceté, Qu’on leur coupe la tête !)', () => {
    const g = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const hero: CardInstance = { instanceId: 'h1', cardId: 'h1', name: 'Le Chafouin', type: 'hero', strength: 3 }
    const withHero = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'loc-1': [hero] } } : p)) }
    const after = resolveEffect(withHero, { type: 'INSTANT_VANQUISH_HERO_LE', maxStrength: 4 }, { actorIndex: 0, targetHeroId: 'h1' })
    expect(after.journalVars?.['nomHéros']).toBe('Le Chafouin')
  })

  it('DISCARD_OWN_FOR_POWER expose {nomAllié}/{nomObjet} (Sacrifice Nécessaire)', () => {
    const g = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const ally: CardInstance = { instanceId: 'a1', cardId: 'a1', name: 'Garde du Palais', type: 'ally', strength: 2 }
    const item: CardInstance = { instanceId: 'i1', cardId: 'i1', name: 'Cimeterre', type: 'item' }
    const withBoard = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, board: { ...p.board, 'loc-1': [ally, item] } } : p)) }
    const viaAlly = resolveEffect(withBoard, { type: 'DISCARD_OWN_FOR_POWER', amount: 3 }, { actorIndex: 0, allyInstanceIds: ['a1'] })
    expect(viaAlly.journalVars?.['nomAllié']).toBe('Garde du Palais')
    const viaItem = resolveEffect(withBoard, { type: 'DISCARD_OWN_FOR_POWER', amount: 3 }, { actorIndex: 0, allyInstanceIds: ['i1'] })
    expect(viaItem.journalVars?.['nomObjet']).toBe('Cimeterre')
  })

  it('LOSE_POWER_TO_HOST expose {nomHéros} quand l’hôte est un Héros (Voler aux Riches)', () => {
    const g = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 })
    const hero: CardInstance = { instanceId: 'h1', cardId: 'h1', name: 'Robin des Bois', type: 'hero', strength: 3 }
    const withBoard = { ...g, players: g.players.map((p, i) => (i === 0 ? { ...p, power: 5, board: { ...p.board, 'loc-1': [hero] } } : p)) }
    const after = resolveEffect(withBoard, { type: 'LOSE_POWER_TO_HOST', amount: 4 }, { actorIndex: 0, hostInstanceId: 'h1' })
    expect(after.journalVars?.['nomHéros']).toBe('Robin des Bois')
    expect(after.players[0].power).toBe(1)
  })
})

// --- Repli multi-ligne (cible FACULTATIVE non résolue → ligne alternative) ---
describe('journalTemplate — bestJournalLine (repli de ligne)', () => {
  const player = gameWith({ instanceId: 'p0:d', cardId: 'd', name: 'd', type: 'ally', cost: 1 }).players[0]
  const tpl =
    'Tendre un Piège : {nomAllié} se déplace, puis {nomHéros} est éliminé.\n' +
    'Tendre un Piège : {nomAllié} se déplace et tend un piège.'

  it('ligne 0 si tous ses placeholders sont résolus', () => {
    const out = bestJournalLine(tpl, { nomAllié: 'Pendard', nomHéros: 'Robin des Bois' }, player)
    expect(out).toBe('Tendre un Piège : Pendard se déplace, puis Robin des Bois est éliminé.')
  })

  it('repli sur la ligne suivante entièrement remplie si la ligne 0 a un {clé} non résolu', () => {
    // Élimination facultative NON effectuée : {nomHéros} manque → ligne de repli.
    const out = bestJournalLine(tpl, { nomAllié: 'Pendard' }, player)
    expect(out).toBe('Tendre un Piège : Pendard se déplace et tend un piège.')
  })

  it('dernier recours : ligne 0 littérale si aucune ligne ne se remplit', () => {
    const out = bestJournalLine('élimine {nomHéros}.', {}, player)
    expect(out).toBe('élimine {nomHéros}.')
  })
})

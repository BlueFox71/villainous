// Intégrité des messages de Journal (champ `journal` des CardDef natives).
//
// Un template ne doit utiliser que des placeholders CONNUS : une clé inconnue est
// laissée littérale au rendu (`{clé}` visible en partie). Ce test couvre
// automatiquement tout vilain ajouté à `allCards` (cf. docs/JOURNAL_REFONTE.md, §4).

import { describe, it, expect } from 'vitest'
import { allCards } from '../registry'

/** Catalogue des placeholders câblés (génériques, action, journalVars). */
const KNOWN_KEYS = new Set([
  // Génériques (aucun câblage)
  'NbJT',
  'NbEspritMoi',
  'NbEspritAdv',
  'nomVilain',
  'nomAdv',
  // Via l'action (lieu de pose, Héros ciblé)
  'nomLieu',
  'nomHéros',
  // Via journalVars exposés par les effets / résolutions de pending
  'nomAllié',
  'nomObjet',
  'nomCarte',
  'nomCombattant',
  'nomCible',
  'nbAlliés',
])

const journaled = allCards.filter((c) => !!c.journal)

describe('Journal — placeholders des cartes natives', () => {
  it('n’utilise que des placeholders du catalogue', () => {
    const unknown: string[] = []
    for (const card of journaled) {
      for (const m of card.journal!.matchAll(/\{([^{}]+)\}/g)) {
        if (!KNOWN_KEYS.has(m[1].trim())) unknown.push(`${card.id} → {${m[1]}}`)
      }
    }
    expect(unknown).toEqual([])
  })

  it('aucun message vide, ni « (s) » / « (x) » de pluriel, ni ☀️/🌑 codé par vilain', () => {
    const bad: string[] = []
    for (const card of journaled) {
      for (const line of card.journal!.split('\n')) {
        const t = line.trim()
        if (!t) bad.push(`${card.id} → ligne vide`)
        if (/\((s|x)\)/.test(t)) bad.push(`${card.id} → pluriel « (s) »`)
        if (t.includes('☀️')) bad.push(`${card.id} → ☀️ codé en dur (écrire 🌑)`)
      }
    }
    expect(bad).toEqual([])
  })

  it('couvre entièrement les vilains refaits (Prince Jean + boîte de base)', () => {
    // Toutes les cartes de ces fichiers portent un `journal` : si une carte est ajoutée
    // plus tard sans message, ce test la signale.
    const prefixes = [
      '/cards/prince-jean/',
      '/cards/maleficent/',
      '/cards/jafar/',
      '/cards/ursula/',
      '/cards/reine-coeur/',
      '/cards/crochet/',
      '/cards/mechante-reine/',
      '/cards/facilier/',
      '/cards/hades/',
      '/cards/scar/',
      '/cards/yzma/',
      '/cards/ratigan/',
      '/cards/cruella/',
      '/cards/gothel/',
      '/cards/pat-hibulaire/',
      '/cards/syndrome/',
      '/cards/lotso/',
      '/cards/sa-sucrerie/',
      '/cards/madame-mim/',
      '/cards/madame-tremaine/',
      '/cards/shere-khan/',
      '/cards/oogie-boogie/',
      '/cards/davy-jones/',
      '/cards/tamatoa/',
    ]
    // Cartes dont l'effet n'est pas (encore) implémenté par le moteur : elles gardent
    // volontairement leur log par défaut plutôt que d'annoncer un effet qui n'a pas lieu.
    // + `raiponce` : Héros-TUILE (copies 0), posée à la mise en place et jamais « jouée »
    // depuis un deck — aucun message de Journal ne pourrait être émis pour elle.
    const EXEMPT = new Set(['pouvoir-sorcier', 'sauvetage', 'proces', 'crise-hysterie', 'raiponce'])
    const missing = allCards
      .filter((c) => prefixes.some((p) => (c.image ?? '').startsWith(p)))
      .filter((c) => !c.journal && !EXEMPT.has(c.id))
      .map((c) => c.id)
    expect(missing).toEqual([])
  })
})

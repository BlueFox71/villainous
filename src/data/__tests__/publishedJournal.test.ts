// Intégrité des messages de Journal des vilains de l'ATELIER publiés
// (`botStrategy.journal` : villainNotes / fateNotes[].description).
//
// Mêmes règles que pour les vilains natifs (cf. journalPlaceholders.test.ts et
// docs/JOURNAL_REFONTE.md) + un garde-fou propre aux customs : une note dont la clé ne
// correspond à AUCUNE carte est morte — c'est le piège des SKINS, dont les ids de cartes
// portent un suffixe (`<id base>--<id skin>`).

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const PUB = resolve(__dirname, '../published')
const files = readdirSync(PUB).filter((f) => f.endsWith('.json') && f.startsWith('custom-'))

/** Placeholders câblés (mêmes clés que pour les natifs). */
const KNOWN_KEYS = new Set([
  'NbJT',
  'NbEspritMoi',
  'NbEspritAdv',
  'nomVilain',
  'nomAdv',
  'nomLieu',
  'nomHéros',
  'nomAllié',
  'nomObjet',
  'nomCarte',
  'nomCombattant',
  'nomCible',
  'nbAlliés',
])

type Card = { id: string; deck?: string }
type Villain = {
  cards?: Card[]
  botStrategy?: {
    journal?: {
      villainNotes?: Record<string, string>
      fateNotes?: Record<string, { description?: string }>
    }
  }
}

/** Toutes les notes d'un vilain, aplaties en { cardId, message }. */
function notesOf(v: Villain): { cardId: string; msg: string }[] {
  const j = v.botStrategy?.journal ?? {}
  return [
    ...Object.entries(j.villainNotes ?? {}).map(([cardId, msg]) => ({ cardId, msg })),
    ...Object.entries(j.fateNotes ?? {}).map(([cardId, n]) => ({ cardId, msg: n?.description ?? '' })),
  ].filter((n) => n.msg.trim())
}

describe('Journal — vilains publiés de l’Atelier', () => {
  for (const f of files) {
    const v: Villain = JSON.parse(readFileSync(resolve(PUB, f), 'utf8'))
    const ids = new Set((v.cards ?? []).map((c) => c.id))
    const notes = notesOf(v)
    if (notes.length === 0) continue // vilain sans journal (opt-in strict) : rien à vérifier

    it(`${f} : chaque note correspond à une carte existante`, () => {
      expect(notes.filter((n) => !ids.has(n.cardId)).map((n) => n.cardId)).toEqual([])
    })

    it(`${f} : n’utilise que des placeholders du catalogue`, () => {
      const unknown: string[] = []
      for (const n of notes) {
        for (const m of n.msg.matchAll(/\{([^{}]+)\}/g)) {
          if (!KNOWN_KEYS.has(m[1].trim())) unknown.push(`${n.cardId} → {${m[1]}}`)
        }
      }
      expect(unknown).toEqual([])
    })

    it(`${f} : pas de « (s) » / « (x) » de pluriel, ni ☀️ codé en dur`, () => {
      const bad: string[] = []
      for (const n of notes) {
        if (/\((s|x|e)\)/.test(n.msg)) bad.push(`${n.cardId} → accord entre parenthèses`)
        if (n.msg.includes('☀️')) bad.push(`${n.cardId} → ☀️ codé en dur (écrire 🌑)`)
      }
      expect(bad).toEqual([])
    })
  }
})

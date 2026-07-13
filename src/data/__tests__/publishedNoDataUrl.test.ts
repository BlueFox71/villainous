import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const PUB = resolve(__dirname, '../published')
const PUBLIC = resolve(__dirname, '../../../public')
const files = readdirSync(PUB).filter((f) => f.endsWith('.json') && f.startsWith('custom-'))

describe('JSON publiés : images en fichiers (aucune data-URL)', () => {
  for (const f of files) {
    it(`${f} ne contient aucune data-URL`, () => {
      const raw = readFileSync(resolve(PUB, f), 'utf8')
      expect(raw.includes('data:image')).toBe(false)
      expect(raw.includes('data:audio')).toBe(false)
    })
    it(`${f} : chaque chemin /cards/… référencé existe sous public/`, () => {
      const v = JSON.parse(readFileSync(resolve(PUB, f), 'utf8'))
      const paths = new Set()
      const walk = (o: unknown) => {
        if (typeof o === 'string') { const m = /^\/cards\/[^?]+/.exec(o); if (m) paths.add(m[0]); return }
        if (Array.isArray(o)) return o.forEach(walk)
        if (o && typeof o === 'object') return Object.values(o).forEach(walk)
      }
      walk(v)
      for (const p of paths) expect(existsSync(resolve(PUBLIC, (p as string).slice(1)))).toBe(true)
    })
  }
})

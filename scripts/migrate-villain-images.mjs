// One-shot idempotent : externalise les images des vilains custom (publiés + brouillons)
// vers public/cards/custom-<id>/, réécrit les JSON en chemins, et supprime le dossier
// light/ devenu inutile. Bump updatedAt pour que la version « chemins » supplante toute
// copie IndexedDB base64 (pickFreshestVillains garde la plus récente).
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { externalizeVillainImages } from '../src/data/published/imageExternalize.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(ROOT, 'public')
const DIRS = [resolve(ROOT, 'src/data/published'), resolve(ROOT, 'src/data/drafts')]
const NOW = new Date().toISOString()

function writeFiles(files) {
  for (const f of files) {
    const dest = resolve(PUBLIC, f.path)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, Buffer.from(f.base64, 'base64'))
  }
}

for (const dir of DIRS) {
  if (!existsSync(dir)) continue
  for (const name of readdirSync(dir)) {
    if (!name.startsWith('custom-') || !name.endsWith('.json')) continue
    const path = resolve(dir, name)
    const v = JSON.parse(readFileSync(path, 'utf8'))
    v.updatedAt = NOW // bump : supplante l'IndexedDB base64
    const { villain, files } = externalizeVillainImages(v)
    writeFiles(files)
    writeFileSync(path, JSON.stringify(villain, null, 2))
    console.log(`${dir.split(/[\\/]/).pop()}/${name} : ${files.length} images écrites`)
  }
}

const LIGHT = resolve(ROOT, 'src/data/published/light')
if (existsSync(LIGHT)) { rmSync(LIGHT, { recursive: true, force: true }); console.log('light/ supprimé') }
console.log('Migration terminée.')

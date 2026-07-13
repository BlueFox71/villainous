// Jetable : met à jour le PION de vilains PUBLIÉS (Atelier) — détoure la photo de figurine
// (fond sombre non uni) via IA, recadre/redimensionne, écrit le PNG en FICHIER
// public/cards/<id>/pawn.png et pointe `pawnImage` dessus (chemin versionné, PAS de dataURL,
// cf. test publishedNoDataUrl). Met à jour published + drafts (+ bump updatedAt).
import { removeBackground } from '@imgly/background-removal-node'
import { Jimp } from 'jimp'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'

const TARGET_H = 480
const JOBS = [
  { id: 'custom-dio', src: 'assets/pions/Dio Brando.png' },
  { id: 'custom-gul-dan', src: "assets/pions/Gul'dan.png" },
]

async function detourToPng(src, outPath) {
  const blob = new Blob([readFileSync(src)], { type: 'image/png' })
  const cut = Buffer.from(await (await removeBackground(blob)).arrayBuffer())
  const img = await Jimp.read(cut)
  const { width: W, height: H, data: d } = img.bitmap
  let minX = W, minY = H, maxX = 0, maxY = 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4 + 3] > 24) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  const pad = 4
  const x = Math.max(0, minX - pad)
  const y = Math.max(0, minY - pad)
  const w = Math.min(W - x, maxX - minX + 1 + 2 * pad)
  const h = Math.min(H - y, maxY - minY + 1 + 2 * pad)
  img.crop({ x, y, w, h })
  img.resize({ h: TARGET_H })
  writeFileSync(outPath, await img.getBuffer('image/png'))
  return `${img.bitmap.width}x${img.bitmap.height}`
}

function patchJson(path, pawnPath, now) {
  if (!existsSync(path)) return false
  const raw = readFileSync(path, 'utf8')
  const pretty = raw.includes('\n  "')
  const j = JSON.parse(raw)
  j.pawnImage = pawnPath
  j.updatedAt = now
  writeFileSync(path, JSON.stringify(j, null, pretty ? 2 : undefined))
  return true
}

const now = new Date().toISOString()
const ver = Date.now()
for (const job of JOBS) {
  const dir = `public/cards/${job.id}`
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const dims = await detourToPng(job.src, `${dir}/pawn.png`)
  const pawnPath = `/cards/${job.id}/pawn.png?v=${ver}`
  const p1 = patchJson(`src/data/published/${job.id}.json`, pawnPath, now)
  const p2 = patchJson(`src/data/drafts/${job.id}.json`, pawnPath, now)
  console.log(`${job.id}: pion ${dims} → ${dir}/pawn.png | pawnImage=${pawnPath} | published:${p1} drafts:${p2}`)
}

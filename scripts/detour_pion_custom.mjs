// Jetable : met à jour le PION (pawnImage) de vilains PUBLIÉS (Atelier) — détoure la photo
// de figurine (fond sombre non uni) via IA, recadre/redimensionne, ré-encode en dataURL PNG
// et l'écrit dans src/data/published/<id>.json ET src/data/drafts/<id>.json (+ bump updatedAt
// pour que le chargement reprenne la nouvelle version malgré l'IndexedDB local).
import { removeBackground } from '@imgly/background-removal-node'
import { Jimp } from 'jimp'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const TARGET_H = 480
const JOBS = [
  { id: 'custom-dio', src: 'assets/pions/Dio Brando.png' },
  { id: 'custom-gul-dan', src: "assets/pions/Gul'dan.png" },
]

async function detourToDataUrl(src) {
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
  const buf = await img.getBuffer('image/png')
  return { dataUrl: `data:image/png;base64,${buf.toString('base64')}`, dims: `${img.bitmap.width}x${img.bitmap.height}`, ko: (buf.length / 1024) | 0 }
}

function patchJson(path, dataUrl, now) {
  if (!existsSync(path)) return false
  const raw = readFileSync(path, 'utf8')
  const pretty = raw.includes('\n  "')
  const j = JSON.parse(raw)
  j.pawnImage = dataUrl
  j.updatedAt = now
  writeFileSync(path, JSON.stringify(j, null, pretty ? 2 : undefined))
  return true
}

const now = new Date().toISOString()
for (const job of JOBS) {
  const { dataUrl, dims, ko } = await detourToDataUrl(job.src)
  const p1 = patchJson(`src/data/published/${job.id}.json`, dataUrl, now)
  const p2 = patchJson(`src/data/drafts/${job.id}.json`, dataUrl, now)
  console.log(`${job.id}: pion ${dims} ${ko}Ko → published:${p1} drafts:${p2} (updatedAt=${now})`)
}

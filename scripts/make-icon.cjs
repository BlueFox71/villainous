// Génère electron/icon.ico (multi-résolutions) à partir d'une image source PNG.
// Le sujet est rogné de ses bords transparents puis recadré en carré « plein
// cadre » (fit cover) afin d'occuper toute la case — même taille visuelle que
// les icônes carrées des autres apps (Chrome, Steam…).
//
// Format des entrées : BMP non compressé (DIB 32 bits BGRA) pour les petites
// tailles (≤128), PNG compressé pour 256. C'est la convention Windows : les
// petites entrées PNG sont mal rendues par certains chemins du shell, alors que
// le BMP est universellement supporté.
const sharp = require('sharp')
const fs = require('node:fs')
const path = require('node:path')

const SRC = path.join(__dirname, '..', 'assets', 'Image exé.png')
const OUT = path.join(__dirname, '..', 'electron', 'icon.ico')
const SIZES = [16, 24, 32, 48, 64, 128, 256]
// Au-delà de cette taille, on stocke en PNG (sinon le .ico devient énorme).
const PNG_FROM = 256

/** Construit une entrée BMP/DIB (BITMAPINFOHEADER + pixels BGRA bottom-up + masque AND). */
function buildBmp(rawRGBA, w, h) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0) // biSize
  header.writeInt32LE(w, 4) // biWidth
  header.writeInt32LE(h * 2, 8) // biHeight (×2 : image XOR + masque AND)
  header.writeUInt16LE(1, 12) // biPlanes
  header.writeUInt16LE(32, 14) // biBitCount
  header.writeUInt32LE(0, 16) // biCompression = BI_RGB

  // Pixels 32 bits BGRA, lignes de bas en haut.
  const xor = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4
    const dst = y * w * 4
    for (let x = 0; x < w; x++) {
      const s = src + x * 4
      const d = dst + x * 4
      xor[d] = rawRGBA[s + 2] // B
      xor[d + 1] = rawRGBA[s + 1] // G
      xor[d + 2] = rawRGBA[s] // R
      xor[d + 3] = rawRGBA[s + 3] // A
    }
  }

  // Masque AND : 1 bit/pixel, lignes alignées sur 4 octets. Transparence portée
  // par le canal alpha → masque entièrement à zéro.
  const andRow = Math.ceil(w / 32) * 4
  const andMask = Buffer.alloc(andRow * h)

  return Buffer.concat([header, xor, andMask])
}

async function main() {
  // 1) Rogne les bords transparents autour du masque.
  const trimmed = await sharp(SRC).trim().png().toBuffer()

  // 2) Cale le masque ENTIER dans le carré (fit contain) : aucun rognage, le
  //    cadre doré reste complet en haut et en bas. L'image étant portrait, il
  //    reste un petit jeu transparent sur les côtés — c'est le plus grand
  //    possible sans rien couper.
  const squared = await sharp(trimmed)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  // 3) Une image par taille, au bon format.
  const images = await Promise.all(
    SIZES.map(async (s) => {
      if (s >= PNG_FROM) {
        return { size: s, data: await sharp(squared).resize(s, s).png({ compressionLevel: 9 }).toBuffer() }
      }
      const raw = await sharp(squared).resize(s, s).raw().ensureAlpha().toBuffer()
      return { size: s, data: buildBmp(raw, s, s) }
    }),
  )

  // 4) Assemble l'ICO : ICONDIR (6 o) + ICONDIRENTRY (16 o) ×N + données.
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // type icône
  header.writeUInt16LE(images.length, 4)

  const entries = Buffer.alloc(16 * images.length)
  let offset = 6 + 16 * images.length
  images.forEach((img, i) => {
    const s = img.size
    const e = i * 16
    entries.writeUInt8(s >= 256 ? 0 : s, e + 0) // largeur (0 = 256)
    entries.writeUInt8(s >= 256 ? 0 : s, e + 1) // hauteur
    entries.writeUInt8(0, e + 2) // palette
    entries.writeUInt8(0, e + 3) // réservé
    entries.writeUInt16LE(1, e + 4) // plans
    entries.writeUInt16LE(32, e + 6) // bits/pixel
    entries.writeUInt32LE(img.data.length, e + 8)
    entries.writeUInt32LE(offset, e + 12)
    offset += img.data.length
  })

  fs.writeFileSync(OUT, Buffer.concat([header, entries, ...images.map((i) => i.data)]))
  console.log('Écrit', OUT, '—', images.length, 'tailles, total', fs.statSync(OUT).size, 'octets')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

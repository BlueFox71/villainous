// Jetable : jeton Fatalité (assets/jeton_fatality.jpg, en fait un WebP) → PNG
// NET rogné EN ROND, servi depuis public/jeton_fatality.png (remplace l'icône
// 🦸 du recouvrement Héros). sharp décode le WebP (jimp ne sait pas).
import sharp from 'sharp'

const SIZE = 256 // PNG haute résolution → net même affiché petit
const src = 'assets/jeton_fatality.jpg'
const meta = await sharp(src).metadata()

// Carré centré sur la plus petite dimension (cadre le jeton).
const side = Math.min(meta.width, meta.height)
const left = Math.round((meta.width - side) / 2)
const top = Math.round((meta.height - side) / 2)

// Masque circulaire (SVG) composé en `dest-in` : ne garde que le disque.
const circle = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="#fff"/></svg>`,
)

await sharp(src)
  .extract({ left, top, width: side, height: side })
  .resize(SIZE, SIZE, { fit: 'cover' })
  .composite([{ input: circle, blend: 'dest-in' }])
  .png()
  .toFile('public/jeton_fatality.png')

console.log(`${meta.width}x${meta.height} → carré ${side} centré → public/jeton_fatality.png (${SIZE}px, rond)`)

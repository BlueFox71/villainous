import { Jimp } from 'jimp'
import { readdirSync, mkdirSync } from 'node:fs'
const DIR = 'assets/decks/matériel/'
const OUT = '_crops/mat/'
mkdirSync(OUT, { recursive: true })
const files = readdirSync(DIR).filter(f=>/\.(png|jpg)$/i.test(f)).sort()
let i=0; const man=[]
for (const f of files){
  const img = await Jimp.read(DIR+f)
  const W=img.bitmap.width,H=img.bitmap.height
  const id=String(++i).padStart(2,'0')
  if (W>420) img.resize({w:420,h:Math.round(H*420/W)})
  await img.write(`${OUT}m${id}.png`)
  man.push(`m${id} ${W}x${H} ${f}`)
}
console.log(man.join('\n'))

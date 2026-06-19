import sharp from 'sharp'
// 1) Découpe le pion central (Pat Hibulaire) de pions 4.jpg (365x205, 3 pions).
const src = sharp('assets/pions 4.jpg')
const left = 123, width = 110
const region = await src.extract({ left, top: 0, width, height: 205 })
  .resize({ width: width*4, height: 205*4, kernel: 'lanczos3' }) // upscale net
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const { data, info } = region
const W = info.width, H = info.height, ch = info.channels
// 2) Flood-fill depuis les bords : ne rend transparent que le BLANC extérieur
//    connecté au bord (préserve les reflets clairs internes de la figurine).
const near = (i) => data[i] > 218 && data[i+1] > 218 && data[i+2] > 218
const seen = new Uint8Array(W*H)
const stack = []
for (let x=0;x<W;x++){ stack.push([x,0],[x,H-1]) }
for (let y=0;y<H;y++){ stack.push([0,y],[W-1,y]) }
while (stack.length){
  const [x,y] = stack.pop()
  if (x<0||y<0||x>=W||y>=H) continue
  const p = y*W+x
  if (seen[p]) continue
  const i = p*ch
  if (!near(i)) continue
  seen[p]=1; data[i+3]=0
  stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1])
}
await sharp(data,{raw:{width:W,height:H,channels:ch}}).png()
  .trim().toFile('public/pion_pat-hibulaire.png')
const m = await sharp('public/pion_pat-hibulaire.png').metadata()
console.log('pion OK', m.width+'x'+m.height)

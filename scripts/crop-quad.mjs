import { Jimp } from 'jimp'
const OUT = '_crops/'
for (let i=0;i<4;i++){
  const img = await Jimp.read(`${OUT}loc${i}.png`)
  const W = img.bitmap.width, H = img.bitmap.height
  // icons sit roughly: top row y 0.04-0.20, bottom row y 0.62-0.82; left x 0.08-0.45, right x 0.52-0.9
  const quads = {
    tl:[0.06,0.03,0.45,0.22], tr:[0.52,0.03,0.45,0.22],
    bl:[0.06,0.60,0.45,0.24], br:[0.52,0.60,0.45,0.24],
  }
  for (const [k,[fx,fy,fw,fh]] of Object.entries(quads)){
    const x=Math.round(W*fx), y=Math.round(H*fy)
    const w=Math.min(Math.round(W*fw), W-x-1), h=Math.min(Math.round(H*fh), H-y-1)
    const c = img.clone().crop({x,y,w,h}); c.resize({w:w*3,h:h*3})
    await c.write(`${OUT}q${i}_${k}.png`)
  }
}
console.log('done')

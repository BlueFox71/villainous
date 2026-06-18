import sharp from 'sharp'
import { readdirSync, mkdirSync } from 'node:fs'
const SRC = 'assets/decks/Pat Hibulaire/'
const OUT = 'public/cards/pat-hibulaire/'
mkdirSync(OUT, { recursive: true })

// Faces de cartes : index (ordre trié, = cNN) -> slug. null = ignorer.
const MAP = {
  3:'hors-la-loi', 5:'planques', 6:'assomme-betement', 7:'donald', 8:'clarabelle',
  9:'horace', 10:'mickey', 11:'oswald', 12:'dingo', 13:'minnie', 14:'pluto',
  15:'epuise', 16:'bandit', 18:'une-petite-partie', 19:'affront', 20:'sournois',
  21:'perroquet', 22:'cheval', 23:'mauvais-coup', 24:'steamboat-willie', 25:'magot',
  26:'vieux-tacot', 27:'cargaison-volee', 28:'grillon', 29:'attaque-aerienne',
  30:'goal-jackpot', 31:'goal-signe-richesse', 32:'goal-bande-puissante',
  33:'goal-main-basse', 34:'goal-soif-pouvoir',
}
const files = readdirSync(SRC).filter(f=>f.endsWith('.png')).sort()
let n=0
for (let i=0;i<files.length;i++){
  const slug = MAP[i+1]
  if (!slug) continue
  await sharp(SRC+files[i]).png().toFile(OUT+slug+'.png'); n++
}

// Images officielles du wiki (WebP) -> PNG
const W='_crops/wiki/'
await sharp(W+'Pete_Villain_Back.png').png().toFile(OUT+'back-villain.png')
await sharp(W+'Pete_Fate_Back.png').png().toFile(OUT+'back-fate.png')
await sharp(W+'Goal_Token_Back.png').png().toFile(OUT+'goal-back.png')
await sharp(W+'Peterealm.jpg').png().toFile(OUT+'board.png')
await sharp(W+'Petemover.png').png().toFile('public/pion_pat-hibulaire.png')
await sharp(W+'Pete.png').png().toFile('public/pat-hibulaire.png')
console.log('faces converties:', n, '+ 4 backs/board + pion + portrait')

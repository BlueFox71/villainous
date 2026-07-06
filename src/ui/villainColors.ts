/** Couleur thématique d'un vilain (présentation pure), par id de vilain.
 *  Utilisée pour le masque de recouvrement et le fond des cases du méchant. */
export const VILLAIN_COLOR: Record<string, string> = {
  princeJohn: '#66442B',
  maleficent: '#2C3E32',
  jafar: '#1A1A1A',
  reineCoeur: '#792225',
  crochet: '#4E2727',
  slenderman: '#1A1F2E',
  ursula: '#3D2235',
  hades: '#226077',
  facilier: '#822364',
  imposteur: '#222222',
  bowser: '#5C1F00',
  tabbou: '#40325C',
  'mechante-reine': '#4E3463',
  scar: '#874B39',
  yzma: '#7B3772',
  ratigan: '#555354',
  patHibulaire: '#353535',
  sombra: '#4C436D',
  gothel: '#564A3B',
  cruella: '#AA1D2E',
  gaston: '#7D3D00',
  'seigneur-cles': '#303030',
  'madame-tremaine': '#48545F',
  'oogie-boogie': '#767E50',
  oogieBoogie: '#767E50',
  'seigneur-tenebres': '#683C2F',
  'madame-mim': '#695E7C',
  syndrome: '#A9571C',
  lotso: '#703F65',
  'sa-sucrerie': '#973A54',
  saSucrerie: '#973A54',
  'shere-khan': '#555C28',
  shereKhan: '#555C28',
  'davy-jones': '#1E3836',
  davyJones: '#1E3836',
  tamatoa: '#47457F',
  'team-rocket': '#9D2B3A',
  teamRocket: '#9D2B3A',
  'la-bonne-fee': '#3F5A86',
  laBonneFee: '#3F5A86',
}

/** Teintes de repli (camp joueur / adversaire) quand la couleur d'un vilain est
 *  inconnue ou pas encore choisie. */
export const DEFAULT_TINT_A = '#3a2d6b'
export const DEFAULT_TINT_B = '#6b2d3a'

/** Fond « teinté par les vilains » : chaque coin prend la couleur (éclaircie, car
 *  les teintes vilains sont sombres) d'un camp sur une base sombre. Partagé par la
 *  page de partie (`App`) et le choix des vilains (`VillainSelect`). */
export function villainsBackground(colorA: string, colorB: string): string {
  return (
    `radial-gradient(130% 100% at 6% -8%, color-mix(in srgb, ${colorA}, white 30%) 0%, rgba(0,0,0,0) 56%), ` +
    `radial-gradient(130% 100% at 94% 108%, color-mix(in srgb, ${colorB}, white 30%) 0%, rgba(0,0,0,0) 56%), ` +
    `linear-gradient(160deg, #16121f 0%, #0a0814 100%)`
  )
}

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
  thanos: '#4A2A6A',
  // Le Flagelleur Mental (custom-flagelleur-mental) et Le Seigneur des clés
  // (custom-seigneur-cles) : couleur enregistrée au runtime par registerPublishedVillain
  // (vilains de l'Atelier publiés).
}

/** Couleur du RECOUVREMENT des actions (voile posé sur la rangée du haut d'un lieu
 *  occupé par un Héros), par id de vilain. Renseignée uniquement pour les vilains
 *  CUSTOM qui ont choisi une couleur de recouvrement dédiée (« Mode recouvrement » de
 *  l'Atelier), enregistrée au runtime par `registerPublishedVillain`. Les vilains
 *  natifs n'y figurent pas → le recouvrement retombe sur leur couleur thématique. */
export const VILLAIN_COVER_COLOR: Record<string, string> = {}

/** Teintes de repli (camp joueur / adversaire) quand la couleur d'un vilain est
 *  inconnue ou pas encore choisie. */
export const DEFAULT_TINT_A = '#3a2d6b'
export const DEFAULT_TINT_B = '#6b2d3a'

/** Halo d'un camp : la couleur du vilain, à peine éclaircie (les teintes vilains sont
 *  sombres), qui TIENT sur un bon tiers du rayon avant de s'éteindre — c'est ce palier
 *  intermédiaire qui donne au fond une couleur franche plutôt qu'un voile. */
function villainGlow(color: string, at: string): string {
  return (
    `radial-gradient(95% 78% at ${at}, ` +
    `color-mix(in srgb, ${color}, white 18%) 0%, ` +
    `color-mix(in srgb, ${color}, transparent 32%) 34%, ` +
    `rgba(0,0,0,0) 72%)`
  )
}

/** Ancres des deux halos DANS LE CALQUE du dégradé. Attention : `.villain-bg` étire
 *  cette image à `background-size: 150%` et la fait dériver (18 %→82 %), si bien que la
 *  page ne montre qu'une fenêtre glissante des deux tiers du calque. Le bas de l'écran
 *  tombe donc vers 83 % du calque, pas 100 % : une ancre à `108 %` (hors fenêtre)
 *  n'y laissait voir que la traîne délavée du halo, jamais son cœur. */
const GLOW_BOTTOM = '83%'
const GLOW_LEFT = '17%'
const GLOW_RIGHT = '83%'

/** Fond « teinté par les vilains » : chaque BAS de page prend la couleur d'un camp —
 *  le joueur à gauche, l'adversaire à droite — sur une base sombre. Les deux halos
 *  montent depuis le bas, là où se tiennent les vilains (leurs illustrations sur le
 *  choix des vilains, les plateaux en partie). Partagé par la page de partie (`App`)
 *  et le choix des vilains (`VillainSelect`). */
export function villainsBackground(colorA: string, colorB: string): string {
  return (
    `${villainGlow(colorA, `${GLOW_LEFT} ${GLOW_BOTTOM}`)}, ` +
    `${villainGlow(colorB, `${GLOW_RIGHT} ${GLOW_BOTTOM}`)}, ` +
    `linear-gradient(160deg, #16121f 0%, #0a0814 100%)`
  )
}

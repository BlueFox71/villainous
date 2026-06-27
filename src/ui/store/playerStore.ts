import { create } from 'zustand'
import type { VillainKey } from './gameStore'
import { VILLAIN_COLOR } from '../villainColors'

const LS_KEY = 'villainous:player'

/** Palette générique : teintes saturées mais sombres, qui se marient avec
 *  l'ambiance « méchants » (groupe présenté à part dans le choix de couleur). */
export const GENERIC_AVATAR_COLORS: string[] = [
  '#6d28d9', // violet
  '#4c1d95', // indigo profond
  '#7c1f4e', // bordeaux
  '#831843', // magenta sombre
  '#9a3412', // orange brûlé
  '#b45309', // ambre
  '#166534', // vert forêt
  '#0f766e', // sarcelle
  '#0c4a6e', // bleu profond
  '#1e3a8a', // bleu nuit
  '#374151', // ardoise
  '#7f1d1d', // rouge sombre
  '#111111', // noir
  '#f5f5f5', // blanc
]

/** Couleurs thématiques des vilains, dédoublonnées (`VILLAIN_COLOR` indexe par clé
 *  kebab ET camel) puis triées par valeur hexadécimale (groupe présenté à part). */
export const VILLAIN_AVATAR_COLORS: string[] = [
  ...new Set(Object.values(VILLAIN_COLOR).map((c) => c.toLowerCase())),
].sort()

/** Toutes les couleurs proposées (génériques + vilains), pour validation/usage global. */
export const AVATAR_COLORS: string[] = [...GENERIC_AVATAR_COLORS, ...VILLAIN_AVATAR_COLORS]

/** Profil du joueur (présentation pure, hors logique de jeu) : un nom, un vilain
 *  servant d'avatar et la couleur de fond de cet avatar. */
export interface PlayerProfile {
  /** Nom affiché du joueur (vide = non renseigné). */
  name: string
  /** Vilain utilisé comme avatar (illustration de présentation), ou null. */
  avatarVillain: VillainKey | null
  /** Couleur de fond derrière le vilain dans l'avatar (hex). */
  avatarColor: string
}

const DEFAULT: PlayerProfile = {
  name: 'Toi',
  avatarVillain: null,
  avatarColor: '#111111', // noir par défaut
}

/** Lit/valide le profil persisté. Renvoie les valeurs par défaut si absent/corrompu. */
function read(): PlayerProfile {
  if (typeof localStorage === 'undefined') return { ...DEFAULT }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { ...DEFAULT }
    const v = JSON.parse(raw) as Partial<PlayerProfile>
    return {
      name: typeof v.name === 'string' ? v.name : DEFAULT.name,
      avatarVillain: typeof v.avatarVillain === 'string' ? (v.avatarVillain as VillainKey) : null,
      avatarColor: typeof v.avatarColor === 'string' ? v.avatarColor : DEFAULT.avatarColor,
    }
  } catch {
    return { ...DEFAULT }
  }
}

function persist(p: PlayerProfile) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

interface PlayerStore extends PlayerProfile {
  /** Définit le nom du joueur. */
  setName: (name: string) => void
  /** Choisit le vilain servant d'avatar. */
  setAvatarVillain: (key: VillainKey) => void
  /** Choisit la couleur de fond de l'avatar. */
  setAvatarColor: (color: string) => void
}

/** Profil joueur persistant (nom + avatar). */
export const usePlayerStore = create<PlayerStore>((set) => ({
  ...read(),
  setName: (name) =>
    set((s) => {
      const next = { ...s, name }
      persist(next)
      return next
    }),
  setAvatarVillain: (avatarVillain) =>
    set((s) => {
      const next = { ...s, avatarVillain }
      persist(next)
      return next
    }),
  setAvatarColor: (avatarColor) =>
    set((s) => {
      const next = { ...s, avatarColor }
      persist(next)
      return next
    }),
}))

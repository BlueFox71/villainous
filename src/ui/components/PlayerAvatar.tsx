import { usePlayerStore } from '../store/playerStore'
import { villainPresentation } from '../villainArt'
import type { VillainKey } from '../store/gameStore'

/** Cadrage par défaut de la présentation dans l'avatar : remontée (dyPct < 0 pour
 *  voir le buste) et léger zoom. `dxPct`/`dyPct` en % de la taille de l'avatar. */
const AVATAR_BASE = { dxPct: 0, dyPct: -14, scale: 1.35 }

/** Réglages EXCEPTIONNELS par vilain (fusionnés sur AVATAR_BASE). */
const AVATAR_TWEAK: Partial<Record<VillainKey, Partial<typeof AVATAR_BASE>>> = {
  bowser: { dyPct: 0 }, // déjà bien cadré « tête en haut »
  imposteur: { dyPct: 12, scale: 1 }, // plus petit et plus bas
  scar: { dxPct: -12 }, // décalé vers la gauche
  sombra: { dxPct: 44, dyPct: -70, scale: 3.7 }, // zoomé, décalé droite + haut
  gothel: { dyPct: 0 }, // décalé vers le bas
  seigneurCles: { dyPct: 0 }, // décalé vers le bas
  seigneurTenebres: { dyPct: 0 }, // décalé vers le bas
  teamRocket: { dyPct: 0, scale: 1.05 }, // décalé vers le bas + dézoomé
  shereKhan: { dxPct: 12 }, // décalé vers la droite
}

/**
 * Avatar présentational : illustration de présentation d'un `villain` posée sur un
 * disque de couleur `color`. Repli sur une icône générique si aucun vilain. Sert au
 * profil (via `PlayerAvatar`) comme à l'historique (avatars explicites).
 */
export function Avatar({
  villain,
  color,
  size,
  className,
}: {
  villain: VillainKey | null
  color: string
  size: number
  className?: string
}) {
  const src = villain ? villainPresentation(villain) : undefined
  const t = { ...AVATAR_BASE, ...(villain ? AVATAR_TWEAK[villain] : undefined) }
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border-2 border-white/25 shadow-lg ${className ?? ''}`}
      style={{ width: size, height: size, backgroundColor: color }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-contain object-top"
          style={{
            transformOrigin: 'top center',
            transform: `translate(${t.dxPct}%, ${t.dyPct}%) scale(${t.scale})`,
          }}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-white/70" style={{ fontSize: size * 0.3 }}>
          👤
        </span>
      )}
    </div>
  )
}

/**
 * Avatar du joueur local : lit le profil (playerStore) et délègue à `Avatar`.
 * Réutilisable partout (accueil, profil…).
 */
export function PlayerAvatar({ size, className }: { size: number; className?: string }) {
  const villain = usePlayerStore((s) => s.avatarVillain)
  const color = usePlayerStore((s) => s.avatarColor)
  return <Avatar villain={villain} color={color} size={size} className={className} />
}

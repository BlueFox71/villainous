import { useEffect, useRef } from 'react'
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentRef } from 'overlayscrollbars-react'

interface Props {
  log: string[]
  /** Noms des joueurs dans l'ordre (index 0 = gauche, 1 = droite). */
  playerNames: string[]
  /** Couleur (hex) du méchant de chaque joueur, pour teinter ses bulles. */
  playerColors?: string[]
}

/** Rend un texte en mettant en gras les segments entre **…** (noms de cartes/lieux). */
function renderBold(text: string) {
  return text.split('**').map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>))
}

/** Journal en fil de discussion : ordre chronologique (haut → bas), bulles à
 *  gauche (joueur, bleu) / droite (adversaire, rouge), neutres centrées. */
export function GameLog({ log, playerNames, playerColors }: Props) {
  const osRef = useRef<OverlayScrollbarsComponentRef>(null)
  // Auto-défilement vers le bas (message le plus récent) — sur le viewport OS.
  useEffect(() => {
    const viewport = osRef.current?.osInstance()?.elements().viewport
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [log.length])

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-white/10 bg-black/20 p-3">
      <h2 className="mb-2 shrink-0 text-xs font-semibold text-white/60">Journal</h2>
      <OverlayScrollbarsComponent
        ref={osRef}
        className="min-h-0 flex-1 pr-1"
        defer
        options={{ scrollbars: { theme: 'os-theme-villain', autoHide: 'leave', autoHideDelay: 300 } }}
      >
        <div className="flex flex-col gap-1.5">
        {log.map((line, i) => {
          const idx = playerNames.findIndex((n) => n && line.startsWith(n))
          // Ligne neutre (début de partie, fin de tour, victoire…) → centrée.
          if (idx < 0) {
            return (
              <p key={i} className="self-center text-center text-[10px] italic text-white/45">
                {renderBold(line)}
              </p>
            )
          }
          const left = idx === 0
          const body = line.slice(playerNames[idx].length).trim() || line
          const color = playerColors?.[idx]
          const pos = left ? 'self-start rounded-bl-none' : 'self-end rounded-br-none'
          // Couleur du méchant → bulle teintée (bordure ~40 %, fond ~15 %). Sinon,
          // repli sur les tons bleu/rouge par défaut.
          const fallbackTone = left
            ? 'border-sky-500/40 bg-sky-500/15 text-sky-50'
            : 'border-red-500/40 bg-red-500/15 text-red-50'
          return (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg border px-2 py-1 text-[11px] leading-snug ${pos} ${
                color ? 'text-white/90' : fallbackTone
              }`}
              style={
                color
                  ? { borderColor: `color-mix(in srgb, ${color}, white 45%)`, backgroundColor: `${color}26` }
                  : undefined
              }
            >
              {renderBold(body)}
            </div>
          )
        })}
        </div>
      </OverlayScrollbarsComponent>
    </div>
  )
}

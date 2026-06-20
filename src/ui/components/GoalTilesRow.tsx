import { useLayoutEffect, useRef, useState } from 'react'
import type { GoalToken, PlayerState } from '../../engine/types'
import { PAT_GOAL_BACK, PAT_GOAL_INFO } from '../../data/villains/patHibulaire'

/**
 * Progression d'une tuile Objectif (0→1) + libellé chiffré, pour la barre du
 * tooltip. Reflète les conditions réelles (cf. `isPassiveGoalMet` / le bot) :
 *  - tuiles « début de tour » (objets / force / lieux) : progrès graduel ;
 *  - `power-play` : Pouvoir dépensé ce tour vers 6 ;
 *  - `win-big` : déclenchement ponctuel (pas de progrès partiel) → 0 tant que vide.
 * Une tuile remplie = 1 (barre pleine).
 */
function goalProgress(
  player: PlayerState,
  goal: GoalToken,
): { value: number; label: string; segments?: { name: string; ok: boolean }[] } {
  if (goal.completed) return { value: 1, label: 'Tuile remplie ✓' }
  const cell = player.board[goal.locationId] ?? []
  switch (goal.kind) {
    case 'strike-it-rich': {
      const items = cell.filter((c) => c.type === 'item' && !c.attachedTo).length
      return { value: Math.min(1, items / 3), label: `${items} / 3 Objets sur le lieu` }
    }
    case 'round-up': {
      const force = cell
        .filter((c) => c.type === 'ally')
        .reduce((n, c) => n + (c.strength ?? 0), 0)
      return { value: Math.min(1, force / 10), label: `Force ${force} / 10 sur le lieu` }
    }
    case 'rule-the-realm': {
      // Un segment par lieu : activé quand Alliés > Héros sur ce lieu.
      const segments = player.locations.map((l) => {
        const here = player.board[l.id] ?? []
        const ok =
          here.filter((c) => c.type === 'ally').length > here.filter((c) => c.type === 'hero').length
        return { name: l.name, ok }
      })
      const ok = segments.filter((s) => s.ok).length
      const total = segments.length
      return {
        value: total ? ok / total : 0,
        label: `${ok} / ${total} lieux (Alliés > Héros)`,
        segments,
      }
    }
    case 'power-play': {
      const spent = player.powerSpentThisTurn ?? 0
      return { value: Math.min(1, spent / 6), label: `${spent} / 6 JT dépensés ce tour` }
    }
    case 'win-big':
      return { value: 0, label: 'À déclencher en une fois (Une Petite Partie ?)' }
  }
}

/**
 * Pat Hibulaire — rangée des tuiles Objectif, posée dans `stacks-top` : une tuile
 * AU-DESSUS de chaque case Héros (alignée sur la grille de `HeroRow`). Reproduit la
 * disposition de `fatality-cases` (espace réservé à gauche, de la largeur des piles
 * Fatalité, puis grille 4 colonnes) pour que chaque tuile surplombe son lieu.
 *
 * - Joueur local (`own`) : voit le recto de TOUTES ses tuiles (même cachées). Son
 *   info-bulle ajoute une BARRE DE PROGRESSION (privée — jamais montrée à l'adversaire).
 * - Adversaire : ne voit le recto que des tuiles `revealed` (sinon le dos). Une tuile
 *   révélée a une bordure blanche ; son info-bulle n'affiche QUE l'image (l'art porte
 *   déjà le nom et le texte), sans barre de progression.
 * - Tuile remplie (`completed`) : recto + médaille ✓ (retirée du plateau de jeu,
 *   mais conservée ici pour montrer la progression).
 *
 * No-op pour les autres vilains (pas de `goals`).
 */
export function GoalTilesRow({ player, own = false }: { player: PlayerState; own?: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null)
  // Animation « FLIP » : quand une tuile change de lieu (Dingo), on la fait glisser
  // de son ancienne position vers la nouvelle. Les tuiles sont keyées par `goal.kind`
  // (identité stable) ; on mémorise leur rectangle pour calculer le delta.
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const prevRects = useRef<Map<string, DOMRect>>(new Map())
  useLayoutEffect(() => {
    tileRefs.current.forEach((el, kind) => {
      const rect = el.getBoundingClientRect()
      const prev = prevRects.current.get(kind)
      if (prev) {
        const dx = prev.left - rect.left
        const dy = prev.top - rect.top
        if (dx || dy) {
          el.style.transition = 'none'
          el.style.transform = `translate(${dx}px, ${dy}px)`
          requestAnimationFrame(() => {
            el.style.transition = 'transform 480ms cubic-bezier(0.4, 0, 0.2, 1)'
            el.style.transform = ''
          })
        }
      }
      prevRects.current.set(kind, rect)
    })
  })
  if (!player.goals || player.goals.length === 0) return null
  const last = player.locations.length - 1
  return (
    <div className="flex w-full items-end gap-3" style={{ paddingLeft: '1%' }}>
      {/* Espace réservé : même largeur que `StacksCards` (deux piles w-16 + gap-3),
          pour aligner la grille des tuiles sur celle des cases Héros. */}
      <div aria-hidden className="flex shrink-0 gap-3">
        <div className="w-16" />
        <div className="w-16" />
      </div>
      <div className="flex-1">
        {/* mb-1.5 : on soulève les tuiles de quelques pixels au-dessus des cases Héros. */}
        <div className="mb-1.5 grid grid-cols-4 gap-2">
          {player.locations.map((loc, index) => {
            const goal = player.goals!.find((g) => g.locationId === loc.id)
            if (!goal) return null
            const show = own || goal.revealed || goal.completed
            const info = PAT_GOAL_INFO[goal.kind]
            const isHovered = hovered === goal.kind
            // Info-bulle calée sur le bord (1ʳᵉ tuile à gauche, dernière à droite,
            // sinon centrée) pour ne pas déborder de la colonne.
            const tipPos =
              index === 0 ? 'left-0' : index === last ? 'right-0' : 'left-1/2 -translate-x-1/2'
            return (
              // Keyée par `goal.kind` (identité stable) + colonne explicite → quand la
              // tuile change de lieu, React déplace l'élément et l'effet FLIP l'anime.
              <div
                key={goal.kind}
                ref={(el) => {
                  if (el) tileRefs.current.set(goal.kind, el)
                  else tileRefs.current.delete(goal.kind)
                }}
                style={{ gridColumnStart: index + 1 }}
                className="flex justify-center"
              >
                <div
                  className={`relative ${goal.completed ? '' : 'opacity-95'}`}
                  style={{ zIndex: isHovered ? 50 : 1 }}
                  onMouseEnter={() => setHovered(goal.kind)}
                  onMouseLeave={() => setHovered((h) => (h === goal.kind ? null : h))}
                >
                  <img
                    src={show ? info.image : PAT_GOAL_BACK}
                    alt={show ? info.name : 'Objectif caché'}
                    className={`h-16 w-auto max-w-full rounded-md border object-contain shadow-md transition ${
                      goal.completed
                        ? 'border-amber-300 ring-2 ring-amber-300'
                        : goal.revealed && !own
                          ? 'border-2 border-white ring-2 ring-white/70'
                          : 'border-white/25'
                    }`}
                  />
                  {goal.completed && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-amber-200 bg-amber-400 text-[11px] font-black text-purple-950 shadow">
                      ✓
                    </span>
                  )}
                  {/* Tuile adverse dévoilée (Clarabelle, Hors-la-loi, Dingo…) : badge clair. */}
                  {goal.revealed && !own && !goal.completed && (
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/70 bg-white px-1.5 text-[8px] font-black uppercase tracking-wide text-[#0b0a12] shadow">
                      dévoilée
                    </span>
                  )}
                  {isHovered && (
                    <div
                      className={`absolute top-full ${tipPos} z-50 mt-1 w-60 rounded-lg border border-white/20 bg-[#0b0a12] p-2 text-left shadow-2xl`}
                    >
                      {own ? (
                        // Mes tuiles : recto (l'art porte nom + objectif) + barre de
                        // progression PRIVÉE, sans nom ni texte redondants.
                        (() => {
                          const prog = goalProgress(player, goal)
                          return (
                            <>
                              <img
                                src={info.image}
                                alt={info.name}
                                className="mb-1.5 w-full rounded border border-white/15"
                              />
                              <div className="mt-2">
                                {prog.segments ? (
                                  // Barre en N segments (un par lieu) : on voit quel
                                  // emplacement remplit déjà sa condition.
                                  <div className="flex gap-1">
                                    {prog.segments.map((seg, i) => (
                                      <div
                                        key={i}
                                        title={`${seg.name} : ${seg.ok ? 'Alliés > Héros ✓' : 'pas encore'}`}
                                        className={`h-2 flex-1 rounded-full transition-all ${
                                          seg.ok ? 'bg-yellow-400' : 'bg-white/10'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        goal.completed ? 'bg-yellow-300' : 'bg-yellow-400'
                                      }`}
                                      style={{ width: `${Math.round(prog.value * 100)}%` }}
                                    />
                                  </div>
                                )}
                                <p className="mt-0.5 text-[10px] font-medium text-yellow-200/90">{prog.label}</p>
                              </div>
                            </>
                          )
                        })()
                      ) : show ? (
                        // Tuile adverse révélée : on n'affiche QUE l'image (pas de
                        // progression — info privée à son propriétaire).
                        <img
                          src={info.image}
                          alt={info.name}
                          className="w-full rounded border border-white/15"
                        />
                      ) : (
                        <>
                          <img
                            src={PAT_GOAL_BACK}
                            alt="Objectif caché"
                            className="mb-1.5 w-full rounded border border-white/15"
                          />
                          <p className="text-[11px] leading-snug text-white/75">
                            Tuile Objectif face cachée — son contenu sera révélé par certaines
                            Fatalités (Clarabelle, Hors-la-loi…).
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-white/40">{loc.name}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

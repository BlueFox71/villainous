import { useRef, useState } from 'react'
import type { PlayerState } from '../../engine/types'
import { getCardDef } from '../../data/registry'
import { LOCATIONS_LEFT } from './BoardImage'
import { GlowBorder } from './GlowBorder'

/**
 * Rangée des zones « Héros » par lieu (alignée sous les lieux de l'image, comme
 * la grille du méchant). Les Héros, posés par la Fatalité adverse, s'affichent
 * ici ; agrandissement au survol pour les lire.
 */
interface HeroRowProps {
  player: PlayerState
  /** Forces effectives des Héros (par instanceId). */
  strengths: Record<string, number>
  /** Héros cliquables (mode « éliminer — choix de la cible »). */
  vanquishTargets?: string[]
  onVanquishPickHero?: (instanceId: string, name: string) => void
  /** Héros cliquables (mode « déplacer — choix du Héros », destination imposée :
   *  Capture). Anneau ambre, distinct du rouge Vanquish. */
  relocateTargets?: string[]
  onRelocatePickHero?: (instanceId: string) => void
  /** Vrai si le joueur peut payer 2 JT pour défausser un Déguisement
   *  (tour du joueur, JT suffisants). Affiche un bouton sous le Héros porteur. */
  canDiscardDeguisement?: boolean
  onDiscardDeguisement?: (instanceId: string) => void
  /** instanceIds des Héros en attente de showcase (courant + en file) — à masquer
   *  du plateau tant que leur showcase n'a pas atterri. */
  hiddenInstanceIds?: string[]
  /** instanceIds des Héros à faire clignoter en rouge (Robin des Bois quand sa
   *  pénalité prend effet). Flash one-shot. */
  redBlinkInstanceIds?: string[]
  /** Yzma — ids de lieux dont la pioche Fatalité est cliquable (choix de pioche en
   *  attente : À l'attaque !, Marteau, Indiscrétion, Fatalité…). */
  fatePickable?: string[]
  /** Handler de clic sur une pioche Fatalité choisie (locationId). */
  onFatePick?: (locationId: string) => void
  offset?: boolean
  /** instanceIds des Héros saisissables (glisser-déposer) pour les déplacer vers un
   *  lieu voisin — action « Déplacer un Héros » disponible. */
  dragHeroIds?: string[]
  /** Héros en cours de glissé (masqué : le fantôme le remplace). */
  draggingInstanceId?: string | null
  onCardDragStart?: (instanceId: string, x: number, y: number) => void
  onCardDragMove?: (x: number, y: number) => void
  onCardDragDrop?: (instanceId: string, x: number, y: number) => void
  onCardDragCancel?: () => void
}

export function HeroRow({
  player,
  strengths,
  vanquishTargets = [],
  onVanquishPickHero,
  relocateTargets = [],
  onRelocatePickHero,
  canDiscardDeguisement = false,
  onDiscardDeguisement,
  hiddenInstanceIds = [],
  redBlinkInstanceIds = [],
  fatePickable = [],
  onFatePick,
  offset = true,
  dragHeroIds = [],
  draggingInstanceId = null,
  onCardDragStart,
  onCardDragMove,
  onCardDragDrop,
  onCardDragCancel,
}: HeroRowProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  // Geste de glissé d'un Héros (même schéma que la main / le pion : seuil de 6 px,
  // capture du pointeur, clic droit = annulation).
  const dragPointer = useRef<{ id: string; startX: number; startY: number; dragging: boolean } | null>(null)

  // Sa Sucrerie — le circuit (sugar-rush) n'est pas une zone de cartes : la rangée
  // Héros n'affiche que les 4 zones de pose (où la Fatalité adverse pose ses Héros),
  // comme la grille du méchant (cf. Board).
  const displayLocations =
    player.villain === 'sa-sucrerie'
      ? player.locations.filter((l) => l.id !== 'sugar-rush')
      : player.locations

  return (
    <div
      className="grid grid-cols-4 gap-2"
      style={offset ? { marginLeft: `${LOCATIONS_LEFT}%` } : undefined}
    >
      {displayLocations.map((loc, index) => {
        const cellCards = player.board[loc.id] ?? []
        // Un Héros hypnotisé (Jafar) quitte la zone Héros : il est affiché comme
        // un Allié dans la zone basse (cf. Board).
        // Zone Fatalité : Héros (non hypnotisés) ET Objets posés par la Fatalité
        // (L'Imposteur : Carte, Vidéo de surveillance) — ils n'appartiennent pas à
        // la zone des cartes Méchant.
        const heroes = cellCards.filter(
          (c) =>
            // Lotso — Buzz l'Éclair en mode GARDIEN siège dans la zone du haut (côté Héros).
            ((c.type === 'hero' && !c.hypnotized) || c.fromFate || (c.isBuzz && c.buzzMode === 'guardian')) &&
            !hiddenInstanceIds.includes(c.instanceId),
        )
        const previewPos =
          index === 0
            ? 'left-0'
            : index === displayLocations.length - 1
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2'
        return (
          <div
            key={loc.id}
            data-hero-cell={`${player.villain}:${loc.id}`}
            className="relative flex min-h-[90px] flex-wrap items-start justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 p-2"
          >
            {/* Indicateur : contour blanc sur toute case héros contenant ≥1 Héros. */}
            {heroes.length > 0 && <GlowBorder color="#ffffff" radius={8} />}
            {/* Yzma — pioche Fatalité de CE lieu (face cachée), posée AU-DESSUS de la
                zone de Fatalité. Positionnée en absolu (bottom-full) : elle ne prend
                pas de place dans le flux et ne décale donc PAS les autres éléments.
                Une pile par lieu (4 au total) ; vide = emplacement pointillé. Quand un
                choix de pioche est en attente, la pile (non vide) devient cliquable. */}
            {player.fateDecks !== undefined && (() => {
              const n = (player.fateDecks[loc.id] ?? []).length
              const pickable = fatePickable.includes(loc.id)
              return (
                <button
                  type="button"
                  disabled={!pickable}
                  onClick={pickable ? () => onFatePick?.(loc.id) : undefined}
                  className={`absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 ${pickable ? 'cursor-pointer animate-pulse' : 'cursor-default'}`}
                  title={
                    pickable
                      ? `Choisir cette pioche Fatalité (${loc.name}, ${n} carte${n > 1 ? 's' : ''})`
                      : `Pioche Fatalité — ${loc.name} : ${n} carte${n > 1 ? 's' : ''}`
                  }
                >
                  {n > 0 ? (
                    <img
                      src={player.backFateImage}
                      alt="Pioche Fatalité"
                      className={`w-16 rounded border shadow ${
                        pickable
                          ? 'border-amber-300 ring-2 ring-amber-300'
                          : 'border-amber-300/70'
                      }`}
                    />
                  ) : (
                    <div className="aspect-[5/7] w-16 rounded border border-dashed border-amber-300/40 bg-white/5" />
                  )}
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-black/85 px-1 text-[8px] font-mono text-white">
                    {n}
                  </span>
                </button>
              )
            })()}
            {heroes.map((c) => {
              const def = getCardDef(c.cardId)
              const isHovered = hovered === c.instanceId
              const attached = cellCards.filter((a) => a.attachedTo === c.instanceId)
              const locked = c.lockedPower ?? 0
              const isTarget = vanquishTargets.includes(c.instanceId)
              const isRelocateTarget = !isTarget && relocateTargets.includes(c.instanceId)
              // Saisissable (glisser pour déplacer) si l'action « Déplacer un Héros »
              // est active et que ce Héros n'est pas déjà une cible de clic.
              const dragEligible = dragHeroIds.includes(c.instanceId) && !isTarget && !isRelocateTarget
              const deguisement = attached.find((a) => a.cardId === 'deguisement')
              // Héros agrandi : on incline la carte à 90° vers le lieu voisin sur
              // lequel il déborde (à droite → +90°, à gauche → −90°).
              const enlargeIdx =
                c.heroSize === 'enlarged' && c.enlargeTargetId
                  ? displayLocations.findIndex((l) => l.id === c.enlargeTargetId)
                  : -1
              const enlargeRotate = enlargeIdx >= 0 ? (enlargeIdx > index ? 90 : -90) : 0
              // Héros rapetissé : léger pivot à 45° vers le côté de l'action qui
              // reste RECOUVERTE (l'action non libérée). Gauche → −45°, droite → +45°.
              const shrinkRotate = (() => {
                if (c.heroSize !== 'shrunk') return 0
                const tops = loc.actions.filter((a) => a.row === 'top')
                const freed = c.shrunkFreeActionId ?? tops[0]?.id
                const coveredIdx = tops.findIndex((a) => a.id !== freed)
                return coveredIdx <= 0 ? -45 : 45
              })()
              return (
                <figure
                  key={c.instanceId}
                  data-hero-card={c.instanceId}
                  onMouseEnter={() => setHovered(c.instanceId)}
                  onMouseLeave={() => setHovered((h) => (h === c.instanceId ? null : h))}
                  className="relative m-0"
                  style={{ zIndex: isHovered ? 50 : 1 }}
                >
                  <div className="relative">
                    <img
                      src={def?.image}
                      alt={c.name}
                      draggable={false}
                      title={
                        dragEligible
                          ? `Glissez ${c.name} sur un lieu voisin pour le déplacer`
                          : `${c.name}${def ? ` — ${def.text}` : ''}`
                      }
                      onClick={
                        isTarget
                          ? () => onVanquishPickHero?.(c.instanceId, c.name)
                          : isRelocateTarget
                            ? () => onRelocatePickHero?.(c.instanceId)
                            : undefined
                      }
                      onPointerDown={
                        dragEligible
                          ? (e) => {
                              if (e.button !== 0) return
                              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                              dragPointer.current = { id: c.instanceId, startX: e.clientX, startY: e.clientY, dragging: false }
                            }
                          : undefined
                      }
                      onPointerMove={
                        dragEligible
                          ? (e) => {
                              const d = dragPointer.current
                              if (!d || d.id !== c.instanceId) return
                              if (!d.dragging) {
                                if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return
                                d.dragging = true
                                setHovered(null)
                                onCardDragStart?.(c.instanceId, e.clientX, e.clientY)
                              }
                              onCardDragMove?.(e.clientX, e.clientY)
                            }
                          : undefined
                      }
                      onPointerUp={
                        dragEligible
                          ? (e) => {
                              const d = dragPointer.current
                              dragPointer.current = null
                              if (!d || d.id !== c.instanceId) return
                              if (d.dragging) onCardDragDrop?.(c.instanceId, e.clientX, e.clientY)
                            }
                          : undefined
                      }
                      onContextMenu={
                        dragEligible
                          ? (e) => {
                              if (dragPointer.current?.dragging) {
                                e.preventDefault()
                                dragPointer.current = null
                                onCardDragCancel?.()
                              }
                            }
                          : undefined
                      }
                      className={`w-14 rounded border transition-transform ${
                        isTarget
                          ? 'cursor-pointer border-red-500 ring-2 ring-red-500'
                          : isRelocateTarget
                            ? 'cursor-pointer border-amber-400 ring-2 ring-amber-400 animate-pulse'
                            : dragEligible
                              ? 'cursor-grab touch-none border-amber-300/70 ring-1 ring-amber-300/60 hover:ring-2 hover:ring-amber-300 active:cursor-grabbing'
                              : 'border-white/40'
                      } ${redBlinkInstanceIds.includes(c.instanceId) ? 'red-flash' : ''} ${
                        draggingInstanceId === c.instanceId ? 'opacity-0' : ''
                      }`}
                      style={
                        c.heroSize === 'shrunk'
                          ? { transform: `rotate(${shrinkRotate}deg)` }
                          : c.heroSize === 'enlarged'
                            ? { transform: `scale(1.2) rotate(${enlargeRotate}deg)` }
                            : undefined
                      }
                    />
                    {/* Madame de Trémaine — Héros CAPTURÉ (Capturé) : sa capacité est
                        ignorée (comme un Héros piraté par Boop). Overlay « Capturé ». */}
                    {c.trapped && (
                      <img
                        src="/cards/madame-tremaine/capture.png"
                        alt=""
                        aria-hidden="true"
                        title="Héros capturé — capacité annulée"
                        className="pointer-events-none absolute left-1/2 top-1/2 max-h-[70%] w-8 -translate-x-1/2 -translate-y-1/2 rotate-180 object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                      />
                    )}
                    {/* Sombra — Héros « piraté » (Boop !) : overlay Hack glitch. */}
                    {c.abilityHacked && (
                      <div
                        className="hack-glitch pointer-events-none absolute left-1/2 top-1/2 w-14 -translate-x-1/2 -translate-y-1/2"
                        title="Héros piraté (Boop !) — capacité annulée"
                      >
                        <img src="/cards/sombra/hack.png" alt="" aria-hidden="true" className="hg-base" />
                        <img src="/cards/sombra/hack.png" alt="" aria-hidden="true" className="hg-layer hg-a" />
                        <img src="/cards/sombra/hack.png" alt="" aria-hidden="true" className="hg-layer hg-b" />
                      </div>
                    )}
                    {/* Le Seigneur des clés — clés VOLÉES par ce Héros (Gévaudan) :
                        affichées en bas de sa carte (récupérées s'il est vaincu). */}
                    {(() => {
                      const stolen = (player.keys ?? []).filter((k) => k.stolenBy === c.instanceId)
                      if (stolen.length === 0) return null
                      return (
                        <div
                          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-0.5"
                          title={`Clé(s) volée(s) : ${stolen.map((k) => k.color).join(', ')}`}
                        >
                          {stolen.map((k) => (
                            <img
                              key={k.id}
                              src={`/cards/seigneur-cles/cle-${k.color}.png`}
                              alt={`Clé ${k.color} volée`}
                              className="h-9 w-auto drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                            />
                          ))}
                        </div>
                      )
                    })()}
                    {/* Badge MODIFICATEUR uniquement : +N (Adam de la Halle, Épée de
                        Vérité) ou −N (Sommeil sans Rêves) quand la force du Héros est
                        modifiée. Pas de badge de force « brute ». */}
                    {strengths[c.instanceId] !== undefined &&
                      strengths[c.instanceId] - (c.strength ?? 0) !== 0 && (
                        <span
                          title={`Force modifiée : ${strengths[c.instanceId] - (c.strength ?? 0) > 0 ? '+' : ''}${
                            strengths[c.instanceId] - (c.strength ?? 0)
                          } (base ${c.strength ?? '?'} → ${strengths[c.instanceId]})`}
                          className={`absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-white/40 px-1 text-[10px] font-bold text-white ${
                            strengths[c.instanceId] - (c.strength ?? 0) > 0 ? 'bg-emerald-600' : 'bg-orange-700'
                          }`}
                        >
                          {strengths[c.instanceId] - (c.strength ?? 0) > 0 ? '+' : ''}
                          {strengths[c.instanceId] - (c.strength ?? 0)}
                        </span>
                      )}
                    {locked > 0 && (
                      <span
                        title={`${locked} JT verrouillé${locked > 1 ? 's' : ''} sur cette carte (rendus au PJ si vaincu).`}
                        className="absolute -bottom-1 -left-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-white/40 bg-amber-500 px-1 text-[10px] font-bold text-purple-950"
                      >
                        🔒{locked}
                      </span>
                    )}
                    {/* Mère Gothel — Flynn Rider : jetons Confiance détenus (rendus si vaincu). */}
                    {(c.heldConfiance ?? 0) > 0 && (
                      <span
                        title={`${c.heldConfiance} jeton${(c.heldConfiance ?? 0) > 1 ? 's' : ''} Confiance détenu${(c.heldConfiance ?? 0) > 1 ? 's' : ''} (rendus à Mère Gothel si ce Héros est vaincu).`}
                        className="absolute -bottom-1 -left-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-white/40 bg-rose-500 px-1 text-[10px] font-bold text-white"
                      >
                        💗{c.heldConfiance}
                      </span>
                    )}
                    {/* Yzma — Kronk devenu Héros : jetons Pouvoir accumulés (≥3). */}
                    {(c.kronkPower ?? 0) > 0 && (
                      <span
                        title={`${c.kronkPower} jeton${(c.kronkPower ?? 0) > 1 ? 's' : ''} Pouvoir sur Kronk`}
                        className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full border border-white/40 bg-purple-900/90 px-1 text-[10px] font-black text-amber-100"
                      >
                        <img src="/jeton_pouvoir.png" alt="" className="h-3.5 w-3.5 object-contain" />
                        {c.kronkPower}
                      </span>
                    )}
                    {attached.map((a, i) => (
                      <img
                        key={a.instanceId}
                        src={getCardDef(a.cardId)?.image}
                        alt={a.name}
                        title={`associé : ${a.name}`}
                        // pointer-events-none : la vignette de l'Objet associé ne doit
                        // pas intercepter les clics destinés au Héros porteur.
                        className="pointer-events-none absolute w-8 rounded border-2 border-fuchsia-400 shadow-md"
                        style={{ right: -4 - i * 5, bottom: -2, zIndex: 5 + i }}
                      />
                    ))}
                  </div>
                  {isHovered && (
                    <div className={`absolute top-full ${previewPos} mt-1 flex w-max items-end gap-1 rounded-lg border border-white/20 bg-[#0b0a12] p-1 shadow-2xl`}>
                      <img src={def?.image} alt={c.name} className="h-[22rem] w-auto max-w-none shrink-0 rounded" />
                      {attached.map((a) => (
                        <img
                          key={a.instanceId}
                          src={getCardDef(a.cardId)?.image}
                          alt={a.name}
                          className="h-[22rem] w-auto max-w-none shrink-0 rounded border-2 border-fuchsia-400"
                        />
                      ))}
                    </div>
                  )}
                  {deguisement && canDiscardDeguisement && (
                    <button
                      onClick={() => onDiscardDeguisement?.(deguisement.instanceId)}
                      title="Défausser le Déguisement (2 JT)"
                      className="mt-0.5 w-full rounded bg-fuchsia-700 px-1 py-0.5 text-[9px] font-bold text-white hover:bg-fuchsia-600"
                    >
                      −2 JT 🗡
                    </button>
                  )}
                </figure>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

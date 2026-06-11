import { useState, type CSSProperties } from 'react'
import type { CardInstance, Location } from '../../engine/types'
import type { Accent } from '../accents'
import { getCardDef } from '../../data/registry'
import { GlowBorder } from './GlowBorder'
import { SnakeBorder } from './SnakeBorder'

/** Couleur du cadre lumineux signalant une Malédiction sur le lieu. */
const CURSE_COLOR = '#a855f7'
/** Couleur du cadre lumineux signalant un lieu choisissable (déplacement). */
const MOVE_COLOR = '#38bdf8'

interface Props {
  location: Location
  accent: Accent
  isCurrent: boolean
  /** Affiche le serpent sur le lieu courant — seulement sur le plateau du joueur actif. */
  showCurrentSnake?: boolean
  isMovable: boolean
  placedCards: CardInstance[]
  /** Forces effectives (modificateurs passifs inclus), par instanceId. */
  strengths: Record<string, number>
  /** Ce lieu est une destination de pose valide (mode « poser ») → cliquable. */
  isPlaceTarget: boolean
  /** Force d'attaque disponible sur ce lieu : Alliés présents + Archers Loups
   *  des lieux voisins (calculée par le plateau, qui connaît l'adjacence). */
  attackTotal?: number
  /** Persifleur : fait clignoter la carte Persifleur de ce lieu (source de
   *  l'effet « action recouverte jouable »). */
  blinkPersifleur?: boolean
  /** Clé DOM du lieu (`<villain>:<locId>`) pour ancrer les animations de carte. */
  locationKey?: string
  /** On choisit l'Allié porteur SUR ce lieu (mode « associer ») → pastilles cliquables. */
  attachHere: boolean
  /** Mode « déplacer » : les Alliés/Objets racine deviennent sélectionnables. */
  selectableCards: boolean
  /** Mode « éliminer — choix des alliés » : ces instanceIds sont cochables. */
  vanquishAllyCandidates?: string[]
  /** Alliés déjà cochés pour le Vanquish en cours. */
  vanquishSelected?: string[]
  onVanquishToggle?: (instanceId: string) => void
  /** Liste des Shériffs (instanceId) qui peuvent encore se déplacer ce tour. */
  sheriffMovable?: string[]
  onSheriffMoveStart?: (instanceId: string) => void
  /** Liste des Diablo (instanceId) qui peuvent encore se déplacer ce tour. */
  diabloMovable?: string[]
  onDiabloMoveStart?: (instanceId: string) => void
  /** Disparition : sur le lieu courant, propose « Rester ici ». */
  canSkipMove?: boolean
  onSkipMove?: () => void
  /** Ancrage horizontal de l'aperçu zoom pour ne pas déborder de l'écran
   *  (lieu de gauche → 'left', de droite → 'right', sinon 'center'). */
  previewAlign: 'left' | 'center' | 'right'
  /** Couleur de fond du lieu (couleur du vilain). */
  cellColor?: string
  /** MODE TEST : ouvre le sélecteur d'insertion de cartes pour ce lieu. Reçoit
   *  le rectangle écran du bouton pour ancrer la liste déroulante. */
  onTestInsert?: (rect: DOMRect) => void
  onMove: () => void
  onPlace: () => void
  onAttach: (allyInstanceId: string) => void
  onCardPick: (instanceId: string) => void
  /** Capitaine Crochet : ids (`granted:<inst>`) des actions accordées par un Objet
   *  DISPONIBLES sur ce lieu → la carte de l'Objet devient cliquable. */
  grantedActionIds?: string[]
  onGrantedAction?: (card: CardInstance) => void
}

export function LocationCard({
  location,
  accent,
  isCurrent,
  showCurrentSnake = false,
  isMovable,
  placedCards,
  strengths,
  isPlaceTarget,
  attackTotal = 0,
  blinkPersifleur = false,
  locationKey,
  attachHere,
  selectableCards,
  vanquishAllyCandidates = [],
  vanquishSelected = [],
  onVanquishToggle,
  sheriffMovable = [],
  onSheriffMoveStart,
  diabloMovable = [],
  onDiabloMoveStart,
  canSkipMove = false,
  onSkipMove,
  previewAlign,
  cellColor,
  onTestInsert,
  onMove,
  onPlace,
  onAttach,
  onCardPick,
  grantedActionIds = [],
  onGrantedAction,
}: Props) {
  // Carte posée survolée (par instanceId) → agrandissement pour la lire « en direct ».
  const [hovered, setHovered] = useState<string | null>(null)
  const previewPos =
    previewAlign === 'left'
      ? 'left-0'
      : previewAlign === 'right'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2'

  // Lieu courant (serpent) et lieu choisissable au déplacement (halo bleu) n'ont
  // plus d'encadré : ils restent « au repos » et c'est l'overlay lumineux qui les
  // signale. Seule la pose (place target) garde son encadré + anneau ambre.
  const tone = isPlaceTarget ? accent.cardMovable : accent.cardIdle
  // Un lieu cliquable comme destination (pose) prime sur le déplacement.
  const clickable = isPlaceTarget || isMovable
  // Lieu sous Malédiction → contour électrifié.
  const hasCurse = placedCards.some((c) => c.type === 'curse')
  const handleClick = () => {
    if (isPlaceTarget) onPlace()
    else if (isMovable) onMove()
  }


  return (
    <div
      data-board-loc={locationKey}
      className={`group relative flex min-h-[90px] flex-col gap-1.5 rounded-lg border p-2 transition-colors ${tone} ${
        isPlaceTarget ? 'cursor-pointer ring-2 ring-amber-300' : ''
      } ${isMovable ? 'cursor-pointer' : ''} ${isCurrent ? 'z-30' : ''}`}
      style={cellColor ? { backgroundColor: `${cellColor}66` } : undefined}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
    >
      {/* Malédiction posée ici : cadre lumineux violet (sous le contenu). Le halo
          bleu « choisissable » a la priorité visuelle si le lieu est aussi ciblable. */}
      {hasCurse && !isMovable && <GlowBorder color={CURSE_COLOR} radius={8} />}
      {/* Lieu choisissable au déplacement : halo bleu (remplace l'encadré + bouton). */}
      {isMovable && <GlowBorder color={MOVE_COLOR} radius={8} />}
      {/* Lieu courant (pion présent) : serpent lumineux animé (couleur du camp),
          À L'EXTÉRIEUR — remplace l'ancien encadré bleu/rouge. */}
      {isCurrent && showCurrentSnake && <SnakeBorder color={accent.ringColor} radius={8} width={4} outset={4} />}
      {/* Nom du lieu en tooltip au survol de la case. */}
      <span className="pointer-events-none absolute left-1/2 top-1 z-30 -translate-x-1/2 whitespace-nowrap rounded bg-black/85 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        {location.name}
      </span>
      {/* Force d'attaque disponible sur ce lieu (Alliés présents + Archers Loups voisins). */}
      {attackTotal > 0 && (
        <span
          title={`Force d'attaque disponible sur ce lieu : ${attackTotal} (Alliés présents + Archers Loups des lieux voisins)`}
          className="pointer-events-none absolute -left-2 -top-2 z-30 flex items-center gap-0.5 rounded-full border border-white/40 bg-red-700 px-1.5 py-0.5 text-[10px] font-bold text-white shadow"
        >
          ⚔{attackTotal}
        </span>
      )}
      {/* MODE TEST : bouton d'insertion de cartes sur ce lieu. */}
      {onTestInsert && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onTestInsert(e.currentTarget.getBoundingClientRect())
          }}
          title="Insérer une carte sur ce lieu"
          className="absolute right-1 top-1 z-40 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-emerald-950 shadow hover:bg-emerald-400"
        >
          ＋
        </button>
      )}
      {isPlaceTarget && (
        <div className="flex items-center justify-center">
          <span className="text-[10px] font-medium text-amber-300">poser ici</span>
        </div>
      )}

      {placedCards.some((c) => !c.attachedTo && (c.type !== 'hero' || c.hypnotized)) && (
        <div className="flex flex-wrap items-end justify-center gap-1.5">
          {placedCards
            // Alliés/Objets « racine » dans la zone basse. Les Héros sont en haut,
            // SAUF un Héros hypnotisé (Jafar) qui devient un Allié → affiché ici.
            .filter((c) => !c.attachedTo && (c.type !== 'hero' || c.hypnotized))
            .map((c) => {
              const def = getCardDef(c.cardId)
              const attached = placedCards.filter((a) => a.attachedTo === c.instanceId)
              const isTarget =
                attachHere && (c.type === 'ally' || (c.type === 'hero' && !!c.hypnotized))
              const canMovePick =
                selectableCards &&
                (c.type === 'ally' || c.type === 'item' || (c.type === 'hero' && !!c.hypnotized))
              const canVanquishToggle = vanquishAllyCandidates.includes(c.instanceId)
              const isVanquishSelected = vanquishSelected.includes(c.instanceId)
              // Capitaine Crochet : Objet qui donne une action au lieu (Canon,
              // Boîte à Crochets, Ingénieux Mécanisme) → cliquable quand l'action
              // est disponible.
              const canGranted = !!c.grantsAction && grantedActionIds.includes(`granted:${c.instanceId}`)
              const isHovered = hovered === c.instanceId
              const isPersifleurBlink = blinkPersifleur && c.cardId === 'persifleur'

              return (
                <figure
                  key={c.instanceId}
                  onMouseEnter={() => setHovered(c.instanceId)}
                  onMouseLeave={() => setHovered((h) => (h === c.instanceId ? null : h))}
                  className="relative m-0"
                  style={{ zIndex: isHovered ? 50 : 1 }}
                >
                  {/* Vignette de base : allié + objet(s) en surimpression DEVANT, en bas. */}
                  <div className="relative">
                    <img
                      src={def?.image}
                      alt={c.name}
                      title={`${c.name}${def ? ` — ${def.text}` : ''}`}
                      onClick={
                        canGranted
                          ? (e) => {
                              e.stopPropagation()
                              onGrantedAction?.(c)
                            }
                          : isTarget
                            ? (e) => {
                                e.stopPropagation()
                                onAttach(c.instanceId)
                              }
                            : canMovePick
                              ? (e) => {
                                  e.stopPropagation()
                                  onCardPick(c.instanceId)
                                }
                              : canVanquishToggle
                                ? (e) => {
                                    e.stopPropagation()
                                    onVanquishToggle?.(c.instanceId)
                                  }
                                : undefined
                      }
                      className={`w-14 rounded border ${
                        canGranted
                          ? 'cursor-pointer border-yellow-400 ring-2 ring-yellow-400'
                          : isTarget
                            ? 'cursor-pointer border-amber-300 ring-2 ring-amber-300'
                            : canMovePick
                              ? 'cursor-pointer border-emerald-300 ring-2 ring-emerald-300'
                              : canVanquishToggle
                                ? isVanquishSelected
                                  ? 'cursor-pointer border-red-500 ring-2 ring-red-500'
                                  : 'cursor-pointer border-red-400/50 ring-2 ring-red-400/30'
                                : isPersifleurBlink
                                  ? 'border-yellow-300 ring-2 ring-yellow-300'
                                  : 'border-white/15'
                      }`}
                      style={{
                        ...(isPersifleurBlink
                          ? { animation: 'persifleurCardBlink 0.8s ease-in-out infinite' }
                          : {}),
                        // Un arceau (Carte Garde transformée) est tournée de 90°.
                        ...(c.isWicket ? { transform: 'rotate(90deg)' } : {}),
                      }}
                    />
                    {c.isWicket && (
                      <span className="absolute -bottom-1 -left-1 rounded bg-fuchsia-700 px-1 text-[8px] font-bold text-white">
                        Arceau
                      </span>
                    )}
                    {canGranted && (
                      <span className="pointer-events-none absolute -top-1 -left-1 rounded bg-yellow-400 px-1 text-[8px] font-bold text-black shadow">
                        ▶ action
                      </span>
                    )}
                    {isVanquishSelected && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/40 bg-red-600 text-[10px] font-bold text-white">
                        ✓
                      </span>
                    )}
                    {/* Badge MODIFICATEUR uniquement : +N quand un bonus de force
                        s'applique à l'Allié (Niquedouille, Arc et Flèches, Créature
                        Rieuse…). Pas de badge de force « brute ». */}
                    {c.type === 'ally' &&
                      strengths[c.instanceId] !== undefined &&
                      strengths[c.instanceId] - (c.strength ?? 0) !== 0 && (
                        <span
                          title={`Bonus de force : ${strengths[c.instanceId] - (c.strength ?? 0) > 0 ? '+' : ''}${
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
                    {attached.map((a, i) => (
                      <img
                        key={a.instanceId}
                        src={getCardDef(a.cardId)?.image}
                        alt={a.name}
                        title={`associé : ${a.name}`}
                        className="absolute w-8 rounded border-2 border-sky-400 shadow-md"
                        style={{ right: -4 - i * 5, bottom: -2, zIndex: 5 + i }}
                      />
                    ))}
                  </div>

                  {c.cardId === 'sherif-nottingham' && sheriffMovable.includes(c.instanceId) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSheriffMoveStart?.(c.instanceId)
                      }}
                      title="Déplacement gratuit du Shérif (1×/tour)"
                      className="mt-0.5 w-full rounded bg-amber-600 px-1 py-0.5 text-[9px] font-bold text-white hover:bg-amber-500"
                    >
                      🐎 Déplacer
                    </button>
                  )}
                  {c.cardId === 'diablo' && diabloMovable.includes(c.instanceId) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDiabloMoveStart?.(c.instanceId)
                      }}
                      title="Déplacement gratuit de Diablo (1×/tour)"
                      className="mt-0.5 w-full rounded bg-purple-700 px-1 py-0.5 text-[9px] font-bold text-white hover:bg-purple-600"
                    >
                      🦅 Déplacer
                    </button>
                  )}
                  {/* Au survol : allié et objet(s) côte à côte, même hauteur.
                      `w-auto max-w-none shrink-0` = on garde le ratio de la carte
                      (sinon le flex + max-width:100% de Tailwind l'écrasent). */}
                  {isHovered && (
                    <div className={`absolute bottom-full ${previewPos} mb-1 flex w-max items-end gap-1 rounded-lg border border-white/20 bg-[#0b0a12] p-1 shadow-2xl`}>
                      <img src={def?.image} alt={c.name} className="h-[22rem] w-auto max-w-none shrink-0 rounded" />
                      {attached.map((a) => (
                        <img
                          key={a.instanceId}
                          src={getCardDef(a.cardId)?.image}
                          alt={a.name}
                          className="h-[22rem] w-auto max-w-none shrink-0 rounded border-2 border-sky-400"
                        />
                      ))}
                    </div>
                  )}
                </figure>
              )
            })}
        </div>
      )}

      {!isCurrent && isMovable && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onMove()
          }}
          className="sweep-btn mt-auto w-full rounded bg-sky-900 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg"
          style={{ ['--sweep-color']: cellColor ?? '#334155' } as CSSProperties}
        >
          <span>Choisir</span>
        </button>
      )}
      {isCurrent && canSkipMove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onSkipMove?.()
          }}
          title="Disparition : ne pas se déplacer ce tour"
          className="mt-auto w-full animate-pulse rounded bg-emerald-500 px-2.5 py-1 text-xs font-medium text-emerald-950 hover:bg-emerald-400"
        >
          Rester ici
        </button>
      )}
    </div>
  )
}

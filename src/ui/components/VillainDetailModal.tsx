import { useState, type MouseEvent } from 'react'
import type { CardDef } from '../../data/types'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { villainPortrait, villainPresentation, PRESENTATION_TWEAK } from '../villainArt'
import { VILLAIN_GUIDE } from '../villainGuide'
import { VILLAIN_COLOR } from '../villainColors'
import { villainPack, villainCreator } from '../villainPacks'
import { useIsDesktopApp } from '../store/settingsStore'
import { Scroller } from './Scroller'
import { playPageFlip, playCardHover, playTinyButtonPress } from '../sfx'

interface Props {
  villain: VillainKey
  onClose: () => void
}

/** Libellé court du type de carte (pour le survol). */
const TYPE_LABEL: Record<string, string> = {
  ally: 'Allié',
  item: 'Objet',
  effect: 'Événement',
  condition: 'Condition',
  hero: 'Héros',
  curse: 'Malédiction',
  ingredient: 'Ingrédient',
}

/** Une carte du paquet, avec une pastille « ×N exemplaires » et un aperçu agrandi
 *  au survol (grand visuel centré à l'écran, non rogné par le défilement). */
function CardThumb({ card }: { card: CardDef }) {
  const [hover, setHover] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <figure
        className="relative m-0 cursor-zoom-in transition-transform duration-150 ease-out hover:scale-[1.04]"
        onMouseEnter={() => { playCardHover(); setHover(true) }}
        onMouseLeave={() => setHover(false)}
      >
        <img
          src={card.image}
          alt={card.name}
          title={`${card.name} — ${TYPE_LABEL[card.type] ?? card.type}`}
          className="w-full rounded-lg border border-white/15"
        />
        <span className="absolute right-1 top-1 rounded-full border border-white/30 bg-black/80 px-1.5 text-[11px] font-bold text-white">
          ×{card.copies}
        </span>
      </figure>
      {hover && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-start p-6 pl-[6vw]">
          <div className="flex max-w-[60vw] flex-col items-start gap-2">
            <img
              src={card.image}
              alt={card.name}
              className="max-h-[40vh] w-auto max-w-full rounded-2xl border border-white/25 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** Grille d'un paquet (Vilain ou Fatalité) : une vignette par carte unique. */
function DeckGallery({ title, cards, count }: { title: string; cards: CardDef[]; count: number }) {
  if (cards.length === 0) return null
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-purple-300">
        {title} <span className="font-normal text-white/40">({count} cartes)</span>
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {cards.map((c) => (
          <CardThumb key={c.id} card={c} />
        ))}
      </div>
    </section>
  )
}

/** Note de difficulté en étoiles (pleines / vides) sur `max`. */
export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span
      className="text-lg leading-none tracking-wide"
      aria-label={`Difficulté ${value} sur ${max}`}
      title={`Difficulté ${value}/${max}`}
    >
      <span className="text-amber-400">{'★'.repeat(value)}</span>
      <span className="text-white/20">{'★'.repeat(Math.max(0, max - value))}</span>
    </span>
  )
}

/** Section de conseils (titre + liste à puces). */
function TipList({ title, tips, color }: { title: string; tips: string[]; color: string }) {
  return (
    <section>
      <h3 className={`text-sm font-bold uppercase tracking-wide ${color}`}>{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {tips.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug text-white/80">
            <span className={`shrink-0 ${color}`}>•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Fiche détaillée d'un vilain : portrait, difficulté, objectif, histoire et
 * conseils pour le jouer / le contrer. Affichée en surimpression (modale).
 */
export function VillainDetailModal({ villain, onClose }: Props) {
  const v = VILLAIN_REGISTRY[villain]
  const guide = VILLAIN_GUIDE[villain]
  const presentation = villainPresentation(villain)
  // Même réglage de taille/position que le choix des vilains et l'écran versus
  // (ex. l'Imposteur, scale 0.55) — sinon l'illustration est trop grande ici.
  const tweak = PRESENTATION_TWEAK[villain]
  const presentationTransform =
    `translateX(7rem) translateY(-50%) scale(${tweak?.scale ?? 1}) translate(${tweak?.dxPct ?? 0}%, ${tweak?.dyPct ?? 0}%)`
  const [showCards, setShowCards] = useState(false)
  const [showBoard, setShowBoard] = useState(false)
  // Outil de dév (caché en exe / simulation .exe) : la couleur thématique du vilain.
  const isDesktopApp = useIsDesktopApp()
  const villainColor = VILLAIN_COLOR[v.def.id]
  // Pack du vilain (boîte) : affiche, nom, date de sortie ; tooltip = liste des vilains du pack.
  const pack = villainPack(villain)
  const packMembers = pack
    ? [...pack.villains.map((k) => VILLAIN_REGISTRY[k].def.name), ...(pack.otherMembers ?? [])]
    : []
  // Vilain de collaboration (pas de pack officiel) : on affiche son créateur à la place.
  const creator = !pack ? villainCreator(villain) : undefined
  const [packHover, setPackHover] = useState(false)

  // Cartes du vilain, séparées par paquet et triées par nombre d'exemplaires.
  const byCopies = (a: CardDef, b: CardDef) => b.copies - a.copies || a.name.localeCompare(b.name)
  const villainCards = v.cards.filter((c) => c.deck === 'villain').sort(byCopies)
  // Madame Mim — les Métamorphoses de Merlin sont une pioche À PART (entre le deck
  // Vilain et la Fatalité traditionnelle), bien qu'elles portent `deck: 'fate'`.
  const merlinCards = v.cards.filter((c) => c.isMerlinTransformation).sort(byCopies)
  // Tamatoa — la pioche MAUI est une pioche À PART (entre le deck Vilain et la Fatalité),
  // bien que ses cartes portent `deck: 'fate'`.
  const mauiCards = v.cards.filter((c) => c.isMauiCard).sort(byCopies)
  const fateCards = v.cards.filter((c) => c.deck === 'fate' && !c.isMerlinTransformation && !c.isMauiCard).sort(byCopies)
  const sumCopies = (cards: CardDef[]) => cards.reduce((n, c) => n + c.copies, 0)

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center bg-black/75 p-4 transition-all duration-300 ${
        // En vue « cartes », on pousse le modal vers la DROITE (avec une marge à
        // droite) pour dégager la place de l'illustration de présentation à gauche.
        showCards ? 'justify-end lg:pr-[4vw]' : 'justify-center'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative flex max-h-full w-full items-center transition-[max-width] duration-300 ${
          showCards ? 'max-w-6xl' : showBoard ? 'max-w-5xl' : 'max-w-2xl'
        }`}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* Présentation « corps entier » du vilain : ancrée à gauche du modal,
            son bord droit glissé DERRIÈRE le panneau (masqué par son fond opaque). */}
        {presentation && (
          <img
            src={presentation}
            alt=""
            aria-hidden
            style={{ transform: presentationTransform, transformOrigin: 'center' }}
            className="villain-fade-bottom pointer-events-none absolute right-full top-1/2 z-0 hidden h-[88vh] max-w-none object-contain object-bottom drop-shadow-[0_10px_30px_rgba(0,0,0,0.7)] lg:block"
          />
        )}
        <Scroller
        className="relative z-10 max-h-[calc(100vh-2rem)] w-full rounded-2xl border border-white/15 bg-[#120c22] p-5"
        options={{ scrollbars: { theme: 'os-theme-villain-lg', autoHide: 'never' } }}
      >
        <div className="flex flex-col gap-5">
          {/* En-tête : portrait + nom + difficulté */}
          <div className="flex items-start gap-4">
            <img
              src={villainPortrait(villain)}
              alt={v.def.name}
              className="h-32 w-32 shrink-0 rounded-lg border border-white/15 object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-2xl font-black text-amber-200">{v.def.name}</h2>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Couleur du vilain (dév, masqué en exe / simulation .exe). */}
                  {!isDesktopApp && villainColor && (
                    <span
                      className="inline-block h-6 w-6 rounded border border-white/30"
                      style={{ backgroundColor: villainColor }}
                      title={`Couleur ${villainColor}`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => { if (showCards) playPageFlip(); else playTinyButtonPress(); onClose() }}
                    className="rounded-lg border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
                  >
                    Fermer ✕
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/40">
                  Difficulté
                </span>
                <Stars value={guide.difficulty} />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
                Objectif
              </p>
              <p className="mt-1 text-sm leading-snug text-white/80">
                {v.def.boardObjective ?? v.def.objectiveDescription}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { playPageFlip(); setShowBoard(false); setShowCards((s) => !s) }}
                  className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-sm font-semibold text-amber-200 hover:bg-amber-400/10"
                >
                  {showCards ? '← Retour à la fiche' : '🃏 Voir toutes les cartes'}
                </button>
                <button
                  type="button"
                  onClick={() => { playPageFlip(); setShowCards(false); setShowBoard((s) => !s) }}
                  className="rounded-lg border border-sky-400/50 px-3 py-1.5 text-sm font-semibold text-sky-200 hover:bg-sky-400/10"
                >
                  {showBoard ? '← Retour à la fiche' : '🗺️ Voir le plateau'}
                </button>
              </div>
            </div>
          </div>

          {/* Tooltip pack (affiché À DROITE de l'écran) : affiche en grand + nom/date + vilains. */}
          {pack && packHover && (
            <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-end p-6 pr-[4vw]">
              <div className="flex max-w-xs flex-col gap-2 rounded-2xl border border-white/25 bg-[#1a1330] p-4 shadow-2xl">
                {pack.image && (
                  <img
                    src={pack.image}
                    alt={pack.name}
                    className="max-h-[55vh] w-auto max-w-full rounded-xl border border-white/20"
                  />
                )}
                <p className="text-base font-bold text-amber-200">{pack.name}</p>
                <div className="flex flex-col gap-0.5 text-xs text-white/50">
                  <span><img src="/usa.png" alt="USA" title="Sortie USA" className="mr-1 inline-block h-3.5 w-auto align-[-2px]" />{pack.releaseUS}</span>
                  <span><img src="/france.png" alt="France" title="Sortie France" className="mr-1 inline-block h-3.5 w-auto align-[-2px]" />{pack.releaseFR}</span>
                </div>
                <ul className="mt-1 space-y-0.5 text-sm text-white/75">
                  {packMembers.map((m) => (
                    <li key={m}>• {m}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {showBoard ? (
            /* Plateau du vilain (image), affiché en grand. */
            <div className="flex flex-col items-center gap-3">
              <img
                src={v.def.boardImage}
                alt={`Plateau de ${v.def.name}`}
                className="w-full rounded-lg border border-white/15 shadow-lg"
              />
            </div>
          ) : showCards ? (
            /* Galerie des cartes (Vilain + Fatalité) avec nombre d'exemplaires. */
            <div className="flex flex-col gap-5">
              <DeckGallery title="Deck Vilain" cards={villainCards} count={sumCopies(villainCards)} />
              {merlinCards.length > 0 && (
                <DeckGallery title="Métamorphoses de Merlin" cards={merlinCards} count={sumCopies(merlinCards)} />
              )}
              {mauiCards.length > 0 && (
                <DeckGallery title="Cartes Maui" cards={mauiCards} count={sumCopies(mauiCards)} />
              )}
              <DeckGallery title="Deck Fatalité" cards={fateCards} count={sumCopies(fateCards)} />
            </div>
          ) : (
            <>
          {/* Histoire */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wide text-purple-300">Histoire</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/80">{guide.story}</p>
          </section>

          {/* Conseils */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TipList title="Bien le jouer" tips={guide.playTips} color="text-emerald-300" />
            <TipList title="Le contrer" tips={guide.counterTips} color="text-red-300" />
          </div>

          {/* Pack du vilain (bas du modal) : affiche + nom ; survol → tooltip à gauche. */}
          {pack && (
            <div
              className="flex cursor-help items-center gap-3 border-t border-white/10 pt-4"
              onMouseEnter={() => { playCardHover(); setPackHover(true) }}
              onMouseLeave={() => setPackHover(false)}
            >
              {pack.image && (
                <img
                  src={pack.image}
                  alt={pack.name}
                  className="h-16 w-auto shrink-0 rounded border border-white/20 object-contain"
                />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Pack</span>
                <span className="text-sm font-semibold text-amber-100">{pack.name}</span>
              </span>
              {/* Pions des vilains du pack (implémentés), alignés à droite, côte à côte. */}
              <span className="ml-auto flex items-center gap-2">
                {pack.villains.map((k) => (
                  <img
                    key={k}
                    src={VILLAIN_REGISTRY[k].def.pawnImage}
                    alt={VILLAIN_REGISTRY[k].def.name}
                    title={VILLAIN_REGISTRY[k].def.name}
                    className="h-12 w-auto shrink-0 object-contain drop-shadow"
                  />
                ))}
              </span>
            </div>
          )}

          {/* Vilain de collaboration (sans pack) : on affiche le créateur + son pion à droite. */}
          {!pack && creator && (
            <div className="flex items-center gap-3 border-t border-white/10 pt-4">
              <span className="flex min-w-0 flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  Créateur
                </span>
                <span className="text-sm font-semibold text-amber-100">{creator}</span>
              </span>
              <span className="ml-auto flex items-center gap-2">
                <img
                  src={v.def.pawnImage}
                  alt={v.def.name}
                  title={v.def.name}
                  className="h-12 w-auto shrink-0 object-contain drop-shadow"
                />
              </span>
            </div>
          )}
            </>
          )}
        </div>
        </Scroller>
      </div>
    </div>
  )
}

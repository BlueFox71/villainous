import { useState, type MouseEvent } from 'react'
import type { CardDef } from '../../data/types'
import { VILLAIN_REGISTRY, type VillainKey } from '../store/gameStore'
import { villainPortrait, villainPresentation, PRESENTATION_TWEAK } from '../villainArt'
import { VILLAIN_GUIDE } from '../villainGuide'
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

  // Cartes du vilain, séparées par paquet et triées par nombre d'exemplaires.
  const byCopies = (a: CardDef, b: CardDef) => b.copies - a.copies || a.name.localeCompare(b.name)
  const villainCards = v.cards.filter((c) => c.deck === 'villain').sort(byCopies)
  const fateCards = v.cards.filter((c) => c.deck === 'fate').sort(byCopies)
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
          showCards ? 'max-w-6xl' : 'max-w-2xl'
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
                {v.def.objectiveDescription}
              </p>
              <button
                type="button"
                onClick={() => { playPageFlip(); setShowCards((s) => !s) }}
                className="mt-3 self-start rounded-lg border border-amber-400/50 px-3 py-1.5 text-sm font-semibold text-amber-200 hover:bg-amber-400/10"
              >
                {showCards ? '← Retour à la fiche' : '🃏 Voir toutes les cartes'}
              </button>
            </div>
          </div>

          {showCards ? (
            /* Galerie des cartes (Vilain + Fatalité) avec nombre d'exemplaires. */
            <div className="flex flex-col gap-5">
              <DeckGallery title="Deck Vilain" cards={villainCards} count={sumCopies(villainCards)} />
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
            </>
          )}
        </div>
        </Scroller>
      </div>
    </div>
  )
}

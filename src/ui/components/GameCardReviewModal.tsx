// =============================================================================
// Panneau « Rapport de tests — Cartes » (outil de dév). Ouvert en jeu (bouton-icône
// haut-gauche) ou depuis la page Rapport (clic sur la jauge de cartes d'un vilain).
// Pour un vilain (choisi via un select), montre ses cartes MÉCHANT et FATALITÉ en
// images ; chaque clic fait défiler la revue de la carte : neutre → VALIDÉE (bordure
// verte) → NON VALIDÉE (bordure rouge, à revoir) → neutre.
//
// La revue est PERSISTÉE dans le rapport (assets/test-report.json) — champs
// `validatedCards` / `rejectedCards` par vilain, COMMUNS aux deux côtés — avec
// sauvegarde automatique.
// =============================================================================

import { useMemo, useState } from 'react'
import type { CardDef } from '../../data/types'
import { plural } from '../../engine/plural'
import { villainEntry, isCustomKey, customVillainOf } from '../store/gameStore'
import { entryOf, useTestReport, SAVE_LABEL } from '../testReport/model'
import { DeckGallery } from './CardGallery'
import { Scroller } from './Scroller'

/** Un vilain de la partie (clé de rapport + nom affiché). */
export interface ReviewVillain {
  key: string
  name: string
}

export function GameCardReviewModal({ villains, onClose }: { villains: ReviewVillain[]; onClose: () => void }) {
  const [villainKey, setVillainKey] = useState<string>(villains[0]?.key ?? '')
  const { report, cycleCard, saveState } = useTestReport()
  // Revue des cartes du vilain courant — commune (pas par testeur) : validées (bordure
  // verte) et explicitement NON validées (bordure rouge, à revoir).
  const { validated, rejected } = useMemo(() => {
    const e = report ? entryOf(report, villainKey) : null
    return { validated: new Set(e?.validatedCards ?? []), rejected: new Set(e?.rejectedCards ?? []) }
  }, [report, villainKey])

  const { villainCards, fateCards, groupDecks } = useMemo(() => {
    // Custom : cartes BRUTES (conservent `group`, retiré par toCardDefs) pour isoler les
    // paquets perso (ex. « Combattant ») ; sinon ils se mélangent au deck Fatalité.
    const cards: (CardDef & { group?: string })[] =
      isCustomKey(villainKey) ? (customVillainOf(villainKey)?.cards ?? []) : (villainEntry(villainKey)?.cards ?? [])
    return {
      villainCards: cards.filter((c) => c.deck === 'villain' && !c.group),
      fateCards: cards.filter((c) => c.deck === 'fate' && !c.group),
      groupDecks: [...new Set(cards.map((c) => c.group).filter(Boolean) as string[])].map((name) => ({
        name,
        cards: cards.filter((c) => c.group === name),
      })),
    }
  }, [villainKey])
  const sumCopies = (cards: CardDef[]) => cards.reduce((n, c) => n + c.copies, 0)

  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#0b0a12]/95 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full flex-col" onClick={(e) => e.stopPropagation()}>
        {/* En-tête : titre + vilain + état + fermer */}
        <header className="flex flex-wrap items-center gap-4 border-b border-white/10 bg-black/40 px-6 py-4">
          <h2 className="text-lg font-bold uppercase tracking-wide text-amber-200">🃏 Rapport de tests — Cartes</h2>
          <label className="flex items-center gap-2 text-sm text-white/70">
            Vilain
            <select
              value={villainKey}
              onChange={(e) => setVillainKey(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#0b0a12] px-3 py-1.5 text-sm font-semibold text-white/90"
            >
              {villains.map((v) => (
                <option key={v.key} value={v.key}>{v.name}</option>
              ))}
            </select>
          </label>
          {validated.size > 0 && (
            <span className="text-sm font-semibold text-emerald-300">{validated.size} {plural(validated.size, 'validée')}</span>
          )}
          {rejected.size > 0 && (
            <span className="text-sm font-semibold text-red-300">{rejected.size} à revoir</span>
          )}
          <span
            className={`text-sm ${saveState === 'error' ? 'text-red-300' : saveState === 'saved' ? 'text-emerald-300' : 'text-white/50'}`}
          >
            {SAVE_LABEL[saveState]}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10"
          >
            ✕ Fermer
          </button>
        </header>

        {report === null ? (
          <div className="flex flex-1 items-center justify-center text-white/50">Chargement du rapport…</div>
        ) : (
          <Scroller className="flex-1">
            <div className="flex flex-col gap-6 px-6 py-5">
              <DeckGallery
                title="Deck Vilain"
                cards={villainCards}
                count={sumCopies(villainCards)}
                validatedIds={validated}
                rejectedIds={rejected}
                onToggle={(id) => cycleCard(villainKey, id)}
                zoom={false}
              />
              <DeckGallery
                title="Deck Fatalité"
                cards={fateCards}
                count={sumCopies(fateCards)}
                validatedIds={validated}
                rejectedIds={rejected}
                onToggle={(id) => cycleCard(villainKey, id)}
                zoom={false}
              />
              {groupDecks.map((g) => (
                <DeckGallery
                  key={g.name}
                  title={`Paquet « ${g.name} »`}
                  cards={g.cards}
                  count={sumCopies(g.cards)}
                  validatedIds={validated}
                  rejectedIds={rejected}
                  onToggle={(id) => cycleCard(villainKey, id)}
                  zoom={false}
                />
              ))}
            </div>
          </Scroller>
        )}
      </div>
    </div>
  )
}

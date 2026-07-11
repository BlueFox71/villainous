import { useState } from 'react'
import { villainEntry, type ShowcaseKind } from '../store/gameStore'
import { CardSelect } from './CardSelect'

interface Props {
  /** Vilain du joueur testé (natif OU publié `custom-…`) — pour lister ses Héros / Conditions. */
  villain: string
  /** Lieux du joueur (cibles de pose d'un Héros). */
  locations: { id: string; name: string }[]
  /** Alliés actuellement dans la main du joueur (pour choisir lors de Lâcheté). */
  handAllies: { instanceId: string; name: string }[]
  /** Héros actuellement sur le plateau du joueur (cibles de Voler aux Riches /
   *  Déguisement / Épée, et de Méchanceté pour les Héros ≤4). `locationId` sert au
   *  choix du sens d'Agrandir (déterminer les lieux voisins). */
  boardHeroes: { instanceId: string; name: string; strength: number; locationId: string }[]
  /** Inflige le Héros (cardId) sur le lieu choisi. */
  onInflict: (cardId: string, to: string) => void
  /** Joue la Condition (cardId). Pour Lâcheté : Allié + lieu choisis. */
  onPlayCondition: (cardId: string, opts?: { allyInstanceId?: string; to?: string }) => void
  /** Joue une carte Fatalité non-Héros (Voler aux Riches / Déguisement / Agrandir)
   *  sur un Héros du plateau. `enlargeToward` = sens du pivot pour Agrandir. */
  onPlayFateCard: (cardId: string, targetHeroId: string, enlargeToward?: string) => void
  /** Ajoute une carte (cardId) à la main du joueur (pour tester un Événement). */
  onAddToHand: (cardId: string) => void
  /** Dr Facilier : ajoute une carte (cardId) à la Pile de l'Au-delà du joueur. */
  onAddToAuDela: (cardId: string) => void
  /** Déclenche un showcase d'aperçu (pour caler les positions). */
  onShowcase: (
    kind: ShowcaseKind,
    playerIndex: number,
    opts?: { durationMs?: number; fixed?: boolean; count?: number },
  ) => void
  /** Message d'erreur de la dernière action test (pose/condition refusée). */
  error?: string | null
}

const SHOWCASE_KINDS: { kind: ShowcaseKind; label: string }[] = [
  { kind: 'card', label: 'Carte simple' },
  { kind: 'hero', label: 'Héros (vol)' },
  { kind: 'discard-red', label: 'Défausse rouge' },
  { kind: 'discard-dark', label: 'Défausse foncée' },
]

/**
 * Barre d'aide affichée en haut de la colonne joueur EN MODE TEST. Rappelle
 * comment jouer ses cartes, et permet de s'infliger un Héros Fatalité (avec
 * effets « à la pose » + showcase) ou de jouer une Condition. Les sélecteurs
 * de cartes montrent l'image au survol.
 */
export function TestFateBar({ villain, locations, handAllies, boardHeroes, onInflict, onPlayCondition, onPlayFateCard, onAddToHand, onAddToAuDela, onShowcase, error }: Props) {
  const cards = villainEntry(villain)?.cards ?? []
  const heroes = cards.filter((c) => c.deck === 'fate' && c.type === 'hero').sort((a, b) => a.name.localeCompare(b.name))
  const conditions = cards.filter((c) => c.type === 'condition').sort((a, b) => a.name.localeCompare(b.name))
  // Événements ET Ingrédients (La Méchante Reine) : ajoutables à la main pour être
  // joués via « Jouer une carte » (tester la boucle Ingrédients → Maison des Nains).
  const events = cards
    .filter((c) => c.deck === 'villain' && (c.type === 'effect' || c.type === 'ingredient'))
    .sort((a, b) => a.name.localeCompare(b.name))
  // Alliés du deck Vilain : ajoutables à la main pour les poser via « Jouer une carte ».
  const allies = cards
    .filter((c) => c.deck === 'villain' && c.type === 'ally')
    .sort((a, b) => a.name.localeCompare(b.name))
  // Objets du deck Vilain : ajoutables à la main pour les poser via « Jouer une carte ».
  const items = cards
    .filter((c) => c.deck === 'villain' && c.type === 'item')
    .sort((a, b) => a.name.localeCompare(b.name))
  // Dr Facilier : cartes Vilain pouvant être mises dans la Pile de l'Au-delà (tout
  // sauf Talisman / Divination, exclues par les règles).
  const auDelaCards = cards
    .filter((c) => c.deck === 'villain' && c.id !== 'talisman' && c.id !== 'divination-facilier')
    .sort((a, b) => a.name.localeCompare(b.name))
  // Cartes Fatalité non-Héros (Voler aux Riches = effet, Déguisement = objet) :
  // elles ciblent un Héros déjà présent sur ton plateau.
  const fateCards = cards
    .filter((c) => c.deck === 'fate' && c.type !== 'hero' && c.type !== 'condition')
    .sort((a, b) => a.name.localeCompare(b.name))

  // Cartes ajoutables à la MAIN, TOUS TYPES confondus (Événements + Alliés + Objets) :
  // une seule liste au lieu de trois lignes indistinctes ; le type est affiché dans le
  // menu (CardSelect `showType`). Chaque sous-liste est déjà triée par nom → l'ordre
  // reste groupé par type (Événements, puis Alliés, puis Objets).
  const handCards = [...events, ...allies, ...items]

  const [heroId, setHeroId] = useState(heroes[0]?.id ?? '')
  const [loc, setLoc] = useState(locations[0]?.id ?? '')
  const [condId, setCondId] = useState(conditions[0]?.id ?? '')
  const [handCardId, setHandCardId] = useState(handCards[0]?.id ?? '')
  const [auDelaCardId, setAuDelaCardId] = useState(auDelaCards[0]?.id ?? '')
  const [fateCardId, setFateCardId] = useState(fateCards[0]?.id ?? '')
  const [fateHeroId, setFateHeroId] = useState('')
  // Agrandir : sens du pivot (lieu voisin recouvert). '' = auto.
  const [fateEnlargeToward, setFateEnlargeToward] = useState('')
  // Voisins du Héros ciblé par Agrandir (pour proposer le sens gauche/droite).
  const selFateHero = boardHeroes.find((h) => h.instanceId === (fateHeroId || boardHeroes[0]?.instanceId))
  const agrandirNeighbors =
    fateCardId === 'agrandir' && selFateHero
      ? (() => {
          const i = locations.findIndex((l) => l.id === selFateHero.locationId)
          return [locations[i - 1], locations[i + 1]].filter(Boolean) as { id: string; name: string }[]
        })()
      : []
  // Lâcheté : Allié de la main + lieu choisis (sinon 1ᵉʳ Allié / 1ᵉʳ lieu).
  const [condAllyId, setCondAllyId] = useState('')
  const [condLoc, setCondLoc] = useState(locations[0]?.id ?? '')
  // Méchanceté : Héros (≤4 Force) du plateau à vaincre.
  const [condHeroId, setCondHeroId] = useState('')
  const mechHeroes = boardHeroes.filter((h) => h.strength <= 4)
  // Camp ciblé par l'aperçu de showcase (0 = joueur, 1 = adversaire).
  const [scSide, setScSide] = useState<0 | 1>(0)
  // Mode d'affichage de l'aperçu : fixe (reste à l'écran) ou limité (N secondes).
  const [scFixed, setScFixed] = useState(true)
  const [scSeconds, setScSeconds] = useState(5)
  // Nombre de cartes pour une défausse d'aperçu.
  const [scCount, setScCount] = useState(3)
  const fireShowcase = (kind: ShowcaseKind) =>
    onShowcase(kind, scSide, {
      ...(scFixed ? { fixed: true } : { durationMs: Math.max(0.5, scSeconds) * 1000 }),
      count: scCount,
    })

  return (
    <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-2 text-xs text-emerald-100">
      <div className="mb-2 font-semibold text-emerald-300">🧪 Mode Test</div>
      <ul className="mb-2 list-disc space-y-0.5 pl-4 text-[11px] text-emerald-100/85">
        <li>
          <b>Jouer une carte de la main</b> : clique « Jouer une carte » sur le plateau,
          puis la carte, puis le lieu.
        </li>
        <li><b>Recevoir un Héros</b> / <b>jouer une Condition</b> : ci-dessous (effets + showcase).</li>
        <li>Compose les plateaux via « ＋ » sur chaque lieu.</li>
      </ul>

      {/* Infliger un Héros. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <CardSelect cards={heroes} value={heroId} onChange={setHeroId} placeholder="Héros…" />
        <span className="text-emerald-200/70">sur</span>
        <select
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          className="rounded bg-black/40 px-1 py-0.5 text-white"
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <button
          onClick={() => heroId && loc && onInflict(heroId, loc)}
          disabled={!heroId || !loc}
          className="rounded bg-emerald-500 px-3 py-0.5 font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-40"
        >
          Infliger
        </button>
      </div>

      {/* Jouer une Condition. Pour Lâcheté : choix de l'Allié (main) + lieu. */}
      {conditions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <CardSelect cards={conditions} value={condId} onChange={setCondId} placeholder="Condition…" />
          {condId === 'mechancete' &&
            (mechHeroes.length === 0 ? (
              <span className="text-[10px] text-amber-300">↳ place un Héros (Force ≤4) d'abord</span>
            ) : (
              <select
                value={condHeroId || mechHeroes[0]?.instanceId || ''}
                onChange={(e) => setCondHeroId(e.target.value)}
                className="rounded bg-black/40 px-1 py-0.5 text-white"
              >
                {mechHeroes.map((h) => (
                  <option key={h.instanceId} value={h.instanceId}>{h.name} (F{h.strength})</option>
                ))}
              </select>
            ))}
          {condId === 'lachete' &&
            (handAllies.length === 0 ? (
              <span className="text-[10px] text-amber-300">↳ ajoute un Allié à ta main d'abord</span>
            ) : (
              <>
                <select
                  value={condAllyId || handAllies[0]?.instanceId || ''}
                  onChange={(e) => setCondAllyId(e.target.value)}
                  className="rounded bg-black/40 px-1 py-0.5 text-white"
                >
                  {handAllies.map((a) => (
                    <option key={a.instanceId} value={a.instanceId}>{a.name}</option>
                  ))}
                </select>
                <span className="text-emerald-200/70">sur</span>
                <select
                  value={condLoc}
                  onChange={(e) => setCondLoc(e.target.value)}
                  className="rounded bg-black/40 px-1 py-0.5 text-white"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </>
            ))}
          <button
            onClick={() =>
              condId &&
              onPlayCondition(
                condId,
                condId === 'lachete'
                  ? { allyInstanceId: condAllyId || handAllies[0]?.instanceId, to: condLoc || locations[0]?.id }
                  : condId === 'mechancete'
                    ? { allyInstanceId: condHeroId || mechHeroes[0]?.instanceId }
                    : undefined,
              )
            }
            disabled={
              !condId ||
              (condId === 'lachete' && handAllies.length === 0) ||
              (condId === 'mechancete' && mechHeroes.length === 0)
            }
            className="rounded bg-fuchsia-500 px-3 py-0.5 font-medium text-fuchsia-950 hover:bg-fuchsia-400 disabled:opacity-40"
          >
            Jouer la condition
          </button>
        </div>
      )}

      {/* Ajouter une carte à la MAIN (Événement, Allié ou Objet — tous types dans
          une seule liste, le type est indiqué dans le menu), puis la jouer via
          « Jouer une carte » sur le plateau (cibles + animations réelles). */}
      {handCards.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <CardSelect cards={handCards} value={handCardId} onChange={setHandCardId} placeholder="Carte…" showType />
          <button
            onClick={() => handCardId && onAddToHand(handCardId)}
            disabled={!handCardId}
            className="rounded bg-sky-500 px-3 py-0.5 font-medium text-sky-950 hover:bg-sky-400 disabled:opacity-40"
          >
            Ajouter à la main
          </button>
          <span className="text-[10px] text-emerald-200/70">puis « Jouer une carte » sur le plateau</span>
        </div>
      )}

      {/* Dr Facilier : remplir la Pile de l'Au-delà pour tester Divination et les
          effets Au-delà des cartes. */}
      {villain === 'facilier' && auDelaCards.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <CardSelect cards={auDelaCards} value={auDelaCardId} onChange={setAuDelaCardId} placeholder="Carte…" />
          <button
            onClick={() => auDelaCardId && onAddToAuDela(auDelaCardId)}
            disabled={!auDelaCardId}
            className="rounded bg-fuchsia-500 px-3 py-0.5 font-medium text-fuchsia-950 hover:bg-fuchsia-400 disabled:opacity-40"
          >
            Ajouter à l'Au-delà
          </button>
          <span className="text-[10px] text-emerald-200/70">puis joue Divination au Royaume du vaudou</span>
        </div>
      )}

      {/* Jouer une carte Fatalité non-Héros (Voler aux Riches / Déguisement) :
          elle cible un Héros déjà présent sur ton plateau. */}
      {fateCards.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <CardSelect cards={fateCards} value={fateCardId} onChange={setFateCardId} placeholder="Carte Fatalité…" />
          {boardHeroes.length === 0 ? (
            <span className="text-[10px] text-amber-300">↳ inflige d'abord un Héros sur ton plateau</span>
          ) : (
            <>
              <span className="text-emerald-200/70">sur</span>
              <select
                value={fateHeroId || boardHeroes[0]?.instanceId || ''}
                onChange={(e) => setFateHeroId(e.target.value)}
                className="rounded bg-black/40 px-1 py-0.5 text-white"
              >
                {boardHeroes.map((h) => (
                  <option key={h.instanceId} value={h.instanceId}>{h.name}</option>
                ))}
              </select>
              {/* Agrandir : sens du pivot si le Héros a deux voisins. */}
              {agrandirNeighbors.length >= 2 && (
                <>
                  <span className="text-emerald-200/70">pivote</span>
                  <select
                    value={fateEnlargeToward || agrandirNeighbors[0].id}
                    onChange={(e) => setFateEnlargeToward(e.target.value)}
                    className="rounded bg-black/40 px-1 py-0.5 text-white"
                  >
                    {agrandirNeighbors.map((n) => (
                      <option key={n.id} value={n.id}>→ {n.name}</option>
                    ))}
                  </select>
                </>
              )}
            </>
          )}
          <button
            onClick={() =>
              fateCardId &&
              onPlayFateCard(
                fateCardId,
                fateHeroId || boardHeroes[0]?.instanceId,
                fateCardId === 'agrandir' && agrandirNeighbors.length >= 2
                  ? fateEnlargeToward || agrandirNeighbors[0].id
                  : undefined,
              )
            }
            disabled={!fateCardId || boardHeroes.length === 0}
            className="rounded bg-amber-500 px-3 py-0.5 font-medium text-amber-950 hover:bg-amber-400 disabled:opacity-40"
          >
            Jouer sur le Héros
          </button>
        </div>
      )}

      {/* Aperçu des showcases pour caler les positions (joueur / adversaire). */}
      <div className="mt-2 border-t border-emerald-500/30 pt-1.5">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-emerald-200/70">Aperçu showcase</span>
          <div className="ml-auto flex overflow-hidden rounded border border-white/20 text-[10px]">
            <button
              onClick={() => setScSide(0)}
              className={`px-2 py-0.5 ${scSide === 0 ? 'bg-sky-500/40 text-white' : 'text-white/60 hover:bg-white/10'}`}
            >
              Joueur
            </button>
            <button
              onClick={() => setScSide(1)}
              className={`px-2 py-0.5 ${scSide === 1 ? 'bg-red-500/40 text-white' : 'text-white/60 hover:bg-white/10'}`}
            >
              Adversaire
            </button>
          </div>
        </div>
        {/* Mode d'affichage : fixe (reste, fermeture ✕) ou limité (N secondes). */}
        <div className="mb-1 flex items-center gap-1.5 text-[10px]">
          <div className="flex overflow-hidden rounded border border-white/20">
            <button
              onClick={() => setScFixed(true)}
              className={`px-2 py-0.5 ${scFixed ? 'bg-emerald-500/40 text-white' : 'text-white/60 hover:bg-white/10'}`}
            >
              Fixe
            </button>
            <button
              onClick={() => setScFixed(false)}
              className={`px-2 py-0.5 ${!scFixed ? 'bg-emerald-500/40 text-white' : 'text-white/60 hover:bg-white/10'}`}
            >
              Limité
            </button>
          </div>
          <label className={`flex items-center gap-1 ${scFixed ? 'opacity-40' : ''}`}>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={scSeconds}
              disabled={scFixed}
              onChange={(e) => setScSeconds(Math.max(0.5, Number(e.target.value) || 0.5))}
              className="w-14 rounded bg-black/40 px-1 py-0.5 text-white disabled:cursor-not-allowed"
            />
            <span className="text-white/60">s</span>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-white/60">Défausse :</span>
            <input
              type="number"
              min={1}
              max={10}
              value={scCount}
              onChange={(e) => setScCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
              className="w-12 rounded bg-black/40 px-1 py-0.5 text-white"
            />
            <span className="text-white/60">cartes</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-1">
          {SHOWCASE_KINDS.map(({ kind, label }) => (
            <button
              key={kind}
              onClick={() => fireShowcase(kind)}
              className="rounded border border-white/20 bg-white/5 px-2 py-0.5 text-[11px] text-white/85 hover:bg-white/15"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-1.5 rounded border border-red-500/60 bg-red-500/15 px-2 py-1 text-[11px] text-red-200">
          ⚠ {error}
        </div>
      )}
      <p className="mt-1 text-[10px] text-emerald-200/60">
        « Infliger » applique les règles de pose. Pour placer un Héros sans condition,
        utilise plutôt « ＋ » sur le lieu.
      </p>
    </div>
  )
}

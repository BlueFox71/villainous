import { useEffect, useRef, useState } from 'react'
import { useCustomVillainStore } from '../store/customVillainStore'
import { emptyCustomVillain, FATE_CARD_COLOR, type CustomVillain } from '../../data/customVillain'
import { villainsBackground } from '../villainColors'
import { Scroller } from '../components/Scroller'
import type { ObjectiveDef } from '../../engine/types'
import { Field, TextField, ColorField, ImageField, SelectField, NumberField } from '../editor/fields'
import { BoardTab } from '../editor/BoardTab'
import { CardsTab } from '../editor/CardsTab'
import { bakeVillain } from '../editor/bake'
import { renderCardBack } from '../editor/cardRender'

interface Props {
  onBack: () => void
  /** Lance une partie de test avec ce vilain (déjà figé/baké). */
  onPlay: (custom: CustomVillain) => void
}

/** Onglets de l'éditeur. */
type Tab = 'identity' | 'board' | 'cards'

// --- Objectif (sous-ensemble réutilisable, jouable par le moteur) ------------

type ObjKind = 'POWER_THRESHOLD' | 'CARDS_IN_REALM'

function ObjectiveEditor({
  draft,
  patch,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
}) {
  const obj = draft.objective
  const villainCards = draft.cards.filter((c) => c.deck === 'villain')

  const setKind = (kind: ObjKind) => {
    if (kind === 'POWER_THRESHOLD') patch({ objective: { type: 'POWER_THRESHOLD', threshold: 20 } })
    else
      patch({
        objective: { type: 'CARDS_IN_REALM', cardId: villainCards[0]?.id ?? '', count: 4 },
      })
  }
  const setObj = (o: ObjectiveDef) => patch({ objective: o })

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
        Condition de victoire (jouable)
      </span>
      <SelectField
        label="Type d'objectif"
        value={obj.type === 'CARDS_IN_REALM' ? 'CARDS_IN_REALM' : 'POWER_THRESHOLD'}
        options={[
          { value: 'POWER_THRESHOLD', label: 'Atteindre un seuil de pouvoir' },
          { value: 'CARDS_IN_REALM', label: 'Réunir N exemplaires d’une carte' },
        ]}
        onChange={(v) => setKind(v as ObjKind)}
      />
      {obj.type === 'POWER_THRESHOLD' && (
        <NumberField
          label="Pouvoir à atteindre"
          value={obj.threshold}
          min={5}
          max={60}
          onChange={(threshold) => setObj({ type: 'POWER_THRESHOLD', threshold })}
        />
      )}
      {obj.type === 'CARDS_IN_REALM' && (
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Carte à réunir"
            value={obj.cardId}
            options={
              villainCards.length
                ? villainCards.map((c) => ({ value: c.id, label: c.name }))
                : [{ value: '', label: '(ajoute une carte Vilain)' }]
            }
            onChange={(cardId) => setObj({ type: 'CARDS_IN_REALM', cardId, count: obj.count })}
          />
          <NumberField
            label="Nombre"
            value={obj.count}
            min={1}
            max={12}
            onChange={(count) => setObj({ type: 'CARDS_IN_REALM', cardId: obj.cardId, count })}
          />
        </div>
      )}
    </div>
  )
}

// --- Onglet Identité ---------------------------------------------------------

function IdentityTab({
  draft,
  patch,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-4">
        <TextField label="Nom du vilain" value={draft.name} onChange={(name) => patch({ name })} />
        <Field label={`Difficulté — ${draft.stars} ★`}>
          <input
            type="range"
            min={1}
            max={6}
            value={draft.stars}
            onChange={(e) => patch({ stars: Number(e.target.value) })}
            className="accent-amber-400"
          />
        </Field>
        <ColorField label="Couleur thématique" value={draft.color} onChange={(color) => patch({ color })} />
        <p className="text-xs text-white/45">
          Le dos des cartes Vilain reprend la <strong>couleur thématique</strong> ; le dos des
          cartes Fatalité reste blanc (parchemin d’origine).
        </p>
      </div>
      <div className="flex flex-col gap-4">
        <ImageField
          label="Portrait (carré)"
          value={draft.portrait}
          onChange={(portrait) => patch({ portrait })}
          aspect="square"
        />
        <ImageField
          label="Présentation (corps entier)"
          value={draft.presentation}
          onChange={(presentation) => patch({ presentation })}
          aspect="square"
        />
        <TextField
          label="Objectif (texte du plateau)"
          value={draft.boardObjective}
          onChange={(boardObjective) => patch({ boardObjective })}
          textarea
          placeholder="Ex. : Atteignez 20 jetons Pouvoir au début de votre tour."
        />
        <ObjectiveEditor draft={draft} patch={patch} />
      </div>
    </div>
  )
}

// --- Aperçu des dos de cartes (template officiel tinté) ---------------------

function CardBackPreview({ color, name, caption }: { color: string; name: string; caption: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    const h = setTimeout(() => {
      void renderCardBack(color, name).then((url) => alive && setSrc(url))
    }, 250)
    return () => {
      alive = false
      clearTimeout(h)
    }
  }, [color, name])
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="aspect-[1440/2044] w-24 overflow-hidden rounded-lg border border-white/20 shadow-lg">
        {src && <img src={src} alt={caption} className="h-full w-full object-cover" />}
      </div>
      <span className="text-[10px] text-white/50">{caption}</span>
    </div>
  )
}

// --- Écran principal ---------------------------------------------------------

export function VillainEditor({ onBack, onPlay }: Props) {
  const { villains, loaded, load, save, remove, exportJson, importJson } = useCustomVillainStore()
  const [draft, setDraft] = useState<CustomVillain | null>(null)
  const [tab, setTab] = useState<Tab>('identity')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loaded) void load()
  }, [loaded, load])

  const startEdit = (v: CustomVillain) => {
    setDraft(structuredClone(v))
    setTab('identity')
    setDirty(false)
  }

  const startNew = () => {
    const v = emptyCustomVillain(new Date().toISOString())
    setDraft(v)
    setTab('identity')
    setDirty(true)
  }

  const patch = (p: Partial<CustomVillain>) => {
    setDraft((d) => (d ? { ...d, ...p } : d))
    setDirty(true)
  }

  /** Fige toutes les images (faces + dos) puis persiste. Renvoie le vilain baké. */
  const bakeAndSave = async (v: CustomVillain): Promise<CustomVillain> => {
    setBusy(true)
    try {
      const baked = await bakeVillain(v)
      await save(baked)
      setDraft(baked)
      setDirty(false)
      return baked
    } finally {
      setBusy(false)
    }
  }

  const onSave = async () => {
    if (!draft || busy) return
    await bakeAndSave(draft)
  }

  const onPlayClick = async () => {
    if (!draft || busy) return
    if (draft.cards.filter((c) => c.deck === 'villain').length === 0) {
      alert('Ajoute au moins une carte au deck Vilain avant de tester.')
      return
    }
    const baked = await bakeAndSave(draft)
    onPlay(baked)
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      await importJson(await file.text())
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const onExport = (id: string) => {
    const json = exportJson(id)
    if (!json) return
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const bg = villainsBackground(draft?.color ?? '#3a2d6b', draft?.color ?? '#3a2d6b')

  return (
    <div className="flex h-screen flex-col text-white" style={{ background: bg }}>
      {/* Barre supérieure */}
      <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (draft ? setDraft(null) : onBack())}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
          >
            ← {draft ? 'Liste' : 'Menu'}
          </button>
          <h1 className="text-lg font-bold text-amber-200">
            {draft ? `Éditeur — ${draft.name}` : 'Atelier des vilains'}
          </h1>
        </div>
        {draft && (
          <div className="flex items-center gap-2">
            {busy ? (
              <span className="text-xs text-amber-300/70">⏳ génération…</span>
            ) : (
              dirty && <span className="text-xs text-amber-300/70">● non enregistré</span>
            )}
            <button
              type="button"
              onClick={() => onExport(draft.id)}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
            >
              Exporter
            </button>
            <button
              type="button"
              onClick={onPlayClick}
              disabled={busy}
              className="rounded-lg border border-emerald-400/60 bg-emerald-400/20 px-4 py-1.5 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/30 disabled:opacity-50"
            >
              ▶ Tester
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="rounded-lg border border-amber-400/60 bg-amber-400/20 px-4 py-1.5 text-sm font-bold text-amber-100 transition hover:bg-amber-400/30 disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        )}
      </header>

      {/* Corps */}
      {!draft ? (
        // --- Vue LISTE ---------------------------------------------------------
        <Scroller className="flex-1 p-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={startNew}
                className="rounded-xl border border-amber-400/60 bg-amber-400/20 px-5 py-2.5 font-bold text-amber-100 transition hover:bg-amber-400/30"
              >
                + Nouveau vilain
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => void onImport(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 font-semibold text-white/80 transition hover:border-amber-300/70 hover:text-amber-200"
              >
                Importer (.json)
              </button>
            </div>

            {villains.length === 0 ? (
              <p className="text-white/50">
                Aucun vilain personnalisé pour l’instant. Crée-en un avec « Nouveau vilain ».
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {villains.map((v) => (
                  <div
                    key={v.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-white/15 bg-black/30"
                  >
                    <button
                      type="button"
                      onClick={() => startEdit(v)}
                      className="relative aspect-square w-full overflow-hidden"
                      style={{ backgroundColor: v.color }}
                    >
                      {v.portrait ? (
                        <img src={v.portrait} alt={v.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-4xl text-white/30">
                          🎭
                        </div>
                      )}
                    </button>
                    <div className="flex flex-1 flex-col gap-1 p-3">
                      <span className="truncate font-semibold">{v.name}</span>
                      <span className="text-xs text-white/40">
                        {'★'.repeat(v.stars)} · {v.cards.length} cartes · {v.locations.length} lieux
                      </span>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          className="flex-1 rounded-lg border border-white/15 bg-white/5 py-1 text-xs font-semibold text-white/70 transition hover:text-amber-200"
                        >
                          Éditer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Supprimer « ${v.name} » ?`)) void remove(v.id)
                          }}
                          className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/50 transition hover:border-red-400/60 hover:text-red-300"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Scroller>
      ) : (
        // --- Vue ÉDITION -------------------------------------------------------
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Onglets */}
          <nav className="flex gap-1 border-b border-white/10 bg-black/20 px-6">
            {([
              ['identity', 'Identité'],
              ['board', 'Plateau'],
              ['cards', `Cartes (${draft.cards.length})`],
            ] as [Tab, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  tab === key
                    ? 'border-amber-400 text-amber-200'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <Scroller className="flex-1 p-6">
            <div className="mx-auto max-w-5xl">
              {tab === 'identity' && (
                <div className="flex flex-col gap-8">
                  <IdentityTab draft={draft} patch={patch} />
                  <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
                    <span className="text-xs font-semibold uppercase tracking-wide text-white/50">
                      Aperçu des dos (couleurs)
                    </span>
                    <div className="flex gap-6">
                      <CardBackPreview color={draft.color} name={draft.name} caption="Vilain" />
                      <CardBackPreview color={FATE_CARD_COLOR} name={draft.name} caption="Fatalité" />
                    </div>
                  </div>
                </div>
              )}
              {tab === 'board' && <BoardTab draft={draft} patch={patch} />}
              {tab === 'cards' && <CardsTab draft={draft} patch={patch} />}
            </div>
          </Scroller>
        </div>
      )}
    </div>
  )
}

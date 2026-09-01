// Onglet « Cartes » de l'éditeur : galerie des cartes, formulaire d'édition (avec
// illustration auto-adaptée) et aperçu live. Le comportement mécanique de la carte
// n'est pas saisi ici : on décrit l'effet dans le TEXTE de la carte, puis on le code
// à la main au moment du test (comme un vilain classique).
import { useState } from 'react'
import type { CustomVillain, CustomCard } from '../../data/customVillain'
import { plural } from '../../engine/plural'
import { emptyCustomCard, FATE_CARD_COLOR } from '../../data/customVillain'
import type { CardType, DeckKind } from '../../data/types'
import { Field, TextField, NumberField, ImageField, SelectField, ColorField, ResetButton, inputClass } from './fields'
import { CardPreview } from './CardPreview'
import { CardLayoutEditor } from './CardLayout'
import { TYPE_LABEL, TYPE_COLOR, isPreRenderedCard } from './cardRender'
import { useCustomTypesStore } from '../store/customTypesStore'

/** Toutes les catégories MÉCANIQUES connues du moteur (libellés FR de référence). */
const ALL_TYPES: { value: CardType; label: string }[] = [
  { value: 'ally', label: TYPE_LABEL.ally },
  { value: 'item', label: TYPE_LABEL.item },
  { value: 'effect', label: TYPE_LABEL.effect },
  { value: 'condition', label: TYPE_LABEL.condition },
  { value: 'hero', label: TYPE_LABEL.hero },
  { value: 'curse', label: TYPE_LABEL.curse },
  { value: 'ingredient', label: TYPE_LABEL.ingredient },
]

/** Le coût s'applique aux cartes Vilain ; la force (de base) aux Alliés/Héros. */
const hasCost = (c: CustomCard) => c.deck === 'villain'
const hasStrength = (c: CustomCard) => c.type === 'ally' || c.type === 'hero'
/** Un Objet peut afficher une FORCE FACULTATIVE et SIGNÉE (+N / −N) : purement
 *  visuel (ex. « +2 Force au Héros porteur »). 0 / vide = pas d'étoile sur la carte. */
const isItem = (c: CustomCard) => c.type === 'item'

// --- Formulaire d'une carte --------------------------------------------------

function CardForm({
  card,
  color,
  coverColor,
  fateColor,
  keywordColors = [],
  extraDecks,
  variant = false,
  base,
  onChange,
}: {
  card: CustomCard
  color: string
  /** Couleur de recouvrement du vilain (fond des champs de texte Méchant) ; à défaut, `color`. */
  coverColor?: string
  fateColor: string
  keywordColors?: { label: string; color: string }[]
  extraDecks: string[]
  /** Mode VARIANTE : seule la présentation est éditable, et seulement si la carte est marquée
   *  « diffère de la base » (variantOverride). Les champs mécaniques (paquet, catégorie, coût,
   *  force) sont masqués (hérités de la base). */
  variant?: boolean
  /** Vilain de BASE (pour afficher la carte ORIGINALE en référence sous l'aperçu). */
  base?: CustomVillain
  onChange: (c: CustomCard) => void
}) {
  const set = (p: Partial<CustomCard>) => onChange({ ...card, ...p })
  // En mode variante, la présentation n'est éditable que si la carte « diffère de la base ».
  const overriding = card.variantOverride ?? false

  // Carte ORIGINALE de la base (référence) : affichée sous l'aperçu quand la carte de variante
  // « diffère de la base », pour comparer la version re-illustrée à l'originale.
  const baseCard = variant && overriding ? base?.cards.find((c) => c.id === card.baseCardId) : undefined

  // Cadrage de l'illustration : valeur courante (avec défauts) + maj partielle. Le
  // défaut est scale 1 (100 %), décalages 0 — cible des boutons « réinitialiser ».
  const at = card.artTransform ?? { scale: 1, offsetXPct: 0, offsetYPct: 0 }
  const setArt = (p: Partial<typeof at>) => set({ artTransform: { ...at, ...p } })

  // Paquet : Vilain, Fatalité, ou un paquet personnalisé (clé « g:<nom> »). Un paquet
  // perso est hors-deck (group renseigné) ; son `deck` ne sert qu'au STYLE de la carte
  // (Méchant ou Fatalité), choisi librement carte par carte (cf. sélecteur ci-dessous).
  const deckValue = card.group ? `g:${card.group}` : card.deck
  const deckOptions = [
    { value: 'villain', label: 'Vilain' },
    { value: 'fate', label: 'Fatalité' },
    ...extraDecks.map((d) => ({ value: `g:${d}`, label: d })),
  ]
  const onDeckChange = (v: string) => {
    if (v === 'villain') set({ deck: 'villain', group: undefined })
    else if (v === 'fate') set({ deck: 'fate', group: undefined })
    // Paquet perso : on garde le style (deck) actuel de la carte, on ne force plus Vilain.
    else set({ group: v.slice(2) })
  }

  // Bibliothèque de types réutilisables (globale, partagée entre vilains).
  const { types: savedTypes, addType, removeType } = useCustomTypesStore()
  const curTypeColor = card.typeColor ?? TYPE_COLOR[card.type]

  return (
    <div className="flex flex-col gap-4">
        {/* Carte PRÉ-RENDUE (face finie importée, sans art brut ni zones de texte) : l'éditeur
            ne peut pas la recomposer, donc l'aperçu reste FIGÉ et les éditions n'apparaissent
            pas. On propose de la « rendre éditable » : on efface le composite figé pour que la
            carte se recompose depuis ses DONNÉES (nom / type / texte / coût déjà présents) sur
            le gabarit. L'illustration scannée (fusionnée dans la face) est perdue → à réajouter
            via le champ « Illustration ». */}
        {(!variant || overriding) && isPreRenderedCard(card) && (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-300/40 bg-amber-400/10 p-3">
            <span className="text-xs font-semibold text-amber-100">
              🖼️ Carte figée (image finie importée)
            </span>
            <p className="text-[11px] text-white/60">
              Cette carte est une <strong>face déjà rendue</strong> : l’aperçu ne réagit pas aux
              modifications. « Rendre éditable » la reconstruit depuis son <strong>texte</strong> et
              son <strong>type</strong> (conservés) sur le gabarit — l’<strong>illustration</strong>{' '}
              d’origine est perdue et sera à réimporter.
            </p>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    'Rendre cette carte éditable ?\n\nL’image finie sera remplacée par une carte recomposée depuis ses données (texte/type conservés). L’illustration d’origine sera perdue — tu pourras en réimporter une.',
                  )
                )
                  set({ image: '' })
              }}
              className="self-start rounded-lg border border-amber-300/60 bg-amber-400/20 px-3 py-1.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/30"
            >
              ✏️ Rendre éditable
            </button>
          </div>
        )}

        {/* VARIANTE : bascule « cette carte diffère de la base ». Décochée → la carte suit la
            base (seule la couleur de la variante la re-teinte) et n'est pas éditable ici. */}
        {variant && (
          <label className="flex items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-100">
            <input
              type="checkbox"
              className="accent-sky-400"
              checked={overriding}
              // À l'activation : on invalide le composite (image:'') pour re-baker avec l'art
              // propre à la variante. À la désactivation : on efface la présentation propre
              // (nom/texte/art) pour que la resynchro la reprenne de la base.
              onChange={(e) =>
                e.target.checked
                  ? onChange({ ...card, variantOverride: true, image: '' })
                  : onChange({
                      ...card,
                      variantOverride: undefined,
                      artImage: undefined,
                      artTransform: undefined,
                      typeLabel: undefined,
                      typeColor: undefined,
                      textLayout: undefined,
                      textBoxes: undefined,
                      stickers: undefined,
                      image: '',
                    })
              }
            />
            Cette carte diffère de la base (illustration / texte propres)
          </label>
        )}

        {variant && !overriding && (
          <div className="flex items-start gap-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="w-28 shrink-0">
              <CardPreview card={card} color={color} fateColor={fateColor} keywordColors={keywordColors} />
            </div>
            <p className="text-xs text-white/50">
              Carte <strong>liée</strong> à la base : elle en suit le nom, le texte et l’illustration
              (re-teintés à la couleur de la variante). Coche la case ci-dessus pour lui donner une
              présentation propre.
            </p>
          </div>
        )}

        {(!variant || overriding) && (
        <>
        <div className="grid grid-cols-2 gap-3">
          {/* Titre TOUJOURS en majuscules (cohérent avec le rendu de la carte). */}
          <TextField label="Nom" value={card.name.toUpperCase()} onChange={(name) => set({ name: name.toUpperCase() })} />
          {!variant && <SelectField label="Paquet" value={deckValue} options={deckOptions} onChange={onDeckChange} />}
        </div>
        {/* Paquet PERSO : on choisit librement le STYLE de la carte (Méchant ou Fatalité)
            — ex. le deck « Stand » contient des cartes des deux styles. */}
        {!variant && card.group && (
          <SelectField
            label="Style de carte"
            value={card.deck}
            options={[
              { value: 'villain', label: 'Méchant' },
              { value: 'fate', label: 'Fatalité' },
            ]}
            onChange={(v) => set({ deck: v as DeckKind })}
          />
        )}
        {/* TYPE AFFICHÉ sur la carte : nom libre + couleur (totalement indépendant de
            la catégorie moteur ci-dessous). Permet de créer un type inédit. */}
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Type (affiché sur la carte)"
            value={card.typeLabel ?? ''}
            onChange={(v) => set({ typeLabel: v.trim() ? v : undefined })}
            placeholder={TYPE_LABEL[card.type]}
          />
          <ColorField
            label="Couleur du type"
            value={curTypeColor}
            onChange={(typeColor) => set({ typeColor })}
          />
        </div>

        {/* Bibliothèque de types : mémoriser le type courant + réutiliser un type enregistré. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={!card.typeLabel?.trim()}
              onClick={() => addType(card.typeLabel!.trim(), curTypeColor)}
              title="Enregistrer ce type (nom + couleur) pour le réutiliser partout"
              className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              💾 Mémoriser ce type
            </button>
            {savedTypes.length > 0 && <span className="text-[11px] text-white/40">Types enregistrés :</span>}
          </div>
          {savedTypes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedTypes.map((t) => (
                <span
                  key={t.label}
                  className="group flex items-center gap-1 rounded-full border border-white/15 bg-black/30 py-0.5 pl-2 pr-1 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => set({ typeLabel: t.label, typeColor: t.color })}
                    title="Appliquer ce type à la carte"
                    className="flex items-center gap-1.5 font-semibold"
                  >
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <span style={{ color: t.color }}>{t.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeType(t.label)}
                    title="Oublier ce type"
                    className="ml-0.5 rounded px-1 text-white/30 transition hover:text-rose-300"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CATÉGORIE MOTEUR : indépendante du libellé. Sert au moteur (coût/force,
            ciblage Fatalité) et de base au comportement codé à la main. Masquée en variante
            (mécaniques héritées de la base). */}
        {!variant && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SelectField
            label="Catégorie (moteur)"
            value={card.type}
            options={ALL_TYPES}
            // Changer de catégorie réinitialise le type affiché + sa couleur sur les
            // valeurs par défaut de cette catégorie.
            onChange={(type) => set({ type, typeLabel: TYPE_LABEL[type], typeColor: TYPE_COLOR[type] })}
          />
          {hasCost(card) && (
            // Coût avec option « sans coût » : décocher retire la pastille de coût de la
            // carte (`cost: undefined` → le rendu ne dessine pas l'icône).
            <Field label="Coût">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  className={`${inputClass} w-16`}
                  value={card.cost ?? 0}
                  min={0}
                  max={99}
                  disabled={card.cost === undefined || !!card.costVariable}
                  onChange={(e) => set({ cost: Number(e.target.value) })}
                />
                <label className="flex cursor-pointer items-center gap-1 text-[11px] text-white/55">
                  <input
                    type="checkbox"
                    className="accent-amber-400"
                    checked={card.cost === undefined}
                    disabled={!!card.costVariable}
                    onChange={(e) => set({ cost: e.target.checked ? undefined : 1 })}
                  />
                  Sans coût
                </label>
                <label className="flex cursor-pointer items-center gap-1 text-[11px] text-white/55" title="Affiche « ? » (coût calculé en jeu, ex. = la Force du Héros ciblé)">
                  <input
                    type="checkbox"
                    className="accent-amber-400"
                    checked={!!card.costVariable}
                    onChange={(e) => set({ costVariable: e.target.checked, cost: e.target.checked ? (card.cost ?? 0) : card.cost })}
                  />
                  Coût variable (?)
                </label>
              </div>
            </Field>
          )}
          {hasStrength(card) && (
            <NumberField
              label="Force"
              value={card.strength ?? 0}
              min={0}
              max={20}
              onChange={(strength) => set({ strength })}
            />
          )}
          {isItem(card) && (
            <NumberField
              // Force affichée sur l'Objet : signée (+N / −N), facultative. 0 = pas d'étoile.
              label="Force (± , facultatif)"
              value={card.strength ?? 0}
              min={-20}
              max={20}
              onChange={(strength) => set({ strength: strength || undefined })}
            />
          )}
        </div>
        )}
        {!variant && (
        <p className="text-[11px] text-white/40">
          Le <strong>Type affiché</strong> est libre (ex. « Piratage ») et purement visuel. La{' '}
          <strong>Catégorie (moteur)</strong> détermine le comportement de base (coût, force,
          ciblage Fatalité) — choisis celle qui s’en rapproche le plus ; les effets propres au
          nouveau type se codent à la main au moment du test.
        </p>
        )}

        {/* Illustration → Texte → Symboles d'action : empilés dans la colonne de gauche
            de l'éditeur de disposition ; l'aperçu interactif reste fixe à droite. */}
        <CardLayoutEditor
          card={card}
          color={color}
          coverColor={coverColor}
          fateColor={fateColor}
          keywordColors={keywordColors}
          onChange={onChange}
          belowPreview={
            baseCard && (
              <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-white/10 bg-black/20 p-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  Carte d’origine (base)
                </span>
                <CardPreview
                  card={baseCard}
                  color={base?.color ?? color}
                  fateColor={fateColor}
                  keywordColors={base?.keywordColors}
                />
              </div>
            )
          }
          illustration={
            <div className="flex items-start gap-4">
              <ImageField
                label="Illustration"
                value={card.artImage}
                onChange={(artImage) => set({ artImage })}
                aspect="card"
              />
              <div className="flex flex-1 flex-col gap-2">
                <Field
                  label={`Zoom illustration (${Math.round(at.scale * 100)} %)`}
                  action={<ResetButton show={at.scale !== 1} onReset={() => setArt({ scale: 1 })} />}
                >
                  <input
                    type="range"
                    min={50}
                    max={250}
                    value={at.scale * 100}
                    onChange={(e) => setArt({ scale: Number(e.target.value) / 100 })}
                    className="accent-amber-400"
                  />
                </Field>
                <Field
                  label="Décalage vertical"
                  action={<ResetButton show={at.offsetYPct !== 0} onReset={() => setArt({ offsetYPct: 0 })} />}
                >
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    value={at.offsetYPct}
                    onChange={(e) => setArt({ offsetYPct: Number(e.target.value) })}
                    className="accent-amber-400"
                  />
                </Field>
                <Field
                  label="Décalage horizontal"
                  action={<ResetButton show={at.offsetXPct !== 0} onReset={() => setArt({ offsetXPct: 0 })} />}
                >
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    value={at.offsetXPct}
                    onChange={(e) => setArt({ offsetXPct: Number(e.target.value) })}
                    className="accent-amber-400"
                  />
                </Field>
              </div>
            </div>
          }
        />
        </>
        )}
    </div>
  )
}

// --- Onglet ------------------------------------------------------------------

export function CardsTab({
  draft,
  patch,
  variant = false,
  base,
}: {
  draft: CustomVillain
  patch: (p: Partial<CustomVillain>) => void
  /** Mode VARIANTE liée : la COMPOSITION du deck (ajout/retrait/paquets/quantités) vient de la
   *  base et n'est pas éditable ; chaque carte peut être marquée « diffère de la base » pour
   *  re-illustrer / re-texter (présentation seulement). */
  variant?: boolean
  /** Vilain de BASE d'une variante (si connu) : sert à afficher l'aperçu de la carte
   *  ORIGINALE sous l'aperçu quand la carte « diffère de la base ». */
  base?: CustomVillain
}) {
  const [selId, setSelId] = useState<string | null>(draft.cards[0]?.id ?? null)
  const selected = draft.cards.find((c) => c.id === selId) ?? null

  const freeCardId = () => {
    let n = 1
    const taken = new Set(draft.cards.map((c) => c.id))
    while (taken.has(`${draft.id}-c${n}`)) n++
    return `${draft.id}-c${n}`
  }

  const addCard = (deck: DeckKind, group?: string) => {
    const card = emptyCustomCard(freeCardId(), deck, deck === 'fate' ? 'hero' : 'ally')
    if (deck === 'villain') card.cost = 1
    if (card.type === 'ally' || card.type === 'hero') card.strength = 1
    if (group) card.group = group
    patch({ cards: [...draft.cards, card] })
    setSelId(card.id)
  }

  // Éditer une carte INVALIDE son composite baké (`image`) : les aperçus (galerie +
  // grand aperçu) et le prochain bake se recomposent alors depuis les données éditées.
  // Sinon une carte déjà bakée (image figée, conservée telle quelle) ignorerait toute
  // modification. Exception : carte PRÉ-RENDUE non reproductible (fichier externe sans
  // art brut, ex. import compressé Dio) → rien à recomposer, on garde le composite figé.
  const updateCard = (c: CustomCard) =>
    patch({
      cards: draft.cards.map((x) =>
        x.id === c.id ? (isPreRenderedCard(c) ? c : { ...c, image: '' }) : x,
      ),
    })

  const removeCard = (id: string) => {
    patch({ cards: draft.cards.filter((c) => c.id !== id) })
    if (selId === id) setSelId(null)
  }

  // Duplique une carte : copie profonde (effets/cadrage/illustration inclus), nouvel id,
  // nom suffixé « (COPIE) », insérée juste après l'originale (adjacente en galerie).
  const duplicateCard = (id: string) => {
    const src = draft.cards.find((c) => c.id === id)
    if (!src) return
    const copy: CustomCard = { ...structuredClone(src), id: freeCardId() }
    copy.name = `${src.name} (COPIE)`.toUpperCase()
    // IMPORTANT : on repart d'une carte « à composer ». On EFFACE le composite baké
    // (`image`) hérité de l'original — sinon la copie afficherait l'image figée de
    // l'original (aperçu galerie = `card.image` tel quel) et ignorerait toute édition.
    // L'`artImage`/cadrage sont conservés ; le composite est régénéré au bake/publish.
    copy.image = ''
    const i = draft.cards.findIndex((c) => c.id === id)
    const next = [...draft.cards]
    next.splice(i + 1, 0, copy)
    patch({ cards: next })
    setSelId(copy.id)
  }

  // --- Paquets personnalisés (hors Vilain/Fatalité) --------------------------
  const extraDecks = draft.extraDecks ?? []
  const addExtraDeck = () => {
    const name = prompt('Nom du nouveau paquet (ex. « Transformation », « Stands », « Maui ») :')?.trim()
    if (!name) return
    if (extraDecks.some((d) => d.toLowerCase() === name.toLowerCase())) {
      alert('Un paquet porte déjà ce nom.')
      return
    }
    patch({ extraDecks: [...extraDecks, name] })
  }
  const removeExtraDeck = (name: string) => {
    const inDeck = draft.cards.filter((c) => c.group === name)
    if (
      inDeck.length > 0 &&
      !confirm(`Supprimer le paquet « ${name} » ? Ses ${inDeck.length} ${plural(inDeck.length, 'carte')} repasseront dans le deck Vilain.`)
    )
      return
    patch({
      extraDecks: extraDecks.filter((d) => d !== name),
      cards: draft.cards.map((c) => (c.group === name ? { ...c, group: undefined } : c)),
    })
  }

  const villainCards = draft.cards.filter((c) => c.deck === 'villain' && !c.group)
  const fateCards = draft.cards.filter((c) => c.deck === 'fate' && !c.group)

  // Ordre de navigation « Carte précédente / suivante » = ordre d'affichage des galeries
  // (Vilain, puis Fatalité, puis chaque paquet perso).
  const orderedCards = [
    ...villainCards,
    ...fateCards,
    ...extraDecks.flatMap((name) => draft.cards.filter((c) => c.group === name)),
  ]
  const selIndex = orderedCards.findIndex((c) => c.id === selId)
  const goToCard = (delta: -1 | 1) => {
    const next = orderedCards[selIndex + delta]
    if (next) setSelId(next.id)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* « Mots-clés colorés » retiré de l'éditeur : la coloration des mots passe désormais
          par les TYPES mémorisés (« Mémoriser ce type »), qui colorent déjà leur libellé
          dans le texte. Le rendu d'anciens `keywordColors` reste supporté (compatibilité). */}
      {variant && (
        <p className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-3 text-xs text-sky-100/80">
          Variante liée : la composition du deck vient de la base. Sélectionne une carte puis coche
          <strong> « Cette carte diffère de la base » </strong> pour lui donner une illustration /
          un texte propres. Les cartes non modifiées suivent la base (re-teintées à ta couleur).
        </p>
      )}

      {/* Galerie */}
      <div className="flex flex-col gap-4">
        {!variant && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => addCard('villain')}
            className="rounded-lg border border-amber-400/50 bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/25"
          >
            + Carte Vilain
          </button>
          <button
            type="button"
            onClick={() => addCard('fate')}
            className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20"
          >
            + Carte Fatalité
          </button>
          <button
            type="button"
            onClick={addExtraDeck}
            title="Créer un paquet hors-deck (Transformation, Stands, Maui…)"
            className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/20"
          >
            + Paquet perso
          </button>
          <span className="ml-2 text-xs text-white/40">
            Deck Vilain : {villainCards.length} {plural(villainCards.length, 'modèle')} · Fatalité : {fateCards.length} — quantités dans l’onglet « Quantité »
          </span>
        </div>
        )}

        <CardRow title="Deck Vilain" cards={villainCards} selId={selId} onSelect={setSelId} onRemove={removeCard} color={draft.color} fateColor={FATE_CARD_COLOR} keywordColors={draft.keywordColors} readOnly={variant} />
        <CardRow title="Deck Fatalité" cards={fateCards} selId={selId} onSelect={setSelId} onRemove={removeCard} color={draft.color} fateColor={FATE_CARD_COLOR} keywordColors={draft.keywordColors} readOnly={variant} />

        {/* Paquets personnalisés (hors-deck) */}
        {extraDecks.map((name) => (
          <div key={name} className="flex flex-col gap-2 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-sky-200/80">
                Paquet perso — {name}
              </span>
              {!variant && (
                <>
                  <button
                    type="button"
                    onClick={() => addCard('villain', name)}
                    className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-2 py-1 text-xs font-semibold text-sky-100 transition hover:bg-sky-400/20"
                  >
                    + Méchant
                  </button>
                  <button
                    type="button"
                    onClick={() => addCard('fate', name)}
                    className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/20"
                  >
                    + Fatalité
                  </button>
                  <button
                    type="button"
                    onClick={() => removeExtraDeck(name)}
                    className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/50 transition hover:border-rose-400/60 hover:text-rose-300"
                  >
                    Supprimer le paquet
                  </button>
                </>
              )}
            </div>
            <CardRow
              cards={draft.cards.filter((c) => c.group === name)}
              selId={selId}
              onSelect={setSelId}
              onRemove={removeCard}
              color={draft.color}
              fateColor={FATE_CARD_COLOR}
              keywordColors={draft.keywordColors}
              readOnly={variant}
              emptyHint="Aucune carte : « + Carte » pour en ajouter."
            />
          </div>
        ))}
      </div>

      {/* Formulaire de la carte sélectionnée */}
      {selected ? (
        <div className="rounded-xl border border-white/15 bg-black/25 p-4">
          {/* Navigation entre cartes (ordre des galeries). */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => goToCard(-1)}
              disabled={selIndex <= 0}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ◀ Carte précédente
            </button>
            <span className="text-xs text-white/40">
              {selIndex + 1} / {orderedCards.length}
            </span>
            <div className="flex items-center gap-2">
              {!variant && (
                <button
                  type="button"
                  onClick={() => duplicateCard(selected.id)}
                  className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20"
                  title="Dupliquer cette carte"
                >
                  ⧉ Dupliquer
                </button>
              )}
              <button
                type="button"
                onClick={() => goToCard(1)}
                disabled={selIndex < 0 || selIndex >= orderedCards.length - 1}
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white/80 transition enabled:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Carte suivante ▶
              </button>
            </div>
          </div>
          <CardForm
            card={selected}
            color={draft.color}
            coverColor={draft.coverColor}
            fateColor={FATE_CARD_COLOR}
            keywordColors={draft.keywordColors}
            extraDecks={extraDecks}
            variant={variant}
            base={base}
            onChange={updateCard}
          />
        </div>
      ) : (
        <p className="text-white/50">Sélectionne une carte ou ajoutes-en une pour l’éditer.</p>
      )}
    </div>
  )
}

function CardRow({
  title,
  cards,
  selId,
  onSelect,
  onRemove,
  color,
  fateColor,
  keywordColors = [],
  emptyHint,
  readOnly = false,
}: {
  title?: string
  cards: CustomCard[]
  selId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  color: string
  fateColor: string
  keywordColors?: { label: string; color: string }[]
  emptyHint?: string
  /** Mode VARIANTE : pas de suppression de carte (deck partagé avec la base). */
  readOnly?: boolean
}) {
  if (cards.length === 0) {
    if (emptyHint) return <p className="text-[11px] text-white/40">{emptyHint}</p>
    return null
  }
  return (
    <div className="flex flex-col gap-2">
      {title && <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{title}</span>}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cards.map((c) => (
          <div key={c.id} className="relative w-28 shrink-0">
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={`block w-full overflow-hidden rounded-lg border-2 transition ${
                selId === c.id ? 'border-amber-400' : 'border-transparent hover:border-white/30'
              }`}
            >
              <CardPreview card={c} color={color} fateColor={fateColor} keywordColors={keywordColors} />
              <span className="block truncate px-1 py-0.5 text-center text-[11px] text-white/70">
                {c.name}
              </span>
              {/* Pastille « diffère » sur les cartes de variante re-illustrées/re-textées. */}
              {c.variantOverride && (
                <span
                  className="absolute left-1 top-1 rounded bg-sky-500/80 px-1 text-[9px] font-bold text-white"
                  title="Cette carte diffère de la base"
                >
                  ✎
                </span>
              )}
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                className="absolute right-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white/70 transition hover:text-red-300"
                title="Supprimer"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

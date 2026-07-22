import { useState } from 'react'

/**
 * Modale de CHOIX générique et réutilisable. Centrée à l'écran, fond sombre
 * identique au reste de l'UI (#0b0a12). À utiliser pour tout choix « prends une
 * option parmi N » (Rapetisser/Agrandir, choix de sens, options de cartes…).
 *
 * Chaque option = un libellé (+ description / image facultatives) et une action.
 * `onCancel` (optionnel) ajoute un bouton de fermeture/annulation.
 */
export interface ChoiceOption {
  /** Identifiant React (stable). À défaut, l'index est utilisé. */
  key?: string
  /** Libellé principal du bouton. */
  label: string
  /** Texte secondaire optionnel sous le libellé. */
  description?: string
  /** Illustration optionnelle (carte, etc.). */
  imageSrc?: string
  /** Désactive l'option (grisée, non cliquable). */
  disabled?: boolean
  onSelect: () => void
}

interface Props {
  /** Titre de la modale. */
  title: string
  /** Consigne courte sous le titre. */
  prompt?: string
  /** Contenu libre affiché entre la consigne et les options (ex. carte révélée). */
  header?: React.ReactNode
  options: ChoiceOption[]
  /** Disposition : 'list' (boutons empilés, défaut) ou 'row' (côte à côte, pour
   *  des options avec image). */
  layout?: 'list' | 'row'
  /** Classe CSS des images d'option (défaut `mb-1 h-28 w-auto rounded`). Permet d'agrandir les
   *  cartes (ex. sélecteur de défausse) ; un `hover:scale-*` est ajouté automatiquement. */
  imageClassName?: string
  /** Contenu optionnel ancré en HAUT À DROITE de la modale (ex. bouton « voir la défausse »). */
  topRight?: React.ReactNode
  /** Largeur max (classe Tailwind) du panneau — défaut `max-w-md`. Élargir pour une rangée de
   *  grandes cartes (ex. `max-w-3xl`). */
  maxWidthClass?: string
  /** Bouton d'annulation/fermeture (optionnel). */
  onCancel?: () => void
  cancelLabel?: string
  /** Ajoute un bouton « Voir le plateau » : escamote temporairement la modale pour
   *  consulter le plateau (ex. Dingo : voir où sont les tuiles avant de choisir). */
  peekable?: boolean
}

export function ChoiceModal({ title, prompt, header, options, layout = 'list', imageClassName, topRight, maxWidthClass = 'max-w-md', onCancel, cancelLabel = 'Annuler', peekable = false }: Props) {
  const [peek, setPeek] = useState(false)
  // Mode « voir le plateau » : on n'affiche qu'un bouton flottant pour revenir au choix,
  // le reste de l'écran (plateau) est visible et inerte.
  if (peek) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center">
        <button
          type="button"
          onClick={() => setPeek(false)}
          className="pointer-events-auto rounded-full border border-white/30 bg-[#0b0a12]/95 px-4 py-2 text-sm font-semibold text-amber-200 shadow-2xl hover:bg-[#0b0a12]"
        >
          ↩ Revenir au choix
        </button>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
      <div className={`w-full ${maxWidthClass} rounded-2xl border border-white/20 bg-[#0b0a12] p-4 shadow-2xl`}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-bold text-white">{title}</h2>
          {topRight && <div className="shrink-0">{topRight}</div>}
        </div>
        {prompt && <p className="mt-1 text-xs text-white/60">{prompt}</p>}
        {header && <div className="mt-3 flex justify-center">{header}</div>}
        <div className={`mt-3 ${layout === 'row' ? 'flex flex-wrap justify-center gap-2' : 'flex flex-col gap-2'}`}>
          {options.map((o, i) => (
            <button
              key={o.key ?? i}
              type="button"
              disabled={o.disabled}
              onClick={o.onSelect}
              className={`flex ${layout === 'row' ? 'flex-col items-center text-center' : 'flex-col text-left'} rounded-lg border px-3 py-2 text-sm transition ${
                o.disabled
                  ? 'cursor-not-allowed border-white/10 text-white/30'
                  : 'border-white/30 bg-white/5 text-white hover:border-white/60 hover:bg-white/10'
              }`}
            >
              {o.imageSrc && (
                <img
                  src={o.imageSrc}
                  alt={o.label}
                  className={`${imageClassName ?? 'mb-1 h-28 w-auto rounded'} transition-transform duration-150 hover:scale-110`}
                />
              )}
              {o.label && <span className="font-medium">{o.label}</span>}
              {o.description && <span className="mt-0.5 text-xs text-white/50">{o.description}</span>}
            </button>
          ))}
        </div>
        {(onCancel || peekable) && (
          <div className="mt-3 flex justify-between gap-2">
            {peekable ? (
              <button
                type="button"
                onClick={() => setPeek(true)}
                className="rounded-lg border border-white/20 px-3 py-1 text-xs text-amber-200/90 hover:bg-white/10"
              >
                👁 Voir le plateau
              </button>
            ) : (
              <span />
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                {cancelLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import type { ComponentProps } from 'react'

type OsProps = ComponentProps<typeof OverlayScrollbarsComponent>

/**
 * Zone défilable à scrollbar custom OverlayScrollbars : fine, sombre, en overlay
 * (ne prend pas de place), qui apparaît/disparaît EN FONDU au survol (`autoHide:
 * 'leave'`). OverlayScrollbars insère ses propres wrappers ; les classes de
 * layout des enfants doivent donc être portées par un conteneur DANS `children`,
 * pas par `className` (qui style l'hôte). Le thème `os-theme-villain` est défini
 * dans index.css ; la CSS de base est importée dans main.tsx.
 *
 * Accepte les mêmes props que `OverlayScrollbarsComponent` (className, style,
 * element, événements…) ; seul le thème/`autoHide` est pré-réglé (surchargeable
 * via `options.scrollbars`).
 */
export function Scroller({ options, ...rest }: OsProps) {
  // `options` peut être `false`/`undefined` : on ne garde que l'objet.
  const o = typeof options === 'object' && options ? options : undefined
  return (
    <OverlayScrollbarsComponent
      defer
      options={{
        ...o,
        scrollbars: {
          theme: 'os-theme-villain',
          autoHide: 'leave',
          autoHideDelay: 300,
          ...o?.scrollbars,
        },
      }}
      {...rest}
    />
  )
}

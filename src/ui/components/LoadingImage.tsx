import { useCallback, useState, type ImgHTMLAttributes } from 'react'

interface LoadingImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Classes de BOÎTE du conteneur (taille / aspect / bordure) : c'est lui qui réserve la
   *  place et porte le squelette + le spinner tant que l'image n'est pas chargée. `relative`
   *  et `overflow-hidden` sont ajoutés automatiquement. */
  wrapperClassName?: string
  /** Petit spinner (images de petite taille) plutôt que le format normal. */
  spinnerSize?: 'sm' | 'md'
}

// URLs déjà affichées AU MOINS une fois (mémoire au niveau module, persistante entre montages).
// Sans cela, changer d'onglet dans la fiche démonte puis remonte les images : l'état `loaded`
// repartait à zéro → re-spinner + re-fondu inutiles pour une image déjà en cache. Ici, une image
// déjà vue réapparaît AUSSITÔT (spinner + fondu sautés).
const loadedSrcs = new Set<string>()

/**
 * Image avec état de CHARGEMENT : tant que le fichier / la dataURL n'est pas décodé, on
 * affiche un squelette pulsé + un spinner dans le conteneur, puis l'image apparaît en fondu.
 * Les grosses images (cartes, plateau, dataURL de vilains publiés) peuvent tarder à
 * s'afficher : ce retour visuel évite les « trous » vides dans la fiche du vilain.
 *
 * Une image DÉJÀ chargée (revenue via un changement d'onglet, ou en cache navigateur) s'affiche
 * immédiatement, sans re-spinner : on retient les URLs vues (`loadedSrcs`) et on détecte
 * `img.complete` au montage (l'événement `onLoad` ne se redéclenche pas pour une image en cache).
 *
 * Le conteneur (`wrapperClassName`) doit RÉSERVER la place (taille fixe ou `aspect-…`), sinon
 * le spinner n'aurait aucune hauteur avant le chargement.
 */
export function LoadingImage({
  wrapperClassName = '',
  spinnerSize = 'md',
  className = '',
  src,
  onLoad,
  onError,
  ...img
}: LoadingImageProps) {
  // Init synchrone : si l'URL a déjà été chargée, on démarre « chargé » (aucun spinner au retour).
  const [loaded, setLoaded] = useState(() => typeof src === 'string' && loadedSrcs.has(src))

  // Ref : capte une image DÉJÀ complète au montage (cache navigateur) — sinon `onLoad` ne se
  // déclenche pas et le spinner resterait bloqué.
  const refCb = useCallback(
    (node: HTMLImageElement | null) => {
      if (node?.complete && node.naturalWidth > 0) {
        if (typeof src === 'string') loadedSrcs.add(src)
        setLoaded(true)
      }
    },
    [src],
  )

  return (
    <span className={`relative block overflow-hidden ${wrapperClassName}`}>
      {!loaded && (
        <span className="absolute inset-0 z-10 flex animate-pulse items-center justify-center bg-white/[0.06]">
          <span
            className={`${spinnerSize === 'sm' ? 'h-5 w-5' : 'h-8 w-8'} animate-spin rounded-full border-2 border-white/20 border-t-amber-300`}
          />
        </span>
      )}
      <img
        {...img}
        ref={refCb}
        src={src}
        onLoad={(e) => {
          if (typeof src === 'string') loadedSrcs.add(src)
          setLoaded(true)
          onLoad?.(e)
        }}
        onError={(e) => { setLoaded(true); onError?.(e) }}
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </span>
  )
}

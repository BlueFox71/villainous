import { useState, type ImgHTMLAttributes } from 'react'

interface LoadingImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  /** Classes de BOÎTE du conteneur (taille / aspect / bordure) : c'est lui qui réserve la
   *  place et porte le squelette + le spinner tant que l'image n'est pas chargée. `relative`
   *  et `overflow-hidden` sont ajoutés automatiquement. */
  wrapperClassName?: string
  /** Petit spinner (images de petite taille) plutôt que le format normal. */
  spinnerSize?: 'sm' | 'md'
}

/**
 * Image avec état de CHARGEMENT : tant que le fichier / la dataURL n'est pas décodé, on
 * affiche un squelette pulsé + un spinner dans le conteneur, puis l'image apparaît en fondu.
 * Les grosses images (cartes, plateau, dataURL de vilains publiés) peuvent tarder à
 * s'afficher : ce retour visuel évite les « trous » vides dans la fiche du vilain.
 *
 * Le conteneur (`wrapperClassName`) doit RÉSERVER la place (taille fixe ou `aspect-…`), sinon
 * le spinner n'aurait aucune hauteur avant le chargement.
 */
export function LoadingImage({
  wrapperClassName = '',
  spinnerSize = 'md',
  className = '',
  onLoad,
  onError,
  ...img
}: LoadingImageProps) {
  const [loaded, setLoaded] = useState(false)
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
        onLoad={(e) => { setLoaded(true); onLoad?.(e) }}
        onError={(e) => { setLoaded(true); onError?.(e) }}
        className={`${className} transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </span>
  )
}

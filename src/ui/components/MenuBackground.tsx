import { MenuOrbs } from './MenuOrbs'

/**
 * Arrière-plan partagé des écrans « menu » (accueil, nouvelle partie…) : photo
 * de fond + voile léger + orbes flottants. Monté UNE seule fois à la racine et
 * persistant entre les navigations, pour que les orbes ne « repartent » pas à
 * chaque changement de page. On le masque (opacité) sur les écrans qui ont leur
 * propre fond plutôt que de le démonter.
 */
export function MenuBackground({ visible }: { visible: boolean }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0b0a12] transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden
    >
      {/* Image de fond. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/menu_bg_disney.jpg)' }}
      />
      {/* Voile léger pour ne pas gêner le premier plan. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 0%, rgba(37,20,71,0.38) 0%, rgba(19,12,36,0.48) 45%, rgba(11,10,18,0.6) 100%)',
        }}
      />
      {/* Orbes lumineux flottants. */}
      <MenuOrbs />
    </div>
  )
}

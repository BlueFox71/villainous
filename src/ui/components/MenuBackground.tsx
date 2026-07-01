import { MenuOrbs } from './MenuOrbs'

/**
 * Arrière-plan partagé des écrans « menu » (accueil, nouvelle partie…) : photo
 * de fond + voile léger + orbes flottants. Monté UNE seule fois à la racine et
 * persistant entre les navigations, pour que les orbes ne « repartent » pas à
 * chaque changement de page. On le masque (opacité) sur les écrans qui ont leur
 * propre fond plutôt que de le démonter.
 *
 * En revanche, les orbes (77 divs animés en CSS) ne sont rendus QUE lorsque le
 * fond est visible : sinon leurs animations continueraient de tourner en tâche
 * de fond (opacity:0 n'arrête pas une animation CSS) et feraient ramer les
 * animations de la partie. Tous les écrans de menu étant « visibles », les
 * orbes restent continus entre eux ; ils ne se démontent qu'en entrant en jeu.
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
      {/* Orbes lumineux flottants — rendus seulement quand le fond est visible,
          pour ne pas laisser 77 animations CSS tourner sur la page de jeu. */}
      {visible && <MenuOrbs />}
    </div>
  )
}

import { useEffect, useState } from 'react'

/** Rectangle écran (px) capturé via getBoundingClientRect. */
export interface FlightRect {
  left: number
  top: number
  width: number
  height: number
}

export interface CardFlight {
  id: number
  image: string
  from: FlightRect
  to: FlightRect
}

const FLIGHT_MS = 500

/** Une carte qui « vole » de `from` vers `to` (interpolation CSS), puis disparaît. */
function FlyingCard({ flight, onDone }: { flight: CardFlight; onDone: (id: number) => void }) {
  const [go, setGo] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setGo(true))
    const t = window.setTimeout(() => onDone(flight.id), FLIGHT_MS + 30)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [flight.id, onDone])
  const r = go ? flight.to : flight.from
  return (
    <img
      src={flight.image}
      alt=""
      className="pointer-events-none fixed z-[55] rounded-lg shadow-2xl ring-1 ring-white/30"
      style={{
        left: `${r.left}px`,
        top: `${r.top}px`,
        width: `${r.width}px`,
        height: `${r.height}px`,
        opacity: go ? 0.6 : 1,
        transition: `left ${FLIGHT_MS}ms cubic-bezier(0.4,0,0.2,1), top ${FLIGHT_MS}ms cubic-bezier(0.4,0,0.2,1), width ${FLIGHT_MS}ms ease, height ${FLIGHT_MS}ms ease, opacity ${FLIGHT_MS}ms ease-in`,
      }}
    />
  )
}

/** Overlay des cartes en vol (pose, pioche, défausse…). Purement décoratif. */
export function CardFlights({ flights, onDone }: { flights: CardFlight[]; onDone: (id: number) => void }) {
  if (flights.length === 0) return null
  // z-10 : au-dessus du plateau mais SOUS la main / les panneaux (bottom-bar z-20)
  // et le chrome → les cartes en vol se glissent derrière la main et ne restent
  // pas au premier plan en arrivant à destination.
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {flights.map((f) => (
        <FlyingCard key={f.id} flight={f} onDone={onDone} />
      ))}
    </div>
  )
}

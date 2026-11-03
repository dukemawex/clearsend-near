import { EscrowList } from "@/components/EscrowList";
export default function Trips() { return <><h1>Trips</h1><p className="muted">Flight bookings settled through escrow. Traveller details are never stored on-chain; only a salted hash binds the ticket to them.</p><EscrowList flightsOnly /></>; }

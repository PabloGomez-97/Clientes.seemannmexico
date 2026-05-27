// src/components/administrador/CustomerBehaviorTracking/OP-ComportamientoDeClientes.tsx
// Behavior tracking dashboard – ADMIN view: shows ALL clients in the portal.
// Thin wrapper around ComportamientoDeClientes with scope="admin".
import ComportamientoDeClientes from "./ComportamientoDeClientes";

export default function OPComportamientoDeClientes() {
  return <ComportamientoDeClientes scope="admin" />;
}

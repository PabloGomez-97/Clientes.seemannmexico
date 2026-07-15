/**
 * Alias de nombres de origen/destino del sheet → clave en airportCoordinates.
 * Agregar aquí cuando en tarifas aparezca un nombre distinto al del catálogo geo.
 */
export const AIRPORT_ORIGIN_KEY_ALIASES: Readonly<Record<string, string>> = {
  // Reino Unido / Londres
  londres: "london",
  london: "london",
  "london heathrow": "london",
  heathrow: "london",
  lhr: "london",
  inglaterra: "london",
  england: "london",
  "united kingdom": "london",
  uk: "london",
  "reino unido": "london",

  // Chile / Santiago
  santiago: "santiago_de_chile",
  "santiago de chile": "santiago_de_chile",
  "santiago chile": "santiago_de_chile",

  // México — CDMX / Benito Juárez (nombre en tarifas vs clave ciudad_de_mexico)
  "ciudad de mexico": "ciudad_de_mexico",
  "mexico city": "ciudad_de_mexico",
  "aeropuerto internacional benito juarez": "ciudad_de_mexico",
  "benito juarez": "ciudad_de_mexico",

  guaira: "la_guaira",

  // Brasil — São Paulo (GRU en Guarulhos)
  "sao paulo": "guarulhos",

  // Brasil — Belo Horizonte (CNF)
  "belo horizonte": "belo_horizonte",

  // Sudáfrica (ya existían parciales en getAirportByOrigin)
  "sudafrica johannesburgo": "sudafrica",
  "south africa johannesburg": "sudafrica",
  johannesburgo: "johannesburg",
};

/**
 * País ISO2 cuando el nombre del sheet no resuelve aeropuerto pero sí país (reserva).
 */
export const AIRPORT_ORIGIN_COUNTRY_FALLBACK: Readonly<Record<string, string>> =
{
  inglaterra: "GB",
  england: "GB",
  londres: "GB",
  uk: "GB",
};

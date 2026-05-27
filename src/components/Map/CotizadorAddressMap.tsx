import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  GoogleMap,
  Marker,
  InfoWindow,
  DirectionsRenderer,
  useJsApiLoader,
} from "@react-google-maps/api";
/**
 * Coordenadas genéricas de destino (aeropuerto o puerto).
 * Compatible con AirportCoords e PortCoords.
 */
export interface DestinationCoords {
  lat: number;
  lng: number;
  name: string;
  /** Código identificador: IATA para aeropuertos, UN/LOCODE para puertos */
  code: string;
}

type Coordinates = {
  lat: number;
  lng: number;
};

type SuggestionItem = {
  placeId: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _raw: any; // raw placePrediction from new Places API
};

const defaultCenter: Coordinates = {
  lat: -33.4489,
  lng: -70.6693,
};

const mapContainerStyle: React.CSSProperties = {
  height: "100%",
  width: "100%",
};

// ⚠️ Importar siempre desde googleMapsConfig para que el singleton del
// loader reciba exactamente las mismas opciones en toda la aplicación.
import { GOOGLE_MAPS_LIBRARIES } from "../../config/googleMapsConfig";

const libraries = GOOGLE_MAPS_LIBRARIES;

function formatDistanceToKm(
  distance: google.maps.Distance | null | undefined,
): string | null {
  if (!distance) return null;

  // Google devuelve `value` en metros; usamos ese valor para evitar millas.
  if (typeof distance.value === "number") {
    const km = distance.value / 1000;
    return `${km.toFixed(1)} km`;
  }

  // Fallback por si el valor no viene disponible.
  return distance.text ?? null;
}

interface CotizadorAddressMapProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  /** Coordenadas del destino (aeropuerto o puerto) para trazar la ruta con Directions API */
  destinationCoords?: DestinationCoords | null;
  /** Etiqueta opcional para el campo de recogida (mostrada en el header de 2 columnas) */
  pickupLabel?: string;
  /** Cuando se provee, muestra un campo de entrega de solo lectura al lado del campo de recogida
   *  y el mapa ocupa el ancho completo debajo de ambos. */
  deliveryValue?: string;
  /** Etiqueta para el campo de entrega */
  deliveryLabel?: string;
  /** Deshabilita el campo de recogida (p.ej. hasta que se seleccione un puerto) */
  disabled?: boolean;
  /** Callback que se invoca con las coordenadas de la dirección de recogida
   *  cuando el cliente selecciona una sugerencia. Se invoca con `null` cuando
   *  el campo se vacía. */
  onPickupCoordsChange?: (coords: { lat: number; lng: number } | null) => void;
  /** Contenido a inyectar entre los inputs y el mapa */
  middleContent?: ReactNode;
}

const CotizadorAddressMap = ({
  value,
  onChange,
  placeholder = "Ingrese direccion de recogida",
  rows = 2,
  destinationCoords,
  pickupLabel,
  deliveryValue,
  deliveryLabel,
  disabled = false,
  onPickupCoordsChange,
  middleContent,
}: CotizadorAddressMapProps) => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
    libraries,
  });

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [selectedPosition, setSelectedPosition] =
    useState<Coordinates>(defaultCenter);
  const [hasSelection, setHasSelection] = useState(false);
  const [showInfoWindow, setShowInfoWindow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);

  const debounceRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Debounced autocomplete search using the new Places API (AutocompleteSuggestion)
  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    if (value.trim().length < 3 || !isLoaded) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      setError(null);
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const PlacesNS = google.maps.places as any;

        if (PlacesNS.AutocompleteSuggestion) {
          // New Places API
          const { suggestions: rawSuggestions } =
            await PlacesNS.AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: value.trim(),
            });

          const results: SuggestionItem[] = (rawSuggestions ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s: any) => ({
              placeId: s.placePrediction.placeId,
              description: s.placePrediction.text.toString(),
              _raw: s.placePrediction,
            }),
          );
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } else {
          // Fallback: old AutocompleteService (for accounts that still have it)
          const service = new google.maps.places.AutocompleteService();
          service.getPlacePredictions(
            { input: value.trim() },
            (predictions, status) => {
              if (
                status === google.maps.places.PlacesServiceStatus.OK &&
                predictions
              ) {
                const results: SuggestionItem[] = predictions.map((p) => ({
                  placeId: p.place_id,
                  description: p.description,
                  _raw: null,
                }));
                setSuggestions(results);
                setShowSuggestions(results.length > 0);
              } else {
                setSuggestions([]);
                setShowSuggestions(false);
              }
            },
          );
        }
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
        setError(
          "No se pudo validar la direccion en este momento. Intentalo nuevamente.",
        );
      } finally {
        setIsLoading(false);
      }
    }, 450);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [value, isLoaded]);

  // Calculate route when we have both a selected position and airport coords
  useEffect(() => {
    if (!isLoaded || !hasSelection || !destinationCoords) {
      setDirections(null);
      setRouteDistance(null);
      setRouteDuration(null);
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: selectedPosition,
        destination: { lat: destinationCoords.lat, lng: destinationCoords.lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            setRouteDistance(formatDistanceToKm(leg.distance));
            setRouteDuration(leg.duration?.text ?? null);
          }
        } else {
          // If route calculation fails, just show the marker without route
          setDirections(null);
          setRouteDistance(null);
          setRouteDuration(null);
        }
      },
    );
  }, [isLoaded, hasSelection, selectedPosition, destinationCoords]);

  const handleSuggestionClick = useCallback(
    async (suggestion: SuggestionItem) => {
      try {
        let lat: number;
        let lng: number;
        let address: string;

        if (suggestion._raw && typeof suggestion._raw.toPlace === "function") {
          // New Places API: use toPlace() + fetchFields()
          const place = suggestion._raw.toPlace();
          await place.fetchFields({
            fields: ["formattedAddress", "location"],
          });

          lat = place.location?.lat() ?? 0;
          lng = place.location?.lng() ?? 0;
          address = place.formattedAddress ?? suggestion.description;
        } else {
          // Fallback: use Geocoder
          const geocoder = new google.maps.Geocoder();
          const response = await geocoder.geocode({
            placeId: suggestion.placeId,
          });

          if (!response.results[0]) return;

          const location = response.results[0].geometry.location;
          lat = location.lat();
          lng = location.lng();
          address =
            response.results[0].formatted_address ?? suggestion.description;
        }

        if (lat === 0 && lng === 0) return;

        onChange(address);
        setSelectedAddress(address);
        setSelectedPosition({ lat, lng });
        setHasSelection(true);
        setShowInfoWindow(true);
        setShowSuggestions(false);
        setError(null);

        // Pan the map to the new position
        if (mapRef.current) {
          mapRef.current.panTo({ lat, lng });
          mapRef.current.setZoom(15);
        }
      } catch {
        setError("No se pudo obtener la ubicacion. Intentalo nuevamente.");
      }
    },
    [onChange],
  );

  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  // Notificar al padre las coordenadas de la dirección de recogida
  // cuando el cliente selecciona una sugerencia (o limpia el campo).
  useEffect(() => {
    if (!onPickupCoordsChange) return;
    if (hasSelection && value.trim().length > 0) {
      onPickupCoordsChange({
        lat: selectedPosition.lat,
        lng: selectedPosition.lng,
      });
    } else {
      onPickupCoordsChange(null);
    }
  }, [hasSelection, selectedPosition, value, onPickupCoordsChange]);

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      setShowSuggestions(false);
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (suggestions.length > 0) handleSuggestionClick(suggestions[0]);
    }
  };

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const showRoute = directions !== null;

  const hasDualLayout = deliveryValue !== undefined;

  return (
    <div className="qa-address-map" ref={wrapperRef}>
      {hasDualLayout ? (
        <div className="qa-grid-2 mb-3">
          {/* Columna izquierda: pickup */}
          <div>
            {pickupLabel && (
              <label className="qa-label">
                <i className="bi bi-geo-alt me-1"></i>
                {pickupLabel}
              </label>
            )}
            <div style={{ position: "relative" }}>
              <textarea
                className="qa-input"
                value={value}
                onChange={handleTextareaChange}
                onFocus={() =>
                  !disabled && setShowSuggestions(suggestions.length > 0)
                }
                onKeyDown={handleTextareaKeyDown}
                placeholder={
                  disabled
                    ? "Seleccione primero un puerto de salida"
                    : placeholder
                }
                rows={rows}
                disabled={disabled}
                style={
                  disabled
                    ? {
                        backgroundColor: "#f1f3f4",
                        color: "#6c757d",
                        cursor: "not-allowed",
                      }
                    : undefined
                }
              />
              {showSuggestions && (
                <ul
                  className="qa-address-map__suggestions"
                  style={{
                    position: "absolute",
                    zIndex: 5,
                    background: "white",
                    border: "1px solid #e0e0e0",
                    borderRadius: "4px",
                    maxHeight: "220px",
                    overflowY: "auto",
                    margin: "4px 0 0",
                    padding: 0,
                    listStyle: "none",
                    width: "100%",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  }}
                >
                  {suggestions.map((item) => (
                    <li key={item.placeId}>
                      <button
                        type="button"
                        onClick={() => handleSuggestionClick(item)}
                        className="qa-address-map__suggestion-btn"
                      >
                        {item.description}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {isLoading && value.trim().length >= 3 && (
                <p
                  className="qa-address-map__hint"
                  style={{
                    fontSize: "0.75rem",
                    color: "#6c757d",
                    margin: "4px 0 0",
                  }}
                >
                  Validando direccion...
                </p>
              )}
              {error && (
                <p
                  className="qa-address-map__error"
                  style={{
                    fontSize: "0.75rem",
                    color: "#dc3545",
                    margin: "4px 0 0",
                  }}
                >
                  {error}
                </p>
              )}
              {!isLoading &&
                value.trim().length >= 3 &&
                suggestions.length === 0 &&
                !error && (
                  <p
                    className="qa-address-map__hint"
                    style={{
                      fontSize: "0.75rem",
                      color: "#6c757d",
                      margin: "4px 0 0",
                    }}
                  >
                    No encontramos coincidencias exactas, pero puedes guardar la
                    direccion escrita manualmente.
                  </p>
                )}
            </div>
          </div>
          {/* Columna derecha: delivery (solo lectura) */}
          <div>
            {deliveryLabel && (
              <label className="qa-label">
                <i className="bi bi-geo-alt me-1"></i>
                {deliveryLabel}
              </label>
            )}
            <textarea
              className="qa-input"
              value={deliveryValue}
              readOnly
              disabled
              rows={rows}
              style={{
                backgroundColor: "#f1f3f4",
                color: "#6c757d",
                cursor: "not-allowed",
                resize: "none",
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <textarea
            className="qa-input"
            value={value}
            onChange={handleTextareaChange}
            onFocus={() =>
              !disabled && setShowSuggestions(suggestions.length > 0)
            }
            onKeyDown={handleTextareaKeyDown}
            placeholder={
              disabled ? "Seleccione primero un puerto de salida" : placeholder
            }
            rows={rows}
            disabled={disabled}
            style={
              disabled
                ? {
                    backgroundColor: "#f1f3f4",
                    color: "#6c757d",
                    cursor: "not-allowed",
                  }
                : undefined
            }
          />
          {showSuggestions && (
            <ul
              className="qa-address-map__suggestions"
              style={{
                position: "absolute",
                zIndex: 5,
                background: "white",
                border: "1px solid #e0e0e0",
                borderRadius: "4px",
                maxHeight: "220px",
                overflowY: "auto",
                margin: "4px 0 0",
                padding: 0,
                listStyle: "none",
                width: "100%",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            >
              {suggestions.map((item) => (
                <li key={item.placeId}>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(item)}
                    className="qa-address-map__suggestion-btn"
                  >
                    {item.description}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {isLoading && value.trim().length >= 3 && (
            <p
              className="qa-address-map__hint"
              style={{
                fontSize: "0.75rem",
                color: "#6c757d",
                margin: "4px 0 0",
              }}
            >
              Validando direccion...
            </p>
          )}
          {error && (
            <p
              className="qa-address-map__error"
              style={{
                fontSize: "0.75rem",
                color: "#dc3545",
                margin: "4px 0 0",
              }}
            >
              {error}
            </p>
          )}
          {!isLoading &&
            value.trim().length >= 3 &&
            suggestions.length === 0 &&
            !error && (
              <p
                className="qa-address-map__hint"
                style={{
                  fontSize: "0.75rem",
                  color: "#6c757d",
                  margin: "4px 0 0",
                }}
              >
                No encontramos coincidencias exactas, pero puedes guardar la
                direccion escrita manualmente.
              </p>
            )}
        </div>
      )}

      {middleContent}
      <div
        style={{
          height: "280px",
          width: "100%",
          border: "1px solid #e0e0e0",
          borderRadius: "6px",
          overflow: "hidden",
          background: "#f8f9fa",
          marginTop: middleContent ? "0" : "12px",
        }}
      >
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={hasSelection ? selectedPosition : defaultCenter}
            zoom={hasSelection ? 15 : 5}
            onLoad={onMapLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {showRoute ? (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: false,
                  polylineOptions: {
                    strokeColor: "#ff6200",
                    strokeWeight: 4,
                  },
                }}
              />
            ) : (
              hasSelection && (
                <Marker
                  position={selectedPosition}
                  onClick={() => setShowInfoWindow(true)}
                >
                  {showInfoWindow && (
                    <InfoWindow
                      position={selectedPosition}
                      onCloseClick={() => setShowInfoWindow(false)}
                    >
                      <div>
                        <strong>Direccion seleccionada</strong>
                        <br />
                        {selectedAddress}
                        <br />
                        Lat: {selectedPosition.lat.toFixed(6)} | Lng:{" "}
                        {selectedPosition.lng.toFixed(6)}
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              )
            )}
          </GoogleMap>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#6c757d",
              fontSize: "0.9rem",
            }}
          >
            Cargando mapa...
          </div>
        )}
      </div>

      {showRoute && destinationCoords && (
        <div
          className="mt-2 d-flex align-items-center gap-2 p-2 rounded"
          style={{
            backgroundColor: "rgba(255, 98, 0, 0.08)",
            fontSize: "0.85rem",
          }}
        >
          <i className="bi bi-signpost-2" style={{ color: "#ff6200" }}></i>
          <span>
            Distancia hasta <strong>{destinationCoords.name}</strong>
            {" ("}
            {destinationCoords.code}
            {"):\u00a0"}
            <strong>{routeDistance}</strong>
            {routeDuration && <> &middot; {routeDuration}</>}
          </span>
        </div>
      )}
    </div>
  );
};

export default CotizadorAddressMap;

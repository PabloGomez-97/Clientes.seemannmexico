import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  GoogleMap,
  Marker,
  DirectionsRenderer,
  Polygon,
  useJsApiLoader,
} from "@react-google-maps/api";
import "../quotes/QuoteLASTMILE.css";
import {
  VESPUCIO_RING_POLYGON,
  VESPUCIO_RING_POLYGON_OUTSIDE,
  getVespucioDeliveryZone,
  type VespucioDeliveryZone,
} from "../../config/vespucioRing";
import { GOOGLE_MAPS_LIBRARIES } from "../../config/googleMapsConfig";

type Coordinates = { lat: number; lng: number };

type SuggestionItem = {
  placeId: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _raw: any;
};

const defaultCenter: Coordinates = { lat: -33.4489, lng: -70.6693 };

const mapContainerStyle: React.CSSProperties = {
  height: "100%",
  width: "100%",
};

const libraries = GOOGLE_MAPS_LIBRARIES;

function formatDistanceToKm(
  distance: google.maps.Distance | null | undefined,
): string | null {
  if (!distance) return null;
  if (typeof distance.value === "number") {
    return `${(distance.value / 1000).toFixed(1)} km`;
  }
  return distance.text ?? null;
}

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (data: { address: string; coords: Coordinates }) => void;
  placeholder: string;
  rows?: number;
  isLoaded: boolean;
  disabled?: boolean;
}

const AddressInput = ({
  value,
  onChange,
  onSelect,
  placeholder,
  rows = 2,
  isLoaded,
  disabled = false,
}: AddressInputProps) => {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    // No ejecutar autocompletado si el campo está deshabilitado
    if (disabled) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      return;
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
        setError("No se pudo validar la dirección. Inténtalo nuevamente.");
      } finally {
        setIsLoading(false);
      }
    }, 450);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, isLoaded]);

  const handleSuggestionClick = useCallback(
    async (suggestion: SuggestionItem) => {
      try {
        let lat = 0;
        let lng = 0;
        let address = suggestion.description;

        if (suggestion._raw && typeof suggestion._raw.toPlace === "function") {
          const place = suggestion._raw.toPlace();
          await place.fetchFields({
            fields: ["formattedAddress", "location"],
          });
          lat = place.location?.lat() ?? 0;
          lng = place.location?.lng() ?? 0;
          address = place.formattedAddress ?? suggestion.description;
        } else {
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
        onSelect({ address, coords: { lat, lng } });
        setShowSuggestions(false);
        setError(null);
      } catch {
        setError("No se pudo obtener la ubicación. Inténtalo nuevamente.");
      }
    },
    [onChange, onSelect],
  );

  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    onChange(event.target.value);
  };

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") setShowSuggestions(false);
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (suggestions.length > 0) handleSuggestionClick(suggestions[0]);
    }
  };

  return (
    <div className="qa-address-map" ref={wrapperRef}>
      <textarea
        className="qa-input"
        value={value}
        onChange={handleTextareaChange}
        onFocus={() => !disabled && setShowSuggestions(suggestions.length > 0)}
        onKeyDown={handleTextareaKeyDown}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        readOnly={disabled}
        style={
          disabled
            ? {
                backgroundColor: "#f1f3f4",
                color: "#6c757d",
                cursor: "not-allowed",
                resize: "none",
                pointerEvents: "none",
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
          style={{ fontSize: "0.75rem", color: "#6c757d", margin: "4px 0 0" }}
        >
          Validando dirección...
        </p>
      )}
      {error && (
        <p
          className="qa-address-map__error"
          style={{ fontSize: "0.75rem", color: "#dc3545", margin: "4px 0 0" }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

interface CotizadorAddressMapDualProps {
  pickupValue: string;
  onPickupChange: (v: string) => void;
  deliveryValue: string;
  onDeliveryChange: (v: string) => void;
  pickupPlaceholder?: string;
  deliveryPlaceholder?: string;
  /** Cuando se provee, las coordenadas de recogida se pre-establecen
   *  (e.g. cuando el origen es un puerto conocido). */
  lockedPickupCoords?: { lat: number; lng: number } | null;
  /** Zona de entrega respecto a los polígonos Vespucio.
   *  `null` = aún no determinable (sin coordenadas o geometry no cargada). */
  onDeliveryZoneChange?: (zone: VespucioDeliveryZone | null) => void;
  /** Mensaje cuando la entrega queda fuera del polígono exterior (zona outside). */
  outsideCoverageMessage?: string;
}

const CotizadorAddressMapDual = ({
  pickupValue,
  onPickupChange,
  deliveryValue,
  onDeliveryChange,
  pickupPlaceholder = "Dirección de recogida",
  deliveryPlaceholder = "Dirección de entrega",
  lockedPickupCoords = null,
  onDeliveryZoneChange,
  outsideCoverageMessage,
}: CotizadorAddressMapDualProps) => {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
    libraries,
  });

  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<Coordinates | null>(
    null,
  );
  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  const [routeDistance, setRouteDistance] = useState<string | null>(null);
  const [routeDuration, setRouteDuration] = useState<string | null>(null);
  const [deliveryZone, setDeliveryZone] = useState<VespucioDeliveryZone | null>(
    null,
  );
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!isLoaded || !deliveryCoords) {
      setDeliveryZone(null);
      onDeliveryZoneChange?.(null);
      return;
    }
    const zone = getVespucioDeliveryZone(deliveryCoords);
    setDeliveryZone(zone);
    onDeliveryZoneChange?.(zone);
  }, [isLoaded, deliveryCoords, onDeliveryZoneChange]);

  // Sincronizar coordenadas cuando el origen es un puerto conocido
  useEffect(() => {
    if (lockedPickupCoords) {
      setPickupCoords(lockedPickupCoords);
    } else {
      setPickupCoords(null);
    }
  }, [lockedPickupCoords]);

  // Resetear coords si el usuario borra/edita manualmente la dirección.
  // Si hay coordenadas bloqueadas (puerto de origen), restaurarlas en lugar de limpiar.
  useEffect(() => {
    if (!pickupValue.trim()) {
      setPickupCoords(lockedPickupCoords ?? null);
    }
  }, [pickupValue, lockedPickupCoords]);
  useEffect(() => {
    if (!deliveryValue.trim()) setDeliveryCoords(null);
  }, [deliveryValue]);

  useEffect(() => {
    if (!isLoaded || !pickupCoords || !deliveryCoords) {
      setDirections(null);
      setRouteDistance(null);
      setRouteDuration(null);
      return;
    }
    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: pickupCoords,
        destination: deliveryCoords,
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
          setDirections(null);
          setRouteDistance(null);
          setRouteDuration(null);
        }
      },
    );
  }, [isLoaded, pickupCoords, deliveryCoords]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const center = pickupCoords || deliveryCoords || defaultCenter;
  const showRoute = directions !== null;

  return (
    <div>
      <div className="qa-grid-2 mb-4 bg-light p-3 rounded border">
        <div>
          <label className="qa-label">
            <i className="bi bi-geo-alt me-1"></i>
            Dirección de Recogida
          </label>
          <AddressInput
            value={pickupValue}
            onChange={onPickupChange}
            onSelect={({ coords }) => setPickupCoords(coords)}
            placeholder={pickupPlaceholder}
            isLoaded={isLoaded}
            disabled={!!lockedPickupCoords}
          />
        </div>
        <div>
          <label className="qa-label">
            <i className="bi bi-geo-alt me-1"></i>
            Dirección de Entrega
          </label>
          <AddressInput
            value={deliveryValue}
            onChange={onDeliveryChange}
            onSelect={({ coords }) => setDeliveryCoords(coords)}
            placeholder={deliveryPlaceholder}
            isLoaded={isLoaded}
          />
          {deliveryCoords && deliveryZone === "outside" && (
            <div
              className="mt-2 d-flex align-items-start gap-2 p-2 rounded"
              style={{
                backgroundColor: "rgba(255, 193, 7, 0.12)",
                border: "1px solid rgba(255, 193, 7, 0.45)",
                fontSize: "0.8rem",
                color: "#856404",
              }}
              role="alert"
            >
              <i
                className="bi bi-exclamation-triangle-fill"
                style={{ color: "#f0ad4e", marginTop: "2px" }}
              ></i>
              <span>
                {outsideCoverageMessage ??
                  "La dirección se encuentra fuera de nuestro radio del alcance. Un ejecutivo se comunicará contigo para entregarte una tarifa correspondiente."}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          height: "320px",
          width: "100%",
          border: "1px solid #e0e0e0",
          borderRadius: "6px",
          overflow: "hidden",
          background: "#f8f9fa",
        }}
      >
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={pickupCoords && !deliveryCoords ? 13 : 6}
            onLoad={onMapLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {showRoute ? (
              <DirectionsRenderer
                directions={directions!}
                options={{
                  suppressMarkers: false,
                  polylineOptions: {
                    strokeColor: "#ff6200",
                    strokeWeight: 4,
                  },
                }}
              />
            ) : (
              <>
                {pickupCoords && (
                  <Marker
                    position={pickupCoords}
                    label={{ text: "A", color: "white" }}
                  />
                )}
                {deliveryCoords && (
                  <Marker
                    position={deliveryCoords}
                    label={{ text: "B", color: "white" }}
                  />
                )}
              </>
            )}
            <Polygon
              paths={VESPUCIO_RING_POLYGON_OUTSIDE}
              options={{
                strokeColor: "#2e7d32",
                strokeOpacity: 0.75,
                strokeWeight: 2,
                fillColor: "#2e7d32",
                fillOpacity: 0.05,
                clickable: false,
                zIndex: 0,
              }}
            />
            <Polygon
              paths={VESPUCIO_RING_POLYGON}
              options={{
                strokeColor: "#1565c0",
                strokeOpacity: 0.9,
                strokeWeight: 2,
                fillColor: "#1565c0",
                fillOpacity: 0.1,
                clickable: false,
                zIndex: 1,
              }}
            />
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

      {showRoute && (
        <div
          className="mt-2 d-flex align-items-center gap-2 p-2 rounded"
          style={{
            backgroundColor: "rgba(255, 98, 0, 0.08)",
            fontSize: "0.85rem",
          }}
        >
          <i className="bi bi-signpost-2" style={{ color: "#ff6200" }}></i>
          <span>
            Distancia estimada: <strong>{routeDistance}</strong>
            {routeDuration && (
              <>
                {" · "}Tiempo aproximado: <strong>{routeDuration}</strong>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default CotizadorAddressMapDual;

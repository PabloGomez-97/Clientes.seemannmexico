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
  useJsApiLoader,
} from "@react-google-maps/api";
import { GOOGLE_MAPS_LIBRARIES } from "../../config/googleMapsConfig";
import {
  parseGoogleAddressComponents,
  type EnviaStructuredAddress,
  type GoogleAddressComponent,
} from "../../utils/enviaAddress";
import "../quotes/QuoteLASTMILE.css";

type Coordinates = { lat: number; lng: number };

type SuggestionItem = {
  placeId: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _raw: any;
};

export type EnviaPlaceSelection = {
  address: string;
  coords: Coordinates;
  structured: Partial<EnviaStructuredAddress>;
  components: GoogleAddressComponent[];
};

const defaultCenter: Coordinates = { lat: 23.6345, lng: -102.5528 };

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
  onSelect: (data: EnviaPlaceSelection) => void;
  placeholder: string;
  isLoaded: boolean;
  countryRestriction?: string;
}

const AddressInput = ({
  value,
  onChange,
  onSelect,
  placeholder,
  isLoaded,
  countryRestriction,
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
    if (value.trim().length < 3 || !isLoaded) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      return;
    }

    debounceRef.current = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const PlacesNS = google.maps.places as any;
        const region = countryRestriction?.toLowerCase();
        if (PlacesNS.AutocompleteSuggestion) {
          const { suggestions: rawSuggestions } =
            await PlacesNS.AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: value.trim(),
              ...(region
                ? {
                    includedRegionCodes: [region],
                  }
                : {}),
            });
          const results: SuggestionItem[] = (rawSuggestions ?? []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s: any) => ({
              placeId:
                s.placePrediction?.placeId ||
                s.placePrediction?.toPlace?.()?.id ||
                String(Math.random()),
              description:
                s.placePrediction?.text?.text ||
                s.placePrediction?.description ||
                "",
              _raw: s.placePrediction,
            }),
          );
          setSuggestions(results.filter((r) => r.description));
          setShowSuggestions(results.length > 0);
        } else {
          const service = new google.maps.places.AutocompleteService();
          service.getPlacePredictions(
            {
              input: value.trim(),
              ...(countryRestriction
                ? { componentRestrictions: { country: countryRestriction.toLowerCase() } }
                : {}),
            },
            (preds, status) => {
              if (
                status === google.maps.places.PlacesServiceStatus.OK &&
                preds
              ) {
                setSuggestions(
                  preds.map((p) => ({
                    placeId: p.place_id,
                    description: p.description,
                    _raw: p,
                  })),
                );
                setShowSuggestions(true);
              } else {
                setSuggestions([]);
                setShowSuggestions(false);
              }
            },
          );
        }
      } catch {
        setError("No se pudo buscar direcciones.");
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, isLoaded, countryRestriction]);

  const handleSuggestionClick = useCallback(
    async (suggestion: SuggestionItem) => {
      try {
        let lat = 0;
        let lng = 0;
        let address = suggestion.description;
        let components: GoogleAddressComponent[] = [];

        if (suggestion._raw && typeof suggestion._raw.toPlace === "function") {
          const place = suggestion._raw.toPlace();
          await place.fetchFields({
            fields: [
              "formattedAddress",
              "location",
              "addressComponents",
            ],
          });
          lat = place.location?.lat() ?? 0;
          lng = place.location?.lng() ?? 0;
          address = place.formattedAddress ?? suggestion.description;
          components = (place.addressComponents || []).map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => ({
              longText: c.longText,
              shortText: c.shortText,
              long_name: c.longText,
              short_name: c.shortText,
              types: c.types || [],
            }),
          );
        } else {
          const geocoder = new google.maps.Geocoder();
          const response = await geocoder.geocode({
            placeId: suggestion.placeId,
          });
          const result = response.results[0];
          if (!result) return;
          lat = result.geometry.location.lat();
          lng = result.geometry.location.lng();
          address = result.formatted_address ?? suggestion.description;
          components = (result.address_components ||
            []) as GoogleAddressComponent[];
        }

        if (lat === 0 && lng === 0) return;

        const structured = parseGoogleAddressComponents(components, {
          lat,
          lng,
          formattedAddress: address,
        });

        onChange(address);
        onSelect({
          address,
          coords: { lat, lng },
          structured,
          components,
        });
        setShowSuggestions(false);
        setError(null);
      } catch {
        setError("No se pudo obtener la ubicación.");
      }
    },
    [onChange, onSelect],
  );

  const handleTextareaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
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
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <textarea
        className="form-control"
        rows={2}
        value={value}
        onChange={handleTextareaChange}
        onKeyDown={handleTextareaKeyDown}
        placeholder={placeholder}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul
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
        <p style={{ fontSize: "0.75rem", color: "#6c757d", margin: "4px 0 0" }}>
          Buscando dirección...
        </p>
      )}
      {error && (
        <p style={{ fontSize: "0.75rem", color: "#dc3545", margin: "4px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
};

interface EnviaAddressMapDualProps {
  pickupValue: string;
  onPickupChange: (v: string) => void;
  deliveryValue: string;
  onDeliveryChange: (v: string) => void;
  onPickupSelect: (data: EnviaPlaceSelection) => void;
  onDeliverySelect: (data: EnviaPlaceSelection) => void;
  pickupCountry?: string;
  deliveryCountry?: string;
  pickupPlaceholder?: string;
  deliveryPlaceholder?: string;
}

const EnviaAddressMapDual = ({
  pickupValue,
  onPickupChange,
  deliveryValue,
  onDeliveryChange,
  onPickupSelect,
  onDeliverySelect,
  pickupCountry,
  deliveryCountry,
  pickupPlaceholder = "Buscar dirección de recogida",
  deliveryPlaceholder = "Buscar dirección de entrega",
}: EnviaAddressMapDualProps) => {
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
  const mapRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    if (!pickupValue.trim()) setPickupCoords(null);
  }, [pickupValue]);
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

  return (
    <div>
      <div className="qa-grid-2 mb-4 bg-light p-3 rounded border">
        <div>
          <label className="qa-label">
            <i className="bi bi-geo-alt me-1" />
            Dirección de Recogida
          </label>
          <AddressInput
            value={pickupValue}
            onChange={onPickupChange}
            onSelect={(data) => {
              setPickupCoords(data.coords);
              onPickupSelect(data);
            }}
            placeholder={pickupPlaceholder}
            isLoaded={isLoaded}
            countryRestriction={pickupCountry}
          />
        </div>
        <div>
          <label className="qa-label">
            <i className="bi bi-geo-alt me-1" />
            Dirección de Entrega
          </label>
          <AddressInput
            value={deliveryValue}
            onChange={onDeliveryChange}
            onSelect={(data) => {
              setDeliveryCoords(data.coords);
              onDeliverySelect(data);
            }}
            placeholder={deliveryPlaceholder}
            isLoaded={isLoaded}
            countryRestriction={deliveryCountry}
          />
        </div>
      </div>

      <div
        className="rounded border overflow-hidden mb-2"
        style={{ height: 320 }}
      >
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={pickupCoords || deliveryCoords ? 11 : 4}
            onLoad={onMapLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {pickupCoords && <Marker position={pickupCoords} label="A" />}
            {deliveryCoords && <Marker position={deliveryCoords} label="B" />}
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{ suppressMarkers: true }}
              />
            )}
          </GoogleMap>
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 text-muted">
            Cargando mapa...
          </div>
        )}
      </div>
      {(routeDistance || routeDuration) && (
        <p className="small text-muted mb-0">
          Ruta estimada: {routeDistance || "—"}
          {routeDuration ? ` · ${routeDuration}` : ""}
        </p>
      )}
    </div>
  );
};

export default EnviaAddressMapDual;

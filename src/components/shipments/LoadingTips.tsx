import { useState, useEffect, useCallback, useRef } from "react";

const tips: string[] = [
  // --- Los que generan el "ohh no sabía" ---
  "Si todos los barcos del mundo se detuvieran hoy, los supermercados comenzarían a vaciarse en menos de 3 semanas.",
  "El smartphone que tienes en la mano tocó puertos en al menos 4 países distintos antes de llegar a tus manos.",
  "El 90% del café que tomas en la mañana cruzó al menos un océano antes de llegar a tu taza.",
  "El chocolate que compras en el supermercado probablemente viajó más de 15,000 km para llegar a la góndola.",
  "Chile importa el 99% de los celulares que consume. Todos entraron por el puerto de San Antonio o Valparaíso.",
  "El atún en lata que comes probablemente fue pescado en el Pacífico, procesado en Asia y embarcado de vuelta a Sudamérica.",
  "Amazon tiene su propia flota de aviones cargueros, barcos y camiones. Es la única empresa del mundo con los tres modos a la vez.",
  "Hay barcos tan grandes que si se pusieran de pie serían más altos que el Empire State Building.",
  "Una sola demora de 24 horas en puerto puede costarle a una empresa más que el flete completo del envío.",
  "El precio de una zapatilla deportiva puede subir hasta un 40% solo por el costo del flete en épocas de congestión portuaria.",

  // --- Datos históricos impactantes ---
  "En 2021, el buque Ever Given encalló en el Canal de Suez durante 6 días y bloqueó mercancías por más de USD 9,600 millones diarios.",
  "El primer contenedor marino estándar fue creado por Malcolm McLean en 1956. Antes de eso, descargar un barco tomaba semanas enteras.",
  "Durante la pandemia, el precio de fletar un contenedor de Asia a Sudamérica llegó a costar más de USD 20,000, cuando históricamente rondaba los USD 1,500.",
  "El pallet fue desarrollado originalmente para uso militar durante la Segunda Guerra Mundial. Hoy mueve el 80% de los productos del mundo.",
  "El término 'flete' viene del neerlandés antiguo 'vracht'. Los navegantes holandeses dominaron el comercio marítimo en el siglo XVII.",

  // --- Escala que impresiona ---
  "Hay más de 20 millones de contenedores en circulación en el mundo. Si los pusieras en fila, darían más de 5 vueltas a la Tierra.",
  "El puerto de Shanghái mueve más contenedores al año que todos los puertos de América Latina juntos.",
  "En el mundo hay más de 50,000 buques mercantes operativos. Si fueran una ciudad, sería la quinta más grande del planeta.",
  "Más del 90% de los productos manufacturados que usas a diario pasaron por un barco en algún punto de su historia.",
  "El 80% del comercio mundial viaja por mar. Sin los barcos, la globalización simplemente no existiría.",

  // --- Tecnología e innovación ---
  "El sistema AIS permite rastrear en tiempo real la posición de casi cualquier barco en el mundo desde tu celular, gratis.",
  "Rotterdam puede descargar un buque de 24,000 contenedores en menos de 48 horas usando grúas 100% automatizadas, sin operadores.",
  "Los barcos modernos están comenzando a usar velas de alta tecnología para reducir hasta un 30% su consumo de combustible.",
  "Los contenedores reefer (refrigerados) tienen su propio sistema eléctrico y pueden mantener temperaturas entre -30°C y +30°C durante semanas.",
  "Existen contenedores especiales para transportar automóviles, ganado vivo, objetos de arte e incluso casas prefabricadas completas.",

  // --- Comparativas que dan perspectiva ---
  "La aviación de carga mueve solo el 1% del volumen del comercio mundial, pero representa cerca del 35% de su valor en dólares.",
  "Un Boeing 747 carguero puede mover el equivalente en peso a 6 camionetas doble cabina, pero cuesta casi 5 veces más por kilo que el barco.",
  "La logística representa en promedio el 10–15% del costo final de un producto. En países con mala infraestructura, puede superar el 30%.",
  "La ruta marítima Shanghái–Rotterdam es la más transitada del mundo: 30 días de viaje, miles de contenedores, un solo barco.",
  "Chile tiene acuerdos comerciales con más de 65 economías, incluyendo la Unión Europea, EE.UU., China y Japón. Pocos países en el mundo lo superan.",

  // --- Curiosidades que nadie espera ---
  "Se estima que cada año se pierden en el mar alrededor de 1,500 contenedores durante tormentas. Algunos flotan durante años.",
  "En la logística moderna, el 60% de los errores de entrega ocurren no en el transporte, sino en la gestión de documentos.",
  "El aeropuerto de Memphis es el mayor hub de carga aérea del mundo, solo por la decisión de FedEx de instalar allí su base de operaciones.",
  "Una de las rutas terrestres más largas del mundo es la ruta de la seda moderna: trenes de carga de China a Europa que recorren más de 11,000 km.",
  "El Canal de Panamá fue ampliado en 2016 para barcos de hasta 14,000 contenedores. Antes del canal, la alternativa era rodear toda América del Sur.",
  "Ya existen sistemas de pago automatizado de aranceles aduaneros en algunos puertos asiáticos donde el barco ni siquiera necesita detenerse para declarar su carga.",
  "Rolls-Royce diseñó un sistema de navegación autónoma para barcos que usa cámaras y radar en lugar de tripulación en el puente.",
  // Canal de Suez
  "Ever Given (marzo 2021): el barco más famoso de la historia reciente. 400 metros atascados en diagonal durante 6 días. Bloqueó USD 9,600 millones diarios en comercio. El meme del excavador pequeño al lado fue visto por 500 millones de personas.",
  "Ataques Houthi (2024): rebeldes yemeníes comenzaron a atacar barcos en el Mar Rojo con drones y misiles. Más de 500 barcos desviaron su ruta, evitando Suez y rodeando África. El flete mundial subió un 300% en semanas.",
  "Sequía del Canal de Panamá (2023–2024): niveles históricos bajos de agua obligaron a reducir el número de barcos por día de 38 a 18. Había filas de hasta 160 barcos esperando turno. Algunos pagaron hasta USD 4 millones por saltar la fila.",

  // Colapsos portuarios
  "Puerto de Los Ángeles colapsado (2021): en el peak de la pandemia, había 109 barcos esperando ancla afuera del puerto. Algunos esperaron más de 3 semanas. Las estanterías vacías en EE.UU. fueron portada de todos los diarios del mundo.",
  "Puerto de Shanghái cerrado por COVID (2022): China cerró el puerto más grande del mundo durante semanas por un brote. Se acumularon más de 500 barcos en espera. El impacto se sintió en Chile 6 semanas después cuando llegaron los contenedores rezagados todos juntos.",
  "Huelga portuaria en EE.UU. (octubre 2024): los estibadores de la costa este amenazaron con paralizar 36 puertos simultáneamente. La Casa Blanca intervino directamente. Se estimaba un costo de USD 5,000 millones por día si el paro se concretaba.",
  "Puerto de Beirut (agosto 2020): la explosión que destruyó medio Beirut fue causada por 2,750 toneladas de nitrato de amonio almacenadas ilegalmente en el puerto durante 6 años. Documentación mal gestionada, nadie reclamó la carga.",

  // Naufragios y accidentes
  "El Wakashio en Mauricio (2020): un barco carguero japonés encalló en un arrecife de coral mientras la tripulación celebraba un cumpleaños con música alta. Derramó 1,000 toneladas de petróleo en una de las zonas marinas más prístinas del mundo.",
  "El X-Press Pearl en Sri Lanka (2021): considerado el peor desastre ambiental marítimo de Asia. Un barco con químicos peligrosos se incendió durante 13 días frente a Colombo. Millones de pellets de plástico cubrieron las playas de Sri Lanka.",
  "El Ever Forward encallado (2022): un año después del Ever Given, otro barco de la misma naviera quedó varado en la bahía de Chesapeake, EE.UU. durante 35 días. La ironía fue tan grande que los medios la llamaron 'el barco maldito'.",
  "Incendio del Felicity Ace (2022): un barco que transportaba 4,000 autos de lujo de Volkswagen, Porsche y Lamborghini se incendió en el Atlántico. Las baterías de los autos eléctricos a bordo hicieron imposible apagar el fuego. Pérdidas estimadas: USD 500 millones.",

  // Robos, fraudes y mafias
  "El mayor decomiso de cocaína en un puerto (2023): autoridades europeas encontraron más de 35 toneladas de cocaína escondida en contenedores de banana provenientes de Ecuador en el puerto de Amberes. Amberes es conocido como la puerta de entrada de droga a Europa.",
  "Fraude masivo de contenedores vacíos en Asia (2022): una red criminal cobró flete a múltiples empresas por el mismo contenedor vacío, usando documentación falsa. El fraude superó los USD 100 millones antes de ser detectado.",
  "Piratas somalíes vs. drones (2024): los piratas somalíes retomaron actividad en el Índico, pero esta vez las navieras respondieron con drones de vigilancia privados y escoltas armados. El seguro por zona de riesgo se triplicó.",
  "El escándalo de los BL falsos en Chile (2023): la PDI detectó una red que falsificaba Bills of Lading para importar mercancía sobrevaluada y sacar divisas del país ilegalmente. Involucró a varias empresas de comercio exterior.",
];

const INTERVAL_MS = 3000;
const DOT_COUNT = 5;
const ACCENT = "#ff6200";

function shuffleIndices(length: number): number[] {
  return [...Array(length).keys()].sort(() => Math.random() - 0.5);
}

export default function LoadingTips() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedTip, setDisplayedTip] = useState("");
  const [visible, setVisible] = useState(true);
  const [progressKey, setProgressKey] = useState(0);

  const orderRef = useRef<number[]>(shuffleIndices(tips.length));

  const getTip = useCallback((idx: number): string => {
    return tips[orderRef.current[idx % orderRef.current.length]];
  }, []);

  useEffect(() => {
    setDisplayedTip(getTip(0));
  }, [getTip]);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          setDisplayedTip(getTip(next));
          setProgressKey((k) => k + 1);
          return next;
        });
        setVisible(true);
      }, 280);
    }, INTERVAL_MS);

    return () => clearInterval(id);
  }, [getTip]);

  const displayNumber = (currentIndex % tips.length) + 1;
  const activeDot = currentIndex % DOT_COUNT;

  return (
    <div style={styles.root}>
      {/* Spinner + label */}
      <div style={styles.spinnerWrap}>
        <svg
          style={styles.spinnerSvg}
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="10" cy="10" r="8" stroke="#e0e0e0" strokeWidth="2" />
          <path
            d="M10 2a8 8 0 0 1 8 8"
            stroke={ACCENT}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span style={styles.spinnerLabel}>Cargando la información...</span>
      </div>

      {/* Card */}
      <div style={styles.cardOuter}>
        <div
          style={{
            ...styles.card,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(5px)",
          }}
        >
          {/* Left accent bar */}
          <div style={styles.accentBar} />

          {/* Content */}
          <div style={styles.cardBody}>
            <div style={styles.cardHeader}>
              <span style={styles.label}>¿Sabías que...?</span>
              <span style={styles.counter}>
                {displayNumber} / {tips.length}
              </span>
            </div>
            <p style={styles.tipText}>{displayedTip}</p>
          </div>

          {/* Progress bar */}
          <div style={styles.progressTrack}>
            <div
              key={progressKey}
              style={{
                ...styles.progressFill,
                animationDuration: `${INTERVAL_MS}ms`,
              }}
            />
          </div>
        </div>

        {/* Dots */}
        <div style={styles.dots}>
          {Array.from({ length: DOT_COUNT }).map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.dot,
                background: i === activeDot ? ACCENT : "#d0d0d0",
                opacity: i === activeDot ? 0.8 : 0.35,
                transform: i === activeDot ? "scale(1.2)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes osv-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes osv-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        .osv-spinner-anim {
          animation: osv-spin 1s linear infinite;
        }
        .osv-progress-anim {
          animation: osv-progress linear forwards;
        }
      `}</style>
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.75rem",
    padding: "2rem 0",
    fontFamily:
      '"DM Sans", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  spinnerWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
  },
  spinnerSvg: {
    width: 22,
    height: 22,
    animation: "osv-spin 1s linear infinite",
  } as React.CSSProperties,
  spinnerLabel: {
    fontSize: "0.8125rem",
    color: "#999",
    letterSpacing: "0.02em",
  },
  cardOuter: {
    width: "min(560px, calc(100% - 2rem))",
    display: "flex",
    flexDirection: "column",
    gap: "0.875rem",
  },
  card: {
    background: "#30302e",
    border: "0.5px solid #e8e8e8",
    borderRadius: 12,
    overflow: "hidden",
    display: "flex",
    flexDirection: "row",
    transition: "opacity 0.28s ease, transform 0.28s ease",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  accentBar: {
    width: 3,
    flexShrink: 0,
    background: ACCENT,
    borderRadius: "12px 0 0 0",
  },
  cardBody: {
    flex: 1,
    padding: "1.25rem 1.5rem 1.125rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.625rem",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: "0.6875rem",
    fontWeight: 600,
    letterSpacing: "0.09em",
    textTransform: "uppercase" as const,
    color: ACCENT,
  },
  counter: {
    fontSize: "0.6875rem",
    color: "#888",
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "0.04em",
  },
  tipText: {
    fontSize: "0.9375rem",
    color: "#ffffff",
    lineHeight: 1.65,
    margin: 0,
    fontWeight: 400,
    minHeight: 60,
  },
  progressTrack: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    background: "#f0f0f0",
  },
  progressFill: {
    height: "100%",
    background: ACCENT,
    opacity: 0.5,
    animation: "osv-progress linear forwards",
  } as React.CSSProperties,
  dots: {
    display: "flex",
    justifyContent: "center",
    gap: "0.4rem",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    transition: "background 0.3s ease, opacity 0.3s ease, transform 0.3s ease",
  },
};

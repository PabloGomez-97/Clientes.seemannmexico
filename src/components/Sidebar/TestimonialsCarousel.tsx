import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import "./styles/TestimonialsCarousel.css";

interface Testimonial {
  id: number;
  name: string;
  company: string;
  role: string;
  /** Texto del testimonio en español */
  quote_es: string;
  /** Texto del testimonio en inglés */
  quote_en: string;
  rating: number;
  /** Iniciales para el avatar (ej. "CR") */
  initials: string;
  /** Color de fondo del avatar (hex) */
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EDITA AQUÍ: agrega, elimina o modifica los testimonios de tus clientes.
// Para cada testimonial completa todos los campos.
// ─────────────────────────────────────────────────────────────────────────────
const TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    name: "M Vargas",
    company: "Bioled",
    role: "NA",
    quote_es:
      "La comunicación con nuestra ejecutiva es excelente, sumamente profesional y resolutiva en su rol",
    quote_en:
      "The communication with our executive is excellent, extremely professional and resourceful in her role",
    rating: 5,
    initials: "MV",
    color: "#ff6200",
  },
  {
    id: 2,
    name: "Rafa Banduc",
    company: "No especificada",
    role: "NA",
    quote_es:
      "Excelentes ejecutivos. La gente encargada de la información de las cargas también excelente. Me gustó que uno pueda editar la información de las cargas, en mi caso agregando el proveedor a esa información.",
    quote_en:
      "Excellent executives. The people in charge of the cargo information are also excellent. I liked that one can edit the cargo information, in my case adding the supplier to that information.",
    rating: 5,
    initials: "RB",
    color: "#1a3a5c",
  },
  {
    id: 3,
    name: "S. Santos",
    company: "Andover",
    role: "NA",
    quote_es: "Rápida comunicación, y siempre la información disponible",
    quote_en: "Quick communication, and always the information available",
    rating: 5,
    initials: "SS",
    color: "#2d6a4f",
  },
  {
    id: 4,
    name: "Vicente Soza",
    company: "REISACHILE",
    role: "NA",
    quote_es: "Buenos precios, cotización rápida. ",
    quote_en: "Good prices, quick quotation. ",
    rating: 5,
    initials: "VS",
    color: "#6d28d9",
  },
];

const StarIcon: React.FC = () => (
  <svg
    viewBox="0 0 20 20"
    fill="currentColor"
    width="18"
    height="18"
    aria-hidden="true"
  >
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const TestimonialsCarousel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = TESTIMONIALS.length;

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    setAnimKey((k) => k + 1);
  }, []);

  const next = useCallback(
    () => goTo((current + 1) % total),
    [current, total, goTo],
  );
  const prev = useCallback(
    () => goTo((current - 1 + total) % total),
    [current, total, goTo],
  );

  useEffect(() => {
    intervalRef.current = setInterval(next, 6000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [next]);

  const item = TESTIMONIALS[current];
  const quote = i18n.language === "es" ? item.quote_es : item.quote_en;

  return (
    <section
      className="hal-testimonials-section"
      aria-label={t("home.testimonials.title")}
    >
      {/* Section header */}
      <div className="hal-page-container-content">
        <div className="hal-section-headline hal-module--border">
          <h2 className="hal-h4">{t("home.testimonials.label")}</h2>
          <h3 className="hal-h1">{t("home.testimonials.title")}</h3>
        </div>
      </div>

      {/* Dark card area */}
      <div className="hal-testimonials-wrapper">
        <div className="hal-page-container-content">
          {/* Quote card */}
          <div
            className="hal-testimonials-card"
            key={animKey}
            aria-live="polite"
          >
            {/* Big decorative quotation mark */}
            <svg
              viewBox="0 0 48 48"
              fill="currentColor"
              className="hal-testimonial-quote-mark"
              aria-hidden="true"
            >
              <path d="M14 6C8.48 6 4 10.48 4 16v14h14V16H8c0-3.31 2.69-6 6-6V6zm20 0c-5.52 0-10 4.48-10 6v14h14V16h-10c0-3.31 2.69-6 6-6V6z" />
            </svg>

            <p className="hal-testimonial-quote">{quote}</p>

            {/* Stars */}
            <div
              className="hal-testimonial-stars"
              aria-label={`${item.rating} de 5 estrellas`}
            >
              {Array.from({ length: item.rating }).map((_, i) => (
                <span key={i} className="hal-star">
                  <StarIcon />
                </span>
              ))}
            </div>

            {/* Author */}
            <div className="hal-testimonial-author">
              <div
                className="hal-testimonial-avatar"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              >
                {item.initials}
              </div>
              <div className="hal-testimonial-meta">
                <strong>{item.name}</strong>
                <span>{item.role}</span>
                <span className="hal-testimonial-company">{item.company}</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="hal-testimonials-controls">
            <button
              onClick={prev}
              className="hal-testimonials-btn"
              aria-label="Testimonio anterior"
            >
              ‹
            </button>
            <div className="hal-testimonials-dots" role="tablist">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === current}
                  className={`hal-testimonials-dot${i === current ? " active" : ""}`}
                  onClick={() => goTo(i)}
                  aria-label={`Testimonio ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="hal-testimonials-btn"
              aria-label="Siguiente testimonio"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsCarousel;

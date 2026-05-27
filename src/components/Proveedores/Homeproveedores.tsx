// src/components/Proveedores/Homeproveedores.tsx
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useTranslation } from "react-i18next";
import { imgUrl } from "../../config/images";
import type { BlogPost } from "../../services/contentful";
import "../Sidebar/styles/Home.css";
import { getRecentPosts } from "../../services/contentful";
import "./styles/Homeproveedores.css";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";

const tariffCards = [
  {
    key: "air",
    title: "Aéreo",
    description: "Tarifas de carga aérea por peso",
    path: "/proveedor/tarifario-aereo",
    accent: "#ff6200",
    bgHover: "#fff7ed",
  },
  {
    key: "fcl",
    title: "FCL",
    description: "Tarifas de contenedor completo",
    path: "/proveedor/tarifario-fcl",
    accent: "#2563eb",
    bgHover: "#eff6ff",
  },
  {
    key: "lcl",
    title: "LCL",
    description: "Tarifas de carga consolidada",
    path: "/proveedor/tarifario-lcl",
    accent: "#059669",
    bgHover: "#f0fdf4",
  },
];

export default function HomeProveedores() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [recentPosts, setRecentPosts] = useState<BlogPost[]>([]);
  const nombreUsuario = user?.nombreuser || user?.email || "Proveedor";

  const slides = [
    {
      image: "/placeholder1.png",
      title: t(
        "proveedor.home.slide1Title",
        "Gestiona tus tarifas con facilidad",
      ),
      subtitle: t(
        "proveedor.home.slide1Subtitle",
        "Sube y actualiza tarifas aéreas, FCL y LCL desde un solo lugar.",
      ),
      button: {
        text: t("proveedor.home.slide1Button", "Subir tarifa aérea"),
        link: "/proveedor/tarifario-aereo",
      },
    },
    {
      image: "/placeholder2.png",
      title: t(
        "proveedor.home.slide2Title",
        "Tus archivos siempre disponibles",
      ),
      subtitle: t(
        "proveedor.home.slide2Subtitle",
        "Carga tus documentos Excel y consúltalos cuando quieras.",
      ),
      button: {
        text: t("proveedor.home.slide2Button", "Ir a mis archivos"),
        link: "/proveedor/archivos",
      },
    },
    {
      image: "/placeholder3.png",
      title: t("proveedor.home.slide3Title", "Colabora con Seemann Group"),
      subtitle: t(
        "proveedor.home.slide3Subtitle",
        "Mantén tus tarifas actualizadas para agilizar las cotizaciones.",
      ),
      button: {
        text: t("proveedor.home.slide3Button", "Ver tarifas FCL"),
        link: "/proveedor/tarifario-fcl",
      },
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides.length]);

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  useEffect(() => {
    getRecentPosts(4).then(setRecentPosts);
  }, []);

  const formatBlogDate = (dateStr: string) => {
    try {
      const locale = i18n.language === "es" ? es : enUS;
      return format(new Date(dateStr), "d MMM yyyy", { locale });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="hal-page-container prov-home">
      {/* Carousel Section */}
      <div className="hal-page-container-content">
        <div className="carousel parbase">
          <div className="hal-stage-teaser-carousel">
            <div className="hal-stage-teaser-carousel-container">
              <div className="hal-stage-teaser-carousel-content">
                {slides.map((slide, index) => (
                  <div
                    key={index}
                    className={`hal-stage-teaser-carousel-item ${index === currentSlide ? "active" : ""}`}
                  >
                    <div className="hal-stage-teaser-img-txt">
                      <div className="hal-stage-teaser-img-txt-scene">
                        <div className="hal-stage-teaser-img-txt-wrapper">
                          <div className="hal-picture-wrapper">
                            <img src={slide.image} alt={`Slide ${index + 1}`} />
                          </div>
                        </div>
                        <div className="hal-stage-teaser-img-txt-content hal-textcolor--light-desktop">
                          <div className="hal-stage-teaser-img-txt-content-inner">
                            <h2 className="hal-h0">{slide.title}</h2>
                            {slide.subtitle && (
                              <div className="hal-copy">
                                <p>{slide.subtitle}</p>
                              </div>
                            )}
                            <div className="hal-button-container">
                              <Link
                                to={slide.button.link}
                                className="hal-button hal-button--primary"
                              >
                                {slide.button.text}
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="hal-stage-teaser-carousel-prev"
                onClick={handlePrevSlide}
                aria-label="Previous"
              ></button>
              <button
                className="hal-stage-teaser-carousel-next"
                onClick={handleNextSlide}
                aria-label="Next"
              ></button>
              <div className="hal-stage-teaser-carousel-dots">
                {slides.map((_, index) => (
                  <button
                    key={index}
                    className={`hal-stage-teaser-carousel-dot ${index === currentSlide ? "hal-stage-teaser-carousel-dot-active" : ""}`}
                    onClick={() => setCurrentSlide(index)}
                    aria-label={`Go to slide ${index + 1}`}
                  ></button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="hal-page-container-content">
        {/* Greeting */}
        <div className="sectionheadline">
          <div className="hal-page-container-content">
            <div className="hal-section-headline">
              <p className="hal-h4">{t("proveedor.home.greeting")}</p>
              <h1 className="hal-h1">{nombreUsuario}</h1>
            </div>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="containermodule parbase">
          <div className="hal-page-container-content">
            <div className="hal-container hal-container--plain hal-module--light">
              <div className="hal-container-content">
                <p className="prov-quick-label">
                  {t("proveedor.home.quickAccess", "Subir tarifas")}
                </p>
                <div className="prov-cards-grid">
                  {tariffCards.map((card) => {
                    const isHovered = hoveredCard === card.key;
                    return (
                      <div
                        key={card.key}
                        className="prov-card"
                        onClick={() => navigate(card.path)}
                        onMouseEnter={() => setHoveredCard(card.key)}
                        onMouseLeave={() => setHoveredCard(null)}
                        style={{
                          backgroundColor: isHovered ? card.bgHover : "#fff",
                          borderColor: isHovered ? card.accent : "#e5e7eb",
                        }}
                      >
                        <div
                          className="prov-card-accent"
                          style={{
                            backgroundColor: card.accent,
                            width: isHovered ? 48 : 32,
                          }}
                        />
                        <h3 className="prov-card-title">{card.title}</h3>
                        <p className="prov-card-desc">{card.description}</p>
                        <span
                          className="prov-card-link"
                          style={{
                            color: card.accent,
                            opacity: isHovered ? 1 : 0,
                          }}
                        >
                          {t("proveedor.home.goToTariff", "Ir al tarifario →")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Archivos quick link */}
                <div
                  className="prov-archivos-link"
                  onClick={() => navigate("/proveedor/archivos")}
                >
                  <p className="prov-archivos-title">
                    {t("proveedor.home.myFiles", "Mis Archivos")}
                  </p>
                  <p className="prov-archivos-desc">
                    {t(
                      "proveedor.home.myFilesDesc",
                      "Sube y gestiona tus archivos Excel organizados por categoría.",
                    )}
                  </p>
                  <span className="prov-archivos-cta">
                    {t("proveedor.home.goToFiles", "Ir a mis archivos →")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Offices Section */}
        <div className="sectionheadline">
          <div className="hal-page-container-content">
            <div className="hal-section-headline hal-module--border">
              <h2 className="hal-h4">{t("home.offices.title")}</h2>
              <h3 className="hal-h1">{t("home.offices.subtitle")}</h3>
            </div>
          </div>
        </div>

        <div className="containermodule parbase">
          <div className="hal-page-container-content">
            <div className="hal-container hal-container--plain hal-module--light">
              <div className="hal-container-content">
                <div className="hal-stagenews">
                  <div className="hal-stagenews-scene">
                    <div className="hal-carousel-item hal-carousel-item--left">
                      <picture>
                        <img src={imgUrl("/oficinas.jpg")} alt="Oficinas" />
                      </picture>
                      <div className="hal-stagenews-content hal-stagenews-content--left">
                        <div>
                          <h3 className="hal-h3">
                            {t("home.offices.sectionTitle")}
                          </h3>
                          <div className="hal-button-container">
                            <a
                              className="hal-button hal-button--primary"
                              href="https://seemanngroup.com/seemanngroup/nuestra_empresa.php#historia-section1"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t("home.offices.button")}
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* News Section */}
        <div className="sectionheadline">
          <div className="hal-page-container-content">
            <div className="hal-section-headline hal-module--border">
              <h2 className="hal-h4">{t("home.news.title")}</h2>
              <h3 className="hal-h1">{t("home.news.subtitle")}</h3>
            </div>
          </div>
        </div>

        <div className="hal-teasers hal-teasers--home">
          <div className="hal-carousel--news">
            {recentPosts.length > 0
              ? recentPosts.map((post) => (
                  <div
                    key={post.id}
                    className="hal-teaser hal-teaser--secondary"
                    onClick={() =>
                      navigate("/novedades", { state: { slug: post.slug } })
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <div className="hal-teaser-content hal-module--grey">
                      <div className="hal-teaser-top">
                        <div
                          className="hal-teaser-img"
                          style={{
                            backgroundImage: post.featuredImageUrl
                              ? `url(${post.featuredImageUrl})`
                              : "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
                          }}
                        ></div>
                        <div className="hal-meta">
                          <time>{formatBlogDate(post.publishDate)}</time>
                        </div>
                      </div>
                      <div className="hal-teaser-bottom">
                        <p className="hal-teaser-text">{post.title}</p>
                      </div>
                    </div>
                  </div>
                ))
              : [1, 2, 3, 4].map((i) => (
                  <div key={i} className="hal-teaser hal-teaser--secondary">
                    <div className="hal-teaser-content hal-module--grey">
                      <div className="hal-teaser-top">
                        <div
                          className="hal-teaser-img"
                          style={{
                            backgroundImage: `url(/insights${i}.png)`,
                          }}
                        ></div>
                        <div className="hal-meta">
                          <time>—</time>
                        </div>
                      </div>
                      <div className="hal-teaser-bottom">
                        <p
                          className="hal-teaser-text"
                          style={{ color: "#d1d5db" }}
                        >
                          {t("novedades.loading")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="containermodule parbase">
          <div className="hal-page-container-content">
            <div className="hal-container hal-container--plain hal-module--light">
              <div className="hal-container-content">
                <h3 className="hal-h3">{t("home.newsletter.title")}</h3>
                <div className="hal-richtext">
                  <p>{t("home.newsletter.text")}</p>
                </div>
                <div className="hal-button-container">
                  <button className="hal-button hal-button--primary">
                    {t("home.newsletter.button")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Company Stats Section */}
        <div className="sectionheadline">
          <div className="hal-page-container-content">
            <div className="hal-section-headline hal-module--border">
              <h2 className="hal-h4">{t("home.company.title")}</h2>
              <h3 className="hal-h1">{t("home.company.subtitle")}</h3>
            </div>
          </div>
        </div>

        <div className="containermodule parbase">
          <div className="hal-page-container-content">
            <div className="hal-container hal-container--plain hal-module--light">
              <div className="hal-container-content">
                <div className="hal-image-with-tiles hal-module--space-sm">
                  <div className="hal-image-with-tiles-container">
                    <div className="hal-picture-wrapper">
                      <img
                        src={imgUrl("/confianza.png")}
                        alt="Nuestra Compañía en Números"
                        className="hal-image-with-tiles-image"
                      />
                    </div>
                    <div className="hal-image-with-tiles-content">
                      <div className="hal-image-with-tiles-box hal-image-with-tiles-box--dark-grey">
                        <a href="#" onClick={(e) => e.preventDefault()}>
                          <span>
                            <p className="hal-image-with-tiles-headline">50+</p>
                            <p className="hal-image-with-tiles-subline">
                              {t("home.company.stats.experience")}
                            </p>
                          </span>
                        </a>
                      </div>
                      <div className="hal-image-with-tiles-box hal-image-with-tiles-box--orange">
                        <a href="#" onClick={(e) => e.preventDefault()}>
                          <span>
                            <p className="hal-image-with-tiles-headline">
                              200+
                            </p>
                            <p className="hal-image-with-tiles-subline">
                              {t("home.company.stats.clients")}
                            </p>
                          </span>
                        </a>
                      </div>
                      <div className="hal-image-with-tiles-box hal-image-with-tiles-box--grey">
                        <a href="#" onClick={(e) => e.preventDefault()}>
                          <span>
                            <p className="hal-image-with-tiles-headline">
                              100+
                            </p>
                            <p className="hal-image-with-tiles-subline">
                              {t("home.company.stats.employees")}
                            </p>
                          </span>
                        </a>
                      </div>
                      <div className="hal-image-with-tiles-box hal-image-with-tiles-box--light-grey">
                        <a href="#" onClick={(e) => e.preventDefault()}>
                          <span>
                            <p className="hal-image-with-tiles-headline">15+</p>
                            <p className="hal-image-with-tiles-subline">
                              {t("home.company.stats.countries")}
                            </p>
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

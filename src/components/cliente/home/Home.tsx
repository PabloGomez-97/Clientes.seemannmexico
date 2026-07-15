import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { imgUrl } from "../../../config/images";
import { getRecentPosts, getHomeSlides } from "../../../services/contentful";
import type { BlogPost } from "../../../services/contentful";
import "../styles/Home.css";
import WelcomeHeader from "./WelcomeHeader";
import HomeHeroCarousel, { type HeroSlide } from "./HomeHeroCarousel";
import HomeServicesGrid from "./HomeServicesGrid";
import HomeCarriersCarousel from "./HomeCarriersCarousel";
import EjecutivoCard from "./EjecutivoCard";

const HERO_PRIMARY_SLIDE_IMAGE = "/insights11.png";

function resolveHeroSlideImage(
  imageUrl: string | null | undefined,
  index: number,
): string {
  if (index === 0 && (!imageUrl || imageUrl.includes("insights1.png"))) {
    return imgUrl(HERO_PRIMARY_SLIDE_IMAGE);
  }

  return imageUrl || imgUrl("/insights1.png");
}

const FALLBACK_SLIDES = (t: (k: string) => string): HeroSlide[] => [
  {
    image: imgUrl(HERO_PRIMARY_SLIDE_IMAGE),
    title: t("home.slide1.title"),
    subtitle: t("home.slide1.subtitle"),
    button: { text: t("home.slide1.button"), link: "/promesas" },
  },
  {
    image: imgUrl("/insights2.png"),
    title: t("home.slide2.title"),
    subtitle: t("home.slide2.subtitle"),
    button: { text: t("home.slide2.button"), link: "/newquotes" },
  },
];

const Home: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [blogLoading, setBlogLoading] = useState(true);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(() =>
    FALLBACK_SLIDES(t),
  );

  useEffect(() => {
    getRecentPosts(4).then((posts) => {
      setBlogPosts(posts);
      setBlogLoading(false);
    });
  }, []);

  useEffect(() => {
    getHomeSlides().then((cmsSlides) => {
      if (cmsSlides.length === 0) {
        setHeroSlides(FALLBACK_SLIDES(t));
        return;
      }

      const mapped: HeroSlide[] = cmsSlides.map((s, index) => ({
        image: resolveHeroSlideImage(s.imageUrl, index),
        title: s.title,
        subtitle: s.subtitle,
        button: { text: s.buttonText, link: s.buttonLink },
      }));

      setHeroSlides(mapped);
    });
  }, [t]);

  const dateLocale = i18n.language === "es" ? es : enUS;

  const formatBlogDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy", { locale: dateLocale });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="hm-home-shell">
      <WelcomeHeader />

      <div className="hal-page-container">
        <div className="hal-hero-section">
          <HomeHeroCarousel slides={heroSlides} />
        </div>

        <div className="hal-page-container-content hal-main-after-hero">
          <HomeServicesGrid />
          <HomeCarriersCarousel />

          <section
            className="hal-news-section"
            aria-label={t("home.news.subtitle")}
          >
            <header className="hal-section-header">
              <h2 className="hal-section-heading">{t("home.news.subtitle")}</h2>
            </header>

            <div className="hal-services-grid">
              {blogLoading
                ? [1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="hal-service-card hal-news-card"
                      aria-hidden="true"
                    >
                      <div className="hal-service-image hal-news-image hm-skeleton" />
                      <div className="hal-service-content hal-news-content">
                        <div
                          className="hm-skeleton hm-skeleton--row"
                          style={{ height: 12, width: "40%" }}
                        />
                        <div
                          className="hm-skeleton hm-skeleton--row"
                          style={{ height: 14 }}
                        />
                        <div
                          className="hm-skeleton hm-skeleton--row"
                          style={{ height: 36 }}
                        />
                      </div>
                    </div>
                  ))
                : blogPosts.length > 0
                  ? blogPosts.map((post) => (
                      <article
                        key={post.id}
                        className="hal-service-card hal-news-card hal-service-card--clickable"
                        onClick={() =>
                          navigate("/novedades", {
                            state: { slug: post.slug },
                          })
                        }
                        role="link"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            navigate("/novedades", {
                              state: { slug: post.slug },
                            });
                          }
                        }}
                      >
                        <img
                          className="hal-service-image hal-news-image"
                          src={post.featuredImageUrl || imgUrl("/insights1.png")}
                          alt={post.featuredImageAlt || post.title}
                          width={298}
                          height={166}
                          loading="lazy"
                        />
                        <div className="hal-service-content hal-news-content">
                          <div className="hal-news-meta">
                            {post.category && (
                              <span className="hal-news-category">
                                {post.category}
                              </span>
                            )}
                            {post.publishDate && (
                              <time dateTime={post.publishDate}>
                                {formatBlogDate(post.publishDate)}
                              </time>
                            )}
                          </div>
                          <h3 className="hal-service-title hal-news-title">
                            {post.title}
                          </h3>
                          {post.excerpt ? (
                            <p className="hal-service-desc hal-news-excerpt">
                              {post.excerpt}
                            </p>
                          ) : (
                            <p
                              className="hal-service-desc hal-news-excerpt hal-news-excerpt--placeholder"
                              aria-hidden="true"
                            >
                              &nbsp;
                            </p>
                          )}
                          <span className="hal-service-cta">
                            {t("home.news.readMore")} →
                          </span>
                        </div>
                      </article>
                    ))
                  : null}
            </div>
          </section>

          <EjecutivoCard />
        </div>
      </div>
    </div>
  );
};

export default Home;

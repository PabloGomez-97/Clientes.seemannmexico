import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { imgUrl } from "../../../config/images";

export interface HeroSlide {
  image: string;
  title: string;
  subtitle: string;
  button: { text: string; link: string };
  dynamic?: boolean;
}

interface HomeHeroCarouselProps {
  slides: HeroSlide[];
}

const HomeHeroCarousel: React.FC<HomeHeroCarouselProps> = ({ slides }) => {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);

  // México: sin slide dinámico de embarques/tracking
  const resolvedSlides = useMemo(
    () => slides.filter((s) => !s.dynamic),
    [slides],
  );

  const resolveImage = (p?: string): string => {
    if (!p) return "";
    return p.startsWith("http") ? p : imgUrl(p);
  };

  useEffect(() => {
    if (resolvedSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % resolvedSlides.length);
    }, 20000);
    return () => clearInterval(interval);
  }, [resolvedSlides.length]);

  useEffect(() => {
    setCurrentSlide(0);
  }, [resolvedSlides.length]);

  const handlePrevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + resolvedSlides.length) % resolvedSlides.length,
    );
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % resolvedSlides.length);
  };

  if (resolvedSlides.length === 0) return null;

  return (
    <div className="hal-page-container-content">
      <div className="carousel parbase">
        <div className="hal-stage-teaser-carousel hal-hero-carousel">
          <div className="hal-stage-teaser-carousel-container">
            <div className="hal-stage-teaser-carousel-content">
              {resolvedSlides.map((slide, index) => (
                <div
                  key={index}
                  className={`hal-stage-teaser-carousel-item ${index === currentSlide ? "active" : ""}`}
                >
                  <div className="hal-stage-teaser-img-txt">
                    <div className="hal-stage-teaser-img-txt-scene">
                      <div className="hal-stage-teaser-img-txt-wrapper">
                        <div className="hal-picture-wrapper">
                          <img
                            src={resolveImage(slide.image)}
                            alt=""
                          />
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
            {resolvedSlides.length > 1 && (
              <>
                <button
                  type="button"
                  className="hal-stage-teaser-carousel-prev"
                  onClick={handlePrevSlide}
                  aria-label={t("home.hero.prevSlide")}
                />
                <button
                  type="button"
                  className="hal-stage-teaser-carousel-next"
                  onClick={handleNextSlide}
                  aria-label={t("home.hero.nextSlide")}
                />
                <div className="hal-stage-teaser-carousel-dots">
                  {resolvedSlides.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`hal-stage-teaser-carousel-dot ${index === currentSlide ? "hal-stage-teaser-carousel-dot-active" : ""}`}
                      onClick={() => setCurrentSlide(index)}
                      aria-label={t("home.hero.goToSlide", {
                        n: index + 1,
                      })}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeHeroCarousel;

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { documentToReactComponents } from "@contentful/rich-text-react-renderer";
import { BLOCKS, INLINES } from "@contentful/rich-text-types";
import type { Document, Block, Inline } from "@contentful/rich-text-types";
import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { getBlogPosts, getBlogPostBySlug } from "../../services/contentful";
import type { BlogPost } from "../../services/contentful";
import "./styles/Novedades.css";

const richTextOptions = {
  renderNode: {
    [BLOCKS.PARAGRAPH]: (_node: Block | Inline, children: React.ReactNode) => (
      <p className="novedades-paragraph">{children}</p>
    ),
    [BLOCKS.HEADING_1]: (_node: Block | Inline, children: React.ReactNode) => (
      <h1 className="novedades-h1">{children}</h1>
    ),
    [BLOCKS.HEADING_2]: (_node: Block | Inline, children: React.ReactNode) => (
      <h2 className="novedades-h2">{children}</h2>
    ),
    [BLOCKS.HEADING_3]: (_node: Block | Inline, children: React.ReactNode) => (
      <h3 className="novedades-h3">{children}</h3>
    ),
    [BLOCKS.UL_LIST]: (_node: Block | Inline, children: React.ReactNode) => (
      <ul className="novedades-list">{children}</ul>
    ),
    [BLOCKS.OL_LIST]: (_node: Block | Inline, children: React.ReactNode) => (
      <ol className="novedades-list novedades-list--ordered">{children}</ol>
    ),
    [BLOCKS.LIST_ITEM]: (_node: Block | Inline, children: React.ReactNode) => (
      <li className="novedades-list-item">{children}</li>
    ),
    [BLOCKS.QUOTE]: (_node: Block | Inline, children: React.ReactNode) => (
      <blockquote className="novedades-blockquote">{children}</blockquote>
    ),
    [BLOCKS.EMBEDDED_ASSET]: (node: Block | Inline) => {
      const { file, title } = (node as Block).data.target.fields;
      const url = file?.url ? `https:${file.url}` : "";
      return (
        <div className="novedades-embedded-image">
          <img src={url} alt={title || ""} />
        </div>
      );
    },
    [INLINES.HYPERLINK]: (node: Block | Inline, children: React.ReactNode) => (
      <a
        href={(node as Inline).data.uri}
        target="_blank"
        rel="noopener noreferrer"
        className="novedades-link"
      >
        {children}
      </a>
    ),
  },
};

const Novedades: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPost, setLoadingPost] = useState(false);

  const dateLocale = i18n.language === "es" ? es : enUS;

  useEffect(() => {
    loadPosts();
  }, []);

  // If navigated from Home with a slug in state, open that post
  useEffect(() => {
    const state = location.state as { slug?: string } | null;
    if (state?.slug) {
      handleSelectPost(state.slug);
      // Clear the state so refreshing doesn't re-open
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadPosts = async () => {
    setLoading(true);
    const data = await getBlogPosts(20);
    setPosts(data);
    setLoading(false);
  };

  const handleSelectPost = async (slug: string) => {
    setLoadingPost(true);
    const post = await getBlogPostBySlug(slug);
    setSelectedPost(post);
    setLoadingPost(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setSelectedPost(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy", { locale: dateLocale });
    } catch {
      return dateStr;
    }
  };

  // Individual post view
  if (selectedPost) {
    return (
      <div className="novedades-container">
        <button className="novedades-back-btn" onClick={handleBack}>
          <i className="fa fa-arrow-left" />
          <span>{t("novedades.backToList")}</span>
        </button>

        <article className="novedades-article">
          {selectedPost.featuredImageUrl && (
            <div className="novedades-article-hero">
              <img
                src={selectedPost.featuredImageUrl}
                alt={selectedPost.featuredImageAlt}
              />
            </div>
          )}

          <div className="novedades-article-header">
            {selectedPost.category && (
              <span className="novedades-category-badge">
                {selectedPost.category}
              </span>
            )}
            <h1 className="novedades-article-title">{selectedPost.title}</h1>
            <div className="novedades-article-meta">
              <span className="novedades-article-author">
                <i className="fa fa-user" /> {selectedPost.author}
              </span>
              <span className="novedades-article-date">
                <i className="fa fa-calendar" />{" "}
                {formatDate(selectedPost.publishDate)}
              </span>
            </div>
          </div>

          <div className="novedades-article-body">
            {selectedPost.content &&
              documentToReactComponents(
                selectedPost.content as unknown as Document,
                richTextOptions,
              )}
          </div>
        </article>
      </div>
    );
  }

  // Blog list view
  return (
    <div className="novedades-container">
      <div className="novedades-header">
        <h1 className="novedades-title">{t("novedades.title")}</h1>
        <p className="novedades-subtitle">{t("novedades.subtitle")}</p>
      </div>

      {loading ? (
        <div className="novedades-loading">
          <i className="fa fa-spinner fa-spin" />
          <span>{t("novedades.loading")}</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="novedades-empty">
          <i className="fa fa-newspaper" />
          <p>{t("novedades.noPosts")}</p>
        </div>
      ) : (
        <div className="novedades-grid">
          {posts.map((post) => (
            <div
              key={post.id}
              className="novedades-card"
              onClick={() => handleSelectPost(post.slug)}
            >
              <div className="novedades-card-image">
                {post.featuredImageUrl ? (
                  <img
                    src={post.featuredImageUrl}
                    alt={post.featuredImageAlt}
                  />
                ) : (
                  <div className="novedades-card-placeholder">
                    <i className="fa fa-image" />
                  </div>
                )}
                {post.category && (
                  <span className="novedades-card-category">
                    {post.category}
                  </span>
                )}
              </div>
              <div className="novedades-card-body">
                <div className="novedades-card-meta">
                  <time>{formatDate(post.publishDate)}</time>
                  <span className="novedades-card-author">{post.author}</span>
                </div>
                <h3 className="novedades-card-title">{post.title}</h3>
                {post.excerpt && (
                  <p className="novedades-card-excerpt">{post.excerpt}</p>
                )}
                <span className="novedades-card-readmore">
                  {t("novedades.readMore")} <i className="fa fa-arrow-right" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {loadingPost && (
        <div className="novedades-overlay">
          <div className="novedades-overlay-content">
            <i className="fa fa-spinner fa-spin" />
            <span>{t("novedades.loading")}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Novedades;

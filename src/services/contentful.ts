import { createClient } from "contentful";
import type { Entry, EntrySkeletonType } from "contentful";

// Contentful client
const client = createClient({
  space: import.meta.env.VITE_CONTENTFUL_SPACE_ID,
  accessToken: import.meta.env.VITE_CONTENTFUL_ACCESS_TOKEN,
  environment: import.meta.env.VITE_CONTENTFUL_ENVIRONMENT || "master",
});

// Blog post fields from Contentful content type 'blog1'
export interface BlogPostFields {
  title: string;
  slug: string;
  author: string;
  publishDate: string;
  featuredImage?: {
    fields: {
      file: {
        url: string;
        details?: {
          image?: { width: number; height: number };
        };
      };
      title?: string;
    };
  };
  excerpt?: string;
  content?: Record<string, unknown>; // Rich Text Document
  category?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  author: string;
  publishDate: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string;
  excerpt: string;
  content: Record<string, unknown> | null;
  category: string;
}

/**
 * Transform a Contentful entry into a clean BlogPost object
 */
function transformEntry(entry: Entry<EntrySkeletonType>): BlogPost {
  const fields = entry.fields as unknown as BlogPostFields;

  const featuredImage = fields.featuredImage as BlogPostFields["featuredImage"];
  const imageUrl = featuredImage?.fields?.file?.url
    ? `https:${featuredImage.fields.file.url}`
    : null;
  const imageAlt = featuredImage?.fields?.title || fields.title || "";

  return {
    id: entry.sys.id,
    title: fields.title || "",
    slug: fields.slug || "",
    author: fields.author || "",
    publishDate: fields.publishDate || "",
    featuredImageUrl: imageUrl,
    featuredImageAlt: imageAlt,
    excerpt: fields.excerpt || "",
    content: fields.content || null,
    category: fields.category || "",
  };
}

/**
 * Get blog posts from Contentful, ordered by publish date (newest first)
 */
export async function getBlogPosts(limit = 10): Promise<BlogPost[]> {
  try {
    const response = await client.getEntries({
      content_type: "blog1",
      order: ["-fields.publishDate"],
      limit,
    });
    return response.items.map(transformEntry);
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
}

/**
 * Get a single blog post by its slug
 */
export async function getBlogPostBySlug(
  slug: string
): Promise<BlogPost | null> {
  try {
    const response = await client.getEntries({
      content_type: "blog1",
      "fields.slug": slug,
      limit: 1,
    });
    if (response.items.length === 0) return null;
    return transformEntry(response.items[0]);
  } catch (error) {
    console.error("Error fetching blog post by slug:", error);
    return null;
  }
}

/**
 * Get recent blog posts (for Home page section)
 */
export async function getRecentPosts(limit = 4): Promise<BlogPost[]> {
  return getBlogPosts(limit);
}

export interface HomeSlideFields {
  title: string;
  subtitle?: string;
  buttonText: string;
  buttonLink: string;
  order?: number;
  featuredImage?: BlogPostFields["featuredImage"];
}

export interface HomeSlide {
  id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string | null;
  order: number;
}

function transformHomeSlide(entry: Entry<EntrySkeletonType>): HomeSlide {
  const fields = entry.fields as unknown as HomeSlideFields;
  const featuredImage = fields.featuredImage;
  const imageUrl = featuredImage?.fields?.file?.url
    ? `https:${featuredImage.fields.file.url}`
    : null;

  return {
    id: entry.sys.id,
    title: fields.title || "",
    subtitle: fields.subtitle || "",
    buttonText: fields.buttonText || "",
    buttonLink: fields.buttonLink || "/newquotes",
    imageUrl,
    order: typeof fields.order === "number" ? fields.order : 0,
  };
}

function isHomeSlidesContentfulEnabled(): boolean {
  const spaceId = import.meta.env.VITE_CONTENTFUL_SPACE_ID;
  const accessToken = import.meta.env.VITE_CONTENTFUL_ACCESS_TOKEN;
  const enabled =
    String(
      import.meta.env.VITE_CONTENTFUL_HOME_SLIDES_ENABLED ?? "",
    ).toLowerCase() === "true";

  return Boolean(spaceId && accessToken && enabled);
}

/**
 * Hero slides from Contentful (content type: homeSlide). Returns [] if unavailable.
 * Opt-in via VITE_CONTENTFUL_HOME_SLIDES_ENABLED=true once the CMS content type exists.
 */
export async function getHomeSlides(): Promise<HomeSlide[]> {
  if (!isHomeSlidesContentfulEnabled()) {
    return [];
  }

  try {
    const response = await client.getEntries({
      content_type: "homeSlide",
      limit: 5,
    });
    return response.items
      .map(transformHomeSlide)
      .sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error("Error fetching home slides:", error);
    return [];
  }
}

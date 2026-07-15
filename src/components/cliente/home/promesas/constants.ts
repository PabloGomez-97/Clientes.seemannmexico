export type PromesasSection = "company" | "commitments" | "services";

export type ServiceModality = "sea" | "air" | "land" | "customs" | "multimodal";

export const SERVICE_MODALITIES: ServiceModality[] = [
  "sea",
  "air",
  "land",
  "customs",
  "multimodal",
];

export const SERVICE_QUOTE_LINKS: Record<ServiceModality, string> = {
  sea: "/newquotes?tipo=FCL",
  air: "/newquotes?tipo=AEREO",
  land: "/newquotes?tipo=LASTMILE",
  customs: "/cotizacion-especial",
  multimodal: "/cotizacion-especial",
};

/** Hero backgrounds aligned with seemanngroup.com service pages */
export const SERVICE_HERO_IMAGES: Record<ServiceModality, string> = {
  sea: "https://images.unsplash.com/photo-1494412651409-8963ce7935a7?w=1600&h=900&fit=crop",
  air: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1600&h=900&fit=crop",
  land: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=1600&h=900&fit=crop",
  customs: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1600&h=900&fit=crop",
  multimodal: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1600&h=900&fit=crop",
};

export const VALUE_PILLAR_KEYS = [
  "global",
  "anticipate",
  "experience",
  "support",
] as const;

export const COMPANY_VALUE_KEYS = [
  "empathy",
  "personalization",
  "responsibility",
  "sincerity",
  "commitment",
  "flexibility",
] as const;

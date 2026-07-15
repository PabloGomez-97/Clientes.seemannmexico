export type ContainerSpec = {
  id: string;
  imagePath: string;
  isoCode: string;
};

/** Medidas estándar ISO 668 / uso habitual en navieras. Payload = max gross − tare (referencial). */
export const CONTAINER_SPECS: ContainerSpec[] = [
  { id: "20gp", imagePath: "/contenedores/20gp.png", isoCode: "22G1" },
  { id: "40gp", imagePath: "/contenedores/40gp.png", isoCode: "42G1" },
  { id: "40hq", imagePath: "/contenedores/40hq.png", isoCode: "45G1" },
  { id: "40nor", imagePath: "/contenedores/40nor.png", isoCode: "45R1" },
  { id: "45hc", imagePath: "/contenedores/45hc.png", isoCode: "L5G1" },
  { id: "20rf", imagePath: "/contenedores/20rf.png", isoCode: "22R1" },
  { id: "40rh", imagePath: "/contenedores/40rh.png", isoCode: "45R1" },
  { id: "20ot", imagePath: "/contenedores/20ot.png", isoCode: "22U1" },
  { id: "40fr", imagePath: "/contenedores/40fr.png", isoCode: "42P1" },
];

export type ContainerDimensions = {
  ext: { l: number; w: number; h: number };
  int: { l: number; w: number; h: number };
  door?: { w: number; h: number };
  maxGrossKg: number;
  tareKg: number;
  payloadKg: number;
  volumeM3: number;
};

/** Valores técnicos en metros / kg — referencia operativa, pueden variar por naviera. */
export const CONTAINER_DIMENSIONS: Record<string, ContainerDimensions> = {
  "20gp": {
    ext: { l: 6.058, w: 2.438, h: 2.591 },
    int: { l: 5.898, w: 2.352, h: 2.393 },
    door: { w: 2.343, h: 2.28 },
    maxGrossKg: 30480,
    tareKg: 2300,
    payloadKg: 28180,
    volumeM3: 33.2,
  },
  "40gp": {
    ext: { l: 12.192, w: 2.438, h: 2.591 },
    int: { l: 12.032, w: 2.352, h: 2.393 },
    door: { w: 2.34, h: 2.28 },
    maxGrossKg: 30480,
    tareKg: 3750,
    payloadKg: 26730,
    volumeM3: 67.7,
  },
  "40hq": {
    ext: { l: 12.192, w: 2.438, h: 2.896 },
    int: { l: 12.032, w: 2.352, h: 2.698 },
    door: { w: 2.34, h: 2.585 },
    maxGrossKg: 30480,
    tareKg: 3900,
    payloadKg: 26580,
    volumeM3: 76.3,
  },
  "40nor": {
    ext: { l: 12.192, w: 2.438, h: 2.896 },
    int: { l: 12.02, w: 2.28, h: 2.561 },
    door: { w: 2.29, h: 2.535 },
    maxGrossKg: 30480,
    tareKg: 4500,
    payloadKg: 25980,
    volumeM3: 67.5,
  },
  "45hc": {
    ext: { l: 13.716, w: 2.438, h: 2.896 },
    int: { l: 13.556, w: 2.352, h: 2.698 },
    door: { w: 2.34, h: 2.585 },
    maxGrossKg: 32500,
    tareKg: 4800,
    payloadKg: 27700,
    volumeM3: 86.4,
  },
  "20rf": {
    ext: { l: 6.058, w: 2.438, h: 2.591 },
    int: { l: 5.44, w: 2.26, h: 2.27 },
    door: { w: 2.29, h: 2.26 },
    maxGrossKg: 30480,
    tareKg: 3200,
    payloadKg: 27280,
    volumeM3: 28.0,
  },
  "40rh": {
    ext: { l: 12.192, w: 2.438, h: 2.896 },
    int: { l: 11.558, w: 2.29, h: 2.544 },
    door: { w: 2.29, h: 2.535 },
    maxGrossKg: 34000,
    tareKg: 5200,
    payloadKg: 28800,
    volumeM3: 67.5,
  },
  "20ot": {
    ext: { l: 6.058, w: 2.438, h: 2.591 },
    int: { l: 5.89, w: 2.35, h: 2.35 },
    door: { w: 2.34, h: 2.28 },
    maxGrossKg: 30480,
    tareKg: 2600,
    payloadKg: 27880,
    volumeM3: 32.5,
  },
  "40fr": {
    ext: { l: 12.192, w: 2.438, h: 2.591 },
    int: { l: 12.034, w: 2.4, h: 2.35 },
    maxGrossKg: 45000,
    tareKg: 5200,
    payloadKg: 39800,
    volumeM3: 62.0,
  },
};

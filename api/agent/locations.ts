// api/agent/locations.ts
// Subset de puertos y aeropuertos comunes para lookup desde el chatbot.
// Cubre las rutas más frecuentes de Seemann Group (Américas, Europa, Asia).

export interface PortInfo {
  code: string;        // UNLOCODE (5 letras)
  name: string;
  city: string;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  lat: number;
  lng: number;
}

export interface AirportInfo {
  code: string;        // IATA (3 letras)
  name: string;
  city: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

// =================== PUERTOS ===================
export const PORTS: PortInfo[] = [
  // Chile
  { code: 'CLSAI', name: 'Puerto de San Antonio', city: 'San Antonio', country: 'Chile', countryCode: 'CL', lat: -33.5928, lng: -71.6149 },
  { code: 'CLVAP', name: 'Puerto de Valparaíso', city: 'Valparaíso', country: 'Chile', countryCode: 'CL', lat: -33.0344, lng: -71.6206 },
  { code: 'CLIQQ', name: 'Puerto de Iquique', city: 'Iquique', country: 'Chile', countryCode: 'CL', lat: -20.2080, lng: -70.1485 },
  { code: 'CLARI', name: 'Puerto de Arica', city: 'Arica', country: 'Chile', countryCode: 'CL', lat: -18.4783, lng: -70.3126 },
  { code: 'CLANF', name: 'Puerto de Antofagasta', city: 'Antofagasta', country: 'Chile', countryCode: 'CL', lat: -23.6509, lng: -70.3975 },
  { code: 'CLPMC', name: 'Puerto de Punta Arenas', city: 'Punta Arenas', country: 'Chile', countryCode: 'CL', lat: -53.1638, lng: -70.9171 },
  // EE.UU.
  { code: 'USMIA', name: 'Port of Miami', city: 'Miami', country: 'United States', countryCode: 'US', lat: 25.7783, lng: -80.1701 },
  { code: 'USLAX', name: 'Port of Los Angeles', city: 'Los Angeles', country: 'United States', countryCode: 'US', lat: 33.7395, lng: -118.2610 },
  { code: 'USLGB', name: 'Port of Long Beach', city: 'Long Beach', country: 'United States', countryCode: 'US', lat: 33.7666, lng: -118.1893 },
  { code: 'USNYC', name: 'Port of New York/New Jersey', city: 'New York', country: 'United States', countryCode: 'US', lat: 40.6650, lng: -74.0473 },
  { code: 'USHOU', name: 'Port of Houston', city: 'Houston', country: 'United States', countryCode: 'US', lat: 29.7264, lng: -95.0151 },
  { code: 'USCHS', name: 'Port of Charleston', city: 'Charleston', country: 'United States', countryCode: 'US', lat: 32.8343, lng: -79.8822 },
  { code: 'USSAV', name: 'Port of Savannah', city: 'Savannah', country: 'United States', countryCode: 'US', lat: 32.0809, lng: -81.0912 },
  { code: 'USOAK', name: 'Port of Oakland', city: 'Oakland', country: 'United States', countryCode: 'US', lat: 37.8044, lng: -122.2711 },
  // China
  { code: 'CNSHA', name: 'Port of Shanghai', city: 'Shanghai', country: 'China', countryCode: 'CN', lat: 31.2304, lng: 121.4737 },
  { code: 'CNNGB', name: 'Port of Ningbo-Zhoushan', city: 'Ningbo', country: 'China', countryCode: 'CN', lat: 29.8683, lng: 121.5440 },
  { code: 'CNYTN', name: 'Port of Yantian (Shenzhen)', city: 'Shenzhen', country: 'China', countryCode: 'CN', lat: 22.5667, lng: 114.2667 },
  { code: 'CNSZX', name: 'Port of Shekou (Shenzhen)', city: 'Shenzhen', country: 'China', countryCode: 'CN', lat: 22.4836, lng: 113.9210 },
  { code: 'CNQIN', name: 'Port of Qingdao', city: 'Qingdao', country: 'China', countryCode: 'CN', lat: 36.0671, lng: 120.3826 },
  { code: 'CNXMG', name: 'Port of Xiamen', city: 'Xiamen', country: 'China', countryCode: 'CN', lat: 24.4798, lng: 118.0894 },
  { code: 'CNTAO', name: 'Port of Qingdao', city: 'Qingdao', country: 'China', countryCode: 'CN', lat: 36.0671, lng: 120.3826 },
  // Asia
  { code: 'HKHKG', name: 'Port of Hong Kong', city: 'Hong Kong', country: 'Hong Kong', countryCode: 'HK', lat: 22.3193, lng: 114.1694 },
  { code: 'SGSIN', name: 'Port of Singapore', city: 'Singapore', country: 'Singapore', countryCode: 'SG', lat: 1.2649, lng: 103.8203 },
  { code: 'JPYOK', name: 'Port of Yokohama', city: 'Yokohama', country: 'Japan', countryCode: 'JP', lat: 35.4437, lng: 139.6380 },
  { code: 'JPTYO', name: 'Port of Tokyo', city: 'Tokyo', country: 'Japan', countryCode: 'JP', lat: 35.6520, lng: 139.7780 },
  { code: 'KRPUS', name: 'Port of Busan', city: 'Busan', country: 'South Korea', countryCode: 'KR', lat: 35.0951, lng: 129.0756 },
  { code: 'TWKHH', name: 'Port of Kaohsiung', city: 'Kaohsiung', country: 'Taiwan', countryCode: 'TW', lat: 22.6273, lng: 120.3014 },
  // Europa
  { code: 'NLRTM', name: 'Port of Rotterdam', city: 'Rotterdam', country: 'Netherlands', countryCode: 'NL', lat: 51.9225, lng: 4.4792 },
  { code: 'DEHAM', name: 'Port of Hamburg', city: 'Hamburg', country: 'Germany', countryCode: 'DE', lat: 53.5413, lng: 9.9837 },
  { code: 'BEANR', name: 'Port of Antwerp', city: 'Antwerp', country: 'Belgium', countryCode: 'BE', lat: 51.2602, lng: 4.4014 },
  { code: 'ESBCN', name: 'Port of Barcelona', city: 'Barcelona', country: 'Spain', countryCode: 'ES', lat: 41.3485, lng: 2.1745 },
  { code: 'ESVLC', name: 'Port of Valencia', city: 'Valencia', country: 'Spain', countryCode: 'ES', lat: 39.4441, lng: -0.3222 },
  { code: 'GBFXT', name: 'Port of Felixstowe', city: 'Felixstowe', country: 'United Kingdom', countryCode: 'GB', lat: 51.9591, lng: 1.3520 },
  { code: 'ITGOA', name: 'Port of Genoa', city: 'Genoa', country: 'Italy', countryCode: 'IT', lat: 44.4056, lng: 8.9463 },
  // Latam (resto)
  { code: 'PECLL', name: 'Puerto del Callao', city: 'Callao', country: 'Peru', countryCode: 'PE', lat: -12.0556, lng: -77.1456 },
  { code: 'COBUN', name: 'Puerto de Buenaventura', city: 'Buenaventura', country: 'Colombia', countryCode: 'CO', lat: 3.8800, lng: -77.0319 },
  { code: 'COCTG', name: 'Puerto de Cartagena', city: 'Cartagena', country: 'Colombia', countryCode: 'CO', lat: 10.4236, lng: -75.5378 },
  { code: 'BRSSZ', name: 'Port of Santos', city: 'Santos', country: 'Brazil', countryCode: 'BR', lat: -23.9618, lng: -46.3322 },
  { code: 'ARBUE', name: 'Puerto de Buenos Aires', city: 'Buenos Aires', country: 'Argentina', countryCode: 'AR', lat: -34.6037, lng: -58.3816 },
  { code: 'MXVER', name: 'Puerto de Veracruz', city: 'Veracruz', country: 'Mexico', countryCode: 'MX', lat: 19.1990, lng: -96.1429 },
  { code: 'MXMZL', name: 'Puerto de Manzanillo', city: 'Manzanillo', country: 'Mexico', countryCode: 'MX', lat: 19.0533, lng: -104.3158 },
  { code: 'GTSTM', name: 'Puerto Santo Tomás de Castilla', city: 'Santo Tomás', country: 'Guatemala', countryCode: 'GT', lat: 15.6928, lng: -88.6047 },
  { code: 'ECGYE', name: 'Puerto de Guayaquil', city: 'Guayaquil', country: 'Ecuador', countryCode: 'EC', lat: -2.2839, lng: -79.9156 },
];

// =================== AEROPUERTOS ===================
export const AIRPORTS: AirportInfo[] = [
  // Chile
  { code: 'SCL', name: 'Aeropuerto Arturo Merino Benítez', city: 'Santiago', country: 'Chile', countryCode: 'CL', lat: -33.3930, lng: -70.7858 },
  { code: 'IQQ', name: 'Aeropuerto Diego Aracena', city: 'Iquique', country: 'Chile', countryCode: 'CL', lat: -20.5352, lng: -70.1813 },
  // EE.UU.
  { code: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'United States', countryCode: 'US', lat: 25.7959, lng: -80.2870 },
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', countryCode: 'US', lat: 40.6413, lng: -73.7781 },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', countryCode: 'US', lat: 33.9416, lng: -118.4085 },
  { code: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', country: 'United States', countryCode: 'US', lat: 29.9902, lng: -95.3368 },
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', country: 'United States', countryCode: 'US', lat: 33.6407, lng: -84.4277 },
  { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'United States', countryCode: 'US', lat: 41.9742, lng: -87.9073 },
  { code: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'United States', countryCode: 'US', lat: 32.8998, lng: -97.0403 },
  { code: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', country: 'United States', countryCode: 'US', lat: 40.6925, lng: -74.1687 },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'United States', countryCode: 'US', lat: 37.6213, lng: -122.3790 },
  // China / Asia
  { code: 'PVG', name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'China', countryCode: 'CN', lat: 31.1443, lng: 121.8083 },
  { code: 'PEK', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'China', countryCode: 'CN', lat: 40.0799, lng: 116.6031 },
  { code: 'CAN', name: 'Guangzhou Baiyun International Airport', city: 'Guangzhou', country: 'China', countryCode: 'CN', lat: 23.3924, lng: 113.2988 },
  { code: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong', countryCode: 'HK', lat: 22.3080, lng: 113.9185 },
  { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', countryCode: 'SG', lat: 1.3644, lng: 103.9915 },
  { code: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', countryCode: 'JP', lat: 35.7720, lng: 140.3929 },
  { code: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea', countryCode: 'KR', lat: 37.4602, lng: 126.4407 },
  { code: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', countryCode: 'TH', lat: 13.6900, lng: 100.7501 },
  { code: 'DEL', name: 'Indira Gandhi International Airport', city: 'New Delhi', country: 'India', countryCode: 'IN', lat: 28.5562, lng: 77.1000 },
  { code: 'BOM', name: 'Chhatrapati Shivaji Maharaj International', city: 'Mumbai', country: 'India', countryCode: 'IN', lat: 19.0896, lng: 72.8656 },
  // Europa
  { code: 'AMS', name: 'Amsterdam Schiphol Airport', city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', lat: 52.3105, lng: 4.7683 },
  { code: 'FRA', name: 'Frankfurt am Main Airport', city: 'Frankfurt', country: 'Germany', countryCode: 'DE', lat: 50.0379, lng: 8.5622 },
  { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', countryCode: 'FR', lat: 49.0097, lng: 2.5479 },
  { code: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom', countryCode: 'GB', lat: 51.4700, lng: -0.4543 },
  { code: 'MAD', name: 'Aeropuerto Adolfo Suárez Madrid-Barajas', city: 'Madrid', country: 'Spain', countryCode: 'ES', lat: 40.4983, lng: -3.5676 },
  { code: 'BCN', name: 'Barcelona-El Prat Airport', city: 'Barcelona', country: 'Spain', countryCode: 'ES', lat: 41.2974, lng: 2.0833 },
  { code: 'FCO', name: 'Aeroporto Leonardo da Vinci–Fiumicino', city: 'Rome', country: 'Italy', countryCode: 'IT', lat: 41.8003, lng: 12.2389 },
  // Latam
  { code: 'LIM', name: 'Aeropuerto Internacional Jorge Chávez', city: 'Lima', country: 'Peru', countryCode: 'PE', lat: -12.0219, lng: -77.1143 },
  { code: 'BOG', name: 'Aeropuerto Internacional El Dorado', city: 'Bogotá', country: 'Colombia', countryCode: 'CO', lat: 4.7016, lng: -74.1469 },
  { code: 'GRU', name: 'Aeroporto Internacional de São Paulo–Guarulhos', city: 'São Paulo', country: 'Brazil', countryCode: 'BR', lat: -23.4356, lng: -46.4731 },
  { code: 'EZE', name: 'Aeropuerto Internacional Ministro Pistarini', city: 'Buenos Aires', country: 'Argentina', countryCode: 'AR', lat: -34.8222, lng: -58.5358 },
  { code: 'MEX', name: 'Aeropuerto Internacional Benito Juárez', city: 'Mexico City', country: 'Mexico', countryCode: 'MX', lat: 19.4361, lng: -99.0719 },
  { code: 'GUA', name: 'Aeropuerto Internacional La Aurora', city: 'Guatemala City', country: 'Guatemala', countryCode: 'GT', lat: 14.5833, lng: -90.5275 },
  { code: 'PTY', name: 'Tocumen International Airport', city: 'Panama City', country: 'Panama', countryCode: 'PA', lat: 9.0714, lng: -79.3835 },
  { code: 'UIO', name: 'Aeropuerto Internacional Mariscal Sucre', city: 'Quito', country: 'Ecuador', countryCode: 'EC', lat: -0.1286, lng: -78.3575 },
];

// ============================================================================
// LOOKUPS
// ============================================================================

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function findPort(query: string): PortInfo | null {
  const q = norm(query);
  if (!q) return null;
  // Exact code match
  for (const p of PORTS) if (p.code.toLowerCase() === q) return p;
  // City/name partial
  for (const p of PORTS) if (norm(p.city) === q || norm(p.name).includes(q)) return p;
  for (const p of PORTS) if (norm(p.city).includes(q) || norm(p.name).includes(q)) return p;
  return null;
}

export function findAirport(query: string): AirportInfo | null {
  const q = norm(query);
  if (!q) return null;
  for (const a of AIRPORTS) if (a.code.toLowerCase() === q) return a;
  for (const a of AIRPORTS) if (norm(a.city) === q) return a;
  for (const a of AIRPORTS) if (norm(a.city).includes(q) || norm(a.name).includes(q)) return a;
  return null;
}

export function findLocation(query: string): { type: 'port' | 'airport'; data: PortInfo | AirportInfo } | null {
  const a = findAirport(query);
  if (a) return { type: 'airport', data: a };
  const p = findPort(query);
  if (p) return { type: 'port', data: p };
  return null;
}

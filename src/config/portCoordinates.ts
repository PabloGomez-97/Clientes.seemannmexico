export interface PortCoords {
  lat: number;
  lng: number;
  name: string;
  unlocode: string;
}

/**
 * Coordenadas de puertos mapeados por su nombre normalizado (lowercase).
 * Se utiliza para trazar la ruta desde la dirección de recogida hasta el puerto de origen.
 */
export const portCoordinates: Record<string, PortCoords> = {
  atlanta: {
    lat: 33.7490,
    lng: -84.3880,
    name: "Atlanta (Inland Port)",
    unlocode: "USATL",
  },
  barcelona: {
    lat: 41.3485,
    lng: 2.1745,
    name: "Port of Barcelona",
    unlocode: "ESBCN",
  },
  bilbao: {
    lat: 43.3413,
    lng: -3.0414,
    name: "Port of Bilbao",
    unlocode: "ESBIO",
  },
  charleston: {
    lat: 32.8343,
    lng: -79.8822,
    name: "Port of Charleston",
    unlocode: "USCHS",
  },
  chennai: {
    lat: 13.1002,
    lng: 80.2975,
    name: "Port of Chennai",
    unlocode: "INMAA",
  },
  chicago: {
    lat: 41.7269,
    lng: -87.5333,
    name: "Port of Chicago",
    unlocode: "USCHI",
  },
  cleveland: {
    lat: 41.5014,
    lng: -81.7037,
    name: "Port of Cleveland",
    unlocode: "USCLE",
  },
  cochin: {
    lat: 9.9698,
    lng: 76.2594,
    name: "Cochin Port",
    unlocode: "INCOK",
  },
  dalian: {
    lat: 38.9281,
    lng: 121.6387,
    name: "Port of Dalian",
    unlocode: "CNDLC",
  },
  dallas: {
    lat: 32.7767,
    lng: -96.7970,
    name: "Dallas (Inland Port)",
    unlocode: "USDAL",
  },
  durban: {
    lat: -29.8727,
    lng: 31.0464,
    name: "Port of Durban",
    unlocode: "ZADUR",
  },
  genoa: {
    lat: 44.4066,
    lng: 8.8967,
    name: "Port of Genoa",
    unlocode: "ITGOA",
  },
  hamburg: {
    lat: 53.5321,
    lng: 9.9646,
    name: "Port of Hamburg",
    unlocode: "DEHAM",
  },
  hazira: {
    lat: 21.0867,
    lng: 72.6313,
    name: "Hazira Port",
    unlocode: "INHZA",
  },
  houston: {
    lat: 29.7261,
    lng: -95.2688,
    name: "Port of Houston",
    unlocode: "USHOU",
  },
  istanbul: {
    lat: 41.0088,
    lng: 28.0097,
    name: "Port of Istanbul",
    unlocode: "TRIST",
  },
  kocaeli: {
    lat: 40.7639,
    lng: 29.9317,
    name: "Port of Kocaeli",
    unlocode: "TRKOC",
  },
  kolkata: {
    lat: 22.5755,
    lng: 88.3459,
    name: "Port of Kolkata",
    unlocode: "INCCU",
  },
  london: {
    lat: 51.5049,
    lng: 0.0211,
    name: "Port of London",
    unlocode: "GBLON",
  },
  long_beach: {
    lat: 33.7601,
    lng: -118.2292,
    name: "Port of Long Beach",
    unlocode: "USLGB",
  },
  los_angeles: {
    lat: 33.7369,
    lng: -118.2650,
    name: "Port of Los Angeles",
    unlocode: "USLAX",
  },
  miami: {
    lat: 25.7743,
    lng: -80.1703,
    name: "Port of Miami",
    unlocode: "USMIA",
  },
  mundra: {
    lat: 22.7394,
    lng: 69.7253,
    name: "Mundra Port",
    unlocode: "INMUN",
  },
  new_york: {
    lat: 40.6906,
    lng: -73.9998,
    name: "Port of New York and New Jersey",
    unlocode: "USNYC",
  },
  newark: {
    lat: 40.6963,
    lng: -74.1404,
    name: "Port Newark",
    unlocode: "USEWR",
  },
  nhava: {
    lat: 18.9478,
    lng: 72.9454,
    name: "Jawaharlal Nehru Port (Nhava Sheva)",
    unlocode: "INNSA",
  },
  ningbo: {
    lat: 29.9483,
    lng: 121.8881,
    name: "Port of Ningbo-Zhoushan",
    unlocode: "CNNGB",
  },
  philadelphia: {
    lat: 39.9807,
    lng: -75.0892,
    name: "Port of Philadelphia",
    unlocode: "USPHL",
  },
  port_everglades: {
    lat: 26.0958,
    lng: -80.1233,
    name: "Port Everglades",
    unlocode: "USPEF",
  },
  qingdao: {
    lat: 36.0698,
    lng: 120.3829,
    name: "Port of Qingdao",
    unlocode: "CNQDG",
  },
  savannah: {
    lat: 32.1236,
    lng: -81.1361,
    name: "Port of Savannah",
    unlocode: "USSAV",
  },
  shanghai: {
    lat: 30.6264,
    lng: 122.0652,
    name: "Port of Shanghai",
    unlocode: "CNSHA",
  },
  shenzhen: {
    lat: 22.5771,
    lng: 114.2734,
    name: "Port of Shenzhen",
    unlocode: "CNSZX",
  },
  tianjin: {
    lat: 38.9866,
    lng: 117.7358,
    name: "Port of Tianjin",
    unlocode: "CNTSN",
  },
  ambarli: {
    lat: 40.9812,
    lng: 29.0648,
    name: "Port of Ambarlı (Istanbul)",
    unlocode: "TRIST",
  },
  tuticorin: {
    lat: 8.7560,
    lng: 78.1792,
    name: "V.O. Chidambaranar Port (Tuticorin)",
    unlocode: "INTUT",
  },
  valencia: {
    lat: 39.4394,
    lng: -0.3245,
    name: "Port of Valencia",
    unlocode: "ESVLC",
  },
  xiamen: {
    lat: 24.4534,
    lng: 118.0819,
    name: "Port of Xiamen",
    unlocode: "CNXMN",
  },
  // A - B
  acajutla: {
    lat: 13.5932,
    lng: -89.8335,
    name: "Puerto de Acajutla",
    unlocode: "SVACJ",
  },
  adelaide: {
    lat: -34.8425,
    lng: 138.5036,
    name: "Port Adelaide",
    unlocode: "AUADL",
  },
  ahmedabad: {
    lat: 22.9626,
    lng: 72.4934,
    name: "ICD Ahmedabad",
    unlocode: "INAMD",
  },
  aqaba: {
    lat: 29.5165,
    lng: 35.0112,
    name: "Port of Aqaba",
    unlocode: "JOAQB",
  },
  alexandria: {
    lat: 31.1926,
    lng: 29.8784,
    name: "Port of Alexandria",
    unlocode: "EGALY",
  },
  algeciras: {
    lat: 36.1332,
    lng: -5.4411,
    name: "Puerto de Algeciras",
    unlocode: "ESALG",
  },
  alicante: {
    lat: 38.3342,
    lng: -0.4901,
    name: "Puerto de Alicante",
    unlocode: "ESALC",
  },
  almeria: {
    lat: 36.8335,
    lng: -2.4712,
    name: "Puerto de Almería",
    unlocode: "ESLEI",
  },
  anqing: {
    lat: 30.5078,
    lng: 117.0489,
    name: "Port of Anqing",
    unlocode: "CNAQG",
  },
  antwerp: {
    lat: 51.2411,
    lng: 4.4012,
    name: "Port of Antwerp",
    unlocode: "BEANT",
  },
  aarhus: {
    lat: 56.1522,
    lng: 10.2245,
    name: "Port of Aarhus",
    unlocode: "DKAAR",
  },
  ashdod: {
    lat: 31.8461,
    lng: 34.6534,
    name: "Port of Ashdod",
    unlocode: "ILASH",
  },
  auckland: {
    lat: -36.8441,
    lng: 174.7761,
    name: "Port of Auckland",
    unlocode: "NZAKL",
  },
  baltimore: {
    lat: 39.2711,
    lng: -76.5801,
    name: "Port of Baltimore",
    unlocode: "USBAL",
  },
  bangalore: {
    lat: 13.0125,
    lng: 77.6366,
    name: "ICD Bangalore",
    unlocode: "INBLR",
  },
  bangkok: {
    lat: 13.7032,
    lng: 100.5755,
    name: "Port of Bangkok (Klong Toey)",
    unlocode: "THBKK",
  },
  bar: {
    lat: 42.0931,
    lng: 19.0885,
    name: "Port of Bar",
    unlocode: "MEBAR",
  },
  bari: {
    lat: 41.1345,
    lng: 16.8631,
    name: "Porto di Bari",
    unlocode: "ITBRI",
  },
  baroda: {
    lat: 22.3411,
    lng: 73.1812,
    name: "ICD Baroda",
    unlocode: "INBRD",
  },
  basel: {
    lat: 47.5855,
    lng: 7.5932,
    name: "Port of Basel",
    unlocode: "CHBSL",
  },
  batangas: {
    lat: 13.7542,
    lng: 121.0451,
    name: "Batangas International Port",
    unlocode: "PHBTG",
  },
  beirut: {
    lat: 33.9012,
    lng: 35.5188,
    name: "Port of Beirut",
    unlocode: "LBBEY",
  },
  bayuquan: {
    lat: 40.2944,
    lng: 122.1466,
    name: "Port of Bayuquan",
    unlocode: "CNBYQ",
  },
  beijao: {
    lat: 22.9511,
    lng: 113.2145,
    name: "Beijao Port",
    unlocode: "CNBJA",
  },
  belawan: {
    lat: 3.7845,
    lng: 98.6912,
    name: "Port of Belawan",
    unlocode: "IDBLW",
  },
  bintulu: {
    lat: 3.2556,
    lng: 113.0788,
    name: "Bintulu Port",
    unlocode: "MYBTU",
  },
  birmingham: {
    lat: 52.4862,
    lng: -1.8904,
    name: "Birmingham (Inland Port)",
    unlocode: "GBBIR",
  },
  boston: {
    lat: 42.3411,
    lng: -71.0288,
    name: "Port of Boston",
    unlocode: "USBOS",
  },
  bradford: {
    lat: 53.7941,
    lng: -1.7518,
    name: "Bradford (Inland Port)",
    unlocode: "GBBRD",
  },
  bratislava: {
    lat: 48.1345,
    lng: 17.1366,
    name: "Port of Bratislava",
    unlocode: "SKBTS",
  },
  bremen: {
    lat: 53.1188,
    lng: 8.7122,
    name: "Port of Bremen",
    unlocode: "DEBRE",
  },
  brisbane: {
    lat: -27.3755,
    lng: 153.1612,
    name: "Port of Brisbane",
    unlocode: "AUBNE",
  },
  bristol: {
    lat: 51.5032,
    lng: -2.7112,
    name: "Port of Bristol",
    unlocode: "GBBRS",
  },
  bucharest: {
    lat: 44.4268,
    lng: 26.1025,
    name: "Bucharest (Inland Port)",
    unlocode: "ROBUH",
  },
  budapest: {
    lat: 47.4261,
    lng: 19.0688,
    name: "Port of Budapest",
    unlocode: "HUBUD",
  },
  buenaventura: {
    lat: 3.8912,
    lng: -77.0711,
    name: "Puerto de Buenaventura",
    unlocode: "COBUN",
  },
  buenos_aires: {
    lat: -34.5844,
    lng: -58.3712,
    name: "Puerto de Buenos Aires",
    unlocode: "ARBUE",
  },
  busan: {
    lat: 35.1011,
    lng: 129.0433,
    name: "Port of Busan",
    unlocode: "KRPUS",
  },
  // ==========================================
  // C - D
  // ==========================================
  cachoeirinha: { lat: -29.9322, lng: -51.0931, name: "Puerto Seco Cachoeirinha", unlocode: "BRCAC" },
  cagayan_de_oro: { lat: 8.5015, lng: 124.6612, name: "Port of Cagayan de Oro", unlocode: "PHCGY" },
  cape_town: { lat: -33.9152, lng: 18.4322, name: "Port of Cape Town", unlocode: "ZACPT" },
  cartagena: { lat: 10.3845, lng: -75.5188, name: "Puerto de Cartagena", unlocode: "COCTG" },
  casablanca: { lat: 33.6012, lng: -7.5866, name: "Port of Casablanca", unlocode: "MACAS" },
  catania: { lat: 37.4988, lng: 15.0931, name: "Port of Catania", unlocode: "ITCTA" },
  cebu: { lat: 10.2944, lng: 123.9088, name: "Port of Cebu", unlocode: "PHCEB" },
  changsha: { lat: 28.2411, lng: 112.9645, name: "Port of Changsha", unlocode: "CNCSX" },
  changshu: { lat: 31.7588, lng: 120.9422, name: "Port of Changshu", unlocode: "CNCGU" },
  changzhou: { lat: 31.8412, lng: 119.9888, name: "Port of Changzhou", unlocode: "CNCZX" },
  charlotte: { lat: 35.2155, lng: -80.9521, name: "Charlotte (Inland Port)", unlocode: "USCLT" },
  chengdu: { lat: 30.6544, lng: 104.0622, name: "Chengdu (Inland Port)", unlocode: "CNCTU" },
  chiwan: { lat: 22.4766, lng: 113.8822, name: "Chiwan Port", unlocode: "CNCWN" },
  chittagong: { lat: 22.3166, lng: 91.7955, name: "Port of Chittagong", unlocode: "BDCGP" },
  chongqing: { lat: 29.5844, lng: 106.5912, name: "Port of Chongqing", unlocode: "CNCKG" },
  cincinnati: { lat: 39.1022, lng: -84.5366, name: "Cincinnati (Inland Port)", unlocode: "USCVG" },
  colombo: { lat: 6.9466, lng: 79.8445, name: "Port of Colombo", unlocode: "LKCMB" },
  columbus: { lat: 39.9511, lng: -83.0066, name: "Columbus (Inland Port)", unlocode: "USCMH" },
  constanta: { lat: 44.1355, lng: 28.6412, name: "Port of Constanta", unlocode: "ROCND" },
  copenhagen: { lat: 55.7045, lng: 12.6022, name: "Port of Copenhagen", unlocode: "DKCPH" },
  curitiba: { lat: -25.4322, lng: -49.2788, name: "Curitiba (Inland Port)", unlocode: "BRCWB" },
  da_nang: { lat: 16.1188, lng: 108.2144, name: "Port of Da Nang", unlocode: "VNDAD" },
  davao: { lat: 7.1266, lng: 125.6644, name: "Port of Davao", unlocode: "PHDVO" },
  derby: { lat: 52.9233, lng: -1.4555, name: "Derby (Inland Port)", unlocode: "GBDBY" },
  detroit: { lat: 42.3166, lng: -83.0844, name: "Port of Detroit", unlocode: "USDET" },
  dongguan: { lat: 22.9511, lng: 113.6266, name: "Port of Dongguan", unlocode: "CNDGG" },
  jebel_ali: { lat: 24.9922, lng: 55.0566, name: "Port of Jebel Ali (Dubai)", unlocode: "AEAJA" },
  dublin: { lat: 53.3455, lng: -6.2166, name: "Port of Dublin", unlocode: "IEDUB" },
  // ==========================================
  // F - H
  // ==========================================
  fos_sur_mer: { lat: 43.4111, lng: 4.8822, name: "Port of Fos-sur-Mer", unlocode: "FRFOS" },
  foshan: { lat: 23.0188, lng: 113.1111, name: "Port of Foshan", unlocode: "CNFOS" },
  fredericia: { lat: 55.5588, lng: 9.7544, name: "Port of Fredericia", unlocode: "DKFRC" },
  fremantle: { lat: -32.0466, lng: 115.7488, name: "Port of Fremantle", unlocode: "AUFRE" },
  fuzhou: { lat: 25.9522, lng: 119.4611, name: "Port of Fuzhou", unlocode: "CNFOC" },
  gaogang: { lat: 32.3244, lng: 119.8312, name: "Port of Gaogang", unlocode: "CNGGN" },
  gdansk: { lat: 54.3855, lng: 18.6755, name: "Port of Gdansk", unlocode: "PLGDN" },
  gdynia: { lat: 54.5244, lng: 18.5444, name: "Port of Gdynia", unlocode: "PLGDY" },
  gebze: { lat: 40.7611, lng: 29.5166, name: "Port of Gebze", unlocode: "TRGEB" },
  gemlik: { lat: 40.4288, lng: 29.1311, name: "Port of Gemlik", unlocode: "TRGEM" },
  general_santos: { lat: 6.1044, lng: 125.1766, name: "Port of General Santos", unlocode: "PHGES" },
  geneve: { lat: 46.2155, lng: 6.1366, name: "Geneve (Inland Port)", unlocode: "CHGVA" },
  gijon: { lat: 43.5588, lng: -5.7066, name: "Puerto de Gijón", unlocode: "ESGIJ" },
  glasgow: { lat: 55.8644, lng: -4.2888, name: "Port of Glasgow", unlocode: "GBGLW" },
  gothenburg: { lat: 57.6966, lng: 11.8844, name: "Port of Gothenburg", unlocode: "SEGOT" },
  guangzhou: { lat: 23.0888, lng: 113.4566, name: "Port of Guangzhou (Huangpu)", unlocode: "CNWHI" },
  guayaquil: { lat: -2.2611, lng: -79.8822, name: "Puerto de Guayaquil", unlocode: "ECGYE" },
  hai_phong: { lat: 20.8655, lng: 106.6911, name: "Port of Hai Phong", unlocode: "VNHPH" },
  haifa: { lat: 32.8222, lng: 35.0188, name: "Port of Haifa", unlocode: "ILHFA" },
  haikou: { lat: 20.0211, lng: 110.2888, name: "Port of Haikou", unlocode: "CNHAK" },
  hakata: { lat: 33.6066, lng: 130.4044, name: "Port of Hakata", unlocode: "JPHKT" },
  haldia: { lat: 22.0288, lng: 88.0822, name: "Port of Haldia", unlocode: "INHAL" },
  halifax: { lat: 44.6366, lng: -63.5688, name: "Port of Halifax", unlocode: "CAHAL" },
  heathrow: { lat: 51.4722, lng: -0.4522, name: "Heathrow (Air/Inland Hub)", unlocode: "GBLHR" },
  hefei: { lat: 31.8488, lng: 117.2622, name: "Port of Hefei", unlocode: "CNHFE" },
  helsinki: { lat: 60.1588, lng: 24.9311, name: "Port of Helsinki", unlocode: "FIHEL" },
  ho_chi_minh: { lat: 10.7622, lng: 106.7211, name: "Port of Ho Chi Minh", unlocode: "VNSGN" },
  hong_kong: { lat: 22.3366, lng: 114.1266, name: "Port of Hong Kong", unlocode: "HKHKG" },
  huelva: { lat: 37.2288, lng: -6.9388, name: "Puerto de Huelva", unlocode: "ESHUV" },
  hyderabad: { lat: 17.4355, lng: 78.4722, name: "ICD Hyderabad", unlocode: "INHYD" },

  // ==========================================
  // I - L
  // ==========================================
  inchon: { lat: 37.4588, lng: 126.6022, name: "Port of Incheon", unlocode: "KRINC" },
  indianapolis: { lat: 39.7355, lng: -86.1688, name: "Indianapolis (Inland Port)", unlocode: "USIND" },
  indore: { lat: 22.7566, lng: 75.8711, name: "ICD Indore", unlocode: "INIDR" },
  iquique: { lat: -20.2305, lng: -70.1358, name: "Port of Iquique", unlocode: "CLIQQ" },
  iskenderun: { lat: 36.5911, lng: 36.1822, name: "Port of Iskenderun", unlocode: "TRISK" },
  itajai: { lat: -26.9066, lng: -48.6522, name: "Porto de Itajaí", unlocode: "BRITJ" },
  izmir: { lat: 38.4388, lng: 27.1522, name: "Port of Izmir", unlocode: "TRIZM" },
  jacksonville: { lat: 30.3666, lng: -81.5622, name: "Port of Jacksonville", unlocode: "USJAX" },
  jaipur: { lat: 26.9211, lng: 75.8022, name: "ICD Jaipur", unlocode: "INJAI" },
  jakarta: { lat: -6.1022, lng: 106.8822, name: "Port of Jakarta (Tanjung Priok)", unlocode: "IDJKT" },
  jiangmen: { lat: 22.6022, lng: 113.0844, name: "Port of Jiangmen", unlocode: "CNJMN" },
  jiangyin: { lat: 31.9166, lng: 120.2766, name: "Port of Jiangyin", unlocode: "CNJIA" },
  jiujiang: { lat: 29.7455, lng: 116.0211, name: "Port of Jiujiang", unlocode: "CNJIU" },
  jodhpur: { lat: 26.2488, lng: 73.0188, name: "ICD Jodhpur", unlocode: "INJDH" },
  johannesburg: { lat: -26.2266, lng: 28.1022, name: "Johannesburg City Deep (Inland)", unlocode: "ZAJNB" },
  pasir_gudang: { lat: 1.4366, lng: 103.9044, name: "Johor Port (Pasir Gudang)", unlocode: "MYPGU" },
  juelsminde: { lat: 55.7111, lng: 10.0166, name: "Port of Juelsminde", unlocode: "DKJUE" },
  kanpur: { lat: 26.4388, lng: 80.3344, name: "ICD Kanpur", unlocode: "INKAN" },
  kaohsiung: { lat: 22.5844, lng: 120.2922, name: "Port of Kaohsiung", unlocode: "TWKHH" },
  karachi: { lat: 24.8166, lng: 66.9822, name: "Port of Karachi", unlocode: "PKKHI" },
  keelung: { lat: 25.1388, lng: 121.7422, name: "Port of Keelung (Taipei)", unlocode: "TWKEL" },
  klaipeda: { lat: 55.6711, lng: 21.1444, name: "Port of Klaipeda", unlocode: "LTKLJ" },
  kobe: { lat: 34.6688, lng: 135.2122, name: "Port of Kobe", unlocode: "JPUKB" },
  koper: { lat: 45.5511, lng: 13.7444, name: "Port of Koper", unlocode: "SIKOP" },
  kuantan: { lat: 3.9788, lng: 103.4344, name: "Kuantan Port", unlocode: "MYKUA" },
  la_spezia: { lat: 44.1022, lng: 9.8322, name: "Port of La Spezia", unlocode: "ITSPE" },
  laem_chabang: { lat: 13.0766, lng: 100.8844, name: "Port of Laem Chabang", unlocode: "THLCH" },
  le_havre: { lat: 49.4822, lng: 0.1266, name: "Port of Le Havre", unlocode: "FRLEH" },
  leixoes: { lat: 41.1866, lng: -8.6944, name: "Porto de Leixoes", unlocode: "PTLEI" },
  lianhuashan: { lat: 22.9566, lng: 113.4866, name: "Port of Lianhuashan", unlocode: "CNLHS" },
  lianyungang: { lat: 34.7455, lng: 119.4622, name: "Port of Lianyungang", unlocode: "CNLYG" },
  linz: { lat: 48.3144, lng: 14.3022, name: "Port of Linz", unlocode: "ATLNZ" },
  lisbon: { lat: 38.7111, lng: -9.1122, name: "Port of Lisbon", unlocode: "PTLIS" },
  livorno: { lat: 43.5566, lng: 10.3022, name: "Port of Livorno (Leghorn)", unlocode: "ITLIV" },
  ludhiana: { lat: 30.9022, lng: 75.8566, name: "ICD Ludhiana", unlocode: "INLUH" },
  lyon: { lat: 45.7144, lng: 4.8322, name: "Port Edouard Herriot (Lyon)", unlocode: "FRLYS" },
  lyttelton: { lat: -43.6066, lng: 172.7166, name: "Port of Lyttelton", unlocode: "NZLYT" },
  
  // ==========================================
  // M - O
  // ==========================================
  ma_anshan: { lat: 31.7144, lng: 118.4922, name: "Port of Ma'anshan", unlocode: "CNMAS" },
  macao: { lat: 22.1888, lng: 113.5411, name: "Port of Macao", unlocode: "MOMFM" },
  madrid: { lat: 40.4022, lng: -3.5566, name: "Puerto Seco de Madrid (Coslada)", unlocode: "ESMAD" },
  malmo: { lat: 55.6188, lng: 13.0022, name: "Port of Malmo", unlocode: "SEMMA" },
  manchester: { lat: 53.4688, lng: -2.3166, name: "Manchester (Inland Port)", unlocode: "GBMNC" },
  manila: { lat: 14.5966, lng: 120.9522, name: "Port of Manila", unlocode: "PHMNL" },
  manzanillo_mx: { lat: 19.0688, lng: -104.2888, name: "Puerto de Manzanillo (México)", unlocode: "MXZLO" },
  manzanillo_pa: { lat: 9.3611, lng: -79.8822, name: "Manzanillo International Terminal (Panamá)", unlocode: "PAMIT" },
  marseille: { lat: 43.3288, lng: 5.3522, name: "Port of Marseille", unlocode: "FRMRS" },
  melbourne: { lat: -37.8222, lng: 144.9122, name: "Port of Melbourne", unlocode: "AUMEL" },
  mersin: { lat: 36.8022, lng: 34.6444, name: "Port of Mersin", unlocode: "TRMER" },
  mobile: { lat: 30.6755, lng: -88.0366, name: "Port of Mobile", unlocode: "USMOB" },
  montevideo: { lat: -34.8966, lng: -56.2166, name: "Puerto de Montevideo", unlocode: "UYMVD" },
  montreal: { lat: 45.5688, lng: -73.5122, name: "Port of Montreal", unlocode: "CAMTR" },
  moradabad: { lat: 28.8411, lng: 78.7888, name: "ICD Moradabad", unlocode: "INMBD" },
  mumbai: { lat: 18.9488, lng: 72.8444, name: "Mumbai Port Trust", unlocode: "INBOM" },
  nagoya: { lat: 35.0866, lng: 136.8822, name: "Port of Nagoya", unlocode: "JPNGO" },
  nanchang: { lat: 28.7188, lng: 115.8922, name: "Port of Nanchang", unlocode: "CNKHN" },
  nanhai: { lat: 23.0366, lng: 113.1611, name: "Port of Nanhai", unlocode: "CNNAI" },
  nanjing: { lat: 32.1244, lng: 118.7366, name: "Port of Nanjing", unlocode: "CNNJG" },
  nansha: { lat: 22.7588, lng: 113.6288, name: "Port of Nansha", unlocode: "CNNSA" },
  nantong: { lat: 31.9866, lng: 120.8411, name: "Port of Nantong", unlocode: "CNNTG" },
  naples: { lat: 40.8388, lng: 14.2666, name: "Port of Naples", unlocode: "ITNAP" },
  navegantes: { lat: -26.8688, lng: -48.6522, name: "Portonave (Navegantes)", unlocode: "BRNVT" },
  new_delhi: { lat: 28.5366, lng: 77.2722, name: "ICD Tughlakabad (New Delhi)", unlocode: "INDEL" },
  new_mangalore: { lat: 12.9288, lng: 74.8166, name: "New Mangalore Port", unlocode: "INNML" },
  new_orleans: { lat: 29.9366, lng: -90.0611, name: "Port of New Orleans", unlocode: "USMSY" },
  norfolk: { lat: 36.8888, lng: -76.3166, name: "Port of Norfolk", unlocode: "USORF" },
  oakland: { lat: 37.8044, lng: -122.3166, name: "Port of Oakland", unlocode: "USOAK" },
  odesa: { lat: 46.4988, lng: 30.7322, name: "Port of Odesa", unlocode: "UAODS" },
  oporto: { lat: 41.1866, lng: -8.6944, name: "Port of Oporto (Leixoes)", unlocode: "PTOPR" },
  osaka: { lat: 34.6411, lng: 135.4322, name: "Port of Osaka", unlocode: "JPOSA" },
  oslo: { lat: 59.9022, lng: 10.7366, name: "Port of Oslo", unlocode: "NOOSL" },

  // ==========================================
  // P - R
  // ==========================================
  paita: { lat: -5.0866, lng: -81.1122, name: "Puerto de Paita", unlocode: "PEPAI" },
  palembang: { lat: -2.9966, lng: 104.7666, name: "Port of Palembang", unlocode: "IDPLM" },
  balboa: { lat: 8.9511, lng: -79.5666, name: "Port of Balboa", unlocode: "PABLB" },
  panjang: { lat: -5.4666, lng: 105.3222, name: "Port of Panjang", unlocode: "IDPNJ" },
  paris: { lat: 48.9166, lng: 2.3022, name: "Port of Paris (Gennevilliers)", unlocode: "FRPAR" },
  pecem: { lat: -3.5411, lng: -38.8022, name: "Porto de Pecém", unlocode: "BRPEC" },
  penang: { lat: 5.3888, lng: 100.3722, name: "Port of Penang", unlocode: "MYPEN" },
  phnom_penh: { lat: 11.5866, lng: 104.9222, name: "Port of Phnom Penh", unlocode: "KHPNH" },
  pipavav: { lat: 20.9166, lng: 71.4666, name: "Port of Pipavav", unlocode: "INPAV" },
  piraeus: { lat: 37.9511, lng: 23.6166, name: "Port of Piraeus", unlocode: "GRPIR" },
  port_elizabeth: { lat: -33.9566, lng: 25.6322, name: "Port Elizabeth", unlocode: "ZAPLZ" },
  port_klang: { lat: 2.9988, lng: 101.3922, name: "Port Klang", unlocode: "MYPKG" },
  port_louis: { lat: -20.1511, lng: 57.4922, name: "Port Louis", unlocode: "MUPLU" },
  portland: { lat: 45.5866, lng: -122.7566, name: "Port of Portland", unlocode: "USPDX" },
  porto_alegre: { lat: -30.0166, lng: -51.1922, name: "Porto de Porto Alegre", unlocode: "BRPOA" },
  porto_itapoa: { lat: -26.1111, lng: -48.6166, name: "Porto Itapoá", unlocode: "BRIOA" },
  posorja: { lat: -2.7166, lng: -80.2444, name: "DP World Posorja", unlocode: "ECPBJ" },
  praga: { lat: 50.0466, lng: 14.6122, name: "Prague (Inland Port / Uhříněves)", unlocode: "CZPRG" },
  puerto_caldera: { lat: 9.9088, lng: -84.7166, name: "Puerto Caldera", unlocode: "CRCAL" },
  puerto_cortes: { lat: 15.8288, lng: -87.9444, name: "Puerto Cortés", unlocode: "HNPTZ" },
  puerto_chancay: { lat: -11.5844, lng: -77.2666, name: "Puerto de Chancay", unlocode: "PECHY" },
  callao: { lat: -12.0466, lng: -77.1422, name: "Puerto del Callao", unlocode: "PECLL" },
  puerto_quetzal: { lat: 13.9211, lng: -90.7922, name: "Puerto Quetzal", unlocode: "GTPRQ" },
  pune: { lat: 18.6166, lng: 73.7422, name: "ICD Pune", unlocode: "INPNQ" },
  qinhuangdao: { lat: 39.9166, lng: 119.6022, name: "Port of Qinhuangdao", unlocode: "CNQHD" },
  qinzhou: { lat: 21.7366, lng: 108.6022, name: "Port of Qinzhou", unlocode: "CNQZH" },
  qui_nhon: { lat: 13.7666, lng: 109.2322, name: "Port of Qui Nhon", unlocode: "VNUIH" },
  riga: { lat: 57.0088, lng: 24.0888, name: "Port of Riga", unlocode: "LVRIX" },
  rijeka: { lat: 45.3266, lng: 14.4222, name: "Port of Rijeka", unlocode: "HRRJK" },
  rio_de_janeiro: { lat: -22.8866, lng: -43.2122, name: "Porto do Rio de Janeiro", unlocode: "BRRIO" },
  rio_grande: { lat: -32.0666, lng: -52.0888, name: "Porto de Rio Grande", unlocode: "BRRIG" },
  rizhao: { lat: 35.3566, lng: 119.5322, name: "Port of Rizhao", unlocode: "CNRZH" },
  rongqi: { lat: 22.7566, lng: 113.2722, name: "Rongqi Port (Shunde)", unlocode: "CNROQ" },
  rotterdam: { lat: 51.9211, lng: 4.3022, name: "Port of Rotterdam", unlocode: "NLRTM" },

  // ==========================================
  // S - T
  // ==========================================
  saint_petersburg: { lat: 59.9011, lng: 30.2522, name: "Port of Saint Petersburg", unlocode: "RULED" },
  salerno: { lat: 40.6722, lng: 14.7466, name: "Port of Salerno", unlocode: "ITSAL" },
  salvador: { lat: -12.9611, lng: -38.5022, name: "Porto de Salvador", unlocode: "BRSSA" },
  salzburg: { lat: 47.8122, lng: 13.0166, name: "Salzburg (Inland Port)", unlocode: "ATSZG" },
  san_antonio: { lat: -33.5866, lng: -71.6144, name: "Puerto de San Antonio (Chile)", unlocode: "CLSAI" },
  san_francisco: { lat: 37.7511, lng: -122.3822, name: "Port of San Francisco", unlocode: "USSFO" },
  san_vicente: { lat: -33.0382, lng: -71.6262, name: "Port of San Vicente", unlocode: "CLVAP" },
  sanshan: { lat: 23.0122, lng: 113.2544, name: "Sanshan Port", unlocode: "CNSAN" },
  sanshui: { lat: 23.1666, lng: 112.8722, name: "Sanshui Port", unlocode: "CNSNI" },
  santo_domingo: { lat: 18.4711, lng: -69.8822, name: "Puerto de Santo Domingo", unlocode: "DOSDQ" },
  santos: { lat: -23.9511, lng: -46.3122, name: "Porto de Santos", unlocode: "BRSSZ" },
  seattle: { lat: 47.5866, lng: -122.3422, name: "Port of Seattle", unlocode: "USSEA" },
  sekondi: { lat: 4.9366, lng: -1.7122, name: "Port of Sekondi", unlocode: "GHTKD" },
  semarang: { lat: -6.9411, lng: 110.4222, name: "Port of Semarang", unlocode: "IDSRG" },
  sevilla: { lat: 37.3366, lng: -5.9922, name: "Puerto de Sevilla", unlocode: "ESSVQ" },
  shantou: { lat: 23.3511, lng: 116.7522, name: "Port of Shantou", unlocode: "CNSWA" },
  shaoxing: { lat: 30.1366, lng: 120.6122, name: "Port of Shaoxing", unlocode: "CNSXG" },
  shekou: { lat: 22.4788, lng: 113.9122, name: "Shekou Cruise Center / Port", unlocode: "CNSHK" },
  shidao: { lat: 36.8866, lng: 122.4422, name: "Port of Shidao", unlocode: "CNSDO" },
  shunde: { lat: 22.8211, lng: 113.2722, name: "Port of Shunde", unlocode: "CNSUD" },
  sihanoukville: { lat: 10.6388, lng: 103.5222, name: "Sihanoukville Autonomous Port", unlocode: "KHKOS" },
  singapore: { lat: 1.2611, lng: 103.8022, name: "Port of Singapore", unlocode: "SGSIN" },
  sofia: { lat: 42.7311, lng: 23.3622, name: "Sofia (Inland Port)", unlocode: "BGSOF" },
  songkhla: { lat: 7.2211, lng: 100.5922, name: "Port of Songkhla", unlocode: "THSGZ" },
  subic_bay: { lat: 14.8166, lng: 120.2822, name: "Port of Subic Bay", unlocode: "PHSBU" },
  surabaya: { lat: -7.2011, lng: 112.7222, name: "Port of Surabaya", unlocode: "IDSUB" },
  sydney: { lat: -33.9511, lng: 151.2166, name: "Port Botany (Sydney)", unlocode: "AUSYD" },
  taicang: { lat: 31.6211, lng: 121.2822, name: "Port of Taicang", unlocode: "CNTCG" },
  taichung: { lat: 24.2666, lng: 120.5122, name: "Port of Taichung", unlocode: "TWTXG" },
  taishan: { lat: 22.2511, lng: 112.8022, name: "Port of Taishan", unlocode: "CNTAI" },
  takoradi: { lat: 4.8866, lng: -1.7422, name: "Port of Takoradi", unlocode: "GHTKD" },
  tallinn: { lat: 59.4411, lng: 24.7722, name: "Port of Tallinn", unlocode: "EETLL" },
  tanjung_pelepas: { lat: 1.3611, lng: 103.5422, name: "Port of Tanjung Pelepas", unlocode: "MYTPP" },
  tauranga: { lat: -37.6411, lng: 176.1722, name: "Port of Tauranga", unlocode: "NZTRG" },
  tekirdag: { lat: 40.9711, lng: 27.5122, name: "Port of Tekirdağ", unlocode: "TRTEK" },
  tema: { lat: 5.6266, lng: -0.0122, name: "Port of Tema", unlocode: "GHTEM" },
  tenerife: { lat: 28.4811, lng: -16.2422, name: "Puerto de Santa Cruz de Tenerife", unlocode: "ESSCT" },
  thessaloniki: { lat: 40.6366, lng: 22.9222, name: "Port of Thessaloniki", unlocode: "GRSKG" },
  tokyo: { lat: 35.6111, lng: 139.7822, name: "Port of Tokyo", unlocode: "JPTYO" },
  tongling: { lat: 30.9311, lng: 117.7722, name: "Port of Tongling", unlocode: "CNTOL" },
  toronto: { lat: 43.6411, lng: -79.3522, name: "Port of Toronto", unlocode: "CATOR" },
  trieste: { lat: 45.6366, lng: 13.7722, name: "Port of Trieste", unlocode: "ITTRS" },

  // ==========================================
  // V - Z
  // ==========================================
  vado_ligure: { lat: 44.2711, lng: 8.4422, name: "Vado Gateway", unlocode: "ITVDL" },
  valparaiso: { lat: -33.0382, lng: -71.6262, name: "Port of Valparaiso", unlocode: "CLVAP" },
  vancouver: { lat: 49.2866, lng: -123.0922, name: "Port of Vancouver", unlocode: "CAVAN" },
  varna: { lat: 43.1911, lng: 27.9122, name: "Port of Varna", unlocode: "BGVAR" },
  venezia: { lat: 45.4511, lng: 12.2622, name: "Port of Venice", unlocode: "ITVCE" },
  vienna: { lat: 48.1811, lng: 16.4822, name: "Port of Vienna", unlocode: "ATVIE" },
  vigo: { lat: 42.2366, lng: -8.7422, name: "Puerto de Vigo", unlocode: "ESVGO" },
  vishakhapatnam: { lat: 17.6911, lng: 83.2822, name: "Visakhapatnam Port", unlocode: "INVTZ" },
  vung_tau: { lat: 10.3711, lng: 107.0822, name: "Port of Vung Tau", unlocode: "VNVTU" },
  warsaw: { lat: 52.2011, lng: 21.0522, name: "Warsaw (Inland Terminal)", unlocode: "PLWAW" },
  weifang: { lat: 37.2311, lng: 119.2222, name: "Port of Weifang", unlocode: "CNWEI" },
  weihai: { lat: 37.5011, lng: 122.1722, name: "Port of Weihai", unlocode: "CNWEI" },
  wellington: { lat: -41.2866, lng: 174.7922, name: "Port of Wellington", unlocode: "NZWLG" },
  wenzhou: { lat: 27.9711, lng: 120.8522, name: "Port of Wenzhou", unlocode: "CNWNZ" },
  wuhu: { lat: 31.4211, lng: 118.3622, name: "Port of Wuhu", unlocode: "CNWHU" },
  wuhan: { lat: 30.6366, lng: 114.4122, name: "Port of Wuhan", unlocode: "CNWUH" },
  wuzhou: { lat: 23.4711, lng: 111.2722, name: "Port of Wuzhou", unlocode: "CNWUZ" },
  xiaolan: { lat: 22.6611, lng: 113.2522, name: "Xiaolan Port", unlocode: "CNXLN" },
  xingang: { lat: 38.9811, lng: 117.7422, name: "Port of Xingang (Tianjin)", unlocode: "CNTXG" },
  yangon: { lat: 16.7766, lng: 96.1622, name: "Port of Yangon", unlocode: "MMRGN" },
  yangpu: { lat: 19.7411, lng: 109.1822, name: "Port of Yangpu", unlocode: "CNYAN" },
  yangzhou: { lat: 32.2511, lng: 119.4222, name: "Port of Yangzhou", unlocode: "CNYZH" },
  yantai: { lat: 37.5811, lng: 121.3922, name: "Port of Yantai", unlocode: "CNYNT" },
  yantian: { lat: 22.5811, lng: 114.2822, name: "Yantian International Container Terminals", unlocode: "CNYTN" },
  yichang: { lat: 30.6866, lng: 111.2822, name: "Port of Yichang", unlocode: "CNYIC" },
  yiwu: { lat: 29.3111, lng: 120.0822, name: "Yiwu (Inland Port)", unlocode: "CNYIW" },
  yokohama: { lat: 35.4511, lng: 139.6722, name: "Port of Yokohama", unlocode: "JPYOK" },
  yunfu: { lat: 23.0611, lng: 112.0422, name: "Port of Yunfu", unlocode: "CNYNF" },
  zhangjiagang: { lat: 31.9811, lng: 120.4222, name: "Port of Zhangjiagang", unlocode: "CNZJG" },
  zhanjiang: { lat: 21.2211, lng: 110.4022, name: "Port of Zhanjiang", unlocode: "CNZHA" },
  zhaoqing: { lat: 23.0311, lng: 112.4722, name: "Port of Zhaoqing", unlocode: "CNZHQ" },
  zhenjiang: { lat: 32.2211, lng: 119.4722, name: "Port of Zhenjiang", unlocode: "CNZHE" },
  zhongshan: { lat: 22.5866, lng: 113.4822, name: "Port of Zhongshan", unlocode: "CNZSN" },
  zhuhai: { lat: 22.2511, lng: 113.5822, name: "Port of Zhuhai", unlocode: "CNZUH" },
  zurich: { lat: 47.4111, lng: 8.5222, name: "Zurich (Inland Port)", unlocode: "CHZRH" },
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Busca las coordenadas del puerto por el nombre normalizado del POL.
 * Intenta coincidencia exacta primero, luego parcial.
 */
export function getPortByPOL(polNormalized: string): PortCoords | null {
  if (!polNormalized) return null;

  const key = normalizeText(polNormalized);

  // Coincidencia exacta
  if (portCoordinates[key]) {
    return portCoordinates[key];
  }

  // Coincidencia parcial: si el POL contiene el nombre del puerto o viceversa
  for (const [portKey, coords] of Object.entries(portCoordinates)) {
    const normalizedPortKey = normalizeText(portKey);
    if (
      key.includes(normalizedPortKey) ||
      normalizedPortKey.includes(key)
    ) {
      return coords;
    }
  }

  return null;
}

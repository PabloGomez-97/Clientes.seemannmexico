// Dummy invoice data for MundoGaming demo account
// 8 invoices: paid, pending, overdue - Air & Ocean - multiple months

export interface DummyInvoice {
  id?: number;
  number?: string;
  type?: number;
  date?: string;
  dueDate?: string;
  status?: number;
  billTo?: {
    name?: string;
    identificationNumber?: string;
  };
  billToAddress?: string;
  currency?: {
    abbr?: string;
    name?: string;
  };
  amount?: {
    value?: number;
    userString?: string;
  };
  taxAmount?: {
    value?: number;
    userString?: string;
  };
  totalAmount?: {
    value?: number;
    userString?: string;
  };
  balanceDue?: {
    value?: number;
    userString?: string;
  };
  charges?: Array<{
    description?: string;
    quantity?: number;
    unit?: string;
    rate?: number;
    amount?: number;
  }>;
  shipment?: {
    number?: string;
    waybillNumber?: string;
    consignee?: {
      name?: string;
    };
    departure?: string;
    arrival?: string;
    customerReference?: string;
  };
  paymentTerm?: {
    name?: string;
  };
  notes?: string;
  [key: string]: any;
}

export const MUNDOGAMING_DUMMY_INVOICES: DummyInvoice[] = [
  //  1. PAID - Air - Oct 2025 
  {
    id: 990001,
    number: "INV-990001",
    type: 1,
    date: "2025-10-05T00:00:00",
    dueDate: "2025-11-04T00:00:00",
    status: 2,
    billTo: {
      name: "MUNDOGAMING SPA",
      identificationNumber: "77.123.456-7",
    },
    billToAddress: "Av. Providencia 1234, Oficina 501, Santiago, Chile",
    currency: { abbr: "CLP", name: "Chilean Peso" },
    amount: { value: 3200000, userString: "3,200,000" },
    taxAmount: { value: 608000, userString: "608,000" },
    totalAmount: { value: 3808000, userString: "3,808,000" },
    balanceDue: { value: 0, userString: "0" },
    charges: [
      { description: "AIR FREIGHT", quantity: 1, unit: "SHIPMENT", rate: 1850000, amount: 1850000 },
      { description: "HANDLING FEE", quantity: 1, unit: "SHIPMENT", rate: 450000, amount: 450000 },
      { description: "CUSTOMS CLEARANCE", quantity: 1, unit: "SHIPMENT", rate: 550000, amount: 550000 },
      { description: "DOCUMENTATION FEE", quantity: 1, unit: "SHIPMENT", rate: 350000, amount: 350000 },
    ],
    shipment: {
      number: "SOG0008100",
      waybillNumber: "957-11223344",
      consignee: { name: "MUNDOGAMING SPA" },
      departure: "Shenzhen, China",
      arrival: "Santiago, Chile",
      customerReference: "MG-AIR-2025-001",
    },
    paymentTerm: { name: "Net 30" },
    notes: "008100@https://s3.us-east-1.amazonaws.com/mundogaming-docs/invoice-008100.pdf",
  },

  //  2. PAID - Ocean FCL - Nov 2025 
  {
    id: 990002,
    number: "INV-990002",
    type: 1,
    date: "2025-11-12T00:00:00",
    dueDate: "2025-12-12T00:00:00",
    status: 2,
    billTo: {
      name: "MUNDOGAMING SPA",
      identificationNumber: "77.123.456-7",
    },
    billToAddress: "Av. Providencia 1234, Oficina 501, Santiago, Chile",
    currency: { abbr: "CLP", name: "Chilean Peso" },
    amount: { value: 5400000, userString: "5,400,000" },
    taxAmount: { value: 1026000, userString: "1,026,000" },
    totalAmount: { value: 6426000, userString: "6,426,000" },
    balanceDue: { value: 0, userString: "0" },
    charges: [
      { description: "OCEAN FREIGHT", quantity: 1, unit: "CONTAINER", rate: 3200000, amount: 3200000 },
      { description: "THC ORIGIN", quantity: 1, unit: "CONTAINER", rate: 350000, amount: 350000 },
      { description: "THC DESTINATION", quantity: 1, unit: "CONTAINER", rate: 420000, amount: 420000 },
      { description: "CUSTOMS CLEARANCE", quantity: 1, unit: "SHIPMENT", rate: 680000, amount: 680000 },
      { description: "INLAND TRANSPORT", quantity: 1, unit: "SHIPMENT", rate: 450000, amount: 450000 },
      { description: "DOCUMENTATION FEE", quantity: 1, unit: "SHIPMENT", rate: 300000, amount: 300000 },
    ],
    shipment: {
      number: "HBLI0005320",
      waybillNumber: "COSU6234567890",
      consignee: { name: "MUNDOGAMING SPA" },
      departure: "Shanghai, China",
      arrival: "San Antonio, Chile",
      customerReference: "MG-FCL-2025-001",
    },
    paymentTerm: { name: "Net 60" },
    notes: "005320@https://s3.us-east-1.amazonaws.com/mundogaming-docs/invoice-005320.pdf",
  },

  //  3. PAID - Air - Dec 2025 
  {
    id: 990003,
    number: "INV-990003",
    type: 1,
    date: "2025-12-03T00:00:00",
    dueDate: "2026-01-02T00:00:00",
    status: 2,
    billTo: {
      name: "MUNDOGAMING SPA",
      identificationNumber: "77.123.456-7",
    },
    billToAddress: "Av. Providencia 1234, Oficina 501, Santiago, Chile",
    currency: { abbr: "CLP", name: "Chilean Peso" },
    amount: { value: 2100000, userString: "2,100,000" },
    taxAmount: { value: 399000, userString: "399,000" },
    totalAmount: { value: 2499000, userString: "2,499,000" },
    balanceDue: { value: 0, userString: "0" },
    charges: [
      { description: "AIR FREIGHT", quantity: 1, unit: "SHIPMENT", rate: 1200000, amount: 1200000 },
      { description: "HANDLING FEE", quantity: 1, unit: "SHIPMENT", rate: 320000, amount: 320000 },
      { description: "INSURANCE", quantity: 1, unit: "SHIPMENT", rate: 280000, amount: 280000 },
      { description: "CUSTOMS CLEARANCE", quantity: 1, unit: "SHIPMENT", rate: 300000, amount: 300000 },
    ],
    shipment: {
      number: "SOG0008289",
      waybillNumber: "957-54329876",
      consignee: { name: "MUNDOGAMING SPA" },
      departure: "Tokyo, Japan",
      arrival: "Santiago, Chile",
      customerReference: "MG-AIR-2025-002",
    },
    paymentTerm: { name: "Net 30" },
    notes: "008289@https://s3.us-east-1.amazonaws.com/mundogaming-docs/invoice-008289.pdf",
  },

  //  4. PENDING - Ocean - Jan 2026 
  {
    id: 990004,
    number: "INV-990004",
    type: 1,
    date: "2026-01-15T00:00:00",
    dueDate: "2027-03-16T00:00:00",
    status: 1,
    billTo: {
      name: "MUNDOGAMING SPA",
      identificationNumber: "77.123.456-7",
    },
    billToAddress: "Av. Providencia 1234, Oficina 501, Santiago, Chile",
    currency: { abbr: "CLP", name: "Chilean Peso" },
    amount: { value: 7800000, userString: "7,800,000" },
    taxAmount: { value: 1482000, userString: "1,482,000" },
    totalAmount: { value: 9282000, userString: "9,282,000" },
    balanceDue: { value: 9282000, userString: "9,282,000" },
    charges: [
      { description: "OCEAN FREIGHT", quantity: 2, unit: "CONTAINER", rate: 2800000, amount: 5600000 },
      { description: "THC ORIGIN", quantity: 2, unit: "CONTAINER", rate: 180000, amount: 360000 },
      { description: "THC DESTINATION", quantity: 2, unit: "CONTAINER", rate: 210000, amount: 420000 },
      { description: "CUSTOMS CLEARANCE", quantity: 1, unit: "SHIPMENT", rate: 720000, amount: 720000 },
      { description: "INLAND TRANSPORT", quantity: 1, unit: "SHIPMENT", rate: 400000, amount: 400000 },
      { description: "DOCUMENTATION FEE", quantity: 1, unit: "SHIPMENT", rate: 300000, amount: 300000 },
    ],
    shipment: {
      number: "HBLI0005501",
      waybillNumber: "MAEU1234567",
      consignee: { name: "MUNDOGAMING SPA" },
      departure: "Ningbo, China",
      arrival: "San Antonio, Chile",
      customerReference: "MG-FCL-2026-001",
    },
    paymentTerm: { name: "Net 60" },
    notes: "005501@https://s3.us-east-1.amazonaws.com/mundogaming-docs/invoice-005501.pdf",
  },

  //  5. PENDING - Air - Feb 2026 
  {
    id: 990005,
    number: "INV-990005",
    type: 1,
    date: "2026-02-10T00:00:00",
    dueDate: "2027-03-12T00:00:00",
    status: 1,
    billTo: {
      name: "MUNDOGAMING SPA",
      identificationNumber: "77.123.456-7",
    },
    billToAddress: "Av. Providencia 1234, Oficina 501, Santiago, Chile",
    currency: { abbr: "CLP", name: "Chilean Peso" },
    amount: { value: 4500000, userString: "4,500,000" },
    taxAmount: { value: 855000, userString: "855,000" },
    totalAmount: { value: 5355000, userString: "5,355,000" },
    balanceDue: { value: 5355000, userString: "5,355,000" },
    charges: [
      { description: "AIR FREIGHT", quantity: 1, unit: "SHIPMENT", rate: 2800000, amount: 2800000 },
      { description: "HANDLING FEE", quantity: 1, unit: "SHIPMENT", rate: 520000, amount: 520000 },
      { description: "INSURANCE", quantity: 1, unit: "SHIPMENT", rate: 480000, amount: 480000 },
      { description: "CUSTOMS CLEARANCE", quantity: 1, unit: "SHIPMENT", rate: 400000, amount: 400000 },
      { description: "DOCUMENTATION FEE", quantity: 1, unit: "SHIPMENT", rate: 300000, amount: 300000 },
    ],
    shipment: {
      number: "SOG0009105",
      waybillNumber: "180-99887766",
      consignee: { name: "MUNDOGAMING SPA" },
      departure: "Los Angeles, USA",
      arrival: "Santiago, Chile",
      customerReference: "MG-AIR-2026-001",
    },
    paymentTerm: { name: "Net 30" },
    notes: "009105@https://s3.us-east-1.amazonaws.com/mundogaming-docs/invoice-009105.pdf",
  },

  //  6. OVERDUE - Air - Sep 2025 
  {
    id: 990006,
    number: "INV-990006",
    type: 1,
    date: "2025-09-01T00:00:00",
    dueDate: "2025-10-01T00:00:00",
    status: 4,
    billTo: {
      name: "MUNDOGAMING SPA",
      identificationNumber: "77.123.456-7",
    },
    billToAddress: "Av. Providencia 1234, Oficina 501, Santiago, Chile",
    currency: { abbr: "CLP", name: "Chilean Peso" },
    amount: { value: 1800000, userString: "1,800,000" },
    taxAmount: { value: 342000, userString: "342,000" },
    totalAmount: { value: 2142000, userString: "2,142,000" },
    balanceDue: { value: 2142000, userString: "2,142,000" },
    charges: [
      { description: "AIR FREIGHT", quantity: 1, unit: "SHIPMENT", rate: 980000, amount: 980000 },
      { description: "HANDLING FEE", quantity: 1, unit: "SHIPMENT", rate: 280000, amount: 280000 },
      { description: "CUSTOMS CLEARANCE", quantity: 1, unit: "SHIPMENT", rate: 320000, amount: 320000 },
      { description: "STORAGE", quantity: 5, unit: "DAYS", rate: 44000, amount: 220000 },
    ],
    shipment: {
      number: "SOG0007890",
      waybillNumber: "235-44556677",
      consignee: { name: "MUNDOGAMING SPA" },
      departure: "Taipei, Taiwan",
      arrival: "Santiago, Chile",
      customerReference: "MG-AIR-2025-003",
    },
    paymentTerm: { name: "Net 30" },
    notes: "007890@https://s3.us-east-1.amazonaws.com/mundogaming-docs/invoice-007890.pdf",
  },

  //  7. PAID - Ocean - Aug 2025 
  {
    id: 990007,
    number: "INV-990007",
    type: 1,
    date: "2025-08-20T00:00:00",
    dueDate: "2025-10-19T00:00:00",
    status: 2,
    billTo: {
      name: "MUNDOGAMING SPA",
      identificationNumber: "77.123.456-7",
    },
    billToAddress: "Av. Providencia 1234, Oficina 501, Santiago, Chile",
    currency: { abbr: "CLP", name: "Chilean Peso" },
    amount: { value: 4100000, userString: "4,100,000" },
    taxAmount: { value: 779000, userString: "779,000" },
    totalAmount: { value: 4879000, userString: "4,879,000" },
    balanceDue: { value: 0, userString: "0" },
    charges: [
      { description: "OCEAN FREIGHT", quantity: 1, unit: "CONTAINER", rate: 2500000, amount: 2500000 },
      { description: "THC ORIGIN", quantity: 1, unit: "CONTAINER", rate: 200000, amount: 200000 },
      { description: "THC DESTINATION", quantity: 1, unit: "CONTAINER", rate: 250000, amount: 250000 },
      { description: "CUSTOMS CLEARANCE", quantity: 1, unit: "SHIPMENT", rate: 550000, amount: 550000 },
      { description: "INLAND TRANSPORT", quantity: 1, unit: "SHIPMENT", rate: 350000, amount: 350000 },
      { description: "DOCUMENTATION FEE", quantity: 1, unit: "SHIPMENT", rate: 250000, amount: 250000 },
    ],
    shipment: {
      number: "HBLI0005100",
      waybillNumber: "HLCU8765432",
      consignee: { name: "MUNDOGAMING SPA" },
      departure: "Busan, South Korea",
      arrival: "San Antonio, Chile",
      customerReference: "MG-FCL-2025-002",
    },
    paymentTerm: { name: "Net 60" },
    notes: "005100@https://s3.us-east-1.amazonaws.com/mundogaming-docs/invoice-005100.pdf",
  },

  //  8. PENDING - Air - Mar 2026 
  {
    id: 990008,
    number: "INV-990008",
    type: 1,
    date: "2026-03-01T00:00:00",
    dueDate: "2027-03-31T00:00:00",
    status: 1,
    billTo: {
      name: "MUNDOGAMING SPA",
      identificationNumber: "77.123.456-7",
    },
    billToAddress: "Av. Providencia 1234, Oficina 501, Santiago, Chile",
    currency: { abbr: "CLP", name: "Chilean Peso" },
    amount: { value: 3600000, userString: "3,600,000" },
    taxAmount: { value: 684000, userString: "684,000" },
    totalAmount: { value: 4284000, userString: "4,284,000" },
    balanceDue: { value: 4284000, userString: "4,284,000" },
    charges: [
      { description: "AIR FREIGHT", quantity: 1, unit: "SHIPMENT", rate: 2200000, amount: 2200000 },
      { description: "HANDLING FEE", quantity: 1, unit: "SHIPMENT", rate: 380000, amount: 380000 },
      { description: "INSURANCE", quantity: 1, unit: "SHIPMENT", rate: 420000, amount: 420000 },
      { description: "CUSTOMS CLEARANCE", quantity: 1, unit: "SHIPMENT", rate: 350000, amount: 350000 },
      { description: "DOCUMENTATION FEE", quantity: 1, unit: "SHIPMENT", rate: 250000, amount: 250000 },
    ],
    shipment: {
      number: "SOG0009210",
      waybillNumber: "618-33221100",
      consignee: { name: "MUNDOGAMING SPA" },
      departure: "Hong Kong, China",
      arrival: "Santiago, Chile",
      customerReference: "MG-AIR-2026-002",
    },
    paymentTerm: { name: "Net 30" },
    notes: "009210@https://s3.us-east-1.amazonaws.com/mundogaming-docs/invoice-009210.pdf",
  },
];
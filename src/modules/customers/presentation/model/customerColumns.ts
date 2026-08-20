export interface CustomerColumnMetadata {
  key: string;
  defaultVisible: boolean;
  minWidth: number;
}

export const CUSTOMER_COLUMNS_METADATA: CustomerColumnMetadata[] = [
  { key: "code", defaultVisible: true, minWidth: 118 },
  { key: "customer", defaultVisible: true, minWidth: 260 },
  { key: "primaryContact", defaultVisible: true, minWidth: 210 },
  { key: "phone", defaultVisible: true, minWidth: 150 },
  { key: "email", defaultVisible: false, minWidth: 220 },
  { key: "status", defaultVisible: true, minWidth: 142 },
  { key: "health", defaultVisible: true, minWidth: 132 },
  { key: "type", defaultVisible: false, minWidth: 100 },
  { key: "segment", defaultVisible: false, minWidth: 150 },
  { key: "owner", defaultVisible: false, minWidth: 180 },
  { key: "revenue", defaultVisible: true, minWidth: 150 },
  { key: "orders", defaultVisible: true, minWidth: 110 },
  { key: "openDeals", defaultVisible: false, minWidth: 120 },
  { key: "openWork", defaultVisible: true, minWidth: 115 },
  { key: "openSupport", defaultVisible: true, minWidth: 125 },
  { key: "lastPurchase", defaultVisible: true, minWidth: 145 },
  { key: "nextCare", defaultVisible: false, minWidth: 145 },
];

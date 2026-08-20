export interface CustomerConversionReconciliationResult {
  createdCustomerIds: string[];
  linkedDeals: number;
  linkedQuotes: number;
  linkedOrders: number;
  linkedSupportCases: number;
  linkedTasks: number;
  linkedActivities: number;
}

export interface CustomerConversionPort {
  reconcile(now?: string): CustomerConversionReconciliationResult;
  start(): () => void;
}

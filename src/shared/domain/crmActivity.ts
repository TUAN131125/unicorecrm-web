export interface CRMActivity {
  id: string;
  icon?: string;
  title: string;
  description?: string;
  createdAt: string;
  author?: string;
  type: string;
  isInternal?: boolean;
  entityId?: string;
  entityType?: string;
}

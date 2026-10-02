export type BroadcastAudience = 'all' | 'sellers' | 'buyers';
export type BroadcastChannel = 'sms' | 'email';
export type BroadcastStatus = 'QUEUED' | 'SENDING' | 'DONE' | 'FAILED';

export interface NotificationTemplate {
  key: string;
  name: string;
  description: string;
  /** `{nomi}` → tavsif */
  variables: Record<string, string>;
  title: string;
  body: string;
  customized: boolean;
  defaultTitle: string;
  defaultBody: string;
  updatedAt: string | null;
}

export interface BroadcastMessage {
  audience: BroadcastAudience;
  channels: BroadcastChannel[];
  title: string;
  body: string;
}

export interface BroadcastPreview extends BroadcastMessage {
  recipientsCount: number;
  previewToken: string;
}

export interface Broadcast extends BroadcastMessage {
  id: string;
  recipientsCount: number;
  sentCount: number;
  status: BroadcastStatus;
  createdAt: string;
  finishedAt: string | null;
  lastError: string | null;
  idempotent: boolean;
}

export interface BroadcastsPage {
  items: Broadcast[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

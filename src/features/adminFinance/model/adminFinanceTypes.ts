export type PayoutStatus = 'PENDING' | 'APPROVED' | 'HELD' | 'PAID';
export type PayoutAction = 'approve' | 'hold' | 'release';
export interface PayoutListParams { shopId?: string; status?: PayoutStatus; page: number; limit: number }
export interface ReportParams { shopId?: string; dateFrom?: string; dateTo?: string }
export interface AdminPayout { id: string; shopId: string; shopName: string; amount: number; status: PayoutStatus; createdAt: string }
export interface AdminPayoutsPage { items: AdminPayout[]; total: number; page: number; limit: number; totalPages: number }

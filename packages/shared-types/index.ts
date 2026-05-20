export interface ClientSummary {
  id: number;
  display_name: string;
  initials: string;
  is_married: boolean;
  monthly_inflow: number;
  monthly_outflow: number;
  account_count: number;
  last_report_date: string | null;
  last_report_quarter: string | null;
}

export interface ClientC1 {
  first: string;
  last: string;
  dob: string;
  ssn_last4: string;
}

export interface ClientC2 {
  first: string;
  last: string;
  dob: string;
  ssn_last4: string;
}

export interface Account {
  id: number;
  owner: 'c1' | 'c2' | 'joint';
  account_type: string;
  account_category: 'retirement' | 'non_retirement' | 'trust' | 'cash';
  account_number_last4: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface Liability {
  id: number;
  liability_type: string;
  interest_rate: string;
  sort_order: number;
}

export interface ClientDetail extends ClientSummary {
  c1: ClientC1;
  c2: ClientC2 | null;
  reserve_target_months: number;
  accounts: Account[];
  liabilities: Liability[];
}

export interface BalanceEntry {
  id?: number;
  report_session_id?: number;
  account_id?: number;
  liability_id?: number;
  field_key: string;
  balance: number;
  last_known_balance?: number;
}

export interface Calculations {
  monthly_inflow: number;
  monthly_outflow: number;
  monthly_excess: number;
  private_reserve_balance: number;
  private_reserve_target: number;
  schwab_balance: number;
  c1_retirement_total: number;
  c2_retirement_total: number;
  non_retirement_total: number;
  trust_value: number;
  grand_total_net_worth: number;
  liabilities_total: number;
}

export interface ReportSession {
  id: number;
  client_id: number;
  quarter: string;
  report_date: string;
  created_at: string;
  has_sacs_pdf: boolean;
  has_tcc_pdf: boolean;
  balance_entries?: BalanceEntry[];
}

export interface CreateClientInput {
  c1_first: string;
  c1_last: string;
  c1_dob: string;
  c1_ssn_last4: string;
  c2_first?: string;
  c2_last?: string;
  c2_dob?: string;
  c2_ssn_last4?: string;
  monthly_inflow: number;
  monthly_outflow: number;
  reserve_target_months?: number;
}

export interface CreateSessionInput {
  quarter: string;
  report_date: string;
}

export interface ReportHistorySummary {
  id: number;
  client_id: number;
  client_name: string;
  quarter: string;
  report_date: string;
  created_at: string;
  has_sacs_pdf: boolean;
  has_tcc_pdf: boolean;
}

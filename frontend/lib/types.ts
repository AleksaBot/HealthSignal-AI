export type ApiErrorResponse = {
  detail?: string;
};

export type AuthSignupRequest = {
  first_name: string;
  email: string;
  password: string;
};

export type UserRead = {
  id: number;
  first_name: string;
  email: string;
  created_at: string;
};

export type AuthLoginRequest = {
  email: string;
  password: string;
};

export type AuthTokenResponse = {
  access_token: string;
  token_type: string;
};

export type AnalysisResponse = {
  extracted_signals: string[];
  red_flags: string[];
  likely_categories: string[];
  risk_insights: Record<string, string>;
  reasoning: string;
  disclaimer: string;
};

export type NoteFileAnalysisResponse = AnalysisResponse & {
  extracted_text: string;
  file_parse_method?: string;
};

export type SymptomAnalyzeRequest = {
  symptoms: string;
};

export type NoteInterpretRequest = {
  note_text: string;
};

export type RiskInsightRequest = {
  age: number;
  systolic_bp: number;
  diastolic_bp: number;
  fasting_glucose: number;
  hba1c: number;
  ldl_cholesterol: number;
};

export type ReportRead = {
  id: number;
  user_id: number;
  report_type: string;
  input_payload: string;
  output_summary: string;
  created_at: string;
};

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

export type SymptomRiskLevel = "low" | "moderate" | "high" | "emergency";

export type FollowUpQuestion = {
  prompt_text: string;
  question_category: string;
  priority: number;
  symptom_focus: string | null;
};

export type SymptomIntakeAnswer = {
  prompt_text: string;
  answer_text: string;
  question_category?: string | null;
};

export type ExtractedSymptomIntelligence = {
  primary_symptoms: string[];
  duration: string | null;
  severity: string | null;
  location_body_area: string | null;
  associated_symptoms: string[];
  red_flags: string[];
};

export type SymptomIntakeSession = {
  input: {
    symptom_text: string;
  };
  extracted: ExtractedSymptomIntelligence;
  risk_assessment: {
    risk_level: SymptomRiskLevel;
    rationale: string[];
  };
  categories: string[];
  follow_up_questions: FollowUpQuestion[];
  asked_questions: string[];
  answers: SymptomIntakeAnswer[];
  current_depth: number;
  max_depth: number;
  is_complete: boolean;
  completion_reason: string | null;
};

export type SymptomAnswerPlan = {
  categories: string[];
  triage_recommendation: string;
  summary_points: string[];
  follow_up_questions: FollowUpQuestion[];
};

export type SymptomIntakeInitialResponse = {
  session: SymptomIntakeSession;
  answer_plan: SymptomAnswerPlan;
};

export type SymptomIntakeUpdateRequest = {
  session: SymptomIntakeSession;
  new_answers: SymptomIntakeAnswer[];
};

export type TreatmentMention = {
  item: string;
  explanation: string;
};

export type MedicalTermExplanation = {
  term: string;
  plain_english: string;
};

export type NoteInterpretationResponse = {
  plain_english_summary: string;
  medicines_treatments: TreatmentMention[];
  medical_terms_explained: MedicalTermExplanation[];
  next_steps: string[];
  follow_up_questions: string[];
  disclaimer: string;
};

export type NoteFileAnalysisResponse = NoteInterpretationResponse & {
  extracted_text: string;
  file_parse_method?: string;
};

export type SymptomAnalyzeRequest = {
  symptoms: string;
};

export type NoteInterpretRequest = {
  note_text: string;
};

export type NoteFollowUpRequest = {
  original_note_text: string;
  interpreted_note: string;
  question: string;
};

export type NoteFollowUpResponse = {
  answer: string;
  disclaimer: string;
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

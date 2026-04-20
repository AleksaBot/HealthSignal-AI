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
  email_verified: boolean;
  created_at: string;
};

export type AuthLoginRequest = {
  email: string;
  password: string;
};

export type UpdateNameRequest = {
  first_name: string;
};

export type UpdateEmailRequest = {
  new_email: string;
  current_password: string;
};

export type UpdatePasswordRequest = {
  current_password: string;
  new_password: string;
};

export type ForgotPasswordRequest = {
  email: string;
};

export type ForgotPasswordResponse = {
  message: string;
  dev_reset_link?: string | null;
};

export type ResetPasswordConfirmRequest = {
  token: string;
  new_password: string;
};

export type AuthActionResponse = {
  message: string;
  dev_verification_link?: string | null;
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

export type UserTier = "free" | "premium";

export type HealthProfile = {
  age: number | null;
  sex: "female" | "male" | "non_binary" | "other" | "prefer_not_to_say" | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: "low" | "moderate" | "active" | "very_active" | null;
  smoking_vaping_status: "none" | "former" | "occasional" | "daily" | null;
  alcohol_frequency: "never" | "monthly" | "weekly" | "several_times_weekly" | "daily" | null;
  sleep_average_hours: number | null;
  stress_level: "low" | "moderate" | "high" | "very_high" | null;
  known_conditions: string[];
  current_medications: string[];
  medications: MedicationEntry[];
  family_history: string[];
  systolic_bp: number | null;
  diastolic_bp: number | null;
  total_cholesterol: number | null;
  medication_reminders_enabled: boolean;
  medication_reminder_time: string | null;
  weekly_health_summary_enabled: boolean;
  updated_at?: string | null;
  todays_medication_status?: TodayMedicationStatus[];
  recent_medication_events?: MedicationAdherenceEvent[];
};

export type MedicationFrequency = "daily" | "weekly" | "as_needed" | "custom";
export type MedicationTimeOfDay = "morning" | "afternoon" | "evening" | "bedtime";


export type MedicationAdherenceStatus = "taken" | "skipped";

export type TodayMedicationStatus = {
  medication_id: string;
  status: MedicationAdherenceStatus | null;
};

export type MedicationAdherenceEvent = {
  medication_id: string;
  medication_name: string;
  event_date: string;
  status: MedicationAdherenceStatus;
};

export type MedicationEntry = {
  id: string;
  name: string;
  dosage: string | null;
  frequency: MedicationFrequency;
  custom_frequency: string | null;
  time_of_day: MedicationTimeOfDay | null;
  notes: string | null;
};

export type HealthRiskSection = {
  level: "positive" | "watch" | "caution";
  summary: string;
  factors: string[];
};

export type HealthRiskInsightsResponse = {
  generated_at: string;
  profile_snapshot: HealthProfile;
  overall_health_snapshot: string;
  cardiovascular_caution: HealthRiskSection;
  metabolic_weight_caution: HealthRiskSection;
  lifestyle_risk_factors: string[];
  positive_habits: string[];
  top_priorities_for_improvement: string[];
  suggested_next_steps: string[];
  disclaimer: string;
};

export type ReportRead = {
  id: number;
  user_id: number;
  report_type: string;
  input_payload: string;
  output_summary: string;
  created_at: string;
};

export type ReportSavePayload = {
  report_type: string;
  original_input_text: string;
  structured_data: Record<string, unknown>;
  follow_up_qa: Array<{ question: string; answer: string }>;
  outputs: Record<string, unknown>;
  source_metadata?: Record<string, unknown>;
  completed_at?: string;
};

export interface FgdLabelData {
  buyer?: string;
  season?: string;
  cust_style_no?: string;
  y_style_no?: string;
  winzen_style_no?: string;
  garment_type?: string;
  sample_stage?: string;
  sample_job_no?: string;
  goods_no?: string;
  washing?: string;
  fabric_raw?: string;
  fabric_material?: string;
  fabric_yarn_count?: string;
  fabric_construction?: string;
  color?: string;
  size?: string;
  gnw_weight?: string;
  sales?: string;
}

export interface FgdData {
  label: FgdLabelData;
  garment_description: string;
  hashtags: string[];
}

export interface FgdDiffItem {
  category: 'Label' | 'Garment Description' | 'Hashtags';
  field?: string;
  original: string;
  fresh: string;
  analysis: string;
}

export interface RuleAmendment {
  rule_code: string;
  rule_type: 'positive' | 'negative';
  target_field: string;
  rule_title: string;
  condition_trigger: string;
  rule_instruction: string;
  example_positive?: string;
  example_negative?: string;
  source_feedback: string;
  user_comment?: string;
}

export interface DbLabelingRule {
  id: number;
  rule_code: string;
  rule_type: 'positive' | 'negative' | string;
  target_field: string;
  rule_title: string;
  condition_trigger: string;
  rule_instruction: string;
  example_positive?: string | null;
  example_negative?: string | null;
  source_feedback?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DiscrepancyReviewQuestion {
  field?: string;
  category: string;
  discrepancy: string;
  question: string;
}

export interface LoopResult {
  loop_number: number;
  fresh_fgd: FgdData;
  differences: FgdDiffItem[];
  bulletpoints: string[];
  amended_rules: RuleAmendment[];
  review_questions?: DiscrepancyReviewQuestion[];
  score: number;
  score_breakdown: {
    label_accuracy: number;
    description_fidelity: number;
    hashtag_coverage: number;
  };
  evaluation_summary: string;
}

export interface GarmentTestReport {
  garment_id: string;
  tested_at: string;
  images_processed: string[];
  original_fgd: FgdData;
  loops: LoopResult[];
  final_score: number;
  final_verdict: string;
  cumulative_rule_amendments: RuleAmendment[];
  review_questions?: DiscrepancyReviewQuestion[];
  is_review_run?: boolean;
  status?: string;
  reviewer_feedback?: string;
}

export interface LibraryGarment {
  id: string;
  buyer?: string;
  garment_type?: string;
  status?: string;
  imageCount: number;
  images: string[];
}

export interface FgdJobLog {
  timestamp: string;
  elapsedSec: number;
  level: 'INFO' | 'STEP' | 'SUCCESS' | 'WARN' | 'ERROR';
  garmentId?: string;
  step?: string;
  message: string;
}

export interface FgdJobState {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'aborted';
  startedAt: number;
  endedAt?: number;
  elapsedSeconds: number;
  currentGarmentIndex: number;
  totalGarments: number;
  currentGarmentId?: string;
  currentStepDescription?: string;
  garmentIds: string[];
  maxLoops: number;
  logs: FgdJobLog[];
  reports: GarmentTestReport[];
  error?: string;
}

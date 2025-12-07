export enum FieldType {
  TEXT = 'text',
  EMAIL = 'email',
  TEL = 'tel',
  PHONE = 'tel',
  SELECT = 'select',
  MULTI_SELECT = 'multi-select',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  TEXTAREA = 'textarea',
  DATE = 'date',
  FILE = 'file',
  HIDDEN = 'hidden',
  UNKNOWN = 'unknown'
}

export interface DetectedField {
  element: HTMLElement;
  type: FieldType;
  selector: string;
  attributes: {
    name?: string;
    id?: string;
    placeholder?: string;
    label?: string;
    type?: string;
    required?: boolean;
    pattern?: string;
  };
}

export interface DetectedForm {
  element: HTMLElement;
  fields: DetectedField[];
  selector: string;
  contextText?: string;
  classification?: FormClassification;
}

export interface FormClassification {
  purpose: string;
  confidence: number;
  suggestedFields?: string[];
  isJobApplication?: boolean;
  isContactForm?: boolean;
  isSurvey?: boolean;
  isRegistration?: boolean;
  requiresResume?: boolean;
}

export interface FieldAnalysis {
  field: DetectedField;
  keywords: string[];
  context: string;
  confidence: number;
  suggestedProfilePath?: string;
}

export interface FieldMapping {
  field: DetectedField;
  profilePath: string;
  confidence: number;
  value: any;
}

export interface FillResult {
  field: DetectedField;
  success: boolean;
  error?: string;
}

export interface FillSummary {
  totalFields: number;
  filledFields: number;
  skippedFields: number;
  failedFields: number;
  results: FillResult[];
}

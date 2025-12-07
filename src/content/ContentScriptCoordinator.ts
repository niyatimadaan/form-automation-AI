import { FormDetector } from '../detector/FormDetector';
import { FieldAnalyzer } from '../analyzer/FieldAnalyzer';
import { FieldMapper } from '../mapper/FieldMapper';
import { FillExecutor } from '../executor/FillExecutor';
import { FormClassifier } from '../services/FormClassifier';
import { HuggingFaceClassifier } from '../services/HuggingFaceClassifier';
import { DetectedForm, FillSummary, FillResult } from '../types/form';
import { Profile } from '../types/profile';
import { config } from '../config/config';

export class ContentScriptCoordinator {
  private formDetector: FormDetector;
  private fieldAnalyzer: FieldAnalyzer;
  private fieldMapper: FieldMapper;
  private fillExecutor: FillExecutor;
  private formClassifier: FormClassifier | HuggingFaceClassifier;

  constructor() {
    this.formDetector = new FormDetector();
    this.fieldAnalyzer = new FieldAnalyzer();
    this.fieldMapper = new FieldMapper();
    this.fillExecutor = new FillExecutor();
    
    // Choose classifier based on config
    this.formClassifier = config.aiProvider === 'azure' 
      ? new FormClassifier() 
      : new HuggingFaceClassifier();
  }

  initialize(): void {
    console.log('ContentScriptCoordinator initialized');
    
    this.formDetector.observeDynamicForms((form) => {
      console.log('New form detected:', form);
      // Optionally classify forms as they're detected
      if (config.classification.enabled) {
        this.classifyFormAsync(form);
      }
    });
  }

  private async classifyFormAsync(form: DetectedForm): Promise<void> {
    try {
      const classification = await this.formClassifier.classifyForm(form);
      form.classification = classification;
      console.log('Form classified:', classification.purpose);
    } catch (error) {
      console.error('Failed to classify form:', error);
    }
  }

  detectAndAnalyzeForms(): DetectedForm[] {
    return this.formDetector.detectForms();
  }

  async detectAndClassifyForms(): Promise<DetectedForm[]> {
    const forms = this.detectAndAnalyzeForms();
    
    // Classify forms with GPT for better understanding (if enabled)
    if (!config.classification.enabled) {
      console.log('Form classification disabled, using unclassified forms');
      return forms;
    }
    
    try {
      return await this.formClassifier.classifyMultipleForms(forms);
    } catch (error) {
      console.error('Form classification failed, using unclassified forms:', error);
      return forms;
    }
  }

  async executeAutofill(profile: Profile): Promise<FillSummary> {
    try {
      // Use classified forms for better field mapping
      const forms = await this.detectAndClassifyForms();
      
      if (forms.length === 0) {
        return {
          totalFields: 0,
          filledFields: 0,
          skippedFields: 0,
          failedFields: 0,
          results: []
        };
      }
      
      // Log form classifications
      forms.forEach(form => {
        if (form.classification) {
          console.log(`Detected ${form.classification.purpose} (${form.classification.confidence}% confidence)`);
        }
      });
      
      if (this.detectCaptcha()) {
        throw new Error('CAPTCHA detected. Please complete the CAPTCHA manually.');
      }
      
      const allFields = forms.flatMap(form => form.fields);
      const domain = window.location.hostname;
      
      // Use AI-powered mapping if enabled, otherwise use heuristic mapping
      const mappings = config.answerMatching.enabled
        ? await this.fieldMapper.mapFieldsWithAI(allFields, profile)
        : this.fieldMapper.mapFields(allFields, profile);
      
      console.log(`Mapped ${mappings.length} fields (${config.answerMatching.enabled ? 'with AI' : 'heuristic'})`);
      
      const timeoutPromise = new Promise<FillSummary>((_, reject) => {
        setTimeout(() => reject(new Error('Fill operation timed out')), 5000);
      });
      
      const fillPromise = this.fillExecutor.fillForm(mappings);
      
      const summary = await Promise.race([fillPromise, timeoutPromise]);
      
      this.highlightFilledFields(summary.results);
      
      return summary;
    } catch (error) {
      throw error;
    }
  }

  private detectCaptcha(): boolean {
    const captchaSelectors = [
      '.g-recaptcha',
      '#recaptcha',
      '[class*="captcha"]',
      '[id*="captcha"]'
    ];
    
    for (const selector of captchaSelectors) {
      if (document.querySelector(selector)) {
        return true;
      }
    }
    
    return false;
  }

  highlightFilledFields(results: FillResult[]): void {
    for (const result of results) {
      if (result.success) {
        result.field.element.classList.add('form-autofill-filled');
      }
    }
  }

  clearHighlights(): void {
    const filledElements = document.querySelectorAll('.form-autofill-filled');
    filledElements.forEach(element => {
      element.classList.remove('form-autofill-filled');
    });
  }
}

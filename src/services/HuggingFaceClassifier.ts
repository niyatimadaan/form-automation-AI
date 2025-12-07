import { DetectedForm, FormClassification, FieldType } from '../types/form';
import { config } from '../config/config';

/**
 * HuggingFaceClassifier uses Hugging Face Inference API to classify forms
 * Alternative to Azure OpenAI with open-source models
 */
export class HuggingFaceClassifier {
  private readonly API_KEY = config.huggingface.apiKey;
  private readonly MODEL = config.huggingface.model;
  private readonly ENDPOINT = config.huggingface.endpoint + config.huggingface.model;

  async classifyForm(form: DetectedForm): Promise<FormClassification> {
    const contextText = this.extractContextText(form.element);
    const fieldSummary = this.summarizeFields(form);
    
    const prompt = this.buildClassificationPrompt(contextText, fieldSummary);
    
    try {
      const response = await this.callHuggingFace(prompt);
      return this.parseClassification(response);
    } catch (error) {
      console.warn('Hugging Face classification failed, using fallback:', error);
      return this.createFallbackClassification(form);
    }
  }

  async classifyMultipleForms(forms: DetectedForm[]): Promise<DetectedForm[]> {
    const classified = await Promise.all(
      forms.map(async (form) => {
        const classification = await this.classifyForm(form);
        return {
          ...form,
          classification
        };
      })
    );
    
    return classified;
  }

  private extractContextText(container: HTMLElement): string {
    const clone = container.cloneNode(true) as HTMLElement;
    
    const elementsToRemove = clone.querySelectorAll('input, select, textarea, button, script, style');
    elementsToRemove.forEach(el => el.remove());
    
    let text = clone.textContent?.trim() || '';
    text = text.replace(/\s+/g, ' ').trim();
    
    // Limit context to avoid token limits
    if (text.length > 1000) {
      text = text.substring(0, 1000) + '...';
    }
    
    return text;
  }

  private summarizeFields(form: DetectedForm): string {
    const fieldTypes = form.fields.map(f => {
      const label = f.attributes.label || f.attributes.placeholder || f.attributes.name || 'unlabeled';
      return `${f.type}: ${label}`;
    });
    
    return fieldTypes.join(', ');
  }

  private buildClassificationPrompt(contextText: string, fieldSummary: string): string {
    return `<s>[INST] You are a form classification expert. Analyze this form and provide a JSON response.

Form context: "${contextText}"
Form fields: ${fieldSummary}

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "purpose": "brief description of form purpose",
  "confidence": 0.0-1.0,
  "suggestedFields": ["field1", "field2"],
  "isJobApplication": boolean,
  "isContactForm": boolean,
  "isSurvey": boolean,
  "isRegistration": boolean,
  "requiresResume": boolean
}
[/INST]`;
  }

  private async callHuggingFace(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.classification.timeoutMs);

    try {
      const response = await fetch(this.ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            temperature: config.classification.temperature,
            max_new_tokens: config.classification.maxTokens,
            return_full_text: false
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hugging Face API error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      // Hugging Face returns array format
      if (Array.isArray(result) && result[0]?.generated_text) {
        return result[0].generated_text;
      }
      
      throw new Error('Unexpected Hugging Face response format');
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseClassification(response: string): FormClassification {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          purpose: parsed.purpose || 'Unknown Form',
          confidence: parsed.confidence || 0.5,
          suggestedFields: parsed.suggestedFields || [],
          isJobApplication: parsed.isJobApplication || false,
          isContactForm: parsed.isContactForm || false,
          isSurvey: parsed.isSurvey || false,
          isRegistration: parsed.isRegistration || false,
          requiresResume: parsed.requiresResume || false
        };
      }
      
      throw new Error('No JSON found in response');
    } catch (error) {
      console.warn('Failed to parse Hugging Face response:', error);
      throw error;
    }
  }

  private createFallbackClassification(form: DetectedForm): FormClassification {
    const fieldTypes = form.fields.map(f => f.type);
    const labels = form.fields.map(f => (f.attributes.label || '').toLowerCase()).join(' ');
    
    const hasFileUpload = fieldTypes.includes(FieldType.FILE);
    const hasEmail = fieldTypes.includes(FieldType.EMAIL);
    const hasPhone = fieldTypes.includes(FieldType.TEL);
    
    const isJobApp = hasFileUpload && (labels.includes('resume') || labels.includes('cv'));
    const isContact = hasEmail && (labels.includes('message') || labels.includes('contact'));
    const isRegistration = labels.includes('password') || labels.includes('username');
    
    return {
      purpose: isJobApp ? 'Job Application' : isContact ? 'Contact Form' : 'Generic Form',
      confidence: 0.4,
      suggestedFields: [],
      isJobApplication: isJobApp,
      isContactForm: isContact,
      isSurvey: false,
      isRegistration: isRegistration,
      requiresResume: hasFileUpload
    };
  }
}

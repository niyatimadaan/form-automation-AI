import { DetectedForm, FormClassification, FieldType } from '../types/form';
import { config } from '../config/config';

export class FormClassifier {
  private readonly AZURE_API_KEY = config.azure.apiKey;
  private readonly AZURE_ENDPOINT = config.azure.endpoint;

  async classifyForm(form: DetectedForm): Promise<FormClassification> {
    const contextText = this.extractContextText(form.element);
    const fieldSummary = this.summarizeFields(form);
    
    const prompt = this.buildClassificationPrompt(contextText, fieldSummary);
    
    try {
      const response = await this.callGPT(prompt);
      return this.parseClassification(response);
    } catch (error) {
      console.error('Form classification failed:', error);
      return this.createFallbackClassification(form);
    }
  }

  async classifyMultipleForms(forms: DetectedForm[]): Promise<DetectedForm[]> {
    const classified = await Promise.all(
      forms.map(async (form) => {
        const classification = await this.classifyForm(form);
        return {
          ...form,
          contextText: this.extractContextText(form.element),
          classification
        };
      })
    );
    
    return classified;
  }

  private extractContextText(container: HTMLElement): string {
    // Clone the container to avoid modifying the actual DOM
    const clone = container.cloneNode(true) as HTMLElement;
    
    // Remove inputs, buttons, and other interactive elements
    const elementsToRemove = clone.querySelectorAll('input, select, textarea, button, script, style');
    elementsToRemove.forEach(el => el.remove());
    
    // Get plain text content
    let text = clone.textContent?.trim() || '';
    
    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Limit to 1000 characters to avoid token limits
    return text.slice(0, 1000);
  }

  private summarizeFields(form: DetectedForm): string {
    const fieldTypes = form.fields.map(f => f.type);
    const fieldLabels = form.fields
      .map(f => f.attributes.label)
      .filter(Boolean)
      .slice(0, 10); // Limit to first 10 labels
    
    return `Field types: ${fieldTypes.join(', ')}. Labels: ${fieldLabels.join(', ')}`;
  }

  private buildClassificationPrompt(contextText: string, fieldSummary: string): string {
    return `Analyze this web form and classify its purpose. Respond in JSON format with these fields:
- purpose: Brief description (e.g., "job application form", "contact form", "survey")
- confidence: 0-100
- suggestedFields: Array of field purposes expected (e.g., ["name", "email", "resume"])
- isJobApplication: boolean
- isContactForm: boolean
- isSurvey: boolean

Context text from form:
"${contextText}"

${fieldSummary}

Respond with ONLY valid JSON, no other text.`;
  }

  private async callGPT(prompt: string): Promise<string> {
    const response = await fetch(this.AZURE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.AZURE_API_KEY
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: config.classification.temperature,
        max_tokens: config.classification.maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`GPT API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private parseClassification(response: string): FormClassification {
    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : response;
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        purpose: parsed.purpose || 'unknown form',
        confidence: parsed.confidence || 50,
        suggestedFields: parsed.suggestedFields || [],
        isJobApplication: parsed.isJobApplication || false,
        isContactForm: parsed.isContactForm || false,
        isSurvey: parsed.isSurvey || false
      };
    } catch (error) {
      console.error('Failed to parse GPT response:', error);
      return this.createBasicClassification(response);
    }
  }

  private createBasicClassification(text: string): FormClassification {
    const lowerText = text.toLowerCase();
    
    return {
      purpose: text.slice(0, 100),
      confidence: 50,
      suggestedFields: [],
      isJobApplication: lowerText.includes('job') || lowerText.includes('application') || lowerText.includes('resume'),
      isContactForm: lowerText.includes('contact') || lowerText.includes('message'),
      isSurvey: lowerText.includes('survey') || lowerText.includes('feedback')
    };
  }

  private createFallbackClassification(form: DetectedForm): FormClassification {
    // Heuristic-based classification when GPT fails
    const contextText = this.extractContextText(form.element).toLowerCase();
    const hasFileUpload = form.fields.some(f => f.type === FieldType.FILE);
    const hasTextArea = form.fields.some(f => f.type === FieldType.TEXTAREA);
    const fieldCount = form.fields.length;

    let purpose = 'general form';
    let isJobApplication = false;
    let isContactForm = false;
    let isSurvey = false;

    // Job application detection
    if (hasFileUpload && (contextText.includes('resume') || 
        contextText.includes('cv') || 
        contextText.includes('application') ||
        contextText.includes('job'))) {
      purpose = 'job application form';
      isJobApplication = true;
    }
    // Contact form detection
    else if (hasTextArea && fieldCount <= 5 && 
             (contextText.includes('contact') || contextText.includes('message'))) {
      purpose = 'contact form';
      isContactForm = true;
    }
    // Survey detection
    else if (fieldCount > 5 && (contextText.includes('survey') || 
             contextText.includes('feedback') || 
             contextText.includes('questionnaire'))) {
      purpose = 'survey form';
      isSurvey = true;
    }

    return {
      purpose,
      confidence: 60,
      suggestedFields: [],
      isJobApplication,
      isContactForm,
      isSurvey
    };
  }
}

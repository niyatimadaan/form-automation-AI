import { DetectedField, FieldAnalysis } from '../types/form';
import { Profile } from '../types/profile';
import { config } from '../config/config';

interface AnswerMatchResult {
  value: string | string[];
  confidence: number;
  reasoning: string;
}

/**
 * AIAnswerMatcher uses AI to intelligently match form questions with profile data
 * Handles complex mappings, generates new content, and understands context
 */
export class AIAnswerMatcher {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly provider: 'azure' | 'huggingface';

  constructor() {
    this.provider = config.aiProvider;
    
    if (this.provider === 'azure') {
      this.apiKey = config.azure.apiKey;
      this.endpoint = config.azure.endpoint;
    } else {
      this.apiKey = config.huggingface.apiKey;
      this.endpoint = config.huggingface.endpoint + config.huggingface.model;
    }
  }

  /**
   * Use AI to find the best answer from profile for a given field
   */
  async matchAnswer(
    field: DetectedField,
    analysis: FieldAnalysis,
    profile: Profile
  ): Promise<AnswerMatchResult | null> {
    if (!config.answerMatching.enabled) {
      return null;
    }

    try {
      const prompt = this.buildMatchingPrompt(field, analysis, profile);
      const response = await this.callAI(prompt);
      return this.parseMatchResult(response);
    } catch (error) {
      console.error('AI answer matching failed:', error);
      return null;
    }
  }

  /**
   * Batch match multiple fields
   */
  async matchMultipleAnswers(
    fields: Array<{ field: DetectedField; analysis: FieldAnalysis }>,
    profile: Profile
  ): Promise<Map<string, AnswerMatchResult>> {
    const results = new Map<string, AnswerMatchResult>();

    // Process in parallel with limit to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < fields.length; i += batchSize) {
      const batch = fields.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async ({ field, analysis }) => {
          const result = await this.matchAnswer(field, analysis, profile);
          return { selector: field.selector, result };
        })
      );

      for (const { selector, result } of batchResults) {
        if (result && result.confidence >= config.answerMatching.confidenceThreshold) {
          results.set(selector, result);
        }
      }
    }

    return results;
  }

  private buildMatchingPrompt(
    field: DetectedField,
    analysis: FieldAnalysis,
    profile: Profile
  ): string {
    const question = field.attributes.label || field.attributes.placeholder || field.attributes.name || 'unlabeled field';
    const fieldType = field.type;
    const keywords = analysis.keywords.join(', ');
    const required = field.attributes.required || false;
    
    // Serialize relevant profile data
    const profileSummary = this.summarizeProfile(profile);

    return `You are an intelligent form-filling assistant. Match the form question with the user's profile data.

Question: "${question}"
Field Type: ${fieldType}
Keywords: ${keywords}
Required: ${required}

User Profile:
${profileSummary}

Task:
1. Find the most relevant answer from the profile
2. If no exact match, generate an appropriate answer based on profile context
3. If the question cannot be answered from the profile, return null

Respond with ONLY a JSON object:
{
  "value": "answer text or array of values",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of why this answer was chosen"
}`;
  }

  private summarizeProfile(profile: Profile): string {
    const parts: string[] = [];

    // Personal info
    if (profile.personal) {
      parts.push('Personal:');
      Object.entries(profile.personal).forEach(([key, value]) => {
        if (value) parts.push(`  ${key}: ${value}`);
      });
    }

    // Latest experience
    if (profile.experiences?.length > 0) {
      const exp = profile.experiences[0];
      parts.push(`\nCurrent Job: ${exp.position} at ${exp.company} (${exp.startDate} - ${exp.endDate || 'Present'})`);
      if (exp.description) parts.push(`  Description: ${exp.description.substring(0, 200)}`);
    }

    // Education
    if (profile.education?.length > 0) {
      const edu = profile.education[0];
      parts.push(`\nEducation: ${edu.degree} in ${edu.major || 'N/A'} from ${edu.school} (${edu.graduationYear || 'N/A'})`);
    }

    // Skills
    if (profile.skills?.length > 0) {
      parts.push(`\nSkills: ${profile.skills.slice(0, 10).join(', ')}`);
    }

    // Custom fields
    if (profile.custom && Object.keys(profile.custom).length > 0) {
      parts.push('\nCustom:');
      Object.entries(profile.custom).forEach(([key, value]) => {
        parts.push(`  ${key}: ${value}`);
      });
    }

    return parts.join('\n');
  }

  private async callAI(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.answerMatching.timeoutMs);

    try {
      if (this.provider === 'azure') {
        return await this.callAzure(prompt, controller.signal);
      } else {
        return await this.callHuggingFace(prompt, controller.signal);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callAzure(prompt: string, signal: AbortSignal): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: config.answerMatching.temperature,
        max_tokens: config.answerMatching.maxTokens
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Azure API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async callHuggingFace(prompt: string, signal: AbortSignal): Promise<string> {
    const formattedPrompt = `<s>[INST] ${prompt} [/INST]`;
    
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: formattedPrompt,
        parameters: {
          temperature: config.answerMatching.temperature,
          max_new_tokens: config.answerMatching.maxTokens,
          return_full_text: false
        }
      }),
      signal
    });

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (Array.isArray(result) && result[0]?.generated_text) {
      return result[0].generated_text;
    }
    
    throw new Error('Unexpected Hugging Face response format');
  }

  private parseMatchResult(response: string): AnswerMatchResult | null {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Check for null/no answer case
      if (parsed.value === null || parsed.value === 'null') {
        return null;
      }

      return {
        value: parsed.value,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'AI matched from profile'
      };
    } catch (error) {
      console.warn('Failed to parse AI match result:', error);
      return null;
    }
  }
}

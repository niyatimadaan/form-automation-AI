import { DetectedField, FieldAnalysis, FieldMapping } from '../types/form';
import { Profile, DomainMapping } from '../types/profile';
import { FieldAnalyzer } from '../analyzer/FieldAnalyzer';
import { AIAnswerMatcher } from '../services/AIAnswerMatcher';
import { config } from '../config/config';

export class FieldMapper {
  private readonly CONFIDENCE_THRESHOLD = 0.5;
  private analyzer: FieldAnalyzer;
  private aiMatcher: AIAnswerMatcher;

  constructor() {
    this.analyzer = new FieldAnalyzer();
    this.aiMatcher = new AIAnswerMatcher();
  }

  mapFields(
    fields: DetectedField[],
    profile: Profile,
    domainMapping?: DomainMapping
  ): FieldMapping[] {
    const mappings: FieldMapping[] = [];

    for (const field of fields) {
      if (domainMapping && domainMapping.fieldMappings[field.selector]) {
        const profilePath = domainMapping.fieldMappings[field.selector];
        const value = this.getValueFromPath(profile, profilePath);
        
        mappings.push({
          field,
          profilePath,
          confidence: 1.0,
          value
        });
      } else {
        const analysis = this.analyzer.analyzeField(field);
        const match = this.findBestMatch(analysis, profile);
        
        if (match && match.confidence >= this.CONFIDENCE_THRESHOLD) {
          const value = this.getValueFromPath(profile, match.path);
          
          mappings.push({
            field,
            profilePath: match.path,
            confidence: match.confidence,
            value
          });
        }
      }
    }

    return mappings;
  }

  /**
   * Enhanced mapping with AI-powered answer matching
   */
  async mapFieldsWithAI(
    fields: DetectedField[],
    profile: Profile,
    domainMapping?: DomainMapping
  ): Promise<FieldMapping[]> {
    const mappings: FieldMapping[] = [];
    const unmappedFields: Array<{ field: DetectedField; analysis: FieldAnalysis }> = [];

    // First pass: use domain mapping and heuristic matching
    for (const field of fields) {
      if (domainMapping && domainMapping.fieldMappings[field.selector]) {
        const profilePath = domainMapping.fieldMappings[field.selector];
        const value = this.getValueFromPath(profile, profilePath);
        
        mappings.push({
          field,
          profilePath,
          confidence: 1.0,
          value
        });
      } else {
        const analysis = this.analyzer.analyzeField(field);
        const match = this.findBestMatch(analysis, profile);
        
        if (match && match.confidence >= this.CONFIDENCE_THRESHOLD) {
          const value = this.getValueFromPath(profile, match.path);
          
          mappings.push({
            field,
            profilePath: match.path,
            confidence: match.confidence,
            value
          });
        } else {
          // Save for AI matching
          unmappedFields.push({ field, analysis });
        }
      }
    }

    // Second pass: use AI for unmapped fields
    if (config.answerMatching.enabled && unmappedFields.length > 0) {
      console.log(`Using AI to match ${unmappedFields.length} unmapped fields`);
      
      const aiResults = await this.aiMatcher.matchMultipleAnswers(unmappedFields, profile);
      
      for (const { field } of unmappedFields) {
        const aiMatch = aiResults.get(field.selector);
        if (aiMatch) {
          mappings.push({
            field,
            profilePath: 'ai-generated',
            confidence: aiMatch.confidence,
            value: aiMatch.value
          });
          
          console.log(`AI matched ${field.attributes.label || field.attributes.name}: ${aiMatch.reasoning}`);
        }
      }
    }

    return mappings;
  }

  findBestMatch(
    analysis: FieldAnalysis,
    profile: Profile
  ): { path: string; confidence: number } | null {
    const candidates = this.generateCandidatePaths(profile);
    let bestMatch: { path: string; confidence: number } | null = null;

    for (const path of candidates) {
      const confidence = this.calculateConfidence(analysis, path);
      
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { path, confidence };
      }
    }

    return bestMatch;
  }

  calculateConfidence(analysis: FieldAnalysis, profilePath: string): number {
    const pathTokens = profilePath.toLowerCase().split('.');
    const keywords = analysis.keywords;
    
    let matchCount = 0;
    
    for (const keyword of keywords) {
      for (const token of pathTokens) {
        if (token.includes(keyword) || keyword.includes(token)) {
          matchCount++;
        }
      }
    }
    
    if (matchCount === 0) {
      return 0;
    }
    
    return Math.min(matchCount / keywords.length, 1.0);
  }

  private generateCandidatePaths(profile: Profile): string[] {
    const paths: string[] = [];
    
    for (const key in profile.personal) {
      paths.push(`personal.${key}`);
    }
    
    if (profile.experiences.length > 0) {
      const exp = profile.experiences[0];
      for (const key in exp) {
        paths.push(`experiences.0.${key}`);
      }
    }
    
    if (profile.projects.length > 0) {
      const proj = profile.projects[0];
      for (const key in proj) {
        paths.push(`projects.0.${key}`);
      }
    }
    
    if (profile.education.length > 0) {
      const edu = profile.education[0];
      for (const key in edu) {
        paths.push(`education.0.${key}`);
      }
    }
    
    if (profile.skills.length > 0) {
      paths.push('skills');
    }
    
    for (const key in profile.custom) {
      paths.push(`custom.${key}`);
    }
    
    return paths;
  }

  private getValueFromPath(profile: Profile, path: string): any {
    const parts = path.split('.');
    let value: any = profile;
    
    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }
    
    return value;
  }
}

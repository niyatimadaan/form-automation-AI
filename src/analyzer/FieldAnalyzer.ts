import { DetectedField, FieldAnalysis } from '../types/form';

export class FieldAnalyzer {
  analyzeField(field: DetectedField): FieldAnalysis {
    const keywords = this.extractKeywords(field);
    const context = this.getFieldContext(field.element);
    
    return {
      field,
      keywords,
      context,
      confidence: 0,
      suggestedProfilePath: undefined
    };
  }

  extractKeywords(field: DetectedField): string[] {
    const keywords: string[] = [];
    const attrs = field.attributes;
    
    if (attrs.name) {
      keywords.push(...this.tokenize(attrs.name));
    }
    if (attrs.id) {
      keywords.push(...this.tokenize(attrs.id));
    }
    if (attrs.label) {
      keywords.push(...this.tokenize(attrs.label));
    }
    if (attrs.placeholder) {
      keywords.push(...this.tokenize(attrs.placeholder));
    }
    
    return [...new Set(keywords.map(k => k.toLowerCase()))];
  }

  getFieldContext(element: HTMLElement): string {
    const contexts: string[] = [];
    
    const parent = element.parentElement;
    if (parent) {
      const text = parent.textContent?.trim();
      if (text && text.length < 200) {
        contexts.push(text);
      }
    }
    
    const prevSibling = element.previousElementSibling;
    if (prevSibling) {
      const text = prevSibling.textContent?.trim();
      if (text && text.length < 100) {
        contexts.push(text);
      }
    }
    
    return contexts.join(' ').substring(0, 500);
  }

  private tokenize(text: string): string[] {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }
}

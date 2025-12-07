import { DetectedField, FieldMapping, FillResult, FillSummary, FieldType } from '../types/form';

export class FillExecutor {
  async fillForm(mappings: FieldMapping[]): Promise<FillSummary> {
    const results: FillResult[] = [];
    let filledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const mapping of mappings) {
      const result = await this.fillField(mapping.field, mapping.value);
      results.push(result);

      if (result.success) {
        filledCount++;
      } else if (result.error?.includes('disabled') || result.error?.includes('readonly') || result.error?.includes('file input')) {
        skippedCount++;
      } else {
        failedCount++;
      }
    }

    return {
      totalFields: mappings.length,
      filledFields: filledCount,
      skippedFields: skippedCount,
      failedFields: failedCount,
      results
    };
  }

  async fillField(field: DetectedField, value: any): Promise<FillResult> {
    try {
      const element = field.element;
      
      if (this.shouldSkipField(field)) {
        return {
          field,
          success: false,
          error: 'Field is disabled, readonly, or file input'
        };
      }
      
      if (field.attributes.pattern && !this.matchesPattern(value, field.attributes.pattern)) {
        return {
          field,
          success: false,
          error: 'Value does not match required pattern'
        };
      }
      
      switch (field.type) {
        case FieldType.TEXT:
        case FieldType.EMAIL:
        case FieldType.TEL:
        case FieldType.TEXTAREA:
          return this.fillTextInput(element as HTMLInputElement, value);
        
        case FieldType.SELECT:
          return this.fillSelect(element as HTMLSelectElement, value);
        
        case FieldType.MULTI_SELECT:
          return this.fillMultiSelect(element as HTMLSelectElement, value);
        
        case FieldType.CHECKBOX:
        case FieldType.RADIO:
          return this.fillCheckboxOrRadio(element as HTMLInputElement, value);
        
        case FieldType.DATE:
          return this.fillDate(element as HTMLInputElement, value);
        
        default:
          return {
            field,
            success: false,
            error: `Unsupported field type: ${field.type}`
          };
      }
    } catch (error) {
      return {
        field,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private fillTextInput(element: HTMLInputElement | HTMLTextAreaElement, value: any): FillResult {
    const stringValue = String(value || '');
    
    element.value = stringValue;
    this.triggerEvents(element);
    
    return {
      field: { element } as unknown as DetectedField,
      success: true
    };
  }

  private fillSelect(element: HTMLSelectElement, value: any): FillResult {
    const stringValue = String(value || '').toLowerCase();
    
    for (let i = 0; i < element.options.length; i++) {
      const option = element.options[i];
      const optionValue = option.value.toLowerCase();
      const optionText = option.text.toLowerCase();
      
      if (optionValue === stringValue || optionText === stringValue) {
        element.selectedIndex = i;
        this.triggerEvents(element);
        return {
          field: { element } as unknown as DetectedField,
          success: true
        };
      }
    }
    
    return {
      field: { element } as unknown as DetectedField,
      success: false,
      error: 'No matching option found'
    };
  }

  private fillMultiSelect(element: HTMLSelectElement, value: any): FillResult {
    if (!Array.isArray(value)) {
      return {
        field: { element } as unknown as DetectedField,
        success: false,
        error: 'Multi-select requires array value'
      };
    }
    
    const values = value.map(v => String(v).toLowerCase());
    let matchCount = 0;
    
    for (let i = 0; i < element.options.length; i++) {
      const option = element.options[i];
      const optionValue = option.value.toLowerCase();
      const optionText = option.text.toLowerCase();
      
      if (values.includes(optionValue) || values.includes(optionText)) {
        option.selected = true;
        matchCount++;
      }
    }
    
    if (matchCount > 0) {
      this.triggerEvents(element);
      return {
        field: { element } as unknown as DetectedField,
        success: true
      };
    }
    
    return {
      field: { element } as unknown as DetectedField,
      success: false,
      error: 'No matching options found'
    };
  }

  private fillCheckboxOrRadio(element: HTMLInputElement, value: any): FillResult {
    const boolValue = Boolean(value);
    element.checked = boolValue;
    this.triggerEvents(element);
    
    return {
      field: { element } as unknown as DetectedField,
      success: true
    };
  }

  private fillDate(element: HTMLInputElement, value: any): FillResult {
    const stringValue = String(value || '');
    element.value = stringValue;
    this.triggerEvents(element);
    
    return {
      field: { element } as unknown as DetectedField,
      success: true
    };
  }

  private triggerEvents(element: HTMLElement): void {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  verifyFieldValue(field: DetectedField, expectedValue: any): boolean {
    const element = field.element;
    
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value === String(expectedValue);
    }
    
    if (element instanceof HTMLSelectElement) {
      const selected = element.options[element.selectedIndex];
      return selected && (selected.value === expectedValue || selected.text === expectedValue);
    }
    
    return false;
  }

  private shouldSkipField(field: DetectedField): boolean {
    if (field.type === FieldType.FILE) {
      return true;
    }
    
    const element = field.element;
    
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (element.disabled || element.readOnly) {
        return true;
      }
    }
    
    if (element instanceof HTMLSelectElement) {
      if (element.disabled) {
        return true;
      }
    }
    
    if (field.type === FieldType.HIDDEN) {
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
        return true;
      }
    }
    
    return false;
  }

  private matchesPattern(value: any, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern);
      return regex.test(String(value));
    } catch {
      return true;
    }
  }
}
import { DetectedForm, DetectedField, FieldType } from '../types/form';

export class FormDetector {
  private observer: MutationObserver | null = null;

  detectForms(): DetectedForm[] {
    const detectedForms: DetectedForm[] = [];

    // First, detect traditional <form> elements
    const forms = document.querySelectorAll('form');
    forms.forEach((form, index) => {
      const fields = this.extractFields(form);
      const selector = this.generateSelector(form, index);
      
      detectedForms.push({
        element: form,
        fields,
        selector,
        contextText: this.extractContextText(form)
      });
    });

    // Then, detect implicit forms (like Google Forms) - containers with input fields
    const implicitForms = this.detectImplicitForms();
    detectedForms.push(...implicitForms);

    return detectedForms;
  }

  private detectImplicitForms(): DetectedForm[] {
    const implicitForms: DetectedForm[] = [];

    // First, try to detect question blocks (Google Forms, Typeform, etc.)
    const questionBlocks = this.detectQuestionBlocks();
    if (questionBlocks.length > 0) {
      implicitForms.push(...questionBlocks);
    }

    // Then, detect traditional input-based forms
    const inputBasedForms = this.detectInputBasedForms();
    implicitForms.push(...inputBasedForms);

    return implicitForms;
  }

  private detectQuestionBlocks(): DetectedForm[] {
    // Detect question blocks that don't have real inputs yet (Google Forms style)
    const formBlocks = Array.from(document.querySelectorAll(`
      [role="listitem"],
      [data-item-id],
      div[class*="question"],
      div[class*="freebirdFormviewerViewItems"],
      div[class*="field"],
      div[class*="item"]
    `)) as HTMLElement[];

    if (formBlocks.length === 0) return [];

    // Filter out blocks that are inside real forms or already have inputs
    const validBlocks = formBlocks.filter(block => {
      if (block.closest('form')) return false;
      
      // Check if this looks like a question block
      const hasQuestionIndicators = 
        block.getAttribute('role') === 'listitem' ||
        block.hasAttribute('data-item-id') ||
        block.querySelector('div[class*="title"], div[class*="label"], label');
      
      return hasQuestionIndicators;
    });

    if (validBlocks.length === 0) return [];

    // Convert question blocks to fields
    const fields: DetectedField[] = validBlocks.map((block, index) => {
      const label = this.extractQuestionLabel(block);
      const type = this.detectQuestionType(block);

      return {
        element: block,
        type,
        selector: this.generateContainerSelector(block),
        attributes: {
          label,
          required: this.detectRequired(block)
        }
      };
    });

    // Find the common parent container for all question blocks
    const container = validBlocks[0].closest('[role="main"], form, body') as HTMLElement || document.body;

    return [
      {
        element: container,
        fields,
        selector: this.generateContainerSelector(container),
        contextText: this.extractContextText(container)
      }
    ];
  }

  private detectInputBasedForms(): DetectedForm[] {
    // Capture ALL possible input-like elements including modern web components
    const candidates = Array.from(document.querySelectorAll(`
      input:not([type="hidden"]):not([type="submit"]):not([type="button"]),
      textarea,
      select,
      [contenteditable="true"],
      [role="textbox"],
      [role="combobox"],
      [role="radiogroup"]
    `)) as HTMLElement[];

    if (candidates.length === 0) return [];

    // Group inputs by their nearest logical container
    const groups = new Map<HTMLElement, HTMLElement[]>();

    candidates.forEach(el => {
      // Ignore elements inside real forms
      if (el.closest('form')) return;

      const container = this.findLogicalContainer(el);
      if (!container) return;

      if (!groups.has(container)) {
        groups.set(container, []);
      }
      groups.get(container)!.push(el);
    });

    // Convert groups into DetectedForm[]
    const forms: DetectedForm[] = [];
    for (const [container, fields] of groups) {
      // Skip if only 1 input (likely search box, not a form)
      if (fields.length < 2) continue;

      forms.push({
        element: container,
        fields: this.extractFieldsFromElements(fields),
        selector: this.generateContainerSelector(container),
        contextText: this.extractContextText(container)
      });
    }

    return forms;
  }

  extractContextText(container: HTMLElement): string {
    // Clone the container to avoid modifying the actual DOM
    const clone = container.cloneNode(true) as HTMLElement;
    
    // Remove inputs, buttons, and other interactive elements
    const elementsToRemove = clone.querySelectorAll('input, select, textarea, button, script, style');
    elementsToRemove.forEach(el => el.remove());
    
    // Get plain text content
    let text = clone.textContent?.trim() || '';
    
    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Limit to 1000 characters
    return text.slice(0, 1000);
  }

  private findLogicalContainer(el: HTMLElement): HTMLElement | null {
    let node: HTMLElement | null = el.parentElement;

    while (node && node !== document.body && node !== document.documentElement) {
      const role = node.getAttribute('role');
      const classList = node.className.toLowerCase();
      
      // Check for data-* attributes (Google Forms, React apps, etc.)
      const hasDataAttrs = node.getAttributeNames().some(n => 
        n.startsWith('data-') || 
        n.startsWith('jscontroller') || 
        n.startsWith('jsname')
      );
      
      // Check if this is a question/field container
      const isQuestionBlock =
        role === 'group' ||
        role === 'radiogroup' ||
        role === 'combobox' ||
        role === 'listitem' ||
        role === 'form' ||
        classList.includes('question') ||
        classList.includes('item') ||
        classList.includes('field') ||
        classList.includes('form') ||
        classList.includes('survey') ||
        classList.includes('questionnaire') ||
        hasDataAttrs;

      if (isQuestionBlock) {
        return node;
      }

      node = node.parentElement;
    }

    // Fallback: find the nearest container with multiple inputs
    return this.findNearestInputContainer(el);
  }

  private findNearestInputContainer(element: HTMLElement): HTMLElement | null {
    let current = element.parentElement;
    let bestContainer: HTMLElement | null = null;
    let minInputCount = Infinity;

    while (current && current !== document.body) {
      const inputs = current.querySelectorAll(`
        input:not([type="hidden"]),
        textarea,
        select,
        [contenteditable="true"],
        [role="textbox"]
      `);
      
      const count = Array.from(inputs).filter(inp => !inp.closest('form')).length;
      
      // Find the smallest container that has this input
      if (count > 0 && count < minInputCount) {
        bestContainer = current;
        minInputCount = count;
      }

      current = current.parentElement;
    }

    return bestContainer;
  }

  private extractFieldsFromElements(elements: HTMLElement[]): DetectedField[] {
    const fields: DetectedField[] = [];
    
    elements.forEach((element, index) => {
      const type = this.classifyFieldType(element);
      const selector = this.generateFieldSelector(element, index);
      const attributes = this.extractAttributes(element);

      fields.push({
        element,
        type,
        selector,
        attributes
      });
    });

    return fields;
  }

  private generateContainerSelector(container: HTMLElement): string {
    if (container.id) {
      return `#${container.id}`;
    }
    
    const classList = Array.from(container.classList);
    if (classList.length > 0) {
      // Use the most specific class
      return `.${classList[0]}`;
    }
    
    // Generate a path-based selector
    const tagName = container.tagName.toLowerCase();
    const parent = container.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        child => child.tagName.toLowerCase() === tagName
      );
      const index = siblings.indexOf(container);
      return `${tagName}:nth-of-type(${index + 1})`;
    }
    
    return tagName;
  }

  private extractFields(form: HTMLElement): DetectedField[] {
    const fields: DetectedField[] = [];
    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach((element, index) => {
      const htmlElement = element as HTMLElement;
      const type = this.classifyFieldType(htmlElement);
      const selector = this.generateFieldSelector(htmlElement, index);
      const attributes = this.extractAttributes(htmlElement);

      fields.push({
        element: htmlElement,
        type,
        selector,
        attributes
      });
    });

    return fields;
  }

  private classifyFieldType(element: HTMLElement): FieldType {
    const tagName = element.tagName.toLowerCase();
    
    // Handle contenteditable and ARIA roles (modern web components)
    if (element.hasAttribute('contenteditable') && element.getAttribute('contenteditable') !== 'false') {
      return FieldType.TEXTAREA;
    }
    
    const role = element.getAttribute('role');
    if (role === 'textbox' || role === 'combobox') {
      return FieldType.TEXT;
    }
    if (role === 'radiogroup') {
      return FieldType.RADIO;
    }
    
    if (tagName === 'textarea') {
      return FieldType.TEXTAREA;
    }
    
    if (tagName === 'select') {
      const select = element as HTMLSelectElement;
      return select.multiple ? FieldType.MULTI_SELECT : FieldType.SELECT;
    }
    
    if (tagName === 'input') {
      const input = element as HTMLInputElement;
      const type = input.type.toLowerCase();
      
      switch (type) {
        case 'email':
          return FieldType.EMAIL;
        case 'tel':
          return FieldType.TEL;
        case 'checkbox':
          return FieldType.CHECKBOX;
        case 'radio':
          return FieldType.RADIO;
        case 'date':
          return FieldType.DATE;
        case 'file':
          return FieldType.FILE;
        case 'hidden':
          return FieldType.HIDDEN;
        case 'text':
        case 'search':
        case 'url':
        case 'number':
          return FieldType.TEXT;
        default:
          return FieldType.TEXT;
      }
    }
    
    return FieldType.UNKNOWN;
  }

  private extractAttributes(element: HTMLElement): DetectedField['attributes'] {
    const input = element as HTMLInputElement;
    const label = this.findLabel(element);
    
    return {
      name: input.name || undefined,
      id: input.id || undefined,
      placeholder: input.placeholder || undefined,
      label: label || undefined,
      type: input.type || undefined,
      required: input.required || undefined,
      pattern: input.pattern || undefined
    };
  }

  private findLabel(element: HTMLElement): string | undefined {
    const input = element as HTMLInputElement;
    
    // 1. Check for explicit <label for="id">
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) {
        return this.extractPlainText(label);
      }
    }
    
    // 2. Check for wrapping <label>
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return this.extractPlainText(parentLabel);
    }
    
    // 3. Check for aria-label attribute
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel.trim();
    }
    
    // 4. Check for aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const labelElement = document.getElementById(labelledBy);
      if (labelElement) {
        return this.extractPlainText(labelElement);
      }
    }
    
    // 5. For Google Forms: look for text in parent containers (strip HTML tags)
    // Look up to 3 levels of parents
    let parent = element.parentElement;
    let level = 0;
    
    while (parent && level < 3) {
      // Clone parent and remove all input elements to get just the label text
      const clone = parent.cloneNode(true) as HTMLElement;
      const inputsInClone = clone.querySelectorAll('input, select, textarea, button');
      inputsInClone.forEach(inp => inp.remove());
      
      const plainText = this.extractPlainText(clone);
      
      // Valid label: has text, not too long, and not the entire page content
      if (plainText && plainText.length > 0 && plainText.length < 300) {
        return plainText;
      }
      
      parent = parent.parentElement;
      level++;
    }
    
    // 6. Check previous sibling elements
    let sibling = element.previousElementSibling;
    let siblingChecks = 0;
    
    while (sibling && siblingChecks < 3) {
      const text = this.extractPlainText(sibling);
      if (text && text.length > 0 && text.length < 200) {
        return text;
      }
      sibling = sibling.previousElementSibling;
      siblingChecks++;
    }
    
    return undefined;
  }

  private extractPlainText(element: Element): string {
    // Get text content which automatically strips HTML tags
    let text = element.textContent || '';
    
    // Remove extra whitespace and newlines
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  }

  private extractQuestionLabel(block: HTMLElement): string {
    // Try multiple selectors to find the question text
    const selectors = [
      'div[class*="title"]',
      'div[class*="label"]',
      'div[class*="question"]',
      'label',
      'span[class*="text"]',
      'div[role="heading"]'
    ];

    for (const selector of selectors) {
      const element = block.querySelector(selector);
      if (element) {
        const text = this.extractPlainText(element);
        if (text && text.length > 0 && text.length < 300) {
          return text;
        }
      }
    }

    // Fallback: get all text from the block, excluding buttons and hidden elements
    const clone = block.cloneNode(true) as HTMLElement;
    const excludeElements = clone.querySelectorAll('button, input, select, textarea, [role="button"]');
    excludeElements.forEach(el => el.remove());
    
    return this.extractPlainText(clone);
  }

  private detectQuestionType(block: HTMLElement): FieldType {
    // Look for indicators of question type in the block
    const blockText = block.textContent?.toLowerCase() || '';
    const classList = block.className.toLowerCase();

    // Check for radio buttons or checkboxes indicators
    if (block.querySelector('[role="radio"], [role="radiogroup"], input[type="radio"]') ||
        classList.includes('radio') ||
        blockText.includes('select one')) {
      return FieldType.RADIO;
    }

    if (block.querySelector('[role="checkbox"], input[type="checkbox"]') ||
        classList.includes('checkbox') ||
        blockText.includes('select all that apply')) {
      return FieldType.CHECKBOX;
    }

    // Check for textarea indicators
    if (block.querySelector('textarea') ||
        classList.includes('paragraph') ||
        classList.includes('long') ||
        blockText.includes('long answer')) {
      return FieldType.TEXTAREA;
    }

    // Check for select/dropdown
    if (block.querySelector('select') ||
        classList.includes('dropdown') ||
        classList.includes('select')) {
      return FieldType.SELECT;
    }

    // Check for email
    if (classList.includes('email') ||
        blockText.includes('email') ||
        block.querySelector('input[type="email"]')) {
      return FieldType.EMAIL;
    }

    // Check for phone
    if (classList.includes('phone') ||
        classList.includes('tel') ||
        blockText.includes('phone') ||
        block.querySelector('input[type="tel"]')) {
      return FieldType.TEL;
    }

    // Default to text
    return FieldType.TEXT;
  }

  private detectRequired(block: HTMLElement): boolean {
    // Check for required indicators
    return !!(
      block.querySelector('[aria-required="true"]') ||
      block.querySelector('[data-required="true"]') ||
      block.querySelector('[required]') ||
      block.textContent?.includes('*') ||
      block.textContent?.toLowerCase().includes('required')
    );
  }

  private generateSelector(form: HTMLElement, index: number): string {
    if (form.id) {
      return `#${form.id}`;
    }
    
    if (form.tagName.toLowerCase() === 'form') {
      const formElement = form as HTMLFormElement;
      if (formElement.name) {
        return `form[name="${formElement.name}"]`;
      }
      return `form:nth-of-type(${index + 1})`;
    }
    
    // For implicit forms (divs, etc)
    return this.generateContainerSelector(form);
  }

  private generateFieldSelector(element: HTMLElement, index: number): string {
    const input = element as HTMLInputElement;
    
    if (input.id) {
      return `#${input.id}`;
    }
    if (input.name) {
      return `[name="${input.name}"]`;
    }
    
    const tagName = element.tagName.toLowerCase();
    return `${tagName}:nth-of-type(${index + 1})`;
  }

  observeDynamicForms(callback: (form: DetectedForm) => void): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Check for traditional forms
              if (element.tagName === 'FORM') {
                const form = element as HTMLFormElement;
                const fields = this.extractFields(form);
                const selector = this.generateSelector(form, 0);
                
                callback({
                  element: form,
                  fields,
                  selector
                });
              }
              
              // Check for forms within the added element
              const forms = element.querySelectorAll('form');
              forms.forEach((form, index) => {
                const fields = this.extractFields(form);
                const selector = this.generateSelector(form, index);
                
                callback({
                  element: form,
                  fields,
                  selector
                });
              });
              
              // Check for implicit forms (containers with inputs)
              const inputs = element.querySelectorAll(`
                input:not([type="hidden"]),
                select,
                textarea,
                [contenteditable="true"],
                [role="textbox"]
              `);
              if (inputs.length >= 1) {
                const container = this.findLogicalContainer(inputs[0] as HTMLElement);
                if (container && !container.closest('form')) {
                  const containerInputs = Array.from(
                    container.querySelectorAll(`
                      input:not([type="hidden"]),
                      select,
                      textarea,
                      [contenteditable="true"],
                      [role="textbox"]
                    `)
                  ).filter(inp => !inp.closest('form')) as HTMLElement[];
                  
                  const fields = this.extractFieldsFromElements(containerInputs);
                  const selector = this.generateContainerSelector(container);
                  
                  callback({
                    element: container,
                    fields,
                    selector
                  });
                }
              }
            }
          });
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

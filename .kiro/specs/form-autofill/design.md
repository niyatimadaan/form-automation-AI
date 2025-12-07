# Design Document

## Overview

The Form Autofill system is implemented as a browser extension that combines content scripts for DOM interaction, a background service worker for coordination, and a popup UI for user interaction. The architecture separates concerns between form detection, field analysis, data mapping, and fill execution to ensure maintainability and extensibility.

The system uses a local-first approach where all user data is stored in browser local storage, with no external API calls or data transmission. The extension operates entirely within the browser environment, injecting content scripts into web pages to detect and manipulate form elements.

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Extension                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐    ┌─────────────┐ │
│  │   Popup UI   │◄────►│  Background  │◄──►│   Storage   │ │
│  │              │      │   Service    │    │   Manager   │ │
│  └──────────────┘      └──────┬───────┘    └─────────────┘ │
│                               │                              │
│                               ▼                              │
│                    ┌──────────────────┐                     │
│                    │ Content Script   │                     │
│                    │   Coordinator    │                     │
│                    └────────┬─────────┘                     │
│                             │                                │
│         ┌───────────────────┼───────────────────┐          │
│         ▼                   ▼                   ▼            │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │    Form     │   │    Field     │   │     Fill     │    │
│  │  Detector   │──►│   Analyzer   │──►│   Executor   │    │
│  └─────────────┘   └──────────────┘   └──────────────┘    │
│                             │                                │
│                             ▼                                │
│                    ┌──────────────────┐                     │
│                    │  Field Mapper    │                     │
│                    └──────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │    Web Page      │
                    │   (DOM Forms)    │
                    └──────────────────┘
```

### Technology Stack

- **Browser Extension API**: Chrome Extension Manifest V3 (compatible with Edge, Brave)
- **Content Scripts**: JavaScript injected into web pages for DOM manipulation
- **Storage**: Chrome Storage API (local storage)
- **UI Framework**: Vanilla JavaScript with Web Components for popup interface
- **Build Tool**: Webpack for bundling extension components

## Components and Interfaces

### 1. Storage Manager

Handles all data persistence operations for user profiles and domain-specific mappings.

```typescript
interface WorkExperience {
  company: string;
  position: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  location?: string;
}

interface Project {
  name: string;
  description?: string;
  role?: string;
  technologies?: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
}

interface Education {
  degree: string;
  school: string;
  graduationYear?: string;
  gpa?: string;
  major?: string;
  location?: string;
}

interface Profile {
  id: string;
  name: string;
  personal: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    linkedIn?: string;
    github?: string;
    portfolio?: string;
  };
  experiences: WorkExperience[];
  projects: Project[];
  education: Education[];
  skills: string[];
  custom: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

interface DomainMapping {
  domain: string;
  fieldMappings: Record<string, string>; // fieldSelector -> profilePath
  lastUsed: number;
}

interface StorageManager {
  saveProfile(profile: Profile): Promise<void>;
  getProfile(id: string): Promise<Profile | null>;
  getAllProfiles(): Promise<Profile[]>;
  deleteProfile(id: string): Promise<void>;
  exportProfile(id: string): Promise<string>;
  importProfile(json: string): Promise<Profile>;
  
  saveDomainMapping(mapping: DomainMapping): Promise<void>;
  getDomainMapping(domain: string): Promise<DomainMapping | null>;
}
```

### 2. Form Detector

Scans the DOM to identify forms and form fields, including dynamically added content.

```typescript
interface DetectedField {
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

interface DetectedForm {
  element: HTMLFormElement;
  fields: DetectedField[];
  selector: string;
}

enum FieldType {
  TEXT = 'text',
  EMAIL = 'email',
  TEL = 'tel',
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

interface FormDetector {
  detectForms(): DetectedForm[];
  observeDynamicForms(callback: (form: DetectedForm) => void): void;
  stopObserving(): void;
}
```

### 3. Field Analyzer

Extracts metadata from form fields to enable intelligent matching.

```typescript
interface FieldAnalysis {
  field: DetectedField;
  keywords: string[];
  context: string;
  confidence: number;
  suggestedProfilePath?: string;
}

interface FieldAnalyzer {
  analyzeField(field: DetectedField): FieldAnalysis;
  extractKeywords(field: DetectedField): string[];
  getFieldContext(element: HTMLElement): string;
}
```

### 4. Field Mapper

Maps detected form fields to user profile data using keyword matching and confidence scoring.

```typescript
interface FieldMapping {
  field: DetectedField;
  profilePath: string;
  confidence: number;
  value: any;
}

interface FieldMapper {
  mapFields(
    fields: DetectedField[],
    profile: Profile,
    domainMapping?: DomainMapping
  ): FieldMapping[];
  
  calculateConfidence(
    fieldAnalysis: FieldAnalysis,
    profilePath: string
  ): number;
  
  findBestMatch(
    fieldAnalysis: FieldAnalysis,
    profile: Profile
  ): { path: string; confidence: number } | null;
}
```

### 5. Fill Executor

Executes the actual form filling by setting field values and triggering appropriate events.

```typescript
interface FillResult {
  field: DetectedField;
  success: boolean;
  error?: string;
}

interface FillSummary {
  totalFields: number;
  filledFields: number;
  skippedFields: number;
  failedFields: number;
  results: FillResult[];
}

interface FillExecutor {
  fillField(field: DetectedField, value: any): Promise<FillResult>;
  fillForm(mappings: FieldMapping[]): Promise<FillSummary>;
  verifyFieldValue(field: DetectedField, expectedValue: any): boolean;
}
```

### 6. Content Script Coordinator

Orchestrates the form detection, analysis, mapping, and filling process within web pages.

```typescript
interface ContentScriptCoordinator {
  initialize(): void;
  detectAndAnalyzeForms(): DetectedForm[];
  executeAutofill(profileId: string): Promise<FillSummary>;
  highlightFilledFields(results: FillResult[]): void;
  clearHighlights(): void;
}
```

### 7. Background Service

Coordinates communication between popup UI and content scripts, manages state.

```typescript
interface BackgroundService {
  handleAutofillRequest(tabId: number, profileId: string): Promise<FillSummary>;
  getActiveProfile(): Promise<Profile | null>;
  setActiveProfile(profileId: string): Promise<void>;
}
```

### 8. Popup UI

Provides user interface for profile management, autofill triggering, and settings.

```typescript
interface PopupUI {
  renderProfileList(profiles: Profile[]): void;
  renderAutofillButton(enabled: boolean): void;
  showFillSummary(summary: FillSummary): void;
  showFieldMappings(mappings: FieldMapping[]): void;
}
```

## Data Models

### Profile Storage Schema

Profiles are stored in Chrome local storage with the key pattern `profile:{id}`.

```json
{
  "profile:uuid-1234": {
    "id": "uuid-1234",
    "name": "Job Applications",
    "personal": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "linkedIn": "https://linkedin.com/in/johndoe",
      "github": "https://github.com/johndoe"
    },
    "experiences": [
      {
        "company": "Tech Corp",
        "position": "Senior Software Engineer",
        "startDate": "2020-01",
        "endDate": "2023-12",
        "current": false,
        "description": "Led development of microservices architecture",
        "location": "San Francisco, CA"
      },
      {
        "company": "StartupXYZ",
        "position": "Software Engineer",
        "startDate": "2018-06",
        "endDate": "2020-01",
        "description": "Full-stack development with React and Node.js"
      }
    ],
    "projects": [
      {
        "name": "Open Source Library",
        "description": "A popular JavaScript utility library",
        "role": "Creator and Maintainer",
        "technologies": ["TypeScript", "Jest", "Webpack"],
        "url": "https://github.com/johndoe/library"
      }
    ],
    "education": [
      {
        "degree": "Bachelor of Science in Computer Science",
        "school": "University of Technology",
        "graduationYear": "2018",
        "gpa": "3.8",
        "major": "Computer Science"
      }
    ],
    "skills": [
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "Python",
      "AWS",
      "Docker",
      "Kubernetes"
    ],
    "custom": {
      "coverLetter": "I am passionate about..."
    },
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

### Domain Mapping Schema

Domain-specific mappings stored with key pattern `domain:{hostname}`.

```json
{
  "domain:example.com": {
    "domain": "example.com",
    "fieldMappings": {
      "#firstName": "personal.firstName",
      "#email-input": "personal.email"
    },
    "lastUsed": 1234567890
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Profile Management Properties

Property 1: Profile data persistence
*For any* profile with valid data in all categories (personal, experiences, projects, education, skills, custom), creating and then retrieving the profile should return a profile with the same data and proper category structure.
**Validates: Requirements 1.1, 1.4**

Property 2: Profile update persistence
*For any* existing profile and any valid field update, updating the profile and then retrieving it should reflect the updated values.
**Validates: Requirements 1.2**

Property 3: Multiple profile retrieval
*For any* set of profiles created, retrieving all profiles should return exactly the same number of profiles with matching IDs.
**Validates: Requirements 1.3**

Property 4: Profile serialization round-trip
*For any* valid profile, exporting it to JSON and then importing it should produce an equivalent profile with the same data.
**Validates: Requirements 1.5**

Property 5: Profile deletion completeness
*For any* profile that exists in storage, deleting it and then attempting to retrieve it should return null or undefined.
**Validates: Requirements 6.3**

### Form Detection Properties

Property 6: Complete form detection
*For any* HTML document containing form elements, the form detector should identify all form elements present in the DOM.
**Validates: Requirements 2.1**

Property 7: Field attribute extraction
*For any* form field with attributes (name, id, label, placeholder, type), analyzing the field should extract all present attributes correctly.
**Validates: Requirements 2.2**

Property 8: Multiple form independence
*For any* page with N forms, the detector should identify exactly N distinct forms with non-overlapping field sets.
**Validates: Requirements 2.3**

Property 9: Field type classification
*For any* form field element, the classifier should assign it to exactly one valid FieldType enum value based on its HTML type and tag.
**Validates: Requirements 2.5**

### Field Mapping Properties

Property 10: Deterministic field matching
*For any* form field and profile, running the matching algorithm multiple times should always produce the same profile path and confidence score.
**Validates: Requirements 3.1, 3.2**

Property 11: Low confidence rejection
*For any* field that has no profile path match with confidence above the threshold, the mapping should either be null or marked as skipped.
**Validates: Requirements 3.3**

Property 12: Case-insensitive matching
*For any* field name and profile path that differ only in letter casing, the matching algorithm should treat them as equivalent.
**Validates: Requirements 3.4**

Property 13: Domain mapping persistence
*For any* domain and custom field mappings, saving the mapping and then retrieving it for that domain should return the same mappings.
**Validates: Requirements 3.5**

### Form Filling Properties

Property 14: Mapped field population
*For any* set of field mappings with valid profile data, executing the fill operation should result in each mapped field's value matching its corresponding profile value.
**Validates: Requirements 4.1**

Property 15: Fill event triggering
*For any* field that is filled with a value, the fill executor should dispatch input, change, and blur events on that field element.
**Validates: Requirements 4.2, 4.6**

Property 16: Select option matching
*For any* select field and profile value, filling the field should result in the option whose value or text best matches the profile value being selected.
**Validates: Requirements 4.3**

Property 17: Boolean field state
*For any* checkbox or radio field and boolean profile value, filling the field should set the checked property to match the boolean value.
**Validates: Requirements 4.4**

Property 18: Date format compliance
*For any* date field with a specified format and date profile value, the filled value should match the field's expected format.
**Validates: Requirements 4.5**

### Visual Feedback Properties

Property 19: Filled field highlighting
*For any* set of successfully filled fields, all filled fields should have the highlight indicator applied after the fill operation completes.
**Validates: Requirements 5.1**

Property 20: Preview completeness
*For any* form and profile, the preview should include entries for all fields that would be filled, with their source profile paths.
**Validates: Requirements 5.4**

### Complex Field Handling Properties

Property 21: Multi-select completeness
*For any* multi-select field and array profile value, filling the field should result in all options matching array elements being selected.
**Validates: Requirements 7.1**

Property 22: File input skipping
*For any* form containing file input fields, those fields should be marked as skipped and not have values set during autofill.
**Validates: Requirements 7.2**

Property 23: Pattern validation compliance
*For any* field with a validation pattern attribute, the fill executor should only fill the field if the profile value matches the pattern.
**Validates: Requirements 7.3**

Property 24: Disabled field skipping
*For any* field that is disabled or readonly, the fill executor should skip the field and mark it as skipped in the results.
**Validates: Requirements 7.4**

### Mapping Management Properties

Property 25: Mapping data completeness
*For any* detected form, the mapping view should include entries for all detected fields with their proposed or current mappings.
**Validates: Requirements 8.1**

Property 26: Mapping update reflection
*For any* field mapping that is changed, the updated mapping should be immediately reflected in the current form's mapping data structure.
**Validates: Requirements 8.2**

Property 27: Custom field usability
*For any* custom profile field, it should be possible to create a mapping from any form field to that custom field path.
**Validates: Requirements 8.4**

Property 28: Domain-specific scope
*For any* domain-specific setting, applying it should only affect forms whose domain matches the setting's domain.
**Validates: Requirements 8.5**

### Reliability Properties

Property 29: Standard form compatibility
*For any* form using standard HTML input, select, and textarea elements, all compatible fields should be successfully detected and fillable.
**Validates: Requirements 9.1**

Property 30: Partial failure resilience
*For any* fill operation where one field fails, the remaining fields should still be processed and filled if possible.
**Validates: Requirements 9.4**

### Feedback Properties

Property 31: Summary accuracy
*For any* completed fill operation, the summary should report counts (filled, skipped, failed) that sum to the total number of detected fields.
**Validates: Requirements 10.2**

Property 32: Failure reason provision
*For any* field that fails to fill, the result should include a non-empty error message explaining the failure reason.
**Validates: Requirements 10.3**

## Error Handling

### Storage Errors

- **Quota Exceeded**: When local storage quota is exceeded, display error message and suggest deleting unused profiles
- **Corrupted Data**: When profile data cannot be parsed, log error and skip the corrupted profile
- **Concurrent Modifications**: Use timestamps to detect conflicts and prefer most recent update

### Form Detection Errors

- **Invalid DOM**: When DOM structure is malformed, log warning and continue with detected elements
- **Missing Elements**: When form elements are removed during processing, skip gracefully
- **Shadow DOM**: Attempt to pierce shadow DOM boundaries, fall back to visible elements only

### Fill Execution Errors

- **Element Not Interactable**: When element cannot be filled (hidden, disabled), mark as skipped
- **Value Rejected**: When set value doesn't persist, retry with different approach (events, native setter)
- **Validation Failure**: When filled value fails form validation, include validation message in error
- **Timeout**: When fill operation takes too long, abort and report partial results

### Mapping Errors

- **Ambiguous Match**: When multiple fields match equally, prefer first occurrence or ask user
- **No Match Found**: When no confident match exists, leave field empty
- **Invalid Profile Path**: When profile path doesn't exist, log error and skip field

## Testing Strategy

### Unit Testing

The system will use **Vitest** as the testing framework for unit tests. Unit tests will cover:

- **Storage Manager**: Test CRUD operations for profiles and domain mappings
- **Field Analyzer**: Test keyword extraction and context analysis with specific examples
- **Field Mapper**: Test confidence scoring algorithm with known field/profile pairs
- **Fill Executor**: Test value setting for each field type (text, select, checkbox, etc.)
- **Form Detector**: Test form and field detection with sample HTML structures

Unit tests will focus on specific examples and edge cases such as:
- Empty profile data
- Malformed HTML
- Missing attributes
- Special characters in field values
- Boundary values for confidence scores

### Property-Based Testing

The system will use **fast-check** as the property-based testing library for JavaScript/TypeScript. Property-based tests will verify universal properties across randomly generated inputs.

**Configuration**: Each property-based test will run a minimum of 100 iterations to ensure thorough coverage of the input space.

**Tagging**: Each property-based test will include a comment tag in this exact format:
```typescript
// Feature: form-autofill, Property {number}: {property_text}
```

**Implementation**: Each correctness property listed above will be implemented by a SINGLE property-based test that verifies the property holds across all generated inputs.

**Generators**: Custom generators will be created for:
- Random profiles with varying field populations
- Random HTML forms with different field types and attributes
- Random field mappings with varying confidence scores
- Random DOM structures with nested forms

Property-based tests will verify:
- Profile round-trip properties (create/retrieve, export/import)
- Form detection completeness across varied HTML structures
- Mapping determinism and consistency
- Fill operation correctness across field types
- Error handling resilience with invalid inputs

### Integration Testing

Integration tests will verify:
- End-to-end autofill flow from detection to fill completion
- Communication between content script and background service
- Storage operations with actual Chrome Storage API (mocked)
- DOM manipulation and event triggering in simulated browser environment

### Browser Testing

Manual testing will be performed on:
- Chrome, Edge, Brave (Chromium-based browsers)
- Real-world websites with various form implementations
- Dynamic forms with JavaScript frameworks (React, Vue, Angular)
- Forms with complex validation and custom components

## Performance Considerations

### Form Detection

- Use efficient DOM queries with specific selectors
- Debounce mutation observer callbacks to avoid excessive processing
- Cache detected forms to avoid re-scanning unchanged DOM

### Field Mapping

- Pre-compute keyword sets for profile fields
- Use memoization for confidence score calculations
- Limit matching algorithm to reasonable field count (< 100 fields)

### Fill Execution

- Batch DOM updates to minimize reflows
- Use requestAnimationFrame for visual updates
- Implement timeout limits for slow operations (5 seconds max)

### Storage

- Compress large profile data before storage
- Implement lazy loading for profile list
- Clean up old domain mappings periodically (> 90 days unused)

## Security Considerations

### Data Privacy

- All data stored locally in browser storage only
- No network requests to external servers
- No telemetry or analytics collection
- Clear data export warnings about sensitive information

### Content Script Isolation

- Minimize permissions requested in manifest
- Isolate content script from page JavaScript context
- Validate all data from web pages before processing
- Sanitize values before filling to prevent XSS

### Storage Security

- Use Chrome Storage API (not localStorage) for better isolation
- Implement data validation on read to detect tampering
- Provide clear uninstall instructions for data removal

## Extension Manifest

```json
{
  "manifest_version": 3,
  "name": "Form Autofill Assistant",
  "version": "1.0.0",
  "description": "Automatically fill repetitive online forms with saved profiles",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

## Future Enhancements

- **Cloud Sync**: Optional encrypted cloud backup of profiles
- **Template System**: Pre-built profile templates for common use cases
- **Smart Learning**: ML-based field matching improvement over time
- **Form Analytics**: Track which forms are filled most often
- **Multi-language Support**: Internationalization for UI and field matching
- **Mobile Support**: Firefox Mobile extension support
- **Password Integration**: Integration with browser password manager
- **OCR Support**: Extract data from images/PDFs for profile creation

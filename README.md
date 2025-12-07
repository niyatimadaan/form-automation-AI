# Form Autofill Assistant

A browser extension that automatically fills repetitive online forms with saved profiles. Features optional AI-powered form classification and answer generation.

## Features

- **Smart Form Detection**: Detects traditional forms, Google Forms, and custom form implementations
- **AI-Powered Classification** (Optional): Uses Azure OpenAI or Hugging Face to understand form purposes
- **Intelligent Answer Matching** (Optional): AI generates contextual answers from your profile
- **Profile Management**: Store multiple profiles with personal info, work experience, education, and skills
- **One-Click Autofill**: Fill forms instantly with saved profiles
- **Domain Memory**: Remembers field mappings for specific websites
- **Privacy-Focused**: All data stored locally in your browser

## Quick AI Setup (Optional)

The extension works great without AI, but adding AI enables intelligent form understanding and answer generation.

**Choose one:**
- **Azure OpenAI** (fast, paid) - Set `$env:AZURE_API_KEY = "your-key"`
- **Hugging Face** (free, slower) - Set `$env:HUGGINGFACE_API_KEY = "your-token"`

See [AI_SETUP.md](AI_SETUP.md) for detailed setup instructions.

## Development

### Install Dependencies

```bash
npm install
```

### Build Extension

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Load Extension in Browser

1. Build the extension: `npm run build`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist` folder

## Project Structure

```
src/
├── background/       # Background service worker
├── content/          # Content scripts for page interaction
├── popup/            # Extension popup UI
├── storage/          # Storage manager
├── detector/         # Form detection
├── analyzer/         # Field analysis
├── mapper/           # Field mapping
├── executor/         # Fill execution
└── types/            # TypeScript type definitions
```

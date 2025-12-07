// Configuration for AI services
const azureKey = process.env.AZURE_API_KEY || 'YOUR_AZURE_API_KEY_HERE';
const huggingfaceKey = process.env.HUGGINGFACE_API_KEY || 'YOUR_HUGGINGFACE_API_KEY_HERE';

// Auto-detect AI provider based on which key is configured
function detectAIProvider(): 'azure' | 'huggingface' {
  // Check environment variable first
  if (process.env.AI_PROVIDER) {
    return process.env.AI_PROVIDER as 'azure' | 'huggingface';
  }
  
  // Auto-detect based on configured keys
  const hasAzure = azureKey !== 'YOUR_AZURE_API_KEY_HERE';
  const hasHuggingface = huggingfaceKey !== 'YOUR_HUGGINGFACE_API_KEY_HERE';
  
  if (hasHuggingface && !hasAzure) {
    console.log('Using Hugging Face (detected from API key)');
    return 'huggingface';
  }
  
  if (hasAzure) {
    console.log('Using Azure OpenAI (detected from API key)');
    return 'azure';
  }
  
  // Default to Azure if neither is configured
  console.warn('No AI provider configured. Please set AZURE_API_KEY or HUGGINGFACE_API_KEY');
  return 'azure';
}

export const config = {
  // AI Provider: automatically detected or set via AI_PROVIDER env variable
  aiProvider: detectAIProvider(),
  
  azure: {
    apiKey: azureKey,
    endpoint: process.env.AZURE_ENDPOINT || '',
    deploymentName: process.env.AZURE_DEPLOYMENT_NAME || ''
  },
  
  huggingface: {
    apiKey: huggingfaceKey,
    model: process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2',
    endpoint: 'https://api-inference.huggingface.co/models/'
  },
  
  classification: {
    enabled: true, // Set to false to disable AI classification
    temperature: 0.3,
    maxTokens: 300,
    timeoutMs: 10000
  },
  
  answerMatching: {
    enabled: true, // Set to false to disable AI-powered answer matching
    temperature: 0.2,
    maxTokens: 150,
    timeoutMs: 8000,
    confidenceThreshold: 0.6
  }
};

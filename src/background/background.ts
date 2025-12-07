import { StorageManager } from '../storage/StorageManager';
import { Profile } from '../types/profile';

const storageManager = new StorageManager();
let activeProfileId: string | null = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_ACTIVE_PROFILE') {
    handleGetActiveProfile().then(sendResponse);
    return true;
  }
  
  if (message.type === 'SET_ACTIVE_PROFILE') {
    activeProfileId = message.profileId;
    sendResponse({ success: true });
  }
  
  if (message.type === 'TRIGGER_AUTOFILL') {
    handleAutofillRequest(message.profileId).then(sendResponse);
    return true;
  }
});

async function handleGetActiveProfile() {
  if (!activeProfileId) {
    return { success: false, error: 'No active profile' };
  }
  
  const profile = await storageManager.getProfile(activeProfileId);
  return { success: true, profile };
}

async function handleAutofillRequest(profileId: string) {
  try {
    const profile = await storageManager.getProfile(profileId);
    
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) {
      return { success: false, error: 'No active tab' };
    }
    
    // Check if the page is a restricted URL
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
      return { success: false, error: 'Cannot autofill on browser system pages' };
    }
    
    // Try to inject the content script if it's not already loaded
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (injectionError) {
      // Content script might already be injected, which is fine
      console.log('Content script injection attempt:', injectionError);
    }
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXECUTE_AUTOFILL',
      profile
    });
    
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('Receiving end does not exist')) {
      return { success: false, error: 'Please refresh the page and try again' };
    }
    return { success: false, error: errorMessage };
  }
}

console.log('Form Autofill Assistant background service loaded');

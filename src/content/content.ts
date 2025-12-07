import { ContentScriptCoordinator } from './ContentScriptCoordinator';
import { FillSummary } from '../types/form';

const coordinator = new ContentScriptCoordinator();
coordinator.initialize();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXECUTE_AUTOFILL') {
    coordinator.executeAutofill(message.profile)
      .then((summary: FillSummary) => {
        sendResponse({ success: true, summary });
      })
      .catch((error: Error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.type === 'CLEAR_HIGHLIGHTS') {
    coordinator.clearHighlights();
    sendResponse({ success: true });
  }
  
  if (message.type === 'DETECT_FORMS') {
    const forms = coordinator.detectAndAnalyzeForms();
    sendResponse({ success: true, formCount: forms.length });
  }
});

/**
 * Script to initialize Niyati's profile in Chrome storage
 * Run this in the browser console after loading the extension
 */

import { StorageManager } from '../storage/StorageManager';
import { createDefaultProfile } from '../data/niyati-profile';

async function initializeNiyatiProfile() {
  const storage = new StorageManager();
  const profile = createDefaultProfile();
  
  try {
    await storage.saveProfile(profile);
    console.log('✅ Default profile has been successfully saved!');
    console.log('Profile ID:', profile.id);
    console.log('Profile Name:', profile.name);
    
    // Verify it was saved
    const savedProfile = await storage.getProfile(profile.id);
    if (savedProfile) {
      console.log('✅ Profile verified in storage');
      console.log('Total experiences:', savedProfile.experiences.length);
      console.log('Total projects:', savedProfile.projects.length);
      console.log('Total skills:', savedProfile.skills.length);
    }
  } catch (error) {
    console.error('❌ Error saving profile:', error);
  }
}

// Export for use in browser console
(window as any).initializeNiyatiProfile = initializeNiyatiProfile;

console.log('To initialize Niyati\'s profile, run: initializeNiyatiProfile()');

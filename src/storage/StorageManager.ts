import { Profile, DomainMapping } from '../types/profile';

export class StorageManager {
  private readonly PROFILE_PREFIX = 'profile:';
  private readonly DOMAIN_PREFIX = 'domain:';

  async saveProfile(profile: Profile): Promise<void> {
    try {
      const key = `${this.PROFILE_PREFIX}${profile.id}`;
      await chrome.storage.local.set({ [key]: profile });
    } catch (error) {
      if (error instanceof Error && error.message.includes('QUOTA_BYTES')) {
        throw new Error('Storage quota exceeded. Please delete unused profiles.');
      }
      throw error;
    }
  }

  async getProfile(id: string): Promise<Profile | null> {
    try {
      const key = `${this.PROFILE_PREFIX}${id}`;
      const result = await chrome.storage.local.get(key);
      const profile = result[key];
      
      if (profile && this.validateProfile(profile)) {
        return profile;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading profile:', error);
      return null;
    }
  }

  private validateProfile(profile: any): profile is Profile {
    return (
      profile &&
      typeof profile.id === 'string' &&
      typeof profile.name === 'string' &&
      typeof profile.personal === 'object' &&
      Array.isArray(profile.experiences) &&
      Array.isArray(profile.projects) &&
      Array.isArray(profile.education) &&
      Array.isArray(profile.skills) &&
      typeof profile.custom === 'object'
    );
  }

  async getAllProfiles(): Promise<Profile[]> {
    const allData = await chrome.storage.local.get(null);
    const profiles: Profile[] = [];
    
    for (const key in allData) {
      if (key.startsWith(this.PROFILE_PREFIX)) {
        profiles.push(allData[key]);
      }
    }
    
    return profiles;
  }

  async deleteProfile(id: string): Promise<void> {
    const key = `${this.PROFILE_PREFIX}${id}`;
    await chrome.storage.local.remove(key);
  }

  async exportProfile(id: string): Promise<string> {
    const profile = await this.getProfile(id);
    if (!profile) {
      throw new Error(`Profile with id ${id} not found`);
    }
    return JSON.stringify(profile, null, 2);
  }

  async importProfile(json: string): Promise<Profile> {
    const profile = JSON.parse(json) as Profile;
    
    if (!profile.id || !profile.name) {
      throw new Error('Invalid profile data: missing required fields');
    }
    
    await this.saveProfile(profile);
    return profile;
  }

  async saveDomainMapping(mapping: DomainMapping): Promise<void> {
    const key = `${this.DOMAIN_PREFIX}${mapping.domain}`;
    await chrome.storage.local.set({ [key]: mapping });
  }

  async getDomainMapping(domain: string): Promise<DomainMapping | null> {
    const key = `${this.DOMAIN_PREFIX}${domain}`;
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }
}

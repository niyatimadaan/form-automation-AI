import { StorageManager } from '../storage/StorageManager';
import { Profile } from '../types/profile';
import { createDefaultProfile } from '../data/niyati-profile';

const storageManager = new StorageManager();
let profiles: Profile[] = [];
let selectedProfileId: string | null = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadProfiles();
  renderUI();
});

async function loadProfiles() {
  profiles = await storageManager.getAllProfiles();
  
  // If no profiles exist, create Niyati's profile by default
  if (profiles.length === 0) {
    const defaultProfile = createDefaultProfile();
    await storageManager.saveProfile(defaultProfile);
    profiles = [defaultProfile];
    console.log('✅ Created default profile');
  }
  
  // Select first profile by default if none selected
  if (!selectedProfileId && profiles.length > 0) {
    selectedProfileId = profiles[0].id;
  }
}

function renderUI() {
  const content = document.getElementById('content')!;
  
  content.innerHTML = `
    <div class="profile-section">
      <h2>Profiles</h2>
      <select id="profileSelect" class="profile-select">
        <option value="">Select a profile...</option>
        ${profiles.map(p => `<option value="${p.id}" ${p.id === selectedProfileId ? 'selected' : ''}>${p.name}</option>`).join('')}
      </select>
      <div class="button-group">
        <button id="createProfileBtn" class="btn btn-primary">Create New</button>
        <button id="editProfileBtn" class="btn" ${!selectedProfileId ? 'disabled' : ''}>Edit</button>
        <button id="deleteProfileBtn" class="btn btn-danger" ${!selectedProfileId ? 'disabled' : ''}>Delete</button>
      </div>
    </div>
    
    <div class="autofill-section">
      <button id="autofillBtn" class="btn btn-large btn-success" ${!selectedProfileId ? 'disabled' : ''}>
        Autofill Form
      </button>
    </div>
    
    <div id="summary" class="summary"></div>
    
    <div id="profileEditor" class="profile-editor" style="display: none;">
      <h2 id="editorTitle">Create Profile</h2>
      <form id="profileForm">
        <input type="text" id="profileName" placeholder="Profile Name" required />
        
        <h3>Personal Information</h3>
        <input type="text" id="firstName" placeholder="First Name" />
        <input type="text" id="lastName" placeholder="Last Name" />
        <input type="email" id="email" placeholder="Email" />
        <input type="tel" id="phone" placeholder="Phone" />
        <input type="text" id="address" placeholder="Address" />
        <input type="text" id="city" placeholder="City" />
        <input type="text" id="state" placeholder="State" />
        <input type="text" id="zipCode" placeholder="Zip Code" />
        <input type="text" id="country" placeholder="Country" />
        <input type="url" id="linkedIn" placeholder="LinkedIn URL" />
        <input type="url" id="github" placeholder="GitHub URL" />
        <input type="url" id="portfolio" placeholder="Portfolio URL" />
        
        <div class="button-group">
          <button type="submit" class="btn btn-primary">Save</button>
          <button type="button" id="cancelBtn" class="btn">Cancel</button>
        </div>
      </form>
    </div>
  `;
  
  attachEventListeners();
}

function attachEventListeners() {
  const profileSelect = document.getElementById('profileSelect') as HTMLSelectElement;
  profileSelect.addEventListener('change', (e) => {
    selectedProfileId = (e.target as HTMLSelectElement).value || null;
    renderUI();
  });
  
  document.getElementById('createProfileBtn')?.addEventListener('click', showCreateProfile);
  document.getElementById('editProfileBtn')?.addEventListener('click', showEditProfile);
  document.getElementById('deleteProfileBtn')?.addEventListener('click', deleteProfile);
  document.getElementById('autofillBtn')?.addEventListener('click', triggerAutofill);
  document.getElementById('cancelBtn')?.addEventListener('click', hideEditor);
  document.getElementById('profileForm')?.addEventListener('submit', saveProfile);
}

function showCreateProfile() {
  const editor = document.getElementById('profileEditor')!;
  const title = document.getElementById('editorTitle')!;
  const form = document.getElementById('profileForm') as HTMLFormElement;
  
  title.textContent = 'Create Profile';
  form.reset();
  editor.style.display = 'block';
}

async function showEditProfile() {
  if (!selectedProfileId) return;
  
  const profile = await storageManager.getProfile(selectedProfileId);
  if (!profile) return;
  
  const editor = document.getElementById('profileEditor')!;
  const title = document.getElementById('editorTitle')!;
  
  title.textContent = 'Edit Profile';
  
  (document.getElementById('profileName') as HTMLInputElement).value = profile.name;
  (document.getElementById('firstName') as HTMLInputElement).value = profile.personal.firstName || '';
  (document.getElementById('lastName') as HTMLInputElement).value = profile.personal.lastName || '';
  (document.getElementById('email') as HTMLInputElement).value = profile.personal.email || '';
  (document.getElementById('phone') as HTMLInputElement).value = profile.personal.phone || '';
  (document.getElementById('address') as HTMLInputElement).value = profile.personal.address || '';
  (document.getElementById('city') as HTMLInputElement).value = profile.personal.city || '';
  (document.getElementById('state') as HTMLInputElement).value = profile.personal.state || '';
  (document.getElementById('zipCode') as HTMLInputElement).value = profile.personal.zipCode || '';
  (document.getElementById('country') as HTMLInputElement).value = profile.personal.country || '';
  (document.getElementById('linkedIn') as HTMLInputElement).value = profile.personal.linkedIn || '';
  (document.getElementById('github') as HTMLInputElement).value = profile.personal.github || '';
  (document.getElementById('portfolio') as HTMLInputElement).value = profile.personal.portfolio || '';
  
  editor.style.display = 'block';
}

function hideEditor() {
  const editor = document.getElementById('profileEditor')!;
  editor.style.display = 'none';
}

async function saveProfile(e: Event) {
  e.preventDefault();
  
  const profile: Profile = {
    id: selectedProfileId || `profile-${Date.now()}`,
    name: (document.getElementById('profileName') as HTMLInputElement).value,
    personal: {
      firstName: (document.getElementById('firstName') as HTMLInputElement).value || undefined,
      lastName: (document.getElementById('lastName') as HTMLInputElement).value || undefined,
      email: (document.getElementById('email') as HTMLInputElement).value || undefined,
      phone: (document.getElementById('phone') as HTMLInputElement).value || undefined,
      address: (document.getElementById('address') as HTMLInputElement).value || undefined,
      city: (document.getElementById('city') as HTMLInputElement).value || undefined,
      state: (document.getElementById('state') as HTMLInputElement).value || undefined,
      zipCode: (document.getElementById('zipCode') as HTMLInputElement).value || undefined,
      country: (document.getElementById('country') as HTMLInputElement).value || undefined,
      linkedIn: (document.getElementById('linkedIn') as HTMLInputElement).value || undefined,
      github: (document.getElementById('github') as HTMLInputElement).value || undefined,
      portfolio: (document.getElementById('portfolio') as HTMLInputElement).value || undefined,
    },
    experiences: [],
    projects: [],
    education: [],
    skills: [],
    custom: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  await storageManager.saveProfile(profile);
  await loadProfiles();
  selectedProfileId = profile.id;
  hideEditor();
  renderUI();
}

async function deleteProfile() {
  if (!selectedProfileId) return;
  
  if (confirm('Are you sure you want to delete this profile?')) {
    await storageManager.deleteProfile(selectedProfileId);
    selectedProfileId = null;
    await loadProfiles();
    renderUI();
  }
}

async function triggerAutofill() {
  if (!selectedProfileId) return;
  
  const summaryDiv = document.getElementById('summary')!;
  summaryDiv.innerHTML = '<p>Filling form...</p>';
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TRIGGER_AUTOFILL',
      profileId: selectedProfileId
    });
    
    if (response.success && response.summary) {
      const s = response.summary;
      summaryDiv.innerHTML = `
        <div class="summary-success">
          <p><strong>Autofill Complete!</strong></p>
          <p>Filled: ${s.filledFields} | Skipped: ${s.skippedFields} | Failed: ${s.failedFields}</p>
        </div>
      `;
    } else {
      summaryDiv.innerHTML = `<div class="summary-error">Error: ${response.error}</div>`;
    }
  } catch (error) {
    summaryDiv.innerHTML = `<div class="summary-error">Error: ${error}</div>`;
  }
}

import { Profile } from '../types/profile';

/**
 * Creates a profile from Niyati's resume data
 */
export function createDefaultProfile(): Profile {
    return {
        id: 'name-profile',
        name: 'Default User Profile',
        personal: {
            firstName: 'Default',
            lastName: 'User',
            email: 'default.user@example.com',
            phone: '+1-555-000-0000',
            address: '123 Default St',
            city: 'Default City',
            state: 'Default State',
            zipCode: '00000',
            country: 'Default Country',
            linkedIn: 'https://www.linkedin.com/in/defaultuser',
            github: 'https://github.com/defaultuser',
            portfolio: 'https://defaultuserportfolio.com'
        },
        experiences: [],
        projects: [],
        education: [],
        skills: [],
        custom: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}
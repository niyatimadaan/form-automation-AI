export interface WorkExperience {
  company: string;
  position: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
  location?: string;
}

export interface Project {
  name: string;
  description?: string;
  role?: string;
  technologies?: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
}

export interface Education {
  degree: string;
  school: string;
  graduationYear?: string;
  gpa?: string;
  major?: string;
  location?: string;
}

export interface Profile {
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

export interface DomainMapping {
  domain: string;
  fieldMappings: Record<string, string>;
  lastUsed: number;
}

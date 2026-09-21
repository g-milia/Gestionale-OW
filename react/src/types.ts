export type AccessRole = 'admin' | 'responsabile' | 'visualizzatore' | null;

export interface EventSummary {
  event_id: string;
  name: string;
  event_date: string | null;
  venue: string | null;
  athlete_total: number | null;
  updated_at: string | null;
  access_role: AccessRole;
}

export interface GlobalAccess {
  isAdmin: boolean;
  canCreate: boolean;
  canImport: boolean;
}

export interface EventAccess {
  role: AccessRole;
  canRead: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManagePermissions: boolean;
  canExport: boolean;
  canPrint: boolean;
}

export interface Departure {
  id: string;
  name: string;
  time: string;
  athletes: number | string;
  numbers: string;
  notes: string;
}

export interface TimelineItem {
  id: string;
  time: string;
  title: string;
  place: string;
  notes: string;
}

export interface Official {
  id: string;
  name: string;
  notes: string;
}

export interface RoleSubcategory {
  id: string;
  name: string;
}

export interface EventRole {
  id: string;
  name: string;
  notes?: string;
  officialIds: string[];
  officialIdsBySubcategory: Record<string, string[]>;
}

export interface RoleCategory {
  id: string;
  name: string;
  notes?: string;
  subcategories: RoleSubcategory[];
  roles: EventRole[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface EventRecord {
  id: string;
  version: number;
  createdAt: string | null;
  savedAt: string | null;
  roleSubcategoriesEnabled: boolean;
  event: {
    name: string;
    date: string;
    venue: string;
    notes: string;
    pathNotes: string;
    athleteTotal: number;
    athleteDescription: string;
    athleteDepartures: Departure[];
  };
  timeline: TimelineItem[];
  officials: Official[];
  roleCategories: RoleCategory[];
  refereeNotes: {
    briefingAthletes: string;
    briefingJury: string;
    checklist: ChecklistItem[];
  };
}

export interface PermissionRow {
  user_id: string;
  email: string;
  display_name: string | null;
  role: AccessRole;
  active: boolean;
}

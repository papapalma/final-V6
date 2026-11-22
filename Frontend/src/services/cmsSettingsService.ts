import { api } from './api';

/**
 * Comprehensive CMS Settings interface matching the backend JSONB structure
 * Supports full landing page customization: colors, typography, layout, components, content
 */
export interface CMSSettings {
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    borders?: string;
  };
  typography?: {
    headings?: {
      fontFamily?: string;
      fontSize?: { h1?: number; h2?: number; h3?: number };
      fontWeight?: number;
      lineHeight?: number;
    };
    body?: {
      fontFamily?: string;
      fontSize?: number;
      fontWeight?: number;
      lineHeight?: number;
    };
  };
  layout?: {
    containerWidth?: string;
    containerLayout?: string;
    padding?: { heroSection?: number; contentAreas?: number; footer?: number };
    margins?: { sectionSpacing?: number; elementSpacing?: number };
    gaps?: { grid?: number; flex?: number };
  };
  components?: {
    [key: string]: {
      enabled?: boolean;
      [key: string]: any;
    };
  };
  content?: {
    hero?: {
      heading?: string;
      subheading?: string;
      ctaText?: string;
    };
    missionVision?: {
      title?: string;
      description?: string;
      vision?: string;
    };
    features?: Array<{
      title?: string;
      description?: string;
      icon?: string;
      image?: string;
    }>;
    testimonials?: Array<{
      text?: string;
      author?: string;
      image?: string;
      title?: string;
    }>;
    contact?: {
      email?: string;
      phone?: string;
      address?: string;
      socialLinks?: { [key: string]: string };
    };
  };
  // Backward compatibility: support old structure
  hero?: {
    badge?: string;
    title?: string;
    subtitle?: string;
    ctaPrimary?: string;
    ctaSecondary?: string;
  };
  appearance?: {
    logo?: string;
    heroBackground?: string;
  };
  mission?: string;
  vision?: string;
  contact?: {
    address?: string;
    addressLine2?: string;
    phone?: string;
    email?: string;
    facebook?: string;
  };
  footer?: {
    companyName?: string;
    tagline?: string;
  };
}

class CMSSettingsService {
  /**
   * Get all CMS settings from the database
   * Returns comprehensive customization structure or null if not found
   */
  async getSettings(tenantId?: string): Promise<CMSSettings | null> {
    try {
      const params = tenantId ? { tenantId } : undefined;
      let response: any = null;
      try {
        response = await api.get('/cms-settings', params);
      } catch {
        response = await api.get('/landing-content', params);
      }
      if (!response?.success || !response?.data) {
        return null;
      }
      const raw = response.data as any;
      return (raw.settingsData?.content || raw.content || raw) as CMSSettings;
    } catch (error) {
      console.error('Failed to fetch CMS settings:', error);
      return null;
    }
  }

  /**
   * Update all settings in the database
   * Saves the comprehensive customization structure
   */
  async updateSettings(settings: Partial<CMSSettings>): Promise<CMSSettings> {
    const response = await api.post('/landing-content', {
      settings,
    });
    if (!response.success) {
      throw new Error(response.message || 'Failed to update settings');
    }
    return response.data as CMSSettings;
  }

  /**
   * Migrate settings from localStorage to database (one-time migration)
   */
  async migrateFromLocalStorage(): Promise<boolean> {
    try {
      const saved = localStorage.getItem('bmdc-cms-settings');
      if (!saved) {
        return false; // Nothing to migrate
      }

      const settings = JSON.parse(saved);
      await this.updateSettings(settings);

      // Mark as migrated but don't remove yet (for safety)
      localStorage.setItem('bmdc-cms-migrated', 'true');

      console.log('✅ CMS settings migrated from localStorage to database');
      return true;
    } catch (error) {
      console.error('Failed to migrate CMS settings:', error);
      return false;
    }
  }
}

export default new CMSSettingsService();

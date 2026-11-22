import api from './api';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  media_url?: string | null;
  media_type: 'image' | 'video' | 'none';
  is_published: boolean;
  expires_at?: string | null;
  tenant_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  media_url?: string | null;
  media_type?: 'image' | 'video' | 'none';
  is_published?: boolean;
  expires_at?: string | null;
}

export const announcementService = {
  /**
   * Fetch active, published announcements for the landing page
   */
  async getPublicAnnouncements(): Promise<Announcement[]> {
    try {
      const res: any = await api.get('/announcements?public=true');
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.data?.data)) return res.data.data;
      return [];
    } catch (error) {
      console.warn('Failed to load public announcements', error);
      return [];
    }
  },

  /**
   * Fetch all announcements (staff/admin view)
   */
  async getAllAnnouncements(): Promise<Announcement[]> {
    try {
      const res: any = await api.get('/announcements');
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.data)) return res.data;
      if (Array.isArray(res?.data?.data)) return res.data.data;
      return [];
    } catch (error) {
      console.warn('Failed to load all announcements', error);
      return [];
    }
  },

  /**
   * Create a new announcement
   */
  async createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
    const res: any = await api.post('/announcements', input);
    return res?.data?.data || res?.data || res;
  },

  /**
   * Update an existing announcement
   */
  async updateAnnouncement(id: string, input: Partial<CreateAnnouncementInput>): Promise<Announcement> {
    const res: any = await api.put(`/announcements/${id}`, input);
    return res?.data?.data || res?.data || res;
  },

  /**
   * Delete an announcement
   */
  async deleteAnnouncement(id: string): Promise<void> {
    await api.delete(`/announcements/${id}`);
  },
};

export default announcementService;

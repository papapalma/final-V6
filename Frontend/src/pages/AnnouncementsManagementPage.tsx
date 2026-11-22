import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Megaphone,
  Plus,
  Trash2,
  Pencil,
  Video,
  Image as ImageIcon,
  Calendar,
  Eye,
  Loader2,
  Sparkles,
  AlertCircle,
  X,
  LayoutGrid,
  TableIcon,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import announcementService, { Announcement } from '../services/announcementService';
import api, { getFileUrl } from '../services/api';
import ImageUpload from '../components/ImageUpload';

type ViewMode = 'table' | 'card';

export default function AnnouncementsManagementPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Announcement | null>(null);

  // View & Filter State
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('announcementsViewMode') as ViewMode) || 'table';
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'none'>('none');
  const [isPublished, setIsPublished] = useState(true);
  const [uploading, setUploading] = useState(false);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('announcementsViewMode', mode);
  };

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await announcementService.getAllAnnouncements();
      setAnnouncements(data);
    } catch (err: any) {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleOpenAdd = () => {
    resetForm();
    setEditingAnnouncement(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: Announcement) => {
    setEditingAnnouncement(item);
    setTitle(item.title);
    setBody(item.body);
    setExpiresAt(item.expires_at ? item.expires_at.split('T')[0] : '');
    setMediaFile(null);
    setExistingMediaUrl(item.media_url || null);
    setMediaPreview(item.media_url ? getFileUrl(item.media_url) : '');
    setMediaType(item.media_type || 'none');
    setIsPublished(item.is_published ?? true);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!body.trim()) {
      toast.error('Description is required');
      return;
    }

    try {
      setUploading(true);
      let mediaUrl: string | null = existingMediaUrl;

      if (mediaFile) {
        // Read file as base64 to match /api/upload requirement
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(mediaFile);
        });

        const uploadRes = await api.post('/upload', {
          file: base64Data,
          category: 'announcements',
          filename: mediaFile.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
        });

        if (uploadRes.success && (uploadRes.data?.filePath || uploadRes.data?.url)) {
          mediaUrl = uploadRes.data?.filePath || uploadRes.data?.url;
        } else {
          throw new Error(uploadRes.error || 'Failed to upload media file');
        }
      }

      if (editingAnnouncement) {
        await announcementService.updateAnnouncement(editingAnnouncement.id, {
          title,
          body,
          media_url: mediaUrl,
          media_type: mediaType,
          is_published: isPublished,
          expires_at: expiresAt || null,
        });
        toast.success('Announcement updated successfully');
      } else {
        await announcementService.createAnnouncement({
          title,
          body,
          media_url: mediaUrl,
          media_type: mediaType,
          is_published: isPublished,
          expires_at: expiresAt || null,
        });
        toast.success('Announcement published successfully');
      }

      setIsModalOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save announcement');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedForDelete) return;
    try {
      setIsDeleting(true);
      await announcementService.deleteAnnouncement(selectedForDelete.id);
      toast.success('Announcement deleted');
      setSelectedForDelete(null);
      fetchAnnouncements();
    } catch (err: any) {
      toast.error('Failed to delete announcement');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setExpiresAt('');
    setMediaFile(null);
    setMediaPreview('');
    setExistingMediaUrl(null);
    setMediaType('none');
    setIsPublished(true);
    setEditingAnnouncement(null);
  };

  const filteredAnnouncements = announcements.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q);
  });

  return (
    <DashboardLayout title="Announcements Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="size-6 text-primary" />
              Announcements
            </h2>
            <p className="text-sm text-muted-foreground">
              Create and manage broadcast announcements displayed on the public landing page.
            </p>
          </div>
          <Button onClick={handleOpenAdd} className="gap-2 rounded-xl">
            <Plus className="size-4" />
            New Announcement
          </Button>
        </div>

        {/* Search & View Mode Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border/60">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange('table')}
                className="h-7 px-3 text-xs rounded-lg gap-1.5 transition-all"
                title="Table View"
              >
                <TableIcon className="size-3.5" />
                <span>Table</span>
              </Button>
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleViewModeChange('card')}
                className="h-7 px-3 text-xs rounded-lg gap-1.5 transition-all"
                title="Card View"
              >
                <LayoutGrid className="size-3.5" />
                <span>Cards</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Content Section (Cards or Table) */}
        <Card className="rounded-2xl border border-border/80 shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Active & Scheduled Broadcasts</CardTitle>
                <CardDescription className="text-xs">
                  {filteredAnnouncements.length} {filteredAnnouncements.length === 1 ? 'announcement' : 'announcements'} {searchQuery ? 'found matching search' : 'in total'} • Click any announcement to edit.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="size-6 animate-spin mr-2" />
                Loading announcements...
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <Megaphone className="size-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {searchQuery ? 'No matching announcements' : 'No announcements yet'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? 'Try adjusting your search terms to find what you are looking for.'
                    : 'Click "New Announcement" above to post updates, admissions schedules, or event banners on the landing page.'}
                </p>
              </div>
            ) : viewMode === 'card' ? (
              /* Card View */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-4 sm:p-6">
                {filteredAnnouncements.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleOpenEdit(item)}
                    className="group cursor-pointer rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col active:scale-[0.99]"
                  >
                    {/* Media thumbnail */}
                    <div className="relative w-full aspect-video bg-muted/30 overflow-hidden flex items-center justify-center border-b border-border/50">
                      {item.media_type === 'image' && item.media_url ? (
                        <img
                          src={getFileUrl(item.media_url)}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : item.media_type === 'video' && item.media_url ? (
                        <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                          <video
                            src={getFileUrl(item.media_url)}
                            className="w-full h-full object-cover opacity-80"
                            preload="metadata"
                            muted
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                            <div className="size-10 rounded-full bg-black/70 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Video className="size-5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/50 py-8">
                          <Megaphone className="size-8 stroke-[1.5]" />
                          <span className="text-[10px] font-semibold tracking-wider uppercase">Text Broadcast</span>
                        </div>
                      )}

                      {/* Floating status & media badges */}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <Badge variant={item.is_published ? 'default' : 'secondary'} className="text-[10px] font-semibold shadow-sm">
                          {item.is_published ? 'Published' : 'Draft'}
                        </Badge>
                        {item.media_type === 'video' && (
                          <Badge variant="outline" className="text-[10px] bg-black/70 text-white border-white/20 backdrop-blur-md">
                            <Video className="size-2.5 mr-1" /> Video
                          </Badge>
                        )}
                        {item.media_type === 'image' && (
                          <Badge variant="outline" className="text-[10px] bg-black/70 text-white border-white/20 backdrop-blur-md">
                            <ImageIcon className="size-2.5 mr-1" /> Photo
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-foreground text-sm line-clamp-1 group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.body}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="size-3 text-muted-foreground/70" />
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          {item.expires_at && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              • Exp: {new Date(item.expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewAnnouncement(item);
                            }}
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Preview Announcement"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(item);
                            }}
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Edit Announcement"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedForDelete(item);
                            }}
                            className="size-7 text-destructive hover:bg-destructive/10"
                            title="Delete Announcement"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Table View */
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Media</TableHead>
                      <TableHead>Title & Content</TableHead>
                      <TableHead className="w-28">Status</TableHead>
                      <TableHead className="w-36">Expiry Date</TableHead>
                      <TableHead className="w-32">Posted</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnnouncements.map((item) => (
                      <TableRow
                        key={item.id}
                        onClick={() => handleOpenEdit(item)}
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                        title="Click to edit announcement"
                      >
                        <TableCell>
                          {item.media_type === 'image' && item.media_url ? (
                            <img
                              src={getFileUrl(item.media_url)}
                              alt={item.title}
                              className="size-12 rounded-lg object-cover border"
                            />
                          ) : item.media_type === 'video' ? (
                            <div className="size-12 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center border">
                              <Video className="size-5" />
                            </div>
                          ) : (
                            <div className="size-12 rounded-lg bg-muted text-muted-foreground flex items-center justify-center border">
                              <Megaphone className="size-5" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="font-semibold text-sm text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.body}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.is_published ? 'default' : 'secondary'} className="text-[10px] font-semibold">
                            {item.is_published ? 'Published' : 'Draft'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.expires_at ? new Date(item.expires_at).toLocaleDateString() : 'No expiry'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewAnnouncement(item);
                              }}
                              className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Preview Announcement"
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(item);
                              }}
                              className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Edit Announcement"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedForDelete(item);
                              }}
                              className="size-8 text-destructive hover:bg-destructive/10"
                              title="Delete Announcement"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Announcement Dialog with strict size constraint */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="sm:max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl"
          style={{ maxWidth: '580px', maxHeight: '88vh' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-5 text-primary" />
              {editingAnnouncement ? 'Edit Announcement' : 'Publish Announcement'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingAnnouncement
                ? 'Update broadcast details, change or remove attachments, and manage expiry.'
                : 'Broadcast an announcement to visitors and trainees on the front page.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Title *</label>
              <Input
                placeholder="e.g., Free Assessment Slots Open for NC II Courses"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Message / Details *</label>
              <Textarea
                rows={4}
                placeholder="Write the full announcement description..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            {/* Media Attachment using shared ImageUpload component */}
            <div className="space-y-1">
              <ImageUpload
                value={mediaPreview || (existingMediaUrl ? getFileUrl(existingMediaUrl) : '')}
                onChange={(val) => {
                  setMediaPreview(val);
                  if (!val) {
                    setExistingMediaUrl(null);
                    setMediaFile(null);
                    setMediaType('none');
                  }
                }}
                onFileChange={(file) => {
                  setMediaFile(file);
                  if (file) {
                    const isVid = file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name);
                    setMediaType(isVid ? 'video' : 'image');
                  } else {
                    setMediaType('none');
                  }
                }}
                label="Media Attachment (Photo or Video)"
                description="Upload an image (PNG, JPG, WebP ≤ 5MB) or video (MP4, WebM ≤ 50MB)"
                allowVideo
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0 pt-1">
              <div className="space-y-1 min-w-0">
                <label className="text-xs font-semibold text-foreground">Expiration Date (Optional)</label>
                <Input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="text-xs w-full"
                />
                <span className="text-[10px] text-muted-foreground block">Hides automatically after this date</span>
              </div>

              <div className="space-y-1 min-w-0">
                <label className="text-xs font-semibold text-foreground">Visibility Status</label>
                <div className="flex items-center justify-between p-2 rounded-xl border border-border bg-muted/10 h-9">
                  <span className="text-[11px] text-muted-foreground truncate mr-2">
                    {isPublished ? 'Visible on front page' : 'Draft only (hidden)'}
                  </span>
                  <Button
                    type="button"
                    variant={isPublished ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setIsPublished(!isPublished)}
                    className="h-7 text-xs font-medium px-3 shrink-0"
                  >
                    {isPublished ? 'Published' : 'Draft'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={uploading} className="gap-2">
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editingAnnouncement ? 'Save Changes' : 'Publish Announcement'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!selectedForDelete} onOpenChange={(open) => !open && setSelectedForDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedForDelete?.title}"? It will immediately disappear from the landing page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Modal */}
      <Dialog open={!!previewAnnouncement} onOpenChange={(open) => !open && setPreviewAnnouncement(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-3xl p-6 sm:max-w-2xl sm:p-8">
          {previewAnnouncement && (
            <div className="space-y-6">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="px-3 py-1 text-xs font-semibold border-primary/30 text-primary bg-primary/5 flex items-center gap-1.5">
                    <Megaphone className="size-3.5 text-primary" />
                    Preview Mode
                  </Badge>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium bg-muted/50 px-2.5 py-1 rounded-full">
                    <Calendar className="size-3 text-primary" />
                    {new Date(previewAnnouncement.created_at).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-snug">
                  {previewAnnouncement.title}
                </DialogTitle>
              </div>

              {previewAnnouncement.media_url && (
                <div
                  className="w-full rounded-2xl overflow-hidden bg-black/5 dark:bg-black/40 border border-border/70 flex items-center justify-center shadow-inner"
                  style={{ maxHeight: '360px' }}
                >
                  {previewAnnouncement.media_type === 'video' ? (
                    <video
                      src={getFileUrl(previewAnnouncement.media_url)}
                      controls
                      playsInline
                      className="w-full max-h-[360px] object-contain rounded-2xl"
                    />
                  ) : (
                    <img
                      src={getFileUrl(previewAnnouncement.media_url)}
                      alt={previewAnnouncement.title}
                      className="w-full max-h-[360px] object-contain rounded-2xl"
                    />
                  )}
                </div>
              )}

              <div className="space-y-3">
                <p className="text-sm sm:text-base text-foreground/90 leading-relaxed whitespace-pre-line font-normal">
                  {previewAnnouncement.body}
                </p>
              </div>

              <div className="pt-4 border-t border-border/60 flex items-center justify-between gap-4">
                <span className="text-xs text-muted-foreground">
                  Status: <strong className="text-foreground">{previewAnnouncement.is_published ? 'Published' : 'Draft'}</strong>
                  {previewAnnouncement.expires_at ? ` • Expires on ${new Date(previewAnnouncement.expires_at).toLocaleDateString()}` : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewAnnouncement(null)}
                  className="rounded-xl px-4 h-9 font-medium"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

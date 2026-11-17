import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Edit2, Save, X, Award, CheckCircle2, BookOpen, Camera, Settings, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isStandalone, canInstallPWA, promptPWAInstall, getInstallInstructions } from '../utils/pwa';
import { getFileUrl } from '../services/api';
import { uploadTraineePhoto } from '../utils/fileUpload';
import { toast } from 'sonner';
import traineeService from '../services/traineeService';
import certificateService, { Certificate } from '../services/certificateService';
import CertificateViewer from '../components/CertificateViewer';
import { DashboardSkeletonLoader } from '../components/LoadingSkeletons';
import logger from '../utils/logger';
import { TraineeStatusCard } from '../components/trainee/TraineeStatusCard';
import TraineeStatusModal from '../components/TraineeStatusModal';
import { useTraineeStatus } from '../hooks/useTraineeStatus';
import type { TraineeStatusRecord as ServiceTraineeStatusRecord } from '../services/traineeStatusService';

interface TraineeProfile {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  phone: string;
  address: string;
  birth_date: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  photo_path?: string;
  program_id?: string;
  status: string;
  enrollment_date: string;
  program?: {
    id: string;
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
  };
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  date_earned: string;
  type: 'certificate' | 'badge' | 'completion';
}

export default function TraineeProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [traineeProfile, setTraineeProfile] = useState<TraineeProfile | null>(null);
  const [editForm, setEditForm] = useState<Partial<TraineeProfile>>({});
  const [achievements] = useState<Achievement[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { record: statusRecord, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useTraineeStatus(
    traineeProfile?.program_id ? `${traineeProfile.program_id}-${traineeProfile.id}` : undefined
  );

  useEffect(() => {
    traineeService.clearProfileCache?.();
    loadProfileData();
    loadCertificates();
  }, [user]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const profile = await traineeService.getMyProfile();
      const address = `${profile.street}, ${profile.barangay}, ${profile.municipality}, ${profile.province}`;
      const profileData: TraineeProfile = {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        middle_name: profile.middle_name,
        email: profile.email,
        phone: profile.phone,
        address: address,
        birth_date: profile.birth_date,
        emergency_contact_name: profile.emergency_contact_name ?? '',
        emergency_contact_phone: profile.emergency_contact_phone ?? '',
        photo_path: profile.photo_path || '',
        program_id: profile.program_id,
        status: profile.status,
        enrollment_date: profile.enrollment_date,
        program: (profile as any).program || undefined
      };
      setTraineeProfile(profileData);
      setEditForm(profileData);
    } catch (error: any) {
      logger.error('Failed to load profile data', { error });
      toast.error(error?.message || 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const loadCertificates = async () => {
    try {
      setLoadingCertificates(true);
      const certs = await certificateService.getMyCertificates();
      setCertificates(certs);
    } catch (error: any) {
      logger.error('Failed to load certificates', { error });
    } finally {
      setLoadingCertificates(false);
    }
  };

  const handleEditToggle = () => {
    if (editing) {
      setEditForm(traineeProfile || {});
      setSelectedPhoto(null);
      setPhotoPreview(null);
    }
    setEditing(!editing);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setSelectedPhoto(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      let updateData: any = {};
      
      // Handle photo upload first if a new photo was selected
      if (selectedPhoto) {
        setUploadingPhoto(true);
        try {
          const uploadResponse = await uploadTraineePhoto(
            selectedPhoto,
            traineeProfile?.id,
            (progress) => {
              // Optional: you can show upload progress here
              logger.info('Upload progress', { progress });
            }
          );
          if (uploadResponse.success && uploadResponse.filePath) {
            updateData.photo_path = uploadResponse.filePath;
          }
        } catch (error: any) {
          logger.error('Failed to upload photo', { error });
          toast.error(error?.message || 'Failed to upload photo');
          setSaving(false);
          setUploadingPhoto(false);
          return;
        } finally {
          setUploadingPhoto(false);
        }
      }
      
      if (editForm.phone !== traineeProfile?.phone) {
        updateData.phone = editForm.phone;
      }
      if (editForm.address !== traineeProfile?.address && editForm.address) {
        const parts = editForm.address.split(',').map(p => p.trim());
        if (parts.length >= 4) {
          updateData.street = parts[0];
          updateData.barangay = parts[1];
          updateData.municipality = parts[2];
          updateData.province = parts[3];
        }
      }
      if (editForm.emergency_contact_name !== traineeProfile?.emergency_contact_name) {
        updateData.emergency_contact_name = editForm.emergency_contact_name ?? null;
      }
      if (editForm.emergency_contact_phone !== traineeProfile?.emergency_contact_phone) {
        updateData.emergency_contact_phone = editForm.emergency_contact_phone ?? null;
      }
      
      if (Object.keys(updateData).length === 0) {
        toast.info('No changes to save');
        setEditing(false);
        return;
      }
      
      await traineeService.updateMyProfile(updateData);
      await loadProfileData();
      setEditing(false);
      setSelectedPhoto(null);
      setPhotoPreview(null);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      logger.error('Failed to save profile', { error });
      toast.error(error?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getAchievementIcon = (type: string) => {
    switch (type) {
      case 'certificate':
        return <Award className="size-5 text-yellow-500" />;
      case 'badge':
        return <CheckCircle2 className="size-5 text-green-500" />;
      case 'completion':
        return <BookOpen className="size-5 text-blue-500" />;
      default:
        return <Award className="size-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Profile">
        <DashboardSkeletonLoader />
      </DashboardLayout>
    );
  }

  const modalStatusRecord: ServiceTraineeStatusRecord | undefined = statusRecord
    ? {
        id: statusRecord.id,
        tenant_id: statusRecord.tenantId,
        trainee_id: statusRecord.traineeId,
        enrollment_id: statusRecord.enrollmentId,
        graduation_status: statusRecord.graduationStatus,
        graduation_date: statusRecord.graduationDate,
        certificate_id: statusRecord.certificateId,
        employment_status: statusRecord.employmentStatus,
        job_title: statusRecord.jobTitle,
        employer_name: statusRecord.employerName,
        job_start_date: statusRecord.jobStartDate,
        job_sector: statusRecord.jobSector,
        skills_match: statusRecord.skillsMatch,
        skills_match_percentage: statusRecord.skillsMatchPercentage,
        remarks: statusRecord.remarks,
        unemployment_reason: statusRecord.unemploymentReason,
        recorded_by: statusRecord.recordedBy,
        recorded_at: statusRecord.recordedAt,
        last_updated_by: statusRecord.lastUpdatedBy,
        updated_at: statusRecord.updatedAt,
        deleted_at: statusRecord.deletedAt,
      }
    : undefined;

  return (
    <DashboardLayout title="Profile">
      <main className="w-full">
        <div className="space-y-6">
          {/* HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 sm:gap-10">
            <div className="flex items-start gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-gray-200 dark:border-gray-700">
                  <AvatarImage 
                    src={
                      photoPreview || 
                      (traineeProfile?.photo_path ? getFileUrl(traineeProfile.photo_path) : '')
                    } 
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                    {traineeProfile?.first_name?.[0]}{traineeProfile?.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                {editing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full cursor-pointer group hover:bg-black/60 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label 
                      htmlFor="photo-upload" 
                      className="cursor-pointer flex flex-col items-center justify-center w-full h-full"
                    >
                      <Camera className="h-8 w-8 text-white mb-1" />
                      <span className="text-[10px] text-white font-medium">Change</span>
                    </label>
                  </div>
                )}
                {editing && selectedPhoto && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                    onClick={handleRemovePhoto}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  {traineeProfile?.first_name} {traineeProfile?.last_name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">{traineeProfile?.program?.name || 'Trainee'}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant={traineeProfile?.status === 'active' ? 'default' : 'secondary'}>
                    {traineeProfile?.status === 'active' ? 'Active' : traineeProfile?.status}
                  </Badge>
                  <Badge variant="outline">Joined {formatDate(traineeProfile?.enrollment_date || '')}</Badge>
                </div>
              </div>
            </div>

            {/* BUTTONS */}
            <div className="flex flex-wrap gap-3">
              <Link to="/settings">
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
              {!editing && (
                <Button onClick={handleEditToggle}>
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
              )}
              {editing && (
                <>
                  <Button variant="outline" onClick={handleEditToggle} disabled={saving || uploadingPhoto}>
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveProfile} disabled={saving || uploadingPhoto}>
                    {(saving || uploadingPhoto) ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-transparent border-t-white rounded-full mr-2" />
                        {uploadingPhoto ? 'Uploading...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* CONTENT TABS */}
          <Tabs defaultValue="personal" className="w-full">
            <TabsList className="grid w-full grid-cols-5 max-w-lg">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
              <TabsTrigger value="certificates">Certs</TabsTrigger>
              <TabsTrigger value="achievements">Awards</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* PERSONAL TAB */}
            <TabsContent value="personal" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">First Name</Label>
                      {editing ? (
                        <Input value={editForm.first_name || ''} onChange={(e) => handleInputChange('first_name', e.target.value)} />
                      ) : (
                        <div className="py-2 px-3 bg-gray-100 dark:bg-gray-900 rounded text-sm">{traineeProfile?.first_name}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Last Name</Label>
                      {editing ? (
                        <Input value={editForm.last_name || ''} onChange={(e) => handleInputChange('last_name', e.target.value)} />
                      ) : (
                        <div className="py-2 px-3 bg-gray-100 dark:bg-gray-900 rounded text-sm">{traineeProfile?.last_name}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Middle Name</Label>
                      {editing ? (
                        <Input value={editForm.middle_name || ''} onChange={(e) => handleInputChange('middle_name', e.target.value)} />
                      ) : (
                        <div className="py-2 px-3 bg-gray-100 dark:bg-gray-900 rounded text-sm">{traineeProfile?.middle_name || '—'}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Birth Date</Label>
                      {editing ? (
                        <Input type="date" value={editForm.birth_date || ''} onChange={(e) => handleInputChange('birth_date', e.target.value)} />
                      ) : (
                        <div className="py-2 px-3 bg-gray-100 dark:bg-gray-900 rounded text-sm">{traineeProfile?.birth_date ? formatDate(traineeProfile.birth_date) : '—'}</div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Address</Label>
                    {editing ? (
                      <Input value={editForm.address || ''} onChange={(e) => handleInputChange('address', e.target.value)} placeholder="Street, Barangay, Municipality, Province" />
                    ) : (
                      <div className="py-2 px-3 bg-gray-100 dark:bg-gray-900 rounded text-sm">{traineeProfile?.address || '—'}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CONTACT TAB */}
            <TabsContent value="contact" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Email Address</Label>
                      <div className="py-2 px-3 bg-gray-100 dark:bg-gray-900 rounded text-sm">{traineeProfile?.email}</div>
                      <p className="text-xs text-gray-500">Cannot be changed</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Phone Number</Label>
                      {editing ? (
                        <Input value={editForm.phone || ''} onChange={(e) => handleInputChange('phone', e.target.value)} />
                      ) : (
                        <div className="py-2 px-3 bg-gray-100 dark:bg-gray-900 rounded text-sm">{traineeProfile?.phone || '—'}</div>
                      )}
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <h4 className="font-semibold text-base">Emergency Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Contact Name</Label>
                      {editing ? (
                        <Input value={editForm.emergency_contact_name || ''} onChange={(e) => handleInputChange('emergency_contact_name', e.target.value)} />
                      ) : (
                        <div className="py-2 px-3 bg-gray-100 dark:bg-gray-900 rounded text-sm">{traineeProfile?.emergency_contact_name || '—'}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Contact Phone</Label>
                      {editing ? (
                        <Input value={editForm.emergency_contact_phone || ''} onChange={(e) => handleInputChange('emergency_contact_phone', e.target.value)} />
                      ) : (
                        <div className="py-2 px-3 bg-gray-100 dark:bg-gray-900 rounded text-sm">{traineeProfile?.emergency_contact_phone || '—'}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CERTIFICATES TAB */}
            <TabsContent value="certificates" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>My Certificates</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingCertificates ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin h-8 w-8 border-2 border-primary/20 border-t-primary rounded-full"></div>
                    </div>
                  ) : (
                    <CertificateViewer certificates={certificates} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ACHIEVEMENTS TAB */}
            <TabsContent value="achievements" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Achievements & Badges</CardTitle>
                </CardHeader>
                <CardContent>
                  {achievements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Award className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="font-semibold text-gray-900 dark:text-white">No achievements yet</p>
                      <p className="text-sm text-gray-500">Complete modules to earn achievements</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {achievements.map((achievement) => (
                        <div key={achievement.id} className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-800 rounded">
                          <div className="p-2 rounded bg-primary/10">{getAchievementIcon(achievement.type)}</div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <h4 className="font-semibold text-sm">{achievement.title}</h4>
                              <Badge variant="outline" className="text-xs">{achievement.type}</Badge>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{achievement.description}</p>
                            <p className="text-xs text-gray-500 mt-2">Earned on {formatDate(achievement.date_earned)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SETTINGS TAB */}
            <TabsContent value="settings" className="mt-6 space-y-6">
              <Card className="border-2 border-primary/20 shadow-sm bg-gradient-to-br from-card to-primary/5">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Download className="size-5 text-primary" />
                        Download BMDC App (PWA)
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Install on your mobile phone or desktop computer for fast offline attendance and portal access
                      </p>
                    </div>
                    {isStandalone() ? (
                      <Badge variant="default" className="bg-green-600 self-start sm:self-auto">
                        <CheckCircle2 className="mr-1 size-3" /> Installed App
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="self-start sm:self-auto">
                        <Download className="mr-1 size-3" /> Ready to Install
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted/60 p-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Why download the BMDC App?</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                        Works offline with cached training data
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                        Quick access to your attendance QR code
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                        Desktop icon & phone home screen shortcut
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                        Instant alerts and schedule reminders
                      </li>
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                      onClick={async () => {
                        if (canInstallPWA()) {
                          const res = await promptPWAInstall();
                          if (res.outcome === 'accepted') toast.success('App installed successfully!');
                        } else {
                          toast.info(getInstallInstructions().steps[0]);
                        }
                      }}
                    >
                      <Download className="size-4" />
                      Download & Install PWA
                    </Button>
                    <Link to="/settings">
                      <Button variant="outline" className="gap-2">
                        <Settings className="size-4" />
                        Open Trainee Settings
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* SIDEBAR INFO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {traineeProfile?.program && (
              <Card>
                <CardHeader>
                  <CardTitle>Current Program</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold">{traineeProfile.program.name}</p>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{traineeProfile.program.description}</p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Start Date</span>
                      <span className="font-semibold">{formatDate(traineeProfile.program.start_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">End Date</span>
                      <span className="font-semibold">{formatDate(traineeProfile.program.end_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status</span>
                      <Badge variant={traineeProfile.program.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {traineeProfile.program.status === 'active' ? 'Active' : traineeProfile.program.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <TraineeStatusCard
              statusRecord={statusRecord}
              isLoading={statusLoading}
              error={statusError?.message}
              onViewDetails={() => setStatusModalOpen(true)}
            />
          </div>
        </div>
      </main>

      {/* STATUS MODAL */}
      <TraineeStatusModal
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        enrollmentId={traineeProfile?.program_id ? `${traineeProfile.program_id}-${traineeProfile.id}` : ''}
        traineeId={traineeProfile?.id || ''}
        traineeName={traineeProfile ? `${traineeProfile.first_name} ${traineeProfile.last_name}` : undefined}
        programName={traineeProfile?.program?.name}
        existingStatus={modalStatusRecord}
        onStatusCreated={() => {
          refetchStatus();
          setStatusModalOpen(false);
        }}
      />
    </DashboardLayout>
  );
}

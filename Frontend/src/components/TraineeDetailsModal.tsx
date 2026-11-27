import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { User, Mail, Phone, GraduationCap, Calendar, MapPin, Download, Award, Upload, Trash2, FileCheck, Eye } from 'lucide-react';
import CertificateViewer from './CertificateViewer';
import CertificateUploadModal from './CertificateUploadModal';
import FilePreviewModal, { FilePreviewData } from './FilePreviewModal';
import DeleteConfirmationDialog from './DeleteConfirmationDialog';
import certificateService, { Certificate } from '../services/certificateService';
import api from '../services/api';
import traineeService from '../services/traineeService';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { traineeLogger } from '../utils/activityLogger';

interface Training {
  program: string;
  status: string;
  dateEnrolled: string;
  dateCompleted: string | null;
}

interface Trainee {
  id: number;
  name: string;
  photoUrl?: string;
  trainings: Training[];
  status: string;
  email: string;
  contact: string;
  address?: string;
  emergencyContact?: string;
  emergencyContactNumber?: string;
  employmentStatus?: string;
}

interface TraineeDetailsModalProps {
  trainee: Trainee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (id: number) => void;
  initialTab?: TraineeDetailsTab;
}

export type TraineeDetailsTab = 'info' | 'trainings' | 'requirements' | 'certificates';

export default function TraineeDetailsModal({ trainee, open, onOpenChange, onEdit, initialTab = 'info' }: TraineeDetailsModalProps) {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TraineeDetailsTab>(initialTab);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [requirements, setRequirements] = useState<Record<string, any>>({});
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FilePreviewData | null>(null);

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
    loadCertificates();
    loadRequirements();
  }, [open, initialTab, trainee?.id]);

  const loadRequirements = async () => {
    if (!trainee) {
      setRequirements({});
      return;
    }
    try {
      setLoadingRequirements(true);
      setRequirements({});
      const response = await api.get(`/trainees/${String(trainee.id)}/requirements`, undefined, {
        headers: { 'X-Skip-Cache': 'true' },
      });
      const files =
        response?.data?.files ||
        (response as any)?.files ||
        (Array.isArray(response?.data) ? response.data : []);
      if (Array.isArray(files)) {
        const reqMap: Record<string, any> = {};
        files.forEach((file: any) => {
          if (file?.requirement_type) {
            reqMap[file.requirement_type] = file;
          }
        });
        setRequirements(reqMap);
      }
    } catch (error: any) {
      console.error('Failed to load requirements:', error);
      setRequirements({});
    } finally {
      setLoadingRequirements(false);
    }
  };

  const loadCertificates = async () => {
    if (!trainee) return;
    try {
      setLoadingCertificates(true);
      const response = await certificateService.getCertificates(String(trainee.id));
      setCertificates(response.certificates);
    } catch (error: any) {
      // Failed to load certificates - silently continue
    } finally {
      setLoadingCertificates(false);
    }
  };


  const handleOpenFilePreview = (file: any) => {
    setSelectedFile({
      file_id: file.id,
      file_path: file.file_path,
      file_name: file.file_name,
      requirement_type: file.requirement_type,
      uploaded_at: file.uploaded_at,
    });
    setFilePreviewOpen(true);
  };

  const handleDownloadFile = async (_filePath: string, fileName: string, requirementType?: string, fileId?: string) => {
    if (!trainee || !requirementType) return;
    try {
      const downloadUrl = `/trainees/${String(trainee.id)}/requirements/${requirementType}/download${
        fileId ? `?file_id=${encodeURIComponent(fileId)}` : ''
      }`;
      await api.downloadFile(downloadUrl, fileName);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download file');
    }
  };
  const handleDeleteTrainee = async () => {
    if (!trainee) return;

    try {
      setIsDeleting(true);
      await traineeService.deleteTrainee(String(trainee.id));

      setDeleteConfirmDialogOpen(false);
      onOpenChange(false);

      toast.success(`Trainee ${trainee.name} has been deleted successfully.`);

      traineeLogger.deleted(trainee.name, String(trainee.id));
    } catch (error: any) {
      handleModalDeleteError(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalDeleteError = (error: any) => {
    const status = error?.response?.status;
    let message = 'Failed to delete trainee. Please try again later.';

    if (status === 403) {
      message = "You don't have permission to delete this trainee.";
    } else if (status === 404) {
      message = 'Trainee not found or already deleted.';
    } else if (error?.message) {
      message = error.message;
    }

    toast.error(message);
  };

  const handleDeleteCertificate = async (certificateId: string) => {
    if (!trainee) return;
    try {
      await certificateService.deleteCertificate(String(trainee.id), certificateId);
      toast.success('Certificate deleted successfully');
      loadCertificates();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete certificate');
    }
  };

  if (!trainee) return null;

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-muted';
    switch (status.toLowerCase()) {
      case 'active': return 'bg-secondary text-secondary-foreground';
      case 'completed': return 'bg-primary text-primary-foreground';
      case 'inactive': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        hideCloseButton={true}
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ 
          width: 'calc(100% - 2rem)',
          maxWidth: '42rem'
        }}
      >
        <DialogHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Avatar className="size-10 sm:size-12 shrink-0 border-2 border-primary">
              {trainee.photoUrl && <AvatarImage src={trainee.photoUrl} alt={trainee.name} className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm sm:text-base">
                {trainee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-lg leading-tight truncate">{trainee.name}</DialogTitle>
              <DialogDescription className="sr-only">Trainee details for {trainee.name}</DialogDescription>
              <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1">
                <Badge className={`text-xs ${getStatusColor(trainee.status)}`}>{trainee.status || 'N/A'}</Badge>
                <Badge variant="outline" className="text-xs border-primary/40 text-primary">
                  #{String(trainee.id).slice(0, 8)}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        {trainee.photoUrl && (
          <div className="flex justify-center px-4 sm:px-6">
            <img
              src={trainee.photoUrl}
              alt={trainee.name}
              className="h-32 sm:h-48 w-auto rounded-md object-cover shadow"
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TraineeDetailsTab)} className="w-full px-4 sm:px-6" orientation="horizontal">
          <TabsList className="w-full flex items-center justify-start gap-0.5 sm:gap-1 h-auto p-0.5 sm:p-1">
            <TabsTrigger value="info" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              <User className="size-3.5 sm:size-4" />
              <span className="hidden xs:inline">Info</span>
            </TabsTrigger>
            <TabsTrigger value="trainings" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              <GraduationCap className="size-3.5 sm:size-4" />
              <span className="hidden xs:inline">Trainings</span>
              {trainee.trainings.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs">
                  {trainee.trainings.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="requirements" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              <FileCheck className="size-3.5 sm:size-4" />
              <span className="hidden xs:inline">Requirements</span>
              {Object.keys(requirements).length > 0 && (
                <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs">
                  {Object.keys(requirements).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="certificates" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
              <Award className="size-3.5 sm:size-4" />
              <span className="hidden xs:inline">Certificates</span>
              {certificates.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs">
                  {certificates.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2">
            <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-muted/40 text-xs sm:text-sm">
              <Mail className="size-3.5 sm:size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Email</p>
                <p className="font-medium truncate text-xs sm:text-sm">{trainee.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-muted/40 text-xs sm:text-sm">
              <Phone className="size-3.5 sm:size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Contact</p>
                <p className="font-medium text-xs sm:text-sm">{trainee.contact}</p>
              </div>
            </div>
            {trainee.address && (
              <div className="flex items-start gap-2 p-2 sm:p-2.5 rounded-lg bg-muted/40 text-xs sm:text-sm">
                <MapPin className="size-3.5 sm:size-4 shrink-0 text-primary mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Address</p>
                  <p className="font-medium text-xs sm:text-sm">{trainee.address}</p>
                </div>
              </div>
            )}
            {trainee.employmentStatus && (
              <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-muted/40 text-xs sm:text-sm">
                <GraduationCap className="size-3.5 sm:size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Employment Status</p>
                  <p className="font-medium text-xs sm:text-sm">{trainee.employmentStatus}</p>
                </div>
              </div>
            )}
            {(trainee.emergencyContact || trainee.emergencyContactNumber) && (
              <div className="rounded-lg border border-dashed p-2.5 space-y-1.5 text-sm">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Emergency Contact</p>
                {trainee.emergencyContact && (
                  <div className="flex items-center gap-2">
                    <User className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{trainee.emergencyContact}</span>
                  </div>
                )}
                {trainee.emergencyContactNumber && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 text-muted-foreground" />
                    <span>{trainee.emergencyContactNumber}</span>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trainings" className="mt-3">
            {trainee.trainings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No training programs enrolled.</p>
            ) : (
              <div className="space-y-2">
                {trainee.trainings.map((training, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/40 text-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight">{training.program}</p>
                      <Badge className={`text-xs shrink-0 ${getStatusColor(training.status)}`}>{training.status || 'N/A'}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />Enrolled: {training.dateEnrolled}
                      </span>
                      {training.dateCompleted && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />Completed: {training.dateCompleted}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requirements" className="mt-3 space-y-2">
            {loadingRequirements ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : Object.keys(requirements).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck className="size-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No requirements submitted yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(requirements).map(([key, req]: [string, any]) => (
                  <div key={key} className="p-3 border rounded-lg bg-muted/40 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground font-medium capitalize">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm font-medium truncate">{req.file_name || req.fileName}</p>
                      {req.uploaded_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploaded: {new Date(req.uploaded_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {req.file_path && (
                        <>
                          <button
                            onClick={() => handleOpenFilePreview(req)}
                            className="p-1.5 rounded hover:bg-primary/10 transition-colors"
                            title="Preview"
                          >
                            <Eye className="size-4 text-primary" />
                          </button>
                          <button
                            onClick={() => handleDownloadFile(req.file_path, req.file_name, req.requirement_type, req.id)}
                            className="p-1.5 rounded hover:bg-primary/10 transition-colors"
                            title="Download"
                          >
                            <Download className="size-4 text-primary" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="certificates" className="mt-3">
            {hasPermission('canManageTrainees') && (
              <div className="mb-3">
                <Button
                  size="sm"
                  onClick={() => setUploadModalOpen(true)}
                  className="w-full"
                >
                  <Upload className="mr-2 size-4" />
                  Upload Certificate
                </Button>
              </div>
            )}
            {loadingCertificates ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <CertificateViewer
                certificates={certificates}
                canDelete={hasPermission('canManageTrainees')}
                onDelete={handleDeleteCertificate}
              />
            )}
          </TabsContent>
        </Tabs>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t mt-1 px-4 sm:px-6 pb-4 sm:pb-6">
          {hasPermission('canManageTrainees') && (
            <Button
              size="default"
              variant="destructive"
              onClick={() => setDeleteConfirmDialogOpen(true)}
              className="flex-1 text-xs sm:text-sm !px-6 sm:!px-8"
            >
              <Trash2 className="mr-1.5 sm:mr-2 size-3.5 sm:size-4" />
              Delete Trainee
            </Button>
          )}
          {onEdit && (
            <Button size="default" className="flex-1 text-xs sm:text-sm !px-6 sm:!px-8" onClick={() => { onEdit(trainee.id); onOpenChange(false); }}>
              Edit Trainee
            </Button>
          )}
        </div>
      </DialogContent>

      {trainee && (
        <DeleteConfirmationDialog
          open={deleteConfirmDialogOpen}
          trainee={trainee}
          isDeleting={isDeleting}
          onConfirm={handleDeleteTrainee}
          onCancel={() => setDeleteConfirmDialogOpen(false)}
        />
      )}

      {trainee && (
        <CertificateUploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          traineeId={String(trainee.id)}
          traineeName={trainee.name}
          onSuccess={() => {
            loadCertificates();
            setUploadModalOpen(false);
          }}
        />
      )}

      <FilePreviewModal
        file={selectedFile}
        open={filePreviewOpen}
        onOpenChange={setFilePreviewOpen}
        traineeId={String(trainee?.id)}
      />    </Dialog>
  );
}






















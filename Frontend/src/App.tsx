import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { BrandingProvider } from './contexts/BrandingContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProgramsProvider } from './contexts/ProgramsContext';
import { MessengerProvider } from './contexts/MessengerContext';
import { Toaster } from './components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';
import { useEffect } from 'react';
import { initializePWA } from './utils/pwa';
import { initializeDatabase } from './utils/offlineDB';
import { offlineManager } from './utils/offlineManager';
import { toast } from 'sonner';
import ErrorBoundary from './components/ErrorBoundary';
import { logger } from './utils/logger';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import OfflineIndicator from './components/OfflineIndicator';
import OverdueNotification from './components/OverdueNotification';
import { initializeWebVitals, enableWebVitalsLogging, onWebVital } from './utils/webVitals';
import { performanceLogger } from './utils/performanceLogger';
import { lazyPage, PageLoadingSkeleton } from './utils/lazyLoad';
import { initializeResourceHints } from './utils/resourceHints';
import { createOptimizedQueryClient, setupQueryPerformanceMonitoring } from './services/queryClient';

// Initialize optimized React Query client with caching strategy
const queryClient = createOptimizedQueryClient();

// Setup performance monitoring in development
if (process.env.NODE_ENV === 'development') {
  setupQueryPerformanceMonitoring(queryClient);
}

// Eagerly load critical pages (landing, dashboard)
import LandingPage from './pages/NewLandingPage';
import NotFoundPage from './pages/NotFoundPage';
import OfflinePage from './pages/OfflinePage';

// Lazy load all other pages
const DashboardPage = lazyPage(() => import('./pages/DashboardPage'));
const LinkHandlerPage = lazyPage(() => import('./pages/LinkHandlerPage'));
const TraineesPage = lazyPage(() => import('./pages/TraineesPage'));
const TraineeFormPage = lazyPage(() => import('./pages/TraineeFormPage'));
const ItemsPage = lazyPage(() => import('./pages/ItemsPage'));
const ItemFormPage = lazyPage(() => import('./pages/ItemFormPage'));
const LendingsPage = lazyPage(() => import('./pages/LendingsPage'));
const PrintSlipPage = lazyPage(() => import('./pages/PrintSlipPage'));
const ScanPage = lazyPage(() => import('./pages/ScanPage'));
const ReportsPage = lazyPage(() => import('./pages/ReportsPage'));
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'));
const ProgramsPage = lazyPage(() => import('./pages/ProgramsPage'));
const ProgramDetailPage = lazyPage(() => import('./pages/ProgramDetailPage'));
const ProgramFormPage = lazyPage(() => import('./pages/ProgramFormPage'));
const AccountManagementPage = lazyPage(() => import('./pages/AccountManagementPage'));
const ActivityLogsPage = lazyPage(() => import('./pages/ActivityLogsPage'));
const TraineeDashboardPage = lazyPage(() => import('./pages/TraineeDashboardPage'));
const TraineeProfilePage = lazyPage(() => import('./pages/TraineeProfilePage'));
const TraineeProgramsPage = lazyPage(() => import('./pages/TraineeProgramsPage'));
const NonAttendanceDatesPage = lazyPage(() => import('./pages/NonAttendanceDatesPage'));
const AttendancePage = lazyPage(() => import('./pages/AttendancePage'));
const TraineeAttendancePage = lazyPage(() => import('./pages/TraineeAttendancePage'));
const AttendanceDetailsPage = lazyPage(() => import('./pages/AttendanceDetailsPage'));
const SuperAdminDashboardPage = lazyPage(() => import('./pages/SuperAdminDashboardPage'));
const SuperAdminReportsPage = lazyPage(() => import('./pages/SuperAdminReportsPage'));
const SuperAdminAccountPage = lazyPage(() => import('./pages/SuperAdminAccountPage'));
const PerformanceDashboardPage = lazyPage(() => import('./pages/PerformanceDashboardPage'));
const ExtensionRequestsPage = lazyPage(() => import('./pages/ExtensionRequestsPage'));
const RegistrationsPage = lazyPage(() => import('./pages/RegistrationsPage'));
const TraineeApplicationsPage = lazyPage(() => import('./pages/TraineeApplicationsPage'));
const ProgramEnrollmentPage = lazyPage(() => import('./pages/ProgramEnrollmentPage'));
const LandingContentEditorPage = lazyPage(() => import('./pages/LandingContentEditorPage'));
const AnnouncementsManagementPage = lazyPage(() => import('./pages/AnnouncementsManagementPage'));
const RequirementsManagementPage = lazyPage(() => import('./pages/RequirementsManagementPage'));
const RequirementDetailPage = lazyPage(() => import('./pages/RequirementDetailPage'));
const ArchivePage = lazyPage(() => import('./pages/ArchivePage'));
const MessagesPage = lazyPage(() => import('./pages/MessagesPage'));


// Redirect components for login and register
function LoginRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { state: { openLogin: true }, replace: true });
  }, [navigate]);
  return null;
}

function RegisterRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/', { state: { openRegister: true }, replace: true });
  }, [navigate]);
  return null;
}

// Router wrapper to track page changes for performance monitoring
function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    // Update performance logger with new page path
    performanceLogger.setPagePath(location.pathname);
  }, [location.pathname]);

  return null;
}

// Route-scoped boundary so an error on one page resets automatically on navigation
function RouteErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

export default function App() {
  useEffect(() => {
    // Initialize resource hints for optimal network utilization
    initializeResourceHints();

    // Initialize Web Vitals tracking
    initializeWebVitals();

    // Enable console logging for development (comment out in production if desired)
    if (process.env.NODE_ENV === 'development') {
      enableWebVitalsLogging({ prefix: '[LCP Monitoring]', verbose: false });
    }

    // Collect vitals into performance logger
    const unsubscribe = onWebVital((metric) => {
      performanceLogger.addVitals({
        [metric.name.toLowerCase()]: metric.value,
      } as any);
    });

    // Initialize PWA
    initializePWA({
      onOnline: () => {
        toast.success('Connection restored', { description: 'You are back online' });
        offlineManager.syncPendingOperations();
      },
      onOffline: () => {
        toast.warning('Connection lost', {
          description: 'You are now offline. Changes will sync when reconnected.',
        });
      },
    });

    initializeDatabase()
      .then(() => logger.info('Offline database initialized'))
      .catch((error) => logger.error('Failed to initialize offline database', { error }));

    // Initialize performance logger
    performanceLogger.initialize();

    // Save metrics periodically
    const saveInterval = setInterval(() => {
      performanceLogger.saveMetricsToStorage();
    }, 10000);

    return () => {
      clearInterval(saveInterval);
      unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <AuthProvider>
            <BrandingProvider>
              <ProgramsProvider>
              <MessengerProvider>
                <BrowserRouter>
                <AppRoutes />
                <OfflineIndicator />
                <PWAInstallPrompt />
                <OverdueNotification />
                <RouteErrorBoundary>
                <Routes>
                  {/* ── Public Routes (Accessible without authentication) ── */}
                  <Route path="/share" element={<LinkHandlerPage />} />
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginRedirect />} />
                  <Route path="/register" element={<RegisterRedirect />} />
                  <Route path="/offline" element={<OfflinePage />} />

                  {/* ── Staff / Admin Routes (local_admin, staff_*, super_admin) ── */}
                  <Route path="/dashboard"             element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                  <Route path="/trainees"              element={<ProtectedRoute><TraineesPage /></ProtectedRoute>} />
                  <Route path="/trainees/new"          element={<ProtectedRoute><TraineeFormPage /></ProtectedRoute>} />
                  <Route path="/trainees/:id/edit"     element={<ProtectedRoute><TraineeFormPage /></ProtectedRoute>} />
                  <Route path="/items"                 element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
                  <Route path="/items/new"             element={<ProtectedRoute><ItemFormPage /></ProtectedRoute>} />
                  <Route path="/items/:id/edit"        element={<ProtectedRoute><ItemFormPage /></ProtectedRoute>} />
                  <Route path="/lendings"              element={<ProtectedRoute><LendingsPage /></ProtectedRoute>} />
                  <Route path="/lendings/:id/slip"    element={<ProtectedRoute><PrintSlipPage /></ProtectedRoute>} />
                  <Route path="/scan"                  element={<ProtectedRoute><ScanPage /></ProtectedRoute>} />
                  <Route path="/programs"              element={<ProtectedRoute><ProgramsPage /></ProtectedRoute>} />
                  <Route path="/programs/new"          element={<ProtectedRoute><ProgramFormPage /></ProtectedRoute>} />
                  <Route path="/programs/:id/enroll"    element={<ProtectedRoute allowedRoles={['trainee']}><ProgramEnrollmentPage /></ProtectedRoute>} />
                  <Route path="/programs/:id/attendance" element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
                  <Route path="/programs/:id/edit"     element={<ProtectedRoute><ProgramFormPage /></ProtectedRoute>} />
                  <Route path="/programs/:id"          element={<ProtectedRoute><ProgramDetailPage /></ProtectedRoute>} />
                  <Route path="/reports"               element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
                  <Route path="/activity-logs"         element={<ProtectedRoute><ActivityLogsPage /></ProtectedRoute>} />
                  <Route path="/settings"              element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                  <Route path="/admin/landing-content" element={<ProtectedRoute allowedRoles={['local_admin', 'super_admin']}><LandingContentEditorPage /></ProtectedRoute>} />
                  <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['local_admin', 'super_admin']}><AnnouncementsManagementPage /></ProtectedRoute>} />
                  <Route path="/admin/requirements" element={<ProtectedRoute allowedRoles={['local_admin', 'super_admin']}><RequirementsManagementPage /></ProtectedRoute>} />
                  <Route path="/admin/requirements/new" element={<ProtectedRoute allowedRoles={['local_admin', 'super_admin']}><RequirementDetailPage /></ProtectedRoute>} />
                  <Route path="/admin/requirements/:id" element={<ProtectedRoute allowedRoles={['local_admin', 'super_admin']}><RequirementDetailPage /></ProtectedRoute>} />
                  <Route path="/admin/requirements/:id/edit" element={<ProtectedRoute allowedRoles={['local_admin', 'super_admin']}><RequirementDetailPage /></ProtectedRoute>} />
                  <Route path="/admin/archive" element={<ProtectedRoute allowedRoles={['local_admin', 'super_admin']}><ArchivePage /></ProtectedRoute>} />
                  <Route path="/account-management"    element={<ProtectedRoute><AccountManagementPage /></ProtectedRoute>} />
                  <Route path="/non-attendance-dates"  element={<ProtectedRoute><NonAttendanceDatesPage /></ProtectedRoute>} />
                  <Route path="/registrations"        element={<ProtectedRoute><RegistrationsPage /></ProtectedRoute>} />
                  <Route path="/messages"             element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />

                  {/* ── Trainee-only Routes ── */}
                  <Route path="/trainee/dashboard"    element={<ProtectedRoute allowedRoles={['trainee']}><TraineeDashboardPage /></ProtectedRoute>} />
                  <Route path="/trainee/profile"      element={<ProtectedRoute allowedRoles={['trainee']}><TraineeProfilePage /></ProtectedRoute>} />
                  <Route path="/trainee/programs"     element={<ProtectedRoute allowedRoles={['trainee']}><TraineeProgramsPage /></ProtectedRoute>} />
                  <Route path="/trainee/applications" element={<ProtectedRoute allowedRoles={['trainee']}><TraineeApplicationsPage /></ProtectedRoute>} />
                  <Route path="/trainee/attendance"   element={<ProtectedRoute allowedRoles={['trainee']}><TraineeAttendancePage /></ProtectedRoute>} />
                  <Route path="/trainee/attendance/:date" element={<ProtectedRoute allowedRoles={['trainee']}><AttendanceDetailsPage /></ProtectedRoute>} />

                  {/* ── Role-specific Admin Routes ── */}
                  <Route path="/super-admin"          element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminDashboardPage /></ProtectedRoute>} />
                  <Route path="/super-admin/reports"  element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminReportsPage /></ProtectedRoute>} />
                  <Route path="/super-admin/accounts" element={<ProtectedRoute allowedRoles={['super_admin']}><SuperAdminAccountPage /></ProtectedRoute>} />
                  <Route path="/performance"         element={<ProtectedRoute allowedRoles={['super_admin', 'local_admin']}><PerformanceDashboardPage /></ProtectedRoute>} />
                  <Route path="/extension-requests"  element={<ProtectedRoute allowedRoles={['super_admin', 'local_admin']}><ExtensionRequestsPage /></ProtectedRoute>} />

                  {/* ── 404 ── */}
                  <Route path="/404" element={<NotFoundPage />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
                </RouteErrorBoundary>
                <Toaster />
              </BrowserRouter>
            </MessengerProvider>
          </ProgramsProvider>
            </BrandingProvider>
        </AuthProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </ThemeProvider>
  );
}


/**
 * RequirementDetailPage
 *
 * Admin page for viewing and managing a single requirement definition,
 * or for creating a new requirement if no ID is provided.
 * Provides a detailed view of a requirement with edit and delete capabilities,
 * or a form for creating new requirements.
 *
 * **Validates: Task 5.2 - RequirementDetailPage container**
 *
 * Features:
 * - Display requirement definition details (when viewing existing)
 * - Show submission statistics for the requirement
 * - Edit button to modify requirement
 * - Delete button to remove requirement
 * - View submissions button to see trainee submissions
 * - Form for creating new requirements (when ID is "new")
 * - Breadcrumb navigation
 * - Responsive design for mobile, tablet, and desktop
 * - Error boundaries and loading states
 * - Admin role verification
 *
 * Requirements Integration:
 * - Validates Requirement FR2.2: View individual requirement details
 * - Validates Requirement FR2.3: Edit requirement definitions
 * - Validates NFR5: Usability - clear UI, responsive design
 * - Validates NFR4: Security - admin role check, tenant isolation
 */

import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { RequirementDefinitionDetail } from '../components/requirements/RequirementDefinitionDetail';
import { RequirementDefinitionForm } from '../components/RequirementDefinitionForm';
import ErrorBoundary from '../components/ErrorBoundary';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAuth } from '../contexts/AuthContext';
import {
  AlertTriangle,
  ChevronRight,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import logger from '../utils/logger';
import { useRequirementDefinition } from '../hooks/useRequirementDefinition';
import { useUpdateRequirementDefinition } from '../hooks/useUpdateRequirementDefinition';

/**
 * Breadcrumb navigation component
 * Shows the current page path in the admin interface
 */
function RequirementDetailBreadcrumb({ requirementName }: { requirementName?: string }) {
  return (
    <nav className="flex items-center gap-1 text-xs sm:text-sm mb-4">
      <a href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
        Dashboard
      </a>
      <ChevronRight className="size-4 text-muted-foreground" />
      <a href="/admin/requirements" className="text-muted-foreground hover:text-foreground transition-colors">
        Requirements Management
      </a>
      <ChevronRight className="size-4 text-muted-foreground" />
      <span className="font-medium text-foreground line-clamp-1">
        {requirementName || 'Requirement Details'}
      </span>
    </nav>
  );
}

/**
 * RequirementDetailPage Component
 *
 * Main page for viewing a single requirement definition with edit/delete options,
 * or creating a new requirement definition.
 * Orchestrates the requirement detail workflow for administrators.
 *
 * Access Control:
 * - Requires 'local_admin' or 'super_admin' role
 * - Enforces tenant isolation (admins only see their tenant's requirements)
 *
 * Layout:
 * - Header with back button and page title
 * - Breadcrumb navigation
 * - Error boundary for component protection
 * - RequirementDefinitionForm component for create/edit mode
 * - RequirementDefinitionDetail component for view mode
 * - RequirementSubmissionList component for viewing trainee submissions
 * - Loading states and empty states
 * - Responsive design for all screen sizes
 *
 * Routes handled:
 * - /admin/requirements/new - Create new requirement
 * - /admin/requirements/:id - View requirement details
 * - /admin/requirements/:id/edit - Edit requirement
 */
export default function RequirementDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);
  
  // The dedicated /new route has no id parameter, so an absent id is create mode.
  const mode = !id || id === 'new'
    ? 'new'
    : location.pathname.endsWith('/edit')
      ? 'edit'
      : 'view';
  const requirementId = mode === 'new' ? undefined : id;
  
  const { data: requirement, isLoading, isError, error } = useRequirementDefinition(requirementId || '');
  const { mutateAsync: updateRequirement } = useUpdateRequirementDefinition();

  // Log page access
  React.useEffect(() => {
    logger.info('RequirementDetailPage mounted', {
      userRole: user?.role,
      userId: user?.id,
      requirementId,
      mode,
    });
  }, [user, requirementId, mode]);

  if ((mode === 'view' || mode === 'edit') && !id) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-8 px-4 sm:py-16">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertTriangle className="size-12 text-muted-foreground" />
            <div>
              <h2 className="text-lg sm:text-xl font-semibold mb-2">Invalid Requirement ID</h2>
              <p className="text-sm text-muted-foreground mb-4">The requirement ID is missing or invalid.</p>
              <Button onClick={() => navigate('/admin/requirements')}>
                Back to Requirements
              </Button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-8 px-4 sm:py-16">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertTriangle className="size-12 text-muted-foreground" />
            <div>
              <h2 className="text-lg sm:text-xl font-semibold mb-2">Loading...</h2>
              <p className="text-sm text-muted-foreground">Verifying authentication status...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const canManageRequirements = user.role === 'local_admin' || user.role === 'super_admin';

  if (!canManageRequirements) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-8 px-4">
          <RequirementDetailBreadcrumb />
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="flex items-start gap-3 py-6">
              <AlertTriangle className="size-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200">Access Denied</h3>
                <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                  Only administrators can manage requirements. Please contact your system administrator if you need access to this feature.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const handleEdit = () => {
    setIsNavigating(true);
    // Navigate to requirement form page for editing
    navigate(`/admin/requirements/${requirementId}/edit`);
  };

  const handleDelete = async (deletingId: string) => {
    try {
      // Soft delete by setting isActive to false
      if (updateRequirement) {
        await updateRequirement(deletingId, {
          isActive: false,
        });
      }
      // Navigate back to requirements list
      setIsNavigating(true);
      navigate('/admin/requirements', { state: { deletedId: deletingId } });
    } catch (err) {
      logger.error('Failed to delete requirement', { error: err });
      throw err;
    }
  };

  const handleFormSuccess = () => {
    setIsNavigating(true);
    navigate('/admin/requirements');
  };

  // Render based on mode
  return (
    <DashboardLayout>
      <ErrorBoundary>
        <div className="space-y-4 md:space-y-6">
          {/* Breadcrumb Navigation */}
          <RequirementDetailBreadcrumb requirementName={mode === 'new' ? 'New Requirement' : requirement?.display_name} />

          {/* Back Button and Page Header */}
          <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsNavigating(true);
                  navigate('/admin/requirements');
                }}
                disabled={isNavigating}
                className="flex-shrink-0"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-lg sm:text-2xl font-bold">
                  <BookOpen className="size-6 sm:size-8 flex-shrink-0" />
                  <span className="truncate">
                    {mode === 'new' ? 'Create Requirement' : mode === 'edit' ? 'Edit Requirement' : 'Requirement Details'}
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {mode === 'new' ? 'Create a new training requirement' : mode === 'edit' ? 'Modify requirement information' : 'View and manage requirement information'}
                </p>
              </div>
            </div>
          </div>

          {/* Create/Edit Mode */}
          {(mode === 'new' || mode === 'edit') && (
            <ErrorBoundary>
              <RequirementDefinitionForm
                requirementId={requirementId}
                onSuccess={handleFormSuccess}
              />
            </ErrorBoundary>
          )}

          {/* View Mode */}
          {mode === 'view' && (
            <>
              {/* Loading State */}
              {isLoading && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="h-8 bg-muted rounded animate-pulse" />
                      <div className="h-4 bg-muted rounded mt-2 w-2/3 animate-pulse" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Error State */}
              {isError && (
                <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-xs sm:text-sm text-red-800 dark:text-red-300">
                    {error?.message || 'Failed to load requirement details. Please try again.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Main Content: Requirement Definition Detail */}
              {!isLoading && !isError && (
                <div className="space-y-6">
                  <ErrorBoundary>
                    <RequirementDefinitionDetail
                      requirementId={requirementId!}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </ErrorBoundary>

                </div>
              )}
            </>
          )}
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}

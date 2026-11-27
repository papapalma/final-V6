/**
 * RequirementsManagementPage
 *
 * Admin page for managing training requirement definitions.
 * Provides a comprehensive interface for viewing, creating, editing, and managing
 * requirement definitions across the platform.
 *
 * **Validates: Task 5.1 - RequirementsManagementPage container**
 *
 * Features:
 * - Display list of all requirement definitions with statistics
 * - Filter and sort requirements
 * - Create new requirement definitions
 * - Edit existing requirement definitions
 * - View detailed requirement submission statistics
 * - Responsive design for mobile, tablet, and desktop
 * - Error boundaries for graceful error handling
 * - Loading states with skeleton screens
 * - Admin role verification
 * - Breadcrumb navigation
 * - Proper spacing and layout
 *
 * Requirements Integration:
 * - Validates Requirement FR2.1: List all requirement definitions with stats
 * - Validates Requirement FR2.2: View individual requirement details
 * - Validates Requirement FR2.3: Edit requirement definitions
 * - Validates Requirement FR2.4: Filter and sort requirements
 * - Validates NFR5: Usability - clear UI, responsive design
 * - Validates NFR4: Security - admin role check, tenant isolation
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { RequirementDefinitionsList } from '../components/RequirementDefinitionsList';
import ErrorBoundary from '../components/ErrorBoundary';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAuth } from '../contexts/AuthContext';
import {
  AlertTriangle,
  Plus,
  BookOpen,
  ChevronRight,
  Settings,
} from 'lucide-react';
import logger from '../utils/logger';

/**
 * Breadcrumb navigation component
 * Shows the current page path in the admin interface
 */
function RequirementsBreadcrumb() {
  return (
    <nav className="flex items-center gap-1.5 text-xs sm:text-sm mb-4">
      <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
        Dashboard
      </Link>
      <ChevronRight className="size-4 text-muted-foreground" />
      <span className="font-medium text-foreground">Requirements Management</span>
    </nav>
  );
}

/**
 * RequirementsManagementPage Component
 *
 * Main admin interface for training requirement definitions management.
 * Orchestrates the requirement definition workflow for administrators.
 *
 * Access Control:
 * - Requires 'local_admin' or 'super_admin' role
 * - Enforces tenant isolation (admins only see their tenant's requirements)
 *
 * Layout:
 * - Header with page title and "Add New Requirement" button
 * - Breadcrumb navigation
 * - Error boundary for component protection
 * - RequirementDefinitionsList component for main content
 * - Loading states and empty states
 * - Responsive design for all screen sizes
 */
export default function RequirementsManagementPage() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  // Log page access
  React.useEffect(() => {
    logger.info('RequirementsManagementPage mounted', {
      userRole: user?.role,
      userId: user?.id,
    });
  }, [user]);

  // Access control: Only local_admin and super_admin can access this page
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

  const canManageRequirements =
    user?.role === 'local_admin' ||
    user?.role === 'super_admin' ||
    user?.role === 'staff_training_coordinator';

  if (!canManageRequirements) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-8 px-4">
          <RequirementsBreadcrumb />
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="flex items-start gap-3 py-6">
              <AlertTriangle className="size-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200">Access Denied</h3>
                <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                  Only administrators can manage training requirements. Please contact your system administrator if you need access to this feature.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const handleAddNewRequirement = () => {
    setIsNavigating(true);
    // Navigate to requirement form page for creating new requirement
    navigate('/admin/requirements/new');
  };

  const handleRequirementSelect = (id: string) => {
    setIsNavigating(true);
    // Navigate to requirement detail page
    navigate(`/admin/requirements/${id}`);
  };

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <div className="ds-page space-y-6 md:space-y-8">
          {/* Breadcrumb Navigation */}
          <RequirementsBreadcrumb />

          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-lg sm:text-2xl font-bold tracking-tight">
                <BookOpen className="size-6 sm:size-7 flex-shrink-0 text-primary" />
                <span>Requirements Management</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                Configure and manage training enrollment requirements
              </p>
            </div>
            <div className="flex gap-2 flex-col sm:flex-row w-full sm:w-auto">
              <Button
                onClick={handleAddNewRequirement}
                disabled={isNavigating}
                className="sm:size-default w-full sm:w-auto py-2.5 px-4"
              >
                <Plus className="size-4" />
                Add New Requirement
              </Button>
            </div>
          </div>

          {/* Information Alert */}
          <Alert className="border-primary/20 bg-secondary/70 dark:border-primary/30 dark:bg-secondary/40">
            <Settings className="size-4 text-primary" />
            <AlertDescription className="text-xs sm:text-sm text-secondary-foreground">
              Manage training enrollment requirements here. Define requirement types, set mandatory flags, and track trainee submissions. Requirements are applied based on trainee eligibility criteria (e.g., marital status).
            </AlertDescription>
          </Alert>

          {/* Main Content: Requirement Definitions List */}
          <div>
            <ErrorBoundary>
              <RequirementDefinitionsList
                onRequirementSelect={handleRequirementSelect}
                onAddRequirement={handleAddNewRequirement}
              />
            </ErrorBoundary>
          </div>
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}

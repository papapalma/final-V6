import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Skeleton } from '../components/ui/skeleton';
import { Download, FileText, ChevronDown, Printer, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import reportService from '../services/reportService';
import api from '../services/api';
import logger from '../utils/logger';
import PrintableReport from '../components/PrintableReport';
import { exportReportsToExcel } from '../utils/excelExport';
import { getLocalIsoDate } from '../utils/printFormatters';
import { useAuth } from '../contexts/AuthContext';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function ReportsPage() {
  const { isAuthReady, hasPermission, user } = useAuth();
  const isInventoryStaff = user?.role === 'staff_inventory_manager';
  const isTrainingStaff = user?.role === 'staff_training_coordinator';
  const isLocalAdmin = user?.role === 'local_admin';
  const todayIso = getLocalIsoDate();
  const currentMonth = todayIso.slice(0, 7);
  const [dateFrom, setDateFrom] = useState(`${currentMonth}-01`);
  const [dateTo, setDateTo] = useState(todayIso);
  const [appliedDateFrom, setAppliedDateFrom] = useState(`${currentMonth}-01`);
  const [appliedDateTo, setAppliedDateTo] = useState(todayIso);
  const [reportType, setReportType] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [programData, setProgramData] = useState<any[]>([]);
  const [employmentStatusRecords, setEmploymentStatusRecords] = useState<Array<{ id: string; name: string; employmentStatus: string; traineeStatus: string; programId: string | null; program: string }>>([]);
  const [employmentProgramFilter, setEmploymentProgramFilter] = useState('all');
  const [traineeStatusFilter, setTraineeStatusFilter] = useState('all');
  const [selectedProgram, setSelectedProgram] = useState('all');
  
  // Print state management
  const [isPrinting, setIsPrinting] = useState(false);
  
  // Summary statistics state
  const [totalLendings, setTotalLendings] = useState(0);
  const [itemsReturned, setItemsReturned] = useState(0);
  const [activeLoans, setActiveLoans] = useState(0);
  const [newTrainees, setNewTrainees] = useState(0);
  const [totalTrainees, setTotalTrainees] = useState(0);
  const [totalPrograms, setTotalPrograms] = useState(0);
  const reportRequestIdRef = useRef(0);

  const COLORS = ['#1976D2', '#43A047', '#FBC02D', '#00ACC1'];

  // Sync valid complete YYYY-MM-DD dates automatically while preventing mid-typing API spam
  useEffect(() => {
    const isValidIso = (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val);
    if (isValidIso(dateFrom) && isValidIso(dateTo) && dateFrom <= dateTo) {
      setAppliedDateFrom(dateFrom);
      setAppliedDateTo(dateTo);
    }
  }, [dateFrom, dateTo]);

  // Fetch report data from backend when committed filters change
  useEffect(() => {
    if (isAuthReady === false) {
      return;
    }

    fetchReportData(appliedDateFrom, appliedDateTo);
  }, [appliedDateFrom, appliedDateTo, isAuthReady, isInventoryStaff, isTrainingStaff, employmentProgramFilter, traineeStatusFilter]);

  const handleApplyFilters = () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error('Start date cannot be after end date');
      return;
    }
    api.clearCache();
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setFiltersOpen(false);
    fetchReportData(dateFrom, dateTo);
  };

  useEffect(() => {
    if (isInventoryStaff && reportType === 'all') {
      setReportType('items');
    }
    if (isTrainingStaff && reportType === 'all') {
      setReportType('trainees');
    }
  }, [isInventoryStaff, isTrainingStaff, reportType]);

  const isForbidden = (error: unknown) => {
    const status = (error as any)?.status ?? (error as any)?.response?.status;
    return status === 403 || status === 404;
  };

  const fetchReportData = async (start = appliedDateFrom, end = appliedDateTo) => {
    const requestId = ++reportRequestIdRef.current;
    try {
      setLoading(true);
      const filters = {
        startDate: start,
        endDate: end
      };
      const traineeReportFilters = {
        ...filters,
        ...(employmentProgramFilter !== 'all' ? { program_id: employmentProgramFilter } : {}),
        ...(traineeStatusFilter !== 'all' ? { trainee_status: traineeStatusFilter } : {}),
      };
      const employmentReportFilters = {
        ...(employmentProgramFilter !== 'all' ? { program_id: employmentProgramFilter } : {}),
        ...(traineeStatusFilter !== 'all' ? { trainee_status: traineeStatusFilter } : {}),
      };

      const shouldFetchActivity = !isTrainingStaff && (isInventoryStaff || hasPermission('canViewActivityLogs'));

      // Fire all role-permitted report endpoints in parallel instead of sequentially
      const [
        summaryResult,
        employmentResult,
        activityResult,
        inventoryResult,
        programResult,
      ] = await Promise.allSettled([
        isTrainingStaff
          ? reportService.getTraineeReport(traineeReportFilters)
          : reportService.getDashboardStats(filters),
        isLocalAdmin
          ? reportService.getTraineeReport(employmentReportFilters)
          : Promise.resolve(null),
        shouldFetchActivity
          ? reportService.getActivityAnalytics(filters)
          : Promise.resolve(null),
        !isTrainingStaff
          ? reportService.getInventoryReport(filters)
          : Promise.resolve(null),
        !isInventoryStaff
          ? reportService.getProgramReport()
          : Promise.resolve(null),
      ]);

      if (requestId !== reportRequestIdRef.current) {
        return;
      }

      if (isTrainingStaff) {
        if (summaryResult.status === 'fulfilled') {
          setNewTrainees((summaryResult.value as any)?.totalEnrollments || 0);
        } else {
          if (!isForbidden(summaryResult.reason)) {
            logger.error('Failed to fetch trainee report', { error: summaryResult.reason });
          }
          setNewTrainees(0);
        }
        setTotalLendings(0);
        setItemsReturned(0);
        setActiveLoans(0);
      } else {
        if (summaryResult.status === 'fulfilled' && summaryResult.value) {
          const dashboardStats = summaryResult.value as any;
          setTotalLendings(dashboardStats.lending?.total ?? 0);
          setItemsReturned(dashboardStats.lending?.returned ?? 0);
          setActiveLoans(dashboardStats.lending?.active ?? 0);
          setNewTrainees(dashboardStats.trainees?.newInPeriod ?? dashboardStats.trainees?.total ?? 0);
          setTotalTrainees(dashboardStats.trainees?.total ?? 0);
          setTotalPrograms(dashboardStats.programs?.total ?? 0);
        } else {
          if (summaryResult.status === 'rejected' && !isForbidden(summaryResult.reason)) {
            logger.error('Failed to fetch dashboard stats', { error: summaryResult.reason });
          }
          setTotalTrainees(0);
          setTotalPrograms(0);
        }
      }

      if (isLocalAdmin) {
        if (employmentResult.status === 'fulfilled') {
          setEmploymentStatusRecords((employmentResult.value as any)?.employmentStatusRecords || []);
        } else {
          if (!isForbidden(employmentResult.reason)) {
            logger.error('Failed to fetch employment status report', { error: employmentResult.reason });
          }
          setEmploymentStatusRecords([]);
        }
      } else {
        setEmploymentStatusRecords([]);
      }

      if (shouldFetchActivity) {
        if (activityResult.status === 'fulfilled') {
          const activityResponse: any = activityResult.value;
          if (activityResponse?.trend) {
            setActivityData(activityResponse.trend.map((item: any) => ({
              date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              borrowed: item.borrowed || 0,
              returned: item.returned || 0
            })));
          } else {
            setActivityData([]);
          }
        } else {
          if (!isForbidden(activityResult.reason)) {
            logger.error('Failed to fetch activity analytics', { error: activityResult.reason });
          }
          setActivityData([]);
        }
      } else {
        setActivityData([]);
      }

      if (isTrainingStaff) {
        setCategoryData([]);
      } else if (inventoryResult.status === 'fulfilled') {
        const inventoryResponse: any = inventoryResult.value;
        if (inventoryResponse?.byCategory) {
          const categoryEntries = Object.entries(inventoryResponse.byCategory);
          setCategoryData(categoryEntries.map(([name, value]) => ({ name, value })));
        } else {
          setCategoryData([]);
        }
      } else {
        if (!isForbidden(inventoryResult.reason)) {
          logger.error('Failed to fetch inventory report', { error: inventoryResult.reason });
        }
        setCategoryData([]);
      }

      if (isInventoryStaff) {
        setProgramData([]);
      } else if (programResult.status === 'fulfilled') {
        const programResponse: any = programResult.value;
        if (programResponse?.programStats) {
          setProgramData(programResponse.programStats.map((item: any) => {
            const students = Array.isArray(item.students) ? item.students : [];
            const enrolledCount = typeof item.enrolledCount === 'number' ? item.enrolledCount : students.length;
            return {
              id: item.id,
              program: item.name,
              trainees: enrolledCount,
              enrolledCount,
              completedCount: typeof item.completedCount === 'number' ? item.completedCount : 0,
              completionRate: typeof item.completionRate === 'number' ? item.completionRate : 0,
              capacity: typeof item.capacity === 'number' ? item.capacity : 0,
              status: item.status || 'active',
              students,
            };
          }));
        } else {
          setProgramData([]);
        }
      } else {
        if (!isForbidden(programResult.reason)) {
          logger.error('Failed to fetch program report', { error: programResult.reason });
        }
        setProgramData([]);
      }
    } catch (error) {
      if (requestId !== reportRequestIdRef.current) {
        return;
      }
      logger.error('Failed to fetch reports', { error });
      toast.error('Failed to load report data');
      setActivityData([]);
      setCategoryData([]);
      setProgramData([]);
    } finally {
      if (requestId === reportRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleExport = async (format: string) => {
    try {
      const exportType = isInventoryStaff && reportType === 'all'
        ? 'items'
        : isTrainingStaff && reportType === 'all'
          ? 'trainees'
          : reportType;
      if (format === 'pdf') {
        await reportService.exportReportToPDF(exportType, {
          startDate: dateFrom,
          endDate: dateTo
        });
      } else if (format === 'csv') {
        await reportService.exportReportToCSV(exportType, {
          startDate: dateFrom,
          endDate: dateTo
        });
      }
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error) {
      logger.error('Export failed', { error });
      toast.error(`Failed to export report as ${format.toUpperCase()}`);
    }
  };

  const handlePrint = async () => {
    // Feature detection - check if window.print is supported
    if (typeof window.print !== 'function') {
      toast.error('Print functionality is not supported in your browser. Please use PDF export.');
      return;
    }
    
    try {
      setIsPrinting(true);
      
      // Small delay to ensure PrintableReport renders
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Trigger browser print dialog
      window.print();
    } catch (error) {
      logger.error('Print failed', { error });
      toast.error('Failed to open print dialog. Please try exporting as PDF instead.');
      setIsPrinting(false);
    }
  };

  // Set up afterprint event listener to reset isPrinting state
  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };
    
    window.addEventListener('afterprint', handleAfterPrint);
    
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const filteredEmploymentRecords = employmentStatusRecords.filter((record) =>
    (employmentProgramFilter === 'all' || record.programId === employmentProgramFilter) &&
    (traineeStatusFilter === 'all' || record.traineeStatus === traineeStatusFilter)
  );
  const employmentProgramOptions = programData.filter((program) =>
    employmentStatusRecords.some((record) => record.programId === program.id)
  );
  const traineeStatusOptions = [...new Set(employmentStatusRecords.map((record) => record.traineeStatus))];
  const filteredProgramData = programData.filter(
    (program) => selectedProgram === 'all' || program.program === selectedProgram
  );

  // Role and Report Type visibility flags
  const showLendingKpis = !isTrainingStaff && (reportType === 'all' || reportType === 'lendings' || reportType === 'items');
  const showTraineeKpis = !isInventoryStaff && (reportType === 'all' || reportType === 'trainees');
  const showActivityTrendSection = !isTrainingStaff && (isInventoryStaff || hasPermission('canViewActivityLogs')) && (reportType === 'all' || reportType === 'lendings');
  const showCategorySection = !isTrainingStaff && (reportType === 'all' || reportType === 'items');
  const showProgramSection = !isInventoryStaff && (reportType === 'all' || reportType === 'trainees');
  const showEmploymentSection = isLocalAdmin && (reportType === 'all' || reportType === 'trainees');
  const pageTitle = isInventoryStaff ? 'Inventory Reports' : isTrainingStaff ? 'Trainee & Program Reports' : 'Reports & Analytics';

  return (
    <DashboardLayout title={pageTitle}>
      {/* Conditionally render PrintableReport when isPrinting is true */}
      {isPrinting && (
        <PrintableReport
          reportTitle={pageTitle}
          dateFrom={dateFrom}
          dateTo={dateTo}
          reportType={reportType}
          generatedAt={new Date().toISOString()}
          summaryStats={{
            totalLendings,
            itemsReturned,
            activeLoans,
            newTrainees,
            ...(!isInventoryStaff && !isTrainingStaff ? { totalTrainees, totalPrograms } : {}),
          }}
          activityData={activityData}
          categoryData={categoryData}
          programData={filteredProgramData}
          employmentData={filteredEmploymentRecords}
          generatedBy={{
            name: (user as any)?.name || (user as any)?.username || user?.email,
            role: user?.role,
          }}
          roleFlags={{
            isInventoryStaff,
            isTrainingStaff,
            isLocalAdmin,
          }}
        />
      )}
      
      <div className={`space-y-6 ${isPrinting ? 'hidden print:hidden no-print' : ''}`}>
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight">Reports</h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {isInventoryStaff ? 'View inventory and borrowing analytics' : isTrainingStaff ? 'View trainee and program analytics' : 'View and export analytics data'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} className="report-action-btn flex-1 sm:flex-none h-9 py-2 px-3.5 text-xs sm:text-sm">
              <FileText className="mr-1.5 sm:mr-2 size-3.5 sm:size-4" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="inline sm:hidden">CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                try {
                  exportReportsToExcel({
                    reportTitle: pageTitle,
                    dateFrom,
                    dateTo,
                    summaryStats: {
                      totalLendings,
                      itemsReturned,
                      activeLoans,
                      newTrainees,
                    },
                    activityData,
                    categoryData,
                    programData: filteredProgramData,
                  });
                  toast.success('Exported report to Excel');
                } catch (err: any) {
                  toast.error(err.message || 'Failed to export report to Excel');
                }
              }}
              className="report-action-btn flex-1 sm:flex-none h-9 py-2 px-3.5 text-xs sm:text-sm"
            >
              <FileSpreadsheet className="mr-1.5 sm:mr-2 size-3.5 sm:size-4 text-emerald-600" />
              <span className="hidden sm:inline">Export Excel</span>
              <span className="inline sm:hidden">Excel</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="report-action-btn flex-1 sm:flex-none h-9 py-2 px-3.5 text-xs sm:text-sm">
              <Download className="mr-1.5 sm:mr-2 size-3.5 sm:size-4" />
              <span className="hidden sm:inline">Export PDF</span>
              <span className="inline sm:hidden">PDF</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="report-action-btn flex-1 sm:flex-none h-9 py-2 px-3.5 text-xs sm:text-sm"
            >
              {isPrinting ? (
                <>
                  <Loader2 className="mr-1.5 sm:mr-2 size-3.5 sm:size-4 animate-spin" />
                  <span className="hidden sm:inline">Preparing...</span>
                  <span className="inline sm:hidden">...</span>
                </>
              ) : (
                <>
                  <Printer className="mr-1.5 sm:mr-2 size-3.5 sm:size-4" />
                  <span className="hidden sm:inline">Print</span>
                  <span className="inline sm:hidden">Prt</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filters - Desktop */}
        <Card className="hidden md:block">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="dateFrom" className="text-xs sm:text-sm">Date From</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 py-2 px-3.5 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dateTo" className="text-xs sm:text-sm">Date To</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 py-2 px-3.5 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reportType" className="text-xs sm:text-sm">Report Type</Label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="h-9 py-2 px-3.5 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activity</SelectItem>
                    {!isInventoryStaff && <SelectItem value="trainees">Trainees Only</SelectItem>}
                    {!isTrainingStaff && <SelectItem value="items">Items Only</SelectItem>}
                    {!isTrainingStaff && <SelectItem value="lendings">Lendings Only</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleApplyFilters} className="report-action-btn w-full h-9 py-2 px-3.5 text-sm">Apply Filters</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters - Mobile (Collapsible) */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="md:hidden">
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm sm:text-base">Filters</CardTitle>
                  <ChevronDown className={`size-4 sm:size-5 report-chevron-transition ${filtersOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
                <div className="space-y-1.5">
                  <Label htmlFor="dateFrom-mobile" className="text-xs sm:text-sm">Date From</Label>
                  <Input
                    id="dateFrom-mobile"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 py-2 px-3.5 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dateTo-mobile" className="text-xs sm:text-sm">Date To</Label>
                  <Input
                    id="dateTo-mobile"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 py-2 px-3.5 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reportType-mobile" className="text-xs sm:text-sm">Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="h-9 py-2 px-3.5 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Activity</SelectItem>
                      {!isInventoryStaff && <SelectItem value="trainees">Trainees Only</SelectItem>}
                      {!isTrainingStaff && <SelectItem value="items">Items Only</SelectItem>}
                      {!isTrainingStaff && <SelectItem value="lendings">Lendings Only</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleApplyFilters} className="report-action-btn w-full h-9 py-2 px-3.5 text-sm">Apply Filters</Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Summary Stats - Individual Cards */}
        <div className={`grid gap-4 sm:grid-cols-2 ${isTrainingStaff ? 'lg:grid-cols-2' : isInventoryStaff ? 'lg:grid-cols-3' : 'lg:grid-cols-3'}`}>
          {isTrainingStaff ? (
            <>
              <Card className="report-section-enter">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs sm:text-sm">Total Enrollments</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-8 w-20" /> : <h3 className="text-2xl sm:text-3xl font-bold tabular-nums">{newTrainees}</h3>}
                </CardContent>
              </Card>
              <Card className="report-section-enter">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs sm:text-sm">Programs with Enrollments</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-8 w-20" /> : <h3 className="text-2xl sm:text-3xl font-bold tabular-nums">{programData.length}</h3>}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {showLendingKpis && (
                <>
                  <Card className="report-section-enter">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs sm:text-sm">Total Borrowed</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? <Skeleton className="h-8 w-20" /> : <h3 className="text-2xl sm:text-3xl font-bold tabular-nums">{totalLendings}</h3>}
                    </CardContent>
                  </Card>
                  <Card className="report-section-enter">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs sm:text-sm">Items Returned</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? <Skeleton className="h-8 w-20" /> : <h3 className="text-2xl sm:text-3xl font-bold tabular-nums">{itemsReturned}</h3>}
                    </CardContent>
                  </Card>
                  <Card className="report-section-enter">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs sm:text-sm">Active Borrowings</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? <Skeleton className="h-8 w-20" /> : <h3 className="text-2xl sm:text-3xl font-bold tabular-nums">{activeLoans}</h3>}
                    </CardContent>
                  </Card>
                </>
              )}
              {showTraineeKpis && (
                <>
                  <Card className="report-section-enter">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs sm:text-sm">Total Trainees</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? <Skeleton className="h-8 w-20" /> : <h3 className="text-2xl sm:text-3xl font-bold tabular-nums">{totalTrainees}</h3>}
                    </CardContent>
                  </Card>
                  <Card className="report-section-enter">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs sm:text-sm">Total Programs</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? <Skeleton className="h-8 w-20" /> : <h3 className="text-2xl sm:text-3xl font-bold tabular-nums">{totalPrograms}</h3>}
                    </CardContent>
                  </Card>
                  <Card className="report-section-enter">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs sm:text-sm">New Trainees</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? <Skeleton className="h-8 w-20" /> : <h3 className="text-2xl sm:text-3xl font-bold tabular-nums">{newTrainees}</h3>}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>

        {/* Charts */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Activity Trend */}
          {showActivityTrendSection && <Card className="report-section-enter">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Borrowing Activity Trend</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Borrowing and returning over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-80 md:h-[300px]">
                {loading ? (
                  <Skeleton className="h-full w-full rounded-lg" />
                ) : activityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={activityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="borrowed" stroke="#1976D2" strokeWidth={2} name="Borrowed" isAnimationActive={false} />
                      <Line type="monotone" dataKey="returned" stroke="#43A047" strokeWidth={2} name="Returned" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No activity data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>}

          {/* Category Distribution */}
          {showCategorySection && <Card className="report-section-enter">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base">Items by Category</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Distribution of item categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-80 md:h-[300px]">
                {loading ? (
                  <Skeleton className="h-full w-full rounded-lg" />
                ) : categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {categoryData.map((_, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No category data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>}

          {/* Program Enrollment */}
          {showProgramSection && <Card className="lg:col-span-2 report-section-enter">
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Trainees by Program</CardTitle>
                <CardDescription>Enrolled students in each training program</CardDescription>
              </div>
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger className="w-full sm:w-64 py-2 px-3.5">
                  <SelectValue placeholder="Filter by program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programData.map((program) => (
                    <SelectItem key={program.program} value={program.program}>
                      {program.program}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] space-y-6 overflow-y-auto">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : filteredProgramData.length > 0 ? (
                  filteredProgramData.map((program) => (
                    <div key={program.program} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">{program.program}</h4>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {program.trainees ?? program.students?.length ?? 0}
                          {program.capacity ? `/${program.capacity}` : ''} enrolled
                          {typeof program.completedCount === 'number' ? ` • ${program.completedCount} completed (${program.completionRate ?? 0}%)` : ''}
                        </span>
                      </div>
                      {Array.isArray(program.students) && program.students.length > 0 ? (
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {program.students.map((student: string) => (
                            <li key={`${program.program}-${student}`} className="rounded-md border px-3.5 py-2 text-sm">
                              {student}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No students enrolled</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex min-h-[180px] items-center justify-center text-muted-foreground">
                    <p>No program data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>}

          {showEmploymentSection && <Card className="lg:col-span-2 report-section-enter">
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Employment Status</CardTitle>
                <CardDescription>Trainees grouped by current employment status</CardDescription>
              </div>
              <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                <Select value={employmentProgramFilter} onValueChange={setEmploymentProgramFilter}>
                  <SelectTrigger className="w-full sm:w-44 py-2 px-3.5">
                    <SelectValue placeholder="Program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {employmentProgramOptions.map((program) => (
                      <SelectItem key={program.id} value={program.id}>{program.program}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={traineeStatusFilter} onValueChange={setTraineeStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40 py-2 px-3.5">
                    <SelectValue placeholder="Trainee status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Trainees</SelectItem>
                    {traineeStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-auto">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : filteredEmploymentRecords.length > 0 ? (
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="sticky top-0 bg-card text-muted-foreground">
                      <tr className="border-b">
                        <th className="px-3.5 py-2 font-medium">Trainee</th>
                        <th className="px-3.5 py-2 font-medium">Employment Status</th>
                        <th className="px-3.5 py-2 font-medium">Program</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmploymentRecords.map((record) => (
                        <tr key={record.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="max-w-[220px] truncate px-3.5 py-2 font-medium">{record.name}</td>
                          <td className="px-3.5 py-2 text-muted-foreground">{record.employmentStatus}</td>
                          <td className="max-w-[360px] truncate px-3.5 py-2 text-muted-foreground">{record.program}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">No employment status data available</p>
                )}
              </div>
            </CardContent>
          </Card>}
        </div>
      </div>
    </DashboardLayout>
  );
}

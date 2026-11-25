/**
 * PrintableReport Component
 * 
 * This component renders a print-optimized layout of admin report data.
 * It is conditionally rendered when the user clicks the Print button on the ReportsPage.
 * The component transforms chart data into tabular formats suitable for printing.
 * 
 * Requirements: 2.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import {
  formatPrintDate,
  formatPrintTimestamp,
  calculatePercentage,
  formatReportType,
  formatPrintValue,
} from '../utils/printFormatters';
import { useBranding } from '../contexts/BrandingContext';
import { BrandLogo } from './BrandLogo';

/**
 * Props interface for the PrintableReport component
 */
export interface PrintableReportProps {
  // Report metadata
  reportTitle: string;
  dateFrom: string;
  dateTo: string;
  reportType: string;
  generatedAt: string;
  
  // Summary statistics
  summaryStats: {
    totalLendings: number;
    itemsReturned: number;
    activeLoans: number;
    newTrainees: number;
    totalTrainees?: number;
    totalPrograms?: number;
  };
  
  // Chart data (already in table-friendly format)
  activityData: Array<{ date: string; borrowed: number; returned: number }>;
  categoryData: Array<{ name: string; value: number }>;
  programData: Array<{
    id?: string;
    program: string;
    trainees?: number;
    enrolledCount?: number;
    completedCount?: number;
    completionRate?: number;
    capacity?: number;
    status?: string;
    students?: string[];
  }>;

  // Optional official report enhancements
  employmentData?: Array<{
    id: string;
    name: string;
    employmentStatus: string;
    traineeStatus: string;
    program: string;
  }>;
  generatedBy?: {
    name?: string;
    role?: string;
  };
  roleFlags?: {
    isInventoryStaff?: boolean;
    isTrainingStaff?: boolean;
    isLocalAdmin?: boolean;
  };
}

function formatRoleLabel(role?: string): string {
  if (!role) return 'Administrator';
  const roleMap: Record<string, string> = {
    local_admin: 'Local Administrator',
    super_admin: 'Super Administrator',
    staff_inventory_manager: 'Inventory Manager',
    staff_training_coordinator: 'Training Coordinator',
    admin: 'Administrator',
  };
  return roleMap[role] || role;
}

/**
 * PrintHeader Sub-component
 * Displays the report title, institution logo, and official header
 * 
 * Requirement: 7.1
 */
interface PrintHeaderProps {
  reportTitle: string;
}

function PrintHeader({ reportTitle }: PrintHeaderProps) {
  const branding = useBranding();

  return (
    <div className="print-header mb-4 border-b pb-3">
      <div className="flex items-center gap-3 mb-2">
        {branding.logoUrl && (
          <BrandLogo
            size="md"
            logoUrl={branding.logoUrl}
            companyName={branding.companyName}
            className="border-0 shadow-none bg-transparent"
          />
        )}
        <div>
          <h2 className="text-base font-bold text-gray-900 tracking-tight leading-tight m-0">
            {branding.companyName}
          </h2>
          <p className="text-xs text-gray-600 m-0 leading-tight">
            {branding.tagline}
          </p>
        </div>
      </div>
      <h1 className="text-xl font-black text-gray-950 mt-2 mb-0 tracking-tight">{reportTitle}</h1>
    </div>
  );
}

/**
 * PrintMetadata Sub-component
 * Displays date range, report type, and generation timestamp
 * 
 * Requirement: 7.2, 7.7
 */
interface PrintMetadataProps {
  dateFrom: string;
  dateTo: string;
  reportType: string;
  generatedAt: string;
  generatedBy?: {
    name?: string;
    role?: string;
  };
}

function PrintMetadata({ dateFrom, dateTo, reportType, generatedAt, generatedBy }: PrintMetadataProps) {
  return (
    <div className="print-metadata mb-4 p-2.5 bg-gray-50 border border-gray-200 rounded text-xs space-y-1">
      <p className="m-0 text-gray-800">
        <strong className="font-semibold text-gray-900">Date Range:</strong> {formatPrintDate(dateFrom)} - {formatPrintDate(dateTo)}
      </p>
      <p className="m-0 text-gray-800">
        <strong className="font-semibold text-gray-900">Report Type:</strong> {formatReportType(reportType)}
      </p>
      <p className="m-0 text-gray-800">
        <strong className="font-semibold text-gray-900">Generated:</strong> {formatPrintTimestamp(new Date(generatedAt))}
      </p>
      {generatedBy?.name && (
        <p className="m-0 text-gray-800">
          <strong className="font-semibold text-gray-900">Prepared By:</strong> {generatedBy.name} ({formatRoleLabel(generatedBy.role)})
        </p>
      )}
    </div>
  );
}

/**
 * SummaryStatsTable Sub-component
 * Displays summary statistics in a clean 2x2 (or 3x2) table layout with borders
 * 
 * Requirement: 7.3, 3.4
 */
interface SummaryStatsTableProps {
  stats: {
    totalLendings: number;
    itemsReturned: number;
    activeLoans: number;
    newTrainees: number;
    totalTrainees?: number;
    totalPrograms?: number;
  };
}

function SummaryStatsTable({ stats }: SummaryStatsTableProps) {
  const hasExtendedStats = stats.totalTrainees !== undefined || stats.totalPrograms !== undefined;

  return (
    <div className="summary-stats-table print-avoid-break mb-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 border-b pb-1 mb-2">
        Summary Statistics
      </h2>
      <table className="print-table w-full border-collapse border border-gray-300 text-xs">
        <tbody>
          <tr className="border-b border-gray-300">
            <th className="bg-gray-100 text-left p-2 border-r border-gray-300 w-1/4 font-semibold text-gray-700">Total Lendings</th>
            <td className="p-2 border-r border-gray-300 w-1/4 font-bold text-gray-900">{formatPrintValue(stats.totalLendings)}</td>
            <th className="bg-gray-100 text-left p-2 border-r border-gray-300 w-1/4 font-semibold text-gray-700">Items Returned</th>
            <td className="p-2 w-1/4 font-bold text-gray-900">{formatPrintValue(stats.itemsReturned)}</td>
          </tr>
          <tr className={hasExtendedStats ? 'border-b border-gray-300' : ''}>
            <th className="bg-gray-100 text-left p-2 border-r border-gray-300 w-1/4 font-semibold text-gray-700">Active Loans</th>
            <td className="p-2 border-r border-gray-300 w-1/4 font-bold text-gray-900">{formatPrintValue(stats.activeLoans)}</td>
            <th className="bg-gray-100 text-left p-2 border-r border-gray-300 w-1/4 font-semibold text-gray-700">New Trainees</th>
            <td className="p-2 w-1/4 font-bold text-gray-900">{formatPrintValue(stats.newTrainees)}</td>
          </tr>
          {hasExtendedStats && (
            <tr>
              <th className="bg-gray-100 text-left p-2 border-r border-gray-300 w-1/4 font-semibold text-gray-700">Total Trainees</th>
              <td className="p-2 border-r border-gray-300 w-1/4 font-bold text-gray-900">{formatPrintValue(stats.totalTrainees)}</td>
              <th className="bg-gray-100 text-left p-2 border-r border-gray-300 w-1/4 font-semibold text-gray-700">Total Programs</th>
              <td className="p-2 w-1/4 font-bold text-gray-900">{formatPrintValue(stats.totalPrograms)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ActivityTrendTable Sub-component
 * Displays lending activity trend data in tabular format
 * 
 * Requirement: 7.4, 3.5
 */
interface ActivityTrendTableProps {
  data: Array<{ date: string; borrowed: number; returned: number }>;
}

function ActivityTrendTable({ data }: ActivityTrendTableProps) {
  const totalBorrowed = data.reduce((sum, row) => sum + (typeof row.borrowed === 'number' ? row.borrowed : 0), 0);
  const totalReturned = data.reduce((sum, row) => sum + (typeof row.returned === 'number' ? row.returned : 0), 0);

  return (
    <div className="activity-trend-table print-avoid-break mb-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 border-b pb-1 mb-2">
        Lending Activity Trend
      </h2>
      <table className="print-table w-full border-collapse border border-gray-300 text-xs">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="p-2 border-r border-gray-300 text-left font-semibold text-gray-700">Date</th>
            <th className="p-2 border-r border-gray-300 text-right font-semibold text-gray-700">Borrowed</th>
            <th className="p-2 text-right font-semibold text-gray-700">Returned</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-3 text-center text-gray-500 border border-gray-300">No data available for selected period</td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={index} className="border-b border-gray-200 odd:bg-white even:bg-gray-50/50">
                <td className="p-2 border-r border-gray-300 text-gray-800">{row.date}</td>
                <td className="p-2 border-r border-gray-300 text-right font-medium text-gray-900">{formatPrintValue(row.borrowed)}</td>
                <td className="p-2 text-right font-medium text-gray-900">{formatPrintValue(row.returned)}</td>
              </tr>
            ))
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-300 font-bold">
              <th scope="row" className="p-2 border-r border-gray-300 text-left text-gray-800">Total</th>
              <th scope="row" className="p-2 border-r border-gray-300 text-right text-gray-900">{totalBorrowed} borrowed</th>
              <th scope="row" className="p-2 text-right text-gray-900">{totalReturned} returned</th>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * CategoryDistributionTable Sub-component
 * Displays item category distribution with percentages
 * 
 * Requirement: 7.5, 3.6
 */
interface CategoryDistributionTableProps {
  data: Array<{ name: string; value: number }>;
}

function CategoryDistributionTable({ data }: CategoryDistributionTableProps) {
  const total = data.reduce((sum, item) => sum + (typeof item.value === 'number' ? item.value : 0), 0);
  
  return (
    <div className="category-distribution-table print-avoid-break mb-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 border-b pb-1 mb-2">
        Items by Category
      </h2>
      <table className="print-table w-full border-collapse border border-gray-300 text-xs">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="p-2 border-r border-gray-300 text-left font-semibold text-gray-700">Category</th>
            <th className="p-2 border-r border-gray-300 text-right font-semibold text-gray-700">Count</th>
            <th className="p-2 text-right font-semibold text-gray-700">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-3 text-center text-gray-500 border border-gray-300">No data available for selected period</td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={index} className="border-b border-gray-200 odd:bg-white even:bg-gray-50/50">
                <td className="p-2 border-r border-gray-300 text-gray-800">{row.name}</td>
                <td className="p-2 border-r border-gray-300 text-right font-medium text-gray-900">{formatPrintValue(row.value)}</td>
                <td className="p-2 text-right font-medium text-gray-900">{calculatePercentage(typeof row.value === 'number' ? row.value : 0, total)}</td>
              </tr>
            ))
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-300 font-bold">
              <th scope="row" className="p-2 border-r border-gray-300 text-left text-gray-800">Total</th>
              <th scope="row" className="p-2 border-r border-gray-300 text-right text-gray-900">{total} items</th>
              <th scope="row" className="p-2 text-right text-gray-900">{total > 0 ? '100% total' : '0% total'}</th>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * ProgramEnrollmentTable Sub-component
 * Displays trainee enrollment by program
 * 
 * Requirement: 7.6, 3.7
 */
interface ProgramEnrollmentTableProps {
  data: PrintableReportProps['programData'];
}

function resolveProgramTraineeCount(row: PrintableReportProps['programData'][number]): any {
  if ('trainees' in row) {
    return row.trainees;
  }
  if (typeof row.enrolledCount === 'number') {
    return row.enrolledCount;
  }
  if (Array.isArray(row.students)) {
    return row.students.length;
  }
  return undefined;
}

function ProgramEnrollmentTable({ data }: ProgramEnrollmentTableProps) {
  const hasExtendedProgramMetrics = data.some(
    (row) => row.completedCount !== undefined || row.completionRate !== undefined
  );
  const totalTrainees = data.reduce((sum, row) => {
    const val = resolveProgramTraineeCount(row);
    return sum + (typeof val === 'number' ? val : 0);
  }, 0);
  const totalCompleted = data.reduce(
    (sum, row) => sum + (typeof row.completedCount === 'number' ? row.completedCount : 0),
    0
  );

  return (
    <div className="program-enrollment-table print-avoid-break mb-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 border-b pb-1 mb-2">
        Trainees by Program
      </h2>
      <table className="print-table w-full border-collapse border border-gray-300 text-xs">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="p-2 border-r border-gray-300 text-left font-semibold text-gray-700">Program</th>
            <th className={`p-2 ${hasExtendedProgramMetrics ? 'border-r border-gray-300' : ''} text-right font-semibold text-gray-700`}>Trainees</th>
            {hasExtendedProgramMetrics && (
              <>
                <th className="p-2 border-r border-gray-300 text-right font-semibold text-gray-700">Completed</th>
                <th className="p-2 text-right font-semibold text-gray-700">Completion Rate</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={hasExtendedProgramMetrics ? 4 : 2} className="p-3 text-center text-gray-500 border border-gray-300">No data available for selected period</td>
            </tr>
          ) : (
            data.map((row, index) => {
              const traineeCount = resolveProgramTraineeCount(row);
              return (
                <tr key={index} className="border-b border-gray-200 odd:bg-white even:bg-gray-50/50">
                  <td className="p-2 border-r border-gray-300 text-gray-800">{row.program}</td>
                  <td className={`p-2 ${hasExtendedProgramMetrics ? 'border-r border-gray-300' : ''} text-right font-medium text-gray-900`}>
                    {formatPrintValue(traineeCount)}
                  </td>
                  {hasExtendedProgramMetrics && (
                    <>
                      <td className="p-2 border-r border-gray-300 text-right font-medium text-gray-900">
                        {formatPrintValue(row.completedCount ?? 0)}
                      </td>
                      <td className="p-2 text-right font-medium text-gray-900">
                        {typeof row.completionRate === 'number' ? `${row.completionRate.toFixed(1)}%` : '0.0%'}
                      </td>
                    </>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
        {data.length > 0 && (
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-300 font-bold">
              <th scope="row" className="p-2 border-r border-gray-300 text-left text-gray-800">Total</th>
              <th scope="row" className={`p-2 ${hasExtendedProgramMetrics ? 'border-r border-gray-300' : ''} text-right text-gray-900`}>
                {totalTrainees} trainees
              </th>
              {hasExtendedProgramMetrics && (
                <>
                  <th scope="row" className="p-2 border-r border-gray-300 text-right text-gray-900">
                    {totalCompleted} completed
                  </th>
                  <th scope="row" className="p-2 text-right text-gray-900">
                    {calculatePercentage(totalCompleted, totalTrainees)} avg
                  </th>
                </>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * EmploymentStatusPrintTable Sub-component
 * Displays trainee employment status summary & breakdown for Local Admin official reports
 */
interface EmploymentStatusPrintTableProps {
  data: NonNullable<PrintableReportProps['employmentData']>;
}

function EmploymentStatusPrintTable({ data }: EmploymentStatusPrintTableProps) {
  const counts = data.reduce((acc: Record<string, number>, row) => {
    const key = row.employmentStatus || 'Unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="employment-status-print-table print-avoid-break mb-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 border-b pb-1 mb-2">
        Trainee Employment Status ({data.length} Records)
      </h2>
      {Object.keys(counts).length > 0 && (
        <p className="text-[10px] text-gray-600 mb-2">
          Breakdown:{' '}
          {Object.entries(counts)
            .map(([status, count]) => `${status}: ${count} (${calculatePercentage(count, data.length)})`)
            .join(' • ')}
        </p>
      )}
      <table className="print-table w-full border-collapse border border-gray-300 text-xs">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="p-2 border-r border-gray-300 text-left font-semibold text-gray-700">Trainee</th>
            <th className="p-2 border-r border-gray-300 text-left font-semibold text-gray-700">Employment Status</th>
            <th className="p-2 text-left font-semibold text-gray-700">Program</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} className="border-b border-gray-200 odd:bg-white even:bg-gray-50/50">
              <td className="p-2 border-r border-gray-300 text-gray-800">{row.name}</td>
              <td className="p-2 border-r border-gray-300 text-gray-800">{row.employmentStatus}</td>
              <td className="p-2 text-gray-800">{row.program}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * PrintSignatures Sub-component
 * Renders official LGU / BMDC signature blocks (Prepared By, Verified By, Approved By)
 */
interface PrintSignaturesProps {
  generatedBy?: {
    name?: string;
    role?: string;
  };
}

function PrintSignatures({ generatedBy }: PrintSignaturesProps) {
  return (
    <div className="print-signatures print-avoid-break mt-8 pt-4">
      <div className="grid grid-cols-3 gap-8 text-xs text-gray-800">
        <div>
          <p className="font-semibold text-gray-600 mb-6">Prepared By:</p>
          <div className="border-b border-gray-400 pb-1 font-bold text-gray-900 min-h-[20px]">
            {generatedBy?.name || ''}
          </div>
          <p className="text-[10px] text-gray-600 mt-1">
            {generatedBy?.role ? formatRoleLabel(generatedBy.role) : 'Authorized Staff / Officer'}
          </p>
        </div>
        <div>
          <p className="font-semibold text-gray-600 mb-6">Verified By:</p>
          <div className="border-b border-gray-400 pb-1 font-bold text-gray-900 min-h-[20px]" />
          <p className="text-[10px] text-gray-600 mt-1">Program / Operations Coordinator</p>
        </div>
        <div>
          <p className="font-semibold text-gray-600 mb-6">Approved By:</p>
          <div className="border-b border-gray-400 pb-1 font-bold text-gray-900 min-h-[20px]" />
          <p className="text-[10px] text-gray-600 mt-1">Center Administrator / Head of Office</p>
        </div>
      </div>
    </div>
  );
}

/**
 * PrintFooter Sub-component
 * Displays institution name and generation timestamp
 * 
 * Requirement: 2.5
 */
interface PrintFooterProps {
  generatedAt: string;
}

function PrintFooter({ generatedAt }: PrintFooterProps) {
  const branding = useBranding();

  return (
    <div className="print-footer mt-6 pt-3 border-t border-gray-300 text-center text-[10px] text-gray-500">
      <p className="m-0">{branding.companyName} • Generated: {formatPrintTimestamp(new Date(generatedAt))}</p>
    </div>
  );
}

/**
 * Main PrintableReport Component
 * Orchestrates all sub-components to create a complete print layout
 * 
 * Requirements: 2.1, 7.1, 7.2, 7.3
 */
export default function PrintableReport(props: PrintableReportProps) {
  const {
    reportTitle,
    dateFrom,
    dateTo,
    reportType,
    generatedAt,
    summaryStats,
    activityData,
    categoryData,
    programData,
    employmentData,
    generatedBy,
    roleFlags,
  } = props;

  // When roleFlags is provided from ReportsPage, filter sections by role & reportType.
  // When roleFlags is omitted (e.g. unit tests), render all core sections for backward compatibility.
  const hasRoleFiltering = Boolean(roleFlags);
  const showActivity = !hasRoleFiltering || (
    !roleFlags?.isTrainingStaff && (reportType === 'all' || reportType === 'lendings')
  );
  const showCategories = !hasRoleFiltering || (
    !roleFlags?.isTrainingStaff && (reportType === 'all' || reportType === 'items')
  );
  const showPrograms = !hasRoleFiltering || (
    !roleFlags?.isInventoryStaff && (reportType === 'all' || reportType === 'trainees')
  );
  const showEmployment = Boolean(
    employmentData &&
    employmentData.length > 0 &&
    (!hasRoleFiltering || (roleFlags?.isLocalAdmin && (reportType === 'all' || reportType === 'trainees')))
  );

  return (
    <div className="print-container printable-report-container">
      <PrintHeader reportTitle={reportTitle} />
      
      <PrintMetadata
        dateFrom={dateFrom}
        dateTo={dateTo}
        reportType={reportType}
        generatedAt={generatedAt}
        generatedBy={generatedBy}
      />
      
      <SummaryStatsTable stats={summaryStats} />
      
      {showActivity && <ActivityTrendTable data={activityData} />}
      
      {showCategories && <CategoryDistributionTable data={categoryData} />}
      
      {showPrograms && <ProgramEnrollmentTable data={programData} />}

      {showEmployment && employmentData && <EmploymentStatusPrintTable data={employmentData} />}

      <PrintSignatures generatedBy={generatedBy} />
      
      <PrintFooter generatedAt={generatedAt} />
    </div>
  );
}

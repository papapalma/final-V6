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
  };
  
  // Chart data (already in table-friendly format)
  activityData: Array<{ date: string; borrowed: number; returned: number }>;
  categoryData: Array<{ name: string; value: number }>;
  programData: Array<{ program: string; trainees: number }>;
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
}

function PrintMetadata({ dateFrom, dateTo, reportType, generatedAt }: PrintMetadataProps) {
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
    </div>
  );
}

/**
 * SummaryStatsTable Sub-component
 * Displays summary statistics in a clean 2x2 table layout with borders
 * 
 * Requirement: 7.3, 3.4
 */
interface SummaryStatsTableProps {
  stats: {
    totalLendings: number;
    itemsReturned: number;
    activeLoans: number;
    newTrainees: number;
  };
}

function SummaryStatsTable({ stats }: SummaryStatsTableProps) {
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
          <tr>
            <th className="bg-gray-100 text-left p-2 border-r border-gray-300 w-1/4 font-semibold text-gray-700">Active Loans</th>
            <td className="p-2 border-r border-gray-300 w-1/4 font-bold text-gray-900">{formatPrintValue(stats.activeLoans)}</td>
            <th className="bg-gray-100 text-left p-2 border-r border-gray-300 w-1/4 font-semibold text-gray-700">New Trainees</th>
            <td className="p-2 w-1/4 font-bold text-gray-900">{formatPrintValue(stats.newTrainees)}</td>
          </tr>
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
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
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
                <td className="p-2 text-right font-medium text-gray-900">{calculatePercentage(row.value, total)}</td>
              </tr>
            ))
          )}
        </tbody>
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
  data: Array<{ program: string; trainees: number }>;
}

function ProgramEnrollmentTable({ data }: ProgramEnrollmentTableProps) {
  return (
    <div className="program-enrollment-table print-avoid-break mb-4">
      <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700 border-b pb-1 mb-2">
        Trainees by Program
      </h2>
      <table className="print-table w-full border-collapse border border-gray-300 text-xs">
        <thead>
          <tr className="bg-gray-100 border-b border-gray-300">
            <th className="p-2 border-r border-gray-300 text-left font-semibold text-gray-700">Program</th>
            <th className="p-2 text-right font-semibold text-gray-700">Trainees</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={2} className="p-3 text-center text-gray-500 border border-gray-300">No data available for selected period</td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={index} className="border-b border-gray-200 odd:bg-white even:bg-gray-50/50">
                <td className="p-2 border-r border-gray-300 text-gray-800">{row.program}</td>
                <td className="p-2 text-right font-medium text-gray-900">{formatPrintValue(row.trainees)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * PrintFooter Sub-component
 * Displays page numbers and generation timestamp
 * 
 * Requirement: 2.5
 */
interface PrintFooterProps {
  generatedAt: string;
}

function PrintFooter({ generatedAt }: PrintFooterProps) {
  return (
    <div className="print-footer mt-6 pt-3 border-t border-gray-300 text-center text-[10px] text-gray-500">
      <p className="m-0">Bongabong Manpower Development Center • Generated on {formatPrintTimestamp(new Date(generatedAt))}</p>
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
  } = props;

  return (
    <div className="print-container printable-report-container">
      <PrintHeader reportTitle={reportTitle} />
      
      <PrintMetadata
        dateFrom={dateFrom}
        dateTo={dateTo}
        reportType={reportType}
        generatedAt={generatedAt}
      />
      
      <SummaryStatsTable stats={summaryStats} />
      
      <ActivityTrendTable data={activityData} />
      
      <CategoryDistributionTable data={categoryData} />
      
      <ProgramEnrollmentTable data={programData} />
      
      <PrintFooter generatedAt={generatedAt} />
    </div>
  );
}

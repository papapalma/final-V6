import * as XLSX from 'xlsx';

/**
 * Utility function to format date string as YYYY-MM-DD
 */
export function getFormattedDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Export Trainees list to an Excel (.xlsx) file
 * 
 * @param trainees - List of filtered trainee records to export
 * @param customFilename - Optional custom filename without extension
 */
export function exportTraineesToExcel(trainees: any[], customFilename?: string) {
  if (!trainees || trainees.length === 0) {
    throw new Error('No trainee records to export.');
  }

  // Map each trainee record into human-readable column headers
  const rows = trainees.map((t, idx) => ({
    '#': idx + 1,
    'Trainee ID': t.traineeId || t.id || 'N/A',
    'Full Name': t.fullName || `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'N/A',
    'Program': t.programName || t.program || 'N/A',
    'Status': t.status || t.trainingStatus || 'Active',
    'Contact Number': t.contactNumber || t.phone || 'N/A',
    'Email Address': t.email || 'N/A',
    'Gender': t.gender || 'N/A',
    'Birthdate': t.birthDate ? new Date(t.birthDate).toLocaleDateString() : 'N/A',
    'Address': t.address || t.barangay || 'N/A',
    'Registered Date': t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set intelligent column widths
  const colWidths = [
    { wch: 4 },  // #
    { wch: 15 }, // Trainee ID
    { wch: 25 }, // Full Name
    { wch: 30 }, // Program
    { wch: 12 }, // Status
    { wch: 16 }, // Contact
    { wch: 25 }, // Email
    { wch: 10 }, // Gender
    { wch: 14 }, // Birthdate
    { wch: 25 }, // Address
    { wch: 16 }, // Registered Date
  ];
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Trainees');

  const filename = customFilename || `BMDC_Trainees_${getFormattedDateString()}`;
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Export Reports & Analytics data to an Excel (.xlsx) file with multiple sheets
 */
export function exportReportsToExcel(
  reportData: {
    reportTitle?: string;
    dateFrom?: string;
    dateTo?: string;
    summaryStats: {
      totalLendings: number;
      itemsReturned: number;
      activeLoans: number;
      newTrainees: number;
    };
    activityData: Array<{ date: string; borrowed: number; returned: number }>;
    categoryData: Array<{ name: string; value: number }>;
    programData: Array<{ program: string; trainees: number }>;
  },
  customFilename?: string
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Summary Statistics
  const summaryRows = [
    { 'Metric': 'Report Title', 'Value': reportData.reportTitle || 'Reports & Analytics' },
    { 'Metric': 'Date Range', 'Value': `${reportData.dateFrom || 'N/A'} to ${reportData.dateTo || 'N/A'}` },
    { 'Metric': 'Generated On', 'Value': new Date().toLocaleString() },
    { 'Metric': '---', 'Value': '---' },
    { 'Metric': 'Total Lendings', 'Value': reportData.summaryStats.totalLendings },
    { 'Metric': 'Items Returned', 'Value': reportData.summaryStats.itemsReturned },
    { 'Metric': 'Active Loans', 'Value': reportData.summaryStats.activeLoans },
    { 'Metric': 'New Trainees', 'Value': reportData.summaryStats.newTrainees },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 20 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Sheet 2: Activity Trend
  if (reportData.activityData && reportData.activityData.length > 0) {
    const activitySheet = XLSX.utils.json_to_sheet(
      reportData.activityData.map((a) => ({
        'Date': a.date,
        'Borrowed': a.borrowed,
        'Returned': a.returned,
      }))
    );
    activitySheet['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, activitySheet, 'Lending Activity');
  }

  // Sheet 3: Category Distribution
  if (reportData.categoryData && reportData.categoryData.length > 0) {
    const total = reportData.categoryData.reduce((sum, item) => sum + item.value, 0);
    const categorySheet = XLSX.utils.json_to_sheet(
      reportData.categoryData.map((c) => ({
        'Category': c.name,
        'Count': c.value,
        'Percentage': total > 0 ? `${((c.value / total) * 100).toFixed(1)}%` : '0%',
      }))
    );
    categorySheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, categorySheet, 'Categories');
  }

  // Sheet 4: Trainees by Program
  if (reportData.programData && reportData.programData.length > 0) {
    const programSheet = XLSX.utils.json_to_sheet(
      reportData.programData.map((p) => ({
        'Program': p.program,
        'Trainees Enrolled': p.trainees,
      }))
    );
    programSheet['!cols'] = [{ wch: 30 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, programSheet, 'Trainees by Program');
  }

  const filename = customFilename || `BMDC_Reports_${getFormattedDateString()}`;
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

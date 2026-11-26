import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import { Printer, Download, FileText } from 'lucide-react';
import lendingService from '../services/lendingService';

interface LendingData {
  id: string;
  borrower_name: string;
  borrower_contact?: string;
  quantity: number;
  lent_date: string;
  expected_return_date: string;
  actual_return_date?: string;
  status: string;
  notes?: string;
  item?: {
    id: string;
    name: string;
    description?: string;
    category?: string;
    location?: string;
  };
  trainee?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface BorrowingSlipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lendingId?: string;
  lendingData?: LendingData | null;
}

export default function BorrowingSlipModal({ open, onOpenChange, lendingId, lendingData: initialLendingData }: BorrowingSlipModalProps) {
  const [lending, setLending] = useState<LendingData | null>(initialLendingData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !lendingId) {
      setLending(initialLendingData || null);
      setError(null);
      return;
    }

    // If we have initial lending data, use it
    if (initialLendingData) {
      setLending(initialLendingData);
      return;
    }

    const fetchLending = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const apiResponse = await fetch(`/api/lendings/${lendingId}`);
        
        if (apiResponse.status === 403) {
          // If 403, it's likely a permission issue - just show error
          throw new Error('You do not have permission to view this slip');
        }
        
        if (!apiResponse.ok) {
          throw new Error('Failed to fetch lending record');
        }
        const data = await apiResponse.json();
        setLending(data.data || data);
      } catch (err: any) {
        console.error('Error fetching lending:', err);
        setError(err.message || 'Failed to load borrowing slip');
        toast.error('Failed to load borrowing slip');
      } finally {
        setLoading(false);
      }
    };

    fetchLending();
  }, [open, lendingId, initialLendingData]);

  const handlePrint = () => {
    if (!lending) return;
    
    try {
      // Create a temporary print window with only the slip content
      const printWindow = window.open('', '', 'width=800,height=600');
      if (!printWindow) {
        toast.error('Failed to open print window. Check pop-up blockers.');
        return;
      }
      
      const slipHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Borrowing Slip - ${lending.id}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
              color: #1f2937;
            }
            .slip-container {
              border: 1px solid #e5e7eb;
              padding: 40px;
              background: white;
            }
            .header {
              border-bottom: 2px solid #d1d5db;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            h1 {
              margin: 0 0 10px 0;
              font-size: 28px;
              font-weight: bold;
            }
            .subtitle {
              color: #6b7280;
              font-size: 14px;
            }
            .slip-id {
              margin-top: 15px;
              font-size: 13px;
              color: #6b7280;
            }
            .section {
              margin-bottom: 30px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
            }
            .section.full {
              grid-template-columns: 1fr;
            }
            .section-title {
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #4b5563;
              margin-bottom: 15px;
            }
            .field {
              margin-bottom: 12px;
            }
            .field-label {
              font-size: 12px;
              color: #6b7280;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .field-value {
              font-size: 15px;
              font-weight: 500;
              color: #1f2937;
            }
            .field-large {
              font-size: 20px;
              font-weight: 600;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
            }
            .status-active {
              background: #dcfce7;
              color: #166534;
            }
            .status-returned {
              background: #d1fae5;
              color: #065f46;
            }
            .status-overdue {
              background: #fee2e2;
              color: #991b1b;
            }
            .info-box {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              padding: 15px;
              border-radius: 6px;
              margin-bottom: 20px;
            }
            .info-box.success {
              background: #f0fdf4;
              border-color: #bbf7d0;
            }
            .dates-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 20px;
            }
            .footer {
              margin-top: 50px;
              border-top: 1px solid #d1d5db;
              padding-top: 30px;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            @media print {
              body {
                padding: 0;
              }
              .slip-container {
                border: none;
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="slip-container">
            <div class="header">
              <h1>BORROWING SLIP</h1>
              <p class="subtitle">Official Record of Item Loan</p>
              <div class="slip-id">
                <strong>Slip ID:</strong> ${lending.id}<br>
                <strong>Generated:</strong> ${new Date().toLocaleDateString()}
              </div>
            </div>

            <div class="section">
              <div>
                <div class="section-title">Borrower Information</div>
                <div class="field">
                  <div class="field-label">Name</div>
                  <div class="field-value">${lending.borrower_name}</div>
                </div>
                ${lending.borrower_contact ? `
                  <div class="field">
                    <div class="field-label">Contact</div>
                    <div class="field-value">${lending.borrower_contact}</div>
                  </div>
                ` : ''}
                ${lending.trainee ? `
                  <div class="field">
                    <div class="field-label">Trainee</div>
                    <div class="field-value">${lending.trainee.first_name} ${lending.trainee.last_name}</div>
                  </div>
                ` : ''}
              </div>

              <div>
                <div class="section-title">Item Information</div>
                <div class="field">
                  <div class="field-label">Item Name</div>
                  <div class="field-value">${lending.item?.name || 'Unknown'}</div>
                </div>
                ${lending.item?.category ? `
                  <div class="field">
                    <div class="field-label">Category</div>
                    <div class="field-value">${lending.item.category}</div>
                  </div>
                ` : ''}
                ${lending.item?.location ? `
                  <div class="field">
                    <div class="field-label">Location</div>
                    <div class="field-value">${lending.item.location}</div>
                  </div>
                ` : ''}
              </div>
            </div>

            ${lending.item?.description ? `
              <div class="section full">
                <div>
                  <div class="section-title">Item Description</div>
                  <div class="info-box">
                    ${lending.item.description}
                  </div>
                </div>
              </div>
            ` : ''}

            <div class="section full">
              <div>
                <div class="section-title">Loan Details</div>
                <div class="dates-grid">
                  <div>
                    <div class="field-label">Lent Date</div>
                    <div class="field-value">${new Date(lending.lent_date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div class="field-label">Due Date</div>
                    <div class="field-value">${new Date(lending.expected_return_date).toLocaleDateString()}</div>
                  </div>
                </div>
                <div class="dates-grid">
                  <div>
                    <div class="field-label">Quantity</div>
                    <div class="field-value field-large">${lending.quantity}</div>
                  </div>
                  <div>
                    <div class="field-label">Status</div>
                    <div class="field-value">
                      <span class="status-badge ${lending.status === 'returned' ? 'status-returned' : lending.status === 'overdue' ? 'status-overdue' : 'status-active'}">
                        ${lending.status.charAt(0).toUpperCase() + lending.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            ${lending.actual_return_date ? `
              <div class="section full">
                <div class="info-box success">
                  <strong>Returned Date:</strong> ${new Date(lending.actual_return_date).toLocaleDateString()}
                </div>
              </div>
            ` : ''}

            ${lending.notes ? `
              <div class="section full">
                <div>
                  <div class="section-title">Notes</div>
                  <div class="info-box">
                    ${lending.notes.replace(/\n/g, '<br>')}
                  </div>
                </div>
              </div>
            ` : ''}

            <div class="footer">
              This is an official borrowing slip. Keep for your records.
            </div>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(slipHTML);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      // Don't close the window automatically - let user decide
    }, 250);
    } catch (err) {
      console.error('Error printing slip:', err);
      toast.error('Failed to print slip');
    }
  };

  const handleDownload = async () => {
    if (!lending) return;
    try {
      // Generate HTML as downloadable file
      const slipHTML = `
BORROWING SLIP
==============
Slip ID: ${lending.id}
Generated: ${new Date().toLocaleDateString()}

BORROWER INFORMATION
====================
Name: ${lending.borrower_name}
${lending.borrower_contact ? `Contact: ${lending.borrower_contact}` : ''}
${lending.trainee ? `Trainee: ${lending.trainee.first_name} ${lending.trainee.last_name}` : ''}

ITEM INFORMATION
================
Item: ${lending.item?.name || 'Unknown'}
${lending.item?.category ? `Category: ${lending.item.category}` : ''}
${lending.item?.location ? `Location: ${lending.item.location}` : ''}
${lending.item?.description ? `Description: ${lending.item.description}` : ''}

LOAN DETAILS
============
Quantity: ${lending.quantity}
Lent Date: ${new Date(lending.lent_date).toLocaleDateString()}
Due Date: ${new Date(lending.expected_return_date).toLocaleDateString()}
Status: ${lending.status.charAt(0).toUpperCase() + lending.status.slice(1)}
${lending.actual_return_date ? `Returned Date: ${new Date(lending.actual_return_date).toLocaleDateString()}` : ''}

${lending.notes ? `NOTES\n=====\n${lending.notes}\n` : ''}

---
This is an official borrowing slip. Keep for your records.
      `;
      
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(slipHTML));
      element.setAttribute('download', `borrowing-slip-${lending.id}.txt`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast.success('Slip downloaded successfully');
    } catch (err) {
      console.error('Error downloading slip:', err);
      toast.error('Failed to download slip');
    }
  };

  const generateSlipContent = (data: LendingData): string => {
    const formattedLentDate = new Date(data.lent_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedDueDate = new Date(data.expected_return_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
BORROWING SLIP
==============
Slip ID: ${data.id}
Generated: ${new Date().toLocaleDateString()}

BORROWER INFORMATION
====================
Name: ${data.borrower_name}
${data.borrower_contact ? `Contact: ${data.borrower_contact}` : ''}
${data.trainee ? `Trainee: ${data.trainee.first_name} ${data.trainee.last_name}` : ''}

ITEM INFORMATION
================
Item: ${data.item?.name || 'Unknown'}
${data.item?.category ? `Category: ${data.item.category}` : ''}
${data.item?.location ? `Location: ${data.item.location}` : ''}
${data.item?.description ? `Description: ${data.item.description}` : ''}

LOAN DETAILS
============
Quantity: ${data.quantity}
Lent Date: ${formattedLentDate}
Due Date: ${formattedDueDate}
Status: ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}
${data.actual_return_date ? `Returned Date: ${new Date(data.actual_return_date).toLocaleDateString()}` : ''}

${data.notes ? `NOTES\n=====\n${data.notes}\n` : ''}

---
This is an official borrowing slip. Keep for your records.
    `.trim();
  };

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Borrowing Slip
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <div className="text-red-600 text-4xl mb-4">⚠️</div>
            <p className="text-slate-600">{error}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-1rem)] max-w-2xl overflow-y-auto p-4 sm:max-h-[90vh] sm:p-6"
        style={{ width: 'calc(100vw - 1rem)' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Borrowing Slip
          </DialogTitle>
          <DialogDescription>
            {lending?.id && `Slip ID: ${lending.id}`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : lending ? (
          <div className="space-y-6" data-no-translate="true">
            {/* Borrower Information */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Borrower Information
              </h3>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Name:</strong> {lending.borrower_name}
                </p>
                {lending.borrower_contact && (
                  <p>
                    <strong>Contact:</strong> {lending.borrower_contact}
                  </p>
                )}
                {lending.trainee && (
                  <p>
                    <strong>Trainee:</strong> {lending.trainee.first_name} {lending.trainee.last_name}
                  </p>
                )}
              </div>
            </div>

            {/* Item Information */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Item Information
              </h3>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Item:</strong> {lending.item?.name || 'Unknown'}
                </p>
                {lending.item?.category && (
                  <p>
                    <strong>Category:</strong> {lending.item.category}
                  </p>
                )}
                {lending.item?.location && (
                  <p>
                    <strong>Location:</strong> {lending.item.location}
                  </p>
                )}
                {lending.item?.description && (
                  <p>
                    <strong>Description:</strong> {lending.item.description}
                  </p>
                )}
              </div>
            </div>

            {/* Loan Details */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Loan Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Quantity</p>
                  <p className="text-lg font-semibold">{lending.quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Status</p>
                  <p
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      lending.status === 'returned'
                        ? 'bg-green-100 text-green-800'
                        : lending.status === 'overdue'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {lending.status.charAt(0).toUpperCase() + lending.status.slice(1)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Lent Date</p>
                  <p className="font-semibold">
                    {new Date(lending.lent_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Due Date</p>
                  <p className="font-semibold">
                    {new Date(lending.expected_return_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Return Information */}
            {lending.actual_return_date && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm">
                  <strong>Returned Date:</strong>{' '}
                  {new Date(lending.actual_return_date).toLocaleDateString()}
                </p>
              </div>
            )}

            {/* Notes */}
            {lending.notes && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Notes
                </h3>
                <p className="text-sm whitespace-pre-wrap text-slate-700">{lending.notes}</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={handleDownload} disabled={!lending || loading}>
            <Download className="mr-2 size-4" />
            Download
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!lending || loading}>
            <Printer className="mr-2 size-4" />
            Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

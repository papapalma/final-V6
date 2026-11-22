import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import lendingService from '../services/lendingService';
import { toast } from 'sonner';
import { Printer, Home } from 'lucide-react';
import { Button } from '../components/ui/button';
import { BrandLogo } from '../components/BrandLogo';
import { useBranding } from '../contexts/BrandingContext';

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

export default function PrintSlipPage() {
  const { id } = useParams<{ id: string }>();
  const { companyName, tagline } = useBranding();
  const [lending, setLending] = useState<LendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No lending ID provided');
      setLoading(false);
      return;
    }

    const fetchLending = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await lendingService.getLendingRecords({
          item_id: '', // Will use direct endpoint instead
        });
        
        // Since we need a specific lending, we'll make a direct API call
        const apiResponse = await fetch(`/api/lendings/${id}`);
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
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleGoHome = () => {
    window.location.href = '/lendings';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-slate-600">Loading borrowing slip...</p>
        </div>
      </div>
    );
  }

  if (error || !lending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-4xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Slip Not Found</h1>
          <p className="text-slate-600 mb-6">{error || 'The borrowing slip could not be found.'}</p>
          <Button onClick={handleGoHome} variant="outline">
            <Home className="mr-2 w-4 h-4" />
            Back to Lendings
          </Button>
        </div>
      </div>
    );
  }

  const formattedLentDate = new Date(lending.lent_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedDueDate = new Date(lending.expected_return_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedReturnDate = lending.actual_return_date
    ? new Date(lending.actual_return_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toolbar - Hidden in print */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Borrowing Slip</h1>
          <div className="flex gap-2">
            <Button onClick={handleGoHome} variant="outline" size="sm">
              <Home className="mr-2 w-4 h-4" />
              Back
            </Button>
            <Button onClick={handlePrint} size="sm" className="bg-blue-600 hover:bg-blue-700">
              <Printer className="mr-2 w-4 h-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Content */}
      <div className="print:p-0 p-4 py-6">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm print:shadow-none p-8 print:p-12">
          {/* Header */}
          <div className="border-b-2 border-slate-300 pb-6 mb-8">
            <div className="flex items-center gap-4 mb-4">
              <BrandLogo size="md" />
              <div className="min-w-0">
                <p className="text-base font-bold text-slate-900 leading-tight">{companyName}</p>
                <p className="text-xs text-slate-600">{tagline}</p>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-slate-900">BORROWING SLIP</h2>
            <p className="text-slate-600 mt-1">Official Record of Item Loan</p>
            <div className="mt-4 text-sm text-slate-600">
              <p>
                <strong>Slip ID:</strong> {lending.id}
              </p>
              <p>
                <strong>Generated:</strong> {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="space-y-8">
            {/* Borrower Information */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                  Borrower Information
                </h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Name</p>
                    <p className="text-lg font-semibold text-slate-900">{lending.borrower_name}</p>
                  </div>
                  {lending.borrower_contact && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Contact</p>
                      <p className="text-slate-700">{lending.borrower_contact}</p>
                    </div>
                  )}
                  {lending.trainee && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Trainee</p>
                      <p className="text-slate-700">
                        {lending.trainee.first_name} {lending.trainee.last_name}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Item Information */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                  Item Information
                </h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Item Name</p>
                    <p className="text-lg font-semibold text-slate-900">{lending.item?.name}</p>
                  </div>
                  {lending.item?.category && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Category</p>
                      <p className="text-slate-700">{lending.item.category}</p>
                    </div>
                  )}
                  {lending.item?.location && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide">Location</p>
                      <p className="text-slate-700">{lending.item.location}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {lending.item?.description && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Item Description
                </h3>
                <p className="text-slate-700 p-3 bg-slate-50 rounded border border-slate-200">
                  {lending.item.description}
                </p>
              </div>
            )}

            {/* Dates and Status */}
            <div className="grid grid-cols-2 gap-6 border-y border-slate-200 py-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Lent Date</p>
                  <p className="font-semibold text-slate-900">{formattedLentDate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Due Date</p>
                  <p className="font-semibold text-slate-900">{formattedDueDate}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Quantity</p>
                  <p className="text-2xl font-bold text-slate-900">{lending.quantity}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</p>
                  <p
                    className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
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
              </div>
            </div>

            {/* Return Information */}
            {lending.actual_return_date && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-900 uppercase tracking-wide mb-2">
                  Return Information
                </h3>
                <p className="text-slate-700">
                  <strong>Returned Date:</strong> {formattedReturnDate}
                </p>
              </div>
            )}

            {/* Notes */}
            {lending.notes && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Notes
                </h3>
                <p className="text-slate-700 p-3 bg-slate-50 rounded border border-slate-200 whitespace-pre-wrap">
                  {lending.notes}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-slate-300 pt-6 mt-8">
              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div>
                  <p className="text-xs text-slate-500 mb-8">Borrower Signature</p>
                  <div className="border-t border-slate-400 pt-2">_________________</div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-8">Lender Signature</p>
                  <div className="border-t border-slate-400 pt-2">_________________</div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-8">Date Acknowledged</p>
                  <div className="border-t border-slate-400 pt-2">_________________</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 text-center mt-8">
                This is an official borrowing slip. Keep for your records.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:p-12 {
            padding: 3rem !important;
          }
          @page {
            size: A4;
            margin: 0.5cm;
          }
        }
      `}</style>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { toast } from 'sonner';
import { PackagePlus } from 'lucide-react';
import lendingService from '../services/lendingService';
import inventoryService, { InventoryItem } from '../services/inventoryService';

interface AddLendingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedItem?: InventoryItem | null;
  onLendingCreated?: (lendingId: string, lendingData: any) => void;
}

type BorrowerType = 'external';

export default function AddLendingModal({ open, onOpenChange, onSuccess, preselectedItem, onLendingCreated }: AddLendingModalProps) {
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerContact, setBorrowerContact] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const selectedItem = items.find(i => i.id === itemId);
  const maxQuantity = selectedItem?.available_quantity ?? 0;

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    inventoryService.getInventoryItems()
      .then((itemsRes) => {
        const allItems = (itemsRes.data ?? []).filter(
          (item: InventoryItem) => item.available_quantity > 0
        );
        setItems(allItems);
        
        // If a preselected item is provided, set it
        if (preselectedItem) {
          setItemId(preselectedItem.id);
        }
      })
      .catch(() => toast.error('Failed to load items'))
      .finally(() => setLoadingData(false));
  }, [open, preselectedItem]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setBorrowerName('');
      setBorrowerContact('');
      setItemId('');
      setQuantity('1');
      setExpectedReturnDate('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemId) {
      toast.error('Please select an item');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (!qty || qty < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    if (qty > maxQuantity) {
      toast.error(`Only ${maxQuantity} available`);
      return;
    }

    if (!expectedReturnDate) {
      toast.error('Please set an expected return date');
      return;
    }

    if (new Date(expectedReturnDate) < new Date(today)) {
      toast.error('Expected return date cannot be in the past');
      return;
    }

    if (!borrowerName.trim()) {
      toast.error('Please enter the borrower name');
      return;
    }

    setLoading(true);
    try {
      const result = await lendingService.createLending({
        borrower_name: borrowerName.trim(),
        borrower_contact: borrowerContact.trim() || undefined,
        item_id: itemId,
        quantity: qty,
        expected_return_date: expectedReturnDate,
        notes: notes.trim() || undefined,
      });

      toast.success('Lending record created');
      onOpenChange(false);
      onSuccess?.();
      onLendingCreated?.(result.id, result);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Failed to create lending');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-1rem)] max-w-md overflow-y-auto p-4 sm:max-h-[90vh] sm:p-6"
        style={{ width: 'calc(100vw - 1rem)' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="size-5" />
            Borrow Item
          </DialogTitle>
          <DialogDescription>Record a new item borrowing</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Borrower fields */}
          <div className="space-y-1.5">
            <Label htmlFor="borrowerName">Borrower Name *</Label>
            <Input
              id="borrowerName"
              placeholder="Full name"
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="borrowerContact">Contact (optional)</Label>
            <Input
              id="borrowerContact"
              placeholder="Phone or email"
              value={borrowerContact}
              onChange={(e) => setBorrowerContact(e.target.value)}
            />
          </div>

          {/* Item selector */}
          <div className="space-y-1.5">
            <Label htmlFor="item">Item *</Label>
            {loadingData ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={itemId} onValueChange={(v: string) => { setItemId(v); setQuantity('1'); }}>
                <SelectTrigger id="item">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} (available: {item.available_quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={selectedItem ? maxQuantity : undefined}
              value={quantity}
              onChange={(e) => {
                const v = e.target.value;
                // Allow empty string while typing; clamp on submit
                if (v === '' || v === '-') { setQuantity(''); return; }
                const n = parseInt(v, 10);
                if (isNaN(n) || n < 0) return;
                setQuantity(String(n));
              }}
            />
            {selectedItem && (
              <p className="text-xs text-muted-foreground">
                Max available: {maxQuantity}
              </p>
            )}
          </div>

          {/* Expected return date */}
          <div className="space-y-1.5">
            <Label htmlFor="returnDate">Expected Return Date *</Label>
            <Input
              id="returnDate"
              type="date"
              min={today}
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Purpose, condition notes, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              {loading ? 'Saving...' : 'Borrow'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

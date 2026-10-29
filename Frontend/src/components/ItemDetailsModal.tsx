import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Package, MapPin, Calendar, CheckCircle2, Edit, QrCode, Trash2 } from 'lucide-react';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from './ui/alert-dialog';
import { useState } from 'react';
import { toast } from 'sonner';
import inventoryService from '../services/inventoryService';
import StockStatusBadge from './StockStatusBadge';

interface Item {
  id: string;
  name: string;
  category: string;
  quantity: number;
  available: number;
  location: string;
  description?: string;
  purchaseDate?: string;
  condition?: string;
  photoUrl?: string;
}

interface ItemDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  onEdit?: (item: Item) => void;
  onViewQR?: (item: Item) => void;
  onDelete?: () => void;
  canEdit?: boolean;
}

export default function ItemDetailsModal({ 
  open, 
  onOpenChange, 
  item,
  onEdit,
  onViewQR,
  onDelete,
  canEdit = false 
}: ItemDetailsModalProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!item) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await inventoryService.deleteInventoryItem(item.id);
      toast.success('Item deleted successfully and moved to archive');
      setDeleteDialogOpen(false);
      onOpenChange(false);
      if (onDelete) onDelete();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="flex max-h-[calc(100dvh-1rem)] flex-col p-0 sm:max-h-[85vh]"
        style={{ 
          width: 'calc(100% - 2rem)',
          maxWidth: '28rem'
        }}
        hideCloseButton={true}
      >
        <DialogHeader className="px-4 pt-4 pb-3 shrink-0 border-b">
          <DialogTitle className="text-base sm:text-lg">Item Details</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {/* Photo */}
          {item.photoUrl && (
            <div className="flex justify-center">
              <img
                src={item.photoUrl}
                alt={item.name}
                className="h-32 w-auto rounded-md object-cover shadow"
              />
            </div>
          )}

          {/* Header Info */}
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{item.name}</h3>
            <Badge variant="secondary" className="text-xs">{item.category}</Badge>
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <h4 className="mb-1 text-xs font-medium text-muted-foreground">Description</h4>
              <p className="text-xs text-foreground">{item.description}</p>
            </div>
          )}

          {/* Details List */}
          <div className="space-y-2">
            {/* Quantity */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
              <Package className="size-4 text-primary shrink-0" />
              <div className="flex-1 flex justify-between items-center gap-2">
                <span className="text-xs text-muted-foreground">Total Quantity</span>
                <span className="font-semibold text-sm">{item.quantity}</span>
              </div>
            </div>

            {/* Available */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
              <CheckCircle2 className="size-4 text-secondary shrink-0" />
              <div className="flex-1 flex justify-between items-center gap-2">
                <span className="text-xs text-muted-foreground">Available</span>
                <StockStatusBadge available={item.available} total={item.quantity} />
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
              <MapPin className="size-4 text-accent-foreground shrink-0" />
              <div className="flex-1 flex justify-between items-center gap-2">
                <span className="text-xs text-muted-foreground">Location</span>
                <span className="font-semibold text-sm">{item.location}</span>
              </div>
            </div>

            {/* Purchase Date */}
            {item.purchaseDate && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                <Calendar className="size-4 text-secondary shrink-0" />
                <div className="flex-1 flex justify-between items-center gap-2">
                  <span className="text-xs text-muted-foreground">Purchase Date</span>
                  <span className="font-semibold text-sm">{formatDate(item.purchaseDate)}</span>
                </div>
              </div>
            )}

            {/* Condition */}
            {item.condition && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30">
                <CheckCircle2 className="size-4 text-accent-foreground shrink-0" />
                <div className="flex-1 flex justify-between items-center gap-2">
                  <span className="text-xs text-muted-foreground">Condition</span>
                  <span className="font-semibold text-sm capitalize">{item.condition}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 px-4 pb-4 pt-3 border-t space-y-2">
          <Button 
            variant="outline" 
            className="w-full text-sm h-10"
            onClick={() => {
              if (onViewQR) onViewQR(item);
            }}
          >
            <QrCode className="mr-2 size-4" />
            View QR Code
          </Button>
          {canEdit && (
            <>
              <Button 
                variant="default" 
                className="w-full text-sm h-10"
                onClick={() => {
                  if (onEdit) onEdit(item);
                  onOpenChange(false);
                }}
              >
                <Edit className="mr-2 size-4" />
                Edit Item
              </Button>
              <Button 
                variant="destructive" 
                className="w-full text-sm h-10"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete Item
              </Button>
            </>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="w-[92vw] max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base sm:text-lg">Delete Item?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs sm:text-sm">
                Are you sure you want to delete "{item.name}"? The item will be moved to the archive and can be restored later from the Archive page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeleting ? 'Deleting...' : 'Delete to Archive'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

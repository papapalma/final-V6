import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import QRCodeModal from '../components/QRCodeModal';
import ItemDetailsModal from '../components/ItemDetailsModal';
import StockStatusBadge from '../components/StockStatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, PackagePlus, QrCode, Edit, Package, LayoutGrid, TableIcon, Download, Eye, Building2, AlertTriangle, X } from 'lucide-react';
import PaginationWrapper from '../components/PaginationWrapper';
import { generateItemsPDF } from '../utils/pdfGenerator';
import { toast } from 'sonner';
import inventoryService from '../services/inventoryService';
import { getThumbnailUrl } from '../services/api';
import { CardGridSkeleton } from '../components/LoadingSkeletons';
import { Skeleton } from '../components/ui/skeleton';
import logger from '../utils/logger';

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

type ViewMode = 'card' | 'table';

export default function ItemsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { hasPermission, user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'out' | 'low' | 'good'>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Apple keyboard shortcut (/ or Cmd/Ctrl+K to focus search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputActive = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable
      );

      if ((e.key === '/' && !isInputActive) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          setSearchQuery('');
        } else {
          searchInputRef.current?.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // Fetch items from backend
  useEffect(() => {
    fetchItems();
  }, [filterCategory]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await inventoryService.getInventoryItems({
        category: filterCategory !== 'all' ? filterCategory : undefined
      });
      
      // Map backend data to Item interface
      const mappedItems = (response.data || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        available: item.available_quantity,
        location: item.location,
        description: item.description,
        photoUrl: getThumbnailUrl(item.thumbnail_path || item.image_path),
        condition: item.condition,
        purchaseDate: item.purchase_date
      }));
      
      setItems(mappedItems);
      
      // Extract unique categories
      const uniqueCategories = ['all', ...new Set(mappedItems.map((item: Item) => item.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      logger.error('Failed to fetch items', { error });
      toast.error('Failed to load items');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('itemsViewMode') as ViewMode;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('itemsViewMode', mode);
    setCurrentPage(1); // Reset to first page when changing view
  };

  const handleViewDetails = (item: Item) => {
    setSelectedItem(item);
    setDetailsModalOpen(true);
  };

  const handleEditItem = (item: Item) => {
    navigate(`/items/${item.id}/edit`);
  };

  const handleViewQR = (item: Item) => {
    setSelectedItem(item);
    setQrModalOpen(true);
  };

  const filteredItems = items.filter(item => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query ||
      item.name.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      (item.description ? item.description.toLowerCase().includes(query) : false);
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesStock = filterStockStatus === 'all' ||
      (filterStockStatus === 'out' && item.available <= 0) ||
      (filterStockStatus === 'low' && item.available > 0 && item.available < 5) ||
      (filterStockStatus === 'good' && item.available >= 5);
    return matchesSearch && matchesCategory && matchesStock;
  });

  const outOfStockCount = items.filter(item => item.available <= 0).length;
  const lowStockCount = items.filter(item => item.available > 0 && item.available < 5).length;
  const inStockCount = items.filter(item => item.available >= 5).length;

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  // Reset to first page when client filters change (instant 0ms pagination update)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStockStatus]);

  // Show loading state
  if (loading) {
    return (
      <DashboardLayout title="Item Management">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Skeleton className="h-10 w-full sm:w-32" />
              <Skeleton className="h-10 w-full sm:w-28" />
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-full sm:w-[180px]" />
              </div>
            </CardContent>
          </Card>

          <CardGridSkeleton count={6} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Item Management">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2">
              Items
              {user?.tenantName && (
                <Badge variant="outline" className="text-xs font-normal">
                  <Building2 className="mr-1 size-3" />
                  {user.tenantName}
                </Badge>
              )}
            </h2>
            <p className="text-muted-foreground">
              Manage inventory and equipment for {user?.tenantName || 'your organization'}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none" 
              onClick={() => {
                if (filteredItems.length === 0) {
                  toast.error('No items to download');
                  return;
                }
                generateItemsPDF(filteredItems);
                toast.success('PDF downloaded successfully');
              }}
            >
              <Download className="mr-2 size-4" />
              Download PDF
            </Button>
            {hasPermission('canManageItems') && (
              <Button className="flex-1 sm:flex-none" onClick={() => navigate('/items/new')}>
                <PackagePlus className="mr-2 size-4" />
                Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="border-border/60 shadow-sm backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search equipment by name, category, location, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.35rem', paddingRight: '2.5rem', height: '2.5rem' }}
                  className="rounded-xl bg-background border-input text-sm focus-visible:ring-2 focus-visible:ring-primary/20"
                />
                
                {/* Clear Button (✕) when typing, or Shortcut Badge (/) when empty */}
                <div
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5"
                  style={{ right: '0.75rem' }}
                >
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <div className="hidden sm:flex items-center gap-1 pointer-events-none">
                      <kbd className="inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/70 bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-xs">
                        /
                      </kbd>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger
                    style={{ height: '2.5rem' }}
                    className="w-full sm:w-[180px] rounded-xl border border-input bg-background text-sm"
                  >
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>
                        {cat === 'all' ? 'All Categories' : cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div
                  style={{ height: '2.5rem' }}
                  className="hidden sm:flex items-center gap-1 border border-input rounded-xl p-1 bg-muted/20"
                >
                  <Button
                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => handleViewModeChange('card')}
                    className="size-8 rounded-lg"
                  >
                    <LayoutGrid className="size-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => handleViewModeChange('table')}
                    className="size-8 rounded-lg"
                  >
                    <TableIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Apple-Style Quick Stock Filter Capsules + Live Match Counter */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-border/40">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-[11px] select-none inline-flex items-center">
                  Stock:
                </span>
                
                <button
                  type="button"
                  onClick={() => setFilterStockStatus('all')}
                  className={`stock-pill-base ${
                    filterStockStatus === 'all' ? 'stock-pill-all-active' : 'stock-pill-all'
                  }`}
                >
                  All ({items.length})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStockStatus(filterStockStatus === 'out' ? 'all' : 'out')}
                  className={`stock-pill-base ${
                    filterStockStatus === 'out' ? 'stock-pill-out-active' : 'stock-pill-out'
                  }`}
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: filterStockStatus === 'out' ? '#FFFFFF' : '#FF3B30' }}
                  />
                  Out of Stock ({outOfStockCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStockStatus(filterStockStatus === 'low' ? 'all' : 'low')}
                  className={`stock-pill-base ${
                    filterStockStatus === 'low' ? 'stock-pill-low-active' : 'stock-pill-low'
                  }`}
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: filterStockStatus === 'low' ? '#FFFFFF' : '#FF9500' }}
                  />
                  Low Stock ({lowStockCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStockStatus(filterStockStatus === 'good' ? 'all' : 'good')}
                  className={`stock-pill-base ${
                    filterStockStatus === 'good' ? 'stock-pill-good-active' : 'stock-pill-good'
                  }`}
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: filterStockStatus === 'good' ? '#FFFFFF' : '#34C759' }}
                  />
                  In Stock ({inStockCount})
                </button>
              </div>

              {/* Live search feedback counter & clear */}
              <div className="flex items-center gap-2 text-xs">
                {(searchQuery || filterStockStatus !== 'all' || filterCategory !== 'all') && (
                  <span className="text-muted-foreground font-medium">
                    {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
                  </span>
                )}
                {(searchQuery || filterStockStatus !== 'all' || filterCategory !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterStockStatus('all');
                      setFilterCategory('all');
                      searchInputRef.current?.focus();
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    Reset all
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Desktop Card View */}
        {filteredItems.length > 0 && viewMode === 'card' && (
          <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedItems.map((item) => (
              <Card key={item.id} className="group transition-all hover:shadow-lg overflow-hidden cursor-pointer" onClick={() => handleViewDetails(item)}>
                {item.photoUrl && (
                  <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <img
                      src={item.photoUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <CardContent className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                      <Package className="size-6 text-primary" />
                    </div>
                    <Badge variant="secondary">{item.category}</Badge>
                  </div>
                  
                  <h3 className="mb-2 line-clamp-2">{item.name}</h3>
                  
                  <div className="mb-4 space-y-2 text-sm">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Total Quantity:</span>
                      <span className="font-medium">{item.quantity}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Availability:</span>
                      <StockStatusBadge available={item.available} />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="truncate ml-2 font-medium">{item.location}</span>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden">
                    <div className="flex gap-2 invisible opacity-0 translate-y-3 max-h-0 transition-all duration-300 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-hover:max-h-16 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:max-h-16">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleViewQR(item);
                        }}
                      >
                        <QrCode className="mr-2 size-4" />
                        QR Code
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleViewDetails(item);
                        }}
                      >
                        <Eye className="mr-2 size-4" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Desktop Table View */}
        {filteredItems.length > 0 && viewMode === 'table' && (
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.photoUrl ? (
                            <div className="size-10 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800">
                              <img
                                src={item.photoUrl}
                                alt={item.name}
                                className="size-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                              <Package className="size-5 text-primary" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate">{item.name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.category}</Badge>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        <StockStatusBadge available={item.available} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.location}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {hasPermission('canManageItems') && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEditItem(item)}
                            >
                              <Edit className="size-4" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleViewQR(item)}
                          >
                            <QrCode className="size-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleViewDetails(item)}
                          >
                            <Package className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Items List - Mobile */}
        {filteredItems.length > 0 && (
          <div className="sm:hidden space-y-3">
          {paginatedItems.map((item) => (
            <Card key={item.id} className="cursor-pointer" onClick={() => handleViewDetails(item)}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Package className="size-6 text-primary" />
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h4 className="line-clamp-2 flex-1">{item.name}</h4>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {item.category}
                      </Badge>
                    </div>
                    
                    <div className="mb-3 space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Available:</span>
                        <span className={item.available === 0 ? 'text-destructive' : 'text-secondary'}>
                          {item.available} / {item.quantity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.location}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleViewQR(item);
                        }}
                      >
                        <QrCode className="mr-1 size-4" />
                        QR
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          handleViewDetails(item);
                        }}
                      >
                        <Eye className="mr-1 size-4" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        )}

        {/* Apple-Style Search Empty State */}
        {filteredItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 backdrop-blur-sm p-12 text-center my-6">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground shadow-inner mb-4">
              <Search className="size-6 opacity-75" />
            </div>
            <h3 className="text-base font-semibold tracking-tight text-foreground">No equipment found</h3>
            <p className="mt-1.5 text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery
                ? `No items match "${searchQuery}". Try checking your spelling or clearing search filters.`
                : 'No equipment items currently match the active filters.'}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs"
                onClick={() => {
                  setSearchQuery('');
                  setFilterStockStatus('all');
                  setFilterCategory('all');
                  searchInputRef.current?.focus();
                }}
              >
                Clear search & filters
              </Button>
            </div>
          </div>
        )}

        {/* Pagination */}
        {filteredItems.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <PaginationWrapper
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsCount={filteredItems.length}
              itemsPerPage={itemsPerPage}
            />
          </div>
        )}
      </div>

      <QRCodeModal open={qrModalOpen} onOpenChange={setQrModalOpen} item={selectedItem} />
      <ItemDetailsModal 
        open={detailsModalOpen} 
        onOpenChange={setDetailsModalOpen} 
        item={selectedItem}
        onEdit={handleEditItem}
        onViewQR={handleViewQR}
        onDelete={fetchItems}
        canEdit={hasPermission('canManageItems')}
      />
    </DashboardLayout>
  );
}
import { ReactNode, useState, useEffect, useMemo, memo, lazy, Suspense } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getRoleDisplayName, getRoleBadgeColor } from '../utils/roles';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { getFileUrl } from '../services/api';
import OverdueBellNotification from './OverdueBellNotification';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { 
  LayoutDashboard, 
  Users, 
  User,
  Package, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut, 
  Moon,
  Sun,
  GraduationCap,
  Globe,
  UserCog,
  Activity,
  AlertTriangle,
  ChevronDown,
  QrCode,
  Calendar,
  Activity as ActivityIcon,
  ClipboardList,
  BookOpen,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  permission?: keyof import('../utils/roles').Permission;
  children?: NavItem[];
}

// Memoized navigation arrays to prevent recalculation
const NAVIGATION_ARRAYS = {
  desktop: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Platform Admin', href: '/super-admin', icon: ActivityIcon },
    { name: 'Trainees', href: '/trainees', icon: Users, permission: 'canManageTrainees' as const },
    { name: 'Equipments', href: '/items', icon: Package, permission: 'canManageItems' as const },
    { name: 'Borrowing', href: '/lendings', icon: FileText, permission: 'canManageLendings' as const },
    { name: 'Programs', href: '/programs', icon: GraduationCap, permission: 'canManagePrograms' as const },
    { name: 'Registrations', href: '/registrations', icon: ClipboardList, permission: 'canManageTrainees' as const },
    { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'canViewReports' as const },
    { 
      name: 'Settings', 
      icon: Settings, 
      children: [
        { name: 'Activity Logs', href: '/activity-logs', icon: Activity, permission: 'canViewActivityLogs' as const },
        { name: 'Non-Attendance Dates', href: '/non-attendance-dates', icon: Calendar, permission: 'canManagePrograms' as const },
        { name: 'Landing Content', href: '/admin/landing-content', icon: FileText, permission: 'canManageCMS' as const },
        { name: 'Requirements Management', href: '/admin/requirements', icon: BookOpen, permission: 'canManagePrograms' as const },
        { name: 'Archive', href: '/admin/archive', icon: Trash2, permission: 'canManageAccounts' as const },
        { name: 'Account', href: '/account-management', icon: UserCog, permission: 'canManageAccounts' as const },
      ]
    },
  ] as NavItem[],
  trainee: [
    { name: 'Dashboard', href: '/trainee/dashboard', icon: LayoutDashboard },
    // Attendance is now in the program details modal
    // { name: 'Attendance', href: '/trainee/attendance', icon: Calendar },
    { name: 'Profile', href: '/trainee/profile', icon: User },
    { name: 'Programs', href: '/trainee/programs', icon: GraduationCap },
    { name: 'Applications', href: '/trainee/applications', icon: ClipboardList },
  ] as NavItem[],
  superAdmin: [
    { name: 'Dashboard', href: '/super-admin', icon: ActivityIcon },
    { name: 'Reports', href: '/super-admin/reports', icon: BarChart3 },
    { name: 'Activity Logs', href: '/activity-logs', icon: Activity },
    { name: 'Extension Requests', href: '/extension-requests', icon: ClipboardList },
    { name: 'Account', href: '/super-admin/accounts', icon: UserCog },
  ] as NavItem[],
};

// Memoized navigation filter function
const filterNavigation = (nav: NavItem[], hasPermission: (perm: any) => boolean, excludeSuperAdmin = true): NavItem[] => {
  return nav
    .filter(item => {
      if (excludeSuperAdmin && item.href === '/super-admin') return false;
      if (item.children) {
        const filteredChildren = item.children.filter(child =>
          !child.permission || hasPermission(child.permission)
        );
        return filteredChildren.length > 0;
      }
      return !item.permission || hasPermission(item.permission);
    })
    .map(item => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter(child =>
            !child.permission || hasPermission(child.permission)
          ),
        };
      }
      return item;
    });
};

// Memoized Sidebar Logo Component
const SidebarLogo = memo(({ cmsSettings, user }: any) => (
  <div className="flex h-16 shrink-0 items-center gap-3">
    {cmsSettings?.appearance?.logo ? (
      <img
        src={getFileUrl(cmsSettings.appearance.logo)}
        alt="Logo"
        className="size-10 rounded-xl object-contain shadow-sm border border-border"
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    ) : (
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <span className="text-xs font-bold">BMDC</span>
      </div>
    )}
    <div className="min-w-0">
      <h3 className="text-sm font-bold text-foreground truncate">{user?.tenantName || cmsSettings?.footer?.companyName?.value || 'Bongabong MDC'}</h3>
      <p className="text-xs font-medium text-muted-foreground truncate max-w-[140px]">{cmsSettings?.footer?.tagline?.value || 'Training Center'}</p>
    </div>
  </div>
));
SidebarLogo.displayName = 'SidebarLogo';

// Memoized Navigation Item Component
const NavItemComponent = memo(({ item, isActive, isChildActive, onToggle, openDropdown }: any) => {
  if (item.children) {
    return (
      <div>
        <button
          onClick={() => onToggle(item.name)}
          className={`ds-nav-item flex w-full items-center justify-between gap-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isChildActive(item)
              ? 'is-active bg-primary/10 text-primary font-semibold'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-x-3">
            <item.icon className="size-4.5 shrink-0" />
            {item.name}
          </div>
          <ChevronDown className={`size-4 transition-transform ${
            openDropdown === item.name ? 'rotate-180' : ''
          }`} />
        </button>
        {openDropdown === item.name && (
          <ul className="mt-1 space-y-1 pl-4">
            {item.children.map((child: NavItem) => (
              <li key={child.name}>
                <Link
                  to={child.href!}
                  className={`ds-nav-item flex items-center gap-x-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    isActive(child.href!)
                      ? 'is-active bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <child.icon className="size-4 shrink-0" />
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.href!}
      className={`ds-nav-item flex items-center justify-between gap-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive(item.href!)
          ? 'is-active bg-primary text-primary-foreground font-semibold shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-x-3">
        <item.icon className="size-4.5 shrink-0" />
        {item.name}
      </div>
    </Link>
  );
});
NavItemComponent.displayName = 'NavItemComponent';

// Memoized User Profile Section
const UserProfileSection = memo(({ user, isDark, toggleTheme, openLogoutDialog }: any) => (
  <div className="border-t border-border pt-4">
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ds-nav-item flex w-full items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-muted transition-colors">
          <Avatar className="size-8 border border-border">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{user?.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Badge className={`text-[10px] px-1.5 py-0 font-medium ${user ? getRoleBadgeColor(user.role) : ''}`}>
                {user ? getRoleDisplayName(user.role) : 'User'}
              </Badge>
            </div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleTheme}>
          {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openLogoutDialog}>
          <LogOut className="mr-2 size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
));
UserProfileSection.displayName = 'UserProfileSection';

// Main DashboardLayout Component
export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission, isAuthReady } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [cmsSettings, setCmsSettings] = useState<any>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [pendingRegistrationCount, setPendingRegistrationCount] = useState(0);
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Load CMS settings from localStorage (one-time)
  useEffect(() => {
    const savedSettings = localStorage.getItem('bmdc-cms-settings');
    if (savedSettings) {
      setCmsSettings(JSON.parse(savedSettings));
    }
  }, []);

  // Handle scroll to show/hide bottom nav
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show nav if scrolled to top or scrolling up
      if (currentScrollY < lastScrollY) {
        setShowBottomNav(true);
      } 
      // Hide nav if scrolling down and not near top
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setShowBottomNav(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  // Lazy load pending registrations count
  useEffect(() => {
    if ((user?.role === 'local_admin' || user?.role === 'staff_training_coordinator' || user?.role === 'super_admin') && user?.tenantId) {
      const fetchPendingCount = async () => {
        try {
          const api = await import('../services/api').then(m => m.default);
          const response = await api.get('/registrations/pending-count', undefined, { timeout: 5000 });
          setPendingRegistrationCount(response.data?.count || 0);
        } catch (error) {
          // Silently fail - set count to 0 on error
          setPendingRegistrationCount(0);
        }
      };
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    } else {
      // Clear count if user doesn't have permission
      setPendingRegistrationCount(0);
    }
  }, [user]);

  const openLogoutDialog = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = async () => {
    setLogoutDialogOpen(false);
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;
  
  const isChildActive = (item: NavItem): boolean => {
    if (item.href && isActive(item.href)) return true;
    if (item.children) {
      return item.children.some(child => child.href && isActive(child.href));
    }
    return false;
  };

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  // Memoize filtered navigation to prevent recalculation on every render
  const filteredNavigation = useMemo(() => {
    if (user?.role === 'trainee') {
      return NAVIGATION_ARRAYS.trainee;
    } else if (user?.role === 'super_admin') {
      return NAVIGATION_ARRAYS.superAdmin;
    } else {
      return filterNavigation(NAVIGATION_ARRAYS.desktop, (perm) => hasPermission(perm));
    }
  }, [user?.role, hasPermission]);

  const mobileNavigation = useMemo(() => {
    return filteredNavigation;
  }, [filteredNavigation]);

  const mobileMenuItems = useMemo(
    () => mobileNavigation.flatMap((item) => item.children || [item]),
    [mobileNavigation]
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-background ds-shell">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="ds-sidebar flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
          {/* Logo */}
          <SidebarLogo cmsSettings={cmsSettings} user={user} />

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul className="flex flex-1 flex-col gap-y-1">
              {filteredNavigation.map((item) => (
                <li key={item.name}>
                  <NavItemComponent 
                    item={item}
                    isActive={isActive}
                    isChildActive={isChildActive}
                    onToggle={toggleDropdown}
                    openDropdown={openDropdown}
                  />
                </li>
              ))}
            </ul>
          </nav>

          {/* User Profile */}
          <UserProfileSection 
            user={user}
            isDark={isDark}
            toggleTheme={toggleTheme}
            openLogoutDialog={openLogoutDialog}
          />
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className={`${!isAuthReady ? 'hidden' : 'md:hidden fixed'} bottom-0 left-0 right-0 z-50 border-t border-border bg-card shadow-lg transition-transform duration-300 ease-out ${
        showBottomNav ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="flex h-16 w-full items-stretch">
          {mobileMenuItems.slice(0, 5).map((item) => {
            const isCurrentActive = item.href && isActive(item.href);
            
            return (
              <Link
                key={item.name}
                to={item.href || '#'}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors ${
                  isCurrentActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <item.icon className="size-5" />
                <span className="line-clamp-1 text-center">{item.name}</span>
              </Link>
            );
          })}

          {mobileMenuItems.length > 5 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] text-muted-foreground transition-colors hover:text-foreground">
                  <Settings className="size-5" />
                  <span>More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="mb-2 w-56">
                {mobileMenuItems.slice(5).map((item) => (
                  <DropdownMenuItem key={item.name} asChild>
                    <Link to={item.href || '#'} className="flex cursor-pointer items-center gap-2">
                      <item.icon className="size-4" />
                      {item.name}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar - Height: h-16 (64px), z-index: z-30 */}
        <div className="ds-topbar sticky top-0 z-30 flex h-16 min-w-0 shrink-0 items-center gap-x-3 border-b border-border bg-card px-3 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 gap-x-3 self-stretch lg:gap-x-6">
            <div className="flex min-w-0 flex-1 items-center">
              {title && <h1 className="truncate text-foreground">{title}</h1>}
            </div>
            <div className="flex shrink-0 items-center gap-x-1.5 sm:gap-x-2 lg:gap-x-6">
              {/* Tenant name badge — desktop only */}
              {user?.tenantName && (
                <span className="hidden lg:inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs text-primary font-medium">
                  {user.tenantName}
                </span>
              )}
              {/* Overdue Bell Notification */}
              <Suspense fallback={null}>
                <OverdueBellNotification />
              </Suspense>
              
              {hasPermission('canScanQR') && (
                <Link to="/scan">
                  <Button variant="ghost" size="icon">
                    <QrCode className="size-5" />
                  </Button>
                </Link>
              )}
              
              {/* Mobile User Menu */}
              <div className="lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Avatar className="size-6">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {user?.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user ? getRoleDisplayName(user.role) : 'User'}
                        </p>
                        {user?.tenantName && (
                          <p className="text-xs leading-none text-primary mt-1">{user.tenantName}</p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={toggleTheme}>
                      {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
                      {isDark ? 'Light Mode' : 'Dark Mode'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={openLogoutDialog} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 size-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="hidden lg:flex"
              >
                {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="min-w-0 pb-20 transition-all duration-300 md:pb-8">
          <div className="ds-page px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be signed out of your account and returned to the login screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout} className="bg-red-600 hover:bg-red-700">Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


import { ReactNode, useState, useEffect, useMemo, memo, Suspense } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage, TranslationKey } from '../contexts/LanguageContext';
import { usePortalDomLocalizer } from '../i18n/portalDomLocalizer';
import { useMessenger } from '../contexts/MessengerContext';
import { BrandLogo } from './BrandLogo';
import { TraineeMessengerDrawer } from './messenger/TraineeMessengerDrawer';
import { getRoleDisplayName, getRoleBadgeColor } from '../utils/roles';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { NotificationBadge, formatBadgeAriaLabel } from './ui/notification-badge';
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
  Megaphone,
  MessageSquare,
  Menu,
  X,
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
  labelKey?: TranslationKey;
  href?: string;
  icon: any;
  permission?: keyof import('../utils/roles').Permission;
  children?: NavItem[];
}

// Memoized navigation arrays to prevent recalculation
const NAVIGATION_ARRAYS = {
  desktop: [
    { name: 'Dashboard', labelKey: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Platform Admin', labelKey: 'nav.platformAdmin', href: '/super-admin', icon: ActivityIcon },
    { name: 'Trainees', labelKey: 'nav.trainees', href: '/trainees', icon: Users, permission: 'canManageTrainees' as const },
    { name: 'Inventory', labelKey: 'nav.inventory', href: '/items', icon: Package, permission: 'canManageItems' as const },
    { name: 'Borrowing', labelKey: 'nav.borrowing', href: '/lendings', icon: FileText, permission: 'canManageLendings' as const },
    { name: 'Programs', labelKey: 'nav.programs', href: '/programs', icon: GraduationCap, permission: 'canManagePrograms' as const },
    { name: 'Registrations', labelKey: 'nav.registrations', href: '/registrations', icon: ClipboardList, permission: 'canManageTrainees' as const },
    { name: 'Reports', labelKey: 'nav.reports', href: '/reports', icon: BarChart3, permission: 'canViewReports' as const },
    { name: 'Announcements', labelKey: 'nav.announcements', href: '/admin/announcements', icon: Megaphone, permission: 'canManageCMS' as const },
    { name: 'Messenger', labelKey: 'nav.messenger', href: '/messages', icon: MessageSquare },
    { 
      name: 'Settings', 
      labelKey: 'nav.settings',
      icon: Settings, 
      children: [
        { name: 'Preferences', labelKey: 'nav.preferences', href: '/settings', icon: Settings },
        { name: 'Activity Logs', labelKey: 'nav.activityLogs', href: '/activity-logs', icon: Activity, permission: 'canViewActivityLogs' as const },
        { name: 'Non-Attendance Dates', labelKey: 'nav.nonAttendanceDates', href: '/non-attendance-dates', icon: Calendar, permission: 'canManagePrograms' as const },
        { name: 'Landing Content', labelKey: 'nav.landingContent', href: '/admin/landing-content', icon: FileText, permission: 'canManageCMS' as const },
        { name: 'Requirements Management', labelKey: 'nav.requirementsManagement', href: '/admin/requirements', icon: BookOpen, permission: 'canManagePrograms' as const },
        { name: 'Archive', labelKey: 'nav.archive', href: '/admin/archive', icon: Trash2, permission: 'canManageAccounts' as const },
        { name: 'Account', labelKey: 'nav.account', href: '/account-management', icon: UserCog, permission: 'canManageAccounts' as const },
      ]
    },
  ] as NavItem[],
  trainee: [
    { name: 'Dashboard', labelKey: 'nav.dashboard', href: '/trainee/dashboard', icon: LayoutDashboard },
    // Attendance is now in the program details modal
    // { name: 'Attendance', href: '/trainee/attendance', icon: Calendar },
    { name: 'Profile', labelKey: 'nav.profile', href: '/trainee/profile', icon: User },
    { name: 'Programs', labelKey: 'nav.programs', href: '/trainee/programs', icon: GraduationCap },
    { name: 'Applications', labelKey: 'nav.applications', href: '/trainee/applications', icon: ClipboardList },
    { name: 'Messenger', labelKey: 'nav.messenger', href: '/messages', icon: MessageSquare },
    { name: 'Settings', labelKey: 'nav.settings', href: '/settings', icon: Settings },
  ] as NavItem[],
  superAdmin: [
    { name: 'Dashboard', labelKey: 'nav.dashboard', href: '/super-admin', icon: ActivityIcon },
    { name: 'Reports', labelKey: 'nav.reports', href: '/super-admin/reports', icon: BarChart3 },
    { name: 'Messenger', labelKey: 'nav.messenger', href: '/messages', icon: MessageSquare },
    { name: 'Activity Logs', labelKey: 'nav.activityLogs', href: '/activity-logs', icon: Activity },
    { name: 'Extension Requests', labelKey: 'nav.extensionRequests', href: '/extension-requests', icon: ClipboardList },
    { name: 'Account', labelKey: 'nav.account', href: '/super-admin/accounts', icon: UserCog },
    { name: 'Preferences', labelKey: 'nav.preferences', href: '/settings', icon: Settings },
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
const SidebarLogo = memo(({ companyName, tagline, user, fallbackTagline }: { companyName: string; tagline: string; user: any; fallbackTagline: string }) => {
  const displayName = user?.tenantName || companyName || 'Bongabong MDC';
  return (
    <div className="flex h-16 shrink-0 items-center gap-3">
      <BrandLogo size="sm" companyName={displayName} />
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-foreground truncate">{displayName}</h3>
        <p className="text-xs font-medium text-muted-foreground truncate max-w-[140px]">{tagline || fallbackTagline}</p>
      </div>
    </div>
  );
});
SidebarLogo.displayName = 'SidebarLogo';

// Memoized Navigation Item Component
const NavItemComponent = memo(({ item, isActive, isChildActive, onToggle, openDropdown, badgeCount, t }: any) => {
  const displayLabel = item.labelKey ? t(item.labelKey) : item.name;
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
            {displayLabel}
          </div>
          <ChevronDown className={`size-4 transition-transform ${
            openDropdown === item.name ? 'rotate-180' : ''
          }`} />
        </button>
        {openDropdown === item.name && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mt-1 space-y-1 pl-4 overflow-hidden"
          >
            {item.children.map((child: NavItem) => {
              const childLabel = child.labelKey ? t(child.labelKey) : child.name;
              return (
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
                    {childLabel}
                  </Link>
                </li>
              );
            })}
          </motion.ul>
        )}
      </div>
    );
  }

  const isCurrentActive = isActive(item.href!);
  const numericBadgeCount = typeof badgeCount === 'number' ? badgeCount : 0;
  const navAriaLabel =
    numericBadgeCount > 0
      ? formatBadgeAriaLabel(
          displayLabel,
          numericBadgeCount,
          item.href === '/messages' ? 'unread message' : 'pending item',
        )
      : undefined;

  return (
    <Link
      to={item.href!}
      aria-label={navAriaLabel}
      className={`ds-nav-item flex items-center justify-between gap-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isCurrentActive
          ? 'is-active bg-primary text-primary-foreground font-semibold shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-x-3">
        <item.icon className="size-4.5 shrink-0" />
        <span>{displayLabel}</span>
      </div>
      <NotificationBadge
        variant="count"
        count={numericBadgeCount}
        position="inline"
        ringClassName={isCurrentActive ? 'ring-primary-foreground/40' : 'ring-card'}
      />
    </Link>
  );
});
NavItemComponent.displayName = 'NavItemComponent';

// Memoized User Profile Section
const UserProfileSection = memo(({ user, isDark, toggleTheme, language, toggleLanguage, t, openLogoutDialog }: any) => (
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
                {user ? getRoleDisplayName(user.role, language) : t('roles.userFallback')}
              </Badge>
            </div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('nav.myAccount')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex items-center cursor-pointer">
            <Settings className="mr-2 size-4" />
            {t('nav.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleLanguage}>
          <Globe className="mr-2 size-4" />
          {language === 'en' ? t('nav.quickSwitchToFilipino') : t('nav.quickSwitchToEnglish')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleTheme}>
          {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
          {isDark ? t('nav.lightMode') : t('nav.darkMode')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openLogoutDialog}>
          <LogOut className="mr-2 size-4" />
          {t('nav.logOut')}
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
  const { user, logout, hasPermission, isAuthReady, isAuthenticated } = useAuth();
  const { companyName, tagline } = useBranding();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage, t, tx } = useLanguage();
  usePortalDomLocalizer(language, isAuthenticated && !!user);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [pendingRegistrationCount, setPendingRegistrationCount] = useState<number>(() => {
    try {
      const cached = sessionStorage.getItem('bmdc-pending-registrations');
      if (cached !== null) {
        const parsed = parseInt(cached, 10);
        return isNaN(parsed) ? 0 : parsed;
      }
    } catch {
      // Ignore
    }
    return 0;
  });
  const { totalUnreadCount } = useMessenger();
  const [showBottomNav, setShowBottomNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Auto-close tablet/mobile navigation drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

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
    const canSeeRegistrations = hasPermission('canManageTrainees') || 
      user?.role === 'local_admin' || 
      user?.role === 'staff_training_coordinator' || 
      user?.role === 'super_admin';

    if (canSeeRegistrations) {
      const fetchPendingCount = async () => {
        try {
          const api = await import('../services/api').then(m => m.default);
          // Try /registrations?status=pending first since it directly queries the database
          const regResponse = await api.get('/registrations', { status: 'pending' }, { timeout: 6000 });
          const list = Array.isArray((regResponse as any)?.data) 
            ? (regResponse as any).data 
            : (Array.isArray(regResponse) ? regResponse : []);
          
          if (list.length > 0 || (regResponse as any)?.success) {
            setPendingRegistrationCount(list.length);
            try { sessionStorage.setItem('bmdc-pending-registrations', String(list.length)); } catch {}
            return;
          }

          // Fallback to /registrations/pending-count endpoint
          const response = await api.get('/registrations/pending-count', undefined, { timeout: 4000 });
          const count = 
            typeof (response as any)?.data?.count === 'number' ? (response as any).data.count :
            typeof (response as any)?.count === 'number' ? (response as any).count :
            typeof (response as any)?.data === 'number' ? (response as any).data : 0;
          
          setPendingRegistrationCount(count);
          try { sessionStorage.setItem('bmdc-pending-registrations', String(count)); } catch {}
        } catch {
          // Keep cached count on network hiccup
        }
      };
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 30000);
      return () => clearInterval(interval);
    } else {
      setPendingRegistrationCount(0);
      try { sessionStorage.removeItem('bmdc-pending-registrations'); } catch {}
    }
  }, [user, hasPermission]);

  const unlockDocumentInteraction = () => {
    if (typeof document === 'undefined') return;
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
    document.body.removeAttribute('data-scroll-locked');
    document.documentElement.style.pointerEvents = '';
    document.documentElement.style.overflow = '';
  };

  // Ensure body pointer-events / scroll lock is never stranded on unmount or dialog close
  useEffect(() => {
    if (!logoutDialogOpen) {
      const timer = setTimeout(unlockDocumentInteraction, 50);
      return () => clearTimeout(timer);
    }
  }, [logoutDialogOpen]);

  useEffect(() => {
    return () => {
      unlockDocumentInteraction();
      setTimeout(unlockDocumentInteraction, 50);
    };
  }, []);

  const openLogoutDialog = () => {
    setMobileDrawerOpen(false);
    // Defer opening AlertDialog by one tick so DropdownMenu / Sheet restores body pointer-events first
    setTimeout(() => {
      unlockDocumentInteraction();
      setLogoutDialogOpen(true);
    }, 0);
  };

  const confirmLogout = async () => {
    setLogoutDialogOpen(false);
    setMobileDrawerOpen(false);
    unlockDocumentInteraction();
    await logout();
    unlockDocumentInteraction();
    setTimeout(unlockDocumentInteraction, 50);
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
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col no-print">
        <div className="ds-sidebar flex grow flex-col gap-y-6 overflow-y-auto border-r border-border bg-card px-6 pb-4">
          {/* Logo */}
          <SidebarLogo companyName={companyName} tagline={tagline} user={user} fallbackTagline={t('nav.trainingCenterFallback')} />

          {/* Navigation */}
          <nav className="flex flex-1 flex-col" aria-label={t('nav.mainNavAria')}>
            <ul className="flex flex-1 flex-col gap-y-1">
              {filteredNavigation.map((item) => (
                <li key={item.name}>
                  <NavItemComponent 
                    item={item}
                    isActive={isActive}
                    isChildActive={isChildActive}
                    onToggle={toggleDropdown}
                    openDropdown={openDropdown}
                    t={t}
                    badgeCount={
                      item.href === '/registrations'
                        ? pendingRegistrationCount
                        : item.href === '/messages'
                        ? totalUnreadCount
                        : undefined
                    }
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
            language={language}
            toggleLanguage={toggleLanguage}
            t={t}
            openLogoutDialog={openLogoutDialog}
          />
        </div>
      </aside>

      {/* Tablet & Mobile Slide-Over Navigation Drawer (< 1024px) */}
      <DialogPrimitive.Root open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200 lg:hidden no-print" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-200 lg:hidden no-print"
          >
            <DialogPrimitive.Title className="sr-only">{t('nav.navigationMenuSr')}</DialogPrimitive.Title>
            <div className="flex items-center justify-between border-b border-border px-6">
              <SidebarLogo companyName={companyName} tagline={tagline} user={user} fallbackTagline={t('nav.trainingCenterFallback')} />
              <DialogPrimitive.Close asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('nav.closeNavMenuAria')}
                  className="shrink-0"
                >
                  <X className="size-5" />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <div className="flex grow flex-col gap-y-6 overflow-y-auto px-6 py-4">
              <nav className="flex flex-1 flex-col" aria-label={t('nav.drawerNavAria')}>
                <ul className="flex flex-1 flex-col gap-y-1">
                  {filteredNavigation.map((item) => (
                    <li key={item.name}>
                      <NavItemComponent
                        item={item}
                        isActive={isActive}
                        isChildActive={isChildActive}
                        onToggle={toggleDropdown}
                        openDropdown={openDropdown}
                        t={t}
                        badgeCount={
                          item.href === '/registrations'
                            ? pendingRegistrationCount
                            : item.href === '/messages'
                            ? totalUnreadCount
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              </nav>
              <UserProfileSection
                user={user}
                isDark={isDark}
                toggleTheme={toggleTheme}
                language={language}
                toggleLanguage={toggleLanguage}
                t={t}
                openLogoutDialog={openLogoutDialog}
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Mobile Bottom Navigation (< 768px) */}
      <nav
        aria-label={t('nav.mobileNavAria')}
        className={`${!isAuthReady ? 'hidden' : 'md:hidden fixed'} bottom-0 left-0 right-0 z-50 border-t border-border bg-card shadow-lg transition-transform duration-300 ease-out no-print ${
          showBottomNav ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex h-16 w-full items-stretch">
          {mobileMenuItems.slice(0, 5).map((item) => {
            const isCurrentActive = item.href && isActive(item.href);
            const mobileLabel = item.labelKey ? t(item.labelKey) : item.name;
            const itemBadgeCount =
              item.href === '/registrations'
                ? pendingRegistrationCount
                : item.href === '/messages'
                ? totalUnreadCount
                : 0;
            const mobileItemAriaLabel =
              itemBadgeCount > 0
                ? formatBadgeAriaLabel(
                    mobileLabel,
                    itemBadgeCount,
                    item.href === '/messages' ? 'unread message' : 'pending item',
                  )
                : undefined;

            return (
              <Link
                key={item.name}
                to={item.href || '#'}
                aria-label={mobileItemAriaLabel}
                className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  isCurrentActive
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="relative">
                  <item.icon className="size-5" />
                  <NotificationBadge
                    variant="count"
                    count={itemBadgeCount}
                    max={9}
                    size="sm"
                    position="corner"
                    ringClassName="ring-card"
                  />
                </div>
                <span className="line-clamp-1 text-center">{mobileLabel}</span>
              </Link>
            );
          })}

          {mobileMenuItems.length > 5 && (() => {
            const hasAlertInMore = mobileMenuItems.slice(5).some(
              (item) =>
                (item.href === '/registrations' && pendingRegistrationCount > 0) ||
                (item.href === '/messages' && totalUnreadCount > 0)
            );
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={hasAlertInMore ? t('nav.moreOptionsAlertsAria') : t('nav.moreOptionsAria')}
                    className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <div className="relative">
                      <Settings className="size-5" />
                      <NotificationBadge
                        variant="dot"
                        show={hasAlertInMore}
                        position="corner"
                        ringClassName="ring-card"
                      />
                    </div>
                    <span>{t('nav.more')}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top" className="mb-2 w-56">
                  {mobileMenuItems.slice(5).map((item) => {
                    const overflowLabel = item.labelKey ? t(item.labelKey) : item.name;
                    const overflowCount =
                      item.href === '/registrations'
                        ? pendingRegistrationCount
                        : item.href === '/messages'
                        ? totalUnreadCount
                        : 0;
                    const overflowAriaLabel =
                      overflowCount > 0
                        ? formatBadgeAriaLabel(
                            overflowLabel,
                            overflowCount,
                            item.href === '/messages' ? 'unread message' : 'pending item',
                          )
                        : undefined;
                    return (
                      <DropdownMenuItem key={item.name} asChild>
                        <Link
                          to={item.href || '#'}
                          aria-label={overflowAriaLabel}
                          className="flex cursor-pointer items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <item.icon className="size-4" />
                            {overflowLabel}
                          </div>
                          <NotificationBadge
                            variant="count"
                            count={overflowCount}
                            position="inline"
                            ringClassName="ring-card"
                          />
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
        </div>
      </nav>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar - Height: h-16 (64px), z-index: z-30 */}
        <div className="ds-topbar sticky top-0 z-30 flex h-16 min-w-0 shrink-0 items-center gap-x-3 border-b border-border bg-card px-3 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 no-print">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden shrink-0"
            aria-label={t('nav.openNavMenuAria')}
            title={t('nav.menuTitle')}
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex min-w-0 flex-1 gap-x-3 self-stretch lg:gap-x-6">
            <div className="flex min-w-0 flex-1 items-center">
              {title && (
                <h1 className="truncate text-lg sm:text-xl font-semibold leading-tight tracking-tight text-foreground">
                  {tx(title)}
                </h1>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-x-1.5 sm:gap-x-2 lg:gap-x-4">
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
                <Link to="/scan" aria-label={t('nav.openQrScannerAria')}>
                  <Button variant="ghost" size="icon" title={t('nav.qrScannerTitle')} aria-label={t('nav.openQrScannerAria')}>
                    <QrCode className="size-5" />
                  </Button>
                </Link>
              )}
              
              {/* Mobile User Menu */}
              <div className="lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={t('nav.openAccountMenuAria')} title={t('nav.accountTitle')}>
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
                          {user ? getRoleDisplayName(user.role, language) : t('roles.userFallback')}
                        </p>
                        {user?.tenantName && (
                          <p className="text-xs leading-none text-primary mt-1">{user.tenantName}</p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="flex items-center cursor-pointer">
                        <Settings className="mr-2 size-4" />
                        {t('nav.settings')}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleLanguage}>
                      <Globe className="mr-2 size-4" />
                      {language === 'en' ? t('nav.quickSwitchToFilipino') : t('nav.quickSwitchToEnglish')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleTheme}>
                      {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
                      {isDark ? t('nav.lightMode') : t('nav.darkMode')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={openLogoutDialog} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 size-4" />
                      {t('nav.logOut')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="hidden lg:flex"
                aria-label={isDark ? t('nav.switchToLightModeAria') : t('nav.switchToDarkModeAria')}
                title={isDark ? t('nav.lightMode') : t('nav.darkMode')}
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
            <AlertDialogTitle>{t('nav.logoutConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('nav.logoutConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('nav.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLogout} className="bg-red-600 hover:bg-red-700">{t('nav.logOut')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Messenger Drawer when not on dedicated /messages page */}
      {location.pathname !== '/messages' && <TraineeMessengerDrawer />}
    </div>
  );
}


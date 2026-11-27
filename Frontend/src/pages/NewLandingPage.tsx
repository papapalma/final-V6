import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBranding } from '../contexts/BrandingContext';
import { useTheme } from '../contexts/ThemeContext';
import { usePrograms } from '../contexts/ProgramsContext';
import { BrandLogo } from '../components/BrandLogo';
import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { motion, useScroll, useTransform } from 'motion/react';
import LoginModal from '../components/LoginModal';
import RegistrationModal from '../components/RegistrationModal';
import ProgramDetailsModal from '../components/ProgramDetailsModal';
import AnnouncementsSection from '../components/AnnouncementsSection';
import LandingProgramsShowcase from '../components/LandingProgramsShowcase';
import { getFileUrl, api } from '../services/api';
import { type Program } from '../utils/programHelpers';
import logger from '../utils/logger';
import {
  GraduationCap,
  Target,
  Facebook,
  MapPin,
  Phone,
  Mail,
  Sparkles,
  ArrowRight,
  Building2,
  CheckCircle2,
  Award,
  Users2,
  Wrench,
  Compass,
  ChevronDown,
  Sun,
  Moon,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

interface CMSSettings {
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  features: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  ctaBanner?: {
    badge: string;
    heading: string;
    description: string;
    ctaPrimaryText: string;
    ctaSecondaryText: string;
  };
  appearance: {
    logo: string;
    heroBackground: string;
  };
  mission: string;
  vision: string;
  contact: {
    address: string;
    addressLine2: string;
    phone: string;
    email: string;
    facebook: string;
  };
  footer: {
    companyName: string;
    tagline: string;
  };
}

const defaultCmsSettings: CMSSettings = {
  hero: {
    badge: 'Official Training & Workforce Development',
    title: 'Shape Your Future With Real-World Skills',
    subtitle: 'Acquire industry-standard technical training, accredited certifications, and hands-on experience designed to launch your career.',
    ctaPrimary: 'Enroll Now',
    ctaSecondary: 'Browse Programs',
  },
  ctaBanner: {
    badge: 'Admissions Open',
    heading: 'Ready to Transform Your Career?',
    description: 'Join thousands of successful graduates who have built rewarding careers through our programs.',
    ctaPrimaryText: 'Enroll Now',
    ctaSecondaryText: 'Explore Courses',
  },
  features: [
    {
      icon: 'Wrench',
      title: 'Practical Workstations',
      description: 'Real equipment, workshops, and industry-standard tools to build genuine competency.',
    },
    {
      icon: 'Award',
      title: 'Accredited Curriculum',
      description: 'Programs structured to meet official regional and national skill standards.',
    },
    {
      icon: 'Users2',
      title: 'Expert Mentorship',
      description: 'Experienced trainers dedicated to one-on-one guidance and skill assessment.',
    },
    {
      icon: 'Compass',
      title: 'Career Advancement',
      description: 'Direct connections to local industry, apprenticeships, and livelihood projects.',
    },
  ],
  appearance: {
    logo: '',
    heroBackground: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1600&h=900&fit=crop',
  },
  mission: 'To provide accessible, quality training and development programs that equip individuals with the skills and knowledge necessary to improve their livelihood and contribute to community development.',
  vision: 'A community where every individual has access to quality education and training, empowering them to achieve their full potential and contribute to sustainable economic growth and social progress.',
  contact: {
    address: 'Bongabong, Oriental Mindoro',
    addressLine2: 'Philippines',
    phone: '+63 XXX XXX XXXX',
    email: 'info@bmdc.edu.ph',
    facebook: 'https://www.facebook.com/profile.php?id=61552170609709',
  },
  footer: {
    companyName: 'Bongabong Manpower Development Center',
    tagline: 'Empowering Communities Through Practical Skills',
  },
};

const getIconComponent = (iconName?: string) => {
  switch (iconName) {
    case 'Award':
      return Award;
    case 'Users2':
      return Users2;
    case 'Compass':
      return Compass;
    case 'Wrench':
    default:
      return Wrench;
  }
};

// Helper to extract value from either string or object with value property
const getValue = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val.value !== undefined) return val.value;
  return String(val);
};

// Animated Counter Component
const AnimatedCounter = ({ value, suffix = '' }: { value: number | string; suffix?: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current && typeof value === 'number') {
        hasAnimated.current = true;
        let start = 0;
        const end = value;
        const duration = 2000; // 2 seconds
        const increment = end / (duration / 16); // 60fps

        const interval = setInterval(() => {
          start += increment;
          if (start >= end) {
            setCount(end);
            clearInterval(interval);
          } else {
            setCount(Math.floor(start));
          }
        }, 16);
      }
    });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="text-3xl font-black text-white">
      {typeof value === 'number' ? count : value}
      {suffix}
    </div>
  );
};

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const { applyBrandingContent } = useBranding();
  const { isDark, toggleTheme } = useTheme();
  const { programs: contextPrograms } = usePrograms();
  const location = useLocation();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [sharedRegistrationContext, setSharedRegistrationContext] = useState<{
    programId?: string;
    tenantId?: string;
  }>({});
  const [registeredUsername, setRegisteredUsername] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [heroImgLoaded, setHeroImgLoaded] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const [allTenants, setAllTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [cmsSettings, setCmsSettings] = useState<CMSSettings>(defaultCmsSettings);
  const [hasHeroAnnouncements, setHasHeroAnnouncements] = useState(true);

  // Parallax scroll effect for hero background & scroll-fading cue
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 600], [0, 90]);
  const scrollCueOpacity = useTransform(scrollY, [0, 120], [1, 0]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches)
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setPrefersReducedMotion(Boolean(mq.matches));
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Fetch available tenants
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await api.get('/tenants');
        if (response.success) {
          const tenants = response.data || [];
          setAllTenants(tenants);

          const savedTenantId = sessionStorage.getItem('selectedTenantId');
          if (savedTenantId && tenants.some((t: { id: string; name: string }) => t.id === savedTenantId)) {
            setSelectedTenantId(savedTenantId);
          } else if (tenants.length > 0) {
            setSelectedTenantId(tenants[0].id);
          }
        }
      } catch (error) {
        logger.error('Failed to fetch tenants', { error });
      }
    };

    fetchTenants();
  }, []);

  // Load CMS settings when tenant changes
  useEffect(() => {
    const loadCmsSettings = async () => {
      if (!selectedTenantId) return;
      try {
        let response = await api.get('/cms-settings', { tenantId: selectedTenantId });
        if (!response || !response.success || !response.data) {
          response = await api.get('/landing-content', { tenantId: selectedTenantId });
        }
        if (response && response.success && response.data) {
          // Transform new comprehensive structure to old structure for backward compatibility
          const data = response.data;
          const transformedSettings: CMSSettings = {
            hero: {
              badge: data.content?.hero?.badge || data.hero?.badge || defaultCmsSettings.hero.badge,
              title: data.content?.hero?.heading || data.hero?.title || defaultCmsSettings.hero.title,
              subtitle: data.content?.hero?.subheading || data.hero?.subtitle || defaultCmsSettings.hero.subtitle,
              ctaPrimary: data.content?.hero?.ctaText || data.hero?.ctaPrimary || defaultCmsSettings.hero.ctaPrimary,
              ctaSecondary: data.hero?.ctaSecondary || defaultCmsSettings.hero.ctaSecondary,
            },
            ctaBanner: {
              badge: data.content?.ctaBanner?.badge || data.ctaBanner?.badge || defaultCmsSettings.ctaBanner!.badge,
              heading: data.content?.ctaBanner?.heading || data.ctaBanner?.heading || defaultCmsSettings.ctaBanner!.heading,
              description: data.content?.ctaBanner?.description || data.ctaBanner?.description || defaultCmsSettings.ctaBanner!.description,
              ctaPrimaryText: data.content?.ctaBanner?.ctaPrimaryText || data.ctaBanner?.ctaPrimaryText || defaultCmsSettings.ctaBanner!.ctaPrimaryText,
              ctaSecondaryText: data.content?.ctaBanner?.ctaSecondaryText || data.ctaBanner?.ctaSecondaryText || defaultCmsSettings.ctaBanner!.ctaSecondaryText,
            },
            features: data.content?.features || data.features || defaultCmsSettings.features,
            appearance: {
              logo: data.content?.appearance?.logo || data.appearance?.logo || defaultCmsSettings.appearance.logo,
              heroBackground: data.content?.appearance?.heroBackground || data.appearance?.heroBackground || defaultCmsSettings.appearance.heroBackground,
            },
            mission: data.content?.missionVision?.description || data.mission || defaultCmsSettings.mission,
            vision: data.content?.missionVision?.vision || data.vision || defaultCmsSettings.vision,
            contact: {
              address: data.content?.contact?.address || data.contact?.address || defaultCmsSettings.contact.address,
              addressLine2: data.content?.contact?.addressLine2 || data.contact?.addressLine2 || defaultCmsSettings.contact.addressLine2,
              phone: data.content?.contact?.phone || data.contact?.phone || defaultCmsSettings.contact.phone,
              email: data.content?.contact?.email || data.contact?.email || defaultCmsSettings.contact.email,
              facebook: data.content?.contact?.facebook || data.contact?.facebook || defaultCmsSettings.contact.facebook,
            },
            footer: {
              companyName: data.content?.footer?.companyName || data.footer?.companyName || defaultCmsSettings.footer.companyName,
              tagline: data.content?.footer?.tagline || data.footer?.tagline || defaultCmsSettings.footer.tagline,
            },
          };
          setCmsSettings(transformedSettings);
          applyBrandingContent(transformedSettings);
        }
      } catch (error) {
        logger.warn('Failed to load CMS settings, using defaults', { error });
      }
    };

    loadCmsSettings();
  }, [selectedTenantId]);

  // Auto-open login or registration modal when redirected (including from /share)
  useEffect(() => {
    if (location.state?.tenantId) {
      setSelectedTenantId(location.state.tenantId);
    }
    if (location.state?.programId || location.state?.tenantId) {
      setSharedRegistrationContext({
        programId: location.state?.programId,
        tenantId: location.state?.tenantId,
      });
    }
    if (location.state?.openLogin) {
      setIsLoginModalOpen(true);
      window.history.replaceState({}, '');
    }
    if (location.state?.openRegister) {
      setIsRegistrationModalOpen(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Store tenant selection in sessionStorage
  useEffect(() => {
    if (selectedTenantId) {
      sessionStorage.setItem('selectedTenantId', selectedTenantId);
    }
  }, [selectedTenantId]);

  /**
   * Handle registration completion callback
   * Called after successful email verification from RegistrationModal
   */
  const handleRegistrationComplete = (username: string) => {
    logger.info('[LandingPage] Registration completed, transitioning to login', {
      username,
    });

    // Store username for login modal pre-fill
    setRegisteredUsername(username);

    // Close registration modal
    setIsRegistrationModalOpen(false);

    // Small delay to ensure modal closes smoothly before opening login
    setTimeout(() => {
      // Open login modal
      setIsLoginModalOpen(true);
    }, 300);
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const heroBackground = cmsSettings.appearance.heroBackground
    ? getFileUrl(cmsSettings.appearance.heroBackground)
    : '';

  // Ensure cached or newly updated hero background images never stay hidden at opacity-0
  useEffect(() => {
    if (!heroBackground) {
      setHeroImgLoaded(false);
      return;
    }
    const img = heroImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setHeroImgLoaded(true);
    } else {
      setHeroImgLoaded(false);
    }
  }, [heroBackground]);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-50 landing-glass-header shadow-xs">
        <div className="container mx-auto flex h-16 md:h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3 min-w-0"
          >
            <BrandLogo
              logoUrl={cmsSettings?.appearance?.logo || null}
              companyName={getValue(cmsSettings?.footer?.companyName) || 'BMDC Training Center'}
              fallbackVariant="icon"
              className="h-10 w-10 md:h-12 md:w-12"
            />
            <div className="hidden sm:block min-w-0 max-w-[260px] md:max-w-xs lg:max-w-md">
              <p className="text-sm md:text-base font-bold leading-tight tracking-tight text-foreground truncate">
                {getValue(cmsSettings?.footer?.companyName) || 'BMDC Training Center'}
              </p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground truncate">
                {getValue(cmsSettings?.footer?.tagline) || 'Empowering Communities'}
              </p>
            </div>
          </motion.div>

          <motion.nav
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-2 sm:gap-6"
          >
            {/* Tenant Selector */}
            {allTenants.length > 1 && (
              <div className="hidden lg:flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger className="w-44 h-9 text-xs">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <a href="#programs" className="hidden md:inline-block text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Programs
            </a>
            <a href="#features" className="hidden md:inline-block text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Why BMDC
            </a>
            <a href="#about" className="hidden md:inline-block text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              About
            </a>
            <a href="#contact" className="hidden md:inline-block text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Contact
            </a>

            <div className="flex items-center gap-2">
              {/* Theme Toggle (Light / Dark Mode) */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="size-9 rounded-full text-foreground/80 hover:text-foreground hover:bg-muted transition-colors"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-slate-700" />}
              </Button>

              {isAuthenticated ? (
                <Link to="/dashboard">
                  <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsLoginModalOpen(true)}
                    className="text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    Log In
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsRegistrationModalOpen(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  >
                    Enroll Now
                  </Button>
                </>
              )}
            </div>
          </motion.nav>
        </div>
      </header>

      {/* ─── HERO SECTION ─── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 text-white">
        {/* Parallax Background */}
        <motion.div className="absolute inset-0" style={{ y: heroParallax }}>
          {heroBackground ? (
            <>
              {/* Shimmering Skeleton Preloader */}
              {!heroImgLoaded && (
                <div className="absolute inset-0 bg-slate-900 animate-pulse flex items-center justify-center">
                  <div className="w-full h-full bg-gradient-to-r from-transparent via-slate-800/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                </div>
              )}
              <img
                ref={heroImgRef}
                src={heroBackground}
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
                onLoad={() => setHeroImgLoaded(true)}
                onError={() => setHeroImgLoaded(true)}
                className={`h-full w-full object-cover transition-opacity duration-700 scale-105 ${
                  heroImgLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {/* Balanced scrim: keeps hero image vibrant while guaranteeing legible white copy */}
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/45 to-slate-950/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/30" />
            </>
          ) : (
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_top,#1e3a8a_0%,#0f172a_50%,#020617_100%)]" />
          )}
        </motion.div>

        {/* Subtle Ambient Light Gradients (Single Blue Wavelength) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 size-[500px] rounded-full bg-blue-600/20 blur-[120px]" />
          <div className="absolute top-1/3 right-0 size-[600px] rounded-full bg-sky-600/15 blur-[140px]" />
          <div className="absolute -bottom-32 left-1/4 size-[400px] rounded-full bg-indigo-600/20 blur-[100px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]" />
        </div>

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 z-10 max-w-7xl">
          <div className={hasHeroAnnouncements ? "flex flex-col gap-8 lg:grid lg:grid-cols-[1.618fr_1fr] lg:items-center lg:gap-12 xl:gap-16 w-full" : "max-w-4xl"}>
            {/* Left Column (Hero Copy, CTAs, and Stats) */}
            <div className={hasHeroAnnouncements ? "space-y-6 sm:space-y-8 min-w-0" : ""}>
              <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-6 sm:space-y-8">
                {/* Badge */}
                <motion.div variants={fadeInUp}>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-md shadow-sm">
                    <Sparkles className="size-4 text-white" />
                    <span>{getValue(cmsSettings?.hero?.badge) || 'Technical & Vocational Skills Training'}</span>
                  </div>
                </motion.div>

                {/* Headline */}
                <motion.h1 
                  variants={fadeInUp} 
                  className={`text-3xl sm:text-5xl ${hasHeroAnnouncements ? 'lg:text-4xl xl:text-5xl' : 'lg:text-7xl'} font-black tracking-tight leading-[1.1] text-white drop-shadow-lg`}
                >
                  {getValue(cmsSettings?.hero?.title) || 'Shape Your Future With Real-World Technical Skills'}
                </motion.h1>

                {/* Subtitle */}
                <motion.p variants={fadeInUp} className="text-base sm:text-lg md:text-xl text-white leading-relaxed max-w-2xl font-semibold drop-shadow-md">
                  {getValue(cmsSettings?.hero?.subtitle) ||
                    'Join government-recognized vocational programs. Learn hands-on in equipped labs, earn industry credentials, and build a resilient career.'}
                </motion.p>

                {/* Action Buttons */}
                <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
                  <Button
                    size="lg"
                    onClick={() => setIsRegistrationModalOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-white font-bold px-8 h-12 sm:h-14 text-base sm:text-lg shadow-xl shadow-primary/50 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-primary/70 relative overflow-hidden group"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 group-hover:animate-pulse" />
                    {getValue(cmsSettings?.hero?.ctaPrimary) || 'Enroll Now'}
                    <ArrowRight className="size-5 ml-2" />
                  </Button>

                  <a href="#programs">
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-2 border-white bg-white/10 hover:bg-white/20 text-white font-bold px-8 h-12 sm:h-14 text-base sm:text-lg backdrop-blur-sm transition-all hover:shadow-lg hover:shadow-white/30 group relative overflow-hidden"
                    >
                      <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      {getValue(cmsSettings?.hero?.ctaSecondary) || 'Browse Programs'}
                    </Button>
                  </a>

                  {getValue(cmsSettings?.contact?.facebook) && (
                    <a
                      href={getValue(cmsSettings?.contact?.facebook)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-white hover:text-blue-200 transition-colors px-4 py-3 bg-white/10 rounded-lg backdrop-blur-sm font-semibold"
                    >
                      <Facebook className="size-5" />
                      <span>Join Community</span>
                    </a>
                  )}
                </motion.div>

                {/* Trust Indicators / Stats */}
                <motion.div variants={fadeInUp} className="pt-8 sm:pt-12 border-t border-white/20 grid grid-cols-3 gap-3 sm:gap-6 text-left">
                  <div className="space-y-1.5 bg-white/5 p-3.5 sm:p-4 rounded-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                    <AnimatedCounter value={100} suffix="%" />
                    <p className="text-xs sm:text-sm text-white font-semibold">Practical Hands-On</p>
                  </div>
                  <div className="space-y-1.5 bg-white/5 p-3.5 sm:p-4 rounded-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                    <p className="text-2xl sm:text-3xl font-black text-white">Certified</p>
                    <p className="text-xs sm:text-sm text-white font-semibold">Accredited</p>
                  </div>
                  <div className="space-y-1.5 bg-white/5 p-3.5 sm:p-4 rounded-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                    <p className="text-2xl sm:text-3xl font-black text-white">Career Ready</p>
                    <p className="text-xs sm:text-sm text-white font-semibold">Job Placement</p>
                  </div>
                </motion.div>
              </motion.div>
            </div>

            {/* Right Column (Hero Announcement Gallery Card - inside user's red box) */}
            <div className={hasHeroAnnouncements ? "w-full max-w-lg mx-auto lg:max-w-none" : "hidden"}>
              <AnnouncementsSection inHero onHasAnnouncements={setHasHeroAnnouncements} />
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          style={{ opacity: scrollCueOpacity }}
          animate={prefersReducedMotion ? undefined : { y: [0, 10, 0] }}
          transition={prefersReducedMotion ? undefined : { repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20 pointer-events-none"
        >
          <p className="text-xs text-white/70 font-semibold">SCROLL TO EXPLORE</p>
          <ChevronDown className="w-5 h-5 text-white/70" />
        </motion.div>
      </section>

      {/* ─── CORE PILLARS / WHY BMDC ─── */}
      <section id="features" className="py-16 md:py-24 landing-band-features border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-12 md:mb-16">
            <Badge variant="outline" className="px-3.5 py-1 text-xs font-semibold border-primary/30 text-primary bg-primary/5">
              Excellence in Training
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Why Train With Bongabong MDC?
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              We bridge the gap between technical theory and industry demand with practical, workforce-ready skills.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(cmsSettings.features && cmsSettings.features.length > 0
              ? cmsSettings.features
              : defaultCmsSettings.features
            ).map((pillar, i) => {
              const IconComponent = getIconComponent(pillar.icon);
              return (
                <motion.div
                  key={`${pillar.title}-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="group relative rounded-2xl border landing-glass-card landing-glass-card-interactive p-6"
                >
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <IconComponent className="size-6" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">{pillar.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── PROGRAMS CATALOG SECTION ─── */}
      <LandingProgramsShowcase
        programs={contextPrograms}
        isModalOpen={!!selectedProgram}
        onSelectProgram={setSelectedProgram}
      />

      {/* ─── ABOUT / MISSION & VISION ─── */}
      <section id="about" className="py-16 md:py-24 landing-band-about border-b border-border/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-12 md:mb-16">
            <Badge variant="outline" className="px-3.5 py-1 text-xs font-semibold border-primary/30 text-primary bg-primary/5">
              Institution Overview
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Building a Skilled & Empowered Community
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              {getValue(cmsSettings?.footer?.companyName)} is dedicated to fostering economic independence through world-class technical education.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
            {/* Mission Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border landing-glass-card landing-glass-card-interactive p-8 flex flex-col justify-between"
            >
              <div>
                <div className="flex size-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-6">
                  <Target className="size-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Our Mission</h3>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {getValue(cmsSettings?.mission)}
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-border/70 flex items-center gap-2 text-xs font-semibold text-primary">
                <CheckCircle2 className="size-4" />
                <span>Dedicated to grassroots empowerment</span>
              </div>
            </motion.div>

            {/* Vision Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="rounded-2xl border landing-glass-card landing-glass-card-interactive p-8 flex flex-col justify-between"
            >
              <div>
                <div className="flex size-12 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-6">
                  <GraduationCap className="size-6" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-foreground">Our Vision</h3>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {getValue(cmsSettings?.vision)}
                </p>
              </div>
              <div className="mt-6 pt-6 border-t border-border/70 flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
                <CheckCircle2 className="size-4" />
                <span>Sustainable regional skill growth</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="relative py-16 md:py-24 overflow-hidden border-y border-primary/15 landing-band-cta">
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border landing-glass-card px-4 py-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span>{getValue(cmsSettings?.ctaBanner?.badge) || defaultCmsSettings.ctaBanner!.badge}</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              {getValue(cmsSettings?.ctaBanner?.heading) || defaultCmsSettings.ctaBanner!.heading}
            </h2>

            <p className="text-muted-foreground text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mx-auto font-medium">
              {getValue(cmsSettings?.ctaBanner?.description) || defaultCmsSettings.ctaBanner!.description}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Button
                size="lg"
                onClick={() => setIsRegistrationModalOpen(true)}
                className="programs-tactile-btn bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 h-12 shadow-md shadow-primary/20"
              >
                {getValue(cmsSettings?.ctaBanner?.ctaPrimaryText) || defaultCmsSettings.ctaBanner!.ctaPrimaryText}
                <ArrowRight className="size-4 ml-2" />
              </Button>
              <a href="#programs">
                <Button
                  variant="outline"
                  size="lg"
                  className="programs-tactile-btn border landing-glass-card hover:bg-card text-foreground font-bold px-6 h-12"
                >
                  {getValue(cmsSettings?.ctaBanner?.ctaSecondaryText) || defaultCmsSettings.ctaBanner!.ctaSecondaryText}
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CONTACT SECTION ─── */}
      <section id="contact" className="py-16 md:py-24 landing-band-contact">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
            <Badge variant="outline" className="px-3.5 py-1 text-xs font-semibold border-primary/30 text-primary bg-primary/5">
              Contact & Inquiries
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              Get in Touch With Us
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Have inquiries about registration, course schedules, or requirements? Reach our team directly.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border landing-glass-card landing-glass-card-interactive p-6 text-center flex flex-col items-center space-y-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campus Location</p>
              <p className="text-sm font-medium text-foreground">
                {getValue(cmsSettings?.contact?.address) || 'Bongabong'}<br />
                {getValue(cmsSettings?.contact?.addressLine2) || 'Oriental Mindoro'}
              </p>
            </div>

            <div className="rounded-xl border landing-glass-card landing-glass-card-interactive p-6 text-center flex flex-col items-center space-y-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Phone className="size-5" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telephone</p>
              <a
                href={`tel:${getValue(cmsSettings?.contact?.phone)}`}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                {getValue(cmsSettings?.contact?.phone) || '+63 XXX XXX XXXX'}
              </a>
            </div>

            <div className="rounded-xl border landing-glass-card landing-glass-card-interactive p-6 text-center flex flex-col items-center space-y-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="size-5" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Official Email</p>
              <a
                href={`mailto:${getValue(cmsSettings?.contact?.email)}`}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate max-w-full"
              >
                {getValue(cmsSettings?.contact?.email) || 'info@bmdc.edu.ph'}
              </a>
            </div>

            <div className="rounded-xl border landing-glass-card landing-glass-card-interactive p-6 text-center flex flex-col items-center space-y-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Facebook className="size-5" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Social Updates</p>
              <a
                href={getValue(cmsSettings?.contact?.facebook) || 'https://www.facebook.com/profile.php?id=61552170609709'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                Follow on Facebook
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border bg-card py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3 text-center md:text-left">
              <BrandLogo
                logoUrl={cmsSettings?.appearance?.logo || null}
                companyName={getValue(cmsSettings?.footer?.companyName) || 'Bongabong Manpower Development Center'}
                size="sm"
              />
              <div>
                <p className="text-sm font-bold text-foreground">
                  {getValue(cmsSettings?.footer?.companyName) || 'Bongabong Manpower Development Center'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getValue(cmsSettings?.footer?.tagline) || 'Empowering Communities'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground font-medium">
              <a href="#programs" className="hover:text-primary transition-colors">Programs</a>
              <a href="#features" className="hover:text-primary transition-colors">Features</a>
              <a href="#about" className="hover:text-primary transition-colors">About Us</a>
              <a href="#contact" className="hover:text-primary transition-colors">Contact</a>
            </div>

            <p className="text-xs text-muted-foreground text-center md:text-right">
              © {new Date().getFullYear()} BMDC. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* ─── MODALS ─── */}
      <LoginModal
        open={isLoginModalOpen}
        onOpenChange={setIsLoginModalOpen}
        onSwitchToSignup={() => setIsRegistrationModalOpen(true)}
        preFilledUsername={registeredUsername}
      />
      <RegistrationModal 
        open={isRegistrationModalOpen} 
        onOpenChange={setIsRegistrationModalOpen}
        onRegistrationComplete={handleRegistrationComplete}
        initialTenantId={sharedRegistrationContext.tenantId}
        initialProgramId={sharedRegistrationContext.programId}
      />
      <ProgramDetailsModal
        program={selectedProgram}
        open={!!selectedProgram}
        onOpenChange={(open) => !open && setSelectedProgram(null)}
        canManage={false}
      />
    </div>
  );
}

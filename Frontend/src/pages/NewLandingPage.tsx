import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePrograms } from '../contexts/ProgramsContext';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { motion, useScroll, useTransform } from 'motion/react';
import LoginModal from '../components/LoginModal';
import RegistrationModal from '../components/RegistrationModal';
import ProgramDetailsModal from '../components/ProgramDetailsModal';
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
  Eye,
  Building2,
  Search,
  CheckCircle2,
  BookOpen,
  Award,
  Users2,
  Wrench,
  Clock,
  Compass,
  ChevronDown,
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

// Format date helper
const formatDate = (dateString: string) => {
  if (!dateString) return 'TBA';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper to extract value from either string or object with value property
const getValue = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val.value !== undefined) return val.value;
  return String(val);
};

// Determine if a program is upcoming (starts in the future)
const isProgramUpcoming = (startDate: string): boolean => {
  if (!startDate) return false;
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start > today;
};

// Days until a program starts
const daysUntilStart = (startDate: string): number => {
  const start = new Date(startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
  const { programs: contextPrograms } = usePrograms();
  const location = useLocation();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [registeredUsername, setRegisteredUsername] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [heroImgLoaded, setHeroImgLoaded] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const [allTenants, setAllTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [cmsSettings, setCmsSettings] = useState<CMSSettings>(defaultCmsSettings);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'upcoming' | 'active'>('all');

  // Parallax scroll effect for hero background
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 600], [0, 90]);

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
        const response = await api.get('/landing-content');
        if (response.success && response.data) {
          // Transform new comprehensive structure to old structure for backward compatibility
          const data = response.data;
          const transformedSettings: CMSSettings = {
            ...defaultCmsSettings,
            hero: {
              badge: data.content?.hero?.badge || data.hero?.badge || '',
              title: data.content?.hero?.heading || data.hero?.title || '',
              subtitle: data.content?.hero?.subheading || data.hero?.subtitle || '',
              ctaPrimary: data.content?.hero?.ctaText || data.hero?.ctaPrimary || 'Enroll Now',
              ctaSecondary: data.hero?.ctaSecondary || 'Browse Programs',
            },
            appearance: data.content?.appearance || data.appearance || {},
            mission: data.content?.missionVision?.description || data.mission || '',
            vision: data.content?.missionVision?.vision || data.vision || '',
            contact: data.content?.contact || data.contact || {},
            footer: data.content?.footer || data.footer || {},
          };
          setCmsSettings(transformedSettings);
        }
      } catch (error) {
        logger.warn('Failed to load CMS settings, using defaults', { error });
      }
    };

    loadCmsSettings();
  }, [selectedTenantId]);

  // Auto-open login or registration modal when redirected
  useEffect(() => {
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

  // Filtered programs
  const filteredPrograms = useMemo(() => {
    return contextPrograms.filter((program) => {
      const matchesSearch =
        program.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (program.description && program.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (program.instructor && program.instructor.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (selectedFilter === 'upcoming') {
        return isProgramUpcoming(program.startDate);
      }
      if (selectedFilter === 'active') {
        return program.status?.toLowerCase() === 'active' || program.status?.toLowerCase() === 'open';
      }

      return true;
    });
  }, [contextPrograms, searchQuery, selectedFilter]);

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

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* ─── STICKY HEADER ─── */}
      <header className="sticky top-0 z-50 border-b border-white/30 bg-white/30 dark:bg-black/30 backdrop-blur-3xl transition-all shadow-2xl">
        <div className="container mx-auto flex h-16 md:h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3"
          >
            {cmsSettings?.appearance?.logo ? (
              <img
                src={getFileUrl(cmsSettings.appearance.logo)}
                alt="BMDC Logo"
                className="h-10 w-10 md:h-12 md:w-12 rounded-xl object-contain shadow-sm border border-border"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-xl bg-primary shadow-sm text-primary-foreground">
                <GraduationCap className="size-6 text-white" />
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-sm md:text-base font-bold leading-none tracking-tight text-foreground">
                {getValue(cmsSettings?.footer?.companyName) || 'BMDC Training Center'}
              </p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
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
              <img
                src={heroBackground}
                alt=""
                aria-hidden="true"
                onLoad={() => setHeroImgLoaded(true)}
                className={`h-full w-full object-cover transition-opacity duration-1000 scale-105 ${
                  heroImgLoaded ? 'opacity-35' : 'opacity-0'
                }`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/60" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-transparent" />
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

        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 z-10">
          <div className="max-w-4xl">
            <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="space-y-8">
              {/* Badge */}
              <motion.div variants={fadeInUp}>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-md shadow-sm">
                  <Sparkles className="size-4 text-white" />
                  <span>{getValue(cmsSettings?.hero?.badge) || 'Technical & Vocational Skills Training'}</span>
                </div>
              </motion.div>

              {/* Headline */}
              <motion.h1 variants={fadeInUp} className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] text-white drop-shadow-lg">
                {getValue(cmsSettings?.hero?.title) || 'Shape Your Future With Real-World Technical Skills'}
              </motion.h1>

              {/* Subtitle */}
              <motion.p variants={fadeInUp} className="text-lg sm:text-xl md:text-2xl text-white leading-relaxed max-w-3xl font-semibold drop-shadow-md">
                {getValue(cmsSettings?.hero?.subtitle) ||
                  'Join government-recognized vocational programs. Learn hands-on in equipped labs, earn industry credentials, and build a resilient career.'}
              </motion.p>

              {/* Action Buttons */}
              <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-4 pt-4">
                <Button
                  size="lg"
                  onClick={() => setIsRegistrationModalOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-white font-bold px-10 h-14 text-lg shadow-xl shadow-primary/50 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-primary/70 relative overflow-hidden group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 group-hover:animate-pulse" />
                  {getValue(cmsSettings?.hero?.ctaPrimary) || 'Enroll Now'}
                  <ArrowRight className="size-5 ml-2" />
                </Button>

                <a href="#programs">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-white bg-white/10 hover:bg-white/20 text-white font-bold px-10 h-14 text-lg backdrop-blur-sm transition-all hover:shadow-lg hover:shadow-white/30 group relative overflow-hidden"
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
              <motion.div variants={fadeInUp} className="pt-12 border-t border-white/20 grid grid-cols-3 gap-6 text-left">
                <div className="space-y-2 bg-white/5 p-4 rounded-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                  <AnimatedCounter value={100} suffix="%" />
                  <p className="text-sm text-white font-semibold">Practical Hands-On Training</p>
                </div>
                <div className="space-y-2 bg-white/5 p-4 rounded-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                  <p className="text-3xl font-black text-white">Certified</p>
                  <p className="text-sm text-white font-semibold">Accredited Programs</p>
                </div>
                <div className="space-y-2 bg-white/5 p-4 rounded-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                  <p className="text-3xl font-black text-white">Career Ready</p>
                  <p className="text-sm text-white font-semibold">Job Placement</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20"
        >
          <p className="text-xs text-white/70 font-semibold">SCROLL TO EXPLORE</p>
          <ChevronDown className="w-5 h-5 text-white/70" />
        </motion.div>
      </section>

      {/* ─── CORE PILLARS / WHY BMDC ─── */}
      <section id="features" className="py-16 md:py-24 bg-background border-b border-border/60">
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
            {[
              {
                icon: Wrench,
                title: 'Practical Workstations',
                description: 'Real equipment, workshops, and industry-standard tools to build genuine competency.',
              },
              {
                icon: Award,
                title: 'Accredited Curriculum',
                description: 'Programs structured to meet official regional and national skill standards.',
              },
              {
                icon: Users2,
                title: 'Expert Mentorship',
                description: 'Experienced trainers dedicated to one-on-one guidance and skill assessment.',
              },
              {
                icon: Compass,
                title: 'Career Advancement',
                description: 'Direct connections to local industry, apprenticeships, and livelihood projects.',
              },
            ].map((pillar, i) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
              >
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <pillar.icon className="size-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PROGRAMS CATALOG SECTION ─── */}
      <section id="programs" className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-3 max-w-xl">
              <Badge variant="outline" className="px-3.5 py-1 text-xs font-semibold border-primary/30 text-primary bg-primary/5">
                Vocational Tracks
              </Badge>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
                Explore Available Programs
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Find the training course that matches your interests and career goals.
              </p>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-60 h-10 bg-background"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-background rounded-lg border border-border">
                <Button
                  variant={selectedFilter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedFilter('all')}
                  className="h-8 text-xs font-medium"
                >
                  All ({contextPrograms.length})
                </Button>
                <Button
                  variant={selectedFilter === 'upcoming' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedFilter('upcoming')}
                  className="h-8 text-xs font-medium"
                >
                  Upcoming
                </Button>
                <Button
                  variant={selectedFilter === 'active' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedFilter('active')}
                  className="h-8 text-xs font-medium"
                >
                  Active
                </Button>
              </div>
            </div>
          </div>

          {/* Programs Grid */}
          {filteredPrograms.length > 0 ? (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPrograms.map((program, i) => {
                const isUpcoming = isProgramUpcoming(program.startDate);
                const days = isUpcoming ? daysUntilStart(program.startDate) : 0;

                return (
                  <motion.div
                    key={program.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: (i % 6) * 0.06, duration: 0.4 }}
                  >
                    <Card
                      className="group flex flex-col h-full overflow-hidden border-gray-200 bg-white hover:shadow-md transition-all duration-200 cursor-pointer"
                      onClick={() => setSelectedProgram(program)}
                    >
                      {/* Course Image */}
                      {program.photoUrl ? (
                        <div className="relative w-full h-40 overflow-hidden bg-gray-100 border-b border-gray-200">
                          <img
                            src={program.photoUrl}
                            alt={program.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-black/80 text-white text-xs font-semibold">
                              {program.status || 'Active'}
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full h-32 bg-gray-100 flex items-center justify-between p-4 border-b border-gray-200">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <BookOpen className="h-5 w-5" />
                          </div>
                          <Badge variant="outline" className="bg-white text-xs font-semibold text-black border-gray-300">
                            {program.status || 'Active'}
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          {isUpcoming && (
                            <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Starts in {days} {days === 1 ? 'day' : 'days'}
                            </span>
                          )}
                          {program.duration && (
                            <span className="text-xs text-gray-500 ml-auto font-medium">
                              {program.duration}
                            </span>
                          )}
                        </div>
                        <CardTitle className="text-base font-bold line-clamp-2 text-black group-hover:text-primary transition-colors">
                          {program.name}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="p-4 pt-2 flex flex-col flex-1 justify-between space-y-3">
                        <CardDescription className="text-xs line-clamp-2 text-gray-600 font-medium">
                          {program.description || 'Comprehensive technical training program designed to prepare trainees for industry roles.'}
                        </CardDescription>

                        <div className="space-y-1 border-t border-gray-200 pt-2 text-xs text-gray-600">
                          {program.instructor && (
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Instructor:</span>
                              <span className="text-black truncate max-w-[140px]">{program.instructor}</span>
                            </div>
                          )}
                          {program.startDate && (
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Start:</span>
                              <span className="text-black">{formatDate(program.startDate)}</span>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProgram(program);
                          }}
                          className="w-full text-xs font-semibold bg-white border-2 border-black text-black hover:bg-gray-100 transition-colors"
                        >
                          <Eye className="h-3 w-3 mr-1.5" />
                          View Details
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed border-2 p-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mx-auto mb-4 text-muted-foreground">
                <GraduationCap className="size-7" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No Programs Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                {searchQuery ? `No courses matched "${searchQuery}". Try clearing your search.` : 'There are currently no training programs listed.'}
              </p>
              {searchQuery && (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              )}
            </Card>
          )}
        </div>
      </section>

      {/* ─── ABOUT / MISSION & VISION ─── */}
      <section id="about" className="py-16 md:py-24 bg-background border-b border-border/60">
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
              className="rounded-2xl border border-border bg-card p-8 shadow-sm hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between"
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
              <div className="mt-6 pt-6 border-t border-border flex items-center gap-2 text-xs font-semibold text-primary">
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
              className="rounded-2xl border border-border bg-card p-8 shadow-sm hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between"
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
              <div className="mt-6 pt-6 border-t border-border flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
                <CheckCircle2 className="size-4" />
                <span>Sustainable regional skill growth</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="relative py-16 md:py-20 overflow-hidden bg-gray-100">
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-black">
              <Sparkles className="size-3.5 text-black" />
              <span>Admissions Open</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-black leading-tight">
              Ready to Build Your New Career?
            </h2>

            <p className="text-black text-sm sm:text-base md:text-lg leading-relaxed max-w-xl mx-auto font-medium">
              Enroll today and take your first step toward mastery in practical trades, digital competency, and technical skills.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Button
                size="lg"
                onClick={() => setIsRegistrationModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-white font-bold px-8 h-12"
              >
                Enroll Now
                <ArrowRight className="size-4 ml-2" />
              </Button>
              <a href="#programs">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 border-black bg-white hover:bg-gray-100 text-black font-bold px-6 h-12"
                >
                  Explore Courses
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CONTACT SECTION ─── */}
      <section id="contact" className="py-16 md:py-24 bg-muted/20">
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
            <div className="rounded-xl border border-border bg-card p-5 text-center flex flex-col items-center space-y-2.5 shadow-sm">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campus Location</p>
              <p className="text-sm font-medium text-foreground">
                {getValue(cmsSettings?.contact?.address) || 'Bongabong'}<br />
                {getValue(cmsSettings?.contact?.addressLine2) || 'Oriental Mindoro'}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 text-center flex flex-col items-center space-y-2.5 shadow-sm">
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

            <div className="rounded-xl border border-border bg-card p-5 text-center flex flex-col items-center space-y-2.5 shadow-sm">
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

            <div className="rounded-xl border border-border bg-card p-5 text-center flex flex-col items-center space-y-2.5 shadow-sm">
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
      <footer className="border-t border-border bg-card py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3 text-center md:text-left">
              {cmsSettings?.appearance?.logo ? (
                <img
                  src={getFileUrl(cmsSettings.appearance.logo)}
                  alt="BMDC Logo"
                  className="size-10 rounded-xl object-contain border border-border"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-sm">
                  BMDC
                </div>
              )}
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
              <button onClick={() => setIsLoginModalOpen(true)} className="hover:text-primary transition-colors">
                Staff Portal
              </button>
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

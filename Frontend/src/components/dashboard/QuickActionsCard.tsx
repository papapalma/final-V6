import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  LayoutDashboard,
  Calendar,
  User,
  GraduationCap,
  ClipboardList,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface QuickActionItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
  gradient: string;
  iconBg: string;
  id?: string; // Add id to identify the action
}

interface TraineeProfile {
  id: string;
  first_name: string;
  last_name: string;
  [key: string]: any;
}

const allQuickActions: QuickActionItem[] = [
  {
    id: 'attendance',
    label: 'Attendance',
    href: '/trainee/attendance',
    icon: <Calendar className="h-5 w-5" />,
    description: 'Check attendance',
    gradient: 'from-blue-500/10 via-blue-400/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
  },
  {
    id: 'profile',
    label: 'Profile',
    href: '/trainee/profile',
    icon: <User className="h-5 w-5" />,
    description: 'Edit profile',
    gradient: 'from-purple-500/10 via-purple-400/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
  },
  {
    id: 'programs',
    label: 'Programs',
    href: '/trainee/programs',
    icon: <GraduationCap className="h-5 w-5" />,
    description: 'Browse programs',
    gradient: 'from-emerald-500/10 via-emerald-400/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  },
  {
    id: 'applications',
    label: 'Applications',
    href: '/trainee/applications',
    icon: <ClipboardList className="h-5 w-5" />,
    description: 'View applications',
    gradient: 'from-amber-500/10 via-amber-400/5 to-transparent',
    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600',
  },
];

interface QuickActionsCardProps {
  traineeProfile?: TraineeProfile | null;
}

export default function QuickActionsCard({ traineeProfile }: QuickActionsCardProps) {
  const [quickActions, setQuickActions] = useState<QuickActionItem[]>([]);

  useEffect(() => {
    // Check if any program attendance is pinned
    const hasAnyPinnedAttendance = Object.keys(localStorage).some(
      (key) => key.startsWith('pin_attendance_') && localStorage.getItem(key) === 'true'
    );

    // Filter actions based on pinned attendance
    const filteredActions = allQuickActions.filter((action) => {
      if (action.id === 'attendance') {
        return hasAnyPinnedAttendance;
      }
      return true;
    });

    setQuickActions(filteredActions);

    // Listen for storage changes (when user pins/unpins from modal)
    const handleStorageChange = () => {
      const hasAnyPinned = Object.keys(localStorage).some(
        (key) => key.startsWith('pin_attendance_') && localStorage.getItem(key) === 'true'
      );
      const filtered = allQuickActions.filter((action) => {
        if (action.id === 'attendance') {
          return hasAnyPinned;
        }
        return true;
      });
      setQuickActions(filtered);
    };

    // Custom event listener for localStorage changes in same window
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('attendance-pin-changed', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('attendance-pin-changed', handleStorageChange);
    };
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Quick Access</CardTitle>
        <CardDescription>Jump to your most-used sections</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {quickActions.map((action) => (
            <Link key={action.href} to={action.href}>
              <div className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <div className="p-2 rounded-lg bg-primary/10">
                  {React.cloneElement(action.icon as React.ReactElement<any>, {
                    className: 'h-5 w-5 text-primary',
                  })}
                </div>
                <span className="text-xs sm:text-sm font-semibold text-center">{action.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Calendar, Clock, MapPin } from 'lucide-react';

interface ProgramSession {
  id: string;
  program_id: string;
  session_number: number;
  date: string;
  session_date?: string;
  start_time: string;
  end_time: string;
  topic?: string;
  title?: string;
  description?: string;
  location?: string;
  session_type?: string;
  is_excluded_date?: boolean;
}

interface ExcludedDate {
  id: string;
  date: string;
  reason: string;
  description?: string;
}

interface UpcomingEventsCardProps {
  upcomingSessions?: ProgramSession[];
  excludedDates?: ExcludedDate[];
}

export default function UpcomingEventsCard({
  upcomingSessions = [],
  excludedDates = [],
}: UpcomingEventsCardProps) {
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) >= new Date();
  };

  const allEvents = [
    ...upcomingSessions
      .filter(s => isUpcoming(s.session_date || s.date))
      .map(session => ({
        id: session.id,
        title: session.title || session.topic || 'Session',
        type: session.session_type || 'lecture',
        date: session.session_date || session.date,
        startTime: session.start_time,
        endTime: session.end_time,
        location: session.location,
        isExcluded: session.is_excluded_date,
      })),
    ...excludedDates
      .filter(e => isUpcoming(e.date))
      .map(excluded => ({
        id: excluded.id,
        title: excluded.reason,
        type: 'excluded',
        date: excluded.date,
        description: excluded.description,
      })),
  ]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  if (allEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">What's Next</CardTitle>
          <CardDescription>Schedule & upcoming sessions</CardDescription>
        </CardHeader>
        <CardContent className="py-12 sm:py-16 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-bold mb-2">No upcoming events</p>
          <p className="text-muted-foreground">Check back soon for scheduled sessions and training dates</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">What's Next</CardTitle>
        <CardDescription>{allEvents.length} upcoming event{allEvents.length !== 1 ? 's' : ''}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 sm:space-y-3">
          {allEvents.map((event: any) => {
            const isExcluded = event.type === 'excluded';

            return (
              <div key={event.id} className="p-3 sm:p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-2 sm:mb-3">
                  <div>
                    <h4 className="font-bold text-base">{event.title}</h4>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {isExcluded ? 'No Session' : event.type}
                    </Badge>
                  </div>
                </div>

                {/* Metadata */}
                <div className="space-y-1 sm:space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>{formatDate(event.date)}</span>
                  </div>

                  {!isExcluded && event.startTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>{formatTime(event.startTime)} – {formatTime(event.endTime)}</span>
                    </div>
                  )}

                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="line-clamp-1">{event.location}</span>
                    </div>
                  )}

                  {event.description && (
                    <p className="text-sm mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-800">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

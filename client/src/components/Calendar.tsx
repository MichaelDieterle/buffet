import React from 'react';

interface CalendarProps {
  cal: { events: any[] }; // adjust types as needed
}

export const Calendar: React.FC<CalendarProps> = ({ cal }) => {
  if (!cal) return <div>Loading calendar...</div>;

  const { events } = cal;

  return (
    <div className="calendar">
      {events.length === 0 ? <div className="muted">Keine Termine</div> : (
        <>
          {events.map((event: any, index: number) => (
            <EventCard key={index} event={event} />
          ))}
        </>
      )}
    </div>
  );
};

interface EventCardProps {
  event: any;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const date = event.date ? new Date(event.date).toLocaleString() : '-';
  return (
    <div className="event">
      <div className="event-type">{event.type}</div>
      <div className="event-date">{date}</div>
      {event.earningsAverage != null && (
        <div className="event-extra">
          EPS-Schätzung: {formatNumber(event.earningsAverage)} (low {formatNumber(event.earningsLow)} / high {formatNumber(event.earningsHigh)})
        </div>
      )}
      {event.revenueAverage != null && (
        <div className="event-extra">
          Umsatz-Schätzung: {formatLarge(event.revenueAverage)}
        </div>
      )}
      {event.description && <div className="event-extra">{event.description}</div>}
      {event.isEstimate && <div className="event-tag">Schätzung</div>}
    </div>
  );
};

function formatNumber(num: number | null | undefined): string {
  if (num == null || !Number.isFinite(num)) return '-';
  return num.toString();
}

function formatLarge(num: number | null | undefined): string {
  if (num == null || !Number.isFinite(num)) return '-';
  const abs = Math.abs(num);
  if (abs >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return String(num);
}

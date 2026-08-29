import { Calendar } from 'lucide-react';
import { Button } from '../ui/Button';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangeSelector({ value: _value, onChange }: DateRangeSelectorProps) {
  const presets = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
  ];

  const handlePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange({ start, end });
  };

  return (
    <div className="flex gap-2 items-center">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      {presets.map((preset) => (
        <Button
          key={preset.days}
          variant="outline"
          size="sm"
          onClick={() => handlePreset(preset.days)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}

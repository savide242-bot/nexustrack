import { useState } from "react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { pt } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DateRange = { from: Date; to: Date };

const presets: Record<string, () => DateRange> = {
  today: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
  yesterday: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }),
  this_month: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }),
  last_month: () => {
    const d = subMonths(new Date(), 1);
    return { from: startOfMonth(d), to: endOfMonth(d) };
  },
  all_time: () => ({ from: new Date("2020-01-01"), to: endOfDay(new Date()) }),
};

interface DateFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

export function DateFilter({ value, onChange, className }: DateFilterProps) {
  const [preset, setPreset] = useState("today");
  const [customOpen, setCustomOpen] = useState(false);

  const handlePreset = (key: string) => {
    setPreset(key);
    if (key === "custom") {
      setCustomOpen(true);
      return;
    }
    const fn = presets[key];
    if (fn) onChange(fn());
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <Select value={preset} onValueChange={handlePreset}>
        <SelectTrigger className="w-[160px] bg-secondary border-border h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Hoje</SelectItem>
          <SelectItem value="yesterday">Ontem</SelectItem>
          <SelectItem value="this_month">Este Mês</SelectItem>
          <SelectItem value="last_month">Mês Passado</SelectItem>
          <SelectItem value="custom">Personalizado</SelectItem>
          <SelectItem value="all_time">Máximo</SelectItem>
        </SelectContent>
      </Select>

      {preset === "custom" && (
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-border h-9 text-xs">
                <CalendarIcon className="mr-1 h-3 w-3" />
                {format(value.from, "dd/MM", { locale: pt })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.from}
                onSelect={(d) => d && onChange({ ...value, from: startOfDay(d) })}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground text-xs">—</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="border-border h-9 text-xs">
                <CalendarIcon className="mr-1 h-3 w-3" />
                {format(value.to, "dd/MM", { locale: pt })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value.to}
                onSelect={(d) => d && onChange({ ...value, to: endOfDay(d) })}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

export function getDefaultRange(): DateRange {
  return presets.today();
}

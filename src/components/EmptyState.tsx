import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCta?: () => void;
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, ctaHref, onCta }: EmptyStateProps) {
  return (
    <Card className="glass-card border-border">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/30">
            <Icon className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h3 className="font-display text-xl font-bold text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
        {ctaLabel && (ctaHref ? (
          <Button asChild className="gradient-primary text-primary-foreground">
            <Link to={ctaHref}>{ctaLabel}</Link>
          </Button>
        ) : onCta ? (
          <Button onClick={onCta} className="gradient-primary text-primary-foreground">{ctaLabel}</Button>
        ) : null)}
      </CardContent>
    </Card>
  );
}

import { PageHeader } from "@/ledgerly/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export const ComingSoon = ({ title, description }: { title: string; description: string }) => (
  <>
    <PageHeader title={title} description={description} />
    <div className="p-6">
      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-12 text-center">
          <div className="inline-flex h-12 w-12 rounded-lg bg-muted items-center justify-center mb-4">
            <Construction className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground">Coming in the next phase</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Phase 1 covers the foundation. This module is part of the next build phase.
          </p>
        </CardContent>
      </Card>
    </div>
  </>
);

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ReturnToPOSButton } from '@/components/layout/ReturnToPOSButton';

export default function StockReconciliation() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Reconciliation</h1>
          <p className="text-muted-foreground">Stock tracking has been simplified for better performance</p>
        </div>
        <ReturnToPOSButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Simple Stock Tracking</CardTitle>
          <CardDescription>
            FIFO inventory layers have been removed for improved system performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Stock reconciliation is no longer needed</p>
                <p>
                  The system now uses direct stock tracking without FIFO layers, providing:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Faster transaction processing</li>
                  <li>Immediate stock updates</li>
                  <li>Simplified inventory management</li>
                  <li>No layer synchronization issues</li>
                </ul>
                <p className="mt-4">
                  Use the <strong>Stock Adjustment</strong> page to manually adjust stock quantities when needed.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

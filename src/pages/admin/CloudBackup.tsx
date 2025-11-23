import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Cloud, CloudDownload, CloudUpload, Database, RefreshCw, Settings, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

const DEFAULT_TABLES = [
  'products',
  'product_variants',
  'categories',
  'contacts',
  'purchases',
  'purchase_items',
  'pos_transactions',
  'orders',
  'inventory_layers',
  'stock_adjustments',
];

export default function CloudBackup() {
  const [selectedTables, setSelectedTables] = useState<string[]>(DEFAULT_TABLES);
  const queryClient = useQueryClient();

  // Fetch backup settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['backup-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backup_settings')
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch backup logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['backup-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('backup_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from('backup_settings')
        .update(updates)
        .eq('id', '00000000-0000-0000-0000-000000000001');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-settings'] });
      toast.success('Settings updated');
    },
    onError: (error) => {
      toast.error('Failed to update settings: ' + error.message);
    },
  });

  // Backup mutation
  const backupMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        'https://wvdrsofehwiopbkzrqit.supabase.co/functions/v1/cloud-backup',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'backup',
            tables: selectedTables,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Backup failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backup-logs'] });
      queryClient.invalidateQueries({ queryKey: ['backup-settings'] });
      toast.success(`Backup completed! ${Object.keys(data.recordsCounts).length} tables backed up`);
    },
    onError: (error: Error) => {
      toast.error('Backup failed: ' + error.message);
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        'https://wvdrsofehwiopbkzrqit.supabase.co/functions/v1/cloud-backup',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'restore',
            tables: selectedTables,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Restore failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Restore completed! ${Object.keys(data.recordsCounts).length} tables restored`);
    },
    onError: (error: Error) => {
      toast.error('Restore failed: ' + error.message);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: 'default',
      failed: 'destructive',
      in_progress: 'secondary',
      pending: 'outline',
    };
    
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Cloud className="h-8 w-8" />
            Cloud Backup
          </h1>
          <p className="text-muted-foreground">Backup and restore your data to the cloud</p>
        </div>
      </div>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Backup Settings
          </CardTitle>
          <CardDescription>Configure automatic backup settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Automatic Backups</Label>
              <p className="text-sm text-muted-foreground">
                Enable scheduled backups to cloud
              </p>
            </div>
            <Switch
              checked={settings?.auto_backup_enabled || false}
              onCheckedChange={(checked) =>
                updateSettings.mutate({ auto_backup_enabled: checked })
              }
              disabled={settingsLoading}
            />
          </div>

          <div className="space-y-2">
            <Label>Backup Frequency (hours)</Label>
            <Input
              type="number"
              min="1"
              max="168"
              value={settings?.backup_frequency_hours || 24}
              onChange={(e) =>
                updateSettings.mutate({ backup_frequency_hours: parseInt(e.target.value) })
              }
              disabled={settingsLoading}
            />
          </div>

          {settings?.last_backup_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last backup: {formatDistanceToNow(new Date(settings.last_backup_at), { addSuffix: true })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Backup Card */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Backup & Restore</CardTitle>
          <CardDescription>Select tables to backup or restore</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {DEFAULT_TABLES.map((table) => (
              <div key={table} className="flex items-center space-x-2">
                <Checkbox
                  id={table}
                  checked={selectedTables.includes(table)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedTables([...selectedTables, table]);
                    } else {
                      setSelectedTables(selectedTables.filter((t) => t !== table));
                    }
                  }}
                />
                <Label htmlFor={table} className="text-sm font-normal cursor-pointer">
                  {table}
                </Label>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => backupMutation.mutate()}
              disabled={backupMutation.isPending || selectedTables.length === 0}
              className="flex-1"
            >
              <CloudUpload className="h-4 w-4 mr-2" />
              {backupMutation.isPending ? 'Backing up...' : 'Backup to Cloud'}
            </Button>
            <Button
              onClick={() => restoreMutation.mutate()}
              disabled={restoreMutation.isPending || selectedTables.length === 0}
              variant="outline"
              className="flex-1"
            >
              <CloudDownload className="h-4 w-4 mr-2" />
              {restoreMutation.isPending ? 'Restoring...' : 'Restore from Cloud'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Selected {selectedTables.length} of {DEFAULT_TABLES.length} tables
          </p>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup History
          </CardTitle>
          <CardDescription>Recent backup operations</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : !logs || logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No backup history yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Tables</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        {getStatusBadge(log.status)}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{log.backup_type}</TableCell>
                    <TableCell>{log.tables_backed_up?.length || 0}</TableCell>
                    <TableCell>
                      {log.records_count 
                        ? Object.values(log.records_count as Record<string, number>).reduce((a, b) => a + b, 0)
                        : 0
                      }
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {log.completed_at
                        ? `${Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)}s`
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

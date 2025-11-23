import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Cloud, Download, Upload, RefreshCw, Trash2, Clock, Database } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Backup {
  id: string;
  backup_name: string;
  backup_size: number;
  table_count: number;
  record_count: number;
  created_at: string;
  created_by: string | null;
  status: string;
  metadata: any;
}

export default function CloudBackup() {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const queryClient = useQueryClient();

  // Fetch backup history
  const { data: backups, isLoading } = useQuery({
    queryKey: ["cloud-backups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cloud_backups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Backup[];
    },
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      setIsBackingUp(true);
      
      // Get all table data from local database
      const tables = [
        "products", "product_variants", "categories", "contacts", 
        "purchases", "purchase_items", "pos_transactions", 
        "orders", "order_items", "stores", "settings",
        "inventory_layers", "accounts", "journal_entries", "journal_entry_lines"
      ];
      
      const backupData: any = {};
      let totalRecords = 0;
      
      for (const table of tables) {
        try {
          const { data, error } = await supabase.from(table).select("*");
          if (!error && data) {
            backupData[table] = data;
            totalRecords += data.length;
          }
        } catch (err) {
          console.error(`Error backing up ${table}:`, err);
        }
      }

      // Create backup record with data
      const { data: backup, error: backupError } = await supabase
        .from("cloud_backups")
        .insert({
          backup_name: `Backup ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`,
          backup_size: JSON.stringify(backupData).length,
          table_count: tables.length,
          record_count: totalRecords,
          status: "completed",
          metadata: {
            tables: tables,
            timestamp: new Date().toISOString(),
            data: backupData
          }
        })
        .select()
        .single();

      if (backupError) throw backupError;
      return backup;
    },
    onSuccess: () => {
      toast.success("Cloud backup created successfully");
      queryClient.invalidateQueries({ queryKey: ["cloud-backups"] });
      setIsBackingUp(false);
    },
    onError: (error: any) => {
      toast.error("Backup failed: " + error.message);
      setIsBackingUp(false);
    },
  });

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      setIsRestoring(true);
      
      // Get backup data
      const { data: backup, error } = await supabase
        .from("cloud_backups")
        .select("*")
        .eq("id", backupId)
        .single();

      if (error) throw error;
      if (!backup.metadata?.data) throw new Error("No backup data found");

      const backupData = backup.metadata.data;
      const errors: string[] = [];

      // Restore each table
      for (const [tableName, records] of Object.entries(backupData)) {
        if (!Array.isArray(records) || records.length === 0) continue;
        
        try {
          // Delete existing data (optional - can be made configurable)
          // await supabase.from(tableName).delete().neq('id', '00000000-0000-0000-0000-000000000000');
          
          // Insert backup data in chunks
          const chunkSize = 100;
          for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            const { error: insertError } = await supabase
              .from(tableName)
              .upsert(chunk, { onConflict: 'id' });
            
            if (insertError) {
              errors.push(`${tableName}: ${insertError.message}`);
            }
          }
        } catch (err: any) {
          errors.push(`${tableName}: ${err.message}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(`Restore completed with errors:\n${errors.join('\n')}`);
      }

      return backup;
    },
    onSuccess: () => {
      toast.success("Database restored successfully");
      queryClient.invalidateQueries();
      setIsRestoring(false);
    },
    onError: (error: any) => {
      toast.error("Restore failed: " + error.message);
      setIsRestoring(false);
    },
  });

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const { error } = await supabase
        .from("cloud_backups")
        .delete()
        .eq("id", backupId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Backup deleted");
      queryClient.invalidateQueries({ queryKey: ["cloud-backups"] });
    },
    onError: (error: any) => {
      toast.error("Delete failed: " + error.message);
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Cloud className="h-8 w-8 text-primary" />
            Cloud Backup
          </h1>
          <p className="text-muted-foreground mt-2">
            Backup your local database to cloud and restore when needed
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => createBackupMutation.mutate()}
          disabled={isBackingUp}
        >
          {isBackingUp ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Creating Backup...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Create Backup Now
            </>
          )}
        </Button>
      </div>

      <Alert>
        <Database className="h-4 w-4" />
        <AlertDescription>
          Backups are stored in your cloud Supabase instance. You can restore any backup to your local database.
          <br />
          <strong>Note:</strong> Restoring will merge data using upsert (existing records will be updated).
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ) : backups && backups.length > 0 ? (
          backups.map((backup) => (
            <Card key={backup.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {backup.backup_name}
                      <Badge variant={backup.status === "completed" ? "default" : "secondary"}>
                        {backup.status}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(backup.created_at), "PPp")}
                      </span>
                      <span>{formatBytes(backup.backup_size)}</span>
                      <span>{backup.table_count} tables</span>
                      <span>{backup.record_count.toLocaleString()} records</span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreBackupMutation.mutate(backup.id)}
                      disabled={isRestoring}
                    >
                      {isRestoring ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Restore
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this backup?")) {
                          deleteBackupMutation.mutate(backup.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Cloud className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No backups yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first backup to secure your data in the cloud
              </p>
              <Button onClick={() => createBackupMutation.mutate()}>
                <Upload className="h-4 w-4 mr-2" />
                Create First Backup
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

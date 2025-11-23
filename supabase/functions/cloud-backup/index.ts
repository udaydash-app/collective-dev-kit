import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupRequest {
  action: 'backup' | 'restore';
  tables?: string[];
  backupId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Local Supabase client (source)
    const localSupabase = createClient(
      'http://supabase-kong:8000',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZHJzb2ZlaHdpb3Bia3pycWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDQ3MTU2NSwiZXhwIjoyMDc2MDQ3NTY1fQ.cHpPdSz7EhP3P-9EWwBN0I2HdHvRGG1xtLq_IxTl3yQ',
      { auth: { persistSession: false } }
    );

    // Cloud Supabase client (destination)
    const cloudSupabase = createClient(
      'https://wvdrsofehwiopbkzrqit.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZHJzb2ZlaHdpb3Bia3pycWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDQ3MTU2NSwiZXhwIjoyMDc2MDQ3NTY1fQ.cHpPdSz7EhP3P-9EWwBN0I2HdHvRGG1xtLq_IxTl3yQ',
      { auth: { persistSession: false } }
    );

    const { action, tables, backupId }: BackupRequest = await req.json();

    // Get user from local instance
    const { data: { user }, error: userError } = await localSupabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verify admin role
    const { data: roleData } = await localSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    if (action === 'backup') {
      // Create backup log entry
      const { data: backupLog, error: logError } = await localSupabase
        .from('backup_logs')
        .insert({
          backup_type: 'manual',
          status: 'in_progress',
          triggered_by: user.id,
          tables_backed_up: tables || [],
        })
        .select()
        .single();

      if (logError) throw logError;

      const recordsCounts: Record<string, number> = {};
      let totalSize = 0;

      try {
        // Backup each table
        for (const table of tables || []) {
          console.log(`Backing up table: ${table}`);
          
          // Fetch all data from local
          const { data: localData, error: fetchError } = await localSupabase
            .from(table)
            .select('*');

          if (fetchError) {
            console.error(`Error fetching ${table}:`, fetchError);
            continue;
          }

          if (!localData || localData.length === 0) {
            recordsCounts[table] = 0;
            continue;
          }

          recordsCounts[table] = localData.length;
          totalSize += JSON.stringify(localData).length;

          // Delete existing data in cloud (optional - comment out to append instead)
          await cloudSupabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');

          // Insert data to cloud in batches
          const batchSize = 100;
          for (let i = 0; i < localData.length; i += batchSize) {
            const batch = localData.slice(i, i + batchSize);
            const { error: insertError } = await cloudSupabase
              .from(table)
              .upsert(batch, { onConflict: 'id' });

            if (insertError) {
              console.error(`Error inserting batch for ${table}:`, insertError);
            }
          }
        }

        // Update backup log
        await localSupabase
          .from('backup_logs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_count: recordsCounts,
            backup_size_bytes: totalSize,
          })
          .eq('id', backupLog.id);

        // Update backup settings
        await localSupabase
          .from('backup_settings')
          .update({
            last_backup_at: new Date().toISOString(),
          })
          .eq('id', '00000000-0000-0000-0000-000000000001');

        return new Response(
          JSON.stringify({
            success: true,
            backupId: backupLog.id,
            recordsCounts,
            totalSize,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        // Update backup log with error
        await localSupabase
          .from('backup_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message,
          })
          .eq('id', backupLog.id);

        throw error;
      }
    } else if (action === 'restore') {
      // Restore functionality (reverse direction)
      const recordsCounts: Record<string, number> = {};

      for (const table of tables || []) {
        console.log(`Restoring table: ${table}`);
        
        // Fetch all data from cloud
        const { data: cloudData, error: fetchError } = await cloudSupabase
          .from(table)
          .select('*');

        if (fetchError || !cloudData) {
          console.error(`Error fetching ${table}:`, fetchError);
          continue;
        }

        recordsCounts[table] = cloudData.length;

        // Delete existing data in local
        await localSupabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // Insert data to local in batches
        const batchSize = 100;
        for (let i = 0; i < cloudData.length; i += batchSize) {
          const batch = cloudData.slice(i, i + batchSize);
          const { error: insertError } = await localSupabase
            .from(table)
            .upsert(batch, { onConflict: 'id' });

          if (insertError) {
            console.error(`Error inserting batch for ${table}:`, insertError);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          recordsCounts,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('Backup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

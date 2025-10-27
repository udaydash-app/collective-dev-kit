import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Contact {
  name: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  is_customer?: boolean;
  is_supplier?: boolean;
  opening_balance?: number;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  tax_id?: string;
  credit_limit?: number;
  notes?: string;
  created_by?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { fileData, fileName } = await req.json();

    if (!fileData) {
      throw new Error('No file data provided');
    }

    // Convert base64 to buffer
    const buffer = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
    
    // Parse the file
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet);

    console.log(`Processing ${jsonData.length} contacts from file: ${fileName}`);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of jsonData as any[]) {
      try {
        // Validate required field
        if (!row.name || row.name.toString().trim() === '') {
          skipped++;
          errors.push(`Row skipped: Missing name`);
          continue;
        }

        // Parse boolean values (TRUE/FALSE, 1/0, yes/no)
        const parseBoolean = (value: any): boolean => {
          if (typeof value === 'boolean') return value;
          if (typeof value === 'number') return value === 1;
          if (typeof value === 'string') {
            const normalized = value.toLowerCase().trim();
            return normalized === 'true' || normalized === 'yes' || normalized === '1';
          }
          return false;
        };

        const contact: Contact = {
          name: row.name.toString().trim(),
          email: row.email?.toString().trim() || null,
          phone: row.phone?.toString().trim() || null,
          contact_person: row.contact_person?.toString().trim() || null,
          is_customer: parseBoolean(row.is_customer),
          is_supplier: parseBoolean(row.is_supplier),
          opening_balance: parseFloat(row.opening_balance || '0') || 0,
          address_line1: row.address_line1?.toString().trim() || null,
          address_line2: row.address_line2?.toString().trim() || null,
          city: row.city?.toString().trim() || null,
          state: row.state?.toString().trim() || null,
          zip_code: row.zip_code?.toString().trim() || null,
          country: row.country?.toString().trim() || null,
          tax_id: row.tax_id?.toString().trim() || null,
          credit_limit: parseFloat(row.credit_limit || '0') || undefined,
          notes: row.notes?.toString().trim() || null,
          created_by: user.id,
        };

        // Check if contact already exists (by name or email)
        const { data: existing } = await supabaseClient
          .from('contacts')
          .select('id')
          .or(`name.eq.${contact.name}${contact.email ? `,email.eq.${contact.email}` : ''}`)
          .limit(1)
          .single();

        if (existing) {
          skipped++;
          errors.push(`Contact "${contact.name}" already exists`);
          continue;
        }

        // Insert contact
        const { error: insertError } = await supabaseClient
          .from('contacts')
          .insert(contact);

        if (insertError) {
          skipped++;
          errors.push(`Failed to insert "${contact.name}": ${insertError.message}`);
          console.error('Insert error:', insertError);
          continue;
        }

        imported++;
      } catch (error: any) {
        skipped++;
        errors.push(`Error processing row: ${error.message}`);
        console.error('Row processing error:', error);
      }
    }

    console.log(`Import complete: ${imported} imported, ${skipped} skipped`);
    if (errors.length > 0) {
      console.log('Errors:', errors.slice(0, 10)); // Log first 10 errors
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        total: jsonData.length,
        errors: errors.slice(0, 10), // Return first 10 errors
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

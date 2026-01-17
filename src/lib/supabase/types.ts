/**
 * Database types generated from Supabase
 * 
 * To regenerate types:
 * npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
 * 
 * For now, this is a placeholder with basic structure.
 * Update with actual types from your Supabase project.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          status: 'active' | 'suspended' | 'deleted';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          status?: 'active' | 'suspended' | 'deleted';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          status?: 'active' | 'suspended' | 'deleted';
          created_at?: string;
          updated_at?: string;
        };
      };
      licenses: {
        Row: {
          id: string;
          tenant_id: string;
          license_key_hash: string;
          status: 'active' | 'revoked' | 'expired';
          revoked_at: string | null;
          max_sites: number;
          plan_limits: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          license_key_hash: string;
          status?: 'active' | 'revoked' | 'expired';
          revoked_at?: string | null;
          max_sites: number;
          plan_limits: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          license_key_hash?: string;
          status?: 'active' | 'revoked' | 'expired';
          revoked_at?: string | null;
          max_sites?: number;
          plan_limits?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      sites: {
        Row: {
          id: string;
          tenant_id: string;
          license_id: string;
          site_url: string;
          site_name: string | null;
          environment: 'production' | 'staging';
          status: 'active' | 'disabled';
          allowed_origins: string[];
          secret: string;
          secret_rotated_at: string | null;
          paired_at: string | null;
          last_seen_at: string | null;
          disabled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          license_id: string;
          site_url: string;
          site_name?: string | null;
          environment?: 'production' | 'staging';
          status?: 'active' | 'disabled';
          allowed_origins?: string[];
          secret: string;
          secret_rotated_at?: string | null;
          paired_at?: string | null;
          last_seen_at?: string | null;
          disabled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          license_id?: string;
          site_url?: string;
          site_name?: string | null;
          environment?: 'production' | 'staging';
          status?: 'active' | 'disabled';
          allowed_origins?: string[];
          secret?: string;
          secret_rotated_at?: string | null;
          paired_at?: string | null;
          last_seen_at?: string | null;
          disabled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      // Add other tables as needed
      [key: string]: any;
    };
    Views: {
      [key: string]: {
        Row: {
          [key: string]: any;
        };
      };
    };
    Functions: {
      [key: string]: {
        Args: {
          [key: string]: any;
        };
        Returns: any;
      };
    };
    Enums: {
      [key: string]: string;
    };
  };
}

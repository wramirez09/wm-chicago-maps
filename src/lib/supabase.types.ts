/**
 * Database types for the Supabase client.
 *
 * ⚠️ HAND-WRITTEN PLACEHOLDER — regenerate from the real schema instead of
 * editing this by hand:
 *
 *     supabase gen types typescript --local > src/lib/supabase.types.ts
 *
 * It exists because the generated file could not be produced here: that
 * command needs a running local Supabase instance (`supabase start`). The
 * tables below are the ones this app's code actually reads and writes, so the
 * client is typed rather than resolving every `.from()` to `never`. Anything
 * not listed here will not type-check until the file is regenerated.
 */

export type Json = string | number | boolean | null | {[key: string]: Json} | Json[];

type Timestamped = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      devices: {
        Row: Timestamped & {
          id: string;
          token: string;
          platform: 'ios' | 'android';
          user_id: string | null;
        };
        Insert: {
          id?: string;
          token: string;
          platform: 'ios' | 'android';
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          token?: string;
          platform?: 'ios' | 'android';
          user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      places: {
        Row: Timestamped & {
          id: string;
          name: string;
          /** PostGIS geography(Point,4326); PostgREST renders it as GeoJSON. */
          geom: Json | null;
          address: string | null;
          community_area: string | null;
          category: string | null;
          source: string | null;
          source_id: string | null;
          is_independent: boolean | null;
        };
        Insert: {
          id?: string;
          name: string;
          geom?: Json | null;
          address?: string | null;
          community_area?: string | null;
          category?: string | null;
          source?: string | null;
          source_id?: string | null;
          is_independent?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          name: string;
          geom: Json | null;
          address: string | null;
          community_area: string | null;
          category: string | null;
          source: string | null;
          source_id: string | null;
          is_independent: boolean | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      /** Raw ingest landing table — written by scripts/ingest/*, never the app. */
      places_raw: {
        Row: {
          id: string;
          source: string;
          source_id: string;
          name: string | null;
          brand: string | null;
          categories: Json | null;
          longitude: number | null;
          latitude: number | null;
          raw: Json;
          ingested_at: string;
        };
        Insert: {
          id?: string;
          source: string;
          source_id: string;
          name?: string | null;
          brand?: string | null;
          categories?: Json | null;
          longitude?: number | null;
          latitude?: number | null;
          raw: Json;
          ingested_at?: string;
        };
        Update: Partial<{
          name: string | null;
          brand: string | null;
          categories: Json | null;
          longitude: number | null;
          latitude: number | null;
          raw: Json;
          ingested_at: string;
        }>;
        Relationships: [];
      };
      community_areas: {
        Row: {
          id: string;
          area_number: string;
          name: string;
          geom: Json | null;
          wikipedia_extract: string | null;
          wikipedia_url: string | null;
          image_url: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          area_number: string;
          name: string;
          geom?: Json | null;
          wikipedia_extract?: string | null;
          wikipedia_url?: string | null;
          image_url?: string | null;
          updated_at?: string;
        };
        Update: Partial<{
          name: string;
          geom: Json | null;
          wikipedia_extract: string | null;
          wikipedia_url: string | null;
          image_url: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      transit_stops: {
        Row: {
          id: string;
          agency: 'cta' | 'metra';
          stop_id: string;
          stop_name: string;
          latitude: number;
          longitude: number;
          route_ids: string[] | null;
        };
        Insert: {
          id?: string;
          agency: 'cta' | 'metra';
          stop_id: string;
          stop_name: string;
          latitude: number;
          longitude: number;
          route_ids?: string[] | null;
        };
        Update: Partial<{
          stop_name: string;
          latitude: number;
          longitude: number;
          route_ids: string[] | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: string | null
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      clients: {
        Row: {
          company_name: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          document: string | null
          user_id: string
        }
        Insert: {
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          document?: string | null
          user_id: string
        }
        Update: {
          company_name?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          document?: string | null
          user_id?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_photo_url: string | null
          invoice_url: string | null
          order_id: string
          pickup_photo_url: string | null
          receiver_document: string | null
          receiver_name: string | null
          signature_url: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_photo_url?: string | null
          invoice_url?: string | null
          order_id: string
          pickup_photo_url?: string | null
          receiver_document?: string | null
          receiver_name?: string | null
          signature_url?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_photo_url?: string | null
          invoice_url?: string | null
          order_id?: string
          pickup_photo_url?: string | null
          receiver_document?: string | null
          receiver_name?: string | null
          signature_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_documents: {
        Row: {
          created_at: string
          driver_id: string
          expires_at: string | null
          file_path: string
          id: string
          kind: string
          label: string | null
          mime_type: string | null
          size_bytes: number | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          expires_at?: string | null
          file_path: string
          id?: string
          kind: string
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          expires_at?: string | null
          file_path?: string
          id?: string
          kind?: string
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          accuracy_m: number | null
          created_at: string
          distance_to_destination_km: number | null
          driver_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          order_id: string
          speed_kmh: number | null
        }
        Insert: {
          accuracy_m?: number | null
          created_at?: string
          distance_to_destination_km?: number | null
          driver_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          order_id: string
          speed_kmh?: number | null
        }
        Update: {
          accuracy_m?: number | null
          created_at?: string
          distance_to_destination_km?: number | null
          driver_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          order_id?: string
          speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_ratings: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string
          id: string
          notes: string | null
          order_id: string | null
          score: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id: string
          id?: string
          notes?: string | null
          order_id?: string | null
          score: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          antt_expires_at: string | null
          approval_status: Database["public"]["Enums"]["driver_approval_status"]
          availability: Database["public"]["Enums"]["driver_availability"]
          bank_account: string | null
          bank_account_digit: string | null
          bank_account_type:
            | Database["public"]["Enums"]["bank_account_type"]
            | null
          bank_agency: string | null
          bank_code: string | null
          bank_name: string | null
          birth_date: string | null
          city: string | null
          civil_status: string | null
          cnh_expires_at: string | null
          cnh_issued_at: string | null
          correction_notes: string | null
          cpf: string | null
          created_at: string
          current_accuracy: number | null
          current_altitude: number | null
          current_heading: number | null
          current_lat: number | null
          current_lng: number | null
          current_speed: number | null
          current_vehicle_id: string | null
          daily_rate: number | null
          default_price_per_km: number | null
          email: string | null
          favored_document: string | null
          favored_name: string | null
          financial_notes: string | null
          financial_status: Database["public"]["Enums"]["driver_financial_status"]
          gender: string | null
          hourly_wait_rate: number | null
          last_seen_at: string | null
          license_category: string | null
          license_number: string | null
          min_freight_value: number | null
          neighborhood: string | null
          notes: string | null
          owns_vehicle: boolean
          payment_term_days: number | null
          phone: string | null
          photo_url: string | null
          pix_key: string | null
          pix_key_type: Database["public"]["Enums"]["pix_key_type"] | null
          preferred_payment_method:
            | Database["public"]["Enums"]["payment_method_pref"]
            | null
          rating: number | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rg: string | null
          rntrc: string | null
          state: string | null
          status: Database["public"]["Enums"]["driver_status"]
          submitted_at: string | null
          user_id: string
          whatsapp: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          antt_expires_at?: string | null
          approval_status?: Database["public"]["Enums"]["driver_approval_status"]
          availability?: Database["public"]["Enums"]["driver_availability"]
          bank_account?: string | null
          bank_account_digit?: string | null
          bank_account_type?:
            | Database["public"]["Enums"]["bank_account_type"]
            | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          birth_date?: string | null
          city?: string | null
          civil_status?: string | null
          cnh_expires_at?: string | null
          cnh_issued_at?: string | null
          correction_notes?: string | null
          cpf?: string | null
          created_at?: string
          current_accuracy?: number | null
          current_altitude?: number | null
          current_heading?: number | null
          current_lat?: number | null
          current_lng?: number | null
          current_speed?: number | null
          current_vehicle_id?: string | null
          daily_rate?: number | null
          default_price_per_km?: number | null
          email?: string | null
          favored_document?: string | null
          favored_name?: string | null
          financial_notes?: string | null
          financial_status?: Database["public"]["Enums"]["driver_financial_status"]
          gender?: string | null
          hourly_wait_rate?: number | null
          last_seen_at?: string | null
          license_category?: string | null
          license_number?: string | null
          min_freight_value?: number | null
          neighborhood?: string | null
          notes?: string | null
          owns_vehicle?: boolean
          payment_term_days?: number | null
          phone?: string | null
          photo_url?: string | null
          pix_key?: string | null
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"] | null
          preferred_payment_method?:
            | Database["public"]["Enums"]["payment_method_pref"]
            | null
          rating?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rg?: string | null
          rntrc?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          submitted_at?: string | null
          user_id: string
          whatsapp?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          antt_expires_at?: string | null
          approval_status?: Database["public"]["Enums"]["driver_approval_status"]
          availability?: Database["public"]["Enums"]["driver_availability"]
          bank_account?: string | null
          bank_account_digit?: string | null
          bank_account_type?:
            | Database["public"]["Enums"]["bank_account_type"]
            | null
          bank_agency?: string | null
          bank_code?: string | null
          bank_name?: string | null
          birth_date?: string | null
          city?: string | null
          civil_status?: string | null
          cnh_expires_at?: string | null
          cnh_issued_at?: string | null
          correction_notes?: string | null
          cpf?: string | null
          created_at?: string
          current_accuracy?: number | null
          current_altitude?: number | null
          current_heading?: number | null
          current_lat?: number | null
          current_lng?: number | null
          current_speed?: number | null
          current_vehicle_id?: string | null
          daily_rate?: number | null
          default_price_per_km?: number | null
          email?: string | null
          favored_document?: string | null
          favored_name?: string | null
          financial_notes?: string | null
          financial_status?: Database["public"]["Enums"]["driver_financial_status"]
          gender?: string | null
          hourly_wait_rate?: number | null
          last_seen_at?: string | null
          license_category?: string | null
          license_number?: string | null
          min_freight_value?: number | null
          neighborhood?: string | null
          notes?: string | null
          owns_vehicle?: boolean
          payment_term_days?: number | null
          phone?: string | null
          photo_url?: string | null
          pix_key?: string | null
          pix_key_type?: Database["public"]["Enums"]["pix_key_type"] | null
          preferred_payment_method?:
            | Database["public"]["Enums"]["payment_method_pref"]
            | null
          rating?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rg?: string | null
          rntrc?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          submitted_at?: string | null
          user_id?: string
          whatsapp?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_current_vehicle_id_fkey"
            columns: ["current_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_costs: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["freight_cost_kind"]
          label: string | null
          notes: string | null
          program_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["freight_cost_kind"]
          label?: string | null
          notes?: string | null
          program_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["freight_cost_kind"]
          label?: string | null
          notes?: string | null
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_costs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "freight_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_offers: {
        Row: {
          accepted_at: string | null
          accepted_lat: number | null
          accepted_lng: number | null
          created_at: string
          driver_id: string
          expires_at: string | null
          id: string
          offered_price: number
          order_id: string
          status: Database["public"]["Enums"]["offer_status"]
          time_to_accept_seconds: number | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_lat?: number | null
          accepted_lng?: number | null
          created_at?: string
          driver_id: string
          expires_at?: string | null
          id?: string
          offered_price: number
          order_id: string
          status?: Database["public"]["Enums"]["offer_status"]
          time_to_accept_seconds?: number | null
        }
        Update: {
          accepted_at?: string | null
          accepted_lat?: number | null
          accepted_lng?: number | null
          created_at?: string
          driver_id?: string
          expires_at?: string | null
          id?: string
          offered_price?: number
          order_id?: string
          status?: Database["public"]["Enums"]["offer_status"]
          time_to_accept_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "freight_offers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_programs: {
        Row: {
          created_at: string
          freight_value: number | null
          id: string
          order_id: string
          payment_method:
            | Database["public"]["Enums"]["freight_payment_method"]
            | null
          payment_notes: string | null
          payment_term:
            | Database["public"]["Enums"]["freight_payment_term"]
            | null
          pf_code: string
          responsible_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["freight_program_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          freight_value?: number | null
          id?: string
          order_id: string
          payment_method?:
            | Database["public"]["Enums"]["freight_payment_method"]
            | null
          payment_notes?: string | null
          payment_term?:
            | Database["public"]["Enums"]["freight_payment_term"]
            | null
          pf_code?: string
          responsible_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["freight_program_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          freight_value?: number | null
          id?: string
          order_id?: string
          payment_method?:
            | Database["public"]["Enums"]["freight_payment_method"]
            | null
          payment_notes?: string | null
          payment_term?:
            | Database["public"]["Enums"]["freight_payment_term"]
            | null
          pf_code?: string
          responsible_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["freight_program_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_programs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_id: string
          reported_by: string | null
          resolved_at: string | null
          severity: string | null
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_id: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: string | null
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_url: string | null
          content: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          order_id: string
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          order_id: string
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          order_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiations: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          offer_id: string
          proposed_by: string
          status: Database["public"]["Enums"]["negotiation_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          offer_id: string
          proposed_by: string
          status?: Database["public"]["Enums"]["negotiation_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          offer_id?: string
          proposed_by?: string
          status?: Database["public"]["Enums"]["negotiation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "negotiations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "freight_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          body: string
          channel: string
          created_at: string
          error: string | null
          id: string
          order_id: string
          payload: Json | null
          recipient: string | null
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          order_id: string
          payload?: Json | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string
          payload?: Json | null
          recipient?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_attachments: {
        Row: {
          created_at: string
          file_path: string
          id: string
          kind: string
          label: string | null
          mime_type: string | null
          order_id: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          kind: string
          label?: string | null
          mime_type?: string | null
          order_id: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          kind?: string
          label?: string | null
          mime_type?: string | null
          order_id?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          order_id: string
          payload: Json | null
          to_status: Database["public"]["Enums"]["order_status"] | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id: string
          payload?: Json | null
          to_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id?: string
          payload?: Json | null
          to_status?: Database["public"]["Enums"]["order_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking_points: {
        Row: {
          accuracy: number | null
          altitude: number | null
          created_at: string
          driver_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          order_id: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          created_at?: string
          driver_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          order_id: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          created_at?: string
          driver_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          order_id?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_points_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          approach_notified_at: string | null
          arrival_detected_at: string | null
          arrival_override_at: string | null
          arrival_override_by: string | null
          arrived_at: string | null
          cargo_description: string | null
          cargo_type: string | null
          cargo_value: number | null
          cargo_value_declared: number | null
          cargo_volume_m3: number | null
          cargo_weight_kg: number | null
          client_id: string | null
          client_name: string | null
          code: string
          completed_at: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          cte_number: string | null
          current_city: string | null
          current_lat: number | null
          current_lng: number | null
          deleted_at: string | null
          delivery_dock: string | null
          delivery_franchise_minutes: number | null
          delivery_gate: string | null
          delivery_reference: string | null
          delivery_whatsapp: string | null
          delivery_window_end: string | null
          delivery_window_start: string | null
          destination_address: string
          destination_city: string | null
          destination_lat: number | null
          destination_lng: number | null
          destination_neighborhood: string | null
          destination_number: string | null
          destination_state: string | null
          destination_zip: string | null
          distance_km: number | null
          distance_to_destination_km: number | null
          driver_id: string | null
          estimated_minutes: number | null
          estimated_tolls: number | null
          eta_minutes: number | null
          id: string
          initial_distance_km: number | null
          invoice_number: string | null
          invoice_url: string | null
          invoice_value: number | null
          last_ping_at: string | null
          mdfe_number: string | null
          near_notified_at: string | null
          notes: string | null
          origin_address: string
          origin_city: string | null
          origin_lat: number | null
          origin_lng: number | null
          origin_neighborhood: string | null
          origin_number: string | null
          origin_state: string | null
          origin_zip: string | null
          pickup_dock: string | null
          pickup_franchise_minutes: number | null
          pickup_gate: string | null
          pickup_instructions: string | null
          pickup_phone_name: string | null
          pickup_reference: string | null
          pickup_whatsapp: string | null
          pickup_window_end: string | null
          pickup_window_start: string | null
          price: number | null
          priority: string
          route_geometry: string | null
          route_highways: string | null
          scheduled_at: string | null
          started_at: string | null
          started_trip_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          tracking_code: string
          updated_at: string
          vehicle_id: string | null
          volumes: number | null
        }
        Insert: {
          approach_notified_at?: string | null
          arrival_detected_at?: string | null
          arrival_override_at?: string | null
          arrival_override_by?: string | null
          arrived_at?: string | null
          cargo_description?: string | null
          cargo_type?: string | null
          cargo_value?: number | null
          cargo_value_declared?: number | null
          cargo_volume_m3?: number | null
          cargo_weight_kg?: number | null
          client_id?: string | null
          client_name?: string | null
          code?: string
          completed_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          cte_number?: string | null
          current_city?: string | null
          current_lat?: number | null
          current_lng?: number | null
          deleted_at?: string | null
          delivery_dock?: string | null
          delivery_franchise_minutes?: number | null
          delivery_gate?: string | null
          delivery_reference?: string | null
          delivery_whatsapp?: string | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          destination_address: string
          destination_city?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_neighborhood?: string | null
          destination_number?: string | null
          destination_state?: string | null
          destination_zip?: string | null
          distance_km?: number | null
          distance_to_destination_km?: number | null
          driver_id?: string | null
          estimated_minutes?: number | null
          estimated_tolls?: number | null
          eta_minutes?: number | null
          id?: string
          initial_distance_km?: number | null
          invoice_number?: string | null
          invoice_url?: string | null
          invoice_value?: number | null
          last_ping_at?: string | null
          mdfe_number?: string | null
          near_notified_at?: string | null
          notes?: string | null
          origin_address: string
          origin_city?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          origin_neighborhood?: string | null
          origin_number?: string | null
          origin_state?: string | null
          origin_zip?: string | null
          pickup_dock?: string | null
          pickup_franchise_minutes?: number | null
          pickup_gate?: string | null
          pickup_instructions?: string | null
          pickup_phone_name?: string | null
          pickup_reference?: string | null
          pickup_whatsapp?: string | null
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          price?: number | null
          priority?: string
          route_geometry?: string | null
          route_highways?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          started_trip_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tracking_code?: string
          updated_at?: string
          vehicle_id?: string | null
          volumes?: number | null
        }
        Update: {
          approach_notified_at?: string | null
          arrival_detected_at?: string | null
          arrival_override_at?: string | null
          arrival_override_by?: string | null
          arrived_at?: string | null
          cargo_description?: string | null
          cargo_type?: string | null
          cargo_value?: number | null
          cargo_value_declared?: number | null
          cargo_volume_m3?: number | null
          cargo_weight_kg?: number | null
          client_id?: string | null
          client_name?: string | null
          code?: string
          completed_at?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          cte_number?: string | null
          current_city?: string | null
          current_lat?: number | null
          current_lng?: number | null
          deleted_at?: string | null
          delivery_dock?: string | null
          delivery_franchise_minutes?: number | null
          delivery_gate?: string | null
          delivery_reference?: string | null
          delivery_whatsapp?: string | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          destination_address?: string
          destination_city?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_neighborhood?: string | null
          destination_number?: string | null
          destination_state?: string | null
          destination_zip?: string | null
          distance_km?: number | null
          distance_to_destination_km?: number | null
          driver_id?: string | null
          estimated_minutes?: number | null
          estimated_tolls?: number | null
          eta_minutes?: number | null
          id?: string
          initial_distance_km?: number | null
          invoice_number?: string | null
          invoice_url?: string | null
          invoice_value?: number | null
          last_ping_at?: string | null
          mdfe_number?: string | null
          near_notified_at?: string | null
          notes?: string | null
          origin_address?: string
          origin_city?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          origin_neighborhood?: string | null
          origin_number?: string | null
          origin_state?: string | null
          origin_zip?: string | null
          pickup_dock?: string | null
          pickup_franchise_minutes?: number | null
          pickup_gate?: string | null
          pickup_instructions?: string | null
          pickup_phone_name?: string | null
          pickup_reference?: string | null
          pickup_whatsapp?: string | null
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          price?: number | null
          priority?: string
          route_geometry?: string | null
          route_highways?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          started_trip_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          tracking_code?: string
          updated_at?: string
          vehicle_id?: string | null
          volumes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          address_number: string | null
          avatar_url: string | null
          city: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          neighborhood: string | null
          phone: string | null
          state: string | null
          updated_at: string
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_number?: string | null
          avatar_url?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          neighborhood?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_number?: string | null
          avatar_url?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          neighborhood?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      route_summaries: {
        Row: {
          arrived_at: string | null
          avg_speed_kmh: number | null
          created_at: string
          driver_id: string | null
          order_id: string
          points_count: number | null
          replay_geojson: Json | null
          started_at: string | null
          stops_count: number | null
          total_distance_km: number | null
          total_minutes: number | null
        }
        Insert: {
          arrived_at?: string | null
          avg_speed_kmh?: number | null
          created_at?: string
          driver_id?: string | null
          order_id: string
          points_count?: number | null
          replay_geojson?: Json | null
          started_at?: string | null
          stops_count?: number | null
          total_distance_km?: number | null
          total_minutes?: number | null
        }
        Update: {
          arrived_at?: string | null
          avg_speed_kmh?: number | null
          created_at?: string
          driver_id?: string | null
          order_id?: string
          points_count?: number | null
          replay_geojson?: Json | null
          started_at?: string | null
          stops_count?: number | null
          total_distance_km?: number | null
          total_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "route_summaries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          address: string | null
          admission_date: string | null
          birth_date: string | null
          city: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          email: string | null
          full_name: string | null
          last_seen_at: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          rg: string | null
          state: string | null
          status: Database["public"]["Enums"]["team_status"]
          updated_at: string
          user_id: string
          whatsapp: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          admission_date?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          last_seen_at?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          rg?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["team_status"]
          updated_at?: string
          user_id: string
          whatsapp?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          admission_date?: string | null
          birth_date?: string | null
          city?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          full_name?: string | null
          last_seen_at?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          rg?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["team_status"]
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_documents: {
        Row: {
          created_at: string
          expires_at: string | null
          file_path: string
          id: string
          kind: string
          label: string | null
          mime_type: string | null
          size_bytes: number | null
          updated_at: string
          uploaded_by: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          file_path: string
          id?: string
          kind: string
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          file_path?: string
          id?: string
          kind?: string
          label?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          updated_at?: string
          uploaded_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_types: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          acquisition_date: string | null
          active: boolean
          antt_expires_at: string | null
          antt_number: string | null
          axles: number | null
          battery_level: number | null
          body_type: string | null
          brand: string | null
          capacity_kg: number | null
          capacity_m3: number | null
          category: string | null
          chassis: string | null
          color: string | null
          created_at: string
          crlv_expires_at: string | null
          current_city: string | null
          current_km: number | null
          current_lat: number | null
          current_lng: number | null
          current_speed_kmh: number | null
          current_state: string | null
          id: string
          insurance_company: string | null
          insurance_expires_at: string | null
          insurance_policy: string | null
          ipva_expires_at: string | null
          last_location_at: string | null
          licensing_expires_at: string | null
          max_weight_kg: number | null
          model: string | null
          notes: string | null
          owner_company: string | null
          owner_driver_id: string | null
          photo_url: string | null
          plate: string
          renavam: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          vehicle_type: string | null
          year: number | null
        }
        Insert: {
          acquisition_date?: string | null
          active?: boolean
          antt_expires_at?: string | null
          antt_number?: string | null
          axles?: number | null
          battery_level?: number | null
          body_type?: string | null
          brand?: string | null
          capacity_kg?: number | null
          capacity_m3?: number | null
          category?: string | null
          chassis?: string | null
          color?: string | null
          created_at?: string
          crlv_expires_at?: string | null
          current_city?: string | null
          current_km?: number | null
          current_lat?: number | null
          current_lng?: number | null
          current_speed_kmh?: number | null
          current_state?: string | null
          id?: string
          insurance_company?: string | null
          insurance_expires_at?: string | null
          insurance_policy?: string | null
          ipva_expires_at?: string | null
          last_location_at?: string | null
          licensing_expires_at?: string | null
          max_weight_kg?: number | null
          model?: string | null
          notes?: string | null
          owner_company?: string | null
          owner_driver_id?: string | null
          photo_url?: string | null
          plate: string
          renavam?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Update: {
          acquisition_date?: string | null
          active?: boolean
          antt_expires_at?: string | null
          antt_number?: string | null
          axles?: number | null
          battery_level?: number | null
          body_type?: string | null
          brand?: string | null
          capacity_kg?: number | null
          capacity_m3?: number | null
          category?: string | null
          chassis?: string | null
          color?: string | null
          created_at?: string
          crlv_expires_at?: string | null
          current_city?: string | null
          current_km?: number | null
          current_lat?: number | null
          current_lng?: number | null
          current_speed_kmh?: number | null
          current_state?: string | null
          id?: string
          insurance_company?: string | null
          insurance_expires_at?: string | null
          insurance_policy?: string | null
          ipva_expires_at?: string | null
          last_location_at?: string | null
          licensing_expires_at?: string | null
          max_weight_kg?: number | null
          model?: string | null
          notes?: string | null
          owner_company?: string | null
          owner_driver_id?: string | null
          photo_url?: string | null
          plate?: string
          renavam?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          vehicle_type?: string | null
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      order_tracking: {
        Row: {
          code: string | null
          created_at: string | null
          destination_city: string | null
          distance_km: number | null
          driver_id: string | null
          estimated_minutes: number | null
          origin_city: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          tracking_code: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          destination_city?: string | null
          distance_km?: number | null
          driver_id?: string | null
          estimated_minutes?: number | null
          origin_city?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          destination_city?: string | null
          distance_km?: number | null
          driver_id?: string | null
          estimated_minutes?: number | null
          origin_city?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tracking_code?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Functions: {
      can_access_order_chat: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      finalize_route: { Args: { _order_id: string }; Returns: undefined }
      generate_pf_code: { Args: never; Returns: string }
      generate_tracking_code: { Args: never; Returns: string }
      get_tracking: { Args: { _code: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      override_arrival: { Args: { _order_id: string }; Returns: undefined }
      review_driver_signup: {
        Args: { _decision: string; _driver_id: string; _reason?: string }
        Returns: undefined
      }
      review_driver_signup_as: {
        Args: {
          _actor: string
          _decision: string
          _driver_id: string
          _reason?: string
        }
        Returns: undefined
      }
      send_program_to_driver: {
        Args: {
          _driver_id: string
          _expires_minutes?: number
          _price: number
          _program_id: string
        }
        Returns: string
      }
      send_program_to_driver_as: {
        Args: {
          _actor: string
          _driver_id: string
          _expires_minutes?: number
          _price: number
          _program_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "logistics"
        | "driver"
        | "client"
        | "supervisor"
        | "financeiro"
        | "comercial"
        | "operacional"
      bank_account_type: "corrente" | "poupanca"
      driver_approval_status: "pending" | "active" | "correction" | "rejected"
      driver_availability:
        | "disponivel"
        | "em_frete"
        | "folga"
        | "ferias"
        | "bloqueado"
        | "offline"
      driver_financial_status: "ativo" | "bloqueado" | "pagamento_pendente"
      driver_status: "offline" | "available" | "on_trip"
      freight_cost_kind:
        | "frete"
        | "pedagio"
        | "licenca"
        | "batedor"
        | "escolta"
        | "combustivel"
        | "ajudante"
        | "estadia"
        | "diaria"
        | "outros"
      freight_payment_method: "pix" | "ted" | "transferencia" | "boleto"
      freight_payment_term: "a_vista" | "30d" | "45d" | "60d" | "90d"
      freight_program_status:
        | "draft"
        | "sent"
        | "accepted"
        | "declined"
        | "cancelled"
      message_kind: "text" | "photo" | "video" | "pdf" | "audio"
      negotiation_status: "proposed" | "accepted" | "declined" | "countered"
      offer_status:
        | "pending"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
        | "negotiating"
      order_status:
        | "planning"
        | "created"
        | "preparing"
        | "awaiting_driver"
        | "negotiating"
        | "driver_assigned"
        | "en_route_pickup"
        | "at_pickup"
        | "loaded"
        | "in_transit_to_pickup"
        | "picked_up"
        | "out_for_delivery"
        | "in_transit"
        | "near_destination"
        | "at_destination"
        | "delivered"
        | "finalized"
        | "cancelled"
        | "incident"
        | "near_pickup"
        | "arriving_pickup"
        | "loading"
        | "arriving_destination"
        | "unloading"
      payment_method_pref: "pix" | "ted" | "doc" | "boleto"
      pix_key_type: "cpf" | "cnpj" | "email" | "phone" | "random"
      team_status: "ativo" | "bloqueado" | "convite_pendente" | "afastado"
      vehicle_status:
        | "disponivel"
        | "em_coleta"
        | "em_transito"
        | "em_entrega"
        | "retornando"
        | "manutencao"
        | "bloqueado"
        | "reserva"
        | "offline"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "logistics",
        "driver",
        "client",
        "supervisor",
        "financeiro",
        "comercial",
        "operacional",
      ],
      bank_account_type: ["corrente", "poupanca"],
      driver_approval_status: ["pending", "active", "correction", "rejected"],
      driver_availability: [
        "disponivel",
        "em_frete",
        "folga",
        "ferias",
        "bloqueado",
        "offline",
      ],
      driver_financial_status: ["ativo", "bloqueado", "pagamento_pendente"],
      driver_status: ["offline", "available", "on_trip"],
      freight_cost_kind: [
        "frete",
        "pedagio",
        "licenca",
        "batedor",
        "escolta",
        "combustivel",
        "ajudante",
        "estadia",
        "diaria",
        "outros",
      ],
      freight_payment_method: ["pix", "ted", "transferencia", "boleto"],
      freight_payment_term: ["a_vista", "30d", "45d", "60d", "90d"],
      freight_program_status: [
        "draft",
        "sent",
        "accepted",
        "declined",
        "cancelled",
      ],
      message_kind: ["text", "photo", "video", "pdf", "audio"],
      negotiation_status: ["proposed", "accepted", "declined", "countered"],
      offer_status: [
        "pending",
        "accepted",
        "declined",
        "expired",
        "cancelled",
        "negotiating",
      ],
      order_status: [
        "planning",
        "created",
        "preparing",
        "awaiting_driver",
        "negotiating",
        "driver_assigned",
        "en_route_pickup",
        "at_pickup",
        "loaded",
        "in_transit_to_pickup",
        "picked_up",
        "out_for_delivery",
        "in_transit",
        "near_destination",
        "at_destination",
        "delivered",
        "finalized",
        "cancelled",
        "incident",
        "near_pickup",
        "arriving_pickup",
        "loading",
        "arriving_destination",
        "unloading",
      ],
      payment_method_pref: ["pix", "ted", "doc", "boleto"],
      pix_key_type: ["cpf", "cnpj", "email", "phone", "random"],
      team_status: ["ativo", "bloqueado", "convite_pendente", "afastado"],
      vehicle_status: [
        "disponivel",
        "em_coleta",
        "em_transito",
        "em_entrega",
        "retornando",
        "manutencao",
        "bloqueado",
        "reserva",
        "offline",
      ],
    },
  },
} as const

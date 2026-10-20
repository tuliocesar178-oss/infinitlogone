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
      antt_freight_rates: {
        Row: {
          cc: number
          ccd: number
          codigo_tipo_carga: string
          created_at: string
          eixos: number
          id: string
          tabela: string
          table_id: string
          tipo_carga: string
          updated_at: string
        }
        Insert: {
          cc?: number
          ccd: number
          codigo_tipo_carga: string
          created_at?: string
          eixos: number
          id?: string
          tabela: string
          table_id: string
          tipo_carga: string
          updated_at?: string
        }
        Update: {
          cc?: number
          ccd?: number
          codigo_tipo_carga?: string
          created_at?: string
          eixos?: number
          id?: string
          tabela?: string
          table_id?: string
          tipo_carga?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "antt_freight_rates_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "antt_rate_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      antt_rate_tables: {
        Row: {
          active: boolean
          anexo: string | null
          created_at: string
          created_by: string | null
          fonte: string | null
          id: string
          notes: string | null
          resolucao: string
          updated_at: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          active?: boolean
          anexo?: string | null
          created_at?: string
          created_by?: string | null
          fonte?: string | null
          id?: string
          notes?: string | null
          resolucao: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          active?: boolean
          anexo?: string | null
          created_at?: string
          created_by?: string | null
          fonte?: string | null
          id?: string
          notes?: string | null
          resolucao?: string
          updated_at?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
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
      chat_read_receipts: {
        Row: {
          created_at: string
          last_read_at: string
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_read_at?: string
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_read_at?: string
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_read_receipts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_read_receipts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string | null
          driver_id: string | null
          id: string
          is_operation: boolean
          last_message_at: string | null
          merged_into_room_id: string | null
          order_id: string | null
          participant_a: string | null
          participant_b: string | null
          staff_a: string | null
          staff_b: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          is_operation?: boolean
          last_message_at?: string | null
          merged_into_room_id?: string | null
          order_id?: string | null
          participant_a?: string | null
          participant_b?: string | null
          staff_a?: string | null
          staff_b?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          is_operation?: boolean
          last_message_at?: string | null
          merged_into_room_id?: string | null
          order_id?: string | null
          participant_a?: string | null
          participant_b?: string | null
          staff_a?: string | null
          staff_b?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_merged_into_room_id_fkey"
            columns: ["merged_into_room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_staff_a_fkey"
            columns: ["staff_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_rooms_staff_b_fkey"
            columns: ["staff_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      driver_payment_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          from_status:
            | Database["public"]["Enums"]["driver_payment_status"]
            | null
          id: string
          metadata: Json
          notes: string | null
          payment_id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["driver_payment_status"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["driver_payment_status"]
            | null
          id?: string
          metadata?: Json
          notes?: string | null
          payment_id: string
          reason?: string | null
          to_status?:
            | Database["public"]["Enums"]["driver_payment_status"]
            | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          from_status?:
            | Database["public"]["Enums"]["driver_payment_status"]
            | null
          id?: string
          metadata?: Json
          notes?: string | null
          payment_id?: string
          reason?: string | null
          to_status?:
            | Database["public"]["Enums"]["driver_payment_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "driver_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payments: {
        Row: {
          additions_amount: number
          approved_at: string | null
          approved_by: string | null
          bank_snapshot: Json
          created_at: string
          delivered_at: string | null
          discounts_amount: number
          driver_id: string | null
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          order_id: string
          paid_amount: number | null
          paid_at: string | null
          paid_by: string | null
          payment_account: string | null
          payment_bank: string | null
          payment_method: string | null
          pending_reason: string | null
          receipt_url: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["driver_payment_status"]
          updated_at: string
        }
        Insert: {
          additions_amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_snapshot?: Json
          created_at?: string
          delivered_at?: string | null
          discounts_amount?: number
          driver_id?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          order_id: string
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_account?: string | null
          payment_bank?: string | null
          payment_method?: string | null
          pending_reason?: string | null
          receipt_url?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["driver_payment_status"]
          updated_at?: string
        }
        Update: {
          additions_amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_snapshot?: Json
          created_at?: string
          delivered_at?: string | null
          discounts_amount?: number
          driver_id?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          order_id?: string
          paid_amount?: number | null
          paid_at?: string | null
          paid_by?: string | null
          payment_account?: string | null
          payment_bank?: string | null
          payment_method?: string | null
          pending_reason?: string | null
          receipt_url?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["driver_payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
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
      incident_files: {
        Row: {
          created_at: string
          file_path: string
          id: string
          incident_id: string
          label: string
          mime_type: string
          size_bytes: number
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          incident_id: string
          label: string
          mime_type: string
          size_bytes: number
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          incident_id?: string
          label?: string
          mime_type?: string
          size_bytes?: number
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_files_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_updates: {
        Row: {
          action: string
          actor_id: string
          actor_name: string
          created_at: string
          id: string
          incident_id: string
          internal: boolean
          message: string | null
          metadata: Json
          updated_at: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_name: string
          created_at?: string
          id?: string
          incident_id: string
          internal?: boolean
          message?: string | null
          metadata?: Json
          updated_at?: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string
          created_at?: string
          id?: string
          incident_id?: string
          internal?: boolean
          message?: string | null
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_updates_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_updates_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          affects_deadline: boolean
          alert_key: string | null
          alert_metadata: Json
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          description: string | null
          driver_eta: string | null
          id: string
          latitude: number | null
          location_captured_at: string | null
          longitude: number | null
          operational_notes: string | null
          order_id: string
          priority: string
          reported_by: string | null
          request_id: string | null
          resolved_at: string | null
          severity: string | null
          trip_stage: string | null
          type: string
          vehicle_id: string | null
          workflow_status: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          affects_deadline?: boolean
          alert_key?: string | null
          alert_metadata?: Json
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string | null
          driver_eta?: string | null
          id?: string
          latitude?: number | null
          location_captured_at?: string | null
          longitude?: number | null
          operational_notes?: string | null
          order_id: string
          priority?: string
          reported_by?: string | null
          request_id?: string | null
          resolved_at?: string | null
          severity?: string | null
          trip_stage?: string | null
          type: string
          vehicle_id?: string | null
          workflow_status?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          affects_deadline?: boolean
          alert_key?: string | null
          alert_metadata?: Json
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          description?: string | null
          driver_eta?: string | null
          id?: string
          latitude?: number | null
          location_captured_at?: string | null
          longitude?: number | null
          operational_notes?: string | null
          order_id?: string
          priority?: string
          reported_by?: string | null
          request_id?: string | null
          resolved_at?: string | null
          severity?: string | null
          trip_stage?: string | null
          type?: string
          vehicle_id?: string | null
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_url: string | null
          content: string | null
          created_at: string
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          metadata: Json | null
          order_id: string | null
          read_at: string | null
          room_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          metadata?: Json | null
          order_id?: string | null
          read_at?: string | null
          room_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          metadata?: Json | null
          order_id?: string | null
          read_at?: string | null
          room_id?: string | null
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
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
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
          push_error: string | null
          push_processed_at: string | null
          push_status: string
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
          push_error?: string | null
          push_processed_at?: string | null
          push_status?: string
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
          push_error?: string | null
          push_processed_at?: string | null
          push_status?: string
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
          event_id: string | null
          event_status: string | null
          file_path: string
          id: string
          kind: string
          label: string | null
          latitude: number | null
          longitude: number | null
          metadata: Json
          mime_type: string | null
          order_id: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_status?: string | null
          file_path: string
          id?: string
          kind: string
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          mime_type?: string | null
          order_id: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_status?: string | null
          file_path?: string
          id?: string
          kind?: string
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json
          mime_type?: string | null
          order_id?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "order_events"
            referencedColumns: ["id"]
          },
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
      order_field_changes: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          order_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_field_changes_order_id_fkey"
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
          antt_applicable: boolean | null
          antt_axles: number | null
          antt_calculated_at: string | null
          antt_cargo_class: string | null
          antt_cc: number | null
          antt_ccd: number | null
          antt_contract_type: string | null
          antt_distance_km: number | null
          antt_effective_date: string | null
          antt_high_performance: boolean
          antt_minimum_value: number | null
          antt_not_applicable_reason: string | null
          antt_rate_table_id: string | null
          antt_resolution: string | null
          antt_table: string | null
          approach_notified_at: string | null
          arrival_detected_at: string | null
          arrival_override_at: string | null
          arrival_override_by: string | null
          arrived_at: string | null
          cargo_description: string | null
          cargo_dimensions: string | null
          cargo_package_type: string | null
          cargo_product: string | null
          cargo_type: string | null
          cargo_value: number | null
          cargo_value_declared: number | null
          cargo_volume_m3: number | null
          cargo_weight_kg: number | null
          client_amount: number | null
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
          delivery_contact_name: string | null
          delivery_dock: string | null
          delivery_franchise_minutes: number | null
          delivery_gate: string | null
          delivery_instructions: string | null
          delivery_phone: string | null
          delivery_reference: string | null
          delivery_whatsapp: string | null
          delivery_window_end: string | null
          delivery_window_start: string | null
          destination_address: string
          destination_city: string | null
          destination_lat: number | null
          destination_lng: number | null
          destination_location_details: Json | null
          destination_neighborhood: string | null
          destination_number: string | null
          destination_state: string | null
          destination_zip: string | null
          distance_km: number | null
          distance_to_destination_km: number | null
          driver_amount: number | null
          driver_id: string | null
          estimated_minutes: number | null
          estimated_tolls: number | null
          eta_minutes: number | null
          fuel_cost: number | null
          helpers_count: number | null
          helpers_required: boolean
          id: string
          initial_distance_km: number | null
          invoice_number: string | null
          invoice_url: string | null
          invoice_value: number | null
          last_ping_at: string | null
          margin_amount: number | null
          mdfe_number: string | null
          near_notified_at: string | null
          notes: string | null
          offer_expires_minutes: number
          operation_type: string | null
          origin_address: string
          origin_city: string | null
          origin_lat: number | null
          origin_lng: number | null
          origin_location_details: Json | null
          origin_neighborhood: string | null
          origin_number: string | null
          origin_state: string | null
          origin_zip: string | null
          other_costs: number | null
          pickup_contact_name: string | null
          pickup_dock: string | null
          pickup_franchise_minutes: number | null
          pickup_gate: string | null
          pickup_instructions: string | null
          pickup_phone: string | null
          pickup_phone_name: string | null
          pickup_reference: string | null
          pickup_whatsapp: string | null
          pickup_window_end: string | null
          pickup_window_start: string | null
          price: number | null
          priority: string
          published_at: string | null
          purchase_order: string | null
          recorded_distance_km: number | null
          required_axles: number | null
          required_body_type: string | null
          required_capacity_kg: number | null
          required_vehicle_type: string | null
          route_geometry: string | null
          route_highways: string | null
          scheduled_at: string | null
          special_requirements: string | null
          started_at: string | null
          started_trip_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          suggested_value: number | null
          tracking_code: string
          tracking_required: boolean
          updated_at: string
          vehicle_id: string | null
          volumes: number | null
          work_id: string | null
        }
        Insert: {
          antt_applicable?: boolean | null
          antt_axles?: number | null
          antt_calculated_at?: string | null
          antt_cargo_class?: string | null
          antt_cc?: number | null
          antt_ccd?: number | null
          antt_contract_type?: string | null
          antt_distance_km?: number | null
          antt_effective_date?: string | null
          antt_high_performance?: boolean
          antt_minimum_value?: number | null
          antt_not_applicable_reason?: string | null
          antt_rate_table_id?: string | null
          antt_resolution?: string | null
          antt_table?: string | null
          approach_notified_at?: string | null
          arrival_detected_at?: string | null
          arrival_override_at?: string | null
          arrival_override_by?: string | null
          arrived_at?: string | null
          cargo_description?: string | null
          cargo_dimensions?: string | null
          cargo_package_type?: string | null
          cargo_product?: string | null
          cargo_type?: string | null
          cargo_value?: number | null
          cargo_value_declared?: number | null
          cargo_volume_m3?: number | null
          cargo_weight_kg?: number | null
          client_amount?: number | null
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
          delivery_contact_name?: string | null
          delivery_dock?: string | null
          delivery_franchise_minutes?: number | null
          delivery_gate?: string | null
          delivery_instructions?: string | null
          delivery_phone?: string | null
          delivery_reference?: string | null
          delivery_whatsapp?: string | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          destination_address: string
          destination_city?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_location_details?: Json | null
          destination_neighborhood?: string | null
          destination_number?: string | null
          destination_state?: string | null
          destination_zip?: string | null
          distance_km?: number | null
          distance_to_destination_km?: number | null
          driver_amount?: number | null
          driver_id?: string | null
          estimated_minutes?: number | null
          estimated_tolls?: number | null
          eta_minutes?: number | null
          fuel_cost?: number | null
          helpers_count?: number | null
          helpers_required?: boolean
          id?: string
          initial_distance_km?: number | null
          invoice_number?: string | null
          invoice_url?: string | null
          invoice_value?: number | null
          last_ping_at?: string | null
          margin_amount?: number | null
          mdfe_number?: string | null
          near_notified_at?: string | null
          notes?: string | null
          offer_expires_minutes?: number
          operation_type?: string | null
          origin_address: string
          origin_city?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          origin_location_details?: Json | null
          origin_neighborhood?: string | null
          origin_number?: string | null
          origin_state?: string | null
          origin_zip?: string | null
          other_costs?: number | null
          pickup_contact_name?: string | null
          pickup_dock?: string | null
          pickup_franchise_minutes?: number | null
          pickup_gate?: string | null
          pickup_instructions?: string | null
          pickup_phone?: string | null
          pickup_phone_name?: string | null
          pickup_reference?: string | null
          pickup_whatsapp?: string | null
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          price?: number | null
          priority?: string
          published_at?: string | null
          purchase_order?: string | null
          recorded_distance_km?: number | null
          required_axles?: number | null
          required_body_type?: string | null
          required_capacity_kg?: number | null
          required_vehicle_type?: string | null
          route_geometry?: string | null
          route_highways?: string | null
          scheduled_at?: string | null
          special_requirements?: string | null
          started_at?: string | null
          started_trip_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          suggested_value?: number | null
          tracking_code?: string
          tracking_required?: boolean
          updated_at?: string
          vehicle_id?: string | null
          volumes?: number | null
          work_id?: string | null
        }
        Update: {
          antt_applicable?: boolean | null
          antt_axles?: number | null
          antt_calculated_at?: string | null
          antt_cargo_class?: string | null
          antt_cc?: number | null
          antt_ccd?: number | null
          antt_contract_type?: string | null
          antt_distance_km?: number | null
          antt_effective_date?: string | null
          antt_high_performance?: boolean
          antt_minimum_value?: number | null
          antt_not_applicable_reason?: string | null
          antt_rate_table_id?: string | null
          antt_resolution?: string | null
          antt_table?: string | null
          approach_notified_at?: string | null
          arrival_detected_at?: string | null
          arrival_override_at?: string | null
          arrival_override_by?: string | null
          arrived_at?: string | null
          cargo_description?: string | null
          cargo_dimensions?: string | null
          cargo_package_type?: string | null
          cargo_product?: string | null
          cargo_type?: string | null
          cargo_value?: number | null
          cargo_value_declared?: number | null
          cargo_volume_m3?: number | null
          cargo_weight_kg?: number | null
          client_amount?: number | null
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
          delivery_contact_name?: string | null
          delivery_dock?: string | null
          delivery_franchise_minutes?: number | null
          delivery_gate?: string | null
          delivery_instructions?: string | null
          delivery_phone?: string | null
          delivery_reference?: string | null
          delivery_whatsapp?: string | null
          delivery_window_end?: string | null
          delivery_window_start?: string | null
          destination_address?: string
          destination_city?: string | null
          destination_lat?: number | null
          destination_lng?: number | null
          destination_location_details?: Json | null
          destination_neighborhood?: string | null
          destination_number?: string | null
          destination_state?: string | null
          destination_zip?: string | null
          distance_km?: number | null
          distance_to_destination_km?: number | null
          driver_amount?: number | null
          driver_id?: string | null
          estimated_minutes?: number | null
          estimated_tolls?: number | null
          eta_minutes?: number | null
          fuel_cost?: number | null
          helpers_count?: number | null
          helpers_required?: boolean
          id?: string
          initial_distance_km?: number | null
          invoice_number?: string | null
          invoice_url?: string | null
          invoice_value?: number | null
          last_ping_at?: string | null
          margin_amount?: number | null
          mdfe_number?: string | null
          near_notified_at?: string | null
          notes?: string | null
          offer_expires_minutes?: number
          operation_type?: string | null
          origin_address?: string
          origin_city?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          origin_location_details?: Json | null
          origin_neighborhood?: string | null
          origin_number?: string | null
          origin_state?: string | null
          origin_zip?: string | null
          other_costs?: number | null
          pickup_contact_name?: string | null
          pickup_dock?: string | null
          pickup_franchise_minutes?: number | null
          pickup_gate?: string | null
          pickup_instructions?: string | null
          pickup_phone?: string | null
          pickup_phone_name?: string | null
          pickup_reference?: string | null
          pickup_whatsapp?: string | null
          pickup_window_end?: string | null
          pickup_window_start?: string | null
          price?: number | null
          priority?: string
          published_at?: string | null
          purchase_order?: string | null
          recorded_distance_km?: number | null
          required_axles?: number | null
          required_body_type?: string | null
          required_capacity_kg?: number | null
          required_vehicle_type?: string | null
          route_geometry?: string | null
          route_highways?: string | null
          scheduled_at?: string | null
          special_requirements?: string | null
          started_at?: string | null
          started_trip_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          suggested_value?: number | null
          tracking_code?: string
          tracking_required?: boolean
          updated_at?: string
          vehicle_id?: string | null
          volumes?: number | null
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_antt_rate_table_id_fkey"
            columns: ["antt_rate_table_id"]
            isOneToOne: false
            referencedRelation: "antt_rate_tables"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "orders_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
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
      push_deliveries: {
        Row: {
          attempts: number
          created_at: string
          deleted_at: string | null
          id: string
          notification_id: string
          provider_status: number | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          notification_id: string
          provider_status?: number | null
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          notification_id?: string
          provider_status?: number | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          preferences: Json
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
          preferences?: Json
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
          preferences?: Json
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_transport_config: {
        Row: {
          bearer: string
          created_at: string
          deleted_at: string | null
          endpoint: string
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          bearer: string
          created_at?: string
          deleted_at?: string | null
          endpoint: string
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          bearer?: string
          created_at?: string
          deleted_at?: string | null
          endpoint?: string
          id?: string
          key?: string
          updated_at?: string
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
      voice_calls: {
        Row: {
          caller_id: string | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          receiver_id: string | null
          room_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["call_status"] | null
        }
        Insert: {
          caller_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receiver_id?: string | null
          room_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"] | null
        }
        Update: {
          caller_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          receiver_id?: string | null
          room_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["call_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_calls_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          address: string | null
          allow_new_freights: boolean
          city: string | null
          client_id: string
          code: string | null
          complement: string | null
          created_at: string
          description: string | null
          expected_end_date: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          responsible_email: string | null
          responsible_name: string | null
          responsible_phone: string | null
          responsible_whatsapp: string | null
          start_date: string | null
          state: string | null
          status: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          allow_new_freights?: boolean
          city?: string | null
          client_id: string
          code?: string | null
          complement?: string | null
          created_at?: string
          description?: string | null
          expected_end_date?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          responsible_email?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          responsible_whatsapp?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          allow_new_freights?: boolean
          city?: string | null
          client_id?: string
          code?: string | null
          complement?: string | null
          created_at?: string
          description?: string | null
          expected_end_date?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          responsible_email?: string | null
          responsible_name?: string | null
          responsible_phone?: string | null
          responsible_whatsapp?: string | null
          start_date?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "works_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["user_id"]
          },
        ]
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
      accept_freight_offer: {
        Args: { _lat?: number; _lng?: number; _offer_id: string }
        Returns: Json
      }
      can_access_direct_room: {
        Args: { _room_id: string; _user: string }
        Returns: boolean
      }
      can_access_incident: {
        Args: { _incident: string; _user: string }
        Returns: boolean
      }
      can_access_order_chat: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_staff_room: {
        Args: { _room_id: string; _user: string }
        Returns: boolean
      }
      can_access_unified_chat: {
        Args: { _room: string; _user: string }
        Returns: boolean
      }
      can_manage_operation_board: { Args: { _user: string }; Returns: boolean }
      claim_push_delivery: {
        Args: { _notification: string; _subscription: string }
        Returns: string
      }
      create_driver_incident: { Args: { _data: Json }; Returns: string }
      decline_freight_offer: {
        Args: { _offer_id: string; _reason?: string }
        Returns: Json
      }
      default_incident_categories: { Args: never; Returns: Json }
      finalize_route: { Args: { _order_id: string }; Returns: undefined }
      generate_pf_code: { Args: never; Returns: string }
      generate_tracking_code: { Args: never; Returns: string }
      get_chat_room_team_members: {
        Args: { _room_ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          latest_message_at: string
          room_id: string
        }[]
      }
      get_incident_categories: { Args: never; Returns: Json }
      get_or_create_driver_room: {
        Args: { _driver_id: string }
        Returns: string
      }
      get_or_create_individual_chat: {
        Args: { _other: string }
        Returns: string
      }
      get_or_create_operation_room: { Args: never; Returns: string }
      get_or_create_staff_room: { Args: { _other_id: string }; Returns: string }
      get_public_home_design: { Args: never; Returns: Json }
      get_tracking: { Args: { _code: string }; Returns: Json }
      get_unified_chat_directory: { Args: never; Returns: Json }
      get_unified_chat_messages: { Args: { _room: string }; Returns: Json }
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
      is_finance: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      link_incident_file: {
        Args: {
          _incident: string
          _label: string
          _mime: string
          _path: string
          _size: number
        }
        Returns: undefined
      }
      manage_driver_incident: {
        Args: {
          _action: string
          _assigned_to?: string
          _id: string
          _internal?: boolean
          _message?: string
          _priority?: string
          _status?: string
        }
        Returns: undefined
      }
      manage_operation_board_incident: {
        Args: {
          _action: string
          _assigned_to?: string
          _id: string
          _notes?: string
        }
        Returns: undefined
      }
      mark_unified_chat_read: { Args: { _room: string }; Returns: undefined }
      override_arrival: { Args: { _order_id: string }; Returns: undefined }
      respond_freight_counteroffer: {
        Args: { _decision: string; _negotiation_id: string }
        Returns: Json
      }
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
      save_incident_categories: {
        Args: { _categories: Json }
        Returns: undefined
      }
      save_public_home_design: { Args: { _design: string }; Returns: Json }
      search_unified_chat: { Args: { _term: string }; Returns: Json }
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
      send_unified_chat_message: {
        Args: {
          _content: string
          _kind?: Database["public"]["Enums"]["message_kind"]
          _metadata?: Json
          _order?: string
          _room: string
        }
        Returns: string
      }
      submit_freight_counteroffer: {
        Args: { _amount: number; _note?: string; _offer_id: string }
        Returns: Json
      }
      sync_operation_board_alerts: {
        Args: { _alerts: Json }
        Returns: undefined
      }
      valid_unified_chat_context: {
        Args: { _order: string; _room: string; _user: string }
        Returns: boolean
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
      call_status:
        | "dialing"
        | "ringing"
        | "connected"
        | "ended"
        | "missed"
        | "rejected"
      driver_approval_status: "pending" | "active" | "correction" | "rejected"
      driver_availability:
        | "disponivel"
        | "em_frete"
        | "folga"
        | "ferias"
        | "bloqueado"
        | "offline"
      driver_financial_status: "ativo" | "bloqueado" | "pagamento_pendente"
      driver_payment_status:
        | "aguardando_analise"
        | "em_conferencia"
        | "pendencia"
        | "aprovado"
        | "agendado"
        | "pago"
        | "cancelado"
        | "devolvido"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      call_status: [
        "dialing",
        "ringing",
        "connected",
        "ended",
        "missed",
        "rejected",
      ],
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
      driver_payment_status: [
        "aguardando_analise",
        "em_conferencia",
        "pendencia",
        "aprovado",
        "agendado",
        "pago",
        "cancelado",
        "devolvido",
      ],
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

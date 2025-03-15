export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      driver_locations: {
        Row: {
          driver_id: string
          heading: number | null
          id: string
          is_available: boolean | null
          latitude: number
          longitude: number
          timestamp: string
        }
        Insert: {
          driver_id: string
          heading?: number | null
          id?: string
          is_available?: boolean | null
          latitude: number
          longitude: number
          timestamp?: string
        }
        Update: {
          driver_id?: string
          heading?: number | null
          id?: string
          is_available?: boolean | null
          latitude?: number
          longitude?: number
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          driver_rating: number | null
          id: string
          is_active: boolean | null
          license_number: string | null
          updated_at: string
          user_id: string
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_year: number | null
        }
        Insert: {
          created_at?: string
          driver_rating?: number | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          updated_at?: string
          user_id: string
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_year?: number | null
        }
        Update: {
          created_at?: string
          driver_rating?: number | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          updated_at?: string
          user_id?: string
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method: string | null
          payment_status: string | null
          ride_id: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method?: string | null
          payment_status?: string | null
          ride_id: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string | null
          payment_status?: string | null
          ride_id?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_requests: {
        Row: {
          accepted_at: string | null
          actual_fare: number | null
          completed_at: string | null
          created_at: string
          destination_address: string | null
          destination_latitude: number
          destination_longitude: number
          driver_id: string | null
          estimated_fare: number | null
          id: string
          pickup_address: string | null
          pickup_latitude: number
          pickup_longitude: number
          rider_id: string
          status: Database["public"]["Enums"]["ride_status"] | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          actual_fare?: number | null
          completed_at?: string | null
          created_at?: string
          destination_address?: string | null
          destination_latitude: number
          destination_longitude: number
          driver_id?: string | null
          estimated_fare?: number | null
          id?: string
          pickup_address?: string | null
          pickup_latitude: number
          pickup_longitude: number
          rider_id: string
          status?: Database["public"]["Enums"]["ride_status"] | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          actual_fare?: number | null
          completed_at?: string | null
          created_at?: string
          destination_address?: string | null
          destination_latitude?: number
          destination_longitude?: number
          driver_id?: string | null
          estimated_fare?: number | null
          id?: string
          pickup_address?: string | null
          pickup_latitude?: number
          pickup_longitude?: number
          rider_id?: string
          status?: Database["public"]["Enums"]["ride_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_requests_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      surge_predictions: {
        Row: {
          area_name: string | null
          demand_level: number | null
          id: string
          latitude: number
          longitude: number
          predicted_at: string
          surge_multiplier: number
          valid_until: string
        }
        Insert: {
          area_name?: string | null
          demand_level?: number | null
          id?: string
          latitude: number
          longitude: number
          predicted_at?: string
          surge_multiplier: number
          valid_until: string
        }
        Update: {
          area_name?: string | null
          demand_level?: number | null
          id?: string
          latitude?: number
          longitude?: number
          predicted_at?: string
          surge_multiplier?: number
          valid_until?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_driver: boolean | null
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_driver?: boolean | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_driver?: boolean | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_distance: {
        Args: {
          lat1: number
          lon1: number
          lat2: number
          lon2: number
        }
        Returns: number
      }
    }
    Enums: {
      ride_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 
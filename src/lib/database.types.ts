export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id: string | null
          changed_columns: string[]
          circle_id: string | null
          entity_id: string
          entity_table: string
          id: number
          occurred_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          changed_columns?: string[]
          circle_id?: string | null
          entity_id: string
          entity_table: string
          id?: never
          occurred_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          changed_columns?: string[]
          circle_id?: string | null
          entity_id?: string
          entity_table?: string
          id?: never
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          invitation_state: Database["public"]["Enums"]["membership_state"]
          revision: number
          role: Database["public"]["Enums"]["circle_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invitation_state?: Database["public"]["Enums"]["membership_state"]
          revision?: number
          role?: Database["public"]["Enums"]["circle_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invitation_state?: Database["public"]["Enums"]["membership_state"]
          revision?: number
          role?: Database["public"]["Enums"]["circle_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          care_recipient_name: string
          created_at: string
          created_by: string | null
          default_currency: string
          deleted_at: string | null
          id: string
          revision: number
          timezone: string
          updated_at: string
        }
        Insert: {
          care_recipient_name: string
          created_at?: string
          created_by?: string | null
          default_currency?: string
          deleted_at?: string | null
          id?: string
          revision?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          care_recipient_name?: string
          created_at?: string
          created_by?: string | null
          default_currency?: string
          deleted_at?: string | null
          id?: string
          revision?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          circle_id: string | null
          created_at: string
          granted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["consent_kind"]
          policy_version: string
          revoked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          circle_id?: string | null
          created_at?: string
          granted_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["consent_kind"]
          policy_version: string
          revoked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          circle_id?: string | null
          created_at?: string
          granted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["consent_kind"]
          policy_version?: string
          revoked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_digests: {
        Row: {
          circle_id: string
          completed_task_count: number
          created_at: string
          digest_local_date: string
          id: string
          note_count: number
          pending_task_count: number
          skipped_task_count: number
          summary_text: string | null
          tomorrow_task_count: number
        }
        Insert: {
          circle_id: string
          completed_task_count?: number
          created_at?: string
          digest_local_date: string
          id?: string
          note_count?: number
          pending_task_count?: number
          skipped_task_count?: number
          summary_text?: string | null
          tomorrow_task_count?: number
        }
        Update: {
          circle_id?: string
          completed_task_count?: number
          created_at?: string
          digest_local_date?: string
          id?: string
          note_count?: number
          pending_task_count?: number
          skipped_task_count?: number
          summary_text?: string | null
          tomorrow_task_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_digests_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_push_tokens: {
        Row: {
          created_at: string
          disabled_at: string | null
          id: string
          last_seen_at: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disabled_at?: string | null
          id?: string
          last_seen_at?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disabled_at?: string | null
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          byte_size: number
          circle_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          mime_type: string
          object_path: string
          original_filename: string
          revision: number
          title: string | null
          updated_at: string
        }
        Insert: {
          byte_size: number
          circle_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          mime_type: string
          object_path: string
          original_filename: string
          revision?: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          byte_size?: number
          circle_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          mime_type?: string
          object_path?: string
          original_filename?: string
          revision?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          circle_id: string
          created_at: string
          expense_id: string
          id: string
          member_user_id: string
          share_minor: number
        }
        Insert: {
          circle_id: string
          created_at?: string
          expense_id: string
          id?: string
          member_user_id: string
          share_minor: number
        }
        Update: {
          circle_id?: string
          created_at?: string
          expense_id?: string
          id?: string
          member_user_id?: string
          share_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_minor: number
          category: string
          circle_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          id: string
          paid_by: string
          receipt_document_id: string | null
          revision: number
          spent_on: string
          split_method: Database["public"]["Enums"]["split_method"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          category: string
          circle_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          paid_by: string
          receipt_document_id?: string | null
          revision?: number
          spent_on: string
          split_method?: Database["public"]["Enums"]["split_method"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          category?: string
          circle_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          paid_by?: string
          receipt_document_id?: string | null
          revision?: number
          spent_on?: string
          split_method?: Database["public"]["Enums"]["split_method"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_receipt_document_id_fkey"
            columns: ["receipt_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          body: string | null
          circle_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          record_type: string
          recorded_on: string | null
          revision: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          circle_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          record_type: string
          recorded_on?: string | null
          revision?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          circle_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          record_type?: string
          recorded_on?: string | null
          revision?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["circle_role"]
          token_hash: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          role?: Database["public"]["Enums"]["circle_role"]
          token_hash: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["circle_role"]
          token_hash?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dosage: string | null
          ended_on: string | null
          frequency_text: string | null
          id: string
          name: string
          notes: string | null
          prescribed_by: string | null
          revision: number
          started_on: string | null
          updated_at: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dosage?: string | null
          ended_on?: string | null
          frequency_text?: string | null
          id?: string
          name: string
          notes?: string | null
          prescribed_by?: string | null
          revision?: number
          started_on?: string | null
          updated_at?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dosage?: string | null
          ended_on?: string | null
          frequency_text?: string | null
          id?: string
          name?: string
          notes?: string | null
          prescribed_by?: string | null
          revision?: number
          started_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_object_path: string | null
          created_at: string
          display_name: string
          id: string
          locale: string
          revision: number
          updated_at: string
        }
        Insert: {
          avatar_object_path?: string | null
          created_at?: string
          display_name: string
          id: string
          locale?: string
          revision?: number
          updated_at?: string
        }
        Update: {
          avatar_object_path?: string | null
          created_at?: string
          display_name?: string
          id?: string
          locale?: string
          revision?: number
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_buckets: {
        Row: {
          attempt_count: number
          scope_key: string
          scope_kind: string
          window_started_at: string
        }
        Insert: {
          attempt_count?: number
          scope_key: string
          scope_kind: string
          window_started_at?: string
        }
        Update: {
          attempt_count?: number
          scope_key?: string
          scope_kind?: string
          window_started_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount_minor: number
          circle_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          from_user_id: string
          id: string
          note: string | null
          revision: number
          settled_on: string
          to_user_id: string
          updated_at: string
        }
        Insert: {
          amount_minor: number
          circle_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          deleted_at?: string | null
          from_user_id: string
          id?: string
          note?: string | null
          revision?: number
          settled_on: string
          to_user_id: string
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          circle_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          from_user_id?: string
          id?: string
          note?: string | null
          revision?: number
          settled_on?: string
          to_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_tombstones: {
        Row: {
          circle_id: string
          deleted_at: string
          entity_id: string
          entity_table: string
          id: number
        }
        Insert: {
          circle_id: string
          deleted_at?: string
          entity_id: string
          entity_table: string
          id?: never
        }
        Update: {
          circle_id?: string
          deleted_at?: string
          entity_id?: string
          entity_table?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "sync_tombstones_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          circle_id: string
          completed_at: string
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["completion_kind"]
          mutation_id: string
          note: string | null
          occurrence_id: string
          task_id: string
          voids_completion_id: string | null
        }
        Insert: {
          circle_id: string
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["completion_kind"]
          mutation_id: string
          note?: string | null
          occurrence_id: string
          task_id: string
          voids_completion_id?: string | null
        }
        Update: {
          circle_id?: string
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["completion_kind"]
          mutation_id?: string
          note?: string | null
          occurrence_id?: string
          task_id?: string
          voids_completion_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_voids_completion_id_fkey"
            columns: ["voids_completion_id"]
            isOneToOne: false
            referencedRelation: "task_completions"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          circle_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dtstart_local_date: string
          dtstart_local_time: string
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          notes: string | null
          recurrence_until_local_date: string | null
          revision: number
          rrule: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          circle_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dtstart_local_date: string
          dtstart_local_time: string
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          notes?: string | null
          recurrence_until_local_date?: string | null
          revision?: number
          rrule?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          circle_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dtstart_local_date?: string
          dtstart_local_time?: string
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          notes?: string | null
          recurrence_until_local_date?: string | null
          revision?: number
          rrule?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_circle_invitation: {
        Args: { invitation_token_hash: string }
        Returns: string
      }
      can_write_circle: { Args: { target_circle_id: string }; Returns: boolean }
      circle_role_of: {
        Args: { target_circle_id: string }
        Returns: Database["public"]["Enums"]["circle_role"]
      }
      create_circle_invitation: {
        Args: {
          invitation_token_hash: string
          invited_role?: Database["public"]["Enums"]["circle_role"]
          target_circle_id: string
          ttl_days?: number
        }
        Returns: string
      }
      create_circle_with_owner: {
        Args: {
          care_recipient_name: string
          circle_currency?: string
          circle_timezone?: string
        }
        Returns: string
      }
      enforce_rate_limit: {
        Args: {
          max_attempts: number
          target_scope_key: string
          target_scope_kind: string
          window_seconds: number
        }
        Returns: undefined
      }
      expense_split_is_balanced: {
        Args: { target_expense_id: string }
        Returns: boolean
      }
      has_active_consent: {
        Args: {
          target_circle_id?: string
          target_kind: Database["public"]["Enums"]["consent_kind"]
        }
        Returns: boolean
      }
      is_circle_member: { Args: { target_circle_id: string }; Returns: boolean }
      is_circle_owner: { Args: { target_circle_id: string }; Returns: boolean }
      is_valid_timezone: { Args: { tz: string }; Returns: boolean }
      purge_expired_daily_digests: {
        Args: { retention_days?: number }
        Returns: number
      }
      storage_path_circle_id: { Args: { object_name: string }; Returns: string }
    }
    Enums: {
      audit_action: "insert" | "update" | "delete"
      circle_role: "owner" | "caregiver" | "viewer"
      completion_kind: "done" | "skipped" | "void"
      consent_kind:
        | "health_data_processing"
        | "external_ai_processing"
        | "audio_recording"
        | "push_notifications"
      membership_state: "invited" | "active" | "removed"
      split_method: "equal" | "percentage" | "fixed"
      task_kind: "medication" | "appointment" | "visit" | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
          versioning_status: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          archived_at: string | null
          bucket_id: string | null
          created_at: string | null
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_action: ["insert", "update", "delete"],
      circle_role: ["owner", "caregiver", "viewer"],
      completion_kind: ["done", "skipped", "void"],
      consent_kind: [
        "health_data_processing",
        "external_ai_processing",
        "audio_recording",
        "push_notifications",
      ],
      membership_state: ["invited", "active", "removed"],
      split_method: ["equal", "percentage", "fixed"],
      task_kind: ["medication", "appointment", "visit", "other"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const


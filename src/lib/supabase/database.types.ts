
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "couple_invites": {
                  Row: {
                    "couple_id": string,"created_at": string,"created_by": string | null,"expires_at": string,"id": string,"revoked_at": string | null,"token_hash": string,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"created_by"?: string | null,"expires_at": string,"id"?: string,"revoked_at"?: string | null,"token_hash": string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"token_hash"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "couple_invites_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    }
                  ]
                },"couple_members": {
                  Row: {
                    "couple_id": string,"joined_at": string,"left_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"joined_at"?: string,"left_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "couple_id"?: string,"joined_at"?: string,"left_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "couple_members_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    }
                  ]
                },"couples": {
                  Row: {
                    "anniversary_on": string | null,"created_at": string,"created_by": string | null,"dissolved_at": string | null,"id": string,"name": string | null,"purge_after": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anniversary_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"dissolved_at"?: string | null,"id"?: string,"name"?: string | null,"purge_after"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "anniversary_on"?: string | null,"created_at"?: string,"created_by"?: string | null,"dissolved_at"?: string | null,"id"?: string,"name"?: string | null,"purge_after"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"memories": {
                  Row: {
                    "author_id": string,"body": string,"couple_id": string,"created_at": string,"happened_on": string,"id": string,"share_status": string,"shared_at": string | null,"tags": (string)[],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body"?: string,"couple_id": string,"created_at"?: string,"happened_on": string,"id"?: string,"share_status"?: string,"shared_at"?: string | null,"tags"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"couple_id"?: string,"created_at"?: string,"happened_on"?: string,"id"?: string,"share_status"?: string,"shared_at"?: string | null,"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memories_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    }
                  ]
                },"memory_places": {
                  Row: {
                    "accuracy_m": number | null,"address": string | null,"couple_id": string,"created_at": string,"id": string,"lat": number,"lng": number,"location_source": string,"memory_id": string,"name": string,"seq": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_m"?: number | null,"address"?: string | null,"couple_id": string,"created_at"?: string,"id"?: string,"lat": number,"lng": number,"location_source": string,"memory_id": string,"name": string,"seq": number
                  }
                  Update: {
                    "accuracy_m"?: number | null,"address"?: string | null,"couple_id"?: string,"created_at"?: string,"id"?: string,"lat"?: number,"lng"?: number,"location_source"?: string,"memory_id"?: string,"name"?: string,"seq"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "memory_places_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memory_places_memory_id_fkey"
      columns: ["memory_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id"]
    }
                  ]
                },"photos": {
                  Row: {
                    "accuracy_m": number | null,"bytes": number,"couple_id": string,"created_at": string,"height": number,"id": string,"lat": number | null,"lng": number | null,"location_source": string | null,"memory_id": string | null,"storage_path": string,"taken_at": string | null,"taken_at_source": string | null,"thumb_path": string,"uploader_id": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_m"?: number | null,"bytes": number,"couple_id": string,"created_at"?: string,"height": number,"id"?: string,"lat"?: number | null,"lng"?: number | null,"location_source"?: string | null,"memory_id"?: string | null,"storage_path": string,"taken_at"?: string | null,"taken_at_source"?: string | null,"thumb_path": string,"uploader_id": string,"width": number
                  }
                  Update: {
                    "accuracy_m"?: number | null,"bytes"?: number,"couple_id"?: string,"created_at"?: string,"height"?: number,"id"?: string,"lat"?: number | null,"lng"?: number | null,"location_source"?: string | null,"memory_id"?: string | null,"storage_path"?: string,"taken_at"?: string | null,"taken_at_source"?: string | null,"thumb_path"?: string,"uploader_id"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "photos_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "photos_memory_id_fkey"
      columns: ["memory_id"]
isOneToOne: false
      referencedRelation: "memories"
      referencedColumns: ["id"]
    }
                  ]
                },"post_bookmarks": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_bookmarks_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "public_posts"
      referencedColumns: ["id"]
    }
                  ]
                },"post_likes": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_likes_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "public_posts"
      referencedColumns: ["id"]
    }
                  ]
                },"post_reports": {
                  Row: {
                    "created_at": string,"detail": string | null,"id": string,"post_id": string,"reason": string,"reporter_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"detail"?: string | null,"id"?: string,"post_id": string,"reason": string,"reporter_id": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"detail"?: string | null,"id"?: string,"post_id"?: string,"reason"?: string,"reporter_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_reports_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "public_posts"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"created_at": string,"display_name": string,"id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name": string,"id": string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"public_post_images": {
                  Row: {
                    "height": number,"id": string,"post_id": string,"seq": number,"storage_path": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "height": number,"id"?: string,"post_id": string,"seq": number,"storage_path": string,"width": number
                  }
                  Update: {
                    "height"?: number,"id"?: string,"post_id"?: string,"seq"?: number,"storage_path"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "public_post_images_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "public_posts"
      referencedColumns: ["id"]
    }
                  ]
                },"public_post_places": {
                  Row: {
                    "id": string,"lat": number,"lng": number,"name": string,"post_id": string,"seq": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"lat": number,"lng": number,"name": string,"post_id": string,"seq": number
                  }
                  Update: {
                    "id"?: string,"lat"?: number,"lng"?: number,"name"?: string,"post_id"?: string,"seq"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "public_post_places_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "public_posts"
      referencedColumns: ["id"]
    }
                  ]
                },"public_posts": {
                  Row: {
                    "area": string | null,"author_id": string,"body": string,"bookmark_count": number,"created_at": string,"id": string,"kind": string,"like_count": number,"status": string,"tags": (string)[],"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string | null,"author_id": string,"body"?: string,"bookmark_count"?: number,"created_at"?: string,"id"?: string,"kind": string,"like_count"?: number,"status"?: string,"tags"?: (string)[],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "area"?: string | null,"author_id"?: string,"body"?: string,"bookmark_count"?: number,"created_at"?: string,"id"?: string,"kind"?: string,"like_count"?: number,"status"?: string,"tags"?: (string)[],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"admin_report_queue":
{ Args: Record<PropertyKey, never>; Returns: {
              "area": string,"body": string,"created_at": string,"details": (string)[],"kind": string,"last_reported_at": string,"open_reports": number,"post_id": string,"reasons": (string)[],"status": string,"title": string
            }[]
                           },
"claim_storage_deletions":
{ Args: { "p_limit"?: number }; Returns: {
              "bucket_id": string,"id": number,"path": string
            }[]
                           },
"complete_storage_deletions":
{ Args: { "p_ids": (number)[] }; Returns: number
                           },
"create_couple":
{ Args: { "p_anniversary_on"?: string,"p_name"?: string }; Returns: string
                           },
"create_invite":
{ Args: Record<PropertyKey, never>; Returns: {
              "expires_at": string,"token": string
            }[]
                           },
"get_invite_preview":
{ Args: { "p_token": string }; Returns: {
              "couple_name": string,"expires_at": string,"inviter_name": string,"status": string
            }[]
                           },
"leave_couple":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"moderate_post":
{ Args: { "p_decision": string,"p_note"?: string,"p_post_id": string }; Returns: undefined
                           },
"move_memory_place":
{ Args: { "p_direction": number,"p_place_id": string }; Returns: boolean
                           },
"my_memory_tags":
{ Args: Record<PropertyKey, never>; Returns: {
              "tag": string,"uses": number
            }[]
                           },
"revoke_invite":
{ Args: { "p_invite_id": string }; Returns: undefined
                           },
"search_memories":
{ Args: { "p_from"?: string,"p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_scope"?: string,"p_tag"?: string,"p_to"?: string }; Returns: {
              "author_id": string,
"body": string,
"couple_id": string,
"created_at": string,
"happened_on": string,
"id": string,
"share_status": string,
"shared_at": string | null,
"tags": (string)[],
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "memories"
        isOneToOne: false
        isSetofReturn: true
      } },
"search_public_posts":
{ Args: { "p_kind"?: string,"p_limit"?: number,"p_offset"?: number,"p_query"?: string,"p_tag"?: string }; Returns: {
              "area": string | null,
"author_id": string,
"body": string,
"bookmark_count": number,
"created_at": string,
"id": string,
"kind": string,
"like_count": number,
"status": string,
"tags": (string)[],
"title": string,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "public_posts"
        isOneToOne: false
        isSetofReturn: true
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const

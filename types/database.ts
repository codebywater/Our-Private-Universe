/**
 * Типы схемы БД (соответствуют supabase/migrations).
 * После изменения миграций можно перегенерировать:
 *   npx supabase gen types typescript --project-id <ref> > types/database.ts
 */

export type LetterStatus = "draft" | "sent";

type AllowedUserRow = {
  user_id: string;
  display_name: string;
  created_at: string;
};

type MemoryRow = {
  id: string;
  title: string;
  caption: string | null;
  memory_date: string;
  image_path: string;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  category: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type TimelineEventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  image_path: string | null;
  thumb_path: string | null;
  location: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type LetterRow = {
  id: string;
  title: string;
  body: string;
  sender_id: string;
  recipient_id: string;
  status: LetterStatus;
  open_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  created_at: string;
  updated_at: string;
};

type SealedLetterRow = {
  id: string;
  sender_id: string;
  open_at: string;
  sent_at: string;
};

export type Database = {
  public: {
    Tables: {
      allowed_users: {
        Row: AllowedUserRow;
        // Клиентский API не может писать в allowlist (нет политик и прав).
        Insert: never;
        Update: never;
        Relationships: [];
      };
      memories: {
        Row: MemoryRow;
        Insert: {
          id?: string;
          title: string;
          caption?: string | null;
          memory_date: string;
          image_path: string;
          thumb_path?: string | null;
          width?: number | null;
          height?: number | null;
          category?: string;
          created_by: string;
        };
        Update: {
          title?: string;
          caption?: string | null;
          memory_date?: string;
          category?: string;
        };
        Relationships: [];
      };
      timeline_events: {
        Row: TimelineEventRow;
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          event_date: string;
          image_path?: string | null;
          thumb_path?: string | null;
          location?: string | null;
          created_by: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          event_date?: string;
          image_path?: string | null;
          thumb_path?: string | null;
          location?: string | null;
        };
        Relationships: [];
      };
      letters: {
        Row: LetterRow;
        Insert: {
          id?: string;
          title: string;
          body?: string;
          sender_id: string;
          recipient_id: string;
          status?: LetterStatus;
          open_at?: string | null;
        };
        Update: {
          title?: string;
          body?: string;
          recipient_id?: string;
          status?: LetterStatus;
          open_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_allowed: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      list_sealed_letters: {
        Args: Record<PropertyKey, never>;
        Returns: SealedLetterRow[];
      };
      open_letter: {
        Args: { p_id: string };
        Returns: LetterRow;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Memory = MemoryRow;
export type TimelineEvent = TimelineEventRow;
export type Letter = LetterRow;
export type AllowedUser = AllowedUserRow;
export type SealedLetter = SealedLetterRow;

/**
 * Types de la base — reflet manuel de `schema.sql`.
 *
 * Régénérables une fois le projet Supabase créé :
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type ActivityStatus = "voting" | "confirmed" | "completed" | "cancelled";
export type PaymentMode = "advance" | "on_site";

export type Profile = {
  id: string;
  full_name: string;
  pseudo: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  title: string;
  description: string | null;
  status: ActivityStatus;
  confirmed_date_option_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ActivityParticipant = {
  activity_id: string;
  profile_id: string;
  invited_at: string;
};

export type DateOption = {
  id: string;
  activity_id: string;
  /** Date ISO `YYYY-MM-DD` — pas d'heure en base. */
  start_date: string;
  /** `null` = journée unique. */
  end_date: string | null;
  created_at: string;
};

export type Vote = {
  activity_id: string;
  date_option_id: string;
  profile_id: string;
  created_at: string;
};

export type BudgetItem = {
  id: string;
  activity_id: string;
  label: string;
  amount_per_person: number;
  payment_mode: PaymentMode;
  created_at: string;
};

export type Payment = {
  id: string;
  budget_item_id: string;
  profile_id: string;
  paid: boolean;
  paid_at: string | null;
  created_at: string;
};

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert = Row, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationship[];
};

/**
 * Les relations reprennent les noms de contraintes de `schema.sql` : ce sont eux
 * que PostgREST attend dans les jointures ambiguës (`date_options!<contrainte>`).
 */
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, Pick<Profile, "id" | "full_name" | "pseudo">> & {
        Relationships: [];
      };
      activities: Table<
        Activity,
        Pick<Activity, "title" | "created_by"> &
          Partial<Pick<Activity, "id" | "description" | "status">>
      > & {
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_confirmed_date_option_fkey";
            columns: ["confirmed_date_option_id"];
            isOneToOne: false;
            referencedRelation: "date_options";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_participants: Table<
        ActivityParticipant,
        Pick<ActivityParticipant, "activity_id" | "profile_id">
      > & {
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_participants_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      date_options: Table<
        DateOption,
        Pick<DateOption, "activity_id" | "start_date"> &
          Partial<Pick<DateOption, "id" | "end_date">>
      > & {
        Relationships: [
          {
            foreignKeyName: "date_options_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
        ];
      };
      votes: Table<Vote, Pick<Vote, "activity_id" | "date_option_id" | "profile_id">> & {
        Relationships: [
          {
            foreignKeyName: "votes_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "votes_date_option_fkey";
            columns: ["date_option_id", "activity_id"];
            isOneToOne: false;
            referencedRelation: "date_options";
            referencedColumns: ["id", "activity_id"];
          },
          {
            foreignKeyName: "votes_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_items: Table<
        BudgetItem,
        Pick<BudgetItem, "activity_id" | "label" | "amount_per_person" | "payment_mode">
      > & {
        Relationships: [
          {
            foreignKeyName: "budget_items_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
        ];
      };
      /**
       * Écrite par les triggers uniquement. L'app ne fait qu'un UPDATE de `paid` ;
       * le type Insert n'est présent que pour satisfaire le contrat de postgrest-js.
       */
      payments: Table<
        Payment,
        Pick<Payment, "budget_item_id" | "profile_id">,
        Pick<Payment, "paid">
      > & {
        Relationships: [
          {
            foreignKeyName: "payments_budget_item_id_fkey";
            columns: ["budget_item_id"];
            isOneToOne: false;
            referencedRelation: "budget_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

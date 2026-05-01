import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DB_SCHEMA } from "@/lib/constants";
import type { Exercise, PersonalRecord } from "@/types/database";
import { TrainingClient } from "./training-client";

export default async function TrainingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: exercises }, { data: personalRecords }] = await Promise.all([
    supabase.schema(DB_SCHEMA).from("exercises").select("*"),
    supabase
      .schema(DB_SCHEMA)
      .from("personal_records")
      .select("*")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: true }),
  ]);

  return (
    <TrainingClient
      exercises={(exercises ?? []) as Exercise[]}
      personalRecords={(personalRecords ?? []) as PersonalRecord[]}
    />
  );
}

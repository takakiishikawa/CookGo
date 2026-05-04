import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { StaplesClient } from "./staples-client";

export default async function StaplesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const staples = await db.staples.getAll(supabase, user.id);

  return <StaplesClient staples={staples} userId={user.id} />;
}

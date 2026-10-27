import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
function localDateShift(date: Date, timezone: string, amount: number) {
  const p = localParts(date, timezone);
  const shifted = new Date(
    Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + amount),
  );
  return {
    key: shifted.toISOString().slice(0, 10),
    weekday: (shifted.getUTCDay() + 6) % 7,
  };
}
function isQuiet(
  parts: Record<string, string>,
  start?: string | null,
  end?: string | null,
) {
  if (!start || !end) return false;
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  const from = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const to = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
  return from <= to
    ? current >= from && current < to
    : current >= from || current < to;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicVapidKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateVapidKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!url || !serviceKey || !publicVapidKey || !privateVapidKey || !subject)
    return Response.json(
      { error: "Notification delivery is not configured" },
      { status: 503 },
    );
  webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: settingsRows, error } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("push_enabled", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const now = new Date();
  let sent = 0;
  let skipped = 0;
  for (const settings of settingsRows ?? []) {
    let parts: Record<string, string>;
    try {
      parts = localParts(now, settings.timezone || "UTC");
    } catch {
      skipped++;
      continue;
    }
    if (isQuiet(parts, settings.quiet_hours_start, settings.quiet_hours_end)) {
      skipped++;
      continue;
    }
    const localToday = `${parts.year}-${parts.month}-${parts.day}`;
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth_secret")
      .eq("user_id", settings.user_id);
    if (!subscriptions?.length) {
      skipped++;
      continue;
    }
    const payloads: Array<{ key: string; title: string; body: string }> = [];
    // Hobby runs one cron per day, so send each enabled daily reminder on that
    // run; reminder_time is a preference for a per-user scheduler on Pro.
    if (settings.reminder_enabled) {
      payloads.push({
        key: `daily:${localToday}`,
        title: "Dein Everwell Check-in",
        body: "Zeit für deinen Check-in: Essen, Training oder dein Wohlbefinden.",
      });
    }
    if (settings.missed_workout_enabled) {
      const yesterday = localDateShift(now, settings.timezone || "UTC", -1);
      const { data: plans } = await supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", settings.user_id)
        .eq("is_active", true)
        .is("archived_at", null)
        .maybeSingle();
      if (plans) {
        const { data: days } = await supabase
          .from("plan_days")
          .select("id,name,weekday,is_rest_day")
          .eq("user_id", settings.user_id)
          .eq("plan_id", plans.id)
          .eq("weekday", yesterday.weekday)
          .eq("is_rest_day", false);
        for (const day of days ?? []) {
          const since = new Date(
            now.getTime() - 48 * 60 * 60 * 1000,
          ).toISOString();
          const { data: finished } = await supabase
            .from("workout_sessions")
            .select("id,started_at")
            .eq("user_id", settings.user_id)
            .eq("plan_day_id", day.id)
            .not("finished_at", "is", null)
            .gte("started_at", since);
          const completedOnPlanDate = (finished ?? []).some((session) => {
            const local = localParts(
              new Date(session.started_at),
              settings.timezone || "UTC",
            );
            return (
              `${local.year}-${local.month}-${local.day}` === yesterday.key
            );
          });
          if (!completedOnPlanDate)
            payloads.push({
              key: `missed:${yesterday.key}:${day.id}`,
              title: "Training verpasst",
              body: `${day.name} war gestern geplant. Du kannst die Einheit unter Train nachholen.`,
            });
        }
      }
    }
    for (const payload of payloads) {
      const { error: eventError } = await supabase
        .from("notification_events")
        .insert({
          user_id: settings.user_id,
          event_key: payload.key,
          title: payload.title,
          body: payload.body,
          url: "/",
          scheduled_for: now.toISOString(),
        });
      if (eventError) {
        if (eventError.code === "23505") {
          const { data: existing } = await supabase
            .from("notification_events")
            .select("sent_at")
            .eq("user_id", settings.user_id)
            .eq("event_key", payload.key)
            .maybeSingle();
          if (existing?.sent_at) continue;
        } else {
          skipped++;
          continue;
        }
      }
      let delivered = false;
      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: subscription.p256dh,
                auth: subscription.auth_secret,
              },
            },
            JSON.stringify({ ...payload, url: "/" }),
          );
          delivered = true;
        } catch (pushError: unknown) {
          const statusCode =
            typeof pushError === "object" &&
            pushError !== null &&
            "statusCode" in pushError
              ? pushError.statusCode
              : undefined;
          if (statusCode === 404 || statusCode === 410)
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);
        }
      }
      if (delivered) {
        sent++;
        await supabase
          .from("notification_events")
          .update({ sent_at: now.toISOString() })
          .eq("user_id", settings.user_id)
          .eq("event_key", payload.key);
      }
    }
  }
  return Response.json({ checked: settingsRows?.length ?? 0, sent, skipped });
}

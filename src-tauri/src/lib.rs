mod db;

use db::{
    create_subscription, delete_subscription, get_settings, get_subscription, import_legacy_store, init_database,
    list_subscriptions, update_settings, AppSettings, AppSettingsInput, AppState, MigrationResult, SubscriptionInput,
    SubscriptionRecord, DB_FILE_NAME,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupExportPayload {
    exported_at_unix: u64,
    settings: AppSettings,
    subscriptions: Vec<SubscriptionRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawReminder {
    id: String,
    event_id: String,
    title: String,
    fire_at: String,
    #[serde(rename = "type")]
    reminder_type: String,
    status: String,
    added_at: String,
    #[serde(default)]
    fire_at_sofia: String,
    #[serde(default)]
    event_at_sofia: String,
    #[serde(default)]
    source: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenClawSyncResult {
    reminder_count: usize,
    pending_path: String,
}

#[tauri::command]
fn list_subscriptions_command(state: tauri::State<'_, AppState>) -> Result<Vec<SubscriptionRecord>, String> {
    list_subscriptions(&state.db_path)
}

#[tauri::command]
fn get_subscription_command(id: String, state: tauri::State<'_, AppState>) -> Result<Option<SubscriptionRecord>, String> {
    get_subscription(&state.db_path, &id)
}

#[tauri::command]
fn create_subscription_command(input: SubscriptionInput, state: tauri::State<'_, AppState>) -> Result<SubscriptionRecord, String> {
    create_subscription(&state.db_path, input)
}

#[tauri::command]
fn update_subscription_command(
    id: String,
    input: SubscriptionInput,
    state: tauri::State<'_, AppState>,
) -> Result<SubscriptionRecord, String> {
    db::update_subscription(&state.db_path, &id, input)
}

#[tauri::command]
fn delete_subscription_command(id: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    delete_subscription(&state.db_path, &id)
}

#[tauri::command]
fn get_settings_command(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
    get_settings(&state.db_path)
}

#[tauri::command]
fn update_settings_command(input: AppSettingsInput, state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
    update_settings(&state.db_path, input)
}

#[tauri::command]
fn export_full_backup_command(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let settings = get_settings(&state.db_path)?;
    let subscriptions = list_subscriptions(&state.db_path)?;
    let exported_at_unix = current_unix_timestamp()?;

    let payload = BackupExportPayload {
        exported_at_unix,
        settings,
        subscriptions,
    };

    let serialized = serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())?;
    let backups_dir = state.app_data_dir.join("backups");
    fs::create_dir_all(&backups_dir).map_err(|error| error.to_string())?;

    let backup_path: PathBuf = backups_dir.join(format!("subscription-tracker-backup-{exported_at_unix}.json"));
    fs::write(&backup_path, serialized).map_err(|error| error.to_string())?;
    Ok(backup_path.display().to_string())
}

#[tauri::command]
fn sync_openclaw_reminders_command(state: tauri::State<'_, AppState>) -> Result<OpenClawSyncResult, String> {
    let settings = get_settings(&state.db_path)?;
    let subscriptions = list_subscriptions(&state.db_path)?;
    let reminders_dir = std::env::var("HOME")
        .map(PathBuf::from)
        .map_err(|error| error.to_string())?
        .join(".openclaw/reminders");
    let pending_path = reminders_dir.join("pending.json");

    fs::create_dir_all(&reminders_dir).map_err(|error| error.to_string())?;

    let existing = read_openclaw_pending(&pending_path)?;
    let mut preserved: Vec<OpenClawReminder> = existing
        .into_iter()
        .filter(|item| item.source != "subscription-tracker")
        .collect();

    let generated = build_openclaw_reminders(&subscriptions, &settings)?;
    preserved.extend(generated.clone());
    preserved.sort_by(|a, b| a.fire_at.cmp(&b.fire_at));

    let serialized = serde_json::to_string_pretty(&preserved).map_err(|error| error.to_string())?;
    fs::write(&pending_path, serialized).map_err(|error| error.to_string())?;

    Ok(OpenClawSyncResult {
        reminder_count: generated.len(),
        pending_path: pending_path.display().to_string(),
    })
}

#[tauri::command]
fn import_legacy_store_command(state: tauri::State<'_, AppState>) -> Result<MigrationResult, String> {
    import_legacy_store(&state.app_data_dir, &state.db_path)
}

fn current_unix_timestamp() -> Result<u64, String> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|error| error.to_string())
}

fn read_openclaw_pending(path: &PathBuf) -> Result<Vec<OpenClawReminder>, String> {
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    if raw.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str::<Vec<OpenClawReminder>>(&raw).map_err(|error| error.to_string())
}

fn build_openclaw_reminders(subscriptions: &[SubscriptionRecord], settings: &AppSettings) -> Result<Vec<OpenClawReminder>, String> {
    let mut reminders = Vec::new();
    let now = current_unix_timestamp()?;

    for subscription in subscriptions {
        if subscription.status != "Active" {
            continue;
        }

        let Some(next_payment_date) = subscription.next_payment_date.as_deref() else {
            continue;
        };

        let (year, month, day) = parse_date_parts(next_payment_date)?;
        let event_at_sofia = format!("{next_payment_date}T09:00");
        let reminder_day = shift_date_string(next_payment_date, -(settings.default_reminder_days as i64))?;
        let fire_at_local = format!("{reminder_day}T09:00:00");
        let fire_at_unix = local_datetime_to_unix(&fire_at_local)?;

        reminders.push(OpenClawReminder {
            id: format!("subtrack-{}-{next_payment_date}", subscription.id),
            event_id: subscription.id.clone(),
            title: format!("Subscription renewal: {}", subscription.name),
            fire_at: fire_at_local,
            reminder_type: "subscription-renewal".to_string(),
            status: if fire_at_unix <= now { "pending".to_string() } else { "pending".to_string() },
            added_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|error| error.to_string())?
                .as_secs()
                .to_string(),
            fire_at_sofia: format!("{reminder_day}T09:00:00"),
            event_at_sofia,
            source: "subscription-tracker".to_string(),
        });
        let _ = (year, month, day);
    }

    Ok(reminders)
}

fn parse_date_parts(date: &str) -> Result<(i32, u32, u32), String> {
    let parts: Vec<_> = date.split('-').collect();
    if parts.len() != 3 {
        return Err(format!("invalid date: {date}"));
    }

    let year = parts[0].parse::<i32>().map_err(|error| error.to_string())?;
    let month = parts[1].parse::<u32>().map_err(|error| error.to_string())?;
    let day = parts[2].parse::<u32>().map_err(|error| error.to_string())?;
    Ok((year, month, day))
}

fn shift_date_string(date: &str, delta_days: i64) -> Result<String, String> {
    let (mut year, mut month, mut day) = parse_date_parts(date)?;
    let ordinal = civil_to_days(year, month as i32, day as i32) + delta_days;
    let (next_year, next_month, next_day) = days_to_civil(ordinal);
    year = next_year;
    month = next_month as u32;
    day = next_day as u32;
    Ok(format!("{year:04}-{month:02}-{day:02}"))
}

fn local_datetime_to_unix(date_time: &str) -> Result<u64, String> {
    let normalized = format!("{date_time}Z");
    let parsed = chrono_like_parse(&normalized)?;
    Ok(parsed)
}

fn chrono_like_parse(value: &str) -> Result<u64, String> {
    let trimmed = value.trim_end_matches('Z');
    let parts: Vec<_> = trimmed.split('T').collect();
    if parts.len() != 2 {
        return Err(format!("invalid datetime: {value}"));
    }
    let date = shift_date_string(parts[0], 0)?;
    let (year, month, day) = parse_date_parts(&date)?;
    let time_parts: Vec<_> = parts[1].split(':').collect();
    if time_parts.len() < 2 {
        return Err(format!("invalid datetime: {value}"));
    }
    let hour = time_parts[0].parse::<u64>().map_err(|error| error.to_string())?;
    let minute = time_parts[1].parse::<u64>().map_err(|error| error.to_string())?;
    let days = civil_to_days(year, month as i32, day as i32) - civil_to_days(1970, 1, 1);
    Ok((days as u64) * 86_400 + hour * 3_600 + minute * 60)
}

fn civil_to_days(year: i32, month: i32, day: i32) -> i64 {
    let year = year - (month <= 2) as i32;
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let month = month + if month > 2 { -3 } else { 9 };
    let doy = (153 * month + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    (era * 146097 + doe - 719468) as i64
}

fn days_to_civil(days: i64) -> (i32, i32, i32) {
    let days = days + 719468;
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = days - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let year = yoe as i32 + era as i32 * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = year + (month <= 2) as i32;
    (year, month as i32, day as i32)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| error.to_string())?;

            std::fs::create_dir_all(&app_data_dir).map_err(|error| error.to_string())?;

            let db_path = app_data_dir.join(DB_FILE_NAME);
            init_database(&db_path)?;

            app.manage(AppState {
                app_data_dir,
                db_path,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_subscriptions_command,
            get_subscription_command,
            create_subscription_command,
            update_subscription_command,
            delete_subscription_command,
            get_settings_command,
            update_settings_command,
            export_full_backup_command,
            sync_openclaw_reminders_command,
            import_legacy_store_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

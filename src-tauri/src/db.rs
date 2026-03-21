use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const DB_FILE_NAME: &str = "subscription-tracker.sqlite";
pub const LEGACY_STORE_FILE_NAME: &str = "subscriptions.json";

#[derive(Clone)]
pub struct AppState {
    pub app_data_dir: PathBuf,
    pub db_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRecord {
    pub id: String,
    pub date: String,
    pub amount_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionRecord {
    pub id: String,
    pub name: String,
    pub amount_cents: i64,
    pub currency: String,
    pub billing_cycle: String,
    pub category: String,
    pub category_detail: String,
    pub status: String,
    pub notes: String,
    pub link: String,
    pub next_payment_date: Option<String>,
    pub current_payment_date: Option<String>,
    pub status_changed_at: Option<String>,
    pub payments: Vec<PaymentRecord>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionInput {
    pub id: String,
    pub name: String,
    pub amount_cents: i64,
    pub currency: Option<String>,
    pub billing_cycle: String,
    pub category: String,
    pub category_detail: Option<String>,
    pub status: String,
    pub notes: Option<String>,
    pub link: Option<String>,
    pub next_payment_date: Option<String>,
    pub current_payment_date: Option<String>,
    pub status_changed_at: Option<String>,
    #[serde(default)]
    pub payments: Vec<PaymentRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme_preference: String,
    pub analytics_default_range_months: i64,
    pub default_reminder_days: i64,
    pub backups_enabled: bool,
    pub openclaw_sync_enabled: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsInput {
    pub theme_preference: Option<String>,
    pub analytics_default_range_months: Option<i64>,
    pub default_reminder_days: Option<i64>,
    pub backups_enabled: Option<bool>,
    pub openclaw_sync_enabled: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationResult {
    pub migrated: bool,
    pub imported_subscriptions: usize,
    pub imported_payments: usize,
    pub legacy_store_path: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyState {
    subscriptions: Option<Vec<LegacySubscription>>,
    theme_preference: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacySubscription {
    id: Option<String>,
    name: Option<String>,
    amount: Option<f64>,
    billing_cycle: Option<String>,
    category: Option<String>,
    category_detail: Option<String>,
    next_payment: Option<String>,
    current_payment: Option<String>,
    link: Option<String>,
    notes: Option<String>,
    status: Option<String>,
    status_changed_at: Option<String>,
    payments: Option<Vec<LegacyPayment>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyPayment {
    id: Option<String>,
    date: Option<String>,
    amount: Option<f64>,
}

pub fn init_database(db_path: &Path) -> Result<(), String> {
    let connection = open_connection(db_path)?;
    connection
        .execute_batch(
            "
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS subscriptions (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                amount_cents INTEGER NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                billing_cycle TEXT NOT NULL,
                category TEXT NOT NULL,
                category_detail TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                link TEXT NOT NULL DEFAULT '',
                next_payment_date TEXT,
                current_payment_date TEXT,
                status_changed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                archived_at TEXT
            );

            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                subscription_id TEXT NOT NULL,
                amount_cents INTEGER NOT NULL,
                currency TEXT NOT NULL DEFAULT 'USD',
                paid_at TEXT NOT NULL,
                period_start TEXT,
                period_end TEXT,
                source TEXT NOT NULL DEFAULT 'manual',
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_subscriptions_status
                ON subscriptions(status);
            CREATE INDEX IF NOT EXISTS idx_subscriptions_next_payment_date
                ON subscriptions(next_payment_date);
            CREATE INDEX IF NOT EXISTS idx_payments_subscription_id
                ON payments(subscription_id);
            CREATE INDEX IF NOT EXISTS idx_payments_paid_at
                ON payments(paid_at);
            ",
        )
        .map_err(|error| error.to_string())?;

    seed_default_settings(&connection)?;

    Ok(())
}

pub fn list_subscriptions(db_path: &Path) -> Result<Vec<SubscriptionRecord>, String> {
    let connection = open_connection(db_path)?;
    let mut statement = connection
        .prepare(
            "
            SELECT
                id,
                name,
                amount_cents,
                currency,
                billing_cycle,
                category,
                category_detail,
                status,
                notes,
                link,
                next_payment_date,
                current_payment_date,
                status_changed_at,
                created_at,
                updated_at
            FROM subscriptions
            WHERE archived_at IS NULL
            ORDER BY
                CASE
                    WHEN next_payment_date IS NULL OR next_payment_date = '' THEN 1
                    ELSE 0
                END,
                next_payment_date ASC,
                name COLLATE NOCASE ASC
            ",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map([], |row| {
            Ok(BaseSubscriptionRow {
                id: row.get(0)?,
                name: row.get(1)?,
                amount_cents: row.get(2)?,
                currency: row.get(3)?,
                billing_cycle: row.get(4)?,
                category: row.get(5)?,
                category_detail: row.get(6)?,
                status: row.get(7)?,
                notes: row.get(8)?,
                link: row.get(9)?,
                next_payment_date: row.get(10)?,
                current_payment_date: row.get(11)?,
                status_changed_at: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let base_rows = rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?;
    let mut subscriptions = Vec::with_capacity(base_rows.len());

    for row in base_rows {
        let row_id = row.id.clone();
        let payments = fetch_payments(&connection, &row_id)?;
        subscriptions.push(row.into_record(payments));
    }

    Ok(subscriptions)
}

pub fn get_subscription(db_path: &Path, id: &str) -> Result<Option<SubscriptionRecord>, String> {
    let connection = open_connection(db_path)?;
    fetch_subscription(&connection, id)
}

pub fn create_subscription(db_path: &Path, input: SubscriptionInput) -> Result<SubscriptionRecord, String> {
    let normalized = normalize_subscription_input(input)?;
    let mut connection = open_connection(db_path)?;
    let transaction = connection.transaction().map_err(|error| error.to_string())?;

    transaction
        .execute(
            "
            INSERT INTO subscriptions (
                id,
                name,
                amount_cents,
                currency,
                billing_cycle,
                category,
                category_detail,
                status,
                notes,
                link,
                next_payment_date,
                current_payment_date,
                status_changed_at,
                created_at,
                updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'), datetime('now'))
            ",
            params![
                normalized.id,
                normalized.name,
                normalized.amount_cents,
                normalized.currency,
                normalized.billing_cycle,
                normalized.category,
                normalized.category_detail,
                normalized.status,
                normalized.notes,
                normalized.link,
                normalized.next_payment_date,
                normalized.current_payment_date,
                normalized.status_changed_at,
            ],
        )
        .map_err(|error| error.to_string())?;

    replace_payments(
        &transaction,
        &normalized.id,
        normalized.currency.as_deref().unwrap_or("USD"),
        &normalized.payments,
    )?;
    transaction.commit().map_err(|error| error.to_string())?;

    let connection = open_connection(db_path)?;
    fetch_subscription(&connection, &normalized.id)?.ok_or_else(|| "subscription was created but could not be reloaded".to_string())
}

pub fn update_subscription(db_path: &Path, id: &str, input: SubscriptionInput) -> Result<SubscriptionRecord, String> {
    let normalized = normalize_subscription_input(SubscriptionInput { id: id.to_string(), ..input })?;
    let mut connection = open_connection(db_path)?;
    let transaction = connection.transaction().map_err(|error| error.to_string())?;

    let updated_rows = transaction
        .execute(
            "
            UPDATE subscriptions
            SET
                name = ?2,
                amount_cents = ?3,
                currency = ?4,
                billing_cycle = ?5,
                category = ?6,
                category_detail = ?7,
                status = ?8,
                notes = ?9,
                link = ?10,
                next_payment_date = ?11,
                current_payment_date = ?12,
                status_changed_at = ?13,
                updated_at = datetime('now')
            WHERE id = ?1 AND archived_at IS NULL
            ",
            params![
                normalized.id,
                normalized.name,
                normalized.amount_cents,
                normalized.currency,
                normalized.billing_cycle,
                normalized.category,
                normalized.category_detail,
                normalized.status,
                normalized.notes,
                normalized.link,
                normalized.next_payment_date,
                normalized.current_payment_date,
                normalized.status_changed_at,
            ],
        )
        .map_err(|error| error.to_string())?;

    if updated_rows == 0 {
        return Err(format!("subscription not found: {id}"));
    }

    replace_payments(
        &transaction,
        &normalized.id,
        normalized.currency.as_deref().unwrap_or("USD"),
        &normalized.payments,
    )?;
    transaction.commit().map_err(|error| error.to_string())?;

    let connection = open_connection(db_path)?;
    fetch_subscription(&connection, id)?.ok_or_else(|| "subscription was updated but could not be reloaded".to_string())
}

pub fn delete_subscription(db_path: &Path, id: &str) -> Result<(), String> {
    let connection = open_connection(db_path)?;
    let deleted_rows = connection
        .execute("DELETE FROM subscriptions WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;

    if deleted_rows == 0 {
        return Err(format!("subscription not found: {id}"));
    }

    Ok(())
}

pub fn get_settings(db_path: &Path) -> Result<AppSettings, String> {
    let connection = open_connection(db_path)?;

    if let Some(value_json) = connection
        .query_row("SELECT value_json FROM settings WHERE key = 'app_settings'", [], |row| row.get::<_, String>(0))
        .optional()
        .map_err(|error| error.to_string())?
    {
        if let Ok(settings) = serde_json::from_str::<AppSettings>(&value_json) {
            return Ok(normalize_app_settings(settings));
        }
    }

    let theme = connection
        .query_row("SELECT value_json FROM settings WHERE key = 'theme'", [], |row| row.get::<_, String>(0))
        .optional()
        .map_err(|error| error.to_string())?
        .and_then(|value_json| serde_json::from_str::<String>(&value_json).ok())
        .unwrap_or_else(|| "system".to_string());

    Ok(AppSettings {
        theme_preference: normalize_theme_preference(&theme),
        ..default_app_settings()
    })
}

pub fn update_settings(db_path: &Path, input: AppSettingsInput) -> Result<AppSettings, String> {
    let connection = open_connection(db_path)?;
    let current = get_settings(db_path)?;

    let next_settings = normalize_app_settings(AppSettings {
        theme_preference: input
            .theme_preference
            .as_deref()
            .map(normalize_theme_preference)
            .unwrap_or(current.theme_preference),
        analytics_default_range_months: input
            .analytics_default_range_months
            .unwrap_or(current.analytics_default_range_months),
        default_reminder_days: input.default_reminder_days.unwrap_or(current.default_reminder_days),
        backups_enabled: input.backups_enabled.unwrap_or(current.backups_enabled),
        openclaw_sync_enabled: input.openclaw_sync_enabled.unwrap_or(current.openclaw_sync_enabled),
    });

    connection
        .execute(
            "
            INSERT INTO settings (key, value_json, updated_at)
            VALUES ('app_settings', ?1, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
            ",
            params![serde_json::to_string(&next_settings).map_err(|error| error.to_string())?],
        )
        .map_err(|error| error.to_string())?;

    connection
        .execute(
            "
            INSERT INTO settings (key, value_json, updated_at)
            VALUES ('theme', ?1, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
            ",
            params![serde_json::to_string(&next_settings.theme_preference).map_err(|error| error.to_string())?],
        )
        .map_err(|error| error.to_string())?;

    Ok(next_settings)
}

pub fn import_legacy_store(app_data_dir: &Path, db_path: &Path) -> Result<MigrationResult, String> {
    let legacy_store_path = app_data_dir.join(LEGACY_STORE_FILE_NAME);
    let mut connection = open_connection(db_path)?;

    if legacy_import_completed(&connection)? {
        return Ok(MigrationResult {
            migrated: false,
            imported_subscriptions: 0,
            imported_payments: 0,
            legacy_store_path: legacy_store_path.display().to_string(),
            message: "Legacy store import already completed.".to_string(),
        });
    }

    if !legacy_store_path.exists() {
        return Ok(MigrationResult {
            migrated: false,
            imported_subscriptions: 0,
            imported_payments: 0,
            legacy_store_path: legacy_store_path.display().to_string(),
            message: "No legacy store found.".to_string(),
        });
    }

    let raw = fs::read_to_string(&legacy_store_path).map_err(|error| error.to_string())?;
    let legacy_state: LegacyState = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    let subscriptions = legacy_state.subscriptions.unwrap_or_default();
    let transaction = connection.transaction().map_err(|error| error.to_string())?;

    let mut imported_subscriptions = 0;
    let mut imported_payments = 0;

    for (index, legacy_subscription) in subscriptions.iter().enumerate() {
        let id = legacy_subscription
            .id
            .clone()
            .unwrap_or_else(|| format!("legacy-sub-{}", index + 1));

        let name = normalize_required_text(legacy_subscription.name.clone(), "Unnamed subscription")?;
        let amount_cents = amount_to_cents(legacy_subscription.amount.unwrap_or(0.0));
        let currency = "USD".to_string();
        let billing_cycle = normalize_required_text(legacy_subscription.billing_cycle.clone(), "Monthly")?;
        let category = normalize_required_text(legacy_subscription.category.clone(), "Other")?;
        let category_detail = normalize_text(legacy_subscription.category_detail.clone());
        let status = normalize_required_text(legacy_subscription.status.clone(), "Active")?;
        let notes = normalize_text(legacy_subscription.notes.clone());
        let link = normalize_text(legacy_subscription.link.clone());
        let next_payment_date = normalize_optional_date(legacy_subscription.next_payment.clone());
        let current_payment_date = normalize_optional_date(legacy_subscription.current_payment.clone());
        let status_changed_at = normalize_optional_date(legacy_subscription.status_changed_at.clone());

        let inserted = transaction
            .execute(
                "
                INSERT INTO subscriptions (
                    id,
                    name,
                    amount_cents,
                    currency,
                    billing_cycle,
                    category,
                    category_detail,
                    status,
                    notes,
                    link,
                    next_payment_date,
                    current_payment_date,
                    status_changed_at,
                    created_at,
                    updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, datetime('now'), datetime('now'))
                ON CONFLICT(id) DO NOTHING
                ",
                params![
                    id,
                    name,
                    amount_cents,
                    currency,
                    billing_cycle,
                    category,
                    category_detail,
                    status,
                    notes,
                    link,
                    next_payment_date,
                    current_payment_date,
                    status_changed_at,
                ],
            )
            .map_err(|error| error.to_string())?;

        if inserted > 0 {
            imported_subscriptions += 1;
        }

        let payments = collect_legacy_payments(legacy_subscription, &id);
        imported_payments += upsert_legacy_payments(&transaction, &id, &payments)?;
    }

    if let Some(theme_preference) = legacy_state.theme_preference {
        let imported_settings = AppSettings {
            theme_preference: normalize_theme_preference(&theme_preference),
            ..default_app_settings()
        };

        transaction
            .execute(
                "
                INSERT INTO settings (key, value_json, updated_at)
                VALUES ('theme', ?1, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
                ",
                params![serde_json::to_string(&imported_settings.theme_preference).map_err(|error| error.to_string())?],
            )
            .map_err(|error| error.to_string())?;

        transaction
            .execute(
                "
                INSERT INTO settings (key, value_json, updated_at)
                VALUES ('app_settings', ?1, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
                ",
                params![serde_json::to_string(&imported_settings).map_err(|error| error.to_string())?],
            )
            .map_err(|error| error.to_string())?;
    }

    mark_legacy_import_completed(&transaction)?;
    transaction.commit().map_err(|error| error.to_string())?;

    Ok(MigrationResult {
        migrated: imported_subscriptions > 0 || imported_payments > 0,
        imported_subscriptions,
        imported_payments,
        legacy_store_path: legacy_store_path.display().to_string(),
        message: if imported_subscriptions == 0 && imported_payments == 0 {
            "Legacy store processed, but nothing new was imported.".to_string()
        } else {
            "Legacy store imported into SQLite.".to_string()
        },
    })
}

#[derive(Debug)]
struct BaseSubscriptionRow {
    id: String,
    name: String,
    amount_cents: i64,
    currency: String,
    billing_cycle: String,
    category: String,
    category_detail: String,
    status: String,
    notes: String,
    link: String,
    next_payment_date: Option<String>,
    current_payment_date: Option<String>,
    status_changed_at: Option<String>,
    created_at: String,
    updated_at: String,
}

impl BaseSubscriptionRow {
    fn into_record(self, payments: Vec<PaymentRecord>) -> SubscriptionRecord {
        SubscriptionRecord {
            id: self.id,
            name: self.name,
            amount_cents: self.amount_cents,
            currency: self.currency,
            billing_cycle: self.billing_cycle,
            category: self.category,
            category_detail: self.category_detail,
            status: self.status,
            notes: self.notes,
            link: self.link,
            next_payment_date: self.next_payment_date,
            current_payment_date: self.current_payment_date,
            status_changed_at: self.status_changed_at,
            payments,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

fn open_connection(db_path: &Path) -> Result<Connection, String> {
    let connection = Connection::open(db_path).map_err(|error| error.to_string())?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

fn fetch_subscription(connection: &Connection, id: &str) -> Result<Option<SubscriptionRecord>, String> {
    let base = connection
        .query_row(
            "
            SELECT
                id,
                name,
                amount_cents,
                currency,
                billing_cycle,
                category,
                category_detail,
                status,
                notes,
                link,
                next_payment_date,
                current_payment_date,
                status_changed_at,
                created_at,
                updated_at
            FROM subscriptions
            WHERE id = ?1 AND archived_at IS NULL
            ",
            params![id],
            |row| {
                Ok(BaseSubscriptionRow {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    amount_cents: row.get(2)?,
                    currency: row.get(3)?,
                    billing_cycle: row.get(4)?,
                    category: row.get(5)?,
                    category_detail: row.get(6)?,
                    status: row.get(7)?,
                    notes: row.get(8)?,
                    link: row.get(9)?,
                    next_payment_date: row.get(10)?,
                    current_payment_date: row.get(11)?,
                    status_changed_at: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    match base {
        Some(base_row) => Ok(Some(base_row.into_record(fetch_payments(connection, id)?))),
        None => Ok(None),
    }
}

fn fetch_payments(connection: &Connection, subscription_id: &str) -> Result<Vec<PaymentRecord>, String> {
    let mut statement = connection
        .prepare(
            "
            SELECT id, paid_at, amount_cents
            FROM payments
            WHERE subscription_id = ?1
            ORDER BY paid_at ASC, id ASC
            ",
        )
        .map_err(|error| error.to_string())?;

    let rows = statement
        .query_map(params![subscription_id], |row| {
            Ok(PaymentRecord {
                id: row.get(0)?,
                date: row.get(1)?,
                amount_cents: row.get(2)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn replace_payments(
    connection: &Connection,
    subscription_id: &str,
    currency: &str,
    payments: &[PaymentRecord],
) -> Result<(), String> {
    connection
        .execute("DELETE FROM payments WHERE subscription_id = ?1", params![subscription_id])
        .map_err(|error| error.to_string())?;

    for (index, payment) in payments.iter().enumerate() {
        let date = payment.date.trim();
        if date.is_empty() {
            continue;
        }

        let payment_id = if payment.id.trim().is_empty() {
            format!("payment-{subscription_id}-{}", index + 1)
        } else {
            payment.id.trim().to_string()
        };

        connection
            .execute(
                "
                INSERT INTO payments (
                    id,
                    subscription_id,
                    amount_cents,
                    currency,
                    paid_at,
                    source,
                    notes,
                    created_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, 'manual', '', datetime('now'))
                ",
                params![payment_id, subscription_id, payment.amount_cents.max(0), currency, date],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn upsert_legacy_payments(
    connection: &Connection,
    subscription_id: &str,
    payments: &[NormalizedLegacyPayment],
) -> Result<usize, String> {
    let mut imported = 0;

    for payment in payments {
        let inserted = connection
            .execute(
                "
                INSERT INTO payments (
                    id,
                    subscription_id,
                    amount_cents,
                    currency,
                    paid_at,
                    source,
                    notes,
                    created_at
                )
                VALUES (?1, ?2, ?3, 'USD', ?4, 'legacy-import', '', datetime('now'))
                ON CONFLICT(id) DO NOTHING
                ",
                params![payment.id, subscription_id, payment.amount_cents, payment.paid_at],
            )
            .map_err(|error| error.to_string())?;

        if inserted > 0 {
            imported += 1;
        }
    }

    Ok(imported)
}

fn normalize_subscription_input(input: SubscriptionInput) -> Result<SubscriptionInput, String> {
    let id = input.id.trim().to_string();
    if id.is_empty() {
        return Err("subscription id is required".to_string());
    }

    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err("subscription name is required".to_string());
    }

    Ok(SubscriptionInput {
        id,
        name,
        amount_cents: input.amount_cents.max(0),
        currency: Some(normalize_required_text(input.currency, "USD")?),
        billing_cycle: normalize_required_text(Some(input.billing_cycle), "Monthly")?,
        category: normalize_required_text(Some(input.category), "Other")?,
        category_detail: Some(normalize_text(input.category_detail)),
        status: normalize_required_text(Some(input.status), "Active")?,
        notes: Some(normalize_text(input.notes)),
        link: Some(normalize_text(input.link)),
        next_payment_date: normalize_optional_date(input.next_payment_date),
        current_payment_date: normalize_optional_date(input.current_payment_date),
        status_changed_at: normalize_optional_date(input.status_changed_at),
        payments: normalize_payments(input.payments),
    })
}

fn normalize_payments(payments: Vec<PaymentRecord>) -> Vec<PaymentRecord> {
    let mut normalized = Vec::new();

    for (index, payment) in payments.into_iter().enumerate() {
        let date = payment.date.trim().to_string();
        if date.is_empty() {
            continue;
        }

        normalized.push(PaymentRecord {
            id: if payment.id.trim().is_empty() {
                format!("payment-{}", index + 1)
            } else {
                payment.id.trim().to_string()
            },
            date,
            amount_cents: payment.amount_cents.max(0),
        });
    }

    normalized
}

fn legacy_import_completed(connection: &Connection) -> Result<bool, String> {
    let value = connection
        .query_row(
            "SELECT value_json FROM settings WHERE key = 'legacy_store_import_completed'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    Ok(matches!(value.as_deref(), Some("true")))
}

fn mark_legacy_import_completed(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            "
            INSERT INTO settings (key, value_json, updated_at)
            VALUES ('legacy_store_import_completed', 'true', datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value_json = 'true', updated_at = excluded.updated_at
            ",
            [],
        )
        .map_err(|error| error.to_string())?;

    Ok(())
}

fn seed_default_settings(connection: &Connection) -> Result<(), String> {
    let defaults = [
        ("theme", r#""system""#),
        ("default_currency", r#""USD""#),
        ("analytics_default_range_months", "6"),
        ("default_reminder_days", "7"),
        ("backups_enabled", "false"),
        ("openclaw_sync_enabled", "false"),
        (
            "app_settings",
            r#"{"themePreference":"system","analyticsDefaultRangeMonths":6,"defaultReminderDays":7,"backupsEnabled":false,"openclawSyncEnabled":false}"#,
        ),
    ];

    for (key, value_json) in defaults {
        connection
            .execute(
                "
                INSERT INTO settings (key, value_json, updated_at)
                VALUES (?1, ?2, datetime('now'))
                ON CONFLICT(key) DO NOTHING
                ",
                params![key, value_json],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn normalize_required_text(value: Option<String>, fallback: &str) -> Result<String, String> {
    let normalized = value.unwrap_or_else(|| fallback.to_string()).trim().to_string();
    if normalized.is_empty() {
        return Err(format!("required text value is empty: {fallback}"));
    }
    Ok(normalized)
}

fn normalize_text(value: Option<String>) -> String {
    value.unwrap_or_default().trim().to_string()
}

fn normalize_optional_date(value: Option<String>) -> Option<String> {
    let normalized = value.unwrap_or_default().trim().to_string();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn default_app_settings() -> AppSettings {
    AppSettings {
        theme_preference: "system".to_string(),
        analytics_default_range_months: 6,
        default_reminder_days: 7,
        backups_enabled: false,
        openclaw_sync_enabled: false,
    }
}

fn normalize_app_settings(settings: AppSettings) -> AppSettings {
    AppSettings {
        theme_preference: normalize_theme_preference(&settings.theme_preference),
        analytics_default_range_months: settings.analytics_default_range_months.clamp(1, 24),
        default_reminder_days: settings.default_reminder_days.clamp(1, 30),
        backups_enabled: settings.backups_enabled,
        openclaw_sync_enabled: settings.openclaw_sync_enabled,
    }
}

fn normalize_theme_preference(value: &str) -> String {
    match value.trim() {
        "light" => "light".to_string(),
        "dark" => "dark".to_string(),
        _ => "system".to_string(),
    }
}

fn amount_to_cents(amount: f64) -> i64 {
    (amount * 100.0).round() as i64
}

struct NormalizedLegacyPayment {
    id: String,
    paid_at: String,
    amount_cents: i64,
}

fn collect_legacy_payments(subscription: &LegacySubscription, subscription_id: &str) -> Vec<NormalizedLegacyPayment> {
    let mut payments = Vec::new();

    if let Some(raw_payments) = &subscription.payments {
        for (index, payment) in raw_payments.iter().enumerate() {
            let Some(date) = normalize_optional_date(payment.date.clone()) else {
                continue;
            };

            payments.push(NormalizedLegacyPayment {
                id: payment
                    .id
                    .clone()
                    .unwrap_or_else(|| format!("legacy-payment-{subscription_id}-{}", index + 1)),
                paid_at: date,
                amount_cents: amount_to_cents(payment.amount.unwrap_or(subscription.amount.unwrap_or(0.0))),
            });
        }
    }

    if payments.is_empty() {
        if let Some(current_payment_date) = normalize_optional_date(subscription.current_payment.clone()) {
            payments.push(NormalizedLegacyPayment {
                id: format!("legacy-{subscription_id}-{current_payment_date}"),
                paid_at: current_payment_date,
                amount_cents: amount_to_cents(subscription.amount.unwrap_or(0.0)),
            });
        }
    }

    payments
}


#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn test_paths() -> (tempfile::TempDir, PathBuf, PathBuf) {
        let temp_dir = tempdir().expect("tempdir");
        let app_data_dir = temp_dir.path().join("app-data");
        fs::create_dir_all(&app_data_dir).expect("create app data dir");
        let db_path = app_data_dir.join(DB_FILE_NAME);
        (temp_dir, app_data_dir, db_path)
    }

    fn sample_subscription(id: &str) -> SubscriptionInput {
        SubscriptionInput {
            id: id.to_string(),
            name: "Music+".to_string(),
            amount_cents: 1299,
            currency: Some("USD".to_string()),
            billing_cycle: "Monthly".to_string(),
            category: "Streaming".to_string(),
            category_detail: Some("".to_string()),
            status: "Active".to_string(),
            notes: Some("Starter plan".to_string()),
            link: Some("https://example.com".to_string()),
            next_payment_date: Some("2026-04-01".to_string()),
            current_payment_date: Some("2026-03-01".to_string()),
            status_changed_at: Some("2026-03-01".to_string()),
            payments: vec![PaymentRecord {
                id: "payment-1".to_string(),
                date: "2026-03-01".to_string(),
                amount_cents: 1299,
            }],
        }
    }

    #[test]
    fn subscription_crud_round_trips_payments() {
        let (_temp_dir, _app_data_dir, db_path) = test_paths();
        init_database(&db_path).expect("init database");

        let created = create_subscription(&db_path, sample_subscription("sub-1")).expect("create subscription");
        assert_eq!(created.id, "sub-1");
        assert_eq!(created.payments.len(), 1);
        assert_eq!(created.payments[0].amount_cents, 1299);

        let mut updated_input = sample_subscription("sub-1");
        updated_input.name = "Music Pro".to_string();
        updated_input.status = "Paused".to_string();
        updated_input.status_changed_at = Some("2026-03-15".to_string());
        updated_input.payments.push(PaymentRecord {
            id: "payment-2".to_string(),
            date: "2026-04-01".to_string(),
            amount_cents: 1599,
        });

        let updated = update_subscription(&db_path, "sub-1", updated_input).expect("update subscription");
        assert_eq!(updated.name, "Music Pro");
        assert_eq!(updated.status, "Paused");
        assert_eq!(updated.payments.len(), 2);
        assert_eq!(updated.payments[1].amount_cents, 1599);

        let listed = list_subscriptions(&db_path).expect("list subscriptions");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].payments.len(), 2);

        delete_subscription(&db_path, "sub-1").expect("delete subscription");
        assert!(list_subscriptions(&db_path).expect("list after delete").is_empty());
    }

    #[test]
    fn settings_round_trip_theme_preference() {
        let (_temp_dir, _app_data_dir, db_path) = test_paths();
        init_database(&db_path).expect("init database");

        let defaults = get_settings(&db_path).expect("get default settings");
        assert_eq!(defaults.theme_preference, "system");

        let updated = update_settings(
            &db_path,
            AppSettingsInput {
                theme_preference: Some("dark".to_string()),
                analytics_default_range_months: Some(12),
                default_reminder_days: Some(5),
                backups_enabled: Some(true),
                openclaw_sync_enabled: Some(true),
            },
        )
        .expect("update settings");

        assert_eq!(updated.theme_preference, "dark");
        assert_eq!(updated.analytics_default_range_months, 12);
        assert_eq!(updated.default_reminder_days, 5);
        assert!(updated.backups_enabled);
        assert!(updated.openclaw_sync_enabled);

        let reloaded = get_settings(&db_path).expect("reload settings");
        assert_eq!(reloaded.theme_preference, "dark");
        assert_eq!(reloaded.analytics_default_range_months, 12);
        assert_eq!(reloaded.default_reminder_days, 5);
        assert!(reloaded.backups_enabled);
        assert!(reloaded.openclaw_sync_enabled);
    }

    #[test]
    fn legacy_import_runs_once() {
        let (_temp_dir, app_data_dir, db_path) = test_paths();
        init_database(&db_path).expect("init database");

        let legacy_json = r#"{
          "themePreference": "dark",
          "subscriptions": [
            {
              "id": "legacy-sub-1",
              "name": "Legacy Stream",
              "amount": 12.99,
              "billingCycle": "Monthly",
              "category": "Streaming",
              "categoryDetail": "",
              "nextPayment": "2026-05-01",
              "currentPayment": "2026-04-01",
              "link": "https://legacy.example.com",
              "notes": "Imported",
              "status": "Active",
              "statusChangedAt": "2026-04-01",
              "payments": [
                { "id": "legacy-payment-1", "date": "2026-04-01", "amount": 12.99 }
              ]
            }
          ]
        }"#;
        fs::write(app_data_dir.join(LEGACY_STORE_FILE_NAME), legacy_json).expect("write legacy store");

        let first_import = import_legacy_store(&app_data_dir, &db_path).expect("first import");
        assert!(first_import.migrated);
        assert_eq!(first_import.imported_subscriptions, 1);
        assert_eq!(first_import.imported_payments, 1);

        let subscriptions = list_subscriptions(&db_path).expect("list subscriptions");
        assert_eq!(subscriptions.len(), 1);
        assert_eq!(subscriptions[0].payments.len(), 1);
        assert_eq!(subscriptions[0].name, "Legacy Stream");
        assert_eq!(get_settings(&db_path).expect("get imported settings").theme_preference, "dark");

        let second_import = import_legacy_store(&app_data_dir, &db_path).expect("second import");
        assert!(!second_import.migrated);
        assert_eq!(second_import.imported_subscriptions, 0);
        assert_eq!(second_import.imported_payments, 0);
        assert_eq!(
            second_import.message,
            "Legacy store import already completed.",
        );
        assert_eq!(list_subscriptions(&db_path).expect("list after second import").len(), 1);
    }
}

//! Operaciones SQLite independientes de la ventana: comprobables también sin Tauri.
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Connection, Row};

/// Lee el esquema sin modificar el original. Una base existente sin historial también se copia.
pub async fn backup_if_pending(
    db: &Path,
    dir: &Path,
    latest: i64,
) -> Result<Option<PathBuf>, String> {
    if !db.exists() {
        return Ok(None);
    }
    let mut conn = SqliteConnectOptions::new()
        .filename(db)
        .read_only(true)
        .connect()
        .await
        .map_err(|e| e.to_string())?;
    let has_history: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations'",
    )
    .fetch_one(&mut conn)
    .await
    .map_err(|e| e.to_string())?;
    let current: i64 = if has_history > 0 {
        sqlx::query_scalar(
            "SELECT COALESCE(MAX(version), 0) FROM _sqlx_migrations WHERE success = 1",
        )
        .fetch_one(&mut conn)
        .await
        .map_err(|e| e.to_string())?
    } else {
        0
    };
    if current >= latest {
        return Ok(None);
    }
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("No se pudo crear la carpeta de copias: {e}"))?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let dest = dir.join(format!("antes-de-migrar-v{current}-a-v{latest}-{nanos}.db"));
    let result = async {
        sqlx::query("VACUUM INTO ?")
            .bind(dest.to_string_lossy().as_ref())
            .execute(&mut conn)
            .await
            .map_err(|e| e.to_string())?;
        let mut copy = SqliteConnectOptions::new()
            .filename(&dest)
            .read_only(true)
            .connect()
            .await
            .map_err(|e| e.to_string())?;
        let integrity: String = sqlx::query_scalar("PRAGMA integrity_check")
            .fetch_one(&mut copy)
            .await
            .map_err(|e| e.to_string())?;
        copy.close().await.map_err(|e| e.to_string())?;
        if integrity != "ok" {
            return Err("La copia no superó la comprobación de integridad.".to_string());
        }
        Ok(())
    }
    .await;
    conn.close().await.map_err(|e| e.to_string())?;
    if let Err(error) = result {
        let _ = std::fs::remove_file(&dest);
        return Err(format!(
            "No se pudo crear una copia segura antes de migrar: {error}"
        ));
    }
    Ok(Some(dest))
}

/// Exporta todas las tablas desde una misma instantánea, incluso con el overlay escribiendo.
pub async fn snapshot(
    pool: &sqlx::SqlitePool,
    tables: &[&str],
    stamp: &str,
) -> Result<(serde_json::Value, usize), String> {
    use serde_json::{Map, Value, json};
    use sqlx::{Column, TypeInfo, ValueRef};
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    let version: i64 =
        sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations WHERE success = 1")
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    let mut document = Map::new();
    let mut total = 0;
    for table in tables {
        let rows = sqlx::query(&format!("SELECT * FROM {table} ORDER BY rowid"))
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        let mut list = Vec::new();
        for row in rows {
            let mut object = Map::new();
            for (i, column) in row.columns().iter().enumerate() {
                let raw = row.try_get_raw(i).map_err(|e| e.to_string())?;
                let value = if raw.is_null() {
                    Value::Null
                } else {
                    match raw.type_info().name() {
                        "INTEGER" => json!(row.try_get::<i64, _>(i).map_err(|e| e.to_string())?),
                        "REAL" => json!(row.try_get::<f64, _>(i).map_err(|e| e.to_string())?),
                        _ => json!(row.try_get::<String, _>(i).map_err(|e| e.to_string())?),
                    }
                };
                object.insert(column.name().to_string(), value);
            }
            list.push(Value::Object(object));
        }
        total += list.len();
        document.insert(table.to_string(), Value::Array(list));
    }
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok((
        json!({"format": "trophyhunter-studio-backup", "format_version": 1,
        "schema_version": version, "exported_at": stamp, "tables": document}),
        total,
    ))
}

/// Solo una tabla introducida después de la versión de la copia puede faltar.
pub fn introduced_in(table: &str) -> i64 {
    match table {
        "game" | "trophy_phase" | "trophy" | "game_goal" => 7,
        "guide_entry" | "guide_entry_trophy" => 8,
        "play_session" | "session_objective" => 9,
        "collection_item" => 10,
        "trophy_task" => 11,
        "counter" => 12,
        _ => 1,
    }
}

use serde_json::{Map, Value};
use sqlx::{Pool, Sqlite};
use std::collections::HashSet;

pub const TABLES: [&str; 22] = [
    "workspace",
    "profile",
    "account_snapshot",
    "goal",
    "income",
    "idea",
    // Juegos antes que proyectos: project.game_id apunta a game (migración 007).
    "game",
    "trophy_phase",
    "trophy",
    "guide_entry",
    "guide_entry_trophy",
    "play_session",
    "session_objective",
    "collection_item",
    "trophy_task",
    "counter",
    "game_goal",
    "project",
    "adaptation",
    "adaptation_step",
    "script_section",
    "result_snapshot",
];

const FORMAT: &str = "trophyhunter-studio-backup";
const FORMAT_VERSION: u64 = 1;

/// Versión de esquema más antigua que se puede importar. Hasta ahora todas las migraciones solo
/// añaden (tipos de ingreso, columnas opcionales), así que una copia antigua cabe en el esquema actual.
/// Si una migración futura quita o renombra algo, hay que subir este mínimo (D-011).
const MIN_IMPORTABLE_SCHEMA: i64 = 1;

async fn schema_version(pool: &Pool<Sqlite>) -> Result<i64, String> {
    sqlx::query_scalar::<_, i64>("SELECT MAX(version) FROM _sqlx_migrations WHERE success = 1")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())
}

async fn columns(pool: &Pool<Sqlite>, table: &str) -> Result<HashSet<String>, String> {
    let rows = sqlx::query(&format!("PRAGMA table_info({table})"))
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows.iter().map(|r| r.get::<String, _>("name")).collect())
}

/// Valida el archivo completo; devuelve las filas por tabla listas para insertar.
pub async fn validate(
    pool: &Pool<Sqlite>,
    content: &str,
) -> Result<Vec<(&'static str, Vec<Map<String, Value>>)>, String> {
    let doc: Value = serde_json::from_str(content)
        .map_err(|_| "El archivo no es un JSON válido.".to_string())?;
    if doc["format"] != FORMAT {
        return Err("El archivo no es una copia de seguridad de TrophyHunter.".into());
    }
    if doc["format_version"] != FORMAT_VERSION {
        return Err("La copia usa un formato de archivo que esta versión no reconoce.".into());
    }
    let current = schema_version(pool).await?;
    let version = doc["schema_version"].as_i64().unwrap_or(-1);
    if !(MIN_IMPORTABLE_SCHEMA..=current).contains(&version) {
        return Err(format!(
            "La copia es de otra versión de la base de datos ({version}; esta app admite de {MIN_IMPORTABLE_SCHEMA} a {current}). Importarla podría dañar los datos."
        ));
    }

    let mut result = Vec::new();
    for table in TABLES {
        // Una copia de una versión anterior puede no tener tablas creadas después: cuentan como vacías.
        let empty = Vec::new();
        let rows = match doc["tables"][table].as_array() {
            Some(rows) => rows,
            None if doc["tables"].get(table).is_none() && version < introduced_in(table) => &empty,
            None => return Err(format!("Falta la tabla «{table}» en la copia.")),
        };
        if table == "workspace"
            && (rows.len() != 1 || rows[0]["id"] != "00000000-0000-4000-8000-000000000001")
        {
            return Err("La copia debe contener el espacio de trabajo de TrophyHunter.".into());
        }
        let allowed = columns(pool, table).await?;
        let mut list = Vec::with_capacity(rows.len());
        for row in rows {
            let obj = row
                .as_object()
                .ok_or_else(|| format!("Fila no válida en «{table}»."))?;
            if obj.is_empty() {
                return Err(format!("Fila vacía en «{table}»."));
            }
            for (key, value) in obj {
                // Los nombres de columna se insertan en el SQL: solo se aceptan columnas reales.
                if !allowed.contains(key) {
                    return Err(format!("Columna desconocida «{key}» en «{table}»."));
                }
                if !(value.is_null() || value.is_number() || value.is_string()) {
                    return Err(format!("Valor no válido en «{table}.{key}»."));
                }
            }
            list.push(obj.clone());
        }
        result.push((table, list));
    }
    Ok(result)
}

/// Restaura en una transacción; un fallo conserva íntegros los datos anteriores.
pub async fn restore(pool: &Pool<Sqlite>, content: &str) -> Result<usize, String> {
    let data = validate(pool, content).await?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    for table in TABLES.iter().rev() {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut total = 0;
    for (table, rows) in &data {
        for row in rows {
            let cols: Vec<&String> = row.keys().collect();
            let marks = vec!["?"; cols.len()].join(", ");
            let names = cols
                .iter()
                .map(|c| c.as_str())
                .collect::<Vec<_>>()
                .join(", ");
            let sql = format!("INSERT INTO {table} ({names}) VALUES ({marks})");
            let mut query = sqlx::query(&sql);
            for col in &cols {
                query = match &row[col.as_str()] {
                    Value::Null => query.bind(None::<String>),
                    Value::Number(n) if n.is_i64() => query.bind(n.as_i64()),
                    Value::Number(n) => query.bind(n.as_f64()),
                    Value::String(s) => query.bind(s.clone()),
                    _ => unreachable!("validado antes"),
                };
            }
            query
                .execute(&mut *tx)
                .await
                .map_err(|e| format!("Error al importar «{table}»: {e}"))?;
            total += 1;
        }
    }

    let broken = sqlx::query("PRAGMA foreign_key_check")
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    if !broken.is_empty() {
        return Err("La copia tiene relaciones rotas entre tablas; no se importó nada.".into());
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(total)
}

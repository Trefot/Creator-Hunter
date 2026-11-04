//! Copias de seguridad: exportar todos los datos a JSON e importarlos (ver D-011).
//!
//! La importación valida el archivo completo antes de tocar nada, guarda una copia de la base
//! de datos actual con `VACUUM INTO` y reemplaza los datos dentro de una transacción: si algo
//! falla, la transacción se deshace al soltarse y los datos quedan como estaban.

use std::collections::HashSet;
use std::path::PathBuf;

use serde::Serialize;
use serde_json::{json, Map, Value};
use sqlx::{Column, Pool, Row, Sqlite, TypeInfo, ValueRef};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::DB_URL;

/// Tablas de datos, de padres a hijos (orden de inserción; el borrado va al revés).
const TABLES: [&str; 21] = [
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

#[derive(Serialize)]
pub struct ExportResult {
    path: String,
    rows: usize,
}

#[derive(Serialize)]
pub struct ImportResult {
    rows: usize,
    safety_copy: String,
}

async fn pool(app: &AppHandle) -> Result<Pool<Sqlite>, String> {
    let instances = app.state::<DbInstances>();
    let map = instances.0.read().await;
    match map.get(DB_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err("La base de datos no está abierta.".into()),
    }
}

/// Carpeta de copias: Documentos\TrophyHunter\Copias.
fn backup_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .document_dir()
        .map_err(|e| e.to_string())?
        .join("TrophyHunter")
        .join("Copias");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// La marca de tiempo llega del frontend (hora local); solo se aceptan dígitos y guiones.
fn check_stamp(stamp: &str) -> Result<(), String> {
    if stamp.is_empty() || !stamp.chars().all(|c| c.is_ascii_digit() || c == '-') {
        return Err("Marca de tiempo no válida.".into());
    }
    Ok(())
}

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

#[tauri::command]
pub async fn export_backup(app: AppHandle, stamp: String) -> Result<ExportResult, String> {
    check_stamp(&stamp)?;
    let pool = pool(&app).await?;

    let mut tables = Map::new();
    let mut total = 0;
    for table in TABLES {
        let rows = sqlx::query(&format!("SELECT * FROM {table} ORDER BY rowid"))
            .fetch_all(&pool)
            .await
            .map_err(|e| e.to_string())?;
        let mut list = Vec::with_capacity(rows.len());
        for row in &rows {
            let mut obj = Map::new();
            for (i, col) in row.columns().iter().enumerate() {
                let raw = row.try_get_raw(i).map_err(|e| e.to_string())?;
                // SQLite guarda el tipo en cada valor: se exporta tal cual.
                let value = match raw.type_info().name() {
                    "NULL" => Value::Null,
                    "INTEGER" => json!(row.try_get::<i64, _>(i).map_err(|e| e.to_string())?),
                    "REAL" => json!(row.try_get::<f64, _>(i).map_err(|e| e.to_string())?),
                    _ => json!(row.try_get::<String, _>(i).map_err(|e| e.to_string())?),
                };
                obj.insert(col.name().to_string(), value);
            }
            list.push(Value::Object(obj));
        }
        total += list.len();
        tables.insert(table.to_string(), Value::Array(list));
    }

    let document = json!({
        "format": FORMAT,
        "format_version": FORMAT_VERSION,
        "schema_version": schema_version(&pool).await?,
        "exported_at": stamp,
        "tables": tables,
    });

    let path = backup_dir(&app)?.join(format!("trophyhunter-copia-{stamp}.json"));
    let text = serde_json::to_string_pretty(&document).map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(ExportResult { path: path.display().to_string(), rows: total })
}

/// Valida el archivo completo; devuelve las filas por tabla listas para insertar.
async fn validate(pool: &Pool<Sqlite>, content: &str) -> Result<Vec<(&'static str, Vec<Map<String, Value>>)>, String> {
    let doc: Value = serde_json::from_str(content).map_err(|_| "El archivo no es un JSON válido.".to_string())?;
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
            None if version < current => &empty,
            None => return Err(format!("Falta la tabla «{table}» en la copia.")),
        };
        let allowed = columns(pool, table).await?;
        let mut list = Vec::with_capacity(rows.len());
        for row in rows {
            let obj = row.as_object().ok_or_else(|| format!("Fila no válida en «{table}»."))?;
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

#[tauri::command]
pub async fn import_backup(app: AppHandle, content: String, stamp: String) -> Result<ImportResult, String> {
    check_stamp(&stamp)?;
    let pool = pool(&app).await?;
    let data = validate(&pool, &content).await?;

    // Copia de la base de datos actual antes de reemplazar nada.
    let safety = backup_dir(&app)?.join(format!("antes-de-importar-{stamp}.db"));
    let safety_sql = safety.display().to_string().replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{safety_sql}'"))
        .execute(&pool)
        .await
        .map_err(|e| format!("No se pudo crear la copia previa: {e}"))?;

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
            let names = cols.iter().map(|c| c.as_str()).collect::<Vec<_>>().join(", ");
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
    Ok(ImportResult { rows: total, safety_copy: safety.display().to_string() })
}

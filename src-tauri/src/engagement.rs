//! TTS local con voz de Windows. Texto y opciones se envían por stdin JSON, nunca como código.
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::VecDeque,
    io::Write,
    process::{Child, Command, Stdio},
    sync::{
        Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};
#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SpeechConfig {
    pub enabled: bool,
    pub voice: String,
    pub rate: i32,
    pub volume: u32,
    pub blocked: String,
    pub reward: String,
    pub channel: String,
    pub client: String,
}
impl Default for SpeechConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            voice: String::new(),
            rate: 0,
            volume: 70,
            blocked: String::new(),
            reward: String::new(),
            channel: String::new(),
            client: String::new(),
        }
    }
}
#[derive(Clone, Serialize)]
struct Speech {
    id: String,
    user: String,
    text: String,
    reward: String,
    channel: String,
    client: String,
}
#[derive(Default)]
struct Inner {
    queue: VecDeque<Speech>,
    current: Option<Speech>,
    child: Option<Child>,
    recent: VecDeque<(String, Instant)>,
    message: String,
    paused: bool,
}
#[derive(Default)]
pub struct EngagementState {
    inner: Mutex<Inner>,
    generation: AtomicU64,
}
async fn config(app: &AppHandle) -> Result<SpeechConfig, String> {
    let v = crate::social_alerts::load(app, "studio-tts").await?;
    if v.is_null() {
        Ok(SpeechConfig::default())
    } else {
        serde_json::from_value(v).map_err(|_| "Configuración de voz no válida.".into())
    }
}
#[cfg(windows)]
fn powershell(script: &str) -> Command {
    use base64::{Engine, engine::general_purpose::STANDARD};
    use std::os::windows::process::CommandExt;
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let mut c = Command::new("powershell.exe");
    c.creation_flags(0x08000000).args([
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        &STANDARD.encode(bytes),
    ]);
    c
}
#[cfg(not(windows))]
fn powershell(_script: &str) -> Command {
    Command::new("nexus-windows-voice-unavailable")
}
const SAY: &str = r#"$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.Encoding]::UTF8
Add-Type -AssemblyName System.Speech
$d=[Console]::In.ReadToEnd()|ConvertFrom-Json
$s=New-Object System.Speech.Synthesis.SpeechSynthesizer
if($d.voice){$s.SelectVoice([string]$d.voice)}
$s.Rate=[int]$d.rate
$s.Volume=[int]$d.volume
Register-ObjectEvent -InputObject $s -EventName SpeakCompleted -SourceIdentifier NexusSpeechDone | Out-Null
$null=$s.SpeakAsync([string]$d.text)
$done=$null
$ticks=0
while($null -eq $done){
 try{$null=[Diagnostics.Process]::GetProcessById([int]$d.parent)}catch{$s.SpeakAsyncCancelAll();$s.Dispose();exit 1}
 $done=Get-Event -SourceIdentifier NexusSpeechDone -ErrorAction SilentlyContinue | Select-Object -First 1
 if($null -eq $done){Start-Sleep -Milliseconds 100}
 $ticks++
 if($ticks -gt 600){$s.SpeakAsyncCancelAll();$s.Dispose();exit 1}
}
$bad=$done.SourceEventArgs.Cancelled -or ($null -ne $done.SourceEventArgs.Error)
Unregister-Event -SourceIdentifier NexusSpeechDone
Remove-Event -SourceIdentifier NexusSpeechDone
$s.Dispose()
if($bad){exit 1}
"#;
fn speak(text: &str, c: &SpeechConfig) -> Result<Child, String> {
    let mut child = powershell(SAY)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "No se pudo iniciar la voz local de Windows.".to_string())?;
    let data = json!({"parent":std::process::id(),"text":text,"voice":c.voice,"rate":c.rate,"volume":c.volume}).to_string();
    let written = child
        .stdin
        .take()
        .ok_or("No se pudo enviar el texto a la voz.")
        .and_then(|mut input| {
            input
                .write_all(data.as_bytes())
                .map_err(|_| "No se pudo enviar el texto a la voz.")
        });
    if let Err(e) = written {
        let _ = child.kill();
        let _ = child.wait();
        return Err(e.into());
    }
    Ok(child)
}
#[tauri::command]
pub async fn studio_voices() -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(||{
 let script=r#"$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.Encoding]::UTF8;Add-Type -AssemblyName System.Speech;$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;ConvertTo-Json -Compress -InputObject @($s.GetInstalledVoices()|Where-Object {$_.Enabled}|ForEach-Object {$_.VoiceInfo.Name});$s.Dispose()"#;
 let o=powershell(script).output().map_err(|_|"Las voces locales requieren Windows.".to_string())?;if !o.status.success(){return Err("No se pudieron consultar las voces. Instala una voz de Windows y vuelve a probar.".into());}serde_json::from_str(String::from_utf8_lossy(&o.stdout).trim().trim_start_matches('\u{feff}')).map_err(|_|"Respuesta de voces no válida.".into())
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn studio_tts_configure(
    app: AppHandle,
    enabled: bool,
    voice: String,
    rate: i32,
    volume: u32,
    blocked: String,
) -> Result<(), String> {
    if !(-5..=5).contains(&rate) || volume > 100 || voice.len() > 200 || blocked.len() > 2000 {
        return Err("Opciones de voz no válidas.".into());
    }
    let mut c = config(&app).await?;
    let was_enabled = c.enabled;
    c.enabled = enabled;
    c.voice = voice;
    c.rate = rate;
    c.volume = volume;
    c.blocked = blocked;
    crate::social_alerts::save(&app, "studio-tts", &json!(c)).await?;
    if was_enabled && !enabled {
        control(&app, "stop")?;
    }
    Ok(())
}
pub fn control(app: &AppHandle, action: &str) -> Result<(), String> {
    let state = app.state::<EngagementState>();
    let mut inner = state.inner.lock().unwrap();
    match action {
        "pause" => inner.paused = !inner.paused,
        "stop" => {
            inner.paused = true;
            state.generation.fetch_add(1, Ordering::SeqCst);
            if let Some(child) = inner.child.as_mut() {
                let _ = child.kill();
            }
            inner.message =
                "Voz detenida; los canjes no completados se mantienen pendientes en Twitch.".into();
        }
        _ => return Err("Acción no válida.".into()),
    }
    Ok(())
}
#[tauri::command]
pub fn studio_tts_control(app: AppHandle, action: String) -> Result<(), String> {
    control(&app, &action)
}
#[tauri::command]
pub async fn studio_tts_status(app: AppHandle) -> Result<Value, String> {
    let c = config(&app).await?;
    let state = app.state::<EngagementState>();
    let i = state.inner.lock().unwrap();
    Ok(
        json!({"config":c,"queue":i.queue,"current":i.current,"paused":i.paused,"message":i.message}),
    )
}
#[tauri::command]
pub async fn studio_tts_test(app: AppHandle, text: String) -> Result<(), String> {
    let c = config(&app).await?;
    let text = crate::studio_core::speech_text(&text, &c.blocked)?;
    let state = app.state::<EngagementState>();
    let mut i = state.inner.lock().unwrap();
    if i.queue.len() >= 10 {
        return Err("La cola está llena.".into());
    }
    i.queue.push_back(Speech {
        id: format!("test-{}", rand::random::<u64>()),
        user: "Prueba".into(),
        text,
        reward: String::new(),
        channel: String::new(),
        client: String::new(),
    });
    Ok(())
}
pub async fn twitch_request(
    method: reqwest::Method,
    path: &str,
    query: &[(&str, &str)],
    body: Option<Value>,
) -> Result<Value, String> {
    let (client, token, _) = crate::social_alerts::twitch_token().await?;
    let mut r = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "No se pudo iniciar HTTP.")?
        .request(method, format!("https://api.twitch.tv/helix/{path}"))
        .bearer_auth(token)
        .header("Client-Id", client)
        .query(query);
    if let Some(body) = body {
        r = r.json(&body);
    }
    let r = r
        .send()
        .await
        .map_err(|_| "Twitch no confirmó la operación; comprueba el panel antes de repetirla.")?;
    let status = r.status();
    if !status.is_success() {
        return Err(format!(
            "Twitch rechazó la operación ({status}). Revisa permisos, afiliación y propiedad de la recompensa."
        ));
    }
    if status == 204 {
        return Ok(Value::Null);
    }
    r.json()
        .await
        .map_err(|_| "Respuesta no válida de Twitch.".into())
}
#[tauri::command]
pub async fn studio_reward_create(app: AppHandle, cost: u32) -> Result<(), String> {
    if !(1..=100000).contains(&cost) {
        return Err("Coste entre 1 y 100000 puntos.".into());
    }
    let mut c = config(&app).await?;
    if !c.reward.is_empty() {
        return Err("Ya hay una recompensa vinculada. Gestiona su coste en Twitch; conserva el ID para sus canjes.".into());
    }
    let (client, _, user) = crate::social_alerts::twitch_token().await?;
    let existing = twitch_request(
        reqwest::Method::GET,
        "channel_points/custom_rewards",
        &[
            ("broadcaster_id", user.as_str()),
            ("only_manageable_rewards", "true"),
        ],
        None,
    )
    .await?;
    let recovered = existing["data"]
        .as_array()
        .and_then(|items| {
            items
                .iter()
                .find(|v| v["title"] == "Nexus · Leer mi mensaje")
        })
        .cloned();
    let v = if let Some(reward) = recovered {
        json!({"data":[reward]})
    } else {
        twitch_request(reqwest::Method::POST,"channel_points/custom_rewards",&[("broadcaster_id",&user)],Some(json!({"title":"Nexus · Leer mi mensaje","cost":cost,"is_user_input_required":true,"prompt":"Máximo 180 caracteres, sin enlaces. La voz debe estar activa en Nexus.","is_global_cooldown_enabled":true,"global_cooldown_seconds":30,"should_redemptions_skip_request_queue":false}))).await?
    };

    c.reward = v["data"][0]["id"]
        .as_str()
        .ok_or("Twitch no confirmó el ID; comprueba tus recompensas antes de repetir.")?
        .into();
    c.channel = user;
    c.client = client;
    crate::social_alerts::save(&app, "studio-tts", &json!(c)).await
}
async fn settle(app: &AppHandle, s: &Speech, status: &str) -> Result<(), String> {
    if s.reward.is_empty() {
        return Ok(());
    }
    let (client, _, user) = crate::social_alerts::twitch_token().await?;
    if user != s.channel || client != s.client {
        return Err("La cuenta o aplicación cambió. Resuelve el canje desde Twitch.".into());
    }
    twitch_request(
        reqwest::Method::PATCH,
        "channel_points/custom_rewards/redemptions",
        &[
            ("broadcaster_id", &s.channel),
            ("reward_id", &s.reward),
            ("id", &s.id),
        ],
        Some(json!({"status":status})),
    )
    .await?;
    crate::social_alerts::save(
        app,
        &format!("tts-redeem/{}", s.id),
        &json!({"status":status}),
    )
    .await
}
pub fn cancel(app: &AppHandle, event: &Value) {
    if event["status"] != "canceled" {
        return;
    }
    let Some(id) = event["id"].as_str() else {
        return;
    };
    let state = app.state::<EngagementState>();
    let mut i = state.inner.lock().unwrap();
    i.queue.retain(|s| s.id != id);
    if i.current.as_ref().is_some_and(|s| s.id == id) {
        state.generation.fetch_add(1, Ordering::SeqCst);
        if let Some(c) = i.child.as_mut() {
            let _ = c.kill();
        }
    }
}
pub async fn receive(app: &AppHandle, event: &Value) {
    let Ok(c) = config(app).await else {
        return;
    };
    if c.reward.is_empty()
        || event["reward"]["id"] != c.reward
        || event["broadcaster_user_id"] != c.channel
    {
        return;
    }
    let Some(id) = event["id"].as_str().filter(|s| !s.is_empty()) else {
        return;
    };
    let key = format!("tts-redeem/{id}");
    let Ok(pool) = crate::backup::pool(app).await else {
        return;
    };
    let claimed = sqlx::query("INSERT OR IGNORE INTO alert_cursor(id,content) VALUES(?,?)")
        .bind(&key)
        .bind(json!({"status":"pending","reward":c.reward,"channel":c.channel}).to_string())
        .execute(&pool)
        .await;
    if !claimed.is_ok_and(|r| r.rows_affected() == 1) {
        return;
    }
    let text =
        crate::studio_core::speech_text(event["user_input"].as_str().unwrap_or(""), &c.blocked);
    let s = Speech {
        id: id.into(),
        user: event["user_name"]
            .as_str()
            .unwrap_or("Usuario")
            .chars()
            .take(100)
            .collect(),
        text: text.clone().unwrap_or_default(),
        reward: c.reward,
        channel: c.channel,
        client: c.client,
    };
    let accepted = {
        let state = app.state::<EngagementState>();
        let mut i = state.inner.lock().unwrap();
        i.recent
            .retain(|(_, t)| t.elapsed() < Duration::from_secs(60));
        let user = event["user_id"].as_str().unwrap_or("");
        if c.enabled
            && !i.paused
            && text.is_ok()
            && i.queue.len() < 10
            && !i.recent.iter().any(|(id, _)| id == user)
        {
            i.recent.push_back((user.into(), Instant::now()));
            i.queue.push_back(s.clone());
            true
        } else {
            false
        }
    };
    if !accepted {
        if let Err(e) = settle(app, &s, "CANCELED").await {
            app.state::<EngagementState>().inner.lock().unwrap().message = e;
        }
    }
}
pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_millis(200));
            if app
                .state::<EngagementState>()
                .inner
                .lock()
                .unwrap()
                .queue
                .is_empty()
            {
                continue;
            }
            let Ok(c) = tauri::async_runtime::block_on(config(&app)) else {
                continue;
            };
            let (next, generation) = {
                let state = app.state::<EngagementState>();
                let mut i = state.inner.lock().unwrap();
                if i.paused || (!c.enabled && i.queue.front().is_none_or(|s| !s.reward.is_empty()))
                {
                    continue;
                }
                let next = i.queue.pop_front();
                if let Some(s) = &next {
                    i.current = Some(s.clone());
                }
                (next, state.generation.load(Ordering::SeqCst))
            };
            let Some(s) = next else {
                continue;
            };
            let result=speak(&s.text,&c).and_then(|mut child|{
  let state=app.state::<EngagementState>();{let mut i=state.inner.lock().unwrap();if state.generation.load(Ordering::SeqCst)!=generation{let _=child.kill();let _=child.wait();return Err("Voz cancelada.".into());}i.child=Some(child);}
  let start=Instant::now();loop{std::thread::sleep(Duration::from_millis(100));let mut i=state.inner.lock().unwrap();let Some(child)=i.child.as_mut()else{return Err("Voz detenida.".into());};
   if start.elapsed()>Duration::from_secs(60){let _=child.kill();let _=child.wait();i.child=None;return Err("La voz superó el tiempo máximo.".into());}
   match child.try_wait(){Ok(Some(status))=>{i.child=None;return if status.success()&&state.generation.load(Ordering::SeqCst)==generation{Ok(())}else{Err("La voz no se completó. Revisa la salida de audio y el canje en Twitch.".into())};},Ok(None)=>{},Err(_)=>{let _=child.kill();let _=child.wait();i.child=None;return Err("No se pudo comprobar la voz.".into());}}
  }
 });
            let message = match result {
                Ok(()) => match tauri::async_runtime::block_on(settle(&app, &s, "FULFILLED")) {
                    Ok(()) => "Mensaje leído. Comprueba la salida de audio en OBS.".into(),
                    Err(e) => e,
                },
                Err(e) => {
                    let refund = tauri::async_runtime::block_on(settle(&app, &s, "CANCELED"));
                    format!("{e} {}", refund.err().unwrap_or_default())
                }
            };
            let state = app.state::<EngagementState>();
            let mut i = state.inner.lock().unwrap();
            i.current = None;
            i.message = message;
        }
    });
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn windows_parses_the_voice_script_without_playing_audio() {
        let parser = r#"$script=[Console]::In.ReadToEnd();$tokens=$null;$errors=$null;$null=[System.Management.Automation.Language.Parser]::ParseInput($script,[ref]$tokens,[ref]$errors);if($errors.Count -gt 0){exit 1}else{exit 0}"#;
        let mut child = powershell(parser)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(SAY.as_bytes())
            .unwrap();
        assert!(child.wait().unwrap().success());
    }
}

pub fn reset_after_restore(app: &AppHandle) {
    let _ = control(app, "stop");
    app.state::<EngagementState>()
        .inner
        .lock()
        .unwrap()
        .queue
        .clear();
}

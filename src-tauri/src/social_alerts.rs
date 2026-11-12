//! Lectores oficiales: YouTube Data API y Twitch EventSub WebSocket, sin servidor público.
use serde_json::{Value,json};
use std::{sync::Mutex,time::{Duration,Instant}};
use tauri::{AppHandle,Manager};
use tauri_plugin_opener::OpenerExt;
use crate::social_events::Incoming;
#[derive(Default)]pub struct SocialState{status:Mutex<Value>,device:Mutex<Option<Value>>}
fn status(app:&AppHandle,p:&str,message:&str,connected:bool){let state=app.state::<SocialState>();let mut s=state.status.lock().unwrap();if !s.is_object(){*s=json!({});}s[p]=json!({"connected":connected,"message":message});}
async fn load(app:&AppHandle,id:&str)->Result<Value,String>{let pool=crate::backup::pool(app).await?;let raw:Option<String>=sqlx::query_scalar("SELECT content FROM alert_cursor WHERE id=?").bind(id).fetch_optional(&pool).await.map_err(|e|e.to_string())?;raw.map(|s|serde_json::from_str(&s).map_err(|e|e.to_string())).unwrap_or(Ok(Value::Null))}
async fn save(app:&AppHandle,id:&str,v:&Value)->Result<(),String>{let pool=crate::backup::pool(app).await?;sqlx::query("INSERT INTO alert_cursor(id,content) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content").bind(id).bind(v.to_string()).execute(&pool).await.map_err(|e|e.to_string())?;Ok(())}
#[tauri::command]pub async fn social_status(app:AppHandle)->Result<Value,String>{let settings=load(&app,"social-settings").await?;let s=app.state::<SocialState>().status.lock().unwrap().clone();Ok(json!({"settings":settings,"platforms":s}))}
#[tauri::command]pub async fn social_enable(app:AppHandle,platform:String,enabled:bool)->Result<(),String>{if !["youtube","twitch"].contains(&platform.as_str()){return Err("Plataforma no disponible.".into());}let mut s=load(&app,"social-settings").await?;if !s.is_object(){s=json!({});}s[&platform]=json!(enabled);save(&app,"social-settings",&s).await?;status(&app,&platform,if enabled{"Conectando…"}else{"Recepción desactivada"},false);Ok(())}
async fn api(url:&str,token:&str,query:&[(&str,&str)],client:Option<&str>)->Result<Value,String>{let mut r=reqwest::Client::builder().timeout(Duration::from_secs(20)).build().map_err(|e|e.to_string())?.get(url).bearer_auth(token).query(query);if let Some(c)=client{r=r.header("Client-Id",c);}let r=r.send().await.map_err(|_|"Sin respuesta de la plataforma. Se reintentará.".to_string())?;let code=r.status();if !code.is_success(){return Err(format!("La plataforma rechazó la consulta ({code}). Comprueba autorización, API habilitada y cuota."));}r.json().await.map_err(|_|"Respuesta no válida.".into())}
async fn deliver(app:&AppHandle,p:&str,e:Incoming)->Result<(),String>{crate::alerts::receive(app,p,e.kind,&e.name,&e.amount,&e.note).await}
struct YouTubeReader{subs:Instant,live:Instant,chat_due:Instant,chat:String,page:String,channel:String}
impl Default for YouTubeReader{fn default()->Self{let now=Instant::now();Self{subs:now,live:now,chat_due:now,chat:String::new(),page:String::new(),channel:String::new()}}}
impl YouTubeReader{async fn tick(&mut self,app:&AppHandle)->Result<(),String>{
    let now=Instant::now();if now<self.subs&&now<self.live&&now<self.chat_due{return Ok(());}
    let token=crate::youtube::access_token(app,&app.state::<crate::youtube::YouTubeState>()).await?;
    if self.channel.is_empty(){let v=api("https://www.googleapis.com/youtube/v3/channels",&token,&[("part","id"),("mine","true")],None).await?;self.channel=v["items"][0]["id"].as_str().ok_or("No hay canal conectado.")?.into();}
    if now>=self.subs{
        self.subs=now+Duration::from_secs(120);
        let v=api("https://www.googleapis.com/youtube/v3/subscriptions",&token,&[("part","snippet,subscriberSnippet"),("myRecentSubscribers","true"),("maxResults","50")],None).await?;
        let id=format!("youtube-subs-{}",self.channel);let old=load(app,&id).await?;let mut seen:Vec<String>=old.as_array().map(|a|a.iter().filter_map(|v|v.as_str().map(String::from)).collect()).unwrap_or_default();
        let items=v["items"].as_array().ok_or("Respuesta de suscriptores no válida.")?;
        // La primera lectura solo establece una línea base, nunca anuncia seguidores antiguos.
        for item in items.iter().rev(){let Some(event_id)=item["id"].as_str()else{continue};if seen.iter().any(|x|x==event_id){continue;}if old.is_array(){let name=item["subscriberSnippet"]["title"].as_str().unwrap_or("Suscriptor");crate::alerts::receive(app,"youtube","subscriber",name,"1","").await?;}seen.push(event_id.into());}
        if seen.len()>2000{seen.drain(..seen.len()-2000);}save(app,&id,&json!(seen)).await?;
    }
    if now>=self.live{self.live=now+Duration::from_secs(60);let v=api("https://www.googleapis.com/youtube/v3/liveBroadcasts",&token,&[("part","snippet"),("broadcastStatus","active"),("broadcastType","all"),("maxResults","50")],None).await?;let chat=v["items"].as_array().and_then(|a|a.iter().find_map(|v|v["snippet"]["liveChatId"].as_str())).unwrap_or("");if chat!=self.chat{self.chat=chat.into();self.page.clear();self.chat_due=now;}}
    if !self.chat.is_empty()&&now>=self.chat_due{
        let mut q=vec![("part","snippet,authorDetails"),("liveChatId",self.chat.as_str()),("maxResults","2000")];if !self.page.is_empty(){q.push(("pageToken",&self.page));}
        let v=api("https://www.googleapis.com/youtube/v3/liveChat/messages",&token,&q,None).await?;
        self.chat_due=now+Duration::from_millis(v["pollingIntervalMillis"].as_u64().unwrap_or(10000).max(1000));
        let id=format!("youtube-chat-{}",self.chat);let old=load(app,&id).await?;let mut seen:Vec<String>=old.as_array().map(|a|a.iter().filter_map(|v|v.as_str().map(String::from)).collect()).unwrap_or_default();
        for item in v["items"].as_array().into_iter().flatten(){let Some(eid)=item["id"].as_str()else{continue};if seen.iter().any(|v|v==eid){continue;}if !self.page.is_empty(){if let Some(e)=crate::social_events::youtube(item){deliver(app,"youtube",e).await?;}}seen.push(eid.into());}
        if seen.len()>4000{seen.drain(..seen.len()-4000);}save(app,&id,&json!(seen)).await?;self.page=v["nextPageToken"].as_str().unwrap_or("").into();
    }
    status(app,"youtube",if self.chat.is_empty(){"Conectado · suscriptores públicos cada 2 min · sin directo activo"}else{"Conectado · chat del directo y suscriptores públicos"},true);Ok(())
}}
const SCOPES:&str="moderator:read:followers channel:read:subscriptions bits:read";
fn entry()->Result<keyring::Entry,String>{keyring::Entry::new("TrophyHunter",if cfg!(debug_assertions){"twitch-alerts-dev"}else{"twitch-alerts"}).map_err(|e|e.to_string())}
#[tauri::command]pub async fn twitch_begin(app:AppHandle,client_id:String)->Result<Value,String>{
    if client_id.len()<10||client_id.len()>100||!client_id.bytes().all(|b|b.is_ascii_alphanumeric()){return Err("Introduce el Client ID de una aplicación pública de Twitch.".into());}
    let r=reqwest::Client::new().post("https://id.twitch.tv/oauth2/device").form(&[("client_id",client_id.as_str()),("scopes",SCOPES)]).send().await.map_err(|_|"No se pudo contactar con Twitch.")?;
    if !r.status().is_success(){return Err("Twitch rechazó el Client ID. La aplicación debe ser de tipo público.".into());}let mut d:Value=r.json().await.map_err(|_|"Respuesta no válida.")?;d["client_id"]=json!(client_id);
    let uri=d["verification_uri"].as_str().ok_or("Falta URL de autorización.")?.to_string();if !uri.starts_with("https://www.twitch.tv/activate"){return Err("URL inesperada de Twitch.".into());}
    let result=json!({"code":d["user_code"],"interval":d["interval"],"url":uri});*app.state::<SocialState>().device.lock().unwrap()=Some(d);app.opener().open_url(&uri,None::<&str>).map_err(|_|"No se pudo abrir el navegador.")?;Ok(result)
}
#[tauri::command]pub async fn twitch_finish(app:AppHandle)->Result<bool,String>{
    let d=app.state::<SocialState>().device.lock().unwrap().clone().ok_or("Inicia primero la conexión.")?;
    let r=reqwest::Client::new().post("https://id.twitch.tv/oauth2/token").form(&[("client_id",d["client_id"].as_str().unwrap_or("")),("device_code",d["device_code"].as_str().unwrap_or("")),("scopes",SCOPES),("grant_type","urn:ietf:params:oauth:grant-type:device_code")]).send().await.map_err(|_|"No se pudo contactar con Twitch.")?;
    let code=r.status();let mut v:Value=r.json().await.map_err(|_|"Respuesta de Twitch no válida.")?;
    if !code.is_success(){if v["message"]=="authorization_pending"{return Ok(false);}return Err("La autorización no se completó o caducó. Vuelve a conectar.".into());}
    v["client_id"]=d["client_id"].clone();entry()?.set_password(&v.to_string()).map_err(|_|"No se pudo guardar la autorización en Windows.")?;*app.state::<SocialState>().device.lock().unwrap()=None;social_enable(app,"twitch".into(),true).await?;Ok(true)
}
#[tauri::command]pub async fn twitch_disconnect(app:AppHandle)->Result<(),String>{social_enable(app.clone(),"twitch".into(),false).await?;entry()?.delete_credential().map_err(|e|e.to_string())?;Ok(())}
async fn twitch_token()->Result<(String,String,String),String>{
    let raw=entry()?.get_password().map_err(|_|"Conecta Twitch desde Alertas.".to_string())?;let mut v:Value=serde_json::from_str(&raw).map_err(|_|"Vuelve a conectar Twitch.")?;
    let client=v["client_id"].as_str().ok_or("Falta Client ID.")?.to_string();
    let check=|token:String|async move{let r=reqwest::Client::new().get("https://id.twitch.tv/oauth2/validate").header("Authorization",format!("OAuth {token}")).send().await.map_err(|_|"No se pudo validar Twitch.")?;let good=r.status().is_success();let doc:Value=r.json().await.map_err(|_|"Respuesta no válida.")?;Ok::<_,String>((good,doc))};
    let mut token=v["access_token"].as_str().unwrap_or("").to_string();let (good,mut doc)=check(token.clone()).await?;
    if !good{let r=reqwest::Client::new().post("https://id.twitch.tv/oauth2/token").form(&[("grant_type","refresh_token"),("refresh_token",v["refresh_token"].as_str().unwrap_or("")),("client_id",&client)]).send().await.map_err(|_|"No se pudo renovar Twitch.")?;if !r.status().is_success(){return Err("Vuelve a autorizar Twitch.".into());}let fresh:Value=r.json().await.map_err(|_|"Respuesta no válida.")?;token=fresh["access_token"].as_str().ok_or("Falta token.")?.into();v["access_token"]=json!(token);if fresh["refresh_token"].is_string(){v["refresh_token"]=fresh["refresh_token"].clone();}entry()?.set_password(&v.to_string()).map_err(|_|"No se pudo renovar la autorización guardada.")?;let (good,new)=check(token.clone()).await?;if !good{return Err("Vuelve a conectar Twitch.".into());}doc=new;}
    if doc["client_id"].as_str()!=Some(client.as_str()){return Err("La autorización no corresponde a este cliente.".into());}
    Ok((client,token,doc["user_id"].as_str().ok_or("Falta usuario Twitch.")?.into()))
}
fn twitch_session(app:&AppHandle)->Result<(),String>{
    let (client,token,user)=tauri::async_runtime::block_on(twitch_token())?;
    let (mut socket,_)=tungstenite::connect("wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=10").map_err(|_|"No se pudo conectar EventSub. Se reintentará.")?;
    match socket.get_mut(){tungstenite::stream::MaybeTlsStream::Plain(s)=>{let _=s.set_read_timeout(Some(Duration::from_secs(15)));},tungstenite::stream::MaybeTlsStream::NativeTls(s)=>{let _=s.get_mut().set_read_timeout(Some(Duration::from_secs(15)));},_=>{}}
    let started=Instant::now();let mut recent=std::collections::VecDeque::<String>::new();
    loop{
        let enabled=tauri::async_runtime::block_on(load(app,"social-settings"))?["twitch"]==true;if !enabled{return Ok(());}
        if started.elapsed()>Duration::from_secs(3500){return Err("Renovando sesión Twitch…".into());}
        let msg=socket.read().map_err(|_|"Conexión Twitch interrumpida. Reconectando…")?;if msg.is_ping(){socket.send(tungstenite::Message::Pong(msg.into_data())).map_err(|_|"Twitch sin respuesta.")?;continue;}if !msg.is_text(){continue;}let v:Value=serde_json::from_str(msg.to_text().unwrap_or("")).map_err(|_|"Evento no válido.")?;
        match v["metadata"]["message_type"].as_str().unwrap_or(""){
            "session_welcome"=>{let session=v["payload"]["session"]["id"].as_str().ok_or("Sesión sin ID.")?;
                for (kind,version,condition) in [("channel.follow","2",json!({"broadcaster_user_id":user,"moderator_user_id":user})),("channel.subscribe","1",json!({"broadcaster_user_id":user})),("channel.subscription.message","1",json!({"broadcaster_user_id":user})),("channel.subscription.gift","1",json!({"broadcaster_user_id":user})),("channel.cheer","1",json!({"broadcaster_user_id":user})),("channel.raid","1",json!({"to_broadcaster_user_id":user}))]{
                    tauri::async_runtime::block_on(async{let r=reqwest::Client::new().post("https://api.twitch.tv/helix/eventsub/subscriptions").bearer_auth(&token).header("Client-Id",&client).json(&json!({"type":kind,"version":version,"condition":condition,"transport":{"method":"websocket","session_id":session}})).send().await.map_err(|_|"No se pudo registrar EventSub.")?;if !r.status().is_success(){return Err(format!("Twitch no habilitó {kind} ({}). Revisa permisos y afiliación.",r.status()));}Ok(())})?;
                }status(app,"twitch","Conectado · follows, subs, regalos, bits y raids",true);
            },
            "notification"=>{let id=v["metadata"]["message_id"].as_str().unwrap_or("").to_string();if recent.contains(&id){continue;}if let Some(e)=crate::social_events::twitch(v["payload"]["subscription"]["type"].as_str().unwrap_or(""),&v["payload"]["event"]){tauri::async_runtime::block_on(deliver(app,"twitch",e))?;}recent.push_back(id);if recent.len()>2000{recent.pop_front();}},
            "session_reconnect"=>return Err("Twitch solicitó renovar la conexión. Reconectando…".into()),
            "revocation"=>return Err("Twitch revocó una suscripción. Reautoriza la conexión.".into()),_=>{}
        }
    }
}
pub fn start(app:AppHandle){
    let youtube=app.clone();std::thread::spawn(move||{let mut reader=YouTubeReader::default();loop{std::thread::sleep(Duration::from_secs(2));let enabled=tauri::async_runtime::block_on(load(&youtube,"social-settings")).ok().is_some_and(|v|v["youtube"]==true);if !enabled{reader=YouTubeReader::default();continue;}if let Err(e)=tauri::async_runtime::block_on(reader.tick(&youtube)){status(&youtube,"youtube",&e,false);std::thread::sleep(Duration::from_secs(30));}}});
    std::thread::spawn(move||loop{std::thread::sleep(Duration::from_secs(5));let enabled=tauri::async_runtime::block_on(load(&app,"social-settings")).ok().is_some_and(|v|v["twitch"]==true);if !enabled{continue;}if let Err(e)=twitch_session(&app){status(&app,"twitch",&e,false);std::thread::sleep(Duration::from_secs(10));}});
}

//! Chat efímero y categoría de Twitch. Las credenciales nunca salen al frontend/overlay.
use crate::stream_core::{ChatBuffer, category_ready};
use serde_json::{Value, json};
use std::{sync::Mutex, time::{Duration, Instant}};
use tauri::{AppHandle, Manager};

struct Context { game: Option<String>, ambiguous: bool, since: Instant, checked: Instant, revision: u64 }
impl Default for Context { fn default()->Self {Self{game:None,ambiguous:false,since:Instant::now(),checked:Instant::now(),revision:0}} }
#[derive(Default)]
pub struct StreamingState {
    chat: Mutex<ChatBuffer>,
    context: Mutex<Context>,
    category_message: Mutex<String>,
}
fn platform(p:&str)->Result<(),String> {if ["twitch","youtube"].contains(&p) {Ok(())}else{Err("Plataforma no disponible.".into())}}
pub fn clear(app:&AppHandle,p:&str) {app.state::<StreamingState>().chat.lock().unwrap().remove(p,None,None);}
pub async fn receive(app:&AppHandle,p:&str,kind:&str,v:&Value) {
    if crate::social_alerts::load(app,"stream-chat-enabled").await.ok().as_ref()!=Some(&json!(true)){return;}
    if crate::social_alerts::load(app,"social-settings").await.ok().is_none_or(|s|s[p]!=true){return;}
    let state=app.state::<StreamingState>();
    let mut chat=state.chat.lock().unwrap();
    match (p,kind) {
        ("twitch","channel.chat.message")=>{if let Some(m)=crate::stream_core::twitch_message(v){chat.push(m);}},
        ("twitch","channel.chat.message_delete")=>{if let Some(id)=v["message_id"].as_str(){chat.remove(p,Some(id),None);}},
        ("twitch","channel.chat.clear_user_messages")=>{if let Some(id)=v["target_user_id"].as_str(){chat.remove(p,None,Some(id));}},
        ("twitch","channel.chat.clear")=>chat.remove(p,None,None),
        ("youtube","messageDeletedEvent")=>{if let Some(id)=v["snippet"]["messageDeletedDetails"]["deletedMessageId"].as_str(){chat.remove(p,Some(id),None);}},
        ("youtube","userBannedEvent")=>{if let Some(id)=v["snippet"]["userBannedDetails"]["bannedUserDetails"]["channelId"].as_str(){chat.remove(p,None,Some(id));}},
        ("youtube",_)=>{if let Some(m)=crate::stream_core::youtube_message(v){chat.push(m);}},
        _=>{}
    }
}
pub fn snapshot(app:&AppHandle,p:Option<&str>)->Value {
    let state=app.state::<StreamingState>();let chat=state.chat.lock().unwrap();
    json!({"revision":chat.revision,"messages":chat.messages.iter().filter(|m|p.is_none_or(|p|m.platform==p)).collect::<Vec<_>>()})
}
#[tauri::command]
pub fn stream_chat(app:AppHandle)->Value {snapshot(&app,None)}
#[tauri::command]
pub async fn stream_chat_enable(app:AppHandle,enabled:bool)->Result<(),String> {
    crate::social_alerts::save(&app,"stream-chat-enabled",&json!(enabled)).await?;
    if !enabled {clear(&app,"twitch");clear(&app,"youtube");} Ok(())
}
#[tauri::command]
pub fn stream_chat_clear(app:AppHandle,platform_name:String)->Result<(),String>{platform(&platform_name)?;clear(&app,&platform_name);Ok(())}
#[tauri::command]
pub fn stream_game_context(app:AppHandle,game_id:Option<String>,ambiguous:bool){
    let state=app.state::<StreamingState>();let mut c=state.context.lock().unwrap();
    if c.game!=game_id || c.ambiguous!=ambiguous {c.since=Instant::now();c.revision+=1;}
    c.game=game_id;c.ambiguous=ambiguous;c.checked=Instant::now();
}
#[tauri::command]
pub async fn stream_settings(app:AppHandle)->Result<Value,String>{
    let pool=crate::backup::pool(&app).await?;
    let rows:Vec<String>=sqlx::query_scalar("SELECT content FROM alert_cursor WHERE id LIKE 'stream-category-map/%'").fetch_all(&pool).await.map_err(|e|e.to_string())?;
    let mappings:Vec<Value>=rows.iter().filter_map(|r|serde_json::from_str(r).ok()).collect();
    let message=app.state::<StreamingState>().category_message.lock().unwrap().clone();
    Ok(json!({"chat_enabled":crate::social_alerts::load(&app,"stream-chat-enabled").await?==true,"category_enabled":crate::social_alerts::load(&app,"stream-category-enabled").await?==true,"mappings":mappings,"category_message":message}))
}
#[tauri::command]
pub async fn stream_category_enable(app:AppHandle,enabled:bool)->Result<(),String>{
    crate::social_alerts::save(&app,"stream-category-enabled",&json!(enabled)).await?;
    // Activar/reanudar vuelve a exigir estabilidad antes de escribir en Twitch.
    let state=app.state::<StreamingState>();let mut c=state.context.lock().unwrap();c.since=Instant::now();c.revision+=1;
    Ok(())
}
async fn twitch_get(path:&str,query:&[(&str,&str)])->Result<Value,String>{
    let(client,token,_)=crate::social_alerts::twitch_token().await?;
    let response=reqwest::Client::builder().timeout(Duration::from_secs(15)).build().map_err(|_|"No se pudo iniciar HTTP.")?
        .get(format!("https://api.twitch.tv/helix/{path}")).header("Client-Id",client).bearer_auth(token).query(query).send().await.map_err(|_|"Twitch no respondió. Se reintentará.")?;
    if !response.status().is_success(){return Err(format!("Twitch rechazó la consulta ({}). Comprueba la conexión.",response.status()));}
    response.json().await.map_err(|_|"Respuesta no válida de Twitch.".into())
}
#[tauri::command]
pub async fn stream_category_search(query:String)->Result<Value,String>{
    let query=query.trim();if query.chars().count()<2 || query.len()>100{return Err("Escribe entre 2 y 100 caracteres.".into());}
    let v=twitch_get("search/categories",&[("query",query),("first","10")]).await?;
    Ok(v["data"].clone())
}
#[tauri::command]
pub async fn stream_category_bind(app:AppHandle,game_id:String,category_id:Option<String>)->Result<(),String>{
    let pool=crate::backup::pool(&app).await?;
    let exists:Option<String>=sqlx::query_scalar("SELECT id FROM game WHERE id=? AND workspace_id=?").bind(&game_id).bind(crate::obs_store::WORKSPACE).fetch_optional(&pool).await.map_err(|e|e.to_string())?;
    if exists.is_none(){return Err("El juego ya no está en la biblioteca.".into());}
    let key=format!("stream-category-map/{game_id}");
    if let Some(id)=category_id {
        if id.is_empty() || id.len()>30 || !id.chars().all(|c|c.is_ascii_digit()){return Err("Categoría no válida.".into());}
        let v=twitch_get("games",&[("id",&id)]).await?;
        let name=v["data"][0]["name"].as_str().ok_or("La categoría no existe en Twitch.")?;
        crate::social_alerts::save(&app,&key,&json!({"game_id":game_id,"category_id":id,"name":name})).await?;
    }else{sqlx::query("DELETE FROM alert_cursor WHERE id=?").bind(key).execute(&pool).await.map_err(|e|e.to_string())?;}
    let state=app.state::<StreamingState>();let mut c=state.context.lock().unwrap();c.since=Instant::now();c.revision+=1;
    Ok(())
}

fn context_current(app:&AppHandle,revision:u64)->bool {
    let state=app.state::<StreamingState>();let c=state.context.lock().unwrap();
    c.revision==revision && category_ready(true,c.game.is_some(),c.ambiguous,c.since.elapsed().as_secs(),c.checked.elapsed().as_secs())
}
async fn category_tick(app:&AppHandle)->Result<String,String>{
    if crate::social_alerts::load(app,"stream-category-enabled").await?!=true{return Ok("Categoría automática pausada".into());}
    if crate::social_alerts::load(app,"social-settings").await?["twitch"]!=true{return Ok("Activa la conexión de Twitch en Alertas".into());}
    let(game,revision,ready)={let state=app.state::<StreamingState>();let c=state.context.lock().unwrap();(c.game.clone(),c.revision,category_ready(true,c.game.is_some(),c.ambiguous,c.since.elapsed().as_secs(),c.checked.elapsed().as_secs()))};
    if !ready{return Ok("Esperando un juego inequívoco durante 30 s; selección manual disponible en Juegos".into());}
    let mapping=crate::social_alerts::load(app,&format!("stream-category-map/{}",game.unwrap())).await?;
    let Some(id)=mapping["category_id"].as_str()else{return Ok("Asocia una categoría al juego actual".into());};
    let(client,token,user)=crate::social_alerts::twitch_token().await?;
    let http=reqwest::Client::builder().timeout(Duration::from_secs(15)).build().map_err(|_|"No se pudo iniciar HTTP.")?;
    let get=|path:&str|http.get(format!("https://api.twitch.tv/helix/{path}")).header("Client-Id",&client).bearer_auth(&token);
    let response=get("streams").query(&[("user_id",&user)]).send().await.map_err(|_|"Twitch no respondió.")?;
    if !response.status().is_success(){return Err(format!("No se pudo comprobar el directo ({}).",response.status()));}
    let streams:Value=response.json().await.map_err(|_|"Respuesta no válida.")?;
    if streams["data"].as_array().is_none_or(|a|a.is_empty()){return Ok("Preparado; la categoría se actualizará al estar en directo".into());}
    let response=get("channels").query(&[("broadcaster_id",&user)]).send().await.map_err(|_|"Twitch no respondió.")?;
    if !response.status().is_success(){return Err(format!("No se pudo leer la categoría ({}).",response.status()));}
    let current:Value=response.json().await.map_err(|_|"Respuesta no válida.")?;
    if current["data"][0]["game_id"]==id {return Ok(format!("Categoría sincronizada: {}",mapping["name"].as_str().unwrap_or(id)));}
    // Revalidar tras la red: no escribir si el usuario pausó o cambió de juego entretanto.
    if !context_current(app,revision) || crate::social_alerts::load(app,"stream-category-enabled").await?!=true || crate::social_alerts::load(app,"social-settings").await?["twitch"]!=true{return Ok("Cambio cancelado; contexto actualizado".into());}
    let response=http.patch("https://api.twitch.tv/helix/channels").header("Client-Id",client).bearer_auth(token).query(&[("broadcaster_id",user)]).json(&json!({"game_id":id})).send().await.map_err(|_|"No se pudo confirmar el cambio. Se comprobará antes de repetirlo.")?;
    if response.status()==403 || response.status()==401{return Err("Vuelve a autorizar Twitch para permitir cambiar la categoría (channel:manage:broadcast).".into());}
    if !response.status().is_success(){return Err(format!("Twitch no aceptó el cambio ({}). Se reintentará más tarde.",response.status()));}
    Ok(format!("Categoría actualizada: {}",mapping["name"].as_str().unwrap_or(id)))
}
pub fn start(app:AppHandle){std::thread::spawn(move||loop{
    std::thread::sleep(Duration::from_secs(5));
    let result=tauri::async_runtime::block_on(category_tick(&app));
    *app.state::<StreamingState>().category_message.lock().unwrap()=result.unwrap_or_else(|e|e);
    // Una consulta por minuto como máximo, también cuando Twitch rechaza o pierde la respuesta.
    std::thread::sleep(Duration::from_secs(55));
});}

//! OBS WebSocket v5: lectura y guardado explícito del Replay Buffer. Separado de Tauri para probarlo con un servidor local.
use base64::{Engine, engine::general_purpose::STANDARD};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    net::{SocketAddr, TcpStream},
    time::Duration,
};
use tungstenite::{Message, WebSocket};

pub fn authentication(password: &str, salt: &str, challenge: &str) -> String {
    let secret = STANDARD.encode(Sha256::digest(format!("{password}{salt}")));
    STANDARD.encode(Sha256::digest(format!("{secret}{challenge}")))
}

pub struct Client {
    socket: WebSocket<TcpStream>,
    sequence: u64,
    pub stopped_record_path: Option<String>,
    saved_replay_path: Option<String>,
}
impl Client {
    pub fn connect(port: u16, password: &str) -> Result<Self, String> {
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        let stream = TcpStream::connect_timeout(&addr, Duration::from_secs(2)).map_err(|_| {
            "No se pudo conectar con OBS. Activa su servidor WebSocket y comprueba el puerto."
                .to_string()
        })?;
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .map_err(|e| e.to_string())?;
        stream
            .set_write_timeout(Some(Duration::from_secs(2)))
            .map_err(|e| e.to_string())?;
        let (socket, _) = tungstenite::client(format!("ws://127.0.0.1:{port}"), stream)
            .map_err(|_| "OBS no respondió como servidor WebSocket v5.".to_string())?;
        let mut client = Self {
            socket,
            sequence: 0,
            stopped_record_path: None,
            saved_replay_path: None,
        };
        let hello = client.read()?;
        if hello["op"] != 0 {
            return Err("OBS no envió el saludo WebSocket v5.".into());
        }
        let mut identify = json!({"rpcVersion":1,"eventSubscriptions":64});
        if let Some(auth) = hello["d"].get("authentication") {
            let salt = auth["salt"]
                .as_str()
                .ok_or("Autenticación OBS no válida.")?;
            let challenge = auth["challenge"]
                .as_str()
                .ok_or("Autenticación OBS no válida.")?;
            identify["authentication"] = authentication(password, salt, challenge).into();
        }
        client.send(json!({"op":1,"d":identify}))?;
        if client.read().map_err(
            |_| "OBS rechazó la conexión. Comprueba la contraseña del servidor WebSocket.",
        )?["op"]
            != 2
        {
            return Err("OBS no confirmó la conexión.".into());
        }
        Ok(client)
    }
    fn send(&mut self, value: Value) -> Result<(), String> {
        self.socket
            .send(Message::Text(value.to_string().into()))
            .map_err(|_| "Se perdió la conexión con OBS.".into())
    }
    fn read(&mut self) -> Result<Value, String> {
        for _ in 0..64 {
            match self
                .socket
                .read()
                .map_err(|_| "OBS dejó de responder.".to_string())?
            {
                Message::Text(text) => {
                    return serde_json::from_str(text.as_str())
                        .map_err(|_| "Respuesta de OBS no válida.".into());
                }
                Message::Ping(data) => {
                    self.socket
                        .send(Message::Pong(data))
                        .map_err(|_| "Se perdió la conexión con OBS.")?;
                }
                Message::Close(_) => return Err("OBS cerró la conexión.".into()),
                _ => {}
            }
        }
        Err("Demasiados mensajes de OBS sin respuesta.".into())
    }
    fn observe_event(&mut self, message: &Value) {
        if message["op"] != 5 {
            return;
        }
        if message["d"]["eventType"] == "RecordStateChanged"
            && message["d"]["eventData"]["outputState"] == "OBS_WEBSOCKET_OUTPUT_STOPPED"
        {
            self.stopped_record_path = message["d"]["eventData"]["outputPath"]
                .as_str()
                .filter(|p| !p.trim().is_empty())
                .map(String::from);
        }
        if message["d"]["eventType"] == "ReplayBufferSaved" {
            self.saved_replay_path = message["d"]["eventData"]["savedReplayPath"]
                .as_str()
                .filter(|p| !p.trim().is_empty())
                .map(String::from);
        }
    }
    pub fn save_replay(&mut self) -> Result<String, String> {
        self.save_replay_timeout(Duration::from_secs(15))
    }
    fn save_replay_timeout(&mut self, timeout: Duration) -> Result<String, String> {
        if self.request("GetReplayBufferStatus")?["outputActive"] != true {
            return Err("El Replay Buffer no está activo. Actívalo en Ajustes → Salida de OBS y pulsa Iniciar búfer de repetición.".into());
        }
        // Nunca consultar GetLastReplayBufferReplay: podría devolver un archivo anterior.
        self.saved_replay_path = None;
        self.sequence += 1;
        let id = self.sequence.to_string();
        self.send(json!({"op":6,"d":{"requestType":"SaveReplayBuffer","requestId":id}}))?;
        let result = (|| {
            let deadline = std::time::Instant::now() + timeout;
            let mut accepted = false;
            while std::time::Instant::now() < deadline {
                let remaining = deadline.saturating_duration_since(std::time::Instant::now());
                self.socket
                    .get_mut()
                    .set_read_timeout(Some(
                        remaining
                            .min(Duration::from_millis(500))
                            .max(Duration::from_millis(1)),
                    ))
                    .map_err(|e| e.to_string())?;
                match self.socket.read() {
                    Ok(Message::Text(text)) => {
                        let message:Value=serde_json::from_str(text.as_str()).map_err(|_|"Respuesta de OBS no válida.")?;
                        self.observe_event(&message);
                        if message["op"]==7 && message["d"]["requestId"]==id {
                            if message["d"]["requestStatus"]["result"]!=true { return Err("OBS rechazó el guardado del Replay Buffer. Comprueba la carpeta y el espacio disponible.".into()); }
                            accepted=true;
                        }
                        if accepted {
                            if let Some(path)=self.saved_replay_path.take() { return Ok(path); }
                        }
                    },
                    Ok(Message::Ping(data)) => { self.socket.send(Message::Pong(data)).map_err(|_|"Se perdió la conexión con OBS.")?; },
                    Err(tungstenite::Error::Io(e)) if matches!(e.kind(),std::io::ErrorKind::WouldBlock|std::io::ErrorKind::TimedOut) => {},
                    Ok(Message::Close(_))|Err(_) => return Err("OBS se desconectó antes de confirmar el archivo. No se registró ningún clip.".into()),
                    _=>{},
                }
            }
            Err("OBS no confirmó la ruta del clip a tiempo. Comprueba su carpeta de grabaciones antes de reintentar; no se registró un clip como guardado.".into())
        })();
        let _ = self
            .socket
            .get_mut()
            .set_read_timeout(Some(Duration::from_secs(2)));
        result
    }
    pub fn request(&mut self, kind: &str) -> Result<Value, String> {
        self.request_data(kind, None)
    }
    pub fn request_data(&mut self, kind: &str, data: Option<Value>) -> Result<Value, String> {
        // Esta entrega nunca debe iniciar/parar emisiones ni cambiar escenas.
        if !matches!(
            kind,
            "GetRecordStatus"
                | "GetStreamStatus"
                | "GetReplayBufferStatus"
                | "GetInputList"
                | "GetSourceScreenshot"
        ) {
            return Err("Operación OBS no permitida.".into());
        }
        self.sequence += 1;
        let id = self.sequence.to_string();
        self.send(json!({"op":6,"d":{"requestType":kind,"requestId":id,"requestData":data.unwrap_or_else(||json!({}))}}))?;
        for _ in 0..64 {
            let message = self.read()?;
            self.observe_event(&message);
            if message["op"] == 7 && message["d"]["requestId"] == id {
                if message["d"]["requestStatus"]["result"] != true {
                    return Err(format!("OBS no pudo responder a {kind}."));
                }
                return Ok(message["d"]["responseData"].clone());
            }
        }
        Err("OBS no respondió a la consulta de estado.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    #[test]
    fn authenticated_connection_reads_status_and_record_path_without_controlling_obs() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut ws = tungstenite::accept(stream).unwrap();
            ws.send(Message::text(json!({"op":0,"d":{"rpcVersion":1,"authentication":{"salt":"salt","challenge":"challenge"}}}).to_string())).unwrap();
            let identify: Value =
                serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
            assert_eq!(
                identify["d"]["authentication"],
                authentication("password", "salt", "challenge")
            );
            ws.send(Message::text(r#"{"op":2,"d":{"negotiatedRpcVersion":1}}"#))
                .unwrap();
            let request: Value =
                serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
            assert_eq!(request["d"]["requestType"], "GetRecordStatus");
            ws.send(Message::text(r#"{"op":5,"d":{"eventType":"RecordStateChanged","eventData":{"outputState":"OBS_WEBSOCKET_OUTPUT_STOPPED","outputPath":"D:/Vídeos/Fortnite.mkv"}}}"#)).unwrap();
            ws.send(Message::text(json!({"op":7,"d":{"requestId":request["d"]["requestId"],"requestStatus":{"result":true},"responseData":{"outputActive":true,"outputPaused":false,"outputDuration":123450}}}).to_string())).unwrap();
        });
        let mut client = Client::connect(port, "password").unwrap();
        assert_eq!(
            client.request("GetRecordStatus").unwrap()["outputDuration"],
            123450
        );
        assert_eq!(
            client.stopped_record_path.as_deref(),
            Some("D:/Vídeos/Fortnite.mkv")
        );
        assert!(client.request("StartStream").is_err());
        server.join().unwrap();
    }
    #[test]
    fn rejects_wrong_authentication_and_unavailable_port() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let server = std::thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            let mut ws = tungstenite::accept(stream).unwrap();
            ws.send(Message::text(
                r#"{"op":0,"d":{"rpcVersion":1,"authentication":{"salt":"s","challenge":"c"}}}"#,
            ))
            .unwrap();
            let _ = ws.read();
            let _ = ws.close(None);
        });
        assert!(
            Client::connect(port, "incorrecta")
                .err()
                .unwrap()
                .contains("contraseña")
        );
        server.join().unwrap();
        assert!(Client::connect(port, "").is_err());
    }
    fn replay_server(
        active: bool,
        accepted: bool,
        event_first: bool,
        confirm: bool,
        stale: bool,
    ) -> (u16, std::thread::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let worker = std::thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_millis(500)))
                .unwrap();
            let mut ws = tungstenite::accept(stream).unwrap();
            ws.send(Message::text(r#"{"op":0,"d":{"rpcVersion":1}}"#))
                .unwrap();
            let _ = ws.read().unwrap();
            ws.send(Message::text(r#"{"op":2,"d":{"negotiatedRpcVersion":1}}"#))
                .unwrap();
            let status: Value =
                serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
            assert_eq!(status["d"]["requestType"], "GetReplayBufferStatus");
            if stale {
                ws.send(Message::text(r#"{"op":5,"d":{"eventType":"ReplayBufferSaved","eventData":{"savedReplayPath":"D:/old.mkv"}}}"#)).unwrap();
            }
            ws.send(Message::text(json!({"op":7,"d":{"requestId":status["d"]["requestId"],"requestStatus":{"result":true},"responseData":{"outputActive":active}}}).to_string())).unwrap();
            if !active {
                assert!(ws.read().is_err());
                return;
            }
            let save: Value = serde_json::from_str(ws.read().unwrap().to_text().unwrap()).unwrap();
            assert_eq!(save["d"]["requestType"], "SaveReplayBuffer");
            let event = r#"{"op":5,"d":{"eventType":"ReplayBufferSaved","eventData":{"savedReplayPath":"D:/Vídeos/Nueva jugada.mkv"}}}"#;
            if event_first && confirm {
                ws.send(Message::text(event)).unwrap();
            }
            ws.send(Message::text(json!({"op":7,"d":{"requestId":save["d"]["requestId"],"requestStatus":{"result":accepted},"responseData":{}}}).to_string())).unwrap();
            if !event_first && confirm {
                ws.send(Message::text(event)).unwrap();
            }
            if !confirm && accepted {
                std::thread::sleep(Duration::from_millis(200));
            }
        });
        (port, worker)
    }
    #[test]
    fn replay_requires_acknowledgement_and_new_file_event_in_either_order() {
        for event_first in [false, true] {
            let (port, server) = replay_server(true, true, event_first, true, false);
            let mut client = Client::connect(port, "").unwrap();
            assert_eq!(client.save_replay().unwrap(), "D:/Vídeos/Nueva jugada.mkv");
            server.join().unwrap();
        }
    }
    #[test]
    fn replay_does_not_start_inactive_buffer_or_report_rejected_save() {
        let (port, server) = replay_server(false, true, false, false, false);
        let mut client = Client::connect(port, "").unwrap();
        assert!(client.save_replay().unwrap_err().contains("no está activo"));
        drop(client);
        server.join().unwrap();
        let (port, server) = replay_server(true, false, false, false, false);
        let mut client = Client::connect(port, "").unwrap();
        assert!(client.save_replay().unwrap_err().contains("rechazó"));
        server.join().unwrap();
    }
    #[test]
    fn replay_acknowledgement_without_new_file_does_not_reuse_old_clip() {
        let (port, server) = replay_server(true, true, false, false, true);
        let mut client = Client::connect(port, "").unwrap();
        assert!(
            client
                .save_replay_timeout(Duration::from_millis(80))
                .unwrap_err()
                .contains("no confirmó")
        );
        server.join().unwrap();
    }
}

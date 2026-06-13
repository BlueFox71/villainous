// =============================================================================
// relay.rs — Relais WebSocket embarqué (port Rust de relay/server.js).
//
// GAME-AGNOSTIQUE : il ne connaît RIEN au jeu. Il route des « frames » JSON par
// salon (`room`), exactement comme le relais Node utilisé en mode web :
//   { room, t: 'join' }            → enregistre la socket dans le salon
//   { room, t: 'leave' }           → la retire
//   { room, t: 'data', data: ... } → réémet la frame telle quelle aux AUTRES
//
// Seul l'HÔTE démarre le relais (lié à 0.0.0.0:8787) ; l'invité s'y connecte via
// l'IP LAN de l'hôte. Démarrage idempotent : `ensure_relay` ne lie le port qu'une
// fois, les appels suivants sont sans effet.
// =============================================================================

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use tokio_tungstenite::tungstenite::Message;

/// Canal d'envoi vers la socket d'un membre.
type Tx = UnboundedSender<Message>;
/// room → (id de membre → canal d'envoi).
type Rooms = Arc<Mutex<HashMap<String, HashMap<usize, Tx>>>>;

/// Frame entrante (champ `data` réémis tel quel, donc non désérialisé ici).
#[derive(Deserialize)]
struct Frame {
    room: String,
    t: String,
}

/// Démarre le relais sur `port` (idempotent). Renvoie le port à utiliser côté
/// client. Le travail réseau tourne sur le runtime async de Tauri.
pub fn ensure_relay(port: u16) -> Result<u16, String> {
    static STARTED: AtomicBool = AtomicBool::new(false);
    if STARTED.swap(true, Ordering::SeqCst) {
        return Ok(port); // déjà lancé
    }
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run(port).await {
            log::error!("relais multijoueur : {e}");
        }
    });
    Ok(port)
}

/// Boucle d'acceptation : une tâche par connexion. (pub pour les tests d'intégration.)
pub async fn run(port: u16) -> std::io::Result<()> {
    let listener = TcpListener::bind(("0.0.0.0", port)).await?;
    let rooms: Rooms = Arc::new(Mutex::new(HashMap::new()));
    let next_id = Arc::new(AtomicUsize::new(0));
    loop {
        let (stream, _) = listener.accept().await?;
        let id = next_id.fetch_add(1, Ordering::Relaxed);
        let rooms = rooms.clone();
        tauri::async_runtime::spawn(handle_conn(stream, id, rooms));
    }
}

/// Retire le membre `id` du salon `room` (et supprime le salon s'il est vide).
fn leave(rooms: &Rooms, room: &str, id: usize) {
    let mut guard = rooms.lock().unwrap();
    let empty = match guard.get_mut(room) {
        Some(members) => {
            members.remove(&id);
            members.is_empty()
        }
        None => return,
    };
    if empty {
        guard.remove(room);
    }
}

/// Gère une connexion : handshake WS, puis routage des frames jusqu'à fermeture.
async fn handle_conn(stream: TcpStream, id: usize, rooms: Rooms) {
    let ws = match tokio_tungstenite::accept_async(stream).await {
        Ok(ws) => ws,
        Err(_) => return, // handshake raté : on abandonne la socket
    };
    let (mut write, mut read) = ws.split();
    let (tx, mut rx) = unbounded_channel::<Message>();

    // Tâche d'écriture : draine le canal du membre vers sa socket.
    let writer = tauri::async_runtime::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(msg).await.is_err() {
                break;
            }
        }
    });

    let mut joined: Vec<String> = Vec::new();
    while let Some(Ok(msg)) = read.next().await {
        // On normalise tout message en texte (robuste aux versions de tungstenite
        // où Text porte String ou Utf8Bytes).
        let raw = match msg {
            Message::Text(t) => t.to_string(),
            Message::Binary(b) => match String::from_utf8(b.to_vec()) {
                Ok(s) => s,
                Err(_) => continue,
            },
            Message::Close(_) => break,
            _ => continue, // Ping/Pong : ignorés
        };
        let Ok(frame) = serde_json::from_str::<Frame>(&raw) else {
            continue; // frame illisible
        };
        match frame.t.as_str() {
            "join" => {
                rooms
                    .lock()
                    .unwrap()
                    .entry(frame.room.clone())
                    .or_default()
                    .insert(id, tx.clone());
                if !joined.contains(&frame.room) {
                    joined.push(frame.room);
                }
            }
            "leave" => {
                leave(&rooms, &frame.room, id);
                joined.retain(|r| r != &frame.room);
            }
            "data" => {
                // Réémet le texte brut aux AUTRES membres du salon.
                let guard = rooms.lock().unwrap();
                if let Some(members) = guard.get(&frame.room) {
                    for (pid, peer) in members {
                        if *pid != id {
                            let _ = peer.send(Message::Text(raw.clone().into()));
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // Déconnexion : on quitte tous les salons rejoints et on arrête l'écriture.
    for room in &joined {
        leave(&rooms, room, id);
    }
    writer.abort();
}

/// Adresses IPv4 LAN de cette machine (pour afficher où l'invité doit se
/// connecter). Exclut loopback et link-local (169.254.x.x).
pub fn lan_addresses() -> Vec<String> {
    let mut out = Vec::new();
    if let Ok(netifs) = local_ip_address::list_afinet_netifas() {
        for (_name, ip) in netifs {
            if let IpAddr::V4(v4) = ip {
                if !v4.is_loopback() && !v4.is_link_local() {
                    out.push(v4.to_string());
                }
            }
        }
    }
    out
}

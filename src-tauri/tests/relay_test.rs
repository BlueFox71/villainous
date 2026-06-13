// Test d'intégration du relais embarqué : deux clients dans le même salon ;
// une frame `data` envoyée par l'un doit être reçue par l'autre, telle quelle.

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

#[tokio::test]
async fn relays_data_between_peers_in_same_room() {
    let port = 18787;
    tokio::spawn(async move {
        let _ = app_lib::relay::run(port).await;
    });
    // Laisse le listener se lier.
    tokio::time::sleep(Duration::from_millis(300)).await;

    let url = format!("ws://127.0.0.1:{port}");
    let (mut a, _) = connect_async(&url).await.expect("client A connecté");
    let (mut b, _) = connect_async(&url).await.expect("client B connecté");

    a.send(Message::Text(r#"{"room":"R","t":"join"}"#.into())).await.unwrap();
    b.send(Message::Text(r#"{"room":"R","t":"join"}"#.into())).await.unwrap();
    tokio::time::sleep(Duration::from_millis(150)).await;

    // A émet une frame data ; B doit la recevoir (et A non — pas testé ici).
    a.send(Message::Text(r#"{"room":"R","t":"data","data":{"hello":1}}"#.into()))
        .await
        .unwrap();

    let got = tokio::time::timeout(Duration::from_secs(2), b.next())
        .await
        .expect("pas de timeout")
        .expect("un message")
        .expect("frame valide");
    assert!(got.to_text().unwrap().contains("hello"));
}

#[tokio::test]
async fn does_not_leak_across_rooms() {
    let port = 18788;
    tokio::spawn(async move {
        let _ = app_lib::relay::run(port).await;
    });
    tokio::time::sleep(Duration::from_millis(300)).await;

    let url = format!("ws://127.0.0.1:{port}");
    let (mut a, _) = connect_async(&url).await.expect("client A");
    let (mut b, _) = connect_async(&url).await.expect("client B");

    // Salons différents : aucune frame ne doit passer de A à B.
    a.send(Message::Text(r#"{"room":"X","t":"join"}"#.into())).await.unwrap();
    b.send(Message::Text(r#"{"room":"Y","t":"join"}"#.into())).await.unwrap();
    tokio::time::sleep(Duration::from_millis(150)).await;

    a.send(Message::Text(r#"{"room":"X","t":"data","data":1}"#.into())).await.unwrap();

    // B ne doit RIEN recevoir dans le délai imparti.
    let res = tokio::time::timeout(Duration::from_millis(500), b.next()).await;
    assert!(res.is_err(), "B n'aurait pas dû recevoir de message d'un autre salon");
}

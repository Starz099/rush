use rusqlite::Connection;
use std::{collections::HashMap, sync::Mutex};
use tokio::sync::oneshot;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub storyboard_requests: Mutex<HashMap<String, oneshot::Sender<String>>>,
}

use std::sync::{Arc, Mutex};
use std::collections::HashMap;

/// Holds relay connection state per project.
/// In v1 we use a simple in-memory model: the frontend drives the
/// WebSocket connection via the browser, and the Rust side just
/// tracks metadata (room ID, token, relay URL) so we can persist
/// them across tab switches.
pub struct RelayState {
    pub rooms: Mutex<HashMap<String, RoomInfo>>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct RoomInfo {
    pub room_id: String,
    pub token: String,
    pub relay_url: String,
}

impl RelayState {
    pub fn new() -> Self {
        Self {
            rooms: Mutex::new(HashMap::new()),
        }
    }

    pub fn set_room(&self, project_id: &str, info: RoomInfo) {
        let mut rooms = self.rooms.lock().unwrap();
        rooms.insert(project_id.to_string(), info);
    }

    pub fn get_room(&self, project_id: &str) -> Option<RoomInfo> {
        let rooms = self.rooms.lock().unwrap();
        rooms.get(project_id).cloned()
    }

    pub fn remove_room(&self, project_id: &str) {
        let mut rooms = self.rooms.lock().unwrap();
        rooms.remove(project_id);
    }
}

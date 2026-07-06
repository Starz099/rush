use app_lib::asset_processor::composer::audio::compose_transcript;
use app_lib::db::models::clip::{Clip, TimelineState, Track};
use app_lib::models::TrackType;
use rusqlite::Connection;

fn initialize_test_tables(conn: &Connection) {
    conn.execute(
        "CREATE TABLE asset_transcripts (
                    id TEXT PRIMARY KEY,
                    asset_id TEXT NOT NULL,
                    start_ms INTEGER NOT NULL,
                    end_ms INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    speaker_id TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                 );",
        [],
    )
    .unwrap();
}

#[test]
fn test_composed_transcript_math() {
    let conn = Connection::open_in_memory().unwrap();
    initialize_test_tables(&conn);

    let asset_id = "test-asset-1";
    let mock_json_transcript = serde_json::json!({
        "text": "hello world editor",
        "words": [
            { "word": "hello", "startMs": 0, "endMs": 500 },
            { "word": "world", "startMs": 600, "endMs": 1000 },
            { "word": "editor", "startMs": 2000, "endMs": 2500 }
        ]
    })
    .to_string();

    conn.execute(
        "INSERT INTO asset_transcripts (id, asset_id, start_ms, end_ms, text)
                 VALUES ('mock-id', ?1, 0, 2500, ?2)",
        [asset_id, &mock_json_transcript],
    )
    .unwrap();

    // Track 1 - Clip 1 (normal speed)
    let clip_1 = Clip {
        id: "clip-1".to_string(),
        asset_id: Some(asset_id.to_string()),
        timeline_in: 10,
        timeline_out: 40,
        source_in: 0,
        source_out: 30,
        transform: None,
        speed_factor: 1.0,
        effects: vec![],
    };

    // Track 1 - Clip 2 (0.5x speed)
    let clip_2 = Clip {
        id: "clip-2".to_string(),
        asset_id: Some(asset_id.to_string()),
        timeline_in: 110,
        timeline_out: 140,
        source_in: 60,
        source_out: 75,
        transform: None,
        speed_factor: 0.5,
        effects: vec![],
    };

    // Track 2 - Clip 3 (overlaps Track 1's Clip 1 from frame 30 to 40)
    let clip_3 = Clip {
        id: "clip-3".to_string(),
        asset_id: Some(asset_id.to_string()),
        timeline_in: 30,
        timeline_out: 60,
        source_in: 0,
        source_out: 30,
        transform: None,
        speed_factor: 1.0,
        effects: vec![],
    };

    let track_1 = Track {
        id: "track-1".to_string(),
        name: "Audio 1".to_string(),
        track_type: TrackType::Audio,
        clips: vec![clip_1, clip_2],
        transitions: vec![],
        is_muted: false,
        is_locked: false,
    };

    let track_2 = Track {
        id: "track-2".to_string(),
        name: "Audio 2".to_string(),
        track_type: TrackType::Audio,
        clips: vec![clip_3],
        transitions: vec![],
        is_muted: false,
        is_locked: false,
    };

    let timeline_state = TimelineState {
        playhead_position: 0,
        tracks: vec![track_1, track_2],
        background: None,
    };

    // Query from frame 0 to 150 to ensure Clip 2 is included in the query range
    let composed = compose_transcript(&conn, &timeline_state, 30, 0, 150).unwrap();

    // Verify correct word count (Clip 1: 2 words + Clip 2: 1 word + Clip 3: 2 words)
    assert_eq!(composed.words.len(), 5);

    // Verify Clip 1 (Track 1)
    assert_eq!(composed.words[0].word, "hello");
    assert_eq!(composed.words[0].start_frame, 10);
    assert_eq!(composed.words[0].end_frame, 25);

    assert_eq!(composed.words[1].word, "world");
    assert_eq!(composed.words[1].start_frame, 28);
    assert_eq!(composed.words[1].end_frame, 40);

    // Verify Clip 3 (Track 2 - overlapping hello)
    assert_eq!(composed.words[2].word, "hello");
    assert_eq!(composed.words[2].start_frame, 30);
    assert_eq!(composed.words[2].end_frame, 45);

    // Verify Clip 3 (Track 2 - overlapping world)
    assert_eq!(composed.words[3].word, "world");
    assert_eq!(composed.words[3].start_frame, 48);
    assert_eq!(composed.words[3].end_frame, 60);

    // Verify Clip 2 (Track 1 - slowed editor)
    assert_eq!(composed.words[4].word, "editor");
    assert_eq!(composed.words[4].start_frame, 110);
    assert_eq!(composed.words[4].end_frame, 140);

    // Verify timecode break string layout
    println!("Composed Transcript Result:\n{}", composed.text);
    assert!(composed.text.contains("[00:00.3] hello world hello world"));
    assert!(composed.text.contains("[00:03.7] editor"));
}

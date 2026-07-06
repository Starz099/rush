use rusqlite::Connection;
use std::path::Path;
use uuid::Uuid;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Uses FFmpeg to extract a standardized 16kHz, mono, 16-bit PCM WAV file
pub fn extract_wav_for_whisper(input_path: &str, output_path: &str) -> Result<(), String> {
    let mut cmd = crate::commands::process_helper::create_ffmpeg_command();

    let status = cmd
        .args(&[
            "-y",
            "-i",
            input_path,
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            output_path,
        ])
        .status()
        .map_err(|e| format!("FFmpeg failed to start: {}", e))?;

    if !status.success() {
        return Err("FFmpeg WAV extraction exited with an error status".into());
    }

    Ok(())
}

/// Transcribes WAV audio using whisper-rs (v0.16.0) and saves segments/words as JSON in SQLite
pub fn transcribe_audio(
    model_path: &Path,
    wav_path: &Path,
    asset_id: &str,
    db_path: &Path,
) -> Result<(), String> {
    // 1. Read WAV file using hound
    let mut reader =
        hound::WavReader::open(wav_path).map_err(|e| format!("Failed to open WAV file: {}", e))?;
    let spec = reader.spec();

    if spec.channels != 1 || spec.sample_rate != 16000 || spec.bits_per_sample != 16 {
        return Err("WAV audio must be 16kHz, mono, 16-bit PCM".into());
    }

    let samples: Vec<f32> = reader
        .samples::<i16>()
        .map(|s| {
            let sample = s.unwrap_or(0);
            sample as f32 / 32768.0
        })
        .collect();

    let envelope = calculate_rms_envelope(&samples);
    let beats = detect_beats(&envelope);
    let bpm = calculate_bpm(&beats);

    let serialized_envelope = serde_json::to_string(&envelope).unwrap_or_else(|_| "[]".to_string());
    let serialized_beats = serde_json::to_string(&beats).unwrap_or_else(|_| "[]".to_string());

    // 2. Load Whisper context
    let ctx = WhisperContext::new_with_params(
        model_path.to_str().ok_or("Invalid model path")?,
        WhisperContextParameters::default(),
    )
    .map_err(|e| format!("Failed to create Whisper context: {:?}", e))?;

    let mut state = ctx
        .create_state()
        .map_err(|e| format!("Failed to create Whisper state: {:?}", e))?;

    // 3. Set up transcription parameters
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_token_timestamps(true); // Extract word-level timestamps
    params.set_translate(true);
    params.set_language(Some("en"));

    // 4. Run inference
    state
        .full(params, &samples)
        .map_err(|e| format!("Failed to run Whisper transcription: {:?}", e))?;

    // 5. Open SQLite database connection
    let mut db =
        Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

    // Enable foreign keys
    let _ = db.execute("PRAGMA foreign_keys = ON;", []);

    let tx = db
        .transaction()
        .map_err(|e| format!("Failed to start database transaction: {}", e))?;

    tx.execute(
        "UPDATE asset_metadata
             SET bpm = ?1, amplitude_envelope = ?2, beats = ?3
             WHERE asset_id = ?4",
        (&bpm, &serialized_envelope, &serialized_beats, asset_id),
    )
    .map_err(|e| format!("Failed to update asset metadata: {}", e))?;

    // 6. Iterate through segments using modern whisper-rs iterator API
    for segment in state.as_iter() {
        let segment_text = segment.to_str().unwrap_or_default();

        let start_ms = segment.start_timestamp() * 10;
        let end_ms = segment.end_timestamp() * 10;

        let num_tokens = segment.n_tokens();
        let mut words = Vec::new();

        for j in 0..num_tokens {
            if let Some(token) = segment.get_token(j) {
                let token_text = token.to_str().unwrap_or_default();

                // Clean up special/control tokens
                if token_text.starts_with("[") && token_text.ends_with("]") {
                    continue;
                }

                let token_data = token.token_data();
                let word_start = token_data.t0 * 10;
                let word_end = token_data.t1 * 10;

                let cleaned_word = token_text.trim().to_string();
                if cleaned_word.is_empty() {
                    continue;
                }

                words.push(serde_json::json!({
                    "word": cleaned_word,
                    "startMs": word_start,
                    "endMs": word_end
                }));
            }
        }

        // Serialize both the text and the words array into the `text` field as a JSON string
        let serialized_content = serde_json::json!({
            "text": segment_text.trim(),
            "words": words
        })
        .to_string();

        let id = Uuid::new_v4().to_string();

        tx.execute(
            "INSERT INTO asset_transcripts (id, asset_id, start_ms, end_ms, text, speaker_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (
                &id,
                asset_id,
                &start_ms,
                &end_ms,
                &serialized_content,
                &None::<String>,
            ),
        )
        .map_err(|e| format!("Failed to insert transcript row: {}", e))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit transcript transaction: {}", e))?;

    Ok(())
}

/// Calculates the RMS energy envelope for every 100ms window (1,600 samples at 16kHz)
pub fn calculate_rms_envelope(samples: &[f32]) -> Vec<f32> {
    let window_size = 1600; // 100ms at 16kHz
    let mut envelope = Vec::new();

    for chunk in samples.chunks(window_size) {
        if chunk.is_empty() {
            continue;
        }
        // Step 1: Sum of squares
        let sum_sq: f32 = chunk.iter().map(|&x| x * x).sum();
        // Step 2: Mean square
        let mean_sq = sum_sq / chunk.len() as f32;
        // Step 3: Square root
        let rms = mean_sq.sqrt();
        envelope.push(rms);
    }

    envelope
}

/// Detects beat onsets (sudden volume spikes / beats) from the RMS energy envelope
pub fn detect_beats(envelope: &[f32]) -> Vec<f32> {
    let mut beat_timestamps = Vec::new();
    let window_size = 5; // 500ms sliding average window
    let threshold = 1.35; // Onset sensitivity multiplier (1.35x average)

    for i in window_size..envelope.len() {
        let current_energy = envelope[i];

        // Calculate the local average energy of the preceding frames
        let start = i - window_size;
        let sum: f32 = envelope[start..i].iter().sum();
        let local_avg = sum / window_size as f32;

        // If current energy rises significantly above local average, it's an onset!
        if current_energy > local_avg * threshold && current_energy > 0.015 {
            // Timestamp in seconds (each envelope index represents 100ms / 0.1s)
            let timestamp_sec = i as f32 * 0.1;
            beat_timestamps.push(timestamp_sec);
        }
    }

    beat_timestamps
}

/// Estimates the BPM (Beats Per Minute) from a list of beat timestamps in seconds
pub fn calculate_bpm(beats: &[f32]) -> f64 {
    if beats.len() < 2 {
        return 0.0;
    }

    // Compute intervals between consecutive beats
    let intervals: Vec<f32> = beats.windows(2).map(|w| w[1] - w[0]).collect();

    // Filter out intervals that are physically unlikely for music tempo (e.g., < 0.2s or > 2.0s)
    let valid_intervals: Vec<f32> = intervals
        .into_iter()
        .filter(|&interval| interval >= 0.2 && interval <= 2.0)
        .collect();

    if valid_intervals.is_empty() {
        return 0.0;
    }

    let sum: f32 = valid_intervals.iter().sum();
    let avg_interval = sum / valid_intervals.len() as f32;

    if avg_interval > 0.0 {
        let raw_bpm = 60.0 / avg_interval;
        // Round to 1 decimal place for neatness
        (raw_bpm as f64 * 10.0).round() / 10.0
    } else {
        0.0
    }
}

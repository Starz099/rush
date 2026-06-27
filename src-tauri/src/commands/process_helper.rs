use std::path::PathBuf;
use std::process::Command;

/// Creates a `Command` builder for FFmpeg, resolving to the bundled sidecar binary
/// if present on disk, and fallback to the system `ffmpeg` if not.
///
/// On Windows, it automatically configures the process to run in the background
/// without spawning a visible console/terminal window.
pub fn create_ffmpeg_command() -> Command {
    let ffmpeg_path = match get_ffmpeg_path() {
        Ok(path) => path,
        Err(e) => {
            eprintln!(
                "Warning: Failed to resolve sidecar ffmpeg path: {}. Falling back to 'ffmpeg' in PATH.",
                e
            );
            PathBuf::from("ffmpeg")
        }
    };

    let mut cmd = Command::new(ffmpeg_path);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    cmd
}

fn get_ffmpeg_path() -> Result<PathBuf, String> {
    let current_exe = std::env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?;
    let exe_dir = current_exe
        .parent()
        .ok_or("Failed to get parent directory of executable")?;

    let target = env!("TARGET");
    let ext = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };
    let filename = format!("ffmpeg-{}{}", target, ext);

    // 1. Try production path (same directory as executable)
    let prod_path = exe_dir.join(&filename);
    if prod_path.exists() {
        return Ok(prod_path);
    }

    // 2. Try development path (relative to target/debug or target/release inside src-tauri)
    let dev_path = exe_dir.join("../../binaries").join(&filename);
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // 3. Fallback to standard command in PATH if no sidecar binary is found on disk
    Ok(PathBuf::from("ffmpeg"))
}

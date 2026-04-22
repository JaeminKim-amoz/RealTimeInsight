use std::path::PathBuf;

pub fn runtime_exports_dir_from_cwd(cwd: PathBuf) -> Result<PathBuf, String> {
    let project_root = project_dir_from_cwd(cwd)?;
    Ok(project_root.join("runtime").join("exports"))
}

pub fn runtime_assets_dir_from_cwd(cwd: PathBuf) -> Result<PathBuf, String> {
    let project_root = project_dir_from_cwd(cwd)?;
    Ok(project_root.join("runtime").join("assets"))
}

pub fn runtime_matlab_dir_from_cwd(cwd: PathBuf) -> Result<PathBuf, String> {
    let project_root = project_dir_from_cwd(cwd)?;
    Ok(project_root.join("runtime").join("matlab"))
}

fn project_dir_from_cwd(cwd: PathBuf) -> Result<PathBuf, String> {
    if cwd.file_name().and_then(|name| name.to_str()) == Some("src-tauri") {
        let project = cwd
            .parent()
            .map(PathBuf::from)
            .ok_or_else(|| "failed to resolve project root from src-tauri cwd".to_string())?;
        return ensure_runtime_dir(project);
    }
    if cwd.file_name().and_then(|name| name.to_str()) == Some("project") {
        return ensure_runtime_dir(cwd);
    }
    let nested = cwd.join("project");
    if nested.join("runtime").is_dir() {
        return Ok(nested);
    }
    Err("failed to resolve project runtime directory from cwd".to_string())
}

fn ensure_runtime_dir(project: PathBuf) -> Result<PathBuf, String> {
    if project.join("runtime").is_dir() {
        Ok(project)
    } else {
        Err("resolved project directory does not contain runtime".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{runtime_assets_dir_from_cwd, runtime_exports_dir_from_cwd, runtime_matlab_dir_from_cwd};
    use std::path::PathBuf;

    fn temp_project() -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "rti-path-policy-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(root.join("project").join("src-tauri")).unwrap();
        std::fs::create_dir_all(root.join("project").join("runtime")).unwrap();
        root
    }

    #[test]
    fn resolves_runtime_exports_from_src_tauri_cwd() {
        let root = temp_project();
        let path = runtime_exports_dir_from_cwd(root.join("project").join("src-tauri")).unwrap();
        assert_eq!(path, root.join("project").join("runtime").join("exports"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_runtime_dirs_from_project_cwd() {
        let root = temp_project();
        let exports = runtime_exports_dir_from_cwd(root.join("project")).unwrap();
        let assets = runtime_assets_dir_from_cwd(root.join("project")).unwrap();
        let matlab = runtime_matlab_dir_from_cwd(root.join("project")).unwrap();
        assert_eq!(exports, root.join("project").join("runtime").join("exports"));
        assert_eq!(assets, root.join("project").join("runtime").join("assets"));
        assert_eq!(matlab, root.join("project").join("runtime").join("matlab"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_runtime_dirs_from_repo_root_cwd() {
        let root = temp_project();
        let assets = runtime_assets_dir_from_cwd(root.clone()).unwrap();
        assert_eq!(assets, root.join("project").join("runtime").join("assets"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_unrelated_cwd_without_runtime_tree() {
        let root = std::env::temp_dir().join(format!(
            "rti-path-policy-empty-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        assert!(runtime_assets_dir_from_cwd(root.clone()).is_err());
        let _ = std::fs::remove_dir_all(root);
    }
}

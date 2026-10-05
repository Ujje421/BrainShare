use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use uuid::Uuid;
use chrono::Utc;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Project brain directory not found")]
    NoHomeDir,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "agentType")]
    pub agent_type: String, // "claude" | "codex"
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

pub struct ProjectStore {
    root_dir: PathBuf,
}

impl ProjectStore {
    pub fn new() -> Result<Self, StoreError> {
        let home = dirs::home_dir().ok_or(StoreError::NoHomeDir)?;
        let root_dir = home.join("ProjectBrain");
        
        fs::create_dir_all(root_dir.join("projects"))?;
        Ok(Self { root_dir })
    }

    /// Alternate constructor for testing
    #[cfg(test)]
    pub fn with_dir(root_dir: PathBuf) -> Result<Self, StoreError> {
        fs::create_dir_all(root_dir.join("projects"))?;
        Ok(Self { root_dir })
    }

    fn projects_dir(&self) -> PathBuf {
        self.root_dir.join("projects")
    }

    fn project_dir(&self, id: &str) -> PathBuf {
        self.projects_dir().join(id)
    }

    pub fn list_projects(&self) -> Result<Vec<Project>, StoreError> {
        let mut projects = Vec::new();
        let dir = self.projects_dir();
        
        if !dir.exists() {
            return Ok(projects);
        }

        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                let json_path = path.join("project.json");
                if json_path.exists() {
                    let content = fs::read_to_string(&json_path)?;
                    if let Ok(project) = serde_json::from_str::<Project>(&content) {
                        projects.push(project);
                    }
                }
            }
        }

        projects.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(projects)
    }

    pub fn get_project(&self, id: &str) -> Result<Project, StoreError> {
        let json_path = self.project_dir(id).join("project.json");
        let content = fs::read_to_string(&json_path)?;
        let project: Project = serde_json::from_str(&content)?;
        Ok(project)
    }

    pub fn create_project(&self, name: String, repo_path: String, agent_type: String) -> Result<Project, StoreError> {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        
        let project = Project {
            id: id.clone(),
            name,
            repo_path,
            agent_type,
            created_at,
        };

        let p_dir = self.project_dir(&id);
        fs::create_dir_all(&p_dir)?;
        
        let json_path = p_dir.join("project.json");
        let json_str = serde_json::to_string_pretty(&project)?;
        fs::write(json_path, json_str)?;

        let mem_dir = p_dir.join("memory");
        fs::create_dir_all(&mem_dir)?;
        
        let seed_files = [
            ("MEMORY.md", format!("# {} Memory\n\nHigh-level index and context.\n", project.name)),
            ("decisions.md", "# Architectural & Product Decisions\n\nDocument key choices here.\n".to_string()),
            ("conventions.md", "# Coding Conventions\n\nStyle, tooling, and rules.\n".to_string()),
            ("status.md", "# Status\n\nWhat is done and what is next.\n".to_string()),
        ];

        for (file_name, content) in seed_files {
            fs::write(mem_dir.join(file_name), content)?;
        }

        fs::create_dir_all(p_dir.join("sessions"))?;

        Ok(project)
    }

    pub fn delete_project(&self, id: &str) -> Result<(), StoreError> {
        let p_dir = self.project_dir(id);
        if p_dir.exists() {
            fs::remove_dir_all(p_dir)?;
        }
        Ok(())
    }

    pub fn read_memory_file(&self, id: &str, file_name: &str) -> Result<String, StoreError> {
        let file_path = self.project_dir(id).join("memory").join(file_name);
        let content = fs::read_to_string(file_path)?;
        Ok(content)
    }

    pub fn write_memory_file(&self, id: &str, file_name: &str, content: &str) -> Result<(), StoreError> {
        let mem_dir = self.project_dir(id).join("memory");
        fs::create_dir_all(&mem_dir)?;
        let file_path = mem_dir.join(file_name);
        fs::write(file_path, content)?;
        Ok(())
    }

    pub fn list_memory_files(&self, id: &str) -> Result<Vec<String>, StoreError> {
        let mem_dir = self.project_dir(id).join("memory");
        let mut files = Vec::new();
        
        if !mem_dir.exists() {
            return Ok(files);
        }

        for entry in fs::read_dir(mem_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.ends_with(".md") {
                        files.push(name.to_string());
                    }
                }
            }
        }
        
        files.sort();
        Ok(files)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_project_lifecycle() {
        let dir = tempdir().unwrap();
        let store = ProjectStore::with_dir(dir.path().to_path_buf()).unwrap();

        // 1. Create a project
        let proj1 = store.create_project(
            "Test App".into(),
            "/path/to/test".into(),
            "claude".into(),
        ).unwrap();

        assert_eq!(proj1.name, "Test App");
        
        // 2. List projects
        let projects = store.list_projects().unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].id, proj1.id);

        // 3. Memory files seeded
        let mem_files = store.list_memory_files(&proj1.id).unwrap();
        assert!(mem_files.contains(&"MEMORY.md".to_string()));
        assert!(mem_files.contains(&"status.md".to_string()));

        // 4. Edit memory
        store.write_memory_file(&proj1.id, "MEMORY.md", "# Updated Memory").unwrap();
        let updated = store.read_memory_file(&proj1.id, "MEMORY.md").unwrap();
        assert_eq!(updated, "# Updated Memory");

        // 5. Delete project
        store.delete_project(&proj1.id).unwrap();
        let projects_after = store.list_projects().unwrap();
        assert_eq!(projects_after.len(), 0);
    }
}

pub mod assets;
pub mod bridge;
pub mod data_ref;
pub mod export;
pub mod graph;
pub mod ingest;
pub mod jobs;
pub mod llm;
pub mod matlab;
pub mod mission_edge;
pub mod pcm;
pub mod replay;
pub mod runtime_policy;
pub mod simdis;
pub mod stream;
pub mod video;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn core_ready() -> bool {
    true
}

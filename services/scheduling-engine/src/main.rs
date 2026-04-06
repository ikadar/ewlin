mod engine;
mod model;

use axum::{routing::post, Json, Router};
use model::schedule::{ComputeRequest, ScheduleResult};
use tower_http::cors::CorsLayer;

async fn compute_schedule(Json(request): Json<ComputeRequest>) -> Json<ScheduleResult> {
    let result = engine::compute(&request);
    Json(result)
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::permissive();
    let app = Router::new()
        .route("/compute", post(compute_schedule))
        .layer(cors);
    let port = std::env::var("PORT").unwrap_or_else(|_| "3003".to_string());
    let addr = format!("0.0.0.0:{}", port);
    println!("Flux Scheduler Engine listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
